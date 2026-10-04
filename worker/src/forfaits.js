/* ---------------------------------------------------------------------------
   LE DEFI SANS REPONSE
   ---------------------------------------------------------------------------
   Un defi ADRESSE a quelqu'un — choisi au classement, ou renvoye en revanche —
   qui reste une semaine sans reponse est GAGNE par celui qui l'a lance.

   Avant cette regle, un defi ignore ne valait rien : il restait dans la boite
   de l'autre jusqu'a ce qu'il le releve, c'est-a-dire souvent jamais, et celui
   qui l'avait lance ne l'apprenait d'aucune facon. Le seul moyen de ne jamais
   perdre etait de ne jamais repondre. Desormais, se taire a un prix, et lancer
   un defi a une issue certaine.

   CE QUE LA REGLE NE TOUCHE PAS :

   - le defi qui ne vise personne : un code envoye soi-meme, ou publie sur un
     reseau (« defi ouvert »). Il n'y a personne a declarer forfait ;
   - le defi pose par la camera et jamais envoye (`lance = 0`) ;
   - les defis lances AVANT la regle. Leur destinataire les a recus sans savoir
     qu'un silence lui couterait des points ; on ne la lui applique pas apres
     coup. Voir FORFAIT_DEPUIS.

   UNE REGLE APPLIQUEE PAR LE CRON, PAS A LA LECTURE. La serie des duels
   s'eteint a la lecture (duels.js, `serieVivante`) parce qu'elle ne deplace
   personne d'autre. Un forfait, lui, deplace DEUX lignes de classement — des
   points, un MMR, une serie — et ces lignes sont lues partout : le classement,
   la selection des championnats, l'accueil. Il doit donc etre ecrit, une fois,
   au meme endroit pour tout le monde. Le cron passe toutes les cinq minutes,
   et la regle tombe a cinq minutes pres.
--------------------------------------------------------------------------- */

import { appliquerForfait, ensureDuelTables } from './duels.js';
import { cleDiscipline } from './epreuves.js';
import { listeBloques, cleDe } from './moderation.js';

const JOUR = 24 * 60 * 60 * 1000;

/** Une semaine pour repondre. C'est toute la regle. */
export const FORFAIT_DELAI_MS = 7 * JOUR;

/**
 * Le battement entre l'echeance annoncee et le forfait.
 *
 * La boite cesse de proposer le defi a l'echeance pile. Mais celui qui l'a
 * accepte une minute avant est en train de le courir — un triple 400 m dure
 * plusieurs minutes — et sa course n'arrive au serveur qu'a la ligne
 * d'arrivee. Sans ce battement, le cron pouvait le declarer forfait pendant
 * qu'il courait, et son chrono serait arrive sur un duel deja tranche.
 */
export const FORFAIT_GRACE_MS = 15 * 60 * 1000;

/**
 * Le jour ou la regle entre en vigueur. Seuls les defis lances depuis peuvent
 * etre perdus par forfait — voir l'en-tete.
 */
export const FORFAIT_DEPUIS = Date.UTC(2026, 9, 4);

/**
 * Combien de defis un passage du cron tranche au plus.
 *
 * Le cron repasse cinq minutes plus tard : un arriere se resorbe tout seul, et
 * un passage borne ne risque pas de depasser le temps qu'on lui donne.
 */
const PAR_PASSAGE = 25;

/**
 * L'heure a laquelle un defi adresse sera perdu par celui qui le recoit, ou
 * `null` s'il n'est pas soumis a la regle. La boite la montre : on ne perd pas
 * un duel sans avoir su qu'il avait une echeance.
 */
export function echeanceForfait(createdAt) {
  const t = Number(createdAt) || 0;
  if (t < FORFAIT_DEPUIS) return null;
  return t + FORFAIT_DELAI_MS;
}

const pret = new WeakSet();

/**
 * `forfait_le` : l'instant ou le cron a regarde ce defi pour de bon.
 *
 * Il est pose que le forfait ait ete prononce ou non. Un defi qu'on ne peut
 * pas trancher — personne a qui l'imputer, un blocage, un forfait deja
 * prononce cette semaine — ne doit pas revenir en tete de file a chaque
 * passage : vingt-cinq comme lui suffiraient a arreter la regle pour tous.
 */
export async function ensureForfaitColonnes(db) {
  if (pret.has(db)) return;
  try { await db.prepare(`ALTER TABLE challenges ADD COLUMN forfait_le INTEGER`).run(); }
  catch (e) { /* colonne deja presente */ }
  pret.add(db);
}

/**
 * Le nom sous lequel la personne visee sera classee.
 *
 * Il est garde sur le defi depuis cette regle (`target_name`). Les defis
 * lances juste avant n'ont que l'appareil : on le retrouve alors comme
 * /challenge l'avait trouve, par la ligne du TOP 500 de cet appareil.
 */
async function nomDeLaCible(db, c) {
  const garde = String(c.target_name || '').trim();
  if (garde) return garde;
  const row = await db.prepare(
    `SELECT name FROM scores WHERE device_id = ? ORDER BY updated_at DESC LIMIT 1`
  ).bind(c.target_device).first();
  return String((row && row.name) || '').trim();
}

/** Tranche un defi. Rend ce qui s'est passe ; ne leve que si la base lache. */
async function trancherUn(db, c, maintenant) {
  const base = {
    id: c.id, lanceur: c.owner_name,
    owner_device: c.owner_device, target_device: c.target_device,
  };
  const nom = await nomDeLaCible(db, c);
  const cible = cleDe(nom);
  const lanceur = cleDe(c.owner_name);
  if (!cible || !lanceur) return { ...base, issue: 'sans_nom' };
  if (cible === lanceur) return { ...base, issue: 'soi' };

  // CE QU'ON A BLOQUE NE GAGNE PAS CONTRE NOUS. Bloquer quelqu'un, c'est dire
  // qu'on ne veut plus avoir affaire a lui ; ses defis ne sont alors pas des
  // mains tendues mais du bruit, et l'ignorer ne doit rien couter. Sans cela,
  // la personne qu'on fuit pourrait nous battre chaque semaine sans courir.
  if ((await listeBloques(db, cible)).includes(lanceur)) {
    return { ...base, cible: nom, issue: 'bloque' };
  }

  let epreuves = [];
  try { epreuves = JSON.parse(c.races || '[]') || []; } catch { /* illisible */ }

  // UN FORFAIT PAR SEMAINE ET PAR ADVERSAIRE, sur une meme discipline. Une
  // absence est une absence : dix defis envoyes le meme soir a quelqu'un qui
  // est en vacances ne valent pas dix victoires. Sans cette borne, la regle
  // deviendrait un moyen de monter au classement sans jamais courir contre
  // personne — il suffirait de viser des joueurs partis.
  const deja = await db.prepare(
    `SELECT 1 AS n FROM duel_results
      WHERE forfait = 1 AND challenger_key = ? AND opponent_key = ?
        AND epreuve = ? AND created_at > ?
      LIMIT 1`
  ).bind(lanceur, cible, cleDiscipline(epreuves), maintenant - FORFAIT_DELAI_MS).first();
  if (deja) return { ...base, cible: nom, issue: 'deja_cette_semaine' };

  const r = await appliquerForfait(db, {
    id: c.id,
    challengerName: c.owner_name,
    opponentName: nom,
    challengerMs: c.total_ms,
    epreuves,
    quand: maintenant,
  });
  if (!r) return { ...base, cible: nom, issue: 'sans_nom' };
  // La personne visee a couru sous ce nom depuis un autre appareil : le duel
  // existe deja, et c'est lui qui fait foi.
  if (r.deja) return { ...base, cible: nom, issue: 'releve' };
  return {
    ...base, cible: nom, issue: 'forfait', epreuve: r.epreuve,
    lp: r.lp_adverse, lp_cible: r.lp,
  };
}

/**
 * Le balayage : les defis adresses dont la semaine est passee sans reponse.
 *
 * « Sans reponse », c'est sans tentative DE L'APPAREIL VISE. Que d'autres aient
 * couru contre ce fantome — le code circule, on peut le partager — ne repond
 * pas a la place de la personne a qui il etait adresse. Et si elle a couru
 * sous ce nom depuis un autre telephone, la rencontre existe deja : le
 * forfait s'efface devant elle (voir `appliquerForfait`).
 *
 * Rend la liste de ce qui a ete regarde, forfait prononce ou non : l'appelant
 * previent les deux joueurs des forfaits, et journalise le reste.
 */
export async function trancherForfaits(db, maintenant = Date.now()) {
  await ensureForfaitColonnes(db);
  await ensureDuelTables(db);
  const limite = maintenant - FORFAIT_DELAI_MS - FORFAIT_GRACE_MS;
  const { results } = await db.prepare(
    `SELECT c.id, c.owner_device, c.owner_name, c.races, c.total_ms,
            c.target_device, c.target_name
       FROM challenges c
      WHERE c.lance = 1
        AND c.target_device IS NOT NULL
        AND c.forfait_le IS NULL
        AND c.created_at >= ? AND c.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM challenge_attempts a
                         WHERE a.id = c.id AND a.device_id = c.target_device)
      ORDER BY c.created_at ASC
      LIMIT ?`
  ).bind(FORFAIT_DEPUIS, limite, PAR_PASSAGE).all();

  const tranches = [];
  for (const c of results || []) {
    try {
      tranches.push(await trancherUn(db, c, maintenant));
      await db.prepare(`UPDATE challenges SET forfait_le = ? WHERE id = ?`)
        .bind(maintenant, c.id).run();
    } catch (e) {
      // Pas de `forfait_le` : une base qui lache une seconde ne doit pas faire
      // perdre un forfait. Le passage suivant le reprendra.
      tranches.push({ id: c.id, issue: 'erreur', erreur: String(e && e.message || e) });
    }
  }
  return tranches;
}
