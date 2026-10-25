// Gesimuleerde vloot 4.0: motorvoertuigen (trekkers, bakwagens, bestelbussen) en losse opleggers.
// Chauffeurs hebben geen vaste wagen: per dienst krijgt een chauffeur een voertuig uit de pool van de standplaats, en een
// deel van de trekkers rijdt 's middags of 's avonds een tweede dienst met een andere chauffeur. Opleggers worden aan een
// dock gekoppeld, bij de laatste winkel of een DC gewisseld (drop & swap) en na de rit aan een dock afgekoppeld; een losse
// oplegger staat op het terrein, bij een DC of bij een winkel, geladen of leeg. Elk voertuig heeft een vast dagplan
// (segmenten in minuten vanaf de eerste dienst) en elke oplegger een tijdlijn; de positie op elk tijdstip volgt daaruit,
// zodat kaart, planbord, opleggerbord, hal-scherm en replay kloppen.
//
// De dag is geijkt op de cijfers uit het onderzoeksmemo (§1.4; alles een schatting voor de simulatie): een dienst in de
// winkeldistributie duurt 8,5 tot 11 uur (mediaan rond 9,5), netwerk en bulk langer met minder stops; rijden is 45 tot 60
// procent van de dienst, de rest is laden aan het dock, wachten, lossen, koppelen en pauze. De eerste dienst begint tussen
// 02:00 en 07:00; een kwart tot een derde van de vloot rijdt 's middags of 's avonds een tweede dienst. Pauzes volgens
// EU 561/2006: uiterlijk na 4,5 uur rijden 45 minuten (of 15 + 30), hoogstens 9 uur rijden per dienst (een kwart van de
// diensten gebruikt vandaag een van de twee verlengingen per week tot 10 uur), en na 5 uur werk zonder pauze een pauze
// (Arbeidstijdenbesluit vervoer). Elektrische voertuigen laden tussen ritten als de volgende rit niet meer in de accu past.
import { SP, TOWNS, DIV, ST, laadpunten, WINKELS, DCS, BEZORG, dcById, winkelById, toegangVan, plekNaam, laadGebouwen, dockPos } from './places.js';
import { nearestNode, shortestPath, buildPath, posAt, kmBetween, warmTree, connected, nodes as GN } from './roads.js';
// De vraagkant (open ritten, prognose, voorkeuren, de flexibele schil): src/voorkeuren.js en src/inzet.js, gesimuleerd.
import { voorkeurenVan, tevredenheid, past, ritKenmerken, reeks, dienstdeel, weekdagVan, isoDag, WEEKDAGEN, WEEKDAG_NAAM, DIENSTDELEN, DIENSTDEEL_NAAM, SEED as VSEED } from './voorkeuren.js';
import { CHARTERS, OPROEP, eigenKandidaat, oproepKandidaat, charterKandidaat, rangschik, toewijzing, WAARSCHUWINGEN, WAARSCHUWING_KORT, KM_KOST } from './inzet.js';

let seed = 20261024; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const gen = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };   // eigen reeks (pool)
const pick = a => a[Math.floor(rnd() * a.length)];
const r = (a, b) => a + rnd() * (b - a);
const hash01 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
export const FIRST = ['Kees', 'Jan', 'Piet', 'Henk', 'Robert', 'Marco', 'Dennis', 'Jeroen', 'Sandra', 'Linda', 'Mohammed', 'Ahmed', 'Daan', 'Bram', 'Sven', 'Ruud', 'Gerrit', 'Wesley', 'Marieke', 'Anouk', 'Jolanda', 'Patrick', 'Nick', 'Erik', 'Rick', 'Ilse', 'Fatima', 'Jos', 'Ton', 'Peter', 'Youssef', 'Lars', 'Niels', 'Femke', 'Bas', 'Tom', 'Kevin', 'Martijn'];
export const LAST = ['de Vries', 'Bakker', 'Jansen', 'Visser', 'Smit', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker', 'Brouwer', 'Koning', 'Vermeulen', 'Schouten', 'Groot', 'Vlaar', 'Koster', 'van Dijk', 'Meijer', 'de Jong', 'Willems', 'Kooijman', 'Blokker', 'Ruiter', 'Beemster', 'Zwaan', 'Mol', 'Karsten', 'Timmerman', 'Bruin', 'Hoogland', 'Ott', 'Laan', 'Zeeman', 'Doodeman'];

// Soorten motorvoertuigen en opleggers.
export const KIND = { trekker: { n: 'Trekker', mv: 'trekkers' }, bakwagen: { n: 'Bakwagen', mv: 'bakwagens' }, bus: { n: 'Bestelbus', mv: 'bestelbussen' } };
export const TRT = {
  koel: { n: 'Koeloplegger', temp: [2, 4] }, vries: { n: 'Vriesoplegger', temp: [-22, -18] }, droog: { n: 'Gesloten oplegger' }, huif: { n: 'Schuifzeiloplegger' },
  lzv: { n: 'LZV-combinatie' }, silo: { n: 'Silo-oplegger' }, drank: { n: 'Drankenoplegger' }, city: { n: 'City-oplegger' },
};
export const TRST = {
  gekoppeld: { n: 'Gekoppeld', color: '#16A34A' }, klaar: { n: 'Klaar voor vertrek', color: '#0E7490' }, geladen: { n: 'Geladen bij klant', color: '#2563EB' },
  wacht: { n: 'Wacht op ophalen', color: '#D97706' }, ophalen: { n: 'Wordt opgehaald', color: '#7C3AED' }, leeg: { n: 'Leeg op terrein', color: '#9CA3AF' }, onderhoud: { n: 'In onderhoud', color: '#DC2626' },
};
const TRMIX = { winkel: [['koel', 45], ['vries', 15], ['droog', 28], ['city', 12]], netwerk: [['droog', 45], ['huif', 20], ['koel', 20], ['lzv', 15]], bulk: [['silo', 100]], dranken: [['drank', 70], ['huif', 30]] };
const TRRATIO = { winkel: 1.6, netwerk: 1.45, bulk: 1.15, dranken: 1.3 };
const wpick = (mix, R = rnd) => { let x = R() * 100; for (const [k, w] of mix) { x -= w; if (x <= 0) return k; } return mix[0][0]; };

const MODELS = {
  ev: [['Mercedes-Benz eActros 600', 500], ['Mercedes-Benz eActros 300', 300], ['Volvo FH Electric', 300]],
  diesel: [['Mercedes-Benz Actros 1845', 1600], ['Scania R 450', 1700], ['DAF XF 480', 1600], ['Volvo FH 460', 1600], ['Scania 460 R Super', 1800]],
  bak: [['DAF XD 310 bakwagen', 620], ['Mercedes-Benz Atego 1527 bakwagen', 650]], bakEv: [['Mercedes-Benz eActros 300 bakwagen', 280]],
  van: [['Volkswagen e-Crafter', 120], ['Mercedes-Benz eSprinter', 180]],
};
const LADING = {
  winkel: ['Gekoelde zuivel en vlees, 26 rolcontainers', 'Droge kruidenierswaren, 33 pallets', 'Diepvries, 24 pallets', 'AGF, 30 rolcontainers', 'Brood en banket, 28 rolcontainers', 'Non-food en drogisterij, 31 pallets'],
  netwerk: ['Groupage, 18 pallets voor 4 adressen', 'FTL, 33 pallets gekoeld', 'Crossdock Tiel, 26 pallets', 'Dubbeldeks, 52 pallets', 'Retouren en emballage, 20 pallets'],
  bulk: ['Bulkpoeder, 26 ton', 'Granulaat, 24 ton', 'Suiker (bulk), 27 ton', 'Zetmeel, 25 ton'],
  dranken: ['Bier en fris, 26 pallets', 'Lege emballage retour', 'Fustbier, 24 pallets', 'Water en sap, 28 pallets'],
  bezorg: ['Boodschappen, 48 bestellingen', 'Boodschappen, 36 bestellingen', 'Boodschappen, 52 bestellingen'],
};
const STORING = ['Bandenspanning as 2 laag (melding boordcomputer)', 'AdBlue-niveau laag, 180 km resterend', 'Melding uitlaatgasnabehandeling, vermogen begrensd'];
export const KOELSTORING = 'Koelunit haalt het doel niet: -12 °C bij doel -20 °C';
// Kentekens in de vorm van de RDW, maar altijd met een Q: die letter geeft de RDW niet uit, dus geen kenteken valt samen met een echt voertuig.
const plate = kind => { const L = 'BDFGHJKLNPRSTVXZ'; const l = () => L[Math.floor(rnd() * L.length)]; const q = () => { l(); return 'Q'; }; const d = () => Math.floor(rnd() * 10); return kind === 'bus' ? `V-${d()}${d()}${d()}-${q()}${l()}` : kind === 'oplegger' ? `O${q()}-${d()}${d()}-${l()}${l()}` : `${d()}${d()}-${l()}${q()}${l()}-${d()}`; };

// ---------- plekken: standplaatsen, winkels, DC's en bezorgpunten op hun echte adres ----------
// Elke plek heeft een knoop in de routeergraaf (node, uit src/data) en een toegangsroute over echte straten van die knoop
// tot de poort (standplaats, DC) of de weg voor de deur (winkel). Zonder opgeslagen knoop: de dichtstbijzijnde.
for (const s of SP) if (typeof s.node !== 'number') s.node = nearestNode(s.lon, s.lat);
for (const t of TOWNS) t.node = nearestNode(t.lon, t.lat);
const bruikbaar = p => p && typeof p.node === 'number' && p.node >= 0 && !p.eiland;
const kmTo = (a, b) => kmBetween([a.lon, a.lat], [b.lon, b.lat]);
const byDist = (from, list) => list.map(x => [x, kmTo(from, x)]).sort((a, b) => a[1] - b[1] || (a[0].id < b[0].id ? -1 : a[0].id > b[0].id ? 1 : 0));
// Waar een vrachtwagen bij een plek staat: het eind van de toegangsroute (op het terrein of voor de deur).
export function deurVan(p) { const a = toegangVan(p); return a ? a[a.length - 1] : [p.lon, p.lat]; }
// Id van een plek zoals routeBetween die kent: 'sp:Wognum', een winkel-, DC- of bezorgpunt-id; anders de naam.
const plekId = p => !p ? null : p.fleet !== undefined ? 'sp:' + p.n : p.id || p.name || null;
// Winkels van de klant van de standplaats (formules uit places.json) binnen 80 km, op afstand; AH to go (stations) niet.
const RADIUS = { winkel: 80, bezorg: 40 };
const winkelCache = new Map();
function winkelsVoor(base) {
  let c = winkelCache.get(base.n); if (c) return c;
  const f = new Set(base.formules && base.formules.length ? base.formules : ['Albert Heijn']);
  c = byDist(base, WINKELS.filter(w => f.has(w.formule) && bruikbaar(w) && !/\bto go\b/i.test(w.naam))).filter(([, d]) => d <= RADIUS.winkel).map(x => x[0]);
  winkelCache.set(base.n, c); return c;
}
// Bezorgpunten (woonstraten) van de standplaats binnen 40 km; zonder eigen punten: winkels van de klant binnen 40 km.
const bezorgCache = new Map();
function bezorgVoor(base) {
  let c = bezorgCache.get(base.n); if (c) return c;
  const own = byDist(base, BEZORG.filter(b => b.sp === base.n && bruikbaar(b))).filter(([, d]) => d <= RADIUS.bezorg).map(x => x[0]);
  c = own.length ? own : winkelsVoor(base).filter(w => kmTo(base, w) <= RADIUS.bezorg);
  bezorgCache.set(base.n, c); return c;
}
// De dichtstbijzijnde k plekken bij een plek uit een lijst (voor een rit langs winkels die bij elkaar liggen).
const buren = (list, p, k, skip) => byDist(p, list.filter(x => x !== p && !(skip && skip.includes(x)))).slice(0, k).map(x => x[0]);
// Snel werken met een op afstand gesorteerde lijst van een standplaats: hoeveel plekken binnen maxR km liggen (een
// voorvoegsel van de lijst; geen enkele: de drie dichtstbijzijnde) en de buren van een plek binnen zo'n voorvoegsel.
const lijstInfo = new WeakMap(); const CEL = 0.04;   // rastercellen van ongeveer 3 bij 4 km
function infoVan(base, list) {
  let I = lijstInfo.get(list); if (I) return I;
  I = { d: Float64Array.from(list, p => kmTo(base, p)), idx: new Map(list.map((p, i) => [p, i])), nb: new Map(), cel: new Map() };
  list.forEach((p, i) => { const k = `${Math.floor(p.lon / CEL)}:${Math.floor(p.lat / CEL)}`; let a = I.cel.get(k); if (!a) I.cel.set(k, a = []); a.push(i); });
  lijstInfo.set(list, I); return I;
}
// de 24 dichtstbijzijnde plekken van de lijst bij p (indices, op afstand), via het raster: ringen tot er genoeg zijn
function nabij(I, list, p) {
  let nb = I.nb.get(p); if (nb) return nb;
  const cx = Math.floor(p.lon / CEL), cy = Math.floor(p.lat / CEL); const kand = [];
  for (let r = 0; r <= 40; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const a = I.cel.get(`${cx + dx}:${cy + dy}`); if (a) for (const j of a) if (list[j] !== p) kand.push(j); }
    if (kand.length >= 24 && r >= 1) { if (r >= 2 || kand.length >= 40) break; }
  }
  nb = kand.map(j => [j, kmTo(p, list[j])]).sort((x, y) => x[1] - y[1] || (list[x[0]].id < list[y[0]].id ? -1 : list[x[0]].id > list[y[0]].id ? 1 : 0)).slice(0, 24).map(x => x[0]);
  I.nb.set(p, nb); return nb;
}
function binnen(base, list, maxR) {
  if (!(maxR < Infinity)) return list.length;
  const d = infoVan(base, list).d; let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (d[m] <= maxR) lo = m + 1; else hi = m; }
  return lo || Math.min(3, list.length);
}
function burenIn(base, list, n, p, k, skip) {
  const I = infoVan(base, list); const nb = nabij(I, list, p);
  const out = []; for (const j of nb) if (j < n && !(skip && skip.includes(list[j]))) { out.push(list[j]); if (out.length === k) return out; }
  return out.length >= Math.min(k, n - 1 - (skip ? skip.length : 0)) ? out : buren(list.slice(0, n), p, k, skip);
}
// Verre bestemmingen op echte posities: netwerk naar DC's en fabrieken, bulk naar de fabrieken van Cosun en FrieslandCampina,
// dranken naar supermarkt-DC's en groothandels. Niet op de eigen standplaats, en binnen een dagrit.
const SUPER = new Set(['Albert Heijn', 'Jumbo', 'Plus', 'Lidl', 'SPAR', 'Vomar', 'Aldi', 'Dirk', 'Etos']);
const verCache = new Map();
function verVoor(base, div, soort) {
  const key = `${base.n}|${div}|${soort || ''}`; let c = verCache.get(key); if (c) return c;
  const ok = d => bruikbaar(d) && d.sp !== base.n && (div === 'netwerk' ? (d.soort === 'dc' || d.soort === 'fabriek')
    : div === 'bulk' ? d.soort === 'fabriek' && (d.formule === 'Cosun' || d.formule === 'FrieslandCampina')
      : soort === 'groothandel' ? d.soort === 'groothandel' : d.soort === 'dc' && SUPER.has(d.formule));
  const [lo, hi] = div === 'bulk' ? [15, 240] : div === 'dranken' ? [10, 220] : [25, 230];
  c = byDist(base, DCS.filter(ok)).filter(([, d]) => d >= lo && d <= hi).map(x => x[0]);
  if (!c.length) c = byDist(base, DCS.filter(ok)).slice(0, 6).map(x => x[0]);
  verCache.set(key, c); return c;
}
const STOPNAME = { winkel: ['AH', 'AH', 'Jumbo', 'Plus', 'Lidl', 'SPAR', 'Vomar'], bezorg: ['Bezorgronde'], netwerk: ['DC', 'Crossdock', 'Klant'], bulk: ['Fabriek', 'Silo'], dranken: ['Horeca-depot', 'Groothandel', 'Supermarkt-DC'] };
// Stopnaam: de echte naam van de winkel of het DC met de plaats ("Albert Heijn Laat, Alkmaar"), een eigen vestiging als
// "Simon Loos Tiel", een bezorgronde met plaats en straat. Een plek zonder naam (oude data) krijgt de soort en de plaats.
const stopName = (div, klant, t) => {
  if (t && (t.naam || t.fleet !== undefined)) return plekNaam(t);
  return `${pick(STOPNAME[div] || STOPNAME.netwerk)} ${t ? t.n : ''}`;
};

// Een rit als één aaneengesloten lijn: van de poort over de toegangsroute naar de routeergraaf, over de graaf naar de
// volgende plek en over diens toegangsroute tot de deur; daarna dezelfde toegangsroute terug naar de graaf, enzovoort.
// Geeft { pts, cum, nodeKm, total } zoals buildPath; nodeKm[i] is de km waarop plek i van de reeks bereikt wordt.
function routeOver(seq) {
  const pts = [], cum = [], at = [];
  const push = p => { if (pts.length) { const d = kmBetween(pts[pts.length - 1], p); if (d < 0.0005) return; cum.push(cum[cum.length - 1] + d); } else cum.push(0); pts.push(p); };
  const back = p => { const a = toegangVan(p); if (a) for (let k = a.length - 1; k >= 0; k--) push(a[k]); else push(GN[p.node]); };
  back(seq[0]); at.push(0);
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (i > 1) back(a);
    for (const p of buildPath(shortestPath(a.node, b.node)).pts) push(p);
    const bb = toegangVan(b); if (bb) for (const p of bb) push(p);
    at.push(cum[cum.length - 1]);
  }
  return { pts, cum, nodeKm: at, total: cum[cum.length - 1] };
}

// Stops van een rit kiezen (met een eigen toevalsbron R): winkelrit langs 1 tot 3 winkels van de klant die bij elkaar liggen
// (eerst laden bij een DC elders als de vacature dat zegt), pendel naar een DC, bezorgronde langs twee woonstraten, of één
// verre bestemming (netwerk soms met een eigen vestiging erbij). maxR: alleen plekken binnen zoveel km (elektrisch).
function kiesStops(base, div, R = rnd, maxR = Infinity) {
  const P = (a, n = a ? a.length : 0) => a && n > 0 ? a[Math.floor(R() * n)] : null;
  let stops;
  if (div === 'winkel') {
    const c = winkelsVoor(base), n = binnen(base, c, maxR); const laad = base.laad ? dcById.get(base.laad) : null; const pendel = base.pendel ? dcById.get(base.pendel) : null;
    if (pendel && R() < 0.5 && kmTo(base, pendel) <= maxR) stops = [pendel];   // LZV-pendel naar een DC elders (vacature Heerenveen: SPAR DC Waalwijk)
    else {
      const u = R(); const aantal = u < 0.35 ? 1 : u < 0.8 ? 2 : 3;
      const s1 = P(c, n); stops = [s1];
      if (s1 && aantal > 1) { const s2 = P(burenIn(base, c, n, s1, 8)); stops.push(s2); if (s2 && aantal > 2) stops.push(P(burenIn(base, c, n, s2, 8, [s1]))); }
      if (laad) stops.unshift(laad);   // eerst laden bij het DC (vacature Heinenoord: Plus DC Oss)
    }
  } else if (div === 'bezorg') { const c = bezorgVoor(base), n = binnen(base, c, maxR); const p1 = P(c, n); stops = [p1, p1 ? P(burenIn(base, c, n, p1, 6)) : null]; }
  else {
    const c = verVoor(base, div, div === 'dranken' && R() < 0.5 ? 'groothandel' : null); stops = [P(c, binnen(base, c, maxR))];
    if (div === 'netwerk' && R() < 0.5) stops.push(SP.find(s => s.n === P(['Tiel', 'Geldermalsen', 'Wognum'])));
  }
  return stops.filter((s, i, a) => s && a.indexOf(s) === i && s !== base);
}
function bouwRit(base, div, klant, stops) {
  const seq = [base, ...stops, base];
  const path = routeOver(seq);
  return { seq, path, marks: seq.map((p, i) => ({ place: p, km: path.nodeKm[i], name: i === 0 || i === seq.length - 1 ? base.n : stopName(div, klant, p) })), total: path.total };
}
const makeRoute = (base, div, klant, R = rnd, maxR = Infinity) => bouwRit(base, div, klant, kiesStops(base, div, R, maxR));
// Parkeerplekken op het terrein van een standplaats (rijen uit places.json): voertuigen van voren af, opleggers van achteren.
function yardSlots(sp) {
  if (sp._slots) return sp._slots;
  const out = [];
  for (const [x0, y0, x1, y1, n, b] of sp.rijen || []) for (let k = 0; k < n; k++) { const f = n > 1 ? k / (n - 1) : 0; out.push({ lon: x0 + (x1 - x0) * f, lat: y0 + (y1 - y0) * f, bearing: b }); }
  if (!out.length) { const g = sp.poort || [sp.lon, sp.lat]; for (let k = 0; k < 40; k++) out.push({ lon: g[0] + ((k % 10) - 4.5) * 0.00007, lat: g[1] + (Math.floor(k / 10) - 1.5) * 0.0003, bearing: 0 }); }
  return (sp._slots = out);
}
const slotPos = (sp, k, fromEnd) => { const sl = yardSlots(sp); const n = sl.length; const p = sl[fromEnd ? n - 1 - (k % n) : k % n]; return { lon: p.lon, lat: p.lat, bearing: p.bearing }; };
// Een oplegger achtergelaten bij een winkel of DC: naast de plek waar de vrachtwagen stond (een paar meter verschoven).
const naastDeur = (p, k) => { const d = deurVan(p); return { lon: d[0] + 0.00005 + (k % 3) * 0.00004, lat: d[1] + 0.00003 }; };

// ---------- ijking van de dag (schattingen; zie de kop van dit bestand) ----------
// Eerste dienst: start tussen 02:00 en 07:00 (driehoek, de meeste rond het midden); bezorging 05:00 tot 07:00.
const START1 = { winkel: [120, 420], netwerk: [150, 420], bulk: [180, 420], dranken: [240, 420], bezorg: [300, 420] };
// Tweede dienst (middag- of avondploeg, andere chauffeur): gewenste start; nooit eerder dan het einde van de eerste dienst
// plus wisseltijd, en klaar voor de eerste dienst van de volgende dag.
const START2 = { winkel: [780, 1020], netwerk: [840, 1110], bulk: [780, 960], dranken: [780, 900], bezorg: [900, 960] };
// Doellengte van een dienst [kort, lang, scheefheid] in minuten (winkel: 8,5 tot 11 uur, mediaan rond 9,5).
const LEN = { winkel: [535, 665, 1.45], netwerk: [580, 700, 1.2], bulk: [595, 705, 1.2], dranken: [510, 630, 1.2], bezorg: [270, 450, 1] };
// Kans op een tweede dienst op hetzelfde voertuig (onder de voertuigen die vandaag rijden): samen 25 tot 35 % van de vloot.
const SECOND = { winkel: 0.36, netwerk: 0.39, bulk: 0.28, dranken: 0.24, bezorg: 0.5 };
// Lossen per stop (minuten, zonder wachten).
const DWELL = { winkel: [25, 45], netwerk: [40, 70], bulk: [55, 90], dranken: [35, 60], bezorg: [60, 110] };
// Rijduur van een stuk rit: een vaste opslag voor de stad (optrekken, kruispunten, de laatste straten tot de deur) plus de
// afstand tegen de kruissnelheid van het voertuig; in het plan per stuk tot 12 procent langzamer (verkeer).
const LEG0 = { trekker: 5, bakwagen: 4, bus: 3 };
const legMin = (t, km) => (LEG0[t.kind] || 4) + km / t.speed * 60;
const DOCK_IN = t => (t.kind === 'trekker' ? 12 : t.kind === 'bus' ? 15 : 20);   // koppelen of laden aan het dock (schatting)
const DOCK_UIT = 9;   // afkoppelen of retouren lossen aan het dock
// Wachttijd bij een stop (D4): minuten op de plek voordat het lossen begint. Gemiddelde per soort plek en dagdeel (nacht
// 22-06, ochtend 06-11, middag 11-17, avond 17-22), per adres een vaste factor van 0,5 tot 1,7 (het ene DC is trager dan
// het andere), per stop een exponentiële spreiding (meestal kort, soms lang, hoogstens vier keer het gemiddelde). Wie voor
// het venster aankomt, wacht tot het venster opengaat. Ijkpunt: Slimste, 35 tot 60 minuten wachten per truck per dag.
export const DAGDELEN = ['nacht', 'ochtend', 'middag', 'avond'];
const WACHT = { winkel: [3, 8, 6, 4], dc: [14, 32, 20, 12], fabriek: [12, 26, 18, 12], groothandel: [8, 18, 12, 8], standplaats: [6, 14, 10, 6], bezorg: [0, 1, 1, 1] };
const dagdeelVan = m => { const h = (((m % 1440) + 1440) % 1440) / 60; return h < 6 || h >= 22 ? 0 : h < 11 ? 1 : h < 17 ? 2 : 3; };
const BEZORGSET = new Set(BEZORG);
export const plekSoort = p => !p ? 'onbekend' : p.fleet !== undefined ? 'standplaats' : p.soort ? p.soort : BEZORGSET.has(p) ? 'bezorg' : 'winkel';
const adresFactor = p => 0.5 + 1.2 * hash01('w' + (p.id || p.n || p.name || ''));
const wachtVerwacht = (p, minuut) => (WACHT[plekSoort(p)] || WACHT.winkel)[dagdeelVan(minuut)] * adresFactor(p);
const wachtTrek = (p, minuut, R = rnd) => { const m = wachtVerwacht(p, minuut); return Math.round(Math.min(4 * m, -m * Math.log(1 - R() * 0.999))); };
// EU 561/2006: hoogstens 4,5 uur rijden zonder pauze van 45 minuten (of 15 + 30); de planner plant de pauze met wat speling
// (na 225 tot 265 minuten rijden, per dienst verschillend).
const RIJ_MAX = 270, PAUZE = 45, PAUZE_DEEL = 30;
// Geschatte pauzetijd in een dienst: EU-pauzes naar rijtijd (een laadbeurt tussen twee ritten telt als pauze), anders de
// pauze uit het Arbeidstijdenbesluit (na meer dan 5,5 uur werk).
const pauzeSchatting = (rij, werk, laad) => { const n = Math.max(0, (rij > 2 * 245 ? 2 : rij > 245 ? 1 : 0) - laad); return n * PAUZE + (!n && !laad && werk > 330 ? (werk > 540 ? PAUZE : PAUZE_DEEL) : 0); };

export function createFleet(opts = {}) {
  const trucks = []; const trailers = []; const trailerPool = new Map(); const driverPool = new Map();
  // De gesimuleerde dag is vandaag (de datum van de computer, of opts.datum); de weekdag stuurt de prognose van de pool.
  const dagNa = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const VANDAAG = (d => new Date(d.getFullYear(), d.getMonth(), d.getDate()))(opts.datum ? new Date(opts.datum) : new Date());
  const MORGEN = dagNa(VANDAAG, 1);
  let nT = 1000, nB = 300, nV = 400, nO = 5000;

  // ---------- motorvoertuigen ----------
  for (const s of SP) {
    for (let i = 0; i < s.fleet; i++) {
      const div = s.div[i % s.div.length];
      const kind = div === 'bezorg' ? 'bus' : (div === 'winkel' && rnd() < 0.12) || (div === 'dranken' && rnd() < 0.3) ? 'bakwagen' : 'trekker';
      const evShare = { winkel: 0.22, bezorg: 0.6, dranken: 0.2, netwerk: 0.12, bulk: 0.05 }[div];
      const ev = kind === 'bus' || rnd() < evShare;
      const [model, range] = pick(kind === 'bus' ? MODELS.van : kind === 'bakwagen' ? (ev ? MODELS.bakEv : MODELS.bak) : ev ? (div === 'netwerk' || div === 'bulk' ? [MODELS.ev[0]] : MODELS.ev) : MODELS.diesel);
      const u = rnd(); const vandaag = u < 0.04 ? 'reserve' : u < 0.07 ? 'onderhoud' : 'inzet';
      const t = {
        id: kind === 'trekker' ? `T-${nT++}` : kind === 'bakwagen' ? `B-${nB++}` : `V-${nV++}`, idx: trucks.length + 1, kind, plate: plate(kind), base: s, div, van: kind === 'bus', ev, model, range,
        klant: s.klant, speed: kind === 'bus' ? 55 : kind === 'bakwagen' ? 72 : div === 'bulk' ? 76 : div === 'netwerk' ? 82 : 78,
        vandaag, diensten: [], storing: null, lzv: false, lading: null, since: 2016 + Math.floor(rnd() * 11),
      };
      trucks.push(t);
    }
  }

  // ---------- opleggers per standplaats (verhouding per divisie; meer opleggers dan trekkers: drop & swap) ----------
  for (const s of SP) {
    const perDiv = {}; for (const t of trucks) if (t.base === s && t.kind === 'trekker') perDiv[t.div] = (perDiv[t.div] || 0) + 1;
    const pool = []; trailerPool.set(s.n, pool);
    for (const [div, n] of Object.entries(perDiv)) {
      const cnt = Math.max(n + 1, Math.round(n * TRRATIO[div]));
      for (let i = 0; i < cnt; i++) {
        const type = wpick(TRMIX[div]); const u = rnd();
        const tr = { id: `O-${nO++}`, plate: plate('oplegger'), type, div, base: s, bouwjaar: 2015 + Math.floor(rnd() * 11), events: [], busyUntil: -1, lading: null, onderhoud: u < 0.04, yardLoaded: u >= 0.04 && u < 0.3, seeded: null, storing: null, uses: 0 };
        if (tr.yardLoaded) tr.lading = pick(LADING[div]);
        trailers.push(tr); pool.push(tr);
      }
    }
  }
  // Vaste parkeerplek op het terrein: voertuigen en opleggers op volgorde per standplaats (geen toeval).
  { const nv = new Map(), nt = new Map(); for (const t of trucks) { t.slot = nv.get(t.base) || 0; nv.set(t.base, t.slot + 1); } for (const tr of trailers) { tr.slot = nt.get(tr.base) || 0; nt.set(tr.base, tr.slot + 1); } }
  // Routes vanaf en naar de standplaatsen (en de DC's waar eerst geladen wordt) gebruiken een vooraf gerekende boom.
  for (const s of SP) { warmTree(s.node); for (const k of [s.laad, s.pendel]) if (k && dcById.get(k)) warmTree(dcById.get(k).node); }
  // Losse opleggers bij winkels van gisteren (gewisseld, wachten op ophalen): een paar per standplaats met winkeldistributie,
  // bij een echte winkel van de klant binnen 60 km, naast de plek waar de vrachtwagen stond.
  for (const s of SP) {
    const pool = (trailerPool.get(s.n) || []).filter(tr => tr.div === 'winkel' && !tr.onderhoud && !tr.yardLoaded);
    const towns = winkelsVoor(s).filter(w => kmTo(s, w) <= 60); if (!towns.length) continue;
    for (let i = 0; i < Math.min(pool.length, Math.ceil(pool.length * 0.03)); i++) {
      const tr = pool[i]; const tw = pick(towns); const a = -Math.round(r(300, 720));
      tr.seeded = { name: stopName('winkel', s.klant, tw), ...naastDeur(tw, i), plek: tw };
      tr.events.push({ k: 'site', a, b: a + 2880, place: tr.seeded, loaded: false, unloadAt: a, pickup: Math.round(r(480, 1380)), vehicle: null, by: null });
    }
  }
  const takeTrailer = (sp, div, at, loaded) => {
    const pool = trailerPool.get(sp.n) || []; let best = null;
    for (const tr of pool) { if (tr.div !== div || tr.onderhoud || tr.seeded) continue; if (tr.busyUntil <= at && (!best || tr.busyUntil < best.busyUntil)) best = tr; }
    if (!best) for (const tr of pool) { if (tr.div !== div || tr.onderhoud || tr.seeded) continue; if (!best || tr.busyUntil < best.busyUntil) best = tr; }
    if (best && loaded) best.lading = pick(LADING[div]);
    return best;
  };
  // Opleggers die een voertuig in een eerder plan gebruikte weer vrijgeven (voor een nieuw plan van dat voertuig).
  const vrijgeven = t => { for (const tr of trailers) if (tr.events.some(e => e.by === t)) { tr.events = tr.events.filter(e => e.by !== t); tr.busyUntil = tr.events.reduce((m, e) => Math.max(m, e.k === 'site' ? Infinity : e.b), -1); tr.lading = tr.yardLoaded ? tr.lading : null; } };

  // ---------- chauffeurspool per standplaats ----------
  for (const s of SP) {
    const names = new Set(); const n = Math.ceil(s.fleet * 1.7);
    while (names.size < n) names.add(`${pick(FIRST)} ${pick(LAST)}`);
    driverPool.set(s.n, { names: [...names], next: 0 });
  }
  const takeDriver = sp => { const p = driverPool.get(sp.n); const name = p.names[p.next % p.names.length]; p.next++; return name; };

  // ---------- dagplan per voertuig ----------
  const mins = (a, b) => Math.max(4, a + rnd() * (b - a));
  const budgetVan = t => t.ev ? t.range * 0.78 : Infinity;   // elektrisch: een rit of ritten tussen twee laadbeurten in 78 % van het bereik
  // Verwachte tijd bij een stop: wachten plus lossen; bij een eigen vestiging in het netwerk drop & swap (20 minuten).
  const stopTijd = (t, p, tm) => { const [a, b] = DWELL[t.div]; return t.div === 'netwerk' && p.fleet !== undefined ? 20 : wachtVerwacht(p, tm) + (a + b) / 2; };
  // Ruwe schatting van een rit voor de keuze (hemelsbreed x 1,3, zonder pad): minuten, rijminuten, km.
  function stopsSchatting(t, stops, at) {
    let prev = t.base, drive = 0, werk = DOCK_IN(t) + DOCK_UIT, tm = at + DOCK_IN(t), km = 0;
    for (const p of [...stops, t.base]) {
      const k = kmTo(prev, p) * 1.3 + 0.8; km += k; const leg = legMin(t, k) * 1.06; drive += leg; tm += leg;
      if (p !== t.base) { const s = stopTijd(t, p, tm); werk += s; tm += s; }
      prev = p;
    }
    return { min: drive + werk, drive, km };
  }
  // Hoe ver (hemelsbreed, enkele reis) een bestemming mag liggen voor een rit die in 'ruimte' minuten moet passen.
  const enkelKm = (t, ruimte) => { const [a, b] = DWELL[t.div]; const vrij = ruimte - DOCK_IN(t) - DOCK_UIT - (a + b) / 2 - 12 - 2 * (LEG0[t.kind] || 4); return Math.max(6, vrij / 2 / 1.06 * t.speed / 60 / 1.3); };
  // Schatting van een gebouwde rit (echte km per stuk): minuten zonder pauzes, rijminuten, km.
  function ritSchatting(t, rt, at) {
    let drive = 0, werk = DOCK_IN(t) + DOCK_UIT, tm = at + DOCK_IN(t);
    for (let i = 1; i < rt.marks.length; i++) { const leg = legMin(t, rt.marks[i].km - rt.marks[i - 1].km) * 1.06; drive += leg; tm += leg; if (i < rt.marks.length - 1) { const s = stopTijd(t, rt.marks[i].place, tm); werk += s; tm += s; } }
    return { min: drive + werk, drive, km: rt.total };
  }
  // Ritten voor een dienst: rit voor rit tot de doellengte. Na de eerste rit telkens tien kandidaten (ruw geschat), de beste
  // drie over de echte wegen uitgewerkt; de eerste die past wint (een korte laatste rit vult de dienst). Nooit meer rijtijd
  // dan de grens van de dienst (EU 561); elektrisch geen rit langer dan de accu en laden als de volgende rit niet meer past.
  const WISSEL = 18, LAAD_TUSSEN = 62;   // minuten op de standplaats tussen twee ritten: wisselen, of laden (telt als pauze)
  function rittenVoor(t, at, doel, maxRij, maxE = doel + 75) {
    const routes = []; let werk = 0, rij = 0, km = 0, laad = 0;
    const budget = budgetVan(t), maxR = t.ev ? t.range * 0.3 : Infinity;
    const met = e => { const lad = routes.length > 0 && km + e.km > budget; const w2 = werk + (routes.length ? (lad ? LAAD_TUSSEN : WISSEL) : 0) + e.min, r2 = rij + e.drive, l2 = laad + (lad ? 1 : 0); return { w2, r2, l2, km2: lad ? e.km : km + e.km, E2: w2 + pauzeSchatting(r2, w2, l2) }; };
    for (let n = 0; n < 6; n++) {
      const E1 = werk + pauzeSchatting(rij, werk, laad); const kand = [];
      // na de eerste rit: bestemmingen die nog in de dienst passen (hoe minder tijd over, hoe dichter bij huis)
      const straal = routes.length ? Math.min(maxR, enkelKm(t, doel + 30 - E1 - WISSEL - (rij > 150 ? PAUZE : 0))) : maxR;
      for (let c = 0; c < (routes.length ? 10 : 1); c++) {
        const stops = kiesStops(t.base, t.div, rnd, straal); if (!stops.length) continue;
        const e = stopsSchatting(t, stops, at + E1); if (e.km > budget) continue;
        const m = met(e); if (routes.length && (m.r2 > maxRij - 25 || m.E2 > Math.min(doel + 60, maxE))) continue;
        kand.push({ stops, sc: Math.abs(m.E2 - doel) });
      }
      kand.sort((x, y) => x.sc - y.sc);
      let gekozen = null;
      for (const k of kand.slice(0, 3)) {
        const rt = bouwRit(t.base, t.div, t.klant, k.stops); if (rt.total > budget) continue;
        const m = met(ritSchatting(t, rt, at + E1));
        if (routes.length && (m.r2 > maxRij - 20 || m.E2 > maxE || Math.abs(m.E2 - doel) >= Math.abs(E1 - doel))) continue;
        gekozen = { rt, ...m }; break;
      }
      if (!gekozen) break;
      routes.push(gekozen.rt); werk = gekozen.w2; rij = gekozen.r2; laad = gekozen.l2; km = gekozen.km2;
      if (gekozen.E2 >= doel - 25) break;
    }
    if (!routes.length) routes.push(fitRoute(t));
    return routes;
  }
  // elektrisch: een rit die niet binnen 78 % van het bereik past wordt opnieuw gekozen (bussen en eActros 300)
  const fitRoute = (t, R = rnd) => { const maxR = t.ev ? t.range * 0.3 : Infinity; let rt = makeRoute(t.base, t.div, t.klant, R, maxR); if (t.ev) for (let k = 0; k < 8 && rt.total > t.range * 0.78; k++) rt = makeRoute(t.base, t.div, t.klant, R, maxR); return rt; };

  function makePlan(t) {
    // eigen toevalsreeks per voertuig: opnieuw plannen (een rit of een tweede dienst erbij) laat wat al gepland was gelijk
    const rnd = gen(7919 + t.idx * 104729), mins = (a, b) => Math.max(4, a + rnd() * (b - a)), r = (a, b) => a + rnd() * (b - a);
    const segs = []; let tm = 0; let coupled = null; let driveNo = 0; let kmLaad = 0;
    const abs = rel => t.dayStart + rel;
    const trEvent = (tr, ev) => { ev.by = t; tr.events.push(ev); tr.uses++; };
    const add = s => { segs.push(s); tm = s.t1; return s; };
    const budget = budgetVan(t); const [la, lb] = DWELL[t.div];
    const laadDC = t.base.laad ? dcById.get(t.base.laad) : null, pendelDC = t.base.pendel ? dcById.get(t.base.pendel) : null;
    t.diensten.forEach((d, di) => {
      if (di > 0) {
        // tussen twee diensten: elektrisch eerst de accu vol, daarna staat het voertuig op het terrein tot de volgende chauffeur
        // (loopt de eerste dienst uit, dan begint de tweede later: minstens 30 minuten wisselen, elektrisch een uur laden)
        const start = Math.max(d.rel0, tm + (t.ev ? 60 : 30));
        if (t.ev) { add({ k: 'laden', t0: tm, t1: tm + Math.min(start - tm, mins(60, 100)), d: null, tr: null }); kmLaad = 0; }
        if (start > tm) add({ k: 'terrein', t0: tm, t1: start, d: null, tr: null });
      }
      d.t0 = tm; const begin = tm;
      // rijtijd sinds de laatste pauze (eu.drv), al 15 minuten van een gesplitste pauze genomen (eu.deel), rijtijd in de dienst
      const eu = { drv: 0, deel: false, rij: 0, pauzes: 0, grens: Math.min(RIJ_MAX - 5, Math.round(r(225, 265))) };
      const rust = len => { if (len >= PAUZE - 1e-9 || (len >= PAUZE_DEEL - 1e-9 && eu.deel)) { eu.drv = 0; eu.deel = false; eu.pauzes++; } else if (len >= 15 - 1e-9) eu.deel = true; };
      const pauze = (extra = {}) => { const len = eu.deel ? PAUZE_DEEL : PAUZE; add({ k: 'pauze', t0: tm, t1: tm + len, d: di, tr: coupled, ...extra }); rust(len); };
      // Arbeidstijdenbesluit vervoer: wie meer dan 5,5 uur werkt, heeft een pauze; op de standplaats na 5 uur werk, bij een
      // stop als de rest van de rit de dienst boven 5,5 uur brengt (en er al 3 uur gewerkt is)
      const atb = (nog = 0) => !eu.pauzes && (nog ? tm - begin >= 180 && tm - begin + nog > 315 : tm - begin >= 300);
      d.routes.forEach((rt, ri) => {
        const ritRij = rt.marks.slice(1).reduce((a, m, i) => a + legMin(t, m.km - rt.marks[i].km), 0);
        if (ri > 0) {
          // wissel op de standplaats: laden als de volgende rit niet meer in de accu past (telt als pauze), anders de pauze
          // nemen als die tijdens de volgende rit zou vallen, anders wachten op de volgende geladen oplegger
          if (t.ev && kmLaad + rt.total > budget) { const l = mins(45, 60); add({ k: 'laden', t0: tm, t1: tm + l, d: di, tr: null }); rust(l); kmLaad = 0; }
          else if ((eu.drv >= 100 && eu.drv + ritRij > eu.grens) || atb()) pauze();
          else { const w = mins(10, 25); add({ k: 'terrein', t0: tm, t1: tm + w, d: di, tr: null }); rust(w); }
        }
        // vertrek aan een dock: een trekker koppelt een geladen oplegger (de eerste keer van de dienst met vertrekcontrole),
        // een bakwagen of bus wordt aan het dock geladen
        if (t.kind === 'trekker') {
          const tr = takeTrailer(t.base, t.div, abs(tm), true);
          if (tr) { coupled = tr; trEvent(tr, { k: 'coupled', a: abs(tm), b: Infinity, vehicle: t, loaded: true, lading: tr.lading }); add({ k: 'koppel', t0: tm, t1: tm + (ri === 0 ? 15 : 10), d: di, tr, ev: { k: 'koppel', tr }, ritRef: rt, dockSoort: 'vertrek' }); }
        } else add({ k: 'terrein', t0: tm, t1: tm + (t.kind === 'bus' ? mins(12, 18) : mins(15, 25)), d: di, tr: null, ritRef: rt, dockSoort: 'laden' });
        const legs = rt.marks.length - 1;
        for (let i = 0; i < legs; i++) {
          const km0 = rt.marks[i].km, km1 = rt.marks[i + 1].km, dur = legMin(t, km1 - km0) * (1 + rnd() * 0.12);
          const delay = d.delayLeg === driveNo++ ? 6 + Math.floor(rnd() * 20) : 0;
          let kmA = km0, rest = dur;
          if (eu.drv + dur > eu.grens) {
            const room = eu.grens - eu.drv - r(0, 10);
            if (dur >= 60 && room >= 25) {   // lange rit: rijden tot vlak voor de grens, pauze langs de weg, dan verder
              kmA = km0 + (km1 - km0) * room / dur;
              add({ k: 'drive', t0: tm, t1: tm + room, km0, km1: kmA, delay: 0, route: rt, idx: i + 1, win: null, d: di, tr: coupled });
              eu.drv += room; eu.rij += room; rest = dur - room;
              pauze({ km0: kmA, km1: kmA, route: rt });
            } else pauze({ km0, km1: km0, route: rt });   // pauze op de plek, voor vertrek
          }
          add({ k: 'drive', t0: tm, t1: tm + rest + delay, km0: kmA, km1, delay, route: rt, idx: i + 1, win: null, d: di, tr: coupled });
          eu.drv += rest; eu.rij += rest;
          if (i === legs - 1) continue;
          // stop: venster van 30 minuten rond de geplande aankomst (die valt erin, of tot 10 minuten ervoor)
          const planned = tm - delay; const w0 = Math.ceil((planned - 20) / 30) * 30;
          segs[segs.length - 1].win = [w0, w0 + 30];
          const place = rt.marks[i + 1].place; const lastStop = i === legs - 2;
          // drop & swap: bij de laatste winkel van een winkelrit (10 %) of bij een eigen vestiging in het netwerk (altijd) blijft
          // de geladen oplegger achter; de trekker neemt een lege mee als er een staat, anders rijdt hij solo terug.
          let swap = null;
          if (coupled && ((t.div === 'winkel' && lastStop && rnd() < 0.1) || (t.div === 'netwerk' && place.fleet))) {
            const stopPlace = place.fleet ? { name: `terrein ${place.n}`, ...slotPos(place, (coupled.slot || 0) + 7, true), yard: true } : { name: rt.marks[i + 1].name, ...naastDeur(place, coupled.slot || 0), plek: place };
            const take = place.fleet ? takeTrailer(place, 'netwerk', abs(tm + 15), rnd() < 0.5) : null;
            const cur = coupled.events[coupled.events.length - 1]; if (cur && cur.k === 'coupled') cur.b = abs(tm + 15);
            trEvent(coupled, { k: 'site', a: abs(tm + 15), b: abs(tm + 15) + 2880, place: stopPlace, loaded: true, unloadAt: abs(tm + 15) + Math.round(r(70, 130)), pickup: abs(tm + 15) + 1440 + Math.round(r(-180, 240)), vehicle: null });
            coupled.busyUntil = Infinity; swap = { drop: coupled, take };
            if (take) { trEvent(take, { k: 'coupled', a: abs(tm + 15), b: Infinity, vehicle: t, loaded: !!take.lading, lading: take.lading }); take.busyUntil = Infinity; }
            coupled = take;
          }
          // wachten tot het lossen begint (D4; bij drop & swap niet), dan lossen (of laden bij het DC van de vacature)
          const wacht = swap ? 0 : Math.max(wachtTrek(place, abs(tm), rnd), Math.round(w0 - tm));
          const los = swap ? mins(15, 25) : la + rnd() * (lb - la);
          const actie = swap ? 'wisselen' : place === laadDC || place === pendelDC ? 'laden' : 'lossen';
          add({ k: 'stop', t0: tm, t1: tm + wacht + los, km0: km1, km1, stop: rt.marks[i + 1].name, route: rt, idx: i + 1, d: di, tr: swap ? swap.drop : coupled, swap, place, wacht, los, actie });
          const nog = rt.marks.slice(i + 2).reduce((a, m, j) => a + legMin(t, m.km - rt.marks[i + 1 + j].km), 0) + DOCK_UIT;
          if (atb(nog)) pauze({ km0: km1, km1, route: rt });
        }
        // terug op de standplaats: de lege oplegger aan een dock afkoppelen (emballage eruit), of retouren lossen aan een dock
        if (coupled) {
          const cur = coupled.events[coupled.events.length - 1]; if (cur && cur.k === 'coupled') cur.b = abs(tm + DOCK_UIT);
          coupled.busyUntil = abs(tm + DOCK_UIT); coupled.lading = null;
          add({ k: 'ontkoppel', t0: tm, t1: tm + DOCK_UIT, d: di, tr: coupled, ev: { k: 'ontkoppel', tr: coupled }, ritRef: rt, dockSoort: 'aankomst' }); coupled = null;
        } else if (t.kind !== 'trekker') add({ k: 'terrein', t0: tm, t1: tm + mins(6, 12), d: di, tr: null, ritRef: rt, dockSoort: 'aankomst' });
        kmLaad += rt.total;
      });
      d.t1 = tm; d.rij = Math.round(eu.rij);
    });
    const back = t.ev ? mins(60, 100) : mins(20, 40);
    if (t.diensten.length) { segs.push({ k: t.ev ? 'laden' : 'terrein', t0: tm, t1: tm + back, d: null, tr: null }); tm += back; }
    segs.push({ k: 'terrein', t0: tm, t1: Math.max(1440, tm + 1), d: null, tr: null });
    for (const s of segs) if (s.k === 'drive') s.range = s.route.path;
    return segs;
  }
  const rijVan = (t, d) => t.plan.reduce((a, s) => a + (s.d === d.i && s.k === 'drive' ? s.t1 - s.t0 - (s.delay || 0) : 0), 0);
  // Een dienst die korter uitvalt dan zijn doel krijgt hoogstens twee keer een korte rit erbij (dicht bij huis), als die nog
  // past in de rijtijd, de accu en, bij de eerste van twee diensten, voor de start van de tweede.
  function aanvulRit(t, d) {
    const volgende = t.diensten[d.i + 1];
    let ruimte = d.doel + 25 - (d.t1 - d.t0) - WISSEL; if (volgende) ruimte = Math.min(ruimte, volgende.rel0 - (t.ev ? 75 : 35) - d.t1 - WISSEL);
    const rijRuimte = d.maxRij - 20 - rijVan(t, d); if (ruimte < 70 || rijRuimte < 30) return null;
    const maxR = Math.min(t.ev ? t.range * 0.3 : Infinity, enkelKm(t, ruimte)); let best = null;
    for (let c = 0; c < 10; c++) {
      const stops = kiesStops(t.base, t.div, rnd, maxR); if (!stops.length) continue;
      const e = stopsSchatting(t, stops, t.dayStart + d.t1); if (e.drive > rijRuimte || e.min > ruimte + 25 || e.km > budgetVan(t)) continue;
      const sc = Math.abs(e.min - ruimte); if (!best || sc < best.sc) best = { stops, sc };
    }
    if (!best) return null;
    const rt = bouwRit(t.base, t.div, t.klant, best.stops); return rt.total > budgetVan(t) ? null : rt;
  }
  // Plan maken; een dienst met te veel rijtijd of die te lang wordt verliest zijn laatste rit, net als een tweede dienst die
  // niet klaar is voor de eerste dienst van de volgende dag (lukt dat met één rit niet, dan vervalt de tweede dienst); een
  // dienst die te kort uitvalt krijgt een rit erbij (aanvulRit). vanaf: alleen diensten vanaf dit nummer aanvullen.
  function plannen(t, vanaf = 0) {
    let extra = 0; const klaar = new Set();
    t.plan = makePlan(t);
    for (let g = 0; g < 12; g++) {
      const te = t.diensten.find(d => d.routes.length > 1 && (rijVan(t, d) > d.maxRij || d.t1 - d.t0 > LEN[t.div][1] + 30));
      const last = t.diensten[t.diensten.length - 1]; const laat = t.diensten.length > 1 && last.t1 > 1440 - (t.ev ? 105 : 45);
      if (te) { te.routes.pop(); klaar.add(te); }
      else if (laat) { if (last.routes.length > 1) { last.routes.pop(); klaar.add(last); } else t.diensten.pop(); }
      else {
        const kort = extra < 2 && t.diensten.find(d => d.i >= vanaf && !klaar.has(d) && d.doel - (d.t1 - d.t0) > 30);
        if (!kort) break;
        klaar.add(kort); const rt = aanvulRit(t, kort); if (!rt) continue;
        kort.routes.push(rt); klaar.delete(kort); extra++;
      }
      vrijgeven(t); t.plan = makePlan(t);   // opleggers van het vorige plan vrij, dan opnieuw plannen
    }
    // een tweede dienst die na het inkorten veel te kort is (minder dan anderhalf uur onder de kortste dienst) vervalt
    const d2 = t.diensten[1]; if (d2 && d2.t1 - d2.t0 < LEN[t.div][0] - 90) { t.diensten.pop(); vrijgeven(t); t.plan = makePlan(t); }
  }
  const tri = (a, b) => a + (b - a) * (rnd() + rnd()) / 2;
  const lenDoel = div => { const [a, b, e] = LEN[div]; return a + (b - a) * Math.pow(rnd(), e); };
  const rijGrens = () => rnd() < 0.25 ? 600 : 540;   // 9 uur; vandaag een van de twee verlengingen tot 10 uur per week
  for (const t of trucks) {
    if (t.vandaag !== 'inzet') { t.dayStart = 0; t.plan = [{ k: 'terrein', t0: 0, t1: 1440, d: null, tr: null }]; t.shiftStart = 0; t.shiftEnd = 0; t.routes = []; continue; }
    const w1 = START1[t.div]; const start1 = Math.round(tri(w1[0], w1[1]) / 5) * 5;
    t.dayStart = start1;
    const doel1 = lenDoel(t.div), grens1 = rijGrens();
    t.diensten = [{ i: 0, start: start1, driver: takeDriver(t.base), routes: rittenVoor(t, start1, doel1, grens1), delayLeg: rnd() < 0.09 ? Math.floor(rnd() * 8) : -1, rel0: 0, doel: Math.round(doel1), maxRij: grens1 }];
    t.lzv = t.kind === 'trekker' && t.div === 'netwerk' && /LZV/.test(t.klant) && rnd() < 0.5;
    // eerst de eerste dienst plannen om te weten wanneer de tweede kan beginnen
    plannen(t); const end1 = t.diensten[0].t1;
    if (rnd() < SECOND[t.div]) {
      const w2 = START2[t.div]; const want = Math.round(r(w2[0], w2[1]) / 5) * 5 - t.dayStart;
      const rel0 = Math.ceil(Math.max(end1 + (t.ev ? 75 : 35), want) / 5) * 5;
      const maxE2 = 1440 - rel0 - (t.ev ? 105 : 45) - 25;   // klaar (en elektrisch geladen) voor de eerste dienst van morgen
      const doel2 = Math.min(lenDoel(t.div), maxE2 - 45), grens2 = rijGrens();
      if (doel2 >= LEN[t.div][0] - 45) {
        // opleggers van de eerste dienst weer vrijgeven, plan opnieuw met twee diensten
        vrijgeven(t);
        t.diensten.push({ i: 1, start: t.dayStart + rel0, driver: takeDriver(t.base), routes: rittenVoor(t, t.dayStart + rel0, doel2, grens2, maxE2), delayLeg: rnd() < 0.09 ? Math.floor(rnd() * 8) : -1, rel0, doel: Math.round(doel2), maxRij: grens2 });
        plannen(t, 1);
      }
    }
    for (const d of t.diensten) { d.rel0 = d.t0; d.start = t.dayStart + d.t0; }
    t.routes = t.diensten.flatMap(d => d.routes);
    if (t.kind !== 'trekker') t.lading = pick(LADING[t.div]);
    t.shiftStart = t.dayStart; t.shiftEnd = t.diensten[t.diensten.length - 1].t1;
    for (const d of t.diensten) { d.end = t.dayStart + d.t1; d.t = t; d.rustTot = d.end + 660; }
  }
  // Oplegger-tijdlijnen: nog open koppelingen sluiten op het einde van de dag; wie nooit gebruikt is staat op het terrein.
  for (const tr of trailers) { for (const e of tr.events) if (e.b === Infinity) e.b = e.a + 600; tr.events.sort((x, y) => x.a - y.a); }
  // vaste technische storingen: drie voertuigen, één vriesoplegger
  [trucks[41], trucks[388], trucks[903]].forEach((t, i) => { if (t && t.vandaag === 'inzet') t.storing = STORING[i]; });
  const vries = trailers.find(tr => tr.type === 'vries' && tr.events.some(e => e.k === 'coupled')); if (vries) vries.storing = KOELSTORING;
  for (const t of trucks) t.driver = t.diensten.length ? t.diensten[0].driver : '';
  const byId = new Map(trucks.map(t => [t.id, t])); const trailerById = new Map(trailers.map(tr => [tr.id, tr]));

  // ---------- toestand van één voertuig op tijdstip T (minuten van de dag) ----------
  function stateAt(t, T) {
    const rel = (((T - t.dayStart) % 1440) + 1440) % 1440;
    let si = t.plan.length - 1; for (let i = 0; i < t.plan.length; i++) if (rel >= t.plan[i].t0 && rel < t.plan[i].t1) { si = i; break; }
    const seg = t.plan[si];
    let st, pos, km = 0, dock = null;
    const yard = () => slotPos(t.base, t.slot || 0, false);
    if (seg.k === 'drive') { const f = (rel - seg.t0) / (seg.t1 - seg.t0); km = seg.km0 + (seg.km1 - seg.km0) * f; pos = posAt(seg.route.path, km); st = seg.delay > 0 && !t.delayResolved ? 'vertraagd' : 'onderweg'; }
    else if (seg.k === 'stop') { pos = posAt(seg.route.path, seg.km0); st = 'klant'; }
    else if (seg.k === 'pauze') { pos = seg.route ? posAt(seg.route.path, seg.km0) : yard(); if (!seg.route) { const prev = t.plan[si - 1]; if (prev && prev.route && (prev.k === 'drive' || prev.k === 'stop')) pos = posAt(prev.route.path, prev.km1); } st = 'pauze'; }
    else if (seg.k === 'laden' && seg.route) { pos = posAt(seg.route.path, seg.km0); st = 'pauze'; }
    else if (seg.dockSoort && seg.dock && dockPos(t.base, seg.dock, t.kind)) { pos = dockPos(t.base, seg.dock, t.kind); dock = seg.dock; st = 'terrein'; }
    else { pos = yard(); st = 'terrein'; }
    // rijtijd sinds de laatste pauze volgens EU 561 (45 minuten, of 15 + 30; een laadbeurt of wachttijd telt mee als pauze,
    // laden en lossen, koppelen en werk aan het dock niet) en de rijtijd in deze dienst
    let drive = 0, rijDag = 0;
    if (seg.d !== null && seg.d !== undefined) {
      let i0 = si; while (i0 > 0 && t.plan[i0 - 1].d === seg.d) i0--;
      let deel = false;
      for (let i = i0; i <= si; i++) {
        const s = t.plan[i];
        if (s.k === 'drive') { const len = (i === si ? rel : s.t1) - s.t0; const net = Math.max(0, len) * (s.t1 - s.t0 - (s.delay || 0)) / ((s.t1 - s.t0) || 1); drive += net; rijDag += net; continue; }
        if (i === si) break;
        if (s.k === 'pauze' || s.k === 'laden' || (s.k === 'terrein' && !s.dockSoort)) { const len = s.t1 - s.t0; if (len >= PAUZE - 1e-6 || (len >= PAUZE_DEEL - 1e-6 && deel)) { drive = 0; deel = false; } else if (len >= 15 - 1e-6) deel = true; }
      }
    }
    // km sinds de accu vol was of sinds het tanken (tussen twee diensten); een tussentijdse laadbeurt (snelladen) telt als tegoed
    let kmSince = 0, credit = 0;
    for (let i = si; i >= 0; i--) { const s = t.plan[i]; if (i < si && s.k === 'laden' && s.partial) { credit += s.partial / 100 * t.range; continue; } if (i < si && (s.k === 'laden' || (s.k === 'terrein' && s.d === null && i > 0))) break; if (s.k === 'drive') kmSince += (i === si ? km - s.km0 : s.km1 - s.km0); }
    kmSince = Math.max(0, kmSince - credit);
    const soc = Math.max(3, 100 - kmSince / t.range * 100 * (t.ev ? 1 : 0.55));
    // volgende stop
    let next = null;
    for (let i = si; i < t.plan.length; i++) {
      const s = t.plan[i];
      if (s.k === 'stop' && i > si) { const d = t.plan[i - 1]; const dl = d && d.k === 'drive' ? d.delay || 0 : 0; next = { name: s.stop, eta: t.dayStart + s.t0 - (t.delayResolved ? dl : 0), planned: t.dayStart + s.t0 - dl, win: d && d.win ? [t.dayStart + d.win[0], t.dayStart + d.win[1]] : null, delay: t.delayResolved ? 0 : dl, kmLeft: d && d.k === 'drive' ? Math.max(0, d.km1 - km) : 0, swap: s.swap, pickup: s.pickup || null }; break; }
      if ((s.k === 'ontkoppel' || s.k === 'laden' || (s.k === 'terrein' && i > si)) && i > si) { const dl = seg.k === 'drive' && !t.delayResolved ? seg.delay || 0 : 0; next = { name: `Terug ${t.base.n}`, eta: t.dayStart + s.t0 - (seg.k === 'drive' && t.delayResolved ? seg.delay || 0 : 0), planned: t.dayStart + s.t0 - (seg.k === 'drive' ? seg.delay || 0 : 0), win: null, delay: dl, kmLeft: seg.k === 'drive' ? Math.max(0, seg.km1 - km) : 0, home: true, volgende: t.diensten.find(d => d.rel0 > s.t0) || null }; break; }
    }
    // de eerstvolgende geplande pauze of laadbeurt in deze dienst (absolute minuten), en wachten bij een stop
    let pauzeOm = null;
    if (seg.d !== null && seg.d !== undefined) for (let i = si + 1; i < t.plan.length && t.plan[i].d === seg.d; i++) if (t.plan[i].k === 'pauze' || t.plan[i].k === 'laden') { pauzeOm = t.dayStart + t.plan[i].t0; break; }
    const wachtTot = seg.k === 'stop' && seg.wacht && rel < seg.t0 + seg.wacht ? t.dayStart + seg.t0 + seg.wacht : null;
    const dienst = seg.d === null || seg.d === undefined ? null : t.diensten[seg.d];
    const upcoming = !dienst && t.diensten.find(d => d.rel0 > rel) || null;
    const v = seg.k === 'drive' ? (seg.km1 - seg.km0) / Math.max(1e-6, (seg.t1 - seg.t0 - (seg.delay || 0)) / 60) : 0;
    return { seg, si, rel, st, pos, km, drive, rijDag, soc, next, speed: seg.k === 'drive' ? Math.round(Math.min(t.speed * 1.08, v * (0.85 + ((rel * 7) % 10) / 33))) : 0, tr: seg.tr || null, dienst, driver: dienst ? dienst.driver : '', upcoming, solo: t.kind === 'trekker' && !seg.tr && (seg.k === 'drive' || seg.k === 'stop'), dock, pauzeOm, wachtTot };
  }

  // ---------- toestand van een oplegger op tijdstip T ----------
  function trailerStateAt(tr, T) {
    const Td = ((T % 1440) + 1440) % 1440;
    let ev = null, at = Td;
    for (const cand of [Td, Td + 1440]) { for (const e of tr.events) if (e.a <= cand && cand < e.b) { ev = e; at = cand; break; } if (ev) break; }
    if (ev && ev.k === 'coupled') { const s = stateAt(ev.vehicle, T); return { st: 'gekoppeld', pos: s.pos, vehicle: ev.vehicle, since: ev.a, lading: ev.lading, loaded: !!ev.lading, place: null, moving: s.st === 'onderweg' || s.st === 'vertraagd', vs: s, planned: !!ev.planned }; }
    if (ev && ev.k === 'site') { const loaded = ev.loaded && at < ev.unloadAt; if (ev.place.yard) return { st: loaded ? 'klaar' : 'leeg', pos: { lon: ev.place.lon, lat: ev.place.lat, bearing: ev.place.bearing || 0 }, vehicle: null, since: ev.a, lading: loaded ? ev.lading : null, loaded, place: ev.place.name, vs: null }; const o = { st: loaded ? 'geladen' : 'wacht', pos: { lon: ev.place.lon, lat: ev.place.lat, bearing: 0 }, vehicle: null, since: ev.a, lading: loaded ? ev.lading || tr.lading : null, loaded, place: ev.place.name, wait: loaded ? 0 : at - ev.unloadAt, unloadAt: ev.unloadAt, pickup: ev.pickup, late: !loaded && ev.pickup !== undefined && at > ev.pickup + 60, vs: null };
      if (!loaded && tr.pickupBy && at < tr.pickupBy.at) { o.st = 'ophalen'; o.late = false; o.pickupBy = tr.pickupBy; }
      return o; }
    const pos = slotPos(tr.base, tr.slot || 0, true);
    if (tr.onderhoud) return { st: 'onderhoud', pos, vehicle: null, since: 0, lading: null, loaded: false, place: `werkplaats ${tr.base.n}`, vs: null };
    return { st: tr.yardLoaded ? 'klaar' : 'leeg', pos, vehicle: null, since: 0, lading: tr.yardLoaded ? tr.lading : null, loaded: tr.yardLoaded, place: `terrein ${tr.base.n}`, vs: null };
  }
  // Temperatuur in een koel- of vriesoplegger (gesimuleerde telemetrie).
  function trailerTemp(tr, T) {
    const tt = TRT[tr.type]; if (!tt.temp) return null; const [a, b] = tt.temp; const mid = (a + b) / 2;
    if (tr.storing) return -12 + Math.sin(T / 37) * 0.4;
    return +(mid + Math.sin(T / 23 + tr.id.length) * (b - a) * 0.4 + ((tr.id.charCodeAt(4) % 7) - 3) * 0.08).toFixed(1);
  }

  // Ritnummer van een segment (1, 2, ... in de ritten van het voertuig vandaag) en de klant van een blok.
  const ritNr = (t, s) => { const rt = s.route || s.ritRef; if (!rt) return null; const k = t.routes.indexOf(rt); return k >= 0 ? k + 1 : null; };
  const klantVan = (t, s) => {
    const rt = s.route || s.ritRef; const p = s.k === 'stop' ? s.place : s.k === 'drive' && s.route ? s.route.marks[s.idx] && s.route.marks[s.idx].place : rt && rt.marks[1] ? rt.marks[1].place : null;
    if (!p) return null; if (p.fleet !== undefined) return 'Simon Loos'; return p.formule || t.klant || null;
  };
  // Dagblokken voor het planbord (absolute minuten; kunnen > 1440 lopen). Vorm voor het planbord (D7): t0, t1 (= a, b),
  // klant, venster (absoluut, of null), vertraging, dock (of null) en dockSoort, rit, plek (id), wacht en los bij een stop.
  function blocks(t) {
    return t.plan.filter(s => s.t1 > s.t0 && !(s.k === 'terrein' && s.t1 >= 1440)).map(s => {
      const delay = t.delayResolved ? 0 : (s.delay || 0);
      return {
        a: t.dayStart + s.t0, b: t.dayStart + s.t1, k: s.k, d: s.d, tr: s.tr, swap: s.swap || null,
        label: s.k === 'drive' ? `→ ${s.route.marks[s.idx].name}` : s.k === 'stop' ? s.stop : s.k === 'pauze' ? (s.at ? `Pauze · ${s.at}` : 'Pauze') : s.k === 'laden' ? (s.at ? `Laden · ${s.at}` : 'Laden accu') : s.k === 'koppel' ? `Koppelen ${s.tr.id}${s.dock ? ` · dock ${s.dock}` : ''}` : s.k === 'ontkoppel' ? `Afkoppelen ${s.tr.id}${s.dock ? ` · dock ${s.dock}` : ''}` : s.dockSoort === 'laden' ? `Laden aan dock ${s.dock || ''}`.trim() : s.dockSoort === 'aankomst' ? `Retouren aan dock ${s.dock || ''}`.trim() : s.wachtDock ? 'Wacht op een dock' : 'Terrein', ingevoegd: !!s.ingevoegd, pickup: s.pickup || null,
        delay, win: s.win,
        t0: t.dayStart + s.t0, t1: t.dayStart + s.t1, klant: klantVan(t, s), venster: s.win ? [t.dayStart + s.win[0], t.dayStart + s.win[1]] : null, vertraging: delay,
        dock: s.dock || null, dockSoort: s.dockSoort || null, rit: ritNr(t, s), plek: s.k === 'stop' ? plekId(s.place) : null, wacht: s.k === 'stop' ? s.wacht || 0 : 0, los: s.k === 'stop' && s.los !== undefined ? Math.round(s.los) : null,
      };
    });
  }

  // Vertrekken vanaf een standplaats binnen [T, T+horizon]: de eerste rit van elke route (km 0), met chauffeur, oplegger en
  // het dock waar het voertuig vertrekt (null: vertrek vanaf de parkeerplek, bijvoorbeeld een solo trekker).
  function departures(sp, T, horizon = 90) {
    const out = [];
    for (const t of trucks) {
      if (t.base !== sp) continue;
      for (const s of t.plan) { if (s.k !== 'drive' || s.km0 !== 0 || s.mid) continue; const at = t.dayStart + s.t0; const dd = ((at - T) % 1440 + 1440) % 1440; if (dd <= horizon) out.push({ t, at: T + dd, dest: s.route.marks[s.idx].name, dock: s.dock || null, tr: s.tr, driver: s.d === null ? '' : t.diensten[s.d].driver, dienst: s.d === null ? null : t.diensten[s.d] }); }
    }
    return out.sort((a, b) => a.at - b.at);
  }
  // ---------- acties van de planner (deterministisch, zonder toeval): het plan van een voertuig aanpassen ----------
  // Tijden in minuten vanaf dayStart van het voertuig; segmenten blijven aaneengesloten. Een verschuiving wordt
  // opgevangen door lege tijd op het terrein (d === null), zodat een volgende dienst op tijd blijft als dat kan.
  const absT = (t, rel) => t.dayStart + rel;
  function refreshDiensten(t) {
    const P = t.plan;
    for (const d of t.diensten) { const segs = P.filter(x => x.d === d.i); if (!segs.length) continue; d.t0 = segs[0].t0; d.t1 = segs[segs.length - 1].t1; d.rel0 = d.t0; d.start = t.dayStart + d.t0; d.end = t.dayStart + d.t1; d.rustTot = d.end + 660; }
    t.shiftEnd = t.diensten.length ? t.diensten[t.diensten.length - 1].t1 : 0;
    t.routes = t.diensten.flatMap(d => d.routes);
  }
  function shiftAfter(t, idx, delta) {
    const P = t.plan; if (!delta || idx >= P.length - 1) { refreshDiensten(t); return; }
    const oldT0 = P.map(x => x.t0); const oldA = absT(t, P[idx].t1 - delta);
    for (let i = idx + 1; i < P.length; i++) { P[i].t0 += delta; P[i].t1 += delta; }
    let rest = delta;
    for (let i = idx + 1; i < P.length && rest > 0; i++) { const x = P[i]; if (x.d !== null || x.k !== 'terrein') continue; const room = Math.max(0, (x.t1 - x.t0) - 5); const take = Math.min(room, rest); if (take > 0) { x.t1 -= take; for (let j = i + 1; j < P.length; j++) { P[j].t0 -= take; P[j].t1 -= take; } rest -= take; } }
    const last = P[P.length - 1]; last.t1 = Math.max(1440, last.t0 + 1);
    // opleggergebeurtenissen van dit voertuig schuiven mee met het segment waar ze bij horen
    const deltaAt = X => { const rel = X - t.dayStart; let k = -1; for (let i = 0; i < oldT0.length; i++) if (oldT0[i] <= rel + 1e-6) k = i; return k < 0 ? 0 : P[k].t0 - oldT0[k]; };
    for (const tr of trailers) for (const e of tr.events) { if (e.by !== t || e.a < oldA) continue; const da = deltaAt(e.a); if (e.k === 'site') { e.a += da; if (e.b !== Infinity) e.b += da; e.unloadAt += da; e.pickup += da; } else { const db = e.b === Infinity ? 0 : deltaAt(e.b); e.a += da; if (e.b !== Infinity) e.b += db; } }
    refreshDiensten(t);
  }

  // ---------- docks: wie staat wanneer aan welk dock van de eigen standplaats ----------
  // Dockblokken zijn de segmenten met dockSoort: 'vertrek' (koppelen), 'laden' (bakwagen of bus laden), 'aankomst'
  // (afkoppelen, retouren). Twee voertuigen staan nooit tegelijk aan hetzelfde dock (met 2 minuten om te rangeren); is
  // geen dock vrij, dan wacht het voertuig op het terrein tot er een vrijkomt (en schuift de rest van zijn plan op).
  const ivVan = (t, s) => { const a = (((t.dayStart + s.t0) % 1440) + 1440) % 1440; return [a, a + (s.t1 - s.t0)]; };
  const raakt = (x, y) => x[0] - 1440 < y[1] + 2 && y[0] < x[1] - 1440 + 2 || x[0] < y[1] + 2 && y[0] < x[1] + 2 || x[0] + 1440 < y[1] + 2 && y[0] < x[1] + 1440 + 2;
  const vrijDock = (bezet, iv, pref, n) => { for (let j = 0; j < n; j++) { const k = ((pref - 1 + j) % n) + 1; if (!bezet[k - 1].some(y => raakt(iv, y))) return k; } return 0; };
  // vertrek- en aankomstrit krijgen het dock van hun dockblok (voor het hal-scherm en de gebeurtenissen)
  function dockRitten(t) {
    const P = t.plan; for (const s of P) if (s.k === 'drive') delete s.dock;
    for (let i = 0; i < P.length; i++) {
      const s = P[i]; if (!s.dockSoort) continue;
      if (s.dockSoort === 'aankomst') { for (let j = i - 1; j >= 0 && P[j].d === s.d; j--) if (P[j].k === 'drive') { P[j].dock = s.dock; break; } }
      else for (let j = i + 1; j < P.length && P[j].d === s.d && !P[j].dockSoort; j++) if (P[j].k === 'drive') { P[j].dock = s.dock; break; }
    }
  }
  function plaatsDocks(sp, wie) {
    const n = sp.docks || 0; if (!n || !wie.length) return;
    const bezet = Array.from({ length: n }, () => []); const los = new Set(wie);
    for (const t of trucks) if (t.base === sp && !los.has(t)) for (const s of t.plan) if (s.dockSoort && s.dock && s.t1 > s.t0) bezet[s.dock - 1].push(ivVan(t, s));
    const lijst = new Map(wie.map(t => [t, t.plan.filter(s => s.dockSoort && s.t1 > s.t0)])); const ptr = new Map(wie.map(t => [t, 0]));
    for (;;) {
      let bt = null, bs = null, ba = Infinity;
      for (const t of wie) { const L = lijst.get(t), k = ptr.get(t); if (k < L.length && t.dayStart + L[k].t0 < ba) { ba = t.dayStart + L[k].t0; bt = t; bs = L[k]; } }
      if (!bt) break;
      let iv = ivVan(bt, bs); const pref = bs.dock || ((bt.slot || 0) % n) + 1;
      let k = vrijDock(bezet, iv, pref, n);
      if (!k) {
        let w = 0; while (!k && w < 90) { w += 2; k = vrijDock(bezet, [iv[0] + w, iv[1] + w], pref, n); }
        if (k) { const i = bt.plan.indexOf(bs); bt.plan.splice(i, 0, { k: 'terrein', t0: bs.t0, t1: bs.t0 + w, d: bs.d, tr: null, wachtDock: true }); shiftAfter(bt, i, w); iv = ivVan(bt, bs); }
        else k = pref;
      }
      bs.dock = k; bezet[k - 1].push(iv); ptr.set(bt, ptr.get(bt) + 1);
    }
    for (const t of wie) dockRitten(t);
  }
  const docksBijwerken = t => { if (!t || !t.base) return; plaatsDocks(t.base, [t]); dockRitten(t); };
  // Dockplanning van een standplaats: per dock de blokken van de dag (absolute minuten, kunnen > 1440 lopen).
  function dockPlan(sp) {
    const s = typeof sp === 'string' ? SP.find(x => x.n === sp) : sp; if (!s || !s.docks) return [];
    const rows = Array.from({ length: s.docks }, (_, i) => ({ dock: i + 1, blokken: [] }));
    for (const t of trucks) { if (t.base !== s) continue; for (const x of t.plan) if (x.dockSoort && x.dock && x.t1 > x.t0) rows[x.dock - 1].blokken.push({ t0: t.dayStart + x.t0, t1: t.dayStart + x.t1, voertuig: t.id, rit: ritNr(t, x), soort: x.dockSoort, oplegger: x.tr ? x.tr.id : null }); }
    for (const row of rows) row.blokken.sort((a, b) => a.t0 - b.t0);
    return rows;
  }

  // km langs het pad (tussen kmFrom en kmTo) dat het dichtst bij een punt ligt; null als dat verder dan maxKm is
  function kmNear(path, kmFrom, kmTo, lon, lat, maxKm) {
    let best = null, bd = Infinity; const { pts, cum } = path;
    for (let i = 0; i < pts.length; i++) { if (cum[i] < kmFrom || cum[i] > kmTo) continue; const d = Math.hypot((pts[i][0] - lon) * 68, (pts[i][1] - lat) * 111); if (d < bd) { bd = d; best = cum[i]; } }
    return bd <= maxKm ? best : null;
  }
  // Knip het huidige rijsegment op km kmP (vanaf nu) en voeg daar blokken in; in een ander segment: invoegen erna.
  function insertSegs(t, T, kmP, make) {
    const s = stateAt(t, T); const seg = s.seg; const si = s.si; const P = t.plan;
    let at = seg.t1, km = seg.km1 || 0, route = seg.route || null;
    if (seg.k === 'drive') {
      const span = seg.km1 - seg.km0 || 1e-6; const kmX = Math.min(seg.km1, Math.max(s.km, kmP === null ? s.km : kmP)); const tX = seg.t0 + (kmX - seg.km0) / span * (seg.t1 - seg.t0);
      if (kmX < seg.km1 - 0.05) { const tail = { ...seg, t0: tX, km0: kmX }; seg.t1 = tX; seg.km1 = kmX; seg.win = null; seg.delay = 0; P.splice(si + 1, 0, tail); }
      at = tX; km = kmX; route = seg.route;
    }
    const segs = make({ at, km, route, d: seg.d === undefined ? null : seg.d, tr: seg.tr || null });
    let tm = at; for (const x of segs) { x.t0 = tm; x.t1 = tm + x.dur; tm += x.dur; delete x.dur; x.ingevoegd = true; }
    P.splice(si + 1, 0, ...segs);
    shiftAfter(t, si + segs.length, tm - at);
    docksBijwerken(t);
    return { at: absT(t, at), end: absT(t, tm), segs };
  }
  // Pauze van 45 minuten op een pauzeplek langs de route (binnen 7 km van de route), anders binnen 8 km
  function insertPause(t, T, place) {
    const s = stateAt(t, T); let kmP = null, atPlace = false;
    if (s.seg.k === 'drive' && place) { kmP = kmNear(s.seg.route.path, s.km, s.seg.km1, place.lon, place.lat, 7); atPlace = kmP !== null; }
    if (s.seg.k === 'drive' && kmP === null) kmP = Math.min(s.seg.km1, s.km + 8);
    const r = insertSegs(t, T, kmP, ({ km, route, d, tr }) => [{ k: 'pauze', dur: 45, km0: km, km1: km, route, d, tr, at: atPlace ? place.n : null }]);
    t.breakPlanned = true; return r;
  }
  // Snelladen van 25 minuten (ongeveer 35 procent erbij) bij een laadpunt langs de route, anders meteen
  function insertCharge(t, T, sp) {
    const s = stateAt(t, T); let kmP = null, atPlace = false;
    if (s.seg.k === 'drive' && sp) { kmP = kmNear(s.seg.route.path, s.km, s.seg.km1, sp.lon, sp.lat, 7); atPlace = kmP !== null; }
    if (s.seg.k === 'drive' && kmP === null) kmP = Math.min(s.seg.km1, s.km + 3);
    const r = insertSegs(t, T, kmP, ({ km, route, d, tr }) => [{ k: 'laden', dur: 25, km0: km, km1: km, route, d, tr, partial: 35, at: atPlace ? sp.n : null }]);
    t.chargePlanned = true; return r;
  }
  // Een volgende dienst schuift op (minuten); de lege tijd ervoor wordt langer
  function shiftDienst(t, di, minutes) {
    const d = t.diensten[di]; if (!d || minutes <= 0) return null; const P = t.plan; const i0 = P.findIndex(x => x.d === d.i); if (i0 < 1) return null;
    const oldA = absT(t, P[i0].t0);
    for (let i = i0; i < P.length; i++) { P[i].t0 += minutes; P[i].t1 += minutes; }
    const gap = P[i0 - 1]; if (gap.d === null) gap.t1 += minutes;
    const last = P[P.length - 1]; last.t1 = Math.max(1440, last.t0 + 1);
    for (const tr of trailers) for (const e of tr.events) { if (e.by !== t || e.a < oldA) continue; e.a += minutes; if (e.b !== Infinity) e.b += minutes; if (e.k === 'site') { e.unloadAt += minutes; e.pickup += minutes; } }
    d.shifted = (d.shifted || 0) + minutes; t.delayResolved = true; refreshDiensten(t); docksBijwerken(t); return d;
  }
  // Het tijdvenster van de volgende stop verruimen tot de ETA (de klant is geinformeerd)
  function acceptEta(t, T) {
    const s = stateAt(t, T); const P = t.plan;
    for (let i = s.si; i < P.length; i++) { const x = P[i]; if (x.k === 'drive' && x.win) { if (x.t1 > x.win[1]) x.win = [x.win[0], Math.ceil(x.t1 / 5) * 5]; x.winMoved = true; break; } if (x.k === 'stop' && i > s.si) break; }
    t.delayResolved = true;
  }
  // Omrijden: over de graaf, en bij een standplaats of winkel ook over de toegangsroute tot de poort of de deur.
  const mkRoute = (a, b, nameA, nameB, placeA, placeB) => {
    const pa = placeA && placeA.node === a ? placeA : { ...placeA, node: a }, pb = placeB && placeB.node === b ? placeB : { ...placeB, node: b };
    const path = routeOver([pa, pb]);
    return { seq: [placeA, placeB], path, marks: [{ place: placeA, km: 0, name: nameA }, { place: placeB, km: path.total, name: nameB }], total: path.total, detour: true };
  };
  // Een trekker haalt een losse oplegger op: omrijden vanaf de huidige positie (solo op de thuisrit) of vanaf het
  // terrein (reserve met een vrije chauffeur). De oplegger krijgt de status "wordt opgehaald" tot de koppeling.
  function pickupDetour(t, tr, T, dienstInfo) {
    const ts = trailerStateAt(tr, T); if (!ts.place || ts.st === 'gekoppeld' || ts.st === 'onderhoud' || ts.vs) return null;
    const cur = tr.events.find(e => e.k === 'site' && e.place && e.place.name === ts.place && e.place.plek); const plek = cur ? cur.place.plek : null;
    const trNode = plek ? plek.node : nearestNode(ts.pos.lon, ts.pos.lat); const stopPlace = { name: ts.place, lon: ts.pos.lon, lat: ts.pos.lat, node: trNode, id: plek ? plek.id : undefined, toegang: plek ? plek.toegang : undefined };
    const home = t.base; const R2 = mkRoute(trNode, home.node, ts.place, home.n, stopPlace, home); const d2 = Math.max(4, R2.total / t.speed * 60);
    const P = t.plan; let r;
    if (t.vandaag === 'reserve' || !t.diensten.length) {
      const R1 = mkRoute(home.node, trNode, home.n, `${ts.place} (oplegger ophalen)`, home, stopPlace); const d1 = Math.max(4, R1.total / t.speed * 60);
      const rel = ((T - t.dayStart) % 1440 + 1440) % 1440;
      const d = { i: 0, start: t.dayStart + rel, driver: dienstInfo.driver, person: dienstInfo.person, routes: [R1, R2], delayLeg: -1, rel0: rel, t, ophaal: tr.id };
      const end = rel + d1 + 18 + d2;
      t.plan = [
        { k: 'terrein', t0: 0, t1: rel, d: null, tr: null },
        { k: 'drive', t0: rel, t1: rel + d1, km0: 0, km1: R1.total, delay: 0, route: R1, idx: 1, win: null, d: 0, tr: null, range: R1.path, ingevoegd: true },
        { k: 'stop', t0: rel + d1, t1: rel + d1 + 10, km0: R1.total, km1: R1.total, stop: `${ts.place} · ${tr.id} koppelen`, route: R1, idx: 1, d: 0, tr, pickup: tr, place: stopPlace, ingevoegd: true },
        { k: 'drive', t0: rel + d1 + 10, t1: rel + d1 + 10 + d2, km0: 0, km1: R2.total, delay: 0, route: R2, idx: 1, win: null, d: 0, tr, range: R2.path, ingevoegd: true, mid: true },
        { k: 'ontkoppel', t0: rel + d1 + 10 + d2, t1: end, d: 0, tr, ev: { k: 'ontkoppel', tr }, ingevoegd: true, ritRef: R2, dockSoort: 'aankomst' },
        { k: 'terrein', t0: end, t1: Math.max(1440, end + 1), d: null, tr: null },
      ];
      t.diensten = [d]; t.vandaag = 'inzet'; t.driver = d.driver; t.shiftStart = rel; refreshDiensten(t);
      r = { arrive: t.dayStart + rel + d1, end: t.dayStart + end, km: R1.total + R2.total, dienst: d, T };
    } else {
      const s = stateAt(t, T); const seg = s.seg; const cut = s.si; const rel = s.rel; const di = seg.d === undefined ? null : seg.d;
      const fromNode = nearestNode(s.pos.lon, s.pos.lat);
      const R1 = mkRoute(fromNode, trNode, 'onderweg', `${ts.place} (oplegger ophalen)`, { name: 'onderweg', lon: s.pos.lon, lat: s.pos.lat }, stopPlace); const d1 = Math.max(4, R1.total / t.speed * 60);
      let at = rel, removed = 0;
      if (seg.k === 'drive') { removed = seg.t1 - rel; seg.t1 = rel; seg.km1 = s.km; seg.win = null; seg.delay = 0; } else at = seg.t1;
      // de rest van de solo-thuisrit vervalt (rijden en pauzes tot het volgende blok op het terrein)
      let j = cut + 1; while (j < P.length && (P[j].k === 'drive' || P[j].k === 'pauze') && !P[j].tr && P[j].d === di) { removed += P[j].t1 - P[j].t0; j++; }
      P.splice(cut + 1, j - cut - 1);
      const segs = [
        { k: 'drive', t0: at, t1: at + d1, km0: 0, km1: R1.total, delay: 0, route: R1, idx: 1, win: null, d: di, tr: null, range: R1.path, ingevoegd: true, mid: true },
        { k: 'stop', t0: at + d1, t1: at + d1 + 10, km0: R1.total, km1: R1.total, stop: `${ts.place} · ${tr.id} koppelen`, route: R1, idx: 1, d: di, tr, pickup: tr, place: stopPlace, ingevoegd: true },
        { k: 'drive', t0: at + d1 + 10, t1: at + d1 + 10 + d2, km0: 0, km1: R2.total, delay: 0, route: R2, idx: 1, win: null, d: di, tr, range: R2.path, ingevoegd: true, mid: true },
        { k: 'ontkoppel', t0: at + d1 + 10 + d2, t1: at + d1 + 18 + d2, d: di, tr, ev: { k: 'ontkoppel', tr }, ingevoegd: true, ritRef: R2, dockSoort: 'aankomst' },
      ];
      P.splice(cut + 1, 0, ...segs);
      shiftAfter(t, cut + segs.length, (d1 + 18 + d2) - removed);
      if (di !== null && t.diensten[di]) { t.diensten[di].routes = [...t.diensten[di].routes, R2]; t.diensten[di].ophaal = tr.id; }
      refreshDiensten(t);
      r = { arrive: t.dayStart + at + d1, end: t.dayStart + at + d1 + 18 + d2, km: R1.total + R2.total, dienst: di !== null ? t.diensten[di] : null, T };
    }
    docksBijwerken(t);
    // oplegger: het wachten eindigt bij aankomst, dan gekoppeld achter dit voertuig tot het afkoppelen op het terrein
    // (tijden in hetzelfde dagvenster als de lopende gebeurtenis van de oplegger)
    const Td = ((T % 1440) + 1440) % 1440; let ev = null, at = Td;
    for (const cand of [Td, Td + 1440]) { for (const e of tr.events) if (e.k === 'site' && e.a <= cand && cand < e.b) { ev = e; at = cand; break; } if (ev) break; }
    const travel = ((r.arrive - T) % 1440 + 1440) % 1440; const total = r.end - r.arrive;
    const a = at + travel, b = at + travel + total - 8;
    if (ev) ev.b = a + 10;
    tr.events.push({ k: 'coupled', a: a + 10, b, vehicle: t, loaded: false, lading: null, by: t, planned: true }); tr.events.sort((x, y) => x.a - y.a);
    tr.pickupBy = { t, at: a + 10, eta: a }; tr.pickupPlanned = true; tr.busyUntil = b;
    return r;
  }
  // Storing: de volgende dienst van dit voertuig gaat naar een reservevoertuig van dezelfde standplaats en soort
  function moveDienst(t, d, r) {
    if (!d || !r || r.vandaag !== 'reserve' || d.i === 0) return null;
    const P = t.plan; const segs = P.filter(x => x.d === d.i); if (!segs.length) return null;
    const i0 = P.indexOf(segs[0]); const before = P.slice(0, i0); while (before.length && before[before.length - 1].d === null) before.pop();
    const end0 = before.length ? before[before.length - 1].t1 : 0; const back = t.ev ? 60 : 25;
    t.plan = [...before, { k: t.ev ? 'laden' : 'terrein', t0: end0, t1: end0 + back, d: null, tr: null }, { k: 'terrein', t0: end0 + back, t1: Math.max(1440, end0 + back + 1), d: null, tr: null }];
    t.diensten = t.diensten.filter(x => x !== d); refreshDiensten(t); t.reserveFor = { d, r };
    // het reservevoertuig krijgt dezelfde dagbasis en het plan van die dienst
    r.dayStart = t.dayStart; for (const x of segs) x.d = 0; d.i = 0; d.t = r; r.diensten = [d];
    const e1 = segs[segs.length - 1].t1;
    r.plan = [{ k: 'terrein', t0: 0, t1: segs[0].t0, d: null, tr: null }, ...segs, { k: r.ev ? 'laden' : 'terrein', t0: e1, t1: e1 + back, d: null, tr: null }, { k: 'terrein', t0: e1 + back, t1: Math.max(1440, e1 + back + 1), d: null, tr: null }];
    r.vandaag = 'inzet'; r.driver = d.driver; r.replaces = { t, d }; r.shiftStart = segs[0].t0; refreshDiensten(r);
    for (const tr of trailers) for (const e of tr.events) if (e.by === t && e.a >= t.dayStart + segs[0].t0 - 1e-6) { e.by = r; if (e.vehicle === t) e.vehicle = r; }
    docksBijwerken(r);
    return d;
  }
  const trailersOf = sp => trailerPool.get(sp.n) || [];
  // Rit tussen twee plekken over echte wegen (standplaats, winkel, DC of bezorgpunt, of hun id: 'sp:Wognum', 'ah0001',
  // 'ah-zaandam', 'bz-1'): { km, punten, verbonden, deur } met deur de plek waar de vrachtwagen bij b stopt.
  const plekVan = x => typeof x !== 'string' ? x : x.startsWith('sp:') ? SP.find(s => s.n === x.slice(3)) : winkelById.get(x) || dcById.get(x) || BEZORG.find(b => b.id === x);
  // laadGebouwen(): de gebouwen rond standplaatsen en DC's voor de 3D-wereld, pas bij aanroep geladen (eigen bundel buildings.js).
  function routeBetween(a, b) { const A = plekVan(a), B = plekVan(b); if (!A || !B) return null; const p = routeOver([A, B]); return { km: p.total, punten: p.pts.length, verbonden: connected(shortestPath(A.node, B.node)), deur: p.pts[p.pts.length - 1] }; }
  const dienstenOf = t => t.diensten;

  // ---------- gebeurtenissen per voertuig (D3) ----------
  // Chronologisch uit het plan: [{ t (absolute minuten, kunnen > 1440 lopen), soort, plek (id of naam), naam, rit }], met
  // soort vertrek | aankomst | los_start | los_eind | wacht | koppel | ontkoppel | laad_start | laad_eind | pauze_start |
  // pauze_eind. Extra velden waar ze iets zeggen: duur (wacht), dock, oplegger, wat ('lading' of 'accu' bij laden).
  function eventsOf(id) {
    const t = typeof id === 'string' ? byId.get(id) : id; if (!t) return [];
    const out = []; const P = t.plan; const base = t.base; const baseId = plekId(base), baseNaam = plekNaam(base);
    const ev = (rel, soort, plek, naam, s, extra) => out.push({ t: t.dayStart + rel, soort, plek, naam, rit: ritNr(t, s), ...extra });
    const waar = s => { const rt = s.route; if (!rt) return [baseId, baseNaam]; const m = rt.marks.find(x => Math.abs(x.km - s.km0) < 1e-6); return m ? [plekId(m.place), m.name] : [null, 'onderweg']; };
    const opl = s => s.tr ? { oplegger: s.tr.id } : {};
    for (const s of P) {
      if (!(s.t1 > s.t0) && s.k !== 'stop') continue;
      if (s.k === 'drive') {
        const m0 = s.route.marks[s.idx - 1], m1 = s.route.marks[s.idx];
        if (m0 && Math.abs(s.km0 - m0.km) < 1e-6) ev(s.t0, 'vertrek', plekId(m0.place), m0.place === base ? baseNaam : m0.name, s, m0.place === base && s.dock ? { dock: s.dock } : {});
        if (m1 && Math.abs(s.km1 - m1.km) < 1e-6) ev(s.t1, 'aankomst', plekId(m1.place), m1.place === base ? baseNaam : m1.name, s, m1.place === base && s.dock ? { dock: s.dock } : {});
      } else if (s.k === 'stop') {
        const pid = plekId(s.place), nm = s.stop;
        if (s.pickup) { ev(s.t0, 'koppel', pid, nm, s, { oplegger: s.pickup.id }); continue; }
        if (s.swap) { ev(s.t0, 'ontkoppel', pid, nm, s, { oplegger: s.swap.drop.id }); if (s.swap.take) ev(s.t1, 'koppel', pid, nm, s, { oplegger: s.swap.take.id }); continue; }
        if (s.wacht) ev(s.t0, 'wacht', pid, nm, s, { duur: s.wacht });
        const a = s.t0 + (s.wacht || 0);
        if (s.actie === 'laden') { ev(a, 'laad_start', pid, nm, s, { wat: 'lading' }); ev(s.t1, 'laad_eind', pid, nm, s, { wat: 'lading' }); }
        else { ev(a, 'los_start', pid, nm, s, {}); ev(s.t1, 'los_eind', pid, nm, s, {}); }
      } else if (s.k === 'koppel') ev(s.t0, 'koppel', baseId, baseNaam, s, { ...opl(s), ...(s.dock ? { dock: s.dock } : {}) });
      else if (s.k === 'ontkoppel') ev(s.t0, 'ontkoppel', baseId, baseNaam, s, { ...opl(s), ...(s.dock ? { dock: s.dock } : {}) });
      else if (s.k === 'pauze') { const [p, nm] = waar(s); const extra = s.at ? { bij: s.at } : {}; ev(s.t0, 'pauze_start', p, nm, s, extra); ev(s.t1, 'pauze_eind', p, nm, s, extra); }
      else if (s.k === 'laden') { const [p, nm] = s.route ? waar(s) : [baseId, baseNaam]; ev(s.t0, 'laad_start', p, nm, s, { wat: 'accu' }); ev(s.t1, 'laad_eind', p, nm, s, { wat: 'accu' }); }
      else if (s.dockSoort === 'laden') { ev(s.t0, 'laad_start', baseId, baseNaam, s, { wat: 'lading', ...(s.dock ? { dock: s.dock } : {}) }); ev(s.t1, 'laad_eind', baseId, baseNaam, s, { wat: 'lading', ...(s.dock ? { dock: s.dock } : {}) }); }
      else if (s.dockSoort === 'aankomst') { ev(s.t0, 'los_start', baseId, baseNaam, s, s.dock ? { dock: s.dock } : {}); ev(s.t1, 'los_eind', baseId, baseNaam, s, s.dock ? { dock: s.dock } : {}); }
      else if (s.wachtDock) ev(s.t0, 'wacht', baseId, baseNaam, s, { duur: Math.round(s.t1 - s.t0), reden: 'dock' });
    }
    return out.map((e, i) => [e, i]).sort((x, y) => x[0].t - y[0].t || x[1] - y[1]).map(x => x[0]);
  }

  // ---------- wachttijd per plek (D4) ----------
  // [{ id, naam, soort, n, gem, p90, dagdeel }]: n stops vandaag (zonder drop & swap), gemiddelde en 90e percentiel van de
  // wachttijd in minuten, en de verwachte wachttijd per dagdeel (nacht, ochtend, middag, avond) uit het model.
  function wachtPerPlek() {
    const m = new Map();
    for (const t of trucks) for (const s of t.plan) if (s.k === 'stop' && s.place && s.wacht !== undefined && s.actie !== 'wisselen') {
      const id = plekId(s.place); if (!id) continue;
      let e = m.get(id); if (!e) { e = { id, naam: plekNaam(s.place), soort: plekSoort(s.place), plek: s.place, w: [] }; m.set(id, e); } e.w.push(s.wacht);
    }
    return [...m.values()].map(e => {
      const w = e.w.slice().sort((a, b) => a - b); const gem = w.reduce((a, b) => a + b, 0) / w.length;
      return { id: e.id, naam: e.naam, soort: e.soort, n: w.length, gem: Math.round(gem * 10) / 10, p90: w[Math.min(w.length - 1, Math.ceil(0.9 * w.length) - 1)], dagdeel: Object.fromEntries(DAGDELEN.map((k, i) => [k, Math.round((WACHT[e.soort] || WACHT.winkel)[i] * adresFactor(e.plek) * 10) / 10])) };
    }).sort((a, b) => b.gem * b.n - a.gem * a.n || (a.id < b.id ? -1 : 1));
  }

  // ---------- pool: ritten zonder voertuig (D5) ----------
  // Per standplaats per dag 2 tot 5 procent van de ritten, elk met een reden: ziekmeldingen in de vroege ochtend, uitval van
  // een voertuig en extra ritten van klanten overdag, en ritten die gisteren via OTM5 binnenkwamen maar nog geen wagen hebben.
  // 's Middags (13:00 tot 16:30) komen de ritten van morgen erbij (AH-ritme: de finale ritten elke middag). Elke standplaats
  // heeft de hele dag minstens één rit in de pool. Eigen toevalsreeks: de pool verandert de ritten van de voertuigen niet.
  // { id, sp, div, klant, stops, venster, duur, km, oplegger, dag, reden, bekend, soort, route,
  //   rij, dagdeel, weekdag, weekend, datum, regio, urgentie, prognose }
  //   stops: als de stops van een rit ({ place, km, name } uit route.marks) plus id; venster: minuten sinds middernacht (van
  //   vandaag of van morgen), het laadvenster op de standplaats; oplegger: soort uit TRT ('koel', 'droog', ...) of null voor
  //   een bakwagen of bus; bekend: minuut waarop de rit in de pool kwam (negatief: gisteren); soort: trekker, bakwagen, bus.
  //   rij: rijminuten (schatting); dagdeel: 'vroeg' | 'dag' | 'avond' | 'nacht' (begin van het venster, zie voorkeuren.js);
  //   weekdag 'ma' ... 'zo' en datum 'YYYY-MM-DD' van de ritdag; regio: de regio's die de rit aandoet (de eigen eerst).
  //   urgentie: minuten van het moment dat de rit bekend werd tot het begin van het venster (poolAt(T) geeft ze vanaf T);
  //   prognose: { kans (0 tot 1: wordt de rit ingevuld), opTijd (0 tot 1: ingevuld en binnen het venster weg), tekst, advies,
  //   uitleg, meestal ('eigen' | 'oproep' | 'charter'), basis: { weken: 8, n, ingevuld, eigen, oproep, charter, teLaat, groep,
  //   niveau }, gesimuleerd } uit de historie van acht weken (zie maakHistorie hieronder).
  function maakPool() {
    const R = gen(20261025); const out = []; let nr = 9001;
    const RED = [['ziek', 30], ['uitval voertuig', 25], ['extra rit klant', 30], ['nieuw uit OTM5', 15]];
    const kwart = m => Math.round(m / 15) * 15;
    for (const sp of SP) {
      const vs = trucks.filter(t => t.base === sp && t.diensten.length); if (!vs.length) continue;
      const ritten = vs.reduce((n, t) => n + t.routes.length, 0);
      for (const dag of ['vandaag', 'morgen']) {
        const n = Math.max(1, Math.round(ritten * (0.02 + R() * 0.03)));
        for (let k = 0; k < n; k++) {
          const v = vs[Math.floor(R() * vs.length)];
          const reden = dag === 'morgen' ? (R() < 0.7 ? 'nieuw uit OTM5' : 'extra rit klant') : k === 0 ? 'nieuw uit OTM5' : wpick(RED, R);
          let bekend, v0;
          if (dag === 'morgen') { bekend = k === 0 ? kwart(780 + R() * 90) : kwart(780 + R() * 210); v0 = kwart(120 + R() * 420); }
          else if (k === 0) { bekend = -kwart(60 + R() * 420); v0 = kwart(930 + R() * 210); }
          else if (reden === 'ziek') { bekend = kwart(180 + R() * 270); v0 = bekend + kwart(30 + R() * 90); }
          else if (reden === 'uitval voertuig') { bekend = kwart(300 + R() * 540); v0 = bekend + kwart(30 + R() * 120); }
          else if (reden === 'extra rit klant') { bekend = kwart(360 + R() * 540); v0 = bekend + kwart(60 + R() * 180); }
          else { bekend = -kwart(60 + R() * 420); v0 = kwart(300 + R() * 780); }
          v0 = Math.min(v0, 1290);
          const rt = fitRoute(v, R); const e = stopsSchatting(v, rt.seq.slice(1, -1), v0);
          const eerste = rt.marks[1] && rt.marks[1].place;
          const wd = weekdagVan(dag === 'morgen' ? MORGEN : VANDAAG);
          out.push({
            id: `P-${nr++}`, sp: sp.n, div: v.div, klant: eerste && eerste.formule ? eerste.formule : sp.klant,
            stops: rt.marks.slice(1, -1).map(m => ({ place: m.place, km: m.km, name: m.name, id: plekId(m.place) })),
            venster: [v0, v0 + 60], duur: Math.round(e.min + pauzeSchatting(e.drive, e.min, 0)), km: Math.round(rt.total * 10) / 10,
            oplegger: v.kind === 'trekker' ? wpick(TRMIX[v.div] || TRMIX.netwerk, R) : null, dag, reden, bekend, soort: v.kind, route: rt,
            // voor de vraagkant: rijminuten, dienstdeel en weekdag van het venster, de regio's die de rit aandoet
            rij: Math.round(e.drive), dagdeel: dienstdeel(v0), weekdag: wd, weekend: wd === 'za' || wd === 'zo', datum: isoDag(dag === 'morgen' ? MORGEN : VANDAAG),
            regio: [...new Set([sp.regio, ...rt.marks.slice(1, -1).map(m => regioVan(m.place)).filter(Boolean)])],
          });
        }
      }
    }
    return out;
  }
  // De regio van een plek: die van de dichtstbijzijnde standplaats (voor de voorkeuren van chauffeurs).
  const regioCache = new Map();
  function regioVan(p) {
    if (!p) return null; if (p.fleet !== undefined) return p.regio;
    const k = plekId(p) || `${p.lon},${p.lat}`; let r = regioCache.get(k);
    if (r === undefined) { let best = null, bd = Infinity; for (const s of SP) { const d = kmTo(s, p); if (d < bd) { bd = d; best = s; } } r = best ? best.regio : null; regioCache.set(k, r); }
    return r;
  }
  const klem = (x, a, b) => Math.max(a, Math.min(b, x));
  const wkies = (mix, R) => { let x = R() * mix.reduce((a, m) => a + m[1], 0); for (const [k, w] of mix) { x -= w; if (x <= 0) return k; } return mix[mix.length - 1][0]; };

  // ---------- historie van de pool: acht weken open ritten en hoe ze afliepen (gesimuleerd) ----------
  // Per standplaats per dag 2 tot 5 procent van de ritten (zoals de pool vandaag; maandag meer ziekmeldingen, zondag minder
  // ritten), met divisie, reden, dienstdeel, doorlooptijd (van bekend tot het venster) en de afloop: ingevuld door een eigen
  // chauffeur, een oproepkracht of een charter, of open gebleven (terug naar de klant of naar de volgende dag), en of de rit
  // te laat vertrok. De kansen zijn aannames (schatting): hoe korter dag, hoe minder lukt; 's nachts minder (minder planners
  // en chauffeurs om te bellen; een planner heeft 15 tot 25 trucks, Slimste); in het weekend vullen oproepkrachten meer,
  // 's nachts en bij netwerk en bulk de charters; een grotere standplaats heeft meer reserve. In het echt is dit een export
  // uit het TMS (rit, venster, moment bekend, moment ingevuld, door wie) plus het vertrek uit de boordcomputer; prognose en
  // poolHistorie rekenen dan ongewijzigd op die records.
  // Record: { id, datum, weekdag, sp, regio, div, dagdeel, venster, doorloop, reden, uitkomst: 'eigen' | 'oproep' | 'charter' |
  // 'open', teLaat, vertraging (minuten na het venster) }.
  const HIST_WEKEN = 8;
  const HIST_DAGEN = Array.from({ length: HIST_WEKEN * 7 }, (_, i) => { const d = dagNa(VANDAAG, i - HIST_WEKEN * 7); return { d, iso: isoDag(d), wd: weekdagVan(d), blok: Math.floor(i / 7) + 1 }; });
  const doorloopKlasse = m => m < 60 ? 0 : m < 120 ? 1 : m < 360 ? 2 : m < 900 ? 3 : 4;
  const KLASSE_TEKST = ['minder dan een uur', 'een tot twee uur', 'twee tot zes uur', 'zes tot vijftien uur', 'meer dan vijftien uur'];
  function maakHistorie() {
    const R = gen(20261026); const out = []; let nr = 1;
    const WDF = { ma: 1.15, di: 1, wo: 0.95, do: 1, vr: 1.05, za: 0.9, zo: 0.55 };
    const poisson = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; };
    const kwart = m => Math.round(m / 15) * 15;
    for (const sp of SP) {
      const vs = trucks.filter(t => t.base === sp && t.diensten.length); if (!vs.length) continue;
      const perDiv = {}; for (const t of vs) perDiv[t.div] = (perDiv[t.div] || 0) + t.routes.length;
      const mix = Object.entries(perDiv); const ritten = mix.reduce((a, x) => a + x[1], 0);
      const vul = 0.93 + 0.06 * hash01('vul|' + sp.n) + 0.02 * Math.log(sp.fleet / 16) / Math.log(225 / 16);
      const trend = (hash01('trend|' + sp.n) - 0.5) * 0.08;
      for (const D of HIST_DAGEN) {
        const n = poisson(ritten * 0.035 * WDF[D.wd] * (1 + trend * (D.blok - 4.5) / 3.5));
        for (let k = 0; k < n; k++) {
          const div = wkies(mix, R);
          const reden = wkies([['ziek', D.wd === 'ma' ? 38 : 30], ['uitval voertuig', 25], ['extra rit klant', 30], ['nieuw uit OTM5', 15]], R);
          let v0, doorloop;
          if (reden === 'ziek') { v0 = kwart(210 + R() * 420); doorloop = kwart(30 + R() * 90); }
          else if (reden === 'uitval voertuig') { v0 = kwart(330 + R() * 660); doorloop = kwart(30 + R() * 120); }
          else if (reden === 'extra rit klant') { v0 = kwart(420 + R() * 840); doorloop = kwart(60 + R() * 180); }
          else { v0 = kwart(120 + R() * 960); doorloop = kwart(540 + R() * 900); }
          v0 = Math.min(v0, 1305);
          const dd = dienstdeel(v0), kl = doorloopKlasse(doorloop), weekend = D.wd === 'za' || D.wd === 'zo';
          const pv = klem(vul + [-0.22, -0.1, 0, 0.02, 0.04][kl] + { vroeg: -0.03, dag: 0.01, avond: 0, nacht: -0.08 }[dd] + ({ ma: -0.02, za: -0.04, zo: -0.07 }[D.wd] || 0)
            + ({ bulk: -0.06, netwerk: -0.02, winkel: 0.01, bezorg: 0.02 }[div] || 0) + ({ 'extra rit klant': -0.06, 'nieuw uit OTM5': 0.03 }[reden] || 0), 0.3, 0.985);
          let uitkomst = 'open', teLaat = false, vertraging = 0;
          if (R() < pv) {
            const w = { eigen: 0.55, oproep: 0.22, charter: 0.23 };
            if (weekend) { w.eigen -= 0.12; w.oproep += 0.15; w.charter -= 0.03; }
            if (kl <= 1) { w.eigen += 0.08; w.oproep -= 0.08; }
            if (kl >= 3) { w.eigen -= 0.12; w.oproep += 0.08; w.charter += 0.04; }
            if (dd === 'nacht') { w.charter += 0.1; w.eigen -= 0.05; w.oproep -= 0.05; }
            if (div === 'netwerk' || div === 'bulk') { w.charter += 0.08; w.eigen -= 0.08; }
            if (div === 'bezorg') { w.oproep += w.charter; w.charter = 0; }
            uitkomst = wkies(Object.entries(w).map(([x, y]) => [x, Math.max(0.01, y)]).filter(([x, y]) => !(div === 'bezorg' && x === 'charter')), R);
            if (R() < 0.05 + [0.3, 0.12, 0.02, 0, 0][kl] + (uitkomst === 'charter' ? 0.06 : uitkomst === 'oproep' ? 0.03 : 0) + (dd === 'nacht' ? 0.03 : 0)) { teLaat = true; vertraging = Math.max(15, kwart(10 + R() * 90)); }
          }
          out.push({ id: `H-${String(nr++).padStart(5, '0')}`, datum: D.iso, weekdag: D.wd, sp: sp.n, regio: sp.regio, div, dagdeel: dd, venster: [v0, v0 + 60], doorloop, reden, uitkomst, teLaat, vertraging, gesimuleerd: true });
        }
      }
    }
    return out;
  }

  // ---------- prognose: kans op invulling van een open rit ----------
  // Indirect gestandaardiseerd, zoals een ziekenhuis sterfte vergelijkt: per doorlooptijd (minder dan een uur, een tot twee,
  // twee tot zes, zes tot vijftien, langer) de kans over alle open ritten; per groep vergelijkbare ritten hoeveel er werden
  // ingevuld tegen hoeveel je bij hun doorlooptijden zou verwachten (O/E, met vier ritten als demping). Kans = de kans bij de
  // doorlooptijd van deze rit x O/E van zijn groep. De groep is de kleinste met minstens 12 ritten in acht weken: standplaats,
  // divisie, dienstdeel en weekdag; dan zonder weekdag; dan zonder dienstdeel; dan de regio; dan de divisie.
  let MODEL = null;
  // Op dezelfde manier de kans op een vertrek binnen het venster (opTijd): het deel van de ingevulde ritten dat te laat
  // vertrok, per doorlooptijd, en per groep te laat tegen verwacht (met twee ritten als demping).
  function maakModel(H) {
    const per = [0, 0, 0, 0, 0].map(() => ({ n: 0, ingevuld: 0, teLaat: 0 }));
    for (const h of H) { const k = per[doorloopKlasse(h.doorloop)]; k.n++; if (h.uitkomst !== 'open') { k.ingevuld++; if (h.teLaat) k.teLaat++; } }
    const rate = per.map(k => k.n ? k.ingevuld / k.n : 0.85), laat = per.map(k => k.ingevuld ? k.teLaat / k.ingevuld : 0.1);
    const cellen = new Map();
    const tel = (key, h) => {
      let c = cellen.get(key); if (!c) cellen.set(key, c = { n: 0, ingevuld: 0, eigen: 0, oproep: 0, charter: 0, teLaat: 0, E: 0, EL: 0 });
      const kl = doorloopKlasse(h.doorloop); c.n++; c.E += rate[kl];
      if (h.uitkomst !== 'open') { c.ingevuld++; c[h.uitkomst]++; c.EL += laat[kl]; if (h.teLaat) c.teLaat++; }
    };
    for (const h of H) { tel(`${h.sp}|${h.div}|${h.dagdeel}|${h.weekdag}`, h); tel(`${h.sp}|${h.div}|${h.dagdeel}`, h); tel(`${h.sp}|${h.div}`, h); tel(`r:${h.regio}|${h.div}`, h); tel(`d:${h.div}`, h); }
    return { rate, laat, cellen };
  }
  const urgentieVan = (p, T) => p.venster[0] + (p.dag === 'morgen' ? 1440 : 0) - ((T % 1440) + 1440) % 1440;
  function prognoseVoor(p, lead) {
    const dk = DIV[p.div] ? DIV[p.div].n.toLowerCase() : p.div; const regio = p.regio && p.regio[0];
    const L = [[`${p.sp}|${p.div}|${p.dagdeel}|${p.weekdag}`, `${p.sp}, ${dk}, ${DIENSTDEEL_NAAM[p.dagdeel]}, op ${WEEKDAG_NAAM[p.weekdag]}`], [`${p.sp}|${p.div}|${p.dagdeel}`, `${p.sp}, ${dk}, ${DIENSTDEEL_NAAM[p.dagdeel]}`],
      [`${p.sp}|${p.div}`, `${p.sp}, ${dk}`], [`r:${regio}|${p.div}`, `regio ${regio}, ${dk}`], [`d:${p.div}`, `alle standplaatsen, ${dk}`]];
    let c = null, groep = '', niveau = 0;
    for (let i = 0; i < L.length; i++) { const x = MODEL.cellen.get(L[i][0]); if (x && (x.n >= 12 || i === L.length - 1)) { c = x; groep = L[i][1]; niveau = i + 1; break; } }
    if (!c) c = { n: 0, ingevuld: 0, eigen: 0, oproep: 0, charter: 0, teLaat: 0, E: 0, EL: 0 };
    const kl = doorloopKlasse(Math.max(0, lead));
    const kans = Math.round(klem(MODEL.rate[kl] * (c.ingevuld + 4) / (c.E + 4), 0.03, 0.99) * 100) / 100;
    const opTijd = Math.round(kans * (1 - klem(MODEL.laat[kl] * (c.teLaat + 2) / (c.EL + 2), 0, 0.9)) * 100) / 100;
    const meestal = c.ingevuld ? ['eigen', 'oproep', 'charter'].sort((x, y) => c[y] - c[x])[0] : null;
    return {
      kans, opTijd, tekst: (kans >= 0.85 ? 'Grote kans op invulling' : kans >= 0.65 ? 'Redelijke kans op invulling' : kans >= 0.45 ? 'Onzekere invulling' : 'Kleine kans op invulling') + (kans >= 0.65 && opTijd < 0.7 ? ', maar vaak te laat' : ''),
      advies: kans < 0.45 ? 'Zoek nu een charter; vergelijkbare ritten bleven vaak open.' : kans < 0.65 ? 'Bel eerst de oproepkrachten en houd een charter achter de hand.' : opTijd < 0.7 ? 'Begin nu met bellen; vergelijkbare ritten vertrokken vaak te laat.' : meestal === 'charter' ? 'Komt meestal rond, vaak met een charter.' : meestal === 'oproep' ? 'Komt meestal rond, vaak met een oproepkracht.' : 'Komt meestal rond; eigen chauffeurs eerst.',
      uitleg: `${c.ingevuld} van de ${c.n} vergelijkbare ritten in 8 weken zijn ingevuld (${groep})${c.teLaat ? `, ${c.teLaat} daarvan te laat` : ''}. ${lead > 0 ? `Met ${KLASSE_TEKST[kl]} tot het venster` : 'Nu het venster al open is'} lukt het bij ${Math.round(MODEL.rate[kl] * 100)} % van alle open ritten.`,
      meestal, basis: { weken: HIST_WEKEN, n: c.n, ingevuld: c.ingevuld, eigen: c.eigen, oproep: c.oproep, charter: c.charter, teLaat: c.teLaat, groep, niveau }, gesimuleerd: true,
    };
  }
  // De pool zoals de planner hem om T ziet: wat al bekend is, ritten van vandaag tot hun venster voorbij is, die van morgen;
  // zonder de ritten in 'zonder' (ids die de interface al toewees). Kopieën met urgentie en prognose vanaf T: de kans zakt
  // naarmate het venster dichterbij komt.
  const poolAt = (T, zonder) => {
    const m = ((T % 1440) + 1440) % 1440; const skip = zonder ? new Set(zonder) : null;
    return pool.filter(p => p.bekend <= m && (p.dag === 'morgen' || m < p.venster[1]) && !(skip && skip.has(p.id))).map(p => { const u = urgentieVan(p, m); return { ...p, urgentie: u, prognose: prognoseVoor(p, u) }; });
  };
  // Historie voor een grafiek: per dag (56), per blok van zeven dagen (8, het laatste eindigt gisteren), per dienstdeel, weekdag,
  // divisie en reden, telkens { n, ingevuld, eigen, oproep, charter, teLaat, open, kans }; ritten: de records zelf. sp: naam of
  // standplaats; zonder sp alle standplaatsen samen.
  const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const w = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - w); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
  function poolHistorie(sp) {
    const naam = !sp ? null : typeof sp === 'string' ? sp : sp.n;
    const L = naam ? HIST.filter(h => h.sp === naam) : HIST;
    const leeg = () => ({ n: 0, ingevuld: 0, eigen: 0, oproep: 0, charter: 0, teLaat: 0, open: 0 });
    const add = (c, h) => { c.n++; if (h.uitkomst === 'open') c.open++; else { c.ingevuld++; c[h.uitkomst]++; if (h.teLaat) c.teLaat++; } };
    const af = c => ({ ...c, kans: c.n ? Math.round(c.ingevuld / c.n * 100) / 100 : null });
    const perDag = new Map(HIST_DAGEN.map(D => [D.iso, leeg()]));
    const perDd = Object.fromEntries(DIENSTDELEN.map(k => [k, leeg()])), perWd = Object.fromEntries(WEEKDAGEN.map(k => [k, leeg()]));
    const perDiv = {}, perReden = {}, tot = leeg();
    for (const h of L) { add(perDag.get(h.datum), h); add(perDd[h.dagdeel], h); add(perWd[h.weekdag], h); add(perDiv[h.div] || (perDiv[h.div] = leeg()), h); add(perReden[h.reden] || (perReden[h.reden] = leeg()), h); add(tot, h); }
    const dagen = HIST_DAGEN.map(D => ({ datum: D.iso, weekdag: D.wd, week: isoWeek(D.d), blok: D.blok, ...af(perDag.get(D.iso)) }));
    const perWeek = Array.from({ length: HIST_WEKEN }, (_, i) => { const ds = dagen.slice(i * 7, i * 7 + 7); const c = leeg(); for (const d of ds) for (const k of Object.keys(c)) c[k] += d[k]; return { blok: i + 1, van: ds[0].datum, tot: ds[6].datum, week: ds[6].week, ...af(c) }; });
    const map = o => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, af(c)]));
    return { sp: naam, weken: HIST_WEKEN, van: HIST_DAGEN[0].iso, tot: HIST_DAGEN[HIST_DAGEN.length - 1].iso, totaal: af(tot), dagen, perWeek, perDagdeel: map(perDd), perWeekdag: map(perWd), perDivisie: map(perDiv), perReden: map(perReden), ritten: L, gesimuleerd: true };
  }

  // ---------- kandidaten voor een open rit: eigen chauffeurs, oproepkrachten, charters ----------
  // Eigen chauffeurs van een standplaats: id zoals people.js ze nummert (standplaatsen op volgorde, dan de namen van de pool;
  // met opts.people komen id, divisie, LZV en uurloon uit people.js zelf), de dienst van vandaag (absolute minuten en
  // rijtijd), de status als iemand vandaag vrij is (vrij, vakantie, ziek, rustdag; gesimuleerd), de uren deze week (schatting)
  // en de voorkeuren (voorkeuren.js, dezelfde als de interface met de persoon uit people.js krijgt).
  const persoonId = new Map(); { let k = 0; for (const s of SP) for (const n of driverPool.get(s.n).names) persoonId.set(`${n}|${s.n}`, `P-${String(++k).padStart(4, '0')}`); }
  const dienstVanNaam = new Map(); for (const t of trucks) for (const d of t.diensten) dienstVanNaam.set(`${d.driver}|${t.base.n}`, { t, d });
  const WDI = WEEKDAGEN.indexOf(weekdagVan(VANDAAG));
  const chCache = new Map(); const peopleCache = new WeakMap();
  function chauffeursVan(sp, people) {
    const cache = people ? (peopleCache.get(people) || (peopleCache.set(people, new Map()), peopleCache.get(people))) : chCache;
    let L = cache.get(sp.n); if (L) return L;
    const P = people ? new Map(people.persons.filter(p => p.base === sp).map(p => [p.name, p])) : null;
    L = driverPool.get(sp.n).names.map((naam, i) => {
      const per = P ? P.get(naam) : null; const id = per ? per.id : persoonId.get(`${naam}|${sp.n}`);
      const x = dienstVanNaam.get(`${naam}|${sp.n}`);
      const div = per ? per.div : x ? x.t.div : sp.div[i % sp.div.length];
      const dienst = x ? { start: x.d.start, end: x.d.end, rij: rijVan(x.t, x.d), maxRij: x.d.maxRij, voertuig: x.t.id } : null;
      const R = reeks(VSEED, id, 'status'); const u = R(), u2 = R(), u3 = R(), u4 = R();
      const status = dienst ? 'dienst' : u < 0.62 ? 'vrij' : u < 0.74 ? 'vakantie' : u < 0.82 ? 'ziek' : 'rustdag';
      const statusMorgen = dienst ? 'dienst' : status === 'vakantie' ? 'vakantie' : status === 'ziek' && u2 < 0.5 ? 'ziek' : u2 < 0.55 ? 'vrij' : 'ingeroosterd';
      const weekUren = Math.round((Math.min(WDI, 5) * (0.72 + 0.2 * u3) * (8.6 + 1.8 * u4) + (dienst ? (dienst.end - dienst.start) / 60 : 0)) * 2) / 2;
      const persoon = per || { base: sp, div, dienst: x ? { t: x.t, d: x.d } : null };
      return { id, naam, div, sp: sp.n, dienst, status, statusMorgen, weekUren, weekUrenMorgen: WDI === 6 ? 0 : weekUren, voorkeuren: voorkeurenVan(id, VSEED, persoon), uurloon: per && per.contract ? per.contract.tarief : null, lzv: per && per.licence ? !!per.licence.lzv : null };
    });
    cache.set(sp.n, L); return L;
  }
  // Een vrij voertuig voor de rit op de standplaats: dezelfde soort, niet in onderhoud of met een storing, geen eigen dienst
  // in [a, b] (met 20 minuten speling; het rooster van morgen is dat van vandaag) en niet al toegewezen. Liefst een voertuig
  // waarvan de accu de rit haalt, dan een reservewagen, dan dezelfde divisie.
  function vrijVoertuig(sp, p, a, b, bezet) {
    const vrij = trucks.filter(t => t.base === sp && t.kind === p.soort && t.vandaag !== 'onderhoud' && !t.storing
      && !t.diensten.some(d => [-1440, 0, 1440].some(o => a < d.end + o + 20 && d.start + o - 20 < b))
      && !bezet.some(s => s.voertuig === t.id && a < s.b + 20 && s.a - 20 < b));
    if (!vrij.length) return null;
    const reikt = t => !t.ev || p.km <= t.range * 0.78;
    vrij.sort((x, y) => (reikt(y) - reikt(x)) || ((y.vandaag === 'reserve') - (x.vandaag === 'reserve')) || ((y.div === p.div) - (x.div === p.div)) || (x.idx - y.idx));
    const t = vrij[0];
    return { id: t.id, ev: t.ev, kind: t.kind, model: t.model, kmKost: t.kind === 'bus' ? (t.ev ? KM_KOST.busEv : KM_KOST.bus) : t.ev ? KM_KOST.ev : KM_KOST.diesel, accu: !reikt(t) };
  }
  const poolById = new Map();
  // Wat inzet.js over een rit moet weten (zie daar). opts: { T (nu, minuten; standaard het moment dat de rit bekend werd),
  // people (createPeople), toegewezen: [uitkomsten van wijsToe of hun segmenten], max: { eigen, oproep, charter } }.
  function ritCtx(rit, opts = {}) {
    const p = typeof rit === 'string' ? poolById.get(rit) : rit && rit.id ? poolById.get(rit.id) || rit : null; if (!p) return null;
    const sp = SP.find(s => s.n === p.sp); const off = p.dag === 'morgen' ? 1440 : 0;
    const T = typeof opts.T === 'number' ? ((opts.T % 1440) + 1440) % 1440 : Math.max(0, p.bekend);
    const a = p.venster[0] + off, b = a + p.duur;
    const bezet = (opts.toegewezen || []).map(x => x && x.segment ? x.segment : x).filter(s => s && typeof s.a === 'number' && s.rit !== p.id);
    const charterGebruik = new Map(); for (const s of bezet) if (s.wie && s.wie.soort === 'charter') { const k = `${s.wie.id}|${s.dag}`; charterGebruik.set(k, (charterGebruik.get(k) || 0) + 1); }
    return { rit: p, sp, dag: p.dag, a, b, uren: p.duur / 60, rijMin: p.rij, km: p.km, weekdag: p.weekdag, weekend: p.weekend, dagdeel: p.dagdeel, datum: p.dag === 'morgen' ? MORGEN : VANDAAG, lead: a - T, T, kenmerken: ritKenmerken(p), voertuig: vrijVoertuig(sp, p, a, b, bezet), charterGebruik, bezet };
  }
  // Kandidaten voor een open rit, op volgorde: eigen chauffeurs met uren over waar de rit past, dan oproepkrachten, dan
  // charters met de juiste oplegger (zie inzet.js voor de regels en de vorm). Wie al een toegewezen rit heeft die met deze
  // overlapt, valt af.
  function kandidaten(rit, opts = {}) {
    const ctx = ritCtx(rit, opts); if (!ctx) return [];
    const bezetIds = new Set(ctx.bezet.filter(s => s.wie && ctx.a < s.b + 30 && s.a - 30 < ctx.b).map(s => s.wie.id));
    const eigen = chauffeursVan(ctx.sp, opts.people).filter(c => !bezetIds.has(c.id)).map(c => eigenKandidaat(c, ctx)).filter(Boolean);
    const oproep = OPROEP.filter(o => !bezetIds.has(o.id)).map(o => oproepKandidaat(o, ctx)).filter(Boolean);
    const charter = CHARTERS.map(c => charterKandidaat(c, ctx)).filter(Boolean);
    return rangschik({ eigen, oproep, charter }, opts.max);
  }
  // Toewijzen zonder iets te veranderen: { rit, wie, segment (blok voor het planbord, absolute minuten), log, bericht, kosten,
  // waarschuwingen }. De interface bewaart het en geeft het terug via opts.toegewezen (en de id via poolAt(T, zonder)).
  function wijsToe(rit, kandidaat, opts = {}) { const ctx = ritCtx(rit, opts); return ctx && kandidaat ? toewijzing(ctx, kandidaat) : null; }

  // ---------- kerngetallen van de dag (voor het rapport en tests/data-check.mjs) ----------
  function dagcijfers() {
    const L = []; for (const t of trucks) for (const d of t.diensten) { const segs = t.plan.filter(s => s.d === d.i); L.push({ dur: d.t1 - d.t0, rij: segs.reduce((a, s) => a + (s.k === 'drive' ? s.t1 - s.t0 : 0), 0), div: t.div, wacht: segs.reduce((a, s) => a + (s.k === 'stop' ? s.wacht || 0 : 0), 0) }); }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0; };
    const per = div => { const D = div ? L.filter(x => x.div === div) : L; return { diensten: D.length, mediaanUur: Math.round(med(D.map(x => x.dur)) / 6) / 10, rijdenProcent: Math.round(D.reduce((a, x) => a + x.rij, 0) / Math.max(1, D.reduce((a, x) => a + x.dur, 0)) * 1000) / 10 }; };
    const terrein10 = trucks.filter(t => stateAt(t, 600).st === 'terrein').length;
    const inzet = trucks.filter(t => t.diensten.length);
    return { ...per(null), perDivisie: Object.fromEntries(Object.keys(DIV).map(k => [k, per(k)])), tweedeDienstProcent: Math.round(trucks.filter(t => t.diensten.length > 1).length / trucks.length * 1000) / 10, terreinOm10: terrein10, wachtPerTruckMin: Math.round(inzet.reduce((a, t) => a + t.plan.reduce((b, s) => b + (s.k === 'stop' ? s.wacht || 0 : 0), 0), 0) / Math.max(1, inzet.length)), poolVandaag: pool.filter(p => p.dag === 'vandaag').length, poolMorgen: pool.filter(p => p.dag === 'morgen').length };
  }

  for (const sp of SP) plaatsDocks(sp, trucks.filter(t => t.base === sp && t.diensten.length));
  const pool = maakPool();
  // de historie van acht weken, het model en de prognose van elke rit op het moment dat hij bekend werd
  const HIST = maakHistorie(); MODEL = maakModel(HIST);
  for (const p of pool) { poolById.set(p.id, p); p.urgentie = p.venster[0] + (p.dag === 'morgen' ? 1440 : 0) - p.bekend; p.prognose = prognoseVoor(p, p.urgentie); }

  return { trucks, byId, trailers, trailerById, trailersOf, routeBetween, laadGebouwen, driverPool, stateAt, trailerStateAt, trailerTemp, blocks, departures, dienstenOf, insertPause, insertCharge, shiftDienst, acceptEta, pickupDetour, moveDienst, ST, DIV, KIND, TRT, TRST, laadpunten,
    pool, poolAt, dockPlan, dockPos, eventsOf, wachtPerPlek, wachtVerwacht: (p, minuut) => { const x = plekVan(p); return x ? Math.round(wachtVerwacht(x, minuut) * 10) / 10 : null; }, dagcijfers,
    // de vraagkant (gesimuleerd): prognose en historie van de pool, kandidaten en toewijzen, de flexibele schil, voorkeuren
    urgentie: (p, T) => urgentieVan(p, T), prognose: (p, T) => prognoseVoor(p, urgentieVan(p, T)), poolHistorie, kandidaten, wijsToe,
    CHARTERS, OPROEP, WAARSCHUWINGEN, WAARSCHUWING_KORT, voorkeurenVan, tevredenheid, past, vandaag: VANDAAG };
}
