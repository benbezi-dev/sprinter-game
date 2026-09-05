// L'Objectif du jour — un chrono a battre, taille pour chaque joueur.
//
// Deux fois par jour, midi et dix-neuf heures, chaque joueur classe recoit un
// temps a passer sur le 100 m. Ce temps n'est pas le meme pour tout le monde :
// il est calcule a partir de SES courses a lui.
//
// POURQUOI PAS UNE MARGE FIXE. L'idee naturelle est « ton record + 3 % ». Elle
// ne marche pas, et elle se trompe dans le sens le moins intuitif : plus un
// joueur est regulier, plus la marge doit etre PETITE. Quelqu'un qui tourne en
// permanence a 1 % de son record passe « record + 3 % » a tous les coups —
// l'objectif devient une formalite pour exactement les joueurs qu'on voulait
// occuper. Mesure sur 30 000 objectifs simules : avec un plancher a 2 %, un
// joueur tres regulier valide du premier essai neuf fois sur dix.
//
// On prend donc le probleme par l'autre bout. On regarde ses trente dernieres
// courses, on cherche le temps qu'il realise environ une fois sur trois, et
// c'est celui-la l'objectif. Une fois sur trois, c'est trois parties en
// moyenne — un premier essai rate, deux revanches, et la validation. La marge
// tombe ou elle tombe : 0,5 % pour un metronome, 3 % pour un joueur en dents
// de scie. C'est la meme difficulte ressentie pour les deux.
//
// LE REPLI. Sous huit courses enregistrees, il n'y a rien a calibrer : la
// distribution n'existe pas encore. On applique alors 3,5 % — le milieu de la
// fourchette raisonnable — et on recalibrera quand le joueur aura joue.
//
// CE MODULE NE PARLE A PERSONNE. Il calcule, il range, il rend des textes.
// L'envoi est le travail de push.js, le declenchement celui du cron dans
// index.js. C'est ce qui permet de tester la calibration sans rien envoyer.

import { PLUS_BAS, PLUS_HAUT, directionDe, pasDe } from './epreuves.js';

/* ------------------------------------------------------------- reglages */

/** L'epreuve qui porte les objectifs. Le 100 m est la seule qui ait assez de
 *  courses par joueur pour calibrer : 4300 courses contre 750 sur le 200 m. */
export const EPREUVE = '100';

/** Combien de joueurs du classement sont servis. Le meme nombre que le
 *  tableau public : l'objectif s'adresse a ceux qui y figurent. */
const TOP_N = 500;

/** Une chance sur trois par course, donc trois parties en moyenne. */
const REUSSITE_VISEE = 1 / 3;

/** Bornes de la marge. Le plancher est bas EXPRES (voir l'en-tete) : c'est ce
 *  qui garde l'objectif exigeant pour les joueurs reguliers.
 *
 *  Le plafond est loin, et c'est voulu aussi. Un plafond serre — 5 % par
 *  exemple — parait prudent et ne l'est pas : chez un joueur tres irregulier,
 *  le record est un coup de chance, pas un niveau. Mesure sur nos propres
 *  donnees : un joueur dont le record est 8,28 s mais qui tourne a 9,5 s ne
 *  passe « record + 5 % » qu'une fois sur huit. L'objectif devient une punition
 *  pour celui qui joue le plus. Le vrai garde-fou est plus bas — la mediane —
 *  et il veut dire quelque chose, lui. */
const MARGE_MIN = 0.003;
const MARGE_MAX = 0.12;

/** Sans historique suffisant, le milieu de la fourchette raisonnable. */
const MARGE_REPLI = 0.035;

/** Sous ce nombre de courses, on ne calibre pas : on replie. */
const COURSES_MIN = 8;

/** Au-dela de tant de jours sans courir, on cesse de servir un objectif.
 *  Il reprendra tout seul a la premiere course : rien a reactiver. */
const ACTIF_JOURS = 30;

/** La fenetre d'observation. Trente courses couvrent la forme du moment sans
 *  trainer un niveau d'il y a trois semaines. */
const FENETRE = 30;

/** La precision d'affichage du jeu : deux decimales, donc dix millisecondes. */
const PAS_MS = 10;

/** Les points du Classement des Objectifs. */
const POINTS = {
  base: 100,
  premier_essai: 25,
  record: 50,
  serie_par_jour: 10,
  serie_plafond: 7,
};

/**
 * La notification porte-t-elle le chrono, ou seulement l'invitation ?
 *
 * IL Y A UNE REGLE DANS CE PROJET, et elle est ecrite en tete de push.js :
 * « le message porte le genre de la nouvelle, et rien de plus. Pas de nom
 * d'adversaire, pas de chrono, pas de code » — parce qu'une notification
 * s'affiche sur un ecran verrouille que n'importe qui peut lire.
 *
 * Un objectif qui dit « passe sous 8,35 s » enfreint cette regle. C'est aussi
 * ce qui lui donne sa force : « tu as un objectif » ne fait lever personne,
 * « il te manque 9 centiemes » si. Les deux se defendent, et le choix n'est
 * pas technique — il est a vous.
 *
 * A false, la notification reste generique et le chrono n'apparait qu'a
 * l'ouverture du jeu. Rien d'autre ne change : l'objectif, les points et le
 * classement sont identiques.
 *
 * Ce qu'un chrono de course revele, mis en balance : beaucoup moins qu'un nom
 * d'adversaire ou un code de defi. C'est pour cela que le defaut est ici, et
 * pas dans push.js — la regle generale tient, celle-ci est l'exception qu'on
 * assume en connaissance de cause.
 */
export const CHRONO_DANS_LA_NOTIF = true;

/** Au-dela de tant d'objectifs recus sans la moindre tentative, on se tait.
 *  Deux notifications par jour a quelqu'un qui ne repond plus, c'est la
 *  meilleure facon de le faire couper les notifications pour de bon. */
const SILENCE_APRES = 4;

/* --------------------------------------------------------------- fuseaux */

// Midi et dix-neuf heures n'ont de sens qu'a l'heure du joueur. Un envoi a
// 12:00 UTC tombe a 4 h du matin en Californie : c'est l'inverse de l'heure
// de forte affluence qu'on visait.
//
// On n'a pas le fuseau des joueurs, on a leur pays (player_pays). C'est une
// approximation, et elle suffit : elle place tout le monde a la bonne heure a
// une heure pres, la ou l'ignorer place un joueur sur deux en pleine nuit.
// Les pays a plusieurs fuseaux prennent celui de leur population principale.
const FUSEAU_PAR_PAYS = {
  FR: 'Europe/Paris',   BE: 'Europe/Brussels', CH: 'Europe/Zurich',
  ES: 'Europe/Madrid',  IT: 'Europe/Rome',     PT: 'Europe/Lisbon',
  GB: 'Europe/London',  IE: 'Europe/Dublin',   NL: 'Europe/Amsterdam',
  DE: 'Europe/Berlin',  AT: 'Europe/Vienna',   SK: 'Europe/Bratislava',
  CZ: 'Europe/Prague',  PL: 'Europe/Warsaw',   SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',    DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki',
  GR: 'Europe/Athens',  RO: 'Europe/Bucharest', RU: 'Europe/Moscow',
  TR: 'Europe/Istanbul', UA: 'Europe/Kyiv',
  US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo', AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago', CO: 'America/Bogota', PE: 'America/Lima',
  MA: 'Africa/Casablanca', DZ: 'Africa/Algiers', TN: 'Africa/Tunis',
  SN: 'Africa/Dakar',   CI: 'Africa/Abidjan',  GN: 'Africa/Conakry',
  ML: 'Africa/Bamako',  BF: 'Africa/Ouagadougou', CM: 'Africa/Douala',
  CD: 'Africa/Kinshasa', GA: 'Africa/Libreville', NG: 'Africa/Lagos',
  ZA: 'Africa/Johannesburg', EG: 'Africa/Cairo', KE: 'Africa/Nairobi',
  CN: 'Asia/Shanghai',  JP: 'Asia/Tokyo',      KR: 'Asia/Seoul',
  IN: 'Asia/Kolkata',   ID: 'Asia/Jakarta',    TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh', PH: 'Asia/Manila',   AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',    IL: 'Asia/Jerusalem',  PK: 'Asia/Karachi',
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
};

/** Repli par continent, puis repli tout court. La France pese 75 % des
 *  joueurs localises : c'est elle le defaut, pas UTC. */
const FUSEAU_PAR_CONTINENT = {
  EU: 'Europe/Paris', AM: 'America/New_York', AF: 'Africa/Abidjan',
  AS: 'Asia/Shanghai', OC: 'Australia/Sydney',
};

export function fuseauDe(pays, continent) {
  return FUSEAU_PAR_PAYS[pays]
      || FUSEAU_PAR_CONTINENT[continent]
      || 'Europe/Paris';
}

/** L'heure locale d'un fuseau, decoupee. */
export function heureLocale(date, fuseau) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(date);
  } catch {
    return heureLocale(date, 'UTC');
  }
  const p = {};
  for (const x of parts) p[x.type] = x.value;
  return {
    jour: `${p.year}-${p.month}-${p.day}`,
    heure: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

/**
 * LES DEUX CRENEAUX, ET LEUR FENETRE.
 *
 * L'objectif partait a 12:00 et 19:00 pile. Il part maintenant a 12:45 et
 * 20:15, et il EXPIRE — ce qu'il ne faisait pas.
 *
 * Pourquoi ces heures-la. Midi pile attrape le debut de la pause, quand on
 * cherche encore ou manger ; 12:45 tombe sur le creux d'apres, celui ou l'on a
 * dix minutes et rien a en faire. 19:00 tombe pendant le trajet ou le repas,
 * 20:15 apres. Ce sont deux paris, pas deux certitudes : les chiffres qui les
 * trancheront n'existent pas encore, faute d'avoir jamais mesure une ouverture.
 * Les heures sont donc ici, en clair, et se changent en une ligne.
 *
 * Pourquoi une fenetre. Sans expiration, un objectif du midi reste ouvert la
 * nuit et le lendemain : le second push ne peut pas dire « il expire dans une
 * heure », et « seule la meilleure course compte » ne veut rien dire s'il n'y
 * a pas de fin. Celle du soir deborde sur le lendemain, jusqu'a 2 h — c'est la
 * meme soiree pour celui qui la vit.
 *
 * Le cron passe tous les quarts d'heure, et tous les fuseaux reels sont des
 * multiples de quinze minutes — l'Inde a +05:30, le Nepal +05:45, Chatham
 * +12:45. N'importe quelle minute prise dans {0, 15, 30, 45} finit donc par
 * tomber juste partout, et personne n'est manque. :45 et :15 en font partie.
 */
export const CRENEAUX = {
  midi: {
    nom: 'midi',
    envoi:  { heure: 12, minute: 45 },
    expire: { heure: 18, minute: 59, lendemain: false },
  },
  soir: {
    nom: 'soir',
    envoi:  { heure: 20, minute: 15 },
    expire: { heure: 2, minute: 0, lendemain: true },
  },
};

/** Le creneau du au joueur maintenant, ou null. */
export function creneauMaintenant(date, fuseau) {
  const l = heureLocale(date, fuseau);
  for (const c of Object.values(CRENEAUX)) {
    if (l.heure === c.envoi.heure && l.minute === c.envoi.minute) {
      return { creneau: c.nom, jour: l.jour };
    }
  }
  return null;
}

/**
 * De combien l'heure d'un fuseau est en avance sur UTC, a cet instant.
 *
 * On la mesure plutot que de la lire dans une table : `Intl` connait les
 * changements d'heure, et une table de decalages serait fausse deux fois par
 * an dans chaque hemisphere.
 *
 * Les secondes sont retirees des deux cotes — `heureLocale` n'en rend pas — ce
 * qui laisse un decalage juste a la minute.
 */
function decalageMs(date, fuseau) {
  const l = heureLocale(date, fuseau);
  const [a, m, j] = l.jour.split('-').map(Number);
  const mur = Date.UTC(a, m - 1, j, l.heure, l.minute);
  const instant = Math.floor(date.getTime() / 60000) * 60000;
  return mur - instant;
}

/**
 * Quand un objectif ouvre et quand il expire, en instants absolus.
 *
 * Calcules A LA CREATION et ranges tels quels : ce sont des instants, pas des
 * heures locales, et les comparer ne demande plus de savoir ou vit le joueur.
 * Un joueur qui change de fuseau pendant sa fenetre la garde telle qu'elle a
 * ete ouverte — c'est le comportement voulu, et l'inverse ferait expirer un
 * objectif dans l'avion.
 *
 * `Date.UTC` accepte un quantieme qui deborde du mois : le 32 septembre est le
 * 2 octobre, ce qui est exactement ce qu'il faut pour la fenetre du soir.
 *
 * Reste un angle mort assume : un changement d'heure qui tombe DANS la fenetre
 * la decale d'une heure. Cela arrive deux fois l'an, a 2 ou 3 h du matin, sur
 * le seul creneau du soir.
 */
export function fenetreDe(jour, creneau, fuseau, maintenant) {
  const c = CRENEAUX[creneau];
  if (!c) return null;
  const dec = decalageMs(maintenant || new Date(), fuseau);
  const [a, m, j] = String(jour).split('-').map(Number);
  return {
    ouvre: Date.UTC(a, m - 1, j, c.envoi.heure, c.envoi.minute) - dec,
    expire: Date.UTC(a, m - 1, j + (c.expire.lendemain ? 1 : 0),
                     c.expire.heure, c.expire.minute) - dec,
  };
}

/* ---------------------------------------------------------------- graine */

/**
 * FNV-1a sur 32 bits. Le meme texte rend toujours le meme nombre, ici comme
 * dans le jeu — c'est ce qui permet de recalculer la graine des deux cotes
 * plutot que de se la transmettre et d'esperer qu'elle arrive.
 *
 * A TENIR D'ACCORD avec `hash32` dans src/game/graine.ts.
 */
export function hash32(texte) {
  let h = 0x811c9dc5;
  const s = String(texte);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * La graine d'un defi : le meme terrain pour tout le monde, ce jour-la.
 *
 * ELLE NE DEPEND PAS DU JOUEUR, et c'est tout l'interet. Le chrono a battre,
 * lui, est taille sur chacun ; la piste, les adversaires et leurs temps sont
 * les memes pour tous. Sans cela « le meilleur d'aujourd'hui » ne compare rien
 * — deux joueurs courraient deux courses differentes sous le meme nom.
 *
 * Elle se recalcule partout a partir de trois choses publiques, plutot que de
 * voyager : un nombre transmis est un nombre qu'un client peut changer.
 */
export function graineDe(jour, creneau, epreuve) {
  return hash32(`${jour}:${creneau}:${epreuve}`);
}

/* --------------------------------------------------------------- calibre */

function borner(v, min, max) { return Math.min(max, Math.max(min, v)); }

/** Quantile avec interpolation lineaire, sur un tableau deja trie croissant. */
export function quantile(triee, p) {
  const n = triee.length;
  if (!n) return NaN;
  if (n === 1) return triee[0];
  const i = (n - 1) * borner(p, 0, 1);
  const bas = Math.floor(i), haut = Math.ceil(i);
  if (bas === haut) return triee[bas];
  return triee[bas] + (triee[haut] - triee[bas]) * (i - bas);
}

/**
 * Le chrono a battre, pour un joueur et ses courses.
 *
 * LE SENS DE L'EPREUVE EST UN PARAMETRE, PAS UNE HYPOTHESE. Les trois epreuves
 * du jeu se gagnent au chrono le plus bas, et cette fonction a longtemps ecrit
 * cette hypothese partout : un `q / pb - 1` qui n'a de signe juste que dans ce
 * sens-la, un `<=` pour compter les reussites, un arrondi vers le haut. Sur une
 * epreuve au plus haut — une distance, un score — chacune de ces trois lignes
 * aurait donne un resultat plausible et faux : une cible MEILLEURE que le
 * record, presentee comme un objectif atteignable.
 *
 * Le calcul est donc ecrit une fois, avec un sens. Sur `plus_bas` il rend
 * exactement ce qu'il rendait avant — c'est verifie par le harnais.
 *
 * @param {number} pbMs      Son record sur l'epreuve.
 * @param {number[]} coursesMs  Ses resultats recents, ordre libre.
 * @param {{direction?: string, pas?: number}} [options]
 * @returns {{cibleMs, marge, methode, direction, reussiteEstimee, essaisEstimes, courses}}
 */
export function calibrer(pbMs, coursesMs, options = {}) {
  const direction = options.direction || PLUS_BAS;
  const pas = options.pas || PAS_MS;
  const haut = direction === PLUS_HAUT;

  // Dans quel sens la cible s'ecarte du record. Toute la generalisation tient
  // dans ce signe : le reste du calcul est celui d'avant.
  const sens = haut ? -1 : 1;

  const courses = (coursesMs || [])
    .filter(t => Number.isFinite(t) && t > 0)
    .slice(0, FENETRE)
    .sort((a, b) => a - b);

  /** Ce resultat atteint-il la cible ? */
  const atteint = (t, cible) => haut ? t >= cible : t <= cible;

  /** La cible, ramenee du cote MOINS BON du record, strictement. */
  const ecarter = (cible, borne) => haut
    ? Math.min(cible, Math.floor((borne - 1) / pas) * pas)
    : Math.max(cible, Math.ceil((borne + 1) / pas) * pas);

  let marge, methode;
  if (courses.length >= COURSES_MIN) {
    // La valeur realisee une fois sur trois. Le tableau est trie croissant
    // dans les deux cas : c'est le quantile qu'on prend a l'autre bout.
    const q = quantile(courses, haut ? 1 - REUSSITE_VISEE : REUSSITE_VISEE);
    // La marge se lit toujours « de combien la cible est MOINS BONNE que le
    // record », donc toujours positive, quel que soit le sens.
    marge = borner(sens * (q / pbMs - 1), MARGE_MIN, MARGE_MAX);
    methode = 'quantile';
  } else {
    marge = MARGE_REPLI;
    methode = 'repli';
  }

  // On arrondit au pas d'affichage, et on garde la cible STRICTEMENT moins
  // bonne que le record : une cible egale au record exigerait de le battre,
  // ce qui n'est pas ce qu'on annonce au joueur.
  let cibleMs = Math.round(pbMs * (1 + sens * marge) / pas) * pas;
  cibleMs = ecarter(cibleMs, pbMs);

  // Le garde-fou de l'autre cote : jamais moins exigeant que la mediane du
  // joueur. Un resultat qu'il realise plus d'une fois sur deux n'est pas un
  // objectif, c'est une formalite. Ce plafond-la a un sens que « + 5 % » n'a
  // pas : il est exprime dans les termes du joueur.
  //
  // Quand les deux garde-fous se contredisent — un joueur dont la mediane VAUT
  // le record, parce qu'il refait le meme temps a chaque course — c'est celui
  // du record qui gagne. Ne jamais demander de battre son record est la
  // promesse ; rester au-dessus de la mediane n'est qu'un reglage.
  if (courses.length >= COURSES_MIN) {
    const mediane = quantile(courses, 0.5);
    if (atteint(mediane, cibleMs)) {
      cibleMs = haut
        ? Math.ceil((mediane + 1) / pas) * pas
        : Math.floor((mediane - 1) / pas) * pas;
      cibleMs = ecarter(cibleMs, pbMs);
    }
  }

  let reussiteEstimee = null, essaisEstimes = null;
  if (courses.length >= COURSES_MIN) {
    const touches = courses.filter(t => atteint(t, cibleMs)).length;
    reussiteEstimee = touches / courses.length;
    essaisEstimes = touches ? 1 / reussiteEstimee : null;
  }

  return {
    cibleMs,
    marge: sens * (cibleMs / pbMs - 1),
    methode,
    direction,
    reussiteEstimee,
    essaisEstimes,
    courses: courses.length,
  };
}

/* ---------------------------------------------------------------- tables */

const pretes = new WeakSet();

export async function ensureObjectifTables(db) {
  if (pretes.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS objectifs (
      name_key TEXT NOT NULL,
      jour TEXT NOT NULL,
      creneau TEXT NOT NULL,
      race_key TEXT NOT NULL,
      cible_ms INTEGER NOT NULL,
      pb_ms INTEGER NOT NULL,
      marge REAL NOT NULL,
      methode TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      tentatives INTEGER NOT NULL DEFAULT 0,
      meilleur_ms INTEGER,
      valide_le INTEGER,
      points INTEGER NOT NULL DEFAULT 0,
      ouvre_le INTEGER,
      expire_le INTEGER,
      graine INTEGER,
      PRIMARY KEY (name_key, jour, creneau)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS objectif_classement (
      name_key TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      valides INTEGER NOT NULL DEFAULT 0,
      serie INTEGER NOT NULL DEFAULT 0,
      dernier_jour TEXT,
      maj_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_objectifs_jour
                ON objectifs (jour, creneau)`),
    // L'index dont `joueursAServir` a besoin porte sur `races`, et il est
    // pose par ensureRaceTable, avec la table. Il etait ici, et le lot entier
    // echouait sur une base neuve : CREATE INDEX sur une table absente n'est
    // pas idempotent, meme avec IF NOT EXISTS — c'est l'index qui peut ne pas
    // exister, pas la table. Les trois routes de l'objectif rendaient alors
    // 500, sur un premier deploiement comme sur le canal de test.
  ]);

  // Les trois colonnes de la fenetre et de la graine arrivent apres coup : la
  // table existe deja chez ceux qui ont recu un objectif. Un ALTER par colonne,
  // chacun dans son try — SQLite n'a pas d'ADD COLUMN IF NOT EXISTS, et c'est
  // le cas nominal qui echoue ici, pas l'exception.
  for (const sql of [
    `ALTER TABLE objectifs ADD COLUMN ouvre_le INTEGER`,
    `ALTER TABLE objectifs ADD COLUMN expire_le INTEGER`,
    `ALTER TABLE objectifs ADD COLUMN graine INTEGER`,
  ]) {
    try { await db.prepare(sql).run(); } catch { /* colonne deja presente */ }
  }

  // L'INDEX DE LA FENETRE VIENT APRES LES COLONNES, ET SEUL.
  //
  // Il etait dans le lot du dessus, avec les tables, et c'etait faux d'une
  // maniere qui ne se voit que sur une base DEJA PEUPLEE : sur une base neuve
  // le CREATE TABLE pose `expire_le` et l'index passe ; sur une base existante
  // la colonne n'arrive qu'a l'ALTER, deux lignes plus bas, et l'index echoue
  // en emportant le lot entier — donc les trois routes de l'objectif, chez
  // tous ceux qui en avaient deja un. C'est exactement le chemin qu'aurait
  // pris le deploiement.
  //
  // Deuxieme fois que ce module pose un index sur ce qui n'existe pas encore.
  // Les deux ne se voient qu'a l'essai, et sur deux bases differentes.
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_objectifs_fenetre
                      ON objectifs (name_key, expire_le)`).run();
  } catch { /* colonne pas encore la : l'index attendra le prochain passage */ }

  pretes.add(db);
}

/* ------------------------------------------------------------- selection */

/**
 * Les joueurs a servir maintenant, avec tout ce qu'il faut pour calibrer.
 *
 * Trois requetes en tout, quel que soit le nombre de joueurs — pas une par
 * joueur. La fenetre de trente courses est decoupee par ROW_NUMBER dans la
 * base : ramener 5 000 courses pour n'en garder que trente par joueur ferait
 * le tri du mauvais cote du fil.
 */
export async function joueursAServir(db, maintenant) {
  await ensureObjectifTables(db);

  // Le haut du classement, actif, et qui n'est pas un trou.
  //
  // TROIS FILTRES, ET AUCUN N'EST LA PAR PRUDENCE.
  //
  // Le rang, parce que l'objectif s'adresse a ceux qui figurent au tableau.
  //
  // L'activite, parce qu'un objectif quotidien envoye a quelqu'un qui n'a pas
  // couru depuis six semaines n'est pas une relance, c'est un rappel qu'on
  // peut couper. La date vient des COURSES et non de `scores.updated_at` :
  // cette colonne ne bouge qu'a l'amelioration d'un record, si bien qu'un
  // joueur assidu mais stagnant y passerait pour disparu.
  //
  // Le nom, parce que « Anonyme » n'en est pas un : d'anciennes lignes le
  // portent, et lui envoyer un objectif viserait trois cents personnes a la
  // fois — ou personne, ce qui revient au meme.
  const depuis = (maintenant ? maintenant.getTime() : Date.now())
    - ACTIF_JOURS * 86400000;

  const { results: classes } = await db.prepare(
    `SELECT lower(trim(s.name)) AS k, s.name AS nom, MIN(s.best_split_ms) AS pb,
            COALESCE(r.vu, MAX(s.updated_at)) AS vu
       FROM scores s
       LEFT JOIN (SELECT name_key, MAX(created_at) AS vu FROM races GROUP BY name_key) r
              ON r.name_key = lower(trim(s.name))
      WHERE s.race_key = ? AND s.best_split_ms > 0
        AND lower(trim(s.name)) <> 'anonyme'
      GROUP BY lower(trim(s.name))
     HAVING COALESCE(r.vu, MAX(s.updated_at)) >= ?
      ORDER BY pb ASC
      LIMIT ${TOP_N}`
  ).bind(EPREUVE, depuis).all();

  if (!classes || !classes.length) return [];

  const { results: courses } = await db.prepare(
    `SELECT k, time_ms FROM (
       SELECT lower(trim(name)) AS k, time_ms,
              ROW_NUMBER() OVER (
                PARTITION BY lower(trim(name)) ORDER BY created_at DESC
              ) AS rn
         FROM races WHERE race_key = ?
     ) WHERE rn <= ${FENETRE}`
  ).bind(EPREUVE).all();

  const parJoueur = new Map();
  for (const r of courses || []) {
    if (!parJoueur.has(r.k)) parJoueur.set(r.k, []);
    parJoueur.get(r.k).push(r.time_ms);
  }

  const { results: pays } = await db.prepare(
    `SELECT name_key, pays, continent FROM player_pays`
  ).all();
  const fuseaux = new Map();
  for (const p of pays || []) fuseaux.set(p.name_key, fuseauDe(p.pays, p.continent));

  const dus = [];
  for (let i = 0; i < classes.length; i++) {
    const j = classes[i];
    // `i + 1` est le rang PARMI LES ACTIFS, et c'est ce qu'on annonce. Le rang
    // au tableau complet se lit par `getRank`, qui compte tout le monde ; le
    // dire ici obligerait a une requete par joueur pour un nombre que la
    // notification n'utilise qu'en decor.
    const fuseau = fuseaux.get(j.k) || 'Europe/Paris';
    const du = creneauMaintenant(maintenant, fuseau);
    if (!du) continue;
    dus.push({
      nameKey: j.k, nom: j.nom, rang: i + 1, pb: j.pb, fuseau,
      courses: parJoueur.get(j.k) || [],
      jour: du.jour, creneau: du.creneau,
    });
  }
  return dus;
}

/* ---------------------------------------------------------------- emission */

/**
 * Cree l'objectif d'un joueur pour un creneau, ou rend celui qui existe deja.
 *
 * L'insertion porte sa propre cle (joueur, jour, creneau) : deux passages du
 * cron sur la meme minute ne creent pas deux objectifs, et n'envoient donc pas
 * deux notifications. C'est la seule protection dont on a besoin, et elle est
 * dans la base plutot que dans le code qui appelle.
 */
export async function creerObjectif(db, joueur, maintenant) {
  await ensureObjectifTables(db);

  const existant = await db.prepare(
    `SELECT * FROM objectifs WHERE name_key = ? AND jour = ? AND creneau = ?`
  ).bind(joueur.nameKey, joueur.jour, joueur.creneau).first();
  if (existant) return { objectif: existant, nouveau: false, silencieux: false };

  // Le silence : quatre objectifs de suite sans une seule tentative, et on
  // cesse de sonner. Quelqu'un qui ne repond plus n'a pas besoin d'etre
  // relance deux fois par jour — il a besoin qu'on le laisse revenir de
  // lui-meme.
  //
  // LE SILENCE RETIENT LA SONNERIE, PAS L'OBJECTIF. Il refusait d'abord la
  // creation, et c'etait un piege sans fond : sans objectif, aucune tentative
  // n'est possible ; sans tentative, le compteur ne redescend jamais ; le
  // joueur reste tu pour toujours, meme s'il rouvre le jeu tous les jours.
  // « Revenir de lui-meme » n'avait alors aucun chemin. On cree donc
  // l'objectif quand meme — celui qui ouvre le jeu le trouve, le joue, et sa
  // tentative rompt le silence — et c'est l'appelant qui s'abstient de
  // notifier.
  const { results: recents } = await db.prepare(
    `SELECT tentatives FROM objectifs WHERE name_key = ?
      ORDER BY cree_le DESC LIMIT ?`
  ).bind(joueur.nameKey, SILENCE_APRES).all();
  const silencieux = !!(recents && recents.length >= SILENCE_APRES
      && recents.every(o => o.tentatives === 0));

  const c = calibrer(joueur.pb, joueur.courses, {
    direction: directionDe(EPREUVE), pas: pasDe(EPREUVE),
  });
  const t = Date.now();

  // La fenetre est calculee dans le fuseau du joueur et rangee en instants
  // absolus : une fois ecrite, plus personne n'a besoin de savoir ou il vit.
  const f = fenetreDe(joueur.jour, joueur.creneau, joueur.fuseau, maintenant)
    || { ouvre: t, expire: t + 6 * 3600 * 1000 };
  const graine = graineDe(joueur.jour, joueur.creneau, EPREUVE);

  await db.prepare(
    `INSERT OR IGNORE INTO objectifs
       (name_key, jour, creneau, race_key, cible_ms, pb_ms, marge, methode,
        cree_le, ouvre_le, expire_le, graine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(joueur.nameKey, joueur.jour, joueur.creneau, EPREUVE,
         c.cibleMs, joueur.pb, c.marge, c.methode, t,
         f.ouvre, f.expire, graine).run();

  const objectif = await db.prepare(
    `SELECT * FROM objectifs WHERE name_key = ? AND jour = ? AND creneau = ?`
  ).bind(joueur.nameKey, joueur.jour, joueur.creneau).first();

  return { objectif, nouveau: true, silencieux, calibrage: c };
}

/* -------------------------------------------------------------- tentative */

/**
 * Une course vient d'etre jouee : voici ce qu'elle fait a l'objectif du jour.
 *
 * Appelee a chaque course terminee sur l'epreuve, meme quand il n'y a pas
 * d'objectif ouvert — elle rend alors null, et l'appelant n'a rien a verifier.
 *
 * Les points ne tombent qu'une fois : `valide_le` fait office de verrou, et
 * une seconde validation du meme objectif ne rapporte rien. En revanche le
 * record, lui, se met a jour a chaque fois — battre son record sans valider
 * l'objectif reste un record.
 */
export async function enregistrerTentative(db, nameKey, nom, tempsMs, maintenant) {
  await ensureObjectifTables(db);

  const t = (maintenant || new Date()).getTime();
  const jourFr = heureLocale(maintenant || new Date(), 'Europe/Paris').jour;

  // L'objectif ouvert MAINTENANT.
  //
  // Deux regles dans la meme requete, et il en faut deux : les objectifs
  // d'avant la fenetre n'ont pas d'instants ranges, et les exclure ferait
  // disparaitre l'objectif en cours de tous ceux qui en avaient un au moment
  // du deploiement. Les anciens gardent donc la regle du jour, les nouveaux
  // ont la vraie.
  //
  // `valide_le` NE FILTRE PLUS. Un objectif deja valide reste jouable jusqu'a
  // l'expiration : les tentatives sont illimitees, et seule la meilleure est
  // retenue. Le filtrer revenait a fermer la porte a celui qui vient de
  // reussir — exactement le joueur qu'on voulait garder.
  const objectif = await db.prepare(
    `SELECT * FROM objectifs
      WHERE name_key = ?
        AND (ouvre_le IS NULL OR ouvre_le <= ?)
        AND ((expire_le IS NULL AND jour >= ?) OR expire_le > ?)
      ORDER BY cree_le DESC LIMIT 1`
  ).bind(nameKey, t, jourFr, t).first();
  if (!objectif) return null;

  const dejaValide = !!objectif.valide_le;
  const essai = objectif.tentatives + 1;
  const reussi = tempsMs <= objectif.cible_ms;
  const record = tempsMs < objectif.pb_ms;
  const meilleur = objectif.meilleur_ms == null
    ? tempsMs : Math.min(objectif.meilleur_ms, tempsMs);

  let points = 0;
  const detail = {};
  // Les points ne tombent qu'une fois. Le reste continue : la tentative se
  // compte, le meilleur temps se met a jour, et un record reste un record.
  if (reussi && !dejaValide) {
    detail.base = POINTS.base;
    points += POINTS.base;
    if (essai === 1) { detail.premier_essai = POINTS.premier_essai; points += POINTS.premier_essai; }
    if (record) { detail.record = POINTS.record; points += POINTS.record; }

    const rang = await db.prepare(
      `SELECT serie, dernier_jour FROM objectif_classement WHERE name_key = ?`
    ).bind(nameKey).first();
    const serie = Math.min(rang?.serie || 0, POINTS.serie_plafond);
    if (serie > 0) { detail.serie = serie * POINTS.serie_par_jour; points += detail.serie; }
  }

  // `valide_le` et `points` ne se reecrivent jamais a la baisse : une seconde
  // course, meilleure mais posterieure, ne doit pas effacer l'heure de la
  // validation ni les points deja credites.
  await db.prepare(
    `UPDATE objectifs
        SET tentatives = ?, meilleur_ms = ?,
            valide_le = COALESCE(valide_le, ?),
            points = points + ?
      WHERE name_key = ? AND jour = ? AND creneau = ?`
  ).bind(essai, meilleur, reussi ? Date.now() : null, points,
         nameKey, objectif.jour, objectif.creneau).run();

  if (points > 0) await crediter(db, nameKey, nom, points, objectif.jour);

  return {
    reussi, record, essai, points, detail,
    dejaValide,
    tempsMs,
    cibleMs: objectif.cible_ms,
    pbMs: objectif.pb_ms,
    meilleurMs: meilleur,
    nouveauPbMs: record ? tempsMs : objectif.pb_ms,
    creneau: objectif.creneau,
    expireLe: objectif.expire_le || null,
    graine: objectif.graine || null,
  };
}

/** Le Classement des Objectifs : cumul des points, et la serie de jours. */
async function crediter(db, nameKey, nom, points, jour) {
  const ligne = await db.prepare(
    `SELECT points, valides, serie, dernier_jour FROM objectif_classement WHERE name_key = ?`
  ).bind(nameKey).first();

  // La serie compte les JOURS consecutifs, pas les objectifs : valider midi et
  // soir le meme jour ne compte qu'une fois. Sinon la serie doublerait sans
  // que le joueur revienne un jour de plus.
  let serie = 1;
  if (ligne?.dernier_jour) {
    if (ligne.dernier_jour === jour) serie = ligne.serie;
    else {
      const veille = new Date(jour + 'T00:00:00Z');
      veille.setUTCDate(veille.getUTCDate() - 1);
      serie = ligne.dernier_jour === veille.toISOString().slice(0, 10)
        ? ligne.serie + 1 : 1;
    }
  }

  await db.prepare(
    `INSERT INTO objectif_classement (name_key, nom, points, valides, serie, dernier_jour, maj_le)
     VALUES (?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(name_key) DO UPDATE SET
       nom = excluded.nom,
       points = points + excluded.points,
       valides = valides + 1,
       serie = excluded.serie,
       dernier_jour = excluded.dernier_jour,
       maj_le = excluded.maj_le`
  ).bind(nameKey, nom || nameKey, points, serie, jour, Date.now()).run();
}

/** Le tableau du Classement des Objectifs. */
export async function classementObjectifs(db, limite = TOP_N) {
  await ensureObjectifTables(db);
  const { results } = await db.prepare(
    `SELECT nom, points, valides, serie FROM objectif_classement
      WHERE points > 0 ORDER BY points DESC, valides DESC LIMIT ?`
  ).bind(Math.min(limite, TOP_N)).all();
  return results || [];
}

/* ---------------------------------------------------------------- textes */

const s2 = ms => (ms / 1000).toFixed(2);

/**
 * Ce que dit la notification, dans les deux langues.
 *
 * Cinq tournures par creneau, tirees du couple (joueur, jour, creneau) et pas
 * au hasard : le meme objectif doit produire la meme phrase a chaque lecture.
 * C'est la regle des piques du duel, pour la meme raison — une phrase qui
 * change sous les yeux du joueur n'est la parole de personne.
 */
const TOURNURES = {
  midi: {
    fr: [
      o => `Ton record est de ${o.pb} s. Passe sous ${o.cible} s avant ce soir — ça compte pour le Classement des Objectifs.`,
      o => `${o.cible} s. C'est ${o.ecart} s de ton record. Le temps d'une pause, pas plus.`,
      o => `Tu es ${o.rang}e au 100 m. Ton record dit ${o.pb} s, l'objectif dit ${o.cible} s. L'un des deux ment.`,
      o => `Objectif : ${o.cible} s. Record : ${o.pb} s. Tu sais déjà que tu peux le faire — reste à le refaire.`,
      o => `${o.cible} s à passer. Tu as jusqu'à ce soir, et ça rapporte au Classement des Objectifs.`,
    ],
    en: [
      o => `Your best is ${o.pb} s. Get under ${o.cible} s before tonight — it counts for the Objectives ranking.`,
      o => `${o.cible} s. That is ${o.ecart} s off your best. One break is enough. Or not.`,
      o => `You are ${o.rang} in the 100 m. Your best says ${o.pb} s, the objective says ${o.cible} s. One of them is lying.`,
      o => `Target: ${o.cible} s. Best: ${o.pb} s. You already know you can — now do it on demand.`,
      o => `${o.cible} s to beat. You have until tonight, and it scores in the Objectives ranking.`,
    ],
  },
  soir: {
    fr: [
      o => `Dernière ligne droite : ${o.cible} s à battre, ton record est à ${o.pb} s. Ferme la journée proprement.`,
      o => `${o.ecart} s séparent ton record de l'objectif du soir : ${o.cible} s. Cinq essais maximum, on se connaît.`,
      o => `Record ${o.pb} s, cible ${o.cible} s. Les autres sont déjà dessus. Minuit, dernier délai.`,
      o => `On te demande ${o.cible} s. Tu as déjà fait ${o.pb} s. Techniquement, c'est réglé.`,
      o => `${o.rang}e au 100 m, record ${o.pb} s. Alors ${o.cible} s ne devrait pas te faire peur.`,
    ],
    en: [
      o => `Last chance: ${o.cible} s to beat, your best is ${o.pb} s. Close the day properly.`,
      o => `${o.ecart} s between your best and tonight's target: ${o.cible} s. Five tries tops, we know you.`,
      o => `Best ${o.pb} s, target ${o.cible} s. The others are already on it. Midnight, last call.`,
      o => `We are asking for ${o.cible} s. You have already run ${o.pb} s. Technically, it is settled.`,
      o => `${o.rang} in the 100 m, best ${o.pb} s. So ${o.cible} s should not scare you.`,
    ],
  },
};

const TITRES = {
  midi: { fr: 'Objectif du midi', en: 'Midday objective' },
  soir: { fr: 'Objectif du soir', en: 'Evening objective' },
};

/** La version qui ne dit pas le chrono — voir CHRONO_DANS_LA_NOTIF. */
const DISCRET = {
  midi: {
    fr: 'Ton objectif du jour est en ligne. Il est taillé sur ton record.',
    en: 'Your objective of the day is up. It is cut to your own best.',
  },
  soir: {
    fr: 'Dernière ligne droite : ton objectif du soir t’attend.',
    en: 'Last stretch: your evening objective is waiting.',
  },
};

/** Tirage stable : la meme clef rend toujours le meme indice. */
function indice(clef, n) {
  return hash32(clef) % n;
}

/**
 * Le titre et le texte d'un objectif, prets pour la notification.
 * @returns {{titre:string, corps:string}}
 */
export function texteObjectif(objectif, rang, langue, avecChrono = CHRONO_DANS_LA_NOTIF) {
  const l = langue === 'en' ? 'en' : 'fr';
  const creneau = objectif.creneau === 'soir' ? 'soir' : 'midi';
  if (!avecChrono) return { titre: TITRES[creneau][l], corps: DISCRET[creneau][l] };
  const vue = {
    pb: s2(objectif.pb_ms),
    cible: s2(objectif.cible_ms),
    ecart: ((objectif.cible_ms - objectif.pb_ms) / 1000).toFixed(2),
    rang: rang || '',
  };
  const jeu = TOURNURES[creneau][l];
  const clef = `${objectif.name_key}:${objectif.jour}:${creneau}`;
  return { titre: TITRES[creneau][l], corps: jeu[indice(clef, jeu.length)](vue) };
}

/** Ce que le jeu affiche apres une tentative. Rendu au client, pas pousse. */
export function texteResultat(res, langue) {
  const l = langue === 'en' ? 'en' : 'fr';
  const t = s2(res.tempsMs), c = s2(res.cibleMs);
  if (res.record && res.reussi) {
    const gain = ((res.pbMs - res.tempsMs) / 1000).toFixed(2);
    return l === 'en'
      ? { titre: 'New personal best', corps: `${t} s — ${gain} s off your old best. Objective cleared, +${res.points} pts. Your best is updated: the next objectives start from there.` }
      : { titre: 'Nouveau record', corps: `${t} s — ${gain} s repris à ton ancien record. Objectif validé, +${res.points} pts. Ton record est à jour : les prochains objectifs partiront de là.` };
  }
  if (res.reussi) {
    return l === 'en'
      ? { titre: 'Objective cleared', corps: `${t} s, target was ${c} s. +${res.points} pts` + (res.essai === 1 ? ' — first try.' : ` — in ${res.essai} tries.`) }
      : { titre: 'Objectif validé', corps: `${t} s, la cible était ${c} s. +${res.points} pts` + (res.essai === 1 ? ' — du premier coup.' : ` — en ${res.essai} essais.`) };
  }
  const manque = ((res.tempsMs - res.cibleMs) / 1000).toFixed(2);
  return l === 'en'
    ? { titre: 'Not yet', corps: `${t} s — ${manque} s short. ${c} s is still open.` }
    : { titre: 'Pas encore', corps: `${t} s — il manque ${manque} s. ${c} s reste ouvert.` };
}

export { POINTS, TOP_N, FENETRE, COURSES_MIN, MARGE_MIN, MARGE_MAX, MARGE_REPLI, ACTIF_JOURS };
