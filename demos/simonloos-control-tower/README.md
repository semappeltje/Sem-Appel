# Simon Loos Control Tower (demo, versie 3.1)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde voertuigen
(trekkers, bakwagens en bestelbussen) en 1.681 opleggers die over het **echte wegennet**
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
| Kaart | Kaart | Voertuigen als iconen in de statuskleur met hun rijrichting (van veraf stippen, nooit clusters), losse opleggers met toets o of de chip Los, klikbare statusfilters, voertuig- en opleggerkaartje bij selectie, kaartlagen (online tegels, gedimde standplaatsen, pauzeplekken) |
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
| Zoeken en sneltoetsen | toets / of Ctrl K | Voertuigen, opleggers, kentekens, chauffeurs, werkorders, standplaatsen, winkels, pauzeplekken, weergaven; 1 tot 9 en 0 wisselen van weergave, o toont losse opleggers, f volgt, Esc sluit; elke weergave en elk record heeft een URL (`#voertuig/T-1002`) en de terugknop werkt |
| Opgeslagen weergaven | Weergaven in de topbalk | Werkgebied, filters en kaartpositie onder een naam bewaren |
| Assistent | Assistent | Voorstellen bij vertraging, rijtijd, accu, techniek, koeling en opleggers die wachten (een solo terugrijdende trekker of een reservetrekker haalt ze op); "Pas toe" past het plan aan en stuurt de chauffeur een bericht; vragen in gewone taal, ook over opleggers; collega's; overdracht |

## Draaien

```
npm install
npm run dev              # ontwikkelserver
npm run build            # dist/index.html: één bestand met alles erin (ca. 8 MB), plus dist/artifact.html voor het Claude-artifact
npm run build:site       # dist-site/: app.js, data.js, maplibre.js en app.css met vaste namen, om in een site in te bedden
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

Dat kopieert de vier bestanden naar `public/intern/control-tower/app/` en schrijft daar
`VERSIE.json` (commit en datum). De pagina daar bevat de HTML-opbouw van de app (dezelfde
id's als `index.html` hier, sinds 3.0 ook `v-opleggers`): verandert die opbouw, pas dan
ook die pagina aan. Daarna in de
website-repo: `npm run build`, `npm test`, committen (zie daar DEPLOY.md, "SafeTools ·
Control Tower").

## Kaart en wegen

- **Wegen en water: OpenStreetMap via Overture Maps** (release 2026-10-21.0, licentie
  ODbL). Snelwegen, autowegen en N-wegen vormen de routeergraaf waarover de trucks
  rijden; secundaire en tertiaire wegen worden getoond bij inzoomen. Water als vlakken.
- **Provincies en bebouwing: Natural Earth 10m.**
- **MapLibre GL JS 6** (BSD). De basiskaart zit in het bestand zelf; met internet
  kunnen OpenStreetMap-tegels van CARTO eroverheen (kaartlagen, links onderaan).
- Voertuigen zijn iconen in de statuskleur, gedraaid in hun rijrichting (trekker met
  oplegger, trekker solo, bakwagen, bus); ver uitgezoomd worden het stippen. Losse
  opleggers zijn een aparte laag (toets o). Geen clusters.

## Wat echt is en wat niet

Echt: wegen, water, de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl,
oktober 2026), de divisies en de ligging van de pauzeplekken op het snelwegennet.
Gesimuleerd: voertuigen, opleggers, wagennummers, kentekens, chauffeurs en hun
diensten, ritten, koppelingen, ladingen, temperaturen, tijden, vertragingen,
accustanden, berichten, collega's, historie, schades, kosten, lostijden, stroomprijzen
en beoordelingen. Werkgebied, rol, thema, opgeslagen weergaven, overgenomen lostijden,
eigen beoordelingen, de overdrachtstekst en de acties van vandaag (afgehandelde en
uitgestelde meldingen, toegepaste voorstellen, berichten) staan in de browser (localStorage, `sl-*`).

## Bestanden

- `index.html`, `src/main.js`: opbouw, opties van de app-root, laden en de klok van de simulatie
- `src/ui.js`: iconenbalk, topbalk, kaartweergave, meldingenpaneel, wizard, zoekpalet, sneltoetsen, weergaven, routes
- `src/views.js`: planbord, standplaatsen, hal-scherm, klantweergave, assistent
- `src/sheets.js`: voertuig-, oplegger- en persoonspagina's met rechten per rol
- `src/tables.js`: tabellen voertuigen, opleggers en mensen, lostijden, laden, pauzeplekken
- `src/people.js`: chauffeurs en hun dienst, voertuighistorie zonder vaste wagen, kerngegevens, opleggergegevens (APK, ATP, onderhoud)
- `src/rest.js`, `src/energy.js`, `src/lostijden.js`: pauzeplekken, laadplanner, lostijden
- `src/map.js`, `src/fleet.js`, `src/roads.js`, `src/places.js`: kaart (iconen met koers, lagen voor voertuigen en losse opleggers), simulatie (voertuigen, opleggers, diensten, koppelen en wisselen), wegennet, standplaatsen, rollen en rechten
- `src/icons.js`, `src/style.css`: iconen en het ontwerpsysteem
- `src/data/`: `graph.json` (routeergraaf), `roads_display.json`, `water.json`, `provinces.json`, `urban.json`, `places.json`
- `vite.config.js` (één bestand), `vite.site.config.js` (bundel voor een site)
- `tools/`: dataverwerking (Overture), `artifact.cjs` en `sync-safetail.mjs` (de bundel naar de SafeTail-repo)
