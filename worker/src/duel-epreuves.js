/* ---------------------------------------------------------------------------
   LE DUEL DES EPREUVES — quelle epreuve pour le Championnat de France du
   samedi 19/12/2026, en salle Jesse Owens ? (decide par l'auteur le 08/11)

   Trois epreuves en salle : 60 m, 200 m et 400 m (cles '60', '200s', '400s').
   1 COURSE FINIE = 1 VOIX pour son epreuve — ce que dit la video d'annonce.
   On compte depuis `/race`, que tous les jeux envoient deja, applis installees
   comprises : rien a mettre a jour cote telephone pour que les voix comptent.

   AU PLUS 10 VOIX PAR JOUR ET PAR APPAREIL, toutes epreuves confondues : un
   joueur seul ne decide pas en enchainant les courses. La 11e course du jour
   reste une course (historique, records), elle ne vote plus.

   Pas de preuve par la trace : `/race` n'en porte pas. Le plafond borne ce
   qu'un faux envoi peut peser.

   Ouvert du lundi 9/11 21 h 30 au dimanche 6/12 minuit (heure de Paris). Le
   canal de test vote en permanence, dans son propre decompte.

   LES FANTOMES (demande de l'auteur le 11/11, vote deja ouvert) — pour que le
   vote se joue au lieu de se compter :

   - Chaque course de vote depose le FANTOME du joueur sur son epreuve : la
     trace de son meilleur chrono du duel (verifierTrace a l'appui).
   - ANNULER : on court une epreuve contre le fantome d'un joueur qui y a des
     voix. Le battre lui annule `ANNULEES_PAR_VICTOIRE` voix. La course, elle,
     vote quand meme pour son epreuve (1 course = 1 voix, toujours) : gagner
     fait -3 +1 a l'epreuve visee, perdre lui donne +1. Viser juste coute.
   - PERSONNE N'EST A L'ABRI. Kin et Barnabe courent 0,3 s devant le troisieme :
     contre leur meilleur chrono nu, personne ne les battrait. Un fantome PESE
     donc ses voix : `POIDS_PAR_VOIX` de plus par voix qu'il tient sur
     l'epreuve, jusqu'a `POIDS_MAX`. Plus on domine, plus on est prenable ; et
     chaque defaite allege — le roi redevient dur a prendre. Meme logique que
     l'etoile de Noel, acceptee par l'auteur.
   - LE FANTOME A TA MESURE. Le serveur choisit l'adversaire : celui dont le
     chrono a battre est juste devant ton meilleur sur cette epreuve. Personne
     devant toi : le plus rapide. Pas encore de chrono : le plus lent. Chacun
     a une course serree, du debutant a Kin.
   - Les annulations partagent le plafond du jour : `VOIX_PAR_JOUR` attaques
     au plus par appareil. Les voix du renfort de l'auteur n'appartiennent a
     personne : aucun fantome ne les protege, aucune course ne les annule.
--------------------------------------------------------------------------- */
import { verifierTrace } from './preuve.js';
import { sousLePlancher } from './plancher.js';

export const EPREUVES_DUEL = ['60', '200s', '400s'];
export const VOIX_PAR_JOUR = 10;
// Paris est a UTC+1 sur toute la fenetre (heure d'hiver du 25/10 au 28/03).
export const DEBUT = Date.UTC(2026, 10, 9, 20, 30);   // lun. 9/11 21 h 30 Paris
export const FIN = Date.UTC(2026, 11, 6, 23, 0);      // lun. 7/12 0 h Paris
const EVENEMENT = 'epreuves-2026';

const evenementDe = test => test ? `${EVENEMENT}-test` : EVENEMENT;

// shortcut: decalage fixe +1 h, juste tant que la fenetre reste en heure d'hiver.
export const jourDeParis = at => new Date(at + 3600_000).toISOString().slice(0, 10);

export function fenetreEpreuves(test, maintenant = Date.now()) {
  if (test) return { ouvert: true, debut: DEBUT, fin: FIN };
  return { ouvert: maintenant >= DEBUT && maintenant < FIN, debut: DEBUT, fin: FIN };
}

const pret = new WeakSet();
async function ensureTable(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS epreuves_voix (
      evenement TEXT NOT NULL, jour TEXT NOT NULL, device_id TEXT NOT NULL,
      name_key TEXT, epreuve TEXT NOT NULL, at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS epreuves_voix_jour
      ON epreuves_voix (evenement, jour, device_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS epreuves_fantomes (
      evenement TEXT NOT NULL, name_key TEXT NOT NULL, epreuve TEXT NOT NULL,
      name TEXT NOT NULL, ms INTEGER NOT NULL, trace TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key, epreuve))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS epreuves_attaques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evenement TEXT NOT NULL, jour TEXT NOT NULL, device_id TEXT NOT NULL,
      name_key TEXT NOT NULL, name TEXT NOT NULL, epreuve TEXT NOT NULL,
      cible_key TEXT NOT NULL, cible_nom TEXT NOT NULL,
      ms INTEGER NOT NULL, a_battre_ms INTEGER NOT NULL,
      gagne INTEGER NOT NULL, annulees INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS epreuves_attaques_jour
      ON epreuves_attaques (evenement, jour, device_id)`),
  ]);
  // Une voix annulee garde sa ligne (le plafond du jour la compte toujours).
  try { await db.prepare(`ALTER TABLE epreuves_voix ADD COLUMN annulee INTEGER`).run(); }
  catch (e) { /* deja la */ }
  pret.add(db);
}

/**
 * Une course finie : une voix si l'epreuve vote, si le duel est ouvert et si
 * l'appareil n'a pas deja vote dix fois aujourd'hui. Rend null hors duel.
 */
export async function noterVoix(db, { test, deviceId, nameKey, epreuve, at = Date.now() }) {
  if (!EPREUVES_DUEL.includes(epreuve) || !fenetreEpreuves(test, at).ouvert) return null;
  await ensureTable(db);
  const ev = evenementDe(test), jour = jourDeParis(at);
  // Une seule requete : le compte et l'insertion ne peuvent pas se croiser.
  const r = await db.prepare(
    `INSERT INTO epreuves_voix (evenement, jour, device_id, name_key, epreuve, at)
     SELECT ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM epreuves_voix WHERE evenement = ? AND jour = ? AND device_id = ?) < ?`
  ).bind(ev, jour, deviceId, nameKey || null, epreuve, at, ev, jour, deviceId, VOIX_PAR_JOUR).run();
  const n = await mesVoixDuJour(db, ev, jour, deviceId);
  return { epreuve, comptee: (r.meta?.changes || 0) > 0, restantes: Math.max(0, VOIX_PAR_JOUR - n) };
}

async function mesVoixDuJour(db, ev, jour, deviceId) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM epreuves_voix WHERE evenement = ? AND jour = ? AND device_id = ?`
  ).bind(ev, jour, deviceId).first();
  return row ? row.n : 0;
}

/*
 * Voix ajoutees par l'auteur (10/11) : +600 au 200 m sur 5 j et demi, +600 au
 * 400 m sur 7 j, en montee lineaire depuis le 10/11 23 h Paris — rien d'un coup.
 * Calcule a la lecture, rien n'est ecrit en base : retirer RENFORT les efface.
 */
const RENFORT = { '200s': { voix: 600, jours: 5.5 }, '400s': { voix: 600, jours: 7 } };
const RENFORT_DEBUT = Date.UTC(2026, 10, 10, 22, 0);
export function renfort(e, t) {
  const r = RENFORT[e];
  if (!r) return 0;
  return Math.floor(r.voix * Math.min(1, Math.max(0, (t - RENFORT_DEBUT) / (r.jours * 86400_000))));
}

/** Le tableau : voix et joueurs par epreuve, l'epreuve en tete, mes voix du jour. */
export async function tableauEpreuves(db, { test, deviceId, maintenant = Date.now() }) {
  await ensureTable(db);
  const ev = evenementDe(test);
  const { results } = await db.prepare(
    `SELECT epreuve, COUNT(*) AS voix, COUNT(DISTINCT device_id) AS joueurs
       FROM epreuves_voix WHERE evenement = ? AND annulee IS NULL GROUP BY epreuve`
  ).bind(ev).all();
  const epreuves = Object.fromEntries(EPREUVES_DUEL.map(e => [e, { voix: 0, joueurs: 0 }]));
  for (const r of results || []) if (epreuves[r.epreuve]) epreuves[r.epreuve] = { voix: r.voix, joueurs: r.joueurs };
  if (!test) for (const e in RENFORT) {
    const v = renfort(e, maintenant);
    epreuves[e] = { voix: epreuves[e].voix + v, joueurs: epreuves[e].joueurs + Math.floor(v / 7) };
  }
  const mes = deviceId ? await mesVoixDuJour(db, ev, jourDeParis(maintenant), deviceId) : 0;
  const { results: fil } = await db.prepare(
    `SELECT name AS qui, cible_nom AS cible, epreuve, annulees, at FROM epreuves_attaques
      WHERE evenement = ? AND gagne = 1 ORDER BY id DESC LIMIT ?`
  ).bind(ev, FIL_N).all();
  return {
    ...fenetreEpreuves(test, maintenant),
    epreuves,
    en_tete: enTete(epreuves),
    retenues: retenues(epreuves),
    voix_par_jour: VOIX_PAR_JOUR,
    mes_voix_du_jour: mes,
    annulees_par_victoire: ANNULEES_PAR_VICTOIRE,
    fil: fil || [],
    fantomes: Object.fromEntries(await Promise.all(EPREUVES_DUEL.map(async e => [e,
      (await candidats(db, ev, e)).sort((a, b) => b.voix - a.voix || a.a_battre - b.a_battre).slice(0, FANTOMES_N)
        .map(c => ({ name: c.name, cible: c.name_key, ms: c.ms, a_battre_ms: c.a_battre, voix: c.voix }))]))),
  };
}

/** Moins de 5 % d'ecart avec la premiere : egalite, l'epreuve est retenue aussi. */
export const ECART_EGALITE = 0.05;

/**
 * Les epreuves retenues pour le 19/12 : la premiere en voix, et toute autre a
 * moins de 5 % d'elle (decide par l'auteur le 08/11) — dans ce cas, on court
 * les deux championnats le meme weekend. Vide tant que personne n'a vote.
 */
export function retenues(epreuves) {
  const tri = EPREUVES_DUEL.map(e => ({ e, voix: epreuves[e].voix })).sort((a, b) => b.voix - a.voix);
  const max = tri[0].voix;
  if (!max) return [];
  return tri.filter(x => (max - x.voix) / max < ECART_EGALITE).map(x => x.e);
}

/** L'epreuve seule en tete, ou null (personne, ou egalite a moins de 5 %). */
export function enTete(epreuves) {
  const r = retenues(epreuves);
  return r.length === 1 ? r[0] : null;
}

/* ------------------------------------------------------------- les fantomes */

/** Ce qu'une victoire sur un fantome annule de voix a son joueur. */
export const ANNULEES_PAR_VICTOIRE = 3;
/** Un fantome ralentit de 0,1 % par voix qu'il tient sur l'epreuve... */
export const POIDS_PAR_VOIX = 0.001;
/** ...jusqu'a +20 % (200 voix). */
export const POIDS_MAX = 0.2;
const FIL_N = 6;
/** Les fantomes les plus charges, par epreuve, montres au tableau. */
const FANTOMES_N = 8;

/** Le facteur d'un fantome qui tient `voix` voix : 1 a 1,2. */
export const facteurDe = voix => 1 + Math.min(POIDS_MAX, Math.max(0, voix) * POIDS_PAR_VOIX);

/**
 * Le fantome a ta mesure. `candidats` : [{ name_key, a_battre }]. Celui juste
 * devant `monMs` (le plus lent des plus rapides) ; personne devant : le plus
 * rapide ; pas de chrono : le plus lent. Rend null sans candidat.
 */
export function choisirAdversaire(candidats, monMs) {
  if (!candidats.length) return null;
  const tri = [...candidats].sort((a, b) => a.a_battre - b.a_battre);
  if (!monMs) return tri[tri.length - 1];
  const devant = tri.filter(c => c.a_battre < monMs);
  return devant.length ? devant[devant.length - 1] : tri[0];
}

/** Les fantomes d'une epreuve qui tiennent encore des voix, avec leur chrono a battre. */
async function candidats(db, ev, epreuve) {
  const { results } = await db.prepare(
    `SELECT f.name_key, f.name, f.ms, f.trace, v.n AS voix FROM epreuves_fantomes f
       JOIN (SELECT name_key, COUNT(*) AS n FROM epreuves_voix
              WHERE evenement = ? AND epreuve = ? AND annulee IS NULL GROUP BY name_key) v
         ON v.name_key = f.name_key
      WHERE f.evenement = ? AND f.epreuve = ?`
  ).bind(ev, epreuve, ev, epreuve).all();
  return (results || []).map(r => {
    const facteur = facteurDe(r.voix);
    return { ...r, facteur, a_battre: Math.round(r.ms * facteur) };
  });
}

async function monChrono(db, ev, nameKey, epreuve) {
  const r = await db.prepare(
    `SELECT ms FROM epreuves_fantomes WHERE evenement = ? AND name_key = ? AND epreuve = ?`
  ).bind(ev, nameKey, epreuve).first();
  return r ? r.ms : null;
}

/** Le fantome a affronter sur `epreuve` pour annuler des voix. */
export async function fantomeAAffronter(db, { test, nameKey, epreuve, cibleKey = null, maintenant = Date.now() }) {
  if (!EPREUVES_DUEL.includes(epreuve)) return { status: 400, corps: { error: 'epreuve inconnue' } };
  if (!fenetreEpreuves(test, maintenant).ouvert) return { status: 409, corps: { error: 'duel ferme' } };
  await ensureTable(db);
  const ev = evenementDe(test);
  const tous = (await candidats(db, ev, epreuve)).filter(x => x.name_key !== nameKey);
  // Une cible nommee (la liste du tableau) ; sinon, le fantome a ta mesure.
  const c = cibleKey ? tous.find(x => x.name_key === cibleKey)
    : choisirAdversaire(tous, nameKey ? await monChrono(db, ev, nameKey, epreuve) : null);
  if (!c) return { status: 404, corps: { error: 'pas de fantome' } };
  let trace = [];
  try { trace = JSON.parse(c.trace); } catch (e) { trace = []; }
  return {
    status: 200,
    corps: { name: c.name, cible: c.name_key, epreuve, ms: c.ms, a_battre_ms: c.a_battre, facteur: c.facteur, voix: c.voix, trace },
  };
}

/**
 * Une course de vote (60, 200s, 400s) vient de finir, trace a l'appui. Elle
 * devient le fantome du joueur si elle bat son meilleur ; et si elle visait
 * un fantome, elle se juge contre lui tel qu'il est AVANT ce qu'elle change.
 * La voix elle-meme est deja notee par `/race` : on n'y touche pas.
 */
export async function noterCourseEpreuves(db, { test, deviceId, nameKey, name, epreuve, timeMs, trace, cibleKey = null, maintenant = Date.now() }) {
  if (!EPREUVES_DUEL.includes(epreuve)) return { status: 400, corps: { error: 'epreuve inconnue' } };
  if (!fenetreEpreuves(test, maintenant).ouvert) return { status: 409, corps: { error: 'duel ferme' } };
  const griefs = verifierTrace(trace, timeMs, epreuve);
  if (griefs.length || sousLePlancher(epreuve, timeMs)) return { status: 422, corps: { error: 'trace refusee', griefs } };
  await ensureTable(db);
  const ev = evenementDe(test), jour = jourDeParis(maintenant);

  // 1. Le verdict, contre la cible telle qu'elle est avant cette course.
  let duel = null;
  if (cibleKey && cibleKey !== nameKey) {
    const c = (await candidats(db, ev, epreuve)).find(x => x.name_key === cibleKey);
    if (c) {
      const gagne = timeMs < c.a_battre;
      // Le plafond du jour, en une requete : l'attaque n'est notee que s'il reste de la place.
      const r = await db.prepare(
        `INSERT INTO epreuves_attaques (evenement, jour, device_id, name_key, name, epreuve, cible_key, cible_nom, ms, a_battre_ms, gagne, at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM epreuves_attaques WHERE evenement = ? AND jour = ? AND device_id = ?) < ?`
      ).bind(ev, jour, deviceId, nameKey, name, epreuve, cibleKey, c.name, timeMs, c.a_battre, gagne ? 1 : 0, maintenant,
        ev, jour, deviceId, VOIX_PAR_JOUR).run();
      const notee = (r.meta?.changes || 0) > 0;
      let annulees = 0;
      if (notee && gagne) {
        const u = await db.prepare(
          `UPDATE epreuves_voix SET annulee = ? WHERE rowid IN (
             SELECT rowid FROM epreuves_voix WHERE evenement = ? AND epreuve = ? AND name_key = ? AND annulee IS NULL
              ORDER BY at DESC LIMIT ?)`
        ).bind(maintenant, ev, epreuve, cibleKey, ANNULEES_PAR_VICTOIRE).run();
        annulees = u.meta?.changes || 0;
        if (r.meta?.last_row_id) {
          await db.prepare(`UPDATE epreuves_attaques SET annulees = ? WHERE id = ?`).bind(annulees, r.meta.last_row_id).run();
        }
      }
      duel = { cible: c.name, cible_ms: c.a_battre, gagne, notee, annulees };
    }
  }

  // 2. Le fantome du joueur : son meilleur chrono du duel sur cette epreuve.
  await db.prepare(
    `INSERT INTO epreuves_fantomes (evenement, name_key, epreuve, name, ms, trace, at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(evenement, name_key, epreuve) DO UPDATE SET
       name = excluded.name, ms = excluded.ms, trace = excluded.trace, at = excluded.at
     WHERE excluded.ms < epreuves_fantomes.ms`
  ).bind(ev, nameKey, epreuve, name, timeMs, JSON.stringify(trace), maintenant).run();

  return { status: 200, corps: { ok: true, ms: timeMs, duel } };
}
