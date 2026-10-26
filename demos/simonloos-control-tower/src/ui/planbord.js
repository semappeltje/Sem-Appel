// Planbord op svelte-gantt (MIT): rijen zijn voertuigen (of chauffeurs, of docks), blokken zijn ritten. Een rit die nog
// niet begonnen is, sleep je naar een ander voertuig of een andere tijd; een rit uit de bak "Open ritten" sleep je op
// een voertuig. Bij het loslaten toetst toets.js direct (overlap, tijdvenster, rijtijd en pauze, rusttijd, accu en
// laadtijd, oplegger, dock); bij een fout gaat het blok terug en zegt het bord waarom. Toetsenbord: Tab naar een blok,
// pijl links en rechts schuift 5 minuten, Alt met pijl omhoog of omlaag zet het op het voertuig erboven of eronder,
// Enter opent het blok, W zoekt waar de rit past. svelte-gantt is al gecompileerd (geen Svelte nodig); wisselen naar een
// ander bord is dit ene bestand.
import { SvelteGantt, SvelteGanttTable, SvelteGanttExternal } from 'svelte-gantt';
import { SP, DIV } from '../places.js';
import { KIND, TRT } from '../fleet.js';
import { esc, ic, fmt, hhmm, plate, on, VST, ritBadge, swap, kortStop, initials } from './base.js';
import { poolInvoer, pool, poolNu, absT, docksVan, vensterAbs } from './planwijzig.js';
import * as IP from './inplannen.js';
import { openRitDialoog, kansChip, belSpan } from './openritten.js';
import { urgentie, urgentieTxt, urgentieKlas, prognose, voorkeurenVan, pastVoorkeur, ritVoor, toegewezen, wieSoort, collegaOm } from './invulling.js';

const MIN = 60000;
const KLEUR = { drive: 'var(--c-onderweg)', stop: 'var(--c-klant)', pauze: 'var(--c-pauze)', laden: '#0E7490', koppel: 'var(--c-terrein)', ontkoppel: 'var(--c-terrein)', terrein: 'var(--c-terrein)', dock: 'var(--c-terrein)' };
const NAAM = { drive: 'Rijden', stop: 'Bij klant', pauze: 'Pauze', laden: 'Laden accu', koppel: 'Koppelen', ontkoppel: 'Afkoppelen', terrein: 'Wachten', dock: 'Aan het dock' };
// een dockblok in het plan: laden aan het dock, retouren, wachten op een vrij dock
const segKlas = s => s.wachtDock ? 'k-wacht' : s.k === 'terrein' && s.dockSoort ? 'k-dock' : `k-${s.k}`;
const segNaam = s => s.wachtDock ? 'Wacht op een vrij dock' : s.dockSoort === 'laden' && s.k === 'terrein' ? `Laden aan dock ${s.dock || ''}`.trim() : s.dockSoort === 'aankomst' && s.k === 'terrein' ? `Retouren aan dock ${s.dock || ''}`.trim() : s.k === 'koppel' ? `Koppelen${s.tr ? ` ${s.tr.id}` : ''}${s.dock ? ` · dock ${s.dock}` : ''}` : s.k === 'ontkoppel' ? `Afkoppelen${s.dock ? ` · dock ${s.dock}` : ''}` : NAAM[s.k];
const OPL = { koel: 'koel', vries: 'vries', droog: 'droog', huif: 'schuifzeil', lzv: 'LZV', silo: 'silo', drank: 'dranken', city: 'city' };
const SOORTK = { trekker: 'trekker', bakwagen: 'bakwagen', bus: 'bestelbus' };
const REDEN = { ziek: 'Chauffeur ziek gemeld', 'uitval voertuig': 'Voertuig uitgevallen', 'extra rit klant': 'Extra rit van de klant', 'nieuw uit OTM5': 'Nieuw uit OTM5' };
const DOCKS = { vertrek: 'koppelen', laden: 'laden', aankomst: 'retouren' };
const MODES = [['voertuig', 'Per voertuig'], ['chauffeur', 'Per chauffeur'], ['dock', 'Docks']];
// terugblikken en vooruitkijken: een hele dag in het bord, je zoomt (zoveel uur in beeld) en scrolt of sleept door de tijd
const ZOOMS = [2, 6, 12, 24];
const DAGEN = [['gisteren', 'Gisteren'], ['vandaag', 'Vandaag'], ['morgen', 'Morgen']];
const RM = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// de arcering van de nachtdienst van gisteren, over het hele blok (in de tekstkleur, zodat hij in beide thema's werkt)
const STREEP = '<span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--text) 22%,transparent) 0 3px,transparent 3px 7px)"></span>';

export function renderPlanbord(ctx, el) {
  const pb = ctx.ui.pbState || (ctx.ui.pbState = createBoard(ctx, el));
  // een rit die klaar moet staan om te verplaatsen (#planbord/R-..., "Verplaats deze rit")
  if (ctx.ui.pbKlaar) { const id = ctx.ui.pbKlaar; ctx.ui.pbKlaar = null; if (pb.klaarzetten(id)) ctx.ui.pbFocus = id; pb.render(true); return; }
  pb.render();
}
export function updateNowline(ctx) { const pb = ctx.ui.pbState; if (pb) pb.nowline(); }

// De stand van het bord blijft na herladen staan (localStorage sl-planbord): rijen (voertuig, chauffeur of dock), zoom en
// of de bak met open ritten open staat altijd; de dag (gisteren, vandaag, morgen) en de filters alleen op dezelfde dag,
// zodat de volgende ochtend weer bij vandaag begint. Het zoekwoord niet: daar staat vaak een naam in.
const PBKEY = 'sl-planbord';
function standVan(ctx) {
  // op een telefoon begint het bord met 6 uur in beeld en de bak dicht
  const nar = !!(ctx.narrow && ctx.narrow());
  const f = { div: 'alle', kind: 'alle', st: 'alle', q: '', per: 'voertuig', zoom: nar ? 6 : 12, dag: 'vandaag', poolOpen: !nar, poolDag: 'vandaag' };
  let s = null; try { s = JSON.parse(ctx.store.get(PBKEY) || 'null'); } catch { s = null; }
  if (s && typeof s === 'object') {
    if (MODES.some(m => m[0] === s.per)) f.per = s.per; if (ZOOMS.includes(s.zoom)) f.zoom = s.zoom; if (typeof s.poolOpen === 'boolean') f.poolOpen = s.poolOpen;
    if (s.datum === ctx.A.DAY) {
      if (DAGEN.some(d => d[0] === s.dag)) f.dag = s.dag;
      for (const k of ['div', 'kind']) if (typeof s[k] === 'string' && s[k]) f[k] = s[k];
      if (['alle', 'vertraagd', 'onderweg', 'klant', 'terrein'].includes(s.st)) f.st = s.st;
    }
  }
  f.poolDag = f.dag === 'morgen' ? 'morgen' : 'vandaag';
  return f;
}

function createBoard(ctx, el) {
  const { fleet, state, S, R } = ctx; const ui = ctx.ui;
  const f = ui.pb || (ui.pb = standVan(ctx));
  if (!ZOOMS.includes(f.zoom)) f.zoom = ctx.narrow && ctx.narrow() ? 6 : 12; if (!f.dag) f.dag = 'vandaag';
  // pas bewaren als de planner iets verandert (zolang niet, bewaart de browser niets)
  const standTekst = () => JSON.stringify({ per: f.per, zoom: f.zoom, dag: f.dag, div: f.div, kind: f.kind, st: f.st, poolOpen: !!f.poolOpen, datum: ctx.A.DAY });
  let bewaard = standTekst();
  function bewaar() { const s = standTekst(); if (s !== bewaard) { bewaard = s; ctx.store.set(PBKEY, s); } }
  const DAY0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const ms = m => DAY0 + m * MIN; const mm = x => (x - DAY0) / MIN;
  let gantt = null, sig = '', taskSig = new Map(), lastNow = -1, rowsNow = [], tasksNow = [], bucket = -1, externals = [], rebuildSoon = 0;

  // de kop is een werkbalk; de legenda en de filters zitten achter een knop (rust). De eerste keer een korte uitleg.
  const HINT = 'sl-pbhint';
  el.innerHTML = `<div class="vbar pb-bar" data-pb="bar"></div>
    <div class="pb-hint" data-pb="hint" ${ctx.store.get(HINT) === '1' ? 'hidden' : ''}>${ic('gantt', 18)}<p><b>Planning aanpassen</b> Sleep een rit naar een ander voertuig of een andere tijd, of klik hem en schuif met de pijltjes. Het bord toetst meteen. Ritten zonder voertuig staan onderaan: kies Rit inplannen.</p><button class="btn sm" type="button" data-pbhint="1">Begrepen</button></div>
    <span class="sr" data-pb="cnt" aria-live="polite"></span><p class="pb-dagnote hint" data-pb="dagnote" hidden></p>
    <div class="pb-main"><div class="pb-gantt" data-pb="gantt" role="application" aria-label="Planbord: blokken zijn ritten; sleep of gebruik Alt met pijltjes om een rit te verplaatsen"></div></div>
    <section class="pb-pool" data-pb="pool" aria-label="Open ritten"></section>`;
  const $ = s => el.querySelector(s);

  // ---------- werkbalk ----------
  // De standplaats van het bord: die van het werkgebied, tenzij de planner een andere koos (de keuzelijst, of "Verplaats deze
  // rit" vanuit een zaak of rit van een andere standplaats: ui.pbVast). Dan blijft het bord daar, en de kop (ui.title, pbSp)
  // zegt dezelfde standplaats; zonder die keuze viel het bord stil terug op het werkgebied terwijl de rit er niet op stond.
  function spNu() { let sp = ctx.pbSp(); if (ui.pbVast && ui.pbVast === sp) return sp; if (ctx.spsInScope().length && !ctx.spsInScope().includes(sp)) { sp = ctx.spsInScope()[0]; ctx.setPbSp(sp); } return sp; }
  function bar(sp, all) {
    const divs = [...new Set(all.map(t => t.div))], kinds = [...new Set(all.map(t => t.kind))];
    if (f.div !== 'alle' && !divs.includes(f.div)) f.div = 'alle'; if (f.kind !== 'alle' && !kinds.includes(f.kind)) f.kind = 'alle';
    const list = ctx.spsInScope().concat(ctx.spsInScope().includes(sp) ? [] : [sp]).sort((a, b) => a.n.localeCompare(b.n));
    const nf = (f.div !== 'alle') + (f.kind !== 'alle') + (f.st !== 'alle');
    return `<label class="sr" for="pbSel">Standplaats</label><select class="fld" id="pbSel" style="width:150px">${list.map(s => `<option ${s === sp ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select>
      <label class="sr" for="pbPer">Rijen</label><select class="fld pb-per" id="pbPer">${MODES.map(([k, n]) => `<option value="${k}" ${f.per === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn sm${nf ? ' act' : ''}" type="button" data-pbfilters="1" aria-haspopup="true" aria-expanded="false" title="Divisie, soort voertuig en status">${ic('filter', 15)}Filters${nf ? ` <span class="n">${nf}</span>` : ''}</button>
      <div class="fsearch pb-q">${ic('search', 15)}<input class="fld" id="pbQ" type="search" placeholder="Zoek voertuig of naam" aria-label="Zoek voertuig of chauffeur" value="${esc(f.q)}" autocomplete="off"></div>
      <span class="grow"></span><div class="seg pb-dag" role="group" aria-label="Dag">${DAGEN.map(([k, n]) => `<button type="button" data-pbdag="${k}" aria-pressed="${f.dag === k}">${n}</button>`).join('')}</div>
      <div class="pb-tijd" role="group" aria-label="Door de tijd"><button class="ib" type="button" data-pbstap="-1" title="Vroeger (Shift met scrollwiel, of sleep het bord)" aria-label="Vroeger">${ic('chevl', 18)}</button><button class="btn sm" type="button" id="pbNow" title="Naar nu">${ic('clock', 15)}Nu</button><button class="ib" type="button" data-pbstap="1" title="Later" aria-label="Later">${ic('chev', 18)}</button></div>
      <label class="sr" for="pbZoom">Zoom</label><select class="fld pb-zoom" id="pbZoom" title="Zoveel uur in beeld (Ctrl met scrollwiel of knijpen)">${ZOOMS.map(z => `<option value="${z}" ${f.zoom === z ? 'selected' : ''}>${z} uur</option>`).join('')}</select>
      <button class="ib" type="button" data-pblegenda="1" aria-haspopup="true" aria-expanded="false" title="Legenda" aria-label="Legenda">${ic('help', 18)}</button>`;
  }
  // de filters in een popover: divisie, soort, status nu
  function filtersHtml(all) {
    const divs = [...new Set(all.map(t => t.div))], kinds = [...new Set(all.map(t => t.kind))];
    return `<div class="menu-h">Filters</div><div class="pb-fl">
      <label class="fl-r"><span>Divisie</span><select class="fld" id="pbDiv"><option value="alle">Alle divisies</option>${divs.map(d => `<option value="${d}" ${f.div === d ? 'selected' : ''}>${esc(DIV[d].n)}</option>`).join('')}</select></label>
      <label class="fl-r"><span>Soort</span><select class="fld" id="pbKind"><option value="alle">Alle soorten</option>${kinds.map(k => `<option value="${k}" ${f.kind === k ? 'selected' : ''}>${esc(KIND[k].mv[0].toUpperCase() + KIND[k].mv.slice(1))}</option>`).join('')}</select></label>
      <div class="fl-r"><span>Status nu</span><div class="chips">${['vertraagd', 'onderweg', 'klant', 'terrein'].map(s => `<button class="chip" type="button" data-pbst="${s}" aria-pressed="${f.st === s}"><i class="dot st-${s}"></i>${VST[s].n}</button>`).join('')}</div></div>
      ${ctx.narrow() ? `<label class="fl-r"><span>Dag</span><select class="fld" id="pbDagSel">${DAGEN.map(([k, n]) => `<option value="${k}" ${f.dag === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="fl-r"><span>Zoom</span><select class="fld" id="pbZoom2">${ZOOMS.map(z => `<option value="${z}" ${f.zoom === z ? 'selected' : ''}>${z} uur in beeld</option>`).join('')}</select></label>` : ''}
      <div class="fl-a"><span class="hint" data-pbfn></span><button class="btn sm ghost" type="button" data-pbreset="1">Alles tonen</button></div></div>`;
  }
  function openFilters(btn) {
    const sp = spNu(); const all = fleet.trucks.filter(t => t.base === sp);
    const telling = p => { const x = p.querySelector('[data-pbfn]'); if (x) x.textContent = counts(sp, rowsNow).split(' · ')[0]; };
    ctx.L.openPop(btn, filtersHtml(all), { label: 'Filters', cls: 'pb-flpop', onBind: p => {
      const opnieuw = () => { render(true); const h = filtersHtml(all); const keep = p.querySelector(':focus'); const sig = keep ? (keep.id || keep.dataset.pbst) : null; p.innerHTML = h; telling(p); if (sig) { const x = p.querySelector(`#${sig}`) || p.querySelector(`[data-pbst="${sig}"]`); if (x) x.focus(); } };
      on(p, 'change', '#pbDiv', e => { f.div = e.target.value; opnieuw(); });
      on(p, 'change', '#pbKind', e => { f.kind = e.target.value; opnieuw(); });
      on(p, 'click', '[data-pbst]', (e, b) => { f.st = f.st === b.dataset.pbst ? 'alle' : b.dataset.pbst; opnieuw(); });
      on(p, 'click', '[data-pbreset]', () => { f.div = 'alle'; f.kind = 'alle'; f.st = 'alle'; opnieuw(); });
      on(p, 'change', '#pbDagSel', e => { zetDag(e.target.value); ctx.L.closePop(); });
      on(p, 'change', '#pbZoom2', e => { zetZoom(+e.target.value); ctx.L.closePop(); });
      telling(p);
    } });
  }
  // de legenda in een popover, voor het bord dat je nu ziet
  function legendaHtml() {
    if (f.per === 'dock') return `<div class="menu-h">Legenda docks</div><div class="legend col"><span><i class="d-vertrek"></i>Koppelen voor vertrek</span><span><i class="d-laden"></i>Laden aan het dock</span><span><i class="d-aankomst"></i>Retouren en afkoppelen</span><span><i class="late"></i>Twee blokken tegelijk</span></div>`;
    return `<div class="menu-h">Legenda</div><div class="legend col">${['drive', 'stop', 'dock', 'pauze', 'laden'].map(k => `<span><i style="--c:${KLEUR[k]}"></i>${NAAM[k]}</span>`).join('')}<span><i class="wacht"></i>Wacht op een vrij dock</span><span><i class="gereden"></i>Gereden (gevuld)</span><span><i class="gepland"></i>Nog te rijden (licht)</span><span><i class="late"></i>Langer dan gepland (vertraging)</span><span><i class="open"></i>Open rit, nog geen voertuig</span><span><i class="ing"></i>Door de planner ingepland</span><span><i class="lock"></i>Begonnen, blijft op dit voertuig</span><span><i style="background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--text) 22%,transparent) 0 3px,transparent 3px 6px);box-shadow:inset 0 0 0 1px var(--line2)"></i>Nachtdienst van gisteren (gestreept)</span><span><i class="vk"></i>Tegen de voorkeur van de chauffeur</span><span><i class="av"></i>Gevraagd, wacht op een ja</span></div><p class="hint" style="padding:6px 12px 10px;max-width:280px">Een rit die nog niet begon, sleep je naar een ander voertuig of een andere tijd.</p>`;
  }
  on(el, 'click', '[data-pbfilters]', (e, b) => openFilters(b));
  on(el, 'click', '[data-pblegenda]', (e, b) => ctx.L.openPop(b, legendaHtml(), { label: 'Legenda', align: 'right' }));
  on(el, 'click', '[data-pbhint]', () => { ctx.store.set(HINT, '1'); const h = $('[data-pb=hint]'); if (h) h.hidden = true; });
  on(el, 'change', '#pbSel', e => { const sp = SP.find(s => s.n === e.target.value); ctx.setPbSp(sp); ui.pbVast = ctx.spsInScope().includes(sp) ? null : sp; render(true); ctx.refreshAll(false); });
  on(el, 'change', '#pbPer', e => { f.per = e.target.value; render(true); });
  on(el, 'change', '#pbZoom', e => zetZoom(+e.target.value));
  on(el, 'click', '[data-pbdag]', (e, b) => zetDag(b.dataset.pbdag));
  on(el, 'click', '[data-pbstap]', (e, b) => stap(+b.dataset.pbstap));
  on(el, 'click', '#pbNow', () => scrollNow(true));
  let qt = 0; on(el, 'input', '#pbQ', e => { f.q = e.target.value; clearTimeout(qt); qt = setTimeout(() => render(true), 160); });

  // ---------- rijen en blokken ----------
  const T = () => state.simTime;
  // het hele venster van de gekozen dag (minuten vanaf vandaag 00:00): vandaag tot 06:00 morgen (de nachtritten), gisteren, morgen
  function range() { return f.dag === 'gisteren' ? [-1440, 0] : f.dag === 'morgen' ? [1440, 2880] : [0, 1800]; }
  function vehicles(sp) {
    const q = f.q.trim().toLowerCase();
    return fleet.trucks.filter(t => t.base === sp && (f.div === 'alle' || t.div === f.div) && (f.kind === 'alle' || t.kind === f.kind))
      .filter(t => f.st === 'alle' || (S.get(t.id) || {}).st === f.st)
      .filter(t => !q || `${t.id} ${t.plate} ${t.diensten.map(d => d.driver).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (a.vandaag === 'inzet' ? 0 : 1) - (b.vandaag === 'inzet' ? 0 : 1) || a.dayStart - b.dayStart || a.id.localeCompare(b.id));
  }
  const ritStatus = r => ctx.R.stateOf(r, T(), S).st;
  // gepland tegen gereden: wat al gereden is staat gevuld, wat nog komt licht; het geplande blok is omlijnd, en een
  // vertraging (de rit duurt langer dan gepland) staat erachter in de statuskleur
  // av: de rit wacht op een ja (toegewezen, nog niet bevestigd): een arcering in de waarschuwingskleur over het hele blok,
  // boven de segmenten (anders dekken die hem af), en "gevraagd" in de tweede regel, zoals bij de rijen van een charter
  // opts.voor: tekst voor de tijden in de tweede regel; opts.streep: gestreept (de nachtdienst van gisteren)
  function ritHtml(r, rs, av = false, opts = {}) {
    const t = r.t; const P = t.plan; const a = P[r.i0].t0, b = P[r.i1].t1, len = Math.max(1, b - a);
    const segs = P.slice(r.i0, r.i1 + 1).filter(s => s.t1 - s.t0 > 0.5).map(s => `<i class="${segKlas(s)}" style="left:${((s.t0 - a) / len * 100).toFixed(2)}%;width:${((s.t1 - s.t0) / len * 100).toFixed(2)}%"></i>`).join('');
    const dest = r.dest.length ? kortStop(r.dest[0]) + (r.dest.length > 1 ? ` +${r.dest.length - 1}` : '') : 'rit';
    const nowPct = rs.st !== 'gepland' && rs.st !== 'afgerond' ? Math.max(0, Math.min(100, (rs.at - absT(t, a)) / len * 100)) : rs.st === 'afgerond' ? 100 : 0;
    const dl = t.delayResolved ? 0 : P.slice(r.i0, r.i1 + 1).reduce((x, s) => x + (s.k === 'drive' ? s.delay || 0 : 0), 0); const planPct = Math.max(0, Math.min(100, (len - dl) / len * 100));
    return `<span class="sg-r">${segs}</span>${nowPct < 100 ? `<span class="sg-fut" style="left:${nowPct.toFixed(1)}%"></span>` : ''}${dl ? `<span class="sg-plan" style="width:${planPct.toFixed(1)}%"></span><span class="sg-dl" style="left:${planPct.toFixed(1)}%"></span>` : ''}${av ? '<span class="sg-arc" aria-hidden="true"></span>' : ''}${opts.streep ? STREEP : ''}<span class="sg-l"><b>${esc(dest)}</b><small>${opts.voor ? esc(opts.voor) : ''}${av ? '<span class="sg-av">gevraagd</span> · ' : ''}${hhmm(absT(t, a))}–${hhmm(absT(t, b))}${dl ? ` · +${Math.round(dl)} min` : ''}</small></span>`;
  }
  // een stille markering als de rit slecht past bij de voorkeur van de chauffeur (fleet.past: divisie, dienstdeel, weekend,
  // regio); een rit die nog op een ja wacht, staat gearceerd
  function voorkeurVan(r) {
    const t = r.t; const s0 = t.plan[r.i0]; const d = s0 && s0.d !== null && s0.d !== undefined ? t.diensten.find(x => x.i === s0.d) : null; const p = d && d.person;
    if (!p) return null; const pr = pastVoorkeur(ctx, voorkeurenVan(ctx, p), ritVoor(ctx, t, absT(t, s0.t0)));
    return pr && pr.oordeel === 'past slecht' && pr.tegen.length ? `${p.short}: ${pr.tegen.join(', ')}` : null;
  }
  function aangevraagd(r) { const pid = (r.routes.find(x => x.pool) || {}).pool; if (!pid) return false; const it = pool(ctx).find(p => p.id === pid); return !!(it && it.toegewezen && it.toegewezen.status === 'aangevraagd'); }
  function ritTask(r, resourceId) {
    const rs0 = ctx.R.stateOf(r, T(), S); const t = r.t; const P = t.plan;
    // een nachtrit die het voertuig nu nog van gisteren rijdt (het gestreepte blok links, R.vanGisteren): hier staat hij voor
    // vannacht, nog te rijden, en vast (het plan is dat van gisteren, dus verplaatsen kan pas als hij klaar is)
    const Td = ((T() % 1440) + 1440) % 1440; const nacht = Td < t.dayStart && r.end > 1440 && rs0.st !== 'gepland' && rs0.st !== 'afgerond';
    const rs = nacht ? { ...rs0, st: 'gepland', at: Td, winMiss: 0, lateStops: 0 } : rs0;
    const late = !nacht && (rs.winMiss > 0 || rs.lateStops > 0 || P.slice(r.i0, r.i1 + 1).some(s => s.delay && !t.delayResolved));
    const vast = nacht || rs.st !== 'gepland' || T() >= absT(t, P[r.i0].t0) || !ctx.can('act');
    const ing = P.slice(r.i0, r.i1 + 1).some(s => s.ingevoegd) || r.routes.some(x => x.pool);
    const vk = rs.st === 'gepland' ? voorkeurVan(r) : null; const av = ing && aangevraagd(r);
    const dl = t.delayResolved ? 0 : P.slice(r.i0, r.i1 + 1).reduce((x, s) => x + (s.k === 'drive' ? s.delay || 0 : 0), 0);
    return { id: r.id, resourceId, from: ms(absT(t, P[r.i0].t0)), to: ms(absT(t, P[r.i1].t1)), html: ritHtml(r, rs, av) + (vk ? `<span class="sg-vk" title="Tegen voorkeur. ${esc(vk)}" aria-label="Tegen voorkeur. ${esc(vk)}"></span>` : ''), label: `Rit ${r.id}${nacht ? ', vannacht; rijdt nu nog van gisteren' : rs.st === 'afgerond' ? ', gereden' : rs.st === 'gepland' ? ', gepland' : ', onderweg'}${dl ? `, ${Math.round(dl)} min later dan gepland` : ''}${vk ? `, tegen voorkeur: ${vk}` : ''}${av ? ', wacht op een ja' : ''}`,
      classes: `pb-rit st-${rs.st}${late ? ' late' : ''}${ing ? ' ing' : ''}${vast ? ' vast' : ''}${vk ? ' tegen' : ''}${av ? ' aangevraagd' : ''}`, enableDragging: !vast, draggable: !vast, enableResize: false, resizable: false };
  }
  // de nachtdienst van gisteren (R.vanGisteren): wat een voertuig vannacht na middernacht reed of nog rijdt, op zijn eigen
  // rij van 00:00 tot het eind, gestreept, vast en met 'van gisteren'; alleen op Vandaag (de legenda noemt de arcering)
  function gisterenNachtTasks(t, resourceId) {
    if (f.dag !== 'vandaag') return [];
    return R.vanGisteren(t, T(), S).filter(g => g.b > 0).map(g => ({ id: `g-${g.r.id}`, rit: g.r.id, resourceId, from: ms(g.a), to: ms(g.b), html: ritHtml(g.r, { st: g.st, at: g.at }, false, { voor: 'van gisteren · ', streep: true }),
      label: `Rit ${g.r.id} van gisteren (nachtdienst), ${g.nu ? 'rijdt nu' : g.st === 'afgerond' ? 'gereden' : 'komt nog'}`, classes: `pb-rit pb-gisteren st-${g.st} vast`, enableDragging: false, draggable: false, enableResize: false, resizable: false }));
  }
  // toegewezen ritten zonder voertuig op het bord (een charter, een rit van morgen, of nog geen vrij voertuig): een eigen rij
  // per charter of persoon, boven de voertuigen
  function toewijzingRijen(sp, rows, tasks) {
    const L = toegewezen(ctx).filter(p => p.sp === sp.n && !p.gepland.t && (f.dag === 'morgen') === (p.dag === 'morgen')); const per = new Map();
    for (const p of L) { const a = per.get(p.toegewezen.id) || []; a.push(p); per.set(p.toegewezen.id, a); }
    for (const [wid, A] of per) {
      const tw0 = A[0].toegewezen; const naam = tw0.naam; const ch = tw0.soort === 'charter';
      rows.push({ id: `ch-${wid}`, label: naam, enableDragging: false, draggable: false, classes: 'charter', headerHtml: `<div class="pb-who"><span class="av sm${ch ? ' sq' : ''}">${esc(initials(naam))}</span><div><b>${esc(naam)}</b><span>${esc(wieSoort(tw0))} · ${A.length} ${A.length === 1 ? 'rit' : 'ritten'}</span></div></div>` });
      for (const p of A) { const inv = poolInvoer(p, sp); const tw = p.toegewezen; const a = tw.start || inv.t0; const b = tw.eind || a + (inv.t1 - inv.t0); const av = tw.status === 'aangevraagd';
        tasks.push({ id: `chr-${p.id}`, resourceId: `ch-${wid}`, from: ms(a), to: ms(b), label: `${p.klant || 'Rit'}, ${wieSoort(tw)} ${naam}${av ? ', wacht op een ja' : ''}`, html: `<span class="sg-l"><b>${esc(kortStop(p.klant || 'Rit'))}</b><small>${hhmm(a)}–${hhmm(b)}${av ? ' · gevraagd' : ''}</small></span>`, classes: `pb-charter${av ? ' aangevraagd' : ''}`, enableDragging: false, draggable: false, enableResize: false, resizable: false }); }
    }
  }
  function extraTasks(t, resourceId) {
    const out = [];
    if (t.vandaag === 'onderhoud') out.push({ id: `wp-${t.id}`, resourceId, from: ms(range()[0] - 60), to: ms(1800), label: 'Werkplaats', html: '<span class="sg-l"><b>Werkplaats</b><small>onderhoud vandaag</small></span>', classes: 'pb-wp', enableDragging: false, draggable: false, enableResize: false });
    // laadsessies van elektrische voertuigen buiten de ritten (op het terrein)
    if (t.ev) t.plan.forEach((s, k) => { if (s.k === 'laden' && !s.route && s.t1 - s.t0 >= 20 && s.t1 < 1800) out.push({ id: `ld-${t.id}-${k}`, resourceId, from: ms(absT(t, s.t0)), to: ms(absT(t, s.t1)), label: 'Laden', html: `<span class="sg-l"><b>Laden</b><small>${hhmm(absT(t, s.t0))}–${hhmm(absT(t, s.t1))}</small></span>`, classes: 'pb-laden', enableDragging: false, draggable: false, enableResize: false }); });
    return out;
  }
  // open ritten als omlijnde blokken in hun laadvenster, bovenaan het bord (vandaag en morgen); een klik plant ze in
  // Passen ze zonder overlap in hooguit drie banen, dan staat elke rit als eigen blok; zijn het er meer tegelijk (zoals de
  // ritten van morgen in de vroege ochtend), dan per uur één blok met het aantal, en een klik opent Open ritten.
  function openRij(sp, rows, tasks) {
    const L = poolItems(sp).filter(p => (f.dag === 'morgen') === (p.dag === 'morgen')); if (!L.length) return;
    // het blok is het laadvenster (daar moet de rit weg); de duur staat op de kaart in de bak en in de dialoog
    const B = L.map(p => { const inv = poolInvoer(p, sp); const v = vensterAbs(p) || [inv.t0, inv.t0 + 60]; return { p, v, a: v[0], b: Math.max(v[1], v[0] + 30) }; }).sort((x, y) => x.a - y.a);
    const banen = []; for (const x of B) { let i = banen.findIndex(e => e <= x.a); if (i < 0) { banen.push(0); i = banen.length - 1; } banen[i] = x.b + 10; x.baan = i; }
    const kop = `<div class="pb-who"><span class="av sm sq">${ic('inbox', 13)}</span><div><b>Open ritten</b><span>${L.length} ${L.length === 1 ? 'rit' : 'ritten'} zonder voertuig</span></div></div>`;
    const rij = (id, html) => rows.push({ id, label: 'Open ritten', enableDragging: false, draggable: false, classes: 'open', headerHtml: html });
    const vast = { enableDragging: false, draggable: false, enableResize: false, resizable: false };
    if (banen.length <= 3) {
      banen.forEach((_, i) => rij(i ? `open-${i + 1}` : 'open', i ? '<div class="pb-who pb-baan" aria-hidden="true"></div>' : kop));
      for (const x of B) tasks.push({ id: `open-${x.p.id}`, resourceId: x.baan ? `open-${x.baan + 1}` : 'open', from: ms(x.a), to: ms(x.b), label: `Open rit ${x.p.klant || ''}, laden ${hhmm(x.v[0])}, nog geen voertuig`, html: `<span class="sg-l"><b>${esc(kortStop(x.p.klant || 'Rit'))}</b><small>laden ${hhmm(x.v[0])}–${hhmm(x.v[1])}</small></span>`, classes: 'pb-open', ...vast });
      return;
    }
    rij('open', kop);
    const per = new Map(); for (const x of B) { const h = Math.floor(x.a / 60); per.set(h, [...(per.get(h) || []), x]); }
    for (const [h, G] of per) tasks.push({ id: `openuur-${h}`, resourceId: 'open', from: ms(h * 60), to: ms(h * 60 + 60), label: `${G.length} open ${G.length === 1 ? 'rit' : 'ritten'}, laden tussen ${hhmm(h * 60)} en ${hhmm(h * 60 + 60)}; open de lijst`, html: `<span class="sg-l"><b>${G.length} open</b><small>laden ${hhmm(h * 60)}–${hhmm(h * 60 + 60)}</small></span>`, classes: 'pb-open pb-openuur', ...vast });
  }
  const isOpenRij = id => id === 'open' || /^open-\d$/.test(String(id));
  // gisteren: de gereden diensten uit de historie (per voertuig, wie reed en hoe lang); geen ritten per blok
  function gisterenTasks(t, resourceId) {
    const info = ctx.people.forTruck.get(t.id); if (!info) return [];
    const g = new Date(); g.setHours(0, 0, 0, 0); g.setDate(g.getDate() - 1);
    return info.history.filter(h => h.date.toDateString() === g.toDateString()).map((h, k) => ({ id: `h-${t.id}-${k}`, resourceId, from: ms(h.start - 1440), to: ms(h.end - 1440), label: `Gisteren: ${h.who ? h.who.short : ''}, ${hhmm(h.start)} tot ${hhmm(h.end)}, ${fmt(h.km)} km`, html: `<span class="sg-l"><b>${esc(h.who ? h.who.short : 'dienst')}</b><small>${hhmm(h.start)}–${hhmm(h.end)} · ${fmt(h.km)} km${h.note ? ` · ${esc(h.note)}` : ''}</small></span>`, classes: `pb-hist${h.note ? ' let' : ''}`, enableDragging: false, draggable: false, enableResize: false, resizable: false }));
  }
  function build(sp) {
    const rows = [], tasks = [];
    if (f.dag === 'gisteren') {
      for (const t of vehicles(sp)) { const T2 = gisterenTasks(t, t.id); rows.push({ id: t.id, label: t.id, enableDragging: false, draggable: false, classes: T2.length ? '' : 'idle', headerHtml: `<div class="pb-who">${plate(t.id)}<div><b>${T2.length ? esc(T2.map(x => x.html.match(/<b>([^<]*)<\/b>/)[1]).join(', ')) : '<span class="mut">gisteren niet ingezet</span>'}</b><span>${esc(KIND[t.kind].n)}${t.ev ? ' · EV' : ''}</span></div></div>` }); tasks.push(...T2); }
      return { rows, tasks };
    }
    if (f.per === 'voertuig') {
      // open ritten en charters bovenaan: een paar rijen, en wat nog moet of op bevestiging wacht moet je zien
      if (f.st === 'alle' && !f.q.trim()) { openRij(sp, rows, tasks); toewijzingRijen(sp, rows, tasks); }
      for (const t of vehicles(sp)) {
        const s = S.get(t.id); const who = t.diensten.length ? t.diensten.map(d => `${esc(d.person ? d.person.short : d.driver)}${d.shifted ? ` <em>+${d.shifted}</em>` : ''}`).join(', ') : `<span class="mut">${t.vandaag === 'onderhoud' ? 'werkplaats' : t.zondagVrij ? 'zondag, vrij' : 'vrij, niet ingepland'}</span>`;
        rows.push({ id: t.id, label: t.id, classes: `${t.vandaag !== 'inzet' ? 'idle' : ''}`, enableDragging: true, draggable: true,
          headerHtml: `<div class="pb-who" title="${esc(`${t.id} · ${KIND[t.kind].n}${t.ev ? ', elektrisch' : ''}${t.diensten.length ? ` · ${t.diensten.map(d => `${d.driver} ${hhmm(d.start)}–${hhmm(d.end)}`).join(', ')}` : ''}${s && s.tr ? ` · ${s.tr.id}` : ''}`)}">${plate(t.id)}<div><b>${who}</b><span>${esc(KIND[t.kind].n)}${t.ev ? ' · EV' : ''}${s && s.tr ? ` · ${esc(s.tr.id)}` : ''}</span></div><i class="dot st-${s ? s.st : 'terrein'}" aria-hidden="true"></i></div>` });
        for (const r of R.ofTruck(t)) tasks.push(ritTask(r, t.id));
        tasks.push(...gisterenNachtTasks(t, t.id));
        tasks.push(...extraTasks(t, t.id));
      }
    } else if (f.per === 'chauffeur') {
      const q = f.q.trim().toLowerCase();
      const P = ctx.people.persons.filter(p => p.base === sp && p.dienst).filter(p => (f.div === 'alle' || p.dienst.t.div === f.div) && (f.kind === 'alle' || p.dienst.t.kind === f.kind)).filter(p => !q || `${p.name} ${p.dienst.t.id}`.toLowerCase().includes(q)).sort((a, b) => a.dienst.d.start - b.dienst.d.start || a.name.localeCompare(b.name));
      for (const p of P) {
        const t = p.dienst.t, d = p.dienst.d;
        rows.push({ id: p.id, label: p.name, enableDragging: false, draggable: false, headerHtml: `<div class="pb-who"><span class="av sm">${esc(p.initials)}</span><div><b>${esc(p.name)}</b><span>${hhmm(d.start)}–${hhmm(d.end)} · ${esc(t.id)}</span></div></div>` });
        for (const r of R.ofTruck(t)) if (r.d === d.i) { const k = ritTask(r, p.id); k.enableDragging = false; k.draggable = false; k.classes += ' vast'; tasks.push(k); }
      }
    } else {
      const D = docksVan(ctx, sp);
      for (const x of D.plan) {
        const L = x.blokken.slice().sort((a, b) => a.t0 - b.t0);
        rows.push({ id: `dock-${x.dock}`, label: `Dock ${x.dock}`, enableDragging: false, draggable: false, headerHtml: `<div class="pb-who"><span class="dk-n">${x.dock}</span><div><b>Dock ${x.dock}</b><span>${L.length} ${L.length === 1 ? 'blok' : 'blokken'} vandaag</span></div></div>` });
        L.forEach((bk, k) => { const clash = L.some((o, j) => j !== k && o.t0 < bk.t1 && o.t1 > bk.t0); const t = fleet.byId.get(bk.voertuig); const r = R.vanNr ? R.vanNr(t, bk.rit) : null; tasks.push({ id: r ? `dk-${x.dock}-${k}-${r.id}` : `dk-${x.dock}-${k}`, resourceId: `dock-${x.dock}`, from: ms(bk.t0), to: ms(bk.t1), label: `${bk.voertuig}, ${DOCKS[bk.soort] || bk.soort}${bk.oplegger ? ` ${bk.oplegger}` : ''}${r ? `, rit ${r.id}` : ''}`, html: `<span class="sg-l"><b>${esc(bk.voertuig)}</b><small>${esc(DOCKS[bk.soort] || bk.soort || '')} ${hhmm(bk.t0)}–${hhmm(bk.t1)}${bk.oplegger ? ` · ${esc(bk.oplegger)}` : ''}</small></span>`, classes: `pb-dock d-${bk.soort || 'laden'}${clash ? ' clash' : ''}`, enableDragging: false, draggable: false, enableResize: false, rit: r ? r.id : null }); });
      }
    }
    return { rows, tasks };
  }

  // ---------- svelte-gantt ----------
  const dateAdapter = { format: (x, fm) => (fm === 'HH' ? hhmm(mm(x)).slice(0, 2) : hhmm(mm(x))), roundTo: (x, unit, n) => { const step = (unit === 'hour' ? 60 : 1) * MIN * (n || 1); return Math.round(x / step) * step; } };
  function mount(rows, tasks) {
    const [a, b] = range();
    gantt = new SvelteGantt({ target: $('[data-pb=gantt]'), props: {
      rows, tasks, from: ms(a), to: ms(b), fitWidth: false, minWidth: breedte(), rowHeight: 44, rowPadding: 7, magnetUnit: 'minute', magnetOffset: 5,
      columnUnit: 'minute', columnOffset: kolom(), headers: [{ unit: 'hour', format: 'HH:mm', sticky: true }], dateAdapter, layout: 'overlap',
      tableWidth: ctx.narrow() ? 150 : 268, tableHeaders: [{ title: f.per === 'dock' ? 'Dock' : f.per === 'chauffeur' ? (ctx.narrow() ? 'Chauffeur' : 'Chauffeur en dienst') : (ctx.narrow() ? 'Voertuig' : 'Voertuig en chauffeurs'), property: 'label', width: ctx.narrow() ? 150 : 268, renderer: row => row.model.headerHtml || esc(row.model.label) }],
      ganttTableModules: [SvelteGanttTable], timeRanges: [nuRange()], columnStrokeColor: 'var(--line)', columnStrokeWidth: 1,
      taskElementHook: (node, task) => hook(node, task),
    } });
    gantt.api.tasks.on.changed(evts => { for (const ev of [].concat(evts)) onChanged(ev); });
    gantt.api.tasks.on.select(sel => { const t = [].concat(sel)[0]; if (t && t.model) ui.pbSel = t.model.id; });
    bindTijd();
  }
  const nuRange = () => ({ id: 'nu', from: ms(T()), to: ms(T() + 1.2), classes: 'pb-nu', label: hhmm(T()), resizable: false });
  // ---------- door de tijd: zoom, scrollen, slepen, knijpen, Vroeger, Later en Nu ----------
  const tabelBreedte = () => (ctx.narrow() ? 150 : 268);
  const body = () => el.querySelector('[data-pb=gantt] .sg-timeline-body');
  function breedte() { const g = $('[data-pb=gantt]'); const vw = Math.max(240, (g && g.clientWidth ? g.clientWidth : 1100) - tabelBreedte() - 2); const [a, b] = range(); return Math.round(vw * (b - a) / (f.zoom * 60)); }
  const kolom = () => (f.zoom <= 2 ? 15 : f.zoom <= 6 ? 30 : 60);
  // de tijd onder een plek in het bord (fractie van de breedte van het zichtbare deel), en naar een tijd scrollen
  function tijdOp(pos = 0) { const sc = body(); const [a, b] = range(); if (!sc || !sc.scrollWidth) return null; return a + (sc.scrollLeft + sc.clientWidth * pos) / sc.scrollWidth * (b - a); }
  function naarTijd(t, pos = 0.25, smooth = false) { const sc = body(); if (!sc) return; const [a, b] = range(); const x = (t - a) / (b - a) * sc.scrollWidth - sc.clientWidth * pos; sc.scrollTo({ left: Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, x)), behavior: smooth && !RM() ? 'smooth' : 'auto' }); }
  function scrollNow(smooth) { if (f.dag !== 'vandaag') { zetDag('vandaag', true); return; } naarTijd(T(), 0.25, smooth); }
  function stap(dir) { const sc = body(); if (!sc) return; sc.scrollBy({ left: dir * sc.clientWidth * 0.5, behavior: RM() ? 'auto' : 'smooth' }); }
  function zetZoom(z) {
    if (!ZOOMS.includes(z) || z === f.zoom) return; const mid = tijdOp(0.5); f.zoom = z; bewaar();
    if (gantt) { gantt.$set({ minWidth: breedte(), columnOffset: kolom() }); requestAnimationFrame(() => { if (mid !== null) naarTijd(mid, 0.5); }); }
    swap($('[data-pb=bar]'), bar(spNu(), fleet.trucks.filter(t => t.base === spNu())));
  }
  function zetDag(d, naarNu) {
    if (!DAGEN.some(x => x[0] === d)) return; f.dag = d; f.poolDag = d === 'morgen' ? 'morgen' : 'vandaag'; ui.pbLinks = null;
    render(true);
    requestAnimationFrame(() => { if (d === 'vandaag') naarTijd(T(), 0.25); else naarTijd(d === 'gisteren' ? -1440 + 120 : 1440 + 150, 0); });
    if (naarNu) requestAnimationFrame(() => requestAnimationFrame(() => naarTijd(T(), 0.25, true)));
  }
  // scrollen met Shift en het wiel of een touchpad doet de browser; hier: slepen met de muis, Ctrl met het wiel (en knijpen
  // op een touchpad) zoomt, knijpen op een scherm zoomt, een klik op de tijdas zet de replay op dat tijdstip
  function bindTijd() {
    const sc = body(); if (!sc || sc.dataset.tijd) return; sc.dataset.tijd = '1';
    let pan = null, acc = 0, knijp = null;
    sc.addEventListener('scroll', () => { const t = tijdOp(0); if (t !== null) ui.pbLinks = { dag: f.dag, t }; }, { passive: true });
    sc.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.sg-task')) return; pan = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, moved: false }; });
    window.addEventListener('pointermove', e => { if (!pan) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return; pan.moved = true; sc.classList.add('pan'); sc.scrollLeft = pan.l - dx; sc.scrollTop = pan.t - dy; });
    const los = () => { if (!pan) return; const was = pan.moved; pan = null; sc.classList.remove('pan'); if (was) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; sc.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => sc.removeEventListener('click', stop, { capture: true }), 0); } };
    window.addEventListener('pointerup', los); window.addEventListener('pointercancel', los);
    sc.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); acc += e.deltaY; if (Math.abs(acc) < 60) return; const i = ZOOMS.indexOf(f.zoom) + (acc > 0 ? 1 : -1); acc = 0; if (ZOOMS[i]) zetZoom(ZOOMS[i]); }, { passive: false });
    sc.addEventListener('touchstart', e => { if (e.touches.length === 2) knijp = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
    sc.addEventListener('touchmove', e => { if (!knijp || e.touches.length !== 2) return; const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const r = d / knijp; if (r > 1.3 || r < 0.77) { const i = ZOOMS.indexOf(f.zoom) + (r > 1 ? -1 : 1); if (ZOOMS[i]) zetZoom(ZOOMS[i]); knijp = d; } }, { passive: true });
    sc.addEventListener('touchend', () => { knijp = null; }, { passive: true });
    const kop = el.querySelector('[data-pb=gantt] .sg-header');
    if (kop) kop.addEventListener('click', e => {
      const r = sc.getBoundingClientRect(); const [a, b] = range(); const t = Math.round((a + (e.clientX - r.left + sc.scrollLeft) / sc.scrollWidth * (b - a)) / 15) * 15;
      if (f.dag !== 'vandaag' || t < 0 || t >= 1440) { ctx.L.toast('De replay gaat over vandaag: kies Vandaag om naar een tijdstip te gaan.', { icon: 'info' }); return; }
      const anker = document.createElement('span'); Object.assign(anker.style, { position: 'fixed', left: `${e.clientX}px`, top: `${r.top - 4}px`, width: '1px', height: '1px' }); ctx.root.appendChild(anker);
      ctx.L.openPop(anker, `<div class="menu-h">${hhmm(t)}</div><button class="menu-i" type="button" data-naartijd="${t}">${ic('clock', 16)}<span class="grow">Ga naar ${hhmm(t)}<small>de replay, de kaart en het bord springen mee</small></span></button>${Math.abs(t - T()) > 1 ? '' : ''}`, { label: 'Tijdstip', onBind: p => on(p, 'click', '[data-naartijd]', (ev, x) => { ctx.setTime(+x.dataset.naartijd); ctx.L.closePop(); ctx.L.toast(`De replay staat op ${hhmm(+x.dataset.naartijd)}.`, { icon: 'clock', action: 'Terug naar de echte klok', onAction: () => ctx.setNow() }); }), onClose: () => anker.remove() });
    });
  }

  // ---------- toetsenbord en uitleg per blok ----------
  function hook(node, task) {
    const m = () => (task && task.model) || task; let model = m();
    const label = () => { const x = m(); const r = R.get(x.id); return r ? `Rit ${r.id}, ${r.dest.slice(0, 2).join(', ')}, ${hhmm(mm(x.from))} tot ${hhmm(mm(x.to))}, ${r.t.id}${/vast/.test(x.classes || '') ? ', begonnen' : ''}` : `${x.label || ''}, ${hhmm(mm(x.from))} tot ${hhmm(mm(x.to))}`; };
    node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', label()); node.title = label();
    const openItem = x => {
      // een blok met het aantal open ritten in een uur: naar Open ritten (dezelfde dag)
      if (String(x.id).startsWith('openuur-')) { ctx.ui.or = { ...(ctx.ui.or || {}), dag: f.dag === 'morgen' ? 'morgen' : 'vandaag', sel: null }; ctx.go('view:openritten'); return true; }
      const pid = String(x.id).startsWith('open-') ? x.id.slice(5) : null; const it = pid && poolItems(spNu()).find(p => p.id === pid); if (it) openRitDialoog(ctx, it, { na }); return !!it;
    };
    const key = e => {
      const x = m(); const r = R.get(x.id);
      if ((e.key === 'Enter' || e.key === ' ') && openItem(x)) { e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); popover(node, x); return; }
      if (!r) return;
      if (e.key === 'w' || e.key === 'W') { e.preventDefault(); waarPast(r); return; }
      if (/vast/.test(x.classes || '')) { if (/^Arrow/.test(e.key)) { e.preventDefault(); ctx.L.toast(`Rit ${r.id} is al begonnen en blijft op ${r.t.id}.`, { icon: 'lock' }); } return; }
      // de begintijd komt uit de rit zelf (het plan), niet uit het blok: na een afgewezen sleep kan dat nog even ergens anders staan
      const van = absT(r.t, r.t.plan[r.i0].t0);
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey) { e.preventDefault(); const d = (e.key === 'ArrowRight' ? 5 : -5); poging(r, r.t, van + d, node); }
      else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); const i = rowsNow.findIndex(rw => rw.id === r.t.id); const nb = rowsNow[i + (e.key === 'ArrowDown' ? 1 : -1)]; const B = nb && fleet.byId.get(nb.id); if (B) poging(r, B, van, node); }
    };
    node.addEventListener('keydown', key);
    node.addEventListener('click', e => { if (e.detail > 1) return; setTimeout(() => { if (!node.isConnected) return; if (openItem(m())) return; popover(node, m()); }, 0); });
    return { update(nt) { task = nt; model = m(); node.setAttribute('aria-label', label()); node.title = label(); }, destroy() { node.removeEventListener('keydown', key); } };
  }

  // ---------- slepen: toetsen en uitvoeren, of terugzetten met de reden ----------
  function onChanged(ev) {
    const { task, sourceRow, targetRow, previousState } = ev || {}; if (!task) return;
    const x = task.model; const r = R.get(x.id); if (!r) return;
    const B = fleet.byId.get(targetRow ? targetRow.model.id : x.resourceId); const start = Math.round(mm(x.from));
    // terug naar waar de rit in het plan staat (vorige rij en tijd uit de rit zelf, niet uit de sleepstand)
    const terug = () => gantt.updateTask({ ...x, resourceId: f.per === 'voertuig' ? r.t.id : (sourceRow ? sourceRow.model.id : x.resourceId), from: ms(absT(r.t, r.t.plan[r.i0].t0)), to: ms(absT(r.t, r.t.plan[r.i1].t1)) });
    if (!B || f.per !== 'voertuig') { terug(); return; }
    if (B === r.t && Math.abs(start - absT(r.t, r.t.plan[r.i0].t0)) < 1) return;
    const res = voerUit(r, B, start);
    if (!res.ok) terug();
  }
  // toetsen en uitvoeren staat in inplannen.js (gedeeld met de zaken en de assistent); het bord tekent daarna opnieuw
  const na = () => refresh(true);
  const voerUit = (r, B, start, opts = {}) => IP.voerUit(ctx, r, B, start, { ...opts, na });
  const waarPast = (r, opts = {}) => IP.waarPast(ctx, r, { ...opts, na });
  const planIn = (item, B, start, opts = {}) => IP.planIn(ctx, item, B, start, { ...opts, na });
  function poging(r, B, start, node) { const res = voerUit(r, B, start); if (res.ok) requestAnimationFrame(() => { const n = el.querySelector(`[data-task-id="${CSS.escape(r.id)}"]`); if (n) n.focus(); else if (node && node.isConnected) node.focus(); }); }

  // ---------- popover bij een blok ----------
  function popover(node, x) {
    const r = R.get(x.id);
    if (!r) {
      const rr = x.rit ? R.get(x.rit) : null; const pid = String(x.id).startsWith('chr-') ? x.id.slice(4) : null;
      ctx.L.openPop(node, `<div class="menu-h">${esc(x.label || '')}</div><div class="bpop"><p class="hint">${hhmm(mm(x.from))}–${hhmm(mm(x.to))}</p>${pid ? `<div class="bpop-a"><button class="btn sm" type="button" data-pbopen="openritten/${esc(pid)}">${ic('inbox', 15)}Bekijk de rit</button></div>` : ''}${rr ? `<div class="bpop-a"><button class="btn sm" type="button" data-pbopen="rit/${esc(rr.id)}">${ic('route', 15)}Open rit ${esc(rr.id)}</button><button class="btn sm" type="button" data-pbopen="voertuig/${esc(rr.t.id)}/vandaag">${ic('truck', 15)}${esc(rr.t.id)}</button></div>` : ''}</div>`, { label: x.label || 'Blok', onBind: p => on(p, 'click', '[data-pbopen]', (e, b) => { ctx.L.closePop(false); ctx.go(b.dataset.pbopen); }) });
      return;
    }
    const rs = ctx.R.stateOf(r, T(), S); const t = r.t; const P = t.plan;
    const segs = P.slice(r.i0, r.i1 + 1).filter(s => s.k !== 'terrein' || s.dockSoort || s.wachtDock);
    ctx.L.openPop(node, `<div class="bpop"><div class="bpop-h"><b>Rit ${esc(r.id)}</b>${ritBadge(rs.st)}</div><p>${esc(r.klant)} · ${esc(r.dest.join(', '))}</p>
      <dl class="kv"><dt>Voertuig</dt><dd>${plate(t.id)} ${esc(r.driver || '')}</dd><dt>Tijd</dt><dd>${hhmm(absT(t, P[r.i0].t0))}–${hhmm(absT(t, P[r.i1].t1))}</dd><dt>Stops</dt><dd>${r.stops.length} · ${fmt(r.km)} km</dd>${r.tr ? `<dt>Oplegger</dt><dd>${esc(r.tr.id)} (${esc(TRT[r.tr.type].n.toLowerCase())})</dd>` : ''}${rs.winMiss > 0 ? `<dt>Venster</dt><dd class="tbad">${rs.winMiss} min te laat</dd>` : ''}${rs.st === 'gepland' && voorkeurVan(r) ? `<dt>Voorkeur</dt><dd class="twarn">${esc(voorkeurVan(r))}</dd>` : ''}${aangevraagd(r) ? '<dt>Status</dt><dd class="twarn">wacht op een ja</dd>' : ''}</dl>
      <ol class="bpop-segs">${segs.slice(0, 8).map(s => `<li><span class="sw" style="--c:${KLEUR[s.k]}"></span>${hhmm(absT(t, s.t0))} ${esc(s.k === 'stop' ? `${s.stop}${s.wacht ? ` (wacht ${Math.round(s.wacht)} min)` : ''}` : s.k === 'drive' ? `rijden naar ${s.route.marks[s.idx].name}` : segNaam(s))}</li>`).join('')}${segs.length > 8 ? `<li class="mut">nog ${segs.length - 8}</li>` : ''}</ol>
      <div class="bpop-a"><button class="btn sm" type="button" data-pbopen="rit/${esc(r.id)}">${ic('route', 15)}Open rit</button>${rs.st === 'gepland' && ctx.can('act') ? `<button class="btn sm pri" type="button" data-pbwaar="${esc(r.id)}">${ic('target', 15)}Waar past hij?</button>` : ''}<button class="btn sm" type="button" data-pbopen="kaart:truck:${esc(t.id)}">${ic('map', 15)}Op kaart</button><button class="btn sm ghost" type="button" data-pbreplay="${absT(t, P[r.i0].t0)}" title="Zet de klok op het begin van deze rit">${ic('clock', 15)}Bekijk dit moment</button></div>
      ${rs.st === 'gepland' ? '<p class="hint">Sleep het blok naar een ander voertuig of een andere tijd; het bord toetst meteen.</p>' : '<p class="hint">Deze rit is begonnen en blijft op dit voertuig.</p>'}</div>`, {
      label: `Rit ${r.id}`, cls: 'wide', onBind: p => {
        on(p, 'click', '[data-pbopen]', (e, b) => { ctx.L.closePop(false); ctx.go(b.dataset.pbopen); });
        on(p, 'click', '[data-pbwaar]', () => { ctx.L.closePop(false); waarPast(r); });
        on(p, 'click', '[data-pbreplay]', (e, b) => { ctx.L.closePop(false); ctx.setPlaying(false); ctx.setTime(+b.dataset.pbreplay); ctx.L.toast(`Klok op ${hhmm(+b.dataset.pbreplay)}: het begin van rit ${r.id}.`, { icon: 'clock' }); });
      },
    });
  }

  // ---------- pool ----------
  function poolItems(sp) { return poolNu(ctx).filter(p => p.sp === sp.n && !collegaOm(ctx, p, T())).map(p => [p, urgentie(ctx, p)]).sort((a, b) => (a[0].dag === 'morgen') - (b[0].dag === 'morgen') || a[1] - b[1]).map(x => x[0]); }
  const uur = m => { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} u`; };
  const bekendTxt = p => p.bekend === undefined || p.bekend === null ? '' : p.bekend < 0 ? 'sinds gisteren' : `sinds ${hhmm(p.bekend)}`;
  function poolHtml(sp) {
    const L = poolItems(sp); const dag = f.poolDag; const V = L.filter(p => (p.dag || 'vandaag') === dag);
    const n0 = L.filter(p => (p.dag || 'vandaag') === 'vandaag').length, n1 = L.length - n0;
    const card = p => { const inv = poolInvoer(p, sp); const kl = p.klant || ''; const st = inv.stops.filter(x => !x.laden); const red = REDEN[p.reden] || p.reden || ''; const u = urgentie(ctx, p); const pg = prognose(ctx, p); return `<div class="pk" data-pk="${esc(p.id)}" tabindex="0" role="listitem" aria-label="${esc(`Open rit: ${kl}, ${st.map(x => x.naam).join(', ')}, laden ${p.venster ? `${hhmm(p.venster[0])} tot ${hhmm(p.venster[1])}` : 'vrij'}, ${red}, kans op invulling ${pg.kans} procent`)}">
      <div class="pk-u"><span class="or-u ${urgentieKlas(u, p)}">${esc(urgentieTxt(u, p))}</span>${kansChip(pg, true)}</div>
      <div class="pk-h"><b title="${esc(kl)}">${esc(kl.replace(/^Albert Heijn\b/, 'AH'))}</b><span class="badge sm">${esc(p.oplegger ? OPL[p.oplegger] || p.oplegger : SOORTK[p.soort] || 'rit')}</span></div>
      <div class="pk-s" title="${esc(st.map(x => x.naam).join(', '))}">${esc(st.map(x => kortStop(x.naam)).join(' · ') || 'rit')}</div>
      <div class="pk-m">laden ${p.venster ? `${hhmm(p.venster[0])}–${hhmm(p.venster[1])}` : 'vrij'} · ${uur(p.duur || (inv.t1 - inv.t0))} · ${fmt(p.km || inv.km)} km</div>
      <div class="pk-r" title="${esc(red)}">${dag === 'vandaag' ? belSpan(ctx, p, '', ' · ') : ''}${esc(red)}${bekendTxt(p) ? ` · ${esc(bekendTxt(p))}` : ''}</div>
      <div class="pk-a">${ctx.can('act') ? `<button class="btn xs" type="button" data-pkwaar="${esc(p.id)}" title="Eigen chauffeurs, oproepkrachten en charters, elk met reden en kosten">${ic('plus', 13)}Rit inplannen</button>` : ''}${p.route ? `<button class="btn xs ghost" type="button" data-pkkaart="${esc(p.id)}" title="De route van rit ${esc(p.id)} op de kaart">${ic('map', 13)}Kaart</button>` : ''}</div></div>`; };
    return `<div class="pk-bar"><button class="pk-tg" type="button" data-pktg="1" aria-expanded="${f.poolOpen}">${ic(f.poolOpen ? 'chevd' : 'chevu', 15)}<b>Open ritten</b> <span class="n">${L.length}</span></button>
      <div class="seg" role="group" aria-label="Dag"><button type="button" data-pkdag="vandaag" aria-pressed="${dag === 'vandaag'}">Vandaag ${n0}</button><button type="button" data-pkdag="morgen" aria-pressed="${dag === 'morgen'}">Morgen ${n1}</button></div>
      <span class="hint">${dag === 'vandaag' ? 'Op urgentie. Kies Rit inplannen, of sleep de kaart op een voertuig.' : 'De ritten van morgen komen tussen 13:00 en 16:30 binnen. Waar een voertuig na middernacht nog werkt, kan hij er nu al op.'}${pool(ctx).some(p => p.schatting) ? ' Pool geschat: een paar procent van de ritten van de standplaats.' : ''}</span><button class="lnk pk-alle" type="button" data-open="view:openritten">Alle open ritten</button></div>
      ${f.poolOpen ? `<div class="pk-list" role="list">${V.length ? V.map(card).join('') : `<p class="hint" style="padding:8px 0">${dag === 'vandaag' ? 'Alles van vandaag is ingepland.' : 'Nog geen ritten voor morgen.'}</p>`}</div>` : ''}`;
  }
  on(el, 'click', '[data-pktg]', () => { f.poolOpen = !f.poolOpen; drawPool(true); bewaar(); });
  on(el, 'click', '[data-pkdag]', (e, b) => { f.poolDag = b.dataset.pkdag; drawPool(true); });
  on(el, 'click', '[data-pkkaart]', (e, b) => { const item = poolItems(spNu()).find(p => p.id === b.dataset.pkkaart); if (item) ctx.toonPoolrit(item); });
  on(el, 'click', '[data-pkwaar]', (e, b) => { const sp = spNu(); const item = poolItems(sp).find(p => p.id === b.dataset.pkwaar); if (item) openRitDialoog(ctx, item, { na }); });
  on(el, 'keydown', '[data-pk]', (e, c) => { if (e.key === 'Enter' && e.target === c) { const sp = spNu(); const item = poolItems(sp).find(p => p.id === c.dataset.pk); if (item) openRitDialoog(ctx, item, { na }); } });
  function drawPool(force) {
    const sp = spNu(); const h = poolHtml(sp); const box = $('[data-pb=pool]'); if (!force && box.dataset.h === h) return;
    box.innerHTML = h; box.dataset.h = h; for (const x of externals) { try { x.draggable && x.draggable.destroy(); } catch { /* weg */ } } externals = [];
    if (!gantt || f.per !== 'voertuig' || !ctx.can('act')) return;
    box.querySelectorAll('[data-pk]').forEach(c => {
      const item = poolItems(sp).find(p => p.id === c.dataset.pk); if (!item) return;
      externals.push(new SvelteGanttExternal(c, { gantt, enabled: true, dragging: false,
        // het sleepbeeld hangt svelte-gantt aan document.body, buiten .slct: daarom de stijl hier zelf
        elementContent: () => { const d = document.createElement('div'); d.textContent = `${item.klant || 'Rit'} · ${poolInvoer(item, sp).stops.filter(x => !x.laden).map(x => kortStop(x.naam)).join(', ')}`; const cs = getComputedStyle(ctx.root); Object.assign(d.style, { position: 'absolute', zIndex: 2147483000, pointerEvents: 'none', transform: 'translate(-12px,-50%)', padding: '6px 10px', borderRadius: '6px', font: `600 12.5px/1.3 ${cs.fontFamily}`, color: cs.getPropertyValue('--text') || '#15181E', background: cs.getPropertyValue('--bg') || '#FFF', border: `1.5px dashed ${cs.getPropertyValue('--brand') || '#E3001F'}`, boxShadow: '0 8px 24px rgba(16,24,40,.18)', whiteSpace: 'nowrap' }); return d; },
        onsuccess: (row, date) => { const B = fleet.byId.get(row.model.id); if (B) planIn(item, B, Math.round(mm(date) / 5) * 5); },
        onfail: () => {} }));
    });
  }
  // ---------- tekenen ----------
  function counts(sp, rows0) { const rows = rows0.filter(r => !String(r.id).startsWith('ch-') && !isOpenRij(r.id)); const all = fleet.trucks.filter(t => t.base === sp); const ins = all.filter(t => t.vandaag === 'inzet').length; return f.per === 'dock' ? `${rows.length} docks` : `${fmt(rows.length)} ${f.per === 'chauffeur' ? 'chauffeurs' : `van ${fmt(all.length)} voertuigen`} · ${ins} ingezet · ${fmt(poolItems(sp).length)} niet ingepland`; }
  function refresh(force) { rebuildSoon = 0; render(force, true); }
  function render(force, keepScroll) {
    const sp = spNu(); const all = fleet.trucks.filter(t => t.base === sp);
    swap($('[data-pb=bar]'), bar(sp, all));
    const s2 = `${sp.n}|${f.per}|${f.div}|${f.kind}|${f.st}|${f.q}|${R.ver()}|${ctx.theme()}|${ctx.narrow()}|${f.st !== 'alle' ? Math.floor(T() / 5) : ''}|${f.dag}`;
    const b5 = Math.floor(T() / 5);
    if (!gantt || force || s2 !== sig) {
      const { rows, tasks } = build(sp); rowsNow = rows; tasksNow = tasks;
      if (!gantt || s2.split('|').slice(0, 2).join('|') !== sig.split('|').slice(0, 2).join('|') || ctx.narrow() !== (sig.split('|')[8] === 'true') || s2.split('|')[10] !== sig.split('|')[10]) {
        // opnieuw opbouwen (andere standplaats, rijen of dag): de tijd links in beeld blijft staan, anders naar nu
        const links = ui.pbLinks && ui.pbLinks.dag === f.dag ? ui.pbLinks.t : null;
        if (gantt) { try { gantt.$destroy(); } catch { /* weg */ } gantt = null; $('[data-pb=gantt]').innerHTML = ''; }
        mount(rows, tasks); requestAnimationFrame(() => { if (links !== null) naarTijd(links, 0); else if (f.dag === 'vandaag') naarTijd(T(), 0.25); else naarTijd(f.dag === 'gisteren' ? -1440 + 120 : 1440 + 150, 0); });
      } else gantt.$set({ rows, tasks });
      sig = s2; bucket = b5; taskSig = new Map(tasks.map(k => [k.id, `${k.from}|${k.to}|${k.classes}|${k.html}`]));
      drawPool(true);
    } else if (b5 !== bucket) {
      // elke vijf minuten: de voortgang en status van de ritten bijwerken, in één keer
      bucket = b5; const { tasks } = build(sp); tasksNow = tasks; const ch = tasks.filter(k => taskSig.get(k.id) !== `${k.from}|${k.to}|${k.classes}|${k.html}`);
      if (ch.length) { gantt.updateTasks(ch); for (const k of ch) taskSig.set(k.id, `${k.from}|${k.to}|${k.classes}|${k.html}`); }
      drawPool(false);
    } else drawPool(false);
    const ce = $('[data-pb=cnt]'); const c = counts(sp, rowsNow); if (ce && !ce.dataset.lock && ce.textContent !== c) ce.textContent = c;
    if (ui.pbFocus && gantt) { const id = ui.pbFocus; ui.pbFocus = null; requestAnimationFrame(() => requestAnimationFrame(() => focusRit(id))); }
    // de replay is verzet (tijdbalk, Ga naar, echte klok): het bord scrolt mee; gewoon verversen laat het beeld staan
    if (ui.pbVolg && gantt) { ui.pbVolg = false; if (f.dag === 'vandaag') requestAnimationFrame(() => naarTijd(T(), 0.35, true)); }
    const dn = $('[data-pb=dagnote]'); if (dn) { const zo = d => d.getDay() === 0; const vd = ctx.fleet.vandaag || new Date(); const gz = zo(new Date(vd.getFullYear(), vd.getMonth(), vd.getDate() - 1)), mz = zo(new Date(vd.getFullYear(), vd.getMonth(), vd.getDate() + 1));
      const buiten = ctx.spsInScope().length && !ctx.spsInScope().includes(sp) ? `${sp.n} valt buiten je werkgebied (${ctx.scopeLabel()}); kies links je eigen standplaats om terug te gaan. ` : '';
      const tx = buiten + (f.dag === 'gisteren' ? `Gisteren: de gereden diensten uit de historie, per voertuig (geen ritten per blok).${gz ? ' Gisteren was het zondag: ongeveer 45 procent van de vloot reed (schatting).' : ''}` : f.dag === 'morgen' ? `Morgen: het plan komt vanmiddag tussen 13:00 en 16:30 binnen. Nu staan hier de open ritten van morgen en de nachtritten van vandaag.${mz ? ' Morgen is het zondag: dan rijdt ongeveer 45 procent van de vloot (schatting).' : ''}` : zo(vd) ? 'Zondag: ongeveer 45 procent van de vloot rijdt (schatting); de andere voertuigen staan vrij op het terrein.' : ''); dn.hidden = !tx; if (dn.textContent !== tx) dn.textContent = tx; }
    nowline(); bewaar();
  }
  // een rit klaarzetten om te verplaatsen: het juiste bord (standplaats, per voertuig, geen filters, het tijdvenster om de
  // rit heen), het blok gekozen en in beeld, met de focus erop (pijltjes en Alt met pijltjes werken meteen)
  function klaarzetten(id) {
    const r = R.get(id); if (!r) return false;
    if (ctx.pbSp() !== r.t.base) ctx.setPbSp(r.t.base);
    // buiten het werkgebied: het bord blijft op die standplaats (spNu), de kop volgt
    ui.pbVast = ctx.spsInScope().includes(r.t.base) ? null : r.t.base;
    f.per = 'voertuig'; f.div = 'alle'; f.kind = 'alle'; f.st = 'alle'; f.q = '';
    f.dag = 'vandaag';
    return true;
  }
  function focusRit(id) {
    const r = R.get(id); if (!r || !gantt) return;
    try { gantt.selectTask(id); gantt.scrollToTask(id, 'auto'); } catch { /* niet in beeld */ }
    ui.pbSel = id;
    setTimeout(() => {
      const n = el.querySelector(`[data-task-id="${CSS.escape(id)}"]`); if (!n) return;
      n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); n.focus({ preventScroll: true }); n.classList.add('pb-focus'); setTimeout(() => n.classList.remove('pb-focus'), 2600);
    }, 240);
    // dezelfde regel als het blok (vast) en inplannen.voerUit: begonnen is ook laden of koppelen aan het dock voor vertrek
    const rs = ctx.R.stateOf(r, T(), S); const aanDock = rs.st === 'gepland' && T() >= absT(r.t, r.t.plan[r.i0].t0);
    ctx.L.toast(rs.st === 'gepland' && !aanDock ? `Rit ${r.id} staat klaar: sleep het blok naar een ander voertuig of een andere tijd, of schuif met de pijltjes.` : `Rit ${r.id} is al begonnen${aanDock ? ' (laden of koppelen aan het dock)' : ''} en blijft op ${r.t.id}.`, { icon: 'gantt' });
  }
  function nowline() { if (!gantt) return; const m = Math.floor(T()); if (m === lastNow) return; lastNow = m; gantt.$set({ timeRanges: [nuRange()] }); }
  return { render, nowline, refresh, waarPast, klaarzetten };
}
