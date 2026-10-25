// Beelden van voertuigen en opleggers, uit src/portretten.js: foto's van Sems schaalmodellen in de echte huisstijl
// (fotosVan, fotosVanOplegger; 960 x 640, met een echte achtergrond) en anders een render van onze eigen 3D-modellen
// (portretVan, portretVanOplegger; 640 x 400, doorzichtig). Een foto gaat voor een render. De module wordt pas geladen als
// er een beeld nodig is (dynamisch: in de sitebuild een eigen bestand, niet in app.js). Is hij er niet, dan toont de
// interface geen beeld en houdt hij er ook geen plek voor vrij.
//
// Een trekker met een oplegger erachter krijgt de render met oplegger. Het kenteken op een beeld is altijd fictief; het
// echte kenteken staat ernaast als plaat.
//
// In de HTML: portretHtml('voertuig', t, 'pg-foto', oplegger) geeft een lege <figure data-portret="voertuig:T-1002:O-5150">;
// daarna vult vulPortretten(element, ctx) elk zo'n figuur, of haalt hem weg als er geen beeld komt. In de kop van een
// pagina (pg-foto) staan onder het beeld de bron ("Foto: schaalmodel" of "Beeld: 3D-model") en, bij twee foto's,
// miniaturen om te wisselen (van voren, van opzij).
import { esc } from './base.js';

// import.meta.glob geeft een lege lijst als het bestand (nog) niet bestaat: dan bouwt de app gewoon, zonder beelden
const MODS = import.meta.glob('../portretten.js');
const laadModule = MODS['../portretten.js'] || null;
export const heeftPortretten = !!laadModule;

let modP = null;
const module = () => modP || (modP = laadModule ? laadModule().then(m => (m && (m.portretVan || m.fotosVan) ? m : (m && m.default) || m)).catch(() => null) : Promise.resolve(null));
const cache = new Map();
const ZICHT = { voor: 'Van voren', zij: 'Van opzij' };

// wat de module ook teruggeeft (een data-URL, of een object met src en alt): { src, alt, w, h, foto, zicht, bron }
function normaal(r, altStandaard, foto) {
  if (!r) return null;
  if (typeof r === 'string') return /^(data:|blob:|https?:|\.{0,2}\/)/.test(r) ? { src: r, alt: altStandaard, w: foto ? 960 : 640, h: foto ? 640 : 400, foto } : null;
  const src = r.src || r.url || r.dataUrl || r.dataURL || null;
  return typeof src === 'string' && src ? { src, alt: r.alt || altStandaard, w: r.w || (foto ? 960 : 640), h: r.h || (foto ? 640 : 400), foto, zicht: r.zicht || '', bron: r.bron || '' } : null;
}

// alle beelden voor een voertuig of oplegger: de foto's (voorkant eerst) als die er zijn, anders de render; [] als er niets is
export function beelden(soort, obj, { alt = '', opl = null } = {}) {
  if (!laadModule || !obj) return Promise.resolve([]);
  const key = `${soort}:${obj.id}:${opl ? opl.type || 'met' : ''}`; if (cache.has(key)) return cache.get(key);
  const p = module().then(async m => {
    if (!m) return [];
    const fotos = soort === 'oplegger' ? (typeof m.fotosVanOplegger === 'function' ? m.fotosVanOplegger(obj) : []) : (typeof m.fotosVan === 'function' ? m.fotosVan(obj) : []);
    const F = (await Promise.resolve(fotos || [])).map(f => normaal(f, alt, true)).filter(Boolean);
    if (F.length) return F;
    const r = soort === 'oplegger' ? (typeof m.portretVanOplegger === 'function' ? m.portretVanOplegger(obj) : null) : (typeof m.portretVan === 'function' ? m.portretVan(obj, opl || false) : null);
    const R = normaal(await Promise.resolve(r), alt, false); return R ? [R] : [];
  }).catch(() => []);
  cache.set(key, p); return p;
}
// het eerste beeld (een kaartje heeft er een)
export const portret = (soort, obj, opts) => beelden(soort, obj, opts).then(L => L[0] || null);

// een lege plek voor een beeld, alleen als de module er is (anders niets: geen leeg vak in beeld); opl: de oplegger achter
// een trekker (de render met oplegger)
export const portretHtml = (soort, obj, cls = 'pg-foto', opl = null) => {
  if (!heeftPortretten || !obj) return '';
  const data = esc(`${soort}:${obj.id}:${opl && opl.id ? opl.id : ''}`);
  if (cls !== 'pg-foto') return `<figure class="${cls} laadt" data-portret="${data}"><img alt="" width="640" height="400" decoding="async"></figure>`;
  return `<figure class="pg-foto laadt" data-portret="${data}"><div class="pf-b"><img alt="" width="640" height="400" decoding="async"></div><figcaption class="pf-o"><span class="pf-bron"></span><span class="pf-w" role="group" aria-label="Kies het beeld"></span></figcaption></figure>`;
};

// het grote beeld zetten (en de bron eronder)
function toon(fig, b) {
  const img = fig.querySelector('.pf-b img') || fig.querySelector('img'); if (!img) return;
  fig.classList.toggle('is-foto', !!b.foto); fig.classList.toggle('is-render', !b.foto);
  img.alt = b.alt || ''; img.width = b.w; img.height = b.h;
  img.onload = () => fig.classList.remove('laadt'); img.onerror = () => fig.remove();
  if (img.getAttribute('src') !== b.src) img.src = b.src; else fig.classList.remove('laadt');
  const bron = fig.querySelector('.pf-bron');
  if (bron) { bron.textContent = b.foto ? 'Foto: schaalmodel' : 'Beeld: 3D-model'; bron.title = b.foto ? (b.bron || 'Foto van een schaalmodel') : 'Render van ons eigen 3D-model, geen foto'; }
}

// vul alle lege plekken in el; zonder beeld verdwijnt de plek
export function vulPortretten(el, ctx) {
  if (!heeftPortretten || !el) return;
  for (const fig of el.querySelectorAll('figure[data-portret]:not([data-gevuld])')) {
    fig.dataset.gevuld = '1'; const [soort, id, oplId] = fig.dataset.portret.split(':');
    const obj = soort === 'oplegger' ? ctx.fleet.trailerById.get(id) : ctx.fleet.byId.get(id);
    const opl = oplId ? ctx.fleet.trailerById.get(oplId) || null : null;
    beelden(soort, obj, { alt: obj ? `${soort === 'oplegger' ? 'Oplegger' : 'Voertuig'} ${obj.id}` : '', opl }).then(L => {
      if (!fig.isConnected) return;
      if (!L.length) { fig.remove(); return; }
      toon(fig, L[0]);
      // bij twee of meer foto's: miniaturen om te wisselen (van voren, van opzij)
      const w = fig.querySelector('.pf-w');
      if (w && L.length > 1) {
        w.innerHTML = L.map((b, i) => `<button class="pf-t" type="button" data-i="${i}" aria-pressed="${i === 0}" title="${esc(ZICHT[b.zicht] || `Beeld ${i + 1}`)}" aria-label="${esc(ZICHT[b.zicht] || `Beeld ${i + 1}`)}"><img src="${esc(b.src)}" alt="" width="48" height="32" decoding="async"></button>`).join('');
        w.addEventListener('click', e => { const t = e.target.closest('[data-i]'); if (!t) return; const b = L[+t.dataset.i]; if (!b) return; toon(fig, b); for (const x of w.querySelectorAll('[data-i]')) x.setAttribute('aria-pressed', String(x === t)); });
      }
    });
  }
}
