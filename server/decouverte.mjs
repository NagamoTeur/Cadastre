// L'auto-découverte : ce que chaque machine écoute et ce que c'est.
//
// Pour chaque IP connue (invités allumés, hôtes Proxmox) : balayage des ports
// courants, page d'accueil des ports web, ping des serveurs Minecraft, recherche
// d'une API Traefik. Rien n'est écrit sur les machines : tout est en lecture.
import { PORTS_COURANTS, PORTS_NON_HTTP, PORTS_MINECRAFT, reconnaitre } from './signatures.mjs';
import { sonderTcp, identifierHttp, estTraefik, pingMinecraft, parLots } from './sonde.mjs';

// Les quartiers proposés d'office ; le catalogue peut les renommer ou en ajouter.
export const GROUPES_DEFAUT = [
  { id: 'reseau', nom: 'Réseau et accès', couleur: '#5fb3d9' },
  { id: 'dev', nom: 'Code et construction', couleur: '#e0a050' },
  { id: 'veille', nom: 'Surveillance', couleur: '#9d8ae6' },
  { id: 'stockage', nom: 'Stockage et documents', couleur: '#4fb3a6' },
  { id: 'donnees', nom: 'Bases de données', couleur: '#7f9cc9' },
  { id: 'medias', nom: 'Médias', couleur: '#d9824f' },
  { id: 'domotique', nom: 'Domotique', couleur: '#8fc95f' },
  { id: 'jeux', nom: 'Jeux', couleur: '#6cc583' },
  { id: 'apps', nom: 'Applis', couleur: '#e87fa8' },
  { id: 'ia', nom: 'IA', couleur: '#d6c35a' },
  { id: 'autres', nom: 'Autres', couleur: '#a3adb8' },
  { id: 'dehors', nom: 'Hors du Proxmox', couleur: '#8a97a8' },
];

export const TYPES_LIENS_DEFAUT = {
  public: { nom: 'Accès public', couleur: '#5fb3d9' },
  route: { nom: 'Route du proxy', couleur: '#5fb3d9' },
  deploie: { nom: 'Déploie', couleur: '#e0a050' },
  ci: { nom: 'Intégration continue', couleur: '#e0a050' },
  surveille: { nom: 'Surveille', couleur: '#9d8ae6' },
  notifie: { nom: 'Notifie', couleur: '#c9a0ff' },
  utilise: { nom: 'Utilise', couleur: '#a6b3c4' },
  pilote: { nom: 'Pilote', couleur: '#e87fa8' },
  dns: { nom: 'DNS', couleur: '#7fd4c1' },
  distant: { nom: 'Accès distant', couleur: '#6aa8ff' },
};

// Analyse une IP : ports ouverts, services reconnus, API Traefik éventuelle.
export async function analyserIp(ip, { ports = PORTS_COURANTS } = {}) {
  const ouverts = (await parLots(ports.map((p) => () => sonderTcp(ip, p, 900).then((r) => (r.ouvert ? p : null))), 32)).filter(Boolean);
  const services = [];
  let traefik = null;
  for (const port of ouverts) {
    let http = null;
    let minecraft = null;
    if (PORTS_MINECRAFT.has(port)) minecraft = await pingMinecraft(ip, port);
    else if (!PORTS_NON_HTTP.has(port)) http = await identifierHttp(ip, port);
    if (http && !traefik && [8080, 8081, 8082, 9000, 80].includes(port)) traefik = await estTraefik(ip, port);

    let s;
    if (minecraft)
      s = {
        nom: 'Minecraft',
        groupe: 'jeux',
        role: `Serveur Minecraft${minecraft.version ? ` ${minecraft.version}` : ''}`,
        par: 'ping',
        minecraft,
      };
    else if (traefik && traefik.api.endsWith(`:${port}`)) s = { nom: 'Traefik', groupe: 'reseau', role: 'Reverse proxy', par: 'api', prioritaire: true };
    else s = reconnaitre(port, http) ?? { nom: `Port ${port}`, groupe: null, role: null, par: 'port', faible: true };

    services.push({
      port,
      nom: s.nom,
      groupe: s.groupe ?? null,
      role: s.role ?? null,
      par: s.par,
      faible: !!s.faible,
      prioritaire: !!s.prioritaire,
      titre: http?.titre ?? null,
      serveur: http?.serveur ?? null,
      url: http ? new URL(http.url).origin + '/' : null,
      minecraft: s.minecraft ?? null,
    });
  }
  return { ip, services, traefik, quand: Date.now() };
}

// Première phrase lisible des notes du Proxmox (souvent du Markdown, parfois du HTML).
export function premiereLigne(notes) {
  if (!notes) return null;
  for (const brute of notes.split(/\r?\n/)) {
    const ligne = brute
      .replace(/<[^>]*>/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^[#>*\-\s]+/, '')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (ligne.length >= 3) {
      const phrase = ligne.split(/(?<=[.!?])\s|\s:\s/)[0];
      return phrase.length > 44 ? `${phrase.slice(0, 42).trimEnd()}…` : phrase;
    }
  }
  return null;
}

// Ce que la découverte conclut d'une machine : son quartier, son rôle, ses liens.
export function resumer(analyse) {
  const forts = analyse.services.filter((s) => !s.faible);
  // Un service compte une fois, quel que soit le nombre de ses ports.
  const uniques = [...new Map(forts.map((s) => [s.nom, s])).values()];
  const prioritaire = uniques.find((s) => s.prioritaire);
  const groupes = new Map();
  for (const s of uniques) if (s.groupe) groupes.set(s.groupe, (groupes.get(s.groupe) ?? 0) + 1);
  const groupe = prioritaire?.groupe ?? [...groupes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const tete = prioritaire ?? uniques[0];
  const noms = [tete, ...uniques.filter((s) => s !== tete)].filter(Boolean).map((s) => s.nom);
  const titreFaible = analyse.services.find((s) => s.faible && s.titre)?.titre ?? null;
  const mc = analyse.services.find((s) => s.minecraft)?.minecraft;
  return {
    groupe,
    role: noms.length === 1 ? (tete.role ?? tete.nom) : noms.length ? noms.slice(0, 3).join(' · ') : null,
    titre: titreFaible,
    services: noms,
    ports: analyse.services.map((s) => ({ port: s.port, nom: s.minecraft ? `Minecraft${s.minecraft.version ? ` ${s.minecraft.version}` : ''}` : s.nom, auto: true })),
    liens: analyse.services.filter((s) => s.url && (!s.faible || s.titre)).map((s) => ({ titre: s.faible ? s.titre : s.nom, url: s.url, auto: true })),
    minecraft: mc ?? null,
  };
}
