import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Losse pagina: alles in één dist/index.html (ook als artifact te openen). cssTarget laat esbuild de CSS nesting van
// src/style.css afvlakken tot gewone selectors, zodat ook oudere browsers hem lezen.
export default defineConfig({ base: './', plugins: [viteSingleFile()], build: { target: 'es2020', cssTarget: ['chrome87', 'firefox78', 'safari14', 'edge88'], minify: true, cssCodeSplit: false, assetsInlineLimit: 100000000, reportCompressedSize: false, rollupOptions: { output: { inlineDynamicImports: true } } } });
