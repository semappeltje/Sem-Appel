// Tabellen: voertuigen, opleggers, chauffeurs, lostijden en pauzeplekken (met de tabelcomponent: sorteren op elke kolom,
// filters als chips, zoeken, kolomkeuze, bulkacties en csv), plus de laadplanning met dagprijs en laadsessies.
import { SP, DIV } from './places.js';
import { KIND, TRT } from './fleet.js';
import { esc, ic, fmt, hhmm, day, nl1, nl2, fmtDrive, durTxt, plate, kenteken, meter, empty, on, stBadge, trBadge, VST, TST, ritBadge, stars, swap } from './ui/base.js';
import { createTable } from './ui/table.js';
import { priceCurve, planCharging, NET } from './energy.js';
import { bindTips } from './ui/charts.js';
import { tijdreeks } from './ui/tijdreeks.js';
// gisteren als korte dagnaam ("za 18:50"), zodat de kolom Sinds smal blijft; de simulatie speelt vandaag
const GISTER = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][(new Date().getDay() + 6) % 7];
import { devHtml } from './ui/ritten.js';

const kindName = k => KIND[k].mv[0].toUpperCase() + KIND[k].mv.slice(1);
const spOpts = (pool, f) => [...new Set(pool.map(f))].sort().map(n => ({ v: n, l: n, n: pool.filter(r => f(r) === n).length }));

// ---------- voertuigen ----------
export function renderVoertuigen(ctx, el) {
  if (!ctx.ui.vTable) {
    const T = () => ctx.state.simTime;
    ctx.ui.vTable = createTable(ctx, el, {
      id: 'voertuigen', unit: 'voertuigen', csvName: 'voertuigen.csv', key: r => r.id, sort: ['id', 1],
      rows: () => { const t0 = T(); return ctx.fleet.trucks.filter(t => ctx.inScope(t)).map(t => { const s = ctx.S.get(t.id) || ctx.stAt(t, t0); const i = ctx.people.forTruck.get(t.id); const r = ctx.R.ritOf(t, t0); const rs = r ? ctx.R.stateOf(r, t0, ctx.S) : null; const active = rs && rs.st !== 'gepland' && rs.st !== 'afgerond';
        return { t, s, r, rs, active, id: t.id, plate: t.plate, kind: t.kind, model: t.model.replace('Mercedes-Benz ', 'MB '), base: t.base.n, div: t.div, st: s.st, driver: s.driver || '', trl: s.tr ? s.tr.id : '', rit: active ? r.id : '', next: s.dienst && s.next ? (s.next.home ? `Terug naar ${t.base.n}` : s.next.name) : '', eta: s.dienst && s.next ? s.next.eta : null, dev: active ? rs.dev : null, soc: s.soc, drive: s.dienst ? s.drive : null, vandaag: t.vandaag, nd: t.diensten.length, wissel: i.distinct, km30: i.km30, verbruik: i.verbruik, schades: i.schades12, apk: i.apk, wo: t.storing ? (t.workorder ? 'aangemaakt' : 'storing, nog geen werkorder') : i.werkorder ? i.werkorder.what : '', ev: t.ev }; }); },
      cols: [
        { k: 'id', l: 'Nr', w: 84, req: true, html: r => plate(r.id) },
        { k: 'plate', l: 'Kenteken', w: 112, csv: r => r.plate, html: r => kenteken(r.plate, { maat: 'sm' }) },
        { k: 'st', l: 'Status', w: 120, sort: r => ['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein'].indexOf(r.st), html: r => stBadge(r.st) },
        { k: 'kind', l: 'Soort', w: 90, def: false, html: r => esc(KIND[r.kind].n), csv: r => KIND[r.kind].n },
        { k: 'base', l: 'Standplaats', w: 100, mw: 130 },
        { k: 'driver', l: 'Chauffeur', w: 120, mw: 140, html: r => r.driver ? esc(r.driver) : '<span class="mut">–</span>' },
        { k: 'trl', l: 'Oplegger', w: 84, html: r => r.trl ? `<button class="lnk quiet" type="button" data-open="kaart:trailer:${esc(r.trl)}">${esc(r.trl)}</button>` : r.kind === 'trekker' && r.st !== 'terrein' ? '<span class="mut">solo</span>' : '<span class="mut">–</span>' },
        { k: 'rit', l: 'Rit', w: 84, def: false, html: r => r.rit ? `<button class="lnk quiet" type="button" data-open="rit/${esc(r.rit)}">${esc(r.rit)}</button>` : '<span class="mut">–</span>' },
        { k: 'next', l: 'Volgende stop', w: 140, mw: 160, html: r => r.next ? esc(r.next) : '<span class="mut">–</span>' },
        { k: 'eta', l: 'ETA', w: 64, r: true, html: r => r.eta !== null ? hhmm(r.eta) : '<span class="mut">–</span>', csv: r => r.eta !== null ? hhmm(r.eta) : '' },
        { k: 'dev', l: 'Afwijking', w: 90, r: true, desc: true, sort: r => r.dev === null ? -999 : r.rs && r.rs.winMiss > 0 ? 1000 + r.dev : r.dev, html: r => r.dev === null ? '<span class="mut">–</span>' : devHtml(r.rs), csv: r => r.dev === null ? '' : r.dev },
        { k: 'soc', l: 'Accu of tank', w: 100, r: true, html: r => `<span class="mv">${meter(r.soc / 100, r.soc < 20 ? 'bad' : r.soc < 35 ? 'warn' : '')}<span>${Math.round(r.soc)} %</span></span>`, csv: r => Math.round(r.soc) },
        { k: 'drive', l: 'Rijtijd', w: 70, r: true, def: false, sort: r => r.drive === null ? -1 : r.drive, html: r => r.drive === null ? '<span class="mut">–</span>' : `<span class="${r.drive >= 240 ? 'tbad' : r.drive >= 200 ? 'twarn' : ''}">${fmtDrive(r.drive)}</span>`, csv: r => r.drive === null ? '' : fmtDrive(r.drive) },
        { k: 'model', l: 'Model', w: 170, def: false, html: r => `${esc(r.model)}${r.ev ? ' <span class="badge sm">EV</span>' : ''}` },
        { k: 'div', l: 'Divisie', w: 150, def: false, html: r => esc(DIV[r.div].n), csv: r => DIV[r.div].n },
        { k: 'vandaag', l: 'Vandaag', w: 100, def: false, sort: r => r.vandaag === 'inzet' ? r.nd : -1, html: r => r.vandaag === 'inzet' ? `${r.nd} ${r.nd === 1 ? 'dienst' : 'diensten'}` : r.vandaag === 'reserve' ? '<span class="mut">reserve</span>' : '<span class="twarn">werkplaats</span>', csv: r => r.vandaag === 'inzet' ? `${r.nd} diensten` : r.vandaag },
        { k: 'wissel', l: 'Chauffeurs 2 wk', w: 110, r: true, def: false },
        { k: 'km30', l: 'km 30 dagen', w: 100, r: true, def: false, html: r => fmt(r.km30) },
        { k: 'verbruik', l: 'Verbruik', w: 110, r: true, def: false, html: r => r.ev ? `${nl2(r.verbruik)} kWh/km` : `${nl1(r.verbruik)} l/100`, csv: r => r.ev ? nl2(r.verbruik) : nl1(r.verbruik) },
        { k: 'schades', l: 'Schades 12 mnd', w: 110, r: true, def: false, lock: () => !ctx.can('schades') },
        { k: 'apk', l: 'APK tot', w: 110, def: false },
        { k: 'wo', l: 'Werkorder', w: 200, def: false, html: r => r.wo ? `<span class="${/storing/.test(r.wo) ? 'tbad' : ''}">${esc(r.wo)}</span>` : '<span class="mut">–</span>' },
      ],
      search: { ph: 'Zoek voertuig, kenteken of chauffeur', text: r => `${r.id} ${r.plate} ${r.driver} ${r.trl} ${r.base} ${r.model} ${r.next} ${r.rit}` },
      filters: [
        { id: 'st', l: 'Status', kind: 'chips', opts: pool => ['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein'].map(k => ({ v: k, l: VST[k].n, n: pool.filter(r => r.st === k).length, dot: `st-${k}` })), test: (r, s) => s.has(r.st) },
        { id: 'kind', l: 'Soort', kind: 'menu', opts: pool => Object.keys(KIND).map(k => ({ v: k, l: kindName(k), n: pool.filter(r => r.kind === k).length })).filter(o => o.n), test: (r, s) => s.has(r.kind) },
        { id: 'vandaag', l: 'Vandaag', kind: 'menu', opts: pool => [['inzet', 'Ingezet'], ['reserve', 'Reserve'], ['onderhoud', 'Werkplaats']].map(([k, l]) => ({ v: k, l, n: pool.filter(r => r.vandaag === k).length })), test: (r, s) => s.has(r.vandaag) },
        { id: 'aandr', l: 'Aandrijving', kind: 'menu', opts: pool => [{ v: 'ev', l: 'Elektrisch', n: pool.filter(r => r.ev).length }, { v: 'diesel', l: 'Diesel', n: pool.filter(r => !r.ev).length }], test: (r, s) => s.has(r.ev ? 'ev' : 'diesel') },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => spOpts(pool, r => r.base), test: (r, s) => s.has(r.base) },
      ],
      bulk: [
        { id: 'map', l: 'Toon op kaart', icon: 'map', run: rows => ctx.showTrucksOnMap(rows.map(r => r.t)) },
        { id: 'msg', l: 'Bericht aan chauffeurs', icon: 'msg', run: rows => ctx.bulkMessage(rows.map(r => r.t)) },
        { id: 'csv', l: 'Exporteer selectie', icon: 'download', run: rows => ctx.ui.vTable.exportCsv(rows, 'voertuigen-selectie.csv') },
      ],
      open: r => ctx.go(`voertuig/${r.id}/vandaag`),
      menuLabel: r => r.id,
      menu: r => { const t = ctx.fleet.byId.get(r.id); return [
        { l: 'Open voertuig', icon: 'truck', run: () => ctx.go(`voertuig/${r.id}/vandaag`) },
        { l: 'Op de kaart', icon: 'map', run: () => ctx.go(`kaart:truck:${r.id}`) },
        { l: 'Ritten van vandaag', icon: 'route', run: () => ctx.go(`lijst:ritten:${r.id}`) },
        ctx.can('act') && t && t.diensten.length && { l: 'Bericht aan de chauffeur', icon: 'msg', run: () => ctx.bulkMessage([t]) },
        { l: 'Onderhoud', icon: 'wrench', run: () => ctx.go(`voertuig/${r.id}/onderhoud`) },
      ]; },
      emptyTxt: () => ['Geen voertuigen in je werkgebied', 'Pas je werkgebied aan via de knop in de topbalk.'],
      mobile: { t: r => `${plate(r.id)} <span class="mut" style="font-weight:400">${esc(KIND[r.kind].n)} · ${esc(r.base)}</span>`, r: r => stBadge(r.st), m: r => `${r.driver ? esc(r.driver) : 'geen chauffeur'}${r.next ? ` · ${esc(r.next)} ${r.eta !== null ? hhmm(r.eta) : ''}` : ''} · ${Math.round(r.soc)} %` },
    });
  }
  ctx.ui.vTable.refresh(true);
}

// ---------- opleggers ----------
export function renderOpleggers(ctx, el) {
  if (!ctx.ui.oTable) {
    const T = () => ctx.state.simTime;
    ctx.ui.oTable = createTable(ctx, el, {
      id: 'opleggers', unit: 'opleggers', csvName: 'opleggers.csv', key: r => r.id, sort: ['st', 1],
      rows: () => { const t0 = T(); return ctx.fleet.trailers.filter(tr => ctx.inScopeBase(tr.base, tr.div)).map(tr => { const s = ctx.TRS.get(tr.id) || ctx.fleet.trailerStateAt(tr, t0); const info = ctx.people.forTrailer.get(tr.id); const temp = ctx.fleet.trailerTemp(tr, t0);
        return { tr, s, id: tr.id, plate: tr.plate, type: tr.type, base: tr.base.n, st: s.st, late: !!s.late, waar: s.vehicle ? `achter ${s.vehicle.id}` : s.place || '', veh: s.vehicle ? s.vehicle.id : '', driver: s.vehicle ? ctx.driverName(s.vehicle) : '', sinds: s.since || 0, lading: s.lading || (s.loaded ? 'geladen' : s.st === 'onderhoud' ? '' : 'leeg'), temp, wacht: s.st === 'wacht' ? Math.max(0, Math.round(s.wait || 0)) : null, pickup: s.pickup !== undefined ? s.pickup : null, atp: info.atp || '', apk: info.apk, onderhoud: info.onderhoud.date, wo: tr.storing ? (tr.workorder ? 'aangemaakt' : 'storing, nog geen werkorder') : info.werkorder ? info.werkorder.what : '', storing: !!tr.storing }; }); },
      cols: [
        { k: 'id', l: 'Nr', w: 84, req: true, html: r => plate(r.id) },
        { k: 'st', l: 'Status', w: 150, sort: r => r.late ? -1 : ['wacht', 'ophalen', 'geladen', 'gekoppeld', 'klaar', 'leeg', 'onderhoud'].indexOf(r.st), html: r => trBadge(r.st, r.late), csv: r => r.late ? 'Te laat opgehaald' : TST[r.st].n },
        { k: 'type', l: 'Type', w: 130, html: r => esc(TRT[r.type].n), csv: r => TRT[r.type].n },
        { k: 'base', l: 'Standplaats', w: 90, mw: 110 },
        { k: 'waar', l: 'Waar', w: 170, mw: 220, csv: r => r.waar, html: r => r.veh ? `achter <button class="lnk quiet" type="button" data-open="kaart:truck:${esc(r.veh)}">${esc(r.veh)}</button>` : esc(r.waar) },
        { k: 'sinds', l: 'Sinds', w: 64, r: true, sort: r => r.sinds ? (r.sinds > T() + 0.5 ? r.sinds - 1440 : r.sinds) : -9999, html: r => r.sinds ? (r.sinds > T() + 0.5 ? `<small class="mut" title="gisteren">${GISTER}</small> ${hhmm(r.sinds)}` : hhmm(r.sinds)) : '<span class="mut">–</span>', csv: r => r.sinds ? hhmm(r.sinds) : '' },
        { k: 'lading', l: 'Lading', w: 150, mw: 180, csv: r => r.lading || '', html: r => r.lading ? esc(r.lading) : '<span class="mut">–</span>' },
        { k: 'temp', l: '°C', w: 64, r: true, sort: r => r.temp === null ? -99 : r.temp, html: r => r.temp === null ? '<span class="mut">–</span>' : `<span class="${r.storing ? 'tbad' : ''}">${nl1(r.temp)}</span>`, csv: r => r.temp === null ? '' : nl1(r.temp) },
        { k: 'wacht', l: 'Wacht', w: 70, r: true, desc: true, sort: r => r.wacht === null ? -1 : r.wacht, html: r => r.wacht === null ? '<span class="mut">–</span>' : `<span class="${r.late ? 'tbad' : ''}">${durTxt(r.wacht)}</span>`, csv: r => r.wacht === null ? '' : Math.round(r.wacht) },
        { k: 'driver', l: 'Chauffeur', w: 150, def: false, html: r => r.driver ? esc(r.driver) : '<span class="mut">–</span>' },
        { k: 'pickup', l: 'Ophalen gepland', w: 120, r: true, def: false, html: r => r.pickup !== null ? `${r.pickup >= 1440 ? 'morgen ' : ''}${hhmm(r.pickup)}` : '<span class="mut">–</span>', csv: r => r.pickup !== null ? hhmm(r.pickup) : '' },
        { k: 'plate', l: 'Kenteken', w: 112, def: false, csv: r => r.plate, html: r => kenteken(r.plate, { opl: true, maat: 'sm' }) },
        { k: 'atp', l: 'ATP tot', w: 90, def: false, html: r => r.atp ? esc(r.atp) : '<span class="mut">–</span>' },
        { k: 'apk', l: 'APK tot', w: 110, def: false },
        { k: 'onderhoud', l: 'Laatste onderhoud', w: 130, def: false },
        { k: 'wo', l: 'Werkorder', w: 200, def: false, html: r => r.wo ? `<span class="${/storing/.test(r.wo) ? 'tbad' : ''}">${esc(r.wo)}</span>` : '<span class="mut">–</span>' },
      ],
      search: { ph: 'Zoek oplegger, winkel of trekker', text: r => `${r.id} ${r.plate} ${TRT[r.type].n} ${r.base} ${r.waar} ${r.veh} ${r.driver} ${r.lading}` },
      filters: [
        { id: 'st', l: 'Status', kind: 'chips', opts: pool => ['gekoppeld', 'klaar', 'geladen', 'wacht', 'ophalen', 'leeg', 'onderhoud'].map(k => ({ v: k, l: TST[k].n, n: pool.filter(r => r.st === k).length, dot: TST[k].cls })).filter(o => o.n || o.v !== 'ophalen'), test: (r, s) => s.has(r.st) },
        { id: 'laat', l: 'Te laat', kind: 'chips', sepBefore: true, opts: pool => [{ v: 'laat', l: 'Te laat opgehaald', n: pool.filter(r => r.late).length, dot: 'st-vertraagd' }], test: r => r.late },
        { id: 'type', l: 'Type', kind: 'menu', opts: pool => Object.keys(TRT).map(k => ({ v: k, l: TRT[k].n, n: pool.filter(r => r.type === k).length })).filter(o => o.n), test: (r, s) => s.has(r.type) },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => spOpts(pool, r => r.base), test: (r, s) => s.has(r.base) },
      ],
      bulk: [
        { id: 'map', l: 'Toon op kaart', icon: 'map', run: rows => ctx.showTrailersOnMap(rows.map(r => r.tr)) },
        { id: 'csv', l: 'Exporteer selectie', icon: 'download', run: rows => ctx.ui.oTable.exportCsv(rows, 'opleggers-selectie.csv') },
      ],
      tools: () => `<button class="btn sm" type="button" data-trlmap="1" aria-pressed="${ctx.trailersOnMap()}">${ic('map', 15)}Losse opleggers op de kaart</button>`,
      onMount: e => on(e, 'click', '[data-trlmap]', () => { ctx.setTrailersOnMap(!ctx.trailersOnMap()); ctx.ui.oTable.refresh(false); }),
      open: r => ctx.go(`oplegger/${r.id}/vandaag`),
      menuLabel: r => r.id,
      menu: r => [
        { l: 'Open oplegger', icon: 'trailer', run: () => ctx.go(`oplegger/${r.id}/vandaag`) },
        { l: 'Op de kaart', icon: 'map', run: () => ctx.go(`kaart:trailer:${r.id}`) },
        { l: 'Ritten van vandaag', icon: 'route', run: () => ctx.go(`lijst:ritten:${r.id}`) },
        { l: 'Onderhoud', icon: 'wrench', run: () => ctx.go(`oplegger/${r.id}/onderhoud`) },
      ],
      rowCls: r => r.late ? 'hl' : '',
      emptyTxt: () => ['Geen opleggers in je werkgebied', 'Pas je werkgebied aan via de knop in de topbalk.'],
      mobile: { t: r => `${plate(r.id)} <span class="mut" style="font-weight:400">${esc(TRT[r.type].n)}</span>`, r: r => trBadge(r.st, r.late), m: r => `${esc(r.waar)}${r.lading ? ` · ${esc(r.lading.split(',')[0])}` : ''}${r.temp !== null ? ` · ${nl1(r.temp)} °C` : ''}` },
    });
  }
  ctx.ui.oTable.refresh(true);
}

// ---------- chauffeurs ----------
const PST = { rijdt: 'Rijdt', klant: 'Bij klant', pauze: 'Pauze', terrein: 'Op terrein', later: 'Begint later', klaar: 'Dienst klaar', vrij: 'Vrij' };
const PSTC = { rijdt: 'st-onderweg', klant: 'st-klant', pauze: 'st-pauze', terrein: 'st-terrein', later: 'st-gepland', klaar: 'st-afgerond', vrij: 'st-afgerond' };
export function renderChauffeurs(ctx, el) {
  if (!ctx.ui.cTable) {
    const T = () => ctx.state.simTime; const soon = s => { const m = /(\d{2})-(\d{4})/.exec(s || ''); if (!m) return false; const d = new Date(+m[2], +m[1] - 1, 1); return (d - new Date()) / 864e5 < 183; };
    ctx.ui.cTable = createTable(ctx, el, {
      id: 'chauffeurs', unit: 'chauffeurs', csvName: 'chauffeurs.csv', key: r => r.id, sort: ['st', 1],
      rows: () => { const t0 = T(); return ctx.people.persons.filter(p => ctx.inScopeBase(p.base, p.div)).map(p => { const d = p.dienst && p.dienst.d; const t = d && p.dienst.t; const s = t && ctx.S.get(t.id); const act = s && s.dienst === d;
        const st = act ? (s.st === 'onderweg' || s.st === 'vertraagd' ? 'rijdt' : s.st) : d ? (t0 < d.start ? 'later' : 'klaar') : 'vrij';
        return { p, t, s, id: p.id, name: p.name, base: p.base.n, div: p.div, st, dienst: d ? d.start : null, dEnd: d ? d.end : null, truck: t ? t.id : '', trl: act && s.tr ? s.tr.id : '', drive: act ? s.drive : null, pz: act ? t0 + Math.max(0, 270 - s.drive) : null, code95: p.licence.code95, ce: p.licence.ce, kaart: p.licence.kaart, adr: p.licence.adr, lzv: p.licence.lzv, rijscore: p.rijscore, schades: p.schades.length, verzuim: p.verzuim, since: p.since, c95soon: soon(p.licence.code95) }; }); },
      cols: [
        { k: 'name', l: 'Naam', w: 180, req: true, html: r => `<span class="nowrap"><span class="av sm">${esc(r.p.initials)}</span> <b style="font-weight:600">${esc(r.name)}</b></span>` },
        { k: 'st', l: 'Status', w: 130, sort: r => Object.keys(PST).indexOf(r.st), html: r => `<span class="badge ${PSTC[r.st]}"><i class="dot"></i>${PST[r.st]}</span>`, csv: r => PST[r.st] },
        { k: 'base', l: 'Standplaats', w: 100, mw: 130 },
        { k: 'dienst', l: 'Dienst vandaag', w: 120, sort: r => r.dienst === null ? 9999 : r.dienst, html: r => r.dienst !== null ? `${hhmm(r.dienst)}–${hhmm(r.dEnd)}` : '<span class="mut">vrij</span>', csv: r => r.dienst !== null ? `${hhmm(r.dienst)}-${hhmm(r.dEnd)}` : '' },
        { k: 'truck', l: 'Voertuig', w: 90, html: r => r.truck ? `<button class="lnk quiet" type="button" data-open="kaart:truck:${esc(r.truck)}">${esc(r.truck)}</button>` : '<span class="mut">–</span>' },
        { k: 'drive', l: 'Rijtijd', w: 80, r: true, sort: r => r.drive === null ? -1 : r.drive, desc: true, html: r => r.drive === null ? '<span class="mut">–</span>' : `<span class="${r.drive >= 240 ? 'tbad' : r.drive >= 200 ? 'twarn' : ''}">${fmtDrive(r.drive)}</span>`, csv: r => r.drive === null ? '' : fmtDrive(r.drive) },
        { k: 'pz', l: 'Pauze uiterlijk', w: 120, r: true, sort: r => r.pz === null ? 9999 : r.pz, html: r => r.pz === null ? '<span class="mut">–</span>' : hhmm(r.pz), csv: r => r.pz === null ? '' : hhmm(r.pz) },
        { k: 'code95', l: 'Code 95 tot', w: 100, html: r => `<span class="${r.c95soon ? 'twarn' : ''}">${esc(r.code95)}</span>` },
        { k: 'trl', l: 'Oplegger', w: 90, def: false, html: r => r.trl ? esc(r.trl) : '<span class="mut">–</span>' },
        { k: 'ce', l: 'Rijbewijs CE tot', w: 120, def: false },
        { k: 'kaart', l: 'Bestuurderskaart tot', w: 140, def: false },
        { k: 'adr', l: 'ADR', w: 60, def: false, sort: r => r.adr ? 1 : 0, html: r => r.adr ? 'ja' : '<span class="mut">nee</span>', csv: r => r.adr ? 'ja' : 'nee' },
        { k: 'lzv', l: 'LZV', w: 60, def: false, sort: r => r.lzv ? 1 : 0, html: r => r.lzv ? 'ja' : '<span class="mut">nee</span>', csv: r => r.lzv ? 'ja' : 'nee' },
        { k: 'schades', l: 'Schades 24 mnd', w: 120, r: true, def: false, lock: () => !ctx.can('schades') },
        { k: 'verzuim', l: 'Verzuim', w: 80, r: true, def: false, lock: () => !ctx.can('contract'), html: r => `${nl1(r.verzuim)} %`, csv: r => nl1(r.verzuim) },
        { k: 'div', l: 'Divisie', w: 150, def: false, html: r => esc(DIV[r.div].n), csv: r => DIV[r.div].n },
        { k: 'since', l: 'In dienst sinds', w: 110, r: true, def: false },
      ],
      search: { ph: 'Zoek naam, standplaats, voertuig', text: r => `${r.name} ${r.base} ${r.truck} ${r.trl}` },
      filters: [
        { id: 'st', l: 'Status', kind: 'chips', opts: pool => [['rijdt', 'Rijdt'], ['klant', 'Bij klant'], ['pauze', 'Pauze'], ['later', 'Begint later'], ['klaar', 'Dienst klaar'], ['vrij', 'Vrij']].map(([k, l]) => ({ v: k, l, n: pool.filter(r => r.st === k).length, dot: PSTC[k] })), test: (r, s) => s.has(r.st) },
        { id: 'let', l: 'Let op', kind: 'menu', all: 'Alles', opts: pool => [{ v: 'rijtijd', l: 'Bijna op de rijtijdlimiet', n: pool.filter(r => r.drive !== null && r.drive >= 200).length }, { v: 'c95', l: 'Code 95 verloopt binnen 6 maanden', n: pool.filter(r => r.c95soon).length }], test: (r, s) => (s.has('rijtijd') && r.drive !== null && r.drive >= 200) || (s.has('c95') && r.c95soon) },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => spOpts(pool, r => r.base), test: (r, s) => s.has(r.base) },
      ],
      bulk: [
        { id: 'msg', l: 'Bericht', icon: 'msg', run: rows => ctx.bulkMessage(rows.filter(r => r.t).map(r => r.t)) },
        { id: 'csv', l: 'Exporteer selectie', icon: 'download', run: rows => ctx.ui.cTable.exportCsv(rows, 'chauffeurs-selectie.csv') },
      ],
      open: r => ctx.go(`persoon/${r.id}`),
      menuLabel: r => r.name,
      menu: r => { const p = ctx.people.byId.get(r.id); const t = p && ctx.people.truckOf(p); return [
        { l: 'Open profiel', icon: 'user', run: () => ctx.go(`persoon/${r.id}`) },
        t && { l: `Voertuig ${t.id}`, icon: 'truck', run: () => ctx.go(`voertuig/${t.id}/vandaag`) },
        t && { l: 'Op de kaart', icon: 'map', run: () => ctx.go(`kaart:truck:${t.id}`) },
        { l: 'Diensten', icon: 'cal', run: () => ctx.go(`persoon/${r.id}/diensten`) },
      ]; },
      head: () => `<div class="note info" style="margin:12px 24px 0">${ic('info', 16)}<div>Chauffeurs hebben geen vaste wagen: per dienst krijgen ze een voertuig uit de pool van hun standplaats. Rijgedrag, schades en verzuim zijn alleen zichtbaar voor de rollen die ze nodig hebben; er zijn geen punten of ranglijsten; de export bevat alleen wat jouw rol mag zien.</div></div>`,
      emptyTxt: () => ['Geen chauffeurs in je werkgebied', 'Pas je werkgebied aan via de knop in de topbalk.'],
      mobile: { t: r => `<span class="av sm">${esc(r.p.initials)}</span> ${esc(r.name)}`, r: r => `<span class="badge ${PSTC[r.st]}">${PST[r.st]}</span>`, m: r => `${esc(r.base)}${r.dienst !== null ? ` · ${hhmm(r.dienst)}–${hhmm(r.dEnd)} op ${esc(r.truck)}` : ' · vandaag vrij'}${r.drive !== null ? ` · rijtijd ${fmtDrive(r.drive)}` : ''}` },
    });
  }
  ctx.ui.cTable.refresh(true);
}

// ---------- lostijden ----------
export function renderLostijden(ctx, el) {
  const lt = ctx.lostijden;
  if (!ctx.ui.lTable) {
    const m = v => Math.round(v); const cell = (v, p) => `<span class="${v > p * 1.1 ? 'tbad' : v < p * 0.9 ? 'tok' : ''}">${m(v)}</span>`;
    ctx.ui.lTable = createTable(ctx, el, {
      id: 'lostijden', unit: 'adressen', csvName: 'lostijden.csv', key: r => r.name, sort: ['impact', -1],
      rows: () => lt.stops.filter(e => ctx.inScopeBase(e.base, e.div)).map(e => ({ e, name: e.name, klant: e.klant, n: e.n, planned: e.planned, och: e.measured.ochtend, mid: e.measured.middag, av: e.measured.avond, avg: e.avg, diff: e.diff, impact: Math.abs(e.diff) * e.n, wacht: e.wacht || 0, wachtP90: e.wachtP90 || 0, applied: lt.isApplied(e.name) })),
      cols: [
        { k: 'name', l: 'Winkel of losadres', w: 186, mw: 206, req: true, html: r => `<b style="font-weight:600">${esc(r.name)}</b>` },
        { k: 'klant', l: 'Klant', w: 110, def: false },
        { k: 'n', l: 'Stops/dag', w: 76, r: true },
        { k: 'planned', l: 'Gepland', w: 80, r: true, html: r => `${m(r.planned)} min`, csv: r => m(r.planned) },
        { k: 'och', l: 'Ochtend', w: 72, r: true, html: r => cell(r.och, r.planned), csv: r => m(r.och) },
        { k: 'mid', l: 'Middag', w: 72, r: true, html: r => cell(r.mid, r.planned), csv: r => m(r.mid) },
        { k: 'av', l: 'Avond', w: 72, r: true, html: r => cell(r.av, r.planned), csv: r => m(r.av) },
        { k: 'avg', l: 'Gemeten', w: 90, r: true, html: r => `<b style="font-weight:600">${m(r.avg)} min</b>`, csv: r => m(r.avg) },
        { k: 'diff', l: 'Verschil', w: 90, r: true, html: r => `<span class="${r.diff > 3 ? 'tbad' : r.diff < -3 ? 'tok' : 'mut'}">${r.diff > 0 ? '+' : ''}${m(r.diff)} min</span>`, csv: r => m(r.diff) },
        { k: 'impact', l: 'Effect per dag', w: 110, r: true, desc: true, html: r => `${fmt(r.impact)} min`, csv: r => m(r.impact) },
        { k: 'wacht', l: 'Wachten', w: 88, r: true, desc: true, html: r => `<span title="Gemiddeld ${m(r.wacht)} min wachten voor het lossen; bij 1 op de 10 stops ${m(r.wachtP90)} min of meer">${m(r.wacht)} <small class="mut">/ ${m(r.wachtP90)}</small> min</span>`, csv: r => m(r.wacht) },
        { k: 'applied', l: 'Overnemen', w: 100, r: true, sort: r => r.applied ? 1 : 0, html: r => `<label class="tgl" title="${r.applied ? 'Overgenomen voor morgen' : 'Neem de gemeten tijd over voor morgen'}"><input type="checkbox" data-lt="${esc(r.name)}" ${r.applied ? 'checked' : ''} aria-label="Neem de gemeten lostijd over voor ${esc(r.name)}"><i></i></label>`, csv: r => r.applied ? 'ja' : 'nee' },
      ],
      search: { ph: 'Zoek winkel, plaats of klant', text: r => `${r.name} ${r.klant}` },
      filters: [{ id: 'klant', l: 'Klant', kind: 'chips', opts: pool => [...new Set(pool.map(r => r.klant))].map(k => ({ v: k, l: k, n: pool.filter(r => r.klant === k).length })).sort((a, b) => b.n - a.n).slice(0, 8), test: (r, s) => s.has(r.klant) }],
      bulk: [{ id: 'take', l: 'Overnemen', icon: 'check', run: rows => { lt.applyAll(rows.map(r => r.e)); ctx.A.log(`nam de gemeten lostijd over voor ${rows.length} adressen`); ctx.L.toast(`${rows.length} adressen overgenomen in de planning van morgen.`, { icon: 'check' }); ctx.ui.lTable.clearSel(); ctx.ui.lTable.refresh(true); } }],
      tools: () => `<button class="btn sm" type="button" data-ltall="1">${ic('check', 15)}Alles overnemen</button><button class="btn ghost sm" type="button" data-ltreset="1">Herstel</button>`,
      head: () => { const all = lt.stops.filter(e => ctx.inScopeBase(e.base, e.div)); const eff = lt.effect(all);
        // het effect pas als er iets is overgenomen; anders een regel uitleg (rust)
        return `<div class="tv-head" style="border-bottom:0;padding-bottom:0">${eff.winkels ? `<div class="zk-sum"><div><b>${fmt(eff.winkels)}</b><span>adressen overgenomen</span></div><div><b>${fmt(eff.saved)} min</b><span>per dag korter gepland waar lossen sneller gaat</span></div><div><b>${fmt(eff.realistic)}</b><span>stops per dag met een realistischere tijd</span></div><div><b>${fmt(eff.stopsN)}</b><span>stops per dag geraakt</span></div></div>` : ''}<p class="hint">Gemeten met de boordcomputer: van aankomst tot vertrek, laatste 60 dagen, per dagdeel. Overnemen geldt voor de planning van morgen; vandaag verandert niets.</p></div>`; },
      onMount: e => {
        on(e, 'change', '[data-lt]', (ev, x) => { lt.toggle(x.dataset.lt); ctx.A.log(`${lt.isApplied(x.dataset.lt) ? 'nam de gemeten lostijd over' : 'zette de geplande lostijd terug'} voor ${x.dataset.lt}`); ctx.L.toast(lt.isApplied(x.dataset.lt) ? `Gemeten lostijd overgenomen voor ${x.dataset.lt}.` : `Geplande lostijd terug voor ${x.dataset.lt}.`, { icon: 'check' }); ctx.ui.lTable.refresh(true); });
        on(e, 'click', '[data-ltall]', () => { const rows = ctx.ui.lTable.st.view; lt.applyAll(rows.map(r => r.e)); ctx.A.log(`nam de gemeten lostijd over voor ${rows.length} adressen`); ctx.L.toast(`${rows.length} adressen overgenomen in de planning van morgen.`, { icon: 'check' }); ctx.ui.lTable.refresh(true); });
        on(e, 'click', '[data-ltreset]', () => { const before = lt.count(); lt.reset(); ctx.A.log('zette alle geplande lostijden terug'); ctx.L.toast(`Alle ${before} overgenomen lostijden staan weer op gepland.`, { icon: 'undo' }); ctx.ui.lTable.refresh(true); });
      },
      open: r => ctx.go(`kaart:winkel:${r.name}`),
      emptyTxt: () => ['Geen losadressen in je werkgebied', 'Lostijden worden per winkel of DC gemeten zodra er ritten naartoe gaan.'],
      mobile: { t: r => esc(r.name), r: r => r.applied ? '<span class="badge b-ok">overgenomen</span>' : '', m: r => `${esc(r.klant)} · gepland ${m(r.planned)} min, gemeten ${m(r.avg)} min · ${r.n} stops per dag` },
    });
  }
  ctx.ui.lTable.refresh(true);
}

// ---------- laden op goedkope stroom ----------
let planCache = null;
export function renderLaden(ctx, el) {
  const { fleet, state } = ctx; const T = state.simTime; const ui = ctx.ui;
  const sps = SP.filter(sp => fleet.trucks.some(t => t.base === sp && t.ev && ctx.inScope(t))).sort((a, b) => b.fleet - a.fleet);
  if (!sps.length) { swap(el, `<div class="page"><div class="page-in">${empty('Geen elektrische voertuigen in je werkgebied', 'Laden gaat over de eActros, FH Electric en e-bestelbussen. Kies een werkgebied met elektrische voertuigen.', '', 'bolt', 'center')}</div></div>`); return; }
  const cur = sps.find(s => s.n === ui.ladenSp) || sps[0]; ui.ladenSp = cur.n;
  if (!planCache || planCache.sp !== cur) planCache = planCharging(cur, fleet.trucks.filter(t => t.base === cur), priceCurve(0));
  const P = planCache; const max = Math.max(...P.prices); const cheap = P.prices.slice().sort((a, b) => a - b)[7]; const hNow = Math.floor(day(T) / 60);
  const eur = v => `€ ${fmt(v)}`;
  const byTruck = new Map(); for (const s of P.sessions) { let g = byTruck.get(s.t); if (!g) { g = { t: s.t, kW: s.kW, done: 0, costSlim: 0, costDirect: 0, wins: [], segs: [], segsD: [], a: s.a }; byTruck.set(s.t, g); } g.done += s.done; g.costSlim += s.costSlim; g.costDirect += s.costDirect; g.wins.push([s.a, s.b]); g.segs.push(...s.segs); g.segsD.push(...s.segsD); g.a = Math.min(g.a, s.a); }
  const sessions = [...byTruck.values()].sort((a, b) => a.a - b.a);
  const span = (a, len) => { a = day(a); return a + len > 1440 ? [[a, 1440], [0, a + len - 1440]] : [[a, a + len]]; };
  const lane = s => s.wins.map(([wa, wb]) => span(wa, wb - wa).map(([p0, p1]) => `<u style="left:${(p0 / 14.4).toFixed(2)}%;width:${((p1 - p0) / 14.4).toFixed(2)}%"></u>`).join('')).join('') + s.segsD.map(x => span(x.m0, x.m1 - x.m0).map(([p0, p1]) => `<i class="d" style="left:${(p0 / 14.4).toFixed(2)}%;width:${((p1 - p0) / 14.4).toFixed(2)}%"></i>`).join('')).join('') + s.segs.map(x => span(x.m0, x.m1 - x.m0).map(([p0, p1]) => `<i class="s" style="left:${(p0 / 14.4).toFixed(2)}%;width:${((p1 - p0) / 14.4).toFixed(2)}%" title="${hhmm(x.m0)}–${hhmm(x.m1)} · ${Math.round(x.kWh)} kWh"></i>`).join('')).join('');
  // per kwartier: de prijs (per uur vastgesteld) en het vermogen van alle sessies samen, slim en direct
  const Q = Array.from({ length: 97 }, (_, i) => i * 15); const qi = m => Math.floor((((m % 1440) + 1440) % 1440) / 15);
  const kwQ = key => { const a = new Array(97).fill(0); for (const x of P.sessions) for (const bl of x[key]) a[qi(bl.m)] += x.kW; a[96] = a[95]; return a; };
  const slimQ = kwQ('blocks'), directQ = kwQ('direct'); const prijsQ = Q.map(m => P.prices[Math.min(23, Math.floor(m / 60))]);
  const sig = `${cur.n}|${Math.floor(day(T) / 15)}|${ctx.theme()}|${ctx.narrow()}`;
  const h = `<div class="page"><div class="page-in ld">
    <div class="vbar" style="border:1px solid var(--line);border-radius:var(--r-md)"><label class="lbl2" for="ldSel">Standplaats</label><select class="fld" id="ldSel" style="width:200px">${sps.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select><span class="hint">${fleet.trucks.filter(t => t.base === cur && t.ev).length} elektrische voertuigen · ${P.sessions.length} laadsessies · netaansluiting ${fmt(P.cap)} kW</span></div>
    <div class="ld-kpis k3"><div><small>Te laden vandaag</small><b>${fmt(P.kWh)} kWh</b><small>${fmt(sessions.length)} voertuigen op ${esc(cur.n)}</small></div><div class="good"><small>Bespaard met slim laden</small><b>${eur(P.costDirect - P.costSlim)}</b><small>${eur(P.costSlim)} in plaats van ${eur(P.costDirect)}, ${Math.round((1 - P.costSlim / Math.max(1, P.costDirect)) * 100)} % minder</small></div><div class="${P.peakDirect > P.cap ? 'bad' : ''}"><small>Piek slim / direct</small><b>${fmt(P.peakSlim)} / ${fmt(P.peakDirect)} kW</b><small>limiet ${fmt(P.cap)} kW${P.peakDirect > P.cap ? ', direct gaat erover' : ''}</small></div></div>
    <section class="card"><div class="card-h"><h2>Dagprijs en laadvermogen per kwartier</h2><span class="sub">vandaag · de verticale lijn is nu</span><div class="act"><button class="btn ghost sm" type="button" data-ldtbl="1" aria-pressed="${!!ui.ldTbl}">${ic(ui.ldTbl ? 'bars' : 'list', 15)}${ui.ldTbl ? 'Grafiek' : 'Tabel'}</button></div></div><div class="card-b">${ui.ldTbl ? `<div style="overflow-x:auto"><table class="tbl plain compact"><thead><tr><th>Uur</th><th class="r">€ per MWh</th><th class="r">Slim laden, kW</th><th class="r">Direct laden, kW</th></tr></thead><tbody>${P.prices.map((pr, h2) => `<tr${h2 === hNow ? ' class="now"' : ''}><td>${String(h2).padStart(2, '0')}:00</td><td class="r">${pr}${pr <= cheap ? ' <small class="tok">goedkoop</small>' : ''}</td><td class="r">${fmt(Math.max(...slimQ.slice(h2 * 4, h2 * 4 + 4)))}</td><td class="r">${fmt(Math.max(...directQ.slice(h2 * 4, h2 * 4 + 4)))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="ur-k"><h3>Dagprijs <small>€ per MWh, per uur vastgesteld</small></h3><div class="ur" data-uplot="prijs" data-k="${esc(sig)}"></div></div><div class="ur-k"><h3>Laadvermogen <small>kW op ${esc(cur.n)}, slim naast direct na aankomst</small></h3><div class="ur" data-uplot="kw" data-k="${esc(sig)}"></div></div>`}<p class="hint" style="margin-top:8px">Dagprijs EPEX (gesimuleerd profiel) plus € ${nl2(NET)} per kWh netkosten en belasting. Slim laden legt de sessies in de goedkoopste kwartieren, binnen de netaansluiting van ${fmt(P.cap)} kW.</p></div></section>
    <section class="card"><div class="card-h"><h2>Laadsessies</h2><span class="sub">per voertuig: wanneer het op het terrein staat en wanneer het laadt</span></div><div class="lanes" style="border:0;border-top:1px solid var(--line);border-radius:0"><div class="lane-h"><span>Voertuig</span><div class="lane-ax">${[0, 6, 12, 18].map(h2 => `<span style="left:${(h2 / 24 * 100).toFixed(1)}%">${String(h2).padStart(2, '0')}:00</span>`).join('')}<span class="nowm" style="left:${(day(T) / 14.4).toFixed(2)}%"></span></div><span class="r">kWh</span><span class="r">Slim</span><span class="r">Direct</span></div>
      ${sessions.map(s => `<div class="lane-r" role="link" tabindex="0" data-open="voertuig/${esc(s.t.id)}/vandaag"><span><span class="plate">${esc(s.t.id)}</span> <small>${s.kW} kW</small></span><div class="lane-b">${lane(s)}</div><span class="r">${fmt(s.done)}</span><span class="r tok">€ ${nl1(s.costSlim)}</span><span class="r mut">€ ${nl1(s.costDirect)}</span></div>`).join('')}
      <div class="lane-leg"><span><u></u>op het terrein</span><span><i class="s"></i>slim gepland</span><span><i class="d"></i>direct na aankomst</span></div></div></section>
    <p class="hint">De planner legt elke sessie in de goedkoopste kwartieren binnen de tijd dat het voertuig op het terrein staat, zonder de netaansluiting te overschrijden. In de echte versie komen de prijzen van de energieleverancier (dag vooruit) en stuurt het energiemanagementsysteem de laders aan.</p></div></div>`;
  if (swap(el, h)) {
    const sel = el.querySelector('#ldSel'); if (sel) sel.onchange = e => { ui.ladenSp = e.target.value; planCache = null; renderLaden(ctx, el); };
    const tb = el.querySelector('[data-ldtbl]'); if (tb) tb.onclick = () => { ui.ldTbl = !ui.ldTbl; renderLaden(ctx, el); };
    for (const c of ui.ldCharts || []) c.destroy(); ui.ldCharts = [];
    const hm = m => (m >= 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    const a = el.querySelector('[data-uplot=prijs]'), b = el.querySelector('[data-uplot=kw]'); const nu = day(T);
    if (a) ui.ldCharts.push(tijdreeks(a, { x: Q, xLabel: 'Kwartier', fmtX: hm, xStap: 180, fmtY: v => `€ ${fmt(v)}`, yStap: 50, hoogte: 170, nu, label: `Dagprijs per kwartier op ${cur.n}`, series: [{ label: 'Dagprijs', data: prijsQ, stap: true }] }));
    if (b) ui.ldCharts.push(tijdreeks(b, { x: Q, xLabel: 'Kwartier', fmtX: hm, xStap: 180, fmtY: v => `${fmt(v)} kW`, yStap: 150, hoogte: 190, nu, ref: { v: P.cap, label: `netaansluiting ${fmt(P.cap)} kW` }, label: `Laadvermogen per kwartier op ${cur.n}`, series: [{ label: 'Slim laden', data: slimQ, stap: true }, { label: 'Direct na aankomst', data: directQ, stap: true, accent: false }] }));
  }
}

// ---------- pauzeplekken ----------
export function renderPauze(ctx, el) {
  if (!ctx.ui.pTable) {
    const dist = p => { const t = ctx.selTruck(); const s = t && ctx.S.get(t.id); return s ? Math.hypot((p.lon - s.pos.lon) * 68, (p.lat - s.pos.lat) * 111) : null; };
    const flag = (id, l, f) => ({ id, l, kind: 'chips', opts: pool => [{ v: id, l, n: pool.filter(f).length }], test: f });
    ctx.ui.pTable = createTable(ctx, el, {
      id: 'pauze', unit: 'plekken', csvName: 'pauzeplekken.csv', key: r => r.id, sort: ['score', -1],
      rows: () => ctx.rest.places.map(p => ({ p, id: p.id, n: p.n, sub: p.sub, score: ctx.rest.score(p), count: p.count + (ctx.rest.myRating(p.id) ? 1 : 0), plekken: p.plekken, beveiligd: p.beveiligd, douche: p.douche, eten: p.eten, laders: p.laders, lzv: p.lzv, km: dist(p), mine: ctx.rest.myRating(p.id) })),
      cols: [
        { k: 'n', l: 'Pauzeplek', w: 240, req: true, html: r => `<b style="font-weight:600">${esc(r.n.replace(/^Pauzeplek /, ''))}</b> <span class="sub">${esc(r.sub)}</span>`, csv: r => `${r.n} (${r.sub})` },
        { k: 'score', l: 'Beoordeling', w: 150, desc: true, html: r => `<span class="nowrap">${stars(r.score)} ${nl1(r.score)}</span>`, csv: r => nl1(r.score) },
        { k: 'count', l: 'Aantal', w: 70, r: true },
        { k: 'km', l: 'Afstand', w: 90, r: true, sort: r => r.km === null ? 9999 : r.km, html: r => r.km === null ? '<span class="mut">–</span>' : `${fmt(r.km)} km`, csv: r => r.km === null ? '' : Math.round(r.km) },
        { k: 'plekken', l: 'Plekken', w: 80, r: true },
        { k: 'beveiligd', l: 'Beveiligd', w: 90, sort: r => r.beveiligd ? 1 : 0, html: r => r.beveiligd ? `${ic('shield', 14)} ja` : '<span class="mut">nee</span>', csv: r => r.beveiligd ? 'ja' : 'nee' },
        { k: 'douche', l: 'Douche', w: 80, sort: r => r.douche ? 1 : 0, html: r => r.douche ? 'ja' : '<span class="mut">nee</span>', csv: r => r.douche ? 'ja' : 'nee' },
        { k: 'eten', l: 'Eten', w: 120, html: r => r.eten === 'geen' ? '<span class="mut">geen</span>' : esc(r.eten) },
        { k: 'laders', l: 'Laadpunten', w: 100, r: true, html: r => r.laders ? fmt(r.laders) : '<span class="mut">–</span>' },
        { k: 'lzv', l: 'LZV', w: 60, sort: r => r.lzv ? 1 : 0, html: r => r.lzv ? 'ja' : '<span class="mut">nee</span>', csv: r => r.lzv ? 'ja' : 'nee' },
        { k: 'mine', l: 'Jouw sterren', w: 100, r: true, def: false, html: r => r.mine ? fmt(r.mine) : '<span class="mut">–</span>' },
      ],
      search: { ph: 'Zoek pauzeplek of plaats', text: r => `${r.n} ${r.sub} ${r.eten}` },
      filters: [flag('douche', 'Douche', r => r.douche), flag('beveiligd', 'Beveiligd', r => r.beveiligd), flag('laders', 'Laadpunten', r => r.laders > 0), flag('lzv', 'LZV-plekken', r => r.lzv)],
      tools: () => `<button class="btn sm" type="button" data-pzmap="1" aria-pressed="${ctx.restOnMap()}">${ic('map', 15)}Op de kaart</button>`,
      head: () => { const t = ctx.selTruck(); return `<div class="note ${t ? 'info' : ''}" style="margin:12px 24px 0">${ic('info', 16)}<div>${t ? `Afstand gemeten vanaf ${esc(t.id)} (${esc(ctx.driverName(t) || 'zonder chauffeur')}). Open een plek en stel hem voor als pauze.` : 'Beoordeeld door chauffeurs van Simon Loos. Kies op de kaart een voertuig om op afstand te sorteren en een plek als pauze voor te stellen.'}</div></div>`; },
      onMount: e => on(e, 'click', '[data-pzmap]', () => { ctx.setRestOnMap(!ctx.restOnMap()); ctx.ui.pTable.refresh(false); }),
      open: r => ctx.selectRest(r.id),
      mobile: { t: r => esc(r.n), r: r => `${stars(r.score)}`, m: r => `${esc(r.sub)} · ${r.plekken} plekken${r.douche ? ' · douche' : ''}${r.beveiligd ? ' · beveiligd' : ''}${r.km !== null ? ` · ${fmt(r.km)} km` : ''}` },
    });
  }
  ctx.ui.pTable.refresh(true);
}
