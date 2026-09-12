/**
 * 3b · LE RELAIS 4 × 100, DEUX ÉQUIPES, UN SEUL NAVIGATEUR FILMÉ
 *
 * POURQUOI CE SECOND HARNAIS EXISTE.
 *
 * `f3-relais.mjs` ouvre QUATRE navigateurs et filme l'un d'eux. Sur la machine
 * qui l'a écrit cela tenait ; sur celle-ci — un i9 Intel — la boucle de
 * `Page.captureScreenshot` tombe à quatre images fraîches par seconde, et le
 * rush qui en sort a beau porter 30 i/s dans son entête, il n'avance que
 * quatre fois par seconde. Mesuré sur `sprinter_relais_raw_v1.mp4` :
 * `mpdecimate` ne garde que 23 images sur 168 sur la fenêtre montée, et entre
 * 14 et 29 sur toute la longueur du rush. C'est ce qui se voit à l'écran, et
 * c'est le seul défaut du plan de relais du reel de nouveautés.
 *
 * Ce harnais-ci ne change pas la technique de capture : il enlève la charge.
 * UN SEUL NAVIGATEUR tourne — celui qu'on filme. Les sept autres coureurs sont
 * des clients WebSocket, comme dans `tools/relais-confrontation-test.mjs` :
 * ils parlent à la salle, ils ne rendent aucun pixel. La caméra a la machine
 * pour elle.
 *
 * DEUX ÉQUIPES, et non une. Une équipe seule court contre le chrono, sur
 * quatre couloirs ; deux équipes courent l'une contre l'autre sur huit, et
 * c'est ce que le film a besoin de montrer. Le code de confrontation s'ouvre
 * DEPUIS L'ÉCRAN — donc à la caméra, comme un joueur le ferait — puis les
 * sept clients le rejoignent.
 *
 * CE QUI TOURNE AVANT :
 *   1. le worker local   : cd worker && npx wrangler dev --local --port 8790
 *   2. le jeu, canal test : API_LOCALE=http://127.0.0.1:8790 \
 *                           npx vite --mode test --port 5175
 *   3. un code d'accès    : POST /test/admin/creer avec X-Sprinter-Admin
 *
 * Rien n'est écrit dans la base de production : le canal de test refuse toute
 * requête non marquée, et le worker tourne en local sur `--local`.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer,
         attendreEcran, ouvrirPanneau } from './base.mjs';
import { taper, attendrePistolet } from './course.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE   = process.env.BASE || 'http://127.0.0.1:8790';
const WS     = BASE.replace(/^http/, 'ws');
const ACCES  = process.env.ACCES || '2562NC';
const URL_JEU = process.env.URL_JEU || 'http://localhost:5175/';
const SORTIE = process.env.SORTIE ||
  '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail/03b-relais-deux-equipes';

const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(r => r.json());

const LEG = 100, TAILLE = 4;

/* Le joueur filmé, et les sept autres. Ce sont les noms du répertoire du
   harnais — des pseudos neutres, jamais ceux de vrais joueurs : rien de ce que
   la caméra écrit à l'écran n'appartient à quelqu'un. */
const MOI = 'VOLT';
const EQUIPE_A = { nom: 'COMÈTE', membres: ['NITRO', 'BLITZ', 'SURGE'] };
const EQUIPE_B = { nom: 'QUASAR', createur: 'MACH', membres: ['EMBER', 'NOVA', 'AXIOM'] };

/* Une reprise doit repartir d'équipes qui n'existent pas : le jeu refuse deux
   équipes de même composition, et le panneau montrerait celle de la prise
   précédente au lieu de la voir se monter. Même geste que dans f3. */
function oublierEquipes() {
  const cles = ['comète', 'quasar'];
  for (const cle of cles) {
    for (const sql of [
      `DELETE FROM relay_members WHERE team_id IN (SELECT id FROM relay_teams WHERE name_key = '${cle}')`,
      `DELETE FROM relay_teams WHERE name_key = '${cle}'`,
    ]) {
      try {
        execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard-test',
                             '--local', '--command', sql],
                     { cwd: '/Volumes/MUSIQUE/BENBEZI/Sprinter/worker', stdio: 'ignore' });
      } catch { /* la table peut ne pas exister au premier tour */ }
    }
  }
}

/** Une équipe complète, montée par l'API et prête à courir. */
async function monter(nom, createur, membres) {
  const c = await post('/relay/team', { name: nom, creator: createur, members: membres });
  if (!c || !c.equipe) throw new Error(`equipe ${nom} refusee : ${JSON.stringify(c)}`);
  for (const m of membres) await post('/relay/answer', { id: c.equipe.id, name: m, accept: true });
  return { id: c.equipe.id, nom: c.equipe.nom, noms: [createur, ...membres] };
}

/**
 * Un relayeur qui n'est pas filmé : il court, s'élance quand le témoin
 * approche, et tape. Repris de `tools/relais-confrontation-test.mjs`, dont
 * c'est exactement le travail — un client de salle, sans une ligne de rendu.
 */
function relayeur(conf, equipe, nom, vitesse) {
  const c = { nom, equipe, relais: 0, zone: null, porteur: 1, d: {}, tape: false };
  c.ws = new WebSocket(
    `${WS}/relay/conf/${conf}?acces=${ACCES}&team=${equipe}&name=${encodeURIComponent(nom)}`);
  c.pret = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') { c.relais = m.relais; c.zone = m.zone; }
    if (m.equipes) c.etat = m;
    if (m.t === 'pos') { (c.d[m.equipe] ||= {})[m.relais] = m.d; }
    if (m.t === 'passe' && m.equipe === c.equipe) { c.porteur = m.vers; c.tape = false; }
    if (m.t === 'termine') c.fini = m;
    if (m.depart_a && !c.boucle) courir(c, m.depart_a, vitesse);
  });
  c.envoyer = o => { try { c.ws.send(JSON.stringify(o)); } catch { } };
  return c;
}

function courir(c, departA, vitesse) {
  const debut = (c.relais - 1) * LEG;
  let d = c.zone ? Math.max(debut, c.zone.debut) : debut;
  c.boucle = setInterval(() => {
    const t = Date.now() - departA;
    if (t < 0) return;
    const mien = c.etat?.equipes?.find(x => x.equipe === c.equipe);
    if (mien && (mien.elimine || mien.total != null)) return;
    const miens = c.d[c.equipe] || {};
    const temoinD = miens[c.porteur] ?? (c.porteur - 1) * LEG;
    const porte = c.porteur === c.relais;
    const recois = c.porteur === c.relais - 1;
    if (porte) { d += vitesse * 0.1; c.envoyer({ t: 'pos', d }); }
    else if (recois && temoinD > d - 6) {
      c.lance = (c.lance || 0) + 0.1;
      d += vitesse * Math.min(1, c.lance / 2.2) * 0.1;
      c.envoyer({ t: 'pos', d });
    }
    const suivantD = miens[c.relais + 1];
    if (!c.tape && recois && Math.abs(temoinD - d) < 3 &&
        d >= (c.zone?.debut ?? 0) && temoinD >= (c.zone?.debut ?? 0)) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    if (!c.tape && porte && suivantD != null &&
        d >= c.relais * LEG && Math.abs(suivantD - d) < 3) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    if (c.relais === TAILLE && porte && d >= LEG * TAILLE && !c.aFini) {
      c.aFini = true; c.envoyer({ t: 'fini', ms: t });
      clearInterval(c.boucle);
    }
  }, 100);
}

/** Le texte d'un bouton, cherché par son libellé, tapé au pointeur. */
const taperBouton = (page, mot) => page.evaluate(m => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.innerText.toUpperCase().includes(m) && !x.disabled);
  if (!b) return false;
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup'); b.click();
  return true;
}, mot.toUpperCase());

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  RELAIS 4×100 — deux equipes, un navigateur filme            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

mkdirSync(SORTIE, { recursive: true });
oublierEquipes();

const A = await monter(EQUIPE_A.nom, MOI, EQUIPE_A.membres);
const B = await monter(EQUIPE_B.nom, EQUIPE_B.createur, EQUIPE_B.membres);
console.log(`   ${A.nom} (${A.id})  contre  ${B.nom} (${B.id})`);

/* ------------------------------------------------------------ le navigateur */

const b = await navigateur();
const { ctx, page, cdp } = await telephone(b, { nom: MOI, device: 'cap-volt-000000000001' });
await ctx.addInitScript(code => {
  try {
    localStorage.setItem('sprinter_acces_test', code);
    for (const k of ['sprinter_bienvenue_vue', 'sprinter_tuto_vu', 'sprinter_tuto_oneshot_vu',
                     'sprinter_tour_vu', 'sprinter_install_refuse']) localStorage.setItem(k, '1');
  } catch { }
}, ACCES);
page.on('dialog', async d => { await d.accept(); });
page.on('pageerror', e => console.log('  ! page:', String(e).slice(0, 160)));

await page.goto(URL_JEU, { waitUntil: 'networkidle' });
await cadrer(cdp);
await dormir(2400);
await page.tap('body', { position: { x: 200, y: 600 } });
await attendreEcran(page, 'CARRIÈRE');
await appuyer(page, 'DÉFI', { exact: true });
await dormir(1000);
await ouvrirPanneau(page, 'RELAIS 4 × 100', 'CLASSEMENT DES ÉQUIPES');
await dormir(1200);
await page.screenshot({ path: `${SORTIE}/a-panneau.png` });

/* Le bloc « AFFRONTER D'AUTRES ÉQUIPES » vit tout en bas du panneau, sous la
   liste des equipes. Il faut l'amener dans le cadre avant d'y toucher : un
   `click()` sur un bouton hors ecran passe, mais le film montrerait le haut du
   panneau pendant que le code s'ouvre ailleurs. */
await page.evaluate(() => {
  const t = [...document.querySelectorAll('span')]
    .find(x => x.innerText.includes('AFFRONTER D'));
  t?.scrollIntoView({ block: 'center' });
});
await dormir(900);

/* Deux couloirs d'equipes : le nombre se fixe a l'ouverture, et par le premier
   arrive. Deux equipes, huit coureurs. Les boutons de CHOIX portent le chiffre
   seul, en chasse fixe — c'est ce qui les distingue de tout le reste. */
const places = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.innerText.trim() === '2' && x.className.includes('font-mono'));
  if (!b) return false;
  b.click(); return true;
});
console.log(`   deux couloirs : ${places ? 'choisi' : 'BOUTON INTROUVABLE'}`);
await dormir(500);

// Ouvrir la confrontation DEPUIS L'ECRAN : c'est le geste du joueur, et c'est
// lui que le film montre. Le libelle exact vient de `conf_ouvrir`.
const ouvert = await taperBouton(page, 'OUVRIR UNE CONFRONTATION');
console.log(`   ouverture : ${ouvert ? 'tapee' : 'BOUTON INTROUVABLE'}`);
await dormir(2500);
await page.screenshot({ path: `${SORTIE}/b-code.png` });

/* Le code, lu a l'ecran. Il est dans le seul span a `tracking-[0.3em]` du
   panneau — le chercher par la forme « quatre a huit majuscules » attrapait la
   pastille du nom du joueur, et les sept clients rejoignaient une salle nommee
   VOLT pendant que l'ecran en ouvrait une autre. La course avait bien lieu :
   dans deux salles differentes, et la camera filmait la mauvaise. */
const code = await page.evaluate(() => {
  const n = [...document.querySelectorAll('span')]
    .find(x => x.className.includes('tracking-[0.3em]') && x.className.includes('tabular-nums'));
  return n ? n.innerText.trim() : '';
});
console.log(`   confrontation : ${code || 'CODE INTROUVABLE'}`);
if (!code) {
  console.log(await page.evaluate(() => document.body.innerText.slice(-1200)));
  await b.close(); process.exit(1);
}

/* --------------------------------------------------- les sept autres coureurs */

const cl = [];
for (const [eq, noms, v] of [[A, A.noms.slice(1), 9.0], [B, B.noms, 8.6]]) {
  for (const n of noms) {
    const c = relayeur(code, eq.id, n, v);
    await c.pret; cl.push(c); await dormir(80);
  }
}
await dormir(700);
console.log(`   ${cl.length} clients connectes, relais ${cl.map(c => c.relais).join(' ')}`);

/* ------------------------------------------------------------- sur la piste */

const entree = await page.evaluate(() => {
  const sp = [...document.querySelectorAll('span')]
    .find(x => x.className.includes('tracking-[0.3em]') && x.className.includes('tabular-nums'));
  if (!sp) return false;
  // La carte de confrontation : on remonte jusqu'a elle, puis on prend SON
  // bouton d'entree. Chercher « ENTRER SUR LA PISTE » dans toute la page
  // trouverait d'abord celui de la carte d'equipe, qui court seule contre le
  // chrono — quatre couloirs au lieu de huit, et aucune equipe en face.
  const carte = sp.closest('div.flex.flex-col');
  const b = [...(carte?.querySelectorAll('button') || [])]
    .find(x => x.innerText.toUpperCase().includes('PISTE'));
  if (!b) return false;
  b.scrollIntoView({ block: 'center' });
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup'); b.click();
  return true;
});
console.log(`   entree sur la piste : ${entree ? 'tapee' : 'BOUTON INTROUVABLE'}`);
await dormir(3000);
await page.screenshot({ path: `${SORTIE}/c-piste.png` });

const cam = new Camera(page, `${SORTIE}/images`, 30, cdp);
await cam.demarrer();
console.log('   camera : elle tourne');

// Tout le monde se declare pret : les sept clients, puis l'ecran.
for (const c of cl) c.envoyer({ t: 'pret', pret: true });
await dormir(500);
await cam.suspendre();
await taperBouton(page, 'PRÊT');
cam.reprendre();
await dormir(300);

const t0 = Date.now();
await attendrePistolet(page, 25000).catch(() => console.log('   (pistolet non detecte, on court quand meme)'));
console.log(`   pistolet a +${Date.now() - t0} ms`);

// Le premier relayeur court sa centaine. Le clavier passe pendant la capture,
// le pointeur non : c'est pour cela que le temoin se tape camera suspendue.
await taper(page, { cadence: 10.4, duree: 11000 });

// Le passage : le donneur tape aussi, et il tape DANS la zone.
for (let i = 0; i < 40; i++) {
  const arme = await page.evaluate(() => [...document.querySelectorAll('button')]
    .some(x => x.innerText.toUpperCase().includes('TÉMOIN') && !x.disabled));
  if (arme) { await cam.suspendre(); await taperBouton(page, 'TÉMOIN'); cam.reprendre(); break; }
  await dormir(150);
}

// Le reste de la course se regarde : les trois autres relayeurs sont des
// clients, et l'ecran suit le temoin.
await dormir(26000);

// PENDANT la capture, aucun `page.screenshot()` : Playwright repose sa propre
// emulation d'appareil, et toutes les images suivantes reviennent au tiers
// superieur gauche sans que rien n'echoue. Les vues fixes se tirent du rush
// apres coup. C'est ecrit dans `Camera.arreter`, et c'est verifie la-bas.
await cam.arreter();
writeFileSync(`${SORTIE}/tournage.json`, JSON.stringify(
  { code, equipes: [A, B], images: cam.n, ips: 30, le: new Date().toISOString() }, null, 2));

console.log('\n   texte de fin :\n' + (await page.evaluate(() => document.body.innerText.slice(0, 600))));
await b.close();
process.exit(0);
