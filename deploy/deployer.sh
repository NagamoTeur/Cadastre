#!/usr/bin/env bash
# Déploie l'arbre de travail sur un CT déjà installé, en développement.
# Pour installer ou mettre à jour depuis une release : deploy/installer-proxmox.sh.
#   CADASTRE_CIBLE=root@ip  CATALOGUE=chemin/catalogue.yaml  deploy/deployer.sh
set -euo pipefail

CIBLE="${CADASTRE_CIBLE:?CADASTRE_CIBLE=root@<ip du conteneur>}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ envoi du code vers $CIBLE:/opt/cadastre"
rsync -a --delete \
  --exclude .git --exclude node_modules --exclude .donnees --exclude dist --exclude catalogue/catalogue.yaml \
  "$ICI/" "$CIBLE:/opt/cadastre/"

# Le jeton Proxmox ne voyage qu'une fois, à la première installation.
if ! ssh "$CIBLE" test -f /etc/cadastre/cadastre.env; then
  ENV_LOCAL="$HOME/.config/cadastre/cadastre.env"
  [[ -f "$ENV_LOCAL" ]] || { echo "Il manque $ENV_LOCAL (PVE_TOKEN)." >&2; exit 1; }
  echo "→ première installation : configuration et certificat du Proxmox"
  ssh "$CIBLE" 'install -d -m 750 /etc/cadastre'
  CA="$(grep -oP '^PVE_CA=\K.*' "$ENV_LOCAL" || true)"
  [[ -n "$CA" && -f "$CA" ]] && scp -q "$CA" "$CIBLE:/etc/cadastre/proxmox-ca.pem"
  grep -vE '^(PVE_CA|CADASTRE_CATALOGUE)=' "$ENV_LOCAL" | ssh "$CIBLE" 'umask 077; cat > /etc/cadastre/cadastre.env; [ -f /etc/cadastre/proxmox-ca.pem ] && echo PVE_CA=/etc/cadastre/proxmox-ca.pem >> /etc/cadastre/cadastre.env; true'
fi

# Un catalogue local (CATALOGUE=chemin) part avec le code.
if [[ -n "${CATALOGUE:-}" ]]; then
  echo "→ catalogue $CATALOGUE"
  scp -q "$CATALOGUE" "$CIBLE:/etc/cadastre/catalogue.yaml"
fi

ssh "$CIBLE" 'bash /opt/cadastre/deploy/install.sh'
echo "✓ Cadastre : http://${CIBLE#*@}:8793/"
