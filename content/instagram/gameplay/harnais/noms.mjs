/**
 * LE REPERTOIRE — les noms que la camera va filmer, a un seul endroit.
 *
 * POURQUOI CE FICHIER EXISTE. Les cinq scripts de capture nommaient leurs
 * joueurs en clair : `entrer('KENZA')` dans f1, `NOMS = ['KENZA', …]` dans f3,
 * `{ nom: 'KENZA', device: APP.KENZA }` dans f5, et la liste des vedettes dans
 * `semer.mjs`. Changer un nom demandait donc de le changer a six endroits — et
 * l'oubli ne se voyait pas : `entrer()` sur un nom absent de la base ne tombe
 * pas en panne, il CREE un joueur, non classe, sans pays, sans chrono. Le
 * script se deroule jusqu'au bout et rend un rush faux. C'est la pire des
 * pannes : celle qui ne dit rien.
 *
 * On y accede donc par ROLE et non par nom — `J.camera`, `J.cible` — parce que
 * ce que les scripts veulent dire est « le joueur que je filme » et « celui
 * qu'il defie », pas « KENZA » et « OMAR ».
 *
 * LE REGISTRE, choisi le 9 septembre 2026 : des pseudos, pas des prenoms.
 * Le haut du classement porte des pseudos de vitesse en un mot ; les 288
 * autres sont des dossards, `PLAYER 001` a `PLAYER 288`.
 *
 * Trois contraintes ont ferme des portes :
 *
 *   · PAS DE PLAYER ONE / TWO / THREE en tete du classement. Sur un podium
 *     qui affiche 1, 2, 3 a cote des noms, « PLAYER TWO » troisieme se lit
 *     comme une erreur d'affichage. Les mots sont pour les vedettes, les
 *     chiffres pour le peloton.
 *   · DES MOTS NEUTRES EN LANGUE. Un pseudo ne se traduit pas : les memes
 *     noms doivent tenir dans la version francaise et dans l'anglaise, ce qui
 *     exclut « FANTÔME » ou « COULOIR 4 », pourtant du lexique du jeu.
 *   · AUCUN NOM D'ATHLETE REEL, ni de personnage sous licence. « BOLT » etait
 *     le premier de la liste et en est sorti pour cette raison ; « TRACER »
 *     aussi, remplace par « SURGE ».
 *
 * Vingt caracteres au maximum (`MAX_NAME_LEN`, worker/src/index.js).
 */

/**
 * Les vedettes, DANS L'ORDRE DU CLASSEMENT.
 *
 * L'ordre compte et n'est pas decoratif : `semer.mjs` pose leurs points a la
 * main pour que la camera se tienne JUSTE derriere sa cible, si bien que le
 * duel filme la fasse passer devant elle — et devant deux autres au passage.
 * Deplacer une ligne ici deplace ce qui se voit a l'image.
 */
export const VEDETTES = [
  { role: 'tete',     nom: 'AXIOM',  pays: 'SN', continent: 'AF', palier: 11, lp: 74, mmr: 1690, wins: 41, losses: 19 },
  { role: 'rivale',   nom: 'ZEPHYR', pays: 'FR', continent: 'EU', palier: 11, lp: 22, mmr: 1655, wins: 38, losses: 21 },
  { role: 'cible',    nom: 'COMET',  pays: 'MA', continent: 'AF', palier: 10, lp: 62, mmr: 1610, wins: 35, losses: 22 },
  { role: 'relais3',  nom: 'SURGE',  pays: 'ES', continent: 'EU', palier: 10, lp: 58, mmr: 1596, wins: 33, losses: 21 },
  { role: 'relais2',  nom: 'BLITZ',  pays: 'DE', continent: 'EU', palier: 10, lp: 51, mmr: 1584, wins: 32, losses: 22 },
  // La camera. Elle est 6e, juste derriere `cible`, et c'est elle qu'on sacre.
  { role: 'camera',   nom: 'VOLT',   pays: 'FR', continent: 'EU', palier: 10, lp: 45, mmr: 1575, wins: 31, losses: 20 },
  { role: 'relais1',  nom: 'NITRO',  pays: 'CI', continent: 'AF', palier: 10, lp: 38, mmr: 1560, wins: 29, losses: 21 },
  { role: 'suivante', nom: 'EMBER',  pays: 'MA', continent: 'AF', palier: 10, lp: 29, mmr: 1548, wins: 28, losses: 22 },
  { role: 'troisieme', nom: 'MACH',  pays: 'FR', continent: 'EU', palier: 9,  lp: 88, mmr: 1531, wins: 27, losses: 21 },
  { role: 'dixieme',  nom: 'QUASAR', pays: 'ES', continent: 'EU', palier: 9,  lp: 71, mmr: 1519, wins: 26, losses: 22 },
];

/**
 * Le joueur SANS PAYS, et c'est tout le sujet du reel sur la nationalite : on
 * le filme en train de choisir le sien. Il est pose dans le classement sans
 * une ligne dans `player_pays` — sa ligne montre la place vide ou le drapeau
 * viendra.
 */
export const SANS_PAYS = { role: 'sanspays', nom: 'NOVA', palier: 10, lp: 34, mmr: 1556, wins: 30, losses: 21 };

/** Le nom, par role : `J.camera` vaut 'VOLT'. */
export const J = Object.fromEntries(
  [...VEDETTES, SANS_PAYS].map(v => [v.role, v.nom]));

/** L'equipe de relais, dans l'ordre des passages de temoin. */
export const RELAIS = [J.camera, J.relais1, J.relais2, J.relais3];

/**
 * Le nom du n-ieme coureur du peloton, n commencant a 1.
 *
 * Trois chiffres et non deux : le terrain compte 288 coureurs, et un
 * « PLAYER 7 » au milieu de « PLAYER 128 » casse l'alignement d'une liste a
 * chasse fixe — or le classement et les grilles de depart sont exactement
 * cela. Les zeros de tete sont ce qui fait que les lignes se lisent en
 * colonne.
 */
export const dossard = n => `PLAYER ${String(n).padStart(3, '0')}`;

/** La cle d'un nom, telle que le serveur la calcule. */
export const cle = nom => String(nom).trim().toLowerCase();
