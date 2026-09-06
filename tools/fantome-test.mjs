// Le fantome tient sur la piste, meme quand on arrive du direct.
//
// CE QUI S'EST PASSE, parce que c'est la seule raison d'etre de ce harnais.
//
// Une course en direct laisse `G.lives` derriere elle : la table des
// adversaires reseau, un par joueur. `stepGhost` la consulte a chaque image et,
// quand elle est pleine, DESIGNE lui-meme le fantome parmi ces adversaires —
// c'est ce qui fait suivre a la camera celui contre qui on se bat vraiment,
// quand on court a huit.
//
// Rien n'effacait cette table en sortant. Un defi releve depuis l'ecran
// d'arrivee d'un direct — et c'est exactement la que les deux annonces
// s'affichent, « on t'a defie » et « ton duel est tranche » — heritait donc
// d'une table pleine de gens qui ne courent plus. `armGhost` posait bien le
// fantome dans son couloir ; la premiere image le remplacait par un coureur
// immobile sur la ligne, que plus aucun paquet n'alimentait. Le fantome etait
// arme, et il disparaissait avant d'avoir fait un pas.
//
// Relire `armGhost` n'attrape pas ca : il est juste. Il faut faire les deux
// courses a la suite, et regarder l'image d'apres.
//
// L'OBJECTIF DU JOUR AVAIT LE MEME TROU, par la meme porte. Il pose une graine
// — le plateau commun a tous les joueurs — et se declare en cours pour choisir
// l'ecran de fin. Rien ne l'effacait non plus : on relevait un defi d'ami
// depuis l'ecran de revanche, et le defi de l'ami se courait sur le plateau du
// jour, l'ecran de revanche revenait a l'arrivee a la place du recapitulatif
// du defi, et le chrono de la course de l'ami partait au serveur comme une
// tentative de l'objectif. La seconde moitie de ce harnais garde cette porte.
//
//   node tools/fantome-test.mjs
//
// Aucun reseau, aucun serveur : le moteur entier tourne ici, dans Node.

/* ------------------------------------------------------- monter le moteur

   Le noyau du jeu est du JavaScript de navigateur : il dessine, il joue du
   son, il lit le stockage local. On lui pose le strict minimum pour qu'il se
   charge — il ne dessinera rien, on ne lui demande que sa mecanique. */

class FauxContexte {
  constructor() {
    // Le rendu appelle des dizaines de methodes de contexte 2D. Aucune ne nous
    // interesse : on les rend toutes muettes d'un coup plutot que d'en tenir la
    // liste, qui serait fausse a la premiere ligne de dessin ajoutee.
    return new Proxy(this, { get: (cible, cle) => (cle in cible ? cible[cle] : () => {}) });
  }
}

globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ getContext: () => new FauxContexte(), width: 0, height: 0, style: {} }),
  addEventListener() {}, removeEventListener() {},
  body: { appendChild() {}, style: {} },
  documentElement: { style: {}, clientWidth: 800, clientHeight: 600 },
  getElementById: () => null, querySelector: () => null,
};
globalThis.Image = class { addEventListener() {} set src(_) {} get src() { return ''; } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// `navigator` existe deja dans Node, en lecture seule : on le remplace plutot
// que d'y ecrire, sinon le chargement s'arrete la.
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', language: 'fr' }, configurable: true,
});
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
globalThis.requestAnimationFrame = () => 0;
globalThis.devicePixelRatio = 1;

// Les trois fichiers se posent sur globalThis, dans cet ordre : le second lit
// le premier, le troisieme lit les deux.
await import('../src/game/sprinter-i18n.js');
await import('../src/game/sprinter-core.js');
await import('../src/game/sprinter-app.js');

const A = globalThis.SprinterApp;
const G = A.G;
// Le noyau tient le tirage : c'est lui qui dit si une graine est encore posee.
const K = globalThis.SprinterCore;

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------- le materiel

   Une trace comme le jeu en enregistre : la distance du coureur, en
   decimetres, relevee tous les REC_STEP. Celle-ci couvre cent metres en un peu
   moins de onze secondes, a vitesse constante — le realisme n'a aucune part
   ici, seule compte la forme. */
const traceDe = (metres, secondes) => {
  const t = [];
  for (let s = 0; s <= secondes; s += A.REC_STEP) {
    t.push(Math.round(Math.min(metres, (metres / secondes) * s) * 10));
  }
  return t;
};
const TRACE = traceDe(100, 10.9);

/** Relever un defi, comme le fait la boite de reception. */
const releverUnDefi = () => A.startOneShot(['100'], {
  levelIdx: 4,
  ghosts: [TRACE],
  ghostSplits: [10.9],
  ghostName: 'ANA',
  ghostTime: 10.9,
  challenge: { id: 'ABC234', owner_name: 'ANA', total_ms: 10900 },
});

/** Partir en revanche, comme le fait l'annonce de resultat d'un duel. */
const partirEnRevanche = () => {
  G.revanche = 'ANA'; G.revancheId = 'ABC234'; G.revancheMs = 10900;
  A.startOneShot(['100'], {
    levelIdx: 4,
    ghosts: [TRACE], ghostSplits: [10.9], ghostName: 'ANA', ghostTime: 10.9,
  });
};

/**
 * Une course en direct a plusieurs, jusqu'a son verdict.
 *
 * C'est elle qui remplit `G.lives`, et c'est la salle qui pose `liveResultat`
 * a l'arrivee : on le pose ici aussi, sinon la course simulee serait plus
 * propre que la vraie, et le harnais laisserait passer ce qu'il cherche.
 */
const courirEnDirect = () => {
  A.startLive(['100'], {
    levelIdx: 4, adversaire: 'ANA', sansOrdinateur: true,
    autres: [{ id: 'j1', nom: 'ANA', couloir: 5 }, { id: 'j2', nom: 'OMAR', couloir: 6 }],
  });
  G.liveResultat = { moi: 'moi', classement: [
    { id: 'moi', nom: 'TOI', place: 2, ms: 11400 },
    { id: 'j1', nom: 'ANA', place: 1, ms: 10900 },
  ] };
  G.liveDuel = { hote: null, invite: null };
};

/**
 * L'objectif du jour, tel que le serveur le rend.
 *
 * Seuls trois champs comptent ici : l'epreuve, et la graine qui fixe le
 * plateau. Le reste est du decor pour l'ecran de revanche.
 */
const OBJECTIF = { epreuve: '100', cible_ms: 11000, graine: 123456 };

/** Entrer dans le defi du jour, comme le fait `lancerObjectif`. */
const courirLObjectif = () =>
  A.startOneShot([OBJECTIF.epreuve], { levelIdx: 4, objectif: OBJECTIF });

/** Le plateau : qui court a cote, et en combien. C'est lui que la graine fixe. */
const plateau = () => G.runners
  .filter(r => !r.isPlayer && r.lane !== 4)   // 4 est le couloir du fantome
  .map(r => `${r.lane}:${r.target.toFixed(4)}`).join(' ');

/**
 * Quelques images de course, comme le fait la boucle du jeu.
 *
 * Une seule suffit a reproduire la panne — c'est `stepGhost` qui defait le
 * travail d'`armGhost`, des le premier appel. On en fait plusieurs pour lire
 * aussi que le fantome AVANCE, ce qu'un fantome fige ne ferait pas.
 */
const courir = (secondes) => {
  const pas = 1 / 60;
  for (let t = 0; t < secondes; t += pas) { G.elapsed += pas; A.stepGhost(pas); }
};

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE FANTOME D UN DEFI                                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('DEPUIS L ACCUEIL, IL A TOUJOURS TENU');

A.goHome();
releverUnDefi();
ok('le fantome est arme', !!G.ghost);
ok('...dans son couloir, portant le nom de l adversaire',
   !!G.ghost && G.ghost.runner.lane === 4 && G.ghost.runner.name === 'ANA',
   G.ghost ? `couloir ${G.ghost.runner.lane}, ${G.ghost.runner.name}` : 'pas de fantome');
ok('...et ce couloir a ete libere du coureur maison',
   !G.runners.some(r => !r.isPlayer && r.lane === 4));
courir(2);
ok('il court sur sa trace', !!G.ghost && G.ghost.runner.d > 15,
   G.ghost ? `${G.ghost.runner.d.toFixed(1)} m en 2 s` : 'pas de fantome');
ok('...et ce n est pas un adversaire reseau', !!G.ghost && !G.ghost.live);

titre('EN ARRIVANT DU DIRECT, IL TENAIT AVANT');

// LE COEUR DU HARNAIS. On enchaine sans repasser par l'accueil, parce que
// c'est ce que fait le joueur : l'annonce s'affiche sur l'ecran d'arrivee.
A.goHome();
courirEnDirect();
ok('le direct a bien rempli la table des adversaires',
   !!G.lives && G.lives.size === 2, `lives = ${G.lives ? G.lives.size : null}`);

releverUnDefi();
ok('la table des adversaires est rendue', G.lives === null,
   `lives = ${G.lives ? G.lives.size : G.lives}`);
ok('le direct est bien quitte', G.liveOn === false);
ok('...et son resultat ne suit pas le defi', G.liveResultat === null,
   'sinon l ecran d arrivee du defi rend le classement du direct precedent');
ok('le fantome est arme', !!G.ghost);

courir(2);
// Le nom ne suffit pas a le reconnaitre : l'adversaire du direct portait le
// meme. Ce qui les separe est `live` — l'un rejoue une trace, l'autre attend
// des paquets qui ne viendront plus.
ok('IL EST TOUJOURS LA APRES LA PREMIERE IMAGE',
   !!G.ghost && !G.ghost.live,
   G.ghost ? `un adversaire reseau a pris sa place (live=${!!G.ghost.live})`
           : 'stepGhost l a efface');
ok('...c est bien celui du defi',
   !!G.ghost && G.ghost.runner.name === 'ANA' && !!G.ghost.trace.length,
   G.ghost ? G.ghost.runner.name : 'pas de fantome');
ok('...et il court', !!G.ghost && G.ghost.runner.d > 15,
   G.ghost ? `${G.ghost.runner.d.toFixed(1)} m en 2 s` : 'pas de fantome');

titre('LA REVANCHE D UN DUEL PART PAR LE MEME CHEMIN');

A.goHome();
courirEnDirect();
partirEnRevanche();
courir(2);
ok('le fantome du vainqueur court a cote de nous',
   !!G.ghost && !G.ghost.live && G.ghost.runner.d > 15,
   G.ghost ? `${G.ghost.runner.name}, ${G.ghost.runner.d.toFixed(1)} m` : 'pas de fantome');
ok('...et la revanche reste designee', G.revancheId === 'ABC234',
   'sans quoi le defi ne repartirait chez personne a l arrivee');

titre('UNE COURSE SANS FANTOME N EN INVENTE PAS UN');

// L'autre moitie de la meme panne : sans defi, `armGhost` ne pose rien, et la
// table survivante posait alors sur la piste un coureur immobile, etiquete
// ADVERSAIRE, contre qui personne ne courait.
A.goHome();
courirEnDirect();
A.startOneShot(['100'], { levelIdx: 4 });
courir(2);
ok('la piste ne porte aucun fantome', G.ghost === null,
   G.ghost ? `${G.ghost.runner.name} a ${G.ghost.runner.d.toFixed(1)} m` : '');

titre('LA CARRIERE AUSSI REPART PROPRE');

A.goHome();
courirEnDirect();
A.startRun();
ok('le direct est quitte', G.liveOn === false && G.lives === null);
ok('...et la course est bien une course de carriere', G.mode === 'campaign');

titre('RECOMMENCER NE RAMENE PERSONNE');

A.goHome();
courirEnDirect();
releverUnDefi();
A.recommencer();
ok('on repart seul', G.ghost === null && G.ghostSet === null,
   'le defi auquel on repondait est joue : le rembarquer ferait croire qu on le recourt');
ok('...et sans rien du direct', G.liveOn === false && G.lives === null);

/* ============================================== l'objectif du jour ======= */

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  L OBJECTIF DU JOUR NE SUIT PAS LA COURSE SUIVANTE           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('LE DEFI DU JOUR SE COURT SEME, ET PLUSIEURS FOIS');

A.goHome();
courirLObjectif();
ok('l objectif est en cours', !!G.objectifEnCours);
ok('...le tirage est seme', K.estSeme() === true,
   'sans quoi deux joueurs ne courent pas le meme defi');
const plateauDuJour = plateau();
courirLObjectif();
ok('...et la tentative suivante retrouve le meme plateau',
   plateau() === plateauDuJour,
   'sinon « seule la meilleure compte » revient a garder le tirage le plus chanceux');

titre('UN DEFI D AMI RELEVE DEPUIS LA REVANCHE EN SORT');

// LE COEUR DE LA SECONDE MOITIE. L'ecran de revanche est un ecran calme : les
// annonces s'y affichent, et le joueur peut relever de la.
A.goHome();
courirLObjectif();
// Le garde-fou : « il est quitte » ne veut rien dire si rien n'a ete pose.
ok('on court bien le defi du jour', !!G.objectifEnCours);
releverUnDefi();
ok('L OBJECTIF EST QUITTE', !!G.objectifEnCours === false,
   'sinon l ecran de revanche revient a l arrivee, et le chrono du defi part '
   + 'au serveur comme une tentative de l objectif du jour');
ok('...la graine est rendue', G.graineCourse === null && K.estSeme() === false);
ok('...et le defi de l ami ne court pas sur le plateau du jour',
   plateau() !== plateauDuJour);
courir(2);
ok('...son fantome, lui, est bien la', !!G.ghost && !G.ghost.live,
   G.ghost ? `live=${!!G.ghost.live}` : 'pas de fantome');

titre('LES AUTRES PORTES AUSSI');

for (const [nom, sortir] of [
  ['une invitation en direct', () => courirEnDirect()],
  ['une course de carriere', () => A.startRun()],
  ['le retour a l accueil', () => A.goHome()],
  ['la revanche d un duel', () => partirEnRevanche()],
]) {
  A.goHome();
  courirLObjectif();
  const pose = !!G.objectifEnCours;
  sortir();
  ok(nom, pose && !G.objectifEnCours && G.graineCourse === null &&
          K.estSeme() === false,
     pose ? `objectif=${!!G.objectifEnCours} graine=${G.graineCourse} seme=${K.estSeme()}`
          : 'l objectif n a meme pas ete pose');
}

titre('ET LE CHEMIN EXPLICITE MARCHE TOUJOURS');

A.goHome();
courirLObjectif();
const poseAvantSortie = !!G.objectifEnCours;
A.poserObjectif(null);
ok('le lien « sortir » rend tout', poseAvantSortie && !G.objectifEnCours &&
   G.graineCourse === null && K.estSeme() === false);

titre('L ACCUEIL REND TOUT, COMME AVANT');

courirEnDirect();
A.goHome();
ok('la table des adversaires', G.lives === null);
ok('le direct', G.liveOn === false && G.liveResultat === null && G.liveDuel === null);
ok('le fantome et sa trace', G.ghost === null && G.ghostSet === null &&
   G.ghostName === '' && G.ghostTime === 0);
ok('l objectif du jour et sa graine',
   !!G.objectifEnCours === false && G.graineCourse === null && K.estSeme() === false);
ok('et on est de retour a l accueil', G.state === 'title');

console.log(`\n${echecs === 0 ? '✓ tout passe' : `✗ ${echecs} echec(s)`}\n`);
process.exit(echecs === 0 ? 0 : 1);
