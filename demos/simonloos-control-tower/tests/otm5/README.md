# OTM5: vastgezette specificatie en voorbeelden

Deze map hoort bij `tests/otm5-check.mjs` en `src/otm5.js`. De bestanden staan hier vast, zodat de controle elke keer
tegen dezelfde versie draait (een contracttest) en zonder internet werkt.

| Bestand | Wat | Bron | Versie en datum |
| --- | --- | --- | --- |
| `otm-api-v5.9.yaml` | De OpenAPI-specificatie van OTM 5.9.0 (OpenAPI 3.1, 184 schema's) | github.com/opentripmodel/otm5-change-requests, `otm-api/otm-api-v5.9.yaml`, commit `fcef9632561a22ae347f60a9618c4011053e5238` | 5.9.0, uitgebracht 2 oktober 2026; sha256 `fade9d9ab0e5343a7b216a677b0e8f3dd112b228afc93f698d1ddc7b2bc4bb24` |
| `voorbeelden/trip_with_*.json` | De vier voorbeeldritten uit de OTM-documentatie (pagina "Monitoring trips") | github.com/opentripmodel/documentation, `app/static/data/`, commit `fd0e098ef420eb3be04ba3a701d4204c97500940` | 16 december 2024 (laatste wijziging van de map); repo gelezen op commit `c87e397` van 13 oktober 2026 |
| `voorbeeld-simonloos.json` | Eén gesimuleerde dag van één trekker (T-1008, Wognum) om 10:00, met de open ritten van de standplaats, als OTM5-bundel | gemaakt met `node tests/otm5-check.mjs --schrijf-voorbeeld` | gesimuleerd |

Licentie: de OTM-documentatie staat onder Creative Commons Naamsvermelding-GelijkDelen 4.0 (CC BY-SA 4.0), zoals de
README's van `opentripmodel/documentation` en `opentripmodel/opentripmodel` zeggen. De repo met de specificatie
(`otm5-change-requests`) heeft zelf geen licentiebestand; we gaan uit van dezelfde licentie (nakijken bij SUTC). Beheer van
OTM: Stichting Uniforme Transport Code (SUTC), sinds 2018, samen met TLN, evofenedex en DALTI.

Wat de controle over de officiële voorbeelden vond (25 oktober 2026): drie van de vier valideren tegen 5.9.
`trip_with_vehicle.json` niet, omdat het voertuig `"fuel": "Diesel"` heeft; 5.9 kent alleen kleine letters (`diesel`), en
sinds 5.8 hoort brandstof in `fuels`. Ook de documentatie zelf is niet overal gelijk aan het schema: de pagina "Adding
constraints" schrijft `timeWindowsConstraint` (het schema kent `timeWindowConstraint`), en de pagina "External attributes"
toont teksten als waarde, terwijl 5.9 voor elke waarde in `externalAttributes` een object vraagt. Een inname moet dus
ruimhartig lezen en streng melden.

Een echt bestand controleren (bijvoorbeeld één dag OTM5 van Albert Heijn):

```
node tests/otm5-check.mjs --bestand pad/naar/bestand.json
```
