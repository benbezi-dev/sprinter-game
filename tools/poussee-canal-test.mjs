// LE COUP DE POUSSEE, DANS L'UN ET L'AUTRE CANAL.
//
// Ce qui part du coureur quand il reussit son geste — sa trainee, l'onde au
// sol sous ses appuis, l'aura sur son buste — a vecu sur le canal de test, et
// il est ouvert a tout le monde depuis le 19 septembre 2026. Ce harnais
// verifie que les deux canaux en disent la meme chose, c'est-a-dire qu'aucun
// reste de garde ne s'est glisse quelque part : le dessin tenait le sien,
// ecrit en toutes lettres dans sprinter-app.js, en plus du drapeau.
//
// On garde la compilation PAR CANAL pour cela meme. POUSSEE_OUVERTE se replie
// a la compilation, et un seul `VITE_CANAL === 'test'` oublie dans une
// condition redonnerait deux jeux differents sans que personne ne s'en
// apercoive avant de l'ouvrir sur un telephone — c'est precisement ce qui a
// ete retire ici.
//
// L'AUTRE MOITIE DE CE QU'ON VERIFIE tient a ce que l'effet doit etre : une
// IMPULSION, et non un etat. Ce qu'il remplace s'allumait des que le coureur
// passait les trois quarts de son maximum, soit deux images sur trois, et un
// effet permanent n'est plus un effet. On dessine donc la meme image deux
// fois — au repos puis pendant l'impulsion — et on regarde ce que la toile
// recoit de plus, avant de verifier qu'elle est bien redevenue ordinaire une
// fois l'impulsion passee.
//
// ET ON LE FAIT A CHAQUE NIVEAU DE DETAIL, parce que l'effet n'est pas le
// meme selon ce que l'appareil tient. A PLEIN, tout ; a MOYEN, l'onde et
// l'aura sans les trois copies du coureur, qui sont ce que l'effet a de plus
// cher ; en SOBRE, rien du tout, pas meme une impulsion armee. Un appareil en
// difficulte garde donc sa recompense sans payer les echos — c'est la regle
// de la poussiere des appuis, et l'effet la suit maintenant.
//
// Le declenchement, lui, vit dans le composant qui tient la boucle de rendu
// (components/GameCanvas.tsx) et ne se joue pas sans navigateur : ce harnais
// arme l'impulsion a la main, comme le fait une reaction parfaite.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------- le decor
   Un navigateur absent, comme dans les autres harnais — a une chose pres :
   ici le jeu DESSINE, et c'est ce qu'on ecoute. La toile est donc un mouchard
   plutot qu'un pantin : elle note chaque appel et chaque reglage recu, et rend
   ce qu'il faut pour que le rendu ne trebuche pas sur un degrade absent. */

const JAUNE = '248,205,74';   // la couleur de l'onde, dans drawOndePoussee

function toileMouchard(journal) {
  const degrade = { addColorStop() {} };
  const etat = {};
  return new Proxy(etat, {
    get(o, k) {
      if (k in o) return o[k];                       // globalAlpha relu apres reglage
      if (k === 'canvas') return { width: 960, height: 640 };
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => degrade;
      if (k === 'createPattern') return () => null;
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return (...a) => { journal.push([k, ...a]); };
    },
    set(o, k, v) { o[k] = v; journal.push(['=' + k, v]); return true; },
  });
}

globalThis.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  // La couche de finition se prepare des toiles hors ecran — la tache d'ombre,
  // le vignettage. Sans contexte, elle tombe des la premiere ombre.
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => toileMouchard([]) }),
  addEventListener() {}, documentElement: { style: {}, dataset: {} }, body: { style: {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

/* --------------------------------------------------------- les deux jeux */

async function jeuDe(canal) {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-poussee-${canal}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  const src = f => join(process.cwd(), 'src/game', f);
  writeFileSync(entree, [
    `export { SprinterApp, updateLogic } from '${src('engine.ts')}';`,
    `export { POUSSEE_OUVERTE } from '${src('canal.ts')}';`,
  ].join('\n'));
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true,
    format: 'esm', platform: 'node', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_CANAL': JSON.stringify(canal),
      'import.meta.env.BASE_URL': '"/"',
    },
  });
  return import(sortie);
}

/**
 * Trois secondes de course, courues.
 *
 * Le coureur doit AVANCER, et vite : les echos se prennent sur sa propre
 * foulee, un demi-metre derriere lui par copie. Immobile sur la ligne, ils
 * tomberaient tous avant le depart et l'on verifierait une trainee qui ne se
 * dessine pas.
 */
function courseLancee(M) {
  const A = M.SprinterApp, G = A.G;
  A.Audio_.sfx = () => {}; A.Audio_.music = () => {}; A.Audio_.stop = () => {};
  A.startOneShot(['100'], { levelIdx: 0 });
  for (let i = 0; i < 60 * 5 && G.state !== 'race'; i++) M.updateLogic(1 / 60);
  let gauche = true, prochain = 0;
  for (let i = 0; i < 60 * 3; i++) {
    // Neuf appuis par seconde, alternes : la cadence d'un joueur qui tient
    // son rythme. On passe par le coureur plutot que par les paves, dont la
    // tolerance aux doubles appuis se mesure en millisecondes reelles.
    while (prochain <= G.elapsed) {
      G.player.press(gauche ? 'left' : 'right', G.elapsed);
      gauche = !gauche; prochain += 1 / 9;
    }
    M.updateLogic(1 / 60);
  }
  return { A, G };
}

/** Une image dessinee, et ce que la toile en a retenu. */
function image(A) {
  const journal = [];
  A.drawAthletes(toileMouchard(journal));
  const compte = n => journal.filter(x => x[0] === n).length;
  return {
    appels: journal.length,
    fills: compte('fill'),
    onde: journal.some(x => x[0] === '=strokeStyle' && String(x[1]).includes(JAUNE)),
    aura: journal.some(x => x[0] === '=globalCompositeOperation' && x[1] === 'lighter'),
  };
}

const attendre = ms => new Promise(r => setTimeout(r, ms));

/**
 * Un niveau de detail, mesure au repos puis sous l'impulsion.
 *
 * Le repos se reprend A CHAQUE NIVEAU, et ce n'est pas une precaution pour
 * rien : la brume, les ombres et la poussiere changent avec lui, donc le
 * nombre de remplissages d'une image ordinaire aussi. Compare a la ligne de
 * repos d'un autre niveau, l'ecart ne dirait rien de l'effet.
 *
 * L'attente qui ouvre la scene laisse l'impulsion precedente retomber : une
 * impulsion dure 0,85 s, et sans elle la ligne de repos porterait encore la
 * fin de la scene d'avant.
 */
async function scene(A, prem, niveau) {
  prem.niveau = niveau;
  await attendre(950);
  const repos = image(A);
  prem.poussee(1);
  await attendre(60);
  return { repos, vif: image(A), part: prem.partPoussee() };
}

for (const canal of ['test', 'production']) {
  titre(canal === 'test' ? 'LE CANAL DE TEST' : 'LE JEU PUBLIE');
  const M = await jeuDe(canal);
  ok('le coup de poussee y est ouvert', M.POUSSEE_OUVERTE === true);

  const { A } = courseLancee(M);
  const prem = globalThis.RenduPremium;

  // PLEIN : l'effet entier. C'est l'impulsion armee comme le fait une
  // reaction parfaite au pistolet ou une transition parfaite en sortie de
  // poussee, sur un appareil qui tient les soixante images.
  const plein = await scene(A, prem, prem.PLEIN);
  ok('une course ordinaire n allume rien', !plein.repos.onde && !plein.repos.aura);
  ok('l impulsion monte', plein.part > 0.02, String(plein.part));
  ok('l onde au sol se dessine', plein.vif.onde);
  ok('l aura sur le buste se dessine', plein.vif.aura);
  ok('les echos redessinent le coureur', plein.vif.fills > plein.repos.fills + 100,
     `${plein.vif.fills} contre ${plein.repos.fills}`);

  // Un tiers de seconde plus tard — la duree de l'impulsion est de 0,85 s en
  // tout, montee comprise — la toile doit retrouver son image ordinaire. Un
  // effet qui reste allume est un decor, pas une recompense.
  await attendre(950);
  ok('l impulsion retombe', prem.partPoussee() === 0, String(prem.partPoussee()));
  const apres = image(A);
  ok('et l image redevient ordinaire', !apres.onde && !apres.aura);

  // MOYEN : la recompense sans son prix. L'appareil ne tient plus la
  // poussiere des appuis, il ne tiendra pas trois copies du coureur — mais le
  // geste reussi doit continuer de se voir.
  const moyen = await scene(A, prem, prem.MOYEN);
  ok('a MOYEN l impulsion s arme encore', moyen.part > 0.02, String(moyen.part));
  ok('et l onde comme l aura se dessinent', moyen.vif.onde && moyen.vif.aura);
  ok('mais les echos ne redessinent rien', moyen.vif.fills <= moyen.repos.fills + 20,
     `${moyen.vif.fills} contre ${moyen.repos.fills}`);

  // SOBRE : rien, et rien d'arme. Ce niveau-la est celui d'un appareil qui ne
  // rend deja plus les soixante images ; lui poser un effet de plus serait
  // prendre au jeu ce qui lui reste.
  const sobre = await scene(A, prem, prem.SOBRE);
  ok('en SOBRE rien ne s arme', sobre.part === 0, String(sobre.part));
  ok('et l image reste ordinaire', !sobre.vif.onde && !sobre.vif.aura);

  // LA MESURE QUI TOMBE PENDANT L'IMPULSION. Elle tombe pendant une course et
  // non entre deux — c'est une moyenne glissante sur les temps d'image, et le
  // depart est justement le moment le plus charge. Refuser d'armer ne suffit
  // donc pas : ce qui est deja allume doit s'eteindre. La rafale des tribunes
  // a la meme regle, et cet effet-ci la suit.
  prem.niveau = prem.PLEIN;
  await attendre(950);
  prem.poussee(1);
  await attendre(60);
  ok('armee a PLEIN, l impulsion est la', prem.partPoussee() > 0.02);
  prem.niveau = prem.SOBRE;
  ok('le niveau tombe sous elle : elle s eteint', prem.partPoussee() === 0,
     String(prem.partPoussee()));
  const chute = image(A);
  ok('et la toile ne garde rien', !chute.onde && !chute.aura);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
