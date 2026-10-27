// LE STADE BERNARD AMSALEM, VAL-DE-REUIL, EN 3D (27/10/2026).
//
// « vazy commence par le stade » (l'auteur, 27/10) : le stade exterieur de Val-de-Reuil, ou l'on
// court le 100, le 200 et le 400 m. Un lieu reel : rien n'est pose qui ne se voie sur une image
// precise. Les sources :
//  - les quatre vues aeriennes Polytan apres la renovation (assets-sources/stade-bernard-amsalem-polytan :
//    img-3 vue depuis l'aire des sauts, img-4 et img-6 depuis le bout de la demi-lune, img-5 depuis le virage) ;
//  - OpenStreetMap (public/athlete/val-de-reuil.json de la branche carriere) pour les cotes : le terrain
//    d'honneur (105 x 68 m), la tribune (25,3 x 9,9 m, 9,5 m de haut, au milieu de la ligne droite, a 17 m
//    de la piste) et la halle Jesse Owens (son contour, 10,2 m de haut).
//
// Ce que montrent les photos, et qui est pose ici :
//  - une bordure beige rgb(229, 201, 160) des deux cotes de la piste, puis une bande lie-de-vin dehors (img-3, img-4) ;
//  - l'aire des sauts, beige, le long de la ligne droite opposee a la tribune : deux couloirs d'elan rouges,
//    quatre bacs a sable, des tapis bleus (img-3, img-4) ;
//  - la demi-lune rouge, dans le virage oppose a la halle, son coin des lancers en gazon (img-3, img-4) ;
//  - la tribune aux sieges rouges sous une voile blanche (img-3, img-4, img-6) — ses gradins sont ceux du
//    moteur (course-3d.ts) pour porter le public ; ce module pose la voile et ses mats ;
//  - la halle derriere le virage du depart, du cote de la tribune : murs gris argent, toit blanc (img-3, img-6) ;
//  - quatre mats d'eclairage aux bouts des lignes droites, juste hors de la piste (img-3) ;
//  - un rideau d'arbres derriere la tribune (img-3), la haie qui ferme le cote des sauts, les champs (img-4, img-6).
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite d'arrivee (l'arrivee en D1), y vers
// la tribune, z en haut ; les virages tournent autour de (D0, -R) et (D1, -R). Le releve OSM est en (a, n) :
// a le long du grand axe (la demi-lune vers +a), n vers la tribune depuis le centre du terrain. Le bout de la
// demi-lune est celui de l'arrivee : x = D1 - DEMI + a, y = n - R.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type ContexteAmsalem = {
  stade: THREE.Group;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
  /** La racine des fichiers du jeu (import.meta.env.BASE_URL). */
  base: string;
  /** Le palier ULTRA : la tribune pleine. */
  ultra?: boolean;
};

/** La demi-ligne droite d'une piste de 400 m a corde de 36,50 m (la piste reelle). */
const DEMI = 84.39 / 2;
/** La tribune (OSM) : de a = -12,5 a 12,8, de n = 63 a 72,9. */
export const TRIBUNE_AMSALEM = { a0: -12.5, long: 25.3, n0: 63, prof: 9.9, haut: 9.5 };
/** Les rangs du modele Tripo, dans son repere (x le long depuis son bord, y vers le fond depuis son centre,
 *  z en haut) : releves sur le modele exporte (tools/blender/amsalem/tribune_tripo.py). Les blocs de sieges, de
 *  part et d'autre de l'escalier central et des deux escaliers lateraux. */
export const RANGS_AMSALEM = { rangs: 10, y0: -1.2, z0: 4.2, prof: 0.6, monte: 0.37,
  // [debut, fin, hausse] : le bloc droit du modele est un peu plus haut que le gauche
  blocs: [[3.2, 11.6, 0], [14.4, 21.8, 1.3]] as [number, number, number][] };
/** Le contour de la halle Jesse Owens (OSM), en (a, n). */
const HALLE: [number, number][] = [[-202.5, 118.7], [-201.7, 62.7], [-183.1, 54.7], [-118.6, 55.5], [-107.4, 59.2], [-90, 66],
  [-90.1, 75.3], [-69.7, 75.6], [-70, 100.3], [-53.4, 100.6], [-53.6, 120.5]];

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
const BEIGE = c3(229, 201, 160), ROUGE = c3(195, 70, 70), LIE = c3(118, 40, 44), SABLE = c3(217, 192, 138), BLEU = c3(85, 195, 239);

export function construireAmsalem(o: ContexteAmsalem) {
  const { stade, W, R, D0, D1, hasard } = o;
  const X = (a: number) => D1 - DEMI + a, Y = (n: number) => n - R;
  const lambert = (c: THREE.Color | number, double = false) => new THREE.MeshLambertMaterial({ color: c, side: double ? THREE.DoubleSide : THREE.FrontSide });
  // au sol : chaque couche un peu au-dessus de la precedente, tiree en avant comme les marques de la piste
  const solMat = (c: THREE.Color, k: number) => {
    const m = lambert(c, true); m.polygonOffset = true; m.polygonOffsetFactor = -k; m.polygonOffsetUnits = -2 * k; return m;
  };
  const poser = (geos: THREE.BufferGeometry[], mat: THREE.Material, ombre = false) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true; m.castShadow = ombre; stade.add(m);
  };
  /** Un aplat rectangulaire au sol, de (x0, y0) a (x1, y1). */
  const rect = (x0: number, y0: number, x1: number, y1: number, z: number) =>
    new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0)).translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  /** Un anneau autour de la piste, entre les rayons r0 et r1 (depuis le centre des virages). */
  const anneauOvale = (r0: number, r1: number, z: number) => {
    const g: THREE.BufferGeometry[] = [rect(D0, r0 - R, D1, r1 - R, z), rect(D0, -R - r1, D1, -R - r0, z)];
    for (const [xc, debut] of [[D1, -Math.PI / 2], [D0, Math.PI / 2]] as const)
      g.push(new THREE.RingGeometry(r0, r1, 96, 1, debut, Math.PI).translate(xc, -R, z));
    return g;
  };

  // --- LES BORDURES (img-3, img-4) : beige des deux cotes de la piste, la bande lie-de-vin dehors ---
  const R1 = R + W + 0.8;   // le bord exterieur du tartan pose par course-3d.ts
  poser([...anneauOvale(R - 1.8, R - 0.8, 0.004), ...anneauOvale(R1, R1 + 1.2, 0.004)], solMat(BEIGE, 2));
  poser(anneauOvale(R1 + 1.2, R1 + 2.4, 0.003), solMat(LIE, 1));

  // --- L'AIRE DES SAUTS (img-3, img-4) : beige, 15 m de large, le long de la ligne droite opposee ---
  const yO = -R - R1;   // le bord exterieur de la ligne opposee
  const xa0 = X(-DEMI - 6), xa1 = X(DEMI + 6);
  poser([rect(xa0, yO - 1.2, xa1, yO - 16.2, 0.005)], solMat(BEIGE, 3));
  poser([rect(xa0 - 1, yO - 16.2, xa1 + 1, yO - 17.4, 0.004), rect(xa0 - 1, yO - 1.2, xa0, yO - 17.4, 0.004), rect(xa1, yO - 1.2, xa1 + 1, yO - 17.4, 0.004)], solMat(LIE, 2));
  // les deux couloirs d'elan rouges
  poser([yO - 5.7, yO - 10.2].map(y => rect(X(-DEMI), y - 0.61, X(DEMI - 4), y + 0.61, 0.007)), solMat(ROUGE, 4));
  // les bacs a sable, au bout des couloirs d'elan, et les tapis bleus (img-3 : deux bacs par couloir, deux tapis)
  poser([[-DEMI + 6, yO - 5.7], [DEMI - 10, yO - 5.7], [-DEMI + 22, yO - 10.2], [DEMI - 18, yO - 10.2]]
    .map(([a, y]) => rect(X(a) - 4.5, y - 1.4, X(a) + 4.5, y + 1.4, 0.009)), solMat(SABLE, 5));
  poser([[DEMI - 6, yO - 13.7], [-DEMI + 22, yO - 13.7]].map(([a, y]) => rect(X(a) - 3, y - 2.5, X(a) + 3, y + 2.5, 0.011)), solMat(BLEU, 6));

  // --- LA DEMI-LUNE (img-3, img-4) : le segment de l'aire interieure au-dela du terrain (52,5 m du centre),
  // dans le virage de l'arrivee, rouge — son coin du cote oppose a la tribune reste en gazon (les lancers) ---
  {
    const forme = new THREE.Shape(), aBord = 53.5 - DEMI, rI = R - 1.8;
    const nBas = -14;   // le coin des lancers : sous n = -14, du gazon
    forme.moveTo(X(DEMI + aBord), Y(Math.sqrt(rI * rI - aBord * aBord)));
    for (let i = 0; i <= 48; i++) {
      const u = Math.acos(aBord / rI) - (i / 48) * (Math.acos(aBord / rI) + Math.asin(-nBas / rI));
      forme.lineTo(X(DEMI + rI * Math.cos(u)), Y(rI * Math.sin(u)));
    }
    forme.lineTo(X(DEMI + aBord), Y(nBas));
    poser([new THREE.ShapeGeometry(forme).translate(0, 0, 0.004)], solMat(ROUGE, 3));
  }

  // --- LA HALLE JESSE OWENS : le modele Tripo de son exterieur (salle-3d.ts, tools/blender/salle/exterieur_tripo.py :
  // 103,3 x 58 m, sa longueur sur x), pose sur le corps principal du contour OSM (a de -202 a -90, n de 55 a 120) ---
  {
    const halle = new THREE.Group(); halle.position.set(X(-146), Y(87.5), 0); stade.add(halle);
    const chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
    chargeur.load(o.base + 'modeles/salle/exterieur.glb', gl => {
      // le bardage gris argent, comme au survol de la salle (salle-3d.ts : la texture Tripo tire au beige)
      gl.scene.traverse((m: any) => {
        if (!m.isMesh || !m.material) return;
        m.castShadow = m.receiveShadow = false;
        const mat = m.material; mat.color?.setRGB(1, 1, 1);
        mat.onBeforeCompile = (sh: any) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
            '#include <map_fragment>\ndiffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * vec3(0.98, 1.0, 0.98);');
        };
        mat.customProgramCacheKey = () => 'salle-argent';
        mat.needsUpdate = true;
      });
      halle.add(gl.scene);
    }, undefined, () => {
      // sans le modele : le contour OSM en volume (10,2 m)
      const forme = new THREE.Shape(HALLE.map(([a, n]) => new THREE.Vector2(X(a), Y(n))));
      poser([new THREE.ExtrudeGeometry(forme, { depth: 10.2, bevelEnabled: false })], lambert(c3(196, 200, 206)));
    });
  }

  // --- LA TRIBUNE : le modele Tripo (tools/blender/amsalem/tribune_tripo.py, d'apres img-3 : sieges rouges, escalier
  // central, voile blanche sur ses mats, le batiment vitre dessous), au milieu de la ligne droite. Le public s'assoit
  // sur ses rangs (course-3d.ts, RANGS_AMSALEM) ; en ULTRA, la version pleine (400 000 faces, texture 4 096 px) ---
  {
    const t = TRIBUNE_AMSALEM, tribune = new THREE.Group();
    tribune.position.set(X(t.a0) + t.long / 2, Y(t.n0) + t.prof / 2, 0); stade.add(tribune);
    tribune.rotation.z = Math.PI;   // (Tripo rend la facade vers +y : on la tourne vers la piste)
    const chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
    chargeur.load(o.base + (o.ultra ? 'modeles/amsalem/tribune-ultra.glb' : 'modeles/amsalem/tribune.glb'), gl => {
      gl.scene.traverse((m: any) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
      tribune.add(gl.scene);
    });
  }

  // --- LES MATS D'ECLAIRAGE (img-3 : quatre, aux bouts des lignes droites, juste hors de la piste) ---
  {
    const geos: THREE.BufferGeometry[] = [], tetes: THREE.BufferGeometry[] = [];
    for (const a of [-DEMI + 4, DEMI - 4]) for (const y of [W + 3.6, yO - 2.4]) {
      geos.push(new THREE.CylinderGeometry(0.16, 0.3, 24, 8).rotateX(Math.PI / 2).translate(X(a), y, 12));
      tetes.push(new THREE.BoxGeometry(2.2, 0.5, 1.4).translate(X(a), y, 24.3));
    }
    poser(geos, lambert(c3(170, 174, 180)));
    poser(tetes, lambert(c3(60, 64, 72)));
  }

  // --- LES ARBRES (img-3 : un rideau d'arbres derriere la tribune) ---
  {
    const troncs: THREE.BufferGeometry[] = [], cimes: THREE.BufferGeometry[] = [];
    for (let a = -45; a <= 60; a += 6 + hasard() * 2) {
      const x = X(a), y = Y(90 + hasard() * 4), h = 9 + hasard() * 4;
      troncs.push(new THREE.CylinderGeometry(0.22, 0.32, h * 0.5, 6).rotateX(Math.PI / 2).translate(x, y, h * 0.25));
      cimes.push(new THREE.IcosahedronGeometry(1, 1).scale(2.6, 2.6, h * 0.36).translate(x, y, h * 0.62));
    }
    poser(troncs, lambert(0x5b4030));
    poser(cimes, lambert(c3(46, 86, 40)), true);
  }

  // --- LA HAIE ET LES CHAMPS (img-4, img-6 : une haie ferme le cote des sauts et le bout de la demi-lune,
  // des champs de ble moissonne au-dela) ---
  {
    const yH = yO - 30, xH = X(DEMI) + R + 34;   // la haie : a une dizaine de metres de l'aire, et du virage
    poser([new THREE.BoxGeometry(xH - X(-DEMI - 60), 1.6, 2.4).translate((xH + X(-DEMI - 60)) / 2, yH, 1.2),
      new THREE.BoxGeometry(1.6, Y(70) - yH, 2.4).translate(xH, (Y(70) + yH) / 2, 1.2)], lambert(c3(40, 82, 36)));
    // (au ras de la pelouse de course-3d.ts, a -0,1 m : tire en avant, sinon elle repasse devant au loin)
    const ble = solMat(c3(206, 176, 118), 4);
    const champ = (x0: number, y0: number, x1: number, y1: number) => rect(x0, y0, x1, y1, -0.03);
    // ... et derriere le rideau d'arbres de la tribune et au-dela de la halle (img-3 en haut, img-6 a gauche)
    poser([champ(X(-DEMI - 260), yH - 1, xH + 300, yH - 400), champ(xH + 1, yH - 1, xH + 300, Y(400)),
      champ(X(-DEMI - 400), Y(98), xH + 1, Y(400)), champ(X(-210), yH - 1, X(-DEMI - 400), Y(98))], ble);
  }
}
