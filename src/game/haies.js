/* ---------------------------------------------------------------------------
   HURDLERS — les trois courses de haies, telles que le reglement les pose
   ---------------------------------------------------------------------------
   Rien n'est invente ici. Les hauteurs, la place de la premiere haie, l'ecart
   entre elles et la longueur du dernier tronçon viennent des specifications de
   World Athletics, et chaque discipline se verifie d'elle-meme :

       premiere + 9 x ecart + dernier troncon = la distance de la course

   Trois lignes, trois egalites exactes. C'est la seule verification qui compte
   au moment d'ecrire ces nombres : une haie mal placee ne se voit pas a l'oeil
   sur une piste dessinee, elle se voit six mois plus tard quand quelqu'un
   compare un chrono du jeu a un chrono reel.

   Ce fichier ne contient QUE la geometrie et le plateau. Le jeu des haies —
   le rythme, les appuis, ce qui se paie quand on arrive mal — vit ailleurs :
   melanger les deux, c'est ne plus pouvoir corriger l'un sans relire l'autre.
--------------------------------------------------------------------------- */

/**
 * Dix haies, toujours. C'est le seul nombre qui ne change jamais d'une
 * discipline a l'autre, du 100 m au tour complet.
 */
export const NB_HAIES = 10;

/**
 * Les appuis d'un intervalle, pour un athlete lance.
 *
 * Trois foulees entre deux haies sur les courses courtes — quatre appuis, en
 * comptant celui de l'appel — et treize foulees sur le tour. Ce ne sont pas des
 * chiffres decoratifs : c'est la cible du jeu. Y arriver demande d'entrer dans
 * l'intervalle avec assez de vitesse ; arriver lent oblige a en rajouter un, et
 * chaque appui de plus est une occasion de plus de se tromper de pied.
 *
 * On verifie que la foulee demandee reste humaine : entre 2,1 et 2,5 m par
 * appui a pleine vitesse, ce que le moteur admet deja pour le plat.
 */
export const APPUIS_IDEAL = { '100h': 4, '110h': 4, '400h': 14 };

/**
 * Les records du monde, au 29 aout 2026.
 *
 * Ils servent de point d'ancrage au niveau Championnat du monde, et a rien
 * d'autre. Les garder ecrits ici avec leur date evite d'avoir un jour a
 * deviner sur quoi le plateau avait ete cale.
 */
export const RECORDS = {
  '100h': { s: 12.12, qui: 'Tobi Amusan', an: 2022 },
  '110h': { s: 12.80, qui: 'Aries Merritt', an: 2012 },
  '400h': { s: 45.94, qui: 'Karsten Warholm', an: 2021 },
};

/**
 * L'ecart du plateau mondial autour du record, en part du record.
 *
 * Trois dixiemes sur le 110 m — le chiffre choisi — mais exprime en
 * proportion, et c'est tout l'objet de cette constante.
 *
 * En valeur absolue, trois dixiemes valent 2,3 % d'un 110 m haies et 0,65 %
 * d'un tour complet. Le plateau du 400 m tenait alors dans six dixiemes apres
 * quarante-six secondes de course : sept adversaires a portee de photo-finish
 * a chaque tentative, ou l'on ne pouvait ni prendre de l'avance ni en perdre.
 * Ce n'etait pas une decision, c'etait un effet de bord de l'unite choisie.
 *
 * En proportion, l'ecart vaut deux secondes sur le tour — l'ecart d'une vraie
 * finale — et ne bouge pas d'un centieme sur le 110 m, ou le chiffre a ete
 * pose.
 */
export const ECART_MONDIAL = 0.30 / 12.80;

/**
 * Les six plateaux, du scolaire aux ZEZE.
 *
 * Les trois premiers suivent les proportions de Sprinter rapportees a son
 * propre record — l'echelle de difficulte du jeu est deja calee, il n'y avait
 * aucune raison d'en inventer une seconde.
 *
 * Le mondial encadre le record : c'est le seul plateau du jeu ou l'on court
 * CONTRE la marque reelle plutot qu'apres elle.
 *
 * Les deux derniers descendent, et il le fallait. A l'ecart demande SOUS le
 * record, le mondial serait passe devant les Jeux olympiques, qui partaient du
 * record lui-meme : la course serait devenue plus facile en montant d'un
 * niveau.
 */
const PROPORTIONS = [[1.305, 1.566], [1.169, 1.305], [1.044, 1.096]];
const ZEZE = [0.913, 0.939];

/** Les six plateaux d'une epreuve, calcules depuis son record. */
function plateauxDe(record) {
  const e = ECART_MONDIAL;
  const arrondi = ([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100];
  return [
    ...PROPORTIONS.map(([a, b]) => arrondi([record * a, record * b])),
    arrondi([record * (1 - e), record * (1 + e)]),
    arrondi([record * (1 - e * 1.5), record * (1 - e * 0.5)]),
    arrondi([record * ZEZE[0], record * ZEZE[1]]),
  ];
}

export const PLATEAUX = {
  '100h': plateauxDe(RECORDS['100h'].s),
  '110h': plateauxDe(RECORDS['110h'].s),
  '400h': plateauxDe(RECORDS['400h'].s),
};

/**
 * Les trois courses, dans la forme que le moteur attend d'une epreuve.
 *
 * La vitesse de pointe est celle de Sprinter, volontairement : un hurdleur ne
 * court pas moins vite qu'un sprinteur, il perd du temps sur les haies. C'est
 * au jeu des haies de coûter ce qu'il coûte, pas a un plafond baisse en
 * douce — un plafond ne se sent pas, une haie mal passee si.
 */
export const HAIES = {
  '100h': {
    key: '100h', label: '100 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 100, maxSpeed: 12.435, best: RECORDS['100h'].s,
    haies: { nombre: NB_HAIES, hauteur: 0.838, premiere: 13.00, ecart: 8.50, fin: 10.50 },
    ranges: PLATEAUX['100h'],
  },
  '110h': {
    key: '110h', label: '110 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 110, maxSpeed: 12.435, best: RECORDS['110h'].s,
    haies: { nombre: NB_HAIES, hauteur: 1.067, premiere: 13.72, ecart: 9.14, fin: 14.02 },
    ranges: PLATEAUX['110h'],
  },
  '400h': {
    key: '400h', label: '400 M HAIES', sub: 'dix haies, un tour de piste',
    fullLap: true, arc: 115.61, straight: 84.39, maxSpeed: 11.536, best: RECORDS['400h'].s,
    haies: { nombre: NB_HAIES, hauteur: 0.914, premiere: 45.00, ecart: 35.00, fin: 40.00 },
    ranges: PLATEAUX['400h'],
  },
};

/** La distance totale d'une course de haies. */
export function distanceDe(cle) {
  const r = HAIES[cle];
  return r.arc > 0 ? (r.fullLap ? 400 : r.arc + r.straight) : r.straight;
}

/** Ou se trouve chaque haie, en metres depuis le depart. */
export function positionsDes(cle) {
  const h = HAIES[cle].haies;
  const out = [];
  for (let i = 0; i < h.nombre; i++) out.push(h.premiere + i * h.ecart);
  return out;
}

/**
 * La geometrie est-elle coherente avec la distance annoncee ?
 *
 * Exporte plutot que garde pour soi : c'est ce que le harnais verifie, et
 * c'est aussi ce qu'on voudra rejouer le jour ou une hauteur ou un ecart
 * changera de reglement.
 */
export function verifierGeometrie(cle) {
  const h = HAIES[cle].haies;
  const somme = h.premiere + (h.nombre - 1) * h.ecart + h.fin;
  const attendu = distanceDe(cle);
  return { somme, attendu, exact: Math.abs(somme - attendu) < 0.005 };
}

/** Metres par appui dans un intervalle, pour un athlete au rythme ideal. */
export function fouleeIdeale(cle) {
  return HAIES[cle].haies.ecart / APPUIS_IDEAL[cle];
}
