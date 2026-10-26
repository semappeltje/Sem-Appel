// Het plan aanpassen vanaf het planbord en de voorstellen: een rit naar een ander voertuig of een andere tijd zetten,
// en een rit uit de pool ("Niet ingepland") inplannen. fleet.js heeft daar (nog) geen functies voor; dit werkt op de
// bestaande datavorm en houdt de vaste regels van het dagplan aan:
//   - tijden in een plan zijn minuten vanaf dayStart van het voertuig; segmenten sluiten op elkaar aan;
//   - het laatste segment (terrein) loopt tot na middernacht;
//   - s.d is de index van de dienst in t.diensten (op volgorde van de dag), d.person en person.dienst wijzen naar elkaar;
//   - opleggergebeurtenissen (tr.events) horen bij het voertuig dat de oplegger trekt (by, vehicle).
// Daarnaast de vertaling van ritten en voertuigen naar de invoer van de toetsregels (toets.js) en de kandidaten voor
// "Waar past deze rit?". Als fleet.js later eigen functies krijgt (verplaatsRit, planPoolRit), gaan die voor.
import { toets, rangschik, NORM } from './toets.js';
import { TRT } from '../fleet.js';
import { toegangVan, plekNaam, SP, WINKELS, DCS, winkelById, dcById } from '../places.js';
import { shortestPath, buildPath, kmBetween, nodes as GN } from '../roads.js';
import { CAPACITY } from '../people.js';

const EPS = 0.01;
export const absT = (t, rel) => t.dayStart + rel;
const koelType = tr => (tr && TRT[tr.type] && TRT[tr.type].temp ? 'koel' : 'droog');
// soorten opleggers die voor elkaar kunnen invallen (een gesloten oplegger voor een schuifzeilrit en andersom); koel,
// vries, silo en LZV alleen met dezelfde soort
const PAST = { droog: ['droog', 'huif', 'city'], huif: ['huif', 'droog'], city: ['city', 'droog'], drank: ['drank', 'huif'] };
export const pastOp = (type, wens) => !wens || type === wens || (PAST[wens] || []).includes(type);
export const opleggerNaam = w => (TRT[w] ? TRT[w].n.toLowerCase().replace('lzv', 'LZV') : 'oplegger');
// dockblokken (laden aan het dock, wachten op een dock, retouren) zijn geen vrije tijd op het terrein
const vrijTerrein = s => s.k === 'terrein' && !s.dockSoort && !s.wachtDock;

// ---------- route over echte wegen (zoals fleet.js: toegangsroute, graaf, toegangsroute) ----------
export function routeOver(seq) {
  const pts = [], cum = [], at = [];
  const push = p => { if (pts.length) { const d = kmBetween(pts[pts.length - 1], p); if (d < 0.0005) return; cum.push(cum[cum.length - 1] + d); } else cum.push(0); pts.push(p); };
  const back = p => { const a = toegangVan(p); if (a) for (let k = a.length - 1; k >= 0; k--) push(a[k]); else if (GN[p.node]) push(GN[p.node]); else push([p.lon, p.lat]); };
  back(seq[0]); at.push(0);
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (i > 1) back(a);
    for (const p of buildPath(shortestPath(a.node, b.node)).pts) push(p);
    const bb = toegangVan(b); if (bb) for (const p of bb) push(p); else push([b.lon, b.lat]);
    at.push(cum[cum.length - 1]);
  }
  return { pts, cum, nodeKm: at, total: cum[cum.length - 1] || 0 };
}

// ---------- plan bijhouden ----------
// diensten op volgorde van de dag zetten en s.d meenummeren
function herindex(t) {
  const first = d => { const s = t.plan.find(x => x.d === d.i); return s ? s.t0 : Infinity; };
  const order = t.diensten.map(d => [d, first(d)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const map = new Map(order.map((d, k) => [d.i, k]));
  for (const s of t.plan) if (s.d !== null && s.d !== undefined) s.d = map.has(s.d) ? map.get(s.d) : null;
  order.forEach((d, k) => { d.i = k; }); t.diensten = order;
}
function vernieuw(t) {
  // lege diensten weg, aaneensluitende wachttijd samenvoegen, laatste segment tot na middernacht
  const weg = t.diensten.filter(d => !t.plan.some(s => s.d === d.i && (s.route || s.k === 'koppel')));
  for (const d of weg) if (d.person && d.person.dienst && d.person.dienst.d === d) d.person.dienst = null;
  t.diensten = t.diensten.filter(d => !weg.includes(d));
  for (const s of t.plan) if (s.d !== null && s.d !== undefined && !t.diensten.some(d => d.i === s.d)) s.d = null;
  herindex(t);
  const P = []; for (const s of t.plan) { const p = P[P.length - 1]; if (p && p.k === 'terrein' && s.k === 'terrein' && p.d === s.d && Math.abs(p.t1 - s.t0) < EPS) p.t1 = s.t1; else if (s.t1 - s.t0 > EPS || s === t.plan[t.plan.length - 1]) P.push(s); }
  t.plan = P; const last = P[P.length - 1]; last.t1 = Math.max(1440, last.t0 + 1);
  for (const d of t.diensten) { const segs = t.plan.filter(x => x.d === d.i); d.t0 = segs[0].t0; d.t1 = segs[segs.length - 1].t1; d.rel0 = d.t0; d.start = absT(t, d.t0); d.end = absT(t, d.t1); d.t = t; d.rustTot = d.end + 660; d.rij = Math.round(segs.reduce((a, x) => a + (x.k === 'drive' ? x.t1 - x.t0 : 0), 0)); }
  t.shiftStart = t.dayStart; t.shiftEnd = t.diensten.length ? t.diensten[t.diensten.length - 1].t1 : 0;
  t.routes = t.diensten.flatMap(d => d.routes || []); t.driver = t.diensten.length ? t.diensten[0].driver : '';
  if (t.diensten.length && t.vandaag !== 'onderhoud') t.vandaag = 'inzet';
  else if (!t.diensten.length && t.vandaag === 'inzet') t.vandaag = 'reserve';
}
// de dag van een voertuig eerder laten beginnen (een rit voor het begin van zijn dag)
function rebase(t, nieuw) {
  const dd = t.dayStart - nieuw; if (dd <= 0) return;
  for (const s of t.plan) { s.t0 += dd; s.t1 += dd; if (s.win) s.win = [s.win[0] + dd, s.win[1] + dd]; }
  t.plan.unshift({ k: 'terrein', t0: 0, t1: dd, d: null, tr: null });
  for (const d of t.diensten) { d.t0 = (d.t0 || 0) + dd; d.t1 = (d.t1 || 0) + dd; d.rel0 = d.t0; }
  t.dayStart = nieuw;
}
// segmenten [rel0, rel1) in het plan zetten op de plaats van wachttijd; geeft false als daar iets anders staat
function zetIn(t, segs, rel0) {
  const P = t.plan; const len = segs[segs.length - 1].t1 - segs[0].t0; const rel1 = rel0 + len; const shift = rel0 - segs[0].t0;
  const k0 = P.findIndex(s => s.t0 <= rel0 + EPS && rel0 < s.t1 - EPS); let k1 = P.findIndex(s => s.t0 < rel1 - EPS && rel1 <= s.t1 + EPS);
  if (k0 < 0) return false; if (k1 < 0) k1 = P.length - 1;
  for (let k = k0; k <= k1; k++) if (!(vrijTerrein(P[k]) || (P[k].k === 'laden' && !P[k].route))) return false;
  const pre = P[k0].t0 < rel0 - EPS ? { ...P[k0], t1: rel0 } : null; const post = rel1 < P[k1].t1 - EPS ? { ...P[k1], t0: rel1 } : null;
  for (const s of segs) { s.t0 += shift; s.t1 += shift; }
  t.plan = [...P.slice(0, k0), ...(pre ? [pre] : []), ...segs, ...(post ? [post] : []), ...P.slice(k1 + 1)];
  if (rel1 > t.plan[t.plan.length - 1].t1 - EPS) { const last = t.plan[t.plan.length - 1]; last.t1 = Math.max(1440, rel1 + 1); }
  return true;
}
// een vrije chauffeur van de standplaats (niet op dienst vandaag), voor een nieuwe dienst
export function vrijeChauffeur(people, t, al = new Set()) {
  // 4.1: volgens het rooster (people.js)
  if (people.vrijVoor) return people.vrijVoor(t, al);
  const bus = t.kind === 'bus';
  return people.persons.find(p => p.base === t.base && !p.dienst && !al.has(p) && (bus ? p.role === 'Bezorger B' : p.role !== 'Bezorger B')) || null;
}
// de dienst van t waar een blok [a, b] (relatief) bij hoort: binnen of tot 2 uur naast een bestaande dienst
function dienstBij(t, a, b) {
  let best = null, bd = Infinity;
  for (const d of t.diensten) { const segs = t.plan.filter(s => s.d === d.i); if (!segs.length) continue; const x0 = segs[0].t0, x1 = segs[segs.length - 1].t1; const gap = a >= x1 ? a - x1 : b <= x0 ? x0 - b : 0; if (gap <= 120 && gap < bd) { bd = gap; best = d; } }
  return best;
}
// wachttijd tussen de dienst en het nieuwe blok hoort bij de dienst (de chauffeur wacht op het terrein)
function dienstAaneen(t, d) {
  const idx = t.plan.map((s, k) => (s.d === d.i ? k : -1)).filter(k => k >= 0); if (idx.length < 2) return;
  for (let k = idx[0]; k <= idx[idx.length - 1]; k++) if (t.plan[k].k === 'terrein' && (t.plan[k].d === null || t.plan[k].d === undefined)) t.plan[k].d = d.i;
}

// ---------- een rit verplaatsen (ander voertuig en/of andere tijd) ----------
// r: een rit uit ritten.js; B: het doelvoertuig; startAbs: nieuwe begintijd (minuten van de dag, het begin van de rit,
// inclusief koppelen). Geeft { ok, tekst, chauffeur } en zet het plan van beide voertuigen bij.
export function verplaatsRit(ctx, r, B, startAbs) {
  const { fleet, people } = ctx;
  if (fleet.verplaatsRit) return fleet.verplaatsRit(r, B, startAbs);
  const A = r.t; const P = A.plan; const i0 = r.i0, i1 = r.i1; const baseA = A.dayStart, baseB0 = B.dayStart, planB0 = B.plan;
  if (!P[i0] || !P[i1]) return { ok: false, tekst: 'De rit is intussen gewijzigd; probeer het opnieuw.' };
  // kopieën met absolute tijden (vensters blijven op de klok staan, de rit schuift delta minuten)
  const span0 = baseA + P[i0].t0, span1 = baseA + P[i1].t1; const delta = startAbs - span0;
  const segs = P.slice(i0, i1 + 1).map(s => ({ ...s, t0: baseA + s.t0 + delta, t1: baseA + s.t1 + delta, win: s.win ? [baseA + s.win[0], baseA + s.win[1]] : s.win, d: null }));
  const di = P[i0].d; const dObj = di !== null && di !== undefined ? A.diensten[di] : null;
  const rest = P.some((s, k) => (k < i0 || k > i1) && s.d === di && s.route);
  // 1. uit A: wachttijd op de plaats van de rit
  A.plan = [...P.slice(0, i0), { k: 'terrein', t0: P[i0].t0, t1: P[i1].t1, d: rest ? di : null, tr: null }, ...P.slice(i1 + 1)];
  if (dObj && rest) dObj.routes = (dObj.routes || []).filter(x => !r.routes.includes(x));
  // 2. in B: naar de dagbasis van B (een leeg voertuig begint zijn dag een half uur voor de rit)
  if (!B.plan.some(s => s.route || s.k === 'koppel')) { B.dayStart = Math.max(0, startAbs - 30); B.plan = [{ k: 'terrein', t0: 0, t1: 1440, d: null, tr: null }]; }
  if (startAbs - B.dayStart < 0) rebase(B, Math.max(0, startAbs - 30));
  for (const s of segs) { s.t0 -= B.dayStart; s.t1 -= B.dayStart; if (s.win) s.win = [s.win[0] - B.dayStart, s.win[1] - B.dayStart]; }
  const rel0 = segs[0].t0;
  if (!zetIn(B, segs, rel0)) { // terugdraaien: beide voertuigen weer zoals ze waren
    A.plan = P; A.dayStart = baseA; if (B !== A) { B.plan = planB0; B.dayStart = baseB0; } if (dObj && rest) dObj.routes = [...(dObj.routes || []), ...r.routes];
    return { ok: false, tekst: `${B.id} heeft op dat moment al werk.` };
  }
  // 3. dienst en chauffeur
  let chauffeur = '';
  if (dObj && !rest) {
    // de hele dienst gaat mee, met de chauffeur
    A.diensten = A.diensten.filter(x => x !== dObj); for (const s of A.plan) if (s.d === di) s.d = null; herindex(A);
    dObj.i = B.diensten.length; for (const s of segs) s.d = dObj.i; B.diensten.push(dObj); dObj.t = B; chauffeur = dObj.driver;
    if (dObj.person) dObj.person.dienst = { t: B, d: dObj };
  } else {
    let X = dienstBij(B, segs[0].t0, segs[segs.length - 1].t1);
    if (!X) {
      const p = vrijeChauffeur(people, B); X = { i: B.diensten.length, start: absT(B, rel0), driver: p ? p.name : 'reservechauffeur', person: p, routes: [], delayLeg: -1, rel0, t: B };
      B.diensten.push(X); if (p) p.dienst = { t: B, d: X };
    }
    for (const s of segs) s.d = X.i; X.routes = [...(X.routes || []), ...r.routes]; chauffeur = X.driver; dienstAaneen(B, X);
  }
  // 4. opleggers: wie trekt ze, en de tijden schuiven mee
  for (const tr of fleet.trailers) for (const e of tr.events) {
    if (e.by !== A || e.a < span0 - 1 || e.a > span1 + 1) continue;
    e.by = B; if (e.vehicle === A) e.vehicle = B;
    if (delta) { e.a += delta; if (e.b !== Infinity) e.b += delta; if (e.unloadAt !== undefined) e.unloadAt += delta; if (e.pickup !== undefined) e.pickup += delta; }
  }
  for (const tr of fleet.trailers) tr.events.sort((x, y) => x.a - y.a);
  vernieuw(A); if (B !== A) vernieuw(B);
  kiesDock(ctx, B, segs);
  return { ok: true, tekst: '', chauffeur };
}

// ---------- docks ----------
// een vrij dock voor elk dockblok van een verplaatste of nieuwe rit (liefst het dock dat er al stond), en het dock op de
// rit ernaar of ervandaan, zodat het hal-scherm en de gebeurtenissen kloppen
function kiesDock(ctx, B, segs) {
  const sp = B.base; if (!sp || !sp.docks) return; const D = docksVan(ctx, sp);
  for (const x of segs) {
    if (!x.dockSoort) continue; const a = absT(B, x.t0), b = absT(B, x.t1);
    const vrij = D.plan.filter(row => !row.blokken.some(k => k.voertuig !== B.id && k.t0 < b + 2 && k.t1 > a - 2)).map(row => row.dock);
    x.dock = vrij.includes(x.dock) ? x.dock : vrij[0] || x.dock || 1;
  }
  const P = B.plan;
  for (let i = 0; i < P.length; i++) {
    const x = P[i]; if (!x.dockSoort || !segs.includes(x)) continue;
    if (x.dockSoort === 'aankomst') { for (let j = i - 1; j >= 0; j--) if (P[j].k === 'drive') { P[j].dock = x.dock; break; } }
    else for (let j = i + 1; j < P.length && !P[j].dockSoort; j++) if (P[j].k === 'drive') { P[j].dock = x.dock; break; }
  }
}

// ---------- een rit uit de pool inplannen ----------
const DWELL = { winkel: 35, netwerk: 55, bulk: 60, dranken: 40, bezorg: 80 };
export const plekVan = s => { if (!s) return null; if (s.node !== undefined) return s; const p = s.place || s.plek; if (p && p.node !== undefined) return p; const id = s.id || s; return winkelById.get(id) || dcById.get(id) || (typeof id === 'string' && id.startsWith('sp:') ? SP.find(x => x.n === id.slice(3)) : null); };
export function poolRoute(base, item) {
  const stops = (item.stops || []).map(plekVan).filter(Boolean);
  const seq = [base, ...stops, base]; const path = routeOver(seq);
  return { seq, path, marks: seq.map((p, i) => ({ place: p, km: path.nodeKm[i], name: i === 0 || i === seq.length - 1 ? base.n : plekNaam(p) })), total: path.total, pool: item.id };
}
// segmenten van een poolrit (relatief aan rel0), met oplegger als het een trekker is
function poolSegs(B, item, route, rel0, tr) {
  const segs = []; let tm = rel0;
  if (tr) { segs.push({ k: 'koppel', t0: tm, t1: tm + 10, d: null, tr, dockSoort: 'vertrek', ev: { k: 'koppel', tr } }); tm += 10; }
  else { segs.push({ k: 'terrein', t0: tm, t1: tm + NORM.dockLaden, d: null, tr: null, dockSoort: 'laden' }); tm += NORM.dockLaden; }
  const legs = route.marks.length - 1;
  for (let i = 0; i < legs; i++) {
    const km0 = route.marks[i].km, km1 = route.marks[i + 1].km; const dur = Math.max(4, (km1 - km0) / B.speed * 60);
    const last = i === legs - 1;
    segs.push({ k: 'drive', t0: tm, t1: tm + dur, km0, km1, delay: 0, route, idx: i + 1, win: null, d: null, tr: tr || null, range: route.path, ingevoegd: true });
    tm += dur;
    if (!last) { const dwell = DWELL[item.div] || 40; segs.push({ k: 'stop', t0: tm, t1: tm + dwell, km0: km1, km1, stop: route.marks[i + 1].name, route, idx: i + 1, d: null, tr: tr || null, swap: null, place: route.marks[i + 1].place, ingevoegd: true }); tm += dwell; }
  }
  if (tr) { segs.push({ k: 'ontkoppel', t0: tm, t1: tm + 8, d: null, tr, dockSoort: 'aankomst', ev: { k: 'ontkoppel', tr } }); tm += 8; }
  return segs;
}
export function vrijeOplegger(ctx, base, soort, a, b) {
  const L = ctx.fleet.trailersOf(base).filter(tr => !tr.onderhoud && !tr.storing && pastOp(tr.type, soort)).sort((x, y) => (x.type === soort ? 0 : 1) - (y.type === soort ? 0 : 1));
  return L.find(tr => { const s = ctx.fleet.trailerStateAt(tr, a); if (!(s.st === 'klaar' || s.st === 'leeg')) return false; return !tr.events.some(e => e.a < b && e.b > a && (e.k === 'coupled' || !(e.place && e.place.yard))); }) || null;
}
// opts.chauffeur: { id, naam, soort } voor wie de rit uit Open ritten krijgt (eigen chauffeur, oproepkracht, zzp'er); die rijdt
// een eigen dienst op het voertuig. opts.person: de persoon uit people.js bij een eigen chauffeur (zijn eigen dienst blijft).
export function planPoolRit(ctx, item, B, startAbs, opts = {}) {
  const { fleet, people } = ctx;
  if (fleet.planPoolRit && !opts.chauffeur) return fleet.planPoolRit(item, B, startAbs);
  const base = B.base; const route = item._route && item._route.seq[0] === base ? item._route : poolRoute(base, item); item._route = route;
  if (!B.diensten.length && !B.plan.some(s => s.route)) { B.dayStart = Math.max(0, startAbs - 30); B.plan = [{ k: 'terrein', t0: 0, t1: 1440, d: null, tr: null }]; }
  if (startAbs - B.dayStart < 0) rebase(B, Math.max(0, startAbs - 30));
  const rel0 = startAbs - B.dayStart;
  const tr = B.kind === 'trekker' ? vrijeOplegger(ctx, base, item.oplegger, startAbs, startAbs + (item.duur || 300)) : null;
  const segs = poolSegs(B, item, route, rel0, tr);
  if (!zetIn(B, segs, rel0)) return { ok: false, tekst: `${B.id} heeft op dat moment al werk.` };
  let X = opts.chauffeur ? null : dienstBij(B, segs[0].t0, segs[segs.length - 1].t1);
  if (!X && opts.chauffeur) { X = { i: B.diensten.length, start: startAbs, driver: opts.chauffeur.naam, person: opts.person || null, flex: { id: opts.chauffeur.id, soort: opts.chauffeur.soort || 'oproep' }, routes: [], delayLeg: -1, rel0, t: B }; B.diensten.push(X); }
  if (!X) { const p = vrijeChauffeur(people, B); X = { i: B.diensten.length, start: startAbs, driver: p ? p.name : 'reservechauffeur', person: p, routes: [], delayLeg: -1, rel0, t: B }; B.diensten.push(X); if (p) p.dienst = { t: B, d: X }; }
  for (const s of segs) s.d = X.i; X.routes = [...(X.routes || []), route]; dienstAaneen(B, X);
  if (tr) { const a = absT(B, segs[0].t0), b = absT(B, segs[segs.length - 1].t1); tr.events.push({ k: 'coupled', a, b, vehicle: B, loaded: true, lading: item.lading || `${item.klant || 'lading'}, ${(item.stops || []).length} stops`, by: B, planned: true }); tr.events.sort((x, y) => x.a - y.a); }
  vernieuw(B); kiesDock(ctx, B, segs);
  item.gepland = { t: B.id, start: startAbs };
  return { ok: true, tekst: '', chauffeur: X.driver, oplegger: tr ? tr.id : null };
}
// een ingeplande poolrit weer van het voertuig halen (de oproepkracht of de charter kan toch niet): de segmenten worden
// wachttijd, een lege dienst verdwijnt (en de chauffeur is weer vrij), de geplande koppeling van de oplegger vervalt
export function haalPoolRitTerug(ctx, item) {
  const g = item.gepland; if (!g) return { ok: false, tekst: 'Deze rit staat al bij de open ritten.' };
  const B = g.t ? ctx.fleet.byId.get(g.t) : null; const route = item._route;
  if (!B || !route) { item.gepland = null; return { ok: true, tekst: '' }; }
  const P = B.plan; const idx = []; P.forEach((s, k) => { if (s.route === route) idx.push(k); });
  if (!idx.length) { item.gepland = null; return { ok: true, tekst: '' }; }
  let k0 = idx[0], k1 = idx[idx.length - 1];
  if (k0 > 0 && (P[k0 - 1].k === 'koppel' || (P[k0 - 1].k === 'terrein' && P[k0 - 1].dockSoort === 'laden'))) k0--;
  if (k1 < P.length - 1 && P[k1 + 1].k === 'ontkoppel') k1++;
  const di = P[k0].d; const d = di !== null && di !== undefined ? B.diensten.find(x => x.i === di) : null;
  const rest = d ? P.some((s, k) => (k < k0 || k > k1) && s.d === di && s.route) : false;
  const a = absT(B, P[k0].t0);
  B.plan = [...P.slice(0, k0), { k: 'terrein', t0: P[k0].t0, t1: P[k1].t1, d: rest ? di : null, tr: null }, ...P.slice(k1 + 1)];
  if (d) d.routes = (d.routes || []).filter(x => x !== route);
  for (const tr of ctx.fleet.trailers) if (tr.events.some(e => e.planned && e.by === B && Math.abs(e.a - a) < 1)) tr.events = tr.events.filter(e => !(e.planned && e.by === B && Math.abs(e.a - a) < 1));
  vernieuw(B);
  item.gepland = null;
  return { ok: true, tekst: '' };
}

// ---------- invoer voor de toetsregels ----------
const segsVan = r => r.segs.map(x => x.s);
export function ritInvoer(r) {
  const T0 = r.t.dayStart; const P = r.t.plan; const segs = P.slice(r.i0, r.i1 + 1);
  const tr = r.tr || null;
  return {
    id: r.id, t0: T0 + segs[0].t0, t1: T0 + segs[segs.length - 1].t1, km: r.km, standplaats: r.base.n, soort: r.t.kind,
    oplegger: tr ? tr.type : null, opleggerNaam: tr ? opleggerNaam(tr.type) : null,
    rijden: segs.filter(s => s.k === 'drive').map(s => ({ t0: T0 + s.t0, t1: T0 + s.t1 })),
    pauzes: segs.filter(s => s.k === 'pauze').map(s => ({ t0: T0 + s.t0, t1: T0 + s.t1 })),
    stops: r.stops.filter(x => !x.pickup).map(x => ({ naam: x.name, aankomst: x.arr, venster: x.win })),
  };
}
// het laadvenster van een poolrit in minuten van vandaag (een rit van morgen ligt 1440 minuten later)
export const vensterAbs = item => !item.venster ? null : item.dag === 'morgen' ? [item.venster[0] + 1440, item.venster[1] + 1440] : item.venster;
// een poolrit als invoer: vertrek in het laadvenster op de standplaats, rijtijden langs de route
export function poolInvoer(item, base, voertuig) {
  const route = item._route && item._route.seq[0] === base ? item._route : poolRoute(base, item); item._route = route;
  const soort = item.soort || (item.div === 'bezorg' ? 'bus' : voertuig ? voertuig.kind : 'trekker'); const trekker = soort === 'trekker';
  const speed = voertuig ? voertuig.speed : 78; const v = vensterAbs(item); const start = v ? v[0] : 480;
  let tm = start + (trekker ? 10 : NORM.dockLaden); const rijden = [], stops = [{ naam: `Laden op ${base.n}`, aankomst: start, venster: v, laden: true }];
  for (let i = 0; i < route.marks.length - 1; i++) {
    const dur = Math.max(4, (route.marks[i + 1].km - route.marks[i].km) / speed * 60); rijden.push({ t0: tm, t1: tm + dur }); tm += dur;
    if (i < route.marks.length - 2) { stops.push({ naam: route.marks[i + 1].name, aankomst: tm, venster: null }); tm += DWELL[item.div] || 40; }
  }
  if (trekker) tm += 8;
  return { id: item.id, t0: start, t1: tm, km: route.total, standplaats: base.n, soort, oplegger: item.oplegger || null, opleggerNaam: item.oplegger ? opleggerNaam(item.oplegger) : null, rijden, pauzes: [], stops, laadVenster: v };
}
export const voertuigInvoer = t => ({ id: t.id, soort: t.kind, ev: t.ev, accuKwh: CAPACITY(t) || (t.ev ? Math.round(t.range * NORM.kwhPerKm) : 0), standplaats: t.base.n, speed: t.speed });
// wat het voertuig al heeft (zonder de rit zelf): ritten als blokken, werkplaats als een blok over de hele dag
export function planInvoer(ctx, t, zonder) {
  if (t.vandaag === 'onderhoud') return [{ id: 'werkplaats', naam: 'werkplaats', t0: 0, t1: 2880 }];
  return ctx.R.ofTruck(t).filter(x => x !== zonder).map(x => { const P = t.plan; return { id: x.id, naam: `rit ${x.id}`, t0: absT(t, P[x.i0].t0), t1: absT(t, P[x.i1].t1) }; });
}
// de dienst van t waar een blok [a, b] (absoluut) in zou komen, zonder de rit zelf
export function dienstInvoer(t, a, b, zonder) {
  const d = dienstBij(t, a - t.dayStart, b - t.dayStart); if (!d) return null;
  const segs = t.plan.filter((s, k) => s.d === d.i && !(zonder && zonder.t === t && k >= zonder.i0 && k <= zonder.i1));
  if (!segs.some(s => s.route)) return null;
  return { bestuurder: d.driver, maxRij: d.maxRij || null, t0: absT(t, segs[0].t0), t1: absT(t, segs[segs.length - 1].t1),
    rijden: segs.filter(s => s.k === 'drive').map(s => ({ t0: absT(t, s.t0), t1: absT(t, s.t1) })),
    pauzes: segs.filter(s => s.k === 'pauze' || s.k === 'laden' || s.k === 'terrein').map(s => ({ t0: absT(t, s.t0), t1: absT(t, s.t1) })) };
}
const leegCache = new Map();
export function leegKm(ctx, van, naar) {
  if (van === naar) return 0; const k = `${van.n}|${naar.n}`; if (leegCache.has(k)) return leegCache.get(k);
  let km = null; try { const x = ctx.fleet.routeBetween(`sp:${van.n}`, `sp:${naar.n}`); km = x ? x.km : null; } catch { km = null; }
  if (km === null) km = kmBetween([van.lon, van.lat], [naar.lon, naar.lat]) * 1.3; leegCache.set(k, km); return km;
}
// docks: uit fleet.dockPlan als die er is, anders laden in de 40 minuten voor elk vertrek op een vast dock
export const dockVan = (fleet, t) => { const s = t.plan.find(x => x.dockSoort && x.dock); return s ? s.dock : ((t.slot || 0) % Math.max(1, t.base.docks || 8)) + 1; };
export function docksVan(ctx, sp) {
  const n = sp.docks || 8;
  if (ctx.fleet.dockPlan) { try { const D = ctx.fleet.dockPlan(sp.n); if (Array.isArray(D)) return { n: Math.max(n, D.length), plan: D }; } catch { /* terugval */ } }
  const plan = []; for (let i = 1; i <= n; i++) plan.push({ dock: i, blokken: [] });
  for (const d of ctx.fleet.departures(sp, 0, 1440)) { const nr = Math.min(n, d.dock || dockVan(ctx.fleet, d.t)); const e = plan[nr - 1]; if (e) e.blokken.push({ t0: d.at - NORM.dockLaden, t1: d.at, voertuig: d.t.id, rit: null, soort: 'laden' }); }
  return { n, plan };
}
export function context(ctx, t, rit, startAbs, zonder) {
  const c = {};
  if (t.ev) { try { c.socBijVertrek = ctx.fleet.stateAt(t, startAbs).soc; } catch { c.socBijVertrek = 100; } }
  const base = SP.find(s => s.n === rit.standplaats) || t.base; c.leegKm = leegKm(ctx, t.base, base);
  if (rit.oplegger && t.kind === 'trekker') { const tr = vrijeOplegger(ctx, base, rit.oplegger, startAbs, startAbs + (rit.t1 - rit.t0)); c.opleggersVrij = { [rit.oplegger]: tr || (zonder && zonder.tr) ? 1 : 0 }; }
  // het dock vlak voor vertrek: koppelen (trekker, 10 min) of laden (bakwagen en bus, 40 min); de blokken van de rit zelf
  // en van het voertuig tellen niet
  const D = docksVan(ctx, base); const nr = dockVan(ctx.fleet, t); const duur = t.kind === 'trekker' ? 10 : NORM.dockLaden;
  const s0 = startAbs, a0 = s0 - duur; const zNr = zonder ? zonder.t.routes.indexOf(zonder.routes[0]) + 1 : 0;
  const telt = b => b.voertuig !== t.id && !(zonder && b.voertuig === zonder.t.id && b.rit === zNr);
  const mine = D.plan.find(x => x.dock === nr) || D.plan[0];
  if (mine) c.dock = { nr: mine.dock, duur, bezet: mine.blokken.filter(telt), vrij: D.plan.filter(x => x !== mine && !x.blokken.some(b => telt(b) && b.t0 < s0 && b.t1 > a0)).map(x => x.dock) };
  const dienst = dienstInvoer(t, startAbs, startAbs + (rit.t1 - rit.t0), zonder);
  c.volgendeDienst = dienst ? dienst.t0 : startAbs;
  // 4.1: de week en het rooster van de chauffeur (people.toetsInvoer: tellers.js en rooster.js)
  if (ctx.people && ctx.people.toetsInvoer) Object.assign(c, ctx.people.toetsInvoer(t, dienst, startAbs, zonder, ctx.ui ? ctx.ui.roosterAfwijking : null));
  return { c, dienst };
}
export function toetsVoor(ctx, t, rit, startAbs, zonder) {
  const { c, dienst } = context(ctx, t, rit, startAbs, zonder);
  const u = toets({ voertuig: voertuigInvoer(t), plan: planInvoer(ctx, t, zonder), dienst, rit, start: startAbs, context: c });
  // past de rit nog in de dag van het voertuig (het plan loopt tot middernacht na de start van de dag)
  const eind = startAbs + (rit.t1 - rit.t0); const dagEind = (t.diensten.length ? t.dayStart : Math.max(0, startAbs - 30)) + 1440;
  if (eind > dagEind + 0.5) { u.regels.push({ regel: 'dag', ernst: 'fout', tekst: `De rit loopt tot na het einde van de dag van ${t.id}.` }); u.ok = false; }
  return u;
}
// "Waar past deze rit?": de voertuigen van de standplaats (zelfde soort), elk met de uitslag van de toets
export function kandidaten(ctx, rit, opts = {}) {
  const base = SP.find(s => s.n === rit.standplaats); const zonder = opts.zonder || null; const start = opts.start === undefined ? rit.t0 : opts.start;
  const L = ctx.fleet.trucks.filter(t => (t.base === base || (opts.ruim && t.base.regio === base.regio)) && t.kind === rit.soort && (!zonder || t !== zonder.t) && t.vandaag !== 'onderhoud' && !t.storing);
  const vergeven = new Set();
  const starts = [start]; if (rit.laadVenster && opts.start === undefined) for (let x = rit.laadVenster[0] + 15; x <= rit.laadVenster[1]; x += 15) starts.push(x);
  const K = L.map(t => {
    let uitslag = null, best = starts[0];
    for (const x of starts) { const u = toetsVoor(ctx, t, rit, x, zonder); if (!uitslag || (u.ok && !uitslag.ok)) { uitslag = u; best = x; } if (u.ok) break; }
    const d = dienstInvoer(t, best, best + (rit.t1 - rit.t0), zonder);
    // wie rijdt: de chauffeur van de dienst waar de rit in valt, of een vrije chauffeur in een nieuwe dienst
    let wie = d ? d.bestuurder : ''; const nieuw = !d;
    if (nieuw) { const p = vrijeChauffeur(ctx.people, t, vergeven); wie = p ? p.name : ''; if (p) vergeven.add(p); }
    uitslag.effect.nieuweDienst = nieuw;
    return { t, start: best, uitslag, wie, nieuw };
  });
  // gelijke uitslag: liever in een bestaande dienst (geen extra chauffeur) dan een nieuwe dienst
  return rangschik(K).sort((a, b) => (b.uitslag.ok - a.uitslag.ok) || (a.uitslag.effect.teLaatMin - b.uitslag.effect.teLaatMin) || (a.uitslag.effect.extraKm - b.uitslag.effect.extraKm) || (a.nieuw - b.nieuw)).slice(0, opts.max || 8);
}
export { segsVan, koelType, NORM };

// ---------- pool ----------
// fleet.pool (data) als die er is; anders een kleine, vaste pool per standplaats: extra ritten van de klant voor
// vanmiddag en morgen, 2 tot 5 procent van de ritten (schatting uit het onderzoek).
let fallback = null;
// de pool zoals de planner hem nu ziet: wat al bekend is en nog niet voorbij (fleet.poolAt), zonder wat al is ingepland
export function poolNu(ctx) { const T = ctx.state.simTime; const zonder = pool(ctx).filter(p => p.gepland).map(p => p.id); const L = typeof ctx.fleet.poolAt === 'function' ? ctx.fleet.poolAt(T, zonder) : pool(ctx); return L.filter(p => !p.gepland); }
export function pool(ctx) {
  if (Array.isArray(ctx.fleet.pool)) return ctx.fleet.pool;
  if (fallback) return fallback;
  let seed = 4242; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const REDEN = ['Extra bestelling van de klant', 'Rit van een uitgevallen voertuig', 'Spoedlevering na een tekort in de winkel', 'Nieuwe rit van de klant, nog zonder voertuig'];
  fallback = [];
  for (const sp of SP) {
    const n = ctx.fleet.trucks.filter(t => t.base === sp).length; const k = Math.max(2, Math.round(n * 0.03)); const winkel = sp.div.includes('winkel');
    const f = new Set(sp.formules && sp.formules.length ? sp.formules : ['Albert Heijn']);
    const near = winkel ? WINKELS.filter(w => f.has(w.formule) && !w.eiland && kmBetween([sp.lon, sp.lat], [w.lon, w.lat]) < 45) : DCS.filter(d => d.sp !== sp.n && kmBetween([sp.lon, sp.lat], [d.lon, d.lat]) < 120);
    if (!near.length) continue;
    for (let i = 0; i < k; i++) {
      const a = near[Math.floor(rnd() * near.length)]; const b = winkel && rnd() < 0.5 ? near[Math.floor(rnd() * near.length)] : null;
      const morgen = rnd() < 0.35; const w0 = morgen ? 300 + Math.floor(rnd() * 8) * 30 : 780 + Math.floor(rnd() * 14) * 30;
      const div = winkel ? 'winkel' : sp.div[0];
      fallback.push({ id: `P-${sp.n.slice(0, 3).toUpperCase()}-${i + 1}`, sp: sp.n, div, klant: (a.formule || sp.klant), stops: [a, b].filter((x, j, arr) => x && arr.indexOf(x) === j),
        venster: [w0, w0 + 30], duur: null, km: null, oplegger: div === 'winkel' ? (rnd() < 0.45 ? 'koel' : 'droog') : div === 'bezorg' ? null : 'droog', dag: morgen ? 'morgen' : 'vandaag', reden: REDEN[Math.floor(rnd() * REDEN.length)], schatting: true });
    }
  }
  return fallback;
}
