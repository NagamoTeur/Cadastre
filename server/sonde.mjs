// Les sondes : un port accepte-t-il une connexion, que répond-il en HTTP, et
// qu'annonce un serveur Minecraft.
import { Socket } from 'node:net';
import { request as requeteHttp } from 'node:http';
import { request as requeteHttps } from 'node:https';

export function sonderTcp(ip, port, delai = 2500) {
  return new Promise((resoudre) => {
    const debut = performance.now();
    const s = new Socket();
    const fin = (ouvert) => {
      s.destroy();
      resoudre({ ouvert, ms: ouvert ? Math.round(performance.now() - debut) : null });
    };
    s.setTimeout(delai);
    s.once('connect', () => fin(true));
    s.once('timeout', () => fin(false));
    s.once('error', () => fin(false));
    s.connect(port, ip);
  });
}

// Lance des tâches avec au plus `n` en vol.
export async function parLots(taches, n = 48) {
  const resultats = new Array(taches.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, taches.length) }, async () => {
      while (i < taches.length) {
        const k = i++;
        resultats[k] = await taches[k]();
      }
    }),
  );
  return resultats;
}

export function extraireTitre(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!m) return null;
  const t = m[1]
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return t || null;
}

// GET d'une page, en HTTP ou HTTPS (certificat non vérifié : on reconnaît, on ne fait pas confiance).
// Suit jusqu'à trois redirections sur la même machine.
export function lireHttp(url, { delai = 2500, redirections = 3, max = 96 * 1024 } = {}) {
  return new Promise((resoudre) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resoudre(null);
    }
    const requete = u.protocol === 'https:' ? requeteHttps : requeteHttp;
    const req = requete(
      u,
      { method: 'GET', timeout: delai, rejectUnauthorized: false, headers: { 'User-Agent': 'Cadastre', Accept: 'text/html,application/json' } },
      (res) => {
        const loc = res.headers.location;
        if (res.statusCode >= 300 && res.statusCode < 400 && loc && redirections > 0) {
          res.resume();
          const suivante = new URL(loc, u);
          if (suivante.hostname !== u.hostname) return resoudre({ statut: res.statusCode, serveur: res.headers.server ?? null, titre: null, corps: '', url: u.href });
          return lireHttp(suivante.href, { delai, redirections: redirections - 1, max }).then(resoudre);
        }
        let corps = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          corps += c;
          if (corps.length > max) res.destroy();
        });
        const fin = () => resoudre({ statut: res.statusCode, serveur: res.headers.server ?? null, titre: extraireTitre(corps), corps: corps.slice(0, 4096), url: u.href });
        res.on('end', fin);
        res.on('close', fin);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resoudre(null));
    req.end();
  });
}

// Une page en HTTP, sinon en HTTPS.
export async function identifierHttp(ip, port) {
  const premier = port === 443 || port === 8443 || port === 9443 || port === 8006 || port === 8007 ? 'https' : 'http';
  const second = premier === 'http' ? 'https' : 'http';
  return (await lireHttp(`${premier}://${ip}:${port}/`)) ?? (await lireHttp(`${second}://${ip}:${port}/`));
}

// Une API Traefik répond à /api/version par { Version, Codename }.
export async function estTraefik(ip, port) {
  const r = await lireHttp(`http://${ip}:${port}/api/version`, { redirections: 0 });
  if (!r || r.statut !== 200) return null;
  try {
    const j = JSON.parse(r.corps);
    return j.Version ? { version: j.Version, api: `http://${ip}:${port}` } : null;
  } catch {
    return null;
  }
}

// ── Minecraft : Server List Ping (protocole 1.7+) ───────────────────
function varint(n) {
  const octets = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    octets.push(b);
  } while (n);
  return Buffer.from(octets);
}
function lireVarint(buf, pos) {
  let n = 0;
  let decalage = 0;
  for (;;) {
    if (pos >= buf.length) return null;
    const b = buf[pos++];
    n |= (b & 0x7f) << decalage;
    if (!(b & 0x80)) return [n, pos];
    decalage += 7;
    if (decalage > 35) return null;
  }
}
const paquet = (...parties) => {
  const corps = Buffer.concat(parties);
  return Buffer.concat([varint(corps.length), corps]);
};

export function pingMinecraft(ip, port, delai = 3000) {
  return new Promise((resoudre) => {
    const s = new Socket();
    let tampon = Buffer.alloc(0);
    const fin = (r) => {
      s.destroy();
      resoudre(r);
    };
    s.setTimeout(delai);
    s.once('timeout', () => fin(null));
    s.once('error', () => fin(null));
    s.connect(port, ip, () => {
      const hote = Buffer.from(ip, 'utf8');
      const port16 = Buffer.alloc(2);
      port16.writeUInt16BE(port);
      s.write(paquet(varint(0), varint(767), varint(hote.length), hote, port16, varint(1)));
      s.write(paquet(varint(0)));
    });
    s.on('data', (d) => {
      tampon = Buffer.concat([tampon, d]);
      const longueur = lireVarint(tampon, 0);
      if (!longueur || tampon.length < longueur[1] + longueur[0]) return;
      const id = lireVarint(tampon, longueur[1]);
      const taille = id && lireVarint(tampon, id[1]);
      if (!taille) return fin(null);
      try {
        const j = JSON.parse(tampon.subarray(taille[1], taille[1] + taille[0]).toString('utf8'));
        const motd = typeof j.description === 'string' ? j.description : (j.description?.text ?? '') + (j.description?.extra ?? []).map((e) => e.text ?? '').join('');
        fin({
          version: j.version?.name ?? null,
          joueurs: j.players?.online ?? null,
          max: j.players?.max ?? null,
          motd: motd.replace(/§./g, '').trim() || null,
          mods: j.forgeData?.mods?.length ?? j.modinfo?.modList?.length ?? null,
        });
      } catch {
        fin(null);
      }
    });
  });
}
