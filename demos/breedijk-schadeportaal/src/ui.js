// De schil: linkermenu, topbalk, onderbalk, adressen (hash), zoeken, dialogen, meldingen (toasts), sneltoetsen, thema.
// De weergaven zelf staan in src/views/*.js en krijgen `ctx`.
import { STATUS, OPEN_STATUS, beoordeel, zoek, fmtDatumLang, werkdagen } from './regels.js';
import { ritVan } from './data.js';
import { ROLLEN, bewaarInstellingen } from './instellingen.js';
import { ico } from './icons.js';
import { esc, bind } from './h.js';
import * as overzicht from './views/overzicht.js';
import * as schades from './views/schades.js';
import * as dossier from './views/dossier.js';
import * as chauffeurs from './views/chauffeurs.js';
import * as opdrachtgevers from './views/opdrachtgevers.js';
import * as rapporten from './views/rapporten.js';
import * as dashboard from './views/dashboard.js';
import * as instellingen from './views/instellingen.js';
import { nieuweMelding } from './views/nieuw.js';

const VIEWS = {
  overzicht: { n: 'Overzicht', ic: 'home', el: 'v-overzicht', mod: overzicht, grp: 'Werk', key: '1' },
  schades: { n: 'Schades', ic: 'inbox', el: 'v-schades', mod: schades, grp: 'Werk', key: '2' },
  schade: { n: 'Dossier', ic: 'file', el: 'v-dossier', mod: dossier, hidden: true, parent: 'schades' },
  chauffeurs: { n: 'Chauffeurs', ic: 'users', el: 'v-chauffeurs', mod: chauffeurs, grp: 'Mensen en klanten', key: '3' },
  chauffeur: { n: 'Chauffeur', el: 'v-chauffeurs', mod: chauffeurs, hidden: true, parent: 'chauffeurs' },
  opdrachtgevers: { n: 'Opdrachtgevers', ic: 'building', el: 'v-opdrachtgevers', mod: opdrachtgevers, grp: 'Mensen en klanten', key: '4' },
  opdrachtgever: { n: 'Opdrachtgever', el: 'v-opdrachtgevers', mod: opdrachtgevers, hidden: true, parent: 'opdrachtgevers' },
  dashboard: { n: 'Dashboard', ic: 'grid', el: 'v-dashboard', mod: dashboard, grp: 'Cijfers', key: '5' },
  rapporten: { n: 'Rapporten', ic: 'chart', el: 'v-rapporten', mod: rapporten, grp: 'Cijfers', key: '6' },
  instellingen: { n: 'Instellingen', ic: 'settings', el: 'v-instellingen', mod: instellingen, grp: 'Cijfers', key: '7' },
};
const BOTTOM = ['overzicht', 'schades', 'chauffeurs', 'dashboard', 'instellingen'];

export function createUI(app, D, inst, store, acties, cfg, importen) {
  const NU = D.NU;
  const root = app; let huidig = null; let dlgSluit = null;
  const views = document.getElementById('views');
  const ctx = {
    D, inst, store, NU, acties, cfg, importen,
    go: h => { const want = h.startsWith('#') ? h : '#' + h; if (location.hash === want) route(); else location.hash = want; },
    toast, dialog, closeDialog: () => closeDialog(), refresh: () => route(true),
    kan: p => (ROLLEN[inst.rol] || ROLLEN.behandelaar).kan.includes(p),
    mij: () => inst.naam,
    rit: c => ritVan(D, c),
    beoordeling: c => { if (!c._B || c._Bv !== c.log.length + ':' + inst.drempelVerzekeraar + inst.tariefPerKg + inst.normUurtarief + inst.meldtermijnDagen) { c._B = beoordeel(c, ritVan(D, c), inst, NU); c._Bv = c.log.length + ':' + inst.drempelVerzekeraar + inst.tariefPerKg + inst.normUurtarief + inst.meldtermijnDagen; } return c._B; },
    open: () => D.claims.filter(c => OPEN_STATUS.includes(c.status)),
    setInst: (p) => { Object.assign(inst, p); bewaarInstellingen(store, inst); if (p.thema) root.dataset.theme = p.thema === 'donker' ? 'dark' : 'light'; renderChrome(); route(true); },
    nieuweMelding: (vooraf) => nieuweMelding(ctx, vooraf),
    teLaat: c => werkdagen(c.ontvangen, NU) > inst.antwoordWerkdagen && (c.status === 'nieuw' || c.status === 'onderzoek'),
    VIEWS,
  };

  // ---------- schil ----------
  function renderChrome() {
    const nieuw = D.claims.filter(c => c.status === 'nieuw').length; const open = ctx.open().length; const laat = D.claims.filter(ctx.teLaat).length;
    const cnt = { schades: open, overzicht: laat };
    const item = (k, v) => `<a href="#${k}" data-view="${k}" ${huidig && (huidig === k || VIEWS[huidig].parent === k) ? 'aria-current="page"' : ''}>${ico(v.ic)}<span class="n">${esc(v.n)}</span>${cnt[k] ? `<span class="cnt ${k === 'overzicht' ? 'hot' : ''}" title="${k === 'overzicht' ? `${laat} over de antwoordtermijn` : `${open} open, ${nieuw} nieuw`}">${cnt[k]}</span>` : ''}</a>`;
    const groepen = {}; for (const [k, v] of Object.entries(VIEWS)) if (!v.hidden) (groepen[v.grp] = groepen[v.grp] || []).push(item(k, v));
    document.getElementById('side').innerHTML = `<div class="brand"><span class="mark" aria-hidden="true">B</span><span><b>Breedijk</b><small>Schadeportaal · demo</small></span></div><nav class="nav" aria-label="Hoofdmenu">${Object.entries(groepen).map(([g, L]) => `<div class="grp">${esc(g)}</div>${L.join('')}`).join('')}</nav><div class="side-f"><button type="button" class="btn sm" data-act="navc" title="Menu inklappen (toets [)">${ico('panel')}<span class="lbl">Inklappen</span></button></div>`;
    document.getElementById('bottombar').innerHTML = BOTTOM.map(k => { const v = VIEWS[k]; return `<a href="#${k}" ${huidig && (huidig === k || VIEWS[huidig].parent === k) ? 'aria-current="page"' : ''}>${ico(v.ic)}<span>${esc(v.n)}</span>${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ''}</a>`; }).join('');
    const rol = ROLLEN[inst.rol] || ROLLEN.behandelaar;
    document.getElementById('topbar').innerHTML = `
      <button type="button" class="ib" id="navBtn" title="Menu" data-act="navc" aria-label="Menu in- of uitklappen">${ico('menu')}</button>
      <div class="fsearch">${ico('search')}<input class="fld" id="zoek" type="search" placeholder="Zoek kenteken, dossier, chauffeur of opdrachtgever" autocomplete="off" aria-label="Zoeken" aria-expanded="false" aria-controls="popover"><span class="kbd">/</span></div>
      <span class="grow"></span>
      <span class="dag" title="De demo speelt op een vaste dag, zodat termijnen en tellers niet verlopen">${ico('cal')}<span>${esc(fmtDatumLang(NU))}</span><span class="tag">demo-dag</span></span>
      <button type="button" class="btn sm hide-m" data-act="nieuw" title="Nieuwe melding (toets n)">${ico('plus')}Nieuwe melding</button>
      <button type="button" class="ib" id="themeBtn" data-act="thema" title="Licht of donker" aria-label="Licht of donker">${ico(inst.thema === 'donker' ? 'sun' : 'moon')}</button>
      <button type="button" class="who" data-act="rol" title="Rol wisselen"><span class="av" aria-hidden="true">${esc((inst.naam || 'B').slice(0, 1).toUpperCase())}</span><span><span>${esc(inst.naam)}</span><small>${esc(rol.n)}</small></span></button>`;
    bind(document.getElementById('side'), { navc: () => { root.classList.toggle('nav-c'); root.classList.add('nav-x'); store.set('bs-nav', root.classList.contains('nav-c') ? 'c' : 'o'); } });
    bind(document.getElementById('topbar'), {
      navc: () => { root.classList.toggle('nav-c'); root.classList.add('nav-x'); store.set('bs-nav', root.classList.contains('nav-c') ? 'c' : 'o'); },
      nieuw: () => ctx.nieuweMelding(),
      thema: () => ctx.setInst({ thema: inst.thema === 'donker' ? 'licht' : 'donker' }),
      rol: () => ctx.go('instellingen'),
    });
    const z = document.getElementById('zoek');
    z.addEventListener('input', () => zoekPop(z.value)); z.addEventListener('focus', () => { if (z.value) zoekPop(z.value); });
    z.addEventListener('keydown', ev => { const pop = document.getElementById('popover'); if (pop.hidden) { if (ev.key === 'Escape') { z.value = ''; z.blur(); } return; } const items = [...pop.querySelectorAll('.pi')]; let i = items.findIndex(x => x.classList.contains('on')); if (ev.key === 'ArrowDown') { ev.preventDefault(); i = Math.min(items.length - 1, i + 1); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); i = Math.max(0, i - 1); } else if (ev.key === 'Enter') { ev.preventDefault(); (items[Math.max(0, i)] || {}).click && items[Math.max(0, i)].click(); return; } else if (ev.key === 'Escape') { sluitPop(); z.blur(); return; } else return; items.forEach((x, j) => x.classList.toggle('on', j === i)); });
    z.addEventListener('blur', () => setTimeout(sluitPop, 150));
  }
  function zoekPop(q) {
    const pop = document.getElementById('popover'); const z = document.getElementById('zoek'); const R = zoek(q, D);
    if (!q || q.trim().length < 2) { sluitPop(); return; }
    const tb = document.getElementById('topbar'); const r = z.getBoundingClientRect(); const rr = root.getBoundingClientRect();
    pop.style.left = `${r.left - rr.left}px`; pop.style.top = `${r.bottom - rr.top + 6}px`; pop.style.width = `${Math.max(300, r.width)}px`;
    pop.innerHTML = R.length ? `<div class="ph2">${R.length} ${R.length === 1 ? 'treffer' : 'treffers'}; pijltjes en Enter</div>${R.map((x, i) => `<button type="button" class="pi ${i === 0 ? 'on' : ''}" data-soort="${x.soort}" data-id="${esc(x.id)}">${ico(x.soort === 'schade' ? 'file' : x.soort === 'chauffeur' ? 'user' : x.soort === 'opdrachtgever' ? 'building' : 'car')}<span class="t">${esc(x.titel)}</span><span class="k">${x.soort === 'rit' ? 'rit' : x.soort}</span><span class="s">${esc(x.sub)}</span></button>`).join('')}` : `<div class="empty"><b>Niets gevonden</b>Zoek op kenteken (met of zonder streepjes), dossiernummer, chauffeur of opdrachtgever.</div>`;
    pop.hidden = false; z.setAttribute('aria-expanded', 'true'); void tb;
    pop.querySelectorAll('.pi').forEach(b => b.addEventListener('mousedown', ev => { ev.preventDefault(); const { soort, id } = b.dataset; sluitPop(); z.value = ''; if (soort === 'schade') ctx.go(`schade/${id}`); else if (soort === 'chauffeur') ctx.go(`chauffeur/${id}`); else if (soort === 'opdrachtgever') ctx.go(`opdrachtgever/${id}`); else if (soort === 'rit') ctx.nieuweMelding({ rit: id }); }));
    pop.querySelectorAll('.pi').forEach(b => b.addEventListener('click', () => { const { soort, id } = b.dataset; sluitPop(); z.value = ''; if (soort === 'schade') ctx.go(`schade/${id}`); else if (soort === 'chauffeur') ctx.go(`chauffeur/${id}`); else if (soort === 'opdrachtgever') ctx.go(`opdrachtgever/${id}`); else if (soort === 'rit') ctx.nieuweMelding({ rit: id }); }));
  }
  function sluitPop() { const pop = document.getElementById('popover'); pop.hidden = true; pop.innerHTML = ''; const z = document.getElementById('zoek'); if (z) z.setAttribute('aria-expanded', 'false'); }

  // ---------- meldingen en dialogen ----------
  function toast(msg, o = {}) {
    const box = document.getElementById('toasts'); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `${ico(o.icon || 'check')}<span class="grow">${esc(msg)}</span>${o.action ? `<button type="button">${esc(o.action)}</button>` : ''}<button type="button" class="ib sm" aria-label="Sluiten" style="color:inherit">${ico('x')}</button>`;
    const [act, close] = t.querySelectorAll('button'); if (o.action) act.addEventListener('click', () => { o.onAction && o.onAction(); t.remove(); }); (o.action ? close : act).addEventListener('click', () => t.remove());
    box.appendChild(t); setTimeout(() => t.remove(), o.ms || 6000);
  }
  function dialog(html, o = {}) {
    closeDialog();
    const m = document.getElementById('dialog'); m.innerHTML = `<div class="dlg ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">${html}</div>`; m.hidden = false;
    const prev = document.activeElement; const dlg = m.firstElementChild;
    const onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); closeDialog(); } if (ev.key === 'Tab') { const f = [...dlg.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return; const i = f.indexOf(document.activeElement); if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); } else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); } } };
    m.addEventListener('keydown', onKey); const onBg = ev => { if (ev.target === m && !o.vast) closeDialog(); }; m.addEventListener('mousedown', onBg);
    dlgSluit = () => { m.removeEventListener('keydown', onKey); m.removeEventListener('mousedown', onBg); m.hidden = true; m.innerHTML = ''; if (prev && prev.focus && root.contains(prev)) prev.focus(); if (o.onClose) o.onClose(); };
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog()));
    setTimeout(() => { const f = dlg.querySelector('[autofocus]') || dlg.querySelector('input,select,textarea,button'); if (f) f.focus(); }, 30);
    return dlg;
  }
  function closeDialog() { if (dlgSluit) { const f = dlgSluit; dlgSluit = null; f(); } }

  // ---------- adressen ----------
  function parse() {
    const h = location.hash.replace(/^#\/?/, ''); const [pad, qs] = h.split('?'); const [naam, ...rest] = pad.split('/');
    const q = new URLSearchParams(qs || ''); return { naam: naam || 'overzicht', id: rest.join('/') || null, q };
  }
  function route(force) {
    const { naam, id, q } = parse();
    if (naam === 'nieuw') { ctx.nieuweMelding(); history.replaceState(null, '', location.pathname + (huidig ? '#' + huidig : '')); return; }
    const v = VIEWS[naam] || VIEWS.overzicht; const key = VIEWS[naam] ? naam : 'overzicht';
    if (!force && huidig !== key) closeDialog(); sluitPop();
    for (const el of views.querySelectorAll('.view')) el.classList.toggle('on', el.id === v.el);
    const el = document.getElementById(v.el);
    const vorige = huidig; huidig = key;
    v.mod.render(el, ctx, { naam: key, id, q });
    if (vorige !== key || !force) { el.scrollTop = 0; const h1 = el.querySelector('h1'); if (h1 && vorige && vorige !== key && !force) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } }
    renderChrome();
    document.title = `${v.n === 'Dossier' && id ? id : v.n} · Schadeportaal`;
  }
  window.addEventListener('hashchange', () => route());

  // ---------- sneltoetsen ----------
  // ingebed in een site tellen de toetsen pas na een klik of focus in de app, tot er buiten de app geklikt wordt
  let inApp = !cfg.embedded;
  root.addEventListener('pointerdown', () => { inApp = true; }, true);
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) inApp = false; }, true);
  document.addEventListener('keydown', ev => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const inVeld = /^(INPUT|SELECT|TEXTAREA)$/.test((ev.target || {}).tagName) || (ev.target && ev.target.isContentEditable);
    if (cfg.embedded && !inApp && !root.contains(document.activeElement)) return;
    if (!document.getElementById('dialog').hidden) return;
    if (inVeld) { if (ev.key === 'Escape') { ev.target.blur(); } return; }
    if (ev.key === '/') { ev.preventDefault(); document.getElementById('zoek').focus(); return; }
    if (ev.key === 'n') { ev.preventDefault(); ctx.nieuweMelding(); return; }
    if (ev.key === '[') { root.classList.toggle('nav-c'); root.classList.add('nav-x'); return; }
    if (ev.key === '?') { ev.preventDefault(); sneltoetsen(); return; }
    if (ev.key === 'Escape') { if (huidig && VIEWS[huidig].parent) ctx.go(VIEWS[huidig].parent); return; }
    const k = Object.entries(VIEWS).find(([, v]) => v.key === ev.key); if (k) { ev.preventDefault(); ctx.go(k[0]); }
  });
  function sneltoetsen() {
    dialog(`<div class="dlg-h"><h2 id="dlgTitle">Sneltoetsen</h2><button type="button" class="ib" data-close aria-label="Sluiten">${ico('x')}</button></div><div class="dlg-b"><table class="tbl plain compact"><tbody>${Object.entries(VIEWS).filter(([, v]) => v.key).map(([, v]) => `<tr><td><span class="kbd">${v.key}</span></td><td>${esc(v.n)}</td></tr>`).join('')}<tr><td><span class="kbd">/</span></td><td>Zoeken</td></tr><tr><td><span class="kbd">n</span></td><td>Nieuwe melding</td></tr><tr><td><span class="kbd">[</span></td><td>Menu in- of uitklappen</td></tr><tr><td><span class="kbd">Esc</span></td><td>Sluiten, of terug naar de lijst</td></tr><tr><td><span class="kbd">?</span></td><td>Deze lijst</td></tr></tbody></table></div>`);
  }

  if (store.get('bs-nav') === 'c') { root.classList.add('nav-c'); root.classList.add('nav-x'); } else if (store.get('bs-nav') === 'o') root.classList.add('nav-x');
  renderChrome(); route();
  return { ctx, route, setView: n => ctx.go(n), toast, closeDialog, sneltoetsen };
}
