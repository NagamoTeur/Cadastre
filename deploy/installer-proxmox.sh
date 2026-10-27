#!/usr/bin/env bash
# Installe le Cadastre sur un Proxmox VE, dans son propre conteneur.
#
# À lancer en root sur l'hôte Proxmox :
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/NagamoTeur/Cadastre/main/deploy/installer-proxmox.sh)"
#
# Ce que fait le script :
#   1. crée un conteneur Debian 13 non privilégié (1 cœur, 512 Mo, 4 Go) ;
#   2. crée l'utilisateur Proxmox cadastre@pve et un jeton ct<CTID>, en lecture seule (PVEAuditor) ;
#   3. y installe la dernière version publiée et lance le service sur le port 8793.
# Le Cadastre ne fait que lire : l'API du Proxmox avec ce jeton, et les ports des invités.
#
# Réglages (variables d'environnement, avec leur alias anglais) :
#   CTID=140                         numéro du conteneur (défaut : le prochain libre)
#   CT_NOM / CT_NAME=cadastre        nom d'hôte
#   STOCKAGE / STORAGE=local-lvm     stockage du disque (défaut : le premier qui accepte des conteneurs)
#   PONT / BRIDGE=vmbr0              pont réseau
#   IP=dhcp                          ou 192.168.1.50/24 avec PASSERELLE / GATEWAY=192.168.1.1
#   SOURCE=…                         archive à installer (URL ou fichier) ; défaut : dernière release
#   DEPOT / REPO=…                   dépôt GitHub/Gitea des releases
# Les messages sont en français si $LANG l'est, en anglais sinon.
#
# Mise à jour d'une installation existante :
#   bash installer-proxmox.sh --mise-a-jour <CTID>      (ou --update <CTID>)
set -euo pipefail

DEPOT="${DEPOT:-${REPO:-https://github.com/NagamoTeur/Cadastre}}"
CT_NOM="${CT_NOM:-${CT_NAME:-cadastre}}"
PONT="${PONT:-${BRIDGE:-vmbr0}}"
STOCKAGE="${STOCKAGE:-${STORAGE:-}}"
PASSERELLE="${PASSERELLE:-${GATEWAY:-}}"
IP="${IP:-dhcp}"
MEMOIRE="${MEMOIRE:-512}"
DISQUE="${DISQUE:-4}"
UTILISATEUR_PVE="cadastre@pve"

gras=$'\e[1m'; vert=$'\e[32m'; rouge=$'\e[31m'; normal=$'\e[0m'
etape() { echo "${gras}→ $*${normal}" >&2; }
fin() { echo "${rouge}✗ $*${normal}" >&2; exit 1; }
# m "français" "english" : le message dans la langue de la console.
FR=""; [[ "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" == fr* ]] && FR=1
m() { if [[ -n "$FR" ]]; then printf '%s' "$1"; else printf '%s' "$2"; fi; }

[[ $EUID -eq 0 ]] || fin "$(m "à lancer en root sur l'hôte Proxmox" "run as root on the Proxmox host")"
command -v pct >/dev/null && command -v pveum >/dev/null || fin "$(m "pct/pveum introuvables : ce n'est pas un hôte Proxmox VE" "pct/pveum not found: this is not a Proxmox VE host")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── L'archive à installer ─────────────────────────────────────────────
recuperer_archive() {
  local archive="$TMP/cadastre.tar.gz"
  if [[ -n "${SOURCE:-}" ]]; then
    if [[ -f "$SOURCE" ]]; then cp "$SOURCE" "$archive"; else curl -fsSL "$SOURCE" -o "$archive"; fi
  else
    local api
    case "$DEPOT" in
      https://github.com/*) api="https://api.github.com/repos/${DEPOT#https://github.com/}/releases/latest" ;;
      *) api="${DEPOT%/*/*}/api/v1/repos/${DEPOT#*://*/}/releases/latest" ;;
    esac
    local url
    url="$(curl -fsSL "$api" | python3 -c 'import json,sys; r=json.load(sys.stdin); print(next(a["browser_download_url"] for a in r["assets"] if a["name"].endswith(".tar.gz")))')" \
      || fin "$(m "aucune release trouvée sur $DEPOT" "no release found on $DEPOT")"
    etape "$(m "téléchargement de" "downloading") $url"
    curl -fsSL "$url" -o "$archive"
  fi
  tar -tzf "$archive" cadastre/server/index.mjs >/dev/null 2>&1 || fin "$(m "l'archive ne contient pas le Cadastre" "the archive does not contain Cadastre")"
  echo "$archive"
}

# Pose l'application dans le conteneur et (re)lance le service.
installer_dans_ct() {
  local ct="$1" archive="$2"
  etape "$(m "installation de Node.js dans le conteneur $ct" "installing Node.js in container $ct")"
  pct exec "$ct" -- env LC_ALL=C.UTF-8 bash -c 'command -v node >/dev/null || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs ca-certificates >/dev/null; }'
  local majeur
  majeur="$(pct exec "$ct" -- node -p 'process.versions.node.split(".")[0]')"
  (( majeur >= 20 )) || fin "$(m "Node $majeur trop ancien dans le conteneur (il faut 20 ou plus)" "Node $majeur in the container is too old (20 or newer needed)")"

  etape "$(m "copie de l'application" "copying the application")"
  pct push "$ct" "$archive" /tmp/cadastre.tar.gz
  pct exec "$ct" -- env LC_ALL=C.UTF-8 bash -c '
    set -e
    rm -rf /opt/cadastre.nouveau && mkdir -p /opt/cadastre.nouveau
    tar -xzf /tmp/cadastre.tar.gz -C /opt/cadastre.nouveau --strip-components=1
    rm -f /tmp/cadastre.tar.gz
    rm -rf /opt/cadastre.ancien
    [ -d /opt/cadastre ] && mv /opt/cadastre /opt/cadastre.ancien
    mv /opt/cadastre.nouveau /opt/cadastre
    bash /opt/cadastre/deploy/install.sh'
}

# ── Mise à jour ───────────────────────────────────────────────────────
if [[ "${1:-}" == "--mise-a-jour" || "${1:-}" == "--update" ]]; then
  ct="${2:-}"
  [[ -n "$ct" ]] || fin "usage : $0 --update <CTID>"
  pct status "$ct" | grep -q running || fin "$(m "le conteneur $ct n'est pas démarré" "container $ct is not running")"
  pct exec "$ct" -- test -f /etc/cadastre/cadastre.env || fin "$(m "le conteneur $ct n'a pas de Cadastre installé" "container $ct has no Cadastre installed")"
  archive="$(recuperer_archive)"
  installer_dans_ct "$ct" "$archive"
  echo "${vert}✓ $(m "Cadastre mis à jour" "Cadastre updated") ($(pct exec "$ct" -- cat /opt/cadastre/VERSION 2>/dev/null || echo '?'))${normal}"
  exit 0
fi

# ── Nouvelle installation ─────────────────────────────────────────────
archive="$(recuperer_archive)"

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
# Un jeton par installation : en réinstaller une ne coupe pas les autres.
JETON="ct$CTID"
pct status "$CTID" >/dev/null 2>&1 && fin "$(m "le conteneur $CTID existe déjà (CTID=… pour en choisir un autre, --mise-a-jour pour le mettre à jour)" "container $CTID already exists (CTID=… to pick another one, --update to update it)")"

if [[ -z "$STOCKAGE" ]]; then
  STOCKAGE="$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 && $3=="active" {print $1; exit}')"
  [[ -n "$STOCKAGE" ]] || fin "$(m "aucun stockage n'accepte de conteneurs (STOCKAGE=… pour le préciser)" "no storage accepts containers (set STORAGE=…)")"
fi

etape "$(m "modèle Debian 13" "Debian 13 template")"
STOCKAGE_MODELES="$(pvesm status -content vztmpl 2>/dev/null | awk 'NR>1 && $3=="active" {print $1; exit}')"
[[ -n "$STOCKAGE_MODELES" ]] || fin "$(m "aucun stockage n'accepte de modèles de conteneurs" "no storage accepts container templates")"
MODELE="$(pveam list "$STOCKAGE_MODELES" | awk '/debian-13-standard/ {print $1}' | sort -V | tail -1)"
if [[ -z "$MODELE" ]]; then
  pveam update >/dev/null
  NOM_MODELE="$(pveam available --section system | awk '/debian-13-standard/ {print $2}' | sort -V | tail -1)"
  [[ -n "$NOM_MODELE" ]] || fin "$(m "modèle debian-13-standard introuvable" "debian-13-standard template not found")"
  pveam download "$STOCKAGE_MODELES" "$NOM_MODELE" >/dev/null
  MODELE="$STOCKAGE_MODELES:vztmpl/$NOM_MODELE"
fi

RESEAU="name=eth0,bridge=$PONT,firewall=1,type=veth,ip=$IP"
[[ "$IP" != "dhcp" && -n "$PASSERELLE" ]] && RESEAU+=",gw=$PASSERELLE"

etape "$(m "création du conteneur $CTID ($CT_NOM) sur $STOCKAGE" "creating container $CTID ($CT_NOM) on $STOCKAGE")"
pct create "$CTID" "$MODELE" \
  --hostname "$CT_NOM" --cores 1 --cpuunits 50 --memory "$MEMOIRE" --swap 256 \
  --rootfs "$STOCKAGE:$DISQUE" --net0 "$RESEAU" \
  --unprivileged 1 --features nesting=1 --onboot 1 --ostype debian --tags cadastre \
  --description "Cadastre: service map of this Proxmox (read-only)." >/dev/null
pct start "$CTID"

etape "$(m "attente du réseau" "waiting for the network")"
IP_CT=""
for _ in $(seq 1 30); do
  IP_CT="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$IP_CT" ]] && pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done
[[ -n "$IP_CT" ]] || fin "$(m "le conteneur n'a pas obtenu d'adresse IP" "the container got no IP address")"

etape "$(m "jeton Proxmox en lecture seule" "read-only Proxmox token") ($UTILISATEUR_PVE!$JETON)"
pveum user list --output-format json | python3 -c "import json,sys; sys.exit(0 if any(u['userid']=='$UTILISATEUR_PVE' for u in json.load(sys.stdin)) else 1)" \
  || pveum user add "$UTILISATEUR_PVE" --comment "Cadastre, service map (read-only)"
pveum acl modify / --users "$UTILISATEUR_PVE" --roles PVEAuditor
pveum user token remove "$UTILISATEUR_PVE" "$JETON" >/dev/null 2>&1 || true
SECRET="$(pveum user token add "$UTILISATEUR_PVE" "$JETON" --privsep 0 --output-format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])')"

# L'adresse de l'hôte sur le pont du conteneur.
IP_HOTE="$(ip -4 -o addr show dev "$PONT" | awk '{print $4}' | cut -d/ -f1 | head -1)"
[[ -n "$IP_HOTE" ]] || IP_HOTE="$(hostname -I | awk '{print $1}')"

etape "configuration"
pct exec "$CTID" -- install -d -m 750 /etc/cadastre
pct push "$CTID" /etc/pve/pve-root-ca.pem /etc/cadastre/pve-root-ca.pem
printf 'PVE_URL=https://%s:8006\nPVE_TOKEN=%s!%s=%s\nPVE_CA=/etc/cadastre/pve-root-ca.pem\n' "$IP_HOTE" "$UTILISATEUR_PVE" "$JETON" "$SECRET" > "$TMP/cadastre.env"
chmod 600 "$TMP/cadastre.env"
pct push "$CTID" "$TMP/cadastre.env" /etc/cadastre/cadastre.env --perms 600
unset SECRET

installer_dans_ct "$CTID" "$archive"
pct set "$CTID" --description "Cadastre: service map of this Proxmox (read-only). http://$IP_CT:8793/"

if [[ -n "$FR" ]]; then cat <<FIN

${vert}✓ Le Cadastre tourne : ${gras}http://$IP_CT:8793/${normal}

  La première découverte prend une à deux minutes ; la carte se range d'elle-même.
  Pour décrire vos services : pct enter $CTID, puis
    cp /opt/cadastre/catalogue/exemple.yaml /etc/cadastre/catalogue.yaml
  et modifiez-le (il est relu à chaque changement).
  Mise à jour : relancez ce script avec --mise-a-jour $CTID

FIN
else cat <<FIN

${vert}✓ Cadastre is running: ${gras}http://$IP_CT:8793/${normal}

  The first discovery takes a minute or two; the map arranges itself.
  To describe your services: pct enter $CTID, then
    cp /opt/cadastre/catalogue/exemple.yaml /etc/cadastre/catalogue.yaml
  and edit it (it is reloaded on every change).
  Update: run this script again with --update $CTID

FIN
fi
