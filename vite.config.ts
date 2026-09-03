import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// BASE_PATH: pour GitHub Pages, mettez "/<nom-du-repo>/" (ex: "/sprinter/").
// En local ou sur un domaine racine, laissez "/".
const basePath = process.env.BASE_PATH || '/';
const port = Number(process.env.PORT) || 5173;

// L'adresse du serveur, pour pouvoir enfin regarder le jeu tourner en local.
//
// Les quinze fichiers de `src/game` portent chacun la meme adresse en dur, et
// c'est voulu : une constante partagee serait un endroit de plus ou se tromper
// de canal. Mais cela veut dire qu'aucun ecran ne peut parler a un
// `wrangler dev` — et donc que tout ce qui n'existe que sur le canal de test,
// championnats en tete, ne se verifiait jusqu'ici qu'en ligne de commande.
//
// Ce greffon remplace l'adresse partout a la fois, jamais dans un seul module :
// la moitie des requetes qui iraient en local pendant que l'autre moitie part
// en production ferait entrer de vraies parties de test au vrai classement.
// C'est precisement ce que le garde-fou de `canal.ts` cherche a empecher.
//
// Sans `API_LOCALE` dans l'environnement, il ne s'installe pas : un build
// ordinaire — et donc tout ce qui est publie — ne le voit jamais passer.
const API_PROD = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const apiLocale = process.env.API_LOCALE || '';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(apiLocale ? [{
      name: 'sprinter-api-locale',
      enforce: 'pre' as const,
      transform(code: string, id: string) {
        if (!id.includes('/src/') || !code.includes(API_PROD)) return null;
        return { code: code.split(API_PROD).join(apiLocale), map: null };
      },
      configResolved() {
        console.log(`\n  ⚠  API_LOCALE actif — le jeu parle a ${apiLocale}, pas au serveur reel.\n`);
      },
    }] : []),
  ],
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
