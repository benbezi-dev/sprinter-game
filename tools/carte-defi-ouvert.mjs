/* ===========================================================================
   LA CARTE DU DEFI OUVERT
   ---------------------------------------------------------------------------
   Un chrono pose, un code a six lettres, et le compte de ceux qui ont essaye.
   C'est la carte qu'on poste quand on ne s'adresse a personne en particulier :
   le defi n'est pas envoye, il est AFFICHE, et n'importe qui peut le relever.

   POURQUOI UN CODE ET PAS SEULEMENT UN LIEN. Instagram et TikTok ne rendent
   pas les liens cliquables dans une legende — ni dans un commentaire. Un lien
   y est un texte mort qu'il faudrait recopier a la main, et personne ne le
   fait. Le code, lui, se retient en une seconde et se tape dans le jeu : c'est
   LUI le lien sur ces deux reseaux, et c'est pour ca qu'il est l'element le
   plus gros de la carte. Sur X, le lien fonctionne et la carte porte les deux.
   L'alphabet du code exclut 0/O et 1/I/L (voir CODE_ALPHABET cote worker) :
   il se dicte a voix haute, ce qui en fait aussi un code de video.

   POURQUOI LE COMPTEUR SE LIT A L'ENVOI. « 12 ont essaye » est vrai une
   heure. Les cartes fixes du pack ont deja fait poster un record perime — on
   ne recopie donc aucun chiffre ici : tout est relu sur l'API au moment du
   rendu, comme carte-defi.mjs et carte-riposte.mjs le font deja.

   POURQUOI PAS PUPPETEER. Les deux autres cartes le prennent dans le chantier
   des films promo, avec un chemin de Chrome ecrit en dur pour un Mac. Celle-ci
   doit pouvoir sortir d'une machine qui n'a rien installe : elle passe par
   tools/chrome.mjs, qui pilote Chrome en ligne de commande et ne demande rien
   d'autre que Chrome.

     node tools/carte-defi-ouvert.mjs --code ZEZE42
     node tools/carte-defi-ouvert.mjs --code ZEZE42 --titre "TU TIENS COMBIEN ?"
     node tools/carte-defi-ouvert.mjs --code ZEZE42 --chrono 8,64 --nom BEN --epreuve 100

   La derniere forme ne touche pas au reseau : elle sert a preparer une carte
   avant d'avoir couru, ou quand l'API ne repond pas. Tout ce qui est donne a
   la main remplace ce que l'API aurait dit.

   Sort trois PNG dans communication/defi-ouvert/cartes/ :
     <code>-feed.png    1080x1350  Instagram, fil
     <code>-story.png   1080x1920  story, Reels, TikTok
     <code>-x.png       1600x900   X

   DEUX MAQUETTES, ET CHACUNE SON JOUR.

     --style affiche  (defaut) celle que le JEU dessine deja quand un joueur
                      partage sa course — fond #060913, lueur doree, titre en
                      Outfit 900, chrono en Space Mono, pied « SPRINTER / JEU
                      DE SPRINT ». Les proportions sont recopiees de
                      game/trace-affiche.js, pas approchees a l'oeil : meme
                      marge, memes tailles, meme inter-lettrage. C'est la voix
                      ordinaire du compte, celle des defis.
     --style carte    bleu nuit et degrade orange, celle de carte-defi.mjs et
                      carte-riposte.mjs. Elle est reservee aux JOURS DE
                      COMPETITION du calendrier World Athletics, ou le compte
                      parle d'autre chose que de lui : un record du monde, une
                      finale, un chrono d'ailleurs. Deux voix, deux occasions —
                      et on ne melange pas les deux dans la meme semaine.

   LES POLICES du style affiche viennent de Google Fonts, comme dans le jeu
   (voir src/index.css). Sur une machine sans reseau, pose les woff2 et le CSS
   qui les declare dans un dossier, et donne-le par SPRINTER_POLICES.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { trouverChrome, capturer, enTetePolices } from './chrome.mjs';
import { FOND, OR, BLANC, ENCRE, LUEUR, encre, or, unite, RETRAIT_VIRGULE }
  from '../src/game/palette-affiche.js';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/defi-ouvert/cartes');

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const SITE = 'sprinter-game.com';

/* ------------------------------------------------------------- les arguments */

function lireArgs(argv) {
  const a = { code: null, titre: null, nom: null, chrono: null, epreuve: null,
              nom_fichier: null, style: 'affiche' };
  for (let i = 0; i < argv.length; i++) {
    const v = () => String(argv[++i] || '');
    switch (argv[i]) {
      case '--code': a.code = v().toUpperCase().replace(/[^A-Z0-9]/g, ''); break;
      case '--titre': a.titre = v(); break;
      case '--nom': a.nom = v(); break;
      case '--chrono': a.chrono = v(); break;
      case '--epreuve': a.epreuve = v().replace(/\s*m$/i, ''); break;
      case '--fichier': a.nom_fichier = v(); break;
      case '--style': a.style = v().toLowerCase(); break;
      default:
        console.error(`Argument inconnu : ${argv[i]}`);
        process.exit(1);
    }
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));

if (args.style !== 'carte' && args.style !== 'affiche') {
  console.error(`Style inconnu : ${args.style}. Attendu « carte » ou « affiche ».`);
  process.exit(1);
}

if (!args.code) {
  console.error('Il faut un code : --code ZEZE42 (celui que le jeu te donne quand tu lances un defi).');
  process.exit(1);
}
if (!/^[A-Z0-9]{4,10}$/.test(args.code)) {
  console.error(`Code invalide : ${args.code}. Quatre a dix lettres ou chiffres.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ le defi */

/** « 8,64 » — un chrono a la francaise, deux decimales comme dans le jeu. */
const virgule = ms => (ms / 1000).toFixed(2).replace('.', ',');

/** Un chrono donne a la main, en millisecondes. Accepte 8,64 comme 8.64. */
function msDepuisTexte(t) {
  const n = Number(String(t).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Chrono illisible : ${t}. Attendu 8,64 ou 8.64.`);
    process.exit(1);
  }
  return Math.round(n * 1000);
}

/**
 * Ce que le serveur sait de ce defi.
 *
 * `attempts` est la liste de ceux qui l'ont releve, deja triee par chrono et
 * plafonnee a cinquante cote worker. On n'en tire que deux nombres : combien
 * ont essaye, combien ont fait mieux. Le detail nommerait des joueurs sur une
 * image publique, ce qu'aucun d'eux n'a demande.
 */
async function lireDefi(code) {
  const res = await fetch(`${API}/challenge?id=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`le serveur repond ${res.status}`);
  const d = await res.json();
  if (!d.found) throw new Error('ce code ne correspond a aucun defi');
  return d;
}

let defi = null;
// Tout donne a la main : on ne demande rien au reseau. C'est le mode « je
// prepare la carte dans le train ».
const horsLigne = !!(args.chrono && args.nom && args.epreuve);
if (!horsLigne) {
  try {
    defi = await lireDefi(args.code);
  } catch (e) {
    console.error(`Lecture du defi ${args.code} : ${e.message}`);
    console.error('Donne les valeurs a la main pour fabriquer quand meme la carte :');
    console.error(`  node tools/carte-defi-ouvert.mjs --code ${args.code} --chrono 8,64 --nom TONNOM --epreuve 100`);
    process.exit(1);
  }
}

const nom = args.nom || defi?.owner_name || 'ANONYME';
const epreuves = args.epreuve ? [args.epreuve] : (defi?.races || ['100']);
const totalMs = args.chrono ? msDepuisTexte(args.chrono) : defi.total_ms;
const essais = defi ? (defi.attempts || []).length : 0;
const battus = defi ? (defi.attempts || []).filter(a => a.total_ms < totalMs).length : 0;

const libelleEpreuve = epreuves.map(e => `${e} m`).join(' + ');

/**
 * La ligne qui pique, tiree de ce qui s'est passe et de rien d'autre.
 *
 * Trois etats, trois phrases. Aucune n'invente un chiffre : une carte qui
 * annonce « des centaines de joueurs » quand il y en a eu quatre se retourne
 * contre le compte le jour ou quelqu'un regarde le classement.
 */
function tally() {
  if (horsLigne) return { fort: 'Personne ne l’a encore relevé.', doux: 'Tu peux être le premier.' };
  if (!essais) return { fort: 'Personne n’a encore osé.', doux: 'Le premier qui tape le code court contre mon fantôme.' };
  if (!battus) {
    return {
      fort: essais === 1 ? '1 a essayé. Zéro a fait mieux.' : `${essais} ont essayé. Zéro a fait mieux.`,
      doux: 'Le chrono tient toujours.',
    };
  }
  return {
    fort: `${essais} ont essayé. ${battus} ${battus === 1 ? 'a' : 'ont'} fait mieux.`,
    doux: 'Ça se joue à quelques centièmes.',
  };
}
const bas = tally();
const titre = args.titre || `${virgule(totalMs)} s`;

/* ---------------------------------------------------------------- la maquette */

const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page({ w, h }) {
  const horizontal = w > h;
  // Tout respire un peu plus en vertical, et se resserre beaucoup sur le
  // format de X : 900 pixels de haut pour le meme contenu que 1350, c'est un
  // tiers de hauteur en moins et la carte deborde si l'on se contente de
  // reduire les polices.
  const k = horizontal ? 0.6 : (h > 1500 ? 1.12 : 1);
  // En vertical le billet pousse le reste aux deux bouts ; en horizontal il n'y
  // a pas de place a repartir, et `auto` sortait le bouton de l'image.
  const respire = horizontal ? `${Math.round(30 * k)}px` : 'auto';
  // La phrase longue tient sur trois lignes en vertical. En horizontal elle en
  // prendrait autant sur une carte deux fois moins haute : on la raccourcit.
  const sous = horizontal
    ? `le chrono de ${echappe(nom)}. Tu cours contre son fantôme, pas contre un nombre.`
    : `le chrono de ${echappe(nom)}. Tu ne cours pas contre un nombre :
       tu cours contre son fantôme, dans ton couloir, en même temps que lui.`;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  /* Le fond n'est pas un aplat : un halo bleu au centre detache la carte du
     fil, qui est blanc ou noir selon le telephone de celui qui la voit. */
  body{background:#070b16;
       background-image:radial-gradient(ellipse 88% 62% at 50% 46%,
                        #17213a 0%,#101728 46%,#070b16 100%);
       font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       justify-content:${horizontal ? 'center' : 'flex-start'};
       padding:${Math.round(110 * k)}px ${Math.round(78 * k)}px ${Math.round(92 * k)}px}
  .kicker{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:${Math.round(27 * k)}px;
          letter-spacing:.34em;color:#8494ad;text-transform:uppercase;
          margin-bottom:${Math.round(40 * k)}px}
  h1{font-size:${Math.round(150 * k)}px;font-weight:700;line-height:1;
     letter-spacing:-.02em;
     background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 48%,#ef7526 96%);
     -webkit-background-clip:text;background-clip:text;color:transparent;
     margin-bottom:${Math.round(20 * k)}px}
  .sous{font-size:${Math.round(35 * k)}px;color:#93a2ba;line-height:1.3;
        max-width:${Math.round(860 * k)}px}
  /* LE CODE EST LA RAISON D'ETRE DE LA CARTE. Sur Instagram et TikTok il n'y a
     pas de lien a suivre : ce bloc est le seul chemin vers le jeu, et il doit
     se lire d'un ecran de telephone tenu a bout de bras, dans un fil qui
     defile. D'ou la taille, le monospace, et l'espacement des lettres — un
     code se recopie caractere par caractere. */
  .billet{margin-top:${respire};margin-bottom:${respire};width:100%;
          border-top:1px solid #253049;border-bottom:1px solid #253049;
          padding:${Math.round(44 * k)}px 0 ${Math.round(48 * k)}px}
  .etiquette{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:${Math.round(26 * k)}px;
             letter-spacing:.34em;color:#7e8da6;text-transform:uppercase;
             margin-bottom:${Math.round(18 * k)}px}
  .code{font-family:Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
        font-size:${Math.round(128 * k)}px;letter-spacing:.1em;color:#eef2f8;
        line-height:1;text-indent:.1em}
  .ou{font-size:${Math.round(30 * k)}px;color:#7e8da6;margin-top:${Math.round(26 * k)}px}
  .fort{font-size:${Math.round(42 * k)}px;font-weight:700;color:#eef2f8;
        margin-bottom:${Math.round(14 * k)}px}
  .doux{font-size:${Math.round(34 * k)}px;color:#8d9cb4}
  /* Le lien n'est pas une ligne de texte mais un bouton : sur un fond bleu
     nuit, une url orange se lit comme une signature — on la survole du regard.
     C'est la derniere chose que l'oeil accroche avant de scroller. */
  .pied{margin-top:${Math.round(46 * k)}px;display:inline-block;
        background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 50%,#ef7526 96%);
        color:#0a1020;font-weight:700;font-size:${Math.round(36 * k)}px;
        padding:${Math.round(24 * k)}px ${Math.round(52 * k)}px;
        border-radius:999px;letter-spacing:.005em}
  </style>
  <div class="kicker">Défi ouvert · ${echappe(libelleEpreuve)}</div>
  <h1>${echappe(titre)}</h1>
  <div class="sous">${sous}</div>

  <div class="billet">
    <div class="etiquette">Code du défi</div>
    <div class="code">${echappe(args.code)}</div>
    <div class="ou">à taper dans le jeu, onglet DÉFI</div>
  </div>

  <div class="fort">${echappe(bas.fort)}</div>
  <div class="doux">${echappe(bas.doux)}</div>
  <div class="pied">${SITE}/?defi=${echappe(args.code)}</div>`;
}


/* ------------------------------------------- la maquette « affiche »

   Celle que le JEU dessine deja. Les proportions sont RECOPIEES de
   game/trace-affiche.js, pas approchees a l'oeil : marge a 8,2 % de la
   largeur, surtitre a 10,5 % de la hauteur et 36 % d'inter-lettrage, titre en
   Outfit 900 serre a -2,2 %, chrono en Space Mono 700 dore, pied a une marge
   et demie du bas. Une carte qui ressemble au jeu de loin et pas de pres est
   une carte qui dit que le compte et le jeu sont deux choses.

   Ce que l'affiche du jeu n'a pas et que celle-ci doit porter : le CODE. Il
   prend la zone basse, que l'affiche laisse a la trace de la course.
--------------------------------------------------------------------------- */

function pageAffiche({ w, h }) {
  const L = w, H = h;
  const marge = Math.round(L * 0.082);
  // L'unite de mesure vient de la palette, et pas d'une ligne recopiee : un
  // format large est trois fois moins haut que large, et une taille exprimee
  // en fraction de sa LARGEUR y devient enorme. `unite` le sait pour tout le
  // monde.
  const u = unite(L, H);
  // 0,08 * 100 ne fait pas 8 en virgule flottante. On arrondit avant d'ecrire
  // un pourcentage, sinon la feuille de style porte « 8.000000000000002% ».
  const pc = v => `${+(v * 100).toFixed(3)}%`;
  const T = t => Math.round(u * t);
  const hautY = Math.round(H * 0.105);
  const haut = hautY + Math.round(L * 0.055);
  // `basZone` et non `bas` : `bas` est deja le libelle du compteur, plus haut
  // dans ce fichier, et le masquer ici affichait « undefined » sur la carte.
  const basZone = H - marge * 2.1;
  const trait = Math.max(2, Math.round(L / 540));

  // Les trois traits en fuite du fond : ils posent le stade sans prendre
  // l'oeil au chiffre, qui est le sujet.
  const couloirs = [0, 1, 2].map(i => `<div class="couloir" style="top:${H * (0.62 + i * 0.11)}px"></div>`).join('');

  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${L}px;height:${H}px;overflow:hidden}
  body{position:relative;background:${FOND};
       font:500 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  /* La lueur doree du jeu : centree en haut, large comme la carte. */
  .lueur{position:absolute;inset:0;
         background:radial-gradient(circle ${Math.round(L * LUEUR.rayon)}px
                    at ${pc(LUEUR.x)} ${pc(LUEUR.y)},
                    ${or(LUEUR.alpha)} 0%,${or(0)} 100%)}
  .couloir{position:absolute;left:0;width:100%;height:${trait}px;opacity:.14;
           background:linear-gradient(90deg,${or(0)} 0%,
                      ${or(1)} 50%,${or(0)} 100%)}
  /* L'etiquette de provenance ne participe pas au centrage : elle tient sa
     place quoi qu'il arrive, exactement comme dans le jeu. */
  .surtitre{position:absolute;top:${hautY}px;left:0;width:100%;text-align:center;
            font-weight:700;font-size:${Math.round(L * 0.0205)}px;
            letter-spacing:.36em;text-indent:.36em;text-transform:uppercase;
            color:${encre(ENCRE.surtitre)}}
  /* La zone ou le sujet a le droit de vivre, et il s'y centre. */
  .pile{position:absolute;left:${marge}px;right:${marge}px;
        top:${haut}px;height:${Math.round(basZone - haut)}px;
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;text-align:center}
  h1{font-weight:900;font-size:${T(0.082)}px;line-height:${T(0.078)}px;
     letter-spacing:-.022em;color:${BLANC};text-transform:uppercase;
     margin-bottom:${T(0.03)}px}
  .chrono{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;
          font-weight:700;font-size:${T(0.20)}px;line-height:1;color:${OR}}
  /* LA VIRGULE NE PREND PAS UNE CHASSE ENTIERE. Space Mono est a chasse fixe :
     laissee telle quelle, elle fait lire « 8 , 64 » — deux nombres au lieu
     d'un. Le jeu lui donne deux cinquiemes de la chasse d'un chiffre
     (morceauxChrono, trace-affiche.js), et l'unite ch est exactement cette
     chasse-la : trois dixiemes retires de chaque cote en laissent quatre.
     Des marges negatives plutot qu'une fente etroite ou la centrer — la fente
     deplacait le trou au lieu de le boucher, la virgule allait se coller au
     chiffre suivant. */
  .virgule{display:inline-block;margin:0 -${RETRAIT_VIRGULE}ch}
  .qui{font-size:${T(0.034)}px;color:${encre(ENCRE.nom)};
       margin-top:${T(0.045)}px}
  .etat{font-weight:600;font-size:${T(0.030)}px;color:${or(0.85)};
        margin-top:${T(0.022)}px}
  /* LE CODE. L'affiche du jeu garde cette zone pour la trace de la course ;
     ici elle porte la seule chose qui ramene quelqu'un dans le jeu. */
  .billet{margin-top:${T(0.085)}px;padding-top:${T(0.055)}px;width:100%;
          border-top:1px solid ${encre(ENCRE.filet)}}
  .etiquette{font-weight:700;font-size:${T(0.022)}px;letter-spacing:.36em;
             text-indent:.36em;text-transform:uppercase;
             color:${encre(ENCRE.etiquette)};margin-bottom:${T(0.028)}px}
  .code{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;
        font-weight:700;font-size:${T(0.105)}px;line-height:1;color:${BLANC};
        letter-spacing:.12em;text-indent:.12em}
  .lien{font-size:${T(0.026)}px;color:${encre(ENCRE.lien)};
        margin-top:${T(0.030)}px}
  /* Le pied du jeu, au pixel : meme filet, meme graisse, meme inter-lettrage. */
  .filet{position:absolute;left:${marge}px;right:${marge}px;
         top:${Math.round(H - marge * 1.5)}px;height:1px;
         background:${encre(ENCRE.filet)}}
  .pied{position:absolute;left:${marge}px;right:${marge}px;
        top:${Math.round(H - marge * 0.92)}px;transform:translateY(-50%);
        display:flex;justify-content:space-between;
        font-weight:700;font-size:${Math.round(L * 0.0205)}px;
        letter-spacing:${(L * 0.006).toFixed(1)}px;text-transform:uppercase}
  .pied .g{color:${encre(ENCRE.pied)}}
  .pied .d{color:${encre(ENCRE.piedDroit)}}
  </style>
  <div class="lueur"></div>
  ${couloirs}
  <div class="surtitre">Sprinter · ${echappe(libelleEpreuve)}</div>

  <div class="pile">
    <h1>${echappe(args.titre || 'Défi ouvert')}</h1>
    <div class="chrono">${virgule(totalMs).replace(',', '<span class="virgule">,</span>')}</div>
    <div class="qui">${echappe(nom)} · ${echappe(libelleEpreuve)}</div>
    <div class="etat">${echappe(bas.fort)}</div>

    <div class="billet">
      <div class="etiquette">Code du défi</div>
      <div class="code">${echappe(args.code)}</div>
      <div class="lien">${SITE}/?defi=${echappe(args.code)}</div>
    </div>
  </div>

  <div class="filet"></div>
  <div class="pied"><span class="g">Sprinter</span><span class="d">Jeu de sprint</span></div>`;
}

/* ------------------------------------------------------------------- le rendu */

const chrome = trouverChrome();
fs.mkdirSync(SORTIE, { recursive: true });
const base = (args.nom_fichier || args.code).toLowerCase();

for (const f of [{ s: 'feed', w: 1080, h: 1350 },
                 { s: 'story', w: 1080, h: 1920 },
                 { s: 'x', w: 1600, h: 900 }]) {
  const chemin = path.join(SORTIE, `${base}-${args.style}-${f.s}.png`);
  try {
    const dessiner = args.style === 'affiche' ? pageAffiche : page;
    await capturer({ html: dessiner(f), w: f.w, h: f.h, sortie: chemin, chrome });
  } catch (e) {
    console.error(`Rendu ${f.s} : ${e.message}`);
    process.exit(1);
  }
  console.log(`  ${path.relative(RACINE, chemin)}`);
}

console.log(`
Défi ${args.code} — ${virgule(totalMs)} s sur ${libelleEpreuve}, par ${nom}.
${horsLigne ? 'Valeurs données à la main : le compteur d’essais n’a pas été lu.'
            : `${essais} tentative(s) enregistrée(s), ${battus} meilleure(s) que la tienne.`}

Le lien, pour X et pour la bio :  https://${SITE}/?defi=${args.code}
Le code, pour Instagram et TikTok :  ${args.code}
`);
