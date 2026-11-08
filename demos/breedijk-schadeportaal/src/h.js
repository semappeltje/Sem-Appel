// Kleine hulpjes voor de weergaven: tekst veilig in HTML, de kentekenplaat, de statuspil, en een klik-afhandelaar per
// container (een listener per element, data-act op de knoppen).
import { STATUS, kentekenToon, fmtEur, fmtDatum, fmtDatumTijd, werkdagen } from './regels.js';
import { ico } from './icons.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
export const plaat = (k, lg) => `<span class="plaat${lg ? ' lg' : ''}" aria-label="kenteken ${esc(kentekenToon(k))}">${esc(kentekenToon(k))}</span>`;
export const pill = (status, tekst) => { const s = STATUS[status] || STATUS.nieuw; return `<span class="pill s-${s.k}">${esc(tekst || s.n)}</span>`; };
export const dot = status => `<span class="dot s-${(STATUS[status] || STATUS.nieuw).k}"></span>`;
export const sim = (t = 'gesimuleerd') => `<span class="tag sim" title="${esc(t)}">gesimuleerd</span>`;
export const eur = n => `<span class="num">${fmtEur(n)}</span>`;
export const wd = (van, nu) => { const n = werkdagen(van, nu); return `${n} ${n === 1 ? 'werkdag' : 'werkdagen'}`; };
export const leeg = (kop, tekst) => `<div class="empty"><b>${esc(kop)}</b>${esc(tekst)}</div>`;
export { ico, fmtEur, fmtDatum, fmtDatumTijd, kentekenToon };

// Eén klik-afhandelaar per container: knoppen en rijen met data-act="naam" roepen handlers[naam](el, ev) aan.
// Opnieuw aanroepen vervangt de vorige handlers (de container blijft).
export function bind(el, handlers) {
  el._acts = handlers;
  if (el._bound) return;
  el._bound = true;
  const run = ev => {
    const t = ev.target.closest('[data-act]'); if (!t || !el.contains(t)) return;
    if (ev.type === 'keydown' && !(ev.key === 'Enter' || (ev.key === ' ' && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA'))) return;
    if (ev.type === 'keydown' && /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(t.tagName)) return;
    const h = el._acts[t.dataset.act]; if (!h) return;
    if (ev.type === 'keydown') ev.preventDefault();
    h(t, ev);
  };
  el.addEventListener('click', run); el.addEventListener('keydown', run);
  el.addEventListener('change', ev => { const t = ev.target.closest('[data-chg]'); if (!t || !el.contains(t)) return; const h = el._acts[t.dataset.chg]; if (h) h(t, ev); });
  el.addEventListener('input', ev => { const t = ev.target.closest('[data-inp]'); if (!t || !el.contains(t)) return; const h = el._acts[t.dataset.inp]; if (h) h(t, ev); });
  el.addEventListener('submit', ev => { const t = ev.target.closest('[data-sub]'); if (!t || !el.contains(t)) return; ev.preventDefault(); const h = el._acts[t.dataset.sub]; if (h) h(t, ev); });
}

// Een sorteerbare tabelkop: data-sort=sleutel; aria-sort op de actieve kolom
export function th(kolommen, sort) {
  return kolommen.map(k => k.sort ? `<th class="${k.cls || ''}" ${sort.k === k.sort ? `aria-sort="${sort.d > 0 ? 'ascending' : 'descending'}"` : ''}><button type="button" data-act="sort" data-sort="${k.sort}">${esc(k.n)}${ico('up')}</button></th>` : `<th class="${k.cls || ''}">${esc(k.n)}</th>`).join('');
}
export function sorteer(rijen, sort, get) { const v = get[sort.k]; if (!v) return rijen; return rijen.slice().sort((a, b) => { const x = v(a), y = v(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y, 'nl') : x - y) * sort.d; }); }

// csv downloaden. In een Claude-artifact mag een pagina niet zelf downloaden: daar gaat het via de
// downloads-capability (de kijker bevestigt de naam en het bestand). Elders (de demosite) is er geen
// window.claude en werkt de gewone link. Een "nee" van de kijker is geen fout.
let dlRoute = null;
function artifactDownloads() {
  if (!dlRoute) dlRoute = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  return dlRoute;
}
if (typeof window !== 'undefined') artifactDownloads();
export async function download(naam, tekst, type = 'text/csv;charset=utf-8') {
  const dl = await artifactDownloads();
  if (dl) { try { await dl.save({ filename: naam, data: '\ufeff' + tekst }); } catch { /* geweigerd of niet beschikbaar */ } return; }
  const blob = new Blob(['\ufeff' + tekst], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// een staafdiagram (svg) volgens de dataviz-methode: een tint voor de reeks, grijs voor de context, raster als haarlijn
export function staafdiagram(reeksen, labels, opt = {}) {
  // reeksen: [{k:'a'|'b'|'c', v:[...]}] gestapeld; labels per staaf
  const W = opt.w || 600, H = opt.h || 180, padL = 34, padB = 22, padT = 8;
  const n = labels.length; const tot = labels.map((_, i) => reeksen.reduce((s, r) => s + (r.v[i] || 0), 0)); const max = Math.max(1, ...tot, opt.max || 0);
  const stap = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : max <= 60 ? 10 : max <= 120 ? 20 : Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / stap) * stap;
  const x = i => padL + (i + 0.15) * ((W - padL) / n), bw = ((W - padL) / n) * 0.7, y = v => padT + (H - padB - padT) * (1 - v / top);
  let g = '<g class="grid">'; for (let v = 0; v <= top; v += stap) g += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 3.5}" text-anchor="end">${opt.fmt ? opt.fmt(v) : v}</text>`; g += '</g>';
  let bars = '';
  for (let i = 0; i < n; i++) { let acc = 0; for (const r of reeksen) { const v = r.v[i] || 0; if (!v) continue; bars += `<rect class="${r.k}" x="${x(i)}" y="${y(acc + v)}" width="${bw}" height="${Math.max(1, y(acc) - y(acc + v))}" rx="1.5"><title>${esc(labels[i])}: ${esc(r.n || r.k)} ${opt.fmt ? opt.fmt(v) : v}</title></rect>`; acc += v; } }
  const lab = labels.map((l, i) => (n > 14 && i % 2) ? '' : `<text x="${x(i) + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Staafdiagram')}">${g}<line class="ax" x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>${bars}${lab}</svg>`;
}

// een vonklijn (sparkline) van n waarden, zonder assen; de laatste waarde een stip
export function vonk(v, opt = {}) {
  const W = opt.w || 120, H = opt.h || 32, max = Math.max(1, ...v), min = opt.nul ? 0 : Math.min(...v);
  const x = i => (i / Math.max(1, v.length - 1)) * (W - 4) + 2, y = n => H - 3 - ((n - min) / Math.max(1, max - min)) * (H - 6);
  const pts = v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  return `<svg class="vonk" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(v.length - 1).toFixed(1)}" cy="${y(v[v.length - 1]).toFixed(1)}" r="2.6" fill="currentColor"/></svg>`;
}
// een horizontale verdeling: [{k, n, kleur}] als één balk, met de delen in verhouding
export function verdeling(delen, opt = {}) {
  const tot = delen.reduce((s, d) => s + d.n, 0) || 1;
  return `<div class="verd" role="img" aria-label="${esc(opt.label || 'Verdeling')}">${delen.map(d => d.n ? `<i style="flex:${d.n};background:${d.kleur}" title="${esc(d.k)}: ${d.n}"></i>` : '').join('')}</div>`;
}
