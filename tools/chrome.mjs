/* ---------------------------------------------------------------------------
   CHROME, SANS RIEN INSTALLER
   ---------------------------------------------------------------------------
   Les cartes de communication sont des pages HTML qu'on photographie. Deux
   outils le font deja (carte-defi.mjs, carte-riposte.mjs) en passant par
   puppeteer-core, pris dans le chantier des films promo, avec un chemin de
   Chrome ecrit en dur pour un Mac : ils ne tournent que sur la machine qui les
   a vus naitre. Ce module fait la meme chose sans aucune dependance npm.

   POURQUOI PAS `--screenshot`, QUI TIENT EN UNE LIGNE. Parce qu'il ment.
   `--window-size=1080,1350` rend bien une image de 1350 pixels de haut, mais
   la page, elle, n'est mise en page que sur 1263 : Chrome retranche la hauteur
   de son cadre, meme sans interface. Tout ce qu'on avait pose sous cette ligne
   est coupe, et le bas de l'image est rempli de fond. Le defaut est silencieux
   — l'image sort a la bonne taille, avec un pied tranche en deux — et il a
   emporte le premier apercu du lien de sprinter-game.com.

   Le protocole DevTools, lui, prend la taille qu'on lui donne :
   `Emulation.setDeviceMetricsOverride` fixe la zone dessinee, et
   `Page.captureScreenshot` la rend telle quelle. Node 22 a WebSocket dans ses
   globales, donc parler CDP ne coute plus une dependance.

   ET LES POLICES SONT ATTENDUES POUR DE BON. `--virtual-time-budget=3000`
   etait un pari sur la vitesse du reseau ; `document.fonts.ready` est une
   reponse. Une carte rendue en police de repli est une carte a refaire.
--------------------------------------------------------------------------- */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

/**
 * Le binaire de Chrome, ou qu'il soit.
 *
 * Dans cet ordre : ce qu'on nous donne par CHROME, le Chrome d'un Mac, celui
 * qu'un navigateur de test a depose, le chromium du systeme, puis ce que le
 * PATH connait. On ne telecharge rien — un outil qui lance deux cents
 * megaoctets de telechargement au moment de poster n'est pas un outil.
 */
export function trouverChrome() {
  const candidats = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.PLAYWRIGHT_BROWSERS_PATH &&
      path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium-1194/chrome-linux/chrome'),
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const c of candidats) {
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch { /* au suivant */ }
  }
  const via = spawnSync('bash', ['-lc', 'command -v chromium || command -v google-chrome'],
                        { encoding: 'utf8' });
  const trouve = String(via.stdout || '').trim().split('\n')[0];
  if (trouve) return trouve;
  console.error('Chrome est introuvable. Donne-le par CHROME=/chemin/vers/chrome.');
  process.exit(1);
}

/**
 * Les polices de la charte, declarees pour une page a photographier.
 *
 * Outfit et Space Mono, les memes que le jeu charge dans src/index.css. Elles
 * viennent de Google Fonts, sauf si SPRINTER_POLICES designe un dossier de
 * woff2 accompagne du CSS qui les declare — ce qui permet de fabriquer une
 * carte sans reseau, et de ne pas dependre d'un service exterieur le jour ou
 * l'on poste.
 */
export function enTetePolices() {
  const local = process.env.SPRINTER_POLICES;
  return local
    ? `@import url('file://${local}/polices.css');`
    : "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;900" +
      "&family=Space+Mono:wght@700&display=swap');";
}

/** L'adresse du protocole, annoncee par Chrome sur sa sortie d'erreur. */
function attendreAdresse(proc, delai = 20000) {
  return new Promise((resolve, reject) => {
    let tampon = '';
    const fin = setTimeout(() => reject(new Error('Chrome n\'a pas ouvert le protocole')), delai);
    proc.stderr.on('data', bloc => {
      tampon += bloc;
      const m = /ws:\/\/[^\s]+/.exec(tampon);
      if (m) { clearTimeout(fin); resolve(m[0]); }
    });
    proc.on('exit', c => { clearTimeout(fin); reject(new Error(`Chrome s'est arrete (${c})`)); });
  });
}

/**
 * Un client CDP minuscule : on numerote, on envoie, on attend sa reponse.
 *
 * Les evenements arrivent melanges aux reponses et portent un `method` sans
 * `id` : ceux qu'on attend sont poses dans une file, les autres tombent.
 */
function client(ws) {
  let n = 0;
  const attentes = new Map();
  const guets = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && attentes.has(m.id)) {
      const { ok, ko } = attentes.get(m.id);
      attentes.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) {
      for (let i = guets.length - 1; i >= 0; i--) {
        if (guets[i].quoi === m.method) { guets.splice(i, 1)[0].ok(m.params); }
      }
    }
  });
  return {
    envoyer(method, params = {}, sessionId) {
      const id = ++n;
      return new Promise((ok, ko) => {
        attentes.set(id, { ok, ko });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    guetter(quoi, delai = 20000) {
      return new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error(`${quoi} n'est jamais venu`)), delai);
        guets.push({ quoi, ok: p => { clearTimeout(t); ok(p); } });
      });
    },
  };
}

/**
 * Photographie une page HTML, a la taille demandee, exactement.
 *
 * Le HTML est ecrit dans un fichier plutot que passe en `data:` — une carte
 * porte parfois une image ou une police locale, et une page `data:` n'a pas de
 * dossier d'ou les charger.
 */
export async function capturer({ html, w, h, sortie, chrome }) {
  const bin = chrome || trouverChrome();
  const atelier = fs.mkdtempSync(path.join(os.tmpdir(), 'carte-'));
  const page = path.join(atelier, 'page.html');
  fs.writeFileSync(page, html);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });

  const proc = spawn(bin, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
    // Les images et les polices de la carte sont lues depuis le dossier du
    // projet, pas depuis celui de la page : sans ce drapeau, Chrome les refuse.
    '--allow-file-access-from-files',
    `--user-data-dir=${path.join(atelier, 'profil')}`,
    '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    const ws = new WebSocket(await attendreAdresse(proc));
    await new Promise((ok, ko) => {
      ws.addEventListener('open', ok, { once: true });
      ws.addEventListener('error', () => ko(new Error('protocole injoignable')), { once: true });
    });
    const c = client(ws);

    const { targetId } = await c.envoyer('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.envoyer('Target.attachToTarget', { targetId, flatten: true });

    // La zone dessinee, et c'est elle qui decide de la taille de l'image.
    await c.envoyer('Emulation.setDeviceMetricsOverride',
                    { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId);
    await c.envoyer('Page.enable', {}, sessionId);
    const charge = c.guetter('Page.loadEventFired');
    await c.envoyer('Page.navigate', { url: `file://${page}` }, sessionId);
    await charge;
    // Les polices : une carte rendue en police de repli est une carte a refaire.
    await c.envoyer('Runtime.evaluate',
                    { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true },
                    sessionId);

    const { data } = await c.envoyer('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
    }, sessionId);
    fs.writeFileSync(sortie, Buffer.from(data, 'base64'));
    ws.close();
  } finally {
    proc.kill();
    // Chrome ecrit encore son profil quand il recoit le signal : on lui laisse
    // finir. Sans cette attente, la suppression tombait sur un dossier qui se
    // remplissait sous elle, et l'erreur passait pour un echec du rendu — alors
    // que l'image, elle, etait deja ecrite.
    await new Promise(ok => { proc.once('exit', ok); setTimeout(ok, 3000); });
    try {
      fs.rmSync(atelier, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch { /* un dossier temporaire qui survit n'abime rien */ }
  }
  return sortie;
}
