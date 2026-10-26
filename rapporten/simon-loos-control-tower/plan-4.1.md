# Plan 4.1: wat de volgende keer live gaat

Voor Sem, 26 oktober 2026 (bijgewerkt na je aanvulling van vanavond). De kern van 4.1 is het planproces van begin
tot eind: het rooster en de rij- en rusttijden van elke chauffeur, de planning die de planner vrijgeeft, het bericht aan de
chauffeur, en de ritten naar de boordcomputer. Daarna de voorkeursstem en wat uit 4.0 bleef liggen. Alles gesimuleerd tot de proef met echte data; elke schatting heet
schatting. Volgorde is prioriteit; wat af en groen is gaat mee, wat niet af is blijft eruit (dezelfde regel als bij 4.0).

## Wat 4.0 al doet (geen dubbel werk)

- Per dag: na 4,5 uur rijden 45 minuten pauze; 9 uur rijden, twee keer per week 10 (EU 561/2006); dagelijkse rust 11 uur,
  hoogstens drie keer tussen twee weekrusten 10 (de cao beroepsgoederenvervoer, strenger dan EU 561). Het planbord toetst
  elke sleep en elk voorstel ermee (`src/ui/toets.js`), een bestelbus tot 3,5 ton valt erbuiten, en bij elke kandidaat
  voor een open rit staat de waarschuwing (rijtijd, rust, uren).
- Voorkeuren: per chauffeur weekdag en dagdeel (vroeg, dag, avond, nacht), ritsoort en regio; "past slecht bij de
  voorkeur" als stille stip op het planbord, de kans op een ja rekent ermee, en een tevredenheidscijfer per standplaats
  (`src/voorkeuren.js`, `src/inzet.js`).

## 0. Het planproces van begin tot eind (jouw aanvulling van 26 oktober)

Wat je zei: de planner hoeft niet na te denken over wat een chauffeur de afgelopen week reed; het systeem houdt de rij- en
rusttijden van de individuele chauffeur bij (voldoende nachtrust erbij), en sluit aan op zijn eigen rooster (van een
volle week tot een halve dag). Is de planning akkoord, dan gaat hij per mail of app naar de chauffeur, zodat hij weet wat
hij de volgende dag of dienst doet; en de ritten gaan naar de boordcomputer. Zo lees ik het, in vijf bouwstenen:

**A. Gerealiseerd zonder nadenken.** Per chauffeur een teller die vanzelf gevuld wordt: gereden vandaag, deze week, deze
twee weken, de laatste rust, de volgende verplichte rust. In de demo uit de simulatie; in het echt uit de tachograaf en
de boordcomputer (werkstaten). De planner ziet per chauffeur één regel: "kan vandaag nog 3 uur 10 rijden, weekrust
vanaf vrijdag 18:00". Kandidaten die het niet halen, komen niet in de lijst; de planner hoeft niet te rekenen.

**B. Het rooster van de chauffeur.** Elke chauffeur heeft een rooster: contract (volle week, deeltijd, een halve dag,
oproep), beschikbare dagen en dagdelen, vakantie, ziek, rustdag. De planning plant alleen binnen dat rooster; afwijken
kan alleen als de planner het bewust doet, met reden, en het komt in het logboek. Rij- en rusttijden en rooster
samen bepalen wie wanneer kan. In de demo gesimuleerd met variatie; in het echt uit het roostersysteem en HR.

**C. Plannen en vrijgeven.** De planner maakt de planning voor morgen (of de volgende dienst) per standplaats en keurt hem
goed met één handeling: "Planning vrijgeven". Elke dienst krijgt een status: concept, vrijgegeven, gezien door de
chauffeur, bevestigd, onderweg, afgerond. Verandert er na het vrijgeven iets (een rit erbij, een andere tijd), dan
ziet de planner precies wat er verschilt en geeft hij alleen dat verschil opnieuw vrij.

**D. Het bericht aan de chauffeur.** Bij vrijgeven krijgt elke chauffeur zijn dienst van morgen: begintijd, voertuig,
oplegger, de ritten met tijden en adressen, de pauze, en een link. Per mail, of in de chauffeursapp als die er is. De
chauffeur bevestigt met één tik ("gezien" en "akkoord"); blijft dat uit, dan ziet de planner het (de wachtklok,
ideeënbank 44). In de demo: het bericht als voorbeeld op het scherm, "verstuurd" in het logboek en een gesimuleerde
bevestiging; in het echt via een maildienst of de app van de boordcomputer.

**E. Naar de boordcomputer.** Bij vrijgeven (of bij de bevestiging van de chauffeur) gaan de ritten als ritopdracht
naar de boordcomputer van het voertuig: stops, tijden, laadadres, oplegger. In de demo als OTM5-bericht dat je kunt
bekijken en exporteren (`src/otm5.js` bestaat al); in de proef de echte koppeling. Welke boordcomputer en welke
koppeling (Trimble of een andere), bepalen we met ICT; dat staat hieronder bij "nodig van Simon Loos".

Lat: op de oefendag plant de planner Wognum voor morgen zonder één keer zelf uren te tellen (de app toont per chauffeur
wat kan); geen dienst buiten het rooster of boven de rij- en rusttijden zonder bewuste afwijking in het logboek; na
"Planning vrijgeven" heeft elke chauffeur een bericht en elke rit een OTM5-ritopdracht; een wijziging na vrijgeven
geeft alleen het verschil door. Schatting: drie agentrondes, 2 tot 3 dagen, bovenop de rondes van 1 en 2 hieronder (die
erin opgaan).

**F. Knelpunten tussen planning en behoefte: te veel of te weinig mensen.** Per standplaats, per dag en dagdeel, voor
de komende twee weken: hoeveel chauffeurs de ritten vragen (uit het plan en de prognose uit de historie), hoeveel er
volgens het rooster kunnen (na vakantie, ziek, rust, rij- en rusttijden), en het verschil. Te weinig: open ritten,
charters en gemiste ritten, met de kosten als schatting. Te veel: betaalde uren zonder rit, ook als schatting. Eén
scherm "Bezetting" met de twee weken als balken (rood tekort, blauw overschot), per standplaats en voor heel Nederland,
met wat je eraan kunt doen: een dienst verschuiven, een collega van een standplaats verderop lenen, extra diensten
aanbieden via het voorkeursbod, of een charter eerder vastleggen. De tweede bouwsteen van de bezettingsplanning op
termijn (ideeënbank 22, reserve op maat).

Besluiten van Sem, 26 oktober: de directie krijgt het planbord alleen-lezen (kijken, niet slepen); het voorkeursbod is in
de demo per chauffeur zichtbaar.

## 1. Rij- en rusttijden over de week (jouw punt 1)

Wat erbij komt:
- **De week en de twee weken**: hoogstens 56 uur rijden per week en 90 uur per twee weken (EU 561); wekelijkse rust
  45 uur, verkort tot 24 uur met compensatie binnen drie weken; uiterlijk na zes dagrittijden een weekrust. En de cao:
  13 vrije weekenden per half jaar en de venstertijden voor het begin van de diensten (ideeënbank 26).
- **Eén teller per chauffeur** die alles optelt (gereden, nog te rijden vandaag, deze week, deze twee weken, de volgende
  rust), zichtbaar op de chauffeurspagina, in de kandidaatkaart en op het planbord als een rustblok dat je niet kunt
  overschrijven.
- **De toewijzing rekent ermee**: de Hongaarse toewijzing over alle open ritten (4.0) krijgt rij- en rusttijd als harde
  grens, niet als waarschuwing achteraf: wie na de rit niet meer binnen de week past, is geen kandidaat.
- **De Assistent legt het uit**: "Niels Dekker kan niet: na deze rit heeft hij 58 uur in de week." (nummer in plaats
  van naam naar de API, zoals nu).
- **Echte data**: de teller leest straks uit de tachograaf (download via de boordcomputer, Trimble) in plaats van uit de
  simulatie; in 4.1 bouwen we het veld in OTM5-vorm zodat de echte bron erin past.

Lat (meetbaar, in de ochtend-check en een nieuwe week-check): geen enkele toewijzing of sleep die een chauffeur boven 56
uur per week, 90 per twee weken of onder zijn weekrust brengt; elke overtreding in de data geeft een zaak; de teller op
de chauffeurspagina is gelijk aan de som van het planbord. Schatting: twee agentrondes, 1 tot 2 dagen.

## 2. De voorkeursstem van chauffeurs (jouw punt 2)

Wat erbij komt (ideeënbank 3 en 51):
- **Voorkeursbod per week**: elke chauffeur geeft wekelijks zijn voorkeur op open diensten en ritten (ritsoort, tijden,
  weekend, regio, "liever niet"), zoals crew bidding in de luchtvaart. In de demo gesimuleerd per chauffeur; in het
  echt via de chauffeursapp of een eenvoudig formulier.
- **Eerlijk verdelen**: de toewijzing weegt de stem mee en rouleert: wie de laatste weken al veel extra reed of veel
  weekenden had, komt later aan de beurt; het systeem legt per rit uit waarom iemand het kreeg ("tweede keus, maar de
  eerste reed dit kwartaal al vijf weekenden").
- **Zichtbaar voor de planner**: de stem op de kandidaatkaart ("heeft zich opgegeven voor zaterdag"), een kolom op
  de chauffeurspagina, en de tevredenheid per standplaats als cijfer dat erop reageert.
- **Nooit een ranglijst per persoon**: de kans op een ja blijft per groep zichtbaar, niet als score aan de muur
  (signaal OR en AVG, geen juridisch advies).

Lat: op de oefendag krijgt een rit met twee gelijke kandidaten de chauffeur met de voorkeursstem; over acht gesimuleerde
weken is de spreiding van extra ritten en weekenden over de chauffeurs van Wognum meetbaar kleiner dan nu (de meting
staat in de README als schatting). Schatting: twee agentrondes, 1 tot 2 dagen.

## 2b. Vaste routes, voorkeursroutes en plekkennis (jouw aanvulling van 26 oktober, avond)

Wat je zei: een deel van de chauffeurs heeft vaste of voorkeursroutes; en wie nog nooit op een adres is geweest, krijgt
uitleg hoe het daar werkt (aanrijden, dokken), een ervaren chauffeur niet. Zo lees ik het:

- **Vaste routes en voorkeursroutes.** Per chauffeur de routes en klanten die hij vast of vaak rijdt, in de demo uit de
  gesimuleerde historie (wie reed de laatste acht weken welke ritten), in het echt uit het TMS. Een vaste route is een
  harde toewijzing zolang de chauffeur er is; een voorkeursroute telt zwaar mee in de toewijzing (continuïteit: dezelfde
  chauffeur op dezelfde klanten), naast het voorkeursbod. Zichtbaar op de kandidaatkaart ("rijdt deze route vast",
  "was hier 14 keer, laatst dinsdag") en op de chauffeurspagina als zijn vaste routes.
- **Plekkennis per adres.** Per klant en DC één kaart met hoe het daar werkt: de aanrijroute (die hebben we al, uit de
  toegangsroutes van Overture), de poort, het dock of de losplek, de lostijd die we al meten, het contact, en de
  bijzonderheden die planners en chauffeurs erbij zetten ("melden bij de loge", "achteruit insteken dock 4", "geen
  LZV"). Met een stukje luchtfoto van de poort (ideeënbank 31).
- **Eerste keer hier.** Per chauffeur en adres houdt de app bij hoe vaak hij er was. Is het zijn eerste keer (of langer
  dan een jaar geleden), dan gaat de plekkennis mee in het bericht van zijn dienst en in de ritopdracht naar de
  boordcomputer, en staat op de ritpagina "nieuw voor deze chauffeur". Een ervaren chauffeur krijgt alleen de stop. De
  planner ziet bij het vrijgeven wie ergens voor het eerst komt.
- **Wat Simon Loos levert:** de historie wie welke rit reed (TMS), de laad- en losinstructies uit het klantendossier
  (ORTEC en Navitrans hebben daar velden voor), en wat planners en chauffeurs nu in hun hoofd of op papier hebben.

Lat: op de oefendag krijgt een chauffeur die voor het eerst naar een DC gaat de plekkennis in zijn bericht en de
ritopdracht, een ervaren chauffeur niet (test); een vaste route gaat niet naar een ander zolang de vaste chauffeur
beschikbaar is (test); de kandidaatkaart toont de ervaring op het adres. Schatting: één agentronde, 1 dag, in ronde 2
samen met het voorkeursbod.

## 3. Wat uit 4.0 bleef liggen (klein, mee in dezelfde ronde)

- Twee tekstpunten in het Assistent-paneel ("nooit namen of nummers", "dertig vragen per uur").
- De directie kan het planbord openen, alleen-lezen (kijken, niet slepen), als jij dat wilt.
- Lange stopnamen op 390 px (planbordblok, standplaatspagina).
- De volgmeting van de kaarttest met dezelfde klok als de camera, en een vaste "trage machine"-stand in de tests.
- De demosite in losse bestanden met cache (sneller op mobiel: nu 15 MB in één bestand).
- De ochtend-check over zeven dagen, de maandagen na een tijdwissel en de feestdagen (ideeënbank 48).

## 4. Wat ervoor nodig is van Simon Loos

Voor de simulatie niets. Voor de proef met echte data: het rooster en de contracturen per chauffeur (HR of het
roostersysteem), de tachograafdownloads of de werkstaten uit de boordcomputer, de open ritten met venster uit het TMS
(OTM5 uit ORTEC of Navitrans), het kanaal naar de chauffeur (welke mail of welke app, en wie de adressen beheert), de
koppeling van de boordcomputer voor ritopdrachten (welk merk, welke API, wie de sleutel beheert), en een afspraak met
de OR over het voorkeursbod en over wat er per chauffeur zichtbaar is. De vragen staan in `na-4.0.md`.

## 5. Volgorde en oplevering

1. Het rooster en de tellers per chauffeur (A en B, met de weekregels van punt 1), en het model achter Bezetting (F).
2. Plannen en vrijgeven, het bericht aan de chauffeur, de ritopdracht naar de boordcomputer (C, D, E), en het scherm
   Bezetting (F).
3. Voorkeursbod en eerlijk verdelen (punt 2), vaste routes en plekkennis (punt 2b).
4. De kleine punten.
5. Eindcontrole door een aparte agent tegen een bijgewerkte lat (`acceptatie-4.1.md`), daarna dezelfde oplevering als
   4.0: artifact, demosite en SafeTools op dezelfde build, via de website-sessie.

Schatting voor het geheel: zeven tot acht dagen werk, in rondes zoals bij 4.0; de eerste twee stappen zijn de kern en
kunnen apart live.

## Risico's en signalen

Alleen als signaal, geen juridisch advies: de cao-regels van 2026 (Staatscourant 2026, nr. 7211) staan in de code met
status "zoek" en moeten nagelezen worden voor de proef; rij- en rusttijden uit de tachograaf zijn persoonsgegevens met
een wettelijke bewaartermijn; een voorkeursbod en een eerlijkheidsregel zijn een wijziging van het rooster en raken de
instemming van de OR. Een rooster of dienst per mail is een persoonsgegeven in een extern kanaal (bewaartermijn,
wie de adressen beheert); de cao kent termijnen voor het bekendmaken van diensten (status zoek, nalezen voor de proef);
en een ritopdracht naar de boordcomputer is een wijziging in een systeem van een leverancier: dat gaat in de proef pas
na een test op één voertuig.
