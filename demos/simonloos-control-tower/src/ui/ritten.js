// Ritten: elke route van elke dienst is een rit, met een vast ritnummer, standplaats, voertuig, oplegger, chauffeur,
// klant en stops; status (gepland, onderweg, bij klant, pauze, vertraagd, afgerond), ETA en afwijking volgen uit het
// dagplan van het voertuig (fleet.js). Gepland is de tijd zonder de vertraging die de simulatie op een rit legt;
// werkelijk of verwacht is de tijd in het plan. Ritnummers zijn vast: een herlaad (met dezelfde acties) geeft dezelfde.
import { esc, ic, fmt, hhmm, day, diffMin, durTxt, plate, kv, on, ritBadge, RST, klantNaam, signMin, nl1, empty, stBadge, trBadge, effWin, lateBy, statusBar, smartBtns } from './base.js';
import * as IP from './inplannen.js';
import { KIND, TRT } from '../fleet.js';
import { createTable } from './table.js';

export function createRitten(fleet) {
  const ids = new WeakMap();
  // vaste nummers voor de routes van vandaag, voordat er een actie op het plan is uitgevoerd
  for (const t of fleet.trucks) t.diensten.forEach((d, di) => d.routes.forEach((r, ri) => ids.set(r, `R-${10000 + t.idx * 4 + di * 2 + ri}`)));
  let ver = 0, cache = null, cacheVer = -1;
  const bump = () => { ver++; };

  // ---------- opbouw uit de dagplannen ----------
  function build() {
    const rits = []; const byTruck = new Map(); const byId = new Map();
    for (const t of fleet.trucks) {
      const P = t.plan; const mine = []; let cur = null, koppel = -1, cum = 0, lastD = null;
      const close = () => { if (cur) { finish(cur); mine.push(cur); cur = null; } };
      for (let i = 0; i < P.length; i++) {
        const s = P[i];
        // een nieuwe dienst is opnieuw gepland: de vertraging van de vorige dienst telt daar niet meer als afwijking
        if (s.d !== null && s.d !== undefined && s.d !== lastD) { cum = 0; lastD = s.d; }
        const dl = s.k === 'drive' && !t.delayResolved ? (s.delay || 0) : 0;
        if (s.k === 'koppel') { close(); koppel = i; continue; }
        if (s.route) {
          const same = cur && (cur.routes.includes(s.route) || (s.route.detour && cur.d === s.d));
          if (!same) {
            close();
            // een dockblok vlak ervoor (laden aan het dock, wachten op een vrij dock) hoort bij de rit
            let a = koppel >= 0 && koppel === i - 1 ? koppel : i;
            while (a > 0 && P[a - 1].k === 'terrein' && (P[a - 1].dockSoort === 'laden' || P[a - 1].wachtDock) && P[a - 1].d === s.d) a--;
            cur = { t, d: s.d, i0: a, i1: i, routes: [s.route], segs: [], stops: [], koppel: koppel >= 0 && koppel === i - 1 ? P[koppel] : null };
          } else if (!cur.routes.includes(s.route)) cur.routes.push(s.route);
          cur.segs.push({ s, i, cum }); cur.i1 = i;
          cum += dl;
          continue;
        }
        if (s.k === 'ontkoppel' && cur) { cur.ontkoppel = s; cur.i1 = i; close(); koppel = -1; continue; }
        // retouren aan het dock direct na de rit horen er ook bij
        if (cur && s.k === 'terrein' && s.dockSoort === 'aankomst' && s.d === cur.d) { cur.retour = s; cur.i1 = i; close(); koppel = -1; continue; }
        close(); koppel = -1;
      }
      close();
      // ritnummers: de routes van vandaag hebben een vast nummer; een ophaalrit van de planner krijgt een eigen nummer per voertuig
      let n = 0;
      for (const r of mine) { r.id = ids.get(r.routes.find(x => ids.has(x))) || (() => { const id = `R-${60000 + t.idx * 10 + (++n)}`; return id; })(); if (byId.has(r.id)) r.id = `${r.id}b`; byId.set(r.id, r); rits.push(r); }
      byTruck.set(t, mine);
    }
    return { rits, byTruck, byId };
  }
  function finish(r) {
    const t = r.t; const T0 = t.dayStart; const drives = r.segs.filter(x => x.s.k === 'drive');
    const first = drives[0] || r.segs[0]; const last = drives[drives.length - 1] || r.segs[r.segs.length - 1];
    r.dep = T0 + first.s.t0; r.depPlan = r.dep - first.cum; r.end = T0 + last.s.t1; r.endPlan = r.end - (last.cum + (last.s.k === 'drive' && !t.delayResolved ? last.s.delay || 0 : 0));
    // oefendag: schoof een vertraging het plan op (gepland op het rijstuk, fleet.js), dan liggen vertrek en terugkomst waar
    // het plan ze had, zoals in fleet.stopStand; een langere wachttijd aan het dock telt dan ook mee
    if (!t.delayResolved && first.s.k === 'drive' && first.s.gepland !== undefined) r.depPlan = first.s.gepland - (first.s.t1 - first.s.t0 - (first.s.delay || 0));
    if (!t.delayResolved && last.s.k === 'drive' && last.s.gepland !== undefined) r.endPlan = last.s.gepland;
    r.km = drives.reduce((a, x) => a + Math.max(0, (x.s.km1 || 0) - (x.s.km0 || 0)), 0);
    r.dienst = r.d !== null && r.d !== undefined ? t.diensten[r.d] || null : null;
    r.driver = r.dienst ? r.dienst.driver : ''; r.person = r.dienst ? r.dienst.person : null;
    r.tr = (r.koppel && r.koppel.tr) || (r.segs.find(x => x.s.tr) || {}).s?.tr || null;
    r.base = t.base; r.div = t.div;
    // stops: aankomst (plan), gepland (zonder vertraging), tijdvenster, lostijd
    for (let k = 0; k < r.segs.length; k++) {
      const x = r.segs[k]; if (x.s.k !== 'stop') continue;
      const prevDrive = [...r.segs.slice(0, k)].reverse().find(y => y.s.k === 'drive');
      const dl = prevDrive ? prevDrive.cum + (!t.delayResolved ? prevDrive.s.delay || 0 : 0) : x.cum;
      // gepland: de geplande aankomst als een eerdere vertraging het plan opschoof (oefendag; fleet.js)
      const g = prevDrive && prevDrive.s.gepland !== undefined ? prevDrive.s.gepland : null;
      // op de oefendag (gepland, of een file op dit stuk) is de geplande aankomst die waar het venster op ligt (fleet.stopStand)
      const oef = !t.delayResolved && !!prevDrive && (g !== null || !!prevDrive.s.file);
      const win = prevDrive && prevDrive.s.win ? effWin([T0 + prevDrive.s.win[0], T0 + prevDrive.s.win[1]], g !== null ? g : T0 + x.s.t0 - (prevDrive.s.delay || 0)) : null;
      const mark = x.s.route && x.s.route.marks ? x.s.route.marks[x.s.idx] : null;
      r.stops.push({ seg: x.s, i: x.i, name: x.s.stop, arr: T0 + x.s.t0, dep: T0 + x.s.t1, plan: oef ? (g !== null ? g : T0 + x.s.t0 - (prevDrive.s.delay || 0)) : T0 + x.s.t0 - dl, win, winMoved: !!(prevDrive && prevDrive.s.winMoved) || !!(win && win.moved), swap: x.s.swap || null, pickup: x.s.pickup || null, mark, place: x.s.place || (mark && mark.place) || null, ingevoegd: !!x.s.ingevoegd });
    }
    r.inserted = r.segs.filter(x => x.s.ingevoegd && (x.s.k === 'pauze' || x.s.k === 'laden')).map(x => ({ k: x.s.k, a: T0 + x.s.t0, b: T0 + x.s.t1, at: x.s.at || null }));
    const firstStop = r.stops.find(x => !x.pickup) || r.stops[0];
    r.klant = r.stops.length ? klantNaam(firstStop.name, t, firstStop.mark) : (r.routes[0] && r.routes[0].detour ? 'Eigen rit' : klantNaam('', t));
    r.ophaal = r.stops.some(x => x.pickup) ? (r.stops.find(x => x.pickup).pickup.id) : null;
    r.dest = r.stops.filter(x => !x.pickup).map(x => x.name);
    if (!r.dest.length && r.ophaal) r.dest = [`Oplegger ${r.ophaal} ophalen`];
  }
  const data = () => { if (!cache || cacheVer !== ver) { cache = build(); cacheVer = ver; } return cache; };

  // ---------- toestand op tijdstip T (abs. minuten van de dag) ----------
  function stateOf(r, T, S) {
    const s = S && S.get(r.t.id); const t = r.t;
    // rel van T in het dagplan van het voertuig (zelfde regel als fleet.stateAt)
    const rel = (((T - t.dayStart) % 1440) + 1440) % 1440; const at = t.dayStart + rel;
    let st, cur = null, si = s ? s.si : -1;
    if (s && si >= r.i0 && si <= r.i1 && at >= r.dep) { cur = t.plan[si]; st = cur.k === 'drive' ? ((cur.delay > 0 || (cur.gepland !== undefined && t.dayStart + cur.t1 > cur.gepland + 0.5)) && !t.delayResolved ? 'vertraagd' : 'onderweg') : cur.k === 'stop' ? 'klant' : cur.k === 'pauze' || cur.k === 'laden' ? 'pauze' : at >= r.end ? 'afgerond' : 'onderweg'; }
    else st = at < r.dep ? 'gepland' : 'afgerond';
    if (st !== 'gepland' && st !== 'afgerond' && at >= r.end) st = 'afgerond';
    const done = r.stops.filter(x => x.dep <= at).length;
    const next = st === 'gepland' ? r.stops[0] || null : st === 'afgerond' ? null : r.stops.find(x => x.dep > at) || null;
    let eta, etaWhat, dev;
    if (st === 'gepland') { eta = r.dep; etaWhat = 'vertrek'; dev = r.dep - r.depPlan; }
    else if (st === 'afgerond') { eta = r.end; etaWhat = 'terug'; dev = r.end - r.endPlan; }
    else if (next && next.arr > at) { eta = next.arr; etaWhat = next.name; dev = next.arr - next.plan; }
    else if (next) { eta = next.dep; etaWhat = `vertrek ${next.name}`; dev = next.arr - next.plan; }
    else { eta = r.end; etaWhat = `terug ${t.base.n}`; dev = r.end - r.endPlan; }
    const winMiss = next && next.arr > at ? lateBy(next.arr, next.win) : 0;
    const lateStops = r.stops.filter(x => x.arr <= at && lateBy(x.arr, x.win) > 0).length;
    return { st, done, n: r.stops.length, next, eta, etaWhat, dev: Math.round(dev), winMiss: Math.round(winMiss), lateStops, cur, at };
  }
  function ritOf(t, T) {
    const L = data().byTruck.get(t) || []; if (!L.length) return null;
    const rel = (((T - t.dayStart) % 1440) + 1440) % 1440; const at = t.dayStart + rel;
    return L.find(r => at >= r.dep && at < r.end) || L.find(r => at < r.dep) || L[L.length - 1];
  }
  // naam(route, id): een vast ritnummer voor een route die de planner toevoegt (een rit uit de pool)
  const naam = (route, id) => { ids.set(route, id); ver++; };
  // de rit bij een ritnummer van fleet.js (1, 2, ... in de routes van het voertuig: blocks, dockPlan, eventsOf)
  const vanNr = (t, nr) => { if (!t || !nr) return null; const rt = t.routes[nr - 1]; return rt ? (data().byTruck.get(t) || []).find(r => r.routes.includes(rt)) || null : null; };
  return { all: () => data().rits, get: id => data().byId.get(id) || null, ofTruck: t => data().byTruck.get(t) || [], stateOf, ritOf, vanNr, bump, naam, ver: () => ver };
}

// ---------- weergave Ritten ----------
export const devHtml = (rs, short) => {
  if (rs.st === 'gepland' && rs.dev <= 0) return '<span class="mut">op tijd</span>';
  if (rs.dev <= 0 && !rs.winMiss) return `<span class="tok">${short ? 'op tijd' : 'op tijd'}</span>`;
  const cls = rs.winMiss > 0 ? 'tbad' : rs.dev >= 15 ? 'twarn' : 'mut';
  return `<b class="${cls}" style="font-weight:600" title="${rs.winMiss > 0 ? `${rs.winMiss} min na het tijdvenster` : 'binnen het tijdvenster'}">${signMin(rs.dev)}</b>`;
};
export function ritRows(ctx) {
  const T = ctx.state.simTime; const { R, S } = ctx;
  return R.all().filter(r => ctx.inScope(r.t)).sort((a, b) => a.dep - b.dep).map(r => {
    const rs = R.stateOf(r, T, S);
    return { r, rs, id: r.id, st: rs.st, t: r.t.id, tr: r.tr ? r.tr.id : '', driver: r.driver, sp: r.base.n, klant: r.klant, div: r.div, dest: r.dest.join(', '), dep: r.dep, end: r.end, eta: rs.eta, dev: rs.dev, prog: rs.n ? rs.done / rs.n : 0, km: r.km };
  });
}
const RORDER = { vertraagd: 0, klant: 1, onderweg: 2, pauze: 3, gepland: 4, afgerond: 5 };
export function renderRitten(ctx, el) {
  if (!ctx.ui.ritTable) {
    const T = () => ctx.state.simTime;
    const cols = [
      { k: 'id', l: 'Rit', w: 84, req: true, html: x => `<b>${esc(x.id)}</b>` },
      { k: 'st', l: 'Status', w: 110, sort: x => RORDER[x.st], html: x => ritBadge(x.st) },
      { k: 'dep', l: 'Vertrek', w: 80, r: true, sort: x => x.dep, html: x => `${hhmm(x.dep)}${x.dep - x.r.depPlan > 0 ? ` <small class="twarn">+${Math.round(x.dep - x.r.depPlan)}</small>` : ''}`, csv: x => hhmm(x.dep) },
      { k: 't', l: 'Voertuig', w: 90, html: x => plate(x.t) },
      { k: 'driver', l: 'Chauffeur', w: 130, mw: 150, html: x => x.driver ? esc(x.driver) : '<span class="mut">–</span>' },
      { k: 'tr', l: 'Oplegger', w: 86, def: false, html: x => x.tr ? esc(x.tr) : x.r.t.kind === 'trekker' ? '<span class="mut">solo</span>' : '<span class="mut">–</span>' },
      { k: 'sp', l: 'Standplaats', w: 100, mw: 130, def: false },
      { k: 'klant', l: 'Klant', w: 110, def: false },
      { k: 'dest', l: 'Bestemmingen', w: 170, mw: 200, html: x => { const d = x.r.dest; return `<span title="${esc(d.join(', '))}">${esc(d[0] || '')}${d.length > 1 ? ` <span class="mut">+${d.length - 1}</span>` : ''}</span>`; } },
      { k: 'prog', l: 'Stops', w: 64, r: true, sort: x => x.prog, html: x => `${x.rs.done}/${x.rs.n}`, csv: x => `${x.rs.done}/${x.rs.n}` },
      { k: 'eta', l: 'ETA', w: 96, r: true, sort: x => x.st === 'afgerond' ? Infinity : x.eta, html: x => x.st === 'afgerond' ? '<span class="mut">–</span>' : `${hhmm(x.eta)} <small>${esc(x.rs.st === 'gepland' ? 'vertrek' : x.rs.next ? 'stop' : 'terug')}</small>`, csv: x => x.st === 'afgerond' ? '' : hhmm(x.eta) },
      { k: 'dev', l: 'Afwijking', w: 90, r: true, sort: x => x.rs.winMiss > 0 ? 1000 + x.dev : x.dev, html: x => devHtml(x.rs), desc: true },
      { k: 'end', l: 'Terug', w: 70, r: true, sort: x => x.end, html: x => hhmm(x.end), csv: x => hhmm(x.end) },
      { k: 'km', l: 'km', w: 60, r: true, html: x => fmt(x.km), csv: x => Math.round(x.km), def: false },
      { k: 'div', l: 'Divisie', w: 140, def: false, html: x => esc(ctx.DIV[x.div].n), csv: x => ctx.DIV[x.div].n },
    ];
    ctx.ui.ritTable = createTable(ctx, el, {
      id: 'ritten', unit: 'ritten', csvName: 'ritten.csv', key: x => x.id, cols, sort: ['st', 1],
      rows: () => ritRows(ctx),
      // de ingang om de planning aan te passen: het planbord, waar je ritten versleept
      tools: () => ctx.can('act') ? `<button class="btn sm" type="button" data-open="view:planbord" title="Ritten verslepen naar een ander voertuig of een andere tijd">${ic('gantt', 15)}Planning aanpassen</button>` : '',
      search: { ph: 'Zoek rit, voertuig, chauffeur, winkel', text: x => `${x.id} ${x.t} ${x.driver} ${x.tr} ${x.dest} ${x.sp} ${x.klant} ${x.r.t.plate}` },
      filters: [
        { id: 'st', l: 'Status', kind: 'chips', opts: pool => ['vertraagd', 'onderweg', 'klant', 'pauze', 'gepland', 'afgerond'].map(k => ({ v: k, l: RST[k].n, n: pool.filter(x => x.st === k).length, dot: RST[k].cls })).filter(o => o.n || o.v === 'vertraagd'), test: (x, s) => s.has(x.st) },
        { id: 'uur', l: 'Vertrek', kind: 'menu', single: true, all: 'Hele dag', opts: pool => [{ v: '60', l: 'Komend uur', n: pool.filter(x => x.st === 'gepland' && day(x.dep - T()) <= 60).length }, { v: '180', l: 'Komende 3 uur', n: pool.filter(x => x.st === 'gepland' && day(x.dep - T()) <= 180).length }, { v: 'late', l: 'Buiten tijdvenster', n: pool.filter(x => x.rs.winMiss > 0 || x.rs.lateStops > 0).length }], test: (x, s) => s.has('late') ? (x.rs.winMiss > 0 || x.rs.lateStops > 0) : x.st === 'gepland' && day(x.dep - T()) <= +[...s][0] },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => [...new Set(pool.map(x => x.sp))].sort().map(n => ({ v: n, l: n, n: pool.filter(x => x.sp === n).length })), test: (x, s) => s.has(x.sp) },
        { id: 'klant', l: 'Klant', kind: 'menu', opts: pool => [...new Set(pool.map(x => x.klant))].sort().map(n => ({ v: n, l: n, n: pool.filter(x => x.klant === n).length })), test: (x, s) => s.has(x.klant) },
        { id: 'div', l: 'Divisie', kind: 'menu', opts: pool => Object.keys(ctx.DIV).map(k => ({ v: k, l: ctx.DIV[k].n, n: pool.filter(x => x.div === k).length })).filter(o => o.n), test: (x, s) => s.has(x.div) },
      ],
      bulk: [
        { id: 'map', l: 'Toon op kaart', icon: 'map', run: rows => ctx.showTrucksOnMap(rows.map(x => x.r.t)) },
        { id: 'msg', l: 'Bericht aan chauffeurs', icon: 'msg', run: rows => ctx.bulkMessage(rows.map(x => x.r.t)) },
        { id: 'csv', l: 'Exporteer selectie', icon: 'download', run: rows => ctx.ui.ritTable.exportCsv(rows, 'ritten-selectie.csv') },
      ],
      open: x => ctx.go(`rit/${x.id}`),
      menuLabel: x => `Rit ${x.id}`,
      menu: x => [
        { l: 'Open rit', icon: 'route', run: () => ctx.go(`rit/${x.id}`) },
        { l: 'Volg op de kaart', icon: 'map', run: () => ctx.go(`kaart:truck:${x.r.t.id}`) },
        x.st === 'gepland' && ctx.can('act') && { l: 'Verplaats op het planbord', sub: 'het blok staat klaar om te slepen', icon: 'gantt', run: () => ctx.go(`planbord/${x.id}`) },
        x.st === 'gepland' && ctx.can('act') && { l: 'Waar past hij?', sub: 'kandidaten getoetst op de regels', icon: 'target', run: () => IP.waarPast(ctx, x.r) },
        ctx.can('act') && x.r.dienst && { l: `Bericht aan ${x.driver || 'de chauffeur'}`, icon: 'msg', run: () => ctx.bulkMessage([x.r.t]) },
        { sep: true },
        { l: `Voertuig ${x.r.t.id}`, icon: 'truck', run: () => ctx.go(`voertuig/${x.r.t.id}/vandaag`) },
        x.r.person && { l: x.driver, sub: 'chauffeur', icon: 'user', run: () => ctx.go(`persoon/${x.r.person.id}`) },
      ],
      rowCls: x => x.st === 'afgerond' ? 'dim' : '',
      emptyTxt: () => ['Geen ritten in je werkgebied', 'Pas je werkgebied aan om ritten van andere standplaatsen te zien.'],
      mobile: { t: x => `<b>${esc(x.id)}</b> ${plate(x.t)}`, r: x => ritBadge(x.st), m: x => `${esc(x.klant)} · ${esc(x.r.dest.slice(0, 2).join(', '))}<br>vertrek ${hhmm(x.dep)} · ETA ${hhmm(x.eta)} · ${x.rs.done}/${x.rs.n} ${x.rs.n === 1 ? 'stop' : 'stops'} · ${x.driver ? esc(x.driver) : 'geen chauffeur'}` },
    });
  }
  ctx.ui.ritTable.refresh(true);
}

// ---------- ritpagina (#rit/<id>) ----------
export function ritPage(ctx, id) {
  const r = ctx.R.get(id); if (!r) return null;
  const T = ctx.state.simTime; const rs = ctx.R.stateOf(r, T, ctx.S); const t = r.t; const s = ctx.S.get(t.id) || ctx.stAt(t, T); const at = rs.at;
  const active = rs.st !== 'gepland' && rs.st !== 'afgerond';
  // mijlpalen: vertrek, elke stop, terug
  const rowsM = [];
  const tm = (x, cls = '') => `<span class="${cls}">${hhmm(x)}</span>`;
  const depDone = at >= r.dep;
  // dockblokken aan het begin: wachten op een vrij dock, laden aan het dock (bakwagen of bus)
  for (const x of t.plan.slice(r.i0, r.i1 + 1)) { if (x.k !== 'terrein' || !(x.wachtDock || x.dockSoort === 'laden')) continue; const a = t.dayStart + x.t0, b = t.dayStart + x.t1; rowsM.push(`<tr class="${at >= b ? 'done' : at >= a ? 'now' : ''}"><td class="mk"><i></i></td><td><b>${x.wachtDock ? 'Wacht op een vrij dock' : `Laden aan dock ${x.dock || ''}`.trim()}</b><small class="mut">${Math.round(x.t1 - x.t0)} min op ${esc(t.base.n)}</small></td><td>–</td><td class="r">${hhmm(a)}</td><td class="r">${at >= a ? tm(a) : `<span class="mut">${hhmm(a)}</span>`}</td><td class="r mut">–</td></tr>`); }
  if (r.koppel) rowsM.push(`<tr class="${at >= t.dayStart + r.koppel.t1 ? 'done' : ''}"><td class="mk"><i></i></td><td><b>Koppelen ${esc(r.koppel.tr ? r.koppel.tr.id : '')}${r.koppel.dock ? ` · dock ${r.koppel.dock}` : ''}</b><small class="mut">${esc(r.koppel.tr ? `${TRT[r.koppel.tr.type].n.toLowerCase()}${r.koppel.tr.lading ? `, ${r.koppel.tr.lading}` : ''}` : '')}</small></td><td>–</td><td class="r">${hhmm(t.dayStart + r.koppel.t0)}</td><td class="r">${hhmm(t.dayStart + r.koppel.t0)}</td><td class="r mut">–</td></tr>`);
  rowsM.push(`<tr class="${depDone ? 'done' : ''}"><td class="mk"><i></i></td><td><b>Vertrek ${esc(t.base.n)}</b><small class="mut">standplaats</small></td><td>–</td><td class="r">${hhmm(r.depPlan)}</td><td class="r">${depDone ? tm(r.dep) : `<span class="mut">${hhmm(r.dep)}</span>`}</td><td class="r">${r.dep - r.depPlan > 0 ? `<span class="twarn">+${Math.round(r.dep - r.depPlan)} min</span>` : '<span class="mut">op tijd</span>'}</td></tr>`);
  for (const p of r.inserted.filter(x => x.a < (r.stops[0] ? r.stops[0].arr : Infinity))) rowsM.push(insRow(p, at));
  r.stops.forEach((x, k) => {
    const arrived = at >= x.arr, left = at >= x.dep, now = arrived && !left; const late = lateBy(x.arr, x.win) > 0;
    rowsM.push(`<tr class="${left ? 'done' : now ? 'now' : ''} ${late && arrived ? 'lt' : ''}"><td class="mk"><i></i></td><td><b>${esc(x.name)}</b><small class="mut">${x.pickup ? `oplegger ${esc(x.pickup.id)} ophalen` : x.swap ? `oplegger wisselen: ${esc(x.swap.drop.id)} blijft${x.swap.take ? `, ${esc(x.swap.take.id)} mee` : ''}` : `${x.seg.wacht ? `wacht ${Math.round(x.seg.wacht)} min, ` : ''}${x.seg.actie === 'laden' ? 'laden' : 'lossen'} ${Math.round(x.seg.los !== undefined && x.seg.los !== null ? x.seg.los : x.dep - x.arr)} min`}${x.ingevoegd ? ' · ingepland door de planner' : ''}</small></td><td>${x.win ? `${hhmm(x.win[0])}–${hhmm(x.win[1])}${x.winMoved ? ' <small class="mut">bijgesteld</small>' : ''}` : '<span class="mut">–</span>'}</td><td class="r">${hhmm(x.plan)}</td><td class="r">${arrived ? tm(x.arr) : `<span class="mut">${hhmm(x.arr)}</span>`}${now ? ' <small class="tok">nu</small>' : ''}</td><td class="r">${late ? `<span class="late">${x.arr > x.win[1] ? `+${Math.round(x.arr - x.win[1])} na venster` : ''}</span>` : x.arr - x.plan > 0 ? `<span class="twarn">+${Math.round(x.arr - x.plan)} min</span>` : '<span class="ok">op tijd</span>'}</td></tr>`);
    for (const p of r.inserted.filter(y => y.a >= x.dep - 0.01 && (k === r.stops.length - 1 || y.a < r.stops[k + 1].arr))) rowsM.push(insRow(p, at));
  });
  const back = at >= r.end;
  rowsM.push(`<tr class="${back ? 'done' : ''}"><td class="mk"><i></i></td><td><b>Terug ${esc(t.base.n)}</b><small class="mut">${r.ontkoppel ? `afkoppelen ${esc(r.ontkoppel.tr ? r.ontkoppel.tr.id : '')}${r.ontkoppel.dock ? ` aan dock ${r.ontkoppel.dock}` : ''}` : r.retour ? `retouren aan dock ${r.retour.dock || ''}`.trim() : t.ev ? 'laden op het terrein' : 'terrein'}</small></td><td>–</td><td class="r">${hhmm(r.endPlan)}</td><td class="r">${back ? tm(r.end) : `<span class="mut">${hhmm(r.end)}</span>`}</td><td class="r">${r.end - r.endPlan > 0 ? `<span class="twarn">+${Math.round(r.end - r.endPlan)} min</span>` : '<span class="mut">op tijd</span>'}</td></tr>`);
  function insRow(p, at2) { return `<tr class="${at2 >= p.b ? 'done' : at2 >= p.a ? 'now' : ''}"><td class="mk"><i></i></td><td><b>${p.k === 'pauze' ? 'Pauze' : 'Snelladen'}${p.at ? ` bij ${esc(p.at)}` : ''}</b><small class="mut">ingepland door de planner, ${Math.round(p.b - p.a)} min</small></td><td>–</td><td class="r mut">–</td><td class="r">${hhmm(p.a)}</td><td class="r mut">–</td></tr>`; }
  const k1 = active ? [rs.next ? 'ETA volgende stop' : 'ETA terug', hhmm(rs.eta), esc(rs.etaWhat)] : rs.st === 'gepland' ? ['Vertrek', hhmm(r.dep), `over ${durTxt(day(r.dep - T))}`] : ['Terug', hhmm(r.end), `afgerond, ${esc(t.base.n)}`];
  const devCls = rs.winMiss > 0 ? 'bad' : rs.dev >= 15 ? 'warn' : rs.dev <= 0 ? 'ok' : '';
  const k2 = ['Afwijking', rs.dev > 0 ? `+${rs.dev} <em>min</em>` : 'op tijd', rs.winMiss > 0 ? `${rs.winMiss} min na het tijdvenster` : rs.lateStops ? `${rs.lateStops} stop${rs.lateStops === 1 ? '' : 's'} buiten venster` : 'binnen de tijdvensters'];
  const k3 = ['Voortgang', `${rs.done} <em>van ${rs.n} ${rs.n === 1 ? 'stop' : 'stops'}</em>`, `${fmt(r.km)} km · terug ${hhmm(r.end)}`];
  const msgs = (t.msgs || []).slice(-6);
  const log = ctx.ritLog(r).slice(0, 12);
  // statusbalk (gepland, onderweg, bij klant, afgerond) en slimme knoppen naar wat bij de rit hoort
  const fase = rs.st === 'vertraagd' || rs.st === 'pauze' ? 'onderweg' : rs.st;
  const nz = ctx.Z.list().filter(z => z.rit === r.id).length; const nm = (t.msgs || []).filter(m => m.T >= r.dep - 30 && m.T <= r.end + 30).length;
  const strip = `<div class="pg-strip">${statusBar([['gepland', 'Gepland'], ['onderweg', rs.st === 'vertraagd' ? 'Onderweg, vertraagd' : rs.st === 'pauze' ? 'Onderweg, pauze' : 'Onderweg'], ['klant', 'Bij klant'], ['afgerond', 'Afgerond']], fase, 'Voortgang van de rit')}${smartBtns([
    [t.id, `voertuig · ${ctx.VST[s.st].n.toLowerCase()}`, `voertuig/${t.id}/vandaag`, t.kind === 'bus' ? 'bus' : 'truck'],
    r.tr && [r.tr.id, 'oplegger', `oplegger/${r.tr.id}/vandaag`, 'trailer'],
    r.person && [r.person.short, 'chauffeur', `persoon/${r.person.id}`, 'user'],
    [`${rs.done}/${rs.n}`, rs.n === 1 ? 'stop gedaan' : 'stops gedaan', null, 'pin'],
    [nz, nz === 1 ? 'melding' : 'meldingen', `lijst:meldingen:${r.id}`, 'alert'],
    [nm, nm === 1 ? 'bericht' : 'berichten', `kaart:truck:${t.id}`, 'msg'],
  ])}</div>`;
  const kan = ctx.can('act') && rs.st === 'gepland';
  // waar de vertraging ontstond: het stuk rijden waar de simulatie de vertraging op legde (pas als dat stuk gereden wordt;
  // de oorzaak staat niet in de data), de aankomst tegen het venster bij de stop erna, en het voorstel van de assistent
  // met het effect in minuten
  const vSeg = t.delayResolved ? null : r.segs.map(x => x.s).find(x => x.k === 'drive' && (x.delay || 0) > 0);
  let vtHtml = '';
  if (vSeg && at >= t.dayStart + vSeg.t0) {
    const a0 = t.dayStart + vSeg.t0, a1 = t.dayStart + vSeg.t1;
    const van = [...r.stops].reverse().find(x => x.dep <= a0 + 0.5); const naar = r.stops.find(x => x.arr >= a1 - 0.5);
    const laat = naar ? lateBy(naar.arr, naar.win) : 0;
    const z = ctx.Z.list().find(x => x.kind === 'Vertraging' && x.rit === r.id && x.present && !x.done); const p = z && ctx.voorstelVoor(z.key);
    const aank = naar ? `${at >= naar.arr ? 'Aangekomen' : 'Verwacht'} bij ${naar.name} om ${hhmm(naar.arr)}${naar.win ? `, venster tot ${hhmm(naar.win[1])}: ${laat > 0 ? `${laat} min te laat` : 'binnen het venster'}` : ''}.` : `Terug op ${t.base.n} om ${hhmm(r.end)}.`;
    vtHtml = `<div class="pg-sec"><h2>Vertraging <span class="sub">waar hij ontstond</span></h2>
      <div class="note ${laat > 0 ? 'bad' : 'warn'} vt-plek">${ic('route', 16)}<div><b>+${Math.round(vSeg.delay)} min op weg van ${esc(van ? van.name : t.base.n)} naar ${esc(naar ? naar.name : `${t.base.n}`)}</b><span>Dit stuk ${at >= a1 ? "liep" : "loopt"} van ${hhmm(a0)} tot ${hhmm(a1)}. ${esc(aank)}</span><span class="hint">${vSeg.oorzaak ? `Oorzaak: ${esc(vSeg.oorzaak)} (oefendag, gesimuleerd); met echte ritten komt die uit NDW of de boordcomputer.` : 'Gesimuleerd: de oorzaak (file, werk aan de weg) staat niet in de data; met echte ritten komt die uit de boordcomputer.'}</span></div></div>
      ${p ? `<section class="prop focus" aria-label="Voorstel van de assistent"><div class="prop-h">${ic('spark', 15)}Voorstel van de assistent · ${esc(p.kort)}</div><p>${esc(p.action)}</p>${p.effect && p.effect.length ? `<ul class="eff">${p.effect.map(x => `<li class="${x.cls || ''}">${esc(x.t)}</li>`).join('')}</ul>` : ''}${ctx.can('act') ? `<div class="prop-a"><button class="btn sm pri" type="button" data-pastoe="${esc(p.id)}">${ic('check', 14)}Pas toe</button>${z ? `<button class="btn sm ghost" type="button" data-open="melding/${esc(z.id)}">Open de melding</button>` : ''}</div>` : ''}</section>` : z ? `<p class="hint">Geen voorstel: de assistent vindt geen vrij voertuig of reserve dichtbij. <button class="lnk" type="button" data-open="melding/${esc(z.id)}">Open de melding</button></p>` : ''}
    </div>`;
  }
  const html = `<div class="pg" data-rit="${esc(r.id)}">
    <div class="pg-bar"><nav class="crumbs" aria-label="Kruimelpad"><button type="button" data-open="view:ritten">Ritten</button>${ic('chev', 12)}<span>${esc(r.id)}</span></nav><div class="act"><button class="btn sm" type="button" data-back="1">${ic('back', 15)}Terug</button></div></div>
    <div class="pg-h"><div class="pg-id"><h1>Rit ${esc(r.id)} ${ritBadge(rs.st)}</h1><div class="sub">${esc(r.klant)} · ${esc(r.dest.join(', '))}</div><div class="sub">${esc(ctx.DIV[r.div].n)} · standplaats ${esc(t.base.n)} · ${hhmm(r.dep)} tot ${hhmm(r.end)}${r.ophaal ? ` · haalt ${esc(r.ophaal)} op` : ''}</div></div>
      <div class="pg-a">${kan ? `<button class="btn sm pri" type="button" data-open="planbord/${esc(r.id)}" title="Open het planbord met deze rit gekozen">${ic('gantt', 15)}Verplaats deze rit</button><button class="btn sm" type="button" data-ritwaar="1" title="Toont de voertuigen waar deze rit ook past, elk getoetst">${ic('target', 15)}Waar past hij?</button>` : ''}<button class="btn sm" type="button" data-open="kaart:truck:${esc(t.id)}">${ic('map', 15)}Op kaart</button>${ctx.can('act') && s.dienst ? `<button class="btn sm" type="button" data-ritmsg="1">${ic('msg', 15)}Bericht</button>` : ''}</div></div>
    ${strip}<div class="pg-kpis"><div><small>${k1[0]}</small><b>${k1[1]}</b><span>${k1[2]}</span></div><div class="${devCls}"><small>${k2[0]}</small><b>${k2[1]}</b><span>${k2[2]}</span></div><div><small>${k3[0]}</small><b>${k3[1]}</b><span>${k3[2]}</span></div></div>
    <div class="pg-cols wide"><div class="pg-main">${vtHtml}
      <div class="pg-sec"><h2>Mijlpalen <span class="sub">gepland naast werkelijk</span></h2><div class="tbl-x"><table class="mp"><thead><tr><th class="mk"></th><th>Mijlpaal</th><th>Venster</th><th class="r">Gepland</th><th class="r">${active || rs.st === 'afgerond' ? 'Werkelijk' : 'Verwacht'}</th><th class="r">Afwijking</th></tr></thead><tbody>${rowsM.join('')}</tbody></table></div><p class="hint" style="margin-top:8px">Werkelijke tijden komen uit de boordcomputer; nog te rijden tijden zijn de ETA uit het actuele plan (grijs).</p></div>
      <div class="pg-sec"><h2>Logboek <span class="sub">${log.length}</span></h2>${log.length ? `<ol class="tline">${log.map(e => `<li class="tli ${e.act ? 'act' : 'done'}"><time>${hhmm(e.T)}</time><div class="tl-c"><b>${esc(e.txt)}</b>${e.sub ? `<span>${esc(e.sub)}</span>` : ''}</div></li>`).join('')}</ol>` : empty('Nog niets gebeurd op deze rit', 'Vertrek, aankomsten en acties van de planner verschijnen hier.')}</div>
    </div><div class="pg-side">
      <div class="mapslot tall" data-mapslot="rit"></div>
      <div class="pg-sec"><h2>Betrokken</h2><div style="display:flex;flex-direction:column;gap:8px">${ctx.objCard('truck', t)}${r.tr ? ctx.objCard('trailer', r.tr) : ''}${r.person ? ctx.objCard('person', r.person) : ''}</div></div>
      <div class="pg-sec"><h2>Berichten <span class="sub">voorgelezen in de cabine</span></h2>${msgs.length ? `<div class="msgs">${msgs.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)} · ${m.me ? 'planning' : esc((r.driver || 'chauffeur').split(' ')[0])}</time></div>`).join('')}</div>` : '<p class="hint">Nog geen berichten op deze rit.</p>'}${ctx.can('act') && s.dienst && active ? `<div class="ask" style="margin-top:10px"><label class="sr" for="ritMsg">Bericht aan ${esc(r.driver)}</label><input class="fld" id="ritMsg" placeholder="Bericht aan ${esc((r.driver || '').split(' ')[0])}" autocomplete="off"><button class="btn" type="button" id="ritMsgBtn">${ic('send', 15)}Stuur</button></div>` : ''}</div>
    </div></div></div>`;
  const bind = el => {
    const b = el.querySelector('#ritMsgBtn'); if (b) { const i = el.querySelector('#ritMsg'); const send = () => { const v = i.value.trim(); if (v) { ctx.sendMsg(t, v); i.value = ''; ctx.L.toast(`Bericht verstuurd naar ${r.driver}.`, { icon: 'send' }); ctx.rerenderPage(); } }; b.addEventListener('click', send); i.addEventListener('keydown', e => { if (e.key === 'Enter') send(); }); }
    on(el, 'click', '[data-ritmsg]', () => { const i = el.querySelector('#ritMsg'); if (i) i.focus(); else ctx.bulkMessage([t]); });
    on(el, 'click', '[data-share]', () => ctx.shareLink(t));
    on(el, 'click', '[data-ritwaar]', () => IP.waarPast(ctx, r, { na: () => ctx.rerenderPage() }));
    on(el, 'click', '[data-pastoe]', (e, b) => { const p = ctx.voorstelById(b.dataset.pastoe); if (p) { ctx.applyProposal(p); ctx.rerenderPage(); } });
    ctx.dockMap(el.querySelector('[data-mapslot]'), { rit: r });
  };
  return { html, bind, title: `Rit ${r.id}`, parent: 'ritten' };
}
