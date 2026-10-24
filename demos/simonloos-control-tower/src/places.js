// Standplaatsen (werkenbijsimonloos.nl, oktober 2026), steden en vaste lijsten.
import P from './data/places.json';

export const SP = P.SP;          // { n, lat, lon, div[], klant, vac, hub, wh, note, fleet, prov, regio }
export const TOWNS = P.TOWNS;    // { n, lat, lon, big }
export const CITIES = P.CITIES;  // { n, lat, lon, r } r = 1 groot ... 4 dorp
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
