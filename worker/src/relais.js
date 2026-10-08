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
  // Les defis d'equipe a equipe : une ligne par equipe engagee dans une
  // confrontation lancee depuis l'annuaire — celle qui defie (`lanceur`) et
  // celles qu'elle defie (`defie`). Le code de la confrontation est la cle
  // commune. Voir `lancerDefi`.
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS relay_defis (
      conf TEXT NOT NULL,
      team_id TEXT NOT NULL,
      from_team TEXT NOT NULL,
      from_name TEXT NOT NULL,
      max INTEGER NOT NULL,
      role TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (conf, team_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS relay_defis_par_equipe
                  ON relay_defis(team_id, created_at)`),
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

  // La trace est celle du TEMOIN, d'un bout a l'autre : une seule suite de
  // positions, pas quatre.
  //
  // Quatre traces etaient attendues ici, et c'etait une erreur de
  // representation — quatre traces racontent quatre courses independantes, or
  // un relais est une seule course que quatre personnes se passent. Rien ne
  // s'y ecrivait, aucun fantome n'a donc jamais pu exister ; le contrat
  // pouvait etre corrige sans rien menager.
  //
  // Bornee comme celles des defis : un client ne doit pas pouvoir remplir la
  // base sous couvert d'enregistrer une course. Un 4x100 dure une quarantaine
  // de secondes, soit quatre cents releves au pas de cent millisecondes.
  let tr = null;
  if (Array.isArray(traces) && traces.length >= 10) {
    const a = [];
    for (let k = 0; k < traces.length && k < 1200; k++) {
      const n = Math.round(Number(traces[k]));
      a.push(Number.isFinite(n) ? Math.max(0, Math.min(60000, n)) : 0);
    }
    tr = JSON.stringify(a);
  }

  await db.prepare(
    `INSERT INTO relay_scores (team_id, race_key, total_ms, legs, traces, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(team_id, race, total, JSON.stringify(propres), tr, Date.now()).run();

  if (tr) await elaguerFantomes(db, race);
  return { total_ms: total };
}

/* ---------------------------------------------------------------------------
   L'ANNUAIRE ET LES DEFIS D'EQUIPE A EQUIPE
   ---------------------------------------------------------------------------
   Une confrontation se montait avec un code a partager de la main a la main :
   il fallait connaitre les autres equipes, et les joindre hors du jeu. Ici on
   les trouve dans le jeu — toutes les equipes completes, cherchables par leur
   nom ou celui d'un de leurs coureurs — et on en defie jusqu'a sept d'un coup.
   Sept, parce que la piste a huit couloirs et que le premier est a soi.

   Le defi n'invente pas de nouvelle course : il ouvre une confrontation
   ordinaire et en DISTRIBUE le code. Chaque membre des equipes engagees — les
   trois coequipiers du lanceur compris — le trouve dans le jeu et entre sur la
   piste avec son equipe. La salle reste celle de salle-confrontation.js, avec
   ses regles : on part quand chaque equipe presente est au complet et prete.
--------------------------------------------------------------------------- */

/** Combien de temps un defi reste ouvert, s'il n'est pas couru avant. */
const DUREE_DEFI_MS = 15 * 60 * 1000;
/** Au-dela, une equipe attend avant de defier encore : la sonnette n'est pas un jouet. */
const DEFIS_PAR_FENETRE = 5, FENETRE_DEFIS_MS = 10 * 60 * 1000;

/** Les titulaires de plusieurs equipes, en une requete. */
async function titulairesDe(db, ids) {
  const par = new Map(ids.map(id => [id, []]));
  if (!ids.length) return par;
  const { results } = await db.prepare(
    `SELECT team_id, name, name_key, leg FROM relay_members
      WHERE state = 'in' AND team_id IN (${ids.map(() => '?').join(',')})
      ORDER BY team_id, (leg IS NULL), leg`).bind(...ids).all();
  for (const r of results || []) {
    par.get(r.team_id)?.push({ nom: r.name, cle: r.name_key, relais: r.leg });
  }
  return par;
}

/**
 * Les equipes qu'on peut defier : actives ET encore a quatre.
 *
 * `status = 'active'` ne suffit pas : quitter une equipe la laisse active a
 * trois titulaires, et une equipe de trois ne peut plus entrer en salle — la
 * defier, ce serait attendre quelqu'un qui ne viendra jamais.
 *
 * `sauf` retire les equipes ou court ce joueur : on ne se defie pas soi-meme,
 * et un coureur ne tient pas deux couloirs.
 */
export async function annuaireRelais(db, { q = '', sauf = '', race = '4x100', limite = 40 } = {}) {
  await ensureRelayTables(db);
  const motif = String(q || '').trim().toLowerCase().replace(/[%_\\]/g, '').slice(0, 24);
  const filtre = motif
    ? `AND (t.name_key LIKE ?1 OR t.id IN (SELECT team_id FROM relay_members
                                            WHERE state = 'in' AND name_key LIKE ?1))`
    : '';
  const req = db.prepare(
    `SELECT t.id, t.name, t.sealed_at, MIN(s.total_ms) AS best, COUNT(s.id) AS courses
       FROM relay_teams t
       LEFT JOIN relay_scores s ON s.team_id = t.id AND s.race_key = ?2
      WHERE t.status = 'active' ${filtre}
      GROUP BY t.id
      ORDER BY (best IS NULL), best, t.sealed_at DESC
      LIMIT 120`);
  const { results } = await (motif ? req.bind('%' + motif + '%', race) : req.bind(null, race)).all();
  const lignes = results || [];
  const membres = await titulairesDe(db, lignes.map(r => r.id));
  const moi = cle(sauf);
  const sortie = [];
  for (const r of lignes) {
    const m = membres.get(r.id) || [];
    if (m.length !== TAILLE) continue;
    if (moi && m.some(x => x.cle === moi)) continue;
    sortie.push({ id: r.id, nom: r.name, membres: m,
                  meilleur_ms: r.best ?? null, courses: r.courses || 0 });
    if (sortie.length >= limite) break;
  }
  return sortie;
}

/**
 * Lancer un defi : une confrontation, et sa distribution.
 *
 * Renvoie `{ conf, max, a_prevenir }` — `a_prevenir` est la liste des
 * joueurs a sonner : tous les titulaires des equipes defiees, plus les trois
 * coequipiers du lanceur, qui ont besoin du code autant que les autres.
 */
export async function lancerDefi(db, { equipe: id, joueur, cibles, conf }) {
  await ensureRelayTables(db);
  const moi = cle(joueur);
  const code = String(id || '').toUpperCase();
  const ids = [...new Set((Array.isArray(cibles) ? cibles : [])
    .map(x => String(x || '').toUpperCase()).filter(x => /^[A-Z0-9]{4,10}$/.test(x)))];
  if (!ids.length) return { erreur: 'aucune equipe a defier' };
  if (ids.length > MAX_EQUIPES - 1) return { erreur: 'sept equipes au plus' };
  if (ids.includes(code)) return { erreur: 'on ne se defie pas soi-meme' };

  const tous = await titulairesDe(db, [code, ...ids]);
  const miens = tous.get(code) || [];
  if (miens.length !== TAILLE) return { erreur: 'ton equipe n est pas au complet' };
  if (!miens.some(m => m.cle === moi)) return { erreur: 'tu ne cours pas dans cette equipe' };
  const st = await db.prepare(
    `SELECT id, status FROM relay_teams WHERE id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  const actives = new Set((st.results || []).filter(r => r.status === 'active').map(r => r.id));
  const nosCles = new Set(miens.map(m => m.cle));
  for (const c of ids) {
    const m = tous.get(c) || [];
    if (!actives.has(c) || m.length !== TAILLE) return { erreur: 'une equipe defiee n est plus au complet' };
    if (m.some(x => nosCles.has(x.cle))) return { erreur: 'un de tes coequipiers court dans une equipe defiee' };
  }

  const n = await db.prepare(
    `SELECT COUNT(*) AS n FROM relay_defis
      WHERE from_team = ? AND role = 'lanceur' AND created_at > ?`
  ).bind(code, Date.now() - FENETRE_DEFIS_MS).first();
  if ((n?.n || 0) >= DEFIS_PAR_FENETRE) return { erreur: 'trop de defis d affilee, attends un peu' };

  const t = Date.now();
  const max = 1 + ids.length;
  const nom = nomPropre(joueur, 20);
  await db.batch([[code, 'lanceur'], ...ids.map(c => [c, 'defie'])].map(([e, role]) =>
    db.prepare(`INSERT OR REPLACE INTO relay_defis
                  (conf, team_id, from_team, from_name, max, role, state, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ouvert', ?)`)
      .bind(conf, e, code, nom, max, role, t)));

  const a_prevenir = [];
  for (const [e, m] of tous) for (const x of m) if (x.cle !== moi) a_prevenir.push(x.cle);
  return { conf, max, a_prevenir };
}

/**
 * Les defis ouverts qui concernent un joueur, du plus recent au plus ancien.
 *
 * Ceux qu'il a lances compris (`lance_par_moi`) : s'il quitte l'ecran avant
 * le depart, c'est d'ici qu'il revient sur la piste.
 */
export async function defisDe(db, joueur) {
  await ensureRelayTables(db);
  const moi = cle(joueur);
  if (!moi) return [];
  const depuis = Date.now() - DUREE_DEFI_MS;
  const { results } = await db.prepare(
    `SELECT d.conf, d.team_id, d.from_team, d.from_name, d.max, d.role, d.created_at
       FROM relay_defis d
       JOIN relay_members m ON m.team_id = d.team_id AND m.name_key = ? AND m.state = 'in'
      WHERE d.state = 'ouvert' AND d.created_at > ?
      ORDER BY d.created_at DESC LIMIT 10`).bind(moi, depuis).all();
  const lignes = results || [];
  if (!lignes.length) return [];
  const confs = [...new Set(lignes.map(r => r.conf))];
  const eng = await db.prepare(
    `SELECT d.conf, d.team_id, t.name FROM relay_defis d
       JOIN relay_teams t ON t.id = d.team_id
      WHERE d.conf IN (${confs.map(() => '?').join(',')})`).bind(...confs).all();
  const parConf = new Map();
  for (const r of eng.results || []) {
    if (!parConf.has(r.conf)) parConf.set(r.conf, []);
    parConf.get(r.conf).push({ id: r.team_id, nom: r.name });
  }
  const maintenant = Date.now();
  return lignes.map(r => {
    const engagees = parConf.get(r.conf) || [];
    return {
      conf: r.conf, max: r.max, role: r.role, le: r.created_at,
      reste_ms: Math.max(0, r.created_at + DUREE_DEFI_MS - maintenant),
      equipe: r.team_id,
      equipe_nom: engagees.find(e => e.id === r.team_id)?.nom || r.team_id,
      de: engagees.find(e => e.id === r.from_team)?.nom || r.from_team,
      lance_par: r.from_name,
      lance_par_moi: cle(r.from_name) === moi,
      adversaires: engagees.filter(e => e.id !== r.team_id).map(e => e.nom),
    };
  });
}

/** La confrontation a ete courue : ses defis ne se proposent plus. */
export async function defiCouru(db, conf) {
  await ensureRelayTables(db);
  await db.prepare(`UPDATE relay_defis SET state = 'couru' WHERE conf = ?`).bind(conf).run();
}

export { TAILLE, MIN_EQUIPES, MAX_EQUIPES };
