// Le serveur du Cadastre : sert la page, la carte (/api/carte) et garde la
// disposition des nœuds (/api/positions). Lecture seule sur le homelab.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { config } from './config.mjs';
import { creerEtat } from './etat.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

// Les bibliothèques du navigateur viennent de node_modules, sans étape de build.
const VENDOR = {
  'cytoscape.js': 'cytoscape/dist/cytoscape.min.js',
};

const etat = creerEtat(config);
const fichierPositions = join(config.donnees, 'positions.json');

// { manuel, positions } : manuel quand quelqu'un a déplacé des cartes à la main.
async function lirePositions() {
  try {
    const j = JSON.parse(await readFile(fichierPositions, 'utf8'));
    return j.positions ? j : { manuel: true, positions: j };
  } catch {
    return { manuel: false, positions: {} };
  }
}

function json(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corps));
}

async function lireCorps(req, max = 128 * 1024) {
  let taille = 0;
  const morceaux = [];
  for await (const m of req) {
    taille += m.length;
    if (taille > max) throw new Error('trop gros');
    morceaux.push(m);
  }
  return Buffer.concat(morceaux).toString('utf8');
}

async function servirFichier(res, chemin) {
  try {
    const contenu = await readFile(chemin);
    res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(contenu);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://cadastre');
  try {
    if (url.pathname === '/api/carte' && req.method === 'GET') {
      return json(res, 200, { ...etat.carte(), ...(await lirePositions()) });
    }
    if (url.pathname === '/api/positions' && req.method === 'PUT') {
      const corps = JSON.parse(await lireCorps(req));
      const propres = {};
      for (const [id, p] of Object.entries(corps?.positions ?? {}))
        if (typeof id === 'string' && id.length < 120 && Number.isFinite(p?.x) && Number.isFinite(p?.y))
          propres[id] = { x: Math.round(p.x), y: Math.round(p.y) };
      await mkdir(config.donnees, { recursive: true });
      const tmp = `${fichierPositions}.tmp`;
      await writeFile(tmp, JSON.stringify({ manuel: !!corps.manuel, positions: propres }, null, 1));
      await rename(tmp, fichierPositions);
      return json(res, 200, { enregistre: Object.keys(propres).length });
    }
    if (url.pathname === '/api/decouverte' && req.method === 'POST') {
      etat.relancerDecouverte().catch((e) => console.error(e));
      return json(res, 202, { lancee: true });
    }
    if (url.pathname === '/api/sante') return json(res, 200, { ok: true, version: config.version, erreurs: etat.etat.erreurs });
    if (url.pathname.startsWith('/vendor/')) {
      const cible = VENDOR[url.pathname.slice('/vendor/'.length)];
      if (!cible) return res.writeHead(404).end();
      return servirFichier(res, join(config.racine, 'node_modules', cible));
    }
    if (req.method !== 'GET') return res.writeHead(405).end();
    const relatif = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    return servirFichier(res, join(config.racine, 'public', relatif));
  } catch (e) {
    return json(res, 400, { erreur: e.message });
  }
});

etat.demarrer();
serveur.listen(config.port, config.hote, () => console.log(`Cadastre ${config.version} sur http://${config.hote}:${config.port}`));
