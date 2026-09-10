/* ---------------------------------------------------------------------------
   CLASSEMENT DES DUELS
   ---------------------------------------------------------------------------
   Partage par les deux facons de se defier : le defi differe, ou l'un pose son
   chrono et l'autre le rejoue en fantome ; et la course en direct, ou les deux
   partent ensemble. Ce sont deux experiences tres differentes, mais un seul
   classement — donc un seul endroit ou les points se decident, sinon les deux
   modes finiraient par ne plus compter pareil.

   UN CLASSEMENT PAR DISCIPLINE, et c'est la seule chose que ce fichier tienne
   a dire deux fois. Le niveau n'est pas une propriete du joueur, c'est une
   propriete du couple joueur-discipline : etre regional sur 100 m ne dit rien
   de ce qu'on vaut sur 400 m. Un classement unique melangeait les trois et
   annoncait la meme division partout — un sprinter pur y montait grace a ses
   100 m et se retrouvait presente « national » sur un tour de piste qu'il
   n'avait jamais couru. La cle de rangement est donc (nom, discipline), et
   `epreuves.js` dit ce qu'est une discipline.
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
import {
  cleDiscipline, epreuvesDeDiscipline, estDiscipline, DISCIPLINE_DEFAUT,
} from './epreuves.js';
export { ETAGES, DIVISIONS, LEGENDE, LP_PAR_PALIER, LP, rangDe } from './classement.js';
export {
  cleDiscipline, epreuvesDeDiscipline, estDiscipline, DISCIPLINE_DEFAUT,
  DISCIPLINES_SIMPLES,
} from './epreuves.js';

/**
 * La discipline d'une rencontre, quelle que soit la facon dont on la nomme.
 *
 * Deux appelants, deux vocabulaires : le defi et la salle connaissent leurs
 * EPREUVES (`['100', '200']`), le recalcul relit une DISCIPLINE deja rangee en
 * base (`'100+200'`). Les deux passent ici plutot que chacun chez soi — une
 * cle fabriquee a deux endroits est une cle qui divergera, et deux classements
 * jumeaux ne se rejoignent jamais.
 */
function disciplineDe(r) {
  if (r && r.epreuves != null) return cleDiscipline(r.epreuves);
  if (r && r.epreuve != null) return cleDiscipline(epreuvesDeDiscipline(r.epreuve));
  return DISCIPLINE_DEFAUT;
}

/** La discipline demandee, ou celle par defaut si elle n'existe pas. */
export function disciplineValide(cle) {
  return estDiscipline(cle) ? String(cle) : DISCIPLINE_DEFAUT;
}

// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const duelReady = new WeakSet();

/**
 * LE PASSAGE AU CLASSEMENT PAR DISCIPLINE.
 *
 * L'ancienne table tenait une ligne par joueur : un palier, des points, et un
 * bilan pour toutes les distances confondues. La nouvelle en tient une par
 * joueur ET PAR DISCIPLINE, ce qui change sa cle primaire — donc la table
 * elle-meme, SQLite ne sachant pas la retoucher en place.
 *
 * On ne convertit pas l'ancienne, on la met de cote et on REJOUE. Convertir
 * demanderait de repartir un palier unique sur trois echelles, c'est-a-dire
 * d'inventer trois niveaux a partir d'un seul : le sprinter serait declare
 * national sur 400 m sans y avoir couru, exactement le defaut qu'on repare.
 * L'historique, lui, sait sur quoi chaque duel s'est joue — c'est de lui que
 * les trois echelles se deduisent, et de rien d'autre.
 *
 * L'ancienne table reste en place sous un autre nom. Elle ne sert plus a rien,
 * et c'est voulu : une migration qui efface son point de depart ne se verifie
 * pas apres coup.
 */
const NOM_TABLE_AVANT = 'duel_players_avant_disciplines';

async function migrerVersDisciplines(db) {
  try {
    await db.prepare(`SELECT epreuve FROM duel_players LIMIT 1`).first();
    return false;                       // deja rangee par discipline
  } catch { /* colonne absente, ou table absente : on regarde laquelle */ }
  try {
    await db.prepare(`SELECT name_key FROM duel_players LIMIT 1`).first();
  } catch {
    return false;                       // base neuve : il n'y a rien a reprendre
  }
  try {
    await db.prepare(`ALTER TABLE duel_players RENAME TO ${NOM_TABLE_AVANT}`).run();
  } catch {
    // Une autre requete a migre pendant qu'on lisait. C'est elle qui rejouera
    // l'historique ; on la laisse faire plutot que de le rejouer deux fois.
    return false;
  }
  return true;
}

export async function ensureDuelTables(db) {
  if (duelReady.has(db)) return;
  const aMigre = await migrerVersDisciplines(db);
  await db.batch([
    // La cle est le couple (joueur, discipline) : un joueur y a autant de
    // lignes que de distances sur lesquelles il s'est battu, et aucune tant
    // qu'il ne s'est battu nulle part.
    db.prepare(`CREATE TABLE IF NOT EXISTS duel_players (
      name_key TEXT NOT NULL,
      epreuve TEXT NOT NULL DEFAULT '${DISCIPLINE_DEFAUT}',
      name TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      launched INTEGER NOT NULL DEFAULT 0,
      received INTEGER NOT NULL DEFAULT 0,
      mmr INTEGER NOT NULL DEFAULT ${MMR_DEPART},
      lp INTEGER NOT NULL DEFAULT 0,
      palier INTEGER NOT NULL DEFAULT 0,
      bouclier INTEGER NOT NULL DEFAULT 0,
      last_delta INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (name_key, epreuve)
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
    // Un classement se lit par discipline : sans cet index, chaque lecture
    // parcourt les lignes des sept classements pour en garder un.
    db.prepare(`CREATE INDEX IF NOT EXISTS duel_players_epreuve
                  ON duel_players (epreuve, palier DESC, lp DESC)`),
  ]);
  // Colonnes arrivees apres coup : la table existe deja chez ceux qui
  // jouaient avant, d'ou les ajouts tolerants.
  for (const sql of [
    // Le nom lisible de celui qui a releve. La cle est en minuscules et sert
    // a dedoublonner ; c'est ce nom-ci qu'on montre au lanceur.
    `ALTER TABLE duel_results ADD COLUMN opponent_name TEXT`,
    // Celui qui lance apprend le resultat en revenant au jeu, une seule fois.
    `ALTER TABLE duel_results ADD COLUMN seen_by_challenger INTEGER NOT NULL DEFAULT 0`,
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
    // SUR QUOI la rencontre s'est jouee, donc quel classement elle deplace.
    // Sans valeur par defaut, volontairement : une rencontre d'avant les
    // disciplines doit se reconnaitre a son absence, pour que le recalcul
    // aille la chercher dans le defi plutot que de la ranger au 100 m sans
    // regarder.
    `ALTER TABLE duel_results ADD COLUMN epreuve TEXT`,
  ]) {
    try { await db.prepare(sql).run(); } catch (e) { /* colonne deja presente */ }
  }
  duelReady.add(db);

  // La table est prete : l'historique peut la remplir.
  //
  // Le rattrapage vaut aussi quand la migration s'est deja jouee : la colonne
  // `epreuve` existe alors, et rien ne la redeclencherait. Or un rejeu peut
  // echouer — une base indisponible une seconde de trop — et le classement
  // resterait vide pour toujours sans que personne ne sache pourquoi. Un
  // classement vide avec un historique derriere lui n'a qu'une seule reponse
  // juste, et c'est celle-la : rejouer.
  if (aMigre || await aRejouer(db)) {
    // Un echec ne doit pas emporter la requete qui passait par la. Le duel du
    // moment s'inscrit sur un classement encore vide, l'historique le garde,
    // et le prochain demarrage rejouera — ce qui remettra tout en place, ce
    // duel-la compris. Refuser la course aurait perdu la seule chose qui ne se
    // rattrape pas.
    try { await recalculerClassement(db); } catch (e) { /* au prochain reveil */ }
  }
}

/** Le classement est-il vide alors que des rencontres l'attendent ? */
async function aRejouer(db) {
  try {
    const range = await db.prepare(`SELECT 1 AS n FROM duel_players LIMIT 1`).first();
    if (range) return false;
    const joue = await db.prepare(`SELECT 1 AS n FROM duel_results LIMIT 1`).first();
    return !!joue;
  } catch {
    return false;
  }
}

export async function touchDuelPlayer(db, key, name, epreuve = DISCIPLINE_DEFAUT) {
  await db.prepare(
    `INSERT INTO duel_players (name_key, epreuve, name, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name_key, epreuve) DO UPDATE SET name = excluded.name`
  ).bind(key, disciplineValide(epreuve), name, Date.now()).run();
}

/**
 * L'ordre du classement, en SQL, ecrit une seule fois.
 *
 * Deux endroits le lisent : le classement qu'on affiche, juste en dessous, et
 * la selection d'un championnat. Qu'ils soient rigoureusement identiques n'est
 * pas une commodite de relecture, c'est ce qui rend la selection verifiable :
 * un joueur doit pouvoir compter les lignes au-dessus de lui et en deduire
 * s'il est pris. Deux tris qui se ressemblent finiraient par se contredire un
 * jour — il suffit d'ajouter un critere d'un cote — et ce jour-la la barre
 * affichee dans le classement mentirait sans que personne ne s'en apercoive.
 *
 * `prefixe` sert la lecture des championnats, qui joint deux tables et doit
 * donc qualifier ses colonnes. C'est le seul degre de liberte : les criteres
 * et leur ordre, eux, ne se parametrent pas.
 */
export const ordreClassement = (prefixe = '') =>
  ['palier DESC', 'lp DESC', 'mmr DESC', 'wins DESC', 'name ASC']
    .map(c => prefixe + c).join(', ');

/**
 * Le classement d'UNE discipline, ordonne. Y figure quiconque a joue au moins
 * un duel sur cette distance — lance ou releve, peu importe. Un joueur qui a
 * seulement envoye un defi que personne n'a encore releve n'a pas de duel
 * derriere lui : il attend son tour plutot que d'occuper une ligne vide.
 *
 * Le 100 m par defaut : c'est la distance du jeu quand rien ne dit laquelle,
 * celle du defaut du one shot comme celle d'un championnat sans epreuve.
 *
 * L'ordre suit l'echelle visible, et elle seule : palier, puis points de
 * ligue. Le MMR ne sert qu'a departager deux joueurs a egalite parfaite — s'il
 * ordonnait le classement, l'echelle ne serait qu'une decoration posee sur un
 * nombre cache, et un joueur pourrait doubler quelqu'un de sa division sans
 * avoir gagne un seul point de plus que lui.
 */
export async function duelBoard(db, epreuve = DISCIPLINE_DEFAUT) {
  const ep = disciplineValide(epreuve);
  const { results } = await db.prepare(
    `SELECT name, mmr, lp, palier, wins, losses, draws, launched, received,
            last_delta
       FROM duel_players WHERE epreuve = ? AND wins + losses + draws > 0
      ORDER BY ${ordreClassement()} LIMIT 500`
  ).bind(ep).all();
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
    ...r, epreuve: ep, rank: i + 1, ...rangDe(r.palier),
  }));
}

/**
 * TOUTES les divisions d'un joueur, une par discipline ou il s'est battu.
 *
 * L'accueil n'a la place que d'un ecusson, et depuis que les niveaux ne sont
 * plus partages il faut bien dire lequel : le premier de cette liste est le
 * plus haut, et il voyage avec sa distance. Sans cela l'accueil afficherait
 * « NATIONAL II » sans dire de quoi, ce qui est precisement le mensonge que le
 * classement par discipline supprime.
 *
 * Rien pour qui n'a jamais joue de duel : une liste vide, et l'ecran dit ce
 * qu'il disait deja a un joueur non classe.
 */
export async function mesDisciplines(db, key) {
  const cle = String(key || '').trim().toLowerCase();
  if (!cle) return [];
  const { results } = await db.prepare(
    `SELECT epreuve, lp, palier, wins, losses, draws
       FROM duel_players
      WHERE name_key = ? AND wins + losses + draws > 0
      ORDER BY palier DESC, lp DESC, epreuve ASC`
  ).bind(cle).all();
  return (results || []).map(r => ({
    epreuve: r.epreuve, lp: r.lp, wins: r.wins, losses: r.losses, draws: r.draws,
    ...rangDe(r.palier),
  }));
}

/**
 * Applique un duel au classement de sa discipline, une fois et une seule.
 *
 * `id` identifie la rencontre : le code du defi pour un duel differe, celui de
 * la salle pour une course en direct. La cle primaire de duel_results garantit
 * qu'un meme duel ne redistribue jamais deux fois — c'est ce qui permet a un
 * client de reenvoyer un resultat sans consequence.
 *
 * `challenger` est celui qui a lance : l'auteur du defi, ou l'hote de la
 * salle. `opponent` est celui qui a repondu. `epreuves` sont les distances
 * courues, et elles decident du classement touche.
 *
 * Renvoie l'issue et les points, ou `{ deja: true }` si la rencontre etait
 * deja tranchee.
 */
export async function appliquerDuel(db, r) {
  await ensureDuelTables(db);
  const luiKey = String(r.challengerName || '').trim().toLowerCase();
  const moiKey = String(r.opponentName || '').trim().toLowerCase();
  if (!luiKey || !moiKey || luiKey === moiKey) return null;
  const ep = disciplineDe(r);

  const deja = await db.prepare(
    `SELECT outcome FROM duel_results WHERE challenge_id = ? AND opponent_key = ?`
  ).bind(r.id, moiKey).first();
  if (deja) return { issue: deja.outcome, deja: true };

  const issue = r.opponentMs < r.challengerMs ? 'opponent'
              : r.opponentMs > r.challengerMs ? 'challenger' : 'draw';

  await db.prepare(
    `INSERT INTO duel_results (challenge_id, opponent_key, opponent_name,
       challenger_key, challenger_ms, opponent_ms, outcome, epreuve, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(r.id, moiKey, r.opponentName, luiKey,
         r.challengerMs, r.opponentMs, issue, ep, Date.now()).run();

  await touchDuelPlayer(db, luiKey, r.challengerName, ep);
  await touchDuelPlayer(db, moiKey, r.opponentName, ep);

  const bouge = await noterDuel(db, luiKey, moiKey, issue, ep, r.id);
  return { issue, epreuve: ep, ...bouge };
}

/** L'etat de classement d'un joueur SUR UNE DISCIPLINE, tel que le module de
 *  calcul l'attend. Un joueur qui n'y a jamais couru y est neuf : c'est le
 *  sens meme d'un classement par discipline. */
async function etatDe(db, key, epreuve) {
  const r = await db.prepare(
    `SELECT mmr, lp, palier, bouclier, wins, losses, draws
       FROM duel_players WHERE name_key = ? AND epreuve = ?`).bind(key, epreuve).first();
  return {
    mmr: r?.mmr ?? MMR_DEPART,
    lp: r?.lp ?? 0,
    palier: r?.palier ?? 0,
    bouclier: r?.bouclier ?? 0,
    // Le K depend de l'experience, et l'experience est le nombre de duels
    // TRANCHES. Les defis lances sans reponse n'apprennent rien sur personne.
    //
    // L'experience se compte DANS LA DISCIPLINE : cinquante 100 m ne disent
    // pas ou l'on se situe sur 400 m, et faire entrer quelqu'un a K faible sur
    // une distance qu'il decouvre le laisserait des mois au mauvais etage.
    duels: (r?.wins ?? 0) + (r?.losses ?? 0) + (r?.draws ?? 0),
  };
}

/**
 * Ecrit un duel dans les deux couches, sur le classement de sa discipline.
 *
 * Les deux joueurs sont lus AVANT d'ecrire l'un ou l'autre : la montee de
 * chacun depend du MMR de l'autre tel qu'il etait au coup de pistolet. Ecrire
 * le premier avant de lire le second ferait dependre le resultat de l'ordre
 * dans lequel on les traite, ce qui rendrait un recalcul non reproductible.
 */
async function noterDuel(db, luiKey, moiKey, issue, epreuve, id = null) {
  const ep = disciplineValide(epreuve);
  const [lanceur, releveur] = await Promise.all([
    etatDe(db, luiKey, ep), etatDe(db, moiKey, ep),
  ]);
  const apres = appliquerDuelAuClassement({ lanceur, releveur, issue });

  const maj = (key, x, w, l, d, recu) => db.prepare(
    `UPDATE duel_players SET mmr = ?, lp = ?, palier = ?, bouclier = ?,
       wins = wins + ?, losses = losses + ?, draws = draws + ?,
       received = received + ?, last_delta = ?, updated_at = ?
     WHERE name_key = ? AND epreuve = ?`
  ).bind(x.mmr, x.lp, x.palier, x.bouclier, w, l, d, recu,
         x.delta_lp, Date.now(), key, ep);

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
  // Le mouvement de division est rendu DES DEUX COTES. Un defi n'en montrait
  // qu'un — celui qui releve est le seul present a l'arrivee, l'autre
  // l'apprend plus tard par son annonce, ou son propre `rang` figure deja.
  // Une course en direct a les deux joueurs devant leur ecran en meme temps :
  // sans le second, l'hote promu par sa victoire ne l'apprenait pas.
  return {
    lp: apres.releveur.delta_lp, lp_adverse: apres.lanceur.delta_lp,
    rang: rangDe(apres.releveur.palier),
    rang_adverse: rangDe(apres.lanceur.palier),
    monte: apres.releveur.monte > 0, descend: apres.releveur.descend > 0,
    monte_adverse: apres.lanceur.monte > 0,
    descend_adverse: apres.lanceur.descend > 0,
  };
}

/* --------------------------------------------------------------- le recalcul */

/**
 * La cle d'une ligne en cours de reconstruction : un joueur, une discipline.
 *
 * Le separateur ne peut pas etre une espace : un nom en contient souvent une,
 * et « leo g. » sur 100 m se rangerait alors avec « leo » sur « g.+100 ». Un
 * caractere qu'aucun nom ne porte est le seul separateur qui ne melange rien.
 */
const SEP = '\u0000';
const cleLigne = (cle, epreuve) => cle + SEP + epreuve;

/** Une ligne de classement en cours de reconstruction. */
function etatNeuf(cle, nom, epreuve) {
  return {
    cle, epreuve, nom,
    mmr: MMR_DEPART, lp: 0, palier: 0, bouclier: 0,
    wins: 0, losses: 0, draws: 0, received: 0, last_delta: 0, updated_at: 0,
  };
}

/**
 * L'epreuve de chaque rencontre de l'historique, retrouvee.
 *
 * Trois cas, et un seul demande de chercher :
 *   - la rencontre porte sa discipline : elle a ete jouee depuis, on la croit ;
 *   - c'est un defi d'avant : le defi, lui, a toujours garde ses `races` ;
 *   - c'est une course en direct d'avant : la salle n'a rien laisse, et il n'y
 *     a rien a deduire. Le 100 m, faute de mieux, et il vaut mieux le dire ici
 *     que de laisser croire a une mesure.
 */
function epreuveDeLigne(d) {
  if (d.epreuve) return disciplineValide(d.epreuve);
  if (d.races) {
    try { return cleDiscipline(JSON.parse(d.races)); } catch { /* illisible */ }
  }
  return DISCIPLINE_DEFAUT;
}

/** Les rencontres, dans l'ordre ou elles se sont jouees, avec de quoi
 *  retrouver la discipline de celles d'avant les disciplines. */
async function historique(db) {
  const colonnes = `r.challenge_id AS id, r.challenger_key AS lui,
                    r.opponent_key AS moi, r.outcome AS issue, r.epreuve AS epreuve`;
  const ordre = `ORDER BY r.created_at ASC, r.rowid ASC`;
  try {
    const { results } = await db.prepare(
      `SELECT ${colonnes}, c.races AS races
         FROM duel_results r LEFT JOIN challenges c ON c.id = r.challenge_id
        ${ordre}`).all();
    return results || [];
  } catch {
    // Base sans table de defis : elle n'a alors que des courses en direct, et
    // la jointure n'aurait rien appris de plus.
    const { results } = await db.prepare(
      `SELECT ${colonnes} FROM duel_results r ${ordre}`).all();
    return results || [];
  }
}

/** Les defis lances, comptes par discipline, tels que la table des defis les
 *  garde. Le compteur se refait ainsi de sa source plutot que de survivre a
 *  cote de lui — un compteur qu'un recalcul ne sait pas refaire est un
 *  compteur qui derive. Nul quand la table n'existe pas. */
async function lancesParDiscipline(db) {
  try {
    const { results } = await db.prepare(
      `SELECT owner_name AS nom, races FROM challenges`).all();
    const n = new Map();
    for (const c of results || []) {
      const cle = String(c.nom || '').trim().toLowerCase();
      if (!cle) continue;
      let ep = DISCIPLINE_DEFAUT;
      try { ep = cleDiscipline(JSON.parse(c.races || '[]')); } catch { /* illisible */ }
      const k = cleLigne(cle, ep);
      const deja = n.get(k);
      if (deja) deja.n += 1;
      else n.set(k, { cle, epreuve: ep, n: 1 });
    }
    return n;
  } catch {
    return null;
  }
}

/** Ecrit les lignes reconstruites, par paquets : une base ne veut pas de mille
 *  instructions dans un seul lot, et mille allers-retours coutent une minute. */
async function ecrireParPaquets(db, instructions, taille = 50) {
  for (let i = 0; i < instructions.length; i += taille) {
    await db.batch(instructions.slice(i, i + taille));
  }
}

/**
 * Rejoue tout l'historique et refait les classements a partir de rien.
 *
 * Rejouable autant de fois qu'on veut : on repart de zero avant de
 * recommencer, si bien que deux executions de suite donnent les memes
 * classements. C'est ce qui permet de changer un bareme ou un facteur K sans
 * se demander ce que devient l'existant — on le refait. C'est aussi ce qui a
 * permis de passer au classement par discipline sans inventer de niveau a
 * personne : l'historique sait sur quoi chaque duel s'est joue.
 *
 * L'ordre est celui des duels reels, du plus ancien au plus recent, et il
 * compte : le MMR de chacun au moment d'un duel depend de tous ceux d'avant.
 * Rejouer dans le desordre donnerait un classement different, et faux.
 *
 * Tout se calcule EN MEMOIRE avant d'ecrire. La version d'avant relisait les
 * deux joueurs en base a chaque rencontre : c'etait trois allers-retours par
 * duel, et un recalcul de quelques milliers de duels ne tenait plus dans une
 * requete. Les regles, elles, sont les memes — `appliquerDuelAuClassement` ne
 * sait toujours pas ce qu'est une base de donnees.
 */
export async function recalculerClassement(db) {
  await ensureDuelTables(db);

  const lignes = await historique(db);
  const noms = await nomsConnus(db);
  const etats = new Map();
  const etat = (cle, ep) => {
    const k = cleLigne(cle, ep);
    let e = etats.get(k);
    if (!e) { e = etatNeuf(cle, noms.get(cle) || cle, ep); etats.set(k, e); }
    return e;
  };

  const surRencontre = [];       // ce que chaque duel a rapporte, reinscrit
  const surEpreuve = [];         // la discipline retrouvee, rangee pour de bon
  const maintenant = Date.now();
  let joues = 0;

  for (const d of lignes) {
    if (!d.lui || !d.moi) continue;
    const ep = epreuveDeLigne(d);
    if (!d.epreuve) {
      surEpreuve.push(db.prepare(
        `UPDATE duel_results SET epreuve = ?
          WHERE challenge_id = ? AND opponent_key = ?`).bind(ep, d.id, d.moi));
    }

    const lanceur = etat(d.lui, ep), releveur = etat(d.moi, ep);
    const apres = appliquerDuelAuClassement({
      lanceur: { ...lanceur, duels: lanceur.wins + lanceur.losses + lanceur.draws },
      releveur: { ...releveur, duels: releveur.wins + releveur.losses + releveur.draws },
      issue: d.issue,
    });

    Object.assign(lanceur, {
      mmr: apres.lanceur.mmr, lp: apres.lanceur.lp,
      palier: apres.lanceur.palier, bouclier: apres.lanceur.bouclier,
      last_delta: apres.lanceur.delta_lp, updated_at: maintenant,
      wins: lanceur.wins + (d.issue === 'challenger' ? 1 : 0),
      losses: lanceur.losses + (d.issue === 'opponent' ? 1 : 0),
      draws: lanceur.draws + (d.issue === 'draw' ? 1 : 0),
    });
    Object.assign(releveur, {
      mmr: apres.releveur.mmr, lp: apres.releveur.lp,
      palier: apres.releveur.palier, bouclier: apres.releveur.bouclier,
      last_delta: apres.releveur.delta_lp, updated_at: maintenant,
      wins: releveur.wins + (d.issue === 'opponent' ? 1 : 0),
      losses: releveur.losses + (d.issue === 'challenger' ? 1 : 0),
      draws: releveur.draws + (d.issue === 'draw' ? 1 : 0),
      received: releveur.received + 1,
    });

    // Les mouvements inscrits sur chaque rencontre sont refaits aussi : sans
    // cela, un joueur revenant apres un recalcul lirait un gain qui n'a plus
    // de rapport avec le classement qu'il a sous les yeux.
    surRencontre.push(db.prepare(
      `UPDATE duel_results SET lp_challenger = ?, lp_opponent = ?
        WHERE challenge_id = ? AND opponent_key = ?`
    ).bind(apres.lanceur.delta_lp, apres.releveur.delta_lp, d.id, d.moi));
    joues++;
  }

  const lances = await lancesParDiscipline(db);

  // On efface avant d'ecrire : un joueur dont toutes les rencontres ont disparu
  // de l'historique ne doit pas garder une ligne que plus rien ne justifie.
  // `launched` se refait de la table des defis, ou se garde tel quel quand
  // elle manque — d'ou la lecture des compteurs avant l'effacement.
  const anciensLances = lances ? null : await compteursLances(db);
  await db.prepare(`DELETE FROM duel_players`).run();

  const ecritures = [];
  for (const e of etats.values()) {
    const k = cleLigne(e.cle, e.epreuve);
    const l = lances ? ((lances.get(k) || {}).n || 0) : (anciensLances.get(k) || 0);
    ecritures.push(db.prepare(
      `INSERT INTO duel_players (name_key, epreuve, name, mmr, lp, palier, bouclier,
         wins, losses, draws, launched, received, last_delta, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.cle, e.epreuve, e.nom, e.mmr, e.lp, e.palier, e.bouclier,
           e.wins, e.losses, e.draws, l, e.received, e.last_delta, e.updated_at));
  }
  // Un defi lance sans reponse ne fait pas entrer au classement — le lanceur
  // n'a pas de duel derriere lui — mais son compteur l'attend le jour ou
  // quelqu'un relevera. On garde donc la ligne, sans bilan.
  if (lances) {
    for (const [k, l] of lances) {
      if (etats.has(k)) continue;
      ecritures.push(db.prepare(
        `INSERT INTO duel_players (name_key, epreuve, name, launched, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(l.cle, l.epreuve, noms.get(l.cle) || l.cle, l.n, maintenant));
    }
  }

  await ecrireParPaquets(db, ecritures);
  await ecrireParPaquets(db, surRencontre);
  await ecrireParPaquets(db, surEpreuve);
  return { duels: joues, joueurs: etats.size };
}

/** Le nom lisible de chacun, tel qu'il s'ecrit. La cle est en minuscules et ne
 *  se montre pas ; on relit donc les noms deja ranges avant d'effacer, et les
 *  defis completent ceux que l'effacement ferait perdre. */
async function nomsConnus(db) {
  const noms = new Map();
  const ajouter = (nom) => {
    const n = String(nom || '').trim();
    const cle = n.toLowerCase();
    if (cle && !noms.has(cle)) noms.set(cle, n);
  };
  const { results } = await db.prepare(`SELECT name FROM duel_players`).all();
  for (const r of results || []) ajouter(r.name);
  try {
    // La table d'avant les disciplines, quand elle est encore la. Elle ne sert
    // plus a classer, mais elle sait ecrire les noms : une course en direct ne
    // laisse que des cles en minuscules, et sans elle un joueur connu par ses
    // seules courses en direct verrait son pseudo passer en bas de casse.
    const avant = await db.prepare(`SELECT name FROM ${NOM_TABLE_AVANT}`).all();
    for (const r of avant.results || []) ajouter(r.name);
  } catch { /* migration deja oubliee, ou base neuve */ }
  try {
    const defis = await db.prepare(`SELECT owner_name FROM challenges`).all();
    for (const r of defis.results || []) ajouter(r.owner_name);
  } catch { /* pas de defis sur cette base */ }
  const rencontres = await db.prepare(
    `SELECT opponent_key, opponent_name FROM duel_results`).all();
  for (const r of rencontres.results || []) {
    ajouter(r.opponent_name || r.opponent_key);
  }
  return noms;
}

/** Les compteurs de defis lances deja ranges, pour ne pas les perdre quand la
 *  table des defis, elle, a disparu. */
async function compteursLances(db) {
  const n = new Map();
  const { results } = await db.prepare(
    `SELECT name_key, epreuve, launched FROM duel_players WHERE launched > 0`).all();
  for (const r of results || []) n.set(cleLigne(r.name_key, r.epreuve), r.launched);
  return n;
}

/** Compte un defi lance, sur la discipline du defi : sert au compteur, pas aux
 *  points. */
export async function compterLance(db, key, name, epreuves = null) {
  await ensureDuelTables(db);
  const ep = disciplineDe({ epreuves });
  await touchDuelPlayer(db, key, name, ep);
  await db.prepare(
    `UPDATE duel_players SET launched = launched + 1, updated_at = ?
      WHERE name_key = ? AND epreuve = ?`
  ).bind(Date.now(), key, ep).run();
}
