// De berekening van de duurzame voorstellen (src/duurzaam.js) met vaste invoer, zonder browser:
//   node tests/duurzaam.test.mjs
import assert from 'node:assert/strict';
import * as DZ from '../src/duurzaam.js';

let n = 0; const ok = (naam, fn) => { fn(); n++; console.log(`OK  ${naam}`); };
const bijna = (a, b, d = 0.051) => assert.ok(Math.abs(a - b) <= d, `${a} is niet ongeveer ${b}`);

ok('elke factor heeft een waarde, een eenheid, een bron, een datum en een status', () => {
  for (const [k, f] of Object.entries(DZ.F)) {
    assert.equal(typeof f.w, 'number', k); assert.ok(f.eenheid && f.bron && f.bron.length > 20 && f.datum, k);
    assert.ok(DZ.STATUS[f.status], `${k}: status ${f.status}`);
  }
  // wat niet gelezen is, zegt dat het nagelezen moet worden
  for (const f of Object.values(DZ.F)) if (f.status !== 'gelezen') assert.match(DZ.STATUS[f.status], /nalezen/);
});

ok('elektrisch tegen diesel: 200 km met een trekker', () => {
  const x = DZ.evBesparing(200, 'trekker');
  // diesel 200 x 0,295 x 2,63 = 155,17 kg; stroom 200 x 1,15 x 0,20 = 46 kg
  bijna(x.co2Diesel, 155.2); bijna(x.co2Ev, 46); bijna(x.co2, 109.2);
  // energie: 59 liter x 2,065 = 121,84 euro; 230 kWh x 0,23 = 52,90 euro
  bijna(x.euroDiesel, 121.84, 0.006); bijna(x.euroEv, 52.9, 0.006); bijna(x.euro, 68.94, 0.006);
  assert.equal(x.liter, 59); assert.equal(x.kwh, 230);
});

ok('de accu: 15 procent marge en minstens 10 procent over', () => {
  const a = DZ.accuToets({ km: 200, capKwh: 600, socPct: 80, soort: 'trekker' });
  // nodig 200 x 1,15 x 1,15 = 264,5 kWh; beschikbaar 600 x (80 - 10) % = 420 kWh; na de rit 80 - 44,1 = 36 %
  assert.equal(a.ok, true); assert.equal(a.nodigKwh, 264.5); assert.equal(a.beschikbaarKwh, 420); assert.equal(a.naPct, 36);
  assert.equal(DZ.accuToets({ km: 300, capKwh: 300, socPct: 100, soort: 'trekker' }).ok, false);
  // precies op de grens: 60 % bij vertrek op 600 kWh is 300 kWh beschikbaar; 300 / 1,3225 = 226,8 km
  assert.equal(DZ.accuToets({ km: 226, capKwh: 600, socPct: 60 }).ok, true);
  assert.equal(DZ.accuToets({ km: 228, capKwh: 600, socPct: 60 }).ok, false);
  assert.equal(DZ.accuToets({ km: 10, capKwh: 0, socPct: 100 }).ok, false);
});

ok('kiesEv: alleen vrij, dezelfde soort en genoeg accu; de meeste accu over eerst', () => {
  const rit = { km: 150, a: 600, b: 900, soort: 'trekker' };
  // T-1 is bezet tijdens de rit, T-2 heeft te weinig accu, T-3 is een andere soort, T-4 is 130 min ervoor klaar en T-5 heeft
  // 130 min erna weer een dienst
  const trucks = [
    { id: 'T-1', soort: 'trekker', capKwh: 600, socPct: 90, bezet: [[800, 1200]] },
    { id: 'T-2', soort: 'trekker', capKwh: 300, socPct: 50, bezet: [] },
    { id: 'T-3', soort: 'bakwagen', capKwh: 600, socPct: 100, bezet: [] },
    { id: 'T-4', soort: 'trekker', capKwh: 540, socPct: 80, bezet: [[100, 470]] },
    { id: 'T-5', soort: 'trekker', capKwh: 600, socPct: 95, bezet: [[1030, 1300]] },
  ];
  const k = DZ.kiesEv(rit, trucks); assert.equal(k.t.id, 'T-5'); assert.ok(k.u.ok);
  assert.equal(DZ.kiesEv(rit, trucks.filter(t => t.id !== 'T-5')).t.id, 'T-4');
  // een dienst binnen twee uur na de rit: niet vrij (tijd om te laden)
  assert.equal(DZ.kiesEv(rit, [{ id: 'T-6', soort: 'trekker', capKwh: 600, socPct: 100, bezet: [[1000, 1300]] }]), null);
});

ok('beladen en lege kilometers', () => {
  assert.deepEqual(DZ.beladen(['lossen', 'lossen']), [true, true, false]);
  assert.deepEqual(DZ.beladen(['laden', 'lossen']), [false, true, false]);
  // een pendel: leeg heen, geladen terug
  assert.deepEqual(DZ.beladen(['laden']), [false, true]);
  assert.deepEqual(DZ.beladen(['wisselen']), [true, false]);
  assert.equal(DZ.legeKm([10, 5, 20], ['lossen', 'lossen']), 20);
  assert.equal(DZ.legeKm([100, 100], ['laden']), 100);
  assert.equal(DZ.legeKm([40, 30, 25, 60], ['laden', 'lossen', 'lossen']), 100);
});

ok('retourlading: de lege heenweg min de omweg, alleen als de wagen er op tijd is', () => {
  const basis = { lon: 5, lat: 52 };
  const A = [{ id: 'R-1', laatste: { lon: 5.5, lat: 52 }, terugKm: 44, terugOm: 600 }];
  const B = [{ id: 'R-2', laad: { lon: 5.6, lat: 52, naam: 'DC X' }, heenKm: 53, laadOm: 700 }];
  const m = DZ.retourMatches(basis, A, B);
  assert.equal(m.length, 1); assert.equal(m[0].a, 'R-1'); assert.equal(m[0].b, 'R-2');
  // omweg 8,8 + 53,0 - 44,2 = 17,7 km; besparing 53 - 17,7 = 35 km
  assert.equal(m[0].omKm, 18); assert.equal(m[0].spaarKm, 35); bijna(m[0].co2, 35 * 0.295 * 2.63);
  assert.equal(DZ.retourMatches(basis, A, [{ ...B[0], laadOm: 500 }]).length, 0);
  assert.equal(DZ.retourMatches(basis, A, [{ ...B[0], heenKm: 20 }]).length, 0);
});

ok('LZV: twee ritten naar dezelfde bestemming, alleen met een bevoegde chauffeur en een LZV-standplaats', () => {
  const R = [{ id: 'R-1', sp: 'Utrecht', doel: 'DC Y', a: 300, km: 100, bevoegd: true }, { id: 'R-2', sp: 'Utrecht', doel: 'DC Y', a: 420, km: 100, bevoegd: false }, { id: 'R-3', sp: 'Utrecht', doel: 'DC Y', a: 900, km: 100, bevoegd: true }];
  const p = DZ.lzvParen(R, new Set(['Utrecht']));
  assert.equal(p.length, 1); assert.equal(p[0].a, 'R-1'); assert.equal(p[0].b, 'R-2');
  // 100 x 0,295 - 100 x 0,295 x 0,2 = 23,6 liter
  assert.equal(p[0].liter, 23.6); bijna(p[0].co2, 62.1); bijna(p[0].euro, 48.73, 0.006);
  assert.equal(DZ.lzvParen(R, new Set(['Wognum'])).length, 0);
  assert.equal(DZ.lzvParen(R.map(r => ({ ...r, bevoegd: false })), new Set(['Utrecht'])).length, 0);
});

ok('wachten bij een DC: stationair 3 liter per uur', () => {
  const x = DZ.wachtBesparing(120); assert.equal(x.liter, 6); bijna(x.co2, 15.8); bijna(x.euro, 12.39, 0.006);
});

ok('de som van een dag is reproduceerbaar, in elke volgorde', () => {
  const V = [{ id: 'ev:R-1', soort: 'ev', co2: 109.17, euro: 68.94 }, { id: 'wacht:W:1', soort: 'wacht', co2: 15.78, euro: 12.39 }, { id: 'lzv:R-2:R-3', soort: 'lzv', co2: 62.07, euro: 48.73 }];
  const a = DZ.somVan(V), b = DZ.somVan(V.slice().reverse()), c = DZ.somVan(V);
  assert.deepEqual(a, b); assert.deepEqual(a, c);
  assert.equal(a.n, 3); bijna(a.co2, 187); bijna(a.euro, 130.06, 0.006); assert.equal(a.per.ev.n, 1);
});

ok('trend: dertig dagen, vandaag gemeten, de rest vast', () => {
  const dagen = Array.from({ length: 30 }, (_, i) => ({ iso: `2026-10-${String(i + 1).padStart(2, '0')}`, zondag: i % 7 === 3 }));
  const r1 = DZ.reeks('x', 50, dagen, { spreiding: 0.1, zondag: 0.5 }); const r2 = DZ.reeks('x', 50, dagen, { spreiding: 0.1, zondag: 0.5 });
  assert.deepEqual(r1, r2); assert.equal(r1.length, 30); assert.equal(r1[29], 50);
  assert.ok(r1.slice(0, 29).every((v, i) => (dagen[i].zondag ? v <= 28 : v >= 45 && v <= 55)));
});

console.log(`\n${n} tests geslaagd`);
