// LA SCENE DU GENERIQUE — ce qu'on voit pendant que le morceau tourne.
//
// Elle se joue apres le sacre, quand les six etapes sont gagnees : le stade se
// vide, la nuit tombe sur la piste, et le joueur fait son tour d'honneur
// pendant que le texte defile. Voir game/generique.ts pour la musique, et
// components/screens/Generique.tsx pour le texte.
//
// CE QUI EST DESSINE ICI ET NON DANS GameCanvas : la cinematique ordinaire y
// tient en vingt lignes ; celle-ci en demande deux cents. La boucle de rendu
// reste lisible, et cette scene-la se relit sans avoir a la chercher au milieu
// du reste.
//
// LE MORCEAU MENE LA SCENE. `niveauDuGenerique()` rend l'energie du bas du
// spectre a cet instant : les projecteurs s'ouvrent dessus, le halo de la piste
// respire avec, et les feux d'artifice partent sur ses frappes. Sans musique —
// son coupe, fichier absent — tout retombe a zero et la scene tient sur son
// seul temps ecoule : plus calme, jamais figee.

import { dureeDuGenerique, niveauDuGenerique } from './generique';

/** Un feu d'artifice en cours : ou il est parti, et quand. */
type Feu = { x: number; y: number; t0: number; teinte: number };

let feux: Feu[] = [];
let dernierFeu = -9;
let ctPrecedent = 0;

const COULEURS = [
  [248, 205, 74],   // l'or du jeu
  [104, 216, 236],
  [232, 121, 216],
  [108, 226, 138],
  [238, 240, 248],
];

/** Bruit deterministe : la meme graine donne toujours la meme etoile. */
function grain(i: number): number {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Dessine le generique. Appelee une fois par image, a la place du monde.
 *
 * `A` est SprinterApp — on passe le module plutot que d'importer le moteur,
 * qui n'est pas un module mais un global pose par sprinter-app.js.
 */
export function dessinerLeGenerique(ctx: CanvasRenderingContext2D, A: any): void {
  const G = A.G;
  const cut = G.cut;
  if (!cut) return;
  const ct = cut.t;
  const S = (v: number) => A.ui() * v;
  const VW = G.VW, VH = G.VH;

  // Scene rejouee depuis le debut : on repart sur un ciel vide.
  if (ct < ctPrecedent) { feux = []; dernierFeu = -9; }
  ctPrecedent = ct;

  const niveau = niveauDuGenerique();
  // L'ouverture : la nuit tombe en une seconde et demie sur le stade du sacre.
  const nuit = Math.min(1, ct / 1.5);

  // ------------------------------------------------------------ la nuit
  const voile = ctx.createLinearGradient(0, 0, 0, VH);
  voile.addColorStop(0, `rgba(3,5,14,${0.97 * nuit})`);
  voile.addColorStop(0.62, `rgba(6,9,22,${0.93 * nuit})`);
  voile.addColorStop(1, `rgba(10,8,18,${0.86 * nuit})`);
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, VW, VH);

  // ----------------------------------------------------------- le ciel
  for (let i = 0; i < 90; i++) {
    const x = grain(i) * VW;
    const y = grain(i + 91) * VH * 0.72;
    const sc = 0.35 + 0.65 * Math.abs(Math.sin(ct * (0.6 + grain(i + 17)) + i));
    ctx.fillStyle = `rgba(226,232,255,${(0.10 + 0.5 * sc * grain(i + 43)) * nuit})`;
    const r = S(0.7 + grain(i + 7) * 1.5);
    ctx.fillRect(x, y, r, r);
  }

  // --------------------------------------------- les projecteurs du stade
  //
  // Cinq faisceaux tombent du haut et balayent lentement. Ils s'ouvrent avec
  // la musique : c'est le geste le plus simple qui lie l'image au son, et le
  // seul qu'on percoive encore du coin de l'oeil pendant qu'on lit le texte.
  const ouverture = 0.55 + 0.45 * niveau;
  for (let i = 0; i < 5; i++) {
    const base = VW * (0.12 + i * 0.19) + Math.sin(ct * 0.24 + i * 1.7) * VW * 0.10;
    const c = COULEURS[i % COULEURS.length];
    const g = ctx.createLinearGradient(base, -VH * 0.1, base - VW * 0.2, VH);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.16 * ouverture * nuit})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(base - S(14), -VH * 0.05);
    ctx.lineTo(base + S(14), -VH * 0.05);
    ctx.lineTo(base - VW * 0.16 + S(150) * ouverture, VH);
    ctx.lineTo(base - VW * 0.16 - S(150) * ouverture, VH);
    ctx.closePath();
    ctx.fill();
  }

  // ------------------------------------------------------- la ligne d'horizon
  const hy = VH * (G.portrait ? 0.70 : 0.74);

  // Les gradins, en silhouette : une bande sombre, et la houle des spectateurs
  // restes apres la course.
  ctx.fillStyle = `rgba(8,10,24,${0.9 * nuit})`;
  ctx.fillRect(0, hy - S(46), VW, S(46));
  for (let i = 0; i < 64; i++) {
    const x = (i / 64) * VW + Math.sin(ct * 0.7 + i) * S(1.5);
    const h = S(7 + grain(i + 300) * 6);
    const b = 0.10 + 0.14 * Math.abs(Math.sin(ct * 1.4 + i * 0.9));
    ctx.fillStyle = `rgba(190,200,240,${b * nuit})`;
    ctx.fillRect(x, hy - S(20) - h, S(3.5), h);
  }

  // La piste : une bande claire qui respire avec le morceau.
  const piste = ctx.createLinearGradient(0, hy, 0, VH);
  piste.addColorStop(0, `rgba(58,36,30,${0.85 * nuit})`);
  piste.addColorStop(1, `rgba(22,14,14,${0.9 * nuit})`);
  ctx.fillStyle = piste;
  ctx.fillRect(0, hy, VW, VH - hy);

  // Le halo du couloir eclaire — celui du joueur, le seul qui reste allume.
  const halo = ctx.createRadialGradient(VW * 0.5, hy + S(40), S(10),
                                        VW * 0.5, hy + S(40), VW * (0.42 + 0.12 * niveau));
  halo.addColorStop(0, `rgba(248,205,74,${(0.10 + 0.10 * niveau) * nuit})`);
  halo.addColorStop(1, 'rgba(248,205,74,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, hy - S(60), VW, VH - hy + S(60));

  // Les lignes de couloir, qui filent vers la droite avec le coureur.
  ctx.strokeStyle = `rgba(232,236,255,${0.13 * nuit})`;
  ctx.lineWidth = Math.max(1, S(1.6));
  for (let i = 1; i <= 3; i++) {
    const y = hy + (VH - hy) * (i / 4);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
  }

  // --------------------------------------------------- les sept ZEZE, debout
  //
  // Ils sont restes. C'est tout ce que la scene en dit, et c'est assez.
  const Core = (globalThis as any).SprinterCore;
  const zeze = Core ? Object.values(Core.ZEZE) : [];
  for (let i = 0; i < Math.min(7, zeze.length); i++) {
    const x = VW * (0.10 + i * 0.133);
    const y = hy - S(4) + Math.sin(ct * 1.6 + i * 0.8) * S(2);
    ctx.save();
    ctx.globalAlpha = 0.30 * nuit;
    A.drawIcon(ctx, {
      look: zeze[i], stride: 0, v: 0, maxSpeed: 12, fallAnim: 0,
      celebrate: 0.5 + 0.5 * Math.sin(ct * 1.1 + i),
    }, x, y, S(74), i > 3);
    ctx.restore();
  }

  // ------------------------------------------------- le tour d'honneur
  //
  // Le coureur traverse l'ecran de gauche a droite, puis recommence. Un tour
  // dure vingt-deux secondes : assez lent pour qu'on le regarde, assez long
  // pour qu'on ne compte pas les passages.
  const phase = ((ct + 3) / 22) % 1;
  const px = -VW * 0.22 + phase * VW * 1.44;
  const py = hy + (VH - hy) * 0.60;
  // Son ombre portee, qui l'attache au sol.
  ctx.save();
  ctx.globalAlpha = 0.4 * nuit;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  ctx.ellipse(px, py + S(4), S(30), S(7), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Le halo du projecteur qui le suit.
  const suivi = ctx.createRadialGradient(px, py - S(40), S(6), px, py - S(40), S(125));
  suivi.addColorStop(0, `rgba(248,205,74,${(0.13 + 0.14 * niveau) * nuit})`);
  suivi.addColorStop(1, 'rgba(248,205,74,0)');
  ctx.fillStyle = suivi;
  ctx.fillRect(px - S(135), py - S(175), S(270), S(225));
  A.drawIcon(ctx, cut.man, px, py, S(165));

  // ------------------------------------------------------ les feux d'artifice
  //
  // Ils partent sur les frappes du morceau, et pas sur un minuteur : une
  // detonation a cote du temps se voit tout de suite. Le seuil descend avec le
  // temps ecoule depuis le dernier depart — sans quoi un passage calme du
  // morceau eteindrait le ciel pour dix secondes.
  const attente = ct - dernierFeu;
  // Le seuil descend avec l'attente : on demande une frappe franche juste apres
  // un depart, puis on se contente de moins. Sans cette pente, un morceau
  // regulier en tirait un par temps — et un ciel toujours plein ne marque plus
  // rien du tout.
  const seuil = Math.max(0.55, 0.98 - attente * 0.12);
  if ((niveau > seuil && attente > 1) || attente > 5) {
    dernierFeu = ct;
    const n = feux.length;
    feux.push({
      x: VW * (0.12 + grain(n * 3.1 + ct) * 0.76),
      y: VH * (0.10 + grain(n * 5.7 + ct) * 0.34),
      t0: ct,
      teinte: n % COULEURS.length,
    });
    if (feux.length > 10) feux.shift();
  }
  for (const f of feux) {
    const age = ct - f.t0;
    if (age < 0 || age > 1.9) continue;
    const c = COULEURS[f.teinte];
    const a = Math.max(0, 1 - age / 1.9);
    const r = S(10 + age * 150);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + f.t0;
      const d = r * (0.72 + grain(i + f.teinte * 31) * 0.42);
      const x = f.x + Math.cos(ang) * d;
      // La gravite tire les etincelles vers le bas a mesure qu'elles vieillissent.
      const y = f.y + Math.sin(ang) * d * 0.82 + age * age * S(80);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * a * 0.9).toFixed(3)})`;
      const t = S(2.2) * a + S(0.6);
      ctx.fillRect(x, y, t, t);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- les confettis
  //
  // Les memes qu'au sacre, en plus lents : ils tombent depuis deux scenes, et
  // il n'y a plus rien qui presse.
  for (let i = 0; i < 70; i++) {
    const sd = (i * 7919) % 997;
    const x = (sd * 13) % VW;
    const y = ((ct * (34 + sd % 50) + sd * 3) % (VH + 140)) - 70;
    if (y < -10) continue;
    const c = COULEURS[sd % COULEURS.length];
    ctx.save();
    ctx.translate(x + Math.sin(ct * 2.2 + sd) * S(7), y);
    ctx.rotate(ct * (1.4 + (sd % 5) * 0.5) + sd);
    ctx.globalAlpha = 0.75 * nuit;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    const w = S(4 + sd % 4), h = S(7);
    if (sd % 7 === 0) { ctx.beginPath(); ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ----------------------------------------------------------- le fondu final
  //
  // Les six dernieres secondes du morceau, l'image s'eteint avec lui. La duree
  // vient du fichier lui-meme : sans musique elle vaut zero, rien ne
  // s'assombrit, et la scene se termine sur son repli — franchement.
  const totale = dureeDuGenerique();
  if (totale > 0) {
    const reste = totale - ct;
    if (reste < 6) {
      const a = Math.min(1, Math.max(0, (6 - reste) / 6));
      ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }
}
