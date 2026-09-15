/**
 * 6 · L'ARRIVEE SERREE — la course qu'on perd d'un centieme.
 *
 *     node f6-arrivee-serree.mjs              # jusqu'a 8 prises
 *     ESSAIS=12 node f6-arrivee-serree.mjs
 *
 * Pour le reel du meme nom (t2-arrivee-serree.mjs). Son ressort est celui des
 * publicites de jeux qui montrent une erreur evidente : le coureur filme MENE,
 * leve les doigts quelques metres avant la ligne, et se fait reprendre d'un
 * rien. Le spectateur voit la faute avant le resultat — « appuie jusqu'au
 * bout ! » — et c'est elle qui lui donne envie d'essayer.
 *
 * CE QUI EST MIS EN SCENE, ET CE QUI NE L'EST PAS. Le relachement est ecrit :
 * le harnais cesse d'appuyer pendant quelques centaines de millisecondes, a un
 * instant choisi (`relache` de course.mjs). Tout le reste est le vrai jeu : la
 * vraie salle en direct, deux telephones, un seul coup de pistolet, la vraie
 * physique qui ralentit un coureur qui n'appuie plus, le vrai chronometrage.
 * L'ecart final n'est pas choisi, il se MESURE : on refilme en ajustant la
 * duree du relachement jusqu'a obtenir une defaite au centieme.
 *
 * UN DOSSIER NEUF, ET RIEN D'EFFACE QUI NE SOIT A LUI. f2-direct supprime
 * `02-course-en-direct` avant d'y ranger sa prise ; ce script-ci n'ecrit que
 * dans `06-arrivee-serree`, range de cote un rush precedent au lieu de
 * l'effacer, et ne supprime que les essais qu'il vient lui-meme de filmer.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { courir } from './course.mjs';
import { readFileSync, writeFileSync, rmSync, renameSync, existsSync } from 'node:fs';
import { J } from './noms.mjs';

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const DOSSIER = `${SORTIE}/06-arrivee-serree`;
const ESSAIS = Number(process.env.ESSAIS || 8);

// Le relachement commence 8,25 s apres le premier appui : a ce niveau le 100 m
// se court en 9,2 s environ, il reste donc une dizaine de metres — assez pres
// de la ligne pour que la faute se lise comme une faute de fin de course.
const RELACHE_APRES = 8250;

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
  await dormir(1000);
  await appuyer(page, 'COURSE EN DIRECT');
  await dormir(1200);
  return { ctx, page, cdp };
}

const chrono = (texte, qui) => {
  const m = texte.match(new RegExp(qui + '\\s+([\\d]+[.,][\\d]+)\\s*s'));
  return m ? parseFloat(m[1].replace(',', '.')) : NaN;
};

/** Une prise : une piste ouverte, deux coureurs, une faute, une arrivee. */
async function prise(n, pendant) {
  const dossier = `${DOSSIER}-essai-${n}`;
  const cam_ = await entrer(J.camera);
  const riv = await entrer(J.rivale);
  let code = null;
  cam_.page.on('response', async r => {
    if (r.url().includes('/live/nouveau')) {
      try { const j = await r.json(); code = j.code || j.id || j.salle; } catch (e) {}
    }
  });

  const cam = new Camera(cam_.page, dossier, 30, cam_.cdp);
  await cam.demarrer();
  cam.marque('panneau-direct');
  await dormir(1500);

  await appuyerSur(cam_.page, 'button:has-text("OUVRIR UNE PISTE")');
  await dormir(2400);
  cam.marque('piste-ouverte');

  await riv.page.locator('input').last().fill(code);
  await dormir(400);
  await appuyerSur(riv.page, 'button:has-text("REJOINDRE")');
  await dormir(2600);
  cam.marque('couloirs-pris');

  for (const p of [cam_, riv]) await appuyerSur(p.page, 'button:has-text("JE SUIS PRÊT")');
  await dormir(1000);
  cam.marque('presentation');

  await Promise.all([
    courir(cam_.page, { niveau: 'fort', duree: 12000,
                        relache: { apres: RELACHE_APRES, pendant },
                        quand: { depart: () => cam.marque('depart'),
                                 relache: () => cam.marque('relache') } }),
    courir(riv.page, { niveau: 'bon', duree: 12000 }),
  ]);
  cam.marque('fin-des-appuis');
  await dormir(3800);
  cam.marque('resultat');
  await dormir(3200);
  await cam.arreter();

  const texte = (await cam_.page.innerText('body')).replace(/\s+/g, ' ');
  const moi = chrono(texte, 'TOI'), lui = chrono(texte, J.rivale);
  // L'ecart que le JEU affiche sous les deux chronos (« 0.01 s d'écart »). Il
  // se calcule sur les millisecondes et peut differer de la difference des
  // deux chronos arrondis : 9.37 - 9.35 donnait 0,02 quand l'ecran disait 0,01.
  // C'est lui que le film doit reprendre, sans quoi il contredit l'ecran.
  const affiche = texte.match(/(\d+[.,]\d+)\s*s\s*d.[ée]cart/i);
  await cam_.ctx.close(); await riv.ctx.close();
  const ecart = Math.round((moi - lui) * 100) / 100;   // > 0 : la camera a perdu
  const r = { n, dossier, pendant, moi, lui, ecart,
              affiche: affiche ? parseFloat(affiche[1].replace(',', '.')) : null };
  console.log(`   prise ${n} · relache ${pendant} ms : TOI ${moi} · ${J.rivale} ${lui} · ` +
              (ecart > 0 ? `perdue de ${ecart.toFixed(2)} s` : ecart < 0 ? `gagnee de ${(-ecart).toFixed(2)} s` : 'ex aequo'));
  return r;
}

console.log('\n── 6 · ARRIVEE SERREE ───────────────────────────────────────');
const prises = [];
let pendant = 220;
for (let i = 1; i <= ESSAIS; i++) {
  let r;
  try { r = await prise(i, pendant); prises.push(r); }
  catch (e) { console.log('   prise', i, 'ratee :', String(e).slice(0, 160)); continue; }
  if (!Number.isFinite(r.ecart)) continue;
  // Perdue d'un ou deux centiemes : c'est la prise.
  if (r.ecart > 0 && r.ecart <= 0.02) break;
  // Sinon on corrige la faute : plus longue si la camera tient encore, plus
  // courte si elle perd de trop. Le hasard du doigt fait le reste.
  if (r.ecart <= 0) pendant += r.ecart === 0 ? 40 : 90;
  else pendant = Math.max(60, pendant - (r.ecart > 0.08 ? 90 : 40));
}
await b.close();

// La meilleure : perdue, et de moins possible. A defaut, la plus serree.
const valides = prises.filter(p => Number.isFinite(p.ecart));
const gardee = valides.filter(p => p.ecart > 0).sort((a, b) => a.ecart - b.ecart)[0]
            || valides.sort((a, b) => Math.abs(a.ecart) - Math.abs(b.ecart))[0];
if (!gardee) { console.log('   aucune prise exploitable'); process.exit(1); }
console.log(`   → prise ${gardee.n} gardee (${gardee.ecart > 0 ? 'perdue' : 'non perdue'}, ` +
            `${Math.abs(gardee.ecart).toFixed(2)} s)`);

if (existsSync(DOSSIER)) {
  const quand = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  renameSync(DOSSIER, `${DOSSIER}.remplace-${quand}`);
  console.log(`   rush precedent range : ${DOSSIER}.remplace-${quand}`);
}
renameSync(gardee.dossier, DOSSIER);
for (const p of prises) if (p !== gardee && existsSync(p.dossier)) rmSync(p.dossier, { recursive: true, force: true });
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({
  camera: J.camera, adversaire: J.rivale,
  moi_ms: Math.round(gardee.moi * 1000), lui_ms: Math.round(gardee.lui * 1000),
  ecart_ms: Math.round(gardee.ecart * 1000), perdue: gardee.ecart > 0,
  ...(gardee.affiche != null ? { ecart_affiche_ms: Math.round(gardee.affiche * 1000) } : {}),
  relache: { apres_ms: RELACHE_APRES, pendant_ms: gardee.pendant },
  prises: prises.map(p => ({ n: p.n, pendant: p.pendant, moi: p.moi, lui: p.lui, ecart: p.ecart })),
}, null, 1));
