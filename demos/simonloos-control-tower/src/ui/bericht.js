// Het bericht aan de chauffeur (Control Tower 4.1, bouwsteen D): zijn dienst als tekst (begintijd, voertuig, oplegger,
// ritten met tijden en adressen, de pauze en een link naar de rit in de app), het kanaal (de chauffeursapp of de mail) en
// de gesimuleerde bevestiging ("gezien" na een paar minuten simulatietijd, "akkoord" meestal, soms niet). Er gaat in de
// demo niets de deur uit: geen mailto, geen fetch, geen tel:. De tekst is een voorbeeld op het scherm; namen en adressen
// blijven in de browser. In het echt gaat hij via een maildienst of de app van de boordcomputer (README, open vragen).
import { hhmm, durTxt, adresTxt } from './base.js';
import { plekNaam } from '../places.js';

// vaste toevalswaarde 0..1 uit een tekst (FNV-1a), zodat dezelfde dienst op dezelfde dag hetzelfde doet na een herlaad
export const h01 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

// het kanaal per chauffeur (gesimuleerd): ongeveer zeven op de tien hebben de chauffeursapp, de rest krijgt een mail
export const kanaalVan = key => (h01(`kanaal|${key}`) < 0.7 ? 'app' : 'mail');
export const KANAAL = { app: 'per app', mail: 'per mail' };

// Na zoveel minuten zonder akkoord staat een dienst bij "wacht op bevestiging" (schatting voor de demo; de echte norm
// spreek je af met de planners en de OR, en de cao kent termijnen voor het bekendmaken van diensten: nalezen voor de proef).
export const WACHT_NORM = 30;

// De gesimuleerde bevestiging van een verstuurde versie: na hoeveel minuten de chauffeur het bericht ziet en akkoord geeft.
// Een vast deel blijft uit (deterministisch per dienst, dag en versie): ongeveer 7 procent ziet het niet, 8 procent ziet het
// maar geeft geen akkoord. null betekent: komt niet.
export function bevestiging(key, versie, dag) {
  const s = `${dag}|${key}|${versie}`; const u = h01('uit|' + s);
  const gezien = 2 + Math.floor(h01('gezien|' + s) * 14);
  if (u < 0.07) return { gezien: null, akkoord: null };
  if (u < 0.15) return { gezien, akkoord: null };
  return { gezien, akkoord: gezien + 2 + Math.floor(h01('akkoord|' + s) * 24) };
}
// de stand van een verstuurde versie na `na` minuten: vrijgegeven, gezien of bevestigd
export function standNa(b, na) {
  if (b.akkoord !== null && na >= b.akkoord) return 'bevestigd';
  if (b.gezien !== null && na >= b.gezien) return 'gezien';
  return 'vrijgegeven';
}

// een plek met adres: een standplaats of DC met straat en nummer; een winkel met naam en plaats (meer weten we niet)
export const adresVan = p => { if (!p) return ''; const n = plekNaam(p); const a = p.adres && typeof p.adres === 'object' ? adresTxt(p.adres) : ''; return a ? `${n}, ${a}` : n; };
const tijd = m => (m >= 1440 ? `${hhmm(m)} (na middernacht)` : hhmm(m));

// De pauzes van een dienst uit het plan (absolute minuten), en waar hij laadt per rit (dock op de standplaats of een DC).
export function pauzesVan(t, d) {
  return t.plan.filter(s => s.k === 'pauze' && s.d === d.i).map(s => ({ a: t.dayStart + s.t0, b: t.dayStart + s.t1, bij: s.at || null }));
}
export function ladenVan(r) {
  const t = r.t; let dock = null;
  for (let i = r.i0; i <= r.i1 && i < t.plan.length; i++) { const s = t.plan[i]; if ((s.k === 'koppel' || (s.k === 'terrein' && s.dockSoort === 'laden')) && s.dock) { dock = s.dock; break; } }
  const dc = r.stops.find(x => x.seg && x.seg.actie === 'laden');
  if (dc) return { waar: adresVan(dc.place) || dc.name, dock: null };
  return { waar: adresVan(t.base), dock };
}

// De regels van het bericht: elke regel { k, txt }, met k 'kop', 'regel', 'rit', 'stop', 'link' of 'slot'. De tekst
// (tekstVan) is wat de chauffeur in zijn app of mail leest; het scherm toont dezelfde regels.
export function berichtVan(e, o) {
  const voornaam = (e.naam || '').split(' ')[0] || 'chauffeur';
  const R = []; const add = (k, txt, x = {}) => R.push({ k, txt, ...x });
  add('kop', o.wijziging ? `Wijziging in je dienst van ${o.dag}` : `Je dienst van ${o.dag}`);
  add('regel', `Hoi ${voornaam},`);
  if (o.wijziging) {
    add('regel', 'Er is iets veranderd aan je dienst:');
    for (const w of o.wijziging) add('stop', w.txt);
    add('regel', 'De rest blijft zoals je hem kreeg.');
  } else add('regel', `Dit is je dienst van ${o.dag}.`);
  add('regel', `Begin: ${tijd(e.start)} op ${adresVan(e.t.base)}`);
  add('regel', `Voertuig: ${e.t.id}${e.t.plate ? ` (${e.t.plate})` : ''}${e.t.model ? `, ${e.t.model}` : ''}`);
  add('regel', `Oplegger: ${e.tr ? `${e.tr.id}${e.tr.plate ? ` (${e.tr.plate})` : ''}` : e.t.kind === 'trekker' ? 'nog niet bekend' : 'geen, je rijdt een bakwagen of bus'}`);
  e.ritten.forEach((r, i) => {
    const l = ladenVan(r);
    add('rit', `Rit ${i + 1}, ${r.id}: vertrek ${tijd(r.depPlan)}, laden ${l.waar}${l.dock ? ` aan dock ${l.dock}` : ''}`, { rit: r.id });
    for (const x of r.stops) add('stop', `${tijd(x.plan)} ${x.pickup ? `oplegger ${x.pickup.id} ophalen bij ` : ''}${adresVan(x.place) || x.name}${x.win ? `, venster ${hhmm(x.win[0])} tot ${hhmm(x.win[1])}` : ''}`);
    add('stop', `Terug op ${e.t.base.n} rond ${tijd(r.endPlan)}`);
  });
  // de pauze: een pauzeblok in het plan, anders de tijd tussen twee ritten op de standplaats (45 minuten of meer telt als pauze)
  const P = o.pauzes || []; const tussen = [];
  for (let i = 1; i < e.ritten.length; i++) { const a = e.ritten[i - 1].endPlan, b = e.ritten[i].depPlan; if (b - a >= 45) tussen.push(`${durTxt(b - a)} tussen rit ${i} en ${i + 1} op ${e.t.base.n} (${hhmm(a)} tot ${hhmm(b)})`); }
  add('regel', P.length ? `Pauze: ${P.map(p => `${durTxt(p.b - p.a)} om ${hhmm(p.a)}${p.bij ? ` bij ${p.bij}` : ''}`).join(' en ')}` : tussen.length ? `Pauze: ${tussen.join(' en ')}` : 'Pauze: geen pauzeblok in het plan; houd je aan 45 minuten na 4,5 uur rijden.');
  add('regel', `Einde dienst: rond ${tijd(e.end)}`);
  if (e.ritten.length) add('link', `Bekijk je eerste rit: ${o.basis}#rit/${e.ritten[0].id}`, { rit: e.ritten[0].id });
  add('slot', o.kanaal === 'app' ? 'Tik op Gezien en daarna op Akkoord. Klopt er iets niet, bel de planning.' : 'Klik op Gezien en daarna op Akkoord in de mail. Klopt er iets niet, bel de planning.');
  return R;
}
export const tekstVan = R => R.map(x => (x.k === 'stop' ? `  - ${x.txt}` : x.txt)).join('\n');
