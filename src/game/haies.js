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
 * LE BAREME DE LA PRODUCTION, DONNE POUR LE 110 M HAIES.
 *
 * C'est celui que la version publique joue encore. Le canal de test joue
 * celui du 29 septembre 2026, plus bas (PLATEAUX_TEST).
 *
 * Il ne se calcule plus, il se decide — et c'est un renversement volontaire.
 *
 * Jusqu'ici les six plateaux sortaient d'une formule : trois proportions
 * reprises de Sprinter, puis un ecart autour du record. La formule donnait les
 * trois epreuves d'un coup et les faisait respirer pareil, mais elle decrivait
 * un jeu ou la MACHINE sautait les haies a la place du joueur. Depuis que
 * l'appel lui revient (canal.ts, APPEL_JOUEUR), ce qu'une cadence donne au
 * chrono a change, et un bareme deduit du record ne dit plus rien de ce que la
 * manette demande.
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
 *
 * ET UN CHANTIER OUVERT, SU ET ASSUME : LE NIVEAU DES ZEZE. Ces nombres ont
 * ete poses quand le jeu tournait a un plafond de vitesse reduit ; il a repris
 * depuis celui de Sprinter (voir HAIES plus bas), et il va donc plus vite que
 * l'echelle ne le prevoit. Mesure sur le 110 m haies, releve le 20 septembre
 * 2026 : 11,93 s a huit frappes par seconde, 11,13 a dix, 10,88 a douze — le
 * dernier plateau se gagne des huit frappes quand Sprinter en demande treize
 * a quatorze. (Ce paragraphe annoncait 13,80 / 11,70 / 11,25 : le moteur a
 * encore gagne en vitesse depuis, et l'ecart s'est donc creuse.) Les deux
 * derniers niveaux sont a redescendre, et le 400 m haies a recu sa propre
 * reponse au niveau 6 sans que cela suffise. Les harnais le disent, et ils
 * ont raison de le dire.
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
 * CE QU'UNE EPREUVE NE DEDUIT PAS DU 110 M HAIES.
 *
 * Le rapport des records sert de defaut, pas de loi. Le tour ne se court pas
 * comme une ligne droite : quinze foulees entre les haies au lieu de trois, une
 * fatigue qui deplace le compte d'appuis, et un jeu qui y va plus vite que
 * l'echelle ne le prevoit. Son dernier niveau est donc DONNE, comme les douze
 * nombres du 110 m l'ont ete : 40,80 a 41,20 s, decides au pouce.
 *
 * Deduit du 110 m, il aurait valu 44,15 a 45,76 — a un cheveu du record du
 * monde (45,94), alors que Sprinter place ses ZEZE neuf pour cent dessous.
 * Un premier passage l'avait pose a 42,00-43,50, puis a 40,80-41,20. Il vaut
 * 40,10 a 41,00 depuis le 20 septembre 2026, decide au pouce comme les
 * douze autres.
 *
 * CE QUE CETTE FOURCHETTE FERME, ET CE QU'ELLE LAISSE OUVERT. Elle rend le
 * niveau ATTEIGNABLE — 8,2 frappes par seconde donnent 40,60 s, qui tombe
 * dedans, la ou 40,80-41,20 etait enjambe par le pas du chrono. Elle ne
 * ferme pas le chantier des deux derniers niveaux : le jeu descend a 40,13 s
 * a huit frappes et a 36,98 a douze, si bien que le dernier plateau se gagne
 * encore a basse cadence. Deux verifications le disent toujours, et elles
 * ont toujours raison de le dire.
 *
 * L'index est celui du plateau, de 0 a 5.
 */
const BAREME_PROPRE = {
  '400h': { 5: [40.10, 41.00] },
};

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
function plateauxDe(cle) {
  const r = RECORDS[cle].s / RECORDS['110h'].s;
  const c = x => Math.round(x * r * 100) / 100;
  const propre = BAREME_PROPRE[cle] || {};
  return BAREME.map(([a, b], i) => propre[i] ? propre[i].slice() : [c(a), c(b)]);
}

const PLATEAUX_PUBLICS = {
  '100h': plateauxDe('100h'),
  '110h': plateauxDe('110h'),
  '400h': plateauxDe('400h'),
};

/**
 * LES BAREMES DU CANAL DE TEST, DONNES EPREUVE PAR EPREUVE.
 *
 * Ils ne se calculent pas, ils se decident. Les dix-huit fourchettes ci-dessous
 * viennent du joueur, le 29 septembre 2026 ; on ne les arrondit pas et on ne
 * les « corrige » pas.
 *
 * D'OU ELLES PARTENT. D'une equivalence de cadence avec Sprinter : pour chaque
 * plateau du 100 m plat (et du 400 m plat pour le tour), la cadence de doigt
 * qui le joue, puis le chrono que les haies donnent a cette meme cadence, appel
 * du joueur parfait, moyenne sur douze calages de la premiere frappe. Le 110 m
 * a ensuite ete retouche au pouce ; le 100 m et le 400 m reprennent la mesure.
 * Releve ce jour-la (frappes/s -> chrono) :
 *
 *            8       9       10      12      16
 *   110h   14,16   12,97   11,74   11,28   11,14
 *   100h   12,72   11,60   10,69   10,34   10,13
 *   400h   42,73   40,99   40,65   39,80   39,09
 *
 * POURQUOI PLUS DE RAPPORT DES RECORDS. Jusqu'ici le 100 m et le 400 m se
 * deduisaient du 110 m par le rapport des records (0,947 pour le 100 m). Mais
 * le 100 m haies court a la meme vitesse de pointe que le 110 m (HAIES, 11,0) :
 * c'est un 110 m plus court de dix metres, et a cadence egale il va 0,90 fois
 * le temps du 110 m, pas 0,947. Deduit, tout son bareme se gagnait trop tot —
 * ses ZEZE des huit frappes, quand Sprinter en demande seize.
 *
 * CE QUI SURPREND ET N'EST PAS UNE COQUILLE :
 *
 *   - LE RECORD N'OUVRE PLUS LE MONDIAL PARTOUT. Au 110 m, le mondial part du
 *     record (12,80). Au 100 m, le record (12,12) tombe dans le national : le
 *     mondial est a 11,30-11,90, parce que le moteur court ce 100 m-la plus
 *     vite que le reel. Au 400 m, le record (45,94) tombe dans les Jeux
 *     mondiaux, juste sous le mondial.
 *   - DES TROUS ENTRE PLATEAUX, comme dans Sprinter (rien entre 9,00 et 9,58
 *     au 100 m plat) : au 110 m, rien entre 11,45 et 12,75, ni entre 13,70 et
 *     14,50, ni entre 15,50 et 16,50.
 *   - LE DERNIER PLATEAU DU 110 M TIENT EN QUINZE CENTIEMES, les Jeux mondiaux
 *     aussi. C'est serre. Si l'un se joue un jour comme une loterie, c'est lui
 *     qu'il faut ouvrir.
 *   - AU-DESSUS DE DOUZE FRAPPES, LE CHRONO DES HAIES BOUGE A PEINE (11,14 a
 *     11,44 au 110 m entre douze et dix-huit). Le dernier plateau se gagne donc
 *     vers douze frappes, pas seize : c'est le moteur, pas le bareme.
 *
 * L'index est celui du plateau, de 0 (scolaire) a 5 (ZEZE).
 */
export const PLATEAUX_TEST = {
  '100h': [
    [16.15, 17.85],   // 1 — scolaire
    [14.20, 16.15],   // 2 — regional
    [11.85, 13.25],   // 3 — national
    [11.30, 11.90],   // 4 — mondial
    [11.30, 11.85],   // 5 — Jeux mondiaux
    [10.05, 10.70],   // 6 — ZEZE
  ],
  '110h': [
    [16.50, 17.00],   // 1 — scolaire
    [14.50, 15.50],   // 2 — regional
    [13.20, 13.70],   // 3 — national
    [12.80, 13.00],   // 4 — mondial
    [12.75, 12.90],   // 5 — Jeux mondiaux
    [11.30, 11.45],   // 6 — ZEZE
  ],
  '400h': [
    [58.00, 62.15],   // 1 — scolaire
    [51.55, 58.00],   // 2 — regional
    [46.50, 47.90],   // 3 — national
    [46.00, 46.50],   // 4 — mondial
    [45.80, 46.10],   // 5 — Jeux mondiaux
    [39.80, 40.30],   // 6 — ZEZE
  ],
};

/**
 * LE BAREME QUE CETTE COPIE DU JEU JOUE.
 *
 * Le bareme du 29 septembre 2026 s'eprouve sur le canal de test avant d'aller
 * a tout le monde, comme le reste (canal.ts). Il n'a rien a cacher — ce sont
 * des nombres — donc il voyage dans les deux builds et on choisit au
 * chargement.
 *
 * La lecture suit la forme des decors (decor-cosmos.js) : `import.meta.env`
 * n'existe pas sous node, ou les harnais passent le canal par l'environnement
 * (`VITE_CANAL=test node tools/haies-test.mjs`).
 *
 * POUR L'OUVRIR A TOUT LE MONDE : PLATEAUX = PLATEAUX_TEST, puis retirer le
 * bareme de la production et plateauxDe.
 */
const CANAL_TEST = (typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_CANAL
  : globalThis.process?.env?.VITE_CANAL) === 'test';

export { PLATEAUX_PUBLICS };
export const PLATEAUX = CANAL_TEST ? PLATEAUX_TEST : PLATEAUX_PUBLICS;

/**
 * Les trois courses, dans la forme que le moteur attend d'une epreuve.
 *
 * SUR LA VITESSE DE POINTE. Ce paragraphe a ete ecrit trois fois, et la
 * troisieme version est revenue a la premiere en sachant pourquoi.
 *
 * Il y a eu, un moment, des plafonds cales sur le reel : 9,40 au 110 m, parce
 * que Coh (2003) chronometre Colin Jackson a 8,83 m/s entre sa 4e et sa 5e
 * haie et a 9,11 a l'appel, quand le jeu portait 11,00. Vingt pour cent
 * au-dessus d'un recordman du monde en pleine course.
 *
 * C'ETAIT CONFONDRE LE MOUVEMENT ET LE CHRONO. Le mouvement doit etre juste —
 * c'est pour cela que le vol ne freine plus comme la course (haies-jeu.js,
 * DRAG_VOL) et que la foulee de haie fait 3,67 m. Le chrono, lui, n'a jamais
 * eu a l'etre : SPRINTER COURT LE 100 M EN 8,25 s QUAND LE RECORD EST A 9,58,
 * et c'est une regle du jeu, pas un accident. Ses plateaux le disent en
 * clair — le mondial du 100 m part exactement du record, 9,58, et les ZEZE
 * passent 9 % dessous, a 8,75. Battre le dernier plateau demande d'y tenir
 * treize a quatorze appuis par seconde : c'est le geste d'un joueur qui
 * s'entraine, et c'est ce qui donne au dernier niveau sa raison d'etre.
 *
 * Les haies gardent donc la base de vitesse de Sprinter. En production, leurs
 * plateaux suivent ses proportions autour de leurs propres records, le RECORD
 * servant d'ancre : il ouvre le niveau mondial, et le dernier niveau le
 * depasse. Sur le canal de test, ils demandent au doigt ce que Sprinter lui
 * demande, plateau par plateau (PLATEAUX_TEST) ; le record reste l'ancre du
 * 110 m, et tombe ailleurs ou la cadence le met.
 */
// `foulee` : la foulee du hurdleur en part de celle du sprinteur (Runner.foulee
// dans sprinter-core.js). Calee par tools/haies-course-test.mjs pour qu'une
// cadence de doigt soutenue donne exactement le rythme d'APPUIS ; voir ce
// harnais avant d'y toucher.
export const HAIES = {
  '100h': {
    key: '100h', label: '100 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 100, maxSpeed: 11.000, best: RECORDS['100h'].s, foulee: 0.82,
    haies: { nombre: NB_HAIES, hauteur: 0.838, premiere: 13.00, ecart: 8.50, fin: 10.50 },
    ranges: PLATEAUX['100h'],
  },
  '110h': {
    key: '110h', label: '110 M HAIES', sub: 'dix haies, la ligne droite',
    arc: 0, straight: 110, maxSpeed: 11.000, best: RECORDS['110h'].s, foulee: 0.86,
    haies: { nombre: NB_HAIES, hauteur: 1.067, premiere: 13.72, ecart: 9.14, fin: 14.02 },
    ranges: PLATEAUX['110h'],
  },
  '400h': {
    key: '400h', label: '400 M HAIES', sub: 'dix haies, un tour de piste',
    fullLap: true, arc: 115.61, straight: 84.39, maxSpeed: 11.536, best: RECORDS['400h'].s, foulee: 0.90,
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
