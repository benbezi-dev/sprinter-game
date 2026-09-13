/**
 * 2 · LA COURSE EN DIRECT
 *
 * Deux telephones, une seule piste, un seul coup de pistolet. La camera ouvre un
 * couloir, sa rivale le prend, les deux se declarent pretes et courent EN MEME
 * TEMPS — la salle est un Durable Object, elle porte l'horloge commune.
 *
 * Les deux coureuses sont reglees au MEME niveau : c'est le jitter du doigt,
 * pas un scenario, qui decide de l'ecart. On filme donc PLUSIEURS prises et
 * on garde celle ou la camera l'emporte, et de peu. Rien n'est
 * truque : chaque prise est une vraie course, et on choisit la meilleure,
 * comme on choisirait une prise de vue.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { courir } from './course.mjs';
import { readFileSync, writeFileSync, rmSync, renameSync, existsSync } from 'node:fs';
import { J, RELAIS } from './noms.mjs';

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const DOSSIER = `${SORTIE}/02-course-en-direct`;
const ESSAIS = Number(process.env.ESSAIS || 4);

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

/** Une prise : une piste ouverte, deux coureuses, une arrivee. */
async function prise(n) {
  const dossier = `${DOSSIER}-essai-${n}`;
  const kenza = await entrer(J.camera);
  const nadia = await entrer(J.rivale);
  let code = null;
  kenza.page.on('response', async r => {
    if (r.url().includes('/live/nouveau')) {
      try { const j = await r.json(); code = j.code || j.id || j.salle; } catch (e) {}
    }
  });

  const cam = new Camera(kenza.page, dossier, 30, kenza.cdp);
  await cam.demarrer();
  cam.marque('panneau-direct');
  await dormir(1500);

  await appuyerSur(kenza.page, 'button:has-text("OUVRIR UNE PISTE")');
  await dormir(2400);
  cam.marque('piste-ouverte');

  await nadia.page.locator('input').last().fill(code);
  await dormir(400);
  await appuyerSur(nadia.page, 'button:has-text("REJOINDRE")');
  await dormir(2600);
  cam.marque('couloirs-pris');

  for (const p of [kenza, nadia]) await appuyerSur(p.page, 'button:has-text("JE SUIS PRÊT")');
  await dormir(1000);
  cam.marque('presentation');

  await Promise.all([
    courir(kenza.page, { niveau: 'bon', duree: 12000 }),
    courir(nadia.page, { niveau: 'bon', duree: 12000 }),
  ]);
  cam.marque('arrivee');
  await dormir(3800);
  cam.marque('resultat');
  await dormir(3200);
  await cam.arreter();

  const texte = (await kenza.page.innerText('body')).replace(/\s+/g, ' ');
  const moi  = parseFloat((texte.match(/TOI\s+([\d.]+)\s*s/) || [])[1]);
  const elle = parseFloat((texte.match(
    new RegExp(J.rivale + '\\s+([\\d.]+)\\s*s')) || [])[1]);
  const gagne = /COURSE GAGNÉE|TU L.EMPORTES/i.test(texte) || (moi < elle);
  await kenza.ctx.close(); await nadia.ctx.close();
  const r = { n, dossier, moi, elle, ecart: Math.abs(elle - moi), gagne };
  console.log(`   prise ${n} : TOI ${moi} · ${J.rivale} ${elle} · ecart ${r.ecart.toFixed(2)} s` +
              ` · ${gagne ? 'gagnee' : 'perdue'}`);
  return r;
}

console.log('\n── 2 · COURSE EN DIRECT ─────────────────────────────────────');
const prises = [];
for (let i = 1; i <= ESSAIS; i++) {
  try { prises.push(await prise(i)); } catch (e) { console.log('   prise', i, 'ratee :', String(e).slice(0, 120)); }
  // Une victoire serree suffit : on ne refilme pas pour le plaisir.
  const bonne = prises.find(p => p.gagne && p.ecart <= 0.30);
  if (bonne) break;
}
await b.close();

// La meilleure : gagnee d'abord, puis la plus serree.
const gardee = prises.filter(p => p.gagne).sort((a, b) => a.ecart - b.ecart)[0]
            || prises.sort((a, b) => a.ecart - b.ecart)[0];
if (!gardee) { console.log('   aucune prise exploitable'); process.exit(1); }
console.log(`   → prise ${gardee.n} gardee (${gardee.ecart.toFixed(2)} s d'ecart)`);
rmSync(DOSSIER, { recursive: true, force: true });
renameSync(gardee.dossier, DOSSIER);
for (const p of prises) if (p !== gardee && existsSync(p.dossier)) rmSync(p.dossier, { recursive: true, force: true });
writeFileSync(`${DOSSIER}/faits.json`, JSON.stringify({
  moi_ms: Math.round(gardee.moi * 1000), elle_ms: Math.round(gardee.elle * 1000),
  ecart_ms: Math.round(gardee.ecart * 1000), adversaire: J.rivale, prises: prises.length,
}, null, 1));
