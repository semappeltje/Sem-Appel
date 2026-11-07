// Echte foto's, gebundeld in de app (geen verzoek naar buiten): per automodel een foto, close-ups van schades per
// gebied en soort, en overzichten van een hoek van een auto. Bron, maker en licentie staan in
// src/assets/fotos/manifest.json en BRONNEN.md (Wikimedia Commons, vrije licenties; naamsvermelding in de app onder
// Instellingen). Zonder foto's (de map is leeg) valt alles terug op de schetsen; de app werkt dan hetzelfde.
const urls = import.meta.glob('./assets/fotos/**/*.webp', { eager: true, query: '?url', import: 'default' });
const manifesten = import.meta.glob('./assets/fotos/manifest.json', { eager: true, import: 'default' });
const M = Object.values(manifesten)[0] || { auto: [], schade: [], overzicht: [] };
const naam = b => String(b || '').replace(/^.*\//, '');
const url = (map, bestand) => urls[`./assets/fotos/${map}/${naam(bestand)}`] || null;
const slug = (merk, model) => `${merk}-${model}`.toLowerCase().replace(/&/g, 'en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const AUTO = (M.auto || []).map(a => ({ ...a, bestand: naam(a.bestand), url: url('auto', a.bestand) })).filter(a => a.url);
export const SCHADE = (M.schade || []).map(s => ({ ...s, bestand: naam(s.bestand), url: url('schade', s.bestand) })).filter(s => s.url);
export const OVERZICHT = (M.overzicht || []).map(o => ({ ...o, bestand: naam(o.bestand), url: url('overzicht', o.bestand) })).filter(o => o.url);
export const heeftFotos = AUTO.length > 0 || SCHADE.length > 0;

const autoIndex = new Map(AUTO.map(a => [a.slug || slug(a.merk, a.model), a]));
export function autoFoto(merk, model) { return autoIndex.get(slug(merk, model)) || null; }
export function kleurVoor(merk, model) { const a = autoFoto(merk, model); return a ? a.kleur : null; }

// een schadefoto bij een gebied en soort: eerst dezelfde combinatie, dan hetzelfde gebied (links of rechts maakt voor
// een close-up weinig uit), dan dezelfde soort; de keuze is vast per sleutel, zodat een dossier steeds dezelfde foto toont
const kant = g => g.replace(/_(lv|la|rv|ra|l|r)$/, '');
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function schadeFoto(gebied, soort, sleutel = '') {
  if (!SCHADE.length) return null;
  const k = [SCHADE.filter(s => s.gebied === gebied && s.soort === soort), SCHADE.filter(s => kant(s.gebied) === kant(gebied) && s.soort === soort), SCHADE.filter(s => kant(s.gebied) === kant(gebied)), SCHADE.filter(s => s.soort === soort), SCHADE].find(L => L.length);
  return k[hash(sleutel + gebied + soort) % k.length];
}
export function overzichtFoto(zijde, sleutel = '') {
  if (!OVERZICHT.length) return null;
  const z = { overzicht_lv: 'lv', overzicht_rv: 'rv', overzicht_la: 'la', overzicht_ra: 'ra' }[zijde] || zijde;
  const L = OVERZICHT.filter(o => o.zijde === z); const K = L.length ? L : OVERZICHT;
  return K[hash(sleutel + z) % K.length];
}
// de naamsvermelding (CC BY en CC BY-SA vragen die)
export function bronnen() { return [...AUTO, ...SCHADE, ...OVERZICHT].map(f => ({ bestand: f.bestand, maker: f.maker, licentie: f.licentie, bron: f.bron, licentieUrl: f.licentieUrl })); }
