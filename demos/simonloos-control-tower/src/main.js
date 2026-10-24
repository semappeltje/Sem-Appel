import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { createFleet } from './fleet.js';
import { createMap } from './map.js';
import { createUI } from './ui.js';
import { createPeople } from './people.js';
import { createRest } from './rest.js';
import { createLostijden } from './lostijden.js';

const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* geen opslag */ } } };
const theme = store.get('sl-theme') || 'light';
document.documentElement.dataset.theme = theme;

const now = new Date(); const simTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
const state = { simTime, speed: 12, theme, playing: true };
const mapApi = createMap('map', {
  theme, online: store.get('sl-online') !== 'off',
  onSelectTruck: id => window.SLCT && window.SLCT.ui.selectTruck(id), onSelectSp: sp => window.SLCT && window.SLCT.ui.selectSp(sp), onSelectRest: id => window.SLCT && window.SLCT.ui.selectRest(id),
  onHover: (id, pt) => window.SLCT && window.SLCT.ui.hover(id, pt), onMapClick: () => window.SLCT && window.SLCT.ui.hover(null),
  onTilesFailed: () => window.SLCT && window.SLCT.ui.notice('Online kaartlaag niet bereikbaar; de ingebouwde basiskaart is actief.'),
});
// Eerst de pagina laten zien, dan de routes over het echte wegennet berekenen (ongeveer een seconde).
const loadMsg = document.getElementById('loadMsg');
setTimeout(() => {
  const t0 = performance.now();
  const fleet = createFleet();
  const people = createPeople(fleet);
  const rest = createRest(store);
  const lostijden = createLostijden(fleet, store);
  const ui = createUI(fleet, state, store, { people, rest, lostijden });
  ui.attachMap(mapApi);
  window.SLCT = { ui, fleet, people, rest, lostijden, state, map: mapApi };
  if (loadMsg) loadMsg.textContent = `${fleet.trucks.length} trucks en hun routes staan klaar (${Math.round(performance.now() - t0)} ms).`;
  document.getElementById('loading').hidden = true;
  ui.start();
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(0.25, (t - last) / 1000); last = t;
    if (state.playing) state.simTime = (state.simTime + state.speed * dt / 60) % 1440;
    acc += dt;
    if (acc >= 0.12) { acc = 0; ui.frame(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}, 60);
