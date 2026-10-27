// Lecture seule de l'API Proxmox : liste des invités, hôte, adresses IP.
import { request } from 'node:https';
import { readFileSync } from 'node:fs';

// Écarte boucle locale, ponts Docker (172.16/12), Tailscale (100.64/10) et lien local.
export function ipDuLan(ip) {
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  if (a === 127 || (a === 169 && b === 254)) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

export function clientPve({ url, jeton, ca }) {
  const base = new URL(url);
  const agentTls = ca ? { ca: readFileSync(ca) } : { rejectUnauthorized: false };

  function get(chemin) {
    return new Promise((resoudre, rejeter) => {
      const req = request(
        {
          hostname: base.hostname,
          port: base.port || 8006,
          path: `/api2/json${chemin}`,
          method: 'GET',
          headers: { Authorization: `PVEAPIToken=${jeton}` },
          timeout: 8000,
          // Le certificat de l'hôte est émis pour son nom, pas pour son IP.
          checkServerIdentity: () => undefined,
          ...agentTls,
        },
        (res) => {
          let corps = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (corps += c));
          res.on('end', () => {
            if (res.statusCode !== 200) return rejeter(new Error(`PVE ${chemin} : HTTP ${res.statusCode}`));
            try {
              resoudre(JSON.parse(corps).data);
            } catch (e) {
              rejeter(e);
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error(`PVE ${chemin} : délai dépassé`)));
      req.on('error', rejeter);
      req.end();
    });
  }

  async function invites() {
    const liste = await get('/cluster/resources?type=vm');
    return liste.map((r) => ({
      vmid: r.vmid,
      nom: r.name,
      type: r.type === 'lxc' ? 'CT' : 'VM',
      noeud: r.node,
      statut: r.status,
      cpu: r.cpu ?? 0,
      coeurs: r.maxcpu ?? 0,
      memoire: r.mem ?? 0,
      memoireMax: r.maxmem ?? 0,
      disque: r.disk ?? 0,
      disqueMax: r.maxdisk ?? 0,
      uptime: r.uptime ?? 0,
      tags: r.tags ? r.tags.split(/[;,]/).filter(Boolean) : [],
      modele: r.template === 1,
    }));
  }

  // Les nœuds du cluster (un seul pour un Proxmox seul), avec leur IP.
  async function noeuds() {
    const [liste, statut] = await Promise.all([get('/nodes'), get('/cluster/status').catch(() => [])]);
    return Promise.all(
      liste.map(async (n) => {
        const st = n.status === 'online' ? await get(`/nodes/${n.node}/status`).catch(() => null) : null;
        return {
          nom: n.node,
          ip: statut.find((x) => x.type === 'node' && x.name === n.node)?.ip ?? null,
          statut: n.status === 'online' ? 'running' : n.status,
          cpu: st?.cpu ?? n.cpu ?? 0,
          coeurs: st?.cpuinfo?.cpus ?? n.maxcpu ?? 0,
          memoire: st?.memory?.used ?? n.mem ?? 0,
          memoireMax: st?.memory?.total ?? n.maxmem ?? 0,
          disque: st?.rootfs?.used ?? 0,
          disqueMax: st?.rootfs?.total ?? 0,
          uptime: st?.uptime ?? n.uptime ?? 0,
          charge: st?.loadavg ?? null,
          version: st?.pveversion ?? null,
        };
      }),
    );
  }

  // Ce que la configuration dit en plus : les notes de l'onglet « Notes » et le démarrage auto.
  async function configuration(invite) {
    try {
      const chemin = invite.type === 'CT' ? 'lxc' : 'qemu';
      const c = await get(`/nodes/${invite.noeud}/${chemin}/${invite.vmid}/config`);
      return { notes: c.description ? c.description.trim() : null, onboot: c.onboot === 1 };
    } catch {
      return null;
    }
  }

  // Première IPv4 du LAN : interfaces du conteneur, ou agent invité pour une VM.
  async function ip(invite) {
    try {
      if (invite.type === 'CT') {
        const ifs = await get(`/nodes/${invite.noeud}/lxc/${invite.vmid}/interfaces`);
        for (const i of ifs ?? []) {
          const v4 = (i.inet ?? '').split('/')[0];
          if (i.name !== 'lo' && ipDuLan(v4)) return v4;
        }
      } else {
        const r = await get(`/nodes/${invite.noeud}/qemu/${invite.vmid}/agent/network-get-interfaces`);
        for (const i of r?.result ?? []) {
          if (i.name === 'lo') continue;
          for (const a of i['ip-addresses'] ?? []) {
            if (a['ip-address-type'] === 'ipv4' && ipDuLan(a['ip-address'])) return a['ip-address'];
          }
        }
      }
    } catch {
      // Invité éteint ou sans agent : pas d'IP connue.
    }
    return null;
  }

  return { invites, noeuds, configuration, ip };
}
