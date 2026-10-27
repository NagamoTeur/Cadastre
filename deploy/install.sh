#!/usr/bin/env bash
# S'exécute sur le CT, depuis /opt/cadastre : Node, dépendances, utilisateur et service.
# Rejouable. Une release embarque ses node_modules ; une copie des sources (deployer.sh)
# les installe avec npm.
set -euo pipefail
cd /opt/cadastre

if ! command -v node >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi

empreinte="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [[ "$(cat node_modules/.cadastre-lock 2>/dev/null)" != "$empreinte" ]]; then
  if ! command -v npm >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq npm >/dev/null
  fi
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
  echo "$empreinte" > node_modules/.cadastre-lock
fi

id cadastre >/dev/null 2>&1 || useradd --system --home /var/lib/cadastre --shell /usr/sbin/nologin cadastre
install -d -o cadastre -g cadastre -m 750 /var/lib/cadastre
install -d -m 750 /etc/cadastre
chgrp -R cadastre /etc/cadastre
chmod 640 /etc/cadastre/* 2>/dev/null || true

install -m 644 deploy/cadastre.service /etc/systemd/system/cadastre.service
systemctl daemon-reload
systemctl enable --quiet cadastre
systemctl restart cadastre
sleep 2
systemctl is-active cadastre
