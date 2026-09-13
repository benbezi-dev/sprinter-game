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
if (!args.vainqueur || !args.temps) {
  console.error(`
Il manque le vainqueur ou le temps.

  node tools/carte-riposte.mjs --epreuve 100 --vainqueur "Oblique Seville" --temps 9.79
  node tools/carte-riposte.mjs --epreuve 100 --femmes --vainqueur "Julien Alfred" --temps 10.75

  --epreuve    100, 200 ou 400            (defaut : 100)
  --femmes     finale femmes              (defaut : hommes)
  --temps      9.79  ou  9,79  ou  43.35
  --nom        nom des fichiers de sortie (defaut : budapest-<epreuve>m-<h|f>)
`);
  process.exit(1);
}

if (!['100', '200', '400'].includes(args.epreuve)) {
  console.error(`Epreuve inconnue : ${args.epreuve}. Attendu 100, 200 ou 400.`);
  process.exit(1);
}

const tempsVainqueur = Number(String(args.temps).replace(',', '.'));
if (!Number.isFinite(tempsVainqueur) || tempsVainqueur <= 0) {
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
const recordTombe = tempsVainqueur < rm.t;
const ecart = (tempsVainqueur - secJeu).toFixed(2).replace('.', ',');
const anneesRM = new Date().getFullYear() - rm.an;

const titre = recordTombe
  ? ['NOUVEAU', 'RECORD DU MONDE.']
  : ['LE RECORD', 'TIENT TOUJOURS.'];

const age = ageDuRecord(jeu.pose);

const note = recordTombe
  ? [`Il aura fallu ${anneesRM} ans.`,
     age ? `Le nôtre est tombé ${age}.` : `${ecart} s d’écart avec le nôtre.`]
  : [`${anneesRM} ans que personne n’y touche.`,
     `${ecart} s d’écart avec le nôtre.`];

const epreuveTexte = `${args.epreuve} M ${args.femmes ? 'FEMMES' : 'HOMMES'}`;

/* Le nombre de decimales n'est pas une question de gout : c'est la precision
   de la source. L'athletisme chronometre au centieme et publie 9.58 — ecrire
   « 9.580 » invente un millieme que personne n'a mesure. Le jeu, lui, compte
   en millisecondes et son record EST 8.246. Chaque chrono garde donc la
   precision de l'endroit d'ou il vient. */
const fmtReel = n => n.toFixed(2);
const fmtJeu = n => n.toFixed(3);

/* ------------------------------------------------------------------- la page */
const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page({ w, h }) {
  // Les proportions suivent la hauteur : la meme page sert au 1080x1350 et au
  // 1080x1920 sans qu'on entretienne deux maquettes qui finiraient par diverger.
  const story = h > 1500;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;background:#14121e;overflow:hidden}
  body{font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#f2f0f5;
       display:flex;flex-direction:column;padding:${story ? 132 : 96}px 84px;
       border-top:12px solid #e8622a;border-bottom:12px solid #e8622a}
  .kicker{font-family:Menlo,monospace;font-size:26px;letter-spacing:.34em;
          color:#8f8a9e;text-transform:uppercase;margin-bottom:${story ? 108 : 78}px}
  h1{font-size:${story ? 108 : 96}px;font-weight:700;line-height:1.04;letter-spacing:-.02em;
     margin-bottom:${story ? 84 : 60}px}
  .ligne{display:flex;align-items:center;justify-content:space-between;
         background:#1e1a2b;border-radius:18px;padding:${story ? 34 : 28}px 36px;
         margin-bottom:16px;border:3px solid transparent}
  .ligne.nous{border-color:#e8622a;background:#1b1726}
  .etiq{font-family:Menlo,monospace;font-size:24px;letter-spacing:.2em;color:#8f8a9e;
        text-transform:uppercase;margin-right:26px;flex:0 0 auto}
  .ligne.nous .etiq{color:#e8622a}
  .qui{font-size:34px;font-weight:700;color:#cfcad8;flex:1 1 auto;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ligne.nous .qui{color:#f2f0f5}
  .chrono{font-family:Menlo,monospace;font-size:${story ? 82 : 74}px;font-weight:700;
          color:#b9b3c6;flex:0 0 auto;margin-left:28px;letter-spacing:-.02em}
  .ligne.nous .chrono{color:#e8622a}
  .note{margin-top:${story ? 60 : 44}px;font-size:34px;line-height:1.5;color:#a49eb3}
  /* margin-top:auto pousse le pied en bas quand il reste de la place, mais
     quand le titre passe sur trois lignes il ne reste rien et l'url venait se
     coller a la note. Le padding minimum garde l'air dans les deux cas. */
  .pied{margin-top:auto;padding-top:${story ? 72 : 52}px;
        font-size:40px;font-weight:700;color:#e8622a;letter-spacing:-.01em}
  </style>
  <div class="kicker">Budapest &nbsp;·&nbsp; ${epreuveTexte}</div>
  <h1>${titre[0]}<br>${titre[1]}</h1>

  <div class="ligne nous">
    <span class="etiq">Jeu</span>
    <span class="qui">${echappe(jeu.nom)}</span>
    <span class="chrono">${fmtJeu(secJeu)}</span>
  </div>
  <div class="ligne">
    <span class="etiq">Ce soir</span>
    <span class="qui">${echappe(args.vainqueur)}</span>
    <span class="chrono">${fmtReel(tempsVainqueur)}</span>
  </div>
  <div class="ligne">
    <span class="etiq">Monde</span>
    <span class="qui">${echappe(rm.qui)} · ${rm.an}</span>
    <span class="chrono">${fmtReel(rm.t)}</span>
  </div>

  <div class="note">${echappe(note[0])}<br>${echappe(note[1])}</div>
  <div class="pied">sprinter-game.com</div>`;
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
Vainqueur                      : ${fmtReel(tempsVainqueur)} s — ${args.vainqueur}
Record du monde                : ${fmtReel(rm.t)} s — ${rm.qui}, ${rm.an}${recordTombe ? '  (BATTU CE SOIR)' : ''}
`);
