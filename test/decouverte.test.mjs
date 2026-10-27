import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconnaitre } from '../server/signatures.mjs';
import { resumer, premiereLigne } from '../server/decouverte.mjs';
import { fusionnerGroupes, fusionnerPorts } from '../server/etat.mjs';
import { extraireTitre } from '../server/sonde.mjs';
import { ipDuLan } from '../server/pve.mjs';

test('reconnaître par le titre avant le port', () => {
  assert.equal(reconnaitre(3000, { titre: 'Gitea: Git with a cup of tea', serveur: null }).nom, 'Gitea');
  assert.equal(reconnaitre(8096, { titre: 'Jellyfin', serveur: null }).groupe, 'medias');
  assert.equal(reconnaitre(5432, null).nom, 'PostgreSQL');
  assert.equal(reconnaitre(4321, { titre: 'Mon site', serveur: 'nginx' }).faible, true);
  assert.equal(reconnaitre(4321, null), null);
});

test('un proxy reste un proxy malgré les ports qu’il relaie', () => {
  const r = resumer({
    services: [
      { port: 8080, nom: 'Traefik', groupe: 'reseau', role: 'Reverse proxy', prioritaire: true },
      { port: 25565, nom: 'Minecraft', groupe: 'jeux', role: 'Serveur Minecraft' },
      { port: 25566, nom: 'Minecraft', groupe: 'jeux', role: 'Serveur Minecraft' },
    ],
  });
  assert.equal(r.groupe, 'reseau');
  assert.equal(r.role, 'Traefik · Minecraft');
});

test('un service seul donne son rôle, un titre faible sert de secours', () => {
  assert.equal(resumer({ services: [{ port: 3000, nom: 'Gitea', groupe: 'dev', role: 'Dépôts de code' }] }).role, 'Dépôts de code');
  const faible = resumer({ services: [{ port: 80, nom: 'Le musée', faible: true, titre: 'Le musée', url: 'http://x/' }] });
  assert.equal(faible.role, null);
  assert.equal(faible.titre, 'Le musée');
});

test('première ligne des notes, débarrassée du HTML et du Markdown', () => {
  assert.equal(premiereLigne("<div align='center'><img src='x.png'/></div>\n\n# Mon **serveur** web\nsuite"), 'Mon serveur web');
  assert.equal(premiereLigne('Cadastre : la carte des services'), 'Cadastre');
  assert.equal(premiereLigne(''), null);
  assert.ok(premiereLigne('x'.repeat(100)).length <= 44);
});

test('fusions : le catalogue l’emporte', () => {
  const g = fusionnerGroupes([{ id: 'jeux', nom: 'Jeux', couleur: '#1' }], [{ id: 'jeux', nom: 'Ludothèque' }, { id: 'perso', nom: 'Perso' }]);
  assert.deepEqual(g.map((x) => x.nom), ['Ludothèque', 'Perso']);
  assert.equal(g[0].couleur, '#1');
  const p = fusionnerPorts([{ port: 80, nom: 'site' }], [{ port: 80, nom: 'Web :80' }, { port: 22, nom: 'SSH' }]);
  assert.deepEqual(p.map((x) => x.nom), ['site', 'SSH']);
});

test('titre HTML et IP du LAN', () => {
  assert.equal(extraireTitre('<html><title>\n  AdGuard &amp; co </title>'), 'AdGuard & co');
  assert.equal(ipDuLan('192.168.1.5'), true);
  assert.equal(ipDuLan('172.17.0.1'), false);
  assert.equal(ipDuLan('100.101.1.2'), false);
});
