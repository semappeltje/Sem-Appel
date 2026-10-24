import * as THREE from 'three';
import { DIV, SP, TOWNS } from './places.js';
import { nearestNode, shortestPath, buildPath, posAt, nodes } from './roads.js';

let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; const pickR = a => a[Math.floor(rnd() * a.length)];
const FIRST = ['Kees', 'Jan', 'Piet', 'Henk', 'Robert', 'Marco', 'Dennis', 'Jeroen', 'Sandra', 'Linda', 'Mohammed', 'Ahmed', 'Daan', 'Bram', 'Sven', 'Thijs', 'Ruud', 'Gerrit', 'Wesley', 'Marieke', 'Anouk', 'Jolanda', 'Patrick', 'Nick', 'Erik', 'Rick', 'Ilse', 'Fatima', 'Jos', 'Ton'];
const LAST = ['de Vries', 'Bakker', 'Jansen', 'Visser', 'Smit', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker', 'Brouwer', 'Koning', 'Vermeulen', 'Schouten', 'Groot', 'Appelman', 'Vlaar', 'Koster', 'van Dijk', 'Meijer', 'de Jong', 'Willems'];
const MODELS = [['Mercedes-Benz eActros 600', true], ['DAF XF 480', false], ['Scania R 450', false], ['Volvo FH 460', false], ['Mercedes-Benz Actros 1845', false], ['DAF XD 450', false], ['Mercedes-Benz eActros 300', true], ['Volvo FH Electric', true]];
const LADING = { winkel: ['Gekoelde zuivel en vlees, 26 rolcontainers', 'Droge kruidenierswaren, 33 pallets', 'Diepvries, 24 pallets (-20 °C)', 'AGF, 30 rolcontainers', 'Brood en banket, 28 rolcontainers'], netwerk: ['Groupage, 18 pallets voor 4 adressen', 'FTL, 33 pallets gekoeld', 'Crossdock Tiel, 26 pallets', 'Dubbeldeks, 52 pallets'], bulk: ['Bulkpoeder, 26 ton', 'Granulaat, 24 ton', 'Suiker (bulk), 27 ton'], dranken: ['Bier en fris, 26 pallets', 'Lege emballage retour', 'Fustbier, 24 pallets'], bezorg: ['Boodschappen, 48 bestellingen', 'Boodschappen, 36 bestellingen'] };
const plate = van => { const L = 'BDFGHJKLNPRSTVXZ'; const l = () => L[Math.floor(rnd() * L.length)]; const d = () => Math.floor(rnd() * 10); return van ? `V-${d()}${d()}${d()}-${l()}${l()}` : `${d()}${d()}-${l()}${l()}${l()}-${d()}`; };

for (const s of SP) s.node = nearestNode(s.x, s.y);
for (const t of TOWNS) t.node = nearestNode(t.x, t.y);
const FAR = { netwerk: ['Groningen', 'Maastricht', 'Enschede', 'Leeuwarden', 'Rotterdam', 'Eindhoven', 'Venlo', 'Emmen'], bulk: ['Bergen op Zoom', 'Venlo', 'Hengelo', 'Maastricht', 'Emmen', 'Winschoten'], dranken: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Zwolle', 'Groningen', 'Arnhem', 'Den Haag'], bezorg: ['Hoorn', 'Alkmaar', 'Purmerend', 'Amsterdam', 'Zaandam', 'Den Helder'] };
const town = n => TOWNS.find(t => t.n === n);

export function makeRoute(base, div) {
  let stops;
  if (div === 'winkel') { const c = TOWNS.filter(t => t.node !== base.node).map(t => [t, Math.hypot(t.x - base.x, t.y - base.y)]).filter(([, d]) => d < 110).sort((a, b) => a[1] - b[1]).slice(0, 10).map(x => x[0]); stops = [pickR(c), pickR(c)]; }
  else { stops = [town(pickR(FAR[div]))]; if (div === 'netwerk' && rnd() < 0.5) stops.push(SP.find(s => s.n === pickR(['Tiel', 'Geldermalsen', 'Wognum']))); }
  const seq = [base, ...stops.filter((s, i, a) => s && a.indexOf(s) === i && s.node !== base.node), base];
  const ids = []; const marks = [];
  for (let i = 0; i < seq.length - 1; i++) { const p = shortestPath(seq[i].node, seq[i + 1].node); if (i > 0) p.shift(); marks.push({ place: seq[i], at: ids.length }); ids.push(...p); }
  marks.push({ place: base, at: ids.length - 1 });
  const path = buildPath(ids);
  return { seq, path, marks: marks.map(m => ({ place: m.place, km: path.cum[Math.min(m.at, path.cum.length - 1)] })), total: path.total };
}

// ---------- truckmodel ----------
const cabGeo = new THREE.BoxGeometry(2.4, 2.6, 2.3), cabTopGeo = new THREE.BoxGeometry(2.3, 0.9, 1.2), winGeo = new THREE.BoxGeometry(2.2, 1.0, 0.2), trlGeo = new THREE.BoxGeometry(2.5, 3.0, 7.4), stripeGeo = new THREE.BoxGeometry(2.56, 0.55, 7.45), wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10), vanGeo = new THREE.BoxGeometry(1.9, 1.9, 3.8), roofGeo = new THREE.BoxGeometry(2.0, 0.22, 1.6), lampGeo = new THREE.SphereGeometry(0.22, 8, 6);
const matRed = new THREE.MeshStandardMaterial({ color: 0xE3001F, roughness: 0.45, metalness: 0.15 }), matWhite = new THREE.MeshStandardMaterial({ color: 0xDCDCDC, roughness: 0.55 }), matDark = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.8 }), matGlass = new THREE.MeshStandardMaterial({ color: 0x8FB7D8, roughness: 0.2, metalness: 0.4 }), matEv = new THREE.MeshStandardMaterial({ color: 0x39C27C, emissive: 0x39C27C, emissiveIntensity: 0.9, toneMapped: false });
const matHead = new THREE.MeshBasicMaterial({ toneMapped: false }); matHead.color.setRGB(2.5, 2.4, 2.0, THREE.LinearSRGBColorSpace); const matTail = new THREE.MeshBasicMaterial({ toneMapped: false }); matTail.color.setRGB(2.2, 0.2, 0.2, THREE.LinearSRGBColorSpace);
function truckMesh(div, ev, van) {
  const g = new THREE.Group(); const stripeMat = new THREE.MeshStandardMaterial({ color: DIV[div].hex, roughness: 0.5 }); const wheels = [];
  const wheel = (x, z) => { const w = new THREE.Mesh(wheelGeo, matDark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w); wheels.push(w); };
  if (van) { const body = new THREE.Mesh(vanGeo, matRed); body.position.y = 1.5; body.castShadow = true; g.add(body); const w = new THREE.Mesh(winGeo, matGlass); w.position.set(0, 1.9, 1.85); g.add(w); wheel(-0.95, 1.2); wheel(0.95, 1.2); wheel(-0.95, -1.2); wheel(0.95, -1.2); const s = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.3, 3.85), stripeMat); s.position.y = 1.2; g.add(s); }
  else {
    const cab = new THREE.Mesh(cabGeo, matRed); cab.position.set(0, 1.85, 3.9); cab.castShadow = true; g.add(cab);
    const top = new THREE.Mesh(cabTopGeo, matRed); top.position.set(0, 3.6, 3.4); g.add(top);
    const win = new THREE.Mesh(winGeo, matGlass); win.position.set(0, 2.4, 5.0); g.add(win);
    const trl = new THREE.Mesh(trlGeo, matWhite); trl.position.set(0, 2.05, -1.2); trl.castShadow = true; g.add(trl);
    const st = new THREE.Mesh(stripeGeo, stripeMat); st.position.set(0, 2.75, -1.2); g.add(st);
    wheel(-1.25, 4.2); wheel(1.25, 4.2); wheel(-1.25, 2.6); wheel(1.25, 2.6); wheel(-1.25, -3.4); wheel(1.25, -3.4); wheel(-1.25, -4.4); wheel(1.25, -4.4);
    const tl = new THREE.Mesh(lampGeo, matTail); tl.position.set(-0.9, 1.0, -4.95); g.add(tl); const tr = tl.clone(); tr.position.x = 0.9; g.add(tr); g.userData.tails = [tl, tr];
  }
  const hl = new THREE.Mesh(lampGeo, matHead); hl.position.set(-0.8, 1.1, van ? 1.95 : 5.1); g.add(hl); const hr = hl.clone(); hr.position.x = 0.8; g.add(hr); g.userData.heads = [hl, hr];
  if (ev) { const r = new THREE.Mesh(roofGeo, matEv); r.position.set(0, van ? 2.55 : 3.3, van ? 0 : 4.0); g.add(r); }
  g.userData.wheels = wheels; return g;
}

export function createFleet(scene) {
  const trucks = []; const trailGroup = new THREE.Group(); scene.add(trailGroup); const truckGroup = new THREE.Group(); scene.add(truckGroup); const fxGroup = new THREE.Group(); scene.add(fxGroup);
  const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32); ringGeo.rotateX(-Math.PI / 2);
  let tid = 0;
  for (const s of SP) for (let i = 0; i < s.trucks; i++) {
    const div = s.div[i % s.div.length], van = div === 'bezorg'; const [model, ev] = van ? ['Volkswagen e-Crafter', true] : pickR(MODELS);
    const route = makeRoute(s, div);
    const t = { id: 't' + (++tid), base: s, div, van, model, ev, kenteken: plate(van), driver: { name: pickR(FIRST) + ' ' + pickR(LAST), since: 2008 + Math.floor(rnd() * 17), code95: 2027 + Math.floor(rnd() * 4) }, lading: pickR(LADING[div]), route, km: rnd() * route.total, speed: van ? 55 : div === 'bulk' ? 78 : 82, dwell: 0, dwellLabel: '', driveMin: rnd() * 220, kmToday: 0, fuel: ev ? 40 + rnd() * 55 : 350 + rnd() * 700, cap: ev ? (van ? 80 : 600) : 1200, stopsDone: Math.floor(rnd() * 3), onTime: 1, state: 'onderweg', hist: [], delay: 0 };
    t.kmToday = t.driveMin / 60 * t.speed * 0.85;
    const g = truckMesh(div, ev, van); g.userData = { ...g.userData, type: 'truck', ref: t }; t.mesh = g; truckGroup.add(g);
    const N = 22; const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3)); const cols = new Float32Array(N * 3); const c = new THREE.Color(DIV[div].hex); for (let k = 0; k < N; k++) { const f = k / (N - 1); cols[k * 3] = c.r * f; cols[k * 3 + 1] = c.g * f; cols[k * 3 + 2] = c.b * f; } tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 })); trail.frustumCulled = false; trailGroup.add(trail); t.trail = trail; t.trailN = N;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: DIV[div].hex, transparent: true, opacity: 0, depthWrite: false })); ring.position.y = 0.4; fxGroup.add(ring); t.ring = ring; t.ringT = 0;
    trucks.push(t);
  }
  const stats = { deliveries: 0, kmToday: 0, liters: 0, kwh: 0, stops: 0, onTime: 0 };
  const events = [];
  const fmt = n => new Intl.NumberFormat('nl-NL').format(Math.round(n));
  function placeName(p) { return p.n; }
  function step(dtMin, simTime) {
    for (const t of trucks) {
      if (t.ringT > 0) { t.ringT -= dtMin / 8; const k = Math.max(0, t.ringT); t.ring.scale.setScalar(1 + (1 - k) * 4); t.ring.material.opacity = k * 0.9; }
      if (t.dwell > 0) { t.dwell -= dtMin; if (t.dwell <= 0) { if (t.state === 'laden accu') t.fuel = Math.min(100, t.fuel + 40); t.state = 'onderweg'; } continue; }
      if (t.driveMin >= 270) { t.state = 'pauze'; t.dwell = 45; t.driveMin = 0; events.push({ time: simTime, text: `<b>${t.kenteken}</b> ${t.driver.name}: verplichte pauze van 45 minuten` }); continue; }
      const km = t.speed / 60 * dtMin; const before = t.km; t.km += km; t.driveMin += dtMin; t.kmToday += km; stats.kmToday += km;
      if (t.ev) { const kwh = km * (t.van ? 0.3 : 1.15); t.fuel = Math.max(0, t.fuel - kwh / t.cap * 100); stats.kwh += kwh; } else { const l = km * 0.29; t.fuel = Math.max(0, t.fuel - l); stats.liters += l; }
      for (const m of t.route.marks) if (m.km > before && m.km <= t.km && m.km > 0) {
        const atBase = m.place === t.base; t.dwell = 12 + rnd() * 25; t.state = atBase ? 'laden' : 'lossen'; t.ring.position.x = t.mesh.position.x; t.ring.position.z = t.mesh.position.z; t.ringT = 1;
        if (!atBase) { t.stopsDone++; stats.deliveries++; stats.stops++; const late = rnd() < 0.04; if (!late) stats.onTime++; events.push({ time: simTime, text: `<b>${t.kenteken}</b> ${t.driver.name} ${late ? 'lost met vertraging' : 'lost op tijd'} bij ${placeName(m.place)} (${DIV[t.div].n})` }); }
        else if (t.ev && t.fuel < 55) { t.state = 'laden accu'; t.dwell = 35; events.push({ time: simTime, text: `<b>${t.kenteken}</b> laadt op bij ${t.base.n} (${Math.round(t.fuel)} %)` }); }
      }
      if (t.km >= t.route.total) { t.km = 0; t.route = makeRoute(t.base, t.div); t.stopsDone = 0; if (!t.ev) t.fuel = Math.min(t.cap, t.fuel + 250); t.lading = pickR(LADING[t.div]); }
      const p = posAt(t.route.path, t.km); t.mesh.position.set(p.x, 0, -p.y); t.mesh.rotation.y = Math.atan2(p.hx, -p.hy);
      for (const w of t.mesh.userData.wheels) w.rotation.x -= km * 2;
      t.hist.push(p.x, 0.5, -p.y); if (t.hist.length > t.trailN * 3) t.hist.splice(0, 3);
      const arr = t.trail.geometry.attributes.position.array; const n = t.hist.length / 3; const off = t.trailN - n; for (let k = 0; k < t.trailN; k++) { const src = Math.max(0, k - off) * 3; arr[k * 3] = t.hist[src]; arr[k * 3 + 1] = 0.5; arr[k * 3 + 2] = t.hist[src + 2]; } t.trail.geometry.attributes.position.needsUpdate = true;
    }
    if (events.length > 40) events.splice(0, events.length - 40);
  }
  for (let i = 0; i < 30; i++) step(0.6, Date.now());
  events.length = 0;
  function setNight(night) { const on = night > 0.4; for (const t of trucks) { for (const h of t.mesh.userData.heads) h.visible = on; if (t.mesh.userData.tails) for (const h of t.mesh.userData.tails) h.visible = on; } }
  return { trucks, stats, events, step, setNight, truckGroup, trailGroup, fxGroup, fmt };
}
