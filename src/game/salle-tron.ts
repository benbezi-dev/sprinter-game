// LA SALLE TRON — la Grille, pour les SACRES (09/11, l'auteur : « on garde celle de ce matin, on part sur Tron pour
// les sacres ; retire les bandes horizontales »).
//
// La salle Jesse Owens reste la halle reelle, de jour comme de nuit. Quand le joueur est sacre (la scene du champion
// puis le generique, le tour d'honneur dans la halle), elle passe dans la Grille : tout ce qui est construit devient
// noir et luisant ; les traits de la piste (couloirs, departs, arrivee) s'allument en neon cyan, la corde en orange
// (la couleur des rivaux, dans le film) ; les aretes de la charpente, des gradins, des facades et des murets se
// dessinent en filets de lumiere (orange pour les murets) ; une grille de 2 m couvre le sol de la halle. Plus de
// bandes de lumiere horizontales sur les murets et les rambardes. Les coureurs prennent un liseré cyan, le noir
// luisant reflete des bandes cyan (carteTron), le public devient des silhouettes dont un sur trois porte un maillot
// allume, et les neons ont un halo (course-3d.ts : appliquerTron, rendreLImage).
//
// On n'ecrit rien dans salle-3d.ts : on rhabille, apres coup, ce qu'il a construit, et habillerTron rend de quoi
// tout DEFAIRE (la scene sert encore a la course suivante) : les matieres d'origine reviennent, les filets et la
// grille s'en vont. Les ecrans et les cartes du public, qui ne sont pas des matieres de la coque, restent tels quels.
//
// Reglage d'URL : ?tron=1 (la Grille tout le temps, pour la voir), ?tron=0 (jamais, meme au sacre).

import * as THREE from 'three';

export const TRON = {
  cyan: 0x6ff3ff,
  orange: 0xff8a2a,
  fond: 0x010306,
  brume: 0x03101c,
};

/** La luminance d'une couleur (lineaire). */
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Le |nz| moyen des normales de la piece, dans le monde : 1 a plat (un sol), 0 debout (un mur). */
function inclinaison(o: THREE.Mesh) {
  const geo = o.geometry;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const n = geo.getAttribute('normal'), nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), v = new THREE.Vector3();
  const pas = Math.max(1, Math.floor(n.count / 400));
  let s = 0, k = 0;
  for (let i = 0; i < n.count; i += pas) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); s += Math.abs(v.z); k++; }
  return k ? s / k : 1;
}

/** La largeur typique d'une bande : la mediane du plus petit cote de ses triangles (au plus 300 tires). */
function largeurDeBande(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position'), idx = geo.index;
  const n = idx ? idx.count / 3 : pos.count / 3;
  if (!n) return Infinity;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), mins: number[] = [];
  const pas = Math.max(1, Math.floor(n / 300));
  for (let t = 0; t < n; t += pas) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    mins.push(Math.min(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)));
  }
  mins.sort((x, y) => x - y);
  return mins[mins.length >> 1];
}

export function habillerTron(g: THREE.Object3D, env: THREE.Texture | null) {
  const neonCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(TRON.cyan).multiplyScalar(1.15), toneMapped: false });
  const neonCyanDouble = neonCyan.clone(); neonCyanDouble.side = THREE.DoubleSide;
  const neonOrange = new THREE.MeshBasicMaterial({ color: new THREE.Color(TRON.orange).multiplyScalar(1.15), toneMapped: false, side: THREE.DoubleSide });
  const filetCyan = new THREE.LineBasicMaterial({ color: new THREE.Color(TRON.cyan).multiplyScalar(0.75), transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false });
  const filetOrange = new THREE.LineBasicMaterial({ color: new THREE.Color(TRON.orange).multiplyScalar(0.9), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
  const lampeTron = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8f6ff).multiplyScalar(0.62) }); lampeTron.name = 'plafonnier-tron';
  const copies = new Map<THREE.Material, THREE.Material>();
  const boite = new THREE.Box3(), taille = new THREE.Vector3();
  const filets: { m: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.LineBasicMaterial }[] = [];
  let neons = 0, noircies = 0, oranges = 0;
  const avant = new Map<THREE.Mesh, THREE.Material>();     // ce qu'il faut remettre
  const ajouts: THREE.Object3D[] = [];
  const poser = (o: THREE.Mesh, m: THREE.Material) => { if (!avant.has(o)) avant.set(o, o.material as THREE.Material); o.material = m; };
  /** La copie noire et luisante d'une matiere (une seule par matiere d'origine). */
  const noirci = (mat: THREE.MeshStandardMaterial, coqueCuite: boolean): THREE.Material => {
    let c = copies.get(mat);
    if (c) return c;
    if (coqueCuite) {
      const m2 = (mat as any).clone() as THREE.MeshBasicMaterial;
      m2.color = mat.color.clone().multiplyScalar(0.06).add(new THREE.Color(0x010409));
      m2.lightMapIntensity = ((mat as any).lightMapIntensity ?? 1) * 0.35;
      c = m2;
    } else {
      const m2 = mat.clone();
      m2.color = mat.color.clone().multiplyScalar(0.07).add(new THREE.Color(0x02060a));
      m2.emissive = new THREE.Color(0x000000); m2.emissiveMap = null;
      m2.roughness = Math.min(mat.roughness, 0.35); m2.metalness = Math.max(mat.metalness, 0.35);
      if (env) { m2.envMap = env; m2.envMapIntensity = 0.55; }
      m2.lightMapIntensity = (mat.lightMapIntensity ?? 1) * 0.25;
      m2.toneMapped = true;
      c = m2;
    }
    copies.set(mat, c);
    return c;
  };

  g.updateMatrixWorld(true);
  g.traverse((o: any) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.sansReflet) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    if (!mat || Array.isArray(o.material)) return;
    // la coque (murs, plafond, gradins) est en MeshBasic avec sa lumiere cuite (salle-3d.ts, appliquer) ; les ecrans,
    // eux, sont en MeshBasic SANS lumiere cuite : ils restent allumes
    if (mat.name === 'plafonnier') {
      // les plafonniers (salle-3d.ts) : blanc-cyan et plus doux — sous le halo, un plafonnier proche faisait une tache
      poser(o, lampeTron); return;
    }
    const coqueCuite = (mat as any).isMeshBasicMaterial && !!(mat as any).lightMap;
    if (!(mat as any).isMeshStandardMaterial && !coqueCuite) return;
    o.geometry.computeBoundingBox();
    boite.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld); boite.getSize(taille);
    const blanc = lum(mat.color) > 0.7 && !mat.map;
    // UN TRAIT, c'est une bande etroite : sur l'anneau RELEVE, sa boite monte avec le virage (les traits des couloirs
    // passaient pour le muret et sortaient orange) — on mesure donc la largeur sur les triangles eux-memes
    const mince = Math.min(taille.x, taille.y, taille.z) < 0.16 || largeurDeBande(o.geometry) < 0.11;   // (les traits font 8 cm)
    if (blanc && mince && taille.z < 1.6) {
      // LES TRAITS : au sol (la piste) en cyan ; la corde, debout au ras du sol, en orange. Ce qui est debout plus haut
      // (bandeaux des murets, rambardes) ne s'allume plus en bande : noir, borde d'un filet orange
      const debout = inclinaison(o) < 0.6;
      if (!debout || boite.max.z < 0.2) {
        let m: THREE.Material = debout ? neonOrange : mat.side === THREE.DoubleSide ? neonCyanDouble : neonCyan;
        if (mat.polygonOffset) { m = m.clone(); Object.assign(m, { polygonOffset: true, polygonOffsetFactor: mat.polygonOffsetFactor, polygonOffsetUnits: mat.polygonOffsetUnits }); }
        poser(o, m); neons++; if (debout) oranges++;
        return;
      }
    }
    const muret = blanc && taille.z < 1.6 && (mince || Math.hypot(taille.x, taille.y) > 15);
    // tout le reste : noir et luisant (la teinte d'origine a peine, pour garder le dessin des surfaces)
    poser(o, noirci(mat, coqueCuite)); noircies++;
    const arete = muret ? filetOrange : filetCyan;
    if (muret) oranges++;
    // les aretes des volumes (charpente, gradins, facades, poteaux) : des filets de lumiere
    const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.getAttribute('position').count / 3;
    if (n < 20000 && taille.length() > 1.5) filets.push({ m: o, geo: o.geometry, mat: arete });
  });

  let segments = 0;
  for (const { m, geo, mat } of filets) {
    const aretes = new THREE.EdgesGeometry(geo, 40);
    const k = aretes.getAttribute('position').count / 2;
    if (!k || segments + k > 120000) continue;       // une limite, pour les telephones
    segments += k;
    const l = new THREE.LineSegments(aretes, mat); l.renderOrder = 2; m.add(l); ajouts.push(l);
  }

  // LA GRILLE AU SOL : un pas de 2 m, sur toute la halle, a peine au-dessus du plateau (le tartan la couvre)
  const b = new THREE.Box3().setFromObject(g).applyMatrix4(g.matrixWorld.clone().invert());   // dans le repere de la salle
  const pas = 2, pts: number[] = [];
  const x0 = Math.floor(b.min.x / pas) * pas, x1 = Math.ceil(b.max.x / pas) * pas;
  const y0 = Math.floor(b.min.y / pas) * pas, y1 = Math.ceil(b.max.y / pas) * pas;
  for (let x = x0; x <= x1; x += pas) pts.push(x, y0, 0.002, x, y1, 0.002);
  for (let y = y0; y <= y1; y += pas) pts.push(x0, y, 0.002, x1, y, 0.002);
  const grille = new THREE.BufferGeometry(); grille.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const gl = new THREE.LineSegments(grille, new THREE.LineBasicMaterial({ color: TRON.cyan, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false }));
  gl.userData.tronGrille = true; gl.renderOrder = 1;
  g.add(gl); ajouts.push(gl);
  /** Tout remettre comme avant : les matieres d'origine, sans filets ni grille. */
  const defaire = () => {
    for (const [o, m] of avant) o.material = m;
    for (const a of ajouts) { a.parent?.remove(a); (a as THREE.LineSegments).geometry.dispose(); }
    for (const m of copies.values()) m.dispose();
    avant.clear(); ajouts.length = 0;
  };
  return { neons, noircies, oranges, segments, defaire };
}

/** Ce que reflete le noir luisant de la Grille : des bandes de lumiere cyan et blanches, quelques orange. */
export function carteTron(r: THREE.WebGLRenderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x010306);
  const couleurs = [TRON.cyan, 0xd8fbff, TRON.cyan, TRON.cyan, TRON.orange];
  let g = 11;
  const h = () => ((g = (g * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const a = h() * Math.PI * 2, d = 8 + h() * 4, haut = (h() - 0.3) * 6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1 + h() * 4, 0.05 + h() * 0.08, 0.05),
      new THREE.MeshBasicMaterial({ color: couleurs[i % couleurs.length] }));
    m.position.set(Math.cos(a) * d, haut, Math.sin(a) * d); m.lookAt(0, haut, 0);
    sc.add(m);
  }
  return new THREE.PMREMGenerator(r).fromScene(sc, 0.02).texture;
}
