// Ce que le tableau de bord disait ne pas mesurer, et qu'il mesure desormais.
//
// QUATRE TROUS, UN MODULE.
//
// 1. Le vrai mode d'une partie. `races.mode` ne connait que `campaign` et
//    `oneshot` : la course en direct, le defi, le duel, la serie de
//    championnat y sont tous « oneshot ». Le jeu envoie maintenant un
//    `contexte` (voir src/game/contexte-course.ts). Un jeu plus ancien — dont
//    l'application installee tant qu'elle n'a pas ete republiee — ne l'envoie
//    pas : ses courses tombent en `inconnu`, jamais dans une case au hasard.
//
// 2. L'historique complet. `races` est purgee a 300 courses par appareil :
//    elle sert a afficher son historique, pas a compter. `courses_compte`
//    garde une ligne par (jour, heure UTC, appareil, epreuve, mode, contexte)
//    avec un nombre, et ne se purge jamais. A sa creation, elle reprend une
//    seule fois ce que `races` a garde — ce qui a deja ete purge reste perdu.
//
// 3. La retention sur le JEU, et par JOUEUR. Celle de `visits` compte comme
//    revenu un appareil qui rouvre sans courir, et comme nouveau un joueur qui
//    change de telephone. Ici : un joueur nomme se suit par son nom (il le
//    garde d'un appareil a l'autre), un anonyme par son appareil, et on ne
//    compte comme revenu que celui qui a COURU.
//
// 4. D'ou arrivent les visites. Une ligne par (jour, heure UTC, source), rien
//    d'autre : ni appareil, ni adresse. C'est ce qui permet de poser une
//    publication a cote d'un pic.
//
// L'heure est gardee en UTC, au jour pres : c'est le tableau qui la convertit,
// jour par jour, avec le decalage de CE jour-la — et non plus celui
// d'aujourd'hui applique a toute la periode.

/** Les contextes que le jeu peut envoyer. Tout le reste devient `inconnu`. */
const CONTEXTES = new Set([
  'carriere', 'solo', 'direct', 'championnat', 'defi_demie', 'echauffement',
  'defi', 'duel', 'fantome', 'objectif', 'vedette', 'legende', 'halloween',
  'edition', 'rejeu',
]);
export const contexteValide = c => (typeof c === 'string' && CONTEXTES.has(c)) ? c : 'inconnu';

// Un joueur, pour compter des joueurs : son nom quand il en a un, son
// appareil sinon. `anonyme` est la cle que /race pose quand le nom est absent
// ou refuse.
const QUI = `CASE WHEN name_key NOT IN ('', 'anonyme') THEN 'n:' || name_key ELSE 'd:' || device_id END`;

const pret = new WeakSet();
/**
 * Les deux tables, et la reprise de `races`.
 *
 * LA REPRISE EST DANS LE MEME LOT QUE LA CREATION, ET N'A LIEU QUE SUR UNE
 * TABLE VIDE. Le lot est atomique : deux requetes qui arrivent ensemble ne
 * peuvent pas reprendre deux fois. Et il doit passer AVANT l'insertion de la
 * course en cours dans `races` — sinon la reprise la compterait, puis
 * l'increment la compterait une seconde fois. D'ou l'appel en tete de /race.
 *
 * `races` doit exister : l'appelant pose `ensureRaceTable` d'abord.
 */
export async function ensureComptage(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS courses_compte (
      day TEXT NOT NULL,
      heure INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      name_key TEXT NOT NULL,
      race_key TEXT NOT NULL,
      mode TEXT NOT NULL,
      contexte TEXT NOT NULL,
      n INTEGER NOT NULL,
      PRIMARY KEY (day, heure, device_id, race_key, mode, contexte)
    )`),
    db.prepare(`INSERT INTO courses_compte
        (day, heure, device_id, name_key, race_key, mode, contexte, n)
      SELECT date(created_at/1000, 'unixepoch'),
             CAST(strftime('%H', created_at/1000, 'unixepoch') AS INTEGER),
             device_id, MAX(name_key), race_key, mode, 'inconnu', COUNT(*)
        FROM races
       WHERE NOT EXISTS (SELECT 1 FROM courses_compte)
       GROUP BY 1, 2, device_id, race_key, mode`),
    db.prepare(`CREATE TABLE IF NOT EXISTS arrivees (
      day TEXT NOT NULL,
      heure INTEGER NOT NULL,
      source TEXT NOT NULL,
      n INTEGER NOT NULL,
      PRIMARY KEY (day, heure, source)
    )`),
  ]);
  pret.add(db);
}

const jourEtHeure = at => {
  const d = new Date(at);
  return [d.toISOString().slice(0, 10), d.getUTCHours()];
};

/** Une course de plus au compte. A appeler apres `ensureComptage`. */
export async function compterCourse(db, { deviceId, nameKey, raceKey, mode, contexte, at }) {
  const [day, heure] = jourEtHeure(at);
  await db.prepare(
    `INSERT INTO courses_compte (day, heure, device_id, name_key, race_key, mode, contexte, n)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(day, heure, device_id, race_key, mode, contexte)
     DO UPDATE SET n = n + 1, name_key = excluded.name_key`
  ).bind(day, heure, deviceId, nameKey, raceKey, mode, contexteValide(contexte)).run();
}

/**
 * La source d'une visite, en un mot.
 *
 * `appli` absent veut dire « jeu d'avant ce comptage » : le jeu a jour envoie
 * toujours vrai ou faux. On le range en `inconnu` plutot qu'en `direct`, qui
 * gonflerait le direct de tout ce qui n'a pas encore ete mis a jour.
 */
export function sourceDeLaVisite({ src, ref, appli } = {}) {
  if (appli === true) return 'appli';
  if (appli !== false) return 'inconnu';
  const s = typeof src === 'string' ? src.trim().toLowerCase() : '';
  if (/^[a-z0-9_-]{1,24}$/.test(s)) return 'lien:' + s;
  const r = typeof ref === 'string' ? ref.trim().toLowerCase() : '';
  if (!r) return 'direct';
  const est = re => re.test(r);
  if (est(/(^|\.)instagram\.com$/)) return 'instagram';
  if (est(/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/)) return 'facebook';
  if (est(/(^|\.)tiktok\.com$/)) return 'tiktok';
  if (est(/(^|\.)(t\.co|twitter\.com|x\.com)$/)) return 'x';
  if (est(/(^|\.)(whatsapp\.com|wa\.me)$/)) return 'whatsapp';
  if (est(/(^|\.)snapchat\.com$/)) return 'snapchat';
  if (est(/(^|\.)(youtube\.com|youtu\.be)$/)) return 'youtube';
  if (est(/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|qwant\.com|ecosia\.org|search\.yahoo\.com)$/)) return 'recherche';
  if (est(/(^|\.)sprinter-game\.com$/)) return 'direct';
  return 'autre site';
}

export async function compterArrivee(db, source, at) {
  const [day, heure] = jourEtHeure(at);
  await db.prepare(
    `INSERT INTO arrivees (day, heure, source, n) VALUES (?, ?, ?, 1)
     ON CONFLICT(day, heure, source) DO UPDATE SET n = n + 1`
  ).bind(day, heure, source).run();
}

/* ------------------------------------------------------------- lectures */
//
// Aucune ne cree ni n'ecrit : /stats est une lecture. Si une table manque
// encore (aucune course depuis le deploiement), la requete echoue et le bloc
// de /stats rend null — le tableau dit alors « pas encore ».

const JOUR = 86400000;
const heureIso = ms => new Date(ms).toISOString().slice(0, 13);   // 2026-10-07T14

/** Le compte complet : totaux, vrai mode, mois, actifs, heures, retention. */
export async function lireComptage(db, now) {
  const tot = await db.prepare(
    `SELECT MIN(day) AS depuis, COALESCE(SUM(n), 0) AS total,
            COUNT(DISTINCT ${QUI}) AS joueurs
       FROM courses_compte`).first();
  // Le premier jour ou un contexte est arrive : avant, tout est `inconnu`.
  const ctx = await db.prepare(
    `SELECT MIN(day) AS d FROM courses_compte WHERE contexte <> 'inconnu'`).first();
  const debut30 = new Date(now - 30 * JOUR).toISOString().slice(0, 10);
  const { results: parContexte } = await db.prepare(
    `SELECT contexte, SUM(n) AS n, COUNT(DISTINCT ${QUI}) AS joueurs
       FROM courses_compte WHERE day >= ? GROUP BY contexte ORDER BY n DESC`).bind(debut30).all();
  const { results: parJourContexte } = await db.prepare(
    `SELECT day, contexte, SUM(n) AS n FROM courses_compte
      WHERE day >= ? GROUP BY day, contexte`).bind(debut30).all();
  const { results: parJour } = await db.prepare(
    `SELECT day, SUM(n) AS n, COUNT(DISTINCT ${QUI}) AS joueurs FROM courses_compte
      WHERE day >= ? GROUP BY day ORDER BY day DESC`).bind(debut30).all();
  const { results: parMois } = await db.prepare(
    `SELECT substr(day, 1, 7) AS mois, SUM(n) AS n, COUNT(DISTINCT ${QUI}) AS joueurs
       FROM courses_compte GROUP BY mois ORDER BY mois DESC LIMIT 24`).all();
  // Actifs a l'heure pres : « depuis 24 h », pas « depuis hier minuit ».
  const actif = async n => (await db.prepare(
    `SELECT COUNT(DISTINCT ${QUI}) AS n FROM courses_compte
      WHERE day || 'T' || printf('%02d', heure) >= ?`).bind(heureIso(now - n * JOUR)).first())?.n || 0;
  // Les heures, jour par jour, sur 13 semaines : le tableau les convertit en
  // heure locale avec le decalage du jour concerne.
  const debut91 = new Date(now - 91 * JOUR).toISOString().slice(0, 10);
  const { results: heures } = await db.prepare(
    `SELECT day, heure, SUM(n) AS n FROM courses_compte
      WHERE day >= ? GROUP BY day, heure`).bind(debut91).all();

  // La retention sur le jeu. Meme definition que celle de `visits` — la part
  // d'une cohorte revenue EXACTEMENT N jours apres son premier jour, cohortes
  // trop jeunes exclues — pour que les deux se lisent cote a cote.
  //
  // Une jointure et non un EXISTS correle : `j` est une table derivee, sans
  // index a elle ; l'EXISTS la relisait en entier pour chaque joueur. La
  // jointure laisse SQLite poser son index automatique. `j` etant DISTINCT
  // sur (qui, day), un joueur trouve au plus une ligne : COUNT(r.qui) compte
  // les revenus.
  const jalon = async n => {
    const ecart = `+${n} day`;
    const r = await db.prepare(
      `WITH j AS (SELECT DISTINCT ${QUI} AS qui, day FROM courses_compte),
            premiere AS (SELECT qui, MIN(day) AS jour FROM j GROUP BY qui)
       SELECT COUNT(*) AS base, COUNT(r.qui) AS revenus
         FROM premiere p
         LEFT JOIN j r ON r.qui = p.qui AND r.day = date(p.jour, ?)
        WHERE date(p.jour, ?) < date(?)`
    ).bind(ecart, ecart, new Date(now).toISOString().slice(0, 10)).first();
    const base = r?.base || 0;
    return { base, revenus: r?.revenus || 0, taux: base ? (r.revenus / base) : null };
  };

  return {
    depuis: tot?.depuis || null,
    contexte_depuis: ctx?.d || null,
    total: tot?.total || 0,
    joueurs: tot?.joueurs || 0,
    par_contexte: parContexte || [],
    par_jour_contexte: parJourContexte || [],
    par_jour: parJour || [],
    par_mois: parMois || [],
    actifs: { j1: await actif(1), j7: await actif(7), j30: await actif(30) },
    heures: heures || [],
    retention_jeu: { j1: await jalon(1), j7: await jalon(7), j30: await jalon(30) },
  };
}

/**
 * Les sessions : combien de courses on enchaine, et qui revient pour une
 * deuxieme, une troisieme.
 *
 * Une session est une suite de courses TERMINEES separees de moins de trente
 * minutes. On la lit dans `races`, la seule table qui ait l'heure exacte de
 * chaque course ; sur trente jours, la purge a 300 ne mord que sur les
 * joueurs qui en courent plus de dix par jour, et seulement au debut de la
 * fenetre.
 *
 * Le parcours session par session ne suit que les appareils NEUFS — vus pour
 * la premiere fois dans `visits` pendant la fenetre — : pour un ancien
 * joueur, « sa premiere session des trente derniers jours » ne veut rien dire.
 */
export const PAUSE_SESSION_MIN = 30;
export async function lireSessions(db, now) {
  const depuis = now - 30 * JOUR;
  const debut = new Date(depuis).toISOString().slice(0, 10);
  const SESSIONS = `
    WITH r AS (
      SELECT device_id, created_at,
             CASE WHEN created_at - LAG(created_at) OVER (PARTITION BY device_id ORDER BY created_at) <= ?
                  THEN 0 ELSE 1 END AS neuve
        FROM races WHERE created_at >= ?
    ),
    s AS (
      SELECT device_id,
             SUM(neuve) OVER (PARTITION BY device_id ORDER BY created_at
                              ROWS UNBOUNDED PRECEDING) AS rang
        FROM r
    ),
    t AS (SELECT device_id, rang, COUNT(*) AS n FROM s GROUP BY device_id, rang)`;
  const pause = PAUSE_SESSION_MIN * 60000;
  const { results: parLongueur } = await db.prepare(
    `${SESSIONS} SELECT n, COUNT(*) AS sessions FROM t GROUP BY n ORDER BY n`
  ).bind(pause, depuis).all();
  const { results: parRang } = await db.prepare(
    `${SESSIONS}
     SELECT rang, COUNT(*) AS appareils, SUM(n) AS courses FROM t
      WHERE device_id IN (SELECT device_id FROM visits GROUP BY device_id HAVING MIN(day) >= ?)
      GROUP BY rang ORDER BY rang LIMIT 10`
  ).bind(pause, depuis, debut).all();
  // Les neufs qui n'ont termine aucune course : la marche d'avant la session 1.
  const neufs = await db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT device_id FROM visits GROUP BY device_id HAVING MIN(day) >= ?)`
  ).bind(debut).first();
  return {
    pause_min: PAUSE_SESSION_MIN,
    depuis: debut,
    par_longueur: parLongueur || [],
    neufs: neufs?.n || 0,
    par_rang: parRang || [],
  };
}

/** D'ou arrivent les visites, sur trente jours, et heure par heure sur quinze. */
export async function lireArrivees(db, now) {
  const debut30 = new Date(now - 30 * JOUR).toISOString().slice(0, 10);
  const debut15 = new Date(now - 15 * JOUR).toISOString().slice(0, 10);
  const d = await db.prepare(`SELECT MIN(day) AS d FROM arrivees`).first();
  const { results: parSource } = await db.prepare(
    `SELECT source, SUM(n) AS n FROM arrivees WHERE day >= ?
      GROUP BY source ORDER BY n DESC LIMIT 20`).bind(debut30).all();
  const { results: parJour } = await db.prepare(
    `SELECT day, source, SUM(n) AS n FROM arrivees WHERE day >= ?
      GROUP BY day, source`).bind(debut30).all();
  const { results: heures } = await db.prepare(
    `SELECT day, heure, source, n FROM arrivees WHERE day >= ?`).bind(debut15).all();
  return {
    depuis: d?.d || null,
    par_source: parSource || [],
    par_jour: parJour || [],
    heures: heures || [],
  };
}
