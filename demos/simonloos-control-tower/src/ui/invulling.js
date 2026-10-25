// De vraagkant van de planning (Control Tower 4.0) op de data van src/fleet.js: open ritten met urgentie en prognose, de
// kandidaten in drie groepen (eigen chauffeurs, oproepkrachten en zzp'ers, charters), toewijzen, bevestigen en terugzetten,
// de flexibele schil, de voorkeuren en tevredenheid van chauffeurs en de historie van acht weken.
//
// Uit de data (src/fleet.js met src/inzet.js en src/voorkeuren.js): fleet.poolAt(T, zonder), fleet.urgentie(rit, T),
// fleet.prognose(rit, T) ({ kans, opTijd, tekst, advies, uitleg, meestal, basis }), fleet.kandidaten(rit, { T, people,
// toegewezen, max }), fleet.wijsToe(rit, kandidaat, { T, people, toegewezen }) (puur: { segment, log, bericht, kosten,
// waarschuwingen }), fleet.poolHistorie(sp), fleet.CHARTERS, fleet.OPROEP, fleet.WAARSCHUWINGEN, fleet.WAARSCHUWING_KORT,
// fleet.voorkeurenVan(id, seed, persoon), fleet.tevredenheid(id, seed, persoon) en fleet.past(voorkeuren, rit).
// De interface bewaart de toewijzingen zelf, als actie in sl-acties (de sleutel van vandaag; een nieuwe dag begint leeg),
// voert ze na herladen opnieuw uit en geeft ze terug aan de data: als toegewezen (kandidaten, wijsToe) en zonder (poolAt).
// Alles is gesimuleerd: namen, nummers (06 9…, 0229 0…), tarieven, kansen en de historie.
import { SP } from '../places.js';
import { DIENSTDELEN, DIENSTDEEL_NAAM, DIENSTDEEL_TIJD, WEEKDAGEN, WEEKDAG_NAAM, weekdagVan, dagVanIso } from '../voorkeuren.js';
import { fmt, hhmm } from './base.js';
import { vensterAbs, planPoolRit, haalPoolRitTerug, pool as poolAlles } from './planwijzig.js';
import { NORM, duur } from './toets.js';

export const euro = v => `€ ${fmt(Math.round((+v || 0) / 5) * 5)}`;
const Tn = ctx => ctx.state.simTime;
const pct = x => Math.round((+x || 0) * 100);
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = key => { let s = (hashStr(key) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

// ---------- dagdelen, soorten en dagen ----------
// De dienstdelen van de data, op de begintijd: vroeg 03:00 tot 08:00, dag 08:00 tot 13:00, avond 13:00 tot 22:00, nacht 22:00 tot 03:00.
export const DAGDELEN = DIENSTDELEN;
const KORT = { vroeg: 'Vroeg', dag: 'Dag', avond: 'Avond', nacht: 'Nacht' };
export const DAGDEEL = Object.fromEntries(DIENSTDELEN.map(k => [k, { n: KORT[k], naam: DIENSTDEEL_NAAM[k], tijd: DIENSTDEEL_TIJD[k], van: DIENSTDEEL_TIJD[k].slice(0, 5) }]));
export const SOORT_FLEX = { zzp: 'zzp\'er', weekend: 'weekendchauffeur', oproep: 'oproepkracht' };
export const wieSoort = k => (k.soort === 'charter' ? 'charter' : k.soort === 'eigen' ? 'eigen chauffeur' : SOORT_FLEX[k.sub] || 'oproepkracht');
export { WEEKDAGEN, WEEKDAG_NAAM };
// de dag van de simulatie (fleet.vandaag) en morgen, als datum en als weekdag ('ma' ... 'zo')
export const dagDatum = (ctx, dag) => { const d = ctx.fleet.vandaag || new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (dag === 'morgen' ? 1 : 0)); };
export const weekdag = (ctx, dag) => weekdagVan(dagDatum(ctx, dag));
export const dagenGeleden = (ctx, iso) => Math.max(1, Math.round((dagDatum(ctx, 'vandaag') - dagVanIso(iso)) / 864e5));
const dagVan = p => (p.dag === 'morgen' ? 'morgen' : 'vandaag');
// de kenmerken van een dienst of rit voor fleet.past: divisie, begintijd, weekdag en regio
export const ritVoor = (ctx, t, start) => ({ div: t.div, start, weekdag: weekdag(ctx, start >= 1440 ? 'morgen' : 'vandaag'), regio: t.base && t.base.regio ? [t.base.regio] : [] });

// ---------- urgentie: minuten tot het laadvenster (een rit van morgen ligt 1440 minuten verder) ----------
export const urgentie = (ctx, item) => Math.round(ctx.fleet.urgentie(item, Tn(ctx)));
export function urgentieTxt(min, item) {
  if (item && item.dag === 'morgen') return `morgen ${hhmm(item.venster ? item.venster[0] : 480)}`;
  if (min <= 0) return min > -60 ? 'venster loopt' : 'venster voorbij';
  if (min < 60) return `over ${min} min`;
  return `over ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} u`;
}
// rood binnen het uur, oranje binnen drie uur
export const urgentieKlas = (min, item) => (item && item.dag === 'morgen' ? 'u-later' : min < 60 ? 'u-nu' : min < 180 ? 'u-snel' : 'u-later');

// ---------- prognose: kans op invulling en kans op tijd, uit acht weken vergelijkbare ritten (fleet.prognose) ----------
// { kans, opTijd (in procenten), tekst, advies (de ene zin wat te doen), uitleg, meestal, basis }; per vijf minuten opnieuw
const pgCache = new Map(); let pgTik = null;
export function prognose(ctx, item) {
  const tik = Math.floor(Tn(ctx) / 5); if (tik !== pgTik) { pgCache.clear(); pgTik = tik; }
  let p = pgCache.get(item.id); if (p) return p;
  const x = ctx.fleet.prognose(item, Tn(ctx));
  p = { ...x, kans: pct(x.kans), opTijd: pct(x.opTijd) }; pgCache.set(item.id, p); return p;
}
// hoe dringend: rood als de rit waarschijnlijk open blijft, of het venster binnen het uur begint bij een twijfelachtige kans
export function advies(ctx, item, pg) {
  const u = item.dag === 'morgen' ? 9999 : urgentie(ctx, item);
  return { sev: pg.kans < 45 || (u < 60 && pg.kans < 70) ? 'bad' : pg.kans < 65 || pg.opTijd < 70 || u < 60 ? 'warn' : 'info', tekst: pg.advies };
}
// historie van de pool: { totaal, dagen, perWeek (8), perDagdeel, perWeekdag, perDivisie, perReden, ritten }
export const historie = (ctx, sp) => ctx.fleet.poolHistorie(sp);

// ---------- de flexibele schil: charters (fleet.CHARTERS) en oproepkrachten, zzp'ers en weekendchauffeurs (fleet.OPROEP) ----------
export const charters = ctx => ctx.fleet.CHARTERS || [];
export const oproepkrachten = ctx => ctx.fleet.OPROEP || [];
export const charterById = (ctx, id) => charters(ctx).find(c => c.id === id) || null;
export const oproepById = (ctx, id) => oproepkrachten(ctx).find(o => o.id === id) || null;
// trekkers die een charter vandaag of morgen nog voor ons heeft: zijn beschikbaarheid min wat wij al toewezen
export const charterVrij = (ctx, c, dag) => Math.max(0, (c.beschikbaar[dag] || 0) - toegewezen(ctx).filter(p => p.toegewezen.soort === 'charter' && p.toegewezen.id === c.id && dagVan(p) === dag).length);
// een oproepkracht op vandaag of morgen: de dagdelen van die weekdag, tenzij al ingezet
export function oproepOp(ctx, o, dag) {
  const al = !!o.bezet[dag] || toegewezen(ctx).some(p => p.toegewezen.id === o.id && dagVan(p) === dag);
  return { ingezet: al, dagdelen: al ? [] : o.beschikbaarheid[weekdag(ctx, dag)] || [] };
}
export const KOSTEN_UITLEG = 'Kosten zijn een schatting: voor eigen chauffeurs de loonkosten per uur (met een toeslag voor overuren, een extra dienst of het weekend) plus de kilometers, voor oproepkrachten en zzp\'ers hun uurtarief plus de kilometers, voor een charter het uurtarief plus een prijs per kilometer.';

// ---------- voorkeuren en tevredenheid van eigen chauffeurs (met de persoon uit people.js, zoals de data ze ook rekent) ----------
const vkCache = new Map(), tvCache = new Map();
export function voorkeurenVan(ctx, p) { if (!p) return null; let v = vkCache.get(p.id); if (!v) { v = ctx.fleet.voorkeurenVan(p.id, undefined, p); vkCache.set(p.id, v); } return v; }
export function tevredenheidVan(ctx, p) { if (!p) return null; let t = tvCache.get(p.id); if (!t) { t = ctx.fleet.tevredenheid(p.id, undefined, p); tvCache.set(p.id, t); } return t; }
// de voorkeuren als regels voor een pagina: [label, tekst]
const DIVN = { winkel: 'winkelritten', netwerk: 'netwerkritten', bulk: 'bulkritten', dranken: 'drankenritten', bezorg: 'bezorgrondes' };
export function voorkeurRegels(vk) {
  if (!vk) return [];
  return [['Diensten', vk.dagdelen.map((d, i) => `${DIENSTDEEL_NAAM[d]}${i ? ' (kan ook)' : ''}`).join(', ')], ['Weekend', vk.weekend ? 'werkt graag in het weekend' : 'liever vrij'],
    ['Ritten', vk.divisies.map(d => DIVN[d] || d).join(', dan ')], ['Regio', vk.regio.join(', ')], vk.klanten && vk.klanten.length ? ['Klanten', vk.klanten.join(', ')] : null,
    ['Uren', `hoogstens ${vk.maxUren} per week`], ['Extra diensten', { graag: 'graag', soms: 'soms', nee: 'liever niet' }[vk.extra] || vk.extra], vk.opmerking ? ['Zelf gezegd', `“${vk.opmerking}”`] : null].filter(Boolean);
}
// past een rit of dienst bij de voorkeuren: { score (0 tot 1), oordeel, redenen, voor, tegen }
export const pastVoorkeur = (ctx, vk, rit) => (vk ? ctx.fleet.past(vk, rit) : null);

// ---------- kandidaten voor een open rit (fleet.kandidaten, met people en wat al is toegewezen) ----------
// { eigen, oproep, charter (in de volgorde van de data), alle, best (de ene aanbevolen), samen (Vraag tegelijk uit) }
const kCache = new Map();
export function kandidatenVan(ctx, item) {
  const key = `${item.id}|${Math.floor(Tn(ctx) / 5)}|${ctx.R && ctx.R.ver ? ctx.R.ver() : 0}`;
  const c = kCache.get(key); if (c) return c;
  const L0 = (ctx.fleet.kandidaten(item, { T: Tn(ctx), people: ctx.people, toegewezen: toewijzingen(ctx), max: { eigen: 5, oproep: 4, charter: 4 } }) || []).map(k => caoRust(ctx, item, k));
  const groep = s => L0.filter(k => k.soort === s).sort((x, y) => y.beschikbaar - x.beschikbaar);
  const out = { eigen: groep('eigen'), oproep: groep('oproep'), charter: groep('charter') }; const L = [...out.eigen, ...out.oproep, ...out.charter];
  Object.assign(out, { alle: L, best: besteVan(L), samen: samenVragen(L) });
  if (kCache.size > 40) kCache.clear();
  kCache.set(key, out); return out;
}
// De rusttoets van de cao (toets.js: minstens 10 uur, verkort, tot de volgende dienst) is strenger dan EU 561, waarmee de
// data de kandidaten rekent (9 uur). Een eigen chauffeur die met deze rit minder dan 10 uur rust houdt, kan de rit niet:
// hij blijft in de lijst met de reden, maar niet beschikbaar.
export const RUST_CAO = 'Rust: minder dan 11 uur tot de volgende dienst; verkort tot minstens 10 uur mag hoogstens drie keer tussen twee weekrusten (cao beroepsgoederenvervoer, strenger dan EU 561)';
export const waarschuwing = (ctx, w) => (w === 'rust' ? RUST_CAO : (ctx.fleet.WAARSCHUWINGEN || {})[w] || w);
function caoRust(ctx, item, k) {
  if (k.soort !== 'eigen' || !(k.waarschuwingen || []).includes('rust')) return k;
  const p = ctx.people.byId.get(k.id); const d = p && p.dienst && p.dienst.d;
  if (!d || typeof d.start !== 'number' || typeof d.end !== 'number' || !item.venster) return k;
  const off = item.dag === 'morgen' ? 1440 : 0; const a = item.venster[0] + off, b = a + (item.duur || 0); const s0 = d.start + off, e0 = d.end + off;
  const rust = Math.round(a >= e0 ? s0 + 1440 - b : a - (e0 - 1440));
  if (rust >= NORM.rustVerkort) return k;
  return { ...k, beschikbaar: false, cao: rust, redenen: [`Houdt ${duur(rust)} rust tot de volgende dienst: minder dan 10 uur (cao beroepsgoederenvervoer, strenger dan EU 561)`, ...(k.redenen || [])] };
}
// de ene aanbevolen kandidaat: de eerste die beschikbaar is en waarschijnlijk ja zegt (eigen mensen eerst, zoals de data
// ze ordent); zegt niemand waarschijnlijk ja, dan wie de grootste kans heeft
function besteVan(L) { const kan = L.filter(k => k.beschikbaar); return kan.find(k => k.kans >= 0.5) || kan.slice().sort((a, b) => b.kans - a.kans)[0] || null; }
// Vraag tegelijk uit: de kleinste groep die samen minstens 90 procent kans op een ja geeft (de kansen als onafhankelijk
// gerekend, een schatting), hoogstens vier; alleen als de beste kandidaat alleen onder de 90 procent zit
export function samenVragen(L) {
  const kan = L.filter(k => k.beschikbaar && k.kans > 0.05).sort((a, b) => b.kans - a.kans || a.kosten.bedrag - b.kosten.bedrag);
  if (kan.length < 2 || kan[0].kans >= 0.9) return null;
  const wie = []; let geen = 1;
  for (const k of kan) { wie.push(k); geen *= 1 - k.kans; if (1 - geen >= 0.9 || wie.length >= 4) break; }
  return { wie, kans: Math.round((1 - geen) * 100), alleen: Math.round(kan[0].kans * 100) };
}

// ---------- toewijzen, bevestigen, terugzetten (via ctx.runAction: bewaard en na herladen opnieuw uitgevoerd) ----------
export const toegewezen = ctx => poolAlles(ctx).filter(p => p.gepland && p.toegewezen);
// voor de data: per toegewezen rit de uitkomst van wijsToe, of het blok van een rit die op het planbord op een voertuig ging
export const toewijzingen = ctx => toegewezen(ctx).map(p => p.toegewezen.uit).filter(Boolean);
// wat van een kandidaat in de actie gaat; telefoonnummers en e-mailadressen niet (die komen bij het uitvoeren uit de poule)
const kKort = k => ({ soort: k.soort, id: k.id, naam: k.naam, sub: k.sub || null, voertuig: k.voertuig || null, kans: k.kans, kosten: k.kosten, waarschuwingen: k.waarschuwingen || [] });
function verrijk(ctx, w) {
  const x = w.soort === 'charter' ? charterById(ctx, w.id) : w.soort === 'oproep' ? oproepById(ctx, w.id) : null;
  return { ...w, waarschuwingen: w.waarschuwingen || [], beschikbaar: true, tel: x ? x.tel : null, email: x && x.email ? x.email : null, contactpersoon: x && x.contactpersoon ? x.contactpersoon : null };
}
export function wijsToe(ctx, item, k) {
  if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers wijzen ritten toe.', { icon: 'lock' }); return { ok: false }; }
  const res = ctx.runAction({ k: 'toewijs', id: item.id, wie: kKort(k), T: Tn(ctx) }, true);
  if (!res || !res.ok) { ctx.L.toast(res && res.tekst ? res.tekst : 'Toewijzen lukte niet.', { icon: 'alert' }); return { ok: false }; }
  const it = poolAlles(ctx).find(p => p.id === item.id); const tw = it.toegewezen; const v = vensterAbs(it);
  const kort = ctx.fleet.WAARSCHUWING_KORT || {}; const lt = tw.waarschuwingen.map(w => kort[w] || w);
  ctx.A.log(`vroeg ${k.naam} (${wieSoort(k)}) voor open rit ${it.id} van ${it.klant || 'de klant'} (${it.sp}, laden ${it.dag === 'morgen' ? 'morgen ' : ''}${hhmm(v[0])}); kosten ongeveer ${euro(tw.kosten)} (schatting)${lt.length ? `; let op: ${lt.join(', ')}` : ''}`, { pool: it.id });
  // een eigen chauffeur die nu op dienst is, krijgt de vraag op de boordcomputer
  const p = k.soort === 'eigen' ? ctx.people.byId.get(k.id) : null;
  if (p && p.dienst && p.dienst.t && tw.bericht && ctx.sendMsg) ctx.sendMsg(p.dienst.t, tw.bericht.tekst, true, true);
  ctx.L.toast(`Gevraagd aan ${k.naam}. De rit staat gearceerd op het planbord tot je bevestigt.`, { icon: 'check', ms: 6000 });
  ctx.refreshAll(false); return { ok: true };
}
export function bevestig(ctx, item) {
  ctx.runAction({ k: 'bevestig', id: item.id, T: Tn(ctx) }, true);
  const it = poolAlles(ctx).find(p => p.id === item.id) || item; const tw = it.toegewezen;
  ctx.A.log(`noteerde dat ${tw ? tw.naam : 'de inhuur'} ja zei op open rit ${it.id} van ${it.klant || 'de klant'}`, { pool: it.id });
  ctx.L.toast(`Bevestigd: ${tw ? tw.naam : ''} rijdt de rit voor ${it.klant || 'de klant'}.`, { icon: 'check' }); ctx.refreshAll(false);
}
export function trekTerug(ctx, item) {
  const it0 = poolAlles(ctx).find(p => p.id === item.id) || item; const tw = it0.toegewezen;
  const res = ctx.runAction({ k: 'terug', id: item.id, T: Tn(ctx) }, true);
  if (!res || !res.ok) { ctx.L.toast(res && res.tekst ? res.tekst : 'Terugzetten lukte niet.', { icon: 'alert' }); return; }
  ctx.A.log(`zette open rit ${it0.id} van ${it0.klant || 'de klant'} terug bij de open ritten${tw ? ` (${tw.naam} kan niet)` : ''}`, { pool: it0.id });
  ctx.L.toast(`De rit voor ${it0.klant || 'de klant'} staat weer bij de open ritten.`, { icon: 'undo' }); ctx.refreshAll(false);
}
// wie de planner over een rit belde, mailde of tegelijk vroeg (bewaard, zodat een collega ziet wie al gevraagd is)
export function contact(ctx, item, wie, soort, tekst) {
  ctx.runAction({ k: 'contact', id: item.id, wie, soort, T: Tn(ctx) }, true);
  if (tekst) ctx.A.log(tekst, { pool: item.id });
}
// de acties zelf (ctx.runAction roept deze aan, ook na herladen): { ok, tekst }
export function voerActieUit(ctx, a) {
  const item = poolAlles(ctx).find(x => x.id === a.id); if (!item) return { ok: false, tekst: 'Deze rit bestaat niet meer.' };
  if (a.k === 'toewijs') {
    if (item.gepland) return { ok: false, tekst: 'Deze rit is al toegewezen.' };
    const k = verrijk(ctx, a.wie || {}); if (!k.id || !k.soort) return { ok: false, tekst: 'Onbekende kandidaat.' };
    const uit = ctx.fleet.wijsToe(item, k, { T: a.T, people: ctx.people, toegewezen: toewijzingen(ctx) });
    if (!uit || !uit.segment) return { ok: false, tekst: 'Toewijzen lukte niet.' };
    // het vertrek rekent de data per kandidaat (fleet.wijsToe: aanrijden van huis, na de eigen dienst, een charter vanaf zijn
    // plaats; loopt het venster al, dan zo snel als hij er kan zijn), nooit in het verleden; de bewaarde kopie van het blok
    // krijgt die tijden, zodat de data er de juiste overlap mee rekent
    const v0 = uit.segment.a; const nu = Math.ceil((a.T || 0) / 5) * 5; const a0 = item.dag === 'morgen' ? v0 : Math.max(v0, nu);
    uit.segment = { ...uit.segment, a: a0, b: a0 + (uit.segment.b - v0), t0: a0, t1: a0 + (uit.segment.b - v0) };
    const s = uit.segment; let t = null;
    // vandaag met een vrij voertuig: de rit op dat voertuig, in een eigen dienst van wie rijdt (gearceerd tot de bevestiging)
    if (item.dag !== 'morgen' && s.voertuig) {
      const B = ctx.fleet.byId.get(s.voertuig); const person = k.soort === 'eigen' ? ctx.people.byId.get(k.id) || null : null;
      const r = B ? planPoolRit(ctx, item, B, s.a, { chauffeur: { id: k.id, naam: k.naam, soort: k.soort === 'eigen' ? 'eigen' : k.sub || 'oproep' }, person }) : null;
      if (r && r.ok) t = B.id;
    }
    // een charter, een rit van morgen of geen vrij voertuig: een eigen rij op het planbord
    if (!t) item.gepland = { rij: true, start: s.a };
    item.toegewezen = { soort: k.soort, sub: k.sub || null, id: k.id, naam: k.naam, t, start: s.a, eind: s.b, kans: k.kans, kosten: uit.kosten ? uit.kosten.bedrag : null, kostenUitleg: uit.kosten ? uit.kosten.uitleg : '', waarschuwingen: uit.waarschuwingen || [], bericht: uit.bericht || null, T: a.T, status: 'aangevraagd', uit };
    return { ok: true, tekst: '', t };
  }
  if (a.k === 'bevestig') { if (item.toegewezen) { item.toegewezen.status = 'bevestigd'; item.toegewezen.Tb = a.T; } return { ok: true }; }
  if (a.k === 'terug') {
    if (!item.gepland) return { ok: false, tekst: 'Deze rit staat al bij de open ritten.' };
    if (!item.gepland.t) { item.gepland = null; item.toegewezen = null; return { ok: true, tekst: '' }; }
    const r = haalPoolRitTerug(ctx, item); if (r.ok) item.toegewezen = null; return r;
  }
  if (a.k === 'contact') { item.contact = [...(item.contact || []), ...(a.wie || []).map(w => ({ wie: w, soort: a.soort, T: a.T }))]; return { ok: true }; }
  return { ok: false, tekst: 'Onbekende actie.' };
}
// na een rit die op het planbord op een voertuig is gesleept (actie 'pool'): wie rijdt, en het blok voor de data
export function naInplannen(ctx, item, a, res) {
  if (!res || !res.ok) return;
  const sp = SP.find(s => s.n === item.sp); const p = res.chauffeur ? ctx.people.persons.find(x => x.name === res.chauffeur && x.base === sp) || null : null;
  const b = a.start + (item.duur || 300); const flex = a.chauffeur || null;
  const wie = flex ? { soort: 'oproep', id: flex.id, naam: flex.naam } : { soort: 'eigen', id: p ? p.id : null, naam: res.chauffeur || '' };
  item.toegewezen = { soort: wie.soort, sub: flex ? flex.soort : null, id: wie.id, naam: wie.naam, t: a.naar, start: a.start, eind: b, kosten: a.kosten || null, waarschuwingen: [], T: a.T, status: flex ? 'aangevraagd' : 'bevestigd',
    uit: { segment: { a: a.start, b, rit: item.id, voertuig: a.naar, dag: dagVan(item), wie } } };
}

// ---------- ritten die een charter of oproepkracht de laatste acht weken voor ons reed (gesimuleerd) ----------
// Zoveel als betrouwbaarheid.ritten zegt, met hetzelfde aandeel op tijd; datum, standplaats, klant en tijd volgen uit de id.
const KLANTEN = ['Albert Heijn', 'Jumbo', 'Plus', 'Lidl', 'Coop', 'Spar', 'FrieslandCampina', 'Heineken', 'Bavaria', 'Vomar'];
const REDENEN = ['ziek', 'uitval voertuig', 'extra rit klant', 'nieuw uit OTM5'];
const hrCache = new Map();
export function rittenVan(ctx, x) {
  if (hrCache.has(x.id)) return hrCache.get(x.id);
  const b = x.betrouwbaarheid || {}; const n = Math.max(0, Math.min(40, b.ritten || 0)); const laat = Math.round(n * (1 - (b.opTijd || 100) / 100));
  const R = rng(`ritten|${x.id}`); const out = [];
  const sps = x.standplaats ? [x.standplaats] : SP.filter(s => s.regio === x.regio).map(s => s.n);
  const eerste = x.laatsteInzet ? Math.min(55, dagenGeleden(ctx, x.laatsteInzet)) : 1 + Math.floor(R() * 4);
  const late = new Set(); for (let j = 0; j < laat; j++) late.add(Math.floor((j + 0.5) * n / laat));
  const d0 = dagDatum(ctx, 'vandaag');
  for (let i = 0; i < n; i++) {
    const dd = Math.min(56, Math.round(eerste + (56 - eerste) * i / Math.max(1, n))); const dt = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - dd);
    out.push({ datum: dt, dag: dt.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''), sp: sps[Math.floor(R() * sps.length)] || '', klant: KLANTEN[Math.floor(R() * KLANTEN.length)], start: 240 + Math.floor(R() * 61) * 15, uren: Math.round((4 + R() * 6) * 2) / 2, opTijd: !late.has(i), reden: REDENEN[Math.floor(R() * REDENEN.length)] });
  }
  hrCache.set(x.id, out); return out;
}
