import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  root: resolve(__dirname),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    fs: {
      // Allow serving files from project root
      allow: ['..']
    }
  }
});
