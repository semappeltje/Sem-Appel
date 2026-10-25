// De oefendag (Control Tower 4.0): een vaste drukke dag om mee te oefenen. Aan met ?scenario=druk in de adresbalk of met de
// schakelaar onder Instellingen; standaard uit. Zonder de schakelaar is de dag precies de gewone dag (tests/data-check.mjs).
// Alles is gesimuleerd en loopt elke keer hetzelfde: dezelfde zieke chauffeurs, dezelfde file, hetzelfde dock en dezelfde
// oplegger (vaste regels in src/fleet.js, geen toeval). Tijden in minuten na middernacht.
//
// De vorm is die van echte meldingen, zodat een echte bron hem later vult zonder dat de rekenregels veranderen:
//   ziek      uit het rooster of de verzuimregistratie (AFAS, Dyflexis): standplaats, moment van de melding, welke diensten;
//   file      uit NDW (Nationaal Dataportaal Wegverkeer) of een verkeersdienst: weg, vak, richting, begin, eind, vertraging;
//   dock      uit de hal of het onderhoudssysteem: standplaats, dock, van, tot, reden;
//   koeling   uit de telematica van de koelunit (Thermo King, Carrier): oplegger, temperatuur, doel, moment.
// Wat de app ervan maakt (welke diensten open komen, welke ritten vertraagd zijn, welk dock en welke oplegger) staat na het
// laden in fleet.scenario, met de aantallen, zodat de interface en de tests het kunnen tonen en controleren.
export const OEFENDAGEN = {
  druk: {
    id: 'druk',
    naam: 'Oefendag: een drukke dag',
    kort: 'Oefendag',
    uitleg: 'Een gesimuleerde drukke dag om mee te oefenen. De gewone dag blijft zoals hij is; je acties op de oefendag worden apart bewaard.',
    verstoringen: [
      // twee winkeldiensten van Wognum die tussen 05:15 en 06:30 zouden beginnen (de keuze: vast, op naam)
      { soort: 'ziek', id: 'ziek-wognum', standplaats: 'Wognum', om: 270, aantal: 2, start: [315, 390],
        tekst: 'Twee chauffeurs van Wognum om 04:30 ziek gemeld; hun ritten staan bij de open ritten' },
      // het vak tussen Purmerend en Hoorn: de snelweg (klasse 0, geen afrit) binnen dit kader is de A7
      { soort: 'file', id: 'file-a7', weg: 'A7', van: 390, tot: 525, richting: 'zuid', vertraging: [25, 40],
        vak: { lon: [4.93, 5.05], lat: [52.52, 52.655] },
        tekst: 'File op de A7 tussen Hoorn en Purmerend, richting Purmerend, van 06:30 tot 08:45', oorzaak: 'file op de A7 tussen Hoorn en Purmerend' },
      // het drukste dock van Wognum in die uren
      { soort: 'dock', id: 'dock-wognum', standplaats: 'Wognum', van: 420, tot: 660, reden: 'deur defect',
        tekst: 'Een dock op Wognum buiten gebruik van 07:00 tot 11:00 (deur defect)' },
      // de eerste koeloplegger van Wognum die tussen 06:00 en 08:00 aan een winkelrit wordt gekoppeld
      { soort: 'koeling', id: 'koel-wognum', standplaats: 'Wognum', van: 360, tot: 480, temp: 9,
        tekst: 'Koelunit van een koeloplegger van Wognum haalt het doel niet' },
    ],
  },
};
export const oefendagVan = id => OEFENDAGEN[id] || null;
