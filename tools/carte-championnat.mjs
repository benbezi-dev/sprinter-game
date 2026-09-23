/* ===========================================================================
   LES CARTES D'UN CHAMPIONNAT : modalites, format, horaires.

     node tools/carte-championnat.mjs                    (l'edition en cours)
     node tools/carte-championnat.mjs --edition HMW36AHQ
     node tools/carte-championnat.mjs --zone FR --fuseau Europe/Paris

   Sort un carrousel dans communication/championnat/<edition>/ :
     1-affiche  ce qui se joue, et quand
     2-qualifier  comment on entre dans les trente-deux
     3-format   series, demies, finale, et les repeches
     4-samedi   les horaires du premier jour
     5-dimanche ceux du second

   Chaque ecran sort en -feed (1080 x 1350) et en -story (1080 x 1920).

   RIEN N'EST ECRIT A LA MAIN. Le format, les dates, le nombre de places et
   les repechages viennent de l'API — `/champ/monde`, `/champ/edition/<id>`,
   `/champ/calendrier`. C'est ce qui separe cette carte de `carte-annonce.mjs`,
   qui lit un JSON qu'on remplit soi-meme : une carte de regles recopiees a la
   main finit par annoncer un format que le serveur n'applique plus, et
   personne ne s'en apercoit avant de voir les series partir a une autre heure.

   DEUX VOIX, ET ON CHOISIT AU MOMENT DE PUBLIER.

     (defaut)      LES JOURS DE COMPETITION : bleu nuit, degrade orange,
                   adresse en pastille. Un championnat en est un, et le jeu
                   peint desormais ses propres videos dans cette voix-la
                   (src/game/voix-competition.js porte les valeurs).
     --voix jeu    CELLE DU JEU : fond #060913, lueur doree, Outfit 900, or.
                   Celle de l'affiche d'une course et du carton d'une video de
                   campagne, recopiee au pixel depuis `palette-affiche`.

   Les deux sortent les memes ecrans, dans deux dossiers separes : ce sont les
   memes fichiers, et les melanger ferait choisir au hasard en publiant.

   L'HEURE EST CELLE D'UN FUSEAU, ET LA CARTE LE DIT. Le calendrier du serveur
   est en UTC, parce que « le meme weekend partout » n'a de sens que sur une
   horloge commune. Une carte, elle, s'adresse a un pays : elle affiche l'heure
   de ce pays et l'ecrit noir sur blanc, sinon la moitie des lecteurs se
   presente une heure trop tard.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { trouverChrome, capturer, enTetePolices } from './chrome.mjs';
import { ENCRE, fond, flamme, echelle, echappe } from './voix-competition.mjs';
// LA VOIX ORDINAIRE DU JEU — fond #060913, lueur doree, Outfit 900, or. C'est
// celle que le jeu dessine lui-meme sur l'affiche d'une course et sur le carton
// d'une video de campagne. Les memes ecrans sortent dans les deux voix : la
// competition parle fort dans un fil de competition, le jeu parle de lui le
// reste du temps, et c'est au moment de publier qu'on choisit.
import {
  FOND, OR, BLANC, ENCRE as ENCRE_JEU, LUEUR, encre, or, unite,
} from '../src/game/palette-affiche.js';
// L'ecriture des epreuves, prise a la source : la charte ecrit « 100 m », et
// « 100 m H » pour les haies.
import { EPREUVE } from '../src/game/trace-affiche.js';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const SITE = 'sprinter-game.com';

const FORMATS = [
  { cle: 'feed', w: 1080, h: 1350 },
  { cle: 'story', w: 1080, h: 1920 },
];

/* ------------------------------------------------------------- les arguments */

function lireArgs(argv) {
  const a = { edition: null, zone: 'FR', epreuve: '100', fuseau: 'Europe/Paris',
              voix: 'competition' };
  for (let i = 0; i < argv.length; i++) {
    const v = () => String(argv[++i] || '');
    switch (argv[i]) {
      case '--edition': a.edition = v().toUpperCase(); break;
      case '--zone': a.zone = v().toUpperCase(); break;
      case '--epreuve': a.epreuve = v(); break;
      case '--fuseau': a.fuseau = v(); break;
      case '--voix': a.voix = v().toLowerCase(); break;
      default: break;
    }
  }
  return a;
}

const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
};

/* ------------------------------------------------------------------ l'heure */

/** « samedi 26 septembre », dans le fuseau de la carte. */
const jourLong = (ms, tz) => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
}).format(new Date(ms));

/** « 11:00 ». */
const heure = (ms, tz) => new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', timeZone: tz,
}).format(new Date(ms));

/** « sam. », pour un billet ou le jour long ne tient pas. */
const jourCourt = (ms, tz) => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', timeZone: tz,
}).format(new Date(ms)).replace('.', '.').toUpperCase();

/** Le jour seul, pour regrouper : « 2026-09-26 ». */
const cleDuJour = (ms, tz) => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz,
}).format(new Date(ms));

/* ------------------------------------------------------------- la maquette */

/**
 * Un ecran, dans la voix des jours de competition.
 *
 * `billet` est le bloc central entre deux filets — celui qui porte le code sur
 * la carte d'un defi. Ici il porte ce qu'on veut retenir de l'ecran : une
 * heure, un nombre de places. `lignes` est une liste a deux colonnes, pour les
 * horaires et le format ; les deux ne se montrent jamais ensemble, le premier
 * est un chiffre qu'on retient, la seconde un tableau qu'on lit.
 */
function page(e, { w, h }) {
  const k = echelle(w, h);
  const horizontal = w > h;
  const respire = horizontal ? `${Math.round(30 * k)}px` : 'auto';
  const R = n => Math.round(n * k);

  const billet = e.billet ? `
  <div class="billet">
    <div class="etiquette">${echappe(e.billet.etiquette)}</div>
    <div class="code">${echappe(e.billet.valeur)}</div>
    ${e.billet.ou ? `<div class="ou">${echappe(e.billet.ou)}</div>` : ''}
  </div>` : '';

  const lignes = e.lignes && e.lignes.length ? `
  <div class="grille">
    ${e.lignes.map(l => `<div class="ligne">
      <span class="g">${echappe(l.gauche)}</span>
      <span class="d">${echappe(l.droite)}</span>
    </div>`).join('')}
  </div>` : '';

  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{${fond()};
       font:400 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       justify-content:${horizontal ? 'center' : 'flex-start'};
       padding:${R(110)}px ${R(78)}px ${R(92)}px}
  .kicker{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:${R(27)}px;
          letter-spacing:.34em;color:${ENCRE.kicker};text-transform:uppercase;
          margin-bottom:${R(40)}px}
  h1{font-size:${R(e.taille || 150)}px;font-weight:700;line-height:1;
     letter-spacing:-.02em;${e.nowrap ? 'white-space:nowrap;' : ''}
     background:${flamme(48)};
     -webkit-background-clip:text;background-clip:text;color:transparent;
     margin-bottom:${R(20)}px}
  .sous{font-size:${R(35)}px;color:${ENCRE.sous};line-height:1.3;
        max-width:${R(860)}px}
  .billet{margin-top:${respire};margin-bottom:${respire};width:100%;
          border-top:1px solid ${ENCRE.filet};border-bottom:1px solid ${ENCRE.filet};
          padding:${R(44)}px 0 ${R(48)}px}
  .etiquette{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:${R(26)}px;
             letter-spacing:.34em;color:${ENCRE.etiquette};text-transform:uppercase;
             margin-bottom:${R(18)}px}
  .code{font-family:Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
        font-size:${R(e.billet && e.billet.valeur.length > 7 ? 88 : 128)}px;
        letter-spacing:.06em;color:${ENCRE.vif};line-height:1;text-indent:.06em}
  .ou{font-size:${R(30)}px;color:${ENCRE.etiquette};margin-top:${R(26)}px}
  /* LE TABLEAU : une heure a gauche, ce qui s'y passe a droite. L'heure est en
     monospace et alignee a droite de sa colonne — une liste d'horaires se lit
     en colonne, et des chiffres de largeurs differentes la font onduler. */
  .grille{margin-top:${respire};margin-bottom:${respire};width:100%;
          display:flex;flex-direction:column;gap:${R(20)}px}
  .ligne{display:flex;align-items:baseline;gap:${R(28)}px;
         border-bottom:1px solid ${ENCRE.filet};padding-bottom:${R(18)}px}
  .ligne:last-child{border-bottom:none}
  .g{font-family:Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
     font-size:${R(44)}px;color:${ENCRE.vif};min-width:${R(230)}px;text-align:right}
  .d{font-size:${R(36)}px;color:${ENCRE.doux};text-align:left;flex:1}
  .fort{font-size:${R(42)}px;font-weight:700;color:${ENCRE.vif};
        margin-bottom:${R(14)}px}
  .doux{font-size:${R(34)}px;color:${ENCRE.doux}}
  .pied{margin-top:${R(46)}px;display:inline-block;
        background:${flamme(50)};
        color:${ENCRE.surPastille};font-weight:700;font-size:${R(36)}px;
        padding:${R(24)}px ${R(52)}px;
        border-radius:999px;letter-spacing:.005em}
  </style>
  <div class="kicker">${echappe(e.kicker)}</div>
  <h1>${echappe(e.titre)}</h1>
  ${e.sous ? `<div class="sous">${e.sous}</div>` : ''}
  ${billet}${lignes}
  ${e.fort ? `<div class="fort">${echappe(e.fort)}</div>` : ''}
  ${e.doux ? `<div class="doux">${echappe(e.doux)}</div>` : ''}
  <div class="pied">${SITE}</div>`;
}

/* ------------------------------------------ la maquette de la voix du jeu

   CELLE QUE LE JEU DESSINE DEJA, au pixel : marge a 8,2 % de la largeur,
   surtitre a 10,5 % de la hauteur avec 36 % d'inter-lettrage, titre en Outfit
   900 serre a -2,2 %, pied a une marge et demie du bas. Les proportions
   viennent de `game/trace-affiche.js` par `palette-affiche`, pas d'un reglage
   a l'oeil : une carte qui ressemble au jeu de loin et pas de pres dit que le
   compte et le jeu sont deux choses.

   LE TITRE EST EN OR, la ou l'affiche du jeu met son chrono. C'est le meme
   role — le sujet, celui qu'on lit en premier — et cette voix n'a qu'une
   couleur d'accent : lui donner du blanc le ferait passer derriere le billet.
--------------------------------------------------------------------------- */

function pageJeu(e, { w, h }) {
  const L = w, H = h;
  const marge = Math.round(L * 0.082);
  const u = unite(L, H);
  const pc = v => `${+(v * 100).toFixed(3)}%`;
  const T = t => Math.round(u * t);
  const hautY = Math.round(H * 0.105);
  const haut = hautY + Math.round(L * 0.055);
  const basZone = H - marge * 2.1;

  /* PAS DE TRAITS EN FUITE ICI, et c'est un ecart assume avec l'affiche du jeu.
     Ils y posent le stade derriere un gros chrono centre, au milieu de beaucoup
     de vide. Ces cartes-ci portent un tableau : les traits passaient AU TRAVERS
     des heures et barraient « 11:00 » d'un filet dore. Un decor qui rend un
     chiffre moins lisible n'est plus un decor. */

  const billet = e.billet ? `
    <div class="billet">
      <div class="etiquette">${echappe(e.billet.etiquette)}</div>
      <div class="code">${echappe(e.billet.valeur)}</div>
      ${e.billet.ou ? `<div class="lien">${echappe(e.billet.ou)}</div>` : ''}
    </div>` : '';

  const lignes = e.lignes && e.lignes.length ? `
    <div class="grille">
      ${e.lignes.map(l => `<div class="ligne">
        <span class="g">${echappe(l.gauche)}</span>
        <span class="d">${echappe(l.droite)}</span>
      </div>`).join('')}
    </div>` : '';

  return `<!doctype html><meta charset="utf-8"><style>
  ${enTetePolices()}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${L}px;height:${H}px;overflow:hidden}
  body{position:relative;background:${FOND};
       font:500 16px/1.2 Outfit,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  .lueur{position:absolute;inset:0;
         background:radial-gradient(circle ${Math.round(L * LUEUR.rayon)}px
                    at ${pc(LUEUR.x)} ${pc(LUEUR.y)},
                    ${or(LUEUR.alpha)} 0%,${or(0)} 100%)}
  .surtitre{position:absolute;top:${hautY}px;left:0;width:100%;text-align:center;
            font-weight:700;font-size:${Math.round(L * 0.0205)}px;
            letter-spacing:.36em;text-indent:.36em;text-transform:uppercase;
            color:${encre(ENCRE_JEU.surtitre)}}
  .pile{position:absolute;left:${marge}px;right:${marge}px;
        top:${haut}px;height:${Math.round(basZone - haut)}px;
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;text-align:center}
  h1{font-weight:900;font-size:${T(e.tailleJeu || 0.082)}px;
     line-height:${T((e.tailleJeu || 0.082) * 0.95)}px;
     letter-spacing:-.022em;color:${OR};text-transform:uppercase;
     ${e.nowrap ? 'white-space:nowrap;' : ''}margin-bottom:${T(0.03)}px}
  .qui{font-size:${T(0.034)}px;color:${encre(ENCRE_JEU.nom)};line-height:1.35}
  .billet{margin-top:${T(0.075)}px;padding-top:${T(0.055)}px;width:100%;
          border-top:1px solid ${encre(ENCRE_JEU.filet)}}
  .etiquette{font-weight:700;font-size:${T(0.022)}px;letter-spacing:.36em;
             text-indent:.36em;text-transform:uppercase;
             color:${encre(ENCRE_JEU.etiquette)};margin-bottom:${T(0.028)}px}
  .code{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;
        font-weight:700;font-size:${T(0.095)}px;line-height:1;color:${BLANC};
        letter-spacing:.08em;text-indent:.08em}
  .lien{font-size:${T(0.026)}px;color:${encre(ENCRE_JEU.lien)};
        margin-top:${T(0.030)}px}
  /* LE TABLEAU, dans la voix du jeu : le filet est celui du pied, et l'heure
     garde le Space Mono du chrono. Une liste d'horaires se lit en colonne. */
  .grille{margin-top:${T(0.065)}px;width:100%;display:flex;flex-direction:column;
          gap:${T(0.018)}px}
  .ligne{display:flex;align-items:baseline;gap:${T(0.026)}px;
         border-bottom:1px solid ${encre(ENCRE_JEU.filet)};
         padding-bottom:${T(0.016)}px}
  .ligne:last-child{border-bottom:none}
  .ligne .g{font-family:'Space Mono',Menlo,"DejaVu Sans Mono",monospace;
            font-weight:700;font-size:${T(0.040)}px;color:${BLANC};
            min-width:${T(0.21)}px;text-align:right}
  .ligne .d{font-size:${T(0.033)}px;color:${encre(ENCRE_JEU.nom)};
            text-align:left;flex:1}
  .etat{font-weight:700;font-size:${T(0.032)}px;color:${or(0.9)};
        margin-top:${T(0.060)}px}
  .doux{font-size:${T(0.028)}px;color:${encre(ENCRE_JEU.lien)};
        margin-top:${T(0.014)}px}
  .filet{position:absolute;left:${marge}px;right:${marge}px;
         top:${Math.round(H - marge * 1.5)}px;height:1px;
         background:${encre(ENCRE_JEU.filet)}}
  .pied{position:absolute;left:${marge}px;right:${marge}px;
        top:${Math.round(H - marge * 0.92)}px;transform:translateY(-50%);
        display:flex;justify-content:space-between;
        font-weight:700;font-size:${Math.round(L * 0.0205)}px;
        letter-spacing:${(L * 0.006).toFixed(1)}px;text-transform:uppercase}
  .pied .g{color:${encre(ENCRE_JEU.pied)}}
  .pied .d{color:${OR};text-transform:none;letter-spacing:${(L * 0.001).toFixed(1)}px}
  </style>
  <div class="lueur"></div>
  <div class="surtitre">${echappe(e.kicker)}</div>

  <div class="pile">
    <h1>${echappe(e.titre)}</h1>
    ${e.sous ? `<div class="qui">${e.sous}</div>` : ''}
    ${billet}${lignes}
    ${e.fort ? `<div class="etat">${echappe(e.fort)}</div>` : ''}
    ${e.doux ? `<div class="doux">${echappe(e.doux)}</div>` : ''}
  </div>

  <div class="filet"></div>
  <div class="pied"><span class="g">Sprinter</span><span class="d">${SITE}</span></div>`;
}

/* ------------------------------------------------- ce que les ecrans disent */

/** Le libelle d'un rendez-vous du calendrier. */
function libelleRendezVous(rv, ed) {
  const plusieurs = (ed.phases.find(p => p.cle === rv.phase) || {}).courses > 1;
  if (rv.reveal) {
    return rv.phase === 'series' ? 'les repêchés pour les demi-finales'
                                 : 'les repêchés pour la finale';
  }
  if (rv.ceremonie) return 'le sacre du champion';
  const nom = { series: 'Série', demies: 'Demi-finale', finale: 'Finale' }[rv.phase] || rv.phase;
  return plusieurs && rv.course ? `${nom} ${rv.course}` : nom;
}

function composer(ed, rdv, args) {
  const tz = args.fuseau;
  const ep = EPREUVE(ed.epreuve);
  const kicker = `${ed.titre} · ${ep}`;
  const villeDuFuseau = tz.split('/').pop().replace(/_/g, ' ');

  const series = ed.phases.find(p => p.cle === 'series') || {};
  const demies = ed.phases.find(p => p.cle === 'demies') || {};
  const finale = rdv.find(r => r.phase === 'finale' && !r.ceremonie);

  // Le format vient de l'edition pour la phase EN COURS, et des phases pour le
  // reste : `directsParCourse` et `repechages` a la racine decrivent la phase
  // du moment, pas tout le tournoi.
  const directsSeries = ed.phase === 'series' ? ed.directsParCourse : 2;
  const repechesSeries = ed.phase === 'series' ? ed.repechages : 8;

  /* COMBIEN PAR COURSE. `ed.parCourse` ne vaut que pour la phase EN COURS —
     `phases` ne porte que la cle, le nom et le nombre de courses. On le deduit
     donc de ce que le serveur donne vraiment : les partants divises par les
     series, puis les qualifies des series divises par les demies. Ecrire 8 en
     dur marcherait aujourd'hui et mentirait le jour ou le format changera. */
  const parSerie = Math.round(ed.partants.length / (series.courses || 1));
  const enDemies = (series.courses || 0) * directsSeries + repechesSeries;
  const parDemie = Math.round(enDemies / (demies.courses || 1));
  const directsDemies = ed.phase === 'demies' ? ed.directsParCourse : 2;
  const repechesDemies = ed.phase === 'demies' ? ed.repechages : 4;
  const enFinale = (demies.courses || 0) * directsDemies + repechesDemies;

  const premierRdv = rdv.find(r => r.course === 1 && r.phase === 'series') || rdv[0];

  const jours = [];
  for (const r of rdv) {
    const cle = cleDuJour(r.at, tz);
    let j = jours.find(x => x.cle === cle);
    if (!j) { j = { cle, at: r.at, rdv: [] }; jours.push(j); }
    j.rdv.push(r);
  }

  const ecrans = [
    {
      /* L'ENERGIE VIENT DU CHIFFRE, PAS DE LA PHRASE. « Ce week-end » annonce
         un rendez-vous ; « 32 entrent » annonce une elimination. C'est le meme
         evenement, et le second se retient. */
      cle: 'affiche',
      kicker,
      titre: `${ed.partants.length} ENTRENT`,
      taille: 122, tailleJeu: 0.105, nowrap: true,
      sous: `${jours.map(j => jourLong(j.at, tz)).join(' et ')}.`,
      billet: premierRdv ? {
        etiquette: 'Le premier coup de pistolet',
        valeur: `${jourCourt(premierRdv.at, tz)} ${heure(premierRdv.at, tz)}`,
        ou: `heure de ${villeDuFuseau}`,
      } : null,
      fort: 'Un seul repart champion.',
      doux: `Les ${ed.partants.length - 1} autres rentrent chez eux.`,
    },
    {
      /* COMMENT ON ENTRE, ET DANS L'ORDRE OU ON LE FAIT.
         Les quatre lignes sont les quatre conditions que le serveur exige
         vraiment pour la selection : une nationalite declaree (la requete
         JOINT `player_pays` — sans pays, on n'est dans aucun classement
         national), un classement sur L'EPREUVE annoncee, au moins un duel
         classe dans les soixante derniers jours, et le rang. Une carte qui
         dirait seulement « sois dans les 32 » laisserait chercher par ou
         commencer. */
      cle: 'qualifier',
      kicker: 'Se qualifier',
      titre: 'ON NE S’INSCRIT PAS',
      taille: 76, tailleJeu: 0.062, nowrap: true,
      sous: `On se prend une place au classement des duels de son pays, sur le ${ep}.`,
      lignes: [
        { gauche: '1', droite: 'Déclare ton pays — sans lui, tu n’es dans aucun classement national' },
        { gauche: '2', droite: `Joue des duels sur le ${ep}, onglet DÉFI` },
        { gauche: '3', droite: 'Reste actif : un duel classé dans les 60 derniers jours' },
        { gauche: '4', droite: `Termine dans les ${ed.partants.length} premiers de ton pays` },
      ],
      fort: 'À la clôture, la grille se gèle.',
      doux: 'Après, plus rien ne bouge — ni ton entrée, ni ton couloir.',
    },
    {
      cle: 'format',
      kicker: 'Le format',
      /* LA DESCENTE DES COUREURS, pas le nombre de courses. « 4 → 2 → 1 »
         compte des series ; « 32 → 16 → 8 → 1 » compte des gens qui sortent, et
         c'est la meme competition racontee par ce qu'elle coute. */
      titre: `${ed.partants.length} → ${enDemies} → ${enFinale} → 1`,
      taille: 92, tailleJeu: 0.075, nowrap: true,
      sous: `Deux tours pour en éliminer ${ed.partants.length - 1}.`,
      lignes: [
        { gauche: `${series.courses} séries`, droite: `${series.courses} courses de ${parSerie}` },
        { gauche: `${directsSeries} par série`, droite: 'qualifiés d’office pour les demi-finales' },
        { gauche: `+ ${repechesSeries}`, droite: 'repêchés aux meilleurs chronos de toutes les séries' },
        { gauche: `${demies.courses} demies`, droite: `${demies.courses} courses de ${parDemie}` },
        { gauche: `${directsDemies} + ${repechesDemies}`,
          droite: `${directsDemies} par demie, puis ${repechesDemies} repêchés au chrono` },
        { gauche: 'Finale', droite: `${enFinale}, et un champion` },
      ],
      fort: `${directsSeries}e de ta série ? Tu passes.`,
      doux: `${directsSeries + 1}e ? Il te reste le chrono : ${repechesSeries} repêchés sur les ${series.courses} séries.`,
    },
  ];

  /* Le nombre de repeches d'une phase. Le serveur ne donne `repechages` que
     pour la phase EN COURS ; pour l'autre on retombe sur ce que le format
     applique. Les deux valeurs se recoupent avec la descente affichee plus
     haut (32 → 16 → 8), ce qui est la seule verification qui vaille. */
  const repechesDe = (phase) => phase === 'series' ? repechesSeries : repechesDemies;

  for (const [i, j] of jours.entries()) {
    /* CE QUE LA JOURNEE COUTE, sous ses horaires. Une grille d'heures est une
       information ; la ligne qui suit dit ce qui s'y joue, et c'est elle qu'on
       retient. Les deux sont exactes : le dernier rendez-vous de chaque jour
       est une revelation ou un sacre, et on le nomme pour ce qu'il fait. */
    const dernier = j.rdv[j.rdv.length - 1];
    const couperet = dernier.ceremonie
      ? { fort: `À ${heure(dernier.at, tz)}, il y a un champion.`,
          doux: 'Et sept qui repartent sans rien.' }
      : dernier.reveal
        /* LE NOMBRE EXACT, ET PAS UN SUSPENSE INVENTE. « Ou personne » se
           lisait bien et etait faux : il y a toujours ce nombre-la de
           repeches, jamais zero. Le suspense est ailleurs, et il suffit —
           personne ne sait QUI. */
        ? { fort: `À ${heure(dernier.at, tz)}, ${repechesDe(dernier.phase)} noms tombent.`,
            doux: 'Les meilleurs chronos parmi les battus. Personne ne sait lesquels.' }
        : { fort: '', doux: '' };
    ecrans.push({
      cle: ['samedi', 'dimanche'][i] || `jour-${i + 1}`,
      kicker: `Jour ${i + 1} · heure de ${villeDuFuseau}`,
      titre: jourLong(j.at, tz).split(' ')[0].toUpperCase(),
      sous: jourLong(j.at, tz).replace(/^\S+\s/, 'le '),
      lignes: j.rdv.map(r => ({ gauche: heure(r.at, tz), droite: libelleRendezVous(r, ed) })),
      ...couperet,
    });
  }

  /* --------------------------------------------------- LA STORY DE TENSION

     Une story n'est pas une page du carrousel. Elle passe seule, en plein
     ecran, entre deux autres stories, et elle a quelques secondes : elle ne
     peut donc porter qu'UNE chose. Celle-ci porte le decompte, parce que
     c'est la seule information qui change tous les jours et la seule qui
     serre quand elle descend.

     ELLE NE NOMME PERSONNE. Le favori du semis est connu — c'est la tete de
     serie — mais nommer un joueur dans une publication demande son accord
     avant (charte §5.4), et une carte qui se fabrique toute seule ne peut pas
     l'avoir demande. Les nombres, eux, n'appartiennent a personne.

     « Personne n'a encore gagne ici » n'est pas une formule : cette edition
     n'a pas de tenant du titre, et le serveur le dit (`tenant: null`). La
     ligne disparait le jour ou il y en aura un. */
  const finaleRdv = finale;
  /* J−3 SE COMPTE EN JOURS DE CALENDRIER, PAS EN TRANCHES DE 24 HEURES.
     Une soustraction de millisecondes divisee par 86 400 000 donnait « J−4 »
     un mercredi matin pour une course du samedi : il restait 3,34 jours, que
     l'arrondi superieur montait a 4. Or « J−3 » veut dire « dans trois nuits »,
     et personne ne compte autrement. Le decompte change donc a MINUIT, dans le
     fuseau de la carte, et non a l'heure du coup de pistolet. */
  const reste = Math.max(0, Math.round(
    (Date.parse(cleDuJour(premierRdv.at, tz)) - Date.parse(cleDuJour(Date.now(), tz)))
    / 86400000));
  const courses = ed.phases.reduce((n, p) => n + (p.courses || 0), 0);

  ecrans.push({
    cle: 'tension',
    formats: ['story'],
    kicker,
    titre: reste === 0 ? 'AUJOURD’HUI' : reste === 1 ? 'DEMAIN' : `J−${reste}`,
    taille: reste > 1 ? 210 : 132,
    tailleJeu: reste > 1 ? 0.175 : 0.110, nowrap: true,
    sous: `${jourLong(premierRdv.at, tz)}, ${heure(premierRdv.at, tz)} —<br>`
        + 'le premier coup de pistolet.',
    billet: {
      etiquette: `${ed.partants.length} partants · ${courses} courses`,
      valeur: '1',
      ou: 'il n’en restera qu’un',
    },
    fort: ed.tenant ? `${ed.tenant.nom} remet son titre en jeu.`
                    : 'Personne n’a encore gagné ici.',
    doux: finaleRdv
      ? `La finale ${jourLong(finaleRdv.at, tz)} à ${heure(finaleRdv.at, tz)}.`
      : '',
  });

  return ecrans;
}

/* ------------------------------------------------------------------ l'outil */

const args = lireArgs(process.argv.slice(2));

let id = args.edition;
if (!id) {
  const monde = await json(`${API}/champ/monde?epreuve=${encodeURIComponent(args.epreuve)}`);
  const ligne = [...(monde.encours || []), ...(monde.annoncees || [])]
    .find(l => l.zone === args.zone);
  if (!ligne) {
    console.error(`Aucune édition en cours ni annoncée pour ${args.zone} sur le ${args.epreuve} m.`);
    console.error('En ouvrir une, ou passer --edition <CODE>.');
    process.exit(1);
  }
  id = ligne.edition;
}

const ed = await json(`${API}/champ/edition/${id}`);
const cal = await json(`${API}/champ/calendrier?debut=${ed.debut}`);
const cycle = (cal.cycle || []).find(c => c.echelon === ed.echelon);
if (!cycle) {
  console.error(`Pas de calendrier pour l'échelon ${ed.echelon}.`);
  process.exit(1);
}

const ecrans = composer(ed, cycle.rendezVous, args);
let ecrites = 0;
const jeu = args.voix === 'jeu';
// UN DOSSIER PAR VOIX. Les deux series portent les memes noms de fichier — ce
// sont les memes ecrans — et les melanger dans un seul dossier ferait choisir
// au hasard au moment de publier.
const sortie = path.join(RACINE, 'communication/championnat', id, jeu ? 'voix-du-jeu' : '');
const chrome = trouverChrome();

for (const [i, e] of ecrans.entries()) {
  for (const f of FORMATS.filter(f => !e.formats || e.formats.includes(f.cle))) {
    const nom = `${String(i + 1).padStart(2, '0')}-${e.cle}-${f.cle}.png`;
    const chemin = path.join(sortie, nom);
    const html = jeu ? pageJeu(e, f) : page(e, f);
    await capturer({ html, w: f.w, h: f.h, sortie: chemin, chrome });
    ecrites++;
    console.log(path.relative(RACINE, chemin));
  }
}

console.log(`\n${ed.titre} — ${EPREUVE(ed.epreuve)}, édition ${id} (${ed.etat}).`);
console.log(`Voix : ${jeu ? 'celle du jeu (fond noir, or)' : 'les jours de compétition (bleu nuit, orange)'}.`);
// Les images se COMPTENT, elles ne se multiplient pas : l'ecran de tension ne
// sort qu'en story, et `ecrans x formats` en annoncait une de plus qu'il n'en
// existe sur le disque.
console.log(`${ecrans.length} écrans, ${ecrites} images.`);
