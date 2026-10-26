# Plan 4.1: wat de volgende keer live gaat

Voor Sem, 26 oktober 2026. Jouw twee punten staan bovenaan: rij- en rusttijden over de hele week, en de voorkeursstem
van chauffeurs. Daarna wat uit 4.0 bleef liggen. Alles gesimuleerd tot de proef met echte data; elke schatting heet
schatting. Volgorde is prioriteit; wat af en groen is gaat mee, wat niet af is blijft eruit (dezelfde regel als bij 4.0).

## Wat 4.0 al doet (geen dubbel werk)

- Per dag: na 4,5 uur rijden 45 minuten pauze; 9 uur rijden, twee keer per week 10 (EU 561/2006); dagelijkse rust 11 uur,
  hoogstens drie keer tussen twee weekrusten 10 (de cao beroepsgoederenvervoer, strenger dan EU 561). Het planbord toetst
  elke sleep en elk voorstel ermee (`src/ui/toets.js`), een bestelbus tot 3,5 ton valt erbuiten, en bij elke kandidaat
  voor een open rit staat de waarschuwing (rijtijd, rust, uren).
- Voorkeuren: per chauffeur weekdag en dagdeel (vroeg, dag, avond, nacht), ritsoort en regio; "past slecht bij de
  voorkeur" als stille stip op het planbord, de kans op een ja rekent ermee, en een tevredenheidscijfer per standplaats
  (`src/voorkeuren.js`, `src/inzet.js`).

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

## 3. Wat uit 4.0 bleef liggen (klein, mee in dezelfde ronde)

- Twee tekstpunten in het Assistent-paneel ("nooit namen of nummers", "dertig vragen per uur").
- De directie kan het planbord openen, alleen-lezen (kijken, niet slepen), als jij dat wilt.
- Lange stopnamen op 390 px (planbordblok, standplaatspagina).
- De volgmeting van de kaarttest met dezelfde klok als de camera, en een vaste "trage machine"-stand in de tests.
- De demosite in losse bestanden met cache (sneller op mobiel: nu 15 MB in één bestand).
- De ochtend-check over zeven dagen, de maandagen na een tijdwissel en de feestdagen (ideeënbank 48).

## 4. Wat ervoor nodig is van Simon Loos

Voor de simulatie niets. Voor de proef met echte data: het dienstrooster en de contracturen per chauffeur (HR), de
tachograafdownloads of de werkstaten uit de boordcomputer (Trimble), de open ritten met venster uit het TMS (OTM5 uit
ORTEC of Navitrans), en een afspraak met de OR over het voorkeursbod en over wat er per chauffeur zichtbaar is. De
vragen staan in `na-4.0.md`.

## 5. Volgorde en oplevering

1. Rij- en rusttijden over de week (lat, tests, teller, toewijzing, Assistent).
2. Voorkeursbod en eerlijk verdelen.
3. De kleine punten.
4. Eindcontrole door een aparte agent tegen een bijgewerkte lat (`acceptatie-4.1.md`), daarna dezelfde oplevering als
   4.0: artifact, demosite en SafeTools op dezelfde build, via de website-sessie.

Schatting voor het geheel: drie tot vier dagen werk, in rondes zoals bij 4.0. Jij beslist over twee dingen vooraf: of de
directie het planbord alleen-lezen krijgt, en of het voorkeursbod in de demo per chauffeur zichtbaar mag zijn of alleen
per groep (de OR-vraag).

## Risico's en signalen

Alleen als signaal, geen juridisch advies: de cao-regels van 2026 (Staatscourant 2026, nr. 7211) staan in de code met
status "zoek" en moeten nagelezen worden voor de proef; rij- en rusttijden uit de tachograaf zijn persoonsgegevens met
een wettelijke bewaartermijn; een voorkeursbod en een eerlijkheidsregel zijn een wijziging van het rooster en raken de
instemming van de OR.
