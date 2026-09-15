/**
 * 7 · LE FANTOME, PERDU D'UN CENTIEME.
 *
 *     node f7-fantome-serre.mjs              # jusqu'a 10 prises
 *     ESSAIS=14 node f7-fantome-serre.mjs
 *     LANGUE=en node f7-fantome-serre.mjs    # le jeu en anglais
 *
 * LES DEUX LANGUES ONT CHACUNE LEUR RUSH : les mots sont DANS L'IMAGE — « DÉFI
 * PERDU » contre « CHALLENGE LOST », « MODE FANTÔME » contre « GHOST MODE ».
 * Un carton anglais sur un rush francais serait un sous-titre qui contredit
 * l'ecran.
 *
 * Remplace f6 pour le reel de l'arrivee serree (t2-arrivee-serree.mjs), et
 * pour une raison que l'image a revelee : f6 filmait une course EN DIRECT, et
 * a quelques centiemes pres l'ecran mentait. Le jeu y place l'adversaire
 * d'apres la derniere position qu'il a envoyee et une vitesse estimee
 * (`liveDist`, src/game/sprinter-app.js) : sur la prise gardee, TOI passait la
 * ligne en premier a l'ecran d'une course que le chrono lui donnait perdue de
 * 0,01 s. Un FANTOME, lui, est rejoue a partir de sa course enregistree, sur
 * la meme horloge que le joueur : ce que l'on voit a la ligne est le resultat.
 *
 * UNE PRISE. ZEPHYR court son 100 m et lance le defi ; VOLT, filme, le releve
 * et court contre son fantome. VOLT mene, leve les doigts une dizaine de metres
 * avant la ligne (`relache` de course.mjs) et se fait reprendre. Le chrono du
 * fantome etant connu AVANT que VOLT coure, la duree du relachement se calcule
 * pour viser un centieme de retard, et le modele se corrige d'une prise a
 * l'autre avec ce que VOLT a reellement couru.
 *
 * Seul le relachement est ecrit ; tout le reste est le vrai jeu, et l'ecart se
 * mesure. Rien n'est efface qui n'appartienne a ce script : il n'ecrit que dans
 * `07-fantome-serre`, range de cote un rush precedent, et ne supprime que les
 * essais qu'il vient de filmer.
 */
import { navigateur, telephone, Camera, cadrer, dormir, appuyer, appuyerSur,
         attendreEcran, URL_JEU } from './base.mjs';
import { courir } from './course.mjs';
import { readFileSync, writeFileSync, rmSync, renameSync, existsSync } from 'node:fs';
import { J } from './noms.mjs';

const APP = JSON.parse(readFileSync(new URL('./appareils.json', import.meta.url)));
const SORTIE = process.env.SORTIE || '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const DOSSIER = `${SORTIE}/07-fantome-serre${LANGUE === 'en' ? '-en' : ''}`;

// Les libelles vises, par ROLE, d'apres l'i18n du jeu (src/game/sprinter-i18n.js :
// mode_career, duel_open, challenge_them, challenge_make, challenge_accept,
// total_in, challenge_gap) et non d'apres une traduction a moi.
const MOTS = {
  fr: { carriere: 'CARRIÈRE', duels: 'VOIR LE CLASSEMENT DES DUELS', defier: 'DÉFIER',
        ami: 'DÉFIER UN AMI', relever: 'RELEVER LE DÉFI', total: 'CUMUL', ecart: 'ÉCART' },
  en: { carriere: 'CAREER', duels: 'VIEW DUEL RANKING', defier: 'CHALLENGE',
        ami: 'CHALLENGE A FRIEND', relever: 'ACCEPT THE CHALLENGE', total: 'TOTAL', ecart: 'GAP' },
}[LANGUE];
const ESSAIS = Number(process.env.ESSAIS || 10);

// Le relachement commence 8,25 s apres le premier appui : il reste une
// dizaine de metres, assez pres de la ligne pour que la faute se lise comme
// une faute de fin de course.
const RELACHE_APRES = 8250;

// Le modele du relachement : chrono de VOLT ≈ BASE + PENTE × duree (s). La
// pente vient des prises de f6 (220 ms → 9,28 s ; 440 ms → 9,39 s) ; BASE se
// recale sur chaque prise. Elle part de 9,50 et non de 9,19 : FILME, VOLT
// court plus lentement — la capture charge le navigateur et ses appuis
// partent en retard (9,65 s avec 389 ms de relachement, premiere serie
// d'essais du 15 septembre).
const PENTE = 0.45;
let BASE = 9.50;

// Le fantome court SANS camera, donc sans ce handicap : au niveau « bon » il
// passait en 9,34 s, et VOLT, filme, ne menait jamais — panneau rouge des le
// coup de pistolet. Au niveau « solide » il court vers 9,70 s (f1, 6 septembre),
// ce qui laisse a VOLT deux metres d'avance a perdre.
const NIVEAU_FANTOME = process.env.NIVEAU_FANTOME || 'solide';

// LE RELACHEMENT PILOTE PAR LE PANNEAU (par defaut). Viser le centieme avec une
// duree fixe s'est revele un pari : filme, VOLT court a 0,1 s pres d'une prise
// a l'autre, et 300 ms de relachement donnaient +0,21 s, 900 ms -0,23 s, 178 ms
// +0,09 s. Or, face a un FANTOME, le panneau d'ecart du jeu est exact — le
// fantome est rejoue sur la meme horloge. VOLT leve donc les doigts et ne
// reprend que lorsque le panneau est descendu a SEUIL metres ; c'est ce seuil,
// et non une duree, qui se regle d'une prise a l'autre. `DUREE=1` revient au
// relachement a duree fixe.
const PILOTE = process.env.DUREE !== '1';
// 1,4 m : le seuil ou le premier tournage (francais) a converge.
let SEUIL = Number(process.env.SEUIL || 1.4);
let PAS_SEUIL = Number(process.env.PAS_SEUIL || 0.2), SENS = 0;

/** Le chiffre du panneau d'ecart, en metres : « +2.5m » → 2.5. */
async function lirePanneau(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('span.font-mono.font-black')]
      .find(s => /m\s*$/.test((s.textContent || '').trim()));
    if (!el) return null;
    const m = el.textContent.replace(/\s/g, '').replace('−', '-').match(/([+-]?\d+(?:\.\d+)?)m$/);
    return m ? parseFloat(m[1]) : null;
  }).catch(() => null);
}
const VISEE = 0.015;              // un centieme et demi de retard, au milieu de la cible

const b = await navigateur();

async function entrer(nom, url = URL_JEU) {
  const { ctx, page, cdp } = await telephone(b, { nom, device: APP[nom], langue: LANGUE });
  page.on('dialog', async d => { await d.accept(); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await cadrer(cdp);
  await dormir(2400);
  await page.tap('body', { position: { x: 200, y: 600 } });
  return { ctx, page, cdp };
}

const cumul = t => {
  const m = t.match(new RegExp(MOTS.total + '\\s*:\\s*([\\d]+[.,][\\d]+)\\s*S', 'i'));
  return m ? parseFloat(m[1].replace(',', '.')) : NaN;
};

/** ZEPHYR court et lance le defi. Rend le code et le chrono de son fantome. */
async function lancerDefi() {
  const riv = await entrer(J.rivale);
  await attendreEcran(riv.page, MOTS.carriere);
  let code = null;
  riv.page.on('response', async r => {
    if (r.url().includes('/challenge') && r.request().method() === 'POST') {
      try { code = (await r.json()).id; } catch (e) {}
    }
  });
  await appuyer(riv.page, MOTS.duels, { attendu: `button[aria-label^="${MOTS.defier}"]` });
  await dormir(1500);
  await appuyerSur(riv.page, `button[aria-label="${MOTS.defier} ${J.camera}"]`, {});
  await dormir(1200);
  await courir(riv.page, { niveau: NIVEAU_FANTOME, duree: 12500 });
  await dormir(2400);
  const fantome = cumul(await riv.page.innerText('body'));
  await appuyerSur(riv.page, `button:has-text("${MOTS.ami}")`, {});
  await dormir(3000);
  await riv.ctx.close();
  return { code, fantome };
}

/** Une prise : un defi lance, releve par VOLT, une faute, une arrivee. */
async function prise(n) {
  const { code, fantome } = await lancerDefi();
  if (!code || !Number.isFinite(fantome)) throw new Error(`defi incomplet (code ${code}, fantome ${fantome})`);
  const pendant = PILOTE ? 1500
    : Math.round(Math.min(900, Math.max(80, (fantome + VISEE - BASE) / PENTE * 1000)));
  console.log(`   prise ${n} : fantome de ${J.rivale} en ${fantome} s → ` +
              (PILOTE ? `relache jusqu'a ${SEUIL.toFixed(2)} m au panneau` : `relache ${pendant} ms`));

  const dossier = `${DOSSIER}-essai-${n}`;
  const volt = await entrer(J.camera, URL_JEU + '?defi=' + code);
  const cam = new Camera(volt.page, dossier, 30, volt.cdp);
  await cam.demarrer();
  cam.marque('defi-recu');
  await attendreEcran(volt.page, MOTS.relever);
  await dormir(1800);
  cam.marque('relever');
  await appuyerSur(volt.page, `button:has-text("${MOTS.relever}")`);
  let leve = null, repris = null, panneauAuRelache = null;
  const tant = async () => {
    const e = await lirePanneau(volt.page);
    if (panneauAuRelache === null) panneauAuRelache = e;
    return e === null ? false : e > SEUIL;
  };
  await courir(volt.page, { niveau: 'fort', duree: 12000,
                            relache: PILOTE ? { apres: RELACHE_APRES, pendant, tant }
                                            : { apres: RELACHE_APRES, pendant },
                            quand: { depart: () => cam.marque('depart'),
                                     relache: () => cam.marque('relache') } });
  cam.marque('fin-des-appuis');
  // Le resultat se lit DES QU'IL S'AFFICHE : lu en fin de prise, apres
  // l'attente des images, la page etait deja passee a blanc sur le premier
  // essai, et le chrono sortait NaN.
  await volt.page.waitForFunction((mot) => new RegExp(mot, 'i').test(document.body.innerText),
                                  MOTS.total, { timeout: 12000 }).catch(() => {});
  const texte = (await volt.page.innerText('body')).replace(/\s+/g, ' ');
  cam.marque('resultat');
  await dormir(3500);
  await cam.arreter();
  await volt.ctx.close();
  const moi = cumul(texte);
  // Deux ecritures de l'ecart selon l'ecran : « 0.01 s d'écart » (course en
  // direct), « ÉCART : 0.45 S » (defi releve).
  const affiche = texte.match(new RegExp(MOTS.ecart + '\\s*:\\s*(\\d+[.,]\\d+)\\s*S', 'i'))
               || texte.match(/(\d+[.,]\d+)\s*s\s*d.[ée]cart/i);
  const ecart = Math.round((moi - fantome) * 100) / 100;   // > 0 : VOLT a perdu
  if (Number.isFinite(moi)) BASE = moi - PENTE * pendant / 1000;
  const r = { n, dossier, pendant, moi, fantome, ecart, seuil: PILOTE ? SEUIL : null,
              panneau: panneauAuRelache,
              affiche: affiche ? parseFloat(affiche[1].replace(',', '.')) : null };
  // Le seuil se regle par dichotomie : trop haut, VOLT reprend trop tot et
  // gagne ; trop bas, il perd de trop.
  if (PILOTE && Number.isFinite(ecart) && panneauAuRelache != null && panneauAuRelache >= SEUIL + 0.3) {
    const sens = ecart <= 0 ? -1 : ecart > 0.02 ? +1 : 0;
    if (sens && SENS && sens !== SENS) PAS_SEUIL /= 2;
    if (sens) { SEUIL += sens * PAS_SEUIL; SENS = sens; }
  }
  console.log(`   prise ${n} · TOI ${moi} · fantome ${fantome} · ` +
              (!Number.isFinite(ecart) ? 'chrono illisible'
               : ecart > 0 ? `perdue de ${ecart.toFixed(2)} s` : ecart < 0 ? `gagnee de ${(-ecart).toFixed(2)} s` : 'ex aequo') +
              (r.affiche != null ? ` (ecran : ${r.affiche} s d'ecart)` : '') +
              (r.panneau != null ? ` · panneau au relachement ${r.panneau} m` : ''));
  return r;
}

console.log('\n── 7 · LE FANTOME, PERDU D\'UN CENTIEME ───────────────────────');
// UNE PRISE QUI RACONTE QUELQUE CHOSE. Perdue d'un ou deux centiemes, mais
// aussi MENEE : si VOLT n'avait pas d'avance a lacher — le panneau sous le
// seuil au moment du relachement, ou dans le rouge parce que la machine, trop
// chargee, a retarde ses appuis — il n'y a ni faute ni histoire, seulement une
// course perdue. Ces prises-la ne reglent pas non plus le seuil.
const MENE_MIN = SEUIL + 0.3;
const menee = r => r.panneau != null && r.panneau >= MENE_MIN;
const bonne = r => menee(r) && r.ecart > 0 && r.ecart <= 0.02;

const prises = [];
for (let i = 1; i <= ESSAIS; i++) {
  let r;
  try { r = await prise(i); prises.push(r); }
  catch (e) { console.log('   prise', i, 'ratee :', String(e).slice(0, 200)); continue; }
  if (bonne(r)) break;
}
await b.close();

const valides = prises.filter(p => Number.isFinite(p.ecart) && (!PILOTE || menee(p)));
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
  camera: J.camera, adversaire: J.rivale, mode: 'defi-fantome', langue: LANGUE,
  moi_ms: Math.round(gardee.moi * 1000), lui_ms: Math.round(gardee.fantome * 1000),
  ecart_ms: Math.round(gardee.ecart * 1000), perdue: gardee.ecart > 0,
  ...(gardee.affiche != null ? { ecart_affiche_ms: Math.round(gardee.affiche * 1000) } : {}),
  relache: { apres_ms: RELACHE_APRES, pilote: PILOTE,
             ...(PILOTE ? { seuil_m: gardee.seuil, panneau_m: gardee.panneau } : { pendant_ms: gardee.pendant }) },
  prises: prises.map(p => ({ n: p.n, pendant: p.pendant, moi: p.moi, fantome: p.fantome, ecart: p.ecart })),
}, null, 1));
