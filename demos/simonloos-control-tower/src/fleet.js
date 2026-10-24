// Gesimuleerde vloot 3.0: motorvoertuigen (trekkers, bakwagens, bestelbussen) en losse opleggers.
// Chauffeurs hebben geen vaste wagen: per dienst krijgt een chauffeur een voertuig uit de pool van de standplaats, en een
// trekker rijdt vaak twee diensten per dag met twee chauffeurs. Opleggers worden op het terrein gekoppeld, bij de laatste
// winkel of een DC gewisseld (drop & swap) en na de rit afgekoppeld; een losse oplegger staat op het terrein, bij een DC
// of bij een winkel, geladen of leeg. Elk voertuig heeft een vast dagplan (segmenten in minuten vanaf de eerste dienst) en
// elke oplegger een tijdlijn; de positie op elk tijdstip volgt daaruit, zodat kaart, planbord, opleggerbord en replay kloppen.
import { SP, TOWNS, DIV, ST, laadpunten } from './places.js';
import { nearestNode, shortestPath, buildPath, posAt } from './roads.js';

let seed = 20261024; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
const r = (a, b) => a + rnd() * (b - a);
export const FIRST = ['Kees', 'Jan', 'Piet', 'Henk', 'Robert', 'Marco', 'Dennis', 'Jeroen', 'Sandra', 'Linda', 'Mohammed', 'Ahmed', 'Daan', 'Bram', 'Sven', 'Thijs', 'Ruud', 'Gerrit', 'Wesley', 'Marieke', 'Anouk', 'Jolanda', 'Patrick', 'Nick', 'Erik', 'Rick', 'Ilse', 'Fatima', 'Jos', 'Ton', 'Sem', 'Peter', 'Youssef', 'Lars', 'Niels', 'Femke', 'Bas', 'Tom', 'Kevin', 'Martijn'];
export const LAST = ['de Vries', 'Bakker', 'Jansen', 'Visser', 'Smit', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker', 'Brouwer', 'Koning', 'Vermeulen', 'Schouten', 'Groot', 'Appelman', 'Vlaar', 'Koster', 'van Dijk', 'Meijer', 'de Jong', 'Willems', 'Kooijman', 'Blokker', 'Ruiter', 'Beemster', 'Zwaan', 'Mol', 'Karsten', 'Timmerman', 'Bruin', 'Hoogland', 'Ott', 'Laan', 'Zeeman', 'Doodeman'];

// Soorten motorvoertuigen en opleggers.
export const KIND = { trekker: { n: 'Trekker', mv: 'trekkers' }, bakwagen: { n: 'Bakwagen', mv: 'bakwagens' }, bus: { n: 'Bestelbus', mv: 'bestelbussen' } };
export const TRT = {
  koel: { n: 'Koeloplegger', temp: [2, 4] }, vries: { n: 'Vriesoplegger', temp: [-22, -18] }, droog: { n: 'Gesloten oplegger' }, huif: { n: 'Schuifzeiloplegger' },
  lzv: { n: 'LZV-combinatie' }, silo: { n: 'Silo-oplegger' }, drank: { n: 'Drankenoplegger' }, city: { n: 'City-oplegger' },
};
export const TRST = {
  gekoppeld: { n: 'Gekoppeld', color: '#16A34A' }, klaar: { n: 'Klaar voor vertrek', color: '#0E7490' }, geladen: { n: 'Geladen bij klant', color: '#2563EB' },
  wacht: { n: 'Wacht op ophalen', color: '#D97706' }, leeg: { n: 'Leeg op terrein', color: '#9CA3AF' }, onderhoud: { n: 'In onderhoud', color: '#DC2626' },
};
const TRMIX = { winkel: [['koel', 45], ['vries', 15], ['droog', 28], ['city', 12]], netwerk: [['droog', 45], ['huif', 20], ['koel', 20], ['lzv', 15]], bulk: [['silo', 100]], dranken: [['drank', 70], ['huif', 30]] };
const TRRATIO = { winkel: 1.6, netwerk: 1.45, bulk: 1.15, dranken: 1.3 };
const wpick = mix => { let x = rnd() * 100; for (const [k, w] of mix) { x -= w; if (x <= 0) return k; } return mix[0][0]; };

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
const plate = kind => { const L = 'BDFGHJKLNPRSTVXZ'; const l = () => L[Math.floor(rnd() * L.length)]; const d = () => Math.floor(rnd() * 10); return kind === 'bus' ? `V-${d()}${d()}${d()}-${l()}${l()}` : kind === 'oplegger' ? `O${l()}-${d()}${d()}-${l()}${l()}` : `${d()}${d()}-${l()}${l()}${l()}-${d()}`; };

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

// Dienstvensters (start, minuten van de dag) en de kans op een tweede dienst op hetzelfde voertuig.
const SHIFT1 = { winkel: [150, 330], netwerk: [210, 450], bulk: [270, 390], dranken: [270, 420], bezorg: [400, 470] };
const SHIFT2 = { winkel: [720, 930], netwerk: [1140, 1260], bulk: [720, 810], dranken: [780, 840], bezorg: [760, 820] };
const SECOND = { winkel: 0.62, netwerk: 0.3, bulk: 0.35, dranken: 0.25, bezorg: 0.7 };
const DWELL = { winkel: [25, 45], netwerk: [40, 70], bulk: [45, 75], dranken: [30, 50], bezorg: [60, 110] };

export function createFleet() {
  const trucks = []; const trailers = []; const trailerPool = new Map(); const driverPool = new Map();
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
  // Losse opleggers bij winkels van gisteren (gewisseld, wachten op ophalen): een paar per standplaats met winkeldistributie.
  for (const s of SP) {
    const pool = (trailerPool.get(s.n) || []).filter(tr => tr.div === 'winkel' && !tr.onderhoud && !tr.yardLoaded);
    const towns = near(s, 60); if (!towns.length) continue;
    for (let i = 0; i < Math.min(pool.length, Math.ceil(pool.length * 0.03)); i++) {
      const tr = pool[i]; const tw = pick(towns); const a = -Math.round(r(300, 720));
      tr.seeded = { name: stopName('winkel', s.klant, tw), lon: tw.lon + 0.004, lat: tw.lat + 0.002 };
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

  // ---------- chauffeurspool per standplaats ----------
  for (const s of SP) {
    const names = new Set(); const n = Math.ceil(s.fleet * 1.7);
    while (names.size < n) names.add(`${pick(FIRST)} ${pick(LAST)}`);
    driverPool.set(s.n, { names: [...names], next: 0 });
  }
  const takeDriver = sp => { const p = driverPool.get(sp.n); const name = p.names[p.next % p.names.length]; p.next++; return name; };

  // ---------- dagplan per voertuig ----------
  const mins = (a, b) => Math.max(4, a + rnd() * (b - a));
  function makePlan(t) {
    const segs = []; let tm = 0; let coupled = null; let driveNo = 0;
    const abs = rel => t.dayStart + rel;
    const trEvent = (tr, ev) => { ev.by = t; tr.events.push(ev); tr.uses++; };
    t.diensten.forEach((d, di) => {
      if (di > 0) { segs.push({ k: 'terrein', t0: tm, t1: d.rel0, d: null, tr: null }); tm = d.rel0; }
      d.t0 = tm; let drive = 0;
      d.routes.forEach((rt, ri) => {
        if (ri > 0) { const b2 = t.ev ? mins(60, 95) : mins(15, 30); segs.push({ k: t.ev ? 'laden' : 'terrein', t0: tm, t1: tm + b2, d: di, tr: null }); tm += b2; if (drive > 200) { segs.push({ k: 'pauze', t0: tm, t1: tm + 45, d: di, tr: null }); tm += 45; drive = 0; } }
        // trekker: een geladen oplegger koppelen op het terrein (10 minuten)
        if (t.kind === 'trekker') {
          const tr = takeTrailer(t.base, t.div, abs(tm), true);
          if (tr) { coupled = tr; segs.push({ k: 'koppel', t0: tm, t1: tm + 10, d: di, tr, ev: { k: 'koppel', tr } }); trEvent(tr, { k: 'coupled', a: abs(tm), b: Infinity, vehicle: t, loaded: true, lading: tr.lading }); tm += 10; }
        }
        const legs = rt.marks.length - 1;
        for (let i = 0; i < legs; i++) {
          const km0 = rt.marks[i].km, km1 = rt.marks[i + 1].km, dur = Math.max(4, (km1 - km0) / t.speed * 60 * (1 + rnd() * 0.12));
          if (drive + dur > 270 && i > 0) { segs.push({ k: 'pauze', t0: tm, t1: tm + 45, km0, km1: km0, d: di, tr: coupled, route: rt }); tm += 45; drive = 0; }
          const delay = (d.delayLeg === driveNo++) ? 6 + Math.floor(rnd() * 20) : 0;
          segs.push({ k: 'drive', t0: tm, t1: tm + dur + delay, km0, km1, delay, route: rt, idx: i + 1, win: null, d: di, tr: coupled });
          tm += dur + delay; drive += dur;
          const last = i === legs - 1;
          if (!last) {
            const [a, b] = DWELL[t.div]; const planned = tm - delay; const w0 = Math.floor((planned - 10) / 30) * 30;
            segs[segs.length - 1].win = [w0, w0 + 30];
            const place = rt.marks[i + 1].place; const lastStop = i === legs - 2;
            // drop & swap: bij de laatste winkel van een winkelrit (30 %) of bij een eigen DC in het netwerk (altijd) blijft de
            // geladen oplegger achter; de trekker neemt een lege mee als er een staat, anders rijdt hij solo terug.
            let swap = null;
            if (coupled && ((t.div === 'winkel' && lastStop && rnd() < 0.1) || (t.div === 'netwerk' && place.fleet))) {
              const stopPlace = place.fleet ? { name: `terrein ${place.n}`, lon: place.lon + 0.002, lat: place.lat - 0.0012, yard: true } : { name: rt.marks[i + 1].name, lon: place.lon + 0.003, lat: place.lat + 0.0015 };
              const take = place.fleet ? takeTrailer(place, 'netwerk', abs(tm + 15), rnd() < 0.5) : null;
              const cur = coupled.events[coupled.events.length - 1]; if (cur && cur.k === 'coupled') cur.b = abs(tm + 15);
              trEvent(coupled, { k: 'site', a: abs(tm + 15), b: abs(tm + 15) + 2880, place: stopPlace, loaded: true, unloadAt: abs(tm + 15) + Math.round(r(70, 130)), pickup: abs(tm + 15) + 1440 + Math.round(r(-180, 240)), vehicle: null });
              coupled.busyUntil = Infinity; swap = { drop: coupled, take };
              if (take) { trEvent(take, { k: 'coupled', a: abs(tm + 15), b: Infinity, vehicle: t, loaded: !!take.lading, lading: take.lading }); take.busyUntil = Infinity; }
              coupled = take;
            }
            const dwell = swap ? mins(15, 25) : a + rnd() * (b - a);
            segs.push({ k: 'stop', t0: tm, t1: tm + dwell, km0: km1, km1, stop: rt.marks[i + 1].name, route: rt, idx: i + 1, d: di, tr: swap ? swap.drop : coupled, swap, place });
            tm += dwell;
          }
        }
        // terug op het terrein: afkoppelen (de oplegger is dan leeg en staat weer op het terrein)
        if (coupled) {
          const cur = coupled.events[coupled.events.length - 1]; if (cur && cur.k === 'coupled') cur.b = abs(tm + 8);
          coupled.busyUntil = abs(tm + 8); coupled.lading = null;
          segs.push({ k: 'ontkoppel', t0: tm, t1: tm + 8, d: di, tr: coupled, ev: { k: 'ontkoppel', tr: coupled } }); tm += 8; coupled = null;
        }
      });
      d.t1 = tm;
    });
    const back = t.ev ? mins(60, 100) : mins(20, 40);
    if (t.diensten.length) { segs.push({ k: t.ev ? 'laden' : 'terrein', t0: tm, t1: tm + back, d: null, tr: null }); tm += back; }
    segs.push({ k: 'terrein', t0: tm, t1: Math.max(1440, tm + 1), d: null, tr: null });
    for (const s of segs) if (s.k === 'drive') s.range = s.route.path;
    return segs;
  }

  const estMin = (rt, t) => rt.total / t.speed * 60 + (rt.marks.length - 2) * 38 + 25;
  // elektrisch: een rit die niet binnen 78 % van het bereik past wordt opnieuw gepland (bussen en eActros 300)
  const fitRoute = t => { let r = makeRoute(t.base, t.div, t.klant); if (t.ev) for (let k = 0; k < 8 && r.total > t.range * 0.78; k++) r = makeRoute(t.base, t.div, t.klant); return r; };
  for (const t of trucks) {
    if (t.vandaag !== 'inzet') { t.dayStart = 0; t.plan = [{ k: 'terrein', t0: 0, t1: 1440, d: null, tr: null }]; t.shiftStart = 0; t.shiftEnd = 0; t.routes = []; continue; }
    const w1 = SHIFT1[t.div]; const start1 = Math.round(r(w1[0], w1[1]) / 5) * 5;
    const routes1 = [fitRoute(t)]; if (t.kind !== 'bus' && rnd() < 0.5 && estMin(routes1[0], t) < 300) { const r2 = fitRoute(t); if (estMin(routes1[0], t) + estMin(r2, t) < 560) routes1.push(r2); }
    t.diensten = [{ i: 0, start: start1, driver: takeDriver(t.base), routes: routes1, delayLeg: rnd() < 0.09 ? Math.floor(rnd() * 4) : -1, rel0: 0 }];
    t.lzv = t.kind === 'trekker' && t.div === 'netwerk' && /LZV/.test(t.klant) && rnd() < 0.5;
    t.dayStart = start1;
    // eerst de eerste dienst plannen om te weten wanneer de tweede kan beginnen
    t.plan = makePlan(t); const end1 = t.diensten[0].t1;
    if (rnd() < SECOND[t.div]) {
      const w2 = SHIFT2[t.div]; const want = Math.round(r(w2[0], w2[1]) / 5) * 5 - t.dayStart; const rel0 = Math.max(end1 + 25, want);
      if (rel0 < 1440 - 240) {
        // opleggers van de eerste dienst weer vrijgeven, plan opnieuw met twee diensten
        for (const tr of trailers) if (tr.events.some(e => e.by === t)) { tr.events = tr.events.filter(e => e.by !== t); tr.busyUntil = -1; tr.lading = tr.yardLoaded ? tr.lading : null; }
        const routes2 = [fitRoute(t)]; if (t.kind !== 'bus' && rnd() < 0.35 && estMin(routes2[0], t) < 300) { const r2 = fitRoute(t); if (estMin(routes2[0], t) + estMin(r2, t) < 520) routes2.push(r2); }
        t.diensten.push({ i: 1, start: t.dayStart + rel0, driver: takeDriver(t.base), routes: routes2, delayLeg: rnd() < 0.09 ? Math.floor(rnd() * 4) : -1, rel0 });
        t.plan = makePlan(t);
      }
    }
    t.routes = t.diensten.flatMap(d => d.routes);
    if (t.kind !== 'trekker') t.lading = pick(LADING[t.div]);
    t.shiftStart = t.dayStart; t.shiftEnd = t.diensten[t.diensten.length - 1].t1;
    for (const d of t.diensten) { d.end = t.dayStart + d.t1; d.t = t; }
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
    let st, pos, km = 0;
    const yard = () => ({ lon: t.base.lon + ((t.idx % 11) - 5) * 0.0007, lat: t.base.lat + ((t.idx % 5) - 2) * 0.0004, bearing: 90 });
    if (seg.k === 'drive') { const f = (rel - seg.t0) / (seg.t1 - seg.t0); km = seg.km0 + (seg.km1 - seg.km0) * f; pos = posAt(seg.route.path, km); st = seg.delay > 0 && !t.delayResolved ? 'vertraagd' : 'onderweg'; }
    else if (seg.k === 'stop') { pos = posAt(seg.route.path, seg.km0); st = 'klant'; }
    else if (seg.k === 'pauze') { pos = seg.route ? posAt(seg.route.path, seg.km0) : yard(); if (!seg.route) { const prev = t.plan[si - 1]; if (prev && prev.route) pos = posAt(prev.route.path, prev.km1); } st = 'pauze'; }
    else { pos = yard(); st = 'terrein'; }
    // rijtijd sinds de laatste pauze of het terrein; km sinds de laatste lading
    let drive = 0, kmSince = 0;
    for (let i = si; i >= 0; i--) { const s = t.plan[i]; if (i < si && (s.k === 'pauze' || s.k === 'terrein' || s.k === 'laden' || s.k === 'koppel' || s.k === 'ontkoppel')) break; if (s.k === 'drive') { const end = i === si ? rel : s.t1; drive += Math.max(0, end - s.t0) * (s.t1 - s.t0 - (s.delay || 0)) / (s.t1 - s.t0); } }
    for (let i = si; i >= 0; i--) { const s = t.plan[i]; if (i < si && (s.k === 'laden' || (s.k === 'terrein' && i > 0))) break; if (s.k === 'drive') kmSince += (i === si ? km - s.km0 : s.km1 - s.km0); }
    const soc = Math.max(3, 100 - kmSince / t.range * 100 * (t.ev ? 1 : 0.55));
    // volgende stop
    let next = null;
    for (let i = si; i < t.plan.length; i++) {
      const s = t.plan[i];
      if (s.k === 'stop' && i > si) { const d = t.plan[i - 1]; const dl = d && d.k === 'drive' ? d.delay || 0 : 0; next = { name: s.stop, eta: t.dayStart + s.t0 - (t.delayResolved ? dl : 0), planned: t.dayStart + s.t0 - dl, win: d && d.win ? [t.dayStart + d.win[0], t.dayStart + d.win[1]] : null, delay: t.delayResolved ? 0 : dl, kmLeft: d && d.k === 'drive' ? Math.max(0, d.km1 - km) : 0, swap: s.swap }; break; }
      if ((s.k === 'ontkoppel' || s.k === 'laden' || (s.k === 'terrein' && i > si)) && i > si) { const dl = seg.k === 'drive' && !t.delayResolved ? seg.delay || 0 : 0; next = { name: `Terug ${t.base.n}`, eta: t.dayStart + s.t0 - (seg.k === 'drive' && t.delayResolved ? seg.delay || 0 : 0), planned: t.dayStart + s.t0 - (seg.k === 'drive' ? seg.delay || 0 : 0), win: null, delay: dl, kmLeft: seg.k === 'drive' ? Math.max(0, seg.km1 - km) : 0, home: true, volgende: t.diensten.find(d => d.rel0 > s.t0) || null }; break; }
    }
    const dienst = seg.d === null || seg.d === undefined ? null : t.diensten[seg.d];
    const upcoming = !dienst && t.diensten.find(d => d.rel0 > rel) || null;
    return { seg, si, rel, st, pos, km, drive, soc, next, speed: seg.k === 'drive' ? Math.round(t.speed * (0.85 + ((rel * 7) % 10) / 40)) : 0, tr: seg.tr || null, dienst, driver: dienst ? dienst.driver : '', upcoming, solo: t.kind === 'trekker' && !seg.tr && (seg.k === 'drive' || seg.k === 'stop') };
  }

  // ---------- toestand van een oplegger op tijdstip T ----------
  function trailerStateAt(tr, T) {
    const Td = ((T % 1440) + 1440) % 1440;
    let ev = null, at = Td;
    for (const cand of [Td, Td + 1440]) { for (const e of tr.events) if (e.a <= cand && cand < e.b) { ev = e; at = cand; break; } if (ev) break; }
    if (ev && ev.k === 'coupled') { const s = stateAt(ev.vehicle, T); return { st: 'gekoppeld', pos: s.pos, vehicle: ev.vehicle, since: ev.a, lading: ev.lading, loaded: !!ev.lading, place: null, moving: s.st === 'onderweg' || s.st === 'vertraagd', vs: s }; }
    if (ev && ev.k === 'site') { const loaded = ev.loaded && at < ev.unloadAt; if (ev.place.yard) return { st: loaded ? 'klaar' : 'leeg', pos: { lon: ev.place.lon, lat: ev.place.lat, bearing: 0 }, vehicle: null, since: ev.a, lading: loaded ? ev.lading : null, loaded, place: ev.place.name, vs: null }; return { st: loaded ? 'geladen' : 'wacht', pos: { lon: ev.place.lon, lat: ev.place.lat, bearing: 0 }, vehicle: null, since: ev.a, lading: loaded ? ev.lading || tr.lading : null, loaded, place: ev.place.name, wait: loaded ? 0 : at - ev.unloadAt, unloadAt: ev.unloadAt, pickup: ev.pickup, late: !loaded && ev.pickup !== undefined && at > ev.pickup + 60, vs: null }; }
    const pos = { lon: tr.base.lon + ((tr.id.charCodeAt(3) * 7 + tr.id.charCodeAt(5)) % 13 - 6) * 0.0006, lat: tr.base.lat - 0.0012 - ((tr.id.charCodeAt(4) * 3) % 5) * 0.0004, bearing: 0 };
    if (tr.onderhoud) return { st: 'onderhoud', pos, vehicle: null, since: 0, lading: null, loaded: false, place: `werkplaats ${tr.base.n}`, vs: null };
    return { st: tr.yardLoaded ? 'klaar' : 'leeg', pos, vehicle: null, since: 0, lading: tr.yardLoaded ? tr.lading : null, loaded: tr.yardLoaded, place: `terrein ${tr.base.n}`, vs: null };
  }
  // Temperatuur in een koel- of vriesoplegger (gesimuleerde telemetrie).
  function trailerTemp(tr, T) {
    const tt = TRT[tr.type]; if (!tt.temp) return null; const [a, b] = tt.temp; const mid = (a + b) / 2;
    if (tr.storing) return -12 + Math.sin(T / 37) * 0.4;
    return +(mid + Math.sin(T / 23 + tr.id.length) * (b - a) * 0.4 + ((tr.id.charCodeAt(4) % 7) - 3) * 0.08).toFixed(1);
  }

  // Dagblokken voor het planbord (absolute minuten; kunnen > 1440 lopen).
  function blocks(t) {
    return t.plan.filter(s => s.t1 > s.t0 && !(s.k === 'terrein' && s.t1 >= 1440)).map(s => ({
      a: t.dayStart + s.t0, b: t.dayStart + s.t1, k: s.k, d: s.d, tr: s.tr, swap: s.swap || null,
      label: s.k === 'drive' ? `→ ${s.route.marks[s.idx].name}` : s.k === 'stop' ? s.stop : s.k === 'pauze' ? 'Pauze' : s.k === 'laden' ? 'Laden accu' : s.k === 'koppel' ? `Koppelen ${s.tr.id}` : s.k === 'ontkoppel' ? `Afkoppelen ${s.tr.id}` : 'Terrein',
      delay: t.delayResolved ? 0 : (s.delay || 0), win: s.win,
    }));
  }

  // Vertrekken vanaf een standplaats binnen [T, T+horizon]: de eerste rit van elke route (km 0), met chauffeur en oplegger.
  function departures(sp, T, horizon = 90) {
    const out = [];
    for (const t of trucks) {
      if (t.base !== sp) continue;
      for (const s of t.plan) { if (s.k !== 'drive' || s.km0 !== 0) continue; const at = t.dayStart + s.t0; const dd = ((at - T) % 1440 + 1440) % 1440; if (dd <= horizon) out.push({ t, at: T + dd, dest: s.route.marks[s.idx].name, dock: (t.id.charCodeAt(3) % 8) + 1, tr: s.tr, driver: s.d === null ? '' : t.diensten[s.d].driver, dienst: s.d === null ? null : t.diensten[s.d] }); }
    }
    return out.sort((a, b) => a.at - b.at);
  }
  const trailersOf = sp => trailerPool.get(sp.n) || [];
  const dienstenOf = t => t.diensten;

  return { trucks, byId, trailers, trailerById, trailersOf, driverPool, stateAt, trailerStateAt, trailerTemp, blocks, departures, dienstenOf, ST, DIV, KIND, TRT, TRST, laadpunten };
}
