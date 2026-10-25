// Interface 4.0: linkerbalk, topbalk met zoeken en meldingen, overzicht, kaart, ritten, meldingen als zaken, planbord,
// tabellen, detailpagina's, rapporten en instellingen. Dit bestand houdt de toestand bij (werkgebied, rol, selectie,
// acties van vandaag), draait de beurt van de simulatie (main.js roept frame() elke 0,12 s aan), signaleert de
// uitzonderingen, en regelt de routes (#ritten, #rit/R-10213, #melding/V-T-1112, ...) met een werkende terugknop.
// De weergaven zelf staan in src/ui/*.js, views.js, tables.js en sheets.js.
import './ui/taal.js';
import { SP, REGIOS, DIV, ROLES, CAN, laadpunten, winkelById, dcById, plekNaam } from './places.js';
import { KIND, TRT } from './fleet.js';
import { esc, ic, fmt, hhmm, day, durTxt, fmtDrive, VST, TST, WACHT, initials, on, plate, kenteken, empty, effWin, sectieIconen } from './ui/base.js';
import { portretHtml, vulPortretten } from './ui/portret.js';
import { createLayers } from './ui/layers.js';
import { createActs } from './ui/acts.js';
import { createZaken, renderMeldingen, zaakPage } from './ui/zaken.js';
import { createRitten, renderRitten, ritPage } from './ui/ritten.js';
import { createMetrics } from './ui/metrics.js';
import { renderOverzicht } from './ui/overzicht.js';
import { createNav, VIEWS, VIEW_NAME, KEYS } from './ui/nav.js';
import { createSearch } from './ui/zoek.js';
import * as K from './ui/kaart.js';
import { proposals, assistPanel, bindAssist } from './ui/assistent.js';
import { renderRapporten } from './ui/rapporten.js';
import { renderInstellingen } from './ui/instellingen.js';
import { renderStandplaatsen, renderHal, renderKlant } from './views.js';
import { renderPlanbord, updateNowline } from './ui/planbord.js';
import { verplaatsRit, planPoolRit, pool } from './ui/planwijzig.js';
import { naInplannen, voerActieUit } from './ui/invulling.js';
import { renderOpenRitten, openIn } from './ui/openritten.js';
import { renderPoule, charterPage, oproepPage } from './ui/poule.js';
import { renderVoertuigen, renderOpleggers, renderChauffeurs, renderLostijden, renderLaden, renderPauze } from './tables.js';
import { truckPage, trailerPage, personPage, TRUCK_TABS, TRAILER_TABS, PERSON_TABS } from './sheets.js';
import logo from './assets/logo.png';

export { fmtDrive };

const REPLIES = ['Ontvangen.', 'Oké, doe ik.', 'Begrepen, ik rij door naar de volgende stop.', 'Top, bedankt.'];
const DIVDESC = { winkel: 'Albert Heijn, Jumbo, Plus, Lidl, SPAR, Vomar', netwerk: 'DC naar DC, crossdock Tiel en Geldermalsen, LZV', bulk: 'Poeders, granulaat, suiker', dranken: 'Heineken, Bavaria, Vrumona', bezorg: 'AH Home Service, bestelbussen' };
const STKEYS = ['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein'];
const VIEW_HASH = { overzicht: 'overzicht', kaart: 'kaart', ritten: 'ritten', meldingen: 'meldingen', openritten: 'openritten', planbord: 'planbord', voertuigen: 'voertuigen', opleggers: 'opleggers', chauffeurs: 'chauffeurs', charters: 'charters', standplaatsen: 'standplaatsen', laden: 'laden', lostijden: 'lostijden', pauze: 'pauzeplekken', rapporten: 'rapporten', instellingen: 'instellingen' };
const HASH_VIEW = { ...Object.fromEntries(Object.entries(VIEW_HASH).map(([k, v]) => [v, k])), pauze: 'pauze', trucks: 'voertuigen', mensen: 'chauffeurs', dashboard: 'overzicht' };
const ALIAS = { trucks: 'voertuigen', mensen: 'chauffeurs', pauzeplekken: 'pauze' };

// root: de app-root (#app.slct) die thema en kiosk-klasse draagt; embedded: ingebed in een andere pagina (SafeTail):
// sneltoetsen gelden dan alleen binnen de app en het hal-scherm vraagt om volledig scherm.
export function createUI(fleet, state, store, { people, rest, lostijden, root = document.getElementById('app'), embedded = false }) {
  const $ = id => document.getElementById(id);
  const L = createLayers(root); const A = createActs(store, state);
  // kaartje bij een voertuig- of opleggernummer: wat het nu doet, in drie regels
  L.setHover(id => {
    const T = state.simTime; const t = fleet.byId.get(id);
    if (t) { const s = S.get(t.id) || stAt(t, T); return `${portretHtml('voertuig', t, 'hc-foto', s.tr || null)}<div class="hc-t"><b>${esc(t.id)} · ${esc(KIND[t.kind].n)}${t.ev ? ' · EV' : ''}</b><span>${kenteken(t.plate, { maat: 'sm' })}</span><span>${esc(VST[s.st].n)}${s.driver ? ` · ${esc(s.driver)}` : ''}${s.tr ? ` · ${esc(s.tr.id)}` : ''}</span>${s.next ? `<span>${s.next.home ? `terug op ${esc(t.base.n)}` : esc(s.next.name)} ${hhmm(s.next.eta)}${s.next.delay ? ` <em class="tbad">+${s.next.delay} min</em>` : ''}</span>` : `<span>${esc(t.base.n)}</span>`}</div>`; }
    const tr = fleet.trailerById.get(id);
    if (tr) { const s = TRS.get(tr.id) || fleet.trailerStateAt(tr, T); return `${portretHtml('oplegger', tr, 'hc-foto')}<div class="hc-t"><b>${esc(tr.id)} · ${esc(TRT[tr.type].n)}</b><span>${kenteken(tr.plate, { opl: true, maat: 'sm' })}</span><span>${esc(TST[s.st].n)}${s.vehicle ? ` achter ${esc(s.vehicle.id)}` : s.place ? `, ${esc(s.place)}` : ''}</span><span>${esc(tr.base.n)}</span></div>`; }
    return null;
  }, card => vulPortretten(card, ctx));
  const F = { regios: new Set(), sps: new Set(), divs: new Set(Object.keys(DIV)), sts: new Set(STKEYS), dim: true, bussen: true, ids: null, trIds: null };
  // de statusfilter van de kaart, het dimmen en de bezorgbussen van vorige keer (sl-kaartfilter, bewaard door de filterbalk)
  try { const kf = JSON.parse(store.get('sl-kaartfilter') || 'null'); if (kf && Array.isArray(kf.sts)) { const L2 = kf.sts.filter(s => STKEYS.includes(s)); if (L2.length) F.sts = new Set(L2); F.dim = kf.dim !== false; F.bussen = kf.bussen !== false; } } catch { /* niets bewaard */ }
  let role = ROLES[store.get('sl-role')] ? store.get('sl-role') : 'planner';
  let profile = null; try { profile = JSON.parse(store.get('sl-werkgebied') || 'null'); } catch { profile = null; }
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; const FLY = RM ? 0 : 800;
  let three = store.get('sl-3d') === 'on', prevCam = null, mapApi = null;
  let view = 'overzicht', page = null, panelMode = null, selTruck = null, selTrailer = null, selSp = null, selRest = null, selWinkel = null;
  let scopeFlown = false, follow = false, lastFollow = 0, hoverId = null, hoverPt = null, tick = 0, trailersOnMap = false, restOnMap = false, halSp = null, klantId = null, pbSp = SP[0], docked = null, dockCam = null, dock3d = false;
  // volgen doet de kaart (mapApi.follow); volgGestart is het voertuig dat deze interface liet volgen
  let volgGestart = null, laatstePlek = { id: null, t: 0 };
  const S = new Map(), TRS = new Map(), prevSt = new Map(); const feed = [], chat = []; let exceptions = [], trailerEx = [], counts = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }, kpi = {}, msgCount = 0;
  const ui = {}; let vcache = null, vtick = -1;
  if (store.get('sl-nav') === 'c') root.classList.add('nav-c');

  // ---------- rechten en werkgebied ----------
  const can = perm => perm === 'act' ? role === 'planner' || role === 'regiomanager' : (CAN[perm] || []).includes(role);
  const inScopeBase = (base, div) => (!F.regios.size || F.regios.has(base.regio)) && F.divs.has(div) && (!F.sps.size || F.sps.has(base.n));
  const inScope = t => !!t && inScopeBase(t.base, t.div);
  const visible = (t, s) => inScope(t) && F.sts.has(s.st) && (!F.ids || F.ids.has(t.id));
  const scopeLabel = () => F.sps.size === 1 ? [...F.sps][0] : F.sps.size > 1 ? `${F.sps.size} standplaatsen` : !F.regios.size || F.regios.size === REGIOS.length ? 'Nederland' : [...F.regios].join(', ');
  const divLabel = () => F.divs.size === Object.keys(DIV).length ? 'alle ritten' : [...F.divs].map(k => DIV[k].n.toLowerCase()).join(', ');
  const scopeKey = () => `${[...F.regios].join(',')}|${[...F.divs].join(',')}|${[...F.sps].join(',')}`;
  const spsInScope = () => SP.filter(sp => (!F.regios.size || F.regios.has(sp.regio)) && (!F.sps.size || F.sps.has(sp.n)) && sp.div.some(d => F.divs.has(d)));
  const narrow = () => root.clientWidth <= 760;
  const driverName = t => { const s = S.get(t.id); return (s && s.driver) || t.driver || ''; };
  const trailerState = tr => { let s = TRS.get(tr.id); if (!s) { s = fleet.trailerStateAt(tr, state.simTime); TRS.set(tr.id, s); } return s; };
  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  // ---------- berichten ----------
  function sendMsg(t, text, me = true, quiet = false) {
    t.msgs = t.msgs || []; t.msgs.push({ me, text, T: state.simTime }); A.acts.msgs[t.id] = t.msgs; A.save();
    if (me) {
      msgCount++; if (!quiet) A.log(`stuurde ${driverName(t) || t.id} (${t.id}) een bericht: "${text.length > 60 ? text.slice(0, 57) + '…' : text}"`, { t: t.id });
      setTimeout(() => { t.msgs.push({ me: false, text: REPLIES[(t.msgs.length + t.idx) % REPLIES.length], T: state.simTime }); A.acts.msgs[t.id] = t.msgs; A.save(); if (panelMode === 'truck' && selTruck === t) renderPanel(true); if (page) renderPage(true); }, 3500 + (t.idx % 5) * 800);
    }
    if (panelMode === 'truck' && selTruck === t) renderPanel(true);
  }
  function bulkMessage(trucks) {
    const L2 = trucks.filter(t => (S.get(t.id) || {}).dienst); const QUICK = ['Bel de planning als je stilstaat', 'Dock gewijzigd, zie app', 'Let op: file op de A1, rij om via de A6', 'Pauze bij de volgende stop'];
    if (!L2.length) { L.toast('Geen van deze voertuigen heeft nu een chauffeur op dienst.', { icon: 'info' }); return; }
    L.openDialog(`<div class="dlg-h"><h2>Bericht aan ${L2.length} ${L2.length === 1 ? 'chauffeur' : 'chauffeurs'}</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div><div class="dlg-b"><p>Het bericht wordt in de cabine voorgelezen. ${trucks.length > L2.length ? `${trucks.length - L2.length} geselecteerde voertuigen hebben nu geen chauffeur en krijgen niets.` : ''}</p><div class="chips">${QUICK.map(q => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div><label class="sr" for="bulkTxt">Bericht</label><textarea class="fld" id="bulkTxt" rows="3" placeholder="Typ een bericht" autofocus></textarea></div><div class="dlg-f"><button class="btn" type="button" data-close>Annuleren</button><button class="btn pri" type="button" id="bulkSend">${ic('send', 15)}Verstuur</button></div>`, {
      label: 'Bericht aan chauffeurs', onBind: d => {
        const ta = d.querySelector('#bulkTxt'); on(d, 'click', '[data-q]', (e, b) => { ta.value = b.dataset.q; ta.focus(); });
        d.querySelector('#bulkSend').addEventListener('click', () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } for (const t of L2) sendMsg(t, v, true, true); A.log(`stuurde ${L2.length} chauffeurs een bericht: "${v.slice(0, 60)}"`); L.closeDialog(); L.toast(`Bericht verstuurd naar ${L2.length} ${L2.length === 1 ? 'chauffeur' : 'chauffeurs'}.`, { icon: 'send' }); refreshAll(); });
      },
    });
  }
  function shareLink(t) { const url = `${location.href.split('#')[0]}#klant/${t.id}`; try { navigator.clipboard && navigator.clipboard.writeText(url).catch(() => {}); } catch { /* geen klembord */ } A.log(`deelde een klant-link voor ${t.id}`, { t: t.id }); L.toast(`Klant-link gekopieerd. De klant ziet alleen ${t.id} en de volgende levering.`, { icon: 'link', action: 'Bekijk', onAction: () => go(`klant/${t.id}`) }); }

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
      // planbord: een rit naar een ander voertuig of een andere tijd, en een rit uit de pool inplannen
      else if (a.k === 'verplaats') { const rit = R.get(a.rit); const B = fleet.byId.get(a.naar); r = rit && B ? verplaatsRit(ctx, rit, B, a.start) : { ok: false, tekst: 'Rit of voertuig bestaat niet meer.' }; }
      else if (a.k === 'pool') { const item = pool(ctx).find(x => x.id === a.id); const B = fleet.byId.get(a.naar); r = item && B && !item.gepland ? planPoolRit(ctx, item, B, a.start, { chauffeur: a.chauffeur || null }) : { ok: false, tekst: 'Deze rit is al ingepland.' }; if (r && r.ok && item && item._route) R.naam(item._route, String(item.id).startsWith('R-') ? item.id : `R-${item.id}`); if (item) naInplannen(ctx, item, a, r); }
      // open ritten: toewijzen (fleet.wijsToe), een ja bevestigen, terug naar de open ritten, wie er gebeld of gevraagd is
      else if (a.k === 'toewijs' || a.k === 'bevestig' || a.k === 'terug' || a.k === 'contact' || a.k === 'charter') {
        r = voerActieUit(ctx, a);
        if (a.k === 'toewijs' && r && r.ok && r.t) { const item = pool(ctx).find(x => x.id === a.id); if (item && item._route) R.naam(item._route, `R-${item.id}`); }
      }
    } catch (err) { console.warn('actie niet uitgevoerd', a, err); r = { ok: false, tekst: 'Dat lukte niet.' }; }
    if (live && !(['verplaats', 'pool', 'toewijs', 'charter', 'terug'].includes(a.k) && !(r && r.ok))) { A.acts.actions.push(a); A.save(); }
    R.bump(); vcache = null;
    return r;
  }
  function applyProposal(p) {
    if (!can('act')) { L.toast('Alleen planners en regiomanagers passen voorstellen toe.', { icon: 'lock' }); return; }
    const r = runAction({ ...p.act, T: state.simTime }, true);
    if (p.msg) { const m = p.msg(r); if (m && m[0]) sendMsg(m[0], m[1], true, true); }
    A.acts.applied.push({ id: p.id, kind: p.kind, title: p.title, action: p.action, sev: p.sev, T: state.simTime, key: p.key }); A.save();
    Z.markApplied(p.key, p);
    A.log(`paste een voorstel toe bij ${p.kind.toLowerCase()} ${p.t ? p.t.id : p.tr ? p.tr.id : ''}: ${p.kort.toLowerCase()}`, { zaak: p.key, t: p.t ? p.t.id : null });
    if (p.t) feed.unshift({ T: state.simTime, t: p.t, txt: `voorstel toegepast: ${p.kort.toLowerCase()}`, sev: 'ok' });
    frame(true); refreshAll();
    L.toast(`Toegepast: ${p.kort}.${p.t ? ` ${p.t.id} heeft een bericht gekregen.` : ''}`, { icon: 'check' });
  }
  function restoreActs() {
    for (const [id, L2] of Object.entries(A.acts.msgs)) { const t = fleet.byId.get(id); if (t && Array.isArray(L2)) { t.msgs = L2; msgCount += L2.filter(m => m.me).length; } }
    for (const a of A.acts.actions) runAction(a, false);
  }
  const voorstellen = () => { if (!vcache || vtick !== tick) { vcache = proposals(ctx); vtick = tick; } return vcache; };
  const voorstelVoor = key => voorstellen().find(p => p.key === key) || null;
  const voorstelById = id => voorstellen().find(p => p.id === id) || null;

  // ---------- werkgebied ----------
  function applyProfile(fly = true) {
    if (!profile) return;
    F.regios = new Set((profile.regios || []).filter(r => REGIOS.includes(r))); F.divs = new Set((profile.divs || []).filter(k => DIV[k])); if (!F.divs.size) F.divs = new Set(Object.keys(DIV));
    role = ROLES[profile.role] ? profile.role : role; store.set('sl-role', role);
    F.sps = new Set(profile.sp && SP.find(s => s.n === profile.sp) ? [profile.sp] : []);
    if (profile.sp) { const sp = SP.find(s => s.n === profile.sp); if (sp) pbSp = sp; }
    if (fly) flyToScope();
    frame(true); refreshAll();
  }
  function flyToScope() {
    if (!mapApi) return;
    const sp = F.sps.size === 1 ? SP.find(s => F.sps.has(s.n)) : null;
    if (sp) mapApi.highlightSp(sp.n); else mapApi.highlightSp(null);
    if (three) { const s2 = sp || SP.find(x => x.n === (profile && profile.sp)) || SP[0]; mapApi.map.easeTo({ center: [s2.lon, s2.lat], zoom: 13.6, pitch: 58, bearing: -18, duration: FLY }); }
    else if (sp) mapApi.map.easeTo({ center: [sp.lon, sp.lat], zoom: 9.4, duration: FLY, padding: pad() });
    else if (F.regios.size && F.regios.size < REGIOS.length) mapApi.fitSps(SP.filter(s => F.regios.has(s.regio)));
    else mapApi.map.easeTo({ center: [5.3, 52.2], zoom: 6.6, duration: FLY, padding: pad() });
  }
  function clearSps() { F.sps.clear(); selSp = null; if (mapApi) mapApi.highlightSp(null); if (panelMode === 'sp') closePanel(); frame(true); refreshAll(); syncHash(); }
  function setRole(r) { role = r; store.set('sl-role', role); if (profile) { profile.role = role; store.set('sl-werkgebied', JSON.stringify(profile)); } refreshAll(true); L.toast(`Je kijkt nu als ${ROLES[role].n.toLowerCase()}: ${ROLES[role].sub}.`, { icon: 'idcard' }); }

  // ---------- opgeslagen weergaven ----------
  const savedViews = () => { try { return JSON.parse(store.get('sl-views') || '[]'); } catch { return []; } };
  function saveView(name) { const L2 = savedViews(); const c = mapApi ? mapApi.map.getCenter() : { lng: 5.3, lat: 52.2 }; L2.push({ name, scope: `${scopeLabel()} · ${divLabel()}`, regios: [...F.regios], divs: [...F.divs], sts: [...F.sts], sps: [...F.sps], view, center: [c.lng, c.lat], zoom: mapApi ? mapApi.map.getZoom() : 6.6 }); store.set('sl-views', JSON.stringify(L2)); A.log(`bewaarde de weergave "${name}"`); L.toast(`Weergave "${name}" opgeslagen.`, { icon: 'save' }); }
  function deleteView(i) { const L2 = savedViews(); const v = L2.splice(i, 1)[0]; store.set('sl-views', JSON.stringify(L2)); if (v) L.toast(`Weergave "${v.name}" verwijderd.`, { icon: 'trash' }); }
  function applyView(v) { F.regios = new Set(v.regios); F.divs = new Set(v.divs); F.sts = new Set(v.sts && v.sts.length ? v.sts.filter(s => STKEYS.includes(s)) : STKEYS); F.sps = new Set(v.sps); if (mapApi) mapApi.highlightSp(F.sps.size === 1 ? [...F.sps][0] : null); navTo(ALIAS[v.view] || (VIEW_NAME[v.view] ? v.view : 'kaart')); if (v.center && mapApi) mapApi.map.easeTo({ center: v.center, zoom: v.zoom, duration: FLY, padding: pad() }); frame(true); refreshAll(); L.toast(`Weergave "${v.name}" geladen.`, { icon: 'eye' }); }

  // ---------- toestand van een voertuig ----------
  // fleet.stateAt met de volgende stop zoals de planner hem ziet: na een opgeloste vertraging geeft stateAt de oude
  // geplande tijd als ETA, terwijl de wagen het plan (met de vertraging) rijdt; de ETA is dan de aankomst in het plan.
  // Het tijdvenster is het venster volgens effWin (base.js).
  function stAt(t, T) {
    const s = fleet.stateAt(t, T); const nx = s.next;
    if (nx) {
      if (t.delayResolved) for (let i = s.si + 1; i < t.plan.length; i++) { const x = t.plan[i]; if (nx.home ? (x.k === 'ontkoppel' || x.k === 'laden' || x.k === 'terrein') : x.k === 'stop') { nx.eta = t.dayStart + x.t0; break; } }
      if (nx.win) nx.win = effWin(nx.win, nx.planned);
    }
    return s;
  }

  // het dock komt uit de simulatie (stateAt) als het voertuig eraan staat; de kaart leidt het anders zelf af uit de plek
  const featOf = (t, s) => ({ type: 'Feature', properties: { id: t.id, st: s.st, b: Math.round(s.pos.bearing), mv: s.st === 'onderweg' || s.st === 'vertraagd', k: t.kind === 'trekker' ? (s.tr ? 'trekker' : 'solo') : t.kind, base: t.base.n, ...(s.dock ? { dock: s.dock } : {}) }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } });

  // ---------- de beurt ----------
  function frame(force) {
    if (!mapApi) return; tick++;
    const T = state.simTime; const feats = [], dims = []; const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; const ex = [];
    // een sprong in de tijd (klok verzet) is geen gebeurtenis: het logboek wordt opnieuw uit de simulatie opgebouwd
    const jumped = lastFrameT === null || Math.abs(((T - lastFrameT + 720) % 1440 + 1440) % 1440 - 720) > 5; lastFrameT = T; if (jumped) backfillFeed();
    let nVis = 0, laden = 0, ev = 0, inzet = 0, solo = 0, inS = 0;
    const mapOn = mapVisible();
    // vaste sleutel van een zaak: soort, voertuig en de rit waarin het speelt
    const rk = (L, t) => { const r = R.ritOf(t, T); return r ? `${L}:${t.id}:${r.id}` : `${L}:${t.id}`; };
    for (const t of fleet.trucks) {
      const s = stAt(t, T); S.set(t.id, s);
      const sc = inScope(t); const p = prevSt.get(t.id); if (p && p !== s.st && sc && !jumped) pushEvent(t, s, p); prevSt.set(t.id, s.st);
      // uitzonderingen: voor alle voertuigen (de zaken houden ook buiten het werkgebied hun toestand)
      if (s.st === 'vertraagd' && s.next && !s.next.home) ex.push({ key: rk('V', t), sev: 'bad', kind: 'Vertraging', t, text: `${s.next.name}: ETA ${hhmm(s.next.eta)}${s.next.win ? `, venster tot ${hhmm(s.next.win[1])}` : ''} (+${s.next.delay} min)`, data: { delay: s.next.delay, missed: !!(s.next.win && s.next.eta > s.next.win[1]) } });
      else if (s.st === 'vertraagd' && s.next && s.next.home && s.next.volgende) ex.push({ key: rk('V', t), sev: 'warn', kind: 'Vertraging', t, text: `terug op ${t.base.n} om ${hhmm(s.next.eta)} (+${s.next.delay} min); dienst ${s.next.volgende.i + 1} van ${s.next.volgende.driver} start ${hhmm(s.next.volgende.start)}`, data: { delay: s.next.delay } });
      if ((s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240 && !t.breakPlanned) { const left = Math.max(0, 270 - Math.floor(s.drive)); ex.push({ key: rk('R', t), sev: 'warn', kind: 'Rijtijd', t, text: `${s.driver || t.id}: ${fmtDrive(s.drive)} van 4:30 rijtijd, pauze binnen ${left} min`, data: { left } }); }
      if (t.ev && s.soc < 20 && s.st !== 'terrein' && !t.chargePlanned) ex.push({ key: rk('A', t), sev: 'warn', kind: 'Accu', t, text: `Accu ${Math.round(s.soc)} % · ${Math.round(t.range * s.soc / 100)} km bereik · ${s.next ? s.next.name : t.base.n}`, data: { soc: s.soc } });
      if (t.storing && s.st !== 'terrein' && !t.workorder) ex.push({ key: rk('T', t), sev: 'bad', kind: 'Techniek', t, text: t.storing, data: {} });
      if (!sc) { if (mapOn && F.dim && F.sps.size && F.sts.has(s.st) && (!F.regios.size || F.regios.has(t.base.regio)) && F.divs.has(t.div) && (F.bussen || t.kind !== 'bus')) dims.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); continue; }
      inS++; c[s.st]++; if (t.ev) ev++; if (t.vandaag === 'inzet') inzet++; if (s.solo && s.st !== 'klant') solo++; if (s.seg.k === 'laden') laden++;
      if (!visible(t, s)) continue;
      nVis++;
      // bezorgbussen kunnen van de kaart (Kaartlagen, toets b); een gekozen bus blijft zichtbaar
      if (mapOn && !docked && (F.bussen || t.kind !== 'bus' || t === selTruck)) feats.push(featOf(t, s));
    }
    // opleggers: toestand, losse opleggers op de kaart, koeling en wachttijd (elke achtste beurt; goedkoop genoeg)
    if (force || tick % 8 === 1 || !TRS.size) {
      trailerEx = []; const trFeats = []; let trailers = 0, loose = 0, trWait = 0;
      for (const tr of fleet.trailers) {
        const s = fleet.trailerStateAt(tr, T); TRS.set(tr.id, s);
        if (tr.storing && (s.st === 'gekoppeld' || s.st === 'geladen') && !tr.workorder) trailerEx.push({ key: 'K:' + tr.id, sev: 'bad', kind: 'Koeling', tr, t: s.vehicle || null, text: `${tr.id} (${TRT[tr.type].n.toLowerCase()}${s.vehicle ? `, achter ${s.vehicle.id}` : `, bij ${s.place}`}): ${tr.storing}`, data: { vehicle: s.vehicle || null } });
        if (s.late && !tr.pickupPlanned) trailerEx.push({ key: 'O:' + tr.id, sev: 'warn', kind: 'Oplegger', tr, t: null, text: `${tr.id} staat leeg bij ${s.place}, ophalen was gepland om ${hhmm(s.pickup)} (${durTxt(day(T - s.pickup))} geleden)`, data: { late: day(T - s.pickup) } });
        if (!inScopeBase(tr.base, tr.div)) continue;
        trailers++; if (s.st !== 'gekoppeld') { loose++; if (s.late) trWait++; if (s.st !== 'onderhoud' && (!F.trIds || F.trIds.has(tr.id))) trFeats.push({ type: 'Feature', properties: { id: tr.id, st: s.st, base: tr.base.n, b: s.pos.bearing != null ? Math.round(s.pos.bearing) : null, dock: s.dock || null }, geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); }
      }
      kpi.trailers = trailers; kpi.loose = loose; kpi.trWait = trWait;
      if (mapOn || force) mapApi.setTrailers(trFeats);
    }
    ex.push(...trailerEx);
    exceptions = ex; counts = c;
    kpi = { ...kpi, nVis, inScope: inS, inzet, actief: c.onderweg + c.vertraagd + c.klant + c.pauze, laden, ev, solo, lp: spsInScope().reduce((a, s) => a + laadpunten(s), 0) };
    Z.update(T, exceptions);
    if (mapOn || force) {
      // in een detailpagina toont de kleine kaart alleen het voertuig waar het om gaat
      if (docked) { const dt = docked.rit ? docked.rit.t : docked.truck || (docked.trailer ? (TRS.get(docked.trailer.id) || {}).vehicle : null); mapApi.setTrucks(dt && S.get(dt.id) ? [featOf(dt, S.get(dt.id))] : [], []); }
      else mapApi.setTrucks(feats, dims);
      drawSelection(T);
    }
    if (view === 'planbord') updateNowline(ctx);
    K.updateTimebar(ctx); nav.updateClock();
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (force || tick % 4 === 0) { K.renderMapbar(ctx); nav.renderSide(); nav.renderBottom(); nav.renderTop(); }
    if (force || tick % 8 === 0) {
      if (panelOpen() && !(typing && $('panel').contains(document.activeElement))) renderPanel();
      if (page && !(typing && $('sheet').contains(document.activeElement)) && (force || tick % 16 === 0)) renderPage();
      if (halSp) renderHal(ctx, halSp); if (klantId) renderKlant(ctx, klantId);
    }
    refreshView(force);
    K.renderTip(ctx, hoverId, hoverPt);
  }
  // per weergave een eigen ritme: lijsten met live tijden elke seconde, grote tabellen elke drie seconden
  function refreshView(force) {
    const el = $('v-' + view); if (!el) return; const typingHere = document.activeElement && el.contains(document.activeElement) && /^(TEXTAREA)$/.test(document.activeElement.tagName);
    const every = { overzicht: 8, ritten: 16, meldingen: 8, openritten: 16, planbord: 16, standplaatsen: 8, voertuigen: 24, opleggers: 24, chauffeurs: 24, charters: 60, laden: 80, rapporten: 120 }[view];
    if (!force && (!every || tick % every !== 0 || typingHere)) return;
    renderView(view);
  }
  function renderView(v) {
    const el = $('v-' + v); if (!el) return;
    try {
      if (v === 'overzicht') renderOverzicht(ctx, el);
      else if (v === 'ritten') renderRitten(ctx, el);
      else if (v === 'meldingen') renderMeldingen(ctx, el);
      else if (v === 'openritten') renderOpenRitten(ctx, el);
      else if (v === 'charters') renderPoule(ctx, el);
      else if (v === 'planbord') renderPlanbord(ctx, el);
      else if (v === 'standplaatsen') renderStandplaatsen(ctx, el);
      else if (v === 'voertuigen') renderVoertuigen(ctx, el);
      else if (v === 'opleggers') renderOpleggers(ctx, el);
      else if (v === 'chauffeurs') renderChauffeurs(ctx, el);
      else if (v === 'laden') renderLaden(ctx, el);
      else if (v === 'lostijden') renderLostijden(ctx, el);
      else if (v === 'pauze') renderPauze(ctx, el);
      else if (v === 'rapporten') renderRapporten(ctx, el);
      else if (v === 'instellingen') renderInstellingen(ctx, el);
    } catch (err) { console.warn('weergave', v, err); }
  }
  function refreshAll(views = true) { if (!mapApi) return; K.renderMapbar(ctx); nav.renderSide(); nav.renderBottom(); nav.renderTop(); if (panelOpen()) renderPanel(true); if (page) renderPage(true); if (views) renderView(view); }
  function pushEvent(t, s, p) {
    const e = evOf(t, s, p); if (e) { feed.unshift({ T: state.simTime, t, ...e }); if (feed.length > 240) feed.length = 240; }
  }
  // gebeurtenis bij een statuswissel (vertrokken, aangekomen, pauze, terug)
  function evOf(t, s, p) {
    let txt = null;
    if (s.st === 'klant') txt = `aangekomen bij ${s.seg.stop}${s.seg.swap ? ' (oplegger wisselen)' : ''}`;
    else if (s.st === 'pauze') txt = s.seg.k === 'laden' ? 'laadt onderweg' : 'pauze gestart (45 min)';
    else if (s.st === 'terrein') txt = s.seg.k === 'koppel' ? `koppelt ${s.seg.tr.id} op ${t.base.n}` : s.seg.k === 'ontkoppel' ? `terug op ${t.base.n}, koppelt ${s.seg.tr.id} af` : `terug op ${t.base.n}${s.seg.k === 'laden' ? ', laadt accu' : ''}`;
    else if (s.st === 'onderweg' || s.st === 'vertraagd') {
      const home = !s.next || s.next.home; const dn = home ? t.base.n : s.next.name;
      txt = p === 'terrein' ? `vertrokken van ${t.base.n}${home ? '' : ` naar ${dn}`}${s.tr ? ` met ${s.tr.id}` : s.solo ? ' zonder oplegger' : ''}` : s.st === 'vertraagd' && p === 'onderweg' ? `rijdt met vertraging naar ${dn}` : home ? `rijdt terug naar ${dn}` : `onderweg naar ${dn}`;
    }
    return txt ? { txt, sev: s.st === 'vertraagd' ? 'bad' : s.st === 'klant' ? 'info' : 'ok' } : null;
  }
  // bij het openen: de gebeurtenissen van het laatste uur uit de simulatie, zodat het logboek niet leeg begint
  let lastFrameT = null, feedJob = 0;
  function backfillFeed() {
    const job = ++feedJob; const T1 = state.simTime; const jobs = fleet.trucks.filter(t => t.vandaag === 'inzet'); const past = []; let i = 0;
    feed.length = 0;
    const step = () => {
      if (job !== feedJob) return;
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 10) {
        const t = jobs[i++]; let p = fleet.stateAt(t, T1 - 61).st;
        for (let x = T1 - 60; x < T1; x++) { const s = fleet.stateAt(t, x); if (s.st !== p) { const e = evOf(t, s, p); if (e) past.push({ T: ((x % 1440) + 1440) % 1440, t, ...e }); } p = s.st; }
      }
      if (i < jobs.length) { setTimeout(step, 0); return; }
      const now = state.simTime; const L = [...feed, ...past].sort((a, b) => day(now - a.T) - day(now - b.T)); feed.length = 0; feed.push(...L.slice(0, 400)); refreshAll();
    };
    setTimeout(step, 60);
  }

  // ---------- kaart: selectie, route, volgen, dok in een detailpagina ----------
  const mapVisible = () => view === 'kaart' || !!docked;
  const pad = () => ({ top: 56, left: 0, bottom: narrow() && panelOpen() ? Math.round(root.clientHeight * 0.5) : 70, right: !narrow() && panelOpen() ? Math.min(400, root.clientWidth * 0.45) : 0 });
  function drawRoute(t, s) {
    const seg = s.seg; const r = seg.route || (t.plan.find(x => x.route) || {}).route; if (!r) { mapApi.setRoute(null, null, []); return; }
    const km = seg.route ? s.km : 0; const pts = r.path.pts, cum = r.path.cum; const done = [], todo = [];
    for (let i = 0; i < pts.length; i++) { if (cum[i] <= km) done.push(pts[i]); else todo.push(pts[i]); }
    done.push([s.pos.lon, s.pos.lat]); todo.unshift([s.pos.lon, s.pos.lat]);
    const stops = r.marks.slice(1, -1).map(m => { const i = Math.max(0, cum.findIndex(c2 => c2 >= m.km)); return { lon: pts[i][0], lat: pts[i][1], done: m.km <= km }; });
    mapApi.setRoute(done.length > 1 ? done : null, todo.length > 1 ? todo : null, stops);
  }
  function drawRit(r, T) {
    const t = r.t; const s = S.get(t.id); const rel = (((T - t.dayStart) % 1440) + 1440) % 1440; const done = [], todo = [], stops = [];
    for (const x of r.segs) { if (x.s.k !== 'drive') continue; const { pts, cum } = x.s.route.path; const a = x.s.t0, b = x.s.t1; const kmNow = rel <= a ? x.s.km0 : rel >= b ? x.s.km1 : x.s.km0 + (x.s.km1 - x.s.km0) * (rel - a) / (b - a);
      for (let i = 0; i < pts.length; i++) { if (cum[i] < x.s.km0 - 1e-6 || cum[i] > x.s.km1 + 1e-6) continue; (cum[i] <= kmNow ? done : todo).push(pts[i]); } }
    for (const x of r.stops) { const sp = x.seg.route.path; const i = Math.max(0, sp.cum.findIndex(c2 => c2 >= (x.seg.km0 || 0))); stops.push({ lon: sp.pts[i][0], lat: sp.pts[i][1], done: rel >= x.seg.t1 }); }
    mapApi.setRoute(done.length > 1 ? done : null, todo.length > 1 ? todo : null, stops);
    if (s) mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } });
    return [...done, ...todo];
  }
  // volgen op de platte kaart: de camera beweegt pas als het voertuig uit het midden van het beeld raakt (rustig)
  function followFlat(pos) {
    const c = mapApi.map.getContainer(); const p = mapApi.map.project([pos.lon, pos.lat]); const P = pad();
    const w = c.clientWidth - P.right, h = c.clientHeight - P.bottom;
    if (p.x < w * 0.3 || p.x > w * 0.7 || p.y < P.top + (h - P.top) * 0.3 || p.y > P.top + (h - P.top) * 0.7) mapApi.map.easeTo({ center: [pos.lon, pos.lat], duration: FLY, padding: P });
  }
  // volgen doet de kaart zelf (mapApi.follow: de camera schuift per beeld mee, in 3D schuin erachter en draaiend met de
  // koers); hier alleen aan en uit, en loslaten als de kaart er zelf mee stopt (bijvoorbeeld als je ergens anders heen vliegt)
  function syncFollow() {
    if (!mapApi || mapApi.noWebGL || !mapApi.follow || !mapApi.following) return false;
    const want = follow && selTruck && !docked ? selTruck.id : null; const cur = mapApi.following();
    if (want) { if (cur !== want) { if (volgGestart === want) { follow = false; volgGestart = null; if (panelOpen()) renderPanel(true); } else { mapApi.follow(want, { rotate: three && !RM }); volgGestart = want; } } }
    else if (volgGestart) { if (cur === volgGestart) mapApi.follow(null); volgGestart = null; }
    return true;
  }
  function drawSelection(T) {
    if (docked && docked.rit) { drawRit(docked.rit, T); return; }
    const t = docked && docked.truck ? docked.truck : selTruck;
    const kaartVolgt = syncFollow();
    if (t) { const s = S.get(t.id); mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); drawRoute(t, s); if (!kaartVolgt && follow && !docked && Date.now() - lastFollow > 900) { lastFollow = Date.now(); if (three) mapApi.followCam(s.pos, FLY, !RM); else if (!mapApi.noWebGL) followFlat(s.pos); } return; }
    const tr = docked && docked.trailer ? docked.trailer : selTrailer;
    if (tr) { const s = TRS.get(tr.id) || fleet.trailerStateAt(tr, T); mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.pos.lon, s.pos.lat] } }); return; }
    if (selWinkel) { mapApi.setSelected({ type: 'Feature', geometry: { type: 'Point', coordinates: [selWinkel.lon, selWinkel.lat] } }); return; }
    mapApi.setSelected(null);
  }
  let vliegNaar = false, vliegT = 0;
  // zoeken opent een voertuig, oplegger of persoon als pagina; de kaart in die pagina vliegt er dan heen
  function vliegBijDock() { vliegNaar = true; clearTimeout(vliegT); vliegT = setTimeout(() => { vliegNaar = false; }, 3000); }
  function dockMap(slot, o) {
    const m = $('map'); if (!slot || !m || !mapApi) return;
    if (!docked) { dockCam = mapApi.noWebGL ? null : { center: mapApi.map.getCenter(), zoom: mapApi.map.getZoom(), pitch: mapApi.map.getPitch ? mapApi.map.getPitch() : 0, bearing: mapApi.map.getBearing ? mapApi.map.getBearing() : 0 }; dock3d = three && mapApi.has3d(); if (dock3d) mapApi.set3d(false); }
    const fresh = !docked || docked.key !== keyOf(o);
    slot.appendChild(m); docked = { ...o, key: keyOf(o) };
    try { mapApi.map.resize(); } catch { /* geen kaart */ }
    if (fresh) fitDock();
    frame(true);
  }
  const keyOf = o => o.rit ? 'r' + o.rit.id : o.truck ? 't' + o.truck.id : o.trailer ? 'o' + o.trailer.id : '';
  function fitDock() {
    if (!docked || mapApi.noWebGL) return; const T = state.simTime; let pts = [];
    // vanuit zoeken vliegt de kaart in de pagina naar het voertuig of de oplegger (met minder beweging: springt)
    const vlieg = vliegNaar && !RM; vliegNaar = false;
    if (docked.rit) pts = drawRit(docked.rit, T);
    else if (docked.truck) { const s = S.get(docked.truck.id) || stAt(docked.truck, T); pts = [[s.pos.lon, s.pos.lat]]; const r = s.seg.route; if (r && !vlieg) pts.push(...r.path.pts.filter((_, i) => i % 6 === 0)); }
    else if (docked.trailer) { const s = trailerState(docked.trailer); pts = [[s.pos.lon, s.pos.lat]]; }
    if (!pts.length) return;
    if (pts.length === 1) { const cam = { center: pts[0], zoom: 12.5, pitch: 0, bearing: 0, padding: { top: 0, left: 0, right: 0, bottom: 0 } }; if (vlieg) mapApi.map.flyTo({ ...cam, duration: 1400, essential: false }); else mapApi.map.jumpTo(cam); return; }
    let a = [Infinity, Infinity], b = [-Infinity, -Infinity]; for (const p of pts) { a = [Math.min(a[0], p[0]), Math.min(a[1], p[1])]; b = [Math.max(b[0], p[0]), Math.max(b[1], p[1])]; }
    try { mapApi.map.fitBounds([a, b], { padding: 36, maxZoom: 12.5, duration: 0, pitch: 0, bearing: 0 }); } catch { /* buiten beeld */ }
  }
  function undockMap() {
    if (!docked) return; const m = $('map'); const v = $('v-kaart'); v.insertBefore(m, v.firstChild); docked = null;
    // alleen meten als de kaartweergave zichtbaar is; anders meet setView('kaart') hem zodra hij in beeld komt
    try { if (m.clientWidth && m.clientHeight) mapApi.map.resize(); if (dockCam) mapApi.map.jumpTo({ ...dockCam, padding: { top: 0, left: 0, right: 0, bottom: 0 } }); } catch { /* geen kaart */ }
    if (dock3d) mapApi.set3d(true); dock3d = false; dockCam = null;
    mapApi.setRoute(null, null, []); frame(true);
  }
  function selectTruck(id, opts = {}) {
    const t = fleet.byId.get(id); if (!t) return; selTruck = t; selTrailer = null; selRest = null; selWinkel = null; follow = false; const s = stAt(t, state.simTime); S.set(t.id, s);
    if (page && !opts.keepPage) closePage();
    if (!opts.stay && view !== 'kaart') setView('kaart', true);
    openPanel('truck', true);
    // vanuit zoeken, een lijst of een pagina (opts.fly) vliegt de kaart erheen met een ring; een klik op de kaart zelf
    // laat de kaart staan als het voertuig al in beeld is
    if (view === 'kaart' && mapApi && !mapApi.noWebGL) { const z = mapApi.map.getZoom(); cam(t.id, [s.pos.lon, s.pos.lat], opts.fly ? Math.max(z, 12.5) : Math.max(z, 10.5), { alsVerborgen: !opts.fly }); }
    frame(true); syncHash();
  }
  function selectTrailer(id, opts = {}) {
    const tr = fleet.trailerById.get(id); if (!tr) return; selTrailer = tr; selTruck = null; selRest = null; selWinkel = null; follow = false; mapApi && mapApi.setRoute(null, null, []);
    const s = fleet.trailerStateAt(tr, state.simTime); TRS.set(tr.id, s);
    if (s.st !== 'gekoppeld' && s.st !== 'onderhoud') setTrailersOnMap(true, true);
    if (page && !opts.keepPage) closePage();
    if (!opts.stay && view !== 'kaart') setView('kaart', true);
    openPanel('trailer', true);
    if (view === 'kaart' && mapApi && !mapApi.noWebGL) { const z = mapApi.map.getZoom(); cam(tr.id, [s.pos.lon, s.pos.lat], opts.fly ? Math.max(z, 14) : Math.max(z, 11.5), { alsVerborgen: !opts.fly }); }
    frame(true); syncHash();
  }
  function selectSp(sp) {
    if (!sp) return; selSp = sp; selTruck = null; selRest = null; selTrailer = null; selWinkel = null; follow = false; mapApi && mapApi.setRoute(null, null, []); F.sps = new Set([sp.n]); mapApi && mapApi.highlightSp(sp.n);
    if (page) closePage();
    if (view !== 'kaart') setView('kaart', true); openPanel('sp', true);
    if (mapApi && !mapApi.noWebGL) cam(sp.n, [sp.lon, sp.lat], Math.max(mapApi.map.getZoom(), 12.5));
    frame(true); refreshAll(false); syncHash();
  }
  function selectRest(id) { const p = rest.byId.get(id); if (!p) return; selRest = p; selTrailer = null; selWinkel = null; if (page) closePage(); setRestOnMap(true); if (view !== 'kaart') setView('kaart', true); openPanel('rest', true); if (mapApi && !mapApi.noWebGL) cam([p.lon, p.lat], [p.lon, p.lat], Math.max(mapApi.map.getZoom(), 11)); syncHash(); }
  // een winkel, DC, fabriek of groothandel: op id (places.js) of op de stopnaam uit het dagplan
  function selectWinkel(key, opts = {}) {
    const p = winkelById.get(key) || dcById.get(key) || null; const name = p ? plekNaam(p) : key; let pos = p ? [p.lon, p.lat] : null;
    if (!pos) for (const t of fleet.trucks) { for (const s of t.plan) if (s.k === 'stop' && s.stop === name && s.route) { const i = Math.max(0, s.route.path.cum.findIndex(c2 => c2 >= (s.km0 || 0))); pos = s.route.path.pts[i]; break; } if (pos) break; }
    if (!pos) return; selWinkel = { name, id: p ? p.id : null, place: p, lon: pos[0], lat: pos[1] }; selTruck = null; selTrailer = null; selRest = null; follow = false; mapApi && mapApi.setRoute(null, null, []);
    if (page) closePage(); if (view !== 'kaart') setView('kaart', true); openPanel('winkel', true);
    if (mapApi && !mapApi.noWebGL) cam(p ? p.id : [selWinkel.lon, selWinkel.lat], [selWinkel.lon, selWinkel.lat], Math.max(mapApi.map.getZoom(), 14.5), { alsVerborgen: !!opts.vanKaart });
    frame(true); syncHash();
  }
  // klik op een DC of winkel op de kaart (onSelectPlace van de kaart, of de terugval in attachMap): open de plek; twee
  // meldingen van dezelfde klik tellen als een
  function selectPlace(p) {
    const id = p && p.id; if (!id) return; const now = performance.now(); if (laatstePlek.id === id && now - laatstePlek.t < 400) return;
    laatstePlek = { id, t: now }; selectWinkel(id, { vanKaart: true });
  }
  // ligt een punt in het vrije deel van de kaart (niet onder het paneel, de topbalk of de tijdbalk)?
  function zichtbaar(lon, lat, m = 40) {
    try { const P = pad(); const c = mapApi.map.getContainer(); const p = mapApi.map.project([lon, lat]); return p.x >= P.left + m && p.x <= c.clientWidth - P.right - m && p.y >= P.top + m && p.y <= c.clientHeight - P.bottom - m; } catch { return false; }
  }
  // camera naar een doel: de kaart vliegt zelf (mapApi.flyTo: 600 tot 900 ms met een korte ring om het doel; bij minder
  // beweging springt hij). doel is wat de kaart kent (voertuig, oplegger, standplaatsnaam, id van een DC of winkel) of
  // [lon, lat]; ll is de plek zelf. alsVerborgen: alleen bewegen als het doel niet al in het vrije deel van de kaart staat.
  // Het paneel krijgt ruimte: de kaart rekent het midden zonder de strook van het paneel (padding).
  function cam(doel, ll, zoom, o = {}) {
    if (!mapApi || mapApi.noWebGL) return;
    if (o.alsVerborgen && ll && zichtbaar(ll[0], ll[1]) && (zoom == null || zoom <= mapApi.map.getZoom() + 0.01)) return;
    const P = pad(); try { const c = mapApi.map.getPadding(); if (c.top !== P.top || c.right !== P.right || c.bottom !== P.bottom || c.left !== P.left) mapApi.map.setPadding(P); } catch { /* oudere kaart */ }
    if (mapApi.flyTo && mapApi.flyTo(doel, { zoom, duration: FLY, mark: o.mark !== false })) return;
    if (ll) mapApi.map.easeTo({ center: ll, zoom, duration: FLY, padding: P });
  }
  function flyTo(lon, lat, zoom, label) { if (page) closePage(); if (view !== 'kaart') setView('kaart', true); else syncHash(); cam([lon, lat], [lon, lat], zoom); if (label) L.toast(`Kaart op ${label}.`, { icon: 'pin' }); }
  // een rit uit de pool (nog zonder voertuig) op de kaart: de hele route blauw met de stops (mapApi.setRoute)
  function toonPoolrit(item) {
    if (!item || !item.route || !item.route.path) return;
    if (page) closePage(); clearSel(); if (view !== 'kaart') setView('kaart', true);
    if (!mapApi || mapApi.noWebGL) { L.toast('De kaart heeft WebGL nodig; deze browser heeft dat niet.', { icon: 'info' }); return; }
    const pts = item.route.path.pts; const stops = (item.stops || []).map(s => s.place && s.place.lon != null ? { lon: s.place.lon, lat: s.place.lat, done: false } : null).filter(Boolean);
    mapApi.setRoute(null, pts, stops);
    let a = [Infinity, Infinity], b = [-Infinity, -Infinity]; for (const p of pts) { a = [Math.min(a[0], p[0]), Math.min(a[1], p[1])]; b = [Math.max(b[0], p[0]), Math.max(b[1], p[1])]; }
    try { mapApi.map.fitBounds([a, b], { padding: { top: 90, bottom: 110, left: 60, right: 60 }, maxZoom: 12, duration: FLY }); } catch { /* */ }
    L.toast(`Rit ${item.id} (${item.klant}, nog zonder voertuig): de route en ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} op de kaart.`, { icon: 'route' });
  }
  function clearSel() { selTruck = null; selTrailer = null; selWinkel = null; follow = false; if (mapApi) mapApi.setRoute(null, null, []); if (['truck', 'trailer', 'winkel', 'rest'].includes(panelMode)) closePanel(); frame(true); syncHash(); }
  function setTrailersOnMap(v, quiet) { trailersOnMap = v; if (mapApi) mapApi.showTrailers(v); K.renderMapbar(ctx); if (!quiet && view === 'kaart') L.toast(v ? 'Losse opleggers op de kaart.' : 'Losse opleggers verborgen.', { icon: 'trailer' }); }
  function setRestOnMap(v) { restOnMap = v; if (mapApi) { mapApi.showRest(v); if (v) mapApi.setRest(rest.places, selRest && selRest.id); } }
  // alleen de kaart (en de 3D-wereld): in lijsten, tellers en meldingen blijven de bussen gewoon meetellen
  function setBussenOnMap(v, quiet) { F.bussen = !!v; frame(true); K.renderMapbar(ctx); if (!quiet && view === 'kaart') L.toast(v ? 'Bezorgbussen weer op de kaart.' : 'Bezorgbussen van de kaart gehaald. In lijsten en meldingen tellen ze gewoon mee.', { icon: 'bus' }); }
  function showTrucksOnMap(trucks) {
    F.ids = new Set(trucks.map(t => t.id)); F.sts = new Set(STKEYS); navTo('kaart'); frame(true);
    const pts = trucks.map(t => (S.get(t.id) || stAt(t, state.simTime)).pos); if (mapApi && pts.length) { let a = [Infinity, Infinity], b = [-Infinity, -Infinity]; for (const p of pts) { a = [Math.min(a[0], p.lon), Math.min(a[1], p.lat)]; b = [Math.max(b[0], p.lon), Math.max(b[1], p.lat)]; } try { mapApi.map.fitBounds([a, b], { padding: 80, maxZoom: 11, duration: FLY }); } catch { /* */ } }
    L.toast(`${trucks.length} ${trucks.length === 1 ? 'voertuig' : 'voertuigen'} op de kaart. Haal de selectie weg met het kruisje bovenaan.`, { icon: 'map' });
  }
  function showTrailersOnMap(trs) {
    F.trIds = new Set(trs.map(t => t.id)); setTrailersOnMap(true, true); navTo('kaart'); frame(true);
    const pts = trs.map(tr => trailerState(tr).pos); if (mapApi && pts.length) { let a = [Infinity, Infinity], b = [-Infinity, -Infinity]; for (const p of pts) { a = [Math.min(a[0], p.lon), Math.min(a[1], p.lat)]; b = [Math.max(b[0], p.lon), Math.max(b[1], p.lat)]; } try { mapApi.map.fitBounds([a, b], { padding: 80, maxZoom: 12, duration: FLY }); } catch { /* */ } }
    L.toast(`${trs.length} ${trs.length === 1 ? 'oplegger' : 'opleggers'} op de kaart.`, { icon: 'trailer' });
  }
  function hover(id, pt) { hoverId = id; hoverPt = pt; K.renderTip(ctx, hoverId, hoverPt); }
  function toggleFollow() {
    const t = selTruck; if (!t) return; follow = !follow;
    // aan: opnieuw beginnen (ook als de kaart er eerder zelf mee stopte); uit: syncFollow laat de kaart los
    if (mapApi && mapApi.follow && !mapApi.noWebGL) { if (follow) volgGestart = null; syncFollow(); }
    else if (follow && mapApi) { const s = S.get(t.id); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(mapApi.map.getZoom(), 11), duration: FLY, padding: pad() }); }
    // alleen de knop bijwerken, niet het hele paneel opnieuw tekenen: dat kost op een trage machine een paar honderd ms
    // precies op het moment dat de volgcamera begint
    const fb = $('followBtn');
    if (fb) { fb.classList.toggle('on', follow); fb.setAttribute('aria-pressed', String(follow)); fb.title = `${follow ? 'Volgen staat aan' : 'Volg dit voertuig'} (f)`; } else renderPanel(true);
    L.toast(follow ? `Je volgt ${t.id}. Druk op f om te stoppen.` : `Je volgt ${t.id} niet meer.`, { icon: 'nav' });
  }
  // 3D-wereld aan of uit: aan kantelt de kaart en vliegt naar de standplaats (of het geselecteerde voertuig); uit gaat terug
  function set3dMode(v) {
    if (!mapApi || !mapApi.has3d()) { if (v) L.toast('De 3D-wereld heeft WebGL nodig; deze browser heeft dat niet.', { icon: 'info' }); return; }
    three = !!v; store.set('sl-3d', three ? 'on' : 'off'); root.classList.toggle('three', three); mapApi.set3d(three);
    if (view !== 'kaart') setView('kaart', true);
    if (three) { prevCam = { center: mapApi.map.getCenter(), zoom: mapApi.map.getZoom() }; const s = selTruck && S.get(selTruck.id); const sp = selSp || SP.find(x => x.n === (profile && profile.sp)) || (F.sps.size === 1 && SP.find(x => F.sps.has(x.n))) || SP[0]; mapApi.map.easeTo({ center: s ? [s.pos.lon, s.pos.lat] : [sp.lon, sp.lat], zoom: s ? 14.2 : 13.6, pitch: 58, bearing: -18, duration: RM ? 0 : 1400 }); lastFollow = Date.now() + 1500; }
    else { mapApi.map.easeTo({ pitch: 0, bearing: 0, zoom: prevCam ? prevCam.zoom : 10, center: prevCam ? prevCam.center : mapApi.map.getCenter(), duration: RM ? 0 : 900 }); lastFollow = Date.now() + 1000; }
    // volgt de kaart een voertuig, dan in 3D draaiend met de koers en plat zonder draaien
    if (follow && selTruck && mapApi.follow) { mapApi.follow(selTruck.id, { rotate: three && !RM }); volgGestart = selTruck.id; }
    K.renderMaptools(ctx); frame(true);
  }

  // ---------- paneel rechts ----------
  const panelOpen = () => $('panel').classList.contains('open');
  function openPanel(mode, quiet) { panelMode = mode; const p = $('panel'); const was = panelOpen(); p.classList.add('open'); p.classList.remove('big'); renderPanel(true); if (!was && !quiet) { const f = p.querySelector('#closePanel'); if (f) f.focus({ preventScroll: true }); } nav.renderTop(); }
  function closePanel() { const p = $('panel'); const had = panelOpen(); p.classList.remove('open', 'big'); const m = panelMode; panelMode = null; if (m === 'sp') selSp = null; if (m === 'rest') selRest = null; if (m === 'winkel') selWinkel = null; if (m === 'truck') { selTruck = null; follow = false; } if (m === 'trailer') selTrailer = null; if (had && mapApi) { mapApi.setRoute(null, null, []); if (view === 'kaart' && !mapApi.noWebGL) mapApi.map.easeTo({ padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: RM ? 0 : 200 }); } nav.renderTop(); }
  function renderPanel(force) {
    const p = $('panel'); if (!panelOpen()) return; let h = '', bind = null;
    if (panelMode === 'truck' && selTruck) { h = K.truckPanel(ctx, selTruck); bind = x => K.bindTruckPanel(ctx, x, selTruck); }
    else if (panelMode === 'trailer' && selTrailer) { h = K.trailerPanel(ctx, selTrailer); bind = x => K.bindTrailerPanel(ctx, x, selTrailer); }
    else if (panelMode === 'sp' && selSp) { h = K.spPanel(ctx, selSp); bind = x => K.bindSpPanel(ctx, x, selSp); }
    else if (panelMode === 'rest' && selRest) { h = K.restPanel(ctx, selRest); bind = x => K.bindRestPanel(ctx, x, selRest); }
    else if (panelMode === 'winkel' && selWinkel) { h = K.winkelPanel(ctx, selWinkel.name, selWinkel.place); }
    else if (panelMode === 'assist') { h = assistPanel(ctx); bind = x => bindAssist(ctx, x); }
    else { closePanel(); return; }
    if (!force && p.dataset.h === h) return;
    const ae = document.activeElement; const fsig = p.contains(ae) ? focusSig(ae) : null; const bodyScroll = p.querySelector('.pnl-b') ? p.querySelector('.pnl-b').scrollTop : 0; const keep = p.dataset.mode === panelMode;
    p.innerHTML = h; p.dataset.h = h; p.dataset.mode = panelMode; if (bind) bind(p);
    const nb = p.querySelector('.pnl-b'); if (nb && keep) nb.scrollTop = bodyScroll;
    if (fsig) refocus(p, fsig);
  }
  const focusSig = el => el ? { id: el.id, open: el.dataset && el.dataset.open, k: el.dataset ? Object.entries(el.dataset).map(([a, b]) => `[data-${a.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${CSS.escape(b)}"]`)[0] : null } : null;
  function refocus(box, sig) { const x = (sig.id && box.querySelector('#' + CSS.escape(sig.id))) || (sig.k && box.querySelector(sig.k)); if (x) x.focus({ preventScroll: true }); }
  function toggleAssist(onlyOpen) { if (panelOpen() && panelMode === 'assist') { if (!onlyOpen) closePanel(); return; } openPanel('assist'); }

  // ---------- detailpagina's (#sheet) ----------
  function pageContent() {
    if (!page) return null;
    if (page.kind === 'rit') return ritPage(ctx, page.id);
    if (page.kind === 'melding') return zaakPage(ctx, page.id);
    if (page.kind === 'voertuig') return truckPage(ctx, page.id, page.tab);
    if (page.kind === 'oplegger') return trailerPage(ctx, page.id, page.tab);
    if (page.kind === 'persoon') return personPage(ctx, page.id, page.tab);
    if (page.kind === 'charter') return charterPage(ctx, page.id);
    if (page.kind === 'oproep') return oproepPage(ctx, page.id);
    return null;
  }
  function renderPage(force) {
    const el = $('sheet'); if (!page) return;
    let c; try { c = pageContent(); if (c) c.html = sectieIconen(c.html); } catch (err) { console.warn('pagina', page, err); c = null; }
    if (!c) { el.innerHTML = `<div class="pg"><div class="pg-bar"><button class="btn sm" type="button" data-back="1">${ic('back', 15)}Terug</button></div>${empty('Niet gevonden', 'Dit voertuig, deze rit of deze melding bestaat vandaag niet (meer). Controleer de link of zoek opnieuw.', '', 'search', 'center')}</div>`; el.dataset.h = ''; return; }
    if (!force && el.dataset.h === c.html) return;
    const ae = document.activeElement; const fsig = el.contains(ae) ? focusSig(ae) : null; const st = el.scrollTop;
    const m = $('map'); const hadMap = docked && el.contains(m); if (hadMap) $('v-kaart').insertBefore(m, $('v-kaart').firstChild);
    // een portret dat al geladen is, blijft hetzelfde element (geen knipperen als de pagina opnieuw tekent)
    const keep = new Map([...el.querySelectorAll('figure[data-portret][data-gevuld]')].map(f => [f.dataset.portret, f]));
    el.innerHTML = c.html; el.dataset.h = c.html; ui.pageTitle = c.title; ui.pageParent = c.parent;
    for (const f of el.querySelectorAll('figure[data-portret]')) { const o = keep.get(f.dataset.portret); if (o) f.replaceWith(o); }
    vulPortretten(el, ctx);
    if (!el.querySelector('[data-mapslot]') && docked) undockMap();
    c.bind && c.bind(el);
    el.scrollTop = st; if (fsig) refocus(el, fsig);
  }
  function openPage(kind, id, tab) {
    const same = page && page.kind === kind && page.id === id;
    if (!same && docked) undockMap();
    page = { kind, id, tab }; const el = $('sheet'); el.hidden = false;
    if (!same) { el.scrollTop = 0; el.dataset.h = ''; }
    if (narrow() && panelOpen()) closePanel();
    renderPage(true); nav.renderSide(); nav.renderBottom(); nav.renderTop();
    if (!same) { const h1 = el.querySelector('h1'); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
    syncHash();
  }
  function closePage() { if (!page) return; page = null; undockMap(); const el = $('sheet'); el.hidden = true; el.innerHTML = ''; el.dataset.h = ''; nav.renderSide(); nav.renderBottom(); nav.renderTop(); }
  function back() { if (depth() > 0) history.back(); else { closePage(); syncHash(); } }

  // ---------- weergaven ----------
  function setView(name, quiet) {
    name = ALIAS[name] || name;
    if (name === 'assistent') { toggleAssist(true); return; }
    if (!VIEW_NAME[name]) return;
    const was = view; view = name;
    document.querySelectorAll('#views > .view').forEach(s => s.classList.toggle('on', s.id === 'v-' + name));
    // de kaart meteen op zijn echte maat: een camera die direct hierna vliegt (Op kaart vanuit een pagina, zoeken) rekent
    // anders met de maat van de verborgen weergave of van het kaartje in de pagina, en het voertuig belandt linksboven.
    // Daarna nog een keer, als de opmaak (paneel, balken) gezet is.
    if (name === 'kaart' && mapApi) { try { mapApi.map.resize(); } catch { /* geen kaart */ } setTimeout(() => { try { mapApi.map.resize(); } catch { /* */ } }, 0); }
    if (name !== 'kaart' && ['truck', 'trailer', 'sp', 'rest', 'winkel'].includes(panelMode)) closePanel();
    if (name === 'kaart' && !scopeFlown && mapApi) { scopeFlown = true; flyToScope(); }
    frame(true);
    if (!quiet) syncHash();
  }
  function navTo(name) {
    name = ALIAS[name] || name;
    if (nav.locked(name)) { L.toast('Het planbord is er voor planners en regiomanagers. Kies een andere rol om het te zien.', { icon: 'lock' }); return; }
    if (page) closePage();
    if (halSp || klantId) { halSp = null; klantId = null; $('hal').hidden = true; $('klant').hidden = true; root.classList.remove('kiosk'); }
    setView(name);
  }
  const navCurrent = () => page ? (ui.pageParent || { rit: 'ritten', melding: 'meldingen', voertuig: 'voertuigen', oplegger: 'opleggers', persoon: 'chauffeurs', charter: 'charters', oproep: 'charters' }[page.kind]) : view;
  function title() {
    if (page) return { h: ui.pageTitle || '', sub: `<button type="button" data-open="view:${navCurrent()}">${esc(VIEW_NAME[navCurrent()] || '')}</button> · ${esc(scopeLabel())}` };
    const c = Z.counts(); const k = kpi;
    const sub = {
      overzicht: `${esc(today)} · ${esc(scopeLabel())}`,
      kaart: `${esc(scopeLabel())} · ${esc(divLabel())}`,
      ritten: `${esc(scopeLabel())} · ${fmt(R.all().filter(r => inScope(r.t)).length)} ritten vandaag`,
      meldingen: `${fmt(c.open)} open · ${fmt(c.verlopen)} over de deadline · ${esc(scopeLabel())}`,
      openritten: (() => { const L = openIn(ctx); const v = L.filter(p => p.dag !== 'morgen').length; return `${fmt(v)} open vandaag · ${fmt(L.length - v)} voor morgen · ${esc(scopeLabel())}`; })(),
      charters: `De flexibele schil · ${esc(scopeLabel())}`,
      planbord: `${esc(pbSp.n)} · ${esc(today)}`,
      voertuigen: `${fmt(k.inScope || 0)} voertuigen · ${fmt(k.inzet || 0)} ingezet`,
      opleggers: `${fmt(k.trailers || 0)} opleggers · ${fmt(k.loose || 0)} los`,
      chauffeurs: `${esc(scopeLabel())} · een voertuig per dienst`,
      standplaatsen: `${fmt(spsInScope().length)} standplaatsen in ${esc(scopeLabel())}`,
      laden: `Goedkoopste uren · ${esc(scopeLabel())}`,
      lostijden: `Gepland naast gemeten · ${esc(scopeLabel())}`,
      pauze: `${rest.places.length} plekken langs de snelweg`,
      rapporten: `Stiptheid, invulling en meldingen · ${esc(scopeLabel())}`,
      instellingen: 'Profiel, werkgebied en normen',
    }[view] || '';
    return { h: view === 'charters' ? 'Charters en oproepkrachten' : VIEW_NAME[view], sub };
  }

  // ---------- routes: de URL volgt de app (weergave, selectie, pagina, hal-scherm, klant-link) ----------
  // #overzicht, #kaart, #ritten, #meldingen, #planbord, #voertuigen, #opleggers, #chauffeurs, #standplaatsen(/naam), #laden,
  // #lostijden, #pauzeplekken, #rapporten, #instellingen, #assistent; #voertuig/T-1002 (op de kaart), #voertuig/T-1002/onderhoud
  // (pagina), #oplegger/O-5150(/tab), #persoon/P-0001(/tab), #standplaats/Wognum (op de kaart), #rit/R-10213, #melding/V-T-1112,
  // #hal/Wognum, #klant/T-1002. Elke ingang die de app maakt krijgt een volgnummer in history.state, zodat sluiten echt een
  // stap terug gaat; een tabwissel op een pagina vervangt de ingang. Een onbekende hash doet niets.
  function fullscreen() { if (!embedded || !root.requestFullscreen || document.fullscreenElement) return; root.requestFullscreen().catch(() => {}); }
  if (embedded) document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && (halSp || klantId)) hashTo(''); });
  let applyingHash = false, seq = 0;
  const url = h => location.pathname + location.search + (h ? (h[0] === '#' ? h : '#' + h) : '');
  const depth = () => (history.state && history.state.n) || 0;
  function pushHash(h) { try { history.pushState({ n: ++seq }, '', url(h)); } catch { /* in een afgeschermd venster (artifact) mag dit soms niet */ } }
  function replaceHash(h) { try { history.replaceState(history.state, '', url(h)); } catch { /* idem */ } }
  const readHash = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } };
  const pageKey = h => { const m = /^(rit|melding|voertuig|oplegger|persoon|charter|oproep)\/([^/]+)(\/|$)/.exec(h); return m && (m[1] === 'rit' || m[1] === 'melding' || m[1] === 'charter' || m[1] === 'oproep' || m[3] === '/' || m[1] === 'persoon') ? `${m[1]}/${m[2]}` : null; };
  function currentHash() {
    if (halSp) return 'hal/' + halSp; if (klantId) return 'klant/' + klantId;
    if (page) return page.kind === 'rit' || page.kind === 'melding' || page.kind === 'charter' || page.kind === 'oproep' ? `${page.kind}/${page.id}` : `${page.kind}/${page.id}/${(page.tab || '').toLowerCase() || (page.kind === 'persoon' ? 'overzicht' : 'vandaag')}`;
    if (view === 'kaart') { if (selTruck) return 'voertuig/' + selTruck.id; if (selTrailer) return 'oplegger/' + selTrailer.id; if (selSp && panelMode === 'sp' && panelOpen()) return 'standplaats/' + selSp.n; if (selWinkel && panelMode === 'winkel' && panelOpen()) return 'winkel/' + (selWinkel.id || selWinkel.name); }
    if (view === 'standplaatsen' && ui.spSel) return 'standplaatsen/' + ui.spSel;
    if (view === 'openritten' && ui.or && ui.or.sel) return 'openritten/' + ui.or.sel;
    if (view === 'charters' && ui.pouleTab === 'oproep') return 'charters/oproep';
    return VIEW_HASH[view] || 'overzicht';
  }
  function syncHash() { if (applyingHash) return; const h = currentHash(); const cur = readHash(); if (cur === h) return; if (pageKey(h) && pageKey(h) === pageKey(cur)) replaceHash(h); else pushHash(h); }
  function hashTo(h) {
    if (!h && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (!h) { if (depth() > 0) { history.back(); return; } h = '#' + (VIEW_HASH[view] || 'overzicht'); replaceHash(h); onHash(h, true); return; }
    if (readHash() !== String(h).replace(/^#/, '')) pushHash(h); onHash(h, true);
  }
  // centrale navigatie voor data-open: "view:ritten", "kaart:truck:T-1002", "kaart:trailer:O-5150", "kaart:sp:Wognum",
  // "kaart:winkel:AH Hoorn", of een route zoals "rit/R-10213", "melding/V-T-1112", "voertuig/T-1002/onderhoud"
  function go(target) {
    target = String(target || ''); L.closePop(false); if (search && search.isOpen()) search.close(false);
    if (target.startsWith('view:')) { navTo(target.slice(5)); return; }
    if (target.startsWith('lijst:')) { const [, v, ...q] = target.split(':'); openList(v, q.join(':')); return; }
    if (target.startsWith('kaart:')) { const [, kind, ...rest2] = target.split(':'); const id = rest2.join(':'); if (halSp || klantId) { halSp = null; klantId = null; $('hal').hidden = true; $('klant').hidden = true; root.classList.remove('kiosk'); } if (kind === 'truck') selectTruck(id, { fly: true }); else if (kind === 'trailer') selectTrailer(id, { fly: true }); else if (kind === 'sp') selectSp(SP.find(s => s.n === id)); else if (kind === 'winkel') selectWinkel(id); return; }
    hashTo('#' + target);
  }
  function onHash(forced, explicit) {
    const h = forced !== undefined ? String(forced).replace(/^#/, '') : readHash(); const [k, ...r] = h.split('/'); let arg = r.join('/'); try { arg = decodeURIComponent(arg); } catch { /* laat staan */ }
    const parts = arg.split('/'); const id = parts[0] || ''; const sub = parts[1] || '';
    applyingHash = true;
    try {
      const wasKlant = klantId; halSp = k === 'hal' ? (SP.find(s => s.n === id) ? id : SP[0].n) : null; klantId = k === 'klant' ? id : null;
      $('hal').hidden = !halSp; $('klant').hidden = !klantId; root.classList.toggle('kiosk', !!(halSp || klantId));
      if (halSp) { renderHal(ctx, halSp); return; }
      if (klantId) { if (wasKlant !== klantId) { if (page) closePage(); if (view !== 'kaart') setView('kaart', true); const t = fleet.byId.get(klantId); if (t) { selTruck = t; follow = true; if (mapApi) { const s = stAt(t, state.simTime); mapApi.map.easeTo({ center: [s.pos.lon, s.pos.lat], zoom: 11, duration: FLY }); } } } renderKlant(ctx, klantId); return; }
      if (wasKlant && !klantId) { follow = false; selTruck = null; frame(true); }
      if (k === 'planbord' && id) { if (page) closePage(); ui.pbKlaar = id; if (view === 'planbord') renderView('planbord'); else setView('planbord', true); }
      else if (k === 'openritten') { if (page) closePage(); ui.or = ui.or || { sel: null, dag: 'vandaag' }; ui.or.sel = id || null; if (id) { const it = pool(ctx).find(x => x.id === id); if (it) ui.or.dag = it.dag === 'morgen' ? 'morgen' : 'vandaag'; } if (view === 'openritten') renderView('openritten'); else setView('openritten', true); }
      else if (k === 'charters') { if (page) closePage(); ui.pouleTab = id === 'oproep' ? 'oproep' : 'charters'; if (view === 'charters') renderView('charters'); else setView('charters', true); }
      else if (k === 'charter' && id) { if (!page && !explicit && view !== 'charters') setView('charters', true); openPage('charter', id); }
      else if (k === 'oproep' && id) { if (!page && !explicit && view !== 'charters') setView('charters', true); ui.pouleTab = ui.pouleTab || 'oproep'; openPage('oproep', id); }
      else if (HASH_VIEW[k] && !id) { if (page) closePage(); if (k === 'kaart' && (selTruck || selTrailer || selWinkel)) clearSel(); if (k === 'kaart' && panelMode === 'sp') closePanel(); setView(HASH_VIEW[k], true); }
      else if (k === 'standplaatsen' && id) { if (page) closePage(); ui.spSel = SP.find(s => s.n === id) ? id : null; setView('standplaatsen', true); }
      else if (k === 'assistent') { toggleAssist(true); }
      else if (k === 'rit' && id) { if (!page && view !== 'ritten' && !explicit) setView('ritten', true); openPage('rit', id); }
      else if (k === 'melding' && id) { if (!page && view !== 'meldingen' && !explicit) setView('meldingen', true); openPage('melding', id); }
      else if (k === 'voertuig' && fleet.byId.get(id)) { if (sub) { if (!page && !explicit && view !== 'voertuigen') setView('voertuigen', true); openPage('voertuig', id, TRUCK_TABS.find(x => x.toLowerCase() === sub.toLowerCase()) || TRUCK_TABS[0]); } else { if (page) closePage(); selectTruck(id); } }
      else if (k === 'oplegger' && fleet.trailerById.get(id)) { if (sub) { if (!page && !explicit && view !== 'opleggers') setView('opleggers', true); openPage('oplegger', id, TRAILER_TABS.find(x => x.toLowerCase() === sub.toLowerCase()) || TRAILER_TABS[0]); } else { if (page) closePage(); selectTrailer(id); } }
      else if ((k === 'persoon' || k === 'chauffeur') && people.byId.get(id)) { if (!page && !explicit && view !== 'chauffeurs') setView('chauffeurs', true); openPage('persoon', id, PERSON_TABS.find(x => x.toLowerCase() === sub.toLowerCase()) || PERSON_TABS[0]); }
      else if (k === 'standplaats') { const sp = SP.find(s => s.n === id); if (sp) { if (page) closePage(); selectSp(sp); } }
      else if (k === 'winkel' && id) { if (page) closePage(); selectWinkel(id); }
      else if (!k && !explicit) { if (page) closePage(); if (selTruck || selTrailer) clearSel(); }
    } catch (err) { console.warn('route', h, err); } finally { applyingHash = false; }
  }

  // ---------- werkgebied-wizard ----------
  const W = { step: 1, regios: new Set(), divs: new Set(), role: 'planner', sp: '' };
  let wizReturn = null;
  function openWizard(step) {
    if (profile) { W.regios = new Set(profile.regios || []); W.divs = new Set(profile.divs || Object.keys(DIV)); W.role = profile.role || role; W.sp = profile.sp || ''; } else { W.divs = new Set(Object.keys(DIV)); W.role = role; }
    W.step = step || 1; wizReturn = document.activeElement; $('wizard').hidden = false; renderWizard(true);
  }
  function closeWizard() { $('wizard').hidden = true; if (wizReturn && wizReturn.isConnected) wizReturn.focus({ preventScroll: true }); }
  function renderWizard(focusFirst) {
    const steps = [['Regio\'s', W.regios.size ? [...W.regios].join(', ') : 'heel Nederland'], ['Ritten', W.divs.size === Object.keys(DIV).length ? 'alle divisies' : `${W.divs.size} divisies`], ['Rol en standplaats', ROLES[W.role].n]];
    const stepHtml = steps.map(([n, s], i) => `<span class="${i + 1 < W.step ? 'done' : i + 1 === W.step ? 'cur' : ''}" ${i + 1 === W.step ? 'aria-current="step"' : ''}>${i + 1 < W.step ? ic('check', 13) : `${i + 1}.`} ${esc(n)}${i + 1 < W.step ? ` <span class="mut" style="font-weight:400">${esc(s)}</span>` : ''}</span>`).join('');
    let body = '';
    if (W.step === 1) body = `<h3>Welke regio's wil je zien?</h3><p class="hint">Je werkgebied bepaalt wat je standaard ziet: kaart, ritten, meldingen en tellers. Je past het later aan via het werkgebied in de topbalk.</p><div class="tcards" role="group" aria-label="Regio's">${[['Alle', 'Heel Nederland', `${SP.length} standplaatsen · ${fmt(fleet.trucks.length)} voertuigen`], ...REGIOS.map(r => [r, r, `${SP.filter(s => s.regio === r).length} standplaatsen · ${fmt(SP.filter(s => s.regio === r).reduce((a, s) => a + s.fleet, 0))} voertuigen`])].map(([k, n, d]) => { const onn = k === 'Alle' ? !W.regios.size : W.regios.has(k); return `<button class="tcard ${onn ? 'on' : ''}" type="button" role="checkbox" aria-checked="${onn}" data-regio="${esc(k)}"><i class="cb2 ${onn ? 'on' : ''}">${onn ? ic('check', 12) : ''}</i><b>${esc(n)}</b><span>${esc(d)}</span></button>`; }).join('')}</div>`;
    else if (W.step === 2) body = `<h3>Welke ritten wil je zien?</h3><p class="hint">Kies de divisies die bij je werk horen. Netwerk- en bulkritten lopen door het hele land; winkeldistributie blijft in de regio.</p><div class="tcards" role="group" aria-label="Divisies">${Object.entries(DIV).map(([k, d]) => `<button class="tcard ${W.divs.has(k) ? 'on' : ''}" type="button" role="checkbox" aria-checked="${W.divs.has(k)}" data-div="${k}"><i class="cb2 ${W.divs.has(k) ? 'on' : ''}">${W.divs.has(k) ? ic('check', 12) : ''}</i><b>${esc(d.n)}</b><span>${esc(DIVDESC[k])}</span></button>`).join('')}</div>`;
    else body = `<h3>Wie ben je?</h3><p class="hint">Je rol bepaalt wat je ziet: planners zien ritten en bevoegdheden, regiomanagers ook rijgedrag en schades, directie en HR ook contract en kosten. Kies eventueel je standplaats als startpunt.</p><div class="tcards" role="radiogroup" aria-label="Rol">${Object.entries(ROLES).map(([k, r]) => `<button class="tcard ${W.role === k ? 'on' : ''}" type="button" role="radio" aria-checked="${W.role === k}" data-role="${k}"><i class="cb2 round ${W.role === k ? 'on' : ''}"></i><b>${esc(r.n)}</b><span>${esc({ planner: 'Ritten, planbord, berichten, bevoegdheden', regiomanager: 'Plus rij-score, schades en kosten per km', directie: 'Alles, ook contract en kosten', hr: 'Personeel: bevoegdheden, schades, contract' }[k])}</span></button>`).join('')}</div><label class="flabel" for="wzSp" style="margin-top:12px">Standplaats als startpunt (optioneel)<select class="fld" id="wzSp"><option value="">Geen, begin bij de regio</option>${SP.slice().sort((a, b) => a.n.localeCompare(b.n)).map(s => `<option ${W.sp === s.n ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>`;
    $('wizard').innerHTML = `<div class="dlg wiz" role="dialog" aria-modal="true" aria-labelledby="wizTitle"><div class="dlg-h"><div class="wiz-logo"><img src="${logo}" alt="Simon Loos"><span id="wizTitle">Control Tower · je werkgebied</span></div>${profile ? `<button class="ib" type="button" id="wzX" aria-label="Sluiten">${ic('x', 18)}</button>` : ''}</div><div class="wsteps">${stepHtml}</div><div class="dlg-b">${body}</div><div class="dlg-f"><span class="hint grow" style="align-self:center">${W.step === 3 ? 'Alles is later aan te passen.' : `Stap ${W.step} van 3`}</span>${profile ? '<button class="btn" type="button" id="wzCancel">Annuleren</button>' : ''}${W.step > 1 ? '<button class="btn" type="button" id="wzBack">Terug</button>' : ''}<button class="btn pri" type="button" id="wzNext">${W.step === 3 ? 'Klaar' : 'Verder'}</button></div></div>`;
    const wz = $('wizard');
    on2(wz, '[data-regio]', c => { const k = c.dataset.regio; if (k === 'Alle') W.regios.clear(); else { W.regios.has(k) ? W.regios.delete(k) : W.regios.add(k); if (W.regios.size === REGIOS.length) W.regios.clear(); } renderWizard(); focusData('regio', k); });
    on2(wz, '[data-div]', c => { const k = c.dataset.div; if (W.divs.has(k) && W.divs.size > 1) W.divs.delete(k); else W.divs.add(k); renderWizard(); focusData('div', k); });
    on2(wz, '[data-role]', c => { W.role = c.dataset.role; renderWizard(); focusData('role', W.role); });
    const sp = $('wzSp'); if (sp) sp.onchange = e => { W.sp = e.target.value; };
    const b = $('wzBack'); if (b) b.onclick = () => { W.step--; renderWizard(true); };
    for (const id of ['wzCancel', 'wzX']) { const c = $(id); if (c) c.onclick = () => closeWizard(); }
    $('wzNext').onclick = () => { if (W.step < 3) { W.step++; renderWizard(true); return; } profile = { regios: [...W.regios], divs: [...W.divs], role: W.role, sp: W.sp }; store.set('sl-werkgebied', JSON.stringify(profile)); closeWizard(); applyProfile(); A.log(`stelde het werkgebied in: ${scopeLabel()}, ${divLabel()}`); L.toast(`Werkgebied opgeslagen: ${scopeLabel()}, ${divLabel()}, als ${ROLES[role].n.toLowerCase()}.`, { icon: 'pin' }); };
    if (focusFirst) { const f = wz.querySelector('.tcard.on') || wz.querySelector('.tcard') || $('wzNext'); if (f) f.focus({ preventScroll: true }); }
  }
  function on2(el, sel, fn) { el.querySelectorAll(sel).forEach(x => x.addEventListener('click', () => fn(x))); }
  function focusData(k, v) { const x = $('wizard').querySelector(`[data-${k}="${CSS.escape(v)}"]`); if (x) x.focus({ preventScroll: true }); }

  // ---------- zaken: menu's voor toewijzen en status ----------
  // planners van de standplaatsen van de zaken (of van het werkgebied), wie nu dienst heeft eerst; het team van de
  // control tower staat er altijd bij
  function collegasVoor(spns) {
    const T = ((state.simTime % 1440) + 1440) % 1440; const set = new Set(spns && spns.length ? spns : spsInScope().map(s => s.n));
    const op = p => T >= p.a && T < p.b;
    return people.planners.filter(p => p.team || set.has(p.sp)).sort((a, b) => (op(b) - op(a)) || (!!a.team - !!b.team) || a.sp.localeCompare(b.sp, 'nl') || a.a - b.a);
  }
  function assignMenu(b, zs) {
    const me = A.settings.naam(); const T = ((state.simTime % 1440) + 1440) % 1440;
    const voor = zs.length === 1 && !zs[0].who ? people.plannerVoor(zs[0].spn, zs[0].div, state.simTime) : null;
    const lijst = collegasVoor([...new Set(zs.map(z => z.spn))]).filter(p => p !== voor).slice(0, 14);
    const item = (c2, tag) => { const onD = T >= c2.a && T < c2.b; return `<button class="menu-i" type="button" data-who="${esc(c2.n)}"><span class="av sm">${esc(initials(c2.n))}</span><span class="grow">${esc(c2.n)}${tag ? ` <span class="badge sm b-ok">${tag}</span>` : ''}<small>${esc(c2.rol)}${c2.team ? '' : ` · ${esc(c2.sp)}`} · ${onD ? `op dienst tot ${hhmm(c2.b)}` : `dienst ${hhmm(c2.a)}–${hhmm(c2.b)}`}</small></span></button>`; };
    L.openPop(b, `<div class="menu-h">Toewijzen${zs.length > 1 ? ` (${zs.length})` : ''}</div><button class="menu-i" type="button" data-who="${esc(me)}">${ic('user', 16)}<span class="grow">Aan mij<small>${esc(me)}</small></span></button>${voor ? item(voor, 'voorgesteld') : ''}<div class="menu-scroll">${lijst.map(c2 => item(c2)).join('')}</div><div class="menu-sep"></div><button class="menu-i" type="button" data-who="">${ic('x', 16)}<span class="grow">Niemand</span></button>`, {
      label: 'Toewijzen', onBind: p => on(p, 'click', '[data-who]', (e, x) => { L.closePop(); Z.assign(zs, x.dataset.who); if (ui.meldTable) ui.meldTable.clearSel(); }),
    });
  }
  // status van een of meer zaken; "Wacht op" met een reden en de tijd tot de zaak terugkomt. alleen = 'wacht' toont
  // alleen de redenen (vanuit de statusbalk)
  function statusMenu(b, zs, alleen) {
    const items = [
      !alleen && ['behandeling', 'In behandeling', 'half', '', ''],
      ...['chauffeur', 'klant', 'garage', 'collega'].map(r => ['wacht', `Wacht op ${WACHT[r][0]}`, 'snooze', WACHT[r][1], r]),
      !alleen && ['opgelost', 'Opgelost', 'okc', '', ''],
      !alleen && ['nieuw', 'Terug naar nieuw', 'circle', '', ''],
    ].filter(Boolean);
    L.openPop(b, `<div class="menu-h">${alleen ? 'Wacht op' : 'Status'}${zs.length > 1 ? ` (${zs.length})` : ''}</div>${items.map(([s2, n, i, m, r]) => `<button class="menu-i" type="button" data-zs="${s2}" data-m="${m}" data-r="${r}">${ic(i, 16)}<span class="grow">${esc(n)}${s2 === 'wacht' ? `<small>komt terug na ${durTxt(m)}</small>` : ''}</span></button>`).join('')}`, {
      label: alleen ? 'Wacht op' : 'Status', onBind: p => on(p, 'click', '[data-zs]', (e, x) => { L.closePop(); Z.setStatus(zs, x.dataset.zs, +x.dataset.m || 0, x.dataset.r || null, { mij: x.dataset.zs === 'behandeling' }); if (ui.meldTable) ui.meldTable.clearSel(); }),
    });
  }
  // een gefilterde lijst openen (de slimme knoppen op detailpagina's): de weergave met het zoekveld ingevuld
  const TABEL = { ritten: () => ui.ritTable, meldingen: () => ui.meldTable, voertuigen: () => ui.vTable, opleggers: () => ui.oTable, chauffeurs: () => ui.cTable };
  function openList(v, q) {
    if (!TABEL[v]) { navTo(v); return; }
    if (v === 'meldingen') ui.meldTab = 'alle';
    navTo(v); if (!TABEL[v]()) renderView(v);
    const tb = TABEL[v](); if (tb) tb.setSearch(q);
  }
  // gebeurtenissen van een rit: mijlpalen uit het plan tot nu, acties van de planner en berichten
  function ritLog(r) {
    const T = state.simTime; const rs = R.stateOf(r, T, S); const at = rs.at; const out = []; const t = r.t;
    if (at >= r.dep) out.push({ T: r.dep, txt: `Vertrokken van ${t.base.n}${r.tr ? ` met ${r.tr.id}` : ''}`, sub: r.driver });
    for (const x of r.stops) { if (at >= x.arr) out.push({ T: x.arr, txt: `Aangekomen bij ${x.name}`, sub: x.win ? (x.arr > x.win[1] ? `${Math.round(x.arr - x.win[1])} min na het venster (${hhmm(x.win[0])}–${hhmm(x.win[1])})` : `binnen het venster ${hhmm(x.win[0])}–${hhmm(x.win[1])}`) : '' }); if (at >= x.dep) out.push({ T: x.dep, txt: `Vertrokken bij ${x.name}`, sub: x.swap ? `${x.swap.drop.id} bleef achter` : `lossen ${Math.round(x.dep - x.arr)} min` }); }
    if (at >= r.end) out.push({ T: r.end, txt: `Terug op ${t.base.n}`, sub: '' });
    for (const l of A.acts.log) if ((l.t === t.id || (l.zaak && l.zaak.split(':')[1] === t.id)) && l.T >= r.dep - 60 && l.T <= r.end + 30) out.push({ T: l.T, txt: `${l.who} ${l.txt}`, act: true });
    for (const m of t.msgs || []) if (m.T >= r.dep - 30 && m.T <= r.end + 30) out.push({ T: m.T, txt: m.me ? `Bericht aan ${r.driver || 'chauffeur'}` : `Antwoord van ${(r.driver || 'chauffeur').split(' ')[0]}`, sub: m.text, act: m.me });
    return out.sort((a, b) => b.T - a.T);
  }

  // ---------- sneltoetsen ----------
  function showKeys() {
    const k = (a, b) => `<div><span>${esc(b)}</span><span>${a.split(' ').map(x => `<span class="kbd">${esc(x)}</span>`).join('')}</span></div>`;
    L.openDialog(`<div class="dlg-h"><h2>Sneltoetsen</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div><div class="dlg-b"><div class="keys">${[['/', 'Zoeken'], ['Ctrl K', 'Zoeken'], ['?', 'Dit overzicht'], ['Esc', 'Sluiten of terug'], ['1', 'Overzicht'], ['2', 'Kaart'], ['3', 'Ritten'], ['4', 'Meldingen'], ['5', 'Planbord'], ['6', 'Voertuigen'], ['7', 'Opleggers'], ['8', 'Chauffeurs'], ['9', 'Standplaatsen'], ['0', 'Laden'], ['m', 'Meldingen'], ['a', 'Assistent'], ['f', 'Volg het gekozen voertuig'], ['o', 'Losse opleggers op de kaart'], ['b', 'Bezorgbussen op de kaart'], ['d', '3D-wereld'], ['[', 'Menu in- of uitklappen'], ['↑ ↓', 'Rijen in een tabel'], ['Enter', 'Rij of suggestie openen'], ['Spatie', 'Rij selecteren']].map(([a, b]) => k(a, b)).join('')}</div><p class="hint">Ingebed in een andere pagina werken de toetsen zodra je in de app hebt geklikt.</p></div>`, { label: 'Sneltoetsen' });
  }
  document.addEventListener('keydown', e => {
    // Ingebed in een pagina: alleen toetsen met de focus in de app tellen (een klik in de app geeft de root de focus).
    if (embedded && !(e.target instanceof Element && root.contains(e.target))) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
    if (e.key === 'Escape') {
      if (L.popOpen()) return; // de popover sluit zichzelf
      if (L.dialogOpen()) { L.closeDialog(); return; }
      if (!$('wizard').hidden) { if (profile) closeWizard(); return; }
      if (search.isOpen()) { search.close(); return; }
      if (typing) { e.target.blur(); return; }
      if (halSp || klantId) { hashTo(''); return; }
      if (page) { back(); return; }
      if (selTruck || selTrailer || selWinkel || selRest) { clearSel(); return; }
      if (panelOpen()) { closePanel(); syncHash(); return; }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || !$('wizard').hidden || L.dialogOpen()) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.matches('[data-open][tabindex]:not(button)')) { e.preventDefault(); go(e.target.dataset.open); return; }
    if (halSp || klantId) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key === '?') { e.preventDefault(); showKeys(); }
    else if (KEYS.includes(e.key) && VIEWS[KEYS.indexOf(e.key)]) navTo(VIEWS[KEYS.indexOf(e.key)][0]);
    else if (e.key === 'm') navTo('meldingen');
    else if (e.key === 'a') toggleAssist();
    else if (e.key === 'f' && selTruck) toggleFollow();
    else if (e.key === 'o') setTrailersOnMap(!trailersOnMap);
    else if (e.key === 'b') setBussenOnMap(!F.bussen);
    else if (e.key === 'd') set3dMode(!three);
    else if (e.key === '[') toggleNav();
  });
  function toggleNav() { const c = root.classList.toggle('nav-c'); store.set('sl-nav', c ? 'c' : ''); nav.renderSide(); setTimeout(() => { try { mapApi && mapApi.map.resize(); } catch { /* */ } }, 220); }
  function toggleTheme() { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; state.theme = t; store.set('sl-theme', t); if (mapApi) mapApi.setTheme(t); nav.renderTop(); refreshAll(); }
  // simulatieklok
  function setTime(T) { state.simTime = ((T % 1440) + 1440) % 1440; ui.pbVolg = true; frame(true); }
  function setPlaying(v) { state.playing = !!v; nav.renderTop(); K.updateTimebar(ctx); }
  function setSpeed(s) { state.speed = s; state.playing = true; nav.renderTop(); K.updateTimebar(ctx); }
  function setNow() { const n = new Date(); setTime(n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60); L.toast(`Terug naar de echte klok: ${hhmm(state.simTime)}.`, { icon: 'clock' }); }

  // ---------- context voor de weergaven ----------
  const ctx = {
    fleet, state, store, people, rest, lostijden, root, F, S, TRS, $, esc, ic, L, A, ui, DIV, VST, KIND, TRT, feed, chat, embedded, stAt,
    role: () => role, can, theme: () => root.dataset.theme || 'light', profile: () => profile, setRole, narrow,
    inScope, inScopeBase, visible: t => visible(t, S.get(t.id) || {}), scopeLabel, divLabel, scopeKey, spsInScope, driverName, trailerState, fmtDrive,
    counts: () => counts, kpi: () => kpi, exceptions: () => exceptions, msgCount: () => msgCount, applied: A.acts.applied, collegas: spns => collegasVoor(spns),
    view: () => view, navCurrent, navTo, setView, go, back, title, openPage, closePage, rerenderPage: () => renderPage(true), renderPanel, openPanel, closePanel, panelOpen, panelMode: () => panelMode, toggleAssist,
    selectTruck, selectTrailer, selectSp, selectRest, selectWinkel, selectPlace, toonPoolrit, flyTo, clearSel, selTruck: () => selTruck, selTrailer: () => selTrailer, follow: () => follow, toggleFollow,
    trailersOnMap: () => trailersOnMap, setTrailersOnMap, restOnMap: () => restOnMap, setRestOnMap, bussenOnMap: () => F.bussen, setBussenOnMap, three: () => three, set3dMode, mapApi: () => mapApi, dockMap, vliegBijDock, showTrucksOnMap, showTrailersOnMap,
    sendMsg, bulkMessage, shareLink, runAction, applyProposal, voorstellen, voorstelVoor, voorstelById, assignMenu, statusMenu, refreshAll, frame, hashTo, syncHash, fullscreen,
    pbSp: () => pbSp, setPbSp: sp => { pbSp = sp; }, clearSps, savedViews, saveView, deleteView, applyView, openWizard, showKeys, toggleTheme, toggleNav,
    setTime, setPlaying, setSpeed, setNow, ritLog, objCard: (k, o) => K.objCard(ctx, k, o), logAct: txt => A.log(txt), mountSearch: el => search.mount(el),
  };
  const R = createRitten(fleet); ctx.R = R;
  const Z = createZaken(ctx); ctx.Z = Z;
  const M = createMetrics(ctx); ctx.M = M;
  const nav = createNav(ctx); const search = createSearch(ctx); ctx.search = search;

  // klik op een element met data-open (overal in de app) navigeert; data-back gaat een stap terug
  root.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    const b = t.closest('[data-back]'); if (b && root.contains(b)) { e.preventDefault(); back(); return; }
    const o = t.closest('[data-open]'); if (o && root.contains(o) && !o.closest('#zoekL')) { e.preventDefault(); go(o.dataset.open); }
  });
  // bellen in de demo: geen tel:-link; de knop toont het gesimuleerde nummer (in de vangfase, voor een weergave opnieuw tekent)
  root.addEventListener('click', e => {
    const bl = e.target instanceof Element ? e.target.closest('[data-bel]') : null; if (!bl || !root.contains(bl)) return;
    e.preventDefault(); L.toast(`${bl.dataset.wie ? `${bl.dataset.wie}: ` : ''}${bl.dataset.bel}. Demo: er wordt niet gebeld, het nummer is gesimuleerd.`, { icon: 'phone', ms: 8000 });
  }, true);
  on($('panel'), 'click', '#closePanel', () => { const m = panelMode; closePanel(); if (m === 'truck' || m === 'trailer' || m === 'sp' || m === 'winkel') { selTruck = null; selTrailer = null; selSp = null; selWinkel = null; syncHash(); } });
  on($('panel'), 'click', '[data-grab]', () => $('panel').classList.toggle('big'));
  // een voertuig in het paneel aanwijzen (vertrekken, terrein, berichten): de kaart zet er een halo onder (mapApi.setHover)
  const halo = id => { if (mapApi && mapApi.setHover && !mapApi.noWebGL && view === 'kaart') mapApi.setHover(id); };
  $('panel').addEventListener('mouseover', e => { const b = e.target instanceof Element ? e.target.closest('[data-open^="kaart:truck:"]') : null; if (b) halo(b.dataset.open.slice(12)); });
  $('panel').addEventListener('mouseout', e => { const b = e.target instanceof Element ? e.target.closest('[data-open^="kaart:truck:"]') : null; if (b && !(e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) halo(null); });
  if (embedded) { root.tabIndex = -1; root.addEventListener('pointerdown', () => { if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); }); }
  let rsz = null; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { refreshAll(); }, 150); });

  function attachMap(api) {
    mapApi = api; K.mountTimebar(ctx); K.bindMapbar(ctx);
    on($('maptools'), 'click', '#layersBtn', (e, b) => K.layersMenu(ctx, b));
    on($('maptools'), 'click', '#threeBtn', () => set3dMode(!three));
    on($('maptools'), 'click', '#homeBtn', () => flyToScope());
    api.whenReady(() => {
      K.renderMaptools(ctx); frame(true); if (view === 'kaart') flyToScope();
      // klik op een DC of winkel: de kaart meldt dat via onSelectPlace als main.js die optie meegeeft (dan is de klik al
      // afgehandeld); anders vangt dit de klik op de laag op. Een voertuig erboven gaat voor.
      if (!api.noWebGL && api.map && api.map.getLayer) for (const lid of ['dc', 'winkel']) if (api.map.getLayer(lid)) api.map.on('click', lid, e => { if (e.defaultPrevented || !e.features || !e.features.length) return; if (api.pick && api.pick(e.point)) return; const id = e.features[0].properties && e.features[0].properties.id; if (id) selectPlace({ id }); });
    });
  }
  function start() {
    nav.bind(); nav.renderSide(); nav.renderBottom(); nav.renderTop();
    restoreActs(); R.bump();
    window.addEventListener('popstate', () => { if (readHash() !== currentHash()) onHash(); });
    window.addEventListener('hashchange', () => { if (readHash() !== currentHash()) onHash(); });
    if (profile) applyProfile(false); else openWizard(1);
    if (location.hash.length > 1) onHash(); else setView('overzicht', true);
    if (!location.hash || location.hash.length <= 1) replaceHash('#' + currentHash());
    frame(true);
    if (three && mapApi && mapApi.has3d()) { three = false; mapApi.whenReady(() => set3dMode(true)); }
  }
  return { attachMap, frame, selectTruck, selectTrailer, selectSp, selectRest, selectPlace, hover, notice: msg => L.toast(msg, { icon: 'info' }), start, openWizard, setView, openSheet: (kind, id, tab) => openPage(kind === 'truck' ? 'voertuig' : kind === 'trailer' ? 'oplegger' : kind, id, tab), runAction, ctx };
}
