// Kerngetallen door de dag heen: per tijdstip het aantal voertuigen per status, wat er laadt, de stops binnen het
// tijdvenster en de opleggers die wachten. Rekent rechtstreeks op de dagplannen (lichter dan fleet.stateAt) en bewaart
// de punten per half uur, zodat de sparklines en rapporten niet elke seconde alles opnieuw doorrekenen.
import { klantNaam, effWin } from './base.js';

export function createMetrics(ctx) {
  const { fleet } = ctx; let idx = null, idxVer = -1; const cache = new Map();
  function index() {
    const v = ctx.R.ver(); if (idx && idxVer === v) return idx; idx = new Map(); idxVer = v; cache.clear();
    for (const t of fleet.trucks) {
      const L = []; const P = t.plan;
      for (let i = 0; i < P.length; i++) {
        const s = P[i]; if (s.k !== 'stop') continue; const d = P[i - 1]; const mark = s.route && s.route.marks ? s.route.marks[s.idx] : null;
        // venster zoals de planner het ziet (effWin): een stop is te laat als hij na het einde daarvan aankomt; de geplande
        // aankomst is die zonder vertraging (gepland als een eerdere vertraging het plan opschoof, op de oefendag)
        const w = d && d.k === 'drive' && d.win ? effWin(d.win, d.gepland !== undefined ? d.gepland - t.dayStart : s.t0 - (d.delay || 0)) : null;
        L.push({ t0: s.t0, t1: s.t1, w1: w ? w[1] : null, klant: s.pickup ? null : klantNaam(s.stop, t, mark), sp: t.base.n });
      }
      idx.set(t, L);
    }
    return idx;
  }
  const relOf = (t, T) => (((T - t.dayStart) % 1440) + 1440) % 1440;
  function stAt(t, T) {
    const rel = relOf(t, T); const P = t.plan; let seg = P[P.length - 1];
    for (let i = 0; i < P.length; i++) { const s = P[i]; if (rel >= s.t0 && rel < s.t1) { seg = s; break; } }
    // Zoals fleet.stateAt.
    const achter = seg.delay > 0 || (seg.gepland !== undefined && t.dayStart + seg.t1 > seg.gepland + 0.5);
    const st = seg.k === 'drive' ? (achter && !t.delayResolved ? 'vertraagd' : 'onderweg') : seg.k === 'stop' ? 'klant' : seg.k === 'pauze' || (seg.k === 'laden' && seg.route) ? 'pauze' : 'terrein';
    return { st, laden: seg.k === 'laden' };
  }
  // stops van vandaag (sinds middernacht) tot T: aantal en hoeveel na het tijdvenster aankwamen; een stop telt mee zodra de
  // wagen er aankomt (dan is bekend of hij binnen het venster was, ook als het lossen nog duurt). Een stop na middernacht
  // van de vorige cyclus (nachtrit) hoort bij vandaag.
  const doneBy = (t, x, T) => { const a = t.dayStart + x.t0; return a <= T || (a >= 1440 && a - 1440 <= T); };
  function stopsTill(t, T) { let n = 0, late = 0; for (const x of index().get(t) || []) { if (x.klant === null || !doneBy(t, x, T)) continue; n++; if (x.w1 !== null && x.t0 > x.w1 + 0.5) late++; } return { n, late }; }
  function sample(T, trucks, trailers) {
    index(); const o = { onderweg: 0, vertraagd: 0, klant: 0, pauze: 0, terrein: 0, laden: 0, stops: 0, late: 0, wacht: 0, wachtLaat: 0 };
    for (const t of trucks) { const s = stAt(t, T); o[s.st]++; if (s.laden) o.laden++; const k = stopsTill(t, T); o.stops += k.n; o.late += k.late; }
    for (const tr of trailers) { const s = fleet.trailerStateAt(tr, T); if (s.st === 'wacht') { o.wacht++; if (s.late) o.wachtLaat++; } }
    o.actief = o.onderweg + o.vertraagd + o.klant + o.pauze; o.ontime = o.stops ? (1 - o.late / o.stops) * 100 : 100;
    return o;
  }
  // reeks per half uur tot en met nu (het laatste punt is altijd het actuele tijdstip)
  function series(T, scopeKey, trucks, trailers, n = 17, step = 30) {
    index(); const out = []; const b = Math.floor(T / step) * step;
    for (let k = n - 2; k >= 0; k--) { const Ts = b - k * step; if (Ts < 0 || Ts >= T) continue; const key = `${Ts}|${scopeKey}`; let s = cache.get(key); if (!s) { s = sample(Ts, trucks, trailers); cache.set(key, s); if (cache.size > 400) cache.delete(cache.keys().next().value); } out.push({ T: Ts, ...s }); }
    out.push({ T, ...sample(T, trucks, trailers) });
    return out;
  }
  // op tijd per groep (klant of standplaats) tot T
  function onTimeBy(T, trucks, groupOf) {
    index(); const m = new Map();
    for (const t of trucks) { for (const x of index().get(t) || []) { if (x.klant === null || !doneBy(t, x, T)) continue; const g = groupOf(t, x); let e = m.get(g); if (!e) { e = { n: 0, late: 0 }; m.set(g, e); } e.n++; if (x.w1 !== null && x.t0 > x.w1 + 0.5) e.late++; } }
    return m;
  }
  return { sample, series, onTimeBy, stAt, index };
}
