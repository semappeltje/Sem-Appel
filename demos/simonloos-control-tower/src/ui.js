// Interface 2.0: iconenbalk, topbalk met werkgebied en rol, kaart met statusregel en truckkaartje, meldingenpaneel,
// werkgebied-wizard, zoekpalet, sneltoetsen, opgeslagen weergaven, record-pagina's en routes voor hal-scherm en klant-link.
import { SP, REGIOS, DIV, ST, ROLES, CAN, laadpunten, fmt, hhmm } from './places.js';
import { ic } from './icons.js';
import { renderPlanbord, renderSpView, renderAssist, renderHal, renderKlant } from './views.js';
import { renderSheet } from './sheets.js';
import { renderTrucks, renderMensen, renderLostijden, renderLaden, renderPauze } from './tables.js';
import logo from './assets/logo.png';

const VIEWS = [['kaart', 'Kaart', 'map'], ['planbord', 'Planbord', 'cal'], ['trucks', 'Trucks', 'truck'], ['mensen', 'Mensen', 'users'], ['standplaatsen', 'Standplaatsen', 'home'], ['laden', 'Laden', 'bolt'], ['lostijden', 'Lostijden', 'clock'], ['pauze', 'Pauzeplekken', 'coffee'], ['assistent', 'Assistent', 'spark']];
const COLLEGAS = [['Sanne Vlaar', 'Wognum', 'Planner winkeldistributie', 360, 840], ['Ruud Koning', 'Wognum', 'Planner netwerk', 780, 1260], ['Fatima el Idrissi', 'Wognum', 'Planner bulk (avond)', 780, 1260], ['Daan Smit', 'Zaandam', 'Planner Albert Heijn', 300, 780], ['Ilse Bakker', 'Geldermalsen', 'Planner netwerk', 420, 900], ['Marco de Boer', 'Wognum', 'Garage en wasstraat', 420, 960], ['Anouk Groot', 'Wognum', 'Teamleider control tower', 480, 1020]];
const QUICK = ['Dock gewijzigd, zie app', 'Pauze bij de volgende stop', 'Bel de planning als je stilstaat', 'Rij na deze stop terug naar de standplaats'];
const REPLIES = ['👍 Ontvangen', 'Oké, doe ik.', 'Begrepen, ik rij door naar de volgende stop.', 'Top, bedankt.'];
const DIVDESC = { winkel: 'Albert Heijn, Jumbo, Plus, Lidl, SPAR, Vomar', netwerk: 'DC naar DC, crossdock Tiel en Geldermalsen, LZV', bulk: 'Poeders, granulaat, suiker', dranken: 'Heineken, Bavaria, Vrumona', bezorg: 'AH Home Service, bestelbussen' };

export function createUI(fleet, state, store, { people, rest, lostijden }) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = { regios: new Set(), sps: new Set(), divs: new Set(Object.keys(DIV)), sts: new Set(Object.keys(ST)), q: '', dim: true };
  let role = ROLES[store.get('sl-role')] ? store.get('sl-role') : 'planner';
  let profile = null; try { profile = JSON.parse(store.get('sl-werkgebied') || 'null'); } catch { profile = null; }
  let mapApi = null, selTruck = null, selSp = null, selRest = null, follow = false, lastFollow = 0, panelMode = 'meld', hoverId = null, hoverPt = null, view = 'kaart', tick = 0, pbSp = SP[0], exFilter = 'Alle', showDone = false, restOnMap = false, sheet = null, halSp = null, klantId = null;
  const S = new Map(), prevSt = new Map(), handled = new Map(); const feed = [], applied = [], chat = []; let exceptions = [], counts = {}, kpi = {}, msgCount = 0;
  const can = perm => CAN[perm].includes(role);

  // ---------- berichten ----------
  function sendMsg(t, text, me = true) {
    t.msgs = t.msgs || []; t.msgs.push({ me, text, T: state.simTime });
    if (me) { msgCount++; setTimeout(() => { t.msgs.push({ me: false, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], T: state.simTime }); if (selTruck === t && panelMode === 'truck') renderPanel(); if (view === 'assistent') renderAssist(ctx); }, 3500 + Math.random() * 4000); }
    if (selTruck === t && panelMode === 'truck') renderPanel();
  }

  // ---------- filters en werkgebied ----------
  const q = () => F.q.toLowerCase();
  const inScopeBase = (base, div) => (!F.regios.size || F.regios.has(base.regio)) && F.divs.has(div) && (!F.sps.size || F.sps.has(base.n));
  function matchBase(t) { return (!F.regios.size || F.regios.has(t.base.regio)) && F.divs.has(t.div) && (!F.q || t.id.toLowerCase().includes(q()) || t.driver.toLowerCase().includes(q()) || t.base.n.toLowerCase().includes(q()) || t.plate.toLowerCase().includes(q())); }
  const inScope = t => matchBase(t) && (!F.sps.size || F.sps.has(t.base.n));
  const visible = (t, s) => inScope(t) && F.sts.has((s || S.get(t.id) || {}).st);
  const scopeLabel = () => F.sps.size === 1 ? [...F.sps][0] : F.sps.size > 1 ? `${F.sps.size} standplaatsen` : !F.regios.size ? 'Nederland' : F.regios.size === REGIOS.length ? 'Nederland' : [...F.regios].join(', ');
  const divLabel = () => F.divs.size === Object.keys(DIV).length ? 'alle ritten' : [...F.divs].map(k => DIV[k].n.toLowerCase()).join(', ');
  function applyProfile() {
    if (!profile) return;
    F.regios = new Set((profile.regios || []).filter(r => REGIOS.includes(r))); F.divs = new Set((profile.divs || []).filter(k => DIV[k])); if (!F.divs.size) F.divs = new Set(Object.keys(DIV));
    role = ROLES[profile.role] ? profile.role : role; store.set('sl-role', role);
    F.sps = new Set(profile.sp && SP.find(s => s.n === profile.sp) ? [profile.sp] : []);
    if (mapApi) { if (F.sps.size) { const sp = SP.find(s => s.n === profile.sp); mapApi.highlightSp(sp.n); mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: 9.4, duration: 900 }); } else if (F.regios.size && F.regios.size < REGIOS.length) mapApi.fitSps(SP.filter(s => F.regios.has(s.regio))); else mapApi.map.easeTo({ center: [5.3, 52.2], zoom: 6.6, duration: 900 }); }
    renderTopbar(); renderRail(); frame(true);
  }

  // ---------- iconenbalk en topbalk ----------
  function renderRail() {
    $('rail').innerHTML = `<img src="${logo}" alt="Simon Loos" class="rl">${VIEWS.map((v, i) => `<button class="ri ${view === v[0] ? 'on' : ''}" data-view="${v[0]}" title="${v[1]} (toets ${i + 1})">${ic(v[2], 20)}<span>${v[1]}</span></button>`).join('')}
      <div class="rail-foot"><button class="ri" id="wgBtn" title="Mijn werkgebied">${ic('settings', 20)}<span>Werkgebied</span></button><button class="ri" id="themeBtn" title="Licht of donker">${ic(state.theme === 'dark' ? 'sun' : 'moon', 20)}<span>Thema</span></button><div class="av" id="meAv" title="${ROLES[role].n}">${role === 'hr' ? 'HR' : role[0].toUpperCase() + role[1]}</div></div>`;
    $('rail').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $('wgBtn').onclick = () => openWizard(1);
    $('themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; state.theme = t; store.set('sl-theme', t); mapApi && mapApi.setTheme(t); renderRail(); };
  }
  function renderTopbar() {
    const v = VIEWS.find(x => x[0] === view);
    $('topbar').innerHTML = `<button class="ib mob" id="menuBtn">${ic('menu', 18)}</button><div class="tt"><b id="vtitle">${v[1]}</b><span id="vsub"></span></div>
      <div class="tr"><button class="srch" id="palBtn">${ic('search', 16)}<span>Zoek truck, persoon, standplaats</span><kbd>/</kbd></button>
      <div class="dropdown"><button class="btn" id="viewsBtn">${ic('save', 15)} <span class="lbl">Weergaven</span></button><div class="menu" id="viewsMenu" hidden></div></div>
      <div class="seg2" id="roleSeg"><span>Bekijk als</span>${Object.entries(ROLES).map(([k, r]) => `<button class="${role === k ? 'on' : ''}" data-role="${k}">${r.n}</button>`).join('')}</div>
      <button class="ib" id="bellBtn" title="Meldingen">${ic('bell', 17)}<i id="bellDot" hidden></i></button>
      <div class="live"><i></i><b id="clock">${hhmm(state.simTime)}</b></div></div>`;
    $('palBtn').onclick = openPalette;
    $('bellBtn').onclick = () => { if (panelOpen() && panelMode === 'meld') closePanel(); else openPanel('meld'); };
    $('menuBtn').onclick = () => $('rail').classList.toggle('open');
    $('roleSeg').addEventListener('click', e => { const b = e.target.closest('[data-role]'); if (!b) return; role = b.dataset.role; store.set('sl-role', role); if (profile) { profile.role = role; store.set('sl-werkgebied', JSON.stringify(profile)); } renderTopbar(); renderRail(); if (sheet) openSheet(sheet.kind, sheet.id, sheet.tab); if (view === 'mensen') renderMensen(ctx); notice(`Je kijkt nu als ${ROLES[role].n.toLowerCase()}: ${ROLES[role].sub}.`); });
    $('viewsBtn').onclick = () => { const m = $('viewsMenu'); m.hidden = !m.hidden; if (!m.hidden) renderViewsMenu(); };
    document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) { const m = $('viewsMenu'); if (m) m.hidden = true; } });
    updateSub();
  }
  function updateSub() { const s = $('vsub'); if (s) s.textContent = `${scopeLabel()} · ${divLabel()} · ${fmt(kpi.nVis || 0)} trucks`; const open = exceptions.filter(e => !(handled.get(e.key) || {}).done).length; const d = $('bellDot'); if (d) d.hidden = !open; const c = $('clock'); if (c) c.textContent = hhmm(state.simTime); const tb = $('tbClock'); if (tb) tb.textContent = hhmm(state.simTime); const sc = $('scrub'); if (sc && document.activeElement !== sc) sc.value = Math.floor(state.simTime); }

  // ---------- opgeslagen weergaven ----------
  const savedViews = () => { try { return JSON.parse(store.get('sl-views') || '[]'); } catch { return []; } };
  function renderViewsMenu() {
    const L = savedViews();
    $('viewsMenu').innerHTML = `${L.map((v, i) => `<div class="mi"><button data-apply="${i}">${ic('eye', 14)} ${esc(v.name)}<small>${esc(v.scope)}</small></button><button class="del" data-del="${i}" title="Verwijderen">${ic('trash', 13)}</button></div>`).join('') || '<div class="mi mut">Nog geen opgeslagen weergaven.</div>'}<div class="mi"><button id="saveView">${ic('plus', 14)} Huidige weergave opslaan</button></div>`;
    $('viewsMenu').querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { applyView(L[+b.dataset.apply]); $('viewsMenu').hidden = true; }));
    $('viewsMenu').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); L.splice(+b.dataset.del, 1); store.set('sl-views', JSON.stringify(L)); renderViewsMenu(); }));
    $('saveView').onclick = () => { const name = prompt('Naam van deze weergave', `${scopeLabel()} ${hhmm(state.simTime)}`); if (!name) return; const c = mapApi.map.getCenter(); L.push({ name, scope: `${scopeLabel()} · ${divLabel()}`, regios: [...F.regios], divs: [...F.divs], sts: [...F.sts], sps: [...F.sps], view, center: [c.lng, c.lat], zoom: mapApi.map.getZoom() }); store.set('sl-views', JSON.stringify(L)); $('viewsMenu').hidden = true; notice(`Weergave "${name}" opgeslagen.`); };
  }
  function applyView(v) { F.regios = new Set(v.regios); F.divs = new Set(v.divs); F.sts = new Set(v.sts); F.sps = new Set(v.sps); mapApi.highlightSp(F.sps.size === 1 ? [...F.sps][0] : null); setView(v.view || 'kaart'); if (v.center) mapApi.map.easeTo({ center: v.center, zoom: v.zoom, duration: 800 }); frame(true); notice(`Weergave "${v.name}" geladen.`); }

  // ---------- frame ----------
  function frame(force) {
    if (!mapApi) return; tick++;
    const T = state.simTime; const feats = [], dims = []; counts = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; exceptions = [];
    let nVis = 0, laden = 0, ritten = 0, stopsDone = 0, stopsLate = 0, ev = 0; const spSeen = new Set();
    for (const t of fleet.trucks) {
      const s = fleet.stateAt(t, T); S.set(t.id, s);
      const vis = visible(t, s);
      if (!vis) { if (F.dim && F.sps.size && !F.sps.has(t.base.n) && matchBase(t) && F.sts.has(s.st)) dims.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); prevSt.set(t.id, s.st); continue; }
      nVis++; counts[s.st]++; spSeen.add(t.base); ritten += t.routes.length; if (t.ev) ev++;
      feats.push({ type: 'Feature', properties: { id: t.id, st: s.st, b: Math.round(s.pos.bearing) }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } });
      if (s.seg.k === 'laden') laden++;
      for (const seg of t.plan) if (seg.k === 'stop' && seg.t1 <= s.rel) { stopsDone++; const d = t.plan[t.plan.indexOf(seg) - 1]; if (d && d.delay) stopsLate++; }
      if (s.st === 'vertraagd' && s.next) exceptions.push({ key: 'V:' + t.id, sev: 'bad', kind: 'Vertraging', t, text: `${s.next.name}: ETA ${hhmm(s.next.eta)}${s.next.win ? `, venster tot ${hhmm(s.next.win[1])}` : ''} (+${s.next.delay} min)` });
      if ((s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240 && !t.breakPlanned) exceptions.push({ key: 'R:' + t.id, sev: 'warn', kind: 'Rijtijd', t, text: `${t.driver}: ${Math.floor(s.drive / 60)}:${String(Math.floor(s.drive % 60)).padStart(2, '0')} van 4:30 rijtijd, pauze binnen ${Math.max(0, 270 - Math.floor(s.drive))} min` });
      if (t.ev && s.soc < 20 && s.st !== 'terrein' && !t.chargePlanned) exceptions.push({ key: 'A:' + t.id, sev: 'warn', kind: 'Accu', t, text: `Accu ${Math.round(s.soc)} % · ${Math.round(t.range * s.soc / 100)} km bereik · ${s.next ? s.next.name : t.base.n}` });
      if (t.storing && s.st !== 'terrein' && !t.workorder) exceptions.push({ key: 'T:' + t.id, sev: 'bad', kind: 'Techniek', t, text: t.storing });
      const p = prevSt.get(t.id); if (p && p !== s.st) pushEvent(t, s, p); prevSt.set(t.id, s.st);
    }
    exceptions.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'bad' ? -1 : 1));
    kpi = { nVis, actief: nVis - counts.terrein, ritten, stopsDone, onTime: stopsDone ? (1 - stopsLate / stopsDone) * 100 : 100, ex: exceptions.length, open: exceptions.filter(e => !(handled.get(e.key) || {}).done).length, laden, ev, lp: [...spSeen].reduce((a, s) => a + laadpunten(s), 0) };
    mapApi.setTrucks(feats, dims);
    if (selTruck) { const s = S.get(selTruck.id); mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); drawRoute(selTruck, s); if (follow && Date.now() - lastFollow > 900) { lastFollow = Date.now(); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], duration: 800 }); } }
    else mapApi.setSelected(null);
    renderStatline(); renderFcard(); updateSub();
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (force || tick % 8 === 0) {
      if (!typing && panelOpen()) renderPanel();
      if (view === 'planbord') renderPlanbord(ctx); if (view === 'standplaatsen') renderSpView(ctx); if (view === 'assistent' && !typing) renderAssist(ctx);
      if (halSp) renderHal(ctx, halSp); if (klantId) renderKlant(ctx, klantId);
    }
    if (force || tick % 40 === 0) { if (!typing) { if (view === 'trucks') renderTrucks(ctx); if (view === 'mensen') renderMensen(ctx); if (view === 'laden') renderLaden(ctx); } }
    if (force) { if (view === 'lostijden') renderLostijden(ctx); if (view === 'pauze') renderPauze(ctx); }
    renderTip();
  }
  function pushEvent(t, s, p) {
    let txt = null;
    if (s.st === 'klant') txt = `aangekomen bij ${s.seg.stop}`;
    else if (s.st === 'pauze') txt = 'pauze gestart (45 min)';
    else if (s.st === 'terrein') txt = `terug op ${t.base.n}${s.seg.k === 'laden' ? ', laadt accu' : ''}`;
    else if (s.st === 'onderweg' || s.st === 'vertraagd') txt = p === 'terrein' ? `vertrokken van ${t.base.n}${s.next ? ` naar ${s.next.name}` : ''}` : `onderweg naar ${s.next ? s.next.name : t.base.n}${s.st === 'vertraagd' ? ' (vertraging)' : ''}`;
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

  // ---------- kaart: statusregel en truckkaartje ----------
  function renderStatline() {
    const el = $('statline'); if (!el) return;
    const items = ['vertraagd', 'onderweg', 'klant'].map(k => `<button class="stb ${F.sts.has(k) ? '' : 'off'}" data-st="${k}"><i style="background:${ST[k].color}"></i>${ST[k].n} <b>${fmt(counts[k] || 0)}</b></button>`).join('');
    const extra = `${F.sts.size < Object.keys(ST).length ? `<button class="stb reset" data-reset="1">Alle statussen</button>` : ''}${F.sps.size ? `<button class="stb chipx" data-clear="sps">${esc(F.sps.size === 1 ? [...F.sps][0] : F.sps.size + ' standplaatsen')} ✕</button>` : ''}${F.q ? `<button class="stb chipx" data-clear="q">Zoek: ${esc(F.q)} ✕</button>` : ''}`;
    const html = `${items}${extra}<button class="stb link" id="allNums">Alle cijfers</button>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.st; if (F.sts.size === Object.keys(ST).length) F.sts = new Set([k]); else if (F.sts.has(k) && F.sts.size === 1) F.sts = new Set(Object.keys(ST)); else if (F.sts.has(k)) F.sts.delete(k); else F.sts.add(k); frame(true); })); const r = el.querySelector('[data-reset]'); if (r) r.onclick = () => { F.sts = new Set(Object.keys(ST)); frame(true); }; el.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { if (b.dataset.clear === 'sps') { F.sps.clear(); selSp = null; mapApi.highlightSp(null); if (panelMode === 'sp') closePanel(); } else F.q = ''; frame(true); })); $('allNums').onclick = () => openPanel('meld'); }
  }
  function renderFcard() {
    const el = $('fcard'); if (!el) return; if (!selTruck || view !== 'kaart') { el.hidden = true; return; }
    const t = selTruck, s = S.get(t.id); if (!s) { el.hidden = true; return; } el.hidden = false; const nx = s.next;
    const html = `<div class="fh"><span class="plate">${t.id}</span><span class="st ${s.st === 'vertraagd' ? 'bad' : s.st === 'pauze' ? 'warn' : s.st === 'terrein' ? '' : 'ok'}">${ST[s.st].n}${s.st === 'vertraagd' && nx ? ` +${nx.delay}` : ''}</span><button class="x" data-act="close" title="Sluiten">${ic('x', 14)}</button></div>
      <div class="fl">${esc(t.driver)} · ${esc(t.model.replace('Mercedes-Benz ', ''))} · ${esc(t.base.n)}</div>
      <div class="fl">${nx ? `→ ${esc(nx.name)} · ETA ${hhmm(nx.eta)}${nx.win ? ` · venster tot ${hhmm(nx.win[1])}` : ''}${nx.eta > (nx.win ? nx.win[1] : Infinity) ? ' <em class="bad">te laat</em>' : ''}` : 'Dienst afgerond'}</div>
      <div class="fa"><a data-act="sheet">Open truck</a><a data-act="panel">Rit en berichten</a><a data-act="link">Deel link</a><a data-act="follow" class="${follow ? 'on' : ''}">${follow ? 'Volgen aan' : 'Volg'}</a></div>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.querySelectorAll('[data-act]').forEach(a => a.addEventListener('click', () => { const k = a.dataset.act; if (k === 'close') clearSel(); else if (k === 'sheet') openSheet('truck', t.id); else if (k === 'panel') openPanel('truck'); else if (k === 'link') shareLink(t); else if (k === 'follow') { follow = !follow; if (follow) mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 11), duration: 900 }); renderFcard(); } })); }
  }
  function shareLink(t) { const url = `${location.href.split('#')[0]}#klant/${t.id}`; try { navigator.clipboard && navigator.clipboard.writeText(url); } catch { /* geen klembord */ } notice(`Klant-link gekopieerd: alleen ${t.id} en de volgende levering zijn zichtbaar. ${url}`); }

  // ---------- paneel rechts ----------
  const panelOpen = () => $('panel').classList.contains('open');
  function openPanel(mode) { panelMode = mode || panelMode; $('panel').classList.add('open'); $('app').classList.add('panel-open'); renderPanel(); setTimeout(() => mapApi && mapApi.map.resize(), 30); }
  function closePanel() { $('panel').classList.remove('open'); $('app').classList.remove('panel-open'); setTimeout(() => mapApi && mapApi.map.resize(), 30); }
  function renderPanel() {
    const p = $('panel');
    if (panelMode === 'truck' && selTruck) p.innerHTML = truckPanel(selTruck, S.get(selTruck.id));
    else if (panelMode === 'sp' && selSp) p.innerHTML = spPanel(selSp);
    else if (panelMode === 'rest' && selRest) p.innerHTML = restPanel(selRest);
    else { panelMode = 'meld'; p.innerHTML = meldPanel(); }
    bindPanel();
  }
  function meldPanel() {
    const k = kpi; const ex = exceptions.filter(e => exFilter === 'Alle' || e.kind === exFilter).filter(e => showDone || !(handled.get(e.key) || {}).done).slice(0, 40);
    const chips = ['Alle', 'Vertraging', 'Rijtijd', 'Accu', 'Techniek'].map(x => `<button class="chip sm ${exFilter === x ? 'on' : ''}" data-ex="${x}">${x}</button>`).join('');
    return `<div class="ph"><h3>Meldingen <b>${k.open || 0}</b></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="cijfers"><div><b>${fmt(k.actief || 0)}</b><span>onderweg van ${fmt(k.nVis || 0)}</span></div><div class="${(k.onTime || 100) < 95 ? 'warn' : 'good'}"><b>${(k.onTime || 100).toFixed(0)} %</b><span>op tijd · doel 95</span></div><div class="${k.open ? 'bad' : ''}"><b>${fmt(k.open || 0)}</b><span>open meldingen</span></div><div><b>${fmt(k.laden || 0)}</b><span>laden nu · ${fmt(k.ev || 0)} e-trucks</span></div><div><b>${fmt(k.ritten || 0)}</b><span>ritten vandaag</span></div><div><b>${fmt(k.stopsDone || 0)}</b><span>stops gedaan</span></div></div>
      <div class="pf">${chips}<label class="sw sm ${showDone ? 'on' : ''}" id="showDone"><i></i><span>afgehandeld tonen</span></label></div>
      <div class="als">${ex.length ? ex.map(e => { const h = handled.get(e.key) || {}; return `<div class="al ${e.sev} ${h.done ? 'done' : ''}"><i></i><div data-truck="${e.t.id}"><b>${e.t.id}</b><span>${esc(e.t.base.n)} · ${esc(e.kind)}</span><p>${esc(e.text)}</p>${h.who ? `<small>toegewezen aan ${esc(h.who)}</small>` : ''}</div><div class="alx"><button class="ok ${h.done ? 'on' : ''}" data-done="${e.key}" title="${h.done ? 'Heropenen' : 'Afgehandeld'}">${ic('check', 13)}</button><select data-assign="${e.key}" title="Toewijzen"><option value="">→</option>${COLLEGAS.map(c => `<option ${h.who === c[0] ? 'selected' : ''}>${esc(c[0])}</option>`).join('')}</select></div></div>`; }).join('') : '<div class="empty">Geen open meldingen binnen je werkgebied.</div>'}</div>
      <h4 class="sub">Gebeurtenissen <small>live</small></h4><div class="evs">${feed.filter(e => inScope(e.t)).slice(0, 14).map(e => `<div class="ev ${e.sev}" data-truck="${e.t.id}"><time>${hhmm(e.T)}</time><span><b>${e.t.id}</b> ${esc(e.t.driver)} ${esc(e.txt)}</span></div>`).join('') || '<div class="empty">Nog geen gebeurtenissen.</div>'}</div>`;
  }
  function spPanel(sp) {
    const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let laden = 0, ev = 0;
    for (const t of mine) { const s = S.get(t.id); if (!s) continue; c[s.st]++; if (s.seg.k === 'laden') laden++; if (t.ev) ev++; }
    const deps = fleet.departures(sp, state.simTime, 120).slice(0, 8); const st = people.spStats.get(sp.n);
    return `<div class="ph"><h3>${esc(sp.n)}<small>${esc([sp.hub ? 'hoofdkantoor' : null, sp.wh ? 'warehouse' : null, sp.klant].filter(Boolean).join(' · '))}</small></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="stat5"><div><b>${mine.length}</b><span>trucks</span></div><div><b>${c.onderweg + c.vertraagd}</b><span>onderweg</span></div><div><b>${c.klant}</b><span>bij klant</span></div><div><b>${c.pauze}</b><span>pauze</span></div><div><b>${c.terrein}</b><span>op terrein</span></div></div>
      <div class="mix">${Object.keys(ST).map(k => `<i style="background:${ST[k].color};flex:${Math.max(c[k], 0.2)}"></i>`).join('')}</div>
      <div class="kv2"><span>Elektrisch</span><b>${ev} trucks · ${laden} laden nu · ${laadpunten(sp)} laadpunten</b><span>Vaste chauffeur</span><b>${Math.round(st.vaste * 100)} % van de diensten · ${st.wissel.toString().replace('.', ',')} wissels per truck per week</b><span>Regio</span><b>${esc(sp.regio)} · ${esc(sp.prov)}</b>${sp.note ? `<span>Locatie</span><b>${esc(sp.note)}</b>` : ''}</div>
      <h4 class="sub">Volgende vertrekken <small>komende 2 uur · ${deps.length}</small></h4><div class="deps">${deps.map(d => `<div class="dep" data-truck="${d.t.id}"><time>${hhmm(d.at)}</time><div><b>${d.t.id} <small>${esc(d.t.driver)}</small></b><span>${esc(DIV[d.t.div].n)} · ${esc(d.dest)}</span></div><em>Dock ${d.dock}</em></div>`).join('') || '<div class="empty">Geen vertrekken in de komende twee uur.</div>'}</div>
      <div class="btns"><button class="btn" id="toHal">${ic('tv', 14)} Hal-scherm</button><button class="btn" id="toLaden">${ic('bolt', 14)} Laden</button><button class="btn pri" id="toPb">Planbord</button></div>`;
  }
  function truckPanel(t, s) {
    if (!s) return ''; const nx = s.next; const drivePct = Math.min(100, s.drive / 270 * 100); const blocks = fleet.blocks(t); const rel = s.rel; let hadNext = false;
    const tl = blocks.filter(b => b.k !== 'terrein' || b.b - b.a > 20).map(b => { const a = b.a - t.shiftStart, e = b.b - t.shiftStart; let cls = e <= rel ? 'done' : (a <= rel ? 'now' : (hadNext ? 'todo' : (hadNext = true, 'next'))); if (cls === 'now') hadNext = true; return `<div class="tl ${cls}"><i></i><time>${hhmm(b.a)}${b.k === 'drive' ? '' : ' – ' + hhmm(b.b)}</time><div><b>${esc(b.label)}</b><span>${b.k === 'drive' ? `${Math.round(b.b - b.a)} min rijden${b.delay ? ` · <em class="bad">+${b.delay} min</em>` : ''}${b.win ? ` · venster ${hhmm(t.shiftStart + b.win[0])}–${hhmm(t.shiftStart + b.win[1])}` : ''}` : b.k === 'stop' ? `lossen ${Math.round(b.b - b.a)} min` : b.k === 'laden' ? 'laadpunt gereserveerd' : b.k === 'pauze' ? 'rijtijd gereset' : 'op terrein'}</span></div></div>`; }).join('');
    return `<div class="ph"><h3><span class="plate">${t.id}</span><span class="kent">${esc(t.plate)}</span></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="dt"><b>${esc(t.model)}${t.lzv ? ' · LZV' : ''}</b><span>${esc(DIV[t.div].n)} · ${esc(t.base.n)} · ${esc(t.lading)}</span><span class="badge ${s.st}">${ST[s.st].n}${s.st === 'vertraagd' && nx ? ` +${nx.delay}` : ''}</span></div>
      <div class="tiles"><div class="tile"><small>Snelheid</small><b>${s.speed} <em>km/u</em></b><span>${nx ? `${nx.kmLeft.toFixed(1).replace('.', ',')} km tot ${esc(nx.name)}` : 'stilstand'}</span></div><div class="tile"><small>${t.ev ? 'Accu' : 'Brandstof'}</small><b>${Math.round(s.soc)} <em>%</em></b><div class="bar"><i style="width:${Math.round(s.soc)}%;background:${s.soc < 20 ? '#DC2626' : '#16A34A'}"></i></div><span>${Math.round(t.range * s.soc / 100)} km bereik</span></div><div class="tile"><small>Rijtijd</small><b>${Math.floor(s.drive / 60)}:${String(Math.floor(s.drive % 60)).padStart(2, '0')} <em>/ 4:30</em></b><div class="bar"><i style="width:${drivePct}%;background:${drivePct > 88 ? '#DC2626' : drivePct > 70 ? '#D97706' : '#16A34A'}"></i></div><span>pauze uiterlijk ${hhmm(state.simTime + Math.max(0, 270 - s.drive))}</span></div><div class="tile"><small>Volgende stop</small><b>${nx ? hhmm(nx.eta) : '–'}</b><span>${nx ? (nx.win ? `venster ${hhmm(nx.win[0])}–${hhmm(nx.win[1])}${nx.eta > nx.win[1] ? ' <em class="bad">te laat</em>' : ''}` : esc(nx.name)) : 'dienst afgerond'}</span></div></div>
      <div class="drv" data-person="${t.person.id}"><span class="av">${esc(t.person.initials)}</span><div><b>${esc(t.driver)}</b><span>chauffeur · dienst ${hhmm(t.shiftStart)} – ${hhmm(t.shiftStart + t.shiftEnd)} · sinds ${t.since}</span></div>${ic('chev', 16)}</div>
      ${t.storing ? `<div class="al bad static"><i></i><div><b>Techniek</b><p>${esc(t.storing)}${t.workorder ? ' · werkorder aangemaakt' : ''}</p></div></div>` : ''}
      <h4 class="sub">Berichten <small>voorgelezen in de cabine</small></h4><div class="msgs">${(t.msgs || []).slice(-5).map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)} · ${m.me ? 'planning' : esc(t.driver.split(' ')[0])}</time></div>`).join('') || '<div class="empty">Nog geen berichten vandaag.</div>'}</div>
      <div class="quick">${QUICK.map(x => `<button class="chip sm" data-quick="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="ask"><input id="msgIn" placeholder="Bericht aan ${esc(t.driver.split(' ')[0])}…" autocomplete="off"><button class="btn pri sm" id="msgSend">Stuur</button></div>
      <h4 class="sub">Dagplan <small>${t.routes.length} ${t.routes.length === 1 ? 'rit' : 'ritten'} · ${Math.round(t.routes.reduce((a, r) => a + r.total, 0))} km</small></h4><div class="tls">${tl}</div>
      <div class="btns"><button class="btn" id="toPb2">Planbord</button><button class="btn" id="shareBtn">Deel link</button><button class="btn pri" id="openSheet">Open truck</button></div>`;
  }
  function restPanel(p) {
    const my = rest.myRating(p.id); const s = selTruck && S.get(selTruck.id); const km = s ? Math.round(Math.hypot((p.lon - s.pos.lon) * 68, (p.lat - s.pos.lat) * 111)) : null;
    const star = v => `<span class="stars">${'★'.repeat(Math.round(v))}${'☆'.repeat(5 - Math.round(v))}</span>`;
    return `<div class="ph"><h3>${esc(p.n)}<small>${esc(p.sub)}</small></h3><button class="x" id="closePanel">${ic('x', 15)}</button></div>
      <div class="rating"><b>${rest.score(p).toString().replace('.', ',')}</b>${star(rest.score(p))}<span>${p.count + (my ? 1 : 0)} beoordelingen van chauffeurs</span></div>
      <div class="kv2"><span>Plekken</span><b>${p.plekken} trucks${p.lzv ? ' · LZV toegestaan' : ''}</b><span>Veiligheid</span><b>${p.beveiligd ? 'beveiligd terrein, camera\'s' : 'niet beveiligd'}</b><span>Voorzieningen</span><b>${[p.douche ? 'douche' : null, p.eten !== 'geen' ? p.eten : null, p.laders ? `${p.laders} laadpunten` : null, 'toilet'].filter(Boolean).join(', ')}</b>${km !== null ? `<span>Afstand</span><b>${km} km van ${selTruck.id}</b>` : ''}</div>
      <h4 class="sub">Wat chauffeurs zeggen</h4>${p.reviews.map(r => `<div class="rev"><span class="av sm">${r.who}</span><div><b>${star(r.stars)}</b><p>${esc(r.text)}</p></div></div>`).join('')}
      <h4 class="sub">Jouw beoordeling</h4><div class="starbtns">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${my >= n ? 'on' : ''}">★</button>`).join('')}<span>${my ? `${my} van 5 gegeven` : 'klik op een ster'}</span></div>
      <div class="btns">${selTruck ? `<button class="btn pri" id="proposeRest">Stel voor aan ${esc(selTruck.driver.split(' ')[0])}</button>` : '<span class="hint2">Selecteer een truck om deze plek als pauze voor te stellen.</span>'}</div>`;
  }
  function bindPanel() {
    const p = $('panel');
    p.querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => selectTruck(el.dataset.truck)));
    p.querySelectorAll('[data-person]').forEach(el => el.addEventListener('click', () => openSheet('persoon', el.dataset.person)));
    p.querySelectorAll('[data-ex]').forEach(el => el.addEventListener('click', () => { exFilter = el.dataset.ex; renderPanel(); }));
    p.querySelectorAll('[data-done]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); const h = handled.get(el.dataset.done) || {}; h.done = !h.done; handled.set(el.dataset.done, h); frame(true); }));
    p.querySelectorAll('[data-assign]').forEach(el => el.addEventListener('change', () => { const h = handled.get(el.dataset.assign) || {}; h.who = el.value; handled.set(el.dataset.assign, h); if (h.who) notice(`Melding toegewezen aan ${h.who}.`); renderPanel(); }));
    const sd = $('showDone'); if (sd) sd.onclick = () => { showDone = !showDone; renderPanel(); };
    const x = $('closePanel'); if (x) x.onclick = () => closePanel();
    const h = $('toHal'); if (h) h.onclick = () => hashTo('#hal/' + encodeURIComponent(selSp.n));
    const ld = $('toLaden'); if (ld) ld.onclick = () => setView('laden');
    const pb = $('toPb'); if (pb) pb.onclick = () => { pbSp = selSp; setView('planbord'); };
    const pb2 = $('toPb2'); if (pb2) pb2.onclick = () => { pbSp = selTruck.base; setView('planbord'); };
    const os = $('openSheet'); if (os) os.onclick = () => openSheet('truck', selTruck.id);
    const sb = $('shareBtn'); if (sb) sb.onclick = () => shareLink(selTruck);
    p.querySelectorAll('[data-quick]').forEach(el => el.addEventListener('click', () => sendMsg(selTruck, el.dataset.quick)));
    const ms = $('msgSend'); if (ms) ms.onclick = () => { const v = $('msgIn').value.trim(); if (v && selTruck) sendMsg(selTruck, v); };
    const mi = $('msgIn'); if (mi) mi.addEventListener('keydown', e => { if (e.key === 'Enter') ms.onclick(); });
    p.querySelectorAll('[data-star]').forEach(el => el.addEventListener('click', () => { rest.rate(selRest.id, +el.dataset.star); renderPanel(); if (view === 'pauze') renderPauze(ctx); }));
    const pr = $('proposeRest'); if (pr) pr.onclick = () => { const s = S.get(selTruck.id); const km = Math.round(Math.hypot((selRest.lon - s.pos.lon) * 68, (selRest.lat - s.pos.lat) * 111)); selTruck.breakPlanned = true; sendMsg(selTruck, `Planning: neem je pauze bij ${selRest.n} (${km} km verderop, ${[selRest.douche ? 'douche' : null, selRest.eten !== 'geen' ? selRest.eten : null].filter(Boolean).join(', ') || 'parkeren'}).`); notice(`Pauze bij ${selRest.n} voorgesteld aan ${selTruck.driver}.`); openPanel('truck'); };
  }

  // ---------- selectie ----------
  function selectTruck(id, opts = {}) {
    const t = fleet.byId.get(id); if (!t) return; selTruck = t; selRest = null; follow = false; const s = fleet.stateAt(t, state.simTime); S.set(t.id, s);
    if (!opts.stay && view !== 'kaart') setView('kaart');
    if (view === 'kaart') mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 10.2), duration: 900 });
    if (opts.stay || panelOpen()) openPanel('truck');
    if (view === 'pauze') renderPauze(ctx);
    frame(true);
  }
  function selectSp(sp) {
    selSp = sp; selTruck = null; selRest = null; follow = false; mapApi.setRoute(null, null, []); F.sps = new Set([sp.n]); mapApi.highlightSp(sp.n);
    if (view !== 'kaart') setView('kaart'); mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: Math.max(mapApi.map.getZoom(), 9.4), duration: 900 }); openPanel('sp'); frame(true);
  }
  function selectRest(id) { const p = rest.byId.get(id); if (!p) return; selRest = p; restOnMap = true; mapApi.showRest(true); mapApi.setRest(rest.places, p.id); if (view !== 'kaart') setView('kaart'); mapApi.map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(mapApi.map.getZoom(), 9.6), duration: 900 }); openPanel('rest'); }
  function clearSel() { selTruck = null; follow = false; mapApi.setRoute(null, null, []); if (panelMode === 'truck') closePanel(); frame(true); }
  function hover(id, pt) { hoverId = id; hoverPt = pt; renderTip(); }
  function renderTip() {
    const tip = $('tip'); const t = hoverId && fleet.byId.get(hoverId); const s = t && S.get(t.id);
    if (!t || !s || !hoverPt || view !== 'kaart') { tip.style.display = 'none'; return; }
    tip.style.display = 'block'; tip.style.left = Math.min(hoverPt.x + 14, $('map').clientWidth - 300) + 'px'; tip.style.top = Math.max(8, hoverPt.y - 10) + 'px';
    tip.innerHTML = `<h5><span class="plate">${t.id}</span>${esc(t.model.replace('Mercedes-Benz ', ''))}</h5><div class="kv"><span>Chauffeur</span><b>${esc(t.driver)}</b><span>Standplaats</span><b>${esc(t.base.n)} · ${esc(DIV[t.div].n)}</b><span>Status</span><b style="color:${ST[s.st].color}">${ST[s.st].n}</b>${s.next ? `<span>Volgende</span><b>${esc(s.next.name)} · ETA ${hhmm(s.next.eta)}${s.next.delay ? ` <em class="bad">+${s.next.delay}</em>` : ''}</b>` : ''}</div><small>Klik voor rit en ETA</small>`;
  }

  // ---------- weergaven en record-pagina's ----------
  function setView(name) {
    if (!VIEWS.some(v => v[0] === name)) return; view = name;
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + name));
    $('rail').classList.remove('open'); renderRail(); renderTopbar();
    if (name === 'kaart') setTimeout(() => mapApi && mapApi.map.resize(), 30);
    frame(true);
  }
  function openSheet(kind, id, tab) { sheet = { kind, id, tab }; if (panelOpen()) { sheetPanel = panelMode; closePanel(); } renderSheet(ctx, kind, id, tab); $('sheet').hidden = false; $('sheet').scrollTop = 0; }
  let sheetPanel = null;
  function closeSheet() { sheet = null; $('sheet').hidden = true; if (sheetPanel) { openPanel(sheetPanel); sheetPanel = null; } }

  // ---------- routes: hal-scherm en klant-link ----------
  function hashTo(h) { if (!h) { history.replaceState(null, '', location.pathname + location.search); } else if (location.hash !== h) location.hash = h; onHash(); }
  function onHash() {
    const h = decodeURIComponent(location.hash.slice(1)); const [k, ...r] = h.split('/'); const arg = r.join('/');
    const wasHal = halSp, wasKlant = klantId; halSp = k === 'hal' ? (SP.find(s => s.n === arg) ? arg : SP[0].n) : null; klantId = k === 'klant' ? arg : null;
    $('hal').hidden = !halSp; $('klant').hidden = !klantId; document.body.classList.toggle('kiosk', !!(halSp || klantId));
    if (halSp) renderHal(ctx, halSp);
    if (klantId) { if (wasKlant !== klantId) { selectTruck(klantId); follow = true; closePanel(); } renderKlant(ctx, klantId); }
    if (wasKlant && !klantId) { follow = false; }
    if (k === 'view' && arg) setView(arg);
    if ((wasHal || wasKlant) && !halSp && !klantId) frame(true);
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
    if (W.step === 1) body = `<h2>Welke regio's wil je zien?</h2><p>Je werkgebied bepaalt wat je standaard ziet. Je past het later aan onder <b>Werkgebied</b> in de balk links; het wordt niet elke keer opnieuw gevraagd.</p><div class="tcards">${[['Alle', 'Heel Nederland', `${SP.length} standplaatsen`], ...REGIOS.map(r => [r, r, `${SP.filter(s => s.regio === r).length} standplaatsen · ${fmt(SP.filter(s => s.regio === r).reduce((a, s) => a + s.fleet, 0))} trucks`])].map(([k, n, d]) => { const on = k === 'Alle' ? !W.regios.size : W.regios.has(k); return `<label class="tcard ${on ? 'on' : ''}" data-regio="${k}"><i class="cb2 ${on ? 'on' : ''}">${on ? ic('check', 12) : ''}</i><b>${n}</b><span>${d}</span></label>`; }).join('')}</div>`;
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
  function openPalette() { $('palette').hidden = false; $('palette').innerHTML = `<div class="pal"><div class="palin">${ic('search', 18)}<input id="palIn" placeholder="Zoek truck, kenteken, chauffeur, standplaats, winkel of pauzeplek" autocomplete="off"><kbd>Esc</kbd></div><div class="pal-list" id="palList"></div><div class="palfoot">↑↓ kiezen · Enter openen · toetsen 1 tot 9 wisselen van weergave · f volgt de geselecteerde truck</div></div>`; const inp = $('palIn'); inp.focus(); inp.addEventListener('input', () => { palIdx = 0; renderPal(inp.value); }); inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { palIdx = Math.min(palItems.length - 1, palIdx + 1); renderPal(inp.value, true); e.preventDefault(); } else if (e.key === 'ArrowUp') { palIdx = Math.max(0, palIdx - 1); renderPal(inp.value, true); e.preventDefault(); } else if (e.key === 'Enter') { const it = palItems[palIdx]; if (it) { closePalette(); it.run(); } } else if (e.key === 'Escape') closePalette(); }); $('palette').addEventListener('click', e => { if (e.target === $('palette')) closePalette(); }); renderPal(''); }
  function closePalette() { $('palette').hidden = true; }
  function searchAll(qs) {
    const s = qs.trim().toLowerCase(); const out = []; const has = v => v.toLowerCase().includes(s);
    if (!s) { out.push(...VIEWS.map(v => ({ type: 'Weergave', label: v[1], sub: '', run: () => setView(v[0]) }))); return out.slice(0, 9); }
    for (const v of VIEWS) if (has(v[1])) out.push({ type: 'Weergave', label: v[1], sub: 'open deze weergave', run: () => setView(v[0]) });
    for (const sp of SP) if (has(sp.n)) { out.push({ type: 'Standplaats', label: sp.n, sub: `${sp.fleet} trucks · ${sp.regio}`, run: () => selectSp(sp) }); out.push({ type: 'Hal-scherm', label: `Hal-scherm ${sp.n}`, sub: 'vertrekbord op volledig scherm', run: () => hashTo('#hal/' + encodeURIComponent(sp.n)) }); }
    let n = 0; for (const t of fleet.trucks) { if (n > 8) break; if (has(t.id) || has(t.plate) || has(t.driver)) { n++; const st = S.get(t.id); out.push({ type: 'Truck', label: `${t.id} · ${t.driver}`, sub: `${t.model.replace('Mercedes-Benz ', '')} · ${t.base.n}${st ? ' · ' + ST[st.st].n : ''}`, run: () => selectTruck(t.id) }); } }
    n = 0; for (const p of people.persons) { if (n > 6) break; if (has(p.name)) { n++; out.push({ type: 'Persoon', label: p.name, sub: `${p.role} · ${p.base.n}`, run: () => openSheet('persoon', p.id) }); } }
    n = 0; for (const e of lostijden.stops) { if (n > 5) break; if (has(e.name)) { n++; out.push({ type: 'Winkel', label: e.name, sub: `${e.n} stops per dag · gepland ${Math.round(e.planned)} min, gemeten ${Math.round(e.avg)} min`, run: () => { const t = fleet.byId.get([...e.trucks][0]); if (t) selectTruck(t.id); } }); } }
    n = 0; for (const p of rest.places) { if (n > 4) break; if (has(p.n)) { n++; out.push({ type: 'Pauzeplek', label: p.n, sub: `${rest.score(p).toString().replace('.', ',')}★ · ${p.sub}`, run: () => selectRest(p.id) }); } }
    for (const v of savedViews()) if (has(v.name)) out.push({ type: 'Opgeslagen weergave', label: v.name, sub: v.scope, run: () => applyView(v) });
    return out.slice(0, 14);
  }
  function renderPal(qs, keep) { palItems = searchAll(qs); if (!keep) palIdx = 0; const L = $('palList'); L.innerHTML = palItems.map((it, i) => `<button class="pal-item ${i === palIdx ? 'on' : ''}" data-i="${i}"><span class="pal-type">${esc(it.type)}</span><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></button>`).join('') || '<div class="empty">Niets gevonden.</div>'; L.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { closePalette(); palItems[+b.dataset.i].run(); })); const on = L.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }

  // ---------- sneltoetsen ----------
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
    if (e.key === 'Escape') { if (!$('palette').hidden) closePalette(); else if (sheet) closeSheet(); else if (!$('wizard').hidden && profile) $('wizard').hidden = true; else if (halSp || klantId) hashTo(''); else if (selTruck) clearSel(); else if (panelOpen()) closePanel(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (/^[1-9]$/.test(e.key) && VIEWS[+e.key - 1]) setView(VIEWS[+e.key - 1][0]);
    else if (e.key === 'f' && selTruck) { follow = !follow; renderFcard(); if (panelMode === 'truck') renderPanel(); }
    else if (e.key === '?') notice('Sneltoetsen: / zoeken · 1 tot 9 weergaven · f volgen · Esc sluiten · m meldingen');
    else if (e.key === 'm') { panelOpen() && panelMode === 'meld' ? closePanel() : openPanel('meld'); }
  });

  // ---------- tijdbalk, kaartlagen, meldingen ----------
  $('timebar').innerHTML = `<span class="lbl">Vandaag</span><input type="range" id="scrub" min="0" max="1439" step="1" value="0"><b id="tbClock">--:--</b><button class="tb" id="playBtn" title="Pauzeer of speel af">${ic('pause', 12)}</button><div class="spd">${[1, 12, 60, 300].map(s => `<button data-s="${s}" class="${s === state.speed ? 'on' : ''}">${s}×</button>`).join('')}</div><button class="tb" id="nowBtn" title="Spring naar de echte klok">Nu</button>`;
  $('scrub').addEventListener('input', e => { state.simTime = +e.target.value; frame(true); });
  $('playBtn').onclick = () => { state.playing = !state.playing; $('playBtn').innerHTML = state.playing ? ic('pause', 12) : ic('play', 12); };
  $('nowBtn').onclick = () => { const n = new Date(); state.simTime = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; frame(true); };
  $('timebar').querySelector('.spd').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; state.speed = +b.dataset.s; $('timebar').querySelectorAll('.spd button').forEach(x => x.classList.toggle('on', x === b)); });
  function renderMapTools() {
    $('maptools').innerHTML = `<button class="ib" id="layersBtn" title="Kaartlagen">${ic('layers', 16)}</button><div class="pop" id="layersPop" hidden><label class="sw ${mapApi && mapApi.isOnline() ? 'on' : ''}" id="onlineTog"><i></i><span>Online kaartlaag (OpenStreetMap)</span></label><label class="sw ${F.dim ? 'on' : ''}" id="dimTog"><i></i><span>Andere standplaatsen gedimd tonen</span></label><label class="sw ${restOnMap ? 'on' : ''}" id="restTog"><i></i><span>Pauzeplekken</span></label></div>`;
    $('layersBtn').onclick = () => { $('layersPop').hidden = !$('layersPop').hidden; };
    $('onlineTog').onclick = () => { if (!mapApi) return; const v = !mapApi.isOnline(); if (v && !mapApi.hasOnline()) { notice('De online kaartlaag is in deze omgeving niet bereikbaar.'); return; } mapApi.setOnline(v); store.set('sl-online', v ? 'on' : 'off'); $('onlineTog').classList.toggle('on', v); };
    $('dimTog').onclick = () => { F.dim = !F.dim; $('dimTog').classList.toggle('on', F.dim); frame(true); };
    $('restTog').onclick = () => { setRestOnMap(!restOnMap); $('restTog').classList.toggle('on', restOnMap); };
  }
  function setRestOnMap(v) { restOnMap = v; if (mapApi) { mapApi.showRest(v); if (v) mapApi.setRest(rest.places, selRest && selRest.id); } }
  let noticeT = null; function notice(msg) { const n = $('notice'); n.textContent = msg; n.classList.add('on'); clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('on'), 7000); }

  const ctx = { fleet, state, store, people, rest, lostijden, F, S, $, esc, ic, role: () => role, can, selectTruck, selectSp, selectRest, openSheet, closeSheet, openPanel, closePanel, setView, notice, sendMsg, exceptions: () => exceptions, kpi: () => kpi, counts: () => counts, feed, applied, chat, msgCount: () => msgCount, handled, pbSp: () => pbSp, setPbSp: sp => { pbSp = sp; }, COLLEGAS, matchBase, inScope, inScopeBase, visible: t => visible(t), selTruck: () => selTruck, frame, hashTo, restOnMap: () => restOnMap, setRestOnMap: v => { setRestOnMap(v); renderMapTools(); }, mapApi: () => mapApi };

  function attachMap(api) { mapApi = api; api.whenReady(() => { renderMapTools(); frame(true); }); }
  function start() { renderRail(); renderTopbar(); window.addEventListener('hashchange', onHash); if (profile) applyProfile(); else openWizard(1); onHash(); frame(true); }
  return { attachMap, frame, selectTruck, selectSp, selectRest, hover, notice, start, openWizard, setView, openSheet, ctx };
}
