// Kleine test van de toetsregels (src/ui/toets.js), de teller (src/tellers.js) en het rooster (src/rooster.js), en een
// bouwcontrole op de stylesheet: node tests/toets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toets, rangschik, rijZonderPauze, NORM, alleenRooster } from '../src/ui/toets.js';
import { teller, pastInWeek, ruimteVoor } from '../src/tellers.js';
import { maakRooster, roosterDag, pastInRooster } from '../src/rooster.js';

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

// Bouwcontrole (ronde 3, 26 oktober 2026): elke animatie in src/style.css heeft een @keyframes op het hoogste niveau.
// Binnen de geneste regel .slct negeert de browser een @keyframes (ook na het afvlakken door de build), en dan liep tot
// 26 oktober geen enkele animatie van menu, dialoog, melding of laadbalk. Zo komt dat niet terug.
// ---------- 4.1: de week (EU 561), het rooster en de teller ----------
test('week: met de rit boven 56 uur in de week of 90 in twee weken is een fout; eronder ok', () => {
  const ok = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 3360 - 180, tweeWeken: 4000 } } });
  assert.equal(ok.ok, true); assert.ok(regel(ok, 'week').some(x => x.ernst === 'ok'));
  const vol = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 3360 - 179, tweeWeken: 4000 } } });
  assert.equal(vol.ok, false); assert.match(regel(vol, 'week')[0].tekst, /56 uur/);
  const twee = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 1000, tweeWeken: 5400 - 100 } } });
  assert.equal(twee.ok, false); assert.match(regel(twee, 'week')[0].tekst, /90 uur/);
  // een bestelbus tot 3,5 ton valt erbuiten
  const bus = toets({ voertuig: { ...voertuig, soort: 'bus' }, rit: { ...rit, soort: 'bus' }, start: 480, context: { week: { week: 3400, tweeWeken: 5500 } } });
  assert.equal(regel(bus, 'week').length, 0);
});

test('weekrust: een rit die na de uiterlijke start van de weekrust eindigt, is een fout', () => {
  const u = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 600, tweeWeken: 2000, weekrustUiterlijk: 700 } } });
  assert.equal(u.ok, false); assert.match(regel(u, 'weekrust')[0].tekst, /uiterlijk om 11:40/);
  const v = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 600, tweeWeken: 2000, weekrustUiterlijk: 720 } } });
  assert.equal(v.ok, true);
});

test('rooster: buiten het rooster is een fout, met een reden een let op; vakantie en vrij ook', () => {
  const binnen = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, rooster: { naam: 'Anouk', status: 'werk', van: 180, tot: 1260, tekst: 'ingeroosterd' } } });
  assert.equal(binnen.ok, true); assert.equal(regel(binnen, 'rooster')[0].ernst, 'ok');
  const half = { naam: 'Anouk', status: 'werk', van: 180, tot: 700, tekst: 'halve dag tot 11:40' };
  const buiten = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, rooster: half } });
  assert.equal(buiten.ok, false); assert.equal(alleenRooster(buiten), true); assert.match(regel(buiten, 'rooster')[0].tekst, /met een reden/);
  const reden = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, rooster: { ...half, afwijking: 'De chauffeur heeft ja gezegd' } } });
  assert.equal(reden.ok, true); assert.equal(regel(reden, 'rooster')[0].ernst, 'let op'); assert.match(regel(reden, 'rooster')[0].tekst, /Bewust afgeweken: De chauffeur heeft ja gezegd/);
  for (const status of ['vakantie', 'ziek', 'rustdag', 'vrij']) { const u = toets({ voertuig, rit, start: 480, context: { rooster: { naam: 'Anouk', status, van: null, tot: null, tekst: status } } }); assert.equal(u.ok, false, status); }
  // een fout van de wet (rijtijd) en het rooster samen: geen afwijking mogelijk
  const beide = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { week: 3300, tweeWeken: 4000 }, rooster: half } });
  assert.equal(alleenRooster(beide), false);
});

test('teller: vandaag, de week, twee weken, de laatste weekrust en wat er nog kan', () => {
  // maandag (weekdag 0); vorige week ma tot vr elke dag 8 uur rijden 05:00 tot 15:00, weekend vrij, vandaag 05:00 tot 15:00 met 6 uur
  const D = [];
  for (let k = 7; k >= 3; k--) D.push({ a: -k * 1440 + 300, b: -k * 1440 + 900, rij: 480 });
  D.push({ a: 300, b: 900, rij: 360, maxRij: 540 });
  const t = teller({ diensten: D, nu: 600, weekdag: 0 });
  assert.equal(t.vandaag.gepland, 360); assert.equal(t.vandaag.gereden, 180);
  assert.equal(t.week.totaal, 360); assert.equal(t.tweeWeken.totaal, 360 + 5 * 480);
  assert.equal(t.weekrust.laatste.duur, 3 * 1440 - 600); assert.equal(t.weekrust.laatste.verkort, false);
  assert.equal(t.weekrust.uiterlijk, 300 + 6 * 1440); assert.equal(t.weekrust.dagritten, 1);
  assert.equal(t.kan.vandaag, 180); assert.equal(t.kan.week, 3360 - 360);
  assert.match(t.zin, /^kan vandaag nog 3 uur rijden, weekrust uiterlijk vanaf zondag 05:00$/);
  // een verkorte weekrust van 30 uur: 15 uur compenseren
  const V = teller({ diensten: [{ a: -2000, b: -1800, rij: 100 }, { a: 0, b: 600, rij: 300 }], nu: 0, weekdag: 2 });
  assert.equal(V.weekrust.laatste.verkort, true); assert.equal(V.weekrust.compensatie, 2700 - 1800);
  // de week vol: dan zegt de zin waarom
  const W = []; for (let k = 4; k >= 1; k--) W.push({ a: -k * 1440 + 300, b: -k * 1440 + 1000, rij: 600 }); W.push({ a: 300, b: 900, rij: 500 });
  const w = teller({ diensten: W, nu: 600, weekdag: 4 });
  assert.equal(w.week.totaal, 2900); assert.equal(w.kan.vandaag, 40); assert.match(w.zin, /^kan vandaag nog 40 min rijden/);
  // pastInWeek: dezelfde grens als de toets
  assert.ok(pastInWeek(t, { a: 1000, b: 1200, rij: 120 }, 'Niels', 0).every(x => x.ernst === 'ok'));
  assert.ok(pastInWeek(w, { a: 1000, b: 1200, rij: 461 }, 'Niels', 4).some(x => x.ernst === 'fout' && /56 uur/.test(x.tekst)));
  // zes dagen gewerkt (vorige week dinsdag tot en met zondag), gisteren en vandaag vrij: de weekrust loopt al, een rit vandaag mag
  const L6 = []; for (let k = 7; k >= 2; k--) L6.push({ a: -k * 1440 + 300, b: -k * 1440 + 900, rij: 400 });
  const r6 = teller({ diensten: L6, nu: 600, weekdag: 0 });
  assert.ok(r6.weekrust.lopend && r6.weekrust.uiterlijk < 600); assert.match(r6.zin, /weekrust sinds afgelopen zaterdag 15:00$/); assert.ok(r6.kan.vandaag > 0);
  assert.ok(pastInWeek(r6, { a: 700, b: 1200, rij: 240 }, 'Niels', 0).every(x => x.ernst === 'ok'));
  const t6 = toets({ voertuig, rit, start: 480, context: { volgendeDienst: 480, week: { naam: 'Niels', week: 0, tweeWeken: 2400, weekrustUiterlijk: r6.weekrust.uiterlijk, laatsteEind: r6.laatsteEind } } });
  assert.equal(regel(t6, 'weekrust').length, 0, 'na 24 uur rust geldt de uiterlijke start niet meer');
  // een rit morgen op zondag valt in een nieuwe week
  const z = teller({ diensten: W, nu: 600, weekdag: 6 });
  assert.ok(pastInWeek(z, { a: 1440 + 300, b: 1440 + 900, rij: 500 }, 'Niels', 6).every(x => x.ernst === 'ok'));
  // de ruimte voor verdeel.js volgt dezelfde week: zondag voor maandag een lege week, anders wat er deze week over is
  assert.equal(ruimteVoor(z, { a: 1440 + 300 }, 6), 5400 - 2900, 'maandag: een lege week, maar 90 uur over twee weken'); assert.equal(ruimteVoor(w, { a: 1000 }, 4), 3360 - 2900);
});

test('rooster: vast per persoon, de rijdag van vandaag valt erin, en de vorm die een roostersysteem vult', () => {
  const vd = new Date(2026, 9, 26);
  const a = maakRooster({ id: 'P-0101', uren: 40, werkdagen: [{ datum: vd, start: 300 }], vandaag: vd });
  const b = maakRooster({ id: 'P-0101', uren: 40, werkdagen: [{ datum: vd, start: 300 }], vandaag: vd });
  assert.deepEqual(a, b);
  assert.equal(roosterDag(a, vd).status, 'werk'); assert.ok(roosterDag(a, vd).van <= 300);
  for (const k of ['persoon', 'contract', 'week', 'afwezig', 'bron']) assert.ok(k in a, k);
  assert.deepEqual(Object.keys(a.week), ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']);
  // halve dag: klaar om 13:00; een rit tot 14:00 valt erbuiten
  const h = { persoon: 'P-1', contract: { soort: 'halvedag', urenPerWeek: 24 }, week: { ma: ['vroeg', 'dag'], di: [], wo: [], do: [], vr: [], za: [], zo: [] }, halveDagTot: 780, afwezig: [] };
  assert.equal(roosterDag(h, vd).tekst, 'halve dag, begint vanaf 03:00 en klaar om 13:00');
  assert.equal(pastInRooster(h, vd, 400, 840).ok, false); assert.equal(pastInRooster(h, vd, 400, 760).ok, true);
  // de dag na de laatste werkdag is de rustdag, daarna roostervrij; vakantie gaat voor
  assert.equal(roosterDag(h, new Date(2026, 9, 27)).status, 'rustdag'); assert.equal(roosterDag(h, new Date(2026, 9, 28)).status, 'vrij');
  assert.equal(roosterDag({ ...h, afwezig: [{ soort: 'vakantie', van: '2026-10-26', tot: '2026-10-30' }] }, vd).status, 'vakantie');
  // over 400 personen: alle vier de contracten, en vakantie of ziek bij een deel (variatie)
  const soorten = new Set(); let afw = 0;
  for (let i = 0; i < 400; i++) { const r = maakRooster({ id: `P-${i}`, uren: [40, 40, 40, 36, 32, 24][i % 6], werkdagen: [], vandaag: vd }); soorten.add(r.contract.soort); if (r.afwezig.length) afw++; }
  assert.deepEqual([...soorten].sort(), ['deeltijd', 'halvedag', 'oproep', 'vol']); assert.ok(afw > 20 && afw < 120, `afwezig ${afw}`);
});

test('elke animatie in style.css heeft een @keyframes op het hoogste niveau', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  // de @keyframes met de diepte van de accolades waarop ze staan: alleen diepte 0 telt
  const boven = new Set(), genest = []; let diepte = 0;
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)|[{}]/g)) {
    if (m[0] === '{') diepte++; else if (m[0] === '}') diepte--; else if (diepte === 0) boven.add(m[1]); else genest.push(m[1]);
  }
  // de namen die animation en animation-name gebruiken (geen tijden, functies of sleutelwoorden)
  const WOORD = new Set(['none', 'infinite', 'forwards', 'backwards', 'both', 'alternate', 'alternate-reverse', 'normal', 'reverse', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'running', 'paused', 'initial', 'inherit', 'unset', 'revert']);
  const gebruikt = new Set();
  for (const d of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) for (const deel of d[1].replace(/[\w-]+\([^)]*\)/g, '').split(',')) for (const w of deel.trim().split(/\s+/)) if (/^[a-zA-Z_][\w-]*$/.test(w) && !WOORD.has(w)) gebruikt.add(w);
  assert.ok(gebruikt.size >= 5, `er horen animaties in de stylesheet te staan (gevonden: ${[...gebruikt].join(', ')})`);
  for (const n of gebruikt) assert.ok(boven.has(n), `@keyframes ${n} ontbreekt op het hoogste niveau van style.css (gebruikt door een animation of animation-name)`);
  assert.deepEqual(genest, [], `geneste @keyframes negeert de browser: ${genest.join(', ')}`);
  for (const n of boven) assert.ok(gebruikt.has(n), `@keyframes ${n} wordt door geen enkele animatie gebruikt`);
});
