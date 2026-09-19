/* ===========================================================================
   LA VOIX DES JOURS DE COMPETITION
   ---------------------------------------------------------------------------
   Sprinter parle de deux voix, et celle-ci n'est pas celle du jeu.

   LA VOIX ORDINAIRE — fond #060913, lueur doree, Outfit 900 — est celle du
   jeu lui-meme : l'affiche de fin de course, le carton d'une video, la carte
   d'un defi qu'un joueur partage. Elle vit dans `src/game/palette-affiche.js`,
   parce que le jeu la dessine aussi.

   CELLE-CI est celle des JOURS DE COMPETITION : bleu nuit, degrade orange,
   pastille. Le compte la prend quand il parle d'autre chose que de lui — un
   record du monde, une finale, un chrono d'ailleurs — et quand il parle de
   competition tout court : le classement des nations du lundi en est. Le jeu
   ne la dessine jamais ; elle n'existe que dans les cartes qu'on poste, d'ou
   sa place ici, dans `tools/`, et non dans `src/`.

   POURQUOI CE FICHIER EXISTE. Ces valeurs etaient recopiees dans trois cartes,
   a l'identique et sans que rien ne le dise. Une quatriere carte en aurait
   fait quatre. Un degrade qui bouge dans une carte et pas dans les autres, ce
   sont deux cartes du meme compte, la meme semaine, dans le meme fil, qui ne
   se ressemblent plus — et personne ne s'en apercoit avant de les voir cote a
   cote chez quelqu'un d'autre.

   CE QUI N'EST PAS ICI. Les mises en page. Chaque carte a la sienne, et elles
   n'ont pas les memes blocs : un podium n'est pas un billet de code, qui n'est
   pas un tableau de nations. Remonter les proportions ferait un moule au lieu
   d'une voix.

   DEUX CARTES N'EN SONT PAS ENCORE CLIENTES : `carte-defi.mjs` et
   `carte-riposte.mjs` gardent leurs copies. Elles passent par puppeteer-core
   et le chemin d'un Chrome ecrit en dur pour un Mac ; on ne peut donc pas les
   rendre ici pour verifier qu'elles sortent identiques, et une carte qu'on
   modifie sans pouvoir la regarder est une carte qu'on casse. A reprendre
   quand elles passeront par `chrome.mjs`, comme les autres.
=========================================================================== */

/** Le bleu nuit du fond, et les deux teintes du halo qui le detache du fil. */
export const NUIT = '#070b16';
export const HALO = { coeur: '#17213a', bord: '#101728' };

/**
 * LE DEGRADE, qui est la signature de cette voix.
 *
 * Trois arrets et non deux : le passage par l'ambre au milieu est ce qui le
 * fait ressembler a une flamme plutot qu'a un fondu. `deg` varie d'une carte a
 * l'autre — 48 % pour un titre, 50 % pour une pastille — parce qu'un bloc
 * large et un bloc etroit ne coupent pas le degrade au meme endroit.
 */
export const FLAMME = { haut: '#fbc44e', milieu: '#f7a03c', bas: '#ef7526' };
export function flamme(milieu = 48) {
  return `linear-gradient(100deg,${FLAMME.haut} 4%,${FLAMME.milieu} ${milieu}%,${FLAMME.bas} 96%)`;
}

/** Le fond complet : l'aplat, puis le halo par-dessus. */
export function fond() {
  return `background:${NUIT};
       background-image:radial-gradient(ellipse 88% 62% at 50% 46%,
                        ${HALO.coeur} 0%,${HALO.bord} 46%,${NUIT} 100%)`;
}

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

/**
 * L'ECHELLE D'UN FORMAT.
 *
 * Le format de X fait 900 pixels de haut pour le meme contenu qu'un 1350 : un
 * tiers de hauteur en moins, et la carte deborde si l'on se contente de
 * reduire les polices a vue. La story, elle, a de la place a perdre. C'est la
 * regle des trois cartes existantes, ecrite une fois.
 */
export function echelle(w, h) {
  return w > h ? 0.6 : (h > 1500 ? 1.12 : 1);
}

/** Les trois formats ou ces cartes sortent. */
export const FORMATS = [
  { cle: 'feed',  w: 1080, h: 1350 },
  { cle: 'story', w: 1080, h: 1920 },
  { cle: 'x',     w: 1600, h: 900 },
];

/** Le drapeau d'un pays, a partir de son seul code ISO. */
export function drapeau(code) {
  const c = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map(l => 0x1f1e6 + l.charCodeAt(0) - 65));
}

export const echappe = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
