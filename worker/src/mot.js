/* ---------------------------------------------------------------------------
   LE MOT DU VAINQUEUR
   ---------------------------------------------------------------------------
   Un duel se terminait par deux chronos, puis par une pique ecrite d'avance.
   Ici c'est le gagnant lui-meme qui parle — un texte court, ou sa voix.

   Trois regles, et elles ne sont pas negociables parce qu'elles sont ce qui
   separe un chambrage entre amis d'une boite a insultes ouverte a tous.

   1. SEUL LE VAINQUEUR PARLE, et une seule fois. Ce n'est pas une messagerie :
      c'est le mot qui accompagne un resultat. Sans cette limite, le perdant
      repondrait, l'autre repondrait encore, et il faudrait moderer une
      conversation que personne n'a voulu ouvrir.
   2. LE MOT NE VA QU'A UNE PERSONNE — celle qui vient de perdre contre lui.
      Rien n'est public, rien n'est diffuse, rien n'entre dans un classement.
   3. LA VOIX S'EFFACE A LA LECTURE. Le perdant ferme la fenetre, l'enregistre-
      ment disparait de la base. Il n'y a donc rien a conserver, rien a rejouer
      plus tard, et rien a exfiltrer d'une base ou il ne reste que du texte
      court.

   Ce qu'il faut savoir et ne pas se cacher : ce sont des mots ecrits par des
   gens, montres a d'autres gens, sans filtre automatique. Le cadre les tient —
   deux personnes qui ont choisi de se defier, un seul message, pas de reponse —
   mais il ne les relit pas. Le jour ou le jeu s'ouvrira a des inconnus, il
   faudra un signalement et de quoi le traiter.
--------------------------------------------------------------------------- */

/** Un mot tient en deux phrases. Au-dela, ce n'est plus une pique. */
export const MAX_TEXTE = 140;
/**
 * Six secondes de voix, et cent mille caracteres encodes.
 *
 * La duree est bornee cote client, la taille cote serveur : le client peut
 * mentir sur l'une, pas sur l'autre. Six secondes d'Opus pesent une vingtaine
 * de milliers d'octets ; le plafond laisse de la marge a un encodeur bavard
 * sans laisser passer un fichier depose a la main.
 */
export const MAX_VOIX_B64 = 100000;
export const TYPES_VOIX = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];

/**
 * Caracteres de controle, marques de direction et espaces de largeur nulle.
 *
 * Ils ne se voient pas, et ils servent a fabriquer des messages qui ne
 * ressemblent pas a ce qu'ils sont — un texte qui se lit a l'envers, ou qui
 * cache une moitie de lui-meme. Ecrits en echappements plutot qu'en clair :
 * dans une source, ces caracteres-la sont eux-memes invisibles, et un fichier
 * qu'on ne peut pas relire n'est pas un fichier qu'on peut corriger.
 */
const INVISIBLES = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028\\u2029' +
  '\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'g');

/**
 * Nettoie un texte destine a etre lu par quelqu'un d'autre.
 *
 * Le reste part tel quel : c'est du texte, il sera insere comme du texte, et le
 * rendu ne l'interprete pas.
 */
export function motPropre(brut) {
  return String(brut || '')
    .replace(INVISIBLES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXTE);
}

/** Verifie un enregistrement encode. Renvoie null s'il n'est pas recevable. */
export function voixPropre(b64, type) {
  const s = String(b64 || '');
  if (!s || s.length > MAX_VOIX_B64) return null;
  // Base64 strict : ce qui entre en base doit pouvoir en ressortir tel quel.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  if (!TYPES_VOIX.includes(t)) return null;
  return { b64: s, type: t };
}

/**
 * Le vainqueur d'un duel, tel que la rencontre l'a inscrit.
 *
 * 'opponent' veut dire que celui qui a releve le defi l'emporte, 'challenger'
 * que c'est celui qui l'a lance. Un nul n'a pas de vainqueur, et donc pas de
 * mot : chambrer apres une egalite n'a pas de sens.
 */
export function cleDuVainqueur(rencontre) {
  if (rencontre.outcome === 'opponent') return rencontre.opponent_key;
  if (rencontre.outcome === 'challenger') return rencontre.challenger_key;
  return null;
}

/**
 * Depose le mot du vainqueur sur une rencontre.
 *
 * Renvoie `{ erreur }` plutot que de lever : l'appelant est une route HTTP, et
 * chacune de ces erreurs correspond a une reponse differente.
 */
export async function poserMot(db, { id, cle, texte, voix, voixType }) {
  const r = await db.prepare(
    `SELECT challenge_id, opponent_key, challenger_key, outcome, mot, voix
       FROM duel_results WHERE challenge_id = ?`).bind(id).first();
  if (!r) return { erreur: 'duel introuvable' };

  const vainqueur = cleDuVainqueur(r);
  if (!vainqueur) return { erreur: 'un nul ne se chambre pas' };
  if (vainqueur !== cle) return { erreur: 'seul le vainqueur laisse un mot' };
  // Une seule fois : le mot accompagne un resultat, il ne s'edite pas apres
  // coup et surtout pas apres que l'autre l'a lu.
  if (r.mot || r.voix) return { erreur: 'le mot est deja pose', deja: true };

  const t = motPropre(texte);
  const v = voix ? voixPropre(voix, voixType) : null;
  if (!t && !v) return { erreur: 'rien a dire' };

  await db.prepare(
    `UPDATE duel_results SET mot = ?, voix = ?, voix_type = ?
      WHERE challenge_id = ?`
  ).bind(t || null, v ? v.b64 : null, v ? v.type : null, id).run();

  return { ok: true, texte: t || null, voix: !!v };
}
