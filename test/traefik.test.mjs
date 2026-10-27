import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainesDe, cibleDe } from '../server/traefik.mjs';

test('domainesDe lit les Host() d’une règle', () => {
  assert.deepEqual(domainesDe('Host(`example.org`) || Host(`www.example.org`)'), ['example.org', 'www.example.org']);
  assert.deepEqual(domainesDe('HostSNI(`*`)'), []);
});

test('cibleDe lit une URL HTTP ou une adresse TCP', () => {
  assert.deepEqual(cibleDe({ url: 'http://192.168.1.46' }), { ip: '192.168.1.46', port: 80, texte: '192.168.1.46:80' });
  assert.deepEqual(cibleDe({ url: 'http://192.168.1.22/' }).texte, '192.168.1.22:80');
  assert.deepEqual(cibleDe({ address: '192.168.1.47:25568' }).texte, '192.168.1.47:25568');
});
