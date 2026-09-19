/* ===========================================================================
   LA VOIX ORDINAIRE — le style du jeu, en un seul endroit.
   ---------------------------------------------------------------------------
   Sprinter parle de deux voix. Celle-ci est l'ORDINAIRE : le fond du jeu, sa
   lueur doree, son or. C'est ce que dessine l'affiche de fin de course, ce que
   porte le carton de fin d'une video, et la maquette par defaut des cartes de
   defi. L'autre — bleu nuit, degrade orange — est celle des JOURS DE
   COMPETITION, quand le compte parle d'autre chose que de lui : un record du
   monde, une finale, un chrono d'ailleurs. Elle n'est pas ici : elle vit dans
   `tools/carte-defi-ouvert.mjs`, qui porte les deux maquettes et l'explique.

   POURQUOI CE FICHIER EXISTE. Trois programmes dessinent dans cette voix, et
   aucun ne peut lire la feuille de style de l'autre : le jeu peint sur un
   canvas, l'outil des cartes ecrit du CSS, et l'un tourne dans un navigateur
   quand l'autre tourne dans node. Sans un endroit commun, chacun garde sa
   copie — et le jour ou l'or bouge, deux visuels du meme jeu se croisent dans
   le meme fil avec deux ors differents. Ce n'est pas une hypothese : c'est
   arrive a la copie de `trace-affiche.js` du depot de suivi, qui a pris cinq
   jours de retard sans que rien ne le dise.

   CE QUI EST ICI ET CE QUI N'Y EST PAS. Ici, ce qui fait la VOIX : les
   couleurs, les encres, la lueur, et les deux regles de mesure qu'on oublie
   toujours en recopiant. Pas les proportions de mise en page — elles sont
   ancrees a `game/trace-affiche.js`, qui en est la source, et les remonter ici
   ferait un troisieme niveau de copie au lieu d'en supprimer un.

   Ce fichier est du JavaScript nu, sans un mot de TypeScript, et c'est
   volontaire : `tools/carte-defi-ouvert.mjs` l'importe tel quel depuis node,
   ou rien ne compile. Le jeu l'importe par le bundle, ou `allowJs` le laisse
   passer et ou les types se deduisent tout seuls.
=========================================================================== */

/** Le fond du jeu. Le meme que `capacitor.config.ts` donne au lancement. */
export const FOND = '#060913';

/**
 * L'or du jeu.
 *
 * Celui des medailles (`Insignes.tsx`) et non `--primary`, qui suit le theme.
 * Un visuel doit sortir pareil d'un post a l'autre, quelle que soit l'humeur
 * du theme a cette date-la — c'est un metal, pas une interface.
 */
export const OR = '#F8CD4A';

/** Le meme or, en composantes, pour tout ce qui le veut transparent. */
export const OR_RVB = '248,205,74';

/** Le blanc du code, et de ce qui doit se lire net. */
export const BLANC = '#ffffff';

/** L'or en transparence : `or(0.85)` -> `rgba(248,205,74,0.85)`. */
export function or(alpha) {
  return `rgba(${OR_RVB},${alpha})`;
}

/** Le blanc en transparence, qui est la seule encre du style. */
export function encre(alpha) {
  return `rgba(255,255,255,${alpha})`;
}

/**
 * LES ENCRES, ET LEUR HIERARCHIE.
 *
 * Elles ne sont pas interchangeables : le surtitre et l'etiquette se lisent
 * moins que le nom, qui se lit moins que le chrono. Cette hierarchie EST la
 * mise en page ; la changer d'un cote seulement la casse des deux. On les
 * nomme par leur role et non par leur valeur, pour qu'un ajustement se fasse
 * ici, une fois, et se voie partout.
 */
export const ENCRE = {
  surtitre: 0.46,
  nom: 0.55,
  etiquette: 0.46,
  lien: 0.38,
  pied: 0.46,
  piedDroit: 0.30,
  filet: 0.10,
};

/**
 * LA LUEUR DOREE, CENTREE EN HAUT.
 *
 * `rayon` est une part de la LARGEUR, `x` et `y` des parts de chaque
 * dimension. C'est elle qui fait reconnaitre le jeu avant qu'on ait lu un mot,
 * et c'est aussi elle qui empeche le fond de faire un trou noir dans un fil.
 */
export const LUEUR = { rayon: 0.85, x: 0.5, y: 0.08, alpha: 0.20 };

/**
 * L'UNITE DE MESURE, ET CE N'EST PAS LE PLUS PETIT COTE.
 *
 * La largeur en portrait, 62 % de la hauteur en paysage. Un format large est
 * trois fois moins haut que large : une taille exprimee en fraction de sa
 * largeur y devient enorme, et le chrono mange le cadre. C'est l'erreur qu'on
 * refait a chaque nouveau format, d'ou cette fonction plutot qu'une ligne
 * recopiee.
 */
export function unite(l, h) {
  return l > h ? h * 0.62 : l;
}

/**
 * CE QU'ON RETIRE A LA VIRGULE, DE CHAQUE COTE, EN CHASSES DE CHIFFRE.
 *
 * Space Mono est a chasse fixe : la virgule y occupe la case d'un chiffre, et
 * « 8,64 » se lit alors « 8 , 64 » — deux nombres au lieu d'un. Trois
 * dixiemes retires de chaque cote en laissent quatre, ce qui est la mesure que
 * le jeu donne deja (`morceauxChrono`, `trace-affiche.js`). Le point anglais a
 * exactement le meme defaut et prend le meme traitement.
 */
export const RETRAIT_VIRGULE = 0.30;
