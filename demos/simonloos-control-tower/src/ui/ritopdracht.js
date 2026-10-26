// De ritopdracht naar de boordcomputer (Control Tower 4.1, bouwsteen E). Per rit een OTM5-trip met de stops, tijden en
// vensters, het laadadres (de standplaats of het DC met adres en dock), de oplegger, het voertuig en de chauffeur als
// personeelsnummer (geen naam: dataminimalisatie). Gemaakt met src/otm5.js (uitFleet en naarOtm5Van, dezelfde vertaling
// als de rest van de OTM5-koppeling); per rit een eigen bericht met alles waar de trip naar verwijst, zodat het los te
// versturen en te lezen is. Exporteren: één bestand per standplaats, in de vorm die tests/otm5-check.mjs --bestand leest.
// Er gaat niets de deur uit: de download maakt de browser zelf (een blob). Welke boordcomputer en welke koppeling (Trimble
// of een andere) bepalen we met ICT: README, "Open vragen voor ICT".
import { uitFleet, naarOtm5Van, isoTijd, OTM_VERSIE } from '../otm5.js';

const SL = 'simonloos';
const LIJSTEN = ['locations', 'actors', 'vehicles', 'transportEquipment', 'consignments'];
const BRON = 'Simon Loos Control Tower, ritopdracht naar de boordcomputer (gesimuleerd)';
// het nummer van een rit in de routes van zijn voertuig (1, 2, ...): zo heet hij in src/otm5.js ("T-1002/1")
const otmId = r => { const n = r.t.routes.indexOf(r.routes[0]) + 1; return n > 0 ? `${r.t.id}/${n}` : null; };

// alle verwijzingen (uuid) in een entiteit, ook in wat er inline in staat
function verwijzingen(o, uit = new Set()) {
  if (!o || typeof o !== 'object') return uit;
  if (Array.isArray(o)) { for (const x of o) verwijzingen(x, uit); return uit; }
  if (o.associationType === 'reference' && o.uuid) uit.add(o.uuid);
  for (const [k, v] of Object.entries(o)) if (k !== 'externalAttributes') verwijzingen(v, uit);
  return uit;
}
// elk id in een entiteit (ook inline: een dock is een sublocatie van zijn standplaats) naar de entiteit zelf
function index(doc) {
  const top = new Map();
  const walk = (o, lijst, e) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { for (const x of o) walk(x, lijst, e); return; } if (typeof o.id === 'string' && !top.has(o.id)) top.set(o.id, [lijst, e]); for (const [k, v] of Object.entries(o)) if (k !== 'externalAttributes') walk(v, lijst, e); };
  for (const l of LIJSTEN) for (const e of doc[l] || []) walk(e, l, e);
  return top;
}

/**
 * Ritopdrachten voor een lijst ritten. items: [{ r, versie, T, dienst, akkoord }] met r een rit uit ritten.js, T het moment
 * van versturen (minuten van de dag), akkoord het moment van het akkoord van de chauffeur (of null).
 * Geeft een Map van ritnummer (R-10213) naar het bericht: { otmVersie, soort, rit, versie, datum, tijdstip, bron, trips: [trip],
 * locations, actors, vehicles, transportEquipment, consignments }.
 */
export function ritopdrachten(fleet, items, datum, T) {
  const uit = new Map(); if (!items.length) return uit;
  const v = uitFleet(fleet, T, { datum, voertuigen: [...new Set(items.map(x => x.r.t.id))], events: false });
  // alleen het plan: geen losse blokken, open ritten, gebeurtenissen, posities of de oplegger van dit moment
  v.blokken = []; v.open = []; v.events = []; v.posities = []; for (const x of v.voertuigen) x.oplegger = null;
  const doc = naarOtm5Van(v, { bron: BRON });
  const top = index(doc);
  const tripVan = new Map(doc.trips.map(tr => [((tr.externalIdentifiers || []).find(x => x.scheme === 'simonloos:rit') || {}).id, tr]));
  for (const it of items) {
    const id = otmId(it.r); const trip0 = id && tripVan.get(id); if (!trip0) continue;
    const trip = JSON.parse(JSON.stringify(trip0));
    trip.externalIdentifiers = [...(trip.externalIdentifiers || []), { id: it.r.id, scheme: 'simonloos:ritnummer' }];
    const ext = trip.externalAttributes[SL];
    ext.ritnummer = it.r.id;
    ext.ritopdracht = { versie: it.versie, verstuurd: isoTijd(datum, it.T), dienst: it.dienst, ...(it.akkoord !== null && it.akkoord !== undefined ? { akkoordChauffeur: isoTijd(datum, it.akkoord) } : {}) };
    const msg = { otmVersie: OTM_VERSIE, soort: 'ritopdracht', rit: it.r.id, versie: it.versie, datum, tijdstip: isoTijd(datum, it.T), bron: BRON, trips: [trip] };
    for (const l of LIJSTEN) msg[l] = [];
    const gezien = new Set(); const rij = [...verwijzingen(trip)];
    while (rij.length) {
      const u = rij.pop(); const x = top.get(u); if (!x || gezien.has(x[1])) continue;
      gezien.add(x[1]); msg[x[0]].push(x[1]); for (const w of verwijzingen(x[1])) rij.push(w);
    }
    uit.set(it.r.id, msg);
  }
  return uit;
}

// Eén bestand per standplaats: alle ritopdrachten samen, elke entiteit een keer (dezelfde vorm als naarOtm5).
export function bundel(msgs, { standplaats, datum, T }) {
  const out = { otmVersie: OTM_VERSIE, soort: 'ritopdrachten', standplaats, datum, tijdstip: isoTijd(datum, T), bron: BRON, trips: [] };
  for (const l of LIJSTEN) out[l] = [];
  const ids = new Set();
  for (const m of msgs) { for (const tr of m.trips) out.trips.push(tr); for (const l of LIJSTEN) for (const e of m[l]) if (!ids.has(e.id)) { ids.add(e.id); out[l].push(e); } }
  return out;
}

// de browser maakt het bestand zelf (blob); er gaat geen verzoek naar buiten. Een rit leesbaar ingesprongen, de export
// van een standplaats compact (honderden ritten: een paar MB in plaats van meer dan tien)
export function bewaar(naam, obj, compact = false) {
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([(compact ? JSON.stringify(obj) : JSON.stringify(obj, null, 2)) + '\n'], { type: 'application/json' })); a.download = naam;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
  } catch { return false; }
}
