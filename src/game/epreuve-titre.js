/* ===========================================================================
   LE NOM D'UNE EPREUVE, EN TOUTES LETTRES
   ---------------------------------------------------------------------------
   `EPREUVE` de `trace-affiche.js` ecrit la forme COURTE — « 100 m », « 400 m H »
   — celle qui va sur une affiche a cote d'un chrono, ou la place manque et ou
   le contexte dit deja de quoi on parle.

   Celle-ci est la forme LONGUE, et elle n'a qu'un seul emploi : le titre d'un
   apercu de lien. « Sprinter — tu vaux quoi sur 400 m H ? » se lit comme une
   reference de catalogue ; « sur 400 mètres haies ? » se lit comme une
   question. Un apercu de lien s'affiche dans une conversation, entre deux
   phrases ecrites par des gens.

   POURQUOI CE FICHIER EST EN `.js` ET DANS `src/game/`. Il est lu des deux
   cotes : par le jeu, qui compose le lien a partager, et par la configuration
   de build, qui fabrique une page d'apercu par epreuve. Un `.ts` demanderait
   une compilation a `vite.config`, et une copie dans chacun ferait deux listes
   d'epreuves qui divergeraient au premier ajout — c'est la meme raison qui met
   `palette-affiche.js` a cote.
=========================================================================== */

/**
 * Les epreuves qui ont leur page d'apercu.
 *
 * La meme liste que `CLES` cote serveur (worker/src/epreuves.js), et elle doit
 * le rester : une epreuve absente d'ici retombe sur l'apercu generique, ce qui
 * n'est pas une panne mais fait mentir le titre. Elle est courte et fermee —
 * on n'invente pas une distance a l'execution.
 */
export const EPREUVES_APERCU = ['100', '200', '400', '100h', '110h', '400h'];

/** « 100 mètres », « 400 mètres haies ». */
export function titreLong(cle) {
  const s = String(cle || '');
  const m = s.match(/^(\d+)(h?)$/);
  if (!m) return '';
  return `${m[1]} mètres${m[2] ? ' haies' : ''}`;
}

/** « 100 metres », « 400 metres hurdles » — la meme chose, en anglais. */
export function titreLongEn(cle) {
  const s = String(cle || '');
  const m = s.match(/^(\d+)(h?)$/);
  if (!m) return '';
  return `${m[1]} metres${m[2] ? ' hurdles' : ''}`;
}
