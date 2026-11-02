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
  // LE 60 M HAIES EN SALLE : la premiere haie et l'ecart sont ceux du 110 m
  // (hommes) et du 100 m (femmes) — memes huit foulees jusqu'a la premiere,
  // memes trois entre deux. Seul le nombre de haies change : cinq.
  '60h':  { premiere: [7, 7], intervalle: [4, 4] },
  '60hf': { premiere: [7, 7], intervalle: [4, 4] },
};

/**
 * Les records du monde, au 2 novembre 2026 (Zurich, 27 aout 2026 : Masai
 * Russell 12,09 au 100 m haies, Alison Dos Santos 45,80 au 400 m haies).
 * En rendu 3D, ils sont aussi le plafond du chrono (sprinter-core.js,
 * RECORDS_DU_MONDE) : les deux tables doivent dire la meme chose.
 *
 * Ils servent de point d'ancrage au niveau Championnat du monde, et a rien
 * d'autre. Les garder ecrits ici avec leur date evite d'avoir un jour a
 * deviner sur quoi le plateau avait ete cale.
 */
export const RECORDS = {
  '100h': { s: 12.09, qui: 'Masai Russell', an: 2026 },
  '110h': { s: 12.80, qui: 'Aries Merritt', an: 2012 },
  '400h': { s: 45.80, qui: 'Alison Dos Santos', an: 2026 },
  // En salle (verifies le 02/11/2026) : Grant Holloway, Albuquerque, 16/02/2024 ;
  // Devynne Charlton, Glasgow, 03/03/2024, egale a Torun le 22/03/2026.
  '60h':  { s: 7.27, qui: 'Grant Holloway', an: 2024 },
  '60hf': { s: 7.65, qui: 'Devynne Charlton', an: 2024 },
};

/**
 * LES BAREMES, DONNES EPREUVE PAR EPREUVE.
 *
 * Ils ne se calculent pas, ils se decident. Les dix-huit fourchettes ci-dessous
 * viennent du joueur, le 29 septembre 2026 ; on ne les arrondit pas et on ne
 * les « corrige » pas. Passees d'abord par le canal de test, elles sont
 * ouvertes a tout le monde le jour meme.
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
export const PLATEAUX = {
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
  // LE 60 M HAIES : les plateaux du 110 m (hommes) et du 100 m (femmes), au
  // rapport que le moteur donne a cadence egale, mesure le 02/11/2026 de 8 a 16
  // frappes : 0,565 chez les hommes, 0,62 chez les femmes. C'est aussi le
  // rapport des records (7,27 / 12,80 = 0,568 ; 7,65 / 12,09 = 0,633).
  '60h': [
    [9.32, 9.60],   // 1 — scolaire
    [8.19, 8.76],   // 2 — regional
    [7.46, 7.74],   // 3 — national
    [7.23, 7.34],   // 4 — mondial
    [7.20, 7.29],   // 5 — Jeux mondiaux
    [6.38, 6.47],   // 6 — ZEZE
  ],
  '60hf': [
    [10.01, 11.07],   // 1 — scolaire
    [8.80, 10.01],   // 2 — regional
    [7.35, 8.21],   // 3 — national
    [7.01, 7.38],   // 4 — mondial
    [7.01, 7.35],   // 5 — Jeux mondiaux
    [6.23, 6.63],   // 6 — ZEZE
  ],
};

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
 * Les haies gardent donc la base de vitesse de Sprinter, et leurs plateaux
 * demandent au doigt ce que Sprinter lui demande, plateau par plateau (voir
 * PLATEAUX). Le record reste l'ancre du 110 m ; au 100 m et au 400 m, il
 * tombe ou la cadence le met.
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

/**
 * LE 60 M HAIES EN SALLE, hommes et femmes (l'auteur, 02/11/2026), au stade
 * couvert Jesse Owens — la ligne droite centrale du 60 m (piste-salle.js,
 * `salleDroite`), huit couloirs. Reglement World Athletics :
 *
 *   hommes   5 haies de 1,067 m   13,72 + 4 x 9,14 + 9,72 = 60
 *   femmes   5 haies de 0,838 m   13,00 + 4 x 8,50 + 13,00 = 60
 *
 * Le depart, la premiere haie et l'ecart sont ceux du 110 m et du 100 m
 * haies : c'est la meme course, coupee apres la cinquieme haie. Vitesse de
 * pointe, foulee et appel en viennent donc tels quels.
 */
HAIES['60h'] = {
  key: '60h', label: '60 M HAIES HOMMES', sub: 'cinq haies, en salle', salleDroite: true, couloirs: 8,
  arc: 0, straight: 60, maxSpeed: 11.000, best: RECORDS['60h'].s, foulee: 0.86,
  haies: { nombre: 5, hauteur: 1.067, premiere: 13.72, ecart: 9.14, fin: 9.72 },
  ranges: PLATEAUX['60h'],
};
HAIES['60hf'] = {
  key: '60hf', label: '60 M HAIES FEMMES', sub: 'cinq haies, en salle', salleDroite: true, couloirs: 8,
  arc: 0, straight: 60, maxSpeed: 11.000, best: RECORDS['60hf'].s, foulee: 0.82,
  haies: { nombre: 5, hauteur: 0.838, premiere: 13.00, ecart: 8.50, fin: 13.00 },
  ranges: PLATEAUX['60hf'],
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
