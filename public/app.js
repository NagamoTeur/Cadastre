// La carte du Cadastre : Cytoscape dessine, /api/carte nourrit, la fiche raconte.
/* global cytoscape */
import { t, langue, basculerLangue, traduirePage } from './i18n.js';

const RAFRAICHIR_MS = 15000;
const FOND_NOEUD = '#131e2b';
const BORDS = {
  ok: '#3f8f63',
  externe: '#46576b',
  attention: '#f0b44c',
  alerte: '#ef6461',
  eteint: '#ef6461',
  inconnu: '#8f9aa6',
};

const $ = (s) => document.querySelector(s);
const echapper = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const etat = {
  carte: null,
  selection: null,
  groupesCaches: new Set(lireLocal('groupesCaches', [])),
  typesCaches: new Set(lireLocal('typesCaches', [])),
  signature: '',
};

function lireLocal(cle, defaut) {
  try {
    return JSON.parse(localStorage.getItem(`cadastre.${cle}`)) ?? defaut;
  } catch {
    return defaut;
  }
}
function ecrireLocal(cle, valeur) {
  try {
    localStorage.setItem(`cadastre.${cle}`, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : les filtres ne survivront pas au rechargement.
  }
}

// ── Mise en forme ───────────────────────────────────────────────
const go = (o) => (o / 1024 ** 3).toFixed(o >= 10 * 1024 ** 3 ? 0 : 1);
const GO = t('go');
function duree(s) {
  if (!s) return '—';
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return j ? t('dureeJ', { j, h }) : h ? t('dureeH', { h, m }) : t('dureeM', { m });
}
function ilYa(ts) {
  if (!ts) return t('jamais');
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? t('ilYaS', { n: s }) : t('ilYaMin', { n: Math.round(s / 60) });
}

// ── État d'un nœud : sert à sa bordure et à son halo ─────────────
function niveauDe(noeud, anomalies) {
  const siennes = anomalies.filter((a) => a.noeud === noeud.id);
  if (noeud.groupe === 'orphelin') return 'alerte';
  if (noeud.direct && noeud.direct.statut !== 'running') return 'eteint';
  if (siennes.some((a) => a.niveau === 'alerte')) return 'alerte';
  if (siennes.some((a) => a.niveau === 'attention')) return 'attention';
  if (noeud.groupe === 'inconnu') return 'inconnu';
  return noeud.type === 'externe' ? 'externe' : 'ok';
}

function sousTitre(n) {
  if (n.type === 'externe') return n.role ?? '';
  const id = n.vmid ? `${n.type} ${n.vmid}` : t(n.type === 'hôte' ? 'typeHote' : 'typeRoute');
  return `${id} · ${n.role ?? ''}`;
}

// ── Cytoscape ───────────────────────────────────────────────────
const cy = cytoscape({
  container: $('#carte'),
  minZoom: 0.2,
  maxZoom: 2.5,
  wheelSensitivity: 0.25,
  boxSelectionEnabled: false,
  style: [
    {
      selector: 'node.service',
      style: {
        shape: 'round-rectangle',
        width: 178,
        height: 54,
        'background-fill': 'linear-gradient',
        'background-gradient-direction': 'to-right',
        'background-gradient-stop-colors': (e) => `${e.data('couleur')} ${e.data('couleur')} ${FOND_NOEUD} ${FOND_NOEUD}`,
        'background-gradient-stop-positions': '0 3 3 100',
        'border-width': 1.5,
        'border-color': (e) => BORDS[e.data('niveau')] ?? BORDS.ok,
        'border-style': (e) => (e.data('niveau') === 'eteint' || e.data('groupe') === 'orphelin' ? 'dashed' : 'solid'),
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': 158,
        'text-valign': 'center',
        'text-halign': 'center',
        'line-height': 1.35,
        color: '#e4e9f0',
        'font-family': 'Inter, system-ui, sans-serif',
        'font-size': 12,
        'text-events': 'no',
        'transition-property': 'opacity, border-color',
        'transition-duration': 180,
      },
    },
    {
      selector: 'node.service[niveau = "alerte"], node.service[niveau = "eteint"]',
      style: { 'underlay-color': '#ef6461', 'underlay-opacity': 0.16, 'underlay-padding': 7, 'underlay-shape': 'round-rectangle' },
    },
    {
      selector: 'node.service[niveau = "attention"]',
      style: { 'underlay-color': '#f0b44c', 'underlay-opacity': 0.1, 'underlay-padding': 6, 'underlay-shape': 'round-rectangle' },
    },
    {
      selector: 'node.hote',
      style: { width: 200, height: 62, 'font-size': 13, 'border-width': 2, 'border-color': '#e8c27a' },
    },
    {
      selector: 'node.quartier',
      style: {
        shape: 'round-rectangle',
        'background-color': 'data(couleur)',
        'background-opacity': 0.045,
        'border-width': 1,
        'border-style': 'dashed',
        'border-color': 'data(couleur)',
        'border-opacity': 0.45,
        padding: 22,
        label: 'data(label)',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -6,
        color: 'data(couleur)',
        'font-family': 'Inter, system-ui, sans-serif',
        'font-size': 11,
        'font-weight': 600,
        'text-transform': 'uppercase',
        'text-opacity': 0.85,
        'transition-property': 'opacity',
        'transition-duration': 180,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.4,
        'curve-style': 'bezier',
        'line-color': 'data(couleur)',
        'target-arrow-color': 'data(couleur)',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        opacity: 0.5,
        'line-style': (e) => (e.data('type') === 'distant' || e.data('orphelin') ? 'dashed' : 'solid'),
        'line-dash-pattern': [6, 4],
        'transition-property': 'opacity, width',
        'transition-duration': 180,
      },
    },
    {
      selector: 'edge.montre',
      style: {
        opacity: 0.95,
        width: 2.2,
        label: 'data(label)',
        'font-size': 10,
        'font-family': 'Inter, system-ui, sans-serif',
        color: '#e4e9f0',
        'text-background-color': '#0c131c',
        'text-background-opacity': 0.9,
        'text-background-padding': 3,
        'text-background-shape': 'round-rectangle',
        'text-rotation': 'autorotate',
        'z-index': 10,
      },
    },
    { selector: '.pale', style: { opacity: 0.14 } },
    { selector: 'edge.pale', style: { opacity: 0.05 } },
    { selector: 'node.service.trouve', style: { 'border-width': 3, 'border-color': '#e8c27a' } },
    { selector: 'node.service:selected', style: { 'border-width': 3, 'border-color': '#e8c27a', 'underlay-color': '#e8c27a', 'underlay-opacity': 0.14, 'underlay-padding': 8 } },
    { selector: '.cache', style: { display: 'none' } },
  ],
});

// ── Construire les éléments à partir de la carte ────────────────
function elements(carte) {
  const groupes = new Map(carte.groupes.map((g) => [g.id, g]));
  const presents = new Set(carte.noeuds.map((n) => n.groupe));
  const els = [];
  for (const g of carte.groupes)
    if (presents.has(g.id)) els.push({ group: 'nodes', data: { id: `g:${g.id}`, label: g.nom, couleur: g.couleur }, classes: 'quartier' });
  for (const n of carte.noeuds) {
    const g = groupes.get(n.groupe);
    els.push({
      group: 'nodes',
      data: {
        id: n.id,
        parent: g ? `g:${g.id}` : undefined,
        label: `${n.nom}\n${sousTitre(n)}`,
        couleur: g?.couleur ?? '#8a97a8',
        groupe: n.groupe,
        niveau: niveauDe(n, carte.anomalies),
      },
      classes: n.type === 'hôte' ? 'service hote' : 'service',
      position: carte.positions?.[n.id],
    });
  }
  for (const l of carte.liens) {
    els.push({
      group: 'edges',
      data: {
        id: l.id,
        source: l.de,
        target: l.vers,
        type: l.type,
        label: l.label ?? carte.typesLiens[l.type]?.nom ?? l.type,
        couleur: carte.typesLiens[l.type]?.couleur ?? '#a6b3c4',
        orphelin: !!l.orphelin,
      },
    });
  }
  return els;
}

function signatureDe(carte) {
  return [...carte.noeuds.map((n) => `${n.id}@${n.groupe}`), ...carte.liens.map((l) => `${l.de}>${l.vers}:${l.type}`)].sort().join('|');
}

// Le plan parcellaire : chaque quartier est une parcelle rangée en grille, les
// parcelles sont posées par rangées. Plus lisible qu'une disposition en force.
// Ordre de lecture des quartiers : l'extérieur, l'infrastructure, puis les services.
// Les quartiers inconnus (ajoutés au catalogue) passent à la fin.
const ORDRE = ['reseau', 'hote', 'veille', 'dev', 'stockage', 'donnees', 'clients', 'orphelin', 'jeux', 'medias', 'domotique', 'apps', 'ia', 'autres'];
const CASE = { l: 200, h: 78 };
const ECART = 90;

function planParcellaire() {
  const parGroupe = new Map();
  cy.nodes('.service').forEach((n) => {
    const g = n.data('groupe');
    if (!parGroupe.has(g)) parGroupe.set(g, []);
    parGroupe.get(g).push(n);
  });
  const parcelle = (g) => {
    const noeuds = parGroupe.get(g);
    const colonnes = g === 'dehors' ? Math.ceil(noeuds.length / 2) : Math.min(3, Math.ceil(Math.sqrt(noeuds.length)));
    return { g, noeuds, colonnes, l: colonnes * CASE.l, h: Math.ceil(noeuds.length / colonnes) * CASE.h };
  };
  const suite = [...ORDRE.filter((g) => parGroupe.has(g)), ...[...parGroupe.keys()].filter((g) => g !== 'dehors' && !ORDRE.includes(g))].map(parcelle);
  // Rangées remplies jusqu'à une largeur qui garde la carte à peu près en 16/10.
  const aire = suite.reduce((t, p) => t + (p.l + ECART) * (p.h + ECART), 0);
  const limite = Math.max(1800, Math.sqrt(aire * 1.6));
  const rangees = parGroupe.has('dehors') ? [[parcelle('dehors')]] : [];
  let courante = [];
  let largeur = 0;
  for (const p of suite) {
    if (courante.length && largeur + p.l > limite) {
      rangees.push(courante);
      courante = [];
      largeur = 0;
    }
    courante.push(p);
    largeur += p.l + ECART;
  }
  if (courante.length) rangees.push(courante);

  const positions = {};
  let y = 0;
  for (const parcelles of rangees) {
    const largeur = parcelles.reduce((t, p) => t + p.l, 0) + ECART * (parcelles.length - 1);
    const hauteur = Math.max(...parcelles.map((p) => p.h));
    let x = -largeur / 2;
    for (const p of parcelles) {
      p.noeuds.forEach((n, i) => {
        positions[n.id()] = {
          x: x + (i % p.colonnes) * CASE.l + CASE.l / 2,
          y: y + Math.floor(i / p.colonnes) * CASE.h + CASE.h / 2,
        };
      });
      x += p.l + ECART;
    }
    y += hauteur + ECART;
  }
  return positions;
}

function disposer({ toutRecalculer = false, recadrer = true } = {}) {
  const services = cy.nodes('.service');
  const connues = etat.carte.positions ?? {};
  const manquants = services.filter((n) => !connues[n.id()]);
  if (toutRecalculer || manquants.length === services.length) {
    const plan = planParcellaire();
    cy.batch(() => services.forEach((n) => n.position(plan[n.id()])));
    enregistrerPositions();
  } else if (manquants.nonempty()) {
    // Un nouveau venu se range à droite de sa parcelle, ou sous la carte.
    manquants.forEach((n) => {
      const voisins = services.filter((v) => v.data('groupe') === n.data('groupe') && connues[v.id()]);
      const bb = (voisins.nonempty() ? voisins : services.filter((v) => connues[v.id()])).boundingBox();
      n.position(voisins.nonempty() ? { x: bb.x2 + CASE.l / 2 + 10, y: bb.y1 + CASE.h / 2 } : { x: bb.x1 + CASE.l / 2, y: bb.y2 + ECART + CASE.h / 2 });
      connues[n.id()] = n.position();
    });
    enregistrerPositions();
  }
  if (recadrer) cadrer();
}

// Cadre la carte dans la place laissée libre par la légende et le bandeau.
function cadrer(animer = false) {
  const eles = cy.elements(':visible');
  if (eles.empty()) return;
  const etroit = window.innerWidth <= 760;
  const zone = { x: etroit ? 16 : 250, y: 70, l: cy.width() - (etroit ? 32 : 270), h: cy.height() - 90 };
  if (!$('#fiche').hidden && !etroit) zone.l -= $('#fiche').offsetWidth + 14;
  const bb = eles.boundingBox();
  const zoom = Math.min(1.3, Math.max(cy.minZoom(), Math.min(zone.l / bb.w, zone.h / bb.h)));
  const pan = { x: zone.x + zone.l / 2 - zoom * (bb.x1 + bb.w / 2), y: zone.y + zone.h / 2 - zoom * (bb.y1 + bb.h / 2) };
  if (animer) cy.animate({ zoom, pan, duration: 350 });
  else cy.viewport({ zoom, pan });
}

let minuterieSauvegarde;
function enregistrerPositions() {
  clearTimeout(minuterieSauvegarde);
  minuterieSauvegarde = setTimeout(async () => {
    const positions = {};
    cy.nodes('.service').forEach((n) => (positions[n.id()] = n.position()));
    etat.carte.positions = positions;
    await fetch('api/positions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manuel: etat.manuel, positions }) }).catch(() => {});
  }, 400);
}

// ── Mise à jour en direct ───────────────────────────────────────
async function charger() {
  let carte;
  try {
    const r = await fetch(`api/carte?lang=${langue}`, { cache: 'no-store' });
    carte = await r.json();
  } catch {
    $('#maj').textContent = t('serveurInjoignable');
    $('#maj').classList.add('vieux');
    return;
  }
  const premiere = !etat.carte;
  if (premiere) etat.manuel = !!carte.manuel;
  // Les positions locales font foi : on ne les écrase pas avec celles du serveur.
  if (!premiere) carte.positions = etat.carte.positions;
  etat.carte = carte;
  const signature = signatureDe(carte);

  if (premiere || signature !== etat.signature) {
    // Sans déplacement à la main, le plan se recalcule à chaque changement (la découverte
    // range les machines au fil de l'eau). Sinon, seules les machines qui ont changé de
    // quartier, ou qui arrivent, sont replacées.
    const anciennes = {};
    const groupes = {};
    cy.nodes('.service').forEach((n) => {
      anciennes[n.id()] = { ...n.position() };
      groupes[n.id()] = n.data('groupe');
    });
    if (!etat.manuel) carte.positions = {};
    else {
      carte.positions = { ...carte.positions, ...anciennes };
      for (const n of carte.noeuds) if (groupes[n.id] && groupes[n.id] !== n.groupe) delete carte.positions[n.id];
    }
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements(carte));
    });
    etat.signature = signature;
    appliquerFiltres();
    disposer({ recadrer: premiere || !etat.manuel });
  } else {
    cy.batch(() => {
      for (const n of carte.noeuds) {
        const el = cy.getElementById(n.id);
        el.data({ label: `${n.nom}\n${sousTitre(n)}`, niveau: niveauDe(n, carte.anomalies) });
      }
    });
  }

  dessinerBandeau();
  dessinerLegende();
  dessinerAnomalies();
  if (etat.selection) {
    if (carte.noeuds.some((n) => n.id === etat.selection)) dessinerFiche(etat.selection, { garderDefilement: true });
    else fermerFiche();
  }
  if (premiere) lireAncre();
}

// ── Bandeau ─────────────────────────────────────────────────────
function dessinerBandeau() {
  const h = etat.carte.noeuds.find((n) => n.id === 'proxmox')?.direct;
  const invites = etat.carte.noeuds.filter((n) => n.vmid);
  const allumes = invites.filter((n) => n.direct?.statut === 'running').length;
  $('#hote').innerHTML = h
    ? `<b>PVE ${echapper(h.version?.split('/')[1] ?? '')}</b> · ${t('invitesAllumes', { allumes, total: invites.length })} · CPU <b>${Math.round(h.cpu * 100)} %</b> · RAM <b>${go(h.memoire)}/${go(h.memoireMax)} ${GO}</b>`
    : t('proxmoxIndisponible');
  const age = Date.now() - (etat.carte.majPve || etat.carte.genere);
  $('#maj').textContent = t('maj', { quand: ilYa(etat.carte.majPve || etat.carte.genere) });
  $('#maj').title = t('majDetail', {
    version: etat.carte.reglages?.version ?? '',
    pve: ilYa(etat.carte.majPve),
    decouverte: etat.carte.decouverteEnCours ? t('enCours') : ilYa(etat.carte.majDecouverte),
    proxy: etat.carte.reglages?.proxy,
  });
  const bouton = $('#redecouvrir');
  bouton.disabled = etat.carte.decouverteEnCours;
  bouton.textContent = etat.carte.decouverteEnCours ? t('decouverteEnCours') : t('relancer');
  $('#maj').classList.toggle('vieux', age > 90000);
}

// ── Légende et filtres ──────────────────────────────────────────
function dessinerLegende() {
  const { carte } = etat;
  const parGroupe = new Map();
  for (const n of carte.noeuds) parGroupe.set(n.groupe, (parGroupe.get(n.groupe) ?? 0) + 1);
  $('#groupes').innerHTML = carte.groupes
    .filter((g) => parGroupe.has(g.id))
    .map(
      (g) => `<li><button type="button" data-groupe="${echapper(g.id)}" aria-pressed="${!etat.groupesCaches.has(g.id)}">
        <span class="pastille" style="background:${echapper(g.couleur)}"></span>${echapper(g.nom)}<span class="nb">${parGroupe.get(g.id)}</span></button></li>`,
    )
    .join('');
  const parType = new Map();
  for (const l of carte.liens) parType.set(l.type, (parType.get(l.type) ?? 0) + 1);
  $('#types').innerHTML = Object.entries(carte.typesLiens)
    .filter(([id]) => parType.has(id))
    .map(
      ([id, t]) => `<li><button type="button" data-type="${echapper(id)}" aria-pressed="${!etat.typesCaches.has(id)}">
        <span class="trait" style="border-color:${echapper(t.couleur)}${id === 'distant' ? ';border-top-style:dashed' : ''}"></span>${echapper(t.nom)}<span class="nb">${parType.get(id)}</span></button></li>`,
    )
    .join('');
}

function appliquerFiltres() {
  cy.batch(() => {
    cy.nodes('.quartier').forEach((q) => q.toggleClass('cache', etat.groupesCaches.has(q.id().slice(2))));
    cy.nodes('.service').forEach((n) => n.toggleClass('cache', etat.groupesCaches.has(n.data('groupe'))));
    cy.edges().forEach((e) => e.toggleClass('cache', etat.typesCaches.has(e.data('type'))));
  });
}

$('#legende').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-groupe], button[data-type]');
  if (!b) return;
  const [ensemble, cle, valeur] = b.dataset.groupe
    ? [etat.groupesCaches, 'groupesCaches', b.dataset.groupe]
    : [etat.typesCaches, 'typesCaches', b.dataset.type];
  ensemble.has(valeur) ? ensemble.delete(valeur) : ensemble.add(valeur);
  ecrireLocal(cle, [...ensemble]);
  b.setAttribute('aria-pressed', String(!ensemble.has(valeur)));
  appliquerFiltres();
});

$('#reorganiser').addEventListener('click', async () => {
  etat.carte.positions = {};
  etat.manuel = false;
  disposer({ toutRecalculer: true });
});
$('#cadrer').addEventListener('click', () => cadrer(true));
$('#redecouvrir').addEventListener('click', async () => {
  $('#redecouvrir').disabled = true;
  $('#redecouvrir').textContent = t('decouverteEnCours');
  await fetch('api/decouverte', { method: 'POST' }).catch(() => {});
  setTimeout(charger, 4000);
});

// ── Anomalies ───────────────────────────────────────────────────
function dessinerAnomalies() {
  const { anomalies } = etat.carte;
  const nb = (niv) => anomalies.filter((a) => a.niveau === niv).length;
  const compteurs = ['alerte', 'attention', 'info'].filter(nb).map((n) => `<span class="compteur ${n}">${nb(n)}</span>`);
  $('#compteurs').innerHTML = compteurs.length ? compteurs.join('') : `<span class="compteur calme">${t('toutVaBien')}</span>`;
  $('#anomalies-liste').innerHTML = anomalies
    .map(
      (a) => `<li><button type="button" ${a.noeud ? `data-noeud="${echapper(a.noeud)}"` : 'disabled'}>
        <span class="point ${a.niveau}"></span><span class="titre">${echapper(a.titre)}</span><span class="detail">${echapper(a.detail)}</span></button></li>`,
    )
    .join('');
}
$('#anomalies-liste').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-noeud]');
  if (b) selectionner(b.dataset.noeud, { centrer: true });
});
$('#anomalies-tete').addEventListener('click', () => {
  const a = $('#anomalies');
  const replie = a.toggleAttribute('data-replie');
  $('#anomalies-tete').setAttribute('aria-expanded', String(!replie));
  ecrireLocal('anomaliesRepliees', replie);
});
if (lireLocal('anomaliesRepliees', false)) $('#anomalies').setAttribute('data-replie', '');

// ── Survol et sélection ─────────────────────────────────────────
function eclairer(noeud) {
  cy.batch(() => {
    cy.elements().removeClass('montre');
    if (!noeud) {
      cy.elements().removeClass('pale');
      return;
    }
    const voisinage = noeud.closedNeighborhood();
    cy.elements().not(voisinage).not(voisinage.parents()).addClass('pale');
    voisinage.removeClass('pale');
    voisinage.parents().removeClass('pale');
    noeud.connectedEdges().addClass('montre');
  });
}

cy.on('mouseover', 'node.service', (ev) => {
  if (!etat.selection) eclairer(ev.target);
  document.body.style.cursor = 'pointer';
});
cy.on('mouseout', 'node.service', () => {
  if (!etat.selection) eclairer(null);
  document.body.style.cursor = '';
});
cy.on('tap', 'node.service', (ev) => selectionner(ev.target.id()));
cy.on('tap', (ev) => {
  if (ev.target === cy) fermerFiche();
});
cy.on('dragfree', 'node', () => {
  etat.manuel = true;
  enregistrerPositions();
});

const bulle = $('#bulle');
cy.on('mouseover', 'edge', (ev) => {
  const e = ev.target;
  const nom = (id) => etat.carte.noeuds.find((n) => n.id === id)?.nom ?? id;
  const type = etat.carte.typesLiens[e.data('type')]?.nom ?? e.data('type');
  bulle.innerHTML = `<b>${echapper(nom(e.data('source')))}</b> → <b>${echapper(nom(e.data('target')))}</b><br>${echapper(type)}${e.data('label') && e.data('label') !== type ? ` · ${echapper(e.data('label'))}` : ''}`;
  bulle.hidden = false;
  e.addClass('montre');
});
cy.on('mousemove', 'edge', (ev) => {
  bulle.style.left = `${ev.originalEvent.clientX + 14}px`;
  bulle.style.top = `${ev.originalEvent.clientY + 14}px`;
});
cy.on('mouseout', 'edge', (ev) => {
  bulle.hidden = true;
  const sel = etat.selection && cy.getElementById(etat.selection);
  if (!sel || !sel.connectedEdges().contains(ev.target)) ev.target.removeClass('montre');
});

function selectionner(id, { centrer = false } = {}) {
  const el = cy.getElementById(id);
  if (el.empty()) return;
  etat.selection = id;
  cy.nodes().unselect();
  el.select();
  eclairer(el);
  if (centrer || !estVisible(el)) cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 0.9), duration: 350 });
  dessinerFiche(id);
  history.replaceState(null, '', `#${encodeURIComponent(id)}`);
}

function estVisible(el) {
  const bb = el.renderedBoundingBox();
  const fiche = $('#fiche').hidden ? 0 : $('#fiche').offsetWidth + 20;
  return bb.x1 > 0 && bb.y1 > 60 && bb.x2 < cy.width() - fiche && bb.y2 < cy.height();
}

function fermerFiche() {
  etat.selection = null;
  cy.nodes().unselect();
  eclairer(null);
  $('#fiche').hidden = true;
  history.replaceState(null, '', location.pathname);
}
$('#fermer').addEventListener('click', fermerFiche);

function lireAncre() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && id !== etat.selection) selectionner(id, { centrer: true });
}
window.addEventListener('hashchange', lireAncre);

// ── La fiche ────────────────────────────────────────────────────
function jauge(nom, part, texte) {
  const pc = Math.max(0, Math.min(1, part || 0));
  const cl = pc >= 0.9 ? 'plein' : pc >= 0.75 ? 'haut' : '';
  return `<div class="jauge"><span>${nom}</span><span class="barre"><i class="${cl}" style="width:${(pc * 100).toFixed(1)}%"></i></span><span class="val">${texte}</span></div>`;
}

function boutonCopier(texte) {
  return `<button type="button" class="copier" data-copier="${echapper(texte)}">${t('copier')}</button>`;
}

function commandesDe(n) {
  const cmds = [];
  if (n.ssh) cmds.push(n.ssh);
  if (n.type === 'CT') cmds.push(`pct enter ${n.vmid}`);
  if (n.type === 'VM') cmds.push(`qm terminal ${n.vmid}`);
  return cmds;
}

function lienDepot(depot) {
  if (!depot) return '';
  const base = etat.carte.reglages?.depotBase;
  const url = /^https?:\/\//.test(depot) ? depot : base ? `${base}/${depot}` : null;
  return url ? `<a href="${echapper(url)}" target="_blank" rel="noopener">${echapper(t('depot', { nom: depot.split('/').pop() }))}</a>` : '';
}

// Le bout de catalogue qui décrit une machine découverte, prêt à coller.
function yamlPour(n) {
  const q = (t) => (/^[\w .,'()+-]*$/.test(t) && !/^[\d-]/.test(t) ? t : JSON.stringify(t));
  const lignes = [
    `  - id: ${n.nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `invite-${n.vmid}`}`,
    `    vmid: ${n.vmid}`,
    `    nom: ${q(n.nom)}`,
    `    groupe: ${n.groupe}`,
    `    role: ${q(n.role ?? t('aDecrire'))}`,
    '    description: >',
    `      ${n.notesPve ? n.notesPve.split('\n')[0].slice(0, 120) : t('aQuoiSert')}`,
  ];
  return lignes.join('\n');
}

function dessinerFiche(id, { garderDefilement = false } = {}) {
  const { carte } = etat;
  const n = carte.noeuds.find((x) => x.id === id);
  if (!n) return;
  const g = carte.groupes.find((x) => x.id === n.groupe);
  const d = n.direct;
  const nom = (nid) => carte.noeuds.find((x) => x.id === nid)?.nom ?? nid;
  const etiquettes = [`<span class="etiquette groupe">${echapper(g?.nom ?? n.groupe)}</span>`];
  if (n.vmid) etiquettes.push(`<span class="etiquette">${echapper(n.type)} ${n.vmid}</span>`);
  else if (n.type === 'externe') etiquettes.push(`<span class="etiquette">${t('horsProxmox')}</span>`);
  if (n.auto) etiquettes.push(`<span class="etiquette decouvert" title="${echapper(t('decouvertAide'))}">${t('decouvert')}</span>`);
  if (d) etiquettes.push(`<span class="etiquette ${d.statut === 'running' ? 'marche' : 'arret'}">${d.statut === 'running' ? t('allume') : echapper(d.statut)}</span>`);
  for (const t of d?.tags ?? []) etiquettes.push(`<span class="etiquette">#${echapper(t)}</span>`);

  const blocs = [];
  blocs.push(`<header class="fiche-tete" style="--couleur:${echapper(g?.couleur ?? '#e8c27a')}">
    <div class="etiquettes">${etiquettes.join('')}</div>
    <h1>${echapper(n.nom)}</h1>
    ${n.role ? `<p class="role">${echapper(n.role)}</p>` : ''}
  </header>`);

  const siennes = carte.anomalies.filter((a) => a.noeud === n.id);
  if (siennes.length)
    blocs.push(`<section><h2>${t('aRegarder')}</h2><ul class="anomalies-noeud">${siennes
      .map((a) => `<li><span class="point ${a.niveau}"></span><span><b>${echapper(a.titre)}</b><br><span style="color:var(--texte-2)">${echapper(a.detail)}</span></span></li>`)
      .join('')}</ul></section>`);

  if (n.description) blocs.push(`<section><p class="description">${echapper(n.description)}</p></section>`);
  if (n.notesPve) blocs.push(`<section><h2>${t('notesProxmox')}</h2><p class="notes-pve">${echapper(n.notesPve)}</p></section>`);

  if (d && d.statut === 'running') {
    const jauges = [jauge(t('cpu'), d.cpu, `${(d.cpu * 100).toFixed(1)} %${d.coeurs ? ` · ${t('coeurs', { n: d.coeurs })}` : ''}`)];
    if (d.memoireMax) jauges.push(jauge(t('memoire'), d.memoire / d.memoireMax, `${go(d.memoire)} / ${go(d.memoireMax)} ${GO}`));
    // Le disque d'une VM n'est pas mesuré par le Proxmox sans agent : on ne montre que la taille.
    if (d.disqueMax && (d.disque || n.type !== 'VM')) jauges.push(jauge(t('disque'), d.disque / d.disqueMax, `${go(d.disque)} / ${go(d.disqueMax)} ${GO}`));
    else if (d.disqueMax) jauges.push(`<div class="jauge"><span>${t('disque')}</span><span></span><span class="val">${t('alloues', { n: go(d.disqueMax) })}</span></div>`);
    blocs.push(`<section><h2>${t('enDirect')}</h2><div class="jauges">${jauges.join('')}</div>
      <div class="uptime">${t('allumeDepuis', { duree: duree(d.uptime) })}${d.charge ? ` · ${t('charge', { charge: d.charge.join(' ') })}` : ''}</div></section>`);
  }

  const adresses = [];
  if (n.ip) adresses.push(`<dt>IP</dt><dd>${echapper(n.ip)} ${boutonCopier(n.ip)}</dd>`);
  if (n.domaines?.length) adresses.push(`<dt>${t('public')}</dt><dd>${n.domaines.map(echapper).join('<br>')}</dd>`);
  if (adresses.length) blocs.push(`<section><h2>${t('adresses')}</h2><dl class="adresses">${adresses.join('')}</dl></section>`);

  if (n.sondes?.length)
    blocs.push(`<section><h2>${t('portsSondes')}</h2><ul class="ports">${n.sondes
      .map((s) => {
        const cl = s.ouvert === true ? 'ouvert' : s.ouvert === false ? 'ferme' : '';
        const ms = s.ouvert ? `${s.ms} ms` : s.ouvert === false ? t('ferme') : t('enAttente');
        return `<li><span class="etat ${cl}"></span><code>${s.port}</code><span>${echapper(s.nom ?? '')}</span><span class="ms">${ms}</span></li>`;
      })
      .join('')}</ul></section>`);

  // Routes Traefik : celles qui arrivent ici, ou toutes pour Traefik lui-même.
  const estTraefik = n.vmid === 101;
  const routes = carte.routes.filter((r) => estTraefik || r.cibles.some((c) => c.noeud === n.id || `orphelin-${c.texte}` === n.id));
  if (routes.length)
    blocs.push(`<section><h2>${estTraefik ? t('routesServies', { n: routes.length }) : t('routesVersIci')}</h2><ul class="ports">${routes
      .map((r) =>
        r.cibles
          .map((c) => {
            const cl = c.ouvert === true ? 'ouvert' : c.ouvert === false ? 'ferme' : '';
            const vers = c.noeud ? nom(c.noeud) : t('inconnu');
            return `<li><span class="etat ${cl}"></span><span>${echapper(r.domaines.join(', '))}</span><span class="ms">${echapper(estTraefik ? `→ ${vers}` : c.texte)}</span></li>`;
          })
          .join(''),
      )
      .join('')}</ul></section>`);

  if (n.liens?.length || lienDepot(n.depot))
    blocs.push(`<section><h2>${t('ouvrir')}</h2><div class="liens-ext">${(n.liens ?? [])
      .map((l) => `<a href="${echapper(l.url)}" target="_blank" rel="noopener">${echapper(l.titre)}</a>`)
      .join('')}${lienDepot(n.depot)}</div></section>`);

  const sortants = carte.liens.filter((l) => l.de === n.id);
  const entrants = carte.liens.filter((l) => l.vers === n.id);
  if (sortants.length || entrants.length) {
    const ligne = (l, sens) => {
      const autre = sens === '→' ? l.vers : l.de;
      const t = carte.typesLiens[l.type];
      return `<li><button type="button" data-aller="${echapper(autre)}"><span class="sens" style="color:${echapper(t?.couleur ?? '')}">${sens}</span><span class="qui">${echapper(nom(autre))}</span><span class="quoi">${echapper(l.label ?? t?.nom ?? '')}</span></button></li>`;
    };
    blocs.push(`<section><h2>${t('relations')}</h2><ul class="relations">${[...sortants.map((l) => ligne(l, '→')), ...entrants.map((l) => ligne(l, '←'))].join('')}</ul></section>`);
  }

  const cmds = commandesDe(n);
  if (cmds.length)
    blocs.push(`<section><h2>${t('yEntrer')}${n.ssh ? '' : t('depuisHote')}</h2>${cmds.map((c) => `<div class="commande"><code>${echapper(c)}</code>${boutonCopier(c)}</div>`).join('')}</section>`);

  const dec = n.decouvert;
  if (dec?.services?.length || dec?.minecraft) {
    const mc = dec.minecraft;
    const mcTexte = mc
      ? `<p class="mc">Minecraft ${echapper(mc.version ?? '')}${mc.joueurs !== null ? ` · ${t('joueurs', { n: mc.joueurs, max: mc.max })}` : ''}${mc.mods ? ` · ${t('mods', { n: mc.mods })}` : ''}${mc.motd ? `<br><span>${echapper(mc.motd)}</span>` : ''}</p>`
      : '';
    blocs.push(`<section><h2>${t('decouvertIlYa', { quand: ilYa(dec.quand) })}</h2>${dec.services.length ? `<p>${dec.services.map(echapper).join(' · ')}</p>` : ''}${mcTexte}</section>`);
  }

  if (n.auto && n.vmid)
    blocs.push(`<section><h2>${t('decrire')}</h2><p class="aide">${t('decrireAide', { chemin: echapper(etat.carte.reglages?.catalogue ?? t('leCatalogue')) })}</p><div class="commande yaml"><pre>${echapper(yamlPour(n))}</pre>${boutonCopier(yamlPour(n))}</div></section>`);

  if (n.notes?.length) blocs.push(`<section><h2>${t('notes')}</h2><ul class="notes">${n.notes.map((t) => `<li>${echapper(t)}</li>`).join('')}</ul></section>`);

  const fiche = $('#fiche');
  const defilement = fiche.scrollTop;
  $('#fiche-contenu').innerHTML = blocs.join('');
  fiche.hidden = false;
  if (garderDefilement) fiche.scrollTop = defilement;
  else fiche.scrollTop = 0;
}

$('#fiche').addEventListener('click', async (ev) => {
  const aller = ev.target.closest('[data-aller]');
  if (aller) return selectionner(aller.dataset.aller, { centrer: true });
  const copier = ev.target.closest('[data-copier]');
  if (copier) {
    try {
      await navigator.clipboard.writeText(copier.dataset.copier);
      copier.textContent = t('copie');
    } catch {
      copier.textContent = t('impossible');
    }
    setTimeout(() => (copier.textContent = t('copier')), 1200);
  }
});

// ── Recherche ───────────────────────────────────────────────────
function correspondances(q) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return etat.carte.noeuds.filter((n) =>
    [n.nom, n.role, n.ip, n.vmid, n.description, ...(n.domaines ?? []), ...(n.direct?.tags ?? [])]
      .filter((v) => v !== undefined && v !== null)
      .some((v) => String(v).toLowerCase().includes(t)),
  );
}

const champ = $('#recherche');
champ.addEventListener('input', () => {
  const trouves = correspondances(champ.value);
  cy.batch(() => {
    cy.nodes('.service').removeClass('trouve');
    if (!champ.value.trim()) {
      if (!etat.selection) eclairer(null);
      return;
    }
    const ids = new Set(trouves.map((n) => n.id));
    cy.elements().addClass('pale');
    cy.nodes('.service').forEach((n) => {
      if (ids.has(n.id())) n.removeClass('pale').addClass('trouve').parent().removeClass('pale');
    });
  });
});
champ.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    const [premier] = correspondances(champ.value);
    if (premier) selectionner(premier.id, { centrer: true });
  }
  if (ev.key === 'Escape') {
    champ.value = '';
    champ.dispatchEvent(new Event('input'));
    champ.blur();
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === '/' && document.activeElement !== champ) {
    ev.preventDefault();
    champ.focus();
  } else if (ev.key === 'Escape' && document.activeElement !== champ) fermerFiche();
});

// ── C'est parti ─────────────────────────────────────────────────
traduirePage();
$('#langue').addEventListener('click', basculerLangue);
charger();
setInterval(() => {
  if (!document.hidden) charger();
}, RAFRAICHIR_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) charger();
});
