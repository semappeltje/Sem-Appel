// Vloeiende beweging op de kaart.
//
// De simulatie zet de voertuigen een paar keer per seconde op een nieuwe plek (een stap). Deze module laat ze daartussen
// per beeld rijden: per voertuig de getoonde positie en koers als begin, de nieuwe stap als doel, lineair over de duur
// van een stap (koers via de kortste draai). Dat kost per beeld een paar microseconden per voertuig; tekenen gebeurt in
// een eigen WebGL-laag van MapLibre (een tekenopdracht voor alle voertuigen, met de halo onder het aangewezen voertuig
// en de ring om het geselecteerde), zodat er per beeld niets naar de worker van MapLibre hoeft. Bij een sprong in de tijd
// (tijdschuif, knop Nu), een te grote stap (300x van dichtbij) of "minder beweging" springen de voertuigen gewoon.

// cubic-bezier(.2,.7,.2,1): de curve van de interface (panelen, menu's), ook voor de camera van de kaart
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dsx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return sy(t); const d = dsx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40 && hi - lo > 1e-6; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
export const EASE = cubicBezier(0.2, 0.7, 0.2, 1);

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!(mq && mq.matches);

// Web Mercator (0..1), zoals MapLibre die gebruikt
export const mercX = lon => (lon + 180) / 360;
export const mercY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - 0.25 * Math.log((1 + s) / (1 - s)) / Math.PI; };
export const metersPerPixel = (lat, zoom) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, zoom));
const distM = (lon1, lat1, lon2, lat2) => { const k = Math.cos((lat1 + lat2) * Math.PI / 360); return Math.hypot((lon2 - lon1) * k * 111320, (lat2 - lat1) * 111320); };
export const angleDelta = (a, b) => ((b - a + 540) % 360) - 180;

// ---------------------------------------------------------------------------------------------------------------------
// Interpolatie: per voertuig begin (f*), doel (t*) en de getoonde stand (c*).
export function createMotion() {
  const recs = new Map(); let order = [];
  let lastStep = 0, interval = 135, lastSim = null, animating = false;
  const byKey = new Map();
  // features: de GeoJSON-punten van ui.js ({ id, st, b, mv, k, base }); ctx: { now, simTime, speed, playing, zoom, lat, snap,
  // snapAt(lon, lat): true op een plek waar een voertuig niet heen of vandaan glijdt, zoals een dock aan de gevel van de hal,
  // lane(lon, lat, koers): de verschuiving [dlon, dlat] naar de eigen rijbaan van een rijdend voertuig (rechts rijden) }
  // Per voertuig: de stand op de lijn van de route (bx, by, tussen fx/fy en tx/ty) plus de verschuiving naar de rijbaan
  // (ox, oy, tussen fox/foy en tox/toy) is de getoonde stand cx, cy. Alles wat een voertuig aanwijst of tekent gebruikt cx, cy.
  function update(features, ctx) {
    const now = ctx.now;
    const gap = now - lastStep; lastStep = now;
    // de duur van een stap: gemiddelde van de tussentijden (korte extra stappen, zoals na een klik, tellen niet mee)
    if (gap > 45 && gap < 2500) interval = interval * 0.75 + gap * 0.25;
    // een sprong in de simulatietijd (tijdschuif, Nu, een blok op het planbord) of een stilstaande klok: niet rijden
    let jump = !!ctx.snap;
    if (ctx.simTime != null && lastSim != null) {
      const dT = ctx.simTime - lastSim; const expect = (ctx.speed || 12) * Math.max(gap, interval) / 60000;
      if (dT < -0.001 && dT > -1430) jump = true; else if (dT > Math.max(expect * 3, 0.75) && dT < 1430) jump = true;
    }
    lastSim = ctx.simTime;
    const mpp = metersPerPixel(ctx.lat || 52.2, ctx.zoom || 8);
    const maxM = Math.max(400, (ctx.speed || 12) * 34 * interval / 1000 * 1.8); // sneller dan 120 km/u is een sprong
    const seen = new Set(); const next = []; let changed = features.length !== order.length;
    byKey.clear();
    for (const f of features) {
      const p = f.properties, c = f.geometry.coordinates; const id = p.id; seen.add(id);
      let r = recs.get(id);
      const tb = +p.b || 0;
      if (!r) {
        r = { id, cx: c[0], cy: c[1], cb: tb, bx: c[0], by: c[1], fx: c[0], fy: c[1], fb: tb, tx: c[0], ty: c[1], tb, ox: 0, oy: 0, fox: 0, foy: 0, tox: 0, toy: 0, t0: now, dur: 1, v3: null };
        const o = p.mv && ctx.lane ? ctx.lane(c[0], c[1], tb) : null;
        if (o) { r.ox = r.fox = r.tox = o[0]; r.oy = r.foy = r.toy = o[1]; r.cx += o[0]; r.cy += o[1]; }
        recs.set(id, r); changed = true;
      }
      else if (r.tx === c[0] && r.ty === c[1] && r.st === p.st && r.mv === !!p.mv && r.k === (p.k || 'trekker')) { /* niets veranderd: lopende beweging niet opnieuw beginnen */ }
      else {
        changed = true;
        sample(r, now);
        const d = distM(r.bx, r.by, c[0], c[1]);
        // Springen in plaats van glijden: bij een sprong in de tijd, een te grote stap, van de ene stilstaande plek naar de
        // andere (van de parkeerplek naar een dock: de simulatie rijdt daar niet, een rechte lijn kan door de hal gaan) en
        // naar of van een dock.
        const still = !p.mv && !r.mv && d > 2;
        const dockMove = !!ctx.snapAt && d > 2 && (ctx.snapAt(c[0], c[1]) || ctx.snapAt(r.tx, r.ty));
        const snap = jump || d > maxM || d / mpp > 260 || still || dockMove;
        // de rijbaan: alleen een rijdend voertuig verschuift (stilstaand op een terrein, aan een dock of bij een klant niet)
        const o = p.mv && ctx.lane ? ctx.lane(c[0], c[1], tb) : null; r.tox = o ? o[0] : 0; r.toy = o ? o[1] : 0;
        if (snap) { r.fx = r.bx = c[0]; r.fy = r.by = c[1]; r.fb = r.cb = tb; r.fox = r.ox = r.tox; r.foy = r.oy = r.toy; r.cx = r.bx + r.ox; r.cy = r.by + r.oy; }
        else { r.fx = r.bx; r.fy = r.by; r.fb = r.cb; r.fox = r.ox; r.foy = r.oy; }
        r.tx = c[0]; r.ty = c[1]; r.tb = d < 0.5 && !p.mv ? r.cb : tb; r.t0 = now; r.dur = snap ? 1 : interval * 1.04;
        if (!snap && Math.abs(angleDelta(r.fb, r.tb)) > 100 && d < 3) { r.fb = r.cb = r.tb; } // keren op de plek: niet draaien
      }
      r.st = p.st; r.k = p.k || 'trekker'; r.mv = !!p.mv; r.base = p.base; r.f = f;
      next.push(r); byKey.set(c[0] + ',' + c[1], r);
    }
    for (const id of recs.keys()) if (!seen.has(id)) recs.delete(id);
    // tekenvolgorde: stilstaand onder, rijdend boven (zoals symbol-sort-key)
    if (changed) { next.sort((a, b) => (a.mv === b.mv ? 0 : a.mv ? 1 : -1)); order = next; animating = true; }
    return changed;
  }
  function sample(r, now) {
    const a = r.dur <= 1 ? 1 : Math.min(1, Math.max(0, (now - r.t0) / r.dur));
    r.bx = r.fx + (r.tx - r.fx) * a; r.by = r.fy + (r.ty - r.fy) * a;
    r.ox = r.fox + (r.tox - r.fox) * a; r.oy = r.foy + (r.toy - r.foy) * a;
    r.cx = r.bx + r.ox; r.cy = r.by + r.oy;
    r.cb = (r.fb + angleDelta(r.fb, r.tb) * a + 360) % 360;
    return a;
  }
  // alles naar de getoonde stand op tijdstip now; geeft terug of er nog iets beweegt
  function tick(now) {
    if (!animating) return false; let moving = false;
    for (const r of order) { if (sample(r, now) < 1) moving = true; }
    animating = moving; return moving;
  }
  function snapAll() { for (const r of order) { r.fx = r.bx = r.tx; r.fy = r.by = r.ty; r.fox = r.ox = r.tox; r.foy = r.oy = r.toy; r.cx = r.bx + r.ox; r.cy = r.by + r.oy; r.fb = r.cb = r.tb; r.dur = 1; } animating = false; }
  return {
    update, tick, snapAll, sample,
    order: () => order, get: id => recs.get(id) || null, atCoord: (lon, lat) => byKey.get(lon + ',' + lat) || null,
    interval: () => interval, animating: () => animating,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Iconen: een voertuig van boven met de neus naar het noorden (de laag draait het op koers), per soort en status,
// een stip voor stilstaand, de halo (aanwijzen) en de ring (selectie). Getekend op een atlas van 3x.
const S = 3, M = 3, MAXS = 96;
const KINDS = {
  trekker: [16, 38, (g, c, d, s) => { body(g, s, -6.2, -7.5, 12.4, 25.5, 2.2); body(g, s, -6.2, -18.6, 12.4, 10.4, 3.6); fill(g, c, -6.2, -7.5, 12.4, 25.5, 2.2); fill(g, d, -6.2, -18.6, 12.4, 10.4, 3.6); glass(g, -4.4, -16.6, 8.8, 2.2); roof(g, -4.6, -5.6, 9.2, 21.6); }],
  solo: [16, 22, (g, c, d, s) => { body(g, s, -3.6, -1.2, 7.2, 10.2, 1.6); body(g, s, -6.2, -11, 12.4, 10.4, 3.6); fill(g, d, -3.6, -1.2, 7.2, 10.2, 1.6); fill(g, c, -6.2, -11, 12.4, 10.4, 3.6); glass(g, -4.4, -9, 8.8, 2.2); }],
  bakwagen: [16, 32, (g, c, d, s) => { body(g, s, -6.2, -5.4, 12.4, 21.4, 2); body(g, s, -6.2, -15.6, 12.4, 9.6, 3.4); fill(g, c, -6.2, -5.4, 12.4, 21.4, 2); fill(g, d, -6.2, -15.6, 12.4, 9.6, 3.4); glass(g, -4.4, -13.8, 8.8, 2.1); roof(g, -4.6, -3.6, 9.2, 17.6); }],
  bus: [14, 25, (g, c, d, s) => { body(g, s, -5.2, -12, 10.4, 24, 3.4); fill(g, c, -5.2, -12, 10.4, 24, 3.4); glass(g, -3.7, -9.4, 7.4, 2.4); }],
};
// Geparkeerd, van dichtbij op ware grootte: een eenvoudig blok in de echte verhouding (lengte x 2,55 m breed) met de
// cabine iets donkerder aan de voorkant; zo blijft een parkeerrij rustig en leesbaar, ook als het voertuig maar een paar
// pixels groot is.
const PARK = { trekker: [8, 52, 0.17], solo: [8, 19, 0.5], bakwagen: [8, 31, 0.3], bus: [7, 22, 0.16] };
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function body(g, s, x, y, w, h, r) { rr(g, x, y, w, h, r); g.lineWidth = 2.4; g.strokeStyle = s; g.stroke(); }
function fill(g, c, x, y, w, h, r) { rr(g, x, y, w, h, r); g.fillStyle = c; g.fill(); }
function glass(g, x, y, w, h) { rr(g, x, y, w, h, 0.9); g.fillStyle = 'rgba(255,255,255,.86)'; g.fill(); }
function roof(g, x, y, w, h) { rr(g, x, y, w, h, 1.2); g.fillStyle = 'rgba(255,255,255,.13)'; g.fill(); }
// Van dichtbij (vanaf zoom 16) een knipoog naar de huisstijl van Simon Loos: het dak van de cabine wit met een smalle
// goudgele band aan de voorkant, op de oplegger of laadbak het beeldmerk als twee stipjes (geel boven rood). De statuskleur
// blijft de vulling van de oplegger of laadbak en de rand van de cabine: die moet in een oogopslag te zien zijn. (Een wit
// voertuig met alleen een gekleurde rand viel weg op een witte weg, en een rode cabine las als 'vertraagd'.)
// dezelfde kleuren als de 3D-wereld (scene3d/palette.js: rood, geel, cabineWit)
const SL = { red: '#E3001F', gold: '#F0A526', white: '#F5F5F2' };
function slCab(g, c, s, x, y, w, h, r) { body(g, s, x, y, w, h, r); fill(g, c, x, y, w, h, r); fill(g, SL.white, x + 1.7, y + 1.7, w - 3.4, h - 3.4, Math.max(0.8, r - 1.7)); g.fillStyle = SL.gold; g.fillRect(x + 1.7, y + 1.7, w - 3.4, 1.5); }
function slLogo(g, x, y, r = 1.25) { g.fillStyle = SL.white; g.beginPath(); g.arc(x, y, r + 0.6, 0, Math.PI * 2); g.arc(x, y + r * 2.3, r + 0.6, 0, Math.PI * 2); g.fill(); g.fillStyle = SL.gold; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = SL.red; g.beginPath(); g.arc(x, y + r * 2.3, r, 0, Math.PI * 2); g.fill(); }
const LIVERY = {
  trekker: [16, 38, (g, c, d, s) => { body(g, s, -6.2, -7.5, 12.4, 25.5, 2.2); fill(g, c, -6.2, -7.5, 12.4, 25.5, 2.2); roof(g, -4.6, -5.6, 9.2, 21.6); slLogo(g, 0, -3.4); slCab(g, c, s, -6.2, -18.6, 12.4, 10.4, 3.6); }],
  solo: [16, 22, (g, c, d, s) => { body(g, s, -3.6, -1.2, 7.2, 10.2, 1.6); fill(g, d, -3.6, -1.2, 7.2, 10.2, 1.6); slCab(g, c, s, -6.2, -11, 12.4, 10.4, 3.6); }],
  bakwagen: [16, 32, (g, c, d, s) => { body(g, s, -6.2, -5.4, 12.4, 21.4, 2); fill(g, c, -6.2, -5.4, 12.4, 21.4, 2); roof(g, -4.6, -3.6, 9.2, 17.6); slLogo(g, 0, -1.6); slCab(g, c, s, -6.2, -15.6, 12.4, 9.6, 3.4); }],
  bus: [14, 25, (g, c, d, s) => { body(g, s, -5.2, -12, 10.4, 24, 3.4); fill(g, c, -5.2, -12, 10.4, 24, 3.4); fill(g, SL.white, -3.5, -10.3, 7, 8, 2); g.fillStyle = SL.gold; g.fillRect(-3.5, -10.3, 7, 1.5); slLogo(g, 0, 1.6); }],
};
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v * (1 - k)); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; }

export function buildAtlas(statuses, theme) {
  const dark = theme === 'dark'; const stroke = dark ? '#0F1216' : '#FFFFFF';
  // Eerst wat er altijd moet zijn (halo, ring, per status een stip en de voertuigen), de parkeerblokken als laatste: komen
  // er ooit zoveel statussen bij dat de atlas vol raakt (MAXS), dan vallen alleen die weg en tekent de laag het gewone
  // voertuig.
  const list = [];
  list.push({ name: 'halo', w: 64, h: 64, draw: g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32); const c = dark ? '255,255,255' : '21,24,30'; gr.addColorStop(0, `rgba(${c},${dark ? 0.26 : 0.2})`); gr.addColorStop(0.55, `rgba(${c},${dark ? 0.14 : 0.11})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill(); } });
  list.push({ name: 'ring', w: 64, h: 64, draw: g => { g.beginPath(); g.arc(0, 0, 27, 0, Math.PI * 2); g.fillStyle = 'rgba(227,0,31,.09)'; g.fill(); g.lineWidth = 6; g.strokeStyle = dark ? 'rgba(15,18,22,.9)' : 'rgba(255,255,255,.95)'; g.stroke(); g.lineWidth = 3.2; g.strokeStyle = '#E3001F'; g.stroke(); } });
  for (const [st, v] of Object.entries(statuses)) {
    list.push({ name: `dot-${st}`, w: 12, h: 12, draw: g => { g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2); g.lineWidth = 2.4; g.strokeStyle = stroke; g.stroke(); g.fillStyle = v.color; g.fill(); }, shadow: true });
    for (const [k, [w, h, draw]] of Object.entries(KINDS)) list.push({ name: `veh-${k}-${st}`, w, h, draw: g => draw(g, v.color, shade(v.color, 0.22), stroke), shadow: true });
  }
  for (const [st, v] of Object.entries(statuses)) for (const [k, [w, h, cab]] of Object.entries(PARK)) list.push({ name: `park-${k}-${st}`, w, h, draw: g => { rr(g, -w / 2, -h / 2, w, h, 1.6); g.lineWidth = 1.4; g.strokeStyle = stroke; g.stroke(); g.fillStyle = v.color; g.fill(); rr(g, -w / 2 + 0.7, -h / 2 + 0.7, w - 1.4, h * cab, 1.2); g.fillStyle = shade(v.color, 0.28); g.fill(); }, shadow: true, small: true });
  // de huisstijl (van dichtbij): rijdend (liv-) en als blok op ware grootte (lpark-); als laatste, zodat bij een volle atlas
  // alleen deze wegvallen en de laag de gewone iconen tekent
  for (const [st, v] of Object.entries(statuses)) for (const [k, [w, h, draw]] of Object.entries(LIVERY)) list.push({ name: `liv-${k}-${st}`, w, h, draw: g => draw(g, v.color, shade(v.color, 0.22), stroke), shadow: true });
  for (const [st, v] of Object.entries(statuses)) for (const [k, [w, h, cab]] of Object.entries(PARK)) list.push({ name: `lpark-${k}-${st}`, w, h, draw: g => { rr(g, -w / 2, -h / 2, w, h, 1.6); g.lineWidth = 1.4; g.strokeStyle = stroke; g.stroke(); g.fillStyle = v.color; g.fill(); const ch = h * cab; rr(g, -w / 2 + 1.1, -h / 2 + 1.1, w - 2.2, ch - 1.1, 1); g.fillStyle = SL.white; g.fill(); g.fillStyle = SL.gold; g.fillRect(-w / 2 + 1.1, -h / 2 + 1.1, w - 2.2, Math.min(1.1, ch * 0.25)); if (k !== 'solo') slLogo(g, 0, -h / 2 + ch + 2.2, 0.8); }, shadow: true, small: true });
  // plank-indeling op een canvas van 1024 breed
  const W = 1024, pad = 12; let x = pad, y = pad, rowH = 0;
  for (const s of list) { const pw = Math.ceil((s.w + 2 * M) * S), ph = Math.ceil((s.h + 2 * M) * S); if (x + pw + pad > W) { x = pad; y += rowH + pad; rowH = 0; } s.px = x; s.py = y; s.pw = pw; s.ph = ph; x += pw + pad; rowH = Math.max(rowH, ph); }
  let H = 64; while (H < y + rowH + pad) H *= 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const sprites = new Map(); const uv = new Float32Array(MAXS * 4), sz = new Float32Array(MAXS * 2);
  list.slice(0, MAXS).forEach((s, i) => {
    g.save(); g.translate(s.px + s.pw / 2, s.py + s.ph / 2); g.scale(S, S); g.lineJoin = 'round';
    if (s.shadow) { g.shadowColor = dark ? 'rgba(0,0,0,.55)' : 'rgba(17,20,28,.28)'; g.shadowBlur = (s.small ? 1.2 : 2.2) * S; g.shadowOffsetY = (s.small ? 0.4 : 0.7) * S; }
    s.draw(g); g.restore();
    uv.set([s.px / W, s.py / H, (s.px + s.pw) / W, (s.py + s.ph) / H], i * 4); sz.set([s.w + 2 * M, s.h + 2 * M], i * 2);
    sprites.set(s.name, { i, w: s.w, h: s.h });
  });
  return { canvas: cv, sprites, uv, sz };
}

// ---------------------------------------------------------------------------------------------------------------------
// De WebGL-laag: een vierhoek per voertuig (instanced), in Mercator-eenheden rond een eigen oorsprong (precisie),
// gedraaid op koers en geschaald in schermpixels; plat op de kaart, dus ook goed bij een gekantelde kaart. De schaal per
// zoomniveau (zoals icon-size) zit in een uniform, zodat de iconen ook tijdens het zoomen precies de goede maat hebben.
const VS = `#version 300 es
in vec2 a_corner;
in vec4 a_inst;   // x, y (Mercator, t.o.v. de oorsprong), hoek (rad), sprite
in vec3 a_inst2;  // maatfactor, dekking, schaalsoort (0 voertuig, 1 stip)
uniform mat4 u_matrix;
uniform float u_pxm;
uniform vec2 u_scale;
uniform vec4 u_uv[96];
uniform vec2 u_sz[96];
out vec2 v_uv; out float v_alpha;
void main() {
  int s = int(a_inst.w + 0.5);
  float k = a_inst2.z < 0.5 ? u_scale.x : u_scale.y;
  vec2 c = a_corner * u_sz[s] * (a_inst2.x * k);
  float ca = cos(a_inst.z), sa = sin(a_inst.z);
  vec2 r = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
  gl_Position = u_matrix * vec4(a_inst.xy + r * u_pxm, 0.0, 1.0);
  vec4 uv = u_uv[s];
  v_uv = mix(uv.xy, uv.zw, a_corner + 0.5);
  v_alpha = a_inst2.y;
}`;
const FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv; in float v_alpha;
out vec4 fragColor;
void main() { fragColor = texture(u_tex, v_uv) * v_alpha; }`;
const STRIDE = 7;

// uniforms(): { pxm: Mercator-eenheden per schermpixel, vs: schaal van de voertuigiconen, ds: schaal van de stippen }
export function createVehicleLayer(id, uniforms) {
  let gl = null, prog = null, vao = null, quad = null, ibuf = null, cap = 0, tex = null, U = null, failed = false;
  let atlas = null, texDirty = true, data = new Float32Array(STRIDE * 2048), n = 0, bufDirty = true, ox = 0.5, oy = 0.5, visible = true;
  const m = new Float32Array(16);
  function compile(type, src) { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader'); return sh; }
  function init() {
    prog = gl.createProgram(); gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    U = { m: gl.getUniformLocation(prog, 'u_matrix'), pxm: gl.getUniformLocation(prog, 'u_pxm'), sc: gl.getUniformLocation(prog, 'u_scale'), uv: gl.getUniformLocation(prog, 'u_uv'), sz: gl.getUniformLocation(prog, 'u_sz'), tex: gl.getUniformLocation(prog, 'u_tex') };
    const aC = gl.getAttribLocation(prog, 'a_corner'), aI = gl.getAttribLocation(prog, 'a_inst'), aI2 = gl.getAttribLocation(prog, 'a_inst2');
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(aC, 0);
    ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); cap = data.byteLength; gl.bufferData(gl.ARRAY_BUFFER, cap, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aI); gl.vertexAttribPointer(aI, 4, gl.FLOAT, false, STRIDE * 4, 0); gl.vertexAttribDivisor(aI, 1);
    gl.enableVertexAttribArray(aI2); gl.vertexAttribPointer(aI2, 3, gl.FLOAT, false, STRIDE * 4, 16); gl.vertexAttribDivisor(aI2, 1);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    tex = gl.createTexture(); texDirty = true; bufDirty = true;
  }
  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texDirty = false;
  }
  const layer = {
    id, type: 'custom', renderingMode: '2d',
    onAdd(map, g) { gl = g; try { init(); } catch (e) { failed = true; console.warn('voertuiglaag', e); } },
    onRemove() { if (gl && prog) { gl.deleteProgram(prog); gl.deleteBuffer(quad); gl.deleteBuffer(ibuf); gl.deleteTexture(tex); gl.deleteVertexArray(vao); } prog = null; },
    render(g, args) {
      if (failed || !visible || !n || !atlas) return;
      if (g !== gl || !prog) { gl = g; try { init(); } catch (e) { failed = true; return; } }
      const P = args && args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args.modelViewProjectionMatrix;
      // u_matrix = P * T(ox, oy): de oorsprong zit in de matrix (in float64 uitgerekend), de posities zijn kleine afstanden
      for (let i = 0; i < 12; i++) m[i] = P[i];
      for (let r = 0; r < 4; r++) m[12 + r] = P[r] * ox + P[4 + r] * oy + P[12 + r];
      const u = uniforms();
      gl.useProgram(prog); gl.bindVertexArray(vao);
      if (texDirty) uploadTexture();
      if (bufDirty) { gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); if (data.byteLength > cap) { cap = data.byteLength; gl.bufferData(gl.ARRAY_BUFFER, cap, gl.DYNAMIC_DRAW); } gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * STRIDE); bufDirty = false; }
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(U.m, false, m); gl.uniform1f(U.pxm, u.pxm); gl.uniform2f(U.sc, u.vs, u.ds);
      gl.uniform4fv(U.uv, atlas.uv); gl.uniform2fv(U.sz, atlas.sz);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.tex, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.bindVertexArray(null);
    },
  };
  return {
    layer,
    ok: () => !failed,
    setAtlas(a) { atlas = a; texDirty = true; },
    atlas: () => atlas,
    // de instanties van een beeld: begin(oorsprong), push(...) per icoon, end()
    begin(x0, y0) { ox = x0; oy = y0; n = 0; },
    push(x, y, ang, sprite, mult, alpha, dot) {
      if ((n + 1) * STRIDE > data.length) { const d = new Float32Array(data.length * 2); d.set(data); data = d; }
      const o = n * STRIDE; data[o] = x - ox; data[o + 1] = y - oy; data[o + 2] = ang; data[o + 3] = sprite; data[o + 4] = mult; data[o + 5] = alpha; data[o + 6] = dot ? 1 : 0; n++;
    },
    end() { bufDirty = true; },
    count: () => n,
    setVisible(v) { visible = v; },
  };
}
