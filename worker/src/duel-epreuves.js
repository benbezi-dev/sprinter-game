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
--------------------------------------------------------------------------- */

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

async function ensureTable(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS epreuves_voix (
      evenement TEXT NOT NULL, jour TEXT NOT NULL, device_id TEXT NOT NULL,
      name_key TEXT, epreuve TEXT NOT NULL, at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS epreuves_voix_jour
      ON epreuves_voix (evenement, jour, device_id)`),
  ]);
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

/** Le tableau : voix et joueurs par epreuve, l'epreuve en tete, mes voix du jour. */
export async function tableauEpreuves(db, { test, deviceId, maintenant = Date.now() }) {
  await ensureTable(db);
  const ev = evenementDe(test);
  const { results } = await db.prepare(
    `SELECT epreuve, COUNT(*) AS voix, COUNT(DISTINCT device_id) AS joueurs
       FROM epreuves_voix WHERE evenement = ? GROUP BY epreuve`
  ).bind(ev).all();
  const epreuves = Object.fromEntries(EPREUVES_DUEL.map(e => [e, { voix: 0, joueurs: 0 }]));
  for (const r of results || []) if (epreuves[r.epreuve]) epreuves[r.epreuve] = { voix: r.voix, joueurs: r.joueurs };
  const mes = deviceId ? await mesVoixDuJour(db, ev, jourDeParis(maintenant), deviceId) : 0;
  return {
    ...fenetreEpreuves(test, maintenant),
    epreuves,
    en_tete: enTete(epreuves),
    retenues: retenues(epreuves),
    voix_par_jour: VOIX_PAR_JOUR,
    mes_voix_du_jour: mes,
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
