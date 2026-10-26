# Acceptatie 4.1: de lat

Meetbaar, met de test die het bewijst. Alles gesimuleerd; elke kans, kostprijs en tijd heet schatting. Geldt naast
`acceptatie-4.0.md` (die blijft gelden: nooit vastzitten, nergens land als zee, nul verzoeken naar buiten ingebed, geen
naam naar de API, alle suites groen).

## A. Tellers per chauffeur
- Elke chauffeur heeft een teller: gereden vandaag, deze week, deze twee weken, de laatste rust, de volgende verplichte
  rust; zichtbaar op de chauffeurspagina, in de kandidaatkaart en op het planbord (rustblok, niet te overschrijven).
- De pauze van 45 minuten mag ook als 15 plus 30 minuten (EU 561/2006, artikel 7), en de toets rekent zo.
- EU 561/2006 en de cao: 56 uur per week, 90 per twee weken, weekrust 45 uur (verkort 24 met compensatie binnen drie
  weken), na zes dagrittijden een weekrust; de dagregels van 4.0 blijven.
- De teller op de chauffeurspagina is gelijk aan de som van het planbord (test).
- Geen sleep, voorstel of toewijzing brengt een chauffeur over de week- of tweeweekgrens of onder zijn weekrust; de
  toewijzing over alle open ritten (verdeel.js) neemt het als harde grens (test op maandag 05:30 en 10:00, oefendag).
- Stand ronde 1 (26 oktober): gebouwd in `src/tellers.js`, getoond op de chauffeurspagina, in de lijst Chauffeurs, in de
  kandidaatkaart en op het planbord (Per chauffeur, met rustblok). Bewijs: `tests/toets.test.mjs` (de regels en de teller),
  `tests/verdeel.test.mjs` (de harde grens), `tests/week-check.mjs` (maandag en zondag, 05:30 en 10:00, gewone dag en
  oefendag; teller gelijk aan het planbord; een sleep over de weekrust gaat niet). Open: de afwisseling van normale en
  verkorte weekrust over twee weken, de compensatie als blok, de cao-regel van 13 vrije weekenden (status zoek).

## B. Rooster
- Elke chauffeur heeft een rooster: contract (volle week, deeltijd, halve dag, oproep), beschikbare dagen en dagdelen,
  vakantie, ziek, rustdag; gesimuleerd met variatie, in een vorm die een roostersysteem kan vullen.
- De planning plant alleen binnen het rooster; afwijken kan alleen bewust, met reden, en komt in het logboek (test).
- Stand ronde 1: gebouwd in `src/rooster.js` (de vorm voor een roostersysteem staat in de README), zichtbaar op de
  chauffeurspagina en in de kandidaatkaart; buiten het rooster is een fout in `toets.js`, het planbord vraagt een reden en
  schrijft de afwijking in het logboek (`tests/week-check.mjs`). Open: de reden bij inplannen uit de bak Open ritten (daar
  blijft het een fout met de uitleg) en bij de toewijzing van een open rit (daar een waarschuwing "buiten het rooster").

## C. Plannen en vrijgeven
- "Planning vrijgeven" per standplaats voor morgen (of de volgende dienst); statussen per dienst: concept, vrijgegeven,
  gezien, bevestigd, onderweg, afgerond; na een wijziging alleen het verschil opnieuw vrijgeven (test).
- Stand ronde 1 (26 oktober): gebouwd, weergave Vrijgeven (toets 7, `#vrijgeven/<standplaats>`). Bewijs in
  `tests/vrijgeven-check.mjs`: om 01:00 staan de 278 diensten van Wognum op concept, na vrijgeven alle 278 op vrijgegeven
  met 278 logregels en een samenvatting; de tweede dienst van een voertuig een half uur later geeft bij precies die dienst
  het verschil ("Begin 15:20 wordt 15:50 · Rit R-10014 vertrekt 16:08 in plaats van 15:38") en Wijzigingen vrijgeven
  stuurt alleen dat; om 13:00 volgen onderweg en afgerond de simulatie; de directie en HR zien de knop niet; na herladen
  is alles gelijk; de oefendag heeft een eigen vrijgave. De demo heeft een dag: vrijgegeven wordt wat nog niet begon (zie
  README).

## D. Het bericht aan de chauffeur
- Bij vrijgeven een bericht per chauffeur: begintijd, voertuig, oplegger, ritten met tijden en adressen, pauze, link;
  als voorbeeld op het scherm, "verstuurd" in het logboek, gesimuleerde bevestiging ("gezien", "akkoord"); zonder
  bevestiging ziet de planner het (test). In de demo gaat er niets de deur uit.
- Stand ronde 1: gebouwd. Bewijs in `tests/vrijgeven-check.mjs`: het bericht heeft begintijd, voertuig, oplegger, de
  ritten met tijden en adressen, de pauze en de link `#rit/<id>` (die de rit opent; Terug komt terug); 45 minuten na
  vrijgeven 231 bevestigd, 23 gezien, 24 niet gezien en 47 bij "Wacht op bevestiging" met een belknop; geen tel:, geen
  mailto, geen verzoek naar buiten. De wachtklok als zaak staat er nog niet (vraagt een nieuwe soort in `zaken.js`).

## E. Ritopdracht naar de boordcomputer
- Bij vrijgeven of bevestiging een OTM5-ritopdracht per rit (stops, tijden, laadadres, oplegger), te bekijken en te
  exporteren; geldig volgens `src/otm5.js` (test).
- Stand ronde 1: gebouwd. Bewijs in `tests/vrijgeven-check.mjs`: de export van Wognum heeft 482 ritopdrachten, een per
  rit, en alle 2.089 entiteiten valideren tegen OTM 5.9 met elke verwijzing in het bestand; geen naam van een chauffeur;
  de verschoven ritten gingen als versie 2; het paneel van een rit geeft een geldig los bericht. Welke boordcomputer en
  welke koppeling: open vraag voor ICT (README).

## F. Bezetting tegen behoefte
- Per standplaats en heel Nederland, per dag en dagdeel voor veertien dagen: nodig, beschikbaar, verschil, kosten
  (schatting) van tekort en overschot; de som per dag klopt met rooster en plan (test); de knoppen (dienst verschuiven,
  lenen, extra diensten aanbieden, charter) werken en komen in het logboek.
- Stand ronde 1: het model in `src/bezetting.js` (`people.bezetting`), met de voorstellen als gegevens; de som per dag tegen
  rooster en plan en de rekentijd voor heel Nederland in `tests/bezetting.test.mjs` (34 tot 47 ms in Node). Het scherm en de
  knoppen zijn ronde 2.

## G. Voorkeursbod
- Per chauffeur een wekelijkse voorkeur op open diensten; de toewijzing weegt hem mee en rouleert; per rit de uitleg
  waarom iemand hem kreeg; over acht gesimuleerde weken een kleinere spreiding van extra ritten en weekenden dan nu
  (meting in de README als schatting). Zichtbaar per chauffeur (besluit van Sem, 26 oktober).

## H. Rollen
- De directie opent het planbord alleen-lezen: kijken, geen slepen, geen voorstellen toepassen (test).
- Stand ronde 1: `CAN.planbord` met de directie erbij; het bord zegt "Alleen-lezen: je kijkt mee", geen blok is sleepbaar,
  geen Rit inplannen, een pijltje verschuift niets (`tests/week-check.mjs`, 1440 en 390 px).

## I. Vaste routes, voorkeursroutes en plekkennis
- Een vaste route gaat niet naar een ander zolang de vaste chauffeur beschikbaar is; een voorkeursroute weegt zwaar in
  de toewijzing; de kandidaatkaart toont de ervaring op het adres ("was hier 14 keer, laatst dinsdag") (test).
- Per klant en DC een kaart met plekkennis (aanrijroute, poort, dock of losplek, lostijd, contact, bijzonderheden, een
  stukje luchtfoto); wie voor het eerst komt (of langer dan een jaar geleden) krijgt hem in het bericht en de
  ritopdracht, een ervaren chauffeur niet; de ritpagina zegt "nieuw voor deze chauffeur" (test).

## J. Chauffeursprofiel
- Elke chauffeur heeft een profiel met bevoegdheden (C of CE, code 95, ADR, LZV, ATP, heftruck, met vervaldatum),
  ervaring, rooster, afspraken, bereikbaarheid, betrouwbaarheid per groep en een notitie van de planner; de toewijzing en
  het planbord weigeren een rit zonder de juiste bevoegdheid met reden (test); een certificaat dat binnen 90 dagen
  verloopt staat op het Overzicht (test); nooit een medische reden, nooit een ranglijst per persoon.

## K. Dashboard en duurzame voorstellen
- Rapporten is voor de directie een dashboard: op tijd, gemist, invulling en kosten, bezetting, kosten per km, lege km,
  wachttijd, rij- en rusttijden, CO2 en het aandeel elektrisch, met trend over dertig dagen; elk cijfer klikt door
  (test); laadt binnen een seconde (test).
- Duurzame voorstellen per rit met berekening (elektrisch in plaats van diesel, lege kilometers eruit, LZV, minder
  wachttijd): CO2 in kg en euro's als schatting met de bron van elke factor in BRONNEN.md; de som per dag is
  reproduceerbaar (test); geen voorstel zonder voldoende accu of bevoegdheid (test).
- Stand 26 oktober 2026 (`tests/dashboard-check.mjs`, vaste klok maandag 10:00, gewone dag en oefendag;
  `tests/duurzaam.test.mjs`): dashboard met 23 cijfers, 21 lijntjes en 6 grafieken in 229 tot 418 ms (gemeten in de
  browser; de test neemt de beste van drie, voor als andere agents tegelijk testen); 11 doorkliks naar een bestaande lijst
  met filter; op tijd, te laat en gemist gelijk aan `metrics.sample`, lege km gelijk aan een eigen telling over de ritten;
  de som van de voorstellen gelijk bij opnieuw rekenen en na herladen (61 voorstellen, 3.197 kg CO2, 2.285 euro,
  schatting); elk elektrisch voorstel opnieuw gerekend met genoeg accu, geen truck twee keer; elk LZV-voorstel met een
  LZV-truck en een bevoegde chauffeur; de directie zonder knop om toe te passen; toepassen met logregel en na herladen
  bewaard, afwijzen met reden; licht en donker op 1440 en 390 px (en 1280 en 768) zonder overloop. Open: de bevoegdheid komt nog uit de
  vlag `licence.lzv` in de simulatie (tot het chauffeursprofiel, J), de weigeringen van de toets op het planbord worden
  nog niet geteld, en de week- en tweeweekgrens komt met de tellers (A).

