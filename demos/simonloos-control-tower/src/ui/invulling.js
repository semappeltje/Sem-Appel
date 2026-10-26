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
import { DIENSTDELEN, DIENSTDEEL_NAAM, DIENSTDEEL_TIJD, WEEKDAGEN, WEEKDAG_NAAM, weekdagVan, dagVanIso, isoDag, dienstdeel } from '../voorkeuren.js';
import { fmt, hhmm } from './base.js';
import { vensterAbs, planPoolRit, haalPoolRitTerug, pool as poolAlles } from './planwijzig.js';
import { NORM, duur } from './toets.js';
import { thuisMin, AANRIJ_KOPPELEN } from '../inzet.js';
import { verdeel } from '../verdeel.js';

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
// { eigen, oproep, charter (in de volgorde van de data), alle, best (de ene aanbevolen: uit de toewijzing over alle open
// ritten, zie hieronder), samen (Vraag tegelijk uit) }. Staat de aanbevolen kandidaat niet in de eerste vijf (of vier) van
// zijn groep, dan komt hij er achteraan bij, zodat zijn knop er is.
const kCache = new Map();
const verVan = ctx => (ctx.R && ctx.R.ver ? ctx.R.ver() : 0);
// wie al gevraagd of gebeld is, telt mee in elke cache-sleutel: een vraag aan de een verschuift het advies voor de ander
const contactSig = ctx => { let n = 0; for (const p of poolAlles(ctx)) n += p.contact ? p.contact.length : 0; return n; };
const sleutel = (ctx, item) => `${item.id}|${Math.floor(Tn(ctx) / 5)}|${verVan(ctx)}|${contactSig(ctx)}`;
export function kandidatenVan(ctx, item) {
  const key = sleutel(ctx, item);
  const c = kCache.get(key); if (c) return c;
  const L0 = (ctx.fleet.kandidaten(item, { T: Tn(ctx), people: ctx.people, toegewezen: toewijzingen(ctx), max: { eigen: 5, oproep: 4, charter: 4 } }) || []).map(k => caoRust(ctx, item, k));
  const groep = s => L0.filter(k => k.soort === s).sort((x, y) => y.beschikbaar - x.beschikbaar);
  const out = { eigen: groep('eigen'), oproep: groep('oproep'), charter: groep('charter') };
  const b = besteVoor(ctx, item); let best = null;
  if (b) { best = out[b.soort].find(k => k.id === b.id) || null; if (!best) { out[b.soort].push(b); best = b; } }
  const L = [...out.eigen, ...out.oproep, ...out.charter];
  Object.assign(out, { alle: L, best, samen: samenVragen(ctx, item, best) });
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
// alle kandidaten van een rit (niet alleen de eerste vijf of vier per groep), met de cao-rust; per vijf minuten, planversie
// en wat al gevraagd is opnieuw
const aCache = new Map(); let aSig = '';
const ALLE = { eigen: 999, oproep: 999, charter: 999 };
export function alleKandidaten(ctx, p) {
  const sig = `${Math.floor(Tn(ctx) / 5)}|${verVan(ctx)}`; if (sig !== aSig) { aCache.clear(); aSig = sig; }
  let L = aCache.get(p.id); if (L) return L;
  L = (ctx.fleet.kandidaten(p, { T: Tn(ctx), people: ctx.people, toegewezen: toewijzingen(ctx), max: ALLE }) || []).map(k => caoRust(ctx, p, k));
  aCache.set(p.id, L); return L;
}

// ---------- één advies per open rit: de beste kandidaat, wie je tegelijk vraagt, de prioriteit ----------
// Het advies belooft nooit dezelfde persoon twee keer. Over alle open ritten van een dag (heel Nederland, zodat elke planner
// hetzelfde advies ziet) kiest één toewijzing (src/verdeel.js, Hongaars) voor elke rit zijn eigen beste kandidaat: niemand
// twee keer, een charter niet vaker dan hij trekkers vrij heeft, en wie al voor een andere rit tegelijk gevraagd is, blijft
// bij die rit. De waarde van een kandidaat voor een rit is zijn kans op een ja, met een kleine opslag voor eigen mensen
// (8 punten) en de flexibele schil (4 punten) boven een charter: bij een gelijke kans eerst eigen chauffeurs (goedkoper, de
// rit blijft in eigen hand), dan oproepkrachten, dan een charter. Een rit van vandaag krijgt alleen wie het venster haalt,
// zolang iemand dat haalt (haaltVenster); zo'n rit gaat voor een rit waarvoor niemand het venster meer haalt. Alles een
// schatting, zoals de kans zelf. Per vijf minuten, planversie en wat al gevraagd is opnieuw; het rekent in de browser (de
// toets eist onder 300 ms voor alle open ritten van Nederland).
export const OPSLAG = { eigen: 0.08, oproep: 0.04, charter: 0 };
export const waardeVan = k => (k.kans || 0) + (OPSLAG[k.soort] || 0);
export const dagVanRit = dagVan;
// de open ritten van een dag die nog iemand nodig hebben, zoals de planner ze nu ziet (ook een rit waarvan het venster al
// voorbij is: die kan nog laat gereden worden)
export function openVoor(ctx, dag) {
  const T = Tn(ctx);
  return poolAlles(ctx).filter(p => dagVan(p) === dag && !p.gepland && !p.morgenEerste && p.venster && p.bekend <= T && (dag === 'morgen' || !collegaOm(ctx, p, T)));
}
// de naam kort, voor een rij of kaart: voorletter en achternaam ("B. Ruiter"); een charter met zijn naam
export const korteNaam = k => (k.soort === 'charter' ? k.naam : String(k.naam || '').replace(/^(\S)\S*\s+/, '$1. '));
// ---------- na het venster: de fasen laat en gemist ----------
// Eén regel voor Open ritten (rij en detail) en de zaak: na het belmoment of het venster is de hoofdactie de beste kandidaat
// die binnen 120 minuten na het einde van het venster kan vertrekken; is die er niet, dan morgen als eerste, en wie later
// kan (vaak een charter die nog moet aanrijden) staat als gewone keuze.
export const NA_VENSTER_MAX = 120;
// "45 min na het venster", boven 90 minuten in uren met één decimaal ("7,4 uur na het venster")
export const naVensterTxt = min => { min = Math.max(0, Math.round(min)); return min > 90 ? `${(Math.round(min / 6) / 10).toFixed(1).replace('.', ',')} uur na het venster` : `${min} min na het venster`; };
// de kandidaten van een rit van vandaag na het venster: binnen (vertrek hoogstens 120 minuten na het einde van het
// venster) en later, elk op waarde
export function naVenster(ctx, p) {
  const v1 = p.venster[1]; const L = alleKandidaten(ctx, p).filter(k => k.beschikbaar && typeof k.vertrek === 'number').sort((a, b) => waardeVan(b) - waardeVan(a) || (a.id < b.id ? -1 : 1));
  return { binnen: L.filter(k => k.vertrek - v1 <= NA_VENSTER_MAX), later: L.filter(k => k.vertrek - v1 > NA_VENSTER_MAX) };
}
// wie het venster van rit p haalt als je nu vraagt (vandaag); na het belmoment of het venster alleen wie binnen 120 minuten
// na het einde van het venster kan vertrekken (kan niemand dat, dan krijgt de rit hier geen kandidaat: morgen als eerste);
// morgen iedereen die beschikbaar is
function kanVoor(ctx, p) {
  if (p.dag !== 'morgen') {
    if (Tn(ctx) < p.venster[1]) { const H = haaltVenster(ctx, p); if (H.length) return { L: H, haalt: true }; }
    return { L: naVenster(ctx, p).binnen, haalt: false };
  }
  return { L: alleKandidaten(ctx, p).filter(k => k.beschikbaar), haalt: false };
}
// de hoofdactie na het venster: { soort: 'kandidaat', k, na: "45 min na het venster", later, label: "vraag B. Ruiter" } of
// { soort: 'morgen', k: null, later, label: 'morgen als eerste' }; later: de beste die later kan (gewone keuze), of null
export function hoofdLaat(ctx, p) {
  const nv = naVenster(ctx, p); const k = besteVoor(ctx, p); const v1 = p.venster[1];
  if (k && typeof k.vertrek === 'number' && k.vertrek - v1 <= NA_VENSTER_MAX) return { soort: 'kandidaat', k, na: naVensterTxt(k.vertrek - v1), later: nv.later[0] || null, label: `vraag ${korteNaam(k)}` };
  return { soort: 'morgen', k: null, later: nv.later[0] || nv.binnen[0] || null, label: 'morgen als eerste' };
}
// per naam de rit waarvoor iemand al tegelijk gevraagd is (contact 'samen'), onder de open ritten van die dag
function tegelijkGevraagd(ctx, dag) {
  const m = new Map();
  for (const p of poolAlles(ctx)) { if (p.gepland || dagVan(p) !== dag) continue; for (const c of p.contact || []) if (c.soort === 'samen' && !m.has(c.wie)) m.set(c.wie, p.id); }
  return m;
}
const vdCache = new Map();
const nu = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
// de rijen voor verdeel.js: per open rit van de dag zijn kandidaten met waarde en capaciteit (en de kandidaten zelf op id)
function rijenVoor(ctx, dag) {
  const open = openVoor(ctx, dag); const gevraagd = tegelijkGevraagd(ctx, dag);
  // wie vandaag al een rit heeft (toegewezen, ook als hij nog op een ja wacht), is geen eerste keus voor een tweede
  const bezet = new Set(toegewezen(ctx).filter(p => dagVan(p) === dag && p.toegewezen.soort !== 'charter').map(p => p.toegewezen.id));
  const perRit = new Map(); const rijen = [];
  for (const p of open) {
    const { L, haalt } = kanVoor(ctx, p); const b = belmoment(ctx, p);
    const K = L.filter(k => !bezet.has(k.id) && (!gevraagd.has(k.naam) || gevraagd.get(k.naam) === p.id));
    perRit.set(p.id, new Map(K.map(k => [k.id, k])));
    rijen.push({ id: p.id, volgorde: b && b.T !== null ? b.T : p.venster[0], kandidaten: K.map(k => ({ id: k.id, waarde: waardeVan(k) + (haalt ? 0.5 : 0), cap: k.soort === 'charter' ? charterVrij(ctx, charterById(ctx, k.id) || { beschikbaar: {} }, dag) : 1 })) });
  }
  return { open, rijen, perRit };
}
// { uit: Map rit-id -> kandidaat (het object uit de lijst van die rit) of null, ritten, ms, sig }
export function verdeling(ctx, dag) {
  const sig = `${Math.floor(Tn(ctx) / 5)}|${verVan(ctx)}|${contactSig(ctx)}`;
  const c = vdCache.get(dag); if (c && c.sig === sig) return c;
  const t0 = nu();
  const { open, rijen, perRit } = rijenVoor(ctx, dag);
  const toe = verdeel(rijen, 'hongaars'); const uit = new Map();
  for (const p of open) { const id = toe.get(p.id); uit.set(p.id, id ? perRit.get(p.id).get(id) || null : null); }
  const out = { sig, uit, ritten: open.length, ms: Math.round((nu() - t0) * 10) / 10 };
  vdCache.set(dag, out);
  // voor de toetsen en metingen: dezelfde functies, bereikbaar via window.SLCT.ui.ctx.ui.advies
  if (ctx.ui && !ctx.ui.advies) ctx.ui.advies = { verdeling: d => verdeling(ctx, d), besteVoor: p => besteVoor(ctx, p), handelMoment: p => handelMoment(ctx, p), ritPrio: (p, T) => ritPrio(ctx, p, T), samen: p => kandidatenVan(ctx, p).samen, fase: p => ritFase(ctx, p, Tn(ctx)), hoofdLaat: p => hoofdLaat(ctx, p), vergelijk: d => vergelijkMethoden(ctx, d), meet: d => { vdCache.delete(d); aCache.clear(); hvCache.clear(); return verdeling(ctx, d).ms; } };
  return out;
}
// Hongaars tegen gretig op belmoment, op dezelfde rijen (voor de meting): per methode de ritten met een kandidaat, de som
// van hun kansen op een ja (het verwachte aantal ja's) en de rekentijd, zonder cache
export function vergelijkMethoden(ctx, dag) {
  const { open, rijen, perRit } = rijenVoor(ctx, dag); const uit = {};
  for (const m of ['hongaars', 'gretig']) {
    const t0 = nu(); const toe = verdeel(rijen, m); const ms = nu() - t0; let n = 0, kans = 0;
    for (const p of open) { const id = toe.get(p.id); const k = id ? perRit.get(p.id).get(id) : null; if (k) { n++; kans += k.kans || 0; } }
    uit[m] = { ritten: open.length, metKandidaat: n, verwachtJa: Math.round(kans * 10) / 10, ms: Math.round(ms * 100) / 100 };
  }
  return uit;
}
// de aanbevolen kandidaat voor een rit: uit de toewijzing; blijft er voor deze rit niemand over, dan toch de beste van zijn
// eigen lijst, gemarkeerd als gedeeld (de planner ziet dat hij ook de eerste keus van een andere rit is)
export function besteVoor(ctx, p) {
  if (!p || p.gepland || !p.venster) return null;
  const v = verdeling(ctx, dagVan(p)); if (v.uit.has(p.id)) { const k = v.uit.get(p.id); if (k) return k; }
  const { L } = kanVoor(ctx, p); const b = L.slice().sort((x, y) => waardeVan(y) - waardeVan(x))[0] || null;
  return b ? { ...b, gedeeld: true } : null;
}
// wie van de open ritten van dezelfde dag al de eerste keus van een andere rit is (personen; een charter telt pas als zijn
// vrije trekkers op zijn)
function eersteKeusElders(ctx, item) {
  const v = verdeling(ctx, dagVan(item)); const S = new Set(); const ch = new Map();
  for (const [id, k] of v.uit) { if (!k || id === item.id) continue; if (k.soort === 'charter') ch.set(k.id, (ch.get(k.id) || 0) + 1); else S.add(k.id); }
  for (const [id, n] of ch) { const c = charterById(ctx, id); if (!c || n >= charterVrij(ctx, c, dagVan(item))) S.add(id); }
  return S;
}
// Vraag tegelijk uit: de kleinste groep die samen minstens 90 procent kans op een ja geeft (de kansen als onafhankelijk
// gerekend, een schatting), hoogstens vier: de aanbevolen kandidaat eerst, dan wie de grootste kans heeft; vandaag alleen
// wie het venster haalt, en niemand die al de eerste keus van een andere rit is. Geen groep als de beste alleen al 90
// procent heeft, of als er niemand bij kan.
export function samenVragen(ctx, item, best) {
  if (!best || !best.beschikbaar) return null;
  const { L, haalt } = kanVoor(ctx, item);
  if (item.dag !== 'morgen' && Tn(ctx) < item.venster[1] && !haalt) return null;
  const elders = eersteKeusElders(ctx, item);
  const rest = L.filter(k => k.kans > 0.05 && k.beschikbaar && !(k.id === best.id && k.soort === best.soort) && !elders.has(k.id)).sort((a, b) => b.kans - a.kans || a.kosten.bedrag - b.kosten.bedrag);
  const kan = [best, ...rest];
  if (kan.length < 2 || best.kans >= 0.9) return null;
  const wie = []; let geen = 1;
  for (const k of kan) { wie.push(k); geen *= 1 - k.kans; if (1 - geen >= 0.9 || wie.length >= 4) break; }
  if (wie.length < 2) return null;
  return { wie, kans: Math.round((1 - geen) * 100), alleen: Math.round(best.kans * 100) };
}
// Het eerste moment waarop de planner iets moet doen: het laatste belmoment of het begin van het venster, wat eerder komt
// (een rit van morgen ligt 1440 minuten verder). Open ritten en de bak op het planbord staan op dit moment gesorteerd.
export function handelMoment(ctx, p) {
  if (!p.venster) return 9999 + 1440;
  if (p.dag === 'morgen') return p.venster[0] + 1440;
  const b = belmoment(ctx, p); const B = b && b.T !== null && b.T >= Math.max(0, p.bekend) ? b.T : null;
  return B === null ? p.venster[0] : Math.min(B, p.venster[0]);
}
// De prioriteit van de zaak "Rit niet ingevuld" in de fase bel: hoog als het belmoment binnen 30 minuten valt of de beste
// kandidaat onder 60 procent kans op een ja heeft; laag alleen met ruim tijd (meer dan een uur) en een kandidaat met een
// hoge kans (80 procent); anders middel. De zaak komt een half uur voor het belmoment, dus in de praktijk staat hij meteen
// op hoog: zolang je nog iemand kunt vragen, moet je opletten. In de fasen laat en gemist is hij altijd hoog.
export function ritPrio(ctx, p, T) {
  const b = belmoment(ctx, p); const B = b && b.T !== null ? b.T : null; const tot = B === null ? -Infinity : B - T;
  const best = besteVoor(ctx, p); const kans = best ? best.kans || 0 : 0;
  if (tot <= 30 || kans < 0.6) return 'hoog';
  if (tot > 60 && kans >= 0.8) return 'laag';
  return 'middel';
}

// ---------- het laatste belmoment en de zaak "Rit niet ingevuld" ----------
// Een open rit van vandaag heeft een laatste belmoment: tot wanneer haalt nog iemand het venster als je hem dan vraagt? Per
// kandidaat (fleet.kandidaten: eigen chauffeurs, oproepkrachten en zzp'ers, charters; allemaal, niet alleen de beste vier)
// vertrekt de rit op het moment van de vraag plus zijn aanrijtijd (van huis: de vraag, reizen en inklokken; een charter vanaf
// zijn eigen plaats), en hij moet binnen het venster weg. Zijn laatste moment is dus het eind van het venster min die
// aanrijtijd. Wie op dienst is en de rit na zijn dienst kan rijden, vraag je tot het eind van die dienst (dan koppelt hij
// meteen), daarna is hij thuis. Het belmoment van de rit is het laatste van die momenten, op vijf minuten naar beneden, met
// de kandidaat erbij. Gerekend vanaf het moment dat de rit bekend werd en met wat al is toegewezen: het hangt niet af van de
// klok en verandert alleen met het plan (R.ver). Gesimuleerd, zoals de kandidaten.
// De zaak "Rit niet ingevuld" (zaken.js, sleutel N:<id>) is één zaak in drie fasen (ritFase):
//   'bel'    vanaf een half uur voor het belmoment: uiterlijk dan iemand vragen (het belmoment is de deadline)
//   'laat'   het belmoment is voorbij, of er was er geen toen de rit bekend werd: niemand haalt het venster meer
//   'gemist' het venster is voorbij en niemand rijdt hem: hij staat in Open ritten als gemist en telt naast Op tijd
// Keuzes: wie het venster haalt (zolang dat kan), alsnog een charter (die vertrekt dan later), morgen als eerste (laden vroeg
// in de ochtend) of de klant bellen of een bericht sturen. Een rit die alsnog is toegewezen, telt niet als gemist (hij is
// laat gereden); een rit die naar morgen ging, wel. Alles gesimuleerd.
export const MORGEN_EERSTE = [240, 300];
export const BEL_VOORAF = 30;
// het laatste moment waarop kandidaat k het venster nog haalt (minuten van vandaag; -Infinity als nooit)
function laatsteVraag(k, v1) {
  if (k.soort === 'eigen' && k.aanrij === AANRIJ_KOPPELEN) return Math.max(v1 - thuisMin(k.id), k.vertrek <= v1 ? k.vertrek - AANRIJ_KOPPELEN : -Infinity);
  return typeof k.aanrij === 'number' ? v1 - k.aanrij : -Infinity;
}
// { T: het belmoment (minuten van vandaag) of null als geen kandidaat het venster haalt, k: die kandidaat, n: hoeveel
// kandidaten het venster halen als je ze vraagt zodra de rit bekend is }
const bmCache = new Map(); let bmVer = null;
export function belmoment(ctx, p) {
  if (!p || p.dag === 'morgen' || !p.venster) return null;
  const ver = ctx.R && ctx.R.ver ? ctx.R.ver() : 0; if (ver !== bmVer) { bmCache.clear(); bmVer = ver; }
  if (bmCache.has(p.id)) return bmCache.get(p.id);
  const v1 = p.venster[1]; const T0 = Math.max(0, p.bekend);
  const L = (ctx.fleet.kandidaten(p, { T: T0, people: ctx.people, toegewezen: toewijzingen(ctx), max: ALLE }) || []).map(k => caoRust(ctx, p, k)).filter(k => k.beschikbaar);
  let best = null, n = 0;
  for (const k of L) { const t = laatsteVraag(k, v1); if (!(t > -Infinity)) continue; if (t >= T0) n++; if (!best || t > best.t || (t === best.t && k.kans > best.k.kans)) best = { t, k }; }
  const out = best ? { T: Math.floor(best.t / 5) * 5, k: best.k, n } : { T: null, k: null, n: 0 };
  bmCache.set(p.id, out); return out;
}
// wie je nu vraagt en het venster haalt (beschikbaar, vertrek binnen het venster als je nu vraagt): de grootste kans op een
// ja eerst, dan de laagste kosten; per vijf minuten en planversie opnieuw
const hvCache = new Map(); let hvSig = '';
export function haaltVenster(ctx, p) {
  if (!p || p.dag === 'morgen' || !p.venster || Tn(ctx) >= p.venster[1]) return [];
  const sig = `${Math.floor(Tn(ctx) / 5)}|${ctx.R && ctx.R.ver ? ctx.R.ver() : 0}`; if (sig !== hvSig) { hvCache.clear(); hvSig = sig; }
  if (hvCache.has(p.id)) return hvCache.get(p.id);
  const v1 = p.venster[1];
  const L = alleKandidaten(ctx, p).filter(k => k.beschikbaar && typeof k.vertrek === 'number' && k.vertrek <= v1).sort((a, b) => b.kans - a.kans || a.kosten.bedrag - b.kosten.bedrag);
  hvCache.set(p.id, L); return L;
}
// De collega's (fleet: p.collega, gesimuleerd, zo vaak als de prognose zegt) vullen een rit op het laatst in, maar voordat
// hij een zaak wordt: in het kwartier voor de zaak zou ontstaan (een half uur voor het belmoment; vast per rit), of meteen
// als de rit pas laat bekend werd. Zo staat een rit in Open ritten tot kort voor hij dringend wordt. Haalt niemand het venster
// als de rit bekend wordt, dan kan ook een collega hem niet op tijd invullen: dan blijft hij open. Het moment (minuten van
// vandaag) of null.
export function collegaMoment(ctx, p) {
  if (!p || !p.collega || p.dag === 'morgen' || !p.venster) return null;
  const b = belmoment(ctx, p); const T0 = Math.max(0, p.bekend);
  if (!b || b.T === null || b.T < T0) return null;
  return Math.max(T0, b.T - BEL_VOORAF - 1 - Math.round(15 * hashStr(`collega-om|${p.id}`) / 4294967296));
}
// door een collega ingevuld op T (gesimuleerd)
export function collegaOm(ctx, p, T) {
  if (!p || !p.collega || p.gepland || p.morgenEerste || p.dag === 'morgen' || !(T >= 0 && T < 1440) || p.bekend > T) return false;
  const m = collegaMoment(ctx, p); return m !== null && T >= m;
}
// het laadvenster van vandaag (een rit die naar morgen ging, houdt het oude in morgenEerste.van)
export const vensterVandaag = p => (p.morgenEerste ? p.morgenEerste.van : p.venster);
// gemist om T (minuten van vandaag): een rit van vandaag, toen al bekend, het venster voorbij, en vandaag rijdt niemand hem
export function gemistOm(ctx, p, T) {
  if (!p || (p.dag === 'morgen' && !p.morgenEerste) || !(T >= 0 && T < 1440)) return false;
  const v = vensterVandaag(p); if (!v || p.bekend > T || T < v[1]) return false;
  return !!p.morgenEerste || (!p.gepland && !collegaOm(ctx, p, T));
}
// nog open: gemist en de planner koos nog niets (geen toewijzing, niet naar morgen)
export const gemistOpen = (ctx, p, T) => gemistOm(ctx, p, T) && !p.morgenEerste && !p.gepland;
// de fase van de zaak "Rit niet ingevuld" op T: 'bel', 'laat', 'gemist', of null (geen zaak: nog niet bekend of nog niet
// dringend, toegewezen, door een collega ingevuld, morgen als eerste, of een rit van morgen)
export function ritFase(ctx, p, T) {
  if (!p || p.dag === 'morgen' || p.gepland || p.morgenEerste || !p.venster || !(T >= 0 && T < 1440) || p.bekend > T) return null;
  if (collegaOm(ctx, p, T)) return null;
  if (T >= p.venster[1]) return 'gemist';
  const b = belmoment(ctx, p); const B = b ? b.T : null;
  if (B === null || B < Math.max(0, p.bekend) || T > B) return 'laat';
  return T >= B - BEL_VOORAF ? 'bel' : null;
}
// voor de kaart van een open rit van vandaag: { tekst, rood, B }; rood vanaf een half uur voor het belmoment
export function belLabel(ctx, p) {
  if (!p || p.dag === 'morgen' || p.gepland || !p.venster) return null;
  const T = Tn(ctx); if (T >= p.venster[1]) return null;
  const b = belmoment(ctx, p); const B = b ? b.T : null;
  if (B === null || B < Math.max(0, p.bekend)) return { tekst: 'niemand haalt het venster', rood: true, B };
  if (T > B) return { tekst: 'niemand haalt het venster meer', rood: true, B };
  return { tekst: `uiterlijk vragen ${hhmm(B)}`, rood: B - T <= BEL_VOORAF, B };
}
export const collegaIn = ctx => poolAlles(ctx).filter(p => collegaOm(ctx, p, Tn(ctx))).filter(p => { const sp = SP.find(s => s.n === p.sp); return sp && ctx.inScopeBase(sp, p.div); }).sort((a, b) => b.venster[1] - a.venster[1] || (a.id < b.id ? -1 : 1));
// de gemiste ritten van vandaag in het werkgebied, de nieuwste eerst
export const gemistIn = ctx => poolAlles(ctx).filter(p => gemistOm(ctx, p, Tn(ctx))).filter(p => { const sp = SP.find(s => s.n === p.sp); return sp && ctx.inScopeBase(sp, p.div); }).sort((a, b) => vensterVandaag(b)[1] - vensterVandaag(a)[1] || (a.id < b.id ? -1 : 1));
// de planning van de klant om te bellen (gesimuleerd: een vast nummer 0229 0…, een reeks die het nummerplan niet uitgeeft)
export function klantPlanning(p) {
  const k = p.klant || 'de klant'; const n = String(hashStr(`klant|${k}|${p.sp}`) % 1000000).padStart(6, '0');
  return { naam: `Planning ${k}`, tel: `0229 0${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)}` };
}
// het bericht aan de klant over een rit die niemand rijdt (de planner kopieert het of leest het voor; er gaat niets de deur
// uit), per fase van de zaak: 'bel' (nog geen chauffeur, we zoeken er een), 'laat' (gaat niet op tijd weg), 'gemist' (is niet
// op tijd vertrokken). nogIemand: true of onbekend (undefined) zegt dat we nog een wagen zoeken; false (geen charter, eigen
// chauffeur of oproepkracht meer vrij) stelt meteen morgen als eerste voor, zodat het bericht niet belooft wat de keuzes al
// uitsluiten
export function klantBerichtGemist(p, nogIemand, fase = 'gemist') {
  const v = vensterVandaag(p); const n = (p.stops || []).length; const naar = (p.stops || []).slice(0, 2).map(s => s.name).join(' en ');
  const rit = `Je rit van vandaag uit ${p.sp} (laden ${hhmm(v[0])} tot ${hhmm(v[1])}${n ? `, ${n} ${n === 1 ? 'stop' : 'stops'}${naar ? `: ${naar}` : ''}` : ''})`;
  if (fase === 'bel') return `${rit} heeft nog geen chauffeur. We zoeken er een die op tijd weg kan; lukt dat niet, dan bellen we je meteen.`;
  return `${rit} ${fase === 'laat' ? 'gaat niet op tijd weg' : 'is niet op tijd vertrokken'}. ${nogIemand === false ? `Er is vandaag geen wagen meer vrij. Ons voorstel: morgen als eerste, laden vanaf ${hhmm(morgenVenster(p)[0])}. Past dat? Dan zetten we hem zo vast.` : 'We zoeken nog een andere wagen; lukt dat niet, dan leveren we morgen als eerste. Je hoort binnen een uur van ons.'}`;
}
// morgen als eerste (met de klant afgesproken): laden morgen vanaf 04:00, of eerder als het venster van vandaag eerder lag
export const morgenVenster = p => { const v0 = Math.min(vensterVandaag(p)[0], MORGEN_EERSTE[0]); return [v0, v0 + 60]; };

// ---------- toewijzen, bevestigen, terugzetten (via ctx.runAction: bewaard en na herladen opnieuw uitgevoerd) ----------
export const toegewezen = ctx => poolAlles(ctx).filter(p => p.gepland && p.toegewezen);
// voor de data: per toegewezen rit de uitkomst van wijsToe, of het blok van een rit die op het planbord op een voertuig ging
export const toewijzingen = ctx => toegewezen(ctx).map(p => p.toegewezen.uit).filter(Boolean);
// wat van een kandidaat in de actie gaat; telefoonnummers en e-mailadressen niet (die komen bij het uitvoeren uit de poule)
export const kKort = k => ({ soort: k.soort, id: k.id, naam: k.naam, sub: k.sub || null, voertuig: k.voertuig || null, kans: k.kans, kosten: k.kosten, waarschuwingen: k.waarschuwingen || [] });
function verrijk(ctx, w) {
  const x = w.soort === 'charter' ? charterById(ctx, w.id) : w.soort === 'oproep' ? oproepById(ctx, w.id) : null;
  return { ...w, waarschuwingen: w.waarschuwingen || [], beschikbaar: true, tel: x ? x.tel : null, email: x && x.email ? x.email : null, contactpersoon: x && x.contactpersoon ? x.contactpersoon : null };
}
// opts.stil: geen melding en niet opnieuw tekenen (Plan alle open ritten doet dat één keer voor allemaal)
export function wijsToe(ctx, item, k, opts = {}) {
  if (!ctx.can('act')) { if (!opts.stil) ctx.L.toast('Alleen planners en regiomanagers wijzen ritten toe.', { icon: 'lock' }); return { ok: false }; }
  const res = ctx.runAction({ k: 'toewijs', id: item.id, wie: kKort(k), T: Tn(ctx) }, true);
  if (!res || !res.ok) { if (!opts.stil) ctx.L.toast(res && res.tekst ? res.tekst : 'Toewijzen lukte niet.', { icon: 'alert' }); return { ok: false, tekst: res && res.tekst ? res.tekst : 'Toewijzen lukte niet.' }; }
  const it = poolAlles(ctx).find(p => p.id === item.id); const tw = it.toegewezen; const v = vensterAbs(it);
  const kort = ctx.fleet.WAARSCHUWING_KORT || {}; const lt = tw.waarschuwingen.map(w => kort[w] || w);
  ctx.A.log(`vroeg ${k.naam} (${wieSoort(k)}) voor open rit ${it.id} van ${it.klant || 'de klant'} (${it.sp}, laden ${it.dag === 'morgen' ? 'morgen ' : ''}${hhmm(v[0])}); kosten ongeveer ${euro(tw.kosten)} (schatting)${lt.length ? `; let op: ${lt.join(', ')}` : ''}`, { pool: it.id });
  // een gemiste rit: de regel komt ook in de zaak "Rit niet ingevuld" (als die er is)
  if (ctx.Z && ctx.Z.logZaak) ctx.Z.logZaak(`N:${it.id}`, `gevraagd aan ${k.naam} (${wieSoort(k)}), vertrek ${hhmm(tw.start)}, kosten ongeveer ${euro(tw.kosten)} (schatting)`);
  // een eigen chauffeur die nu op dienst is, krijgt de vraag op de boordcomputer
  const p = k.soort === 'eigen' ? ctx.people.byId.get(k.id) : null;
  if (p && p.dienst && p.dienst.t && tw.bericht && ctx.sendMsg) ctx.sendMsg(p.dienst.t, tw.bericht.tekst, true, true);
  if (opts.stil) return { ok: true };
  ctx.L.toast(`Gevraagd aan ${k.naam}. De rit staat gearceerd op het planbord tot je bevestigt.`, { icon: 'check', ms: 6000 });
  ctx.refreshAll(false); return { ok: true };
}
// Plan alle open ritten: elke rit aan zijn eigen aanbevolen kandidaat, op volgorde (elke toewijzing met haar eigen regel in
// het logboek en de zaak), dan één melding en één keer opnieuw tekenen. paren: [{ item, k }]. { n, fout: [tekst] }
export function wijsToeAlle(ctx, paren) {
  if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers wijzen ritten toe.', { icon: 'lock' }); return { n: 0, fout: [] }; }
  let n = 0; const fout = [];
  for (const { item, k } of paren) { const r = wijsToe(ctx, item, k, { stil: true }); if (r.ok) n++; else fout.push(`${item.id}: ${r.tekst || 'lukte niet'}`); }
  if (n) ctx.A.log(`vroeg in één keer ${n} ${n === 1 ? 'kandidaat' : 'kandidaten'} voor ${n} open ${n === 1 ? 'rit' : 'ritten'} (Plan alle open ritten)`);
  ctx.L.toast(`${n} ${n === 1 ? 'rit' : 'ritten'} gevraagd${fout.length ? `, ${fout.length} niet` : ''}. Ze staan gearceerd op het planbord tot je bevestigt.`, { icon: 'check', ms: 7000 });
  ctx.refreshAll(false); return { n, fout };
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
// wie de planner over een rit belde, mailde of tegelijk vroeg (bewaard, zodat een collega ziet wie al gevraagd is); bij een
// gemiste rit ook de klant (soort 'bel' of 'bericht') en de afspraak morgen als eerste (soort 'morgen')
export function contact(ctx, item, wie, soort, tekst) {
  ctx.runAction({ k: 'contact', id: item.id, wie, soort, T: Tn(ctx) }, true);
  if (tekst) ctx.A.log(tekst, { pool: item.id });
}
// een rit die niemand rijdt morgen als eerste (voor of na het venster): de klant weet het (afgesproken), de rit staat bij de
// open ritten van morgen
export function morgenAlsEerste(ctx, item) {
  if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers wijzigen het plan.', { icon: 'lock' }); return { ok: false }; }
  if (item.gepland || item.morgenEerste) { ctx.L.toast(item.morgenEerste ? 'Deze rit staat al morgen als eerste.' : 'Deze rit is al toegewezen.', { icon: 'info' }); return { ok: false }; }
  const v = morgenVenster(item); const kp = klantPlanning(item);
  contact(ctx, item, [kp.naam], 'morgen', `zette ${Tn(ctx) >= vensterVandaag(item)[1] ? 'gemiste' : 'open'} rit ${item.id} van ${item.klant || 'de klant'} (${item.sp}) morgen als eerste: laden ${hhmm(v[0])} tot ${hhmm(v[1])}, met de klant afgesproken`);
  ctx.Z.logZaak(`N:${item.id}`, `morgen als eerste gezet: laden morgen ${hhmm(v[0])} tot ${hhmm(v[1])}`);
  ctx.L.toast(`Rit ${item.id} staat morgen als eerste (laden ${hhmm(v[0])} tot ${hhmm(v[1])}) bij de open ritten van morgen.`, { icon: 'check', ms: 6000 });
  ctx.refreshAll(false); return { ok: true };
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
    // de kijker nam de rit op zich: geen collega meer (zegt de kandidaat nee, dan is het weer zijn open rit)
    item.collega = null;
    return { ok: true, tekst: '', t };
  }
  if (a.k === 'bevestig') { if (item.toegewezen) { item.toegewezen.status = 'bevestigd'; item.toegewezen.Tb = a.T; } return { ok: true }; }
  if (a.k === 'terug') {
    if (!item.gepland) return { ok: false, tekst: 'Deze rit staat al bij de open ritten.' };
    if (!item.gepland.t) { item.gepland = null; item.toegewezen = null; return { ok: true, tekst: '' }; }
    const r = haalPoolRitTerug(ctx, item); if (r.ok) item.toegewezen = null; return r;
  }
  if (a.k === 'contact') {
    item.contact = [...(item.contact || []), ...(a.wie || []).map(w => ({ wie: w, soort: a.soort, T: a.T }))];
    // morgen als eerste: de rit gaat naar de open ritten van morgen met een vroeg venster; vandaag telt hij als gemist
    // (morgenEerste.van houdt het venster van vandaag). Weekdag, datum en dienstdeel van morgen, voor de kandidaten.
    if (a.soort === 'morgen' && !item.morgenEerste && item.dag !== 'morgen' && !item.gepland) {
      const v = morgenVenster(item); item.morgenEerste = { T: a.T, van: item.venster.slice() };
      const d = dagDatum(ctx, 'morgen'); item.dag = 'morgen'; item.venster = v; item.dagdeel = dienstdeel(v[0]);
      item.weekdag = weekdagVan(d); item.weekend = item.weekdag === 'za' || item.weekdag === 'zo'; item.datum = isoDag(d);
    }
    return { ok: true };
  }
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
  item.collega = null;
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
