/**
 * LES PIECES — le porte-monnaie du joueur, tenu par le serveur.
 *
 * On gagne des pieces en gagnant des duels, en reussissant l'Objectif du
 * jour et en remportant un titre de championnat ; on les depense pour un
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
 * CANAL DE TEST SEULEMENT, pour commencer (decision du 6 octobre 2026). Tant
 * que ce drapeau est faux, rien n'est credite dans la base de production et
 * les routes /pieces n'y repondent pas : un joueur de production ne voit
 * rien, et ne se retrouve pas a l'ouverture avec un solde amasse en silence.
 * Chaque appelant dit sur quelle base il ecrit (`test`) ; la base elle-meme
 * ne le dit pas, le cron passe sur les deux avec le meme code.
 */
export const OUVERT_EN_PRODUCTION = false;
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

    // Le plafond des duels se lit AVANT d'ecrire : depasse d'une piece par
    // deux courses simultanees, il resterait un plafond.
    if (motif === 'duel') {
      const minuit = new Date(maintenant); minuit.setUTCHours(0, 0, 0, 0);
      const r = await db.prepare(
        `SELECT COALESCE(SUM(montant), 0) AS n FROM pieces_mouvements
          WHERE name_key = ? AND motif = 'duel' AND cree_le >= ?`
      ).bind(nameKey, minuit.getTime()).first();
      if (r && r.n >= PLAFOND_DUELS_PAR_JOUR) return 0;
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
