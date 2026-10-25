// Zoeken in de topbalk op MiniSearch (MIT): voertuigen (nummer, kenteken met en zonder streepjes, chauffeur), opleggers,
// chauffeurs, standplaatsen (met hun klanten en formules), winkels en DC's (alle winkels en DC's uit places.js), plaatsen,
// ritten, pauzeplekken, weergaven en acties. Tikfouten mogen ("wognm" vindt Wognum), een kenteken mag zonder streepjes
// ("67JQZ") en met een tikfout, ook twee omgewisselde tekens ("37QJJ7" vindt 37-JQJ-7), een formule vindt de standplaatsen
// die ervoor rijden ("lidl"), en de naam van een plaats of standplaats (ook met een tikfout: "purmrend") zet die plek
// bovenaan. Meldingen en werkorders veranderen door de dag en worden bij elke zoekvraag apart bekeken. De index wordt een
// keer gebouwd als de app klaar is; daarna werkt hij alleen bij wat een actie op het plan veranderde (ritten, open ritten,
// de chauffeurs op een voertuig), zodat ook de eerste zoekvraag na een toewijzing binnen 100 ms antwoord geeft.
// Enter opent de bovenste (of gekozen) suggestie; wat een plek heeft, opent op de kaart en de kaart vliegt ernaartoe.
// Toetsen: / of Ctrl K zet de focus in het veld, pijltjes kiezen, Enter opent, Esc sluit. Rollen: combobox en listbox.
import MiniSearch from 'minisearch';
import { esc, ic, hhmm, nl1, on, VST, TST } from './base.js';
import { SP, TOWNS, CITIES, WINKELS, DCS, plekNaam } from '../places.js';
import { KIND, TRT } from '../fleet.js';
import { VIEWS } from './nav.js';
import { pool as poolAlles, vensterAbs } from './planwijzig.js';
import { charters, oproepkrachten, SOORT_FLEX } from './invulling.js';

const SOORT = { dc: 'DC', fabriek: 'Fabriek', groothandel: 'Groothandel' };
const GROEP = { Voertuig: 'Voertuigen', Oplegger: 'Opleggers', Chauffeur: 'Chauffeurs', Standplaats: 'Standplaatsen', Winkel: 'Winkels en DC\'s', DC: 'Winkels en DC\'s', Plaats: 'Plaatsen', Rit: 'Ritten', 'Open rit': 'Open ritten', Charter: 'Charters en oproepkrachten', Oproepkracht: 'Charters en oproepkrachten', Pauzeplek: 'Pauzeplekken', Weergave: 'Weergaven', Actie: 'Acties' };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const zonder = s => String(s || '').replace(/[-\s]/g, '');
// klanten en formules van alle standplaatsen, genormaliseerd per woord (een keer opgebouwd)
let formule = null;
const FORMULE = () => formule || (formule = new Set(SP.flatMap(sp => [sp.klant, ...(sp.formules || [])]).flatMap(x => String(x || '').split(/[\s,/]+/)).map(norm).filter(w => w.length >= 3)));
// Hoeveel tikfouten scheiden twee woorden: een teken anders, erbij of eraf, of twee buren omgewisseld (optimal string
// alignment). MiniSearch telt een omwisseling als twee fouten, daarom vond "37QJJ7" het kenteken 37-JQJ-7 niet. Rekent
// niet verder dan max: daarboven geeft hij max + 1.
function afstand(a, b, max) {
  if (a === b) return 0;
  const n = a.length, m = b.length; if (Math.abs(n - m) > max) return max + 1;
  let p2 = null, p1 = new Array(m + 1); for (let j = 0; j <= m; j++) p1[j] = j;
  let vorigeMin = 0;
  for (let i = 1; i <= n; i++) {
    const c = new Array(m + 1); c[0] = i; let rijMin = i;
    for (let j = 1; j <= m; j++) {
      let v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      c[j] = v; if (v < rijMin) rijMin = v;
    }
    // een omwisseling kijkt twee rijen terug: pas stoppen als ook de vorige rij al boven de grens zat
    if (rijMin > max && vorigeMin > max) return max + 1;
    vorigeMin = rijMin; p2 = p1; p1 = c;
  }
  return Math.min(p1[m], max + 1);
}
// Een kenteken: vijf tot acht letters en cijfers (zonder streepjes), met minstens een van elk.
const lijktKenteken = k => /^[A-Z0-9]{5,8}$/.test(k) && /\d/.test(k) && /[A-Z]/.test(k);
// Hoeveel tikfouten bij een naam van een plaats of standplaats mogen: geen bij korte namen, een vanaf vier tekens, twee
// vanaf tien.
const maxFout = n => (n >= 10 ? 2 : n >= 4 ? 1 : 0);

export function createSearch(ctx) {
  let el = null, input = null, list = null, items = [], act = 0, recent = [], idx = null, idxVer = -1, docs = null;
  // kentekens (zonder streepjes, hoofdletters) en de namen van plaatsen en standplaatsen, voor de tikfouten hierboven
  let kentekens = [], namen = [];
  // de onderdelen die door de dag veranderen (ritten, open ritten, de chauffeurs op een voertuig): per sleutel het
  // document en zijn inhoud, zodat een nieuwe planversie alleen bijwerkt wat anders is
  const dyn = new Map(); let bijgewerkt = { ms: 0, nieuw: 0, anders: 0, weg: 0 }, gebouwd = null;

  // ---------- index ----------
  const ritDoc = r => ['Rit', r.id, `${r.klant} · ${r.t.id} · ${r.dest.slice(0, 2).join(', ')}`, [r.t.id, r.klant, zonder(r.id), ...r.dest].join(' '), r.id];
  const openDoc = p => { const v = vensterAbs(p); return ['Open rit', p.klant || p.id, `${p.sp} · laden ${v ? hhmm(v[0]) : ''}${p.dag === 'morgen' ? ' morgen' : ''}`, [p.id, zonder(p.id), p.sp, p.klant, p.reden, 'open'].join(' '), p.id]; };
  const voertuigDoc = t => ['Voertuig', t.id, `${KIND[t.kind].n} · ${t.base.n} · ${t.plate}`, [t.plate, zonder(t.plate), zonder(t.id), t.model, KIND[t.kind].n, ...t.diensten.map(d => d.driver)].join(' '), t.id];
  // alles wat door de dag kan veranderen, met een vaste sleutel
  function dynamisch(add) {
    const { fleet, R } = ctx;
    for (const t of fleet.trucks) add(`v:${t.id}`, voertuigDoc(t));
    for (const r of R.all()) add(`r:${r.id}`, ritDoc(r));
    for (const p of poolAlles(ctx)) add(`o:${p.id}`, openDoc(p));
  }
  function bouw() {
    const t0 = performance.now(); const { fleet, people, R } = ctx; const D = []; let n = 0;
    const add = (type, label, sub, kw, ref, extra = {}) => { D.push({ id: n, type, label, sub, kw, ref, ...extra }); return n++; };
    dyn.clear();
    dynamisch((key, [type, label, sub, kw, ref]) => { const id = add(type, label, sub, kw, ref); dyn.set(key, { id, sig: `${label}\u0001${sub}\u0001${kw}` }); });
    for (const tr of fleet.trailers) add('Oplegger', tr.id, `${TRT[tr.type].n} · ${tr.base.n} · ${tr.plate}`, [tr.plate, zonder(tr.plate), zonder(tr.id), TRT[tr.type].n].join(' '), tr.id);
    for (const p of people.persons) add('Chauffeur', p.name, `${p.role} · ${p.base.n}`, [p.base.n, p.role].join(' '), p.id);
    for (const sp of SP) add('Standplaats', sp.n, `${sp.fleet} voertuigen · ${sp.regio} · ${sp.klant}`, [sp.klant, ...(sp.formules || []), sp.prov, sp.regio, sp.adres && typeof sp.adres === 'object' ? `${sp.adres.straat} ${sp.adres.postcode} ${sp.adres.plaats}` : sp.adres || ''].join(' '), sp.n);
    for (const w of WINKELS) if (!w.eiland) add('Winkel', plekNaam(w), `${w.formule} · ${w.plaats}`, [w.formule, w.plaats].join(' '), w.id);
    for (const d of DCS) add('DC', d.naam, `${SOORT[d.soort] || 'DC'} ${d.formule || ''} · ${d.plaats}`, [d.formule, d.plaats, d.soort].join(' '), d.id, { soort: SOORT[d.soort] || 'DC' });
    const seen = new Set(); for (const c of [...CITIES, ...TOWNS]) { if (seen.has(c.n)) continue; seen.add(c.n); add('Plaats', c.n, 'plaats', '', c.n, { lon: c.lon, lat: c.lat }); }
    for (const c of charters(ctx)) add('Charter', c.naam, `charter · ${c.plaats}`, [c.id, c.contactpersoon, c.plaats, c.regio, ...c.opleggers, 'charter'].join(' '), c.id);
    for (const o of oproepkrachten(ctx)) add('Oproepkracht', o.naam, `${SOORT_FLEX[o.soort] || o.soort} · ${o.standplaats}`, [o.id, o.standplaats, SOORT_FLEX[o.soort] || '', 'oproep flex'].join(' '), o.id);
    for (const p of ctx.rest.places) add('Pauzeplek', p.n, p.sub, p.n.replace('Pauzeplek ', ''), p.id);
    for (const [k, nm, icon] of VIEWS) add('Weergave', nm, 'open deze weergave', k, k, { icon });
    const ACT = [['Werkgebied wijzigen', 'pin', 'werkgebied'], ['Sneltoetsen', 'keyboard', 'toetsen'], ['Thema wisselen', 'moon', 'thema donker licht'], ['Assistent', 'spark', 'voorstellen'], ['Hal-scherm', 'tv', 'vertrekbord tv']];
    for (const [nm, icon, kw] of ACT) add('Actie', nm, 'actie', kw, nm, { icon });
    const ms = new MiniSearch({
      fields: ['label', 'sub', 'kw', 'type'], storeFields: ['type'], idField: 'id',
      tokenize: s => String(s).split(/[\s·,/()]+/).filter(Boolean), processTerm: t => norm(t) || null,
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { label: 3, kw: 2 }, combineWith: 'AND' },
    });
    ms.addAll(D); docs = D; idx = ms; idxVer = R.ver(); gebouwd = { ms: Math.round(performance.now() - t0), om: Math.round(performance.now()) };
    // de kentekens van voertuigen en opleggers en de namen van plaatsen en standplaatsen veranderen niet door de dag
    kentekens = D.filter(d => d.type === 'Voertuig' || d.type === 'Oplegger').map(d => ({ k: zonder((d.type === 'Voertuig' ? fleet.byId.get(d.ref) : fleet.trailerById.get(d.ref)).plate).toUpperCase(), id: d.id }));
    namen = D.filter(d => d.type === 'Plaats' || d.type === 'Standplaats').map(d => ({ n: norm(d.label).replace(/\s+/g, ' '), id: d.id, sp: d.type === 'Standplaats' }));
  }
  // een nieuwe planversie (toewijzen, verplaatsen, een voorstel): alleen de veranderde documenten bijwerken
  function werkBij() {
    const t0 = performance.now(); const v = ctx.R.ver(); const tel = { nieuw: 0, anders: 0, weg: 0 }; const gezien = new Set();
    dynamisch((key, [type, label, sub, kw, ref]) => {
      gezien.add(key); const sig = `${label}\u0001${sub}\u0001${kw}`; const o = dyn.get(key);
      if (o && o.sig === sig) return;
      if (o) { const d = { id: o.id, type, label, sub, kw, ref }; docs[o.id] = d; idx.replace(d); o.sig = sig; tel.anders++; return; }
      const d = { id: docs.length, type, label, sub, kw, ref }; docs.push(d); idx.add(d); dyn.set(key, { id: d.id, sig }); tel.nieuw++;
    });
    for (const [key, o] of dyn) if (!gezien.has(key)) { idx.discard(o.id); docs[o.id] = null; dyn.delete(key); tel.weg++; }
    idxVer = v; bijgewerkt = { ms: Math.round((performance.now() - t0) * 10) / 10, ...tel };
  }
  const klaar = () => { if (!idx) bouw(); else if (idxVer !== ctx.R.ver()) werkBij(); return idx; };
  // Een zoekvraag wacht nooit op het bijwerken: na een nieuwe planversie zoekt hij meteen in de index die er is en werkt
  // hij die direct daarna bij (meestal heeft de rustige bijwerker hieronder dat al gedaan); staat de lijst dan nog open,
  // dan tekent hij hem opnieuw, met wat er net bij kwam.
  let straks = false;
  function bijwerkenStraks() {
    if (straks) return; straks = true;
    setTimeout(() => { straks = false; if (!idx || idxVer === ctx.R.ver()) return; try { werkBij(); } catch { return; } if (list && !list.hidden && input && input.value.trim()) render(); }, 0);
  }
  // na het laden in een rustig moment bouwen, zodat de eerste toets meteen antwoord geeft; en na een wijziging in het plan
  // alvast bijwerken als de browser even niets te doen heeft, zodat ook de eerste toets daarna snel is
  const rustig = f => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 200));
  setTimeout(() => { try { klaar(); } catch { /* later */ } }, 1500);
  let wacht = false;
  setInterval(() => { if (!idx || wacht || idxVer === ctx.R.ver()) return; wacht = true; rustig(() => { wacht = false; try { klaar(); } catch { /* bij de volgende zoekvraag */ } }); }, 800);
  // kentekens met een tikfout (ook twee omgewisselde tekens), het kenteken zelf eerst
  function kentekenTreffers(q) {
    const k = zonder(q).toUpperCase(); if (!lijktKenteken(k)) return [];
    const out = []; for (const x of kentekens) { const d = afstand(k, x.k, 1); if (d <= 1) out.push({ id: x.id, d }); }
    return out.sort((a, b) => a.d - b.d).slice(0, 8);
  }
  // de naam van een plaats of standplaats, ook met een tikfout: een standplaats gaat voor een plaats met dezelfde naam
  function naamTreffers(nq) {
    const max = maxFout(nq.length); if (nq.length < 3) return [];
    const out = []; for (const x of namen) { const d = afstand(nq, x.n, max); if (d <= max) out.push({ id: x.id, d, sp: x.sp }); }
    return out.sort((a, b) => a.d - b.d || b.sp - a.sp).slice(0, 4);
  }

  // een voertuig, oplegger of persoon opent als pagina; de kaart in die pagina vliegt erheen (ctx.vliegBijDock)
  const pagina = h => { if (ctx.vliegBijDock) ctx.vliegBijDock(); ctx.go(h); };
  // ---------- een treffer als suggestie (met de toestand van nu) ----------
  function item(d) {
    const { fleet, people, S, TRS } = ctx; const T = ctx.state.simTime;
    if (d.type === 'Voertuig') { const t = fleet.byId.get(d.ref); const s = S.get(t.id); const drv = ctx.driverName(t); return { icon: t.kind === 'bus' ? 'bus' : 'truck', label: `${t.id} · ${drv || 'geen dienst'}`, sub: `${KIND[t.kind].n} · ${t.base.n}${s ? ` · ${VST[s.st].n.toLowerCase()}` : ''} · ${t.plate}`, type: KIND[t.kind].n, run: () => pagina(`voertuig/${t.id}/vandaag`) }; }
    if (d.type === 'Oplegger') { const tr = fleet.trailerById.get(d.ref); const s = TRS.get(tr.id); return { icon: 'trailer', label: `${tr.id} · ${TRT[tr.type].n}`, sub: `${tr.base.n}${s ? ` · ${TST[s.st].n.toLowerCase()}${s.vehicle ? ` achter ${s.vehicle.id}` : s.place ? `, ${s.place}` : ''}` : ''} · ${tr.plate}`, type: 'Oplegger', run: () => pagina(`oplegger/${tr.id}/vandaag`) }; }
    if (d.type === 'Chauffeur') { const p = people.byId.get(d.ref); const dd = p.dienst; const busy = dd && dd.d.start <= T && T < dd.d.end; return { icon: 'user', label: p.name, sub: `${p.role} · ${p.base.n}${dd ? ` · ${busy ? 'nu op' : 'vandaag op'} ${dd.t.id} (${hhmm(dd.d.start)}–${hhmm(dd.d.end)})` : ' · vandaag vrij'}`, type: 'Chauffeur', run: () => pagina(`persoon/${p.id}`) }; }
    if (d.type === 'Standplaats') return { icon: 'depot', label: d.label, sub: d.sub, type: 'Standplaats', run: () => ctx.go(`kaart:sp:${d.ref}`) };
    if (d.type === 'Winkel' || d.type === 'DC') return { icon: d.type === 'DC' ? 'depot' : 'store', label: d.label, sub: d.sub, type: d.soort || d.type, run: () => ctx.go(`kaart:winkel:${d.ref}`) };
    if (d.type === 'Plaats') return { icon: 'pin', label: d.label, sub: 'plaats', type: 'Plaats', run: () => ctx.flyTo(d.lon, d.lat, 11.2, d.label) };
    if (d.type === 'Rit') { const r = ctx.R.get(d.ref); return r ? { icon: 'route', label: `${r.id} · ${r.klant}`, sub: `${r.t.id} · vertrek ${hhmm(r.dep)} · ${r.dest.slice(0, 2).join(', ')}`, type: 'Rit', run: () => ctx.go(`rit/${r.id}`) } : null; }
    if (d.type === 'Open rit') { const p = poolAlles(ctx).find(x => x.id === d.ref); const v = p && vensterAbs(p); return p ? { icon: 'inbox', label: `${p.klant || p.id} · open rit`, sub: `${p.sp} · ${p.gepland ? 'toegewezen' : 'nog open'} · laden ${p.dag === 'morgen' ? 'morgen ' : ''}${v ? hhmm(v[0]) : ''}`, type: 'Open rit', run: () => ctx.go(`openritten/${p.id}`) } : null; }
    if (d.type === 'Charter') return { icon: 'contact', label: d.label, sub: d.sub, type: 'Charter', run: () => ctx.go(`charter/${d.ref}`) };
    if (d.type === 'Oproepkracht') return { icon: 'user', label: d.label, sub: d.sub, type: 'Oproepkracht', run: () => ctx.go(`oproep/${d.ref}`) };
    if (d.type === 'Pauzeplek') { const p = ctx.rest.byId.get(d.ref); return p ? { icon: 'coffee', label: p.n, sub: `${nl1(ctx.rest.score(p))} sterren · ${p.sub}`, type: 'Pauzeplek', run: () => ctx.selectRest(p.id) } : null; }
    if (d.type === 'Weergave') return { icon: d.icon, label: d.label, sub: 'open deze weergave', type: 'Weergave', run: () => ctx.navTo(d.ref) };
    if (d.type === 'Actie') { const RUN = { 'Werkgebied wijzigen': () => ctx.openWizard(1), Sneltoetsen: () => ctx.showKeys(), 'Thema wisselen': () => ctx.toggleTheme(), Assistent: () => ctx.toggleAssist(true), 'Hal-scherm': () => ctx.go(`hal/${(ctx.profile() && ctx.profile().sp) || 'Wognum'}`) }; return { icon: d.icon, label: d.label, sub: 'actie', type: 'Actie', run: RUN[d.label] }; }
    return null;
  }

  // ---------- zoeken ----------
  function find(qs) {
    const q = qs.trim(); const G = [];
    if (!q) {
      if (recent.length) G.push({ type: 'Recent', items: recent.slice(0, 5), best: 1 });
      G.push({ type: 'Weergaven', items: VIEWS.slice(0, 6).map(([k, n, icon]) => ({ icon, label: n, sub: 'open deze weergave', type: 'Weergave', run: () => ctx.navTo(k) })), best: 0 });
      return G;
    }
    const oud = !!idx && idxVer !== ctx.R.ver(); const res = (oud ? idx : klaar()).search(q); if (oud) bijwerkenStraks(); const per = new Map();
    // voorrang, met hun groep bovenaan: een kenteken (ook met een tikfout) en de naam van een plaats of standplaats (een
    // standplaats voor een plaats met dezelfde naam); daarna wat MiniSearch vindt
    const top = res.length ? res[0].score : 1; const nq = norm(q).replace(/\s+/g, ' ');
    const voor = [...kentekenTreffers(q).map(x => ({ id: x.id, score: top * (x.d ? 2 : 3), best: 1.5e9 })), ...naamTreffers(nq).map(x => ({ id: x.id, score: top * (3 - x.d), best: x.sp ? 2e9 : 1.9e9 }))];
    const al = new Set(voor.map(x => x.id));
    for (const h of [...voor, ...res.filter(x => !al.has(x.id))]) {
      const d = docs[h.id]; if (!d) continue; const g = GROEP[d.type] || d.type; let e = per.get(g);
      if (!e) { e = { type: g, items: [], best: h.best || h.score }; per.set(g, e); } else if (h.best && h.best > e.best) e.best = h.best;
      if (e.items.length < (g === 'Plaatsen' || g === 'Weergaven' ? 3 : 4)) { const it = item(d); if (it) e.items.push(it); }
    }
    // een klant of formule ("lidl", "jumbo"): eerst de standplaatsen die ervoor rijden
    const toks = q.split(/\s+/).map(norm).filter(Boolean);
    if (toks.some(w => w.length >= 3 && FORMULE().has(w))) { const g = per.get('Standplaatsen'); if (g) g.best = 1e9; }
    G.push(...per.values());
    // meldingen en werkorders: veranderen door de dag, dus hier los bekeken
    const has = s => norm(s).includes(nq);
    const Z = nq.length >= 2 ? ctx.Z.scoped().filter(z => z.present || z.status === 'opgelost').filter(z => has(`${z.obj} ${z.kind} ${z.text}`)).slice(0, 3) : [];
    if (Z.length) G.push({ type: 'Meldingen', items: Z.map(z => ({ icon: 'alert', label: `${z.kind} · ${z.obj}`, sub: z.text, type: 'Melding', run: () => ctx.go(`melding/${z.id}`) })), best: 5 });
    const wo = nq.length >= 3 && ('werkorder'.startsWith(nq) || /storing|garage|werkplaats|onderhoud/.test(nq));
    const WO = [];
    for (const t of ctx.fleet.trucks) { const info = ctx.people.forTruck.get(t.id); const w = t.storing || (info.werkorder && info.werkorder.what); if (!w || !(wo || (nq.length >= 3 && has(w)))) continue; WO.push({ icon: 'wrench', label: `${t.id} · ${w}`, sub: t.workorder ? 'werkorder aangemaakt' : t.storing ? 'gemeld vandaag, nog geen werkorder' : `open sinds ${info.werkorder.since}`, type: 'Werkorder', run: () => ctx.go(`voertuig/${t.id}/onderhoud`) }); }
    for (const tr of ctx.fleet.trailers) { const info = ctx.people.forTrailer.get(tr.id); const w = tr.storing || (info.werkorder && info.werkorder.what); if (!w || !(wo || (nq.length >= 3 && has(w)))) continue; WO.push({ icon: 'wrench', label: `${tr.id} · ${w}`, sub: tr.workorder ? 'werkorder aangemaakt' : tr.storing ? 'gemeld vandaag, nog geen werkorder' : `open sinds ${info.werkorder.since}`, type: 'Werkorder', run: () => ctx.go(`oplegger/${tr.id}/onderhoud`) }); }
    if (WO.length) G.push({ type: 'Werkorders', items: WO.slice(0, wo ? 6 : 3), best: wo ? 1e6 : 4 });
    // hal-scherm van een standplaats bij een (bijna) exacte naam
    for (const sp of SP) if (norm(sp.n) === nq || (nq.length >= 4 && norm(sp.n).startsWith(nq))) { G.push({ type: 'Hal-scherm', items: [{ icon: 'tv', label: `Hal-scherm ${sp.n}`, sub: 'vertrekbord op volledig scherm', type: 'Hal-scherm', run: () => { ctx.go(`hal/${sp.n}`); ctx.fullscreen(); } }], best: 0.5 }); break; }
    return G.sort((a, b) => b.best - a.best).slice(0, 7);
  }

  // ---------- palet ----------
  function render() {
    const G = find(input.value); items = G.flatMap(g => g.items); if (act >= items.length) act = 0;
    let i = 0;
    list.innerHTML = items.length ? G.map(g => `<div class="zoek-g" role="presentation">${esc(g.type)}</div>${g.items.map(it => { const k = i++; return `<button class="sg-item ${k === act ? 'on' : ''}" type="button" role="option" id="sg${k}" aria-selected="${k === act}" data-sg="${k}" tabindex="-1">${ic(it.icon, 17)}<b>${esc(it.label)}</b><span class="sg-type">${esc(it.type)}</span><small>${esc(it.sub)}</small></button>`; }).join('')}`).join('') + '<div class="zoek-f" aria-hidden="true"><span>↑↓ kiezen</span><span>Enter openen</span><span>Esc sluiten</span></div>'
      : `<div class="empty">${ic('search', 18)}<b>Niets gevonden voor "${esc(input.value.trim())}"</b><span>Zoek op voertuignummer, kenteken, oplegger, chauffeur, standplaats, winkel, plaats of ritnummer. Een tikfout mag.</span></div>`;
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-activedescendant', items.length ? `sg${act}` : '');
    const on2 = list.querySelector('.sg-item.on'); if (on2) on2.scrollIntoView({ block: 'nearest' });
  }
  function close(blur = true) { if (!list) return; list.hidden = true; input.setAttribute('aria-expanded', 'false'); el.classList.remove('open'); if (blur && document.activeElement === input) input.blur(); }
  function run(k) { const it = items[k]; if (!it || !it.run) return; recent = [{ ...it }, ...recent.filter(x => x.label !== it.label)].slice(0, 6); input.value = ''; close(); it.run(); }
  function mount(container) {
    el = container;
    el.innerHTML = `<div class="fsearch">${ic('search', 16)}<input class="fld" id="zoekIn" type="search" role="combobox" aria-expanded="false" aria-controls="zoekL" aria-autocomplete="list" aria-label="Zoeken" placeholder="Zoek voertuig, oplegger, chauffeur, plaats" autocomplete="off" spellcheck="false"><span class="kbd" aria-hidden="true">/</span></div><button class="ib zoek-x" type="button" id="zoekOpen" aria-label="Zoeken">${ic('search', 18)}</button><button class="ib zoek-c" type="button" id="zoekClose" aria-label="Zoeken sluiten">${ic('x', 18)}</button><div class="zoek-l" id="zoekL" role="listbox" aria-label="Suggesties" hidden></div>`;
    input = el.querySelector('#zoekIn'); list = el.querySelector('#zoekL');
    input.addEventListener('input', () => { act = 0; render(); });
    input.addEventListener('focus', () => render());
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); act = Math.min(items.length - 1, act + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(act); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (input.value) { input.value = ''; render(); } else close(); }
      else if (e.key === 'Tab') close(false);
    });
    on(list, 'pointerdown', '[data-sg]', e => e.preventDefault());
    on(list, 'click', '[data-sg]', (e, b) => run(+b.dataset.sg));
    input.addEventListener('blur', () => setTimeout(() => { if (!el.contains(document.activeElement)) close(false); }, 120));
    el.querySelector('#zoekOpen').addEventListener('click', () => focus());
    el.querySelector('#zoekClose').addEventListener('click', () => close());
  }
  function focus() { if (!input) return; if (ctx.narrow()) el.classList.add('open'); input.focus(); input.select(); render(); }
  // index() voor de controles; bijgewerkt() zegt wat de laatste nieuwe planversie kostte (ms en het aantal documenten)
  return { mount, focus, close, find, isOpen: () => list && !list.hidden, index: () => klaar(), bijgewerkt: () => ({ ...bijgewerkt, gebouwd, bij: idxVer === ctx.R.ver() }) };
}
