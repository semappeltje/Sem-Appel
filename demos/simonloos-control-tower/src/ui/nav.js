// Navigatie: de linkerbalk (icoon en naam per onderdeel, in groepen, inklapbaar), de topbalk (titel, zoeken, werkgebied,
// rol, klok van de simulatie, assistent, meldingenbel, thema en gebruiker) en op een telefoon de onderbalk met vijf
// hoofdonderdelen en "Meer". De menu's zijn popovers (pijltjestoetsen, Esc, klik ernaast sluit).
import { esc, ic, fmt, hhmm, on, initials, SOORT } from './base.js';
import { ROLES } from '../places.js';
import logo from '../assets/logo.png';
import { openIn } from './openritten.js';

export const NAV = [
  { g: '', items: [['overzicht', 'Overzicht', 'dash'], ['kaart', 'Kaart', 'map'], ['ritten', 'Ritten', 'route'], ['meldingen', 'Meldingen', 'alert'], ['openritten', 'Open ritten', 'inbox'], ['planbord', 'Planbord', 'gantt']] },
  { g: 'Vloot', items: [['voertuigen', 'Voertuigen', 'truck'], ['opleggers', 'Opleggers', 'trailer'], ['chauffeurs', 'Chauffeurs', 'users'], ['charters', 'Charters en oproep', 'contact']] },
  { g: 'Locaties', items: [['standplaatsen', 'Standplaatsen', 'depot'], ['laden', 'Laden', 'bolt'], ['lostijden', 'Lostijden', 'timer'], ['pauze', 'Pauzeplekken', 'coffee']] },
  { g: 'Analyse', items: [['rapporten', 'Rapporten', 'bars'], ['instellingen', 'Instellingen', 'settings']] },
];
export const VIEWS = NAV.flatMap(g => g.items);
export const VIEW_NAME = Object.fromEntries(VIEWS.map(v => [v[0], v[1]]));
export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
export const BOTTOM = ['overzicht', 'kaart', 'openritten', 'meldingen'];
export const ROLDESC = { planner: 'Ritten, planbord, berichten en bevoegdheden', regiomanager: 'Plus schades en kosten per km', directie: 'Alles, ook contract en kosten; kijkt mee, handelt niet af', hr: 'Personeel: bevoegdheden, schades en contract' };

export function createNav(ctx) {
  const { $ } = ctx;
  const locked = v => v === 'planbord' && !ctx.can('planbord');
  // de knop van de Assistent staat aan als je hem ziet (niet als hij onder een pagina ligt)
  const assistZicht = () => ctx.panelMode() === 'assist' && ctx.panelOpen() && !ctx.paneelOnder();
  // open ritten van vandaag in het werkgebied (de teller bij Open ritten; geen alarmkleur, het is werkvoorraad)
  const openNu = () => { try { return openIn(ctx).filter(p => p.dag !== 'morgen').length; } catch { return 0; } };
  function renderSide() {
    const c = ctx.Z.counts(); const cur = ctx.navCurrent(); const no = openNu();
    const item = ([k, n, icon], i) => { const key = KEYS[VIEWS.findIndex(v => v[0] === k)]; const lk = locked(k); const cnt = k === 'meldingen' && c.open ? `<span class="nc" aria-label="${c.open} open">${fmt(c.open)}</span><i class="dotc" aria-hidden="true"></i>` : k === 'openritten' && no ? `<span class="nc n2" aria-label="${no} open vandaag">${fmt(no)}</span><i class="dotc n2" aria-hidden="true"></i>` : '';
      return `<button class="nav-i ${cur === k ? 'on' : ''}" type="button" data-nav="${k}" ${cur === k ? 'aria-current="page"' : ''} ${lk ? 'aria-disabled="true"' : ''} title="${esc(n)}${key ? ` (toets ${key})` : ''}${lk ? ', niet voor jouw rol' : ''}">${ic(icon, 18)}<span class="tx">${esc(n)}</span>${lk ? ic('lock', 13, 'lock') : cnt}</button>`; };
    const h = `<div class="side-head"><img src="${logo}" alt="Simon Loos"><span>Control Tower</span></div><div class="side-nav">${NAV.map(g => `<div class="nav-g">${g.g ? `<div class="nav-gl">${esc(g.g)}</div>` : ''}${g.items.map(item).join('')}</div>`).join('')}</div>
      <div class="side-foot"><button class="nav-i" type="button" id="navCollapse" aria-pressed="${ctx.root.classList.contains('nav-c')}" title="${ctx.root.classList.contains('nav-c') ? 'Menu uitklappen' : 'Menu inklappen'} ([)">${ic('sidebar', 18)}<span class="tx">Menu inklappen</span></button></div>`;
    const el = $('side'); if (el.dataset.h !== h) { const f = el.contains(document.activeElement) ? document.activeElement.dataset.nav || document.activeElement.id : null; el.innerHTML = h; el.dataset.h = h; if (f) { const x = el.querySelector(`[data-nav="${f}"]`) || el.querySelector('#' + f); if (x) x.focus({ preventScroll: true }); } }
  }
  function renderBottom() {
    const c = ctx.Z.counts(); const cur = ctx.navCurrent(); const no = openNu();
    const h = `${BOTTOM.map(k => { const v = VIEWS.find(x => x[0] === k); return `<button class="bb-i ${cur === k ? 'on' : ''}" type="button" data-nav="${k}" ${cur === k ? 'aria-current="page"' : ''}>${ic(v[2], 20)}<span>${esc(v[1])}</span>${k === 'meldingen' && c.open ? `<span class="cnt">${fmt(c.open)}</span>` : k === 'openritten' && no ? `<span class="cnt n2">${fmt(no)}</span>` : ''}</button>`; }).join('')}<button class="bb-i ${!BOTTOM.includes(cur) ? 'on' : ''}" type="button" id="bbMore" aria-haspopup="true">${ic('menu', 20)}<span>Meer</span></button>`;
    const el = $('bottombar'); if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
  }
  // ---------- de topbalk past altijd ----------
  // Wat er niet in past, valt weg in een vaste volgorde en nooit half. Eerst rechts, tegen een vaste ruimte voor de titel
  // die alleen van de breedte afhangt, zodat de knoppen rechts niet verspringen als je van weergave wisselt: een smaller
  // zoekveld (met een kortere tekst erin), het label van de rol, de snelheid bij de klok, het label van het werkgebied (dat
  // staat meestal ook in de ondertitel), het woord bij de chip van de oefendag (de chip blijft, met het icoon en de uitleg
  // bij aanwijzen) en het kleinste zoekveld; daarna gaat een eerdere stap terug als een latere hem overbodig maakte. Dan
  // de titel zelf: de ondertitel en de titel elk in hun korte vorm als de lange afbreekt. Breekt er dan nog iets af, dan
  // de overige stappen rechts; pas daarna breekt een lange titel af met een ellips. De tekst in het zoekveld past zich aan
  // zijn breedte aan.
  // Gemeten na elke wijziging van de kop of de labels, en bij elke andere maat van de topbalk (ook ingebed).
  const RECHTS = ['k-zoek', 'k-rol', 'k-snel', 'k-wg', 'k-oef', 'k-zoek2'];
  const LINKS = ['k-sub', 'k-titel'];
  const STAPPEN = [...RECHTS, ...LINKS];
  // de ruimte die de titel minstens houdt als rechts zich aanpast: ongeveer een vijfde van de topbalk, 110 tot 240 px
  const titelRuimte = w => Math.max(110, Math.min(240, Math.round(w * 0.185)));
  const ZOEK = ['Zoek voertuig, oplegger, chauffeur, plaats', 'Zoek voertuig, chauffeur, plaats', 'Zoek voertuig of plaats', 'Zoeken'];
  let pasSig = '', kort = false, ro = null, meet = null;
  const kapt = x => !!x && x.getClientRects().length > 0 && x.scrollWidth > x.clientWidth + 0.5;
  // rechts: geen label dat afbreekt en niets dat rechts uit de balk valt
  function rechtsPast(tb) {
    for (const x of tb.querySelectorAll('.tbtn .tx, #oefenChip, .clock')) if (kapt(x)) return false;
    const R = tb.getBoundingClientRect(); let rechts = 0;
    for (const x of tb.querySelectorAll('.top-r > *')) { const r = x.getBoundingClientRect(); if (r.width) rechts = Math.max(rechts, r.right); }
    return rechts <= R.right + 0.5;
  }
  function past(tb) {
    const tt = tb.querySelector('.top-t');
    return !kapt(tt.querySelector('#vtitle')) && !kapt(tt.querySelector('#vsub')) && rechtsPast(tb);
  }
  // een stap aan of uit; de korte ondertitel en de korte titel wisselen de tekst (zonder korte vorm: geen stap)
  function stap(tb, tt, s, aan) {
    if (s === 'k-sub' || s === 'k-titel') {
      const k = s === 'k-sub' ? tt.dataset.sk : tt.dataset.hk; if (!k) return false;
      if (tb.classList.contains(s) === aan) return true;
      if (s === 'k-sub') tt.querySelector('#vsub').innerHTML = aan ? k : tt.dataset.sl; else tt.querySelector('#vtitle').textContent = aan ? k : tt.dataset.hl;
    }
    tb.classList.toggle(s, aan); return true;
  }
  // een ronde: stappen uit L een voor een aan tot ok(), dan elke eerdere terug als ok() zonder hem ook geldt
  function ronde(tb, tt, L, ok) {
    const aan = [];
    for (const s of L) { if (ok()) break; if (stap(tb, tt, s, true)) aan.push(s); }
    for (const s of aan.slice(0, -1)) { stap(tb, tt, s, false); if (!ok()) stap(tb, tt, s, true); }
  }
  // de titel zelf: de ondertitel en de titel elk in hun korte vorm als de lange afbreekt (de ruimte van de titel hangt niet
  // af van zijn tekst, dus ze zijn los te kiezen)
  function kortWaarNodig(tb, tt) {
    for (const [s, sel] of [['k-sub', '#vsub'], ['k-titel', '#vtitle']]) { stap(tb, tt, s, false); if (kapt(tt.querySelector(sel))) stap(tb, tt, s, true); }
  }
  function pasIn() {
    const tb = $('topbar'); const tt = tb && tb.querySelector('.top-t'); if (!tt) return;
    tb.classList.remove(...STAPPEN); if (kort) { tt.innerHTML = tt.dataset.h; kort = false; }
    // 1. rechts, met de titel op precies zijn vaste ruimte; 2. de titel zelf, die vanaf die ruimte groeit; 3. breekt er
    // dan nog iets af, de overige stappen rechts
    const b = titelRuimte(tb.clientWidth);
    tt.style.flex = `0 0 ${b}px`;
    try { ronde(tb, tt, RECHTS, () => rechtsPast(tb)); } finally { tt.style.flex = `1 1 ${b}px`; }
    ronde(tb, tt, RECHTS.filter(s => !tb.classList.contains(s)), () => { kortWaarNodig(tb, tt); return past(tb); });
    kortWaarNodig(tb, tt);
    kort = tb.classList.contains('k-sub') || tb.classList.contains('k-titel');
    zoektekst();
  }
  function zoektekst() {
    const i = $('zoekIn'); if (!i || !i.getClientRects().length) return;
    if (!meet) meet = document.createElement('canvas').getContext('2d'); if (!meet) return;
    const cs = getComputedStyle(i); const ruimte = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    meet.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const t = ZOEK.find(x => meet.measureText(x).width <= ruimte - 2) || ZOEK[ZOEK.length - 1];
    if (i.placeholder !== t) i.placeholder = t;
  }
  function volgMaat(el) {
    if (ro || typeof ResizeObserver !== 'function') return;
    ro = new ResizeObserver(() => pasIn()); ro.observe(el);
    // op een telefoon is het zoekveld verborgen tot je het opent; dan krijgt het de tekst die past
    const i = $('zoekIn'); if (i) i.addEventListener('focus', zoektekst);
  }
  function renderTop() {
    const t = ctx.title(); const c = ctx.Z.counts(); const st = ctx.state; const rn = ROLES[ctx.role()].n; const sc = ctx.scopeLabel(); const oef = ctx.fleet.scenario;
    const h = `<div class="top-t"><h1 id="vtitle">${esc(t.h)}</h1><div class="crumb" id="vsub">${t.sub}</div></div>
      <div class="top-r"><div class="zoek" id="zoek" role="search"></div><span class="vsep"></span>
        <button class="tbtn" type="button" id="wgBtn" aria-haspopup="true" aria-expanded="false" title="Werkgebied en opgeslagen weergaven" aria-label="Werkgebied: ${esc(sc)}">${ic('pin', 16)}<span class="tx">${esc(sc)}</span>${ic('chevd', 14, 'chev')}</button>
        <button class="tbtn" type="button" id="roleBtn" aria-haspopup="true" aria-expanded="false" title="Bekijk als" aria-label="Bekijk als: ${esc(rn)}">${ic('idcard', 16)}<span class="tx opt">${esc(rn)}</span>${ic('chevd', 14, 'chev')}</button>
        ${oef ? `<button class="badge b-info" type="button" id="oefenChip" data-open="view:instellingen" title="${esc(oef.naam)}: alles is gesimuleerd. Uitzetten onder Instellingen." aria-label="${esc(oef.naam)}, gesimuleerd. Uitzetten onder Instellingen.">${ic('activity', 13)}<span class="tx">${esc(oef.kort)}</span></button>` : ''}
        <button class="clock ${st.playing ? '' : 'paused'}" type="button" id="clockBtn" aria-haspopup="true" aria-expanded="false" title="Simulatie: tijd en snelheid"><i aria-hidden="true"></i><b id="clock">${hhmm(st.simTime)}</b><small class="tx opt">${st.playing ? `${st.speed}×` : 'pauze'}</small></button>
        <span class="vsep"></span>
        <button class="ib ${assistZicht() ? 'on' : ''}" type="button" id="assistBtn" title="Assistent (a)" aria-label="Assistent">${ic('spark', 18)}</button>
        <button class="ib" type="button" id="bellBtn" aria-haspopup="true" aria-expanded="false" title="Meldingen (m)" aria-label="Meldingen, ${c.open} open">${ic('bell', 18)}<span class="cnt" id="bellCnt" ${c.open ? '' : 'hidden'}>${fmt(c.open)}</span></button>
        <button class="ib hide-m" type="button" id="themeBtn" title="${ctx.theme() === 'dark' ? 'Licht thema' : 'Donker thema'}" aria-label="${ctx.theme() === 'dark' ? 'Licht thema' : 'Donker thema'}">${ic(ctx.theme() === 'dark' ? 'sun2' : 'moon', 18)}</button>
        <button class="ib" type="button" id="userBtn" aria-haspopup="true" aria-expanded="false" title="${esc(ctx.A.settings.naam())}" aria-label="Gebruikersmenu">${`<span class="av sm ink">${esc(initials(ctx.A.settings.naam()))}</span>`}</button></div>`;
    const el = $('topbar');
    if (!el.querySelector('.top-t')) { el.innerHTML = h; ctx.mountSearch($('zoek')); el.dataset.sig = ''; volgMaat(el); }
    // alleen wat verandert bijwerken (het zoekveld blijft staan, ook als je typt)
    const tt = el.querySelector('.top-t'); const th = `<h1 id="vtitle">${esc(t.h)}</h1><div class="crumb" id="vsub">${t.sub}</div>`;
    if (tt.dataset.h !== th) { tt.innerHTML = th; tt.dataset.h = th; kort = false; }
    tt.dataset.hl = t.h; tt.dataset.sl = t.sub; tt.dataset.hk = t.hKort || ''; tt.dataset.sk = t.subKort || '';
    const wg = $('wgBtn').querySelector('.tx'); if (wg.textContent !== sc) { wg.textContent = sc; $('wgBtn').setAttribute('aria-label', `Werkgebied: ${sc}`); }
    const rl = $('roleBtn').querySelector('.tx'); if (rl.textContent !== rn) { rl.textContent = rn; $('roleBtn').setAttribute('aria-label', `Bekijk als: ${rn}`); }
    updateClock();
    // opnieuw passen als de kop, een label, de snelheid of het aantal knoppen veranderde (de maat volgt volgMaat)
    const sig = [th, t.hKort || '', t.subKort || '', sc, rn, st.playing ? st.speed : 'p', el.querySelectorAll('.top-r > *').length].join('|');
    if (sig !== pasSig) { pasSig = sig; pasIn(); }
    const bc = $('bellCnt'); bc.hidden = !c.open; bc.textContent = fmt(c.open); $('bellBtn').setAttribute('aria-label', `Meldingen, ${c.open} open`);
    const ab = $('assistBtn'); ab.classList.toggle('on', assistZicht());
    const tb = $('themeBtn'); const dark = ctx.theme() === 'dark'; const want = dark ? 'Licht thema' : 'Donker thema'; if (tb.title !== want) { tb.title = want; tb.setAttribute('aria-label', want); tb.innerHTML = ic(dark ? 'sun2' : 'moon', 18); }
    const ub = $('userBtn'); const ini = initials(ctx.A.settings.naam()); if (ub.textContent !== ini) ub.innerHTML = `<span class="av sm ink">${esc(ini)}</span>`;
  }
  function updateClock() { const st = ctx.state; const b = $('clockBtn'); if (!b) return; b.classList.toggle('paused', !st.playing); const c = $('clock'); const v = hhmm(st.simTime); if (c.textContent !== v) c.textContent = v; const s = b.querySelector('small'); const sv = st.playing ? `${st.speed}×` : 'pauze'; if (s.textContent !== sv) s.textContent = sv; }

  // ---------- menu's ----------
  function wgMenu(b) {
    const saved = ctx.savedViews(); const p = ctx.profile();
    ctx.L.openPop(b, `<div class="menu-h"><b>Werkgebied</b>${esc(ctx.scopeLabel())} · ${esc(ctx.divLabel())}</div>
      <button class="menu-i" type="button" data-wg="wizard">${ic('settings', 16)}<span class="grow">Werkgebied wijzigen<small>Regio's, ritten, rol en standplaats${p && p.sp ? ` (nu ${esc(p.sp)})` : ''}</small></span></button>
      ${ctx.F.sps.size ? `<button class="menu-i" type="button" data-wg="nl">${ic('map', 16)}<span class="grow">Toon heel ${esc(ctx.F.regios.size ? 'je regio' : 'Nederland')}<small>De standplaatsselectie loslaten</small></span></button>` : ''}
      <div class="menu-sep"></div><div class="menu-h">Opgeslagen weergaven</div>
      ${saved.length ? saved.map((v, i) => `<div style="display:flex;align-items:center"><button class="menu-i" type="button" data-vapply="${i}">${ic('eye', 16)}<span class="grow">${esc(v.name)}<small>${esc(v.scope)}</small></span></button><button class="ib sm" type="button" data-vdel="${i}" aria-label="Verwijder ${esc(v.name)}" title="Verwijderen">${ic('trash', 15)}</button></div>`).join('') : '<div class="menu-h" style="font-weight:400">Nog geen opgeslagen weergaven. Bewaar je werkgebied, filters en kaartpositie onder een naam.</div>'}
      <div class="menu-f" data-wgsave><button class="btn sm" type="button" data-wg="save">${ic('plus', 15)}Huidige weergave opslaan</button></div>`, {
      label: 'Werkgebied', onBind: pop => {
        on(pop, 'click', '[data-wg]', (e, x) => {
          const k = x.dataset.wg;
          if (k === 'wizard') { ctx.L.closePop(false); ctx.openWizard(1); }
          else if (k === 'nl') { ctx.L.closePop(); ctx.clearSps(); }
          else if (k === 'save') {
            const box = pop.querySelector('[data-wgsave]'); box.innerHTML = `<label class="sr" for="saveName">Naam van de weergave</label><input class="fld sm" id="saveName" style="flex:1" value="${esc(`${ctx.scopeLabel()} ${hhmm(ctx.state.simTime)}`)}" autocomplete="off"><button class="btn sm pri" type="button" id="saveOk">Opslaan</button>`;
            const i = pop.querySelector('#saveName'); i.focus(); i.select();
            const save = () => { const name = i.value.trim(); if (!name) return; ctx.saveView(name); ctx.L.closePop(); };
            pop.querySelector('#saveOk').addEventListener('click', save); i.addEventListener('keydown', ev => { if (ev.key === 'Enter') save(); });
          }
        });
        on(pop, 'click', '[data-vapply]', (e, x) => { const v = saved[+x.dataset.vapply]; ctx.L.closePop(); ctx.applyView(v); });
        on(pop, 'click', '[data-vdel]', (e, x) => { ctx.deleteView(+x.dataset.vdel); ctx.L.closePop(); wgMenu(b); });
      },
    });
  }
  function roleMenu(b) {
    ctx.L.openPop(b, `<div class="menu-h">Bekijk als</div>${Object.entries(ROLES).map(([k, r]) => `<button class="menu-i ${ctx.role() === k ? 'on' : ''}" type="button" role="menuitemradio" aria-checked="${ctx.role() === k}" data-role="${k}">${ic('check', 16, 'chk2')}<span class="grow">${esc(r.n)}<small>${esc(ROLDESC[k])}</small></span></button>`).join('')}<div class="menu-h" style="font-weight:400;max-width:300px">De rol bepaalt wat je ziet op voertuig- en chauffeurspagina's en wie meldingen mag afhandelen.</div>`, {
      align: 'right', label: 'Rol', onBind: pop => on(pop, 'click', '[data-role]', (e, x) => { ctx.L.closePop(); ctx.setRole(x.dataset.role); }),
    });
  }
  function clockMenu(b) {
    const st = ctx.state;
    const html = () => `<div class="menu-h"><b>Simulatie</b>De klok van de gesimuleerde dag; de kaart, ritten en meldingen volgen hem.</div>
      <div style="padding:6px 10px;display:flex;flex-direction:column;gap:10px;min-width:300px">
        <div style="display:flex;align-items:center;gap:10px"><button class="ib bd" type="button" data-sim="play" aria-label="${st.playing ? 'Pauzeer' : 'Speel af'}">${ic(st.playing ? 'pause' : 'play', 16)}</button><b style="font-size:20px" data-simclock>${hhmm(st.simTime)}</b><button class="btn sm" type="button" data-sim="nu" style="margin-left:auto">Terug naar nu</button></div>
        <label class="sr" for="scrub2">Tijd van vandaag</label><input type="range" id="scrub2" min="0" max="1439" step="1" value="${Math.floor(st.simTime)}" style="accent-color:var(--brand);width:100%">
        <div class="seg" role="group" aria-label="Snelheid">${[1, 12, 60, 300].map(s => `<button type="button" data-speed="${s}" aria-pressed="${st.speed === s}">${s}×</button>`).join('')}</div></div>`;
    ctx.L.openPop(b, html(), {
      align: 'right', label: 'Simulatie', onBind: pop => {
        on(pop, 'click', '[data-sim]', (e, x) => { if (x.dataset.sim === 'play') ctx.setPlaying(!st.playing); else ctx.setNow(); pop.innerHTML = html(); });
        on(pop, 'click', '[data-speed]', (e, x) => { ctx.setSpeed(+x.dataset.speed); pop.querySelectorAll('[data-speed]').forEach(y => y.setAttribute('aria-pressed', +y.dataset.speed === st.speed)); });
        on(pop, 'input', '#scrub2', (e, x) => { ctx.setTime(+x.value); const c = pop.querySelector('[data-simclock]'); if (c) c.textContent = hhmm(st.simTime); });
      },
    });
  }
  function bellMenu(b) {
    const L = ctx.Z.open().slice(0, 6); const c = ctx.Z.counts();
    ctx.L.openPop(b, `<div class="menu-h"><b>Meldingen</b>${fmt(c.open)} open${c.verlopen ? `, ${fmt(c.verlopen)} over de norm` : ''} · ${fmt(c.wacht)} wacht</div>${L.length ? L.map(z => `<button class="menu-i" type="button" data-open="melding/${esc(z.id)}">${ic(SOORT[z.kind].icon, 16, z.sev === 'bad' ? 'tbad' : 'twarn')}<span class="grow">${esc(z.kind)} · <span class="nowrap">${esc(z.obj)}</span><small>${esc(z.text)}</small></span><small class="${z.sla >= 1 ? 'tbad' : ''}">${Math.round(z.age)} min</small></button>`).join('') : '<div class="menu-h" style="font-weight:400">Geen open meldingen in je werkgebied.</div>'}<div class="menu-f"><button class="btn sm" type="button" data-open="view:meldingen" style="flex:1">Alle meldingen</button></div>`, {
      align: 'right', label: 'Meldingen', // eerst naar de zaak, dan dicht: het sluiten leegt de popover, en de algemene klik vindt de knop daarna niet meer in de app
      onBind: pop => on(pop, 'click', '[data-open]', (e, x) => { const k = x.dataset.open; e.preventDefault(); ctx.L.closePop(false); ctx.go(k); }),
    });
  }
  function userMenu(b) {
    ctx.L.openPop(b, `<div class="menu-h"><b>${esc(ctx.A.settings.naam())}</b>${esc(ROLES[ctx.role()].n)} · ${esc(ctx.scopeLabel())}</div>
      <button class="menu-i" type="button" data-u="set">${ic('settings', 16)}<span class="grow">Instellingen</span></button>
      <button class="menu-i" type="button" data-u="keys">${ic('keyboard', 16)}<span class="grow">Sneltoetsen</span><span class="kbd">?</span></button>
      <button class="menu-i" type="button" data-u="theme">${ic(ctx.theme() === 'dark' ? 'sun2' : 'moon', 16)}<span class="grow">${ctx.theme() === 'dark' ? 'Licht thema' : 'Donker thema'}</span></button>
      <button class="menu-i" type="button" data-u="wg">${ic('pin', 16)}<span class="grow">Werkgebied wijzigen</span></button>
      <div class="menu-sep"></div><div class="menu-h" style="font-weight:400;max-width:280px">Gesimuleerde demo. Voertuigen, chauffeurs, ritten en tijden zijn verzonnen; wegen, water en standplaatsen zijn echt.</div>`, {
      align: 'right', label: 'Gebruiker', onBind: pop => on(pop, 'click', '[data-u]', (e, x) => { const k = x.dataset.u; ctx.L.closePop(k !== 'wg' && k !== 'keys'); if (k === 'set') ctx.go('view:instellingen'); else if (k === 'keys') ctx.showKeys(); else if (k === 'theme') ctx.toggleTheme(); else ctx.openWizard(1); }),
    });
  }
  function moreMenu(b) {
    const cur = ctx.navCurrent();
    ctx.L.openPop(b, `<div class="menu-h">Alle onderdelen</div>${VIEWS.filter(v => !BOTTOM.includes(v[0])).map(([k, n, icon]) => `<button class="menu-i ${cur === k ? 'on' : ''}" type="button" data-nav="${k}">${ic(icon, 18)}<span class="grow">${esc(n)}</span>${locked(k) ? ic('lock', 14) : ''}</button>`).join('')}<div class="menu-sep"></div>
      <button class="menu-i" type="button" data-m="wg">${ic('pin', 18)}<span class="grow">Werkgebied<small>${esc(ctx.scopeLabel())}</small></span></button>
      <button class="menu-i" type="button" data-m="role">${ic('idcard', 18)}<span class="grow">Bekijk als<small>${esc(ROLES[ctx.role()].n)}</small></span></button>
      <button class="menu-i" type="button" data-m="clock">${ic('clock', 18)}<span class="grow">Simulatie<small>${hhmm(ctx.state.simTime)} · ${ctx.state.playing ? `${ctx.state.speed}×` : 'pauze'}</small></span></button>
      <button class="menu-i" type="button" data-m="assist">${ic('spark', 18)}<span class="grow">Assistent</span></button>
      <button class="menu-i" type="button" data-m="theme">${ic(ctx.theme() === 'dark' ? 'sun2' : 'moon', 18)}<span class="grow">${ctx.theme() === 'dark' ? 'Licht thema' : 'Donker thema'}</span></button>`, {
      label: 'Meer', cls: 'more-sheet', onBind: pop => {
        on(pop, 'click', '[data-nav]', (e, x) => { ctx.L.closePop(false); ctx.navTo(x.dataset.nav); });
        on(pop, 'click', '[data-m]', (e, x) => { const k = x.dataset.m; ctx.L.closePop(false); if (k === 'wg') ctx.openWizard(1); else if (k === 'role') roleMenu($('bbMore')); else if (k === 'clock') clockMenu($('bbMore')); else if (k === 'assist') ctx.toggleAssist(); else ctx.toggleTheme(); });
      },
    });
  }

  function bind() {
    on($('side'), 'click', '[data-nav]', (e, b) => ctx.navTo(b.dataset.nav));
    on($('side'), 'click', '#navCollapse', () => ctx.toggleNav());
    on($('bottombar'), 'click', '[data-nav]', (e, b) => ctx.navTo(b.dataset.nav));
    on($('bottombar'), 'click', '#bbMore', (e, b) => moreMenu(b));
    on($('topbar'), 'click', '#wgBtn', (e, b) => wgMenu(b));
    on($('topbar'), 'click', '#roleBtn', (e, b) => roleMenu(b));
    on($('topbar'), 'click', '#clockBtn', (e, b) => clockMenu(b));
    on($('topbar'), 'click', '#bellBtn', (e, b) => bellMenu(b));
    on($('topbar'), 'click', '#userBtn', (e, b) => userMenu(b));
    on($('topbar'), 'click', '#assistBtn', () => ctx.toggleAssist());
    on($('topbar'), 'click', '#themeBtn', () => ctx.toggleTheme());
  }
  return { renderSide, renderBottom, renderTop, updateClock, bind, bellMenu, roleMenu, clockMenu, locked };
}
