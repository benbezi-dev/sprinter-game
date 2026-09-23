// LA SCENE DU GENERIQUE — ce qu'on voit pendant que le morceau tourne.
//
// Elle se joue apres le sacre, quand les six etapes sont gagnees : la nuit
// tombe sur le stade, et le joueur fait son tour d'honneur au pied de la
// tribune pendant que le texte defile. Voir game/generique.ts pour la musique,
// et components/screens/Generique.tsx pour le texte.
//
// DANS LE VRAI STADE. La scene dessinait autrefois son propre decor par-dessus
// un voile presque opaque : une bande sombre et une rangee de batonnets pour
// les gradins, une bande brune pour la piste, trois traits pour les couloirs.
// Depuis que les stades, les tribunes et les spectateurs sont fabriques dans
// Blender, ce decor de silhouettes contredisait tout le reste du jeu. Le tour
// d'honneur se court maintenant sur la piste de la derniere etape, devant sa
// tribune et ses spectateurs, avec le coureur et les ombres de la course ; la
// camera le suit comme elle suit une course. La nuit n'est plus qu'un
// assombrissement leger — assez pour les projecteurs et les feux d'artifice,
// jamais au point de rendre le stade illisible.
//
// LE MORCEAU MENE LA SCENE. `niveauDuGenerique()` rend l'energie du bas du
// spectre a cet instant : les projecteurs s'ouvrent dessus, la lumiere sur le
// coureur respire avec, et les feux d'artifice partent sur ses frappes. Sans
// musique — son coupe, fichier absent — tout retombe a zero et la scene tient
// sur son seul temps ecoule : plus calme, jamais figee.

import { dureeDuGenerique, niveauDuGenerique } from './generique';
import { cameraPour } from './cadrage';

/** Un feu d'artifice en cours : ou il est parti, et quand. */
type Feu = { x: number; y: number; t0: number; teinte: number };

let feux: Feu[] = [];
let dernierFeu = -9;
let ctPrecedent = 0;
/** La camera du sacre, au moment ou le generique la reprend. */
let camDepart: [number, number] | null = null;

const COULEURS = [
  [248, 205, 74],   // l'or du jeu
  [104, 216, 236],
  [232, 121, 216],
  [108, 226, 138],
  [238, 240, 248],
];

// LE TOUR D'HONNEUR.
//
// Au petit trot, et a rebours : il repart de l'arrivee vers le depart, face a
// la camera — un salut se regarde de face. Trois metres par seconde, c'est la
// vitesse que donne la foulee que le moteur deroule pour cette scene (7,5
// radians par seconde, un pas par demi-tour, soit 2,4 pas de 1,25 m) : plus
// vite, les pieds glisseraient sur la piste.
const VITESSE = 3.0;
/** Le couloir 8 (compte a partir de zero) : celui qui longe la tribune. */
const COULOIR = 7;
/** Ou le tour commence, au-dela de la ligne d'arrivee. */
const AU_DELA = 12;
/** Ou il s'arrete, juste avant la ligne de depart. */
const AVANT = -2;
/** Le travelling qui va chercher le coureur depuis le plan du sacre. */
const TRAVELLING = 4.5;
/**
 * Le plan se resserre pendant ce travelling, jusqu'a 42 pixels par metre
 * d'interface. Sur le cent metres, que la course montre a 30, le champion ne
 * mesurait qu'une soixantaine de pixels et la tribune laissait la moitie haute
 * de l'image au ciel. Un cadrage ABSOLU et non un facteur : le 200 et le 400
 * se courent deja a 44, et les grossir encore de 40 % amollissait les
 * spectateurs, composes a 80 pixels par metre (voir tribune.js), sur un ecran
 * retina.
 */
const ECHELLE = 42;
/** Le noir qui separe deux passages, de chaque cote de la coupe. */
const COUPE = 0.7;

/** Bruit deterministe : la meme graine donne toujours la meme valeur. */
function grain(i: number): number {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const lisse = (x: number) => x * x * (3 - 2 * x);

/** Ou en est le tour d'honneur : distance sur la piste, et temps dans le passage. */
function trajet(T: any, ct: number) {
  const depart = T.total + AU_DELA;
  const duree = (depart - AVANT) / VITESSE;
  const passe = Math.floor(ct / duree);
  const dans = ct - passe * duree;
  return { d: depart - VITESSE * dans, dans, duree, passe };
}

/** Ou le coureur se tient a l'ecran : a gauche du texte, dans le bas de l'image. */
function cadre(G: any): number[] {
  return G.portrait ? [G.VW * 0.5, G.VH * 0.76] : [G.VW * 0.22, G.VH * 0.70];
}

/**
 * Pose la camera du generique. Appelee AVANT le dessin du monde, pour que la
 * piste, la tribune et le coureur partagent la meme image.
 */
export function placerLaCameraDuGenerique(A: any): void {
  const G = A.G;
  const cut = G.cut;
  if (!cut || !G.track) return;
  const ct = cut.t;
  if (ct < ctPrecedent || !camDepart) {
    feux = []; dernierFeu = -9;
    camDepart = [G.camX, G.camY];
    G.zoomScene = 1;
  }
  ctPrecedent = ct;
  const T = G.track;
  const { d } = trajet(T, ct);
  // Le premier passage part du plan du sacre et glisse jusqu'au coureur ; les
  // suivants reprennent directement sur lui, apres un noir.
  const k = lisse(Math.min(1, ct / TRAVELLING));
  // Le zoom d'abord : la camera qui cadre le coureur se calcule a l'echelle
  // de cette image-ci. Voir zoomDuGenerique dans sprinter-app.js.
  // L'echelle de la course se lit sur scaleM, zoom de l'image precedente
  // retire, plutot que de recopier ici ses constantes.
  const course = A.scaleM() / (G.zoomScene || 1) / A.ui();
  const zoom = Math.max(1, ECHELLE / course);
  G.zoomScene = 1 + (zoom - 1) * k;
  const suivie = cameraPour(A, T.pos(d, COULOIR), cadre(G));
  G.camX = camDepart[0] + (suivie[0] - camDepart[0]) * k;
  G.camY = camDepart[1] + (suivie[1] - camDepart[1]) * k;
}

/**
 * Dessine le generique. Appelee une fois par image, APRES le monde.
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
  const T = G.track;
  const Core = (globalThis as any).SprinterCore;
  const Prem = (globalThis as any).RenduPremium;

  const niveau = niveauDuGenerique();
  // L'ouverture : la nuit tombe en une seconde et demie sur le stade du sacre.
  const nuit = Math.min(1, ct / 1.5);

  // ------------------------------------------------------------ la nuit
  //
  // Un assombrissement, pas un voile : plus marque en haut, ou passe le texte,
  // qu'au sol, ou court le coureur. Les gradins et leurs spectateurs restent
  // lisibles — c'est tout l'objet de la scene refaite.
  const voile = ctx.createLinearGradient(0, 0, 0, VH);
  voile.addColorStop(0, `rgba(4,6,20,${(0.50 * nuit).toFixed(3)})`);
  voile.addColorStop(0.55, `rgba(5,7,22,${(0.36 * nuit).toFixed(3)})`);
  voile.addColorStop(1, `rgba(8,8,20,${(0.26 * nuit).toFixed(3)})`);
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, VW, VH);

  // --------------------------------------------- les projecteurs du stade
  //
  // Cinq faisceaux tombent du haut et balayent lentement. Ils s'ouvrent avec
  // la musique : c'est le geste le plus simple qui lie l'image au son, et le
  // seul qu'on percoive encore du coin de l'oeil pendant qu'on lit le texte.
  const ouverture = 0.55 + 0.45 * niveau;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const base = VW * (0.12 + i * 0.19) + Math.sin(ct * 0.24 + i * 1.7) * VW * 0.10;
    const c = COULEURS[i % COULEURS.length];
    const g = ctx.createLinearGradient(base, -VH * 0.1, base - VW * 0.2, VH);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.10 * ouverture * nuit).toFixed(3)})`);
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
  ctx.restore();

  // ------------------------------------------ le tour d'honneur, sur la piste
  if (T && Core) {
    const m = A.scaleM();
    const { d, dans, duree, passe } = trajet(T, ct);
    const pieds = A.ground(...(T.pos(d, COULOIR) as [number, number]));

    // La lumiere qui le suit, couchee sur la piste : un projecteur de poursuite
    // eclaire le sol autour de lui, il ne peint pas l'air.
    const rayon = m * (4.2 + 1.2 * niveau);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(pieds[0], pieds[1]);
    ctx.scale(1, 0.5);
    const tache = ctx.createRadialGradient(0, 0, 0, 0, 0, rayon);
    tache.addColorStop(0, `rgba(255,226,150,${((0.16 + 0.10 * niveau) * nuit).toFixed(3)})`);
    tache.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = tache;
    ctx.beginPath(); ctx.arc(0, 0, rayon, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Les sept ZEZE sont restes. Alignes juste apres la ligne d'arrivee, un par
    // couloir, tournes vers la camera, ils applaudissent le passage.
    type Figure = { y: number; dessin: () => void; ombre: () => void };
    const figures: Figure[] = [];
    const zeze = Object.values(Core.ZEZE) as any[];
    // Tourne vers la camera : la vue plonge vers les X et les Y decroissants,
    // soit 45 degres une fois le corps retourne (mirror).
    const faceCamera = Math.PI / 4;
    for (let i = 0; i < Math.min(7, zeze.length); i++) {
      const p = T.pos(T.total + 4, i) as [number, number];
      const g = A.ground(p[0], p[1]);
      if (g[0] < -120 || g[0] > VW + 120 || g[1] < -160 || g[1] > VH + 160) continue;
      const look = zeze[i];
      const k = m * (look.h / Core.C.MODEL_H);
      const bravo = { look, stride: ct * 0.6 + i, v: 0, maxSpeed: 12, fallAnim: 0,
                      celebrate: 0.55 + 0.45 * Math.sin(ct * 2.2 + i * 0.9) };
      figures.push({
        y: g[1],
        ombre: () => Prem && Prem.ombre(ctx, g[0], g[1], m, look.h / Core.C.MODEL_H, null, true),
        dessin: () => A.drawFacetFigure(ctx,
          A.personCapsules(bravo, faceCamera, 0, true, !!T.curved, A.niveauDetail(k)),
          g[0], g[1], k),
      });
    }

    // Le champion, au trot, qui salue la tribune — les bras montent et
    // redescendent, un salut fige pendant deux minutes serait une statue.
    const man = cut.man;
    const kJ = m * (man.look.h / Core.C.MODEL_H);
    const lui = { ...man, celebrate: 0.62 + 0.38 * Math.sin(ct * 0.9) };
    figures.push({
      y: pieds[1],
      ombre: () => Prem
        ? Prem.ombre(ctx, pieds[0], pieds[1], m, man.look.h / Core.C.MODEL_H, man.stride, true)
        : undefined,
      dessin: () => A.drawFacetFigure(ctx,
        A.personCapsules(lui, T.heading(d, COULOIR), 0, true, !!T.curved, A.niveauDetail(kJ)),
        pieds[0], pieds[1], kJ),
    });

    // Toutes les ombres d'abord, puis les corps du plus loin au plus pres :
    // l'ombre du voisin ne doit jamais passer sur un coureur.
    figures.sort((u, v) => u.y - v.y);
    ctx.save();
    ctx.globalAlpha = 1;
    for (const f of figures) f.ombre();
    ctx.restore();
    for (const f of figures) f.dessin();

    // LE NOIR ENTRE DEUX PASSAGES. Arrive au depart, le coureur ne fait pas
    // demi-tour sous nos yeux : l'image s'eteint, et se rallume sur lui a
    // l'arrivee. Le premier passage n'en a pas besoin — il part du sacre.
    let noir = 0;
    if (dans > duree - COUPE) noir = (dans - (duree - COUPE)) / COUPE;
    else if (passe > 0 && dans < COUPE) noir = 1 - dans / COUPE;
    if (noir > 0) {
      ctx.fillStyle = `rgba(0,0,0,${lisse(Math.min(1, noir)).toFixed(3)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

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
      y: VH * (0.08 + grain(n * 5.7 + ct) * 0.30),
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
      const dd = r * (0.72 + grain(i + f.teinte * 31) * 0.42);
      const x = f.x + Math.cos(ang) * dd;
      // La gravite tire les etincelles vers le bas a mesure qu'elles vieillissent.
      const y = f.y + Math.sin(ang) * dd * 0.82 + age * age * S(80);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * a * 0.9).toFixed(3)})`;
      const t = S(2.2) * a + S(0.6);
      ctx.fillRect(x, y, t, t);
    }
    ctx.restore();
  }

  // Plus de confettis ici : ils sont reserves au record personnel (fete.ts).
  // Le generique a ses feux d'artifice.

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
