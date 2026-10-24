# Simon Loos Live (3D-demo, versie 2)

Nederland als 3D-maquette in de huisstijl van Simon Loos, met de echte snelwegen, 42 standplaatsen, de distributiecentra van klanten en gesimuleerde live trucks met chauffeur, planning, brandstof en rijtijd.

- Gebouwd met [three.js](https://github.com/mrdoob/three.js) 0.180 (ES-modules), gebundeld met Vite tot één bestand.
- Online versie (privé, delen via het Share-menu): https://claude.ai/artifact/XoJhGY5ec7bBZh1cLDsyDC
- Concept en toelichting: https://claude.ai/artifact/9UWDNTfBo6qNpdNCMUBLmq

## Direct bekijken

Open `dist/index.html` in een browser. Alles zit in dat ene bestand (834 kB); er is geen server nodig. Alleen de lettertypen komen van Google Fonts en vallen offline terug op een systeemletter.

## Ontwikkelen

```
npm install
npm run dev      # lokale server met hot reload
npm run build    # bouwt dist/index.html (één bestand)
```

`dist/artifact.html` is dezelfde pagina zonder documentskelet, voor publicatie als claude.ai-artifact.

## Wat zit waar

| Bestand | Inhoud |
| --- | --- |
| `index.html` | Opmaak van de schermen: live-balk, bediening, detailpaneel, meldingen, uitleg |
| `src/world.js` | De 3D-wereld: land en IJsselmeer, provinciegrenzen, wegen als linten, pins, steden, licht, dag en nacht, gloed-effect |
| `src/fleet.js` | Truckmodellen en de simulatie: ritten, stops, pauzes, brandstof en accu, meldingen |
| `src/roads.js` | Wegennetwerk als graaf met kortste-padberekening (snelwegen hebben voorrang) |
| `src/places.js` | Standplaatsen, klanten, divisies en steden |
| `src/ui.js` | Bediening, panelen, zoeken, rondleiding, camerabesturing |
| `src/data/` | Geodata: kustlijn en IJsselmeer, provincies en wegen uit Natural Earth (public domain), vereenvoudigd |

## Echt en gesimuleerd

- Echt: standplaatsen, klanten, divisies en vacatureaantallen (crawl van simonloos.nl en werkenbijsimonloos.nl, oktober 2026); kustlijn, IJsselmeer, provincies en wegen uit Natural Earth 1:10m; huisstijl uit de stylesheet van de wervingssite (rood #E3001F, geel #FCC41F).
- Gesimuleerd: trucks, chauffeurs (fictieve namen), ritten, verbruik en de cijfers in de live-balk. Standplaatsen staan op plaatsniveau en zijn aan de dichtstbijzijnde weg gekoppeld.
- Volgende stap: posities uit de boordcomputer en ritten uit het TMS in plaats van de simulatie; de kaart en de panelen blijven hetzelfde.
