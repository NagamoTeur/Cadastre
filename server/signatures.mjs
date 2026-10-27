// Les empreintes : comment reconnaître un service à ce qu'il répond.
//
// Une règle reconnaît un service par le titre de sa page, son en-tête Server,
// le début de sa réponse, ou à défaut par son seul port. Les règles HTTP passent
// avant les règles de port, plus fragiles.

// Ports essayés sur chaque invité. Les ports inconnus ouverts par un service ne
// sont pas vus : le catalogue peut les déclarer.
export const PORTS_COURANTS = [
  21, 22, 25, 53, 80, 81, 443, 445, 631, 1880, 1883, 2049, 2283, 3000, 3001, 3002, 3003, 3004, 3005, 3100,
  3306, 4000, 5000, 5001, 5055, 5076, 5432, 5678, 5984, 6379, 6767, 7575, 7878, 8000, 8006, 8007, 8080, 8081,
  8082, 8083, 8085, 8086, 8088, 8090, 8096, 8112, 8123, 8181, 8200, 8222, 8384, 8443, 8686, 8787, 8790, 8888,
  8989, 9000, 9001, 9090, 9091, 9093, 9100, 9117, 9443, 9696, 10000, 11434, 19999, 25565, 25566, 25567,
  25568, 25569, 25570, 27015, 32400,
];

// Ports qui ne parlent pas HTTP : inutile de leur demander une page.
export const PORTS_NON_HTTP = new Set([21, 22, 25, 53, 445, 1883, 2049, 3306, 5432, 6379, 25565, 25566, 25567, 25568, 25569, 25570, 27015]);

export const PORTS_MINECRAFT = new Set([25565, 25566, 25567, 25568, 25569, 25570]);

// prioritaire : ce service décide du quartier de sa machine (un proxy qui relaie
// des ports Minecraft reste un proxy).
// groupe : l'un des quartiers par défaut (voir GROUPES_DEFAUT dans decouverte.mjs).
export const SIGNATURES = [
  // Réseau et accès
  { nom: 'Traefik', prioritaire: true, groupe: 'reseau', role: 'Reverse proxy', titre: /traefik/i },
  { nom: 'Nginx Proxy Manager', prioritaire: true, groupe: 'reseau', role: 'Reverse proxy', titre: /nginx proxy manager/i },
  { nom: 'Caddy', prioritaire: true, groupe: 'reseau', role: 'Serveur web', serveur: /caddy/i },
  { nom: 'AdGuard Home', groupe: 'reseau', role: 'DNS et filtrage', titre: /adguard/i },
  { nom: 'Pi-hole', groupe: 'reseau', role: 'DNS et filtrage', titre: /pi-hole/i },
  { nom: 'Technitium DNS', groupe: 'reseau', role: 'DNS', titre: /technitium/i },
  { nom: 'WireGuard Easy', groupe: 'reseau', role: 'VPN', titre: /wireguard|wg-easy/i },
  { nom: 'Headscale', groupe: 'reseau', role: 'VPN', titre: /headscale/i },
  { nom: 'Proxmox VE', groupe: 'hote', role: 'Hyperviseur', port: 8006 },
  { nom: 'Proxmox Backup Server', groupe: 'stockage', role: 'Sauvegardes', port: 8007 },
  { nom: 'Portainer', groupe: 'reseau', role: 'Gestion Docker', titre: /portainer/i },
  { nom: 'Cockpit', groupe: 'reseau', role: 'Administration', titre: /cockpit/i },
  { nom: 'Webmin', groupe: 'reseau', role: 'Administration', titre: /webmin/i },
  // Code
  { nom: 'Gitea', groupe: 'dev', role: 'Dépôts de code', titre: /gitea/i },
  { nom: 'Forgejo', groupe: 'dev', role: 'Dépôts de code', titre: /forgejo/i },
  { nom: 'GitLab', groupe: 'dev', role: 'Dépôts de code', titre: /gitlab/i },
  { nom: 'Jenkins', groupe: 'dev', role: 'Intégration continue', titre: /jenkins/i },
  { nom: 'Woodpecker', groupe: 'dev', role: 'Intégration continue', titre: /woodpecker/i },
  { nom: 'code-server', groupe: 'dev', role: 'Éditeur en ligne', titre: /code-server/i },
  // Surveillance
  { nom: 'Grafana', groupe: 'veille', role: 'Tableaux de bord', titre: /grafana/i },
  { nom: 'Prometheus', groupe: 'veille', role: 'Métriques', titre: /prometheus/i },
  { nom: 'Alertmanager', groupe: 'veille', role: 'Alertes', titre: /alertmanager/i },
  { nom: 'Uptime Kuma', groupe: 'veille', role: 'Disponibilité', titre: /uptime kuma/i },
  { nom: 'Netdata', groupe: 'veille', role: 'Métriques', titre: /netdata/i },
  { nom: 'Zabbix', groupe: 'veille', role: 'Supervision', titre: /zabbix/i },
  { nom: 'Homarr', groupe: 'veille', role: 'Page d’accueil', titre: /homarr/i },
  { nom: 'Homepage', groupe: 'veille', role: 'Page d’accueil', titre: /^homepage$/i },
  { nom: 'Dashy', groupe: 'veille', role: 'Page d’accueil', titre: /dashy/i },
  { nom: 'Vigie', groupe: 'veille', role: 'Tableau de bord', titre: /vigie/i },
  { nom: 'Cadastre', groupe: 'veille', role: 'Carte des services', titre: /^cadastre$/i },
  { nom: 'Node exporter', groupe: 'veille', role: 'Métriques', port: 9100 },
  // Médias
  { nom: 'Jellyfin', groupe: 'medias', role: 'Serveur multimédia', titre: /jellyfin/i },
  { nom: 'Emby', groupe: 'medias', role: 'Serveur multimédia', titre: /emby/i },
  { nom: 'Plex', groupe: 'medias', role: 'Serveur multimédia', port: 32400 },
  { nom: 'Sonarr', groupe: 'medias', role: 'Séries', titre: /sonarr/i },
  { nom: 'Radarr', groupe: 'medias', role: 'Films', titre: /radarr/i },
  { nom: 'Lidarr', groupe: 'medias', role: 'Musique', titre: /lidarr/i },
  { nom: 'Prowlarr', groupe: 'medias', role: 'Indexeurs', titre: /prowlarr/i },
  { nom: 'Bazarr', groupe: 'medias', role: 'Sous-titres', titre: /bazarr/i },
  { nom: 'Jellyseerr', groupe: 'medias', role: 'Demandes', titre: /jellyseerr/i },
  { nom: 'Overseerr', groupe: 'medias', role: 'Demandes', titre: /overseerr/i },
  { nom: 'Tautulli', groupe: 'medias', role: 'Statistiques Plex', titre: /tautulli/i },
  { nom: 'qBittorrent', groupe: 'medias', role: 'Téléchargements', titre: /qbittorrent/i },
  { nom: 'Transmission', groupe: 'medias', role: 'Téléchargements', titre: /transmission/i },
  { nom: 'Deluge', groupe: 'medias', role: 'Téléchargements', titre: /deluge/i },
  { nom: 'Navidrome', groupe: 'medias', role: 'Musique', titre: /navidrome/i },
  { nom: 'Audiobookshelf', groupe: 'medias', role: 'Livres audio', titre: /audiobookshelf/i },
  // Domotique
  { nom: 'Home Assistant', groupe: 'domotique', role: 'Domotique', titre: /home assistant/i },
  { nom: 'Node-RED', groupe: 'domotique', role: 'Automatisations', titre: /node-red/i },
  { nom: 'Zigbee2MQTT', groupe: 'domotique', role: 'Passerelle Zigbee', titre: /zigbee2mqtt/i },
  { nom: 'ESPHome', groupe: 'domotique', role: 'Objets connectés', titre: /esphome/i },
  { nom: 'n8n', groupe: 'domotique', role: 'Automatisations', titre: /n8n/i },
  { nom: 'Broker MQTT', groupe: 'domotique', role: 'Messagerie', port: 1883 },
  // Stockage et documents
  { nom: 'Nextcloud', groupe: 'stockage', role: 'Fichiers', titre: /nextcloud/i },
  { nom: 'Immich', groupe: 'stockage', role: 'Photos', titre: /immich/i },
  { nom: 'PhotoPrism', groupe: 'stockage', role: 'Photos', titre: /photoprism/i },
  { nom: 'Paperless-ngx', groupe: 'stockage', role: 'Documents', titre: /paperless/i },
  { nom: 'Syncthing', groupe: 'stockage', role: 'Synchronisation', titre: /syncthing/i },
  { nom: 'Vaultwarden', groupe: 'stockage', role: 'Mots de passe', titre: /vaultwarden|bitwarden/i },
  { nom: 'TrueNAS', groupe: 'stockage', role: 'Stockage', titre: /truenas/i },
  { nom: 'OpenMediaVault', groupe: 'stockage', role: 'Stockage', titre: /openmediavault/i },
  { nom: 'MinIO', groupe: 'stockage', role: 'Stockage objet', titre: /minio/i },
  { nom: 'Partage SMB', groupe: 'stockage', role: 'Partage de fichiers', port: 445 },
  { nom: 'Partage NFS', groupe: 'stockage', role: 'Partage de fichiers', port: 2049 },
  // Bases de données
  { nom: 'PostgreSQL', groupe: 'donnees', role: 'Base de données', port: 5432 },
  { nom: 'MariaDB / MySQL', groupe: 'donnees', role: 'Base de données', port: 3306 },
  { nom: 'Redis', groupe: 'donnees', role: 'Cache', port: 6379 },
  { nom: 'CouchDB', groupe: 'donnees', role: 'Base de données', port: 5984 },
  { nom: 'InfluxDB', groupe: 'donnees', role: 'Séries temporelles', port: 8086 },
  // IA
  { nom: 'Ollama', groupe: 'ia', role: 'Modèles de langage', port: 11434 },
  { nom: 'Open WebUI', groupe: 'ia', role: 'Interface de chat', titre: /open webui/i },
  { nom: 'ComfyUI', groupe: 'ia', role: 'Génération d’images', titre: /comfyui/i },
  // Jeux (les serveurs Minecraft sont interrogés à part)
  { nom: 'Pterodactyl', groupe: 'jeux', role: 'Panneau de serveurs de jeu', titre: /pterodactyl/i },
  { nom: 'Crafty', groupe: 'jeux', role: 'Panneau Minecraft', titre: /crafty/i },
  { nom: 'Serveur Steam', groupe: 'jeux', role: 'Serveur de jeu', port: 27015 },
  // Applis
  { nom: 'Mealie', groupe: 'apps', role: 'Recettes', titre: /mealie/i },
  { nom: 'Grocy', groupe: 'apps', role: 'Stocks de la maison', titre: /grocy/i },
  { nom: 'Firefly III', groupe: 'apps', role: 'Budget', titre: /firefly/i },
  { nom: 'Actual', groupe: 'apps', role: 'Budget', titre: /^actual$/i },
  { nom: 'Donetick', groupe: 'apps', role: 'Tâches', titre: /donetick/i },
  { nom: 'Dolibarr', groupe: 'apps', role: 'Gestion d’entreprise', titre: /dolibarr/i },
  { nom: 'Wiki.js', groupe: 'apps', role: 'Wiki', titre: /wiki\.js/i },
  { nom: 'BookStack', groupe: 'apps', role: 'Wiki', titre: /bookstack/i },
  { nom: 'Serveur de mail', groupe: 'apps', role: 'Courriel', port: 25 },
  { nom: 'Serveur web', groupe: 'apps', role: 'Site web', serveur: /nginx|apache|lighttpd/i, faible: true },
  { nom: 'SSH', groupe: null, role: 'Accès', port: 22, faible: true },
  { nom: 'DNS', groupe: 'reseau', role: 'Résolution de noms', port: 53 },
];

// Reconnaît un service à partir d'un port ouvert et, s'il y en a, de sa réponse HTTP.
export function reconnaitre(port, http) {
  if (http) {
    for (const s of SIGNATURES) {
      if (s.titre && http.titre && s.titre.test(http.titre)) return { ...s, par: 'titre' };
      if (s.serveur && http.serveur && s.serveur.test(http.serveur) && !s.faible) return { ...s, par: 'serveur' };
    }
  }
  const parPort = SIGNATURES.find((s) => s.port === port);
  if (parPort) return { ...parPort, par: 'port' };
  if (http) {
    const faible = SIGNATURES.find((s) => s.faible && s.serveur && http.serveur && s.serveur.test(http.serveur));
    if (faible) return { ...faible, nom: http.titre || faible.nom, par: 'serveur' };
    return { nom: http.titre || `Web :${port}`, groupe: null, role: 'Interface web', par: 'http', faible: true };
  }
  return null;
}
