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
  FORMAT, ECHELONS, TITRE_MOIS, REPLI_PAYS_TROP_PETIT, CALENDRIER,
} from './championnats-config.js';
import { serpentin, qualifier, podium, calendrier } from './championnats-moteur.js';

/** Le continent d'un pays. Table courte : on n'y met que ce qu'on utilise. */
const CONTINENTS = {
  EU: ['FR','BE','CH','DE','ES','IT','PT','GB','IE','NL','LU','AT','PL','SE','NO','DK','FI','GR','RO','HU','CZ','SK','BG','HR','RS','UA','RU','TR','AL','BA','MK','SI','LT','LV','EE','IS','MT','CY','MD','ME','MC','AD','SM','LI'],
  AF: ['MA','DZ','TN','LY','EG','SN','CI','ML','BF','NE','TD','CM','GA','CG','CD','AO','ZA','NG','GH','GN','BJ','TG','MR','KE','ET','TZ','UG','RW','BI','ZM','ZW','MZ','MG','MU','SO','SD','CF','GM','GW','SL','LR','CV','DJ','ER','BW','NA','LS','SZ','MW','ST','KM','SC','GQ'],
  AM: ['US','CA','MX','BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GT','CU','HT','DO','HN','NI','CR','PA','SV','JM','TT','GY','SR','BZ','BS','BB'],
  AS: ['CN','JP','KR','IN','ID','PK','BD','VN','TH','PH','MY','SG','MM','KH','LA','NP','LK','KZ','UZ','AZ','GE','AM','IL','SA','AE','QA','KW','BH','OM','JO','LB','SY','IQ','IR','YE','AF','MN','TW','HK','MO','BN','TJ','KG','TM','MV','BT'],
  OC: ['AU','NZ','FJ','PG','NC','PF','SB','VU','WS','TO','KI','FM','MH','PW','NR','TV'],
};
const PAYS_CONTINENT = {};
for (const [c, pays] of Object.entries(CONTINENTS)) for (const p of pays) PAYS_CONTINENT[p] = c;

export function continentDe(pays) {
  return PAYS_CONTINENT[String(pays || '').toUpperCase()] || null;
}

let pret = false;
export async function ensureChampTables(db) {
  if (pret) return;
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
  ]);
  pret = true;
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
 * Ouvre une edition nationale : fige les 32 meilleurs du pays et seme la grille.
 *
 * « Figes a la cloture » est le point important : une fois l'edition ouverte,
 * le classement des duels peut bouger comme il veut, la grille ne bouge plus.
 * Sans quoi un joueur pourrait entrer ou sortir de la competition entre deux
 * courses, ce qui n'aurait aucun sens.
 */
export async function ouvrirNational(db, { pays, debutSamedi }) {
  await ensureChampTables(db);
  const cfg = ECHELONS.national;
  const p = String(pays).toUpperCase();

  const n = await effectifPays(db, p, cfg.fenetreActiviteJours);
  if (n < cfg.minJoueurs) {
    return { erreur: 'pays trop petit', joueurs: n, requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT };
  }

  const depuis = Date.now() - cfg.fenetreActiviteJours * 24 * 3600 * 1000;
  const { results } = await db.prepare(
    `SELECT d.name_key, d.name, d.points, d.wins, d.losses
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE g.pays = ? AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY d.points DESC, d.wins DESC, d.losses ASC, d.name ASC
      LIMIT ?`
  ).bind(p, depuis, FORMAT.partants).all();

  const joueurs = (results || []).map((r, i) => ({
    cle: r.name_key, nom: r.name, rang: i + 1,
  }));
  if (joueurs.length < FORMAT.partants) {
    return { erreur: 'grille incomplete', joueurs: joueurs.length };
  }

  const id = code();
  const phase0 = FORMAT.phases[0];
  const grille = serpentin(joueurs, phase0.courses);

  await db.prepare(
    `INSERT INTO champ_editions (id, echelon, zone, debut, phase, etat, cree_le)
     VALUES (?, 'national', ?, ?, ?, 'ouverte', ?)`
  ).bind(id, p, debutSamedi, phase0.cle, Date.now()).run();

  const lignes = [];
  grille.forEach((course, ic) => course.forEach(j => {
    lignes.push(db.prepare(
      `INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, j.cle, j.nom, j.rang, phase0.cle, ic + 1));
  }));
  await db.batch(lignes);

  return {
    edition: id, pays: p, partants: joueurs.length,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c })),
    calendrier: calendrier(debutSamedi, CALENDRIER),
  };
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

  const libelle = (ECHELONS[e.echelon].titre || '{zone}').replace('{zone}', e.zone);
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
  return { libelle, champion: gagnant.nom, expire_le: expire.getTime() };
}

export { FORMAT, ECHELONS, TITRE_MOIS, CALENDRIER, qualifier, podium, calendrier };
