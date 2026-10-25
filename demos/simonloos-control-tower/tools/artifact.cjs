// Maakt dist/artifact.html uit dist/index.html: zonder document-skelet, zodat het als Claude-artifact kan worden gepubliceerd.
// Daarna dist/demosite.html (zie onder).
const fs = require('fs');
let h = fs.readFileSync('dist/index.html', 'utf8');
for (const re of [/<!doctype html>/i, /<html[^>]*>/i, /<\/html>/i, /<head>/i, /<\/head>/i, /<body[^>]*>/i, /<\/body>/i, /<meta charset[^>]*>/i, /<meta name="viewport"[^>]*>/i]) h = h.replace(re, '');
fs.writeFileSync('dist/artifact.html', h.trim() + '\n');
console.log('dist/artifact.html', Math.round(fs.statSync('dist/artifact.html').size / 1024), 'kB');

// Maakt dist/demosite.html: de losse versie voor de demosite (controltower-demo.netlify.app). Die opent met OpenStreetMap
// zolang de kijker zelf niets koos (Kaartlagen) en zet de Assistent aan via de functie op /api/assistent.
const ROOT = '<div id="app" class="app slct">';
const los = fs.readFileSync('dist/index.html', 'utf8');
if (los.split(ROOT).length !== 2) throw new Error('dist/index.html: de app-root staat er niet precies een keer in');
fs.writeFileSync('dist/demosite.html', los.replace(ROOT, '<div id="app" class="app slct" data-basiskaart="online" data-ai="/api/assistent">'));
console.log('dist/demosite.html', Math.round(fs.statSync('dist/demosite.html').size / 1024), 'kB');
