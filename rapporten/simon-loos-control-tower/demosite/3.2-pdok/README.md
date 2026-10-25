# Demosite: hotfix 3.2 met PDOK als online kaartlaag

Voor controltower-demo.netlify.app, tot 4.0 er staat. CARTO vraagt sinds oktober 2026 een API-sleutel voor
basemaps.cartocdn.com en stuurt anders tegels met het watermerk "API KEY REQUIRED"; de online laag was daardoor
onbruikbaar. Deze build van 3.2 (app-commit 7ef9e04 plus hotfix b6bccce op de lokale tak hotfix/3.2-pdok, het verschil
staat in map.js.patch) gebruikt de BRT Achtergrondkaart van Kadaster/PDOK: zonder sleutel, licentie CC BY 4.0,
host service.pdok.nl. Licht thema pastel, donker thema grijs. SafeTools is niet geraakt (daar staan de tegels uit).

- index.html: de hele losse app in één bestand (8,8 MB), neerzetten als public/index.html van de demo-repo.
- Externe hosts in deze build: service.pdok.nl (alleen als de online laag aanstaat), tiles.openfreemap.org (de
  3D-gebouwen in de 3D-stand). Geen CARTO meer.
