# Simon Loos Control Tower (demo, versie 1.2)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde trucks die
over het **echte wegennet** rijden, op een kaart die zonder internet werkt. Clusters
bij uitzoomen, stippen bij inzoomen, filters op regio, standplaats, divisie en status,
een truckdetail met rit, ETA, accu en rijtijd, een planbord, een standplaatsenoverzicht
met vertrekbord, een assistent (planvoorstellen, vragen, berichten met chauffeurs,
overdracht) en een licht thema in de Simon Loos-kleuren met een donkere stand.

## Draaien

```
npm install
npm run dev        # ontwikkelserver
npm run build      # dist/index.html: één bestand met alles erin (ca. 8 MB)
```

Open `dist/index.html` via een webserver (bijvoorbeeld `npx vite preview` of
`python3 -m http.server` in `dist/`). Direct vanaf schijf (`file://`) werkt niet,
omdat MapLibre een web worker start.

## Kaart en wegen

- **Wegen en water: OpenStreetMap via Overture Maps** (release 2026-10-21.0, licentie
  ODbL). Snelwegen, autowegen en N-wegen vormen de routeergraaf (47.640 knopen,
  66.327 kanten) waarover de trucks rijden; secundaire en tertiaire wegen worden
  getoond vanaf zoomniveau 9 en 10,5. Water: zee, IJsselmeer, meren en rivieren als
  vlakken.
- **Provincies en bebouwing: Natural Earth 10m.**
- **MapLibre GL JS 6** (BSD). De basiskaart zit in het bestand zelf; met internet
  kunnen OpenStreetMap-tegels van CARTO eroverheen (schakelaar links onderaan).
- Trucks zijn stippen in de statuskleur; clusters tonen de statusverdeling als ring.
- Geen glyph-server nodig: plaatsnamen en standplaatsen zijn HTML-markers.

## Simulatie

Elke truck heeft een vast dagplan (rijden, lossen, pauze, laden, terrein) langs een
route die met Dijkstra op reistijd over de routeergraaf is berekend (`src/roads.js`,
`src/fleet.js`). De positie op elk tijdstip volgt uit dat plan, zodat kaart, planbord,
vertrekbord en replay altijd overeenkomen. De routes van alle 1.300 trucks worden bij
het openen in ongeveer een seconde berekend.

## Data opnieuw maken

In `tools/` staan de scripts: `ov_download.py` haalt de Overture-parquetbestanden
(transportation/segment en base/water) voor de Nederlandse bounding box op van S3,
`process2.py` bouwt de routeergraaf, de weergavewegen en het water, `water2.py`
filtert slootpatronen uit het water. Vereist `pyarrow`, `shapely`.

## Wat echt is en wat niet

Echt: wegen, water, de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl,
oktober 2026) en de divisies. Gesimuleerd: trucks, wagennummers, kentekens,
chauffeurs, ritten, tijden, vertragingen, accustanden, berichten, collega's en het
aantal trucks per standplaats.

## Bestanden

- `index.html`, `src/main.js`: opbouw en de klok van de simulatie
- `src/map.js`: kaart, lagen, thema's, clusters, markers
- `src/ui.js`: filters, KPI's, meldingen, panelen, planbord, vertrekbord, assistent
- `src/fleet.js`, `src/roads.js`, `src/places.js`: simulatie, wegennet, standplaatsen
- `src/data/`: `graph.json` (routeergraaf), `roads_display.json`, `water.json`,
  `provinces.json`, `urban.json`, `places.json`
- `dist/index.html`: gebouwde demo; `dist/artifact.html`: variant voor het Claude-artifact
