/**
 * 4 · LA NATIONALITE, ET CE QU'ELLE ENGAGE
 *
 * Le joueur sans pays choisit son drapeau, et le reel montre les DEUX temps que la consigne
 * demande : le choix, puis ce qu'il change. Le choix est facultatif et
 * definitif — le jeu le dit avant de le prendre, et demande confirmation en
 * nommant le pays.
 *
 * Les consequences filmees sont celles que le jeu produit vraiment :
 *   · le drapeau se pose a cote du nom, et se ferme (cadenas) ;
 *   · la ligne du joueur porte ce drapeau dans le classement des duels ;
 *   · c'est ce drapeau qui decide du championnat national ou il se presente.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { J, RELAIS } from './noms.mjs';

/* Le drapeau est DEFINITIF — c'est tout le sujet du reel — donc une prise
   rejouee doit d'abord rendre au joueur sans pays sa nationalite vierge, sinon la
   bienvenue ne s'ouvre plus et le harnais attend une fenetre qui ne viendra
   pas. On ne touche qu'a lui, et seulement dans la base locale. */
execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard', '--local',
                     '--command', "DELETE FROM player_pays WHERE name_key = 'yanis'"],
             { cwd: '/Volumes/MUSIQUE/BENBEZI/Sprinter/worker', stdio: 'ignore' });

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const DOSSIER = `${SORTIE}/04-nationalite`;

const b = await navigateur();
const { page, cdp } = await telephone(b, { nom: J.sanspays, device: APP[J.sanspays], bienvenue: true });
page.on('dialog', async d => { console.log('   [confirmation]', d.message().slice(0, 90)); await d.accept(); });
await page.goto(URL_JEU, { waitUntil: 'networkidle' });
await cadrer(cdp);
await dormir(2400);
await page.tap('body', { position: { x: 200, y: 600 } });
await attendreEcran(page, 'CARRIÈRE');
await dormir(1500);

const cam = new Camera(page, DOSSIER, 30, cdp);
await cam.demarrer();

console.log('\n── 4 · NATIONALITE ──────────────────────────────────────────');
// La bienvenue s'ouvre sur le NOM, pas sur le drapeau : le drapeau est son
// deuxieme pas, et il n'apparait qu'une fois le premier franchi.
await page.waitForFunction(() => document.body.innerText.includes('BIENVENUE'), null, { timeout: 20000 });
cam.marque('bienvenue-nom');
await dormir(1600);
await appuyer(page, 'CONTINUER', { exact: true, attendu: 'select' });
await dormir(2000);
cam.marque('bienvenue-pays');
console.log('   ', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 260));
await dormir(2200);

// Le menu deroulant des pays. On le fait defiler pour montrer la liste, puis
// on pose la France.
const menu = page.locator('select').first();
console.log('   pays proposes :', await menu.locator('option').count());
for (const p of ['CI', 'SN', 'MA', 'FR']) {
  await menu.selectOption(p);
  await dormir(700);
}
cam.marque('france-choisie');
await dormir(1400);

await appuyer(page, 'CHOISIR', { exact: true });
await dormir(2600);
cam.marque('drapeau-pose');
console.log('   ', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 300));
await dormir(2200);

// Le troisieme pas de la bienvenue (Instagram) n'est pas le sujet de ce
// reel : on le referme par son propre bouton. « PASSER » n'existe plus a ce
// stade — le pas se ferme par « A LA PISTE », et chercher le mauvais mot
// laisse la fenetre ouverte quarante secondes devant la camera.
await appuyer(page, 'À LA PISTE', { exact: true, attendu: 'text=MEILLEURS PARCOURS' });
await dormir(1400);
cam.marque('accueil');

// -------------------------------------------------- ce que le drapeau change
// 1 · il se voit sur le nom, et il est ferme.
await appuyerSur(page, 'button:has-text(J.sanspays)');
await dormir(2600);
cam.marque('carte-identite');
console.log('   ', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 400));
await dormir(2600);
await appuyerSur(page, 'button:has-text(J.sanspays)').catch(() => {});
await dormir(1200);

// 2 · il porte sa ligne au classement des duels, au milieu des autres pays.
await appuyer(page, 'VOIR LE CLASSEMENT DES DUELS', { attendu: 'button[aria-label^="DÉFIER"]' });
await dormir(3000);
cam.marque('classement-drapeaux');
await dormir(3000);
// On descend jusqu'a sa ligne : c'est la qu'on voit le drapeau qu'il vient de choisir.
await page.locator(`text=${J.sanspays}`).last().scrollIntoViewIfNeeded().catch(() => {});
await dormir(2600);
cam.marque('sa-ligne');
await dormir(2600);

await cam.arreter();
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({ pays: 'FR', joueur: J.sanspays }, null, 1));
await b.close();
