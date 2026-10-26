// Vertaling tussen de Control Tower en OTM5 (Open Trip Model, versie 5.9.0 van 2 oktober 2026, beheer SUTC).
// Bron van de standaard: github.com/opentripmodel/otm5-change-requests (otm-api/otm-api-v5.9.yaml) en de documentatie in
// github.com/opentripmodel/documentation. Zie rapporten/simon-loos-control-tower/echte-data-en-otm5.md.
//
// Puur: geen DOM, geen imports. Het bewijs dat ons model zonder herbouw in OTM5 past, en de basis voor de import van echte
// ritten later. Sinds 4.1 maakt de app er ook de ritopdracht naar de boordcomputer mee (src/ui/ritopdracht.js, het enige
// app-bestand dat het importeert: uitFleet, naarOtm5Van, isoTijd); het inlezen (vanOtm5) blijft buiten de bundel, want de
// bundel neemt alleen mee wat gebruikt wordt (getoetst in tests/otm5-check.mjs).
//
// Drie stappen, met in het midden "onze vorm" (het eigen model aan de rand van het systeem, zoals OTM zelf aanraadt:
// "translate between OTM and your internal format at the boundaries of your services"):
//   uitFleet(fleet, T)      de gesimuleerde dag in onze vorm (ritten, stops, vensters, voertuigen, opleggers, events)
//   naarOtm5(fleet, T)      onze vorm als OTM5-bundel: per soort een lijst OTM5-entiteiten (trips, vehicles, actors, ...)
//   vanOtm5(doc)            een OTM5-bundel, een losse trip of een lijst entiteiten terug naar onze vorm
//
// Tijden in onze vorm zijn minuten sinds middernacht van `datum`, Amsterdamse kloktijd (mogen onder 0 of boven 1440
// liggen); in OTM5 zijn het ISO 8601-tijden met offset (+01:00 of +02:00). Elk id in OTM5 is een UUID versie 5 uit ons
// eigen id, zodat dezelfde rit, hetzelfde voertuig en dezelfde plek altijd dezelfde UUID krijgen (de OTM-documentatie,
// usage_notes/uuid.md, raadt dat aan); ons eigen id staat erbij in externalIdentifiers (nieuw in 5.9).
// Wat OTM5 niet kent (dienst, ritnummer, wachttijd als getal, de status van een oplegger op dit moment) gaat mee in
// externalAttributes onder één sleutel, "simonloos". Dat moet een object zijn: in 5.9 is elke waarde van
// externalAttributes een JSON-object (unrestricted_json), een losse tekst of een getal valideert niet.

/**
 * @typedef {{ id: string, naam: string, soort: string, lat: number, lon: number, plaats?: string|null, formule?: string|null,
 *   adres?: { straat: string, nr: string, postcode: string, plaats: string }|null, docks?: { nr: number, lat: number, lon: number }[] }} Plek
 * @typedef {{ id: string, kenteken: string, soort: string, model: string|null, elektrisch: boolean, bereikKm: number|null,
 *   standplaats: string, divisie: string|null, vandaag: string|null, klant: string|null, lzv: boolean, oplegger: string|null }} Voertuig
 * @typedef {{ id: string, kenteken: string, soort: string, temp: number[]|null, standplaats: string|null, divisie: string|null,
 *   bouwjaar: number|null, onderhoud: boolean, status: { st: string, plek: string|null, voertuig: string|null, geladen: boolean, sinds: number|null }|null }} Oplegger
 * @typedef {{ plek: string, naam: string, aankomst: number, klaar: number, vertrek: number, venster: number[]|null, wacht: number,
 *   los: number, actie: string, km: number|null, af: string|null, mee: string|null }} Stop
 * @typedef {{ van: string, naar: string, start: number, eind: number, km: number, vertraging: number }} Rijstuk
 * @typedef {{ soort: string, t0: number, t1: number, bij: string|null, deel: number|null }} Pauze
 * @typedef {{ k: string, t0: number, t1: number, dock: number|null, oplegger: string|null }} Dockblok
 * @typedef {{ id: string, voertuig: string, nr: number, dienst: number|null, chauffeur: string|null, standplaats: string|null,
 *   klant: string|null, km: number, status: string, begin: number, einde: number, vertrek: number, terug: number,
 *   oplegger: string|null, lading: string|null, dockVertrek: number|null, dockAankomst: number|null, start: string|null, eindPlek: string|null,
 *   vertrekBlok: Dockblok|null, aankomstBlok: Dockblok|null, stops: Stop[], rijstukken: Rijstuk[], pauzes: Pauze[] }} Rit
 * @typedef {{ id: string, voertuig: string, nr: number, chauffeur: string|null, start: number, eind: number, rijMin: number|null }} Dienst
 * @typedef {{ voertuig: string, k: string, t0: number, t1: number, dienst: number|null, reden: string|null, bij: string|null, plek: string|null }} Blok
 * @typedef {{ id: string, standplaats: string, divisie: string|null, klant: string|null, soort: string|null, oplegger: string|null,
 *   dag: string, reden: string|null, bekend: number|null, venster: number[]|null, duur: number|null, km: number|null,
 *   stops: { plek: string, naam: string, km: number|null }[] }} OpenRit
 * @typedef {{ voertuig: string, t: number, soort: string, plek: string|null, naam: string, rit: number|null, lat: number, lon: number }} Gebeurtenis
 * @typedef {{ voertuig: string, lat: number, lon: number, koers: number, snelheid: number, st: string|null }} Positie
 * @typedef {{ bron: string, datum: string, T: number|null, plekken: Plek[], voertuigen: Voertuig[], opleggers: Oplegger[],
 *   chauffeurs: { id: string, standplaats: string|null }[], diensten: Dienst[], ritten: Rit[], blokken: Blok[], open: OpenRit[],
 *   events: Gebeurtenis[], posities: Positie[], waarschuwingen?: string[] }} OnzeVorm
 */

export const OTM_VERSIE = '5.9.0';
const SL = 'simonloos';
const SCHEMA = {
  plek: 'simonloos:plek', dock: 'simonloos:dock', voertuig: 'simonloos:wagennummer', oplegger: 'simonloos:opleggernummer',
  chauffeur: 'simonloos:personeelsnummer', rit: 'simonloos:rit', open: 'simonloos:open-rit', klant: 'simonloos:klant', actor: 'simonloos:actor',
  kenteken: 'kenteken',
};

// ---------- UUID versie 5 (SHA-1, RFC 4122), zonder imports ----------
function sha1(msg) {
  const ml = msg.length, total = Math.ceil((ml + 9) / 64) * 64;
  const buf = new Uint8Array(total); buf.set(msg); buf[ml] = 0x80;
  const dv = new DataView(buf.buffer); const bits = ml * 8;
  dv.setUint32(total - 8, Math.floor(bits / 4294967296)); dv.setUint32(total - 4, bits >>> 0);
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = tmp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20); const o = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => o.setUint32(i * 4, h));
  return out;
}
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
function utf8(s) {
  if (enc) return enc.encode(s);
  const out = []; for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0)); return Uint8Array.from(out);
}
/** UUID versie 5 van een naam in een naamruimte (standaard: die van Simon Loos). */
export function uuid5(naam, ns = NS) {
  const nb = Uint8Array.from((ns.replace(/-/g, '').match(/../g) || []).map(x => parseInt(x, 16)));
  const tb = utf8(String(naam)); const m = new Uint8Array(16 + tb.length); m.set(nb); m.set(tb, 16);
  const h = sha1(m).slice(0, 16); h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = hex(h); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const NS_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
/** De naamruimte van Simon Loos: uuid5('simonloos.nl') in de DNS-naamruimte. */
export const NS = uuid5('simonloos.nl', NS_DNS);
const uuidCache = new Map();
const U = naam => { let u = uuidCache.get(naam); if (!u) { u = uuid5(naam); uuidCache.set(naam, u); } return u; };

// ---------- tijd: minuten van de dag (Amsterdamse kloktijd) <-> ISO 8601 ----------
// Zomertijd in de EU: van de laatste zondag van maart 01:00 UTC tot de laatste zondag van oktober 01:00 UTC.
const laatsteZondag = (j, m) => { const d = new Date(Date.UTC(j, m + 1, 0)); return Date.UTC(j, m, d.getUTCDate() - d.getUTCDay(), 1); };
export const zomertijd = ms => { const j = new Date(ms).getUTCFullYear(); return ms >= laatsteZondag(j, 2) && ms < laatsteZondag(j, 9); };
const dagMs = datum => { const [j, m, d] = String(datum).split('-').map(Number); return Date.UTC(j, m - 1, d); };
const p2 = n => String(n).padStart(2, '0');
/** Minuten sinds middernacht van `datum` (Amsterdamse kloktijd) als ISO 8601 met offset, op de milliseconde. */
export function isoTijd(datum, minuten) {
  const wand = dagMs(datum) + Math.round(minuten * 60000);   // de kloktijd, gelezen alsof het UTC is
  const off = zomertijd(wand - 7200000) ? 2 : 1;               // het uur van 02:00 tot 03:00 in oktober: de eerste keer
  const d = new Date(wand);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, '0')}+0${off}:00`;
}
/** ISO 8601 (met Z of een offset) naar minuten sinds middernacht van `datum`, in Amsterdamse kloktijd; null als het geen tijd is. */
export function minutenVan(iso, datum) {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso); if (!Number.isFinite(ms)) return null;
  return (ms + (zomertijd(ms) ? 2 : 1) * 3600000 - dagMs(datum)) / 60000;
}
/** De datum van vandaag in Amsterdam (alleen als er geen datum is meegegeven). */
export function vandaagAmsterdam(ms = Date.now()) { return new Date(ms + (zomertijd(ms) ? 2 : 1) * 3600000).toISOString().slice(0, 10); }
const datumVanIso = iso => { const ms = Date.parse(iso); return Number.isFinite(ms) ? vandaagAmsterdam(ms) : null; };

// ---------- kleine hulpjes ----------
const r1 = x => Math.round(x * 10) / 10;
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const schoon = o => { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k]; return o; };
const ref = (entityType, uuid) => ({ associationType: 'reference', uuid, entityType });
const refRol = (uuid, roles) => ({ associationType: 'reference', uuid, entityType: 'actor', roles });
const inl = entity => ({ associationType: 'inline', entity });
const geo = (lat, lon) => ({ type: 'latLonPointGeoReference', lat, lon });
const eid = (id, scheme) => ({ id: String(id), scheme });

// Soorten plekken en voertuigen in OTM5 (location.type is een vaste lijst; vehicleType en equipmentSubType zijn vrije tekst).
const LOCTYPE = { standplaats: 'operationalBase', winkel: 'store', dc: 'warehouse', groothandel: 'warehouse', fabriek: 'customer', bezorg: 'customer', pauzeplek: 'serviceStation' };
const VTYPE = { trekker: 'tractor', bakwagen: 'truck', bus: 'van' };
const STATUS = { gepland: 'confirmed', onderweg: 'inTransit', klaar: 'completed' };
const STATUS_TERUG = { confirmed: 'gepland', accepted: 'gepland', requested: 'gepland', draft: 'gepland', inTransit: 'onderweg', completed: 'klaar', closed: 'klaar', cancelled: 'geannuleerd', rejected: 'geweigerd' };

// ======================================================================================================================
// 1. De gesimuleerde dag in onze vorm
// ======================================================================================================================
const plekIdVan = p => !p ? null : p.fleet !== undefined ? 'sp:' + p.n : p.id || p.name || null;
const plekNaamVan = p => {
  if (!p) return ''; if (p.fleet !== undefined) return `Simon Loos ${p.n}`;
  const n = p.naam || p.n || p.name || ''; const pl = p.plaats || '';
  return pl && !n.toLowerCase().includes(pl.toLowerCase()) ? `${n}, ${pl}` : n;
};
const plekSoortVan = p => !p ? 'onbekend' : p.fleet !== undefined ? 'standplaats' : p.soort ? p.soort : /^bz-/.test(p.id || '') ? 'bezorg' : p.formule ? 'winkel' : 'onderweg';
const chauffeurVan = (d, t) => !d ? null : d.person ? d.person.id : d.driver ? `C-${String(fnv(`${t.base ? t.base.n : ''}|${d.driver}`) % 1000000).padStart(6, '0')}` : null;

/**
 * De gesimuleerde dag in onze vorm, zoals de planner hem om T (minuten van de dag) ziet.
 * @param {object} fleet het resultaat van createFleet() (na createPeople(fleet) krijgen chauffeurs hun personeelsnummer)
 * @param {number} T minuten sinds middernacht
 * @param {{ datum?: string, voertuigen?: string[], events?: boolean }} [opts]
 * @returns {OnzeVorm}
 */
export function uitFleet(fleet, T = 0, opts = {}) {
  const datum = opts.datum || vandaagAmsterdam();
  const kies = opts.voertuigen ? new Set(opts.voertuigen) : null;
  const trucks = kies ? fleet.trucks.filter(t => kies.has(t.id)) : fleet.trucks;
  const plekken = new Map();
  const plek = p => {
    const id = plekIdVan(p); if (!id || plekken.has(id)) return id;
    const soort = plekSoortVan(p);
    const docks = p.fleet !== undefined ? (Array.isArray(p.dockPlek) && p.dockPlek.length ? p.dockPlek.map((d, i) => ({ nr: i + 1, lat: d[1], lon: d[0] }))
      : Array.from({ length: p.docks || 0 }, (_, i) => ({ nr: i + 1, lat: p.lat, lon: p.lon }))) : undefined;
    plekken.set(id, schoon({
      id, naam: plekNaamVan(p), soort, lat: p.lat, lon: p.lon, plaats: p.plaats || (p.adres && p.adres.plaats) || (p.fleet !== undefined ? p.n : null),
      formule: p.formule || null, adres: p.adres && typeof p.adres === 'object' ? { straat: p.adres.straat, nr: String(p.adres.nr), postcode: p.adres.postcode, plaats: p.adres.plaats } : null,
      docks,
    }));
    return id;
  };
  for (const t of trucks) plek(t.base);

  // opleggers: vaste gegevens en hun toestand om T
  const opleggerVan = new Map();   // voertuig -> oplegger om T
  const alleenGekozen = !!kies;
  const opleggers = [];
  // ritten, diensten en losse blokken per voertuig
  const ritten = [], diensten = [], blokken = [], chauffeurs = new Map();
  for (const t of trucks) {
    const P = t.plan || [], D = t.dayStart || 0, routes = t.routes || [];
    const ritNr = s => { const rt = s.route || s.ritRef; if (!rt) return null; const k = routes.indexOf(rt); return k >= 0 ? k + 1 : null; };
    for (const d of t.diensten || []) {
      const c = chauffeurVan(d, t); if (c && !chauffeurs.has(c)) chauffeurs.set(c, { id: c, standplaats: t.base ? t.base.n : null });
      diensten.push({ id: `${t.id}#${d.i}`, voertuig: t.id, nr: d.i, chauffeur: c, start: D + d.t0, eind: D + d.t1, rijMin: d.rij ?? null });
    }
    const perRit = new Map();
    for (const s of P) {
      if (!(s.t1 > s.t0)) continue;
      const n = ritNr(s);
      if (n === null) {
        if (s.k === 'terrein' && s.d === null) continue;   // niets gepland: het voertuig staat op het terrein
        blokken.push({ voertuig: t.id, k: s.wachtDock ? 'wacht' : s.k, t0: D + s.t0, t1: D + s.t1, dienst: s.d ?? null, reden: s.wachtDock ? 'dock' : null, bij: s.at || null,
          plek: s.k === 'stop' ? plek(s.place) : s.k === 'drive' ? null : plek(t.base) });
        continue;
      }
      if (!perRit.has(n)) perRit.set(n, []); perRit.get(n).push(s);
    }
    for (const [n, segs] of perRit) {
      const rt = routes[n - 1]; const marks = rt.marks;
      const drives = segs.filter(s => s.k === 'drive' && s.route === rt);
      const rijstukken = [];
      for (let j = 1; j < marks.length; j++) {
        const st = drives.filter(s => s.idx === j); if (!st.length) continue;
        rijstukken.push({ van: plek(marks[j - 1].place), naar: plek(marks[j].place), start: D + st[0].t0, eind: D + st[st.length - 1].t1, km: r1(marks[j].km - marks[j - 1].km),
          vertraging: st.reduce((a, s) => a + (t.delayResolved ? 0 : (s.delay || 0)), 0), _venster: st[st.length - 1].win || null, _j: j });
      }
      const stops = [];
      for (const s of segs) {
        if (s.k !== 'stop') continue;
        const j = s.idx; const aan = rijstukken.find(x => x._j === j); const weg = rijstukken.find(x => x._j === j + 1);
        const wacht = s.wacht || 0;
        stops.push({
          plek: plek(s.place), naam: s.stop, aankomst: D + s.t0, klaar: D + s.t1, vertrek: weg ? weg.start : D + s.t1,
          venster: aan && aan._venster ? [D + aan._venster[0], D + aan._venster[1]] : null, wacht, los: s.t1 - s.t0 - wacht,
          actie: s.pickup ? 'ophalen' : s.actie || 'lossen', km: marks[j] ? r1(marks[j].km) : null,
          af: s.swap && s.swap.drop ? s.swap.drop.id : null, mee: s.swap && s.swap.take ? s.swap.take.id : s.pickup ? s.pickup.id : null,
        });
      }
      const blok = s => s ? { k: s.k === 'terrein' ? (s.dockSoort === 'laden' ? 'laden' : 'retour') : s.k, t0: D + s.t0, t1: D + s.t1, dock: s.dock || null, oplegger: s.tr ? s.tr.id : null } : null;
      const vb = segs.find(s => s.k === 'koppel' || (s.k === 'terrein' && s.dockSoort === 'laden'));
      const ab = segs.find(s => s.k === 'ontkoppel' || (s.k === 'terrein' && s.dockSoort === 'aankomst'));
      const pauzes = segs.filter(s => s.k === 'pauze' || s.k === 'laden').map(s => ({ soort: s.k, t0: D + s.t0, t1: D + s.t1, bij: s.at || null, deel: s.partial ?? null }));
      const eerste = marks[1] && marks[1].place;
      const klant = !eerste ? t.klant || null : eerste.fleet !== undefined ? 'Simon Loos' : eerste.formule || t.klant || null;
      let lading = t.kind !== 'trekker' ? t.lading || null : null;
      if (vb && vb.k === 'koppel' && vb.tr) { const e = (vb.tr.events || []).find(x => x.k === 'coupled' && x.vehicle === t && Math.abs(x.a - (D + vb.t0)) < 1e-6); lading = e ? e.lading || null : null; }
      const begin = D + segs[0].t0, einde = D + segs[segs.length - 1].t1;
      const vertrek = rijstukken.length ? rijstukken[0].start : begin, terug = rijstukken.length ? rijstukken[rijstukken.length - 1].eind : einde;
      const dienst = segs.find(s => s.d !== null && s.d !== undefined); const d = dienst ? (t.diensten || [])[dienst.d] : null;
      for (const x of rijstukken) { delete x._venster; delete x._j; }
      ritten.push({
        id: `${t.id}/${n}`, voertuig: t.id, nr: n, dienst: dienst ? dienst.d : null, chauffeur: chauffeurVan(d, t), standplaats: t.base ? t.base.n : null, klant,
        km: r1(rt.total), status: T >= einde ? 'klaar' : T >= begin ? 'onderweg' : 'gepland', begin, einde, vertrek, terug,
        oplegger: vb && vb.k === 'koppel' && vb.tr ? vb.tr.id : null, lading, dockVertrek: vb ? vb.dock || null : null, dockAankomst: ab ? ab.dock || null : null,
        start: plek(marks[0].place), eindPlek: plek(marks[marks.length - 1].place),
        vertrekBlok: blok(vb), aankomstBlok: blok(ab), stops, rijstukken, pauzes,
      });
    }
  }
  for (const tr of fleet.trailers || []) {
    const s = fleet.trailerStateAt ? fleet.trailerStateAt(tr, T) : null;
    if (s && s.vehicle) opleggerVan.set(s.vehicle.id, tr.id);
    if (alleenGekozen) continue;
    opleggers.push(oplegger(tr, s));
  }
  if (alleenGekozen) {   // alleen de opleggers die de gekozen voertuigen vandaag gebruiken of om T dragen
    const ids = new Set(); for (const r of ritten) { if (r.oplegger) ids.add(r.oplegger); for (const s of r.stops) { if (s.af) ids.add(s.af); if (s.mee) ids.add(s.mee); } }
    for (const t of trucks) if (opleggerVan.get(t.id)) ids.add(opleggerVan.get(t.id));
    for (const tr of fleet.trailers || []) if (ids.has(tr.id)) opleggers.push(oplegger(tr, fleet.trailerStateAt ? fleet.trailerStateAt(tr, T) : null));
  }
  function oplegger(tr, s) {
    if (tr.base) plek(tr.base);
    const temp = fleet.TRT && fleet.TRT[tr.type] && fleet.TRT[tr.type].temp ? [...fleet.TRT[tr.type].temp] : null;
    return { id: tr.id, kenteken: tr.plate, soort: tr.type, temp, standplaats: tr.base ? tr.base.n : null, divisie: tr.div || null, bouwjaar: tr.bouwjaar ?? null, onderhoud: !!tr.onderhoud,
      status: s ? { st: s.st, plek: s.place || null, voertuig: s.vehicle ? s.vehicle.id : null, geladen: !!s.loaded, sinds: Number.isFinite(s.since) ? s.since : null } : null };
  }
  const voertuigen = trucks.map(t => ({
    id: t.id, kenteken: t.plate, soort: t.kind, model: t.model || null, elektrisch: !!t.ev, bereikKm: t.range ?? null, standplaats: t.base ? t.base.n : null,
    divisie: t.div || null, vandaag: t.vandaag || null, klant: t.klant || null, lzv: !!t.lzv, oplegger: opleggerVan.get(t.id) || null,
  }));
  // open ritten (pool) zoals de planner ze om T ziet
  const sps = new Set(trucks.map(t => t.base && t.base.n));
  const pool = (fleet.poolAt ? fleet.poolAt(T) : fleet.pool || []).filter(p => !kies || sps.has(p.sp));
  const open = pool.map(p => {
    const wagen = trucks.find(t => t.base && t.base.n === p.sp); if (wagen) plek(wagen.base);
    for (const s of p.stops) { const m = p.route && p.route.marks.find(x => plekIdVan(x.place) === s.id); plek(m ? m.place : s.place); }
    return { id: p.id, standplaats: p.sp, divisie: p.div || null, klant: p.klant || null, soort: p.soort || null, oplegger: p.oplegger || null, dag: p.dag || 'vandaag', reden: p.reden || null,
      bekend: p.bekend ?? null, venster: p.venster ? [...p.venster] : null, duur: p.duur ?? null, km: p.km ?? null, stops: p.stops.map(s => ({ plek: s.id || plekIdVan(s.place), naam: s.name, km: s.km !== undefined ? r1(s.km) : null })) };
  });
  // gebeurtenissen tot T (fleet.eventsOf) met de positie op dat moment, en de posities om T
  const events = [], posities = [];
  if (opts.events !== false && fleet.eventsOf) for (const t of trucks) {
    for (const e of fleet.eventsOf(t)) {
      if (!(e.t <= T)) continue;
      const s = fleet.stateAt ? fleet.stateAt(t, e.t) : null;
      events.push({ voertuig: t.id, ...e, lat: s ? s.pos.lat : null, lon: s ? s.pos.lon : null });
    }
  }
  if (fleet.stateAt) for (const t of trucks) {
    const s = fleet.stateAt(t, T);
    posities.push({ voertuig: t.id, lat: s.pos.lat, lon: s.pos.lon, koers: Number.isFinite(s.pos.bearing) ? s.pos.bearing : 0, snelheid: s.speed || 0, st: s.st || null });
  }
  return { bron: 'simulatie', datum, T, plekken: [...plekken.values()], voertuigen, opleggers, chauffeurs: [...chauffeurs.values()], diensten, ritten, blokken, open, events, posities };
}

// ======================================================================================================================
// 2. Onze vorm naar OTM5
// ======================================================================================================================
const ACTIE = { lossen: 'unload', laden: 'load' };
const EVENT_ACTIE = (soort, wat) => soort.startsWith('los') ? 'unload' : soort.startsWith('laad') ? (wat === 'accu' ? 'refuel' : 'load')
  : soort === 'koppel' ? 'attachTransportEquipment' : soort === 'ontkoppel' ? 'detachTransportEquipment' : soort.startsWith('pauze') ? 'break' : null;
const BEWEGING = { vertrek: 'startMovingEvent', aankomst: 'stopMovingEvent', wacht: 'startWaitingEvent' };

/**
 * De gesimuleerde dag als OTM5-bundel. Kort voor naarOtm5Van(uitFleet(fleet, T, opts), opts).
 * @returns {object} { otmVersie, datum, tijdstip, bron, locations, actors, vehicles, transportEquipment, consignments, trips, events }
 */
export function naarOtm5(fleet, T = 0, opts = {}) { return naarOtm5Van(uitFleet(fleet, T, opts), opts); }

/**
 * Onze vorm als OTM5-bundel: per soort een lijst OTM5-entiteiten, elk geldig tegen het OTM5-schema van die soort (de bundel
 * zelf is geen OTM: OTM kent geen omhulsel en geen vast hoofdelement; je stuurt de entiteiten los naar /api/v5/trips enz.).
 * @param {OnzeVorm} v
 */
export function naarOtm5Van(v, opts = {}) {
  const datum = v.datum; const iso = m => isoTijd(datum, m);
  const plekU = id => U('plek:' + id), dockU = (id, nr) => U(`dock:${id}:${nr}`), voertuigU = id => U('voertuig:' + id), opleggerU = id => U('oplegger:' + id);
  const chauffeurU = id => U('chauffeur:' + id), klantU = naam => U('klant:' + naam), carrierU = U('actor:simonloos');
  const plekById = new Map(v.plekken.map(p => [p.id, p]));
  const dockRef = (plekId, nr) => { const p = plekById.get(plekId); return nr && p && p.docks && p.docks.some(d => d.nr === nr) ? ref('location', dockU(plekId, nr)) : ref('location', plekU(plekId)); };

  const locations = v.plekken.map(p => schoon({
    entityType: 'location', id: plekU(p.id), name: p.naam, type: LOCTYPE[p.soort] || 'other', otherLocationType: LOCTYPE[p.soort] ? undefined : p.soort,
    geoReference: geo(p.lat, p.lon),
    administrativeReference: p.adres ? { street: p.adres.straat, houseNumber: p.adres.nr, postalCode: p.adres.postcode, city: p.adres.plaats, country: 'NL' } : p.plaats ? { city: p.plaats, country: 'NL' } : undefined,
    externalIdentifiers: [eid(p.id, SCHEMA.plek)],
    externalAttributes: { [SL]: schoon({ soort: p.soort, formule: p.formule, plaats: p.plaats }) },
    subLocations: p.docks && p.docks.length ? p.docks.map(d => inl({ entityType: 'location', id: dockU(p.id, d.nr), name: `Dock ${d.nr}`, type: 'other', otherLocationType: 'dock',
      geoReference: geo(d.lat, d.lon), externalIdentifiers: [eid(`${p.id}#${d.nr}`, SCHEMA.dock)] })) : undefined,
  }));

  const klanten = [...new Set([...v.ritten.map(r => r.klant), ...v.open.map(o => o.klant)].filter(Boolean))].filter(k => k !== 'Simon Loos');
  const actors = [
    { entityType: 'actor', id: carrierU, name: 'Simon Loos', type: 'company', externalIdentifiers: [eid('simonloos', SCHEMA.actor)] },
    ...klanten.map(k => ({ entityType: 'actor', id: klantU(k), name: k, type: 'company', externalIdentifiers: [eid(k, SCHEMA.klant)] })),
    // chauffeurs als nummer: geen naam, geen telefoon (AVG: dataminimalisatie). Het personeelsnummer is de sleutel naar HR.
    ...v.chauffeurs.map(c => ({ entityType: 'actor', id: chauffeurU(c.id), type: 'person', externalIdentifiers: [eid(c.id, SCHEMA.chauffeur)], externalAttributes: { [SL]: schoon({ standplaats: c.standplaats }) } })),
  ];

  const transportEquipment = v.opleggers.map(o => schoon({
    entityType: 'goods', type: 'transportEquipment', id: opleggerU(o.id), name: o.id, equipmentType: 'trailer', equipmentSubType: o.soort, licensePlate: o.kenteken,
    externalIdentifiers: [eid(o.id, SCHEMA.oplegger), eid(o.kenteken, SCHEMA.kenteken)],
    constraint: o.temp ? inl({ value: { type: 'temperatureConstraint', constraintType: 'range', minimum: { value: o.temp[0], unit: 'C' }, maximum: { value: o.temp[1], unit: 'C' } } }) : undefined,
    externalAttributes: { [SL]: schoon({ standplaats: o.standplaats, divisie: o.divisie, bouwjaar: o.bouwjaar, onderhoud: o.onderhoud, temp: o.temp, status: o.status ? { ...o.status, sinds: o.status.sinds === null ? null : iso(o.status.sinds) } : null }) },
  }));

  // acties krijgen een vaste UUID; de index koppelt een gebeurtenis (koppel, los_start, pauze_eind, ...) aan de geplande actie
  const actieIndex = new Map();
  const tk = x => Math.round(x * 1000);
  const merk = (voertuig, rit, type, t0, t1, id) => { actieIndex.set(`${voertuig}|${rit}|${type}|s${tk(t0)}`, id); actieIndex.set(`${voertuig}|${rit}|${type}|e${tk(t1)}`, id); };
  const actie = (type, key, t0, t1, extra, voertuig, rit) => { const id = U(key); merk(voertuig, rit, type, t0, t1, id); return inl(schoon({ actionType: type, id, lifecycle: 'planned', startTime: iso(t0), endTime: iso(t1), ...extra })); };

  const vehicles = v.voertuigen.map(x => {
    const acts = [];
    v.blokken.filter(b => b.voertuig === x.id).forEach((b, i) => {
      const key = `blok:${datum}:${x.id}:${i}`; const e = { externalAttributes: { [SL]: schoon({ k: b.k, dienst: b.dienst, reden: b.reden, bij: b.bij }) } };
      const loc = b.plek ? { location: ref('location', plekU(b.plek)) } : {};
      if (b.k === 'pauze') acts.push(actie('break', key, b.t0, b.t1, { ...loc, ...e }, x.id, null));
      else if (b.k === 'laden') acts.push(actie('refuel', key, b.t0, b.t1, { ...loc, vehicle: ref('vehicle', voertuigU(x.id)), ...e }, x.id, null));
      else if (b.k === 'drive') acts.push(actie('move', key, b.t0, b.t1, { transportMode: 'road', ...e }, x.id, null));
      else if (b.k === 'stop') acts.push(actie('stop', key, b.t0, b.t1, { ...loc, ...e }, x.id, null));
      else acts.push(actie('wait', key, b.t0, b.t1, { ...loc, reason: b.reden === 'dock' ? 'dock bezet' : b.k === 'terrein' ? 'op het terrein, tussen twee ritten' : b.k, ...e }, x.id, null));
    });
    const o = v.opleggers.find(y => y.id === x.oplegger);
    if (x.oplegger) acts.push(inl(schoon({ actionType: 'attachTransportEquipment', id: U(`gekoppeld:${datum}:${x.id}:${x.oplegger}`), lifecycle: 'actual',
      startTime: o && o.status && o.status.sinds !== null ? iso(o.status.sinds) : undefined, vehicle: ref('vehicle', voertuigU(x.id)), transportEquipment: ref('goods', opleggerU(x.oplegger)) })));
    return schoon({
      entityType: 'vehicle', id: voertuigU(x.id), name: x.id, vehicleType: VTYPE[x.soort] || x.soort, licensePlate: x.kenteken,
      fuels: [{ fuelType: x.elektrisch ? 'electricity' : 'diesel' }],
      externalIdentifiers: [eid(x.id, SCHEMA.voertuig), eid(x.kenteken, SCHEMA.kenteken)],
      externalAttributes: { [SL]: schoon({ soort: x.soort, model: x.model, bereikKm: x.bereikKm, standplaats: x.standplaats, divisie: x.divisie, vandaag: x.vandaag, klant: x.klant, lzv: x.lzv }) },
      actions: acts.length ? acts : undefined,
    });
  });

  const consignments = [];
  const dienstVan = new Map(v.diensten.map(d => [`${d.voertuig}#${d.nr}`, d]));
  const trips = v.ritten.map(r => {
    const tkey = `rit:${datum}:${r.id}`; const tripId = U(tkey);
    const veh = ref('vehicle', voertuigU(r.voertuig));
    const zending = r.lading ? U(`zending:${datum}:${r.id}`) : null;
    if (zending) {
      const m = /(\d+)\s+(rolcontainers|pallets|bestellingen|ton)\b/.exec(r.lading);
      // de zending reist mee in de oplegger: bij drop & swap is er geen los-actie, dus de zending verwijst zelf naar het
      // koppelen bij vertrek en het achterlaten bij de klant (OTM: een consignment kent zijn eigen acties)
      const koppelRefs = [r.vertrekBlok && r.vertrekBlok.k === 'koppel' ? ref('attachTransportEquipment', U(`${tkey}|vertrek`)) : null,
        ...r.stops.map((s, j) => s.actie === 'wisselen' ? ref('detachTransportEquipment', U(`${tkey}|stop|${j + 1}|af`)) : null)].filter(Boolean);
      consignments.push(schoon({ entityType: 'consignment', id: zending, name: r.id, description: r.lading, status: STATUS[r.status],
        goods: [inl(schoon({ entityType: 'goods', type: 'items', id: U(`goederen:${datum}:${r.id}`), description: r.lading,
          quantity: m && m[2] !== 'ton' ? Number(m[1]) : undefined, packagingMaterial: m && m[2] !== 'ton' ? m[2] : undefined, weight: m && m[2] === 'ton' ? { value: Number(m[1]) * 1000, unit: 'kg' } : undefined }))],
        actors: r.klant && r.klant !== 'Simon Loos' ? [refRol(klantU(r.klant), ['shipper'])] : undefined,
        actions: koppelRefs.length ? koppelRefs : undefined,
        externalIdentifiers: [eid(r.id, SCHEMA.rit)] }));
    }
    const z = zending ? { consignment: ref('consignment', zending) } : {};
    // pauzes en laadbeurten onderweg: in het rijstuk of de stop waarin ze vallen
    const pauzeIn = new Map(); const plaats = (lijst, key) => { if (!pauzeIn.has(key)) pauzeIn.set(key, []); pauzeIn.get(key).push(lijst); };
    const spans = [['s0', r.begin, r.vertrek], ...r.rijstukken.map((x, j) => [`m${j}`, x.start, x.eind]), ...r.stops.map((s, j) => [`s${j + 1}`, s.aankomst, s.vertrek]), ['sN', r.terug, r.einde]];
    r.pauzes.forEach((p, i) => { const sp = spans.find(([, a, b]) => p.t0 >= a - 1e-6 && p.t0 < b - 1e-6) || spans[0]; plaats({ p, i }, sp[0]); });
    const pauzeActies = key => (pauzeIn.get(key) || []).map(({ p, i }) => actie(p.soort === 'laden' ? 'refuel' : 'break', `${tkey}|pauze|${i}`, p.t0, p.t1,
      schoon({ vehicle: p.soort === 'laden' ? veh : undefined, externalAttributes: { [SL]: schoon({ bij: p.bij, deel: p.deel }) } }), r.voertuig, r.nr));
    const acts = []; let seq = 0;
    // vertrek: koppelen aan een dock of laden aan een dock (dock als sublocatie van de standplaats)
    const vb = r.vertrekBlok; const s0 = [];
    if (vb && vb.k === 'koppel') s0.push(actie('attachTransportEquipment', `${tkey}|vertrek`, vb.t0, vb.t1, { vehicle: veh, transportEquipment: vb.oplegger ? ref('goods', opleggerU(vb.oplegger)) : undefined, location: dockRef(r.start, vb.dock) }, r.voertuig, r.nr));
    else if (vb) s0.push(actie('load', `${tkey}|vertrek`, vb.t0, vb.t1, { ...z, location: dockRef(r.start, vb.dock) }, r.voertuig, r.nr));
    s0.push(...pauzeActies('s0'));
    acts.push(inl(schoon({ actionType: 'stop', id: U(`${tkey}|stop|0`), name: plekById.get(r.start) ? plekById.get(r.start).naam : r.start, lifecycle: 'planned', sequenceNr: seq++,
      location: ref('location', plekU(r.start)), startTime: iso(r.begin), endTime: iso(r.vertrek), actions: s0.length ? s0 : undefined })));
    r.rijstukken.forEach((x, j) => {
      const nest = pauzeActies(`m${j}`);
      acts.push(inl(schoon({ actionType: 'move', id: U(`${tkey}|move|${j}`), lifecycle: 'planned', sequenceNr: seq++, transportMode: 'road', from: ref('location', plekU(x.van)), to: ref('location', plekU(x.naar)),
        startTime: iso(x.start), endTime: iso(x.eind), distance: { value: x.km, unit: 'km' }, actions: nest.length ? nest : undefined,
        externalAttributes: x.vertraging ? { [SL]: { vertraging: x.vertraging } } : undefined })));
      const s = r.stops[j]; if (!s || j >= r.stops.length) return;
      const k = `${tkey}|stop|${j + 1}`; const nested = [];
      if (s.wacht > 0) nested.push(actie('wait', `${k}|wacht`, s.aankomst, s.aankomst + s.wacht, { reason: 'wachten tot het lossen begint', location: ref('location', plekU(s.plek)) }, r.voertuig, r.nr));
      if (s.actie === 'wisselen') {
        nested.push(actie('detachTransportEquipment', `${k}|af`, s.aankomst, s.klaar, { vehicle: veh, transportEquipment: s.af ? ref('goods', opleggerU(s.af)) : undefined, location: ref('location', plekU(s.plek)) }, r.voertuig, r.nr));
        if (s.mee) nested.push(actie('attachTransportEquipment', `${k}|mee`, s.klaar, s.klaar, { vehicle: veh, transportEquipment: ref('goods', opleggerU(s.mee)), location: ref('location', plekU(s.plek)) }, r.voertuig, r.nr));
      } else if (s.actie === 'ophalen') nested.push(actie('attachTransportEquipment', `${k}|mee`, s.aankomst + s.wacht, s.klaar, { vehicle: veh, transportEquipment: s.mee ? ref('goods', opleggerU(s.mee)) : undefined, location: ref('location', plekU(s.plek)) }, r.voertuig, r.nr));
      else nested.push(actie(ACTIE[s.actie] || 'unload', `${k}|${s.actie}`, s.aankomst + s.wacht, s.klaar, { ...z, location: ref('location', plekU(s.plek)) }, r.voertuig, r.nr));
      nested.push(...pauzeActies(`s${j + 1}`));
      acts.push(inl(schoon({ actionType: 'stop', id: U(k), name: s.naam, lifecycle: 'planned', sequenceNr: seq++, location: ref('location', plekU(s.plek)), startTime: iso(s.aankomst), endTime: iso(s.vertrek),
        constraint: s.venster ? inl({ value: { type: 'timeWindowConstraint', startTime: iso(s.venster[0]), endTime: iso(s.venster[1]) }, enforceability: 'enforced' }) : undefined,
        actions: nested, externalAttributes: { [SL]: schoon({ actie: s.actie, wacht: s.wacht, km: s.km }) } })));
    });
    // aankomst: afkoppelen aan een dock of retouren lossen aan een dock
    const ab = r.aankomstBlok; const sN = [];
    if (ab && ab.k === 'ontkoppel') sN.push(actie('detachTransportEquipment', `${tkey}|aankomst`, ab.t0, ab.t1, { vehicle: veh, transportEquipment: ab.oplegger ? ref('goods', opleggerU(ab.oplegger)) : undefined, location: dockRef(r.eindPlek, ab.dock) }, r.voertuig, r.nr));
    else if (ab) sN.push(actie('unload', `${tkey}|aankomst`, ab.t0, ab.t1, { location: dockRef(r.eindPlek, ab.dock) }, r.voertuig, r.nr));
    sN.push(...pauzeActies('sN'));
    acts.push(inl(schoon({ actionType: 'stop', id: U(`${tkey}|stop|eind`), name: plekById.get(r.eindPlek) ? plekById.get(r.eindPlek).naam : r.eindPlek, lifecycle: 'planned', sequenceNr: seq++,
      location: ref('location', plekU(r.eindPlek)), startTime: iso(r.terug), endTime: iso(r.einde), actions: sN.length ? sN : undefined })));
    const d = r.dienst !== null ? dienstVan.get(`${r.voertuig}#${r.dienst}`) : null;
    return schoon({
      entityType: 'trip', id: tripId, name: `${r.voertuig} rit ${r.nr}`, status: STATUS[r.status], transportMode: 'road', vehicle: veh,
      actors: [r.chauffeur ? refRol(chauffeurU(r.chauffeur), ['driver']) : null, refRol(carrierU, ['carrier']), r.klant && r.klant !== 'Simon Loos' ? refRol(klantU(r.klant), ['shipper']) : null].filter(Boolean),
      actions: acts, externalIdentifiers: [eid(r.id, SCHEMA.rit)],
      externalAttributes: { [SL]: schoon({ voertuig: r.voertuig, nr: r.nr, dienst: r.dienst, standplaats: r.standplaats, klant: r.klant, km: r.km, status: r.status,
        dienstStart: d ? iso(d.start) : null, dienstEind: d ? iso(d.eind) : null, dienstRijMin: d ? d.rijMin : null }) },
    });
  });

  // open ritten: status requested, geen voertuig; het laadvenster op de standplaats en de eisen als constraints
  for (const o of v.open) {
    const tkey = `open:${datum}:${o.id}`; const dag0 = o.dag === 'morgen' ? 1440 : 0; const acts = []; let seq = 0;
    const eisen = [o.soort ? { type: 'vehicleTypeConstraint', vehicleTypes: [VTYPE[o.soort] || o.soort] } : null,
      o.oplegger ? { type: 'transportEquipmentTypeConstraint', equipmentTypes: ['trailer'], subEquipmentTypes: [o.oplegger] } : null].filter(Boolean);
    const sp = 'sp:' + o.standplaats;
    acts.push(inl(schoon({ actionType: 'stop', id: U(`${tkey}|stop|0`), lifecycle: 'requested', sequenceNr: seq++, location: ref('location', plekU(sp)),
      constraint: o.venster ? inl({ value: { type: 'timeWindowConstraint', startTime: iso(dag0 + o.venster[0]), endTime: iso(dag0 + o.venster[1]) }, enforceability: 'enforced' }) : undefined })));
    let km0 = 0;
    o.stops.forEach((s, j) => {
      acts.push(inl(schoon({ actionType: 'move', id: U(`${tkey}|move|${j}`), lifecycle: 'requested', sequenceNr: seq++, transportMode: 'road', from: ref('location', plekU(j ? o.stops[j - 1].plek : sp)), to: ref('location', plekU(s.plek)),
        distance: s.km !== null ? { value: r1(s.km - km0), unit: 'km' } : undefined })));
      km0 = s.km ?? km0;
      acts.push(inl({ actionType: 'stop', id: U(`${tkey}|stop|${j + 1}`), name: s.naam, lifecycle: 'requested', sequenceNr: seq++, location: ref('location', plekU(s.plek)),
        externalAttributes: { [SL]: schoon({ km: s.km }) } }));
    });
    acts.push(inl({ actionType: 'move', id: U(`${tkey}|move|terug`), lifecycle: 'requested', sequenceNr: seq++, transportMode: 'road', from: ref('location', plekU(o.stops.length ? o.stops[o.stops.length - 1].plek : sp)), to: ref('location', plekU(sp)) }));
    acts.push(inl({ actionType: 'stop', id: U(`${tkey}|stop|eind`), lifecycle: 'requested', sequenceNr: seq++, location: ref('location', plekU(sp)) }));
    trips.push(schoon({
      entityType: 'trip', id: U(tkey), name: `Open rit ${o.id}`, status: 'requested', transportMode: 'road', creationDate: o.bekend !== null ? iso(o.bekend) : undefined,
      actors: [refRol(carrierU, ['carrier']), o.klant && o.klant !== 'Simon Loos' ? refRol(klantU(o.klant), ['shipper']) : null].filter(Boolean),
      actions: acts,
      constraint: eisen.length ? inl({ value: eisen.length > 1 ? { type: 'andConstraint', and: eisen } : eisen[0], enforceability: 'enforced' }) : undefined,
      externalIdentifiers: [eid(o.id, SCHEMA.open)],
      externalAttributes: { [SL]: schoon({ standplaats: o.standplaats, divisie: o.divisie, klant: o.klant, soort: o.soort, oplegger: o.oplegger, dag: o.dag, reden: o.reden, duur: o.duur, km: o.km }) },
    }));
  }

  // gebeurtenissen tot T: bewegen en wachten als eigen OTM-event, de rest als updateEvent op de geplande actie (zelfde UUID,
  // lifecycle actual bij het begin, realized bij het einde), met de positie als contextEvent (OTM: "context events")
  const events = [];
  v.events.forEach((e, i) => {
    const id = U(`ev:${datum}:${e.voertuig}:${i}:${e.soort}:${tk(e.t)}`); const veh = ref('vehicle', voertuigU(e.voertuig)); const g = geo(e.lat, e.lon);
    const { voertuig, t, soort, lat, lon, ...rest } = e;
    const extra = { [SL]: schoon({ voertuig, soort, ...rest }) };
    if (BEWEGING[soort]) { events.push({ eventType: BEWEGING[soort], id, creationDate: iso(t), lifecycle: 'actual', vehicle: veh, geoReference: g, externalAttributes: extra }); return; }
    const type = EVENT_ACTIE(soort, e.wat); if (!type) return;
    const eind = /_eind$/.test(soort);
    const gepland = actieIndex.get(`${voertuig}|${e.rit ?? null}|${type}|${eind ? 'e' : 's'}${tk(t)}`);
    const entity = schoon({ entityType: type, id: gepland || U(`ev-actie:${datum}:${voertuig}:${i}`), lifecycle: eind ? 'realized' : 'actual',
      startTime: eind ? undefined : iso(t), endTime: eind ? iso(t) : undefined,
      location: e.plek && !String(e.plek).startsWith('onderweg') && plekById.has(e.plek) ? (e.dock ? dockRef(e.plek, e.dock) : ref('location', plekU(e.plek))) : undefined,
      vehicle: ['attachTransportEquipment', 'detachTransportEquipment', 'refuel'].includes(type) ? veh : undefined,
      transportEquipment: e.oplegger && (type === 'attachTransportEquipment' || type === 'detachTransportEquipment') ? ref('goods', opleggerU(e.oplegger)) : undefined });
    events.push({ eventType: 'updateEvent', id, creationDate: iso(t), lifecycle: 'actual', entity,
      contextEvents: [{ eventType: 'locationUpdateEvent', id: U(`ctx:${id}`), creationDate: iso(t), lifecycle: 'actual', vehicle: veh, geoReference: g }], externalAttributes: extra });
  });
  // posities om T: locationUpdateEvent per voertuig, zoals een boordcomputer (OTM-profiel FMS) ze stuurt
  for (const p of v.posities) events.push({ eventType: 'locationUpdateEvent', id: U(`pos:${datum}:${v.T}:${p.voertuig}`), creationDate: iso(v.T), lifecycle: 'actual', vehicle: ref('vehicle', voertuigU(p.voertuig)),
    geoReference: { ...geo(p.lat, p.lon), speed: { value: p.snelheid, unit: 'km/h' }, heading: { value: p.koers, unit: 'degrees' } }, externalAttributes: { [SL]: schoon({ voertuig: p.voertuig, st: p.st }) } });

  return { otmVersie: OTM_VERSIE, datum, tijdstip: v.T === null ? null : iso(v.T), bron: opts.bron || 'Simon Loos Control Tower (gesimuleerde dag)',
    locations, actors, vehicles, transportEquipment, consignments, trips, events };
}

// ======================================================================================================================
// 3. OTM5 terug naar onze vorm
// ======================================================================================================================
const LIFECYCLE_ORDE = ['requested', 'planned', 'projected', 'actual', 'realized'];
const EXT = e => (e && e.externalAttributes && typeof e.externalAttributes[SL] === 'object' && e.externalAttributes[SL]) || null;
const eigenId = (e, scheme) => { const x = e && Array.isArray(e.externalIdentifiers) ? e.externalIdentifiers.find(y => y && y.scheme === scheme) : null; return x ? x.id : null; };
const LOCSOORT = { operationalBase: 'standplaats', store: 'winkel', warehouse: 'dc', customer: 'klant', serviceStation: 'pauzeplek', fuelStation: 'tankstation' };
const VSOORT = { tractor: 'trekker', truck: 'bakwagen', van: 'bus' };

/**
 * Een OTM5-document terug naar onze vorm. Leest onze bundel, een lijst entiteiten, of een losse trip (ook van een ander
 * systeem: dan zonder onze extra's). Gooit geen fout op onbekende of ontbrekende velden; wat niet te lezen is, staat in
 * `waarschuwingen`.
 * @param {object|object[]} doc
 * @param {{ datum?: string }} [opts]
 * @returns {OnzeVorm}
 */
export function vanOtm5(doc, opts = {}) {
  const waarschuwingen = [];
  const lijsten = { locations: [], actors: [], vehicles: [], goods: [], consignments: [], trips: [], events: [] };
  const soortVan = e => e && (e.eventType ? 'events' : e.entityType === 'trip' || (!e.entityType && Array.isArray(e.actions) && !e.actionType) ? 'trips'
    : e.entityType === 'location' ? 'locations' : e.entityType === 'actor' ? 'actors' : e.entityType === 'vehicle' ? 'vehicles'
      : e.entityType === 'goods' || e.type === 'transportEquipment' ? 'goods' : e.entityType === 'consignment' ? 'consignments' : null);
  if (Array.isArray(doc)) for (const e of doc) { const s = soortVan(e); if (s) lijsten[s].push(e); else waarschuwingen.push('onbekende entiteit overgeslagen'); }
  else if (doc && typeof doc === 'object' && (doc.trips || doc.vehicles || doc.locations || doc.events)) {
    for (const [k, s] of [['locations', 'locations'], ['actors', 'actors'], ['vehicles', 'vehicles'], ['transportEquipment', 'goods'], ['goods', 'goods'], ['consignments', 'consignments'], ['trips', 'trips'], ['events', 'events']])
      if (Array.isArray(doc[k])) lijsten[s].push(...doc[k]);
  } else if (doc && typeof doc === 'object') { const s = soortVan(doc); if (s) lijsten[s].push(doc); else waarschuwingen.push('document zonder herkenbare OTM5-entiteit'); }

  // alles wat inline staat ook verzamelen (de eerste versie van een id wint; een latere lifecycle overschrijft niet)
  const byId = new Map(); const inLijst = new Set(Object.values(lijsten).flat());
  const zie = (e, soort) => {
    if (!e || typeof e !== 'object') return;
    if (e.id && !byId.has(e.id)) byId.set(e.id, e);
    if (soort && e.id && !inLijst.has(e)) { lijsten[soort].push(e); inLijst.add(e); }
    for (const [k, val] of Object.entries(e)) {
      if (k === 'externalAttributes' || k === 'geoReference') continue;
      const arr = Array.isArray(val) ? val : [val];
      for (const a of arr) {
        if (!a || typeof a !== 'object') continue;
        if (a.associationType === 'inline' && a.entity) zie(a.entity, k === 'subLocations' ? null : soortVan(a.entity) || (k === 'location' || k === 'from' || k === 'to' ? 'locations' : k === 'vehicle' ? 'vehicles' : k === 'consignment' ? 'consignments' : k === 'transportEquipment' || k === 'goods' ? 'goods' : k === 'actors' ? 'actors' : null));
        else if (k === 'contextEvents' || k === 'entity') zie(a, null);
      }
    }
  };
  for (const [soort, l] of Object.entries(lijsten)) for (const e of [...l]) zie(e, soort === 'events' ? null : soort);
  const los = a => !a || typeof a !== 'object' ? null : a.associationType === 'inline' ? a.entity || null : a.associationType === 'reference' ? byId.get(a.uuid) || { id: a.uuid, _onbekend: true } : null;

  // datum: meegegeven, uit de bundel, of de vroegste tijd in het document
  let datum = opts.datum || (doc && !Array.isArray(doc) && typeof doc.datum === 'string' ? doc.datum : null);
  if (!datum) {
    let min = Infinity; const kijk = o => { if (!o || typeof o !== 'object') return; for (const [k, val] of Object.entries(o)) { if ((k === 'startTime' || k === 'endTime' || k === 'creationDate') && typeof val === 'string') { const ms = Date.parse(val); if (ms < min) min = ms; } else if (typeof val === 'object') kijk(val); } };
    kijk(lijsten.trips); kijk(lijsten.events);
    datum = Number.isFinite(min) ? vandaagAmsterdam(min) : vandaagAmsterdam();
  }
  const mins = iso => minutenVan(iso, datum);

  // plekken en docks
  const plekVanLoc = new Map(); const dockVanLoc = new Map(); const plekken = [];
  for (const l of lijsten.locations) {
    if (plekVanLoc.has(l.id)) continue;
    const ext = EXT(l) || {}; const id = eigenId(l, SCHEMA.plek) || l.id || l.name || null; if (!id) continue;
    const g = l.geoReference && l.geoReference.type === 'latLonPointGeoReference' ? l.geoReference : null;
    const docks = [];
    for (const a of l.subLocations || []) {
      const d = los(a); if (!d) continue; const dId = eigenId(d, SCHEMA.dock); const nr = dId && /#(\d+)$/.test(dId) ? Number(/#(\d+)$/.exec(dId)[1]) : docks.length + 1;
      const dg = d.geoReference && d.geoReference.type === 'latLonPointGeoReference' ? d.geoReference : g;
      docks.push({ nr, lat: dg ? dg.lat : null, lon: dg ? dg.lon : null }); if (d.id) dockVanLoc.set(d.id, { plek: id, nr });
    }
    const ar = l.administrativeReference || null;
    plekVanLoc.set(l.id, id);
    plekken.push(schoon({ id, naam: l.name || id, soort: ext.soort || LOCSOORT[l.type] || l.otherLocationType || l.type || 'onbekend', lat: g ? g.lat : null, lon: g ? g.lon : null,
      plaats: ext.plaats || (ar && ar.city) || null, formule: ext.formule || null,
      adres: ar && ar.street ? { straat: ar.street, nr: ar.houseNumber, postcode: ar.postalCode, plaats: ar.city } : null, docks: docks.length ? docks : undefined }));
  }
  const plekVan = a => { const l = los(a); if (!l) return null; if (dockVanLoc.has(l.id)) return dockVanLoc.get(l.id).plek; return plekVanLoc.get(l.id) || eigenId(l, SCHEMA.plek) || l.id || null; };
  const dockVan = a => { const l = los(a); return l && dockVanLoc.has(l.id) ? dockVanLoc.get(l.id).nr : null; };

  // voertuigen, opleggers, actoren
  const voertuigVanId = new Map(); const voertuigen = []; const blokken = [];
  const opleggerVanId = new Map(); const opleggers = [];
  const actorVanId = new Map(); const chauffeurs = [];
  for (const g of lijsten.goods) {
    if (g.type !== 'transportEquipment' || opleggerVanId.has(g.id)) continue;
    const ext = EXT(g) || {}; const id = eigenId(g, SCHEMA.oplegger) || g.name || g.licensePlate || g.id; opleggerVanId.set(g.id, id);
    const c = los(g.constraint); const tv = c && c.value && c.value.type === 'temperatureConstraint' ? c.value : null;
    const st = ext.status || null;
    opleggers.push({ id, kenteken: g.licensePlate || eigenId(g, SCHEMA.kenteken) || null, soort: g.equipmentSubType || g.equipmentType || null,
      temp: ext.temp || (tv && tv.minimum && tv.maximum ? [tv.minimum.value, tv.maximum.value] : null), standplaats: ext.standplaats ?? null, divisie: ext.divisie ?? null, bouwjaar: ext.bouwjaar ?? null,
      onderhoud: !!ext.onderhoud, status: st ? { st: st.st, plek: st.plek ?? null, voertuig: st.voertuig ?? null, geladen: !!st.geladen, sinds: st.sinds ? mins(st.sinds) : null } : null });
  }
  const opleggerVan = a => { const g = los(a); return g ? opleggerVanId.get(g.id) || eigenId(g, SCHEMA.oplegger) || g.name || g.id : null; };
  for (const v of lijsten.vehicles) {
    if (voertuigVanId.has(v.id)) continue;
    const ext = EXT(v) || {}; const id = eigenId(v, SCHEMA.voertuig) || v.name || v.licensePlate || v.id; voertuigVanId.set(v.id, id);
    const fuels = Array.isArray(v.fuels) ? v.fuels.map(f => f && f.fuelType) : v.fuel ? [String(v.fuel).toLowerCase()] : [];
    let gekoppeld = null;
    (v.actions || []).forEach(a => {
      const x = los(a); if (!x) return; const e2 = EXT(x) || {};
      if (x.actionType === 'attachTransportEquipment' && x.lifecycle === 'actual') { gekoppeld = opleggerVan(x.transportEquipment); return; }
      blokken.push({ voertuig: id, k: e2.k || ({ break: 'pauze', refuel: 'laden', move: 'drive', stop: 'stop', wait: 'wacht' }[x.actionType] || x.actionType), t0: mins(x.startTime), t1: mins(x.endTime),
        dienst: e2.dienst ?? null, reden: e2.reden ?? null, bij: e2.bij ?? null, plek: plekVan(x.location) });
    });
    voertuigen.push({ id, kenteken: v.licensePlate || eigenId(v, SCHEMA.kenteken) || null, soort: ext.soort || VSOORT[v.vehicleType] || v.vehicleType || null, model: ext.model ?? null,
      elektrisch: fuels.includes('electricity'), bereikKm: ext.bereikKm ?? null, standplaats: ext.standplaats ?? null, divisie: ext.divisie ?? null, vandaag: ext.vandaag ?? null,
      klant: ext.klant ?? null, lzv: !!ext.lzv, oplegger: gekoppeld });
  }
  const voertuigVan = a => { const v = los(a); return v ? voertuigVanId.get(v.id) || eigenId(v, SCHEMA.voertuig) || v.name || v.licensePlate || v.id : null; };
  for (const a of lijsten.actors) {
    if (actorVanId.has(a.id)) continue;
    const nr = eigenId(a, SCHEMA.chauffeur);
    actorVanId.set(a.id, nr || eigenId(a, SCHEMA.klant) || a.name || a.id);
    if (nr) chauffeurs.push({ id: nr, standplaats: (EXT(a) || {}).standplaats ?? null });
  }
  const actorMetRol = (trip, rol) => (trip.actors || []).filter(x => x && Array.isArray(x.roles) && x.roles.includes(rol)).map(x => los(x)).filter(Boolean);
  const omschrijving = c => c ? c.description || (Array.isArray(c.goods) && c.goods.map(los).filter(Boolean).map(g => g.description).find(Boolean)) || null : null;
  const zendingVan = a => omschrijving(los(a));
  // zendingen die naar acties van een trip verwijzen (drop & swap), of die ons ritnummer dragen
  const zendingVanActie = new Map(), zendingVanRit = new Map();
  for (const c of lijsten.consignments) {
    for (const a of c.actions || []) { const x = a && (a.associationType === 'reference' ? a.uuid : a.entity && a.entity.id); if (x && !zendingVanActie.has(x)) zendingVanActie.set(x, omschrijving(c)); }
    const rit = eigenId(c, SCHEMA.rit); if (rit && !zendingVanRit.has(rit)) zendingVanRit.set(rit, omschrijving(c));
  }

  // acties van een trip, samengevoegd per id (dezelfde actie in meer lifecycles: geplande tijden blijven, de rest komt erbij)
  const samenvoegen = lijst => {
    const per = new Map();
    for (const a of lijst) {
      const x = los(a); if (!x) continue; const id = x.id || `${x.actionType}:${x.sequenceNr}:${x.startTime}`;
      if (!per.has(id)) per.set(id, { plan: null, laatst: null, alle: [] });
      const g = per.get(id); g.alle.push(x);
      if (!g.plan || (x.lifecycle === 'planned' && g.plan.lifecycle !== 'planned')) g.plan = x;   // het plan: de geplande versie, anders de eerste
      if (!g.laatst || LIFECYCLE_ORDE.indexOf(x.lifecycle) > LIFECYCLE_ORDE.indexOf(g.laatst.lifecycle)) g.laatst = x;
    }
    return [...per.values()].map(g => ({ ...g.plan, _laatst: g.laatst, _alle: g.alle }));
  };
  const orde = (a, b) => (a.sequenceNr ?? 1e9) - (b.sequenceNr ?? 1e9) || (Date.parse(a.startTime) || 0) - (Date.parse(b.startTime) || 0);
  const venster = c => { const x = los(c); const val = x && x.value; const tw = !val ? null : val.type === 'timeWindowConstraint' ? val : val.type === 'andConstraint' ? (val.and || []).find(y => y && y.type === 'timeWindowConstraint') : null; return tw && tw.startTime && tw.endTime ? [mins(tw.startTime), mins(tw.endTime)] : null; };

  const ritten = [], open = [], dienstMap = new Map();
  for (const trip of lijsten.trips) {
    const ext = EXT(trip); const ons = !!ext; const x = ext || {};
    const acts = samenvoegen(trip.actions || []).sort(orde);
    const stops = acts.filter(a => a.actionType === 'stop'), moves = acts.filter(a => a.actionType === 'move');
    const veh = trip.vehicle ? voertuigVan(trip.vehicle) : null;
    const klantActor = actorMetRol(trip, 'shipper')[0]; const klant = x.klant ?? (klantActor ? klantActor.name || actorVanId.get(klantActor.id) || null : null);
    if (!veh && ['requested', 'draft', undefined].includes(trip.status)) {
      const tus = ons ? stops.slice(1, -1) : stops; const eisen = los(trip.constraint);
      const lijstEisen = eisen && eisen.value ? (eisen.value.type === 'andConstraint' ? eisen.value.and || [] : [eisen.value]) : [];
      const vt = lijstEisen.find(y => y && y.type === 'vehicleTypeConstraint'), et = lijstEisen.find(y => y && y.type === 'transportEquipmentTypeConstraint');
      let vs = stops.length ? venster(stops[0].constraint) : null; const morgen = vs && vs[0] >= 1440;
      const dag = x.dag || (morgen ? 'morgen' : 'vandaag'); if (vs && dag === 'morgen') vs = [vs[0] - 1440, vs[1] - 1440];
      open.push({ id: eigenId(trip, SCHEMA.open) || trip.name || trip.id, standplaats: x.standplaats ?? (stops[0] ? (plekVan(stops[0].location) || '').replace(/^sp:/, '') : null), divisie: x.divisie ?? null, klant,
        soort: x.soort ?? (vt && vt.vehicleTypes ? VSOORT[vt.vehicleTypes[0]] || vt.vehicleTypes[0] : null), oplegger: x.oplegger ?? (et && et.subEquipmentTypes ? et.subEquipmentTypes[0] : null),
        dag, reden: x.reden ?? null, bekend: trip.creationDate ? mins(trip.creationDate) : null, venster: vs, duur: x.duur ?? null, km: x.km ?? null,
        stops: tus.map(s => ({ plek: plekVan(s.location), naam: s.name || (los(s.location) || {}).name || '', km: (EXT(s) || {}).km ?? null })) });
      continue;
    }
    const id = eigenId(trip, SCHEMA.rit) || trip.name || trip.id;
    const driver = actorMetRol(trip, 'driver')[0]; const chauffeur = driver ? actorVanId.get(driver.id) || eigenId(driver, SCHEMA.chauffeur) || driver.id : null;
    const s0 = stops[0], sN = stops[stops.length - 1];
    const tus = ons ? stops.slice(1, -1) : stops;
    const kind = (s, types) => samenvoegen(s && s.actions || []).filter(a => types.includes(a.actionType)).sort(orde);
    const pauzes = [];
    const pak = s => { for (const p of kind(s, ['break', 'refuel'])) { const e2 = EXT(p) || {}; pauzes.push({ soort: p.actionType === 'refuel' ? 'laden' : 'pauze', t0: mins(p.startTime), t1: mins(p.endTime), bij: e2.bij ?? null, deel: e2.deel ?? null }); } };
    for (const s of [...stops, ...moves]) pak(s);
    pauzes.sort((a, b) => a.t0 - b.t0);
    const dockblok = (s, eerste) => {
      if (!ons) return null; const [b] = kind(s, eerste ? ['attachTransportEquipment', 'load'] : ['detachTransportEquipment', 'unload']); if (!b) return null;
      const k = b.actionType === 'attachTransportEquipment' ? 'koppel' : b.actionType === 'detachTransportEquipment' ? 'ontkoppel' : eerste ? 'laden' : 'retour';
      return { k, t0: mins(b.startTime), t1: mins(b.endTime), dock: dockVan(b.location), oplegger: b.transportEquipment ? opleggerVan(b.transportEquipment) : null };
    };
    const vb = dockblok(s0, true), ab = dockblok(sN, false);
    const rijstukken = moves.map(m => ({ van: plekVan(m.from), naar: plekVan(m.to), start: mins(m.startTime), eind: mins(m.endTime), km: m.distance ? m.distance.value : null, vertraging: (EXT(m) || {}).vertraging || 0 }));
    let lading = null;
    const stopVorm = tus.map(s => {
      const e2 = EXT(s) || {}; const n = kind(s, ['wait', 'unload', 'load', 'detachTransportEquipment', 'attachTransportEquipment']);
      const w = n.find(a => a.actionType === 'wait'); const ul = n.find(a => a.actionType === 'unload' || a.actionType === 'load');
      const af = n.find(a => a.actionType === 'detachTransportEquipment'); const mee = n.find(a => a.actionType === 'attachTransportEquipment');
      if (!lading && ul && ul.consignment) lading = zendingVan(ul.consignment);
      const aankomst = mins(s.startTime); const wacht = e2.wacht ?? (w ? mins(w.endTime) - mins(w.startTime) : 0);
      const klaar = ul ? mins(ul.endTime) : mee ? mins(mee.endTime) : af ? mins(af.endTime) : mins(s.endTime);
      const actie = e2.actie || (af ? 'wisselen' : mee ? 'ophalen' : ul && ul.actionType === 'load' ? 'laden' : 'lossen');
      const gerealiseerd = s._alle.filter(y => y.lifecycle === 'realized' || y.lifecycle === 'actual').map(y => ({ aankomst: mins(y.startTime), vertrek: mins(y.endTime) })).pop();
      return schoon({ plek: plekVan(s.location), naam: s.name || (los(s.location) || {}).name || '', aankomst, klaar, vertrek: mins(s.endTime), venster: venster(s.constraint),
        wacht, los: klaar !== null && aankomst !== null ? klaar - aankomst - wacht : null, actie, km: e2.km ?? null,
        af: af && af.transportEquipment ? opleggerVan(af.transportEquipment) : null, mee: mee && mee.transportEquipment ? opleggerVan(mee.transportEquipment) : null,
        gerealiseerd: gerealiseerd || undefined });
    });
    if (!lading) for (const s of stops) for (const a of kind(s, ['load', 'unload'])) if (!lading && a.consignment) lading = zendingVan(a.consignment);
    if (!lading) for (const s of stops) for (const a of kind(s, ['attachTransportEquipment', 'detachTransportEquipment'])) if (!lading && zendingVanActie.has(a.id)) lading = zendingVanActie.get(a.id);
    if (!lading) lading = zendingVanRit.get(id) || null;
    if (ons) for (const s of stopVorm) { if (s.af === undefined) s.af = null; if (s.mee === undefined) s.mee = null; if (s.venster === undefined) s.venster = null; if (s.km === undefined) s.km = null; }
    const begin = s0 ? mins(s0.startTime) : null, einde = sN ? mins(sN.endTime) : null;
    const nr = x.nr ?? null, dienst = x.dienst ?? null;
    if (veh !== null && dienst !== null && x.dienstStart) { const key = `${veh}#${dienst}`; if (!dienstMap.has(key)) dienstMap.set(key, { id: key, voertuig: veh, nr: dienst, chauffeur, start: mins(x.dienstStart), eind: mins(x.dienstEind), rijMin: x.dienstRijMin ?? null }); }
    ritten.push({
      id, voertuig: veh ?? x.voertuig ?? null, nr, dienst, chauffeur, standplaats: x.standplaats ?? null, klant, km: x.km ?? r1(rijstukken.reduce((a, m) => a + (m.km || 0), 0)),
      status: x.status || STATUS_TERUG[trip.status] || 'gepland', begin, einde,
      vertrek: rijstukken.length ? rijstukken[0].start : s0 ? mins(s0.endTime) : null, terug: rijstukken.length ? rijstukken[rijstukken.length - 1].eind : sN ? mins(sN.startTime) : null,
      oplegger: vb && vb.k === 'koppel' ? vb.oplegger : null, lading, dockVertrek: vb ? vb.dock : null, dockAankomst: ab ? ab.dock : null,
      start: s0 ? plekVan(s0.location) : null, eindPlek: sN ? plekVan(sN.location) : null, vertrekBlok: vb, aankomstBlok: ab, stops: stopVorm, rijstukken, pauzes,
    });
  }

  // gebeurtenissen en posities
  const events = [], posities = [];
  const SOORT = { startMovingEvent: 'vertrek', stopMovingEvent: 'aankomst', startWaitingEvent: 'wacht' };
  const ACT_SOORT = { unload: ['los_start', 'los_eind'], load: ['laad_start', 'laad_eind'], refuel: ['laad_start', 'laad_eind'], attachTransportEquipment: ['koppel', 'koppel'],
    detachTransportEquipment: ['ontkoppel', 'ontkoppel'], break: ['pauze_start', 'pauze_eind'] };
  for (const e of lijsten.events) {
    const ext = EXT(e) || {}; const t = mins(e.creationDate);
    if (e.eventType === 'locationUpdateEvent') {
      const g = e.geoReference || {};
      posities.push({ voertuig: ext.voertuig || voertuigVan(e.vehicle), lat: g.lat ?? null, lon: g.lon ?? null, koers: g.heading ? g.heading.value : 0, snelheid: g.speed ? g.speed.value : 0, st: ext.st ?? null });
      continue;
    }
    const ctx = Array.isArray(e.contextEvents) ? e.contextEvents.find(c => c && c.geoReference) : null;
    const g = e.geoReference || (ctx && ctx.geoReference) || {};
    const ent = e.entity || null;
    let soort = ext.soort || SOORT[e.eventType] || null;
    if (!soort && ent && ACT_SOORT[ent.entityType || ent.actionType]) soort = ACT_SOORT[ent.entityType || ent.actionType][ent.lifecycle === 'realized' ? 1 : 0];
    if (!soort) { waarschuwingen.push(`event ${e.eventType || '?'} zonder soort overgeslagen`); continue; }
    const voertuig = ext.voertuig || voertuigVan(e.vehicle) || (ctx ? voertuigVan(ctx.vehicle) : null) || (ent ? voertuigVan(ent.vehicle) : null);
    const { voertuig: _v, soort: _s, ...rest } = ext;
    const basis = { voertuig, t, soort, plek: ext.plek ?? (ent ? plekVan(ent.location) : null), naam: ext.naam ?? '', rit: ext.rit ?? null };
    if (!ext.soort && ent && ent.transportEquipment) basis.oplegger = opleggerVan(ent.transportEquipment);
    events.push({ ...basis, ...rest, lat: g.lat ?? null, lon: g.lon ?? null });
  }
  const T = doc && !Array.isArray(doc) && typeof doc.tijdstip === 'string' ? mins(doc.tijdstip) : null;
  return { bron: 'otm5', datum, T, plekken, voertuigen, opleggers, chauffeurs, diensten: [...dienstMap.values()], ritten, blokken, open, events, posities, waarschuwingen };
}
