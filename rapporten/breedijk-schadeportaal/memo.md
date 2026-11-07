# Schadeportaal voor Breedijk Transport: onderzoek en demo

Voor Sem, 7 november 2026. Aanleiding: je gesprek met Breedijk Transport over hun schadeafhandeling en de
afspraak om een onderzoek te starten met een demo, testdata en een mooie interface. De demo staat in
`demos/breedijk-schadeportaal` (bouwen met `npm run build`, dan `dist/index.html`); de bronnen met hun status
in `bronnen.md` en `bronnen-transplan.md`; het beveiligingsplan in `beveiliging-en-hosting.md`; de review in
`review.md`; de schermafbeeldingen in `schermen/`. Onderaan staat wat er in ronde 2 bijkwam.

## Wat je vroeg, en hoe ik het las

Letterlijk: een demo van een schadeportaal dat de schade-mailbox, Transplan en de Excel van het management in
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
  vervoerspagina met een login (gelezen, 7 november, later op de dag: de host ging toen open; `bronnen.md` zegt
  nog "zoek"); het TMS heet **Transplan**
  (RGB+, transplan.nl: autotransportsoftware met RDW-data, een OrderExchange, orderintegratie op OTM en EDI,
  boordcomputerkoppelingen en apps als Efficio en EasyTrack van Rietveld; een Power BI-koppeling en SnelStart
  gebruiken zijn API; zoek). Ronde 1 nam ten onrechte Transpas van Art Systems aan; `bronnen.md` onderwerp 2
  gaat over dat verkeerde product, `bronnen-transplan.md` over het juiste; onder de AVC 2002 is de
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
  door de chauffeur gemeld). Het hart is het dossier: de mail links, de rit uit Transplan met het autodiagram
  en de foto's in het midden, rechts zeven signalen met een advies, het besluit en het conceptantwoord. De
  getallen uit het gesprek (1.750 en 750 euro, drie schades in een week) zijn instellingen.
- **Gecontroleerd**: 20 tests zonder browser op de regels en de data (`npm test`) en een Playwright-controle
  in Chromium op 1440, 390 en 1024 px, met minder beweging en ingebed (`tests/verify.mjs`): geen
  consolefouten, geen enkel verzoek naar buiten, geen horizontale overloop in tien weergaven, drie kolommen op
  een scherm en tabbladen op een telefoon, een besluit dat na een herlaad nog staat, het conceptantwoord, een
  nieuwe melding die de rit vindt, zoeken, sneltoetsen, het donkere thema en de rol planner zonder
  chauffeursbeeld. Een Fable-agent heeft de ronde nagekeken (zie onder "Review").

## Waar ik van je vraag afweek, en waarom

- **Niet dubbel bouwen.** Transplan heeft al een schadedossier (Kwaliteitsregistratie) en Breedijk al een
  fotoportaal voor klanten (Moving IT). Het schadeportaal moet toevoegen wat daar niet zit: de claim van de
  tegenpartij uit de mailbox, laden naast lossen op een diagram, de termijn en het voorbehoud uit de
  vervoerscondities, het conceptantwoord, het dossier voor de verzekeraar en het beeld per chauffeur en
  opdrachtgever zonder Excel. Dat is ook de volgorde van het gesprek met RGB+: eerst wat er al is.

- Je noemde Transplan-foto's en de Excel. Ik heb de **afleverbon met handtekening** en de **termijn** als twee
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
| Koppelen | Kenteken intikken in Transplan, de rit en de foto's zoeken | De rit staat er al: chauffeur, truck, positie, inspecties, foto's met tijdstip, de handtekening |
| Beoordelen | Uit het hoofd: hebben wij hem gereden, zat de schade er al | Zeven signalen met een advies: vervoerd, stond er al (plek en foto's), getekend, op tijd, limiet, grens verzekeraar, calculatie |
| Antwoorden | Zelf een mail schrijven en de foto's zoeken | Het conceptantwoord met de bewijsstukken en hun tijdstip; nalezen, kopiëren, versturen |
| Boven of onder 1.750 | Zelf uitrekenen | Staat erbij, met het eigen risico en wat het dossier voor de verzekeraar compleet maakt |
| Onderhandelen | De offerte lezen | De calculatie met de punten om te bespreken en een herrekend tegenvoorstel |
| Management | Een Excel bijhouden; drie keer in een week is een gesprek | Het chauffeursbeeld en het maandrapport ontstaan vanzelf; de regel is een instelling en geeft een signaal, afgewezen claims tellen niet |
| Verzekeraar | Stukken bij elkaar zoeken | Het dossier is compleet: vrachtbrief, inspecties, foto's, claim, calculatie, logboek |

## Hoe je het aan Breedijk laat zien (tien minuten)

1. **Overzicht**: "Dit is vrijdagochtend. Negen nieuwe, drie over de termijn, 38 open." Wijs de signalen
   aan: een chauffeur boven de regel, een dealer die vaak schade claimt die er al zat.
2. **Een dossier dat je afwijst** (een "stond er al"): de mail, dan het diagram met de rode ring op
   dezelfde plek, de foto bij ophalen met tijdstip, en rechts het advies. Klik "Conceptantwoord": de brief
   met de bewijsstukken staat klaar. "Dit kostte je net dertig seconden."
3. **Een dossier dat je erkent** (voorbehoud op de afleverbon, boven de 1.750): het signaal "verzekeringswerk,
   eigen risico 750", het besluit "indienen bij de verzekeraar", het dossier dat compleet is.
4. **Chauffeurs**: de regel van drie in een week als instelling, het beeld per persoon, en de noot over de OR.
5. **Rapporten**: het maandoverzicht, "dit is jullie Excel, maar dan elke maand vanzelf", csv en afdrukken.
6. **Instellingen, Koppelingen**: wat in de demo gesimuleerd is en wat het in het echt wordt (Graph of Power
   Automate voor de mailbox, de API van RGB+ voor Transplan, RDW, de Claude API alleen voor de tekst van
   de mail en de foto's van dat dossier).
7. Sluit af met de vraag die alles bepaalt: **waar staan de schouwfoto's** (in Transplan, in het klantportaal van Transplan,
   of bij de leverancier van de chauffeursapp), en mogen wij RGB+ bellen.

## De koppelroutes (van zeker naar onzeker)

1. **De schade-mailbox.** Microsoft Graph met de application permission Mail.Read op de gedeelde mailbox,
   beperkt tot die ene mailbox, bijlagen via het attachments-endpoint; of zonder code met Power Automate
   ("When a new email arrives in a shared mailbox", met "Include Attachments" aan). Nodig: een uur van de
   Microsoft 365-beheerder. Voor een proef is Power Automate de snelste route (zoek, `bronnen.md` 6).
2. **Transplan (RGB+).** Transplan adverteert zelf met orderintegratie op OTM en EDI, boordcomputerkoppelingen,
   een OrderExchange en RDW-data; er is een tweerichtingskoppeling met Autotelex (orders erin, statussen terug),
   SnelStart noemt het koppeltype API en kpisolutions.nl verkoopt een Power BI-koppeling op de Transplan-API
   (zoek, `bronnen-transplan.md`). Breedijks "het ondersteunt geen koppelingen" betekent dus waarschijnlijk: geen
   koppeling in hun huidige licentie of inrichting, niet dat het niet kan. Terugvalroute: een dagelijkse export van
   ritregels (kenteken, datum, chauffeur, klant); noodroute: de documenten die Transplan al mailt. Toegang en
   voorwaarden lopen via RGB+ (schatting).
3. **De foto's.** Transplan zegt zelf dat scans en foto's tussen chauffeur en TMS gedeeld worden, en heeft een
   schademodule (Kwaliteitsregistratie) met schadedossiers waarin externe partijen kunnen meekijken; de
   boordcomputers die Transplan noemt zijn die van Rietveld (Efficio en EasyTrack), Platform Science, Transics,
   Webfleet en Data2track (gelezen, `bronnen-transplan.md`). Breedijks klantportaal met de schouwfoto's draait
   bij Moving IT (breedijk.movingit.nl; gelezen). De foto's staan dus bij Transplan, bij de boordcomputer of bij
   Moving IT: de eerste vraag aan RGB+ is hoe het portaal van Moving IT zijn data krijgt, want die route bestaat al.
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
2. **Het patroon per opdrachtgever.** Een garage die in een jaar elf keer claimt en zeven keer een schade
   die al op onze ophaalinspectie stond (in de demo Garage Zuidwal: acht van de elf afgewezen), kost beide
   partijen werk. Het portaal laat dat zien, en je kunt het
   overzicht meesturen. Een gesprek over hun uitgiftecontrole (hun foto's bij uitgifte, of de schouwfoto's
   van Breedijk als eerste controle) scheelt misschien de helft van die claims (schatting). Proef: de laatste
   drie maanden uit de Excel per opdrachtgever tellen; een middag werk.
3. **De termijnklok.** Onder AVC en CMR moet niet zichtbare schade binnen een week na aflevering gemeld
   worden en zichtbare schade bij aflevering met een specifiek voorbehoud. Een claim na elf dagen zonder
   voorbehoud staat zwak, en dat argument kost niets als je het ziet. De demo zet het bij elke claim bovenaan
   de beoordeling. Waarde: bij acht claims per week, gemiddeld 900 euro en vijftien procent na de termijn,
   circa 27.000 euro per jaar als de helft daarvan vervalt of met korting wordt geschikt (schatting, met een
   grote marge). Proef: de laatste vijftig claims uit de Excel naast de afleverdatum in Transplan leggen.

## Wat we moeten doorvragen

**Bij Breedijk**: hoeveel claims per week en hoeveel daarvan wijs je af omdat de schade er al zat; 800 auto's
per week of per dag (hun site zegt beide); welke voorwaarden op de vrachtbrief (AVC, CMR, eigen) en welke bv
is vervoerder (de site heet "Breedijk Autotransport BV"); worden bij aflevering ook foto's gemaakt en tekent
de ontvanger met of zonder voorbehoud; met welke app maken de chauffeurs de schouwfoto's en is het
klantportaal van Transplan of iets anders; mogen we een geanonimiseerd deel van de Excel zien (kolommen, aantallen,
bedragen); is er een ondernemingsraad en weten de chauffeurs van de Excel.
**Bij RGB+** (en zo nodig Rietveld, de maker van Efficio en EasyTrack): is er een API of een OTM-koppeling voor
Transplan met een testomgeving en wat kost toegang voor een derde; kun je op kenteken zoeken en krijg je ritten,
chauffeur, tijden en documenten terug; waar staan de schouwfoto's (Transplan, de boordcomputeromgeving of een app)
en zijn ze met tijdstip op te halen; wat zit er in Breedijks licentie.
**Bij de verzekeraar of makelaar**: geldt het eigen risico per gebeurtenis of per claim; moet elke
aansprakelijkstelling gemeld worden, ook onder de drempel; welke stukken wil de verzekeraar en mag dat als
een pakket uit het portaal.
**Bij de Microsoft 365-beheerder**: een app-registratie met Mail.Read beperkt tot de schade-mailbox, of
eerst Power Automate; hoe lang mails nu bewaard worden.

## Wat er nodig is om dit echt te laten draaien

Een proef van zes weken met echte claims kan met drie dingen: de schade-mailbox (Power Automate of Graph, een
uur van de beheerder), een dagelijkse export uit Transplan of de API (het gesprek met RGB+; tot die er
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
- **Kosten.** Toegang tot de Transplan-API loopt via RGB+ en kost waarschijnlijk geld en doorlooptijd.
  Dat is geen reden om te wachten: de mailbox en de Excel zijn al genoeg voor een proef.

## Ronde 2 (7 november, later op de dag): je vragen en wat er veranderde

**Waar het draait.** De broncode staat in de repo `Sem-Appel` (`demos/breedijk-schadeportaal`), naast de Control
Tower; rapporten in `rapporten/breedijk-schadeportaal`. De gebouwde demo is een bestand van 215 kB dat helemaal in
de browser draait, zonder server. Een kopie staat in de repo `controltower-demo` onder `public/schadeportaal/`:
dat is de demosite op Netlify achter het wachtwoord (`controltower-demo.netlify.app/schadeportaal/` zodra de
hoofdtak gedeployed is; nu staat het op de tak `claude/practical-noether-wfghcv`). In SafeTools (safetail.nl) zit
het nog niet: dat is dezelfde route als de Control Tower (een site-build en een pagina achter de `/intern`-poort)
en doen we na het gesprek met Breedijk.

**Transplan.** Je had gelijk: het TMS is Transplan van RGB+ (Raalte), niet Transpas van Art Systems. RGB+ noemt
Breedijk zelf als klant. Transplan koppelt in twee richtingen (Autotelex, CarCollect via de OrderExchange, OTM5
met Euser en Albert Heijn via Simacan, EDI, boordcomputers van Rietveld, Platform Science, Transics, Webfleet en
Data2track, zes boekhoudpakketten), heeft een rapport-editor met geplande exports per mail en een schademodule
(Kwaliteitsregistratie) die foto's met de boordcomputer deelt. Breedijks klantportaal met de schouwfoto's draait
bij Moving IT. "Geen koppelingen" betekent dus waarschijnlijk: niet in hun licentie of inrichting, en niet zonder
RGB+. Alles in `bronnen-transplan.md` (gelezen).

**Beveiliging en hosting.** Het antwoord op je vraag staat in `beveiliging-en-hosting.md`: zet het portaal in een
omgeving die van Breedijk is (hun eigen Microsoft-tenant en een Azure-abonnement op hun naam), zodat de data nooit
bij SafeTail staat en wij alleen binnenkomen als Breedijk die deur tijdelijk opent; beveilig in lagen (hun eigen
Microsoft-accounts met MFA, elke koppeling met de kleinst mogelijke rechten, alles versleuteld, een logboek dat
niemand kan wissen, geoefende back-ups); ga er in vijf stappen heen, elk met een weg terug, en begin pas met echte
mails als de verwerkersovereenkomst, een korte privacytoets en het gesprek met de OR rond zijn. Met een checklist
van twintig punten voor livegang.

**Wat er in de demo veranderde.** Het dashboard (toets 5) in de huisstijl van Breedijk: vijf tegels met de
richting en een vonklijn, de kosten per maand, de uitkomst, waar de schade zit als warmtekaart op de auto, per
vestiging, wanneer het gebeurt, de opdrachtgevers en de spreiding van de chauffeurs. De koppelingen die echt
werken: een mail plakken en uitlezen (zonder taalmodel, niets naar buiten), een rittenexport inlezen met het
voorbeeldbestand als datacontract, en de RDW live op jouw klik (typ een echt kenteken bij "Nieuwe melding"). De
keten ophalen, overslagterrein, uitleveren met twee chauffeurs en een intake-controle: de reviewer zag dat de
demo onze eigen handtekening op het terrein als bewijs gebruikte, dat is eruit. De interface rustiger: kortere
teksten, een label "gesimuleerd" met de uitleg als tooltip, drie kolommen in plaats van vijf waar dat kon. De
reparaties uit de review staan in `review.md`.

**Over foto's van internet.** De demo bundelt foto's van automodellen en schades van Wikimedia Commons met een vrije
licentie en een bronnenlijst (`src/assets/fotos/BRONNEN.md`); ze laadt niets van buiten. Geen foto toont een echt
dossier. De huisstijl is het rood van hun site; hun logo en letter (Aller, een Adobe-licentie) gebruiken we niet
zonder hun akkoord.

## Review

De ronde is nagekeken door een Fable-agent op de werkafspraak (verder denken), de schrijfstijl en de
kwaliteitslat; de bevindingen en wat ermee gedaan is staan in `review.md`.

## Ronde 3 (dezelfde dag): rust, en de open-sourcebouwstenen

Je zei: te druk, AI-achtig, subtieler en mooier, meer inklappen. De ontwerpskill in de repo (`.claude/skills/
design-taste-frontend`, de lijst met kenmerken van gegenereerde pagina's) wees dezelfde dingen aan: overal
1px-kaders, kleine kapitalen als groepslabels, pillen, iconen in rondjes, overal dezelfde ronding. Wat er veranderde:
witte kaarten zonder rand op een grijze pagina (structuur uit ruimte en toon), status als tekst met een stip, een
dunne voortgangslijn, de beoordeling als een lijst van acht regels waarvan alleen de punten die aandacht vragen
openstaan, de foto's per moment, de calculatie, de notities en het logboek achter een kopje (de map met een treffer
staat open), de mail ingekort met "Lees de hele mail", en een eigen letter.

**Bouwstenen die ik gebruikte**, allemaal met een vrije licentie en gebundeld in de pagina (de demo laadt niets van
buiten): Source Sans 3 (Adobe, SIL Open Font License; een humanistische letter dicht bij de Aller van hun eigen
site, die een Adobe-licentie heeft), de iconen van Lucide (ISC), `img-comparison-slider` (MIT) om de ophaalfoto
naast de foto van de tegenpartij te schuiven, en Wikimedia Commons als fotobron (CC BY-SA, met naamsvermelding
onder Instellingen en in `src/assets/fotos/BRONNEN.md`). Bekeken en niet gebruikt: MonkJS (een React-pakket voor
schade-inspectie met een autowireframe; onze demo is geen React en het diagram is al van onszelf), Tabler en
shadcn (UI-kits die het "sjabloon"-gevoel juist versterken), PhotoSwipe (zwaarder dan onze eigen dialoog nodig heeft).

**De foto's.** Commons remde het ophalen af vanaf ons netwerk (hoogstens een verzoek per tien seconden), dus de
eerste ronde leverde zes automodellen op; de schadefoto's lopen nog. Een foto met een dealersticker ging eruit
(een bedrijfsnaam naast het merk). Elke foto staat met maker en licentie in het manifest; de kleur van de
gesimuleerde auto volgt de foto van het model, zodat de kop van het dossier klopt met de data.

## Ronde 4 (dezelfde dag): ladingsschade, aanrijschade en diverse schade

**Wat je vroeg, en hoe ik het las.** Breedijk legde uit welke soorten schade er zijn: ladingsschade (een auto van
een opdrachtgever die bij het laden of afzetten tegen onze vrachtwagen of een paal komt), aanrijschade aan de eigen
vrachtwagen (een paal, een stoeprand, bij het inparkeren in de vakken langs de combinatie ernaast), aanrijschade aan
een derde (achteruit tegen een geparkeerde auto, soms zonder dat de chauffeur het merkt) en diverse schade (booster,
sleutel). Het proces is altijd hetzelfde: het schadeformulier van de chauffeur, het pakket naar de verzekering, het
eigen risico. Ik las je zin "het gaat niet om autootjes maar om vrachtwagens" als: het portaal moet over al onze
schades gaan, niet alleen over de auto's die we vervoeren. Ladingsschade blijft dus, de rest komt erbij.

**Wat ik deed.** Elk dossier heeft een soort, met een eigen afhandeling en de eigen polis:
- **Eigen voertuig**: ons voertuig op een zijaanzicht van de autotransporter, de werkorder (raming, uren,
  onderdelen, dagen uit de roulatie, "Start herstel", "Klaar"), de keuze werkplaats, herstelbedrijf of
  cascoverzekeraar met een grens die een instelling is (5.000 euro, schatting: jij noemde "richting de 10.000" voor de
  verzekering en negen van de tien in de eigen werkplaats).
- **Derde**: de telematica (posities van de boordcomputer rond het moment: was ons voertuig er, hoe hard, achteruit),
  de tegenpartij (particulier of bedrijf, met de AVG-noot), het eenzijdige of het Europees schadeformulier, de
  WA-verzekeraar, en het signaal "erken zelf geen aansprakelijkheid" (polisvoorwaarden, laten toetsen). Was ons
  voertuig er niet, dan is het advies afwijzen, met een brief die de afstand noemt.
- **Divers**: een klein bedrag voor eigen rekening; een sleutel van een vervoerde auto eerst bij de opdrachtgever
  navragen.
- **Overal**: het pakket voor de juiste verzekeraar met wat er al is en wat ontbreekt, "Vraag het schadeformulier"
  met de tekst voor de chauffeursapp, de soort als filter in de lijst en op het dashboard (een kaart per soort met de
  kosten, een kaart voor ons wagenpark), het wagenpark als eigen weergave met een pagina per voertuig, een nieuwe
  melding per soort, en een geplakte mail met het kenteken van een van onze eigen vrachtwagens wordt vanzelf een
  aanrijschade derde. Gesimuleerd: 42 trekkers met hun oplegger, 78 aanrijschades eigen voertuig, 26 aan een derde en
  12 diverse schades over een jaar (schatting). Gecontroleerd: 29 tests zonder browser en de browsercontrole op 1440,
  1024 en 390 px, met een dossier van elke soort.

**Waar ik van je vraag afweek.** Geen echte namen van tegenpartijen ("Particulier in Hoorn", "Bedrijf in Apeldoorn");
de grens naar de casco en de eigen risico's voor casco en WA zijn schattingen tot Breedijk de polis noemt.

**Wat je niet vroeg, maar waar je iets aan hebt.**
1. **De telematica als eerste toets bij een derde.** Jouw voorbeeld van de chauffeur die het niet doorhad, is precies
   waar posities het verschil maken: binnen een minuut weet je of het ons voertuig was en wie reed. De boordcomputers
   die Transplan noemt registreren posities (gelezen). Proef: tien afgesloten derde-claims naast de ritregistratie.
2. **Het schadeformulier als vragenpad in de chauffeursapp.** Rietvelds Efficio heeft activiteiten met een vragenpad
   (gelezen): het formulier op de boordcomputer, met foto's en positie, direct in het dossier. Dat scheelt de dagen dat
   de verzekeraar wacht.
3. **Stilstand per voertuig.** Een schade kost ook dagen dat een autotransporter niet rijdt. Het wagenpark laat per
   voertuig zien hoeveel; dat is het argument voor preventie zoals een camera achter of sensoren bij inparkeren.

**Wat we moeten doorvragen.** Welke polissen (casco, WA, vervoerdersaansprakelijkheid) en welke eigen risico's;
vanaf welk bedrag gaat een aanrijschade naar de verzekeraar; vult de chauffeur nu een papieren formulier in; houdt de
werkplaats werkorders bij in Transplan (wagenparkbeheer) of los; kunnen we de posities van de boordcomputer
opvragen (Rietveld of een andere leverancier); wie beslist of een chauffeur na een aanrijschade een gesprek krijgt.

**Wat er nodig is om dit echt te laten draaien.** Naast de mailbox en Transplan uit de vorige ronden: de posities
van de boordcomputer (een export of de API van de leverancier), de werkorders van de werkplaats, en de polisnummers en
eigen risico's per polis. **Risico's en signalen:** posities en een schadebeeld per chauffeur zijn gevoelig (AVG,
instemming van de OR, laten toetsen); de naam en het adres van een particuliere tegenpartij alleen in het dossier en
naar de verzekeraar.
