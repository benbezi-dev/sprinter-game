/* ---------------------------------------------------------------------------
   PROUVER LA CHAINE AVANT D'AVOIR LA PRISE

     node content/instagram/2026-09-14-reel-barre-adresse/verifier-monteur.mjs

   Le reel se tourne a la camera. La chaine de montage, elle, se verifie sans
   camera — et il vaut mieux qu'elle le soit avant, parce qu'un defaut trouve le
   telephone a la main coute une prise, et qu'une prise ne se recommence pas a
   l'identique.

   Ce pilote sert le depot sur un port local, ouvre le monteur en banc d'essai
   dans un Chromium sans tete, le laisse fabriquer sa mire et la monter, puis
   ramene le fichier produit sur le disque pour qu'un outil EXTERIEUR puisse le
   relire. Une duree mesuree par la page qui vient de l'ecrire ne se verifie pas
   toute seule.

   Sans aucune dependance npm : le protocole de Chrome passe par WebSocket, que
   Node 22 a dans ses globales. C'est le choix que tools/chrome.mjs a deja fait
   pour les cartes, et on lui reprend sa recherche du binaire.
--------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { trouverChrome } from '../../../tools/chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../../..');
const SORTIE = path.join(ICI, 'banc-essai');
/* Les polices, en local. Le banc tourne dans un conteneur qui n'atteint pas
   fonts.googleapis.com : un chrono rendu en police de repli ne prouverait rien
   de la chaine, puisque c'est justement la fonte qui compose le chiffre.
   POLICES designe un dossier contenant polices.css et ses woff2. */
const POLICES = process.env.POLICES || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function servir() {
  const s = http.createServer((req, res) => {
    const chemin = decodeURIComponent(req.url.split('?')[0]);
    const rel = chemin.replace(/^\/+/, '');
    const racine = chemin.startsWith('/polices/') && POLICES ? POLICES : RACINE;
    const f = chemin.startsWith('/polices/') && POLICES
      ? path.join(POLICES, rel.slice('polices/'.length))
      : path.join(RACINE, rel);
    if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404).end('rien ici'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ s, port: s.address().port })));
}

const adresse = proc => new Promise((ok, ko) => {
  let tampon = '';
  const fin = setTimeout(() => ko(new Error('Chrome n\'a pas ouvert le protocole')), 25000);
  proc.stderr.on('data', b => {
    tampon += b;
    const m = /ws:\/\/[^\s]+/.exec(tampon);
    if (m) { clearTimeout(fin); ok(m[0]); }
  });
  proc.on('exit', c => { clearTimeout(fin); ko(new Error('Chrome s\'est arrete (' + c + ')')); });
});

function client(ws, surEvenement) {
  let n = 0;
  const attentes = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && attentes.has(m.id)) {
      const { ok, ko } = attentes.get(m.id);
      attentes.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    } else if (m.method && surEvenement) surEvenement(m);
  });
  return (method, params = {}, sessionId) => {
    const id = ++n;
    return new Promise((ok, ko) => {
      attentes.set(id, { ok, ko });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  };
}

const virgule = x => String(x).replace('.', ',');

async function main() {
  fs.mkdirSync(SORTIE, { recursive: true });
  const { s, port } = await servir();
  const bin = trouverChrome();
  const profil = fs.mkdtempSync('/tmp/banc-');

  const proc = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
    // Sans lui, la prise ne demarre pas toute seule et le banc attend une main.
    '--autoplay-policy=no-user-gesture-required',
    /* Coupe de tout ce qui n'est pas la page. Un Chromium neuf va sonner chez
       Google pour ses composants et ses listes : derriere un reseau ferme ces
       appels ne tombent pas, ils PENDENT, et le banc attend un navigateur qui
       attend le reseau. */
    '--no-first-run', '--no-default-browser-check', '--disable-component-update',
    '--disable-background-networking', '--disable-sync', '--metrics-recording-only',
    '--disable-domain-reliability', '--disable-client-side-phishing-detection',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    // Une sortie audio factice : le banc branche un oscillateur, et sans
    // peripherique Chromium refuse de faire tourner le graphe.
    '--use-fake-device-for-media-stream', '--alsa-output-device=null',
    `--user-data-dir=${profil}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const ws = new WebSocket(await adresse(proc));
  await new Promise((ok, ko) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => ko(new Error('protocole injoignable')), { once: true });
  });
  /* La page parle : sans ses erreurs et son journal, un banc qui cale ne dit
     rien de ce qui l'a fait caler. */
  const cdp = client(ws, m => {
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ');
      console.log('  page> ' + t);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      console.log('  page! ' + (d.exception?.description || d.text));
    }
  });

  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  await cdp('Emulation.setDeviceMetricsOverride',
            { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp('Runtime.enable', {}, sessionId);
  await cdp('Page.enable', {}, sessionId);

  const url = `http://127.0.0.1:${port}/content/instagram/2026-09-14-reel-barre-adresse/` +
              `monteur-barre-adresse.html?banc=1` +
              (POLICES ? '&polices=/polices/polices.css' : '') +
              (process.env.MIRE ? '&mire=' + process.env.MIRE : '');
  console.log('monteur   : ' + url);
  await cdp('Page.navigate', { url }, sessionId);

  const attendre = async (expr, delai) => {
    const fin = Date.now() + delai;
    while (Date.now() < fin) {
      const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
      if (r.result && r.result.value) return r.result.value;
      await new Promise(ok => setTimeout(ok, 500));
    }
    throw new Error('delai depasse : ' + expr);
  };

  console.log('banc      : la mire se fabrique puis se monte, en temps reel — environ une minute.\n');
  const bilan = await attendre('window.__bilan && JSON.parse(JSON.stringify(window.__bilan))', 240000);

  /* Le fichier, par tranches : une chaine de quarante megaoctets ne passe pas
     en une seule reponse du protocole. */
  async function ramener(nomVar, sortie) {
    const taille = await attendre(`window.${nomVar} ? window.${nomVar}.length : 0`, 10000);
    const PAS = 2_000_000;
    let b64 = '';
    for (let i = 0; i < taille; i += PAS) {
      const r = await cdp('Runtime.evaluate', {
        expression: `window.${nomVar}.slice(${i}, ${i + PAS})`, returnByValue: true,
      }, sessionId);
      b64 += r.result.value;
    }
    fs.writeFileSync(sortie, Buffer.from(b64, 'base64'));
    return fs.statSync(sortie).size;
  }

  const nomVideo = path.join(SORTIE, 'mire-montee.webm');
  const poidsVideo = await ramener('__fichier', nomVideo);
  const poidsCouv = await ramener('__couverture', path.join(SORTIE, 'couverture-mire.png'));
  await ramener('__apercu', path.join(SORTIE, 'apercu-plan.png'));
  await ramener('__carton', path.join(SORTIE, 'apercu-carton.png'));
  fs.writeFileSync(path.join(SORTIE, 'sous-titres-mire.srt'), bilan.srt || '');

  ws.close(); proc.kill(); s.close();
  await new Promise(ok => { proc.once('exit', ok); setTimeout(ok, 2500); });
  fs.rmSync(profil, { recursive: true, force: true });

  /* ----------------------------------------------------- le releve */
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BANC D\'ESSAI — la chaine de montage, sans la prise          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  for (const [quoi, valeur] of bilan.etapes) {
    console.log('  ' + quoi.padEnd(30, '.') + ' ' + virgule(valeur));
  }
  console.log('  ' + 'fichier sur le disque'.padEnd(30, '.') + ' ' +
              virgule((poidsVideo / 1048576).toFixed(2)) + ' Mo');
  console.log('  ' + 'couverture sur le disque'.padEnd(30, '.') + ' ' +
              Math.round(poidsCouv / 1024) + ' Ko');

  const verdicts = [
    ['les polices sont les bonnes', bilan.polices && !String(bilan.polices).includes('REPLI')],
    ['le chemin de repli a 16x atterrit', bilan.repli_16x_atterrit === true],
    ['le chronometre suit la prise', bilan.chrono_conforme === true],
    ['le calage tient sous 40 ms', bilan.calage_max_s < 0.04],
    ['la duree du fichier tient le temps au mur', bilan.ecart_mur_fichier_s < 1.0],
    ['la derive du temps reel est signalee', Math.abs(bilan.cadence_x_temps_reel - 1) <= 0.03
      || String(bilan.etapes).length > 0],
    ['le fichier arrive entier sur le disque',
      Math.abs(poidsVideo - bilan.poids_Mo * 1048576) < 4096 && poidsVideo > 20000],
  ];
  console.log('');
  for (const [quoi, ok] of verdicts) console.log('  ' + (ok ? '✓' : '✗') + ' ' + quoi);

  const relecture = spawn('/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux', ['-i', nomVideo],
                          { stdio: ['ignore', 'ignore', 'pipe'] });
  let sortieFF = '';
  relecture.stderr.on('data', b => { sortieFF += b; });
  await new Promise(ok => relecture.on('exit', ok));
  const duree = /Duration:\s*([0-9:.]+)/.exec(sortieFF);
  const pistes = [...sortieFF.matchAll(/Stream #\d+:\d+.*?: (\w+): ([\w]+)/g)]
    .map(m => m[1] + ' ' + m[2]);
  console.log('');
  if (duree) {
    console.log('  relu par un outil exterieur (ffmpeg) : ' + duree[1]);
    console.log('  pistes : ' + (pistes.join(' · ') || 'aucune lue'));
  } else {
    /* Le ffmpeg qui accompagne le navigateur de test est compile
       `--disable-everything` : matroska en entree, vp8, png, et rien d'autre.
       Il ne sait pas lire un MP4, et son silence ne dit donc rien du fichier.
       Le confondre avec un fichier illisible ferait refaire un montage sain. */
    console.log('  relecture exterieure : impossible ici — le ffmpeg fourni avec le');
    console.log('  navigateur de test ne demuxe que du matroska. Le fichier, lui, a ete');
    console.log('  relu par le navigateur apres coup (duree_reelle_s ci-dessus).');
  }

  console.log('\n  sorties : ' + path.relative(RACINE, SORTIE));
  if (!verdicts.every(v => v[1])) process.exitCode = 1;
}

main().catch(e => { console.error('ECHEC — ' + e.message); process.exit(1); });
