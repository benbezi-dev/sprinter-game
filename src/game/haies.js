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
 * Les six plateaux, du scolaire aux ZEZE.
 *
 * Les quatre premiers suivent les proportions de Sprinter rapportees a son
 * propre record — l'echelle de difficulte du jeu est deja calee, il n'y avait
 * aucune raison d'en inventer une seconde.
 *
 * Le niveau mondial est le record a trois dixiemes pres, dans les deux sens :
 * c'est le seul plateau du jeu ou l'on court CONTRE la marque reelle plutot
 * qu'apres elle.
 *
 * Les deux derniers ont du etre poses a la main. A trois dixiemes sous le
 * record, le mondial passait devant les Jeux olympiques, qui partaient du
 * record lui-meme : la course serait devenue plus facile en montant d'un
 * niveau. Ils restent donc plus rapides, comme partout ailleurs dans le jeu.
 */
export const PLATEAUX = {
  '100h': [[15.81, 18.98], [14.17, 15.81], [12.65, 13.28],
           [11.82, 12.42], [11.67, 11.97], [11.07, 11.39]],
  '110h': [[16.70, 20.04], [14.96, 16.70], [13.36, 14.03],
           [12.50, 13.10], [12.35, 12.65], [11.69, 12.03]],
  '400h': [[59.94, 71.93], [53.71, 59.94], [47.95, 50.35],
           [45.64, 46.24], [45.49, 45.79], [41.96, 43.16]],
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
