// Interface 3.0: iconenbalk, topbalk met werkgebied en rol, kaart met statusregel en voertuigkaartje, meldingenpaneel,
// voertuig- en opleggerpaneel, werkgebied-wizard, zoekpalet, sneltoetsen, opgeslagen weergaven, record-pagina's en de
// routes voor hal-scherm en klant-link.
import { SP, REGIOS, DIV, ST, ROLES, CAN, laadpunten, fmt, hhmm } from './places.js';
import { KIND, TRT, TRST } from './fleet.js';
import { ic } from './icons.js';
import { renderPlanbord, renderSpView, renderAssist, renderHal, renderKlant } from './views.js';
import { renderSheet } from './sheets.js';
import { renderTrucks, renderOpleggers, renderMensen, renderLostijden, renderLaden, renderPauze } from './tables.js';
import logo from './assets/logo.png';

const VIEWS = [['kaart', 'Kaart', 'map'], ['planbord', 'Planbord', 'cal'], ['trucks', 'Voertuigen', 'truck'], ['opleggers', 'Opleggers', 'trailer'], ['mensen', 'Mensen', 'users'], ['standplaatsen', 'Standplaatsen', 'home'], ['laden', 'Laden', 'bolt'], ['lostijden', 'Lostijden', 'clock'], ['pauze', 'Pauzeplekken', 'coffee'], ['assistent', 'Assistent', 'spark']];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const COLLEGAS = [['Sanne Vlaar', 'Wognum', 'Planner winkeldistributie', 360, 840], ['Ruud Koning', 'Wognum', 'Planner netwerk', 780, 1260], ['Fatima el Idrissi', 'Wognum', 'Planner bulk (avond)', 780, 1260], ['Daan Smit', 'Zaandam', 'Planner Albert Heijn', 300, 780], ['Ilse Bakker', 'Geldermalsen', 'Planner netwerk', 420, 900], ['Marco de Boer', 'Wognum', 'Garage en wasstraat', 420, 960], ['Anouk Groot', 'Wognum', 'Teamleider control tower', 480, 1020]];
const QUICK = ['Dock gewijzigd, zie app', 'Pauze bij de volgende stop', 'Bel de planning als je stilstaat', 'Rij na deze stop terug naar de standplaats'];
const REPLIES = ['👍 Ontvangen', 'Oké, doe ik.', 'Begrepen, ik rij door naar de volgende stop.', 'Top, bedankt.'];
const DIVDESC = { winkel: 'Albert Heijn, Jumbo, Plus, Lidl, SPAR, Vomar', netwerk: 'DC naar DC, crossdock Tiel en Geldermalsen, LZV', bulk: 'Poeders, granulaat, suiker', dranken: 'Heineken, Bavaria, Vrumona', bezorg: 'AH Home Service, bestelbussen' };
export const fmtDrive = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const nl1 = v => v.toFixed(1).replace('.', ',');

// root: de app-root (#app.slct) die thema en kiosk-klasse draagt; embedded: ingebed in een andere pagina (SafeTail):
// sneltoetsen gelden dan alleen binnen de app en het hal-scherm vraagt om volledig scherm.
export function createUI(fleet, state, store, { people, rest, lostijden, root = document.getElementById('app'), embedded = false }) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = { regios: new Set(), sps: new Set(), divs: new Set(Object.keys(DIV)), sts: new Set(Object.keys(ST)), q: '', dim: true };
  let role = ROLES[store.get('sl-role')] ? store.get('sl-role') : 'planner';
  let profile = null; try { profile = JSON.parse(store.get('sl-werkgebied') || 'null'); } catch { profile = null; }
  // bij "minder beweging" (prefers-reduced-motion) vliegt de kaart niet maar springt hij
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; const FLY = RM ? 0 : 900;
  let three = store.get('sl-3d') === 'on', prevCam = null;
  let mapApi = null, selTruck = null, selSp = null, selRest = null, selTrailer = null, follow = false, lastFollow = 0, panelMode = 'meld', hoverId = null, hoverPt = null, view = 'kaart', tick = 0, pbSp = SP[0], exFilter = 'Alle', showDone = false, restOnMap = false, trailersOnMap = false, sheet = null, halSp = null, klantId = null;
  const S = new Map(), TRS = new Map(), prevSt = new Map(); const feed = [], chat = []; let exceptions = [], trailerEx = [], counts = {}, kpi = {}, msgCount = 0; const pbF = { div: 'alle', kind: 'alle' };
  // ---------- acties van vandaag (localStorage sl-acties): afgehandeld, toegewezen, later, toegepaste voorstellen, berichten ----------
  // Eén sleutel met de datum erin; een nieuwe dag begint leeg. Acties op het plan worden bij het laden opnieuw uitgevoerd.
  const now0 = new Date(); const DAY = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}-${String(now0.getDate()).padStart(2, '0')}`;
  let acts = { day: DAY, handled: {}, applied: [], msgs: {}, actions: [] };
  try { const a = JSON.parse(store.get('sl-acties') || 'null'); if (a && a.day === DAY) acts = { day: DAY, handled: a.handled || {}, applied: a.applied || [], msgs: a.msgs || {}, actions: a.actions || [] }; } catch { /* leeg beginnen */ }
  const saveActs = () => store.set('sl-acties', JSON.stringify(acts));
  const handled = { get: k => acts.handled[k], set: (k, v) => { acts.handled[k] = v; saveActs(); } };
  const applied = acts.applied;
  const isOpen = e => { const h = acts.handled[e.key] || {}; return !h.done && !(h.until && h.until > state.simTime); };
  const can = perm => CAN[perm].includes(role);
  const driverName = t => (S.get(t.id) || {}).driver || t.driver || '';
  const driverOf = t => { const s = S.get(t.id); return s && s.dienst ? s.dienst.person : (t.diensten[0] ? t.diensten[0].person : null); };
  const trailerState = tr => { let s = TRS.get(tr.id); if (!s) { s = fleet.trailerStateAt(tr, state.simTime); TRS.set(tr.id, s); } return s; };

  // ---------- berichten ----------
  function sendMsg(t, text, me = true) {
    t.msgs = t.msgs || []; t.msgs.push({ me, text, T: state.simTime }); acts.msgs[t.id] = t.msgs; saveActs();
    if (me) { msgCount++; setTimeout(() => { t.msgs.push({ me: false, text: REPLIES[(t.msgs.length + t.idx) % REPLIES.length], T: state.simTime }); acts.msgs[t.id] = t.msgs; saveActs(); if (selTruck === t && panelMode === 'truck') renderPanel(); if (view === 'assistent') renderAssist(ctx); }, 3500 + (t.idx % 5) * 800); }
    if (selTruck === t && panelMode === 'truck') renderPanel();
  }

  // ---------- acties op het plan: uitvoeren en bewaren (na een herlaad opnieuw uitgevoerd, in dezelfde volgorde) ----------
  function runAction(a, live) {
    const t = a.t ? fleet.byId.get(a.t) : null; const tr = a.tr ? fleet.trailerById.get(a.tr) : null; let r = null;
    try {
      if (a.k === 'pauze' && t) r = fleet.insertPause(t, a.T, a.place ? rest.byId.get(a.place) : null);
      else if (a.k === 'laden' && t) r = fleet.insertCharge(t, a.T, a.sp ? SP.find(s => s.n === a.sp) : null);
      else if (a.k === 'schuif' && t) r = fleet.shiftDienst(t, a.d, a.min);
      else if (a.k === 'eta' && t) { fleet.acceptEta(t, a.T); if (a.helper) { const h = fleet.byId.get(a.helper); if (h) h.helping = t.id; } }
      else if (a.k === 'ophalen' && t && tr) { const p = a.person ? people.byId.get(a.person) : null; r = fleet.pickupDetour(t, tr, a.T, { driver: p ? p.name : '', person: p }); if (r && p && r.dienst && r.dienst.person === p) p.dienst = { t, d: r.dienst }; }
      else if (a.k === 'werkorder' && t) { t.workorder = { at: a.T, what: t.storing, gepland: a.gepland || '' }; if (a.reserve) { const r2 = fleet.byId.get(a.reserve); const d = t.diensten.find(x => x.i === a.dienst); const moved = r2 && d ? fleet.moveDienst(t, d, r2) : null; if (moved && moved.person) moved.person.dienst = { t: r2, d: moved }; } }
      else if ((a.k === 'koeling' || a.k === 'trworkorder') && tr) tr.workorder = { at: a.T, what: tr.storing };
    } catch (err) { console.warn('actie niet uitgevoerd', a, err); }
    if (live) { acts.actions.push(a); saveActs(); }
    return r;
  }
  function applyProposal(p) {
    const r = runAction({ ...p.act, T: state.simTime }, true);
    if (p.msg) { const m = p.msg(r); if (m && m[0]) sendMsg(m[0], m[1]); }
    applied.push({ id: p.id, kind: p.kind, title: p.title, action: p.action, sev: p.sev, T: state.simTime }); saveActs();
    if (p.t) feed.unshift({ T: state.simTime, t: p.t, txt: `voorstel toegepast: ${p.kind.toLowerCase()}`, sev: 'ok' });
    frame(true); notice(`Toegepast: ${p.title}.`);
  }
  function restoreActs() {
    for (const [id, L] of Object.entries(acts.msgs)) { const t = fleet.byId.get(id); if (t && Array.isArray(L)) { t.msgs = L; msgCount += L.filter(m => m.me).length; } }
    for (const a of acts.actions) runAction(a, false);
  }

  // ---------- filters en werkgebied ----------
  const q = () => F.q.toLowerCase();
  const inScopeBase = (base, div) => (!F.regios.size || F.regios.has(base.regio)) && F.divs.has(div) && (!F.sps.size || F.sps.has(base.n));
  function matchBase(t) { return (!F.regios.size || F.regios.has(t.base.regio)) && F.divs.has(t.div) && (!F.q || t.id.toLowerCase().includes(q()) || t.plate.toLowerCase().includes(q()) || t.base.n.toLowerCase().includes(q()) || t.diensten.some(d => d.driver.toLowerCase().includes(q()))); }
  const inScope = t => matchBase(t) && (!F.sps.size || F.sps.has(t.base.n));
  const visible = (t, s) => inScope(t) && F.sts.has((s || S.get(t.id) || {}).st);
  const scopeLabel = () => F.sps.size === 1 ? [...F.sps][0] : F.sps.size > 1 ? `${F.sps.size} standplaatsen` : !F.regios.size ? 'Nederland' : F.regios.size === REGIOS.length ? 'Nederland' : [...F.regios].join(', ');
  const divLabel = () => F.divs.size === Object.keys(DIV).length ? 'alle ritten' : [...F.divs].map(k => DIV[k].n.toLowerCase()).join(', ');
  function applyProfile() {
    if (!profile) return;
    F.regios = new Set((profile.regios || []).filter(r => REGIOS.includes(r))); F.divs = new Set((profile.divs || []).filter(k => DIV[k])); if (!F.divs.size) F.divs = new Set(Object.keys(DIV));
    role = ROLES[profile.role] ? profile.role : role; store.set('sl-role', role);
    F.sps = new Set(profile.sp && SP.find(s => s.n === profile.sp) ? [profile.sp] : []);
    if (mapApi) { if (F.sps.size) { const sp = SP.find(s => s.n === profile.sp); mapApi.highlightSp(sp.n); mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: 9.4, duration: FLY }); } else if (F.regios.size && F.regios.size < REGIOS.length) mapApi.fitSps(SP.filter(s => F.regios.has(s.regio))); else mapApi.map.easeTo({ center: [5.3, 52.2], zoom: 6.6, duration: FLY }); }
    renderTopbar(); renderRail(); frame(true);
  }

  // ---------- iconenbalk en topbalk ----------
  function renderRail() {
    $('rail').innerHTML = `<img src="${logo}" alt="Simon Loos" class="rl">${VIEWS.map((v, i) => `<button class="ri ${view === v[0] ? 'on' : ''}" data-view="${v[0]}" title="${v[1]} (toets ${KEYS[i]})">${ic(v[2], 20)}<span>${v[1]}</span></button>`).join('')}
      <button class="ri more" id="railMore" title="Meer weergaven">${ic('more', 20)}<span>Meer</span></button>
      <div class="rail-foot"><button class="ri" id="wgBtn" title="Mijn werkgebied">${ic('settings', 20)}<span>Werkgebied</span></button><button class="ri" id="themeBtn" title="Licht of donker">${ic(state.theme === 'dark' ? 'sun' : 'moon', 20)}<span>Thema</span></button><div class="av" id="meAv" title="${ROLES[role].n}">${role === 'hr' ? 'HR' : role[0].toUpperCase() + role[1]}</div></div>`;
    $('rail').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $('wgBtn').onclick = () => openWizard(1);
    $('railMore').onclick = () => $('rail').classList.toggle('open');
    $('themeBtn').onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; state.theme = t; store.set('sl-theme', t); mapApi && mapApi.setTheme(t); renderRail(); };
  }
  function renderTopbar() {
    const v = VIEWS.find(x => x[0] === view);
    $('topbar').innerHTML = `<button class="ib mob" id="menuBtn" aria-label="Menu">${ic('menu', 18)}</button><div class="tt"><b id="vtitle">${v[1]}</b><span id="vsub"></span></div>
      <div class="tr"><button class="srch" id="palBtn">${ic('search', 16)}<span>Zoek voertuig, oplegger, persoon</span><kbd>/</kbd></button>
      <div class="dropdown"><button class="btn" id="viewsBtn">${ic('save', 15)} <span class="lbl">Weergaven</span></button><div class="menu" id="viewsMenu" hidden></div></div>
      <div class="seg2" id="roleSeg"><span>Bekijk als</span>${Object.entries(ROLES).map(([k, r]) => `<button class="${role === k ? 'on' : ''}" data-role="${k}">${r.n}</button>`).join('')}</div>
      <button class="ib" id="bellBtn" title="Meldingen">${ic('bell', 17)}<i id="bellDot" hidden></i></button>
      <div class="live"><i></i><b id="clock">${hhmm(state.simTime)}</b></div></div>`;
    $('palBtn').onclick = openPalette;
    $('bellBtn').onclick = () => { if (panelOpen() && panelMode === 'meld') closePanel(); else openPanel('meld'); };
    $('menuBtn').onclick = () => $('rail').classList.toggle('open');
    $('roleSeg').addEventListener('click', e => { const b = e.target.closest('[data-role]'); if (!b) return; role = b.dataset.role; store.set('sl-role', role); if (profile) { profile.role = role; store.set('sl-werkgebied', JSON.stringify(profile)); } renderTopbar(); renderRail(); if (sheet) openSheet(sheet.kind, sheet.id, sheet.tab); if (view === 'mensen') renderMensen(ctx); notice(`Je kijkt nu als ${ROLES[role].n.toLowerCase()}: ${ROLES[role].sub}.`); });
    $('viewsBtn').onclick = () => { const m = $('viewsMenu'); m.hidden = !m.hidden; if (!m.hidden) renderViewsMenu(); };
    updateSub();
  }
  document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) { const m = $('viewsMenu'); if (m) m.hidden = true; } });
  function updateSub() { const s = $('vsub'); if (s) s.textContent = `${scopeLabel()} · ${divLabel()} · ${fmt(kpi.nVis || 0)} voertuigen · ${fmt(kpi.trailers || 0)} opleggers`; const open = exceptions.filter(isOpen).length; const d = $('bellDot'); if (d) d.hidden = !open; const c = $('clock'); if (c) c.textContent = hhmm(state.simTime); const tb = $('tbClock'); if (tb) tb.textContent = hhmm(state.simTime); const sc = $('scrub'); if (sc && document.activeElement !== sc) sc.value = Math.floor(state.simTime); }

  // ---------- opgeslagen weergaven ----------
  const savedViews = () => { try { return JSON.parse(store.get('sl-views') || '[]'); } catch { return []; } };
  function renderViewsMenu(saving) {
    const L = savedViews();
    $('viewsMenu').innerHTML = `${L.map((v, i) => `<div class="mi"><button data-apply="${i}">${ic('eye', 14)} ${esc(v.name)}<small>${esc(v.scope)}</small></button><button class="del" data-del="${i}" title="Verwijderen">${ic('trash', 13)}</button></div>`).join('') || '<div class="mi mut">Nog geen opgeslagen weergaven.</div>'}${saving ? `<div class="mi save"><input id="saveName" placeholder="Naam van deze weergave" value="${esc(`${scopeLabel()} ${hhmm(state.simTime)}`)}" autocomplete="off"><button class="btn pri sm" id="saveOk">Opslaan</button></div>` : `<div class="mi"><button id="saveView">${ic('plus', 14)} Huidige weergave opslaan</button></div>`}`;
    $('viewsMenu').querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { applyView(L[+b.dataset.apply]); $('viewsMenu').hidden = true; }));
    $('viewsMenu').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); L.splice(+b.dataset.del, 1); store.set('sl-views', JSON.stringify(L)); renderViewsMenu(); }));
    const sv = $('saveView'); if (sv) sv.onclick = () => { renderViewsMenu(true); const i = $('saveName'); i.focus(); i.select(); };
    const ok = $('saveOk'); if (ok) {
      const save = () => { const name = $('saveName').value.trim(); if (!name) return; const c = mapApi.map.getCenter(); L.push({ name, scope: `${scopeLabel()} · ${divLabel()}`, regios: [...F.regios], divs: [...F.divs], sts: [...F.sts], sps: [...F.sps], view, center: [c.lng, c.lat], zoom: mapApi.map.getZoom() }); store.set('sl-views', JSON.stringify(L)); $('viewsMenu').hidden = true; notice(`Weergave "${name}" opgeslagen.`); };
      ok.onclick = save; $('saveName').addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderViewsMenu(); });
    }
  }
  function applyView(v) { F.regios = new Set(v.regios); F.divs = new Set(v.divs); F.sts = new Set(v.sts); F.sps = new Set(v.sps); mapApi.highlightSp(F.sps.size === 1 ? [...F.sps][0] : null); setView(v.view || 'kaart'); if (v.center) mapApi.map.easeTo({ center: v.center, zoom: v.zoom, duration: FLY }); frame(true); notice(`Weergave "${v.name}" geladen.`); }

  // ---------- frame ----------
  function frame(force) {
    if (!mapApi) return; tick++;
    const T = state.simTime; const feats = [], dims = []; counts = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; exceptions = [];
    let nVis = 0, laden = 0, ritten = 0, stopsDone = 0, stopsLate = 0, ev = 0, inzet = 0, solo = 0; const spSeen = new Set();
    for (const t of fleet.trucks) {
      const s = fleet.stateAt(t, T); S.set(t.id, s);
      const vis = visible(t, s);
      if (!vis) { if (F.dim && F.sps.size && !F.sps.has(t.base.n) && matchBase(t) && F.sts.has(s.st)) dims.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); prevSt.set(t.id, s.st); continue; }
      nVis++; counts[s.st]++; spSeen.add(t.base); ritten += t.routes.length; if (t.ev) ev++; if (t.vandaag === 'inzet') inzet++; if (s.solo && s.st !== 'klant') solo++;
      feats.push({ type: 'Feature', properties: { id: t.id, st: s.st, b: Math.round(s.pos.bearing), mv: s.st === 'onderweg' || s.st === 'vertraagd', k: t.kind === 'trekker' ? (s.tr ? 'trekker' : 'solo') : t.kind, base: t.base.n }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } });
      if (s.seg.k === 'laden') laden++;
      for (const seg of t.plan) if (seg.k === 'stop' && seg.t1 <= s.rel) { stopsDone++; const d = t.plan[t.plan.indexOf(seg) - 1]; if (d && d.delay) stopsLate++; }
      const who = s.driver || t.id;
      if (s.st === 'vertraagd' && s.next && !s.next.home) exceptions.push({ key: 'V:' + t.id, sev: 'bad', kind: 'Vertraging', t, text: `${s.next.name}: ETA ${hhmm(s.next.eta)}${s.next.win ? `, venster tot ${hhmm(s.next.win[1])}` : ''} (+${s.next.delay} min)` });
      else if (s.st === 'vertraagd' && s.next && s.next.home && s.next.volgende) exceptions.push({ key: 'V:' + t.id, sev: 'warn', kind: 'Vertraging', t, text: `terug op ${t.base.n} om ${hhmm(s.next.eta)} (+${s.next.delay} min); dienst ${s.next.volgende.i + 1} van ${s.next.volgende.driver} start ${hhmm(s.next.volgende.start)}` });
      if ((s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240 && !t.breakPlanned) exceptions.push({ key: 'R:' + t.id, sev: 'warn', kind: 'Rijtijd', t, text: `${who}: ${fmtDrive(s.drive)} van 4:30 rijtijd, pauze binnen ${Math.max(0, 270 - Math.floor(s.drive))} min` });
      if (t.ev && s.soc < 20 && s.st !== 'terrein' && !t.chargePlanned) exceptions.push({ key: 'A:' + t.id, sev: 'warn', kind: 'Accu', t, text: `Accu ${Math.round(s.soc)} % · ${Math.round(t.range * s.soc / 100)} km bereik · ${s.next ? s.next.name : t.base.n}` });
      if (t.storing && s.st !== 'terrein' && !t.workorder) exceptions.push({ key: 'T:' + t.id, sev: 'bad', kind: 'Techniek', t, text: t.storing });
      const p = prevSt.get(t.id); if (p && p !== s.st) pushEvent(t, s, p); prevSt.set(t.id, s.st);
    }
    // opleggers: toestand, losse opleggers op de kaart, koeling en wachttijd (elke achtste beurt; goedkoop genoeg)
    let trailers = 0, loose = 0, trWait = 0;
    if (force || tick % 8 === 1 || !TRS.size) {
      trailerEx = []; const trFeats = [];
      for (const tr of fleet.trailers) {
        const s = fleet.trailerStateAt(tr, T); TRS.set(tr.id, s);
        if (!inScopeBase(tr.base, tr.div)) continue;
        trailers++; if (s.st !== 'gekoppeld') { loose++; if (s.st !== 'onderhoud') trFeats.push({ type: 'Feature', properties: { id: tr.id, st: s.st, base: tr.base.n }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); }
        if (tr.storing && (s.st === 'gekoppeld' || s.st === 'geladen') && !tr.workorder) trailerEx.push({ key: 'K:' + tr.id, sev: 'bad', kind: 'Koeling', tr, t: s.vehicle, text: `${tr.id} (${TRT[tr.type].n.toLowerCase()}${s.vehicle ? `, achter ${s.vehicle.id}` : `, bij ${s.place}`}): ${tr.storing}` });
        if (s.late && !tr.pickupPlanned) { trWait++; trailerEx.push({ key: 'O:' + tr.id, sev: 'warn', kind: 'Oplegger', tr, t: null, text: `${tr.id} staat leeg bij ${s.place}, ophalen was gepland om ${hhmm(s.pickup)} (${Math.max(1, Math.floor((((T - s.pickup) % 1440) + 1440) % 1440 / 60))} u te laat)` }); }
      }
      mapApi.setTrailers(trFeats); kpi.trailers = trailers; kpi.loose = loose; kpi.trWait = trWait;
    }
    exceptions.push(...trailerEx.map(e => ({ ...e, t: e.t || e.tr.base }))); // e.t: voertuig (of de standplaats als drager voor het werkgebied)
    exceptions.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'bad' ? -1 : 1));
    kpi = { ...kpi, nVis, inzet, actief: nVis - counts.terrein, ritten, stopsDone, onTime: stopsDone ? (1 - stopsLate / stopsDone) * 100 : 100, ex: exceptions.length, open: exceptions.filter(isOpen).length, laden, ev, solo, lp: [...spSeen].reduce((a, s) => a + laadpunten(s), 0) };
    mapApi.setTrucks(feats, dims);
    // de nu-lijn van het planbord loopt elke beurt mee (de rest van het bord ververst elke achtste beurt)
    if (view === 'planbord') { const g = $('v-planbord').querySelector('.gbody'); const nl = g && g.querySelector('.nowline'); if (nl && g.dataset.w0) { nl.style.left = `calc(var(--who) + (100% - var(--who)) * ${((T - +g.dataset.w0) / +g.dataset.span).toFixed(4)})`; const lb = nl.firstElementChild; if (lb) lb.textContent = hhmm(T); } }
    if (selTruck) { const s = S.get(selTruck.id); mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); drawRoute(selTruck, s); if (follow && Date.now() - lastFollow > 900) { lastFollow = Date.now(); if (three) mapApi.followCam(s.pos, FLY, !RM); else mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], duration: FLY }); } }
    else if (selTrailer) { const s = TRS.get(selTrailer.id); if (s) mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); }
    else mapApi.setSelected(null);
    renderStatline(); renderFcard(); updateSub();
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (force || tick % 8 === 0) {
      if (!typing && panelOpen()) renderPanel();
      if (view === 'planbord') renderPlanbord(ctx); if (view === 'standplaatsen') renderSpView(ctx); if (view === 'assistent' && !typing) renderAssist(ctx);
      if (halSp) renderHal(ctx, halSp); if (klantId) renderKlant(ctx, klantId);
    }
    if (force || tick % 40 === 0) { if (!typing) { if (view === 'trucks') renderTrucks(ctx); if (view === 'opleggers') renderOpleggers(ctx); if (view === 'mensen') renderMensen(ctx); if (view === 'laden') renderLaden(ctx); } }
    if (force) { if (view === 'lostijden') renderLostijden(ctx); if (view === 'pauze') renderPauze(ctx); }
    renderTip();
  }
  function pushEvent(t, s, p) {
    let txt = null;
    if (s.st === 'klant') txt = `aangekomen bij ${s.seg.stop}${s.seg.swap ? ' (oplegger wisselen)' : ''}`;
    else if (s.st === 'pauze') txt = 'pauze gestart (45 min)';
    else if (s.st === 'terrein') txt = s.seg.k === 'koppel' ? `koppelt ${s.seg.tr.id} op ${t.base.n}` : s.seg.k === 'ontkoppel' ? `terug op ${t.base.n}, koppelt ${s.seg.tr.id} af` : `terug op ${t.base.n}${s.seg.k === 'laden' ? ', laadt accu' : ''}`;
    else if (s.st === 'onderweg' || s.st === 'vertraagd') txt = p === 'terrein' ? `vertrokken van ${t.base.n}${s.next ? ` naar ${s.next.name}` : ''}${s.tr ? ` met ${s.tr.id}` : s.solo ? ' zonder oplegger' : ''}` : `onderweg naar ${s.next ? s.next.name : t.base.n}${s.st === 'vertraagd' ? ' (vertraging)' : ''}`;
    if (txt) { feed.unshift({ T: state.simTime, t, txt, sev: s.st === 'vertraagd' ? 'bad' : s.st === 'klant' ? 'info' : 'ok' }); if (feed.length > 60) feed.length = 60; }
  }
  function drawRoute(t, s) {
    const seg = s.seg; const r = seg.route || (t.plan.find(x => x.route) || {}).route; if (!r) { mapApi.setRoute(null, null, []); return; }
    const km = seg.route ? s.km : 0; const pts = r.path.pts, cum = r.path.cum; const done = [], todo = [];
    for (let i = 0; i < pts.length; i++) { if (cum[i] <= km) done.push(pts[i]); else todo.push(pts[i]); }
    done.push([s.pos.lon, s.pos.lat]); todo.unshift([s.pos.lon, s.pos.lat]);
    const stops = r.marks.slice(1, -1).map(m => { const i = Math.max(0, cum.findIndex(c => c >= m.km)); return { lon: pts[i][0], lat: pts[i][1], done: m.km <= km }; });
    mapApi.setRoute(done.length > 1 ? done : null, todo.length > 1 ? todo : null, stops);
  }

  // ---------- kaart: statusregel en voertuigkaartje ----------
  function renderStatline() {
    const el = $('statline'); if (!el) return;
    const items = ['vertraagd', 'onderweg', 'klant'].map(k => `<button class="stb ${F.sts.has(k) ? '' : 'off'}" data-st="${k}"><i style="background:${ST[k].color}"></i>${ST[k].n} <b>${fmt(counts[k] || 0)}</b></button>`).join('');
    const trl = `<button class="stb trl ${trailersOnMap ? 'on' : ''}" data-trl="1" title="Losse opleggers op de kaart">${ic('trailer', 14)} Los <b>${fmt(kpi.loose || 0)}</b></button>`;
    const extra = `${F.sts.size < Object.keys(ST).length ? `<button class="stb reset" data-reset="1">Alle statussen</button>` : ''}${F.sps.size ? `<button class="stb chipx" data-clear="sps">${esc(F.sps.size === 1 ? [...F.sps][0] : F.sps.size + ' standplaatsen')} ✕</button>` : ''}${F.q ? `<button class="stb chipx" data-clear="q">Zoek: ${esc(F.q)} ✕</button>` : ''}`;
    const html = `${items}${trl}${extra}<button class="stb link" id="allNums">Alle cijfers</button>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.st; if (F.sts.size === Object.keys(ST).length) F.sts = new Set([k]); else if (F.sts.has(k) && F.sts.size === 1) F.sts = new Set(Object.keys(ST)); else if (F.sts.has(k)) F.sts.delete(k); else F.sts.add(k); frame(true); })); const r = el.querySelector('[data-reset]'); if (r) r.onclick = () => { F.sts = new Set(Object.keys(ST)); frame(true); }; el.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { if (b.dataset.clear === 'sps') { F.sps.clear(); selSp = null; mapApi.highlightSp(null); if (panelMode === 'sp') closePanel(); } else F.q = ''; frame(true); })); el.querySelector('[data-trl]').onclick = () => setTrailersOnMap(!trailersOnMap); $('allNums').onclick = () => openPanel('meld'); }
  }
  function trailerLine(tr, s, T, withId = true) {
    const temp = fleet.trailerTemp(tr, T); const tt = TRT[tr.type];
    return `${withId ? `${ic('trailer', 12)} ${tr.id} · ` : ''}${tt.n.toLowerCase()}${temp !== null ? ` · <b style="color:${tr.storing ? '#DC2626' : 'inherit'}">${nl1(temp)} °C</b>` : ''}${s && s.lading ? ` · ${esc(s.lading)}` : s && !s.loaded ? ' · leeg' : ''}`;
  }
  function renderFcard() {
    const el = $('fcard'); if (!el) return; if (!selTruck || view !== 'kaart') { el.hidden = true; return; }
    const t = selTruck, s = S.get(t.id); if (!s) { el.hidden = true; return; } el.hidden = false; const nx = s.next; const d = s.dienst;
    const trs = s.tr ? TRS.get(s.tr.id) : null;
    const html = `<div class="fh"><span class="plate">${t.id}</span><span class="kind">${KIND[t.kind].n}</span><span class="st ${s.st === 'vertraagd' ? 'bad' : s.st === 'pauze' ? 'warn' : s.st === 'terrein' ? '' : 'ok'}">${ST[s.st].n}${s.st === 'vertraagd' && nx ? ` +${nx.delay}` : ''}</span><button class="x" data-act="close" title="Sluiten">${ic('x', 14)}</button></div>
      <div class="fl">${d ? `${ic('user', 12)} ${esc(d.driver)} · dienst ${hhmm(d.start)}–${hhmm(d.end)}` : t.vandaag !== 'inzet' ? `${t.vandaag === 'onderhoud' ? 'in de werkplaats' : 'reserve'}, niet ingepland` : s.upcoming ? `volgende dienst ${hhmm(s.upcoming.start)} · ${esc(s.upcoming.driver)}` : 'dienst afgerond'} · ${esc(t.model.replace('Mercedes-Benz ', ''))}</div>
      ${t.kind === 'trekker' ? `<div class="fl">${s.tr ? trailerLine(s.tr, trs, state.simTime) : `${ic('unlink', 12)} zonder oplegger (solo)${nx && nx.pickup ? `, haalt ${nx.pickup.id} op` : ''}`}</div>` : ''}
      <div class="fl">${nx ? `→ ${esc(nx.name)} · ETA ${hhmm(nx.eta)}${nx.win ? ` · venster tot ${hhmm(nx.win[1])}` : ''}${nx.eta > (nx.win ? nx.win[1] : Infinity) ? ' <em class="bad">te laat</em>' : ''}${nx.swap ? ' · oplegger wisselen' : ''}` : d ? 'Dienst afgerond' : `Standplaats ${esc(t.base.n)}`}</div>
      <div class="fa"><a data-act="sheet">Open voertuig</a><a data-act="panel">Rit en berichten</a>${s.tr ? `<a data-act="trailer">Oplegger</a>` : ''}<a data-act="link">Deel link</a><a data-act="follow" class="${follow ? 'on' : ''}">${follow ? 'Volgen aan' : 'Volg'}</a></div>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.querySelectorAll('[data-act]').forEach(a => a.addEventListener('click', () => { const k = a.dataset.act; if (k === 'close') clearSel(); else if (k === 'sheet') openSheet('truck', t.id); else if (k === 'panel') openPanel('truck'); else if (k === 'trailer') selectTrailer(s.tr.id); else if (k === 'link') shareLink(t); else if (k === 'follow') { follow = !follow; if (follow) mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 11), duration: FLY }); renderFcard(); } })); }
  }
  function shareLink(t) { const url = `${location.href.split('#')[0]}#klant/${t.id}`; try { navigator.clipboard && navigator.clipboard.writeText(url); } catch { /* geen klembord */ } notice(`Klant-link gekopieerd: alleen ${t.id} en de volgende levering zijn zichtbaar. ${url}`); }

  // ---------- paneel rechts ----------
  const panelOpen = () => $('panel').classList.contains('open');
  function openPanel(mode) { panelMode = mode || panelMode; $('panel').classList.add('open'); $('app').classList.add('panel-open'); renderPanel(); setTimeout(() => mapApi && mapApi.map.resize(), 30); }
  function closePanel() { $('panel').classList.remove('open'); $('app').classList.remove('panel-open'); setTimeout(() => mapApi && mapApi.map.resize(), 30); }
  function renderPanel() {
    const p = $('panel');
    if (panelMode === 'truck' && selTruck) p.innerHTML = truckPanel(selTruck, S.get(selTruck.id));
    else if (panelMode === 'trailer' && selTrailer) p.innerHTML = trailerPanel(selTrailer);
    else if (panelMode === 'sp' && selSp) p.innerHTML = spPanel(selSp);
    else if (panelMode === 'rest' && selRest) p.innerHTML = restPanel(selRest);
    else { panelMode = 'meld'; p.innerHTML = meldPanel(); }
    bindPanel();
  }
  function meldPanel() {
    const k = kpi; const T = state.simTime; const ex = exceptions.filter(e => exFilter === 'Alle' || e.kind === exFilter).filter(e => showDone || isOpen(e)).slice(0, 40);
    const chips = ['Alle', 'Vertraging', 'Rijtijd', 'Accu', 'Techniek', 'Koeling', 'Oplegger'].map(x => `<button class="chip sm ${exFilter === x ? 'on' : ''}" data-ex="${x}">${x}</button>`).join('');
    const row = e => { const h = handled.get(e.key) || {}; const snoozed = h.until && h.until > T; const tr = e.tr; const id = tr ? tr.id : e.t.id; const sub = tr ? `${esc(tr.base.n)} · ${esc(e.kind)}` : `${esc(e.t.base.n)} · ${esc(e.kind)}${driverName(e.t) ? ` · ${esc(driverName(e.t))}` : ''}`; return `<div class="al ${e.sev} ${h.done ? 'done' : ''} ${snoozed ? 'later' : ''}"><i></i><div ${tr ? `data-trailer="${tr.id}"` : `data-truck="${e.t.id}"`}><b>${id}</b><span>${sub}</span><p>${esc(e.text)}</p>${h.who ? `<small>toegewezen aan ${esc(h.who)}</small>` : ''}${snoozed ? `<small>komt terug om ${hhmm(h.until)}</small>` : ''}</div><div class="alx"><button class="ok ${h.done ? 'on' : ''}" data-done="${e.key}" title="${h.done ? 'Heropenen' : 'Afgehandeld'}">${ic('check', 13)}</button><select data-assign="${e.key}" title="Toewijzen"><option value="">→</option>${COLLEGAS.map(c => `<option ${h.who === c[0] ? 'selected' : ''}>${esc(c[0])}</option>`).join('')}</select><select class="later" data-later="${e.key}" title="Later nog eens tonen"><option value="">later</option><option value="30">30 min</option><option value="60">60 min</option>${snoozed ? '<option value="0">nu weer tonen</option>' : ''}</select></div></div>`; };
    return `<div class="ph"><h3>Meldingen <b>${k.open || 0}</b></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="cijfers"><div><b>${fmt(k.actief || 0)}</b><span>onderweg van ${fmt(k.inzet || 0)} ingezet</span></div><div class="${(k.onTime || 100) < 95 ? 'warn' : 'good'}"><b>${(k.onTime || 100).toFixed(0)} %</b><span>op tijd · doel 95</span></div><div class="${k.open ? 'bad' : ''}"><b>${fmt(k.open || 0)}</b><span>open meldingen</span></div></div>
      <div class="kline">${fmt(k.loose || 0)} opleggers los, ${fmt(k.trWait || 0)} wachten te lang · ${fmt(k.ritten || 0)} ritten vandaag, ${fmt(k.solo || 0)} solo · ${fmt(k.laden || 0)} laden nu van ${fmt(k.ev || 0)} elektrisch</div>
      <div class="pf">${chips}<label class="sw sm ${showDone ? 'on' : ''}" id="showDone"><i></i><span>afgehandeld tonen</span></label></div>
      <div class="als">${ex.length ? ex.map(row).join('') : '<div class="empty">Geen open meldingen binnen je werkgebied.</div>'}</div>
      <h4 class="sub">Gebeurtenissen <small>live</small></h4><div class="evs">${feed.filter(e => inScope(e.t)).slice(0, 14).map(e => `<div class="ev ${e.sev}" data-truck="${e.t.id}"><time>${hhmm(e.T)}</time><span><b>${e.t.id}</b> ${esc(driverName(e.t))} ${esc(e.txt)}</span></div>`).join('') || '<div class="empty">Nog geen gebeurtenissen.</div>'}</div>`;
  }
  function spPanel(sp) {
    const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let laden = 0, ev = 0, inzet = 0;
    for (const t of mine) { const s = S.get(t.id); if (!s) continue; c[s.st]++; if (s.seg.k === 'laden') laden++; if (t.ev) ev++; if (t.vandaag === 'inzet') inzet++; }
    const trs = fleet.trailersOf(sp); const tc = { gekoppeld: 0, geladen: 0, wacht: 0, ophalen: 0, leeg: 0, klaar: 0, onderhoud: 0 }; for (const tr of trs) { const s = TRS.get(tr.id); if (s) tc[s.st]++; }
    const deps = fleet.departures(sp, state.simTime, 120).slice(0, 8); const st = people.spStats.get(sp.n); const T = state.simTime;
    const kinds = Object.keys(KIND).map(k => [k, mine.filter(t => t.kind === k).length]).filter(x => x[1]).map(([k, n]) => `${n} ${KIND[k].mv}`).join(', ');
    // wat er nu op het terrein staat en wie er op dienst is
    const yardV = mine.filter(t => (S.get(t.id) || {}).st === 'terrein').sort((a, b) => (a.vandaag === 'inzet' ? 0 : 1) - (b.vandaag === 'inzet' ? 0 : 1) || a.id.localeCompare(b.id));
    const yardT = trs.filter(tr => { const s = TRS.get(tr.id); return s && (s.st === 'klaar' || s.st === 'leeg'); });
    const onDuty = people.persons.filter(p => p.base === sp && p.dienst && p.dienst.d.start <= T && T < p.dienst.d.end);
    const chipList = (L, f, n) => `<div class="yard">${L.slice(0, n).map(f).join('')}${L.length > n ? `<span class="chip sm mut">+${L.length - n}</span>` : ''}${L.length ? '' : '<span class="mut">geen</span>'}</div>`;
    const yard = `<h4 class="sub">Op het terrein <small>${yardV.length} voertuigen · ${yardT.length} opleggers</small></h4>${chipList(yardV, t => { const s = S.get(t.id); return `<button class="chip sm" data-truck="${t.id}" title="${t.vandaag === 'inzet' ? (s && s.upcoming ? `volgende dienst ${hhmm(s.upcoming.start)}` : s && s.dienst ? 'tussen twee ritten' : 'dienst afgerond') : t.vandaag}">${t.id}${t.vandaag === 'reserve' ? ' <small>res.</small>' : t.vandaag === 'onderhoud' ? ' <small>wpl.</small>' : ''}</button>`; }, 12)}${chipList(yardT, tr => `<button class="chip sm ${TRS.get(tr.id).st === 'klaar' ? 'klaar' : ''}" data-trailer="${tr.id}" title="${TRST[TRS.get(tr.id).st].n}">${tr.id}</button>`, 12)}
      <h4 class="sub">Chauffeurs op dienst <small>${onDuty.length} nu · ${st.opDienst} vandaag van ${st.pool}</small></h4>${chipList(onDuty, p => `<button class="chip sm" data-person="${p.id}">${esc(p.short)} <small>${p.dienst.t.id}</small></button>`, 10)}`;
    return `<div class="ph"><h3>${esc(sp.n)}<small>${esc([sp.hub ? 'hoofdkantoor' : null, sp.wh ? 'warehouse' : null, sp.klant].filter(Boolean).join(' · '))}</small></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="stat5"><div><b>${mine.length}</b><span>voertuigen</span></div><div><b>${c.onderweg + c.vertraagd}</b><span>onderweg</span></div><div><b>${c.klant}</b><span>bij klant</span></div><div><b>${trs.length}</b><span>opleggers</span></div><div><b>${tc.geladen + tc.wacht + tc.leeg + tc.klaar}</b><span>los</span></div></div>
      <div class="mix">${Object.keys(ST).map(k => `<i style="background:${ST[k].color};flex:${Math.max(c[k], 0.2)}"></i>`).join('')}</div>
      <div class="kv2"><span>Vloot</span><b>${esc(kinds)} · ${inzet} vandaag ingezet</b><span>Opleggers</span><b>${tc.gekoppeld} gekoppeld · ${tc.klaar} klaar voor vertrek · ${tc.leeg} leeg op het terrein · ${tc.geladen} geladen bij klant · ${tc.wacht} wachten op ophalen · ${tc.onderhoud} onderhoud</b><span>Chauffeurs</span><b>${st.opDienst} op dienst van ${st.pool} · ${st.wissel.toString().replace('.', ',')} chauffeurs per wagen per week</b><span>Elektrisch</span><b>${ev} voertuigen · ${laden} laden nu · ${laadpunten(sp)} laadpunten</b><span>Regio</span><b>${esc(sp.regio)} · ${esc(sp.prov)}</b>${sp.note ? `<span>Locatie</span><b>${esc(sp.note)}</b>` : ''}</div>
      <h4 class="sub">Volgende vertrekken <small>komende 2 uur · ${deps.length}</small></h4><div class="deps">${deps.map(d => `<div class="dep" data-truck="${d.t.id}"><time>${hhmm(d.at)}</time><div><b>${d.t.id}${d.tr ? ` + ${d.tr.id}` : ''} <small>${esc(d.driver)}</small></b><span>${esc(DIV[d.t.div].n)} · ${esc(d.dest)}</span></div><em>Dock ${d.dock}</em></div>`).join('') || '<div class="empty">Geen vertrekken in de komende twee uur.</div>'}</div>
      ${yard}
      <div class="btns"><button class="btn" id="toHal">${ic('tv', 14)} Hal-scherm</button><button class="btn" id="toTrl">${ic('trailer', 14)} Opleggers</button><button class="btn pri" id="toPb">Planbord</button></div>`;
  }
  function truckPanel(t, s) {
    if (!s) return ''; const nx = s.next; const drivePct = Math.min(100, s.drive / 270 * 100); const blocks = fleet.blocks(t); const rel = s.rel; let hadNext = false; const d = s.dienst; const T = state.simTime;
    const tl = blocks.filter(b => b.k !== 'terrein' || b.b - b.a > 20).map(b => { const a = b.a - t.dayStart, e = b.b - t.dayStart; let cls = e <= rel ? 'done' : (a <= rel ? 'now' : (hadNext ? 'todo' : (hadNext = true, 'next'))); if (cls === 'now') hadNext = true; const sub = b.k === 'drive' ? `${Math.round(b.b - b.a)} min rijden${b.delay ? ` · <em class="bad">+${b.delay} min</em>` : ''}${b.win ? ` · venster ${hhmm(t.dayStart + b.win[0])}–${hhmm(t.dayStart + b.win[1])}` : ''}` : b.k === 'stop' ? (b.swap ? `${b.swap.drop.id} blijft achter${b.swap.take ? `, ${b.swap.take.id} mee terug` : ', solo terug'}` : `lossen ${Math.round(b.b - b.a)} min`) : b.k === 'laden' ? 'laadpunt gereserveerd' : b.k === 'pauze' ? 'rijtijd gereset' : b.k === 'koppel' ? `${TRT[b.tr.type].n.toLowerCase()}, ${esc(b.tr.lading || 'geladen')}` : b.k === 'ontkoppel' ? 'leeg terug op het terrein' : 'op terrein'; return `<div class="tl ${cls}"><i></i><time>${hhmm(b.a)}${b.k === 'drive' ? '' : ' – ' + hhmm(b.b)}</time><div><b>${esc(b.label)}${b.swap ? ` ${ic('swap', 12)}` : ''}</b><span>${sub}</span></div></div>`; }).join('');
    const dienstRows = t.diensten.map(x => `<div class="drv ${d === x ? 'now' : ''}" data-person="${x.person.id}"><span class="av">${esc(x.person.initials)}</span><div><b>${esc(x.driver)}</b><span>dienst ${x.i + 1} · ${hhmm(x.start)} – ${hhmm(x.end)} · ${x.routes.length} ${x.routes.length === 1 ? 'rit' : 'ritten'}${d === x ? ' · nu' : x.end <= T ? ' · klaar' : ''}</span></div>${ic('chev', 16)}</div>`).join('') || `<div class="al static"><i></i><div><b>Niet ingepland</b><p>${t.vandaag === 'onderhoud' ? 'Vandaag in de werkplaats.' : 'Reservevoertuig, vandaag niet ingezet.'}</p></div></div>`;
    const trs = s.tr ? TRS.get(s.tr.id) : null;
    const trailerBlock = t.kind === 'trekker' ? (s.tr ? `<div class="drv trl" data-trailer="${s.tr.id}"><span class="av tr">${ic('trailer', 15)}</span><div><b>${s.tr.id} <small>${esc(s.tr.plate)}</small></b><span>${trailerLine(s.tr, trs, T, false)}</span></div>${ic('chev', 16)}</div>` : `<div class="al static"><i></i><div><b>Zonder oplegger</b><p>${s.st === 'terrein' ? 'Op het terrein; de volgende oplegger wordt gekoppeld bij vertrek.' : nx && nx.pickup ? `Rijdt solo naar ${esc(nx.pickup.id)} bij ${esc(nx.name.split(' · ')[0])} om die op te halen (aankomst ${hhmm(nx.eta)}).` : 'Rijdt solo terug naar de standplaats.'}</p></div></div>`) : '';
    return `<div class="ph"><h3><span class="plate">${t.id}</span><span class="kent">${esc(t.plate)}</span><span class="kind">${KIND[t.kind].n}</span></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="dt"><b>${esc(t.model)}${t.lzv ? ' · LZV' : ''}</b><span>${esc(DIV[t.div].n)} · ${esc(t.base.n)}${trs && trs.lading ? ` · ${esc(trs.lading)}` : ''}</span><span class="badge ${s.st}">${ST[s.st].n}${s.st === 'vertraagd' && nx ? ` +${nx.delay}` : ''}</span></div>
      <div class="tiles"><div class="tile"><small>Snelheid</small><b>${s.speed} <em>km/u</em></b><span>${nx ? `${nx.kmLeft.toFixed(1).replace('.', ',')} km tot ${esc(nx.name)}` : 'stilstand'}</span></div><div class="tile"><small>${t.ev ? 'Accu' : 'Brandstof'}</small><b>${Math.round(s.soc)} <em>%</em></b><div class="bar"><i style="width:${Math.round(s.soc)}%;background:${s.soc < 20 ? '#DC2626' : '#16A34A'}"></i></div><span>${Math.round(t.range * s.soc / 100)} km bereik</span></div><div class="tile"><small>Rijtijd</small><b>${fmtDrive(s.drive)} <em>/ 4:30</em></b><div class="bar"><i style="width:${drivePct}%;background:${drivePct > 88 ? '#DC2626' : drivePct > 70 ? '#D97706' : '#16A34A'}"></i></div><span>pauze uiterlijk ${hhmm(T + Math.max(0, 270 - s.drive))}</span></div><div class="tile"><small>Volgende stop</small><b>${nx ? hhmm(nx.eta) : '–'}</b><span>${nx ? (nx.win ? `venster ${hhmm(nx.win[0])}–${hhmm(nx.win[1])}${nx.eta > nx.win[1] ? ' <em class="bad">te laat</em>' : ''}` : esc(nx.name)) : 'dienst afgerond'}</span></div></div>
      <h4 class="sub">Chauffeurs vandaag <small>geen vaste wagen</small></h4>${dienstRows}
      ${t.kind === 'trekker' ? `<h4 class="sub">Oplegger</h4>${trailerBlock}` : ''}
      ${t.storing ? `<div class="al bad static"><i></i><div><b>Techniek</b><p>${esc(t.storing)}${t.workorder ? ' · werkorder aangemaakt' : ''}</p></div></div>` : ''}
      <h4 class="sub">Berichten <small>voorgelezen in de cabine</small></h4><div class="msgs">${(t.msgs || []).slice(-5).map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)} · ${m.me ? 'planning' : esc((driverName(t) || 'chauffeur').split(' ')[0])}</time></div>`).join('') || '<div class="empty">Nog geen berichten vandaag.</div>'}</div>
      ${d ? `<div class="quick">${QUICK.map(x => `<button class="chip sm" data-quick="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="ask"><input id="msgIn" placeholder="Bericht aan ${esc(d.driver.split(' ')[0])}…" autocomplete="off"><button class="btn pri sm" id="msgSend">Stuur</button></div>` : ''}
      <h4 class="sub">Dagplan <small>${t.routes.length} ${t.routes.length === 1 ? 'rit' : 'ritten'} · ${Math.round(t.routes.reduce((a, r) => a + r.total, 0))} km</small></h4><div class="tls">${tl || '<div class="empty">Geen ritten vandaag.</div>'}</div>
      <div class="btns"><button class="btn" id="toPb2">Planbord</button><button class="btn" id="shareBtn">Deel link</button><button class="btn pri" id="openSheet">Open voertuig</button></div>`;
  }
  function trailerPanel(tr) {
    const s = trailerState(tr); const T = state.simTime; const info = people.forTrailer.get(tr.id); const tt = TRT[tr.type]; const temp = fleet.trailerTemp(tr, T);
    const evs = tr.events.filter(e => e.k === 'coupled' || e.k === 'site').sort((a, b) => a.a - b.a).map(e => {
      const a = ((e.a % 1440) + 1440) % 1440, b = ((e.b % 1440) + 1440) % 1440;
      const Tc = e.a > 1440 && T < e.a - 1440 ? T + 1440 : T; const cls = e.b <= Tc ? 'done' : e.a <= Tc ? 'now' : 'todo';
      if (e.k === 'coupled') return { a: e.a, html: `<div class="tl ${cls} ${e.planned ? 'ingevoegd' : ''}"><i></i><time>${hhmm(a)} – ${hhmm(b)}</time><div><b>${e.planned ? 'Opgehaald door' : 'Achter'} ${e.vehicle.id}</b><span>${esc(e.vehicle.diensten.find(x => x.rel0 + e.vehicle.dayStart <= e.a) ? e.vehicle.diensten.filter(x => e.vehicle.dayStart + x.rel0 <= e.a).pop().driver : '')} · ${esc(e.lading || 'leeg')}${e.planned ? ' · ingepland door de planner' : ''}</span></div></div>` };
      const pb = tr.pickupBy && tr.pickupBy.at >= e.a && tr.pickupBy.at <= e.b + 1;
      return { a: e.a, html: `<div class="tl ${cls}"><i></i><time>${hhmm(a)}</time><div><b>Achtergelaten bij ${esc(e.place.name)}</b><span>${e.loaded ? `geladen, lossen tot ${hhmm(e.unloadAt)}` : 'leeg'} · ${pb ? `wordt opgehaald door ${tr.pickupBy.t.id} om ${hhmm(tr.pickupBy.eta)}` : `ophalen ${e.pickup >= 1440 ? 'morgen ' : ''}${hhmm(e.pickup)}`}</span></div></div>` };
    });
    const where = s.st === 'gekoppeld' ? `achter <a class="lnk" data-truck="${s.vehicle.id}">${s.vehicle.id}</a> (${esc(driverName(s.vehicle) || 'geen chauffeur')})${s.moving ? ', onderweg' : ', stilstaand'}` : s.st === 'ophalen' ? `${esc(s.place)} · wordt opgehaald door <a class="lnk" data-truck="${s.pickupBy.t.id}">${s.pickupBy.t.id}</a> (${esc(driverName(s.pickupBy.t) || 'reservechauffeur')}), aankomst ${hhmm(s.pickupBy.eta)}` : esc(s.place);
    return `<div class="ph"><h3><span class="plate">${tr.id}</span><span class="kent">${esc(tr.plate)}</span><span class="kind">Oplegger</span></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="dt"><b>${esc(tt.n)}${tr.type === 'lzv' ? ' (ontheffing kernnet)' : ''}</b><span>${esc(DIV[tr.div].n)} · standplaats ${esc(tr.base.n)} · bouwjaar ${tr.bouwjaar}</span><span class="badge trst" style="background:${TRST[s.st].color}">${TRST[s.st].n}</span></div>
      <div class="tiles"><div class="tile"><small>Waar</small><b class="wrap">${where}</b><span>${s.since ? `sinds ${hhmm(s.since)}` : 'vandaag niet verplaatst'}</span></div>${tt.temp ? `<div class="tile ${tr.storing ? 'warnt' : ''}"><small>Temperatuur</small><b>${nl1(temp)} <em>°C</em></b><span>doel ${tt.temp[0]} tot ${tt.temp[1]} °C${tr.storing ? ' · <em class="bad">buiten bereik</em>' : ''}</span></div>` : `<div class="tile"><small>Lading</small><b>${s.loaded ? 'geladen' : 'leeg'}</b><span>${esc(s.lading || (s.st === 'onderhoud' ? 'in de werkplaats' : 'klaar voor de volgende rit'))}</span></div>`}</div>
      ${tt.temp ? `<div class="kv2"><span>Lading</span><b>${esc(s.lading || (s.loaded ? 'geladen' : 'leeg'))}</b></div>` : ''}
      ${s.st === 'wacht' ? `<div class="al ${s.late ? 'warn' : 'info'} static"><i></i><div><b>Wacht op ophalen</b><p>Staat leeg bij ${esc(s.place)} sinds ${hhmm(s.unloadAt)}; ophalen gepland ${s.pickup >= 1440 ? 'morgen ' : ''}${hhmm(s.pickup)}${s.late ? ' <em class="bad">(te laat)</em>' : ''}.</p></div></div>` : s.st === 'ophalen' ? `<div class="al ok static"><i></i><div><b>Wordt opgehaald</b><p>${s.pickupBy.t.id} (${esc(driverName(s.pickupBy.t) || 'reservechauffeur')}) is onderweg; aankomst bij ${esc(s.place)} om ${hhmm(s.pickupBy.eta)}, daarna terug naar ${esc(tr.base.n)}.</p></div></div>` : ''}
      ${tr.storing ? `<div class="al bad static"><i></i><div><b>Koeling</b><p>${esc(tr.storing)}${tr.workorder ? ' · werkorder aangemaakt' : ''}</p></div></div>` : ''}
      <h4 class="sub">Vandaag</h4><div class="tls">${evs.sort((a, b) => a.a - b.a).map(e => e.html).join('') || '<div class="empty">Vandaag niet gebruikt: staat op het terrein.</div>'}</div>
      <h4 class="sub">Keuring en onderhoud</h4><div class="kv2"><span>APK</span><b>geldig tot ${esc(info.apk)}</b>${info.atp ? `<span>ATP</span><b>geldig tot ${esc(info.atp)}</b>` : ''}<span>Onderhoud</span><b>${esc(info.onderhoud.date)} · ${esc(info.onderhoud.what)}</b><span>Banden</span><b>${esc(info.banden)}</b><span>Werkorder</span><b>${info.werkorder ? `${esc(info.werkorder.what)} (${esc(info.werkorder.since)})` : 'geen'}</b></div>
      <div class="btns">${tr.storing && !tr.workorder ? `<button class="btn" data-trworkorder="${tr.id}">${ic('wrench', 14)} Werkorder</button>` : ''}${s.vehicle ? `<button class="btn" data-truck="${s.vehicle.id}">${ic('truck', 14)} Voertuig</button>` : ''}<button class="btn" id="trlMap">${ic('map', 14)} Toon op kaart</button><button class="btn pri" id="toTrlView">Alle opleggers</button></div>`;
  }
  function restPanel(p) {
    const my = rest.myRating(p.id); const s = selTruck && S.get(selTruck.id); const km = s ? Math.round(Math.hypot((p.lon - s.pos.lon) * 68, (p.lat - s.pos.lat) * 111)) : null;
    const star = v => `<span class="stars">${'★'.repeat(Math.round(v))}${'☆'.repeat(5 - Math.round(v))}</span>`;
    return `<div class="ph"><h3>${esc(p.n)}<small>${esc(p.sub)}</small></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="rating"><b>${rest.score(p).toString().replace('.', ',')}</b>${star(rest.score(p))}<span>${p.count + (my ? 1 : 0)} beoordelingen van chauffeurs</span></div>
      <div class="kv2"><span>Plekken</span><b>${p.plekken} trucks${p.lzv ? ' · LZV toegestaan' : ''}</b><span>Veiligheid</span><b>${p.beveiligd ? 'beveiligd terrein, camera\'s' : 'niet beveiligd'}</b><span>Voorzieningen</span><b>${[p.douche ? 'douche' : null, p.eten !== 'geen' ? p.eten : null, p.laders ? `${p.laders} laadpunten` : null, 'toilet'].filter(Boolean).join(', ')}</b>${km !== null ? `<span>Afstand</span><b>${km} km van ${selTruck.id}</b>` : ''}</div>
      <h4 class="sub">Wat chauffeurs zeggen</h4>${p.reviews.map(r => `<div class="rev"><span class="av sm">${r.who}</span><div><b>${star(r.stars)}</b><p>${esc(r.text)}</p></div></div>`).join('')}
      <h4 class="sub">Jouw beoordeling</h4><div class="starbtns">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${my >= n ? 'on' : ''}">★</button>`).join('')}<span>${my ? `${my} van 5 gegeven` : 'klik op een ster'}</span></div>
      <div class="btns">${selTruck && driverName(selTruck) ? `<button class="btn pri" id="proposeRest">Stel voor aan ${esc(driverName(selTruck).split(' ')[0])}</button>` : '<span class="hint2">Selecteer een voertuig met chauffeur om deze plek als pauze voor te stellen.</span>'}</div>`;
  }
  function bindPanel() {
    const p = $('panel');
    p.querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => selectTruck(el.dataset.truck)));
    p.querySelectorAll('[data-trailer]').forEach(el => el.addEventListener('click', () => selectTrailer(el.dataset.trailer)));
    p.querySelectorAll('[data-person]').forEach(el => el.addEventListener('click', () => openSheet('persoon', el.dataset.person)));
    p.querySelectorAll('[data-ex]').forEach(el => el.addEventListener('click', () => { exFilter = el.dataset.ex; renderPanel(); }));
    p.querySelectorAll('[data-done]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); const h = handled.get(el.dataset.done) || {}; h.done = !h.done; handled.set(el.dataset.done, h); frame(true); }));
    p.querySelectorAll('[data-assign]').forEach(el => el.addEventListener('change', () => { const h = handled.get(el.dataset.assign) || {}; h.who = el.value; handled.set(el.dataset.assign, h); if (h.who) notice(`Melding toegewezen aan ${h.who}.`); renderPanel(); }));
    p.querySelectorAll('[data-later]').forEach(el => el.addEventListener('change', () => { const h = handled.get(el.dataset.later) || {}; const m = +el.value; if (el.value === '') return; h.until = m > 0 ? state.simTime + m : 0; handled.set(el.dataset.later, h); notice(m > 0 ? `Melding komt terug om ${hhmm(h.until)}.` : 'Melding staat weer open.'); frame(true); }));
    p.querySelectorAll('[data-trworkorder]').forEach(el => el.addEventListener('click', () => { const tr = fleet.trailerById.get(el.dataset.trworkorder); if (tr) { runAction({ k: 'trworkorder', tr: tr.id, T: state.simTime }, true); notice(`Werkorder aangemaakt voor ${tr.id}.`); frame(true); renderPanel(); } }));
    const tm = $('trlMap'); if (tm) tm.onclick = () => { const tr = selTrailer; if (!tr) return; setTrailersOnMap(true); if (view !== 'kaart') setView('kaart'); const s = trailerState(tr); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 13), duration: FLY }); frame(true); };
    const sd = $('showDone'); if (sd) sd.onclick = () => { showDone = !showDone; renderPanel(); };
    const x = $('closePanel'); if (x) x.onclick = () => closePanel();
    const h = $('toHal'); if (h) h.onclick = () => { hashTo('#hal/' + encodeURIComponent(selSp.n)); fullscreen(); };
    const tv = $('toTrl'); if (tv) tv.onclick = () => setView('opleggers');
    const tv2 = $('toTrlView'); if (tv2) tv2.onclick = () => setView('opleggers');
    const pb = $('toPb'); if (pb) pb.onclick = () => { pbSp = selSp; setView('planbord'); };
    const pb2 = $('toPb2'); if (pb2) pb2.onclick = () => { pbSp = selTruck.base; setView('planbord'); };
    const os = $('openSheet'); if (os) os.onclick = () => openSheet('truck', selTruck.id);
    const sb = $('shareBtn'); if (sb) sb.onclick = () => shareLink(selTruck);
    p.querySelectorAll('[data-quick]').forEach(el => el.addEventListener('click', () => sendMsg(selTruck, el.dataset.quick)));
    const ms = $('msgSend'); if (ms) ms.onclick = () => { const v = $('msgIn').value.trim(); if (v && selTruck) sendMsg(selTruck, v); };
    const mi = $('msgIn'); if (mi) mi.addEventListener('keydown', e => { if (e.key === 'Enter') ms.onclick(); });
    p.querySelectorAll('[data-star]').forEach(el => el.addEventListener('click', () => { rest.rate(selRest.id, +el.dataset.star); renderPanel(); if (view === 'pauze') renderPauze(ctx); }));
    const pr = $('proposeRest'); if (pr) pr.onclick = () => { const s = S.get(selTruck.id); const km = Math.round(Math.hypot((selRest.lon - s.pos.lon) * 68, (selRest.lat - s.pos.lat) * 111)); selTruck.breakPlanned = true; sendMsg(selTruck, `Planning: neem je pauze bij ${selRest.n} (${km} km verderop, ${[selRest.douche ? 'douche' : null, selRest.eten !== 'geen' ? selRest.eten : null].filter(Boolean).join(', ') || 'parkeren'}).`); notice(`Pauze bij ${selRest.n} voorgesteld aan ${driverName(selTruck)}.`); openPanel('truck'); };
  }

  // ---------- selectie ----------
  function selectTruck(id, opts = {}) {
    const t = fleet.byId.get(id); if (!t) return; selTruck = t; selRest = null; selTrailer = null; follow = false; const s = fleet.stateAt(t, state.simTime); S.set(t.id, s);
    if (!opts.stay && view !== 'kaart') setView('kaart');
    if (view === 'kaart') mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 10.2), duration: FLY });
    if (opts.stay || panelOpen()) openPanel('truck');
    if (view === 'pauze') renderPauze(ctx);
    frame(true); syncHash();
  }
  function selectTrailer(id, opts = {}) {
    const tr = fleet.trailerById.get(id); if (!tr) return; selTrailer = tr; selTruck = null; selRest = null; follow = false; mapApi.setRoute(null, null, []);
    const s = fleet.trailerStateAt(tr, state.simTime); TRS.set(tr.id, s);
    if (s.st !== 'gekoppeld' && s.st !== 'onderhoud') setTrailersOnMap(true);
    if (!opts.stay && view !== 'kaart') setView('kaart');
    if (view === 'kaart') mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 11), duration: FLY });
    openPanel('trailer'); frame(true); syncHash();
  }
  function selectSp(sp) {
    selSp = sp; selTruck = null; selRest = null; selTrailer = null; follow = false; mapApi.setRoute(null, null, []); F.sps = new Set([sp.n]); mapApi.highlightSp(sp.n);
    if (view !== 'kaart') setView('kaart'); mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: Math.max(mapApi.map.getZoom(), 9.4), duration: FLY }); openPanel('sp'); frame(true); syncHash();
  }
  function selectRest(id) { const p = rest.byId.get(id); if (!p) return; selRest = p; selTrailer = null; restOnMap = true; mapApi.showRest(true); mapApi.setRest(rest.places, p.id); if (view !== 'kaart') setView('kaart'); mapApi.map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(mapApi.map.getZoom(), 9.6), duration: FLY }); openPanel('rest'); }
  function clearSel() { selTruck = null; selTrailer = null; follow = false; mapApi.setRoute(null, null, []); if (panelMode === 'truck' || panelMode === 'trailer') closePanel(); frame(true); syncHash(); }
  function setTrailersOnMap(v) { trailersOnMap = v; if (mapApi) mapApi.showTrailers(v); renderStatline(); const lt = $('trlTog'); if (lt) lt.classList.toggle('on', v); }
  function hover(id, pt) { hoverId = id; hoverPt = pt; renderTip(); }
  function renderTip() {
    const tip = $('tip'); const t = hoverId && fleet.byId.get(hoverId); const s = t && S.get(t.id);
    if (!t || !s || !hoverPt || view !== 'kaart') { tip.style.display = 'none'; return; }
    tip.style.display = 'block'; tip.style.left = Math.min(hoverPt.x + 14, $('map').clientWidth - 300) + 'px'; tip.style.top = Math.max(8, hoverPt.y - 10) + 'px';
    tip.innerHTML = `<h5><span class="plate">${t.id}</span>${KIND[t.kind].n} · ${esc(t.model.replace('Mercedes-Benz ', ''))}</h5><div class="kv"><span>Chauffeur</span><b>${s.dienst ? `${esc(s.driver)} <small>tot ${hhmm(s.dienst.end)}</small>` : '<span class="mut">geen dienst</span>'}</b>${t.kind === 'trekker' ? `<span>Oplegger</span><b>${s.tr ? `${s.tr.id} · ${TRT[s.tr.type].n.toLowerCase()}` : 'geen (solo)'}</b>` : ''}<span>Standplaats</span><b>${esc(t.base.n)} · ${esc(DIV[t.div].n)}</b><span>Status</span><b style="color:${ST[s.st].color}">${ST[s.st].n}</b>${s.next ? `<span>Volgende</span><b>${esc(s.next.name)} · ETA ${hhmm(s.next.eta)}${s.next.delay ? ` <em class="bad">+${s.next.delay}</em>` : ''}</b>` : ''}</div><small>Klik voor rit en ETA</small>`;
  }

  // ---------- weergaven en record-pagina's ----------
  function setView(name) {
    if (!VIEWS.some(v => v[0] === name)) return; view = name;
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + name));
    $('rail').classList.remove('open'); renderRail(); renderTopbar();
    if (name === 'kaart') setTimeout(() => mapApi && mapApi.map.resize(), 30);
    frame(true); syncHash();
  }
  function openSheet(kind, id, tab) { sheet = { kind, id, tab }; if (panelOpen()) { sheetPanel = panelMode; closePanel(); } renderSheet(ctx, kind, id, tab); $('sheet').hidden = false; $('sheet').scrollTop = 0; syncHash(); }
  let sheetPanel = null;
  function closeSheet() { const cur = readHash(); sheet = null; $('sheet').hidden = true; if (sheetPanel) { openPanel(sheetPanel); sheetPanel = null; } if (!applyingHash && depth() > 0 && sheetOf(cur + '/') && cur !== currentHash()) history.back(); else syncHash(); }

  // ---------- routes: de URL volgt de app (weergave, selectie, pagina, hal-scherm, klant-link) ----------
  // #kaart, #planbord, #voertuigen, #opleggers, #mensen, #standplaatsen, #laden, #lostijden, #pauze, #assistent,
  // #voertuig/T-1002 (op de kaart), #voertuig/T-1002/onderhoud (pagina), #oplegger/O-5150, #persoon/P-0001,
  // #standplaats/Wognum, #hal/Wognum, #klant/T-1002. De terugknop van de browser werkt daardoor; een onbekende hash doet niets.
  // Ingebed: het hal-scherm (tv in de loods) vult het hele scherm; Esc of "Sluiten" sluit beide weer.
  function fullscreen() { if (!embedded || !root.requestFullscreen || document.fullscreenElement) return; root.requestFullscreen().catch(() => {}); }
  if (embedded) document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && (halSp || klantId)) hashTo(''); });
  const VIEW_HASH = { kaart: 'kaart', planbord: 'planbord', trucks: 'voertuigen', opleggers: 'opleggers', mensen: 'mensen', standplaatsen: 'standplaatsen', laden: 'laden', lostijden: 'lostijden', pauze: 'pauze', assistent: 'assistent' };
  const HASH_VIEW = Object.fromEntries(Object.entries(VIEW_HASH).map(([k, v]) => [v, k])); HASH_VIEW.trucks = 'trucks'; HASH_VIEW.pauzeplekken = 'pauze';
  const SHEET_TABS = ['Historie', 'Vandaag', 'Cijfers', 'Onderhoud', 'Documenten'];
  let applyingHash = false;
  // Geschiedenis: elke ingang die de app zelf maakt krijgt een volgnummer in history.state; sluiten (hal, klant-link, pagina) gaat dan echt een stap terug in plaats van een nieuwe ingang te maken. Een tabwissel op een pagina vervangt de ingang.
  let seq = 0; const url = h => location.pathname + location.search + (h ? (h[0] === '#' ? h : '#' + h) : '');
  const depth = () => (history.state && history.state.n) || 0;
  function pushHash(h) { try { history.pushState({ n: ++seq }, '', url(h)); } catch { /* in een afgeschermd venster (artifact) mag dit soms niet */ } }
  function replaceHash(h) { try { history.replaceState(history.state, '', url(h)); } catch { /* idem */ } }
  const sheetOf = x => (/^(voertuig|persoon)\/[^/]+\//.test(x) ? x.split('/').slice(0, 2).join('/') : null);
  const readHash = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } };
  function currentHash() {
    if (halSp) return 'hal/' + halSp; if (klantId) return 'klant/' + klantId;
    if (sheet) return sheet.kind === 'truck' ? `voertuig/${sheet.id}/${(SHEET_TABS.includes(sheet.tab) ? sheet.tab : 'Historie').toLowerCase()}` : `persoon/${sheet.id}`;
    if (view === 'kaart') { if (selTruck) return 'voertuig/' + selTruck.id; if (selTrailer) return 'oplegger/' + selTrailer.id; if (selSp && panelMode === 'sp' && panelOpen()) return 'standplaats/' + selSp.n; }
    return VIEW_HASH[view] || 'kaart';
  }
  function syncHash() { if (applyingHash) return; const h = currentHash(); const cur = readHash(); if (cur === h) return; if (sheetOf(h) && sheetOf(h) === sheetOf(cur)) replaceHash(h); else pushHash(h); }
  // Sluiten (hal, klant-link, pagina) gaat terug naar de weergave eronder en zet die in het adres (replace, geen extra stap in de geschiedenis).
  function hashTo(h) { if (!h && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); if (!h) { if (depth() > 0) { history.back(); return; } h = '#' + (VIEW_HASH[view] || 'kaart'); replaceHash(h); onHash(h, true); return; } if (readHash() !== String(h).replace(/^#/, '')) pushHash(h); onHash(h, true); }
  function onHash(forced, explicit) {
    let h = forced !== undefined ? String(forced).replace(/^#/, '') : readHash(); const [k, ...r] = h.split('/'); let arg = r.join('/'); try { arg = decodeURIComponent(arg); } catch { /* laat staan */ }
    const parts = arg.split('/'); const id = parts[0] || ''; const sub = parts[1] || '';
    applyingHash = true;
    try {
      const wasHal = halSp, wasKlant = klantId; halSp = k === 'hal' ? (SP.find(s => s.n === id) ? id : SP[0].n) : null; klantId = k === 'klant' ? id : null;
      $('hal').hidden = !halSp; $('klant').hidden = !klantId; root.classList.toggle('kiosk', !!(halSp || klantId));
      if (halSp) renderHal(ctx, halSp);
      if (klantId) { if (wasKlant !== klantId) { selectTruck(klantId); follow = true; closePanel(); } renderKlant(ctx, klantId); }
      if (wasKlant && !klantId) { follow = false; }
      if ((wasHal || wasKlant) && !halSp && !klantId) frame(true);
      if (k === 'view' && HASH_VIEW[id]) setView(HASH_VIEW[id]);
      else if (k === 'view' && VIEW_HASH[id]) setView(id);
      else if (HASH_VIEW[k]) { if (sheet) closeSheet(); setView(HASH_VIEW[k]); }
      else if (k === 'voertuig' && fleet.byId.get(id)) { if (sub) openSheet('truck', id, SHEET_TABS.find(x => x.toLowerCase() === sub.toLowerCase()) || 'Historie'); else { if (sheet) closeSheet(); selectTruck(id); openPanel('truck'); } }
      else if (k === 'oplegger' && fleet.trailerById.get(id)) { if (sheet) closeSheet(); selectTrailer(id); }
      else if (k === 'persoon' && people.byId.get(id)) openSheet('persoon', id);
      else if (k === 'standplaats') { const sp = SP.find(s => s.n === id); if (sp) { if (sheet) closeSheet(); selectSp(sp); } }
      else if (!k && !explicit) { if (sheet) closeSheet(); if (selTruck || selTrailer) clearSel(); if (view !== 'kaart') setView('kaart'); }
    } catch (err) { console.warn('route', h, err); } finally { applyingHash = false; }
  }

  // ---------- werkgebied-wizard ----------
  const W = { step: 1, regios: new Set(), divs: new Set(), role: 'planner', sp: '' };
  function openWizard(step) {
    if (profile) { W.regios = new Set(profile.regios || []); W.divs = new Set(profile.divs || Object.keys(DIV)); W.role = profile.role || role; W.sp = profile.sp || ''; } else { W.divs = new Set(Object.keys(DIV)); W.role = role; }
    W.step = step || 1; $('wizard').hidden = false; renderWizard();
  }
  function renderWizard() {
    const steps = [['Regio\'s', W.regios.size ? [...W.regios].join(', ') : 'heel Nederland'], ['Ritten', W.divs.size === Object.keys(DIV).length ? 'alle' : `${W.divs.size} gekozen`], ['Rol', ROLES[W.role].n]];
    const stepHtml = steps.map(([n, s], i) => `<span class="${i + 1 < W.step ? 'done' : i + 1 === W.step ? 'cur' : ''}">${i + 1 < W.step ? ic('check', 12) : `${i + 1}`} ${n}${i + 1 < W.step ? `<small>${esc(s)}</small>` : ''}</span>`).join('');
    let body = '';
    if (W.step === 1) body = `<h2>Welke regio's wil je zien?</h2><p>Je werkgebied bepaalt wat je standaard ziet. Je past het later aan onder <b>Werkgebied</b> in de balk links; het wordt niet elke keer opnieuw gevraagd.</p><div class="tcards">${[['Alle', 'Heel Nederland', `${SP.length} standplaatsen · ${fmt(fleet.trucks.length)} voertuigen`], ...REGIOS.map(r => [r, r, `${SP.filter(s => s.regio === r).length} standplaatsen · ${fmt(SP.filter(s => s.regio === r).reduce((a, s) => a + s.fleet, 0))} voertuigen`])].map(([k, n, d]) => { const on = k === 'Alle' ? !W.regios.size : W.regios.has(k); return `<label class="tcard ${on ? 'on' : ''}" data-regio="${k}"><i class="cb2 ${on ? 'on' : ''}">${on ? ic('check', 12) : ''}</i><b>${n}</b><span>${d}</span></label>`; }).join('')}</div>`;
    else if (W.step === 2) body = `<h2>Welke ritten wil je zien?</h2><p>Kies de divisies die bij je werk horen. Netwerk- en bulkritten lopen door het hele land; winkeldistributie blijft in de regio.</p><div class="tcards">${Object.entries(DIV).map(([k, d]) => `<label class="tcard ${W.divs.has(k) ? 'on' : ''}" data-div="${k}"><i class="cb2 ${W.divs.has(k) ? 'on' : ''}">${W.divs.has(k) ? ic('check', 12) : ''}</i><b>${d.n}</b><span>${DIVDESC[k]}</span></label>`).join('')}</div>`;
    else body = `<h2>Wie ben je?</h2><p>Je rol bepaalt wat je mag zien: planners zien ritten en bevoegdheden, regiomanagers ook rij-scores en schades, directie en HR ook contract en kosten. Kies eventueel je standplaats als startpunt.</p><div class="tcards roles">${Object.entries(ROLES).map(([k, r]) => `<label class="tcard ${W.role === k ? 'on' : ''}" data-role="${k}"><i class="cb2 round ${W.role === k ? 'on' : ''}"></i><b>${r.n}</b><span>${k === 'planner' ? 'ritten, planbord, berichten, bevoegdheden' : k === 'regiomanager' ? 'plus rij-score, schades en kosten per km' : k === 'directie' ? 'alles, inclusief contract en kosten' : 'personeel: bevoegdheden, schades, contract'}</span></label>`).join('')}</div><label class="dd wide"><small>Standplaats als startpunt (optioneel)</small><select id="wzSp"><option value="">Geen, begin bij de regio</option>${SP.slice().sort((a, b) => a.n.localeCompare(b.n)).map(s => `<option ${W.sp === s.n ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>`;
    $('wizard').innerHTML = `<div class="wiz"><div class="wizlogo"><img src="${logo}" alt="Simon Loos"><span>Control Tower</span></div><div class="steps">${stepHtml}</div>${body}<div class="wf"><span class="mut">${W.step === 3 ? 'Alles is later aan te passen onder Werkgebied.' : 'Stap ' + W.step + ' van 3'}</span><div>${profile ? '<button class="btn" id="wzCancel">Annuleren</button>' : ''}${W.step > 1 ? '<button class="btn" id="wzBack">Terug</button>' : ''}<button class="btn pri" id="wzNext">${W.step === 3 ? 'Klaar' : 'Verder'}</button></div></div></div>`;
    $('wizard').querySelectorAll('[data-regio]').forEach(c => c.addEventListener('click', () => { const k = c.dataset.regio; if (k === 'Alle') W.regios.clear(); else { W.regios.has(k) ? W.regios.delete(k) : W.regios.add(k); if (W.regios.size === REGIOS.length) W.regios.clear(); } renderWizard(); }));
    $('wizard').querySelectorAll('[data-div]').forEach(c => c.addEventListener('click', () => { const k = c.dataset.div; if (W.divs.has(k) && W.divs.size > 1) W.divs.delete(k); else W.divs.add(k); renderWizard(); }));
    $('wizard').querySelectorAll('[data-role]').forEach(c => c.addEventListener('click', () => { W.role = c.dataset.role; renderWizard(); }));
    const sp = $('wzSp'); if (sp) sp.onchange = e => { W.sp = e.target.value; };
    const b = $('wzBack'); if (b) b.onclick = () => { W.step--; renderWizard(); };
    const c = $('wzCancel'); if (c) c.onclick = () => { $('wizard').hidden = true; };
    $('wzNext').onclick = () => { if (W.step < 3) { W.step++; renderWizard(); return; } profile = { regios: [...W.regios], divs: [...W.divs], role: W.role, sp: W.sp }; store.set('sl-werkgebied', JSON.stringify(profile)); $('wizard').hidden = true; applyProfile(); notice(`Werkgebied opgeslagen: ${scopeLabel()}, ${divLabel()}, als ${ROLES[role].n.toLowerCase()}.`); };
  }

  // ---------- zoekpalet ----------
  let palIdx = 0, palItems = [];
  function openPalette() { $('palette').hidden = false; $('palette').innerHTML = `<div class="pal"><div class="palin">${ic('search', 18)}<input id="palIn" placeholder="Zoek voertuig, oplegger, kenteken, chauffeur, standplaats, winkel of pauzeplek" autocomplete="off"><kbd>Esc</kbd></div><div class="pal-list" id="palList"></div><div class="palfoot">↑↓ kiezen · Enter openen · toetsen 1 tot 0 wisselen van weergave · f volgt het geselecteerde voertuig</div></div>`; const inp = $('palIn'); inp.focus(); inp.addEventListener('input', () => { palIdx = 0; renderPal(inp.value); }); inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { palIdx = Math.min(palItems.length - 1, palIdx + 1); renderPal(inp.value, true); e.preventDefault(); } else if (e.key === 'ArrowUp') { palIdx = Math.max(0, palIdx - 1); renderPal(inp.value, true); e.preventDefault(); } else if (e.key === 'Enter') { const it = palItems[palIdx]; if (it) { closePalette(); it.run(); } } else if (e.key === 'Escape') closePalette(); }); $('palette').addEventListener('click', e => { if (e.target === $('palette')) closePalette(); }); renderPal(''); }
  function closePalette() { $('palette').hidden = true; }
  function searchAll(qs) {
    const s = qs.trim().toLowerCase(); const out = []; const has = v => v.toLowerCase().includes(s);
    if (!s) { out.push(...VIEWS.map(v => ({ type: 'Weergave', label: v[1], sub: '', run: () => setView(v[0]) }))); return out.slice(0, 10); }
    for (const v of VIEWS) if (has(v[1])) out.push({ type: 'Weergave', label: v[1], sub: 'open deze weergave', run: () => setView(v[0]) });
    for (const sp of SP) if (has(sp.n)) { out.push({ type: 'Standplaats', label: sp.n, sub: `${sp.fleet} voertuigen · ${sp.regio}`, run: () => selectSp(sp) }); out.push({ type: 'Hal-scherm', label: `Hal-scherm ${sp.n}`, sub: 'vertrekbord op volledig scherm', run: () => { hashTo('#hal/' + encodeURIComponent(sp.n)); fullscreen(); } }); }
    let n = 0; for (const t of fleet.trucks) { if (n > 8) break; if (has(t.id) || has(t.plate) || t.diensten.some(d => has(d.driver))) { n++; const st = S.get(t.id); out.push({ type: KIND[t.kind].n, label: `${t.id} · ${driverName(t) || 'geen dienst'}`, sub: `${t.model.replace('Mercedes-Benz ', '')} · ${t.base.n}${st ? ' · ' + ST[st.st].n : ''}`, run: () => selectTruck(t.id) }); } }
    n = 0; for (const tr of fleet.trailers) { if (n > 6) break; if (has(tr.id) || has(tr.plate)) { n++; const st = TRS.get(tr.id); out.push({ type: 'Oplegger', label: `${tr.id} · ${TRT[tr.type].n}`, sub: `${tr.base.n}${st ? ' · ' + TRST[st.st].n + (st.vehicle ? ` achter ${st.vehicle.id}` : st.place ? ` · ${st.place}` : '') : ''}`, run: () => selectTrailer(tr.id) }); } }
    n = 0; for (const p of people.persons) { if (n > 6) break; if (has(p.name)) { n++; out.push({ type: 'Persoon', label: p.name, sub: `${p.role} · ${p.base.n}${p.dienst ? ` · vandaag op ${p.dienst.t.id}` : ' · vandaag vrij'}`, run: () => openSheet('persoon', p.id) }); } }
    n = 0; for (const e of lostijden.stops) { if (n > 5) break; if (has(e.name)) { n++; out.push({ type: 'Winkel', label: e.name, sub: `${e.n} stops per dag · gepland ${Math.round(e.planned)} min, gemeten ${Math.round(e.avg)} min`, run: () => { const t = fleet.byId.get([...e.trucks][0]); if (t) selectTruck(t.id); } }); } }
    n = 0; for (const p of rest.places) { if (n > 4) break; if (has(p.n)) { n++; out.push({ type: 'Pauzeplek', label: p.n, sub: `${rest.score(p).toString().replace('.', ',')}★ · ${p.sub}`, run: () => selectRest(p.id) }); } }
    // werkorders: storingen van vandaag en open werkorders uit het wagenparksysteem
    n = 0; const wo = 'werkorder'.startsWith(s) || /storing|garage|werkplaats/.test(s);
    for (const t of fleet.trucks) { if (n > 5) break; const info = people.forTruck.get(t.id); const w = t.storing || (info.werkorder && info.werkorder.what); if (!w) continue; if (wo || has(w) || has(t.id)) { n++; out.push({ type: 'Werkorder', label: `${t.id} · ${w}`, sub: t.workorder ? `werkorder aangemaakt ${hhmm(t.workorder.at || state.simTime)} · ${t.workorder.gepland || 'na de dienst'}` : t.storing ? 'gemeld vandaag, nog geen werkorder' : `open sinds ${info.werkorder.since}${info.werkorder.gepland ? ' · ' + info.werkorder.gepland : ''}`, run: () => openSheet('truck', t.id, 'Onderhoud') }); } }
    for (const tr of fleet.trailers) { if (n > 8) break; const info = people.forTrailer.get(tr.id); const w = tr.storing || (info.werkorder && info.werkorder.what); if (!w) continue; if (wo || has(w) || has(tr.id)) { n++; out.push({ type: 'Werkorder', label: `${tr.id} · ${w}`, sub: tr.workorder ? `werkorder aangemaakt ${hhmm(tr.workorder.at || state.simTime)}` : tr.storing ? 'gemeld vandaag, nog geen werkorder' : `open sinds ${info.werkorder.since}${info.werkorder.gepland ? ' · ' + info.werkorder.gepland : ''}`, run: () => selectTrailer(tr.id) }); } }
    for (const v of savedViews()) if (has(v.name)) out.push({ type: 'Opgeslagen weergave', label: v.name, sub: v.scope, run: () => applyView(v) });
    return out.slice(0, 14);
  }
  function renderPal(qs, keep) { palItems = searchAll(qs); if (!keep) palIdx = 0; const L = $('palList'); L.innerHTML = palItems.map((it, i) => `<button class="pal-item ${i === palIdx ? 'on' : ''}" data-i="${i}"><span class="pal-type">${esc(it.type)}</span><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></button>`).join('') || '<div class="empty">Niets gevonden.</div>'; L.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { closePalette(); palItems[+b.dataset.i].run(); })); const on = L.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }

  // ---------- sneltoetsen ----------
  document.addEventListener('keydown', e => {
    // Ingebed in een pagina: alleen toetsen met de focus in de app tellen (een klik in de app geeft de root de focus); de rest van de pagina houdt zijn eigen toetsen.
    if (embedded && !(e.target instanceof Element && root.contains(e.target))) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
    if (e.key === 'Escape') { if (!$('palette').hidden) closePalette(); else if (sheet) closeSheet(); else if (!$('wizard').hidden && profile) $('wizard').hidden = true; else if (halSp || klantId) hashTo(''); else if (selTruck || selTrailer) clearSel(); else if (panelOpen()) closePanel(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (KEYS.includes(e.key) && VIEWS[KEYS.indexOf(e.key)]) setView(VIEWS[KEYS.indexOf(e.key)][0]);
    else if (e.key === 'f' && selTruck) { follow = !follow; renderFcard(); if (panelMode === 'truck') renderPanel(); }
    else if (e.key === 'o') setTrailersOnMap(!trailersOnMap);
    else if (e.key === 'd') set3dMode(!three);
    else if (e.key === '?') notice('Sneltoetsen: / zoeken · 1 tot 0 weergaven · f volgen · o losse opleggers · d 3D-wereld · Esc sluiten · m meldingen');
    else if (e.key === 'm') { panelOpen() && panelMode === 'meld' ? closePanel() : openPanel('meld'); }
  });

  // ---------- tijdbalk, kaartlagen, meldingen ----------
  $('timebar').innerHTML = `<span class="lbl">Vandaag</span><input type="range" id="scrub" min="0" max="1439" step="1" value="0" aria-label="Tijd van vandaag"><b id="tbClock">--:--</b><button class="tb" id="playBtn" title="Pauzeer of speel af">${ic('pause', 12)}</button><div class="spd">${[1, 12, 60, 300].map(s => `<button data-s="${s}" class="${s === state.speed ? 'on' : ''}">${s}×</button>`).join('')}</div><button class="tb" id="nowBtn" title="Spring naar de echte klok">Nu</button>`;
  $('scrub').addEventListener('input', e => { state.simTime = +e.target.value; frame(true); });
  $('playBtn').onclick = () => { state.playing = !state.playing; $('playBtn').innerHTML = state.playing ? ic('pause', 12) : ic('play', 12); };
  $('nowBtn').onclick = () => { const n = new Date(); state.simTime = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; frame(true); };
  $('timebar').querySelector('.spd').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; state.speed = +b.dataset.s; $('timebar').querySelectorAll('.spd button').forEach(x => x.classList.toggle('on', x === b)); });
  // 3D-wereld aan of uit: aan kantelt de kaart en vliegt naar de standplaats (of het geselecteerde voertuig); uit gaat terug naar plat en de vorige positie
  function set3dMode(v) {
    if (!mapApi || !mapApi.has3d()) { if (v) notice('De 3D-wereld heeft WebGL nodig; deze browser heeft dat niet.'); return; }
    three = !!v; store.set('sl-3d', three ? 'on' : 'off'); root.classList.toggle('three', three); mapApi.set3d(three);
    if (three) { prevCam = { center: mapApi.map.getCenter(), zoom: mapApi.map.getZoom() }; const s = selTruck && S.get(selTruck.id); const sp = selSp || SP.find(x => x.n === (profile && profile.sp)) || SP[0]; mapApi.map.easeTo({ center: s ? [s.pos.lon, s.pos.lat] : [sp.lon, sp.lat], zoom: s ? 14.2 : 13.6, pitch: 58, bearing: -18, duration: RM ? 0 : 1400 }); lastFollow = Date.now() + 1500; }
    else { mapApi.map.easeTo({ pitch: 0, bearing: 0, zoom: prevCam ? prevCam.zoom : 10, center: prevCam ? prevCam.center : mapApi.map.getCenter(), duration: RM ? 0 : 900 }); lastFollow = Date.now() + 1000; }
    renderMapTools(); frame(true);
  }
  function renderMapTools() {
    const d3 = mapApi && mapApi.has3d();
    $('maptools').innerHTML = `<button class="ib" id="layersBtn" title="Kaartlagen">${ic('layers', 16)}</button>${d3 ? `<button class="ib ${three ? 'on' : ''}" id="threeBtn" title="3D-wereld (toets d)" aria-pressed="${three}">${ic('box', 16)}</button>` : ''}<div class="pop" id="layersPop" hidden>${d3 ? `<label class="sw ${three ? 'on' : ''}" id="threeTog"><i></i><span>3D-wereld (toets d)</span></label>` : ''}${mapApi && mapApi.hasTiles() ? `<label class="sw ${mapApi.isOnline() ? 'on' : ''}" id="onlineTog"><i></i><span>Online kaartlaag (OpenStreetMap)</span></label>` : ''}<label class="sw ${trailersOnMap ? 'on' : ''}" id="trlTog"><i></i><span>Losse opleggers (toets o)</span></label><label class="sw ${F.dim ? 'on' : ''}" id="dimTog"><i></i><span>Andere standplaatsen gedimd tonen</span></label><label class="sw ${restOnMap ? 'on' : ''}" id="restTog"><i></i><span>Pauzeplekken</span></label></div>`;
    $('layersBtn').onclick = () => { $('layersPop').hidden = !$('layersPop').hidden; };
    if ($('threeBtn')) $('threeBtn').onclick = () => set3dMode(!three);
    if ($('threeTog')) $('threeTog').onclick = () => set3dMode(!three);
    if ($('onlineTog')) $('onlineTog').onclick = () => { if (!mapApi) return; const v = !mapApi.isOnline(); if (v && !mapApi.hasOnline()) { notice('De online kaartlaag is in deze omgeving niet bereikbaar.'); return; } mapApi.setOnline(v); store.set('sl-online', v ? 'on' : 'off'); $('onlineTog').classList.toggle('on', v); };
    $('trlTog').onclick = () => setTrailersOnMap(!trailersOnMap);
    $('dimTog').onclick = () => { F.dim = !F.dim; $('dimTog').classList.toggle('on', F.dim); frame(true); };
    $('restTog').onclick = () => { setRestOnMap(!restOnMap); $('restTog').classList.toggle('on', restOnMap); };
  }
  function setRestOnMap(v) { restOnMap = v; if (mapApi) { mapApi.showRest(v); if (v) mapApi.setRest(rest.places, selRest && selRest.id); } }
  let noticeT = null; function notice(msg) { const n = $('notice'); n.textContent = msg; n.classList.add('on'); clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('on'), 7000); }

  const ctx = { fleet, state, store, people, rest, lostijden, F, S, TRS, $, esc, ic, role: () => role, can, selectTruck, selectTrailer, selectSp, selectRest, openSheet, closeSheet, openPanel, closePanel, setView, notice, sendMsg, exceptions: () => exceptions, openExceptions: () => exceptions.filter(isOpen), isOpen, kpi: () => kpi, counts: () => counts, feed, applied, chat, msgCount: () => msgCount, handled, runAction, applyProposal, pbSp: () => pbSp, setPbSp: sp => { pbSp = sp; }, pbF, COLLEGAS, matchBase, inScope, inScopeBase, visible: t => visible(t), selTruck: () => selTruck, selTrailer: () => selTrailer, frame, hashTo, syncHash, restOnMap: () => restOnMap, setRestOnMap: v => { setRestOnMap(v); renderMapTools(); }, trailersOnMap: () => trailersOnMap, setTrailersOnMap, three: () => three, set3dMode, mapApi: () => mapApi, fullscreen, embedded, driverName, driverOf, trailerState, trailerLine, fmtDrive, KIND, TRT, TRST };

  if (embedded) { root.tabIndex = -1; root.addEventListener('pointerdown', () => { if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); }); }
  function attachMap(api) { mapApi = api; api.whenReady(() => { renderMapTools(); frame(true); }); }
  function start() { renderRail(); renderTopbar(); restoreActs(); window.addEventListener('popstate', () => { if (readHash() !== currentHash()) onHash(); }); window.addEventListener('hashchange', () => { if (readHash() !== currentHash()) onHash(); }); if (profile) applyProfile(); else openWizard(1); onHash(); frame(true); if (three && mapApi && mapApi.has3d()) { three = false; mapApi.whenReady(() => set3dMode(true)); } }
  return { attachMap, frame, selectTruck, selectTrailer, selectSp, selectRest, hover, notice, start, openWizard, setView, openSheet, runAction, ctx };
}
