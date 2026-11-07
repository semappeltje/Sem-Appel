import test from 'node:test';
import assert from 'node:assert/strict';
import { leesMail, leesCsv, leesRittenExport, voorbeeldCsv } from '../src/intake.js';

test('leesMail haalt kenteken, datum, bedrag, plek en soort uit een gewone mail', () => {
  const m = leesMail(`Hoi,\n\nJullie hebben 14 okt 2026 een Volkswagen Polo (wit) bij ons opgehaald, kenteken RV-743-J. Er zit een stoeprandschade op de velg rechtsvoor en die zat er bij ons niet op. Offerte van Lakcentrum erbij: € 215,00.\n\nGroet,\nvestigingsmanager, Verhuur Kustlijn`, { nu: new Date(2026, 10, 6).getTime() });
  assert.equal(m.kenteken.w, 'RV743J'); assert.ok(m.kenteken.z > 0.9);
  assert.equal(new Date(m.datum.w).getMonth(), 9); assert.equal(new Date(m.datum.w).getDate(), 14);
  assert.equal(m.bedrag.w, 215); assert.equal(m.gebied.w, 'velg_rv'); assert.equal(m.soort.w, 'stoeprand'); assert.equal(m.afzender, 'vestigingsmanager, Verhuur Kustlijn');
});
test('leesMail: formele aansprakelijkstelling, twee kentekens geven twijfel, bedrag met punt', () => {
  const m = leesMail(`Onderwerp: Aansprakelijkstelling transportschade JH-947-S\n\nGeachte heer, mevrouw,\n\nOp 29-10-2026 is de Tesla Model Y met kenteken JH-947-S vervoerd (zie ook ons dossier met kenteken GX-412-N). Bij ontvangst is een kras op de achterbumper vastgesteld. De calculatie bedraagt EUR 1.005.\n\nMet vriendelijke groet,\nschadecoördinator, Westfries Lease`);
  assert.equal(m.kenteken.w, 'JH947S'); assert.ok(m.kenteken.z < 0.8); assert.ok(m.kenteken.noot);
  assert.equal(m.bedrag.w, 1005); assert.equal(m.gebied.w, 'bumper_achter'); assert.equal(m.soort.w, 'kras'); assert.equal(m.onderwerp, 'Aansprakelijkstelling transportschade JH-947-S');
  assert.equal(new Date(m.datum.w).getFullYear(), 2026);
});
test('leesMail zonder kenteken en zonder bedrag geeft lege velden, geen fout', () => {
  const m = leesMail('Er is een deuk in de deur van de auto die jullie gisteren brachten.');
  assert.equal(m.kenteken.w, null); assert.equal(m.bedrag.w, null); assert.equal(m.soort.w, 'deuk'); assert.equal(m.gebied.w, 'portier_lv');
});
test('leesCsv: puntkomma en komma, aanhalingstekens met scheidingsteken erin', () => {
  assert.deepEqual(leesCsv('a;b\n1;"x;y"\n'), [['a', 'b'], ['1', 'x;y']]);
  assert.deepEqual(leesCsv('a,b\r\n"1,5",2'), [['a', 'b'], ['1,5', '2']]);
});
test('leesRittenExport leest het voorbeeld en meldt wat niet klopt', () => {
  const r = leesRittenExport(voorbeeldCsv(), { nu: new Date(2026, 10, 6).getTime() });
  assert.equal(r.ritten.length, 2); assert.equal(r.fouten.length, 0); assert.equal(r.ritten[0].kenteken, 'GX412N'); assert.equal(r.ritten[0].chauffeurNaam, 'Kees B.'); assert.equal(new Date(r.ritten[0].ophaal).getDate(), 2);
  const slecht = leesRittenExport('kenteken;ophaal\nGX-412-N;gisteren\nXX;2026-11-01\n');
  assert.equal(slecht.ritten.length, 0); assert.equal(slecht.fouten.length, 2);
  const zonder = leesRittenExport('merk;model\nVW;Polo\n'); assert.ok(zonder.fouten[0].includes('kenteken'));
});
