import { toXY } from './geo.js';
export const DIV = {
  winkel: { n: 'Winkeldistributie', hex: 0xFCC41F, css: 'var(--d-winkel)' },
  netwerk: { n: 'Netwerktransport', hex: 0xE3001F, css: 'var(--d-netwerk)' },
  bulk: { n: 'Bulktransport', hex: 0xFF8A3D, css: 'var(--d-bulk)' },
  dranken: { n: 'Drankenlogistiek', hex: 0x4FC3F7, css: 'var(--d-dranken)' },
  bezorg: { n: 'Boodschappenbezorging', hex: 0xB388FF, css: 'var(--d-bezorg)' },
};
// Standplaatsen: uit de vacatures en locatiepagina's van werkenbijsimonloos.nl (oktober 2026). Coördinaten op plaatsniveau.
export const SP = [
  { n: 'Wognum', lat: 52.672, lon: 5.021, div: ['netwerk', 'bulk', 'bezorg', 'winkel'], klant: 'Albert Heijn Home Service', vac: 13, hub: true, wh: true, note: 'Hoofdkantoor, warehouse (85.000 m² samen met Geldermalsen en Tiel), garage en wasstraat', trucks: 7 },
  { n: 'Zaandam', lat: 52.44, lon: 4.83, div: ['winkel', 'netwerk'], klant: 'Albert Heijn', vac: 7, trucks: 4 },
  { n: 'Oss', lat: 51.765, lon: 5.52, div: ['winkel'], klant: 'Plus', vac: 6, trucks: 3 },
  { n: 'Zwolle', lat: 52.51, lon: 6.09, div: ['winkel', 'bulk'], klant: 'Albert Heijn', vac: 5, trucks: 3 },
  { n: 'Geldermalsen', lat: 51.88, lon: 5.29, div: ['netwerk', 'winkel'], klant: 'Albert Heijn', vac: 5, wh: true, note: 'Warehouse en garage', trucks: 3 },
  { n: 'Aalsmeer', lat: 52.26, lon: 4.76, div: ['winkel'], klant: 'Borgesius (brood)', vac: 4, trucks: 2 },
  { n: 'Tiel', lat: 51.89, lon: 5.43, div: ['netwerk', 'bulk'], klant: 'Crossdock', vac: 4, wh: true, note: 'Warehouse en crossdock', trucks: 3 },
  { n: 'Barneveld', lat: 52.14, lon: 5.58, div: ['winkel'], klant: 'Plus (diepvries)', vac: 4, trucks: 2 },
  { n: 'Raalte', lat: 52.385, lon: 6.275, div: ['winkel'], klant: 'Jumbo', vac: 4, trucks: 2 },
  { n: 'Waalwijk', lat: 51.69, lon: 5.07, div: ['winkel'], klant: 'SPAR', vac: 3, trucks: 2 },
  { n: 'Utrecht', lat: 52.09, lon: 5.12, div: ['netwerk'], klant: 'LZV netwerk', vac: 3, trucks: 2 },
  { n: 'Nieuwegein', lat: 52.03, lon: 5.09, div: ['winkel'], klant: 'Jumbo / Albert Heijn', vac: 3, trucks: 2 },
  { n: 'Almere', lat: 52.37, lon: 5.22, div: ['winkel'], klant: 'Lidl', vac: 3, trucks: 2 },
  { n: 'Waddinxveen', lat: 52.045, lon: 4.65, div: ['winkel'], klant: 'Lidl', vac: 2, trucks: 1 },
  { n: 'Dinteloord', lat: 51.635, lon: 4.37, div: ['bulk'], klant: 'Bulk (Europa)', vac: 2, trucks: 2 },
  { n: 'Amstelveen', lat: 52.30, lon: 4.86, div: ['winkel'], klant: 'Les met Loos', vac: 2, trucks: 1 },
  { n: 'Pijnacker (Delfgauw)', lat: 52.02, lon: 4.43, div: ['winkel'], klant: 'Albert Heijn', vac: 2, trucks: 1 },
  { n: 'Opmeer', lat: 52.71, lon: 4.95, div: ['netwerk'], klant: 'Truckspuiterij en garage', vac: 2, trucks: 0 },
  { n: 'Ede', lat: 52.045, lon: 5.665, div: ['netwerk'], klant: 'Netwerk', vac: 2, trucks: 1 },
  { n: 'Maasdam', lat: 51.78, lon: 4.55, div: ['netwerk'], klant: 'Netwerk', vac: 2, trucks: 1 },
  { n: 'Veghel', lat: 51.615, lon: 5.545, div: ['netwerk'], klant: 'Netwerk', vac: 2, trucks: 1 },
  { n: 'Etten-Leur', lat: 51.57, lon: 4.635, div: ['winkel'], klant: 'Lidl', vac: 2, trucks: 1 },
  { n: 'Alkmaar', lat: 52.63, lon: 4.75, div: ['winkel'], klant: 'Vomar', vac: 2, trucks: 1 },
  { n: 'Tilburg', lat: 51.56, lon: 5.09, div: ['winkel'], klant: 'Albert Heijn', vac: 2, trucks: 1 },
  { n: 'Broek op Langedijk', lat: 52.68, lon: 4.80, div: ['netwerk'], klant: 'Netwerk (LZV)', vac: 2, trucks: 1 },
  { n: 'Hoogeveen', lat: 52.72, lon: 6.48, div: ['winkel'], klant: 'Albert Heijn', vac: 2, trucks: 1 },
  { n: 'Oostzaan', lat: 52.44, lon: 4.87, div: ['winkel'], klant: 'Winkeldistributie', vac: 1, trucks: 0 },
  { n: 'Nijkerk', lat: 52.22, lon: 5.485, div: ['netwerk'], klant: 'Netwerk', vac: 1, trucks: 1 },
  { n: 'Bunnik', lat: 52.065, lon: 5.195, div: ['dranken'], klant: 'Vrumona', vac: 1, trucks: 2 },
  { n: 'Heerenveen', lat: 52.96, lon: 5.92, div: ['winkel'], klant: 'SPAR', vac: 1, trucks: 1 },
  { n: 'Amsterdam', lat: 52.37, lon: 4.90, div: ['winkel'], klant: 'Winkeldistributie', vac: 1, trucks: 0 },
  { n: 'Avenhorn', lat: 52.62, lon: 4.95, div: ['netwerk'], klant: 'Netwerk', vac: 1, trucks: 0 },
  { n: 'Emmeloord', lat: 52.71, lon: 5.75, div: ['netwerk'], klant: 'Netwerk', vac: 1, trucks: 1 },
  { n: 'Den Bosch', lat: 51.70, lon: 5.30, div: ['dranken'], klant: 'Heineken', vac: 1, trucks: 2 },
  { n: 'Lieshout', lat: 51.52, lon: 5.60, div: ['dranken'], klant: 'Bavaria', vac: 1, trucks: 2 },
  { n: 'Ridderkerk', lat: 51.87, lon: 4.60, div: ['netwerk'], klant: 'Bakker Centraal Inkoop', vac: 1, trucks: 1 },
  { n: 'Beilen', lat: 52.86, lon: 6.51, div: ['winkel'], klant: 'Jumbo', vac: 1, trucks: 1 },
  { n: 'Beverwijk', lat: 52.48, lon: 4.66, div: ['winkel'], klant: 'Winkeldistributie', vac: 1, trucks: 1 },
  { n: 'Bleiswijk', lat: 52.01, lon: 4.53, div: ['winkel'], klant: 'Jumbo', vac: 1, trucks: 1 },
  { n: 'Heinenoord', lat: 51.83, lon: 4.47, div: ['winkel'], klant: 'Plus', vac: 1, trucks: 1 },
  { n: 'Oosterhout', lat: 51.64, lon: 4.86, div: ['winkel'], klant: 'Lidl', vac: 1, trucks: 1 },
  { n: 'Weert', lat: 51.25, lon: 5.70, div: ['winkel'], klant: 'Lidl', vac: 1, trucks: 1 },
];
const KLANTEN = ['Albert Heijn', 'Jumbo', 'Plus', 'Lidl', 'Vomar', 'SPAR', 'Heineken', 'Bavaria', 'Vrumona', 'Borgesius'];
for (const s of SP) { const p = toXY(s.lon, s.lat); s.x = p.x; s.y = p.y; s.isKlant = KLANTEN.some(k => s.klant.startsWith(k)); }
// Steden voor leveringen, labels en nachtverlichting
export const TOWNS = [
  ['Amsterdam', 52.37, 4.90, 1], ['Rotterdam', 51.92, 4.48, 1], ['Den Haag', 52.08, 4.31, 1], ['Utrecht', 52.09, 5.12, 1], ['Eindhoven', 51.44, 5.47, 1], ['Groningen', 53.22, 6.57, 1], ['Tilburg', 51.56, 5.09, 1], ['Almere', 52.37, 5.22, 1], ['Breda', 51.59, 4.78, 1], ['Nijmegen', 51.84, 5.87, 1], ['Arnhem', 51.98, 5.90, 1], ['Haarlem', 52.38, 4.64, 1], ['Enschede', 52.22, 6.90, 1], ['Apeldoorn', 52.21, 5.97, 1], ['Amersfoort', 52.16, 5.39, 1], ['Zwolle', 52.51, 6.09, 1], ['Leiden', 52.16, 4.49, 1], ['Maastricht', 50.85, 5.70, 1], ['Dordrecht', 51.81, 4.67, 1], ['Zoetermeer', 52.06, 4.49, 0], ['Leeuwarden', 53.20, 5.80, 1], ['Alkmaar', 52.63, 4.75, 1], ['Emmen', 52.78, 6.90, 1], ['Delft', 52.01, 4.36, 0], ['Deventer', 52.25, 6.16, 0], ['Venlo', 51.37, 6.17, 1], ['Helmond', 51.48, 5.66, 0], ['Hilversum', 52.23, 5.17, 0], ['Lelystad', 52.51, 5.47, 1], ['Assen', 53.00, 6.56, 1], ['Hoorn', 52.64, 5.06, 0], ['Purmerend', 52.50, 4.95, 0], ['Gouda', 52.02, 4.71, 0], ['Roosendaal', 51.53, 4.46, 0], ['Middelburg', 51.50, 3.61, 1], ['Den Helder', 52.96, 4.76, 0], ['Heerenveen', 52.96, 5.92, 0], ['Drachten', 53.11, 6.10, 0], ['Meppel', 52.70, 6.19, 0], ['Emmeloord', 52.71, 5.75, 0], ['Roermond', 51.19, 5.99, 0], ['Weert', 51.25, 5.70, 0], ['Oss', 51.765, 5.52, 0], ["'s-Hertogenbosch", 51.70, 5.30, 1], ['Bergen op Zoom', 51.49, 4.29, 0], ['Zaandam', 52.44, 4.83, 0], ['Harderwijk', 52.34, 5.62, 0], ['Goes', 51.50, 3.89, 0], ['Hengelo', 52.27, 6.79, 0], ['Doetinchem', 51.96, 6.29, 0], ['Winschoten', 53.14, 7.03, 0], ['Sneek', 53.03, 5.66, 0],
].map(([n, lat, lon, big]) => ({ n, big, ...toXY(lon, lat) }));
