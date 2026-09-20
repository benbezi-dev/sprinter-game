import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

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

// LA MUSIQUE DU MOLOSSE NE DOIT PAS PARTIR EN PRODUCTION, et il a fallu ce
// greffon pour qu'elle n'y parte plus.
//
// Le mode d'Halloween est ferme au public jusqu'au 24 octobre, et tout son
// code en sort bien du build : `HALLOWEEN_OUVERT` se replie a faux, les trois
// `lazy` portent `@__PURE__`, et plus aucun morceau Halloween n'est emis.
// Son MORCEAU DE MUSIQUE, lui, restait — sept cent huit kilo-octets servis
// depuis sprinter-game.com/assets/molosse-*.mp3, mesures en ligne, sur un
// site dont le jeu ne propose ce mode a personne.
//
// LA RAISON N'EST PAS LA MEME QUE POUR LE CODE. Un fichier importe en `?url`
// est emis par Vite au MOMENT OU LE MODULE EST LU, avant que Rollup ne decide
// ce qu'il garde. L'elagage vient trop tard : le mp3 est deja sur le disque,
// et rien ne le reprend. Aucune annotation ne peut rattraper cela — il faut
// que l'import ne soit jamais resolu.
//
// MEME REMEDE QUE POUR FIREBASE, un peu plus bas : on resout vers un faux
// module. La chaine vide qui en sort n'est jamais lue, puisque le seul appelant
// (game/halloween-musique.ts) vit dans un morceau que la production n'a pas.
const canalDuBuild = (mode: string) => {
  const env = loadEnv(mode, process.cwd(), '');
  return process.env.VITE_CANAL || env.VITE_CANAL || '';
};

const musiqueHorsProduction = (canal: string) => canal === 'test' ? [] : [{
  name: 'sprinter-musique-hors-production',
  enforce: 'pre' as const,
  resolveId(source: string) {
    return source.includes('assets/molosse.mp3') ? '\0musique-absente' : null;
  },
  load(id: string) {
    return id === '\0musique-absente' ? 'export default "";' : null;
  },
}];

export default defineConfig(({ mode }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...musiqueHorsProduction(canalDuBuild(mode)),
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
      // Voir src/game/firebase-web-absent.ts : le greffon Firebase importe le
      // SDK web dans une branche que le jeu ne prend jamais. On resout cet
      // import vers un faux module plutot que d'embarquer `firebase` en entier
      // pour du code qui ne sera pas charge.
      'firebase/messaging': path.resolve(
        import.meta.dirname, 'src/game/firebase-web-absent.ts'),
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
}));
