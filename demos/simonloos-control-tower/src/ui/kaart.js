// Kaartweergave: de filterbalk (statussen met tellers, losse opleggers, actieve selecties), de kaartlagen en de 3D-knop,
// de tijdbalk van de simulatie, de kaart bij aanwijzen en de panelen rechts bij een selectie (voertuig, oplegger,
// standplaats, pauzeplek, winkel). De kaart zelf (map.js) is van de kaartbouwer; hier zitten alleen de knoppen en panelen.
import { esc, ic, fmt, hhmm, day, nl1, fmtDrive, durTxt, plate, kenteken, meter, kv, empty, on, stBadge, trBadge, VST, TST, initials, stars, ritBadge, zBadge, SOORT, clockAt, lateBy, adresTxt } from './base.js';
import { portretHtml, vulPortretten } from './portret.js';
import { SP, DIV, laadpunten } from '../places.js';
import { KIND, TRT } from '../fleet.js';
import { depStatus, depBadge } from './overzicht.js';

const QUICK = ['Dock gewijzigd, zie app', 'Pauze bij de volgende stop', 'Bel de planning als je stilstaat', 'Rij na deze stop terug naar de standplaats'];
const STKEYS = ['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein'];
let bewaardKf = null;

// ---------- filterbalk boven de kaart ----------
export function renderMapbar(ctx) {
  const el = ctx.$('mapbar'); if (!el) return; const F = ctx.F; const c = ctx.counts(); const k = ctx.kpi();
  // de statusfilter en het dimmen blijven na herladen staan (sl-kaartfilter)
  if (bewaardKf === null) bewaardKf = ctx.store.get('sl-kaartfilter') || JSON.stringify({ sts: STKEYS, dim: true });
  const kf = JSON.stringify({ sts: STKEYS.filter(s => F.sts.has(s)), dim: !!F.dim }); if (kf !== bewaardKf) { bewaardKf = kf; ctx.store.set('sl-kaartfilter', kf); }
  const all = F.sts.size === STKEYS.length;
  // Rust op de kaart: hooguit drie getallen in beeld (onderweg, vertraagd, losse opleggers); de andere tellers staan in de
  // titel van de knop en op het Overzicht
  const getal = s => s === 'onderweg' || s === 'vertraagd';
  const chips = STKEYS.map(s => `<button class="mc ${all ? '' : F.sts.has(s) ? 'on' : 'off'}" type="button" data-st="${s}" aria-pressed="${!all && F.sts.has(s)}" title="${fmt(c[s] || 0)} ${VST[s].n.toLowerCase()}. ${all ? `Klik om alleen ${VST[s].n.toLowerCase()} te tonen` : F.sts.has(s) ? 'Klik om weg te halen' : 'Klik om erbij te zetten'}"><i class="dot st-${s}"></i>${VST[s].n}${getal(s) ? ` <b>${fmt(c[s] || 0)}</b>` : ''}</button>`).join('');
  const extra = [
    `<span class="sep"></span><button class="mc ${ctx.trailersOnMap() ? 'on' : ''}" type="button" data-trl="1" aria-pressed="${ctx.trailersOnMap()}" title="Losse opleggers op de kaart (o)">${ic('trailer', 15)}Losse opleggers <b>${fmt(k.loose || 0)}</b></button>`,
    all ? '' : `<button class="mc" type="button" data-reset="1">Alle statussen</button>`,
    F.sps.size ? `<button class="mc x" type="button" data-clear="sps" title="Standplaatsselectie loslaten">${esc(F.sps.size === 1 ? [...F.sps][0] : `${F.sps.size} standplaatsen`)} ${ic('x', 13)}</button>` : '',
    F.ids ? `<button class="mc x" type="button" data-clear="ids" title="Selectie loslaten">${fmt(F.ids.size)} geselecteerde voertuigen ${ic('x', 13)}</button>` : '',
    F.trIds ? `<button class="mc x" type="button" data-clear="trids" title="Selectie loslaten">${fmt(F.trIds.size)} geselecteerde opleggers ${ic('x', 13)}</button>` : '',
  ].join('');
  const h = `<div class="mapchips" role="toolbar" aria-label="Filters op de kaart">${chips}${extra}</div>`;
  if (el.dataset.h !== h) { const f = el.contains(document.activeElement) ? document.activeElement.dataset : null; el.innerHTML = h; el.dataset.h = h; if (f) { const sel = f.st ? `[data-st="${f.st}"]` : f.trl ? '[data-trl]' : null; const x = sel && el.querySelector(sel); if (x) x.focus(); } }
}
export function bindMapbar(ctx) {
  const el = ctx.$('mapbar'); const F = ctx.F;
  on(el, 'click', '[data-st]', (e, b) => { const k = b.dataset.st; if (F.sts.size === STKEYS.length) F.sts = new Set([k]); else if (F.sts.has(k) && F.sts.size === 1) F.sts = new Set(STKEYS); else if (F.sts.has(k)) F.sts.delete(k); else F.sts.add(k); ctx.frame(true); });
  on(el, 'click', '[data-reset]', () => { F.sts = new Set(STKEYS); ctx.frame(true); });
  on(el, 'click', '[data-trl]', () => ctx.setTrailersOnMap(!ctx.trailersOnMap()));
  on(el, 'click', '[data-clear]', (e, b) => { const k = b.dataset.clear; if (k === 'sps') ctx.clearSps(); else if (k === 'ids') { F.ids = null; ctx.frame(true); } else { F.trIds = null; ctx.frame(true); } });
}

// ---------- kaartlagen, 3D, tijdbalk ----------
export function renderMaptools(ctx) {
  const m = ctx.mapApi(); const d3 = m && m.has3d(); const three = ctx.three();
  ctx.$('maptools').innerHTML = `<button class="ib" type="button" id="layersBtn" aria-haspopup="true" aria-expanded="false" title="Kaartlagen" aria-label="Kaartlagen">${ic('layers', 18)}</button>${d3 ? `<button class="ib" type="button" id="threeBtn" title="3D-wereld (d)" aria-label="3D-wereld" aria-pressed="${three}">${ic('box', 18)}</button>` : ''}<button class="ib" type="button" id="homeBtn" title="Naar je werkgebied" aria-label="Naar je werkgebied">${ic('locate', 18)}</button>`;
}
// De basiskaart, alleen in de losse versie (ingebed laadt de kaart niets van buiten): ingebouwd, OpenStreetMap (via
// OpenFreeMap), de luchtfoto of de topografische kaart (BRT) van PDOK. De keuze blijft bewaard (sl-kaartlaag; sl-online
// voor oudere versies). Dezelfde ids als in main.js (#baseSeg [data-base]): laadt een bron niet, dan zet main.js de
// keuze terug op ingebouwd, ook als het menu nog open staat.
export const BASES = [['kaart', 'Ingebouwd', 'werkt altijd, ook zonder internet'], ['online', 'OpenStreetMap', 'alle straten en gebouwen (OpenFreeMap)'], ['luchtfoto', 'Luchtfoto', 'PDOK, 8 cm'], ['brt', 'Topografisch', 'BRT-achtergrondkaart (PDOK)']];
const BASENAAM = { online: 'De online kaart (OpenStreetMap)', luchtfoto: 'De luchtfoto', brt: 'De BRT-achtergrondkaart' };
export function kiesBasis(ctx, k) {
  const m = ctx.mapApi(); if (!m || !BASES.some(x => x[0] === k)) return false;
  if (!m.hasBase(k)) { ctx.L.toast(`${BASENAAM[k] || 'Deze kaart'} is in deze omgeving niet bereikbaar.`, { icon: 'info' }); return false; }
  m.setBase(k); ctx.store.set('sl-kaartlaag', k); ctx.store.set('sl-online', k === 'online' ? 'on' : 'off');
  return true;
}
const markBase = (el, k) => el.querySelectorAll('[data-base]').forEach(x => { const on2 = x.dataset.base === k; x.classList.toggle('on', on2); x.setAttribute('aria-checked', String(on2)); });
export function layersMenu(ctx, b) {
  const m = ctx.mapApi(); const d3 = m && m.has3d(); const tg = (id, on2, label, sub = '') => `<label class="tgl"><input type="checkbox" id="${id}" ${on2 ? 'checked' : ''}><i></i><span>${esc(label)}${sub ? `<small style="display:block">${esc(sub)}</small>` : ''}</span></label>`;
  const nu = m && m.base ? m.base() : 'kaart';
  const basis = m && m.hasTiles() ? `<div class="basesel" id="baseSeg" role="radiogroup" aria-labelledby="baseSegL"><span class="bl" id="baseSegL">Basiskaart</span>${BASES.map(([k, n, d]) => `<button type="button" role="radio" data-base="${k}" aria-checked="${nu === k}" class="${nu === k ? 'on' : ''}"><i></i><span>${esc(n)}<small>${esc(d)}</small></span></button>`).join('')}</div>` : '';
  ctx.L.openPop(b, `<div class="menu-h">Kaartlagen</div>${basis}${d3 ? tg('threeTog', ctx.three(), '3D-wereld', 'toets d') : ''}${tg('trlTog', ctx.trailersOnMap(), 'Losse opleggers', 'toets o')}${tg('restTog', ctx.restOnMap(), 'Pauzeplekken')}${tg('dimTog', ctx.F.dim, 'Andere standplaatsen gedimd', 'als je werkgebied één standplaats is')}`, {
    cls: 'layers', label: 'Kaartlagen', onBind: p => {
      p.addEventListener('click', e => { const x = e.target.closest('[data-base]'); if (x && kiesBasis(ctx, x.dataset.base)) markBase(p, x.dataset.base); });
      // pijltjes lopen door de keuzes; kiezen met Enter of spatie (elke keuze laadt een kaart van buiten)
      p.addEventListener('keydown', e => {
        const x = e.target.closest('[data-base]'); if (!x || !/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
        const L = [...p.querySelectorAll('[data-base]')]; const i = L.indexOf(x); const n = /Down|Right/.test(e.key) ? (i + 1) % L.length : (i - 1 + L.length) % L.length;
        e.preventDefault(); e.stopPropagation(); L[n].focus();
      });
      p.addEventListener('change', e => {
        const id = e.target.id; const v = e.target.checked;
        if (id === 'threeTog') ctx.set3dMode(v);
        else if (id === 'trlTog') ctx.setTrailersOnMap(v);
        else if (id === 'restTog') ctx.setRestOnMap(v);
        else if (id === 'dimTog') { ctx.F.dim = v; ctx.frame(true); }
      });
    },
  });
}
export function mountTimebar(ctx) {
  const st = ctx.state;
  ctx.$('timebar').innerHTML = `<button class="ib sm" type="button" id="playBtn" aria-label="${st.playing ? 'Pauzeer' : 'Speel af'}" title="${st.playing ? 'Pauzeer de simulatie' : 'Speel de simulatie af'}">${ic(st.playing ? 'pause' : 'play', 15)}</button><b id="tbClock">${hhmm(st.simTime)}</b><label class="sr" for="scrub">Tijd van vandaag</label><input type="range" id="scrub" min="0" max="1439" step="1" value="${Math.floor(st.simTime)}"><div class="seg" role="group" aria-label="Snelheid">${[1, 12, 60, 300].map(s => `<button type="button" data-s="${s}" aria-pressed="${st.speed === s}" class="${st.speed === s ? 'on' : ''}">${s}×</button>`).join('')}</div><button class="btn ghost sm" type="button" id="nowBtn" title="Terug naar de echte klok">Nu</button>`;
  const tb = ctx.$('timebar');
  tb.querySelector('#scrub').addEventListener('input', e => ctx.setTime(+e.target.value));
  tb.querySelector('#playBtn').addEventListener('click', () => ctx.setPlaying(!st.playing));
  tb.querySelector('#nowBtn').addEventListener('click', () => ctx.setNow());
  on(tb, 'click', '[data-s]', (e, b) => ctx.setSpeed(+b.dataset.s));
}
export function updateTimebar(ctx) {
  const st = ctx.state; const tb = ctx.$('timebar'); if (!tb || !tb.firstChild) return;
  const c = tb.querySelector('#tbClock'); const v = hhmm(st.simTime); if (c.textContent !== v) c.textContent = v;
  const sc = tb.querySelector('#scrub'); if (document.activeElement !== sc) sc.value = Math.floor(st.simTime);
  const pb = tb.querySelector('#playBtn'); const want = st.playing ? 'Pauzeer' : 'Speel af'; if (pb.getAttribute('aria-label') !== want) { pb.setAttribute('aria-label', want); pb.title = st.playing ? 'Pauzeer de simulatie' : 'Speel de simulatie af'; pb.innerHTML = ic(st.playing ? 'pause' : 'play', 15); }
  tb.querySelectorAll('[data-s]').forEach(b => { const on2 = +b.dataset.s === st.speed; b.classList.toggle('on', on2); b.setAttribute('aria-pressed', on2); });
}

// ---------- kaart bij aanwijzen ----------
// het kaartje bij het aanwijzen van een voertuig op de kaart: vast aan het anker van de kaart (mapApi.anchor), zodat het
// meerijdt met het voertuig en omklapt aan de rand (Floating UI); zonder anker op de plek van de muis
let tipId = null, tipStop = null;
export function renderTip(ctx, hoverId, hoverPt) {
  const tip = ctx.$('tip'); const t = hoverId && ctx.fleet.byId.get(hoverId); const s = t && ctx.S.get(t.id);
  if (!t || !s || !hoverPt || ctx.view() !== 'kaart' || ctx.narrow()) { tip.style.display = 'none'; if (tipStop) { tipStop(); tipStop = null; } tipId = null; return; }
  tip.style.display = 'block';
  if (tipId !== t.id) {
    if (tipStop) { tipStop(); tipStop = null; } tipId = t.id;
    const api = ctx.mapApi(); const a = api && api.anchor ? api.anchor(t.id) : null; if (a) tipStop = ctx.L.pinTo(tip, a);
  }
  if (!tipStop) { const W = ctx.$('map').clientWidth; tip.style.left = Math.min(hoverPt.x + 16, W - 312) + 'px'; tip.style.top = Math.max(60, hoverPt.y - 12) + 'px'; }
  const r = ctx.R.ritOf(t, ctx.state.simTime); const rs = r ? ctx.R.stateOf(r, ctx.state.simTime, ctx.S) : null;
  // rustig: wie, wat en waarheen; de rest staat in het paneel na een klik
  const h = `${portretHtml('voertuig', t, 'tip-foto', s.tr || null)}<h5>${plate(t.id)}${stBadge(s.st, s.st === 'vertraagd' && s.next ? ` +${s.next.delay}` : '', 'sm')}</h5><div class="tip-kt">${kenteken(t.plate, { maat: 'sm' })}<span class="mut">${esc(KIND[t.kind].n)}${rs && rs.st !== 'afgerond' && rs.st !== 'gepland' ? ` · rit ${esc(r.id)}` : ''}</span></div>${kv([
    ['Chauffeur', s.dienst ? `${esc(s.driver)} <small>tot ${hhmm(s.dienst.end)}</small>` : '<span class="mut">geen dienst</span>'],
    t.kind === 'trekker' && ['Oplegger', s.tr ? `${esc(s.tr.id)} · ${esc(TRT[s.tr.type].n.toLowerCase())}` : 'geen (solo)'],
    s.next && ['Volgende', `${esc(s.next.name)} · ${hhmm(s.next.eta)}${s.next.delay ? ` <b class="tbad">+${s.next.delay}</b>` : ''}`],
  ])}<small>Klik voor rit, chauffeur en berichten</small>`;
  if (tip.dataset.h !== h) {
    // een geladen portret blijft hetzelfde element (geen knipperen als de tekst verandert)
    const keep = tip.querySelector('figure[data-portret][data-gevuld]'); tip.innerHTML = h; tip.dataset.h = h;
    const f = tip.querySelector('figure[data-portret]'); if (keep && f && f.dataset.portret === keep.dataset.portret) f.replaceWith(keep);
    vulPortretten(tip, ctx);
  }
}

// ---------- panelen ----------
const head = (title, sub, actions = '') => `<div class="pnl-h"><button class="pnl-grab" type="button" data-grab="1" aria-label="Paneel groter of kleiner"></button><div class="pnl-t"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="pnl-a">${actions}<button class="ib" type="button" id="closePanel" aria-label="Sluiten" title="Sluiten (Esc)">${ic('x', 18)}</button></div></div>`;
export function objCard(ctx, kind, o) {
  if (!o) return '';
  const T = ctx.state.simTime;
  if (kind === 'truck') { const s = ctx.S.get(o.id); return `<button class="obj" type="button" data-open="voertuig/${esc(o.id)}/vandaag"><span class="av" style="border-radius:8px">${ic(o.kind === 'bus' ? 'bus' : 'truck', 16)}</span><span class="obj-t"><b>${esc(o.id)} · ${esc(o.model.replace('Mercedes-Benz ', 'MB '))}</b><span>${s ? VST[s.st].n : ''} · ${esc(o.plate)} · ${esc(o.base.n)}</span></span>${ic('chev', 16)}</button>`; }
  if (kind === 'trailer') { const s = ctx.trailerState(o); const temp = ctx.fleet.trailerTemp(o, T); return `<button class="obj" type="button" data-open="oplegger/${esc(o.id)}/vandaag"><span class="av tr">${ic('trailer', 16)}</span><span class="obj-t"><b>${esc(o.id)} · ${esc(TRT[o.type].n)}</b><span>${esc(TST[s.st].n)}${temp !== null ? ` · <span class="${o.storing ? 'tbad' : ''}">${nl1(temp)} °C</span>` : ''}${s.lading ? ` · ${esc(s.lading.split(',')[0])}` : ''}</span></span>${ic('chev', 16)}</button>`; }
  if (kind === 'person') { const d = o.dienst; return `<button class="obj" type="button" data-open="persoon/${esc(o.id)}"><span class="av">${esc(o.initials)}</span><span class="obj-t"><b>${esc(o.name)}</b><span>${d ? `dienst ${hhmm(d.d.start)}–${hhmm(d.d.end)} op ${esc(d.t.id)}` : 'vandaag vrij'} · ${esc(o.base.n)}</span></span>${ic('chev', 16)}</button>`; }
  if (kind === 'rit') { const rs = ctx.R.stateOf(o, T, ctx.S); return `<button class="obj" type="button" data-open="rit/${esc(o.id)}"><span class="av" style="border-radius:8px">${ic('route', 16)}</span><span class="obj-t"><b>Rit ${esc(o.id)} · ${esc(o.klant)}</b><span>${RLABEL(rs)} · ${rs.done} van ${rs.n} ${rs.n === 1 ? 'stop' : 'stops'} · ${rs.st === 'gepland' ? 'vertrek' : rs.st === 'afgerond' ? 'terug' : 'ETA'} ${hhmm(rs.eta)}</span></span>${ic('chev', 16)}</button>`; }
  return '';
}
const RLABEL = rs => ({ gepland: 'Gepland', onderweg: 'Onderweg', klant: 'Bij klant', pauze: 'Pauze', vertraagd: 'Vertraagd', afgerond: 'Afgerond' }[rs.st]);

export function truckPanel(ctx, t) {
  const T = ctx.state.simTime; const s = ctx.S.get(t.id) || ctx.stAt(t, T); const nx = s.next; const d = s.dienst; const can = ctx.can('act');
  const r = ctx.R.ritOf(t, T); const rs = r ? ctx.R.stateOf(r, T, ctx.S) : null; const zs = ctx.Z.scoped().filter(z => (z.t === t || (z.data && z.data.vehicle === t)) && (z.open || z.status === 'wacht'));
  const drivePct = Math.min(1, s.drive / 270);
  const nextTile = nx ? `<div><small>${nx.home ? 'Terug' : 'Volgende stop'}</small><b>${hhmm(nx.eta)}</b><span>${esc(nx.home ? t.base.n : nx.name)}${nx.win ? `<br>venster ${hhmm(nx.win[0])}–${hhmm(nx.win[1])}${lateBy(nx.eta, nx.win) > 0 ? ' <b class="tbad">te laat</b>' : ''}` : ''}</span></div>` : `<div><small>Volgende stop</small><b>–</b><span>${d ? 'dienst afgerond' : 'geen rit'}</span></div>`;
  const kp = `<div class="kpis3">${nextTile}${t.kind === 'bus' ? `<div><small>Rijtijd vandaag</small><b>${fmtDrive(s.rijDag || 0)}</b>${meter(0, 'mut')}<span>bestelbus: geen rijtijdregels</span></div>` : `<div><small>Rijtijd</small><b>${fmtDrive(s.drive)} <em>/ 4:30</em></b>${meter(drivePct, drivePct > 0.88 ? 'bad' : drivePct > 0.7 ? 'warn' : '')}<span>${s.pauzeOm && s.pauzeOm > T ? `pauze gepland ${hhmm(s.pauzeOm)}` : `pauze uiterlijk ${hhmm(T + Math.max(0, 270 - s.drive))}`} · vandaag ${fmtDrive(s.rijDag || 0)}</span></div>`}<div><small>${t.ev ? 'Accu' : 'Brandstof'}</small><b>${Math.round(s.soc)} <em>%</em></b>${meter(s.soc / 100, s.soc < 20 ? 'bad' : s.soc < 35 ? 'warn' : '')}<span>${fmt(t.range * s.soc / 100)} km bereik</span></div></div>`;
  const zaakNote = zs.map(z => { const p = ctx.voorstelVoor(z.key); return `<div class="note ${z.sev === 'bad' ? 'bad' : 'warn'}">${ic(SOORT[z.kind].icon, 16)}<div style="flex:1;min-width:0"><b>${esc(z.kind)}</b> ${zBadge(z.status, z)}<div>${esc(z.text)}</div><div class="chips" style="margin-top:8px">${p && can ? `<button class="btn sm" type="button" data-pastoe="${esc(p.id)}" title="${esc(p.action)}">${esc(p.kort)}</button>` : ''}<button class="btn ghost sm" type="button" data-open="melding/${esc(z.id)}">Open zaak</button></div></div></div>`; }).join('');
  let ritSec = '';
  if (r && rs) {
    const stops = r.stops.slice(0, 6);
    ritSec = `<section><div class="sec-t">Rit${rs.st === 'gepland' ? ' (volgende)' : rs.st === 'afgerond' ? ' (laatste)' : ''}</div>${objCard(ctx, 'rit', r)}<ol class="tline" style="margin-top:12px">${stops.map(x => { const done = rs.at >= x.dep, now2 = rs.at >= x.arr && !done; const late = lateBy(x.arr, x.win) > 0; return `<li class="tli ${done ? 'done' : now2 ? 'now' : ''} ${late && !done ? 'late' : ''}"><time>${hhmm(x.arr)}</time><div class="tl-c"><b>${esc(x.name)}</b><span>${x.win ? `venster ${hhmm(x.win[0])}–${hhmm(x.win[1])}` : 'geen venster'}${late ? ` · <em class="late">+${Math.round(x.arr - x.win[1])} min</em>` : ''}${now2 ? ' · nu bij de klant' : ''}</span></div></li>`; }).join('')}${r.stops.length > 6 ? `<li class="tli"><time></time><div class="tl-c"><span>en nog ${r.stops.length - 6} stops</span></div></li>` : ''}<li class="tli ${rs.at >= r.end ? 'done' : ''}"><time>${hhmm(r.end)}</time><div class="tl-c"><b>Terug ${esc(t.base.n)}</b></div></li></ol></section>`;
  } else ritSec = `<section><div class="sec-t">Rit</div><p class="hint">${t.vandaag === 'onderhoud' ? 'Vandaag in de werkplaats, niet ingepland.' : t.vandaag === 'reserve' ? 'Reservevoertuig, vandaag niet ingepland.' : 'Geen ritten vandaag.'}</p></section>`;
  const drv = d ? objCard(ctx, 'person', d.person) : s.upcoming ? `<p class="hint">Volgende dienst ${hhmm(s.upcoming.start)}: ${esc(s.upcoming.driver)}.</p>` : '<p class="hint">Geen chauffeur op dit moment.</p>';
  const trl = t.kind === 'trekker' ? (s.tr ? objCard(ctx, 'trailer', s.tr) : `<p class="hint">${s.st === 'terrein' ? 'Op het terrein; de oplegger wordt bij vertrek gekoppeld.' : nx && nx.pickup ? `Rijdt solo naar ${esc(nx.pickup.id)} om die op te halen.` : 'Rijdt solo terug naar de standplaats.'}</p>`) : '';
  const msgs = (t.msgs || []).slice(-4);
  const msgSec = `<section><div class="sec-t">Berichten <span class="mut" style="font-weight:400">voorgelezen in de cabine</span></div>${msgs.length ? `<div class="msgs">${msgs.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)} · ${m.me ? 'planning' : esc((ctx.driverName(t) || 'chauffeur').split(' ')[0])}</time></div>`).join('')}</div>` : '<p class="hint">Nog geen berichten vandaag.</p>'}${d && can ? `<div class="chips" style="margin:10px 0 8px">${QUICK.map(x => `<button class="chip" type="button" data-quick="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="ask"><label class="sr" for="msgIn">Bericht aan ${esc(d.driver)}</label><input class="fld" id="msgIn" placeholder="Bericht aan ${esc(d.driver.split(' ')[0])}" autocomplete="off"><button class="btn" type="button" id="msgSend">${ic('send', 15)}Stuur</button></div>` : ''}</section>`;
  const follow = ctx.follow();
  return head(`${plate(t.id)} ${stBadge(s.st, s.st === 'vertraagd' && nx ? ` +${nx.delay}` : '')}`, `${kenteken(t.plate, { maat: 'sm' })} ${esc(KIND[t.kind].n)} · ${esc(t.model)} · ${esc(t.base.n)}${t.lzv ? ' · LZV' : ''}`, `<button class="ib ${follow ? 'on' : ''}" type="button" id="followBtn" aria-pressed="${follow}" title="${follow ? 'Volgen staat aan' : 'Volg dit voertuig'} (f)" aria-label="Volg dit voertuig">${ic('nav', 17)}</button>`)
    + `<div class="pnl-b">${kp}${zaakNote}${ritSec}<section><div class="sec-t">Chauffeur</div>${drv}</section>${t.kind === 'trekker' ? `<section><div class="sec-t">Oplegger</div>${trl}</section>` : ''}${t.storing ? `<div class="note ${t.workorder ? 'info' : 'bad'}">${ic('wrench', 16)}<div><b>Techniek</b><div>${esc(t.storing)}${t.workorder ? ' · werkorder aangemaakt' : ''}</div></div></div>` : ''}${msgSec}</div>`
    + `<div class="pnl-f"><button class="btn" type="button" id="openSheet">${ic('truck', 15)}Open voertuig</button>${r ? `<button class="btn pri" type="button" data-open="rit/${esc(r.id)}">${ic('route', 15)}Open rit</button>` : ''}<button class="btn" type="button" id="shareBtn" title="Deel een volg-link met de klant">${ic('link', 15)}Klant-link</button></div>`;
}
export function bindTruckPanel(ctx, p, t) {
  const fb = p.querySelector('#followBtn'); if (fb) fb.addEventListener('click', () => ctx.toggleFollow());
  const os = p.querySelector('#openSheet'); if (os) os.addEventListener('click', () => ctx.go(`voertuig/${t.id}/vandaag`));
  const sb = p.querySelector('#shareBtn'); if (sb) sb.addEventListener('click', () => ctx.shareLink(t));
  on(p, 'click', '[data-quick]', (e, b) => { ctx.sendMsg(t, b.dataset.quick); ctx.L.toast(`Bericht verstuurd naar ${ctx.driverName(t)}.`, { icon: 'send' }); });
  on(p, 'click', '[data-pastoe]', (e, b) => { const pp = ctx.voorstelById(b.dataset.pastoe); if (pp) ctx.applyProposal(pp); });
  const ms = p.querySelector('#msgSend'); if (ms) { const i = p.querySelector('#msgIn'); const send = () => { const v = i.value.trim(); if (v) { ctx.sendMsg(t, v); ctx.L.toast(`Bericht verstuurd naar ${ctx.driverName(t)}.`, { icon: 'send' }); } }; ms.addEventListener('click', send); i.addEventListener('keydown', e => { if (e.key === 'Enter') send(); }); }
}

export function trailerPanel(ctx, tr) {
  const T = ctx.state.simTime; const s = ctx.trailerState(tr); const info = ctx.people.forTrailer.get(tr.id); const tt = TRT[tr.type]; const temp = ctx.fleet.trailerTemp(tr, T);
  const where = s.st === 'gekoppeld' ? `achter ${esc(s.vehicle.id)}` : s.st === 'ophalen' ? `${esc(s.place)}` : esc(s.place || `terrein ${tr.base.n}`);
  const kp = `<div class="kpis3"><div><small>Waar</small><b style="white-space:normal;font-size:15px;line-height:1.35">${where}</b><span>${s.since ? `sinds ${clockAt(s.since, ctx.state.simTime)}` : 'vandaag niet verplaatst'}</span></div>${tt.temp ? `<div><small>Temperatuur</small><b class="${tr.storing ? 'tbad' : ''}">${nl1(temp)} <em>°C</em></b><span>doel ${tt.temp[0]} tot ${tt.temp[1]} °C</span></div>` : `<div><small>Lading</small><b>${s.loaded ? 'geladen' : 'leeg'}</b><span>${esc(s.lading ? s.lading.split(',')[0] : s.st === 'onderhoud' ? 'in de werkplaats' : 'klaar voor de volgende rit')}</span></div>`}<div><small>Standplaats</small><b style="font-size:15px">${esc(tr.base.n)}</b><span>${esc(DIV[tr.div].n)}</span></div></div>`;
  const z = ctx.Z.scoped().find(x => x.tr === tr && (x.open || x.status === 'wacht'));
  const note = s.st === 'wacht' ? `<div class="note ${s.late ? 'warn' : 'info'}">${ic('clock', 16)}<div><b>Wacht op ophalen</b><div>Leeg bij ${esc(s.place)} sinds ${clockAt(s.unloadAt, ctx.state.simTime)}; ophalen gepland ${s.pickup >= 1440 ? 'morgen ' : ''}${hhmm(s.pickup)}${s.late ? ', te laat' : ''}.</div>${z ? `<div class="chips" style="margin-top:8px">${ctx.voorstelVoor(z.key) && ctx.can('act') ? `<button class="btn sm" type="button" data-pastoe="${esc(ctx.voorstelVoor(z.key).id)}">${esc(ctx.voorstelVoor(z.key).kort)}</button>` : ''}<button class="btn ghost sm" type="button" data-open="melding/${esc(z.id)}">Open zaak</button></div>` : ''}</div></div>`
    : s.st === 'ophalen' ? `<div class="note ok">${ic('route', 16)}<div><b>Wordt opgehaald</b><div>${esc(s.pickupBy.t.id)} (${esc(ctx.driverName(s.pickupBy.t) || 'reservechauffeur')}) is onderweg; aankomst bij ${esc(s.place)} om ${hhmm(s.pickupBy.eta)}, daarna naar ${esc(tr.base.n)}.</div></div></div>` : '';
  const koel = tr.storing ? `<div class="note ${tr.workorder ? 'info' : 'bad'}">${ic('thermo', 16)}<div><b>Koeling</b><div>${esc(tr.storing)}${tr.workorder ? ' · werkorder aangemaakt' : ''}</div>${z && z.kind === 'Koeling' ? `<div class="chips" style="margin-top:8px"><button class="btn ghost sm" type="button" data-open="melding/${esc(z.id)}">Open zaak</button></div>` : ''}</div></div>` : '';
  const evs = tr.events.filter(e => e.k === 'coupled' || e.k === 'site').sort((a, b) => a.a - b.a).map(e => {
    const yest = e.a > T && e.b > T + 1440; const Tc = yest ? T + 1440 : e.a > 1440 && T < e.a - 1440 ? T + 1440 : T; const cls = e.b <= Tc ? 'done' : e.a <= Tc ? 'now' : '';
    const tm = yest ? `<time>${hhmm(e.a)}<small>gisteren</small></time>` : `<time>${hhmm(e.a)}</time>`;
    if (e.k === 'coupled') return `<li class="tli ${cls}">${tm}<div class="tl-c"><b>${e.planned ? 'Opgehaald door' : 'Achter'} ${esc(e.vehicle.id)}</b><span>${esc(e.lading || 'leeg')}${e.planned ? ' · ingepland door de planner' : ''} · tot ${hhmm(e.b)}</span></div></li>`;
    return `<li class="tli ${cls}">${tm}<div class="tl-c"><b>Achtergelaten bij ${esc(e.place.name)}</b><span>${e.loaded ? `geladen, lossen tot ${hhmm(e.unloadAt)}` : 'leeg'} · ophalen ${e.pickup >= 1440 ? 'morgen ' : ''}${hhmm(e.pickup)}</span></div></li>`;
  });
  return head(`${plate(tr.id)} ${trBadge(s.st, s.late)}`, `${kenteken(tr.plate, { opl: true, maat: 'sm' })} ${esc(tt.n)} · bouwjaar ${tr.bouwjaar}`)
    + `<div class="pnl-b">${kp}${note}${koel}${s.vehicle ? `<section><div class="sec-t">Trekker</div>${objCard(ctx, 'truck', s.vehicle)}</section>` : ''}<section><div class="sec-t">Tijdlijn</div>${evs.length ? `<ol class="tline">${evs.join('')}</ol>` : '<p class="hint">Vandaag niet gebruikt: staat op het terrein.</p>'}</section><section><div class="sec-t">Keuring en onderhoud</div>${kv([['APK', `geldig tot ${esc(info.apk)}`], info.atp && ['ATP', `geldig tot ${esc(info.atp)}`], ['Onderhoud', `${esc(info.onderhoud.date)} · ${esc(info.onderhoud.what)}`], ['Werkorder', info.werkorder ? `${esc(info.werkorder.what)} (${esc(info.werkorder.since)})` : 'geen']])}</section></div>`
    + `<div class="pnl-f">${tr.storing && !tr.workorder && ctx.can('act') ? `<button class="btn" type="button" data-trworkorder="${esc(tr.id)}">${ic('wrench', 15)}Werkorder</button>` : ''}<button class="btn" type="button" id="trlMap">${ic('map', 15)}Toon op kaart</button><button class="btn pri" type="button" data-open="oplegger/${esc(tr.id)}/vandaag">${ic('trailer', 15)}Open oplegger</button></div>`;
}
export function bindTrailerPanel(ctx, p, tr) {
  const tm = p.querySelector('#trlMap'); if (tm) tm.addEventListener('click', () => { ctx.setTrailersOnMap(true); ctx.go(`kaart:trailer:${tr.id}`); });
  on(p, 'click', '[data-trworkorder]', () => { ctx.runAction({ k: 'trworkorder', tr: tr.id, T: ctx.state.simTime }, true); ctx.A.log(`maakte een werkorder voor ${tr.id}`, { tr: tr.id }); ctx.L.toast(`Werkorder aangemaakt voor ${tr.id}.`, { icon: 'wrench' }); ctx.frame(true); });
  on(p, 'click', '[data-pastoe]', (e, b) => { const pp = ctx.voorstelById(b.dataset.pastoe); if (pp) ctx.applyProposal(pp); });
}

export function spPanel(ctx, sp) {
  const T = ctx.state.simTime; const mine = ctx.fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let inzet = 0;
  for (const t of mine) { const s = ctx.S.get(t.id); if (s) c[s.st]++; if (t.vandaag === 'inzet') inzet++; }
  const trs = ctx.fleet.trailersOf(sp); const tc = { gekoppeld: 0, geladen: 0, wacht: 0, ophalen: 0, leeg: 0, klaar: 0, onderhoud: 0 }; for (const tr of trs) { const s = ctx.TRS.get(tr.id); if (s) tc[s.st]++; }
  const deps = ctx.fleet.departures(sp, T - 2, 120).slice(0, 6); const st = ctx.people.spStats.get(sp.n);
  const yardV = mine.filter(t => (ctx.S.get(t.id) || {}).st === 'terrein').sort((a, b) => (a.vandaag === 'inzet' ? 0 : 1) - (b.vandaag === 'inzet' ? 0 : 1) || a.id.localeCompare(b.id));
  const yardT = trs.filter(tr => { const s = ctx.TRS.get(tr.id); return s && (s.st === 'klaar' || s.st === 'leeg'); });
  const onDuty = ctx.people.persons.filter(p => p.base === sp && p.dienst && p.dienst.d.start <= T && T < p.dienst.d.end);
  const chipList = (L, f, n) => `<div class="yard chips">${L.slice(0, n).map(f).join('')}${L.length > n ? `<span class="chip" style="pointer-events:none">+${L.length - n}</span>` : ''}${L.length ? '' : '<span class="hint">geen</span>'}</div>`;
  const zs = ctx.Z.scoped().filter(z => z.base === sp && z.open).length;
  return head(`${ic('depot', 18)}${esc(sp.n)}`, esc([sp.hub ? 'hoofdkantoor' : null, sp.wh ? 'warehouse' : null, sp.klant, sp.regio].filter(Boolean).join(' · ')) + (sp.adres ? `<br>${esc(adresTxt(sp.adres))}` : ''))
    + `<div class="pnl-b"><div class="kpis3"><div><small>Ingezet</small><b>${inzet} <em>van ${mine.length}</em></b><span>${c.onderweg + c.vertraagd + c.klant + c.pauze} onderweg nu</span></div><div><small>Opleggers los</small><b>${tc.klaar + tc.leeg + tc.geladen + tc.wacht}</b><span>${tc.klaar} klaar voor vertrek</span></div><div><small>Open meldingen</small><b class="${zs ? 'tbad' : ''}">${zs}</b><span>${st.opDienst} chauffeurs vandaag</span></div></div>
      <section><div class="sec-t">Volgende vertrekken <span class="mut" style="font-weight:400">komende 2 uur</span></div><div class="deps rows">${deps.map(d => { const cd = depStatus(d, T, ctx.S); return `<button class="obj" type="button" data-open="kaart:truck:${esc(d.t.id)}" style="border:0;border-radius:0;padding:8px 0"><b class="num" style="width:44px">${hhmm(d.at)}</b><span class="obj-t"><b>${esc(d.t.id)}${d.tr ? ` + ${esc(d.tr.id)}` : ''} · ${esc(d.driver || 'geen chauffeur')}</b><span>${esc(d.dest)} · dock ${d.dock}</span></span>${depBadge(cd)}</button>`; }).join('') || '<p class="hint">Geen vertrekken in de komende twee uur.</p>'}</div></section>
      <section><div class="sec-t">Op het terrein <span class="mut" style="font-weight:400">${yardV.length} voertuigen · ${yardT.length} opleggers</span></div>${chipList(yardV, t => { const s = ctx.S.get(t.id); return `<button class="chip" type="button" data-open="kaart:truck:${esc(t.id)}" title="${t.vandaag === 'inzet' ? (s && s.upcoming ? `volgende dienst ${hhmm(s.upcoming.start)}` : 'dienst afgerond') : t.vandaag}">${esc(t.id)}${t.vandaag === 'reserve' ? ' <span class="n">reserve</span>' : t.vandaag === 'onderhoud' ? ' <span class="n">werkplaats</span>' : ''}</button>`; }, 12)}${chipList(yardT, tr => `<button class="chip" type="button" data-open="kaart:trailer:${esc(tr.id)}" title="${esc(TST[ctx.TRS.get(tr.id).st].n)}">${ctx.TRS.get(tr.id).st === 'klaar' ? '<i class="dot st-onderweg"></i>' : ''}${esc(tr.id)}</button>`, 12)}</section>
      <section><div class="sec-t">Chauffeurs op dienst <span class="mut" style="font-weight:400">${onDuty.length} nu</span></div>${chipList(onDuty, pp => `<button class="chip" type="button" data-open="persoon/${esc(pp.id)}">${esc(pp.short)} <span class="n">${esc(pp.dienst.t.id)}</span></button>`, 10)}</section></div>`
    + `<div class="pnl-f"><button class="btn" type="button" id="toHal">${ic('tv', 15)}Hal-scherm</button><button class="btn" type="button" id="toPb">${ic('gantt', 15)}Planbord</button><button class="btn pri" type="button" data-open="standplaatsen/${esc(sp.n)}">${ic('depot', 15)}Open standplaats</button></div>`;
}
export function bindSpPanel(ctx, p, sp) {
  const h = p.querySelector('#toHal'); if (h) h.addEventListener('click', () => { ctx.go(`hal/${sp.n}`); ctx.fullscreen(); });
  const pb = p.querySelector('#toPb'); if (pb) pb.addEventListener('click', () => { ctx.setPbSp(sp); ctx.navTo('planbord'); });
}

export function restPanel(ctx, pl) {
  const my = ctx.rest.myRating(pl.id); const sel = ctx.selTruck(); const s = sel && ctx.S.get(sel.id); const km = s ? Math.round(Math.hypot((pl.lon - s.pos.lon) * 68, (pl.lat - s.pos.lat) * 111)) : null;
  return head(`${ic('coffee', 18)}${esc(pl.n)}`, esc(pl.sub))
    + `<div class="pnl-b"><div class="kpis3"><div><small>Beoordeling</small><b>${nl1(ctx.rest.score(pl))}</b><span>${stars(ctx.rest.score(pl))}</span></div><div><small>Plekken</small><b>${pl.plekken}</b><span>${pl.lzv ? 'LZV toegestaan' : 'geen LZV'}</span></div><div><small>${km !== null ? 'Afstand' : 'Laadpunten'}</small><b>${km !== null ? `${km} <em>km</em>` : pl.laders || 0}</b><span>${km !== null ? `van ${esc(sel.id)}` : 'snelladers'}</span></div></div>
      ${kv([['Veiligheid', pl.beveiligd ? 'beveiligd terrein, camera\'s' : 'niet beveiligd'], ['Voorzieningen', [pl.douche ? 'douche' : null, pl.eten !== 'geen' ? pl.eten : null, pl.laders ? `${pl.laders} laadpunten` : null, 'toilet'].filter(Boolean).join(', ')], ['Beoordelingen', `${pl.count + (my ? 1 : 0)} van chauffeurs`]])}
      <section><div class="sec-t">Wat chauffeurs zeggen</div>${pl.reviews.map(r => `<div class="rev"><span class="av sm">${esc(r.who)}</span><div>${stars(r.stars)}<p>${esc(r.text)}</p></div></div>`).join('')}</section>
      <section><div class="sec-t">Jouw beoordeling</div><div class="starbtns" role="radiogroup" aria-label="Jouw beoordeling">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${my === n}" aria-label="${n} ${n === 1 ? 'ster' : 'sterren'}" data-star="${n}" class="${my >= n ? 'on' : ''}">★</button>`).join('')}<span class="hint" style="margin-left:6px">${my ? `${my} van 5 gegeven` : 'kies een aantal sterren'}</span></div></section></div>`
    + `<div class="pnl-f">${sel && ctx.driverName(sel) && ctx.can('act') ? `<button class="btn pri" type="button" id="proposeRest">${ic('send', 15)}Stel voor aan ${esc(ctx.driverName(sel).split(' ')[0])}</button>` : '<span class="hint">Selecteer een voertuig met chauffeur om deze plek als pauze voor te stellen.</span>'}</div>`;
}
export function bindRestPanel(ctx, p, pl) {
  on(p, 'click', '[data-star]', (e, b) => { ctx.rest.rate(pl.id, +b.dataset.star); ctx.L.toast(`Je gaf ${pl.n} ${b.dataset.star} ${+b.dataset.star === 1 ? 'ster' : 'sterren'}.`, { icon: 'star' }); ctx.renderPanel(true); });
  const pr = p.querySelector('#proposeRest'); if (pr) pr.addEventListener('click', () => { const t = ctx.selTruck(); const s = ctx.S.get(t.id); const km = Math.round(Math.hypot((pl.lon - s.pos.lon) * 68, (pl.lat - s.pos.lat) * 111)); t.breakPlanned = true; ctx.sendMsg(t, `Planning: neem je pauze bij ${pl.n} (${km} km verderop, ${[pl.douche ? 'douche' : null, pl.eten !== 'geen' ? pl.eten : null].filter(Boolean).join(', ') || 'parkeren'}).`); ctx.A.log(`stelde ${pl.n} voor als pauze aan ${ctx.driverName(t)} (${t.id})`, { t: t.id }); ctx.L.toast(`Pauze bij ${pl.n} voorgesteld aan ${ctx.driverName(t)}.`, { icon: 'send' }); ctx.go(`kaart:truck:${t.id}`); });
}

// winkel of DC: wie levert er vandaag, wanneer, en hoe lang lossen duurt
const SOORTNAAM = { dc: 'Distributiecentrum', fabriek: 'Fabriek', groothandel: 'Groothandel' };
export function winkelPanel(ctx, name, place) {
  const T = ctx.state.simTime; const L = [];
  for (const r of ctx.R.all()) for (const x of r.stops) if ((place && x.place === place) || x.name === name) L.push({ r, x });
  L.sort((a, b) => a.x.arr - b.x.arr);
  const lt = ctx.lostijden.stops.find(e => e.name === name);
  const p = place || (L[0] && L[0].x.place) || null;
  const soort = p && p.soort ? SOORTNAAM[p.soort] || 'Locatie' : p && p.fleet !== undefined ? 'Eigen vestiging' : p && p.formule ? 'Winkel' : 'Losadres';
  const sub = [p && p.formule ? `${soort} ${p.formule}` : soort, p && p.plaats ? p.plaats : '', `${L.length} ${L.length === 1 ? 'levering' : 'leveringen'} vandaag`].filter(Boolean).join(' · ');
  const adres = p && p.adres ? (typeof p.adres === 'string' ? `${p.adres}${p.plaats ? ` ${p.plaats}` : ''}` : `${p.adres.straat} ${p.adres.nr}, ${p.adres.postcode} ${p.adres.plaats}`) : '';
  return head(`${ic(p && p.soort ? 'depot' : 'store', 18)}${esc(name)}`, esc(sub))
    + `<div class="pnl-b">${adres || (p && p.eiland) ? kv([adres && ['Adres', esc(adres)], p && p.eiland && ['Bereikbaarheid', 'Waddeneiland: geen ritten over de weg']]) : ''}${lt ? `<div class="kpis3"><div><small>Lostijd gepland</small><b>${Math.round(lt.planned)} <em>min</em></b><span>per stop</span></div><div><small>Gemeten</small><b class="${lt.diff > 3 ? 'twarn' : ''}">${Math.round(lt.avg)} <em>min</em></b><span>laatste 60 dagen</span></div><div><small>Overgenomen</small><b>${ctx.lostijden.isApplied(lt.name) ? 'ja' : 'nee'}</b><span>voor de planning van morgen</span></div></div>` : ''}
      <section><div class="sec-t">Leveringen vandaag</div>${L.length ? `<div class="rows">${L.map(({ r, x }) => { const rs = ctx.R.stateOf(r, T, ctx.S); const done = rs.at >= x.dep, here = rs.at >= x.arr && !done; const late = lateBy(x.arr, x.win) > 0; return `<button class="obj" type="button" data-open="rit/${esc(r.id)}" style="border:0;border-radius:0;padding:8px 0"><b class="num" style="width:44px">${hhmm(x.arr)}</b><span class="obj-t"><b>${esc(r.t.id)} · ${esc(r.driver || 'geen chauffeur')}</b><span>rit ${esc(r.id)}${x.win ? ` · venster ${hhmm(x.win[0])}–${hhmm(x.win[1])}` : ''}</span></span>${here ? stBadge('klant') : done ? `<span class="badge ${late ? 'b-bad' : 'st-afgerond'}">${late ? 'te laat' : 'geleverd'}</span>` : late ? '<span class="badge b-bad">verwacht te laat</span>' : '<span class="badge outline">gepland</span>'}</button>`; }).join('')}</div>` : '<p class="hint">Vandaag geen leveringen op dit adres.</p>'}</section></div>`;
}
