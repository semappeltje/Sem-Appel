// Naamborden van de afdelingen (sp.afdelingen): rustige witte bordjes met de naam in kleine kapitalen, zoals de
// docknummers, op het dak van het gebouw of boven het gebied. Ze houden een vaste maat op het scherm, verschijnen vanaf
// zoom 15,5 en wijken voor elkaar: raken twee borden elkaar, dan blijft het belangrijkste staan (kantoor voor hal voor
// garage en wasstraat voor docks, laadplein, opleggers en poort). Ze staan altijd vooraan, zoals de namen op de kaart.
// Eén tekening voor alle borden: een atlas met de namen (een canvas) en een instanced vlak dat in de shader naar het
// scherm draait. Geen letters van buiten: de systeemletter, zoals de docknummers.
import * as THREE from 'three';

const AW = 1024, AH = 512, RH = 40, PX = 13, SPACING = 1.4;   // atlas (2 x de schermmaat), rijhoogte, marge, letterafstand
const VS = `
attribute vec3 aPos; attribute vec4 aUv; attribute vec2 aSize; attribute float aAlpha;
uniform vec2 uView; varying vec2 vUv; varying float vAlpha;
void main() {
  vec4 c = projectionMatrix * modelViewMatrix * vec4(aPos, 1.0);
  vec2 q = position.xy + vec2(0.0, 0.5);
  c.xy += q * aSize * 2.0 / uView * c.w;
  gl_Position = c; vUv = mix(aUv.xy, aUv.zw, position.xy + 0.5); vAlpha = aAlpha;
}`;
const FS = `
uniform sampler2D uMap; uniform float uDim; varying vec2 vUv; varying float vAlpha;
void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(t.rgb * uDim, a);
  #include <colorspace_fragment>
}`;

export function createSigns(max = 192) {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  const geo = new THREE.PlaneGeometry(1, 1);
  const attr = (name, n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  const A = { pos: attr('aPos', 3), uv: attr('aUv', 4), size: attr('aSize', 2), alpha: attr('aAlpha', 1) };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uMap: { value: tex }, uView: { value: new THREE.Vector2(1, 1) }, uDim: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;

  // een naam in de atlas: een wit bordje met een dunne rand en de naam in hoofdletters met wat lucht ertussen
  const slots = new Map(); let cx = 0, cy = 0;
  function slot(text) {
    let s = slots.get(text); if (s !== undefined) return s;
    const label = text.toUpperCase(); g.font = '600 21px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    let tw = 0; for (const ch of label) tw += g.measureText(ch).width + SPACING; tw -= SPACING;
    const w = Math.ceil(Math.min(AW - 4, tw + PX * 2));
    if (cx + w + 4 > AW) { cx = 0; cy += RH + 4; }
    if (cy + RH > AH) { slots.set(text, null); return null; }   // atlas vol: dan geen bord
    const x0 = cx + 2, y0 = cy + 2, h = RH - 4, r = 7;
    g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath();
    g.fillStyle = 'rgba(247,248,249,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(31,35,41,0.28)'; g.stroke();
    g.fillStyle = '#1F2329'; g.textBaseline = 'middle'; let x = x0 + PX; for (const ch of label) { g.fillText(ch, x, y0 + h / 2 + 1); x += g.measureText(ch).width + SPACING; }
    s = { u0: x0 / AW, v0: 1 - (y0 + h) / AH, u1: (x0 + w) / AW, v1: 1 - y0 / AH, w: w / 2, h: h / 2 };   // w, h: maat op het scherm (CSS-pixels)
    slots.set(text, s); cx += w + 4; tex.needsUpdate = true; return s;
  }

  // per beeld: de borden in beeld op het scherm zetten, de belangrijkste eerst, en wat een ander raakt weglaten. Een bord
  // dat over de rand van het beeld zou vallen, komt niet; de namen van de kaart zelf (vrij: [x, y, z, links, rechts,
  // boven, onder] in pixels rond hun punt) houden hun plek, want die tekent de kaart over de wereld heen.
  const V = new THREE.Vector4(), placed = [];
  const scr = (x, y, z, camera, vw, vh) => { V.set(x, y, z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); return V.w > 0 ? [(V.x / V.w * 0.5 + 0.5) * vw, (0.5 - V.y / V.w * 0.5) * vh, V.w] : null; };
  function update(list, camera, vw, vh, zoom, dim, vrij = []) {
    const fade = Math.min(1, Math.max(0, (zoom - 15.3) / 0.4));
    if (!list.length || fade <= 0) { mesh.count = 0; mesh.visible = false; return; }
    placed.length = 0;
    for (const [x, y, z, l, r, u, d] of vrij) { const p = scr(x, y, z, camera, vw, vh); if (p) placed.push([p[0] - l, p[1] - u, p[0] + r, p[1] + d]); }
    const cand = [];
    for (const b of list) {
      const s = slot(b.naam); if (!s) continue;
      const p = scr(b.x, b.y, b.z, camera, vw, vh); if (!p) continue; const [sx, sy] = p;
      if (sx - s.w / 2 < 4 || sx + s.w / 2 > vw - 4 || sy - s.h < 4 || sy > vh - 4) continue;
      cand.push({ b, s, sx, sy, d: p[2] });
    }
    cand.sort((p, q) => (p.b.prio - q.b.prio) || (p.d - q.d)); let n = 0;
    for (const c of cand) {
      if (n >= max) break; const x0 = c.sx - c.s.w / 2 - 3, x1 = c.sx + c.s.w / 2 + 3, y0 = c.sy - c.s.h - 3, y1 = c.sy + 3;
      if (placed.some(p => x0 < p[2] && x1 > p[0] && y0 < p[3] && y1 > p[1])) continue; placed.push([x0, y0, x1, y1]);
      A.pos.array.set([c.b.x, c.b.y, c.b.z], n * 3); A.uv.array.set([c.s.u0, c.s.v0, c.s.u1, c.s.v1], n * 4); A.size.array.set([c.s.w, c.s.h], n * 2); A.alpha.array[n] = fade; n++;
    }
    mesh.count = n; mesh.visible = n > 0; if (!n) return;
    for (const a of Object.values(A)) a.needsUpdate = true;
    mat.uniforms.uView.value.set(vw, vh); mat.uniforms.uDim.value = dim;
  }
  function dispose() { geo.dispose(); mat.dispose(); tex.dispose(); }
  return { mesh, update, dispose, texture: tex };
}
