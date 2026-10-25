// Zwevende lagen: popover-menu's (bij een knop of op de plek van een rechtermuisklik), een kaartje bij het aanwijzen
// van een voertuig of oplegger, dialogen (met focus binnen de dialoog), een bevestiging (native <dialog>) en korte
// meldingen (toasts, aria-live polite). Plaatsen gaat met Floating UI (MIT): onder of boven de knop, klapt om aan de
// rand, schuift binnen de app en krimpt als er te weinig hoogte is; zolang een laag open is, volgt hij bij scrollen.
// Alles staat binnen de app-root, zodat de app ook ingebed in een andere pagina werkt (contain: layout op .slct).
import { computePosition, autoUpdate, offset, flip, shift, size } from '@floating-ui/dom';
import { ic, esc } from './base.js';

export function createLayers(root) {
  const pop = root.querySelector('#popover'), dlg = root.querySelector('#dialog'), toasts = root.querySelector('#toasts');
  let popTrigger = null, popOnClose = null, dlgReturn = null, dlgOnClose = null, stopAuto = null;
  const focusables = el => [...el.querySelectorAll('button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);

  // ---------- plaatsen ----------
  const mw = pad => [offset(6), flip({ padding: pad, fallbackAxisSideDirection: 'start' }), shift({ padding: pad }), size({ padding: pad, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(160, Math.min(520, Math.floor(availableHeight)))}px`; } })];
  function place(ref, el, placement) {
    return computePosition(ref, el, { placement, strategy: 'absolute', middleware: mw(8) }).then(({ x, y, placement: p }) => { el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; el.dataset.side = p.split('-')[0]; });
  }
  // een punt (rechtermuisklik) als anker
  const punt = (x, y) => ({ getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) });
  // een element vastmaken aan een anker dat meebeweegt (het kaartje bij een voertuig op de kaart: mapApi.anchor rijdt
  // mee met het voertuig): elk beeld opnieuw geplaatst, rechts ernaast, klapt om aan de rand en schuift binnen de kaart.
  // Geeft een functie die het vastmaken weer stopt.
  function pinTo(el, ref, placement = 'right-start') {
    const upd = () => computePosition(ref, el, { placement, strategy: 'absolute', middleware: [offset(14), flip({ padding: 8, fallbackPlacements: ['left-start', 'bottom-start', 'top-start'] }), shift({ padding: 8 })] })
      .then(({ x, y, placement: p }) => { el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; el.dataset.side = p.split('-')[0]; });
    upd(); return autoUpdate(ref, el, upd, { animationFrame: true });
  }

  // ---------- popover ----------
  function openPop(trigger, html, { onBind, align = 'left', cls = '', label = '', onClose, focus = true, at = null } = {}) {
    if (trigger && popTrigger === trigger && !pop.hidden) { closePop(); return null; }
    closePop(false);
    pop.className = `pop ${cls}`; pop.innerHTML = html; pop.hidden = false; pop.setAttribute('role', 'dialog'); if (label) pop.setAttribute('aria-label', label); else pop.removeAttribute('aria-label');
    pop.style.left = '0px'; pop.style.top = '0px'; pop.style.maxHeight = '';
    popTrigger = trigger; popOnClose = onClose || null; if (trigger) trigger.setAttribute('aria-expanded', 'true');
    if (onBind) onBind(pop);
    const ref = at ? punt(at.x, at.y) : trigger; const placement = at ? 'bottom-start' : align === 'right' ? 'bottom-end' : 'bottom-start';
    if (ref) { const upd = () => place(ref, pop, placement); upd(); if (!at && trigger && trigger.isConnected) stopAuto = autoUpdate(trigger, pop, upd, { animationFrame: false }); }
    if (focus) { const f = pop.querySelector('[autofocus]') || pop.querySelector('.menu-i.on') || focusables(pop)[0]; if (f) f.focus({ preventScroll: true }); }
    return pop;
  }
  function closePop(restore = true) {
    if (stopAuto) { stopAuto(); stopAuto = null; }
    if (pop.hidden) return; pop.hidden = true; pop.innerHTML = '';
    const t = popTrigger; popTrigger = null; if (t) t.setAttribute('aria-expanded', 'false');
    const cb = popOnClose; popOnClose = null; if (cb) cb();
    if (restore && t && t.isConnected) t.focus({ preventScroll: true });
  }
  const repositionPop = align => { if (!pop.hidden && popTrigger && popTrigger.isConnected) place(popTrigger, pop, align === 'right' ? 'bottom-end' : 'bottom-start'); };
  // contextmenu: een lijst acties op de plek van de klik (of bij het element, met het toetsenbord)
  function menuAt(target, items, { x, y, label = 'Acties' } = {}) {
    const L = items.filter(Boolean); if (!L.length) return null;
    const r = target.getBoundingClientRect(); const at = x !== undefined ? { x, y } : { x: r.left + 12, y: r.bottom - 4 };
    return openPop(null, `<div class="menu-h">${esc(label)}</div>${L.map((it, i) => it.sep ? '<div class="menu-sep"></div>' : `<button class="menu-i" type="button" role="menuitem" data-mi="${i}" ${it.disabled ? 'disabled' : ''}>${ic(it.icon || 'chev', 16)}<span class="grow">${esc(it.l)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}`, {
      at, label, onClose: () => { if (target.isConnected) target.focus({ preventScroll: true }); }, onBind: p => p.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = L[+b.dataset.mi]; closePop(false); if (it && it.run) it.run(); }),
    });
  }
  root.addEventListener('pointerdown', e => { if (pop.hidden) return; if (pop.contains(e.target) || (popTrigger && popTrigger.contains(e.target))) return; closePop(false); }, true);
  pop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePop(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...pop.querySelectorAll('.menu-i:not([disabled]),.sg-item')]; if (!items.length) return; e.preventDefault();
      const i = items.indexOf(document.activeElement); const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length; items[n].focus();
    }
  });
  pop.addEventListener('focusout', e => { if (!pop.hidden && e.relatedTarget && !pop.contains(e.relatedTarget) && !(popTrigger && popTrigger.contains(e.relatedTarget))) closePop(false); });

  // ---------- kaartje bij aanwijzen (voertuig, oplegger) ----------
  // Elementen met data-hc="<id>" krijgen na een korte pauze een kaartje; de inhoud levert de app (setHover). Alleen met
  // een muis; het kaartje is een extra, alles staat ook op de pagina zelf.
  const card = document.createElement('div'); card.className = 'hcard'; card.hidden = true; card.setAttribute('role', 'tooltip'); card.id = 'hcard'; root.appendChild(card);
  let hcFn = null, hcNa = null, hcEl = null, hcTimer = 0, hcStop = null;
  const hideCard = () => { clearTimeout(hcTimer); if (hcStop) { hcStop(); hcStop = null; } if (hcEl) hcEl.removeAttribute('aria-describedby'); hcEl = null; card.hidden = true; card.innerHTML = ''; };
  root.addEventListener('pointerover', e => {
    if (!hcFn || e.pointerType !== 'mouse') return; const a = e.target.closest && e.target.closest('[data-hc]'); if (a === hcEl) return;
    hideCard(); if (!a || !root.contains(a)) return; hcEl = a;
    hcTimer = setTimeout(() => { if (hcEl !== a || !a.isConnected) return; const h = hcFn(a.dataset.hc); if (!h) return; card.innerHTML = h; card.hidden = false; if (hcNa) hcNa(card); card.style.left = '0px'; card.style.top = '0px'; a.setAttribute('aria-describedby', 'hcard'); const upd = () => computePosition(a, card, { placement: 'top', strategy: 'absolute', middleware: mw(8) }).then(({ x, y }) => { card.style.left = `${Math.round(x)}px`; card.style.top = `${Math.round(y)}px`; }); upd(); hcStop = autoUpdate(a, card, upd, { animationFrame: false }); }, 420);
  });
  root.addEventListener('pointerout', e => { if (hcEl && !(e.relatedTarget && hcEl.contains(e.relatedTarget))) hideCard(); });
  root.addEventListener('pointerdown', hideCard, true);
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) hideCard(); }, true);
  // fn(id) geeft de inhoud; na(kaartje) daarna, bijvoorbeeld om een portret te laden
  const setHover = (fn, na) => { hcFn = fn; hcNa = na || null; };

  // ---------- dialoog ----------
  function openDialog(html, { onBind, onClose, wide = false, label = '' } = {}) {
    dlgReturn = document.activeElement; dlgOnClose = onClose || null;
    dlg.innerHTML = `<div class="dlg ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" ${label ? `aria-label="${esc(label)}"` : ''}>${html}</div>`; dlg.hidden = false;
    if (onBind) onBind(dlg.firstElementChild);
    const f = dlg.querySelector('[autofocus]') || focusables(dlg)[0]; if (f) f.focus({ preventScroll: true });
    return dlg.firstElementChild;
  }
  function closeDialog() { if (dlg.hidden) return; dlg.hidden = true; dlg.innerHTML = ''; const cb = dlgOnClose; dlgOnClose = null; if (cb) cb(); if (dlgReturn && dlgReturn.isConnected) dlgReturn.focus({ preventScroll: true }); dlgReturn = null; }
  dlg.addEventListener('pointerdown', e => { if (e.target === dlg) closeDialog(); });
  dlg.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDialog(); });
  // focus blijft in een open dialoog (en in de wizard, die dezelfde opbouw heeft)
  root.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return; const box = !dlg.hidden ? dlg : !root.querySelector('#wizard').hidden ? root.querySelector('#wizard') : null; if (!box) return;
    const f = focusables(box); if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  // ---------- bevestigen (native <dialog>: modaal, Esc sluit, focus blijft erin) ----------
  // confirm({ title, text, ok, cancel, danger }) geeft een Promise met true (bevestigd) of false
  function confirm({ title, text = '', ok = 'Doorgaan', cancel = 'Annuleren', danger = false }) {
    return new Promise(resolve => {
      const d = document.createElement('dialog'); d.className = 'cfm';
      d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}<div class="cfm-a"><button class="btn" value="nee" type="submit">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'pri'}" value="ja" type="submit" autofocus>${esc(ok)}</button></div></form>`;
      const back = document.activeElement; root.appendChild(d);
      d.addEventListener('close', () => { const v = d.returnValue === 'ja'; d.remove(); if (back && back.isConnected) back.focus({ preventScroll: true }); resolve(v); });
      d.addEventListener('click', e => { if (e.target === d) d.close('nee'); });
      try { d.showModal(); } catch { d.setAttribute('open', ''); }
    });
  }

  // ---------- toasts ----------
  function toast(msg, { icon = 'check', action = '', onAction = null, ms = 0 } = {}) {
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = `${ic(icon, 16)}<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
    let gone = false; const close = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    if (action && onAction) el.querySelector('button').addEventListener('click', () => { onAction(); close(); });
    toasts.appendChild(el); while (toasts.children.length > 3) toasts.firstElementChild.remove();
    setTimeout(close, ms || (action ? 8000 : 5000));
    return close;
  }
  return { openPop, closePop, repositionPop, menuAt, pinTo, popOpen: () => !pop.hidden, popEl: pop, openDialog, closeDialog, dialogOpen: () => !dlg.hidden, confirm, toast, setHover, hideCard };
}
