// Tabellen en lijsten: trucks, mensen, lostijden, laadplanning en pauzeplekken. Sorteren, zoeken, exporteren als csv.
import { SP, DIV, ST, fmt, hhmm } from './places.js';
import { ic } from './icons.js';
import { priceCurve, planCharging, NET } from './energy.js';

const sortState = { trucks: ['id', 1], mensen: ['name', 1], lostijden: ['impact', -1] };
const nl1 = v => v.toFixed(1).replace('.', ','); const nl2 = v => v.toFixed(2).replace('.', ',');
const csv = (name, head, rows) => { const q = v => `"${String(v).replace(/"/g, '""')}"`; const txt = [head, ...rows].map(r => r.map(q).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const thead = (cols, key, sort) => `<thead><tr>${cols.map(([k, n, cls]) => `<th class="${cls || ''} ${sort[0] === k ? 'sorted' : ''}" data-sort="${k}">${n}${sort[0] === k ? (sort[1] > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>`;
function sortRows(rows, key, dir) { return rows.slice().sort((a, b) => { const x = a[key], y = b[key]; if (x === y) return 0; if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir; return String(x).localeCompare(String(y), 'nl') * dir; }); }
function bindSort(el, name, rerender) { el.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => { const k = th.dataset.sort; const s = sortState[name]; sortState[name] = [k, s[0] === k ? -s[1] : 1]; rerender(); })); }
const tableQ = {};

// ---------- trucks ----------
export function renderTrucks(ctx) {
  const { fleet, people, S, esc, $ } = ctx; const el = $('v-trucks'); const q = (tableQ.trucks || '').toLowerCase();
  const rows = fleet.trucks.filter(t => ctx.visible(t)).map(t => { const i = people.forTruck.get(t.id); const s = S.get(t.id); return { t, id: t.id, plate: t.plate, model: t.model.replace('Mercedes-Benz ', 'MB '), base: t.base.n, div: DIV[t.div].n, driver: t.driver, st: s ? ST[s.st].n : '', vaste: Math.round(i.vaste * 100), km30: i.km30, verbruik: i.verbruik, schades: i.schades12, apk: i.apk, ev: t.ev }; }).filter(r => !q || `${r.id} ${r.plate} ${r.driver} ${r.base} ${r.model}`.toLowerCase().includes(q));
  const [k, d] = sortState.trucks; const sorted = sortRows(rows, k, d);
  const cols = [['id', 'Truck'], ['plate', 'Kenteken'], ['model', 'Model'], ['base', 'Standplaats'], ['div', 'Divisie'], ['driver', 'Chauffeur'], ['st', 'Status'], ['vaste', 'Vaste chauffeur', 'r'], ['km30', 'km 30 d', 'r'], ['verbruik', 'Verbruik', 'r'], ['schades', 'Schades 12 m', 'r'], ['apk', 'APK tot']];
  el.innerHTML = `<div class="vhead"><h3>Trucks <small>${fmt(sorted.length)} in je werkgebied</small></h3><div class="tools"><div class="srch sm">${ic('search', 14)}<input id="tq" placeholder="Zoek in de tabel" value="${esc(tableQ.trucks || '')}"></div><button class="btn sm" id="tcsv">${ic('download', 14)} csv</button></div></div>
    <div class="tscroll"><table class="t3">${thead(cols, 'trucks', sortState.trucks)}<tbody>${sorted.map(r => `<tr data-trucksheet="${r.id}"><td><span class="plate">${r.id}</span></td><td class="mut">${esc(r.plate)}</td><td>${esc(r.model)}${r.ev ? ' <small>EV</small>' : ''}</td><td>${esc(r.base)}</td><td>${esc(r.div)}</td><td>${esc(r.driver)}</td><td><span class="dotst" style="background:${ST[r.t && S.get(r.id) ? S.get(r.id).st : 'terrein'].color}"></span>${r.st}</td><td class="r ${r.vaste < 65 ? 'warn' : ''}">${r.vaste} %</td><td class="r">${fmt(r.km30)}</td><td class="r">${r.ev || r.t.van ? nl2(r.verbruik) + ' kWh/km' : nl1(r.verbruik) + ' l/100'}</td><td class="r ${r.schades ? 'warn' : ''}">${r.schades}</td><td>${esc(r.apk)}</td></tr>`).join('')}</tbody></table></div>`;
  bindSort(el, 'trucks', () => renderTrucks(ctx));
  el.querySelectorAll('[data-trucksheet]').forEach(tr => tr.addEventListener('click', () => ctx.openSheet('truck', tr.dataset.trucksheet)));
  const tq = $('tq'); tq.addEventListener('input', e => { tableQ.trucks = e.target.value; const pos = e.target.selectionStart; renderTrucks(ctx); const n = $('tq'); n.focus(); n.setSelectionRange(pos, pos); });
  $('tcsv').onclick = () => csv('trucks.csv', cols.map(c => c[1]), sorted.map(r => cols.map(c => r[c[0]])));
}

// ---------- mensen ----------
export function renderMensen(ctx) {
  const { fleet, people, S, esc, $, can } = ctx; const el = $('v-mensen'); const q = (tableQ.mensen || '').toLowerCase();
  const rows = people.persons.filter(p => ctx.inScopeBase(p.base, p.div)).map(p => { const t = people.truckOf(p); const s = t && S.get(t.id); return { p, name: p.name, base: p.base.n, div: DIV[p.div].n, since: p.since, truck: t ? t.id : '', st: s ? ST[s.st].n : 'geen dienst', stk: s ? s.st : '', code95: p.licence.code95, rijscore: p.rijscore, schades: p.schades.length, verzuim: p.verzuim }; }).filter(r => !q || `${r.name} ${r.base} ${r.truck}`.toLowerCase().includes(q));
  const [k, d] = sortState.mensen; const sorted = sortRows(rows, k, d);
  const cols = [['name', 'Naam'], ['base', 'Standplaats'], ['div', 'Divisie'], ['since', 'In dienst', 'r'], ['truck', 'Truck nu'], ['st', 'Status'], ['code95', 'Code 95 tot'], ['rijscore', 'Rij-score', 'r'], ['schades', 'Schades 24 m', 'r'], ['verzuim', 'Verzuim', 'r']];
  const locked = key => (key === 'rijscore' && !can('rijden')) || (key === 'schades' && !can('schades')) || (key === 'verzuim' && !can('contract'));
  el.innerHTML = `<div class="vhead"><h3>Mensen <small>${fmt(sorted.length)} chauffeurs in je werkgebied</small></h3><div class="tools"><div class="srch sm">${ic('search', 14)}<input id="mq" placeholder="Zoek op naam, standplaats, truck" value="${esc(tableQ.mensen || '')}"></div><button class="btn sm" id="mcsv">${ic('download', 14)} csv</button></div></div>
    <div class="tscroll"><table class="t3">${thead(cols, 'mensen', sortState.mensen)}<tbody>${sorted.map(r => `<tr data-person="${r.p.id}"><td><span class="av sm">${esc(r.p.initials)}</span> <b>${esc(r.name)}</b></td><td>${esc(r.base)}</td><td>${esc(r.div)}</td><td class="r">${r.since}</td><td>${r.truck || '<span class="mut">–</span>'}</td><td>${r.stk ? `<span class="dotst" style="background:${ST[r.stk].color}"></span>` : ''}${esc(r.st)}</td><td>${esc(r.code95)}</td><td class="r">${locked('rijscore') ? `<span class="mut">${ic('lock', 12)}</span>` : nl1(r.rijscore)}</td><td class="r ${!locked('schades') && r.schades ? 'warn' : ''}">${locked('schades') ? `<span class="mut">${ic('lock', 12)}</span>` : r.schades}</td><td class="r">${locked('verzuim') ? `<span class="mut">${ic('lock', 12)}</span>` : nl1(r.verzuim) + ' %'}</td></tr>`).join('')}</tbody></table></div>
    <div class="hint2 pad">Rij-score, schades en verzuim zijn alleen zichtbaar voor de rollen die ze nodig hebben; de export bevat alleen wat jouw rol mag zien.</div>`;
  bindSort(el, 'mensen', () => renderMensen(ctx));
  el.querySelectorAll('[data-person]').forEach(tr => tr.addEventListener('click', () => ctx.openSheet('persoon', tr.dataset.person)));
  const mq = $('mq'); mq.addEventListener('input', e => { tableQ.mensen = e.target.value; const pos = e.target.selectionStart; renderMensen(ctx); const n = $('mq'); n.focus(); n.setSelectionRange(pos, pos); });
  $('mcsv').onclick = () => { const c = cols.filter(x => !locked(x[0])); csv('mensen.csv', c.map(x => x[1]), sorted.map(r => c.map(x => r[x[0]]))); };
}

// ---------- lostijden ----------
export function renderLostijden(ctx) {
  const { lostijden, esc, $ } = ctx; const el = $('v-lostijden'); const klant = tableQ.lostKlant || 'Alle';
  const all = lostijden.stops.filter(e => ctx.inScopeBase(e.base, e.div)); const klanten = ['Alle', ...new Set(all.map(e => e.klant))].slice(0, 9);
  const rows = all.filter(e => klant === 'Alle' || e.klant === klant).map(e => ({ e, name: e.name, klant: e.klant, n: e.n, planned: e.planned, och: e.measured.ochtend, mid: e.measured.middag, av: e.measured.avond, avg: e.avg, diff: e.diff, impact: Math.abs(e.diff) * e.n, applied: lostijden.isApplied(e.name) ? 1 : 0 }));
  const [k, d] = sortState.lostijden; const sorted = sortRows(rows, k, d);
  const eff = lostijden.effect(all); const m = v => Math.round(v); const cell = (v, p) => `<td class="r ${v > p * 1.1 ? 'bad' : v < p * 0.9 ? 'good' : ''}">${m(v)}</td>`;
  const cols = [['name', 'Winkel of losadres'], ['klant', 'Klant'], ['n', 'Stops/dag', 'r'], ['planned', 'Gepland', 'r'], ['och', 'Ochtend', 'r'], ['mid', 'Middag', 'r'], ['av', 'Avond', 'r'], ['avg', 'Gemeten gem.', 'r'], ['diff', 'Verschil', 'r'], ['applied', 'Overnemen', 'r']];
  el.innerHTML = `<div class="vhead"><h3>Lostijden leren per klant <small>${fmt(all.length)} adressen in je werkgebied · minuten per stop</small></h3><div class="tools"><button class="btn sm" id="lsAll">${ic('check', 14)} Alles overnemen</button><button class="btn sm ghost" id="lsReset">Herstel</button></div></div>
    <div class="effect"><div><b>${fmt(eff.winkels)}</b><span>adressen overgenomen</span></div><div><b>${fmt(eff.saved)} min</b><span>per dag korter gepland waar het sneller gaat</span></div><div><b>${fmt(eff.realistic)}</b><span>stops per dag met een realistischere tijd</span></div><div><b>${fmt(eff.stopsN)}</b><span>stops per dag geraakt</span></div><p>Gemeten uit de boordcomputer: aankomst tot vertrek, laatste 60 dagen, per dagdeel. Overnemen geldt voor de planning van morgen; vandaag verandert niets.</p></div>
    <div class="chips pad">${klanten.map(c => `<button class="chip sm ${klant === c ? 'on' : ''}" data-klant="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="tscroll"><table class="t3">${thead(cols, 'lostijden', sortState.lostijden)}<tbody>${sorted.slice(0, 300).map(r => `<tr class="${r.applied ? 'applied' : ''}"><td><b>${esc(r.name)}</b></td><td>${esc(r.klant)}</td><td class="r">${r.n}</td><td class="r">${m(r.planned)}</td>${cell(r.och, r.planned)}${cell(r.mid, r.planned)}${cell(r.av, r.planned)}<td class="r"><b>${m(r.avg)}</b></td><td class="r ${r.diff > 3 ? 'bad' : r.diff < -3 ? 'good' : ''}">${r.diff > 0 ? '+' : ''}${m(r.diff)}</td><td class="r"><label class="sw ${r.applied ? 'on' : ''}" data-apply="${esc(r.name)}"><i></i></label></td></tr>`).join('')}</tbody></table></div>${sorted.length > 300 ? `<div class="more2">Eerste 300 van ${sorted.length} adressen; sorteer of filter op klant.</div>` : ''}`;
  bindSort(el, 'lostijden', () => renderLostijden(ctx));
  el.querySelectorAll('[data-klant]').forEach(b => b.addEventListener('click', () => { tableQ.lostKlant = b.dataset.klant; renderLostijden(ctx); }));
  el.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { lostijden.toggle(b.dataset.apply); renderLostijden(ctx); }));
  $('lsAll').onclick = () => { lostijden.applyAll(sorted.map(r => r.e)); ctx.notice(`${sorted.length} adressen overgenomen in de planning van morgen.`); renderLostijden(ctx); };
  $('lsReset').onclick = () => { lostijden.reset(); renderLostijden(ctx); };
}

// ---------- laden op goedkope stroom ----------
let planCache = null;
export function renderLaden(ctx) {
  const { fleet, esc, $, state } = ctx; const el = $('v-laden'); const T = state.simTime;
  const sps = SP.filter(sp => fleet.trucks.some(t => t.base === sp && t.ev && ctx.inScope(t))).sort((a, b) => b.fleet - a.fleet);
  if (!sps.length) { el.innerHTML = '<div class="vhead"><h3>Laden</h3></div><div class="empty pad">Geen elektrische trucks in je werkgebied.</div>'; return; }
  const cur = sps.find(s => s.n === tableQ.ladenSp) || sps[0]; tableQ.ladenSp = cur.n;
  if (!planCache || planCache.sp !== cur) planCache = planCharging(cur, fleet.trucks.filter(t => t.base === cur), priceCurve(0));
  const P = planCache; const max = Math.max(...P.prices); const cheap = P.prices.slice().sort((a, b) => a - b)[7];
  const eur = v => `€ ${fmt(v)}`; const nlk = v => `${fmt(v)} kWh`;
  const lane = s => { const seg = (x, cls) => { const a = ((x.m0 % 1440) + 1440) % 1440, len = x.m1 - x.m0; const parts = a + len > 1440 ? [[a, 1440], [0, a + len - 1440]] : [[a, a + len]]; return parts.map(([p0, p1]) => `<i class="${cls}" style="left:${(p0 / 1440 * 100).toFixed(2)}%;width:${((p1 - p0) / 1440 * 100).toFixed(2)}%" title="${hhmm(x.m0)}–${hhmm(x.m1)} · ${Math.round(x.kWh)} kWh"></i>`).join(''); }; const win = s.wins.map(([wa, wb]) => { const a = ((wa % 1440) + 1440) % 1440, len = wb - wa; const parts = a + len > 1440 ? [[a, 1440], [0, a + len - 1440]] : [[a, a + len]]; return parts.map(([p0, p1]) => `<u style="left:${(p0 / 1440 * 100).toFixed(2)}%;width:${((p1 - p0) / 1440 * 100).toFixed(2)}%"></u>`).join(''); }).join(''); return win + s.segsD.map(x => seg(x, 'd')).join('') + s.segs.map(x => seg(x, 's')).join(''); };
  const byTruck = new Map(); for (const s of P.sessions) { let g = byTruck.get(s.t); if (!g) { g = { t: s.t, kW: s.kW, done: 0, costSlim: 0, costDirect: 0, wins: [], segs: [], segsD: [], a: s.a }; byTruck.set(s.t, g); } g.done += s.done; g.costSlim += s.costSlim; g.costDirect += s.costDirect; g.wins.push([s.a, s.b]); g.segs.push(...s.segs); g.segsD.push(...s.segsD); g.a = Math.min(g.a, s.a); }
  const sessions = [...byTruck.values()].sort((a, b) => a.a - b.a);
  el.innerHTML = `<div class="vhead"><label class="dd"><small>Standplaats</small><select id="ldSel">${sps.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label><span class="pill">${fleet.trucks.filter(t => t.base === cur && t.ev).length} e-trucks · ${P.sessions.length} laadsessies</span><span class="hintline">Dagprijs EPEX (gesimuleerd profiel) plus € ${nl2(NET)} per kWh netkosten en belasting. Netaansluiting ${fmt(P.cap)} kW.</span></div>
    <div class="ldwrap"><div class="effect four"><div><b>${nlk(P.kWh)}</b><span>te laden vandaag</span></div><div><b>${eur(P.costSlim)}</b><span>kosten slim, in de goedkoopste uren</span></div><div><b>${eur(P.costDirect)}</b><span>kosten bij direct laden na aankomst</span></div><div class="good"><b>${eur(P.costDirect - P.costSlim)}</b><span>bespaard vandaag · ${Math.round((1 - P.costSlim / Math.max(1, P.costDirect)) * 100)} %</span></div><div class="${P.peakDirect > P.cap ? 'bad' : ''}"><b>${fmt(P.peakSlim)} / ${fmt(P.peakDirect)} kW</b><span>piek slim / direct · limiet ${fmt(P.cap)} kW${P.peakDirect > P.cap ? ' overschreden' : ''}</span></div></div>
      <div class="pricebar"><div class="pb-h"><b>Dagprijs per uur</b><span>€/MWh · ${hhmm(T)} nu · goedkoopste 8 uur gemarkeerd</span></div><div class="pbars">${P.prices.map((p, h) => `<div class="${p <= cheap ? 'cheap' : ''} ${Math.floor(((T % 1440) + 1440) % 1440 / 60) === h ? 'now' : ''}" style="height:${Math.round(p / max * 100)}%" title="${String(h).padStart(2, '0')}:00 · € ${p}/MWh"><span>${p}</span></div>`).join('')}</div><div class="pbax">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<span style="left:${(h / 24 * 100).toFixed(1)}%">${String(h).padStart(2, '0')}:00</span>`).join('')}</div></div>
      <div class="lanes"><div class="lane-h"><span>Truck</span><div class="lane-ax">${[0, 6, 12, 18].map(h => `<span style="left:${(h / 24 * 100).toFixed(1)}%">${String(h).padStart(2, '0')}:00</span>`).join('')}<span class="nowm" style="left:${(((T % 1440) + 1440) % 1440 / 1440 * 100).toFixed(2)}%"></span></div><span class="r">kWh</span><span class="r">slim</span><span class="r">direct</span></div>
        ${sessions.map(s => `<div class="lane-r" data-trucksheet="${s.t.id}"><span><span class="plate">${s.t.id}</span><small>${esc(s.t.driver.split(' ')[0])} · ${s.kW} kW</small></span><div class="lane-b">${lane(s)}</div><span class="r">${Math.round(s.done)}</span><span class="r good">€ ${nl1(s.costSlim)}</span><span class="r mut">€ ${nl1(s.costDirect)}</span></div>`).join('')}
        <div class="lane-leg"><span><u></u>op het terrein</span><span><i class="s"></i>slim gepland</span><span><i class="d"></i>direct na aankomst</span></div></div>
      <div class="hint2 pad">De planner legt elke sessie in de goedkoopste kwartieren binnen de tijd dat de truck op het terrein staat, zonder de netaansluiting te overschrijden. In de echte versie komen de prijzen van de energieleverancier (dag vooruit) en stuurt het energiemanagementsysteem de laders aan.</div></div>`;
  $('ldSel').onchange = e => { tableQ.ladenSp = e.target.value; planCache = null; renderLaden(ctx); };
  el.querySelectorAll('[data-trucksheet]').forEach(r => r.addEventListener('click', () => ctx.openSheet('truck', r.dataset.trucksheet)));
}

// ---------- pauzeplekken ----------
export function renderPauze(ctx) {
  const { rest, esc, $, S } = ctx; const el = $('v-pauze'); const f = tableQ.pz || {}; const sel = ctx.selTruck(); const s = sel && S.get(sel.id);
  let L = rest.places.slice(); if (f.douche) L = L.filter(p => p.douche); if (f.beveiligd) L = L.filter(p => p.beveiligd); if (f.laders) L = L.filter(p => p.laders); if (f.lzv) L = L.filter(p => p.lzv);
  const dist = p => s ? Math.hypot((p.lon - s.pos.lon) * 68, (p.lat - s.pos.lat) * 111) : null;
  L.sort((a, b) => s ? dist(a) - dist(b) : rest.score(b) - rest.score(a));
  const stars = v => `<span class="stars" title="${v}">${'★'.repeat(Math.round(v))}${'☆'.repeat(5 - Math.round(v))}</span>`;
  el.innerHTML = `<div class="vhead"><h3>Pauzeplekken <small>${L.length} langs het snelwegennet · beoordeeld door chauffeurs</small></h3><div class="tools chips">${[['douche', 'Douche'], ['beveiligd', 'Beveiligd'], ['laders', 'Laadpunten'], ['lzv', 'LZV-plekken']].map(([k, n]) => `<button class="chip sm ${f[k] ? 'on' : ''}" data-pz="${k}">${n}</button>`).join('')}<button class="btn sm ${ctx.restOnMap() ? 'on' : ''}" id="pzMap">${ic('map', 14)} Op de kaart</button></div></div>
    ${s ? `<div class="hintline pad">Gesorteerd op afstand tot ${sel.id} (${esc(sel.driver)}).</div>` : '<div class="hintline pad">Gesorteerd op beoordeling. Selecteer een truck om op afstand te sorteren en een pauzeplek voor te stellen.</div>'}
    <div class="pzlist">${L.map(p => `<div class="pz" data-rest="${p.id}"><div class="pzh"><b>${esc(p.n)}</b>${stars(rest.score(p))}<em>${rest.score(p).toString().replace('.', ',')} · ${p.count + (rest.myRating(p.id) ? 1 : 0)} beoordelingen</em></div><span class="mut">${esc(p.sub)}${s ? ` · ${Math.round(dist(p))} km van ${sel.id}` : ''}</span><div class="amen">${[`${ic('car', 13)} ${p.plekken} plekken`, p.beveiligd ? `${ic('shield', 13)} beveiligd` : null, p.douche ? `${ic('shower', 13)} douche` : null, p.eten !== 'geen' ? `${ic('food', 13)} ${esc(p.eten)}` : null, p.laders ? `${ic('bolt', 13)} ${p.laders} laadpunten` : null, p.lzv ? 'LZV' : null].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-pz]').forEach(b => b.addEventListener('click', () => { f[b.dataset.pz] = !f[b.dataset.pz]; tableQ.pz = f; renderPauze(ctx); }));
  $('pzMap').onclick = () => { ctx.setRestOnMap(!ctx.restOnMap()); renderPauze(ctx); };
  el.querySelectorAll('[data-rest]').forEach(r => r.addEventListener('click', () => ctx.selectRest(r.dataset.rest)));
}
