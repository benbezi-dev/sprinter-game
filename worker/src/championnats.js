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
  return {
    id: e.id, echelon: e.echelon, zone: e.zone, debut: e.debut,
    phase: e.phase, etat: e.etat,
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
  return { ok: true, enregistres: lignes.length, sur: attendus.size };
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

  return {
    phase: e.phase, suivante: suivante.cle,
    directs: q.directs.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
    repeches: q.repeches.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
    elimines: q.elimines.length,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c.map(j => j.nom) })),
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
  return { libelle, champion: gagnant.nom, expire_le: expire.getTime() };
}

export { FORMAT, ECHELONS, TITRE_MOIS, CALENDRIER, qualifier, podium, calendrier };
