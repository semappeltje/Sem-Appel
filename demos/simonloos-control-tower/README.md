# Simon Loos Control Tower (demo, versie 1)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde trucks op een
echte kaart, met clusters bij uitzoomen, losse trucks met rijrichting bij inzoomen,
filters op regio, standplaats, divisie en status, een truckdetail met rit, ETA, accu en
rijtijd, een planbord, een standplaatsenoverzicht met vertrekbord, replay en een licht
en donker thema. Dit is de uitwerking van de mockups in `rapporten/simon-loos-control-tower`.

## Draaien

```
npm install
npm run dev        # ontwikkelserver
npm run build      # dist/index.html: één bestand met alles erin (ca. 2 MB)
```

Open `dist/index.html` via een webserver (bijvoorbeeld `npx vite preview` of
`python3 -m http.server` in `dist/`). Direct vanaf schijf (`file://`) werkt niet,
omdat MapLibre een web worker start.

## Techniek

- **MapLibre GL JS 6** (BSD) voor de kaart. De basiskaart zit in het bestand zelf
  (Natural Earth 10m: land, IJsselmeer, provincies, snelwegen en hoofdwegen, bebouwing,
  rivieren) en werkt dus zonder internet. Met internet laden er OpenStreetMap-tegels
  van CARTO overheen (licht: Positron, donker: Dark Matter); mislukt dat, dan blijft
  de ingebouwde basiskaart staan.
- **Clusters** met de ingebouwde clustering van MapLibre; per cluster een donut met de
  statusverdeling (HTML-marker).
- **Truckiconen** als symbol-laag met `icon-rotate` op de rijrichting; geselecteerde truck
  met ring, route (gereden en nog te rijden) en stops.
- **Simulatie** (`src/fleet.js`): elke truck heeft een vast dagplan (segmenten rijden,
  lossen, pauze, laden, terrein) langs een route over het wegennet (`src/roads.js`,
  Dijkstra op reistijd). De positie op elk tijdstip volgt uit dat plan, zodat kaart,
  planbord, vertrekbord en replay altijd met elkaar kloppen. Vertragingen, rijtijden
  (4:30 regel), accu en brandstof worden uit hetzelfde plan afgeleid.
- **Geen glyph-server nodig**: plaatsnamen en standplaatsen zijn HTML-markers.
- Build: Vite + vite-plugin-singlefile; de MapLibre-worker start uit een blob-URL,
  zodat alles in één HTML-bestand past (ook als Claude-artifact).

## Wat echt is en wat niet

Echt: de kaart, de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl, oktober
2026), de verdeling van divisies. Gesimuleerd: trucks, wagennummers, kentekens,
chauffeurs, ritten, tijden, vertragingen, accustanden en het aantal trucks per
standplaats (verdeling van 1.300 over de standplaatsen op basis van het aantal
vacatures en de functie van de locatie).

## Bestanden

- `index.html`, `src/main.js`: opbouw en de klok van de simulatie
- `src/map.js`: kaart, lagen, thema's, clusters, markers
- `src/ui.js`: filters, KPI's, meldingen, panelen, planbord, vertrekbord, tijdbalk
- `src/fleet.js`, `src/roads.js`, `src/places.js`: simulatie, wegennet, standplaatsen
- `src/data/`: Natural Earth-data (vereenvoudigd) en standplaatsen
- `dist/index.html`: gebouwde demo; `dist/artifact.html`: variant voor het Claude-artifact
