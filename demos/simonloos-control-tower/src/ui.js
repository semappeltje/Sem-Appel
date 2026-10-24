// Interface: filters, KPI's, meldingen, standplaats- en truckdetail, planbord, vertrekbord, tijdbalk.
import { SP, TOWNS, REGIOS, DIV, ST, laadpunten, fmt, hhmm } from './places.js';

export function createUI(fleet, state, store) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = { regio: 'Alle', sps: new Set(), dim: true, divs: new Set(Object.keys(DIV)), sts: new Set(Object.keys(ST)), q: '', spq: '', showAll: false };
  let mapApi = null, selTruck = null, selSp = null, follow = false, panelMode = 'feed', hoverId = null, hoverPt = null, tab = 'kaart', tick = 0, pbSp = SP[0], exFilter = 'Alle';
  const S = new Map(); const prevSt = new Map(); const feed = []; let exceptions = []; let counts = {}; let kpi = {};
  const applied = []; const chat = []; let msgCount = 0;
  const QUICK = ['Dock gewijzigd, zie app', 'Pauze bij de volgende stop', 'Bel de planning als je stilstaat', 'Rij na deze stop terug naar de standplaats'];
  const REPLIES = ['👍 Ontvangen', 'Oké, doe ik.', 'Begrepen, ik rij door naar de volgende stop.', 'Top, bedankt.'];
  const COLLEGAS = [['Sanne Vlaar', 'Wognum', 'Planner winkeldistributie', 360, 840], ['Ruud Koning', 'Wognum', 'Planner netwerk', 780, 1260], ['Fatima el Idrissi', 'Wognum', 'Planner bulk (avond)', 780, 1260], ['Daan Smit', 'Zaandam', 'Planner Albert Heijn', 300, 780], ['Ilse Bakker', 'Geldermalsen', 'Planner netwerk', 420, 900], ['Marco de Boer', 'Wognum', 'Garage en wasstraat', 420, 960], ['Anouk Groot', 'Wognum', 'Teamleider control tower', 480, 1020]];
  const fmtDrive = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  function sendMsg(t, text, me = true) {
    t.msgs = t.msgs || []; t.msgs.push({ me, text, T: state.simTime }); if (me) { msgCount++; setTimeout(() => { t.msgs.push({ me: false, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], T: state.simTime }); if (selTruck === t) renderPanel(); if (tab === 'assistent') renderAssist(); }, 3500 + Math.random() * 4000); }
    if (selTruck === t) renderPanel();
  }
  let lastFollow = 0;

  // ---------- zijbalk ----------
  function renderSide() {
    const regioCount = r => fleet.trucks.filter(t => r === 'Alle' || t.base.regio === r).length;
    const side = $('side');
    side.innerHTML = `
      <div class="sec"><h4>Regio</h4><div class="chips" id="regioChips">${['Alle', ...REGIOS].map(r => `<button class="chip ${F.regio === r ? 'on' : ''}" data-regio="${r}">${r === 'Alle' ? "Alle regio's" : r} <small>${fmt(regioCount(r))}</small></button>`).join('')}</div></div>
      <div class="sec"><h4>Standplaats <small id="spSel"></small></h4><div class="search sm"><span>🔍</span><input id="spq" placeholder="Zoek standplaats…" value="${esc(F.spq)}"></div><div class="list" id="spList"></div><div class="more" id="spMore"></div>
        <label class="toggle ${F.dim ? 'on' : ''}" id="dimTog"><i></i><span>Andere standplaatsen gedimd tonen<small>bij een selectie; uit = verbergen</small></span></label></div>
      <div class="sec"><h4>Divisie <small>${F.divs.size === Object.keys(DIV).length ? 'alle' : F.divs.size + ' gekozen'}</small></h4><div class="chips" id="divChips">${Object.entries(DIV).map(([k, d]) => `<button class="chip ${F.divs.has(k) && F.divs.size !== Object.keys(DIV).length ? 'on' : ''} ${F.divs.has(k) ? '' : 'off'}" data-div="${k}"><i style="background:${d.color}"></i>${d.n}</button>`).join('')}</div></div>
      <div class="sec"><h4>Status <small>${F.sts.size === Object.keys(ST).length ? 'alle' : F.sts.size + ' gekozen'}</small></h4><div class="chips" id="stChips">${Object.entries(ST).map(([k, s]) => `<button class="chip ${F.sts.has(k) && F.sts.size !== Object.keys(ST).length ? 'on' : ''} ${F.sts.has(k) ? '' : 'off'}" data-st="${k}"><i style="background:${s.color}"></i>${s.n} <small data-cnt="${k}">0</small></button>`).join('')}</div></div>
      <div class="sec foot"><h4>Kaart</h4><label class="toggle ${mapApi && mapApi.isOnline() ? 'on' : ''}" id="onlineTog"><i></i><span>Online kaartlaag<small>OpenStreetMap-tegels via CARTO; uit = ingebouwde basiskaart</small></span></label>
        <div class="hint">Uitgezoomd: clusters per gebied · Ingezoomd: losse trucks met rijrichting · Klik op een truck: rit, ETA en chauffeur</div></div>`;
    renderSpList();
    side.querySelector('#regioChips').addEventListener('click', e => { const b = e.target.closest('[data-regio]'); if (!b) return; F.regio = b.dataset.regio; F.sps.clear(); selSp = null; if (panelMode === 'sp') panelMode = 'feed'; renderSide(); if (mapApi) { if (F.regio === 'Alle') mapApi.map.easeTo({ center: [5.3, 52.2], zoom: 6.6, duration: 800 }); else mapApi.fitSps(SP.filter(s => s.regio === F.regio)); mapApi.highlightSp(null); } frame(true); });
    side.querySelector('#divChips').addEventListener('click', e => { const b = e.target.closest('[data-div]'); if (!b) return; const k = b.dataset.div; if (F.divs.has(k) && F.divs.size === 1) F.divs = new Set(Object.keys(DIV)); else if (F.divs.size === Object.keys(DIV).length) F.divs = new Set([k]); else F.divs.has(k) ? F.divs.delete(k) : F.divs.add(k); renderSide(); frame(true); });
    side.querySelector('#stChips').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; const k = b.dataset.st; if (F.sts.has(k) && F.sts.size === 1) F.sts = new Set(Object.keys(ST)); else if (F.sts.size === Object.keys(ST).length) F.sts = new Set([k]); else F.sts.has(k) ? F.sts.delete(k) : F.sts.add(k); renderSide(); frame(true); });
    side.querySelector('#spq').addEventListener('input', e => { F.spq = e.target.value; renderSpList(); });
    side.querySelector('#dimTog').addEventListener('click', () => { F.dim = !F.dim; side.querySelector('#dimTog').classList.toggle('on', F.dim); frame(true); });
    side.querySelector('#onlineTog').addEventListener('click', () => { if (!mapApi) return; const v = !mapApi.isOnline(); if (v && !mapApi.hasOnline()) { notice('De online kaartlaag is in deze omgeving niet bereikbaar.'); return; } mapApi.setOnline(v); store.set('sl-online', v ? 'on' : 'off'); side.querySelector('#onlineTog').classList.toggle('on', v); });
  }
  function renderSpList() {
    const list = $('spList'); if (!list) return;
    let sps = SP.filter(s => F.regio === 'Alle' || s.regio === F.regio).filter(s => !F.spq || s.n.toLowerCase().includes(F.spq.toLowerCase())).sort((a, b) => b.fleet - a.fleet);
    const total = sps.length; if (!F.showAll && !F.spq) sps = sps.slice(0, 10);
    list.innerHTML = sps.map(s => `<label class="row ${F.sps.has(s.n) ? 'on' : ''}" data-sp="${esc(s.n)}"><i class="cb ${F.sps.has(s.n) ? 'on' : ''}"></i><span>${esc(s.n)}${s.hub ? '<small> · hoofdkantoor</small>' : ''}</span><b>${s.fleet}</b></label>`).join('');
    $('spMore').innerHTML = total > sps.length ? `<button class="link" id="spMoreBtn">+ nog ${total - sps.length} standplaatsen</button>` : (F.showAll && total > 10 ? '<button class="link" id="spMoreBtn">Toon minder</button>' : '');
    const mb = $('spMoreBtn'); if (mb) mb.onclick = () => { F.showAll = !F.showAll; renderSpList(); };
    $('spSel').textContent = F.sps.size ? `${F.sps.size} geselecteerd` : 'alle';
    list.onclick = e => { const r = e.target.closest('[data-sp]'); if (!r) return; const n = r.dataset.sp; const sp = SP.find(s => s.n === n); if (F.sps.has(n)) { F.sps.delete(n); if (selSp === sp) { selSp = null; if (panelMode === 'sp') panelMode = 'feed'; } } else { F.sps.add(n); } renderSpList(); if (F.sps.size === 1) selectSp(SP.find(s => F.sps.has(s.n)), false); else if (mapApi) { mapApi.highlightSp(null); if (F.sps.size > 1) mapApi.fitSps(SP.filter(s => F.sps.has(s.n))); } frame(true); };
  }

  // ---------- filters ----------
  const q = () => F.q.toLowerCase();
  function matchBase(t) { return (F.regio === 'Alle' || t.base.regio === F.regio) && F.divs.has(t.div) && (!F.q || t.id.toLowerCase().includes(q()) || t.driver.toLowerCase().includes(q()) || t.base.n.toLowerCase().includes(q()) || t.plate.toLowerCase().includes(q())); }
  function visible(t, s) { return matchBase(t) && F.sts.has(s.st) && (!F.sps.size || F.sps.has(t.base.n)); }

  // ---------- frame ----------
  function frame(force) {
    if (!mapApi) return; tick++;
    const T = state.simTime; const feats = [], dims = []; counts = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; exceptions = [];
    let nVis = 0, laden = 0, ritten = 0, stopsDone = 0, stopsLate = 0, rijtijdRisk = 0; const spSeen = new Set();
    for (const t of fleet.trucks) {
      const s = fleet.stateAt(t, T); S.set(t.id, s);
      const vis = visible(t, s);
      if (!vis) { if (F.dim && F.sps.size && !F.sps.has(t.base.n) && matchBase(t) && F.sts.has(s.st)) dims.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); prevSt.set(t.id, s.st); continue; }
      nVis++; counts[s.st]++; spSeen.add(t.base); ritten += t.routes.length;
      feats.push({ type: 'Feature', properties: { id: t.id, st: s.st, b: Math.round(s.pos.bearing) }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } });
      if (s.seg.k === 'laden') laden++;
      for (const seg of t.plan) if (seg.k === 'stop' && seg.t1 <= s.rel) { stopsDone++; const d = t.plan[t.plan.indexOf(seg) - 1]; if (d && d.delay) stopsLate++; }
      if (s.st === 'vertraagd' && s.next) exceptions.push({ sev: 'bad', kind: 'Vertraging', t, text: `${s.next.name}: ETA ${hhmm(s.next.eta)}${s.next.win ? `, venster tot ${hhmm(s.next.win[1])}` : ''} (+${s.next.delay} min)` });
      if ((s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240 && !t.breakPlanned) { rijtijdRisk++; exceptions.push({ sev: 'warn', kind: 'Rijtijd', t, text: `${t.driver}: ${Math.floor(s.drive / 60)}:${String(Math.floor(s.drive % 60)).padStart(2, '0')} van 4:30 rijtijd, pauze binnen ${Math.max(0, 270 - Math.floor(s.drive))} min` }); }
      if (t.ev && s.soc < 20 && s.st !== 'terrein' && !t.chargePlanned) exceptions.push({ sev: 'warn', kind: 'Accu', t, text: `Accu ${Math.round(s.soc)} % · ${Math.round(t.range * s.soc / 100)} km bereik · ${s.next ? s.next.name : t.base.n}` });
      if (t.storing && s.st !== 'terrein' && !t.workorder) exceptions.push({ sev: 'bad', kind: 'Techniek', t, text: t.storing });
      const p = prevSt.get(t.id); if (p && p !== s.st) pushEvent(t, s, p); prevSt.set(t.id, s.st);
    }
    exceptions.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'bad' ? -1 : 1));
    const lp = [...spSeen].reduce((a, s) => a + laadpunten(s), 0);
    kpi = { nVis, actief: nVis - counts.terrein, ritten, stopsDone, onTime: stopsDone ? (1 - stopsLate / stopsDone) * 100 : 100, ex: exceptions.length, rijtijdRisk, laden, lp, vertraging: exceptions.filter(e => e.kind === 'Vertraging').length, rijtijd: exceptions.filter(e => e.kind === 'Rijtijd').length, accu: exceptions.filter(e => e.kind === 'Accu').length, techniek: exceptions.filter(e => e.kind === 'Techniek').length };
    mapApi.setTrucks(feats, dims);
    // selectie
    if (selTruck) { const s = S.get(selTruck.id); mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); drawRoute(selTruck, s); if (follow && Date.now() - lastFollow > 900) { lastFollow = Date.now(); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], duration: 800 }); } }
    else { mapApi.setSelected(null); }
    for (const k of Object.keys(ST)) { const el = document.querySelector(`[data-cnt="${k}"]`); if (el) el.textContent = fmt(counts[k]); }
    renderKpis(); renderCrumb(); renderClock();
    const typing = document.activeElement && (document.activeElement.id === 'msgIn' || document.activeElement.id === 'askIn' || document.activeElement.id === 'overIn');
    if (force || tick % 8 === 0) { if (!typing) renderPanel(); if (tab === 'planbord') renderPlanbord(); if (tab === 'standplaatsen') renderSpView(); if (tab === 'assistent' && !typing) renderAssist(); }
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
    const stops = r.marks.slice(1, -1).map(m => ({ lon: pts[Math.max(0, cum.findIndex(c => c >= m.km))][0], lat: pts[Math.max(0, cum.findIndex(c => c >= m.km))][1], done: m.km <= km }));
    mapApi.setRoute(done.length > 1 ? done : null, todo.length > 1 ? todo : null, stops);
  }

  // ---------- KPI's, crumb, klok ----------
  function renderKpis() {
    const k = kpi; $('kpis').innerHTML = [
      ['Trucks actief', fmt(k.actief), `van ${fmt(k.nVis)} in beeld · ${fmt(counts.terrein)} op terrein`, ''],
      ['Stops vandaag', fmt(k.stopsDone), `afgerond · ${fmt(k.ritten)} ritten gepland`, ''],
      ['Op tijd bij klant', `${k.onTime.toFixed(1).replace('.', ',')} %`, 'tijdvenster gehaald · doel 95 %', k.onTime < 95 ? 'warn' : 'good'],
      ['Uitzonderingen', fmt(k.ex), `${k.vertraging} vertraging · ${k.rijtijd} rijtijd · ${k.accu} accu · ${k.techniek} techniek`, k.ex ? 'bad' : ''],
      ['Rijtijd-risico', fmt(k.rijtijdRisk), 'chauffeurs binnen 30 min op limiet', k.rijtijdRisk ? 'warn' : ''],
      ['Laadpunten', `${k.laden} / ${k.lp}`, 'bezet · eActros laden nu', ''],
    ].map(([l, v, s, c]) => `<div class="kpi ${c}"><small>${l}</small><b>${v}</b><span>${s}</span></div>`).join('');
  }
  function renderCrumb() {
    const z = mapApi.map.getZoom(); const scope = F.sps.size === 1 ? `${[...F.sps][0]}` : F.sps.size > 1 ? `${F.sps.size} standplaatsen` : F.regio === 'Alle' ? 'Nederland' : F.regio;
    $('crumb').innerHTML = `<b>${esc(scope)}</b> · ${fmt(kpi.nVis)} van ${fmt(fleet.trucks.length)} trucks in beeld <span class="pill">${z < 8.5 ? 'Clusters' : 'Losse trucks'}</span>${F.sps.size ? `<span class="pill red" id="clearSp">Alleen ${esc(F.sps.size === 1 ? [...F.sps][0] : F.sps.size + ' standplaatsen')} ✕</span>` : ''}${F.q ? `<span class="pill" id="clearQ">Zoek: ${esc(F.q)} ✕</span>` : ''}`;
    const c = $('clearSp'); if (c) c.onclick = () => { F.sps.clear(); selSp = null; if (panelMode === 'sp') panelMode = 'feed'; renderSpList(); mapApi.highlightSp(null); frame(true); };
    const cq = $('clearQ'); if (cq) cq.onclick = () => { F.q = ''; $('q').value = ''; frame(true); };
  }
  function renderClock() { const s = hhmm(state.simTime); $('clock').textContent = s; const tb = $('tbClock'); if (tb) tb.textContent = s; const sc = $('scrub'); if (sc && document.activeElement !== sc) sc.value = Math.floor(state.simTime); }

  // ---------- paneel rechts ----------
  function renderPanel() {
    const p = $('panel');
    if (panelMode === 'truck' && selTruck) p.innerHTML = truckPanel(selTruck, S.get(selTruck.id));
    else if (panelMode === 'sp' && selSp) p.innerHTML = spPanel(selSp);
    else p.innerHTML = feedPanel();
    bindPanel();
  }
  function feedPanel() {
    const ex = exceptions.filter(e => exFilter === 'Alle' || e.kind === exFilter).slice(0, 40);
    const chips = ['Alle', 'Vertraging', 'Rijtijd', 'Accu', 'Techniek'].map(k => `<button class="chip sm ${exFilter === k ? 'on' : ''}" data-ex="${k}">${k}${k === 'Alle' ? '' : ' ' + (kpi[k.toLowerCase()] || 0)}</button>`).join('');
    return `<div class="ph"><h3>Uitzonderingen <b>${kpi.ex || 0}</b></h3></div><div class="pf">${chips}</div>
      <div class="als">${ex.length ? ex.map(e => `<div class="al ${e.sev}" data-truck="${e.t.id}"><i></i><div><b>${e.t.id}</b><span>${esc(e.t.base.n)} · ${esc(e.kind)}</span><p>${esc(e.text)}</p></div></div>`).join('') : '<div class="empty">Geen uitzonderingen binnen de huidige filters.</div>'}</div>
      <h4 class="sub">Gebeurtenissen <small>live</small></h4><div class="evs">${feed.filter(e => matchBase(e.t) && (!F.sps.size || F.sps.has(e.t.base.n))).slice(0, 14).map(e => `<div class="ev ${e.sev}" data-truck="${e.t.id}"><time>${hhmm(e.T)}</time><span><b>${e.t.id}</b> ${esc(e.t.driver)} ${esc(e.txt)}</span></div>`).join('') || '<div class="empty">Nog geen gebeurtenissen.</div>'}</div>`;
  }
  function spPanel(sp) {
    const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let laden = 0, ev = 0;
    for (const t of mine) { const s = S.get(t.id); if (!s) continue; c[s.st]++; if (s.seg.k === 'laden') laden++; if (t.ev) ev++; }
    const deps = fleet.departures(sp, state.simTime, 120).slice(0, 8);
    const klanten = [...new Set(mine.map(t => t.klant))];
    return `<div class="ph"><h3>${esc(sp.n)}<small>${esc([sp.hub ? 'hoofdkantoor' : null, sp.wh ? 'warehouse' : null, sp.klant].filter(Boolean).join(' · '))}</small></h3><button class="x" id="closePanel">✕</button></div>
      <div class="stat5"><div><b>${mine.length}</b><span>trucks</span></div><div><b>${c.onderweg + c.vertraagd}</b><span>onderweg</span></div><div><b>${c.klant}</b><span>bij klant</span></div><div><b>${c.pauze}</b><span>pauze</span></div><div><b>${c.terrein}</b><span>op terrein</span></div></div>
      <div class="mix">${Object.keys(ST).map(k => `<i style="background:${ST[k].color};flex:${Math.max(c[k], 0.2)}"></i>`).join('')}</div>
      <div class="kv2"><span>Elektrisch</span><b>${ev} trucks · ${laden} laden nu · ${laadpunten(sp)} laadpunten</b><span>Regio</span><b>${esc(sp.regio)} · ${esc(sp.prov)}</b>${sp.note ? `<span>Locatie</span><b>${esc(sp.note)}</b>` : ''}</div>
      <h4 class="sub">Volgende vertrekken <small>komende 2 uur · ${deps.length}</small></h4><div class="deps">${deps.map(d => `<div class="dep" data-truck="${d.t.id}"><time>${hhmm(d.at)}</time><div><b>${d.t.id} <small>${esc(d.t.driver)}</small></b><span>${esc(DIV[d.t.div].n)} · ${esc(d.dest)}</span></div><em>Dock ${d.dock}</em></div>`).join('') || '<div class="empty">Geen vertrekken in de komende twee uur.</div>'}</div>
      <h4 class="sub">Klanten vanuit ${esc(sp.n)}</h4><div class="chips wrap">${klanten.map(k => `<span class="chip sm on">${esc(k)}</span>`).join('')}</div>
      <div class="btns"><button class="btn" id="toHal">Vertrekbord (hal)</button><button class="btn pri" id="toPb">Planbord ${esc(sp.n)}</button></div>`;
  }
  function truckPanel(t, s) {
    if (!s) return '';
    const nx = s.next; const drivePct = Math.min(100, s.drive / 270 * 100);
    const blocks = fleet.blocks(t); const rel = s.rel; let hadNext = false;
    const tl = blocks.filter(b => b.k !== 'terrein' || b.b - b.a > 20).map(b => { const a = b.a - t.shiftStart, e = b.b - t.shiftStart; let cls = e <= rel ? 'done' : (a <= rel ? 'now' : (hadNext ? 'todo' : (hadNext = true, 'next'))); if (cls === 'now') { hadNext = true; } return `<div class="tl ${cls}"><i></i><time>${hhmm(b.a)}${b.k === 'drive' ? '' : ' – ' + hhmm(b.b)}</time><div><b>${esc(b.label)}</b><span>${b.k === 'drive' ? `${Math.round((b.b - b.a))} min rijden${b.delay ? ` · <em class="bad">+${b.delay} min vertraging</em>` : ''}${b.win ? ` · venster ${hhmm(t.shiftStart + b.win[0])}–${hhmm(t.shiftStart + b.win[1])}` : ''}` : b.k === 'stop' ? `lossen ${Math.round(b.b - b.a)} min` : b.k === 'laden' ? 'laadpunt gereserveerd' : b.k === 'pauze' ? 'rijtijd gereset' : 'op terrein'}</span></div></div>`; }).join('');
    const kent = `<span class="plate">${t.id}</span><span class="kent">${esc(t.plate)}</span>`;
    const stBadge = `<span class="badge ${s.st}">${ST[s.st].n}${s.st === 'vertraagd' && nx ? ` +${nx.delay}` : ''}</span>`;
    return `<div class="ph"><h3>${kent}</h3><button class="x" id="closePanel">✕</button></div>
      <div class="dt"><b>${esc(t.model)}${t.lzv ? ' · LZV' : ''}</b><span>${esc(DIV[t.div].n)} · standplaats ${esc(t.base.n)} · ${esc(t.lading)}</span>${stBadge}</div>
      <div class="tiles">
        <div class="tile"><small>Snelheid</small><b>${s.speed} <em>km/u</em></b><span>${nx ? `${nx.kmLeft.toFixed(1).replace('.', ',')} km tot ${esc(nx.name)}` : 'stilstand'}</span></div>
        <div class="tile"><small>${t.ev ? 'Accu' : 'Brandstof'}</small><b>${Math.round(s.soc)} <em>%</em></b><div class="bar"><i style="width:${Math.round(s.soc)}%;background:${s.soc < 20 ? '#EF4444' : '#22C55E'}"></i></div><span>${Math.round(t.range * s.soc / 100)} km bereik</span></div>
        <div class="tile"><small>Rijtijd</small><b>${Math.floor(s.drive / 60)}:${String(Math.floor(s.drive % 60)).padStart(2, '0')} <em>/ 4:30</em></b><div class="bar"><i style="width:${drivePct}%;background:${drivePct > 88 ? '#EF4444' : drivePct > 70 ? '#F59E0B' : '#22C55E'}"></i></div><span>pauze uiterlijk ${hhmm(state.simTime + Math.max(0, 270 - s.drive))}</span></div>
        <div class="tile"><small>Volgende stop</small><b>${nx ? hhmm(nx.eta) : '–'}</b><span>${nx ? (nx.win ? `venster ${hhmm(nx.win[0])}–${hhmm(nx.win[1])}${nx.eta > nx.win[1] ? ' <em class="bad">te laat</em>' : ''}` : esc(nx.name)) : 'dienst afgerond'}</span></div>
      </div>
      <div class="drv"><span class="av">${esc(t.driver.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(t.driver)}</b><span>chauffeur · dienst ${hhmm(t.shiftStart)} – ${hhmm(t.shiftStart + t.shiftEnd)} · sinds ${t.since} bij Simon Loos</span></div></div>
      ${t.storing ? `<div class="al bad static"><i></i><div><b>Techniek</b><p>${esc(t.storing)}${t.workorder ? ' · werkorder aangemaakt' : ''}</p></div></div>` : ''}
      <h4 class="sub">Berichten <small>voorgelezen in de cabine</small></h4>
      <div class="msgs">${(t.msgs || []).slice(-5).map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)} · ${m.me ? 'planning' : esc(t.driver.split(' ')[0])}</time></div>`).join('') || '<div class="empty">Nog geen berichten vandaag.</div>'}</div>
      <div class="quick">${QUICK.map(q => `<button class="chip sm" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="ask"><input id="msgIn" placeholder="Bericht aan ${esc(t.driver.split(' ')[0])}…" autocomplete="off"><button class="btn pri sm" id="msgSend">Stuur</button></div>
      <div class="safety">Onderweg wordt een bericht voorgelezen en antwoordt de chauffeur met één knop; vrije tekst alleen bij stilstand.</div>
      <div class="ph2"><h4>Dagplan <small>${t.routes.length} ${t.routes.length === 1 ? 'rit' : 'ritten'} · ${Math.round(t.routes.reduce((a, r) => a + r.total, 0))} km</small></h4></div>
      <div class="tls">${tl}</div>
      <div class="btns row"><button class="btn ${follow ? 'on' : ''}" id="followBtn">${follow ? 'Volgen aan' : 'Volg truck'}</button><button class="btn" id="toPb2">Planbord</button><button class="btn pri" id="shareBtn">Deel ETA</button></div>`;
  }
  function bindPanel() {
    const p = $('panel');
    p.querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => selectTruck(el.dataset.truck)));
    p.querySelectorAll('[data-ex]').forEach(el => el.addEventListener('click', () => { exFilter = el.dataset.ex; renderPanel(); }));
    const x = $('closePanel'); if (x) x.onclick = () => { if (panelMode === 'truck') { selTruck = null; follow = false; mapApi.setRoute(null, null, []); panelMode = selSp ? 'sp' : 'feed'; } else { panelMode = 'feed'; selSp = null; F.sps.clear(); renderSpList(); mapApi.highlightSp(null); } frame(true); };
    const h = $('toHal'); if (h) h.onclick = () => { pbSp = selSp; setTab('standplaatsen'); };
    const pb = $('toPb'); if (pb) pb.onclick = () => { pbSp = selSp; setTab('planbord'); };
    const pb2 = $('toPb2'); if (pb2) pb2.onclick = () => { pbSp = selTruck.base; setTab('planbord'); };
    const fb = $('followBtn'); if (fb) fb.onclick = () => { follow = !follow; if (follow) { const s = S.get(selTruck.id); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 11), duration: 900 }); } renderPanel(); };
    p.querySelectorAll('[data-quick]').forEach(el => el.addEventListener('click', () => sendMsg(selTruck, el.dataset.quick)));
    const ms = $('msgSend'); if (ms) ms.onclick = () => { const v = $('msgIn').value.trim(); if (v && selTruck) { sendMsg(selTruck, v); } };
    const mi = $('msgIn'); if (mi) mi.addEventListener('keydown', e => { if (e.key === 'Enter') ms.onclick(); });
    const sb = $('shareBtn'); if (sb) sb.onclick = () => { const s = S.get(selTruck.id); const txt = s.next ? `Simon Loos ${selTruck.id}: verwachte aankomst bij ${s.next.name} om ${hhmm(s.next.eta)}.` : `Simon Loos ${selTruck.id}: dienst afgerond.`; try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch { /* geen klembord */ } notice('ETA gekopieerd als bericht voor de klant: ' + txt); };
  }

  // ---------- selectie ----------
  function selectTruck(id) {
    const t = fleet.byId.get(id); if (!t) return; selTruck = t; panelMode = 'truck'; follow = false; const s = fleet.stateAt(t, state.simTime); S.set(t.id, s);
    if (tab !== 'kaart') setTab('kaart');
    mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 10.2), duration: 900 });
    document.getElementById('panel').classList.add('open'); frame(true);
  }
  function selectSp(sp, fly = true) {
    selSp = sp; panelMode = 'sp'; selTruck = null; follow = false; mapApi.setRoute(null, null, []); F.sps = new Set([sp.n]); renderSpList(); mapApi.highlightSp(sp.n);
    if (fly && tab === 'kaart') mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: 9.6, duration: 900 }); else if (tab === 'kaart') mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: Math.max(mapApi.map.getZoom(), 9.2), duration: 900 });
    document.getElementById('panel').classList.add('open'); frame(true);
  }
  function hover(id, pt) { hoverId = id; hoverPt = pt; renderTip(); }
  function renderTip() {
    const tip = $('tip'); const t = hoverId && fleet.byId.get(hoverId); const s = t && S.get(t.id);
    if (!t || !s || !hoverPt) { tip.style.display = 'none'; return; }
    tip.style.display = 'block'; tip.style.left = Math.min(hoverPt.x + 14, $('map').clientWidth - 300) + 'px'; tip.style.top = Math.max(8, hoverPt.y - 10) + 'px';
    tip.innerHTML = `<h5><span class="plate">${t.id}</span>${esc(t.model)}</h5><div class="kv"><span>Chauffeur</span><b>${esc(t.driver)}</b><span>Standplaats</span><b>${esc(t.base.n)} · ${esc(DIV[t.div].n)}</b><span>Status</span><b style="color:${ST[s.st].color}">${ST[s.st].n}</b>${s.next ? `<span>Volgende</span><b>${esc(s.next.name)} · ETA ${hhmm(s.next.eta)}${s.next.delay ? ` <em class="bad">+${s.next.delay}</em>` : ''}</b>` : ''}<span>${t.ev ? 'Accu' : 'Brandstof'}</span><b>${Math.round(s.soc)} %</b></div><small>Klik voor rit en ETA</small>`;
  }

  // ---------- planbord ----------
  function renderPlanbord() {
    const sp = pbSp; const T = state.simTime; const rows = fleet.trucks.filter(t => t.base === sp).sort((a, b) => a.shiftStart - b.shiftStart);
    const head = $('pbHead'); head.innerHTML = `<div class="bf"><label class="dd"><small>Standplaats</small><select id="pbSel">${SP.slice().sort((a, b) => a.n.localeCompare(b.n)).map(s => `<option ${s === sp ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label><span class="dd"><small>Dag</small><b>vandaag · ${hhmm(T)}</b></span><span class="pill">${rows.length} trucks · ${rows.filter(t => t.plan.some(s => s.delay)).length} met vertraging</span><span class="pill ghost">Sleep-en-plan en automatisch herplannen (VROOM) volgen in de echte versie</span></div>
      <div class="legend2">${[['drive', '#E3001F', 'Rijden'], ['stop', '#E0A800', 'Bij klant'], ['pauze', '#8A919E', 'Pauze'], ['laden', '#16A34A', 'Laden accu'], ['terrein', '#B3B8C2', 'Op terrein']].map(([k, c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}<span class="now2"><i></i>Nu ${hhmm(T)}</span></div>`;
    $('pbSel').onchange = e => { pbSp = SP.find(s => s.n === e.target.value); renderPlanbord(); };
    const W0 = Math.floor((T - 180) / 60) * 60, SPAN = 14 * 60, PX = 1020 / SPAN; // venster van 14 uur, drie uur terug
    const pct = m => ((m - W0) / SPAN * 100).toFixed(3) + '%';
    const col = { drive: '#E3001F', stop: '#E0A800', pauze: '#8A919E', laden: '#16A34A', terrein: '#B3B8C2' };
    const body = rows.map(t => {
      const s = S.get(t.id); const bl = [];
      for (const b of fleet.blocks(t)) { if (b.k === 'terrein' && b.b - b.a <= 20) continue; for (const off of [-1440, 0, 1440]) { const x = Math.max(b.a + off, W0), y = Math.min(b.b + off, W0 + SPAN); if (y - x > 0.5) bl.push({ ...b, x, y, full: b.a + off >= W0 && b.b + off <= W0 + SPAN }); } }
      return `<div class="prow ${selTruck === t ? 'sel' : ''}" data-truck="${t.id}"><div class="who"><span class="plate">${t.id}</span><div><b>${esc(t.driver)}</b><span>${esc(t.model.replace('Mercedes-Benz ', 'MB '))} · ${hhmm(t.shiftStart)}–${hhmm(t.shiftStart + t.shiftEnd)}</span></div><i class="dot" style="background:${s ? ST[s.st].color : '#999'}"></i></div><div class="lane">${bl.map(b => { const w = (b.y - b.x) * PX; const label = b.k === 'drive' || b.k === 'stop' ? b.label : b.k === 'pauze' ? 'Pauze' : b.k === 'laden' ? '⚡ Laden' : 'Terrein'; return `<div class="blk ${b.k} ${b.delay ? 'late' : ''}" style="left:${pct(b.x)};width:${pct(b.y) - 0 + '%' === '' ? 0 : ((b.y - b.x) / SPAN * 100).toFixed(3)}%;--c:${col[b.k]}" title="${esc(b.label)} ${hhmm(b.a)}–${hhmm(b.b)}${b.delay ? ` · +${b.delay} min` : ''}">${w > 46 ? `<b>${esc(label)}</b><small>${hhmm(b.a)}–${hhmm(b.b)}</small>` : ''}${b.delay && w > 120 ? `<em>⚠ +${b.delay}</em>` : ''}</div>`; }).join('')}</div></div>`;
    }).join('');
    const hours = []; for (let h = W0; h <= W0 + SPAN; h += 60) hours.push(h);
    $('gantt').innerHTML = `<div class="ginner"><div class="ghead"><div class="who"><b>Truck / chauffeur</b><span>${rows.length}</span></div><div class="lane hd">${hours.map(h => `<i style="left:${pct(h)}"><span>${hhmm(h)}</span></i>`).join('')}</div></div><div class="gbody">${body}<div class="nowline" style="left:calc(var(--who) + (100% - var(--who)) * ${((T - W0) / SPAN).toFixed(4)})"><span>${hhmm(T)}</span></div></div></div>`;
    $('gantt').querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => { const id = el.dataset.truck; selTruck = fleet.byId.get(id); panelMode = 'truck'; $('panel').classList.add('open'); renderPanel(); $('gantt').querySelectorAll('.prow').forEach(r => r.classList.toggle('sel', r.dataset.truck === id)); }));
  }

  // ---------- standplaatsen en vertrekbord ----------
  function renderSpView() {
    const T = state.simTime; const rows = SP.slice().sort((a, b) => b.fleet - a.fleet).map(sp => { const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let ex = 0; for (const t of fleet.trucks) { if (t.base !== sp) continue; const s = S.get(t.id); if (!s) continue; c[s.st]++; } ex = exceptions.filter(e => e.t.base === sp).length; return { sp, c, ex }; });
    const deps = fleet.departures(pbSp, T, 150).slice(0, 12);
    $('spView').innerHTML = `<div class="spgrid"><div class="sptable"><div class="bf"><h3>Standplaatsen <small>${SP.length} · ${fmt(fleet.trucks.length)} trucks</small></h3></div>
      <table><thead><tr><th>Standplaats</th><th>Regio</th><th>Klant</th><th class="r">Trucks</th><th class="r">Onderweg</th><th class="r">Bij klant</th><th class="r">Terrein</th><th class="r">Uitz.</th></tr></thead><tbody>${rows.map(({ sp, c, ex }) => `<tr class="${sp === pbSp ? 'sel' : ''}" data-sp="${esc(sp.n)}"><td><b>${esc(sp.n)}</b>${sp.hub ? ' <small>hoofdkantoor</small>' : ''}</td><td>${esc(sp.regio)}</td><td>${esc(sp.klant)}</td><td class="r">${sp.fleet}</td><td class="r">${c.onderweg + c.vertraagd}</td><td class="r">${c.klant}</td><td class="r">${c.terrein}</td><td class="r ${ex ? 'bad' : ''}">${ex}</td></tr>`).join('')}</tbody></table></div>
      <div class="hal"><div class="halhead"><span class="prod">Vertrekbord</span><h3>${esc(pbSp.n)}</h3><b>${hhmm(T)}</b></div><div class="halrows">${deps.map(d => `<div class="halrow"><time>${hhmm(d.at)}</time><b>${d.t.id}</b><span class="drv">${esc(d.t.driver)}</span><span class="dest">${esc(d.dest)}</span><em>Dock ${d.dock}</em><i class="${d.at - T < 15 ? 'soon' : ''}">${d.at - T < 15 ? 'Laden' : 'Gepland'}</i></div>`).join('') || '<div class="empty">Geen vertrekken in de komende 2,5 uur.</div>'}</div><div class="halfoot">Hal-scherm per standplaats: dezelfde data als de control tower, op een tv in de loods.</div></div></div>`;
    $('spView').querySelectorAll('[data-sp]').forEach(el => el.addEventListener('click', () => { pbSp = SP.find(s => s.n === el.dataset.sp); renderSpView(); }));
  }

  // ---------- assistent: voorstellen, vragen, chauffeurs en collega's ----------
  function nearestSp(pos, minLp = 12) { let best = null, bd = Infinity; for (const sp of SP) { if (laadpunten(sp) < minLp) continue; const d = Math.hypot((sp.lon - pos.lon) * 68, (sp.lat - pos.lat) * 111); if (d < bd) { bd = d; best = sp; } } return { sp: best, km: Math.round(bd) }; }
  function proposals() {
    const out = []; const T = state.simTime;
    for (const e of exceptions.slice(0, 14)) {
      const t = e.t, s = S.get(t.id); if (!s) continue;
      if (e.kind === 'Vertraging' && s.next) {
        const helper = fleet.trucks.find(h => h.base === t.base && h !== t && !h.helping && (S.get(h.id) || {}).st === 'terrein' && ((T - h.shiftStart + 1440) % 1440) < h.shiftEnd - 90);
        out.push({ id: 'v' + t.id, sev: 'bad', kind: 'Vertraging', t, title: `${t.id} haalt ${s.next.name} niet (ETA ${hhmm(s.next.eta)}, +${s.next.delay} min)`, action: helper ? `${helper.id} (${helper.driver}, op terrein in ${t.base.n}) neemt de resterende stops over; ${t.id} rijdt na ${s.next.name} terug.` : `Klant ${s.next.name} krijgt automatisch de nieuwe ETA ${hhmm(s.next.eta)} en een volg-link; de planner hoeft niet te bellen.`, why: helper ? `${helper.id} heeft nog ${((helper.shiftStart + helper.shiftEnd - T + 1440) % 1440 / 60).toFixed(1).replace('.', ',')} uur dienst en staat naast de lading.` : 'Geen vrije truck op de standplaats; informeren is dan de beste stap.', apply: () => { t.delayResolved = true; if (helper) helper.helping = t.id; sendMsg(t, helper ? `Planning: ${helper.id} neemt je resterende stops over na ${s.next.name}. Rij daarna terug naar ${t.base.n}.` : `Planning: klant ${s.next.name} is geïnformeerd over je nieuwe ETA ${hhmm(s.next.eta)}.`); } });
      } else if (e.kind === 'Rijtijd') {
        out.push({ id: 'r' + t.id, sev: 'warn', kind: 'Rijtijd', t, title: `${t.driver} (${t.id}) zit op ${fmtDrive(s.drive)} rijtijd`, action: `Pauze van 45 min inplannen bij ${s.next ? s.next.name : 'de volgende stop'} (aankomst ${s.next ? hhmm(s.next.eta) : '–'}); het tijdvenster van de stop erna blijft haalbaar.`, why: 'Pauze op een losplek kost geen extra stilstand; onderweg stoppen wel.', apply: () => { t.breakPlanned = true; sendMsg(t, `Planning: neem je pauze van 45 min bij ${s.next ? s.next.name : 'de volgende stop'}. Het tijdvenster daarna blijft haalbaar.`); } });
      } else if (e.kind === 'Accu') {
        const { sp, km } = nearestSp(s.pos);
        out.push({ id: 'a' + t.id, sev: 'warn', kind: 'Accu', t, title: `${t.id} heeft ${Math.round(s.soc)} % accu (${Math.round(t.range * s.soc / 100)} km)`, action: sp ? `25 min snelladen bij ${sp.n} (${laadpunten(sp)} laadpunten, ${km} km van de route); laadpunt wordt gereserveerd.` : 'Terug naar de standplaats om te laden.', why: 'Het bereik is te krap voor de terugrit; laden onderweg kost minder dan slepen.', apply: () => { t.chargePlanned = true; sendMsg(t, `Planning: laad 25 min bij ${sp ? sp.n : t.base.n}, laadpunt ${1 + (t.idx % 6)} is gereserveerd.`); } });
      } else if (e.kind === 'Techniek') {
        out.push({ id: 't' + t.id, sev: 'bad', kind: 'Techniek', t, title: `${t.id}: ${t.storing}`, action: `Werkorder in de garage ${t.base.hub ? 'Wognum' : 'Opmeer'} na de dienst (${hhmm(t.shiftStart + t.shiftEnd)}); reservetruck wordt klaargezet.`, why: 'De rit kan veilig worden afgemaakt; de storing moet vandaag nog bekeken worden.', apply: () => { t.workorder = true; sendMsg(t, `Planning: werkorder aangemaakt voor "${t.storing}". Na je dienst naar de garage; reservetruck staat klaar.`); } });
      }
    }
    return out;
  }
  function answer(q) {
    const ql = q.toLowerCase(); const vis = fleet.trucks.filter(t => matchBase(t) && (!F.sps.size || F.sps.has(t.base.n)));
    const truck = fleet.trucks.find(t => ql.includes(t.id.toLowerCase())) || fleet.trucks.find(t => ql.includes(t.driver.toLowerCase()));
    if (truck) { const s = S.get(truck.id); return `${truck.id} (${truck.driver}, ${truck.model}, standplaats ${truck.base.n}): ${ST[s.st].n.toLowerCase()}${s.next ? `, volgende stop ${s.next.name} om ${hhmm(s.next.eta)}${s.next.delay ? ` (+${s.next.delay} min)` : ''}` : ''}, ${truck.ev ? 'accu' : 'brandstof'} ${Math.round(s.soc)} %, rijtijd ${fmtDrive(s.drive)}.`; }
    if (/te laat|tijdvenster|vertraag/.test(ql)) { const L = exceptions.filter(e => e.kind === 'Vertraging'); return L.length ? `${L.length} trucks halen hun tijdvenster niet: ${L.slice(0, 6).map(e => `${e.t.id} (${e.t.base.n})`).join(', ')}${L.length > 6 ? ' en meer' : ''}. De voorstellen staan hiernaast.` : 'Geen trucks met een gemist tijdvenster binnen de huidige filters.'; }
    if (/accu|laden|laadpunt|elektr/.test(ql)) { const ev = vis.filter(t => t.ev); const laden = ev.filter(t => ((S.get(t.id) || {}).seg || {}).k === 'laden').length; const low = ev.filter(t => (S.get(t.id) || {}).soc < 25).length; return `${ev.length} elektrische voertuigen in beeld: ${laden} laden nu, ${low} hebben minder dan 25 % accu.`; }
    if (/rijtijd|pauze/.test(ql)) { const L = exceptions.filter(e => e.kind === 'Rijtijd'); return L.length ? `${L.length} chauffeurs zitten binnen 30 minuten op de rijtijdlimiet: ${L.map(e => `${e.t.driver} (${e.t.id})`).join(', ')}.` : 'Niemand zit binnen 30 minuten op de rijtijdlimiet.'; }
    const sp = SP.find(x => ql.includes(x.n.toLowerCase())); if (sp) { const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; for (const t of mine) { const st = (S.get(t.id) || {}).st; if (st) c[st]++; } return `${sp.n}: ${mine.length} trucks, ${c.onderweg + c.vertraagd} onderweg, ${c.klant} bij een klant, ${c.pauze} met pauze, ${c.terrein} op het terrein; ${fleet.departures(sp, state.simTime, 120).length} vertrekken in de komende twee uur.`; }
    const town = TOWNS.find(x => ql.includes(x.n.toLowerCase())); if (town) { const L = vis.filter(t => { const s = S.get(t.id); return s && s.next && s.next.name.toLowerCase().includes(town.n.toLowerCase()); }); return L.length ? `${L.length} trucks rijden naar ${town.n}: ${L.slice(0, 8).map(t => `${t.id} (ETA ${hhmm(S.get(t.id).next.eta)})`).join(', ')}.` : `Op dit moment rijdt geen truck naar ${town.n}.`; }
    if (/hoeveel|aantal|status/.test(ql)) return `${counts.onderweg + counts.vertraagd} trucks zijn onderweg, ${counts.klant} staan bij een klant, ${counts.pauze} hebben pauze en ${counts.terrein} staan op het terrein. ${kpi.onTime.toFixed(1).replace('.', ',')} % van de stops was op tijd.`;
    return 'Ik beantwoord vragen over tijdvensters, accu\'s, rijtijden, standplaatsen, plaatsen, trucks en chauffeurs. Probeer: "welke trucks halen hun tijdvenster niet?", "wat doet Wognum?" of "wie rijdt er naar Hoorn?".';
  }
  function renderAssist() {
    const el = $('assist'); if (!el) return; const props = proposals(); const T = state.simTime;
    const over = store.get('sl-overdracht') || '';
    el.innerHTML = `<div class="acol">
      <div class="acard"><h3>Voorstellen van de planning-assistent <b>${props.length}</b></h3>
        <div class="auto"><div><b>${applied.length}</b><span>vandaag toegepast</span></div><div><b>${props.length}</b><span>wachten op akkoord</span></div><div><b>${msgCount}</b><span>berichten naar chauffeurs</span></div></div>
        ${props.length ? props.map(p => `<div class="prop ${p.sev}"><i></i><div><b>${esc(p.title)}</b><span>${esc(p.kind)}</span><p>${esc(p.action)}</p><div class="why">Waarom: ${esc(p.why)}</div></div><button class="btn pri" data-apply="${p.id}">Pas toe</button></div>`).join('') : '<div class="empty">Geen open voorstellen. De assistent kijkt elke seconde opnieuw naar tijdvensters, rijtijden, accu\'s en storingen.</div>'}
        ${applied.length ? `<h4 class="sub">Afgehandeld <small>laatste ${Math.min(applied.length, 6)}</small></h4>${applied.slice(-6).reverse().map(a => `<div class="prop done ${a.sev}"><i></i><div><b>${esc(a.title)}</b><span>${hhmm(a.T)}</span><p>${esc(a.action)}</p></div></div>`).join('')}` : ''}
        <div class="hint">Zo werkt het in de echte versie: VROOM of Timefold rekent elke vijf minuten alle ritten opnieuw door met de live ETA's; de assistent legt per voorstel uit waarom, en de planner keurt goed met één klik. Routinewerk gaat vanzelf, uitzonderingen blijven mensenwerk.</div>
      </div>
      <div class="acard"><h3>Vraag het de assistent</h3>
        <div class="chat" id="chatBox">${chat.length ? chat.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)}</time></div>`).join('') : '<div class="empty">Stel een vraag in gewone taal over de live situatie.</div>'}</div>
        <div class="ask"><input id="askIn" placeholder="Bijvoorbeeld: welke trucks halen hun tijdvenster niet?" autocomplete="off"><button class="btn pri sm" id="askBtn">Vraag</button></div>
        <div class="sugg">${['Welke trucks halen hun tijdvenster niet?', 'Hoeveel eActros laden nu?', 'Wie zit bijna op zijn rijtijd?', 'Wat doet Wognum?', 'Wie rijdt er naar Hoorn?'].map(q => `<button class="chip sm" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="hint">Demo met regels op de live data. In de echte versie beantwoordt Claude deze vragen via een MCP-koppeling op de control tower, met dezelfde cijfers die de planner ziet.</div>
      </div>
    </div>
    <div class="acol">
      <div class="acard"><h3>Collega's op dienst</h3>
        ${COLLEGAS.map(([n, sp, role, a, b]) => { const on = T >= a && T < b; return `<div class="col"><span class="av ${on ? 'on' : ''}">${esc(n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(n)}</b><span>${esc(role)} · ${esc(sp)} · ${hhmm(a)}–${hhmm(b)}</span></div><em class="${on ? 'on' : ''}">${on ? 'op dienst' : 'buiten dienst'}</em></div>`; }).join('')}
        <h4 class="sub">Overdracht naar de volgende dienst</h4>
        <textarea id="overIn" class="over" placeholder="Wat moet de volgende planner weten? Bijvoorbeeld: W-0412 rijdt met vertraging voor AH Medemblik, klant is gebeld.">${esc(over)}</textarea>
        <div class="hint">De overdracht blijft staan voor de volgende planner (in deze demo in je eigen browser). In de echte versie hangt elke notitie aan de truck of de rit en ziet de hal hem ook.</div>
      </div>
      <div class="acard"><h3>Berichten met chauffeurs <b>${msgCount}</b></h3>
        ${(() => { const L = fleet.trucks.filter(t => t.msgs && t.msgs.length).slice(-6).reverse(); return L.length ? L.map(t => { const m = t.msgs[t.msgs.length - 1]; return `<div class="col" data-truck="${t.id}"><span class="av">${esc(t.driver.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(t.driver)} · ${t.id}</b><span>${esc(m.text)}</span></div><em>${hhmm(m.T)}</em></div>`; }).join('') : '<div class="empty">Nog geen berichten. Open een truck en stuur een bericht, of pas een voorstel toe.</div>'; })()}
        <div class="hint">Berichten komen in de app van de chauffeur en worden onderweg voorgelezen; antwoorden gaat met één knop. Geen vrije tekst achter het stuur.</div>
      </div>
    </div>`;
    el.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { const p = props.find(x => x.id === b.dataset.apply); if (!p) return; p.apply(); applied.push({ ...p, T: state.simTime }); feed.unshift({ T: state.simTime, t: p.t, txt: `voorstel toegepast: ${p.kind.toLowerCase()}`, sev: 'ok' }); frame(true); }));
    el.querySelectorAll('[data-truck]').forEach(x => x.addEventListener('click', () => selectTruck(x.dataset.truck)));
    const ask = () => { const v = $('askIn').value.trim(); if (!v) return; chat.push({ me: true, text: v, T: state.simTime }); chat.push({ me: false, text: answer(v), T: state.simTime }); if (chat.length > 12) chat.splice(0, chat.length - 12); renderAssist(); const box = $('chatBox'); if (box) box.scrollTop = box.scrollHeight; };
    $('askBtn').onclick = ask; $('askIn').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
    el.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { $('askIn').value = b.dataset.ask; ask(); }));
    $('overIn').addEventListener('input', e => store.set('sl-overdracht', e.target.value));
  }

  // ---------- tabs, tijdbalk, thema ----------
  function setTab(name) { tab = name; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + name)); if (name === 'kaart') setTimeout(() => mapApi && mapApi.map.resize(), 30); frame(true); }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('q').addEventListener('input', e => { F.q = e.target.value.trim(); frame(true); });
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') { const q = F.q.toLowerCase(); const t = fleet.trucks.find(t => t.id.toLowerCase() === q || t.driver.toLowerCase() === q || t.plate.toLowerCase() === q); if (t) selectTruck(t.id); const sp = SP.find(s => s.n.toLowerCase() === q); if (sp) selectSp(sp); } });
  $('timebar').innerHTML = `<span class="lbl">Vandaag</span><input type="range" id="scrub" min="0" max="1439" step="1" value="0"><b id="tbClock">--:--</b><button class="tb" id="playBtn" title="Pauzeer of speel af">❚❚</button><div class="spd">${[1, 12, 60, 300].map(s => `<button data-s="${s}" class="${s === state.speed ? 'on' : ''}">${s}×</button>`).join('')}</div><button class="tb" id="nowBtn" title="Spring naar de echte klok">Nu</button><span class="tbhint">Schuif voor replay · 1× is echte tijd</span>`;
  $('scrub').addEventListener('input', e => { state.simTime = +e.target.value; frame(true); });
  $('playBtn').onclick = () => { state.playing = !state.playing; $('playBtn').textContent = state.playing ? '❚❚' : '▶'; };
  $('nowBtn').onclick = () => { const n = new Date(); state.simTime = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; frame(true); };
  $('timebar').querySelector('.spd').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; state.speed = +b.dataset.s; $('timebar').querySelectorAll('.spd button').forEach(x => x.classList.toggle('on', x === b)); });
  $('themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; state.theme = t; store.set('sl-theme', t); mapApi && mapApi.setTheme(t); $('themeBtn').textContent = t === 'dark' ? '☀' : '☾'; };
  $('themeBtn').textContent = state.theme === 'dark' ? '☀' : '☾';
  $('sideBtn').onclick = () => { $('side').classList.toggle('open'); $('panel').classList.remove('open'); };
  $('panelBtn').onclick = () => { $('panel').classList.toggle('open'); $('side').classList.remove('open'); };
  $('legend').innerHTML = Object.values(ST).map(s => `<span><i style="background:${s.color}"></i>${s.n}</span>`).join('');
  const ob = $('onboard'); if (store.get('sl-onboard') === '1') ob.style.display = 'none'; $('startBtn').onclick = () => { ob.style.display = 'none'; store.set('sl-onboard', '1'); };
  let noticeT = null; function notice(msg) { const n = $('notice'); n.textContent = msg; n.classList.add('on'); clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('on'), 7000); }

  function attachMap(api) { mapApi = api; renderSide(); api.whenReady(() => { renderSide(); frame(true); api.map.on('zoomend', () => renderCrumb()); }); }
  return { attachMap, frame, selectTruck, selectSp, hover, notice };
}
