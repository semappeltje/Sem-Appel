// Maakt dist/artifact.html uit dist/index.html: zonder document-skelet, zodat het als Claude-artifact kan worden gepubliceerd.
const fs = require('fs');
let h = fs.readFileSync('dist/index.html', 'utf8');
for (const re of [/<!doctype html>/i, /<html[^>]*>/i, /<\/html>/i, /<head>/i, /<\/head>/i, /<body[^>]*>/i, /<\/body>/i, /<meta charset[^>]*>/i, /<meta name="viewport"[^>]*>/i]) h = h.replace(re, '');
fs.writeFileSync('dist/artifact.html', h.trim() + '\n');
console.log('dist/artifact.html', Math.round(fs.statSync('dist/artifact.html').size / 1024), 'kB');
