/* ===========================================================================
   La carte du defi : les trois records, tels qu'ils sont a la seconde ou on
   la fabrique.

   Les cartes fixes du pack ont toutes le meme defaut, et il s'est verifie :
   le 12 septembre elles annoncaient 34.888 au 400 m, le 13 au matin le record
   etait a 34.729. Une carte qui liste des records DOIT donc lire le classement
   au moment du rendu — sinon elle vieillit en quelques heures et fait poster
   un chiffre faux.

     node tools/carte-defi.mjs
     node tools/carte-defi.mjs --titre "DERNIERE NUIT" --fin "ce soir 21h"
     node tools/carte-defi.mjs --podium 100     le top 3 d'une seule epreuve

   Sort defi-feed.png (1080x1350) et defi-story.png (1080x1920).

   LE STYLE. Bleu nuit, tout centre, titre en degrade orange, chronos a la
   francaise (8,246 et non 8.246), lignes separees par un filet plutot que
   posees dans des blocs. C'est celui que les cartes du pack adopteront : il
   tient mieux la reduction du fil, ou un bloc bord a bord devient une bouillie
   grise alors qu'un filet disparait proprement.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/riposte-danube/cartes');

const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const EPREUVES = ['100', '200', '400'];

function lireArgs(argv) {
  const a = { titre: null, fin: "jusqu'à dimanche 21h", nom: 'defi', podium: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--titre') a.titre = String(argv[++i] || '');
    else if (argv[i] === '--fin') a.fin = String(argv[++i] || a.fin);
    else if (argv[i] === '--nom') a.nom = String(argv[++i] || a.nom);
    else if (argv[i] === '--podium') a.podium = String(argv[++i] || '100').replace(/\s*m$/i, '');
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));

if (args.podium && !EPREUVES.includes(args.podium)) {
  console.error(`Epreuve inconnue : ${args.podium}. Attendu 100, 200 ou 400.`);
  process.exit(1);
}

async function classement(ep) {
  const res = await fetch(`${API}/leaderboard?race=${ep}`);
  if (!res.ok) { console.error(`${ep} m : le classement repond ${res.status}`); process.exit(1); }
  const { entries } = await res.json();
  return [...entries].sort((a, b) => a.best_split_ms - b.best_split_ms);
}

/* ---------------------------------------------------------------------------
   Deux cartes, une seule maquette.

   « defi » aligne les trois records, un par epreuve. « podium » deroule le
   top 3 d'une seule. Dans les deux cas la carte dit la meme chose — l'ecart
   est minuscule, viens le prendre — et c'est cet ecart qui fabrique le titre.
--------------------------------------------------------------------------- */
const virgule = ms => (ms / 1000).toFixed(3).replace('.', ',');

let kicker, titre, sousTitre, lignes, basFort, basDoux;

if (args.podium) {
  const top = (await classement(args.podium)).slice(0, 3);
  const ecart = top.length > 2 ? top[2].best_split_ms - top[0].best_split_ms : 0;
  kicker = `Le podium du ${args.podium} m`;
  titre = args.titre || `${Math.round(ecart / 10)} CENTIÈMES`;
  sousTitre = 'c’est tout ce qui sépare les trois premiers';
  lignes = top.map((e, i) => ({ rang: `${i + 1}.`, qui: e.name, ms: e.best_split_ms }));
  basFort = `${(ecart / 1000).toFixed(3).replace('.', ',')} s entre la 1re et la 3e place.`;
  basDoux = 'Une course suffit pour tout changer.';
} else {
  const tout = [];
  for (const ep of EPREUVES) {
    const c = await classement(ep);
    tout.push({
      ep, ms: c[0].best_split_ms, nom: c[0].name,
      ecart: c[1] ? c[1].best_split_ms - c[0].best_split_ms : null,
    });
  }
  // La phrase du bas se calcule sur le classement le plus serre : elle dit
  // « ca se joue a rien » avec un chiffre, pas avec un adjectif.
  const serre = tout.filter(r => r.ecart != null).sort((a, b) => a.ecart - b.ecart)[0];
  kicker = args.fin;
  titre = args.titre || 'DÉFI BUDAPEST';
  sousTitre = 'les trois records à battre avant la fin';
  lignes = tout.map(r => ({ rang: `${r.ep} m`, qui: r.nom, ms: r.ms }));
  basFort = serre
    ? `Sur le ${serre.ep} m, le deuxième est à ${serre.ecart} millièmes.`
    : '';
  basDoux = 'Une course suffit pour tout changer.';
}

const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page({ w, h }) {
  const story = h > 1500;
  const k = story ? 1.12 : 1;   // tout respire un peu plus en vertical
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  /* Le fond n'est pas un aplat : un halo bleu au centre detache la carte du
     fil, qui est blanc ou noir selon le telephone de celui qui la voit. */
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
  /* margin-top:auto des deux cotes : l'espace restant se partage au-dessus et
     en dessous de la liste, qui se centre quel que soit le format. */
  .liste{width:100%;margin-top:auto}
  /* Un filet, pas un bloc : reduit au format du fil il s'efface, la ou une
     bordure pleine se transforme en pave gris. */
  .l{display:flex;align-items:baseline;justify-content:space-between;
     padding:${Math.round(30 * k)}px 6px;border-bottom:1px solid #253049}
  .l:last-child{border-bottom:none}
  .g{display:flex;align-items:baseline;gap:18px;min-width:0}
  .rang{font-size:${Math.round(40 * k)}px;color:#7e8da6;flex:0 0 auto}
  .qui{font-size:${Math.round(42 * k)}px;font-weight:700;color:#b8c4d6;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chrono{font-family:Menlo,monospace;font-size:${Math.round(56 * k)}px;font-weight:700;
          color:#e6ecf6;letter-spacing:-.02em;flex:0 0 auto;padding-left:24px}
  /* Le premier est le seul en couleur : c'est le chrono qu'on vient chercher. */
  .l.tete .rang,.l.tete .qui,.l.tete .chrono{color:#f7a93f}
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
  <div class="kicker">${echappe(kicker)}</div>
  <h1>${echappe(titre)}</h1>
  <div class="sous">${echappe(sousTitre)}</div>

  <div class="liste">${lignes.map((l, i) => `
    <div class="l${i === 0 ? ' tete' : ''}">
      <span class="g"><span class="rang">${echappe(l.rang)}</span>
      <span class="qui">${echappe(l.qui)}</span></span>
      <span class="chrono">${virgule(l.ms)}</span>
    </div>`).join('')}
  </div>

  <div class="bas">
    <div class="fort">${echappe(basFort)}</div>
    <div class="doux">${echappe(basDoux)}</div>
    <div class="pied">sprinter-game.com</div>
  </div>`;
}

fs.mkdirSync(SORTIE, { recursive: true });
const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});
for (const f of [{ s: 'feed', w: 1080, h: 1350 }, { s: 'story', w: 1080, h: 1920 }]) {
  const onglet = await navigateur.newPage();
  await onglet.setViewport({ width: f.w, height: f.h, deviceScaleFactor: 1 });
  await onglet.setContent(page(f), { waitUntil: 'load' });
  const chemin = path.join(SORTIE, `${args.nom}-${f.s}.png`);
  await onglet.screenshot({ path: chemin, type: 'png' });
  await onglet.close();
  console.log(`  ${path.relative(RACINE, chemin)}`);
}
await navigateur.close();

console.log('\nLu a l\'instant :');
for (const l of lignes) console.log(`  ${String(l.rang).padStart(6)}  ${virgule(l.ms)}  ${l.qui}`);
console.log('');
