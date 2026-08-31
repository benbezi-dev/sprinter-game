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
// Ce fichier tient la base ; les regles du classement vivent dans
// classement.js et n'en savent rien. La separation n'est pas cosmetique : le
// bareme, le MMR et les seuils de division sont les choses qu'on retouchera le
// plus souvent, et ce sont aussi celles dont une erreur ne se voit pas. Les
// avoir a part permet de les eprouver sans base de donnees.
//
// Un total unique a longtemps suffi. Il ne suffit plus a mille joueurs : un
// nombre qui recompense ne peut pas en meme temps estimer la force, parce que
// recompenser demande d'etre genereux avec celui qui prend un risque, et
// estimer demande de n'etre genereux avec personne.
import {
  appliquerDuelAuClassement, rangDe, MMR_DEPART,
} from './classement.js';
export { ETAGES, DIVISIONS, LEGENDE, LP_PAR_PALIER, LP, rangDe } from './classement.js';
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
    // Les deux couches. Le MMR estime la force et ne se montre jamais ; le
    // palier et les points de ligue sont ce que le joueur lit.
    `ALTER TABLE duel_players ADD COLUMN mmr INTEGER NOT NULL DEFAULT ${MMR_DEPART}`,
    `ALTER TABLE duel_players ADD COLUMN lp INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE duel_players ADD COLUMN palier INTEGER NOT NULL DEFAULT 0`,
    // Le sursis avant une descente, arme a chaque promotion.
    `ALTER TABLE duel_players ADD COLUMN bouclier INTEGER NOT NULL DEFAULT 0`,
    // Ce que le duel a rapporte a chacun, garde sur la rencontre elle-meme.
    // Le mouvement de points depend du MMR d'avant le duel : il n'est plus
    // recalculable apres coup, et celui qui a lance doit pourtant pouvoir
    // l'apprendre en revenant, parfois des jours plus tard.
    `ALTER TABLE duel_results ADD COLUMN lp_challenger INTEGER`,
    `ALTER TABLE duel_results ADD COLUMN lp_opponent INTEGER`,
    // Le mot du vainqueur : un texte court, ou sa voix encodee. La voix est
    // effacee des que le perdant a ferme la fenetre — voir mot.js.
    `ALTER TABLE duel_results ADD COLUMN mot TEXT`,
    `ALTER TABLE duel_results ADD COLUMN voix TEXT`,
    `ALTER TABLE duel_results ADD COLUMN voix_type TEXT`,
    // Le perdant a-t-il lu le mot ? Le pendant de seen_by_challenger, pour
    // celui qui a releve le defi : lui aussi doit apprendre quelque chose
    // apres coup, maintenant que le vainqueur peut lui parler.
    `ALTER TABLE duel_results ADD COLUMN seen_by_opponent INTEGER NOT NULL DEFAULT 0`,
    // Le mot a-t-il ete LU ? Distinct d'avoir vu le resultat, et il a fallu
    // les separer : le resultat d'un duel existe des la ligne d'arrivee de
    // celui qui releve, le mot du vainqueur arrive apres — le temps qu'il
    // apprenne sa victoire et qu'il parle. Le perdant qui avait deja referme
    // son annonce ne le recevait alors jamais : sa ligne etait « vue », et
    // rien ne la ramenait. Un drapeau a lui permet au mot de revenir seul,
    // sans dependre de l'ordre dans lequel les deux se sont produits.
    `ALTER TABLE duel_results ADD COLUMN mot_vu INTEGER NOT NULL DEFAULT 0`,
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
 * tour plutot que d'occuper une ligne vide.
 *
 * L'ordre suit l'echelle visible, et elle seule : palier, puis points de
 * ligue. Le MMR ne sert qu'a departager deux joueurs a egalite parfaite — s'il
 * ordonnait le classement, l'echelle ne serait qu'une decoration posee sur un
 * nombre cache, et un joueur pourrait doubler quelqu'un de sa division sans
 * avoir gagne un seul point de plus que lui.
 */
export async function duelBoard(db) {
  const { results } = await db.prepare(
    `SELECT name, mmr, lp, palier, wins, losses, draws, launched, received,
            prev_rank, last_delta
       FROM duel_players WHERE wins + losses + draws > 0
      ORDER BY palier DESC, lp DESC, mmr DESC, wins DESC, name ASC LIMIT 500`
  ).all();
  // Le mouvement n'est pas calcule ici : un rang fige cote serveur ne survit
  // pas au duel suivant, l'indicateur serait vide la plupart du temps. Le jeu
  // compare au classement qu'il a affiche la derniere fois, ce qui donne un
  // deplacement toujours parlant : « depuis ta derniere visite ».
  //
  // Le MMR, lui, ne sort pas d'ici. Le retirer de la reponse plutot que de le
  // cacher a l'ecran est la seule facon que ce soit vrai — sinon il reste
  // lisible dans les outils du navigateur, et toute la couche visible devient
  // un habillage qu'on peut retirer d'un clic droit.
  return (results || []).map(({ mmr, ...r }, i) => ({
    ...r, rank: i + 1, ...rangDe(r.palier),
  }));
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
 * `direct` dit que les deux ont couru au meme coup de pistolet. Le bareme s'en
 * sert pour ne pas facturer a l'hote d'une piste un avantage que personne n'a
 * eu — voir LP.direct dans classement.js. On ne le stocke pas : l'identifiant
 * de la rencontre le porte deja, et c'est ce qui permet a un recalcul de le
 * retrouver sur les lignes ecrites avant que ce parametre n'existe.
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

  const bouge = await noterDuel(db, luiKey, moiKey, issue, r.id, estDirect(r.id));
  return { issue, ...bouge };
}

/**
 * Cette rencontre s'est-elle jouee en direct ?
 *
 * La reponse est dans l'identifiant, et c'est un choix : le prefixe est pose
 * par la salle du direct depuis le premier jour, il vit donc deja sur toutes
 * les lignes deja ecrites. Une colonne aurait dit la meme chose pour les
 * nouvelles seulement, et un recalcul — qui refait tout l'historique avec les
 * regles du moment — aurait applique aux anciennes courses en direct un bareme
 * dont on vient justement de dire qu'il ne leur convient pas.
 */
function estDirect(id) {
  return /^LIVE-/.test(String(id || ''));
}

/** L'etat de classement d'un joueur, tel que le module de calcul l'attend. */
async function etatDe(db, key) {
  const r = await db.prepare(
    `SELECT mmr, lp, palier, bouclier, wins, losses, draws
       FROM duel_players WHERE name_key = ?`).bind(key).first();
  return {
    mmr: r?.mmr ?? MMR_DEPART,
    lp: r?.lp ?? 0,
    palier: r?.palier ?? 0,
    bouclier: r?.bouclier ?? 0,
    // Le K depend de l'experience, et l'experience est le nombre de duels
    // TRANCHES. Les defis lances sans reponse n'apprennent rien sur personne.
    duels: (r?.wins ?? 0) + (r?.losses ?? 0) + (r?.draws ?? 0),
  };
}

/**
 * Ecrit un duel dans les deux couches.
 *
 * Les deux joueurs sont lus AVANT d'ecrire l'un ou l'autre : la montee de
 * chacun depend du MMR de l'autre tel qu'il etait au coup de pistolet. Ecrire
 * le premier avant de lire le second ferait dependre le resultat de l'ordre
 * dans lequel on les traite, ce qui rendrait un recalcul non reproductible.
 */
async function noterDuel(db, luiKey, moiKey, issue, id = null, direct = false) {
  const [lanceur, releveur] = await Promise.all([etatDe(db, luiKey), etatDe(db, moiKey)]);
  const apres = appliquerDuelAuClassement({ lanceur, releveur, issue, direct });

  const maj = (key, x, w, l, d, recu) => db.prepare(
    `UPDATE duel_players SET mmr = ?, lp = ?, palier = ?, bouclier = ?,
       wins = wins + ?, losses = losses + ?, draws = draws + ?,
       received = received + ?, last_delta = ?, updated_at = ?
     WHERE name_key = ?`
  ).bind(x.mmr, x.lp, x.palier, x.bouclier, w, l, d, recu,
         x.delta_lp, Date.now(), key);

  const ecritures = [
    maj(luiKey, apres.lanceur,
        issue === 'challenger' ? 1 : 0, issue === 'opponent' ? 1 : 0,
        issue === 'draw' ? 1 : 0, 0),
    maj(moiKey, apres.releveur,
        issue === 'opponent' ? 1 : 0, issue === 'challenger' ? 1 : 0,
        issue === 'draw' ? 1 : 0, 1),
  ];
  if (id) {
    ecritures.push(db.prepare(
      `UPDATE duel_results SET lp_challenger = ?, lp_opponent = ?
        WHERE challenge_id = ? AND opponent_key = ?`
    ).bind(apres.lanceur.delta_lp, apres.releveur.delta_lp, id, moiKey));
  }
  await db.batch(ecritures);

  // Ce qui remonte au jeu est ce que le joueur peut voir : des points de
  // ligue et un rang. Le MMR reste ou il est.
  //
  // Les champs sans suffixe sont ceux du releveur, parce que c'est lui qui
  // lisait cette reponse : le defi differe se tranche sur SON telephone, le
  // lanceur etant parti depuis longtemps. La course en direct a change cela —
  // les deux sont la, et chacun veut son propre mouvement de points. D'ou les
  // champs « _adverse », qui existaient deja pour les points et manquaient
  // pour la promotion : sans eux, un hote promu ne l'apprenait pas.
  return {
    lp: apres.releveur.delta_lp, lp_adverse: apres.lanceur.delta_lp,
    rang: rangDe(apres.releveur.palier),
    rang_adverse: rangDe(apres.lanceur.palier),
    monte: apres.releveur.monte > 0, descend: apres.releveur.descend > 0,
    monte_adverse: apres.lanceur.monte > 0,
    descend_adverse: apres.lanceur.descend > 0,
  };
}

/**
 * Rejoue tout l'historique et refait les deux couches a partir de rien.
 *
 * Rejouable autant de fois qu'on veut : on remet chacun a son point de depart
 * avant de recommencer, si bien que deux executions de suite donnent le meme
 * classement. C'est ce qui permet de changer un bareme ou un facteur K sans se
 * demander ce que devient l'existant — on le refait.
 *
 * L'ordre est celui des duels reels, du plus ancien au plus recent, et il
 * compte : le MMR de chacun au moment d'un duel depend de tous ceux d'avant.
 * Rejouer dans le desordre donnerait un classement different, et faux.
 */
export async function recalculerClassement(db) {
  await ensureDuelTables(db);
  await db.prepare(
    `UPDATE duel_players SET mmr = ?, lp = 0, palier = 0, bouclier = 0,
       wins = 0, losses = 0, draws = 0, received = 0, last_delta = 0`
  ).bind(MMR_DEPART).run();

  const { results } = await db.prepare(
    `SELECT challenge_id, challenger_key, opponent_key, outcome FROM duel_results
      ORDER BY created_at ASC, rowid ASC`).all();

  let joues = 0;
  for (const d of results || []) {
    if (!d.challenger_key || !d.opponent_key) continue;
    // Les mouvements inscrits sur chaque rencontre sont refaits aussi : sans
    // cela, un joueur revenant apres un recalcul lirait un gain qui n'a plus
    // de rapport avec le classement qu'il a sous les yeux.
    //
    // Le bareme du direct se retrouve sur l'identifiant, et c'est tout
    // l'interet de l'y avoir laisse : les courses en direct d'avant ce
    // changement sont rejouees avec la regle d'aujourd'hui, comme le reste.
    await noterDuel(db, d.challenger_key, d.opponent_key, d.outcome, d.challenge_id,
                    estDirect(d.challenge_id));
    joues++;
  }
  return { duels: joues };
}

/** Compte un defi lance : sert au compteur, pas aux points. */
export async function compterLance(db, key, name) {
  await ensureDuelTables(db);
  await touchDuelPlayer(db, key, name);
  await db.prepare(
    `UPDATE duel_players SET launched = launched + 1, updated_at = ? WHERE name_key = ?`
  ).bind(Date.now(), key).run();
}
