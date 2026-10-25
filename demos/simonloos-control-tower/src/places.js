// Standplaatsen (werkenbijsimonloos.nl, oktober 2026), klanten (winkels en DC's uit Overture Places), steden en vaste lijsten.
// Bronnen en werkwijze: src/data/BRONNEN.md.
import P from './data/places.json';
import K from './data/klanten.json';
import TOEGANG from './data/toegang.json';
import { decode } from './roads.js';

// { n, lat, lon, div[], klant, vac, hub, wh, note, fleet, prov, regio } plus het echte adres en terrein:
// adres { straat, nr, postcode, plaats }, bron (vacature-URL), datum, adresNoot (alleen bij een benadering),
// node (knoop in de routeergraaf), toegang (polyline van die knoop over echte straten naar de poort), poort [lon, lat],
// terrein [[lon, lat], ...] (ring), terreinBron, hal [[lon, lat], ...] (hoofdgebouw), rijen [[lon0, lat0, lon1, lat1, n, koers], ...]
// (parkeerrijen: n plekken van lon0/lat0 tot lon1/lat1, voertuigen met de neus in de koers), formules (winkelritten),
// laad (id van een DC waar de winkelritten eerst laden), pendel (id van een DC waar de helft van de winkelritten als pendel heen gaat).
export const SP = P.SP;
export const TOWNS = P.TOWNS;    // { n, lat, lon, big }
export const CITIES = P.CITIES;  // { n, lat, lon, r } r = 1 groot ... 4 dorp
// Winkels per formule: { id, formule, naam, plaats, lon, lat, node, eiland? } (eiland: geen wegverbinding, Waddeneilanden).
export const WINKELS = K.stores;
// DC's, fabrieken en groothandels: { id, naam, formule, plaats, lon, lat, node, soort: 'dc' | 'fabriek' | 'groothandel', sp?, adres?, terrein?, poort? }
// (sp: de standplaats op hetzelfde terrein).
export const DCS = K.dcs;
// Bezorgpunten voor de boodschappenbezorging: woonstraten (straatniveau, geen huisnummer) { id, naam, plaats, lon, lat, node, sp }.
export const BEZORG = P.BEZORG || [];
export const FORMULES = ['Albert Heijn', 'Jumbo', 'Plus', 'Lidl', 'SPAR', 'Vomar', 'Aldi', 'Dirk', 'Etos'];
export const winkelById = new Map(WINKELS.map(w => [w.id, w]));
export const dcById = new Map(DCS.map(d => [d.id, d]));
export const spByName = new Map(SP.map(s => [s.n, s]));
// Toegangsroute van een plek (standplaats, winkel, DC, bezorgpunt): [[lon, lat], ...] van zijn knoop in de routeergraaf
// over echte straten tot de poort (standplaats, DC) of tot de weg voor de deur (winkel); null als er geen is.
export function toegangVan(p) {
  if (!p) return null;
  if (p._toegang === undefined) { const s = p.toegang || (p.id && TOEGANG[p.id]); p._toegang = s ? decode(s) : null; }
  return p._toegang;
}
// Gebouwen rond standplaatsen en DC's voor de 3D-wereld: pas laden als ze nodig zijn (eigen bundel buildings.js).
// Geeft { "<standplaats of dc-id>": [{ p, h, d? }] }, zie src/buildings.js.
export const laadGebouwen = () => import('./buildings.js').then(m => m.default);
// Naam van een plek voor een stop: winkel of DC met plaats ("Albert Heijn Laat, Alkmaar"), standplaats als "Simon Loos Tiel".
export function plekNaam(p) {
  if (!p) return '';
  if (p.fleet !== undefined) return `Simon Loos ${p.n}`;
  const n = p.naam || p.n || ''; const pl = p.plaats || '';
  return pl && !n.toLowerCase().includes(pl.toLowerCase()) ? `${n}, ${pl}` : n;
}
export const REGIOS = ['Noord-Holland', 'Randstad Zuid', 'Oost', 'Noord', 'Zuid'];
export const DIV = {
  winkel: { n: 'Winkeldistributie', color: '#FCC41F' },
  netwerk: { n: 'Netwerktransport', color: '#E3001F' },
  bulk: { n: 'Bulktransport', color: '#FF8A3D' },
  dranken: { n: 'Drankenlogistiek', color: '#4FC3F7' },
  bezorg: { n: 'Boodschappenbezorging', color: '#B388FF' },
};
export const ST = {
  onderweg: { n: 'Onderweg', color: '#16A34A', light: '#DCFCE7' },
  klant: { n: 'Bij klant', color: '#2563EB', light: '#DBEAFE' },
  pauze: { n: 'Pauze', color: '#D97706', light: '#FEF3C7' },
  vertraagd: { n: 'Vertraagd', color: '#DC2626', light: '#FEE2E2' },
  terrein: { n: 'Op terrein', color: '#9CA3AF', light: '#F3F4F6' },
};
export const ROLES = {
  planner: { n: 'Planner', sub: 'standplaats' },
  regiomanager: { n: 'Regiomanager', sub: 'regio' },
  directie: { n: 'Directie', sub: 'heel Simon Loos' },
  hr: { n: 'HR', sub: 'personeel' },
};
// Wat een rol mag zien (uit het ontwerpdocument Control Tower 2.0; beheerscherm en audit-log volgen later).
export const CAN = {
  kosten: ['regiomanager', 'directie'],
  rijden: ['regiomanager', 'directie', 'hr'],
  schades: ['regiomanager', 'directie', 'hr'],
  contract: ['directie', 'hr'],
  nood: ['regiomanager', 'hr'],
  planbord: ['planner', 'regiomanager'],
};
export const laadpunten = s => s.hub ? 24 : s.wh ? 12 : 4;
export const fmt = n => new Intl.NumberFormat('nl-NL').format(Math.round(n));
export const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`; };
