# 3D-middelen (CC0), klaargezet voor de 3D-wereld

Alleen modellen met de licentie CC0 (publiek domein), elk onder de 300 KB. Ze zitten nog niet in de app:
de 3D-bouwer kiest wat hij gebruikt. Bron, licentie en wat er aan elk bestand veranderd is staan hieronder;
de oorspronkelijke licentietekst staat als `License.txt` in elke map, een schermafbeelding als `voorbeeld.png`.
Het advies over wat waar past staat in `rapporten/simon-loos-control-tower/onderzoek-en-repos.md` (deel 3, 3D).

| Map | Pakket | Licentie | Bestanden | Grootte | Driehoeken |
| --- | --- | --- | --- | --- | --- |
| `kenney-car-kit/` | Kenney Car Kit 3.1 | CC0 1.0 | `delivery.glb` (bakwagen in speelgoedmaat), `van.glb` (bestelbus) | 64,0 en 60,9 KB | 2.476 en 2.082 in beeld (wielen als aparte nodes) |
| `kenney-nature-kit/` | Kenney Nature Kit 2.1 | CC0 1.0 | tien bomen: `tree_default`, `tree_oak`, `tree_detailed`, `tree_fat`, `tree_tall` (populier), `tree_cone`, `tree_simple`, `tree_small`, `tree_pineTallA`, `tree_plateau` | 3,5 tot 16,4 KB | 50 tot 402 |
| `kenney-city-kit-industrial/` | Kenney City Kit Industrial 1.0 | CC0 1.0 | acht bedrijfshallen en fabrieken (`building-e, h, i, k, m, p, q, s`), `detail-tank`, `chimney-large` | 19,8 tot 86,2 KB | 212 tot 2.062 |

De 22 modellen samen zijn 668 KB; met de drie voorbeeldbeelden en de licenties is de map 1,0 MB (1 KB = 1.024 bytes).

## Herkomst

- Kenney (www.kenney.nl) publiceert de pakketten als CC0. Gehaald uit de GitHub-spiegel
  `series-ai/jam-ready-assets` (commit 2d7c410, 15 oktober 2026; Git LFS via media.githubusercontent.com),
  map `kenney-car-kit/3D/vehicles-racing`, `kenney-nature-kit/3D/nature` en
  `kenney-city-kit-industrial/3D/city`; de `License.txt` per map komt uit dezelfde spiegel. kenney.nl zelf is
  vanuit de onderzoeksomgeving niet bereikbaar.
- Bewerking met glTF-Transform 4.5 (MIT): textuur ingebed (geen los `Textures/colormap.png` meer), dubbele
  data samengevoegd, hoekpunten gelast en gekwantiseerd (`KHR_mesh_quantization`). `KHR_texture_transform` is
  weggehaald: bij Kenney is dat een identiteit (eerst per bestand gecontroleerd), en zonder die extensie leest
  ook de glTF-lader van deck.gl de textuur (getest met de `ScenegraphLayer`). Ongebruikte
  extensie-verklaringen zijn opgeruimd. three.js `GLTFLoader` leest alles zonder extra decoder. Uiterlijk
  gecontroleerd met een render in Chromium (`voorbeeld.png`).

## Gebruik en kanttekeningen

- Laden: `new GLTFLoader().loadAsync(url)` of `parse(buffer, '', gltf => ...)`. Importeer de bestanden alleen
  vanuit `src/scene3d.js` (of een module die in de 3D-bundel valt), als `import url from '../assets-3d/...glb?url'`.
  Beide Vite-configuraties zetten `assetsInlineLimit` op 100.000.000: het model komt dan als data-URL in de
  3D-bundel (`three.js` in de sitebuild). Zo blijft de vaste bestandslijst van `tools/sync-safetail.mjs`
  kloppen en laadt niets van buiten. Reken op een derde extra door base64, en kijk na `npm run build:site`
  of alleen `three.js` gegroeid is.
- Schaal: de Kenney-voertuigen hebben speelgoedverhoudingen (breedte : lengte 1 : 2,2; een echte bakwagen is
  ongeveer 1 : 3,7). Bruikbaar als bestelbus of voor de verte, niet als trekker met oplegger; daarvoor is een
  eigen procedureel model beter.
- Bomen: gebruik ze als `InstancedMesh` per soort (geometrie en materiaal uit de GLB halen); kleur bijstellen
  kan via het materiaal. De populier (`tree_tall`) past bij het Nederlandse landschap langs wegen.
- Hallen: als achtergrond op bedrijventerreinen rond standplaatsen en DC's; de eigen loods met docks blijft
  procedureel (de Kenney-hallen hebben geen docks).
