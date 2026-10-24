import { defineConfig } from 'vite';
// Build voor inbedding in een site (SafeTail, safetail.nl/intern/control-tower): geen index.html, maar vaste
// bestandsnamen die een pagina zelf laadt: app.js (de code), data.js (het wegennet en de plaatsen), maplibre.js
// (de kaartbibliotheek), three.js (de 3D-wereld) en app.css. De code verandert vaak, de data zelden: zo blijft een update klein.
// Gebruik: npm run build:site, dan node tools/sync-safetail.mjs <pad naar de website-repo>.
export default defineConfig({
  base: '/intern/control-tower/app/',
  build: {
    outDir: 'dist-site', emptyOutDir: true, target: 'es2020', cssTarget: ['chrome87', 'firefox78', 'safari14', 'edge88'],
    minify: true, cssCodeSplit: false, assetsInlineLimit: 100000000, reportCompressedSize: false, modulePreload: false,
    rollupOptions: {
      input: 'src/main.js',
      output: {
        entryFileNames: 'app.js', chunkFileNames: '[name].js', assetFileNames: 'app.[ext]',
        manualChunks(id) { if (id.includes('/src/data/')) return 'data'; if (id.includes('node_modules/maplibre-gl/')) return 'maplibre'; if (id.includes('node_modules/three/')) return 'three'; },
      },
    },
  },
});
