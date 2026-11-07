import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Eén bestand: dist/index.html met alles erin (ook als Claude-artifact te openen). cssTarget laat esbuild de CSS nesting
// van src/style.css afvlakken tot gewone selectors.
export default defineConfig({ base: './', plugins: [viteSingleFile()], build: { target: 'es2020', cssTarget: ['chrome87', 'firefox78', 'safari14', 'edge88'], minify: true, cssCodeSplit: false, assetsInlineLimit: 100000000, reportCompressedSize: false } });
