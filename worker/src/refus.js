// Les refus de nom, et pourquoi ils ne laissaient aucune trace.
//
// LE CONSTAT. Un nom reserve n'accepte que les appareils de son proprietaire.
// C'est la bonne regle : sans elle, n'importe qui court sous le nom d'un
// autre. Mais quand elle refuse, elle refusait EN SILENCE — un 403 rendu au
// joueur, et rien nulle part.
//
// Ce que ca coute se mesure a un cas reel. Le 10 septembre 2026 a 01:31 UTC,
// un 8,22 s au 100 m — record du monde du jeu — est parti sous le nom « Leo »
// depuis un appareil qui ne le possedait pas. Refuse. Le chrono n'existe dans
// aucune table, la course non plus, et personne cote serveur n'a su qu'un
// joueur venait de se cogner a un mur. On ne l'a appris que par la capture
// d'ecran d'un joueur qui demandait pourquoi.
//
// Et ce n'est pas qu'une anecdote de classement : `/race` applique le meme
// controle. Un joueur mure ne compte donc dans AUCUN chiffre — ni parties, ni
// classement, ni historique. Le tableau de bord affiche « 11 parties » quand
// il s'en est peut-etre joue vingt, et rien ne dit laquelle des deux lectures
// est la bonne.
//
// UN COMPTEUR, PAS UN JOURNAL. On garde une ligne par (nom, appareil, route)
// avec son compte et ses deux dates, plutot qu'une ligne par tentative. La
// question posee est « combien de joueurs se cognent au mur, et depuis quand »,
// pas « quelle milliseconde ». Un joueur bloque produit donc une poignee de
// lignes et pas des milliers, et la table ne peut pas enfler par usage normal.
//
// CA NE DOIT JAMAIS CHANGER LE REFUS. Le 403 est deja decide quand on arrive
// ici. Si la note echoue — table absente, base indisponible, ecriture refusee
// — elle echoue seule et en silence : un compteur qui manque est un chiffre en
// moins, une exception serait une route cassee.

/** Les routes dont on accepte de noter les refus. Ecrite en dur : une faute
 *  de frappe dans un appel creerait une categorie fantome, et personne ne
 *  verrait la difference entre « /submitt » et une route qui ne refuse plus. */
export const ROUTES = new Set([
  '/submit', '/race', '/profil', '/objectif/tentative',
  '/champ/pays', '/direct/inviter', '/notifications/rythme',
]);

/** Au-dela, on ne garde que les appareils les plus recents pour ce nom.
 *
 *  L'appareil est choisi par le client : un script peut en tirer un nouveau a
 *  chaque appel et fabriquer autant de lignes qu'il fait de requetes. La
 *  limite de frequence l'en empeche a grande echelle, ce plafond fait le
 *  reste. Cinquante appareils pour un seul nom, c'est deja bien au-dela de ce
 *  qu'un joueur reel produit — il en a deux ou trois. */
const MAX_APPAREILS_PAR_NOM = 50;

const pret = new WeakSet();

export async function ensureRefusTable(db) {
  if (pret.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS refus_nom (
    name_key TEXT NOT NULL,
    device_id TEXT NOT NULL,
    route TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    premier_le INTEGER NOT NULL,
    dernier_le INTEGER NOT NULL,
    PRIMARY KEY (name_key, device_id, route)
  )`).run();
  // La lecture usuelle est « ce qui s'est passe ces sept derniers jours ».
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS refus_nom_recents ON refus_nom(dernier_le)`
  ).run();
  pret.add(db);
}

/**
 * Un refus vient d'etre rendu : on le note.
 *
 * Ne leve jamais et ne rend jamais d'erreur a l'appelant — voir l'en-tete.
 *
 * @returns {Promise<boolean>} vrai si la note a ete prise, faux sinon.
 */
export async function noterRefus(db, { route, nameKey, deviceId } = {}) {
  const r = String(route || '');
  const k = String(nameKey || '').trim().toLowerCase();
  const d = String(deviceId || '');
  if (!db || !ROUTES.has(r) || !k || !d) return false;

  try {
    await ensureRefusTable(db);
    const now = Date.now();
    await db.prepare(
      `INSERT INTO refus_nom (name_key, device_id, route, n, premier_le, dernier_le)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(name_key, device_id, route) DO UPDATE SET
         n = n + 1, dernier_le = excluded.dernier_le`
    ).bind(k, d, r, now, now).run();

    // Le plafond, sur le meme modele que l'historique des courses : on garde
    // les plus recents et on laisse tomber la queue.
    await db.prepare(
      `DELETE FROM refus_nom
        WHERE name_key = ?
          AND device_id NOT IN (
            SELECT device_id FROM refus_nom WHERE name_key = ?
             GROUP BY device_id ORDER BY MAX(dernier_le) DESC LIMIT ?)`
    ).bind(k, k, MAX_APPAREILS_PAR_NOM).run();
    return true;
  } catch {
    return false;                 // un compteur qui manque ne casse rien
  }
}

/**
 * Ce que les refus racontent, sur une fenetre de jours.
 *
 * `avecNoms` decide si les pseudonymes sortent en clair. Ils restent caches
 * par defaut, comme dans la file des reseaux : lire « combien de joueurs sont
 * mures » n'exige de connaitre personne, et un chiffre qu'on consulte souvent
 * ne doit pas promener des noms a chaque fois.
 */
export async function refusResume(db, { jours = 7, avecNoms = false } = {}) {
  await ensureRefusTable(db);
  const j = Math.max(1, Math.min(365, Math.round(Number(jours) || 7)));
  const depuis = Date.now() - j * 86400000;

  const total = await db.prepare(
    `SELECT COALESCE(SUM(n), 0) AS refus,
            COUNT(DISTINCT name_key) AS noms,
            COUNT(DISTINCT device_id) AS appareils
       FROM refus_nom WHERE dernier_le >= ?`
  ).bind(depuis).first();

  const { results: routes } = await db.prepare(
    `SELECT route, SUM(n) AS refus, COUNT(DISTINCT name_key) AS noms
       FROM refus_nom WHERE dernier_le >= ?
      GROUP BY route ORDER BY refus DESC`
  ).bind(depuis).all();

  // Les noms les plus touches : c'est la liste qu'on regarde pour aller
  // debloquer quelqu'un. Un nom qui revient avec un seul appareil est presque
  // toujours un joueur qui a change de telephone.
  const { results: mures } = await db.prepare(
    `SELECT name_key, SUM(n) AS refus,
            COUNT(DISTINCT device_id) AS appareils,
            MIN(premier_le) AS depuis_le, MAX(dernier_le) AS dernier_le
       FROM refus_nom WHERE dernier_le >= ?
      GROUP BY name_key ORDER BY refus DESC LIMIT 50`
  ).bind(depuis).all();

  return {
    jours: j,
    refus: total?.refus || 0,
    noms: total?.noms || 0,
    appareils: total?.appareils || 0,
    routes: routes || [],
    mures: (mures || []).map(m => ({
      nom: avecNoms ? m.name_key : null,
      refus: m.refus, appareils: m.appareils,
      depuis_le: m.depuis_le, dernier_le: m.dernier_le,
    })),
  };
}
