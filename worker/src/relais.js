/* ---------------------------------------------------------------------------
   RELAIS — les equipes
   ---------------------------------------------------------------------------
   Une equipe de relais est definie par SA COMPOSITION, pas par son nom.

   C'est la regle qui structure tout le reste : « si la meme composition est
   selectionnee, le nom deja valide pour cette composition est automatiquement
   attribue, quel que soit l'ordre des membres ». Autrement dit, quatre
   personnes donnees forment une equipe et une seule, qui porte un nom une fois
   pour toutes. Reformer le meme quatuor ne cree pas une deuxieme equipe : on
   retrouve la sienne.

   On materialise ca par une cle de composition — les quatre identifiants tries
   et joints — avec un index unique dessus. L'ordre disparait au tri, donc
   « Ana, Bob, Carl, Dana » et « Dana, Carl, Bob, Ana » tombent sur la meme
   cle. La base garantit alors l'unicite, plutot que du code qui essaierait de
   s'en souvenir.

   Le nom, lui, est unique globalement. La regle ne le demandait pas, mais un
   classement ou trois equipes s'appellent « Les Fusees » n'est pas lisible, et
   c'est deja la contrainte qu'on applique aux joueurs.

   Une equipe nait « en formation » : le createur choisit un nom et invite
   trois personnes. Elle ne devient « active » — et n'entre au classement — que
   lorsque les quatre ont accepte. Tant qu'un refus est possible, la
   composition n'est pas figee.
--------------------------------------------------------------------------- */

const TAILLE = 4;                     // un relais, c'est quatre. Jamais moins.
// Une confrontation oppose de deux a huit equipes. Deux, c'est un duel
// d'equipes ; huit, c'est une finale a couloirs pleins. Au-dela, la piste n'a
// plus de couloir a offrir et l'ecran plus rien a montrer.
const MIN_EQUIPES = 2, MAX_EQUIPES = 8;
const MAX_NOM_EQUIPE = 24;
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function code(n = 6) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

/** Identifiant d'un joueur : son nom, normalise. Meme regle que le TOP 500. */
export function cle(nom) {
  return String(nom || '').trim().toLowerCase();
}

export function nomPropre(brut, max = MAX_NOM_EQUIPE) {
  const s = String(brut || '').trim().slice(0, max).replace(/[<>]/g, '');
  return s;
}

/**
 * La cle de composition : les membres tries puis joints.
 *
 * Le tri est ce qui rend l'ordre indifferent, et c'est tout l'objet de la
 * regle. On separe par un caractere qui ne peut pas apparaitre dans une cle de
 * joueur, sinon « ab » + « c » et « a » + « bc » se confondraient.
 */
export function cleComposition(noms) {
  return [...new Set(noms.map(cle).filter(Boolean))].sort().join('');
}

// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const pret = new WeakSet();
export async function ensureRelayTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS relay_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      roster_key TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      sealed_at INTEGER
    )`),
    // Les deux unicites qui portent la regle. La base les tient mieux que du
    // code : deux creations simultanees de la meme composition ne peuvent pas
    // passer toutes les deux.
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS relay_roster_unique
                  ON relay_teams(roster_key)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS relay_name_unique
                  ON relay_teams(name_key)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS relay_members (
      team_id TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      leg INTEGER,
      state TEXT NOT NULL,
      invited_at INTEGER NOT NULL,
      answered_at INTEGER,
      PRIMARY KEY (team_id, name_key)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS relay_members_by_player
                  ON relay_members(name_key, state)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS relay_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      race_key TEXT NOT NULL,
      total_ms INTEGER NOT NULL,
      legs TEXT NOT NULL,
      traces TEXT,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS relay_scores_best
                  ON relay_scores(race_key, total_ms)`),
  ]);
  // Colonne ajoutee apres coup, comme ailleurs : la table peut deja exister.
  try { await db.prepare(`ALTER TABLE relay_scores ADD COLUMN traces TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  pret.add(db);
}

/**
 * Seuls les dix meilleures EQUIPES restent affrontables en fantome, et
 * chacune par sa meilleure course.
 *
 * Une equipe dominante remplirait sinon les dix places a elle seule, et il n'y
 * aurait plus qu'un adversaire a defier au lieu de dix. C'est aussi la lecture
 * qui colle au classement, ou une equipe n'occupe qu'une ligne.
 *
 * On efface les traces des autres, pas leurs lignes : une equipe ne perd pas
 * son chrono, seulement la possibilite qu'on la rejoue.
 */
const FANTOMES_GARDES = 10;
async function elaguerFantomes(db, race) {
  await db.prepare(
    `UPDATE relay_scores SET traces = NULL
      WHERE race_key = ? AND traces IS NOT NULL AND id NOT IN (
        SELECT id FROM (
          SELECT id, team_id, MIN(total_ms) AS m
            FROM relay_scores
           WHERE race_key = ? AND traces IS NOT NULL
           GROUP BY team_id
           ORDER BY m ASC LIMIT ?))`
  ).bind(race, race, FANTOMES_GARDES).run();
}

/** Les courses rejouables en fantome, du meilleur au moins bon. */
export async function fantomesRelais(db, race = '4x100', limite = FANTOMES_GARDES) {
  await ensureRelayTables(db);
  // Une equipe, une ligne : la meme regle que le classement.
  const { results } = await db.prepare(
    `SELECT s.id, s.team_id, t.name, s.legs, s.created_at,
            MIN(s.total_ms) AS total_ms
       FROM relay_scores s JOIN relay_teams t ON t.id = s.team_id
      WHERE s.race_key = ? AND s.traces IS NOT NULL
      GROUP BY s.team_id
      ORDER BY total_ms ASC LIMIT ?`).bind(race, Math.min(limite, FANTOMES_GARDES)).all();
  return (results || []).map((r, i) => ({
    rang: i + 1, id: r.id, equipe: r.name, equipe_id: r.team_id,
    total_ms: r.total_ms, relais: JSON.parse(r.legs || '[]'), le: r.created_at,
  }));
}

/** La trace complete d'une course, pour la courir en fantome. */
export async function fantomeRelais(db, id) {
  await ensureRelayTables(db);
  const r = await db.prepare(
    `SELECT s.id, s.team_id, t.name, s.race_key, s.total_ms, s.legs, s.traces
       FROM relay_scores s JOIN relay_teams t ON t.id = s.team_id
      WHERE s.id = ?`).bind(id).first();
  if (!r || !r.traces) return null;
  return {
    id: r.id, equipe: r.name, equipe_id: r.team_id, epreuve: r.race_key,
    total_ms: r.total_ms, relais: JSON.parse(r.legs || '[]'),
    traces: JSON.parse(r.traces),
  };
}

/** L'equipe et ses membres, telle qu'un client la voit. */
export async function equipe(db, id) {
  const t = await db.prepare(
    `SELECT id, name, roster_key, status, created_by, created_at, sealed_at
       FROM relay_teams WHERE id = ?`).bind(id).first();
  if (!t) return null;
  const { results } = await db.prepare(
    `SELECT name, name_key, leg, state, invited_at, answered_at
       FROM relay_members WHERE team_id = ?
      ORDER BY (leg IS NULL), leg, invited_at`).bind(id).all();
  const membres = results || [];
  return {
    id: t.id,
    nom: t.name,
    statut: t.status,
    createur: t.created_by,
    cree_le: t.created_at,
    complete_le: t.sealed_at,
    membres: membres.map(m => ({
      nom: m.name, cle: m.name_key, relais: m.leg, etat: m.state,
    })),
    manquants: TAILLE - membres.filter(m => m.state === 'in').length,
  };
}

/**
 * Cree une equipe, ou rend celle qui existe deja pour cette composition.
 *
 * Renvoie `{ equipe, existait }`. `existait` dit au jeu s'il doit annoncer
 * « voici votre equipe » plutot que « equipe creee » — et pourquoi le nom
 * propose n'a pas ete retenu.
 */
export async function creerEquipe(db, { createur, coequipiers, nom }) {
  await ensureRelayTables(db);

  const cCreateur = cle(createur);
  if (!cCreateur) return { erreur: 'nom du createur manquant' };

  const tous = [createur, ...coequipiers];
  const cles = [...new Set(tous.map(cle).filter(Boolean))];
  if (cles.length !== TAILLE) {
    return { erreur: 'un relais se court a quatre, sans doublon' };
  }

  const roster = cleComposition(tous);

  // La composition prime sur le nom. Si ces quatre-la ont deja une equipe, on
  // la leur rend telle quelle — c'est exactement la regle demandee.
  const deja = await db.prepare(
    `SELECT id FROM relay_teams WHERE roster_key = ?`).bind(roster).first();
  if (deja) {
    return { equipe: await equipe(db, deja.id), existait: true };
  }

  const propre = nomPropre(nom);
  if (propre.length < 2) return { erreur: 'nom d equipe trop court' };
  const nomCle = propre.toLowerCase();

  const pris = await db.prepare(
    `SELECT id FROM relay_teams WHERE name_key = ?`).bind(nomCle).first();
  if (pris) return { erreur: 'nom d equipe deja pris' };

  const id = code();
  const t = Date.now();
  try {
    await db.prepare(
      `INSERT INTO relay_teams (id, name, name_key, roster_key, status, created_by, created_at)
       VALUES (?, ?, ?, ?, 'forming', ?, ?)`
    ).bind(id, propre, nomCle, roster, cCreateur, t).run();
  } catch (e) {
    // Course entre deux creations simultanees : l'index unique a tranche, et
    // celui qui perd retrouve simplement l'equipe de l'autre.
    const c = await db.prepare(
      `SELECT id FROM relay_teams WHERE roster_key = ?`).bind(roster).first();
    if (c) return { equipe: await equipe(db, c.id), existait: true };
    return { erreur: 'creation impossible' };
  }

  // Le createur est dedans d'office ; les autres sont invites.
  const lignes = tous.map((n, i) => {
    const k = cle(n);
    const moi = k === cCreateur;
    return db.prepare(
      `INSERT OR IGNORE INTO relay_members
         (team_id, name_key, name, leg, state, invited_at, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, k, nomPropre(n, 20), moi ? 1 : null,
           moi ? 'in' : 'invited', t, moi ? t : null);
  });
  await db.batch(lignes);

  return { equipe: await equipe(db, id), existait: false };
}

/**
 * Repondre a une invitation. Le quatrieme oui scelle l'equipe.
 *
 * Un refus ne detruit pas l'equipe : la composition reste celle qui a ete
 * proposee, et le createur peut relancer. Sans quoi un refus accidentel
 * ferait perdre le nom.
 */
export async function repondre(db, { id, joueur, accepte }) {
  await ensureRelayTables(db);
  const k = cle(joueur);
  const m = await db.prepare(
    `SELECT state FROM relay_members WHERE team_id = ? AND name_key = ?`
  ).bind(id, k).first();
  if (!m) return { erreur: 'invitation introuvable' };

  await db.prepare(
    `UPDATE relay_members SET state = ?, answered_at = ?, name = ?
      WHERE team_id = ? AND name_key = ?`
  ).bind(accepte ? 'in' : 'out', Date.now(), nomPropre(joueur, 20), id, k).run();

  if (accepte) {
    const n = await db.prepare(
      `SELECT COUNT(*) AS n FROM relay_members WHERE team_id = ? AND state = 'in'`
    ).bind(id).first();
    if ((n?.n || 0) >= TAILLE) {
      // Ordre de relais : par ordre d'arrivee, tant que personne n'a choisi.
      const { results } = await db.prepare(
        `SELECT name_key FROM relay_members WHERE team_id = ? AND state = 'in'
          ORDER BY (leg IS NULL), leg, answered_at`).bind(id).all();
      await db.batch((results || []).map((r, i) =>
        db.prepare(`UPDATE relay_members SET leg = ? WHERE team_id = ? AND name_key = ?`)
          .bind(i + 1, id, r.name_key)));
      await db.prepare(
        `UPDATE relay_teams SET status = 'active', sealed_at = ? WHERE id = ?`
      ).bind(Date.now(), id).run();
    }
  }
  return { equipe: await equipe(db, id) };
}

/** Choisir qui court quel relais. Reserve a une equipe complete. */
export async function ordonner(db, { id, ordre }) {
  await ensureRelayTables(db);
  if (!Array.isArray(ordre) || ordre.length !== TAILLE) {
    return { erreur: 'il faut les quatre relayeurs' };
  }
  const cles = ordre.map(cle);
  if (new Set(cles).size !== TAILLE) return { erreur: 'un relayeur en double' };
  const { results } = await db.prepare(
    `SELECT name_key FROM relay_members WHERE team_id = ? AND state = 'in'`).bind(id).all();
  const dedans = new Set((results || []).map(r => r.name_key));
  if (cles.some(k => !dedans.has(k))) return { erreur: 'relayeur hors de l equipe' };

  await db.batch(cles.map((k, i) =>
    db.prepare(`UPDATE relay_members SET leg = ? WHERE team_id = ? AND name_key = ?`)
      .bind(i + 1, id, k)));
  return { equipe: await equipe(db, id) };
}

/** Les equipes d'un joueur : celles ou il court, et celles ou on l'attend. */
export async function mesEquipes(db, joueur) {
  await ensureRelayTables(db);
  const k = cle(joueur);
  if (!k) return { equipes: [], invitations: [] };
  const { results } = await db.prepare(
    `SELECT m.team_id, m.state FROM relay_members m
      WHERE m.name_key = ? AND m.state IN ('in','invited')
      ORDER BY m.invited_at DESC LIMIT 60`).bind(k).all();

  const equipes = [], invitations = [];
  for (const r of results || []) {
    const e = await equipe(db, r.team_id);
    if (!e) continue;
    (r.state === 'invited' ? invitations : equipes).push(e);
  }
  return { equipes, invitations };
}

/**
 * Classement des relais : le meilleur cumul de chaque equipe.
 *
 * Une equipe n'y figure qu'active — donc complete. Le classement recompense
 * l'equipe, pas la composition du jour : c'est la meme chose ici, puisqu'une
 * composition est une equipe.
 */
export async function classementRelais(db, race = '4x100', limite = 500) {
  await ensureRelayTables(db);
  const { results } = await db.prepare(
    `SELECT t.id, t.name, MIN(s.total_ms) AS best, COUNT(s.id) AS courses,
            MAX(s.created_at) AS derniere
       FROM relay_scores s
       JOIN relay_teams t ON t.id = s.team_id
      WHERE s.race_key = ? AND t.status = 'active'
      GROUP BY t.id
      ORDER BY best ASC
      LIMIT ?`).bind(race, limite).all();
  return (results || []).map((r, i) => ({
    rang: i + 1, id: r.id, nom: r.name,
    meilleur_ms: r.best, courses: r.courses, derniere: r.derniere,
  }));
}

/** Une confrontation est-elle jouable avec ce nombre d'equipes ? */
export function confrontationValide(n) {
  return Number.isInteger(n) && n >= MIN_EQUIPES && n <= MAX_EQUIPES;
}

/** Enregistre le resultat d'un relais couru. */
export async function enregistrerRelais(db, { team_id, race_key, legs, traces }) {
  await ensureRelayTables(db);
  if (!Array.isArray(legs) || legs.length !== TAILLE) {
    return { erreur: 'il faut les quatre temps' };
  }
  const propres = legs.map(v => Math.round(Number(v)));
  if (propres.some(v => !Number.isFinite(v) || v < 1000 || v > 600000)) {
    return { erreur: 'temps invalide' };
  }
  const t = await db.prepare(
    `SELECT status FROM relay_teams WHERE id = ?`).bind(team_id).first();
  if (!t) return { erreur: 'equipe introuvable' };
  if (t.status !== 'active') return { erreur: 'equipe incomplete' };

  const total = propres.reduce((a, b) => a + b, 0);
  const race = String(race_key || '4x100');

  // Les traces sont bornees comme celles des defis : un client ne doit pas
  // pouvoir remplir la base sous couvert d'enregistrer une course.
  let tr = null;
  if (Array.isArray(traces) && traces.length === TAILLE) {
    tr = JSON.stringify(traces.map(t => {
      const a = [];
      if (!Array.isArray(t)) return a;
      for (let i = 0; i < t.length && i < 1200; i++) {
        const n = Math.round(Number(t[i]));
        a.push(Number.isFinite(n) ? Math.max(0, Math.min(60000, n)) : 0);
      }
      return a;
    }));
  }

  await db.prepare(
    `INSERT INTO relay_scores (team_id, race_key, total_ms, legs, traces, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(team_id, race, total, JSON.stringify(propres), tr, Date.now()).run();

  if (tr) await elaguerFantomes(db, race);
  return { total_ms: total };
}

export { TAILLE, MIN_EQUIPES, MAX_EQUIPES };
