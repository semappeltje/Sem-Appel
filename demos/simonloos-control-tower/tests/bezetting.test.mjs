// Het model achter Bezetting tegen behoefte (src/bezetting.js), zonder browser: node tests/bezetting.test.mjs
// - de som per dag klopt met het rooster (beschikbaar, vrij, rust en afwezig samen zijn alle personen) en met het plan
//   (vandaag is nodig precies het plan plus de open ritten);
// - de prognose volgt de historie per weekdag; zondag minder;
// - tekort en overschot per dagdeel, kosten als schatting, en drie tot vier voorstellen als gegevens;
// - heel Nederland is de som van de standplaatsen; rekentijd voor 42 standplaatsen, 2.241 personen en veertien dagen onder
//   300 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bezetting, DELEN, KOSTEN } from '../src/bezetting.js';
import { maakRooster, roosterDag } from '../src/rooster.js';

const VD = new Date(2026, 9, 26);   // maandag
const iso = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const plusDag = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const som = o => DELEN.reduce((a, k) => a + o[k], 0);

// een kleine wereld met twee standplaatsen: A met te weinig mensen in de vroege dienst, B ernaast met mensen over
function klein() {
  const week = d => ({ ma: d, di: d, wo: d, do: d, vr: d, za: [], zo: [] });
  const R = (id, delen, afwezig = []) => ({ persoon: id, contract: { soort: 'vol', urenPerWeek: 40, dagenPerWeek: 5 }, week: week(delen), halveDagTot: null, afwezig, bron: 'test' });
  const personen = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `A${i}`, sp: 'A', rooster: R(`A${i}`, ['vroeg', 'dag']), dienstVandaag: i < 5 })),
    { id: 'A6', sp: 'A', rooster: R('A6', ['dag', 'avond']) },
    { id: 'A7', sp: 'A', rooster: R('A7', ['vroeg', 'dag'], [{ soort: 'vakantie', van: '2026-10-26', tot: '2026-11-01' }]) },
    // A8: de weekrust moet morgen beginnen (teller), dus morgen niet beschikbaar
    { id: 'A8', sp: 'A', rooster: R('A8', ['vroeg', 'dag']), weekrustUiterlijk: 1440 + 300 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `B${i}`, sp: 'B', rooster: R(`B${i}`, ['vroeg', 'dag']) })),
  ];
  const plan = [{ sp: 'A', deel: 'vroeg', n: 8 }, { sp: 'A', deel: 'dag', n: 1 }, { sp: 'B', deel: 'vroeg', n: 3 }];
  const open = [{ sp: 'A', dag: 0, deel: 'vroeg' }, { sp: 'A', dag: 1, deel: 'avond' }];
  // historie: op zaterdag de helft, op zondag een kwart van een maandag
  const historie = []; for (let k = 1; k <= 7; k++) { const d = plusDag(VD, -k); const wd = (d.getDay() + 6) % 7; historie.push({ sp: 'A', iso: iso(d), weekdag: wd, n: wd === 6 ? 2 : wd === 5 ? 4 : 8 }); }
  return { vandaag: VD, dagen: 14, standplaatsen: [{ n: 'A', buren: ['B'] }, { n: 'B', buren: ['A'] }], personen, plan, open, historie };
}

test('de som per dag klopt met het rooster en het plan', () => {
  const inv = klein(); const M = bezetting(inv);
  assert.equal(M.perSp.get('A').length, 14); assert.equal(M.nl.length, 14);
  for (const n of ['A', 'B']) {
    const P = inv.personen.filter(p => p.sp === n);
    for (const x of M.perSp.get(n)) {
      assert.equal(x.beschikbaar + x.vrij + x.rust + x.afwezig, P.length, `${n} ${x.iso}: elke persoon telt één keer`);
      const d = plusDag(VD, x.dag); const werk = P.filter(p => roosterDag(p.rooster, d).status === 'werk').length;
      assert.equal(x.beschikbaar + x.rust, werk, `${n} ${x.iso}: beschikbaar en rust samen zijn wie volgens het rooster werkt`);
      assert.equal(x.nodig, som(Object.fromEntries(DELEN.map(k => [k, x.delen[k].nodig]))));
      assert.equal(x.verschil, x.beschikbaar - x.nodig);
    }
  }
  const a0 = M.perSp.get('A')[0];
  assert.equal(a0.nodig, 8 + 1 + 1, 'vandaag: het plan plus de open rit');
  assert.equal(a0.delen.vroeg.nodig, 9); assert.equal(a0.afwezig, 1);
  assert.equal(a0.beschikbaar, 8, 'A7 heeft vakantie, A8 werkt vandaag nog');
  assert.equal(M.perSp.get('A')[1].rust, 1, 'A8: de weekrust begint morgen');
});

test('prognose uit de historie: zaterdag de helft, zondag een kwart; morgen de open rit erbij', () => {
  const M = bezetting(klein()); const A = M.perSp.get('A');
  const za = A.find(x => x.weekdag === 5), zo = A.find(x => x.weekdag === 6), di = A[1];
  assert.equal(za.delen.vroeg.nodig, 4); assert.equal(zo.delen.vroeg.nodig, 2);
  assert.equal(di.delen.vroeg.nodig, 8); assert.equal(di.delen.avond.nodig, 1, 'de open rit van morgen');
});

test('tekort en overschot per dagdeel, kosten als schatting, voorstellen als gegevens', () => {
  const M = bezetting(klein()); const a0 = M.perSp.get('A')[0]; const b0 = M.perSp.get('B')[0];
  assert.equal(a0.delen.vroeg.verschil, 7 - 9); assert.equal(a0.tekort, 2);
  assert.equal(a0.kosten.schatting, true); assert.equal(a0.kosten.tekort, a0.tekort * KOSTEN.charter);
  assert.ok(b0.overschot >= 3);
  const soorten = a0.voorstellen.map(v => v.soort);
  assert.ok(a0.voorstellen.length >= 2 && a0.voorstellen.length <= 4, soorten.join(','));
  assert.ok(soorten.includes('lenen'), 'B heeft mensen over: lenen'); assert.equal(soorten[soorten.length - 1], 'charter', 'de charter als laatste, de duurste');
  assert.ok(a0.voorstellen.every(v => v.dekt <= a0.tekort)); assert.ok(a0.voorstellen.every(v => typeof v.tekst === 'string' && v.n > 0));
  const leen = a0.voorstellen.find(v => v.soort === 'lenen'); assert.equal(leen.van, 'B');
  // heel Nederland is de som van de standplaatsen
  for (let i = 0; i < 14; i++) { const n = M.nl[i]; const L = ['A', 'B'].map(s => M.perSp.get(s)[i]); assert.equal(n.nodig, L.reduce((a, x) => a + x.nodig, 0)); assert.equal(n.beschikbaar, L.reduce((a, x) => a + x.beschikbaar, 0)); }
});

test('heel Nederland, veertien dagen: onder 300 ms', () => {
  // 42 standplaatsen, 2.241 personen (zoals de simulatie), het plan van 1.626 diensten
  const standplaatsen = Array.from({ length: 42 }, (_, i) => ({ n: `S${i}`, buren: [`S${(i + 1) % 42}`, `S${(i + 41) % 42}`] }));
  const personen = Array.from({ length: 2241 }, (_, i) => { const sp = `S${i % 42}`; return { id: `P-${i}`, sp, rooster: maakRooster({ id: `P-${i}`, uren: [40, 40, 40, 36, 32, 24][i % 6], werkdagen: i % 4 ? [{ datum: VD, start: 300 }] : [], vandaag: VD }), weekrustUiterlijk: 5000 + (i % 7) * 1440, kanWeek: 3000, dienstVandaag: !!(i % 4) }; });
  const plan = []; for (let i = 0; i < 1626; i++) plan.push({ sp: `S${i % 42}`, deel: DELEN[i % 3], n: 1 });
  const historie = []; for (let s = 0; s < 42; s++) for (let k = 1; k <= 7; k++) { const d = plusDag(VD, -k); historie.push({ sp: `S${s}`, iso: iso(d), weekdag: (d.getDay() + 6) % 7, n: 30 }); }
  const inv = { vandaag: VD, dagen: 14, standplaatsen, personen, plan, open: [], historie };
  bezetting(inv);
  const t0 = performance.now(); const M = bezetting(inv); const ms = performance.now() - t0;
  console.log(`# rekentijd heel Nederland, 14 dagen: ${ms.toFixed(1)} ms (model zegt ${M.ms} ms)`);
  assert.ok(ms < 300, `${ms.toFixed(1)} ms`);
  assert.equal(M.nl[0].nodig, 1626);
  assert.equal(M.nl.reduce((a, x) => a + x.beschikbaar + x.vrij + x.rust + x.afwezig, 0), 2241 * 14);
});
