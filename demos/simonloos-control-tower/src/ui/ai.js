// De Assistent met de Claude API, alleen als de pagina erom vraagt: data-ai="/api/assistent" op de app-root. De demosite
// zet dat attribuut; SafeTools en het artifact niet, en dan gaat er nooit een verzoek de deur uit (de Assistent werkt dan
// met zijn eigen regels, zie assistent.js). Drie ingangen: Ochtendbriefing, Overdracht schrijven en een vrije vraag.
//
// Het contract staat in netlify/functions/assistent.mts. Wat we sturen: POST met Content-Type: application/json en
// { soort, vraag?, dag }. dag is een compacte samenvatting van nu (hoogstens 40 KB): cijfers, de zwaarste zaken, de
// urgentste open ritten met prognose en kandidaten, wachttijd per plek, rijtijd, laden, de overdracht, recente
// gebeurtenissen en personen ({ nummer, naam }: de sleutel waarmee de functie namen door nummers vervangt voor er iets naar
// de API gaat). Wij vervangen namen in vrije tekst ook zelf al door het nummer; telefoonnummers en e-mailadressen gaan
// nooit mee. Het antwoord ({ ok, antwoord, acties, letOp }) wordt alleen getoond als het compleet en geldig is, en altijd
// met textContent, nooit als HTML; nummers in de tekst worden een verwijzing (T-1234 opent het voertuig). Bij een 404 of
// zonder data-ai: de vaste antwoorden van de Assistent zelf.
import { esc, ic, hhmm, on, zaakKey, fmt } from './base.js';
import { answer } from './assistent.js';
import { openIn, wagenTxt, duurVan } from './openritten.js';
import { prognose, urgentie, kandidatenVan } from './invulling.js';
import { poolInvoer, vensterAbs, pool as poolAlles } from './planwijzig.js';
import { charters, oproepkrachten } from './invulling.js';
import { SP } from '../places.js';

export const aiUrl = ctx => String((ctx.root && ctx.root.dataset && ctx.root.dataset.ai) || '').trim();
const MAX_VRAAG = 1000, MAX_DAG = 40000, WACHT_MS = 60000;
const staat = ctx => ctx.ui.ai || (ctx.ui.ai = { bezig: false, soort: null, vraag: '', concept: '', antwoord: null, fout: null, T: null, gelogd: new Set() });

// ---------- namen eruit: elke bekende persoonsnaam wordt zijn nummer; telefoonnummers en e-mailadressen gaan weg ----------
let naamRe = null, naamMap = null;
function namen(ctx) {
  if (naamRe) return;
  naamMap = new Map();
  for (const p of ctx.people.persons) naamMap.set(p.name, p.id);
  for (const p of ctx.people.planners || []) naamMap.set(p.n, p.id);
  for (const o of oproepkrachten(ctx)) naamMap.set(o.naam, o.id);
  for (const c of charters(ctx)) if (c.contactpersoon) naamMap.set(c.contactpersoon, 'contactpersoon');
  const L = [...naamMap.keys()].filter(n => n && n.length > 3).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  naamRe = L.length ? new RegExp(`\\b(${L.join('|')})\\b`, 'g') : null;
}
export function anoniem(ctx, s) {
  namen(ctx); let t = String(s || '');
  if (naamRe) t = t.replace(naamRe, m => naamMap.get(m) || 'iemand');
  return t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]').replace(/(\+31|0)[\s-]?6([\s-]?[\d•]){8}/g, '[telefoon]').replace(/\b0\d{1,3}(?:[\s-]?\d){6,8}\b/g, '[telefoon]');
}

// de sleutel voor de functie: elke persoon (chauffeur P-0001 tot P-2241, planner PL-, oproepkracht OP-) die in de dag of
// de vraag staat; een open rit (P-9001 en verder) heeft hetzelfde patroon en wordt op het object herkend, niet als persoon
export function personenIn(ctx, tekst) {
  const ids = [...new Set(String(tekst).match(/\b(?:PL-\d{3}|P-\d{4}|OP-\d{3})\b/g) || [])]; const out = []; const ritIds = new Set(poolAlles(ctx).map(p => p.id));
  for (const id of ids) {
    if (ritIds.has(id)) continue;
    const p = id.startsWith('PL-') ? (ctx.people.planners || []).find(x => x.id === id) : id.startsWith('P-') ? ctx.people.byId.get(id) : oproepkrachten(ctx).find(x => x.id === id);
    const naam = p ? p.name || p.n || p.naam : null; if (naam) out.push({ nummer: id, naam });
    if (out.length >= 200) break;
  }
  return out;
}
// ---------- de dag in een compacte vorm ----------
export function aiDag(ctx) {
  const T = ctx.state.simTime; const c = ctx.counts(); const k = ctx.kpi(); const me = ctx.A.settings.naam();
  const trucks = ctx.fleet.trucks.filter(t => ctx.inScope(t));
  let dock = 0; for (const t of trucks) { const s = ctx.S.get(t.id); if (s && s.seg && s.seg.wachtDock) dock++; }
  const zaken = ctx.Z.scoped().filter(z => z.open || z.status === 'wacht').sort((a, b) => b.urgency - a.urgency).slice(0, 30).map(z => ({
    id: z.id, soort: z.kind, ernst: z.sev === 'bad' ? 'hoog' : 'middel', object: z.obj, tekst: anoniem(ctx, z.text), sinds: hhmm(z.first !== undefined ? z.first : z.since || T),
    ...(z.who ? { eigenaar: z.who === me ? 'ik' : 'collega' } : {}), status: z.status,
  }));
  const open = openIn(ctx);
  const openRitten = open.slice(0, 30).map(p => {
    const sp = SP.find(s => s.n === p.sp); const inv = poolInvoer(p, sp); const v = vensterAbs(p) || [inv.t0, inv.t0 + 60]; const pg = prognose(ctx, p);
    return { id: p.id, klant: p.klant || '', standplaats: p.sp, venster: `${p.dag === 'morgen' ? 'morgen ' : ''}${hhmm(v[0])}-${hhmm(v[1])}`, duur: Math.round(duurVan(p, inv)), oplegger: wagenTxt(p), reden: p.reden || '', urgentie: urgentie(ctx, p), prognose: { kans: pg.kans, opTijd: pg.opTijd, advies: pg.advies } };
  });
  // kandidaten voor de vijf meest urgente ritten van vandaag (personen als nummer, charters met bedrijfsnaam)
  const kandidaten = {};
  for (const p of open.filter(x => x.dag !== 'morgen').slice(0, 5)) {
    try {
      const KD = kandidatenVan(ctx, p); const L = KD.alle.filter(x => x.beschikbaar).sort((a, b) => b.score - a.score).slice(0, 5);
      kandidaten[p.id] = L.map(x => ({ soort: x.soort === 'oproep' ? ({ zzp: 'zzp', weekend: 'oproep', oproep: 'oproepkracht' }[x.sub] || 'oproepkracht') : x.soort, id: x.id, naam: x.naam || '', score: Math.round((x.score || 0) * 100) / 100, kans: Math.round((x.kans || 0) * 100) / 100, redenen: (x.redenen || []).slice(0, 4).map(r => anoniem(ctx, r)), kosten: x.kosten ? x.kosten.bedrag : null, waarschuwingen: (x.waarschuwingen || []).map(w => (ctx.fleet.WAARSCHUWING_KORT || {})[w] || w) }));
    } catch { /* deze rit zonder kandidaten */ }
  }
  const wachttijd = (ctx.fleet.wachtPerPlek ? ctx.fleet.wachtPerPlek() : []).filter(w => w.n >= 3).sort((a, b) => b.gem - a.gem).slice(0, 10).map(w => ({ plek: w.naam, gem: Math.round(w.gem), p90: Math.round(w.p90) }));
  const rijtijd = []; for (const t of trucks) { const s = ctx.S.get(t.id); if (!s || !s.dienst || !(s.drive >= 200)) continue; const d = s.dienst; rijtijd.push({ chauffeur: d.person ? d.person.id : t.id, voertuig: t.id, over: Math.max(0, Math.round(270 - s.drive)) }); }
  rijtijd.sort((a, b) => a.over - b.over);
  const laden = trucks.filter(t => t.ev).map(t => [t, ctx.S.get(t.id)]).filter(([, s]) => s && (s.soc < 30 || (s.seg && s.seg.k === 'laden'))).sort((a, b) => a[1].soc - b[1].soc).slice(0, 10).map(([t, s]) => { const l = s.seg && s.seg.k === 'laden'; return { voertuig: t.id, plek: l ? (s.seg.route ? 'onderweg' : t.base.n) : 'rijdt', accu: Math.round(s.soc), klaar: l ? hhmm(t.dayStart + s.seg.t1) : '' }; });
  const over = (ctx.store.get('sl-overdracht') || '').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 20).map(x => anoniem(ctx, x).slice(0, 300));
  const gebeurtenissen = (ctx.feed || []).slice(0, 40).map(e => `${hhmm(e.T)} ${e.t ? `${e.t.id}: ` : ''}${anoniem(ctx, e.txt || '')}`);
  const dag = {
    tijd: hhmm(T), datum: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(), standplaats: ctx.F.sps.size === 1 ? [...ctx.F.sps][0] : 'alle', rol: ctx.role(),
    cijfers: { voertuigen: k.inScope || trucks.length, onderweg: c.onderweg, bijKlant: c.klant, vertraagd: c.vertraagd, opTerrein: c.terrein, opleggersLos: k.loose || 0, wachtendOpDock: dock },
    zaken, openRitten, kandidaten, wachttijd, rijtijd: rijtijd.slice(0, 10), laden,
    ...(over.length ? { overdracht: { van: 'deze dienst', naar: 'volgende dienst', notities: over } } : {}), gebeurtenissen,
  };
  dag.personen = personenIn(ctx, JSON.stringify(dag));
  // hoogstens 40 KB: eerst de gebeurtenissen inkorten, dan de kandidaten, dan de zaken en open ritten
  const maat = () => JSON.stringify(dag).length;
  if (maat() > MAX_DAG) dag.gebeurtenissen = dag.gebeurtenissen.slice(0, 15);
  if (maat() > MAX_DAG) delete dag.kandidaten;
  if (maat() > MAX_DAG) { dag.zaken = dag.zaken.slice(0, 15); dag.openRitten = dag.openRitten.slice(0, 15).map(r => ({ ...r, prognose: { kans: r.prognose.kans } })); }
  return dag;
}

// ---------- het verzoek ----------
const geldig = j => j && j.ok !== false && typeof j.antwoord === 'string' && j.antwoord.trim() && (j.acties === undefined || (Array.isArray(j.acties) && j.acties.every(a => a && typeof a.titel === 'string'))) && (j.letOp === undefined || (Array.isArray(j.letOp) && j.letOp.every(x => typeof x === 'string')));
// een fout in gewone woorden; bij 429 met de wachttijd uit Retry-After
function foutTekst(e, wacht) {
  if (e === 'tijd') return 'Dat duurde te lang. Probeer het opnieuw.';
  if (e === 'ongeldig') return 'Het antwoord was onvolledig en wordt niet getoond. Probeer het opnieuw.';
  if (e === 429) { const m = wacht > 0 ? Math.max(1, Math.ceil(wacht / 60)) : 0; return `Even wachten: dertig vragen per uur.${m ? ` Probeer het over ${m === 1 ? 'een minuut' : `${fmt(m)} minuten`} weer.` : ''}`; }
  if (e === 400 || e === 413) return 'De assistent kon deze vraag niet verwerken. Maak hem korter of stel hem anders.';
  if (e === 403) return 'De assistent werkt alleen vanaf de demosite zelf.';
  if (e === 500) return 'De assistent is op de server nog niet ingesteld. De voorstellen en meldingen werken gewoon door.';
  if (typeof e === 'number') return 'De AI-dienst is nu niet bereikbaar of te traag. Probeer het over een minuut opnieuw; voorstellen en meldingen werken gewoon door.';
  return 'Geen verbinding met de assistent. Controleer je internetverbinding.';
}
// de vaste antwoorden van de Assistent zelf (bij een 404: de functie staat niet op deze site)
function lokaal(ctx, soort, vraag) {
  if (soort === 'vraag') return { antwoord: answer(ctx, vraag), acties: [], letOp: [] };
  const c = ctx.counts(); const zs = ctx.Z.open().slice(0, 5); const open = openIn(ctx).filter(p => p.dag !== 'morgen');
  const regels = soort === 'briefing'
    ? [`Wat speelt: ${c.onderweg} voertuigen onderweg, ${c.vertraagd} vertraagd, ${c.klant} bij een klant.`, `Wat open staat: ${open.length ? `${open.length} open ${open.length === 1 ? 'rit' : 'ritten'}, de eerste laadt ${hhmm((vensterAbs(open[0]) || [0])[0])}.` : 'geen open ritten.'}`, `Waar het risico zit:\n${zs.length ? zs.map(z => `- ${z.kind} ${z.obj}: ${anoniem(ctx, z.text)}`).join('\n') : '- niets bijzonders'}`]
    : [`Wat loopt:\n${zs.length ? zs.map(z => `- ${z.kind} ${z.obj}: ${anoniem(ctx, z.text)}`).join('\n') : '- geen open meldingen'}`, `Wat moet: ${open.length ? open.slice(0, 3).map(p => `${p.id} (${p.klant || 'rit'}, laden ${hhmm((vensterAbs(p) || [0])[0])})`).join(', ') : 'geen open ritten'}.`];
  return { antwoord: regels.join('\n\n'), acties: [], letOp: [] };
}
export async function stuur(ctx, soort, vraag = '') {
  const url = aiUrl(ctx); const st = staat(ctx); if (!url || st.bezig) return;
  if (soort === 'vraag' && !vraag.trim()) return;
  st.bezig = true; st.fout = null; st.soort = soort; st.vraag = soort === 'vraag' ? vraag.trim().slice(0, MAX_VRAAG) : ''; ctx.renderPanel(true);
  const ac = typeof AbortController === 'function' ? new AbortController() : null; let verlopen = false;
  const to = setTimeout(() => { verlopen = true; if (ac) ac.abort(); }, WACHT_MS);
  try {
    const vraagSchoon = soort === 'vraag' ? anoniem(ctx, st.vraag) : '';
    const dag = aiDag(ctx); if (vraagSchoon) { const extra = personenIn(ctx, vraagSchoon).filter(p => !dag.personen.some(q => q.nummer === p.nummer)); dag.personen = [...dag.personen, ...extra].slice(0, 200); }
    const body = JSON.stringify({ soort, ...(soort === 'vraag' ? { vraag: vraagSchoon } : {}), dag });
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ac ? ac.signal : undefined });
    if (r.status === 404) { const l = lokaal(ctx, soort, st.vraag); st.antwoord = { ...l, soort, vraag: st.vraag, lokaal: true }; st.T = ctx.state.simTime; st.gelogd = new Set(); return; }
    if (!r.ok) { const e = new Error('status'); e.status = r.status; e.wacht = +(r.headers.get('Retry-After') || 0); throw e; }
    let j = null; try { j = await r.json(); } catch { throw 'ongeldig'; }
    if (!geldig(j)) throw 'ongeldig';
    st.antwoord = { antwoord: j.antwoord.trim(), acties: (j.acties || []).slice(0, 5).map(a => ({ titel: String(a.titel || ''), waarom: String(a.waarom || ''), effect: String(a.effect || '') })), letOp: (j.letOp || []).slice(0, 6).map(String), soort, vraag: st.vraag, model: j.model || '' };
    st.T = ctx.state.simTime; st.gelogd = new Set(); if (soort === 'vraag') st.concept = '';
    ctx.A.log(soort === 'briefing' ? 'vroeg de assistent om de ochtendbriefing' : soort === 'overdracht' ? 'liet de assistent de overdracht schrijven' : 'stelde de assistent een vraag');
  } catch (e) { st.fout = foutTekst(verlopen ? 'tijd' : e && e.status ? e.status : e, e && e.wacht); }
  finally { clearTimeout(to); st.bezig = false; ctx.renderPanel(true); const f = document.querySelector('#panel [data-ai-out]'); if (f) f.focus({ preventScroll: true }); }
}

// ---------- de weergave (de tab "Vraag" van de Assistent als data-ai er is) ----------
const VOORBEELD = ['Welke open ritten lopen het meeste risico, en wie bel ik eerst?', 'Waar zit vandaag de meeste wachttijd?', 'Wie zit bijna op zijn rijtijd?'];
export function aiHtml(ctx) {
  const st = staat(ctx); const n = st.concept.length;
  return `<div class="ai">
    <div class="ai-k" role="group" aria-label="Snel"><button class="btn sm" type="button" data-ai-soort="briefing" ${st.bezig ? 'disabled' : ''}>${ic('sun2', 15)}Ochtendbriefing</button><button class="btn sm" type="button" data-ai-soort="overdracht" ${st.bezig ? 'disabled' : ''}>${ic('note', 15)}Overdracht schrijven</button></div>
    <div class="ai-v"><label class="sr" for="aiIn">Vraag aan de assistent</label><textarea class="fld" id="aiIn" rows="3" maxlength="${MAX_VRAAG}" placeholder="Stel een vraag over vandaag. Enter stuurt, Shift Enter is een nieuwe regel." ${st.bezig ? 'disabled' : ''}>${esc(st.concept)}</textarea>
      <div class="ai-vr"><span class="hint" id="aiTel" aria-live="off">${n ? `${n} van 1.000 tekens` : ''}</span><button class="btn sm pri" type="button" id="aiGo" ${st.bezig ? 'disabled' : ''}>${ic('send', 14)}Vraag</button></div></div>
    ${!st.antwoord && !st.bezig && !st.fout ? `<div class="sugg">${VOORBEELD.map(q => `<button class="chip" type="button" data-ai-vb="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
    <div class="ai-out" data-ai-out tabindex="-1" aria-live="polite" ${st.bezig ? 'aria-busy="true"' : ''}></div>
    <p class="hint ai-priv">${ic('lock', 13)}<span>Gaat naar de Claude API via de demosite; nooit namen of nummers van personen.</span></p></div>`;
}
// het antwoord als DOM met textContent: alinea's, opsommingen ("- "), kaartjes voor de acties, stille regels bij letOp
function el(tag, cls, tekst) { const e = document.createElement(tag); if (cls) e.className = cls; if (tekst !== undefined) e.textContent = tekst; return e; }
// tekst met de nummers als verwijzing: T-1234 opent het voertuig, P-0412 de persoon, R-10213 de rit (alleen wat bestaat)
const ID_RE = /\b([A-Z]-[A-Z]-\d{3,5}(?:-R-\d{4,6})?|R-(?:P-)?\d{4,6}|PL-\d{3}|P-\d{4}|[TBV]-\d{3,4}|O-\d{4}|OP-\d{3}|CH-\d{2})\b/g;
function metVerwijzingen(ctx, ouder, tekst) {
  let i = 0;
  for (const m of tekst.matchAll(ID_RE)) {
    const d = doelVan(ctx, m[1]); if (!d) continue;
    if (m.index > i) ouder.appendChild(document.createTextNode(tekst.slice(i, m.index)));
    const b = el('button', 'lnk', m[1]); b.type = 'button'; b.dataset.open = d.open; b.title = d.label; ouder.appendChild(b); i = m.index + m[1].length;
  }
  if (i < tekst.length) ouder.appendChild(document.createTextNode(tekst.slice(i)));
  return ouder;
}
function blokken(ctx, tekst) {
  const out = document.createDocumentFragment();
  for (const blok of tekst.split(/\n\s*\n/)) {
    const regels = blok.split('\n').map(x => x.trimEnd()).filter(x => x.trim()); let ul = null;
    for (const r of regels) {
      const m = /^\s*[-•*]\s+(.*)$/.exec(r);
      if (m) { if (!ul) { ul = el('ul', 'ai-ul'); out.appendChild(ul); } ul.appendChild(metVerwijzingen(ctx, el('li'), m[1])); }
      else { ul = null; out.appendChild(metVerwijzingen(ctx, el('p'), r.trim())); }
    }
  }
  return out;
}
// een id in de tekst van een actie die we kennen: een rit, een open rit, een zaak, een voertuig of een persoon
function doelVan(ctx, tekst) {
  for (const m of String(tekst).matchAll(ID_RE)) {
    const id = m[1];
    if (/^OP-/.test(id)) { if (oproepkrachten(ctx).some(o => o.id === id)) return { open: `oproep/${id}`, label: `Open ${id}` }; continue; }
    if (/^CH-/.test(id)) { if (charters(ctx).some(c => c.id === id)) return { open: `charter/${id}`, label: `Open ${id}` }; continue; }
    if (/^PL-/.test(id)) continue;
    if (/^[A-Z]-[A-Z]-/.test(id)) { const key = zaakKey(id); if (key && ctx.Z.get(key)) return { open: `melding/${id}`, label: 'Open de melding' }; }
    else if (/^R-/.test(id)) { if (ctx.R.get(id)) return { open: `rit/${id}`, label: `Open rit ${id}` }; }
    else if (/^P-/.test(id)) { if (poolAlles(ctx).some(p => p.id === id)) return { open: `openritten/${id}`, label: 'Open de rit' }; if (ctx.people.byId.get(id)) return { open: `persoon/${id}/overzicht`, label: `Open ${id}` }; }
    else if (/^O-/.test(id)) { if (ctx.fleet.trailerById.get(id)) return { open: `oplegger/${id}/vandaag`, label: `Open ${id}` }; }
    else if (ctx.fleet.byId.get(id)) return { open: `voertuig/${id}/vandaag`, label: `Open ${id}` };
  }
  return null;
}
export function vulAi(ctx, p) {
  const st = staat(ctx); const box = p.querySelector('[data-ai-out]'); if (!box) return;
  box.textContent = '';
  if (st.bezig) { const b = el('p', 'ai-bezig'); b.appendChild(el('i', 'ai-dot')); b.appendChild(document.createTextNode(st.soort === 'briefing' ? 'De assistent leest de dag en schrijft de briefing.' : st.soort === 'overdracht' ? 'De assistent schrijft de overdracht.' : 'De assistent zoekt het uit.')); box.appendChild(b); return; }
  if (st.fout) { const f = el('div', 'note warn'); f.innerHTML = ic('alert', 15); f.appendChild(el('span', '', st.fout)); box.appendChild(f); return; }
  const a = st.antwoord; if (!a) return;
  const kop = el('div', 'ai-kop'); kop.appendChild(el('b', '', a.soort === 'briefing' ? 'Ochtendbriefing' : a.soort === 'overdracht' ? 'Overdracht' : 'Antwoord')); kop.appendChild(el('span', 'hint', `om ${hhmm(st.T || 0)}${a.vraag ? ` · ${a.vraag.length > 80 ? `${a.vraag.slice(0, 80)}…` : a.vraag}` : ''}`)); box.appendChild(kop);
  const tekst = el('div', 'ai-txt'); tekst.appendChild(blokken(ctx, a.antwoord)); box.appendChild(tekst);
  if (a.lokaal) box.appendChild(el('p', 'hint', 'De AI is op deze site niet beschikbaar; dit zijn de vaste antwoorden van de Assistent.'));
  if (a.soort === 'overdracht') { const b = el('button', 'btn sm', 'Neem over in de overdracht'); b.type = 'button'; b.dataset.aiOver = '1'; box.appendChild(b); }
  if (a.letOp.length) { const ul = el('ul', 'ai-let'); for (const x of a.letOp) { const li = el('li'); li.innerHTML = ic('alert', 13); li.appendChild(el('span', '', x)); ul.appendChild(li); } box.appendChild(ul); }
  if (a.acties.length) {
    box.appendChild(el('div', 'sec-t', 'Voorstellen'));
    a.acties.forEach((x, i) => {
      const k = el('section', 'prop ai-prop'); k.appendChild(metVerwijzingen(ctx, el('b'), x.titel)); if (x.waarom) k.appendChild(metVerwijzingen(ctx, el('p'), x.waarom)); if (x.effect) k.appendChild(metVerwijzingen(ctx, el('p', 'hint'), x.effect));
      const rij = el('div', 'prop-a'); const log = el('button', 'btn sm', st.gelogd.has(i) ? 'In het logboek' : 'Zet in logboek'); log.type = 'button'; log.dataset.aiLog = String(i); if (st.gelogd.has(i)) log.disabled = true; rij.appendChild(log);
      const d = doelVan(ctx, `${x.titel} ${x.waarom} ${x.effect}`); if (d) { const o = el('button', 'btn sm ghost', d.label); o.type = 'button'; o.dataset.open = d.open; rij.appendChild(o); }
      k.appendChild(rij); box.appendChild(k);
    });
  }
  box.appendChild(el('p', 'hint ai-voet', 'Gesimuleerde dagdata; de Assistent stelt voor, jij beslist.'));
}
export function bindAi(ctx, p) {
  const st = staat(ctx); vulAi(ctx, p);
  const inp = p.querySelector('#aiIn'); const tel = p.querySelector('#aiTel');
  if (inp) {
    inp.addEventListener('input', () => { st.concept = inp.value.slice(0, MAX_VRAAG); if (tel) tel.textContent = st.concept.length ? `${st.concept.length} van 1.000 tekens` : ''; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); stuur(ctx, 'vraag', inp.value); } });
  }
  const go = p.querySelector('#aiGo'); if (go) go.addEventListener('click', () => stuur(ctx, 'vraag', inp ? inp.value : ''));
  on(p, 'click', '[data-ai-soort]', (e, b) => stuur(ctx, b.dataset.aiSoort));
  on(p, 'click', '[data-ai-vb]', (e, b) => { st.concept = b.dataset.aiVb; stuur(ctx, 'vraag', st.concept); });
  on(p, 'click', '[data-ai-log]', (e, b) => { const i = +b.dataset.aiLog; const a = st.antwoord && st.antwoord.acties[i]; if (!a) return; st.gelogd.add(i); ctx.A.log(`zette een voorstel van de assistent in het logboek: ${a.titel}${a.effect ? ` (${a.effect})` : ''}`); ctx.L.toast('In het logboek gezet.', { icon: 'check' }); b.textContent = 'In het logboek'; b.disabled = true; });
  on(p, 'click', '[data-ai-over]', () => { const a = st.antwoord; if (!a) return; ctx.store.set('sl-overdracht', a.antwoord); ctx.A.log('nam de overdracht van de assistent over'); ctx.L.toast('Overgenomen in de overdracht. Pas hem aan waar nodig.', { icon: 'check', action: 'Bekijk', onAction: () => { ctx.ui.assistTab = 'overdracht'; ctx.renderPanel(true); } }); });
}
