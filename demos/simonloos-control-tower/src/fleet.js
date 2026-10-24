// Gesimuleerde vloot: elke truck heeft een vast dagplan (segmenten in minuten vanaf dienststart).
// De positie op elk tijdstip volgt uit dat plan, zodat kaart, planbord, vertrekbord en replay altijd overeenkomen.
import { SP, TOWNS, DIV, ST, laadpunten } from './places.js';
import { nearestNode, shortestPath, buildPath, posAt } from './roads.js';

let seed = 20261024; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
export const FIRST = ['Kees', 'Jan', 'Piet', 'Henk', 'Robert', 'Marco', 'Dennis', 'Jeroen', 'Sandra', 'Linda', 'Mohammed', 'Ahmed', 'Daan', 'Bram', 'Sven', 'Thijs', 'Ruud', 'Gerrit', 'Wesley', 'Marieke', 'Anouk', 'Jolanda', 'Patrick', 'Nick', 'Erik', 'Rick', 'Ilse', 'Fatima', 'Jos', 'Ton', 'Sem', 'Peter'];
export const LAST = ['de Vries', 'Bakker', 'Jansen', 'Visser', 'Smit', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker', 'Brouwer', 'Koning', 'Vermeulen', 'Schouten', 'Groot', 'Appelman', 'Vlaar', 'Koster', 'van Dijk', 'Meijer', 'de Jong', 'Willems', 'Kooijman', 'Blokker', 'Ruiter', 'Beemster', 'Zwaan', 'Mol'];
const MODELS = { ev: [['Mercedes-Benz eActros 600', 500], ['Mercedes-Benz eActros 300', 300], ['Volvo FH Electric', 300]], diesel: [['Mercedes-Benz Actros 1845', 1600], ['Scania R 450', 1700], ['DAF XF 480', 1600], ['Volvo FH 460', 1600], ['Scania 460 R Super', 1800]], van: [['Volkswagen e-Crafter', 120], ['Mercedes-Benz eSprinter', 180]] };
const LADING = { winkel: ['Gekoelde zuivel en vlees, 26 rolcontainers', 'Droge kruidenierswaren, 33 pallets', 'Diepvries, 24 pallets (-20 °C)', 'AGF, 30 rolcontainers', 'Brood en banket, 28 rolcontainers'], netwerk: ['Groupage, 18 pallets voor 4 adressen', 'FTL, 33 pallets gekoeld', 'Crossdock Tiel, 26 pallets', 'Dubbeldeks, 52 pallets'], bulk: ['Bulkpoeder, 26 ton', 'Granulaat, 24 ton', 'Suiker (bulk), 27 ton'], dranken: ['Bier en fris, 26 pallets', 'Lege emballage retour', 'Fustbier, 24 pallets'], bezorg: ['Boodschappen, 48 bestellingen', 'Boodschappen, 36 bestellingen'] };
const STORING = ['Storing koelunit: -12 °C (doel -20 °C)', 'Bandenspanning as 2 laag (melding boordcomputer)', 'AdBlue-niveau laag, 180 km resterend'];
const plate = van => { const L = 'BDFGHJKLNPRSTVXZ'; const l = () => L[Math.floor(rnd() * L.length)]; const d = () => Math.floor(rnd() * 10); return van ? `V-${d()}${d()}${d()}-${l()}${l()}` : `${d()}${d()}-${l()}${l()}${l()}-${d()}`; };

for (const s of SP) s.node = nearestNode(s.lon, s.lat);
for (const t of TOWNS) t.node = nearestNode(t.lon, t.lat);
const town = n => TOWNS.find(t => t.n === n);
const FAR = { netwerk: ['Groningen', 'Maastricht', 'Enschede', 'Leeuwarden', 'Rotterdam', 'Eindhoven', 'Venlo', 'Emmen', 'Zwolle', 'Arnhem'], bulk: ['Bergen op Zoom', 'Venlo', 'Hengelo', 'Maastricht', 'Emmen', 'Winschoten', 'Rotterdam'], dranken: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Zwolle', 'Groningen', 'Arnhem', 'Den Haag', 'Breda'] };
const near = (base, maxKm) => TOWNS.filter(t => t.node !== base.node).map(t => [t, Math.hypot((t.lon - base.lon) * 68, (t.lat - base.lat) * 111)]).filter(([, d]) => d < maxKm).sort((a, b) => a[1] - b[1]).slice(0, 12).map(x => x[0]);
const STOPNAME = { winkel: ['AH', 'AH', 'Jumbo', 'Plus', 'Lidl', 'SPAR', 'Vomar'], bezorg: ['Bezorgronde'], netwerk: ['DC', 'Crossdock', 'Klant'], bulk: ['Fabriek', 'Silo'], dranken: ['Horeca-depot', 'Groothandel', 'Supermarkt-DC'] };
const stopName = (div, klant, t) => {
  if (div === 'winkel') { const k = klant && !/Winkeldistributie|Crossdock|Netwerk|Home/.test(klant) ? klant.split(' (')[0].split(' / ')[0] : pick(STOPNAME.winkel); return `${k} ${t.n}`; }
  if (div === 'bezorg') return `Bezorgronde ${t.n}`;
  return `${pick(STOPNAME[div])} ${t.n}`;
};

function makeRoute(base, div, klant) {
  let stops;
  if (div === 'winkel') { const c = near(base, 110); stops = [pick(c), pick(c), rnd() < 0.5 ? pick(c) : null]; }
  else if (div === 'bezorg') { const c = near(base, 45); stops = [pick(c), pick(c)]; }
  else { stops = [town(pick(FAR[div]))]; if (div === 'netwerk' && rnd() < 0.5) stops.push(SP.find(s => s.n === pick(['Tiel', 'Geldermalsen', 'Wognum']))); }
  const seq = [base, ...stops.filter((s, i, a) => s && a.indexOf(s) === i && s.node !== base.node), base];
  const ids = []; const marks = [];
  for (let i = 0; i < seq.length - 1; i++) { const p = shortestPath(seq[i].node, seq[i + 1].node); if (i > 0) p.shift(); marks.push({ place: seq[i], at: ids.length }); ids.push(...p); }
  marks.push({ place: base, at: ids.length - 1 });
  const path = buildPath(ids);
  return { seq, path, marks: marks.map((m, i) => ({ place: m.place, km: path.nodeKm[Math.min(m.at, path.nodeKm.length - 1)], name: i === 0 || i === marks.length - 1 ? base.n : stopName(div, klant, m.place) })), total: path.total };
}

const SHIFTS = { winkel: [[180, 480], [780, 1080]], netwerk: [[240, 1320]], bulk: [[300, 420], [720, 840]], dranken: [[300, 420]], bezorg: [[420, 540], [780, 900]] };
const DWELL = { winkel: [25, 45], netwerk: [40, 70], bulk: [45, 75], dranken: [30, 50], bezorg: [60, 110] };

// Dagplan: lijst segmenten { k: 'drive'|'stop'|'pauze'|'laden'|'terrein', t0, t1, km0, km1, stop, delay, win }
function makePlan(t) {
  const segs = []; let tm = 0, drive = 0, routes = 0, driveNo = 0;
  const addRoute = () => {
    const r = t.routes[routes++]; const legs = r.marks.length - 1;
    for (let i = 0; i < legs; i++) {
      const km0 = r.marks[i].km, km1 = r.marks[i + 1].km, dur = Math.max(4, (km1 - km0) / t.speed * 60 * (1 + rnd() * 0.12));
      if (drive + dur > 270 && i > 0) { segs.push({ k: 'pauze', t0: tm, t1: tm + 45, km0, km1: km0 }); tm += 45; drive = 0; }
      const delay = (t.delayLeg === driveNo++) ? 6 + Math.floor(rnd() * 20) : 0;
      segs.push({ k: 'drive', t0: tm, t1: tm + dur + delay, km0, km1, delay, route: r, idx: i + 1, win: null });
      tm += dur + delay; drive += dur;
      const last = i === legs - 1;
      if (!last) {
        const [a, b] = DWELL[t.div]; const d = a + rnd() * (b - a); const planned = tm - delay; const w0 = Math.floor((planned - 10) / 30) * 30;
        segs[segs.length - 1].win = [w0, w0 + 30];
        segs.push({ k: 'stop', t0: tm, t1: tm + d, km0: km1, km1, stop: r.marks[i + 1].name, route: r, idx: i + 1 }); tm += d;
      }
    }
  };
  addRoute();
  const back = t.ev ? 60 + rnd() * 40 : 25 + rnd() * 30;
  segs.push({ k: t.ev ? 'laden' : 'terrein', t0: tm, t1: tm + back, km0: 0, km1: 0 }); tm += back;
  if (tm < 400 && t.routes.length > 1) { if (drive > 200) { segs.push({ k: 'pauze', t0: tm, t1: tm + 45, km0: 0, km1: 0 }); tm += 45; drive = 0; } addRoute(); const b2 = t.ev ? 90 : 20; segs.push({ k: t.ev ? 'laden' : 'terrein', t0: tm, t1: tm + b2, km0: 0, km1: 0 }); tm += b2; }
  segs.push({ k: 'terrein', t0: tm, t1: 1440, km0: 0, km1: 0 });
  t.shiftEnd = Math.min(1440, tm);
  for (const s of segs) if (s.k === 'drive') s.range = s.route.path;
  return segs;
}

export function createFleet() {
  const trucks = []; let n = 0;
  for (const s of SP) {
    for (let i = 0; i < s.fleet; i++) {
      const div = s.div[i % s.div.length], van = div === 'bezorg';
      const evShare = { winkel: 0.22, bezorg: 0.6, dranken: 0.2, netwerk: 0.12, bulk: 0.05 }[div];
      const ev = rnd() < evShare;
      const [model, range] = pick(van ? MODELS.van : ev ? (div === 'netwerk' || div === 'bulk' ? [MODELS.ev[0]] : MODELS.ev) : MODELS.diesel);
      const sh = pick(SHIFTS[div]); const shiftStart = Math.round(sh[0] + rnd() * (sh[1] - sh[0]));
      const t = {
        id: `W-${String(++n).padStart(4, '0')}`, idx: n, plate: plate(van), base: s, div, van, ev, model, range,
        klant: s.klant, driver: `${pick(FIRST)} ${pick(LAST)}`, since: 2005 + Math.floor(rnd() * 20),
        speed: van ? 55 : div === 'bulk' ? 76 : div === 'netwerk' ? 82 : 78, lading: pick(LADING[div]),
        shiftStart, routes: [makeRoute(s, div, s.klant)], delayLeg: rnd() < 0.09 ? Math.floor(rnd() * 4) : -1,
        storing: null, lzv: div === 'netwerk' && /LZV/.test(s.klant) && rnd() < 0.5,
      };
      if (rnd() < 0.55 && !van) t.routes.push(makeRoute(s, div, s.klant));
      t.plan = makePlan(t);
      trucks.push(t);
    }
  }
  // drie vaste technische storingen
  [trucks[41], trucks[388], trucks[903]].forEach((t, i) => { if (t) t.storing = STORING[i]; });
  const byId = new Map(trucks.map(t => [t.id, t]));

  // Toestand van één truck op tijdstip T (minuten van de dag).
  function stateAt(t, T) {
    const rel = (((T - t.shiftStart) % 1440) + 1440) % 1440;
    let si = t.plan.length - 1; for (let i = 0; i < t.plan.length; i++) if (rel >= t.plan[i].t0 && rel < t.plan[i].t1) { si = i; break; }
    const seg = t.plan[si];
    let st, pos, km = 0;
    if (seg.k === 'drive') { const f = (rel - seg.t0) / (seg.t1 - seg.t0); km = seg.km0 + (seg.km1 - seg.km0) * f; pos = posAt(seg.route.path, km); st = seg.delay > 0 && !t.delayResolved ? 'vertraagd' : 'onderweg'; }
    else if (seg.k === 'stop') { pos = posAt(seg.route.path, seg.km0); st = 'klant'; }
    else if (seg.k === 'pauze') { pos = seg.route ? posAt(seg.route.path, seg.km0) : { lon: t.base.lon, lat: t.base.lat, bearing: 0 }; if (!seg.route) { const prev = t.plan[si - 1]; if (prev && prev.route) pos = posAt(prev.route.path, prev.km1); } st = 'pauze'; }
    else { pos = { lon: t.base.lon + ((t.idx % 11) - 5) * 0.0007, lat: t.base.lat + ((t.idx % 5) - 2) * 0.0004, bearing: 90 }; st = 'terrein'; }
    // rijtijd sinds laatste pauze of terrein; km sinds laatste lading
    let drive = 0, kmSince = 0;
    for (let i = si; i >= 0; i--) { const s = t.plan[i]; if (i < si && (s.k === 'pauze' || s.k === 'terrein' || s.k === 'laden')) break; if (s.k === 'drive') { const end = i === si ? rel : s.t1; drive += Math.max(0, end - s.t0) * (s.t1 - s.t0 - (s.delay || 0)) / (s.t1 - s.t0); } }
    for (let i = si; i >= 0; i--) { const s = t.plan[i]; if (i < si && (s.k === 'laden' || (s.k === 'terrein' && i > 0))) break; if (s.k === 'drive') kmSince += (i === si ? km - s.km0 : s.km1 - s.km0); }
    const soc = Math.max(3, 100 - kmSince / t.range * 100 * (t.ev ? 1 : 0.55));
    // volgende stop
    let next = null;
    for (let i = si; i < t.plan.length; i++) { const s = t.plan[i]; if (s.k === 'stop' && (i > si || s.k !== seg.k)) { const d = t.plan[i - 1]; next = { name: s.stop, eta: t.shiftStart + s.t0 - (t.delayResolved && d ? d.delay || 0 : 0), planned: t.shiftStart + s.t0 - (d && d.delay || 0), win: d && d.win ? [t.shiftStart + d.win[0], t.shiftStart + d.win[1]] : null, delay: t.delayResolved ? 0 : (d && d.delay || 0), kmLeft: d ? Math.max(0, d.km1 - km) : 0 }; break; } if (s.k === 'laden' || (s.k === 'terrein' && i > si)) { next = { name: `Terug ${t.base.n}`, eta: t.shiftStart + s.t0, planned: t.shiftStart + s.t0, win: null, delay: 0, kmLeft: seg.k === 'drive' ? Math.max(0, seg.km1 - km) : 0, home: true }; break; } }
    return { seg, si, rel, st, pos, km, drive, soc, next, speed: seg.k === 'drive' ? Math.round(t.speed * (0.85 + ((rel * 7) % 10) / 40)) : 0 };
  }

  // Dagblokken voor het planbord (absolute minuten van de dag; kunnen > 1440 lopen).
  function blocks(t) {
    return t.plan.filter(s => s.t1 > s.t0 && !(s.k === 'terrein' && s.t1 === 1440)).map(s => ({ a: t.shiftStart + s.t0, b: t.shiftStart + s.t1, k: s.k, label: s.k === 'drive' ? `→ ${s.route.marks[s.idx].name}` : s.k === 'stop' ? s.stop : s.k === 'pauze' ? 'Pauze' : s.k === 'laden' ? 'Laden accu' : 'Terrein', delay: t.delayResolved ? 0 : (s.delay || 0), win: s.win }));
  }

  // Vertrekken vanaf een standplaats binnen [T, T+horizon].
  function departures(sp, T, horizon = 90) {
    const out = [];
    for (const t of trucks) { if (t.base !== sp) continue; for (const s of t.plan) { if (s.k !== 'drive' || s.km0 !== 0) continue; const at = t.shiftStart + s.t0; const d = ((at - T) % 1440 + 1440) % 1440; if (d <= horizon) out.push({ t, at: T + d, dest: s.route.marks[s.idx].name, dock: (t.id.charCodeAt(5) % 8) + 1 }); } }
    return out.sort((a, b) => a.at - b.at);
  }

  return { trucks, byId, stateAt, blocks, departures, ST, DIV, laadpunten };
}
