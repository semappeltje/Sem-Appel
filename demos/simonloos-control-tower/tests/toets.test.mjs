// Kleine test van de toetsregels (src/ui/toets.js): node --test tests/toets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toets, rangschik, rijZonderPauze, NORM } from '../src/ui/toets.js';

const voertuig = { id: 'T-1050', soort: 'trekker', ev: false, standplaats: 'Wognum' };
// rit van 08:00 tot 12:00: 1,5 uur rijden, lossen bij een winkel met venster 09:00-09:30, terug
const rit = {
  id: 'R-1', t0: 480, t1: 720, km: 160, standplaats: 'Wognum', soort: 'trekker', oplegger: null,
  rijden: [{ t0: 480, t1: 570 }, { t0: 630, t1: 720 }], pauzes: [],
  stops: [{ naam: 'Albert Heijn Laat, Alkmaar', aankomst: 570, venster: [540, 600] }],
};
const regel = (u, r) => u.regels.filter(x => x.regel === r);

test('een vrij voertuig: alles in orde', () => {
  const u = toets({ voertuig, plan: [], dienst: null, rit, start: 480, context: { volgendeDienst: 480 } });
  assert.equal(u.ok, true);
  assert.equal(u.effect.teLaatMin, 0);
  assert.equal(u.effect.rijtijdOverMin, NORM.rijDag - 180);
});

test('overlap met een ander blok is een fout', () => {
  const u = toets({ voertuig, plan: [{ id: 'R-2', t0: 700, t1: 900 }], rit, start: 480 });
  assert.equal(u.ok, false);
  assert.equal(regel(u, 'overlap')[0].ernst, 'fout');
});

test('later vertrekken maakt de stop te laat; meer dan een uur is een fout', () => {
  const u1 = toets({ voertuig, rit, start: 500 });
  assert.equal(u1.ok, true); assert.equal(u1.effect.teLaatMin, 0);
  const u2 = toets({ voertuig, rit, start: 540 });
  assert.equal(regel(u2, 'venster')[0].ernst, 'let op'); assert.equal(u2.effect.teLaatMin, 30);
  const u3 = toets({ voertuig, rit, start: 620 });
  assert.equal(u3.ok, false); assert.equal(regel(u3, 'venster')[0].ernst, 'fout');
});

test('rijtijd: meer dan 4,5 uur zonder pauze is een fout, een pauze lost het op', () => {
  const lang = { ...rit, t1: 480 + 300, rijden: [{ t0: 480, t1: 600 }, { t0: 620, t1: 780 }] };
  assert.equal(toets({ voertuig, rit: lang, start: 480 }).ok, false);
  const metPauze = { ...lang, t1: 830, rijden: [{ t0: 480, t1: 600 }, { t0: 670, t1: 830 }], pauzes: [{ t0: 610, t1: 655 }] };
  assert.equal(regel(toets({ voertuig, rit: metPauze, start: 480 }), 'rijtijd').some(r => r.ernst === 'fout'), false);
  // lossen telt niet als pauze, een blok uit de rest van de dienst met 45 minuten ertussen wel
  assert.equal(rijZonderPauze([{ t0: 0, t1: 200 }, { t0: 260, t1: 400 }]).min, 340);
  assert.equal(rijZonderPauze([{ t0: 0, t1: 200, bron: 'dienst' }, { t0: 260, t1: 400, bron: 'rit' }]).min, 200);
});

test('rijtijd per dag: boven 9 uur let op, boven 10 uur fout', () => {
  const dienst = { bestuurder: 'Jan Smit', t0: 240, t1: 470, rijden: [{ t0: 240, t1: 420 }, { t0: 430, t1: 460, bron: 'dienst' }], pauzes: [] };
  const lang = { ...rit, rijden: [{ t0: 480, t1: 650 }, { t0: 700, t1: 870 }], pauzes: [{ t0: 650, t1: 700 }], t1: 880 };
  const u = toets({ voertuig, dienst, rit: lang, start: 480 });
  assert.ok(regel(u, 'rijtijd').some(r => r.ernst === 'fout'));
});

test('rusttijd: een lange dag maakt de nacht te kort', () => {
  const dienst = { bestuurder: 'Jan Smit', t0: 300, t1: 600, rijden: [{ t0: 300, t1: 400 }], pauzes: [] };
  const laat = { ...rit, t0: 1140, t1: 1380, rijden: [{ t0: 1140, t1: 1230 }, { t0: 1290, t1: 1380 }], stops: [] };
  const u = toets({ voertuig, dienst, rit: laat, start: 1140, context: { volgendeDienst: 300 } });
  assert.equal(regel(u, 'rusttijd')[0].ernst, 'fout');
});

test('rusttijd: de cao is strenger dan EU 561 (10 uur verkort, niet 9)', () => {
  const dienst = { bestuurder: 'Jan Smit', t0: 300, t1: 600, rijden: [{ t0: 300, t1: 400 }], pauzes: [] };
  const rit2 = e => ({ ...rit, t0: e - 120, t1: e, rijden: [{ t0: e - 120, t1: e - 30 }], stops: [] });
  // 9,5 uur rust: onder EU 561 een verkorte rust, onder de cao te kort
  const a = toets({ voertuig, dienst, rit: rit2(1170), start: 1050, context: { volgendeDienst: 300 } });
  assert.equal(regel(a, 'rusttijd')[0].ernst, 'fout'); assert.match(regel(a, 'rusttijd')[0].tekst, /cao beroepsgoederenvervoer/);
  // 10,5 uur rust: verkort, mag hoogstens drie keer tussen twee weekrusten
  const b = toets({ voertuig, dienst, rit: rit2(1140), start: 1020, context: { volgendeDienst: 330 } });
  assert.equal(regel(b, 'rusttijd')[0].ernst, 'let op'); assert.match(regel(b, 'rusttijd')[0].tekst, /minstens 10 uur/);
});

test('accu: een elektrische truck met te weinig lading', () => {
  const ev = { ...voertuig, id: 'T-1100', ev: true, accuKwh: 300 };
  const u = toets({ voertuig: ev, rit: { ...rit, km: 240 }, start: 480, context: { socBijVertrek: 60 } });
  assert.equal(u.ok, false); assert.equal(regel(u, 'accu')[0].ernst, 'fout');
  assert.ok(u.effect.accuBijTerugkomst < NORM.accuMin);
  const v = toets({ voertuig: ev, rit: { ...rit, km: 100 }, start: 480, context: { socBijVertrek: 90 } });
  assert.equal(v.ok, true); assert.equal(v.effect.accuBijTerugkomst, 52);
});

test('soort, oplegger en dock', () => {
  const bak = { ...voertuig, id: 'B-310', soort: 'bakwagen' };
  assert.equal(toets({ voertuig: bak, rit: { ...rit, oplegger: 'koel' }, start: 480 }).ok, false);
  const u = toets({ voertuig, rit: { ...rit, oplegger: 'koel' }, start: 480, context: { opleggersVrij: { koel: 0, droog: 3 } } });
  assert.equal(regel(u, 'oplegger')[0].ernst, 'fout');
  const d = toets({ voertuig, rit, start: 480, context: { dock: { nr: 3, bezet: [{ t0: 430, t1: 470, door: 'T-1040' }], vrij: [5] } } });
  assert.equal(regel(d, 'dock')[0].ernst, 'ok'); assert.equal(d.ok, true);
  const g = toets({ voertuig, rit, start: 480, context: { dock: { nr: 3, bezet: [{ t0: 430, t1: 470, door: 'T-1040' }], vrij: [] } } });
  assert.equal(regel(g, 'dock')[0].ernst, 'fout'); assert.equal(g.ok, false);
});

test('rangschikken: eerst wat kan, dan het minst te laat en de minste extra km', () => {
  const k = rangschik([
    { id: 'a', uitslag: { ok: false, effect: { teLaatMin: 0, extraKm: 0, rijtijdOverMin: 300 } } },
    { id: 'b', uitslag: { ok: true, effect: { teLaatMin: 20, extraKm: 0, rijtijdOverMin: 300 } } },
    { id: 'c', uitslag: { ok: true, effect: { teLaatMin: 0, extraKm: 40, rijtijdOverMin: 300 } } },
    { id: 'd', uitslag: { ok: true, effect: { teLaatMin: 0, extraKm: 0, rijtijdOverMin: 100 } } },
  ]);
  assert.deepEqual(k.map(x => x.id), ['d', 'c', 'b', 'a']);
});

test('een bestelbus tot 3,5 ton valt niet onder EU 561', () => {
  const lang = { ...rit, soort: 'bus', rijden: [{ t0: 480, t1: 800 }] };
  const u = toets({ voertuig: { ...voertuig, id: 'V-400', soort: 'bus' }, rit: lang, start: 480 });
  assert.equal(regel(u, 'rijtijd').length, 1); assert.equal(regel(u, 'rijtijd')[0].ernst, 'ok');
  assert.equal(regel(u, 'rusttijd').length, 0);
});

test('laadvenster op de standplaats: te vroeg is een fout, te laat telt mee', () => {
  const pool = { ...rit, id: 'P-9001', stops: [{ naam: 'Laden op Wognum', aankomst: 480, venster: [480, 540], laden: true }, ...rit.stops] };
  assert.equal(toets({ voertuig, rit: pool, start: 480 }).ok, true);
  const vroeg = toets({ voertuig, rit: pool, start: 450 });
  assert.equal(vroeg.ok, false); assert.match(regel(vroeg, 'venster')[0].tekst, /pas vanaf 08:00/);
  const laat = toets({ voertuig, rit: { ...pool, stops: [pool.stops[0]] }, start: 570 });
  assert.ok(laat.effect.teLaatMin >= 30); assert.match(regel(laat, 'venster').map(x => x.tekst).join(' '), /laadvenster loopt tot 09:00/);
});

test('de dag van de chauffeur: maxRij uit de dienst', () => {
  const dienst = { bestuurder: 'Kees Bakker', t0: 300, t1: 470, maxRij: 600, rijden: [{ t0: 300, t1: 460 }], pauzes: [{ t0: 460, t1: 470 }] };
  const u = toets({ voertuig, dienst, rit, start: 480, context: { volgendeDienst: 300 } });
  assert.equal(u.effect.rijtijdOverMin, 600 - 160 - 180);
});
