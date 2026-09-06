/* ===========================================================================
   LE SON — celui du jeu, rendu hors ligne.

   Le jeu ne joue aucun fichier : sa musique et ses bruitages sont synthetises
   a l'execution, dans des AudioBuffer construits par `sprinter-app.js`. Il n'y
   a donc rien a extraire d'un dossier — il faut les refaire.

   On echange le contexte audio du jeu contre un OfflineAudioContext, on lui
   demande de rebatir ses buffers dedans, et on rejoue la sequence exacte du
   reel : la boucle de course prise a l'endroit ou elle en est au debut de la
   capture, le coup de pistolet, le bip de la reaction, le bip de la
   transition, puis le silence a la coupe. Ce sont les memes ondes que celles
   qu'entend un joueur, aux memes instants.

     node son.mjs                                                          */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:4173/';
const m = JSON.parse(fs.readFileSync(path.join(ICI, 'course-mesuree.json'), 'utf8'));

// Les instants du reel, releves par la telemetrie du tournage.
const chrono = JSON.parse(fs.readFileSync(path.join(ICI, 'chronologie.json'), 'utf8'));
const reel = f => f / m.fps;
const trouve = (pred) => { const e = chrono.find(pred); return e ? reel(e.f) : null; };
const T_PISTOLET   = trouve(e => e.state === 'race');
const T_REACTION   = trouve(e => e.carteReaction);
const T_TRANSITION = trouve(e => e.carteTransition);
const T_LIGNE      = m.imageLigne / m.fps;
const DUREE        = m.images / m.fps;
// Le compte a rebours a deja tourné AVANT_DEPART secondes de boucle quand la
// capture commence ; la musique demarre a l'entree dans le decompte, soit
// trois secondes avant le pistolet.
const DEJA = 3 - m.avantDepart + T_PISTOLET;

console.log('sequence du son (secondes de reel)');
console.log('  pistolet    ', T_PISTOLET.toFixed(3));
console.log('  reaction    ', T_REACTION.toFixed(3));
console.log('  transition  ', T_TRANSITION.toFixed(3));
console.log('  coupe       ', T_LIGNE.toFixed(3), '- la musique s arrete net');
console.log('  duree       ', DUREE.toFixed(3));

const nav = await puppeteer.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 540, height: 960 } });
const page = await nav.newPage();
page.on('pageerror', e => console.error('ERREUR PAGE:', e.message));
await page.goto(URL_JEU, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.SprinterApp', { timeout: 30000 });

const b64 = await page.evaluate(async (o) => {
  const A = window.SprinterApp.Audio_;
  const SR = 48000;
  const ctx = new OfflineAudioContext(1, Math.ceil(o.duree * SR), SR);
  // On rebatit les buffers DANS le contexte hors ligne : `build()` ne connait
  // que `this.ctx`, il suffit de le lui echanger.
  A.ctx = ctx; A.buf = {}; A.build();

  const musique = ctx.createGain();
  musique.gain.value = 0.34;              // le gain de la musique, dans le jeu
  musique.connect(ctx.destination);

  // La boucle de course du niveau 4 (Jeux olympiques), prise la ou elle en est.
  const piste = A.buf[A.raceTrack(4)];
  const src = ctx.createBufferSource();
  src.buffer = piste; src.loop = true;
  src.connect(musique);
  src.start(0, o.deja % piste.duration);
  // A LA COUPE, LE SON S'ARRETE NET. Le jeu ne donne rien au passage de la
  // ligne — il joue sa fanfare trois secondes plus tard, sur l'ecran de
  // resultat, soit bien apres la fin du reel. Le silence est donc la seule
  // ponctuation disponible, et c'est la bonne : il fait le point final, et il
  // recolle proprement quand Instagram reboucle.
  src.stop(o.ligne);

  const bruit = (nom, t) => {
    const b = A.buf[nom]; if (!b) return;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.value = 0.55;                  // le gain des bruitages, dans le jeu
    s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start(t);
  };
  bruit('go', o.pistolet);                // le coup de pistolet
  bruit('beep', o.reaction);              // le jeu accuse reception de la reaction
  bruit('win', o.transition);             // la note de transition

  const rendu = await ctx.startRendering();
  // WAV 16 bits, mono
  const n = rendu.length, d = rendu.getChannelData(0);
  const buf = new ArrayBuffer(44 + n * 2), vue = new DataView(buf);
  const txt = (p, s) => { for (let i = 0; i < s.length; i++) vue.setUint8(p + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); vue.setUint32(4, 36 + n * 2, true); txt(8, 'WAVEfmt ');
  vue.setUint32(16, 16, true); vue.setUint16(20, 1, true); vue.setUint16(22, 1, true);
  vue.setUint32(24, SR, true); vue.setUint32(28, SR * 2, true);
  vue.setUint16(32, 2, true); vue.setUint16(34, 16, true);
  txt(36, 'data'); vue.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, d[i]));
    vue.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let s = '', u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 8192)
    s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
}, { duree: DUREE, deja: DEJA, ligne: T_LIGNE, pistolet: T_PISTOLET,
     reaction: T_REACTION, transition: T_TRANSITION });

fs.writeFileSync(path.join(ICI, 'son.wav'), Buffer.from(b64, 'base64'));
console.log('\nson.wav ecrit —', (fs.statSync(path.join(ICI, 'son.wav')).size / 1024).toFixed(0), 'ko');
await nav.close();
