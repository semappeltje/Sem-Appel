// Effecten van de 3D-wereld: vlakken op de grond (contactschaduw, rand in de statuskleur, selectie- en aanwijsring,
// lichtpoelen en koplampbundels), de nevel in de verte over de kaart, de lucht als omgeving (voor glans op lak en glas)
// en de getekende texturen (gevels, daken, asfalt). Alles procedureel; niets wordt van buiten geladen.
import * as THREE from 'three';

// ---------- vlakken op de grond (één tekening voor alle voertuigen) ----------
// Per exemplaar: aBox = halve breedte, halve lengte, hoekstraal, randbreedte (meters); aCol = kleur en dekking; aType:
// 0 contactschaduw, 1 rand in de statuskleur, 2 selectiering (ring op de rand van het vak, dikte = randbreedte, met een
// zachte vulling), 3 aanwijsring (alleen de ring), 4 lichtpoel, 5 koplampbundel (vanaf het midden naar voren, −z).
const DECAL_VS = `
attribute vec4 aBox; attribute vec4 aCol; attribute float aType;
varying vec2 vP; varying vec4 vBox; varying vec4 vCol; varying float vType;
#include <fog_pars_vertex>
void main() {
  vec2 ext = aBox.xy + vec2(aBox.w);
  vec3 p = vec3(position.x * ext.x, 0.0, position.z * ext.y);
  vP = p.xz; vBox = aBox; vCol = aCol; vType = aType;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const DECAL_FS = `
varying vec2 vP; varying vec4 vBox; varying vec4 vCol; varying float vType;
#include <fog_pars_fragment>
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float f = vBox.w; float d = sdBox(vP, vBox.xy, vBox.z); float aa = max(fwidth(d), 1e-4) * 1.25; float a = 0.0; int t = int(vType + 0.5);
  if (t == 0) { a = 1.0 - smoothstep(-f * 0.35, f, d); a *= a; }
  else if (t == 1) { float x = d > 0.0 ? d / f : -d / (f * 0.45); a = exp(-x * x * 2.2); }
  else if (t == 2) { a = 1.0 - smoothstep(f * 0.5 - aa, f * 0.5 + aa, abs(d)); a = max(a, 0.14 * (1.0 - smoothstep(-aa, aa, d))); }
  else if (t == 3) { a = 1.0 - smoothstep(f * 0.5 - aa, f * 0.5 + aa, abs(d)); }
  else if (t == 4) { float q = length(vP / max(vBox.xy, vec2(1e-3))); a = pow(max(0.0, 1.0 - q), 1.7); }
  else { float along = clamp(-vP.y / vBox.y, 0.0, 1.0); float spread = abs(vP.x) / (vBox.x * (0.22 + along)); a = (1.0 - smoothstep(0.55, 1.0, spread)) * pow(1.0 - along, 1.4) * step(0.0, -vP.y); }
  a *= vCol.a;
  #ifdef USE_FOG
    a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb, a);
  #include <colorspace_fragment>
}`;
export function decalMesh(max, additive) {
  const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: DECAL_FS, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), fog: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = additive ? 4 : 3;
  const attr = (name, n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  mesh.userData = { box: attr('aBox', 4), col: attr('aCol', 4), type: attr('aType', 1), n: 0 };
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
// een vlak toevoegen: positie (x, y, z), richting (radialen om y), maten en stijl
const _c = new THREE.Color();
export function pushDecal(mesh, x, y, z, ang, hw, hl, r, f, hex, alpha, type) {
  const u = mesh.userData; const i = u.n; if (i >= mesh.instanceMatrix.count) return;
  const e = mesh.instanceMatrix.array; const o = i * 16; const c = Math.cos(ang), s = Math.sin(ang);
  e[o] = c; e[o + 1] = 0; e[o + 2] = -s; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = s; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
  u.box.array.set([hw, hl, r, f], i * 4); _c.setHex(hex); u.col.array.set([_c.r, _c.g, _c.b, alpha], i * 4); u.type.array[i] = type; u.n = i + 1;
}
export function beginDecals(mesh) { mesh.userData.n = 0; }
export function endDecals(mesh) { const u = mesh.userData; mesh.count = u.n; mesh.visible = u.n > 0; if (!u.n) return; mesh.instanceMatrix.needsUpdate = true; for (const a of [u.box, u.col, u.type]) { a.needsUpdate = true; } }

// ---------- nevel in de verte: over de hele kaart, op basis van de afstand tot de grond langs elke kijkstraal ----------
export function hazeMesh() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uInv: { value: new THREE.Matrix4() }, uEye: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3(0, -1, 0) }, uColor: { value: new THREE.Color() }, uNear: { value: 1 }, uFar: { value: 2 }, uMax: { value: 0.5 } },
    vertexShader: 'varying vec2 vN; void main() { vN = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uFwd; uniform vec3 uColor; uniform float uNear; uniform float uFar; uniform float uMax; varying vec2 vN;
      void main() { vec4 b = uInv * vec4(vN, 1.0, 1.0); vec3 dir = normalize(b.xyz / b.w - uEye); float t = dir.y < -1e-5 ? -uEye.y / dir.y : 1e9; float depth = dot(dir * t, uFwd);
        float f = smoothstep(uNear, uFar, depth); f = f * f * (3.0 - 2.0 * f) * uMax; if (f < 0.003) discard; gl_FragColor = vec4(uColor, f);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -100; return m;
}

// ---------- sluier over de kaart: vermenigvuldigt wat de kaart al tekende (onder de 3D-wereld) met één kleur ----------
// 's Avonds en 's nachts gaat een lichte kaart zo mee de avond in; de namen op de kaart liggen erboven en blijven
// leesbaar. Wit (niets) overdag; de mesh is dan verborgen.
export function veilMesh() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -200; m.visible = false; return m;
}

// ---------- lucht als omgeving (alleen voor glans en weerspiegeling): dag, schemer of nacht ----------
export function skyTexture(kind) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 32);
  if (kind === 'nacht') { gr.addColorStop(0, '#0A1220'); gr.addColorStop(0.47, '#1B2636'); gr.addColorStop(0.53, '#141A21'); gr.addColorStop(1, '#0B0E12'); }
  else if (kind === 'schemer') { gr.addColorStop(0, '#1E2C4E'); gr.addColorStop(0.36, '#3E5682'); gr.addColorStop(0.47, '#C9876A'); gr.addColorStop(0.5, '#E4A576'); gr.addColorStop(0.55, '#2C2F36'); gr.addColorStop(1, '#14161A'); }
  else { gr.addColorStop(0, '#9FC3E6'); gr.addColorStop(0.42, '#DCE9F4'); gr.addColorStop(0.5, '#F4F1EA'); gr.addColorStop(0.56, '#B9C2B2'); gr.addColorStop(1, '#8E9A8A'); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 32);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- getekende texturen ----------
// willReadFrequently: de ruis leest de pixels terug; op een canvas in het geheugen is dat snel (op de GPU een trage terugleesactie)
function canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); fn(g, w, h); return c; }
const tex = (c, srgb = true, repeat = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
// vaste ruis (dezelfde elke keer)
function noise(g, w, h, amt, seed = 1) { let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; const img = g.getImageData(0, 0, w, h); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0); }

// Loods (Simon Loos): sandwichpanelen met naden per meter, een plint, een lichtstraat en een rode daklijst. v = hoogte/wandhoogte
// (0 onder, 1 boven), u = meters / 8.
export function warehouseTextures(sl) {
  const W = 256, H = 256;
  const day = canvas(W, H, (g) => {
    g.fillStyle = '#E9ECEF'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += W / 8) { g.fillStyle = 'rgba(120,130,140,.28)'; g.fillRect(x, 0, 1.5, H); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 1.5, 0, 1, H); }
    g.fillStyle = '#C9CED4'; g.fillRect(0, H * 0.24, W, 2); g.fillRect(0, H * 0.52, W, 2);
    g.fillStyle = '#B7C6D2'; g.fillRect(0, H * 0.16, W, H * 0.055);
    for (let x = 0; x < W; x += W / 16) { g.fillStyle = 'rgba(70,85,100,.35)'; g.fillRect(x, H * 0.16, 1, H * 0.055); }
    g.fillStyle = sl ? '#E3001F' : '#7D858F'; g.fillRect(0, 0, W, H * 0.065);
    g.fillStyle = '#9DA4AC'; g.fillRect(0, H * 0.93, W, H * 0.07);
    noise(g, W, H, 6, 7);
  });
  const night = canvas(W, H, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#5A6E82'; g.fillRect(0, H * 0.16, W, H * 0.055); });
  return { map: tex(day), emissive: tex(night) };
}
// Kantoor: raambanden per verdieping (3,4 m), u = meters / 6 (vier traveeën van 1,5 m), v = hoogte / 3,4.
export function officeTextures() {
  const W = 256, H = 256;
  const day = canvas(W, H, (g) => {
    g.fillStyle = '#F1F2F3'; g.fillRect(0, 0, W, H);
    const bay = W / 4; const y0 = H * (1 - (0.9 + 1.55) / 3.4), y1 = H * (1 - 0.9 / 3.4);
    for (let i = 0; i < 4; i++) {
      const x0 = i * bay + bay * 0.1, x1 = (i + 1) * bay - bay * 0.1;
      g.fillStyle = '#3B4048'; g.fillRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#9CB4C8'); gr.addColorStop(0.45, '#4D6378'); gr.addColorStop(1, '#2C3A48');
      g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * 0.45, y0); g.lineTo(x0, y0 + (y1 - y0) * 0.6); g.fill();
      g.fillStyle = '#3B4048'; g.fillRect((x0 + x1) / 2 - 1.5, y0, 3, y1 - y0);
    }
    g.fillStyle = '#D9DDE1'; g.fillRect(0, H - 6, W, 6);
    noise(g, W, H, 5, 11);
  });
  const night = canvas(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const bay = W / 4; const y0 = H * (1 - (0.9 + 1.55) / 3.4), y1 = H * (1 - 0.9 / 3.4);
    for (let i = 0; i < 4; i++) { const x0 = i * bay + bay * 0.1, x1 = (i + 1) * bay - bay * 0.1; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#FFE2A6'); gr.addColorStop(1, '#F2B866'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = '#000'; g.fillRect((x0 + x1) / 2 - 1.5, y0, 3, y1 - y0); }
  });
  return { map: tex(day), emissive: tex(night) };
}
// Woonhuis: baksteen of pleister (de kleur komt per huis uit de instantie), ramen en een deur. u = meters / 6, v = hoogte / 5,6.
export function houseTextures() {
  const W = 128, H = 128;
  const day = canvas(W, H, (g) => {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, 1); }
    const win = (x, y, w, h) => { g.fillStyle = '#EDEDED'; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = '#4B5866'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, w * 0.45, h * 0.4); g.fillStyle = '#EDEDED'; g.fillRect(x + w / 2 - 1, y, 2, h); };
    win(10, 14, 34, 26); win(76, 14, 34, 26); win(10, 76, 34, 30); g.fillStyle = '#5B4637'; g.fillRect(80, 72, 24, 56);
    noise(g, W, H, 8, 3);
  });
  const night = canvas(W, H, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#FFD592'; g.fillRect(10, 14, 34, 26); g.fillRect(76, 14, 34, 26); g.fillRect(10, 76, 34, 30); });
  return { map: tex(day), emissive: tex(night) };
}
// Dakpannen voor het zadeldak (de kleur komt per huis uit de instantie)
export function roofTexture() {
  return tex(canvas(64, 64, (g) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, 64, 2); for (let x = (y / 8) % 2 ? 0 : 4; x < 64; x += 8) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x, y, 1, 8); } } noise(g, 64, 64, 10, 5); }));
}
// Asfalt van het terrein (u, v = meters / 40, 512 px: 7,8 cm per pixel): zachte vlekken, een paar gerepareerde stroken
// met strakke randen, gevoegde scheuren, olievlekken en daaroverheen een lichte korrel (fijne ruis met lichte en donkere
// steentjes). De korrel is een tegel van 128 px die over het vlak herhaalt: één tekenopdracht op het canvas in plaats van
// een rekenronde over alle 262.000 pixels (scheelt tientallen milliseconden bij het bouwen). Vaste toevalsreeks: elke
// keer hetzelfde.
export function yardTexture() {
  return tex(canvas(512, 512, (g) => {
    let sd = 5; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.fillStyle = '#878D94'; g.fillRect(0, 0, 512, 512);
    // zachte vlekken (slijtage, nieuwer en ouder asfalt)
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '52,56,62' : '250,250,248'},${0.03 + r() * 0.04})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 24 + r() * 90, 14 + r() * 50, r() * 3, 0, 7); g.fill(); }
    // gerepareerde stroken: donkerder, strakke randen
    for (let i = 0; i < 4; i++) { const w = 30 + r() * 70, h = 20 + r() * 40; g.save(); g.translate(r() * 512, r() * 512); g.rotate(r() < 0.5 ? 0 : Math.PI / 2); g.fillStyle = 'rgba(48,52,58,.16)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = 'rgba(30,33,38,.22)'; g.lineWidth = 1.2; g.strokeRect(-w / 2, -h / 2, w, h); g.restore(); }
    // gevoegde scheuren: dunne kronkellijnen met bitumen
    g.strokeStyle = 'rgba(28,30,34,.32)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { let x = r() * 512, y = r() * 512, a = r() * 6.28; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
    // olievlekken (waar trucks stilstaan)
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(26,28,32,${0.05 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 8, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
    // de korrel als doorzichtige tegel: wit maakt lichter, zwart donkerder (op dit grijs: ruis van ongeveer plus en min
    // 7, lichte steentjes plus 26, donkere min 22)
    const T = 128, tile = document.createElement('canvas'); tile.width = tile.height = T; const tg = tile.getContext('2d');
    const img = tg.createImageData(T, T), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const q = r(), n = r() - 0.5;
      if (q < 0.035) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 55; }
      else if (q < 0.06) { d[i + 3] = 42; }
      else { const v = n > 0 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(Math.abs(n) * 30); }
    }
    tg.putImageData(img, 0, 0); g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, 512, 512);
  }));
}
// Dockschort en laadvloer voor de deuren: lichte betonplaten van 6 bij 6 m met voegen
export function apronTexture() {
  return tex(canvas(128, 128, (g) => { g.fillStyle = '#B7BCC1'; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 10, 33); g.fillStyle = 'rgba(70,76,84,.35)'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128); }));
}
// Plat dak: grind met naden
export function flatRoofTexture() {
  return tex(canvas(128, 128, (g) => { g.fillStyle = '#B9BEC4'; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 16, 9); g.fillStyle = 'rgba(40,46,54,.10)'; for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 1.5, 128); } g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 16; i < 128; i += 32) g.fillRect(i, 0, 1, 128); }));
}
// Dockborden: nummers 1 tot 100 in een raster van 10 bij 10 (wit bord, donkere rand en cijfers, systeemletter); het
// vak van nummer k: kolom (k - 1) % 10, rij floor((k - 1) / 10) van boven
export function dockNumberTexture() {
  const c = canvas(512, 512, (g) => {
    g.fillStyle = '#2A2F36'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 51.2, y = Math.floor(i / 10) * 51.2;
      g.fillStyle = '#F4F5F6'; g.fillRect(x + 3.5, y + 3.5, 44.2, 44.2);
      g.fillStyle = '#1F2329'; g.font = `700 ${i + 1 >= 100 ? 20 : 29}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), x + 25.6, y + 27.5);
    }
  });
  return tex(c, true, false);
}
