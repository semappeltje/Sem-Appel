// Tabel-component: dichte rijen van 36 px met een vaste kop, sorteren op elke kolom, een zoekveld, filters als keuzemenu's
// (met tellers die rekening houden met de andere filters; de eerste drie in de balk, de rest achter "Meer filters"; een
// actief filter staat als chip met een kruisje), opgeslagen weergaven, kolomkeuze (per kijker bewaard), selectie met
// bulkacties en csv-export. Alles in één rij boven de tabel. Rijen worden in een venster getekend (alleen wat in beeld is), zodat 2.000 rijen soepel scrollen; op een
// smal scherm wordt het een lijst met twee regels per rij. Toetsenbord: pijltjes tussen rijen, Enter opent, spatie selecteert.
import { esc, ic, fmt, downloadCsv, on, empty } from './base.js';

const ROWH = 36;
const colPrefs = store => { try { return JSON.parse(store.get('sl-kolommen') || '{}') || {}; } catch { return {}; } };
const viewPrefs = store => { try { return JSON.parse(store.get('sl-tabelweergaven') || '{}') || {}; } catch { return {}; } };
// de stand van een tabel (zoekwoord, filters, sortering) blijft na herladen staan
const standPrefs = store => { try { return JSON.parse(store.get('sl-tabelstand') || '{}') || {}; } catch { return {}; } };
const ZICHT = 3;   // zoveel filtermenu's staan in de balk; de rest zit achter "Meer filters"

export function createTable(ctx, el, cfg) {
  const st = {
    q: '', f: {}, sort: cfg.sort ? [...cfg.sort] : [cfg.cols[0].k, 1], sel: new Set(), active: null, range: [0, 0], more: 100,
    cols: null, rows: [], view: [], mounted: false, narrow: null,
  };
  for (const f of cfg.filters || []) st.f[f.id] = new Set(f.init || []);
  const prefs = colPrefs(ctx.store)[cfg.id];
  st.cols = new Set(Array.isArray(prefs) ? prefs.filter(k => cfg.cols.some(c => c.k === k)) : cfg.cols.filter(c => c.def !== false).map(c => c.k));
  for (const c of cfg.cols) if (c.req) st.cols.add(c.k);
  const stand = standPrefs(ctx.store)[cfg.id];
  if (stand && typeof stand === 'object') {
    if (typeof stand.q === 'string') st.q = stand.q.slice(0, 200);
    if (stand.f && typeof stand.f === 'object') for (const f of cfg.filters || []) if (Array.isArray(stand.f[f.id])) st.f[f.id] = new Set(stand.f[f.id].map(String));
    if (Array.isArray(stand.sort) && cfg.cols.some(c => c.k === stand.sort[0])) st.sort = [stand.sort[0], stand.sort[1] === -1 ? -1 : 1];
  }
  const bewaarStand = () => { const P = standPrefs(ctx.store); const f = {}; for (const [k, s] of Object.entries(st.f)) f[k] = [...s]; P[cfg.id] = { q: st.q, f, sort: st.sort }; ctx.store.set('sl-tabelstand', JSON.stringify(P)); };
  const visCols = () => cfg.cols.filter(c => st.cols.has(c.k));
  const keyOf = r => String(cfg.key(r));
  const valOf = (c, r) => c.sort ? c.sort(r) : r[c.k];
  // mw: hoogste breedte van een kolom; langere tekst eindigt op een beletselteken, de hele tekst staat in de tooltip
  const cellHtml = (c, r) => {
    if (c.lock && c.lock()) return `<span class="lockc" title="Niet zichtbaar voor jouw rol">${ic('lock', 13)}</span>`;
    const h = c.html ? c.html(r) : esc(r[c.k] === undefined || r[c.k] === null ? '' : r[c.k]);
    return c.mw ? `<div class="cw" style="max-width:${c.mw}px" title="${esc(String(csvOf(c, r)))}">${h}</div>` : h;
  };
  const csvOf = (c, r) => c.lock && c.lock() ? '' : c.csv ? c.csv(r) : (r[c.k] === undefined || r[c.k] === null ? '' : r[c.k]);
  const hasBulk = () => (cfg.bulk || []).length > 0;

  // ---------- filteren en sorteren ----------
  const passSearch = r => { if (!st.q) return true; const t = (cfg.search && cfg.search.text ? cfg.search.text(r) : '').toLowerCase(); return st.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
  const passGroup = (f, r) => { const s = st.f[f.id]; return !s.size || f.test(r, s); };
  function compute() {
    st.rows = cfg.rows();
    const base = st.rows.filter(passSearch);
    st.counts = {};
    for (const f of cfg.filters || []) { const others = (cfg.filters || []).filter(g => g !== f); const pool = base.filter(r => others.every(g => passGroup(g, r))); st.counts[f.id] = pool; }
    let v = base.filter(r => (cfg.filters || []).every(f => passGroup(f, r)));
    const c = cfg.cols.find(x => x.k === st.sort[0]) || cfg.cols[0]; const dir = st.sort[1];
    v = v.map((r, i) => [r, valOf(c, r), i]).sort((a, b) => { const x = a[1], y = b[1]; if (x === y || (x === undefined && y === undefined)) return a[2] - b[2]; if (x === undefined || x === null || x === '') return 1; if (y === undefined || y === null || y === '') return -1; if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir; return String(x).localeCompare(String(y), 'nl', { numeric: true }) * dir; }).map(x => x[0]);
    st.view = v;
    // selectie opschonen: alleen wat nog bestaat
    if (st.sel.size) { const keys = new Set(st.rows.map(keyOf)); for (const k of [...st.sel]) if (!keys.has(k)) st.sel.delete(k); }
  }
  const filtersActive = () => !!st.q || Object.values(st.f).some(s => s.size);

  // ---------- opbouw ----------
  // filters als keuzemenu's: de eerste drie in de balk, de rest achter "Meer filters"; een actief filter is een chip met
  // de keuze en een kruisje (ook als het achter Meer filters zit), en "Wis filters" staat erbij zodra er iets aan staat
  const optsOf = f => f.opts(st.counts ? st.counts[f.id] : st.rows, st.rows);
  function menuKnop(f) {
    const sel = st.f[f.id];
    if (!sel.size) return `<button class="chip menu" type="button" data-fmenu="${f.id}" aria-haspopup="true" aria-expanded="false" aria-label="${esc(`${f.l}: ${f.all || 'alle'}`)}">${esc(f.l)}${ic('chevd', 14)}</button>`;
    const opts = optsOf(f); const label = sel.size === 1 ? (opts.find(o => sel.has(String(o.v))) || { l: [...sel][0] }).l : `${sel.size} gekozen`;
    return `<span class="chip menu aan"><button class="cm" type="button" data-fmenu="${f.id}" aria-haspopup="true" aria-expanded="false" aria-label="${esc(`${f.l}: ${label}, wijzig`)}">${esc(f.l)}: ${esc(label)}</button><button class="cx" type="button" data-fx="${f.id}" aria-label="${esc(`Filter ${f.l} wissen`)}" title="Wissen">${ic('x', 13)}</button></span>`;
  }
  function chipsHtml() {
    const F = cfg.filters || []; const vis = F.slice(0, ZICHT), meer = F.slice(ZICHT); const actief = meer.filter(f => st.f[f.id].size);
    return `${vis.map(menuKnop).join('')}${meer.length ? `<button class="chip menu ghost" type="button" data-tv="meer" aria-haspopup="true" aria-expanded="false">${ic('filter', 14)}Meer filters${actief.length ? ` <span class="n">${actief.length}</span>` : ''}</button>` : ''}${actief.map(menuKnop).join('')}${filtersActive() ? '<button class="chip ghost" type="button" data-tv="reset">Wis filters</button>' : ''}`;
  }
  function headHtml() {
    const cols = visCols(); const all = st.view.length && st.view.every(r => st.sel.has(keyOf(r))); const some = !all && st.view.some(r => st.sel.has(keyOf(r)));
    return `<tr>${hasBulk() ? `<th class="ck" scope="col"><input type="checkbox" class="chk" data-tv="all" aria-label="Alles selecteren" ${all ? 'checked' : ''} ${some ? 'data-ind="1"' : ''}></th>` : ''}${cols.map(c => { const s = st.sort[0] === c.k; if (c.nosort) return `<th scope="col" class="${c.r ? 'r ' : ''}ns" style="${c.w ? `min-width:${c.w}px` : ''}"><span>${esc(c.l)}</span></th>`; return `<th scope="col" class="${c.r ? 'r' : ''}" ${s ? `aria-sort="${st.sort[1] > 0 ? 'ascending' : 'descending'}"` : ''} style="${c.w ? `min-width:${c.w}px` : ''}"><button type="button" data-sort="${c.k}" title="Sorteer op ${esc(c.l)}">${esc(c.l)}${ic(s ? (st.sort[1] > 0 ? 'arrowup' : 'arrowdn') : 'updown', 12)}</button></th>`; }).join('')}</tr>`;
  }
  function mount() {
    el.innerHTML = `<div class="tv">${cfg.head ? `<div class="tv-top" data-tv="top"></div>` : ''}<div class="tv-head">
      <div class="tv-row" data-tv="bar"><div class="fsearch">${ic('search', 15)}<input class="fld" type="search" data-tv="q" placeholder="${esc(cfg.search ? cfg.search.ph : 'Zoeken')}" aria-label="${esc(cfg.search ? cfg.search.ph : 'Zoeken')}" autocomplete="off"></div><span class="tv-cnt" data-tv="cnt" aria-live="polite"></span>${(cfg.filters || []).length ? '<span class="tv-menus" data-tv="menus" role="group" aria-label="Filters"></span>' : ''}<span class="grow"></span>${cfg.tools ? `<span data-tv="tools" class="chips tv-tools"></span>` : ''}<button class="ib" type="button" data-tv="views" aria-haspopup="true" title="Opgeslagen weergaven" aria-label="Opgeslagen weergaven">${ic('save', 17)}</button><button class="ib" type="button" data-tv="cols" aria-haspopup="true" title="Kolommen kiezen" aria-label="Kolommen kiezen">${ic('columns', 17)}</button><button class="ib" type="button" data-tv="csv" title="Exporteer de zichtbare rijen als csv" aria-label="Exporteer als csv">${ic('download', 17)}</button></div>
      ${hasBulk() ? `<div class="tv-bulk" data-tv="bulk" hidden><span class="tv-cnt" data-tv="selcnt"></span>${cfg.bulk.map(b => `<button class="btn sm ${b.pri ? 'pri' : ''}" type="button" data-bulk="${b.id}">${b.icon ? ic(b.icon, 15) : ''}${esc(b.l)}</button>`).join('')}<button class="btn ghost sm" type="button" data-tv="clear">Selectie wissen</button></div>` : ''}
    </div><div class="tv-scroll" data-tv="scroll" tabindex="-1"></div></div>`;
    st.mounted = true; st.narrow = null;
    const q = el.querySelector('[data-tv=q]'); q.value = st.q;
    q.addEventListener('input', () => { st.q = q.value; refresh(true, true); });
    q.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(0); } if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; st.q = ''; refresh(true, true); } });
    const sc = el.querySelector('[data-tv=scroll]'); let raf = 0;
    sc.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; drawBody(); }); }, { passive: true });
    on(el, 'click', '[data-sort]', (e, b) => { const k = b.dataset.sort; st.sort = [k, st.sort[0] === k ? -st.sort[1] : (cfg.cols.find(c => c.k === k) || {}).desc ? -1 : 1]; refresh(true, true); });
    on(el, 'click', '[data-fmenu]', (e, b) => filterMenu(b));
    on(el, 'click', '[data-fx]', (e, b) => { st.f[b.dataset.fx].clear(); refresh(true, true); const m = el.querySelector('[data-tv=q]'); if (m) m.focus({ preventScroll: true }); });
    on(el, 'click', '[data-tv=meer]', (e, b) => meerMenu(b));
    on(el, 'click', '[data-tv=views]', (e, b) => viewsMenu(b));
    on(el, 'click', '[data-tv=cols]', (e, b) => colsMenu(b));
    on(el, 'click', '[data-tv=csv]', () => exportCsv(st.view, cfg.csvName || `${cfg.id}.csv`));
    on(el, 'click', '[data-tv=clear]', () => { st.sel.clear(); refresh(false, true); });
    on(el, 'click', '[data-tv=reset]', () => resetFilters());
    on(el, 'click', '[data-bulk]', (e, b) => { const bk = cfg.bulk.find(x => x.id === b.dataset.bulk); const rows = st.rows.filter(r => st.sel.has(keyOf(r))); if (bk && rows.length) bk.run(rows, b); });
    on(el, 'change', '[data-tv=all]', (e, b) => { if (b.checked) for (const r of st.view) st.sel.add(keyOf(r)); else for (const r of st.view) st.sel.delete(keyOf(r)); refresh(false, true); });
    on(el, 'change', '[data-ck]', (e, b) => { const k = b.dataset.ck; if (b.checked) st.sel.add(k); else st.sel.delete(k); refresh(false, true); });
    on(el, 'click', '[data-more]', () => { st.more += 100; drawBody(); });
    on(el, 'click', '[data-row]', (e, rowEl) => {
      if (e.target.closest('a,button,input,select,label,[data-open]')) return;
      const r = st.view.find(x => keyOf(x) === rowEl.dataset.row); if (r && cfg.open) cfg.open(r);
    });
    // rechtermuisklik (of de menutoets, of Shift F10) op een rij: de acties voor die rij
    const rowMenu = (rowEl, x, y) => { const r = st.view.find(v => keyOf(v) === rowEl.dataset.row); if (!r || !cfg.menu) return false; const items = cfg.menu(r); if (!items || !items.length) return false; ctx.L.menuAt(rowEl, items, { x, y, label: cfg.menuLabel ? cfg.menuLabel(r) : 'Acties' }); return true; };
    if (cfg.menu) on(el, 'contextmenu', '[data-row]', (e, rowEl) => { if (rowMenu(rowEl, e.clientX, e.clientY)) e.preventDefault(); });
    on(el, 'keydown', '[data-row]', (e, rowEl) => {
      const i = st.view.findIndex(x => keyOf(x) === rowEl.dataset.row);
      if (cfg.menu && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); rowMenu(rowEl); return; }
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); focusRow(i + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); if (i <= 0) el.querySelector('[data-tv=q]').focus(); else focusRow(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusRow(0); } else if (e.key === 'End') { e.preventDefault(); focusRow(st.view.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); const r = st.view[i]; if (r && cfg.open) cfg.open(r); }
      else if (e.key === ' ' && hasBulk()) { e.preventDefault(); const k = rowEl.dataset.row; if (st.sel.has(k)) st.sel.delete(k); else st.sel.add(k); refresh(false, true); focusRow(i); }
    });
    if (cfg.onMount) cfg.onMount(el);
  }

  // ---------- tekenen ----------
  // een rij filters die niet past scrolt zijwaarts; een zachte rand laat zien dat er meer is
  function fade(row) { const f = () => { const more = row.scrollWidth > row.clientWidth + 1; row.classList.toggle('ovf-r', more && row.scrollLeft + row.clientWidth < row.scrollWidth - 2); row.classList.toggle('ovf-l', more && row.scrollLeft > 2); }; f(); if (!row.dataset.fade) { row.dataset.fade = '1'; row.addEventListener('scroll', f, { passive: true }); window.addEventListener('resize', f); } }
  function drawChrome() {
    const menus = el.querySelector('[data-tv=menus]');
    if (menus) {
      const h = chipsHtml();
      if (menus.dataset.h !== h) {
        // focus en scrollpositie bewaren als de rij opnieuw getekend wordt
        const ae = document.activeElement; const sig = menus.contains(ae) ? [ae.dataset.fmenu, ae.dataset.fx, ae.dataset.tv] : null; const sl = menus.scrollLeft;
        menus.innerHTML = h; menus.dataset.h = h; menus.scrollLeft = sl;
        if (sig) { const t = [...menus.querySelectorAll('button')].find(b => b.dataset.fmenu === sig[0] && b.dataset.fx === sig[1] && b.dataset.tv === sig[2]) || (sig[1] && menus.querySelector(`[data-fmenu="${sig[1]}"]`)); if (t) t.focus({ preventScroll: true }); else { const q = el.querySelector('[data-tv=q]'); if (q) q.focus({ preventScroll: true }); } }
      }
      fade(menus);
    }
    const n = st.view.length, N = st.rows.length;
    el.querySelector('[data-tv=cnt]').textContent = filtersActive() || n !== N ? `${fmt(n)} van ${fmt(N)}` : `${fmt(N)} ${cfg.unit || 'rijen'}`;
    if (cfg.tools) { const t = el.querySelector('[data-tv=tools]'); const th = cfg.tools(); if (t.dataset.h !== th) { t.innerHTML = th; t.dataset.h = th; } }
    if (cfg.head) { const top = el.querySelector('[data-tv=top]'); const hh = cfg.head(st); if (top.dataset.h !== hh) { top.innerHTML = hh; top.dataset.h = hh; } }
    if (hasBulk()) {
      const k = st.sel.size; const bar = el.querySelector('[data-tv=bar]'), bulk = el.querySelector('[data-tv=bulk]');
      const wasBulk = !bulk.hidden; bulk.hidden = !k; bar.hidden = !!k; el.querySelector('[data-tv=selcnt]').textContent = `${fmt(k)} geselecteerd`;
      if (wasBulk && !k && bulk.contains(document.activeElement)) el.querySelector('[data-tv=q]').focus();
    }
  }
  function rowHtml(r, cols) {
    const k = keyOf(r); const sel = st.sel.has(k);
    return `<tr data-row="${esc(k)}" tabindex="${st.active === k ? 0 : -1}" class="${sel ? 'sel' : ''} ${cfg.rowCls ? cfg.rowCls(r) : ''}" aria-selected="${sel}">${hasBulk() ? `<td class="ck"><input type="checkbox" class="chk" data-ck="${esc(k)}" ${sel ? 'checked' : ''} aria-label="Selecteer ${esc(k)}"></td>` : ''}${cols.map(c => { const v = c.mw || (c.lock && c.lock()) ? '' : String(csvOf(c, r)); return `<td class="${c.r ? 'r ' : ''}${c.cls || ''}"${v.length > 26 ? ` title="${esc(v)}"` : ''}>${cellHtml(c, r)}</td>`; }).join('')}</tr>`;
  }
  function emptyRow(colspan) {
    const [t, x] = filtersActive() ? ['Niets gevonden met deze filters', 'Pas het zoekwoord of de filters aan.'] : (cfg.emptyTxt ? cfg.emptyTxt() : ['Geen rijen', '']);
    const act = filtersActive() ? '<button class="btn sm" type="button" data-tv="reset">Filters wissen</button>' : '';
    return `<tr class="spacer"><td colspan="${colspan}">${empty(t, x, act, filtersActive() ? 'filter' : 'info')}</td></tr>`;
  }
  function drawBody(mode) {
    const sc = el.querySelector('[data-tv=scroll]'); if (!sc) return;
    // een eigen weergave in plaats van rijen (het bord bij Meldingen); zoeken, filters en tellers blijven werken
    const cu = cfg.custom ? cfg.custom(st.view) : null;
    if (cu !== null && cu !== undefined) {
      if (st.narrow !== 'custom') { st.narrow = 'custom'; sc.dataset.h = ''; }
      if (ctx.ui.kbSleept || sc.dataset.h === cu) return;
      const ae = document.activeElement; const fk = sc.contains(ae) && ae.closest('[data-fk]') ? ae.closest('[data-fk]').dataset.fk : null; const top = sc.scrollTop;
      const lists = [...sc.querySelectorAll('[data-kdrop]')].map(x => [x.dataset.kdrop, x.scrollTop]);
      sc.innerHTML = cu; sc.dataset.h = cu; sc.scrollTop = top;
      for (const [k, v] of lists) { const x = sc.querySelector(`[data-kdrop="${CSS.escape(k)}"]`); if (x) x.scrollTop = v; }
      if (fk) { const n = sc.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (n) n.focus({ preventScroll: true }); }
      return;
    }
    const narrow = ctx.narrow(); if (narrow !== st.narrow) { st.narrow = narrow; mode = 'head'; sc.innerHTML = ''; sc.dataset.h = ''; }
    if (narrow) {
      const L = st.view.slice(0, st.more); const m = cfg.mobile;
      const h = st.view.length ? `<div class="ml" role="list">${L.map(r => { const k = keyOf(r); return `<div class="ml-i ${st.sel.has(k) ? 'sel' : ''}" role="listitem" data-row="${esc(k)}" tabindex="${st.active === k ? 0 : -1}">${hasBulk() ? `<input type="checkbox" class="chk" data-ck="${esc(k)}" ${st.sel.has(k) ? 'checked' : ''} aria-label="Selecteer ${esc(k)}">` : '<span></span>'}<div class="ml-t">${m.t(r)}</div><div class="ml-r">${m.r ? m.r(r) : ''}</div><div class="ml-m">${m.m(r)}</div></div>`; }).join('')}</div>${st.view.length > L.length ? `<button class="ml-more" type="button" data-more="1">Toon meer (${fmt(st.view.length - L.length)} over)</button>` : ''}` : `<table class="tbl"><tbody>${emptyRow(1)}</tbody></table>`;
      if (sc.dataset.h !== h) { const ae = document.activeElement; const k = sc.contains(ae) && ae.closest('[data-row]') ? ae.closest('[data-row]').dataset.row : null; sc.innerHTML = h; sc.dataset.h = h; if (k) { const r = sc.querySelector(`[data-row="${CSS.escape(k)}"]`); if (r) r.focus({ preventScroll: true }); } }
      return;
    }
    const cols = visCols(); const colspan = cols.length + (hasBulk() ? 1 : 0);
    let table = sc.querySelector('table.tbl');
    if (!table || mode === 'head') { sc.innerHTML = '<table class="tbl"><thead></thead><tbody></tbody></table>'; table = sc.querySelector('table'); }
    const th = headHtml(); const thead = table.tHead; if (thead.dataset.h !== th) { thead.innerHTML = th; thead.dataset.h = th; }
    const all = thead.querySelector('[data-tv=all]'); if (all) all.indeterminate = !!all.dataset.ind;
    table.setAttribute('aria-rowcount', st.view.length);
    const headH = thead.offsetHeight || ROWH; const vh = sc.clientHeight || 600; const top = Math.max(0, sc.scrollTop - headH);
    const i0 = Math.max(0, Math.floor(top / ROWH) - 8), i1 = Math.min(st.view.length, i0 + Math.ceil(vh / ROWH) + 16);
    st.range = [i0, i1];
    const body = st.view.length ? `<tr class="spacer" aria-hidden="true"><td colspan="${colspan}" style="height:${i0 * ROWH}px"></td></tr>${st.view.slice(i0, i1).map(r => rowHtml(r, cols)).join('')}<tr class="spacer" aria-hidden="true"><td colspan="${colspan}" style="height:${(st.view.length - i1) * ROWH}px"></td></tr>` : emptyRow(colspan);
    const tb = table.tBodies[0]; if (tb.dataset.h === body) return;
    const ae = document.activeElement; const fk = tb.contains(ae) && ae.closest('[data-row]') ? ae.closest('[data-row]').dataset.row : null; const fck = fk && ae.dataset ? ae.dataset.ck : null;
    tb.innerHTML = body; tb.dataset.h = body;
    if (fk) { const r = tb.querySelector(fck ? `[data-ck="${CSS.escape(fck)}"]` : `[data-row="${CSS.escape(fk)}"]`); if (r) r.focus({ preventScroll: true }); }
  }
  function focusRow(i) {
    if (!st.view.length) return; i = Math.max(0, Math.min(st.view.length - 1, i)); const k = keyOf(st.view[i]); st.active = k;
    const sc = el.querySelector('[data-tv=scroll]');
    if (!ctx.narrow()) { const thead = sc.querySelector('thead'); const headH = thead ? thead.offsetHeight : ROWH; const y = i * ROWH; if (y < sc.scrollTop) sc.scrollTop = y; else if (y + ROWH + headH > sc.scrollTop + sc.clientHeight) sc.scrollTop = y + ROWH + headH - sc.clientHeight; }
    else if (i >= st.more) st.more = i + 50;
    drawBody();
    const row = el.querySelector(`[data-row="${CSS.escape(k)}"]`); if (row) { el.querySelectorAll('[data-row][tabindex="0"]').forEach(x => { if (x !== row) x.tabIndex = -1; }); row.tabIndex = 0; row.focus({ preventScroll: !ctx.narrow() }); }
  }
  function refresh(full = true, force = false) {
    if (!st.mounted || !el.querySelector('.tv')) mount();
    if (full) compute();
    if (force && full) { const sc = el.querySelector('[data-tv=scroll]'); if (sc) sc.scrollTop = 0; bewaarStand(); }
    drawChrome(); drawBody();
  }
  function resetFilters() { st.q = ''; for (const k of Object.keys(st.f)) st.f[k].clear(); const q = el.querySelector('[data-tv=q]'); if (q) q.value = ''; refresh(true, true); }

  // ---------- menu's ----------
  function filterMenu(b) {
    const f = cfg.filters.find(x => x.id === b.dataset.fmenu); const opts = f.opts(st.counts ? st.counts[f.id] : st.rows, st.rows); const s = st.f[f.id];
    const list = q => opts.filter(o => !q || String(o.l).toLowerCase().includes(q.toLowerCase())).map(o => `<button class="menu-i ${s.has(String(o.v)) ? 'on' : ''}" type="button" data-fv="${esc(o.v)}" role="menuitemcheckbox" aria-checked="${s.has(String(o.v))}">${ic('check', 15, 'chk2')}<span class="grow">${o.dot ? `<i class="dot ${o.dot}" style="margin-right:6px"></i>` : ''}${esc(o.l)}</span>${o.n !== undefined ? `<small>${fmt(o.n)}</small>` : ''}</button>`).join('') || '<div class="menu-h">Niets gevonden</div>';
    ctx.L.openPop(b, `<div class="menu-h">${esc(f.l)}</div>${opts.length > 8 ? `<div style="padding:4px 6px 6px"><div class="fsearch">${ic('search', 14)}<input class="fld sm" type="search" placeholder="Zoek ${esc(f.l.toLowerCase())}" data-fq autofocus aria-label="Zoek ${esc(f.l.toLowerCase())}"></div></div>` : ''}<div class="menu-scroll" role="menu" data-fl>${list('')}</div><div class="menu-f"><button class="btn ghost sm" type="button" data-fclear>Alles tonen</button></div>`, {
      label: f.l, onBind: p => {
        const q = p.querySelector('[data-fq]'); if (q) q.addEventListener('input', () => { p.querySelector('[data-fl]').innerHTML = list(q.value); });
        on(p, 'click', '[data-fv]', (e, x) => { const v = x.dataset.fv; if (f.single) { s.clear(); s.add(v); } else if (s.has(v)) s.delete(v); else s.add(v); x.classList.toggle('on', s.has(v)); x.setAttribute('aria-checked', s.has(v)); refresh(true, true); if (f.single) ctx.L.closePop(); });
        on(p, 'click', '[data-fclear]', () => { s.clear(); refresh(true, true); ctx.L.closePop(); });
      },
    });
  }
  // "Meer filters": de overige filtergroepen in één popover, elk met zijn keuzes en tellers
  function meerMenu(b) {
    const F = (cfg.filters || []).slice(ZICHT);
    const html = () => F.map(f => { const s = st.f[f.id]; const opts = optsOf(f); return `<div class="menu-h">${esc(f.l)}</div>${opts.map(o => `<button class="menu-i ${s.has(String(o.v)) ? 'on' : ''}" type="button" data-mf="${f.id}" data-fv="${esc(o.v)}" role="menuitemcheckbox" aria-checked="${s.has(String(o.v))}">${ic('check', 15, 'chk2')}<span class="grow">${o.dot ? `<i class="dot ${o.dot}" style="margin-right:6px"></i>` : ''}${esc(o.l)}</span>${o.n !== undefined ? `<small>${fmt(o.n)}</small>` : ''}</button>`).join('') || '<div class="menu-h" style="font-weight:400">Geen keuzes</div>'}`; }).join('<div class="menu-sep"></div>');
    ctx.L.openPop(b, `<div class="menu-scroll" role="menu" data-meer>${html()}</div><div class="menu-f"><button class="btn ghost sm" type="button" data-meerclear>Deze filters wissen</button></div>`, {
      label: 'Meer filters', onBind: p => {
        on(p, 'click', '[data-mf]', (e, x) => { const f = F.find(g => g.id === x.dataset.mf); const s = st.f[f.id]; const v = x.dataset.fv; if (f.single) { const had = s.has(v); s.clear(); if (!had) s.add(v); } else if (s.has(v)) s.delete(v); else s.add(v); refresh(true, true); const box = p.querySelector('[data-meer]'); const sc = box.scrollTop; box.innerHTML = html(); box.scrollTop = sc; const t = box.querySelector(`[data-mf="${f.id}"][data-fv="${CSS.escape(v)}"]`); if (t) t.focus(); });
        on(p, 'click', '[data-meerclear]', () => { for (const f of F) st.f[f.id].clear(); refresh(true, true); ctx.L.closePop(); });
      },
    });
  }
  // opgeslagen weergaven per tabel: zoekwoord, filters, sortering en kolommen onder een naam (in deze browser)
  function viewsMenu(b) {
    const alle = () => viewPrefs(ctx.store)[cfg.id] || [];
    const html = () => { const L = alle(); return `<div class="menu-h">Weergaven</div>${L.length ? L.map((w, i) => `<div class="menu-i vw"><button class="grow" type="button" data-vw="${i}">${ic('eye', 15)}<span>${esc(w.naam)}</span></button><button class="ib xs" type="button" data-vwdel="${i}" aria-label="${esc(`Weergave ${w.naam} verwijderen`)}" title="Verwijderen">${ic('x', 13)}</button></div>`).join('') : '<div class="menu-h" style="font-weight:400;max-width:260px">Nog geen weergaven. Zet filters, zoekwoord, sortering en kolommen zoals je wilt en bewaar ze.</div>'}<div class="menu-sep"></div><form class="vw-new" data-vwnew><input class="fld sm" name="naam" maxlength="40" placeholder="Naam, bijvoorbeeld: Wognum koel" aria-label="Naam van de weergave" autocomplete="off"><button class="btn sm" type="submit">Bewaar</button></form>`; };
    const zet = L => { const P = viewPrefs(ctx.store); P[cfg.id] = L; ctx.store.set('sl-tabelweergaven', JSON.stringify(P)); };
    ctx.L.openPop(b, `<div data-vwbox>${html()}</div>`, {
      align: 'right', label: 'Weergaven', onBind: p => {
        const box = p.querySelector('[data-vwbox]');
        on(p, 'click', '[data-vw]', (e, x) => { const w = alle()[+x.dataset.vw]; if (!w) return; st.q = w.q || ''; for (const f of cfg.filters || []) st.f[f.id] = new Set((w.f && w.f[f.id]) || []); if (Array.isArray(w.sort)) st.sort = w.sort; if (Array.isArray(w.cols) && w.cols.length) { st.cols = new Set(w.cols.filter(k => cfg.cols.some(c => c.k === k))); for (const c of cfg.cols) if (c.req) st.cols.add(c.k); saveCols(); } const q = el.querySelector('[data-tv=q]'); if (q) q.value = st.q; refresh(true, true); ctx.L.closePop(); ctx.L.toast(`Weergave "${w.naam}" geladen.`, { icon: 'eye' }); });
        on(p, 'click', '[data-vwdel]', (e, x) => { const L = alle(); const w = L.splice(+x.dataset.vwdel, 1)[0]; zet(L); box.innerHTML = html(); if (w) ctx.L.toast(`Weergave "${w.naam}" verwijderd.`, { icon: 'trash' }); });
        on(p, 'submit', '[data-vwnew]', (e, f) => { e.preventDefault(); const naam = (f.naam.value || '').trim(); if (!naam) { f.naam.focus(); return; } const L = alle().filter(w => w.naam !== naam); L.push({ naam, q: st.q, f: Object.fromEntries(Object.entries(st.f).map(([k, v]) => [k, [...v]])), sort: st.sort, cols: [...st.cols] }); zet(L); box.innerHTML = html(); ctx.L.toast(`Weergave "${naam}" bewaard.`, { icon: 'save' }); });
      },
    });
  }
  function colsMenu(b) {
    ctx.L.openPop(b, `<div class="menu-h">Kolommen</div><div class="menu-scroll" role="menu">${cfg.cols.map(c => `<button class="menu-i ${st.cols.has(c.k) ? 'on' : ''}" type="button" data-col="${c.k}" role="menuitemcheckbox" aria-checked="${st.cols.has(c.k)}" ${c.req ? 'disabled' : ''}>${ic('check', 15, 'chk2')}<span class="grow">${esc(c.l)}</span>${c.lock && c.lock() ? ic('lock', 13) : ''}</button>`).join('')}</div><div class="menu-f"><button class="btn ghost sm" type="button" data-coldef>Standaard</button></div>`, {
      align: 'right', label: 'Kolommen', onBind: p => {
        on(p, 'click', '[data-col]', (e, x) => { const k = x.dataset.col; if (st.cols.has(k)) st.cols.delete(k); else st.cols.add(k); x.classList.toggle('on', st.cols.has(k)); x.setAttribute('aria-checked', st.cols.has(k)); saveCols(); refresh(false, true); });
        on(p, 'click', '[data-coldef]', () => { st.cols = new Set(cfg.cols.filter(c => c.def !== false || c.req).map(c => c.k)); saveCols(); refresh(false, true); ctx.L.closePop(); });
      },
    });
  }
  function saveCols() { const p = colPrefs(ctx.store); p[cfg.id] = [...st.cols]; ctx.store.set('sl-kolommen', JSON.stringify(p)); }
  function exportCsv(rows, name) {
    const cols = visCols().filter(c => !(c.lock && c.lock()));
    const ok = downloadCsv(name, cols.map(c => c.l), rows.map(r => cols.map(c => csvOf(c, r))));
    ctx.L.toast(ok ? `Export klaar: ${fmt(rows.length)} rijen in ${name}.` : 'Downloaden kan in deze omgeving niet.', { icon: ok ? 'download' : 'info' });
    ctx.logAct && ok && ctx.logAct(`exporteerde ${fmt(rows.length)} rijen (${name})`);
  }
  return {
    refresh, st, mount, focusRow, exportCsv, resetFilters,
    setFilter(id, vals) { st.f[id] = new Set(vals.map(String)); refresh(true, true); },
    setSearch(q) { st.q = q; const i = el.querySelector('[data-tv=q]'); if (i) i.value = q; refresh(true, true); },
    clearSel() { st.sel.clear(); refresh(false, true); },
  };
}
