// Laden op goedkope stroom: dagprijzen (EPEX-achtig profiel), netaansluiting per standplaats en een planner die
// laadsessies in de goedkoopste kwartieren legt zonder de netlimiet te overschrijden. Vergeleken met direct laden.
import { CAPACITY } from './people.js';

const BASE = [78, 72, 68, 66, 67, 74, 92, 118, 124, 108, 84, 62, 48, 44, 52, 74, 112, 158, 172, 150, 118, 98, 88, 82]; // €/MWh per uur
export const NET = 0.09; // €/kWh netkosten en energiebelasting bovenop de dagprijs (grootverbruik, schatting)
export const CAP = sp => sp.hub ? 1200 : sp.wh ? 600 : 250; // kW netaansluiting (gesimuleerd)
export const KW = t => t.van ? 22 : 150;
export function priceCurve(day = 0) { let s = 1234 + day * 7; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; return BASE.map(v => Math.round(v * (0.92 + rnd() * 0.16))); }

export function planCharging(sp, trucks, prices) {
  const slot = 15; const price = m => prices[Math.floor((((m % 1440) + 1440) % 1440) / 60)]; const cap = CAP(sp); const sessions = [];
  for (const t of trucks) {
    if (!t.ev) continue;
    const wins = t.plan.filter(s => s.k === 'laden').map(s => [t.shiftStart + s.t0, t.shiftStart + s.t1]);
    wins.push([t.shiftStart + t.shiftEnd, t.shiftStart + 1440 - 20]);
    const dayKm = t.routes.reduce((a, x) => a + x.total, 0); const need = dayKm * (t.van ? 0.3 : 1.15); const tot = wins.reduce((a, w) => a + (w[1] - w[0]), 0) || 1;
    for (const w of wins) { const kWh = Math.min((CAPACITY(t) || 500) * 0.9, need * (w[1] - w[0]) / tot); if (kWh < 5 || w[1] - w[0] < slot) continue; sessions.push({ t, a: w[0], b: w[1], kWh, kW: KW(t), blocks: [], direct: [] }); }
  }
  const load = new Map(); const pairs = [];
  for (const s of sessions) for (let m = Math.ceil(s.a / slot) * slot; m + slot <= s.b; m += slot) pairs.push([price(m), m, s]);
  pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const left = new Map(sessions.map(s => [s, s.kWh]));
  for (const [p, m, s] of pairs) { const rem = left.get(s); if (rem <= 0) continue; const l = load.get(m) || 0; if (l + s.kW > cap) continue; const e = Math.min(rem, s.kW * slot / 60); left.set(s, rem - e); load.set(m, l + s.kW); s.blocks.push({ m, kWh: e, p }); }
  const loadD = new Map();
  for (const s of sessions) { let rem = s.kWh; for (let m = Math.ceil(s.a / slot) * slot; m + slot <= s.b && rem > 0; m += slot) { const e = Math.min(rem, s.kW * slot / 60); rem -= e; loadD.set(m, (loadD.get(m) || 0) + s.kW); s.direct.push({ m, kWh: e, p: price(m) }); } }
  const cost = bl => bl.reduce((a, b) => a + b.kWh * (b.p / 1000 + NET), 0);
  const merge = bl => { const out = []; for (const b of bl.slice().sort((x, y) => x.m - y.m)) { const last = out[out.length - 1]; if (last && last.m1 === b.m) { last.m1 = b.m + slot; last.kWh += b.kWh; } else out.push({ m0: b.m, m1: b.m + slot, kWh: b.kWh }); } return out; };
  for (const s of sessions) { s.costSlim = cost(s.blocks); s.costDirect = cost(s.direct); s.done = s.kWh - (left.get(s) || 0); s.segs = merge(s.blocks); s.segsD = merge(s.direct); }
  const peak = L => Math.max(0, ...L.values());
  return { sp, cap, prices, sessions, kWh: sessions.reduce((a, s) => a + s.done, 0), costSlim: sessions.reduce((a, s) => a + s.costSlim, 0), costDirect: sessions.reduce((a, s) => a + s.costDirect, 0), peakSlim: peak(load), peakDirect: peak(loadD), unmet: [...left.values()].reduce((a, v) => a + Math.max(0, v), 0), load };
}
