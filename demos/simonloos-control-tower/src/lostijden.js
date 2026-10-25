// Lostijden leren per klant: per winkel of losadres de geplande lostijd naast de gemeten lostijd per dagdeel
// (gesimuleerd uit de boordcomputerdata), met een voorstel dat de planner kan overnemen voor de planning van morgen.
// Een stop in het plan is wachten plus lossen (s.wacht en s.los); de lostijd hier is alleen het lossen, de wachttijd
// staat ernaast (gemiddeld en het 90e percentiel). Drop en swap (oplegger wisselen) en ophalen tellen niet mee.
const KLANT = [['AH', 'Albert Heijn'], ['Albert Heijn', 'Albert Heijn'], ['Jumbo', 'Jumbo'], ['Plus', 'Plus'], ['Lidl', 'Lidl'], ['SPAR', 'SPAR'], ['Vomar', 'Vomar'], ['Bezorgronde', 'Bezorgronde'], ['Crossdock', 'Crossdock'], ['DC', 'DC'], ['Klant', 'Klant'], ['Fabriek', 'Fabriek'], ['Silo', 'Silo'], ['Horeca-depot', 'Horeca'], ['Groothandel', 'Groothandel'], ['Supermarkt-DC', 'Supermarkt-DC']];
const klantOf = n => { for (const [p, k] of KLANT) if (n.startsWith(p + ' ')) return k; return n.split(' ')[0]; };
export function createLostijden(fleet, store) {
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
  const map = new Map();
  for (const t of fleet.trucks) for (const s of t.plan) if (s.k === 'stop' && s.actie !== 'wisselen' && !s.pickup && !s.swap) {
    const at = (((t.dayStart + s.t0 + (s.wacht || 0)) % 1440) + 1440) % 1440; const dd = at < 660 ? 'ochtend' : at < 1020 ? 'middag' : 'avond';
    let e = map.get(s.stop); if (!e) { e = { name: s.stop, klant: klantOf(s.stop), div: t.div, n: 0, planned: 0, parts: { ochtend: 0, middag: 0, avond: 0 }, trucks: new Set(), base: t.base, w: [] }; map.set(s.stop, e); }
    e.n++; e.planned += s.los !== undefined && s.los !== null ? s.los : s.t1 - s.t0 - (s.wacht || 0); e.parts[dd]++; e.trucks.add(t.id); e.w.push(s.wacht || 0);
  }
  let applied = new Set(); try { applied = new Set(JSON.parse(store.get('sl-lostijden') || '[]')); } catch { applied = new Set(); }
  const stops = [...map.values()].map(e => {
    const h = hash(e.name); e.planned = e.planned / e.n;
    const f = { ochtend: 0.78 + h * 0.3, middag: 0.85 + hash(e.name + 'm') * 0.4, avond: 0.72 + hash(e.name + 'a') * 0.3 };
    e.measured = { ochtend: e.planned * f.ochtend, middag: e.planned * f.middag, avond: e.planned * f.avond };
    const ws = e.w.slice().sort((a, b) => a - b); e.wacht = ws.reduce((a, b) => a + b, 0) / (ws.length || 1); e.wachtP90 = ws.length ? ws[Math.min(ws.length - 1, Math.ceil(0.9 * ws.length) - 1)] : 0;
    const w = e.parts, tot = w.ochtend + w.middag + w.avond || 1;
    e.avg = (e.measured.ochtend * w.ochtend + e.measured.middag * w.middag + e.measured.avond * w.avond) / tot; e.diff = e.avg - e.planned; e.samples = 20 + Math.floor(h * 180);
    return e;
  }).sort((a, b) => Math.abs(b.diff) * b.n - Math.abs(a.diff) * a.n);
  const save = () => store.set('sl-lostijden', JSON.stringify([...applied]));
  const isApplied = n => applied.has(n);
  const toggle = n => { if (applied.has(n)) applied.delete(n); else applied.add(n); save(); };
  const applyAll = list => { for (const e of list) applied.add(e.name); save(); };
  const reset = () => { applied.clear(); save(); };
  const effect = list => { let saved = 0, realistic = 0, stopsN = 0, winkels = 0; for (const e of list) { if (!applied.has(e.name)) continue; winkels++; stopsN += e.n; if (e.diff < 0) saved += -e.diff * e.n; else realistic += e.n; } return { saved: Math.round(saved), realistic, stopsN, winkels }; };
  return { stops, isApplied, toggle, applyAll, reset, effect, count: () => applied.size };
}
