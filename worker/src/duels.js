/* ---------------------------------------------------------------------------
   CLASSEMENT DES DUELS
   ---------------------------------------------------------------------------
   Partage par les deux facons de se defier : le defi differe, ou l'un pose son
   chrono et l'autre le rejoue en fantome ; et la course en direct, ou les deux
   partent ensemble. Ce sont deux experiences tres differentes, mais un seul
   classement — donc un seul endroit ou les points se decident, sinon les deux
   modes finiraient par ne plus compter pareil.
--------------------------------------------------------------------------- */

// Classement des duels, distinct du TOP 500. Il ne recompense pas la vitesse
// pure mais l'engagement : tous les duels y comptent, qu'on les ait lances ou
// releves.
//
// Le bareme depend du role, parce que les deux roles ne courent pas le meme
// risque. Celui qui lance abat sa carte le premier : son chrono est pose, et
// l'autre le voit courir en fantome en sachant exactement ce qu'il doit
// battre. On le paie donc peu quand il l'emporte quand meme (+1) et on le
// sanctionne franchement quand il tombe (-2). Celui qui releve, lui, gagne
// gros (+2) et perd peu (-1).
//
// Effet de bord voulu : la somme des points distribues vaut toujours zero
// (+2/-2 ou +1/-1), donc le classement ne derive ni vers le haut ni vers le
// bas quel que soit le nombre de duels joues.
export const DUEL_INIT_WIN = 1, DUEL_INIT_LOSS = -2;
export const DUEL_RECV_WIN = 2, DUEL_RECV_LOSS = -1;
export const DUEL_DRAW = 0;
// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const duelReady = new WeakSet();
export async function ensureDuelTables(db) {
  if (duelReady.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS duel_players (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      launched INTEGER NOT NULL DEFAULT 0,
      prev_rank INTEGER,
      last_delta INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`),
    // Un duel ne se resout qu'une fois : la cle empeche qu'une seconde
    // tentative sur le meme defi redistribue des points.
    db.prepare(`CREATE TABLE IF NOT EXISTS duel_results (
      challenge_id TEXT NOT NULL,
      opponent_key TEXT NOT NULL,
      challenger_key TEXT NOT NULL,
      challenger_ms INTEGER NOT NULL,
      opponent_ms INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (challenge_id, opponent_key)
    )`),
  ]);
  // Colonnes arrivees apres coup : la table existe deja chez ceux qui
  // jouaient avant, d'ou les ajouts tolerants.
  for (const sql of [
    `ALTER TABLE duel_players ADD COLUMN received INTEGER NOT NULL DEFAULT 0`,
    // Le nom lisible de celui qui a releve. La cle est en minuscules et sert
    // a dedoublonner ; c'est ce nom-ci qu'on montre au lanceur.
    `ALTER TABLE duel_results ADD COLUMN opponent_name TEXT`,
    // Celui qui lance apprend le resultat en revenant au jeu, une seule fois.
    `ALTER TABLE duel_results ADD COLUMN seen_by_challenger INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try { await db.prepare(sql).run(); } catch (e) { /* colonne deja presente */ }
  }
  duelReady.add(db);
}

export async function touchDuelPlayer(db, key, name) {
  await db.prepare(
    `INSERT INTO duel_players (name_key, name, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name_key) DO UPDATE SET name = excluded.name`
  ).bind(key, name, Date.now()).run();
}

/**
 * Le classement, ordonne. Y figure quiconque a joue au moins un duel — lance
 * ou releve, peu importe. Un joueur qui a seulement envoye un defi que
 * personne n'a encore releve n'a pas de duel derriere lui : il attend son
 * tour plutot que d'occuper une ligne a zero point.
 */
export async function duelBoard(db) {
  const { results } = await db.prepare(
    `SELECT name, points, wins, losses, draws, launched, received,
            prev_rank, last_delta
       FROM duel_players WHERE wins + losses + draws > 0
      ORDER BY points DESC, wins DESC, losses ASC, name ASC LIMIT 500`
  ).all();
  // Le mouvement n'est pas calcule ici : un rang fige cote serveur ne survit
  // pas au duel suivant, l'indicateur serait vide la plupart du temps. Le jeu
  // compare au classement qu'il a affiche la derniere fois, ce qui donne un
  // deplacement toujours parlant : « depuis ta derniere visite ».
  //
  // Les points, eux, ne sortent pas d'ici. Ils ordonnent le classement et ne
  // s'affichent nulle part : ce qu'un joueur doit lire, c'est sa place et le
  // fait qu'il monte ou qu'il descende. Les retirer de la reponse plutot que
  // de les cacher a l'ecran est la seule facon que ce soit vrai — sinon ils
  // restent lisibles dans les outils du navigateur, et le total d'un
  // adversaire se compare a la virgule pres.
  return (results || []).map(({ points, ...r }, i) => ({ ...r, rank: i + 1 }));
}


/**
 * Applique un duel au classement, une fois et une seule.
 *
 * `id` identifie la rencontre : le code du defi pour un duel differe, celui de
 * la salle pour une course en direct. La cle primaire de duel_results garantit
 * qu'un meme duel ne redistribue jamais deux fois — c'est ce qui permet a un
 * client de reenvoyer un resultat sans consequence.
 *
 * `challenger` est celui qui a lance : l'auteur du defi, ou l'hote de la
 * salle. `opponent` est celui qui a repondu.
 *
 * Renvoie l'issue et les points, ou `{ deja: true }` si la rencontre etait
 * deja tranchee.
 */
export async function appliquerDuel(db, r) {
  await ensureDuelTables(db);
  const luiKey = String(r.challengerName || '').trim().toLowerCase();
  const moiKey = String(r.opponentName || '').trim().toLowerCase();
  if (!luiKey || !moiKey || luiKey === moiKey) return null;

  const deja = await db.prepare(
    `SELECT outcome FROM duel_results WHERE challenge_id = ? AND opponent_key = ?`
  ).bind(r.id, moiKey).first();
  if (deja) return { issue: deja.outcome, deja: true };

  const issue = r.opponentMs < r.challengerMs ? 'opponent'
              : r.opponentMs > r.challengerMs ? 'challenger' : 'draw';

  await db.prepare(
    `INSERT INTO duel_results (challenge_id, opponent_key, opponent_name,
       challenger_key, challenger_ms, opponent_ms, outcome, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(r.id, moiKey, r.opponentName, luiKey,
         r.challengerMs, r.opponentMs, issue, Date.now()).run();

  await touchDuelPlayer(db, luiKey, r.challengerName);
  await touchDuelPlayer(db, moiKey, r.opponentName);

  const pts = { challenger: DUEL_DRAW, opponent: DUEL_DRAW };
  if (issue === 'challenger') {
    pts.challenger = DUEL_INIT_WIN; pts.opponent = DUEL_RECV_LOSS;
  } else if (issue === 'opponent') {
    pts.opponent = DUEL_RECV_WIN; pts.challenger = DUEL_INIT_LOSS;
  }

  const maj = (key, delta, w, l, d, recu) => db.prepare(
    `UPDATE duel_players SET points = points + ?, wins = wins + ?,
       losses = losses + ?, draws = draws + ?, received = received + ?,
       last_delta = ?, updated_at = ?
     WHERE name_key = ?`
  ).bind(delta, w, l, d, recu, delta, Date.now(), key);
  await db.batch([
    maj(luiKey, pts.challenger, issue==='challenger'?1:0, issue==='opponent'?1:0, issue==='draw'?1:0, 0),
    maj(moiKey, pts.opponent,   issue==='opponent'?1:0,   issue==='challenger'?1:0, issue==='draw'?1:0, 1),
  ]);

  return { issue, points: pts.opponent, points_adverse: pts.challenger };
}

/** Compte un defi lance : sert au compteur, pas aux points. */
export async function compterLance(db, key, name) {
  await ensureDuelTables(db);
  await touchDuelPlayer(db, key, name);
  await db.prepare(
    `UPDATE duel_players SET launched = launched + 1, updated_at = ? WHERE name_key = ?`
  ).bind(Date.now(), key).run();
}
