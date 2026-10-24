# Simon Loos Control Tower (demo, versie 2.0)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde trucks die
over het **echte wegennet** rijden, op een kaart die zonder internet werkt. Versie 2.0
is het ontwerp uit het document "Control Tower 2.0: ontwerpvoorstellen, rollen en
mockups": een rustige interface met een iconenbalk, een werkgebied per gebruiker,
rollen, record-pagina's voor trucks en mensen, laadplanning, lostijden, pauzeplekken,
een hal-scherm en een deelbare klant-link.

Artifact: https://claude.ai/artifact/S2ni36VcHix21CuMkWUnqF (versie 1.2 staat op
https://claude.ai/artifact/GTELKsXiif8zP4SsijvTUN).

## Wat erin zit

| Onderdeel | Waar | Wat het doet |
| --- | --- | --- |
| Werkgebied | eerste keer, daarna knop Werkgebied | Drie stappen: regio's, ritten, rol en standplaats; bewaard in de browser, niet elke keer opnieuw |
| Rollen | Bekijk als in de topbalk | Planner, regiomanager, directie, HR; bepaalt welke delen van truck- en persoonspagina's zichtbaar zijn |
| Kaart | Kaart | Statusregel met drie cijfers, klikbare statusfilters, truckkaartje bij selectie, kaartlagen (online tegels, gedimde standplaatsen, pauzeplekken) |
| Meldingen | bel of toets m | Cijfers, uitzonderingen afvinken en toewijzen aan een collega, gebeurtenissen |
| Truckpagina | klik op Open truck of een rij in Trucks | Historie (wie reed erop), Vandaag, Cijfers (vaste-chauffeurindex, verbruik per chauffeur), Onderhoud (RDW, werkorder), Documenten |
| Persoonspagina | klik op een chauffeur | Vandaag en bevoegdheden open; rijden en schades voor regiomanager, directie en HR; contract en kosten voor directie en HR; telefoon na klik met logregel |
| Trucks en Mensen | tabellen | Sorteren, zoeken, csv-export (in de losse versie; de artifact-viewer staat downloads niet toe) |
| Standplaatsen | tabel en vertrekbord | Vaste-chauffeurindex en wissels per week per standplaats; Open als hal-scherm |
| Laden | Laden | Dagprijs per uur, laadsessies in de goedkoopste kwartieren binnen de netaansluiting, kosten slim tegenover direct, piekvermogen |
| Lostijden | Lostijden | Gepland naast gemeten per dagdeel per adres; overnemen per adres of alles, met het effect op de planning van morgen |
| Pauzeplekken | Pauzeplekken | 48 plekken op het snelwegennet met voorzieningen en beoordelingen; eigen beoordeling; de assistent stelt er een voor bij rijtijd |
| Hal-scherm | `#hal/<standplaats>` | Vertrekbord op volledig scherm voor een tv in de loods |
| Klant-link | Deel link op het truckkaartje, `#klant/<truck>` | Alleen die truck en de volgende levering, met live ETA |
| Zoeken en sneltoetsen | toets / of Ctrl K | Trucks, kentekens, chauffeurs, standplaatsen, winkels, pauzeplekken, weergaven; 1 tot 9 wisselt van weergave, f volgt, Esc sluit |
| Opgeslagen weergaven | Weergaven in de topbalk | Werkgebied, filters en kaartpositie onder een naam bewaren |
| Assistent | Assistent | Voorstellen bij vertraging, rijtijd, accu en techniek; vragen in gewone taal; collega's; overdracht |

## Draaien

```
npm install
npm run dev              # ontwikkelserver
npm run build            # dist/index.html: één bestand met alles erin (ca. 8 MB)
node tools/artifact.cjs  # dist/artifact.html: variant voor het Claude-artifact
```

Open `dist/index.html` via een webserver (bijvoorbeeld `npx vite preview` of
`python3 -m http.server` in `dist/`). Direct vanaf schijf (`file://`) werkt niet,
omdat MapLibre een web worker start.

## Kaart en wegen

- **Wegen en water: OpenStreetMap via Overture Maps** (release 2026-10-21.0, licentie
  ODbL). Snelwegen, autowegen en N-wegen vormen de routeergraaf waarover de trucks
  rijden; secundaire en tertiaire wegen worden getoond bij inzoomen. Water als vlakken.
- **Provincies en bebouwing: Natural Earth 10m.**
- **MapLibre GL JS 6** (BSD). De basiskaart zit in het bestand zelf; met internet
  kunnen OpenStreetMap-tegels van CARTO eroverheen (kaartlagen, links onderaan).
- Trucks zijn stippen in de statuskleur; clusters tonen de statusverdeling als ring.

## Wat echt is en wat niet

Echt: wegen, water, de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl,
oktober 2026), de divisies en de ligging van de pauzeplekken op het snelwegennet.
Gesimuleerd: trucks, wagennummers, kentekens, chauffeurs en hun gegevens, ritten,
tijden, vertragingen, accustanden, berichten, collega's, historie, schades, kosten,
lostijden, stroomprijzen en beoordelingen. Werkgebied, rol, opgeslagen weergaven,
overgenomen lostijden en eigen beoordelingen staan in de browser (localStorage).

## Bestanden

- `index.html`, `src/main.js`: opbouw, laden en de klok van de simulatie
- `src/ui.js`: iconenbalk, topbalk, kaartweergave, meldingenpaneel, wizard, zoekpalet, sneltoetsen, weergaven, routes
- `src/views.js`: planbord, standplaatsen, hal-scherm, klantweergave, assistent
- `src/sheets.js`: truck- en persoonspagina's met rechten per rol
- `src/tables.js`: tabellen trucks en mensen, lostijden, laden, pauzeplekken
- `src/people.js`: chauffeurs, truckhistorie, kerngegevens, vaste-chauffeurindex
- `src/rest.js`, `src/energy.js`, `src/lostijden.js`: pauzeplekken, laadplanner, lostijden
- `src/map.js`, `src/fleet.js`, `src/roads.js`, `src/places.js`: kaart, simulatie, wegennet, standplaatsen, rollen en rechten
- `src/icons.js`, `src/style.css`: iconen en het ontwerpsysteem
- `src/data/`: `graph.json` (routeergraaf), `roads_display.json`, `water.json`, `provinces.json`, `urban.json`, `places.json`
- `tools/`: dataverwerking (Overture) en `artifact.cjs`
