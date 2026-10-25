// Tijdreeksen op uPlot (MIT, canvas): de dagprijs en het laadvermogen per kwartier bij Laden en de stiptheid per dag in
// Rapporten. Volgens de dataviz-methode: een as per grafiek (nooit twee schalen), de hoofdreeks in de accenttint en een
// vergelijking in grijs, lijnen van 2 px, een gestreepte referentielijn (netaansluiting, doel) en een dunne lijn op nu.
// Bij aanwijzen staan de waarden van dat moment in de legenda boven de grafiek; met de toetsen pijl links en rechts loop
// je per punt. Kleuren komen uit de CSS-variabelen van de app, dus licht en donker kloppen (bij een themawissel wordt de
// grafiek opnieuw gemaakt). uPlot zelf heeft geen CSS nodig buiten de regels onder .slct in style.css.
// uPlot wordt pas geladen bij de eerste grafiek (in de site-build een eigen bestand, uplot.js).
let UP = null;
const laad = () => UP || (UP = import('uplot').then(m => m.default));

const kleur = (el, v, d) => { const x = getComputedStyle(el).getPropertyValue(v).trim(); return x || d; };
const ronde = (hi, stap) => Math.max(stap, Math.ceil(hi / stap) * stap);

// tijdreeks(el, cfg) maakt de grafiek in el en geeft { destroy }. cfg:
//   x: [getallen] (minuten van de dag of dagnummers), series: [{ label, data, accent, stap, streep }],
//   fmtX, fmtY, yMin, yMax, yStap, xStap (afstand tussen de labels op de x-as), ref: { v, label }, nu: x of null,
//   hoogte (px), label (voor schermlezers; de tabel ernaast is de tweeling)
export function tijdreeks(el, cfg) {
  let weg = false, inst = null;
  laad().then(uPlot => { if (!weg && el.isConnected) inst = maak(uPlot, el, cfg); }).catch(err => { console.warn('grafiek', err); });
  return { destroy() { weg = true; if (inst) inst.destroy(); inst = null; } };
}
function maak(uPlot, el, cfg) {
  const host = el.closest('.slct') || document.body; const W = () => Math.max(260, Math.floor(el.clientWidth || el.getBoundingClientRect().width || 600));
  const C = { tekst: kleur(host, '--text2', '#3A414D'), mut: kleur(host, '--muted', '#5F6775'), grid: kleur(host, '--viz-grid', '#E8EAEE'), as: kleur(host, '--viz-axis', '#C9CED6'), accent: kleur(host, '--viz-1', '#2A78D6'), grijs: kleur(host, '--viz-mut', '#B8BEC8'), font: kleur(host, '--font', 'system-ui') };
  const hi = Math.max(...cfg.series.flatMap(s => s.data.filter(v => v !== null && v !== undefined)), cfg.ref ? cfg.ref.v : 0, 1);
  const yMax = cfg.yMax !== undefined ? cfg.yMax : ronde(hi * 1.08, cfg.yStap || 10); const yMin = cfg.yMin !== undefined ? cfg.yMin : 0;
  const font = `12px ${C.font}`; const fmtAs = cfg.fmtAs || cfg.fmtY;
  // zonder cursor toont de legenda de waarden van nu (of het laatste punt)
  const rust = cfg.nu !== null && cfg.nu !== undefined ? Math.max(0, cfg.x.reduce((k, v, i) => (v <= cfg.nu ? i : k), 0)) : cfg.x.length - 1;
  const leeg = v => v === null || v === undefined;
  const opts = {
    width: W(), height: cfg.hoogte || 220, padding: [14, 30, 0, 4],
    scales: { x: { time: false }, y: { range: () => [yMin, yMax] } },
    axes: [
      { stroke: C.mut, font, grid: { show: false }, ticks: { stroke: C.as, width: 1, size: 4 }, incrs: [cfg.xStap || 60, (cfg.xStap || 60) * 2, (cfg.xStap || 60) * 3], space: 52, values: (u, vals) => vals.map(v => cfg.fmtX(v)) },
      { stroke: C.mut, font, grid: { stroke: C.grid, width: 1 }, ticks: { show: false }, size: 58, space: 32, incrs: cfg.yStap ? [cfg.yStap, cfg.yStap * 2, cfg.yStap * 5] : undefined, values: (u, vals) => vals.map(v => fmtAs(v)) },
    ],
    series: [
      { label: cfg.xLabel || 'Tijd', value: (u, v, si, di) => (leeg(di) ? `${cfg.fmtX(cfg.x[rust])}${cfg.nu !== null && cfg.nu !== undefined ? ' (nu)' : ''}` : leeg(v) ? '–' : cfg.fmtX(v)) },
      ...cfg.series.map(s => ({ label: s.label, stroke: s.accent === false ? C.grijs : C.accent, width: 2, dash: s.streep || undefined, paths: s.stap ? uPlot.paths.stepped({ align: 1 }) : undefined,
        points: s.laatste ? { show: true, size: 8, width: 2, fill: C.accent, filter: () => [s.data.length - 1] } : { show: false },
        value: (u, v, si, di) => { const w = leeg(di) ? s.data[rust] : v; return leeg(w) ? '–' : cfg.fmtY(w); } })),
    ],
    cursor: { y: false, drag: { x: false, y: false }, points: { size: 8, width: 2, fill: (u, i) => u.series[i].stroke() } },
    legend: { live: true },
    hooks: {
      draw: [u => {
        const c = u.ctx; const r = devicePixelRatio || 1; c.save(); c.font = `${12 * r}px ${C.font}`; c.textBaseline = 'bottom';
        if (cfg.ref) { const y = Math.round(u.valToPos(cfg.ref.v, 'y', true)) + 0.5; c.strokeStyle = C.mut; c.lineWidth = r; c.setLineDash([4 * r, 4 * r]); c.beginPath(); c.moveTo(u.bbox.left, y); c.lineTo(u.bbox.left + u.bbox.width, y); c.stroke(); c.setLineDash([]); if (cfg.ref.label) { c.fillStyle = C.mut; c.textAlign = cfg.ref.links ? 'left' : 'right'; c.fillText(cfg.ref.label, cfg.ref.links ? u.bbox.left + 6 * r : u.bbox.left + u.bbox.width - 4 * r, y - 3 * r); } }
        if (cfg.nu !== null && cfg.nu !== undefined) { const x = Math.round(u.valToPos(cfg.nu, 'x', true)) + 0.5; if (x >= u.bbox.left && x <= u.bbox.left + u.bbox.width) { c.strokeStyle = C.tekst; c.lineWidth = r; c.beginPath(); c.moveTo(x, u.bbox.top); c.lineTo(x, u.bbox.top + u.bbox.height); c.stroke(); c.fillStyle = C.tekst; c.textAlign = 'left'; c.fillText('nu', x + 4 * r, u.bbox.top + 14 * r); } }
        c.restore();
      }],
    },
  };
  const data = [cfg.x, ...cfg.series.map(s => s.data)];
  let u = null;
  try { u = new uPlot(opts, data, el); } catch (err) { console.warn('grafiek', err); el.innerHTML = ''; return { destroy() {} }; }
  const can = u.root.querySelector('.u-over'); if (can) { can.tabIndex = 0; can.setAttribute('role', 'img'); can.setAttribute('aria-label', cfg.label || cfg.series.map(s => s.label).join(', ')); }
  // toetsenbord: pijl links en rechts loopt langs de punten, Esc haalt de cursor weg
  let idx = -1;
  const zet = i => { idx = Math.max(0, Math.min(cfg.x.length - 1, i)); u.setCursor({ left: u.valToPos(cfg.x[idx], 'x'), top: u.bbox.height / (2 * (devicePixelRatio || 1)) }); };
  if (can) can.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); zet(idx < 0 ? (cfg.nu !== null && cfg.nu !== undefined ? cfg.x.findIndex(v => v >= cfg.nu) : 0) : idx + (e.key === 'ArrowRight' ? 1 : -1)); } else if (e.key === 'Escape') { idx = -1; u.setCursor({ left: -10, top: -10 }); } });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { const w = W(); if (u && Math.abs(w - u.width) > 2) u.setSize({ width: w, height: cfg.hoogte || 220 }); }) : null;
  if (ro) ro.observe(el);
  return { destroy() { if (ro) ro.disconnect(); if (u) u.destroy(); u = null; }, u };
}
