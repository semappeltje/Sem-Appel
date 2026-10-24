import * as THREE from 'three';
import { DIV, SP, TOWNS } from './places.js';

const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = ms => new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
const mm = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const nf = n => new Intl.NumberFormat('nl-NL').format(Math.round(n));
const euro = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export function createUI(world, fleet, state) {
  const { trucks, stats, events } = fleet; const { camera, controls, renderer } = world;
  const divOn = { winkel: true, netwerk: true, bulk: true, dranken: true, bezorg: true }, layers = { sp: true, klant: true, trucks: true, wegen: true, labels: true, steden: true };
  $('#divChips').innerHTML = Object.keys(DIV).map(k => `<button class="chip" data-div="${k}" aria-pressed="true" style="--c:${DIV[k].css}" type="button"><i></i>${DIV[k].n}</button>`).join('');
  $('#layerChips').innerHTML = [['sp', 'Standplaatsen'], ['klant', 'Klanten'], ['trucks', 'Trucks'], ['wegen', 'Wegen'], ['labels', 'Labels'], ['steden', 'Steden']].map(([k, n]) => `<button class="chip" data-layer="${k}" aria-pressed="true" type="button">${n}</button>`).join('');
  $('#legend').innerHTML = Object.keys(DIV).map(k => `<div><i style="--c:${DIV[k].css}"></i>${DIV[k].n}</div>`).join('') + `<div><i class="sq" style="--c:#F2F2F2"></i>Klant-DC</div><div><i class="sq" style="--c:#E3001F"></i>Warehouse / garage</div><div><i style="--c:#39C27C"></i>Elektrische truck</div><div><i class="sq" style="--c:#FCC41F"></i>Snelweg (echte ligging)</div>`;
  function applyFilters() { for (const t of trucks) { const v = divOn[t.div] && layers.trucks; t.mesh.visible = v; t.trail.visible = v; } for (const s of SP) { s.mesh.visible = layers.sp && s.div.some(d => divOn[d]); if (s.klantMesh) s.klantMesh.visible = layers.klant; } world.roadGroup.visible = layers.wegen; }
  // ---- camera ----
  const PRESETS = { nl: [[0, 0, 20], [0, 330, 350]], nh: [[-40, 0, -48], [-40, 110, 20]], rand: [[-55, 0, 12], [-55, 120, 110]], brab: [[-5, 0, 62], [-5, 125, 160]], oost: [[85, 0, -45], [85, 150, 60]] };
  let camAnim = null;
  function flyTo(target, pos, ms = 1100) { state.follow = null; camAnim = { t0: performance.now(), ms, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: new THREE.Vector3(...target), toP: new THREE.Vector3(...pos) }; }
  function flyToObject(x, z, dist = 95, h = 55, keepAngle = true) { const dir = keepAngle ? camera.position.clone().sub(controls.target).setY(0).normalize() : new THREE.Vector3(0, 0, 1); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); flyTo([x, 0, z], [x + dir.x * dist, h, z + dir.z * dist]); }
  // ---- selectie ----
  function select(u) { state.selected = u; $('#panel').hidden = false; renderPanel(); if (u.type === 'truck') { state.follow = u.ref; const p = u.ref.mesh.position; const dist = Math.min(110, camera.position.distanceTo(controls.target)); flyToObject(p.x, p.z, dist, Math.max(40, dist * 0.6)); setTimeout(() => { state.follow = u.ref; }, 1150); } else { const s = u.ref; flyToObject(s.x, -s.y, 120, 70); } }
  function closePanel() { $('#panel').hidden = true; state.selected = null; state.follow = null; }
  function renderPanel() {
    const u = state.selected; if (!u) return;
    if (u.type === 'truck') {
      const t = u.ref, d = DIV[t.div]; const next = t.route.marks.find(m => m.km > t.km); const etaMin = next ? (next.km - t.km) / t.speed * 60 : null; const left = t.driveMin >= 270 ? 0 : 270 - t.driveMin; const range = t.ev ? Math.round(t.fuel / 100 * (t.van ? 230 : 500)) : Math.round(t.fuel / 0.29);
      $('#pTitle').textContent = t.model; $('#pSub').innerHTML = `<span class="plate">${esc(t.kenteken)}</span> &nbsp; ${esc(d.n)} · ${esc(t.base.n)}`;
      const plan = t.route.marks.map((m, i) => { const done = m.km <= t.km, now = !done && (i === 0 || t.route.marks[i - 1].km <= t.km); const when = state.simTime + (m.km - t.km) / t.speed * 3600000; const what = i === 0 ? 'Vertrek standplaats' : i === t.route.marks.length - 1 ? 'Retour standplaats' : t.div === 'winkel' ? 'Lossen filiaal' : t.div === 'bezorg' ? 'Bezorgronde' : 'Lossen'; return `<li><span class="t">${fmtT(when)}</span><span class="d ${done ? 'done' : now ? 'now' : ''}"></span><span>${what}<small>${esc(m.place.n)}${m.place.klant && i > 0 && i < t.route.marks.length - 1 ? ' · ' + esc(m.place.klant) : ''}</small></span></li>`; }).join('');
      const own = events.filter(e => e.text.includes(t.kenteken)).slice(-4).reverse();
      $('#pBody').innerHTML = `<div class="sec"><span class="tag ${t.ev ? 'ev' : 'grey'}">${t.ev ? 'Elektrisch' : 'Diesel'}</span> <span class="tag red">${esc(t.state)}</span></div>
      <div class="sec"><h3>Chauffeur</h3><div class="kv"><div>Naam</div><div>${esc(t.driver.name)}</div><div>Standplaats</div><div>${esc(t.base.n)}</div><div>Bij Simon Loos sinds</div><div>${t.driver.since}</div><div>Code 95 geldig tot</div><div>${t.driver.code95}</div><div>Rijtijd sinds pauze</div><div class="num">${mm(t.driveMin)} van 4:30 · pauze over ${mm(left)}</div></div><div class="bar"><i class="${left < 30 ? 'warn' : ''}" style="width:${Math.min(100, t.driveMin / 270 * 100).toFixed(0)}%"></i></div></div>
      <div class="sec"><h3>Lading en rit</h3><div class="kv"><div>Lading</div><div>${esc(t.lading)}</div><div>Klant</div><div>${esc(t.base.klant)}</div><div>Stops gedaan</div><div class="num">${t.stopsDone}</div><div>Volgende stop</div><div>${etaMin == null ? '–' : `${esc(next.place.n)} over ${mm(etaMin)} (${fmtT(state.simTime + etaMin * 60000)})`}</div><div>Km vandaag</div><div class="num">${nf(t.kmToday)} km</div><div>Snelheid</div><div class="num">${t.state === 'onderweg' ? t.speed + ' km/u' : '0 km/u'}</div></div></div>
      <div class="sec"><h3>${t.ev ? 'Accu' : 'Brandstof'}</h3><div class="kv"><div>${t.ev ? 'Lading' : 'Tank'}</div><div class="num">${t.ev ? Math.round(t.fuel) + ' %' : nf(t.fuel) + ' van ' + nf(t.cap) + ' liter'}</div><div>Actieradius</div><div class="num">circa ${nf(range)} km</div></div><div class="bar"><i class="${t.ev ? 'ev' : ''} ${(t.ev ? t.fuel : t.fuel / t.cap * 100) < 15 ? 'warn' : ''}" style="width:${(t.ev ? t.fuel : t.fuel / t.cap * 100).toFixed(0)}%"></i></div></div>
      <div class="sec"><h3>Planning vandaag</h3><ul class="tl">${plan}</ul></div>
      ${own.length ? `<div class="sec"><h3>Laatste meldingen</h3><ul class="tl">${own.map(e => `<li><span class="t">${fmtT(e.time)}</span><span class="d done"></span><span>${e.text}</span></li>`).join('')}</ul></div>` : ''}
      <div class="row"><button class="btn primary" id="followBtn" data-id="${t.id}" aria-pressed="${state.follow === t}" type="button">Volg deze truck</button><button class="btn" data-sp="${esc(t.base.n)}" type="button">Naar standplaats</button></div>`;
    } else {
      const s = u.ref, ts = trucks.filter(t => t.base === s), onRoad = ts.filter(t => t.state === 'onderweg').length;
      $('#pTitle').textContent = s.n; $('#pSub').textContent = (s.hub ? 'Hoofdkantoor · ' : '') + s.div.map(d => DIV[d].n).join(', ');
      $('#pBody').innerHTML = `<div class="sec">${s.div.map(d => `<span class="tag" style="background:${DIV[d].css};color:#111">${esc(DIV[d].n)}</span> `).join('')}</div>
      <div class="sec"><h3>Standplaats</h3><div class="kv"><div>Klant</div><div>${esc(s.klant)}</div>${s.note ? `<div>Bijzonderheden</div><div>${esc(s.note)}</div>` : ''}<div>Trucks vanuit hier</div><div class="num">${ts.length} (${onRoad} op de weg)</div><div>Elektrisch</div><div class="num">${ts.filter(t => t.ev).length}</div><div>Open vacatures</div><div><a href="https://werkenbijsimonloos.nl/vacatures" target="_blank" rel="noopener" style="color:var(--yellow)">${s.vac} op werkenbijsimonloos.nl</a></div></div></div>
      <div class="sec"><h3>Trucks</h3><div class="list">${ts.map(t => `<button class="item" data-truck="${t.id}" style="--c:${DIV[t.div].css}" type="button"><i></i><span>${esc(t.kenteken)} · ${esc(t.driver.name)}</span><span class="st ${esc(t.state.split(' ')[0])}">${esc(t.state)}</span></button>`).join('') || '<span style="color:var(--muted)">Geen trucks in de simulatie</span>'}</div></div>`;
    }
  }
  // ---- vlootlijst ----
  function renderFleet() { const sorted = [...trucks].sort((a, b) => a.base.n.localeCompare(b.base.n) || a.kenteken.localeCompare(b.kenteken)); $('#fleetList').innerHTML = sorted.map(t => `<button class="item" data-truck="${t.id}" style="--c:${DIV[t.div].css}" type="button"><i></i><span>${esc(t.kenteken)} · ${esc(t.driver.name)}<br><small style="margin:0">${esc(t.base.n)}${t.ev ? ' · elektrisch' : ''}</small></span><span class="st ${esc(t.state.split(' ')[0])}">${esc(t.state)}</span></button>`).join(''); }
  // ---- KPI's en feed ----
  function renderKpis() { const onRoad = trucks.filter(t => t.state === 'onderweg' && t.mesh.visible).length, ev = trucks.filter(t => t.ev).length, deliveries = trucks.reduce((a, t) => a + t.stopsDone, 0) + stats.deliveries, ot = stats.stops ? (0.974 * 40 + stats.onTime) / (40 + stats.stops) * 100 : 97.4, co2 = stats.kwh / 1.15 * 0.85;
    $('#kpis').innerHTML = `<div class="kpi"><b class="num">${onRoad}</b><span>op de weg</span></div><div class="kpi"><b class="num">${nf(deliveries)}</b><span>leveringen</span></div><div class="kpi"><b class="num">${ot.toFixed(1).replace('.', ',')}%</b><span>op tijd</span></div><div class="kpi"><b class="num">${nf(stats.kmToday)}</b><span>km gereden</span></div><div class="kpi"><b class="num">${ev}</b><span>elektrisch</span></div><div class="kpi"><b class="num">${nf(co2)} kg</b><span>CO₂ bespaard</span></div>`; }
  let feedCount = 0;
  function renderFeed() { if (events.length === feedCount) return; feedCount = events.length; $('#feedIn').innerHTML = events.slice(-3).map(e => `<div class="ev"><span class="num">${fmtT(e.time)}</span> · ${e.text}</div>`).join(''); }
  // ---- picking en hover ----
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(); const el = renderer.domElement; let down = null;
  function hit(cx, cy) { const r = el.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, camera); const hits = ray.intersectObjects([...fleet.truckGroup.children.filter(o => o.visible), ...world.pinGroup.children.filter(o => o.visible)], true); if (!hits.length) return null; let o = hits[0].object; while (o && !(o.userData && o.userData.type)) o = o.parent; return o ? o.userData : null; }
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; if (state.tour) stopTour(); });
  el.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const u = hit(e.clientX, e.clientY); if (u) select(u); } down = null; });
  let hoverT = 0; const tip = $('#tip');
  el.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const now = performance.now(); if (now - hoverT < 70) return; hoverT = now; const u = hit(e.clientX, e.clientY); if (u) { tip.hidden = false; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.textContent = u.type === 'truck' ? `${u.ref.kenteken} · ${u.ref.driver.name} · ${u.ref.state}` : `${u.ref.n} · ${u.ref.klant}`; el.style.cursor = 'pointer'; } else { tip.hidden = true; el.style.cursor = ''; } });
  el.addEventListener('pointerleave', () => { tip.hidden = true; });
  // ---- rondleiding ----
  let tourTimer = 0;
  function tourNext() { const cands = trucks.filter(t => t.mesh.visible && t.state === 'onderweg'); let cap; if (cands.length && Math.random() < 0.75) { const t = cands[Math.floor(Math.random() * cands.length)]; state.selected = { type: 'truck', ref: t }; $('#panel').hidden = false; renderPanel(); const next = t.route.marks.find(m => m.km > t.km); cap = `${t.kenteken} · ${t.driver.name} · ${DIV[t.div].n}${next ? ' → ' + next.place.n : ''}`; const p = t.mesh.position; flyToObject(p.x, p.z, 85, 45, false); setTimeout(() => { if (state.tour) state.follow = t; }, 1150); } else { const pool = SP.filter(x => x.trucks > 0); const s = pool[Math.floor(Math.random() * pool.length)]; state.selected = { type: 'sp', ref: s }; $('#panel').hidden = false; renderPanel(); cap = `Standplaats ${s.n} · ${s.klant}`; flyToObject(s.x, -s.y, 110, 65, false); } $('#caption').hidden = false; $('#caption').textContent = cap; tourTimer = 13; }
  function startTour() { state.tour = true; $('#tourBtn').setAttribute('aria-pressed', 'true'); tourNext(); }
  function stopTour() { state.tour = false; $('#tourBtn').setAttribute('aria-pressed', 'false'); $('#caption').hidden = true; }
  // ---- events ----
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.div) { divOn[b.dataset.div] = !divOn[b.dataset.div]; b.setAttribute('aria-pressed', divOn[b.dataset.div]); b.classList.toggle('off', !divOn[b.dataset.div]); applyFilters(); }
    if (b.dataset.layer) { layers[b.dataset.layer] = !layers[b.dataset.layer]; b.setAttribute('aria-pressed', layers[b.dataset.layer]); b.classList.toggle('off', !layers[b.dataset.layer]); applyFilters(); }
    if (b.dataset.speed) { state.speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#speedLbl').textContent = state.speed === 1 ? 'live' : `${state.speed}× versneld`; }
    if (b.dataset.cam) { const [t, p] = PRESETS[b.dataset.cam]; flyTo(t, p); document.querySelectorAll('[data-cam]').forEach(x => x.setAttribute('aria-pressed', x === b)); if (state.tour) stopTour(); }
    if (b.dataset.dtab) { document.querySelectorAll('[data-dtab]').forEach(x => x.setAttribute('aria-selected', x === b)); document.querySelectorAll('.dtab').forEach(d => d.hidden = d.id !== 'dtab-' + b.dataset.dtab); if (b.dataset.dtab === 'vloot') renderFleet(); }
    if (b.dataset.truck) { const t = trucks.find(x => x.id === b.dataset.truck); if (t) { if (state.tour) stopTour(); select({ type: 'truck', ref: t }); } }
    if (b.dataset.sp) { const s = SP.find(x => x.n === b.dataset.sp); if (s) { if (state.tour) stopTour(); select({ type: 'sp', ref: s }); } }
    if (b.id === 'followBtn') { const t = trucks.find(x => x.id === b.dataset.id); state.follow = state.follow === t ? null : t; b.setAttribute('aria-pressed', state.follow === t); }
    if (b.id === 'pClose') { closePanel(); if (state.tour) stopTour(); }
    if (b.id === 'dockToggle') { const d = $('#dock'); d.classList.toggle('open'); $('#dockArrow').textContent = d.classList.contains('open') ? '▼' : '▲'; }
    if (b.id === 'tourBtn') { state.tour ? stopTour() : startTour(); }
    if (b.id === 'fxBtn') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); world.setFx(on); }
    if (b.id === 'startBtn') { $('#onboard').hidden = true; try { localStorage.setItem('sl-live-seen', '1'); } catch (e) {} }
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); if (state.tour) stopTour(); } });
  $('#search').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); const out = $('#searchOut'); if (!q) { out.innerHTML = ''; return; } const ts = trucks.filter(t => (t.kenteken + ' ' + t.driver.name + ' ' + t.base.n + ' ' + t.model).toLowerCase().includes(q)).slice(0, 5), ss = SP.filter(s => (s.n + ' ' + s.klant).toLowerCase().includes(q)).slice(0, 4); out.innerHTML = ts.map(t => `<button class="item" data-truck="${t.id}" style="--c:${DIV[t.div].css}" type="button"><i></i><span>${esc(t.kenteken)} · ${esc(t.driver.name)}</span><small>${esc(t.base.n)}</small></button>`).join('') + ss.map(s => `<button class="item" data-sp="${esc(s.n)}" style="--c:${DIV[s.div[0]].css}" type="button"><i></i><span>${esc(s.n)}</span><small>${esc(s.klant)}</small></button>`).join('') || '<div style="color:var(--muted);font-size:12px">Niets gevonden</div>'; });
  $('#speedLbl').textContent = '12× versneld'; $('#fxBtn').setAttribute('aria-pressed', String(world.fx));
  try { if (localStorage.getItem('sl-live-seen')) $('#onboard').hidden = true; } catch (e) {}
  // ---- per frame ----
  let kpiAcc = 1, panelAcc = 0, clockAcc = 1;
  function frame(dtReal) {
    if (camAnim) { const k = Math.min(1, (performance.now() - camAnim.t0) / camAnim.ms), e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e); camera.position.lerpVectors(camAnim.fromP, camAnim.toP, e); if (k >= 1) camAnim = null; }
    else if (state.follow) { const p = state.follow.mesh.position; const d = new THREE.Vector3(p.x, 0, p.z).sub(controls.target).multiplyScalar(0.12); controls.target.add(d); camera.position.add(d); }
    controls.update();
    const dist = camera.position.distanceTo(controls.target); const s = THREE.MathUtils.clamp(dist / 230, 0.6, 1.6); for (const t of trucks) t.mesh.scale.setScalar(s);
    const far = dist > 320, mid = dist > 150; for (const sp of SP) { sp.label.visible = layers.labels && sp.mesh.visible && (!far || sp.hub || sp.vac >= 4); if (sp.klabel) sp.klabel.visible = layers.labels && layers.klant && sp.mesh.visible && !mid; } for (const t of TOWNS) if (t.label) t.label.visible = layers.steden && layers.labels && !far;
    if (state.tour) { tourTimer -= dtReal; if (tourTimer <= 0) tourNext(); }
    clockAcc += dtReal; if (clockAcc > 0.5) { clockAcc = 0; $('#clock').textContent = fmtT(state.simTime); const h = new Date(state.simTime).getHours(); $('#daypart').textContent = h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : h < 23 ? 'avond' : 'nacht'; }
    kpiAcc += dtReal; if (kpiAcc > 1) { kpiAcc = 0; renderKpis(); renderFeed(); if (!$('#dtab-vloot').hidden) renderFleet(); }
    panelAcc += dtReal; if (panelAcc > 1 && state.selected) { panelAcc = 0; renderPanel(); }
  }
  applyFilters(); renderKpis(); renderFleet();
  return { frame, select, flyTo, PRESETS };
}
