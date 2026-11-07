// Schadeportaal: de pure regels van de beoordeling. Geen DOM, geen opslag, geen verzoeken. Alles wat hier staat is
// te testen zonder browser (tests/regels.test.mjs) en straks een op een over te zetten naar een server.
//
// De getallen komen uit de instellingen (src/instellingen.js), nooit hardgecodeerd: Breedijk noemde in het gesprek
// 1.750 euro (daarboven verzekeringswerk) en 750 euro eigen risico; de limiet per kilogram is die van de AVC 2002
// (3,40 euro per kilogram, laten toetsen), de termijnen die van AVC en CMR (zichtbare schade bij aflevering, niet
// zichtbare binnen zeven dagen; laten toetsen). Signalen, geen juridisch advies.

export const STATUS = {
  nieuw: { n: 'Nieuw', k: 'nieuw', uitleg: 'Binnengekomen, nog niet bekeken.' },
  onderzoek: { n: 'In onderzoek', k: 'onderzoek', uitleg: 'Een behandelaar kijkt ernaar.' },
  wacht_tegenpartij: { n: 'Wacht op tegenpartij', k: 'wacht', uitleg: 'We hebben een vraag of voorstel gestuurd.' },
  wacht_chauffeur: { n: 'Wacht op chauffeur', k: 'wacht', uitleg: 'De chauffeur is om een toelichting gevraagd.' },
  wacht_expert: { n: 'Wacht op expertise', k: 'wacht', uitleg: 'Een expert kijkt naar de auto of de calculatie.' },
  verzekeraar: { n: 'Bij verzekeraar', k: 'verzekeraar', uitleg: 'Gemeld bij de verzekeraar; wij betalen het eigen risico.' },
  werkplaats: { n: 'In herstel', k: 'werkplaats', uitleg: 'Het voertuig wordt hersteld, in onze werkplaats of bij een herstelbedrijf.' },
  erkend: { n: 'Erkend', k: 'erkend', uitleg: 'We nemen de schade (deels) voor onze rekening.' },
  afgewezen: { n: 'Afgewezen', k: 'afgewezen', uitleg: 'Afgewezen met bewijs; de tegenpartij heeft dat gelezen of reageert niet meer.' },
  gesloten: { n: 'Gesloten', k: 'gesloten', uitleg: 'Betaald, verrekend of geschikt.' },
};
export const OPEN_STATUS = ['nieuw', 'onderzoek', 'wacht_tegenpartij', 'wacht_chauffeur', 'wacht_expert', 'verzekeraar', 'werkplaats'];
// De soorten schade, zoals Breedijk ze onderscheidt (gesprek, 7 november): ladingsschade (een auto die wij vervoeren),
// aanrijschade aan ons eigen materieel, aanrijschade aan een derde (wij raakten iets of iemand anders) en diverse
// schade (sleutel, booster, laadmateriaal). Elke soort hoort bij een andere polis en een andere afhandeling.
export const CATEGORIEN = {
  lading: { n: 'Ladingsschade', kort: 'Lading', uitleg: 'Schade aan een auto die wij vervoeren', polis: 'vervoerdersaansprakelijkheid' },
  eigen: { n: 'Aanrijschade eigen voertuig', kort: 'Eigen voertuig', uitleg: 'Schade aan onze vrachtwagen of oplegger', polis: 'casco' },
  derde: { n: 'Aanrijschade derde', kort: 'Derde', uitleg: 'Ons voertuig raakte iets of iemand anders', polis: 'WA' },
  divers: { n: 'Diverse schade', kort: 'Divers', uitleg: 'Sleutel, booster of laadmateriaal kwijt of kapot', polis: 'eigen kosten' },
};
export const BESLUITEN = {
  afwijzen: { n: 'Afwijzen met bewijs', status: 'afgewezen', cat: ['lading', 'derde', 'divers'] },
  erkennen: { n: 'Erkennen, zelf betalen', status: 'erkend', cat: ['lading', 'derde', 'divers'] },
  verzekeraar: { n: 'Erkennen, indienen bij verzekeraar', status: 'verzekeraar', cat: ['lading'] },
  wa: { n: 'Melden bij de WA-verzekeraar', status: 'verzekeraar', cat: ['derde'] },
  werkplaats: { n: 'Herstellen in onze werkplaats', status: 'werkplaats', cat: ['eigen'] },
  extern: { n: 'Laten herstellen bij een herstelbedrijf', status: 'werkplaats', cat: ['eigen'] },
  casco: { n: 'Melden bij de cascoverzekeraar', status: 'verzekeraar', cat: ['eigen'] },
  tegenvoorstel: { n: 'Tegenvoorstel', status: 'wacht_tegenpartij', cat: ['lading', 'derde'] },
  info: { n: 'Meer informatie vragen', status: 'wacht_tegenpartij', cat: ['lading', 'derde', 'divers'] },
  chauffeur: { n: 'Chauffeur om toelichting vragen', status: 'wacht_chauffeur', cat: ['lading', 'divers'] },
  formulier: { n: 'Schadeformulier van de chauffeur vragen', status: 'wacht_chauffeur', cat: ['eigen', 'derde'] },
  expert: { n: 'Expertise aanvragen', status: 'wacht_expert', cat: ['lading', 'eigen', 'derde'] },
};
export const besluitenVoor = cat => Object.entries(BESLUITEN).filter(([, b]) => b.cat.includes(cat || 'lading'));

// Gebieden van de auto, in de geest van de AIAG/ECG-schadecodes (gebied, soort, ernst). De codes zelf zijn van de
// standaard; hier staan onze eigen sleutels met een omschrijving, zodat het diagram en de teksten ze delen.
export const GEBIEDEN = {
  bumper_voor: 'Bumper voor', bumper_achter: 'Bumper achter', motorkap: 'Motorkap', achterklep: 'Achterklep', dak: 'Dak',
  voorruit: 'Voorruit', achterruit: 'Achterruit',
  portier_lv: 'Portier linksvoor', portier_la: 'Portier linksachter', portier_rv: 'Portier rechtsvoor', portier_ra: 'Portier rechtsachter',
  spatbord_lv: 'Spatbord linksvoor', spatbord_la: 'Zijpaneel linksachter', spatbord_rv: 'Spatbord rechtsvoor', spatbord_ra: 'Zijpaneel rechtsachter',
  velg_lv: 'Velg linksvoor', velg_la: 'Velg linksachter', velg_rv: 'Velg rechtsvoor', velg_ra: 'Velg rechtsachter',
  spiegel_l: 'Spiegel links', spiegel_r: 'Spiegel rechts', dorpel_l: 'Dorpel links', dorpel_r: 'Dorpel rechts',
  interieur: 'Interieur', onderzijde: 'Onderzijde',
  // ons materieel: een autotransporter (trekker en oplegger met twee dekken)
  cabine_voor: 'Cabine voorzijde', cabine_l: 'Cabine links', cabine_r: 'Cabine rechts', zijscherm_l: 'Zijscherm links', zijscherm_r: 'Zijscherm rechts',
  oplegger_l: 'Oplegger linkerzijde', oplegger_r: 'Oplegger rechterzijde', bovendek: 'Bovendek', oprijplaten: 'Oprijplaten', achterlicht: 'Achterlichten', band: 'Band of velg',
  // een derde zonder voertuig, en diverse schade
  object: 'Object', sleutel: 'Sleutel', booster: 'Booster of accu', laadmateriaal: 'Laadmateriaal',
};
export const GEBIEDEN_VOOR = {
  lading: ['bumper_voor', 'bumper_achter', 'motorkap', 'achterklep', 'dak', 'voorruit', 'achterruit', 'portier_lv', 'portier_la', 'portier_rv', 'portier_ra', 'spatbord_lv', 'spatbord_la', 'spatbord_rv', 'spatbord_ra', 'velg_lv', 'velg_la', 'velg_rv', 'velg_ra', 'spiegel_l', 'spiegel_r', 'dorpel_l', 'dorpel_r', 'interieur', 'onderzijde'],
  eigen: ['bumper_voor', 'cabine_voor', 'cabine_l', 'cabine_r', 'spiegel_l', 'spiegel_r', 'zijscherm_l', 'zijscherm_r', 'oplegger_l', 'oplegger_r', 'bovendek', 'oprijplaten', 'achterlicht', 'band'],
  derde: ['bumper_voor', 'bumper_achter', 'portier_lv', 'portier_rv', 'portier_la', 'portier_ra', 'spatbord_lv', 'spatbord_rv', 'spatbord_la', 'spatbord_ra', 'spiegel_l', 'spiegel_r', 'object'],
  divers: ['sleutel', 'booster', 'laadmateriaal'],
};
export const TEGENPARTIJ = { geparkeerd: 'Geparkeerde auto', rijdend: 'Auto in het verkeer', hek: 'Hek of slagboom', gebouw: 'Gebouw of laadperron', paal: 'Paal of verkeersbord' };
export const PLAATS = { terrein: 'Op ons terrein', rijden: 'Onderweg', laden: 'Bij een klant, laden', lossen: 'Bij een klant, lossen' };
export const SOORTEN = { kras: 'Kras', deuk: 'Deuk', steenslag: 'Steenslag', barst: 'Barst', schaafplek: 'Schaafplek', lakschade: 'Lakschade', ontbreekt: 'Ontbreekt', gebroken: 'Gebroken', stoeprand: 'Stoeprandschade' };
export const ERNST = { 1: 'tot 2,5 cm', 2: '2,5 tot 7,5 cm', 3: '7,5 tot 15 cm', 4: '15 tot 30 cm', 5: 'meer dan 30 cm', 6: 'vervangen of ontbreekt' };
export const FASEN = { laden: 'Bij het laden', rijden: 'Onderweg', lossen: 'Bij het lossen', terrein: 'Op het terrein', onbekend: 'Niet vast te stellen' };

export const DAG = 86400000;
export const fmtEur = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n));
export const fmtEur2 = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const fmtNum = n => new Intl.NumberFormat('nl-NL').format(n);
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAANDL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
export const fmtDatum = d => { d = new Date(d); return `${d.getDate()} ${MAAND[d.getMonth()]}`; };
export const fmtDatumJ = d => { d = new Date(d); return `${d.getDate()} ${MAAND[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtDatumLang = d => { d = new Date(d); return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDL[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtTijd = d => { d = new Date(d); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fmtDatumTijd = d => `${fmtDatum(d)} ${fmtTijd(d)}`;
export const fmtMaand = d => { d = new Date(d); return `${MAANDL[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtMaandKort = d => MAAND[new Date(d).getMonth()];
export const isoDag = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Werkdagen tussen twee momenten (zonder weekend; feestdagen laten we hier buiten beschouwing, dat is een instelling
// voor later). Positief als `tot` na `van` ligt.
export function werkdagen(van, tot) {
  let a = new Date(van); a.setHours(0, 0, 0, 0); let b = new Date(tot); b.setHours(0, 0, 0, 0);
  const sign = b < a ? -1 : 1; if (sign < 0) [a, b] = [b, a];
  let n = 0; for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return sign * n;
}
export const kalenderdagen = (van, tot) => Math.floor((new Date(tot).setHours(0, 0, 0, 0) - new Date(van).setHours(0, 0, 0, 0)) / DAG);

// Kenteken: normaliseren (zonder streepjes, hoofdletters) en tonen met streepjes volgens de Nederlandse sidecodes die
// we in de simulatie gebruiken. Een echt kenteken uit een mail kan er anders uitzien; de zoekfunctie vergelijkt
// altijd de genormaliseerde vorm.
export const kentekenNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function kentekenToon(s) {
  const k = kentekenNorm(s); if (k.length !== 6) return s;
  const groepen = k.match(/[A-Z]+|[0-9]+/g) || []; return groepen.join('-');
}

// De limiet van de vervoerscondities: bedrag per kilogram maal de massa van het voertuig (AVC: 3,40 euro per
// kilogram; CMR: 8,33 SDR per kilogram, in de instellingen als bedrag in euro). Signaal, laten toetsen.
export const limietPerKg = (massaKg, tariefPerKg) => Math.round(massaKg * tariefPerKg);

// Zijn twee schades "dezelfde plek"? Hetzelfde gebied, of een gebied dat eraan grenst (bumper en spatbord lopen in
// elkaar over; een foto van de hoek toont beide).
const BUREN = {
  bumper_voor: ['spatbord_lv', 'spatbord_rv', 'motorkap'], bumper_achter: ['spatbord_la', 'spatbord_ra', 'achterklep'],
  spatbord_lv: ['bumper_voor', 'portier_lv', 'velg_lv'], spatbord_rv: ['bumper_voor', 'portier_rv', 'velg_rv'],
  spatbord_la: ['bumper_achter', 'portier_la', 'velg_la'], spatbord_ra: ['bumper_achter', 'portier_ra', 'velg_ra'],
  portier_lv: ['portier_la', 'spatbord_lv', 'spiegel_l', 'dorpel_l'], portier_la: ['portier_lv', 'spatbord_la', 'dorpel_l'],
  portier_rv: ['portier_ra', 'spatbord_rv', 'spiegel_r', 'dorpel_r'], portier_ra: ['portier_rv', 'spatbord_ra', 'dorpel_r'],
  motorkap: ['bumper_voor', 'voorruit'], achterklep: ['bumper_achter', 'achterruit'], dak: ['voorruit', 'achterruit'],
};
export const zelfdePlek = (a, b) => a === b || (BUREN[a] || []).includes(b);

// De beoordeling: elke regel geeft een signaal met een kleur (ok, let, slecht, info), een korte zin en een uitleg.
// `c` is de claim, `r` de gekoppelde rit of null, `inst` de instellingen, `nu` het moment van beoordelen.
export function beoordeel(c, r, inst, nu) {
  if (c.categorie && c.categorie !== 'lading') return beoordeelVoertuig(c, r, inst, nu);
  const S = [];
  const push = (id, kleur, kort, uitleg, extra) => S.push({ id, kleur, kort, uitleg, ...extra });
  // 1. hebben wij hem vervoerd
  if (!r) {
    push('vervoerd', 'slecht', 'Geen rit gevonden op dit kenteken', 'Niets in Transplan op dit kenteken rond de genoemde datum. Vraag de tegenpartij om de vrachtbrief of het ordernummer; staat het er niet, dan is de schade niet door ons vervoerd.');
    return { signalen: S, advies: { besluit: 'info', reden: 'Eerst vaststellen of wij deze auto vervoerd hebben.' }, eerder: false, getekend: null, termijn: null, limiet: null };
  }
  const dagenNaRit = Math.max(0, Math.round((new Date(c.datumClaim) - new Date(r.aflever)) / DAG));
  push('vervoerd', 'ok', `Vervoerd door ons: rit ${r.id}, ${fmtDatumJ(r.ophaal)}`, `${r.van.plaats} naar ${r.naar.plaats}, chauffeur ${r.chauffeurNaam}, ${r.truck}, positie ${r.positie} op de oplegger. Afgeleverd ${fmtDatumTijd(r.aflever)}.`);
  // 2. stond de schade al op de ophaalinspectie
  // dezelfde plek, of een aangrenzende plek met een vergelijkbare ernst (een krasje op het zijpaneel verklaart geen deuk van
  // dertig centimeter in de bumper)
  const eerder = r.inspectieOphaal.filter(s => s.gebied === c.gebied || (zelfdePlek(s.gebied, c.gebied) && c.ernst <= s.ernst + 1));
  const fotosEerder = r.fotos.filter(f => f.moment === 'ophaal' && zelfdePlek(f.gebied, c.gebied));
  if (eerder.length) push('eerder', 'ok', `Schade op deze plek stond al op de ophaalinspectie`, `Bij ophalen op ${fmtDatumTijd(r.ophaal)} noteerde de chauffeur: ${eerder.map(s => `${GEBIEDEN[s.gebied].toLowerCase()}, ${SOORTEN[s.soort].toLowerCase()} (${ERNST[s.ernst]})`).join('; ')}. ${fotosEerder.length ? `${fotosEerder.length === 1 ? '1 foto' : `${fotosEerder.length} foto's`} van die plek, met tijdstip.` : 'Geen foto van precies die plek; wel de notitie.'}`, { fotos: fotosEerder.map(f => f.id) });
  else if (fotosEerder.length) push('eerder', 'ok', 'Foto van deze plek bij ophalen, zonder schade genoteerd', `${fotosEerder.length === 1 ? '1 foto' : `${fotosEerder.length} foto's`} van ${GEBIEDEN[c.gebied].toLowerCase()} bij ophalen (${fmtDatumTijd(r.ophaal)}). Leg ze naast de foto's van de tegenpartij: staat de schade er niet op, dan is ze daarna ontstaan.`, { fotos: fotosEerder.map(f => f.id) });
  else push('eerder', 'let', 'Geen foto en geen notitie van deze plek bij ophalen', `De ophaalinspectie noemt deze plek niet en er is geen foto van. We kunnen niet aantonen dat de schade er al zat. Vraag de chauffeur wat hij zich herinnert en kijk of een overzichtsfoto de plek toch toont.`);
  // 2b. de keten: ging de auto over het overslagterrein, dan zegt de intake-controle daar op welk stuk de schade ontstond
  if (r.via && r.inspectieTerrein) {
    const opTerrein = r.inspectieTerrein.filter(s => s.gebied === c.gebied || (zelfdePlek(s.gebied, c.gebied) && c.ernst <= s.ernst + 1));
    const fotosT = r.fotos.filter(f => f.moment === 'terrein' && zelfdePlek(f.gebied, c.gebied));
    if (eerder.length && opTerrein.length) push('keten', 'ok', `Bij de intake in ${r.via.plaats} opnieuw genoteerd`, `De controle op het overslagterrein (${fmtDatumTijd(r.via.aankomst)}) noteerde dezelfde plek. Twee controles, zelfde beeld.`, { fotos: fotosT.map(f => f.id) });
    else if (opTerrein.length) push('keten', 'info', `Bij de intake in ${r.via.plaats} al gezien: ontstaan op de aanvoerrit`, `De schade stond niet op de ophaalinspectie maar wel bij de intake op het terrein (${fmtDatumTijd(r.via.aankomst)}). Ze is dus ontstaan tussen ophalen en het terrein: de rit van ${r.chauffeurNaam}.`, { fotos: fotosT.map(f => f.id) });
    else push('keten', 'info', `Bij de intake in ${r.via.plaats} nog niet gezien`, `De controle op het terrein (${fmtDatumTijd(r.via.aankomst)}) noemt deze plek niet. Is de schade van ons, dan ontstond ze op het terrein of bij de uitlevering${r.chauffeur2Naam ? ` (${r.chauffeur2Naam})` : ''}.`, { fotos: fotosT.map(f => f.id) });
  }
  // 3. bij aflevering getekend
  const afl = r.aflevering;
  const inAfl = r.inspectieAflever.filter(s => zelfdePlek(s.gebied, c.gebied));
  if (afl.voorbehoud && inAfl.length) push('getekend', 'slecht', 'Bij aflevering is deze schade al genoteerd', `De ontvanger tekende met voorbehoud: "${afl.tekst}". De schade stond dus bij aflevering op de auto${eerder.length ? ' en was ook al op de ophaalinspectie genoteerd' : ' en is niet op de ophaalinspectie te zien'}.`);
  else if (afl.voorbehoud) push('getekend', 'let', 'Getekend met voorbehoud, over een andere plek', `De ontvanger tekende met voorbehoud: "${afl.tekst}". Dat gaat over ${inAfl.length ? 'deze' : 'een andere'} plek.`);
  else push('getekend', 'ok', 'Bij aflevering getekend zonder voorbehoud', `De ontvanger (${afl.rol}) tekende op ${fmtDatumTijd(r.aflever)} zonder opmerking. Zichtbare schade hoort bij aflevering gemeld te worden; voor niet zichtbare schade geldt een termijn van ${inst.meldtermijnDagen} dagen (AVC en CMR, laten toetsen).`);
  // 4. op tijd gemeld
  const termijnOk = dagenNaRit <= inst.meldtermijnDagen;
  push('termijn', termijnOk ? 'ok' : 'let', termijnOk ? `Gemeld ${dagenNaRit} ${dagenNaRit === 1 ? 'dag' : 'dagen'} na aflevering` : `Gemeld ${dagenNaRit} dagen na aflevering, buiten de termijn van ${inst.meldtermijnDagen} dagen`, termijnOk ? `Binnen de termijn van ${inst.meldtermijnDagen} dagen voor niet zichtbare schade.` : `Een kras of deuk is zichtbare schade en hoort bij aflevering gemeld te worden; niet zichtbare schade binnen ${inst.meldtermijnDagen} dagen. Een late melding verzwakt de claim (laten toetsen).`);
  // 5. het geld
  const limiet = limietPerKg(c.voertuig.massa, inst.tariefPerKg);
  const bedrag = c.bedragGevraagd;
  if (bedrag > limiet) push('limiet', 'let', `Gevraagd ${fmtEur(bedrag)} ligt boven de limiet van ${fmtEur(limiet)}`, `De vervoerscondities beperken onze aansprakelijkheid tot ${fmtEur2(inst.tariefPerKg)} per kilogram; deze auto weegt ${fmtNum(c.voertuig.massa)} kg. Tenzij er opzet of een hogere afspraak is, betalen we hoogstens de limiet (laten toetsen).`);
  else push('limiet', 'info', `Limiet ${fmtEur(limiet)} (${fmtNum(c.voertuig.massa)} kg × ${fmtEur2(inst.tariefPerKg)})`, 'De gevraagde schade blijft onder de limiet van de vervoerscondities.');
  const verzekeraar = bedrag >= inst.drempelVerzekeraar;
  push('drempel', verzekeraar ? 'info' : 'ok', verzekeraar ? `Boven ${fmtEur(inst.drempelVerzekeraar)}: verzekeringswerk, eigen risico ${fmtEur(inst.eigenRisico)}` : `Onder ${fmtEur(inst.drempelVerzekeraar)}: zelf afhandelen`, verzekeraar ? `Erkennen we de schade, dan dienen we in bij de verzekeraar en betalen we zelf ${fmtEur(inst.eigenRisico)}. Het dossier moet dan compleet zijn: vrachtbrief, inspecties, foto's, de claim en de calculatie.` : `Erkennen we de schade, dan betalen we zelf; dat is onder de drempel goedkoper dan indienen (premie en schadeverleden).`);
  // 6. de calculatie
  const cal = c.calculatie;
  if (cal) {
    const punten = [];
    if (cal.uurtarief > inst.normUurtarief * 1.15) punten.push(`uurtarief ${fmtEur(cal.uurtarief)} tegen een gangbare ${fmtEur(inst.normUurtarief)} (schatting)`);
    if (cal.vervangen && c.ernst <= 3) punten.push('vervangen van het onderdeel waar herstellen past bij deze ernst');
    if (cal.dubbel) punten.push('spuitwerk dat ook in de onderdelenregel zit');
    if (cal.btw && c.opdrachtgever.btwAftrek) punten.push('btw opgevoerd terwijl de opdrachtgever die kan aftrekken');
    if (punten.length) push('calculatie', 'let', `Calculatie: ${punten.length} ${punten.length === 1 ? 'punt' : 'punten'} om te bespreken`, `Te bespreken: ${punten.join('; ')}. Een tegenvoorstel ligt rond ${fmtEur(tegenvoorstel(c, inst))}.`);
    else push('calculatie', 'ok', 'Calculatie oogt gangbaar', `Arbeid ${cal.uren} uur × ${fmtEur(cal.uurtarief)}, onderdelen ${fmtEur(cal.onderdelen)}, lak en materiaal ${fmtEur(cal.lak)}${cal.btw ? ', inclusief btw' : ', exclusief btw'}.`);
  } else push('calculatie', 'let', 'Geen calculatie meegestuurd', 'Vraag een gespecificeerde calculatie (arbeid, onderdelen, lak) voordat we iets erkennen.');
  // het advies
  let advies;
  const sterkBewijs = (eerder.length > 0) || (fotosEerder.length > 0 && c.fotosClaimTonenSchade === false);
  if (afl.voorbehoud && inAfl.length && !eerder.length && !cal) advies = { besluit: 'info', reden: 'De schade is bij aflevering genoteerd en stond niet op de ophaalinspectie; vraag eerst een gespecificeerde calculatie voordat je erkent.' };
  else if (afl.voorbehoud && inAfl.length && !eerder.length) advies = { besluit: verzekeraar ? 'verzekeraar' : (S.find(s => s.id === 'calculatie').kleur === 'let' ? 'tegenvoorstel' : 'erkennen'), reden: 'De schade is bij aflevering genoteerd en stond niet op de ophaalinspectie: waarschijnlijk tijdens ons vervoer ontstaan.' };
  else if (sterkBewijs) advies = { besluit: 'afwijzen', reden: eerder.length ? 'De ophaalinspectie toont dezelfde schade: ze was er al voordat wij de auto meenamen.' : 'Onze ophaalfoto van die plek toont de schade niet, en die van de tegenpartij evenmin overtuigend.' };
  else if (!termijnOk && !afl.voorbehoud) advies = { besluit: 'afwijzen', reden: 'Getekend zonder voorbehoud en pas na de termijn gemeld; zonder bewijs van onze kant blijft dat een verweer, geen zekerheid.' };
  else if (!cal) advies = { besluit: 'info', reden: 'Eerst een gespecificeerde calculatie vragen.' };
  else if (S.find(s => s.id === 'eerder').kleur === 'let') advies = { besluit: 'chauffeur', reden: 'Geen bewijs van onze kant; vraag de chauffeur wat hij weet voordat je erkent of afwijst.' };
  else advies = { besluit: verzekeraar ? 'verzekeraar' : (S.find(s => s.id === 'calculatie').kleur === 'let' ? 'tegenvoorstel' : 'erkennen'), reden: 'Geen bewijs dat de schade er al zat; de calculatie is het gesprek.' };
  return { signalen: S, advies, eerder: eerder.length > 0, getekend: !afl.voorbehoud, termijn: termijnOk, limiet, dagenNaRit };
}

// Een tegenvoorstel: de calculatie herrekend met het gangbare uurtarief, herstellen in plaats van vervangen waar de
// ernst dat toelaat, dubbele posten eruit, en nooit boven de limiet. Afgerond op 10 euro.
export function tegenvoorstel(c, inst) {
  const cal = c.calculatie; if (!cal) return null;
  let arbeid = cal.uren * Math.min(cal.uurtarief, inst.normUurtarief);
  let onderdelen = cal.onderdelen; if (cal.vervangen && c.ernst <= 3) onderdelen = Math.round(onderdelen * 0.35);
  let lak = cal.dubbel ? Math.round(cal.lak * 0.6) : cal.lak;
  let som = arbeid + onderdelen + lak; if (cal.btw && !c.opdrachtgever.btwAftrek) som *= 1.21;
  const limiet = limietPerKg(c.voertuig.massa, inst.tariefPerKg);
  return Math.min(Math.round(som / 10) * 10, limiet);
}

// Wat Breedijk er zelf van betaalt bij een gegeven besluit en bedrag.
export function eigenKosten(besluit, bedrag, inst, cat = 'lading') {
  if (besluit === 'afgewezen' || besluit === 'afwijzen') return 0;
  if (besluit === 'verzekeraar' || besluit === 'casco' || besluit === 'wa') return Math.min(bedrag, cat === 'eigen' ? inst.cascoEigenRisico : cat === 'derde' ? inst.waEigenRisico : inst.eigenRisico);
  return bedrag;
}

// Termijn van ons antwoord: werkdagen sinds ontvangst tegen de antwoordtermijn.
export function antwoordTermijn(c, inst, nu) {
  const wacht = werkdagen(c.ontvangen, nu);
  return { wacht, over: wacht > inst.antwoordWerkdagen, rest: inst.antwoordWerkdagen - wacht };
}

// Wat telt als schade van een chauffeur: een claim die beoordeeld is (niet meer nieuw) en niet is afgewezen; een
// gesloten dossier telt alleen als het besluit niet afwijzen was. Dezelfde regel voor het signaal, de tabel en het
// dashboard.
export const teltVoorChauffeur = c => (c.categorie || 'lading') !== 'divers' && c.status !== 'nieuw' && c.status !== 'afgewezen' && c.besluit !== 'afgewezen';
// De regel voor het gesprek: drie schades in zeven dagen (het eerste signaal), of zes in negentig dagen (het
// tweede, een instelling). `schades` zijn de claims van een chauffeur, `nu` het moment.
export function gesprekSignaal(schades, inst, nu) {
  const telt = schades.filter(teltVoorChauffeur).map(s => new Date(s.datumClaim).getTime()).sort((a, b) => a - b);
  const venster = (dagen, aantal) => { for (let i = 0; i + aantal - 1 < telt.length; i++) if (telt[i + aantal - 1] - telt[i] <= dagen * DAG && nu - telt[i + aantal - 1] <= 60 * DAG) return { van: telt[i], tot: telt[i + aantal - 1] }; return null; };
  const kort = venster(inst.gesprekDagen, inst.gesprekAantal); if (kort) return { niveau: 'gesprek', tekst: `${inst.gesprekAantal} schades binnen ${inst.gesprekDagen} dagen`, ...kort };
  const lang = venster(inst.signaalDagen, inst.signaalAantal); if (lang) return { niveau: 'signaal', tekst: `${inst.signaalAantal} schades binnen ${inst.signaalDagen} dagen`, ...lang };
  return null;
}

// Zoeken: kenteken (met of zonder streepjes), dossiernummer, chauffeur, opdrachtgever. Geeft een lijst van treffers
// met soort en score; de aanroeper bepaalt hoe ze getoond worden.
export function zoek(q, D) {
  const s = String(q || '').trim().toLowerCase(); if (s.length < 2) return [];
  const kn = kentekenNorm(s); const R = [];
  if (kn.length >= 2) for (const c of D.claims) { const k = kentekenNorm(c.kenteken); if (k.includes(kn)) R.push({ soort: 'schade', id: c.id, titel: `${kentekenToon(c.kenteken)} · ${c.voertuig.merk} ${c.voertuig.model}`, sub: `${c.id} · ${c.opdrachtgever.naam} · ${STATUS[c.status].n}`, score: k === kn ? 100 : 60 }); }
  for (const c of D.claims) if (c.id.toLowerCase().includes(s)) R.push({ soort: 'schade', id: c.id, titel: c.id, sub: `${kentekenToon(c.kenteken)} · ${c.opdrachtgever.naam}`, score: 90 });
  if (D.vloot) for (const v of D.vloot) if (v.id.toLowerCase() === s || (kn.length >= 4 && kentekenNorm(v.kenteken).includes(kn))) R.push({ soort: 'voertuig', id: v.trekker || v.id, titel: `${v.id} · ${v.merk} ${v.model}`.trim(), sub: `${v.soort === 'trekker' ? 'Trekker' : 'Oplegger'} · ${kentekenToon(v.kenteken)} · ${v.vestiging}`, score: v.id.toLowerCase() === s ? 95 : 75 });
  for (const ch of D.chauffeurs) if (ch.naam.toLowerCase().includes(s) || ch.id.toLowerCase() === s) R.push({ soort: 'chauffeur', id: ch.id, titel: ch.naam, sub: `Chauffeur · ${ch.vestiging}`, score: 70 });
  for (const k of D.opdrachtgevers) if (k.naam.toLowerCase().includes(s)) R.push({ soort: 'opdrachtgever', id: k.id, titel: k.naam, sub: `Opdrachtgever · ${k.soort}`, score: 65 });
  if (kn.length >= 4) for (const r of D.ritten) { const k = kentekenNorm(r.kenteken); if (k.includes(kn) && !R.some(x => x.soort === 'schade' && kentekenNorm(x.titel.split(' · ')[0]) === k)) R.push({ soort: 'rit', id: r.id, titel: `${kentekenToon(r.kenteken)} · ${r.merk} ${r.model}`, sub: `Rit ${r.id} · ${fmtDatumJ(r.ophaal)} · ${r.chauffeurNaam} · geen claim`, score: k === kn ? 80 : 40 }); }
  const seen = new Set();
  return R.sort((a, b) => b.score - a.score).filter(x => { const key = x.soort + x.id; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 12);
}

// csv van een lijst objecten met vaste kolommen [{k, n}]; puntkomma als scheidingsteken (Excel in Nederland).
export function csv(rijen, kolommen) {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [kolommen.map(k => esc(k.n)).join(';'), ...rijen.map(r => kolommen.map(k => esc(typeof k.k === 'function' ? k.k(r) : r[k.k])).join(';'))].join('\n');
}

// De beoordeling van aanrijschade (eigen voertuig of derde) en diverse schade. Zelfde vorm als bij ladingsschade: een
// lijst signalen met een kleur (ok is in ons voordeel of in orde, let vraagt aandacht, slecht is tegen ons) en een
// advies. Signalen, geen juridisch advies: de verzekeraar beoordeelt de aansprakelijkheid.
export function beoordeelVoertuig(c, r, inst, nu) {
  const S = []; const push = (id, kleur, kort, uitleg, extra) => S.push({ id, kleur, kort, uitleg, ...extra });
  const m = c.melding || {}; const f = c.formulier || { status: 'niet' }; const bedrag = c.bedragGevraagd || 0;
  const formulierSignaal = (naam) => {
    if (f.status === 'ontvangen') push('formulier', 'ok', `${naam} van de chauffeur ontvangen`, `Ingevuld op ${fmtDatumTijd(f.op)}${f.via ? `, via ${f.via}` : ''}. Het gaat mee in het pakket voor de verzekeraar.`);
    else if (f.status === 'gevraagd') push('formulier', 'let', `${naam} gevraagd, nog niet terug`, `Gevraagd op ${fmtDatumTijd(f.op)}. Zonder formulier kan de verzekeraar de melding niet in behandeling nemen.`, { actie: { act: 'formulierOntvangen', label: 'Markeer als ontvangen' } });
    else push('formulier', 'let', `Nog geen ${naam.toLowerCase()}`, `Vraag het de chauffeur zo snel mogelijk, zolang hij het nog weet. Het formulier is altijd nodig, ook als onze werkplaats het herstelt.`, { actie: { act: 'formulierVragen', label: 'Vraag het formulier' } });
  };
  if (c.categorie === 'eigen') {
    if (m.door === 'chauffeur') push('melding', (m.uurNa || 0) <= 24 ? 'ok' : 'let', (m.uurNa || 0) <= 24 ? `Gemeld door de chauffeur, ${m.uurNa < 1 ? 'direct' : `${Math.round(m.uurNa)} uur na het voorval`}` : `Pas na ${Math.round(m.uurNa / 24)} dagen gemeld door de chauffeur`, (m.uurNa || 0) <= 24 ? 'Snel gemeld: de chauffeur weet nog wat er gebeurde en de foto\'s zijn van direct na het voorval.' : 'Een late melding maakt het lastiger vast te stellen wat er gebeurde. Vraag waarom het later kwam.');
    else push('melding', 'let', `Gevonden ${m.door === 'werkplaats' ? 'in de werkplaats' : 'bij een controle'}, niet gemeld`, 'Niemand meldde deze schade. Vraag de chauffeurs die dit voertuig de laatste dagen reden, en kijk in de telematica naar een klap of een stop op een vreemde plek.');
    formulierSignaal('Schadeformulier');
    push('plaats', c.fase === 'laden' || c.fase === 'lossen' ? 'let' : 'info', PLAATS[c.fase] || 'Plaats onbekend', c.fase === 'laden' || c.fase === 'lossen' ? 'Bij een klant gebeurd: vraag of er camerabeelden zijn, en of er iets van de klant is geraakt. Dan is er ook een aanrijschade derde.' : c.fase === 'terrein' ? 'Op ons eigen terrein: vaak bij inparkeren of rangeren in de vakken. Kijk of een tweede voertuig is geraakt.' : 'Onderweg gebeurd. De telematica laat zien waar en hoe hard.');
    const casco = bedrag >= inst.cascoGrens;
    push('kosten', casco ? 'info' : 'ok', casco ? `Raming ${fmtEur(bedrag)}: boven ${fmtEur(inst.cascoGrens)}, melden bij de cascoverzekeraar` : `Raming ${fmtEur(bedrag)}: herstel in onze werkplaats`, casco ? `Boven de grens dienen we in bij de cascoverzekeraar; ons eigen risico is ${fmtEur(inst.cascoEigenRisico)}. Het pakket moet compleet zijn: schadeformulier, foto's, de offerte van het herstelbedrijf.` : `Onder de grens herstelt onze eigen werkplaats het (negen van de tien keer, volgens Breedijk). Het dossier houdt de kosten bij voor het overzicht per chauffeur en per voertuig.`);
    if (c.werkorder) push('stilstand', c.werkorder.stilstand > 3 ? 'let' : 'info', `${c.werkorder.stilstand} ${c.werkorder.stilstand === 1 ? 'dag' : 'dagen'} uit de roulatie`, `Werkorder ${c.werkorder.nummer}: ${c.werkorder.status}. ${c.werkorder.stilstand > 3 ? 'Plan een vervangende combinatie of een charter voor de ritten van deze dagen.' : ''}`);
    let advies;
    if (casco) advies = { besluit: f.status === 'ontvangen' ? 'casco' : 'formulier', reden: f.status === 'ontvangen' ? 'De raming ligt boven de grens en het schadeformulier is binnen: melden bij de cascoverzekeraar.' : 'Boven de grens, maar het schadeformulier ontbreekt nog: eerst het formulier, dan de verzekeraar.' };
    else advies = { besluit: f.status === 'ontvangen' ? 'werkplaats' : 'formulier', reden: f.status === 'ontvangen' ? 'Onder de grens en het formulier is binnen: herstellen in onze werkplaats.' : 'Vraag eerst het schadeformulier; dan kan de werkplaats het herstellen.' };
    return { signalen: S, advies, eerder: false, getekend: null, termijn: null, limiet: null, dagenNaRit: null };
  }
  if (c.categorie === 'derde') {
    const g = c.gps;
    if (g && g.gevonden) push('gps', 'let', `Ons voertuig was er: ${g.voertuig}, ${fmtDatumTijd(g.tijd)}`, `De telematica zet ${g.voertuig} op ${g.afstand} meter van de opgegeven plek, ${g.snelheid} km/u${g.richting === 'achteruit' ? ', achteruit' : ''}. De melding is dus aannemelijk. In het echt komt dit uit de boordcomputer (gesimuleerd).`);
    else if (g) push('gps', 'ok', 'Geen voertuig van ons in de buurt op dat moment', `Op ${fmtDatumTijd(g.tijd)} was het dichtstbijzijnde voertuig van ons ${g.voertuig ? `${g.voertuig}, ` : ''}${g.afstand >= 1000 ? `${(g.afstand / 1000).toFixed(1).replace('.', ',')} km` : `${g.afstand} m`} verderop. Vraag de tegenpartij om het kenteken of de beelden; mogelijk een ander bedrijf.`);
    else push('gps', 'let', 'Moment of plaats onbekend', 'Zonder tijd en plaats kan de telematica niet zeggen of ons voertuig er was. Vraag de tegenpartij om beide.');
    const nietVanOns = g && !g.gevonden;
    if (nietVanOns) push('melding', 'ok', 'Geen rit en geen chauffeur van ons op dat moment', 'Er is dus ook geen schadeformulier nodig, zolang de tegenpartij geen beelden of kenteken laat zien die anders zeggen.');
    else if (m.door === 'chauffeur') push('melding', 'ok', 'De chauffeur meldde het zelf', 'Hij weet wat er gebeurde; het schadeformulier kan meteen.');
    else push('melding', 'let', 'De chauffeur heeft niets gemeld', 'De melding komt van de tegenpartij. Misschien had hij het niet door, zoals bij achteruitrijden of een lage paal. Vraag het hem zonder oordeel.');
    if (!nietVanOns) formulierSignaal(c.tegenpartij && c.tegenpartij.aanwezig ? 'Europees schadeformulier' : 'Schadeformulier');
    const bw = c.bewijsTegenpartij;
    push('bewijs', bw === 'geen' ? 'let' : 'info', bw === 'camera' ? 'De tegenpartij heeft camerabeelden' : bw === 'fotos' ? 'Foto\'s van de schade meegestuurd' : 'Nog geen foto\'s of beelden', bw === 'camera' ? 'Vraag de beelden op; ze gaan mee in het pakket voor de verzekeraar.' : bw === 'fotos' ? 'Vraag ook waar en wanneer precies, als dat niet in de mail staat.' : 'Vraag foto\'s van de schade en, als het kan, een offerte.');
    push('aansprakelijkheid', 'info', 'Erken zelf geen aansprakelijkheid', 'De WA-verzekeraar beoordeelt de aansprakelijkheid en regelt het met de tegenpartij. Zeg toe dat je het meldt, niet dat je betaalt (polisvoorwaarden, laten toetsen).');
    const onder = bedrag && bedrag < inst.waEigenRisico;
    push('kosten', 'info', bedrag ? `Gevraagd ${fmtEur(bedrag)}; WA-eigen risico ${fmtEur(inst.waEigenRisico)}` : 'Nog geen bedrag genoemd', onder ? 'Onder het eigen risico: zelf afhandelen kan, maar de polis vraagt vaak dat je elke aanspraak meldt (laten toetsen bij de makelaar).' : 'Boven het eigen risico betaalt de verzekeraar de rest.');
    let advies;
    if (g && !g.gevonden) advies = { besluit: 'afwijzen', reden: 'De telematica zet geen voertuig van ons op die plek en tijd; vraag eventueel om de beelden voordat je het afsluit.' };
    else if (f.status !== 'ontvangen') advies = { besluit: 'formulier', reden: 'Eerst het schadeformulier van de chauffeur; daarmee meld je het bij de WA-verzekeraar.' };
    else advies = { besluit: onder ? 'erkennen' : 'wa', reden: onder ? 'Ons voertuig was er en het bedrag ligt onder het eigen risico; zelf betalen kan als de polis dat toestaat.' : 'Ons voertuig was er en het formulier is binnen: melden bij de WA-verzekeraar met het pakket.' };
    return { signalen: S, advies, eerder: false, getekend: null, termijn: null, limiet: null, dagenNaRit: null };
  }
  // diverse schade
  push('wat', 'info', `${GEBIEDEN[c.gebied] || 'Overig'}: ${SOORTEN[c.soort] ? SOORTEN[c.soort].toLowerCase() : ''}`.replace(/: $/, ''), c.gebied === 'sleutel' ? 'Een sleutel van een auto die wij vervoeren: met de opdrachtgever afstemmen of hij een reservesleutel heeft voordat er een nieuwe wordt besteld.' : 'Kleine schade aan ons eigen materiaal. Komt zelden voor; dit dossier houdt het bij.');
  push('kosten', 'ok', bedrag ? `${fmtEur(bedrag)}` : 'Nog geen bedrag', 'Komt voor eigen rekening; geen verzekeraar.');
  if (m.door === 'chauffeur') push('melding', 'ok', 'Gemeld door de chauffeur', ''); else push('melding', 'let', 'Niet gemeld door de chauffeur', 'Vraag hem wat er gebeurde.');
  return { signalen: S, advies: { besluit: c.gebied === 'sleutel' && !c.opdrachtgeverAkkoord ? 'info' : 'erkennen', reden: c.gebied === 'sleutel' ? 'Eerst bij de opdrachtgever navragen of er een reservesleutel is.' : 'Klein bedrag voor eigen rekening.' }, eerder: false, getekend: null, termijn: null, limiet: null, dagenNaRit: null };
}
