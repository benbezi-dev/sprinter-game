// Generateur du logo SPRINTER-GAME.
//
// Le logo est ecrit en chemins vectoriels plutot qu'en <text> : une police
// n'est pas garantie presente la ou le logo finit (README, fiches des stores,
// apercu d'un lien partage), et un <text> dont la police manque se rabat sur
// une police systeme qui casse le dessin. Les lettres sont donc dessinees ici,
// a facettes droites, dans le meme esprit low-poly que le rendu du jeu.
//
//   node tools/logo-generer.mjs
//
// Reecrit assets-stores/logo-sprinter-game*.svg.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const OR = '#F8CD4A';
const OR_CLAIR = '#FFE9A3';
const OR_SOMBRE = '#E0A92C';
const CYAN = '#5FD3E8';
const NUIT = '#060913';

// ---------------------------------------------------------------------------
// Alphabet. Hauteur de capitale 100, ligne de base en y=100, chaque lettre
// part de x=0. Uniquement des segments droits : les angles coupes remplacent
// les courbes, ce qui donne la facette du jeu et evite de caler des courbes de
// Bezier a la main.
//
// Une lettre est faite de morceaux : soit un contour plein (les contrepoincons
// de P, R et A sont des sous-chemins evides en evenodd), soit un trait epais
// quand la diagonale se decrit mieux par son axe que par ses deux bords —
// c'est le cas du V du M et des jambages du A.
// ---------------------------------------------------------------------------
const ALPHABET = {
  S: { l: 72, p: [{ d: 'M12 0 L72 0 L72 24 L24 24 L24 38 L72 38 L72 88 L60 100 L0 100 L0 76 L48 76 L48 62 L0 62 L0 12 Z' }] },
  P: { l: 72, p: [{ d: 'M0 0 L60 0 L72 12 L72 50 L60 62 L24 62 L24 100 L0 100 Z M24 22 L48 22 L48 40 L24 40 Z' }] },
  R: { l: 74, p: [{ d: 'M0 0 L60 0 L72 12 L72 50 L58 62 L74 100 L48 100 L34 62 L24 62 L24 100 L0 100 Z M24 22 L48 22 L48 40 L24 40 Z' }] },
  I: { l: 24, p: [{ d: 'M0 0 L24 0 L24 100 L0 100 Z' }] },
  N: { l: 72, p: [{ d: 'M0 0 L24 0 L48 74 L48 0 L72 0 L72 100 L48 100 L24 26 L24 100 L0 100 Z' }] },
  T: { l: 72, p: [{ d: 'M0 0 L72 0 L72 24 L48 24 L48 100 L24 100 L24 24 L0 24 Z' }] },
  E: { l: 68, p: [{ d: 'M0 0 L68 0 L68 24 L24 24 L24 38 L58 38 L58 60 L24 60 L24 76 L68 76 L68 100 L0 100 Z' }] },
  G: { l: 72, p: [{ d: 'M12 0 L60 0 L72 12 L72 24 L24 24 L24 76 L48 76 L48 66 L36 66 L36 44 L72 44 L72 88 L60 100 L12 100 L0 88 L0 12 Z' }] },
  // A et M : les diagonales sont decrites par leurs deux bords, decales de
  // l'epaisseur perpendiculaire (24) — un trait epais aurait deborde sous la
  // ligne de base a la pointe du V, et bouche le contrepoincon du A.
  A: { l: 84, p: [{ d: 'M29 0 L55 0 L84 100 L58 100 L55.1 88 L28.9 88 L26 100 L0 100 Z M42 34 L50.2 68 L33.8 68 Z' }] },
  M: { l: 88, p: [{ d: 'M0 0 L24.8 0 L44 39.6 L63.2 0 L88 0 L88 100 L64 100 L64 51.2 L44 92.4 L24 51.2 L24 100 L0 100 Z' }] },
};

// Pose un mot lettre par lettre.
function mot(texte, ecart = 12) {
  let x = 0;
  const morceaux = [];
  for (const c of texte) {
    const g = ALPHABET[c];
    for (const part of g.p) {
      const d = part.d.replace(/([ML]) *(-?[\d.]+) +(-?[\d.]+)/g,
        (_, cmd, px, py) => `${cmd}${(+px + x).toFixed(1)} ${py}`);
      morceaux.push(part.w
        ? `<path d="${d}" fill="none" stroke-width="${part.w}" stroke-linejoin="miter"/>`
        : `<path d="${d}" stroke="none" fill-rule="evenodd"/>`);
    }
    x += g.l + ecart;
  }
  return { svg: morceaux.join('\n    '), largeur: x - ecart };
}

// ---------------------------------------------------------------------------
// Le sprinter. Dessine en repere local (x vers l'avant, y vers le bas), les
// membres en traits epais pour garder des articulations rondes.
//
// `halo` epaissit tout le personnage : cette version-la ne s'affiche pas, elle
// sert de decoupe dans le mot, pour que le coureur et les lettres restent deux
// formes distinctes alors qu'ils partagent la meme couleur.
// ---------------------------------------------------------------------------
// Un membre : une suite de points et une largeur a chaque point. On decale
// chaque segment de sa perpendiculaire et on relie les coins au passage de
// l'articulation — l'angle vif obtenu est le meme vocabulaire que les lettres,
// la ou un trait a bouts ronds donnait un bonhomme de pate a modeler.
function membre(points, largeurs, halo) {
  const n = points.length;
  const norm = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const d = Math.hypot(x1 - x0, y1 - y0);
    norm.push([-(y1 - y0) / d, (x1 - x0) / d]);
  }
  const demi = largeurs.map((l) => (l + halo * 2) / 2);
  // A chaque articulation, on cherche l'intersection des deux bords decales
  // (onglet). Sans elle, le cote interieur du coude se creuse d'un cran
  // sombre ; si l'angle est trop ferme, l'onglet fuse et on coupe au biseau.
  const cote = (signe) => {
    const pts = [];
    const bord = (i, j) => [points[j][0] + signe * norm[i][0] * demi[j],
                            points[j][1] + signe * norm[i][1] * demi[j]];
    pts.push(bord(0, 0));
    for (let i = 1; i < n - 1; i++) {
      const a = bord(i - 1, i - 1), b = bord(i - 1, i);
      const c = bord(i, i), d = bord(i, i + 1);
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      const t = Math.abs(den) < 1e-6 ? null
        : ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const onglet = t === null ? null : [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      const fuse = onglet && Math.hypot(onglet[0] - points[i][0], onglet[1] - points[i][1]) > demi[i] * 1.35;
      if (!onglet || fuse) pts.push(b, c);
      else pts.push(onglet);
    }
    pts.push(bord(n - 2, n - 1));
    return pts;
  };
  const contour = [...cote(1), ...cote(-1).reverse()];
  return `<path d="${contour.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z"/>`;
}

// ---------------------------------------------------------------------------
// Le sprinter, en appui d'acceleration : buste penche, genou avant qui monte,
// jambe arriere encore tendue dans la poussee.
//
// `halo` epaissit tout le personnage : cette version-la ne s'affiche pas, elle
// sert de decoupe dans le mot, pour que le coureur et les lettres restent deux
// formes distinctes alors qu'ils partagent la meme couleur.
// ---------------------------------------------------------------------------
function sprinter(halo = 0) {
  const parts = [
    // jambe arriere : hanche, genou, cheville, puis le pied
    membre([[178, 208], [108, 250], [44, 286]], [46, 34, 22], halo),
    membre([[44, 286], [8, 300]], [20, 10], halo),
    // jambe avant : le genou monte, le tibia retombe sous le genou
    membre([[192, 206], [282, 200], [258, 284]], [48, 36, 24], halo),
    membre([[258, 284], [298, 292]], [22, 11], halo),
    // bras arriere : coude en arriere, main derriere la hanche
    membre([[200, 112], [140, 144], [116, 192]], [28, 22, 13], halo),
    // bras avant : coude en avant, main qui remonte au menton
    membre([[228, 116], [296, 142], [300, 88]], [28, 22, 13], halo),
    // buste
    membre([[214, 104], [184, 208]], [56, 48], halo),
    // cou
    membre([[214, 108], [240, 74]], [36, 36], halo),
  ];
  // La tete : un octogone plutot qu'un cercle, pour rester dans la facette.
  const r = 30 + halo;
  const cx = 244, cy = 54;
  const tete = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  parts.push(`<path d="${tete} Z"/>`);

  return parts.join('\n      ');
}

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------
const SPRINTER = mot('SPRINTER');
const GAME = mot('GAME', 30);

// L'emprise de l'encre, relevee sur le rendu (getBBox) : c'est elle qui donne
// le cadrage, pas une zone de travail arbitraire. A remesurer si la mise en
// page bouge.
const ENCRE = { x: 42, y: 80, w: 1202, h: 380 };
const W = 1360, H = 520;   // repere de travail des coordonnees ci-dessous

const ECH = 1.5;                 // capitales de 150 px
const MOT_X = 215, MOT_Y = 150;  // coin haut-gauche du mot
const PENTE = -11;               // l'italique : le mot penche vers l'avant

const COUREUR_ECH = 0.86;
const COUREUR_X = 980, COUREUR_Y = 57;

const GAME_X = MOT_X;
const GAME_ECH = 0.72;
const GAME_BASE = 460;

// Les fentes taillees dans les lettres : le mot part en lamelles vers
// l'arriere, la ou le coureur est deja passe. Coordonnees du mot.
const FENTES = [
  { y: 16, x0: -30, x1: 300 },
  { y: 40, x0: -30, x1: 210 },
  { y: 66, x0: -30, x1: 340 },
  { y: 88, x0: -30, x1: 180 },
  // Ces deux-la traversent aussi le coureur : la meme coupe court du mot
  // jusqu'au corps, et c'est elle qui detache le buste de la cuisse.
  { y: 30, x0: 430, x1: 640, ep: 5 },
  { y: 58, x0: 396, x1: 640, ep: 5 },
];
const EP_FENTE = 7;

// Les traits de vitesse qui filent derriere le mot.
const TRAITS = [
  { y: 20, x0: -58, x1: -16, o: 0.9 },
  { y: 44, x0: -86, x1: -38, o: 0.6 },
  { y: 70, x0: -52, x1: -14, o: 0.85 },
  { y: 92, x0: -96, x1: -46, o: 0.45 },
];

const fentes = (choix = () => true) => FENTES.filter(choix).map(f =>
  `<rect x="${f.x0}" y="${f.y}" width="${f.x1 - f.x0}" height="${f.ep ?? EP_FENTE}"/>`).join('\n        ');

const traitsVitesse = (c) => TRAITS.map(t =>
  `<rect x="${t.x0}" y="${t.y}" width="${t.x1 - t.x0}" height="${EP_FENTE}" fill="${c}" opacity="${t.o}"/>`).join('\n    ');

function logo({ fond, marge, mono }) {
  const vb = { x: ENCRE.x - marge, y: ENCRE.y - marge, w: ENCRE.w + 2 * marge, h: ENCRE.h + 2 * marge };
  const orMot = mono ? mono : 'url(#or-mot)';
  const orCoureur = mono ? mono : 'url(#or-coureur)';
  const cyan = mono ? mono : CYAN;
  const transfoMot = `translate(${MOT_X} ${MOT_Y}) scale(${ECH}) skewX(${PENTE})`;
  const transfoCoureur = `translate(${COUREUR_X} ${COUREUR_Y}) scale(${COUREUR_ECH})`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}" role="img" aria-label="SPRINTER-GAME">
  <title>SPRINTER-GAME</title>
  <defs>
${mono ? '' : `    <!-- Deux degrades pour un seul or : le mot et le coureur n'ont pas le meme
         repere, un degrade en unites d'objet se recalerait sur chaque lettre. -->
    <linearGradient id="or-mot" gradientUnits="userSpaceOnUse" x1="0" y1="-6" x2="0" y2="106">
      <stop offset="0%" stop-color="${OR_CLAIR}"/>
      <stop offset="55%" stop-color="${OR}"/>
      <stop offset="100%" stop-color="${OR_SOMBRE}"/>
    </linearGradient>
    <linearGradient id="or-coureur" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="310">
      <stop offset="0%" stop-color="${OR_CLAIR}"/>
      <stop offset="55%" stop-color="${OR}"/>
      <stop offset="100%" stop-color="${OR_SOMBRE}"/>
    </linearGradient>
    `}
    <clipPath id="cadre">
      <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" rx="28"/>
    </clipPath>
    <!-- Le mot est perce : les fentes de vitesse, et la silhouette elargie du
         coureur. Des trous, pas des aplats couleur fond : le logo se pose ainsi
         sur n'importe quel fond sombre. -->
    <mask id="decoupe-mot">
      <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>
      <g fill="#000" transform="${transfoMot}">
        ${fentes()}
      </g>
      <g fill="#000" transform="${transfoCoureur}">
      ${sprinter(7)}
      </g>
    </mask>
    <mask id="decoupe-coureur">
      <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>
      <g fill="#000" transform="${transfoMot}">
        ${fentes((f) => f.coureur)}
      </g>
    </mask>
  </defs>
${fond ? `  <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" rx="28" fill="${NUIT}"/>
  <!-- Les couloirs de la piste, en diagonale, comme sur l'icone du jeu. -->
  <g clip-path="url(#cadre)" fill="${OR}" opacity="0.035" transform="rotate(-11 ${W / 2} ${H / 2})">
    <rect x="-400" y="10" width="${W + 800}" height="96"/>
    <rect x="-400" y="212" width="${W + 800}" height="96"/>
    <rect x="-400" y="414" width="${W + 800}" height="96"/>
  </g>
` : ''}
  <g transform="${transfoMot}">
    ${traitsVitesse(cyan)}
  </g>

  <g mask="url(#decoupe-mot)">
    <g transform="${transfoMot}" fill="${orMot}" stroke="${orMot}">
    ${SPRINTER.svg}
    </g>
  </g>

  <g mask="url(#decoupe-coureur)">
    <g transform="${transfoCoureur}" fill="${orCoureur}">
      ${sprinter(0)}
    </g>
  </g>

  <g transform="translate(${GAME_X} ${GAME_BASE - 100 * GAME_ECH}) scale(${GAME_ECH}) skewX(${PENTE})" fill="${cyan}" stroke="${cyan}">
    <path stroke="none" d="M-2 40 L84 40 L84 62 L-2 62 Z"/>
    <g transform="translate(120 0)">
    ${GAME.svg}
    </g>
  </g>
</svg>
`;
}

mkdirSync(join(RACINE, 'assets-stores'), { recursive: true });
writeFileSync(join(RACINE, 'assets-stores/logo-sprinter-game.svg'), logo({ fond: false, marge: 44 }));
writeFileSync(join(RACINE, 'assets-stores/logo-sprinter-game-fond.svg'), logo({ fond: true, marge: 80 }));
writeFileSync(join(RACINE, 'assets-stores/logo-sprinter-game-mono.svg'), logo({ fond: false, marge: 44, mono: NUIT }));
console.log('logo ecrit —', SPRINTER.largeur, GAME.largeur);
