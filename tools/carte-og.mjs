/* ===========================================================================
   L'APERCU DU LIEN
   ---------------------------------------------------------------------------
   Ce qu'on voit quand quelqu'un colle sprinter-game.com — sur X, dans un
   message, sur Discord, dans une story. Ce n'est pas une carte de campagne :
   c'est l'habit permanent du lien, et c'est la premiere image du jeu que
   beaucoup verront.

   ELLE NE PORTE AUCUN CHIFFRE, ET C'EST LA REGLE QUI LA DEFINIT. Les cartes de
   campagne annoncent un record et se refabriquent a chaque fois pour cette
   raison (voir l'en-tete de carte-defi.mjs). Celle-ci est servie par le site
   pendant des mois : un chrono ecrit dessus serait faux la semaine suivante.
   Elle dit donc ce qui ne change pas — deux touches, cent metres, un
   classement — et rien d'autre.

     node tools/carte-og.mjs

   Sort public/og-1200x630.png, la taille que Facebook, X et LinkedIn
   attendent. Le fichier est versionne : le site le sert tel quel, et
   index.html le designe par une adresse absolue — une adresse relative est
   ignoree par la moitie des lecteurs d'apercu.
   =========================================================================== */
import path from 'node:path';
import { capturer } from './chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'public/og-1200x630.png');

// Une image du jeu, pas un aplat : l'apercu doit montrer ce qu'on va voir en
// cliquant. Celle-ci sort deja du jeu et vit dans le pack de communication.
const FOND = path.join(RACINE, 'communication/riposte-danube/stade/x-1600x900-ligne.png');

const W = 1200, H = 630;

const page = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:#070b16;position:relative;
       font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  /* La piste occupe toute la carte ; le texte se pose sur sa moitie gauche,
     qui est la partie sombre de l'image. Le degrade fait le reste : sans lui,
     un titre blanc sur du tartan orange devient illisible des que l'apercu est
     reduit a la taille d'un pouce. */
  img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .voile{position:absolute;inset:0;
         background:linear-gradient(100deg,#060a14 0%,rgba(6,10,20,.94) 38%,
                    rgba(6,10,20,.55) 62%,rgba(6,10,20,.15) 100%)}
  .texte{position:absolute;inset:0;padding:70px 64px;
         display:flex;flex-direction:column;justify-content:center;
         align-items:flex-start;max-width:760px}
  .kicker{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:22px;
          letter-spacing:.42em;text-transform:uppercase;color:#f7a93f;
          margin-bottom:26px}
  h1{font-size:76px;font-weight:700;line-height:.98;letter-spacing:-.02em;
     color:#eef2f8;margin-bottom:24px}
  /* Le seul mot en couleur est celui qui pose la question. */
  h1 em{font-style:normal;
        background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 48%,#ef7526 96%);
        -webkit-background-clip:text;background-clip:text;color:transparent}
  .sous{font-size:31px;color:#a7b4c8;line-height:1.28;margin-bottom:38px}
  .pied{display:inline-block;
        background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 50%,#ef7526 96%);
        color:#0a1020;font-weight:700;font-size:28px;
        padding:18px 40px;border-radius:999px}
  </style>
  <img src="file://${FOND}" alt="">
  <div class="voile"></div>
  <div class="texte">
    <div class="kicker">Sprinter</div>
    <h1>Tu vaux quoi<br><em>sur 100 mètres</em> ?</h1>
    <div class="sous">Deux touches, une piste, et un classement mondial
      où ton nom reste.</div>
    <div class="pied">sprinter-game.com</div>
  </div>`;

try {
  capturer({ html: page, w: W, h: H, sortie: SORTIE });
  console.log(`  ${path.relative(RACINE, SORTIE)}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
