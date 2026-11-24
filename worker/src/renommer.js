/* ---------------------------------------------------------------------------
   RENOMMER UN JOUEUR — sans lui faire perdre une seule ligne
   ---------------------------------------------------------------------------
   Le jeu n'a pas d'identifiant de compte : le NOM est la cle, partout. Cle
   normalisee (`name_key`, minuscules sans espaces de bord) dans la plupart
   des tables, nom affiche (avec sa casse) a cote, et parfois le nom affiche
   seul (`scores.name`, que le classement regroupe par `lower(trim(name))`).
   Changer de pseudo revenait donc a repartir de zero.

   Ce fichier tient le REGISTRE de toutes les colonnes qui portent un nom de
   joueur, et `renommer` les reecrit toutes en un seul `db.batch` : D1
   l'execute comme une transaction, tout passe ou rien ne passe — jamais un
   joueur a moitie renomme, ses chronos sous un nom et ses duels sous l'autre.

   UNE TABLE AJOUTEE PLUS TARD DOIT ETRE RANGEE ICI, dans `REGISTRE` ou dans
   `EXEMPTEES`. Le test worker/test/renommer.test.mjs relit tous les
   `CREATE TABLE` du worker et echoue sur une table qui n'est ni l'une ni
   l'autre : c'est ce qui empeche un renommage d'oublier, dans six mois, les
   lignes d'un evenement qui n'existe pas encore.

   Les objets en memoire (salles du direct, presence) ne sont pas touches :
   ils oublient tout a la fin de la course, et le jeu se reconnecte sous le
   nouveau nom.
--------------------------------------------------------------------------- */

/**
 * Chaque entree : la table, puis des paires `[cle, nom]` — la colonne de la
 * cle normalisee, et la colonne du nom affiche qui l'accompagne (ou null).
 * `affiches` : des colonnes de nom affiche SANS cle a cote, retrouvees par
 * `lower(trim(colonne))`.
 */
export const REGISTRE = [
  { table: 'players', paires: [['name_key', 'name']] },
  { table: 'player_devices', paires: [['name_key', null]] },
  { table: 'player_pays', paires: [['name_key', null]] },
  { table: 'profils', paires: [['name_key', null]] },
  { table: 'transferts', paires: [['name_key', null]] },
  { table: 'recuperations', paires: [['name_key', 'nom']] },
  { table: 'refus_nom', paires: [['name_key', null]] },
  { table: 'races', paires: [['name_key', 'name']] },
  { table: 'scores', affiches: ['name'] },
  { table: 'courses_compte', paires: [['name_key', null]] },
  { table: 'courses_suspectes', paires: [['name_key', null]] },
  { table: 'challenges', affiches: ['owner_name'] },
  { table: 'challenge_attempts', affiches: ['name'] },
  { table: 'duel_players', paires: [['name_key', 'name']] },
  { table: 'duel_results', paires: [['opponent_key', 'opponent_name'], ['challenger_key', null]] },
  { table: 'invitations_directes', affiches: ['de_nom', 'vers_nom'] },
  { table: 'objectifs', paires: [['name_key', null]] },
  { table: 'objectifs_neuf', paires: [['name_key', null]] },
  { table: 'objectif_classement', paires: [['name_key', 'nom']] },
  { table: 'pieces_mouvements', paires: [['name_key', null]] },
  { table: 'notif_journal', paires: [['name_key', null]] },
  { table: 'notif_prefs', paires: [['name_key', null]] },
  { table: 'depassements_sonnes', paires: [['name_key', null]] },
  { table: 'demandes_pays', paires: [['name_key', 'nom']] },
  { table: 'bannis', paires: [['cle', null]] },
  { table: 'bloques', paires: [['bloqueur', null], ['bloque', null]] },
  { table: 'signalements', paires: [['auteur_cle', null], ['signale_par', null]] },
  // championnats
  { table: 'champ_editions', paires: [['champion_key', 'champion_nom']] },
  { table: 'champ_bulles', paires: [['name_key', null]] },
  { table: 'champ_engagements', paires: [['name_key', null]] },
  { table: 'champ_invites', paires: [['name_key', null]] },
  { table: 'champ_medailles', paires: [['name_key', 'nom']] },
  { table: 'champ_mots', paires: [['name_key', 'nom']] },
  { table: 'champ_partants', paires: [['name_key', 'nom']] },
  { table: 'champ_resultats', paires: [['name_key', null]] },
  { table: 'champ_selection', paires: [['name_key', 'nom']] },
  { table: 'champ_titres', paires: [['name_key', 'nom']] },
  // duels par epreuve
  { table: 'epreuves_attaques', paires: [['name_key', null], ['cible_key', null]] },
  { table: 'epreuves_voix', paires: [['name_key', null]] },
  { table: 'epreuves_fantomes', affiches: ['name'] },
  // le duel des marques
  { table: 'marques_camps', paires: [['name_key', null]] },
  { table: 'marques_chronos', paires: [['name_key', 'name']] },
  { table: 'marques_duels', paires: [['tenant_key', 'tenant_name'], ['vaincu_key', 'vaincu_name']],
    composees: [{ colonne: 'paire', sep: '|' }] },
  { table: 'marques_fil', affiches: ['a_name', 'b_name'] },
  { table: 'marques_invitations', paires: [['de_key', 'de_name'], ['pour_key', null]] },
  { table: 'marques_sonneries', paires: [['pour_key', null]] },
  { table: 'marques_tchat', paires: [['auteur_key', 'auteur_name'], ['pour_key', 'pour_name']] },
  { table: 'marques_tchat_aimes', paires: [['name_key', null]] },
  { table: 'marques_tchat_lus', paires: [['name_key', null], ['avec_key', null]] },
  // noel
  { table: 'noel_joueurs', paires: [['name_key', 'name']] },
  { table: 'noel_battus', paires: [['chasseur_key', null], ['cible_key', null]] },
  { table: 'noel_etoile', paires: [['tenant_key', 'tenant_name']] },
  { table: 'noel_neige', paires: [['cible_key', null], ['lanceur_key', null]] },
  { table: 'noel_fil', affiches: ['a_name', 'b_name'] },
  { table: 'noel_eq_candidats', paires: [['name_key', 'name']] },
  { table: 'noel_eq_votes', paires: [['cible_key', null]] },
  { table: 'noel_eq_departage', paires: [['name_key', null]] },
  { table: 'noel_eq_equipes', paires: [['chef_key', 'chef_name']] },
  { table: 'noel_eq_membres', paires: [['name_key', 'name']] },
  { table: 'noel_eq_fantomes', paires: [['name_key', null]] },
  { table: 'noel_eq_jour', paires: [['name_key', null]] },
  { table: 'noel_eq_duels', paires: [['chasseur_key', null], ['cible_key', null]] },
  { table: 'noel_eq_points', affiches: ['a_name', 'b_name'] },
  // relais
  { table: 'relay_members', paires: [['name_key', 'name']] },
  { table: 'relay_teams', affiches: ['created_by'], composees: [{ colonne: 'roster_key', sep: '\u0001' }] },
  { table: 'relay_defis', affiches: ['from_name'] },
];

/** Les tables qui ne portent AUCUN nom de joueur, et pourquoi. */
export const EXEMPTEES = {
  acces_test: 'codes du canal de test ; `nom` est le libelle du testeur',
  annonces: 'textes du jeu', arrivees: 'compteurs anonymes', visits: 'par appareil',
  reprises: 'par appareil', tunnel: 'par appareil', tunnel_appareil: 'par appareil',
  panneaux_affichages: 'compteurs', push_subscriptions: 'par appareil', push_jetons: 'par appareil',
  rate_limits: 'par empreinte d IP', nations_semaine: 'par pays',
  challenge_cibles: 'identifiants de defi', relay_scores: 'par equipe',
  reseaux_file: 'publications deja faites', reseaux_caps: 'seuils',
  reseaux_images: 'images', reseaux_programmes: 'publications programmees',
  champ_annonces: 'textes publies, historiques', noel_eq_etapes: 'horloge',
  noel_eq_horloge: 'horloge', pseudo_journal: 'journal : garde les deux noms tels quels',
  pseudo_demandes: 'historique : garde les noms d origine, le jeu y retrouve son nouveau nom',
};

const cleDe = (nom) => String(nom || '').trim().toLowerCase().slice(0, 40);

/** Les tables et colonnes presentes dans CETTE base (elles naissent a la
 *  demande, et une colonne ajoutee par ALTER peut manquer). */
async function schema(db) {
  const tables = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const s = new Map();
  for (const { name } of tables.results || []) {
    const cols = await db.prepare(`PRAGMA table_info(${name})`).all();
    s.set(name, new Set((cols.results || []).map(c => c.name)));
  }
  return s;
}

/**
 * Les instructions qui renomment `ancien` en `nouveau`, a passer dans un
 * `db.batch` — seules ou avec d'autres (pseudo-demandes.js y joint la
 * cloture de la demande, dans la meme transaction).
 *
 * En cas de collision sur une cle (des lignes existent deja sous le nouveau
 * nom : un joueur non inscrit a couru sous ce nom), `UPDATE OR REPLACE` garde
 * les lignes du joueur renomme. C'est la regle de la reservation d'un nom
 * libre, qui recupere deja ce qui avait ete couru sous lui.
 */
export async function instructionsRenommage(db, ancien, nouveau) {
  const vieille = cleDe(ancien);
  const neuve = cleDe(nouveau);
  const affiche = String(nouveau || '').trim();
  if (!vieille || !neuve || !affiche) throw new Error('renommage sans nom');
  const s = await schema(db);
  const ops = [];
  for (const e of REGISTRE) {
    const cols = s.get(e.table);
    if (!cols) continue;
    for (const [cle, nom] of e.paires || []) {
      if (!cols.has(cle)) continue;
      if (nom && cols.has(nom)) {
        ops.push(db.prepare(`UPDATE OR REPLACE ${e.table} SET ${cle} = ?, ${nom} = ? WHERE ${cle} = ?`)
          .bind(neuve, affiche, vieille));
      } else {
        ops.push(db.prepare(`UPDATE OR REPLACE ${e.table} SET ${cle} = ? WHERE ${cle} = ?`)
          .bind(neuve, vieille));
      }
    }
    for (const col of e.affiches || []) {
      if (!cols.has(col)) continue;
      ops.push(db.prepare(`UPDATE OR REPLACE ${e.table} SET ${col} = ? WHERE lower(trim(${col})) = ?`)
        .bind(affiche, vieille));
    }
    // Les cles composees (plusieurs noms tries et joints) se recalculent ici :
    // le tri depend du nouveau nom, SQL ne sait pas le refaire.
    for (const { colonne, sep } of e.composees || []) {
      if (!cols.has(colonne)) continue;
      const lignes = await db.prepare(
        `SELECT rowid AS r, ${colonne} AS v FROM ${e.table} WHERE instr(${colonne}, ?) > 0`
      ).bind(vieille).all();
      for (const l of lignes.results || []) {
        const parts = String(l.v).split(sep);
        if (!parts.includes(vieille)) continue;
        const v = [...new Set(parts.map(p => p === vieille ? neuve : p))].sort().join(sep);
        ops.push(db.prepare(`UPDATE OR REPLACE ${e.table} SET ${colonne} = ? WHERE rowid = ?`)
          .bind(v, l.r));
      }
    }
  }
  return ops;
}

/** Renomme, en une transaction. */
export async function renommer(db, ancien, nouveau) {
  const ops = await instructionsRenommage(db, ancien, nouveau);
  if (ops.length) await db.batch(ops);
  return ops.length;
}
