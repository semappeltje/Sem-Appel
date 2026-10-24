import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { createFleet } from './fleet.js';
import { createMap } from './map.js';
import { createUI } from './ui.js';

const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* geen opslag */ } } };
const theme = store.get('sl-theme') || (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;

const fleet = createFleet();
const now = new Date(); let simTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
const state = { simTime, speed: 12, theme, playing: true };

const ui = createUI(fleet, state, store);
const mapApi = createMap('map', {
  theme, online: store.get('sl-online') !== 'off',
  onSelectTruck: id => ui.selectTruck(id), onSelectSp: sp => ui.selectSp(sp), onHover: (id, pt) => ui.hover(id, pt), onMapClick: () => ui.hover(null),
  onTilesFailed: () => ui.notice('Online kaartlaag niet bereikbaar; de ingebouwde basiskaart is actief.'),
});
ui.attachMap(mapApi);
window.SLCT = { ui, fleet, state, map: mapApi };

let last = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (state.playing) state.simTime = (state.simTime + state.speed * dt / 60) % 1440;
  acc += dt;
  if (acc >= 0.12) { acc = 0; ui.frame(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
