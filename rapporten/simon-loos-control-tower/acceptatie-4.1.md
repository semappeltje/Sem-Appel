# Acceptatie 4.1: de lat

Meetbaar, met de test die het bewijst. Alles gesimuleerd; elke kans, kostprijs en tijd heet schatting. Geldt naast
`acceptatie-4.0.md` (die blijft gelden: nooit vastzitten, nergens land als zee, nul verzoeken naar buiten ingebed, geen
naam naar de API, alle suites groen).

## A. Tellers per chauffeur
- Elke chauffeur heeft een teller: gereden vandaag, deze week, deze twee weken, de laatste rust, de volgende verplichte
  rust; zichtbaar op de chauffeurspagina, in de kandidaatkaart en op het planbord (rustblok, niet te overschrijven).
- EU 561/2006 en de cao: 56 uur per week, 90 per twee weken, weekrust 45 uur (verkort 24 met compensatie binnen drie
  weken), na zes dagrittijden een weekrust; de dagregels van 4.0 blijven.
- De teller op de chauffeurspagina is gelijk aan de som van het planbord (test).
- Geen sleep, voorstel of toewijzing brengt een chauffeur over de week- of tweeweekgrens of onder zijn weekrust; de
  toewijzing over alle open ritten (verdeel.js) neemt het als harde grens (test op maandag 05:30 en 10:00, oefendag).

## B. Rooster
- Elke chauffeur heeft een rooster: contract (volle week, deeltijd, halve dag, oproep), beschikbare dagen en dagdelen,
  vakantie, ziek, rustdag; gesimuleerd met variatie, in een vorm die een roostersysteem kan vullen.
- De planning plant alleen binnen het rooster; afwijken kan alleen bewust, met reden, en komt in het logboek (test).

## C. Plannen en vrijgeven
- "Planning vrijgeven" per standplaats voor morgen (of de volgende dienst); statussen per dienst: concept, vrijgegeven,
  gezien, bevestigd, onderweg, afgerond; na een wijziging alleen het verschil opnieuw vrijgeven (test).

## D. Het bericht aan de chauffeur
- Bij vrijgeven een bericht per chauffeur: begintijd, voertuig, oplegger, ritten met tijden en adressen, pauze, link;
  als voorbeeld op het scherm, "verstuurd" in het logboek, gesimuleerde bevestiging ("gezien", "akkoord"); zonder
  bevestiging ziet de planner het (test). In de demo gaat er niets de deur uit.

## E. Ritopdracht naar de boordcomputer
- Bij vrijgeven of bevestiging een OTM5-ritopdracht per rit (stops, tijden, laadadres, oplegger), te bekijken en te
  exporteren; geldig volgens `src/otm5.js` (test).

## F. Bezetting tegen behoefte
- Per standplaats en heel Nederland, per dag en dagdeel voor veertien dagen: nodig, beschikbaar, verschil, kosten
  (schatting) van tekort en overschot; de som per dag klopt met rooster en plan (test); de knoppen (dienst verschuiven,
  lenen, extra diensten aanbieden, charter) werken en komen in het logboek.

## G. Voorkeursbod
- Per chauffeur een wekelijkse voorkeur op open diensten; de toewijzing weegt hem mee en rouleert; per rit de uitleg
  waarom iemand hem kreeg; over acht gesimuleerde weken een kleinere spreiding van extra ritten en weekenden dan nu
  (meting in de README als schatting). Zichtbaar per chauffeur (besluit van Sem, 26 oktober).

## H. Rollen
- De directie opent het planbord alleen-lezen: kijken, geen slepen, geen voorstellen toepassen (test).
