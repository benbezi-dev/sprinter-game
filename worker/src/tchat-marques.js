/* ---------------------------------------------------------------------------
   LE TCHAT DU DUEL DES MARQUES (demande de l'auteur, 13/10/2026)
   ---------------------------------------------------------------------------
   Le premier tchat en TEXTE LIBRE du jeu. Le tchat rapide (tchat-rapide.js)
   avait tranche le 26/09 : pas de texte libre dans une salle de course.
   L'auteur rouvre la question pour cet evenement seulement — « c'est le bon
   moment pour tester » —, et c'est ce qui en fixe le cadre : le tchat vit
   DANS le duel des marques, s'ouvre et se ferme avec lui (marques.js,
   `fenetre`), et rien de ce qu'il ecrit ne sort de l'ecran du duel.

   TROIS GESTES :
   - LE TCHAT COMMUN : tous les inscrits des deux camps le lisent. Un message
     peut DESIGNER quelqu'un — on touche son nom, on ne tape pas « @nom » :
     le filtre refuse les @pseudos (mot.js, 'contact'), et c'est tant mieux,
     une designation doit viser un inscrit reel, pas une chaine de texte.
   - LE MESSAGE PRIVE : d'un inscrit a un autre, lu par eux deux seulement.
   - L'INVITATION : un inscrit invite un joueur du top 500 (100, 200 ou
     400 m) qui n'a pas encore choisi son camp.

   LA SONNERIE : un message prive, une designation et une invitation font
   vibrer le telephone de celui qu'ils visent (push.js). Le message commun
   sans designation ne sonne chez personne — sinon chaque phrase reveillerait
   tous les inscrits. Et la notification ne porte ni le nom ni le texte
   (push.js, en tete) : un ecran verrouille se lit par-dessus l'epaule.

   CE QUI TIENT LE TEXTE LIBRE :
   - le filtre de la chambre d'appel (`texteRecevable`, 140 caracteres) :
     pas de lien, pas de contact, pas d'insulte ;
   - un nom RESERVE pour ecrire ou lire ses messages prives : un banni l'est
     par son nom, et un nom libre peut etre porte par n'importe qui ;
   - les bannis n'ecrivent plus (moderation.js) ;
   - bloquer quelqu'un fait disparaitre ses messages, prives compris, et sa
     sonnerie ;
   - signaler copie le message dans la file de moderation (`signalements`,
     duel = 'tchat-marques:<id>') ; `trancher` le retire du tchat.

   LES CADENCES, toutes en base (un isolat ne voit pas les autres) :
   - par auteur : deux secondes entre deux messages, huit par minute, deux
     cents par jour ;
   - par destinataire : une sonnerie de tchat par minute, une d'invitation
     toutes les six heures — quel que soit le nombre de gens qui ecrivent ;
   - par inviteur : quinze invitations par jour, une seule par personne.

   LE COMPTE SPRINTERGAME (demande de l'auteur, 16/10/2026) : la voix du jeu
   dans le tchat, qui ne roule pour aucun camp. Il n'a ni camp ni inscription :
   ses messages portent le camp « sprinter », qu'aucun joueur ne peut avoir
   (marques.js n'accepte qu'adidas ou nike) — c'est ce qui les distingue, et
   le jeu les signe d'un badge que personne ne peut imiter en prenant le meme
   nom. Il ecrit dans le tchat commun seulement, sous la cle TCHAT_CLE
   (acces.js, `estTchatOfficiel`), sans cadence ni filtre : c'est l'auteur.

   APRES LE DUEL, LE TCHAT RESTE (demande de l'auteur, 16/10/2026) : il devient
   le tchat du jeu. Memes regles, memes tables, meme `evenement` — les
   messages du duel restent lisibles —, mais on n'a plus besoin d'un camp :
   tout nom reserve ecrit, et ses messages portent le camp « joueur ».
   L'appelant dit si le duel est ouvert (`duelOuvert`) ; tant qu'il l'est,
   rien ne change. Les invitations, elles, n'ont de sens que pendant le duel.

   LES J'AIME (demande de l'auteur, 17/10/2026) : on aime un message qu'on a
   pu lire — le commun, ou un prive de sa conversation —, pas le sien. Un
   j'aime par personne et par message, qu'on retire du meme geste. Il ne
   sonne chez personne : ce n'est pas une raison de reveiller un telephone.
   La lecture rend les compteurs des derniers messages (`aimes`) a chaque
   fois, puisqu'un j'aime arrive sur un message deja recu.
--------------------------------------------------------------------------- */
import { EVENEMENT, inscriptionDe, ensureMarquesTables } from './marques.js';
import { texteRecevable, TCHAT_MAX } from './mot.js';
import { estBanni, listeBloques, motifPropre, ensureModerationTables } from './moderation.js';

export const ECART_MS = 2000;
export const PAR_MINUTE = 8;
export const PAR_JOUR = 200;
/** Ce qu'une lecture rend au plus, de chaque sorte (commun, prive). */
export const LOT = 80;
/** Les compteurs de j'aime rendus a chaque lecture : ceux des derniers messages. */
export const FENETRE_AIMES = 300;
export const SONNERIE_TCHAT_MS = 60_000;
export const SONNERIE_INVIT_MS = 6 * 3600_000;
export const INVITS_PAR_JOUR = 15;
/** Le prefixe des signalements de ce tchat dans la file de moderation. */
export const PREFIXE_SIGNALEMENT = 'tchat-marques:';
/** Le camp de qui ecrit hors du duel : aucun. */
export const SANS_CAMP = 'joueur';
/** Le compte du jeu : son nom, sa cle, et le camp qui n'en est pas un. */
export const OFFICIEL = { name: 'SprinterGame', key: 'sprintergame', camp: 'sprinter' };
/**
 * Les comptes de joueurs qui peuvent aussi parler en SprinterGame, sans cle :
 * celui de l'auteur (16/10). Leur nom RESERVE sur l'appareil suffit — un nom
 * libre se porte par n'importe qui, l'appelant le verifie (`nomReserveIci`).
 * La meme liste vit cote jeu (src/game/tchat-officiel.ts) : les deux ensemble.
 */
export const AUTEURS_OFFICIELS = new Set(['\u2022benbezi\u2022']);   // « •BENBEZI• »

/**
 * Ce nom se fait-il passer pour le compte du jeu ? « Sprinter Game »,
 * « sprinter_game », « SPRINTERGAME » : tout ce qui, lettres seules, redonne
 * son nom.
 */
export function imiteOfficiel(nom) {
  return String(nom || '').toLowerCase().replace(/[^a-z0-9]/g, '') === OFFICIEL.key;
}

const pret = new WeakSet();
export async function ensureTchatTables(db) {
  if (pret.has(db)) return;
  await ensureMarquesTables(db);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_tchat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evenement TEXT NOT NULL,
      quand INTEGER NOT NULL,
      auteur_key TEXT NOT NULL,
      auteur_name TEXT NOT NULL,
      camp TEXT NOT NULL,
      pour_key TEXT,
      pour_name TEXT,
      prive INTEGER NOT NULL DEFAULT 0,
      texte TEXT NOT NULL,
      retire INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_tchat_commun
      ON marques_tchat(evenement, prive, id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_tchat_pour
      ON marques_tchat(evenement, pour_key, id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_tchat_auteur
      ON marques_tchat(evenement, auteur_key, quand)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_invitations (
      evenement TEXT NOT NULL,
      de_key TEXT NOT NULL,
      de_name TEXT NOT NULL,
      pour_key TEXT NOT NULL,
      quand INTEGER NOT NULL,
      PRIMARY KEY (evenement, de_key, pour_key)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_invitations_pour
      ON marques_invitations(evenement, pour_key)`),
    // La derniere sonnerie de chaque genre partie vers chaque joueur.
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_sonneries (
      pour_key TEXT NOT NULL,
      genre TEXT NOT NULL,
      quand INTEGER NOT NULL,
      PRIMARY KEY (pour_key, genre)
    )`),
    // Un j'aime par personne et par message.
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_tchat_aimes (
      message_id INTEGER NOT NULL,
      name_key TEXT NOT NULL,
      quand INTEGER NOT NULL,
      PRIMARY KEY (message_id, name_key)
    )`),
  ]);
  pret.add(db);
}

const cle = (s) => String(s || '').trim().toLowerCase().slice(0, 40);

/**
 * Peut-on sonner ce joueur pour ce genre ? Si oui, la sonnerie est notee
 * tout de suite : deux messages arrives ensemble n'en font partir qu'une.
 */
export async function reserverSonnerie(db, pourKey, genre, maintenant = Date.now()) {
  const delai = genre === 'marques_invit' ? SONNERIE_INVIT_MS : SONNERIE_TCHAT_MS;
  const r = await db.prepare(
    `INSERT INTO marques_sonneries (pour_key, genre, quand) VALUES (?, ?, ?)
     ON CONFLICT(pour_key, genre) DO UPDATE SET quand = excluded.quand
       WHERE marques_sonneries.quand <= ?`
  ).bind(pourKey, genre, maintenant, maintenant - delai).run();
  // D1 rend meta.changes ; node:sqlite rend changes. Zero : trop tot.
  const n = r && (r.meta ? r.meta.changes : r.changes);
  return n == null ? true : n > 0;
}

/** Les cadences de l'auteur. Rend null, ou la raison du refus. */
async function cadence(db, auteurKey, maintenant) {
  const r = await db.prepare(
    `SELECT MAX(quand) AS dernier,
            SUM(CASE WHEN quand > ? THEN 1 ELSE 0 END) AS minute,
            COUNT(*) AS jour
       FROM marques_tchat
      WHERE evenement = ? AND auteur_key = ? AND quand > ?`
  ).bind(maintenant - 60_000, EVENEMENT, auteurKey, maintenant - 86_400_000).first();
  if (!r || !r.jour) return null;
  if (r.dernier && maintenant - r.dernier < ECART_MS) return 'trop vite';
  if ((r.minute || 0) >= PAR_MINUTE) return 'trop vite';
  if (r.jour >= PAR_JOUR) return 'assez pour aujourd hui';
  return null;
}

/** Le nom affiche d'un inscrit : celui qu'il a reserve, a defaut celui de ses courses. */
async function nomDe(db, nameKey) {
  const r = await db.prepare(
    `SELECT COALESCE(
       (SELECT name FROM players WHERE name_key = ?),
       (SELECT name FROM marques_chronos WHERE evenement = ? AND name_key = ?)) AS name`
  ).bind(nameKey, EVENEMENT, nameKey).first().catch(() => null);
  return (r && r.name) || nameKey;
}

/**
 * Poster un message.
 *
 * `pour` : la cle d'un inscrit a designer (commun) ou a qui ecrire (prive).
 * Rend `{ status, corps, sonner }` ; `sonner` est la cle a faire vibrer, ou
 * null — c'est l'appelant qui connait les appareils et les transports.
 */
export async function poster(db, { auteurKey, auteurName, texte, pour = null, prive = false, duelOuvert = true, maintenant = Date.now() }) {
  await ensureTchatTables(db);
  // Le nom du jeu ne s'emprunte pas, meme reserve avant que le compte existe.
  if (imiteOfficiel(auteurName) || imiteOfficiel(auteurKey)) {
    return { status: 403, corps: { error: 'nom du jeu' }, sonner: null };
  }
  // Pendant le duel, on ecrit sous les couleurs de son camp ; apres, sans camp.
  const ins = duelOuvert ? await inscriptionDe(db, auteurKey) : { camp: SANS_CAMP };
  if (!ins) return { status: 409, corps: { error: 'aucun camp choisi' }, sonner: null };
  if (await estBanni(db, auteurKey)) return { status: 403, corps: { error: 'depot refuse' }, sonner: null };

  const pourKey = pour ? cle(pour) : null;
  if (prive && !pourKey) return { status: 400, corps: { error: 'destinataire manquant' }, sonner: null };
  if (pourKey === auteurKey) return { status: 400, corps: { error: 'destinataire invalide' }, sonner: null };

  const lu = texteRecevable(texte, TCHAT_MAX);
  if (!lu.ok) return { status: 422, corps: { error: 'texte refuse', raison: lu.raison }, sonner: null };

  const trop = await cadence(db, auteurKey, maintenant);
  if (trop) return { status: 429, corps: { error: trop }, sonner: null };

  let pourName = null;
  if (pourKey) {
    // on ne designe, on n'ecrit en prive, qu'a quelqu'un qui est dans le duel
    // — apres le duel, qu'a un nom reserve
    if (!(duelOuvert ? await inscriptionDe(db, pourKey) : await nomReserve(db, pourKey))) {
      return { status: 404, corps: { error: 'pas dans le duel' }, sonner: null };
    }
    pourName = await nomDe(db, pourKey);
  }

  const r = await db.prepare(
    `INSERT INTO marques_tchat (evenement, quand, auteur_key, auteur_name, camp, pour_key, pour_name, prive, texte)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(EVENEMENT, maintenant, auteurKey, auteurName, ins.camp, pourKey, pourName, prive ? 1 : 0, lu.texte).run();
  const id = r && r.meta ? r.meta.last_row_id : r && r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null;

  // Pas de sonnerie chez qui a bloque l'auteur — ni chez qui l'a deja recue
  // il y a moins d'une minute.
  let sonner = null;
  if (pourKey) {
    const bloques = await listeBloques(db, pourKey);
    if (!bloques.includes(auteurKey) && await reserverSonnerie(db, pourKey, 'marques_tchat', maintenant)) {
      sonner = pourKey;
    }
  }
  return {
    status: 200,
    corps: { ok: true, message: enLigne({ id, quand: maintenant, auteur_key: auteurKey, auteur_name: auteurName,
      camp: ins.camp, pour_key: pourKey, pour_name: pourName, prive: prive ? 1 : 0, texte: lu.texte }, auteurKey) },
    sonner,
  };
}

/**
 * Un message du compte SprinterGame, dans le tchat commun. L'appelant a deja
 * verifie la cle. Le texte n'est que nettoye : pas de filtre ni de limite de
 * longueur (17/10, demande de l'auteur), c'est l'auteur qui ecrit — il peut
 * donner un lien vers le site.
 */
export async function posterOfficiel(db, { texte, maintenant = Date.now() }) {
  await ensureTchatTables(db);
  const propre = typeof texte === 'string' ? texte.replace(/\s+/g, ' ').trim() : '';
  if (!propre) return { status: 422, corps: { error: 'texte refuse', raison: 'vide' } };
  const r = await db.prepare(
    `INSERT INTO marques_tchat (evenement, quand, auteur_key, auteur_name, camp, prive, texte)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).bind(EVENEMENT, maintenant, OFFICIEL.key, OFFICIEL.name, OFFICIEL.camp, propre).run();
  const id = r && r.meta ? r.meta.last_row_id : r && r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null;
  return {
    status: 200,
    corps: { ok: true, message: enLigne({ id, quand: maintenant, auteur_key: OFFICIEL.key, auteur_name: OFFICIEL.name,
      camp: OFFICIEL.camp, pour_key: null, pour_name: null, prive: 0, texte: propre }, OFFICIEL.key) },
  };
}

/** Une ligne de la base, telle que le jeu la recoit. */
function enLigne(m, moi) {
  return {
    id: m.id, quand: m.quand, de: m.auteur_name, camp: m.camp,
    pour: m.pour_name || null, prive: !!m.prive,
    texte: m.texte,
    aimes: 0, aime: false,
    officiel: m.camp === OFFICIEL.camp,
    a_moi: !!moi && m.auteur_key === moi,
    pour_moi: !!moi && m.pour_key === moi,
  };
}

/**
 * Lire le tchat : le commun, et ses messages prives (envoyes et recus), sans
 * ce qu'ecrivent les gens qu'on a bloques. `depuis` : le dernier id deja
 * recu, pour ne relire que la suite.
 */
export async function lire(db, { cleLecteur, depuis = 0 }) {
  await ensureTchatTables(db);
  const d = Number.isFinite(depuis) && depuis > 0 ? Math.floor(depuis) : 0;
  const { results: communs } = await db.prepare(
    `SELECT * FROM marques_tchat
      WHERE evenement = ? AND prive = 0 AND retire = 0 AND id > ?
      ORDER BY id DESC LIMIT ${LOT}`
  ).bind(EVENEMENT, d).all();
  let prives = [];
  if (cleLecteur) {
    const { results } = await db.prepare(
      `SELECT * FROM marques_tchat
        WHERE evenement = ? AND prive = 1 AND retire = 0 AND id > ?
          AND (auteur_key = ? OR pour_key = ?)
        ORDER BY id DESC LIMIT ${LOT}`
    ).bind(EVENEMENT, d, cleLecteur, cleLecteur).all();
    prives = results || [];
  }
  const bloques = new Set(cleLecteur ? await listeBloques(db, cleLecteur) : []);
  const messages = [...(communs || []), ...prives]
    .filter(m => !bloques.has(m.auteur_key))
    .sort((a, b) => a.id - b.id)
    .map(m => enLigne(m, cleLecteur));
  const aimes = await compteurs(db, cleLecteur);
  const parId = new Map(aimes.map(a => [a.id, a]));
  for (const m of messages) {
    const a = parId.get(m.id);
    if (a) { m.aimes = a.n; m.aime = a.moi; }
  }
  return { messages, dernier: messages.length ? messages[messages.length - 1].id : d, aimes };
}

/**
 * Les j'aime des derniers messages que ce lecteur peut lire : `{ id, n, moi }`,
 * seulement ceux qui en ont. Le jeu les pose sur les messages qu'il a deja.
 */
async function compteurs(db, cleLecteur) {
  const moi = cleLecteur || '';
  const bas = await db.prepare(
    `SELECT MIN(id) AS id FROM (SELECT id FROM marques_tchat
       WHERE evenement = ? AND retire = 0 ORDER BY id DESC LIMIT ${FENETRE_AIMES})`
  ).bind(EVENEMENT).first();
  if (!bas || bas.id == null) return [];
  const { results } = await db.prepare(
    `SELECT a.message_id AS id, COUNT(*) AS n,
            MAX(CASE WHEN a.name_key = ? THEN 1 ELSE 0 END) AS moi
       FROM marques_tchat_aimes a
       JOIN marques_tchat t ON t.id = a.message_id
      WHERE a.message_id >= ? AND t.retire = 0
        AND (t.prive = 0 OR t.auteur_key = ? OR t.pour_key = ?)
      GROUP BY a.message_id`
  ).bind(moi, bas.id, moi, moi).all();
  return (results || []).map(r => ({ id: r.id, n: r.n, moi: !!r.moi }));
}

/**
 * Aimer un message, ou ne plus l'aimer (`aime` faux). Rend le compteur a jour.
 * Comme pour signaler : on n'aime que ce qu'on a pu lire, et pas le sien.
 */
export async function aimer(db, { id, cleLecteur, aime = true, maintenant = Date.now() }) {
  await ensureTchatTables(db);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return { status: 400, corps: { error: 'message invalide' } };
  const m = await db.prepare(
    `SELECT id, auteur_key, pour_key, prive FROM marques_tchat WHERE evenement = ? AND id = ? AND retire = 0`
  ).bind(EVENEMENT, n).first();
  if (!m) return { status: 404, corps: { error: 'message introuvable' } };
  if (m.prive && m.pour_key !== cleLecteur && m.auteur_key !== cleLecteur) {
    return { status: 403, corps: { error: 'ce message ne vous etait pas adresse' } };
  }
  if (m.auteur_key === cleLecteur) return { status: 400, corps: { error: 'son propre message' } };
  if (await estBanni(db, cleLecteur)) return { status: 403, corps: { error: 'depot refuse' } };
  if (aime) {
    await db.prepare(
      `INSERT OR IGNORE INTO marques_tchat_aimes (message_id, name_key, quand) VALUES (?, ?, ?)`
    ).bind(n, cleLecteur, maintenant).run();
  } else {
    await db.prepare(`DELETE FROM marques_tchat_aimes WHERE message_id = ? AND name_key = ?`).bind(n, cleLecteur).run();
  }
  const c = await db.prepare(`SELECT COUNT(*) AS n FROM marques_tchat_aimes WHERE message_id = ?`).bind(n).first();
  return { status: 200, corps: { ok: true, id: n, aimes: (c && c.n) || 0, aime: !!aime } };
}

/** Ce nom est-il reserve (une ligne dans `players`) ? */
async function nomReserve(db, nameKey) {
  const r = await db.prepare(`SELECT 1 AS ok FROM players WHERE name_key = ?`).bind(nameKey).first().catch(() => null);
  return !!r;
}

/**
 * Ceux qu'on peut designer ou a qui l'on peut ecrire : les inscrits pendant
 * le duel ; apres, ceux qui ont ecrit dans le tchat ces trente derniers jours.
 */
export async function participants(db, { duelOuvert = true, maintenant = Date.now() } = {}) {
  await ensureTchatTables(db);
  if (!duelOuvert) {
    const { results } = await db.prepare(
      `SELECT t.auteur_key, MAX(t.id) AS dernier,
              COALESCE(p.name, t.auteur_name) AS name
         FROM marques_tchat t
         JOIN players p ON p.name_key = t.auteur_key
        WHERE t.evenement = ? AND t.quand > ? AND t.camp != ?
        GROUP BY t.auteur_key
        ORDER BY name COLLATE NOCASE
        LIMIT 500`
    ).bind(EVENEMENT, maintenant - 30 * 86_400_000, OFFICIEL.camp).all();
    return (results || []).map(r => ({ name: r.name, camp: SANS_CAMP, epreuve: null }));
  }
  const { results } = await db.prepare(
    `SELECT c.name_key, c.camp, c.epreuve,
            COALESCE(p.name, k.name, c.name_key) AS name
       FROM marques_camps c
       LEFT JOIN players p ON p.name_key = c.name_key
       LEFT JOIN marques_chronos k ON k.evenement = c.evenement AND k.name_key = c.name_key
      WHERE c.evenement = ?
      ORDER BY name COLLATE NOCASE`
  ).bind(EVENEMENT).all();
  return (results || []).map(r => ({ name: r.name, camp: r.camp, epreuve: r.epreuve }));
}

/**
 * Qui l'on peut inviter : le top 500 des trois epreuves (`top`, une liste de
 * noms deja lue par l'appelant), moins les inscrits et soi-meme. Chacun porte
 * `invite` si on l'a deja invite.
 */
export async function invitables(db, { deKey, top }) {
  await ensureTchatTables(db);
  const { results: insc } = await db.prepare(
    `SELECT name_key FROM marques_camps WHERE evenement = ?`).bind(EVENEMENT).all();
  const dedans = new Set((insc || []).map(r => r.name_key));
  const { results: miennes } = await db.prepare(
    `SELECT pour_key FROM marques_invitations WHERE evenement = ? AND de_key = ?`
  ).bind(EVENEMENT, deKey || '').all();
  const deja = new Set((miennes || []).map(r => r.pour_key));
  const vus = new Map();
  for (const n of top || []) {
    const k = cle(n);
    if (!k || k === 'anonyme' || k === deKey || dedans.has(k) || vus.has(k)) continue;
    vus.set(k, { name: String(n).trim(), invite: deja.has(k) });
  }
  return [...vus.values()];
}

/**
 * Inviter un joueur du top 500 dans le duel. Une invitation par personne et
 * par inviteur, quinze par jour. `topCles` : l'ensemble des cles du top 500,
 * lu par l'appelant. Rend `{ status, corps, sonner }` comme `poster`.
 */
export async function inviter(db, { deKey, deName, cible, topCles, maintenant = Date.now() }) {
  await ensureTchatTables(db);
  if (!(await inscriptionDe(db, deKey))) return { status: 409, corps: { error: 'aucun camp choisi' }, sonner: null };
  if (await estBanni(db, deKey)) return { status: 403, corps: { error: 'depot refuse' }, sonner: null };
  const pourKey = cle(cible);
  if (!pourKey || pourKey === deKey) return { status: 400, corps: { error: 'cible invalide' }, sonner: null };
  if (!topCles.has(pourKey)) return { status: 404, corps: { error: 'hors du top 500' }, sonner: null };
  if (await inscriptionDe(db, pourKey)) return { status: 409, corps: { error: 'deja dans le duel' }, sonner: null };

  const n = await db.prepare(
    `SELECT COUNT(*) AS n FROM marques_invitations WHERE evenement = ? AND de_key = ? AND quand > ?`
  ).bind(EVENEMENT, deKey, maintenant - 86_400_000).first();
  if (n && n.n >= INVITS_PAR_JOUR) return { status: 429, corps: { error: 'assez pour aujourd hui' }, sonner: null };

  const r = await db.prepare(
    `INSERT INTO marques_invitations (evenement, de_key, de_name, pour_key, quand)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(evenement, de_key, pour_key) DO NOTHING`
  ).bind(EVENEMENT, deKey, deName, pourKey, maintenant).run();
  const neuve = (r && (r.meta ? r.meta.changes : r.changes)) !== 0;
  if (!neuve) return { status: 200, corps: { ok: true, deja: true }, sonner: null };

  let sonner = null;
  const bloques = await listeBloques(db, pourKey);
  if (!bloques.includes(deKey) && await reserverSonnerie(db, pourKey, 'marques_invit', maintenant)) sonner = pourKey;
  return { status: 200, corps: { ok: true }, sonner };
}

/** Les invitations recues : qui veut de moi dans le duel. */
export async function mesInvitations(db, { cleLecteur }) {
  if (!cleLecteur) return [];
  await ensureTchatTables(db);
  const { results } = await db.prepare(
    `SELECT i.de_name, i.quand, c.camp
       FROM marques_invitations i
       LEFT JOIN marques_camps c ON c.evenement = i.evenement AND c.name_key = i.de_key
      WHERE i.evenement = ? AND i.pour_key = ?
      ORDER BY i.quand DESC LIMIT 20`
  ).bind(EVENEMENT, cleLecteur).all();
  const bloques = new Set(await listeBloques(db, cleLecteur));
  return (results || [])
    .filter(r => !bloques.has(cle(r.de_name)))
    .map(r => ({ de: r.de_name, camp: r.camp || null, quand: r.quand }));
}

/**
 * Signaler un message. On ne signale que ce qu'on a pu lire : le commun, ou
 * un prive qui nous etait adresse. Le texte est copie dans la file, comme pour
 * le mot du vainqueur (moderation.js).
 */
export async function signalerMessage(db, { id, cleLecteur, motif }) {
  await ensureTchatTables(db);
  await ensureModerationTables(db);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return { status: 400, corps: { error: 'message invalide' } };
  const m = await db.prepare(
    `SELECT id, auteur_key, pour_key, prive, texte FROM marques_tchat WHERE evenement = ? AND id = ?`
  ).bind(EVENEMENT, n).first();
  if (!m) return { status: 404, corps: { error: 'message introuvable' } };
  if (m.prive && m.pour_key !== cleLecteur) return { status: 403, corps: { error: 'ce message ne vous etait pas adresse' } };
  if (m.auteur_key === cleLecteur) return { status: 400, corps: { error: 'rien a signaler' } };
  await db.prepare(
    `INSERT OR IGNORE INTO signalements (duel, auteur_cle, signale_par, motif, mot, cree_le)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(PREFIXE_SIGNALEMENT + n, m.auteur_key, cleLecteur, motifPropre(motif), m.texte, Date.now()).run();
  return { status: 200, corps: { ok: true } };
}
