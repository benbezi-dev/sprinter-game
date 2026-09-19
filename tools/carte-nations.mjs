/* ===========================================================================
   LA CARTE DES NATIONS — le rendez-vous du lundi
   ---------------------------------------------------------------------------
   Un post unique, toujours le meme format, toujours la meme heure : le
   classement des nations de la semaine. C'est le « format de rente » du plan
   de lancement (mecanique n° 2, la guerre des drapeaux) — il ne coute rien a
   produire, il se lit en une seconde, et il fabrique une dispute recurrente
   que la communaute entretient a votre place.

   CE QU'ELLE MONTRE, ET POURQUOI CE N'EST PAS UN RECORD. La mediane des
   cinquante meilleurs de chaque pays. Un classement au record se decide a une
   personne pres : un seul joueur rapide place son pays premier, et la carte
   raconte l'histoire d'un individu sous un drapeau. La mediane raconte la
   PROFONDEUR — et c'est ce qui en fait un sujet collectif, donc un sujet de
   dispute. Le detail du calcul est explique cote serveur, dans
   `worker/src/nations.js`.

   LE MOUVEMENT EST LA NOUVELLE. « La France est 7e » ne se poste qu'une fois ;
   « la France passe 7e, +2 » se poste chaque semaine. Les fleches viennent du
   serveur, qui fige le tableau chaque lundi.

   AUCUN NOM DE JOUEUR N'Y FIGURE PAR DEFAUT, et c'est une regle, pas un oubli.
   La charte interdit de publier le pseudonyme de quelqu'un sans son accord,
   capture de classement comprise (§5.4) — c'est l'erreur n° 5 du plan. Le
   levier « nommez le joueur qui a le plus fait gagner son pays » existe, mais
   il passe par `--joueur`, qu'il faut taper a la main : le moment ou l'on tape
   un nom est le moment ou l'on confirme l'avoir demande. La route `/nations`
   n'en renvoie aucun, ce qui rend l'oubli impossible.

   LA VOIX EST CELLE DES JOURS DE COMPETITION — bleu nuit, degrade orange,
   pastille — et pas celle du jeu. Un classement de nations EST une
   competition ; c'est le tableau le plus proche d'un championnat que le compte
   publie. Les valeurs viennent de `tools/voix-competition.mjs`, partage avec
   la carte du defi ouvert.

     node tools/carte-nations.mjs
     node tools/carte-nations.mjs --moi FR
     node tools/carte-nations.mjs --moi FR --joueur "KENZA"      (accord obtenu)
     node tools/carte-nations.mjs --epreuve 200 --lignes 10
     node tools/carte-nations.mjs --api http://127.0.0.1:8788    (worker local)

   Sort trois PNG dans communication/nations/ :
     nations-<epreuve>-feed.png    1080x1350  Instagram, fil
     nations-<epreuve>-story.png   1080x1920  story, Reels, TikTok
     nations-<epreuve>-x.png       1600x900   X
   =========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trouverChrome, capturer } from './chrome.mjs';
import {
  ENCRE, FLAMME, FORMATS, drapeau, echappe, echelle, flamme, fond,
} from './voix-competition.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/nations');
const SITE = 'sprinter-game.com';

function lireArgs(argv) {
  const a = { epreuve: '100', moi: null, joueur: null, lignes: 8, titre: null,
              api: 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev' };
  for (let i = 0; i < argv.length; i++) {
    const v = () => String(argv[++i] || '');
    switch (argv[i]) {
      case '--epreuve': a.epreuve = v().replace(/\s*m$/i, ''); break;
      case '--moi': a.moi = v().toUpperCase().replace(/[^A-Z]/g, ''); break;
      case '--joueur': a.joueur = v().trim(); break;
      case '--lignes': a.lignes = Math.max(3, Math.min(20, parseInt(v(), 10) || 8)); break;
      case '--titre': a.titre = v(); break;
      case '--api': a.api = v().replace(/\/$/, ''); break;
      default:
        console.error(`Argument inconnu : ${argv[i]}`);
        process.exit(1);
    }
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));

/* -------------------------------------------------------------- le classement */

/** « 9,84 » — un chrono a la francaise, deux decimales comme dans le jeu. */
const virgule = ms => (ms / 1000).toFixed(2).replace('.', ',');

/** « +0,42 » — un ecart, signe, parce qu'un ecart sans signe se lit comme un chrono. */
const ecartDit = ms => (ms > 0 ? '+' : '') + (ms / 1000).toFixed(2).replace('.', ',');

/**
 * LE PAYS, AVEC SON ARTICLE, PARCE QUE LA CARTE SE LIT.
 *
 * « France est 6e » n'est pas une phrase francaise. Le serveur donne la forme
 * a preposition — « de France », « du Canada », « des Etats-Unis » — qui
 * existe pour les titres de championnat ; l'article s'en deduit, et le nombre
 * avec (« les Etats-Unis SONT 6es »).
 *
 * LES DEUX EXCEPTIONS SONT ECRITES, pas devinees. « de Cuba » et « d'Israel »
 * ont la meme forme que « de France », et pourtant on ne dit pas « la Cuba ».
 * Rien dans la table ne les distingue : le jour ou l'on ajoute un pays sans
 * article — Malte, Singapour, Madagascar — c'est ici qu'il faut le dire, et
 * c'est ce que ce commentaire est cense faire remarquer.
 */
const SANS_ARTICLE = new Set(['CU', 'IL', 'MC', 'SG', 'MT', 'MG', 'HT', 'CY']);

function sujet(l) {
  const avec = String(l.avec || '');
  const nom = l.nom;
  if (SANS_ARTICLE.has(l.pays)) return { texte: nom, pluriel: false };
  if (avec.startsWith('des ')) return { texte: `les ${nom}`, pluriel: true };
  if (avec.startsWith('du ')) return { texte: `le ${nom}`, pluriel: false };
  if (avec.startsWith("de l'")) return { texte: `l'${nom}`, pluriel: false };
  if (avec.startsWith('de la ')) return { texte: `la ${nom}`, pluriel: false };
  // Reste « de X » et « d'X » : des pays feminins, sauf les exceptions ci-dessus.
  if (avec.startsWith('de ') || avec.startsWith("d'")) return { texte: `la ${nom}`, pluriel: false };
  // Un pays que le serveur ne sait pas nommer rend son code. On ne lui invente
  // pas d'article : « la PW » serait pire que « PW ».
  return { texte: nom, pluriel: false };
}

const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Le tableau, relu a l'instant du rendu.
 *
 * ON NE RECOPIE AUCUN CHIFFRE A LA MAIN. Les cartes fixes du pack ont deja
 * fait poster un record perime : « 12 ont essaye » est vrai une heure. Tout ce
 * qui est ecrit ici sort de l'API au moment ou l'image est fabriquee.
 */
async function lireNations() {
  const u = `${args.api}/nations?race=${encodeURIComponent(args.epreuve)}`;
  let data;
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`le serveur repond ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.error(`Impossible de lire ${u} : ${e.message}`);
    console.error('(--api http://127.0.0.1:8788 pour un worker local)');
    process.exit(1);
  }
  if (data.error) { console.error(`Le serveur refuse : ${data.error}`); process.exit(1); }
  const classement = Array.isArray(data.classement) ? data.classement : [];
  if (!classement.length) {
    console.error(`Aucun pays n'atteint encore le seuil de ${data.minJoueurs || '?'} joueurs.`);
    console.error("Il n'y a pas de carte a faire cette semaine — et c'est une information.");
    process.exit(1);
  }
  return { ...data, classement };
}

const tableau = await lireNations();
const lignes = tableau.classement.slice(0, args.lignes);
const tete = lignes[0];
const mien = args.moi ? tableau.classement.find(l => l.pays === args.moi) : null;

if (args.moi && !mien) {
  console.error(`${args.moi} n'est pas au tableau : moins de ${tableau.minJoueurs} joueurs classes.`);
  console.error('La carte sort quand meme, sans la ligne « chez nous ».');
}

const libelleEpreuve = `${args.epreuve} m`;

/**
 * La phrase du bas : celle qui fait la legende du post.
 *
 * Elle nomme SON pays quand on lui en donne un — c'est ce qui transforme un
 * tableau mondial en sujet local, et un sujet local est ce qui se partage.
 * Sans `--moi`, elle se rabat sur l'ecart entre les deux premiers, qui est la
 * seule autre tension lisible d'un seul coup d'oeil.
 */
function phrase() {
  const t = sujet(tete);
  if (mien && mien.rang === 1) {
    const m = sujet(mien);
    return { fort: majuscule(`${m.texte} ${m.pluriel ? 'sont' : 'est'} en tête.`),
             doux: `Médiane de ${virgule(mien.median)} s sur ses ${mien.joueurs} meilleurs.` };
  }
  if (mien) {
    const m = sujet(mien);
    const mouvement = mien.mouvement === null ? ''
      : mien.mouvement > 0 ? ` (+${mien.mouvement} cette semaine)`
      : mien.mouvement < 0 ? ` (${mien.mouvement} cette semaine)` : ' (à sa place)';
    const rang = `${mien.rang}${mien.rang === 1 ? 're' : 'e'}${m.pluriel ? 's' : ''}`;
    return {
      fort: majuscule(`${m.texte} ${m.pluriel ? 'sont' : 'est'} ${rang}${mouvement}.`),
      doux: `${ecartDit(mien.ecart)} s sur ${t.texte}, médiane de ${virgule(mien.median)} s.`,
    };
  }
  const second = lignes[1];
  return {
    fort: majuscule(`${t.texte} ${t.pluriel ? 'mènent' : 'mène'} avec ${virgule(tete.median)} s.`),
    doux: second ? majuscule(`${sujet(second).texte} suit à ${ecartDit(second.ecart)} s.`)
                 : `Médiane des ${tableau.top} meilleurs de chaque pays.`,
  };
}
const bas = phrase();

/* ---------------------------------------------------------------- la maquette */

/** La fleche d'un mouvement. Rien du tout quand il n'y a rien a dire : une
 *  fleche a zero pose la question « pourquoi elle est la ? » a chaque lecteur. */
function fleche(m) {
  if (m === null || m === undefined || m === 0) return '';
  return m > 0 ? `<span class="monte">▲${m}</span>` : `<span class="descend">▼${-m}</span>`;
}

/** « lundi 14 septembre », la date du figeage, en toutes lettres. */
function semaineDite(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function page({ w, h }) {
  const horizontal = w > h;
  const k = echelle(w, h);

  /* HUIT LIGNES TIENNENT ; DOUZE NE TIENNENT PAS TOUTES SEULES.
     Le nombre de pays affiches se regle en ligne de commande, et le format du
     fil n'a que 1350 pixels de haut : au-dela de huit rangs, la pastille du
     bas sortait de l'image — c'est-a-dire l'adresse du jeu, la seule chose que
     la carte doit absolument montrer. Les rangs se resserrent donc a mesure
     qu'ils se multiplient, plutot que de deborder en silence.
     Le plan en demande huit ; c'est la valeur ou la carte respire. */
  const serre = Math.min(1, 8 / lignes.length);
  const r = (v) => Math.round(v * k * serre);
  const titre = args.titre || `${drapeau(tete.pays)} ${echappe(tete.nom)}`;

  /* LE TABLEAU EST LE SUJET. Sur les autres cartes, le bloc central est un
     code a recopier ; ici c'est une liste qu'on parcourt pour s'y chercher.
     D'ou les filets entre les lignes plutot qu'autour du bloc : l'oeil doit
     pouvoir sauter de rang en rang sans perdre sa ligne. */
  const table = lignes.map(l => `
    <div class="ligne${mien && l.pays === mien.pays ? ' mienne' : ''}">
      <span class="rang">${l.rang}</span>
      <span class="drapeau">${drapeau(l.pays)}</span>
      <span class="pays">${echappe(l.nom)}</span>
      <span class="mvt">${fleche(l.mouvement)}</span>
      <span class="chrono">${virgule(l.median)}</span>
      <span class="effectif">${l.joueurs}</span>
    </div>`).join('');

  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  /* Le fond n'est pas un aplat : un halo bleu au centre detache la carte du
     fil, qui est blanc ou noir selon le telephone de celui qui la voit. */
  body{${fond()};
       font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       /* CENTRE, Y COMPRIS EN STORY. Les autres cartes du compte partent du
          haut parce qu'un bloc de code doit etre lu tout de suite ; un tableau
          se parcourt, et une story le laisse alors flotter avec un tiers de
          vide sous lui. Centre, il tombe entre les deux zones que l'interface
          d'Instagram recouvre — le bandeau du haut et les boutons du bas. */
       justify-content:center;
       padding:${Math.round(72 * k)}px ${Math.round(70 * k)}px ${Math.round(64 * k)}px}
  .kicker{font-family:Menlo,"DejaVu Sans Mono",monospace;font-size:${Math.round(27 * k)}px;
          letter-spacing:.34em;color:${ENCRE.kicker};text-transform:uppercase;
          margin-bottom:${Math.round(20 * k)}px}
  h1{font-size:${Math.round(88 * k)}px;font-weight:700;line-height:1.05;
     letter-spacing:-.02em;
     background:${flamme(48)};
     -webkit-background-clip:text;background-clip:text;color:transparent;
     margin-bottom:${Math.round(14 * k)}px}
  /* Le drapeau du titre sort du degrade : un glyphe en couleur sous un
     background-clip sur le texte perd la sienne ou disparait selon le moteur.
     Il est donc dessine a part, a sa taille, sur la meme ligne de base. */
  .titre{display:flex;align-items:center;justify-content:center;
         gap:${Math.round(24 * k)}px;margin-bottom:${Math.round(14 * k)}px}
  .titre .d{font-size:${Math.round(80 * k)}px;line-height:1}
  .sous{font-size:${Math.round(32 * k)}px;color:${ENCRE.sous};line-height:1.3;
        max-width:${Math.round(880 * k)}px}

  .table{width:100%;margin-top:${Math.round((horizontal ? 20 : 30) * k)}px;
         margin-bottom:${Math.round((horizontal ? 16 : 26) * k)}px;
         border-top:1px solid ${ENCRE.filet}}
  .ligne{display:flex;align-items:center;gap:${Math.round(18 * k)}px;
         padding:${r(17)}px ${Math.round(10 * k)}px;
         border-bottom:1px solid ${ENCRE.filet};text-align:left}
  /* SA PROPRE LIGNE SE TROUVE SANS LA CHERCHER. C'est tout l'interet d'un
     classement : on y vient pour soi, et on reste pour les autres. */
  .mienne{background:rgba(251,196,78,.10);
          box-shadow:inset 3px 0 0 ${FLAMME.milieu}}
  .rang{font-family:Menlo,"DejaVu Sans Mono",monospace;
        font-size:${Math.round(34 * k)}px;color:${ENCRE.rang};
        flex:0 0 ${Math.round(58 * k)}px;text-align:right}
  .drapeau{font-size:${r(44)}px;flex:0 0 auto;line-height:1}
  .pays{font-size:${r(36)}px;color:${ENCRE.vif};font-weight:700;
        flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .mvt{font-family:Menlo,"DejaVu Sans Mono",monospace;
       font-size:${Math.round(24 * k)}px;flex:0 0 ${Math.round(70 * k)}px}
  .monte{color:#5fd39a}
  .descend{color:#e4708a}
  .chrono{font-family:Menlo,"DejaVu Sans Mono",monospace;font-weight:700;
          font-size:${r(40)}px;color:${ENCRE.vif};
          flex:0 0 ${Math.round(140 * k)}px;text-align:right}
  /* L'effectif n'est pas un detail de mise en page : a mediane egale, un pays
     de cinquante et un pays de six n'ont pas gagne la meme chose, et sans ce
     nombre la carte laisserait croire le contraire. */
  .effectif{font-family:Menlo,"DejaVu Sans Mono",monospace;
            font-size:${Math.round(24 * k)}px;color:${ENCRE.rang};
            flex:0 0 ${Math.round(56 * k)}px;text-align:right}

  .fort{font-size:${Math.round(40 * k)}px;font-weight:700;color:${ENCRE.vif};
        margin-bottom:${Math.round(10 * k)}px}
  .doux{font-size:${Math.round(32 * k)}px;color:${ENCRE.doux}}
  .regle{font-size:${Math.round(24 * k)}px;color:${ENCRE.etiquette};
         margin-top:${Math.round(12 * k)}px}
  /* Le lien n'est pas une ligne de texte mais un bouton : sur un fond bleu
     nuit, une url orange se lit comme une signature — on la survole du regard.
     C'est la derniere chose que l'oeil accroche avant de scroller. */
  .pied{margin-top:${Math.round(26 * k)}px;display:inline-block;
        background:${flamme(50)};
        color:${ENCRE.surPastille};font-weight:700;font-size:${Math.round(34 * k)}px;
        padding:${Math.round(22 * k)}px ${Math.round(48 * k)}px;
        border-radius:999px;letter-spacing:.005em}
  </style>
  <div class="kicker">Classement des nations · ${echappe(libelleEpreuve)}</div>
  ${args.titre ? `<h1>${echappe(args.titre)}</h1>`
               : `<div class="titre"><span class="d">${drapeau(tete.pays)}</span>
                  <h1>${echappe(tete.nom)}</h1></div>`}
  <div class="sous">mène la semaine du ${semaineDite(tableau.semaine)}
       avec ${virgule(tete.median)} s de médiane sur ses ${tete.joueurs} meilleurs.</div>

  <div class="table">${table}</div>

  <div class="fort">${echappe(bas.fort)}</div>
  <div class="doux">${echappe(bas.doux)}</div>
  ${args.joueur ? `<div class="regle">Semaine de ${echappe(args.joueur)}.</div>` : ''}
  <div class="regle">Médiane des ${tableau.top} meilleurs de chaque pays.</div>
  <div class="pied">${SITE}</div>`;
}

/* ------------------------------------------------------------------- le rendu */

const chrome = trouverChrome();
fs.mkdirSync(SORTIE, { recursive: true });

for (const f of FORMATS) {
  const chemin = path.join(SORTIE, `nations-${args.epreuve}-${f.cle}.png`);
  try {
    await capturer({ html: page(f), w: f.w, h: f.h, sortie: chemin, chrome });
  } catch (e) {
    console.error(`Rendu ${f.cle} : ${e.message}`);
    process.exit(1);
  }
  console.log(`  ${path.relative(RACINE, chemin)}`);
}

console.log(`
Classement des nations — ${libelleEpreuve}, semaine du ${semaineDite(tableau.semaine)}.
${lignes.map(l => `  ${String(l.rang).padStart(2)}. ${drapeau(l.pays)} ${l.nom.padEnd(22)} ` +
                  `${virgule(l.median)} s   ${l.joueurs} joueurs` +
                  `${l.mouvement ? `   ${l.mouvement > 0 ? '+' : ''}${l.mouvement}` : ''}`).join('\n')}

${bas.fort} ${bas.doux}
${args.joueur ? '' : `Pour nommer le joueur de la semaine : --joueur "SON NOM".
  Son accord se demande AVANT (charte §5.4) — c'est pourquoi rien ne le remplit tout seul.`}
`);
