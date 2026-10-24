# Simon Loos Live (3D-demo)

Demo van het Simon Loos-netwerk in 3D, gebouwd met [three.js](https://github.com/mrdoob/three.js) (release r128, UMD-build in `vendor/three.min.js`).

- Open `index.html` in een browser; er is geen server of installatie nodig.
- Online versie (privé, delen via het Share-menu): https://claude.ai/artifact/XoJhGY5ec7bBZh1cLDsyDC
- Concept en toelichting: https://claude.ai/artifact/9UWDNTfBo6qNpdNCMUBLmq

## Wat echt is en wat gesimuleerd

- Echt: de 42 standplaatsen, de klant-DC's, de divisies en de vacatureaantallen (crawl van simonloos.nl en werkenbijsimonloos.nl, oktober 2026); kustlijn en IJsselmeer uit Natural Earth (open data); huisstijl uit de stylesheet van de wervingssite (rood #E3001F, geel #FCC41F).
- Gesimuleerd: trucks, chauffeurs (fictieve namen), ritten, brandstof en de cijfers in de live-balk. Wegen zijn schematische corridors; standplaatsen staan op plaatsniveau.

## Bestanden

- `index.html`: de complete demo (HTML, CSS, JavaScript en de kaartdata in één bestand).
- `vendor/three.min.js`: three.js r128 (MIT-licentie, mrdoob/three.js).
