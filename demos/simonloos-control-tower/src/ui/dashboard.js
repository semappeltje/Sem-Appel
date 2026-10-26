// Het dashboard bovenaan Rapporten (Control Tower 4.1, bouwsteen 2d), voor elke rol; voor de directie het eerste scherm na
// het Overzicht. Voor je werkgebied, een regio of een standplaats: elk cijfer met de trend over dertig dagen (een klein
// lijntje op uPlot) en per blok een grafiek; elk cijfer klikt door naar de lijst erachter (Ritten met filter, Open ritten,
// Meldingen, Chauffeurs, Voertuigen, Lostijden, de duurzame voorstellen). De directie kijkt en handelt niet: niets op dit
// scherm verandert het plan. Vandaag is gemeten uit het dagplan en de klok; de dagen ervoor zijn gesimuleerde historie (de
// pool uit fleet.poolHistorie, de rest vast rond vandaag met duurzaam.reeks). Bedragen en CO2 zijn schattingen met de
// factoren uit src/duurzaam.js. uPlot komt via dezelfde dynamische import als de andere grafieken, nooit statisch.
import { SP, REGIOS } from '../places.js';
import { esc, ic, fmt, nl1, hhmm, on, swap, durTxt } from './base.js';
import { tijdreeks } from './tijdreeks.js';
import { historie, gemistOm } from './invulling.js';
import { pool as poolAlles } from './planwijzig.js';
import * as DZ from '../duurzaam.js';
import { duurzaamDag, dzBesluit, dzBenen, dzNogTeDoen } from './assistent.js';

let UP = null;
const laadUP = () => UP || (UP = import('uplot').then(m => m.default));
const kleur = (el, v, d) => { const x = getComputedStyle(el).getPropertyValue(v).trim(); return x || d; };
const pct1 = v => `${nl1(v)} %`;
// dicht bij 0 of 100 met twee decimalen, zodat 1 te laat van 2.490 geen 0,0 % wordt
const pctFijn = v => ((v > 0 && v < 1) || (v > 99 && v < 100) ? `${v.toFixed(2).replace('.', ',')} %` : pct1(v));
const meer = (n, een, veel) => `${fmt(n)} ${n === 1 ? een : veel}`;
const KORT = { ev: 'elektrisch', retour: 'lege km eruit', lzv: 'LZV', wacht: 'wachten bij een DC' };
const eur = v => `€ ${fmt(Math.round(v))}`;
const eur2 = v => `€ ${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',')}`;
const gem = L => (L.length ? L.reduce((a, b) => a + b, 0) / L.length : 0);
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };

// ---------- de keuze: werkgebied, regio of standplaats (bewaard in sl-dashboard) ----------
function keuzes(ctx) {
  const sps = ctx.spsInScope(); const alles = sps.length === SP.length;
  const L = [{ v: 'alles', l: alles ? 'Heel Simon Loos' : 'Je werkgebied', sps }];
  for (const r of REGIOS) { const x = sps.filter(s => s.regio === r); if (x.length && x.length < sps.length) L.push({ v: `regio:${r}`, l: `Regio ${r}`, sps: x }); }
  if (sps.length > 1) for (const s of sps.slice().sort((a, b) => a.n.localeCompare(b.n, 'nl'))) L.push({ v: `sp:${s.n}`, l: s.n, sps: [s] });
  return L;
}
function keuze(ctx) {
  const L = keuzes(ctx); if (ctx.ui.dbSel === undefined) { try { ctx.ui.dbSel = ctx.store.get('sl-dashboard') || 'alles'; } catch { ctx.ui.dbSel = 'alles'; } }
  return { L, k: L.find(x => x.v === ctx.ui.dbSel) || L[0] };
}

// ---------- per standplaats: wat uit het dagplan komt (vast zolang het plan niet verandert) ----------
let spCache = { k: '', m: null };
function perSp(ctx) {
  const key = `${ctx.R.ver()}|${ctx.scopeKey()}`; if (spCache.k === key) return spCache.m;
  const m = new Map(); const get = n => m.get(n) || (m.set(n, { ritten: 0, km: 0, kmEv: 0, leeg: 0, kosten: 0, co2: 0, co2Leeg: 0, wachtMin: 0, wachtN: 0, diensten: 0, grens: 0, ev: 0, voertuigen: 0 }), m.get(n));
  for (const r of ctx.R.all()) {
    if (!r.stops.length || !ctx.inScope(r.t)) continue; const a = get(r.base.n); const ev = !!r.t.ev; const k = r.t.kind; const b = dzBenen(ctx, r);
    a.ritten++; a.km += r.km; if (ev) a.kmEv += r.km; a.leeg += b.leeg; a.kosten += DZ.kostenRit(r.km, Math.max(0, r.end - r.dep) / 60, ev);
    a.co2 += DZ.co2Rit(r.km, ev, k); a.co2Leeg += DZ.co2Rit(b.leeg, ev, k);
    for (const s of r.stops) { const p = s.place; if (p && (p.soort === 'dc' || p.soort === 'fabriek' || p.soort === 'groothandel')) { a.wachtMin += (s.seg && s.seg.wacht) || 0; a.wachtN++; } }
  }
  for (const t of ctx.fleet.trucks) { if (!ctx.inScope(t)) continue; const a = get(t.base.n); a.voertuigen++; if (t.ev) a.ev++; for (const d of t.diensten) { a.diensten++; if ((d.rij || 0) >= (d.maxRij || 540) - 30) a.grens++; } }
  spCache = { k: key, m }; return m;
}
const som = (m, sps) => { const o = {}; for (const s of sps) { const a = m.get(s.n); if (!a) continue; for (const [k, v] of Object.entries(a)) o[k] = (o[k] || 0) + v; } return o; };

// ---------- de pool: historie per dag (56 dagen, de laatste 29 hier) en vandaag ----------
const hCache = new Map();
const histVan = (ctx, n) => { if (!hCache.has(n)) hCache.set(n, historie(ctx, n)); return hCache.get(n); };

// ---------- alle cijfers voor de keuze ----------
export function dashData(ctx, sel) {
  const T = ctx.state.simTime; const sps = sel.sps; const set = new Set(sps.map(s => s.n)); const spObj = new Map(sps.map(s => [s.n, s]));
  const d0 = new Date(); d0.setHours(12, 0, 0, 0); const dagen = [];
  for (let k = -29; k <= 0; k++) { const d = new Date(d0); d.setDate(d0.getDate() + k); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; dagen.push({ k, iso, zondag: d.getDay() === 0, l: d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '') }); }
  const key = `${ctx.scopeKey()}|${sel.v}`;
  const trucks = ctx.fleet.trucks.filter(t => set.has(t.base.n) && ctx.inScope(t));
  // op tijd: zoals de rapporten (metrics.onTimeBy, een stop telt bij aankomst); de dagen ervoor rond de 30-dagenstiptheid
  const ot = ctx.M.onTimeBy(T, trucks, () => 'x').get('x') || { n: 0, late: 0 }; const opTijd = ot.n ? (1 - ot.late / ot.n) * 100 : 100;
  const base = trucks.length ? trucks.reduce((a, t) => a + ctx.people.forTruck.get(t.id).onTime, 0) / trucks.length : 96;
  const kOt = sel.v === 'alles' ? ctx.scopeKey() : key;
  const otReeks = dagen.map(w => { const d = new Date(d0); d.setDate(d0.getDate() + w.k); if (w.k === 0) return Math.round(opTijd * 100) / 100; const wd = d.getDay(); return Math.round(Math.max(80, Math.min(99.6, base + (hash(`${kOt}|${d.toDateString()}`) - 0.5) * 3.6 - (wd === 0 || wd === 6 ? 0.8 : 0))) * 10) / 10; });
  // de pool: gemist en open vandaag (zoals metrics en Open ritten), de dagen ervoor uit de historie
  const P = poolAlles(ctx).filter(p => set.has(p.sp) && ctx.inScopeBase(spObj.get(p.sp), p.div));
  const gemist = P.filter(p => gemistOm(ctx, p, T)).length; const openNu = P.filter(p => p.dag !== 'morgen' && p.bekend <= T).length;
  const H = sps.map(s => histVan(ctx, s.n)); const hd = i => { const o = { n: 0, eigen: 0, oproep: 0, charter: 0, open: 0 }; for (const h of H) { const x = h.dagen[h.dagen.length - 29 + i]; if (x) for (const k of Object.keys(o)) o[k] += x[k] || 0; } return o; };
  const hist = Array.from({ length: 29 }, (_, i) => hd(i));
  const sumH = hist.reduce((a, x) => { for (const k of Object.keys(a)) a[k] += x[k]; return a; }, { n: 0, eigen: 0, oproep: 0, charter: 0, open: 0 });
  const ingevuld = sumH.eigen + sumH.oproep + sumH.charter;
  // een charterrit (schatting): de gemiddelde duur en afstand van de open ritten tegen het gemiddelde tarief, zoals de rapporten
  const P0 = ctx.fleet.pool || []; const CH = ctx.fleet.CHARTERS || [];
  const gemUur = P0.length ? P0.reduce((a, p) => a + (p.duur || 0), 0) / P0.length / 60 : 6; const gemKm = P0.length ? P0.reduce((a, p) => a + (p.km || 0), 0) / P0.length : 120;
  const perCharter = CH.length ? CH.reduce((a, c) => a + c.tarief.perUur * gemUur + c.tarief.perKm * gemKm, 0) / CH.length : 0;
  // bezetting (bouwsteen F): nodig = de diensten van vandaag plus de open ritten, beschikbaar = de chauffeurs met een dienst of
  // vrij (niet ziek, op vakantie of met een rustdag). Hier haakt straks het model van de bezetting aan (rooster en tellers per
  // chauffeur, per dag en dagdeel voor veertien dagen; fleet.bezetting of zoals de rooster-agent het noemt); tot dan het plan
  // van vandaag en, voor de dertig dagen, de historie van de open ritten: een tekortdag is een standplaatsdag waarop een open
  // rit open bleef of naar een charter ging, een overschotdag een standplaatsdag zonder open rit of met alleen eigen mensen.
  let nodig = 0, beschikbaar = 0;
  for (const s of sps) { let ch = []; try { ch = ctx.fleet.chauffeurs(s, ctx.people) || []; } catch { ch = []; } for (const c of ch) if (c.dienst || c.status === 'vrij') beschikbaar++; }
  const ag = som(perSp(ctx), sps); nodig = (ag.diensten || 0) + openNu;
  const tekort = [], overschot = [];
  for (let i = 0; i < 29; i++) { let t = 0, o = 0; for (const h of H) { const x = h.dagen[h.dagen.length - 29 + i]; if (!x) continue; if (x.open + x.charter > 0) t++; else if (x.n === x.eigen) o++; } tekort.push(t); overschot.push(o); }
  // vandaag telt nog niet mee: of een open rit vandaag naar een charter gaat, weet je pas aan het eind van de dag
  // rij- en rusttijden: zaken Rijtijd vandaag, nu bijna op de 4,5 uur (zoals de filter van Chauffeurs), diensten dicht bij de
  // daggrens (de week- en tweeweekgrens komt met de tellers per chauffeur, bouwsteen A)
  const rz = ctx.Z.list().filter(z => z.kind === 'Rijtijd' && z.t && set.has(z.t.base.n) && ctx.inScope(z.t));
  const bijna = ctx.people.persons.filter(p => set.has(p.base.n) && ctx.inScopeBase(p.base, p.div)).filter(p => { const d = p.dienst && p.dienst.d; const t = d && p.dienst.t; const s = t && ctx.S.get(t.id); return !!s && s.dienst === d && s.drive >= 200; }).length;
  // duurzaamheid: de voorstellen van de dag in de keuze, en wat ermee gebeurde
  const V = duurzaamDag(ctx).filter(p => set.has(p.sp) && (p.t ? ctx.inScope(p.t) : true));
  const besluiten = Object.entries(ctx.A.acts.handled).filter(([k, r]) => k.startsWith('G:') && r.dz && set.has(r.dz.sp)).map(([k, r]) => ({ id: k.slice(2), ...r.dz }));
  const toegepast = besluiten.filter(b => b.st === 'toegepast'); const afgewezen = besluiten.filter(b => b.st === 'afgewezen');
  const besloten = new Set(besluiten.map(b => b.id)); const open = V.filter(p => !besloten.has(p.id));
  const sOp = DZ.somVan(toegepast.map(b => ({ id: b.id, soort: b.soort, co2: b.co2, euro: b.euro }))); const sNiet = DZ.somVan([...open, ...afgewezen.map(b => ({ id: b.id, soort: b.soort, co2: b.co2, euro: b.euro }))]);
  const R = (naam, nu, opts) => DZ.reeks(`${key}|${naam}`, nu, dagen, opts);
  return { T, dagen, sps, set, key, ot, opTijd, otReeks, gemist, openNu, hist, sumH, ingevuld, perCharter, nodig, beschikbaar, tekort, overschot, ag, rz, bijna, V, open, toegepast, afgewezen, sOp, sNiet, R };
}

// ---------- tegels en blokken ----------
// tegel: { id, l (label), v (waarde), s (onder), reeks, ga (doorklik), fmt (voor de trend) }
const tegel = x => `<div class="db-t"><button class="db-a" type="button" data-db="${esc(x.ga)}" data-dbt="${esc(x.id)}" aria-label="${esc(`${x.l}: ${x.v.replace(/<[^>]+>/g, '')}. ${x.s.replace(/<[^>]+>/g, '')}. Open ${x.naar}`)}"><span class="db-l">${esc(x.l)}</span><b class="db-v">${x.v}</b><span class="db-s">${x.s}</span></button>${x.reeks ? `<div class="db-sp" data-spark="${esc(x.id)}" aria-hidden="true"></div>` : `<div class="db-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, x.bar))}%"></i></div><span class="db-s db-bt">${esc(x.barTxt || '')}</span>`}</div>`;
const blok = (id, titel, sub, tegels, graf, noot) => `<section class="card db-b" aria-labelledby="db-${id}"><div class="card-h"><h2 id="db-${id}">${esc(titel)}</h2><span class="sub">${sub}</span></div><div class="card-b"><div class="db-ts">${tegels.map(tegel).join('')}</div>${graf ? `<div class="db-g" data-dbgraf="${esc(id)}"></div>` : ''}${noot ? `<p class="hint db-n">${noot}</p>` : ''}</div></section>`;

export function dashHtml(ctx) {
  const { L, k } = keuze(ctx); const d = dashData(ctx, k); const ag = d.ag; const T = d.T;
  const kost = ctx.can('kosten');
  const T0 = [], T1 = [], T2 = [], T3 = [], T4 = [], T5 = [];
  const tg = (A, x) => { A.push(x); return x; };
  const ritNaar = 'de ritten'; const lijstSp = d.sps.length === 1 ? ` van ${d.sps[0].n}` : '';
  tg(T0, { id: 'optijd', l: 'Op tijd', v: d.ot.n ? pctFijn(d.opTijd) : '–', s: `${meer(d.ot.n, 'stop', 'stops')} tot ${hhmm(T)} · doel 95 %`, reeks: d.otReeks, f: pctFijn, ga: 'ritten', naar: ritNaar + lijstSp });
  tg(T0, { id: 'telaat', l: 'Te laat', v: d.ot.n ? pctFijn(100 - d.opTijd) : '–', s: `${meer(d.ot.late, 'stop', 'stops')} na het venster`, reeks: d.otReeks.map(v => Math.round((100 - v) * 10) / 10), f: pctFijn, ga: 'ritten:uur:late', naar: 'de ritten buiten het tijdvenster' });
  tg(T0, { id: 'gemist', l: 'Gemist', v: fmt(d.gemist), s: 'open ritten die niemand reed', reeks: [...d.hist.map(x => x.open), d.gemist], f: v => fmt(v), ga: 'openritten', naar: 'Open ritten' });
  tg(T1, { id: 'open', l: 'Open ritten vandaag', v: fmt(d.openNu), s: `bekend tot ${hhmm(T)}`, reeks: [...d.hist.map(x => x.n), d.openNu], f: v => fmt(v), ga: 'openritten', naar: 'Open ritten' });
  const pE = d.ingevuld ? d.sumH.eigen / d.ingevuld * 100 : 0; const pF = d.ingevuld ? (d.sumH.oproep + d.sumH.charter) / d.ingevuld * 100 : 0;
  // de invulling en de kosten van charters: de 29 dagen tot gisteren (vandaag is nog niet af)
  tg(T1, { id: 'eigen', l: 'Ingevuld door eigen mensen', v: `${Math.round(pE)} %`, s: `${fmt(d.sumH.eigen)} van ${fmt(d.ingevuld)} ritten in 29 dagen`, reeks: d.hist.map(x => { const n = x.eigen + x.oproep + x.charter; return n ? Math.round(x.eigen / n * 100) : 0; }), f: v => `${Math.round(v)} %`, ga: 'openritten', naar: 'Open ritten' });
  tg(T1, { id: 'flex', l: 'Oproep, zzp of charter', v: `${Math.round(pF)} %`, s: `${fmt(d.sumH.oproep)} oproep of zzp, ${fmt(d.sumH.charter)} charter`, reeks: d.hist.map(x => { const n = x.eigen + x.oproep + x.charter; return n ? Math.round((x.oproep + x.charter) / n * 100) : 0; }), f: v => `${Math.round(v)} %`, ga: 'charters', naar: 'Charters en oproepkrachten' });
  if (kost) tg(T1, { id: 'charterkost', l: 'Kosten charters', v: eur(d.sumH.charter * d.perCharter), s: `29 dagen, schatting (${eur(d.perCharter)} per rit)`, reeks: d.hist.map(x => Math.round(x.charter * d.perCharter)), f: eur, ga: 'charters', naar: 'Charters en oproepkrachten' });
  const vs = d.beschikbaar - d.nodig;
  tg(T2, { id: 'bezet', l: vs >= 0 ? 'Overschot vandaag' : 'Tekort vandaag', v: `${fmt(Math.abs(vs))} <em>chauffeurs</em>`, s: `nodig ${fmt(d.nodig)}, beschikbaar ${fmt(d.beschikbaar)}`, reeks: d.R('bezet', vs, { spreiding: 0.3, min: -1e9 }), f: v => fmt(v), ga: 'chauffeurs', naar: 'de chauffeurs' + lijstSp });
  tg(T2, { id: 'tekort', l: 'Tekortdagen', v: fmt(d.tekort.reduce((a, b) => a + b, 0)), s: `van ${fmt(d.sps.length * 29)} standplaatsdagen in 29 dagen`, reeks: d.tekort, f: v => fmt(v), ga: 'openritten', naar: 'Open ritten' });
  tg(T2, { id: 'overschot', l: 'Overschotdagen', v: fmt(d.overschot.reduce((a, b) => a + b, 0)), s: `van ${fmt(d.sps.length * 29)} standplaatsdagen in 29 dagen`, reeks: d.overschot, f: v => fmt(v), ga: 'chauffeurs', naar: 'de chauffeurs' + lijstSp });
  const km = ag.km || 0; const pk = km ? ag.kosten / km : 0; const pr = ag.ritten ? ag.kosten / ag.ritten : 0; const lp = km ? ag.leeg / km * 100 : 0; const wp = ag.wachtN ? ag.wachtMin / ag.wachtN : 0;
  if (kost) tg(T3, { id: 'kostkm', l: 'Kosten per km', v: eur2(pk), s: 'chauffeur en voertuig, schatting', reeks: d.R('kostkm', Math.round(pk * 100) / 100, { spreiding: 0.04, rond: 0.01 }), f: eur2, ga: 'ritten', naar: ritNaar + lijstSp });
  if (kost) tg(T3, { id: 'kostrit', l: 'Kosten per rit', v: eur(pr), s: `${fmt(ag.ritten || 0)} ritten vandaag, schatting`, reeks: d.R('kostrit', Math.round(pr), { spreiding: 0.06 }), f: eur, ga: 'ritten', naar: ritNaar + lijstSp });
  tg(T3, { id: 'leeg', l: 'Lege kilometers', v: `${fmt(Math.round(ag.leeg || 0))} <em>km</em>`, s: `${nl1(lp)} % van ${fmt(Math.round(km))} km`, reeks: d.R('leeg', Math.round(lp * 10) / 10, { spreiding: 0.06, zondag: 1.05, rond: 0.1 }), f: pct1, ga: 'ritten', naar: ritNaar + lijstSp });
  tg(T3, { id: 'wacht', l: 'Wachten bij DC\'s', v: `${nl1(wp)} <em>min</em>`, s: `per stop · ${durTxt(ag.wachtMin || 0)} samen`, reeks: d.R('wacht', Math.round(wp * 10) / 10, { spreiding: 0.15, zondag: 0.7, rond: 0.1 }), f: v => `${nl1(v)} min`, ga: 'lostijden', naar: 'Lostijden' });
  const rzOk = d.rz.filter(z => !z.open).length;
  tg(T4, { id: 'rijzaak', l: 'Rijtijdzaken', v: fmt(d.rz.length), s: `${fmt(rzOk)} voor de grens opgelost`, reeks: d.R('rijzaak', d.rz.length, { spreiding: 0.35, zondag: 0.5 }), f: v => fmt(v), ga: 'meldingen::Rijtijd', naar: 'de meldingen over rijtijd' });
  tg(T4, { id: 'bijna', l: 'Nu bijna op 4,5 uur', v: fmt(d.bijna), s: 'rijden 3 uur 20 of langer zonder pauze', reeks: d.R('bijna', d.bijna, { spreiding: 0.4, zondag: 0.5 }), f: v => fmt(v), ga: 'chauffeurs:let:rijtijd', naar: 'de chauffeurs bijna op de rijtijdlimiet' });
  tg(T4, { id: 'grens', l: 'Dicht bij de daggrens', v: fmt(ag.grens || 0), s: `diensten met minder dan 30 min rijtijd over, van ${fmt(ag.diensten || 0)}`, reeks: d.R('grens', ag.grens || 0, { spreiding: 0.2, zondag: 0.45 }), f: v => fmt(v), ga: 'chauffeurs', naar: 'de chauffeurs' + lijstSp });
  const co2 = ag.co2 || 0; const pe = km ? (ag.kmEv || 0) / km * 100 : 0;
  tg(T5, { id: 'co2', l: 'CO2 vandaag', v: `${nl1(co2 / 1000)} <em>ton</em>`, s: `uit het dagplan, ${fmt(Math.round(km))} km`, reeks: d.R('co2', Math.round(co2 / 100) / 10, { spreiding: 0.05, zondag: 0.45, rond: 0.1 }), f: v => `${nl1(v)} ton`, ga: 'voertuigen', naar: 'de voertuigen' + lijstSp });
  tg(T5, { id: 'co2rit', l: 'CO2 per rit', v: `${fmt(Math.round(ag.ritten ? co2 / ag.ritten : 0))} <em>kg</em>`, s: `${fmt(ag.ritten || 0)} ritten`, reeks: d.R('co2rit', Math.round(ag.ritten ? co2 / ag.ritten : 0), { spreiding: 0.05 }), f: v => `${fmt(v)} kg`, ga: 'ritten', naar: ritNaar + lijstSp });
  tg(T5, { id: 'elek', l: 'Elektrisch', v: `${Math.round(pe)} %`, s: `van de km · ${fmt(ag.ev || 0)} van ${fmt(ag.voertuigen || 0)} voertuigen`, reeks: d.R('elek', Math.round(pe), { spreiding: 0.04 }), f: v => `${Math.round(v)} %`, ga: 'voertuigen:aandr:ev', naar: 'de elektrische voertuigen' });
  tg(T5, { id: 'leegco2', l: 'CO2 van lege km', v: `${fmt(Math.round(ag.co2Leeg || 0))} <em>kg</em>`, s: `${nl1(co2 ? (ag.co2Leeg || 0) / co2 * 100 : 0)} % van de CO2`, reeks: d.R('leegco2', Math.round(ag.co2Leeg || 0), { spreiding: 0.06, zondag: 0.45 }), f: v => `${fmt(v)} kg`, ga: 'ritten', naar: ritNaar + lijstSp });
  // de voorstellen zijn er sinds 4.1: nog geen historie, dus een balk met het deel dat gebruikt werd in plaats van een lijntje
  const dzTot = d.sOp.co2 + d.sNiet.co2; const dzDeel = dzTot ? Math.round(d.sOp.co2 / dzTot * 100) : 0;
  tg(T5, { id: 'dzop', l: 'Voorstellen opgeleverd', v: `${fmt(Math.round(d.sOp.co2))} <em>kg CO2</em>`, s: `${meer(d.toegepast.length, 'voorstel', 'voorstellen')} toegepast · ${eur(d.sOp.euro)}`, bar: dzDeel, barTxt: `${dzDeel} % van de besparing gebruikt`, ga: 'dz', naar: 'de duurzame voorstellen' });
  tg(T5, { id: 'dzniet', l: 'Niet gebruikt', v: `${fmt(Math.round(d.sNiet.co2))} <em>kg CO2</em>`, s: `${meer(d.open.length + d.afgewezen.length, 'voorstel', 'voorstellen')}, ${fmt(d.afgewezen.length)} afgewezen · ${eur(d.sNiet.euro)}`, bar: dzTot ? 100 - dzDeel : 0, barTxt: 'nog geen historie: nieuw in 4.1', ga: 'dz', naar: 'de duurzame voorstellen' });
  const alle = [...T0, ...T1, ...T2, ...T3, ...T4, ...T5]; ctx.ui.dbTegels = alle; ctx.ui.dbData = d;
  // per standplaats naast elkaar (alleen bij meer dan een standplaats)
  const M = perSp(ctx); const otSp = d.sps.length > 1 ? ctx.M.onTimeBy(T, ctx.fleet.trucks.filter(t => d.set.has(t.base.n) && ctx.inScope(t)), t => t.base.n) : null;
  const rijen = d.sps.length > 1 ? d.sps.map(s => { const a = M.get(s.n) || {}; const ot = otSp.get(s.n) || { n: 0, late: 0 }; return { s, ot: ot.n ? (1 - ot.late / ot.n) * 100 : null, co2r: a.ritten ? a.co2 / a.ritten : 0, ev: a.km ? a.kmEv / a.km * 100 : 0, leeg: a.km ? a.leeg / a.km * 100 : 0, wacht: a.wachtN ? a.wachtMin / a.wachtN : 0, ritten: a.ritten || 0 }; }).sort((a, b) => a.s.n.localeCompare(b.s.n, 'nl')) : [];
  // een rit in de titel is een knop naar de ritpagina; het besluit: toegepast, afgewezen met reden, open (de planner kan nog)
  // of voorbij (de rit begon al: ongebruikt)
  const ritLinks = t => esc(t).replace(/R-\d+b?/g, m => `<button class="lnk" type="button" data-open="rit/${m}">${m}</button>`);
  const dzRij = p => { const b = dzBesluit(ctx, p.id); return `<tr><td>${esc(DZ.SOORTEN[p.soort])}</td><td class="db-wrap">${ritLinks(p.title)}</td><td>${esc(p.sp)}</td><td class="r">${fmt(Math.round(p.co2))} kg</td><td class="r">${eur(p.euro)}</td><td>${b ? (b.st === 'toegepast' ? 'toegepast' : `afgewezen: ${esc(b.reden)}`) : dzNogTeDoen(ctx, p, T) ? 'open' : 'voorbij'}</td></tr>`; };
  const sel = `<label class="db-k"><span class="lbl2">Bekijk</span><select class="fld sm" id="dbSel" aria-label="Werkgebied, regio of standplaats">${L.map(x => `<option value="${esc(x.v)}"${x === k ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select></label>`;
  const VL = d.V.slice(0, 60);
  return `<section class="db" aria-labelledby="db-titel"><div class="db-h"><h2 id="db-titel">${ic('grid', 18)}Dashboard</h2>${sel}<span class="hint">vandaag tot ${hhmm(T)} · de 29 dagen ervoor zijn gesimuleerde historie · bedragen en CO2 zijn schattingen</span></div>
    <div class="db-grid">
      ${blok('tijd', 'Op tijd, te laat, gemist', 'een stop telt bij aankomst', T0, true, '')}
      ${blok('vraag', 'Open ritten en invulling', 'pool van vandaag en 29 dagen historie, gesimuleerd', T1, true, kost ? '' : 'Kosten zijn zichtbaar voor regiomanager en directie.')}
      ${blok('bezet', 'Bezetting tegen behoefte', 'nodig tegen beschikbaar, uit het plan van vandaag', T2, true, 'Tekortdag: een open rit bleef open of ging naar een charter. Overschotdag: geen open rit, of alleen eigen mensen nodig. Het model van de bezetting per dag en dagdeel haakt hier straks aan.')}
      ${blok('kosten', 'Kosten, kilometers en wachten', 'uit het dagplan', T3, true, 'Lege kilometers: stukken zonder lading, zoals de terugweg na de laatste stop; retouren als lege kratten tellen als leeg. Kosten: uren maal 33 euro plus km maal 55 cent (diesel) of 35 cent (elektrisch), zoals bij Open ritten.')}
      ${blok('rij', 'Rij- en rusttijden', 'vandaag, EU 561/2006 en de cao', T4, true, 'De weigeringen van de toets op het planbord worden nog niet geteld. De week- en tweeweekgrens komt met de tellers per chauffeur.')}
      ${blok('duurzaam', 'Duurzaamheid', 'CO2 met de factoren hieronder', T5, true, '')}
    </div>
    ${rijen.length ? `<section class="card db-b" aria-labelledby="db-sp"><div class="card-h"><h2 id="db-sp">Per standplaats</h2><span class="sub">vandaag · klik een naam om alleen die standplaats te zien</span></div><div class="card-b" style="overflow-x:auto"><table class="tbl plain compact db-tbl"><thead><tr><th>Standplaats</th><th class="r">Op tijd</th><th class="r">Ritten</th><th class="r">CO2 per rit</th><th class="r">Elektrisch</th><th class="r">Lege km</th><th class="r">Wachten</th></tr></thead><tbody>${rijen.map(r => `<tr><td><button class="lnk" type="button" data-dbsp="${esc(r.s.n)}">${esc(r.s.n)}</button></td><td class="r">${r.ot === null ? '–' : pct1(r.ot)}</td><td class="r">${fmt(r.ritten)}</td><td class="r">${fmt(Math.round(r.co2r))} kg</td><td class="r">${Math.round(r.ev)} %</td><td class="r">${nl1(r.leeg)} %</td><td class="r">${nl1(r.wacht)} min</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    <section class="card db-b" id="db-dz" tabindex="-1" aria-labelledby="db-dzt"><div class="card-h"><h2 id="db-dzt">Duurzame voorstellen van vandaag</h2><span class="sub">${fmt(d.V.length)} voorstellen · ${fmt(Math.round(DZ.somVan(d.V).co2))} kg CO2 en ${eur(DZ.somVan(d.V).euro)} als alles was gebruikt · schatting</span></div><div class="card-b">
      <p class="hint" style="margin-bottom:8px">De planner past een voorstel toe of wijst het af in de Assistent, onder Voorstellen; voorbij betekent dat de rit al begon. Per soort: ${Object.keys(DZ.SOORTEN).map(s => { const x = DZ.somVan(d.V).per[s]; return `${KORT[s]} ${x ? `${fmt(x.n)} (${fmt(Math.round(x.co2))} kg)` : '0'}`; }).join(', ')}.${ctx.can('act') ? ` <button class="lnk" type="button" data-dbassist="1">Open de voorstellen in de Assistent</button>` : ''}</p>
      ${VL.length ? `<div style="overflow-x:auto"><table class="tbl plain compact db-tbl"><thead><tr><th>Soort</th><th>Voorstel</th><th>Standplaats</th><th class="r">CO2</th><th class="r">Euro</th><th>Besluit</th></tr></thead><tbody>${VL.map(dzRij).join('')}</tbody></table></div>${d.V.length > VL.length ? `<p class="hint">En nog ${fmt(d.V.length - VL.length)} kleinere voorstellen.</p>` : ''}` : '<p class="hint">Geen voorstellen in deze keuze vandaag.</p>'}
      <details class="db-bron"><summary>De factoren en hun bron</summary><div style="overflow-x:auto"><table class="tbl plain compact db-tbl"><thead><tr><th>Factor</th><th class="r">Waarde</th><th>Status</th><th>Bron en datum</th></tr></thead><tbody>${Object.values(DZ.F).map(f => `<tr><td class="db-wrap db-f">${esc(f.eenheid)}</td><td class="r">${esc(String(f.w).replace('.', ','))}</td><td>${esc(DZ.STATUS[f.status])}</td><td class="db-wrap">${esc(f.bron)} (${esc(f.datum)})</td></tr>`).join('')}</tbody></table></div></details>
    </div></section></section>`;
}

// ---------- tekenen: kleine lijntjes en een grafiek per blok ----------
let charts = [];
function spark(U, el, data, host) {
  const w = Math.max(80, Math.floor(el.clientWidth || 160)); const c = kleur(host, '--viz-1', '#2A78D6');
  const lo = Math.min(...data), hi = Math.max(...data); const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  try { return new U({ width: w, height: 30, padding: [3, 2, 3, 2], cursor: { show: false }, legend: { show: false }, select: { show: false }, scales: { x: { time: false }, y: { range: () => [lo - pad, hi + pad] } }, axes: [{ show: false }, { show: false }], series: [{}, { stroke: c, width: 1.5, points: { show: true, size: 4, fill: c, filter: () => [data.length - 1] } }] }, [data.map((_, i) => i), data], el); } catch (err) { console.warn('lijntje', err); return null; }
}
const GRAF = { tijd: ['optijd'], vraag: ['open', 'gemist'], bezet: ['tekort', 'overschot'], kosten: ['leeg'], rij: ['grens'], duurzaam: ['co2'] };
export function tekenDash(ctx, host) {
  for (const c of charts) { try { c.destroy(); } catch { /* al weg */ } } charts = [];
  const T = ctx.ui.dbTegels || []; const d = ctx.ui.dbData; if (!d) return;
  const root = host.closest('.slct') || document.body;
  laadUP().then(U => { if (!host.isConnected) return; for (const x of T) { if (!x.reeks) continue; const el = host.querySelector(`[data-spark="${x.id}"]`); if (el && !el.firstChild) { const u = spark(U, el, x.reeks, root); if (u) charts.push(u); } } host.dataset.getekend = '1'; }).catch(err => console.warn('grafiek', err));
  for (const [id, ids] of Object.entries(GRAF)) {
    const el = host.querySelector(`[data-dbgraf="${id}"]`); if (!el) continue; const S = ids.map(i => T.find(x => x.id === i)).filter(Boolean); if (!S.length) continue;
    // een reeks van 29 punten (de historie tot gisteren) staat op de dagen ervoor, niet op vandaag
    const f = S[0].f; const all = S.flatMap(x => x.reeks); const lo = id === 'tijd' ? Math.max(50, Math.floor((Math.min(...all, 95) - 1) / 5) * 5) : 0; const xs = d.dagen.slice(0, S[0].reeks.length);
    charts.push(tijdreeks(el, { x: xs.map(w => w.k), xLabel: 'Dag', fmtX: k => { const w = d.dagen.find(x => x.k === Math.round(k)); return w ? w.l.replace(/^\S+\s/, '') : ''; }, xStap: 7, fmtY: f, fmtAs: f, yMin: lo, yMax: id === 'tijd' ? 100 : undefined, yStap: id === 'tijd' ? 5 : undefined, hoogte: 150, ref: id === 'tijd' ? { v: 95, label: 'doel 95 %', links: true } : null, label: `${S.map(x => x.l).join(' en ')}, laatste dertig dagen`, series: S.map((x, i) => ({ label: x.l, data: x.reeks, accent: i === 0, laatste: i === 0 })) }));
  }
}

// ---------- doorklikken: de lijst erachter, met het filter van de keuze ----------
const TABEL = { ritten: c => c.ui.ritTable, voertuigen: c => c.ui.vTable, chauffeurs: c => c.ui.cTable, meldingen: c => c.ui.meldTable };
export function doorklik(ctx, ga) {
  const [v, f, w] = String(ga).split(':'); const d = ctx.ui.dbData;
  if (v === 'dz') { const s = document.getElementById('db-dz'); if (s) { s.scrollIntoView({ block: 'start' }); s.focus({ preventScroll: true }); } return; }
  if (!TABEL[v]) { ctx.go(`view:${v}`); return; }
  ctx.go(`lijst:${v}:`); const tb = TABEL[v](ctx); if (!tb) return;
  tb.resetFilters(); if (v === 'meldingen' && w) tb.setSearch(w);
  const alles = !d || d.sps.length === ctx.spsInScope().length;
  if (!alles && tb.st && tb.st.f && tb.st.f.sp) tb.setFilter('sp', d.sps.map(s => s.n));
  if (f && w && v !== 'meldingen') tb.setFilter(f, [w]);
}
export function bindDash(ctx, el, render) {
  on(el, 'click', '[data-db]', (e, b) => doorklik(ctx, b.dataset.db));
  on(el, 'click', '[data-dbassist]', () => { ctx.ui.assistTab = 'voorstellen'; ctx.toggleAssist(true); });
  on(el, 'click', '[data-dbsp]', (e, b) => { ctx.ui.dbSel = `sp:${b.dataset.dbsp}`; ctx.store.set('sl-dashboard', ctx.ui.dbSel); render(); const s = el.querySelector('#dbSel'); if (s) s.focus(); });
  el.addEventListener('change', e => { const s = e.target; if (!(s instanceof HTMLSelectElement) || s.id !== 'dbSel') return; ctx.ui.dbSel = s.value; ctx.store.set('sl-dashboard', s.value); render(); const s2 = el.querySelector('#dbSel'); if (s2) s2.focus(); });
}
