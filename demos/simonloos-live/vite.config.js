import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', minify: true, cssCodeSplit: false, assetsInlineLimit: 100000000, reportCompressedSize: false },
});
