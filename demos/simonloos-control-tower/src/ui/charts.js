// Kleine grafieken in SVG en HTML volgens de dataviz-methode: één reeks in één tint (--viz-1), de-emfase in grijs,
// dunne markeringen (staven hooguit 24 px met een afgeronde kop van 4 px op een vaste basislijn, lijnen van 2 px),
// rasterlijnen als ononderbroken haarlijn, waarden bij de kop in plaats van op elk punt, en een tooltip bij aanwijzen
// en bij toetsenbordfocus. Elke grafiek heeft een tabel als tweeling (zelfde getallen, zonder kleur).
import { esc, on } from './base.js';

// sparkline: grijze lijn met een zachte vlakvulling, het laatste punt (nu) als stip in inkt; geen labels op de punten
export function sparkline(vals, { w = 128, h = 40, min = null, max = null, label = '' } = {}) {
  const v = vals.filter(x => x !== null && x !== undefined && !Number.isNaN(x)); if (v.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
  let lo = min !== null ? min : Math.min(...v), hi = max !== null ? max : Math.max(...v); if (hi - lo < 1e-9) { hi = lo + 1; lo = lo - 1; }
  const pad = 5; const X = i => pad + i * (w - pad * 2) / (vals.length - 1); const Y = x => h - pad - (x - lo) / (hi - lo) * (h - pad * 2);
  const pts = vals.map((x, i) => [X(i), Y(x)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const a = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><line class="ref" x1="${pad}" x2="${w - pad}" y1="${h - pad}" y2="${h - pad}"/><path class="a" d="${a}"/><path class="l" d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4"/></svg>`;
}

// horizontale staven met een referentielijn (doel) en de waarde aan de kop
export function hbars(rows, { max = 100, ref = null, fmtV = v => v, axis = [0, 25, 50, 75, 100], min = 0, unit = '' } = {}) {
  const pos = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  return `<div class="hbars" role="list">${rows.map(r => `<div class="hb" role="listitem" tabindex="0" data-tip="${esc(r.tip || `${r.l}: ${fmtV(r.v)}${unit}`)}"><span title="${esc(r.l)}">${esc(r.l)}</span><div class="trk"><i style="width:${pos(r.v).toFixed(2)}%"></i>${ref !== null ? `<u style="left:${pos(ref).toFixed(2)}%" aria-hidden="true"></u>` : ''}</div><b>${esc(fmtV(r.v))}</b></div>`).join('')}</div>
    <div class="hbax" aria-hidden="true"><div></div><div>${axis.map(a => `<span style="left:${pos(a).toFixed(2)}%">${esc(fmtV(a))}</span>`).join('')}</div><div></div></div>`;
}

// stippen per rij (Cleveland-dotplot): voor percentages die dicht bij elkaar liggen, zoals stiptheid. Een stip codeert
// geen lengte, dus de as mag bij bijvoorbeeld 90 % beginnen; de referentielijn is het doel.
export function dotplot(rows, { min = 90, max = 100, ref = null, fmtV = v => v, fmtA = fmtV, axis = [] } = {}) {
  const pos = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  return `<div class="hbars dots" role="list">${rows.map(r => `<div class="hb" role="listitem" tabindex="0" data-tip="${esc(r.tip || `${r.l}: ${fmtV(r.v)}`)}"><span title="${esc(r.l)}">${esc(r.l)}</span><div class="trk">${ref !== null ? `<u style="left:${pos(ref).toFixed(2)}%" aria-hidden="true"></u>` : ''}<i style="left:${pos(r.v).toFixed(2)}%"></i></div><b>${esc(fmtV(r.v))}</b></div>`).join('')}</div>
    <div class="hbax" aria-hidden="true"><div></div><div>${axis.map(a => `<span style="left:${pos(a).toFixed(2)}%">${esc(fmtA(a))}</span>`).join('')}</div><div></div></div>`;
}

// lijn door de tijd (weken): 2 px lijn in één tint, stippen van 8 px met een groter raakvlak, alleen het laatste punt
// met een label; de as mag boven nul beginnen (een lijn codeert geen lengte)
export function lineChart(pts, { min = 0, max = 100, ref = null, refLabel = '', fmtV = v => v, fmtA = fmtV, ticks = [] } = {}) {
  const pos = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100)); const n = pts.length; const X = i => (n > 1 ? i / (n - 1) * 100 : 50);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)} ${(100 - pos(p.v)).toFixed(2)}`).join(' ');
  return `<div class="lchart">${ticks.map(t => `<div class="gl ${t === min ? 'base' : ''}" style="bottom:${pos(t).toFixed(2)}%"><span>${esc(fmtA(t))}</span></div>`).join('')}${ref !== null ? `<div class="ref" style="bottom:${pos(ref).toFixed(2)}%"><span>${esc(refLabel)}</span></div>` : ''}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>${pts.map((p, i) => { const tip = p.tip || `${p.l}: ${fmtV(p.v)}`; return `<button type="button" class="pt ${p.cur ? 'cur' : ''}" style="left:${X(i).toFixed(2)}%;bottom:${pos(p.v).toFixed(2)}%" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${p.cur ? `<b>${esc(fmtV(p.v))}</b>` : ''}</button>`; }).join('')}</div>
    <div class="lax" aria-hidden="true">${pts.map((p, i) => `<span style="left:${X(i).toFixed(2)}%">${esc(p.l)}</span>`).join('')}</div>`;
}

// kolommen per periode met een referentielijn; de laatste kolom in de accenttint, eerdere in dezelfde tint
export function vcols(cols, { min = 0, max = 100, ref = null, refLabel = '', fmtV = v => v, ticks = [] } = {}) {
  const pos = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  return `<div class="vcol">${ticks.map(t => `<div class="gl ${t === min ? 'base' : ''}" style="bottom:${pos(t).toFixed(2)}%"><span>${esc(fmtV(t))}</span></div>`).join('')}${ref !== null ? `<div class="ref" style="bottom:${pos(ref).toFixed(2)}%"><span>${esc(refLabel)}</span></div>` : ''}
    <div class="cols">${cols.map(c => `<button type="button" class="${c.mut ? 'mut' : ''}" data-tip="${esc(c.tip || `${c.l}: ${fmtV(c.v)}`)}" aria-label="${esc(c.tip || `${c.l}: ${fmtV(c.v)}`)}"><b style="bottom:${pos(c.v).toFixed(2)}%">${esc(c.lab !== undefined ? c.lab : '')}</b><i style="height:${pos(c.v).toFixed(2)}%"></i></button>`).join('')}</div></div>
    <div class="vax" aria-hidden="true">${cols.map(c => `<span>${esc(c.l)}</span>`).join('')}</div>`;
}

// gestapelde kolommen per periode (hooguit vier reeksen in vaste volgorde: --viz-1, --viz-2, --viz-3, grijs), met 2 px
// ruimte tussen de stukken, een legenda met de totalen en een tooltip per kolom (alle stukken in een regel)
export function stackcols(cols, { series, max, ticks = [], fmtV = v => v } = {}) {
  const pos = v => Math.max(0, Math.min(100, v / max * 100));
  const leg = `<div class="sc-leg">${series.map((s, i) => `<span><i class="s${s.kl || i + 1}"></i>${esc(s.l)} <b>${esc(fmtV(cols.reduce((a, c) => a + (c.v[i] || 0), 0)))}</b></span>`).join('')}</div>`;
  return `${leg}<div class="vcol sc">${ticks.map(t => `<div class="gl ${t === 0 ? 'base' : ''}" style="bottom:${pos(t).toFixed(2)}%"><span>${esc(fmtV(t))}</span></div>`).join('')}
    <div class="cols">${cols.map(c => { const tip = `${c.l}: ${series.map((s, i) => `${s.l} ${fmtV(c.v[i] || 0)}`).join(', ')}`; return `<button type="button" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span class="st">${series.map((s, i) => (c.v[i] ? `<i class="s${s.kl || i + 1}" style="height:${pos(c.v[i]).toFixed(2)}%"></i>` : '')).join('')}</span></button>`; }).join('')}</div></div>
    <div class="vax" aria-hidden="true">${cols.map(c => `<span>${esc(c.l)}</span>`).join('')}</div>`;
}

// tooltip bij aanwijzen en focus (één element per app); waarde voorop, label erachter
export function bindTips(root, el) {
  let tip = root.querySelector('.ctip'); if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; tip.hidden = true; root.appendChild(tip); }
  const show = t => { const s = t.dataset.tip || ''; const [a, ...b] = s.split(': '); tip.innerHTML = b.length ? `<b>${esc(b.join(': '))}</b><span>${esc(a)}</span>` : `<b>${esc(s)}</b>`; tip.hidden = false; const rr = root.getBoundingClientRect(), tr = t.getBoundingClientRect(); const x = Math.min(rr.width - tip.offsetWidth - 8, Math.max(8, tr.left - rr.left + tr.width / 2 - tip.offsetWidth / 2)); const y = tr.top - rr.top - tip.offsetHeight - 8; tip.style.left = `${x}px`; tip.style.top = `${y < 8 ? tr.bottom - rr.top + 8 : y}px`; };
  const hide = () => { tip.hidden = true; };
  on(el, 'pointerover', '[data-tip]', (e, t) => show(t)); on(el, 'pointerout', '[data-tip]', () => hide());
  on(el, 'focusin', '[data-tip]', (e, t) => show(t)); on(el, 'focusout', '[data-tip]', () => hide());
}
