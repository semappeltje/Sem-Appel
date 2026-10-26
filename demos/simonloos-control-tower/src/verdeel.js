// Eén toewijzing over alle open ritten van een dag (Control Tower 4.0): elke rit zijn eigen beste kandidaat, niemand twee
// keer, een charter niet vaker dan hij trekkers vrij heeft. Puur en zonder imports, zodat tests/verdeel.test.mjs het in
// Node kan draaien.
//
// ritten: [{ id, volgorde (sorteersleutel voor de gretige variant: eerst wie het eerst dringend is), kandidaten:
//   [{ id, waarde, cap }] }]; waarde: hoe graag je deze kandidaat voor deze rit wilt (hoger is beter), cap: hoeveel ritten
//   deze kandidaat op deze dag kan rijden (een persoon 1, een charter zijn vrije trekkers).
// Geeft Map rit-id -> kandidaat-id (of null als er voor die rit niemand overblijft).
//
// Hongaars (Kuhn-Munkres met potentialen, O(n² m)): de som van de waarden over alle ritten zo groot mogelijk. Een kandidaat
// met cap k krijgt k kolommen. Gretig: de ritten op volgorde, elke rit de beste kandidaat die nog over is. De gretige
// variant is wat een planner uit zijn hoofd doet; de Hongaarse ziet dat de beste van rit A ook de enige goede van rit B is.
const INF = 1e18;
const NIET = -1e6;
// 4.1: de rij- en rusttijden over de week zijn een harde grens. Een kandidaat met rijMin (de rit) en ruimte (wat hij in de
// week en de twee weken nog mag rijden, tellers.js) telt niet mee als de rit niet meer past: hij krijgt geen kolom en geen rit.
export const pastNog = k => !(typeof k.ruimte === 'number' && typeof k.rijMin === 'number' && k.rijMin > k.ruimte + 0.5);
const echt = ritten => ritten.map(r => ({ ...r, kandidaten: r.kandidaten.filter(pastNog) }));

// toewijzing van n rijen aan m kolommen (n <= m), de som van W[i][j] zo groot mogelijk; -1 voor een rij zonder kolom
export function hongaars(W) {
  const n = W.length; if (!n) return [];
  const m = W[0].length; if (m < n) throw new Error('hongaars: meer rijen dan kolommen');
  const u = new Float64Array(n + 1), v = new Float64Array(m + 1); const p = new Int32Array(m + 1), way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = new Float64Array(m + 1).fill(INF); const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1; const i0 = p[j0]; let delta = INF, j1 = 0; const row = W[i0 - 1];
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = -row[j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const uit = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) uit[p[j] - 1] = j - 1;
  return uit;
}

// de kolommen: per kandidaat cap plekken (met de rit-waarden erbij), plus lege plekken zodat elke rit een kolom kan krijgen
function kolommen(ritten) {
  const cap = new Map();
  for (const r of ritten) for (const k of r.kandidaten) cap.set(k.id, Math.max(cap.get(k.id) || 0, Math.max(1, Math.floor(k.cap || 1))));
  const kol = []; for (const [id, c] of cap) for (let i = 0; i < c; i++) kol.push(id);
  return kol;
}

export function verdeelHongaars(alle) {
  const uit = new Map(); if (!alle.length) return uit; const ritten = echt(alle);
  const kol = kolommen(ritten); const extra = Math.max(0, ritten.length - kol.length);
  const m = kol.length + extra; const W = ritten.map(r => { const row = new Float64Array(m).fill(NIET); for (const k of r.kandidaten) for (let j = 0; j < kol.length; j++) if (kol[j] === k.id) row[j] = k.waarde; for (let j = kol.length; j < m; j++) row[j] = 0; return row; });
  const toe = hongaars(W);
  ritten.forEach((r, i) => { const j = toe[i]; uit.set(r.id, j >= 0 && j < kol.length && W[i][j] > NIET / 2 ? kol[j] : null); });
  return uit;
}

export function verdeelGretig(alle) {
  const uit = new Map(); const over = new Map(); const ritten = echt(alle);
  for (const r of ritten) for (const k of r.kandidaten) if (!over.has(k.id)) over.set(k.id, Math.max(1, Math.floor(k.cap || 1)));
  const volg = ritten.slice().sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0) || (a.id < b.id ? -1 : 1));
  for (const r of volg) {
    let best = null; for (const k of r.kandidaten) if ((over.get(k.id) || 0) > 0 && (!best || k.waarde > best.waarde)) best = k;
    if (best) over.set(best.id, over.get(best.id) - 1);
    uit.set(r.id, best ? best.id : null);
  }
  return uit;
}

// de som van de waarden van een toewijzing (om twee methodes te vergelijken)
export function waardeVan(ritten, uit) {
  let s = 0; for (const r of ritten) { const id = uit.get(r.id); if (!id) continue; const k = r.kandidaten.find(x => x.id === id); if (k) s += k.waarde; }
  return s;
}

export function verdeel(ritten, methode = 'hongaars') { return methode === 'gretig' ? verdeelGretig(ritten) : verdeelHongaars(ritten); }
