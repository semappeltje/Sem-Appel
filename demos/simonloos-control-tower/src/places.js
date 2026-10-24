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
  onderweg: { n: 'Onderweg', color: '#22C55E', light: '#86EFAC' },
  klant: { n: 'Bij klant', color: '#38BDF8', light: '#BAE6FD' },
  pauze: { n: 'Pauze', color: '#F59E0B', light: '#FDE68A' },
  vertraagd: { n: 'Vertraagd', color: '#EF4444', light: '#FCA5A5' },
  terrein: { n: 'Op terrein', color: '#64748B', light: '#CBD5E1' },
};
export const laadpunten = s => s.hub ? 24 : s.wh ? 12 : 4;
export const fmt = n => new Intl.NumberFormat('nl-NL').format(Math.round(n));
export const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`; };
