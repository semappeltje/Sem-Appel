// 3D-wereld van de Control Tower: een eigen laag van MapLibre (CustomLayerInterface, renderingMode "3d") die met three.js
// tekent. Laagpolygonaal maar realistisch van verhouding: voertuigen op ware grootte (trekker met oplegger 16,5 m, 4 m
// hoog) die alleen bij uitzoomen meegroeien zodat ze vindbaar blijven, standplaatsen op hun echte terrein met de hal
// uit de gebouwgegevens, genummerde docks, kantoren met ramen, parkeerrijen, poort, hagen, lichtmasten en bomen, een
// zon met schaduwen die met de klok van de simulatie meedraait (nacht, schemer, gouden uur, dag), zachte nevel in de verte
// en vanaf de schemer koplampen, verlichte ramen en lichtpoelen. Procedureel, op
// vier bomen en twee fabrieksdetails na (CC0-modellen uit assets-3d, ingebakken in deze bundel); niets komt van buiten.
//
// Geen imports uit de app zelf: standplaatsen, statuskleuren, bebouwing, winkels en DC's komen via opts.data, de
// gebouwcontouren via een dynamische import van ./buildings.js (of een lader in opts.data). Zo blijft deze module (met
// three.js) een eigen, pas bij de eerste klik geladen bundel, zonder dat app.js er statisch aan hangt.
import * as THREE from 'three';
import { clamp, mercX, mercY, mpuAt, metersPerPixel, hashStr, hash } from './scene3d/util.js';
import { paletteMaterial, disposePalette } from './scene3d/palette.js';
import { buildModels, wheelGeometry } from './scene3d/vehicles.js';
import { decalMesh, pushDecal, beginDecals, endDecals, hazeMesh, skyTexture, veilMesh } from './scene3d/fx.js';
import { createWorld } from './scene3d/world.js';
import { lichtOp, vandaag, zonOpOnder } from './scene3d/licht.js';
import { createSigns } from './scene3d/borden.js';

// Gebouwcontouren (src/buildings.js, een eigen bundel van 2,4 MB): pas geladen als de 3D-wereld aangaat. De kaart kan een
// lader meegeven (opts.data.laadGebouwen, uit places.js); anders laadt deze module het bestand zelf. Het pad staat
// tussen haakjes: dan zet Vite er geen preload-hulpje omheen. Dat hulpje zou anders in de three-bundel belanden, en
// app.js zou het daar statisch uit importeren (dan laadt three.js bij elke paginalading). Rollup bundelt het pad wel
// gewoon. Lukt het laden niet, dan komen er procedurele depots.
const ownBuildingsLoader = () => import(/* @vite-ignore */ ('./buildings.js'));

const KINDS = ['trekker', 'solo', 'bakwagen', 'bus'];
const LODS = ['hi', 'mid', 'lo'];

export function createScene3d(map, maplibregl, opts) {
  const { SP, ST, TRST, urban } = opts.data;
  let theme = opts.theme || 'light';
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- scene, camera, licht ----------
  const T0 = performance.now();
  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
  const sun = new THREE.DirectionalLight(0xFFFFFF, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 2.6; sun.shadow.bias = -0.0004;
  const hemi = new THREE.HemisphereLight(0xDCE7F2, 0xB7BFAA, 0.5);
  scene.add(sun, sun.target, hemi);
  scene.fog = new THREE.Fog(0xE8ECEA, 2000, 8000);
  const sky = { dag: skyTexture('dag'), schemer: skyTexture('schemer'), nacht: skyTexture('nacht') };   // de omgeving zet applyLight()
  const haze = hazeMesh(), veil = veilMesh(); scene.add(haze, veil);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x1B2638, opacity: 0.28, depthWrite: false }));
  shadowPlane.receiveShadow = true; shadowPlane.frustumCulled = false; shadowPlane.renderOrder = 2; shadowPlane.material.polygonOffset = true; shadowPlane.material.polygonOffsetFactor = 2; shadowPlane.material.polygonOffsetUnits = 2; scene.add(shadowPlane);

  // ---------- voertuigen: per soort drie detailniveaus, plus wielen, statuslampjes en vlakken op de grond ----------
  const pal = paletteMaterial(); const models = buildModels();
  // voertuigen: hetzelfde palet, maar de lichten (koplampen, achterlichten, markeringen) per exemplaar aan of uit
  const palV = paletteMaterial();
  palV.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLights;\nvarying float vLights;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLights = aLights;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLights;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLights;');
  };
  palV.customProgramCacheKey = () => 'voertuiglichten';
  const MAXV = 1500, MAXT = 1900, MAXW = 2600;
  const inst = (geo, mat, max) => { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
  const vm = {}; for (const k of [...KINDS, 'oplegger']) for (const l of LODS) { const max = k === 'oplegger' ? MAXT : MAXV; const m = inst(models[k][l], palV, max); const a = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); a.setUsage(THREE.DynamicDrawUsage); m.geometry.setAttribute('aLights', a); vm[k + l] = m; }
  const wheels = inst(wheelGeometry(12), pal, MAXW);
  const beaconGeo = new THREE.BoxGeometry(0.86, 0.17, 0.34); beaconGeo.translate(0, 0.085, 0);
  const beacons = new THREE.InstancedMesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, toneMapped: false }), MAXV + MAXT); beacons.count = 0; beacons.frustumCulled = false; beacons.setColorAt(0, new THREE.Color()); beacons.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(beacons);
  const decals = decalMesh(9000, false), glows = decalMesh(5000, true); scene.add(decals, glows);
  // winkels en DC's van de klantenlijst (WINKELS, DCS) als de kaart ze meegeeft; zonder die lijsten generieke panden
  const given = opts.data.laadGebouwen || opts.data.loadBuildings;
  const buildingsLoader = typeof given === 'function' ? () => Promise.resolve(given()).then(m => (m && m.default ? m : { default: m })) : ownBuildingsLoader;
  const world = createWorld({ scene, SP, urban, buildingsLoader, pal, theme, shops: opts.data.shops || opts.data.WINKELS || [], dcs: opts.data.DCS || [] });
  // naamborden van de afdelingen (sp.afdelingen), vanaf zoom 15,5
  const signs = createSigns(); scene.add(signs.mesh);

  // ---------- toestand ----------
  // licht uit de klok (zie applyLight): de waarden van nu, de sleutel van de laatste berekening en de lampen (0 tot 1)
  let vast = null, licht = null, lichtKey = '', lampK = 0; const usedEnv = new Set(); const fogTmp = new THREE.Color(), SCHADUW = new THREE.Color(0x1B2638), ZWART = new THREE.Color(0x000000), WIT = new THREE.Color(0xFFFFFF);
  let on = false, renderer = null, O = null, epoch = 0, zoom = map.getZoom(), shadowsOn = true;
  let vehicles = [], trailers = [], selId = null, hoverId = null;
  const L = new THREE.Matrix4(), G = new THREE.Matrix4(), invG = new THREE.Matrix4(), CW = new THREE.Matrix4();
  const eye = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const ROTX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const view = { focus: [0, 0], R: 1000, zoom: 0, camDist: 1000, mpp: 1, box: [0, 0, 0, 0], ppm: 1, pitch: 0 };
  const motion = new Map();            // per voertuig: vorige positie en afgelegde weg (voor draaiende wielen)
  let pickList = [];                   // wat er dit beeld getekend is: voor klik en aanwijzen
  // tijden: createMs (deze functie), rendererMs (WebGL-renderer op de kaart), firstRenderMs (eerste beeld, met het
  // vertalen van de shaders), firstFrameMs (van aanzetten tot het eerste beeld), renderMs (gemiddelde per beeld)
  const stats = { createMs: 0, rendererMs: 0, firstRenderMs: 0, firstFrameMs: 0, frames: 0, renderMs: 0, enabledAt: 0 };
  let groundColor = null, groundCheck = 0;

  function setOrigin() {
    const c = map.getCenter(); O = { x: mercX(c.lng), y: mercY(c.lat), mpu: mpuAt(c.lat), lon: c.lng, lat: c.lat };
    L.makeTranslation(O.x, O.y, 0).scale(tmp.set(O.mpu, -O.mpu, O.mpu)).multiply(ROTX);
    epoch++; world.setOrigin(O);
  }
  const lx = lon => (mercX(lon) - O.x) / O.mpu, lz = lat => (mercY(lat) - O.y) / O.mpu;
  function needsOrigin() { if (!O) return true; const c = map.getCenter(); return Math.hypot(lx(c.lng), lz(c.lat)) > 2500; }

  // De camera van MapLibre ontleden: G zet scene-meters om naar het scherm. Het oog is het punt waar x, y en w van het
  // scherm nul worden; de kijkrichting volgt uit de eerste twee rijen. Met een echte camerastand werken licht, glans en
  // nevel van three.js zoals bedoeld.
  const A3 = new THREE.Matrix3();
  function deriveCamera() {
    const e = G.elements; const r = k => [e[k], e[4 + k], e[8 + k], e[12 + k]]; const r0 = r(0), r1 = r(1), r3 = r(3);
    A3.set(r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], r3[0], r3[1], r3[2]).invert();
    eye.set(-r0[3], -r1[3], -r3[3]).applyMatrix3(A3);
    fwd.set(r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]); if (fwd.x * r3[0] + fwd.y * r3[1] + fwd.z * r3[2] < 0) fwd.negate(); fwd.normalize();
    up.set(r0[1] * fwd.z - r0[2] * fwd.y, r0[2] * fwd.x - r0[0] * fwd.z, r0[0] * fwd.y - r0[1] * fwd.x); if (up.x * r1[0] + up.y * r1[1] + up.z * r1[2] < 0) up.negate(); up.normalize();
    const zA = tmp.copy(fwd).negate(), xA = tmp2.crossVectors(up, zA).normalize(); const yA = new THREE.Vector3().crossVectors(zA, xA);
    CW.makeBasis(xA, yA, zA).setPosition(eye);
    camera.matrix.copy(CW); camera.matrixWorld.copy(CW); camera.matrixWorldInverse.copy(CW).invert();
    camera.projectionMatrix.multiplyMatrices(G, CW); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invG.copy(G).invert();
  }
  // waar een kijkstraal door het scherm (−1..1) de grond raakt
  const gp = new THREE.Vector4();
  function ground(nx, ny, maxD) {
    gp.set(nx, ny, 1, 1).applyMatrix4(invG); const dx = gp.x / gp.w - eye.x, dy = gp.y / gp.w - eye.y, dz = gp.z / gp.w - eye.z;
    let t = dy < -1e-9 ? -eye.y / dy : Infinity; const tMax = maxD / Math.max(1e-9, Math.hypot(dx, dz)); if (t > tMax) t = tMax;   // niet verder dan maxD (horizontaal)
    return [eye.x + dx * t, eye.z + dz * t];
  }
  function computeView() {
    const c = map.getCenter(); zoom = map.getZoom(); view.zoom = zoom; view.pitch = map.getPitch();
    view.focus = [lx(c.lng), lz(c.lat)]; view.camDist = Math.hypot(eye.x - view.focus[0], eye.y, eye.z - view.focus[1]);
    view.mpp = metersPerPixel(c.lat, zoom);
    const maxD = view.camDist * 6;
    const pts = [ground(-1, -1, maxD), ground(1, -1, maxD), ground(-1, 1, maxD), ground(1, 1, maxD), ground(0, 0, maxD)];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, R = 0; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); R = Math.max(R, Math.hypot(x - view.focus[0], z - view.focus[1])); }
    view.box = [x0, z0, x1, z1]; view.R = clamp(R, 300, view.camDist * 4.5);
    // pixels per meter op diepte 1 (de projectie van MapLibre draagt een vaste schaal in w mee: daarom gedeeld door de w-rij)
    const H = map.getCanvas().clientHeight || 600; const pe = camera.projectionMatrix.elements; view.ppm = 0.5 * H * pe[5] / Math.max(1e-9, -pe[11]);
  }
  // de zon volgt het zichtbare gebied: een schaduwcamera om de onderste vier vijfde van het beeld, in stapjes van een texel
  const sunDir = new THREE.Vector3();
  function placeSun() {
    const az = licht.az * Math.PI / 180, el = licht.el * Math.PI / 180;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const want = zoom >= (shadowsOn ? 11.8 : 12.0); if (want !== shadowsOn) { shadowsOn = want; sun.castShadow = want; shadowPlane.visible = want; }
    if (!shadowsOn) return;
    const maxD = view.camDist * 3.2; const pts = [ground(-1, -1, maxD), ground(1, -1, maxD), ground(-1, 0.55, maxD), ground(1, 0.55, maxD), ground(0, 0.2, maxD)];
    const zl = sunDir, xl = tmp.set(0, 1, 0).cross(zl).normalize().clone(), yl = new THREE.Vector3().crossVectors(zl, xl);
    let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x / pts.length; cz += z / pts.length; }
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const [x, z] of pts) { const dx = x - cx, dz = z - cz; const u = dx * xl.x + dz * xl.z, v = dx * yl.x + dz * yl.z; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    // hooguit 2,6 km breed (een texel van ruim een meter); verder weg geen schaduw, de nevel neemt het daar over
    const pad = 30 + view.mpp * 20; let size = Math.max(u1 - u0, v1 - v0) + pad * 2; size = Math.min(size, 2600);
    const texel = size / sun.shadow.mapSize.x;
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; const ccx = cx + xl.x * cu + yl.x * cv, ccz = cz + xl.z * cu + yl.z * cv;
    const su = Math.round((ccx * xl.x + ccz * xl.z) / texel) * texel, sv = Math.round((ccx * yl.x + ccz * yl.z) / texel) * texel; const sw = (ccx * zl.x + ccz * zl.z);
    const fx = xl.x * su + yl.x * sv + zl.x * sw, fz = xl.z * su + yl.z * sv + zl.z * sw; const fy = xl.y * su + yl.y * sv + zl.y * sw;
    const D = size + 400; sun.target.position.set(fx, fy, fz); sun.position.set(fx + zl.x * D, fy + zl.y * D, fz + zl.z * D);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    view.shadowR = size * 0.5; const cam = sun.shadow.camera; cam.left = -size / 2; cam.right = size / 2; cam.top = size / 2; cam.bottom = -size / 2; cam.near = 10; cam.far = D * 2 + 200; cam.updateProjectionMatrix();
    sun.shadow.normalBias = texel * 1.4; sun.shadow.bias = -0.00025;
    shadowPlane.position.set(cx, 0.02 * Math.max(1, view.mpp), cz); shadowPlane.scale.set(size * 1.5, 1, size * 1.5); shadowPlane.updateMatrixWorld();
  }
  // grondkleur van de kaart (voor de nevel): de achtergrondlaag van de stijl, wat de kaart ook laat zien
  function readGround() {
    try { const ids = map.getLayersOrder ? map.getLayersOrder() : map.getStyle().layers.map(l => l.id); for (const id of ids) { const l = map.getLayer(id); if (l && l.type === 'background') { const v = map.getPaintProperty(id, 'background-color'); if (typeof v === 'string') { const c = new THREE.Color(); c.setStyle(v); return c; } if (v && typeof v === 'object' && 'r' in v) return new THREE.Color(v.r, v.g, v.b); } } } catch { /* stijl nog niet klaar */ }
    return null;
  }
  function atmosphere() {
    const now = performance.now(); if (!groundColor || now - groundCheck > 1500) { groundCheck = now; groundColor = readGround() || groundColor; }
    // de kleur van de kaart, gemengd met de nevel van het uur (overdag lichtblauwgrijs, 's avonds blauw, 's nachts donker)
    const base = groundColor ? groundColor.clone() : new THREE.Color(theme === 'dark' ? 0x12161C : 0xE8ECE6);
    const lum = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722;
    const fogC = base.lerp(fogTmp.setHex(licht.nevel), 0.6);
    // de sluier over de kaart: op een lichte kaart vol, op een donkere kaart (al nacht) bijna niets
    const vc = veil.material.uniforms.uColor.value.setHex(licht.sluier); vc.lerp(WIT, 1 - Math.min(1, lum * 1.1)); veil.visible = vc.r < 0.995 || vc.g < 0.995 || vc.b < 0.995;
    scene.fog.color.copy(fogC);
    const pitchK = clamp((view.pitch - 12) / 38, 0, 1);
    scene.fog.near = view.camDist * 1.55; scene.fog.far = view.camDist * (4.6 + (1 - pitchK) * 6);
    const u = haze.material.uniforms; u.uInv.value.copy(invG); u.uEye.value.copy(eye); u.uFwd.value.copy(fwd); u.uColor.value.copy(fogC); u.uNear.value = view.camDist * 1.45; u.uFar.value = view.camDist * 4.2; u.uMax.value = (0.62 - 0.12 * lampK) * pitchK;
    haze.visible = pitchK > 0.02;
  }

  // ---------- grootte van voertuigen ----------
  // Dichtbij op ware grootte; bij uitzoomen groeien ze mee zodat een truck ongeveer 20 pixels lang blijft (net als de
  // iconen op de platte kaart vindbaar; ware grootte vanaf zoom 15,4). Op het terrein geparkeerd hooguit 1,3 keer (ze staan in vakken).
  const scaleMove = () => Math.max(1, 1.2 * view.mpp);
  const scalePark = () => Math.min(scaleMove(), 1.3);

  // ---------- per beeld: voertuigen, opleggers, wielen, lampjes, vlakken ----------
  const mV = new THREE.Matrix4(), mL = new THREE.Matrix4(), mW = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vP = new THREE.Vector3(), vS = new THREE.Vector3();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  let wn = 0, bn = 0;
  function putM(mesh, i, x, y, z, ang, k) { const e = mesh.instanceMatrix.array, o = i * 16, c = Math.cos(ang) * k, s = Math.sin(ang) * k; e[o] = c; e[o + 1] = 0; e[o + 2] = -s; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = k; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = s; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1; }
  function inView(x, z, m) { const b = view.box; return x > b[0] - m && x < b[2] + m && z > b[1] - m && z < b[3] + m; }
  const C = new THREE.Color();
  // Eerst alle kandidaten verzamelen met hun grootte op het scherm, dan de grootste (tot HI stuks) in het volle detail met
  // draaiende wielen, de rest als middenmodel of blok. Zo blijft de prijs per beeld vast, hoe dicht je ook inzoomt.
  const HI = 60; const pool = []; let np = 0;
  function cand(kind, id, x, z, ang, k, statusHex, opt) {
    const md = models[kind]; const depth = Math.max(1, (x - eye.x) * fwd.x + (0 - eye.y) * fwd.y + (z - eye.z) * fwd.z); const px = md.half[1] * 2 * k * view.ppm / depth;
    if (px < 1.2) return;
    const c = pool[np] || (pool[np] = {}); np++;
    c.kind = kind; c.id = id; c.x = x; c.z = z; c.ang = ang; c.k = k; c.st = statusHex; c.parked = !!opt.parked; c.halo = !!opt.halo; c.moving = !!opt.moving; c.depth = depth; c.px = px;
  }
  function draw(c, lod) {
    const { kind, id, x, z, ang, k } = c; const md = models[kind];
    const mesh = vm[kind + lod]; const i = mesh.count; if (i >= mesh.instanceMatrix.count) return; putM(mesh, i, x, 0, z, ang, k); mesh.count = i + 1; mesh.geometry.attributes.aLights.array[i] = c.parked ? 0 : 1;
    // wielen dichtbij: elk wiel apart, gedraaid naar de afgelegde weg
    if (lod === 'hi') {
      // draaihoek voor een wiel van 0,5 m: afstand sinds het vorige beeld gedeeld door de straal, hooguit 0,42 rad per beeld
      // (sneller zou bij vijf spaken terugdraaien lijken); bij minder beweging staan de wielen stil
      const mo = motion.get(id); let s = mo ? mo.s : hash(hashStr(id), 1) * 6.28;
      if (mo && mo.ep === epoch && !c.parked && !reduced()) s += Math.min(Math.hypot(x - mo.x, z - mo.z) / (0.5 * k), 0.42);
      motion.set(id, { x, z, s, ep: epoch });
      mV.makeRotationY(ang).scale(vS.set(k, k, k)).setPosition(x, 0, z);
      for (const [wx, wz, r, w] of md.wheels) {
        if (wn >= MAXW) break; const left = wx < 0; const spin = (left ? 1 : -1) * s * 0.5 / r;
        qA.setFromAxisAngle(AY, left ? Math.PI : 0); qB.setFromAxisAngle(AX, spin); qA.multiply(qB);
        mL.compose(vP.set(wx, r, wz), qA, vS.set(w, r, r)); mW.multiplyMatrices(mV, mL); mW.toArray(wheels.instanceMatrix.array, wn * 16); wn++;
      }
    }
    // statuslampje op het dak (dichtbij en middenafstand)
    if (lod !== 'lo' && c.st != null && bn < beacons.instanceMatrix.count) {
      const [ox, oy, oz] = md.lamp; const cs = Math.cos(ang), sn = Math.sin(ang); putM(beacons, bn, x + (ox * cs + oz * sn) * k, oy * k, z + (-ox * sn + oz * cs) * k, ang, k); beacons.setColorAt(bn, C.set(c.st)); bn++;
    }
    // vlakken op de grond: contactschaduw, rand in de statuskleur, selectie en aanwijzen, koplampbundel vanaf de schemer
    // breedtes in meters, maar nooit smaller dan een paar pixels (mpx: meters per pixel op de plek van het voertuig);
    // de kleuren volgen het licht (een donkere grond 's nachts), niet het thema van de interface
    const [hw, hl] = md.half; const yd = 0.05 * k; const dark = licht.donker > 0.5; const mpx = c.depth / view.ppm;
    pushDecal(decals, x, yd, z, ang, hw * k, hl * k, 0.8 * k, Math.max(1.3 * k, 2.2 * mpx), 0x000000, dark ? 0.5 : 0.34, 0);
    if (c.st != null && c.halo) pushDecal(decals, x, yd * 1.2, z, ang, hw * k, hl * k, 0.9 * k, Math.max(1.5 * k, 3.4 * mpx), C.set(c.st).getHex(), dark ? 0.9 : 0.66, 1);
    const gap = 1.1 * k + 3 * mpx, ring = Math.max(0.35 * k, 2.2 * mpx);
    if (id === selId) pushDecal(decals, x, yd * 1.4, z, ang, hw * k + gap, hl * k + gap, 1.2 * k + gap, ring, 0xE3001F, 1, 2);
    else if (id === hoverId) pushDecal(decals, x, yd * 1.4, z, ang, hw * k + gap, hl * k + gap, 1.2 * k + gap, ring * 0.75, dark ? 0xEEF1F5 : 0x15181E, 0.75, 3);
    if (lampK > 0.05 && c.moving && md.front != null) { const cs = Math.cos(ang), sn = Math.sin(ang); const fz2 = md.front * k; pushDecal(glows, x + fz2 * sn, yd, z + fz2 * cs, ang, 3.4 * k, 16 * k, 0, 0, 0xFFE3B0, 0.4 * lampK, 5); }
    pickList.push({ id, trailer: kind === 'oplegger', x, z, ang, k, hw, hl, h: md.height, depth: c.depth });
  }
  function updateVehicles() {
    for (const m of Object.values(vm)) m.count = 0; wheels.count = 0; beacons.count = 0; wn = 0; bn = 0; np = 0; pickList = [];
    beginDecals(decals); beginDecals(glows);
    const kM = scaleMove(), kP = scalePark(); const margin = 40 * kM;
    // voertuigen
    for (const f of vehicles) {
      const kind = models[f.k] && f.k !== 'oplegger' ? f.k : 'trekker'; const st = ST[f.st] || ST.terrein || { color: '#9CA3AF' };
      // aan een dock van de eigen standplaats (f.dock, 1 tot n, zoals hal-scherm en planbord): achteruit tegen die deur
      // (alleen opzoeken als hij in de buurt van het beeld is: dat bereidt zijn standplaats voor)
      const dock = +f.dock >= 1 && zoom >= 13 && f.st !== 'onderweg' && f.st !== 'vertraagd' && f.st !== 'klant' && inView(lx(f.lon), lz(f.lat), 400) ? world.dockPose(f.base, +f.dock, models[kind].half[1] - 0.15) : null;
      if (dock) { if (!inView(dock.x, dock.z, 30)) continue; cand(kind, f.id, dock.x, dock.z, dock.ang, kP, st.color, { parked: true }); continue; }
      if (f.st === 'terrein') {
        // geparkeerd: precies op zijn plek in de rij, met de koers van die rij (beide komen zo uit de simulatie)
        if (zoom < 13) continue; const x = lx(f.lon), z = lz(f.lat); if (!inView(x, z, 30)) continue;
        cand(kind, f.id, x, z, -(f.b || 0) * Math.PI / 180, kP, null, { parked: true });
      } else {
        let x = lx(f.lon), z = lz(f.lat); if (!inView(x, z, margin)) continue; let ang = -(f.b || 0) * Math.PI / 180;
        // bij de klant: met de achterkant tegen een dock van het pand (dichtbij; verder weg blijft hij op zijn stopplek)
        if (f.st === 'klant' && kM < 1.6) { const br = (f.b || 0) * Math.PI / 180; const p = world.customer(f.lon, f.lat, Math.atan2(-Math.cos(br), Math.sin(br)), f.id, models[kind].half[1] - 0.15, f.base); if (p) { x = p.x; z = p.z; ang = p.ang; } }
        cand(kind, f.id, x, z, ang, kM, st.color, { halo: true, moving: f.st === 'onderweg' || f.st === 'vertraagd' });
      }
    }
    // losse opleggers: op het terrein op hun plek in de rij (de koers van die rij; aan een dock als f.dock er is), bij een
    // klant tegen de gevel als die bekend is
    for (const f of trailers) {
      const st = TRST[f.st] || { color: '#9CA3AF' };
      if (f.st === 'klaar' || f.st === 'leeg' || f.st === 'onderhoud') {
        // (de koers en het dock pas opzoeken als hij in beeld is: dat bereidt zijn standplaats voor)
        if (zoom < 13) continue; let x = lx(f.lon), z = lz(f.lat); if (!inView(x, z, 60)) continue;
        let ang = f.b != null ? -f.b * Math.PI / 180 : world.rowHeading(f.base, f.lon, f.lat); if (ang == null) ang = 0;
        const dock = +f.dock >= 1 ? world.dockPose(f.base, +f.dock, models.oplegger.half[1] - 0.2) : null; if (dock) { x = dock.x; z = dock.z; ang = dock.ang; if (!inView(x, z, 30)) continue; }
        cand('oplegger', f.id, x, z, ang, kP, st.color, { parked: true });
      } else {
        let x = lx(f.lon), z = lz(f.lat); if (!inView(x, z, margin)) continue;
        const h = hashStr(f.id); const dock = kM < 1.6 ? world.customer(f.lon, f.lat, hash(h, 2) * Math.PI, f.id, models.oplegger.half[1] - 0.2, f.base) : null; let ang;
        if (dock) { x = dock.x; z = dock.z; ang = dock.ang; } else { ang = (hash(h, 3) * 50 - 25) * Math.PI / 180 + (f.b ? -f.b * Math.PI / 180 : 0); x += (hash(h, 5) - 0.5) * 9 * kM; z += (hash(h, 6) - 0.5) * 9 * kM; }
        cand('oplegger', f.id, x, z, ang, kM, st.color, { halo: true });
      }
    }
    // detailniveau: de grootste op het scherm eerst; geparkeerd alleen in vol detail als hij echt groot in beeld staat
    const list = pool.slice(0, np).sort((a, b) => b.px - a.px); let hiLeft = HI;
    for (const c of list) { const lod = hiLeft > 0 && c.px >= (c.parked ? 64 : 30) ? 'hi' : c.px >= 7 ? 'mid' : 'lo'; if (lod === 'hi') hiLeft--; draw(c, lod); }
    world.endParking();
    if (motion.size > (vehicles.length + trailers.length) * 2 + 400) { const keep = new Set([...vehicles.map(v => v.id), ...trailers.map(t => t.id)]); for (const id of motion.keys()) if (!keep.has(id)) motion.delete(id); }
    // lichtpoelen van lantaarnpalen, lichtmasten en docks, vanaf de schemer
    if (lampK > 0.05 && zoom >= 13.2) for (const [x, z, r] of world.pools()) if (inView(x, z, r)) pushDecal(glows, x, 0.08, z, 0, r, r, 0, 0, 0xFFD9A0, (r > 15 ? 0.42 : 0.4) * lampK, 4);
    for (const m of Object.values(vm)) { m.visible = m.count > 0; if (m.count) { m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aLights.needsUpdate = true; } }
    wheels.count = wn; wheels.visible = wn > 0; if (wn) wheels.instanceMatrix.needsUpdate = true;
    beacons.count = bn; beacons.visible = bn > 0; if (bn) { beacons.instanceMatrix.needsUpdate = true; beacons.instanceColor.needsUpdate = true; }
    endDecals(decals); endDecals(glows);
  }

  // ---------- samen met de 3D-gebouwen van OpenFreeMap (laag ofm-3d van de kaart, alleen online) ----------
  // Waar deze wereld echte gebouwcontouren tekent (standplaatsen en DC's uit buildings.js), laat de OFM-laag zijn eigen
  // blokken weg (filter op afstand tot die gebieden); en zolang OFM echte gebouwen laat zien, tekent deze wereld geen
  // verzonnen huizen uit urban.json. Zonder die laag gebeurt hier niets.
  let ofmTick = 0, ofmFilterSet = null;
  function ofmCheck() {
    const now = performance.now(); if (now - ofmTick < 1000) return; ofmTick = now;
    const id = 'ofm-3d'; let vis = false;
    try { vis = !!map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'; } catch { vis = false; }
    world.setOfm(vis && zoom >= 13);
    if (!vis || !world.ready()) return;
    const zones = world.coverage(); if (!zones) return;
    try { const cur = map.getFilter(id); if (cur && JSON.stringify(cur) === ofmFilterSet) return; const f = ['>', ['distance', zones], 0]; map.setFilter(id, f); ofmFilterSet = JSON.stringify(map.getFilter(id)); } catch { /* deze kaart kent het filter niet: dan blijven de OFM-blokken */ }
  }

  // ---------- de laag in MapLibre ----------
  const layer = {
    id: 'scene3d', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      if (renderer) return;
      const t = performance.now(); renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); stats.rendererMs = Math.round(performance.now() - t);
      renderer.autoClear = false; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = licht ? licht.exp : 1.06;
    },
    render(gl, args) {
      if (!on || !renderer) return;
      const t0 = performance.now();
      if (needsOrigin()) setOrigin();
      const matrix = args && args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args && args.modelViewProjectionMatrix ? args.modelViewProjectionMatrix : args;
      G.fromArray(matrix).multiply(L); deriveCamera(); computeView();
      applyLight(false); ofmCheck(); world.update(view); const t1 = performance.now(); placeSun(); atmosphere(); updateVehicles();
      { const el = map.getCanvas(); const near = zoom >= 15.3; signs.update(near ? world.signs() : [], camera, el.clientWidth || 1, el.clientHeight || 1, zoom, 1 - 0.22 * licht.donker, near ? world.signsFree() : []); }
      const t2 = performance.now();
      renderer.resetState(); renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera); const t3 = performance.now();
      stats.phase = { wereld: +(stats.phase ? stats.phase.wereld * 0.9 + (t1 - t0) * 0.1 : t1 - t0).toFixed(1), voertuigen: +(stats.phase ? stats.phase.voertuigen * 0.9 + (t2 - t1) * 0.1 : t2 - t1).toFixed(1), tekenen: +(stats.phase ? stats.phase.tekenen * 0.9 + (t3 - t2) * 0.1 : t3 - t2).toFixed(1) };
      const dt = performance.now() - t0; stats.frames++; stats.renderMs = stats.renderMs * 0.9 + dt * 0.1;
      if (stats.frames === 1) { stats.firstFrameMs = Math.round(performance.now() - stats.enabledAt); stats.firstRenderMs = Math.round(dt); }
    },
  };
  map.addLayer(layer);
  // valt de laag weg (een nieuwe kaartstijl), dan komt hij terug
  const onStyle = () => { if (!map.getLayer('scene3d')) { try { map.addLayer(layer); } catch { /* stijl nog niet klaar */ } } groundColor = null; };
  map.on('styledata', onStyle);
  const onMove = () => { if (on) map.triggerRepaint(); };
  map.on('move', onMove);

  // ---------- klik en aanwijzen: een straal door de scene tegen de omtrek van elk getekend voertuig ----------
  const pv = new THREE.Vector4();
  function pick(pt) {
    if (!on || !O || !pickList.length) return null; const el = map.getCanvas(); const w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    const nx = (pt.x / w) * 2 - 1, ny = -(pt.y / h) * 2 + 1; pv.set(nx, ny, 1, 1).applyMatrix4(invG); const dx0 = pv.x / pv.w - eye.x, dy0 = pv.y / pv.w - eye.y, dz0 = pv.z / pv.w - eye.z; const dl = Math.hypot(dx0, dy0, dz0); const dx = dx0 / dl, dy = dy0 / dl, dz = dz0 / dl;
    let best = null, bt = Infinity;
    for (const p of pickList) {
      // straal in het eigen vlak van het voertuig (draaien om y), met een kleine marge van een paar pixels
      const tol = 5 * p.depth / view.ppm; const hw = p.hw * p.k + tol, hl = p.hl * p.k + tol, hh = p.h * p.k + tol;
      const c = Math.cos(-p.ang), s = Math.sin(-p.ang); const ox = eye.x - p.x, oz = eye.z - p.z;
      const o = [ox * c + oz * s, eye.y, -ox * s + oz * c], d = [dx * c + dz * s, dy, -dx * s + dz * c];
      let t0 = 0, t1 = Infinity; const lo = [-hw, -tol, -hl], hi = [hw, hh, hl]; let ok = true;
      for (let a = 0; a < 3; a++) { if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) { ok = false; break; } continue; } let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; } }
      if (ok && t0 < bt) { bt = t0; best = p; }
    }
    return best ? { id: best.id, trailer: best.trailer } : null;
  }
  let hoverT = 0;
  const onClick = e => { if (!on) return; const hit = pick(e.point); if (hit) { e.preventDefault(); if (hit.trailer) opts.onSelectTrailer && opts.onSelectTrailer(hit.id); else opts.onSelectTruck && opts.onSelectTruck(hit.id); } };
  const onMouse = e => { if (!on) return; const now = Date.now(); if (now - hoverT < 70) return; hoverT = now; const hit = pick(e.point); map.getCanvas().style.cursor = hit ? 'pointer' : ''; const id = hit ? hit.id : null; if (id !== hoverId) { hoverId = id; map.triggerRepaint(); } opts.onHover && opts.onHover(hit && !hit.trailer ? hit.id : null, e.point); };
  map.on('click', onClick); map.on('mousemove', onMouse);

  // ---------- licht uit de klok van de simulatie ----------
  // De kaart kan de klok meegeven (opts.klok of opts.data.klok: een object met simTime in minuten na middernacht,
  // Nederlandse tijd, zoals de staat van de app, en eventueel datum [jaar, maand, dag]); zonder die optie leest de wereld
  // de klok van de app (window.SLCT.state), en anders de echte tijd. De dag is die van de simulatie: vandaag.
  // setClock(minuten, datum?) zet een vaste tijd (tests, schermafbeeldingen); setClock(null) volgt de klok weer.
  const klokBron = () => opts.klok || (opts.data && opts.data.klok) || (typeof window !== 'undefined' && window.SLCT && window.SLCT.state) || null;
  function klokNu() {
    if (vast) return vast;
    const k = klokBron(); let min = k ? +k.simTime : NaN; if (!isFinite(min)) { const d = new Date(); min = d.getHours() * 60 + d.getMinutes(); }
    return { min: ((min % 1440) + 1440) % 1440, datum: k && Array.isArray(k.datum) ? k.datum : vandaag() };
  }
  // Het thema van de interface verandert alleen de kaart en de interface, niet het daglicht. In het donkere thema is het
  // daglicht wel iets gedempt (DIM), zodat de wereld niet als een lamp op een donkere kaart ligt; de nacht blijft gelijk.
  const DIM = 0.82;
  function applyLight(force) {
    const { min, datum } = klokNu(); const key = `${datum.join('-')}|${Math.round(min * 2)}|${theme}`;   // per halve minuut
    if (!force && key === lichtKey) return; lichtKey = key;
    licht = lichtOp(datum, min); licht.min = min; licht.datum = datum; lampK = licht.lampen;
    const dim = theme === 'dark' ? 1 - (1 - DIM) * (1 - licht.donker) : 1;
    sun.color.setHex(licht.zon); sun.intensity = licht.zi * dim;
    hemi.color.setHex(licht.hb); hemi.groundColor.setHex(licht.hg); hemi.intensity = licht.hi * dim;
    const env = licht.zonH > 1 ? sky.dag : licht.zonH > -8 ? sky.schemer : sky.nacht; if (scene.environment !== env) { scene.environment = env; usedEnv.add(env); }
    scene.environmentIntensity = licht.env * dim;
    if (renderer) renderer.toneMappingExposure = licht.exp * (theme === 'dark' ? 1 - 0.06 * (1 - licht.donker) : 1);
    pal.emissiveIntensity = palV.emissiveIntensity = 1.8 * lampK;
    shadowPlane.material.opacity = licht.schaduw; shadowPlane.material.color.copy(SCHADUW).lerp(ZWART, licht.donker);
    world.setLicht(licht);
  }
  // wat het licht nu is (voor de check en de README): staat, zonnestand, lampen, en zonsopgang en -ondergang die dag
  let opOnder = null, opOnderDag = '';
  const hm = m => m == null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const rond = m => m == null ? null : Math.round(m);   // zon op en onder op de hele minuut, zoals in een almanak
  function lichtStats() {
    if (!licht) return null; const dag = licht.datum.join('-'); if (dag !== opOnderDag) { opOnderDag = dag; opOnder = zonOpOnder(licht.datum); }
    return { staat: licht.staat, tijd: hm(licht.min), datum: dag, zonH: +licht.zonH.toFixed(1), zonAz: Math.round(licht.zonAz), lampen: +licht.lampen.toFixed(2), donker: +licht.donker.toFixed(2), zon: +sun.intensity.toFixed(2), op: hm(rond(opOnder.op)), onder: hm(rond(opOnder.onder)), thema: theme };
  }
  function setClock(min, datum) { vast = min == null ? null : { min: ((+min % 1440) + 1440) % 1440, datum: Array.isArray(datum) ? datum : vandaag() }; applyLight(true); if (on) map.triggerRepaint(); }
  // ---------- thema ----------
  function setTheme(t) { theme = t; world.setTheme(t); groundColor = null; applyLight(true); if (on) map.triggerRepaint(); }
  function enable(v) {
    on = !!v;
    if (on) { stats.enabledAt = performance.now(); stats.frames = 0; setOrigin(); }
    else { hoverId = null; map.getCanvas().style.cursor = ''; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    map.triggerRepaint();
  }
  // De kaart roept setVehicles per beeld aan: alleen de lijst bewaren; de instance-matrices worden in render() één keer per
  // beeld bijgewerkt, met de camera van dat beeld (wat buiten beeld valt kost dan niets).
  function setVehicles(list) { vehicles = list || []; if (on) map.triggerRepaint(); }
  function setTrailers(list) { trailers = list || []; if (on) map.triggerRepaint(); }
  function setSelected(id) { selId = id || null; if (on) map.triggerRepaint(); }
  function dispose() {
    on = false; map.off('styledata', onStyle); map.off('move', onMove); map.off('click', onClick); map.off('mousemove', onMouse);
    if (map.getLayer('scene3d')) map.removeLayer('scene3d');
    world.dispose(); signs.dispose(); scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material && o.material !== pal) o.material.dispose(); } });
    pal.dispose(); palV.dispose(); disposePalette(); for (const t of Object.values(sky)) t.dispose(); if (sun.shadow.map) sun.shadow.map.dispose();
  }
  // geometrieën en texturen die deze wereld zelf bezit: meer op de GPU dan dit zou een lek zijn (een lucht die als
  // omgeving gebruikt is, telt twee keer: de textuur en de voorgefilterde versie die three.js ervan maakt)
  function owned() { const g = new Set(), t = new Set(); scene.traverse(o => { if (o.geometry) g.add(o.geometry); const m = o.material; if (m) { for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap']) if (m[k]) t.add(m[k]); if (m.uniforms && m.uniforms.uMap) t.add(m.uniforms.uMap.value); } }); return { geometries: g.size, textures: t.size + usedEnv.size * 2 }; }
  setTheme(theme); stats.createMs = Math.round(performance.now() - T0);
  return {
    enable, isOn: () => on, setVehicles, setTrailers, setTheme, setClock, pick, refresh: () => { if (on) { setOrigin(); map.triggerRepaint(); } }, setSelected, dispose,
    ready: () => world.loading, stats: () => ({ ...stats, ...world.stats(), licht: lichtStats(), borden: signs.mesh.count, drawn: pickList.length, shadows: shadowsOn, view: { ppm: +view.ppm.toFixed(1), camDist: Math.round(view.camDist), R: Math.round(view.R), mpp: +view.mpp.toFixed(2), k: +scaleMove().toFixed(2) }, zoom: +zoom.toFixed(2), owned: owned(), info: renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs ? renderer.info.programs.length : 0 } : null }),
  };
}
