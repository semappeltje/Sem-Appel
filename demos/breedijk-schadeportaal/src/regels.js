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
  verzekeraar: { n: 'Bij verzekeraar', k: 'verzekeraar', uitleg: 'Ingediend bij de verzekeraar; wij betalen het eigen risico.' },
  erkend: { n: 'Erkend', k: 'erkend', uitleg: 'We nemen de schade (deels) voor onze rekening.' },
  afgewezen: { n: 'Afgewezen', k: 'afgewezen', uitleg: 'Afgewezen met bewijs; de tegenpartij heeft dat gelezen of reageert niet meer.' },
  gesloten: { n: 'Gesloten', k: 'gesloten', uitleg: 'Betaald, verrekend of geschikt.' },
};
export const OPEN_STATUS = ['nieuw', 'onderzoek', 'wacht_tegenpartij', 'wacht_chauffeur', 'wacht_expert', 'verzekeraar'];
export const BESLUITEN = {
  afwijzen: { n: 'Afwijzen met bewijs', status: 'afgewezen' },
  erkennen: { n: 'Erkennen, zelf betalen', status: 'erkend' },
  verzekeraar: { n: 'Erkennen, indienen bij verzekeraar', status: 'verzekeraar' },
  tegenvoorstel: { n: 'Tegenvoorstel', status: 'wacht_tegenpartij' },
  info: { n: 'Meer informatie vragen', status: 'wacht_tegenpartij' },
  chauffeur: { n: 'Chauffeur om toelichting vragen', status: 'wacht_chauffeur' },
  expert: { n: 'Expertise aanvragen', status: 'wacht_expert' },
};

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
};
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
  const S = [];
  const push = (id, kleur, kort, uitleg, extra) => S.push({ id, kleur, kort, uitleg, ...extra });
  // 1. hebben wij hem vervoerd
  if (!r) {
    push('vervoerd', 'slecht', 'Geen rit gevonden op dit kenteken', 'Niets in Transpas op dit kenteken rond de genoemde datum. Vraag de tegenpartij om de vrachtbrief of het ordernummer; staat het er niet, dan is de schade niet door ons vervoerd.');
    return { signalen: S, advies: { besluit: 'info', reden: 'Eerst vaststellen of wij deze auto vervoerd hebben.' }, eerder: false, getekend: null, termijn: null, limiet: null };
  }
  const dagenNaRit = Math.round((new Date(c.datumClaim) - new Date(r.aflever)) / DAG);
  push('vervoerd', 'ok', `Vervoerd door ons: rit ${r.id}, ${fmtDatumJ(r.ophaal)}`, `${r.van.plaats} naar ${r.naar.plaats}, chauffeur ${r.chauffeurNaam}, ${r.truck}, positie ${r.positie} op de oplegger. Afgeleverd ${fmtDatumTijd(r.aflever)}.`);
  // 2. stond de schade al op de ophaalinspectie
  const eerder = r.inspectieOphaal.filter(s => zelfdePlek(s.gebied, c.gebied));
  const fotosEerder = r.fotos.filter(f => f.moment === 'ophaal' && zelfdePlek(f.gebied, c.gebied));
  if (eerder.length) push('eerder', 'ok', `Schade op deze plek stond al op de ophaalinspectie`, `Bij ophalen op ${fmtDatumTijd(r.ophaal)} noteerde de chauffeur: ${eerder.map(s => `${GEBIEDEN[s.gebied].toLowerCase()}, ${SOORTEN[s.soort].toLowerCase()} (${ERNST[s.ernst]})`).join('; ')}. ${fotosEerder.length ? `${fotosEerder.length} foto('s) van die plek, met tijdstip.` : 'Geen foto van precies die plek; wel de notitie.'}`, { fotos: fotosEerder.map(f => f.id) });
  else if (fotosEerder.length) push('eerder', 'ok', 'Foto van deze plek bij ophalen, zonder schade genoteerd', `${fotosEerder.length} foto('s) van ${GEBIEDEN[c.gebied].toLowerCase()} bij ophalen (${fmtDatumTijd(r.ophaal)}). Leg ze naast de foto's van de tegenpartij: staat de schade er niet op, dan is ze daarna ontstaan.`, { fotos: fotosEerder.map(f => f.id) });
  else push('eerder', 'let', 'Geen foto en geen notitie van deze plek bij ophalen', `De ophaalinspectie noemt deze plek niet en er is geen foto van. We kunnen niet aantonen dat de schade er al zat. Vraag de chauffeur wat hij zich herinnert en kijk of een overzichtsfoto de plek toch toont.`);
  // 3. bij aflevering getekend
  const afl = r.aflevering;
  const inAfl = r.inspectieAflever.filter(s => zelfdePlek(s.gebied, c.gebied));
  if (afl.voorbehoud && inAfl.length) push('getekend', 'slecht', 'Bij aflevering is deze schade al genoteerd', `De ontvanger tekende met voorbehoud: "${afl.tekst}". De schade stond dus bij aflevering op de auto en is niet op de ophaalinspectie te zien${eerder.length ? ', maar wel op de ophaalinspectie genoteerd' : ''}.`);
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
  if (afl.voorbehoud && inAfl.length && !eerder.length) advies = { besluit: verzekeraar ? 'verzekeraar' : (cal && S.find(s => s.id === 'calculatie').kleur === 'let' ? 'tegenvoorstel' : 'erkennen'), reden: 'De schade is bij aflevering genoteerd en stond niet op de ophaalinspectie: waarschijnlijk tijdens ons vervoer ontstaan.' };
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
export function eigenKosten(besluit, bedrag, inst) {
  if (besluit === 'afgewezen' || besluit === 'afwijzen') return 0;
  if (besluit === 'verzekeraar') return Math.min(bedrag, inst.eigenRisico);
  return bedrag;
}

// Termijn van ons antwoord: werkdagen sinds ontvangst tegen de antwoordtermijn.
export function antwoordTermijn(c, inst, nu) {
  const wacht = werkdagen(c.ontvangen, nu);
  return { wacht, over: wacht > inst.antwoordWerkdagen, rest: inst.antwoordWerkdagen - wacht };
}

// De regel voor het gesprek: drie schades in zeven dagen (het eerste signaal), of drie in negentig dagen (het
// tweede). Telt alleen schades die erkend zijn, bij de verzekeraar liggen of nog open staan: een afgewezen claim is
// geen schade van de chauffeur. `schades` zijn de claims van een chauffeur, `nu` het moment.
export function gesprekSignaal(schades, inst, nu) {
  const telt = schades.filter(s => s.status !== 'afgewezen' && s.status !== 'gesloten_afgewezen').map(s => new Date(s.datumClaim).getTime()).sort((a, b) => a - b);
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
