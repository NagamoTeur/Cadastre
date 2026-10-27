// Les routes réellement servies par Traefik, lues sur son API (lecture seule).

async function lire(base, chemin) {
  const r = await fetch(`${base}${chemin}`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Traefik ${chemin} : HTTP ${r.status}`);
  return r.json();
}

// Host(`a`) || Host(`b`) → ['a', 'b'] ; HostSNI(`*`) → [].
export function domainesDe(regle = '') {
  return [...regle.matchAll(/Host\(`([^`]+)`\)/g)].map((m) => m[1]);
}

// "http://192.168.1.20:3001/" → { ip, port }
export function cibleDe(serveur) {
  const brut = serveur.url ?? `tcp://${serveur.address}`;
  try {
    const u = new URL(brut);
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    return { ip: u.hostname, port, texte: `${u.hostname}:${port}` };
  } catch {
    return null;
  }
}

export async function routesTraefik(base) {
  const [routeurs, services, routeursTcp, servicesTcp] = await Promise.all([
    lire(base, '/api/http/routers'),
    lire(base, '/api/http/services'),
    lire(base, '/api/tcp/routers'),
    lire(base, '/api/tcp/services'),
  ]);

  const routes = [];
  const ajouter = (routeur, servicesListe, protocole) => {
    if (routeur.provider === 'internal') return;
    const nomService = routeur.service.includes('@') ? routeur.service : `${routeur.service}@${routeur.provider}`;
    const service = servicesListe.find((s) => s.name === nomService);
    const serveurs = service?.loadBalancer?.servers ?? [];
    const domaines = domainesDe(routeur.rule);
    routes.push({
      nom: routeur.name.replace(/@.*/, ''),
      protocole,
      regle: routeur.rule,
      domaines: domaines.length ? domaines : (routeur.entryPoints ?? []).map((e) => `entrée ${e}`),
      entrees: routeur.entryPoints ?? [],
      cibles: serveurs.map(cibleDe).filter(Boolean),
      serviceManquant: !service,
    });
  };
  for (const r of routeurs) ajouter(r, services, 'http');
  for (const r of routeursTcp) ajouter(r, servicesTcp, 'tcp');
  return routes;
}
