/* ---------------------------------------------------------------------------
   CHROME, SANS RIEN INSTALLER
   ---------------------------------------------------------------------------
   Les cartes de communication sont des pages HTML qu'on photographie. Deux
   outils le font deja (carte-defi.mjs, carte-riposte.mjs) en passant par
   puppeteer-core, pris dans le chantier des films promo, avec un chemin de
   Chrome ecrit en dur pour un Mac : ils ne tournent que sur la machine qui les
   a vus naitre.

   Ce module fait la meme chose avec ce que Chrome sait faire tout seul —
   `--headless --screenshot` — et ne demande donc aucune dependance npm. Un
   outil de communication doit pouvoir sortir d'une machine neuve a 19h50.
--------------------------------------------------------------------------- */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
 * Photographie une page HTML, a la taille demandee.
 *
 * Le HTML est ecrit dans un fichier temporaire plutot que passe en `data:` —
 * une carte porte parfois une image locale, et une page `data:` n'a pas de
 * dossier d'ou la charger.
 */
export function capturer({ html, w, h, sortie, chrome }) {
  const bin = chrome || trouverChrome();
  const atelier = fs.mkdtempSync(path.join(os.tmpdir(), 'carte-'));
  const page = path.join(atelier, 'page.html');
  fs.writeFileSync(page, html);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  const r = spawnSync(bin, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
    // Sans ce budget, la capture part avant que le degrade du titre soit pose :
    // on obtient un titre transparent, c'est-a-dire pas de titre.
    '--virtual-time-budget=3000',
    // Les images locales de la carte sont lues depuis le dossier du projet,
    // pas depuis celui de la page : sans ce drapeau, Chrome les refuse.
    '--allow-file-access-from-files',
    `--window-size=${w},${h}`, `--screenshot=${sortie}`, `file://${page}`,
  ], { encoding: 'utf8' });
  fs.rmSync(atelier, { recursive: true, force: true });
  if (r.status !== 0 || !fs.existsSync(sortie)) {
    throw new Error(`le rendu a echoue :\n${r.stderr || r.error || ''}`);
  }
  return sortie;
}
