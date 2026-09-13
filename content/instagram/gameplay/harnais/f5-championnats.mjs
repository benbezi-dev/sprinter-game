/**
 * 5 · LES CHAMPIONNATS
 *
 * Un championnat n'est pas un ecran qu'on ouvre : c'est un calendrier qui
 * tourne. On filme donc l'ecran de la camera PENDANT que le weekend se deroule —
 * series, repechages, demi-finales, finale, sacre — chaque phase etant
 * declenchee depuis le serveur entre deux plans. C'est la seule facon d'avoir
 * une grille qui se remplit et un podium qui arrive : sur une edition deja
 * terminee, l'ecran ne montre qu'un resultat.
 *
 * La camera court pour la France (drapeau pose dans la base semee), et le
 * harnais lui donne un cran d'avance sur ses adversaires — il faut bien que quelqu'un
 * soit sacre, et l'ecran suit ce joueur-la.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { J, cle } from './noms.mjs';

/**
 * LA LANGUE DE LA CAPTURE, et les etiquettes qu'il faut viser dans chacune.
 *
 * Le harnais cliquait sur des libelles francais en dur — 'DÉFI', 'CONTINUER',
 * 'voir le podium'. Une capture anglaise ne trouve aucun de ces boutons et
 * s'arrete au premier ; il faut donc les nommer par ROLE ici, une fois, et les
 * traduire d'apres l'i18n du jeu (`src/game/sprinter-i18n.js`) et non d'apres
 * mon anglais : `duel_open`, `champ_continue`, `champ_sacre`, `mode_versus`,
 * `mode_career`.
 *
 * `champ` est un ANCRE et non un titre : le titre complet vaut « Championnat
 * de France » en francais et « France National Championship » en anglais, et
 * il change avec le pays. On attend donc le mot qui reste. Il valait
 * 'Championnat national' jusqu'au 8 septembre, date a laquelle le mot
 * « national » a ete retire du nom de l'echelon (voir championnats-config.js) :
 * l'attente serait tombee en panne au prochain tournage.
 */
const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const MOTS = {
  fr: { carriere: 'CARRIÈRE', defi: 'DÉFI', champ: 'Championnat',
        continuer: 'CONTINUER', podium: 'voir le podium',
        duels: 'VOIR LE CLASSEMENT DES DUELS' },
  en: { carriere: 'CAREER', defi: 'CHALLENGE', champ: 'Championship',
        continuer: 'CONTINUE', podium: 'see the podium',
        duels: 'VIEW DUEL RANKING' },
}[LANGUE];

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
// Les deux langues ne partagent pas leur rush : elles n'ont pas les memes
// mots a l'ecran, et un montage doit pouvoir refaire l'une sans l'autre.
const DOSSIER = `${SORTIE}/05-championnats${LANGUE === 'en' ? '-en' : ''}`;
const API = 'http://127.0.0.1:8787';
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const get = u => fetch(API + u).then(r => r.json());
async function post(u, b) {
  for (let i = 0; i < 15; i++) {
    const r = await fetch(API + u, { method: 'POST', headers: ADMIN, body: JSON.stringify(b) }).then(x => x.json());
    if (!/trop de tentatives/i.test(r.error || '')) return r;
    await dormir(11000);
  }
  return { error: 'limite de debit jamais levee' };
}
let graine = 20260906;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const niveau = {};

/** Fait courir UNE phase de l'edition, et la cloture. */
async function unePhase(id, favori) {
  const etat = await get('/champ/edition/' + id);
  if (etat.error || etat.etat === 'terminee') return { fini: true, etat };
  const courses = [...new Set(etat.partants.filter(p => p.phase === etat.phase).map(p => p.course))].sort((a, b) => a - b);
  for (const c of courses) {
    const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
    const chronos = partants.map(p => {
      if (niveau[p.name_key] == null) {
        const base = 9400 + (p.rang_duel || 16) * 22;
        niveau[p.name_key] = p.name_key === favori ? base - 190 : base;
      }
      return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 220) };
    });
    const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
    if (r.error) return { erreur: `${r.error} (course ${c})` };
  }
  const cl = await post('/champ/cloturer', { edition: id });
  return { phase: etat.phaseNom || etat.phase, finale: !!cl.finale, champion: cl.champion, erreur: cl.error };
}

console.log(`\n── 5 · CHAMPIONNATS · ${LANGUE.toUpperCase()} ───────────────────────────`);

// 1 · le weekend s'ouvre. Huit nationaux le meme jour : c'est ce qui donne au
//     mot « championnat » sa taille, meme si l'ecran n'en montre qu'un.
const samedi = Date.UTC(2026, 8, 5);
const cycle = await post('/champ/cycle', { debut: samedi, echelon: 'national' });
const editions = [
  ...(cycle.ouvertes || []).map(e => ({ zone: e.zone, edition: e.edition || e.id })),
  ...(cycle.ecartes || []).filter(e => e.edition).map(e => ({ zone: e.zone, edition: e.edition })),
];
const fr = editions.find(e => e.zone === 'FR');
console.log(`   ${editions.length} nationaux ouverts · France : ${fr?.edition}`);

const b = await navigateur();
const { page, cdp } = await telephone(b, { nom: J.camera, device: APP[J.camera], langue: LANGUE });
page.on('dialog', async d => { await d.accept(); });
await page.goto(URL_JEU, { waitUntil: 'networkidle' });
await cadrer(cdp);
await dormir(2400);
await page.tap('body', { position: { x: 200, y: 600 } });
await attendreEcran(page, MOTS.carriere);
// Le championnat vit dans l'onglet DEFI, avec les autres modes a plusieurs :
// il n'apparait pas sur l'accueil de la carriere.
await appuyer(page, MOTS.defi, { exact: true });
await attendreEcran(page, MOTS.champ);
await dormir(1400);

const cam = new Camera(page, DOSSIER, 30, cdp);
await cam.demarrer();
cam.marque('grille-depart');
console.log('   ', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 400));
await dormir(3600);

// 2 · les phases, une par une, filmees pendant qu'elles tombent.
let champion = null;
for (let i = 0; i < 6; i++) {
  const r = await unePhase(fr.edition, cle(J.camera));
  if (r.fini || r.erreur) { console.log('   phase :', r.erreur || 'terminee'); break; }
  cam.marque(`phase-${i + 1}`);
  console.log(`   phase ${i + 1} : ${r.phase}${r.finale ? ' → ' + r.champion : ''}`);
  await dormir(4200);
  // La revelation des repeches demande un geste : c'est une annonce, pas un
  // rafraichissement, et elle attend qu'on l'ait lue.
  try { await appuyer(page, MOTS.continuer, { exact: true, essais: 1 }); await dormir(2600); } catch (e) {}
  if (r.finale) { champion = r.champion; break; }
}
cam.marque('finale-courue');
await dormir(3000);

// 3 · le sacre, puis le podium.
try {
  await appuyer(page, MOTS.podium, { essais: 3 });
  await dormir(3000);
} catch (e) { console.log('   pas de lien vers le podium'); }
cam.marque('podium');
console.log('   ', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 400));
await dormir(4200);

// 4 · ce que le titre laisse : une medaille sur sa ligne du classement.
try { await appuyer(page, MOTS.continuer, { exact: true, essais: 2 }); await dormir(1600); } catch (e) {}
await appuyer(page, MOTS.duels, { attendu: 'button[aria-label^="DÉFIER"], button[aria-label^="CHALLENGE"]' });
await dormir(3400);
cam.marque('medaille');
await dormir(3000);

await cam.arreter();
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({ champion, zone: 'FR', nationaux: editions.length, langue: LANGUE }, null, 1));
await b.close();
