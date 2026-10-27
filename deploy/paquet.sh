#!/usr/bin/env bash
# Fabrique l'archive d'une release : le code et ses node_modules, prête à poser
# dans /opt/cadastre sans npm. Usage : deploy/paquet.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p 'require("./package.json").version')}"
VERSION="${VERSION#v}"
rm -rf dist && mkdir -p dist/cadastre/catalogue
cp -r server public deploy package.json package-lock.json README.md README.fr.md LICENSE dist/cadastre/
cp catalogue/exemple.yaml dist/cadastre/catalogue/
echo "$VERSION" > dist/cadastre/VERSION
(
  cd dist/cadastre
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
  sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.cadastre-lock
)
tar -C dist -czf "dist/cadastre-$VERSION.tar.gz" cadastre
echo "dist/cadastre-$VERSION.tar.gz"
