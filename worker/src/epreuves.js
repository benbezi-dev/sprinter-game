// Les epreuves, et le SENS dans lequel on les gagne.
//
// Les trois epreuves du jeu se courent au chrono le plus bas. C'est si vrai
// partout qu'aucune ligne de code ne le dit : chaque requete ecrit MIN(),
// chaque comparaison ecrit `<`, et la regle vit repartie dans une quarantaine
// d'endroits qui ont tous raison aujourd'hui.
//
// Le jour ou une epreuve se gagnera au plus HAUT — une distance parcourue, un
// nombre de foulees tenues, un score — cette quarantaine d'endroits aura tort,
// un par un, et sans rien dire. Un MIN() sur une distance ne plante pas : il
// couronne le plus mauvais.
//
// D'ou ce module. Le sens est une PROPRIETE DECLAREE de l'epreuve, pas une
// chose qu'on deduit de son nom ou de l'unite de sa valeur. Rien ici ne cree
// d'epreuve nouvelle : on nomme ce que le code faisait deja, pour que ce qui
// vient ensuite ait un endroit ou s'accrocher.
//
// A TENIR D'ACCORD avec ALLOWED_RACES dans index.js et RaceKey cote jeu.

/** Le plus bas gagne : un chrono. */
export const PLUS_BAS = 'plus_bas';

/** Le plus haut gagne : une distance, un score, un nombre de tours. */
export const PLUS_HAUT = 'plus_haut';

/**
 * `pas` est la precision d'affichage, et elle sert au calcul : une cible
 * annoncee doit tomber sur un nombre que le joueur peut lire sur son ecran.
 * Le jeu affiche deux decimales de seconde, donc dix millisecondes.
 */
export const EPREUVES = {
  '100': { cle: '100', direction: PLUS_BAS, pas: 10, unite: 'ms', libelle: '100 m' },
  '200': { cle: '200', direction: PLUS_BAS, pas: 10, unite: 'ms', libelle: '200 m' },
  '400': { cle: '400', direction: PLUS_BAS, pas: 10, unite: 'ms', libelle: '400 m' },
};

export const CLES = Object.keys(EPREUVES);

export function epreuve(cle) {
  return EPREUVES[String(cle)] || null;
}

/** Le sens d'une epreuve. Le plus bas par defaut : c'est ce qu'etait le jeu
 *  entier avant ce module, et un defaut qui ment serait pire que pas de
 *  defaut du tout — mais une cle inconnue n'a pas d'epreuve, et l'appelant
 *  doit l'avoir verifiee avant (ALLOWED_RACES). */
export function directionDe(cle) {
  const e = epreuve(cle);
  return e ? e.direction : PLUS_BAS;
}

export function pasDe(cle) {
  const e = epreuve(cle);
  return e ? e.pas : 10;
}

/**
 * `candidat` est-il STRICTEMENT meilleur que `reference` ?
 *
 * Strictement, et c'est ce qui compte : egaler son record n'est pas le battre,
 * et une cible egale au record exigerait de le battre pour etre validee.
 */
export function estMeilleur(direction, candidat, reference) {
  if (!Number.isFinite(candidat)) return false;
  if (!Number.isFinite(reference)) return true;      // rien a battre encore
  return direction === PLUS_HAUT ? candidat > reference : candidat < reference;
}

/** Le meilleur des deux, en ignorant ce qui n'est pas un nombre. */
export function meilleur(direction, a, b) {
  if (!Number.isFinite(a)) return Number.isFinite(b) ? b : null;
  if (!Number.isFinite(b)) return a;
  return estMeilleur(direction, a, b) ? a : b;
}

/** Le meilleur d'une liste, ou null si elle n'en contient aucun. */
export function meilleurDe(direction, valeurs) {
  let m = null;
  for (const v of valeurs || []) m = meilleur(direction, v, m);
  return m;
}

/** Ce que SQL doit ecrire pour agreger dans le bon sens. Le seul endroit du
 *  depot ou MIN et MAX se choisissent, plutot que de s'ecrire de memoire. */
export function agregatSql(direction) {
  return direction === PLUS_HAUT ? 'MAX' : 'MIN';
}

/** L'ordre de tri d'un classement : le meilleur en tete. */
export function ordreSql(direction) {
  return direction === PLUS_HAUT ? 'DESC' : 'ASC';
}

/* ------------------------------------------------------------ la discipline */

/**
 * LA DISCIPLINE D'UN DUEL — ce sur quoi un niveau se gagne.
 *
 * Un joueur n'a pas un niveau, il en a un PAR DISCIPLINE. Etre regional sur
 * 100 m ne dit rien de ce qu'on vaut sur 400 m : ce sont deux courses, deux
 * apprentissages, et deux echelles. Un classement unique melangeait les trois
 * et racontait la meme chose sur les trois — le sprinter pur y montait grace a
 * ses 100 m et se retrouvait annonce « national » sur un tour de piste qu'il
 * n'avait jamais couru.
 *
 * La discipline est donc la cle de rangement du classement, et elle se derive
 * des epreuves de la rencontre : le 100 m seul, le 200 m seul, et ainsi de
 * suite. Un duel courru sur plusieurs epreuves — le one shot en propose
 * jusqu'a trois — se gagne au CUMUL des chronos : ce n'est ni un 100 m ni un
 * 200 m, c'est un combine, et il a sa propre echelle. Le repartir sur les
 * epreuves qui le composent donnerait trois fois les points d'une seule
 * course ; l'attribuer a l'une d'elles ferait entrer au classement du 400 m
 * quelqu'un qui n'a jamais couru un 400 m tout seul.
 *
 * L'ordre est canonique — 100 avant 200 avant 400 — pour qu'un 200 + 100 et un
 * 100 + 200 soient la meme discipline. Sans cela, l'ordre des clics du joueur
 * ouvrirait deux classements jumeaux.
 */
export const DISCIPLINE_DEFAUT = '100';

/** Ce qui separe deux epreuves dans la cle d'un combine. */
const LIEN = '+';

export function cleDiscipline(epreuves) {
  const vues = new Set();
  for (const e of Array.isArray(epreuves) ? epreuves : [epreuves]) {
    const c = String(e == null ? '' : e).trim();
    if (EPREUVES[c]) vues.add(c);
  }
  // Rien de reconnaissable : le 100 m plutot que rien. Une rencontre sans
  // discipline n'irait dans aucun classement, et disparaitrait en silence.
  if (!vues.size) return DISCIPLINE_DEFAUT;
  return CLES.filter(c => vues.has(c)).join(LIEN);
}

/** Les epreuves d'une discipline, dans l'ordre du programme. */
export function epreuvesDeDiscipline(cle) {
  return String(cle || '').split(LIEN).filter(c => EPREUVES[c]);
}

/** Cette cle designe-t-elle une discipline du jeu ? */
export function estDiscipline(cle) {
  const eps = epreuvesDeDiscipline(cle);
  return eps.length > 0 && cleDiscipline(eps) === String(cle);
}

/**
 * Les disciplines qu'un ecran peut proposer : les trois epreuves seules.
 *
 * Les combines existent au classement — on y entre en courant un — mais ils ne
 * se proposent pas : sept boutons pour trois distances demanderaient au joueur
 * de choisir entre des choses dont six sur sept ne lui parlent pas.
 */
export const DISCIPLINES_SIMPLES = CLES.slice();
