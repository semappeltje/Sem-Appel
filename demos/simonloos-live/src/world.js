import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import land from './data/land.json';
import provinces from './data/provinces.json';
import { toXY } from './geo.js';
import { roads } from './roads.js';
import { DIV, SP, TOWNS } from './places.js';

const NIGHT_BG = new THREE.Color(0x05080F), DAY_BG = new THREE.Color(0x16233F);

export function createWorld(stage, labelsEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = DAY_BG.clone(); scene.fog = new THREE.Fog(DAY_BG.clone(), 650, 1600);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000); camera.position.set(0, 330, 350);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 30; controls.maxDistance = 950; controls.maxPolarAngle = 1.4; controls.target.set(0, 0, 20);
  const labelRenderer = new CSS2DRenderer({ element: labelsEl });

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x1a1f2e, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.4); sun.position.set(-220, 360, 180); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -340, right: 340, top: 340, bottom: -340, near: 50, far: 1200 }); sun.shadow.bias = -0.0008; scene.add(sun);

  // water met zachte spiegeling
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ color: 0x0B1733, roughness: 0.55, metalness: 0.35 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.3; water.receiveShadow = true; scene.add(water);

  // land (uitgesneden kust en IJsselmeer) en buurlanden
  const shapeFrom = poly => { const sh = new THREE.Shape(); poly[0].forEach(([lon, lat], i) => { const p = toXY(lon, lat); i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y); }); for (const h of poly.slice(1)) { const pa = new THREE.Path(); h.forEach(([lon, lat], i) => { const p = toXY(lon, lat); i ? pa.lineTo(p.x, p.y) : pa.moveTo(p.x, p.y); }); sh.holes.push(pa); } return sh; };
  const landTop = new THREE.MeshStandardMaterial({ color: 0xD9D3C2, roughness: 0.95 }), landSide = new THREE.MeshStandardMaterial({ color: 0xB9B19C, roughness: 1 });
  for (const poly of land.nl) { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: 2.6, bevelEnabled: false }), [landTop, landSide]); m.rotation.x = -Math.PI / 2; m.position.y = -2.6; m.receiveShadow = true; scene.add(m); }
  const ctxMat = new THREE.MeshStandardMaterial({ color: 0x1B2236, roughness: 1 });
  for (const poly of land.ctx) { const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(poly)), ctxMat); m.rotation.x = -Math.PI / 2; m.position.y = -0.9; scene.add(m); }

  // provinciegrenzen
  const pv = [];
  for (const p of provinces) for (const ring of p.rings) for (let i = 0; i < ring.length - 1; i++) { const a = toXY(ring[i][0], ring[i][1]), b = toXY(ring[i + 1][0], ring[i + 1][1]); pv.push(a.x, 0.12, -a.y, b.x, 0.12, -b.y); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
  scene.add(new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0x8C8574, transparent: true, opacity: 0.35 })));

  // wegen als linten (echte ligging, Natural Earth)
  const roadGroup = new THREE.Group(); scene.add(roadGroup);
  const ribbonGeo = (pts, w, y) => { const pos = [], idx = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)]; let dx = q.x - r.x, dy = q.y - r.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const nx = -dy * w / 2, ny = dx * w / 2; pos.push(p.x + nx, y, -(p.y + ny), p.x - nx, y, -(p.y - ny)); if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; };
  const byType = [[], [], []], glow = [], dark = [];
  for (const r of roads) { if (r.pts.length < 2) continue; const w = r.t === 0 ? 1.25 : r.t === 1 ? 0.85 : 0.55; byType[r.t].push(ribbonGeo(r.pts, w, 0.32)); dark.push(ribbonGeo(r.pts, w + 0.6, 0.27)); if (r.t === 0) glow.push(ribbonGeo(r.pts, 3.6, 0.22)); }
  const emis = (r, g, b) => { const m = new THREE.MeshBasicMaterial({ toneMapped: false }); m.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace); return m; };
  roadGroup.add(new THREE.Mesh(mergeGeometries(dark), new THREE.MeshBasicMaterial({ color: 0x2A2410, transparent: true, opacity: 0.6, depthWrite: false })));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xFCC41F, transparent: true, opacity: 0.05, depthWrite: false });
  roadGroup.add(new THREE.Mesh(mergeGeometries(glow), glowMat));
  const motor = new THREE.Mesh(mergeGeometries(byType[0]), emis(1.35, 1.0, 0.16)); roadGroup.add(motor);
  if (byType[1].length) roadGroup.add(new THREE.Mesh(mergeGeometries(byType[1]), emis(0.95, 0.72, 0.16)));
  if (byType[2].length) roadGroup.add(new THREE.Mesh(mergeGeometries(byType[2]), new THREE.MeshBasicMaterial({ color: 0xE8DFC4, transparent: true, opacity: 0.75, depthWrite: false })));

  // standplaatsen en klanten
  const pinGroup = new THREE.Group(); scene.add(pinGroup); const pickables = [];
  const sphGeo = new THREE.SphereGeometry(1.7, 16, 12), whGeo = new THREE.BoxGeometry(5, 2.4, 3.8), klGeo = new THREE.BoxGeometry(3.4, 1.8, 3.4), poleGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 6);
  const klMat = new THREE.MeshStandardMaterial({ color: 0xF2F2F2, roughness: 0.5 }), whMat = new THREE.MeshStandardMaterial({ color: 0xE3001F, roughness: 0.6 }), poleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of SP) {
    const g = new THREE.Group(); g.position.set(s.x, 0, -s.y); const col = DIV[s.div[0]].hex; const H = s.hub ? 15 : 9.5;
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.scale.y = H; pole.position.y = H / 2; g.add(pole);
    const headMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.55 });
    const head = new THREE.Mesh(sphGeo, headMat); head.position.y = H; head.scale.setScalar(s.hub ? 1.7 : 1); head.castShadow = true; g.add(head);
    if (s.wh) { const b = new THREE.Mesh(whGeo, whMat); b.position.set(-4.2, 1.2, 2.2); b.castShadow = true; g.add(b); }
    if (s.isKlant) { const b = new THREE.Mesh(klGeo, klMat); b.position.set(4.2, 0.9, -2.6); b.castShadow = true; g.add(b); s.klantMesh = b; }
    const lbl = document.createElement('div'); lbl.className = 'lbl' + (s.hub ? ' hub' : ''); lbl.textContent = s.n; const lo = new CSS2DObject(lbl); lo.position.set(0, H + 1, 0); g.add(lo); s.label = lo;
    if (s.isKlant) { const kl = document.createElement('div'); kl.className = 'lbl k'; kl.textContent = s.klant; const ko = new CSS2DObject(kl); ko.position.set(4.2, 0, -2.6); g.add(ko); s.klabel = ko; }
    g.userData = { type: 'sp', ref: s }; s.mesh = g; pinGroup.add(g); pickables.push(g);
  }
  // steden: label + nachtlicht
  const cityGroup = new THREE.Group(); scene.add(cityGroup); const lightPos = [];
  for (const t of TOWNS) { if (t.big) { const d = document.createElement('div'); d.className = 'lbl city'; d.textContent = t.n; const o = new CSS2DObject(d); o.position.set(t.x, 0.5, -t.y); cityGroup.add(o); t.label = o; } for (let i = 0; i < (t.big ? 7 : 3); i++) lightPos.push(t.x + (Math.random() - 0.5) * 4, 0.5, -t.y + (Math.random() - 0.5) * 4); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
  const lightMat = new THREE.PointsMaterial({ color: 0xFFD27A, size: 2.2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  scene.add(new THREE.Points(lg, lightMat));

  // nabewerking: gloed
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.3, 1.0); composer.addPass(bloom); composer.addPass(new OutputPass());
  let fx = !(window.matchMedia('(max-width: 760px)').matches);

  function setDaylight(hour) {
    const d = hour >= 6 && hour <= 18 ? Math.sin((hour - 6) / 12 * Math.PI) : 0; const night = 1 - d;
    sun.intensity = 0.35 + 1.4 * d; hemi.intensity = 0.35 + 0.55 * d; sun.color.setHSL(0.09, 0.6, 0.6 + 0.3 * d);
    const az = (hour - 6) / 12 * Math.PI; sun.position.set(-Math.cos(az) * 300, 90 + 320 * d, 180);
    scene.background.copy(NIGHT_BG).lerp(DAY_BG, d); scene.fog.color.copy(scene.background);
    lightMat.opacity = Math.min(1, Math.max(0, (night - 0.35) / 0.65)) * 0.95; glowMat.opacity = 0.04 + 0.05 * night; bloom.strength = fx ? 0.22 + 0.2 * night : 0;
    return { d, night };
  }
  function setFx(on) { fx = on; renderer.shadowMap.enabled = on; bloom.strength = on ? 0.3 : 0; }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); labelRenderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function render() { if (fx) composer.render(); else renderer.render(scene, camera); labelRenderer.render(scene, camera); }
  window.addEventListener('resize', resize); resize();
  return { renderer, scene, camera, controls, labelRenderer, pickables, roadGroup, pinGroup, cityGroup, setDaylight, setFx, resize, render, get fx() { return fx; } };
}
