// Het conceptantwoord aan de tegenpartij: een mail met de bewijsstukken, per besluit een andere opbouw. In de demo uit
// vaste zinnen; in de echte versie schrijft een taalmodel dit op basis van dezelfde feiten (de signalen van de
// beoordeling), en leest de behandelaar het na voordat het de deur uit gaat. Geen namen van personen: de mail is
// gericht aan de rol die schreef.
import { GEBIEDEN, SOORTEN, ERNST, fmtEur, fmtDatumJ, fmtDatumTijd, kentekenToon } from './regels.js';

export function conceptAntwoord(c, r, B, besluit, inst, bedrag) {
  const kt = kentekenToon(c.kenteken); const auto = `${c.voertuig.merk} ${c.voertuig.model}`; const k = c.opdrachtgever;
  const formeel = k.stijl !== 'kort'; const u = formeel ? 'u' : 'jullie'; const uw = formeel ? 'uw' : 'jullie';
  const aanhef = formeel ? 'Geachte heer, mevrouw,' : 'Hoi,';
  const groet = `Met vriendelijke groet,\nSchadebehandeling Breedijk Transport\nDossier ${c.id}`;
  const onderwerp = `Re: ${c.onderwerp}`;
  const plek = `${SOORTEN[c.soort].toLowerCase()} op de ${GEBIEDEN[c.gebied].toLowerCase()}`;
  const bewijs = [];
  if (r) {
    const eerder = r.inspectieOphaal.filter(s => s.gebied === c.gebied || B.signalen.find(x => x.id === 'eerder' && x.kleur === 'ok'));
    const fotos = r.fotos.filter(f => f.moment === 'ophaal' && (B.signalen.find(x => x.id === 'eerder') || {}).fotos?.includes(f.id));
    if (B.eerder) bewijs.push(`de ophaalinspectie van ${fmtDatumTijd(r.ophaal)} (${r.van.plaats}), waarop de chauffeur deze plek al noteerde: ${eerder.map(s => `${GEBIEDEN[s.gebied].toLowerCase()}, ${SOORTEN[s.soort].toLowerCase()}, ${ERNST[s.ernst]}`).join('; ')}`);
    if (fotos.length) bewijs.push(`${fotos.length === 1 ? 'de foto' : `${fotos.length} foto's`} van die plek bij ophalen (${fotos.map(f => `${f.id}, ${fmtDatumTijd(f.tijd)}`).join('; ')}), als bijlage`);
    if (B.getekend && !r.aflevering.eigen) bewijs.push(`de afleverbon van ${fmtDatumTijd(r.aflever)} (${r.naar.plaats}), door ${uw} ${r.aflevering.rol} getekend zonder voorbehoud`);
    if (B.termijn === false) bewijs.push(`de datum van ${uw} melding, ${B.dagenNaRit} dagen na aflevering; voor zichtbare schade geldt melden bij aflevering, voor niet zichtbare schade ${inst.meldtermijnDagen} dagen`);
    if (!bewijs.length) bewijs.push(`onze ophaalinspectie van ${fmtDatumTijd(r.ophaal)} en de foto's van die dag, als bijlage`);
  }
  let tekst;
  if (besluit === 'afwijzen') {
    tekst = !r
      ? `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt}. We hebben dit kenteken in onze planning gezocht rond de genoemde datum en vinden geen rit van ons. ${formeel ? 'Kunt u' : 'Kunnen jullie'} de vrachtbrief of het ordernummer sturen? Zonder een rit van Breedijk kunnen we de schade niet in behandeling nemen.\n\n${groet}`
      : `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt} (${plek}). We hebben de rit van ${fmtDatumJ(r.ophaal)} nagekeken. We wijzen de claim af, op grond van:\n\n${bewijs.map(b => `- ${b}`).join('\n')}\n\n${B.eerder ? `De schade was dus al aanwezig toen wij de auto meenamen${B.getekend ? ', en bij aflevering is er niets over opgemerkt' : ''}.` : B.getekend && !r.aflevering.eigen ? 'Bij aflevering is de auto zonder opmerking in ontvangst genomen; wij kunnen de schade niet aan ons vervoer toeschrijven.' : 'Wij kunnen de schade niet aan ons vervoer toeschrijven.'} ${formeel ? 'Mocht u andere stukken hebben' : 'Mochten jullie andere stukken hebben'}, dan kijken we daar graag naar.\n\n${groet}`;
  } else if (besluit === 'erkennen' || besluit === 'verzekeraar') {
    tekst = `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt} (${plek}). We hebben de rit van ${fmtDatumJ(r.ophaal)} nagekeken${r.aflevering.voorbehoud ? ` en zien dat ${uw} ${r.aflevering.rol} de schade bij aflevering heeft genoteerd` : ''}. We nemen de schade voor onze rekening${besluit === 'verzekeraar' ? ' en hebben het dossier bij onze verzekeraar ingediend' : ''}.\n\nBedrag: ${fmtEur(bedrag)}${B.limiet && bedrag >= B.limiet ? ` (de limiet van de vervoerscondities voor dit voertuig: ${fmtEur(B.limiet)})` : ''}.${besluit === 'verzekeraar' ? ' De verzekeraar neemt contact op over de afwikkeling; dat duurt doorgaans twee tot vier weken.' : ' Stuur de factuur onder vermelding van ons dossiernummer; we betalen binnen dertig dagen.'}\n\n${groet}`;
  } else if (besluit === 'tegenvoorstel') {
    const cal = c.calculatie; const punten = [];
    if (cal && cal.uurtarief > inst.normUurtarief * 1.15) punten.push(`een uurtarief van ${fmtEur(cal.uurtarief)}; wij rekenen met ${fmtEur(inst.normUurtarief)}, het tarief dat onze verzekeraar hanteert`);
    if (cal && cal.vervangen && c.ernst <= 3) punten.push(`vervangen van het onderdeel; bij een schade van deze omvang (${ERNST[c.ernst]}) is herstellen gebruikelijk`);
    if (cal && cal.dubbel) punten.push('spuitwerk dat ook in de onderdelenregel zit');
    if (cal && cal.btw && k.btwAftrek) punten.push(`btw, die ${u} als ondernemer ${formeel ? 'kunt' : 'kunnen'} verrekenen`);
    tekst = `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt} (${plek}) en de calculatie van ${cal ? cal.bedrijf : 'het herstelbedrijf'}. We erkennen de schade. Over de calculatie hebben we een paar opmerkingen:\n\n${punten.map(p => `- ${p}`).join('\n')}\n\nOns voorstel: ${fmtEur(bedrag)}. ${formeel ? 'Gaat u akkoord' : 'Gaan jullie akkoord'}, dan betalen we binnen dertig dagen na de factuur.\n\n${groet}`;
  } else if (besluit === 'info') {
    tekst = `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt}. Om de claim te kunnen beoordelen hebben we nog nodig:\n\n${!c.calculatie ? '- een gespecificeerde calculatie (arbeid, onderdelen, lak en materiaal)\n' : ''}- foto's van de schade met datum en tijd\n${!r ? '- de vrachtbrief of het ordernummer van de rit\n' : ''}\nZodra we die hebben, reageren we binnen ${inst.antwoordWerkdagen} werkdagen.\n\n${groet}`;
  } else {
    tekst = `${aanhef}\n\nDank voor de melding over de ${auto} met kenteken ${kt}. We hebben de claim in behandeling en komen binnen ${inst.antwoordWerkdagen} werkdagen bij ${u} terug.\n\n${groet}`;
  }
  return { onderwerp, tekst };
}

// de vraag aan de chauffeur (kort, zonder oordeel)
export function vraagChauffeur(c, r) {
  return `Hoi ${r.chauffeurNaam.split(' ')[0]},\n\n${c.opdrachtgever.naam} meldt een ${SOORTEN[c.soort].toLowerCase()} op de ${GEBIEDEN[c.gebied].toLowerCase()} van de ${c.voertuig.merk} ${c.voertuig.model} (${kentekenToon(c.kenteken)}) die je op ${fmtDatumJ(r.ophaal)} van ${r.van.plaats} naar ${r.naar.plaats} reed (${r.truck}, positie ${r.positie}). Weet je nog iets van deze auto? Is er iets gebeurd bij het laden of lossen? Je foto's van die dag staan in het dossier.\n\nGeen oordeel, we willen het alleen goed op een rij hebben.\n\nSchadebehandeling`;
}
