/* ===========================================================================
   LE TEASER D'HALLOWEEN — « La nuit du molosse », 19 au 31 octobre.

     node tools/teaser-halloween.mjs            # FR et EN, film + affiches
     node tools/teaser-halloween.mjs --fr       # une seule langue
     node tools/teaser-halloween.mjs --apercu   # quelques images fixes, pas de film

   Sort dans communication/halloween/ :
     teaser-halloween-fr.mp4 · -en.mp4      1080 x 1920, 30 i/s, 20,5 s, AAC
     affiche-fr-story.jpg · -feed.jpg       la derniere image, 1080 x 1920 et 1080 x 1350
     (et les memes en -en)

   AUCUNE IMAGE FABRIQUEE ICI. Tout ce qu'on voit vient du jeu : les dix
   cartes des scenettes rendues dans Unity (src/assets/molosse-cartes), la
   tete de la bete et l'affiche de victoire (src/assets/molosse-*.webp). Les
   textes sont ceux du mode — la regle (hw_regle), la promesse de la
   banderole (hw_sous), le titre — et pas une phrase de plus : un teaser qui
   promettrait ce que le jeu ne tient pas se paie le 19 au soir.

   LA MUSIQUE EST CELLE DU MODE (src/assets/molosse.mp3), et c'est elle qui
   fait le montage. Le morceau est a 152 a la noire et n'a qu'un seul passage
   creux : le break des mesures 17 a 20, de 25,26 s a 31,56 s (mesure ici a
   l'oreille du RMS, voir plus bas). Le film part dans ce creux et la bete
   tombe sur la reprise :

     0,00 — 6,30   le break : trois phrases de la regle, quatre images lentes
     6,30          la reprise : la tete, un eclair rouge, la camera qui tremble
     6,30 — 14,20  une coupe par mesure (1,579 s) : TREIZE NUITS / UNE BETE /
                   ET LE TEMPS QU'IL TE RESTE / UNE NUIT PAR JOUR
     14,20 — 20,52 l'affiche : le titre, puis les dates, puis l'adresse

   Si la partition change (tools/musique/molosse-partition.py), ce sont
   DEBUT_MUSIQUE et REPRISE qu'il faut remesurer, et tout le reste suit.

   LE DESSIN SE FAIT DANS LE NAVIGATEUR, image par image, dans un canvas :
   les polices du jeu (Outfit, Plus Jakarta Sans, Space Mono) et les couleurs
   du panneau des nuits (Halloween.tsx) y sont chez elles, et une fonction
   `dessiner(t)` deterministe se rejoue a l'identique. ffmpeg ne fait que
   coller les images et la musique.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/halloween');

const ARGS = process.argv.slice(2);
const APERCU = ARGS.includes('--apercu');
const LANGUES = ARGS.includes('--fr') ? ['fr'] : ARGS.includes('--en') ? ['en'] : ['fr', 'en'];

/** Playwright, la ou il est : dans le depot, ou installe globalement. */
function trouverPlaywright() {
  const essais = [RACINE, '/opt/node22/lib/node_modules/', process.env.NODE_PATH].filter(Boolean);
  for (const base of essais) {
    try { return createRequire(path.join(base, 'x.js'))('playwright'); } catch { /* suivant */ }
  }
  console.error('Playwright introuvable. npm i -g playwright (et son Chromium), puis relance.');
  process.exit(1);
}
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

// --- le temps du film, en secondes ----------------------------------------
const FPS = 30;
const NOIRE = 60 / 152;
const MESURE = 4 * NOIRE;            // 1,579 s
const DEBUT_MUSIQUE = 25.26;         // le break commence (mesure 17)
const REPRISE = 6.30;                // 31,56 s dans le morceau : tout revient
const FIN = REPRISE + 9 * MESURE;    // 20,51 s, sur une barre de mesure

// --- les mots ---------------------------------------------------------------
// Repris du mode, mot pour mot : hw_regle (decoupee en trois), hw_sous
// (decoupee en trois), hw_titre, hw_sur, hw_cal_sous.
const MOTS = {
  fr: {
    regle: ['Un molosse part\nderrière toi.', 'Il franchira la ligne\nà la seconde près.', 'Passe-la\navant lui.'],
    cartes: ['TREIZE\nNUITS', 'UNE\nBÊTE', 'ET LE TEMPS\nQU’IL TE\nRESTE', 'UNE NUIT\nPAR JOUR'],
    sur: 'SPRINTER · ÉDITION LIMITÉE',
    titre: 'LA NUIT\nDU MOLOSSE',
    dates: 'DU 19 AU 31 OCTOBRE',
    sous: 'Au casque, c’est pire.',
    adresse: 'sprinter-game.com',
  },
  en: {
    regle: ['A hound starts\nbehind you.', 'It will cross the line\non the exact second.', 'Get there\nfirst.'],
    cartes: ['THIRTEEN\nNIGHTS', 'ONE\nBEAST', 'AND THE TIME\nYOU HAVE\nLEFT', 'ONE NIGHT\nA DAY'],
    sur: 'SPRINTER · LIMITED EDITION',
    titre: 'THE HOUND’S\nNIGHT',
    dates: '19 – 31 OCTOBER',
    sous: 'Headphones make it worse.',
    adresse: 'sprinter-game.com',
  },
};

// --- les images ---------------------------------------------------------------
const IMAGES = {
  empreintes: 'src/assets/molosse-cartes/empreintes.webp',
  faim: 'src/assets/molosse-cartes/faim.webp',
  odeur: 'src/assets/molosse-cartes/odeur.webp',
  miroir: 'src/assets/molosse-cartes/miroir.webp',
  porte: 'src/assets/molosse-cartes/porte.webp',
  appel: 'src/assets/molosse-cartes/appel.webp',
  chrono: 'src/assets/molosse-cartes/chrono.webp',
  traces: 'src/assets/molosse-cartes/traces.webp',
  tete: 'src/assets/molosse-tete.webp',
  victoire: 'src/assets/molosse-victoire.webp',
};
const POLICES = [
  ['Outfit', 700, 'public/fonts/Outfit-700-latin.woff2'],
  ['Outfit', 900, 'public/fonts/Outfit-900-latin.woff2'],
  ['Jakarta', 500, 'public/fonts/PlusJakartaSans-500-latin.woff2'],
  ['Jakarta', 700, 'public/fonts/PlusJakartaSans-700-latin.woff2'],
  ['Mono', 700, 'public/fonts/SpaceMono-700-latin.woff2'],
];
const enDonnee = (rel, type) =>
  `data:${type};base64,${fs.readFileSync(path.join(RACINE, rel)).toString('base64')}`;

// =============================================================================
// Ce qui suit tourne DANS LA PAGE. Pas de fermeture sur le reste du fichier :
// tout ce dont la fonction a besoin lui est passe en argument.
// =============================================================================
function installer({ W, H, mots, temps }) {
  const { NOIRE, MESURE, REPRISE, FIN } = temps;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const img = window.__images;
  const HISTOIRE = H === 1920; // le format vertical ; sinon 1080 x 1350

  // Les couleurs du panneau des nuits (Halloween.tsx).
  const ORANGE = '#F8A02E', BRAISE = '#E86826', VERT = '#7CD04E',
    CREME = '#F4E6D8', ECLAIR = '#C0140A', NUIT = '#08050C';

  const c01 = (x) => Math.max(0, Math.min(1, x));
  const lisse = (x) => { x = c01(x); return x * x * (3 - 2 * x); };
  const sortie = (x) => { x = c01(x); return 1 - Math.pow(1 - x, 4); };
  // un bruit deterministe : la meme image a chaque rendu
  const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

  // Le grain : quatre plaques tirees une fois, alternees a chaque image.
  const grains = [0, 1, 2, 3].map((k) => {
    const g = document.createElement('canvas'); g.width = 270; g.height = 480;
    const gx = g.getContext('2d'); const d = gx.createImageData(270, 480);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = hash(i * 0.37 + k * 1013) * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    gx.putImageData(d, 0, 0); return g;
  });

  /** Une image en « cover », zoomee de z, decalee de (dx, dy). */
  function couvrir(im, z = 1, dx = 0, dy = 0, alpha = 1) {
    const s = Math.max(W / im.width, H / im.height) * z;
    const w = im.width * s, h = im.height * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
    ctx.globalAlpha = 1;
  }

  function f(famille, graisse) { return { famille, graisse }; }
  function ecrire(lignes, x, y, o) {
    ctx.save();
    const { famille, graisse } = o.f;
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(x, y); ctx.scale(o.echelle ?? 1, o.echelle ?? 1);
    ctx.font = `${graisse} ${o.taille}px ${famille}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${o.espace ?? 0}px`;
    const L = lignes.split('\n');
    // une ligne trop large (l'anglais, souvent) se resserre au lieu de sortir
    const large = Math.max(...L.map((l) => ctx.measureText(l).width));
    const marge = W - 110;
    if (large > marge) { const r = marge / large; ctx.scale(r, r); }
    const pas = o.taille * (o.interligne ?? 1.05);
    for (let i = 0; i < L.length; i++) {
      const yy = (i - (L.length - 1) / 2) * pas;
      ctx.fillStyle = o.couleur;
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = o.taille * 0.4;
      ctx.fillText(L[i], 0, yy);
      if (o.lueur) { ctx.shadowColor = o.lueur; ctx.shadowBlur = o.taille * 0.3; ctx.fillText(L[i], 0, yy); }
      ctx.shadowBlur = 0; ctx.fillText(L[i], 0, yy);
    }
    ctx.restore();
  }

  function vignette(force = 0.75) {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${force})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function degradeBas(depuis, force = 0.92) {
    const g = ctx.createLinearGradient(0, depuis, 0, H);
    g.addColorStop(0, 'rgba(8,5,12,0)'); g.addColorStop(0.55, `rgba(8,5,12,${force * 0.8})`);
    g.addColorStop(1, `rgba(8,5,12,${force})`);
    ctx.fillStyle = g; ctx.fillRect(0, depuis, W, H - depuis);
  }
  function voile(couleur, a) { if (a <= 0) return; ctx.globalAlpha = c01(a); ctx.fillStyle = couleur; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  // --- le break : quatre plans lents, fondus, trois phrases de la regle -----
  const LENTS = [
    { im: 'empreintes', a: 0.00, b: 1.95, z: [1.16, 1.05], dy: [40, -20] },
    { im: 'faim',       a: 1.95, b: 3.85, z: [1.04, 1.14], dy: [0, 30] },
    { im: 'odeur',      a: 3.85, b: 5.40, z: [1.06, 1.16], dy: [0, 0] },
    { im: 'miroir',     a: 5.40, b: 6.12, z: [1.10, 1.26], dy: [60, 110] },
  ];
  const FONDU = 0.45;
  function planLent(p, t, alpha) {
    const k = (t - p.a) / (p.b - p.a + FONDU);
    couvrir(img[p.im], p.z[0] + (p.z[1] - p.z[0]) * k, 0, p.dy[0] + (p.dy[1] - p.dy[0]) * k, alpha);
  }
  function lePremierTemps(t) {
    for (let i = 0; i < LENTS.length; i++) {
      const p = LENTS[i];
      if (t < p.a || t >= p.b + FONDU) continue;
      // le plan suivant monte par-dessus celui-ci pendant FONDU
      const a = i === 0 ? lisse(t / 0.8) : lisse((t - p.a) / FONDU);
      planLent(p, t, a);
    }
    // les yeux dans le miroir : le noir se referme dessus avant la reprise
    voile('#000', lisse((t - 5.85) / 0.27));
    degradeBas(H * 0.55, 0.85);
    vignette(0.8);
    // les trois phrases, une par plan, la quatrieme image muette
    for (let i = 0; i < 3; i++) {
      const p = LENTS[i];
      const a = lisse((t - p.a - 0.25) / 0.35) * (1 - lisse((t - p.b + 0.05) / 0.3));
      if (a <= 0) continue;
      ecrire(mots.regle[i], W / 2, HISTOIRE ? H * 0.70 : H * 0.72, {
        f: f('Outfit', 700), taille: 74, couleur: CREME, interligne: 1.12, alpha: a,
        echelle: 1 + 0.03 * (t - p.a),
      });
    }
  }

  // --- la reprise : la tete --------------------------------------------------
  function laBete(t) {
    const u = t - REPRISE;
    const z = 1.42 - 0.34 * sortie(u / 0.24) + 0.05 * c01(u / MESURE);
    const amp = 34 * Math.exp(-u * 5.5);
    const dx = amp * Math.sin(u * 61), dy = amp * Math.cos(u * 47);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const im = img.tete;
    const cote = 1560 * z;
    ctx.drawImage(im, (W - cote) / 2 + dx, H * 0.47 - cote / 2 + dy, cote, cote);
    // le rouge reste un peu dans l'image apres l'eclair
    ctx.globalCompositeOperation = 'multiply';
    voile('#ff5a4a', 0.35);
    ctx.globalCompositeOperation = 'source-over';
    voile(ECLAIR, 0.72 * (1 - sortie(u / 0.42)));
    vignette(0.9);
  }

  // --- une coupe par mesure : les quatre cartes ------------------------------
  const CARTES = [
    { im: 'porte',  z: [1.10, 1.18], dy: [0, -20] },
    { im: 'appel',  z: [1.06, 1.14], dy: [80, 60] },
    { im: 'chrono', z: [1.18, 1.30], dy: [-60, -40] },
    { im: 'traces', z: [1.04, 1.12], dy: [0, -30] },
  ];
  function lesCartes(t) {
    const i = Math.floor((t - REPRISE - MESURE) / MESURE);
    const c = CARTES[i]; const a = REPRISE + MESURE * (i + 1);
    const u = (t - a) / MESURE;
    const coup = 1 - sortie((t - a) / 0.3); // le coup de poing a la coupe
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    couvrir(img[c.im], c.z[0] + (c.z[1] - c.z[0]) * u + 0.07 * coup, 0, c.dy[0] + (c.dy[1] - c.dy[0]) * u);
    voile('#000', 0.18);
    degradeBas(H * 0.5, 0.8);
    vignette(0.85);
    voile('#000', 0.75 * (1 - sortie((t - a) / 0.14)));
    const n = mots.cartes[i].split('\n').length;
    const taille = n >= 3 ? 128 : 168;
    ecrire(mots.cartes[i], W / 2, H * (HISTOIRE ? 0.70 : 0.72), {
      f: f('Outfit', 900), taille, couleur: ORANGE, lueur: 'rgba(255,90,20,0.75)',
      interligne: 0.98, espace: 2, echelle: 1.14 - 0.14 * sortie((t - a) / 0.22) + 0.03 * u,
    });
  }

  // --- l'affiche --------------------------------------------------------------
  function lAffiche(t) {
    const a = REPRISE + 5 * MESURE;
    const u = (t - a) / (FIN - a);
    ctx.fillStyle = NUIT; ctx.fillRect(0, 0, W, H);
    if (HISTOIRE) couvrir(img.victoire, 1.10 + 0.07 * u, 0, -150);
    else couvrir(img.victoire, 1.0 + 0.04 * u, 0, 0);
    voile('#000', 0.75 * (1 - sortie((t - a) / 0.2)));
    degradeBas(HISTOIRE ? H * 0.50 : H * 0.55, 0.96);
    vignette(0.7);

    const B = HISTOIRE ? 1585 : H - 60;   // le bas du bloc de texte
    const apparait = (d, duree = 0.45) => lisse((t - a - d) / duree);
    ecrire(mots.sur, W / 2, B - (HISTOIRE ? 500 : 345), {
      f: f('Mono', 700), taille: HISTOIRE ? 30 : 26, couleur: VERT, espace: 7, alpha: apparait(0.15),
    });
    ecrire(mots.titre, W / 2, B - (HISTOIRE ? 345 : 225), {
      f: f('Outfit', 900), taille: HISTOIRE ? 142 : 104, couleur: ORANGE, lueur: 'rgba(255,90,20,0.7)',
      interligne: 0.95, alpha: apparait(0.05, 0.3), echelle: 1.08 - 0.08 * sortie((t - a) / 0.5) + 0.02 * u,
    });
    ecrire(mots.dates, W / 2, B - (HISTOIRE ? 170 : 85), {
      f: f('Outfit', 700), taille: HISTOIRE ? 58 : 46, couleur: CREME, espace: 5, alpha: apparait(MESURE),
    });
    // le feed n'a pas la place : l'avertissement n'y est pas
    if (HISTOIRE) ecrire(mots.sous, W / 2, B - 100, {
      f: f('Jakarta', 500), taille: 36, couleur: 'rgba(244,230,216,0.72)', alpha: apparait(MESURE + 0.35),
    });
    ecrire(mots.adresse, W / 2, B - (HISTOIRE ? 10 : 20), {
      f: f('Mono', 700), taille: HISTOIRE ? 40 : 34, couleur: ORANGE, espace: 2, alpha: apparait(2 * MESURE),
    });
    // un reel boucle : la fin se ferme au noir pour que le saut ne se lise pas
    // comme un accroc
    voile('#000', lisse((t - (FIN - 0.45)) / 0.45));
  }

  window.dessiner = function (t) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (t < REPRISE) lePremierTemps(t);
    else if (t < REPRISE + MESURE) laBete(t);
    else if (t < REPRISE + 5 * MESURE) lesCartes(t);
    else lAffiche(t);
    // le grain, par-dessus tout
    ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grains[Math.floor(t * 15) % 4], 0, 0, W, H); // a 15 i/s : un grain de film, et deux fois moins lourd a encoder
    ctx.restore();
  };
  window.image = (type = 'image/jpeg', q = 0.92) => cv.toDataURL(type, q);
}

// =============================================================================
async function main() {
  const { chromium } = trouverPlaywright();
  fs.mkdirSync(SORTIE, { recursive: true });
  const navigateur = await chromium.launch();
  const temps = { NOIRE, MESURE, REPRISE, FIN };

  const images = Object.fromEntries(Object.entries(IMAGES).map(([k, rel]) => [k, enDonnee(rel, 'image/webp')]));
  const polices = POLICES.map(([famille, graisse, rel]) => ({ famille, graisse, url: enDonnee(rel, 'font/woff2') }));

  async function page(W, H, langue) {
    const p = await navigateur.newPage({ viewport: { width: 400, height: 400 } });
    await p.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
    await p.evaluate(async ({ images, polices }) => {
      for (const { famille, graisse, url } of polices) {
        const ff = new FontFace(famille, `url(${url})`, { weight: String(graisse) });
        document.fonts.add(await ff.load());
      }
      window.__images = {};
      await Promise.all(Object.entries(images).map(([k, src]) => new Promise((ok, ko) => {
        const im = new Image(); im.onload = () => { window.__images[k] = im; ok(); }; im.onerror = ko; im.src = src;
      })));
    }, { images, polices });
    await p.evaluate(`(${installer.toString()})(${JSON.stringify({ W, H, mots: MOTS[langue], temps })})`);
    return p;
  }
  const ecrireImage = (dataUrl, fichier) =>
    fs.writeFileSync(fichier, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const rendre = (p, t, type, q) => p.evaluate(([t, type, q]) => { window.dessiner(t); return window.image(type, q); }, [t, type, q]);

  for (const langue of LANGUES) {
    const histoire = await page(1080, 1920, langue);
    const feed = await page(1080, 1350, langue);
    const tAffiche = FIN - 0.6;

    ecrireImage(await rendre(histoire, tAffiche, 'image/jpeg', 0.93), path.join(SORTIE, `affiche-${langue}-story.jpg`));
    ecrireImage(await rendre(feed, tAffiche, 'image/jpeg', 0.93), path.join(SORTIE, `affiche-${langue}-feed.jpg`));
    console.log(`✓ affiches ${langue}`);

    if (APERCU) {
      const dossier = path.join(SORTIE, `_apercu-${langue}`);
      fs.mkdirSync(dossier, { recursive: true });
      for (const t of [1.0, 2.9, 4.6, 5.9, REPRISE + 0.05, REPRISE + 0.5, 8.6, 10.2, 11.8, 13.4, 15.0, 17.5]) {
        ecrireImage(await rendre(histoire, t, 'image/jpeg', 0.85), path.join(dossier, `t${t.toFixed(2)}.jpg`));
      }
      console.log(`✓ apercu ${langue} → ${path.relative(RACINE, dossier)}`);
      continue;
    }

    // --- le film : les images partent dans ffmpeg par un tuyau, sans disque
    const fichier = path.join(SORTIE, `teaser-halloween-${langue}.mp4`);
    const images = Math.round(FIN * FPS);
    const ff = spawn(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-ss', String(DEBUT_MUSIQUE), '-t', String(FIN), '-i', path.join(RACINE, 'src/assets/molosse.mp3'),
      '-filter_complex',
      // un coup sourd sous la reprise, pour que la bete tombe aussi dans les basses
      `aevalsrc='0.9*sin(2*PI*(46+30*exp(-t*9))*t)*exp(-t*3.2)':s=48000:d=1.6,adelay=${Math.round(REPRISE * 1000)}|${Math.round(REPRISE * 1000)},aformat=channel_layouts=stereo[coup];`
      + `[1:a]aresample=48000,afade=t=in:d=0.12,afade=t=out:st=${(FIN - 1.8).toFixed(2)}:d=1.8[mus];`
      + `[mus][coup]amix=inputs=2:normalize=0,alimiter=limit=0.79:level=disabled[a]`,
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', fichier,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const fini = new Promise((ok, ko) => ff.on('close', (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg ${c}`)))));
    for (let i = 0; i < images; i++) {
      const d = await rendre(histoire, i / FPS, 'image/jpeg', 0.95);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`\r  ${langue} ${i}/${images}`);
    }
    ff.stdin.end();
    await fini;
    console.log(`\r✓ ${path.relative(RACINE, fichier)} (${(fs.statSync(fichier).size / 1e6).toFixed(1)} Mo)`);
    await histoire.close(); await feed.close();
  }
  await navigateur.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
