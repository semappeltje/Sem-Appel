// Eén begrippenlijst voor de hele control tower: wat een woord betekent als er een getal voor staat. Het Overzicht (de
// briefing en de cijfers), de filterbalk van de kaart, het standplaatspaneel en Open ritten tellen met dezelfde betekenis;
// tests/ui-check.mjs (J11) vergelijkt de getallen. De filterbalk toont de zin bij aanwijzen en bij focus.
export const BEGRIPPEN = [
  { k: 'onderweg', n: 'Onderweg', uitleg: 'Rijdt volgens plan: de volgende stop komt binnen zijn tijdvenster.' },
  { k: 'vertraagd', n: 'Vertraagd', uitleg: 'Rijdt achter op plan. Pas een zaak als een stop daardoor na zijn tijdvenster komt.' },
  { k: 'klant', n: 'Bij klant', uitleg: 'Staat bij een winkel of DC: laden, lossen, wisselen of wachten op een dock.' },
  { k: 'optijd', n: 'Op tijd', uitleg: 'Het deel van de stops van vandaag dat binnen zijn tijdvenster aankwam, geteld bij aankomst.' },
  { k: 'telaat', n: 'Te laat', uitleg: 'Een stop die na het einde van zijn tijdvenster aankwam, in hele minuten zoals de klok ze toont.' },
  { k: 'gemist', n: 'Gemist', uitleg: 'Een open rit van vandaag die na zijn laadvenster niemand reed. Hij blijft gemist, ook als hij morgen als eerste gaat.' },
];
export const begrip = k => BEGRIPPEN.find(b => b.k === k) || null;
// de zin voor een hint: het woord vet, de uitleg erachter met een kleine letter
export const hintHtml = (k, esc) => { const b = begrip(k); return b ? `<b>${esc(b.n)}</b> ${esc(b.uitleg.charAt(0).toLowerCase() + b.uitleg.slice(1))}` : ''; };
