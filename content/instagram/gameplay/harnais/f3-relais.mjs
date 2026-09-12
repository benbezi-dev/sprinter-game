/**
 * 3 · LE RELAIS 4 × 100
 *
 * Quatre telephones dans la meme salle, un temoin qui passe de main en main.
 * C'est le mode le plus difficile a filmer du jeu — la piste ne s'ouvre que
 * lorsque les quatre coureurs y sont entres — et c'est celui qui n'avait
 * jamais pu l'etre.
 *
 * Deux choses le rendent possible ici :
 *   · l'appui part DE LA PAGE, et le bouton du temoin ecoute `pointerdown` :
 *     on envoie donc la sequence pointeur entiere, pas un simple `click()` ;
 *   · le passage se joue A DEUX. Le donneur et le receveur touchent au meme
 *     instant, et l'ecart entre les deux touches — mesure sur l'horloge de la
 *     salle — donne la note (parfait sous 70 ms, bon sous 180). Le harnais
 *     tape donc les deux boutons dans le meme tour de boucle.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, ouvrirPanneau, URL_JEU } from './base.mjs';
import { taper, attendrePistolet } from './course.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { J, RELAIS } from './noms.mjs';

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const DOSSIER = `${SORTIE}/03-relais-4x100`;
const EQUIPE = 'COMÈTE';
// L'equipe vient du repertoire, dans l'ordre des passages de temoin.
const NOMS = RELAIS;

/* Une prise rejouee doit repartir d'une equipe qui n'existe pas : le jeu
   refuse deux equipes de meme composition, et le panneau afficherait celle de
   la prise precedente au lieu de la montrer se monter. */
for (const sql of [
  "DELETE FROM relay_members WHERE team_id IN (SELECT id FROM relay_teams WHERE name_key = 'comète')",
  "DELETE FROM relay_teams WHERE name_key = 'comète'",
]) execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard', '--local', '--command', sql],
                { cwd: '/Volumes/MUSIQUE/BENBEZI/Sprinter/worker', stdio: 'ignore' });

const b = await navigateur();

async function entrer(nom) {
  const { ctx, page, cdp } = await telephone(b, { nom, device: APP[nom] });
  page.on('dialog', async d => { await d.accept(); });
  await page.goto(URL_JEU, { waitUntil: 'networkidle' });
  await cadrer(cdp);
  await dormir(2400);
  await page.tap('body', { position: { x: 200, y: 600 } });
  await attendreEcran(page, 'CARRIÈRE');
  await appuyer(page, 'DÉFI', { exact: true });
  await dormir(900);
  await ouvrirPanneau(page, 'RELAIS 4 × 100', 'CLASSEMENT DES ÉQUIPES');
  return { nom, ctx, page, cdp };
}

/** Le bouton du temoin, s'il est arme. */
const temoinArme = (page, quoi) => page.evaluate(mot => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.innerText.toUpperCase().includes(mot) && !x.disabled);
  return !!b;
}, quoi);

/** Taper le temoin, depuis la page, en pointeur (le bouton ecoute pointerdown). */
const taperTemoin = (page, quoi) => page.evaluate(mot => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.innerText.toUpperCase().includes(mot) && !x.disabled);
  if (!b) return false;
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup');
  return true;
}, quoi);

console.log('\n── 3 · RELAIS 4 × 100 ───────────────────────────────────────');
const tel = {};
for (const n of NOMS) { tel[n] = await entrer(n); }
console.log('   quatre telephones sur le panneau relais');

const cam = new Camera(tel[J.camera].page, DOSSIER, 30, tel[J.camera].cdp);
await cam.demarrer();
cam.marque('panneau-relais');
await dormir(1400);

// ------------------------------------------------------------ monter l'equipe
const champs = await tel[J.camera].page.locator('input').all();
await champs[0].fill(EQUIPE);
for (let i = 1; i <= 3; i++) await champs[i].fill(NOMS[i]);
await dormir(900);
cam.marque('equipe-saisie');
await appuyerSur(tel[J.camera].page, 'button:has-text("INVITER LES TROIS")');
await dormir(2400);
cam.marque('invitations-envoyees');

// --------------------------------------------------------- les trois acceptent
for (const n of NOMS.slice(1)) {
  const p = tel[n].page;
  await p.reload({ waitUntil: 'networkidle' });
  await dormir(2000);
  await p.tap('body', { position: { x: 200, y: 600 } });
  await attendreEcran(p, 'CARRIÈRE');
  await appuyer(p, 'DÉFI', { exact: true });
  await dormir(700);
  await ouvrirPanneau(p, 'RELAIS 4 × 100', 'CLASSEMENT DES ÉQUIPES');
  await appuyerSur(p, 'button[aria-label="accepter"]');
  await dormir(1400);
  console.log(`   ${n} accepte`);
}
await dormir(1800);

/** Ramener un telephone sur le panneau du relais, a jour. */
async function revenirAuRelais(n) {
  const p = tel[n].page;
  await p.reload({ waitUntil: 'networkidle' });
  await dormir(1800);
  await p.tap('body', { position: { x: 200, y: 600 } });
  await attendreEcran(p, 'CARRIÈRE');
  await appuyer(p, 'DÉFI', { exact: true });
  await dormir(700);
  await ouvrirPanneau(p, 'RELAIS 4 × 100', 'CLASSEMENT DES ÉQUIPES');
}

// La camera d'abord : son panneau date de l'envoi des invitations et ne s'est
// jamais rafraichi depuis. Sans ce rechargement, sa carte d'equipe reste
// « en attente » et ni l'ordre ni l'entree sur la piste ne s'y trouvent.
await revenirAuRelais(J.camera);
await dormir(1600);
cam.marque('equipe-prete');
const etatEquipe = (await tel[J.camera].page.innerText('body')).replace(/\s+/g, ' ');
console.log('   ', etatEquipe.slice(etatEquipe.indexOf('TES ÉQUIPES'), etatEquipe.indexOf('TES ÉQUIPES') + 260));
await dormir(2600);

// ------------------------------------------------------------------ l'ordre
await appuyerSur(tel[J.camera].page, 'button:has-text("FIXER L")', { essais: 2 }).catch(() => console.log('   ordre : deja fixe'));
await dormir(2000);
cam.marque('ordre-fixe');
await dormir(1600);

// ------------------------------------------------------- entrer sur la piste
for (const n of NOMS.slice(1)) await revenirAuRelais(n);
await Promise.all(NOMS.map(n =>
  appuyerSur(tel[n].page, 'button:has-text("ENTRER SUR LA PISTE")').catch(e =>
    console.log(`   ${n} : pas de bouton piste`))));
await dormir(3000);
cam.marque('sur-la-piste');
console.log('   piste :', (await tel[J.camera].page.innerText('body')).replace(/\s+/g, ' ').slice(0, 260));

// Le vestiaire de la piste : les quatre noms, et un bouton chacun. La course
// ne part que lorsque les quatre ont dit qu'ils y etaient — c'est ce qui
// remplace le « tout le monde est la ? » d'un stade.
await dormir(2200);
cam.marque('vestiaire');
await dormir(2000);
/* « JE SUIS PRÊT » existe DEUX FOIS dans la page : le vestiaire du relais le
   porte, et le salon de la course en direct aussi. `.first()` prend celui du
   direct — qui n'a rien a voir avec la piste ouverte — et le relais attend un
   coureur qui ne se declarera jamais. On vise donc le bouton QUI EST DANS LE
   VESTIBULE, en le cherchant depuis la page. */
const direPret = (page) => page.evaluate(() => {
  const boutons = [...document.querySelectorAll('button')]
    .filter(b => /JE SUIS PR/i.test(b.innerText) && !b.disabled);
  // Le vestiaire du relais est un panneau plein ecran : son bouton est le
  // plus bas dans l'arbre et le plus large. On prend le dernier, qui est
  // celui de la couche posee par-dessus.
  const b = boutons[boutons.length - 1];
  if (!b) return 'aucun';
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup'); b.click();
  return `${boutons.length} bouton(s)`;
});
for (const n of NOMS) console.log(`   ${n} pret : ${await direPret(tel[n].page)}`);
await dormir(900);
for (const n of NOMS) {
  const t = (await tel[n].page.innerText('body')).replace(/\s+/g, ' ');
  console.log(`   ${n} voit : ${/PAS ENCORE|PRÊT|MARQUES|TÉMOIN|relayeur/i.test(t) ? 'la piste' : 'le panneau'}`);
}
cam.marque('tous-prets');

// ------------------------------------------------------------------ la course
// Le premier relayeur part des blocs : taper avant le pistolet elimine
// l'equipe entiere. On attend donc le signal AVANT de lancer les quatre
// cadences.
await attendrePistolet(tel[J.camera].page, 30000).catch(() => console.log('   pistolet non detecte'));
// Une reaction humaine, et pas zero : le decompte disparait de l'ecran un
// souffle avant le pistolet, et le premier relayeur part des blocs — un faux
// depart elimine TOUTE l'equipe, pas seulement lui.
await dormir(320);
cam.marque('depart');
const raconter = async (quand) => {
  const t = (await tel[J.camera].page.innerText('body')).replace(/\s+/g, ' ');
  console.log(`   +${quand}s : ${t.slice(0, 150)}`);
};
/*
 * LA COURSE, ET LA REGLE DU TEMOIN.
 *
 * Deux eliminations successives ont appris la regle, qui est celle de
 * l'athletisme et que le serveur applique au metre pres
 * (`worker/src/relais-course.js`) :
 *
 *   · la zone du relayeur k va de (k-1) x 100 m a (k-1) x 100 + 30 m ;
 *   · AU MOMENT DE LA PASSE, LE DONNEUR ET LE RECEVEUR DOIVENT Y ETRE TOUS
 *     LES DEUX. Donner avant l'entree elimine l'equipe ; sortir de la zone
 *     sans le temoin aussi.
 *   · la note est meilleure au tiers median de la zone, et si les deux tapes
 *     tombent a moins de 120 ms l'une de l'autre.
 *
 * D'ou la conduite : le receveur ne se lance PAS au coup de pistolet — il
 * sortirait de sa zone bien avant le temoin — mais quand le porteur approche
 * de la marque, et la passe se declenche sur la distance lue a l'ecran, pas
 * sur un delai fixe.
 */
const LEG = 100, ZONE = 30;

/** La distance du temoin, lue sur le couloir de l'equipe. */
const distanceTemoin = (page) => page.evaluate(() => {
  const m = [...document.body.innerText.matchAll(/(\d+)\s*m\b/g)].map(x => +x[1]);
  return m.length ? Math.max(...m) : -1;
});

const courses = [taper(tel[NOMS[0]].page, { cadence: 10.2, duree: 52000 }).catch(() => {})];
let passes = 0;
const fin = Date.now() + 55000;

while (Date.now() < fin && passes < 3) {
  const donneur = NOMS[passes], receveur = NOMS[passes + 1];
  const zone = passes * LEG + LEG;               // entree de la zone du receveur
  const d = await distanceTemoin(tel[donneur].page);

  // Le receveur se lance seize metres avant la marque : le temps que le
  // temoin arrive, il est lance et encore dans sa zone.
  if (d >= zone - 16 && courses.length === passes + 1) {
    courses.push(taper(tel[receveur].page, { cadence: 10.2, duree: 40000 }).catch(() => {}));
    console.log(`   ${receveur} se lance (temoin a ${d} m)`);
  }

  // La passe : le donneur est entre dans la zone, le receveur y est lance.
  if (d >= zone + 4 && d <= zone + ZONE - 6) {
    const [donne, prend] = await Promise.all([
      taperTemoin(tel[donneur].page, 'DONNE'),
      taperTemoin(tel[receveur].page, 'PRENDS'),
    ]);
    console.log(`   passe ${passes + 1} : ${donneur} → ${receveur} a ${d} m  ${donne ? '✓' : '✗'}donne ${prend ? '✓' : '✗'}prend`);
    if (prend) { passes++; cam.marque(`passe-${passes}`); await dormir(400); }
    else await dormir(150);
    continue;
  }
  await dormir(70);
}
console.log('   passes reussies :', passes);
await Promise.all(courses);
cam.marque('arrivee');
await dormir(4000);
const fini = (await tel[J.camera].page.innerText('body')).replace(/\s+/g, ' ');
console.log('   fin :', fini.slice(0, 420));
cam.marque('resultat');
await dormir(3000);
await cam.arreter();
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({ equipe: EQUIPE, passes, ordre: NOMS }, null, 1));
await b.close();
