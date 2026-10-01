// L'anti-abus par adresse, et pourquoi il ne garde plus l'adresse.
//
// LE CONSTAT. Le compteur tenait une ligne par `route:IP`, ecrite en clair a
// chaque POST et jamais effacee : une ligne ne se remettait a zero qu'au
// passage suivant de la meme adresse. La table accumulait donc, sans fin, les
// adresses de tous ceux qui avaient ecrit un jour — pendant que la page de
// confidentialite affirmait qu'aucune adresse IP n'etait conservee.
//
// UNE EMPREINTE, PAS L'ADRESSE. Pour compter, il suffit de reconnaitre la
// meme adresse d'un appel a l'autre pendant une minute ; la lire n'a jamais
// servi. La cle devient un HMAC de (jour, IP) sous ADMIN_CLE, tronque a 128
// bits. Une empreinte nue (SHA-256 sans secret) ne protegerait rien : les
// quatre milliards d'adresses IPv4 se hachent en quelques minutes. Le jour
// dans le message fait qu'une empreinte d'hier ne se rapproche pas de celle
// d'aujourd'hui ; le prix est une fenetre remise a zero a minuit UTC, sans
// consequence pour des fenetres d'une minute.
//
// ET QUI S'EFFACE. Une ligne dont la fenetre est passee ne sert plus a rien :
// `sousLimite` la traite exactement comme une ligne absente. Le cron des cinq
// minutes les supprime (`purgerLimites`), si bien qu'une empreinte ne survit
// pas plus de quelques minutes a son dernier appel. Le premier passage apres
// le deploiement emporte aussi les anciennes lignes en clair : leur fenetre
// est expiree depuis longtemps.

// Regles par route : le nombre d'appels qu'une meme IP peut faire dans la
// fenetre, avant d'etre mise en attente. `/test/entrer` est la plus stricte
// des trois : c'est la seule qui ressemble a une authentification, et donc
// la seule qu'une force brute chercherait a marteler.
export const RATE_LIMITS = {
  '/test/entrer': { max: 8, fenetreMs: 60_000 },
  '/duel/mot': { max: 6, fenetreMs: 60_000 },
  // Le mot d'une course de championnat : meme geste, meme cadence. Un joueur
  // n'en pose qu'un par course, et il n'y a que treize courses dans une
  // edition — six par minute laissent passer une reprise apres une coupure et
  // arretent un script.
  '/champ/mot': { max: 6, fenetreMs: 60_000 },
  // La bulle de presentation : une par partant et par phase, reposable
  // jusqu'a l'appel. Dix par minute laissent corriger une phrase refusee par
  // le filtre, et arretent qui chercherait a le contourner par essais.
  '/champ/bulle': { max: 10, fenetreMs: 60_000 },
  // S'engager ou se retirer : un geste par selection, quelques-uns au plus.
  '/champ/engager': { max: 10, fenetreMs: 60_000 },
  // Un identifiant TURN vaut une heure de relais facture au gigaoctet. Un
  // joueur en demande un par partie ; dix par minute et par adresse laissent
  // passer une famille derriere la meme box et arretent net un script.
  '/direct/turn': { max: 10, fenetreMs: 60_000 },
  default: { max: 30, fenetreMs: 60_000 },
};

// Au-dela de la plus longue fenetre, aucune ligne ne compte plus pour rien.
const FENETRE_MAX = Math.max(...Object.values(RATE_LIMITS).map(r => r.fenetreMs));

const limitesReady = new WeakSet();
async function ensureRateLimitTable(db) {
  if (limitesReady.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
    cle TEXT PRIMARY KEY,
    fenetre_debut INTEGER NOT NULL,
    compte INTEGER NOT NULL
  )`).run();
  limitesReady.add(db);
}

// Une cle HMAC importee par secret, et non a chaque appel : l'import coute
// plus que la signature.
const clesHmac = new Map();
function cleHmac(secret) {
  if (!clesHmac.has(secret)) {
    clesHmac.set(secret, crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    ));
  }
  return clesHmac.get(secret);
}

/**
 * L'empreinte sous laquelle on compte une adresse, ce jour-la.
 *
 * Sans secret (un worker local sans `.dev.vars`), on signe sous une
 * constante : le compteur marche, mais l'empreinte redevient reversible —
 * acceptable hors production, ou ADMIN_CLE est toujours posee.
 */
export async function empreinteIp(ip, secret, maintenant = Date.now()) {
  const jour = new Date(maintenant).toISOString().slice(0, 10);
  const signature = await crypto.subtle.sign(
    'HMAC', await cleHmac(secret || 'sprinter-limites'),
    new TextEncoder().encode(`${jour}:${ip}`),
  );
  return [...new Uint8Array(signature, 0, 16)]
    .map(o => o.toString(16).padStart(2, '0')).join('');
}

/**
 * Cette empreinte a-t-elle encore droit a un appel sur cette route, maintenant ?
 *
 * Fenetre fixe plutot que glissante : moins precis pres des bords, mais une
 * seule ligne par cle et une seule ecriture par appel — ce que la fenetre
 * glissante ne tient pas sans une table d'evenements qui grossit sans fin.
 */
export async function sousLimite(db, empreinte, route, now = Date.now()) {
  await ensureRateLimitTable(db);
  const regle = RATE_LIMITS[route] || RATE_LIMITS.default;
  const cle = `${route}:${empreinte}`;
  const row = await db.prepare(
    `SELECT fenetre_debut, compte FROM rate_limits WHERE cle = ?`
  ).bind(cle).first();

  if (!row || now - row.fenetre_debut >= regle.fenetreMs) {
    await db.prepare(
      `INSERT INTO rate_limits (cle, fenetre_debut, compte) VALUES (?, ?, 1)
       ON CONFLICT(cle) DO UPDATE SET fenetre_debut = excluded.fenetre_debut, compte = 1`
    ).bind(cle, now).run();
    return true;
  }
  if (row.compte >= regle.max) return false;
  await db.prepare(`UPDATE rate_limits SET compte = compte + 1 WHERE cle = ?`).bind(cle).run();
  return true;
}

/**
 * Efface les lignes dont la fenetre est passee. Rend le nombre de lignes
 * supprimees.
 *
 * Strictement plus vieilles que la plus longue fenetre : une ligne encore
 * dans sa fenetre peut etre en train d'arreter quelqu'un, et l'effacer lui
 * rendrait son quota.
 */
export async function purgerLimites(db, maintenant = Date.now()) {
  await ensureRateLimitTable(db);
  const r = await db.prepare(
    `DELETE FROM rate_limits WHERE fenetre_debut < ?`
  ).bind(maintenant - FENETRE_MAX).run();
  return (r.meta && r.meta.changes) || 0;
}
