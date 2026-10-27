// Les textes que le serveur fabrique, en français et en anglais.
//
// Le serveur pense en français : les anomalies passent par des modèles (ANOMALIES),
// les phrases fixes (quartiers, rôles des empreintes, types de liens) par une table
// (PHRASES_EN) appliquée à la sortie. Ce qu'écrit l'utilisateur au catalogue n'est
// traduit que s'il reprend mot pour mot une de ces phrases.

export const LANGUES = ['fr', 'en'];

export function langueDe(demande) {
  const l = String(demande ?? '').slice(0, 2).toLowerCase();
  return LANGUES.includes(l) ? l : 'fr';
}

const ANOMALIES = {
  disparu: {
    fr: (p) => [`${p.nom} n’existe plus`, `Le catalogue cite le ${p.vmid}, que le Proxmox ne connaît pas.`],
    en: (p) => [`${p.nom} no longer exists`, `The catalogue lists ${p.vmid}, which Proxmox does not know.`],
  },
  arrete: {
    fr: (p) => [`${p.nom} est arrêté`, `${p.type} ${p.vmid} : ${p.statut}${p.onboot ? ', alors qu’il démarre avec l’hôte' : ''}.`],
    en: (p) => [`${p.nom} is stopped`, `${p.type} ${p.vmid}: ${p.statut}${p.onboot ? ', although it starts on boot' : ''}.`],
  },
  portFerme: {
    fr: (p) => [`${p.nom} : port ${p.port} fermé`, `${p.service} sur ${p.ip}:${p.port} ne répond plus.`],
    en: (p) => [`${p.nom}: port ${p.port} closed`, `${p.service} on ${p.ip}:${p.port} stopped answering.`],
  },
  disquePlein: {
    fr: (p) => [`${p.nom} : disque plein à ${p.pc} %`, 'Moins de 10 % d’espace libre.'],
    en: (p) => [`${p.nom}: disk ${p.pc}% full`, 'Less than 10% free space.'],
  },
  disque: {
    fr: (p) => [`${p.nom} : disque à ${p.pc} %`, 'À surveiller.'],
    en: (p) => [`${p.nom}: disk at ${p.pc}%`, 'Worth watching.'],
  },
  memoire: {
    fr: (p) => [`${p.nom} : mémoire à ${p.pc} %`, 'Le conteneur est près de sa limite.'],
    en: (p) => [`${p.nom}: memory at ${p.pc}%`, 'The container is close to its limit.'],
  },
  routeSansCible: {
    fr: (p) => [`Route ${p.route} sans cible`, `${p.domaines} : le service ${p.manquant ? 'n’existe pas' : 'n’a aucun serveur'}.`],
    en: (p) => [`Route ${p.route} has no target`, `${p.domaines}: the service ${p.manquant ? 'does not exist' : 'has no server'}.`],
  },
  routeOrpheline: {
    fr: (p) => [`Route orpheline : ${p.domaines}`, `Vers ${p.cible}${p.muette ? ', qui ne répond pas' : ''}. À retirer du proxy ou à décrire au catalogue.`],
    en: (p) => [`Orphan route: ${p.domaines}`, `To ${p.cible}${p.muette ? ', which does not answer' : ''}. Remove it from the proxy or describe it in the catalogue.`],
  },
  pveInjoignable: { fr: (p) => ['Proxmox injoignable', p.erreur], en: (p) => ['Proxmox unreachable', p.erreur] },
  traefikInjoignable: { fr: (p) => ['API Traefik injoignable', p.erreur], en: (p) => ['Traefik API unreachable', p.erreur] },
  catalogueIllisible: { fr: (p) => ['Catalogue illisible', p.erreur], en: (p) => ['Unreadable catalogue', p.erreur] },
};

// Une anomalie dans la langue demandée : { titre, detail }.
export function anomalie(langue, cle, params) {
  const [titre, detail] = ANOMALIES[cle][langue === 'en' ? 'en' : 'fr'](params);
  return { titre, detail };
}

const TEXTES = {
  orphelinRole: { fr: 'Route vers une machine inconnue', en: 'Route to an unknown machine' },
  orphelinDescription: {
    fr: (p) => `Le proxy envoie ${p.domaines} vers ${p.cible}, une adresse qu’aucune machine connue n’occupe${p.muette ? ' et qui ne répond pas' : ''}.`,
    en: (p) => `The proxy sends ${p.domaines} to ${p.cible}, an address no known machine holds${p.muette ? ', and it does not answer' : ''}.`,
  },
  orphelinNote: { fr: (p) => `Route Traefik « ${p.route} » (règle ${p.regle}).`, en: (p) => `Traefik route “${p.route}” (rule ${p.regle}).` },
};

export function texte(langue, cle, params) {
  const v = TEXTES[cle][langue === 'en' ? 'en' : 'fr'];
  return typeof v === 'function' ? v(params) : v;
}

// Les phrases fixes du serveur, en anglais.
const PHRASES_EN = {
  // Quartiers
  'Réseau et accès': 'Network & access',
  'Code et construction': 'Code & builds',
  Surveillance: 'Monitoring',
  'Stockage et documents': 'Storage & documents',
  'Bases de données': 'Databases',
  Médias: 'Media',
  Domotique: 'Home automation',
  Jeux: 'Games',
  Applis: 'Apps',
  IA: 'AI',
  Autres: 'Other',
  'Hors du Proxmox': 'Outside Proxmox',
  'Hôte Proxmox': 'Proxmox host',
  'Routes orphelines': 'Orphan routes',
  // Types de liens
  'Accès public': 'Public access',
  'Route du proxy': 'Proxy route',
  Déploie: 'Deploys',
  'Intégration continue': 'Continuous integration',
  Surveille: 'Monitors',
  Notifie: 'Notifies',
  Utilise: 'Uses',
  Pilote: 'Controls',
  'Accès distant': 'Remote access',
  'domaines publics': 'public domains',
  // Nœuds fabriqués
  'Rôle inconnu': 'Unknown role',
  Éteint: 'Powered off',
  'Hyperviseur Proxmox': 'Proxmox hypervisor',
  'Interface Proxmox': 'Proxmox web UI',
  'Les visiteurs du dehors': 'Visitors from outside',
  // Noms de services génériques
  'Partage SMB': 'SMB share',
  'Partage NFS': 'NFS share',
  'Serveur de mail': 'Mail server',
  'Serveur Steam': 'Steam server',
  'Serveur web': 'Web server',
  'Broker MQTT': 'MQTT broker',
  // Rôles des empreintes
  Accès: 'Access',
  Administration: 'Administration',
  Alertes: 'Alerting',
  Automatisations: 'Automations',
  'Base de données': 'Database',
  Budget: 'Budget',
  Cache: 'Cache',
  'Carte des services': 'Service map',
  Courriel: 'Email',
  Demandes: 'Requests',
  'Dépôts de code': 'Code repositories',
  Disponibilité: 'Uptime',
  'DNS et filtrage': 'DNS & filtering',
  Documents: 'Documents',
  'Éditeur en ligne': 'Online editor',
  Fichiers: 'Files',
  Films: 'Movies',
  'Génération d’images': 'Image generation',
  'Gestion d’entreprise': 'Business management',
  'Gestion Docker': 'Docker management',
  Hyperviseur: 'Hypervisor',
  Indexeurs: 'Indexers',
  'Interface de chat': 'Chat interface',
  'Interface web': 'Web interface',
  'Livres audio': 'Audiobooks',
  Messagerie: 'Messaging',
  Métriques: 'Metrics',
  'Modèles de langage': 'Language models',
  'Mots de passe': 'Passwords',
  Musique: 'Music',
  'Objets connectés': 'Connected devices',
  'Page d’accueil': 'Start page',
  'Panneau de serveurs de jeu': 'Game server panel',
  'Panneau Minecraft': 'Minecraft panel',
  'Partage de fichiers': 'File sharing',
  'Passerelle Zigbee': 'Zigbee bridge',
  Photos: 'Photos',
  Recettes: 'Recipes',
  'Résolution de noms': 'Name resolution',
  Sauvegardes: 'Backups',
  Séries: 'TV shows',
  'Séries temporelles': 'Time series',
  'Serveur de jeu': 'Game server',
  'Serveur multimédia': 'Media server',
  'Site web': 'Website',
  'Sous-titres': 'Subtitles',
  'Statistiques Plex': 'Plex statistics',
  Stockage: 'Storage',
  'Stockage objet': 'Object storage',
  'Stocks de la maison': 'Household stock',
  Supervision: 'Monitoring',
  Synchronisation: 'Sync',
  'Tableau de bord': 'Dashboard',
  'Tableaux de bord': 'Dashboards',
  Tâches: 'Chores',
  Téléchargements: 'Downloads',
};

const MOTIFS_EN = [[/^Serveur Minecraft(.*)$/, 'Minecraft server$1']];

export function traduire(langue, t) {
  if (langue !== 'en' || typeof t !== 'string') return t;
  if (PHRASES_EN[t]) return PHRASES_EN[t];
  for (const [motif, rempl] of MOTIFS_EN) if (motif.test(t)) return t.replace(motif, rempl);
  // Rôles composés (« Gitea · Partage SMB ») : chaque morceau.
  if (t.includes(' · ')) return t.split(' · ').map((m) => PHRASES_EN[m] ?? m).join(' · ');
  return t;
}

// Passe toute la carte en anglais : quartiers, types de liens, rôles, ports, liens.
// La carte partage des objets avec le catalogue et les valeurs par défaut : on traduit une copie.
export function traduireCarte(langue, source) {
  if (langue !== 'en') return source;
  const carte = structuredClone(source);
  const tr = (t) => traduire(langue, t);
  for (const g of carte.groupes) g.nom = tr(g.nom);
  for (const t of Object.values(carte.typesLiens)) t.nom = tr(t.nom);
  for (const l of carte.liens) l.label = tr(l.label);
  for (const n of carte.noeuds) {
    n.role = tr(n.role);
    for (const p of [...(n.ports ?? []), ...(n.sondes ?? [])]) p.nom = tr(p.nom);
    for (const l of n.liens ?? []) l.titre = tr(l.titre);
    if (n.decouvert?.services) n.decouvert.services = n.decouvert.services.map(tr);
  }
  return carte;
}
