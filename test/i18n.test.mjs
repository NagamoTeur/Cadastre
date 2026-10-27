import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anomalie, traduire, traduireCarte, langueDe } from '../server/i18n.mjs';
import { GROUPES_DEFAUT } from '../server/decouverte.mjs';
import { SIGNATURES } from '../server/signatures.mjs';

test('la langue demandée, le français par défaut', () => {
  assert.equal(langueDe('en-US,en;q=0.9'), 'en');
  assert.equal(langueDe('fr'), 'fr');
  assert.equal(langueDe('de-DE'), 'fr');
  assert.equal(langueDe(undefined), 'fr');
});

test('anomalies dans les deux langues', () => {
  assert.deepEqual(anomalie('en', 'disque', { nom: 'forge', pc: 76 }), { titre: 'forge: disk at 76%', detail: 'Worth watching.' });
  assert.equal(anomalie('fr', 'disque', { nom: 'forge', pc: 76 }).titre, 'forge : disque à 76 %');
  assert.match(anomalie('en', 'routeOrpheline', { domaines: 'a.example.org', cible: '1.2.3.4:80', muette: true }).detail, /does not answer/);
});

test('phrases fixes, rôles composés et motifs', () => {
  assert.equal(traduire('en', 'Médias'), 'Media');
  assert.equal(traduire('en', 'Serveur Minecraft 1.21.1'), 'Minecraft server 1.21.1');
  assert.equal(traduire('en', 'Gitea · Partage SMB'), 'Gitea · SMB share');
  assert.equal(traduire('en', 'Mon rôle maison'), 'Mon rôle maison');
  assert.equal(traduire('fr', 'Médias'), 'Médias');
});

test('chaque quartier et chaque rôle d’empreinte a son anglais', () => {
  for (const g of GROUPES_DEFAUT) assert.notEqual(traduire('en', g.nom), g.nom);
  const manquants = [...new Set(SIGNATURES.map((s) => s.role))].filter((r) => r && traduire('en', r) === r && !/^(Reverse proxy|VPN|Wiki|DNS|Budget|Cache|Documents|Photos|Administration)$/.test(r));
  assert.deepEqual(manquants, []);
});

test('traduire une carte ne touche pas aux objets partagés', () => {
  const carte = { groupes: GROUPES_DEFAUT, typesLiens: {}, liens: [], noeuds: [{ role: 'Rôle inconnu', ports: [{ nom: 'Partage SMB' }] }] };
  const en = traduireCarte('en', carte);
  assert.equal(en.noeuds[0].role, 'Unknown role');
  assert.equal(en.noeuds[0].ports[0].nom, 'SMB share');
  assert.equal(GROUPES_DEFAUT[0].nom, 'Réseau et accès');
  assert.equal(carte.noeuds[0].role, 'Rôle inconnu');
});
