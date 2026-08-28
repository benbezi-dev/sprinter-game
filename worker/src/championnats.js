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
  ANNONCES,
} from './championnats-config.js';
import { serpentin, qualifier, podium, calendrier, ordonner } from './championnats-moteur.js';
// Les championnats lisent le classement des duels : sur une base neuve, cette
// table doit exister avant qu'on la joigne, sans quoi la requete echoue.
import { ensureDuelTables } from './duels.js';

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

    // Une edition : un championnat, un echelon, une zone, un weekend.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_editions (
      id TEXT PRIMARY KEY,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      debut INTEGER NOT NULL,
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

/** Le classement des duels d'une zone, pour completer une grille. */
async function classement(db, { pays = null, continent = null, exclure, limite }) {
  const depuis = Date.now() - ECHELONS.national.fenetreActiviteJours * 24 * 3600 * 1000;
  const ou = pays ? 'g.pays = ?' : continent ? 'g.continent = ?' : '1 = 1';
  const args = pays ? [pays] : continent ? [continent] : [];
  const { results } = await db.prepare(
    `SELECT d.name_key AS cle, d.name AS nom, d.points
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE ${ou} AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY d.points DESC, d.wins DESC, d.losses ASC, d.name ASC
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

/** Les champions en titre d'un echelon, encore porteurs a cette seconde. */
async function championsEnTitre(db, echelon, filtreZone) {
  const { results } = await db.prepare(
    `SELECT t.name_key AS cle, t.nom, t.zone, t.sacre_le,
            COALESCE(d.points, 0) AS points
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
 * Renvoie { joueurs, doffice } ou une erreur. `doffice` est l'ensemble des cles
 * qualifiees par leur titre plutot que par leur classement — l'information
 * interesse l'affichage, pas la competition.
 */
async function pool(db, echelon, zone) {
  if (echelon === 'national') {
    const cfg = ECHELONS.national;
    const n = await effectifPays(db, zone, cfg.fenetreActiviteJours);
    if (n < cfg.minJoueurs) {
      return { erreur: 'pays trop petit', joueurs: n, requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT };
    }
    const l = await classement(db, { pays: zone, exclure: new Set(), limite: FORMAT.partants });
    return { joueurs: l, doffice: new Set() };
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
    exclure, limite: FORMAT.partants - champions.length,
  });

  const joueurs = [...champions, ...complement];
  return { joueurs, doffice: exclure };
}

/**
 * Ouvre une edition et seme sa grille.
 *
 * « Figes a la cloture » est le point important : une fois l'edition ouverte,
 * le classement des duels peut bouger comme il veut, la grille ne bouge plus.
 * Sans quoi un joueur pourrait entrer ou sortir de la competition entre deux
 * courses, ce qui n'aurait aucun sens.
 */
export async function ouvrirEchelon(db, { echelon, zone, debutSamedi }) {
  await ensureChampTables(db);
  if (!ECHELONS[echelon]) return { erreur: 'echelon inconnu' };
  const z = String(zone || 'MONDE').toUpperCase();

  // Une zone ne tient qu'un championnat a la fois. Deux editions ouvertes pour
  // le meme pays produiraient deux champions du meme endroit, et un titre qui
  // ne veut plus rien dire.
  const deja = await db.prepare(
    `SELECT id, debut FROM champ_editions
      WHERE echelon = ? AND zone = ? AND etat <> 'terminee' LIMIT 1`
  ).bind(echelon, z).first();
  if (deja) return { erreur: 'edition deja ouverte', edition: deja.id, debut: deja.debut };

  const p = await pool(db, echelon, z);
  if (p.erreur) return p;
  if (p.joueurs.length < FORMAT.partants) {
    return { erreur: 'grille incomplete', joueurs: p.joueurs.length, requis: FORMAT.partants };
  }

  // Le semis se fait au classement des duels pour tout le monde, titre ou pas.
  // Placer les champions en tete de serie parce qu'ils sont champions
  // desequilibrerait les series, ce que le serpentin existe precisement pour
  // eviter : on qualifie par le titre, on seme au niveau mesure.
  const joueurs = [...p.joueurs]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .map((j, i) => ({ cle: j.cle, nom: j.nom, rang: i + 1, doffice: p.doffice.has(j.cle) }));

  const id = code();
  const phase0 = FORMAT.phases[0];
  const grille = serpentin(joueurs, phase0.courses);

  await db.prepare(
    `INSERT INTO champ_editions (id, echelon, zone, debut, phase, etat, cree_le)
     VALUES (?, ?, ?, ?, ?, 'ouverte', ?)`
  ).bind(id, echelon, z, debutSamedi, phase0.cle, Date.now()).run();

  const lignes = [];
  grille.forEach((course, ic) => course.forEach(j => {
    lignes.push(db.prepare(
      `INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, j.cle, j.nom, j.rang, phase0.cle, ic + 1));
  }));
  await db.batch(lignes);

  const nom = nomZone(z, echelon);
  await annoncer(db, {
    edition: id, echelon, zone: z, type: 'ouverture',
    titre: echelon === 'mondial' ? 'Championnat du monde' : ECHELONS[echelon].nom + ' ' + nom.avec,
    texte: FORMAT.partants + ' partants, ' + phase0.courses + ' séries. Premier départ samedi.',
    donnees: { partants: joueurs.length, doffice: p.doffice.size },
  });

  return {
    edition: id, echelon, zone: z, pays: echelon === 'national' ? z : undefined,
    partants: joueurs.length, doffice: p.doffice.size,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c })),
    calendrier: calendrier(debutSamedi, CALENDRIER),
  };
}

/** Ouvre une edition nationale. Conserve pour les appels existants. */
export async function ouvrirNational(db, { pays, debutSamedi }) {
  return ouvrirEchelon(db, { echelon: 'national', zone: pays, debutSamedi });
}

/**
 * Ouvre le meme weekend pour tous les pays qui peuvent le tenir.
 *
 * « Tous les championnats nationaux ont lieu le meme weekend » n'est pas un
 * detail d'affichage : c'est ce qui fait qu'un joueur sait que pendant qu'il
 * court sa serie, trente autres pays courent la leur. Une seule date, passee
 * a tout le monde, et les pays trop petits ressortent dans `ecartes` avec
 * leur raison plutot que d'echouer en silence.
 */
export async function ouvrirCycle(db, { debutSamedi, echelon = 'national' }) {
  await ensureChampTables(db);
  const ouvertes = [], ecartes = [];

  if (echelon === 'national') {
    for (const p of await paysEligibles(db)) {
      if (!p.eligible) { ecartes.push({ zone: p.pays, raison: 'pays trop petit', joueurs: p.joueurs, repli: p.repli }); continue; }
      const r = await ouvrirEchelon(db, { echelon: 'national', zone: p.pays, debutSamedi });
      if (r.erreur) ecartes.push({ zone: p.pays, raison: r.erreur, ...r });
      else ouvertes.push({ zone: p.pays, edition: r.edition, partants: r.partants });
    }
  } else if (echelon === 'continental') {
    for (const c of Object.keys(CONTINENTS)) {
      const r = await ouvrirEchelon(db, { echelon: 'continental', zone: c, debutSamedi });
      if (r.erreur) ecartes.push({ zone: c, raison: r.erreur, ...r });
      else ouvertes.push({ zone: c, edition: r.edition, partants: r.partants });
    }
  } else {
    const r = await ouvrirEchelon(db, { echelon: 'mondial', zone: 'MONDE', debutSamedi });
    if (r.erreur) ecartes.push({ zone: 'MONDE', raison: r.erreur, ...r });
    else ouvertes.push({ zone: 'MONDE', edition: r.edition, partants: r.partants });
  }

  return { echelon, debut: debutSamedi, ouvertes, ecartes };
}

/**
 * Les trois weekends d'un cycle, deduits du premier.
 *
 * Les delais entre echelons sont en configuration : ils servent a agreger les
 * champions et a fabriquer l'attente, et ce sont exactement les nombres qu'on
 * voudra bouger apres le premier cycle.
 */
export function calendrierCycle(debutSamedi) {
  const SEMAINE = 7 * 24 * 3600 * 1000;
  const nat = debutSamedi;
  const con = nat + ECHELONS.continental.semainesApresPrecedent * SEMAINE;
  const mon = con + ECHELONS.mondial.semainesApresPrecedent * SEMAINE;
  return [
    { echelon: 'national',    debut: nat, rendezVous: calendrier(nat, CALENDRIER) },
    { echelon: 'continental', debut: con, rendezVous: calendrier(con, CALENDRIER) },
    { echelon: 'mondial',     debut: mon, rendezVous: calendrier(mon, CALENDRIER) },
  ];
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
    `SELECT id, echelon, zone, debut, phase, etat, champion_nom, fini_le
       FROM champ_editions ${filtre} ORDER BY debut DESC, zone`
  ).bind(...args).all();

  const encours = [], sacres = [];
  for (const e of editions || []) {
    const z = nomZone(e.zone, e.echelon);
    const ligne = {
      edition: e.id, echelon: e.echelon, zone: e.zone, zoneNom: z.nom,
      debut: e.debut, phase: e.phase,
    };
    if (e.etat === 'terminee') {
      sacres.push({ ...ligne, champion: e.champion_nom, fini_le: e.fini_le });
    } else {
      encours.push(ligne);
    }
  }
  sacres.sort((a, b) => (b.fini_le || 0) - (a.fini_le || 0));

  return {
    encours, sacres,
    total: (editions || []).length,
    termines: sacres.length,
  };
}

export { FORMAT, ECHELONS, TITRE_MOIS, CALENDRIER, qualifier, podium, calendrier };
