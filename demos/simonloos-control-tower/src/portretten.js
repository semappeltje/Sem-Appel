// Portretten van de voertuigen en opleggers: renders van onze eigen 3D-modellen (src/scene3d/varianten.js), geen foto's.
// Cabines in de vorm van de merken in de vloot, zonder merktekens; de Simon Loos-rode cabine en de witte oplegger zoals in
// de 3D-wereld; een fictief kenteken op het model (de app zet het echte kenteken als tekst ernaast). Opnieuw maken:
// node tools/render-portretten.mjs. 640 x 400 px, WebP met een doorzichtige achtergrond, elk hooguit 25 KB.
//
// De beelden komen met ?inline als data-URL in de bundel: geen los bestand, geen fetch, de bestandslijst van de sitebuild
// blijft gelijk. Deze module importeert niets uit three of scene3d.
//
//   portretVan(voertuig, oplegger?)  voertuig: { kind: 'trekker' | 'bakwagen' | 'bus', ev, model }; oplegger (optioneel):
//                                    de gekoppelde oplegger (of true): dan het beeld met oplegger. Zonder tweede argument
//                                    telt voertuig.tr (zoals in de toestand uit fleet.stateAt).
//   portretVanOplegger(oplegger)     oplegger: { type } (koel, vries, droog, huif, city, silo, drank, lzv) of de soort zelf
//   Beide geven { id, src, w, h, alt, soort, ... } of null.
import trekkerDafDiesel from './assets/portretten/trekker-daf-diesel.webp?inline';
import trekkerDafDieselOplegger from './assets/portretten/trekker-daf-diesel-oplegger.webp?inline';
import trekkerScaniaDiesel from './assets/portretten/trekker-scania-diesel.webp?inline';
import trekkerScaniaDieselOplegger from './assets/portretten/trekker-scania-diesel-oplegger.webp?inline';
import trekkerVolvoDiesel from './assets/portretten/trekker-volvo-diesel.webp?inline';
import trekkerVolvoDieselOplegger from './assets/portretten/trekker-volvo-diesel-oplegger.webp?inline';
import trekkerVolvoElektrisch from './assets/portretten/trekker-volvo-elektrisch.webp?inline';
import trekkerVolvoElektrischOplegger from './assets/portretten/trekker-volvo-elektrisch-oplegger.webp?inline';
import trekkerMercedesDiesel from './assets/portretten/trekker-mercedes-diesel.webp?inline';
import trekkerMercedesDieselOplegger from './assets/portretten/trekker-mercedes-diesel-oplegger.webp?inline';
import trekkerMercedesElektrisch from './assets/portretten/trekker-mercedes-elektrisch.webp?inline';
import trekkerMercedesElektrischOplegger from './assets/portretten/trekker-mercedes-elektrisch-oplegger.webp?inline';
import trekkerMercedes600Elektrisch from './assets/portretten/trekker-mercedes600-elektrisch.webp?inline';
import trekkerMercedes600ElektrischOplegger from './assets/portretten/trekker-mercedes600-elektrisch-oplegger.webp?inline';
import bakwagenDafDiesel from './assets/portretten/bakwagen-daf-diesel.webp?inline';
import bakwagenMercedesDiesel from './assets/portretten/bakwagen-mercedes-diesel.webp?inline';
import bakwagenMercedesElektrisch from './assets/portretten/bakwagen-mercedes-elektrisch.webp?inline';
import busElektrisch from './assets/portretten/bus-elektrisch.webp?inline';
import opleggerKoel from './assets/portretten/oplegger-koel.webp?inline';
import opleggerVries from './assets/portretten/oplegger-vries.webp?inline';
import opleggerDroog from './assets/portretten/oplegger-droog.webp?inline';
import opleggerHuif from './assets/portretten/oplegger-huif.webp?inline';
import opleggerCity from './assets/portretten/oplegger-city.webp?inline';
import opleggerSilo from './assets/portretten/oplegger-silo.webp?inline';
import opleggerDrank from './assets/portretten/oplegger-drank.webp?inline';
import opleggerLzv from './assets/portretten/oplegger-lzv.webp?inline';

const W = 640, H = 400;
const VORM = { daf: 'DAF XF', scania: 'Scania R', volvo: 'Volvo FH', mercedes: 'Mercedes-Benz Actros', mercedes600: 'Mercedes-Benz eActros 600' };
const trekker = (cabine, ev, met, src) => ({
  id: `trekker-${cabine}-${ev ? 'elektrisch' : 'diesel'}${met ? '-oplegger' : ''}`, src, w: W, h: H, soort: 'trekker', cabine, ev, oplegger: met,
  vorm: `${VORM[cabine]}-achtig`,
  alt: `Trekker, ${ev ? 'elektrisch' : 'diesel'}, ${met ? 'met koeloplegger' : 'zonder oplegger'}; cabine in de vorm van een ${VORM[cabine]}${ev && cabine === 'mercedes' ? ' (eActros)' : ''}`,
});
const bakwagen = (cabine, ev, src) => ({ id: `bakwagen-${cabine}-${ev ? 'elektrisch' : 'diesel'}`, src, w: W, h: H, soort: 'bakwagen', cabine, ev, oplegger: false, vorm: `${cabine === 'daf' ? 'DAF XD' : ev ? 'Mercedes-Benz eActros' : 'Mercedes-Benz Atego'}-achtig`, alt: `Bakwagen, ${ev ? 'elektrisch' : 'diesel'}, met gesloten opbouw, rolluik en laadklep; cabine in de vorm van een ${cabine === 'daf' ? 'DAF XD' : ev ? 'Mercedes-Benz eActros' : 'Mercedes-Benz Atego'}` });
const OPL = { koel: 'Koeloplegger met koelmachine', vries: 'Vriesoplegger met koelmachine', droog: 'Gesloten oplegger', huif: 'Schuifzeiloplegger', city: 'City-oplegger, kort, met koelmachine', silo: 'Silo-oplegger met een tank van roestvrij staal', drank: 'Drankenoplegger met rolluiken', lzv: 'Oplegger van een LZV-combinatie, op een dolly' };
const oplegger = (type, src) => ({ id: `oplegger-${type}`, src, w: W, h: H, soort: 'oplegger', type, alt: `${OPL[type]}, los op de steunpoten` });

export const PORTRETTEN = [
  trekker('daf', false, false, trekkerDafDiesel), trekker('daf', false, true, trekkerDafDieselOplegger),
  trekker('scania', false, false, trekkerScaniaDiesel), trekker('scania', false, true, trekkerScaniaDieselOplegger),
  trekker('volvo', false, false, trekkerVolvoDiesel), trekker('volvo', false, true, trekkerVolvoDieselOplegger),
  trekker('volvo', true, false, trekkerVolvoElektrisch), trekker('volvo', true, true, trekkerVolvoElektrischOplegger),
  trekker('mercedes', false, false, trekkerMercedesDiesel), trekker('mercedes', false, true, trekkerMercedesDieselOplegger),
  trekker('mercedes', true, false, trekkerMercedesElektrisch), trekker('mercedes', true, true, trekkerMercedesElektrischOplegger),
  trekker('mercedes600', true, false, trekkerMercedes600Elektrisch), trekker('mercedes600', true, true, trekkerMercedes600ElektrischOplegger),
  bakwagen('daf', false, bakwagenDafDiesel), bakwagen('mercedes', false, bakwagenMercedesDiesel), bakwagen('mercedes', true, bakwagenMercedesElektrisch),
  { id: 'bus-elektrisch', src: busElektrisch, w: W, h: H, soort: 'bus', ev: true, oplegger: false, vorm: 'Volkswagen e-Crafter-achtig', alt: 'Elektrische bestelbus, wit met de rode band' },
  oplegger('koel', opleggerKoel), oplegger('vries', opleggerVries), oplegger('droog', opleggerDroog), oplegger('huif', opleggerHuif),
  oplegger('city', opleggerCity), oplegger('silo', opleggerSilo), oplegger('drank', opleggerDrank), oplegger('lzv', opleggerLzv),
];
const BY_ID = new Map(PORTRETTEN.map(p => [p.id, p]));

// cabinevorm uit de modelnaam ('DAF XF 480', 'Scania R 450', 'Volvo FH Electric', 'Mercedes-Benz eActros 600', ...)
export function cabineVan(model) {
  const m = String(model || '').toLowerCase();
  if (/eactros\s*600/.test(m)) return 'mercedes600';
  if (/\bdaf\b/.test(m)) return 'daf';
  if (/scania/.test(m)) return 'scania';
  if (/volvo/.test(m)) return 'volvo';
  if (/mercedes|actros|atego|sprinter/.test(m)) return 'mercedes';
  return null;
}

export function portretVan(voertuig, oplegger) {
  if (!voertuig) return null;
  const kind = voertuig.kind || voertuig.soort || 'trekker'; const ev = !!voertuig.ev; const cab = cabineVan(voertuig.model);
  if (kind === 'bus' || voertuig.van) return BY_ID.get('bus-elektrisch');
  if (kind === 'bakwagen') return BY_ID.get(ev ? 'bakwagen-mercedes-elektrisch' : cab === 'daf' ? 'bakwagen-daf-diesel' : 'bakwagen-mercedes-diesel');
  // trekker: elektrisch zijn er in de vloot alleen Volvo- en Mercedes-cabines; de eActros 600 heeft zijn eigen vorm
  let c = cab || (ev ? 'mercedes' : 'daf');
  if (c === 'mercedes600' && !ev) c = 'mercedes';
  if (ev && c !== 'volvo' && c !== 'mercedes600') c = 'mercedes';
  const met = oplegger !== undefined ? !!oplegger : !!(voertuig.tr || voertuig.oplegger);
  return BY_ID.get(`trekker-${c}-${ev ? 'elektrisch' : 'diesel'}${met ? '-oplegger' : ''}`) || BY_ID.get(`trekker-daf-diesel${met ? '-oplegger' : ''}`);
}

export function portretVanOplegger(oplegger) {
  if (!oplegger) return null;
  const t = typeof oplegger === 'string' ? oplegger : oplegger.type || oplegger.soort || oplegger.kind;
  return BY_ID.get(`oplegger-${t}`) || BY_ID.get('oplegger-droog');
}
