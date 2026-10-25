# Control Tower als tabblad in SafeTools (safetail.nl/intern/control-tower)

De Control Tower (versie 3.2) staat als eigen tabblad "Control Tower" in SafeTools, het
interne deel van safetail.nl (achter de inlog van de oprichters, naast Ideeënbus, Vragen
en Dossiers). De wijzigingen voor de website staan in de repo
`SafeTail-V-O-F/Website` op de tak `ronde10/control-tower`; omdat deze sessie daar niet
mag pushen, staat die tak hier als git-bundel: `safetail-control-tower.bundle`.

## Zo zet je de tak in de website-repo

```
cd <pad naar de website-repo>
git fetch <pad naar Sem-Appel>/rapporten/simon-loos-control-tower/safetail/safetail-control-tower.bundle ronde10/control-tower-34:ronde10/control-tower-34
git checkout ronde10/control-tower-34
npm ci && npm test          # bouwt, draait de rooktests, schrijft de meetbon
git push -u origin ronde10/control-tower-34
```

De eerdere bundels (405e494: versie 3.1; b2765c0: de zes punten uit de Fable-review) heeft
de websitesessie samengevoegd en live gezet (`setup-astro-site` op 1e5f201). Ook de
bundel met de drie punten uit de deltareview (a25ddba) en versie 3.2 met de 3D-wereld (tak
ronde10/control-tower-33, `three.js` als vijfde bestand) zijn samengevoegd en live
(`setup-astro-site` op 584a75a). Deze bundel bevat de tak `ronde10/control-tower-34`: twee
commits boven 584a75a met de nieuwe bundel (three.js wordt pas geladen bij de eerste klik op de
kubus en app.js hangt er niet meer statisch aan, bronregel volgt de tegels, paneel naast een
open pagina), de 3D-stand in de opslaglijst en de meetbon. `git fetch <bundel> ronde10/control-tower-34` werkt in een kopie die 584a75a al
heeft. Daarna
samenvoegen in `setup-astro-site` en deployen zoals altijd (DEPLOY.md). Er is geen migratie,
geen nieuwe omgevingsvariabele en niets aan de edge function veranderd.

## Wat er in de website-repo verandert

- `src/pages/intern/control-tower.astro`: de pagina, met de HTML-opbouw van de app (met
  de weergave Opleggers van 3.0) en twee opties op de app-root: `data-tiles="off"` (geen
  kaarttegels van buiten) en `data-embedded` (sneltoetsen alleen na een klik in de app,
  hal-scherm op volledig scherm).
- `public/intern/control-tower/app/`: de gebouwde app (`app.js`, `data.js`, `maplibre.js`,
  `three.js` sinds 3.2, `app.css`, `VERSIE.json`), gebouwd uit `demos/simonloos-control-tower` in deze repo met
  `npm run build:site` en `node tools/sync-safetail.mjs`. Achter de `/intern`-gate, niets
  in `/_astro`.
- `InternBar.astro` en `InternIcon.astro`: het tabblad met icoon (het tabblad "Vragen
  beantwoorden" heet in de balk nu "Vragen", zodat zeven tabbladen passen);
  `intern/index.astro`: een compacte kaart op het overzicht (drie naast elkaar vanaf
  1024 px).
- `global.css`: `@source not` zodat Tailwind de bundel niet scant; `tsconfig.json`: de
  bundel buiten `astro check`; `.gitattributes`: geen diff van de bundel.
- `CLAUDE.md` en `DEPLOY.md`: beschrijving, bijwerken, gate, privacy, grootte.

## Wat er in deze repo veranderde

Commit e0238de maakte de app inbedbaar: alle CSS onder `.slct`, thema en kiosk op de
app-root, `contain: layout` houdt de vaste panelen binnen de app, een terugval zonder
WebGL, en een tweede Vite-build met vaste bestandsnamen. Commit 75acd59 is versie 3.0:
diensten zonder vaste wagen, losse opleggers en trekkers, bakwagens en bussen, een kaart
met voertuigen in hun rijrichting en zonder clusters, de weergave Opleggers. Commits 29bddd1
en f939ca9 zijn versie 3.1: het nieuwe ontwerp (ontwerpsysteem, rustige kaart, minder drukke
weergaven, mobiele opzet) en de verbeterde werking (voorstellen die het plan aanpassen,
URL's voor elke weergave, meldingen met geheugen, panelen, planbordfilters, aftelling,
zoekpalet). Commit 7594cae verwerkt de zes punten uit de Fable-review van de SafeTail-tab
(volledig scherm sluiten, minder beweging, toegankelijkheid, namen, kentekens, tellingen);
commit 92b17b1 de drie punten uit de deltareview (topbalk in een smal kader, terugknop naar
de kaart, schakelaar van de online kaartlaag); commit 443d64d is versie 3.2: de 3D-wereld op
de kaart (three.js in een eigen MapLibre-laag, knop met de kubus, toets d); commit e575459 laadt
three.js pas bij de eerste klik en verwerkt drie puntjes uit de deltacheck van de website. De losse versie (`dist/index.html`, het artifact) is dezelfde app.

## Gecontroleerd

- De eigen bewakers van de site op de nieuwe route en het overzicht: status, console,
  overflow, `.reveal`, privacy (0 verzoeken naar derden, 0 cookies), SEO-head, dubbele
  id's, huisstijl en links, in de drie standen (1440, 390, 390 met minder beweging).
- De app zelf in Chromium: met en zonder WebGL, los en ingebed, licht en donker,
  hal-scherm, alle weergaven, 1440 en 390 px.
- Schermafbeeldingen: `01` tot en met `04` in deze map.

Let op: de gate zet op alles onder `/intern` `Cache-Control: private, no-store`, dus de
bundel (ongeveer 8,7 MB, 3,9 MB gecomprimeerd) laadt bij elk bezoek opnieuw. Voor de
oprichters prima; wordt dat hinderlijk, dan is de data in deze repo kleiner te maken.
