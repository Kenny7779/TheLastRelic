import { defineConfig } from 'vite';

// base './' hace que el build funcione en cualquier ruta (GitHub Pages incluido).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
