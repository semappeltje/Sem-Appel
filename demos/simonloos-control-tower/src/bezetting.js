// Bezetting tegen behoefte (Control Tower 4.1, het model; het scherm komt in ronde 2). Puur: alleen rooster.js erbij, geen
// DOM en geen app-staat, zodat tests/bezetting.test.mjs het in Node draait. Per standplaats en voor heel Nederland, per dag
// en dagdeel (vroeg, dag, avond, nacht) voor de komende veertien dagen:
//   nodig        de diensten die de ritten vragen: vandaag het plan (plus de open ritten), daarna de prognose uit de historie
//                (het plan van vandaag maal de verhouding van die weekdag in de historie), met de open ritten van morgen erbij
//   beschikbaar  wie volgens het rooster werkt (na vakantie, ziek en rustdagen), min wie door de rij- en rusttijden niet kan
//                (de weekrust valt op die dag, of de week zit vol); elke persoon telt één keer per dag, in het dagdeel waarin
//                zijn dienst volgens het rooster begint
//   verschil     beschikbaar min nodig: negatief is tekort, positief overschot
//   kosten       schatting: een tekort kost een charter of een gemiste rit, een overschot betaalde uren zonder rit
//   voorstellen  per dag drie tot vier dingen die je eraan kunt doen, als gegevens (het scherm maakt er knoppen van):
//                dienst verschuiven, lenen van een standplaats verderop, extra diensten aanbieden, charter eerder vastleggen
//
// invoer: { vandaag: Date, dagen: 14,
//   standplaatsen: [{ n, buren: [n, ...] }]                     buren: standplaatsen binnen rijafstand (lenen)
//   personen: [{ id, sp, rooster, weekrustUiterlijk?, kanWeek?, dienstVandaag? }]  rooster in de vorm van rooster.js; de teller
//                                                                 (tellers.js): de uiterlijke start van de weekrust (minuten vanaf
//                                                                 vandaag) en wat er deze week nog mag (minuten); wie vandaag een
//                                                                 dienst heeft, telt vandaag altijd mee (het plan is de werkelijkheid)
//   plan: [{ sp, deel, n }]                                      de diensten van vandaag per dagdeel waarin ze beginnen
//   open: [{ sp, dag: 0 | 1, deel }]                             open ritten van vandaag en morgen (elk vraagt een chauffeur)
//   historie: [{ sp, iso, weekdag: 0..6, n }]                    diensten per dag in de historie (0 is maandag); de prognose
//                                                                 neemt het gemiddelde per datum, zodat een weekdag die vaker in
//                                                                 het venster valt niet zwaarder telt }
import { roosterDag } from './rooster.js';

export const DELEN = ['vroeg', 'dag', 'avond', 'nacht'];
export const DEEL_NAAM = { vroeg: 'vroege dienst', dag: 'dagdienst', avond: 'avonddienst', nacht: 'nachtdienst' };
// Schattingen (euro): een dienst die niemand rijdt, kost een charter (9,6 uur tegen 62 euro, plus ongeveer 250 km tegen 0,45)
// of, als er geen charter is, een gemiste rit; een chauffeur zonder rit kost zijn betaalde uren (8 uur tegen 33 euro).
export const KOSTEN = { charter: Math.round(9.6 * 62 + 250 * 0.45), gemist: 900, leegUur: 33, leegUren: 8, schatting: true };
const WD = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDag = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const leeg = () => ({ vroeg: 0, dag: 0, avond: 0, nacht: 0 });

export function bezetting(inv) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const N = inv.dagen || 14; const vd = inv.vandaag; const wd0 = (vd.getDay() + 6) % 7;
  const SPN = inv.standplaatsen.map(s => s.n);
  // de prognose: per standplaats de verhouding van elke weekdag tegen de weekdag van vandaag in de historie
  const hist = new Map(), data = new Map();
  for (const h of inv.historie || []) { let a = hist.get(h.sp); if (!a) { a = new Array(7).fill(0); hist.set(h.sp, a); data.set(h.sp, Array.from({ length: 7 }, () => new Set())); } a[h.weekdag] += h.n; if (h.iso) data.get(h.sp)[h.weekdag].add(h.iso); }
  const gem = (sp, wd) => { const a = hist.get(sp); if (!a) return null; const n = data.get(sp)[wd].size || 1; return a[wd] / n; };
  const factor = (sp, wd) => { const x = gem(sp, wd), y = gem(sp, wd0); if (x === null || !y) return wd === 6 ? 0.45 : 1; return x / y; };
  const plan = new Map(SPN.map(n => [n, leeg()])); for (const x of inv.plan || []) { const p = plan.get(x.sp); if (p && p[x.deel] !== undefined) p[x.deel] += x.n; }
  const open = new Map(); for (const x of inv.open || []) { const k = `${x.sp}|${x.dag}`; let o = open.get(k); if (!o) { o = leeg(); open.set(k, o); } if (o[x.deel] !== undefined) o[x.deel]++; }
  // per persoon per dag: werkt hij volgens het rooster, in welk dagdeel begint hij, en houden de rij- en rusttijden hem thuis
  const perSp = new Map(SPN.map(n => [n, []]));
  const dagen = Array.from({ length: N }, (_, i) => { const d = plusDag(vd, i); return { i, d, iso: iso(d), weekdag: (d.getDay() + 6) % 7 }; });
  for (const n of SPN) for (const D of dagen) perSp.get(n).push({ dag: D.i, iso: D.iso, weekdag: D.weekdag, nodig: leeg(), beschikbaar: leeg(), vrij: 0, rust: 0, afwezig: 0 });
  for (const p of inv.personen) {
    const L = perSp.get(p.sp); if (!L) continue;
    // de uiterlijke start van de weekrust schuift op na een vrije dag in het rooster (dan is er minstens 24 uur rust)
    let uiterlijk = typeof p.weekrustUiterlijk === 'number' ? p.weekrustUiterlijk : Infinity;
    for (const D of dagen) {
      const x = L[D.i]; const r = roosterDag(p.rooster, D.d);
      if (r.status !== 'werk') { if (r.status === 'vakantie' || r.status === 'ziek') x.afwezig++; else x.vrij++; uiterlijk = (D.i + 1) * 1440 + 6 * 1440; continue; }
      // de rij- en rusttijden: de dienst zou na de uiterlijke start van de weekrust eindigen, of de week zit vol (deze week,
      // minder dan een halve dienst over); vandaag telt wie een dienst heeft altijd mee
      const begin = D.i * 1440 + r.van;
      const thuis = !(D.i === 0 && p.dienstVandaag) && (begin + 600 > uiterlijk || (D.i < 7 - wd0 && typeof p.kanWeek === 'number' && p.kanWeek < 270));
      if (thuis) { x.rust++; uiterlijk = (D.i + 1) * 1440 + 6 * 1440; continue; }
      const deel = r.dagdelen[0] || 'vroeg'; x.beschikbaar[deel]++;
    }
  }
  // nodig: vandaag het plan en de open ritten; daarna het plan maal de verhouding van de weekdag, morgen plus de open ritten
  for (const n of SPN) for (const x of perSp.get(n)) {
    const f = x.dag === 0 ? 1 : factor(n, x.weekdag); const o = open.get(`${n}|${x.dag}`);
    for (const k of DELEN) x.nodig[k] = (x.dag === 0 ? plan.get(n)[k] : Math.round(plan.get(n)[k] * f)) + (o ? o[k] : 0);
  }
  const uit = new Map(); const buren = new Map(inv.standplaatsen.map(s => [s.n, s.buren || []]));
  for (const n of SPN) uit.set(n, perSp.get(n).map(x => afronden(n, x)));
  // lenen: een tekort bij de een en een overschot bij een buur op dezelfde dag
  for (const n of SPN) for (const x of uit.get(n)) x.voorstellen = voorstellen(n, x, uit, buren.get(n));
  const nl = dagen.map(D => { const x = { dag: D.i, iso: D.iso, weekdag: D.weekdag, nodig: leeg(), beschikbaar: leeg(), vrij: 0, rust: 0, afwezig: 0 }; for (const n of SPN) { const y = perSp.get(n)[D.i]; for (const k of DELEN) { x.nodig[k] += y.nodig[k]; x.beschikbaar[k] += y.beschikbaar[k]; } x.vrij += y.vrij; x.rust += y.rust; x.afwezig += y.afwezig; } const a = afronden('Nederland', x); a.voorstellen = voorstellenNl(a, SPN.map(n => uit.get(n)[D.i])); return a; });
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { van: dagen[0].iso, tot: dagen[N - 1].iso, perSp: uit, nl, ms: Math.round(ms * 10) / 10, kosten: KOSTEN, gesimuleerd: true };
}

// totalen, verschil en kosten van één dag
function afronden(n, x) {
  const delen = {}; let nodig = 0, besch = 0, tekort = 0, over = 0;
  for (const k of DELEN) { const v = x.beschikbaar[k] - x.nodig[k]; delen[k] = { nodig: x.nodig[k], beschikbaar: x.beschikbaar[k], verschil: v }; nodig += x.nodig[k]; besch += x.beschikbaar[k]; }
  // een tekort in het ene dagdeel kan een overschot uit een ander dagdeel van dezelfde dag niet zomaar vullen: tel per dagdeel
  for (const k of DELEN) { if (delen[k].verschil < 0) tekort -= delen[k].verschil; else over += delen[k].verschil; }
  const kosten = { tekort: tekort * KOSTEN.charter, overschot: over * KOSTEN.leegUur * KOSTEN.leegUren, schatting: true };
  return { sp: n, dag: x.dag, iso: x.iso, weekdag: x.weekdag, dagnaam: WD[x.weekdag], delen, nodig, beschikbaar: besch, verschil: besch - nodig, tekort, overschot: over, vrij: x.vrij, rust: x.rust, afwezig: x.afwezig, kosten };
}
// De voorstellen van één standplaats op één dag: de drie tot vier dingen die je eraan kunt doen, elk los (geen optelsom),
// van goedkoop naar duur, met hoeveel van het tekort het dekt en de kosten of besparing als schatting. Het scherm maakt er
// knoppen van; hier zijn het gegevens.
function voorstellen(n, x, uit, buren) {
  const V = []; const T = x.tekort;
  if (!T) { if (x.overschot >= 2) V.push({ soort: 'aanbieden', n: x.overschot, dekt: 0, tekst: `${x.overschot} chauffeurs zonder rit: bied ze aan bij een standplaats in de buurt, of plan onderhoud en scholing (code 95)`, besparing: x.kosten.overschot }); return V; }
  // 1. een dienst verschuiven: tekort in het ene dagdeel, overschot in een ander op dezelfde dag (kost niets extra)
  const tek = DELEN.filter(k => x.delen[k].verschil < 0).sort((a, b) => x.delen[a].verschil - x.delen[b].verschil), ovr = DELEN.filter(k => x.delen[k].verschil > 0).sort((a, b) => x.delen[b].verschil - x.delen[a].verschil);
  if (tek.length && ovr.length) { const m = Math.min(-x.delen[tek[0]].verschil, x.delen[ovr[0]].verschil); V.push({ soort: 'verschuiven', n: m, dekt: m, van: ovr[0], naar: tek[0], tekst: `Verschuif ${m} ${m === 1 ? 'dienst' : 'diensten'} van de ${DEEL_NAAM[ovr[0]]} naar de ${DEEL_NAAM[tek[0]]}`, besparing: m * KOSTEN.charter }); }
  // 2. lenen van de dichtstbijzijnde standplaats met een overschot op die dag
  for (const b of buren) { const y = (uit.get(b) || [])[x.dag]; if (!y || y.overschot <= 0) continue; const m = Math.min(T, y.overschot); V.push({ soort: 'lenen', n: m, dekt: m, van: b, tekst: `Leen ${m} ${m === 1 ? 'chauffeur' : 'chauffeurs'} van ${b} (daar ${y.overschot} over)`, besparing: m * KOSTEN.charter }); break; }
  // 3. extra diensten aanbieden aan wie roostervrij is (het voorkeursbod; vrijwillig, met toeslag)
  if (x.vrij > 0) { const m = Math.min(T, Math.ceil(x.vrij * 0.3)); V.push({ soort: 'extra', n: m, dekt: m, tekst: `Bied ${m} extra ${m === 1 ? 'dienst' : 'diensten'} aan; ${x.vrij} chauffeurs zijn roostervrij (schatting: drie op de tien zeggen ja)`, kosten: Math.round(m * KOSTEN.leegUur * 9.6 * 1.5) }); }
  // 4. een charter eerder vastleggen: dekt alles, het duurst, maar de rit wordt gereden
  V.push({ soort: 'charter', n: T, dekt: T, tekst: `Leg ${T} ${T === 1 ? 'charter' : 'charters'} nu vast voor ${WD[x.weekdag]}`, kosten: T * KOSTEN.charter });
  return V.slice(0, 4);
}
function voorstellenNl(a, L) {
  const V = []; const tek = L.filter(x => x.tekort > 0).sort((x, y) => y.tekort - x.tekort); const ovr = L.filter(x => x.overschot > 0).length;
  if (tek.length) V.push({ soort: 'tekort', n: tek.length, tekst: `${tek.length} ${tek.length === 1 ? 'standplaats' : 'standplaatsen'} met tekort, het grootst in ${tek.slice(0, 3).map(x => `${x.sp} (${x.tekort})`).join(', ')}` });
  if (ovr) V.push({ soort: 'overschot', n: ovr, tekst: `${ovr} ${ovr === 1 ? 'standplaats' : 'standplaatsen'} met mensen over` });
  if (a.tekort) V.push({ soort: 'kosten', n: a.tekort, tekst: `Tekort samen ${a.tekort} diensten, ongeveer € ${Math.round(a.kosten.tekort).toLocaleString('nl-NL')} aan charters (schatting)` });
  return V;
}
