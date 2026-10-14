/* ---------------------------------------------------------------------------
   FILMER LA DEMONSTRATION — un seul plan, du chargement a froid a la ligne.

     npm run dev                            # dans un autre terminal
     node content/instagram/2026-09-14-reel-barre-adresse/filmer-la-demonstration.mjs

   CE QUE CE FILM EST, ET CE QU'IL N'EST PAS. Le conducteur demande un ecran de
   telephone FILME DE HAUT, avec une main qui tape l'adresse : c'est une preuve,
   et elle demande une camera. Ce fichier-ci ne remplace pas cette prise. Il
   enregistre l'ECRAN, en emulation telephone, depuis le chargement a froid de
   la page jusqu'au franchissement de la ligne — sans coupe, en une seule passe,
   avec un chronometre qui mesure exactement ce que l'image montre.

   Le chiffre qu'il donne est donc « de l'ouverture de la page a l'arrivee », et
   non « du premier caractere tape ». La legende doit dire cela et rien d'autre.
   LE CHIFFRE COMMANDE, LE TEXTE SUIT.

   POURQUOI PAS MEDIARECORDER. La machine de montage n'a pas de sortie audio :
   la lecture ne s'y clocke sur rien qui freine, et le banc d'essai a mesure une
   prise qui defile jusqu'a six fois trop vite. Un fichier sorti de la se donne
   une ligne de temps fausse. On passe donc par Page.startScreencast, qui
   horodate chaque image, on reechantillonne a cadence fixe, et on encode avec
   le ffmpeg du navigateur de test — image2pipe en entree, VP8 en sortie. La
   ligne de temps est alors construite, pas subie.

   LES POLICES SONT INJECTEES. fonts.googleapis.com n'est pas joignable d'ici :
   sans cela le jeu se rendrait en police de repli et le film serait a refaire.
   Les woff2 sont poses dans la page en data: URI, avant que sa feuille de style
   ne tente son import.
--------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { trouverChrome } from '../../../tools/chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SORTIE = process.env.SORTIE || path.join(ICI, 'banc-essai/demonstration');
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:5173/';
const POLICES = process.env.POLICES || '';
const FFMPEG = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const FPS = 25;
/* Quinze appuis par seconde : sept et demi par main, ce qu'une main atteint.
   Mesure a quatre cadences, le 100 m sort a 8,90 s a 15 Hz et 8,62 s a 40 Hz —
   on garde la cadence humaine, pas la meilleure. */
const CADENCE = Number(process.env.CADENCE || 15);

/* DEUX POINTS DE DEPART POSSIBLES, ET ILS NE RACONTENT PAS LA MEME CHOSE.
     MODE=page    le plan part au chargement a froid. Le chronometre mesure
                  « de l'ouverture de la page a l'arrivee ». Honnete, mais
                  l'ouverture du jeu est une animation de sept secondes : sur
                  une capture d'ecran ce sont sept secondes de logo fixe, et
                  la promesse « le temps de lire cette phrase » s'effondre.
     MODE=course  le plan part a l'accueil, le chronometre au moment ou le
                  doigt lance la course. Le plan reste d'un seul tenant — on
                  commence a filmer plus tard, on ne coupe rien dedans — et le
                  chiffre devient celui qui compte : du depart a la ligne.
   Le second n'a plus le droit de dire « de l'ouverture de la page » : sa
   legende dit ce qu'il mesure, et rien d'autre. */
const MODE = process.env.MODE === 'course' ? 'course' : 'page';
/* LA TAILLE DE CAPTURE, ET POURQUOI CELLE-LA.
   Page.startScreencast rend les pixels CSS du viewport et rien d'autre : le
   facteur d'echelle ne l'agrandit pas, maxWidth ne fait que contraindre. A
   360 x 640 on obtient donc un reel de la taille d'une vignette.
   Page.captureScreenshot, lui, rend bien 1080 x 1920 — a 6,7 images par
   seconde, ce qui ne filme pas une course.
   On capture donc a 720 x 1280, juste SOUS la bascule `md:` de Tailwind (768
   px), ce qui garde la mise en page du telephone, et on agrandit d'un facteur
   un et demi a l'encodage. Mesure : 45 images par seconde a cette taille. */
const LARGEUR = 720, HAUTEUR = 1280, FACTEUR = 1;
const L_SORTIE = 1080, H_SORTIE = 1920;

fs.mkdirSync(SORTIE, { recursive: true });
const dodo = ms => new Promise(ok => setTimeout(ok, ms));

/* ------------------------------------------------- les polices, en data: URI */
function cssPolices() {
  if (!POLICES) return '';
  const css = fs.readFileSync(path.join(POLICES, 'polices.css'), 'utf8');
  return css.replace(/url\(\.\/([^)]+\.woff2)\)/g, (_, f) => {
    const b64 = fs.readFileSync(path.join(POLICES, f)).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });
}

/* ------------------------------------------------------- le protocole Chrome */
const proc = spawn(trouverChrome(), [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
  '--no-first-run', '--disable-component-update', '--disable-background-networking',
  '--disable-features=Translate,OptimizationHints',
  `--user-data-dir=${fs.mkdtempSync('/tmp/film-')}`,
  '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((ok, ko) => {
  let t = ''; proc.stderr.on('data', d => { t += d; const m = /ws:\/\/[^\s]+/.exec(t); if (m) ok(m[0]); });
  proc.on('exit', c => ko(new Error(`Chrome s'est arrete (${c})`)));
  setTimeout(() => ko(new Error('pas de protocole')), 25000);
});
const ws = new WebSocket(wsUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));

let n = 0; const attentes = new Map();
const images = [];                    // { t (ms), jpeg (Buffer) }
let sid = null;

ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && attentes.has(m.id)) {
    const { ok, ko } = attentes.get(m.id); attentes.delete(m.id);
    m.error ? ko(new Error(m.error.message)) : ok(m.result);
  } else if (m.method === 'Page.screencastFrame') {
    images.push({ t: m.params.metadata.timestamp * 1000, jpeg: Buffer.from(m.params.data, 'base64') });
    cdp('Page.screencastFrameAck', { sessionId: m.params.sessionId }, sid).catch(() => {});
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('  page!', m.params.exceptionDetails.exception?.description?.split('\n')[0]);
  }
});
function cdp(methode, params = {}, s) {
  const id = ++n;
  return new Promise((ok, ko) => {
    attentes.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method: methode, params, ...(s ? { sessionId: s } : {}) }));
  });
}

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
({ sessionId: sid } = await cdp('Target.attachToTarget', { targetId, flatten: true }));
await cdp('Runtime.enable', {}, sid);
await cdp('Page.enable', {}, sid);
await cdp('Emulation.setDeviceMetricsOverride',
  { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: FACTEUR, mobile: true }, sid);
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sid);
/* LE TELEPHONE DU TOURNAGE EST FRANCAIS. Sans cela le jeu sort en anglais —
   « ONE SHOT COMPLETE », « RUN AGAIN » — et un compte francais publierait une
   demonstration dans une autre langue que la sienne. Emulation.setLocaleOverride
   ne suffit pas : c'est `navigator.language` que le jeu lit, et c'est
   l'en-tete de langue qui le fixe. */
await cdp('Network.enable', {}, sid);
await cdp('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
             'Chrome/131.0.0.0 Mobile Safari/537.36',
  acceptLanguage: 'fr-FR,fr;q=0.9',
}, sid);

const ev = async expr => (await cdp('Runtime.evaluate',
  { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result?.value;

/* --------------------------------------- le chronometre, pose dans la page */
/* Il est injecte AVANT tout script de la page, pour etre la des la premiere
   image : un chronometre qui apparait en cours de route ne mesure plus depuis
   le debut. `performance.now()` part de la navigation, et c'est exactement
   l'instant qu'on veut compter. */
const OVERLAY = `
(() => {
  const CSS = ${JSON.stringify(cssPolices())};
  const poser = () => {
    if (document.getElementById('__reel')) return;
    if (CSS) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
    const h = document.createElement('div');
    h.id = '__reel';
    h.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Outfit,sans-serif';
    h.innerHTML = \`
      <div style="position:absolute;left:0;right:0;top:8%;height:22%;
                  background:linear-gradient(to bottom,rgba(6,9,19,0),rgba(6,9,19,.80) 20%,rgba(6,9,19,.68) 72%,rgba(6,9,19,0))"></div>
      <div style="position:absolute;left:0;right:0;top:25%;transform:translateY(-50%);
           display:flex;align-items:baseline;justify-content:center;gap:.9vh;
           font:700 8.125vh 'Space Mono',monospace;color:#F8CD4A">
        <span id="__chrono" style="letter-spacing:-0.16vh">0,00</span><span style="font-size:1.9vh">s</span>
      </div>
      <div id="__carton" style="position:absolute;left:8%;right:8%;top:34%;text-align:center;
           font:800 3.9vh Outfit,sans-serif;color:#F8CD4A;text-transform:uppercase;letter-spacing:-0.06vh;
           line-height:1.14;opacity:0"></div>
      <div id="__carton2" style="position:absolute;left:8%;right:8%;top:76%;text-align:center;
           font:800 3.9vh Outfit,sans-serif;color:#F8CD4A;text-transform:uppercase;letter-spacing:-0.06vh;
           line-height:1.14;opacity:0"></div>
      <div style="position:absolute;left:8%;right:8%;bottom:28%;height:1px;background:rgba(255,255,255,.10)"></div>
      <div style="position:absolute;left:0;right:0;bottom:25%;text-align:center;
           font:500 1.56vh Outfit,sans-serif;color:rgba(255,255,255,.30);letter-spacing:0.11vh">@sprintergame</div>\`;
    document.documentElement.appendChild(h);

    const virgule = ms => (ms / 1000).toFixed(2).replace('.', ',');
    const chrono = h.querySelector('#__chrono');
    const carton = h.querySelector('#__carton');
    const carton2 = h.querySelector('#__carton2');
    const fondu = (t, d, f, dur = 220) => Math.max(0, Math.min(1, Math.min((t - d) / dur, (f - t) / dur)));
    window.__fige = null;
    window.__arme = true;          // MODE=page : il court des la premiere image
    const tic = () => {
      const depart = window.__depart || 0;
      const t = window.__fige != null ? window.__fige
              : (window.__arme ? Math.max(0, performance.now() - depart) : 0);
      chrono.textContent = virgule(t);
      // Carton d'ouverture : 0,2 -> 2,5 s. Carton de sortie : des que le chrono fige.
      if (window.__fige == null) {
        carton.textContent = 'Le temps de lire cette phrase';
        carton.style.opacity = fondu(t, 200, 2500);
        carton2.style.opacity = 0;
      } else {
        carton.style.opacity = 0;
        carton2.textContent = '… la course est déjà finie.';
        carton2.style.opacity = fondu(performance.now(), window.__figeA, window.__figeA + 3400);
      }
      requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
  };
  if (document.documentElement) poser();
  document.addEventListener('DOMContentLoaded', poser);
  new MutationObserver(poser).observe(document.documentElement || document, { childList: true });
})();`;
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: OVERLAY }, sid);

/* -------------------------------------------------------- le toucher reel */
/** Les commandes de menu s'ouvrent au clic du DOM, et pas au toucher
 *  synthetique : dispatchTouchEvent arrive bien sur la carte ONE SHOT, mais GO
 *  ne part pas. Essaye, mesure, garde ce qui marche. */
async function toucherTexte(mots) {
  for (const mot of [].concat(mots)) {
    const cherche = JSON.stringify(String(mot).toUpperCase());
    const fait = await ev(
      '(() => { const e = [...document.querySelectorAll("button,[role=button],a")].find(x =>' +
      ' x.offsetParent !== null && (x.innerText||"").trim().toUpperCase().includes(' + cherche + '));' +
      ' if (!e) return false; e.click(); return true; })()');
    if (fait) return mot;
  }
  return false;
}


/** Un appui a l'endroit demande, par le protocole : l'ecran titre n'expose
 *  aucun bouton, c'est la surface entiere qui attend le doigt. */
async function taperEcran(x, y) {
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, sid);
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sid);
}

/* LA COURSE SE JOUE DANS LA PAGE, ET PAS PAR LE PROTOCOLE.
   Chaque appui envoye par CDP coute deux allers-retours : a quinze appuis par
   seconde la cadence reelle tombe sous la cadence demandee, et le coureur
   n'atteint jamais sa vitesse — c'est le defaut qui rend 06-course-100m.webm
   inutilisable en course. La boucle vit donc dans la page, ou elle tient sa
   cadence, et elle frappe l'element reellement sous le doigt. */
const TAPEUR = `window.__taper = (hz, sec) => {
  const y = innerHeight * 0.90, xg = innerWidth * 0.25, xd = innerWidth * 0.75;
  let i = 0;
  const frappe = x => {
    const e = document.elementFromPoint(x, y);
    if (!e) return;
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
                clientX: x, clientY: y, isPrimary: true };
    e.dispatchEvent(new PointerEvent('pointerdown', o));
    e.dispatchEvent(new PointerEvent('pointerup', o));
  };
  const id = setInterval(() => frappe(i++ % 2 ? xd : xg), 1000 / hz);
  setTimeout(() => clearInterval(id), sec * 1000);
  return 'ok';
};`;

/* ------------------------------------------------------------- on tourne */
console.log('\n  marqueurs, puis chargement a froid.');
// Une premiere visite pose les cinq marqueurs : c'est ce qu'un telephone deja
// venu porte. Elle n'est pas filmee.
await cdp('Page.navigate', { url: URL_JEU }, sid);
await dodo(1200);
for (const cle of ['sprinter_tour_vu', 'sprinter_install_refuse', 'sprinter_bienvenue_vue',
                   'sprinter_tuto_vu', 'sprinter_tuto_oneshot_vu'])
  await ev(`localStorage.setItem('${cle}','1')`);
await ev(`localStorage.setItem('sprinter_player_name','SPRINTER')`);

/* LA TAILLE DE SORTIE SE DEMANDE. Sans maxWidth/maxHeight, startScreencast rend
   la taille CSS du viewport — 360 x 640 — et ignore le facteur d'echelle : on
   obtient un reel de la taille d'une vignette. */
let t0 = Date.now();
if (MODE === 'page') {
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 }, sid);
  t0 = Date.now();
}
await cdp('Page.navigate', { url: URL_JEU + '?t=' + Date.now() }, sid);

/* L'accueil, puis ONE SHOT -> 100 M -> GO. On attend l'ecran, on ne parie pas
   sur une duree : une duree qui change fait rater le toucher, et le plan est
   perdu puisqu'on ne coupe pas. */
const attendre = async (mot, delai = 25000) => {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const la = await ev(`[...document.querySelectorAll('button,[role=button],a')]
      .some(x => x.offsetParent !== null && (x.innerText||'').toUpperCase().includes(${JSON.stringify(mot.toUpperCase())}))`);
    if (la) return true;
    await dodo(120);
  }
  return false;
};

/* L'ECRAN TITRE ATTEND UN APPUI, ET IL FAUT LE LUI DONNER.
   La premiere version attendait que l'accueil apparaisse tout seul : l'ecran
   titre restait donc quatre secondes a l'image, a ne rien faire, sur un reel
   dont le sujet est le temps. Un joueur, lui, touche des qu'il voit. On touche
   au centre tant que l'accueil n'est pas la. */
{
  const fin = Date.now() + 25000;
  while (Date.now() < fin) {
    const la = await ev(`[...document.querySelectorAll('button,[role=button],a')]
      .some(x => x.offsetParent !== null && (x.innerText||'').toUpperCase().includes('ONE SHOT'))`);
    if (la) break;
    await taperEcran(LARGEUR / 2, HAUTEUR / 2);
    await dodo(260);
  }
}
if (!await attendre('ONE SHOT', 6000)) throw new Error("l'accueil n'est jamais venu");
if (MODE === 'course') {
  // Le plan commence ici : l'accueil, le jeu, pas un logo qui se forme.
  await dodo(500);
  await ev(`window.__arme = false;`);     // zero a l'accueil, il partira au doigt
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 }, sid);
  t0 = Date.now();
  await dodo(900);                       // on laisse l'accueil se lire
}
console.log(`  accueil a ${((Date.now() - t0) / 1000).toFixed(2)} s`);
await toucherTexte('ONE SHOT'); await dodo(500);
/* On ne touche PAS « 100 M ». En one-shot l'accueil dit « PICK YOUR EVENTS » :
   le 100 m y est deja coche, et l'appuyer le DECOCHE — GO n'ouvre alors plus
   rien, et le plan est perdu puisqu'on ne coupe pas. */
if (!await toucherTexte(['LANCER', 'GO'])) throw new Error('le bouton de lancement est introuvable');
if (MODE === 'course') {
  // Le chronometre part au doigt qui lance, pas avant.
  await ev(`window.__depart = performance.now(); window.__arme = true;`);
}
console.log(`  LANCER a ${((Date.now() - t0) / 1000).toFixed(2)} s`);

/* LA COURSE. Deux touches alternees, a la cadence d'un joueur qui va vite. On
   passe par le toucher reel, aux coordonnees des deux zones : c'est la porte
   d'entree du jeu, celle qui compte la cadence et les fautes d'alternance. */
await ev(TAPEUR);
const lire = () => ev(`document.body.innerText.replace(/\\s+/g,' ').slice(0,200)`);

/* LE COUP DE PISTOLET. Taper pendant le decompte, c'est un faux depart — le
   jeu le compte comme sur une vraie piste, et la prise est a refaire. On
   attend donc la phase de poussee, et alors seulement on frappe. */
let parti = false;
for (let i = 0; i < 100; i++) {
  const t = await lire();
  if (/DRIVE|POUSSEE|POUSSÉE/i.test(t) && !/\b[123]\b/.test(t)) { parti = true; break; }
  await dodo(100);
}
console.log(`  pistolet a ${((Date.now() - t0) / 1000).toFixed(2)} s${parti ? '' : ' (non detecte)'}`);
await ev(`__taper(${CADENCE}, 20)`);

let fin = null;
for (let i = 0; i < 250; i++) {
  const t = await lire();
  if (/TERMIN|COMPLETE|TOTAL\s*:|PARTAGER|SHARE|REJOUER|PLAY AGAIN|REFAIRE/i.test(t)) { fin = Date.now(); break; }
  await dodo(100);
}
const chronoCourse = ((await lire()) || '').match(/(?:CUMUL|TOTAL)\s*:\s*([\d.,]+)\s*S/i);
if (!fin) console.log('  ⚠ la course n\'a pas rendu d\'ecran d\'arrivee — on fige quand meme');
const tFige = MODE === 'course'
  ? await ev(`performance.now() - (window.__depart || 0)`)
  : (fin || Date.now()) - t0;
await ev(`window.__fige = ${tFige}; window.__figeA = performance.now();`);
console.log(`  ligne a ${(tFige / 1000).toFixed(2)} s`);
if (chronoCourse) console.log(`  chrono de la course, lu a l'ecran : ${chronoCourse[1].replace('.', ',')} s`);
/* L'ecran d'arrivee porte le chrono de la course : c'est l'image qui justifie
   tout le reste, et elle ne restait qu'une seconde et demie. On la tient. */
await dodo(3500);
await cdp('Page.stopScreencast', {}, sid);
await dodo(300);

const duree = images.length ? (images[images.length - 1].t - images[0].t) / 1000 : 0;
console.log(`  ${images.length} images capturees, ${duree.toFixed(2)} s de plan`);
ws.close(); proc.kill();
await new Promise(ok => { proc.once('exit', ok); setTimeout(ok, 2000); });

/* ------------------------------- reechantillonnage a cadence fixe, puis VP8 */
/* Le screencast n'emet une image que lorsque la page change : sa cadence est
   irreguliere. On construit la ligne de temps plutot que de la subir — pour
   chaque image de sortie, la derniere image capturee a cet instant-la. */
if (!images.length) { console.error('aucune image'); process.exit(1); }
const t0i = images[0].t, tFin = images[images.length - 1].t;
const flux = path.join(SORTIE, 'plan.mjpeg');
const out = fs.createWriteStream(flux);
let i = 0, sorties = 0;
for (let t = t0i; t <= tFin; t += 1000 / FPS) {
  while (i + 1 < images.length && images[i + 1].t <= t) i++;
  out.write(images[i].jpeg); sorties++;
}
await new Promise(ok => out.end(ok));
console.log(`  ${sorties} images a ${FPS} i/s -> ${(sorties / FPS).toFixed(2)} s`);

const video = path.join(SORTIE, 'video.webm');
const r = spawnSync('bash', ['-c',
  `${FFMPEG} -y -f image2pipe -c:v mjpeg -framerate ${FPS} -i pipe:0 ` +
  `-c:v libvpx -b:v 6M -crf 8 -vf scale=${L_SORTIE}:${H_SORTIE}:flags=bicubic ` +
  `-pix_fmt yuv420p ${JSON.stringify(video)} < ${JSON.stringify(flux)}`],
  { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr?.slice(-1500)); process.exit(1); }
fs.unlinkSync(flux);

const o = fs.statSync(video);
console.log(`\n  video : ${video}`);
console.log(`  duree : ${(sorties / FPS).toFixed(2)} s · poids : ${(o.size / 1048576).toFixed(2)} Mo` +
            ` · VP8/WebM ${L_SORTIE} x ${H_SORTIE}, ${FPS} i/s`);
console.log(`  chronometre a l'arret : ${(tFige / 1000).toFixed(2).replace('.', ',')} s`);
if (chronoCourse) console.log(`  chrono de la course        : ${chronoCourse[1].replace('.', ',')} s`);
