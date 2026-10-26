// Plannen en vrijgeven (Control Tower 4.1, bouwsteen C), met het bericht aan de chauffeur (D, bericht.js) en de ritopdracht
// naar de boordcomputer (E, ritopdracht.js). Per standplaats de diensten van de gesimuleerde dag met chauffeur, voertuig,
// oplegger en ritten, en per dienst een status: concept, vrijgegeven, gezien, bevestigd, onderweg, afgerond. "Planning
// vrijgeven" geeft alle concepten van de standplaats in een keer vrij: elke chauffeur een bericht (per app of per mail,
// gesimuleerd), elke rit een OTM5-ritopdracht, een logregel per dienst en een samenvatting. Wat er vrijgegeven werd, staat
// als een korte momentopname in localStorage (sl-vrijgave, per dag en apart op de oefendag). Verandert er daarna iets aan
// een dienst (een rit erbij of eraf, een andere tijd, een ander voertuig of een andere oplegger), dan toont de weergave
// precies dat verschil, en "Wijzigingen vrijgeven" geeft alleen dat door. Onderweg en afgerond volgen uit de simulatie.
//
// De demo heeft een gesimuleerde dag. Vrijgeven geldt voor de diensten die nog niet begonnen zijn: vroeg op de dag is dat de
// hele planning (in het echt geef je die de middag ervoor vrij, als de ritten van morgen binnen zijn), later op de dag de
// volgende dienst (de middag- en avondploeg). Een dienst wordt hier aangewezen met het personeelsnummer van de chauffeur:
// zo blijft hij dezelfde als hij naar een ander voertuig gaat.
import { SP } from '../places.js';
import { esc, ic, fmt, hhmm, on, swap, empty, belKnop, durTxt } from './base.js';
import { kanaalVan, KANAAL, WACHT_NORM, bevestiging, standNa, berichtVan, pauzesVan } from './bericht.js';
import { ritopdrachten, bundel, bewaar } from './ritopdracht.js';

const KEY = 'sl-vrijgave';
export const STATUS = {
  concept: ['Concept', ''], vrijgegeven: ['Vrijgegeven', 'b-info'], gezien: ['Gezien', 'b-info'], bevestigd: ['Bevestigd', 'b-ok'],
  onderweg: ['Onderweg', 'st-onderweg'], afgerond: ['Afgerond', ''], vervalt: ['Vervalt', 'b-warn'],
};
const BC = { klaar: 'klaar', verzonden: 'verzonden', bevestigd: 'bevestigd' };
const cyc = m => ((m % 1440) + 1440) % 1440;
const r0 = m => Math.round(m);

// ---------- opslag: per dag (en apart op de oefendag), per standplaats, per dienst ----------
const isoVan = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const datumVan = ctx => isoVan(ctx.fleet.vandaag || new Date());
const dagKey = ctx => `${datumVan(ctx)}${ctx.root.dataset.oefendag ? `:${ctx.root.dataset.oefendag}` : ''}`;
function opslag(ctx) {
  if (!ctx.ui.vgStore) { let o = null; try { o = JSON.parse(ctx.store.get(KEY) || 'null'); } catch { o = null; } ctx.ui.vgStore = o && o.v === 1 && o.dagen ? o : { v: 1, dagen: {} }; }
  return ctx.ui.vgStore;
}
function bewaarOpslag(ctx) { const o = opslag(ctx); const ks = Object.keys(o.dagen).sort(); while (ks.length > 4) delete o.dagen[ks.shift()]; ctx.store.set(KEY, JSON.stringify(o)); }
const recsVan = (ctx, sp) => { const o = opslag(ctx); const d = o.dagen[dagKey(ctx)] || (o.dagen[dagKey(ctx)] = {}); return d[sp.n] || (d[sp.n] = {}); };

// ---------- de diensten van een standplaats ----------
// stand in de simulatie: komt nog (ook voor het begin van het dagplan van het voertuig), onderweg of afgerond
function standSim(t, d, T) { const Td = cyc(T); if (Td < t.dayStart) return 'komt'; const rel = Td - t.dayStart; return rel < d.t0 ? 'komt' : rel < d.t1 ? 'onderweg' : 'afgerond'; }
export function dienstenVan(ctx, sp) {
  const T = ctx.state.simTime; const per = new Map();
  for (const r of ctx.R.all()) { if (r.t.base !== sp || !r.dienst) continue; let L = per.get(r.dienst); if (!L) per.set(r.dienst, L = []); L.push(r); }
  const out = [];
  for (const t of ctx.fleet.trucks) {
    if (t.base !== sp) continue;
    for (const d of t.diensten) {
      const ritten = (per.get(d) || []).sort((a, b) => a.dep - b.dep); const p = d.person || null;
      out.push({ key: p ? p.id : `${t.id}#${d.i}`, t, d, p, naam: d.driver || (p && p.name) || '', start: d.start, end: d.end, ritten, tr: (ritten.find(r => r.tr) || {}).tr || null, sim: standSim(t, d, T) });
    }
  }
  return out.sort((a, b) => a.start - b.start || (a.t.id < b.t.id ? -1 : 1));
}
// de momentopname die bij vrijgeven bewaard wordt (geplande tijden, zonder de vertraging van de simulatie)
const snapVan = e => ({ t: e.t.id, tr: e.tr ? e.tr.id : '', a: r0(e.start), b: r0(e.end), n: e.naam, r: e.ritten.map(r => ({ id: r.id, a: r0(r.depPlan), s: r.dest.join(', ') })) });
// het verschil tussen wat vrijgegeven is en het plan nu: regels { txt, rit? }; een afwijking onder vijf minuten telt niet
export function verschil(oud, nu) {
  if (!nu) return [{ txt: `De dienst vervalt (was ${hhmm(oud.a)} op ${oud.t})` }];
  const L = [];
  if (oud.t !== nu.t) L.push({ txt: `Voertuig ${oud.t} wordt ${nu.t}`, alle: true });
  if ((oud.tr || '') !== (nu.tr || '')) L.push({ txt: oud.tr && nu.tr ? `Oplegger ${oud.tr} wordt ${nu.tr}` : nu.tr ? `Oplegger ${nu.tr} erbij` : `Geen oplegger meer (was ${oud.tr})`, alle: true });
  if (Math.abs(oud.a - nu.a) >= 5) L.push({ txt: `Begin ${hhmm(oud.a)} wordt ${hhmm(nu.a)}` });
  const om = new Map(oud.r.map(x => [x.id, x])); const nm = new Set(nu.r.map(x => x.id));
  for (const x of nu.r) {
    const o = om.get(x.id);
    if (!o) L.push({ txt: `Rit ${x.id} erbij: vertrek ${hhmm(x.a)}, ${x.s || 'zonder stops'}`, rit: x.id });
    else { if (Math.abs(o.a - x.a) >= 5) L.push({ txt: `Rit ${x.id} vertrekt ${hhmm(x.a)} in plaats van ${hhmm(o.a)}`, rit: x.id }); if (o.s !== x.s) L.push({ txt: `Rit ${x.id} gaat nu naar ${x.s || 'geen stops'}`, rit: x.id }); }
  }
  for (const o of oud.r) if (!nm.has(o.id)) L.push({ txt: `Rit ${o.id} vervalt (vertrek was ${hhmm(o.a)})`, weg: o.id });
  if (!L.length && Math.abs(oud.b - nu.b) >= 15) L.push({ txt: `Einde ${hhmm(oud.b)} wordt ${hhmm(nu.b)}` });
  return L;
}
// minuten sinds het versturen; is de klok teruggezet tot voor dat moment, dan nul. Een dienst die al begon: de tijd van het
// versturen tot het begin, plus de tijd sinds het begin.
function sinds(rec, e, T, begonnen) {
  const totRel = cyc(e.start - rec.T); if (begonnen) return totRel + cyc(T - e.start);
  const tot = cyc(e.start - T);
  return tot > totRel ? 0 : totRel - tot;
}
// de stand van een dienst voor de planner, met het bericht, de bevestiging en de ritopdrachten
export function standVan(ctx, e, rec) {
  const T = ctx.state.simTime; const x = { ...e, rec, diff: [], st: 'concept', wacht: false, na: 0, b: null };
  if (rec) { x.na = sinds(rec, e, T, e.sim !== 'komt'); x.b = bevestiging(e.key, rec.v, dagKey(ctx)); }
  if (e.sim !== 'komt') { x.st = e.sim; return x; }
  if (!rec) return x;
  x.st = standNa(x.b, x.na);
  x.wacht = x.st !== 'bevestigd' && x.na >= WACHT_NORM;
  x.diff = verschil(rec.s, snapVan(e));
  return x;
}
// de stand van de ritopdracht van een rit naar de boordcomputer (gesimuleerd): klaar, verzonden, bevestigd
function bcVan(x, r) {
  const rr = x.rec && x.rec.r[r.id]; if (!rr || x.diff.some(w => w.rit === r.id || w.alle)) return x.rec ? 'klaar' : null;
  if (x.st === 'onderweg' || x.st === 'afgerond') return x.b && x.b.akkoord !== null && x.na >= x.b.akkoord ? 'bevestigd' : 'verzonden';
  if (x.st === 'bevestigd') return 'bevestigd';
  return x.na >= 1 ? 'verzonden' : 'klaar';
}

// ---------- vrijgeven ----------
function vrijgeven(ctx, sp, L) {
  const recs = recsVan(ctx, sp); const T = ctx.state.simTime; const dag = dagNaam(ctx); let app = 0, mail = 0, nr = 0;
  for (const x of L) {
    const k = kanaalVan(x.key); if (k === 'app') app++; else mail++; nr += x.ritten.length;
    recs[x.key] = { T, v: 1, k, s: snapVan(x), r: Object.fromEntries(x.ritten.map(r => [r.id, { v: 1, T }])) };
    ctx.A.log(`stuurde ${x.naam || x.key} (${x.p ? x.p.id : x.t.id}) de dienst van ${dag} ${KANAAL[k]}: begin ${hhmm(x.start)} op ${x.t.id}${x.tr ? ` met ${x.tr.id}` : ''}, ${x.ritten.length} ${x.ritten.length === 1 ? 'rit' : 'ritten'}; ${x.ritten.length} ${x.ritten.length === 1 ? 'ritopdracht' : 'ritopdrachten'} naar de boordcomputer (gesimuleerd)`, { t: x.t.id, vrijgave: x.key });
  }
  bewaarOpslag(ctx);
  ctx.A.log(`gaf de planning van ${sp.n} voor ${dag} vrij: ${L.length} ${L.length === 1 ? 'dienst' : 'diensten'}, ${nr} ritten; ${app} berichten per app en ${mail} per mail, ${nr} ritopdrachten (gesimuleerd, er ging niets de deur uit)`, { vrijgave: sp.n });
  ctx.L.toast(`Planning van ${sp.n} vrijgegeven: ${L.length} ${L.length === 1 ? 'dienst' : 'diensten'}. De berichten en ritopdrachten zijn gesimuleerd verstuurd.`, { icon: 'send' });
  ctx.refreshAll();
}
function wijzigingenVrijgeven(ctx, sp, L, weg) {
  const recs = recsVan(ctx, sp); const T = ctx.state.simTime;
  for (const x of L) {
    const rec = recs[x.key]; const nu = snapVan(x); const nr = rec.v + 1;
    const ritten = { ...rec.r }; for (const w of x.diff) { if (w.weg) delete ritten[w.weg]; }
    for (const r of x.ritten) if (!ritten[r.id] || x.diff.some(w => w.rit === r.id || w.alle)) ritten[r.id] = { v: ((rec.r[r.id] || {}).v || 0) + 1, T };
    recs[x.key] = { T, v: nr, k: rec.k, s: nu, r: ritten, w: x.diff.map(w => w.txt) };
    ctx.A.log(`stuurde ${x.naam || x.key} (${x.p ? x.p.id : x.t.id}) ${KANAAL[rec.k]} een wijziging in de dienst: ${x.diff.map(w => w.txt).join('; ')}`, { t: x.t.id, vrijgave: x.key });
  }
  for (const [key, rec] of weg) { delete recs[key]; ctx.A.log(`stuurde ${rec.s.n || key} (${key}) ${KANAAL[rec.k]}: de dienst van ${hhmm(rec.s.a)} op ${rec.s.t} vervalt`, { t: rec.s.t, vrijgave: key }); }
  bewaarOpslag(ctx);
  const n = L.length + weg.length;
  ctx.A.log(`gaf ${n} ${n === 1 ? 'wijziging' : 'wijzigingen'} in de planning van ${sp.n} vrij; alleen het verschil ging naar de chauffeurs en de boordcomputer (gesimuleerd)`, { vrijgave: sp.n });
  ctx.L.toast(`${n} ${n === 1 ? 'wijziging' : 'wijzigingen'} vrijgegeven. Alleen het verschil is verstuurd (gesimuleerd).`, { icon: 'send' });
  ctx.refreshAll();
}

const dagNaam = ctx => (ctx.fleet.vandaag || new Date()).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const basisUrl = () => { try { return location.href.split('#')[0]; } catch { return ''; } };
const berichtOpts = (ctx, x, wijziging) => ({ dag: dagNaam(ctx), kanaal: x.rec ? x.rec.k : kanaalVan(x.key), pauzes: pauzesVan(x.t, x.d), basis: basisUrl(), wijziging });

// een rit met zijn ritopdracht (gemaakt op het moment van versturen, met het akkoord van de chauffeur als dat er is)
function itemVan(ctx, x, r) {
  const rr = x.rec && x.rec.r[r.id];
  const akk = x.b && x.b.akkoord !== null && x.na >= x.b.akkoord ? x.rec.T + x.b.akkoord : null;
  return { r, versie: rr ? rr.v : 0, T: rr ? rr.T : ctx.state.simTime, dienst: x.p ? x.p.id : x.key, akkoord: akk };
}
function toonRitopdracht(ctx, x, r) {
  const it = itemVan(ctx, x, r); const msg = ritopdrachten(ctx.fleet, [it], datumVan(ctx), it.T).get(r.id);
  if (!msg) { ctx.L.toast('Voor deze rit is geen ritopdracht te maken.', { icon: 'info' }); return; }
  const json = JSON.stringify(msg, null, 2); const bc = bcVan(x, r);
  const naam = `ritopdracht-${r.id}-v${it.versie || 0}.json`;
  ctx.L.openDialog(`<div class="dlg-h"><h2>Ritopdracht ${esc(r.id)}</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div>
    <div class="dlg-b vg-ro"><p class="hint">OTM ${esc(msg.otmVersie)} · ${it.versie ? `versie ${it.versie}, ${bc === 'klaar' ? 'klaar om te versturen' : `${BC[bc]} (gesimuleerd)`}` : 'nog niet vrijgegeven: zo gaat hij straks mee'} · ${msg.trips[0].actions.length} acties · de chauffeur als personeelsnummer, zonder naam. Naar welke boordcomputer en via welke koppeling bepalen we met ICT.</p>
    <pre class="vg-json" tabindex="0" aria-label="Ritopdracht ${esc(r.id)} als OTM5-JSON" data-ritopdracht="${esc(r.id)}">${esc(json)}</pre></div>
    <div class="dlg-f"><span class="hint grow">${fmt(json.length)} tekens</span><button class="btn" type="button" data-rocopy>${ic('copy', 15)}Kopieer</button><button class="btn pri" type="button" data-rodl>${ic('download', 15)}Download</button></div>`, {
    wide: true, label: `Ritopdracht ${r.id}`, onBind: dl => {
      dl.querySelector('[data-rodl]').addEventListener('click', () => { if (bewaar(naam, msg)) ctx.L.toast(`${naam} bewaard.`, { icon: 'download' }); });
      dl.querySelector('[data-rocopy]').addEventListener('click', () => { try { navigator.clipboard.writeText(json).then(() => ctx.L.toast('Ritopdracht gekopieerd.', { icon: 'copy' }), () => {}); } catch { /* geen klembord */ } });
    },
  });
}
function exporteer(ctx, sp, X) {
  const items = []; for (const x of X) if (x.rec) for (const r of x.ritten) items.push(itemVan(ctx, x, r));
  if (!items.length) { ctx.L.toast('Nog niets vrijgegeven op deze standplaats: er zijn geen ritopdrachten om te exporteren.', { icon: 'info' }); return; }
  const T = ctx.state.simTime; const m = ritopdrachten(ctx.fleet, items, datumVan(ctx), T);
  const doc = bundel([...m.values()], { standplaats: sp.n, datum: datumVan(ctx), T });
  const naam = `ritopdrachten-${sp.n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${datumVan(ctx)}.json`;
  if (bewaar(naam, doc, true)) { ctx.A.log(`exporteerde de ritopdrachten van ${sp.n}: ${doc.trips.length} ritten in OTM ${doc.otmVersie}`, { vrijgave: sp.n }); ctx.L.toast(`${naam}: ${doc.trips.length} ritopdrachten in OTM ${doc.otmVersie}.`, { icon: 'download' }); }
}

// ---------- de weergave ----------
const FILTERS = [['alle', 'Alle'], ['concept', 'Te vrijgeven'], ['gewijzigd', 'Gewijzigd'], ['wacht', 'Wacht op bevestiging'], ['vrij', 'Vrijgegeven'], ['onderweg', 'Onderweg'], ['afgerond', 'Afgerond']];
const inFilter = (x, f) => f === 'alle' || (f === 'concept' && x.st === 'concept') || (f === 'gewijzigd' && x.diff.length > 0) || (f === 'wacht' && x.wacht) || (f === 'vrij' && ['vrijgegeven', 'gezien', 'bevestigd'].includes(x.st)) || (f === 'onderweg' && x.st === 'onderweg') || (f === 'afgerond' && x.st === 'afgerond') || (f === 'gewijzigd' && x.st === 'vervalt');
const badge = st => `<span class="badge ${STATUS[st][1]}">${st === 'onderweg' ? '<i class="dot"></i>' : ''}${esc(STATUS[st][0])}</span>`;

function rijHtml(ctx, x, open) {
  const ritTxt = x.ritten.map(r => `${r.id} ${hhmm(r.depPlan)}`).join(', ');
  const bcs = x.ritten.map(r => bcVan(x, r)).filter(Boolean); const bcN = k => bcs.filter(b => b === k).length;
  const bcTxt = !x.rec ? '' : bcN('klaar') ? `${bcN('klaar')} klaar` : bcN('bevestigd') === bcs.length ? 'bevestigd' : `${bcN('verzonden')} verzonden`;
  const sb = x.b && x.rec ? standNa(x.b, x.na) : null;
  const conf = sb === 'bevestigd' ? `akkoord ${hhmm(x.rec.T + x.b.akkoord)}` : sb === 'gezien' ? `gezien ${hhmm(x.rec.T + x.b.gezien)}` : sb ? `verstuurd ${hhmm(x.rec.T)}` : '';
  const R = open ? berichtVan(x, berichtOpts(ctx, x, x.rec && x.rec.w ? x.rec.w.map(txt => ({ txt })) : null)) : [];
  const msgH = R.map(l => l.k === 'kop' ? `<b class="vg-mk">${esc(l.txt)}</b>` : l.k === 'link' ? `<span class="vg-ml">Bekijk je eerste rit: <button class="lnk" type="button" data-open="rit/${esc(l.rit)}">${esc(`${basisUrl()}#rit/${l.rit}`)}</button></span>` : l.k === 'rit' ? `<span class="vg-mr">${esc(l.txt)}</span>` : l.k === 'stop' ? `<span class="vg-ms">${esc(l.txt)}</span>` : `<span>${esc(l.txt)}</span>`).join('');
  const kanaal = x.rec ? x.rec.k : kanaalVan(x.key);
  const tijdlijn = x.rec ? `Verstuurd ${KANAAL[kanaal]} om ${hhmm(x.rec.T)} (versie ${x.rec.v})${x.b.gezien !== null && x.na >= x.b.gezien ? ` · gezien ${hhmm(x.rec.T + x.b.gezien)}` : ''}${x.b.akkoord !== null && x.na >= x.b.akkoord ? ` · akkoord ${hhmm(x.rec.T + x.b.akkoord)}` : ''}${x.wacht ? ` · nog geen akkoord na ${durTxt(x.na)}` : ''}` : `Voorbeeld: gaat ${KANAAL[kanaal]} zodra je vrijgeeft`;
  const ritRijen = !open ? '' : x.ritten.map(r => { const b = bcVan(x, r); return `<li data-rit="${esc(r.id)}"><button class="lnk" type="button" data-open="rit/${esc(r.id)}">${esc(r.id)}</button><span>${hhmm(r.depPlan)} tot ${hhmm(r.endPlan)}</span><span class="grow vg-dest">${esc(r.dest.join(', ') || 'geen stops')}</span><span class="vg-bc" data-bc="${b || ''}">${b ? `${ic('steer', 13)}${esc(BC[b])}` : '<span class="mut">nog niet vrijgegeven</span>'}</span><button class="btn sm" type="button" data-vgro="${esc(r.id)}" data-vgk="${esc(x.key)}">${ic('download', 14)}Ritopdracht</button></li>`; }).join('');
  const diff = x.diff.length ? `<span class="vg-diff">${ic('refresh', 13)}${x.diff.map(w => esc(w.txt)).join(' · ')}</span>` : '';
  return `<details class="vg-d" data-k="${esc(x.key)}" data-st="${x.st}"${x.wacht ? ' data-wacht="1"' : ''}${x.diff.length ? ' data-diff="1"' : ''}${open ? ' open' : ''}>
    <summary data-vgs="${esc(x.key)}"><span class="vg-tijd"><b>${hhmm(x.start)}</b><small>tot ${hhmm(x.end)}</small></span>
      <span class="vg-wie"><b>${esc(x.naam || 'Nog niemand')}</b><small>${esc(x.p ? x.p.id : x.key)} · ${esc(KANAAL[kanaal])}</small></span>
      <span class="vg-wat"><b>${esc(x.t.id)}${x.tr ? ` · ${esc(x.tr.id)}` : ''}</b><small>${x.ritten.length} ${x.ritten.length === 1 ? 'rit' : 'ritten'}: ${esc(ritTxt || 'geen')}</small></span>
      <span class="vg-st">${badge(x.st)}${x.wacht ? `<span class="badge b-warn">${ic('snooze', 12)}Wacht op bevestiging</span>` : ''}${x.diff.length ? '<span class="badge b-warn">Gewijzigd</span>' : ''}<small>${esc(conf)}${bcTxt ? `${conf ? ' · ' : ''}boordcomputer ${esc(bcTxt)}` : ''}</small></span>
      ${diff}</summary>
    ${open ? `<div class="vg-body">
      <div class="vg-msg" data-bericht="${esc(x.key)}"><div class="vg-mh">${ic(kanaal === 'app' ? 'msg' : 'mail', 15)}<span>${esc(tijdlijn)}</span></div><div class="vg-mb">${msgH}</div></div>
      <div class="vg-side"><h3>Ritten en boordcomputer</h3><ul class="vg-rit">${ritRijen || '<li class="mut">Geen ritten in deze dienst.</li>'}</ul>
      ${x.wacht && x.p ? `<div class="note warn">${ic('snooze', 16)}<div><b>Nog geen akkoord</b><div>${esc(x.naam)} gaf na ${durTxt(x.na)} nog geen akkoord. Bel om te horen of de dienst past.</div><div class="chips" style="margin-top:8px">${belKnop(x.naam, x.p.phone, { cls: 'btn sm' })}</div></div></div>` : ''}
      ${x.rec && x.rec.w && x.rec.w.length ? `<p class="hint">Laatste wijziging die ${esc(x.naam || 'de chauffeur')} kreeg: ${esc(x.rec.w.join('; '))}.</p>` : ''}</div>
    </div>` : ''}</details>`;
}
function wegHtml(key, rec) {
  return `<details class="vg-d" data-k="${esc(key)}" data-st="vervalt" data-diff="1"><summary><span class="vg-tijd"><b>${hhmm(rec.s.a)}</b><small>tot ${hhmm(rec.s.b)}</small></span><span class="vg-wie"><b>${esc(rec.s.n || key)}</b><small>${esc(key)} · ${esc(KANAAL[rec.k])}</small></span><span class="vg-wat"><b>${esc(rec.s.t)}</b><small>${rec.s.r.length} ritten vrijgegeven</small></span><span class="vg-st">${badge('vervalt')}<span class="badge b-warn">Gewijzigd</span></span><span class="vg-diff">${ic('refresh', 13)}De dienst staat niet meer in het plan; de chauffeur weet het nog niet.</span></summary><div class="vg-body"><p class="hint">Bij Wijzigingen vrijgeven krijgt de chauffeur bericht dat de dienst vervalt.</p></div></details>`;
}

// zelf: aangeroepen na een klik in de weergave (filter, open of dicht, standplaats); anders tekent de beurt van de
// simulatie, en dan blijft de kop staan zolang de lijst met standplaatsen de focus heeft (een open keuzelijst klapt niet dicht)
export function renderVrijgeven(ctx, el, zelf = false) {
  const ui = ctx.ui; const vg = ui.vg || (ui.vg = { f: 'alle', open: new Set() });
  const scope = ctx.spsInScope(); let sp = ctx.pbSp();
  // de standplaats van het planbord; buiten het werkgebied alleen als je hem zelf koos (de lijst of het adres)
  if (scope.length && !scope.includes(sp) && ui.vgSpVast !== sp.n) { sp = scope[0]; ctx.setPbSp(sp); }
  const recs = recsVan(ctx, sp); const kan = ctx.can('act');
  const X = dienstenVan(ctx, sp).map(e => standVan(ctx, e, recs[e.key] || null));
  const huidig = new Set(X.map(x => x.key));
  const weg = Object.entries(recs).filter(([k]) => !huidig.has(k));
  const n = k => X.filter(x => inFilter(x, k)).length + (k === 'gewijzigd' || k === 'alle' ? weg.length : 0);
  const concepten = X.filter(x => x.st === 'concept'); const gewijzigd = X.filter(x => x.diff.length && x.sim === 'komt');
  const nWijz = gewijzigd.length + weg.length; const nRit = X.reduce((a, x) => a + x.ritten.length, 0);
  const lijst = X.filter(x => inFilter(x, vg.f));
  const opties = [...new Set([sp, ...(scope.length ? scope : SP)])].sort((a, b) => a.n.localeCompare(b.n, 'nl'));
  const knoppen = `${X.some(x => x.rec) ? `<button class="btn" type="button" data-vg="export">${ic('download', 15)}Exporteer ritopdrachten</button>` : ''}${kan && nWijz ? `<button class="btn" type="button" data-vg="verschil">${ic('refresh', 15)}Wijzigingen vrijgeven (${nWijz})</button>` : ''}${kan && concepten.length ? `<button class="btn pri" type="button" data-vg="vrij">${ic('send', 15)}Planning vrijgeven (${concepten.length})</button>` : ''}`;
  const leeg = !X.length ? empty('Geen diensten op deze standplaats', 'Op deze dag rijdt hier niemand volgens de simulatie. Kies een andere standplaats.', '', 'cal')
    : !lijst.length && vg.f !== 'gewijzigd' ? empty('Niets in dit filter', 'Kies Alle om elke dienst te zien.', '<button class="btn sm" type="button" data-vgf="alle">Alle diensten</button>', 'filter') : '';
  const alleBegonnen = X.length && !X.some(x => x.sim === 'komt');
  const kopH = `<div class="card-h"><h2 id="vgTitel">Planning van ${esc(dagNaam(ctx))}</h2><span class="sub">${fmt(X.length)} diensten · ${fmt(nRit)} ritten · gesimuleerd</span>
      <div class="act"><label class="sr" for="vgSp">Standplaats</label><select class="fld sm" id="vgSp">${opties.map(s => `<option ${s === sp ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></div></div>
      <div class="card-b"><div class="vg-acties"><div class="chips" role="group" aria-label="Filter op status">${FILTERS.map(([k, l]) => `<button class="chip" type="button" data-vgf="${k}" aria-pressed="${vg.f === k}">${esc(l)} <span class="n">${fmt(n(k))}</span></button>`).join('')}</div><div class="vg-knop">${knoppen}</div></div>
      <p class="hint vg-uitleg">${kan ? '' : 'Alleen planners en regiomanagers geven vrij; je kijkt mee. '}Vrijgeven stuurt elke chauffeur zijn dienst (per app of per mail) en elke rit als OTM5-ritopdracht naar de boordcomputer. In de demo gaat er niets de deur uit: verzenden en bevestigen zijn gesimuleerd. De demo heeft een dag; je geeft vrij wat nog niet begonnen is. In het echt geef je de planning voor morgen de middag ervoor vrij.</p>
      ${alleBegonnen ? `<div class="note info">${ic('clock', 16)}<div><b>Alle diensten van vandaag zijn begonnen</b><div>Zet de klok op 01:00 om het vrijgeven van deze dag vanaf het begin te zien.</div><div class="chips" style="margin-top:8px"><button class="btn sm" type="button" data-vg="vroeg">${ic('clock', 14)}Klok naar 01:00</button></div></div></div>` : ''}</div>`;
  const lijstH = `${leeg}${lijst.map(x => rijHtml(ctx, x, vg.open.has(x.key))).join('')}${vg.f === 'alle' || vg.f === 'gewijzigd' ? weg.map(([k, rec]) => wegHtml(k, rec)).join('') : ''}${vg.f === 'gewijzigd' && !lijst.length && !weg.length ? empty('Geen wijzigingen na het vrijgeven', 'Wat je vrijgaf, staat nog zo in het plan.', '', 'okc') : ''}`;
  if (!el.querySelector('.vg-kop')) { el.innerHTML = '<div class="page vg"><div class="page-in"><section class="card vg-kop" aria-labelledby="vgTitel"></section><section class="card vg-lijst" aria-label="Diensten"><div class="card-b flush"></div></section></div></div>'; el.dataset.h = ''; }
  const kop = el.querySelector('.vg-kop'); if (zelf || !kop.contains(document.activeElement) || document.activeElement.id !== 'vgSp') swap(kop, kopH);
  swap(el.querySelector('.vg-lijst > .card-b'), lijstH);
  ui.vgData = { sp, X, weg, concepten, gewijzigd };
  if (el.dataset.vgBound) return; el.dataset.vgBound = '1';
  // open en dicht blijven over het opnieuw tekenen heen
  el.addEventListener('toggle', e => { const d = e.target; if (!(d instanceof Element) || !d.matches('details.vg-d')) return; const k = d.dataset.k; if (d.open === vg.open.has(k)) return; if (d.open) vg.open.add(k); else vg.open.delete(k); renderVrijgeven(ctx, el, true); }, true);
  on(el, 'click', '[data-vgf]', (e, b) => { vg.f = b.dataset.vgf; renderVrijgeven(ctx, el, true); });
  on(el, 'change', '#vgSp', (e, s) => { const x = SP.find(y => y.n === s.value); if (x) { ctx.setPbSp(x); ui.vgSpVast = x.n; vg.open.clear(); renderVrijgeven(ctx, el, true); ctx.syncHash(); ctx.refreshAll(false); } });
  on(el, 'click', '[data-vgro]', (e, b) => { const D = ui.vgData; const x = D.X.find(y => y.key === b.dataset.vgk); const r = x && x.ritten.find(y => y.id === b.dataset.vgro); if (x && r) toonRitopdracht(ctx, x, r); });
  on(el, 'click', '[data-vg]', (e, b) => {
    const D = ui.vgData; const k = b.dataset.vg;
    if (k === 'vroeg') { ctx.setTime(60); ctx.L.toast('Klok op 01:00: de diensten van vandaag zijn nog niet begonnen.', { icon: 'clock' }); return; }
    if (k === 'export') { exporteer(ctx, D.sp, D.X); return; }
    if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers geven de planning vrij.', { icon: 'lock' }); return; }
    if (k === 'vrij') {
      const L = D.concepten; if (!L.length) return; const app = L.filter(x => kanaalVan(x.key) === 'app').length; const nr = L.reduce((a, x) => a + x.ritten.length, 0);
      ctx.L.openDialog(`<div class="dlg-h"><h2>Planning van ${esc(D.sp.n)} vrijgeven</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div><div class="dlg-b"><p>${L.length} ${L.length === 1 ? 'chauffeur krijgt zijn dienst' : 'chauffeurs krijgen hun dienst'} van ${esc(dagNaam(ctx))}: ${app} per app, ${L.length - app} per mail. ${nr} ${nr === 1 ? 'rit gaat' : 'ritten gaan'} als ritopdracht naar de boordcomputer.</p><p class="hint">In de demo gaat er niets de deur uit: verzenden en bevestigen zijn gesimuleerd en komen in het logboek.</p></div><div class="dlg-f"><button class="btn" type="button" data-close>Annuleren</button><button class="btn pri" type="button" data-vgok autofocus>${ic('send', 15)}Vrijgeven</button></div>`, {
        label: 'Planning vrijgeven', onBind: d => d.querySelector('[data-vgok]').addEventListener('click', () => { ctx.L.closeDialog(); vrijgeven(ctx, D.sp, L); }),
      });
    } else if (k === 'verschil') {
      const L = D.gewijzigd; const W = D.weg; if (!L.length && !W.length) return;
      ctx.L.openDialog(`<div class="dlg-h"><h2>Wijzigingen vrijgeven</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div><div class="dlg-b"><p>Alleen het verschil gaat naar ${L.length + W.length} ${L.length + W.length === 1 ? 'chauffeur' : 'chauffeurs'} en de boordcomputer:</p><ul class="vg-wl">${L.map(x => `<li><b>${esc(x.naam)}</b> ${esc(x.diff.map(w => w.txt).join('; '))}</li>`).join('')}${W.map(([key, rec]) => `<li><b>${esc(rec.s.n || key)}</b> De dienst vervalt</li>`).join('')}</ul><p class="hint">Gesimuleerd; de chauffeurs bevestigen opnieuw.</p></div><div class="dlg-f"><button class="btn" type="button" data-close>Annuleren</button><button class="btn pri" type="button" data-vgok autofocus>${ic('send', 15)}Verschil vrijgeven</button></div>`, {
        label: 'Wijzigingen vrijgeven', onBind: d => d.querySelector('[data-vgok]').addEventListener('click', () => { ctx.L.closeDialog(); wijzigingenVrijgeven(ctx, D.sp, L, W); }),
      });
    }
  });
}
