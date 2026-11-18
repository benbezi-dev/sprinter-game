// LES TABLES DEJA PRETES, PAR BASE — et non par session.
//
// Chaque module garde la liste des bases dont il a deja cree les tables, pour
// ne pas rejouer ses CREATE TABLE / ALTER a chaque appel. Cette liste etait un
// WeakSet indexe sur `db`. Or depuis les sessions D1 (index.js, `withSession`),
// `db` est un objet NEUF a chaque requete : la liste ne retenait rien, et les
// migrations repartaient a chaque requete, sur les deux bases (audit du 16/11).
//
// On indexe donc sur la base d'origine. Une base qui n'est pas une session
// (cron, salles, bancs de tools/) se retrouve elle-meme, comme avant.

const baseDe = new WeakMap();

/** Dire de quelle base vient cette session (index.js, a sa creation). */
export function lierSession(session, base) {
  if (session && base) baseDe.set(session, base);
}

/** Meme usage qu'un WeakSet : `has(db)`, `add(db)`. */
export class BasesPretes {
  #vues = new WeakSet();
  has(db) { return this.#vues.has(baseDe.get(db) || db); }
  add(db) { this.#vues.add(baseDe.get(db) || db); return this; }
}
