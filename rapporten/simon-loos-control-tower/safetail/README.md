# Control Tower als tabblad in SafeTools (safetail.nl/intern/control-tower)

De Control Tower 2.0 staat als eigen tabblad "Control Tower" in SafeTools, het interne
deel van safetail.nl (achter de inlog van de oprichters, naast Ideeënbus, Vragen
beantwoorden en Dossiers). De wijzigingen voor de website staan in de repo
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

Daarna samenvoegen in `setup-astro-site` en deployen zoals altijd (DEPLOY.md). Er is geen
migratie, geen nieuwe omgevingsvariabele en niets aan de edge function veranderd.

## Wat er in de website-repo verandert

- `src/pages/intern/control-tower.astro`: de pagina, met de HTML-opbouw van de app en
  twee opties op de app-root: `data-tiles="off"` (geen kaarttegels van buiten) en
  `data-embedded` (sneltoetsen alleen in de app, hal-scherm op volledig scherm).
- `public/intern/control-tower/app/`: de gebouwde app (`app.js`, `data.js`, `maplibre.js`,
  `app.css`, `VERSIE.json`), gebouwd uit `demos/simonloos-control-tower` in deze repo met
  `npm run build:site` en `node tools/sync-safetail.mjs`. Achter de `/intern`-gate, niets
  in `/_astro`.
- `InternBar.astro` en `InternIcon.astro`: het tabblad met icoon; `intern/index.astro`: een
  compacte kaart op het overzicht (drie naast elkaar vanaf 1024 px).
- `global.css`: `@source not` zodat Tailwind de bundel niet scant; `tsconfig.json`: de
  bundel buiten `astro check`.
- `CLAUDE.md` en `DEPLOY.md`: beschrijving, bijwerken, gate, privacy, grootte.

## Wat er in deze repo veranderde (commit e0238de)

De app is inbedbaar gemaakt: alle CSS onder `.slct`, thema en kiosk op de app-root,
`contain: layout` houdt de vaste panelen binnen de app, een terugval zonder WebGL, en een
tweede Vite-build met vaste bestandsnamen. De losse versie (`dist/index.html`, het artifact)
werkt onveranderd.

## Gecontroleerd

- De eigen bewakers van de site op de nieuwe route en het overzicht: status, console,
  overflow, `.reveal`, privacy (0 verzoeken naar derden, 0 cookies), SEO-head, dubbele
  id's, huisstijl en links, in de drie standen (1440, 390, 390 met minder beweging).
- De app zelf in Chromium: met en zonder WebGL, los en ingebed, licht en donker,
  hal-scherm, alle weergaven, 1440 en 390 px.
- Schermafbeeldingen: `01` tot en met `04` in deze map.

Let op: de gate zet op alles onder `/intern` `Cache-Control: private, no-store`, dus de
bundel (ongeveer 8 MB, ruim 3 MB gecomprimeerd) laadt bij elk bezoek opnieuw. Voor de
oprichters prima; wordt dat hinderlijk, dan is de data in deze repo kleiner te maken.
