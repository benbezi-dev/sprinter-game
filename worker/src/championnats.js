/* ---------------------------------------------------------------------------
   CHAMPIONNATS — persistance et cycle de vie
   ---------------------------------------------------------------------------
   Le moteur (championnats-moteur.js) sait qui passe ; ce fichier sait qui
   participe, quand, et ce qu'il advient du titre. Il ne contient aucune regle
   de qualification : elles vivent toutes a un seul endroit, et il vaut mieux
   que ce ne soit pas celui qui parle a la base.

   Une precision qui manquait a la specification et sans laquelle rien de tout
   ceci ne tient : le jeu ne savait pas de quel pays est un joueur. Cloudflare
   le donne sur chaque requete, gratuitement et sans rien demander a personne.
   On le note au passage, et le joueur peut le corriger — quelqu'un en voyage
   ou derriere un VPN ne doit pas changer de nationalite sportive.
--------------------------------------------------------------------------- */

import {
  FORMAT, ECHELONS, TITRE_MOIS, REPLI_PAYS_TROP_PETIT, CALENDRIER, MIN_DOFFICE,
  ANNONCES, EPREUVES, EPREUVE_DEFAUT, CLOTURE_JOURS_AVANT, SUIVANTS_GARDES,
} from './championnats-config.js';
import { serpentin, qualifier, podium, calendrier, ordonner } from './championnats-moteur.js';
// Les championnats lisent le classement des duels : sur une base neuve, cette
// table doit exister avant qu'on la joigne, sans quoi la requete echoue.
//
// `ordreClassement` vient de la meme place pour une raison de fond : la
// selection doit trier exactement comme le classement affiche, sinon la barre
// des trente-deux qu'on dessine a l'ecran ne designe pas les trente-deux
// qu'on selectionne. Une seule definition, deux lecteurs.
import { ensureDuelTables, ordreClassement } from './duels.js';

const JOUR = 24 * 3600 * 1000;

/** Le continent d'un pays. Table courte : on n'y met que ce qu'on utilise. */
const CONTINENTS = {
  EU: ['FR','BE','CH','DE','ES','IT','PT','GB','IE','NL','LU','AT','PL','SE','NO','DK','FI','GR','RO','HU','CZ','SK','BG','HR','RS','UA','RU','TR','AL','BA','MK','SI','LT','LV','EE','IS','MT','CY','MD','ME','MC','AD','SM','LI'],
  AF: ['MA','DZ','TN','LY','EG','SN','CI','ML','BF','NE','TD','CM','GA','CG','CD','AO','ZA','NG','GH','GN','BJ','TG','MR','KE','ET','TZ','UG','RW','BI','ZM','ZW','MZ','MG','MU','SO','SD','CF','GM','GW','SL','LR','CV','DJ','ER','BW','NA','LS','SZ','MW','ST','KM','SC','GQ'],
  AM: ['US','CA','MX','BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GT','CU','HT','DO','HN','NI','CR','PA','SV','JM','TT','GY','SR','BZ','BS','BB'],
  AS: ['CN','JP','KR','IN','ID','PK','BD','VN','TH','PH','MY','SG','MM','KH','LA','NP','LK','KZ','UZ','AZ','GE','AM','IL','SA','AE','QA','KW','BH','OM','JO','LB','SY','IQ','IR','YE','AF','MN','TW','HK','MO','BN','TJ','KG','TM','MV','BT'],
  OC: ['AU','NZ','FJ','PG','NC','PF','SB','VU','WS','TO','KI','FM','MH','PW','NR','TV'],
};
/**
 * Le nom des pays, avec la preposition qui va devant.
 *
 * « Champion de FR » ne veut rien dire, et « Champion de le Maroc » non plus :
 * le francais demande de France, du Maroc, des Etats-Unis, d'Espagne. Le titre
 * est tout l'objet de cette competition — il ne peut pas lire comme un champ de
 * base de donnees. On stocke donc la forme complete, article compris, plutot
 * que d'essayer de la deviner a partir du nom.
 */
const PAYS_NOMS = {
  FR: ['France', 'de France'],            BE: ['Belgique', 'de Belgique'],
  CH: ['Suisse', 'de Suisse'],            CA: ['Canada', 'du Canada'],
  DE: ['Allemagne', "d'Allemagne"],       ES: ['Espagne', "d'Espagne"],
  IT: ['Italie', "d'Italie"],             PT: ['Portugal', 'du Portugal'],
  GB: ['Royaume-Uni', 'du Royaume-Uni'],  IE: ['Irlande', "d'Irlande"],
  NL: ['Pays-Bas', 'des Pays-Bas'],       LU: ['Luxembourg', 'du Luxembourg'],
  US: ['États-Unis', 'des États-Unis'],   MX: ['Mexique', 'du Mexique'],
  BR: ['Brésil', 'du Brésil'],            AR: ['Argentine', "d'Argentine'"],
  MA: ['Maroc', 'du Maroc'],              DZ: ['Algérie', "d'Algérie"],
  TN: ['Tunisie', 'de Tunisie'],          SN: ['Sénégal', 'du Sénégal'],
  CI: ["Côte d'Ivoire", "de Côte d'Ivoire"], CM: ['Cameroun', 'du Cameroun'],
  ML: ['Mali', 'du Mali'],                CD: ['Congo', 'du Congo'],
  GA: ['Gabon', 'du Gabon'],              GN: ['Guinée', 'de Guinée'],
  BF: ['Burkina Faso', 'du Burkina Faso'],NE: ['Niger', 'du Niger'],
  TG: ['Togo', 'du Togo'],                BJ: ['Bénin', 'du Bénin'],
  ZA: ['Afrique du Sud', "d'Afrique du Sud"], NG: ['Nigeria', 'du Nigeria'],
  EG: ['Égypte', "d'Égypte"],             KE: ['Kenya', 'du Kenya'],
  JP: ['Japon', 'du Japon'],              CN: ['Chine', 'de Chine'],
  KR: ['Corée du Sud', 'de Corée du Sud'],IN: ['Inde', "d'Inde"],
  AU: ['Australie', "d'Australie"],       NZ: ['Nouvelle-Zélande', 'de Nouvelle-Zélande'],
  PL: ['Pologne', 'de Pologne'],          SE: ['Suède', 'de Suède'],
  NO: ['Norvège', 'de Norvège'],          DK: ['Danemark', 'du Danemark'],
  FI: ['Finlande', 'de Finlande'],        GR: ['Grèce', 'de Grèce'],
  TR: ['Turquie', 'de Turquie'],          RU: ['Russie', 'de Russie'],
  UA: ['Ukraine', "d'Ukraine"],           RO: ['Roumanie', 'de Roumanie'],
};

const CONTINENT_NOMS = {
  EU: ["Europe", "d'Europe"],       AF: ['Afrique', "d'Afrique"],
  AM: ['Amériques', 'des Amériques'], AS: ['Asie', "d'Asie"],
  OC: ['Océanie', "d'Océanie"],
};

/**
 * Les pays qu'on peut se choisir, nommes.
 *
 * Le jeu ne tient pas sa propre table : c'est le serveur qui sait nommer un
 * titre — « Champion du Maroc », pas « Champion de MA » — et deux tables du
 * meme fait auraient diverge a la premiere retouche. Elle sort donc d'ici, ou
 * elle vit deja, plutot que d'etre recopiee dans le jeu.
 *
 * Triee par nom, et non par code : c'est ainsi qu'on cherche le sien dans une
 * liste de cinquante.
 */
export function listeNations() {
  return Object.entries(PAYS_NOMS)
    .map(([code, [nom]]) => ({ code, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Le nom lisible d'une zone, et sa forme avec preposition. */
export function nomZone(zone, echelon) {
  const z = String(zone || '').toUpperCase();
  const table = echelon === 'continental' ? CONTINENT_NOMS : PAYS_NOMS;
  const e = table[z];
  return e ? { nom: e[0], avec: e[1] } : { nom: z, avec: 'de ' + z };
}

const PAYS_CONTINENT = {};
for (const [c, pays] of Object.entries(CONTINENTS)) for (const p of pays) PAYS_CONTINENT[p] = c;

export function continentDe(pays) {
  return PAYS_CONTINENT[String(pays || '').toUpperCase()] || null;
}

// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const pret = new WeakSet();
export async function ensureChampTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    // Le pays d'un joueur. `source` dit d'ou il vient : 'geo' quand c'est
    // Cloudflare qui l'a vu, 'choix' quand le joueur l'a corrige — et un choix
    // ne se fait jamais ecraser par une detection.
    db.prepare(`CREATE TABLE IF NOT EXISTS player_pays (
      name_key TEXT PRIMARY KEY,
      pays TEXT NOT NULL,
      continent TEXT,
      source TEXT NOT NULL,
      vu_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS player_pays_par_pays ON player_pays(pays)`),

    // Une edition : un championnat, un echelon, une zone, une epreuve, un
    // weekend.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_editions (
      id TEXT PRIMARY KEY,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      epreuve TEXT NOT NULL DEFAULT '${EPREUVE_DEFAUT}',
      debut INTEGER NOT NULL,
      cloture INTEGER,
      phase TEXT NOT NULL,
      etat TEXT NOT NULL,
      champion_key TEXT,
      champion_nom TEXT,
      cree_le INTEGER NOT NULL,
      fini_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_editions_zone
                  ON champ_editions(echelon, zone, debut)`),

    // Un partant, sa place dans la grille, et ou il en est.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_partants (
      edition TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      rang_duel INTEGER,
      phase TEXT NOT NULL,
      course INTEGER,
      sorti_en TEXT,
      PRIMARY KEY (edition, name_key)
    )`),

    // L'instantane de la cloture : le classement tel qu'il etait a la seconde
    // ou la selection a ferme, un peu au-dela de la barre.
    //
    // Cette table ne sert jamais a courir. Elle sert a repondre. Une selection
    // qu'on ne peut pas relire sera contestee, et « tu etais 34e » n'a de poids
    // que si l'on peut dire derriere qui, avec quels points, a quelle heure.
    //
    // On y range le palier et les points de ligue — les valeurs du critere —
    // et jamais le MMR. Le publier ici reviendrait a le publier tout court,
    // puisque cette table est faite pour etre montree a qui reclame.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_selection (
      edition TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      rang INTEGER NOT NULL,
      palier INTEGER,
      lp INTEGER,
      retenu INTEGER NOT NULL,
      PRIMARY KEY (edition, name_key)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_selection_ordre
                  ON champ_selection(edition, rang)`),

    // Un chrono couru dans une course d'une edition.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_resultats (
      edition TEXT NOT NULL,
      phase TEXT NOT NULL,
      course INTEGER NOT NULL,
      name_key TEXT NOT NULL,
      ms INTEGER,
      place INTEGER,
      voie TEXT,
      couru_le INTEGER NOT NULL,
      PRIMARY KEY (edition, phase, course, name_key)
    )`),

    // Les titres, avec leur date d'expiration : un champion le reste trois
    // mois, puis redevient un joueur comme les autres.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_titres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      libelle TEXT NOT NULL,
      edition TEXT NOT NULL,
      sacre_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_titres_porteur
                  ON champ_titres(name_key, expire_le)`),

    // Les medailles. Distinctes des titres : un titre ne va qu'au vainqueur,
    // une medaille va aux trois premiers. On garde les deux plutot que d'en
    // deriver l'une de l'autre, parce qu'elles ne durent pas pareil et ne
    // veulent pas dire la meme chose — « champion » est un statut, « medaille
    // de bronze au mondial » est un resultat.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_medailles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      place INTEGER NOT NULL,
      edition TEXT NOT NULL,
      obtenu_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_medailles_porteur
                  ON champ_medailles(name_key, expire_le)`),

    // Le fil des annonces. C'est la seule memoire de ce qui s'est passe en
    // direct, et elle sert trois choses d'un coup : la diffusion dans
    // l'application, les notifications, et le recapitulatif mondial. Les ecrire
    // une fois plutot que de les recalculer trois fois garantit que les trois
    // racontent la meme competition.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_annonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition TEXT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      type TEXT NOT NULL,
      titre TEXT NOT NULL,
      texte TEXT,
      donnees TEXT,
      au INTEGER NOT NULL,
      pousser INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_annonces_fil ON champ_annonces(id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_annonces_zone ON champ_annonces(zone, id)`),
  ]);

  // L'epreuve est arrivee apres la table. Hors du `batch` volontairement : un
  // ALTER sur une colonne deja presente echoue, et il emporterait avec lui
  // toute la creation des autres tables — le batch est atomique. Seul, il ne
  // coute qu'un try/catch, et c'est le meme motif que `ensureScoreGhost`.
  try {
    await db.prepare(
      `ALTER TABLE champ_editions ADD COLUMN epreuve TEXT NOT NULL DEFAULT '${EPREUVE_DEFAUT}'`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  // La cloture est arrivee apres la table elle aussi, et pour la meme raison
  // elle s'ajoute seule. Elle est nullable a dessein : les editions ouvertes
  // avant qu'elle existe n'ont jamais eu d'heure de cloture annoncee, et leur
  // en inventer une apres coup serait affirmer une chose qui n'a pas eu lieu.
  // `null` dit « celle-la n'a pas ete annoncee », ce qui est exact.
  try {
    await db.prepare(
      `ALTER TABLE champ_editions ADD COLUMN cloture INTEGER`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  // L'index sur la cloture vient APRES l'ALTER, et non dans le batch.
  //
  // L'y avoir mis a casse toute la creation au premier essai, et de la facon la
  // plus instructive : sur une base neuve le batch cree la table avec sa
  // colonne et l'index passe, mais sur une base existante la colonne n'arrive
  // qu'a l'ALTER, dix lignes plus bas — l'index echouait donc, et comme le
  // batch est atomique il emportait la creation de TOUTES les autres tables
  // avec lui. Un `CREATE INDEX` qui nomme une colonne ajoutee apres coup
  // appartient a l'apres-coup, pas au batch.
  //
  // Sans cet index, le cron relit toute la table toutes les cinq minutes.
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS champ_editions_echeance
                        ON champ_editions(etat, cloture)`).run();
  } catch (e) { /* la colonne manque encore : l'index attendra le prochain tour */ }

  pret.add(db);
}

/**
 * Ecrit une annonce dans le fil.
 *
 * `pousser` distingue ce qui merite de faire vibrer un telephone de ce qui
 * merite seulement d'apparaitre a l'ecran. La liste est en configuration
 * (`ANNONCES`) parce que c'est un reglage d'audience, pas une regle du sport :
 * trop de notifications et l'application se fait couper le son une fois pour
 * toutes, ce dont on ne revient pas.
 */
export async function annoncer(db, { edition, echelon, zone, type, titre, texte, donnees }) {
  await ensureChampTables(db);
  const r = await db.prepare(
    `INSERT INTO champ_annonces (edition, echelon, zone, type, titre, texte, donnees, au, pousser)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    edition || null, echelon, String(zone || '').toUpperCase(), type,
    titre, texte || null, donnees ? JSON.stringify(donnees) : null,
    Date.now(), ANNONCES.has(type) ? 1 : 0
  ).run();
  return r;
}

/**
 * Note le pays d'un joueur vu par Cloudflare.
 *
 * On n'ecrase jamais un choix explicite : quelqu'un en deplacement, ou derriere
 * un VPN, ne doit pas changer de nationalite sportive parce qu'il a joue une
 * course depuis un aeroport.
 */
export async function noterPays(db, nameKey, pays) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k || !/^[A-Z]{2}$/.test(p)) return;
  await ensureChampTables(db);
  await db.prepare(
    `INSERT INTO player_pays (name_key, pays, continent, source, vu_le)
     VALUES (?, ?, ?, 'geo', ?)
     ON CONFLICT(name_key) DO UPDATE SET
       pays = CASE WHEN player_pays.source = 'choix' THEN player_pays.pays ELSE excluded.pays END,
       continent = CASE WHEN player_pays.source = 'choix' THEN player_pays.continent ELSE excluded.continent END,
       vu_le = excluded.vu_le`
  ).bind(k, p, continentDe(p), Date.now()).run();
}

/** Le joueur corrige son pays lui-meme. Ce choix prime sur la detection. */
export async function choisirPays(db, nameKey, pays) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k || !/^[A-Z]{2}$/.test(p)) return { erreur: 'pays invalide' };
  await ensureChampTables(db);
  await db.prepare(
    `INSERT INTO player_pays (name_key, pays, continent, source, vu_le)
     VALUES (?, ?, ?, 'choix', ?)
     ON CONFLICT(name_key) DO UPDATE SET
       pays = excluded.pays, continent = excluded.continent,
       source = 'choix', vu_le = excluded.vu_le`
  ).bind(k, p, continentDe(p), Date.now()).run();
  return { ok: true, pays: p, continent: continentDe(p) };
}

/** Combien de joueurs classes et actifs un pays compte-t-il ? */
export async function effectifPays(db, pays, fenetreJours) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const depuis = Date.now() - fenetreJours * 24 * 3600 * 1000;
  const r = await db.prepare(
    `SELECT COUNT(*) AS n
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE g.pays = ? AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?`
  ).bind(String(pays).toUpperCase(), depuis).first();
  return (r && r.n) || 0;
}

/** Les pays capables de tenir leur championnat ce cycle-ci. */
export async function paysEligibles(db) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const cfg = ECHELONS.national;
  const depuis = Date.now() - cfg.fenetreActiviteJours * 24 * 3600 * 1000;
  const { results } = await db.prepare(
    `SELECT g.pays AS pays, COUNT(*) AS n
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      GROUP BY g.pays
      ORDER BY n DESC`
  ).bind(depuis).all();
  return (results || []).map(r => ({
    pays: r.pays, joueurs: r.n,
    eligible: r.n >= cfg.minJoueurs,
    repli: r.n >= cfg.minJoueurs ? null : REPLI_PAYS_TROP_PETIT,
  }));
}

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function code(n = 8) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

/**
 * Le classement d'une zone, pour remplir une grille.
 *
 * QUALIFIER ET SEMER SONT DEUX QUESTIONS, et cette fonction sert les deux sans
 * les confondre. Elle ordonne au classement visible — palier, puis points de
 * ligue — et rend le MMR a cote, sous le nom de `force`. L'appelant qualifie
 * avec l'ordre, et seme avec la force.
 *
 * Pourquoi qualifier au visible. Une selection decidee par le MMR est juste et
 * invisible a la fois : le joueur ne peut ni verifier qu'il etait 33e, ni
 * savoir quoi faire pour ne plus l'etre. Or une competition n'est pas seulement
 * juste parce qu'elle prend les meilleurs ; elle l'est parce que tout le monde
 * connaissait la regle et pouvait se voir dedans. Le classement visible est le
 * seul ordre que le joueur suit deja.
 *
 * Le prix est connu : les points de ligue avantagent qui joue plus. Il est
 * moins lourd qu'il n'y parait, parce que `modulation()` pondere deja chaque
 * gain de points par l'ecart entre le MMR du joueur et ce qu'on attend de sa
 * division — l'echelle visible n'est pas du temps de jeu, c'est du temps de jeu
 * pese au niveau reel.
 *
 * Pourquoi semer au MMR quand meme. Placer les tetes de serie aux points
 * reviendrait a mettre en couloir 4 celui qui a joue le plus, pas celui qui
 * court le plus vite, et le serpentin existe precisement pour equilibrer les
 * series. On qualifie a ce que le joueur voit, on seme a ce qu'on mesure.
 *
 * `maintenant` decide de la fenetre d'activite. Il se passe explicitement
 * plutot que de se lire sur l'horloge : la cloture doit pouvoir dire « un duel
 * classe dans les soixante jours avant mercredi 23h59 » et non « avant
 * l'instant ou le cron est passe ».
 */
async function classement(db, {
  pays = null, continent = null, exclure, limite, maintenant = Date.now(),
}) {
  await ensureDuelTables(db);
  const depuis = maintenant - ECHELONS.national.fenetreActiviteJours * JOUR;
  const ou = pays ? 'g.pays = ?' : continent ? 'g.continent = ?' : '1 = 1';
  const args = pays ? [pays] : continent ? [continent] : [];
  const { results } = await db.prepare(
    `SELECT d.name_key AS cle, d.name AS nom, d.mmr AS force,
            d.palier AS palier, d.lp AS lp
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE ${ou} AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY ${ordreClassement('d.')}
      LIMIT ?`
  ).bind(...args, depuis, limite + (exclure ? exclure.size : 0)).all();
  const pris = [];
  for (const r of results || []) {
    if (exclure && exclure.has(r.cle)) continue;
    pris.push(r);
    if (pris.length >= limite) break;
  }
  return pris;
}

/**
 * Les champions en titre d'un echelon, encore porteurs a cette seconde.
 *
 * La table des duels est creee au besoin : un championnat peut s'ouvrir sur une
 * base ou personne n'a encore joue de duel, et lire une table absente y faisait
 * echouer toute l'ouverture avec une erreur cinq cents.
 */
async function championsEnTitre(db, echelon, filtreZone) {
  await ensureDuelTables(db);
  const { results } = await db.prepare(
    `SELECT t.name_key AS cle, t.nom, t.zone, t.sacre_le,
            COALESCE(d.mmr, 0) AS force, d.palier AS palier, d.lp AS lp
       FROM champ_titres t LEFT JOIN duel_players d ON d.name_key = t.name_key
      WHERE t.echelon = ? AND t.expire_le > ?
      ORDER BY t.sacre_le DESC`
  ).bind(echelon, Date.now()).all();

  const vus = new Set();
  const sortie = [];
  for (const r of results || []) {
    if (vus.has(r.cle)) continue;                 // un seul titre par personne
    if (filtreZone && !filtreZone(r.zone)) continue;
    vus.add(r.cle);
    sortie.push(r);
  }
  return sortie;
}

/**
 * Qui prend le depart, selon l'echelon.
 *
 * Renvoie { joueurs, suivants, doffice } ou une erreur. `doffice` est
 * l'ensemble des cles qualifiees par leur titre plutot que par leur classement
 * — l'information interesse l'affichage, pas la competition.
 *
 * `suivants` sont ceux d'apres la barre. Ils ne courront pas, et on les lit
 * quand meme : c'est le seul moyen de repondre a qui reclame sa place. Sans
 * eux, la selection est une affirmation qu'on ne peut pas relire.
 */
async function pool(db, echelon, zone, maintenant = Date.now()) {
  // On lit un peu plus loin que la barre : les trente-deux qui courent, et les
  // suivants qu'on garde pour l'archive de la cloture.
  const large = FORMAT.partants + SUIVANTS_GARDES;

  if (echelon === 'national') {
    const cfg = ECHELONS.national;
    const n = await effectifPays(db, zone, cfg.fenetreActiviteJours);
    if (n < cfg.minJoueurs) {
      return { erreur: 'pays trop petit', joueurs: n, requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT };
    }
    const l = await classement(db, {
      pays: zone, exclure: new Set(), limite: large, maintenant,
    });
    return {
      joueurs: l.slice(0, FORMAT.partants),
      suivants: l.slice(FORMAT.partants),
      doffice: new Set(),
    };
  }

  // Continental et mondial partagent la meme mecanique : des champions
  // qualifies d'office, puis un repechage au classement de la zone jusqu'a 32.
  const estContinental = echelon === 'continental';
  const champions = estContinental
    ? await championsEnTitre(db, 'national', z => continentDe(z) === zone)
    : await championsEnTitre(db, 'continental', null);

  const minimum = MIN_DOFFICE[echelon] || 0;
  if (champions.length < minimum) {
    return {
      erreur: 'pas assez de champions',
      champions: champions.length, requis: minimum,
      repli: 'attendre',
    };
  }

  const exclure = new Set(champions.map(c => c.cle));
  const complement = await classement(db, {
    continent: estContinental ? zone : null,
    exclure, limite: large - champions.length, maintenant,
  });

  // La barre tombe apres les trente-deux, champions d'office compris : c'est
  // eux qui reduisent le nombre de places ouvertes au repechage, et un
  // reclamant a le droit de le savoir.
  const place = Math.max(0, FORMAT.partants - champions.length);
  return {
    joueurs: [...champions, ...complement.slice(0, place)],
    suivants: complement.slice(place),
    doffice: exclure,
  };
}

/** L'heure de cloture d'une edition qui part ce samedi-la. */
export const clotureDe = (debutSamedi) => debutSamedi - CLOTURE_JOURS_AVANT * JOUR;

/**
 * ANNONCER UNE EDITION — premier des deux actes.
 *
 * Ces deux actes n'en faisaient qu'un, et c'est la tout ce qui empechait la
 * selection d'etre juste. Ouvrir une edition, c'etait du meme geste declarer
 * qu'elle aurait lieu ET geler ses trente-deux partants : le classement se
 * lisait donc a l'instant ou quelqu'un lancait la commande. Mercredi matin ou
 * vendredi soir, personne ne pouvait le savoir a l'avance ni le verifier
 * apres. Il n'y avait pas de regle a propos de laquelle etre juste.
 *
 * Ici on ne fait que declarer : la zone, l'epreuve, le samedi du depart, et
 * l'heure a laquelle la selection fermera. Aucun partant. C'est cette edition
 * annoncee, et elle seule, qui donne un decompte a afficher — un decompte vers
 * une echeance sur laquelle le joueur peut encore agir.
 *
 * `debutSamedi` est minuit UTC d'un samedi — `Date.UTC(2026, 8, 19)`, sans
 * heure. Ce n'est plus une consigne mais une condition : voir le refus dans le
 * corps, et pourquoi il vaut mieux qu'un commentaire.
 */
export async function annoncerEchelon(db, { echelon, zone, debutSamedi, epreuve, cloture }) {
  await ensureChampTables(db);
  if (!ECHELONS[echelon]) return { erreur: 'echelon inconnu' };
  const z = String(zone || 'MONDE').toUpperCase();
  // L'epreuve se valide ici et pas a la porte HTTP : `annoncerCycle` annonce
  // trente pays sans repasser par une requete, et une distance fantaisiste
  // doit etre refusee la aussi.
  const ep = String(epreuve == null ? EPREUVE_DEFAUT : epreuve);
  if (!EPREUVES.includes(ep)) return { erreur: 'epreuve inconnue', epreuve: ep };

  const t = Number(debutSamedi);
  if (!Number.isFinite(t)) return { erreur: 'date de debut invalide' };

  // MINUIT UTC, ET UN SAMEDI. Un commentaire ne suffisait pas.
  //
  // `CALENDRIER` porte des minutes depuis minuit — la premiere serie a 9 h, la
  // finale a 19 h — et `calendrier()` les ajoute telles quelles a cette date.
  // Une heure glissee dans `debut` decale donc tout le weekend d'autant, sans
  // que rien ne proteste : la valeur reste un instant parfaitement valide, elle
  // ne veut simplement plus dire ce qu'on croit. C'est arrive en verification,
  // avec sept heures d'ecart — la finale tombait a 2 h du matin le lundi.
  //
  // Et le samedi n'est pas decoratif : `CALENDRIER` a un `jour1` et un `jour2`,
  // donc un depart pose un mercredi produirait des demi-finales le jeudi.
  //
  // On refuse plutot que de corriger en silence. Ramener la valeur a minuit
  // sans le dire changerait ce que l'appelant a demande, et ce genre de
  // correction muette est exactement ce qui rend un defaut introuvable six mois
  // plus tard. `attendu` donne la valeur juste, pour que le refus se repare
  // sans avoir a relire ce fichier.
  const d = new Date(t);
  const minuit = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (t !== minuit) {
    return { erreur: 'debut pas a minuit UTC', debut: t, attendu: minuit };
  }
  // En UTC, et pas dans le fuseau du serveur : le worker tourne la ou
  // Cloudflare le pose, et `getDay()` y repondrait autre chose qu'ici.
  if (d.getUTCDay() !== 6) {
    return { erreur: 'debut pas un samedi', debut: t, jour: d.getUTCDay() };
  }

  const ferme = Number.isFinite(Number(cloture)) ? Number(cloture) : clotureDe(t);
  if (ferme >= t) return { erreur: 'cloture apres le depart', cloture: ferme, debut: t };

  // Une zone ne tient qu'un championnat a la fois. Deux editions ouvertes pour
  // le meme pays produiraient deux champions du meme endroit, et un titre qui
  // ne veut plus rien dire. Une edition annulee, en revanche, ne bloque plus
  // rien : elle n'aura pas lieu, et le cycle suivant doit pouvoir reannoncer.
  const deja = await db.prepare(
    `SELECT id, debut, etat FROM champ_editions
      WHERE echelon = ? AND zone = ? AND etat NOT IN ('terminee', 'annulee') LIMIT 1`
  ).bind(echelon, z).first();
  if (deja) return { erreur: 'edition deja ouverte', edition: deja.id, debut: deja.debut, etat: deja.etat };

  // Un pays qui ne peut pas tenir son championnat se refuse ICI, et pas dans
  // trois jours. `annoncerCycle` ne lui donnerait jamais son tour, mais une
  // annonce a la main le pourrait — et annoncer un championnat pour ensuite
  // l'annuler est bien pire que de ne pas l'annoncer.
  //
  // C'est un COMPTE, pas un classement : on verifie qu'il y a du monde, on ne
  // regarde pas qui. Rien n'est gele, et le classement reste libre de bouger
  // jusqu'a la cloture.
  //
  // Les echelons superieurs n'ont pas droit a cette verification, et c'est
  // volontaire : un continental s'annonce AVANT que les nationaux aient
  // couronne les champions qui le rempliront. Compter ses qualifies d'office a
  // l'annonce reviendrait a refuser tous les continentaux du cycle.
  if (echelon === 'national') {
    const cfg = ECHELONS.national;
    const n = await effectifPays(db, z, cfg.fenetreActiviteJours);
    if (n < cfg.minJoueurs) {
      return {
        erreur: 'pays trop petit', joueurs: n,
        requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT,
      };
    }
  }

  // On ne lit PAS le classement ici. Une grille semee a l'annonce serait
  // exactement ce qu'on vient de defaire : un gel a une heure que personne
  // n'a annoncee. La phase de depart est posee des maintenant pour que rien en
  // aval n'ait a traiter une edition sans phase.
  const id = code();
  const phase0 = FORMAT.phases[0];
  await db.prepare(
    `INSERT INTO champ_editions
       (id, echelon, zone, epreuve, debut, cloture, phase, etat, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'annoncee', ?)`
  ).bind(id, echelon, z, ep, t, ferme, phase0.cle, Date.now()).run();

  const nom = nomZone(z, echelon);
  await annoncer(db, {
    edition: id, echelon, zone: z, type: 'annonce',
    titre: echelon === 'mondial' ? 'Championnat du monde' : ECHELONS[echelon].nom + ' ' + nom.avec,
    texte: ep + ' m. Premier départ samedi. Sélection des '
         + FORMAT.partants + ' meilleurs du classement, à la clôture.',
    donnees: { epreuve: ep, debut: t, cloture: ferme, partants: FORMAT.partants },
  });

  return {
    edition: id, echelon, zone: z, epreuve: ep, etat: 'annoncee',
    pays: echelon === 'national' ? z : undefined,
    debut: t, cloture: ferme,
    calendrier: calendrier(t, CALENDRIER),
  };
}

/**
 * CLOTURER LA SELECTION — second acte, et le seul qui lise le classement.
 *
 * « Figes a la cloture » etait deja le principe ; il devient verifiable, parce
 * que la cloture est maintenant une heure annoncee d'avance et non l'instant ou
 * une commande a ete lancee. Apres cet appel, le classement peut bouger comme
 * il veut : la grille ne bouge plus, et personne n'entre ni ne sort entre deux
 * courses.
 *
 * `maintenant` est l'instant de reference — celui de la fenetre d'activite et
 * celui qu'on inscrit. Le cron passe toutes les cinq minutes et peut donc
 * arriver un peu apres l'heure ; on lui passe l'heure annoncee plutot que la
 * sienne, pour que la regle affichee soit celle qui a ete appliquee.
 */
export async function cloturerSelection(db, edition, maintenant = Date.now()) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, etat
       FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat !== 'annoncee') return { erreur: 'edition deja cloturee', etat: e.etat };

  const ep = e.epreuve || EPREUVE_DEFAUT;
  const phase0 = FORMAT.phases[0];
  const nom = nomZone(e.zone, e.echelon);
  const intitule = e.echelon === 'mondial'
    ? 'Championnat du monde' : ECHELONS[e.echelon].nom + ' ' + nom.avec;

  const p = await pool(db, e.echelon, e.zone, maintenant);
  const manque = !p.erreur && p.joueurs.length < FORMAT.partants;

  // La zone a ete annoncee et ne peut pas tenir sa grille : elle a perdu des
  // joueurs actifs depuis l'annonce, ou ses champions ont expire.
  //
  // On annule, et on ne repousse pas. Repousser la cloture de vingt-quatre
  // heures parce qu'il manque un partant reviendrait a deplacer l'echeance
  // apres l'avoir publiee — c'est-a-dire a defaire ce que tout ce decoupage
  // vient de construire. Le cycle suivant reannoncera.
  if (p.erreur || manque) {
    const raison = p.erreur ? p.erreur : 'grille incomplete';
    await db.prepare(
      `UPDATE champ_editions SET etat = 'annulee', fini_le = ? WHERE id = ?`
    ).bind(maintenant, e.id).run();
    await annoncer(db, {
      edition: e.id, echelon: e.echelon, zone: e.zone, type: 'annulation',
      titre: intitule,
      texte: 'Édition annulée : pas assez de partants à la clôture.',
      // Les champs se recopient un par un plutot que d'etaler `p`. Etaler
      // marchait, et par accident : selon la branche, `p.joueurs` est un
      // compte ou la liste complete des partants — et la seconde n'a rien a
      // faire dans une annonce, qui est publique et se lit dans le fil.
      donnees: {
        raison,
        joueurs: manque ? p.joueurs.length : p.joueurs,
        requis: manque ? FORMAT.partants : p.requis,
        champions: p.champions,
        repli: p.repli,
      },
    });
    // Le detail chiffre remonte avec l'erreur. L'ancien `ouvrirEchelon` le
    // rendait, et deux appelants s'en servent pour dire quelque chose d'utile :
    // le harnais France affiche « il faut 32 joueurs, la base en compte 4 », et
    // `ouvrirCycle` le range dans `ecartes`. Sans ces champs, les deux
    // annoncent un echec sans dire de combien.
    return {
      erreur: raison, edition: e.id, annulee: true,
      joueurs: manque ? p.joueurs.length : p.joueurs,
      requis: manque ? FORMAT.partants : p.requis,
      champions: p.champions, repli: p.repli,
    };
  }

  // Le semis se fait au MMR pour tout le monde, titre ou pas — c'est la
  // deuxieme moitie de la regle « on qualifie a ce que le joueur voit, on seme
  // a ce qu'on mesure ». Placer les champions en tete de serie parce qu'ils
  // sont champions desequilibrerait les series, ce que le serpentin existe
  // precisement pour eviter ; les y placer aux points de ligue mettrait en
  // couloir 4 celui qui a le plus joue.
  const joueurs = [...p.joueurs]
    .sort((a, b) => (b.force || 0) - (a.force || 0))
    .map((j, i) => ({ cle: j.cle, nom: j.nom, rang: i + 1, doffice: p.doffice.has(j.cle) }));

  const grille = serpentin(joueurs, phase0.courses);

  const lignes = [];
  grille.forEach((course, ic) => course.forEach(j => {
    lignes.push(db.prepare(
      `INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(e.id, j.cle, j.nom, j.rang, phase0.cle, ic + 1));
  }));

  // L'instantane de la barre. `rang` est la position dans le vivier tel qu'il a
  // servi : au national c'est le rang au classement, tout simplement ; aux
  // echelons superieurs les champions d'office viennent d'abord, puisque ce
  // sont eux qui reduisent le nombre de places ouvertes au repechage.
  [...p.joueurs.map(j => ({ ...j, retenu: 1 })),
   ...p.suivants.map(j => ({ ...j, retenu: 0 }))].forEach((j, i) => {
    lignes.push(db.prepare(
      `INSERT INTO champ_selection (edition, name_key, nom, rang, palier, lp, retenu)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.id, j.cle, j.nom, i + 1, j.palier ?? null, j.lp ?? null, j.retenu));
  });

  await db.batch(lignes);

  await db.prepare(
    `UPDATE champ_editions SET etat = 'ouverte', phase = ? WHERE id = ?`
  ).bind(phase0.cle, e.id).run();

  await annoncer(db, {
    edition: e.id, echelon: e.echelon, zone: e.zone, type: 'ouverture',
    titre: intitule,
    // La distance ouvre la phrase : c'est d'elle qu'on est champion, et le fil
    // d'annonces est le seul endroit ou un joueur lit l'edition en toutes
    // lettres.
    texte: ep + ' m. ' + FORMAT.partants + ' partants, ' + phase0.courses
         + ' séries. Premier départ samedi.',
    donnees: { partants: joueurs.length, doffice: p.doffice.size, epreuve: ep },
  });

  return {
    edition: e.id, echelon: e.echelon, zone: e.zone, epreuve: ep, etat: 'ouverte',
    pays: e.echelon === 'national' ? e.zone : undefined,
    partants: joueurs.length, doffice: p.doffice.size,
    suivants: p.suivants.length,
    cloture: e.cloture, debut: e.debut,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c })),
    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * Annonce et cloture d'un seul geste.
 *
 * C'est l'ancien `ouvrirEchelon`, et il garde sa place : sur le canal de test
 * on veut un championnat maintenant, pas dans trois jours, et les essais du
 * moteur n'ont pas a attendre une echeance. En production c'est l'annonce
 * qu'on appelle — un championnat ouvert sans avoir ete annonce est exactement
 * ce que ce decoupage sert a rendre impossible.
 */
export async function ouvrirEchelon(db, { echelon, zone, debutSamedi, epreuve }) {
  const a = await annoncerEchelon(db, { echelon, zone, debutSamedi, epreuve });
  if (a.erreur) return a;

  const r = await cloturerSelection(db, a.edition);

  // Le geste a echoue : il ne doit rien laisser derriere lui.
  //
  // `cloturerSelection` annule l'edition quand la grille ne se remplit pas, et
  // c'est la bonne reponse pour une edition annoncee : un pays a qui l'on a
  // promis un championnat merite qu'on lui dise qu'il n'aura pas lieu. Mais ici
  // l'annonce et la cloture tombent dans la meme milliseconde — personne ne l'a
  // jamais vue passer, et laisser une edition annulee derriere soi reviendrait
  // a garder la trace d'une promesse qui n'a jamais ete faite.
  //
  // Ce n'est pas cosmetique : `ouvrirCycle` appelle ceci pour trente zones, et
  // celles qui n'ont pas assez de champions en laissaient une chacune. Elles
  // ressortaient ensuite dans le recapitulatif mondial comme des editions
  // existantes, ce qu'elles ne sont pas.
  if (r.erreur) {
    await db.batch([
      db.prepare(`DELETE FROM champ_annonces WHERE edition = ?`).bind(a.edition),
      db.prepare(`DELETE FROM champ_editions WHERE id = ?`).bind(a.edition),
    ]);
  }
  return r;
}

/** Ouvre une edition nationale. Conserve pour les appels existants. */
export async function ouvrirNational(db, { pays, debutSamedi, epreuve }) {
  return ouvrirEchelon(db, { echelon: 'national', zone: pays, debutSamedi, epreuve });
}

/**
 * Ouvre le meme weekend pour tous les pays qui peuvent le tenir.
 *
 * « Tous les championnats nationaux ont lieu le meme weekend » n'est pas un
 * detail d'affichage : c'est ce qui fait qu'un joueur sait que pendant qu'il
 * court sa serie, trente autres pays courent la leur. Une seule date, passee
 * a tout le monde, et les pays trop petits ressortent dans `ecartes` avec
 * leur raison plutot que d'echouer en silence.
 *
 * `acte` decide de ce qu'on fait de chaque zone : l'annoncer, ou l'ouvrir sur
 * le champ. Les deux parcourent exactement la meme liste de zones dans le meme
 * ordre — c'est ce qui garantit qu'un cycle annonce et un cycle ouvert
 * concernent le meme monde.
 */
export async function ouvrirCycle(db, {
  debutSamedi, echelon = 'national', epreuve, acte = ouvrirEchelon,
}) {
  await ensureChampTables(db);
  const ouvertes = [], ecartes = [];

  if (echelon === 'national') {
    for (const p of await paysEligibles(db)) {
      if (!p.eligible) { ecartes.push({ zone: p.pays, raison: 'pays trop petit', joueurs: p.joueurs, repli: p.repli }); continue; }
      const r = await acte(db, { echelon: 'national', zone: p.pays, debutSamedi, epreuve });
      if (r.erreur) ecartes.push({ zone: p.pays, raison: r.erreur, ...r });
      else ouvertes.push({ zone: p.pays, edition: r.edition, partants: r.partants, cloture: r.cloture });
    }
  } else if (echelon === 'continental') {
    for (const c of Object.keys(CONTINENTS)) {
      const r = await acte(db, { echelon: 'continental', zone: c, debutSamedi, epreuve });
      if (r.erreur) ecartes.push({ zone: c, raison: r.erreur, ...r });
      else ouvertes.push({ zone: c, edition: r.edition, partants: r.partants, cloture: r.cloture });
    }
  } else {
    const r = await acte(db, { echelon: 'mondial', zone: 'MONDE', debutSamedi, epreuve });
    if (r.erreur) ecartes.push({ zone: 'MONDE', raison: r.erreur, ...r });
    else ouvertes.push({ zone: 'MONDE', edition: r.edition, partants: r.partants, cloture: r.cloture });
  }

  return { echelon, debut: debutSamedi, ouvertes, ecartes };
}

/**
 * Annonce le meme weekend a tout le monde, sans lire un seul classement.
 *
 * C'est l'appel d'exploitation en production : on annonce le cycle une ou deux
 * semaines avant, et plus personne n'y touche. Le cron cloture chaque edition
 * a son heure.
 *
 * La liste des pays est arretee ICI, a l'annonce. Un pays qui n'a pas ses
 * trente-deux joueurs actifs ce jour-la n'aura pas de championnat, meme s'il
 * les gagne avant la cloture — et c'est voulu : la liste des pays qui tiennent
 * leur championnat est publiee avec l'annonce, et une liste publiee ne se
 * complete pas en silence.
 */
export async function annoncerCycle(db, { debutSamedi, echelon = 'national', epreuve }) {
  return ouvrirCycle(db, { debutSamedi, echelon, epreuve, acte: annoncerEchelon });
}

/**
 * Cloture toutes les selections dont l'heure est passee.
 *
 * C'est le point d'entree du cron, et c'est ce qui fait de la cloture une
 * echeance plutot qu'une intention. Une deadline qui attend qu'un humain lance
 * une commande n'est pas une deadline : elle glisse d'une journee le jour ou la
 * cle d'administration ne correspond pas, et la regle affichee devient fausse
 * sans que personne ne l'ait decide.
 *
 * On cloture a l'heure ANNONCEE, pas a celle du passage. Le cron balaie toutes
 * les cinq minutes et arrive donc jusqu'a cinq minutes en retard ; lire le
 * classement avec son horloge a lui reviendrait a appliquer une fenetre
 * d'activite de soixante jours et cinq minutes. L'ecart est infime et le
 * principe ne l'est pas : la regle appliquee doit etre celle qui a ete
 * publiee.
 */
export async function cloturerEcheances(db, maintenant = Date.now()) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `SELECT id, cloture FROM champ_editions
      WHERE etat = 'annoncee' AND cloture IS NOT NULL AND cloture <= ?
      ORDER BY cloture`
  ).bind(maintenant).all();

  const cloturees = [], annulees = [];
  for (const e of results || []) {
    const r = await cloturerSelection(db, e.id, e.cloture);
    if (r.annulee) annulees.push({ edition: e.id, raison: r.erreur });
    else if (r.erreur) annulees.push({ edition: e.id, raison: r.erreur, echec: true });
    else cloturees.push({ edition: e.id, zone: r.zone, partants: r.partants });
  }
  return { vues: (results || []).length, cloturees, annulees };
}

/**
 * L'edition annoncee d'une zone, celle vers laquelle on decompte.
 *
 * Distincte de `editionDe`, qui cherche le championnat ou un joueur est
 * ENGAGE : avant la cloture, personne ne l'est encore. C'est cette route qui
 * permet de parler du championnat a qui n'y est pas — c'est-a-dire a ceux
 * qu'il faut convaincre de jouer.
 */
export async function prochaineEdition(db, zone, echelon = 'national') {
  await ensureChampTables(db);
  const z = String(zone || '').toUpperCase();
  if (!z) return null;
  const e = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, etat
       FROM champ_editions
      WHERE echelon = ? AND zone = ? AND etat IN ('annoncee', 'ouverte')
      ORDER BY debut LIMIT 1`
  ).bind(echelon, z).first();
  if (!e) return null;
  const nom = nomZone(e.zone, e.echelon);
  return {
    id: e.id, echelon: e.echelon, zone: e.zone, zoneNom: nom.nom,
    titre: e.echelon === 'mondial' ? ECHELONS.mondial.nom
         : ECHELONS[e.echelon].nom + ' ' + nom.avec,
    epreuve: e.epreuve || EPREUVE_DEFAUT,
    debut: e.debut, cloture: e.cloture, etat: e.etat,
    partants: FORMAT.partants,
    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * La course d'un partant, et l'heure a laquelle elle part.
 *
 * L'heure se calcule ici et non a l'ecran. Le calendrier est une regle de
 * competition — le meme raisonnement que pour le format des phases : la
 * recopier cote client garantit qu'un jour les deux ne diront plus la meme
 * heure, et une heure de convocation fausse est pire que pas d'heure du tout.
 */
async function courseDe(db, edition, nameKey) {
  const r = await db.prepare(
    `SELECT phase, course FROM champ_partants WHERE edition = ? AND name_key = ?`
  ).bind(edition, nameKey).first();
  if (!r || r.course == null) return null;
  const e = await db.prepare(
    `SELECT debut FROM champ_editions WHERE id = ?`).bind(edition).first();
  const rv = calendrier(e ? e.debut : 0, CALENDRIER)
    .find(x => x.phase === r.phase && x.course === r.course);
  return { phase: r.phase, numero: r.course, at: rv ? rv.at : null };
}

/**
 * Ou en est ce joueur par rapport a la barre de selection de son pays.
 *
 * C'est la reponse a « il me manque combien de places », et c'est tout
 * l'interet d'avoir qualifie au classement visible : cette question a
 * desormais une reponse que le joueur peut verifier lui-meme en comptant les
 * lignes du classement.
 *
 * Un RANG sort d'ici, jamais le MMR. Le nombre cache reste cache : il ordonne
 * des noms, ce sont les noms qu'on rend. Une fois la selection cloturee, on
 * lit l'instantane plutot que le classement du jour — sinon la reponse
 * changerait apres la cloture, alors que la grille, elle, ne change plus.
 */
export async function rangSelection(db, nameKey) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const k = String(nameKey || '').trim().toLowerCase();
  if (!k) return null;

  const g = await db.prepare(
    `SELECT pays FROM player_pays WHERE name_key = ?`).bind(k).first();
  if (!g || !g.pays) return { pays: null, raison: 'pays inconnu' };

  const ed = await prochaineEdition(db, g.pays, 'national');
  const places = FORMAT.partants;

  // Le titre et l'epreuve voyagent avec le rang, et l'appel se suffit alors a
  // lui-meme. C'est ce qui permet a la banderole de l'accueil de tenir en UNE
  // requete : sans eux il lui faudrait aussi demander `/champ/prochain` pour
  // savoir comment nommer le championnat dont elle affiche l'ecart.
  const ou = ed
    ? { titre: ed.titre, epreuve: ed.epreuve, zoneNom: ed.zoneNom }
    : { titre: null, epreuve: null, zoneNom: null };

  // Apres la cloture, la verite est dans l'instantane.
  if (ed && ed.etat === 'ouverte') {
    const r = await db.prepare(
      `SELECT rang, retenu FROM champ_selection WHERE edition = ? AND name_key = ?`
    ).bind(ed.id, k).first();
    return {
      pays: g.pays, ...ou, edition: ed.id, etat: ed.etat, places,
      cloture: ed.cloture, debut: ed.debut,
      // Pas de barre apres le gel : le classement du jour ne selectionne plus
      // rien, et une barre tracee dessus designerait des gens qui ne courent
      // pas. C'est la grille qui fait foi, et elle est ailleurs.
      barre: null,
      rang: r ? r.rang : null,
      retenu: r ? !!r.retenu : false,
      manque: r && !r.retenu ? r.rang - places : null,
      gele: true,
      // La course ou il part, quand il part. C'est LA nouvelle du gel, et elle
      // ne vaut que pour les retenus : « serie 3 » ne dit rien a qui n'y est
      // pas. Le couloir ne sort pas d'ici — il se derive du rang de semis a
      // l'affichage, et le deriver deux fois serait deux occasions de ne plus
      // dire la meme chose.
      course: r && r.retenu ? await courseDe(db, ed.id, k) : null,
    };
  }

  // Avant la cloture : le classement du moment, dans l'ordre qui selectionne.
  const { results } = await db.prepare(
    `SELECT d.name_key AS cle
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE g.pays = ? AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY ${ordreClassement('d.')}`
  ).bind(g.pays, Date.now() - ECHELONS.national.fenetreActiviteJours * JOUR).all();

  const i = (results || []).findIndex(r => r.cle === k);
  const rang = i < 0 ? null : i + 1;

  // Qui occupe la derniere place qualificative, nomme.
  //
  // Le jeu dessine une barre dans le classement, et il ne peut pas la placer
  // seul : le classement affiche montre TOUT LE MONDE, tandis que la selection
  // exige un duel classe dans les soixante derniers jours. Un joueur endormi
  // depuis trois mois tient donc une ligne a l'ecran sans occuper de place
  // dans le vivier — et compter trente-deux lignes cote client tracerait la
  // barre trop bas, en silence.
  //
  // On rend donc la cle du dernier qualifie plutot qu'un compte. Le jeu trace
  // apres cette ligne-la, ou ne trace rien s'il ne la voit pas.
  const barre = (results || []).length >= places
    ? (results[places - 1] || {}).cle || null
    : null;
  return {
    pays: g.pays, ...ou,
    edition: ed ? ed.id : null,
    etat: ed ? ed.etat : null,
    cloture: ed ? ed.cloture : null,
    debut: ed ? ed.debut : null,
    places, classes: (results || []).length,
    barre,
    rang,
    // `null` quand le joueur n'est pas classe du tout : il n'a pas un ecart a
    // la barre, il n'est pas encore sur la liste. Les deux cas demandent deux
    // phrases differentes a l'ecran, pas la meme avec un zero dedans.
    retenu: rang != null && rang <= places,
    manque: rang != null && rang > places ? rang - places : null,
    gele: false,
    // Avant le gel, personne n'a de course : la grille n'existe pas. Le champ
    // est la quand meme, a `null`, pour que l'ecran n'ait pas deux formes de
    // reponse a distinguer selon le moment ou il a demande.
    course: null,
  };
}

/**
 * Les trois weekends d'un cycle, deduits du premier.
 *
 * Les delais entre echelons sont en configuration : ils servent a agreger les
 * champions et a fabriquer l'attente, et ce sont exactement les nombres qu'on
 * voudra bouger apres le premier cycle.
 */
export function calendrierCycle(debutSamedi) {
  const SEMAINE = 7 * JOUR;
  const nat = debutSamedi;
  const con = nat + ECHELONS.continental.semainesApresPrecedent * SEMAINE;
  const mon = con + ECHELONS.mondial.semainesApresPrecedent * SEMAINE;
  // La cloture voyage avec le weekend. Un calendrier qui annonce trois dates
  // de depart sans dire quand chaque selection ferme est un calendrier
  // inutilisable pour celui qui veut y entrer.
  const w = (echelon, debut) => ({
    echelon, debut, cloture: clotureDe(debut),
    rendezVous: calendrier(debut, CALENDRIER),
  });
  return [w('national', nat), w('continental', con), w('mondial', mon)];
}

/**
 * L'edition en cours ou ce joueur est engage, s'il y en a une.
 *
 * Sans cette route, un joueur n'a aucun moyen de retrouver son championnat :
 * il faudrait qu'il retienne un identifiant qu'on ne lui a jamais montre. On
 * cherche donc par son nom, comme partout ailleurs dans le jeu.
 *
 * On rend aussi la derniere edition terminee : le sacre merite d'etre lu
 * encore un moment apres la finale, pas d'etre efface a la seconde ou elle
 * s'acheve.
 */
export async function editionDe(db, nameKey) {
  await ensureChampTables(db);
  const k = String(nameKey || '').trim().toLowerCase();
  if (!k) return null;
  const r = await db.prepare(
    `SELECT e.id FROM champ_editions e
       JOIN champ_partants p ON p.edition = e.id
      WHERE p.name_key = ?
      ORDER BY e.etat = 'terminee', e.debut DESC
      LIMIT 1`
  ).bind(k).first();
  return r ? r.id : null;
}

/** L'etat complet d'une edition : ou elle en est, qui court quoi. */
export async function etatEdition(db, id) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT * FROM champ_editions WHERE id = ?`).bind(id).first();
  if (!e) return null;
  const { results: partants } = await db.prepare(
    `SELECT name_key, nom, rang_duel, phase, course, sorti_en
       FROM champ_partants WHERE edition = ? ORDER BY course, rang_duel`).bind(id).all();
  const { results: res } = await db.prepare(
    `SELECT phase, course, name_key, ms, place FROM champ_resultats
      WHERE edition = ? ORDER BY phase, course, place`).bind(id).all();
  // Le nom lisible et la forme de la phase viennent d'ici, pas du jeu : le
  // format est une regle de competition, et la dupliquer cote client garantit
  // qu'un jour les deux ne diront plus la meme chose.
  const z = nomZone(e.zone, e.echelon);
  const iPhase = FORMAT.phases.findIndex(p => p.cle === e.phase);
  const cfg = FORMAT.phases[iPhase] || null;
  return {
    id: e.id, echelon: e.echelon, zone: e.zone, debut: e.debut,
    // `null` pour les editions ouvertes avant que la cloture existe, et pour
    // celles qu'on ouvre d'un geste sur le canal de test. C'est exact : elles
    // n'ont pas eu d'heure de cloture annoncee, et l'ecran ne doit pas
    // decompter vers une echeance qui n'a jamais ete publiee.
    cloture: e.cloture ?? null,
    // Les editions d'avant la colonne n'en portent pas : on retombe sur la
    // valeur par defaut plutot que de rendre `null`, qu'aucun ecran n'attend.
    epreuve: e.epreuve || EPREUVE_DEFAUT,
    zoneNom: z.nom,
    titre: e.echelon === 'mondial' ? ECHELONS.mondial.nom
         : ECHELONS[e.echelon].nom + ' ' + z.avec,
    phase: e.phase, etat: e.etat,
    phaseNom: cfg ? cfg.nom : e.phase,
    phaseIndex: iPhase,
    phases: FORMAT.phases.map(p => ({ cle: p.cle, nom: p.nom, courses: p.courses })),
    courses: cfg ? cfg.courses : 0,
    parCourse: cfg ? cfg.parCourse : 0,
    directsParCourse: cfg ? cfg.directsParCourse : 0,
    repechages: cfg ? cfg.repechages : 0,
    champion: e.champion_nom || null,
    partants: partants || [], resultats: res || [],
    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * Enregistre les chronos d'une course.
 *
 * Le serveur ne recalcule rien : il range, et c'est la cloture de la phase qui
 * tranchera. Separer les deux permet de courir les quatre series a des heures
 * differentes — ce que le calendrier impose — sans que la premiere ne decide
 * de rien avant que la quatrieme n'ait eu lieu.
 */
export async function enregistrerCourse(db, { edition, phase, course, chronos }) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT phase, etat FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat === 'terminee') return { erreur: 'edition terminee' };
  if (e.phase !== phase) return { erreur: 'ce n est pas la phase en cours', phase: e.phase };

  const { results: inscrits } = await db.prepare(
    `SELECT name_key FROM champ_partants
      WHERE edition = ? AND phase = ? AND course = ?`).bind(edition, phase, course).all();
  const attendus = new Set((inscrits || []).map(r => r.name_key));
  if (!attendus.size) return { erreur: 'course inconnue' };

  const lignes = [];
  for (const c of chronos || []) {
    const k = String(c.cle || '').toLowerCase();
    if (!attendus.has(k)) continue;                 // un intrus ne court pas
    const ms = c.ms == null ? null : Math.round(Number(c.ms));
    if (ms != null && (!Number.isFinite(ms) || ms < 1000 || ms > 600000)) continue;
    lignes.push(db.prepare(
      `INSERT INTO champ_resultats (edition, phase, course, name_key, ms, couru_le)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(edition, phase, course, name_key) DO UPDATE SET
         ms = excluded.ms, couru_le = excluded.couru_le`
    ).bind(edition, phase, course, k, ms, Date.now()));
  }
  if (!lignes.length) return { erreur: 'aucun chrono exploitable' };
  await db.batch(lignes);

  // Les qualifies directs d'une course sont decides par cette course seule :
  // on peut donc les annoncer des l'arrivee, ce que la mise en scene demande.
  // Les repeches, eux, se calculent sur les quatre series et attendent la
  // cloture — c'est tout l'ecart entre ce qui se voit et ce qui se devine.
  const cfgPhase = FORMAT.phases.find(x => x.cle === phase);
  const { results: arrivee } = await db.prepare(
    `SELECT r.name_key AS cle, r.ms, p.nom, p.rang_duel AS rang
       FROM champ_resultats r JOIN champ_partants p
         ON p.edition = r.edition AND p.name_key = r.name_key
      WHERE r.edition = ? AND r.phase = ? AND r.course = ?`
  ).bind(edition, phase, course).all();

  const ordre = ordonner(arrivee || []);
  const directs = ordre.slice(0, (cfgPhase && cfgPhase.directsParCourse) || 0);
  const ed = await db.prepare(
    `SELECT echelon, zone FROM champ_editions WHERE id = ?`).bind(edition).first();

  if (ed) {
    await annoncer(db, {
      edition, echelon: ed.echelon, zone: ed.zone,
      type: directs.length ? 'qualification-directe' : 'course-terminee',
      titre: (cfgPhase ? cfgPhase.nom : phase) + ' — course ' + course,
      texte: directs.length
        ? directs.map(r => r.nom).join(' et ') + ' passent directement.'
        : 'Course terminée.',
      donnees: {
        phase, course,
        arrivee: ordre.map((r, i) => ({ place: i + 1, nom: r.nom, ms: r.ms })),
        directs: directs.map(r => r.nom),
      },
    });
  }

  return { ok: true, enregistres: lignes.length, sur: attendus.size, directs: directs.map(r => r.nom) };
}

/**
 * Cloture la phase en cours : applique les regles, et seme la suivante.
 *
 * On refuse de clore tant qu'une course n'a pas eu lieu. C'est ce qui protege
 * le suspense autant que l'equite : les huit repeches ne peuvent pas etre
 * connus avant la quatrieme serie, puisqu'ils se calculent sur les quatre.
 */
export async function cloturerPhase(db, edition) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT phase, etat, zone, echelon FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat === 'terminee') return { erreur: 'edition terminee' };

  const iPhase = FORMAT.phases.findIndex(p => p.cle === e.phase);
  const cfg = FORMAT.phases[iPhase];

  // On rassemble les chronos, course par course, avec de quoi departager.
  const { results: brut } = await db.prepare(
    `SELECT r.course, r.name_key AS cle, r.ms, p.nom, p.rang_duel AS rang,
            (SELECT MIN(x.ms) FROM champ_resultats x
              WHERE x.edition = r.edition AND x.name_key = r.name_key
                AND x.phase <> r.phase) AS msPrecedent
       FROM champ_resultats r JOIN champ_partants p
         ON p.edition = r.edition AND p.name_key = r.name_key
      WHERE r.edition = ? AND r.phase = ?`).bind(edition, e.phase).all();

  const courses = Array.from({ length: cfg.courses }, () => []);
  for (const r of brut || []) courses[r.course - 1].push(r);
  const manquantes = courses
    .map((c, i) => (c.length ? null : i + 1)).filter(Boolean);
  if (manquantes.length) {
    return { erreur: 'toutes les courses n ont pas eu lieu', manquantes };
  }

  // La finale ne qualifie personne : elle sacre.
  if (iPhase === FORMAT.phases.length - 1) {
    const p = podium(courses[0], cfg.podium);
    const majPlaces = p.classement.map(r => db.prepare(
      `UPDATE champ_resultats SET place = ? WHERE edition = ? AND phase = ? AND name_key = ?`
    ).bind(r.place, edition, e.phase, r.cle));
    await db.batch(majPlaces);
    if (!p.champion) return { erreur: 'aucun finaliste n a de chrono' };
    await poserMedailles(db, edition, e, p.podium);
    const sacre = await sacrer(db, edition, { cle: p.champion.cle, nom: p.champion.nom });
    return { phase: e.phase, finale: true, podium: p.podium, classement: p.classement, ...sacre };
  }

  const q = qualifier(courses, cfg);
  const suivante = FORMAT.phases[iPhase + 1];

  // Les qualifies repartent en serpentin, semes sur leur chrono du jour : le
  // meilleur temps de la phase est tete de serie de la suivante.
  const qualifies = [...q.directs, ...q.repeches]
    .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity))
    .map((r, i) => ({ ...r, rang: i + 1 }));
  const grille = serpentin(qualifies, suivante.courses);

  const ecritures = [];
  q.ordreParCourse.forEach((ordre, ic) => ordre.forEach((r, pos) => {
    ecritures.push(db.prepare(
      `UPDATE champ_resultats SET place = ? WHERE edition = ? AND phase = ? AND course = ? AND name_key = ?`
    ).bind(pos + 1, edition, e.phase, ic + 1, r.cle));
  }));
  for (const r of q.elimines) {
    ecritures.push(db.prepare(
      `UPDATE champ_partants SET sorti_en = ? WHERE edition = ? AND name_key = ?`
    ).bind(e.phase, edition, r.cle));
  }
  grille.forEach((c, ic) => c.forEach(j => {
    ecritures.push(db.prepare(
      `UPDATE champ_partants SET phase = ?, course = ? WHERE edition = ? AND name_key = ?`
    ).bind(suivante.cle, ic + 1, edition, j.cle));
  }));
  ecritures.push(db.prepare(
    `UPDATE champ_editions SET phase = ? WHERE id = ?`).bind(suivante.cle, edition));
  await db.batch(ecritures);

  // Le seul moment de la competition ou le suspense est fabrique plutot que
  // couru : les repeches n'existaient dans aucune course, ils sortent du
  // classement de toutes.
  await annoncer(db, {
    edition, echelon: e.echelon, zone: e.zone,
    type: suivante.cle === 'finale' ? 'reveal-finale' : 'reveal-demies',
    titre: 'Les repêchés — ' + suivante.nom,
    texte: q.repeches.length
      ? q.repeches.map(r => r.nom).join(', ') + ' sont repêchés au chrono.'
      : 'Aucun repêchage.',
    donnees: {
      directs: q.directs.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
      repeches: q.repeches.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
      elimines: q.elimines.length,
      grille: grille.map((c, i) => ({ course: i + 1, joueurs: c.map(j => j.nom) })),
    },
  });

  return {
    phase: e.phase, suivante: suivante.cle,
    directs: q.directs.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
    repeches: q.repeches.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
    elimines: q.elimines.length,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c.map(j => j.nom) })),
  };
}

/**
 * Les trois premiers d'une finale recoivent leur medaille.
 *
 * Elles durent le meme temps qu'un titre — jusqu'au championnat suivant — pour
 * la meme raison : une medaille qu'on porte a vie finirait par ne plus rien
 * dire, et le classement se couvrirait de sigles sans age.
 */
export async function poserMedailles(db, edition, e, podiumTrois) {
  await ensureChampTables(db);
  const maintenant = Date.now();
  const expire = new Date(maintenant);
  expire.setMonth(expire.getMonth() + TITRE_MOIS);
  const lignes = podiumTrois.map(r => db.prepare(
    `INSERT INTO champ_medailles
       (echelon, zone, name_key, nom, place, edition, obtenu_le, expire_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(e.echelon, e.zone, r.cle, r.nom, r.place, edition, maintenant, expire.getTime()));
  if (lignes.length) await db.batch(lignes);
}

/**
 * Decoupe une liste de cles en paquets interrogeables.
 *
 * SQLite plafonne le nombre de parametres lies d'une requete, et D1 bien plus
 * bas qu'on ne l'imagine. Le classement pouvant compter cinq cents joueurs, un
 * seul `IN (?, ?, ...)` fait echouer la requete entiere — et l'echec ne se
 * serait pas vu tant que le classement restait petit. On interroge donc par
 * paquets.
 */
const PAQUET = 80;
function paquets(liste) {
  const out = [];
  for (let i = 0; i < liste.length; i += PAQUET) out.push(liste.slice(i, i + PAQUET));
  return out;
}

/** Le rang de prestige d'un echelon. Plus c'est haut, plus ca prime. */
const PRESTIGE = { mondial: 3, continental: 2, national: 1 };

/**
 * La meilleure medaille de chacun, pour un ensemble de joueurs.
 *
 * « Meilleure » veut dire la plus prestigieuse, et la competition prime sur la
 * couleur : un bronze mondial passe devant un or national. C'est la regle
 * demandee, et c'est aussi la seule qui se defende — sans quoi un champion
 * national afficherait le meme sigle qu'un medaille du monde.
 *
 * A egalite d'echelon, c'est la couleur qui departage, puis la date.
 */
export async function medaillesDe(db, cles) {
  await ensureChampTables(db);
  const liste = [...new Set((cles || []).map(c => String(c || '').toLowerCase()).filter(Boolean))];
  if (!liste.length) return new Map();
  const maintenant = Date.now();
  const lignes = [];
  for (const bloc of paquets(liste)) {
    const trous = bloc.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT name_key, echelon, zone, place, obtenu_le
         FROM champ_medailles
        WHERE expire_le > ? AND name_key IN (${trous})`
    ).bind(maintenant, ...bloc).all();
    lignes.push(...(results || []));
  }

  const meilleures = new Map();
  for (const r of lignes) {
    const actuel = meilleures.get(r.name_key);
    const mieux = !actuel
      || PRESTIGE[r.echelon] > PRESTIGE[actuel.echelon]
      || (PRESTIGE[r.echelon] === PRESTIGE[actuel.echelon] && r.place < actuel.place)
      || (PRESTIGE[r.echelon] === PRESTIGE[actuel.echelon] && r.place === actuel.place
          && r.obtenu_le > actuel.obtenu_le);
    if (mieux) {
      meilleures.set(r.name_key, {
        echelon: r.echelon, zone: r.zone, place: r.place,
        zoneNom: nomZone(r.zone, r.echelon).nom,
      });
    }
  }
  return meilleures;
}

/** Le pays de chacun, pour un ensemble de joueurs. */
export async function paysDe(db, cles) {
  await ensureChampTables(db);
  const liste = [...new Set((cles || []).map(c => String(c || '').toLowerCase()).filter(Boolean))];
  if (!liste.length) return new Map();
  const m = new Map();
  for (const bloc of paquets(liste)) {
    const trous = bloc.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT name_key, pays FROM player_pays WHERE name_key IN (${trous})`
    ).bind(...bloc).all();
    for (const r of results || []) m.set(r.name_key, r.pays);
  }
  return m;
}

/** Le titre porte par un joueur, s'il en porte un et qu'il court toujours. */
export async function titresDe(db, nameKey) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `SELECT echelon, zone, libelle, sacre_le, expire_le
       FROM champ_titres WHERE name_key = ? AND expire_le > ?
      ORDER BY sacre_le DESC`
  ).bind(String(nameKey).toLowerCase(), Date.now()).all();
  return results || [];
}

/** Sacre le vainqueur d'une finale et lui pose son titre pour trois mois. */
export async function sacrer(db, edition, gagnant) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT echelon, zone FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };

  // « Champion de {zone} » attend la forme avec preposition : de France, du
  // Maroc, des Etats-Unis. Le mondial, lui, n'a pas de zone a nommer.
  const z = nomZone(e.zone, e.echelon);
  const libelle = e.echelon === 'mondial'
    ? ECHELONS.mondial.titre
    : (ECHELONS[e.echelon].titre || '{zone}')
        .replace('Champion de {zone}', 'Champion ' + z.avec)
        .replace('Champion d’{zone}', 'Champion ' + z.avec)
        .replace('{zone}', z.nom);
  const maintenant = Date.now();
  const expire = new Date(maintenant);
  expire.setMonth(expire.getMonth() + TITRE_MOIS);

  await db.batch([
    db.prepare(
      `INSERT INTO champ_titres (echelon, zone, name_key, nom, libelle, edition, sacre_le, expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.echelon, e.zone, gagnant.cle, gagnant.nom, libelle, edition, maintenant, expire.getTime()),
    db.prepare(
      `UPDATE champ_editions SET etat = 'terminee', champion_key = ?, champion_nom = ?, fini_le = ?
        WHERE id = ?`
    ).bind(gagnant.cle, gagnant.nom, maintenant, edition),
  ]);

  await annoncer(db, {
    edition, echelon: e.echelon, zone: e.zone, type: 'sacre',
    titre: gagnant.nom + ' — ' + libelle,
    texte: 'Titre porté ' + TITRE_MOIS + ' mois.',
    donnees: { champion: gagnant.nom, libelle, expire_le: expire.getTime() },
  });

  return { libelle, champion: gagnant.nom, expire_le: expire.getTime() };
}

/**
 * Le fil des annonces, pour la diffusion en direct.
 *
 * `depuis` est un identifiant, pas une date : un client qui a deja vu
 * l'annonce 412 demande la suite et recoit exactement ce qu'il n'a pas vu,
 * sans trou ni doublon meme si deux annonces tombent dans la meme milliseconde.
 * C'est ce qui permet a un ecran de rester ouvert un weekend entier.
 */
export async function fluxDirect(db, { zone = null, depuis = 0, limite = 50 } = {}) {
  await ensureChampTables(db);
  const z = zone ? String(zone).toUpperCase() : null;
  const { results } = await db.prepare(
    z
      ? `SELECT * FROM champ_annonces WHERE zone = ? AND id > ? ORDER BY id LIMIT ?`
      : `SELECT * FROM champ_annonces WHERE id > ? ORDER BY id LIMIT ?`
  ).bind(...(z ? [z, depuis, limite] : [depuis, limite])).all();

  const annonces = (results || []).map(r => ({
    id: r.id, edition: r.edition, echelon: r.echelon, zone: r.zone,
    zoneNom: nomZone(r.zone, r.echelon).nom,
    type: r.type, titre: r.titre, texte: r.texte,
    donnees: r.donnees ? JSON.parse(r.donnees) : null,
    au: r.au, pousser: !!r.pousser,
  }));
  return {
    annonces,
    curseur: annonces.length ? annonces[annonces.length - 1].id : depuis,
  };
}

/**
 * Le recapitulatif mondial : qui court, qui vient d'etre sacre.
 *
 * L'ecran existe pour une raison precise — un joueur seul devant sa course ne
 * voit pas qu'il participe a quelque chose de mondial. Cette vue le lui montre :
 * les editions en cours partout, et les champions qui tombent un par un.
 */
export async function recapMondial(db, { echelon = null } = {}) {
  await ensureChampTables(db);
  const args = [], ou = [];
  if (echelon) { ou.push('echelon = ?'); args.push(echelon); }
  const filtre = ou.length ? 'WHERE ' + ou.join(' AND ') : '';

  const { results: editions } = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, phase, etat,
            champion_nom, fini_le
       FROM champ_editions ${filtre} ORDER BY debut DESC, zone`
  ).bind(...args).all();

  // Quatre etats, quatre sorts. Ranger tout ce qui n'est pas termine dans
  // « en cours » etait juste tant qu'il n'y avait que deux etats ; ca ne l'est
  // plus. Une edition annoncee ne court pas encore, une edition annulee ne
  // courra pas — les compter parmi celles qui courent afficherait des
  // competitions qui n'ont pas lieu.
  const annoncees = [], encours = [], sacres = [], annulees = [];
  for (const e of editions || []) {
    const z = nomZone(e.zone, e.echelon);
    const ligne = {
      edition: e.id, echelon: e.echelon, zone: e.zone, zoneNom: z.nom,
      epreuve: e.epreuve || EPREUVE_DEFAUT,
      debut: e.debut, phase: e.phase,
      cloture: e.cloture ?? null,
      // L'etat manquait, et le tableau de bord le lisait quand meme : son
      // `e.etat === 'terminee'` etait donc toujours faux, et toute edition
      // s'affichait « en cours ». Le defaut ne se voyait pas tant que la seule
      // autre possibilite etait d'etre effectivement en cours.
      etat: e.etat,
    };
    if (e.etat === 'terminee') sacres.push({ ...ligne, champion: e.champion_nom, fini_le: e.fini_le });
    else if (e.etat === 'annoncee') annoncees.push(ligne);
    else if (e.etat === 'annulee') annulees.push(ligne);
    else encours.push(ligne);
  }
  sacres.sort((a, b) => (b.fini_le || 0) - (a.fini_le || 0));
  // Les prochaines d'abord : ce bloc sert a donner envie d'y etre.
  annoncees.sort((a, b) => a.debut - b.debut);

  return {
    // `annoncees` est le seul endroit du recapitulatif qui parle a qui n'est
    // pas encore selectionne — c'est-a-dire au plus grand nombre.
    annoncees, encours, sacres, annulees,
    // Une edition annulee ne compte pas dans le total : elle n'a pas eu lieu.
    total: annoncees.length + encours.length + sacres.length,
    termines: sacres.length,
  };
}

export { FORMAT, ECHELONS, TITRE_MOIS, CALENDRIER, qualifier, podium, calendrier };
