# Simon Loos Control Tower (demo, versie 3.1)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde voertuigen
(trekkers, bakwagens en bestelbussen) en 1.700 opleggers die over het **echte wegennet**
rijden, op een kaart die zonder internet werkt. Versie 2.0 was het ontwerp uit het
document "Control Tower 2.0: ontwerpvoorstellen, rollen en mockups": een rustige
interface met een iconenbalk, een werkgebied per gebruiker, rollen, record-pagina's,
laadplanning, lostijden, pauzeplekken, een hal-scherm en een deelbare klant-link.

Versie 3.0 maakt het model echt: chauffeurs hebben **geen vaste wagen** maar een dienst
(een voertuig rijdt op een dag een of twee diensten met verschillende chauffeurs),
**trekkers en opleggers staan los van elkaar** (koppelen op het terrein, wisselen bij een
winkel of DC, afkoppelen na de rit; meer opleggers dan trekkers, zodat laden en lossen
los staan van het rijden) en de kaart tekent **voertuigen met hun rijrichting** in plaats
van clusterbollen. Nieuw zijn de weergave Opleggers (status per oplegger: gekoppeld,
klaar voor vertrek, geladen bij een klant, wacht op ophalen, leeg op het terrein,
onderhoud), het opleggerpaneel en de opleggerpagina's, en meldingen en voorstellen
voor opleggers die te lang bij een klant staan.

Versie 3.1 (ronde 4) is een ontwerp- en werkingsronde na Sems review ("snoeilelijk, te
druk, werkt niet"). Ontwerp: een ontwerpsysteem in de stylesheet (tokens voor licht en
donker, typografische schaal met tabulaire cijfers, 8-puntsraster), een rustige basiskaart
(grijs land, zacht water, wegen als dunne lijnen), voertuigsilhouetten met rijrichting,
standplaatsen als rode ruiten met naam, minder drukke weergaven (drie kerngetallen in het
meldingenpaneel, vier tegels bij Opleggers, kortere assistentkaarten met "Waarom"
uitklapbaar, rustige koppen op de pagina's, minder kolommen standaard) en een mobiele
opzet op 390 px (onderbalk met "Meer", voertuigkaartje als onderste blad, lijstrijen in
plaats van tabellen). Werking: "Pas toe" in de Assistent past het plan echt aan (pauze op
een pauzeplek, laadblok, omrijroute om een oplegger op te halen, dienst opschuiven,
werkorder met reservevoertuig), elke weergave, elk voertuig, elke oplegger, persoon en
standplaats heeft een URL (`#voertuig/T-1002`, `#oplegger/O-5150`, `#standplaats/Wognum`)
en de terugknop werkt, meldingen kunnen op "later" (30 of 60 min) en blijven na een herlaad
staan (localStorage `sl-acties`, samen met toegepaste voorstellen en berichten), het
opleggerpaneel heeft een tijdlijn en "Toon op kaart", een klik op een standplaats opent
het standplaatspaneel, het planbord heeft filters, klik-op-blok en een meelopende nu-lijn,
het hal-scherm telt af per rij en het zoekpalet vindt ook opleggers, kentekens, werkorders
en standplaatsen.

Artifact: https://claude.ai/artifact/S2ni36VcHix21CuMkWUnqF (versie 1.2 staat op
https://claude.ai/artifact/GTELKsXiif8zP4SsijvTUN).

## Wat erin zit

| Onderdeel | Waar | Wat het doet |
| --- | --- | --- |
| Werkgebied | eerste keer, daarna knop Werkgebied | Drie stappen: regio's, ritten, rol en standplaats; bewaard in de browser, niet elke keer opnieuw |
| Rollen | Bekijk als in de topbalk | Planner, regiomanager, directie, HR; bepaalt welke delen van truck- en persoonspagina's zichtbaar zijn |
| Kaart | Kaart | Voertuigen als iconen in de statuskleur met hun rijrichting (van veraf stippen, nooit clusters), losse opleggers met toets o of de chip Los, klikbare statusfilters, voertuig- en opleggerkaartje bij selectie, kaartlagen (vier basiskaarten in de losse versie: ingebouwd, OpenStreetMap, luchtfoto, topografisch; gedimde standplaatsen, pauzeplekken), rechts rijden op de eigen rijbaan, wegen vanaf zoom 16 op ware breedte, afdelingen op het terrein vanaf zoom 16 |
| 3D-wereld | knop met de kubus op de kaart, of toets d | De kaart kantelt naar een wereld op ware grootte: trekkers met opleggers, bakwagens en bussen op koers, geparkeerd op hun plek in de rijen; de standplaatsen op hun echte terrein met de hal uit de gebouwgegevens, genummerde docks, poort, lichtmasten en de buurt eromheen; bij een klant achteruit tegen een dock; zon met schaduw, licht en donker; volgen (toets f) zet de camera schuin achter het voertuig; klik en aanwijzen werken als op de platte kaart |
| Meldingen | bel of toets m | Drie kerngetallen, uitzonderingen (vertraging, rijtijd, accu, techniek, koeling, oplegger te laat opgehaald) afvinken, toewijzen aan een collega of op later zetten; blijft staan na een herlaad |
| Voertuigpagina | klik op Open voertuig of een rij in Voertuigen | Chauffeurs van vandaag per dienst en de oplegger erachter; Historie (laatste twaalf diensten, wie reed het vaakst), Vandaag (diensten en dagplan), Cijfers (chauffeurswisselingen, verbruik per chauffeur), Onderhoud (RDW, werkorder), Documenten |
| Opleggerpaneel en -pagina | klik op een oplegger op de kaart, in een paneel of in Opleggers | Status, waar hij staat of achter welke trekker hij hangt, lading, temperatuur bij koel en vries, sinds wanneer, ophaalmoment; pagina met APK, ATP, onderhoud en documenten |
| Persoonspagina | klik op een chauffeur | Dienst van vandaag (tijden, voertuig, oplegger), voertuigen van de laatste twaalf diensten en bevoegdheden open; rijden en schades voor regiomanager, directie en HR; contract en kosten voor directie en HR; telefoon na klik met logregel |
| Voertuigen, Opleggers en Mensen | tabellen | Tegels en chips per soort en status, sorteren, zoeken, csv-export (in de losse versie; de artifact-viewer staat downloads niet toe); Opleggers heeft een knop Op de kaart |
| Standplaatsen | tabel en vertrekbord | Voertuigen, opleggers, chauffeurs op dienst en wissels per week per standplaats; Open als hal-scherm |
| Laden | Laden | Dagprijs per uur, laadsessies in de goedkoopste kwartieren binnen de netaansluiting, kosten slim tegenover direct, piekvermogen |
| Lostijden | Lostijden | Gepland naast gemeten per dagdeel per adres; overnemen per adres of alles, met het effect op de planning van morgen |
| Pauzeplekken | Pauzeplekken | 48 plekken op het snelwegennet met voorzieningen en beoordelingen; eigen beoordeling; de assistent stelt er een voor bij rijtijd |
| Hal-scherm | `#hal/<standplaats>` | Vertrekbord (vertrek, voertuig, oplegger, chauffeur, bestemming, dock, status) op volledig scherm voor een tv in de loods |
| Klant-link | Deel link op het truckkaartje, `#klant/<truck>` | Alleen die truck en de volgende levering, met live ETA |
| Zoeken en sneltoetsen | toets / of Ctrl K | Voertuigen, opleggers, kentekens, chauffeurs, werkorders, standplaatsen, winkels, pauzeplekken, weergaven; 1 tot 9 en 0 wisselen van weergave, o toont losse opleggers, d de 3D-wereld, f volgt, Esc sluit; elke weergave en elk record heeft een URL (`#voertuig/T-1002`) en de terugknop werkt |
| Opgeslagen weergaven | Weergaven in de topbalk | Werkgebied, filters en kaartpositie onder een naam bewaren |
| Assistent | Assistent | Voorstellen bij vertraging, rijtijd, accu, techniek, koeling en opleggers die wachten (een solo terugrijdende trekker of een reservetrekker haalt ze op); "Pas toe" past het plan aan en stuurt de chauffeur een bericht; vragen in gewone taal, ook over opleggers; collega's; overdracht |

## Draaien

```
npm install
npm run dev              # ontwikkelserver
npm run build            # dist/index.html: één bestand met alles erin (ca. 8 MB), plus dist/artifact.html voor het Claude-artifact
npm run build:site       # dist-site/: app.js, data.js, maplibre.js, three.js en app.css met vaste namen, om in een site in te bedden
```

Open `dist/index.html` via een webserver (bijvoorbeeld `npx vite preview` of
`python3 -m http.server` in `dist/`). Direct vanaf schijf (`file://`) werkt niet,
omdat MapLibre een web worker start.

## Inbedden in een site (SafeTail: safetail.nl/intern/control-tower)

De app staat als tabblad "Control Tower" in SafeTools, het interne deel van safetail.nl
(repo SafeTail-V-O-F/Website, pagina `src/pages/intern/control-tower.astro`, achter de
inlog van de oprichters). Daarvoor is de app inbedbaar gemaakt:

- Alle CSS staat onder `.slct`, de app-root (`#app.app.slct`); het thema (`data-theme`)
  en de kiosk-klasse voor het hal-scherm staan op die root, niet op `<html>` of `<body>`.
  Met `contain: layout` blijven de vaste panelen (paneel, record-pagina, modals, hal-scherm)
  binnen de app, ook midden in een andere pagina.
- Twee opties als data-attribuut op de root: `data-tiles="off"` laadt geen externe
  kaarttegels (geen enkel verzoek naar buiten; de basiskaart zit in de bundel) en
  `data-embedded` houdt de sneltoetsen binnen de app en vraagt bij "Open als hal-scherm"
  om volledig scherm op de app zelf (Esc sluit beide).
- Zonder WebGL toont de kaart een rustige melding; de andere weergaven werken gewoon.

Bijwerken in de SafeTail-repo:

```
npm run build:site
node tools/sync-safetail.mjs ../../../website   # pad naar de website-repo
```

Dat kopieert de zes bestanden (sinds de 3D-wereld ook `three.js`, en sinds 4.0 `buildings.js` met de gebouwen, die
`app.js` allebei pas bij de eerste klik op de kubus met een relatief pad laadt) naar `public/intern/control-tower/app/` en schrijft daar
`VERSIE.json` (commit en datum). De pagina daar bevat de HTML-opbouw van de app (dezelfde
id's als `index.html` hier, sinds 3.0 ook `v-opleggers`): verandert die opbouw, pas dan
ook die pagina aan. Daarna in de
website-repo: `npm run build`, `npm test`, committen (zie daar DEPLOY.md, "SafeTools ·
Control Tower").

## 3D-wereld

De 3D-stand (knop met de kubus naast Kaartlagen, toets d, bewaard als `sl-3d`) is een eigen laag van
MapLibre (`CustomLayerInterface`, `renderingMode: '3d'`) die met **three.js** tekent. `src/scene3d.js` maakt
de scene, de camera (elk beeld overgenomen uit `defaultProjectionData.mainMatrix`), het licht en de
voertuigen. In `src/scene3d/` staan de wereld (`world.js`: terreinen, gebouwen, docks, poort, bomen,
huizen, winkels), de voertuigmodellen (`vehicles.js`), het kleurenpalet (`palette.js`), getekende texturen
en vlakken op de grond (`fx.js`), bouwgeometrie (`geom.js`), bomen, hagen en huizen (`nature.js`), de
CC0-modellen (`assets.js`) en hulpfuncties (`util.js`).

**Wat je ziet.** Alles op ware grootte: een trekker met oplegger is 16,5 m lang en 4 m hoog. Bij uitzoomen
groeien rijdende voertuigen mee tot ongeveer 20 pixels (ware grootte vanaf zoom 15,4); geparkeerde hooguit
1,3 keer, zodat ze in hun vak blijven. Een standplaats ligt op zijn echte terrein (`terrein` uit
`places.json`) als verhard vlak. De hal en de andere eigen gebouwen komen uit `buildings.js` (`d: 1` en
`hal`); de panden eromheen zonder `d` zijn de buurt, in minder detail en pas vanaf zoom 13,2, elk in een
eigen gevel- en dakkleur. Zonder hoogte in de gegevens is een loods 10,5 m (de hal 11,5 m), een kantoor
drie lagen en een klein pand een woonhuis met een kap. Opleggers, containers en overkappingen die in de
gegevens als gebouw staan, laat de wereld weg.

Geparkeerde voertuigen en losse opleggers staan op hun plek in de parkeerrijen (`rijen`) met de koers van
de rij; de vakken zijn getekend. Rijen die buiten de terreinring vallen, krijgen hun eigen verharding. De
docks staan waar de gegevens ze zetten: `sp.dockPlek` geeft per dock de deur in de gevel van de hal en de
koers van de gevel af, en de wereld nummert ze in die volgorde, 1 tot n, met een bord boven elke deur
(hetzelfde nummer als op het hal-scherm en het planbord). Een voertuig dat laadt, lost of koppelt, staat
al op zijn plek voor die deur (`pos` uit de simulatie). Zonder `dockPlek` zoekt de wereld zelf de lange
zijde van de hal waar de rijen staan (het aantal uit `sp.docks`, anders uit de lengte van de gevel),
nummert van links naar rechts gezien vanaf het terrein en zet een voertuig met een `dock` achteruit aan
die deur. De poort ligt waar de toegangsroute (`toegang`) het terrein op
komt: slagbomen, een portiersloge, een bord en lantaarnpalen langs de inrit; populieren langs de laatste
450 m van die weg, lichtmasten tussen de rijen, een haag en bomen rond het terrein (nooit op het terrein of
in een gebouw). Een fabriek uit de DC-lijst (`soort: 'fabriek'`) krijgt silo's, een schoorsteen en
liggende tanks.

Bij een klant staat een vrachtwagen of oplegger achteruit tegen een dock: van het echte DC-gebouw als dat
er is, anders van een supermarkt op het winkelpunt (`WINKELS`) of naast de stopplek (glazen pui, gevelband
in de kleur van de formule, klantenparkeerplaats), of van een distributiehal bij een DC uit de lijst
zonder gebouwgegevens. Woonhuizen (rijtjes en vrijstaand, met kap) en bomen staan in de bebouwing van
`urban.json`, niet op een terrein en niet binnen 320 m van een plek met echte gebouwen.

**Licht.** Een zon met schaduw (schaduwkaart van 2048 px die het zichtbare gebied volgt, in stappen van
een texel), hemellicht, ACES-tonemapping, nevel in de kleur van de kaart en een zachte voetschaduw rond
gebouwen. Donker: maanlicht, koplampen en achterlichten op rijdende voertuigen (geparkeerde staan uit),
verlichte ramen, en lichtpoelen onder lantaarnpalen, lichtmasten en docks.

**Modellen van buiten.** Vier bomen (linde, eik, populier, den) en de schoorsteen en tank bij fabrieken
zijn CC0-modellen van Kenney uit `assets-3d/` (herkomst en licentie in de README daar). Ze komen met `?url`
als data-URL in de three-bundel: geen los bestand en geen verzoek naar buiten. `tools/build-assets.mjs`
zet een nieuw model op dezelfde manier klaar (glTF-Transform, in de devDependencies). Vrachtwagens,
opleggers, bakwagens en bussen blijven procedureel: er is geen CC0-model van een Europese trekker met
oplegger. De Kenney-hallen en -auto's gebruikt de wereld niet: de echte contouren zeggen meer, en een
vast model uitrekken naar een contour vervormt ramen en deuren.

**Laden en prijs.** Geen imports uit de app: standplaatsen, statuskleuren, bebouwing, winkels (`WINKELS`)
en DC's (`DCS`) komen via `opts.data`, de gebouwen via een dynamische import van `./buildings.js` (zonder
dat bestand: een procedurele loods met kantoor). Zo blijven three.js, de wereld en de modellen een eigen
bundel die pas bij de eerste klik op de kubus laadt. Een plek wordt pas voorbereid en gebouwd als hij in de
buurt van het beeld komt (de dichtstbijzijnde eerst, ongeveer 14 ms per beeld), de buurt een beeld later.
Voertuigen, bomen, huizen en auto's zijn instanced meshes; de grootste 60 voertuigen in beeld krijgen het
volle model met draaiende wielen, de rest een eenvoudiger model of een blok; bomen in vol detail vanaf
zoom 16,3. Bij Wognum zijn dat 45 tot 55 tekenopdrachten en 85.000 tot 230.000 driehoeken per beeld (het meest
vlak boven het terrein), op zoom 11 ongeveer 40. Klik en aanwijzen gaan via een straal tegen de omtrek van elk getekend
voertuig. Zonder WebGL is er geen knop.

**Aanroep.** `createScene3d(map, maplibregl, { theme, data: { SP, ST, TRST, urban, WINKELS?, DCS? },
onSelectTruck, onSelectTrailer, onHover })` geeft `{ enable, isOn, setVehicles, setTrailers, setTheme,
pick, refresh, setSelected, dispose, ready, stats }`. Een voertuig is `{ id, st, b, k, base, lon, lat,
dock? }`, een oplegger `{ id, st, base, lon, lat, b?, dock? }` (zonder `b` neemt een oplegger op het
terrein de koers van zijn rij). `setSelected(id)` zet de rode ring om het gekozen voertuig.
`tests/3d-check.mjs` controleert bouwtijd, tekenopdrachten en driehoeken per zoom, klikken, geheugen na
drie keer uit en aan, en consolefouten.

**Huisstijl.** Naar Sems schaalmodellen van Simon Loos (foto's in `rapporten/simon-loos-control-tower/fotos-modellen/`).
De cabine is boven wit: dak, zonneklep, het vlak rond de voorruit en de deuren tot onder de ruit. Onder is ze
Simon Loos-rood (#E3001F): grille, bumper, de deuren onder de ruit en de zijkant tot het chassis. De grens loopt
onder de voorruit en de zijruiten: een goudgele band (#F0A526), een smalle witte bies en dan het rood. Op de
zijkant loopt die grens licht omhoog naar achteren. Bovenaan de zijkant loopt een smalle sierstreep, geel boven
rood, die naar voren eindigt in het kleine beeldmerk. Het beeldmerk is twee gele vierkantjes boven twee rode,
schuin als een cursieve letter, met tussen de paren de ruimte waar het woordmerk loopt. Het staat boven de
voorruit (op het hoge dak of op de dakspoiler) en groot midden op de zijkant van opleggers en laadbakken. Die
zijn licht gebroken wit, met een aluminium onderrand en een smalle zwarte onderbalk; de koelmachine is wit met
grijze roosters en de velgen zijn zilver. De Actros-vorm en de cabine in de 3D-wereld hebben een zwarte
zonneklep, DAF, Scania en Volvo een witte. De bestelbus is wit met het beeldmerk. Het woordmerk "Simon Loos" laten we weg: er is geen letter die op elke
machine hetzelfde rendert. Alles zit in het palet (`cabineWit`, `geel`, `kast`, `alu`, `rooster` in
`palette.js`) en in onderdelen van dezelfde modellen (`cabineLak`, `beeldmerk` en `sierstreep` in
`vehicles.js`): geen extra materiaal en geen extra tekenopdracht. De iconen op de 2D-kaart blijven zoals ze zijn.

**Voertuigbeelden.** De beelden van voertuigen en opleggers op de voertuig- en opleggerpagina en in de
hoverkaart zijn renders van onze eigen 3D-modellen, geen foto's; alleen van een DAF XF met koeloplegger en
een Mercedes-Benz Actros bakwagen met aanhanger staan er foto's van Sems eigen schaalmodellen in de echte
huisstijl (`src/assets/fotos/`, bron `rapporten/simon-loos-control-tower/fotos-modellen/`, uitsneden met
`tools/fotos-modellen.mjs`; `fotoVan` en `fotoVanOplegger` gaan voor een render). Elke trekker heeft de cabinevorm van zijn
merk (DAF XF, Scania R, Volvo FH, Mercedes Actros en eActros 600), zonder merktekens. Een elektrische trekker
heeft accupakketten en een laadklep in plaats van de tank. Verder: met of zonder koeloplegger, de bakwagen
in drie vormen, de bestelbus, en elke opleggersoort los op de steunpoten. Alles in de huisstijl hierboven en
met een fictief kenteken op het model (met een C, die Nederlandse kentekens niet hebben); de app zet het
echte kenteken als tekst ernaast. De modellen staan in `src/scene3d/varianten.js`. `tools/render-portretten.mjs`
rendert ze met Playwright en de software-GPU: 26 beelden van 640 x 400 px, WebP met een doorzichtige
achtergrond, elk hooguit 25 KB en samen ongeveer 560 KB. Twee keer draaien geeft dezelfde bestanden. De
beelden staan in `src/assets/portretten/`. `src/portretten.js` neemt ze met `?inline` op in de bundel
(geen los bestand, geen fetch) en kiest met `portretVan(voertuig, oplegger?)` en
`portretVanOplegger(oplegger)` het juiste beeld, met een alt-tekst. `tests/portretten-check.mjs`
controleert de bestanden en de keuze voor elk voertuig en elke oplegger uit de simulatie.

## Kaart en wegen

- **Wegen en water: OpenStreetMap via Overture Maps** (release 2026-10-21.0, licentie
  ODbL). Snelwegen, autowegen en N-wegen vormen de routeergraaf waarover de trucks
  rijden; secundaire en tertiaire wegen worden getoond bij inzoomen. Water als vlakken.
- **Provincies en bebouwing: Natural Earth 10m.**
- **MapLibre GL JS 6** (BSD). De basiskaart zit in het bestand zelf. In de losse versie kan onder Kaartlagen (links
  onderaan) ook een online basiskaart: OpenStreetMap via OpenFreeMap (vectortegels in hetzelfde palet), de luchtfoto
  of de BRT-achtergrondkaart van PDOK (Kadaster, CC BY 4.0). Laadt een bron niet, dan blijft de ingebouwde kaart.
- Voertuigen zijn iconen in de statuskleur, gedraaid in hun rijrichting (trekker met
  oplegger, trekker solo, bakwagen, bus); ver uitgezoomd worden het stippen. Losse
  opleggers zijn een aparte laag (toets o). Geen clusters.

## Wat echt is en wat niet

Echt: wegen, water, de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl,
oktober 2026), de divisies en de ligging van de pauzeplekken op het snelwegennet.

Sinds 4.0 staan de standplaatsen op hun echte adres (uit de vacatures op werkenbijsimonloos.nl, op het BAG-adrespunt
gezet) met hun echte terrein, hoofdgebouw en parkeerrijen; geparkeerde voertuigen en opleggers staan in die rijen.
Ritten gaan naar echte winkels van de klant van de standplaats (4.578 supermarkten en drogisterijen uit Overture Places,
binnen 80 km, bezorging binnen 40 km naar woonstraten) en naar echte DC's, fabrieken en groothandels (157), en rijden de
laatste kilometers over echte straten tot de poort of de weg voor de deur. Voor de 3D-wereld zijn er de echte
gebouwen rond elke standplaats en elk DC (Overture Buildings, 16.196 contouren met hoogte), apart geladen. Welke winkel
een vrachtwagen vandaag bedient blijft gesimuleerd (vaste seed); bronnen, aantallen en benaderingen staan in
`src/data/BRONNEN.md`.

In de tweede ronde van 4.0 is de dag geijkt op de cijfers uit het onderzoeksmemo (paragraaf 1.4; schattingen). Een dienst
in de winkeldistributie duurt 8,5 tot 11 uur (mediaan 9,6), netwerk en bulk iets langer (mediaan 10,2 en 10,3 uur) met
minder stops; 53 procent van de diensttijd is rijden, de rest is laden en koppelen aan het dock, wachten, lossen en
pauze. De eerste dienst begint tussen 02:00 en 07:00, 29 procent van de vloot rijdt 's middags of 's avonds een tweede
dienst met een andere chauffeur, en om 10:00 staan 212 van de 1.300 voertuigen op het terrein. Pauzes volgen
EU-verordening 561/2006 (uiterlijk na 4,5 uur rijden 45 minuten, of 15 + 30; hoogstens 9 uur rijden per dienst, op een
kwart van de diensten mag het vandaag 10 uur) en het Arbeidstijdenbesluit vervoer; elektrische voertuigen laden tussen
twee ritten als de volgende rit niet meer in 78 procent van de accu past. Bij elke stop wacht een vrachtwagen eerst (bij
DC's in de ochtend het langst, gemiddeld 42 minuten per truck per dag; `fleet.wachtPerPlek()`). Elke standplaats heeft
docks in de gevel van zijn hal (aantal en plek geschat: `sp.docks`, `sp.dockPlek`, `dockPos()` in `src/places.js`);
koppelen, laden en afkoppelen gebeuren aan een dock, nooit twee voertuigen tegelijk aan hetzelfde, en hal-scherm,
planbord en `fleet.dockPlan(standplaats)` tonen hetzelfde dock. `fleet.eventsOf(voertuig)` geeft de gebeurtenissen van de
dag (vertrek, aankomst, wachten, lossen, koppelen, pauze, laden) en `fleet.pool` de ritten zonder voertuig: 2 tot 5
procent van de ritten per standplaats per dag, elk met een reden (ziek, uitval voertuig, extra rit klant, nieuw uit
OTM5); 's middags komen de ritten van morgen erbij (`fleet.poolAt(T)`). `fleet.dagcijfers()` geeft de kerngetallen.

Elke standplaats heeft afdelingen (`sp.afdelingen`, zoals Google Maps de gebouwen van een bedrijf toont): de loods of het
warehouse (met de naam van het DC als dat er staat), de docks ("Docks 1 tot 30"), de poort, de opleggers en het
laadplein, en waar de vacature het noemt ook het kantoor, de garage en de wasstraat (Wognum: hoofdkantoor, warehouse,
garage en wasstraat). Wat er is, komt uit de vacatures (`bron: 'vacature'`); welk gebouw welke functie heeft, staat niet in
open data en is afgeleid uit grootte, vorm en ligging (`bron: 'afgeleid'`; zie `src/data/BRONNEN.md`). Op de kaart staan
ze vanaf zoom 16 als rustige namen op het terrein, een afdeling in een gebouw midden in dat gebouw; in 3D op bordjes.

De vraagkant van de planning is gesimuleerd (`src/inzet.js`, `src/voorkeuren.js`, `src/data/charters.json`). Elke rit in de
pool heeft een prognose: de kans op invulling en op een vertrek binnen het venster, uit acht weken gesimuleerde historie per
standplaats, divisie, dienstdeel en weekdag (`prognose` met zijn basis; `fleet.poolHistorie(standplaats)` geeft de reeksen
voor een grafiek), en een urgentie, de minuten tot het laadvenster (`fleet.poolAt(T)` rekent beide vanaf T). Elke chauffeur
heeft voorkeuren (divisies, dagdelen, weekend, regio, klanten, uren, extra diensten) en een tevredenheid uit de roosterfit
(`fleet.voorkeurenVan`, `fleet.tevredenheid`, `fleet.past`). De flexibele schil: 15 verzonnen charters met contactpersoon,
nummer, opleggers, capaciteit, tarief en betrouwbaarheid (`fleet.CHARTERS`) en 76 zzp'ers, weekendchauffeurs en
oproepkrachten (`fleet.OPROEP`). `fleet.kandidaten(rit, { T, people, toegewezen })` geeft per open rit wie hem kan rijden:
eerst eigen chauffeurs met uren over (rij- en rusttijden getoetst), dan oproepkrachten, dan charters met de juiste
oplegger, elk met redenen in gewone taal, uren, kosten (schatting) en waarschuwingen. `fleet.wijsToe(rit, kandidaat)`
verandert niets: het geeft het blok voor het planbord, een regel voor het logboek en het bericht aan de kandidaat. Namen,
nummers (06 9…, 0229 0…) en e-mailadressen (.example) zijn fictief; tarieven en kansen zijn schattingen.

Gesimuleerd: voertuigen, opleggers, wagennummers, kentekens, chauffeurs en hun
diensten, ritten, koppelingen, ladingen, temperaturen, tijden, vertragingen, wachttijden, de indeling van de docks,
de open ritten in de pool en hun historie, voorkeuren en tevredenheid van chauffeurs, charters en oproepkrachten,
accustanden, berichten, collega's, historie, schades, kosten, lostijden, stroomprijzen
en beoordelingen. Werkgebied, rol, thema, opgeslagen weergaven, overgenomen lostijden,
eigen beoordelingen, de overdrachtstekst en de acties van vandaag (afgehandelde en
uitgestelde meldingen, toegepaste voorstellen, berichten) en de 3D-stand staan in de browser
(localStorage, `sl-*`).

## Bestanden

- `index.html`, `src/main.js`: opbouw, opties van de app-root, laden en de klok van de simulatie
- `src/ui.js`: iconenbalk, topbalk, kaartweergave, meldingenpaneel, wizard, zoekpalet, sneltoetsen, weergaven, routes
- `src/views.js`: planbord, standplaatsen, hal-scherm, klantweergave, assistent
- `src/sheets.js`: voertuig-, oplegger- en persoonspagina's met rechten per rol
- `src/tables.js`: tabellen voertuigen, opleggers en mensen, lostijden, laden, pauzeplekken
- `src/people.js`: chauffeurs en hun dienst, voertuighistorie zonder vaste wagen, kerngegevens, opleggergegevens (APK, ATP, onderhoud)
- `src/rest.js`, `src/energy.js`, `src/lostijden.js`: pauzeplekken, laadplanner, lostijden
- `src/inzet.js`, `src/voorkeuren.js`: de flexibele schil (charters, oproepkrachten, kandidaten, toewijzen) en de voorkeuren en tevredenheid van chauffeurs (puur, gesimuleerd)
- `src/map.js`, `src/fleet.js`, `src/roads.js`, `src/places.js`: kaart (iconen met koers, lagen voor voertuigen en losse opleggers, de 3D-stand), simulatie (voertuigen, opleggers, diensten, koppelen en wisselen, docks, wachttijd, gebeurtenissen, pool), wegennet, standplaatsen, rollen en rechten
- `src/scene3d.js`: de 3D-wereld (three.js in een eigen MapLibre-laag: voertuigen, opleggers, depots, bomen, huizen, klik en aanwijzen)
- `src/icons.js`, `src/style.css`: iconen en het ontwerpsysteem
- `src/data/`: `graph.json` (routeergraaf), `roads_display.json` (met wegnummers en straatnamen in `lab`), `water.json`, `provinces.json`, `urban.json`, `places.json` (standplaatsen met adres, terrein, parkeerrijen, docks en afdelingen), `klanten.json` (winkels en DC's), `toegang.json` (de laatste kilometers), `buildings.json` (gebouwen voor 3D, via `src/buildings.js` en alleen dynamisch geladen), `charters.json` (verzonnen charters), `BRONNEN.md`
- `tests/map-check.mjs`: de kaart in de browser (terugval en online bronnen nagebootst, ingebed zonder verzoeken naar buiten, minder beweging, rechts rijden, land en zee, afdelingen, framerate)
- `tests/data-check.mjs`: controle van de echte plekken en ritten en van de geijkte dag (diensten, rij- en rusttijden, accu, docks, wachttijd, gebeurtenissen, pool), van de afdelingen en van de vraagkant (prognose, historie, voorkeuren, charters en oproepkrachten zonder echte namen, kandidaten, toewijzen); `tools/ct4/`: de verwerking van de data (Overture, vacatures, docks, afdelingen, charters)
- `src/otm5.js`: de vertaling tussen de gesimuleerde dag en OTM5 (Open Trip Model 5.9.0): `uitFleet` (onze vorm), `naarOtm5` en `vanOtm5`; puur en buiten de app-bundel, de basis voor de import van echte ritten (zie `rapporten/simon-loos-control-tower/echte-data-en-otm5.md`)
- `tests/otm5-check.mjs` (`npm run test:otm5`): de vertaling tegen de officiële OTM5-specificatie (vastgezet in `tests/otm5/`), tegen het planbord en de gebeurtenissen van de app, en heen en terug; `--bestand pad.json` controleert een echt OTM5-bestand
- `vite.config.js` (één bestand), `vite.site.config.js` (bundel voor een site)
- `tools/`: dataverwerking (Overture), `artifact.cjs` en `sync-safetail.mjs` (de bundel naar de SafeTail-repo)
