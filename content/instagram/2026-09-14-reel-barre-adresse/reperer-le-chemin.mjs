/* ---------------------------------------------------------------------------
   LE CHEMIN EXACT, POUR NE PAS TATONNER DEVANT LA CAMERA

     npm install && npm run dev            # dans un autre terminal
     node content/instagram/2026-09-14-reel-barre-adresse/reperer-le-chemin.mjs

   Le reel « la barre d'adresse » se tourne en UN plan, sans coupe : ce que le
   telephone affiche au moment ou la main arrive, il l'affichera dans le film.
   Un panneau imprevu — et il y en a cinq — coute la prise entiere.

   Ce pilote ouvre le jeu en emulation telephone, photographie l'ouverture
   seconde par seconde, et dit ce qu'il y a a toucher a chaque ecran. Deux
   passes :

     VIERGE=1  le navigateur n'est jamais venu. On voit ce qui s'interpose.
     VIERGE=0  les cinq marqueurs sont poses. C'est l'ecran qu'on veut filmer.

   CE QU'IL A DEJA TROUVE, LE 19 SEPTEMBRE 2026, ET QUI N'ETAIT PAS PREVU :

     - le mode par defaut est CARRIERE, et son bouton START n'ouvre pas la
       course : il ouvre « STAGE 1 » et une carte d'adversaire a congedier en
       tapant deux fois. C'est ONE SHOT qu'il faut, dont le bouton s'appelle GO
       et mene droit a la ligne ;
     - un navigateur vierge ouvre une banniere INSTALLER LE JEU. La legende de
       ce reel dit « pas d'installation » : la banniere dirait le contraire, a
       l'image, pendant la demonstration ;
     - la carte « SPECIAL EDITION » de l'accueil ne s'eteint avec aucun
       marqueur, et elle porte « last day ».

   CE QU'IL NE MESURE PAS. Les durees relevees ici sont celles d'un serveur
   local dans un conteneur sans tete. Elles ne disent RIEN du temps que met un
   telephone sur une vraie connexion, et aucune ne doit sortir d'ici. Le seul
   chiffre qui vaille se mesure sur le rush, et c'est le travail du chronometre
   incruste.

   Sans dependance npm : le protocole de Chrome passe par WebSocket, que Node 22
   a dans ses globales — le choix que tools/chrome.mjs a deja fait, et dont on
   reprend la recherche du binaire.
--------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { trouverChrome } from '../../../tools/chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SORTIE = process.env.SORTIE || path.join(ICI, 'banc-essai/reperage');
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:5173/';
const VIERGE = process.env.VIERGE !== '0';
const TOUCHES = (process.env.TOUCHES || 'ONE SHOT|GO').split('|').filter(Boolean);

/* LES CINQ PANNEAUX, ET LE MARQUEUR QUI LES ETEINT.
   Tous valent '1'. Sur le telephone du tournage ils ne se posent pas a la
   main : on fait une premiere visite et on ferme chaque panneau. C'est cela,
   « tourner sur un navigateur deja venu ». */
const MARQUEURS = {
  sprinter_tour_vu:         'le carrousel en cinq volets',
  sprinter_install_refuse:  'la banniere INSTALLER LE JEU',
  sprinter_bienvenue_vue:   'la fenetre de bienvenue (nom, pays, Instagram)',
  sprinter_tuto_vu:         'la question du tutoriel, en carriere',
  sprinter_tuto_oneshot_vu: 'la meme question, en ONE SHOT',
};

fs.mkdirSync(SORTIE, { recursive: true });

const proc = spawn(trouverChrome(), [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
  // Un Chromium neuf sonne chez Google pour ses composants ; derriere un reseau
  // ferme ces appels ne tombent pas, ils PENDENT.
  '--no-first-run', '--disable-component-update', '--disable-background-networking',
  '--disable-features=Translate,OptimizationHints',
  `--user-data-dir=${fs.mkdtempSync('/tmp/reperage-')}`,
  '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((ok, ko) => {
  let tampon = '';
  proc.stderr.on('data', d => { tampon += d; const m = /ws:\/\/[^\s]+/.exec(tampon); if (m) ok(m[0]); });
  proc.on('exit', c => ko(new Error(`Chrome s'est arrete (${c})`)));
  setTimeout(() => ko(new Error("Chrome n'a pas ouvert le protocole")), 25000);
});
const ws = new WebSocket(wsUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));

let n = 0; const attentes = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && attentes.has(m.id)) {
    const { ok, ko } = attentes.get(m.id); attentes.delete(m.id);
    m.error ? ko(new Error(m.error.message)) : ok(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('  page!', m.params.exceptionDetails.exception?.description?.split('\n')[0]);
  }
});
const cdp = (methode, params = {}, sid) => {
  const id = ++n;
  return new Promise((ok, ko) => {
    attentes.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method: methode, params, ...(sid ? { sessionId: sid } : {}) }));
  });
};

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await cdp('Target.attachToTarget', { targetId, flatten: true });
await cdp('Runtime.enable', {}, sid);
await cdp('Page.enable', {}, sid);
// Le telephone que capture-classement.mjs emule deja : 390 x 844 au facteur 3.
await cdp('Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sid);
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sid);

const ev = async expr => (await cdp('Runtime.evaluate',
  { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result?.value;
const dodo = ms => new Promise(ok => setTimeout(ok, ms));
const photo = async nom => {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' }, sid);
  fs.writeFileSync(path.join(SORTIE, nom + '.png'), Buffer.from(data, 'base64'));
};
/** Ce qu'il y a a toucher : le texte de chaque commande visible. */
const boutons = () => ev(`JSON.stringify([...document.querySelectorAll('button,[role=button],a')]
  .filter(e => e.offsetParent !== null)
  .map(e => (e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,40)).filter(Boolean))`);
/** Toucher la commande dont le texte contient `t`. */
const toucher = t => ev(`(() => {
  const e = [...document.querySelectorAll('button,[role=button],a')].find(x =>
    x.offsetParent !== null && (x.innerText||'').trim().toUpperCase().includes(${JSON.stringify(String(t).toUpperCase())}));
  if (!e) return 'INTROUVABLE'; e.click(); return (e.innerText||'').trim().slice(0,40); })()`);

console.log(VIERGE
  ? "\nPASSE VIERGE — on regarde ce qui s'interpose.\n"
  : "\nPASSE « DEJA VENU » — l'ecran qu'on veut filmer.\n");

await cdp('Page.navigate', { url: URL_JEU }, sid);
await dodo(1500);
if (!VIERGE) {
  for (const cle of Object.keys(MARQUEURS)) await ev(`localStorage.setItem('${cle}','1')`);
  await ev(`localStorage.setItem('sprinter_player_name','REPETITION')`);
  await cdp('Page.navigate', { url: URL_JEU }, sid);
  await dodo(1500);
}
await ev(`document.fonts.ready.then(() => 1)`);

/* L'ouverture s'anime : le logo se forme, puis l'ecran titre, puis l'accueil.
   On la suit dans le temps plutot que de parier sur une duree — et la duree
   relevee ici ne vaut que pour cette machine. */
for (const t of [2, 5, 8, 11, 14]) {
  await dodo(t === 2 ? 2000 : 3000);
  await photo(`ouverture-${String(t).padStart(2, '0')}s`);
  console.log(`  t=${t}s  a toucher : ${await boutons()}`);
}

for (const mot of TOUCHES) {
  const quoi = await toucher(mot);
  console.log(` -> ${mot} : ${quoi}`);
  if (quoi === 'INTROUVABLE') console.log("    (le libelle a change, ou l'ecran n'est pas celui attendu)");
  await dodo(2200);
  await photo('touche-' + mot.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  console.log(`    a toucher : ${await boutons()}`);
}

const cles = JSON.parse(await ev(`JSON.stringify(Object.keys(localStorage))`) || '[]');
console.log('\n  marqueurs en place :');
for (const [cle, quoi] of Object.entries(MARQUEURS)) {
  console.log(`    ${cles.includes(cle) ? '✓' : '·'} ${cle.padEnd(26)} ${quoi}`);
}
console.log('\n  photos : ' + SORTIE);

ws.close(); proc.kill();
await new Promise(ok => { proc.once('exit', ok); setTimeout(ok, 2000); });
process.exit(0);
