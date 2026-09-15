/* ===========================================================================
   LA COURSE QUI N'A JAMAIS EU LIEU.

   « 2,56 s d'avance » est un chiffre juste et un mauvais plan : une seconde et
   demie ne se voit pas. La meme avance traduite en DISTANCE se voit tout de
   suite — quand le record du jeu franchit la ligne du 200 m, le record du
   monde est encore a vingt-six metres derriere. Sur 400 m, a soixante-dix-sept.

   Ce module fait courir les deux cote a cote et laisse le regard mesurer
   l'ecart a la place du spectateur.

     node tools/video-ecart.mjs --epreuve 200
     node tools/video-ecart.mjs --epreuve 400 --nom ecart-400

   Sort communication/riposte-danube/video-1080x1920/<nom>.mp4

   CE QUE L'IMAGE AFFIRME, ET CE QU'ELLE NE DIT PAS. Les deux coureurs avancent
   a VITESSE MOYENNE constante. Un vrai sprinter accelere puis decroche, donc
   l'ecart intermediaire montre ici n'est pas celui qu'une vraie course
   donnerait. L'ecart A L'ARRIVEE, lui, est exact : c'est la distance parcourue
   pendant le temps qui les separe. C'est celui-la qu'on annonce, et c'est
   pourquoi le chiffre n'apparait qu'a la fin.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE_VIDEO = path.join(RACINE, 'communication/riposte-danube/video-1080x1920');

const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const FFMPEG = path.join(RACINE, 'assets-stores/promo/node_modules/ffmpeg-static/ffmpeg');

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const RECORDS_MONDE = {
  '100-h': { t: 9.58,  qui: 'Usain Bolt' },
  '200-h': { t: 19.19, qui: 'Usain Bolt' },
  '400-h': { t: 43.03, qui: 'Wayde van Niekerk' },
  '100-f': { t: 10.49, qui: 'Florence Griffith-Joyner' },
  '200-f': { t: 21.34, qui: 'Florence Griffith-Joyner' },
  '400-f': { t: 47.60, qui: 'Marita Koch' },
};

function lireArgs(argv) {
  const a = { epreuve: '200', femmes: false, nom: null, fps: 30, ton: 'humble' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--epreuve') a.epreuve = String(argv[++i] || '200').replace(/\s*m$/i, '');
    else if (argv[i] === '--femmes') a.femmes = true;
    else if (argv[i] === '--nom') a.nom = String(argv[++i] || '');
    else if (argv[i] === '--fps') a.fps = Math.max(24, Math.min(60, Number(argv[++i]) || 30));
    else if (argv[i] === '--ton') a.ton = String(argv[++i]) === 'cash' ? 'cash' : 'humble';
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));
if (!['100', '200', '400'].includes(args.epreuve)) {
  console.error(`Epreuve inconnue : ${args.epreuve}. Attendu 100, 200 ou 400.`);
  process.exit(1);
}
const rm = RECORDS_MONDE[`${args.epreuve}-${args.femmes ? 'f' : 'h'}`];

const res = await fetch(`${API}/leaderboard?race=${args.epreuve}`);
if (!res.ok) { console.error(`Le classement repond ${res.status}`); process.exit(1); }
const { entries } = await res.json();
const meilleur = entries.reduce((a, b) => (a.best_split_ms <= b.best_split_ms ? a : b));

const D = Number(args.epreuve);              // la distance, en metres
const tJeu = meilleur.best_split_ms / 1000;
const tMonde = rm.t;
const vJeu = D / tJeu;                       // vitesses moyennes, m/s
const vMonde = D / tMonde;
// Ou en est le record du monde au moment ou le record du jeu franchit la ligne.
const positionMonde = vMonde * tJeu;
const retard = D - positionMonde;            // le chiffre que porte le film

/* ---------------------------------------------------------------------------
   LE DECOUPAGE, en secondes de film.

   La course reelle dure vingt secondes ; personne ne regarde vingt secondes.
   Elle est donc jouee en quatre — assez pour qu'on voie l'ecart se creuser,
   assez court pour qu'on reste. Le chiffre ne tombe qu'apres l'arrivee, quand
   le regard a deja fait le calcul tout seul.
--------------------------------------------------------------------------- */
const T = {
  intro: [0.0, 1.6],       // les deux couloirs se presentent
  course: [1.6, 6.4],      // 4,8 s de film pour toute la course
  verdict: [6.4, 9.6],     // l'ecart s'affiche, mesure sur la piste
  fin: [9.6, 13.0],        // le titre et le lien
};
const DUREE = T.fin[1];
const nbImages = Math.round(DUREE * args.fps);

/* ---------------------------------------------------------------------------
   LE TON, et pourquoi c'est un reglage et non une formule figee.

   Le meme chiffre dit deux choses selon la phrase qui l'accompagne.

   'cash'   — « d'avance sur le record du monde ». On se compare, et on gagne.
              Ca se lit comme du mepris pour une performance que le public de
              l'athletisme respecte : le detenteur du record devient le perdant
              d'une course qu'il n'a jamais courue, sur un jeu ou l'on tape sur
              deux touches.
   'humble' — on dit la meme chose de nous, pas de lui : le jeu est irrealiste,
              c'est le principe, et la performance reelle est rappelee comme
              telle. La blague reste, la cible change — et le public vise
              devient complice au lieu d'etre vexe.

   'humble' par defaut. Le gain d'audience d'une pique ne compense jamais la
   communaute qu'elle ferme.
--------------------------------------------------------------------------- */
const TONS = {
  cash: {
    sous: 'd’avance sur le record du monde',
    respect: '',
  },
  humble: {
    sous: 'l’écart entre un jeu et la réalité',
    respect: 'Nous, on appuie sur deux touches.',
  },
};
const ton = TONS[args.ton];

const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const virgule = (n, d = 3) => n.toFixed(d).replace('.', ',');

/* ------------------------------------------------------------------ la scene */
function scene() {
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;overflow:hidden;background:#070b16}
  body{background-image:radial-gradient(ellipse 92% 58% at 50% 44%,
        #17213a 0%,#101728 48%,#070b16 100%);
       font:400 16px/1.2 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#e6ecf6}
  .ecran{position:absolute;inset:0;opacity:0}

  /* --- le chrono, en haut, en monospace : c'est l'horloge de la course --- */
  #chrono{position:absolute;top:196px;left:0;right:0;text-align:center;
          font-family:Menlo,monospace;font-size:132px;font-weight:700;
          letter-spacing:-.03em;color:#e6ecf6}
  #distance{position:absolute;top:352px;left:0;right:0;text-align:center;
            font-family:Menlo,monospace;font-size:30px;letter-spacing:.3em;
            color:#8494ad;text-transform:uppercase}

  /* --- les deux couloirs --- */
  .piste{position:absolute;left:80px;right:80px;height:132px;border-radius:14px;
         background:#121a2c;border:1px solid #24304a;overflow:visible}
  #p1{top:760px}
  #p2{top:940px}
  .etiq{position:absolute;left:6px;top:-46px;font-family:Menlo,monospace;
        font-size:25px;letter-spacing:.22em;text-transform:uppercase;color:#7e8da6}
  #p1 .etiq{color:#f7a93f}
  /* Le coureur : une pastille et une trainee, pas un bonhomme. A cette taille
     une silhouette devient une tache ; un point qui file se lit. */
  .coureur{position:absolute;top:50%;width:56px;height:56px;margin-top:-28px;
           border-radius:50%;transform:translateX(-28px)}
  #c1{background:#f7a93f;box-shadow:0 0 46px 12px rgba(247,169,63,.55)}
  #c2{background:#9fb0c8;box-shadow:0 0 34px 8px rgba(159,176,200,.35)}
  .trainee{position:absolute;top:50%;height:8px;margin-top:-4px;left:0;
           border-radius:4px;transform-origin:left center}
  #t1{background:linear-gradient(90deg,rgba(247,169,63,0),rgba(247,169,63,.75))}
  #t2{background:linear-gradient(90deg,rgba(159,176,200,0),rgba(159,176,200,.5))}
  .arrivee{position:absolute;top:-14px;bottom:-14px;width:5px;right:0;
           background:#e6ecf6;opacity:.5}

  /* --- la mesure de l'ecart, tracee sur la piste du record du monde --- */
  #mesure{position:absolute;height:0;border-top:3px dashed #f7a93f;opacity:0}
  #mesureTexte{position:absolute;text-align:center;font-family:Menlo,monospace;
               font-size:40px;font-weight:700;color:#f7a93f;opacity:0}

  /* --- textes --- */
  .centre{position:absolute;left:0;right:0;text-align:center}
  #titre{top:1180px;font-size:112px;font-weight:700;line-height:1;
         letter-spacing:-.015em;
         background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 48%,#ef7526 96%);
         -webkit-background-clip:text;background-clip:text;color:transparent;opacity:0}
  #sous{top:1330px;font-size:40px;color:#93a2ba;opacity:0}
  #kicker{top:1180px;font-size:52px;font-weight:700;color:#eef2f8;opacity:0;
          line-height:1.3}
  #bouton{position:absolute;bottom:250px;left:0;right:0;text-align:center;opacity:0}
  #bouton span{display:inline-block;
      background:linear-gradient(100deg,#fbc44e 4%,#f7a03c 50%,#ef7526 96%);
      color:#0a1020;font-weight:700;font-size:40px;padding:28px 60px;
      border-radius:999px}
  </style>

  <div id="chrono">0,000</div>
  <div id="distance">${args.epreuve} mètres</div>

  <div class="piste" id="p1">
    <div class="etiq">Sprinter Game · ${echappe(meilleur.name)}</div>
    <div class="trainee" id="t1"></div><div class="arrivee"></div>
    <div class="coureur" id="c1"></div>
  </div>
  <div class="piste" id="p2">
    <div class="etiq">Record du monde · ${echappe(rm.qui)}</div>
    <div class="trainee" id="t2"></div><div class="arrivee"></div>
    <div class="coureur" id="c2"></div>
    <div id="mesure"></div><div id="mesureTexte"></div>
  </div>

  <div class="centre" id="kicker"></div>
  <div class="centre" id="titre"></div>
  <div class="centre" id="sous"></div>
  <div id="bouton"><span>sprinter-game.com</span></div>

<script>
const D = ${D}, tJeu = ${tJeu}, tMonde = ${tMonde}, retard = ${retard};
const SOUS = ${JSON.stringify(ton.sous)}, RESPECT = ${JSON.stringify(ton.respect)};
const QUI = ${JSON.stringify(rm.qui)};
const T = ${JSON.stringify(T)};
const LARGEUR = 1080 - 160;      // la piste, bord a bord

const el = id => document.getElementById(id);
const entre = (t, [a, b]) => t >= a && t <= b;
// Progression douce d'une fenetre : sert aux fondus, jamais a la course elle
// meme — un coureur qui accelere a l'ecran fausserait la lecture de l'ecart.
const fondu = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const adouci = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;

function pose(coureur, trainee, metres) {
  const x = Math.min(metres / D, 1) * LARGEUR;
  el(coureur).style.left = x + 'px';
  el(trainee).style.width = x + 'px';
}

window.rendre = function (t) {
  for (const id of ['kicker','titre','sous','bouton','mesure','mesureTexte'])
    el(id).style.opacity = 0;

  // --- INTRO : les couloirs se presentent, personne ne bouge encore
  if (entre(t, T.intro)) {
    pose('c1','t1',0); pose('c2','t2',0);
    el('chrono').textContent = '0,000';
    el('kicker').style.opacity = adouci(fondu(t, .2, .9));
    el('kicker').innerHTML = 'Deux records.<br>Une seule piste.';
    return;
  }

  // --- COURSE : le temps de course est etire sur la fenetre de film
  if (entre(t, T.course)) {
    const p = fondu(t, T.course[0], T.course[1]);
    const tc = p * tMonde;                     // seconde de course
    pose('c1','t1', Math.min(tc * (D / tJeu), D));
    pose('c2','t2', tc * (D / tMonde));
    // Le chrono s'arrete quand le premier franchit la ligne : c'est SON
    // chrono qu'on veut garder a l'ecran, pas celui de l'autre.
    el('chrono').textContent = Math.min(tc, tJeu).toFixed(3).replace('.', ',');
    el('chrono').style.color = tc >= tJeu ? '#f7a93f' : '#e6ecf6';
    return;
  }

  // --- VERDICT : tout est fige, on mesure ce qui reste
  pose('c1','t1', D);
  el('chrono').textContent = tJeu.toFixed(3).replace('.', ',');
  el('chrono').style.color = '#f7a93f';

  if (entre(t, T.verdict)) {
    const restant = D - retard;
    pose('c2','t2', restant);
    const x = (restant / D) * LARGEUR;
    const o = adouci(fondu(t, T.verdict[0] + .15, T.verdict[0] + .8));
    const m = el('mesure');
    m.style.opacity = o; m.style.left = x + 'px';
    m.style.width = (LARGEUR - x) + 'px'; m.style.top = '50%';
    const mt = el('mesureTexte');
    mt.style.opacity = o; mt.style.left = x + 'px';
    mt.style.width = (LARGEUR - x) + 'px'; mt.style.top = 'calc(50% + 18px)';
    mt.textContent = Math.round(retard) + ' m';
    el('kicker').style.opacity = adouci(fondu(t, T.verdict[0] + .7, T.verdict[0] + 1.4));
    el('kicker').innerHTML =
      'Quand le nôtre franchit la ligne,<br>il lui reste ' + Math.round(retard) + ' mètres.';
    return;
  }

  // --- FIN : le titre et le lien
  pose('c2','t2', D - retard);
  const o = adouci(fondu(t, T.fin[0], T.fin[0] + .6));
  el('titre').style.opacity = o;
  el('titre').textContent = Math.round(retard) + ' MÈTRES';
  el('sous').style.opacity = o;
  el('sous').innerHTML = SOUS +
    (RESPECT ? '<br><span style="color:#7e8da6;font-size:34px">' +
       QUI + ', lui, l’a fait pour de vrai.<br>' + RESPECT + '</span>' : '');
  el('bouton').style.opacity = adouci(fondu(t, T.fin[0] + .5, T.fin[0] + 1.1));
};
window.rendre(0);
</script>`;
}

/* ------------------------------------------------------------------- le rendu */
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sprinter-ecart-'));
const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});
const onglet = await navigateur.newPage();
await onglet.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await onglet.setContent(scene(), { waitUntil: 'load' });

process.stdout.write(`  rendu ${nbImages} images `);
for (let i = 0; i < nbImages; i++) {
  await onglet.evaluate(t => window.rendre(t), i / args.fps);
  await onglet.screenshot({
    path: path.join(TMP, `f${String(i).padStart(4, '0')}.png`), type: 'png',
  });
  if (i % 60 === 0) process.stdout.write('.');
}
process.stdout.write('\n');
await navigateur.close();

const nom = args.nom || `ecart-${args.epreuve}${args.femmes ? 'f' : ''}`;
fs.mkdirSync(SORTIE_VIDEO, { recursive: true });
const sortie = path.join(SORTIE_VIDEO, `${nom}.mp4`);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error',
  '-framerate', String(args.fps), '-i', path.join(TMP, 'f%04d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', sortie], { stdio: 'inherit' });
fs.rmSync(TMP, { recursive: true, force: true });

console.log(`
  ${path.relative(RACINE, sortie)}   ${(fs.statSync(sortie).size / 1048576).toFixed(1)} Mo, ${DUREE.toFixed(0)} s

  ${args.epreuve} m — ${virgule(tJeu)} s (${meilleur.name})  contre  ${virgule(tMonde, 2)} s (${rm.qui})
  A l'arrivee du premier, il reste ${retard.toFixed(1)} m au second.

Pas de son : pose une musique au moment de publier.
`);
