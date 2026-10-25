#!/usr/bin/env node
// Zet de site-build (dist-site/, van `npm run build:site`) in de SafeTail-website-repo:
//
//   npm run build:site
//   node tools/sync-safetail.mjs ../../../website      # pad naar de website-repo (SafeTail-V-O-F/Website)
//
// Kopieert app.js, data.js, lib.js, uplot.js, maplibre.js, three.js, buildings.js en app.css naar <repo>/public/intern/control-tower/app/ en schrijft daar
// VERSIE.json (commit en datum van deze repo, bestandsgroottes). De pagina src/pages/intern/control-tower.astro in
// die repo laadt deze bestanden en toont de versie. Daarna in de website-repo: npm run build, npm test, committen
// (DEPLOY.md, "SafeTools · Control Tower").
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(app, 'dist-site');
const target = process.argv[2];
if (!target) { console.error('Gebruik: node tools/sync-safetail.mjs <pad naar de website-repo>'); process.exit(1); }
const doel = path.join(path.resolve(target), 'public', 'intern', 'control-tower', 'app');
// lib.js: de bibliotheken van de interface (svelte-gantt, MiniSearch, Floating UI; alle MIT); uplot.js: de grafieken (MIT)
const FILES = ['app.js', 'data.js', 'lib.js', 'uplot.js', 'maplibre.js', 'three.js', 'buildings.js', 'app.css'];
// portretten.js: de beelden van voertuigen en opleggers (renders van de 3D-modellen), pas geladen op een detailpagina of
// in een kaartje; los bestand als de module er is
if (existsSync(path.join(dist, 'portretten.js'))) FILES.push('portretten.js');
for (const f of FILES) if (!existsSync(path.join(dist, f))) { console.error(`${f} ontbreekt in dist-site/: draai eerst npm run build:site`); process.exit(1); }
// three.js mag alleen dynamisch geladen worden (bij de eerste klik op de kubus): een statische import in app.js zou het bij elke paginalading ophalen
if (/from\s*["']\.\/three\.js["']/.test(readFileSync(path.join(dist, 'app.js'), 'utf8'))) { console.error('app.js importeert three.js statisch; scene3d.js mag niets uit de app importeren (geef het mee via opts.data)'); process.exit(1); }
// buildings.js (2,4 MB gebouwen voor de 3D-wereld) ook alleen dynamisch: import('./buildings.js'), nooit statisch
if (/from\s*["']\.\/buildings\.js["']/.test(readFileSync(path.join(dist, 'app.js'), 'utf8')) || /from\s*["']\.\/buildings\.js["']/.test(readFileSync(path.join(dist, 'data.js'), 'utf8'))) { console.error('buildings.js wordt statisch geïmporteerd; laad het met import(\'./buildings.js\') in de 3D-laag'); process.exit(1); }
mkdirSync(doel, { recursive: true });
const bestanden = {};
for (const f of FILES) { copyFileSync(path.join(dist, f), path.join(doel, f)); bestanden[f] = statSync(path.join(doel, f)).size; }
const git = (...a) => { try { return execFileSync('git', a, { cwd: app, encoding: 'utf8' }).trim(); } catch { return ''; } };
const commit = git('rev-parse', '--short', 'HEAD');
const vuil = git('status', '--porcelain', '--', 'src', 'index.html', 'vite.site.config.js', 'package.json') !== '';
const versie = { bron: 'semappeltje/Sem-Appel, demos/simonloos-control-tower', commit: commit + (vuil ? ' (met niet-gecommitteerde wijzigingen)' : ''), datum: new Date().toISOString().slice(0, 10), bestanden };
writeFileSync(path.join(doel, 'VERSIE.json'), `${JSON.stringify(versie, null, 2)}\n`);
console.log(`Gekopieerd naar ${doel}:`);
for (const [f, n] of Object.entries(bestanden)) console.log(`  ${f.padEnd(12)} ${Math.round(n / 1024).toLocaleString('nl-NL')} kB`);
console.log(`VERSIE.json: commit ${versie.commit}, ${versie.datum}`);
