// Les textes de la page, en français et en anglais.
// La langue vient du choix enregistré, sinon de celle du navigateur (français ou, à défaut, anglais).

const TEXTES = {
  fr: {
    titreCarte: 'Carte des services',
    typeHote: 'hôte',
    typeRoute: 'route',
    recherche: 'Chercher un service, une IP, un domaine…  /',
    quartiers: 'Quartiers',
    liens: 'Liens',
    reorganiser: 'Réorganiser',
    reorganiserAide: 'Range de nouveau chaque service dans sa parcelle',
    toutVoir: 'Tout voir',
    toutVoirAide: 'Cadre toute la carte',
    relancer: 'Relancer la découverte',
    relancerAide: 'Relance tout de suite le balayage des machines (sinon toutes les 10 min)',
    decouverteEnCours: 'Découverte en cours…',
    anomalies: 'Anomalies',
    toutVaBien: 'tout va bien',
    fermerFiche: 'Fermer la fiche',
    langue: 'English',
    langueAide: 'Switch to English',
    // Bandeau
    invitesAllumes: (p) => `${p.allumes}/${p.total} invités allumés`,
    proxmoxIndisponible: 'Proxmox : état indisponible',
    serveurInjoignable: 'serveur injoignable',
    maj: (p) => `maj ${p.quand}`,
    majDetail: (p) => `Cadastre ${p.version} · Proxmox lu ${p.pve} · découverte ${p.decouverte}${p.proxy ? ` · proxy ${p.proxy}` : ''}`,
    enCours: 'en cours',
    // Durées
    jamais: 'jamais',
    ilYaS: (p) => `il y a ${p.n} s`,
    ilYaMin: (p) => `il y a ${p.n} min`,
    dureeJ: (p) => `${p.j} j ${p.h} h`,
    dureeH: (p) => `${p.h} h ${p.m} min`,
    dureeM: (p) => `${p.m} min`,
    go: 'Go',
    // Fiche
    horsProxmox: 'hors Proxmox',
    decouvert: 'découvert',
    decouvertAide: 'Trouvé par la découverte, pas encore décrit au catalogue',
    allume: 'allumé',
    aRegarder: 'À regarder',
    notesProxmox: 'Notes du Proxmox',
    enDirect: 'En direct',
    cpu: 'CPU',
    memoire: 'Mémoire',
    disque: 'Disque',
    coeurs: (p) => `${p.n} c.`,
    alloues: (p) => `${p.n} Go alloués`,
    allumeDepuis: (p) => `allumé depuis ${p.duree}`,
    charge: (p) => `charge ${p.charge}`,
    adresses: 'Adresses',
    public: 'Public',
    portsSondes: 'Ports sondés',
    ferme: 'fermé',
    enAttente: 'en attente',
    routesServies: (p) => `Routes servies (${p.n})`,
    routesVersIci: 'Routes Traefik vers ici',
    inconnu: 'inconnu',
    ouvrir: 'Ouvrir',
    depot: (p) => `Dépôt ${p.nom}`,
    relations: 'Relations',
    yEntrer: 'Y entrer',
    depuisHote: ' (depuis l’hôte)',
    decouvertIlYa: (p) => `Découvert ${p.quand}`,
    joueurs: (p) => `${p.n}/${p.max} joueurs`,
    mods: (p) => `${p.n} mods`,
    decrire: 'Décrire dans le catalogue',
    decrireAide: (p) => `À ajouter sous <code>noeuds:</code> dans ${p.chemin}, puis à compléter.`,
    leCatalogue: 'le catalogue',
    aDecrire: 'À décrire',
    aQuoiSert: 'À quoi sert cette machine ?',
    notes: 'Notes',
    copier: 'copier',
    copie: 'copié',
    impossible: 'impossible',
  },
  en: {
    titreCarte: 'Service map',
    typeHote: 'host',
    typeRoute: 'route',
    recherche: 'Search a service, an IP, a domain…  /',
    quartiers: 'Districts',
    liens: 'Links',
    reorganiser: 'Rearrange',
    reorganiserAide: 'Put every service back into its district',
    toutVoir: 'Fit all',
    toutVoirAide: 'Fit the whole map',
    relancer: 'Run discovery now',
    relancerAide: 'Scan the machines right away (otherwise every 10 min)',
    decouverteEnCours: 'Discovery running…',
    anomalies: 'Anomalies',
    toutVaBien: 'all good',
    fermerFiche: 'Close the card',
    langue: 'Français',
    langueAide: 'Passer en français',
    invitesAllumes: (p) => `${p.allumes}/${p.total} guests running`,
    proxmoxIndisponible: 'Proxmox: state unavailable',
    serveurInjoignable: 'server unreachable',
    maj: (p) => `updated ${p.quand}`,
    majDetail: (p) => `Cadastre ${p.version} · Proxmox read ${p.pve} · discovery ${p.decouverte}${p.proxy ? ` · proxy ${p.proxy}` : ''}`,
    enCours: 'running',
    jamais: 'never',
    ilYaS: (p) => `${p.n} s ago`,
    ilYaMin: (p) => `${p.n} min ago`,
    dureeJ: (p) => `${p.j} d ${p.h} h`,
    dureeH: (p) => `${p.h} h ${p.m} min`,
    dureeM: (p) => `${p.m} min`,
    go: 'GB',
    horsProxmox: 'outside Proxmox',
    decouvert: 'discovered',
    decouvertAide: 'Found by discovery, not described in the catalogue yet',
    allume: 'running',
    aRegarder: 'Needs a look',
    notesProxmox: 'Proxmox notes',
    enDirect: 'Live',
    cpu: 'CPU',
    memoire: 'Memory',
    disque: 'Disk',
    coeurs: (p) => `${p.n} cores`,
    alloues: (p) => `${p.n} GB allocated`,
    allumeDepuis: (p) => `up for ${p.duree}`,
    charge: (p) => `load ${p.charge}`,
    adresses: 'Addresses',
    public: 'Public',
    portsSondes: 'Probed ports',
    ferme: 'closed',
    enAttente: 'pending',
    routesServies: (p) => `Routes served (${p.n})`,
    routesVersIci: 'Traefik routes to here',
    inconnu: 'unknown',
    ouvrir: 'Open',
    depot: (p) => `Repository ${p.nom}`,
    relations: 'Relations',
    yEntrer: 'Get a shell',
    depuisHote: ' (from the host)',
    decouvertIlYa: (p) => `Discovered ${p.quand}`,
    joueurs: (p) => `${p.n}/${p.max} players`,
    mods: (p) => `${p.n} mods`,
    decrire: 'Describe in the catalogue',
    decrireAide: (p) => `Add under <code>noeuds:</code> in ${p.chemin}, then fill in.`,
    leCatalogue: 'the catalogue',
    aDecrire: 'To describe',
    aQuoiSert: 'What is this machine for?',
    notes: 'Notes',
    copier: 'copy',
    copie: 'copied',
    impossible: 'failed',
  },
};

function lireChoix() {
  try {
    return localStorage.getItem('cadastre.langue');
  } catch {
    return null;
  }
}

function langueNavigateur() {
  for (const l of navigator.languages ?? [navigator.language]) {
    const c = String(l).slice(0, 2).toLowerCase();
    if (c in TEXTES) return c;
  }
  return 'en';
}

export const langue = TEXTES[lireChoix()] ? lireChoix() : langueNavigateur();

export function t(cle, params = {}) {
  const v = TEXTES[langue][cle] ?? TEXTES.fr[cle] ?? cle;
  return typeof v === 'function' ? v(params) : v;
}

// Bascule et recharge : tout se redessine dans l'autre langue.
export function basculerLangue() {
  try {
    localStorage.setItem('cadastre.langue', langue === 'fr' ? 'en' : 'fr');
  } catch {
    // Stockage indisponible : la langue suit le navigateur.
  }
  location.reload();
}

// Les textes fixes de la page : data-i18n (texte), data-i18n-placeholder, -title, -aria.
export function traduirePage() {
  document.documentElement.lang = langue;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
