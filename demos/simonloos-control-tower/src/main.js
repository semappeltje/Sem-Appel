import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { createFleet } from './fleet.js';
import { createMap } from './map.js';
import { createUI } from './ui.js';
import { createPeople } from './people.js';
import { createRest } from './rest.js';
import { createLostijden } from './lostijden.js';

// De app-root (#app.slct) draagt het thema en de opties. Zo draait dezelfde code als losse pagina (index.html) en
// ingebed in een andere site: data-tiles="off" laadt geen externe kaarttegels, data-embedded houdt sneltoetsen en
// volledig scherm binnen de app.
const root = document.getElementById('app');
const cfg = { tiles: root.dataset.tiles !== 'off', embedded: 'embedded' in root.dataset };
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* geen opslag */ } } };
const theme = store.get('sl-theme') === 'dark' ? 'dark' : 'light';
root.dataset.theme = theme;

const now = new Date(); const simTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
const state = { simTime, speed: 12, theme, playing: true };
// de kaart krijgt de klok mee (simTime, speed), zodat de voertuigen tussen twee stappen vloeiend rijden en bij een sprong
// in de tijd (tijdschuif, Nu) gewoon springen
// de basiskaart (Kaartlagen): ingebouwd, online (OpenStreetMap via OpenFreeMap), luchtfoto of BRT (PDOK); zonder keuze
// online, zoals voorheen
const kaartlaag = (k => (['kaart', 'online', 'luchtfoto', 'brt'].includes(k) ? k : store.get('sl-online') === 'off' ? 'kaart' : 'online'))(store.get('sl-kaartlaag'));
const mapApi = createMap('map', {
  theme, tiles: cfg.tiles, online: cfg.tiles && kaartlaag === 'online', base: kaartlaag, clock: state,
  onSelectTruck: id => window.SLCT && window.SLCT.ui.selectTruck(id), onSelectSp: sp => window.SLCT && window.SLCT.ui.selectSp(sp), onSelectRest: id => window.SLCT && window.SLCT.ui.selectRest(id), onSelectTrailer: id => window.SLCT && window.SLCT.ui.selectTrailer(id),
  onHover: (id, pt) => window.SLCT && window.SLCT.ui.hover(id, pt), onMapClick: () => window.SLCT && window.SLCT.ui.hover(null),
  // flyTo('O-5150'): een gekoppelde oplegger zit achter een voertuig; de vloot weet achter welk
  resolve: id => { const S = window.SLCT; const tr = S && (S.fleet.trailerById ? S.fleet.trailerById.get(id) : S.fleet.trailers.find(x => x.id === id)); if (!tr) return null; const s = S.fleet.trailerStateAt(tr, state.simTime); return s.vehicle ? s.vehicle.id : s.pos || null; },
  // de koers van een losse oplegger voor de 3D-wereld (die staat dan in de richting van zijn rij)
  trailerPose: id => { const S = window.SLCT; const tr = S && S.fleet.trailerById && S.fleet.trailerById.get(id); if (!tr) return null; const s = S.fleet.trailerStateAt(tr, state.simTime); return s && s.pos ? { b: s.pos.bearing, dock: s.dock } : null; },
  // wat er gebeurt op de plekken van de gekozen rit (wachten, lossen, koppelen, dock): de kaart zet het bij de stops
  events: id => { const S = window.SLCT; return S && S.fleet.eventsOf ? S.fleet.eventsOf(id) : null; },
  on3dFailed: () => window.SLCT && window.SLCT.ui.notice('De 3D-wereld kon niet laden; de platte kaart blijft.'),
  // laden de online tegels of de luchtfoto niet (geen internet, of een omgeving die ze tegenhoudt), dan stil terug naar
  // de ingebouwde kaart; alleen als iemand de laag zelf koos een melding
  onTilesFailed: info => {
    document.querySelectorAll('#baseSeg [data-base]').forEach(b => { const on = b.dataset.base === 'kaart'; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    if (info && info.user) window.SLCT && window.SLCT.ui.notice(`${info.layer === 'luchtfoto' ? 'De luchtfoto' : info.layer === 'brt' ? 'De BRT-achtergrondkaart' : 'De online kaart (OpenStreetMap)'} is niet bereikbaar; de ingebouwde basiskaart is actief.`);
  },
});
// Eerst de pagina laten zien, dan de routes over het echte wegennet berekenen (ongeveer een seconde).
const loadMsg = document.getElementById('loadMsg');
setTimeout(() => {
  const t0 = performance.now();
  const fleet = createFleet();
  const people = createPeople(fleet);
  const rest = createRest(store);
  const lostijden = createLostijden(fleet, store);
  const ui = createUI(fleet, state, store, { people, rest, lostijden, root, embedded: cfg.embedded });
  ui.attachMap(mapApi);
  window.SLCT = { ui, fleet, people, rest, lostijden, state, map: mapApi, cfg };
  if (loadMsg) loadMsg.textContent = `${fleet.trucks.length} voertuigen, ${fleet.trailers.length} opleggers en ${people.persons.length} chauffeurs staan klaar (${Math.round(performance.now() - t0)} ms).`;
  document.getElementById('loading').hidden = true;
  ui.start();
  // De klok loopt per beeld; elke 0,12 s rekent ui.frame() een stap (de kaart rijdt daartussen vloeiend door). De eerste
  // tijdstempel van requestAnimationFrame kan van vóór het opbouwen van de vloot zijn: nooit een negatieve stap, anders
  // staat alles na het laden een paar seconden stil en loopt de klok even terug.
  let last = null, acc = 0;
  function loop(t) {
    const dt = last === null ? 0 : Math.max(0, Math.min(0.25, (t - last) / 1000)); last = t;
    if (state.playing) state.simTime = (state.simTime + state.speed * dt / 60) % 1440;
    acc += dt;
    if (acc >= 0.12) { acc = 0; ui.frame(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}, 60);
