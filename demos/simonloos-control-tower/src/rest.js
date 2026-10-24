// Pauzeplekken langs het snelwegennet met voorzieningen en beoordelingen van chauffeurs (gesimuleerd).
// De plekken liggen op echte snelwegknopen uit de Overture-graaf; namen volgen de dichtstbijzijnde plaats.
import { nodes, allEdges, kmBetween } from './roads.js';
import { CITIES } from './places.js';

let seed = 4242; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
const REVIEWS = [['KV', 'Rustig en goed verlicht, douche schoon.', 5], ['MB', 'Vol na 20:00, kom vroeg.', 3], ['JS', 'Prima koffie, truckparkeren apart van auto\'s.', 4], ['AD', 'Beveiligd terrein, voel me hier veilig.', 5], ['RK', 'Weinig plekken voor LZV.', 2], ['FI', 'Nieuwe laders, werkten meteen.', 4], ['SV', 'Toilet matig, verder ok.', 3], ['DS', 'Dicht bij de afrit, snel weer weg.', 4]];

export function createRest(store) {
  const E = allEdges(); const cand = []; const seen = new Set();
  for (let i = 0; i < E.length; i++) if (E[i][3] === 0 && !E[i][4]) for (const n of [E[i][0], E[i][1]]) if (!seen.has(n)) { seen.add(n); cand.push(n); }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const places = []; const big = CITIES.filter(c => c.r <= 3);
  for (const n of cand) {
    const [lon, lat] = nodes[n]; if (lon < 3.4 || lon > 7.1 || lat < 50.8 || lat > 53.4) continue;
    if (!places.every(p => kmBetween([lon, lat], [p.lon, p.lat]) > 22)) continue;
    let c = big[0], bd = Infinity; for (const x of big) { const d = kmBetween([lon, lat], [x.lon, x.lat]); if (d < bd) { bd = d; c = x; } }
    const beveiligd = rnd() < 0.3, douche = rnd() < 0.45, laders = rnd() < 0.35 ? pick([2, 4, 6]) : 0;
    const base = r => +(r).toFixed(1);
    const place = {
      id: 'R' + String(places.length + 1).padStart(2, '0'), n: `Pauzeplek ${c.n}`, sub: `snelweg bij ${c.n}, ${Math.round(bd)} km`, lon, lat, node: n,
      plekken: pick([24, 36, 48, 60, 80, 110]), beveiligd, douche, eten: pick(['restaurant', 'snackbar', 'alleen automaat', 'geen']), laders, lzv: rnd() < 0.5,
      rating: base(2.9 + rnd() * 1.9 + (beveiligd ? 0.2 : 0) + (douche ? 0.2 : 0)), count: 4 + Math.floor(rnd() * 60),
      reviews: [pick(REVIEWS), pick(REVIEWS), pick(REVIEWS)].filter((x, i, a) => a.indexOf(x) === i).map(([who, text, stars]) => ({ who, text, stars })),
    };
    places.push(place); if (places.length >= 48) break;
  }
  let mine = {}; try { mine = JSON.parse(store.get('sl-rest') || '{}'); } catch { mine = {}; }
  const rate = (id, stars) => { mine[id] = stars; store.set('sl-rest', JSON.stringify(mine)); };
  const myRating = id => mine[id] || 0;
  const score = p => mine[p.id] ? +((p.rating * p.count + mine[p.id]) / (p.count + 1)).toFixed(1) : p.rating;
  const nearest = (pos, maxKm = 60) => { let best = null, bd = Infinity; for (const p of places) { const d = kmBetween([pos.lon, pos.lat], [p.lon, p.lat]); if (d < bd) { bd = d; best = p; } } return bd <= maxKm ? { place: best, km: Math.round(bd) } : null; };
  const byId = new Map(places.map(p => [p.id, p]));
  return { places, byId, rate, myRating, score, nearest };
}
