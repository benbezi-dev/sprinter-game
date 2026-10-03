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

   Ce jour est venu pour le championnat (26/09) : la bulle de presentation, le
   tchat de la chambre d'appel et le mot du vainqueur diffuse en direct sont
   lus par des inconnus. Ils passent par `texteRecevable`, plus bas — un filtre
   automatique —, et une route d'administration retire ce qu'il a laisse
   passer. Le duel, lui, garde son cadre a deux.
--------------------------------------------------------------------------- */

/** Un mot tient en deux phrases. Au-dela, ce n'est plus une pique. */
export const MAX_TEXTE = 140;
/**
 * Six secondes de voix, et le plafond qui suit le format.
 *
 * La duree est bornee cote client, la taille cote serveur : le client peut
 * mentir sur l'une, pas sur l'autre.
 *
 * Le jeu envoie desormais du WAV : des echantillons bruts, sans compression,
 * parce que c'est le seul format qu'aucun telephone ne refuse de lire — un
 * enregistrement Opus fait sur Android arrivait muet sur un iPhone. Six
 * secondes en 8 kHz mono seize bits pesent quatre-vingt-seize kilooctets, soit
 * cent trente mille caracteres encodes : l'ancien plafond de cent mille les
 * aurait refusees toutes. On le porte a deux cent mille, ce qui laisse la
 * marge d'un encodeur un peu bavard sans laisser passer un fichier depose a la
 * main. La voix est effacee des qu'elle a ete ecoutee : rien de tout cela ne
 * s'accumule.
 */
export const MAX_VOIX_B64 = 200000;
export const TYPES_VOIX = [
  'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg',
];

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
  return nettoyer(brut).slice(0, MAX_TEXTE);
}

/** Le nettoyage de `motPropre`, sans la coupe : le filtre doit voir la vraie
 *  longueur pour pouvoir la refuser au lieu de la tronquer en silence. */
function nettoyer(brut) {
  return String(brut || '')
    .replace(INVISIBLES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------------------------------------------------------------------------
   LE FILTRE — ce qui peut etre lu par des inconnus
   ---------------------------------------------------------------------------
   Une bulle au-dessus d'une tete, un message dans la chambre d'appel, le mot
   du vainqueur diffuse a la salle : trois textes ecrits par un joueur et lus
   par des gens qu'il ne connait pas. Le filtre refuse quatre choses, et dit
   laquelle — le joueur doit pouvoir corriger, pas deviner :

   - 'long'     : plus long que la place prevue. On refuse plutot que de
                  couper : une phrase coupee au milieu dit autre chose.
   - 'lien'     : une adresse. Le jeu n'est pas une vitrine pour autre chose.
   - 'contact'  : un @pseudo, un numero, un compte ailleurs. Une chambre
                  d'appel n'est pas l'endroit ou un inconnu recupere le moyen
                  d'ecrire en prive a un mineur.
   - 'grossier' : insultes, injures racistes ou homophobes, sexuel explicite,
                  en francais et en anglais.

   Le texte montre est celui que `nettoyer` rend : la normalisation qui suit ne
   sert qu'a CHERCHER (casse, accents, chiffres a la place des lettres, lettres
   repetees, lettres espacees), jamais a reecrire ce que le joueur a ecrit.

   Ce que le filtre ne fait pas, et il ne faut pas le lui demander : il ne
   comprend pas. Une insulte assez inventive passera, une phrase innocente
   tombera parfois. C'est pour cela que la route d'administration
   (`/champ/moderer`) existe a cote de lui.
--------------------------------------------------------------------------- */

/** La bulle de presentation : deux lignes courtes au-dessus d'une tete. */
export const BULLE_MAX = 40;
/** Un message de la chambre d'appel : la longueur du mot du vainqueur. */
export const TCHAT_MAX = 140;

/**
 * Les lettres d'autres alphabets qui ressemblent aux notres, et que la
 * normalisation Unicode ne rapproche pas : un c cyrillique dans « connard »
 * se lit comme un c latin et passerait sans cela. En echappements, pour la
 * meme raison que les invisibles : ecrits en clair, on ne les distinguerait
 * pas des lettres latines en relisant ce fichier.
 */
const SOSIES = {
  // cyrillique : a b e e k m h o p c t y x i j s
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k',
  'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c',
  'т': 't', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j',
  'ѕ': 's',
  // grec : a b e i k v o p t u x
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k',
  'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u',
  'χ': 'x',
};
/** Le langage des chiffres (« c0nn4rd ») et des symboles (« $alope »). */
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/**
 * Les mots refuses quand ils sont ENTIERS. Un mot, pas un morceau de mot :
 * « con » refuse « t'es con » et laisse passer « second », « conte »,
 * « concentration ». Le pluriel en -s est accepte par la recherche.
 *
 * Choix assumes : « merde » n'y est pas — c'est un juron, pas une insulte, et
 * « merde, faux depart » ne blesse personne. « putain » y est : dans une bulle
 * montree en grand a toute une salle, c'est un gros mot.
 *
 * Et des absents voulus, parce que ce sont aussi des mots francais ordinaires
 * une fois les accents retires : « retard » (anglais « retard », mais « desole
 * du retard »), « rape » (« fromage rape »), « pedale » (« je pedale dans la
 * semoule »), « debile » (« c'est debile, ce depart »).
 */
const MOTS_GROSSIERS = new Set([
  // francais — insultes et vulgarite
  'con', 'conne', 'connard', 'conard', 'connasse', 'conasse', 'salope', 'salop',
  'salaud', 'pute', 'putain', 'ptn', 'pouffiasse', 'poufiasse', 'encule',
  'enculee', 'enculer', 'enculeur', 'batard', 'batarde', 'fdp', 'ntm', 'nique',
  'niquer', 'niquez', 'nik', 'niker', 'niquetamere', 'tg', 'ftg', 'bite',
  'couille', 'branleur', 'branleuse', 'branlette', 'suce', 'sucer', 'suceur',
  'suceuse', 'trouduc', 'enfoire', 'enfoiree', 'abruti', 'abrutie', 'cretin',
  'cretine', 'gogol', 'triso', 'foutre', 'porno', 'baise', 'baiseur', 'sodomie',
  'sodomiser',
  // francais — injures racistes, antisemites, homophobes
  'pd', 'pede', 'tapette', 'tarlouze', 'tafiole', 'gouine', 'negre',
  'negresse', 'bougnoule', 'bougnoul', 'bicot', 'youpin', 'youpine',
  'chinetoque', 'bamboula', 'nazi', 'hitler',
  // anglais
  'fuck', 'fucked', 'fucker', 'fucking', 'fuckin', 'motherfucker', 'bitch',
  'bitche', 'bastard', 'asshole', 'arsehole', 'dick', 'dickhead', 'cock', 'cunt',
  'pussy', 'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'retarded',
  'twat', 'wanker', 'porn', 'rapist', 'kys', 'stfu', 'gtfo',
]);

/** Les expressions refusees, mot a mot (les separateurs entre les mots sont
 *  libres : « tue-toi » et « tue toi » sont la meme phrase). */
const PHRASES_GROSSIERES = [
  'ta gueule', 'nique ta mere', 'fils de pute', 'tue toi', 'suicide toi',
  'va mourir', 'kill yourself', 'kill urself',
  'sale (?:noir|noire|arabe|juif|juive|renoi|rebeu|negre|chinois|chinoise|gitan|gitane|pede|gouine|race)s?',
].map(p => new RegExp('(?:^|[^a-z0-9])' + p.replace(/ /g, '[^a-z0-9]+') + '(?=$|[^a-z0-9])'));

/**
 * Les plus graves, cherches aussi comme MORCEAU du texte colle — tout ce qui
 * n'est ni lettre ni chiffre retire —, pour attraper « c o n n a r d » ou
 * « n.i.q.u.e ta mere ».
 *
 * La liste est courte a dessein. Chaque mot y a ete relu contre les mots
 * innocents qui le contiennent une fois les espaces retires : « salope » n'y
 * est pas a cause de « salopette », « pute » a cause de « dispute », « batard »
 * a cause de « combat ardent », « negre » a cause de « une grenouille »,
 * « bitch » a cause de « a bit cheap », « slut » a cause de « is lutte »,
 * « conard » a cause de « Macon ardent ».
 */
const MORCEAUX_GRAVES = [
  'connard', 'connasse', 'encule', 'fdp', 'filsdepute', 'niquetamere',
  'tagueule', 'suicidetoi', 'nigger', 'nigga', 'faggot', 'fuck', 'bougnoule',
  'chinetoque', 'tarlouze', 'pouffiasse', 'hitler',
];

const LIENS = [
  /https?:\/\//,
  /\bwww\./,
  /\b[a-z0-9-]+\.(?:com|fr|net|org|io|gg|me|ly|co|app|xyz|tv|be|ch|ca)\b/,
  /discord\.gg/,
  /\bt\.me\b/,
  /\bwa\.me\b/,
];

/** Le nom d'un autre reseau, la ou l'on donne son compte. */
const RESEAU = '\\b(?:snap(?:chat)?|insta(?:gram)?|whats ?app|telegram|tiktok)';
const CONTACTS = [
  // Un @pseudo, ou une adresse de courriel.
  /@\w{2,}/,
  // Sept chiffres ou plus, espaces, points ou tirets compris : un numero.
  /\d(?:[\s.\-]?\d){6,}/,
  // Un compte sur un autre reseau : « snap : jules », « mon insta c'est
  // jules », « insta jules_06 ». Le nom seul (« je suis sur insta ») passe.
  new RegExp(RESEAU + '\\b(?:\\s*[:=@]\\s*|\\s+c[\'\\u2019]?est\\s+)@?[a-z0-9_.]{2,}'),
  new RegExp(RESEAU + '\\s+@?[a-z0-9.]*[0-9_][a-z0-9_.]*'),
];

/** Casse, largeurs et ligatures (NFKC), sosies, accents, caracteres de
 *  format : la forme ou l'on cherche les liens et les contacts. */
function forme(texte) {
  return texte.normalize('NFKC').toLowerCase()
    .replace(/[Ͱ-ϿЀ-ӿ]/g, c => SOSIES[c] || c)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\p{Cf}/gu, '');
}

/** Les lettres repetees trois fois ou plus n'en font plus qu'une. */
const reduire = (s) => s.replace(/([a-z])\1{2,}/g, '$1');

/**
 * Ce texte peut-il etre montre a d'autres ?
 *
 * Rend `{ ok: true, texte }` — le texte nettoye, tel qu'il sera affiche — ou
 * `{ ok: false, raison }` avec raison parmi 'vide', 'long', 'lien', 'contact',
 * 'grossier'.
 */
export function texteRecevable(brut, max) {
  if (typeof brut !== 'string') return { ok: false, raison: 'vide' };
  // Un texte qui depasse de tres loin la place n'a pas besoin d'etre lu en
  // entier pour etre refuse : un envoi d'un megaoctet ne doit rien couter.
  if (brut.length > Math.max(4000, max * 20)) return { ok: false, raison: 'long' };
  const texte = nettoyer(brut);
  if (!texte) return { ok: false, raison: 'vide' };
  if (texte.length > max) return { ok: false, raison: 'long' };

  const f = forme(texte);
  if (LIENS.some(r => r.test(f))) return { ok: false, raison: 'lien' };
  if (CONTACTS.some(r => r.test(f))) return { ok: false, raison: 'contact' };

  // La forme lue : chiffres et symboles rendus a leurs lettres, repetitions
  // ecrasees. Puis la meme, collee, pour les lettres espacees.
  const lu = reduire(f.replace(/[013457@$]/g, c => LEET[c]));
  const mots = lu.split(/[^a-z0-9]+/).filter(Boolean);
  if (mots.some(m => MOTS_GROSSIERS.has(m) ||
                     (m.endsWith('s') && MOTS_GROSSIERS.has(m.slice(0, -1))))) {
    return { ok: false, raison: 'grossier' };
  }
  if (PHRASES_GROSSIERES.some(r => r.test(lu))) return { ok: false, raison: 'grossier' };
  const colle = reduire(lu.replace(/[^a-z0-9]+/g, ''));
  if (MORCEAUX_GRAVES.some(m => colle.includes(m))) return { ok: false, raison: 'grossier' };

  return { ok: true, texte };
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

/* ---------------------------------------------------------------------------
   LA REPONSE DU PERDANT
   ---------------------------------------------------------------------------
   La regle n° 1 tenait le perdant muet : seul le vainqueur parle. Elle reste
   vraie pour le texte et la voix. Ce qui s'ouvre au perdant est plus etroit :
   UNE phrase, choisie dans une liste ecrite par le jeu, en reponse a un mot
   qu'il a vraiment recu.

   Pourquoi pas un champ libre : le perdant est le cote frustre de la
   rencontre. Lui ouvrir du texte, c'est l'ouvrir a celui qui a le plus de
   raisons d'en abuser, et transformer un mot en conversation que personne
   n'aurait moderee.

   CE QUI VOYAGE EST UN IDENTIFIANT, comme pour le tchat rapide : chaque
   telephone ecrit la phrase dans sa langue (sprinter-i18n.js, cles
   `reponse_r_*`). Rien a filtrer, rien a signaler, et on ne glisse pas un
   numero de telephone dans « r_vent ».

   La liste est la meme cote jeu (src/game/mot.ts, REPONSES) : les deux se
   modifient ensemble.

   Trois bornes, et elles ferment l'echange :
   - seul le perdant repond, et seulement s'il y avait un mot du vainqueur.
     Une pique ecrite par le jeu n'appelle pas de reponse : le vainqueur
     recevrait une replique a une phrase qu'il n'a jamais dite ;
   - une seule fois, et sans retour possible ;
   - le vainqueur ne repond pas a la reponse. L'echange s'arrete la.
--------------------------------------------------------------------------- */

/** Les identifiants recevables. Voir src/game/mot.ts. */
export const REPONSES = [
  'r_bien', 'r_note', 'r_prochaine', 'r_echauffement', 'r_vent', 'r_blocs',
];

export function reponseRecevable(q) {
  return typeof q === 'string' && REPONSES.includes(q);
}

/**
 * Pose la reponse du perdant sur une rencontre.
 *
 * Le perdant se reconnait comme le destinataire d'un signalement : par son nom,
 * ou — cote lanceur seulement — par l'appareil qui a cree le defi. Renvoie
 * `{ gagnant }` pour que la route sache a qui sonner.
 */
export async function poserReponse(db, { id, cle, deviceId, reponse }) {
  if (!reponseRecevable(reponse)) return { erreur: 'reponse inconnue' };
  const r = await db.prepare(
    `SELECT r.challenge_id, r.opponent_key, r.challenger_key, r.outcome,
            r.mot, r.voix, r.mot_vu, r.reponse, c.owner_device
       FROM duel_results r
       JOIN challenges c ON c.id = r.challenge_id
      WHERE r.challenge_id = ?`).bind(id).first();
  if (!r) return { erreur: 'duel introuvable' };

  const vainqueur = cleDuVainqueur(r);
  if (!vainqueur) return { erreur: 'un nul ne se chambre pas' };
  const perdantRole = r.outcome === 'opponent' ? 'challenger' : 'opponent';
  const perdantCle = perdantRole === 'challenger' ? r.challenger_key : r.opponent_key;

  const moi = String(cle || '').trim().toLowerCase();
  const parNom = !!moi && moi === String(perdantCle || '').trim().toLowerCase();
  const parAppareil = perdantRole === 'challenger' && !!deviceId &&
    !!r.owner_device && String(deviceId) === String(r.owner_device);
  if (!parNom && !parAppareil) return { erreur: 'seul le perdant repond' };

  // Un mot a existe : il est encore la, ou il a ete lu — la voix s'efface a la
  // lecture, et `mot_vu` ne passe a 1 que s'il y avait quelque chose a lire.
  if (!r.mot && !r.voix && !r.mot_vu) return { erreur: 'rien a quoi repondre' };
  if (r.reponse) return { erreur: 'deja repondu', deja: true };

  // La condition `reponse IS NULL` est reprise dans l'ecriture : deux appuis
  // simultanes ne posent pas deux reponses.
  const ecrit = await db.prepare(
    `UPDATE duel_results SET reponse = ?
      WHERE challenge_id = ? AND reponse IS NULL`).bind(reponse, id).run();
  if (!(ecrit && ecrit.meta && ecrit.meta.changes)) return { erreur: 'deja repondu', deja: true };

  return {
    ok: true, reponse,
    gagnant: { role: r.outcome, cle: vainqueur, perdant: String(perdantCle || '') },
  };
}
