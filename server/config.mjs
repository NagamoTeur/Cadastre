// Toute la configuration passe par l'environnement (fichier /etc/cadastre/cadastre.env
// sur le CT, ou ~/.config/cadastre/cadastre.env en développement).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lit un fichier KEY=valeur sans écraser ce que l'environnement donne déjà.
function chargerEnv(chemin) {
  if (!existsSync(chemin)) return;
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

chargerEnv(process.env.CADASTRE_ENV ?? join(homedir(), '.config/cadastre/cadastre.env'));

function lireVersion() {
  try {
    return readFileSync(join(racine, 'VERSION'), 'utf8').trim();
  } catch {
    return JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8')).version;
  }
}

export const config = {
  racine,
  version: lireVersion(),
  port: Number(process.env.CADASTRE_PORT ?? 8793),
  hote: process.env.CADASTRE_HOTE ?? '0.0.0.0',
  // Facultatif : sans catalogue, la carte vient toute de la découverte.
  catalogue: process.env.CADASTRE_CATALOGUE ?? (existsSync('/etc/cadastre/catalogue.yaml') ? '/etc/cadastre/catalogue.yaml' : join(racine, 'catalogue/catalogue.yaml')),
  donnees: process.env.CADASTRE_DONNEES ?? join(racine, '.donnees'),
  pve: {
    url: process.env.PVE_URL ?? 'https://127.0.0.1:8006',
    // Forme « utilisateur@royaume!jeton=secret ». Un jeton PVEAuditor suffit.
    jeton: process.env.PVE_TOKEN ?? '',
    ca: process.env.PVE_CA ?? '',
  },
  // Vide : l'API Traefik est cherchée par la découverte.
  traefik: process.env.TRAEFIK_API ?? '',
  // Préfixe des dépôts cités par `depot:` au catalogue (ex. http://gitea.lan:3000).
  depotBase: (process.env.CADASTRE_DEPOT_BASE ?? '').replace(/\/$/, ''),
  // Intervalles en secondes.
  rythme: {
    pve: Number(process.env.RYTHME_PVE ?? 15),
    ip: Number(process.env.RYTHME_IP ?? 300),
    sondes: Number(process.env.RYTHME_SONDES ?? 30),
    traefik: Number(process.env.RYTHME_TRAEFIK ?? 60),
    decouverte: Number(process.env.RYTHME_DECOUVERTE ?? 600),
  },
};
