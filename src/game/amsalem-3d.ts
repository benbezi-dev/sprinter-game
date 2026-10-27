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
import { textureStable, type NomStable } from './texture-stable';
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
  /** La nuit : les mats eclairent. */
  nuit?: boolean;
};

/** La demi-ligne droite d'une piste de 400 m a corde de 36,50 m (la piste reelle). */
const DEMI = 84.39 / 2;
/** La tribune : sa longueur et sa place le long de la ligne droite viennent d'OSM (a = -12,5 a 12,8) ; sa distance a
 *  la piste vient des photos (img-3, img-5 : le pied de la tribune a trois metres environ de la bande lie-de-vin) —
 *  le contour OSM la mettait 12 m plus loin (« les gradins sont trop eloignes de la piste », l'auteur, 27/10). */
// LA TRIBUNE ETIREE (« le gradin est trop resserre sur lui-meme », l'auteur, 27/10) : le modele Tripo sort a 25,3 m de
// long pour 13,8 m de haut et 12,3 m de profondeur — trapu, la ou les photos de l'auteur montrent une tribune longue et
// basse. Il est etire de 35 % en longueur (34,2 m), ramene a 9,8 m de haut (OSM : 9,5) et 9,8 m de profondeur (OSM :
// 9,9), autour de son milieu (a = 0,15). `echelle` : x long, y profondeur, z hauteur, dans le repere du modele.
export const TRIBUNE_AMSALEM = { a0: 0.15 - 25.3 * 1.35 / 2, long: 25.3 * 1.35, n0: 53.7, prof: 9.9, haut: 9.5, echelle: [1.35, 0.8, 0.71] as [number, number, number] };
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
/** Une texture de sol dessinee, repetee. */
function toileSol(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h = w) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  return t;
}
/**
 * DES TACHES RACCORDABLES (« pas de texture, le decor est pauvre et plat », l'auteur, 27/10) : n ellipses de rayon
 * r0 a r1 px, des couleurs de la liste, recopiees de l'autre cote des bords — la tuile se raccorde sans couture.
 */
function taches(c: CanvasRenderingContext2D, w: number, h: number, hasard: () => number, n: number, r0: number, r1: number, couleurs: string[]) {
  for (let i = 0; i < n; i++) {
    const x = hasard() * w, y = hasard() * h, rx = r0 + hasard() * (r1 - r0), ry = rx * (0.5 + hasard() * 0.8), a = hasard() * Math.PI;
    // (fondue du centre vers le bord : des ronds a bord net se lisaient comme des pastilles, 27/10)
    const coul = couleurs[(hasard() * couleurs.length) | 0], vide = coul.replace(/[\d.]+\)$/, '0)');
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      if (x + dx + rx < 0 || x + dx - rx > w || y + dy + rx < 0 || y + dy - rx > h) continue;
      c.save(); c.translate(x + dx, y + dy); c.rotate(a); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, coul); g.addColorStop(0.6, coul); g.addColorStop(1, vide);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
    }
  }
}
/**
 * LA PELOUSE DU TERRAIN D'HONNEUR (« la qualite du stade est moyenne », 27/10) : les bandes de tonte du jeu, plus le
 * grain de l'herbe — des brins plus clairs, plus sombres, un peu jaunis. Remplace la tonte unie de course-3d.ts.
 */
export function pelouseAmsalem(herbe: number[], hasard: () => number) {
  return toileSol((c, w, h) => {
    for (let i = 0; i < 8; i++) {
      const k = i % 2 ? 0.88 : 1.06;
      c.fillStyle = `rgb(${herbe[0] * k | 0},${herbe[1] * k | 0},${herbe[2] * k | 0})`; c.fillRect(i * w / 8, 0, w / 8, h);
    }
    for (let i = 0; i < 9000; i++) {
      const v = hasard();
      c.fillStyle = v < 0.45 ? 'rgba(20,60,14,0.35)' : v < 0.85 ? 'rgba(120,170,70,0.25)' : 'rgba(170,160,80,0.25)';
      c.fillRect(hasard() * w, hasard() * h, 1, 1 + hasard() * 3);
    }
  }, 512);
}
const BEIGE = c3(229, 201, 160), ROUGE = c3(195, 70, 70), LIE = c3(118, 40, 44), SABLE = c3(217, 192, 138), BLEU = c3(85, 195, 239);

/**
 * LE TARTAN DE LA PISTE (« la qualite du stade est moyenne », l'auteur, 27/10) : les granules de caoutchouc de la
 * salle (tools/blender/salle/tartan_granules.py, d'apres la coupe Polytan img-2 ; une tuile de 1024 px pour 0,32 m)
 * sous le rouge releve sur les vues aeriennes. Les aplats de la piste de course-3d.ts ont des UV de 0 a 1 par
 * morceau : on les remet en metres (x, y du stade) pour que le grain garde sa taille partout.
 */
export function habillerLeTartan(stade: THREE.Group, mats: THREE.Material[], base: string) {
  const charger = (nom: string, srgb: boolean) => {
    // (jamais noire en attendant le fichier : texture-stable.ts)
    const t = textureStable(base, ('modeles/salle/textures/' + nom) as NomStable);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.32, 1 / 0.32); t.anisotropy = 16;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const map = charger('tartan.jpg', true), normalMap = charger('tartan-relief.jpg', false), roughnessMap = charger('tartan-rugosite.jpg', false);
  const neufs = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  for (const m of mats) {
    const c = ((m as any).color as THREE.Color).clone().multiplyScalar(1 / 0.82);   // (la texture assombrit de 0,82 en moyenne)
    const n = new THREE.MeshStandardMaterial({ color: c, map, normalMap, roughnessMap, roughness: 1, metalness: 0 });
    n.polygonOffset = m.polygonOffset; n.polygonOffsetFactor = m.polygonOffsetFactor; n.polygonOffsetUnits = m.polygonOffsetUnits;
    neufs.set(m, n);
  }
  stade.traverse((o: any) => {
    if (!o.isMesh || !neufs.has(o.material)) return;
    const g = (o.geometry as THREE.BufferGeometry).clone(), pos = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + o.position.x, pos.getY(i) + o.position.y);
    uv.needsUpdate = true; o.geometry = g; o.material = neufs.get(o.material);
  });
}

export function construireAmsalem(o: ContexteAmsalem): THREE.Material[] {
  const { stade, W, R, D0, D1, hasard } = o;
  const X = (a: number) => D1 - DEMI + a, Y = (n: number) => n - R;
  const lambert = (c: THREE.Color | number, double = false) => new THREE.MeshLambertMaterial({ color: c, side: double ? THREE.DoubleSide : THREE.FrontSide });
  // au sol : chaque couche un peu au-dessus de la precedente, tiree en avant comme les marques de la piste
  const rouges: THREE.Material[] = [];   // le tartan hors de la piste (demi-lune, elans, prolongement) : habillerLeTartan
  const solMat = (c: THREE.Color, k: number) => {
    const m = lambert(c, true); m.polygonOffset = true; m.polygonOffsetFactor = -k; m.polygonOffsetUnits = -2 * k;
    // (la bordure beige, l'aire des sauts et la bande lie-de-vin sont du Polytan comme la piste : le meme grain, 27/10)
    if (c === ROUGE || c === BEIGE || c === LIE) rouges.push(m);
    return m;
  };
  const poser = (geos: THREE.BufferGeometry[], mat: THREE.Material, ombre = false) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true; m.castShadow = ombre; stade.add(m);
  };
  /**
   * UNE PIECE TRIPO (tools/blender/amsalem/piece_tripo.py : a l'echelle, centree au sol) posee a chaque place
   * [x, y, cap, echelle] ; les clones partagent geometrie et matiere. Sans le fichier : `repli` (la forme simple).
   */
  const chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
  const piece = (nom: string, places: [number, number, number, number][], repli: () => void, forme = [1, 1, 1]) => {
    chargeur.load(o.base + 'modeles/amsalem/' + nom, gl => {
      gl.scene.traverse((m: any) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
      for (const [x, y, cap, k] of places) {
        const c = gl.scene.clone(); c.position.set(x, y, 0); c.rotation.z = cap; c.scale.set(k * forme[0], k * forme[1], k * forme[2]); stade.add(c);
      }
    }, undefined, repli);
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
  const yO = -R - R1;
  // la haie : 3,6 m au-dela du chemin (lui-meme a 20 m du bord de la piste), le long de l'aire puis en arc (photos de l'auteur)
  const R_HAIE = R1 + 2.4 + 20 + 3.6;   // le bord exterieur de la ligne opposee
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
      // LE GRIS DE LA TRIBUNE EN BLANC CASSE (« la couleur grise du gradin est austere », l'auteur, 27/10 ; ses photos :
      // un beton clair presque blanc, les sieges rouges) : dans la texture Tripo, ce qui est peu sature remonte vers un
      // blanc chaud, les rouges et le reste gardent leur couleur
      gl.scene.traverse((m: any) => {
        if (!m.isMesh) return;
        m.castShadow = false; m.receiveShadow = true;
        const mat = m.material;
        mat.onBeforeCompile = (sh: any) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), sat = mx > 0.0 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0;
              float gris = 1.0 - smoothstep(0.12, 0.3, sat);
              vec3 blanc = vec3(0.86, 0.85, 0.82) * (0.55 + 0.45 * smoothstep(0.0, 0.6, mx));
              diffuseColor.rgb = mix(c, blanc, gris); }`);
        };
        mat.customProgramCacheKey = () => 'tribune-blanche';
        mat.needsUpdate = true;
      });
      gl.scene.scale.set(...t.echelle);
      tribune.add(gl.scene);
    });
  }

  // --- LES MATS D'ECLAIRAGE (img-3 : quatre, aux bouts des lignes droites, juste hors de la piste ; Tripo, 24 m),
  // leurs projecteurs tournes vers le milieu du terrain ---
  {
    const places: [number, number, number, number][] = [];
    for (const a of [-DEMI + 4, DEMI - 4]) for (const y of [W + 3.6, yO - 2.4])
      places.push([X(a), y, Math.atan2(-R - y, X(0) - X(a)) - Math.PI / 2, 1]);
    piece('mat.glb', places, () => {
      const geos: THREE.BufferGeometry[] = [], tetes: THREE.BufferGeometry[] = [];
      for (const [x, y] of places) {
        geos.push(new THREE.CylinderGeometry(0.16, 0.3, 24, 8).rotateX(Math.PI / 2).translate(x, y, 12));
        tetes.push(new THREE.BoxGeometry(2.2, 0.5, 1.4).translate(x, y, 24.3));
      }
      poser(geos, lambert(c3(170, 174, 180))); poser(tetes, lambert(c3(60, 64, 72)));
    });
  }

  // --- LES ARBRES (img-3 : un rideau d'arbres derriere la tribune, entre elle et le terrain synthetique ;
  // il s'arrete au skatepark, cote halle) ---
  {
    // un tilleul Tripo (12 m), tourne et mis a l'echelle au hasard pour qu'aucun ne ressemble a son voisin
    const places: [number, number, number, number][] = [];
    // (photos de l'auteur, 27/10 : un rideau SERRE de grands arbres sur toute la longueur du terrain synthetique, deux rangs
    // decales — dix arbres epars ne le rendaient pas)
    for (let a = -6; a <= 140; a += 4.5 + hasard() * 1.5) places.push([X(a), Y(76 + hasard() * 3), hasard() * Math.PI * 2, 0.9 + hasard() * 0.35]);
    for (let a = -3; a <= 140; a += 6 + hasard() * 2) places.push([X(a), Y(82 + hasard() * 3), hasard() * Math.PI * 2, 0.8 + hasard() * 0.3]);
    piece('arbre.glb', places, () => {
      const troncs: THREE.BufferGeometry[] = [], cimes: THREE.BufferGeometry[] = [];
      for (const [x, y, , k] of places) {
        const h = 12 * k;
        troncs.push(new THREE.CylinderGeometry(0.22, 0.32, h * 0.5, 6).rotateX(Math.PI / 2).translate(x, y, h * 0.25));
        cimes.push(new THREE.IcosahedronGeometry(1, 1).scale(2.6, 2.6, h * 0.36).translate(x, y, h * 0.62));
      }
      poser(troncs, lambert(0x5b4030)); poser(cimes, lambert(c3(46, 86, 40)), true);
    });
  }

  // --- LA HAIE ET LES CHAMPS (img-4, img-6 : une haie ferme le cote des sauts et le bout de la demi-lune,
  // des champs de ble moissonne au-dela) ---
  {
    const yH = -R - R_HAIE, xH = D1 + R_HAIE + 4;
    // des troncons de haie Tripo de 10 m, bout a bout (et une boite verte si le fichier manque) : le long de l'aire des
    // sauts, puis EN ARC autour du virage de la demi-lune jusqu'au cote de la tribune (photos de l'auteur, 27/10 : la
    // haie suit le chemin et le virage, elle ne fait pas d'angle)
    const places: [number, number, number, number][] = [];
    // (tous les 9 m : le feuillage du modele n'occupe pas toute sa boite, a 10 m des trous se voyaient)
    for (let x = X(-DEMI - 60) + 5; x < D1; x += 9) places.push([x, yH, 0, 1]);
    const nArc = Math.ceil(Math.PI * R_HAIE / 8.5);
    for (let i = 0; i <= nArc; i++) { const u = -Math.PI / 2 + (i / nArc) * Math.PI; places.push([D1 + R_HAIE * Math.cos(u), -R + R_HAIE * Math.sin(u), u + Math.PI / 2, 1]); }
    piece('haie.glb', places, () => poser(places.map(([x, y, a]) => new THREE.BoxGeometry(9, 1.6, 2.4).rotateZ(a).translate(x, y, 1.2)), lambert(c3(40, 82, 36))),
      [1, 1.5 / 3.75, 2 / 6.9]);   // (le troncon Tripo sort a 3,75 x 6,9 m : ramene a 1,5 m d'epaisseur et 2 m de haut, img-4)
    // LES CHAMPS MOISSONNES (img-5, img-6 : les rangs de chaume, les traces du tracteur, des plaques plus claires) et
    // leur RELIEF (img-5 au fond, img-6 en bas : la plaine ondule doucement) : plats pres du stade, ils se soulevent
    // au-dela de 120 m de son centre, jusqu'a 6 m au loin. Une tuile de 1 024 px pour 48 m.
    const chaume = toileSol((c, w, h) => {
      c.fillStyle = 'rgb(206,176,118)'; c.fillRect(0, 0, w, h);
      taches(c, w, h, hasard, 140, 30, 120, ['rgba(226,200,146,0.14)', 'rgba(178,146,92,0.12)', 'rgba(196,170,110,0.12)']);
      for (let y = 0; y < h; y += 3) {   // les rangs de chaume, tous les 14 cm
        c.fillStyle = `rgba(${hasard() < 0.5 ? '150,118,70' : '232,210,160'},${0.18 + hasard() * 0.18})`; c.fillRect(0, y, w, 1);
      }
      for (let i = 0; i < 18000; i++) { c.fillStyle = hasard() < 0.5 ? 'rgba(120,92,56,0.45)' : 'rgba(240,222,176,0.45)'; c.fillRect(hasard() * w, hasard() * h, 1, 2); }
      for (const y of [h * 0.22, h * 0.26, h * 0.72, h * 0.76]) { c.fillStyle = 'rgba(130,104,66,0.45)'; c.fillRect(0, y, w, 5); }   // les traces du tracteur
    }, 1024);
    const ble = new THREE.MeshLambertMaterial({ map: chaume, side: THREE.DoubleSide });
    ble.polygonOffset = true; ble.polygonOffsetFactor = -4; ble.polygonOffsetUnits = -8;
    const cx = X(0), cy = -R;
    const relief = (x: number, y: number) => {
      const d = Math.hypot(x - cx, (y - cy) * 1.25), k = Math.min(1, Math.max(0, (d - 120) / 260));
      return k * k * (3 - 2 * k) * (3.2 + 1.6 * Math.sin(x * 0.011 + 1.3) + 1.2 * Math.sin(y * 0.014 - 0.4));
    };
    const champ = (x0: number, y0: number, x1: number, y1: number) => {
      const lx = Math.abs(x1 - x0), ly = Math.abs(y1 - y0);
      const g = new THREE.PlaneGeometry(lx, ly, Math.max(1, Math.ceil(lx / 12)), Math.max(1, Math.ceil(ly / 12))).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
      const p = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { p.setZ(i, -0.03 + relief(p.getX(i), p.getY(i))); uv.setXY(i, p.getX(i) / 48, p.getY(i) / 48); }
      g.computeVertexNormals();
      return g;
    };
    // ... et derriere le rideau d'arbres de la tribune et au-dela de la halle (img-3 en haut, img-6 a gauche)
    poser([champ(X(-DEMI - 260), yH - 1, xH + 300, yH - 400), champ(xH + 1, yH - 1, xH + 300, Y(400)),
      champ(X(-DEMI - 400), Y(98), xH + 1, Y(400)), champ(X(-210), yH - 1, X(-DEMI - 400), Y(98))], ble);
    // (dessous, un fond de chaume plat a 6 m sous le sol : entre deux champs souleves, le ciel passait par la fente)
    const fond = new THREE.MeshLambertMaterial({ map: chaume });
    const gf = new THREE.PlaneGeometry(2400, 2400).translate(cx, cy, -6), pf = gf.attributes.position, uf = gf.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pf.count; i++) uf.setXY(i, pf.getX(i) / 48, pf.getY(i) / 48);
    poser([gf], fond);
  }

  // --- LE SOL AUTOUR DE LA PISTE (img-4, img-6 : de l'herbe seche, brun olive, jusqu'a la haie et aux champs ;
  // la pelouse verte ne reste qu'a l'interieur de l'anneau) ---
  {
    const yH = -R - R_HAIE, xH = D1 + R_HAIE + 4, rT = R1 + 2.4;
    // (deux metres de plus de chaque cote, sous les champs : sans recouvrement, un liseré de pelouse verte passait entre eux)
    const forme = new THREE.Shape([new THREE.Vector2(X(-212), yH - 3), new THREE.Vector2(xH + 3, yH - 3), new THREE.Vector2(xH + 3, Y(100)), new THREE.Vector2(X(-212), Y(100))]);
    const bord: THREE.Vector2[] = [];
    for (let i = 0; i <= 48; i++) { const u = -Math.PI / 2 + (i / 48) * Math.PI; bord.push(new THREE.Vector2(D1 + rT * Math.cos(u), -R + rT * Math.sin(u))); }
    for (let i = 0; i <= 48; i++) { const u = Math.PI / 2 + (i / 48) * Math.PI; bord.push(new THREE.Vector2(D0 + rT * Math.cos(u), -R + rT * Math.sin(u))); }
    const trou = new THREE.Path(bord);   // (un Path qui commence par lineTo part de l'origine : le trou mordait la pelouse)
    forme.holes.push(trou);
    // (img-4, img-6 : des plaques plus vertes ou plus pelees, des touffes, la terre qui perce — une tuile de 1 024 px
    // pour 30 m : trois echelles de taches, puis les brins)
    const sec = toileSol((c, w, h) => {
      // (« verdis l'herbe seche, embellis le decor », l'auteur, 27/10 : une herbe d'ete verte, a peine jaunie par plaques)
      c.fillStyle = 'rgb(98,132,58)'; c.fillRect(0, 0, w, h);
      taches(c, w, h, hasard, 70, 60, 180, ['rgba(76,118,44,0.45)', 'rgba(150,152,88,0.35)', 'rgba(112,146,62,0.4)']);
      taches(c, w, h, hasard, 420, 10, 45, ['rgba(70,110,40,0.4)', 'rgba(140,150,84,0.3)', 'rgba(124,160,70,0.35)', 'rgba(120,112,72,0.2)']);
      for (let i = 0; i < 40000; i++) {
        const v = hasard(), x = hasard() * w, y = hasard() * h, l = 2 + hasard() * 6, a = -Math.PI / 2 + (hasard() - 0.5) * 1.2;
        c.strokeStyle = v < 0.45 ? 'rgba(58,96,34,0.55)' : v < 0.75 ? 'rgba(140,176,82,0.5)' : v < 0.9 ? 'rgba(166,160,98,0.45)' : 'rgba(96,140,56,0.5)';
        c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }, 1024);
    const g = new THREE.ShapeGeometry(forme).translate(0, 0, -0.05);
    const uv = g.attributes.uv as THREE.BufferAttribute, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 30, pos.getY(i) / 30);   // une tuile tous les 30 m
    const m = new THREE.MeshLambertMaterial({ map: sec, side: THREE.DoubleSide });
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    poser([g], m);
  }

  // --- LE PROLONGEMENT DE LA LIGNE D'ARRIVEE (img-6 : la ligne droite de la tribune continue en rouge au-dela
  // du virage de la demi-lune, bordee de beige — la zone de freinage) ---
  {
    const L = 32;   // (le virage s'ecarte de la droite : il faut une trentaine de metres pour que tout le prolongement sorte)
    poser([rect(D1, -0.8, D1 + L, W + 0.8, -0.004)], solMat(ROUGE, 1));
    poser([rect(D1, -1.8, D1 + L + 1, -0.8, -0.003), rect(D1, W + 0.8, D1 + L + 1, W + 2, -0.003), rect(D1 + L, -0.8, D1 + L + 1, W + 0.8, -0.003)], solMat(BEIGE, 1));
  }

  // --- LES LANCERS ---
  // img-3 : la cage du marteau et du disque, un filet noir sur de hauts poteaux, dans le virage du cote de la halle,
  // pres de la tribune, ouverte vers le terrain ; son cercle et les lignes du secteur sur le gazon.
  // img-6 : dans le coin en gazon de la demi-lune, deux cercles, l'un dans une petite cage noire.
  {
    const filet = new THREE.MeshBasicMaterial({ color: 0x15171a, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    const noir = lambert(0x1c1e22), beton = solMat(c3(198, 196, 190), 6), blanc = solMat(c3(246, 246, 240), 7);
    const cage = (x: number, y: number, ouverture: number, rayon: number, haut: number) => {
      const ouv = 1.1;   // l'ouverture, cote terrain
      const g = new THREE.CylinderGeometry(rayon, rayon, haut, 40, 1, true, ouverture + ouv / 2, Math.PI * 2 - ouv)
        .rotateX(Math.PI / 2).translate(x, y, haut / 2);
      const poteaux: THREE.BufferGeometry[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = ouverture + ouv / 2 + (i / 6) * (Math.PI * 2 - ouv);
        poteaux.push(new THREE.CylinderGeometry(0.06, 0.08, haut + 0.6, 6).rotateX(Math.PI / 2)
          .translate(x + rayon * Math.sin(t), y - rayon * Math.cos(t), (haut + 0.6) / 2));
      }
      poser([g], filet); poser(poteaux, noir);
    };
    const cercle = (x: number, y: number, rayon: number, secteur: number) => {
      poser([new THREE.CircleGeometry(rayon + 0.25, 32).translate(x, y, 0.006)], beton);
      if (secteur === undefined) return;
      const lignes: THREE.BufferGeometry[] = [];
      for (const d of [-0.305, 0.305]) {   // le secteur de 34,92 degres
        const a = secteur + d, l = 22;
        lignes.push(new THREE.PlaneGeometry(l, 0.06).translate(l / 2 + rayon, 0, 0).rotateZ(a).translate(x, y, 0.008));
      }
      poser(lignes, blanc);
    };
    // la cage du virage de la halle : a 27 m du centre du virage, vers la tribune ; ouverte vers le centre du terrain
    const cx = X(-DEMI - 19), cy = Y(17), versTerrain = Math.atan2(Y(0) - cy, X(0) - cx);
    // (CylinderGeometry couchee : l'angle t regarde la direction t - 90 degres ; l'ouverture vers le terrain)
    // la cage Tripo (7,5 m) ; sa face ouverte regarde -y dans son repere : on la tourne vers le terrain
    piece('cage.glb', [[cx, cy, versTerrain + Math.PI / 2, 1]], () => cage(cx, cy, versTerrain + Math.PI / 2, 3.6, 7.5));
    cercle(cx, cy, 1.25, versTerrain);
    // le coin de la demi-lune : deux cercles, le premier dans sa petite cage
    const p1x = X(55), p1y = Y(-22), p2x = X(62), p2y = Y(-18), versD = Math.atan2(Y(-6) - p1y, X(48) - p1x);
    cercle(p1x, p1y, 1.07, versD);
    // sa cage : la meme que celle du marteau, plus petite (img-6 : une cage noire aux longs bras, a hauteur d'homme et demi)
    piece('cage.glb', [[p1x, p1y, versD + Math.PI / 2, 0.5]], () => cage(p1x, p1y, versD + Math.PI / 2, 2.6, 3.2));
    cercle(p2x, p2y, 1.07, Math.atan2(Y(-6) - p2y, X(48) - p2x));
  }

  // --- DEVANT LA TRIBUNE (photos de l'auteur du 27/10, vue depuis l'aire des sauts : entre la barriere de la piste et la
  // tribune, une bande d'herbe ; au pied de la tribune, une allee de beton ; « le gradin est place de facon vide ») ---
  {
    const t = TRIBUNE_AMSALEM, x0 = X(t.a0) - 8, x1 = X(t.a0) + t.long + 8, yF = Y(t.n0) - 0.6;
    const herbe = toileSol((c, w, h) => {
      c.fillStyle = 'rgb(92,134,56)'; c.fillRect(0, 0, w, h);
      taches(c, w, h, hasard, 60, 20, 80, ['rgba(130,160,80,0.35)', 'rgba(70,112,42,0.35)', 'rgba(140,140,86,0.2)']);
      for (let i = 0; i < 16000; i++) {
        const x = hasard() * w, y = hasard() * h, l = 2 + hasard() * 5;
        c.strokeStyle = hasard() < 0.5 ? 'rgba(66,96,36,0.55)' : 'rgba(160,160,96,0.5)';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (hasard() - 0.5) * 3, y - l); c.stroke();
      }
    }, 512);
    const enM = (g: THREE.BufferGeometry, m: number) => {
      const p = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / m, p.getY(i) / m);
      return g;
    };
    const mh = new THREE.MeshLambertMaterial({ map: herbe }); mh.polygonOffset = true; mh.polygonOffsetFactor = -3; mh.polygonOffsetUnits = -6;
    poser([enM(rect(x0, W + 3.4, x1, yF - 2, -0.02), 10)], mh);
    const beton = toileSol((c, w, h) => {
      c.fillStyle = 'rgb(186,184,178)'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { c.fillStyle = hasard() < 0.5 ? 'rgba(130,128,122,0.4)' : 'rgba(226,224,220,0.4)'; c.fillRect(hasard() * w, hasard() * h, 1, 1); }
      c.fillStyle = 'rgba(110,108,104,0.8)'; for (let k = 0; k < 4; k++) c.fillRect(k * w / 4, 0, 2, h);   // un joint tous les 2 m
    }, 256);
    const mb = new THREE.MeshLambertMaterial({ map: beton }); mb.polygonOffset = true; mb.polygonOffsetFactor = -3; mb.polygonOffsetUnits = -6;
    poser([enM(rect(x0, yF - 2, x1, yF + 0.5, -0.019), 8)], mb);
    // les deux bancs de touche noirs, au bord du terrain, face a la tribune (photos de l'auteur, vues depuis les sauts et
    // depuis le virage) : 4 m de long, abri bas
    const bancs: THREE.BufferGeometry[] = [];
    for (const dx of [-5.5, 5.5]) {
      const bx = X(t.a0) + t.long / 2 + dx, by = -2.8;
      bancs.push(new THREE.BoxGeometry(4, 0.08, 1.5).translate(bx, by - 0.6, 0.75), new THREE.BoxGeometry(4, 1.0, 0.06).translate(bx, by, 1.5),
        new THREE.BoxGeometry(0.06, 1.0, 1.5).translate(bx - 2, by - 0.1, 0.75), new THREE.BoxGeometry(0.06, 1.0, 1.5).translate(bx + 2, by - 0.1, 0.75),
        new THREE.BoxGeometry(3.8, 0.4, 0.45).translate(bx, by - 0.35, 0.45));
    }
    poser(bancs, lambert(0x1e2024));
    // la tour de chronometrage grise sur ses pieds, a gauche de la tribune vue depuis les sauts — entre elle et le virage de
    // la demi-lune, du cote de l'arrivee (memes photos) : une cabine de 2 m sur 3 m de pieds
    const tx = X(t.a0) + t.long + 14, ty = W + 6;
    const tour: THREE.BufferGeometry[] = [new THREE.BoxGeometry(2.2, 2.2, 2.4).translate(tx, ty, 4.2), new THREE.BoxGeometry(2.6, 2.6, 0.15).translate(tx, ty, 5.5)];
    for (const [dx, dy] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) tour.push(new THREE.BoxGeometry(0.12, 0.12, 3).translate(tx + dx, ty + dy, 1.5));
    poser(tour, lambert(c3(120, 124, 130)));
    poser([new THREE.BoxGeometry(2.25, 0.05, 0.9).translate(tx, ty - 1.11, 4.5)], lambert(c3(40, 48, 58)));   // sa vitre
    // l'abri de bois, au bout de la ligne droite de la tribune, derriere la barriere (photos de l'auteur) : 4 x 2,5 m, toit plat
    poser([new THREE.BoxGeometry(4, 2.5, 2.4).translate(D1 + 6, W + 8, 1.2)], lambert(c3(196, 120, 52)));
    poser([new THREE.BoxGeometry(4.3, 2.8, 0.15).translate(D1 + 6, W + 8, 2.48)], lambert(c3(90, 92, 96)));
  }

  // --- LES CHEMINS (img-4 a gauche : une allee goudronnee longe la tribune et file vers la halle ; img-4 a droite, img-6 :
  // une autre passe entre l'aire des sauts et la haie, et tourne autour du virage de la demi-lune) : 3 m d'enrobe ---
  {
    const enrobe = toileSol((c, w, h) => {
      c.fillStyle = 'rgb(92,92,96)'; c.fillRect(0, 0, w, h);
      taches(c, w, h, hasard, 60, 10, 50, ['rgba(70,70,74,0.35)', 'rgba(118,116,112,0.3)']);
      for (let i = 0; i < 30000; i++) { const v = hasard(); c.fillStyle = v < 0.5 ? 'rgba(60,60,64,0.6)' : v < 0.9 ? 'rgba(140,138,134,0.55)' : 'rgba(180,176,166,0.6)'; c.fillRect(hasard() * w, hasard() * h, 1, 1); }
    }, 512);
    const rP = R1 + 2.4 + 20, yA = -R - rP, yT = -R + rP;   // a vingt metres du bord de la piste
    const pts: [number, number][] = [];
    pts.push([X(-DEMI - 6), yA]);
    for (let i = 0; i <= 32; i++) { const u = -Math.PI / 2 + (i / 32) * Math.PI; pts.push([D1 + rP * Math.cos(u), -R + rP * Math.sin(u)]); }
    pts.push([X(-53), yT]);   // jusqu'au pied de la halle
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / l * 1.5, ny = (bx - ax) / l * 1.5, [x, y] = pts[i];
      pos.push(x + nx, y + ny, -0.015, x - nx, y - ny, -0.015);
      uvs.push((x + nx) / 6, (y + ny) / 6, (x - nx) / 6, (y - ny) / 6);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ map: enrobe, side: THREE.DoubleSide }); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4;
    poser([g], m);
  }

  // --- LES BARRIERES NOIRES (img-3, img-5 : au bord exterieur de la piste et de l'aire des sauts) ---
  {
    const rT = R1 + 2.5, H = 1.1, lisses: THREE.BufferGeometry[] = [], poteaux: THREE.BufferGeometry[] = [];
    const troncon = (x0: number, y0: number, x1: number, y1: number) => {
      const l = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      for (const z of [H, H * 0.5]) lisses.push(new THREE.BoxGeometry(l, 0.05, 0.05).rotateZ(a).translate((x0 + x1) / 2, (y0 + y1) / 2, z));
      for (let k = 0; k * 2.5 < l; k++) poteaux.push(new THREE.BoxGeometry(0.05, 0.05, H).translate(x0 + (x1 - x0) * k * 2.5 / l, y0 + (y1 - y0) * k * 2.5 / l, H / 2));
    };
    // les deux virages et la ligne droite de la tribune (interrompue par le prolongement de l'arrivee)
    const arc = (xc: number, u0: number) => {
      for (let i = 0; i < 24; i++) {
        const a = u0 + (i / 24) * Math.PI, b = u0 + ((i + 1) / 24) * Math.PI;
        const x0 = xc + rT * Math.cos(a), y0 = -R + rT * Math.sin(a), x1 = xc + rT * Math.cos(b), y1 = -R + rT * Math.sin(b);
        if (xc === D1 && Math.max(y0, y1) > -2 && Math.min(x0, x1) < D1 + 33) continue;   // (le prolongement de l'arrivee passe)
        troncon(x0, y0, x1, y1);
      }
    };
    arc(D1, -Math.PI / 2); arc(D0, Math.PI / 2);
    // la ligne droite de la tribune ET son prolongement d'arrivee, sur toute leur longueur (« les rambardes noires de la
    // ligne droite du 100 m ne sont pas sur toute la ligne », l'auteur, 27/10 ; img-5, img-6 : le prolongement est borde
    // des deux cotes) ; puis le bout du prolongement. (Pas de barriere cote corde : elle couperait les couloirs du
    // virage, qui passent sous le prolongement — vu au depart du 400 m)
    // (« la rambarde noire s'arrete en face des gradins, des deux cotes », l'auteur, 27/10 : ouverte devant la tribune)
    const tA = X(TRIBUNE_AMSALEM.a0), tB = tA + TRIBUNE_AMSALEM.long;
    troncon(D0, W + 3.3, tA, W + 3.3); troncon(tB, W + 3.3, D1 + 33, W + 3.3);
    troncon(D1 + 33, W + 3.3, D1 + 33, -0.9);
    // l'aire des sauts : son bord exterieur et ses deux bouts
    troncon(xa0 - 1, yO - 17.5, xa1 + 1, yO - 17.5);
    troncon(xa0 - 1, yO - 17.5, xa0 - 1, yO - 2.4); troncon(xa1 + 1, yO - 17.5, xa1 + 1, yO - 2.4);
    const noir = lambert(0x202226);
    poser(lisses, noir); poser(poteaux, noir);
  }

  // --- LE TERRAIN SYNTHETIQUE ET LE SKATEPARK (OSM ; img-3 en haut a gauche, img-6 a gauche : le terrain de
  // football derriere le rideau d'arbres ; img-4 en haut a gauche : la cuvette claire du skatepark) ---
  {
    const [a0, a1, n0, n1] = [19.4, 136.9, 95.7, 168];
    const lg = a1 - a0, lr = n1 - n0;
    const terrain = toileSol((c, w, h) => {
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#2f8a3a' : '#349640'; c.fillRect(i * w / 12, 0, w / 12 + 1, h); }
      const kx = w / lg, ky = h / lr;   // les lignes : un terrain de 105 x 68 m au milieu
      c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 3;
      const X0 = (lg - 105) / 2, Y0 = (lr - 68) / 2;
      c.strokeRect(X0 * kx, Y0 * ky, 105 * kx, 68 * ky);
      c.beginPath(); c.moveTo((X0 + 52.5) * kx, Y0 * ky); c.lineTo((X0 + 52.5) * kx, (Y0 + 68) * ky); c.stroke();
      c.beginPath(); c.ellipse((X0 + 52.5) * kx, (Y0 + 34) * ky, 9.15 * kx, 9.15 * ky, 0, 0, Math.PI * 2); c.stroke();
      for (const x of [X0, X0 + 105 - 16.5]) c.strokeRect(x * kx, (Y0 + 13.85) * ky, 16.5 * kx, 40.3 * ky);
    }, 1024, 640);
    const t = new THREE.PlaneGeometry(lg, lr).translate(X((a0 + a1) / 2), Y((n0 + n1) / 2), -0.02);
    const mt = new THREE.MeshLambertMaterial({ map: terrain }); mt.polygonOffset = true; mt.polygonOffsetFactor = -5; mt.polygonOffsetUnits = -10;
    poser([t], mt);
    const buts: THREE.BufferGeometry[] = [];
    for (const a of [a0 + (lg - 105) / 2, a1 - (lg - 105) / 2]) for (const n of [-3.66, 3.66])
      buts.push(new THREE.BoxGeometry(0.12, 0.12, 2.44).translate(X(a), Y((n0 + n1) / 2 + n), 1.22));
    for (const a of [a0 + (lg - 105) / 2, a1 - (lg - 105) / 2])
      buts.push(new THREE.BoxGeometry(0.12, 7.44, 0.12).translate(X(a), Y((n0 + n1) / 2), 2.44));
    poser(buts, lambert(0xf4f4f2));
    // le skatepark : son contour OSM, beton clair
    const skate = new THREE.Shape([[-42.9, 124.5], [-41.9, 99.5], [-43.4, 87], [-35.8, 82.7], [-11.5, 82], [-12.3, 109.1], [-16.8, 116.2], [-32.5, 132.1], [-39.1, 129.7]]
      .map(([a, n]) => new THREE.Vector2(X(a), Y(n))));
    // (img-4 en haut a gauche : un beton clair creuse de cuvettes, leurs bords ombres) : une texture a l'echelle du contour
    const xs = [-42.9, -11.5].map(X), ys = [82, 132.1].map(Y), lx = xs[1] - xs[0], ly = ys[1] - ys[0];
    const beton = toileSol((c, w, h) => {
      c.fillStyle = 'rgb(214,206,190)'; c.fillRect(0, 0, w, h);
      taches(c, w, h, hasard, 80, 6, 30, ['rgba(190,182,166,0.35)', 'rgba(230,224,212,0.35)']);
      for (const [u, v, r] of [[0.35, 0.3, 0.2], [0.62, 0.62, 0.24], [0.3, 0.75, 0.14]]) {
        const gr = c.createRadialGradient(u * w, v * h, r * w * 0.15, u * w, v * h, r * w);
        gr.addColorStop(0, 'rgba(150,144,134,0.9)'); gr.addColorStop(0.8, 'rgba(196,190,176,0.7)'); gr.addColorStop(1, 'rgba(120,114,106,0.9)');
        c.fillStyle = gr; c.beginPath(); c.ellipse(u * w, v * h, r * w, r * h * 1.2, 0.3, 0, Math.PI * 2); c.fill();
      }
    }, 512);
    beton.wrapS = beton.wrapT = THREE.ClampToEdgeWrapping;
    const gs = new THREE.ShapeGeometry(skate).translate(0, 0, -0.01), ps = gs.attributes.position, us = gs.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < ps.count; i++) us.setXY(i, (ps.getX(i) - xs[0]) / lx, (ps.getY(i) - ys[0]) / ly);
    const msk = new THREE.MeshLambertMaterial({ map: beton }); msk.polygonOffset = true; msk.polygonOffsetFactor = -5; msk.polygonOffsetUnits = -10;
    poser([gs], msk);
  }

  // --- LES MATS A DRAPEAUX (img-6, agrandie : quatre mats devant la haie, derriere le virage de la demi-lune, du cote
  // de la tribune ; de gauche a droite un blanc, un blanc, le drapeau francais et un bleu (l'europeen, sans doute) ;
  // sans vent, ils pendent le long du mat — le francais montre le bleu en haut et le rouge en bas) ---
  {
    const drapeau = (dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const t = toileSol(dessin, 64, 128); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
    };
    const blanc = drapeau((c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h); });
    const france = drapeau((c, w, h) => { ['#1f3f99', '#f4f4f2', '#d4202e'].forEach((v, k) => { c.fillStyle = v; c.fillRect(0, k * h / 3, w, h / 3 + 1); }); });
    const europe = drapeau((c, w, h) => {
      c.fillStyle = '#1d3f9a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f7d21c';
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * w * 0.3, 2.4, 0, Math.PI * 2); c.fill(); }
    });
    const mats: THREE.BufferGeometry[] = [];
    [blanc, blanc, france, europe].forEach((m, k) => {
      // (devant l'arc de la haie, a trois metres : la haie tourne autour du virage)
      const y = Y(34 - k * 8), xF = D1 + Math.sqrt(Math.max(0, (R_HAIE - 3) ** 2 - (y + R) ** 2));
      mats.push(new THREE.CylinderGeometry(0.04, 0.06, 8, 6).rotateX(Math.PI / 2).translate(xF, y, 4));
      // le tissu pend du haut du mat : 0,9 m de large, 1,8 m de long, la hampe contre le mat
      poser([new THREE.PlaneGeometry(0.9, 1.8).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(xF, y + 0.47, 7.0)], m);
    });
    poser(mats, lambert(0xe8e8e6));
  }

  // --- LA NUIT : une lueur a la tete des quatre mats. (Des nappes de lumiere posees sur le tartan ont ete
  // essayees le 27/10 : elles se battaient avec la piste en profondeur, des stries sur les couloirs exterieurs.) ---
  if (o.nuit) {
    const tache = toileSol((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,244,222,0.75)'); g.addColorStop(0.5, 'rgba(255,236,205,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256);
    tache.wrapS = tache.wrapT = THREE.ClampToEdgeWrapping;
    const halo = new THREE.SpriteMaterial({ map: tache, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false });
    for (const a of [-DEMI + 4, DEMI - 4]) for (const y of [W + 3.6, yO - 2.4]) {
      const sp = new THREE.Sprite(halo); sp.position.set(X(a), y, 24.5); sp.scale.set(9, 9, 1); stade.add(sp);
    }
  }
  return rouges;
}
