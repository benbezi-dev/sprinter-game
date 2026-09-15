/* ===========================================================================
   La carte d'annonce : le contenu vient d'un fichier, le dessin vient du jeu.

   Les deux autres outils lisent l'API parce qu'ils portent des chronos qui
   vieillissent en quelques heures. Celui-ci porte des REGLES — une date
   d'ouverture, un format de competition, un nombre de places — qui ne
   vieillissent pas de la journee. Elles s'ecrivent donc a la main, dans un
   fichier JSON qu'on relit avant de publier.

     node tools/carte-annonce.mjs communication/annonces/qualifications.json
     node tools/carte-annonce.mjs communication/annonces/teaser-championnat.json --video

   Le JSON decrit une suite d'ecrans ; chacun sort en -feed (1080 x 1350) et
   en -story (1080 x 1920) :

     { "nom": "qualifs",
       "ecrans": [
         { "cle": "places", "kicker": "…", "titre": "32 PLACES", "sous": "…",
           "lignes": [{ "gauche": "32", "droite": "partants" }],
           "fort": "…", "doux": "…" }
       ] }

   Un `\n` dans un texte est un retour a la ligne voulu. Un champ `bouton`
   est ignore : le pied porte deja @sprintergame. A la racine, `pied`
   remplace « JEU DE SPRINT » dans la signature (« SPRINT GAME » en anglais).

   Avec --video, les memes ecrans sortent aussi en film vertical, dans
   communication/annonces/video-1080x1920/<nom>.mp4 — voir plus bas.

   LE DESSIN N'EST PAS ICI. Il est dans `dessinerAnnonce`, de
   src/game/trace-affiche.js — le fichier qui dessine deja le chrono de la
   semaine, sa story, et l'image que le joueur partage. Cet outil ne fait que
   charger les polices du jeu, appeler la fonction et ecrire les fichiers. La
   version precedente composait sa propre page HTML, avec son orange et sa
   typo a elle : a cote d'une carte de chrono, le fil montrait deux marques.

   Publiees dans l'ordre, les images forment un carrousel Instagram. Pour des
   regles, il reste le meilleur support : on peut y revenir en arriere. Le
   film sert la ou un carrousel ne passe pas — la story, TikTok, le Reel.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');

const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const FFMPEG = path.join(RACINE, 'assets-stores/promo/node_modules/ffmpeg-static/ffmpeg');

const ARGS = process.argv.slice(2);
const fichier = ARGS.find(a => !a.startsWith('--'));
const VIDEO = ARGS.includes('--video');
if (!fichier) {
  console.error(`
Donne le fichier d'annonce.

    node tools/carte-annonce.mjs communication/annonces/qualifications.json
    node tools/carte-annonce.mjs communication/annonces/qualifications.json --video
`);
  process.exit(1);
}
const chemin = path.isAbsolute(fichier) ? fichier : path.join(RACINE, fichier);
if (!fs.existsSync(chemin)) {
  console.error(`Fichier introuvable : ${path.relative(RACINE, chemin)}`);
  process.exit(1);
}

let annonce;
try { annonce = JSON.parse(fs.readFileSync(chemin, 'utf8')); }
catch (e) { console.error(`JSON illisible : ${e.message}`); process.exit(1); }

const ecrans = (Array.isArray(annonce.ecrans) ? annonce.ecrans : [])
  .map(e => (annonce.pied ? { pied: annonce.pied, ...e } : e));
if (!ecrans.length) { console.error('Aucun ecran dans le fichier.'); process.exit(1); }

const NOM = annonce.nom || 'annonce';
const SORTIE = path.join(RACINE, 'communication/annonces', NOM);
const SORTIE_VIDEO = path.join(RACINE, 'communication/annonces/video-1080x1920');
const TRACE = fs.readFileSync(path.join(RACINE, 'src/game/trace-affiche.js'), 'utf8');

// Les graisses que `trace-affiche.js` demande : 500 et 700 pour les
// paragraphes, 600 pour le compte, 800 pour le surtitre, 900 pour le titre,
// Space Mono 700 pour les valeurs. Les memes familles que src/index.css.
const POLICES = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900' +
                '&family=Space+Mono:wght@400;700&display=block';
const VOULUES = ['500 40px Outfit', '600 40px Outfit', '700 40px Outfit', '800 40px Outfit',
                 '900 40px Outfit', '700 40px "Space Mono"'];

// Tout le texte du fichier : les polices de Google sont decoupees par plages
// de caracteres, et une plage qui n'est pas chargee au moment du trace sort
// en police de repli — le canvas ne se redessine pas quand elle arrive.
const TEXTE = JSON.stringify(ecrans) + ' @sprintergame SPRINTER JEU DE SPRINT SPRINT GAME';

/* ---------------------------------------------------------------------------
   LA VIDEO : les memes ecrans, en 1080 x 1920, qui se construisent.

   Un carrousel se lit a son rythme ; une story ou un Reel defile au sien.
   Chaque ecran entre donc bloc par bloc — le kicker, le titre, puis le reste
   en cascade — et reste le temps de le parcourir, compte en mots. Le fond et
   la signature ne bougent pas d'un ecran a l'autre : c'est la carte qui
   change, pas le stade.

   Le premier titre est deja pose a la premiere image : sur TikTok la premiere
   seconde decide, et un fond vide est une video qu'on passe.

   Sans son, comme les autres reels du compte : la musique se pose au moment
   de publier.
--------------------------------------------------------------------------- */
const FPS = 30;
const ENTREE = 0.5;     // un bloc met une demi-seconde a entrer
const CASCADE = 0.22;   // l'ecart entre deux blocs, une fois le titre lu
const SORTIE_S = 0.35;  // le fondu de la carte avant la suivante
const mots = s => String(s ?? '').split(/\s+/).filter(Boolean).length;

function planEcran(e, premier) {
  const blocs = [];
  if (e.kicker) blocs.push(['kicker', e.kicker]);
  if (e.titre) blocs.push(['titre', e.titre]);
  if (e.sous) blocs.push(['sous', e.sous]);
  (Array.isArray(e.lignes) ? e.lignes : [])
    .forEach((l, i) => blocs.push([`ligne${i}`, `${l.gauche} ${l.droite}`]));
  if (e.fort) blocs.push(['fort', e.fort]);
  if (e.doux) blocs.push(['doux', e.doux]);

  // Le titre suit le kicker presque aussitot ; ce qui suit le titre lui laisse
  // une demi-seconde, le temps qu'il soit lu, puis tombe en cascade.
  const debut = {};
  let t = 0;
  for (const [cle] of blocs) {
    debut[cle] = t;
    t += cle === 'kicker' ? 0.12 : cle === 'titre' ? 0.55 : CASCADE;
  }
  if (premier) for (const cle of ['kicker', 'titre']) if (cle in debut) debut[cle] = -ENTREE;

  // Onze centiemes de seconde par mot, entre 2,6 et 5,5 s : pas assez pour tout
  // lire d'une traite — le carrousel est la pour ca — assez pour que le titre,
  // les valeurs en or et la phrase en blanc passent.
  const total = blocs.reduce((n, [, texte]) => n + mots(texte), 0);
  const lecture = Math.min(5.5, Math.max(2.6, total * 0.11));
  const dernier = Math.max(...Object.values(debut));
  return { debut, duree: Math.max(0, dernier) + ENTREE + lecture + SORTIE_S };
}

function etat(plan, t) {
  const r = {};
  for (const [cle, d] of Object.entries(plan.debut)) {
    r[cle] = Math.round(Math.max(0, Math.min(1, (t - d) / ENTREE)) * 1000) / 1000;
  }
  const s = Math.max(0, Math.min(1, (t - (plan.duree - SORTIE_S)) / SORTIE_S));
  r.opacite = Math.round((1 - s * s * (3 - 2 * s)) * 1000) / 1000;
  return r;
}

async function rendreVideo(onglet) {
  const plans = ecrans.map((e, i) => planEcran(e, i === 0));
  const bornes = [];
  let t0 = 0;
  for (const p of plans) { bornes.push(t0); t0 += p.duree; }
  const nbImages = Math.round(t0 * FPS);

  const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sprinter-annonce-'));
  await onglet.evaluate(() => { window.CADRE = document.createElement('canvas'); });
  // Pendant qu'une carte se lit, l'image ne change pas : on la trace une fois
  // et on la relie, au lieu de retracer et reencoder cent fois le meme PNG.
  const deja = new Map();
  let traces = 0;
  process.stdout.write(`\n  video : ${nbImages} images `);
  try {
    for (let i = 0; i < nbImages; i++) {
      const t = i / FPS;
      let k = plans.length - 1;
      while (k > 0 && t < bornes[k]) k--;
      const revele = etat(plans[k], t - bornes[k]);
      const cle = `${k}|${JSON.stringify(revele)}`;
      const nom = path.join(TMP, `f${String(i).padStart(5, '0')}.png`);
      if (deja.has(cle)) { fs.linkSync(deja.get(cle), nom); continue; }
      const png = await onglet.evaluate((e, r) => {
        window.TRACE.dessinerAnnonce(window.CADRE, e, 'story', {}, r);
        return window.CADRE.toDataURL('image/png');
      }, ecrans[k], revele);
      fs.writeFileSync(nom, Buffer.from(png.split(',')[1], 'base64'));
      deja.set(cle, nom);
      if (++traces % 40 === 0) process.stdout.write('.');
    }
    process.stdout.write(` (${traces} tracees)\n`);

    fs.mkdirSync(SORTIE_VIDEO, { recursive: true });
    const sortie = path.join(SORTIE_VIDEO, `${NOM}.mp4`);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', sortie], { stdio: 'inherit' });

    console.log(`  ${path.relative(RACINE, sortie)}   ${(fs.statSync(sortie).size / 1048576).toFixed(1)} Mo, ` +
                `${t0.toFixed(1).replace('.', ',')} s, sans son`);
    plans.forEach((p, i) => console.log(`    ${String(i + 1).padStart(2, '0')}-${ecrans[i].cle || 'ecran'}` +
      `  ${bornes[i].toFixed(1).replace('.', ',')} s → ${(bornes[i] + p.duree).toFixed(1).replace('.', ',')} s`));
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ le rendu */
fs.mkdirSync(SORTIE, { recursive: true });
const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});
try {
  const onglet = await navigateur.newPage();
  await onglet.setContent(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${POLICES}">`,
                          { waitUntil: 'networkidle0' });

  // Le module est importe tel quel, depuis un blob : pas de copie a
  // entretenir, et pas de serveur a lancer pour un fichier sans dependance.
  const manquantes = await onglet.evaluate(async (source, voulues, texte) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    window.TRACE = await import(url);
    await Promise.all(voulues.map(f => document.fonts.load(f, texte)));
    // `document.fonts.check` repond vrai pour une police qu'il ne connait pas :
    // on regarde plutot quelles faces sont reellement chargees.
    const chargees = new Set([...document.fonts].filter(f => f.status === 'loaded')
      .map(f => `${f.weight} ${f.family.replace(/"/g, '')}`));
    return voulues.filter(v => {
      const [poids, , ...famille] = v.split(' ');
      return !chargees.has(`${poids} ${famille.join(' ').replace(/"/g, '')}`);
    });
  }, TRACE, VOULUES, TEXTE);
  if (manquantes.length) {
    throw new Error(`Polices non chargees : ${manquantes.join(', ')}. Pas de rendu en police de repli.`);
  }

  for (let i = 0; i < ecrans.length; i++) {
    for (const format of ['feed', 'story']) {
      const { png, rapport } = await onglet.evaluate((e, f) => {
        const cv = document.createElement('canvas');
        const rapport = {};
        window.TRACE.dessinerAnnonce(cv, e, f, rapport);
        return { png: cv.toDataURL('image/png'), rapport };
      }, ecrans[i], format);
      const nom = `${String(i + 1).padStart(2, '0')}-${ecrans[i].cle || 'ecran'}-${format}.png`;
      fs.writeFileSync(path.join(SORTIE, nom), Buffer.from(png.split(',')[1], 'base64'));
      const note = rapport.deborde ? '   DEBORDE : texte trop long pour ce format'
                 : rapport.echelle < 1 ? `   reduite a ${Math.round(rapport.echelle * 100)} %` : '';
      console.log(`  ${path.relative(RACINE, path.join(SORTIE, nom))}${note}`);
    }
  }
  console.log(`\n  ${ecrans.length} écrans, feed + story, dans ${path.relative(RACINE, SORTIE)}`);

  if (VIDEO) await rendreVideo(onglet);
  console.log('');
} catch (e) {
  console.error(`\n  ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await navigateur.close();
}
