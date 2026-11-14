/**
 * LES PIECES — le porte-monnaie du joueur, tenu par le serveur.
 *
 * On gagne des pieces en gagnant des duels, en reussissant l'Objectif du
 * jour, en gagnant les etapes de la carriere (doublees par une pub au sacre)
 * et en remportant un titre de championnat ; on les depense pour un
 * « Continue » en carriere, qui fait repartir de l'etape perdue au lieu de
 * l'etape 1.
 *
 * POURQUOI UN JOURNAL ET PAS UN SOLDE. Chaque mouvement est une ligne, et le
 * solde est leur somme. Deux raisons :
 *   - l'idempotence est gratuite : (joueur, motif, reference) est UNIQUE, si
 *     bien qu'un sacre clos deux fois, un objectif valide par deux requetes
 *     simultanees ou un Continue renvoye apres une coupure reseau ne
 *     comptent qu'une fois. Les sources elles-memes ne le garantissent pas
 *     (lecture puis ecriture, sans verrou) ;
 *   - on peut toujours dire D'OU vient un solde, ce qu'un compteur perd.
 *
 * QUI A UN PORTE-MONNAIE. Seuls les noms RESERVES (une ligne dans `players`).
 * Un nom libre s'ecrit depuis n'importe quel appareil (`peutUtiliser` le
 * laisse passer) : des pieces posees dessus seraient a qui les reclame.
 *
 * LE BAREME VIT ICI, ET NULLE PART AILLEURS. Le jeu le lit dans la reponse de
 * GET /pieces ; un bareme recopie cote client deriverait au premier reglage.
 *
 * CE MODULE NE CASSE RIEN. Un credit qui echoue ne doit faire tomber ni un
 * duel, ni un objectif, ni un sacre : `crediter` avale ses erreurs et rend 0.
 */

/**
 * OUVERT A LA PRODUCTION le 6 octobre 2026 au soir, apres un passage par le
 * canal de test seul. Remis a false, rien n'est plus credite dans la base de
 * production et les routes /pieces n'y repondent plus (les soldes restent,
 * intacts, dans le journal). Chaque appelant dit sur quelle base il ecrit
 * (`test`) ; la base elle-meme ne le dit pas, le cron passe sur les deux avec
 * le meme code. Va de pair avec PIECES_OUVERTES dans src/game/pieces.ts.
 */
export const OUVERT_EN_PRODUCTION = true;
export const piecesOuvertes = test => OUVERT_EN_PRODUCTION || !!test;

/** Ce que rapporte chaque exploit. */
export const BAREME = {
  duel: 1,
  objectif: 5,
  titre_national: 100,
  titre_continental: 300,
  titre_mondial: 500,
};

/**
 * Le prix des Continue d'une meme carriere, dans l'ordre. Sa longueur est le
 * nombre de Continue permis : apres le troisieme, la defaite suivante renvoie
 * a l'etape 1 comme avant. Pour l'equilibrage, c'est la seule ligne a toucher.
 */
export const COUTS_CONTINUE = [10, 20, 40];

/**
 * Ce que rapporte une etape de carriere GAGNEE, dans l'ordre des six etapes :
 * tours 1 a 5, puis la finale ZEZE. 27 pieces pour une carriere complete,
 * 54 si le joueur regarde la pub du sacre (voir doublerCarriere).
 *
 * A CHAQUE VICTOIRE, PAS A LA PREMIERE SEULEMENT, et il faut gagner l'etape :
 * se qualifier ne suffit pas. Une etape ne paie qu'une fois par carriere
 * (reference `parcours:course:etape`).
 *
 * POURQUOI SI PEU (decision du 14/11/2026). Les pieces et la pub rachetent
 * la meme chose : une defaite. Un bareme genereux (75 par carriere) payait
 * sept Continue d'un coup et dispensait les bons joueurs de toute pub. Ici une
 * carriere paie a peu pres un Continue, et la pub du sacre en double le gain :
 * la pub y gagne une vue au lieu d'en perdre.
 */
export const GAINS_CARRIERE = [1, 1, 2, 3, 5, 15];

/**
 * Plafond quotidien, par joueur (jour UTC), des pieces de carriere — et, a
 * part, autant pour leur doublement par la pub.
 *
 * La victoire est declaree par le jeu, la pub regardee aussi, et un
 * identifiant de carriere se tire a volonte : le plafond borne ce qu'on
 * gagnerait a les inventer. 50, c'est un peu moins de deux carrieres.
 */
export const PLAFOND_CARRIERE_PAR_JOUR = 50;

/**
 * Plafond quotidien des pieces de duel, par joueur (jour UTC).
 *
 * Les chronos d'un duel sont declares par les clients, et un defi se cree
 * sous n'importe quel nom : sans plafond, un joueur qui se lance des defis
 * lents depuis un second nom se fabrique des pieces a volonte. Le plafond ne
 * l'empeche pas, il le borne. Les objectifs et les titres n'en ont pas
 * besoin : le serveur en fixe lui-meme le nombre.
 */
export const PLAFOND_DUELS_PAR_JOUR = 20;

const piecesReady = new WeakSet();

export async function ensurePieces(db) {
  if (piecesReady.has(db)) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS pieces_mouvements (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name_key TEXT NOT NULL,
       motif TEXT NOT NULL,
       ref TEXT NOT NULL,
       montant INTEGER NOT NULL,
       cree_le INTEGER NOT NULL,
       UNIQUE (name_key, motif, ref)
     )`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS pieces_par_joueur
       ON pieces_mouvements (name_key, motif, cree_le)`
  ).run();
  piecesReady.add(db);
}

const cleDe = nom => String(nom || '').trim().toLowerCase();

/** Le solde d'un joueur : la somme de ses mouvements. */
export async function soldeDe(db, nameKey) {
  await ensurePieces(db);
  const r = await db.prepare(
    `SELECT COALESCE(SUM(montant), 0) AS solde FROM pieces_mouvements WHERE name_key = ?`
  ).bind(nameKey).first();
  return (r && r.solde) || 0;
}

/**
 * Credite `montant` pieces a un joueur, une seule fois pour (motif, ref).
 *
 * `test` dit si `db` est la base du canal de test (voir OUVERT_EN_PRODUCTION).
 *
 * `deviceId`, quand on l'a, exige en plus que cet appareil soit lie au nom :
 * c'est le cas des duels fantomes, ou le nom vient du corps de la requete
 * sans controle. Sans lui, il suffit que le nom soit reserve.
 *
 * Rend le nombre de pieces reellement creditees (0 si deja fait, nom libre,
 * plafond atteint ou erreur).
 */
export async function crediter(db, nom, motif, ref, montant, { deviceId = null, test = false } = {}) {
  try {
    if (!piecesOuvertes(test)) return 0;
    const nameKey = cleDe(nom);
    if (!nameKey || !ref || !(montant > 0)) return 0;
    await ensurePieces(db);
    const maintenant = Date.now();

    // Les plafonds se lisent AVANT d'ecrire : depasse d'une piece par deux
    // courses simultanees, il resterait un plafond.
    const plafond = motif === 'duel' ? PLAFOND_DUELS_PAR_JOUR
      : (motif === 'carriere' || motif === 'carriere_x2') ? PLAFOND_CARRIERE_PAR_JOUR : null;
    if (plafond != null) {
      const minuit = new Date(maintenant); minuit.setUTCHours(0, 0, 0, 0);
      const r = await db.prepare(
        `SELECT COALESCE(SUM(montant), 0) AS n FROM pieces_mouvements
          WHERE name_key = ? AND motif = ? AND cree_le >= ?`
      ).bind(nameKey, motif, minuit.getTime()).first();
      const deja = (r && r.n) || 0;
      if (deja >= plafond) return 0;
      // Le dernier gain du jour paie ce qui reste sous le plafond, pas plus.
      montant = Math.min(montant, plafond - deja);
    }

    const condition = deviceId
      ? `EXISTS (SELECT 1 FROM player_devices WHERE name_key = ? AND device_id = ?)`
      : `EXISTS (SELECT 1 FROM players WHERE name_key = ?)`;
    const res = await db.prepare(
      `INSERT OR IGNORE INTO pieces_mouvements (name_key, motif, ref, montant, cree_le)
       SELECT ?, ?, ?, ?, ? WHERE ${condition}`
    ).bind(nameKey, motif, String(ref), Math.round(montant), maintenant,
           ...(deviceId ? [nameKey, deviceId] : [nameKey])).run();
    return res && res.meta && res.meta.changes === 1 ? Math.round(montant) : 0;
  } catch (e) {
    return 0;
  }
}

/** Le motif et le montant d'un titre, selon l'echelon de l'edition. */
export function creditDuTitre(echelon) {
  const motif = 'titre_' + echelon;
  return BAREME[motif] ? { motif, montant: BAREME[motif] } : null;
}

/** Ce que rapporte l'etape `etape` (0 a 5) gagnee, ou null si elle n'existe pas. */
export function gainDeLEtape(etape) {
  return Number.isInteger(etape) && etape >= 0 && etape < GAINS_CARRIERE.length
    ? GAINS_CARRIERE[etape] : null;
}

/**
 * LE DOUBLEMENT PAR LA PUB, au sacre d'une carriere : credite une seconde
 * fois ce que les six etapes de CETTE carriere ont reellement rapporte (lu
 * dans le journal, jamais dans la requete). Une fois par carriere.
 *
 * Exige que la finale ait paye : sans ligne pour l'etape ZEZE, la carriere
 * n'est pas gagnee (ou le plafond du jour etait deja atteint, et il n'y a
 * rien a doubler).
 *
 * Rend { ok, credite } ; `raison` dit pourquoi rien n'a ete credite.
 */
export async function doublerCarriere(db, nom, parcours, course, { deviceId = null, test = false } = {}) {
  const nameKey = cleDe(nom);
  if (!nameKey) return { ok: false, raison: 'nom', credite: 0 };
  await ensurePieces(db);
  const refs = GAINS_CARRIERE.map((_, e) => `${parcours}:${course}:${e}`);
  const r = await db.prepare(
    `SELECT COALESCE(SUM(montant), 0) AS total,
            SUM(CASE WHEN ref = ? THEN 1 ELSE 0 END) AS finale
       FROM pieces_mouvements
      WHERE name_key = ? AND motif = 'carriere' AND ref IN (${refs.map(() => '?').join(',')})`
  ).bind(refs[refs.length - 1], nameKey, ...refs).first();
  if (!r || !r.finale) return { ok: false, raison: 'inachevee', credite: 0 };
  const credite = await crediter(db, nameKey, 'carriere_x2', `${parcours}:${course}`, r.total, { deviceId, test });
  return { ok: true, credite };
}

/** Combien de Continue cette carriere a deja achetes. */
async function continuesDe(db, nameKey, parcours) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM pieces_mouvements
      WHERE name_key = ? AND motif = 'continue' AND ref LIKE ?`
  ).bind(nameKey, parcours + ':%').first();
  return (r && r.n) || 0;
}

/** Ce que coute le prochain Continue de cette carriere, ou null s'il n'y en a plus. */
export function coutDuContinue(essai) {
  return essai >= 0 && essai < COUTS_CONTINUE.length ? COUTS_CONTINUE[essai] : null;
}

/**
 * Acheter un Continue.
 *
 * `parcours` identifie la carriere en cours (tire par le jeu a chaque
 * depart), `essai` est le nombre de Continue que le jeu croit deja avoir
 * achetes pour elle. Les deux ensemble font la reference du debit :
 *
 *   - le jeu renvoie la meme demande apres une coupure → la ligne existe
 *     deja, on rend `ok` sans debiter une seconde fois ;
 *   - le jeu et le serveur ne sont pas d'accord sur le compte → refus, le
 *     jeu se recale sur `essai` rendu.
 *
 * LE DEBIT EST UNE SEULE INSTRUCTION. Le solde est verifie DANS l'INSERT :
 * deux achats simultanes ne peuvent pas passer tous les deux sur un solde
 * qui n'en paie qu'un.
 */
export async function acheterContinue(db, nameKey, parcours, essai) {
  await ensurePieces(db);
  const ref = `${parcours}:${essai}`;
  const deja = await db.prepare(
    `SELECT montant FROM pieces_mouvements
      WHERE name_key = ? AND motif = 'continue' AND ref = ?`
  ).bind(nameKey, ref).first();
  if (deja) {
    return { ok: true, deja: true, cout: -deja.montant, solde: await soldeDe(db, nameKey) };
  }
  const n = await continuesDe(db, nameKey, parcours);
  if (n !== essai) return { ok: false, raison: 'desaccord', essai: n, solde: await soldeDe(db, nameKey) };
  const cout = coutDuContinue(essai);
  if (cout == null) return { ok: false, raison: 'epuise', solde: await soldeDe(db, nameKey) };

  const res = await db.prepare(
    `INSERT OR IGNORE INTO pieces_mouvements (name_key, motif, ref, montant, cree_le)
     SELECT ?, 'continue', ?, ?, ?
      WHERE (SELECT COALESCE(SUM(montant), 0) FROM pieces_mouvements WHERE name_key = ?) >= ?`
  ).bind(nameKey, ref, -cout, Date.now(), nameKey, cout).run();
  const solde = await soldeDe(db, nameKey);
  if (!res || !res.meta || res.meta.changes !== 1) {
    // Rien d'ecrit : solde trop bas, OU la meme demande, partie deux fois,
    // vient de passer par l'autre requete. Le second cas est un succes.
    const passe = await db.prepare(
      `SELECT 1 AS ok FROM pieces_mouvements
        WHERE name_key = ? AND motif = 'continue' AND ref = ?`
    ).bind(nameKey, ref).first();
    if (passe) return { ok: true, deja: true, cout, solde };
    return { ok: false, raison: 'solde', cout, solde };
  }
  return { ok: true, cout, solde };
}
