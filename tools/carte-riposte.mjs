/* ===========================================================================
   La carte qu'on ne peut pas preparer a l'avance.

   Les cartes de communication/riposte-danube/ sont fixes : elles disent
   8.246 contre 9.58, et ces deux chiffres etaient connus le matin. Celle-ci
   porte un chrono qui n'existe pas encore au moment ou on l'ecrit — celui du
   vainqueur d'une finale. Elle se fabrique donc au moment ou la ligne est
   franchie, pas avant, et le seul delai qui compte est celui entre l'arrivee
   et le post.

     node tools/carte-riposte.mjs --epreuve 100 --vainqueur "Nom" --temps 9.79
     node tools/carte-riposte.mjs --epreuve 100 --femmes --vainqueur "..." --temps 10.75

   Sort deux PNG dans communication/riposte-danube/cartes/ : `-feed`
   (1080x1350, Instagram) et `-story` (1080x1920, story et TikTok).

   Le record du jeu n'est PAS ecrit ici : il est relu sur l'API du classement
   a chaque appel. Une carte qui annonce un record perime est pire que pas de
   carte, et ce risque-la se supprime plutot qu'il ne se surveille.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/riposte-danube/cartes');

// puppeteer-core vit dans le chantier des films promo, pas a la racine. On
// resout depuis LA-BAS plutot que de dupliquer la dependance.
const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/* ---------------------------------------------------------------------------
   Les records du monde reels.

   Ils sont ecrits en dur parce qu'ils ne bougent pas — celui du 100 m tient
   depuis 2009, celui du 100 m femmes depuis 1988. Le jour ou l'un tombe, la
   nouvelle sera assez grosse pour qu'on pense a cette ligne ; d'ici la, aller
   les chercher sur un site a chaque appel ajouterait une panne possible a un
   outil qu'on lance a 19h50 avec deux minutes devant soi.
--------------------------------------------------------------------------- */
const RECORDS_MONDE = {
  '100-h': { t: 9.58,  qui: 'Usain Bolt',            an: 2009 },
  '200-h': { t: 19.19, qui: 'Usain Bolt',            an: 2009 },
  '400-h': { t: 43.03, qui: 'Wayde van Niekerk',     an: 2016 },
  '100-f': { t: 10.49, qui: 'Florence Griffith-Joyner', an: 1988 },
  '200-f': { t: 21.34, qui: 'Florence Griffith-Joyner', an: 1988 },
  '400-f': { t: 47.60, qui: 'Marita Koch',           an: 1985 },
};

/* ------------------------------------------------------------------ arguments */
function lireArgs(argv) {
  const a = { epreuve: '100', femmes: false, vainqueur: '', temps: null, nom: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--femmes') a.femmes = true;
    else if (k === '--epreuve') a.epreuve = String(argv[++i] || '100').replace(/\s*m$/i, '');
    else if (k === '--vainqueur') a.vainqueur = String(argv[++i] || '');
    else if (k === '--temps') a.temps = String(argv[++i] || '');
    else if (k === '--nom') a.nom = String(argv[++i] || '');
  }
  return a;
}

const args = lireArgs(process.argv.slice(2));

/* ---------------------------------------------------------------------------
   DEUX MOMENTS, UNE CARTE.

   AVANT la course, on n'a que deux chronos : le notre et le record du monde.
   La carte se pose quand meme — c'est meme le seul visuel disponible pendant
   les deux heures ou tout le monde attend la finale.

   APRES, le chrono du vainqueur s'ajoute au milieu, et c'est lui qui date la
   carte. On passe de l'un a l'autre en donnant --vainqueur et --temps.
--------------------------------------------------------------------------- */
const avantCourse = !args.vainqueur || !args.temps;

if (!avantCourse && (!args.vainqueur || !args.temps)) {
  console.error('Donne --vainqueur ET --temps, ou aucun des deux.');
  process.exit(1);
}

if (!['100', '200', '400'].includes(args.epreuve)) {
  console.error(`Epreuve inconnue : ${args.epreuve}. Attendu 100, 200 ou 400.`);
  process.exit(1);
}

const tempsVainqueur = avantCourse ? null : Number(String(args.temps).replace(',', '.'));
if (!avantCourse && (!Number.isFinite(tempsVainqueur) || tempsVainqueur <= 0)) {
  console.error(`Temps illisible : « ${args.temps} ». Attendu par exemple 9.79.`);
  process.exit(1);
}

const cleRM = `${args.epreuve}-${args.femmes ? 'f' : 'h'}`;
const rm = RECORDS_MONDE[cleRM];

/* ------------------------------------------------- le record du jeu, en direct */
async function recordDuJeu(epreuve) {
  const res = await fetch(`${API}/leaderboard?race=${epreuve}`);
  if (!res.ok) throw new Error(`le classement repond ${res.status}`);
  const { entries } = await res.json();
  if (!entries || !entries.length) throw new Error('classement vide');
  const meilleur = entries.reduce((a, b) => (a.best_split_ms <= b.best_split_ms ? a : b));
  return { ms: meilleur.best_split_ms, nom: meilleur.name, pose: meilleur.updated_at || null };
}

/**
 * Depuis combien de temps notre record tient, en clair.
 *
 * La carte oppose l'age d'un record du monde a l'age du notre, et cette
 * phrase-la doit etre vraie : « tombe cette semaine » ecrit d'avance serait
 * faux le jour ou le record aura deux mois. On lit donc la date que le
 * classement porte deja — la derniere fois que le detenteur a ameliore son
 * chrono sur cette epreuve — plutot que d'en affirmer une.
 */
function ageDuRecord(pose) {
  if (!pose) return null;
  const jours = Math.floor((Date.now() - pose) / 86400000);
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 14) return 'la semaine dernière';
  if (jours < 60) return `il y a ${Math.round(jours / 7)} semaines`;
  return `il y a ${Math.round(jours / 30)} mois`;
}

const jeu = await recordDuJeu(args.epreuve);
const secJeu = jeu.ms / 1000;

/* ---------------------------------------------------------------------------
   Ce que la carte raconte.

   Deux cas, et le titre n'est pas le meme :
   — le vainqueur passe sous le record du monde : la nouvelle est a LUI, la
     carte le dit et se contente de poser notre chrono a cote ;
   — il ne passe pas, ce qui est le cas quasi certain : le record du monde
     tient, et c'est ce contraste-la qu'on montre.
--------------------------------------------------------------------------- */
const recordTombe = !avantCourse && tempsVainqueur < rm.t;
/* Avant la course, l'ecart qui compte est celui avec le RECORD DU MONDE : il
   n'y a encore personne d'autre a qui se comparer. Apres, c'est celui avec le
   vainqueur — c'est la course qu'on vient de voir. */
const ecart = ((avantCourse ? rm.t : tempsVainqueur) - secJeu).toFixed(2).replace('.', ',');
const anneesRM = new Date().getFullYear() - rm.an;

const age = ageDuRecord(jeu.pose);
const epreuveTexte = `${args.epreuve} m ${args.femmes ? 'femmes' : 'hommes'}`;

/* Le nombre de decimales n'est pas une question de gout : c'est la precision
   de la source. L'athletisme chronometre au centieme et publie 9.58 — ecrire
   « 9.580 » invente un millieme que personne n'a mesure. Le jeu, lui, compte
   en millisecondes et son record EST 8.246. Chaque chrono garde donc la
   precision de l'endroit d'ou il vient. Et la virgule est francaise, comme
   partout ailleurs sur les cartes. */
const fmtReel = n => n.toFixed(2).replace('.', ',');
const fmtJeu = n => n.toFixed(3).replace('.', ',');

/* ---------------------------------------------------------------------------
   Le titre est un CHIFFRE, pas une phrase.

   « LE RECORD TIENT TOUJOURS » se lit ; « 2,56 S D'AVANCE » se voit. Dans un
   fil ou la carte passe en une demi-seconde, c'est le chiffre qui arrete, et
   la phrase qui explique vient juste dessous. Le seul cas ou le titre
   redevient un mot est celui ou le record du monde tombe : ce soir-la, la
   nouvelle n'est plus notre ecart.
--------------------------------------------------------------------------- */
const titre = recordTombe ? 'RECORD DU MONDE' : `${ecart} S D’AVANCE`;
const sousTitre = recordTombe
  ? `le ${epreuveTexte} vient de tomber à Budapest`
  : avantCourse
    ? `sur le record du monde du ${args.epreuve} m`
    : `sur le vainqueur de ce soir à Budapest`;

const basFort = recordTombe
  ? `Il aura fallu ${anneesRM} ans.`
  : `Le record du monde du ${args.epreuve} m tient depuis ${rm.an}.`;
const basDoux = age
  ? `Le nôtre est tombé ${age}.`
  : 'Le nôtre a deux semaines.';

const lignes = [
  { etiq: 'Jeu',   qui: jeu.nom,                chrono: fmtJeu(secJeu) },
  ...(avantCourse ? [] : [
  { etiq: 'Ce soir', qui: args.vainqueur,       chrono: fmtReel(tempsVainqueur) }]),
  { etiq: 'Monde', qui: `${rm.qui} · ${rm.an}`, chrono: fmtReel(rm.t) },
];

/* ------------------------------------------------------------------- la page */
const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page({ w, h }) {
  // Les proportions suivent la hauteur : la meme page sert au 1080x1350 et au
  // 1080x1920 sans qu'on entretienne deux maquettes qui finiraient par diverger.
  const story = h > 1500;
  const k = story ? 1.12 : 1;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{background:#070b16;
       background-image:radial-gradient(ellipse 88% 62% at 50% 46%,
                        #17213a 0%,#101728 46%,#070b16 100%);
       font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,sans-serif;
       display:flex;flex-direction:column;align-items:center;text-align:center;
       padding:${Math.round(118 * k)}px 78px ${Math.round(96 * k)}px}
  .kicker{font-family:Menlo,monospace;font-size:${Math.round(27 * k)}px;
          letter-spacing:.34em;color:#8494ad;text-transform:uppercase;
          margin-bottom:${Math.round(46 * k)}px}
  h1{font-size:${Math.round(112 * k)}px;font-weight:700;line-height:1;
     letter-spacing:-.015em;
     background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 48%,#ef7526 96%);
     -webkit-background-clip:text;background-clip:text;color:transparent;
     margin-bottom:${Math.round(26 * k)}px}
  .sous{font-size:${Math.round(35 * k)}px;color:#93a2ba;
        margin-bottom:${Math.round(92 * k)}px}
  .liste{width:100%;margin-top:auto}
  .l{display:flex;align-items:baseline;justify-content:space-between;
     padding:${Math.round(30 * k)}px 6px;border-bottom:1px solid #253049}
  .l:last-child{border-bottom:none}
  .g{display:flex;align-items:baseline;gap:20px;min-width:0}
  .etiq{font-family:Menlo,monospace;font-size:${Math.round(26 * k)}px;letter-spacing:.2em;
        color:#7e8da6;text-transform:uppercase;flex:0 0 auto}
  .qui{font-size:${Math.round(40 * k)}px;font-weight:700;color:#b8c4d6;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chrono{font-family:Menlo,monospace;font-size:${Math.round(56 * k)}px;font-weight:700;
          color:#e6ecf6;letter-spacing:-.02em;flex:0 0 auto;padding-left:24px}
  /* Notre chrono est le seul en couleur : c'est celui qu'on vient chercher. */
  .l.nous .etiq,.l.nous .qui,.l.nous .chrono{color:#f7a93f}
  .bas{margin-top:auto;padding-top:${Math.round(70 * k)}px}
  .fort{font-size:${Math.round(40 * k)}px;font-weight:700;color:#eef2f8;
        margin-bottom:${Math.round(16 * k)}px}
  .doux{font-size:${Math.round(36 * k)}px;color:#8d9cb4}
  /* Le lien n'est plus une ligne de texte mais un bouton : sur un fond bleu
     nuit, une url orange se lit comme une signature — on la survole du regard.
     Le meme degrade que le titre, pose en aplat, la transforme en appel a
     l'action et c'est la derniere chose que l'oeil accroche avant de scroller. */
  .pied{margin-top:${Math.round(54 * k)}px;display:inline-block;
        background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 50%,#ef7526 96%);
        color:#0a1020;font-weight:700;font-size:${Math.round(38 * k)}px;
        padding:${Math.round(26 * k)}px ${Math.round(56 * k)}px;
        border-radius:999px;letter-spacing:.005em}
  </style>
  <div class="kicker">Budapest &nbsp;·&nbsp; ${epreuveTexte}</div>
  <h1>${echappe(titre)}</h1>
  <div class="sous">${echappe(sousTitre)}</div>

  <div class="liste">${lignes.map((l, i) => `
    <div class="l${i === 0 ? ' nous' : ''}">
      <span class="g"><span class="etiq">${echappe(l.etiq)}</span>
      <span class="qui">${echappe(l.qui)}</span></span>
      <span class="chrono">${l.chrono}</span>
    </div>`).join('')}
  </div>

  <div class="bas">
    <div class="fort">${echappe(basFort)}</div>
    <div class="doux">${echappe(basDoux)}</div>
    <div class="pied">sprinter-game.com</div>
  </div>`;
}

/* ------------------------------------------------------------------- le rendu */
fs.mkdirSync(SORTIE, { recursive: true });
const base = args.nom || `budapest-${args.epreuve}m-${args.femmes ? 'f' : 'h'}`;

const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});

const formats = [
  { suffixe: 'feed',  w: 1080, h: 1350 },
  { suffixe: 'story', w: 1080, h: 1920 },
];

for (const f of formats) {
  const onglet = await navigateur.newPage();
  await onglet.setViewport({ width: f.w, height: f.h, deviceScaleFactor: 1 });
  await onglet.setContent(page(f), { waitUntil: 'load' });
  const chemin = path.join(SORTIE, `${base}-${f.suffixe}.png`);
  await onglet.screenshot({ path: chemin, type: 'png' });
  await onglet.close();
  console.log(`  ${path.relative(RACINE, chemin)}`);
}

await navigateur.close();

console.log(`
Record du jeu relu a l'instant : ${fmtJeu(secJeu)} s — ${jeu.nom}
${avantCourse ? '(avant la course — ni vainqueur ni chrono)' :
  `Vainqueur                      : ${fmtReel(tempsVainqueur)} s — ${args.vainqueur}`}
Record du monde                : ${fmtReel(rm.t)} s — ${rm.qui}, ${rm.an}${recordTombe ? '  (BATTU CE SOIR)' : ''}
`);
