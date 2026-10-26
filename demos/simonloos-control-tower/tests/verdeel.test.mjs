// Kleine test van de toewijzing over alle open ritten (src/verdeel.js): node --test tests/verdeel.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hongaars, verdeelHongaars, verdeelGretig, waardeVan, pastNog } from '../src/verdeel.js';

const rit = (id, volgorde, kandidaten) => ({ id, volgorde, kandidaten: kandidaten.map(([kid, waarde, cap]) => ({ id: kid, waarde, cap: cap || 1 })) });

test('hongaars: de som zo groot mogelijk, elke kolom een keer', () => {
  const uit = hongaars([[0.9, 0.8, 0.1], [0.9, 0.2, 0.1]]);
  assert.deepEqual(uit, [1, 0]);
});

test('twee ritten met dezelfde beste: de Hongaarse geeft de tweede rit die kandidaat, de gretige de eerste rit', () => {
  const R = [rit('A', 2, [['bram', 0.9], ['kees', 0.85]]), rit('B', 1, [['bram', 0.9], ['jan', 0.2]])];
  const h = verdeelHongaars(R); const g = verdeelGretig(R);
  assert.equal(h.get('A'), 'kees'); assert.equal(h.get('B'), 'bram');
  assert.equal(g.get('B'), 'bram'); assert.equal(g.get('A'), 'kees');
  assert.ok(waardeVan(R, h) >= waardeVan(R, g));
});

test('niemand twee keer, een charter zo vaak als hij trekkers vrij heeft', () => {
  const R = [rit('A', 1, [['ch', 0.9, 2], ['p1', 0.5]]), rit('B', 2, [['ch', 0.9, 2], ['p1', 0.5]]), rit('C', 3, [['ch', 0.9, 2], ['p1', 0.5]])];
  const h = verdeelHongaars(R);
  const tel = {}; for (const v of h.values()) tel[v] = (tel[v] || 0) + 1;
  assert.equal(tel.ch, 2); assert.equal(tel.p1, 1);
});

test('meer ritten dan kandidaten: de rit zonder kandidaat krijgt null, de rest de beste', () => {
  const R = [rit('A', 1, [['p1', 0.7]]), rit('B', 2, [['p1', 0.6]]), rit('C', 3, [])];
  const h = verdeelHongaars(R);
  assert.equal(h.get('A'), 'p1'); assert.equal(h.get('B'), null); assert.equal(h.get('C'), null);
});

test('de uitkomst is deterministisch', () => {
  const R = [rit('A', 1, [['x', 0.5], ['y', 0.5]]), rit('B', 2, [['x', 0.5], ['y', 0.5]])];
  const a = [...verdeelHongaars(R).entries()].join(','), b = [...verdeelHongaars(R).entries()].join(',');
  assert.equal(a, b);
});

test('4.1: de week is een harde grens: wie na de rit niet meer past (rijMin boven ruimte), krijgt geen rit', () => {
  // bram is voor beide ritten de beste, maar heeft deze week nog 3 uur: rit A (4 uur rijden) past niet, rit B (2 uur) wel
  const R = [
    { id: 'A', volgorde: 1, kandidaten: [{ id: 'bram', waarde: 0.95, cap: 1, rijMin: 240, ruimte: 180 }, { id: 'kees', waarde: 0.5, cap: 1, rijMin: 240, ruimte: 900 }] },
    { id: 'B', volgorde: 2, kandidaten: [{ id: 'bram', waarde: 0.6, cap: 1, rijMin: 120, ruimte: 180 }, { id: 'jan', waarde: 0.55, cap: 1, rijMin: 120, ruimte: 900 }] },
  ];
  for (const uit of [verdeelHongaars(R), verdeelGretig(R)]) { assert.equal(uit.get('A'), 'kees'); assert.equal(uit.get('B'), 'bram'); }
  // zonder teller (charter, oproepkracht) telt de kandidaat gewoon mee
  assert.equal(pastNog({ id: 'CH-01', waarde: 0.4 }), true);
  assert.equal(pastNog({ id: 'x', rijMin: 181, ruimte: 180 }), false);
  // niemand past: dan blijft de rit open
  const L = [{ id: 'C', volgorde: 1, kandidaten: [{ id: 'bram', waarde: 0.9, cap: 1, rijMin: 300, ruimte: 100 }] }];
  assert.equal(verdeelHongaars(L).get('C'), null); assert.equal(verdeelGretig(L).get('C'), null);
});
