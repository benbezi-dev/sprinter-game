/* ===========================================================================
   LA CARTE DU VAINQUEUR — celle qu'on poste quand la ligne est franchie.

     node tools/carte-vainqueur.mjs --vainqueur "Pseudo" --temps 8,246 --accord
     node tools/carte-vainqueur.mjs --vainqueur "Pseudo" --temps 8.246 --pays FR \
          --titre "Champion de France" --evenement "Championnat de France" \
          --epreuve 100 --second 8.258 --accord
     node tools/carte-vainqueur.mjs ... --voix jeu

   Sort deux PNG dans communication/celebration-vainqueur/ : `-feed`
   (1080 x 1350, Instagram) et `-story` (1080 x 1920, story et TikTok).

   DEUX VOIX, COMME LES CARTES D'UN CHAMPIONNAT (carte-championnat.mjs).

     (defaut)      LES JOURS DE COMPETITION : bleu nuit, degrade orange,
                   adresse en pastille. Un sacre en est un.
     --voix jeu    CELLE DU JEU : fond #060913, lueur doree, Outfit 900, or.
                   Elle sort dans voix-du-jeu/, sous les memes noms : ce sont
                   les memes cartes, et les melanger ferait choisir au hasard
                   au moment de publier.

   LE NOM D'UN JOUEUR NE SE PUBLIE PAS SANS SON ACCORD (charte §5.4, et
   communication/plan-viral-lancement.md). Une carte de vainqueur porte ce nom
   en grand : l'outil refuse donc de la fabriquer sans --accord, qui dit qu'on
   l'a demande et obtenu. C'est un garde-fou, pas une formalite — un seul
   pseudonyme publie sans accord et la communaute se ferme.

   LE CHRONO GARDE LA PRECISION DU JEU. Le jeu compte en millisecondes : un
   vainqueur a 8,246 ne s'ecrit pas 8,25. Et la virgule est francaise, comme
   partout ailleurs sur les cartes.

   Sans reseau, SPRINTER_POLICES designe un dossier de woff2 et son CSS (voir
   chrome.mjs).
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { trouverChrome, capturer, enTetePolices } from './chrome.mjs';
import { ENCRE, fond, flamme, echelle, drapeau, echappe } from './voix-competition.mjs';
import {
  FOND, OR, BLANC, ENCRE as ENCRE_JEU, LUEUR, encre, or, unite, RETRAIT_VIRGULE,
} from '../src/game/palette-affiche.js';
import { EPREUVE } from '../src/game/trace-affiche.js';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const DOSSIER = path.join(RACINE, 'communication/celebration-vainqueur');
const SITE = 'sprinter-game.com';

const FORMATS = [
  { cle: 'feed', w: 1080, h: 1350 },
  { cle: 'story', w: 1080, h: 1920 },
];

/* ------------------------------------------------------------- les arguments */

function lireArgs(argv) {
  const a = {
    vainqueur: '', temps: '', epreuve: '100', pays: '', titre: 'Vainqueur',
    evenement: '', second: '', voix: 'competition', nom: 'carte-vainqueur',
    accord: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = () => String(argv[++i] || '');
    switch (argv[i]) {
      case '--vainqueur': a.vainqueur = v().trim(); break;
      case '--temps': a.temps = v(); break;
      case '--epreuve': a.epreuve = v().replace(/\s*m$/i, ''); break;
      case '--pays': a.pays = v().toUpperCase(); break;
      case '--titre': a.titre = v(); break;
      case '--evenement': a.evenement = v(); break;
      case '--second': a.second = v(); break;
      case '--voix': a.voix = v().toLowerCase(); break;
      case '--nom': a.nom = v(); break;
      case '--accord': a.accord = true; break;
      default: break;
    }
  }
  return a;
}

/** « 8,246 » ou « 8.246 » -> 8.246 ; null si illisible. */
function lireTemps(s) {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fmt3 = n => n.toFixed(3).replace('.', ',');

/**
 * La virgule d'un chrono en Space Mono, resserree.
 *
 * Chasse fixe : la virgule y prend la case d'un chiffre et « 8,246 » se lit
 * « 8 , 246 ». On lui retire RETRAIT_VIRGULE chasse de chaque cote, la mesure
 * que le jeu applique deja (`morceauxChrono`). Une chasse de Space Mono fait
 * 0,6 em.
 */
const chronoHTML = s => echappe(s).replace(/[,.]/,
  m => `<span style="margin:0 -${(RETRAIT_VIRGULE * 0.6).toFixed(3)}em">${m}</span>`);

/* ------------------------------------------------------- ce que la carte dit */

function composer(a) {
  const t = lireTemps(a.temps);
  const ep = EPREUVE(a.epreuve);
  const t2 = a.second ? lireTemps(a.second) : null;
  /* L'ECART, SEULEMENT S'IL EST VRAI. On ne le calcule que si l'on donne le
     chrono du deuxieme : l'inventer serait pire que ne rien dire. */
  const ecart = t2 != null && t2 > t ? fmt3(t2 - t) : null;
  return {
    kicker: a.evenement ? `${a.evenement} · ${ep}` : ep,
    titre: a.titre,
    drapeau: drapeau(a.pays),
    qui: a.vainqueur,
    chrono: fmt3(t),
    fort: ecart ? `${ecart} s d’avance.` : 'Personne n’est allé plus vite.',
    doux: 'À toi de le battre.',
  };
}

/* ------------------------------------------- la voix des jours de competition */

function page(c, { w, h }) {
  const k = echelle(w, h);
  const R = n => Math.round(n * k);
  const story = h > 1500;
  // LA STORY A DES MARGES QU'ON NE VOIT PAS : Instagram pose son en-tete sur
  // les deux cents premiers pixels et sa barre de reponse sur les deux cent
  // cinquante derniers. Rien d'important n'y va.
  const tailleNom = c.qui.length > 14 ? 74 : c.qui.length > 10 ? 92 : 112;
  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{${fond()};
       font:400 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       padding:${story ? 230 : R(96)}px ${R(70)}px ${story ? 300 : R(84)}px}
  .kicker{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;font-size:25px;
          letter-spacing:.3em;text-indent:.3em;white-space:nowrap;
          color:${ENCRE.kicker};text-transform:uppercase;margin-bottom:${R(40)}px}
  h1{font-size:${R(96)}px;font-weight:900;line-height:.98;letter-spacing:-.02em;
     text-transform:uppercase;max-width:${R(960)}px;
     background:${flamme(48)};-webkit-background-clip:text;background-clip:text;color:transparent}
  .coeur{margin:auto 0;display:flex;flex-direction:column;align-items:center}
  .drapeau{font-size:${R(84)}px;line-height:1;margin-bottom:${R(26)}px}
  .qui{font-size:${R(tailleNom)}px;font-weight:900;color:${ENCRE.vif};
       letter-spacing:-.015em;line-height:1;max-width:${R(940)}px;
       overflow-wrap:anywhere;margin-bottom:${R(34)}px}
  .chrono{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
          font-size:${R(168)}px;line-height:1;letter-spacing:-.02em;
          background:${flamme(50)};-webkit-background-clip:text;background-clip:text;color:transparent}
  .chrono small{font-size:.38em;letter-spacing:0;margin-left:.15em}
  .fort{font-size:${R(48)}px;font-weight:900;color:${ENCRE.vif};letter-spacing:-.01em;
        margin-bottom:${R(12)}px}
  .doux{font-size:${R(32)}px;color:${ENCRE.doux};margin-bottom:${R(40)}px}
  .pied{display:inline-block;flex:none;background:${flamme(50)};
        color:${ENCRE.surPastille};font-weight:700;font-size:${R(38)}px;
        padding:${R(24)}px ${R(56)}px;border-radius:999px}
  </style>
  <div class="kicker">${echappe(c.kicker)}</div>
  <h1>${echappe(c.titre)}</h1>
  <div class="coeur">
    ${c.drapeau ? `<div class="drapeau">${c.drapeau}</div>` : ''}
    <div class="qui">${echappe(c.qui)}</div>
    <div class="chrono">${chronoHTML(c.chrono)}<small>s</small></div>
  </div>
  <div class="fort">${echappe(c.fort)}</div>
  <div class="doux">${echappe(c.doux)}</div>
  <div class="pied">${SITE}</div>`;
}

/* ------------------------------------------------------- la voix du jeu

   Les proportions de l'affiche du jeu (`game/trace-affiche.js`, par
   `palette-affiche`) : marge a 8,2 % de la largeur, surtitre a 10,5 % de la
   hauteur, pied a une marge et demie du bas. Le titre est en or, le chrono en
   blanc et en Space Mono, comme sur l'affiche de fin de course.
--------------------------------------------------------------------------- */

function pageJeu(c, { w, h }) {
  const L = w, H = h;
  const story = H > 1500;
  const marge = Math.round(L * 0.082);
  const u = unite(L, H);
  const T = t => Math.round(u * t);
  const pc = v => `${+(v * 100).toFixed(3)}%`;
  // En story, le surtitre et le pied descendent sous l'en-tete d'Instagram et
  // remontent au-dessus de sa barre de reponse.
  const hautY = story ? 230 : Math.round(H * 0.105);
  const piedY = story ? H - 300 : Math.round(H - marge * 0.92);
  const tailleNom = c.qui.length > 14 ? 0.066 : c.qui.length > 10 ? 0.082 : 0.100;
  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${L}px;height:${H}px;overflow:hidden}
  body{position:relative;background:${FOND};
       font:500 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  .lueur{position:absolute;inset:0;
         background:radial-gradient(circle ${Math.round(L * LUEUR.rayon)}px
                    at ${pc(LUEUR.x)} ${pc(LUEUR.y)},${or(LUEUR.alpha)} 0%,${or(0)} 100%)}
  .surtitre{position:absolute;top:${hautY}px;left:0;width:100%;text-align:center;
            font-weight:700;font-size:${Math.round(L * 0.0205)}px;
            letter-spacing:.36em;text-indent:.36em;text-transform:uppercase;
            color:${encre(ENCRE_JEU.surtitre)}}
  .pile{position:absolute;left:${marge}px;right:${marge}px;
        top:${hautY + Math.round(L * 0.055)}px;bottom:${H - piedY + marge}px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        text-align:center}
  h1{font-weight:900;font-size:${T(0.082)}px;line-height:.95;letter-spacing:-.022em;
     color:${OR};text-transform:uppercase;margin-bottom:${T(0.07)}px}
  .drapeau{font-size:${T(0.075)}px;line-height:1;margin-bottom:${T(0.024)}px}
  .qui{font-weight:900;font-size:${T(tailleNom)}px;line-height:1;color:${BLANC};
       letter-spacing:-.015em;overflow-wrap:anywhere;margin-bottom:${T(0.03)}px}
  .chrono{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
          font-size:${T(0.165)}px;line-height:1;color:${BLANC};letter-spacing:-.02em}
  .chrono small{font-size:.36em;color:${encre(ENCRE_JEU.nom)};letter-spacing:0;margin-left:.15em}
  .etat{font-weight:700;font-size:${T(0.036)}px;color:${or(0.9)};margin-top:${T(0.07)}px}
  .doux{font-size:${T(0.03)}px;color:${encre(ENCRE_JEU.lien)};margin-top:${T(0.014)}px}
  .filet{position:absolute;left:${marge}px;right:${marge}px;
         top:${piedY - Math.round(marge * 0.58)}px;height:1px;background:${encre(ENCRE_JEU.filet)}}
  .pied{position:absolute;left:${marge}px;right:${marge}px;top:${piedY}px;
        transform:translateY(-50%);display:flex;justify-content:space-between;
        font-weight:700;font-size:${Math.round(L * 0.0205)}px;
        letter-spacing:${(L * 0.006).toFixed(1)}px;text-transform:uppercase}
  .pied .g{color:${encre(ENCRE_JEU.pied)}}
  .pied .d{color:${OR};text-transform:none;letter-spacing:${(L * 0.001).toFixed(1)}px}
  </style>
  <div class="lueur"></div>
  <div class="surtitre">${echappe(c.kicker)}</div>
  <div class="pile">
    <h1>${echappe(c.titre)}</h1>
    ${c.drapeau ? `<div class="drapeau">${c.drapeau}</div>` : ''}
    <div class="qui">${echappe(c.qui)}</div>
    <div class="chrono">${chronoHTML(c.chrono)}<small>s</small></div>
    <div class="etat">${echappe(c.fort)}</div>
    <div class="doux">${echappe(c.doux)}</div>
  </div>
  <div class="filet"></div>
  <div class="pied"><span class="g">Sprinter</span><span class="d">${SITE}</span></div>`;
}

/* ------------------------------------------------------------------ l'outil */

const a = lireArgs(process.argv.slice(2));

if (!a.vainqueur || !a.temps) {
  console.error('Donne --vainqueur "Pseudo" et --temps 8,246.');
  process.exit(1);
}
if (lireTemps(a.temps) == null) {
  console.error(`Temps illisible : « ${a.temps} ». Attendu par exemple 8,246.`);
  process.exit(1);
}
if (a.second && lireTemps(a.second) == null) {
  console.error(`Temps du deuxième illisible : « ${a.second} ».`);
  process.exit(1);
}
if (!a.accord) {
  console.error(`La carte publie le nom de « ${a.vainqueur} » : demande-lui d'abord son accord`);
  console.error('(charte §5.4), puis relance avec --accord.');
  process.exit(1);
}
if (!['competition', 'jeu'].includes(a.voix)) {
  console.error(`Voix inconnue : ${a.voix}. Attendu competition ou jeu.`);
  process.exit(1);
}

const jeu = a.voix === 'jeu';
const c = composer(a);
const sortie = jeu ? path.join(DOSSIER, 'voix-du-jeu') : DOSSIER;
fs.mkdirSync(sortie, { recursive: true });
const chrome = trouverChrome();

for (const f of FORMATS) {
  const chemin = path.join(sortie, `${a.nom}-${f.cle}.png`);
  await capturer({ html: jeu ? pageJeu(c, f) : page(c, f), w: f.w, h: f.h, sortie: chemin, chrome });
  console.log(path.relative(RACINE, chemin));
}

console.log(`\n${c.qui} — ${c.chrono} s, ${c.kicker}.`);
console.log(`Voix : ${jeu ? 'celle du jeu (fond noir, or)' : 'les jours de compétition (bleu nuit, orange)'}.`);
