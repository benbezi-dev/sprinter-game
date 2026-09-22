/* ===========================================================================
   LA VOIX DES JOURS DE COMPETITION
   ---------------------------------------------------------------------------
   Sprinter parle de deux voix.

   LA VOIX ORDINAIRE — fond #060913, lueur doree, Outfit 900 — est celle du jeu
   qui parle de lui : l'affiche de fin de course, le carton d'une video de
   campagne, la carte d'un defi qu'un joueur partage. Elle vit dans
   `palette-affiche.js`, a cote de celle-ci.

   CELLE-CI est celle des JOURS DE COMPETITION : bleu nuit, degrade orange. Le
   compte la prend quand il parle de competition — un record du monde, une
   finale, un chrono d'ailleurs, le classement des nations du lundi.

   POURQUOI ELLE A DEMENAGE ICI. Elle vivait dans `tools/`, et son propre
   en-tete disait pourquoi : « le jeu ne la dessine jamais ; elle n'existe que
   dans les cartes qu'on poste ». Ce n'est plus vrai. Un championnat EST un
   jour de competition, et la video d'une de ses courses sort du jeu par la
   meme porte qu'une carte : elle se retrouve dans le meme fil, le meme jour,
   a cote d'elles. Un carton de fin dore au milieu de cartes bleu nuit, ce sont
   deux voix pour un seul evenement.

   `tools/voix-competition.mjs` la reexporte et garde ce qui n'appartient qu'aux
   cartes — le fond en CSS, les formats, les drapeaux. Les valeurs, elles, ne
   sont ecrites qu'ici : c'est la seule facon qu'un orange qui bouge atteigne du
   meme coup les cartes du compte et les videos du jeu.

   CE QUI N'EST PAS ICI. Les mises en page. Chaque carte a la sienne, et le
   carton de fin la sienne : un podium n'est pas un billet de code, qui n'est
   pas un carton de video. Remonter les proportions ferait un moule au lieu
   d'une voix.
=========================================================================== */

/** Le bleu nuit du fond, et les deux teintes du halo qui le detache du fil. */
export const NUIT = '#070b16';
export const HALO = { coeur: '#17213a', bord: '#101728' };

/**
 * LE DEGRADE, qui est la signature de cette voix.
 *
 * Trois arrets et non deux : le passage par l'ambre au milieu est ce qui le
 * fait ressembler a une flamme plutot qu'a un fondu.
 */
export const FLAMME = { haut: '#fbc44e', milieu: '#f7a03c', bas: '#ef7526' };

/**
 * LES ENCRES, PAR ROLE ET NON PAR VALEUR.
 *
 * `kicker` et `etiquette` partagent presque la meme, et ce n'est pas un
 * doublon : l'un coiffe la carte, l'autre un bloc interieur, et le jour ou
 * l'un bouge l'autre ne doit pas suivre par accident.
 */
export const ENCRE = {
  kicker: '#8494ad',
  sous: '#93a2ba',
  etiquette: '#7e8da6',
  rang: '#7e8da6',
  vif: '#eef2f8',
  doux: '#8d9cb4',
  filet: '#253049',
  surPastille: '#0a1020',
};

/* ------------------------------------------- ce que le jeu en fait au canvas

   Les cartes composent cette voix en CSS, le jeu la peint au pinceau. Les deux
   fonctions qui suivent sont la traduction de `fond()` et `flamme()` pour un
   contexte 2D — meme geometrie, memes arrets, pour que la video et la carte
   posees cote a cote se ressemblent vraiment.                               */

/**
 * Le halo du fond, en ellipse, comme le `radial-gradient` des cartes.
 *
 * Un `createRadialGradient` ne fait que des cercles : l'ellipse s'obtient en
 * ecrasant le repere avant de peindre. Sans cela le halo serait rond sur une
 * story en 9:16, et la carte et la video n'auraient plus le meme centre de
 * lumiere.
 */
export function peindreLeFond(ctx, l, h) {
  ctx.fillStyle = NUIT;
  ctx.fillRect(0, 0, l, h);

  const rx = l * 0.88, ry = h * 0.62;
  ctx.save();
  ctx.translate(l * 0.5, h * 0.46);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, HALO.coeur);
  g.addColorStop(0.46, HALO.bord);
  g.addColorStop(1, NUIT);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * Le degrade de la flamme, pose sur une boite donnee.
 *
 * `linear-gradient(100deg, …)` descend vers la droite en s'inclinant a peine :
 * on l'approche par une diagonale de la boite du texte. Un degrade vit dans
 * l'espace du canvas et non dans celui de la lettre — d'ou la boite en
 * argument plutot qu'un appel sans coordonnees.
 */
export function flammeSur(ctx, x, y, l, h) {
  const g = ctx.createLinearGradient(x, y, x + l, y + h * 0.35);
  g.addColorStop(0.04, FLAMME.haut);
  g.addColorStop(0.48, FLAMME.milieu);
  g.addColorStop(0.96, FLAMME.bas);
  return g;
}
