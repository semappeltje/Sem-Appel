// Foto's van de schaalmodellen van Simon Loos (Sem Appel, oktober 2026) klaarzetten voor de app:
//   node tools/fotos-modellen.mjs <map met de originelen>
// Schrijft per foto een uitsnede van 960 x 640 (WebP) in src/assets/fotos/ voor de voertuigpagina's, en een verkleinde
// kopie van het hele beeld (1600 px, JPEG) in rapporten/simon-loos-control-tower/fotos-modellen/ als bron.
// De uitsneden zijn met de hand bepaald (links, boven, breedte, hoogte in pixels van het origineel).
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const bron = process.argv[2]; if (!bron) { console.error('geef de map met de originelen'); process.exit(2); }
const FOTOS = [
  { in: '00cffeee-image.jpg', uit: 'daf-xf-koeloplegger-voor', crop: [620, 760, 1290, 860] },
  { in: '7a6294da-image.jpg', uit: 'daf-xf-koeloplegger-zij', crop: [90, 180, 2400, 1600] },
  { in: '0b8b46eb-image.jpg', uit: 'mercedes-actros-bakwagen-aanhanger-voor', crop: [60, 650, 1380, 920] },
  { in: '1c175955-image.jpg', uit: 'mercedes-actros-bakwagen-aanhanger-zij', crop: [40, 160, 2400, 1600] },
];
const app = path.join(here, '..', 'src', 'assets', 'fotos');
const rap = path.join(here, '..', '..', '..', 'rapporten', 'simon-loos-control-tower', 'fotos-modellen');
for (const f of FOTOS) {
  const src = path.join(bron, f.in); const [left, top, width, height] = f.crop;
  const uit = path.join(app, f.uit + '.webp');
  await sharp(src).rotate().extract({ left, top, width, height }).resize(960, 640, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile(uit);
  const kopie = path.join(rap, f.uit + '.jpg');
  await sharp(src).rotate().resize({ width: 1600, height: 1600, fit: 'inside' }).jpeg({ quality: 85, mozjpeg: true }).toFile(kopie);
  const a = (await sharp(uit).metadata()); const sa = (await import('node:fs')).statSync(uit).size; const sb = (await import('node:fs')).statSync(kopie).size;
  console.log(`${f.uit}: ${a.width}x${a.height} ${Math.round(sa / 1024)} KB (webp) · bron ${Math.round(sb / 1024)} KB`);
}
