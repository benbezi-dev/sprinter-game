// LA REVANCHE, DU COTE DU MOTEUR — et la salle qui bouge sous la piste.
//
// `direct-revanche-duel-test.mjs` verifie la revanche cote PROTOCOLE : deux
// clients envoient leurs positions et leur chrono, la salle tranche, les points
// changent de main. Tout y passait — et pourtant la revanche ne se jouait pas.
//
// Parce que ces clients-la n'empruntent pas le chemin du jeu. Dans le jeu, ce
// n'est pas l'ecran qui transmet, c'est `pousserPosition` dans engine.ts, et il
// compte avec deux variables de module — le prochain instant d'envoi et le
// chrono deja transmis. Toutes deux sont calees sur `G.elapsed`, qui repart de
// zero a chaque coup de pistolet ; elles, ne repartaient qu'au branchement de
// la salle. Or le direct branche la sienne UNE FOIS, a la connexion. La
// deuxieme course d'une salle heritait donc d'un prochain envoi pose dix
// secondes dans le futur, c'est-a-dire apres l'arrivee : pas une seule position
// transmise du debut a la fin, et pas de chrono non plus. L'adversaire voyait
// un coureur immobile sur la ligne de depart, sans faux depart et sans erreur,
// qui figurait pourtant au classement.
//
// Ce harnais prend donc `pousserPosition` TEL QU'IL EST ECRIT dans engine.ts et
// le fait tourner sur deux courses de suite. Il verifie aussi ce que la salle
// peut changer entre le montage de la piste — au debut de la presentation — et
// le coup de pistolet, une vingtaine de secondes plus tard : quelqu'un ferme
// l'application, quelqu'un d'autre arrive.

import fs from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..');
const JEU = path.join(RACINE, 'src', 'game');

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------------------
   LE MOTEUR DANS NODE

   sprinter-app.js est la couche navigateur : elle attend un DOM, une image,
   un stockage local. On lui en donne juste assez pour se charger — rien de
   ce qui suit ne dessine. Et `import.meta`, qui n'existe pas dans un
   `new Function`, devient un global equivalent : le fichier le prevoit
   explicitement (voir son commentaire au-dessus de STADES_HORS_SERIE).
   ------------------------------------------------------------------------ */
function chargerLeMoteur() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
  };
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: { style: {}, classList: { add() {}, remove() {} } },
    createElement: () => ({ style: {}, getContext: () => null, appendChild() {}, setAttribute() {} }),
    body: { appendChild() {} }, querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  try {
    Object.defineProperty(globalThis, 'navigator',
      { value: { language: 'fr', userAgent: 'node' }, configurable: true });
  } catch { /* deja defini par Node : il fera l'affaire */ }
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = () => 0;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.Image = class { set src(v) {} addEventListener() {} };
  globalThis.__META = { env: { VITE_CANAL: '', BASE_URL: '/' } };

  for (const f of ['sprinter-i18n.js', 'sprinter-core.js', 'sprinter-app.js']) {
    const src = fs.readFileSync(path.join(JEU, f), 'utf8').replace(/import\.meta/g, '__META');
    new Function(src).call(globalThis);
  }
  return globalThis.SprinterApp;
}

const A = chargerLeMoteur();
const G = A.G;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  DIRECT — LA REVANCHE ET LA SALLE QUI BOUGE (cote moteur)    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/* ==================================================================== 1 ===
   DEUX COURSES DE SUITE DANS LA MEME SALLE
   ======================================================================== */
titre('LA REVANCHE TRANSMET-ELLE ?');

const engine = fs.readFileSync(path.join(JEU, 'engine.ts'), 'utf8');
const source = (engine.match(/function pousserPosition\(\) \{[\s\S]*?\n\}/) || [])[0];
ok('pousserPosition est bien la ou on le lit', !!source);

// La remise a zero doit etre posee AU COUP DE PISTOLET, la ou `G.elapsed` lui
// aussi repart : c'est tout le correctif, et c'est ce qui doit rester vrai.
ok("l'envoi est remis a zero au coup de pistolet",
   /G\.state = 'race'; G\.elapsed = 0;[\s\S]{0,400}?reinitialiserEnvoi\(\);/.test(engine));

/** Une salle de course, avec l'etat de module que pousserPosition tient. */
function salleDeTest() {
  const envoyes = [];
  const salleLive = { position: d => envoyes.push(d), fini: () => envoyes.push('FIN') };
  const etat = { prochainEnvoi: 0, finEnvoyee: false };
  const tour = new Function('G', 'salleLive', 'etat', `
    let prochainEnvoi = etat.prochainEnvoi, finEnvoyee = etat.finEnvoyee;
    ${source}
    pousserPosition();
    etat.prochainEnvoi = prochainEnvoi; etat.finEnvoyee = finEnvoyee;
  `);
  return { envoyes, etat, tour: () => tour(G, salleLive, etat) };
}

/** Un cent metres couru en 10,8 s, au pas de temps du moteur. */
function courir(s, { remiseAuPistolet }) {
  const debut = s.envoyes.length;
  if (remiseAuPistolet) { s.etat.prochainEnvoi = 0; s.etat.finEnvoyee = false; }
  G.elapsed = 0;
  G.player = { d: 0, finished: false, finishTime: null };
  G.track = { total: 100 };
  for (let i = 0; i < 2600; i++) {
    G.elapsed += 1 / 240;
    G.player.d = Math.min(100, G.elapsed * 10);
    if (G.player.d >= 100 && !G.player.finished) {
      G.player.finished = true; G.player.finishTime = G.elapsed;
    }
    s.tour();
  }
  const l = s.envoyes.slice(debut);
  return { positions: l.filter(x => x !== 'FIN').length, chrono: l.filter(x => x === 'FIN').length };
}

// Ce que faisait le direct : brancher la salle a la connexion, et rien remettre
// a zero d'une course a l'autre.
const avant = salleDeTest();
const a1 = courir(avant, { remiseAuPistolet: true });
const a2 = courir(avant, { remiseAuPistolet: false });
// Ce qu'il fait depuis : la remise appartient au depart.
const apres = salleDeTest();
courir(apres, { remiseAuPistolet: true });
const p2 = courir(apres, { remiseAuPistolet: true });

console.log(`     course 1       ${a1.positions} positions, ${a1.chrono} chrono`);
console.log(`     course 2 AVANT ${a2.positions} positions, ${a2.chrono} chrono`);
console.log(`     course 2 APRES ${p2.positions} positions, ${p2.chrono} chrono`);

ok('la premiere course transmet', a1.positions > 90 && a1.chrono === 1);
ok('sans remise, la revanche ne transmettait RIEN (temoin de non-regression)',
   a2.positions === 0 && a2.chrono === 0,
   `${a2.positions} positions, ${a2.chrono} chrono`);
ok('avec la remise, la revanche transmet comme la premiere',
   p2.positions === a1.positions && p2.chrono === 1);

/* ==================================================================== 2 ===
   LA SALLE BOUGE ENTRE LA PRESENTATION ET LE PISTOLET
   ======================================================================== */
titre('UN PARTANT S EN VA, UN AUTRE ARRIVE');

A.startLive(['100'], {
  levelIdx: 4, sansOrdinateur: true,
  autres: [{ id: 'a1', nom: 'BRAVO', couloir: 1 }, { id: 'a2', nom: 'CHARLIE', couloir: 2 }],
});
G.state = 'race'; G.elapsed = 0;
const enPiste = () => G.runners.filter(r => r.isLive).map(r => r.repere.nom).sort().join(', ');

ok('les adversaires annonces sont en piste', enPiste() === 'BRAVO, CHARLIE', enPiste());

// CHARLIE ferme l'application, DELTA arrive : c'est ce que la salle annonce.
A.majLives([{ id: 'a1', nom: 'BRAVO', couloir: 1 }, { id: 'a3', nom: 'DELTA', couloir: 3 }]);
console.log(`     apres le depart de CHARLIE et l'arrivee de DELTA : ${enPiste()}`);
ok('le sorti quitte la piste au lieu d y rester plante', !G.lives.has('a2'));
ok('le nouvel arrivant y entre', enPiste() === 'BRAVO, DELTA', enPiste());
ok('chacun garde un couloir a lui',
   new Set(G.runners.map(r => r.lane)).size === G.runners.length);

// Et ses positions doivent le faire avancer, non tomber dans le vide : sans
// coureur a son identifiant, liveDistDe les jetait en silence.
for (let i = 0; i < 30; i++) {
  G.elapsed += 1 / 30;
  A.liveDistDe('a3', i * 0.3);
  A.stepGhost(1 / 30);
}
const delta = G.runners.find(r => r.isLive && r.repere.nom === 'DELTA');
console.log(`     DELTA est a ${delta.d.toFixed(1)} m apres une seconde`);
ok('les positions du nouvel arrivant le font courir', delta.d > 3, `${delta.d.toFixed(1)} m`);

/* ==================================================================== 3 ===
   LE CLASSEMENT D ARRIVEE
   ======================================================================== */
titre('LE CLASSEMENT NE DOUBLE PLUS PERSONNE');

G.player.d = G.track.total; G.player.finished = true; G.player.finishTime = 9.9;
A.finishRace();
console.log('     ' + G.ranking.map(r => (r.repere ? r.repere.nom : r.name)).join(' | '));
ok('aucun coureur n y figure deux fois',
   new Set(G.ranking).size === G.ranking.length,
   `${G.ranking.length} lignes, ${new Set(G.ranking).size} coureurs`);

console.log('\n' + '─'.repeat(62));
console.log(e === 0 ? '   TOUT PASSE.' : `   ${e} VERIFICATION(S) EN ECHEC.`);
process.exit(e ? 1 : 0);
