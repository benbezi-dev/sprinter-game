import {
  recalculerClassement, ETAGES, DIVISIONS, LEGENDE, LP_PAR_PALIER, LP, rangDe,
  ensureDuelTables, duelBoard, appliquerDuel, compterLance,
} from './duels.js';
import { poserMot, MAX_TEXTE } from './mot.js';
import { nettoyerInsta } from './insta.js';
export { SalleDirecte } from './salle.js';
export { SalleRelais } from './salle-relais.js';
export { SalleConfrontation } from './salle-confrontation.js';
export { Boite } from './boite.js';
import { sonner } from './boite.js';
import { notifierAppareil } from './push.js';
import {
  ensureChampTables, noterPays, choisirPays, paysEligibles, effectifPays,
  ouvrirNational, ouvrirEchelon, ouvrirCycle, calendrierCycle,
  titresDe, continentDe,
  etatEdition, editionDe, enregistrerCourse, cloturerPhase,
  medaillesDe, paysDe, listeNations,
  fluxDirect, recapMondial,
} from './championnats.js';
import {
  ensureRelayTables, creerEquipe, repondre, ordonner, mesEquipes,
  classementRelais, enregistrerRelais, equipe as equipeRelais,
  fantomesRelais, fantomeRelais,
} from './relais.js';

import {
  verifierAcces, creerAcces, revoquerAcces, rendreAcces, listerAcces, estAdmin,
  estTableau,
} from './acces.js';
import {
  ensureReseauxTables, regarderClassement, regarderDuel, regarderSacre,
  regarderCap, fileDAttente, ecarter, marquerPublie, MOMENTS,
} from './reseaux.js';
import {
  ouvrirTransfert, utiliserTransfert, demanderRecuperation, etatRecuperation,
  listerRecuperations, trancherRecuperation, estUnCode, COMPTE_JEU,
} from './identite.js';
import { alerterRecuperation } from './courriel.js';

/**
 * La porte du relais : ouverte.
 *
 * Elle a vecu longtemps sous la forme `canal => canal.test` — ouverte sur le
 * canal de test, fermee en production, un seul deploiement servant les deux.
 * Le jour de l'ouverture etant venu, elle renvoie true sans condition, comme
 * il etait prevu. On garde la forme d'une fonction plutot que d'effacer les
 * appels : refermer doit rester l'affaire d'une ligne, et le canal de test
 * reste distinct par sa base, pas par ce qu'il autorise.
 */
const relaisOuvert = () => true;
/**
 * Les championnats : ouverts a la lecture, tenus par la cle a l'ecriture.
 *
 * Cette porte protegeait autre chose que ce qu'elle avait l'air de proteger.
 * Quatre routes de la famille ecrivent — `ouvrir` et `cycle` creent des
 * editions, `course` enregistre des chronos, `cloturer` qualifie et sacre — et
 * aucune ne verifiait a qui elle parlait. Entre gens qui se connaissent, sur
 * le canal de test, cela n'avait pas d'importance ; l'ouvrir telle quelle
 * aurait suffi a fabriquer un champion du Maroc dans la vraie base, ou a
 * cloturer une finale que personne n'a courue, avec une requete a la main.
 *
 * Elles demandent maintenant ADMIN_CLE, comme /duels/recalculer. Ce ne sont
 * pas des routes de joueur : seul le tableau de bord des championnats les
 * appelle, et il porte deja la cle. Ce que voit le jeu — le calendrier, le
 * fil, les titres, sa propre edition — reste ouvert a tous.
 */
const championnatsOuverts = () => true;
/**
 * Le mot du vainqueur : ouvert avec les duels, comme annonce.
 *
 * C'est la seule ecriture du jeu ou un joueur produit un contenu qu'un autre
 * lira, et personne ne la relit avant qu'il n'arrive. La porte etait tenue
 * fermee tant que les duels de production l'etaient ; ils s'ouvrent, elle
 * s'ouvre. Le tableau de moderation reste le seul filet — c'est un choix, et
 * il se referme ici en remettant `canal => canal.test`.
 */
const motOuvert = () => true;

const ALLOWED_RACES = new Set(['100', '200', '400']);
const MAX_NAME_LEN = 20;
const MIN_TIME_MS = 1000;       // en dessous, forcement invalide
const MAX_TIME_MS = 20 * 60000; // 20 minutes, plafond large
// Un defi porte les traces des courses de son auteur, pour que l'adversaire
// puisse l'affronter en fantome. On plafonne pour qu'un client ne puisse pas
// remplir la base : 6 epreuves, ~13 releves/s, largement de quoi tenir un
// 400 m par epreuve.
const MAX_RACES = 6;
const MAX_TRACE_PTS = 1200;
const TOP_N = 500;
// Cumul sentinelle : marque une ligne nee d'un one shot ou d'un defi, sans
// parcours complet derriere. Doit rester identique cote jeu (NO_RUN_MS).
const NO_RUN_MS = 1200000;

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // TOUS nos en-tetes maison doivent figurer ici, sinon le navigateur bloque
  // la requete AVANT de l'envoyer : un en-tete qui n'est pas « simple »
  // declenche un pre-vol, et le pre-vol refuse ce qui n'est pas annonce.
  //
  // Sans cette ligne, tout le canal de test etait muet depuis un navigateur —
  // et le defaut se cachait bien, la porte d'entree et les WebSockets etant
  // les deux seuls chemins qui n'utilisent pas ces en-tetes.
  //
  // La meme chose s'est reproduite avec `X-Sprinter-Tableau` : ajouter un
  // en-tete sans l'annoncer ici donne une panne qui ne ressemble pas a une
  // panne de CORS — le tableau affichait « serveur injoignable », parce que
  // cote client un pre-vol refuse se presente comme un `fetch` qui echoue,
  // sans statut ni message. Qui ajoute un en-tete ajoute une ligne ici.
  resp.headers.set('Access-Control-Allow-Headers',
                   'Content-Type, X-Sprinter-Test, X-Sprinter-Admin, X-Sprinter-Tableau');
  return resp;
}

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

// Regles par route : le nombre d'appels qu'une meme IP peut faire dans la
// fenetre, avant d'etre mise en attente. `/test/entrer` est la plus stricte
// des trois : c'est la seule qui ressemble a une authentification, et donc
// la seule qu'une force brute chercherait a marteler.
const RATE_LIMITS = {
  '/test/entrer': { max: 8, fenetreMs: 60_000 },
  '/duel/mot': { max: 6, fenetreMs: 60_000 },
  default: { max: 30, fenetreMs: 60_000 },
};

const limitesReady = new WeakSet();
async function ensureRateLimitTable(db) {
  if (limitesReady.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
    cle TEXT PRIMARY KEY,
    fenetre_debut INTEGER NOT NULL,
    compte INTEGER NOT NULL
  )`).run();
  limitesReady.add(db);
}

/**
 * Cette IP a-t-elle encore droit a un appel sur cette route, maintenant ?
 *
 * Fenetre fixe plutot que glissante : moins precis pres des bords, mais une
 * seule ligne par cle et une seule ecriture par appel — ce que la fenetre
 * glissante ne tient pas sans une table d'evenements qui grossit sans fin.
 */
async function sousLimite(db, ip, route) {
  await ensureRateLimitTable(db);
  const regle = RATE_LIMITS[route] || RATE_LIMITS.default;
  const cle = `${route}:${ip}`;
  const now = Date.now();
  const row = await db.prepare(
    `SELECT fenetre_debut, compte FROM rate_limits WHERE cle = ?`
  ).bind(cle).first();

  if (!row || now - row.fenetre_debut >= regle.fenetreMs) {
    await db.prepare(
      `INSERT INTO rate_limits (cle, fenetre_debut, compte) VALUES (?, ?, 1)
       ON CONFLICT(cle) DO UPDATE SET fenetre_debut = excluded.fenetre_debut, compte = 1`
    ).bind(cle, now).run();
    return true;
  }
  if (row.compte >= regle.max) return false;
  await db.prepare(`UPDATE rate_limits SET compte = compte + 1 WHERE cle = ?`).bind(cle).run();
  return true;
}

function cleanName(raw) {
  const s = String(raw || '').trim().slice(0, MAX_NAME_LEN);
  return s.replace(/[<>]/g, '') || 'Anonyme';
}

function isValidDeviceId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

// Identifiant de defi court et lisible a l'oral : pas de 0/O ni 1/I/L, pour
// qu'on puisse le dicter sans ambiguite.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function makeCode(n = 6) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

function validRaces(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= MAX_RACES &&
    v.every(r => ALLOWED_RACES.has(r));
}

// Les traces sont des tableaux d'entiers (decimetres). On les valide et on
// les tronque plutot que de faire confiance au client.
function cleanTrace(t) {
  const arr = [];
  if (!Array.isArray(t)) return arr;
  for (let j = 0; j < t.length && j < MAX_TRACE_PTS; j++) {
    const n = Math.round(Number(t[j]));
    arr.push(Number.isFinite(n) ? Math.max(0, Math.min(60000, n)) : 0);
  }
  return arr;
}
function cleanTraces(v, nRaces) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (let i = 0; i < nRaces; i++) out.push(cleanTrace(v[i]));
  return out;
}

// Migration paresseuse : la table scores existe depuis longtemps, on lui
// ajoute les colonnes du fantome au premier passage. ALTER TABLE echoue si la
// colonne est deja la — c'est le cas nominal, on ignore.
// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const scoresReady = new WeakSet();
async function ensureScoreGhost(db) {
  if (scoresReady.has(db)) return;
  // La table des scores a longtemps ete creee a la main, au demarrage du
  // projet : le code ne savait que lui ajouter des colonnes. Cela tenait tant
  // qu'il n'y avait qu'une base — sur une base neuve, chaque route qui la
  // touche echouait sans rien dire, l'ALTER TABLE etant deja avale par le
  // try/catch. On la cree donc ici, comme toutes les autres.
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS scores (
      device_id TEXT NOT NULL,
      race_key TEXT NOT NULL,
      name TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      best_split_ms INTEGER NOT NULL DEFAULT 0,
      trace TEXT,
      trace_ms INTEGER,
      PRIMARY KEY (device_id, race_key)
    )`).run();
  } catch (e) { /* deja la */ }
  for (const sql of [
    `ALTER TABLE scores ADD COLUMN trace TEXT`,
    `ALTER TABLE scores ADD COLUMN trace_ms INTEGER`,
  ]) {
    try { await db.prepare(sql).run(); } catch (e) { /* colonne deja presente */ }
  }
  scoresReady.add(db);
}

// Le TOP 500 classe le meilleur chrono realise sur UNE course, pas le cumul
// du parcours : c'est le temps que l'on compare naturellement d'un joueur a
// l'autre. Le cumul reste renvoye, mais a titre indicatif.
// Les lignes a best_split_ms = 0 datent d'avant l'enregistrement du chrono
// par course : sans chrono, pas de classement — sinon elles trusteraient la
// premiere place avec un 0,00 s.
//
// `id` est le rowid : un identifiant opaque qui permet de defier une ligne du
// tableau sans jamais exposer le device_id de son proprietaire. `has_ghost`
// dit si la course est rejouable en fantome.
// Une entree par joueur, pas par appareil. Un meme joueur qui joue sur son
// telephone et son ordinateur creait autant de lignes : le tableau se
// remplissait de ses propres tentatives. On regroupe donc sur le nom et on ne
// garde que son meilleur chrono.
//
// GROUP BY avec MIN() : SQLite garantit que les colonnes nues proviennent de
// la ligne qui porte le minimum. L'identifiant renvoye est donc bien celui de
// la meilleure course — c'est elle qu'on defie, et son fantome qu'on affronte.
//
// `by` decide sur quoi porte le regroupement : le classement par course se
// resume au meilleur chrono d'une course, celui des parcours au meilleur
// cumul. Regrouper une fois pour les deux donnerait un cumul qui n'est pas le
// meilleur du joueur.
async function getLeaderboard(db, race, by = 'race') {
  // La colonne insta vient de la table des joueurs, et cette table peut ne pas
  // avoir encore recu sa migration. Sans cette ligne, le classement entier
  // repond 500 au premier deploiement — c'est deja arrive avec la colonne des
  // traces, on ne le refait pas.
  await ensurePlayerTables(db);
  const col = by === 'run' ? 'time_ms' : 'best_split_ms';
  const garde = by === 'run'
    ? `time_ms > 0 AND time_ms < ${NO_RUN_MS}`
    : `best_split_ms > 0`;
  const { results } = await db.prepare(
    `SELECT s.rowid AS id, s.name, s.time_ms, s.best_split_ms, s.updated_at,
            MIN(s.${col}) AS _min,
            (s.trace IS NOT NULL AND length(s.trace) > 2) AS has_ghost,
            p.insta AS insta
       FROM scores s
       LEFT JOIN players p ON p.name_key = lower(trim(s.name))
      WHERE s.race_key = ? AND ${garde.replace(/\b(time_ms|best_split_ms)\b/g, 's.$1')}
      GROUP BY lower(trim(s.name))
      ORDER BY _min ASC LIMIT ${TOP_N}`
  ).bind(race).all();
  return (results || []).map(({ _min, ...r }) => ({ ...r, has_ghost: !!r.has_ghost }));
}

// Le rang se compte en joueurs devant soi, pas en lignes : sans cela, un
// joueur present sur trois appareils occuperait trois places et repousserait
// tout le monde vers le bas.
async function getRank(db, race, splitMs) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT MIN(best_split_ms) AS m FROM scores
        WHERE race_key = ? AND best_split_ms > 0
        GROUP BY lower(trim(name))
     ) WHERE m < ?`
  ).bind(race, splitMs).first();
  return (row?.n || 0) + 1;
}

// Une ligne par appareil et par jour : un meme visiteur qui revient dix fois
// dans la journee compte pour dix passages mais un seul visiteur. Rien de
// nominatif n'est stocke, seulement l'identifiant anonyme deja utilise par le
// classement.
const visitsReady = new WeakSet();
async function ensureVisitTable(db) {
  if (visitsReady.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS visits (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (day, device_id)
  )`).run();
  visitsReady.add(db);
}

// Le bouton RECOMMENCER, compte comme les visites : une ligne par appareil et
// par jour, rien de nominatif. Le jeu ne l'instrumentait pas — sans ce
// compteur, personne ne pouvait dire combien de fois une course est relancee,
// ni si le raccourci sert. Meme forme que `visits` pour que le tableau les
// lise de la meme facon.
const reprisesReady = new WeakSet();
async function ensureRepriseTable(db) {
  if (reprisesReady.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS reprises (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (day, device_id)
  )`).run();
  reprisesReady.add(db);
}

// Un defi peut viser quelqu'un en particulier. La colonne est ajoutee apres
// coup sur une table qui existe deja, d'ou la migration paresseuse.
const targetReady = new WeakSet();
async function ensureChallengeTarget(db) {
  if (targetReady.has(db)) return;
  try { await db.prepare(`ALTER TABLE challenges ADD COLUMN target_device TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  targetReady.add(db);
}

// Historique des courses. Indexe sur le nom autant que sur l'appareil : c'est
// ce qui permet a un joueur de retrouver ses courses en changeant de
// telephone. Le nom n'est pas authentifie — deux personnes qui choisissent le
// meme verraient donc un historique commun. Compromis assume : c'est deja
// l'identite publique du classement, et l'alternative serait un compte.
const HIST_PER_DEVICE = 300;
const racesReady = new WeakSet();
async function ensureRaceTable(db) {
  if (racesReady.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      race_key TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      mode TEXT NOT NULL,
      level_idx INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS races_by_name ON races(name_key, race_key, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS races_by_device ON races(device_id, race_key, created_at)`),
  ]);
  racesReady.add(db);
}

// Un nom appartient a quelqu'un, et cet appartenance se prouve par un code
// court. C'est ce qui remplace un compte : pas de tiers, pas d'e-mail, pas
// d'ecran de consentement — juste de quoi relier ses appareils et empecher
// qu'on prenne son nom.
const joueursReady = new WeakSet();
async function ensurePlayerTables(db) {
  if (joueursReady.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS players (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS player_devices (
      name_key TEXT NOT NULL,
      device_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (name_key, device_id)
    )`),
  ]);
  // Le pseudo Instagram arrive apres coup : la table existe deja chez ceux qui
  // ont reserve leur nom.
  try { await db.prepare(`ALTER TABLE players ADD COLUMN insta TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  joueursReady.add(db);
}

/** Cet appareil a-t-il le droit d'ecrire sous ce nom ? */
async function peutUtiliser(db, nameKey, deviceId) {
  if (!nameKey) return true;                       // anonyme : rien a proteger
  await ensurePlayerTables(db);
  const p = await db.prepare(`SELECT name_key FROM players WHERE name_key = ?`)
    .bind(nameKey).first();
  if (!p) return true;                             // nom encore libre
  const d = await db.prepare(
    `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
  ).bind(nameKey, deviceId).first();
  return !!d;
}

async function ensureChallengeTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      owner_device TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      races TEXT NOT NULL,
      level_idx INTEGER NOT NULL,
      total_ms INTEGER NOT NULL,
      splits TEXT NOT NULL,
      traces TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS challenge_attempts (
      id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      total_ms INTEGER NOT NULL,
      splits TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (id, device_id)
    )`),
  ]);
  await ensureAttemptTraces(db);
}

/* --------------------------------------------------- la trace du repondant
   Le defi gardait la course de celui qui LANCE, et lui seul : c'est elle qui
   sert de fantome a celui qui releve. L'inverse manquait, et il manquait
   quelque chose avec lui — le perdant d'un duel n'avait personne a courir dans
   sa revanche. Il repartait sur une piste vide avec un chrono a battre pour
   seule indication, alors que la course qui l'avait battu avait bien eu lieu.

   Colonne ajoutee apres coup, comme ailleurs ici : ALTER TABLE echoue si elle
   est deja la, ce qui est le cas nominal. La memoire est tenue PAR BASE — le
   worker en sert deux, production et test, et un simple booleen laisserait la
   seconde sans colonne. */
const attemptTracesReady = new WeakSet();
async function ensureAttemptTraces(db) {
  if (attemptTracesReady.has(db)) return;
  try { await db.prepare(`ALTER TABLE challenge_attempts ADD COLUMN traces TEXT`).run(); }
  catch { /* deja la */ }
  attemptTracesReady.add(db);
}

const pushTableReady = new WeakSet();
async function ensurePushTable(db) {
  if (pushTableReady.has(db)) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      device_id   TEXT PRIMARY KEY,
      subscription TEXT NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch())
    )
  `).run();
  pushTableReady.add(db);
}

/**
 * Sonne la boite WebSocket ET envoie un push natif si le joueur est abonné.
 * Remplace sonner() pour les événements qui méritent un push.
 */
async function sonnerEtPush(env, deviceId, type, canalTest, labelFr, labelEn) {
  await sonner(env, deviceId, type, canalTest);
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const db = canalTest ? env.DB_TEST : env.DB;
  try {
    await ensurePushTable(db);
    await notifierAppareil(db, deviceId, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  } catch { /* le push est best-effort : une erreur ne casse pas l'écriture */ }
}

async function attemptsFor(db, id) {
  const { results } = await db.prepare(
    `SELECT name, total_ms, splits, created_at FROM challenge_attempts
      WHERE id = ? ORDER BY total_ms ASC LIMIT 50`
  ).bind(id).all();
  return (results || []).map(r => ({
    name: r.name, total_ms: r.total_ms, created_at: r.created_at,
    splits: JSON.parse(r.splits || '[]'),
  }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    // ------------------------------------------------------------- le canal
    //
    // Un seul worker sert deux mondes. Le code d'acces presente par l'appelant
    // decide duquel : sans code valide on est en production, avec on est sur le
    // canal de test, ou tout est ouvert.
    //
    // La verification se fait toujours contre la base de production, qui tient
    // la liste des acces — sans quoi on ne pourrait plus rien verifier apres
    // avoir bascule.
    const production = env.DB;
    const codeDonne = request.headers.get('X-Sprinter-Test')
      || url.searchParams.get('acces') || '';
    const acces = codeDonne && production
      ? await verifierAcces(production, codeDonne, ctx) : null;
    const canal = { test: !!acces, nom: acces ? acces.nom : null };

    // Les quatre-vingt-treize routes qui suivent parlent a `env.DB` sans avoir
    // a savoir sur quel canal elles tournent. On leur passe donc un env dont DB
    // pointe deja sur la bonne base : une seule ligne decide, plutot que
    // quatre-vingt-treize occasions d'en oublier une.
    if (canal.test && env.DB_TEST) env = { ...env, DB: env.DB_TEST };

    // Ce qui part vers les reseaux a besoin de la base ET du canal, ensemble.
    // Les passer lies plutot que separement n'est pas une commodite : c'est ce
    // qui permet a `noter()` de refuser le canal de test elle-meme, au lieu de
    // faire confiance a cinq appelants pour y penser chacun de leur cote.
    canal.db = env.DB;

    // --------------------------------------------------------- anti-abus
    //
    // Toute ecriture passe par une IP, et une IP qui insiste plus que de
    // raison sur la meme route n'a aucune raison legitime de le faire : ni
    // un joueur qui pose son chrono, ni un navigateur qui tente un code
    // d'acces. On la ralentit avant qu'elle n'atteigne la route elle-meme.
    //
    // Un compteur par (route, IP), remis a zero a l'expiration de sa
    // fenetre : pas de nouvelle brique d'infrastructure, la meme base D1 qui
    // tient deja les scores tient ce compteur. Une protection au niveau du
    // reseau (regle de rate-limiting Cloudflare, DDoS) reste la premiere
    // ligne de defense contre un deluge massif ; celle-ci vise l'abus a
    // l'echelle d'un joueur ou d'un script isole, pas d'un botnet.
    //
    // Le canal de test en est exempte : qui s'y trouve a deja presente un
    // code individuel et revocable, ce que l'IP n'ajoute rien a verifier —
    // et c'est aussi le canal que les harnais de simulation martelent
    // volontairement pour rejouer un cycle de championnat ou un relais en
    // quelques secondes.
    if (request.method === 'POST' && !canal.test) {
      const ip = request.headers.get('CF-Connecting-IP') || 'inconnue';
      if (!(await sousLimite(env.DB, ip, url.pathname))) {
        return json({ error: 'trop de tentatives, reessayez dans une minute' }, 429);
      }
    }

    // ------------------------------------------------------ acces au test
    if (url.pathname.startsWith('/test/')) {
      const sous = url.pathname.slice('/test/'.length);

      // Le code est-il bon ? Le jeu s'en sert pour savoir s'il ouvre sa porte.
      if (sous === 'entrer' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const r = await verifierAcces(production, (body || {}).code, ctx);
        return r ? json({ ok: true, nom: r.nom })
                 : json({ error: 'code refuse' }, 403);
      }

      // Administration. Sans le secret ADMIN_CLE pose sur le worker, tout ici
      // repond 403 : ferme par defaut plutot qu'ouvert par oubli.
      if (sous.startsWith('admin/')) {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        const quoi = sous.slice('admin/'.length);

        if (quoi === 'liste' && request.method === 'GET') {
          return json({ acces: await listerAcces(production) });
        }
        if (quoi === 'creer' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          // `code` est facultatif : sans lui le serveur en tire un, avec lui
          // on choisit le sien — plus facile a dicter a celui qui le recoit.
          const r = await creerAcces(production, (body || {}).nom, (body || {}).code);
          return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
        }
        if (quoi === 'revoquer' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          const r = await revoquerAcces(production, (body || {}).code);
          return r.erreur ? json({ error: r.erreur }, 400) : json(r);
        }
        if (quoi === 'rendre' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          const r = await rendreAcces(production, (body || {}).code);
          return r.erreur ? json({ error: r.erreur }, 400) : json(r);
        }
      }

      return json({ error: 'not found' }, 404);
    }

    // ------------------------------------------------------- classement
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const race = url.searchParams.get('race');
      if (!ALLOWED_RACES.has(race)) return json({ error: 'race invalide' }, 400);
      // getLeaderboard lit la colonne trace : elle doit exister avant.
      await ensureScoreGhost(env.DB);
      const by = url.searchParams.get('by') === 'run' ? 'run' : 'race';
      const entries = await getLeaderboard(env.DB, race, by);
      return json({ race, by, entries });
    }

    // Le pays d'un joueur, vu par Cloudflare sur la requete elle-meme. On le
    // note au passage plutot que de le demander : personne n'a envie de
    // remplir un formulaire pour courir un 100 metres. Le joueur peut le
    // corriger, et son choix ne se fait jamais ecraser.
    const paysVu = (request.cf && request.cf.country) || null;

    if (url.pathname === '/submit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

      const { device_id, race_key, name, time_ms, best_split_ms, trace } = body || {};
      if (!ALLOWED_RACES.has(race_key)) return json({ error: 'race invalide' }, 400);
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (paysVu) await noterPays(env.DB, cleanName(name).trim().toLowerCase(), paysVu);
      const t = Math.round(Number(time_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      // le meilleur chrono individuel ne peut pas depasser le temps total
      let split = Math.round(Number(best_split_ms));
      if (!Number.isFinite(split) || split <= 0 || split > t) split = t;
      const cleanedName = cleanName(name);
      // Un nom reserve n'accepte que les appareils de son proprietaire :
      // sans cela la reservation ne protegerait rien.
      if (!await peutUtiliser(env.DB, cleanedName.trim().toLowerCase(), device_id)) {
        return json({ error: 'nom reserve', pris: true }, 403);
      }
      const now = Date.now();
      await ensureScoreGhost(env.DB);

      const existing = await env.DB.prepare(
        `SELECT time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(device_id, race_key).first();

      // Le meilleur chrono individuel doit survivre indefiniment pour cet
      // appareil/course, meme si c'est un run avec un moins bon temps total
      // qui l'a produit : on ne le remplace jamais par une valeur pire.
      const bestSplit = existing ? Math.min(split, existing.best_split_ms || split) : split;

      if (!existing || t < existing.time_ms) {
        await env.DB.prepare(
          `INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(device_id, race_key) DO UPDATE SET
             name = excluded.name, time_ms = excluded.time_ms,
             best_split_ms = excluded.best_split_ms, updated_at = excluded.updated_at`
        ).bind(device_id, race_key, cleanedName, t, bestSplit, now).run();
      } else {
        await env.DB.prepare(
          `UPDATE scores SET name = ?, best_split_ms = ? WHERE device_id = ? AND race_key = ?`
        ).bind(cleanedName, bestSplit, device_id, race_key).run();
      }

      // La trace n'accompagne que le meilleur chrono par course : c'est elle
      // qu'un adversaire affrontera en fantome depuis le tableau.
      if (split === bestSplit) {
        const tr = cleanTrace(trace);
        if (tr.length) {
          await env.DB.prepare(
            `UPDATE scores SET trace = ?, trace_ms = ? WHERE device_id = ? AND race_key = ?`
          ).bind(JSON.stringify(tr), bestSplit, device_id, race_key).run();
        }
      }

      const bestTime = existing && existing.time_ms < t ? existing.time_ms : t;
      // le rang se joue sur le meilleur chrono d'une course, pas sur le cumul
      const rank = await getRank(env.DB, race_key, bestSplit);
      const entries = await getLeaderboard(env.DB, race_key);

      // Ce chrono vient-il de produire un moment qui se raconte ? La question
      // se pose ici parce que c'est ici qu'on a tout : le classement relu, le
      // rang, et le nom. La poser ailleurs obligerait a redemander les trois.
      //
      // `waitUntil` et pas `await` : le joueur attend son classement, et il
      // n'a pas a payer l'ecriture d'une ligne qui ne le concerne pas. Si le
      // signalement echoue, il echoue seul et en silence — voir `noter()`.
      ctx.waitUntil(regarderClassement(canal, race_key, cleanedName, bestSplit, entries));

      // Les caps de frequentation. Ils se regardent ici plutot que dans /stats :
      // /stats est une lecture, et une lecture ne doit pas ecrire — un tableau
      // de bord ouvert deux fois signalerait deux fois le meme cap. Une course
      // enregistree, elle, est un evenement, et c'est le bon moment pour
      // demander si le compteur vient de passer un rond.
      //
      // La table `reseaux_caps` est ce qui rend l'appel repetable : elle retient
      // les seuils deja franchis, donc l'appeler a chaque course ne produit un
      // moment qu'une fois.
      ctx.waitUntil((async () => {
        try {
          const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores`).first();
          await regarderCap(canal, 'joueurs', n && n.n);
        } catch { /* un cap manque ne casse rien */ }
      })());

      return json({ race: race_key, rank, best_time_ms: bestTime,
                    best_split_ms: bestSplit, entries });
    }

    if (url.pathname === '/rank' && request.method === 'GET') {
      const race = url.searchParams.get('race');
      const deviceId = url.searchParams.get('device_id');
      if (!ALLOWED_RACES.has(race) || !isValidDeviceId(deviceId)) {
        return json({ error: 'parametres invalides' }, 400);
      }
      const row = await env.DB.prepare(
        `SELECT name, time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(deviceId, race).first();
      // Sans chrono par course enregistre (ligne anterieure a la mesure), le
      // joueur n'a pas encore de place dans ce classement.
      if (!row || !(row.best_split_ms > 0)) return json({ found: false });
      const rank = await getRank(env.DB, race, row.best_split_ms);
      return json({ found: true, rank, name: row.name, time_ms: row.time_ms,
                    best_split_ms: row.best_split_ms });
    }

    // Fantome d'une ligne du classement, pour la defier depuis le TOP 500.
    // On passe par le rowid : le device_id de l'auteur n'est jamais expose.
    if (url.pathname === '/ghost' && request.method === 'GET') {
      const id = Math.round(Number(url.searchParams.get('id')));
      if (!Number.isFinite(id) || id <= 0) return json({ error: 'id invalide' }, 400);
      await ensureScoreGhost(env.DB);
      const row = await env.DB.prepare(
        `SELECT race_key, name, time_ms, best_split_ms, trace FROM scores WHERE rowid = ?`
      ).bind(id).first();
      if (!row || !row.trace) return json({ found: false });
      return json({
        found: true,
        race: row.race_key,
        name: row.name,
        split_ms: row.best_split_ms,
        total_ms: row.time_ms,
        trace: JSON.parse(row.trace),
      });
    }

    // ------------------------------------------------------- championnats
    if (url.pathname.startsWith('/champ/')) {
      if (!championnatsOuverts(canal)) {
        return json({ error: 'championnats reserves au canal de test' }, 403);
      }
      const sous = url.pathname.slice('/champ/'.length);

      // Ou en est le monde : quels pays peuvent tenir leur championnat.
      if (sous === 'pays' && request.method === 'GET') {
        return json({ pays: await paysEligibles(env.DB) });
      }

      // Le joueur corrige son pays.
      if (sous === 'pays' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { device_id, name, pays } = body || {};
        if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
        const key = cleanName(name).trim().toLowerCase();
        if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);
        if (!(await peutUtiliser(env.DB, key, device_id))) {
          return json({ error: 'ce nom ne t appartient pas' }, 403);
        }
        const r = await choisirPays(env.DB, key, pays);
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'titres' && request.method === 'GET') {
        const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
        return json({ titres: key ? await titresDe(env.DB, key) : [] });
      }

      // Ouvrir une edition. Reserve a l'exploitation : c'est un acte de
      // calendrier, pas une action de joueur. Sans `echelon`, on reste sur le
      // national, ce que faisaient les appels existants.
      if (sous === 'ouvrir' && request.method === 'POST') {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { pays, zone, echelon, debut } = body || {};
        const t = Number(debut);
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        const r = await ouvrirEchelon(env.DB, {
          echelon: echelon || 'national',
          zone: zone || pays || 'MONDE',
          debutSamedi: t,
        });
        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      // Le meme weekend pour tout le monde : un seul appel ouvre tout un
      // echelon d'un coup, et dit qui a ete ecarte et pourquoi.
      if (sous === 'cycle' && request.method === 'POST') {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const t = Number(body && body.debut);
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        return json(await ouvrirCycle(env.DB, {
          debutSamedi: t, echelon: (body && body.echelon) || 'national',
        }));
      }

      // Les trois weekends d'un cycle, deduits du premier.
      if (sous === 'calendrier' && request.method === 'GET') {
        const t = Number(url.searchParams.get('debut'));
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        return json({ cycle: calendrierCycle(t) });
      }

      // La diffusion en direct. `depuis` est le dernier identifiant deja vu :
      // un ecran ouvert tout le weekend redemande la suite, jamais le passe.
      if (sous === 'direct' && request.method === 'GET') {
        const depuis = parseInt(url.searchParams.get('depuis') || '0', 10) || 0;
        const limite = Math.min(200, parseInt(url.searchParams.get('limite') || '50', 10) || 50);
        return json(await fluxDirect(env.DB, {
          zone: url.searchParams.get('zone'), depuis, limite,
        }));
      }

      // Le recapitulatif mondial : qui court, qui vient d'etre sacre.
      if (sous === 'monde' && request.method === 'GET') {
        return json(await recapMondial(env.DB, {
          echelon: url.searchParams.get('echelon') || null,
        }));
      }

      // Mon championnat, s'il y en a un. Le jeu n'a que le nom du joueur.
      if (sous === 'mien' && request.method === 'GET') {
        const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
        const id = key ? await editionDe(env.DB, key) : null;
        return json({ edition: id });
      }

      // L'etat d'une edition : ou elle en est, qui court quoi.
      if (sous.startsWith('edition/') && request.method === 'GET') {
        const id = sous.slice('edition/'.length).toUpperCase();
        const e = await etatEdition(env.DB, id);
        if (!e) return json({ error: 'edition introuvable' }, 404);
        // Le drapeau de chacun : un championnat continental ou mondial n'a
        // aucun sens si l'on ne voit pas d'ou viennent les coureurs.
        const pays = await paysDe(env.DB, e.partants.map(p => p.name_key));
        for (const p of e.partants) p.pays = pays.get(p.name_key) || null;
        return json(e);
      }

      // Les chronos d'une course. On range, on ne tranche pas encore.
      if (sous === 'course' && request.method === 'POST') {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { edition, phase, course, chronos } = body || {};
        const r = await enregistrerCourse(env.DB, {
          edition: String(edition || '').toUpperCase(), phase,
          course: parseInt(course, 10), chronos,
        });
        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      // La cloture d'une phase : c'est elle qui qualifie et qui seme la suite.
      if (sous === 'cloturer' && request.method === 'POST') {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const edition = String(body.edition || '').toUpperCase();
        const r = await cloturerPhase(env.DB, edition);

        // Une finale sacre. C'est le moment le plus fort du bareme apres la
        // tete d'un classement : une date, un nom, un titre.
        //
        // A ce jour l'appel ne produit rien, et c'est normal : les
        // championnats sont reserves au canal de test (`championnatsOuverts`
        // juste au-dessus), et `noter()` refuse le canal de test. Le crochet
        // est pose pour le jour ou ils s'ouvriront — le brancher ce jour-la,
        // dans un fichier qu'on aura oublie, coute plus cher que de le poser
        // maintenant a l'endroit qui sait.
        if (r && !r.erreur && r.finale && r.podium) {
          const [or, argent] = r.podium;
          ctx.waitUntil(regarderSacre(canal, {
            id: edition,
            echelon: r.echelon || null,
            pays: r.zone || null,
            epreuve: r.epreuve || null,
            champion: or ? or.nom : null,
            chrono_ms: or ? or.ms : null,
            deuxieme: argent ? argent.nom : null,
            deuxieme_ms: argent ? argent.ms : null,
            partants: Array.isArray(r.classement) ? r.classement.length : null,
          }));
        }

        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      return json({ error: 'not found' }, 404);
    }

    // ------------------------------------------------------------- relais
    // Les equipes de relais. La porte vit ici AUSSI, pas seulement dans le
    // jeu : tant qu'elle etait fermee, une simple requete a la main aurait
    // permis de reserver des noms d'equipe avant l'ouverture — et un nom
    // appartient a une composition pour toujours. Elle est ouverte.
    if (url.pathname.startsWith('/relay/')) {
      if (!relaisOuvert(canal)) {
        return json({ error: 'relais reserve au canal de test' }, 403);
      }
      const sous = url.pathname.slice('/relay/'.length);

      if (sous === 'team' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { name, creator, members } = body || {};
        const r = await creerEquipe(env.DB, {
          createur: creator,
          coequipiers: Array.isArray(members) ? members.slice(0, 8) : [],
          nom: name,
        });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'answer' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, name, accept } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await repondre(env.DB, { id: code, joueur: name, accepte: !!accept });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'order' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, order } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await ordonner(env.DB, { id: code, ordre: order });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'score' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, race_key, legs, traces } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await enregistrerRelais(env.DB, { team_id: code, race_key, legs, traces });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'mine' && request.method === 'GET') {
        return json(await mesEquipes(env.DB, url.searchParams.get('name') || ''));
      }

      // Les courses affrontables en fantome : le haut du classement, et lui
      // seul. Une equipe hors du top garde son chrono mais n'est plus rejouee.
      if (sous === 'ghosts' && request.method === 'GET') {
        const race = url.searchParams.get('race') || '4x100';
        return json({ race, fantomes: await fantomesRelais(env.DB, race) });
      }

      if (sous.startsWith('ghost/') && request.method === 'GET') {
        const n = parseInt(sous.slice('ghost/'.length), 10);
        if (!Number.isInteger(n) || n <= 0) return json({ error: 'identifiant invalide' }, 400);
        const f = await fantomeRelais(env.DB, n);
        return f ? json({ fantome: f }) : json({ error: 'fantome introuvable' }, 404);
      }

      // La salle d'une equipe : quatre joueurs, une piste, un temoin. Comme
      // pour les duels, le Worker n'aiguille que — la course vit dans l'objet.
      if (sous.startsWith('room/')) {
        const reste = sous.slice('room/'.length);
        const [brut, tail] = reste.split('/');
        const code = (brut || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        if (!env.SALLES_RELAIS) return json({ error: 'relais indisponible' }, 503);
        const cible = new URL(request.url);
        cible.pathname = tail === 'etat' ? '/etat' : '/ws';
        cible.searchParams.set('team', code);
        if (canal.test) cible.searchParams.set('canal', 'test');
        const id = env.SALLES_RELAIS.idFromName((canal.test ? 'RT-' : 'R-') + code);
        const rep = await env.SALLES_RELAIS.get(id).fetch(new Request(cible, request));
        if (rep.status === 101) return rep;
        return cors(new Response(rep.body, { status: rep.status,
          headers: { 'Content-Type': 'application/json' } }));
      }

      // Ouvrir une confrontation : un code, comme une piste de duel.
      if (sous === 'confrontation' && request.method === 'POST') {
        return json({ id: makeCode() });
      }

      // La salle d'une confrontation. Le code de l'equipe voyage avec le
      // joueur : c'est lui qui dit dans quel couloir il court.
      if (sous.startsWith('conf/')) {
        const reste = sous.slice('conf/'.length);
        const [brut, tail] = reste.split('/');
        const code = (brut || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        if (!env.CONFRONTATIONS) return json({ error: 'confrontations indisponibles' }, 503);
        const cible = new URL(request.url);
        cible.pathname = tail === 'etat' ? '/etat' : '/ws';
        cible.searchParams.set('conf', code);
        if (canal.test) cible.searchParams.set('canal', 'test');
        const id = env.CONFRONTATIONS.idFromName((canal.test ? 'CT-' : 'C-') + code);
        const rep = await env.CONFRONTATIONS.get(id).fetch(new Request(cible, request));
        if (rep.status === 101) return rep;
        return cors(new Response(rep.body, { status: rep.status,
          headers: { 'Content-Type': 'application/json' } }));
      }

      if (sous === 'ranking' && request.method === 'GET') {
        const race = url.searchParams.get('race') || '4x100';
        return json({ race, classement: await classementRelais(env.DB, race) });
      }

      if (sous.startsWith('team/') && request.method === 'GET') {
        const code = sous.slice('team/'.length).toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        await ensureRelayTables(env.DB);
        const e = await equipeRelais(env.DB, code);
        return e ? json({ equipe: e }) : json({ error: 'equipe introuvable' }, 404);
      }

      return json({ error: 'not found' }, 404);
    }

    // ------------------------------------------------------- la boite
    // La liaison permanente d'un joueur. Elle ne transporte que des coups de
    // sonnette ; le jeu va chercher le courrier par les routes ordinaires —
    // voir boite.js, qui explique pourquoi c'est fait ainsi.
    if (url.pathname.startsWith('/boite/')) {
      const appareil = url.pathname.slice('/boite/'.length);
      if (!isValidDeviceId(appareil)) return json({ error: 'appareil invalide' }, 400);
      if (!env.BOITES) return json({ error: 'boite indisponible' }, 503);
      // Comme pour les salles, la boite d'un joueur de test et celle d'un
      // joueur de production ne sont pas le meme objet.
      const id = env.BOITES.idFromName(canal.test ? 'T-' + appareil : appareil);
      const reponse = await env.BOITES.get(id).fetch(new Request(url, request));
      if (reponse.status === 101) return reponse;
      return cors(new Response(reponse.body, {
        status: reponse.status,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // ------------------------------------------------ course en direct
    // Le Worker ne fait qu'aiguiller : toute la vie de la salle se passe dans
    // le Durable Object, seul endroit ou les deux joueurs se rejoignent
    // vraiment. On adresse l'objet par le code, en majuscules, pour que
    // « ab12cd » et « AB12CD » tombent au meme endroit.
    // Ouvrir une salle : on tire un code libre a l'oral, comme pour un defi.
    if (url.pathname === '/live/nouveau' && request.method === 'POST') {
      return json({ id: makeCode() });
    }

    if (url.pathname.startsWith('/live/')) {
      const reste = url.pathname.slice('/live/'.length);
      const [brut, sous] = reste.split('/');
      const code = (brut || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      if (!env.SALLES) return json({ error: 'direct indisponible' }, 503);

      const cible = new URL(request.url);
      cible.pathname = sous === 'etat' ? '/etat' : '/ws';
      cible.searchParams.set('code', code);
      // Le canal voyage jusqu'a la salle : c'est elle qui ecrit le resultat du
      // duel, et elle doit l'ecrire dans la bonne base.
      if (canal.test) cible.searchParams.set('canal', 'test');

      // Deux salles portant le meme code, une de test et une de production, ne
      // doivent jamais etre le meme objet — sans quoi deux joueurs qui ne se
      // sont rien demande se retrouveraient sur la meme piste.
      const id = env.SALLES.idFromName(canal.test ? 'T-' + code : code);
      const reponse = await env.SALLES.get(id).fetch(new Request(cible, request));
      // Une reponse 101 porte une WebSocket : on la rend telle quelle, sans
      // toucher aux en-tetes, sinon la poignee de main echoue.
      if (reponse.status === 101) return reponse;
      return cors(new Response(reponse.body, {
        status: reponse.status,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // -------------------------------------------------- classement des duels
    // Refaire tout le classement depuis l'historique des duels.
    //
    // Rejouable sans risque : chacun repart de son point de depart avant que
    // les rencontres soient rejouees dans l'ordre. C'est ce qui permet de
    // toucher au bareme, au facteur K ou aux seuils de division sans avoir a
    // se demander ce que devient l'existant — on le refait.
    //
    // Sous cle d'administration, et jamais autrement : la route reecrit le
    // classement de tout le monde.
    if (url.pathname === '/duels/recalculer' && request.method === 'POST') {
      if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
      return json(await recalculerClassement(env.DB));
    }

    if (url.pathname === '/duels' && request.method === 'GET') {
      await ensureDuelTables(env.DB);
      const nom = (url.searchParams.get('name') || '').trim().toLowerCase();
      const board = await duelBoard(env.DB);

      // Le drapeau et la medaille se posent ici, pas dans duelBoard : le
      // classement des duels ne doit rien savoir des championnats, sans quoi
      // deux systemes qui n'ont aucune raison de se connaitre finiraient
      // enchevetres.
      //
      // Une seule medaille par joueur, la plus prestigieuse — un bronze
      // mondial passe devant un or national. Afficher les trois transformerait
      // le classement en tableau de decorations.
      const cles = board.map(r => r.name.trim().toLowerCase());
      const [pays, medailles] = await Promise.all([
        paysDe(env.DB, cles), medaillesDe(env.DB, cles),
      ]);
      for (const r of board) {
        const k = r.name.trim().toLowerCase();
        r.pays = pays.get(k) || null;
        const m = medailles.get(k);
        if (m) r.medaille = m;
      }

      const moi = nom ? board.find(r => r.name.trim().toLowerCase() === nom) || null : null;
      return json({
        // L'echelle voyage avec le classement : le jeu doit pouvoir dessiner
        // une progression — « il te reste tant avant la division suivante » —
        // sans avoir a recopier des seuils qui changeront.
        echelle: {
          etages: ETAGES, divisions: DIVISIONS,
          legende: LEGENDE, lp_par_palier: LP_PAR_PALIER,
        },
        bareme: { lanceur: LP.lanceur, releveur: LP.releveur },
        classement: board, moi,
      });
    }

    // Le mot du vainqueur, depose apres coup.
    //
    // C'est la seule ecriture du jeu ou un joueur produit du texte qu'un autre
    // lira. Les regles qui l'encadrent vivent dans mot.js et pas ici : elles
    // sont ce qui separe un chambrage entre amis d'une boite a insultes, et
    // elles doivent pouvoir etre relues d'un bloc.
    if (url.pathname === '/duel/mot' && request.method === 'POST') {
      if (!motOuvert(canal)) return json({ error: 'reserve au canal de test' }, 403);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { id, name, texte, voix, voix_type } = body || {};
      const code = String(id || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      const cle = String(name || '').trim().toLowerCase();
      if (!cle) return json({ error: 'nom requis' }, 400);
      await ensureDuelTables(env.DB);
      const r = await poserMot(env.DB, {
        id: code, cle, texte, voix, voixType: voix_type,
      });

      // La sonnette chez le perdant : c'est lui qui recoit le mot, et lui seul.
      //
      // Son appareil n'est pas dans la rencontre — elle ne garde que des noms.
      // On le retrouve du cote ou il se trouve : celui qui a lance le defi est
      // inscrit sur le defi, celui qui l'a releve sur sa tentative.
      if (!r.erreur) ctx.waitUntil((async () => {
        try {
          const d = await env.DB.prepare(
            `SELECT r.outcome, c.owner_device FROM duel_results r
               JOIN challenges c ON c.id = r.challenge_id
              WHERE r.challenge_id = ?`).bind(code).first();
          if (!d || d.outcome === 'draw') return;
          if (d.outcome === 'opponent') {
            // Le releveur l'emporte : le perdant est celui qui a lance.
            await sonner(env, d.owner_device, 'mot', canal.test);
            return;
          }
          const rep = await env.DB.prepare(
            `SELECT device_id FROM challenge_attempts
              WHERE id = ? ORDER BY total_ms ASC LIMIT 1`).bind(code).first();
          if (rep) await sonner(env, rep.device_id, 'mot', canal.test);
        } catch (e) { /* le sondage reste derriere */ }
      })());
      return r.erreur ? json({ error: r.erreur, ...r }, r.deja ? 409 : 403) : json(r);
    }

    // Qui a perdu une rencontre, exprime dans les memes mots que le role.
    // Le mot du vainqueur ne part qu'a lui : c'est la seule verification qui
    // empeche un vainqueur de relire ce qu'il a ecrit, et surtout un tiers de
    // le lire par une requete bien tournee.
    const perdant = r => r.outcome === 'opponent' ? 'challenger'
                       : r.outcome === 'challenger' ? 'opponent' : null;

    // Resultats des defis que J'AI lances. Celui qui releve voit son duel se
    // trancher a l'arrivee ; celui qui a lance, lui, avait deja range son
    // telephone. Sans ce guichet il ne saurait jamais qu'on lui a repondu :
    // il verrait seulement sa ligne bouger au classement, sans savoir qui ni
    // de combien.
    //
    // On filtre sur l'appareil ET sur le nom : l'appareil suffit dans le cas
    // courant, le nom permet de retrouver ses resultats sur un second
    // telephone quand on a reserve son identite.
    if (url.pathname === '/duel/results' && request.method === 'GET') {
      const device_id = url.searchParams.get('device_id') || '';
      const nom = (url.searchParams.get('name') || '').trim().toLowerCase();
      if (!isValidDeviceId(device_id) && !nom) return json({ results: [] });
      await ensureDuelTables(env.DB);
      await ensureChallengeTables(env.DB);

      // Ce que j'apprends apres coup vient desormais des DEUX cotes.
      //
      // Cote lanceur, c'est le resultat lui-meme : j'ai pose mon chrono et je
      // suis parti, on m'a repondu sans moi.
      //
      // Cote releveur, c'est le mot du vainqueur : j'ai vu mon resultat a
      // l'arrivee, mais celui qui m'a battu n'etait pas la pour me le dire —
      // il l'a fait ensuite. On ne remonte donc ces lignes-la que s'il y a
      // vraiment quelque chose a lire ; un duel deja vu, sans un mot, n'a
      // aucune raison de revenir a l'ecran.
      //
      // Et le mot revient MEME SI le resultat a deja ete vu. C'est la
      // troisieme branche, et elle repare une perte silencieuse : le duel se
      // tranche a l'arrivee de celui qui releve, le mot du vainqueur n'est
      // depose qu'ensuite — le temps qu'il apprenne sa victoire et qu'il
      // parle. Le perdant qui avait referme son annonce entre les deux voyait
      // sa ligne marquee « vue », et la voix restait en base jusqu'a ce que
      // personne ne la reclame. On lit donc `mot_vu` la ou on lisait « vu »
      // tout court : le resultat s'annonce une fois, le mot aussi, et les deux
      // n'ont pas a arriver ensemble.
      const { results } = await env.DB.prepare(
        `SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'challenger' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.seen_by_challenger = 0
            AND (c.owner_device = ? OR (? <> '' AND r.challenger_key = ?))
         UNION ALL
        SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'challenger' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.seen_by_challenger = 1
            AND r.mot_vu = 0
            AND r.outcome = 'opponent'
            AND (r.mot IS NOT NULL OR r.voix IS NOT NULL)
            AND ? = 1
            AND (c.owner_device = ? OR (? <> '' AND r.challenger_key = ?))
         UNION ALL
        SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'opponent' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.mot_vu = 0
            AND r.outcome = 'challenger'
            AND (r.mot IS NOT NULL OR r.voix IS NOT NULL)
            AND ? = 1
            AND (? <> '' AND r.opponent_key = ?)
          ORDER BY created_at ASC LIMIT 20`
      ).bind(device_id, nom, nom,
             motOuvert(canal) ? 1 : 0, device_id, nom, nom,
             motOuvert(canal) ? 1 : 0, nom, nom).all();

      return json({
        results: (results || []).map(r => ({
          id: r.challenge_id,
          // Qui je suis dans cette rencontre. Le meme ecran sert les deux
          // roles, et sans cela il ne saurait pas de quel cote lire l'issue.
          role: r.role,
          adversaire: r.role === 'challenger'
            ? (r.opponent_name || r.opponent_key)
            : (r.owner_name || ''),
          // 'challenger' : c'est celui qui a lance qui l'emporte.
          issue: r.outcome,
          lp: r.role === 'challenger' ? (r.lp_challenger ?? 0) : (r.lp_opponent ?? 0),
          mon_ms: r.role === 'challenger' ? r.challenger_ms : r.opponent_ms,
          son_ms: r.role === 'challenger' ? r.opponent_ms : r.challenger_ms,
          // Le mot ne part qu'a celui a qui il est destine : le perdant.
          mot: perdant(r) === r.role ? (r.mot || null) : null,
          voix: perdant(r) === r.role ? (r.voix || null) : null,
          voix_type: perdant(r) === r.role ? (r.voix_type || null) : null,
          races: JSON.parse(r.races || '[]'),
          at: r.created_at,
        })),
      });
    }

    // Accuser reception : un resultat ne s'annonce qu'une fois.
    if (url.pathname === '/duel/results/seen' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, ids } = body || {};
      const nom = String(name || '').trim().toLowerCase();
      if (!Array.isArray(ids) || !ids.length) return json({ ok: true, n: 0 });
      await ensureDuelTables(env.DB);
      await ensureChallengeTables(env.DB);
      const propres = ids
        .map(v => String(v || '').toUpperCase())
        .filter(v => /^[A-Z0-9]{4,10}$/.test(v))
        .slice(0, 20);
      if (!propres.length) return json({ ok: true, n: 0 });
      const trous = propres.map(() => '?').join(',');
      // La condition de propriete est reprise telle quelle : sans elle,
      // n'importe qui pourrait faire taire les resultats d'un autre.
      const r = await env.DB.prepare(
        `UPDATE duel_results SET seen_by_challenger = 1
          WHERE challenge_id IN (${trous})
            AND seen_by_challenger = 0
            AND challenge_id IN (
              SELECT c.id FROM challenges c
               WHERE c.owner_device = ? OR (? <> '' AND lower(trim(c.owner_name)) = ?))`
      ).bind(...propres, String(device_id || ''), nom, nom).run();

      // Le meme geste, cote releveur : lui aussi ferme une fenetre, et c'est
      // la sienne qui portait le mot du vainqueur.
      const r2 = nom ? await env.DB.prepare(
        `UPDATE duel_results SET seen_by_opponent = 1
          WHERE challenge_id IN (${trous})
            AND seen_by_opponent = 0 AND opponent_key = ?`
      ).bind(...propres, nom).run() : null;

      // LE MOT EST LU, et c'est autre chose qu'avoir vu le resultat.
      //
      // Deux conditions, et la seconde a manque a un premier essai :
      //
      // - on ne marque que celui a qui le mot etait destine : le perdant. Le
      //   vainqueur qui referme SA fenetre n'a rien lu, il vient d'ecrire.
      // - et seulement s'il y avait quelque chose a lire. Sans ce garde-fou,
      //   le perdant qui referme son annonce AVANT que le vainqueur ait parle
      //   marquait le mot comme lu par avance : celui-ci arrivait ensuite dans
      //   une ligne deja soldee, et ne repartait plus jamais. C'est exactement
      //   la perte qu'on cherchait a corriger, reintroduite un cran plus loin.
      await env.DB.prepare(
        `UPDATE duel_results SET mot_vu = 1
          WHERE challenge_id IN (${trous}) AND mot_vu = 0
            AND outcome = 'opponent'
            AND (mot IS NOT NULL OR voix IS NOT NULL)
            AND challenge_id IN (
              SELECT c.id FROM challenges c
               WHERE c.owner_device = ? OR (? <> '' AND lower(trim(c.owner_name)) = ?))`
      ).bind(...propres, String(device_id || ''), nom, nom).run();
      if (nom) {
        await env.DB.prepare(
          `UPDATE duel_results SET mot_vu = 1
            WHERE challenge_id IN (${trous}) AND mot_vu = 0
              AND outcome = 'challenger'
              AND (mot IS NOT NULL OR voix IS NOT NULL)
              AND opponent_key = ?`
        ).bind(...propres, nom).run();
      }

      // LA VOIX S'EFFACE ICI, et nulle part ailleurs.
      //
      // C'est la promesse faite au joueur : ce qu'il a dit disparait quand
      // l'autre a fini de l'ecouter. On l'efface donc au moment ou la fenetre
      // se ferme, pas par une tache de menage qui passerait plus tard — une
      // promesse tenue « d'ici quelques heures » n'est pas la meme promesse.
      //
      // Sur `mot_vu`, et non plus sur « quelqu'un a vu quelque chose ». La
      // condition d'avant effacait la voix des que L'UN DES DEUX refermait sa
      // fenetre — vainqueur compris. Elle detruisait donc l'enregistrement
      // dans le cas le plus ordinaire qui soit : on gagne, on parle, on
      // referme son annonce, et la voix disparait avant que l'autre l'ait
      // entendue. Le perdant ne recevait plus que le texte.
      //
      // Le texte reste : il tient en cent quarante caracteres, il ne coute
      // rien, et le perdant peut vouloir le relire. C'est la voix qui pese et
      // qu'on s'est engage a ne pas garder.
      await env.DB.prepare(
        `UPDATE duel_results SET voix = NULL, voix_type = NULL
          WHERE challenge_id IN (${trous}) AND voix IS NOT NULL AND mot_vu = 1`
      ).bind(...propres).run();

      // On renvoie ce qui a vraiment bascule, pas ce qui a ete demande : une
      // demande portant sur les defis d'autrui ne change rien, et doit le dire.
      const n = ((r && r.meta && r.meta.changes) || 0) +
                ((r2 && r2.meta && r2.meta.changes) || 0);
      return json({ ok: true, n });
    }

    // ------------------------------------------------------------- identite
    // Reserver un nom. Si personne ne l'a pris, il est a nous et on recoit un
    // code ; s'il est deja a nous, on le recupere ; sinon il faut le code.
    if (url.pathname === '/claim' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const propre = cleanName(name);
      const key = propre.trim().toLowerCase();
      if (!key || propre === 'Anonyme') return json({ error: 'nom invalide' }, 400);
      await ensurePlayerTables(env.DB);
      // Plus bas, le rattachement des appareils lit la table des scores. Sur
      // une base neuve — celle du canal de test, ou n'importe quel deploiement
      // avant le premier chrono — cette table n'existe pas encore, et toute
      // reservation de nom echouait sur un D1_ERROR muet.
      await ensureScoreGhost(env.DB);

      const existe = await env.DB.prepare(
        `SELECT name, code FROM players WHERE name_key = ?`).bind(key).first();

      // Ce n'est pas un nom, c'est un code de recuperation.
      //
      // Le geste est naturel : on a perdu son nom, on a son code sous la main,
      // et le seul champ visible est celui du nom. Le jeu le reservait alors
      // comme un pseudo, rendait un second code, et le joueur repartait avec
      // une identite qu'il n'avait pas demandee — pendant que la sienne
      // restait fermee. On l'arrete ici, et on renvoie le nom qui va avec pour
      // que l'ecran puisse proposer la liaison au lieu d'un refus sec.
      if (!existe) {
        const proprietaire = await estUnCode(env.DB, propre);
        if (proprietaire) {
          return json({ ok: false, est_un_code: true, nom: proprietaire });
        }
      }

      if (existe) {
        const lie = await env.DB.prepare(
          `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
        ).bind(key, device_id).first();
        if (lie) return json({ ok: true, name: existe.name, code: existe.code, deja: true });
        return json({ ok: false, pris: true });     // il faudra fournir le code
      }

      const code = makeCode();
      await env.DB.prepare(
        `INSERT INTO players (name_key, name, code, created_at) VALUES (?, ?, ?, ?)`
      ).bind(key, propre, code, Date.now()).run();
      // Les appareils qui jouaient deja sous ce nom sont rattaches : sans
      // cela, reserver son propre nom couperait le joueur de son historique.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at)
         SELECT DISTINCT ?, device_id, ? FROM scores WHERE lower(trim(name)) = ?`
      ).bind(key, Date.now(), key).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
      ).bind(key, device_id, Date.now()).run();
      return json({ ok: true, name: propre, code });
    }

    // ------------------------------------------- relier sans retaper le code
    //
    // Un appareil deja relie tire un jeton ; le telephone le presente. Entre
    // les deux, un QR code — parce que viser vaut mieux qu'epeler.
    if (url.pathname === '/transfert/nouveau' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const key = cleanName(name).trim().toLowerCase();
      if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);
      await ensurePlayerTables(env.DB);
      const r = await ouvrirTransfert(env.DB, key, device_id);
      if (r.erreur) return json({ error: 'cet appareil n est pas relie a ce nom' }, 403);
      return json({ ok: true, ...r });
    }

    if (url.pathname === '/transfert/utiliser' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, jeton } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      await ensurePlayerTables(env.DB);
      const r = await utiliserTransfert(env.DB, jeton, device_id);
      // Un lien mort n'est pas une erreur de serveur : le jeu a une phrase
      // pour chacun de ces trois cas, et il lui faut donc les trois.
      if (r.erreur) return json({ ok: false, [r.erreur.replace(/-/g, '_')]: true });
      return json(r);
    }

    // ------------------------------------------------ recuperer un code perdu
    //
    // Voir worker/src/identite.js pour ce qui prouve quoi : ici on ne fait que
    // deposer la demande, la relire, et — pour l'administrateur — la trancher.
    if (url.pathname === '/recuperation' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, indice } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const propre = cleanName(name);
      const key = propre.trim().toLowerCase();
      if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);
      await ensurePlayerTables(env.DB);
      const r = await demanderRecuperation(env.DB, {
        nameKey: key, nom: propre, deviceId: device_id, indice,
      });
      if (r.erreur === 'inconnu') return json({ ok: false, inconnu: true });

      /* Une demande NEUVE previent la boite du jeu.
       *
       * Ni un appareil encore relie (`direct` : il n'y avait rien a arbitrer),
       * ni un second appui sur le bouton (`deja` : meme demande, meme mot de
       * passage) — ces deux-la n'ont rien a annoncer, et un joueur qui rouvre
       * le jeu ferait sonner la boite jusqu'a ce qu'un filtre s'en charge.
       *
       * Le canal de test n'ecrit pas non plus : ce qu'on y depose est un essai,
       * pas quelqu'un qui attend son nom.
       *
       * `waitUntil` et pas `await` : le joueur n'attend pas apres un courriel,
       * et un refus de Resend n'a pas a devenir un echec de sa demande. */
      if (!canal.test && r.etat === 'attente' && !r.deja) {
        ctx.waitUntil(alerterRecuperation(env, {
          id: r.id, nom: propre, insta: r.insta, phrase: r.phrase,
          compte: r.compte, indice, cree_le: Date.now(),
        }));
      }
      return json(r);
    }

    if (url.pathname === '/recuperation' && request.method === 'GET') {
      const deviceId = url.searchParams.get('device_id');
      const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
      if (!isValidDeviceId(deviceId)) return json({ error: 'device_id invalide' }, 400);
      if (!key) return json({ etat: 'aucune' });
      await ensurePlayerTables(env.DB);
      return json(await etatRecuperation(env.DB, key, deviceId));
    }

    // La file et la decision passent par la cle d'administration, pas par celle
    // du tableau de bord : accepter une demande, c'est donner a quelqu'un les
    // clefs d'un nom. Lire des compteurs et ouvrir une identite ne sont pas la
    // meme responsabilite — meme raisonnement que pour estTableau.
    if (url.pathname === '/recuperations' && request.method === 'GET') {
      if (!estAdmin(request, env)) return json({ error: 'introuvable' }, 404);
      await ensurePlayerTables(env.DB);
      await ensureRaceTable(env.DB);
      const toutes = url.searchParams.get('toutes') === '1';
      return json({
        compte: COMPTE_JEU,
        demandes: await listerRecuperations(env.DB, { toutes }),
      });
    }

    if (url.pathname === '/recuperation/trancher' && request.method === 'POST') {
      if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const r = await trancherRecuperation(env.DB, (body || {}).id, !!(body || {}).accepte);
      return r.erreur ? json({ error: r.erreur }, 404) : json(r);
    }

    // Lier son compte Instagram a son nom de joueur.
    //
    // Ce n'est PAS une connexion : Instagram ne nous dit rien, le joueur
    // declare son pseudo. La seule chose que l'on verifie, c'est que celui qui
    // le declare a bien le droit d'ecrire sous ce nom — sinon n'importe qui
    // pourrait accrocher le compte de quelqu'un d'autre a son propre chrono.
    /**
     * Les pays qu'on peut se choisir.
     *
     * Le selecteur du jeu lisait cette liste depuis toujours ; elle n'a jamais
     * existe. Il recevait donc 404, se repliait sur une liste vide, et
     * proposait un choix entre rien — on ne pouvait pas se donner de
     * nationalite, sur aucun des deux canaux.
     *
     * Pas de porte dessus : nommer les pays n'engage rien, et la liste est la
     * meme pour tout le monde.
     */
    if (url.pathname === '/nations' && request.method === 'GET') {
      return json({ nations: listeNations() });
    }

    if (url.pathname === '/profil' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, insta, pays } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const key = cleanName(name).trim().toLowerCase();
      if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);

      // Ce que la requete vient poser. Le jeu n'envoie jamais les deux a la
      // fois : le pseudo Instagram et la nationalite se demandent sur deux
      // pas differents du meme panneau.
      //
      // Le test porte sur la PRESENCE du champ, pas sur sa valeur. Une
      // requete qui ne parle pas d'Instagram ne doit pas y toucher : celle qui
      // posait la nationalite n'en parlait pas, et effacait le pseudo du
      // joueur au passage — `nettoyerInsta(undefined)` vaut la chaine vide,
      // qui s'ecrivait par-dessus. On repondait « ok » a un joueur a qui l'on
      // venait de prendre son compte Instagram sans rien enregistrer d'autre.
      const veutInsta = body && Object.prototype.hasOwnProperty.call(body, 'insta');
      const veutPays = body && Object.prototype.hasOwnProperty.call(body, 'pays');
      if (!veutInsta && !veutPays) return json({ error: 'rien a poser' }, 400);

      const propre = veutInsta ? nettoyerInsta(insta) : null;
      if (veutInsta && propre === null) return json({ error: 'pseudo invalide' }, 400);

      await ensurePlayerTables(env.DB);
      if (!(await peutUtiliser(env.DB, key, device_id))) {
        return json({ error: 'ce nom ne t appartient pas' }, 403);
      }
      const p = await env.DB.prepare(
        `SELECT name_key FROM players WHERE name_key = ?`).bind(key).first();
      if (!p) return json({ error: 'reserve d abord ton nom' }, 409);

      if (veutInsta) {
        await env.DB.prepare(`UPDATE players SET insta = ? WHERE name_key = ?`)
          .bind(propre || null, key).run();
      }

      // La nationalite se choisit UNE FOIS. Le refus porte un message qui
      // commence par « nationalite » : le jeu tranche dessus, parce que 409
      // sert deja a dire « reserve d abord ton nom » — deux refus tres
      // differents sous le meme code.
      let paysPose = null;
      if (veutPays) {
        await ensureChampTables(env.DB);
        const deja = await env.DB.prepare(
          `SELECT pays, source FROM player_pays WHERE name_key = ?`).bind(key).first();
        if (deja && deja.source === 'choix') {
          return json({ error: 'nationalite deja choisie', pays: deja.pays }, 409);
        }
        const r = await choisirPays(env.DB, key, pays);
        if (r.erreur) return json({ error: r.erreur }, 400);
        paysPose = r.pays;
      }

      return json({
        ok: true,
        insta: veutInsta ? (propre || null) : undefined,
        pays: paysPose,
      });
    }

    if (url.pathname === '/profil' && request.method === 'GET') {
      const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
      if (!key) return json({ insta: null, pays: null, source: null });
      await ensurePlayerTables(env.DB);
      await ensureChampTables(env.DB);
      const [p, g] = await Promise.all([
        env.DB.prepare(`SELECT insta FROM players WHERE name_key = ?`).bind(key).first(),
        env.DB.prepare(`SELECT pays, source FROM player_pays WHERE name_key = ?`)
          .bind(key).first(),
      ]);
      // `source` compte autant que le pays : 'choix' veut dire que le joueur
      // l'a dit, 'vu' que Cloudflare a devine d'ou venait la requete. Les
      // confondre reviendrait a cocher une nationalite que personne n'a
      // declaree — et a ne plus jamais reposer la question.
      return json({
        insta: (p && p.insta) || null,
        pays: (g && g.pays) || null,
        source: (g && g.source) || null,
      });
    }

    // Relier cet appareil a un nom deja reserve, en prouvant qu'il est a nous.
    if (url.pathname === '/link' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, code } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const key = cleanName(name).trim().toLowerCase();
      const donne = String(code || '').trim().toUpperCase();
      if (!key || !donne) return json({ error: 'parametres invalides' }, 400);
      await ensurePlayerTables(env.DB);
      const p = await env.DB.prepare(
        `SELECT name, code FROM players WHERE name_key = ?`).bind(key).first();
      if (!p) return json({ ok: false, inconnu: true });
      if (p.code !== donne) return json({ ok: false, mauvais_code: true });
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
      ).bind(key, device_id, Date.now()).run();
      return json({ ok: true, name: p.name });
    }

    // ------------------------------------------------ historique personnel
    if (url.pathname === '/race' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, race_key, time_ms, mode, level_idx } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (!ALLOWED_RACES.has(race_key)) return json({ error: 'race invalide' }, 400);
      const t = Math.round(Number(time_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      const cleaned = cleanName(name);
      const key = cleaned.trim().toLowerCase();
      if (!await peutUtiliser(env.DB, key, device_id)) {
        return json({ error: 'nom reserve', pris: true }, 403);
      }
      const lvl = Math.max(0, Math.min(5, Math.round(Number(level_idx)) || 0));
      const md = mode === 'oneshot' ? 'oneshot' : 'campaign';
      await ensureRaceTable(env.DB);
      await env.DB.prepare(
        `INSERT INTO races (device_id, name_key, name, race_key, time_ms, mode, level_idx, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(device_id, key, cleaned, race_key, t, md, lvl, Date.now()).run();
      // On borne ce qu'un appareil peut accumuler, sinon la table enfle sans
      // limite pour un historique que personne ne fera defiler jusqu'au bout.
      await env.DB.prepare(
        `DELETE FROM races WHERE device_id = ? AND id NOT IN (
           SELECT id FROM races WHERE device_id = ? ORDER BY created_at DESC LIMIT ?)`
      ).bind(device_id, device_id, HIST_PER_DEVICE).run();
      return json({ ok: true });
    }

    // Historique : celui du nom quand il est connu — c'est ce qui suit d'un
    // appareil a l'autre — sinon celui de cet appareil seul.
    if (url.pathname === '/races' && request.method === 'GET') {
      const deviceId = url.searchParams.get('device_id');
      const race = url.searchParams.get('race');
      const nameKey = (url.searchParams.get('name') || '').trim().toLowerCase();
      if (!isValidDeviceId(deviceId)) return json({ error: 'device_id invalide' }, 400);
      if (!ALLOWED_RACES.has(race)) return json({ error: 'race invalide' }, 400);
      await ensureRaceTable(env.DB);
      const q = nameKey
        ? env.DB.prepare(
            `SELECT race_key, time_ms, mode, level_idx, created_at FROM races
              WHERE race_key = ? AND (name_key = ? OR device_id = ?)
              ORDER BY created_at DESC LIMIT 300`
          ).bind(race, nameKey, deviceId)
        : env.DB.prepare(
            `SELECT race_key, time_ms, mode, level_idx, created_at FROM races
              WHERE race_key = ? AND device_id = ?
              ORDER BY created_at DESC LIMIT 300`
          ).bind(race, deviceId);
      const { results } = await q.all();
      return json({ courses: results || [] });
    }

    // -------------------------------------------------- visites et tableau
    if (url.pathname === '/visit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      await ensureVisitTable(env.DB);
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      await env.DB.prepare(
        `INSERT INTO visits (day, device_id, hits, last_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(day, device_id) DO UPDATE SET hits = hits + 1, last_at = excluded.last_at`
      ).bind(day, device_id, now).run();
      return json({ ok: true });
    }

    // Une reprise : le joueur a rappuye sur RECOMMENCER. Meme geste que /visit,
    // meme table de forme identique.
    if (url.pathname === '/reprise' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      await ensureRepriseTable(env.DB);
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      await env.DB.prepare(
        `INSERT INTO reprises (day, device_id, hits, last_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(day, device_id) DO UPDATE SET hits = hits + 1, last_at = excluded.last_at`
      ).bind(day, device_id, now).run();
      return json({ ok: true });
    }

    // Tout ce que le tableau de bord affiche, en un seul aller-retour.
    //
    // Le contrat est double. Les trois blocs d'origine — `visites`, `scores`,
    // `defis` — gardent EXACTEMENT leur forme : un tableau plus ancien continue
    // de fonctionner. Tout le reste est ajoute a cote, et chaque ajout passe
    // par `bloc()` : sur une base ou une table manque encore (la production n'a
    // pas toutes celles du canal de test), on rend un repli plutot que de
    // faire tomber la reponse entiere.
    // --------------------------------------------------- ce qui va aux reseaux
    //
    // La file des moments que le jeu a signales, et les deux gestes qui la
    // vident : ecarter, ou marquer publie. Ce worker ne publie rien lui-meme —
    // c'est delibere et c'est explique en tete de reseaux.js. Il tient le
    // registre de ce qui est sorti, ce qui evite qu'un record ressorte le mois
    // suivant depuis une file qu'on relit.
    //
    // Sous `estAdmin` et pas `estTableau` : lire la frequentation n'engage
    // rien, decider ce qui parle au nom du jeu engage la marque entiere. Les
    // deux cles existent justement pour ne pas confondre les deux.
    if (url.pathname.startsWith('/reseaux/')) {
      if (!estAdmin(request, env)) return json({ error: 'introuvable' }, 404);
      const quoi = url.pathname.slice('/reseaux/'.length);

      // Les noms ne sortent en clair que si on les demande, et la demande est
      // dans l'URL — visible, donc, dans le journal comme dans la barre
      // d'adresse. Un masquage qu'on leve par accident n'en est pas un.
      if (quoi === 'file' && request.method === 'GET') {
        const etat = url.searchParams.get('etat') || 'propose';
        if (!['propose', 'ecarte', 'publie'].includes(etat)) {
          return json({ error: 'etat inconnu' }, 400);
        }
        return json({
          moments: await fileDAttente(env.DB, {
            etat,
            limite: url.searchParams.get('limite'),
            avecNoms: url.searchParams.get('noms') === '1',
          }),
          // Le bareme voyage avec la file : l'ecran de validation affiche le
          // pilier et le titre de chaque moment sans avoir a recopier la table
          // des poids, qui vivrait alors a deux endroits.
          bareme: MOMENTS,
        });
      }

      if (quoi === 'ecarter' && request.method === 'POST') {
        let body; try { body = await request.json(); } catch { body = {}; }
        const ok = await ecarter(env.DB, (body || {}).id);
        return ok ? json({ ok: true }) : json({ error: 'deja tranche' }, 409);
      }

      if (quoi === 'publie' && request.method === 'POST') {
        let body; try { body = await request.json(); } catch { body = {}; }
        const ok = await marquerPublie(env.DB, (body || {}).id, (body || {}).reseaux);
        return ok ? json({ ok: true }) : json({ error: 'deja tranche' }, 409);
      }

      return json({ error: 'not found' }, 404);
    }

    if (url.pathname === '/stats' && request.method === 'GET') {
      // Le tableau de bord se lit sous cle, et pas autrement.
      //
      // Il s'ouvrait par `?stats` sur la page publique, sans rien demander : le
      // premier parametre que l'on essaie sur un jeu, et le trafic du jeu
      // s'affichait. Masquer la page n'aurait rien valu — un `curl /stats`
      // rendait les memes chiffres. C'est donc la ROUTE qui ferme, et la porte
      // du navigateur n'est que la facon de presenter la cle.
      //
      // Une seule porte, et non deux etages : on a un temps garde les agregats
      // ouverts en ne fermant que le nominatif, mais deux gardes qui repondent
      // a la meme question sont un garde de trop — et le premier a se relacher
      // est toujours celui dont on avait oublie qu'il gardait quelque chose.
      //
      // 404 plutot que 403 : sans cle, cette route n'existe pas. Repondre
      // « interdit » confirmerait qu'il y a un tableau a trouver.
      if (!estTableau(request, env)) return json({ error: 'introuvable' }, 404);

      await ensureVisitTable(env.DB);
      await ensureChallengeTables(env.DB);
      await ensureScoreGhost(env.DB);
      await ensureRepriseTable(env.DB);

      const DB = env.DB;
      const bloc = async (fn, repli) => { try { return await fn(); } catch { return repli; } };

      const JOUR = 86400000;
      const now = Date.now();
      const depuis = n => now - n * JOUR;

      // --- visites (forme d'origine, intacte) ---------------------------
      const v = await DB.prepare(
        `SELECT COALESCE(SUM(hits),0) AS hits,
                COUNT(DISTINCT device_id) AS visiteurs
           FROM visits`
      ).first();
      const { results: parJour } = await DB.prepare(
        `SELECT day, COUNT(*) AS visiteurs, SUM(hits) AS hits
           FROM visits GROUP BY day ORDER BY day DESC LIMIT 30`
      ).all();
      // Mensuel : pas de plafond de 30 jours ici, et `visiteurs` est un vrai
      // distinct sur le mois (pas une somme de distincts quotidiens).
      const parMoisVisites = await bloc(async () => (await DB.prepare(
        `SELECT substr(day,1,7) AS mois,
                COUNT(DISTINCT device_id) AS visiteurs,
                COALESCE(SUM(hits),0) AS hits
           FROM visits GROUP BY mois ORDER BY mois DESC LIMIT 24`
      ).all()).results || [], []);
      const revient = await bloc(async () => (await DB.prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT device_id, COUNT(DISTINCT day) AS j FROM visits GROUP BY device_id
         ) WHERE j > 1`).first())?.n || 0, 0);

      // --- scores (forme d'origine, intacte) --------------------------
      const s = await DB.prepare(
        `SELECT COUNT(*) AS lignes,
                COUNT(DISTINCT device_id) AS appareils,
                COUNT(DISTINCT lower(trim(name))) AS joueurs
           FROM scores`
      ).first();

      // --- defis (forme d'origine + colonnes en plus) ----------------
      await bloc(() => ensureChallengeTarget(DB), null);
      const c = await DB.prepare(
        `SELECT (SELECT COUNT(*) FROM challenges) AS defis,
                (SELECT COUNT(*) FROM challenge_attempts) AS tentatives`
      ).first();
      const defisPlus = await bloc(async () => {
        const rep = await DB.prepare(
          `SELECT
             SUM(CASE WHEN target_device IS NOT NULL THEN 1 ELSE 0 END) AS adresses,
             SUM(CASE WHEN target_device IS NULL THEN 1 ELSE 0 END) AS publics,
             (SELECT COUNT(DISTINCT id) FROM challenge_attempts) AS repondus
           FROM challenges`).first();
        const { results: pj } = await DB.prepare(
          `SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n
             FROM challenges GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: tpj } = await DB.prepare(
          `SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n
             FROM challenge_attempts GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: pm } = await DB.prepare(
          `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS mois, COUNT(*) AS n
             FROM challenges GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        const { results: tpm } = await DB.prepare(
          `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS mois, COUNT(*) AS n
             FROM challenge_attempts GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        // Delai median entre la creation d'un defi et sa premiere reponse.
        const { results: delais } = await DB.prepare(
          `SELECT (a.premier - c.created_at) AS d FROM challenges c
             JOIN (SELECT id, MIN(created_at) AS premier FROM challenge_attempts GROUP BY id) a
               ON a.id = c.id
            ORDER BY d`).all();
        const med = delais.length ? delais[Math.floor(delais.length / 2)].d : null;
        return {
          adresses: rep?.adresses || 0, publics: rep?.publics || 0,
          repondus: rep?.repondus || 0,
          par_jour: pj || [], tentatives_par_jour: tpj || [],
          par_mois: pm || [], tentatives_par_mois: tpm || [],
          delai_reponse_median_ms: med,
        };
      }, { adresses: 0, publics: 0, repondus: 0, par_jour: [], tentatives_par_jour: [], par_mois: [], tentatives_par_mois: [], delai_reponse_median_ms: null });

      // --- parties jouees (table `races`) ----------------------------
      const parties = await bloc(async () => {
        const tot = await DB.prepare(
          `SELECT COUNT(*) AS n,
                  COUNT(DISTINCT name_key) AS joueurs,
                  SUM(CASE WHEN mode='campaign' THEN 1 ELSE 0 END) AS campagne,
                  SUM(CASE WHEN mode='oneshot'  THEN 1 ELSE 0 END) AS oneshot
             FROM races`).first();
        const { results: pj } = await DB.prepare(
          `SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n,
                  COUNT(DISTINCT name_key) AS joueurs,
                  SUM(CASE WHEN mode='campaign' THEN 1 ELSE 0 END) AS campagne,
                  SUM(CASE WHEN mode='oneshot'  THEN 1 ELSE 0 END) AS oneshot
             FROM races GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: pm } = await DB.prepare(
          `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS mois, COUNT(*) AS n,
                  COUNT(DISTINCT name_key) AS joueurs,
                  SUM(CASE WHEN mode='campaign' THEN 1 ELSE 0 END) AS campagne,
                  SUM(CASE WHEN mode='oneshot'  THEN 1 ELSE 0 END) AS oneshot
             FROM races GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        const { results: pe } = await DB.prepare(
          `SELECT race_key, COUNT(*) AS n FROM races GROUP BY race_key`).all();
        const { results: prog } = await DB.prepare(
          `SELECT level_idx, COUNT(*) AS n FROM races GROUP BY level_idx ORDER BY level_idx`).all();
        const actif = async ms => (await DB.prepare(
          `SELECT COUNT(DISTINCT name_key) AS n FROM races WHERE created_at >= ?`).bind(ms).first())?.n || 0;
        const { results: hj } = await DB.prepare(
          `SELECT CAST(strftime('%w', created_at/1000, 'unixepoch') AS INTEGER) AS jour,
                  CAST(strftime('%H', created_at/1000, 'unixepoch') AS INTEGER) AS heure,
                  COUNT(*) AS n
             FROM races GROUP BY jour, heure`).all();
        const { results: top } = await DB.prepare(
          `SELECT name, COUNT(*) AS n, MAX(created_at) AS dernier
             FROM races GROUP BY name_key ORDER BY n DESC LIMIT 20`).all();
        return {
          total: tot?.n || 0, joueurs: tot?.joueurs || 0,
          par_mode: { campaign: tot?.campagne || 0, oneshot: tot?.oneshot || 0 },
          par_jour: pj || [], par_mois: pm || [], par_epreuve: pe || [], progression: prog || [],
          actifs: { j1: await actif(depuis(1)), j7: await actif(depuis(7)), j30: await actif(depuis(30)) },
          heure_jour: hj || [], top_joueurs: top || [], borne: HIST_PER_DEVICE,
        };
      }, null);

      // --- reprises (table `reprises`) ------------------------------
      const reprises = await bloc(async () => {
        const t = await DB.prepare(
          `SELECT COALESCE(SUM(hits),0) AS total,
                  COUNT(DISTINCT device_id) AS appareils FROM reprises`).first();
        const { results: pj } = await DB.prepare(
          `SELECT day, SUM(hits) AS n FROM reprises GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: pm } = await DB.prepare(
          `SELECT substr(day,1,7) AS mois, SUM(hits) AS n
             FROM reprises GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        return { total: t?.total || 0, appareils: t?.appareils || 0, par_jour: pj || [], par_mois: pm || [] };
      }, { total: 0, appareils: 0, par_jour: [], par_mois: [] });

      // --- duels (tables `duel_results` / `duel_players`) ----------
      const duels = await bloc(async () => {
        const r = await DB.prepare(
          `SELECT COUNT(*) AS joues,
                  SUM(CASE WHEN outcome='challenger' THEN 1 ELSE 0 END) AS lanceur_gagne,
                  SUM(CASE WHEN outcome='opponent'   THEN 1 ELSE 0 END) AS releveur_gagne,
                  SUM(CASE WHEN outcome='draw'       THEN 1 ELSE 0 END) AS nul
             FROM duel_results`).first();
        const { results: pj } = await DB.prepare(
          `SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n
             FROM duel_results GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: pm } = await DB.prepare(
          `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS mois, COUNT(*) AS n
             FROM duel_results GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        const p = await DB.prepare(
          `SELECT COALESCE(SUM(launched),0) AS lances,
                  COALESCE(SUM(received),0) AS releves,
                  COUNT(*) AS inscrits,
                  SUM(CASE WHEN wins+losses+draws > 0 THEN 1 ELSE 0 END) AS classes
             FROM duel_players`).first();
        const { results: paliers } = await DB.prepare(
          `SELECT palier, COUNT(*) AS n FROM duel_players
             WHERE wins+losses+draws > 0 GROUP BY palier ORDER BY palier`).all();
        return {
          joues: r?.joues || 0,
          issues: { lanceur: r?.lanceur_gagne || 0, releveur: r?.releveur_gagne || 0, nul: r?.nul || 0 },
          par_jour: pj || [], par_mois: pm || [],
          lances: p?.lances || 0, releves: p?.releves || 0,
          inscrits: p?.inscrits || 0, joueurs_classes: p?.classes || 0,
          paliers: paliers || [],
        };
      }, null);

      // --- joueurs nommes (tables `players` / `player_devices`) ----
      const joueurs = await bloc(async () => {
        const p = await DB.prepare(
          `SELECT COUNT(*) AS nommes,
                  SUM(CASE WHEN insta IS NOT NULL AND insta <> '' THEN 1 ELSE 0 END) AS avec_insta
             FROM players`).first();
        const { results: pj } = await DB.prepare(
          `SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n
             FROM players GROUP BY day ORDER BY day DESC LIMIT 30`).all();
        const { results: pm } = await DB.prepare(
          `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS mois, COUNT(*) AS n
             FROM players GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
        const multi = await bloc(async () => (await DB.prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT name_key, COUNT(*) AS d FROM player_devices GROUP BY name_key
           ) WHERE d > 1`).first())?.n || 0, 0);
        return {
          nommes: p?.nommes || 0, avec_insta: p?.avec_insta || 0,
          par_jour: pj || [], par_mois: pm || [], multi_appareils: multi,
        };
      }, null);

      // --- geographie (table `player_pays`) -----------------------
      const geo = await bloc(async () => {
        const { results } = await DB.prepare(
          `SELECT pays, COUNT(*) AS n FROM player_pays
             GROUP BY pays ORDER BY n DESC LIMIT 12`).all();
        return results || [];
      }, null);

      // --- relais / championnats : compteurs, tolerants -----------
      const relais = await bloc(async () => {
        const t = await DB.prepare(
          `SELECT (SELECT COUNT(*) FROM relay_teams) AS equipes,
                  (SELECT COUNT(*) FROM relay_scores) AS courses`).first();
        return { equipes: t?.equipes || 0, courses: t?.courses || 0 };
      }, null);
      const championnats = await bloc(async () => {
        const t = await DB.prepare(
          `SELECT (SELECT COUNT(*) FROM champ_editions) AS editions,
                  (SELECT COUNT(*) FROM champ_titres)   AS titres`).first();
        return { editions: t?.editions || 0, titres: t?.titres || 0 };
      }, null);

      return json({
        // --- contrat d'origine, inchange ---
        visites: {
          total: v?.hits || 0, visiteurs: v?.visiteurs || 0, par_jour: parJour || [],
          par_mois: parMoisVisites || [], reviennent: revient,
        },
        scores: s || {},
        defis: { ...(c || {}), ...defisPlus },
        // --- ajouts ---
        parties, reprises, duels, joueurs, geo, relais, championnats,
        releve_a: now,
      });
    }

    // Le tableau de bord complet, reserve a l'administration.
    //
    // /stats reste public et sobre : c'est celui que le jeu affiche a
    // n'importe quel joueur qui tape ?stats dans l'URL. Celui-ci va bien plus
    // loin — parties jouees par epreuve, par mode, par niveau, relances,
    // fidelite des visiteurs, duels, relais, championnats — et n'a donc rien
    // a faire sans la cle d'administration, comme le reste de /test/admin/*.
    //
    // Une requete qui echoue (table pas encore migree sur une base neuve) ne
    // fait jamais tomber tout le tableau : elle rend juste sa case a zero.
    if (url.pathname === '/stats/admin' && request.method === 'GET') {
      if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
      const db = env.DB;
      await Promise.all([
        ensureVisitTable(db), ensureChallengeTables(db), ensureScoreGhost(db),
        ensureRaceTable(db), ensurePlayerTables(db), ensureDuelTables(db),
        ensureRelayTables(db), ensureChampTables(db),
      ]);

      const q1 = async (sql, ...args) => {
        try { return await db.prepare(sql).bind(...args).first(); }
        catch { return null; }
      };
      const qN = async (sql, ...args) => {
        try { const { results } = await db.prepare(sql).bind(...args).all(); return results || []; }
        catch { return []; }
      };

      const [
        visitesTotal, visitesParJour, fidelite,
        partiesTotal, partiesParJour, partiesParEpreuve, partiesParMode, partiesParNiveau, rejoueurs,
        defisTotal, defisParJour, tentatives,
        duelsTotal, duelsIssues, duelsTop,
        relaisEquipes, relaisCourses,
        champEditions, champCourses,
        joueursTotal, joueursInsta,
        scoresTotal,
      ] = await Promise.all([
        q1(`SELECT COALESCE(SUM(hits),0) AS hits, COUNT(DISTINCT device_id) AS visiteurs FROM visits`),
        qN(`SELECT day, COUNT(*) AS visiteurs, SUM(hits) AS hits FROM visits GROUP BY day ORDER BY day DESC LIMIT 30`),
        qN(`SELECT tranche, COUNT(*) AS appareils FROM (
              SELECT CASE WHEN total = 1 THEN '1'
                          WHEN total BETWEEN 2 AND 3 THEN '2-3'
                          WHEN total BETWEEN 4 AND 10 THEN '4-10'
                          ELSE '10+' END AS tranche
                FROM (SELECT device_id, SUM(hits) AS total FROM visits GROUP BY device_id)
            ) GROUP BY tranche`),
        q1(`SELECT COUNT(*) AS n, COUNT(DISTINCT device_id) AS appareils, COUNT(DISTINCT name_key) AS joueurs FROM races`),
        qN(`SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS parties FROM races GROUP BY day ORDER BY day DESC LIMIT 30`),
        qN(`SELECT race_key, COUNT(*) AS parties FROM races GROUP BY race_key`),
        qN(`SELECT mode, COUNT(*) AS parties FROM races GROUP BY mode`),
        qN(`SELECT level_idx, COUNT(*) AS parties FROM races GROUP BY level_idx ORDER BY level_idx`),
        qN(`SELECT name, COUNT(*) AS parties FROM races GROUP BY name_key ORDER BY parties DESC LIMIT 10`),
        q1(`SELECT COUNT(*) AS n FROM challenges`),
        qN(`SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS crees FROM challenges GROUP BY day ORDER BY day DESC LIMIT 30`),
        q1(`SELECT COUNT(*) AS n FROM challenge_attempts`),
        q1(`SELECT COUNT(*) AS n FROM duel_results`),
        qN(`SELECT outcome, COUNT(*) AS n FROM duel_results GROUP BY outcome`),
        qN(`SELECT name, launched, wins, losses, draws FROM duel_players ORDER BY launched DESC LIMIT 10`),
        q1(`SELECT COUNT(*) AS n FROM relay_teams`),
        q1(`SELECT COUNT(*) AS n FROM relay_scores`),
        q1(`SELECT COUNT(*) AS n FROM champ_editions`),
        q1(`SELECT COUNT(*) AS n FROM champ_resultats`),
        q1(`SELECT COUNT(*) AS n FROM players`),
        q1(`SELECT COUNT(*) AS n FROM players WHERE insta IS NOT NULL`),
        q1(`SELECT COUNT(*) AS lignes, COUNT(DISTINCT device_id) AS appareils, COUNT(DISTINCT lower(trim(name))) AS joueurs FROM scores`),
      ]);

      return json({
        genere_le: Date.now(),
        visites: {
          total: visitesTotal?.hits || 0,
          visiteurs: visitesTotal?.visiteurs || 0,
          par_jour: visitesParJour,
          fidelite,
        },
        parties: {
          total: partiesTotal?.n || 0,
          appareils: partiesTotal?.appareils || 0,
          joueurs: partiesTotal?.joueurs || 0,
          moyenne_par_appareil: partiesTotal?.appareils ? (partiesTotal.n / partiesTotal.appareils) : 0,
          par_jour: partiesParJour,
          par_epreuve: partiesParEpreuve,
          par_mode: partiesParMode,
          par_niveau: partiesParNiveau,
          top_rejoueurs: rejoueurs,
        },
        defis: {
          crees: defisTotal?.n || 0,
          tentatives: tentatives?.n || 0,
          taux_relance: defisTotal?.n ? (tentatives.n / defisTotal.n) : 0,
          par_jour: defisParJour,
        },
        duels: {
          total: duelsTotal?.n || 0,
          issues: duelsIssues,
          top_lanceurs: duelsTop,
        },
        relais: { equipes: relaisEquipes?.n || 0, courses: relaisCourses?.n || 0 },
        championnats: { editions: champEditions?.n || 0, courses: champCourses?.n || 0 },
        joueurs: { noms_reserves: joueursTotal?.n || 0, avec_insta: joueursInsta?.n || 0 },
        scores: scoresTotal || {},
      });
    }

    // ------------------------------------------------------------- defis
    // Creation : l'auteur envoie sa course (chronos + traces) et recupere un
    // code court a transmettre. L'adversaire jouera exactement les memes
    // epreuves, contre le fantome de cette course.
    if (url.pathname === '/challenge' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, races, level_idx, total_ms, splits, traces,
              target_score_id, revanche_de } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (!validRaces(races)) return json({ error: 'epreuves invalides' }, 400);
      const t = Math.round(Number(total_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      const lvl = Math.max(0, Math.min(5, Math.round(Number(level_idx)) || 0));
      const cleanedTraces = cleanTraces(traces, races.length);
      if (!cleanedTraces) return json({ error: 'traces invalides' }, 400);
      const cleanSplits = (Array.isArray(splits) ? splits : []).slice(0, races.length)
        .map(v => Math.max(0, Math.round(Number(v)) || 0));

      await ensureChallengeTables(env.DB);
      await ensureChallengeTarget(env.DB);

      // Defi adresse a quelqu'un : on le designe par la ligne de classement
      // qu'il occupe, jamais par son device_id — celui-ci ne sort pas d'ici.
      // On ne s'adresse pas non plus un defi a soi-meme.
      let target = null, targetName = '';
      const sid = Math.round(Number(target_score_id));
      if (Number.isFinite(sid) && sid > 0) {
        const row = await env.DB.prepare(
          `SELECT device_id, name FROM scores WHERE rowid = ?`
        ).bind(sid).first();
        if (row && row.device_id !== device_id) { target = row.device_id; targetName = row.name; }
      }

      /* ------------------------------------------------------- la revanche
         Un defi qui repart CHEZ CELUI QUI VIENT DE NOUS BATTRE, sans code a
         recopier. On ne passe pas par le TOP 500 comme ailleurs : la personne
         peut ne pas y figurer sur cette epreuve, et surtout on la connait
         deja — elle est l'autre partie d'une rencontre qui vient d'avoir
         lieu. On repart donc du duel lui-meme, ou les deux appareils sont
         inscrits.

         Deux conditions, et elles ne sont pas decoratives :

         1. SEUL LE PERDANT prend sa revanche. Sans cela, l'identifiant d'un
            duel — qui circule des deux cotes — suffirait a s'adresser a
            n'importe qui.
         2. IL FAUT AVOIR BATTU SON CHRONO. C'est la regle du jeu : on ne
            derange pas quelqu'un avec un temps moins bon que le sien. Le jeu
            la tient deja a l'ecran ; le serveur la tient aussi, parce qu'une
            regle qui ne vit que dans l'ecran n'est pas une regle. */
      const duelRef = String(revanche_de || '').toUpperCase();
      if (!target && /^[A-Z0-9]{4,10}$/.test(duelRef)) {
        await ensureDuelTables(env.DB);
        const d = await env.DB.prepare(
          `SELECT r.outcome, r.challenger_ms, r.opponent_ms, r.opponent_key, r.opponent_name,
                  c.owner_device, c.owner_name
             FROM duel_results r JOIN challenges c ON c.id = r.challenge_id
            WHERE r.challenge_id = ?`
        ).bind(duelRef).first();
        if (d && d.outcome !== 'draw') {
          // L'appareil de celui qui a releve : la rencontre ne garde que son
          // nom, sa tentative garde son appareil.
          const rep = await env.DB.prepare(
            `SELECT device_id, name FROM challenge_attempts
              WHERE id = ? ORDER BY total_ms ASC LIMIT 1`
          ).bind(duelRef).first();

          const moiCle = cleanName(name).trim().toLowerCase();
          const suisLanceur = d.owner_device === device_id ||
            (!!moiCle && String(d.owner_name || '').trim().toLowerCase() === moiCle);
          const suisReleveur = (!!rep && rep.device_id === device_id) ||
            (!!moiCle && String(d.opponent_key || '') === moiCle);
          const monRole = suisLanceur ? 'challenger' : suisReleveur ? 'opponent' : null;
          const perdant = d.outcome === 'opponent' ? 'challenger' : 'opponent';
          // Le chrono du vainqueur, celui qu'il fallait battre.
          const aBattre = d.outcome === 'opponent' ? d.opponent_ms : d.challenger_ms;

          if (monRole && monRole === perdant && t < aBattre) {
            const cible = suisLanceur ? (rep ? rep.device_id : null) : d.owner_device;
            const cibleNom = suisLanceur
              ? (d.opponent_name || (rep && rep.name) || '')
              : (d.owner_name || '');
            if (cible && cible !== device_id) { target = cible; targetName = cibleNom; }
          }
        }
      }

      const id = makeCode();
      await env.DB.prepare(
        `INSERT INTO challenges (id, created_at, owner_device, owner_name, races, level_idx, total_ms, splits, traces, target_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, Date.now(), device_id, cleanName(name), JSON.stringify(races),
             lvl, t, JSON.stringify(cleanSplits), JSON.stringify(cleanedTraces), target).run();
      // On enregistre le lanceur des maintenant, pour tenir son compteur de
      // defis envoyes ; il n'entrera au classement qu'une fois un duel joue.
      const lanceurKey = cleanName(name).trim().toLowerCase();
      if (lanceurKey) await compterLance(env.DB, lanceurKey, cleanName(name));
      // La sonnette chez celui qui est vise. Sans elle, il ne l'apprendrait
      // qu'au prochain sondage — vingt secondes plus tard, et seulement s'il
      // se trouve sur un ecran calme.
      if (target) ctx.waitUntil(sonnerEtPush(env, target, 'defi', canal.test));
      return json({ id, target_name: targetName });
    }

    if (url.pathname === '/challenge' && request.method === 'GET') {
      const id = (url.searchParams.get('id') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(id)) return json({ error: 'code invalide' }, 400);
      await ensureChallengeTables(env.DB);
      const row = await env.DB.prepare(
        `SELECT id, owner_name, races, level_idx, total_ms, splits, traces, created_at
           FROM challenges WHERE id = ?`
      ).bind(id).first();
      if (!row) return json({ found: false });
      return json({
        found: true,
        id: row.id,
        owner_name: row.owner_name,
        races: JSON.parse(row.races),
        level_idx: row.level_idx,
        total_ms: row.total_ms,
        splits: JSON.parse(row.splits || '[]'),
        traces: JSON.parse(row.traces || '[]'),
        created_at: row.created_at,
        attempts: await attemptsFor(env.DB, id),
      });
    }

    // Boite de reception : les defis qui me sont adresses et que je n'ai pas
    // encore releves. Sans les traces, qui pesent lourd et ne servent qu'au
    // moment ou l'on accepte.
    if (url.pathname === '/inbox' && request.method === 'GET') {
      const deviceId = url.searchParams.get('device_id');
      if (!isValidDeviceId(deviceId)) return json({ error: 'device_id invalide' }, 400);
      await ensureChallengeTables(env.DB);
      await ensureChallengeTarget(env.DB);
      const { results } = await env.DB.prepare(
        `SELECT c.id, c.owner_name, c.races, c.level_idx, c.total_ms, c.splits, c.created_at
           FROM challenges c
          WHERE c.target_device = ?
            AND NOT EXISTS (SELECT 1 FROM challenge_attempts a
                             WHERE a.id = c.id AND a.device_id = ?)
          ORDER BY c.created_at DESC LIMIT 20`
      ).bind(deviceId, deviceId).all();
      return json({
        defis: (results || []).map(r => ({
          id: r.id, owner_name: r.owner_name, races: JSON.parse(r.races),
          level_idx: r.level_idx, total_ms: r.total_ms,
          splits: JSON.parse(r.splits || '[]'), created_at: r.created_at,
        })),
      });
    }

    /* --------------------------------------------------- le fantome a battre
       Le perdant d'un duel prend sa revanche, et il la court CONTRE CELUI QUI
       L'A BATTU — sa trace, son nom, son chrono. Sans cette route il repartait
       sur une piste vide : la regle « il faut battre son chrono pour que le
       defi reparte » etait tenue par le serveur, mais rien a l'ecran ne
       montrait ce qu'il fallait battre.

       Deux verrous, les memes qu'a la creation d'une revanche : il faut etre
       partie de cette rencontre, et en etre le PERDANT. Sans le second,
       l'identifiant d'un duel — qui circule des deux cotes — suffirait a se
       faire rendre la trace de quelqu'un d'autre.

       Une rencontre d'avant cette version n'a pas de trace du repondant :
       `traces` revient vide, et le jeu court alors comme avant, avec le seul
       chrono pour cible. C'est un fantome en moins, pas une erreur. */
    if (url.pathname === '/duel/fantome' && request.method === 'GET') {
      const id = (url.searchParams.get('id') || '').toUpperCase();
      const deviceId = url.searchParams.get('device_id') || '';
      const nom = (url.searchParams.get('name') || '').trim().toLowerCase();
      if (!/^[A-Z0-9]{4,10}$/.test(id)) return json({ error: 'code invalide' }, 400);
      if (!isValidDeviceId(deviceId) && !nom) return json({ found: false });
      await ensureChallengeTables(env.DB);
      await ensureDuelTables(env.DB);

      const d = await env.DB.prepare(
        `SELECT r.outcome, r.challenger_ms, r.opponent_ms, r.opponent_key, r.opponent_name,
                c.owner_device, c.owner_name, c.races, c.level_idx, c.splits, c.traces
           FROM duel_results r JOIN challenges c ON c.id = r.challenge_id
          WHERE r.challenge_id = ?`
      ).bind(id).first();
      if (!d || d.outcome === 'draw') return json({ found: false });

      // L'appareil de celui qui a releve : la rencontre ne garde que son nom,
      // sa tentative garde son appareil et sa trace.
      const rep = await env.DB.prepare(
        `SELECT device_id, name, splits, traces FROM challenge_attempts
          WHERE id = ? ORDER BY total_ms ASC LIMIT 1`
      ).bind(id).first();

      const suisLanceur = (!!deviceId && d.owner_device === deviceId) ||
        (!!nom && String(d.owner_name || '').trim().toLowerCase() === nom);
      const suisReleveur = (!!rep && !!deviceId && rep.device_id === deviceId) ||
        (!!nom && String(d.opponent_key || '') === nom);
      const monRole = suisLanceur ? 'challenger' : suisReleveur ? 'opponent' : null;
      const perdant = d.outcome === 'opponent' ? 'challenger' : 'opponent';
      if (!monRole || monRole !== perdant) return json({ found: false });

      // Le fantome est celui du vainqueur : la course du lanceur si c'est lui
      // qui l'emporte, la tentative du repondant sinon.
      const lanceurGagne = d.outcome === 'challenger';
      const brut = lanceurGagne ? d.traces : (rep ? rep.traces : null);
      const bruts = lanceurGagne ? d.splits : (rep ? rep.splits : null);
      let epreuves = [];
      try { epreuves = JSON.parse(d.races || '[]') || []; } catch { /* illisible */ }
      let traces = [], splits = [];
      try { traces = cleanTraces(JSON.parse(brut || '[]'), epreuves.length) || []; }
      catch { traces = []; }
      try { splits = (JSON.parse(bruts || '[]') || []).map(v => Math.max(0, Math.round(Number(v)) || 0)); }
      catch { splits = []; }

      return json({
        found: true,
        id,
        name: lanceurGagne ? (d.owner_name || '')
                           : (d.opponent_name || (rep && rep.name) || ''),
        total_ms: lanceurGagne ? d.challenger_ms : d.opponent_ms,
        races: epreuves,
        level_idx: d.level_idx,
        splits,
        traces,
      });
    }

    // Tentative : on enregistre le chrono de l'adversaire et on renvoie le
    // classement du defi. On ne garde que la meilleure tentative par appareil.
    if (url.pathname === '/challenge/attempt' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { id, device_id, name, total_ms, splits, traces } = body || {};
      const code = String(id || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const t = Math.round(Number(total_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      await ensureChallengeTables(env.DB);
      await ensureDuelTables(env.DB);
      const ch = await env.DB.prepare(
        `SELECT owner_name, owner_device, total_ms, races FROM challenges WHERE id = ?`
      ).bind(code).first();
      if (!ch) return json({ found: false }, 404);

      const cleanSplits = (Array.isArray(splits) ? splits : [])
        .map(v => Math.max(0, Math.round(Number(v)) || 0));
      // La trace de cette tentative, pour que le perdant du duel ait un
      // fantome a courir dans sa revanche. Facultative : une version plus
      // ancienne du jeu ne l'envoie pas, et le duel se tranche pareil.
      let epreuvesDuDefi = [];
      try { epreuvesDuDefi = JSON.parse(ch.races || '[]') || []; } catch { /* illisible */ }
      const cleanedTraces = cleanTraces(traces, epreuvesDuDefi.length) || [];
      const prev = await env.DB.prepare(
        `SELECT total_ms FROM challenge_attempts WHERE id = ? AND device_id = ?`
      ).bind(code, device_id).first();
      if (!prev || t < prev.total_ms) {
        await env.DB.prepare(
          `INSERT INTO challenge_attempts (id, device_id, name, total_ms, splits, traces, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id, device_id) DO UPDATE SET
             name = excluded.name, total_ms = excluded.total_ms,
             splits = excluded.splits, traces = excluded.traces,
             created_at = excluded.created_at`
        ).bind(code, device_id, cleanName(name), t, JSON.stringify(cleanSplits),
               JSON.stringify(cleanedTraces), Date.now()).run();
      }
      // --- resolution du duel ------------------------------------------
      // Le premier resultat fait foi : un defi ne se rejoue pas, et une
      // seconde tentative ne redistribue donc aucun point. Le bareme vit dans
      // duels.js, partage avec la course en direct.
      const duel = await appliquerDuel(env.DB, {
        id: code,
        challengerName: ch.owner_name,
        opponentName: cleanName(name),
        challengerMs: ch.total_ms,
        opponentMs: t,
      });
      if (duel && !duel.deja) duel.role = 'opponent';   // point de vue du repondant

      // Un duel tranche aux centiemes se raconte. On ne regarde que le premier
      // resultat — `deja` marque une seconde tentative, qui ne redistribue rien
      // et ne raconte donc rien non plus.
      if (duel && !duel.deja) {
        let epreuves = null;
        try { epreuves = JSON.parse(ch.races || 'null'); } catch { /* colonne illisible */ }
        ctx.waitUntil(regarderDuel(canal,
          { nom: ch.owner_name, total_ms: ch.total_ms, epreuves },
          { nom: cleanName(name), total_ms: t, epreuves }));
      }

      // Celui qui a lance le defi n'est pas la : c'est tout l'objet de sa
      // boite. Il l'apprend maintenant plutot qu'au sondage suivant.
      if (duel && !duel.deja && ch.owner_device) {
        ctx.waitUntil(sonnerEtPush(env, ch.owner_device, 'duel', canal.test));
      }

      return json({
        id: code,
        owner_name: ch.owner_name,
        owner_total_ms: ch.total_ms,
        your_total_ms: prev && prev.total_ms < t ? prev.total_ms : t,
        attempts: await attemptsFor(env.DB, code),
        duel,
      });
    }

    // --- Push notifications : enregistrement et suppression d'abonnement ---

    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, subscription } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (!subscription || !subscription.endpoint) return json({ error: 'subscription invalide' }, 400);
      await ensurePushTable(env.DB);
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (device_id, subscription) VALUES (?, ?)
         ON CONFLICT(device_id) DO UPDATE SET subscription = excluded.subscription`
      ).bind(device_id, JSON.stringify(subscription)).run();
      return json({ ok: true });
    }

    if (url.pathname === '/push/unsubscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      await ensurePushTable(env.DB);
      await env.DB.prepare(
        'DELETE FROM push_subscriptions WHERE device_id = ?'
      ).bind(device_id).run();
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};
