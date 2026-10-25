// Weergaven: standplaatsen (lijst plus vertrekbord, docks als tijdbalk per dock, wat er op het terrein staat en de
// gegevens uit de vacature), het hal-scherm (tv in de loods) en de klant-link (alleen dit voertuig en de volgende
// levering). Het planbord staat in src/ui/planbord.js.
import { SP, DIV, dcById, plekNaam, laadpunten } from './places.js';
import { KIND, TRT } from './fleet.js';
import { esc, ic, fmt, hhmm, day, durTxt, nl1, plate, empty, on, kv, stBadge, VST, TST, ritBadge, swap, lateBy, adresTxt, datumTxt, meter, kortStop } from './ui/base.js';
import { depStatus, depBadge } from './ui/overzicht.js';
import logo from './assets/logo.png';

// ---------- standplaatsen ----------
export function renderStandplaatsen(ctx, el) {
  const { fleet, state, S, TRS, people } = ctx; const T = state.simTime; const ui = ctx.ui;
  const list = ctx.spsInScope().slice().sort((a, b) => b.fleet - a.fleet);
  if (!ui.spSel || !list.some(s => s.n === ui.spSel)) ui.spSel = ui.spSel && SP.find(s => s.n === ui.spSel) ? ui.spSel : (list[0] || SP[0]).n;
  const sp = SP.find(s => s.n === ui.spSel); const tab = ui.spTab || 'vertrekbord';
  if (!el.querySelector('.spl')) {
    el.innerHTML = `<div class="spl" data-sp="root"><div class="spl-l"><div class="fsearch">${ic('search', 15)}<input class="fld" type="search" id="spQ" placeholder="Zoek standplaats" aria-label="Zoek standplaats" autocomplete="off"></div><div class="spl-list" data-sp="list" role="listbox" aria-label="Standplaatsen"></div></div><div class="spl-d" data-sp="det"></div></div>`;
    on(el, 'click', '[data-spi]', (e, b) => { ui.spSel = b.dataset.spi; ui.spDet = true; renderStandplaatsen(ctx, el); ctx.syncHash(); const d = el.querySelector('.spl-d'); if (d) d.scrollTop = 0; });
    on(el, 'input', '#spQ', () => renderStandplaatsen(ctx, el));
    on(el, 'click', '[data-sptab]', (e, b) => { ui.spTab = b.dataset.sptab; renderStandplaatsen(ctx, el); const f = el.querySelector(`[data-sptab="${ui.spTab}"]`); if (f) f.focus(); });
    on(el, 'click', '[data-hal]', (e, b) => { ctx.go(`hal/${b.dataset.hal}`); ctx.fullscreen(); });
    on(el, 'click', '[data-pbopen]', (e, b) => { ctx.setPbSp(SP.find(s => s.n === b.dataset.pbopen)); ctx.navTo('planbord'); });
    on(el, 'click', '[data-splist]', () => { ui.spDet = false; renderStandplaatsen(ctx, el); });
  }
  el.querySelector('.spl').classList.toggle('det', !!ui.spDet);
  const q = (el.querySelector('#spQ') || {}).value || '';
  const zc = new Map(); for (const z of ctx.Z.scoped()) if (z.open) zc.set(z.spn, (zc.get(z.spn) || 0) + 1);
  const lh = list.filter(s => !q || s.n.toLowerCase().includes(q.toLowerCase()) || String(s.klant).toLowerCase().includes(q.toLowerCase())).map(s => { let onw = 0; for (const t of fleet.trucks) { if (t.base !== s) continue; const st = (S.get(t.id) || {}).st; if (st && st !== 'terrein') onw++; } const z = zc.get(s.n) || 0;
    return `<button class="spl-i ${s.n === ui.spSel ? 'on' : ''}" type="button" role="option" aria-selected="${s.n === ui.spSel}" data-spi="${esc(s.n)}"><b>${esc(s.n)}</b><span>${esc(s.klant)} · ${s.fleet} voertuigen, ${onw} onderweg</span>${z ? `<span class="badge b-bad sm" title="${z} open meldingen">${z}</span>` : ''}</button>`; }).join('') || `<div style="padding:16px">${empty('Geen standplaats gevonden', 'Pas de zoekterm of je werkgebied aan.')}</div>`;
  swap(el.querySelector('[data-sp=list]'), lh);
  // detail
  const mine = fleet.trucks.filter(t => t.base === sp); let inzet = 0, onw = 0; for (const t of mine) { if (t.vandaag === 'inzet') inzet++; const st = (S.get(t.id) || {}).st; if (st && st !== 'terrein') onw++; }
  const trs = fleet.trailersOf(sp); const tc = { gekoppeld: 0, geladen: 0, wacht: 0, ophalen: 0, leeg: 0, klaar: 0, onderhoud: 0 }; for (const tr of trs) { const s = TRS.get(tr.id); if (s) tc[s.st]++; }
  const deps = fleet.departures(sp, T - 5, 185); const dep60 = deps.filter(d => d.at >= T - 1 && d.at <= T + 60).length;
  const plekken = (sp.rijen || []).reduce((a, r) => a + (r[4] || 0), 0);
  const srcLine = sp.bron ? `<div class="src">Bron: <a href="${esc(sp.bron)}" target="_blank" rel="noopener noreferrer">vacature op werkenbijsimonloos.nl</a>${sp.datum ? `, ${esc(datumTxt(sp.datum))}` : ''}</div>` : '';
  let body = '';
  if (tab === 'vertrekbord') {
    // vaste kolommen die in hun vak passen; is het vak smaller, dan vallen eerst oplegger, chauffeur en dock weg en op een
    // telefoon staat de bestemming onder het voertuig (style.css, .vb-t): de status valt nooit buiten beeld
    body = `<div class="pg-sec"><h2>Vertrekbord <span class="sub">komende 3 uur · ${fmt(deps.length)} vertrekken</span><span class="act"><button class="btn sm" type="button" data-hal="${esc(sp.n)}">${ic('tv', 15)}Open als hal-scherm</button></span></h2>${deps.length ? `<div class="vb-box"><table class="tbl plain vb vb-t"><thead><tr><th class="c-vt">Vertrek</th><th class="c-vg">Voertuig</th><th class="c-opl">Oplegger</th><th class="c-chf">Chauffeur</th><th class="c-best">Bestemming</th><th class="c-dock r">Dock</th><th class="c-st">Status</th></tr></thead><tbody>${deps.map(d => { const cd = depStatus(d, T, S); const r = ctx.R.ofTruck(d.t).find(x => Math.abs(x.dep - d.at) < 1 || Math.abs(day(x.dep - d.at)) < 1); const wie = d.driver ? (d.dienst && d.dienst.person ? d.dienst.person.short : d.driver) : '';
      return `<tr class="click ${cd.cls}" tabindex="0" role="link" data-open="${r ? `rit/${esc(r.id)}` : `kaart:truck:${esc(d.t.id)}`}" aria-label="${esc(`Vertrek ${hhmm(d.at)}, ${d.t.id}${d.tr ? ` met ${d.tr.id}` : ''}${wie ? `, ${wie}` : ''}, naar ${d.dest}${d.dock ? `, dock ${d.dock}` : ''}, ${cd.status}`)}"><td class="cd c-vt"><b>${hhmm(d.at)}</b> <small>${esc(cd.text)}</small></td><td class="c-vg">${plate(d.t.id)}<small class="vb-best">${esc(kortStop(d.dest))}</small></td><td class="c-opl">${d.tr ? esc(d.tr.id) : d.t.kind === 'trekker' ? '<span class="mut">solo</span>' : '<span class="mut">–</span>'}</td><td class="c-chf" title="${esc(wie)}">${wie ? esc(wie) : '<span class="mut">–</span>'}</td><td class="c-best" title="${esc(d.dest)}">${esc(kortStop(d.dest))}</td><td class="c-dock r">${d.dock || '<span class="mut">–</span>'}</td><td class="c-st">${depBadge(cd)}</td></tr>`; }).join('')}</tbody></table></div>` : empty('Geen vertrekken in de komende drie uur', 'Het planbord laat zien wanneer de volgende diensten beginnen.', `<button class="btn sm" type="button" data-pbopen="${esc(sp.n)}">Naar het planbord</button>`, 'clock')}</div>`;
  } else if (tab === 'docks') {
    // de dockplanning van de standplaats (fleet.dockPlan): koppelen, laden aan het dock en retouren, per dock
    const W0 = Math.floor((T - 60) / 30) * 30, SPAN = 360; const pos = m => ((m - W0) / SPAN * 100).toFixed(2) + '%';
    const D = fleet.dockPlan ? fleet.dockPlan(sp) : []; const N = sp.docks || D.length;
    const rij = D.map(x => ({ dock: x.dock, L: x.blokken.filter(k => k.t1 > W0 && k.t0 < W0 + SPAN) }));
    for (const r of rij) for (let i = 1; i < r.L.length; i++) if (r.L[i].t0 < r.L[i - 1].t1) { r.L[i].clash = true; r.L[i - 1].clash = true; }
    const gebruikt = rij.filter(r => r.L.length); const nu = rij.filter(r => r.L.some(k => k.t0 <= T && k.t1 > T)).length;
    const clashes = rij.reduce((n, r) => n + r.L.filter(k => k.clash).length, 0);
    const hrs = []; for (let m = W0; m <= W0 + SPAN; m += 60) hrs.push(m);
    const SRT = { vertrek: 'koppelen', laden: 'laden', aankomst: 'retouren' };
    const blok = k => { const t = fleet.byId.get(k.voertuig); const r = ctx.R.vanNr ? ctx.R.vanNr(t, k.rit) : null; return `<button class="dk-b s-${esc(k.soort || 'laden')} ${k.clash ? 'clash' : ''} ${k.t1 < T ? 'gone' : ''}" type="button" data-open="${r ? `rit/${esc(r.id)}` : `kaart:truck:${esc(k.voertuig)}`}" style="left:${pos(Math.max(k.t0, W0))};width:calc(${((Math.min(k.t1, W0 + SPAN) - Math.max(k.t0, W0)) / SPAN * 100).toFixed(2)}% - 2px)" title="${esc(`${k.voertuig}${k.oplegger ? ` + ${k.oplegger}` : ''} · ${SRT[k.soort] || k.soort} ${hhmm(k.t0)}–${hhmm(k.t1)}${r ? ` · rit ${r.id}` : ''}${k.clash ? ' · overlapt met een ander blok' : ''}`)}">${esc(k.voertuig)}</button>`; };
    body = `<div class="pg-sec"><h2>Docks <span class="sub">${fmt(N)} docks · koppelen, laden en retouren · ${hhmm(W0)} tot ${hhmm(W0 + SPAN)}</span></h2>
      <div class="dk-sum"><div><b>${fmt(nu)}</b><span>nu in gebruik</span></div><div><b>${fmt(gebruikt.length)}</b><span>gebruikt in dit venster</span></div><div><b>${fmt(N - gebruikt.length)}</b><span>vrij in dit venster</span></div><div class="dk-leg"><span><i class="s-vertrek"></i>Koppelen</span><span><i class="s-laden"></i>Laden</span><span><i class="s-aankomst"></i>Retouren</span></div></div>
      ${clashes ? `<div class="note warn" style="margin-bottom:12px">${ic('alert', 16)}<div><b>${clashes} dockblokken overlappen</b><div>Twee voertuigen staan tegelijk aan hetzelfde dock. Schuif een vertrek op het planbord of zet het op een vrij dock.</div></div></div>` : ''}
      ${gebruikt.length ? `<div class="docks" role="table" aria-label="Docks"><div class="dk-h" role="row"><span role="columnheader">Dock</span><div class="dk-t">${hrs.map(m => `<i class="hr" style="left:${pos(m)}"><span>${hhmm(m)}</span></i>`).join('')}</div></div>${gebruikt.map(r => `<div class="dk-r" role="row"><span role="cell"><b>Dock ${r.dock}</b></span><div class="dk-t" role="cell">${hrs.map(m => `<i class="hr" style="left:${pos(m)}"></i>`).join('')}${r.L.map(blok).join('')}<div class="dk-now" style="left:${pos(T)}"></div></div></div>`).join('')}</div>` : empty('Geen dockblokken in dit venster', 'Er wordt nu niet gekoppeld, geladen of geretourneerd aan een dock.', '', 'dock')}
      <p class="hint" style="margin-top:8px">Alleen docks met werk in dit venster staan erin. Koppelen is de trekker met zijn oplegger aan het dock voor vertrek, laden is een bakwagen of bus aan het dock, retouren is afkoppelen en lossen na de rit. Het aantal docks per standplaats is een schatting.</p></div>`;
  } else if (tab === 'gegevens') {
    const laad = sp.laad ? dcById.get(sp.laad) : null, pendel = sp.pendel ? dcById.get(sp.pendel) : null;
    body = `<div class="pg-cols"><div class="pg-main"><div class="pg-sec"><h2>Gegevens</h2>${kv([
      ['Adres', sp.adres ? esc(adresTxt(sp.adres)) : '<span class="mut">onbekend</span>'],
      sp.adresNoot && ['Over het adres', `<span class="mut">${esc(sp.adresNoot)}</span>`],
      ['Provincie en regio', esc(sp.prov === sp.regio ? sp.prov : `${sp.prov}, regio ${sp.regio}`)],
      ['Klant volgens de vacature', esc(sp.klant)],
      ['Divisies', esc(sp.div.map(d => DIV[d].n).join(', '))],
      sp.formules && sp.formules.length && ['Formules', `${esc(sp.formules.join(', '))} <small>winkelritten</small>`],
      laad && ['Laden', `Winkelritten laden eerst bij ${esc(plekNaam(laad))}`],
      pendel && ['Pendel', `De helft van de winkelritten rijdt als LZV-pendel naar ${esc(plekNaam(pendel))}`],
      sp.note && ['Bijzonder', esc(sp.note)],
      ['Terrein', plekken ? `${fmt(plekken)} parkeerplekken in ${(sp.rijen || []).length} rijen` : '<span class="mut">geen parkeerrijen bekend</span>'],
      ['Laadpunten', `${laadpunten(sp)} <small>voor elektrische voertuigen</small>`],
      ['Vloot', `${fmt(sp.fleet)} voertuigen · ${fmt(trs.length)} opleggers`],
      sp.vac && ['Vacatures', `${sp.vac} open op het moment van de bron`],
    ])}${srcLine}</div></div><div class="pg-side"><div class="pg-sec"><h2>Op de kaart</h2><p class="hint" style="margin-bottom:10px">Terrein, poort en parkeerrijen staan op de kaart; zoom in op de standplaats.</p><button class="btn sm" type="button" data-open="kaart:sp:${esc(sp.n)}">${ic('map', 15)}Toon op de kaart</button></div></div></div>`;
  } else {
    const yardV = mine.filter(t => (S.get(t.id) || {}).st === 'terrein'); const g = { klaar: [], tussen: [], reserve: [], werkplaats: [] };
    for (const t of yardV) { const s = S.get(t.id); if (t.vandaag === 'reserve') g.reserve.push(t); else if (t.vandaag === 'onderhoud') g.werkplaats.push(t); else if (s.upcoming && day(s.upcoming.start - T) <= 120) g.klaar.push(t); else g.tussen.push(t); }
    const yT = trs.map(tr => [tr, TRS.get(tr.id)]).filter(([, s]) => s && (s.st === 'klaar' || s.st === 'leeg' || s.st === 'onderhoud'));
    const onDuty = people.persons.filter(p => p.base === sp && p.dienst && p.dienst.d.start <= T && T < p.dienst.d.end); const soon = people.persons.filter(p => p.base === sp && p.dienst && p.dienst.d.start > T && p.dienst.d.start - T <= 120);
    const chips = (L, f, n = 24) => L.length ? `<div class="ychips">${L.slice(0, n).map(f).join('')}${L.length > n ? `<span class="chip" style="pointer-events:none">+${L.length - n}</span>` : ''}</div>` : '<p class="hint">geen</p>';
    const vchip = t => `<button class="chip" type="button" data-open="kaart:truck:${esc(t.id)}">${esc(t.id)}</button>`;
    const bezet = yardV.length + yT.length;
    body = `${plekken ? `<div class="yardcap"><div><b>${fmt(bezet)}</b> <span>van ${fmt(plekken)} parkeerplekken bezet</span></div>${meter(bezet / plekken, bezet > plekken * 0.92 ? 'bad' : bezet > plekken * 0.8 ? 'warn' : 'mut')}<span class="hint">${fmt(yardV.length)} voertuigen en ${fmt(yT.length)} opleggers op het terrein · ${(sp.rijen || []).length} parkeerrijen</span></div>` : ''}<div class="yardg"><section class="card"><div class="card-h"><h3>${ic('truck', 16)}Voertuigen <span class="sub">${yardV.length} op het terrein</span></h3></div><div class="card-b"><div class="sec-t">Vertrekken binnen 2 uur <span class="mut">${g.klaar.length}</span></div>${chips(g.klaar, vchip)}<div class="sec-t">Tussen diensten of klaar voor vandaag <span class="mut">${g.tussen.length}</span></div>${chips(g.tussen, vchip)}<div class="sec-t">Reserve <span class="mut">${g.reserve.length}</span></div>${chips(g.reserve, vchip)}<div class="sec-t">Werkplaats <span class="mut">${g.werkplaats.length}</span></div>${chips(g.werkplaats, vchip)}</div></section>
      <section class="card"><div class="card-h"><h3>${ic('trailer', 16)}Opleggers <span class="sub">${yT.length} op het terrein</span></h3></div><div class="card-b">${['klaar', 'leeg', 'onderhoud'].map(st => { const L = yT.filter(([, s]) => s.st === st).map(([tr]) => tr); return `<div class="sec-t">${esc(TST[st].n)} <span class="mut">${L.length}</span></div>${chips(L, tr => `<button class="chip" type="button" data-open="kaart:trailer:${esc(tr.id)}" title="${esc(TRT[tr.type].n)}">${esc(tr.id)} <span class="n">${esc(TRT[tr.type].n.replace('oplegger', '').replace('Gesloten ', 'gesl.').trim().toLowerCase())}</span></button>`, 18)}`; }).join('')}</div></section>
      <section class="card"><div class="card-h"><h3>${ic('users', 16)}Chauffeurs</h3></div><div class="card-b"><div class="sec-t">Op dienst <span class="mut">${onDuty.length}</span></div>${chips(onDuty, p => `<button class="chip" type="button" data-open="persoon/${esc(p.id)}">${esc(p.short)} <span class="n">${esc(p.dienst.t.id)}</span></button>`, 18)}<div class="sec-t">Beginnen binnen 2 uur <span class="mut">${soon.length}</span></div>${chips(soon, p => `<button class="chip" type="button" data-open="persoon/${esc(p.id)}">${esc(p.short)} <span class="n">${hhmm(p.dienst.d.start)}</span></button>`, 18)}</div></section></div>`;
  }
  const st = people.spStats.get(sp.n); const zs = zc.get(sp.n) || 0;
  const laadDc = sp.laad ? dcById.get(sp.laad) : null, pendelDc = sp.pendel ? dcById.get(sp.pendel) : null;
  const bijz = [laadDc && `Winkelritten laden eerst bij ${plekNaam(laadDc)}.`, pendelDc && `De helft van de winkelritten rijdt als LZV-pendel naar ${plekNaam(pendelDc)}.`].filter(Boolean);
  const det = `<div class="pg"><div class="pg-bar">${ctx.narrow() ? `<button class="btn sm" type="button" data-splist="1">${ic('back', 15)}Alle standplaatsen</button>` : ''}</div><div class="pg-h"><div class="pg-id"><h1>${esc(sp.n)}${sp.hub ? ' <span class="badge">hoofdkantoor</span>' : ''}${sp.wh ? ' <span class="badge">warehouse</span>' : ''}</h1><div class="sub">${esc(sp.klant)} · ${esc(sp.div.map(d => DIV[d].n.toLowerCase()).join(', '))} · ${esc(sp.prov === sp.regio ? sp.prov : `${sp.prov}, regio ${sp.regio}`)}</div>${sp.adres ? `<div class="sub">${ic('pin', 14)} ${esc(adresTxt(sp.adres))}${plekken ? ` · ${fmt(plekken)} parkeerplekken` : ''}${sp.formules && sp.formules.length ? ` · rijdt voor ${esc(sp.formules.join(', '))}` : ''}</div>` : ''}</div><div class="pg-a"><button class="btn sm" type="button" data-open="kaart:sp:${esc(sp.n)}">${ic('map', 15)}Op kaart</button><button class="btn sm" type="button" data-pbopen="${esc(sp.n)}">${ic('gantt', 15)}Planbord</button></div></div>
    <div class="pg-kpis"><div><small>Ingezet vandaag</small><b>${inzet} <em>van ${mine.length}</em></b><span>${onw} nu onderweg</span></div><div><small>Vertrekken komend uur</small><b>${dep60}</b><span>${fmt(deps.length)} in de komende 3 uur</span></div><div class="${zs ? 'bad' : ''}"><small>Open meldingen</small><b>${zs}</b><span>${tc.klaar} opleggers klaar · ${tc.leeg} leeg · ${st.opDienst} chauffeurs vandaag</span></div></div>
    ${bijz.length ? `<div class="note info">${ic('route', 16)}<div><b>Bijzonder in de planning</b><div>${esc(bijz.join(' '))}</div></div></div>` : ''}
    <div class="tabs" role="tablist">${[['vertrekbord', 'Vertrekbord'], ['docks', 'Docks'], ['terrein', 'Terrein'], ['gegevens', 'Gegevens']].map(([k, n]) => `<button class="tab" type="button" role="tab" aria-selected="${tab === k}" data-sptab="${k}">${n}</button>`).join('')}</div>${body}</div>`;
  const de = el.querySelector('[data-sp=det]'); const sc = de.scrollTop; if (swap(de, det)) de.scrollTop = sc;
}

// ---------- hal-scherm (tv in de loods) ----------
// Het hal-scherm hangt in de loods en is voor iedereen te lezen (chauffeurs, bezoekers, uitzendkrachten): daarom alleen
// de voornaam en de eerste letter van de achternaam, met het tussenvoegsel erbij zoals je het in de loods zegt. "Bram de
// Boer" wordt "Bram de B.", "Youssef Zwaan" wordt "Youssef Z.". Het planbord en de pagina's tonen de hele naam.
export const halNaam = naam => {
  const w = String(naam || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '–'; if (w.length === 1) return w[0];
  const achter = w[w.length - 1]; const tussen = w.slice(1, -1).filter(x => x === x.toLowerCase());
  return [w[0], ...tussen, `${achter.charAt(0).toUpperCase()}.`].join(' ');
};
export function renderHal(ctx, spName) {
  const { fleet, state, S } = ctx; const sp = SP.find(s => s.n === spName) || SP[0]; const T = state.simTime;
  const deps = fleet.departures(sp, T - 5, 185).slice(0, 14);
  const date = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = `<div class="halbar"><div><span class="prod">Simon Loos · vertrekbord</span><h2>${esc(sp.n)}</h2></div><div class="halclock"><b>${hhmm(T)}</b><span>${esc(date)}</span></div><button class="btn" type="button" id="halClose">${ic('x', 16)}Sluiten</button></div>
    <div class="halgrid" role="table" aria-label="Vertrekken"><div class="halcols" role="row"><span>Vertrek</span><span>Voertuig</span><span>Oplegger</span><span>Chauffeur</span><span>Bestemming</span><span>Dock</span><span style="text-align:right">Status</span></div>${deps.map(d => { const cd = depStatus(d, T, S); return `<div class="halline ${cd.cls}" role="row"><time>${hhmm(d.at)}<small>${cd.text}</small></time><b>${esc(d.t.id)}</b><span class="trl">${d.tr ? esc(d.tr.id) : d.t.kind === 'trekker' ? 'solo' : '–'}</span><span class="drv">${esc(halNaam(d.driver))}</span><span class="dest" title="${esc(d.dest)}">${esc(kortStop(d.dest))}</span><em>${d.dock || '–'}</em><i>${cd.status}</i></div>`; }).join('') || '<div class="halempty">Geen vertrekken in de komende drie uur.</div>'}</div>
    <div class="halnote">Zelfde gegevens als de control tower, ververst elke seconde · ${fleet.trucks.filter(t => t.base === sp).length} voertuigen en ${fleet.trailersOf(sp).length} opleggers op deze standplaats</div>`;
  const el = ctx.$('hal'); if (el.dataset.h !== h) { const had = document.activeElement && document.activeElement.id === 'halClose'; el.innerHTML = h; el.dataset.h = h; el.querySelector('#halClose').onclick = () => ctx.hashTo(''); if (had) el.querySelector('#halClose').focus(); }
}

// ---------- klant-link (deelbaar per levering) ----------
export function renderKlant(ctx, truckId) {
  const { fleet, state } = ctx; const t = fleet.byId.get(truckId); const el = ctx.$('klant');
  let h;
  if (!t) h = `<div class="kcard" role="dialog" aria-label="Levering"><div class="kh"><img src="${logo}" alt="Simon Loos"><span>Je levering</span></div><div class="kb"><h2>Onbekende rit</h2><p class="hint">Deze link verwijst naar een voertuig dat niet (meer) bestaat.</p><div><button class="btn pri" type="button" id="kClose">Naar de control tower</button></div></div></div>`;
  else {
    const s = ctx.stAt(t, state.simTime); const nx = s.next; const r = ctx.R.ritOf(t, state.simTime); const rs = r ? ctx.R.stateOf(r, state.simTime, ctx.S) : null;
    const late = nx && nx.win && lateBy(nx.eta, nx.win) > 0; const trs = s.tr ? ctx.trailerState(s.tr) : null;
    // de rit van vandaag is nog niet begonnen: dan is hij niet afgerond, maar vertrekt hij later (met de eerste stop)
    const gepland = !!(rs && rs.st === 'gepland' && !(nx && !nx.home)); const eerste = gepland && r.stops ? r.stops.find(x => !x.pickup) || null : null;
    h = `<div class="kcard" role="dialog" aria-label="Je levering"><div class="kh"><img src="${logo}" alt="Simon Loos"><span>Je levering · live</span><button class="btn ghost sm" type="button" id="kClose">${ic('x', 14)}Sluiten</button></div><div class="kb">
      <h2>${esc(nx && !nx.home ? nx.name : gepland ? (eerste ? eerste.name : 'Rit gepland') : 'Rit afgerond')}</h2>
      <div class="kstat ${late ? 'bad' : s.st === 'klant' ? 'ok' : ''}">${ic(s.st === 'klant' ? 'okc' : late ? 'alert' : 'clock', 18)}${s.st === 'klant' ? 'De wagen staat bij je' : nx && !nx.home ? (late ? `Verwacht ${hhmm(nx.eta)}, ${nx.delay} min later dan gepland` : `Verwacht ${hhmm(nx.eta)}${nx.win ? `, binnen het venster tot ${hhmm(nx.win[1])}` : ''}`) : gepland ? `Vertrekt om ${hhmm(r.dep)} uit ${t.base.n}${eerste && typeof eerste.arr === 'number' ? `, verwacht om ${hhmm(eerste.arr)}` : ''}` : 'Alle stops van vandaag zijn gedaan'}</div>
      ${rs ? `<div class="kprog"><span>${rs.done} van ${rs.n} ${rs.n === 1 ? 'stop' : 'stops'}</span><div class="meter"><i style="width:${rs.n ? Math.round(rs.done / rs.n * 100) : 100}%"></i></div></div>` : ''}
      ${kv([['Voertuig', `${esc(t.id)} · ${esc(t.model)}`], s.tr && ['Oplegger', `${esc(s.tr.id)} · ${esc(TRT[s.tr.type].n.toLowerCase())}`], ['Chauffeur', esc((s.driver || 'onbekend').split(' ')[0])], ['Nog te rijden', nx && !nx.home ? `${nl1(nx.kmLeft)} km` : gepland && r.km ? `${nl1(r.km)} km` : nx ? `${nl1(nx.kmLeft)} km` : '–'], ['Lading', esc((trs && trs.lading) || t.lading || 'volgens afspraak')], ['Laatste update', hhmm(state.simTime)]])}
      <p class="hint">Deze link toont alleen dit voertuig en deze levering; de kaart erachter volgt het voertuig live. Vragen? Bel de planning van ${esc(t.base.n)}.</p></div></div>`;
  }
  if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; el.querySelector('#kClose').onclick = () => ctx.hashTo(''); }
}
