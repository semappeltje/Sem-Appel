// Het conceptantwoord aan de tegenpartij: een mail met de bewijsstukken, per besluit een andere opbouw. In de demo uit
// vaste zinnen; in de echte versie schrijft een taalmodel dit op basis van dezelfde feiten (de signalen van de
// beoordeling), en leest de behandelaar het na voordat het de deur uit gaat. Geen namen van personen: de mail is
// gericht aan de rol die schreef.
import { GEBIEDEN, SOORTEN, ERNST, TEGENPARTIJ, fmtEur, fmtDatumJ, fmtDatumTijd, kentekenToon } from './regels.js';

export function conceptAntwoord(c, r, B, besluit, inst, bedrag) {
  if (c.categorie && c.categorie !== 'lading') return conceptVoertuig(c, r, B, besluit, inst, bedrag);
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

// ---------- aanrijschade en diverse schade ----------
// Het pakket voor de verzekeraar: welke stukken er per soort schade bij horen, en welke er al zijn.
export function pakket(c, r) {
  const f = c.formulier || {}; const fotos = (c.bijlagen || []).filter(b => b.soort === 'foto').length; const video = (c.bijlagen || []).some(b => b.soort === 'video');
  if (c.categorie === 'eigen') return [
    { n: 'Schadeformulier van de chauffeur', ok: f.status === 'ontvangen' },
    { n: `Foto's van de schade (${fotos})`, ok: fotos > 0 },
    { n: c.calculatie && /offerte/.test(c.calculatie.bedrijf) ? 'Offerte van het herstelbedrijf' : 'Raming van de werkplaats', ok: !!c.calculatie },
    { n: 'Plaats en moment (telematica)', ok: !!c.moment },
    { n: 'Kenteken en polisnummer van het voertuig', ok: !!c.kenteken },
  ];
  if (c.categorie === 'derde') return [
    { n: c.formulier && c.formulier.soort === 'europees' ? 'Europees schadeformulier' : 'Schadeformulier van de chauffeur', ok: f.status === 'ontvangen' },
    { n: 'Aansprakelijkstelling of melding van de tegenpartij', ok: !!c.mail },
    { n: video ? 'Camerabeelden van de tegenpartij' : `Foto's van de tegenpartij (${fotos})`, ok: video || fotos > 0 },
    { n: 'Offerte van de schade', ok: !!c.calculatie },
    { n: 'Telematica: ons voertuig op plaats en tijd', ok: !!(c.gps && c.gps.gevonden) },
    { n: 'Gegevens van de tegenpartij', ok: !!(c.tegenpartij && c.tegenpartij.naam) },
  ];
  return [
    { n: 'Vrachtbrief of ritopdracht', ok: !!r },
    { n: 'Ophaalinspectie met foto\'s', ok: !!(r && r.fotos && r.fotos.some(x => x.moment === 'ophaal')) },
    { n: 'Afleverbon met handtekening', ok: !!r },
    { n: 'Aansprakelijkstelling', ok: !!c.mail },
    { n: 'Calculatie', ok: !!c.calculatie },
  ];
}
// Wat de tegenpartij was, als het geen auto is, in een gewone zin: "een hek van Bedrijf in Apeldoorn".
const OBJECT_WOORD = { hek: 'hek of slagboom', gebouw: 'gebouw of laadperron', paal: 'paal of verkeersbord' };
// De mail aan de verzekeraar, met het pakket als bijlagen.
export function mailVerzekeraar(c, r, inst) {
  const polis = c.categorie === 'eigen' ? 'casco' : c.categorie === 'derde' ? 'WA' : 'vervoerdersaansprakelijkheid';
  const er = c.categorie === 'eigen' ? inst.cascoEigenRisico : c.categorie === 'derde' ? inst.waEigenRisico : inst.eigenRisico;
  const stukken = pakket(c, r).filter(x => x.ok).map(x => `- ${x.n}`).join('\n');
  const wat = c.categorie === 'eigen' ? `schade aan ons eigen voertuig ${c.eigenVoertuig}${c.oplegger && /oplegger|bovendek|oprijplaten|achterlicht/.test(c.gebied) ? ` (oplegger ${c.oplegger})` : ''}, kenteken ${kentekenToon(c.kenteken)}` : c.categorie === 'derde' ? `schade aan ${c.tegenpartij ? (c.tegenpartij.wat === 'geparkeerd' || c.tegenpartij.wat === 'rijdend' ? `de auto van een ${c.tegenpartij.partij === 'particulier' ? 'particulier' : 'bedrijf'}${c.kenteken ? ` (${kentekenToon(c.kenteken)})` : ''}` : `een ${OBJECT_WOORD[c.tegenpartij.wat] || 'object'} van ${c.tegenpartij.naam}`) : 'een derde'}, veroorzaakt door ons voertuig ${c.eigenVoertuig || ''}` : `transportschade aan de ${c.voertuig.merk} ${c.voertuig.model} (${kentekenToon(c.kenteken)})`;
  const moment = c.moment ? `${fmtDatumTijd(c.moment)}, ${c.plaats || ''}` : r ? `${fmtDatumTijd(r.aflever)}, ${r.naar.plaats}` : '';
  return {
    aan: `de ${polis}verzekeraar`, onderwerp: `Schademelding ${polis}: ${c.id}${c.kenteken ? `, ${kentekenToon(c.kenteken)}` : ''}`,
    tekst: `Geachte heer, mevrouw,\n\nHierbij melden wij ${wat}.\n\nMoment en plaats: ${moment}\nChauffeur: bekend bij ons (personeelsnummer ${c.chauffeur || 'volgt'})\nSchade: ${GEBIEDEN[c.gebied] ? GEBIEDEN[c.gebied].toLowerCase() : ''}, ${SOORTEN[c.soort] ? SOORTEN[c.soort].toLowerCase() : ''}\nBedrag: ${c.bedragGevraagd ? fmtEur(c.bedragGevraagd) : 'volgt'}${c.categorie === 'derde' ? ' (gevraagd door de tegenpartij)' : ''}\nEigen risico volgens de polis: ${fmtEur(er)}\n\nIn de bijlage:\n${stukken}\n\n${c.categorie === 'derde' ? 'Wij hebben de tegenpartij laten weten dat wij de schade bij u melden, en geen aansprakelijkheid erkend.\n\n' : ''}Met vriendelijke groet,\nSchadebehandeling Breedijk Transport\nDossier ${c.id}`,
  };
}
// Het antwoord bij aanrijschade derde en diverse schade, of de werkorder bij eigen schade.
export function conceptVoertuig(c, r, B, besluit, inst, bedrag) {
  const groet = `Met vriendelijke groet,\nSchadebehandeling Breedijk Transport\nDossier ${c.id}`;
  if (c.categorie === 'eigen') {
    if (besluit === 'casco' || besluit === 'verzekeraar') return mailVerzekeraar(c, r, inst);
    if (besluit === 'formulier') return { aan: c.chauffeurNaam || 'de chauffeur', onderwerp: `Schadeformulier ${c.eigenVoertuig}`, tekst: `Hoi ${(c.chauffeurNaam || '').split(' ')[0]},\n\nWil je het schadeformulier invullen voor de schade aan ${c.eigenVoertuig} (${GEBIEDEN[c.gebied].toLowerCase()}) van ${fmtDatumTijd(c.moment)}? Het staat in de app onder Schade. Schrijf erbij wat er gebeurde en waar; je foto's zitten er al bij.\n\nGeen oordeel, we hebben het nodig voor de werkplaats en de verzekering.\n\nSchadebehandeling` };
    return { aan: 'de werkplaats', onderwerp: `Werkorder ${c.werkorder ? c.werkorder.nummer : ''}: ${c.eigenVoertuig}`, tekst: `Werkorder ${c.werkorder ? c.werkorder.nummer : '(nieuw)'}\n\nVoertuig: ${c.eigenVoertuig}${/oplegger|bovendek|oprijplaten|achterlicht/.test(c.gebied) ? ` (oplegger ${c.oplegger})` : ''}, kenteken ${kentekenToon(c.kenteken)}\nSchade: ${GEBIEDEN[c.gebied].toLowerCase()}, ${SOORTEN[c.soort].toLowerCase()}\nRaming: ${fmtEur(bedrag || c.bedragGevraagd)} (${c.calculatie ? `${c.calculatie.uren} uur, onderdelen ${fmtEur(c.calculatie.onderdelen)}` : 'nog te ramen'})\nGemeld door: ${c.chauffeurNaam || 'onbekend'}, ${fmtDatumTijd(c.moment)}\n\n${besluit === 'extern' ? 'Laat herstellen door een herstelbedrijf voor bedrijfswagens; vraag eerst een offerte.' : 'Graag inplannen; laat de planning weten hoeveel dagen het voertuig uit de roulatie is.'}\n\n${groet}` };
  }
  if (c.categorie === 'derde') {
    const formeel = c.opdrachtgever.stijl !== 'kort'; const u = formeel ? 'u' : 'je'; const uw = formeel ? 'uw' : 'je';
    const aanhef = formeel ? 'Geachte heer, mevrouw,' : 'Beste,';
    if (besluit === 'wa' || besluit === 'verzekeraar') return { aan: c.opdrachtgever.naam, onderwerp: `Re: ${c.onderwerp}`, tekst: `${aanhef}\n\nDank voor ${uw} melding. We hebben de schade gemeld bij onze WA-verzekeraar. Die neemt contact met ${u} op over de afhandeling; dat duurt doorgaans twee tot vier weken.\n\nWilt ${u} alvast ${c.calculatie ? 'de offerte' : 'een offerte van de schade'}${c.bewijsTegenpartij === 'camera' ? ' en de camerabeelden' : ''} bewaren? De verzekeraar vraagt daar mogelijk om.\n\n${groet}` };
    if (besluit === 'afwijzen') return { aan: c.opdrachtgever.naam, onderwerp: `Re: ${c.onderwerp}`, tekst: `${aanhef}\n\nDank voor ${uw} melding. We hebben het nagekeken in de gegevens van onze boordcomputers. Op ${fmtDatumTijd(c.gps.tijd)} was geen voertuig van Breedijk Transport op of bij de genoemde plek; ons dichtstbijzijnde voertuig was ${c.gps.afstand >= 1000 ? `${(c.gps.afstand / 1000).toFixed(1).replace('.', ',')} km` : `${c.gps.afstand} m`} verderop.\n\nHeeft ${u} een kenteken of beelden waarop ons voertuig te zien is, dan kijken we graag opnieuw.\n\n${groet}` };
    if (besluit === 'erkennen') return { aan: c.opdrachtgever.naam, onderwerp: `Re: ${c.onderwerp}`, tekst: `${aanhef}\n\nDank voor ${uw} melding. We vergoeden de schade van ${fmtEur(bedrag || c.bedragGevraagd)}. Stuur de factuur onder vermelding van ons dossiernummer; we betalen binnen dertig dagen.\n\n${groet}` };
    if (besluit === 'formulier') return { aan: c.chauffeurNaam || 'de chauffeur', onderwerp: `Schadeformulier: ${TEGENPARTIJ[c.tegenpartij.wat].toLowerCase()} in ${c.plaats}`, tekst: `Hoi ${(c.chauffeurNaam || '').split(' ')[0]},\n\nEr is een melding binnengekomen over ${c.voertuig.merk ? `een ${TEGENPARTIJ[c.tegenpartij.wat].toLowerCase()}` : 'schade'} in ${c.plaats}, op ${fmtDatumTijd(c.moment)}. Volgens de boordcomputer stond ${c.eigenVoertuig} daar toen. Weet je er iets van? Wil je het schadeformulier in de app invullen?\n\nGeen oordeel, we willen het goed doorgeven aan de verzekering.\n\nSchadebehandeling` };
    return { aan: c.opdrachtgever.naam, onderwerp: `Re: ${c.onderwerp}`, tekst: `${aanhef}\n\nDank voor ${uw} melding. Om het te kunnen nakijken hebben we nog nodig: de precieze plaats en het tijdstip, foto's van de schade${c.calculatie ? '' : ' en een offerte'}${c.bewijsTegenpartij === 'camera' ? ', en de camerabeelden' : ''}.\n\n${groet}` };
  }
  // diverse schade
  if (c.gebied === 'sleutel' && c.opdrachtgever && c.opdrachtgever.id !== 'K-00') return { aan: c.opdrachtgever.naam, onderwerp: `Sleutel ${c.voertuig.merk} ${c.voertuig.model} ${kentekenToon(c.kenteken)}`, tekst: `Beste ${c.opdrachtgever.rol} van ${c.opdrachtgever.naam},\n\nBij het lossen van de ${c.voertuig.merk} ${c.voertuig.model} (${kentekenToon(c.kenteken)}) is de sleutel zoekgeraakt. Is er een reservesleutel? Zo niet, dan laten we een nieuwe maken op onze kosten.\n\n${groet}` };
  return { aan: 'de administratie', onderwerp: `Diverse schade ${c.id}`, tekst: `${GEBIEDEN[c.gebied]}: ${SOORTEN[c.soort].toLowerCase()}, ${fmtEur(bedrag || c.bedragGevraagd)}, voor eigen rekening.\n\n${groet}` };
}
