import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// BASE_PATH: pour GitHub Pages, mettez "/<nom-du-repo>/" (ex: "/sprinter/").
// En local ou sur un domaine racine, laissez "/".
const basePath = process.env.BASE_PATH || '/';
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
