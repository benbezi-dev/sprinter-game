/* ===========================================================================
   L'APERCU DU LIEN
   ---------------------------------------------------------------------------
   Ce qu'on voit quand quelqu'un colle sprinter-game.com — sur X, dans un
   message, sur Discord, dans une story. Ce n'est pas une carte de campagne :
   c'est l'habit permanent du lien, et c'est la premiere image du jeu que
   beaucoup verront.

   ELLE PORTE LES COULEURS DU JEU, pas celles du pack de communication : fond
   #060913, or #F8CD4A, Outfit 900 — la meme charte que l'affiche que le jeu
   dessine a la fin d'une course, et que les cartes de defi. Le bleu nuit et le
   degrade orange sont reserves aux jours de competition ; l'apercu du lien,
   lui, est servi tous les jours de l'annee.

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
import { capturer, enTetePolices } from './chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'public/og-1200x630.png');

// Une image du jeu, pas un aplat : l'apercu doit montrer ce qu'on va voir en
// cliquant. Celle-ci sort deja du jeu et vit dans le pack de communication.
const FOND = path.join(RACINE, 'communication/riposte-danube/stade/x-1600x900-ligne.png');

const W = 1200, H = 630;

const page = `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:#060913;position:relative;
       font:500 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  /* La piste occupe toute la carte ; le texte se pose sur sa moitie gauche,
     qui est la partie sombre de l'image. Le degrade fait le reste : sans lui,
     un titre blanc sur du tartan orange devient illisible des que l'apercu est
     reduit a la taille d'un pouce. */
  img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .voile{position:absolute;inset:0;
         background:linear-gradient(100deg,#060913 0%,rgba(6,9,19,.94) 38%,
                    rgba(6,9,19,.55) 62%,rgba(6,9,19,.15) 100%)}
  .texte{position:absolute;inset:0;padding:70px 64px;
         display:flex;flex-direction:column;justify-content:center;
         align-items:flex-start;max-width:760px}
  .kicker{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;font-size:22px;
          letter-spacing:.42em;text-transform:uppercase;color:#F8CD4A;
          margin-bottom:26px}
  h1{font-size:76px;font-weight:900;letter-spacing:-.022em;line-height:.98;letter-spacing:-.02em;
     color:#eef2f8;margin-bottom:24px}
  /* Le seul mot en couleur est celui qui pose la question. En aplat d'or et
     non en degrade : le degrade appartient aux cartes de competition. */
  h1 em{font-style:normal;color:#F8CD4A}
  .sous{font-size:31px;color:rgba(255,255,255,.55);line-height:1.28;
        margin-bottom:38px}
  .pied{display:inline-block;background:#F8CD4A;
        color:#060913;font-weight:700;font-size:28px;
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
  await capturer({ html: page, w: W, h: H, sortie: SORTIE });
  console.log(`  ${path.relative(RACINE, SORTIE)}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
