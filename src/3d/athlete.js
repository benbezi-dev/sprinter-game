/* -----------------------------------------------------------------------
   SPRINTER 3D — L'ATHLETE.

   CE QUI REND CE PORTAGE POSSIBLE : `pose()` N'A JAMAIS ETE EN DEUX
   DIMENSIONS.

   Le squelette du jeu rend, pour chaque image, une vingtaine de troncs de cone
   decrits par des points (x, y, z), un axe, et QUATRE rayons — deux en bas,
   deux en haut, parce que la section est une ELLIPSE : un torse est plus large
   que profond, une cuisse plus epaisse de face que de profil.

   Le rendu isometrique n'en gardait qu'une moyenne, `(hx + hy) * 0.5`. Il le
   fallait bien : une facette dessinee au canvas 2D ne sait pas de quel cote on
   la regarde. Toute l'information de profondeur du modele etait donc calculee
   a chaque image, puis jetee a la derniere ligne.

   Ici on la garde. Chaque os est un vrai volume elliptique, maille finement et
   ferme par deux calottes, et c'est de la geometrie reelle — pas une silhouette
   qui imite le relief. La meme fonction `pose()` pilote les deux : le jeu 2D et
   celui-ci courent, litteralement, la meme foulee.

   CE QUI EST CONSTANT ET CE QUI NE L'EST PAS. Les longueurs et les rayons d'un
   os viennent du gabarit de l'athlete : ils ne bougent jamais. Seule sa POSE
   change. On cuit donc la geometrie une fois par os, a la construction, et
   chaque image ne fait plus qu'y poser une matrice. Vingt os par coureur, huit
   coureurs : cent-soixante matrices par image, et pas un triangle recalcule.
   ----------------------------------------------------------------------- */

const K = () => globalThis.SprinterCore;

// Finesse du maillage. Ce sont ces trois nombres qui font le « haute densite » :
// un os porte environ mille triangles, un athlete vingt mille, la piste
// entiere cent-soixante mille. On peut les baisser d'un cran sans que la
// silhouette change — c'est le galbe qui se perd, pas la forme.
const SEG_RADIAL = 32;   // tranches autour de l'axe
const SEG_LONG = 8;      // tranches le long de l'os
const SEG_CALOTTE = 7;   // anneaux d'une calotte

/**
 * Un os : tronc de cone a section elliptique, ferme par deux calottes.
 *
 * Construit dans son repere LOCAL — axe sur z, de -hL a +hL — parce que c'est
 * la seule facon de n'avoir a le construire qu'une fois. Le placement dans le
 * stade est ensuite une affaire de matrice, et la matrice change a chaque
 * image alors que ces triangles-la ne changent jamais.
 */
function geometrieOs(THREE, rx0, ry0, rx1, ry1, hL) {
  const pos = [], idx = [];
  const anneau = (rx, ry, z) => {
    for (let i = 0; i <= SEG_RADIAL; i++) {
      const a = (i / SEG_RADIAL) * Math.PI * 2;
      pos.push(rx * Math.cos(a), ry * Math.sin(a), z);
    }
  };
  // L'ORDRE DES SOMMETS DECIDE DE QUEL COTE EST LE DEHORS, et se trompe sans
  // rien casser de visible. Ecrit a l'envers, chaque triangle donne une
  // normale rentrante : le moteur elimine alors la face exterieure, on voit
  // l'INTERIEUR du membre, et cet interieur est eclaire a l'envers. Les
  // athletes sortaient noirs sous un soleil qui les prenait de face, ombres
  // portees comprises — un defaut qui envoie chercher la lumiere alors qu'il
  // est dans la geometrie. Verifie a la main sur un point de l'anneau : le
  // produit vectoriel des deux aretes doit pointer vers l'exterieur.
  const lier = (r0, r1) => {
    for (let i = 0; i < SEG_RADIAL; i++) {
      const a = r0 + i, b = r0 + i + 1, c = r1 + i, d = r1 + i + 1;
      idx.push(a, b, c, b, d, c);
    }
  };

  // La calotte du bas : un quart d'ellipsoide qui prolonge la section, de
  // sorte qu'un bout d'os ne soit jamais un disque coupe net. Sa hauteur suit
  // le plus petit des deux rayons — une calotte plus haute que large donnerait
  // un doigt de gant au bout d'un mollet.
  const h0 = Math.min(rx0, ry0), h1 = Math.min(rx1, ry1);
  let prec = -1;
  for (let j = SEG_CALOTTE; j >= 1; j--) {
    const t = j / SEG_CALOTTE, s = Math.sqrt(Math.max(0, 1 - t * t));
    const r = pos.length / 3;
    anneau(rx0 * s, ry0 * s, -hL - h0 * t);
    if (prec >= 0) lier(prec, r);
    prec = r;
  }
  // Le corps, tranche par tranche : les rayons glissent lineairement du bas
  // vers le haut, et c'est ce qui donne le galbe d'une cuisse ou d'un bras.
  for (let j = 0; j <= SEG_LONG; j++) {
    const t = j / SEG_LONG;
    const r = pos.length / 3;
    anneau(rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t, -hL + 2 * hL * t);
    if (prec >= 0) lier(prec, r);
    prec = r;
  }
  for (let j = 1; j <= SEG_CALOTTE; j++) {
    const t = j / SEG_CALOTTE, s = Math.sqrt(Math.max(0, 1 - t * t));
    const r = pos.length / 3;
    anneau(rx1 * s, ry1 * s, hL + h1 * t);
    lier(prec, r);
    prec = r;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Les normales sont calculees plutot qu'ecrites : sur un tronc de cone a
  // section elliptique, leur expression fermee tient en six lignes fausses et
  // une ligne juste. La moyenne des faces donne exactement le lisse qu'on
  // cherche, et cela ne se paie qu'une fois.
  g.computeVertexNormals();
  return g;
}

/**
 * Le meme enchainement de rotations que `personCapsules` en 2D, mais applique
 * a un REPERE et non a des points.
 *
 * C'est toute l'astuce du portage. La version 2D transforme les deux bouts de
 * chaque capsule, image par image, et perd au passage l'orientation de la
 * section. En transformant plutot les trois axes du repere de l'os, on obtient
 * une matrice — donc la position, l'orientation ET l'ellipse, d'un coup, pour
 * une geometrie qu'on n'a pas besoin de retoucher.
 */
function repereOs(pv, ang, off, hL, roll, fall) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // Repere local de l'os, une fois l'angle du segment applique.
  let cx = pv[0] + off[0] * ca - off[2] * sa;
  let cy = pv[1] + off[1];
  let cz = pv[2] + off[0] * sa + off[2] * ca;
  let xx = ca, xy = 0, xz = sa;          // l'axe des rx
  let yx = 0, yy = 1, yz = 0;            // l'axe des ry
  let zx = -sa, zy = 0, zz = ca;         // l'axe de l'os

  const rc = Math.cos(roll), rs = Math.sin(roll);
  if (roll) {
    const t1 = cy * rc - cz * rs; cz = cy * rs + cz * rc; cy = t1;
    const t2 = xy * rc - xz * rs; xz = xy * rs + xz * rc; xy = t2;
    const t3 = yy * rc - yz * rs; yz = yy * rs + yz * rc; yy = t3;
    const t4 = zy * rc - zz * rs; zz = zy * rs + zz * rc; zy = t4;
  }
  const fc = Math.cos(fall), fs = Math.sin(fall);
  if (Math.abs(fall) > 0.0001) {
    const t1 = cx * fc - cz * fs; cz = cx * fs + cz * fc; cx = t1;
    const t2 = xx * fc - xz * fs; xz = xx * fs + xz * fc; xx = t2;
    const t3 = yx * fc - yz * fs; yz = yx * fs + yz * fc; yx = t3;
    const t4 = zx * fc - zz * fs; zz = zx * fs + zz * fc; zx = t4;
  }
  return [cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz, hL];
}

/**
 * Un athlete : un groupe, un maillage par os, et rien d'autre.
 *
 * Le yaw de chaque segment (les epaules qui tournent a l'oppose du bassin) est
 * porte par un sous-groupe plutot que par la matrice de l'os : la rotation est
 * autour de l'axe vertical du coureur, elle s'applique donc proprement a un
 * groupe entier et evite de la repeter sur chaque repere.
 */
export class Athlete3D {
  constructor(THREE, coureur, materiaux) {
    this.THREE = THREE;
    this.r = coureur;
    this.groupe = new THREE.Group();
    this.os = [];
    this.mats = materiaux;
    this._m = new THREE.Matrix4();
    this._construire();
  }

  _construire() {
    const THREE = this.THREE;
    const parts = K().pose(this.r);
    for (const [col, , , , hf] of parts) {
      const g = geometrieOs(THREE, hf[0], hf[1], hf[2], hf[3], hf[4]);
      const m = new THREE.Mesh(g, this.mats.pour(col));
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      // Un os qui sort du cadre ne doit pas faire disparaitre le coureur
      // entier : la sphere englobante d'un os isole est minuscule et THREE
      // l'ecarterait des que la camera serre. Le groupe, lui, est cadre.
      m.frustumCulled = false;
      this.groupe.add(m);
      this.os.push(m);
    }
  }

  /**
   * Repose le squelette sur l'etat courant du coureur.
   *
   * Aucune geometrie n'est touchee : on ne fait que reecrire vingt matrices.
   * `pose()` est appele une fois, exactement comme le fait le rendu 2D — c'est
   * la meme foulee, au meme instant, avec le meme cycle de Catmull-Rom.
   */
  poser(lean) {
    const THREE = this.THREE;
    const parts = K().pose(this.r);
    const fsh = K().fallShape(this.r.fallAnim);
    const roll = (lean || 0) + (fsh ? fsh.roll : 0);
    const fall = (fsh ? fsh.pitch : 0) - (this.r.drivePitch || 0);
    for (let i = 0; i < parts.length && i < this.os.length; i++) {
      const [, pv, ang, off, hf, yaw] = parts[i];
      const R = repereOs(pv, ang, off, hf[4], roll, fall);
      let [cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz] = R;
      if (yaw) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const t0 = cx * c - cy * s; cy = cx * s + cy * c; cx = t0;
        const t1 = xx * c - xy * s; xy = xx * s + xy * c; xx = t1;
        const t2 = yx * c - yy * s; yy = yx * s + yy * c; yx = t2;
        const t3 = zx * c - zy * s; zy = zx * s + zy * c; zx = t3;
      }
      this._m.set(xx, yx, zx, cx,
                  xy, yy, zy, cy,
                  xz, yz, zz, cz,
                  0, 0, 0, 1);
      this.os[i].matrix.copy(this._m);
      this.os[i].matrixWorldNeedsUpdate = true;
    }
  }
}

/**
 * Les matieres, une par teinte rencontree.
 *
 * Le squelette rend des couleurs, pas des matieres : une vingtaine de teintes
 * par athlete, largement partagees d'un coureur a l'autre (la peau, le maillot
 * de l'equipe, le blanc des chaussures). On les met donc en cache — sinon huit
 * coureurs feraient cent-soixante matieres la ou une vingtaine suffit, et
 * autant de programmes a compiler au premier affichage.
 */
export class Materiaux {
  constructor(THREE) {
    this.THREE = THREE;
    this.cache = new Map();
  }
  pour(col) {
    const cle = col[0] + ',' + col[1] + ',' + col[2];
    let m = this.cache.get(cle);
    if (m) return m;
    const c = new this.THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255);
    c.convertSRGBToLinear();
    m = new this.THREE.MeshStandardMaterial({
      color: c,
      // Une peau et un maillot ne sont ni du plastique ni du metal. Une
      // rugosite haute et zero metal, c'est exactement ce que decrit un tissu
      // mat ou un corps : la lumiere s'y etale au lieu d'y faire un point.
      roughness: 0.78,
      metalness: 0.0,
    });
    this.cache.set(cle, m);
    return m;
  }
}
