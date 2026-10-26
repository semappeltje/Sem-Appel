# Control Tower 4.0 als tabblad in SafeTools (safetail.nl/intern/control-tower)

Versie 4.0 van de Control Tower voor Simon Loos, voor het tabblad "Control Tower" in SafeTools (achter de inlog van
de oprichters). Deze sessie mag niet naar de website-repo pushen; de tak staat daarom hier als git-bundel:
`safetail-control-tower.bundle`, met de tak `ronde10/control-tower-40`: drie commits boven 7ca8fbf (de live main),
tip 48c90ca. Geen meetbon: die schrijft de website-sessie na haar eigen groene run.

## Zo zet je de tak in de website-repo

```
cd <pad naar de website-repo>
git fetch <pad naar Sem-Appel>/rapporten/simon-loos-control-tower/safetail/safetail-control-tower.bundle ronde10/control-tower-40:ronde10/control-tower-40
git checkout ronde10/control-tower-40
npm ci && npm test          # bouwt, draait de rooktests, schrijft de meetbon
git push -u origin ronde10/control-tower-40
```

Daarna samenvoegen en deployen zoals altijd (DEPLOY.md). Geen migratie, geen nieuwe omgevingsvariabele, niets aan de
edge function. De vorige bundel (`ronde10/control-tower-35`, 2af272a) is hiermee vervallen: 4.0 bevat die wijziging
ook.

## Wat er in de website-repo verandert

- `src/pages/intern/control-tower.astro`: de opbouw van de app 4.0 (zijbalk, de weergaven Overzicht, Kaart, Ritten,
  Meldingen, Open ritten, Planbord, Voertuigen, Opleggers, Chauffeurs, Charters en oproep, Standplaatsen, Laden,
  Lostijden, Pauzeplekken, Rapporten, Instellingen, een onderbalk op de telefoon, popover, dialoog, meldingen; 36
  ids), met dezelfde twee opties op de root (`data-tiles="off"`, `data-embedded`); de tekst in de kop en de noot
  onderaan.
- `public/intern/control-tower/app/`: de gebouwde app, negen bestanden en `VERSIE.json` (bron: Sem-Appel, commit
  6eeafab, 26 oktober 2026). Bij het openen: `app.js` (797 kB), `data.js` (8,6 MB), `lib.js` (svelte-gantt,
  MiniSearch, Floating UI; 132 kB), `maplibre.js` (1,6 MB), `app.css` (212 kB). Pas als het nodig is, door `app.js`
  zelf geladen: `uplot.js` (grafieken, 52 kB), `portretten.js` (renders van voertuigen en opleggers uit onze eigen
  3D-modellen, 987 kB), `three.js` (815 kB) en `buildings.js` (2,5 MB; samen de 3D-wereld, bij de eerste klik op de
  kubus).
- `tests/smoke/control-tower.spec.mjs`: `APP_BESTANDEN` en `SHELL_IDS` voor 4.0; de regel voor three.js geldt ook
  voor `buildings.js`, `uplot.js` en `portretten.js` (alleen via een dynamische import, nooit statisch in app.js,
  lib.js, maplibre.js of data.js).
- `CLAUDE.md` en `DEPLOY.md`: de bestanden, de grootte, wat de app bewaart.

## Hosts buiten de eigen

Ingebed in SafeTools (`data-tiles="off"`): geen enkele, gemeten in alle standen (verify gl embedded op 1440, 390 en
met minder beweging: "externe hosts: geen"; de derde eindcontrole: nul verzoeken naar buiten over 24 weergaven en
pagina's, licht en donker, 1440 en 390, ook in 3D). Alleen de losse demosite met de online lagen aan vraagt
tiles.openfreemap.org en service.pdok.nl; die stand bestaat in SafeTools niet. Geen tel:-links, geen cookie, alles
wat de app bewaart staat in `localStorage` onder `sl-*`.

## Gecontroleerd (26 oktober 2026, build 6eeafab)

In de website-repo, op deze tak met de app erin: `npm run build` groen (63 pagina's) en de volledige rooktestrun
(`npm run test:e2e -- --no-build`) groen; één klik in `formulier.spec` ("de keuzes gaan mee in de POST (zonder JS)")
viel onder zware belasting om en was bij herhaling van die spec meteen goed. `control-tower.spec` groen: de 36 ids,
de tien bestanden, geen statische import van uplot, portretten, three of buildings, de commit in de noot gelijk aan
`VERSIE.json`.

In de app zelf (Sem-Appel, `demos/simonloos-control-tower`, dezelfde build): toets.test (14), verdeel.test (5),
assistent-check (185 van 185, zonder API), otm5-check, data-check (vingerafdruk van de werkdag 3859288126), verify gl
plain, gl embedded en nogl plain, open-ritten-check (47), voorstel-check (26), ochtend-check (39: maandag en zondag
om 04:00, 05:30 en 06:30, de maandag na de zomertijd, de oefendag), portretten-check, ui-check gl (168) en nogl
(160), 3d-check (18) en map-check (102 van 103; de ene meting is de draaisnelheid van de volgcamera in 3D, die in de
run met twee stromen tegelijk 200 graden per seconde mat en bij herhaling op een rustige machine 68, bij een grens van
60: de camera begrenst zichzelf op 60 graden per seconde met de klok van de eigen beeldlus, de test leest de tijd van het
beeld waarin MapLibre tekent, en op een software-GPU lopen die twee tot 15 procent uiteen; op dezelfde code was de
meting eerder vandaag groen. Geen gebrek in de app; de test krijgt een meting met dezelfde klok, zie de ideeënbank).
Daarvoor drie eindcontroles door een aparte agent tegen `acceptatie-4.0.md`; het oordeel van de derde: opleveren na
twee herstelpunten (het eerste kaartbeeld op een trage machine, het belmoment dat in de rij afbrak), beide hersteld
en opnieuw gemeten in deze build.

Schermafbeeldingen van het tabblad met 4.0 (astro preview, eerste bezoek, dus met het keuzescherm voor het
werkgebied): `01-safetail-control-tower-1440.png`, `02-safetail-control-tower-1440-app.png` (Open ritten),
`03-safetail-control-tower-390.png`, `04-safetail-overzicht-kaart-1440.png`.
