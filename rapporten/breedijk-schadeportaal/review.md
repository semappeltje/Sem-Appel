# Review ronde 1: Schadeportaal voor Breedijk Transport

Fable-controleur, 7 november 2026. Getoetst tegen `verder-denken`, de schrijfstijl en de lat van ONTWERP-4.
Gebruikt: `npm test` (20 tests), `node tests/verify.mjs 8791`, eigen Playwright-scripts op 1440, 1024 en 390 px
(licht, donker, minder beweging, toetsenbord, verzoeken naar buiten), een script met tegenvoorbeelden voor
`beoordeel`, tellingen op de gesimuleerde wereld, en greps op de teksten. Schermafbeeldingen en logs staan in
`/tmp/claude-0/-home-user/90869673-01c6-573d-b487-b3ef5c10476a/scratchpad/review/` (hieronder alleen de bestandsnaam).
Terwijl ik keek, werkte een andere agent door aan de correctie Transpas → Transplan; de tijden hieronder zijn 10:32.

## Oordeel in drie zinnen

Nog niet aan Sem laten zien; wel na de reparaties onder "Moet eerst", en de meeste daarvan zijn een halve dag werk.
Het hart is sterk: het dossier met het diagram, de zeven signalen, het conceptantwoord met tijdstippen en de
rapporten ogen op 1440 px als een echt product, zonder een verzoek naar buiten, zonder consolefout en zonder overloop.
Maar op een telefoon en op 1024 px is de navigatie kapot door een CSS-fout, de helft van de ritten eindigt op het eigen
terrein zodat het sleutelsignaal en de brief daar niet kloppen, drie regels geven een leeg of oneerlijk advies, en de
naamswissel van het TMS is halverwege.

## Moet eerst

1. **Onderbalk en zijbalk werken niet op een telefoon en op 1024 px.** `src/style.css` zet `--bbar:58px` en
   `--sidew:0px` (regel 414) en `--sidew:64px` (regel 412) op de root `.bsp` binnen haar eigen `@container bsp`.
   Een element kan zijn eigen containerquery niet beantwoorden, dus die variabelen blijven 0 en 232 px. Gemeten:
   op 390, 412 en 375 px is de onderbalk 1 px hoog (de rand) met de iconen half buiten beeld en zonder labels,
   `.views` krijgt geen onderrand van 58 px, de toasts staan op `bottom:16px`; op 1024 px blijft de zijbalk 232 px
   breed terwijl de labels verborgen zijn (`390-bar-mobiel.png`, `390-overzicht.png`, `1024-overzicht.png`).
   Bewijs van de oorzaak: `--bbar:58px` op de root gezet geeft meteen een balk van 58 px op 786 px en 58 px
   onderrand (`390-bar-gerepareerd.png`). `verify.mjs` test alleen `display:flex`. Voorstel: zet de variabelen in
   die blokken op een kind (`.main`, `.side`, `.bottombar`, `.views`) of maak van die twee blokken `@media`-regels;
   laat `verify.mjs` de hoogte van de balk (390) en de breedte van de zijbalk (1024) meten.
2. **Een rit naar het eigen terrein telt als aflevering aan de tegenpartij.** `src/data.js` regel 109 tot 111 laat 45
   procent van de ritten eindigen op "overslagterrein Breedijk, Opmeer", met een ontvanger uit `ROLLEN_ONTVANGER`.
   Geteld: 226 van de 463 claims met rit (49 procent) hebben zo een rit; 149 daarvan krijgen het groene signaal
   "Bij aflevering getekend zonder voorbehoud" (`regels.js` regel 120) en 129 afwijsbrieven schrijven "de
   afleverbon van 21 okt 15:10 (Opmeer), door jullie magazijnmedewerker getekend zonder voorbehoud"
   (`antwoord.js` regel 19; voorbeeld S-2026-0561). Dat is onze eigen handtekening, geen bewijs tegen de
   tegenpartij; een behandelaar van Breedijk ziet dat in de eerste brief. Voorstel voor nu: eindigt de rit op het
   eigen terrein, dan wordt het signaal "Afgeleverd op ons eigen terrein, geen handtekening van de tegenpartij"
   (kleur info) en laat de brief de afleverbon weg. Voor ronde 2: de keten modelleren (aanvoer, terrein, uitlevering
   met een tweede chauffeur; de claim komt na de uitlevering; de dagen op het terrein zijn de fase "terrein").
3. **Drie regels in `src/regels.js`.**
   a. Voorbehoud zonder calculatie geeft "Erkennen, zelf betalen" voor 0 euro: de voorbehoud-tak (regel 145) staat
      voor de toets op een calculatie (regel 148). 29 claims in de wereld, open S-2026-0533 en S-2026-0587
      (`1440-dossier-voorbehoud-zonder-calc.png`: advies erkennen, "Onze kosten: € 0"); "Besluit vastleggen" schrijft
      "Besluit: Erkennen, zelf betalen (€ 0)" in het logboek. Voorstel: zonder calculatie altijd "Meer informatie vragen".
   b. `gesprekSignaal` (regel 183) telt een claim met status "nieuw" mee en sluit "gesloten_afgewezen" uit, een
      status die niet bestaat: "Sluit dossier" op een afgewezen claim (`dossier.js` regel 109) geeft status
      "gesloten" met besluit "afgewezen", en die telt dan mee tegen de chauffeur. Het gesprek van Dennis J. rust op
      S-2026-0574 van 2 november, status nieuw: nog door niemand bekeken. `chauffeurs.js` regel 6 telt wel goed, dus
      de pagina en het signaal spreken elkaar tegen. Voorstel: tel alleen besluiten erkend of verzekeraar (ook na
      sluiten) en toon open claims apart als "nog te beoordelen (n)". Tegenvoorbeeld 7 in `tegen.mjs` bewijst het.
   c. Aangrenzend is te sterk: een kras tot 2,5 cm op het zijpaneel linksachter maakt een deuk van 15 tot 30 cm op de
      bumper achter "stond er al", met advies afwijzen als sterk bewijs (tegenvoorbeeld 1; `zelfdePlek` regel 95,
      advies regel 144 tot 146). In de simulatie komt het niet voor (de forcering gebruikt dezelfde plek: 0 van 202),
      met echte data wel. Voorstel: dezelfde plek en soort is "ok"; een buurplek, een andere soort of een ernst die
      twee klassen lager ligt wordt "let" ("mogelijk dezelfde schade, leg de foto's naast elkaar") met advies
      chauffeur of informatie, nooit afwijzen op dat signaal alleen.
4. **De naamswissel Transpas → Transplan is halverwege.** `src/` en `dist/` zeggen nu "Rit in Transplan" en "de API
   van RGB+", maar: `memo.md` regel 105 schrijft MobiCoach, Trimble en LogiApp toe aan Transplan terwijl dat de
   vondsten over Transpas zijn (`bronnen.md` regel 106 tot 113) en regel 26 van het memo Efficio en EasyTrack van
   Rietveld noemt; `bronnen.md` onderwerp 2 en de vragen 8 tot 10 (regel 511 tot 519) gaan over Art Systems;
   `bronnen-transplan.md` wordt genoemd (`bronnen.md` regel 19, `memo.md` regel 28 en 100) maar bestaat om 10:32 niet;
   de 24 schermafbeeldingen in `schermen/` tonen nog "Rit in Transpas" en "Noordlease". Ook: `memo.md` regel 24 noemt
   het schouwfotofeit "gelezen, 7 november, na het openzetten van de host", terwijl `bronnen.md` regel 67 "zoek" zegt
   en `memo.md` regel 33 zegt dat niets gelezen is. Maak die drie gelijk, en zet het onderzoek naar RGB+ met status
   erbij voordat het memo naar Sem gaat.
5. **Een echte leasemaatschappij in de testdata.** "Noordlease" (`data.js` regel 29, gevestigd in Groningen) bestaat
   echt: in 2017 overgenomen door Hitachi Capital, daarna de overname van Lease Visie met een ACM-besluit (zoek,
   internationalfleetworld.com en acm.nl). Ik heb de naam vervangen door "Reitdiep Lease" (zie onder). Laat voor de
   demo naar Breedijk gaat de andere 13 opdrachtgevers en de 6 herstelbedrijven in `data.js` regel 27 tot 40 en 163
   in de KvK nakijken; een zoekopdracht vond "Autocentrum Veluwe", "Autobedrijf De Kolk", "FleetDirect" en
   "Autoschade Noord" niet (zoek), maar wel "De Veluwe Auto's" in Nijkerk. Vraag Sem ook of de behandelaars van
   Breedijk Ilse of Ruben heten (`instellingen.js` regel 10, `data.js` regel 235 tot 239); zo ja, andere namen.
6. **De rol "Chauffeur" belooft wat de demo niet doet.** `ROLLEN.chauffeur` zegt "meldt een schade en ziet zijn
   eigen dossiers" (`src/instellingen.js` regel 120), maar in die rol zie je het overzicht met alle cijfers, de lijst
   met 142 dossiers van alle chauffeurs, de opdrachtgevers en de rapporten (gemeten; `1440-rol-chauffeur.png`).
   Naast de AVG-noot op de pagina Chauffeurs spreekt de demo zichzelf hier tegen. Voorstel: de rol koppelen aan een
   chauffeursnummer en alles op dat nummer filteren, of de rol uit de demo halen tot dat er is.

## Zou beter

- **Het register van het conceptantwoord.** Op "Geachte heer, mevrouw, … Wij stellen u aansprakelijk" antwoordt de
  demo met "Beste schadecoördinator van Westfries Lease," en "jullie" (`antwoord.js` regel 9, 19, 27; S-2026-0572).
  Volg het register van de inkomende mail: formeel wordt "Geachte heer, mevrouw," met u en uw (in een brief aan een
  opdrachtgever mag dat), kort blijft "Hoi" en jullie. Ook "claims desk" en "logistics coordinator" (`data.js`
  regel 35 en 36) kunnen Nederlands.
- **De korte mail klopt niet met de rit.** "Jullie hebben 7 okt een Tesla bij ons opgehaald" gebruikt de afleverdatum
  (`data.js` regel 166 en 170, `datumRit` is `aflever`), en bij 38 leaseclaims was het ophaaladres het inleveradres
  van de berijder, niet "bij ons".
- **Fase en voortgang.** De fase "Op het terrein" staat op ritten die het terrein nooit raakten (S-2026-0546, Apeldoorn
  naar Drachten; `data.js` regel 210 kiest willekeurig). De voortgangsbalk zet "Gekoppeld" op groen bij een claim zonder
  rit (S-2026-0560; `dossier.js` regel 9) en "Afgerond" als huidige stap bij "Bij verzekeraar" en "Wacht op tegenpartij".
- **Randen van de termijnregel.** Een claim die voor de aflevering binnenkomt geeft "Gemeld -1 dagen na aflevering"
  (tegenvoorbeeld 3; `regels.js` regel 107 en 123): begrens op 0 of schrijf "op de dag van aflevering". Staat de schade
  op de ophaalinspectie en noteert de ontvanger haar ook, dan kleurt "getekend" rood terwijl het klopt (tegenvoorbeeld 2).
- **Afgekapte tekst.** Drie van de vijf ondertitels van de cijfers breken af met een beletselteken op 1440 px en op
  390 px (`1440-overzicht.png`, `390-overzicht.png`): korter schrijven of laten omlopen. Op 390 px steken de tabellen van
  Rapporten 40 tot 70 px buiten de kaart zonder scrollvlak (log `kijk.log`: "TABLE right=462"; `390-onder-rapporten.png`);
  Chauffeur en Instellingen hebben dat scrollvlak wel.
- **De fotokaartjes.** Een grijs vlak met een camera-icoon leest als een placeholder; dat is het "demo-achtige" van
  deze ronde (`1440-foto.png`). De noot "In de demo staat hier geen echte foto" is eerlijk en goed. Voorstel: toon
  het autodiagram met het gefotografeerde vlak gemarkeerd, met tijd en plaats eronder, zodat het kaartje iets zegt.
- **Kleine realisme-punten in de wereld.** 94 van de 470 claims zijn in een weekend ontvangen (de oude claims,
  `data.js` regel 191 en 215); 141 ritten gaan van en naar dezelfde plaats (1,3 procent; regel 110 en 111); het
  veld "Limiet per kilogram" toont "3.4" met een punt; de "BT" in de zijbalk (`ui.js` regel 55) is het begin van een
  huisstijl; een willekeurig 06-nummer (`data.js` regel 86) kan van iemand zijn: laat het veld weg.
- **Tests die dit hadden gevangen.** `verify.mjs`: de hoogte van de onderbalk op 390, de breedte van de zijbalk op
  1024, en een controle dat geen afwijsbrief een afleverbon van Opmeer noemt. `data.test.mjs`: geen advies "erkennen"
  zonder bedrag.
- **Datamodel.** De editie van de M-22-codes als veld (`bronnen.md` raadt het aan, regel 288 tot 289) ontbreekt nog.

## Wat goed is

- Nul verzoeken naar buiten in licht, donker en op 390 px (een verzoek, de pagina zelf), nul consolefouten, geen
  horizontale overloop in 18 weergaven, overgangen 0 s bij minder beweging (gemeten, `kijk.log`).
- Toetsenbord: focus zichtbaar op elk element, logische Tab-volgorde door het dossier, de dialoog houdt de focus vast,
  Esc, 1 tot 6, /, n en ? doen wat de lijst zegt (`1440-focus.png`, `1440-zoek.png`, `1440-nieuw.png`).
- Het dossier: de rode ring op het diagram, "Toon de foto" bij het signaal, het advies met "Jij beslist", de
  waarschuwing "72% zeker" bij een twijfelachtig kenteken, het conceptantwoord met de tijdstippen van de bewijsstukken
  (`1440-dossier-stondAl.png`, `1440-concept-stondAl.png`).
- Eerlijk gelabeld: "gesimuleerd; in het echt de API van RGB+", "gesimuleerd; in het echt de Claude API", de demo-dag,
  de noot bij de foto; de instellingen met "Uit het gesprek: 1.750" en "Signaal, laten toetsen".
- De regels staan los van de browser, zijn getest en spreken overal als signaal; nergens een juridisch advies.
- Schrijfstijl: geen klemtoonaccenten (alleen "Eén" als telwoord in een commentaar), geen gedachtestreepjes, geen
  uitroeptekens, "u" alleen in de mail van de tegenpartij, geen "niet alleen … maar ook", geen AI-formuleringen.
- De verhoudingen: 826 ritten per week, 1,07 procent van de ritten met een claim, 9,8 claims per week, mediaan 790
  euro, 13 procent boven 1.750 euro, 38 open, 9 nieuw: binnen de aannames van `bronnen.md` onderwerp 10.

## Een eigen idee: de ophaalfoto's meesturen bij de aflevering

**Probleem.** 202 van de 470 claims (43 procent, gesimuleerd) gaan over schade die al op de ophaalinspectie stond. Elke
zo'n claim kost een mail, een zoektocht en een afwijsbrief, en de dealer die claimt wist niet wat wij bij ophalen zagen.
**Wat.** Bij elke aflevering krijgt de ontvanger (en de opdrachtgever) de afleverbon met de zes ophaalfoto's en de
genoteerde schades als link: "Zo hebben we hem opgehaald." Wie die foto's ziet voordat hij claimt, claimt niet.
Breedijk zegt op zijn site al dat klanten de schouwfoto's in een portaal kunnen zien (zoek); dit maakt daar een duw
van op het moment dat het telt. **Voorbeeld.** Autoverhuurders sturen bij het ophalen de check-outfoto's naar de
huurder en pakketvervoerders een afleverfoto; in beide sectoren is dat de standaard geworden omdat het discussies
achteraf scheelt (schatting, geen bron gelezen). **Waarde.** Als de helft van de "stond er al"-claims wegblijft, zijn dat
circa 100 claims per jaar minder, bij een half uur per claim 50 uur, plus minder wrijving met dealers (schatting).
**Proef.** Een maand lang bij een opdrachtgever met een hoog aandeel "stond er al" (in de demo Garage Zuidwal) de
ophaalfoto's met elke aflevering meesturen en de claims tellen tegenover de maand ervoor. In de demo: een schakelaar
per opdrachtgever op de pagina Opdrachtgevers en een regel in het logboek "ophaalfoto's gedeeld met de ontvanger".
Niet in `ideeenbank.md`: idee 2 stuurt het overzicht achteraf mee, idee 6 vergelijkt foto's voor de behandelaar.

## Wat ik zelf repareerde

Alleen zekere tekst; daarna `npm run build`, `npm test` (20 van 20) en `node tests/verify.mjs 8791` ("alles in orde"),
en `dist/index.html` gekopieerd naar `controltower-demo/public/schadeportaal/index.html`.

- `src/regels.js` regel 112 en 113: "1 foto('s)" wordt "1 foto" of "2 foto's".
- `src/regels.js` regel 118: de zin "is niet op de ophaalinspectie te zien, maar wel op de ophaalinspectie genoteerd"
  sprak zichzelf tegen; nu "en was ook al op de ophaalinspectie genoteerd" of "en is niet op de ophaalinspectie te zien".
- `src/regels.js` regel 179 (commentaar) en `ONTWERP.md` regel 85: het tweede signaal is vijf in negentig dagen
  (`STANDAARD.signaalAantal`), niet drie.
- `src/views/dossier.js` regel 118: "1 foto's, de ophaalbon" in de kop van het conceptantwoord wordt enkelvoud of meervoud.
- `ONTWERP.md` regel 62: toetsen 1 tot 6, niet 1 tot 7.
- `rapporten/breedijk-schadeportaal/memo.md` regel 77: het demoscript zei "twee over de termijn, dertig open"; de demo
  toont 3 en 38. Regel 132: het voorbeeld "veertien keer claimt en elf keer" vervangen door wat de demo laat zien
  (Garage Zuidwal: 11 claims, 8 afgewezen, 7 keer omdat de schade er al stond).
- `src/data.js` regel 29: "Noordlease" wordt "Reitdiep Lease" (zelfde id, geen effect op de cijfers; wel nakijken).
- Niet gedaan, want niet zeker of niet van mij: alles onder "Moet eerst", en de schermafbeeldingen in `schermen/`
  (die tonen nog Transpas en Noordlease; opnieuw maken na de reparaties).

## Wat ermee gedaan is (ronde 2, 7 november, later op de dag)

- **Telefoon en 1024 px**: de variabelen stonden op de root binnen haar eigen containerquery. De regels staan nu op
  de kinderen (`.side`, `.bottombar`, `.views`, `.toasts`); `verify.mjs` meet de onderbalk (58 px, vijf labels), de
  zijbalk (0 px op 390, 64 px op 1024) en de ruimte onder de weergaven in pixels.
- **Eigen handtekening op het overslagterrein**: de keten is gemodelleerd. Bijna de helft van de ritten gaat over
  Barneveld met een intake-controle en foto's; de uitlevering is een tweede rit met een tweede chauffeur; de
  aflevering is altijd bij de tegenpartij. Een nieuw signaal "keten" zegt of de schade bij de intake al gezien was
  (aanvoerrit) of niet (terrein of uitlevering), de claim hoort bij de chauffeur van dat stuk, en de brief noemt
  nooit een afleverbon van eigen terrein.
- **De drie regels**: zonder calculatie eerst informatie vragen, ook met een voorbehoud; `teltVoorChauffeur` (niet
  nieuw, niet afgewezen, een gesloten dossier alleen als het besluit niet afwijzen was) is de ene regel voor het
  signaal, de tabel en het dashboard; een aangrenzende plek telt alleen bij een vergelijkbare ernst.
- **Transpas, Transplan**: Sem bevestigde Transplan (RGB+). Alles hernoemd; `bronnen-transplan.md` met de gelezen
  pagina's van transplan.nl, Rietveld en Breedijk; het memo en de koppelingen in de app volgen dat.
- **Namen en rollen**: de dertien andere opdrachtgevers en zes herstelbedrijven gezocht, geen treffers; "Reitdiep
  Lease" blijft. De rol chauffeur is weg (de melding van een chauffeur is een bron). Ilse en Ruben zijn verzonnen
  namen; Sem vragen of hij echte wil.
- **Zou beter**: het register van de brief (formeel: u en uw; kort: je en jullie), "bij ons opgehaald" met de
  ophaaldatum, de fase "op het terrein" alleen bij een rit over het terrein, de stappenbalk zonder rit, geen
  negatieve dagen, de KPI-ondertitels, 3,40 met een komma, geen weekendclaims meer, geen ritten van en naar
  dezelfde plaats, het merkteken "B". De fotokaartjes krijgen echte foto's (zie de README van ronde 2).
- Nog open: de M-22-editie als veld, de 06-nummers (nu gesimuleerd gelabeld), de rapporttabellen op 390 px.
