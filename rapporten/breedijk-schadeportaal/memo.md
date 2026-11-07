# Schadeportaal voor Breedijk Transport: onderzoek en demo

Voor Sem, 7 november 2026. Aanleiding: je gesprek met Breedijk Transport over hun schadeafhandeling en de
afspraak om een onderzoek te starten met een demo, testdata en een mooie interface. De demo staat in
`demos/breedijk-schadeportaal` (bouwen met `npm run build`, dan `dist/index.html`); de bronnen met hun status
in `bronnen.md` in deze map; de schermafbeeldingen in `schermen/`.

## Wat je vroeg, en hoe ik het las

Letterlijk: een demo van een schadeportaal dat de schade-mailbox, Transpas en de Excel van het management in
een scherm brengt, met verzonnen maar realistische data. Het doel: Breedijk laten zien dat dit snel en
betaalbaar kan, dat de koppelingen bestaan, en dat de behandelaar straks minder handwerk per claim heeft en
het management zijn overzicht vanzelf krijgt. Het ongezegde: een claim is geld en recht (de drempel, het
eigen risico, de limiet per kilogram, de termijn waarbinnen een ontvanger schade moet melden, de handtekening
op de afleverbon), de foto's bij ophalen zijn het bewijs, de chauffeur is een mens met een dossier (AVG en
OR), de tegenpartij claimt soms schade die er al was, en er zijn meer gebruikers dan de behandelaar: de
planner, de directie, de chauffeur die zelf meldt, de verzekeraar en de opdrachtgever die een antwoord met
bewijs krijgt.

## Wat ik deed

- **Het domein uitgezocht** (`bronnen.md`, 556 regels, alles met status). Belangrijkste vondsten: Breedijk
  maakt volgens hun eigen site al zes schouwfoto's per auto bij ophalen en klanten zien die op een eigen
  vervoerspagina met een login (zoek); Transpas van Art Systems heeft volgens meerdere integratiebureaus wel een
  API, toegang loopt via Art Systems en begint in een testomgeving (zoek); onder de AVC 2002 is de
  aansprakelijkheid 3,40 euro per kilogram en moet niet zichtbare schade binnen een week na aflevering
  gemeld worden, met een specifiek voorbehoud bij zichtbare schade (zoek, laten toetsen); de RDW open data
  geeft bij een kenteken merk, kleur, gewicht en cataloguswaarde, gratis (zoek); de schade-mailbox is met
  Microsoft Graph of zonder code met Power Automate te lezen (zoek). Let op: in deze sessie ging geen enkele
  bronpagina open (het netwerk blokkeerde ze), dus niets heeft de status "gelezen". Voor een memo aan
  Breedijk moet elk feit nog een keer met de pagina zelf worden nagekeken.
- **De demo gebouwd**: zeven weergaven (Overzicht, Schades, Dossier, Chauffeurs, Opdrachtgevers, Rapporten,
  Instellingen), een nieuwe melding en zoeken op kenteken; het ontwerpsysteem van de Control Tower (licht en
  donker, 13,5 px, tabulaire cijfers); een gesimuleerde wereld met een vaste seed: 48 chauffeurs, 14
  verzonnen opdrachtgevers, ongeveer 11.000 ritten in 90 dagen (800 per week) en 470 claims over een jaar,
  elk met een verhaal (stond er al, nieuw met voorbehoud, nieuw zonder voorbehoud, onduidelijk, geen rit,
  door de chauffeur gemeld). Het hart is het dossier: de mail links, de rit uit Transpas met het autodiagram
  en de foto's in het midden, rechts zeven signalen met een advies, het besluit en het conceptantwoord. De
  getallen uit het gesprek (1.750 en 750 euro, drie schades in een week) zijn instellingen.
- **Gecontroleerd**: 20 tests zonder browser op de regels en de data (`npm test`) en een Playwright-controle
  in Chromium op 1440, 390 en 1024 px, met minder beweging en ingebed (`tests/verify.mjs`): geen
  consolefouten, geen enkel verzoek naar buiten, geen horizontale overloop in tien weergaven, drie kolommen op
  een scherm en tabbladen op een telefoon, een besluit dat na een herlaad nog staat, het conceptantwoord, een
  nieuwe melding die de rit vindt, zoeken, sneltoetsen, het donkere thema en de rol planner zonder
  chauffeursbeeld. Een Fable-agent heeft de ronde nagekeken (zie onder "Review").

## Waar ik van je vraag afweek, en waarom

- Je noemde Transpas-foto's en de Excel. Ik heb de **afleverbon met handtekening** en de **termijn** als twee
  extra signalen toegevoegd, omdat ze in de voorwaarden de positie van de tegenpartij bepalen en niets
  kosten als je ze ziet. Dat vroeg je niet, maar de behandelaar beslist er dagelijks mee.
- Ik heb de **limiet per kilogram** laten staan als signaal, maar klein: bij bumperschade van een paar
  honderd euro doet hij er zelden toe (een auto van 1.300 kg geeft onder AVC circa 4.420 euro, schatting).
- De demo noemt **geen namen van personen**, ook niet van Breedijk. Chauffeurs heten in de demo "Dennis J."
  en zijn verzonnen; de tegenpartij schrijft als rol ("fleetmanager, Westfries Lease").
- Het accent is **blauw, niet de huisstijl van Breedijk**: die gebruiken we pas met hun akkoord. Het is een
  token, in een regel te wisselen.

## Het proces nu en straks

| Stap | Nu (uit het gesprek) | In het portaal |
| --- | --- | --- |
| Binnenkomst | Een mail in schade@; de behandelaar leest en tikt het kenteken over | De mail wordt een dossier; kenteken, datum, plek en bedrag zijn uitgelezen (met zekerheid en een waarschuwing bij twijfel) |
| Koppelen | Kenteken intikken in Transpas, de rit en de foto's zoeken | De rit staat er al: chauffeur, truck, positie, inspecties, foto's met tijdstip, de handtekening |
| Beoordelen | Uit het hoofd: hebben wij hem gereden, zat de schade er al | Zeven signalen met een advies: vervoerd, stond er al (plek en foto's), getekend, op tijd, limiet, grens verzekeraar, calculatie |
| Antwoorden | Zelf een mail schrijven en de foto's zoeken | Het conceptantwoord met de bewijsstukken en hun tijdstip; nalezen, kopiëren, versturen |
| Boven of onder 1.750 | Zelf uitrekenen | Staat erbij, met het eigen risico en wat het dossier voor de verzekeraar compleet maakt |
| Onderhandelen | De offerte lezen | De calculatie met de punten om te bespreken en een herrekend tegenvoorstel |
| Management | Een Excel bijhouden; drie keer in een week is een gesprek | Het chauffeursbeeld en het maandrapport ontstaan vanzelf; de regel is een instelling en geeft een signaal, afgewezen claims tellen niet |
| Verzekeraar | Stukken bij elkaar zoeken | Het dossier is compleet: vrachtbrief, inspecties, foto's, claim, calculatie, logboek |

## Hoe je het aan Breedijk laat zien (tien minuten)

1. **Overzicht**: "Dit is vrijdagochtend. Negen nieuwe, twee over de termijn, dertig open." Wijs de signalen
   aan: een chauffeur boven de regel, een dealer die vaak schade claimt die er al zat.
2. **Een dossier dat je afwijst** (een "stond er al"): de mail, dan het diagram met de rode ring op
   dezelfde plek, de foto bij ophalen met tijdstip, en rechts het advies. Klik "Conceptantwoord": de brief
   met de bewijsstukken staat klaar. "Dit kostte je net dertig seconden."
3. **Een dossier dat je erkent** (voorbehoud op de afleverbon, boven de 1.750): het signaal "verzekeringswerk,
   eigen risico 750", het besluit "indienen bij de verzekeraar", het dossier dat compleet is.
4. **Chauffeurs**: de regel van drie in een week als instelling, het beeld per persoon, en de noot over de OR.
5. **Rapporten**: het maandoverzicht, "dit is jullie Excel, maar dan elke maand vanzelf", csv en afdrukken.
6. **Instellingen, Koppelingen**: wat in de demo gesimuleerd is en wat het in het echt wordt (Graph of Power
   Automate voor de mailbox, de API van Art Systems voor Transpas, RDW, de Claude API alleen voor de tekst van
   de mail en de foto's van dat dossier).
7. Sluit af met de vraag die alles bepaalt: **waar staan de schouwfoto's** (in Transpas, in Transpas Online,
   of bij de leverancier van de chauffeursapp), en mogen wij Art Systems bellen.

## De koppelroutes (van zeker naar onzeker)

1. **De schade-mailbox.** Microsoft Graph met de application permission Mail.Read op de gedeelde mailbox,
   beperkt tot die ene mailbox, bijlagen via het attachments-endpoint; of zonder code met Power Automate
   ("When a new email arrives in a shared mailbox", met "Include Attachments" aan). Nodig: een uur van de
   Microsoft 365-beheerder. Voor een proef is Power Automate de snelste route (zoek, `bronnen.md` 6).
2. **Transpas.** Volgens integratiebureaus geeft Art Systems API-toegang (eerst staging, OAuth of een sleutel
   met IP-whitelist); er zijn standaardkoppelingen met boordcomputers en boekhouding. Openbare documentatie
   vond ik niet. Terugvalroute: een dagelijkse export van ritregels (kenteken, datum, chauffeur, klant); noodroute:
   mailparsing van de afleverbonnen. Breedijks "gesloten systeem" klopt dus waarschijnlijk niet, maar toegang
   kost tijd en geld via Art Systems (zoek, `bronnen.md` 2).
3. **De foto's.** De grote open vraag. De chauffeursapp of boordcomputer (MobiCoach, Trimble, LogiApp zijn de
   partijen die bij Transpas genoemd worden) bewaart de foto's mogelijk zelf; Transpas toont of linkt ze. Dan
   is de app-leverancier de tweede partij om te vragen (schatting).
4. **RDW open data.** Gratis, open licentie, een verzoek per kenteken: merk, handelsbenaming, kleur, datum
   eerste toelating, massa ledig voertuig, catalogusprijs. Voor de limiet per kilogram en als controle van een
   overgetikt kenteken (zoek, `bronnen.md` 5).
5. **De verzekeraar.** Per mail met het complete pakket; sommige verzekeraars hebben een portaal.

## De rol van AI, en de grens

Realistisch met een taalmodel met beeldinvoer: de velden uit de mail halen; de ophaalfoto naast de claimfoto
leggen en aanwijzen wat erop staat (als hulp, niet als bewijs: licht en hoek verschillen); een voorstel voor
de schadecode; het conceptantwoord met de juiste foto's; de calculatie uitlezen en opvallende posten
markeren. Niet: een juridisch oordeel, een bedrag vaststellen zonder mens, een uitspraak over een chauffeur.
In de demo zijn de uitgelezen velden en het conceptantwoord gesimuleerd (vaste zinnen uit de feiten van de
beoordeling); in het echt doet de Claude API dat met alleen de tekst van die ene mail en de foto's van dat
dossier, contactgegevens eerst gewist, nooit het chauffeursoverzicht. Dezelfde afspraken als bij SafeTools AI.

## Wat je niet vroeg, maar waar je iets aan hebt

1. **De chauffeur meldt zelf, voor de claim komt.** In de demo staan drie dossiers die uit de chauffeursapp
   komen: de chauffeur raakte bij het lossen een bumper, maakte direct foto's en liet de ontvanger tekenen
   met voorbehoud. Als de claim dan komt, ligt het dossier klaar en is er geen discussie meer. Waarde: een
   claim die anders drie mails en een week kost, is in een dag klaar; en de chauffeur die eerlijk meldt,
   wordt niet gestraft door de Excel maar geholpen door het dossier (schatting). Proef: twee chauffeurs vragen
   om een maand lang elke schade die ze zelf veroorzaken direct te melden in de app die ze al hebben, en
   tellen hoe vaak de claim daarna komt.
2. **Het patroon per opdrachtgever.** Een dealer die in een jaar veertien keer claimt en elf keer een schade
   die al op onze ophaalinspectie stond, kost beide partijen werk. Het portaal laat dat zien, en je kunt het
   overzicht meesturen. Een gesprek over hun uitgiftecontrole (hun foto's bij uitgifte, of de schouwfoto's
   van Breedijk als eerste controle) scheelt misschien de helft van die claims (schatting). Proef: de laatste
   drie maanden uit de Excel per opdrachtgever tellen; een middag werk.
3. **De termijnklok.** Onder AVC en CMR moet niet zichtbare schade binnen een week na aflevering gemeld
   worden en zichtbare schade bij aflevering met een specifiek voorbehoud. Een claim na elf dagen zonder
   voorbehoud staat zwak, en dat argument kost niets als je het ziet. De demo zet het bij elke claim bovenaan
   de beoordeling. Waarde: bij acht claims per week, gemiddeld 900 euro en vijftien procent na de termijn,
   circa 27.000 euro per jaar als de helft daarvan vervalt of met korting wordt geschikt (schatting, met een
   grote marge). Proef: de laatste vijftig claims uit de Excel naast de afleverdatum in Transpas leggen.

## Wat we moeten doorvragen

**Bij Breedijk**: hoeveel claims per week en hoeveel daarvan wijs je af omdat de schade er al zat; 800 auto's
per week of per dag (hun site zegt beide); welke voorwaarden op de vrachtbrief (AVC, CMR, eigen) en welke bv
is vervoerder (de site heet "Breedijk Autotransport BV"); worden bij aflevering ook foto's gemaakt en tekent
de ontvanger met of zonder voorbehoud; met welke app maken de chauffeurs de schouwfoto's en is het
klantportaal Transpas Online; mogen we een geanonimiseerd deel van de Excel zien (kolommen, aantallen,
bedragen); is er een ondernemingsraad en weten de chauffeurs van de Excel.
**Bij Art Systems** (en zo nodig de app-leverancier): is er een REST-API voor Transpas Enterprise met
staging en wat kost toegang voor een derde; kun je op kenteken zoeken en krijg je ritten, chauffeur, tijden en
documenten terug; waar staan de schouwfoto's en zijn ze met tijdstip op te halen.
**Bij de verzekeraar of makelaar**: geldt het eigen risico per gebeurtenis of per claim; moet elke
aansprakelijkstelling gemeld worden, ook onder de drempel; welke stukken wil de verzekeraar en mag dat als
een pakket uit het portaal.
**Bij de Microsoft 365-beheerder**: een app-registratie met Mail.Read beperkt tot de schade-mailbox, of
eerst Power Automate; hoe lang mails nu bewaard worden.

## Wat er nodig is om dit echt te laten draaien

Een proef van zes weken met echte claims kan met drie dingen: de schade-mailbox (Power Automate of Graph, een
uur van de beheerder), een dagelijkse export uit Transpas of de API (het gesprek met Art Systems; tot die er
is, tikt de behandelaar het ritnummer over en haalt het portaal de rest op), en de foto's uit de app of het
klantportaal. Daarbij een plek om te draaien (dezelfde opzet als SafeTools: een statische app met een kleine
functie voor de mailbox en de Claude API, de data in een eigen database per klant, in de EU), een
verwerkersovereenkomst met Breedijk, een bewaartermijn (de verjaring is een jaar), en de geanonimiseerde
Excel om de testdata te ijken. Technisch is de demo al gebouwd voor echte data: elke rit, claim en foto heeft
de vorm waarin de API-velden passen, en de drempels zijn instellingen.

## Risico's en signalen (geen juridisch advies)

- **AVG en OR.** Het chauffeursbeeld is mogelijk een personeelsvolgsysteem; dan heeft de OR instemmingsrecht.
  Schademails bevatten persoonsgegevens van de tegenpartij; wie het portaal host, is verwerker. Laten toetsen.
- **De voorwaarden.** Welk artikel van de AVC 2002 de 3,40 euro per kilogram draagt, staat niet vast in de
  bronnen (artikel 13 of 10; de tekst zelf nalezen). Of de week kalenderdagen of werkdagen zijn, en welk gewicht
  telt (ledig, rijklaar, vrachtbrief): laten toetsen.
- **De polis.** Een polis kan eisen dat elke aansprakelijkstelling gemeld wordt, ook als Breedijk zelf
  betaalt. Niet melden kan dekking kosten. Vragen aan de makelaar.
- **Naam en huisstijl.** De demo noemt Breedijk bij naam als opdrachtgever van de demo, zonder logo of
  huisstijl. Voor een demo op een openbaar adres eerst hun akkoord.
- **Kosten.** Toegang tot de Transpas-API loopt via Art Systems en kost waarschijnlijk geld en doorlooptijd.
  Dat is geen reden om te wachten: de mailbox en de Excel zijn al genoeg voor een proef.

## Review

De ronde is nagekeken door een Fable-agent op de werkafspraak (verder denken), de schrijfstijl en de
kwaliteitslat; de bevindingen en wat ermee gedaan is staan in `review.md`.
