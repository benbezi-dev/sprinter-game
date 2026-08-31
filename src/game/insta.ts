/**
 * Un pseudo Instagram, nettoye — avec ou sans l'arobase.
 *
 * Personne ne tape son pseudo « nu ». On ecrit @pseudo, parce que c'est ainsi
 * qu'un compte s'ecrit partout ailleurs, ou bien on colle le lien du profil
 * que l'application propose de partager — lien qui traine son schema, son
 * www, sa barre finale et son ?igsh=... de suivi. Refuser ces formes, c'est
 * refuser la facon dont les gens ont le pseudo sous la main.
 *
 * On accepte donc tout ce qui designe sans ambiguite un compte :
 *
 *   pseudo · @pseudo · @@pseudo · instagram.com/pseudo · www.instagram.com/@pseudo/
 *   https://www.instagram.com/pseudo/?igsh=MXY · m.instagram.com/pseudo · instagr.am/pseudo
 *
 * et on ne garde que le pseudo lui-meme : lettres, chiffres, point, tiret
 * bas, trente caracteres — ce qu'Instagram accepte.
 *
 * Trois reponses possibles :
 *   ''     la saisie est vide — c'est une demande de deliaison, pas une erreur
 *   null   la saisie ne designe pas un compte — on la refuse
 *   sinon  le pseudo, propre
 *
 * Ce fichier a un jumeau cote serveur (worker/src/insta.js). Les deux doivent
 * repondre la meme chose, et tools/insta-test.mjs le verifie.
 *
 * Cote client il sert a deux choses : refuser tout de suite ce qui n'ira pas,
 * sans aller-retour reseau, et montrer au joueur le pseudo tel qu'il sera
 * enregistre.
 */

/** Les adresses d'ou l'on sait extraire un pseudo. */
const HOTE = /^(?:www\.|m\.)?instagram\.com\/|^(?:www\.)?instagr\.am\//i;
/** La meme adresse, mais sans pseudo derriere : elle ne designe personne. */
const HOTE_SEUL = /^(?:(?:www\.|m\.)?instagram\.com|(?:www\.)?instagr\.am)$/i;

export function nettoyerInsta(brut: unknown): string | null {
  let s = String(brut == null ? '' : brut)
    // Ce que le presse-papier d'un telephone ajoute sans le dire.
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Aucun pseudo ne contient d'espace : ceux qui restent sont des scories.
    .replace(/[\s\u00A0]+/g, '');
  if (!s) return '';

  s = s.replace(/^@+/, '');                 // l'arobase, telle qu'on l'ecrit
  s = s.replace(/^(?:https?:)?\/\//i, '');  // le schema du lien colle

  if (HOTE.test(s)) s = s.replace(HOTE, '');
  // Un lien vers autre chose qu'Instagram ne designe pas un compte Instagram.
  // Sans ce refus, « tiktok.com/@moi » deviendrait le pseudo « tiktok.com ».
  else if (s.includes('/')) return null;
  else if (HOTE_SEUL.test(s)) return null;

  s = s.replace(/[?#].*$/, '');             // ?igsh=... du partage, ancre
  s = s.replace(/\/.*$/, '');               // la barre finale, /reels, /tagged
  s = s.replace(/^@+/, '');                 // instagram.com/@pseudo

  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}
