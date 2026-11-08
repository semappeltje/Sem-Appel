// De pure regels, zonder browser: node --test tests/regels.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { werkdagen, kentekenNorm, kentekenToon, limietPerKg, zelfdePlek, beoordeel, tegenvoorstel, eigenKosten, gesprekSignaal, antwoordTermijn, csv, besluitenVoor, besluitNaam, uitkomstGroep, UITKOMST, beoordeelVoertuig, CATEGORIEN, teltVoorChauffeur } from '../src/regels.js';
import { STANDAARD } from '../src/instellingen.js';

const inst = { ...STANDAARD };
const dag = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime();

test('werkdagen telt zonder weekend, in beide richtingen', () => {
  assert.equal(werkdagen(dag(2026, 11, 2), dag(2026, 11, 6)), 4); // ma → vr
  assert.equal(werkdagen(dag(2026, 10, 30), dag(2026, 11, 2)), 1); // vr → ma
  assert.equal(werkdagen(dag(2026, 11, 6), dag(2026, 11, 2)), -4);
  assert.equal(werkdagen(dag(2026, 11, 6, 6), dag(2026, 11, 6, 18)), 0);
});
test('kenteken: normaliseren en tonen', () => {
  assert.equal(kentekenNorm(' gx-412-n '), 'GX412N');
  assert.equal(kentekenToon('GX412N'), 'GX-412-N');
  assert.equal(kentekenToon('H123BC'), 'H-123-BC');
  assert.equal(kentekenToon('VBB12X'), 'VBB-12-X');
  assert.equal(kentekenToon('kort'), 'kort');
});
test('limiet per kilogram en aangrenzende plekken', () => {
  assert.equal(limietPerKg(1300, 3.4), 4420);
  assert.ok(zelfdePlek('bumper_voor', 'spatbord_lv'));
  assert.ok(zelfdePlek('portier_la', 'portier_la'));
  assert.ok(!zelfdePlek('bumper_voor', 'bumper_achter'));
});
const voertuig = { massa: 1300, catalogusprijs: 30000 };
const k = { id: 'K-01', naam: 'Test Lease', btwAftrek: true, stijl: 'kort', rol: 'fleetmanager' };
const rit = (o = {}) => ({ id: 'R-1', ophaal: dag(2026, 10, 20), aflever: dag(2026, 10, 21), van: { plaats: 'Hoorn' }, naar: { plaats: 'Opmeer' }, chauffeurNaam: 'Kees B.', truck: 'BT-12', positie: 3, inspectieOphaal: [], inspectieAflever: [], fotos: [], aflevering: { rol: 'receptionist', voorbehoud: false, tekst: '' }, ...o });
const claim = (o = {}) => ({ id: 'S-1', kenteken: 'GX412N', voertuig, opdrachtgever: k, gebied: 'bumper_achter', soort: 'kras', ernst: 2, datumClaim: dag(2026, 10, 23), ontvangen: dag(2026, 10, 23), calculatie: { uren: 2, uurtarief: 95, onderdelen: 100, lak: 150, vervangen: false, dubbel: false, btw: false, totaal: 440 }, bedragGevraagd: 440, fotosClaimTonenSchade: true, ...o });

test('beoordeel: zonder rit is het advies informatie vragen', () => {
  const B = beoordeel(claim(), null, inst, dag(2026, 11, 6));
  assert.equal(B.signalen[0].kleur, 'slecht'); assert.equal(B.advies.besluit, 'info');
});
test('beoordeel: schade op de ophaalinspectie geeft afwijzen', () => {
  const r = rit({ inspectieOphaal: [{ gebied: 'bumper_achter', soort: 'kras', ernst: 2 }], fotos: [{ id: 'F-1', moment: 'ophaal', gebied: 'bumper_achter', tijd: dag(2026, 10, 20) }] });
  const B = beoordeel(claim(), r, inst, dag(2026, 11, 6));
  assert.equal(B.advies.besluit, 'afwijzen'); assert.ok(B.eerder); assert.ok(B.getekend); assert.ok(B.termijn);
  assert.deepEqual(B.signalen.find(s => s.id === 'eerder').fotos, ['F-1']);
});
test('beoordeel: voorbehoud bij aflevering en niets bij ophalen geeft erkennen, boven de grens de verzekeraar', () => {
  const r = rit({ inspectieAflever: [{ gebied: 'bumper_achter', soort: 'kras', ernst: 2 }], aflevering: { rol: 'receptionist', voorbehoud: true, tekst: 'Bumper achter: kras' } });
  assert.equal(beoordeel(claim(), r, inst, dag(2026, 11, 6)).advies.besluit, 'erkennen');
  const groot = claim({ calculatie: { uren: 10, uurtarief: 95, onderdelen: 900, lak: 400, vervangen: true, dubbel: false, btw: false, totaal: 2250 }, bedragGevraagd: 2250, ernst: 4 });
  assert.equal(beoordeel(groot, r, inst, dag(2026, 11, 6)).advies.besluit, 'verzekeraar');
});
test('beoordeel: te late melding zonder voorbehoud en zonder foto geeft afwijzen; boven de limiet een signaal', () => {
  const r = rit({ aflever: dag(2026, 10, 1) });
  const c = claim({ datumClaim: dag(2026, 10, 23), calculatie: { uren: 20, uurtarief: 95, onderdelen: 3000, lak: 800, vervangen: true, dubbel: false, btw: false, totaal: 5700 }, bedragGevraagd: 5700, ernst: 5 });
  const B = beoordeel(c, r, inst, dag(2026, 11, 6));
  assert.equal(B.termijn, false); assert.equal(B.advies.besluit, 'afwijzen');
  assert.equal(B.signalen.find(s => s.id === 'limiet').kleur, 'let'); assert.equal(B.limiet, 4420);
});
test('beoordeel: geen bewijs van onze kant geeft de vraag aan de chauffeur', () => {
  assert.equal(beoordeel(claim(), rit(), inst, dag(2026, 11, 6)).advies.besluit, 'chauffeur');
});
test('tegenvoorstel herrekent tarief, vervangen en dubbele posten, nooit boven de limiet', () => {
  const c = claim({ calculatie: { uren: 2, uurtarief: 124, onderdelen: 400, lak: 200, vervangen: true, dubbel: true, btw: false, totaal: 848 }, bedragGevraagd: 848, ernst: 2 });
  assert.equal(tegenvoorstel(c, inst), 2 * inst.normUurtarief + 140 + 120); // tarief naar de norm, onderdelen 35 %, lak 60 %
  const zwaar = claim({ voertuig: { massa: 500 }, calculatie: { uren: 30, uurtarief: 95, onderdelen: 2000, lak: 500, vervangen: false, dubbel: false, btw: false, totaal: 5350 } });
  assert.equal(tegenvoorstel(zwaar, inst), 1700);
  assert.equal(tegenvoorstel(claim({ calculatie: null }), inst), null);
});
test('eigen kosten per besluit', () => {
  assert.equal(eigenKosten('afgewezen', 900, inst), 0); assert.equal(eigenKosten('verzekeraar', 2400, inst), 750); assert.equal(eigenKosten('verzekeraar', 500, inst), 500); assert.equal(eigenKosten('erkend', 640, inst), 640);
});
test('gesprekSignaal: drie in zeven dagen is een gesprek, afgewezen telt niet, oud telt niet', () => {
  const nu = dag(2026, 11, 6);
  const s = d => ({ status: 'erkend', datumClaim: dag(2026, 11, d) });
  assert.equal(gesprekSignaal([s(1), s(3), s(5)], inst, nu).niveau, 'gesprek');
  assert.equal(gesprekSignaal([s(1), s(3), { status: 'afgewezen', datumClaim: dag(2026, 11, 5) }], inst, nu), null);
  const oud = [1, 2, 3].map(d => ({ status: 'erkend', datumClaim: dag(2026, 3, d) }));
  assert.equal(gesprekSignaal(oud, inst, nu), null);
  const zes = [1, 12, 24, 36, 48, 60].map(d => ({ status: 'erkend', datumClaim: nu - d * 86400000 }));
  assert.equal(gesprekSignaal(zes, inst, nu).niveau, 'signaal');
  assert.equal(gesprekSignaal(zes.slice(1), inst, nu), null);
});
test('antwoordTermijn en csv', () => {
  const t = antwoordTermijn({ ontvangen: dag(2026, 10, 20) }, inst, dag(2026, 11, 6));
  assert.equal(t.wacht, 13); assert.ok(t.over);
  assert.equal(csv([{ a: 'x;y', b: 2 }], [{ n: 'A', k: 'a' }, { n: 'B', k: r => r.b * 2 }]), 'A;B\n"x;y";4');
});

test('aanrijschade eigen voertuig: werkplaats onder de grens, casco erboven, eerst het formulier', () => {
  const c = { categorie: 'eigen', gebied: 'oplegger_r', soort: 'schaafplek', fase: 'terrein', bedragGevraagd: 900, chauffeur: 'C-01', chauffeurNaam: 'Kees B.', melding: { door: 'chauffeur', uurNa: 1 }, formulier: { status: 'ontvangen', op: dag(2026, 11, 2) } };
  assert.equal(beoordeelVoertuig(c, null, inst, dag(2026, 11, 6)).advies.besluit, 'werkplaats');
  assert.equal(beoordeelVoertuig({ ...c, bedragGevraagd: 9800 }, null, inst, dag(2026, 11, 6)).advies.besluit, 'casco');
  assert.equal(beoordeelVoertuig({ ...c, formulier: { status: 'niet' } }, null, inst, dag(2026, 11, 6)).advies.besluit, 'formulier');
  const B = beoordeelVoertuig({ ...c, formulier: { status: 'niet' } }, null, inst, dag(2026, 11, 6)); assert.equal(B.signalen.find(s => s.id === 'formulier').actie.act, 'formulierVragen');
  // gevonden in de werkplaats: nog niet bekend wie reed; niet aan een chauffeur toeschrijven tot de navraag
  const w = { ...c, chauffeur: null, chauffeurNaam: null, vermoedelijk: { id: 'C-02', naam: 'Jan D.' }, fase: 'onbekend', melding: { door: 'werkplaats' }, formulier: { status: 'niet' }, eigenVoertuig: 'BT-23' };
  const Bw = beoordeelVoertuig(w, null, inst, dag(2026, 11, 6)); assert.equal(Bw.advies.besluit, 'werkplaats'); assert.equal(Bw.signalen.find(s => s.id === 'formulier').actie.act, 'koppelChauffeur');
  assert.ok(!besluitenVoor('eigen', w).some(x => x[0] === 'formulier'), 'geen formulier vragen zolang niet bekend is wie reed');
  assert.ok(!besluitenVoor('eigen', c).some(x => x[0] === 'formulier'), 'geen formulier vragen als het er al is');
});
test('aanrijschade derde: de telematica beslist of het ons voertuig was; zelf geen aansprakelijkheid erkennen', () => {
  const c = { categorie: 'derde', gebied: 'bumper_voor', soort: 'deuk', fase: 'rijden', bedragGevraagd: 1240, melding: { door: 'tegenpartij' }, formulier: { status: 'ontvangen', op: dag(2026, 11, 3) }, gps: { gevonden: true, voertuig: 'BT-23', tijd: dag(2026, 11, 3, 14), afstand: 18, snelheid: 4, richting: 'achteruit' }, tegenpartij: { wat: 'geparkeerd', aanwezig: false }, bewijsTegenpartij: 'camera' };
  const B = beoordeelVoertuig(c, null, inst, dag(2026, 11, 6)); assert.equal(B.advies.besluit, 'wa'); assert.ok(B.signalen.some(s => s.id === 'aansprakelijkheid'));
  // niet van ons volgens de telematica: afwijzen, tenzij de tegenpartij beelden heeft (dan eerst de beelden)
  assert.equal(beoordeelVoertuig({ ...c, bewijsTegenpartij: 'fotos', gps: { ...c.gps, gevonden: false, afstand: 23000 } }, null, inst, dag(2026, 11, 6)).advies.besluit, 'afwijzen');
  const Bc = beoordeelVoertuig({ ...c, gps: { ...c.gps, gevonden: false, afstand: 23000 } }, null, inst, dag(2026, 11, 6)); assert.equal(Bc.advies.besluit, 'info'); assert.equal(Bc.signalen.find(s => s.id === 'bewijs').kleur, 'let');
  // handmatig ingevoerd: de telematica is nog niet bekeken, en de app verzint geen posities
  const Bh = beoordeelVoertuig({ ...c, gps: null, moment: dag(2026, 11, 5, 14) }, null, inst, dag(2026, 11, 6)); assert.equal(Bh.advies.besluit, 'info'); assert.equal(Bh.signalen.find(s => s.id === 'gps').actie.act, 'telematica');
  assert.equal(beoordeelVoertuig({ ...c, bedragGevraagd: 300 }, null, inst, dag(2026, 11, 6)).advies.besluit, 'erkennen');
  assert.equal(beoordeelVoertuig({ ...c, formulier: { status: 'gevraagd', op: dag(2026, 11, 4) } }, null, inst, dag(2026, 11, 6)).advies.besluit, 'formulier');
});
test('besluiten per soort, eigen kosten per polis, diverse schade telt niet voor de chauffeur', () => {
  assert.deepEqual(besluitenVoor('eigen').map(x => x[0]), ['werkplaats', 'extern', 'casco', 'formulier', 'expert']);
  assert.ok(!besluitenVoor('derde').some(x => ['tegenvoorstel', 'expert'].includes(x[0])), 'bij een derde onderhandelt de WA-verzekeraar');
  assert.ok(!besluitenVoor('divers').some(x => x[0] === 'afwijzen')); assert.equal(besluitNaam('erkennen', 'divers'), 'Voor eigen rekening');
  // de uitkomst in vijf groepen: een herstel in onze werkplaats telt mee
  assert.equal(uitkomstGroep({ besluit: 'werkplaats' }), 'werkplaats'); assert.equal(uitkomstGroep({ besluit: null }), 'open'); assert.equal(Object.keys(UITKOMST).length, 5);
  assert.ok(besluitenVoor('derde').some(x => x[0] === 'wa') && !besluitenVoor('derde').some(x => x[0] === 'casco'));
  assert.equal(Object.keys(CATEGORIEN).length, 4);
  assert.equal(eigenKosten('verzekeraar', 9800, inst, 'eigen'), inst.cascoEigenRisico); assert.equal(eigenKosten('verzekeraar', 2400, inst, 'derde'), inst.waEigenRisico); assert.equal(eigenKosten('werkplaats', 640, inst, 'eigen'), 640);
  assert.ok(!teltVoorChauffeur({ categorie: 'divers', status: 'erkend' })); assert.ok(teltVoorChauffeur({ categorie: 'eigen', status: 'werkplaats' }));
});
