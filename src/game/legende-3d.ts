// LES LIEUX DE LA CARRIERE LEGENDE EN 3D (23/10/2026, « fais pareil pour le mode
// carriere des legendes » — apres la nuit du molosse en 3D complete).
//
// La Legende court ses six etapes dans des stades du jeu aux couleurs du lieu ; ce
// qui dit OU l'on court, c'est le decor de legende/decors.ts : un monument au loin
// (le Pavillon d'or, Big Ben, la tour Eiffel...), des objets typiques dans la pelouse
// (torii, cabines, taxis...), une guirlande aux couleurs du pays, et a l'Olympe les
// dieux qui regardent. La 3D reprend LES MEMES IMAGES — des rendus Blender des
// modeles Tripo, a l'angle du jeu, avec leur pied et leur taille reelle (manifeste) —
// en decoupes tournees vers la camera, chacune a sa vraie place et a sa vraie taille :
// pas un credit Tripo de plus, et le lieu se reconnait du premier coup d'oeil.
//
// course-3d.ts l'appelle quand la cle du stade commence par `legende-` ; le module
// des decors est charge a la demande (le canal de test seul le sert). Une image
// pas encore chargee manque a la premiere construction : `manque` le dit, et la
// course 3D reconstruit un peu plus tard.

import * as THREE from 'three';

type Decors = typeof import('./legende/decors');
type Nuages = typeof import('./legende/nuages');

export type ContexteLegende = {
  stade: THREE.Group;
  /** Le lieu (kyoto, paris, karman-wukong...), sans le prefixe `legende-`. */
  lieu: string;
  W: number; D0: number; D1: number; R1: number;
  hasard: () => number;
  decors: Decors;
  nuages: Nuages | null;
};

/** Hauteur visee du monument, en metres, a trois cents metres derriere la tribune.
 *  EXAGEREE, comme en 2D : vu de la camera de course, le toit de la tribune monte a
 *  pres de dix-huit degres — un monument a sa vraie taille s'y cachait tout entier. */
const HAUTEUR: Record<string, number> = {
  menole: 0, kyoto: 200, kingston: 175, izmir: 230, barcelone: 270, casablanca: 290, abuja: 190,
  paris: 330, newyork: 250, londres: 250, karman: 270, apotheose: 270,
};

function texture(im: CanvasImageSource): THREE.Texture {
  const t = im instanceof HTMLCanvasElement ? new THREE.CanvasTexture(im) : new THREE.Texture(im as HTMLImageElement);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

/** Une decoupe debout, tournee vers la camera, le pied (ax, ay) au point donne. */
function decoupe(im: { im: CanvasImageSource; w: number; h: number; ax: number; ay: number }, largeur: number,
                 x: number, y: number, z: number, voile = 1, brume = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(im.im), transparent: true, alphaTest: 0.25, fog: brume, opacity: voile }));
  s.center.set(im.ax / im.w, 1 - im.ay / im.h);
  s.scale.set(largeur, largeur * im.h / im.w, 1);
  s.position.set(x, y, z);
  return s;
}

/** Construit le decor du lieu dans `stade`. Rend le nombre d'images qui manquaient. */
export function construireLegende(o: ContexteLegende): number {
  const { stade, lieu, W, D0, D1, R1, hasard, decors } = o;
  const D = decors.decorDuLieu3D(lieu);
  let manque = 0;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const xMil = (D0 + D1) / 2 + 10;

  // --- LE MONUMENT, au bout de la ligne droite, au-dela de l'arrivee ---------------------
  // Derriere la tribune (sa place en 2D), la camera de profil ne le voyait jamais : elle
  // ne cadre presque pas de ciel. Au bout de la piste, la camera de depart l'a droit
  // devant elle — la ou l'on court.
  const H = HAUTEUR[D.monument] ?? 90;
  if (H > 0) {
    const M = decors.imageDuDecor(D.monument === 'karman' ? 'karman' : D.monument);
    if (!M) manque++;
    else {
      const larg = H * M.w / M.h;
      ajoute(decoupe(M, larg, D1 + 320, W / 2 + 30, 0, 1, false));   // hors brume : a 320 m, le brouillard du stade l'effacait
    }
  }
  // l'arene-asteroide de l'apotheose, qui flotte au-dessus de l'horizon
  if (D.monument === 'apotheose') {
    const A = decors.imageDuDecor('arene');
    if (!A) manque++;
    else ajoute(decoupe(A, 320, D1 + 420, W / 2 - 180, 120, 1, false));
  }
  // les dieux de l'Olympe qui ne courent pas : des colosses voiles, de part et d'autre
  if (D.dieux.length) {
    const imgs = (globalThis as any).SprinterImages;
    const places = [[300, -170], [300, 230], [420, -320]];
    D.dieux.forEach((d, i) => {
      const im = imgs && imgs.image(d.url);
      if (!im) { manque++; return; }
      const [dx, y] = places[i % places.length];
      ajoute(decoupe({ im, w: d.p.w, h: d.p.h, ax: d.p.ax, ay: d.p.ay }, 210, D1 + dx, W / 2 + y, 0, 0.82, false));
    });
  }

  // --- LES OBJETS TYPIQUES, dans la pelouse interieure ----------------------------------
  // Le 2D les posait au premier plan, en deca du couloir 1. La camera 3D se tient de ce
  // cote-la et regarde la course de profil : un objet haut (torii, cerisier, bus) y
  // passerait entre elle et les coureurs — les hauts reculent donc au-dela de la camera,
  // les bas restent a leur place, sous son regard.
  const C = D.culture;
  if (C) {
    const total = C.objets.reduce((a, b) => a + b.poids, 0);
    for (let x = D0 - 6; x <= D1 + 24; x += C.pas * 4) {
      let t = hasard() * total, ob = C.objets[0];
      for (const c of C.objets) { if ((t -= c.poids) <= 0) { ob = c; break; } }
      const im = decors.imageDuDecor(ob.img);
      if (!im) { manque++; continue; }
      const haut = im.largeurM * im.h / im.w;
      let recul = ob.recul[0] + hasard() * (ob.recul[1] - ob.recul[0]);
      if (haut > 2.8) recul += 16;
      ajoute(decoupe(im, im.largeurM, x + hasard() * 3, -0.9 - recul, 0));
    }
    // LA GUIRLANDE, tendue devant la tribune : des fanions aux couleurs du pays (a Kyoto,
    // des lanternes de papier rouges), entre des mats tous les douze metres
    const mats: number[] = [], fanions: number[] = [], teintes: number[] = [];
    const yG = W + 2.6, haut = 4.2;
    const couleurs = C.guirlande === 'chochin' ? [[214, 40, 30], [240, 232, 214]] : C.guirlande;
    for (let x = D0 - 10; x <= D1 + 20; x += 12) {
      mats.push(x);
      for (let k = 0; k < 12; k++) {
        const u = k / 12, z = haut - Math.sin(u * Math.PI) * 0.9;
        fanions.push(x + u * 12, yG, z);
        const c = couleurs[k % couleurs.length];
        const col = new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
        teintes.push(col.r, col.g, col.b);
      }
    }
    const fut = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, haut, 6).rotateX(Math.PI / 2).translate(0, 0, haut / 2),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.4 }), mats.length);
    mats.forEach((x, i) => fut.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yG, 0)));
    ajoute(fut);
    // un fanion = un triangle pointe en bas ; une lanterne = une petite sphere qui luit
    const chochin = C.guirlande === 'chochin';
    const forme = chochin ? new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1, 1.3)
      : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, 0, -0.45], 3));
    if (!chochin) forme.computeVertexNormals();
    const mat = chochin ? new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x401008 })
      : new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
    const lot = new THREE.InstancedMesh(forme, mat, fanions.length / 3);
    for (let i = 0; i < fanions.length / 3; i++) {
      lot.setMatrixAt(i, new THREE.Matrix4().makeTranslation(fanions[i * 3], fanions[i * 3 + 1], fanions[i * 3 + 2]));
      lot.setColorAt(i, new THREE.Color(teintes[i * 3], teintes[i * 3 + 1], teintes[i * 3 + 2]));
    }
    ajoute(lot);
  }

  // (Menole n'a plus ses barques peintes ici : menole-3d.ts pose de vraies pirogues)

  // --- L'OLYMPE : une mer de nuages autour du stade, sous la piste -----------------------
  if (D.monument === 'karman' && o.nuages) {
    const N = o.nuages;
    N.chargerLesCumulus();
    let n = 0;
    for (let i = 0; i < 70; i++) {
      const im = N.cumulus(i % N.NB_CUMULUS);
      if (!im) { n++; continue; }
      const a = hasard() * Math.PI * 2, r = R1 + W + 30 + hasard() * 220;
      const x = (D0 + D1) / 2 + Math.cos(a) * r * 1.3, y = -R1 + Math.sin(a) * r;
      const larg = 40 + hasard() * 50;
      const s = decoupe({ im, w: im.naturalWidth, h: im.naturalHeight, ax: im.naturalWidth / 2, ay: im.naturalHeight * 0.75 }, larg, x, y, -6 - hasard() * 8, 0.95);
      ajoute(s);
    }
    if (n) manque++;
  }
  return manque;
}
