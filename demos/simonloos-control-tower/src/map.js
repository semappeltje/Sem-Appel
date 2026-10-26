// Kaart: MapLibre GL met een eigen basiskaart in de geest van Google Maps (basemap.js; wegen en water uit Overture Maps /
// OpenStreetMap, provincies en bebouwing uit Natural Earth). Werkt zonder internet; met internet (losse versie) kan de
// basiskaart ook OpenStreetMap zijn (OpenFreeMap, in hetzelfde palet), de luchtfoto of de BRT-achtergrondkaart (PDOK). Voertuigen rijden vloeiend tussen de stappen van de simulatie (motion.js), de
// camera vliegt en volgt rustig (cubic-bezier(.2,.7,.2,1)), en bij "minder beweging" springt alles.
//
// API (ui.js): map, setTheme, setOnline, whenReady, setTrucks, setTrailers, showTrailers, trailersOn, setSelected,
// setRoute, highlightSp, fitSps, setRest, showRest, isOnline, hasOnline, hasTiles, set3d, is3d, has3d, followCam, scene3d.
// Nieuw: follow(id, opts), following(), flyTo(doel, opts), setSelectedId(id), setHover(id), vehiclePos(id) (ook het doel
// van de lopende stap, tlon/tlat: een rijdend voertuig rijdt rechts, op de rijbaan van zijn rijrichting),
// inView(lon, lat, pad), pick(point), setEvents(lijst), anchor(id), debug(). Nieuwe opties: onSelectPlace({ type: 'dc' |
// 'winkel', ...plek }) bij een klik op een DC of winkel (zonder die optie zijn ze niet klikbaar), clock (simTime en
// speed), resolve(id) voor doelen die alleen de app kent (een gekoppelde oplegger), events(id) voor de gebeurtenissen
// van een voertuig (fleet.eventsOf; de kaart zet ze bij de plekken van de gekozen rit), onTilesFailed({ user, layer }).
// onHover krijgt als derde argument het anker van het voertuig (zie anchor).
// Basiskaart: setBase('kaart' | 'online' | 'luchtfoto' | 'brt'), base(), hasBase(stand); opts.base: de stand bij het
// starten. 'online' is OpenStreetMap via OpenFreeMap (setOnline/isOnline blijven werken), 'luchtfoto' de luchtfoto van
// PDOK onder de eigen wegen, 'brt' de BRT-achtergrondkaart van PDOK. Laadt een bron niet (of stuurt hij iets anders dan
// tegels), dan terug naar de ingebouwde kaart en opts.onTilesFailed({ user, layer }).
import * as maplibregl from 'maplibre-gl';
import workerSrc from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import './map.css';
import urban from './data/urban.json';
import { SP, ST, DCS, WINKELS, dcById, winkelById, dockPos, laadGebouwen } from './places.js';
import { TRST } from './fleet.js';
import { PAL, FONT, addGround, addLabels, addPois, addDepots, addStyleImages, applyPalette, highlightDepot, createBuildings2d, GROUND, LABELS, laneShift, laneStats, photoUrl, PHOTO_LAYERS, PHOTO_ATTR, PHOTO_HIDE, setPhotoStyle, addOnline, OFM_IDS, OFM_LAYERS, OFM_ATTR, brtUrl, BRT_ATTR } from './basemap.js';
import { createMotion, createVehicleLayer, buildAtlas, EASE, reducedMotion, mercX, mercY, angleDelta, metersPerPixel } from './motion.js';

// De kaart draait in één bestand (ook als artifact): de MapLibre-worker wordt uit een blob-URL gestart.
try { const src = workerSrc.replace(/export\s*\{[^}]*\};?\s*(\/\/# sourceMappingURL=\S*)?\s*$/, ''); maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { console.warn('worker-url', e); }

const fc = f => ({ type: 'FeatureCollection', features: f });
const line = (coords, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'LineString', coordinates: coords } });
const Z = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpStops = (z, stops) => { if (z <= stops[0]) return stops[1]; for (let i = 2; i < stops.length; i += 2) if (z <= stops[i]) { const t = (z - stops[i - 2]) / (stops[i] - stops[i - 2]); return stops[i - 1] + (stops[i + 1] - stops[i - 1]) * t; } return stops[stops.length - 1]; };
// maat van de voertuigiconen en de stippen per zoomniveau (zoals icon-size)
// (op zoom 16 iets kleiner: een rijdende trekker past dan ongeveer op zijn rijbaan van 7,5 m, 10 px; daarboven ware grootte)
const VEH = [7.6, 0.5, 10, 0.72, 13, 0.92, 15, 0.92, 16, 0.78, 18, 1.05], DOT = [5.5, 0.55, 7.6, 0.78, 10, 0.82, 13, 0.95, 16, 1.1];
// echte lengte (m) en lengte van het icoon (px bij maat 1) per soort: geparkeerde voertuigen staan vanaf zoom 14,5 op ware
// grootte in hun parkeerrij, rijdende groeien heel dichtbij mee naar ware grootte
const REAL = { trekker: 16.5, solo: 6.2, bakwagen: 10, bus: 6.8 };
const DOTS_BELOW = 7.6;

// Losse opleggers: een klein rechthoekje in de statuskleur (MapLibre-symbolen; ze staan stil)
function drawIcon(w, h, fn) { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); g.translate(w / 2, h / 2); g.lineJoin = 'round'; fn(g); return g.getImageData(0, 0, w * 2, h * 2); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function trailerIcons(stroke) {
  const out = {};
  for (const [k, v] of Object.entries(TRST)) out['tr-' + k] = drawIcon(18, 26, g => { g.shadowColor = 'rgba(17,20,28,.25)'; g.shadowBlur = 3; g.shadowOffsetY = 1; rr(g, -5, -10, 10, 20, 2); g.strokeStyle = stroke; g.lineWidth = 2.4; g.stroke(); g.shadowColor = 'transparent'; g.fillStyle = v.color; g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-3.4, 3, 6.8, 1.5); g.fillRect(-3.4, 6, 6.8, 1.5); });
  return out;
}

function hasWebGL2() { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; } }

// Zonder WebGL 2 (uitgeschakeld, oude browser, of een testomgeving zonder GPU): dezelfde API, zonder kaart. De
// kaartweergave toont een melding; alles wat de kaart aanstuurt doet niets. De andere weergaven werken gewoon.
function noMap(container, theme) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (el) el.innerHTML = '<div class="nomap"><div><b>De kaart heeft WebGL nodig</b>Deze browser heeft WebGL uit staan of ondersteunt het niet. De rest werkt gewoon: overzicht, ritten, meldingen, open ritten, planbord, voertuigen, opleggers, chauffeurs en standplaatsen.</div></div>';
  const no = () => {};
  const map = { easeTo: no, flyTo: no, jumpTo: no, resize: no, fitBounds: no, on: no, off: no, getZoom: () => 6.6, getCenter: () => ({ lng: 5.3, lat: 52.2 }), getBearing: () => 0, getPitch: () => 0 };
  return { map, setTheme: no, setOnline: no, setBase: no, base: () => 'kaart', hasBase: m => m === 'kaart', whenReady: f => setTimeout(f, 0), setTrucks: no, setTrailers: no, showTrailers: no, trailersOn: () => false, setSelected: no, setRoute: no, highlightSp: no, fitSps: no, setRest: no, showRest: no, isOnline: () => false, hasOnline: () => false, hasTiles: () => false, set3d: no, is3d: () => false, has3d: () => false, followCam: no, scene3d: () => null, follow: no, following: () => null, flyTo: () => false, setSelectedId: no, setHover: no, vehiclePos: () => null, inView: () => false, pick: () => null, setEvents: no, anchor: () => null, debug: () => ({ noWebGL: true }), noWebGL: true, theme };
}

// opts.tiles === false: geen externe kaarttegels (geen enkel verzoek naar buiten); alleen de ingebouwde basiskaart.
// opts.clock: het object met simTime en speed (main.js), om sprongen in de tijd te herkennen.
export function createMap(container, opts) {
  let theme = opts.theme || 'light'; const tiles = opts.tiles !== false;
  // de basiskaart: 'kaart' (de ingebouwde) of, alleen met externe tegels, 'online' (OpenFreeMap), 'luchtfoto' of 'brt'
  // (PDOK). Per bron: ok (de eerste tegel kwam en klopte), failed, het aantal fouten, of iemand de stand zelf koos, bij
  // OpenFreeMap het aantal tegels zonder bekende lagen, bij de luchtfoto de laag (0: 8 cm, 1: 25 cm, de terugval).
  const SRC = { online: { ok: false, failed: false, errors: 0, user: false, seen: 0 }, luchtfoto: { ok: false, failed: false, errors: 0, user: false, tier: 0 }, brt: { ok: false, failed: false, errors: 0, user: false } };
  let base = !tiles ? 'kaart' : SRC[opts.base] ? opts.base : opts.base === 'kaart' || opts.online === false ? 'kaart' : 'online';
  if (!hasWebGL2()) return noMap(container, theme);
  let map;
  try {
    map = new maplibregl.Map({
      container, style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': PAL[theme].sea } }] },
      center: [5.3, 52.2], zoom: 6.6, minZoom: 5.2, maxZoom: 18.5, maxPitch: 65, maxBounds: [[-9, 45.5], [19, 58.5]],
      attributionControl: false, antialias: true, fadeDuration: reducedMotion() ? 0 : 200, dragRotate: true, touchPitch: true,
    });
  } catch (e) { console.warn('kaart niet gestart', e); return noMap(container, theme); }
  map.getContainer().classList.add('slmap');
  // Het eerste beeld. De zee is de achtergrond en het land ligt er als vlakken over; tot de bronnen land en water getegeld
  // zijn (onder belasting een paar seconden) zou Nederland onder water staan. Daarom ligt er tot dan een rustig vlak in de
  // kleur van het land over de kaart (de knoppen erboven blijven bruikbaar), met na een halve seconde een korte regel, en
  // zodra land en water in beeld getekend zijn, vaagt het vlak in 200 ms weg; met minder beweging is het meteen weg. Een
  // eigen kaart van een paar seconden lang leeg is beter dan een kaart die een seconde lang verkeerd is.
  const wacht = document.createElement('div'); wacht.className = 'kaart-wacht'; wacht.setAttribute('role', 'status');
  wacht.innerHTML = '<span>De kaart wordt getekend</span>'; wacht.style.background = PAL[theme].land;
  map.getCanvasContainer().after(wacht);
  let wachtAf = false, wachtTimer = 0;
  // het vangnet: faalt een bron van de basiskaart (een fout bij het laden), dan is er niets om op te wachten
  map.on('error', e => { const id = e && e.sourceId; if ((id === 'land' || id === 'water' || id === 'ofm' || id === 'luchtfoto' || id === 'brt') && !wachtAf) weg(); });
  function weg() {
    if (wachtAf) return; wachtAf = true; clearTimeout(wachtTimer); clearInterval(tikker);
    if (reducedMotion()) { wacht.remove(); return; }
    requestAnimationFrame(() => { wacht.classList.add('weg'); setTimeout(() => wacht.remove(), 260); });
  }
  // Pas meten als de kaart een maat heeft (de kaartweergave in beeld): een kaart zonder maat vraagt geen tegels, en dan
  // zegt "geladen" niets. En isSourceLoaded zegt ook met een maat niet dat er al iets getekend is: tot ronde 4 ging het
  // vlak daardoor te vroeg weg (Nederland als zee met trucks op het water, op een trage machine, in het donker en vanaf het
  // Overzicht). Het vlak gaat pas weg als land en water geladen zijn en het land echt in het zichtbare beeld getekend is
  // (queryRenderedFeatures op de landlaag; bij het openen staat Nederland altijd in beeld, dus land is er dan altijd).
  // Dekt een online basiskaart het land af (OpenFreeMap), dan moet die zelf iets getekend hebben; een luchtfoto of de
  // BRT is een rasterlaag zonder features, daar volstaat dat de tegels van het beeld er zijn. Met minder beweging geen
  // overgang, wel hetzelfde wachten. Niet areTilesLoaded over de hele kaart: de voertuigbronnen verversen elk beeld.
  const verborgen = id => map.getLayoutProperty(id, 'visibility') === 'none';
  const geladen = id => { const l = map.getLayer(id); return !!l && (verborgen(id) || (!!map.getSource(l.source) && map.isSourceLoaded(l.source))); };
  const inBeeld = id => { try { return !!map.getLayer(id) && !verborgen(id) && map.queryRenderedFeatures({ layers: [id] }).length > 0; } catch { return false; } };
  const bronKlaar = id => !map.getSource(id) || map.isSourceLoaded(id);
  const OFM_ZICHT = ['o-water', 'o-landcover', 'o-landuse', 'o-road', 'o-boundary'];
  // kijkt er iemand naar de kaart: de kaartweergave heeft een maat en de app is klaar met laden (tijdens het laden staat de
  // kaartweergave in de opbouw aan, achter het laadscherm)
  const kijkt = () => { const c = map.getContainer(); if (!c.clientWidth || !c.clientHeight) return false; const ld = document.getElementById('loading'); return !(ld && !ld.hidden); };
  // het net: lukt het nooit, dan na 30 s toch de kaart (bij een fout in een bron meteen, hierboven). De 30 s tellen alleen
  // terwijl iemand naar de kaart kijkt: op een zwaar belaste machine duurde het laden van de app en het verwerken van land
  // en water samen meer dan 12 s, en het oude net van 12 s liep al tijdens het laden mee, zodat toch de zee stond. Liever
  // een kaart die langer "De kaart wordt getekend" zegt dan een kaart die verkeerd is
  function net() { wachtTimer = 0; if (!wachtAf && kijkt()) weg(); }
  // Gemeten met een eigen tik (elke 120 ms), niet in het render-bericht van de kaart: een meting daarin hield onder
  // belasting het tekenen tegen (met het vlak nog in beeld en de camera in beweging tekende de kaart geen enkel beeld
  // meer, ronde 4). queryRenderedFeatures leest het laatst getekende beeld; een bron of laag die net verandert, geeft
  // hooguit een tik later antwoord.
  let klaarSinds = 0;
  function wachtOp() {
    try {
      if (wachtAf || !map.getLayer('land') || !map.getLayer('water')) return;
      if (!kijkt()) { if (wachtTimer) { clearTimeout(wachtTimer); wachtTimer = 0; } klaarSinds = 0; return; }
      if (!wachtTimer) wachtTimer = setTimeout(net, 30000);
      if (!geladen('land') || !geladen('water')) { klaarSinds = 0; return; }
      const online = !!map.getLayer('o-bg') && !verborgen('o-bg');
      const klaar = !verborgen('land') ? inBeeld('land') : online ? bronKlaar('ofm') && OFM_ZICHT.some(inBeeld) : bronKlaar('luchtfoto') && bronKlaar('brt');
      if (!klaar) { klaarSinds = 0; return; }
      // beweegt de camera nog (de vlucht naar het werkgebied vraagt elk beeld nieuwe tegels), dan hooguit anderhalve
      // seconde wachten op stilstand; een volgcamera beweegt altijd en mag het vlak niet vasthouden
      if (!klaarSinds) klaarSinds = performance.now();
      if (typeof map.isMoving === 'function' && map.isMoving() && performance.now() - klaarSinds < 1500) return;
      weg();
    } catch { /* de volgende tik opnieuw */ }
  }
  const tikker = setInterval(wachtOp, 120);
  const clock = opts.clock || null;
  let trailersOn = false; let scene3d = null, three = false; let ready = false; const onReady = [];
  const motion = createMotion();
  let atlas = null; let selId = null, selPoint = null, selSince = 0, hoverId = null, hoverSince = 0, hoverOut = null, hoverWasOn = false;
  const follow = { id: null, rotate: false, implicit: false, last: 0, blend: null, paused: false };
  let gestureOn = false, easeUntil = 0;
  // loopt er een camera-animatie (easeTo, flyTo)? In MapLibre 6 zit die in de camera van de kaart.
  const isAnimating = () => { const cam = map._camera; if (cam && typeof cam.isEasing === 'function') return cam.isEasing(); if (typeof map.isEasing === 'function') return map.isEasing(); return performance.now() < easeUntil; };

  // ---------- camera: vliegen in de curve van de interface, nooit door het beeld schieten ----------
  // Elke easeTo en flyTo (ook die van ui.js en de knoppen) krijgt de curve cubic-bezier(.2,.7,.2,1). Ligt het doel meer
  // dan anderhalf scherm weg, dan vliegt de kaart (eerst uit, dan in) in plaats van er in volle vaart doorheen te schuiven.
  // Een voertuig dat al in beeld is: de kaart blijft staan. Herhaalde easeTo's naar het geselecteerde voertuig (zo volgt
  // ui.js in 2D) worden een rustige volgcamera per beeld. Bij "minder beweging" springt de camera (MapLibre zelf).
  const nativeEase = map.easeTo.bind(map), nativeFly = map.flyTo.bind(map), nativeJump = map.jumpTo.bind(map), nativeFit = map.fitBounds.bind(map);
  // een cameraopdracht van buiten (ui.js) beëindigt het volgen dat ui.js zelf aanstuurt; volgt ui.js nog, dan roept het
  // binnen een seconde weer followCam aan en schuift de camera rustig terug
  const yieldFollow = () => { if (follow.id && follow.implicit) stopFollow(); };
  map.jumpTo = function (o, ev) { yieldFollow(); return nativeJump(o, ev); };
  map.fitBounds = function (b, o, ev) { yieldFollow(); easeUntil = performance.now() + ((o && o.duration) ?? 1000); return nativeFit(b, { easing: EASE, ...(o || {}) }, ev); };
  const W = () => map.getContainer().clientWidth || 1, H = () => map.getContainer().clientHeight || 1;
  function pxDist(center) { const p = map.project(center); return Math.hypot(p.x - W() / 2, p.y - H() / 2); }
  function inView(lon, lat, pad = 40) { const p = map.project([lon, lat]); return p.x >= pad && p.y >= pad && p.x <= W() - pad && p.y <= H() - pad; }
  const asLL = c => Array.isArray(c) ? c : c && c.lng != null ? [c.lng, c.lat] : c && c.lon != null ? [c.lon, c.lat] : null;
  let lastFollowEase = { id: null, t: 0 };
  // Hoe vaak ui.js een volgopdracht geeft (normaal elke 0,9 tot 1 s; op een overbelaste machine komen de beelden en dus
  // de opdrachten veel later). Het volgen stopt pas als er ruim langer dan dat niets meer komt.
  let cadence = 0;
  // (een pauze van de gebruiker, langer dan tweeënhalf keer het venster, telt niet mee)
  const followWindow = () => Math.max(1600, cadence * 1.7 + 300);
  const noteCadence = gap => { if (gap > 0 && gap < 2.5 * followWindow()) cadence = cadence ? cadence * 0.7 + gap * 0.3 : gap; };
  // ligt er een voertuig of losse oplegger op (binnen zo'n 80 m van) dit punt?
  function nearMarker(c) {
    const d = 0.0012; for (const r of motion.order()) if (Math.abs(r.tx - c[0]) < d && Math.abs(r.ty - c[1]) < d) return true;
    if (lastTrailers) for (const f of lastTrailers) { const q = f.geometry.coordinates; if (Math.abs(q[0] - c[0]) < d && Math.abs(q[1] - c[1]) < d) return true; }
    return false;
  }
  map.easeTo = function (o, ev) {
    o = { ...(o || {}) }; if (o.easing === undefined) o.easing = EASE;
    const c = asLL(o.center); const keys = Object.keys(o).filter(k => k !== 'easing' && k !== 'duration' && k !== 'essential');
    if (c && keys.length === 1) {
      const r = motion.atCoord(c[0], c[1]);
      if (r && r.id === selId && !three) {
        // tweede keer binnen 1,4 s naar hetzelfde voertuig: dat is volgen (ui.js doet dat elke 900 ms)
        const now = performance.now(); const gap = lastFollowEase.id === r.id ? now - lastFollowEase.t : Infinity; const repeat = gap < Math.max(1400, followWindow()); if (lastFollowEase.id === r.id) noteCadence(gap); lastFollowEase = { id: r.id, t: now };
        if (repeat || (follow.id === r.id && follow.implicit)) { implicitFollow(r.id, false); return map; }
      }
    }
    yieldFollow();
    // een voertuig of oplegger die al in beeld is: de kaart blijft rustig staan (zoals bij een pin in Google Maps)
    if (c && o.zoom != null && o.pitch == null && o.bearing == null && !three && nearMarker(c) && inView(c[0], c[1], 56) && o.zoom <= map.getZoom() + 0.01) return map;
    if (c && o.duration !== 0 && !reducedMotion() && pxDist(c) > 1.6 * Math.max(W(), H())) { const d = clamp(o.duration ?? 900, 600, 900); easeUntil = performance.now() + d; return nativeFly({ ...o, duration: d, curve: 1.42, essential: false }, ev); }
    easeUntil = performance.now() + (o.duration ?? 500);
    return nativeEase(o, ev);
  };
  map.flyTo = function (o, ev) { yieldFollow(); easeUntil = performance.now() + ((o && o.duration) ?? 1500); return nativeFly({ easing: EASE, ...(o || {}) }, ev); };
  // API (K2): flyTo(doel, { zoom, duration, onlyIfHidden, mark }) vliegt in 600 tot 900 ms in de curve van de interface
  // naar een voertuig ('T-1002' of { id }), een losse oplegger ('O-5150'), een standplaats (naam of object), een DC of
  // winkel (id of object), een plaats ({ lon, lat }) of een punt ([lon, lat]), en markeert het doel kort met een ring die
  // uitdijt (een voertuig blijft gemarkeerd terwijl het rijdt). Bij minder beweging springt de camera en staat de ring stil.
  // Geeft false als het doel onbekend is.
  let mark = null;
  function resolveTarget(x, depth = 0) {
    if (x == null || depth > 2) return null;
    if (Array.isArray(x)) return typeof x[0] === 'number' ? { lon: x[0], lat: x[1], zoom: null } : null;
    if (typeof x === 'string') {
      const r = motion.get(x); if (r) return { lon: r.cx, lat: r.cy, id: x, vehicle: true };
      const tf = lastTrailers && lastTrailers.find(f => f.properties.id === x); if (tf) return { lon: tf.geometry.coordinates[0], lat: tf.geometry.coordinates[1], zoom: 16 };
      const sp = SP.find(q => q.n === x); if (sp) return { lon: sp.lon, lat: sp.lat, zoom: 15 };
      const d = dcById.get(x); if (d) return { lon: d.lon, lat: d.lat, zoom: 15.5 };
      const w = winkelById.get(x); if (w) return { lon: w.lon, lat: w.lat, zoom: 16.5 };
      // iets wat de app wel kent (een gekoppelde oplegger: het voertuig ervoor), via opts.resolve
      const o = opts.resolve ? opts.resolve(x) : null; return o && o !== x ? resolveTarget(o, depth + 1) : null;
    }
    if (typeof x === 'object') {
      if (typeof x.id === 'string' && motion.get(x.id)) return resolveTarget(x.id, depth + 1);
      if (x.vehicle && typeof x.vehicle.id === 'string' && motion.get(x.vehicle.id)) return resolveTarget(x.vehicle.id, depth + 1);
      const q = x.pos || x; const lon = q.lon ?? q.lng, lat = q.lat;
      if (typeof lon === 'number' && typeof lat === 'number') return { lon, lat, zoom: x.fleet !== undefined ? 15 : x.soort ? 15.5 : x.formule ? 16.5 : (x.r !== undefined || x.big !== undefined) ? 12 : null };
      if (x.id != null) return resolveTarget(String(x.id), depth + 1);
    }
    return null;
  }
  function flyTo(target, o = {}) {
    const t = resolveTarget(target); if (!t) return false;
    const zoom = o.zoom ?? (t.vehicle ? Math.max(map.getZoom(), 13.5) : t.zoom);
    const shown = inView(t.lon, t.lat, o.pad ?? 56) && (zoom == null || Math.abs(zoom - map.getZoom()) < 0.05);
    let dur = 0;
    if (!(o.onlyIfHidden && shown)) {
      // naar iets anders vliegen beëindigt het volgen (ook het volgen via follow(id)); naar het gevolgde voertuig niet
      if (follow.id && !(t.vehicle && t.id === follow.id)) stopFollow();
      dur = reducedMotion() || o.duration === 0 ? 0 : clamp(o.duration ?? 800, 600, 900); easeUntil = performance.now() + dur;
      const cam = { center: [t.lon, t.lat], duration: dur, easing: EASE, ...(zoom != null ? { zoom } : {}) };
      if (dur && pxDist(cam.center) > 1.6 * Math.max(W(), H())) nativeFly({ ...cam, curve: 1.42, essential: false }); else nativeEase(cam);
    }
    if (o.mark !== false) { mark = { id: t.vehicle ? t.id : null, lon: t.lon, lat: t.lat, t0: performance.now() + dur * 0.7 }; needBuild = true; kick(); }
    return true;
  }

  // ---------- bedieningselementen: zoomknoppen (200 ms), kompas, schaalbalk, compacte bronvermelding ----------
  class Controls {
    onAdd() {
      const el = document.createElement('div'); el.className = 'maplibregl-ctrl slz';
      el.innerHTML = '<button type="button" class="slz-c" aria-label="Noorden boven" title="Noorden boven" hidden><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3l3.6 9H8.4z" fill="#E3001F"/><path d="M12 21l-3.6-9h7.2z" fill="currentColor" opacity=".55"/></svg></button><div class="slz-g"><button type="button" class="slz-in" aria-label="Inzoomen" title="Inzoomen"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button type="button" class="slz-out" aria-label="Uitzoomen" title="Uitzoomen"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>';
      const d = () => (reducedMotion() ? 0 : 200);
      el.querySelector('.slz-in').addEventListener('click', e => map.zoomIn({ duration: d(), easing: EASE }, { originalEvent: e }));
      el.querySelector('.slz-out').addEventListener('click', e => map.zoomOut({ duration: d(), easing: EASE }, { originalEvent: e }));
      const comp = el.querySelector('.slz-c'), needle = comp.querySelector('svg');
      comp.addEventListener('click', () => map.easeTo({ bearing: 0, pitch: three ? map.getPitch() : 0, duration: reducedMotion() ? 0 : 500 }));
      const upd = () => { const b = map.getBearing(), p = map.getPitch(); comp.hidden = Math.abs(b) < 0.5 && (three || p < 0.5); needle.style.transform = `rotateX(${three ? 0 : p}deg) rotate(${-b}deg)`; };
      map.on('rotate', upd); map.on('pitch', upd); upd(); this.el = el; return el;
    }
    onRemove() { this.el.remove(); }
  }
  // onderaan zet MapLibre elk nieuw element bovenaan: eerst de schaalbalk, dan de knoppen (die komen erboven)
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-right');
  map.addControl(new Controls(), 'bottom-right');
  let attrCtl = null;
  const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>';
  // per basiskaart; Overture Maps blijft staan voor de eigen lagen erboven (terreinen, routes)
  function setAttribution() {
    if (attrCtl) map.removeControl(attrCtl);
    const text = base === 'online' ? `${OFM_ATTR} · Overture Maps` : base === 'luchtfoto' ? `${PHOTO_ATTR} · ${OSM_ATTR} · Overture Maps` : base === 'brt' ? `${BRT_ATTR} · Overture Maps` : `${OSM_ATTR} · Overture Maps · Natural Earth`;
    attrCtl = new maplibregl.AttributionControl({ compact: true, customAttribution: text });
    map.addControl(attrCtl, 'bottom-right');
    // MapLibre zet een nieuw element onderaan bovenaan de stapel; de bronvermelding hoort helemaal onderaan
    const el = map.getContainer().querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib'); if (el && el.parentNode) el.parentNode.appendChild(el);
  }
  setAttribution();

  // ---------- toestand ----------
  const CLEAR = 'rgba(0,0,0,0)', BLUE = () => (theme === 'dark' ? '#5B9BFF' : '#1A73E8');
  const stepAt = (f, a, b) => (f <= 0 ? ['step', ['line-progress'], b, 0, b] : f >= 1 ? ['step', ['line-progress'], a, 1, a] : ['step', ['line-progress'], a, f, b]);
  // het spoor: van onzichtbaar (20 minuten terug, f0 mag voor het begin van de lijn liggen) naar bijna dekkend bij het
  // voertuig (f), daarna meteen weer weg (over df, een halve pixel). Het spoor ligt boven het blauw: rijdt de rit terug
  // over dezelfde weg, dan blijft te zien waar het voertuig net reed.
  function trailGrad(f0, f, col, df) {
    if (!(f > 1e-6) || f0 >= f - 1e-6) return ['interpolate', ['linear'], ['line-progress'], 0, CLEAR, 1, CLEAR];
    const n = parseInt(col.slice(1), 16), c = a => `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${+a.toFixed(3)})`;
    const st = f0 > 1e-6 ? [0, c(0), f0, c(0), f, c(0.95)] : [0, c(0.95 * (-f0) / (f - f0)), f, c(0.95)];
    const f1 = f + Math.max(1e-7, df || 1e-4);
    if (f1 < 1) st.push(f1, c(0), 1, c(0));
    return ['interpolate', ['linear'], ['line-progress'], ...st];
  }
  const vlayer = createVehicleLayer('vehicles', () => { const z = map.getZoom(); return { pxm: 1 / (512 * Math.pow(2, z)), vs: lerpStops(z, VEH), ds: lerpStops(z, DOT) }; });
  let fallback = false; // de oude symboollaag als de WebGL-laag niet start
  const empty = fc([]);
  let lastDimsEmpty = true;
  const addTrailerIcons = () => { for (const [id, img] of Object.entries(trailerIcons(PAL[theme].stroke))) { if (map.hasImage(id)) map.removeImage(id); map.addImage(id, img, { pixelRatio: 2 }); } };
  const buildings = createBuildings2d(map, () => PAL[theme], () => applyBase());

  map.on('load', () => {
    const P = PAL[theme];
    addStyleImages(map, P); addTrailerIcons();
    addGround(map, P);
    // route van het geselecteerde voertuig (K3): gereden stuk grijs, komend stuk blauw, de laatste 20 minuten als een
    // vervagend spoor in de kleur van de status; een bron met lijnmaten, het verloop schuift per beeld mee
    map.addSource('route', { type: 'geojson', data: empty, lineMetrics: true }); map.addSource('stops', { type: 'geojson', data: empty });
    const rl = { 'line-cap': 'round', 'line-join': 'round' };
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-width': Z(8, 7, 14, 10), 'line-color': P.stroke }, layout: rl });
    map.addLayer({ id: 'route-done', type: 'line', source: 'route', paint: { 'line-width': Z(8, 3.2, 14, 5), 'line-color': P.done }, layout: rl });
    map.addLayer({ id: 'route-todo', type: 'line', source: 'route', paint: { 'line-width': Z(8, 3.6, 14, 5.5), 'line-gradient': stepAt(0, CLEAR, BLUE()) }, layout: rl });
    map.addLayer({ id: 'route-trail', type: 'line', source: 'route', paint: { 'line-width': Z(8, 3.6, 14, 5.5), 'line-gradient': trailGrad(0, 0, '#16A34A') }, layout: rl });
    map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': Z(8, 4, 14, 6), 'circle-color': ['case', ['get', 'done'], P.done, P.stroke], 'circle-stroke-color': ['case', ['get', 'done'], P.stroke, BLUE()], 'circle-stroke-width': Z(8, 2, 14, 2.6) } });
    // gebeurtenissen langs een rit (vertrek, aankomst, lossen, wachten, koppelen, laden, vertraging), via setEvents
    map.addSource('events', { type: 'geojson', data: empty });
    map.addLayer({ id: 'events', type: 'circle', source: 'events', paint: { 'circle-radius': Z(8, 4, 14, 6.5), 'circle-color': ['get', 'c'], 'circle-stroke-color': P.stroke, 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'events-lbl', type: 'symbol', source: 'events', minzoom: 11, layout: { 'text-field': ['get', 'label'], 'text-font': FONT.med, 'text-size': 11.5, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-max-width': 14, 'text-padding': 2 }, paint: { 'text-color': PAL[theme].text, 'text-halo-color': PAL[theme].halo, 'text-halo-width': 1.6 } });
    if (pendingEvents) { setEvents(pendingEvents); pendingEvents = null; }
    addLabels(map, P);
    addPois(map, P);
    // wat er op de plekken van de gekozen rit gebeurt (opts.events: fleet.eventsOf), alleen tekst naast de stops; boven de
    // plaatsnamen, zodat deze tekst voorgaat als ze botsen
    map.addSource('trip-events', { type: 'geojson', data: empty });
    map.addLayer({ id: 'trip-events', type: 'symbol', source: 'trip-events', minzoom: 9.5, layout: { 'text-field': ['get', 'label'], 'text-font': FONT.med, 'text-size': Z(9.5, 10.5, 13, 11.5), 'text-anchor': 'left', 'text-offset': [0.95, 0], 'text-max-width': 16, 'text-padding': 3, 'text-justify': 'left', 'symbol-sort-key': ['get', 'o'] }, paint: { 'text-color': ['case', ['get', 'warn'], P.warnText, ['get', 'past'], P.text3, P.text], 'text-halo-color': P.halo, 'text-halo-width': 1.6 } });
    // pauzeplekken (aan te zetten vanuit de weergave Pauzeplekken)
    map.addSource('rest', { type: 'geojson', data: empty });
    map.addLayer({ id: 'rest', type: 'circle', source: 'rest', layout: { visibility: 'none' }, paint: { 'circle-radius': Z(6, 4, 10, 6.5, 14, 9), 'circle-color': ['case', ['get', 'sel'], '#E3001F', '#4B5563'], 'circle-stroke-color': P.stroke, 'circle-stroke-width': 1.6 } });
    // voertuigen van andere standplaatsen, gedimd
    map.addSource('dim', { type: 'geojson', data: empty });
    map.addLayer({ id: 'dim', type: 'circle', source: 'dim', minzoom: 7, paint: { 'circle-radius': 2.4, 'circle-color': P.dim, 'circle-opacity': 0.45 } });
    // losse opleggers (laag aan te zetten)
    map.addSource('trailers', { type: 'geojson', data: empty });
    map.addLayer({ id: 'trailers', type: 'symbol', source: 'trailers', minzoom: 7.6, layout: { visibility: 'none', 'icon-image': ['concat', 'tr-', ['get', 'st']], 'icon-size': Z(7.6, 0.5, 11, 0.65, 14, 0.52, 15, 0.47, 16, 0.95, 17, 1.9, 18, 3.8), 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    // de voertuigen: de eigen WebGL-laag; lukt die niet, dan de symboollaag zoals voorheen (per stap, zonder tussenstanden)
    atlas = buildAtlas(ST, theme); vlayer.setAtlas(atlas);
    map.addLayer(vlayer.layer);
    map.addSource('trucks', { type: 'geojson', data: empty });
    map.addLayer({ id: 'trucks-fb', type: 'circle', source: 'trucks', layout: { visibility: 'none' }, paint: { 'circle-radius': Z(5.5, 2.4, 10, 3.6, 14, 5.2), 'circle-color': ['match', ['get', 'st'], ...Object.entries(ST).flatMap(([k, v]) => [k, v.color]), '#64748B'], 'circle-stroke-color': P.stroke, 'circle-stroke-width': 1.2 } });
    addDepots(map, P);
    if (!vlayer.ok()) useFallback();
    map.on('mousemove', onMove); map.getCanvas().addEventListener('mouseleave', () => setHoverId(null, null));
    map.on('click', onClick);
    map.on('move', () => { needBuild = true; kick(); }); map.on('resize', () => { needBuild = true; kick(); });
    map.on('data', e => {
      if (!e || !e.tile) return;
      if (e.sourceId === 'ofm') checkOnline();
      else if ((e.sourceId === 'luchtfoto' || e.sourceId === 'brt') && !SRC[e.sourceId].ok) { SRC[e.sourceId].ok = true; applyBase(); }
    });
    map.on('error', onError);
    for (const ev of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart']) map.on(ev, e => { if (e.originalEvent) gesture(true, ev); });
    for (const ev of ['dragend', 'rotateend', 'pitchend', 'zoomend']) map.on(ev, e => { if (e.originalEvent || gestureOn) gesture(false, ev); });
    ready = true; applyBase(); onReady.splice(0).forEach(f => f());
    if (lastTrucks) setTrucks(lastTrucks, lastDims || []);
  });
  function useFallback() { fallback = true; vlayer.setVisible(false); if (map.getLayer('trucks-fb')) map.setLayoutProperty('trucks-fb', 'visibility', three ? 'none' : 'visible'); if (lastTrucks && map.getSource('trucks')) map.getSource('trucks').setData(fc(lastTrucks)); }
  function onError(e) {
    const sid = e && (e.sourceId || (e.source && e.source.id) || (e.tile && e.tile.source));
    const u = String((e && e.error && (e.error.url || e.error.message)) || '');
    const which = sid === 'ofm' || /openfreemap/.test(u) ? 'online' : sid === 'luchtfoto' || /luchtfotorgb/.test(u) ? 'luchtfoto' : sid === 'brt' || /achtergrondkaart/.test(u) ? 'brt' : null;
    if (which) { srcError(which, u); return; }
    console.warn('kaart:', e && e.error ? e.error.message || e.error : e);
  }

  // ---------- basiskaart: ingebouwd, online (OpenFreeMap), luchtfoto of BRT (PDOK) ----------
  // Een online bron telt pas als hij werkt als de eerste tegel er is en klopt: bij OpenFreeMap een vectortegel met lagen
  // uit het OpenMapTiles-schema (een bron die wel antwoordt maar iets anders stuurt telt niet), bij een rasterbron een
  // plaatje dat MapLibre kon lezen. Tot dan blijft alles van de eigen kaart zichtbaar; daarna gaan bij OpenFreeMap en BRT
  // de eigen land, water, wegen en namen uit (anders dubbel). Mislukt het (fouten vóór de eerste goede tegel, of meer dan
  // twaalf daarna), dan terug naar de ingebouwde kaart; bij de luchtfoto eerst nog de foto van 25 cm.
  const COVER = new Set(['land', 'seam', 'water', 'urban', 'prov', 'nat', 'toegang', 'te', 'sec', 'se', 'prc', 'pr', 'trc', 'tr', 'mwc', 'mw', 'mwb', 'bld', 'bld-line', ...LABELS]);
  function applyBase() {
    if (!ready) return;
    if (tiles && base === 'online') ensureOnline();
    if (tiles && (base === 'luchtfoto' || base === 'brt')) addRaster(base);
    const covered = (base === 'online' && SRC.online.ok) || (base === 'brt' && SRC.brt.ok);
    const hide = id => (covered && COVER.has(id)) || (base === 'luchtfoto' && PHOTO_HIDE.has(id));
    for (const id of [...LABELS, ...GROUND, 'bld', 'bld-line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', hide(id) ? 'none' : 'visible');
    for (const id of OFM_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', base === 'online' ? 'visible' : 'none');
    for (const id of ['luchtfoto', 'brt']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', base === id ? 'visible' : 'none');
    setPhotoStyle(map, base === 'luchtfoto', theme, three); ensureOfm3d(); needBuild = true; kick();
  }
  // de lagen van OpenFreeMap pas bij de eerste keer online (een vectorbron vraagt zijn TileJSON meteen op), onder alle
  // eigen lagen
  function ensureOnline() { if (!map.getLayer('o-bg')) addOnline(map, PAL[theme], map.getLayer('land') ? 'land' : undefined, false); }
  // luchtfoto en BRT: boven land en water, onder het terrein en de wegen
  function addRaster(m) {
    if (!tiles || map.getSource(m)) return;
    map.addSource(m, { type: 'raster', tiles: [m === 'luchtfoto' ? photoUrl(SRC.luchtfoto.tier) : brtUrl(theme)], tileSize: 256, maxzoom: 19 });
    map.addLayer({ id: m, type: 'raster', source: m, layout: { visibility: 'none' }, paint: { 'raster-fade-duration': reducedMotion() ? 0 : 220 } }, map.getLayer('site') ? 'site' : undefined);
  }
  // klopt de tegel van OpenFreeMap? (lagen uit het schema; na zes tegels zonder: het is geen OpenFreeMap)
  function checkOnline() {
    const s = SRC.online; if (s.ok || s.failed || base !== 'online') return;
    s.seen++;
    if (OFM_LAYERS.some(l => map.querySourceFeatures('ofm', { sourceLayer: l }).length > 0)) { s.ok = true; applyBase(); }
    else if (s.seen >= 6) failBase('online');
  }
  function srcError(m, u) {
    const s = SRC[m];
    // een tegel van de foto van 8 cm die pas na de overstap op 25 cm misliep, telt niet meer
    if (m === 'luchtfoto' && /Actueel_ortho/.test(u || '') && !(u || '').includes(`/${PHOTO_LAYERS[s.tier]}/`)) return;
    s.errors++;
    if (base !== m || s.failed || (s.ok && s.errors <= 12)) return;
    if (m === 'luchtfoto' && s.tier === 0) { s.tier = 1; s.errors = 0; s.ok = false; const src = map.getSource('luchtfoto'); if (src && src.setTiles) src.setTiles([photoUrl(1)]); return; }
    failBase(m);
  }
  function failBase(m) { SRC[m].failed = true; if (base === m) setBase('kaart', true); opts.onTilesFailed && opts.onTilesFailed({ user: SRC[m].user, layer: m }); }
  function setBase(mode, auto) {
    let m = SRC[mode] ? mode : 'kaart';
    if (m !== 'kaart' && (!tiles || SRC[m].failed)) m = 'kaart';
    if (!auto && m !== 'kaart') SRC[m].user = true;
    if (m !== base) { base = m; setAttribution(); }
    applyBase();
  }
  const hasBase = m => m === 'kaart' || (tiles && !!SRC[m] && !SRC[m].failed);
  // in 3D bij OpenFreeMap de gebouwen uit dezelfde tegels als blokken (niet op de terreinen: daar tekent de 3D-wereld zijn
  // eigen gebouwen)
  function ensureOfm3d() {
    const want = three && base === 'online' && SRC.online.ok;
    if (want && !map.getLayer('ofm-3d') && map.getSource('ofm')) {
      const depots = { type: 'MultiPoint', coordinates: SP.map(sp => [sp.lon, sp.lat]) };
      map.addLayer({ id: 'ofm-3d', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building', minzoom: 13, filter: ['>', ['distance', depots], 700], paint: { 'fill-extrusion-color': PAL[theme].bld3d, 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': Z(13, 0, 13.6, 0.92) } }, map.getLayer(LABELS[0]) ? LABELS[0] : undefined);
    }
    if (map.getLayer('ofm-3d')) map.setLayoutProperty('ofm-3d', 'visibility', want ? 'visible' : 'none');
  }

  // ---------- thema en 3D-palet ----------
  function setTheme(t) {
    theme = t; const P = PAL[t]; if (scene3d) scene3d.setTheme(t); if (!wachtAf) wacht.style.background = P.land; if (!ready) return;
    setPhotoStyle(map, base === 'luchtfoto', t, three); addStyleImages(map, P); addTrailerIcons();
    map.setPaintProperty('stops', 'circle-color', ['case', ['get', 'done'], P.done, P.stroke]); map.setPaintProperty('stops', 'circle-stroke-color', ['case', ['get', 'done'], P.stroke, BLUE()]);
    map.setPaintProperty('route-casing', 'line-color', P.stroke); map.setPaintProperty('route-done', 'line-color', P.done);
    map.setPaintProperty('events', 'circle-stroke-color', P.stroke);
    map.setPaintProperty('trip-events', 'text-color', ['case', ['get', 'warn'], P.warnText, ['get', 'past'], P.text3, P.text]); map.setPaintProperty('trip-events', 'text-halo-color', P.halo); map.setPaintProperty('events-lbl', 'text-color', P.text); map.setPaintProperty('events-lbl', 'text-halo-color', P.halo);
    map.setPaintProperty('dim', 'circle-color', P.dim); map.setPaintProperty('rest', 'circle-stroke-color', P.stroke); map.setPaintProperty('trucks-fb', 'circle-stroke-color', P.stroke);
    gTodo = null; gTrail = null; updateRouteGrad(true);
    atlas = buildAtlas(ST, t); vlayer.setAtlas(atlas); needBuild = true; kick();
    const brt = map.getSource('brt'); if (brt && brt.setTiles) brt.setTiles([brtUrl(t)]);
  }

  // ---------- voertuigen: interpolatie per beeld ----------
  let buildMs = 0, stepMs = 0; // gemiddelde tijd per beeld (voertuiglaag en spoor vullen) en per stap (nieuwe standen), in ms
  let lastTrucks = null, lastDims = null, needBuild = false, raf = 0, lastBuild = 0, frameEma = 16, lastFrame = 0, heavy = false, builds = 0, steps = 0;
  let wasMoving = false;
  const shown = () => { const el = map.getContainer(); return !(typeof document !== 'undefined' && document.hidden) && el.offsetWidth > 0 && el.offsetHeight > 0 && !!el.offsetParent; };
  // de plekken aan de docks (voor elk soort voertuig): daarheen en daarvandaan springt een voertuig, het glijdt niet
  // (en welk dock het is, voor de 3D-wereld: die zet het voertuig achteruit tegen die deur)
  let dockKeys = null;
  const dockAt = (x, y) => {
    if (!dockKeys) { dockKeys = new Map(); for (const sp of SP) for (let n = 1; sp.dockPlek && n <= sp.dockPlek.length; n++) for (const k of ['trekker', 'bakwagen', 'bus']) { const q = dockPos(sp, n, k); if (q) dockKeys.set(q.lon + ',' + q.lat, n); } }
    return dockKeys.get(x + ',' + y) || null;
  };
  const atDock = (x, y) => dockAt(x, y) !== null;
  function setTrucks(features, dimFeatures) {
    lastTrucks = features; lastDims = dimFeatures; if (!ready) return; steps++;
    const dimsEmpty = !dimFeatures || !dimFeatures.length; if (!(dimsEmpty && lastDimsEmpty)) map.getSource('dim').setData(fc(dimFeatures || [])); lastDimsEmpty = dimsEmpty;
    const c = map.getCenter(); const vis = shown();
    const t0 = performance.now();
    const changed = motion.update(features, { now: t0, simTime: clock ? clock.simTime : null, speed: clock ? clock.speed : 12, zoom: map.getZoom(), lat: c.lat, snap: reducedMotion() || !vis, snapAt: atDock, lane: laneShift });
    stepMs = stepMs * 0.9 + (performance.now() - t0) * 0.1;
    if (!changed) return; // stilstaande klok: niets opnieuw tekenen
    if (fallback) map.getSource('trucks').setData(fc(features));
    needBuild = true; if (vis) kick(); else if (three && scene3d) push3d();
  }
  // Eén lus per beeld. Tijdens de lus staat raf op -1: een 'move' van de eigen camera (volgen) roept kick() aan en mag dan
  // geen tweede lus plannen; aan het eind plant de lus zichzelf hooguit één keer opnieuw.
  function kick() { if (!raf && ready) raf = requestAnimationFrame(loop); }
  function loop(now) {
    raf = -1; let again = false;
    try { again = frameStep(now); } catch (e) { console.warn('kaart: beeld', e); }
    raf = again ? requestAnimationFrame(loop) : 0; if (!again) lastFrame = 0;
  }
  function frameStep(now) {
    if (!ready) return false;
    if (!shown()) { motion.snapAll(); return false; } // andere weergave of verborgen tabblad: niets doen
    const dt = lastFrame ? now - lastFrame : 16; lastFrame = now; frameEma = frameEma * 0.9 + clamp(dt, 4, 250) * 0.1; heavy = frameEma > 24;
    const moving = motion.tick(now);
    // het beeld waarop de tussenstanden hun doel bereiken moet ook getekend worden: anders blijft het voertuig (2D en 3D) één
    // beeld voor zijn echte stand staan tot de volgende stap, en wijst een klik of de hover ernaast
    if (wasMoving && !moving) needBuild = true; wasMoving = moving;
    const following = followTick(now, dt);
    const anim = (hoverId && now - hoverSince < 160) || (hoverOut && now - hoverOut.t < 160) || ((selId || selPoint) && now - selSince < 260) || !!mark;
    const busy = moving || following || anim;
    // plafond van 30 beelden per seconde als het zwaar wordt (zwakke laptop): dan een beeld overslaan
    if (needBuild || (busy && (!heavy || now - lastBuild > 30))) { needBuild = false; const t0 = performance.now(); build(now); buildMs = buildMs * 0.9 + (performance.now() - t0) * 0.1; lastBuild = now; }
    return busy || needBuild;
  }
  // stip ver weg en voor stilstaande voertuigen; dichtbij (vanaf zoom 14,5) staan ook geparkeerde voertuigen als voertuig
  // in hun parkeerrij, met de neus in de richting van de rij
  // op de luchtfoto vanaf zoom 16 alle voertuigen op ware grootte (trueSize), als blok in de echte verhouding
  // vanaf zoom 16 een knipoog naar de huisstijl (livery, motion.js): een wit cabinedak met een goudgele band en het
  // beeldmerk op de oplegger; de statuskleur blijft de vulling
  let parkedAsVehicle = false, sizeMpp = 1, sizeVs = 1, trueSize = false, livery = false;
  const sizeAt = (z, lat) => { sizeMpp = metersPerPixel(lat, z); sizeVs = lerpStops(z, VEH); trueSize = base === 'luchtfoto' && z >= 16; livery = z >= 16; };
  // maatfactor t.o.v. de gewone iconmaat: geparkeerd op ware grootte (minstens een paar pixels), rijdend minstens de iconmaat
  const sizeOf = (r, s) => { const real = (REAL[r.k] || REAL.trekker) / sizeMpp / s.h / sizeVs; return r.mv && !trueSize ? Math.max(1, real) : Math.max(0.1, real); };
  const spriteOf = (r, far) => {
    const S = atlas.sprites; const st = ST[r.st] ? r.st : 'terrein'; const dot = () => ({ s: S.get('dot-' + st) || S.get('dot-terrein'), dot: true });
    if (far || (!r.mv && !parkedAsVehicle)) return dot();
    const s = ((!r.mv || trueSize) && ((livery && S.get(`lpark-${r.k}-${st}`)) || S.get(`park-${r.k}-${st}`) || S.get(`park-trekker-${st}`))) || (livery && S.get(`liv-${r.k}-${st}`)) || S.get(`veh-${r.k}-${st}`) || S.get(`veh-trekker-${st}`);
    return s ? { s, dot: false } : dot();
  };
  // Volgorde per zoomniveau, zoals in Google Maps: ver uitgezoomd gaan plaatsnamen voor (standplaatsen en voertuigen
  // eronder, de namen blijven leesbaar); vanaf zoom 7,8 staan de standplaatsen met hun naam bovenop, vanaf zoom 10 ook de
  // voertuigen boven de plaatsnamen.
  let orderState = -1;
  function orderVehicles(force) {
    if (!map.getLayer('vehicles')) return; const z = map.getZoom(); const st = z < 7.8 ? 0 : z < 10 ? 1 : 2;
    if (st === orderState && !force) return; orderState = st; const first = LABELS.find(id => map.getLayer(id));
    const sp = ['dc', 'sp', 'sp-on'].filter(id => map.getLayer(id));
    for (const id of sp) map.moveLayer(id, st === 0 && first ? first : undefined);
    map.moveLayer('vehicles', st === 1 && first ? first : sp[0]);
    // de namen van de afdelingen (vanaf zoom 16) boven de voertuigen, onder de standplaatsen
    if (st === 2 && map.getLayer('afd')) map.moveLayer('afd', sp[0]);
  }
  function build(now) {
    builds++; orderVehicles();
    if (three || fallback || !atlas) { if (three && scene3d) push3d(); vlayer.begin(0.5, 0.5); vlayer.end(); map.triggerRepaint(); return; }
    const z = map.getZoom(), far = z < DOTS_BELOW, c = map.getCenter(), RM = reducedMotion(); const S = atlas.sprites; parkedAsVehicle = z >= 14.5; sizeAt(z, c.lat);
    vlayer.begin(mercX(c.lng), mercY(c.lat));
    // halo onder het aangewezen voertuig (zacht in- en uitfaden)
    const halo = (r, a) => { const { s, dot } = spriteOf(r, far); const L = Math.max(s.w, s.h) * (dot ? 1 : sizeOf(r, s)); vlayer.push(mercX(r.cx), mercY(r.cy), 0, S.get('halo').i, (L + (dot ? 22 : 18)) / 70, a, dot); };
    const hr = hoverId && motion.get(hoverId);
    if (hr) halo(hr, RM ? 1 : EASE(clamp((now - hoverSince) / 150, 0, 1)));
    if (hoverOut && !RM && now - hoverOut.t < 150) { const r = motion.get(hoverOut.id); if (r && r.id !== hoverId) halo(r, 1 - EASE((now - hoverOut.t) / 150)); }
    for (const r of motion.order()) {
      const { s, dot } = spriteOf(r, far);
      vlayer.push(mercX(r.cx), mercY(r.cy), dot ? 0 : r.cb * Math.PI / 180, s.i, (dot ? 1 : sizeOf(r, s)) * (r.id === selId ? 1.18 : 1), r.st === 'terrein' ? 0.9 : 1, dot);
    }
    // ring om het geselecteerde voertuig (of om het geselecteerde punt, bijvoorbeeld een oplegger)
    const ringK = RM ? 1 : 1 + 0.14 * (1 - EASE(clamp((now - selSince) / 240, 0, 1)));
    const sr = selId && motion.get(selId);
    if (sr) { const { s, dot } = spriteOf(sr, far); const L = Math.max(s.w, s.h) * (dot ? 1 : sizeOf(sr, s)) * 1.18; vlayer.push(mercX(sr.cx), mercY(sr.cy), 0, S.get('ring').i, (L + (dot ? 14 : 12)) / 54 * ringK, 1, dot); }
    else if (selPoint) vlayer.push(mercX(selPoint[0]), mercY(selPoint[1]), 0, S.get('ring').i, 26 / 54 * ringK, 1, true);
    // de markering van flyTo: een ring die twee keer uitdijt en vervaagt (minder beweging: een stilstaande ring)
    if (mark) {
      const age = now - mark.t0, mr = mark.id && motion.get(mark.id); const lon = mr ? mr.cx : mark.lon, lat = mr ? mr.cy : mark.lat;
      if (age > 1900) mark = null;
      else if (age >= 0) {
        if (RM) vlayer.push(mercX(lon), mercY(lat), 0, S.get('ring').i, 0.9, 1, true);
        else for (const off of [0, 450]) { const u = (age - off) / 1200; if (u < 0 || u > 1) continue; vlayer.push(mercX(lon), mercY(lat), 0, S.get('ring').i, 0.6 + 1.1 * EASE(u), 1 - u, true); }
      }
    }
    vlayer.end();
    updateRouteGrad(false);
    map.triggerRepaint();
  }
  // de 3D-wereld krijgt per beeld dezelfde getoonde standen
  let list3d = [];
  function push3d() {
    if (!scene3d) return; const L = motion.order(); if (list3d.length !== L.length) list3d = new Array(L.length);
    for (let i = 0; i < L.length; i++) {
      const r = L[i]; let v = r.v3; if (!v) v = r.v3 = { id: r.id }; v.st = r.st; v.b = r.cb; v.k = r.k; v.base = r.base; v.lon = r.cx; v.lat = r.cy;
      const pd = r.f && r.f.properties.dock; v.dock = pd != null ? pd : r.mv ? null : dockAt(r.tx, r.ty); list3d[i] = v;
    }
    scene3d.setVehicles(list3d);
  }
  // opleggers voor de 3D-wereld, met hun koers (en dock) uit de feature of anders uit opts.trailerPose(id) (main.js: de vloot)
  const trl3d = features => features.map(f => {
    const q = f.properties; const pose = (q.b == null || q.dock === undefined) && opts.trailerPose ? opts.trailerPose(q.id) : null;
    return { id: q.id, st: q.st, base: q.base, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], b: q.b != null ? q.b : pose && pose.b != null ? pose.b : undefined, dock: q.dock != null ? q.dock : pose && pose.dock != null ? pose.dock : undefined };
  });
  let lastTrailers = null;
  function setTrailers(features) { lastTrailers = features; if (!ready) return; map.getSource('trailers').setData(fc(features)); if (scene3d && three) scene3d.setTrailers(trl3d(features)); }
  function showTrailers(v) { trailersOn = v; if (!ready) return; map.setLayoutProperty('trailers', 'visibility', v && !three ? 'visible' : 'none'); }

  // ---------- aanwijzen en klikken (2D; in 3D doet de 3D-wereld dat zelf) ----------
  function pickVehicle(pt) {
    if (three || fallback || !atlas || !pt) return null;
    const z = map.getZoom(), far = z < DOTS_BELOW, vs = lerpStops(z, VEH), ds = lerpStops(z, DOT), bearing = map.getBearing(); parkedAsVehicle = z >= 14.5; sizeAt(z, map.getCenter().lat);
    const box = 34; const corners = [[pt.x - box, pt.y - box], [pt.x + box, pt.y - box], [pt.x - box, pt.y + box], [pt.x + box, pt.y + box]].map(p => map.unproject(p));
    const x0 = Math.min(...corners.map(p => p.lng)), x1 = Math.max(...corners.map(p => p.lng)), y0 = Math.min(...corners.map(p => p.lat)), y1 = Math.max(...corners.map(p => p.lat));
    const L = motion.order(); let best = null, bestD = Infinity;
    for (let i = L.length - 1; i >= 0; i--) {
      const r = L[i]; if (r.cx < x0 || r.cx > x1 || r.cy < y0 || r.cy > y1) continue;
      const p = map.project([r.cx, r.cy]); const dx = pt.x - p.x, dy = pt.y - p.y; const { s, dot } = spriteOf(r, far);
      let hit = false, d = Math.hypot(dx, dy);
      if (dot) hit = d <= 4.4 * ds + 5;
      else { const k = vs * sizeOf(r, s) * (r.id === selId ? 1.18 : 1), a = (r.cb - bearing) * Math.PI / 180, lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a); hit = Math.abs(lx) <= s.w / 2 * k + 3 && Math.abs(ly) <= s.h / 2 * k + 3; }
      if (hit) { if (r.mv) return r.id; if (d < bestD) { bestD = d; best = r.id; } } // rijdende voertuigen liggen bovenop
    }
    return best;
  }
  const interactive = () => ['sp', 'trailers', 'rest', ...(opts.onSelectPlace ? ['dc', 'winkel'] : [])].filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
  let movePt = null, movePending = false;
  function onMove(e) { movePt = e.point; if (!movePending) { movePending = true; requestAnimationFrame(() => { movePending = false; hoverAt(movePt); }); } }
  function hoverAt(pt) {
    if (!pt || three) return;
    const id = pickVehicle(pt);
    if (id) { setHoverId(id, pt, false, anchorOf(id)); map.getCanvas().style.cursor = 'pointer'; return; }
    setHoverId(null, null);
    const f = map.queryRenderedFeatures([[pt.x - 3, pt.y - 3], [pt.x + 3, pt.y + 3]], { layers: interactive() });
    map.getCanvas().style.cursor = f.length ? 'pointer' : '';
  }
  // het voertuig op het scherm, voor een kaartje dat eraan vastzit (K5): x, y en r in pixels van de kaart, en
  // getBoundingClientRect() in pixels van het venster, zodat het meteen een virtueel element voor Floating UI is. De
  // rechthoek rekent elke keer opnieuw: met autoUpdate(..., { animationFrame: true }) rijdt het kaartje mee.
  function where(id) {
    const r = motion.get(id); if (!r || !atlas) return null; const z = map.getZoom(), far = z < DOTS_BELOW; sizeAt(z, map.getCenter().lat);
    const { s, dot } = spriteOf(r, far); const p = map.project([r.cx, r.cy]);
    const k = (dot ? lerpStops(z, DOT) : lerpStops(z, VEH) * sizeOf(r, s)) * (id === selId ? 1.18 : 1);
    return { x: p.x, y: p.y, r: Math.max(6, Math.max(s.w, s.h) * k / 2) };
  }
  function anchorOf(id) {
    const a = where(id); if (!a) return null; const el = map.getContainer(); let last = a;
    return {
      id, x: a.x, y: a.y, r: a.r, contextElement: el,
      getBoundingClientRect() { const q = where(id) || last; last = q; const b = el.getBoundingClientRect(); const x = b.left + q.x - q.r, y = b.top + q.y - q.r, w = 2 * q.r; return { x, y, left: x, top: y, right: x + w, bottom: y + w, width: w, height: w }; },
    };
  }
  function setHoverId(id, pt, silent, anchor) {
    const now = performance.now();
    if (id !== hoverId) { if (hoverId) hoverOut = { id: hoverId, t: now }; hoverId = id; hoverSince = now; needBuild = true; kick(); }
    if (silent) return;
    if (opts.onHover) { if (id) opts.onHover(id, pt, anchor || null); else if (hoverWasOn) opts.onHover(null); }
    hoverWasOn = !!id; if (!id && !three) map.getCanvas().style.cursor = '';
  }
  function onClick(e) {
    if (e.defaultPrevented) return;
    const id = pickVehicle(e.point);
    if (id) { e.preventDefault(); opts.onSelectTruck && opts.onSelectTruck(id); return; }
    const f = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: interactive() });
    const hit = f[0];
    if (hit) {
      e.preventDefault();
      if (hit.layer.id === 'sp') { const sp = SP.find(s => s.n === hit.properties.n); if (sp && opts.onSelectSp) opts.onSelectSp(sp); }
      else if (hit.layer.id === 'trailers') opts.onSelectTrailer && opts.onSelectTrailer(hit.properties.id);
      else if (hit.layer.id === 'rest') opts.onSelectRest && opts.onSelectRest(hit.properties.id);
      else if (hit.layer.id === 'dc') { const d = dcById.get(hit.properties.id); if (d) opts.onSelectPlace({ type: 'dc', ...d }); }
      else if (hit.layer.id === 'winkel') { const w = winkelById.get(hit.properties.id); if (w) opts.onSelectPlace({ type: 'winkel', ...w }); }
      return;
    }
    opts.onMapClick && opts.onMapClick();
  }
  // API: de halo van buitenaf, bijvoorbeeld bij het aanwijzen van een rij in een tabel (zonder terugmelding naar onHover)
  function setHover(id) { setHoverId(id || null, null, true); }

  // ---------- selectie ----------
  function setSelected(feature) {
    let id = null, pt = null;
    if (feature && feature.geometry) { const [lon, lat] = feature.geometry.coordinates; const r = motion.atCoord(lon, lat); if (r) id = r.id; else pt = [lon, lat]; }
    applySel(id, pt);
  }
  function setSelectedId(id) { applySel(id || null, null); }
  function applySel(id, pt) {
    const samePt = (pt && pt[0]) === (selPoint && selPoint[0]) && (pt && pt[1]) === (selPoint && selPoint[1]);
    if (id === selId && samePt) return;
    if (id !== selId || (pt && !selPoint)) selSince = performance.now();
    if (follow.id && follow.implicit && follow.id !== id) stopFollow();
    selId = id; selPoint = pt; needBuild = true; kick(); sel3d();
  }
  // de 3D-wereld markeert de selectie zelf: een voertuig, of een losse oplegger op het gekozen punt
  function sel3d() {
    if (!scene3d || !scene3d.setSelected) return;
    let id = selId;
    if (!id && selPoint && lastTrailers) { const f = lastTrailers.find(x => Math.abs(x.geometry.coordinates[0] - selPoint[0]) < 1e-9 && Math.abs(x.geometry.coordinates[1] - selPoint[1]) < 1e-9); if (f) id = f.properties.id; }
    scene3d.setSelected(id || null);
  }

  // ---------- route en spoor: het verloop schuift per beeld mee met het getoonde voertuig ----------
  // Vier lagen op dezelfde lijn: de witte rand en de grijze lijn onder de hele rit, het komende stuk in blauw met een
  // scherpe overgang bij het voertuig (step, fijne textuur), en bovenop het spoor van de laatste 20 minuten (interpolate)
  // dat naar het voertuig toe opkomt in de kleur van zijn status en daar ophoudt. Alleen blauw en spoor schuiven per beeld
  // mee; het grijs is iets smaller dan het blauw, zodat er langs het blauwe stuk niets doorschemert.
  let route = null, gTodo = null, gTrail = null, laneCache = new Map();
  const mlen = (a, b) => Math.hypot(mercX(a[0]) - mercX(b[0]), mercY(a[1]) - mercY(b[1]));
  const shiftBy = (p, o) => (o ? [p[0] + o[0], p[1] + o[1]] : p);
  const bearingOf = (a, b) => { const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180); return (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180 / Math.PI + 360) % 360; };
  const defaultV = lat => 70000 / 60 / (40075016.686 * Math.cos(lat * Math.PI / 180)); // 70 km/u in Mercator per minuut
  function setRoute(done, todo, stops) {
    if (!ready) return;
    map.getSource('stops').setData(fc((stops || []).map(s => ({ type: 'Feature', properties: { done: !!s.done }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } }))));
    if (!done && !todo) { if (route) { route = null; map.getSource('route').setData(empty); } updateTripEvents(true); return; }
    const d = done || [], t = todo || []; const raw = [...d.slice(0, Math.max(0, d.length - 1)), ...(t.length ? t : d.slice(-1))];
    const atRaw = d.length ? d[d.length - 1] : t[0], k = d.length ? d.length - 1 : 0;
    const sig = raw.length > 1 ? `${raw[0]}|${raw[raw.length - 1]}|${d.length + t.length}` : '';
    // de route ligt op de rijbaan van het voertuig, zoals het voertuig zelf (rechts rijden): elk punt verschoven met de
    // richting van de route daar; per rit onthouden, alleen het punt van het voertuig is elke stap nieuw (met de koers van
    // het getoonde voertuig, zodat het spoor precies bij het voertuig ophoudt)
    if (!route || route.sig !== sig) laneCache = new Map();
    const sr = selId && motion.get(selId); const atB = sr && sr.tx === atRaw[0] && sr.ty === atRaw[1] && sr.mv ? sr.tb : null;
    const coords = raw.map((p, i) => {
      if (i === k && atB != null) return shiftBy(p, laneShift(p[0], p[1], atB));
      const key = p[0] + ',' + p[1]; let q = i === k ? null : laneCache.get(key); if (q) return q;
      const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)]; q = shiftBy(p, a === b ? null : laneShift(p[0], p[1], bearingOf(a, b)));
      if (i !== k) laneCache.set(key, q); return q;
    });
    let sj = 0; for (let i = 1; i <= k; i++) sj += mlen(coords[i - 1], coords[i]);
    let L = sj; for (let i = k + 1; i < coords.length; i++) L += mlen(coords[i - 1], coords[i]);
    const at = coords[k];
    // dezelfde lijn als de vorige stap (alleen het punt van het voertuig schuift): de bron niet opnieuw zetten
    const same = route && route.sig === sig && Math.abs(route.L - L) < route.L * 1e-3;
    if (!same) map.getSource('route').setData(fc(coords.length > 1 ? [line(coords)] : []));
    // waar het voertuig de afgelopen minuten op de route was (een punt per 0,2 minuut van de klok), voor het spoor; een
    // sprong in de tijd of een andere rit begint opnieuw
    const T = clock ? clock.simTime : null; let hist = same && route.hist ? route.hist : [];
    if (T != null) {
      const h = hist[hist.length - 1];
      if (h && (T < h[0] - 1e-6 || T - h[0] > 30 || sj < h[1] - L * 1e-4)) hist = [];
      const h2 = hist[hist.length - 1]; if (!h2 || T - h2[0] >= 0.2) hist.push([T, sj]);
      while (hist.length > 1 && hist[1][0] <= T - 20) hist.shift();
    }
    route = { sig, L: same ? route.L : L, sj, at, atRaw, coords, hist };
    updateRouteGrad(true);
    updateTripEvents(!same);
  }
  // ---------- wat er gebeurt op de plekken van de gekozen rit (opts.events: fleet.eventsOf) ----------
  // Per plek van de rit van nu een kort label in de tijdvolgorde: "Wacht 12 min · lossen 07:32–07:57", "Koppelen 05:40 ·
  // vertrek 05:52 · dock 3". Een lange wachttijd (15 minuten of meer) in oranje: daar ontstond de vertraging. Plekken
  // komen uit de standplaatsen (met het dock), winkels en DC's; 'onderweg' heeft geen vaste plek en blijft weg.
  let tripKey = '', tripT = 0;
  const plekPos = (id, dock) => {
    if (!id || typeof id !== 'string' || id === 'onderweg') return null;
    if (id.startsWith('sp:')) { const sp = SP.find(q => q.n === id.slice(3)); if (!sp) return null; const d = dock && sp.dockPlek && sp.dockPlek[dock - 1]; return d ? [d[0], d[1]] : [sp.lon, sp.lat]; }
    const q = winkelById.get(id) || dcById.get(id); return q ? [q.lon, q.lat] : null;
  };
  function tripEventFeatures(list) {
    const T = clock ? clock.simTime : null; if (!Array.isArray(list) || !list.length || T == null) return { key: '', feats: [] };
    const ritten = new Map();
    for (const e of list) { if (!e || e.rit == null || typeof e.t !== 'number') continue; let r = ritten.get(e.rit); if (!r) ritten.set(e.rit, r = { a: e.t, b: e.t }); r.a = Math.min(r.a, e.t); r.b = Math.max(r.b, e.t); }
    // de rit van nu (de tijden lopen in absolute minuten, ook voorbij middernacht)
    let rit = null, now = T;
    for (const off of [0, 1440, -1440]) { for (const [k, r] of ritten) if (T + off >= r.a - 5 && T + off <= r.b + 5) { rit = k; now = T + off; break; } if (rit != null) break; }
    if (rit == null) return { key: '', feats: [] };
    const groups = []; let g = null;
    for (const e of list) {
      if (e.rit !== rit) continue; const id = e.plek, pos = plekPos(id, e.dock); if (!pos) { g = null; continue; }
      if (!g || g.id !== id) { g = { id, pos, ev: [] }; groups.push(g); } g.ev.push(e);
    }
    const tt = t => hhmm(t), feats = [];
    groups.forEach((gr, i) => {
      const parts = []; let warn = false; const by = k => gr.ev.find(e => e.soort === k);
      // aankomst en vertrek alleen als ze iets toevoegen: niet als er in dezelfde minuut iets anders begint of eindigt
      const same = (e, j) => gr.ev.some((x, k) => k !== j && x !== e && Math.abs(x.t - e.t) < 1);
      for (const [j, e] of gr.ev.entries()) {
        if ((e.soort === 'aankomst' || e.soort === 'vertrek') && same(e, j)) continue;
        if (e.soort === 'wacht') { const m = Math.round(e.duur || 0); if (m > 0) { parts.push(`wacht ${m} min${e.reden === 'dock' ? ' op een dock' : ''} (${tt(e.t)}–${tt(e.t + m)})`); if (m >= 15) warn = true; } }
        else if (e.soort === 'los_start') { const b = by('los_eind'); parts.push(`lossen ${tt(e.t)}${b ? '–' + tt(b.t) : ''}`); }
        else if (e.soort === 'laad_start') { const b = by('laad_eind'); parts.push(`${e.wat === 'accu' ? 'accu laden' : 'laden'} ${tt(e.t)}${b ? '–' + tt(b.t) : ''}`); }
        else if (e.soort === 'pauze_start') { const b = by('pauze_eind'); parts.push(`pauze ${tt(e.t)}${b ? '–' + tt(b.t) : ''}`); }
        else if (e.soort === 'koppel') parts.push(`koppelen ${tt(e.t)}`);
        else if (e.soort === 'ontkoppel') parts.push(`ontkoppelen ${tt(e.t)}`);
        else if (e.soort === 'vertrek') parts.push(`vertrek ${tt(e.t)}`);
        else if (e.soort === 'aankomst') parts.push(`aankomst ${tt(e.t)}`);
      }
      const dock = gr.ev.map(e => e.dock).find(d => d); if (dock) parts.push(`dock ${dock}`);
      if (!parts.length) return;
      const label = parts.join(' · '); const last = gr.ev[gr.ev.length - 1].t;
      feats.push({ type: 'Feature', properties: { label: label[0].toUpperCase() + label.slice(1), warn, past: last <= now, o: warn ? 0 : 1 + i }, geometry: { type: 'Point', coordinates: gr.pos } });
    });
    return { key: `${rit}|${feats.map(f => f.properties.label + (f.properties.past ? '+' : '')).join('|')}`, feats };
  }
  function updateTripEvents(force) {
    if (!ready || !opts.events) return;
    if (!selId || !route) { if (tripKey) { tripKey = ''; map.getSource('trip-events').setData(empty); } return; }
    // opnieuw bij een andere rit of een ander voertuig, en verder hooguit eens per vijf seconden (verleden en toekomst)
    const now = performance.now(); if (!force && tripKey && tripKey.startsWith(selId + '#') && now - tripT < 5000) return; tripT = now;
    let list = null; try { list = opts.events(selId); } catch { list = null; }
    const { key, feats } = tripEventFeatures(list); const k = selId + '#' + key;
    if (k !== tripKey) { tripKey = k; map.getSource('trip-events').setData(fc(feats)); }
  }
  // waar het spoor begint (afstand langs de route): de plek van 20 minuten geleden; zo ver terug nog niets gezien (net
  // gekozen), dan aangevuld met 70 km/u
  function trailStart(Tn) {
    const v = defaultV(route.at[1]), h = route.hist, T20 = Tn - 20;
    if (Tn == null || !h || !h.length) return route.sj - v * 20;
    if (h[0][0] >= T20) return h[0][1] - v * (h[0][0] - T20);
    for (let i = 1; i < h.length; i++) if (h[i][0] >= T20) { const [ta, sa] = h[i - 1], [tb, sb] = h[i]; return sa + (sb - sa) * clamp((T20 - ta) / Math.max(1e-6, tb - ta), 0, 1); }
    return h[h.length - 1][1];
  }
  function updateRouteGrad(force) {
    if (!ready || !route || !route.L) return;
    let s = route.sj; const r = selId && motion.get(selId);
    if (r && Math.abs(r.tx - route.atRaw[0]) < 1e-9 && Math.abs(r.ty - route.atRaw[1]) < 1e-9) s = Math.max(0, route.sj - mlen([r.cx, r.cy], route.at));
    const f = clamp(s / route.L, 0, 1), f0 = Math.min(f, trailStart(clock ? clock.simTime : null) / route.L);
    const col = (r && ST[r.st] ? ST[r.st] : ST.onderweg || { color: '#16A34A' }).color;
    const ppx = route.L * 512 * Math.pow(2, map.getZoom());
    // blauw en het eind van het spoor bij elke 0,75 pixel die het voertuig opschuift, het begin van het spoor bij 3 pixels
    if (force || gTodo == null || Math.abs(f - gTodo) * ppx >= 0.75) { map.setPaintProperty('route-todo', 'line-gradient', stepAt(f, CLEAR, BLUE())); gTodo = f; }
    if (force || !gTrail || Math.abs(f - gTrail.f) * ppx >= 0.75 || Math.abs(f0 - gTrail.f0) * ppx >= 3 || col !== gTrail.col) { map.setPaintProperty('route-trail', 'line-gradient', trailGrad(f0, f, col, 0.5 / ppx)); gTrail = { f, f0, col }; }
  }
  // gebeurtenissen langs een rit (voor het terugspelen): [{ k, t, lon, lat | pos | plek | place, label }]; k is vertrek,
  // aankomst, lossen (ook lossen-start, lossen-eind), laden, wachten, pauze, koppelen, ontkoppelen of vertraging; t in
  // minuten van de klok. Zonder label: de soort en de tijd ("Lossen 14:05").
  const EVENT_COLORS = { vertrek: '#5F6775', aankomst: '#2563EB', lossen: '#2563EB', laden: '#0E9384', wachten: '#D97706', pauze: '#D97706', koppelen: '#7C3AED', koppel: '#7C3AED', ontkoppelen: '#7C3AED', ontkoppel: '#7C3AED', vertraging: '#DC2626' };
  const EVENT_NAMES = { vertrek: 'Vertrek', aankomst: 'Aankomst', lossen: 'Lossen', laden: 'Laden', wachten: 'Wachten', pauze: 'Pauze', koppelen: 'Koppelen', koppel: 'Koppelen', ontkoppelen: 'Ontkoppelen', ontkoppel: 'Ontkoppelen', vertraging: 'Vertraging' };
  const hhmm = t => { const m = ((Math.round(t) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const llOf = q => { if (!q || typeof q !== 'object') return null; if (Array.isArray(q)) return typeof q[0] === 'number' && typeof q[1] === 'number' ? q : null; const lon = q.lon ?? q.lng; return typeof lon === 'number' && typeof q.lat === 'number' ? [lon, q.lat] : null; };
  let pendingEvents = null;
  function setEvents(list) {
    if (!ready) { pendingEvents = list || []; return; }
    const feats = [];
    for (const e of (list || []).slice(0, 200)) {
      if (!e) continue; const c = llOf(e.pos) || llOf(e.plek) || llOf(e.place) || llOf(e.c) || llOf(e); if (!c) continue;
      const k = String(e.k || e.kind || e.soort || e.type || ''), base = k.split(/[-_ ]/)[0]; const t = e.t ?? e.tijd ?? e.at;
      const label = e.label || e.tekst || ((EVENT_NAMES[k] || EVENT_NAMES[base] || k) + (typeof t === 'number' ? ' ' + hhmm(t) : ''));
      feats.push({ type: 'Feature', properties: { k, label: String(label), c: EVENT_COLORS[k] || EVENT_COLORS[base] || '#5F6775' }, geometry: { type: 'Point', coordinates: [c[0], c[1]] } });
    }
    map.getSource('events').setData(fc(feats));
  }

  // ---------- volgen: de camera schuift per beeld mee met het getoonde voertuig ----------
  // 2D: alleen het midden, zonder draaien. 3D: schuin erachter (het voertuig iets onder het midden), de kaart draait
  // langzaam mee met de koers (hoogstens 60 graden per seconde). Begin en hervatten na slepen: een overgang van 800 ms in
  // de curve van de interface. Bij "minder beweging" springt de camera mee met de stappen en draait hij niet.
  function gesture(on, ev) {
    gestureOn = on;
    if (!follow.id) return;
    if (on && ev !== 'zoomstart') follow.paused = true;
    else if (!on) { follow.paused = false; startBlend(ev === 'zoomend' ? 350 : 700); }
  }
  function startBlend(ms) { follow.blend = { t0: performance.now(), dur: reducedMotion() ? 0 : ms, c: map.getCenter(), b: map.getBearing(), p: map.getPitch(), z: map.getZoom(), pad: map.getPadding() }; kick(); }
  let followStarts = 0, followStops = 0;
  function startFollow(id, rotate, implicit) {
    const was = follow.id; if (was !== id) followStarts++; follow.id = id; follow.rotate = !!rotate && !reducedMotion(); follow.implicit = !!implicit; follow.last = performance.now(); follow.paused = false;
    if (was !== id) {
      // scrollen en knijpen zoomen rond het midden, zodat het voertuig in beeld blijft
      try { map.scrollZoom.disable(); map.scrollZoom.enable({ around: 'center' }); map.touchZoomRotate.disable(); map.touchZoomRotate.enable({ around: 'center' }); } catch { /* oudere versie */ }
      startBlend(800);
    }
    kick();
  }
  function stopFollow() {
    if (!follow.id) return; follow.id = null; follow.blend = null; followStops++;
    try { map.scrollZoom.disable(); map.scrollZoom.enable(); map.touchZoomRotate.disable(); map.touchZoomRotate.enable(); } catch { /* oudere versie */ }
    const pad = map.getPadding(); if (pad && (pad.top || pad.bottom)) { const c = map.unproject([W() / 2, H() / 2]); nativeJump({ center: c, padding: { top: 0, bottom: 0, left: 0, right: 0 } }); }
  }
  let lastImplicit = { id: null, t: 0 };
  function implicitFollow(id, rotate) {
    const now = performance.now(); if (lastImplicit.id === id) noteCadence(now - lastImplicit.t); lastImplicit = { id, t: now }; follow.last = now;
    if (follow.id !== id || follow.rotate !== (!!rotate && !reducedMotion())) startFollow(id, rotate, true);
  }
  // De draaistap van de volgcamera rekent met de tijd sinds de vorige stap van deze lus (dt, hoogstens 250 ms): hoogstens
  // 60 graden per seconde tussen twee beelden, en na een haperend beeld geen sprong van tientallen graden. Niet met de tijd
  // sinds het laatst getekende beeld: tekent de kaart in hetzelfde beeld voor deze lus, dan is die tijd nul en draait de
  // camera helemaal niet mee (de volgorde van de beeldfuncties wisselt per beeld).
  function followTick(now, dt) {
    if (!follow.id) return false;
    if (follow.implicit && now - follow.last > followWindow()) { stopFollow(); return false; } // ui.js volgt niet meer
    const r = motion.get(follow.id); if (!r) return true;
    if (follow.paused || gestureOn || isAnimating()) return true;
    const offY = three ? Math.round(H() * 0.34) : 0;
    const target = { center: [r.cx, r.cy], bearing: map.getBearing(), pitch: map.getPitch(), zoom: map.getZoom(), padding: { top: offY, bottom: 0, left: 0, right: 0 } };
    if (three) { target.pitch = Math.max(map.getPitch(), 58); if (follow.rotate) { const d = angleDelta(map.getBearing(), r.cb); const rdt = clamp(dt, 0, 250); const step = clamp(d * (1 - Math.exp(-rdt / 450)), -0.06 * rdt, 0.06 * rdt); target.bearing = map.getBearing() + step; } }
    const B = follow.blend;
    if (B) {
      const u = B.dur ? EASE(clamp((now - B.t0) / B.dur, 0, 1)) : 1;
      const lerp = (a, b) => a + (b - a) * u;
      const cam = { center: [lerp(B.c.lng, r.cx), lerp(B.c.lat, r.cy)], padding: { top: lerp(B.pad.top || 0, offY), bottom: lerp(B.pad.bottom || 0, 0), left: lerp(B.pad.left || 0, 0), right: lerp(B.pad.right || 0, 0) } };
      // draaien ook tijdens de overgang hoogstens 60 graden per seconde (de koers kan achter de camera liggen)
      if (three) { cam.pitch = lerp(B.p, Math.max(B.p, 58)); cam.zoom = lerp(B.z, Math.max(B.z, 14.2)); if (follow.rotate) cam.bearing = target.bearing; }
      nativeJump(cam); if (u >= 1) follow.blend = null; return true;
    }
    nativeJump(target);
    return true;
  }
  // API: follow(id, { rotate }) volgt tot follow(null); followCam(pos, duur, draaien) is de oude vorm (ui.js, elke 900 ms)
  function followApi(id, o = {}) { if (!id) { stopFollow(); return; } startFollow(id, o.rotate ?? three, false); }
  function followCam(pos, duration, rotate) {
    const r = pos && motion.atCoord(pos.lon, pos.lat);
    if (r) { implicitFollow(r.id, rotate); return; }
    map.easeTo({ center: [pos.lon, pos.lat], bearing: rotate ? pos.bearing : map.getBearing(), pitch: Math.max(map.getPitch(), 58), zoom: Math.max(map.getZoom(), 14.2), offset: [0, Math.round(H() * 0.17)], duration });
  }

  // ---------- 3D-wereld ----------
  // De 3D-wereld (three.js) wordt pas geladen bij de eerste keer aanzetten: wie 3D niet gebruikt, laadt die code niet.
  let loading3d = null;
  function set3d(v) {
    three = !!v; if (!ready) { onReady.push(() => set3d(three)); return; }
    if (three && !scene3d) {
      if (!loading3d) loading3d = import('./scene3d.js').then(mod => { scene3d = mod.createScene3d(map, maplibregl, { theme, klok: clock || null, data: { SP, ST, TRST, urban, WINKELS, DCS, laadGebouwen }, onSelectTruck: opts.onSelectTruck, onSelectTrailer: opts.onSelectTrailer, onHover: opts.onHover }); raiseLabels(); apply3d(); sel3d(); }).catch(err => { console.warn('3D-wereld niet geladen', err); loading3d = null; three = false; apply3d(); if (opts.on3dFailed) opts.on3dFailed(); });
      return;
    }
    apply3d();
  }
  // tekst en standplaatsen boven de 3D-wereld, zodat namen leesbaar blijven
  function raiseLabels() { for (const id of [...LABELS, 'winkel', 'dc', 'trip-events', 'events-lbl', 'sp', 'sp-on']) if (map.getLayer(id)) map.moveLayer(id); orderVehicles(true); }
  function apply3d() {
    if (scene3d) { scene3d.setTheme(theme); scene3d.enable(three); if (three) { push3d(); if (lastTrailers) scene3d.setTrailers(trl3d(lastTrailers)); } }
    vlayer.setVisible(!three && !fallback); if (fallback && map.getLayer('trucks-fb')) map.setLayoutProperty('trucks-fb', 'visibility', three ? 'none' : 'visible');
    map.setLayoutProperty('trailers', 'visibility', trailersOn && !three ? 'visible' : 'none');
    // in 3D staan de afdelingen op bordjes in de 3D-wereld; de platte namen dan weg
    if (map.getLayer('afd')) map.setLayoutProperty('afd', 'visibility', three ? 'none' : 'visible');
    if (three) setHoverId(null, null);
    setPhotoStyle(map, base === 'luchtfoto', theme, three); ensureOfm3d(); needBuild = true; kick();
  }

  function highlightSp(name) { if (ready) highlightDepot(map, name); else onReady.push(() => highlightDepot(map, name)); }
  function setRest(places, selRestId) { if (!ready) return; map.getSource('rest').setData(fc(places.map(p => ({ type: 'Feature', properties: { id: p.id, sel: p.id === selRestId }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })))); }
  function showRest(v) { if (!ready) return; map.setLayoutProperty('rest', 'visibility', v ? 'visible' : 'none'); }
  function fitSps(list, pad = 60) { if (!list.length) return; const b = new maplibregl.LngLatBounds(); for (const s of list) b.extend([s.lon, s.lat]); map.fitBounds(b, { padding: pad, maxZoom: 10.5, duration: reducedMotion() ? 0 : 800, easing: EASE }); }
  const whenReady = f => ready ? f() : onReady.push(f);
  // de getoonde stand, en waar het voertuig bij deze stap heen rijdt (tlon, tlat: de stap op zijn rijbaan)
  function vehiclePos(id) { const r = motion.get(id); if (!r) return null; motion.sample(r, performance.now()); return { lon: r.cx, lat: r.cy, bearing: r.cb, st: r.st, tlon: r.tx + r.tox, tlat: r.ty + r.toy }; }
  function debug() { return { mark: !!mark, steps, builds, drawn: vlayer.count(), vehicles: motion.order().length, interval: Math.round(motion.interval()), frameMs: Math.round(frameEma * 10) / 10, buildMs: Math.round(buildMs * 100) / 100, stepMs: Math.round(stepMs * 100) / 100, lane: { ...laneStats }, heavy, fallback, follow: follow.id, followImplicit: follow.implicit, followRotate: follow.rotate, followBlend: !!follow.blend, followPaused: follow.paused, followStarts, followStops, followWindow: Math.round(followWindow()), easing: isAnimating(), gesture: gestureOn, sel: selId, hover: hoverId, base, src: JSON.parse(JSON.stringify(SRC)), online: base === 'online', onlineFailed: SRC.online.failed, tilesOk: SRC.online.ok, ofm: !!map.getSource('ofm'), buildings: buildings.state(), three }; }

  return {
    map, setTheme, setOnline: v => setBase(v ? 'online' : base === 'online' ? 'kaart' : base, false), setBase: m => setBase(m, false), base: () => base, hasBase, whenReady, setTrucks, setTrailers, showTrailers, trailersOn: () => trailersOn, setSelected, setRoute, highlightSp, fitSps, setRest, showRest,
    isOnline: () => base === 'online', hasOnline: () => hasBase('online'), hasTiles: () => tiles, set3d, is3d: () => three, has3d: () => true, followCam, scene3d: () => scene3d,
    follow: followApi, following: () => follow.id, flyTo, setSelectedId, setHover, vehiclePos, inView, pick: pt => pickVehicle(pt), setEvents, anchor: anchorOf, debug,
  };
}
