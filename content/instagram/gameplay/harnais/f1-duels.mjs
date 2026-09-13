/**
 * 1 · LE CLASSEMENT DES DUELS
 *
 * Un vrai duel, de bout en bout, sur deux telephones :
 *   La camera ouvre le classement, y prend sa cible (3e ; elle est 6e), court
 *   son 100 m et lui envoie le defi. La cible le releve et le perd. Le
 *   classement, reste ouvert, se rafraichit sous ses yeux : la ligne remonte, et
 *   c'est l'animation `layout` de la vraie interface qui la fait glisser.
 *
 * Rien n'est simule : les deux chronos sont courus par le harnais de course,
 * et c'est le serveur qui distribue les points de ligue.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { courir } from './course.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { J, RELAIS } from './noms.mjs';

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const DOSSIER = `${SORTIE}/01-classement-duels`;

const b = await navigateur();

async function entrer(nom) {
  const { ctx, page, cdp } = await telephone(b, { nom, device: APP[nom] });
  page.on('dialog', async d => { await d.accept(); });
  await page.goto(URL_JEU, { waitUntil: 'networkidle' });
  await cadrer(cdp);
  await dormir(2400);
  await page.tap('body', { position: { x: 200, y: 600 } });
  await attendreEcran(page, 'CARRIÈRE');
  return { ctx, page, cdp };
}

console.log('\n── 1 · CLASSEMENT DES DUELS ─────────────────────────────────');
const kenza = await entrer(J.camera);
const omar  = await entrer(J.cible);

// Le code du defi vient du reseau, pas de l'ecran : une expression reguliere
// sur du texte affiche a deja attrape « METRES » a la place d'un code.
let code = null;
kenza.page.on('response', async r => {
  if (r.url().includes('/challenge') && r.request().method() === 'POST') {
    try { code = (await r.json()).id; } catch (e) {}
  }
});

const cam = new Camera(kenza.page, DOSSIER, 30, kenza.cdp);
await cam.demarrer();

cam.marque('accueil');
await dormir(1500);
await appuyer(kenza.page, 'VOIR LE CLASSEMENT DES DUELS',
              { attendu: 'button[aria-label^="DÉFIER"]' });
await dormir(2600);
cam.marque('classement-avant');
await dormir(2000);

// L'epee de la ligne de la cible. Chaque bouton porte le nom de sa cible dans son
// `aria-label` : c'est la prise la plus sure, et un selecteur CSS la lit sans
// reconstruire l'arbre d'accessibilite des trois cents lignes.
await appuyerSur(kenza.page, `button[aria-label="DÉFIER ${J.cible}"]`, {});
cam.marque('epee-omar');
await dormir(1200);

cam.marque('depart');
await courir(kenza.page, { niveau: 'bon', duree: 11500 });
cam.marque('arrivee');
await dormir(2400);
const chronoKenza = Math.round(parseFloat(
  ((await kenza.page.innerText('body')).match(/CUMUL : ([\d.]+) S/) || [])[1]) * 1000);
console.log(`   ${J.camera} :`, chronoKenza / 1000, 's');

await appuyerSur(kenza.page, 'button:has-text("DÉFIER UN AMI")', {});
await dormir(3000);
console.log('   code du defi :', code);
cam.marque('defi-envoye');

// La camera retourne au classement et Y RESTE : c'est la seule facon d'avoir le
// glissement de la ligne. Rouvrir l'ecran remonterait le composant, et une
// ligne qui apparait deja a sa place ne raconte aucun depassement.
await appuyer(kenza.page, 'ACCUEIL', { attendu: 'text=MEILLEURS PARCOURS' });
await dormir(1500);
await appuyer(kenza.page, 'VOIR LE CLASSEMENT DES DUELS',
              { attendu: 'button[aria-label^="DÉFIER"]' });
await dormir(2000);
cam.marque('classement-en-attente');

// ------------------------------------------- la cible releve, et elle perd
console.log(`   ${J.cible} releve le defi…`);
await omar.page.goto(URL_JEU + '?defi=' + code, { waitUntil: 'networkidle' });
await dormir(2600);
await omar.page.tap('body', { position: { x: 200, y: 600 } });
await attendreEcran(omar.page, 'RELEVER LE DÉFI');
await appuyerSur(omar.page, 'button:has-text("RELEVER LE DÉFI")');
await courir(omar.page, { niveau: 'solide', duree: 12500 });
await dormir(2500);
const chronoOmar = Math.round(parseFloat(
  ((await omar.page.innerText('body')).match(/CUMUL : ([\d.]+) S/) || [])[1]) * 1000);
console.log(`   ${J.cible} :`, chronoOmar / 1000, 's');
cam.marque('duel-tranche');

/* La fenetre du duel arrive par la boite (WebSocket), donc tout de suite ;
   le classement, lui, se rafraichit toutes les vingt secondes. On referme
   donc la fenetre VITE et on reste sur le tableau : c'est la seule facon de
   voir la ligne GLISSER a sa nouvelle place. */
await kenza.page.waitForFunction(
  () => /DUEL GAGN|TU L.EMPORTES/i.test(document.body.innerText), null, { timeout: 40000 });
cam.marque('duel-gagne');
await dormir(2600);
await dormir(1000);
await appuyerSur(kenza.page, 'button:has-text("COMPRIS")', {});
await dormir(1000);
cam.marque('retour-classement');

// On attend, sur le tableau ouvert, que la ligne remonte d'elle-meme.
const monte = await kenza.page.waitForFunction((nom) => {
  const l = [...document.querySelectorAll('div')].find(d =>
    /^\s*3\.\s/.test(d.innerText) && d.innerText.includes(nom) && d.innerText.length < 130);
  return !!l;
}, J.camera, { timeout: 26000 }).catch(() => null);
cam.marque(monte ? 'classement-monte' : 'classement-inchange');
await dormir(3500);
await dormir(2500);

await cam.arreter();

// Ce que le serveur a retenu du duel. Les cartons du montage liront ces
// chiffres-la, et pas une valeur recopiee a la main.
const duel = await kenza.page.evaluate(async (nom) =>
  (await (await fetch('http://127.0.0.1:8787/duels?name=' + nom)).json()).moi, J.camera);
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({
  kenza_ms: chronoKenza, omar_ms: chronoOmar,
  ecart_ms: chronoOmar - chronoKenza, lp: duel?.last_delta ?? null,
  rang: duel?.rank ?? null,
}, null, 1));
await b.close();
