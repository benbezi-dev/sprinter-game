import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { EPREUVES_APERCU, titreLong } from './src/game/epreuve-titre.js';

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

/* ---------------------------------------------------------------------------
   UNE PAGE D'APERCU PAR EPREUVE
   ---------------------------------------------------------------------------
   LE PROBLEME, CONSTATE SUR UN LIEN ENVOYE. Un defi sur 400 m haies partage
   dans une conversation montrait « Sprinter — tu vaux quoi sur 100 mètres ? ».
   Les balises Open Graph d'`index.html` sont ECRITES EN DUR, et le robot qui
   fabrique l'apercu ne lit pas le JavaScript : `?defi=VTWUJG` lui rend
   exactement le meme fichier, avec le meme titre, quelle que soit la distance.

   CE QU'ON NE PEUT PAS FAIRE ICI. Rendre ces balises dynamiques demanderait un
   serveur qui compose la page ; le site est servi par GitHub Pages, en
   fichiers statiques (`server: GitHub.com` dans les en-tetes), et le domaine
   n'est pas derriere un proxy qui permettrait d'y brancher un Worker.

   CE QU'ON FAIT A LA PLACE. Les epreuves sont six, connues a l'avance : on
   ecrit six pages. `/defi/400h/` porte le bon titre, la bonne image et la
   bonne description, puis renvoie le visiteur vers le jeu avec son code. Le
   robot s'arrete a la premiere ; l'humain ne la voit jamais.

   LA REDIRECTION EST EN JAVASCRIPT, PAS EN `meta refresh`. Plusieurs robots
   d'apercu suivent un `refresh` et vont lire la page d'arrivee — dont les
   balises sont justement celles qu'on cherche a remplacer. Le `noscript` garde
   un lien visible pour le cas, rare, ou le script ne tourne pas : mieux vaut
   un lien a cliquer qu'une page blanche.
--------------------------------------------------------------------------- */

function pagesDApercu(base: string) {
  return {
    name: 'sprinter-apercu-par-epreuve',
    apply: 'build' as const,
    closeBundle() {
      const source = fs.readFileSync(
        path.resolve(import.meta.dirname, 'index.html'), 'utf8');
      // L'IMAGE reste celle du jeu : une vignette par epreuve serait six
      // fichiers a tenir a jour pour une image que personne ne regarde deux
      // fois. LA DESCRIPTION, elle, ne peut pas rester : celle d'`index.html`
      // commence par « Un 100 mètres en deux touches », ce qui contredit le
      // titre sur un defi de 400 m haies. On en compose une qui vaut pour les
      // six — et qui ne promet pas « deux touches » sur une course de haies,
      // ou il y a aussi les haies a passer.
      const image = (source.match(/og:image" content="([^"]+)"/) || [])[1] || '';

      for (const cle of EPREUVES_APERCU) {
        const fr = titreLong(cle);
        const titre = `Sprinter — tu vaux quoi sur ${fr} ?`;
        const desc = `Pose ton chrono sur ${fr}, entre au TOP 500 mondial, `
                   + `défie n'importe qui avec un code.`;
        const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titre}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${titre}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Huit coureurs sur la piste d'un stade de nuit, dans le jeu Sprinter." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titre}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="canonical" href="https://sprinter-game.com${base}" />
    <script>
      // Le code du defi voyage dans la requete : on le repasse tel quel.
      location.replace(${JSON.stringify(base)} + location.search + location.hash);
    </script>
  </head>
  <body style="background:#060913;color:#f8cd4a;font:600 16px system-ui;
               display:grid;place-items:center;height:100vh;margin:0">
    <noscript><a href="${base}" style="color:#f8cd4a">Ouvrir Sprinter — ${fr}</a></noscript>
  </body>
</html>
`;
        const dossier = path.resolve(import.meta.dirname, 'dist/defi', cle);
        fs.mkdirSync(dossier, { recursive: true });
        fs.writeFileSync(path.join(dossier, 'index.html'), html);
      }
      console.log(`  apercu : ${EPREUVES_APERCU.length} pages dans dist/defi/ (${EPREUVES_APERCU.map(titreLong).join(', ')})`);
    },
  };
}
export default defineConfig(({ mode }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...musiqueHorsProduction(canalDuBuild(mode)),
    pagesDApercu(basePath),
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
