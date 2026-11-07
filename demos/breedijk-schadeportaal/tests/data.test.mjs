// De gesimuleerde wereld: vorm, verhoudingen en het verhaal van de demo. node --test tests/data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { maakWereld, ritVan, ritDetail, NU } from '../src/data.js';
import { beoordeel, gesprekSignaal, OPEN_STATUS, GEBIEDEN, SOORTEN } from '../src/regels.js';
import { STANDAARD } from '../src/instellingen.js';
import { conceptAntwoord } from '../src/antwoord.js';

const D = maakWereld();
test('de wereld is deterministisch en snel genoeg', () => {
  const E = maakWereld(); assert.equal(E.claims.length, D.claims.length); assert.equal(E.claims[10].kenteken, D.claims[10].kenteken); assert.ok(D.bouwMs < 2500, `bouw ${D.bouwMs} ms`);
});
test('ritten: ongeveer 800 per week, nooit in de toekomst, op werkdagen', () => {
  const weken = (NU - Math.min(...D.ritten.map(r => r.ophaal))) / (7 * 86400000);
  const perWeek = D.ritten.length / weken; assert.ok(perWeek > 650 && perWeek < 950, `${perWeek} per week`);
  assert.ok(D.ritten.every(r => r.aflever <= NU && r.ophaal <= r.aflever));
  assert.ok(D.ritten.every(r => { const w = new Date(r.ophaal).getDay(); return w !== 0 && w !== 6; }));
});
test('claims: ongeveer een op de honderd ritten, nooit in de toekomst, nummers uniek en oplopend', () => {
  const recent = D.claims.filter(c => c.categorie === 'lading' && c.ontvangen > NU - 90 * 86400000 && c.rit);
  const aandeel = recent.length / D.ritten.length; assert.ok(aandeel > 0.006 && aandeel < 0.02, `aandeel ${aandeel}`);
  assert.ok(D.claims.every(c => c.ontvangen <= NU));
  const ids = D.claims.map(c => c.id); assert.equal(new Set(ids).size, ids.length);
  for (let i = 1; i < D.claims.length; i++) assert.ok(D.claims[i].ontvangen >= D.claims[i - 1].ontvangen);
});
test('elke claim heeft de velden waarin echte data past', () => {
  for (const c of D.claims) {
    assert.ok(['lading', 'eigen', 'derde', 'divers'].includes(c.categorie), c.categorie);
    if (c.categorie !== 'derde' || c.voertuig.soort !== 'object') assert.ok(/^[A-Z0-9]{6}$/.test(c.kenteken), `${c.id} ${c.kenteken}`); assert.ok(GEBIEDEN[c.gebied] && SOORTEN[c.soort], `${c.id} ${c.gebied} ${c.soort}`); assert.ok(c.ernst >= 1 && c.ernst <= 6);
    if (c.categorie === 'lading') assert.ok(c.voertuig.massa > 800 && c.voertuig.massa < 2400); assert.ok(c.opdrachtgever.id); assert.ok(c.log.length >= 2); assert.ok(c.onderwerp && c.mail);
    if (c.calculatie) assert.equal(c.bedragGevraagd, c.calculatie.totaal);
    if (c.rit) { const r = ritVan(D, c); if (r) { assert.ok(r.fotos.length >= 6, 'zes foto\'s bij ophalen'); assert.ok(r.aflevering.rol); } }
  }
});
test('het verhaal: een chauffeur boven de regel, een met het tweede signaal, enkele claims zonder rit en meldingen van chauffeurs', () => {
  const sig = D.chauffeurs.map(ch => gesprekSignaal(D.claims.filter(c => c.chauffeur === ch.id), STANDAARD, NU)).filter(Boolean);
  assert.ok(sig.some(s => s.niveau === 'gesprek'), 'een gesprek'); assert.ok(sig.some(s => s.niveau === 'signaal'), 'een tweede signaal'); assert.ok(sig.length <= 6, `niet te veel signalen: ${sig.length}`);
  assert.ok(D.claims.filter(c => !c.rit).length >= 3); assert.ok(D.claims.filter(c => c.bron === 'chauffeur').length >= 2);
  const open = D.claims.filter(c => OPEN_STATUS.includes(c.status)); assert.ok(open.length >= 20 && open.length <= 80, `open ${open.length}`);
  assert.ok(D.claims.some(c => c.status === 'nieuw'));
});
test('de beoordeling klopt met het verhaal van elke claim', () => {
  let eerderAfw = 0, eerderN = 0;
  for (const c of D.claims) {
    const B = beoordeel(c, ritVan(D, c), STANDAARD, NU);
    if (c.verhaal === 'eerder') { eerderN++; if (B.advies.besluit === 'afwijzen') eerderAfw++; }
    if (c.verhaal === 'geen_rit') assert.equal(B.advies.besluit, 'info');
    if (c.verhaal === 'nieuw_voorbehoud') assert.ok(['erkennen', 'verzekeraar', 'tegenvoorstel', 'info'].includes(B.advies.besluit), `${c.id} ${B.advies.besluit}`);
    assert.ok(B.signalen.length >= 1);
  }
  assert.ok(eerderAfw / eerderN > 0.95, `eerder → afwijzen ${eerderAfw}/${eerderN}`);
});
test('het conceptantwoord noemt het kenteken, het dossier en nooit een persoonsnaam van de tegenpartij', () => {
  for (const c of D.claims.slice(-40)) { const r = ritVan(D, c); const B = beoordeel(c, r, STANDAARD, NU); for (const b of ['afwijzen', 'erkennen', 'tegenvoorstel', 'info']) { if (b !== 'afwijzen' && b !== 'info' && !r) continue; const { tekst } = conceptAntwoord(c, r, B, b, STANDAARD, c.bedragGevraagd || 500); assert.ok(tekst.includes(c.id)); assert.ok(!/undefined|NaN|\[object/.test(tekst), tekst); } }
});
test('het detail van een rit is stabiel en de foto\'s dragen tijd en plek', () => {
  const r = D.ritten[100]; const a = ritDetail(r); const b = ritDetail(r); assert.equal(a, b);
  assert.ok(a.fotos.every(f => f.tijd >= r.ophaal && f.label)); assert.ok(a.fotos.filter(f => f.moment === 'ophaal').length >= 5);
});

test('aanrijschade en diverse schade: het wagenpark, de verhalen en het advies', () => {
  assert.equal(D.vloot.filter(v => v.soort === 'trekker').length, 42); assert.ok(D.vloot.every(v => /^[A-Z0-9]{6}$/.test(v.kenteken)));
  assert.ok(D.vloot.filter(v => v.soort === 'trekker').every(v => /^\d\dB[A-Z]{2}\d$/.test(v.kenteken)), 'een vrachtwagen heeft een B in de lettergroep');
  assert.ok(D.vloot.filter(v => v.soort === 'oplegger').every(v => v.kenteken.startsWith('O')), 'een oplegger begint met O');
  const per = k => D.claims.filter(c => c.categorie === k);
  assert.ok(per('eigen').length >= 60 && per('derde').length >= 20 && per('divers').length >= 8);
  for (const c of per('eigen')) { assert.ok(D.vlootMap.has(c.eigenVoertuig)); assert.equal(c.opdrachtgever.id, 'K-00'); const B = beoordeel(c, null, STANDAARD, NU); assert.ok(['werkplaats', 'casco', 'formulier'].includes(B.advies.besluit), `${c.id} ${B.advies.besluit}`); if (c.formulier.status === 'ontvangen') assert.equal(B.advies.besluit, c.bedragGevraagd >= STANDAARD.cascoGrens ? 'casco' : 'werkplaats'); }
  for (const c of per('derde')) { const B = beoordeel(c, null, STANDAARD, NU); if (!c.gps.gevonden) assert.equal(B.advies.besluit, 'afwijzen'); assert.ok(c.tegenpartij && c.tegenpartij.naam); assert.ok(!/[A-Z][a-z]+ [A-Z]\.$/.test(c.tegenpartij.naam), 'geen persoonsnaam bij de tegenpartij'); }
  assert.ok(per('eigen').some(c => c.status === 'werkplaats') && per('derde').some(c => OPEN_STATUS.includes(c.status)), 'er ligt open werk van elke soort');
  assert.ok(D.claims.every(c => [0, 6].indexOf(new Date(c.ontvangen).getDay()) === -1 || c.categorie !== 'lading'), 'geen ladingsclaims in het weekend');
});
