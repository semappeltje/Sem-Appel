// De stand van de voertuigen in een zin, met de begrippen van het Overzicht en de filterbalk van de kaart: onderweg rijdt
// volgens plan, vertraagd rijdt achter op plan; bij een klant, met pauze en op het terrein tellen apart, en niets telt
// dubbel. Voor de vaste antwoorden van de Assistent (assistent.js). Zonder imports, zodat tests/assistent-check.mjs hem
// zonder browser toetst.
const getal = x => Math.round(+x || 0).toLocaleString('nl-NL');
export function standTekst(c, { voertuigen = false } = {}) {
  const on = Math.round(+c.onderweg || 0);
  const delen = [`${getal(on)}${voertuigen ? ` ${on === 1 ? 'voertuig' : 'voertuigen'}` : ''} onderweg`, `${getal(c.vertraagd)} vertraagd`, `${getal(c.klant)} bij een klant`, `${getal(c.pauze)} met pauze`, `${getal(c.terrein)} op het terrein`];
  return `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`;
}
