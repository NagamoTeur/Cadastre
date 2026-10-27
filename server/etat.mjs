// Assemble la carte. La découverte trouve seule les machines, ce qu'elles écoutent
// et les routes du proxy ; le catalogue (facultatif) corrige et complète : rôles,
// descriptions, liens que rien ne révèle. Puis on en tire les anomalies.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { clientPve } from './pve.mjs';
import { routesTraefik } from './traefik.mjs';
import { sonderTcp, parLots } from './sonde.mjs';
import { analyserIp, resumer, premiereLigne, GROUPES_DEFAUT, TYPES_LIENS_DEFAUT } from './decouverte.mjs';
import { anomalie, texte, traduireCarte } from './i18n.mjs';

const GROUPES_AJOUTES = [
  { id: 'hote', nom: 'Hôte Proxmox', couleur: '#cfd8e3' },
  { id: 'orphelin', nom: 'Routes orphelines', couleur: '#e05a5a' },
];
// Un port disparu reste affiché (fermé) une journée avant d'être oublié.
const MEMOIRE_PORT_MS = 24 * 3600 * 1000;

// Les groupes du catalogue remplacent ceux par défaut de même id et s'ajoutent aux autres.
export function fusionnerGroupes(defaut, catalogue = []) {
  const parId = new Map(defaut.map((g) => [g.id, g]));
  for (const g of catalogue) parId.set(g.id, { ...parId.get(g.id), ...g });
  return [...parId.values()];
}

// Ports : ceux du catalogue d'abord (leurs noms font foi), puis ceux découverts.
export function fusionnerPorts(catalogue = [], decouverts = []) {
  const vus = new Set(catalogue.map((p) => p.port));
  return [...catalogue, ...decouverts.filter((p) => !vus.has(p.port))];
}

export function creerEtat(config, journal = console) {
  const pve = config.pve.jeton ? clientPve(config.pve) : null;
  const etat = {
    catalogue: null,
    catalogueMtime: 0,
    catalogueErreur: null,
    invites: [],
    hotes: [],
    ips: new Map(), // vmid → ip
    configs: new Map(), // vmid → { notes, onboot }
    analyses: new Map(), // ip → analyse de la découverte
    routes: [],
    traefikApi: config.traefik || null,
    sondes: new Map(), // "ip:port" → { ouvert, ms, depuis }
    erreurs: { pve: pve ? null : 'PVE_TOKEN absent', traefik: null },
    majPve: 0,
    majTraefik: 0,
    majDecouverte: 0,
    decouverteEnCours: false,
  };

  function lireCatalogue() {
    if (!config.catalogue || !existsSync(config.catalogue)) {
      etat.catalogue = null;
      etat.catalogueMtime = 0;
      return;
    }
    try {
      const mtime = statSync(config.catalogue).mtimeMs;
      if (mtime === etat.catalogueMtime) return;
      etat.catalogue = parse(readFileSync(config.catalogue, 'utf8')) ?? {};
      etat.catalogueMtime = mtime;
      etat.catalogueErreur = null;
      journal.log(`catalogue relu (${etat.catalogue.noeuds?.length ?? 0} nœuds)`);
    } catch (e) {
      // On garde le dernier catalogue valide et on signale l'erreur.
      etat.catalogueErreur = e.message;
    }
  }

  async function majPve() {
    if (!pve) return;
    try {
      const [invites, hotes] = await Promise.all([pve.invites(), pve.noeuds()]);
      etat.invites = invites.filter((i) => !i.modele);
      etat.hotes = hotes;
      etat.erreurs.pve = null;
      etat.majPve = Date.now();
    } catch (e) {
      etat.erreurs.pve = e.message;
    }
  }

  async function majIps() {
    if (!pve) return;
    await parLots(
      etat.invites.map((i) => async () => {
        const conf = await pve.configuration(i);
        if (conf) etat.configs.set(i.vmid, conf);
        if (i.statut !== 'running') return;
        const ip = await pve.ip(i);
        if (ip) etat.ips.set(i.vmid, ip);
      }),
      8,
    );
  }

  async function majDecouverte() {
    if (etat.decouverteEnCours) return;
    etat.decouverteEnCours = true;
    try {
      const ips = new Set([...etat.hotes.map((h) => h.ip), ...etat.invites.filter((i) => i.statut === 'running').map((i) => etat.ips.get(i.vmid))].filter(Boolean));
      const maintenant = Date.now();
      await parLots(
        [...ips].map((ip) => async () => {
          const nouvelle = await analyserIp(ip);
          for (const s of nouvelle.services) s.vu = maintenant;
          // Les ports qui viennent de se fermer restent connus un moment : leur fermeture est une anomalie.
          const avant = etat.analyses.get(ip);
          for (const s of avant?.services ?? [])
            if (!nouvelle.services.some((n) => n.port === s.port) && maintenant - s.vu < MEMOIRE_PORT_MS) nouvelle.services.push(s);
          nouvelle.services.sort((a, b) => a.port - b.port);
          etat.analyses.set(ip, nouvelle);
        }),
        4,
      );
      for (const ip of etat.analyses.keys()) if (!ips.has(ip)) etat.analyses.delete(ip);
      if (!config.traefik) etat.traefikApi = [...etat.analyses.values()].find((a) => a.traefik)?.traefik.api ?? null;
      etat.majDecouverte = Date.now();
      journal.log(`découverte : ${ips.size} machines, ${[...etat.analyses.values()].reduce((t, a) => t + a.services.length, 0)} ports${etat.traefikApi ? `, Traefik sur ${etat.traefikApi}` : ''}`);
    } finally {
      etat.decouverteEnCours = false;
    }
  }

  async function majTraefik() {
    if (!etat.traefikApi) {
      etat.routes = [];
      return;
    }
    try {
      etat.routes = await routesTraefik(etat.traefikApi);
      etat.erreurs.traefik = null;
      etat.majTraefik = Date.now();
    } catch (e) {
      etat.erreurs.traefik = e.message;
    }
  }

  async function majSondes() {
    const cibles = new Set();
    for (const n of construire().noeuds) if (n.ip) for (const p of n.ports ?? []) cibles.add(`${n.ip}:${p.port}`);
    for (const r of etat.routes) for (const c of r.cibles) cibles.add(c.texte);
    await parLots(
      [...cibles].map((c) => async () => {
        const [ip, port] = c.split(':');
        const res = await sonderTcp(ip, Number(port));
        const avant = etat.sondes.get(c);
        etat.sondes.set(c, { ...res, depuis: avant && avant.ouvert === res.ouvert ? avant.depuis : Date.now() });
      }),
      48,
    );
    for (const c of etat.sondes.keys()) if (!cibles.has(c)) etat.sondes.delete(c);
  }

  function resumeDe(ip) {
    const a = ip ? etat.analyses.get(ip) : null;
    return a ? { ...resumer(a), quand: a.quand } : null;
  }

  // ── Les nœuds et les liens, sans les anomalies ───────────────────
  function construire() {
    lireCatalogue();
    const cat = etat.catalogue ?? {};
    const groupes = [...fusionnerGroupes(GROUPES_DEFAUT, cat.groupes), ...GROUPES_AJOUTES];
    const idsGroupes = new Set(groupes.map((g) => g.id));
    const parNomGroupe = new Map(groupes.map((g) => [g.nom.toLowerCase(), g.id]));
    const noeuds = [];

    // Les hôtes. Le premier reçoit la description `hote` du catalogue.
    const hotes = etat.hotes.length ? etat.hotes : cat.hote ? [{ nom: cat.hote.nom ?? 'Proxmox', ip: cat.hote.ip, statut: null }] : [];
    hotes.forEach((h, i) => {
      const c = i === 0 ? (cat.hote ?? {}) : {};
      const ip = c.ip ?? h.ip;
      const auto = resumeDe(ip);
      noeuds.push({
        id: hotes.length === 1 || i === 0 ? 'proxmox' : `noeud-${h.nom}`,
        nom: c.nom ?? h.nom,
        groupe: 'hote',
        role: c.role ?? 'Hyperviseur Proxmox',
        description: c.description ?? null,
        liens: c.liens ?? (ip ? [{ titre: 'Interface Proxmox', url: `https://${ip}:8006` }] : []),
        depot: c.depot,
        ip,
        type: 'hôte',
        ports: fusionnerPorts(c.ports, auto?.ports),
        decouvert: auto,
        direct: h.statut ? h : null,
      });
    });

    // Les invités du Proxmox, complétés par le catalogue.
    const catParVmid = new Map((cat.noeuds ?? []).filter((n) => n.vmid).map((n) => [n.vmid, n]));
    for (const inv of etat.invites) {
      const c = catParVmid.get(inv.vmid);
      const conf = etat.configs.get(inv.vmid);
      const ip = c?.ip ?? etat.ips.get(inv.vmid) ?? null;
      const auto = inv.statut === 'running' ? resumeDe(ip) : null;
      const groupeTag = inv.tags.map((t) => (idsGroupes.has(t) ? t : parNomGroupe.get(t.toLowerCase()))).find(Boolean);
      const liensAuto = (auto?.liens ?? []).filter((l) => !(c?.liens ?? []).some((x) => new URL(x.url, 'http://x').port === new URL(l.url).port));
      noeuds.push({
        ...c,
        id: c?.id ?? `pve-${inv.vmid}`,
        vmid: inv.vmid,
        nom: c?.nom ?? inv.nom,
        groupe: c?.groupe ?? groupeTag ?? auto?.groupe ?? 'autres',
        // Rôle : le catalogue, sinon un service reconnu, sinon les notes du Proxmox, sinon le titre d'une page.
        role: c?.role ?? auto?.role ?? premiereLigne(conf?.notes) ?? auto?.titre ?? (inv.statut === 'running' ? 'Rôle inconnu' : 'Éteint'),
        description: c?.description ?? null,
        notesPve: conf?.notes ?? null,
        onboot: conf?.onboot ?? null,
        ip,
        type: inv.type,
        ports: fusionnerPorts(c?.ports, auto?.ports),
        liens: [...(c?.liens ?? []), ...liensAuto],
        decouvert: auto,
        auto: !c,
        direct: inv,
      });
    }

    // Ce que le catalogue décrit hors du Proxmox (ou qui a disparu du Proxmox).
    const vmidsPve = new Set(etat.invites.map((i) => i.vmid));
    for (const c of cat.noeuds ?? []) {
      if (c.vmid && vmidsPve.has(c.vmid)) continue;
      noeuds.push({ ...c, type: c.vmid ? '?' : 'externe', direct: null, disparu: !!c.vmid });
    }

    const liens = (cat.liens ?? []).map((l, i) => ({ id: `l${i}`, ...l }));
    return { cat, groupes, noeuds, liens };
  }

  // ── La carte telle que le navigateur la reçoit ────────────────────
  function carte(langue = 'fr') {
    const { cat, groupes, noeuds, liens } = construire();
    const anomalies = [];
    const signaler = (niveau, cle, params, noeud) => anomalies.push({ niveau, ...anomalie(langue, cle, params), noeud });

    // Les sondes, posées sur les ports.
    for (const n of noeuds) {
      n.sondes = (n.ports ?? []).map((p) => {
        const s = n.ip ? etat.sondes.get(`${n.ip}:${p.port}`) : null;
        return { ...p, ouvert: s?.ouvert ?? null, ms: s?.ms ?? null, depuis: s?.depuis ?? null };
      });
    }
    const proprietaireIp = new Map();
    for (const n of noeuds) if (n.ip && !proprietaireIp.has(n.ip)) proprietaireIp.set(n.ip, n.id);

    for (const n of noeuds) {
      const inv = n.direct;
      if (n.disparu && pve && !etat.erreurs.pve && etat.majPve)
        signaler('attention', 'disparu', { nom: n.nom, vmid: n.vmid }, n.id);
      // Un invité éteint n'est une anomalie que s'il doit tourner : décrit au catalogue ou en démarrage auto.
      if (n.vmid && inv && inv.statut !== 'running' && (!n.auto || n.onboot))
        signaler('alerte', 'arrete', { nom: n.nom, type: inv.type, vmid: inv.vmid, statut: inv.statut, onboot: n.onboot }, n.id);
      if (!inv || inv.statut === 'running')
        for (const s of n.sondes)
          if (s.ouvert === false) signaler('alerte', 'portFerme', { nom: n.nom, port: s.port, service: s.nom ?? '', ip: n.ip }, n.id);
      if (inv?.disqueMax && (inv.type === 'CT' || n.type === 'hôte') && inv.disque) {
        const r = inv.disque / inv.disqueMax;
        if (r >= 0.9) signaler('alerte', 'disquePlein', { nom: n.nom, pc: Math.round(r * 100) }, n.id);
        else if (r >= 0.75) signaler('attention', 'disque', { nom: n.nom, pc: Math.round(r * 100) }, n.id);
      }
      if (inv?.type === 'CT' && inv.statut === 'running' && inv.memoireMax && inv.memoire / inv.memoireMax >= 0.9)
        signaler('attention', 'memoire', { nom: n.nom, pc: Math.round((inv.memoire / inv.memoireMax) * 100) }, n.id);
    }

    // Les routes du proxy : un lien vers la machine qui porte la cible, sinon une route orpheline.
    const ipProxy = etat.traefikApi ? new URL(etat.traefikApi).hostname : null;
    const proxyId = (ipProxy && proprietaireIp.get(ipProxy)) ?? noeuds.find((n) => n.vmid && /traefik/i.test(n.nom))?.id ?? null;
    const routes = etat.routes.map((r) => ({
      ...r,
      cibles: r.cibles.map((c) => {
        const s = etat.sondes.get(c.texte);
        return { ...c, noeud: proprietaireIp.get(c.ip) ?? null, ouvert: s?.ouvert ?? null, ms: s?.ms ?? null };
      }),
    }));
    const existe = (de, vers, types) => liens.some((l) => l.de === de && l.vers === vers && types.includes(l.type));
    if (proxyId) {
      const parCible = new Map();
      for (const r of routes)
        for (const c of r.cibles) if (c.noeud && c.noeud !== proxyId) parCible.set(c.noeud, [...(parCible.get(c.noeud) ?? []), ...r.domaines]);
      for (const [cible, domaines] of parCible)
        if (!existe(proxyId, cible, ['route']))
          liens.push({ id: `auto-${proxyId}-${cible}`, de: proxyId, vers: cible, type: 'route', label: [...new Set(domaines)].join(', '), auto: true });
      // Un proxy qui sert des domaines est une porte vers Internet.
      if (routes.some((r) => r.protocole === 'http' && r.domaines.some((d) => d.includes('.'))) && !liens.some((l) => l.vers === proxyId && l.type === 'public')) {
        if (!noeuds.some((n) => n.id === 'internet'))
          noeuds.push({ id: 'internet', nom: 'Internet', groupe: 'dehors', role: 'Les visiteurs du dehors', type: 'externe', direct: null, sondes: [], auto: true });
        liens.push({ id: `auto-internet-${proxyId}`, de: 'internet', vers: proxyId, type: 'public', label: 'domaines publics', auto: true });
      }
    }
    for (const r of routes) {
      if (!r.cibles.length) {
        signaler('attention', 'routeSansCible', { route: r.nom, domaines: r.domaines.join(', '), manquant: r.serviceManquant }, proxyId);
        continue;
      }
      for (const c of r.cibles) {
        if (c.noeud) continue;
        const id = `orphelin-${c.texte}`;
        if (!noeuds.some((n) => n.id === id)) {
          noeuds.push({
            id,
            nom: r.domaines[0] ?? r.nom,
            groupe: 'orphelin',
            role: texte(langue, 'orphelinRole'),
            description: texte(langue, 'orphelinDescription', { domaines: r.domaines.join(', '), cible: c.texte, muette: c.ouvert === false }),
            ip: c.ip,
            type: 'route',
            direct: null,
            sondes: [{ port: c.port, nom: r.nom, ouvert: c.ouvert, ms: c.ms }],
            notes: [texte(langue, 'orphelinNote', { route: r.nom, regle: r.regle })],
          });
          if (proxyId) liens.push({ id: `r-${id}`, de: proxyId, vers: id, type: 'route', label: r.domaines.join(', '), orphelin: true });
        }
        signaler(c.ouvert === false ? 'alerte' : 'attention', 'routeOrpheline', { domaines: r.domaines.join(', '), cible: c.texte, muette: c.ouvert === false }, id);
      }
    }

    if (etat.erreurs.pve) signaler('alerte', 'pveInjoignable', { erreur: etat.erreurs.pve });
    if (etat.erreurs.traefik) signaler('attention', 'traefikInjoignable', { erreur: etat.erreurs.traefik });
    if (etat.catalogueErreur) signaler('alerte', 'catalogueIllisible', { erreur: etat.catalogueErreur });

    const ordre = { alerte: 0, attention: 1, info: 2 };
    anomalies.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);

    return traduireCarte(langue, {
      genere: Date.now(),
      langue,
      majPve: etat.majPve,
      majTraefik: etat.majTraefik,
      majDecouverte: etat.majDecouverte,
      decouverteEnCours: etat.decouverteEnCours,
      reglages: { version: config.version, depotBase: config.depotBase, catalogue: config.catalogue, catalogueExiste: !!etat.catalogue, proxy: etat.traefikApi },
      groupes,
      typesLiens: { ...TYPES_LIENS_DEFAUT, ...(cat.types_liens ?? {}) },
      noeuds,
      liens: liens.filter((l) => noeuds.some((n) => n.id === l.de) && noeuds.some((n) => n.id === l.vers)),
      routes,
      anomalies,
    });
  }

  function demarrer() {
    lireCatalogue();
    const boucle = (fn, s) => {
      const tour = () => fn().catch((e) => journal.error(e)).finally(() => setTimeout(tour, s * 1000).unref());
      return tour;
    };
    const plusTard = (fn, s) => setTimeout(boucle(fn, s), s * 1000).unref();
    // Premier tour dans l'ordre (la découverte a besoin des IP, les routes du proxy trouvé),
    // puis chacun à son rythme.
    (async () => {
      await majPve();
      await majIps();
      await majDecouverte().catch((e) => journal.error(e));
      await majTraefik();
      await majSondes();
      plusTard(majPve, config.rythme.pve);
      plusTard(majIps, config.rythme.ip);
      plusTard(majDecouverte, config.rythme.decouverte);
      plusTard(majTraefik, config.rythme.traefik);
      plusTard(majSondes, config.rythme.sondes);
    })();
  }

  return { carte, demarrer, etat, relancerDecouverte: () => majDecouverte().then(majTraefik).then(majSondes) };
}
