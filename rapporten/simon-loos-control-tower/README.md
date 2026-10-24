# Simon Loos Control Tower: plan en mockups

Plan en mockups voor een realistische versie van de live-kaart voor Simon Loos
(opvolger van de 3D-demo in `demos/simonloos-live`).

- Document met het volledige plan (naamgeving, kritiek op de demo, ideeën,
  open-source bouwstenen, architectuur, pilotplan):
  https://claude.ai/artifact/BsyZjcAeqfYVS23BX9aSYL
- Mockups (PNG, 3200 × 2000) in `mockups/`
- Bron van de mockups in `bron/`: `gen.py` rendert de vier HTML-schermen op
  Natural Earth-kaartdata; de HTML-bestanden zijn zelfstandig te openen.

## De vier schermen

| # | Scherm | Wat het laat zien |
| --- | --- | --- |
| 1 | Landelijk overzicht | 1.300 trucks als clusters per standplaats, statusring, KPI's, uitzonderingen |
| 2 | Regio Noord-Holland | Filter op standplaats Wognum: losse trucks met rijrichting, andere standplaatsen gedimd |
| 3 | Truckdetail | Rit met stops, tijdvensters, ETA, telemetrie (accu, koeling, rijtijd), chauffeur |
| 4 | Planbord Wognum | Ritten per truck op een tijdlijn met conflicten (rijtijd, rusttijd, tijdvenster) |

## Hoe zo'n systeem heet

Fleet Management Systeem (FMS, telematica van de boordcomputers), Transport
Management Systeem (TMS, planning) en daarbovenop een **control tower** of
visibility-platform (bijvoorbeeld Simacan, dat Albert Heijn gebruikt). Dit
voorstel is die control-tower-laag, gebouwd op open source:
Traccar, MapLibre GL JS, deck.gl, Supercluster, Valhalla, PostGIS + TimescaleDB,
Mosquitto, vis-timeline, Apache ECharts.

## Data

Kaart: Natural Earth 10m (land, meren, provincies, wegen, stedelijk gebied,
rivieren). De regionale wegen rond Hoorn, Enkhuizen en Medemblik zijn met de hand
toegevoegd omdat ze in Natural Earth ontbreken. Standplaatsen en klanten komen
van werkenbijsimonloos.nl. Alle operationele data (wagennummers, kentekens,
chauffeurs, ritten, tijden, aantallen trucks per standplaats) is gesimuleerd.
