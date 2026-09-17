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
 * LE RYTHME DES APPUIS, tel que l'entraineur le compte. Bornes incluses.
 *
 * Un appui est un pied pose au sol, l'appel compris. Deux troncons :
 *
 *   premiere   — du depart jusqu'a l'appel de la premiere haie. Le 7e appui
 *                des courses courtes EST l'appel.
 *   intervalle — de la reception d'une haie jusqu'a l'appel de la suivante,
 *                les deux comptes : reception, deux appuis, appel = quatre.
 *
 * Apres la dixieme haie, le compte est libre jusqu'a la ligne.
 *
 * Les courtes ne tolerent qu'un nombre : c'est la cadence parfaite, celle qui
 * ramene le meme pied a chaque haie. Le tour tolere une fourchette, parce
 * qu'un hurdleur y court a treize, quinze ou dix-sept appuis selon sa vitesse
 * et que la fatigue le fait glisser de l'un a l'autre sans que ce soit une
 * faute. Ces nombres viennent de l'utilisateur, pas d'un calcul : c'est le jeu
 * qui doit les rendre atteignables, pas eux qui doivent s'adapter au moteur.
 */
export const APPUIS = {
  '100h': { premiere: [7, 7], intervalle: [4, 4] },
  '110h': { premiere: [7, 7], intervalle: [4, 4] },
  '400h': { premiere: [21, 23], intervalle: [13, 17] },
};

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
 * LE BAREME, DONNE POUR LE 110 M HAIES.
 *
 * Il ne se calcule plus, il se decide — et c'est un renversement volontaire.
 *
 * Jusqu'ici les six plateaux sortaient d'une formule : trois proportions
 * reprises de Sprinter, puis un ecart autour du record (ECART_MONDIAL, trois
 * dixiemes exprimes en part du record, pour que les trois epreuves respirent
 * pareil). La formule avait cette qualite-la, et un defaut qui a fini par
 * compter : elle decrivait un jeu ou la MACHINE sautait les haies a la place
 * du joueur. Depuis que l'appel lui revient (canal.ts, APPEL_JOUEUR), ce
 * qu'une cadence donne au chrono a change, et un bareme deduit du record du
 * monde ne dit plus rien de ce que la manette demande.
 *
 * Ces douze nombres viennent donc du joueur, apres essais au pouce. On ne les
 * arrondit pas et on ne les « corrige » pas : ce sont des decisions, pas des
 * mesures.
 *
 * TROIS CHOSES A SAVOIR EN LES LISANT, parce qu'elles surprennent et qu'elles
 * ne sont pas des coquilles :
 *
 *   - LE MONDIAL ET LES JEUX MONDIAUX ENCADRENT TOUS DEUX LE RECORD, et les
 *     ZEZE seuls passent dessous. Avant, le mondial l'encadrait et les deux
 *     derniers descendaient. Les Jeux mondiaux partagent d'ailleurs leur borne
 *     basse avec le mondial : on y demande le meme plancher, mais un plafond
 *     plus bas.
 *   - LES JEUX MONDIAUX TIENNENT DANS UN QUART DE SECONDE sur le 110 m. C'est
 *     tres serre — huit athletes a portee de photo-finish a chaque tentative,
 *     ce que l'ancien bareme s'interdisait explicitement. Si le niveau 5 se
 *     joue un jour comme une loterie, c'est ce nombre-la qu'il faut ouvrir.
 *   - ENTRE 14,50 ET 15,50 S, AUCUN PLATEAU. Un chrono peut tomber la sans
 *     appartenir a un niveau. L'ancien bareme avait deja de tels trous.
 */
const BAREME = [
  [17.50, 19.00],   // 1 — scolaire
  [15.50, 17.50],   // 2 — regional
  [13.00, 14.50],   // 3 — national
  [12.75, 13.20],   // 4 — mondial
  [12.75, 13.00],   // 5 — Jeux mondiaux
  [12.30, 12.75],   // 6 — ZEZE
];

/**
 * Les six plateaux d'une epreuve.
 *
 * Le bareme est ecrit pour le 110 m haies ; les deux autres s'en deduisent par
 * le RAPPORT DES RECORDS. C'est ce que faisaient deja les proportions, et pour
 * la meme raison : une seule echelle de difficulte, pas trois. Un 400 m haies
 * « niveau national » doit demander au joueur du tour ce que le niveau national
 * demande au joueur du 110 m.
 *
 * Tant que le bareme ne vaut que pour le 110 m — la seule epreuve eprouvee au
 * pouce a ce jour — c'est la facon la plus honnete de servir les deux autres :
 * elles heritent d'une echelle mesuree plutot que d'une echelle inventee.
 */
function plateauxDe(record) {
  const r = record / RECORDS['110h'].s;
  const c = x => Math.round(x * r * 100) / 100;
  return BAREME.map(([a, b]) => [c(a), c(b)]);
}

export const PLATEAUX = {
  '100h': plateauxDe(RECORDS['100h'].s),
  '110h': plateauxDe(RECORDS['110h'].s),
  '400h': plateauxDe(RECORDS['400h'].s),
};

/**
 * Les trois courses, dans la forme que le moteur attend d'une epreuve.
 *
 * SUR LA VITESSE DE POINTE. Ce paragraphe a ete reecrit deux fois, et la
 * troisieme version est la premiere qui repose sur une mesure.
 *
 * Il y avait d'abord : « la vitesse de pointe est celle de Sprinter,
 * volontairement — c'est au jeu des haies de couter ce qu'il coute, pas a un
 * plafond baisse en douce ». Puis : « un hurdleur ne court jamais un
 * intervalle libre, il regle sa foulee pour la suivante ». Le second argument
 * est juste ; il ne disait simplement pas DE COMBIEN.
 *
 * Maintenant on le sait. Coh (2003) chronometre Colin Jackson entre sa 4e et sa
 * 5e haie sur une course a 13,47 s : sa vitesse moyenne y est de 8,83 m/s, et
 * sa vitesse a l'appel de 9,11. Le jeu portait un plafond de 11,00 — vingt
 * pour cent au-dessus d'un recordman du monde en pleine course.
 *
 * Ce plafond faux etait compense par une haie fausse : le vol y coutait 26 %
 * de vitesse au lieu des 3,7 % mesures (haies-jeu.js, DRAG_VOL). Deux erreurs
 * qui se rattrapaient, un chrono plausible, et un mouvement qu'aucun hurdleur
 * n'aurait reconnu. Les deux sont corrigees ensemble ; l'une sans l'autre
 * donnait n'importe quoi.
 *
 * LES TROIS PLAFONDS SONT CALES SUR LE RECORD DE LEUR EPREUVE : la cadence la
 * plus haute qu'un doigt tienne doit donner a peu pres la marque mondiale, et
 * pas la battre d'une seconde. Mesure a l'appui (tools/haies-course-test.mjs) :
 *
 *     110 m H  plafond 9,40 — 13,48 s a 8 frappes/s, 12,85 a 12. Record 12,91,
 *              et la course analysee par Coh faisait 13,47.
 *     100 m H  plafond 9,00 — 12,63 a 8, 12,13 a 12. Record 12,12.
 *     400 m H  plafond 9,30 — 47,1 a 8, 45,9 a 12. Record 45,94.
 *
 * Le tour ne garde donc plus le plafond du plat : il n'y avait aucune raison
 * qu'un hurdleur du 400 m coure plus vite qu'un hurdleur du 110 m.
 */
// `foulee` : la foulee du hurdleur en part de celle du sprinteur (Runner.foulee
// dans sprinter-core.js). Calee par tools/haies-course-test.mjs pour qu'une
// cadence de doigt soutenue donne exactement le rythme d'APPUIS ; voir ce
// harnais avant d'y toucher.
export const HAIES = {
  '100h': {
    key: '100h', label: '100 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 100, maxSpeed: 9.000, best: RECORDS['100h'].s, foulee: 0.78,
    haies: { nombre: NB_HAIES, hauteur: 0.838, premiere: 13.00, ecart: 8.50, fin: 10.50 },
    ranges: PLATEAUX['100h'],
  },
  '110h': {
    key: '110h', label: '110 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 110, maxSpeed: 9.400, best: RECORDS['110h'].s, foulee: 0.86,
    haies: { nombre: NB_HAIES, hauteur: 1.067, premiere: 13.72, ecart: 9.14, fin: 14.02 },
    ranges: PLATEAUX['110h'],
  },
  '400h': {
    key: '400h', label: '400 M HAIES', sub: 'dix haies, un tour de piste',
    fullLap: true, arc: 115.61, straight: 84.39, maxSpeed: 9.300, best: RECORDS['400h'].s, foulee: 0.90,
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

/**
 * Metres par foulee dans la partie COURUE d'un intervalle, au rythme vise.
 *
 * `courue` est ce qui reste entre la reception et l'appel (haies-jeu.js, APPEL).
 * Quatre appuis font trois foulees : on divise par le nombre d'appuis moins un.
 * Sur le tour, c'est le milieu de la fourchette qu'on mesure.
 */
export function fouleeIdeale(cle, courue) {
  const [min, max] = APPUIS[cle].intervalle;
  return courue / ((min + max) / 2 - 1);
}
