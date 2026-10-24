// Kaart: MapLibre GL met een ingebouwde basiskaart uit echte data (Overture Maps / OpenStreetMap: wegen en water;
// Natural Earth: provincies en bebouwing). Werkt zonder internet; met internet kunnen OpenStreetMap-tegels eroverheen.
import * as maplibregl from 'maplibre-gl';
import workerSrc from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import prov from './data/provinces.json';
import urban from './data/urban.json';
import water from './data/water.json';
import display from './data/roads_display.json';
import { allEdges, edgeGeom, decode } from './roads.js';
import { SP, CITIES, ST } from './places.js';
import { TRST } from './fleet.js';

// De kaart draait in één bestand (ook als artifact): de MapLibre-worker wordt uit een blob-URL gestart.
try { const src = workerSrc.replace(/export\s*\{[^}]*\};?\s*(\/\/# sourceMappingURL=\S*)?\s*$/, ''); maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { console.warn('worker-url', e); }

const PAL = {
  light: { land: '#F5F4F0', urban: '#E9E7E1', water: '#CFDDE9', prov: '#C6CBD3', mw: '#F6DC8E', mwC: '#DDBA62', tr: '#FAE9B4', trC: '#DEC27E', pr: '#FFFFFF', prC: '#C8CCD3', se: '#FFFFFF', seC: '#D7DAE0', te: '#FFFFFF', teC: '#E3E5E9', tiles: 'light_all', stroke: '#FFFFFF' },
  dark: { land: '#171E2B', urban: '#1F2736', water: '#0A0E17', prov: '#2B3447', mw: '#6B6448', mwC: '#0A0E17', tr: '#5A5540', trC: '#0A0E17', pr: '#3A4356', prC: '#0A0E17', se: '#2F3747', seC: '#0A0E17', te: '#28303F', teC: '#0A0E17', tiles: 'dark_all', stroke: '#0A0E17' },
};
const fc = f => ({ type: 'FeatureCollection', features: f });

// Iconen voor de kaart, getekend op een canvas (2x): een voertuig van boven met de neus naar het noorden (de kaart draait
// het op koers), een stip voor stilstaand, en een losse oplegger. Per status gekleurd, met een rand in de achtergrondkleur.
function drawIcon(w, h, fn) { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); fn(g); return g.getImageData(0, 0, w * 2, h * 2); }
function iconSet(stroke) {
  const out = {};
  for (const [k, v] of Object.entries(ST)) {
    out['veh-' + k] = drawIcon(24, 32, g => {
      g.translate(12, 16); g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -14); g.lineTo(7, -6.5); g.lineTo(7, 12.5); g.quadraticCurveTo(7, 14.5, 5, 14.5); g.lineTo(-5, 14.5); g.quadraticCurveTo(-7, 14.5, -7, 12.5); g.lineTo(-7, -6.5); g.closePath();
      g.strokeStyle = stroke; g.lineWidth = 3.2; g.stroke(); g.fillStyle = v.color; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4.5, -4); g.lineTo(4.5, -4); g.stroke();
    });
    out['dot-' + k] = drawIcon(18, 18, g => { g.beginPath(); g.arc(9, 9, 5.5, 0, Math.PI * 2); g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); g.fillStyle = v.color; g.fill(); });
  }
  for (const [k, v] of Object.entries(TRST)) {
    out['tr-' + k] = drawIcon(20, 26, g => {
      g.translate(10, 13); g.beginPath(); g.roundRect(-6, -10, 12, 20, 2); g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); g.fillStyle = v.color; g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-4, 4, 8, 1.6); g.fillRect(-4, 7, 8, 1.6);
    });
  }
  return out;
}
const line = (coords, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'LineString', coordinates: coords } });

function buildBase() {
  const E = allEdges(); const mw = [], tr = [], pr = [];
  for (let i = 0; i < E.length; i++) { const f = line(edgeGeom(i), { l: E[i][4] }); (E[i][3] === 0 ? mw : E[i][3] === 1 ? tr : pr).push(f); }
  const se = display.sec.map(s => line(decode(s))), te = display.ter.map(s => line(decode(s)));
  const wat = water.map(([t, rings]) => ({ type: 'Feature', properties: { t }, geometry: { type: 'Polygon', coordinates: rings.map(r => { const c = decode(r); if (c.length && (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1])) c.push(c[0]); return c; }) } }));
  return { mw: fc(mw), tr: fc(tr), pr: fc(pr), se: fc(se), te: fc(te), water: fc(wat) };
}

function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

// Zonder WebGL (uitgeschakeld, of een testomgeving zonder GPU): dezelfde API, zonder kaart. De kaartweergave toont een
// melding; alles wat de kaart aanstuurt doet niets. De andere weergaven hebben de kaart niet nodig.
function noMap(container, theme) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (el) el.innerHTML = '<div class="nomap"><div><b>De kaart heeft WebGL nodig</b>Deze browser heeft WebGL uit staan of ondersteunt het niet. Planbord, trucks, mensen, standplaatsen, laden, lostijden en pauzeplekken werken gewoon.</div></div>';
  const no = () => {};
  const map = { easeTo: no, flyTo: no, resize: no, fitBounds: no, on: no, off: no, getZoom: () => 6.6, getCenter: () => ({ lng: 5.3, lat: 52.2 }) };
  return { map, setTheme: no, setOnline: no, whenReady: f => setTimeout(f, 0), setTrucks: no, setTrailers: no, showTrailers: no, trailersOn: () => false, setSelected: no, setRoute: no, highlightSp: no, fitSps: no, setRest: no, showRest: no, isOnline: () => false, hasOnline: () => false, hasTiles: () => false, noWebGL: true, theme };
}

// opts.tiles === false: geen externe kaarttegels (geen enkel verzoek naar buiten); alleen de ingebouwde basiskaart.
export function createMap(container, opts) {
  let theme = opts.theme || 'light'; const tiles = opts.tiles !== false; let online = tiles && opts.online !== false; let onlineFailed = false; let tilesOk = false;
  if (!hasWebGL()) return noMap(container, theme);
  const map = new maplibregl.Map({
    container, style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': PAL[theme].land } }] },
    center: [5.3, 52.2], zoom: 6.6, minZoom: 5.5, maxZoom: 17, attributionControl: false, antialias: true, maxPitch: 60,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Wegen en water © OpenStreetMap-bijdragers via Overture Maps · provincies Natural Earth' + (tiles ? ' · online tegels © CARTO' : '') }), 'bottom-left');

  const markers = { cities: [], sp: [] };
  let trailersOn = false;
  const addIcons = () => { for (const [id, img] of Object.entries(iconSet(PAL[theme].stroke))) { if (map.hasImage(id)) map.removeImage(id); map.addImage(id, img, { pixelRatio: 2 }); } };
  const empty = fc([]);
  let ready = false; const onReady = [];

  map.on('load', () => {
    const P = PAL[theme]; const base = buildBase();
    map.addSource('urban', { type: 'geojson', data: fc(urban.map(r => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] } }))) });
    map.addSource('water', { type: 'geojson', data: base.water, tolerance: 0.3, maxzoom: 14, buffer: 16 });
    map.addSource('prov', { type: 'geojson', data: fc(prov.flatMap(p => p.rings.map(r => line(r)))) });
    for (const k of ['mw', 'tr', 'pr', 'se', 'te']) map.addSource(k, { type: 'geojson', data: base[k], tolerance: 0.3, maxzoom: 14, buffer: 16 });
    if (tiles) map.addSource('tiles', { type: 'raster', tiles: ['a', 'b', 'c'].map(h => `https://${h}.basemaps.cartocdn.com/${P.tiles}/{z}/{x}/{y}@2x.png`), tileSize: 256, maxzoom: 19 });
    map.addLayer({ id: 'urban', type: 'fill', source: 'urban', maxzoom: 12, paint: { 'fill-color': P.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.9, 12, 0.35] } });
    map.addLayer({ id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': P.water } });
    // online tegels bóven de ingebouwde basiskaart; laden ze niet, dan blijft de basiskaart zichtbaar
    if (tiles) map.addLayer({ id: 'tiles', type: 'raster', source: 'tiles', layout: { visibility: online ? 'visible' : 'none' } });
    map.addLayer({ id: 'prov', type: 'line', source: 'prov', paint: { 'line-color': P.prov, 'line-width': 0.9, 'line-dasharray': [3, 2] } });
    const Z = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
    const road = (id, src, minzoom, casing, fill, wC, w) => {
      map.addLayer({ id: id + 'c', type: 'line', source: src, minzoom, paint: { 'line-color': casing, 'line-width': wC }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id, type: 'line', source: src, minzoom, paint: { 'line-color': fill, 'line-width': w }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    };
    road('te', 'te', 10.5, P.teC, P.te, Z(10.5, 1.2, 14, 5, 17, 14), Z(10.5, 0.6, 14, 3.4, 17, 11));
    road('se', 'se', 9, P.seC, P.se, Z(9, 1.4, 12, 4, 14, 7, 17, 16), Z(9, 0.7, 12, 2.6, 14, 5, 17, 13));
    road('pr', 'pr', 6.5, P.prC, P.pr, Z(6.5, 1.2, 9, 2.4, 12, 5.5, 14, 9, 17, 18), Z(6.5, 0.6, 9, 1.3, 12, 3.8, 14, 6.5, 17, 15));
    road('tr', 'tr', 5.5, P.trC, P.tr, Z(5.5, 1.6, 9, 3.2, 12, 6.5, 14, 10, 17, 20), Z(5.5, 0.9, 9, 2, 12, 4.6, 14, 7.5, 17, 17));
    road('mw', 'mw', 5.5, P.mwC, P.mw, Z(5.5, 2.2, 9, 4.2, 12, 8, 14, 12, 17, 24), Z(5.5, 1.3, 9, 2.8, 12, 5.8, 14, 9, 17, 20));
    // route van de geselecteerde truck
    map.addSource('route-done', { type: 'geojson', data: empty }); map.addSource('route-todo', { type: 'geojson', data: empty }); map.addSource('stops', { type: 'geojson', data: empty });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route-todo', paint: { 'line-color': P.stroke, 'line-width': 9, 'line-opacity': .9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-done', type: 'line', source: 'route-done', paint: { 'line-color': '#9AA3B5', 'line-width': 4.5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-todo', type: 'line', source: 'route-todo', paint: { 'line-color': '#E3001F', 'line-width': 4.5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': 7, 'circle-color': ['case', ['get', 'done'], '#9AA3B5', '#E3001F'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });
    // trucks als stippen
    map.addSource('dim', { type: 'geojson', data: empty });
    map.addLayer({ id: 'dim', type: 'circle', source: 'dim', minzoom: 7, paint: { 'circle-radius': 2.5, 'circle-color': '#9AA3B5', 'circle-opacity': .35 } });
    addIcons();
    map.addSource('trucks', { type: 'geojson', data: empty });
    map.addSource('trailers', { type: 'geojson', data: empty });
    map.addSource('sel', { type: 'geojson', data: empty });
    map.addLayer({ id: 'sel-glow', type: 'circle', source: 'sel', paint: { 'circle-radius': 24, 'circle-color': '#E3001F', 'circle-opacity': .14 } });
    // losse opleggers (laag aan te zetten): een klein rechthoekje in de kleur van de status
    map.addLayer({ id: 'trailers', type: 'symbol', source: 'trailers', minzoom: 7.6, layout: { visibility: 'none', 'icon-image': ['concat', 'tr-', ['get', 'st']], 'icon-size': Z(7.6, 0.55, 10, 0.75, 14, 1), 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    // uitgezoomd: stippen in de statuskleur; ingezoomd: een voertuig van boven, gedraaid op de koers
    map.addLayer({ id: 'trucks-dot', type: 'circle', source: 'trucks', maxzoom: 7.6, paint: { 'circle-radius': Z(5.5, 2, 7.6, 3.6), 'circle-color': ['match', ['get', 'st'], ...Object.entries(ST).flatMap(([k, v]) => [k, v.color]), '#64748B'], 'circle-stroke-color': P.stroke, 'circle-stroke-width': 1, 'circle-opacity': ['case', ['==', ['get', 'st'], 'terrein'], 0.75, 1] } });
    map.addLayer({ id: 'trucks', type: 'symbol', source: 'trucks', minzoom: 7.6, layout: { 'icon-image': ['case', ['get', 'mv'], ['concat', 'veh-', ['get', 'st']], ['concat', 'dot-', ['get', 'st']]], 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map', 'icon-size': Z(7.6, 0.5, 10, 0.72, 13, 0.95, 16, 1.2), 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['case', ['get', 'mv'], 2, 1] }, paint: { 'icon-opacity': ['case', ['==', ['get', 'st'], 'terrein'], 0.8, 1] } });
    map.addLayer({ id: 'sel-ring', type: 'circle', source: 'sel', paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#E3001F', 'circle-stroke-width': 2.5 } });
    map.on('click', 'trailers', e => { const f = e.features && e.features[0]; if (f) { e.preventDefault(); opts.onSelectTrailer && opts.onSelectTrailer(f.properties.id); } });
    map.on('mouseenter', 'trailers', () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', 'trailers', () => map.getCanvas().style.cursor = '');
    // pauzeplekken (aan te zetten vanuit de weergave Pauzeplekken)
    map.addSource('rest', { type: 'geojson', data: empty });
    map.addLayer({ id: 'rest', type: 'circle', source: 'rest', layout: { visibility: 'none' }, paint: { 'circle-radius': Z(6, 4, 10, 7, 14, 10), 'circle-color': ['case', ['get', 'sel'], '#E3001F', '#374151'], 'circle-stroke-color': P.stroke, 'circle-stroke-width': 1.6 } });
    map.on('click', 'rest', e => { const f = e.features && e.features[0]; if (f) { e.preventDefault(); opts.onSelectRest && opts.onSelectRest(f.properties.id); } });
    map.on('mouseenter', 'rest', () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', 'rest', () => map.getCanvas().style.cursor = '');
    // steden en standplaatsen als HTML-markers (geen glyph-server nodig)
    const spNames = new Set(SP.map(s => s.n.toLowerCase()));
    for (const c of CITIES) { if (spNames.has(c.n.toLowerCase()) && c.r >= 2) continue; const el = document.createElement('div'); el.className = 'lbl r' + c.r; el.textContent = c.r <= 2 ? c.n.toUpperCase() : c.n; markers.cities.push({ m: new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lon, c.lat]).addTo(map), r: c.r }); }
    for (const s of SP) { const el = document.createElement('div'); el.className = 'spm' + (s.hub ? ' hub' : ''); el.innerHTML = `<i>SL</i><span>${s.n}</span>`; el.addEventListener('click', e => { e.stopPropagation(); opts.onSelectSp && opts.onSelectSp(s); }); markers.sp.push({ m: new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([s.lon, s.lat]).addTo(map), s }); }
    applyZoomClasses();
    for (const layer of ['trucks', 'trucks-dot']) {
      map.on('click', layer, e => { const f = e.features && e.features[0]; if (f) { e.preventDefault(); opts.onSelectTruck && opts.onSelectTruck(f.properties.id); } });
      map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; opts.onHover && opts.onHover(null); });
      map.on('mousemove', layer, e => { const f = e.features && e.features[0]; opts.onHover && opts.onHover(f ? f.properties.id : null, e.point); });
    }
    map.on('click', e => { if (!e.defaultPrevented) opts.onMapClick && opts.onMapClick(); });
    map.on('zoom', applyZoomClasses);
    map.on('data', e => { if (e && e.sourceId === 'tiles' && e.tile && !tilesOk) { tilesOk = true; applyZoomClasses(); } });
    map.on('error', e => { if (e && e.sourceId === 'tiles' && online && !onlineFailed && !tilesOk) { onlineFailed = true; setOnline(false); opts.onTilesFailed && opts.onTilesFailed(); } });
    ready = true; onReady.forEach(f => f());
  });

  function throttle(f, ms) { let last = 0, pending = null; return () => { const now = Date.now(); if (now - last > ms) { last = now; f(); } else if (!pending) pending = setTimeout(() => { pending = null; last = Date.now(); f(); }, ms); }; }
  function applyZoomClasses() {
    const z = map.getZoom(); const hide = online && tilesOk;
    for (const { m, r } of markers.cities) { const show = !hide && (r === 1 || (r === 2 && z >= 6.8) || (r === 3 && z >= 8.3) || (r === 4 && z >= 10)); m.getElement().style.display = show ? '' : 'none'; }
    for (const { m } of markers.sp) { const el = m.getElement(); el.style.display = z < 7.4 ? 'none' : ''; el.classList.toggle('small', z < 8.2); }
  }
  function setTheme(t) {
    theme = t; const P = PAL[t]; if (!ready) return;
    map.setPaintProperty('bg', 'background-color', P.land); map.setPaintProperty('urban', 'fill-color', P.urban); map.setPaintProperty('water', 'fill-color', P.water); map.setPaintProperty('prov', 'line-color', P.prov);
    for (const [id, c, f] of [['te', P.teC, P.te], ['se', P.seC, P.se], ['pr', P.prC, P.pr], ['tr', P.trC, P.tr], ['mw', P.mwC, P.mw]]) { map.setPaintProperty(id + 'c', 'line-color', c); map.setPaintProperty(id, 'line-color', f); }
    map.setPaintProperty('route-casing', 'line-color', P.stroke); map.setPaintProperty('trucks-dot', 'circle-stroke-color', P.stroke); addIcons();
    const src = map.getSource('tiles'); if (src && src.setTiles) src.setTiles(['a', 'b', 'c'].map(h => `https://${h}.basemaps.cartocdn.com/${P.tiles}/{z}/{x}/{y}@2x.png`));
  }
  function setOnline(v) { online = tiles && v && !onlineFailed; if (!ready || !tiles) return; map.setLayoutProperty('tiles', 'visibility', online ? 'visible' : 'none'); applyZoomClasses(); }
  const whenReady = f => ready ? f() : onReady.push(f);
  function setTrucks(features, dimFeatures) { if (!ready) return; map.getSource('trucks').setData(fc(features)); map.getSource('dim').setData(fc(dimFeatures)); }
  function setTrailers(features) { if (!ready) return; map.getSource('trailers').setData(fc(features)); }
  function showTrailers(v) { trailersOn = v; if (!ready) return; map.setLayoutProperty('trailers', 'visibility', v ? 'visible' : 'none'); }
  function setSelected(feature) { if (!ready) return; map.getSource('sel').setData(fc(feature ? [feature] : [])); }
  function setRoute(done, todo, stops) { if (!ready) return; map.getSource('route-done').setData(fc(done ? [line(done)] : [])); map.getSource('route-todo').setData(fc(todo ? [line(todo)] : [])); map.getSource('stops').setData(fc((stops || []).map(s => ({ type: 'Feature', properties: { done: s.done }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })))); }
  function highlightSp(name) { for (const { m, s } of markers.sp) m.getElement().classList.toggle('on', s.n === name); }
  function setRest(places, selId) { if (!ready) return; map.getSource('rest').setData(fc(places.map(p => ({ type: 'Feature', properties: { id: p.id, sel: p.id === selId }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })))); }
  function showRest(v) { if (!ready) return; map.setLayoutProperty('rest', 'visibility', v ? 'visible' : 'none'); }
  function fitSps(list, pad = 60) { if (!list.length) return; const b = new maplibregl.LngLatBounds(); for (const s of list) b.extend([s.lon, s.lat]); map.fitBounds(b, { padding: pad, maxZoom: 10.5, duration: 800 }); }
  return { map, setTheme, setOnline, whenReady, setTrucks, setTrailers, showTrailers, trailersOn: () => trailersOn, setSelected, setRoute, highlightSp, fitSps, setRest, showRest, isOnline: () => online, hasOnline: () => tiles && !onlineFailed, hasTiles: () => tiles };
}
