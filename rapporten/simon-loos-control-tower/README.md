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

## Versie 2.0: ontwerpvoorstellen, rollen en mockups

Zeven nieuwe mockups in `mockups-2.0/` bij het document
https://claude.ai/artifact/PEAiAqMnTV7Y2TUxrqyaE3 (voorstellen waarover per stuk
wordt beslist; niets hiervan zit al in de demo `demos/simonloos-control-tower`).

| # | Scherm | Wat het laat zien |
| --- | --- | --- |
| 01 | Echte landkaart | Wognum, Zwaag en Hoorn op straatniveau (Overture Maps / OpenStreetMap: gebouwen, landgebruik, water, straatnamen), trucks als stippen, rustige interface met iconenbalk |
| 02 | Truck: historie | Wie reed erop, kerngegevens uit de RDW, verbruik per chauffeur, afgeschermde kosten per km |
| 03 | Persoon (regiomanager) | Vandaag, bevoegdheden, rij-score en schades open; contract en kosten gesloten |
| 04 | Persoon (planner) | Dezelfde pagina met alleen vandaag en bevoegdheden open |
| 05 | Werkgebied kiezen | Eenmalige wizard: regio's, rittypes, klaar |
| 06 | Beheer: rollen | Rechtenmatrix per rol, gebruikers, koppelingen |
| 07 | Chauffeursapp | Mijn dag en Schade melden op de telefoon |

Bron in `bron-2.0/`: `mock2.py` rendert de HTML-schermen (de kaart komt uit
Overture-parquet via shapely, opgehaald met `demos/simonloos-control-tower/tools/ov_bbox.py`),
`mock2.css` is het ontwerpsysteem (wit, Inter, één accentkleur, iconenbalk).

## Plan 4.1: document en mockups (26 oktober 2026)

Het plan voor 4.1 (`plan-4.1.md`, de lat in `acceptatie-4.1.md`) als document voor Sem en de directie:
`Plan-4.1-Control-Tower-Simon-Loos.pdf` (A4, 16 pagina's), gemaakt van `plan-4.1/index.html` met
`node plan-4.1/maak-pdf.cjs` (Playwright; twee rondes voor de paginanummers in de inhoud, daarna de controles).
De mockups staan in `mockups-4.1/` als PNG met de HTML erbij, in de beeldtaal van de app (linkerbalk, topbalk,
kaarten en statuskleuren uit `demos/simonloos-control-tower/src/style.css`); `node mockups-4.1/schiet.cjs` schiet
ze opnieuw (1440 × 900, en Bezetting en Vrijgeven ook 390 × 844) en zet een JPEG-kopie in `plan-4.1/img/` voor de pdf.
Alle namen, ritten, tijden en bedragen in de mockups zijn gesimuleerd; de chauffeursnamen komen uit de simulatie.

| # | Scherm | Bouwsteen |
| --- | --- | --- |
| 01 | Bezetting: twee weken per dag en dagdeel, tekort en overschot, kosten als schatting, voorstellen per dag (ook 390 px) | F |
| 02 | Vrijgeven: de diensten van morgen met hun status, Planning vrijgeven, een dienst met een verschil (ook 390 px) | C |
| 03 | Het bericht op de telefoon van de chauffeur, met gezien en akkoord en de plekkenniskaart | D, I |
| 04 | Het chauffeursprofiel: de teller, het rooster, bevoegdheden, afspraken, vaste routes, het voorkeursbod | A, B, G, J |
| 05 | De kandidaatkaart van een open rit: de teller, past in het rooster, ervaring op het adres, wie afvalt | A, B, I |
| 06 | De ritopdracht naar de boordcomputer: de stappen en het OTM5-bericht naast de rit | E |
| 07 | Het dashboard voor de directie, alleen-lezen | K, H |
| 08 | Een duurzaam voorstel: rijd deze rit elektrisch, met de berekening en de bron van elk getal | K |
