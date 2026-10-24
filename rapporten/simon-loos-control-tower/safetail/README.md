# Control Tower als tabblad in SafeTools (safetail.nl/intern/control-tower)

De Control Tower (versie 3.0) staat als eigen tabblad "Control Tower" in SafeTools, het
interne deel van safetail.nl (achter de inlog van de oprichters, naast Ideeënbus, Vragen
en Dossiers). De wijzigingen voor de website staan in de repo
`SafeTail-V-O-F/Website` op de tak `ronde10/control-tower`; omdat deze sessie daar niet
mag pushen, staat die tak hier als git-bundel: `safetail-control-tower.bundle`.

## Zo zet je de tak in de website-repo

```
cd <pad naar de website-repo>
git fetch <pad naar Sem-Appel>/rapporten/simon-loos-control-tower/safetail/safetail-control-tower.bundle ronde10/control-tower:ronde10/control-tower
git checkout ronde10/control-tower
npm ci && npm test          # bouwt, draait de rooktests, schrijft de meetbon
git push -u origin ronde10/control-tower
```

De bundel bouwt voort op commit 7bc9d46 (de top van `main` en `setup-astro-site` op 24 oktober
2026) en bevat twee commits: 1019985 (het tabblad, versie 2.0) en 958a680 (versie 3.0 en de
puntjes uit de review). Daarna samenvoegen in `setup-astro-site` en deployen zoals altijd
(DEPLOY.md). Er is geen migratie, geen nieuwe omgevingsvariabele en niets aan de edge
function veranderd.

## Wat er in de website-repo verandert

- `src/pages/intern/control-tower.astro`: de pagina, met de HTML-opbouw van de app (met
  de weergave Opleggers van 3.0) en twee opties op de app-root: `data-tiles="off"` (geen
  kaarttegels van buiten) en `data-embedded` (sneltoetsen alleen na een klik in de app,
  hal-scherm op volledig scherm).
- `public/intern/control-tower/app/`: de gebouwde app (`app.js`, `data.js`, `maplibre.js`,
  `app.css`, `VERSIE.json`), gebouwd uit `demos/simonloos-control-tower` in deze repo met
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
met voertuigen in hun rijrichting en zonder clusters, de weergave Opleggers. De losse
versie (`dist/index.html`, het artifact) is dezelfde app.

## Gecontroleerd

- De eigen bewakers van de site op de nieuwe route en het overzicht: status, console,
  overflow, `.reveal`, privacy (0 verzoeken naar derden, 0 cookies), SEO-head, dubbele
  id's, huisstijl en links, in de drie standen (1440, 390, 390 met minder beweging).
- De app zelf in Chromium: met en zonder WebGL, los en ingebed, licht en donker,
  hal-scherm, alle weergaven, 1440 en 390 px.
- Schermafbeeldingen: `01` tot en met `04` in deze map.

Let op: de gate zet op alles onder `/intern` `Cache-Control: private, no-store`, dus de
bundel (ongeveer 8 MB, 3,8 MB gecomprimeerd) laadt bij elk bezoek opnieuw. Voor de
oprichters prima; wordt dat hinderlijk, dan is de data in deze repo kleiner te maken.
