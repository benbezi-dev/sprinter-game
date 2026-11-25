/* ---------------------------------------------------------------------------
   LES FACE-A-FACE (demande de l'auteur, 25/11/2026)
   ---------------------------------------------------------------------------
   « Qui est ma bete noire, qui est ma victime favorite ? » Comme les
   confrontations directes au football : le bilan de chaque paire de joueurs,
   epreuve par epreuve, en victoires, nuls et defaites.

   Rien de neuf a compter : `duel_results` garde deja chaque duel tranche, et
   c'est de lui que le classement se refait (duels.js, recalculerClassement).
   Les face-a-face le relisent avec les MEMES regles :
   - l'issue est celle du duel (`challenger`, `opponent`, `draw` — chronos
     egaux), lue du point de vue du joueur ;
   - la discipline est celle de la rencontre (`epreuveDeLigne`, comme le
     classement) ;
   - un duel contre un sans-nom (« anonyme ») ne compte pas, comme au
     classement.

   Les noms affiches passent par le filtre des pseudos : un pseudo interdit
   reste « Joueur masqué », ici comme partout.
--------------------------------------------------------------------------- */

import { epreuveDeLigne } from './duels.js';
import { nomAffichable } from './pseudo.js';

/** La cle de la vue « toutes epreuves ». */
export const TOUTES = '*';

/* ------------------------------------------------------------- le calcul */

/**
 * Les bilans d'un joueur : epreuve → adversaire → { v, n, d }, plus la vue
 * cumulee sous `TOUTES`. `lignes` : { lui, moi, issue, epreuve } — `lui` a
 * lance le duel, `moi` l'a releve, comme dans duel_results.
 */
export function bilans(lignes, joueur) {
  const out = new Map();
  const ajouter = (ep, adv, champ) => {
    if (!out.has(ep)) out.set(ep, new Map());
    const m = out.get(ep);
    if (!m.has(adv)) m.set(adv, { v: 0, n: 0, d: 0 });
    m.get(adv)[champ]++;
  };
  for (const l of lignes) {
    let adv, champ;
    if (l.lui === joueur) {
      adv = l.moi;
      champ = l.issue === 'challenger' ? 'v' : l.issue === 'opponent' ? 'd' : 'n';
    } else if (l.moi === joueur) {
      adv = l.lui;
      champ = l.issue === 'opponent' ? 'v' : l.issue === 'challenger' ? 'd' : 'n';
    } else continue;
    if (!adv || adv === joueur || adv === 'anonyme' || joueur === 'anonyme') continue;
    if (l.issue !== 'challenger' && l.issue !== 'opponent' && l.issue !== 'draw') continue;
    ajouter(l.epreuve, adv, champ);
    ajouter(TOUTES, adv, champ);
  }
  return out;
}

/** V/D, une defaite de moins valant mieux que tout : sans defaite, l'infini. */
const ratio = (b) => (b.d === 0 ? Infinity : b.v / b.d);

/**
 * La bete noire : le plus de defaites. A egalite, le pire ratio V/D, puis le
 * moins de victoires, puis l'ordre alphabetique (pour que le resultat ne
 * change pas d'un affichage a l'autre). Aucune defaite : pas de bete noire.
 */
export function beteNoire(adversaires) {
  let meilleur = null;
  for (const [cle, b] of adversaires) {
    if (b.d === 0) continue;
    if (!meilleur) { meilleur = [cle, b]; continue; }
    const [c0, b0] = meilleur;
    const devant = b.d !== b0.d ? b.d > b0.d
      : ratio(b) !== ratio(b0) ? ratio(b) < ratio(b0)
      : b.v !== b0.v ? b.v < b0.v
      : cle < c0;
    if (devant) meilleur = [cle, b];
  }
  return meilleur ? { cle: meilleur[0], ...meilleur[1] } : null;
}

/**
 * La victime favorite : le plus de victoires. A egalite, le meilleur ratio
 * V/D, puis le moins de defaites, puis l'ordre alphabetique. Aucune
 * victoire : pas de victime favorite.
 */
export function victimeFavorite(adversaires) {
  let meilleur = null;
  for (const [cle, b] of adversaires) {
    if (b.v === 0) continue;
    if (!meilleur) { meilleur = [cle, b]; continue; }
    const [c0, b0] = meilleur;
    const devant = b.v !== b0.v ? b.v > b0.v
      : ratio(b) !== ratio(b0) ? ratio(b) > ratio(b0)
      : b.d !== b0.d ? b.d < b0.d
      : cle < c0;
    if (devant) meilleur = [cle, b];
  }
  return meilleur ? { cle: meilleur[0], ...meilleur[1] } : null;
}

/** Le tableau complet : les plus affrontes d'abord, puis le meilleur bilan. */
export function tableau(adversaires) {
  return [...adversaires]
    .map(([cle, b]) => ({ cle, ...b, total: b.v + b.n + b.d }))
    .sort((a, b) => b.total - a.total || (b.v - b.d) - (a.v - a.d) || (a.cle < b.cle ? -1 : 1));
}

/* -------------------------------------------------------------- la base */

const pret = new WeakSet();
async function ensureIndex(db) {
  if (pret.has(db)) return;
  // Les duels d'UN joueur, qu'il les ait lances ou releves : sans ces index,
  // chaque profil parcourrait toute la table.
  await db.batch([
    db.prepare(`CREATE INDEX IF NOT EXISTS duel_results_lanceur ON duel_results (challenger_key)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS duel_results_releveur ON duel_results (opponent_key)`),
  ]);
  pret.add(db);
}

async function lignesDe(db, cle) {
  const colonnes = `r.challenger_key AS lui, r.opponent_key AS moi, r.outcome AS issue, r.epreuve AS epreuve`;
  const ou = `WHERE r.challenger_key = ? OR r.opponent_key = ?`;
  try {
    const { results } = await db.prepare(
      `SELECT ${colonnes}, c.races AS races FROM duel_results r
         LEFT JOIN challenges c ON c.id = r.challenge_id ${ou}`).bind(cle, cle).all();
    return results || [];
  } catch {
    const { results } = await db.prepare(`SELECT ${colonnes} FROM duel_results r ${ou}`).bind(cle, cle).all();
    return results || [];
  }
}

/** Les noms lisibles des adversaires : celui du classement, sinon le reserve. */
async function noms(db, cles) {
  const out = new Map();
  if (!cles.length) return out;
  const marques = cles.map(() => '?').join(',');
  for (const sql of [
    `SELECT name_key AS cle, name FROM players WHERE name_key IN (${marques})`,
    `SELECT name_key AS cle, name FROM duel_players WHERE name_key IN (${marques}) ORDER BY updated_at`,
  ]) {
    try {
      const { results } = await db.prepare(sql).bind(...cles).all();
      for (const r of results || []) if (!out.has(r.cle) && r.name) out.set(r.cle, r.name);
    } catch { /* table absente */ }
  }
  return out;
}

/**
 * Les face-a-face d'un joueur, prets a afficher : pour chaque epreuve jouee
 * (et `TOUTES`), la bete noire, la victime favorite et le tableau complet.
 */
export async function faceAFace(db, nom) {
  const cle = String(nom || '').trim().toLowerCase();
  if (!cle || cle === 'anonyme') return { epreuves: [] };
  await ensureIndex(db);
  const lignes = (await lignesDe(db, cle)).map(l => ({ ...l, epreuve: epreuveDeLigne(l) }));
  const parEpreuve = bilans(lignes, cle);
  const tousAdv = [...new Set([...(parEpreuve.get(TOUTES) || new Map()).keys()])];
  const lisibles = await noms(db, tousAdv);
  // La cle ne repart pas : elle ecrirait en clair un pseudo que le nom masque.
  const nommer = (o) => {
    if (!o) return null;
    const { cle: c, ...reste } = o;
    return { nom: nomAffichable(lisibles.get(c) || c), ...reste };
  };

  const epreuves = [...parEpreuve.keys()]
    .sort((a, b) => (a === TOUTES ? -1 : b === TOUTES ? 1 : a < b ? -1 : 1))
    .map(ep => {
      const adv = parEpreuve.get(ep);
      const t = tableau(adv);
      return {
        epreuve: ep,
        bilan: t.reduce((s, r) => ({ v: s.v + r.v, n: s.n + r.n, d: s.d + r.d }), { v: 0, n: 0, d: 0 }),
        bete_noire: nommer(beteNoire(adv)),
        victime_favorite: nommer(victimeFavorite(adv)),
        adversaires: t.map(nommer),
      };
    });
  return { epreuves };
}
