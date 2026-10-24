// Kaart: MapLibre GL met een eigen basiskaart uit Natural Earth (werkt zonder internet) en optioneel online tegels.
import * as maplibregl from 'maplibre-gl';
import workerSrc from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
// De kaart draait in één bestand (ook als artifact): de MapLibre-worker wordt uit een blob-URL gestart.
try { const src = workerSrc.replace(/export\s*\{[^}]*\};?\s*(\/\/# sourceMappingURL=\S*)?\s*$/, ''); maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { console.warn('worker-url', e); }
import land from './data/land.json';
import prov from './data/provinces.json';
import urban from './data/urban.json';
import rivers from './data/rivers.json';
import { roads } from './roads.js';
import { SP, CITIES, ST } from './places.js';

const PAL = {
  light: { water: '#D9E4EE', ctx: '#ECEEF0', land: '#F7F7F5', urban: '#E6E5DF', river: '#B7CBDD', prov: '#C4C9D1', mwC: '#D7BF73', mw: '#F3DE97', hwC: '#CFD3D9', hw: '#FFFFFF', rdC: '#DEE1E5', rd: '#FFFFFF', label: '#5B6472', labelHalo: '#FFFFFF', tiles: 'light_all' },
  dark: { water: '#0A0E17', ctx: '#10151F', land: '#171E2B', urban: '#1F2736', river: '#14233A', prov: '#2B3447', mwC: '#0A0E17', mw: '#6B6448', hwC: '#0A0E17', hw: '#333C4F', rdC: '#0A0E17', rd: '#262E3E', label: '#8A93A6', labelHalo: '#0A0E17', tiles: 'dark_all' },
};
const poly = rings => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: rings } });
const fc = f => ({ type: 'FeatureCollection', features: f });

function truckImage(color, light, size = 2) {
  const w = 30 * size, h = 18 * size, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.scale(size, size);
  g.translate(15, 9); g.rotate(-Math.PI / 2); // tekenen met de neus naar boven (noord)
  const rr = (x, y, ww, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); };
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(10,14,23,.9)';
  rr(-9, -4.2, 12.5, 8.4, 1.6); g.fillStyle = color; g.fill(); g.stroke();
  rr(3.6, -3.6, 5.6, 7.2, 1.4); g.fillStyle = light; g.fill(); g.stroke();
  g.fillStyle = 'rgba(10,14,23,.55)'; rr(7.6, -2.6, 1.4, 5.2, .5); g.fill();
  return { data: g.getImageData(0, 0, w, h), w, h };
}

export function createMap(container, opts) {
  let theme = opts.theme || 'light'; let online = opts.online !== false; let onlineFailed = false; let tilesOk = false;
  const map = new maplibregl.Map({
    container, style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': PAL[theme].water } }] },
    center: [5.3, 52.2], zoom: 6.6, minZoom: 5.5, maxZoom: 16, attributionControl: false, antialias: true, maxPitch: 60,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Kaart: Natural Earth · online tegels © OpenStreetMap, © CARTO' }), 'bottom-left');

  const markers = { cities: [], sp: [], clusters: new Map() };
  const empty = fc([]);
  let ready = false; const onReady = [];

  map.on('load', () => {
    const P = PAL[theme];
    map.addSource('tiles', { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/' + P.tiles + '/{z}/{x}/{y}@2x.png', 'https://b.basemaps.cartocdn.com/' + P.tiles + '/{z}/{x}/{y}@2x.png', 'https://c.basemaps.cartocdn.com/' + P.tiles + '/{z}/{x}/{y}@2x.png'], tileSize: 256, maxzoom: 19, attribution: '' });
    map.addSource('ctx', { type: 'geojson', data: fc(land.ctx.map(p => poly(p))) });
    map.addSource('nl', { type: 'geojson', data: fc(land.nl.map(p => poly(p))) });
    map.addSource('urban', { type: 'geojson', data: fc(urban.map(r => poly([r]))) });
    map.addSource('rivers', { type: 'geojson', data: fc(rivers.map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.p } }))) });
    map.addSource('prov', { type: 'geojson', data: fc(prov.flatMap(p => p.rings.map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r } })))) });
    map.addSource('roads', { type: 'geojson', data: fc(roads.map(r => ({ type: 'Feature', properties: { t: r.t }, geometry: { type: 'LineString', coordinates: r.p } }))) });
    map.addLayer({ id: 'ctx', type: 'fill', source: 'ctx', paint: { 'fill-color': P.ctx } });
    map.addLayer({ id: 'nl', type: 'fill', source: 'nl', paint: { 'fill-color': P.land } });
    map.addLayer({ id: 'urban', type: 'fill', source: 'urban', paint: { 'fill-color': P.urban, 'fill-opacity': 0.9 } });
    map.addLayer({ id: 'rivers', type: 'line', source: 'rivers', paint: { 'line-color': P.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2.6] } });
    const W = (a, b) => ['interpolate', ['linear'], ['zoom'], 6, a, 9, a * 2.2, 12, b];
    map.addLayer({ id: 'rd2c', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 2], paint: { 'line-color': P.rdC, 'line-width': W(1.2, 7) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'rd2', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 2], paint: { 'line-color': P.rd, 'line-width': W(0.5, 4.5) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'rd1c', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 1], paint: { 'line-color': P.hwC, 'line-width': W(1.8, 9) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'rd1', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 1], paint: { 'line-color': P.hw, 'line-width': W(0.9, 6) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'rd0c', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 0], paint: { 'line-color': P.mwC, 'line-width': W(2.8, 12) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'rd0', type: 'line', source: 'roads', filter: ['==', ['get', 't'], 0], paint: { 'line-color': P.mw, 'line-width': W(1.6, 8) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    // online tegels liggen bóven de ingebouwde basiskaart: laden ze niet (geen internet, CSP), dan blijft de basiskaart zichtbaar
    map.addLayer({ id: 'tiles', type: 'raster', source: 'tiles', layout: { visibility: online ? 'visible' : 'none' }, paint: { 'raster-opacity': 1 } });
    map.addLayer({ id: 'prov', type: 'line', source: 'prov', paint: { 'line-color': P.prov, 'line-width': 0.9, 'line-dasharray': [3, 2] } });

    // route van de geselecteerde truck
    map.addSource('route-done', { type: 'geojson', data: empty }); map.addSource('route-todo', { type: 'geojson', data: empty }); map.addSource('stops', { type: 'geojson', data: empty });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route-todo', paint: { 'line-color': theme === 'dark' ? '#0A0E17' : '#FFFFFF', 'line-width': 10, 'line-opacity': .9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-done', type: 'line', source: 'route-done', paint: { 'line-color': '#8A93A6', 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-todo', type: 'line', source: 'route-todo', paint: { 'line-color': '#0EA5E9', 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-dash', type: 'line', source: 'route-todo', paint: { 'line-color': '#E0F2FE', 'line-width': 1.6, 'line-dasharray': [1, 4] }, layout: { 'line-cap': 'round' } });
    map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': 9, 'circle-color': ['case', ['get', 'done'], '#8A93A6', '#0EA5E9'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });

    // trucks
    for (const k of Object.keys(ST)) { const im = truckImage(ST[k].color, ST[k].light); map.addImage('trk-' + k, im.data, { pixelRatio: 2 }); }
    map.addSource('dim', { type: 'geojson', data: empty });
    map.addLayer({ id: 'dim', type: 'circle', source: 'dim', minzoom: 7, paint: { 'circle-radius': 3, 'circle-color': '#9AA3B5', 'circle-opacity': .35 } });
    const cnt = k => ['+', ['case', ['==', ['get', 'st'], k], 1, 0]];
    map.addSource('trucks', { type: 'geojson', data: empty, cluster: true, clusterRadius: 46, clusterMaxZoom: 8, clusterProperties: { onderweg: cnt('onderweg'), klant: cnt('klant'), pauze: cnt('pauze'), vertraagd: cnt('vertraagd'), terrein: cnt('terrein') } });
    map.addLayer({ id: 'trucks', type: 'symbol', source: 'trucks', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': ['concat', 'trk-', ['get', 'st']], 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 6, .55, 9, .8, 12, 1.1] } });
    map.addSource('sel', { type: 'geojson', data: empty });
    map.addLayer({ id: 'sel-ring', type: 'circle', source: 'sel', paint: { 'circle-radius': 17, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': theme === 'dark' ? '#FFFFFF' : '#111827', 'circle-stroke-width': 2 } }, 'trucks');
    map.addLayer({ id: 'sel-glow', type: 'circle', source: 'sel', paint: { 'circle-radius': 28, 'circle-color': '#E3001F', 'circle-opacity': .12 } }, 'sel-ring');

    // steden en standplaatsen als HTML-markers (geen glyph-server nodig)
    for (const c of CITIES) { const el = document.createElement('div'); el.className = 'lbl r' + c.r; el.textContent = c.r <= 2 ? c.n.toUpperCase() : c.n; markers.cities.push({ m: new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lon, c.lat]).addTo(map), r: c.r }); }
    for (const s of SP) { const el = document.createElement('div'); el.className = 'spm' + (s.hub ? ' hub' : ''); el.innerHTML = `<i>SL</i><span>${s.n}</span>`; el.addEventListener('click', e => { e.stopPropagation(); opts.onSelectSp && opts.onSelectSp(s); }); markers.sp.push({ m: new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([s.lon, s.lat]).addTo(map), s }); }
    applyZoomClasses();
    map.on('click', 'trucks', e => { const f = e.features && e.features[0]; if (f) { opts.onSelectTruck && opts.onSelectTruck(f.properties.id); } });
    map.on('mouseenter', 'trucks', () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', 'trucks', () => map.getCanvas().style.cursor = '');
    map.on('mousemove', 'trucks', e => { const f = e.features && e.features[0]; opts.onHover && opts.onHover(f ? f.properties.id : null, e.point); });
    map.on('mouseleave', 'trucks', () => opts.onHover && opts.onHover(null));
    map.on('click', e => { if (!e.defaultPrevented) opts.onMapClick && opts.onMapClick(); });
    map.on('zoom', applyZoomClasses); map.on('render', throttle(updateClusters, 400));
    map.on('data', e => { if (e && e.sourceId === 'tiles' && e.tile && !tilesOk) { tilesOk = true; applyZoomClasses(); } });
    map.on('error', e => { if (e && e.sourceId === 'tiles' && online && !onlineFailed && !tilesOk) { onlineFailed = true; setOnline(false); opts.onTilesFailed && opts.onTilesFailed(); } });
    ready = true; onReady.forEach(f => f());
  });

  function throttle(f, ms) { let last = 0, pending = null; return () => { const now = Date.now(); if (now - last > ms) { last = now; f(); } else if (!pending) pending = setTimeout(() => { pending = null; last = Date.now(); f(); }, ms); }; }
  function applyZoomClasses() { const z = map.getZoom(); const hide = online && tilesOk; for (const { m, r } of markers.cities) { const el = m.getElement(); const show = !hide && (r === 1 || (r === 2 && z >= 6.8) || (r === 3 && z >= 8.3) || (r === 4 && z >= 10)); el.style.display = show ? '' : 'none'; } for (const { m } of markers.sp) m.getElement().classList.toggle('small', z < 7.2); }

  // clusters: donut per cluster met de statusverdeling
  function donut(p) {
    const keys = ['onderweg', 'klant', 'pauze', 'vertraagd', 'terrein']; const tot = p.point_count; const r = 14 + Math.sqrt(tot) * 1.6, R = r + 4, w = 2 * R; let a0 = -Math.PI / 2; let s = '';
    for (const k of keys) { const v = p[k] || 0; if (!v) continue; const a1 = a0 + 2 * Math.PI * v / tot; if (v === tot) { s += `<circle cx="${R}" cy="${R}" r="${r + 2}" fill="none" stroke="${ST[k].color}" stroke-width="4"/>`; break; } const x0 = R + (r + 2) * Math.cos(a0), y0 = R + (r + 2) * Math.sin(a0), x1 = R + (r + 2) * Math.cos(a1), y1 = R + (r + 2) * Math.sin(a1); s += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r + 2} ${r + 2} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${ST[k].color}" stroke-width="4"/>`; a0 = a1; }
    return `<svg width="${w}" height="${w}" viewBox="0 0 ${w} ${w}"><circle cx="${R}" cy="${R}" r="${r}" class="cl-bg"/>${s}<text x="${R}" y="${R + 5}" text-anchor="middle" class="cl-txt" font-size="${tot >= 100 ? 14 : 12}">${tot}</text></svg>`;
  }
  function updateClusters() {
    if (!ready || !map.getSource('trucks')) return;
    const feats = map.querySourceFeatures('trucks').filter(f => f.properties.cluster); const seen = new Set();
    for (const f of feats) { const id = f.properties.cluster_id; seen.add(id); let m = markers.clusters.get(id); const html = donut(f.properties); if (!m) { const el = document.createElement('div'); el.className = 'cluster'; el.innerHTML = html; el.dataset.html = html; el.addEventListener('click', e => { e.stopPropagation(); map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(10, map.getZoom() + 2.2), duration: 600 }); }); m = new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map); markers.clusters.set(id, m); } else { if (m.getElement().dataset.html !== html) { m.getElement().innerHTML = html; m.getElement().dataset.html = html; } m.setLngLat(f.geometry.coordinates); } }
    for (const [id, m] of markers.clusters) if (!seen.has(id)) { m.remove(); markers.clusters.delete(id); }
  }

  function setTheme(t) {
    theme = t; const P = PAL[t]; if (!ready) return;
    map.setPaintProperty('bg', 'background-color', P.water); map.setPaintProperty('ctx', 'fill-color', P.ctx); map.setPaintProperty('nl', 'fill-color', P.land); map.setPaintProperty('urban', 'fill-color', P.urban); map.setPaintProperty('rivers', 'line-color', P.river); map.setPaintProperty('prov', 'line-color', P.prov);
    map.setPaintProperty('rd2c', 'line-color', P.rdC); map.setPaintProperty('rd2', 'line-color', P.rd); map.setPaintProperty('rd1c', 'line-color', P.hwC); map.setPaintProperty('rd1', 'line-color', P.hw); map.setPaintProperty('rd0c', 'line-color', P.mwC); map.setPaintProperty('rd0', 'line-color', P.mw);
    map.setPaintProperty('route-casing', 'line-color', t === 'dark' ? '#0A0E17' : '#FFFFFF'); map.setPaintProperty('sel-ring', 'circle-stroke-color', t === 'dark' ? '#FFFFFF' : '#111827');
    const src = map.getSource('tiles'); if (src && src.setTiles) src.setTiles(['a', 'b', 'c'].map(h => `https://${h}.basemaps.cartocdn.com/${P.tiles}/{z}/{x}/{y}@2x.png`));
  }
  function setOnline(v) { online = v && !onlineFailed; if (!ready) return; map.setLayoutProperty('tiles', 'visibility', online ? 'visible' : 'none'); applyZoomClasses(); }
  const whenReady = f => ready ? f() : onReady.push(f);
  function setTrucks(features, dimFeatures) { if (!ready) return; map.getSource('trucks').setData(fc(features)); map.getSource('dim').setData(fc(dimFeatures)); }
  function setSelected(feature) { if (!ready) return; map.getSource('sel').setData(fc(feature ? [feature] : [])); }
  function setRoute(done, todo, stops) { if (!ready) return; map.getSource('route-done').setData(fc(done ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: done } }] : [])); map.getSource('route-todo').setData(fc(todo ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: todo } }] : [])); map.getSource('stops').setData(fc((stops || []).map(s => ({ type: 'Feature', properties: { done: s.done }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })))); }
  function highlightSp(name) { for (const { m, s } of markers.sp) m.getElement().classList.toggle('on', s.n === name); }
  function fitSps(list, pad = 60) { if (!list.length) return; const b = new maplibregl.LngLatBounds(); for (const s of list) b.extend([s.lon, s.lat]); map.fitBounds(b, { padding: pad, maxZoom: 10.5, duration: 800 }); }
  return { map, setTheme, setOnline, whenReady, setTrucks, setSelected, setRoute, highlightSp, fitSps, isOnline: () => online, hasOnline: () => !onlineFailed };
}
