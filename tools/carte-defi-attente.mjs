/* ===========================================================================
   LES CARTES DU DEFI DE LA DEMI — de quoi faire venir du monde entre les
   courses du dimanche (27/09).

     node tools/carte-defi-attente.mjs
     node tools/carte-defi-attente.mjs --dimanche 2026-09-27 --fuseau Europe/Paris

   Trois cartes, une par fenetre du defi (voir src/game/defi-demie.ts), chacune
   en -feed (1080 x 1350) et en -story (1080 x 1920) :

     1-demie-1   en attendant la demi-finale 2 : on court la demie 1
     2-demie-2   la demie 2 courue, avant les finalistes : on court la demie 2
     3-finale    en attendant la finale : la finale avant la finale

   Elles sortent dans communication/championnat/HMW36AHQ/defi/, avec les
   legendes a coller (legendes.md, ecrites a la main : c'est de la voix, pas des
   donnees).

   CE QUI N'EST PAS ECRIT A LA MAIN : LES HEURES. Elles viennent du calendrier
   du serveur (worker/src/championnats-config.js) et s'affichent dans le fuseau
   de la carte, qui le dit — la meme regle que carte-championnat.mjs. Une carte
   qui annonce « jusqu'a 15:29 » alors que la demie part a 15:30 se trompe
   d'une heure pour la moitie des lecteurs si elle ne dit pas de quel pays.

   PAS DE NOMS, ET C'EST VOULU. La carte se poste pendant que les chronos
   tombent ; un nom ou un temps ecrit dessus serait perime au post suivant. Le
   jeu, lui, les lit en direct. La piste en image est une vraie prise du defi
   (piste/), camera du jeu, sans interface par-dessus.

   LA VOIX EST CELLE DES JOURS DE COMPETITION (voix-competition.mjs) : un
   championnat en est un, et ces cartes passent dans le meme fil que ses
   horaires.

   Sans reseau, SPRINTER_POLICES designe un dossier de woff2 et son CSS (voir
   chrome.mjs).
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { trouverChrome, capturer, enTetePolices } from './chrome.mjs';
import { ENCRE, fond, flamme, echelle, echappe } from './voix-competition.mjs';
import { CALENDRIER } from '../worker/src/championnats-config.js';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const DOSSIER = path.join(RACINE, 'communication/championnat/HMW36AHQ/defi');
const SITE = 'sprinter-game.com';

const FORMATS = [
  { cle: 'feed', w: 1080, h: 1350 },
  { cle: 'story', w: 1080, h: 1920 },
];

function lireArgs(argv) {
  const a = { dimanche: null, fuseau: 'Europe/Paris' };
  for (let i = 0; i < argv.length; i++) {
    const v = () => String(argv[++i] || '');
    if (argv[i] === '--dimanche') a.dimanche = v();
    else if (argv[i] === '--fuseau') a.fuseau = v();
  }
  return a;
}

/** Le dimanche du championnat, a minuit UTC : celui qu'on donne, ou le prochain (aujourd'hui compris). */
function dimancheUTC(iso) {
  if (iso) return Date.parse(iso + 'T00:00:00Z');
  const d = new Date();
  const minuit = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return minuit + ((7 - d.getUTCDay()) % 7) * 86400e3;
}

/** L'heure d'un rendez-vous du dimanche, dans le fuseau de la carte. */
function heure(dimanche, cle, fuseau, decalageMin = 0) {
  const rv = CALENDRIER.jour2.find(r => r.cle === cle);
  if (!rv) throw new Error(`rendez-vous inconnu : ${cle}`);
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: fuseau })
    .format(new Date(dimanche + (rv.minute + decalageMin) * 60e3));
}

/** « heure de Paris » : le fuseau dit a qui la carte parle. */
const ville = fuseau => (fuseau.split('/')[1] || fuseau).replace(/_/g, ' ');

/* ------------------------------------------------------------- la maquette */

/**
 * Un mot a trait d'union ne se coupe pas sur son trait : « demi- / finalistes »
 * en bout de ligne se lit comme deux mots.
 */
const insecable = s => echappe(s).replace(/(\S+-\S+)/g, '<span class="nw">$1</span>');

/**
 * Un ecran : surtitre, titre en flamme, une phrase, LA PISTE EN GRAND, la
 * question, l'echeance, l'adresse en pastille.
 *
 * La piste tient toute la largeur, fondue dans la nuit en haut et en bas :
 * cadree comme une vignette, elle se lisait comme une capture d'ecran collee
 * sur une affiche ; bord a bord, elle devient le decor de la question.
 */
function page(c, { w, h }) {
  const k = echelle(w, h);
  const R = n => Math.round(n * k);
  const story = h > 1500;
  // LA STORY A DES MARGES QU'ON NE VOIT PAS : Instagram pose son en-tete sur
  // les deux cents premiers pixels et sa barre de reponse sur les deux cent
  // cinquante derniers. L'adresse doit tenir au-dessus.
  const bande = story ? 700 : 560;
  // Plus etroite que le fil, la story rognerait la tour sur le cote : moins de
  // zoom, et le foyer qui la garde dans le cadre.
  const zoom = story ? 1 + ((c.zoom || 1) - 1) * 0.4 : (c.zoom || 1);
  const foyer = story ? (c.foyerStory || c.foyer) : c.foyer;
  const img = 'file://' + path.join(DOSSIER, 'piste', c.image);
  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{${fond()};
       font:400 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       padding:${story ? 230 : R(84)}px 0 ${story ? 300 : R(78)}px}
  .col{padding:0 ${R(70)}px;display:flex;flex-direction:column;align-items:center;width:100%}
  .kicker{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;font-size:25px;
          letter-spacing:${story ? '.24em' : '.3em'};text-indent:${story ? '.24em' : '.3em'};
          white-space:nowrap;color:${ENCRE.kicker};text-transform:uppercase;
          margin-bottom:${R(30)}px}
  h1{font-size:${R(c.taille)}px;font-weight:900;line-height:.98;letter-spacing:-.02em;
     background:${flamme(48)};-webkit-background-clip:text;background-clip:text;color:transparent;
     margin-bottom:${R(24)}px;max-width:${R(960)}px}
  .sous{font-size:${R(33)}px;color:${ENCRE.sous};line-height:1.32;max-width:${R(900)}px}
  .piste{position:relative;width:100%;height:${bande}px;margin:${R(story ? 56 : 40)}px 0 ${R(story ? 50 : 36)}px;
         -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 84%,transparent 100%);
         mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 84%,transparent 100%)}
  /* LE ZOOM porte la piste vers ce qui compte — les blocs, la tour — : a
     pleine largeur, les huit coureurs tenaient dans un timbre-poste. */
  .piste img{width:100%;height:100%;object-fit:cover;object-position:${c.cadre};
             transform:scale(${zoom});transform-origin:${foyer || '50% 50%'}}
  .nw{white-space:nowrap}
  .fort{font-size:${R(50)}px;font-weight:900;color:${ENCRE.vif};letter-spacing:-.01em;
        margin-bottom:${R(14)}px}
  .doux{font-size:${R(29)}px;color:${ENCRE.doux};line-height:1.35;max-width:${R(900)}px;
        margin-bottom:${R(30)}px}
  .pied{margin-top:auto;display:inline-block;flex:none;background:${flamme(50)};
        color:${ENCRE.surPastille};font-weight:700;font-size:${R(38)}px;
        padding:${R(24)}px ${R(56)}px;border-radius:999px}
  </style>
  <div class="col">
    <div class="kicker">${echappe(c.kicker)}</div>
    <h1>${echappe(c.titre)}</h1>
    <div class="sous">${insecable(c.sous)}</div>
  </div>
  <div class="piste"><img src="${img}"></div>
  <div class="col">
    <div class="fort">${echappe(c.fort)}</div>
    <div class="doux">${insecable(c.doux)}</div>
  </div>
  <div class="pied">${SITE}</div>`;
}

/* ---------------------------------------------------------------- les cartes */

function cartes(dimanche, fuseau) {
  const H = (cle, d = 0) => heure(dimanche, cle, fuseau, d);
  const ou = `heure de ${ville(fuseau)}`;
  return [
    {
      nom: '1-demie-1', image: 'blocs.png', cadre: '50% 30%', taille: 128,
      zoom: 1.55, foyer: '62% 48%', foyerStory: '70% 45%',
      kicker: `En attendant la demi-finale 2 · ${H('demie-2')}`,
      titre: 'À toi de courir',
      sous: 'La demi-finale 1 du Championnat de France vient de se courir. '
          + 'Prends les blocs, face aux vrais chronos de ses huit coureurs.',
      fort: 'Où aurais-tu fini ?',
      // Le defi ferme une minute avant la demie qu'il fait attendre.
      doux: `Jusqu'à ${H('demie-2', -1)}, ${ou} · gratuit, dans ton navigateur`,
    },
    {
      nom: '2-demie-2', image: 'course.png', cadre: '50% 34%', taille: 128,
      zoom: 1.5, foyer: '42% 40%',
      kicker: `En attendant les finalistes · ${H('reveal-finale')}`,
      titre: 'À ton tour',
      sous: 'La demi-finale 2 vient de se courir. '
          + 'Cours-la contre ses vrais chronos : il fallait finir dans les deux premiers.',
      fort: 'Passais-tu en finale ?',
      doux: `Jusqu'à ${H('reveal-finale')}, ${ou} — puis la finale avant la finale`,
    },
    {
      nom: '3-finale', image: 'blocs.png', cadre: '50% 30%', taille: 112,
      zoom: 1.55, foyer: '62% 48%', foyerStory: '70% 45%',
      kicker: `En attendant la finale · ${H('finale')}`,
      titre: 'La finale avant la finale',
      sous: 'Les huit finalistes du Championnat de France courent leur chrono '
          + 'de demi-finale. Toi, tu cours contre eux.',
      fort: 'Monteras-tu sur le podium ?',
      doux: `Jusqu'à ${H('finale', -1)}, ${ou} · gratuit, dans ton navigateur`,
    },
  ];
}

/* ------------------------------------------------------------------- l'envoi */

const a = lireArgs(process.argv.slice(2));
const dimanche = dimancheUTC(a.dimanche);
const chrome = trouverChrome();
fs.mkdirSync(DOSSIER, { recursive: true });
for (const c of cartes(dimanche, a.fuseau)) {
  for (const f of FORMATS) {
    const sortie = path.join(DOSSIER, `${c.nom}-${f.cle}.png`);
    await capturer({ html: page(c, f), w: f.w, h: f.h, sortie, chrome });
    console.log(path.relative(RACINE, sortie));
  }
}
console.log(`\nDimanche ${new Date(dimanche).toISOString().slice(0, 10)}, ${a.fuseau}.`);
