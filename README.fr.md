# Cadastre

*[English](README.md)*

L'interface parle français et anglais : elle suit la langue du navigateur, et le bouton
en haut à droite la change.

La carte des services d'un Proxmox VE : à quoi sert chaque machine, par où on y entre,
qui parle à qui, et ce qui cloche. Elle se dessine seule, puis on la complète.

## Installer

En root sur l'hôte Proxmox :

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/NagamoTeur/Cadastre/main/deploy/installer-proxmox.sh)"
```

Le script crée un conteneur Debian 13 non privilégié (1 cœur, 512 Mo, 4 Go), un utilisateur
Proxmox `cadastre@pve` avec un jeton en **lecture seule** (rôle PVEAuditor), et installe la
dernière release. La carte est ensuite sur `http://<ip du conteneur>:8793/`.

Réglages possibles, en variables devant la commande : `CTID=140`, `CT_NOM=cadastre`,
`STOCKAGE=local-lvm`, `PONT=vmbr0`, `IP=192.168.1.50/24 PASSERELLE=192.168.1.1` (DHCP par
défaut), `SOURCE=` (archive locale ou URL), `DEPOT=` (dépôt GitHub ou Gitea des releases, par
défaut `https://github.com/NagamoTeur/Cadastre`). Les noms anglais (`CT_NAME`, `STORAGE`,
`BRIDGE`, `GATEWAY`, `REPO`, `--update`) marchent aussi.

Mettre à jour une installation :

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/NagamoTeur/Cadastre/main/deploy/installer-proxmox.sh)" -- --mise-a-jour <CTID>
```

## Ce qu'on y voit

- **Le plan** : chaque quartier (réseau, code, surveillance, stockage, médias, domotique,
  jeux…) est une parcelle. Les flèches sont les liens entre services, colorés par type.
  On déplace les cartes à la souris ; la disposition est gardée sur le serveur.
- **La fiche** (clic sur un service) : rôle, état en direct (CPU, mémoire, disque, uptime),
  IP, domaines, ports et temps de réponse, routes du proxy qui y mènent, relations,
  liens à ouvrir, notes du Proxmox, ce que la découverte a trouvé, commande pour y entrer.
  L'adresse `#<id>` ouvre directement une fiche.
- **Les anomalies** : invité arrêté alors qu'il démarre avec l'hôte, port qui ne répond
  plus, disque ou mémoire presque pleins, **routes orphelines** (un domaine que Traefik
  envoie vers une IP où plus rien ne tourne), entrée du catalogue disparue du Proxmox.
- **La recherche** (`/`) : nom, rôle, IP, VMID, domaine, tag.

## L'auto-découverte

Toutes les 10 minutes (ou au bouton « Relancer la découverte »), pour chaque invité allumé
et chaque hôte :

1. **Le Proxmox** donne la liste des invités, leurs IP, leurs tags et leurs **notes**
   (l'onglet « Notes » sert de description, sa première phrase de rôle).
2. **Les ports courants** (~80) sont essayés en TCP.
3. **Chaque port web** est interrogé : le titre de la page et l'en-tête `Server` sont
   comparés à une centaine d'empreintes ([`server/signatures.mjs`](server/signatures.mjs)) :
   Gitea, Jellyfin, Home Assistant, Nextcloud, Grafana, AdGuard, les *arr…
4. **Les serveurs Minecraft** répondent à un ping : version, joueurs, mods, MOTD.
5. **Traefik** est repéré par son API (`/api/version`) ; ses routes deviennent des flèches,
   et une route vers une IP inconnue devient une anomalie.

La machine prend le quartier de ses services reconnus. Un tag Proxmox portant le nom d'un
quartier (`medias`, `jeux`…) l'y range d'office. Rien n'est écrit sur les machines.

## Le catalogue (facultatif)

Ce que la découverte ne peut pas deviner (à quoi sert vraiment une machine, qui dépend de
qui, un NAS hors du Proxmox) s'écrit dans `/etc/cadastre/catalogue.yaml`, relu dès qu'il
change. Partir de [`catalogue/exemple.yaml`](catalogue/exemple.yaml). La fiche d'une machine
découverte propose le bout de YAML à coller.

## Configuration

`/etc/cadastre/cadastre.env` dans le conteneur :

| Variable | Rôle | Défaut |
|---|---|---|
| `PVE_URL` | API du Proxmox | `https://127.0.0.1:8006` |
| `PVE_TOKEN` | `utilisateur@royaume!jeton=secret`, PVEAuditor suffit | — |
| `PVE_CA` | certificat de l'hôte (`/etc/pve/pve-root-ca.pem`) | non vérifié |
| `TRAEFIK_API` | API Traefik, si la découverte ne la trouve pas | découverte |
| `CADASTRE_CATALOGUE` | chemin du catalogue | `/etc/cadastre/catalogue.yaml` |
| `CADASTRE_DEPOT_BASE` | préfixe des `depot:` du catalogue | — |
| `CADASTRE_PORT` | port de la page | `8793` |
| `RYTHME_DECOUVERTE` | secondes entre deux découvertes | `600` |

La page n'a pas d'authentification : elle ne permet aucune action sur le homelab, au pire
de déplacer des cartes. Ne l'exposez pas sur Internet.

## Développer

```bash
npm ci
npm run check                      # tests
node server/index.mjs              # http://localhost:8793, config dans ~/.config/cadastre/cadastre.env
deploy/deployer.sh                 # pousse l'arbre de travail sur un CT déjà installé
```

Node 20 ou plus, sans étape de build : le serveur (`server/`) n'a qu'une dépendance
(`yaml`), la page (`public/`) charge Cytoscape depuis `node_modules`.

Une release se publie en poussant un tag `v*` : GitHub Actions lance les tests, fabrique
l'archive (`deploy/paquet.sh`, avec ses `node_modules`) et la joint à la release
(`.github/workflows/release.yml`).

## Idées pour la suite

1. **Catalogue édité dans la page**, enregistré par une PR.
2. **Liens découverts** : lire les connexions établies de chaque CT et proposer les
   flèches manquantes.
3. **Vue « et si… »** : choisir une machine et voir tout ce qui tombe avec elle.
4. **Historique** : une frise par service (allumé, ports).
5. **Sauvegardes** : âge du dernier vzdump de chaque invité, en anomalie au-delà de 7 jours.
6. **Autres proxys** : Nginx Proxy Manager et Caddy, dont l'API demande un compte.

## Contribuer

Une empreinte manque ? Elle s'ajoute en une ligne dans
[`server/signatures.mjs`](server/signatures.mjs) ; les PR sont bienvenues.

Licence MIT.
