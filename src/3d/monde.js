/* -----------------------------------------------------------------------
   SPRINTER 3D — LE STADE.

   Tout ce qui est bati ici sort de la MEME geometrie de piste que le jeu 2D :
   `Track.posAtR(s, r)` donne le point du monde a `s` metres de course et `r`
   metres de l'axe, en ligne droite comme en virage. Le stade n'est donc pas un
   decor qui ressemble a celui du jeu, c'est le meme terrain, lu par une autre
   camera.

   LE MONDE EST EN Z VERS LE HAUT. Three.js prefere le Y, le moteur du jeu
   travaille en Z, et convertir l'un dans l'autre a chaque acces serait une
   source de bugs sans le moindre benefice. On dit donc a Three.js que le haut
   est le Z (voir `DEFAULT_UP` dans main.js) et plus une seule coordonnee n'a
   besoin d'etre echangee.
   ----------------------------------------------------------------------- */

const K = () => globalThis.SprinterCore;

/** Le point du monde, en ligne droite comme en virage. */
export function posR(T, s, r) {
  if (!T.curved) return [s, r];
  return T.posAtR(s, r);
}

export function bordsPiste(T) {
  const C = K().C;
  if (!T.curved) return [0, C.LANE_W * C.LANE_COUNT];
  return [T.edge(0), T.edge(C.LANE_COUNT)];
}

const srgb = (THREE, c, f) => {
  const k = f == null ? 1 : f;
  const o = new THREE.Color(
    Math.min(255, c[0] * k) / 255,
    Math.min(255, c[1] * k) / 255,
    Math.min(255, c[2] * k) / 255);
  o.convertSRGBToLinear();
  return o;
};
const css = (c, f, a) => {
  const k = f == null ? 1 : f;
  const t = [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0,
             Math.min(255, c[2] * k) | 0];
  return a == null ? `rgb(${t[0]},${t[1]},${t[2]})` : `rgba(${t[0]},${t[1]},${t[2]},${a})`;
};

/**
 * LA PISTE EST UNE TEXTURE, PAS UNE COLLECTION DE TRAITS.
 *
 * On pourrait poser chaque ligne de couloir comme un ruban de geometrie a
 * deux millimetres au-dessus du sol. On aurait alors huit rubans, un damier
 * d'arrivee, des chiffres, et le z-fighting de tout ce petit monde contre la
 * piste des que la camera s'eloigne.
 *
 * Une seule image, deroulee sur la surface, regle les trois a la fois : les
 * marques SONT la piste, elles ne flottent pas dessus, et le filtrage
 * anisotrope leur garde un bord net jusqu'a l'horizon — ce qu'aucune geometrie
 * fine ne fait a cette distance.
 *
 * Elle porte aussi le grain du tartan et l'usure, au meme endroit et pour le
 * meme prix. C'est la meme idee que le grain de la version 2D, sauf qu'ici
 * elle se resout une fois pour toutes au chargement.
 */
function texturePiste(THREE, T, th, sMin, sMax, rIn, rOut) {
  const C = K().C;
  const L = 4096, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');
  const u = (s) => ((s - sMin) / (sMax - sMin)) * L;
  const v = (r) => ((r - rIn) / (rOut - rIn)) * H;
  const mParPx = (sMax - sMin) / L;

  c.fillStyle = css(th.trackA); c.fillRect(0, 0, L, H);
  // Les bandes du jeu 2D, une sur deux, tres legerement plus sombres : ce sont
  // les reprises de resine d'une piste posee en plusieurs passes.
  for (let s = sMin; s < sMax; s += 24) {
    if ((((s - sMin) / 24) | 0) % 2) continue;
    c.fillStyle = css(th.trackB);
    c.fillRect(u(s), 0, 24 / mParPx, H);
  }
  // Le grain. Deux echelles, comme en 2D : une usure lente sur plusieurs
  // metres, un granulat serre par-dessus.
  let seed = 0x9e3779b9 >>> 0;
  const al = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  for (let i = 0; i < 520; i++) {
    const x = al() * L, y = al() * H, r = 60 + al() * 220, clair = al() < 0.5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, clair ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = c.getImageData(0, 0, L, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = al();
    if (n < 0.55) continue;
    const q = (n - 0.55) * (n > 0.85 ? 58 : -50);
    d[i] = Math.max(0, Math.min(255, d[i] + q));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + q));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + q));
  }
  c.putImageData(img, 0, 0);

  // Les lignes de couloir. Pas tout a fait opaques : de la peinture sur du
  // tartan laisse transparaitre le granulat, et c'est ce qui la fait
  // appartenir a la piste au lieu d'etre posee dessus.
  const bord = (e) => T.curved ? T.edge(e) : e * C.LANE_W;
  c.lineCap = 'butt';
  for (let e = 1; e < C.LANE_COUNT; e++) {
    c.fillStyle = css(th.lane, 1, 0.9);
    const y = v(bord(e)), ep = 0.05 / (rOut - rIn) * H;
    c.fillRect(0, y - ep / 2, L, Math.max(2, ep));
  }
  c.fillStyle = css(th.kerb);
  c.fillRect(0, 0, L, Math.max(4, 0.12 / (rOut - rIn) * H));
  c.fillStyle = css(th.lane);
  c.fillRect(0, H - Math.max(3, 0.08 / (rOut - rIn) * H), L, Math.max(3, 0.08 / (rOut - rIn) * H));

  // La ligne de depart, celle des cinquante derniers metres, et le damier.
  const trait = (s, ep, style) => {
    c.fillStyle = style;
    c.fillRect(u(s) - ep / 2 / mParPx, 0, Math.max(3, ep / mParPx), H);
  };
  trait(0, 0.08, 'rgba(255,255,255,0.94)');
  if (T.total - 50 > 0) trait(T.total - 50, 0.05, 'rgba(255,255,255,0.80)');
  const pas = H / (C.LANE_COUNT * 2);
  for (let i = 0; i < C.LANE_COUNT * 2; i++) {
    c.fillStyle = i % 2 ? 'rgb(48,50,62)' : '#fff';
    c.fillRect(u(T.total) - 0.35 / mParPx, i * pas, 0.7 / mParPx, pas);
  }

  // Les numeros de couloir, avec les chiffres peints du jeu — une piste porte
  // l'identite graphique de sa competition, pas une fonte systeme.
  const CH = globalThis.ChiffresPiste;
  for (let e = 0; e < C.LANE_COUNT; e++) {
    const y = v((bord(e) + bord(e + 1)) / 2);
    const x = u(-1.8);
    if (CH) {
      c.save(); c.translate(x, y); c.rotate(-Math.PI / 2);
      CH.dessiner(c, e + 1, 0, 0, 90, 'rgba(255,255,255,0.62)');
      c.restore();
    }
  }

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Une nappe de sol suivant la piste, entre deux rayons. */
function nappeSol(THREE, T, sMin, sMax, rA, rB, pasS, pasR, mat, uv) {
  const nS = Math.max(2, Math.round((sMax - sMin) / pasS));
  const nR = Math.max(1, Math.round((rB - rA) / pasR));
  const pos = [], idx = [], uvs = [], nor = [];
  for (let i = 0; i <= nS; i++) {
    const s = sMin + (sMax - sMin) * (i / nS);
    for (let j = 0; j <= nR; j++) {
      const r = rA + (rB - rA) * (j / nR);
      const p = posR(T, s, r);
      pos.push(p[0], p[1], 0);
      nor.push(0, 0, 1);
      uvs.push(uv ? i / nS : (s / 8), uv ? j / nR : (r / 8));
    }
  }
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nR; j++) {
      const a = i * (nR + 1) + j, b = a + 1, cI = a + (nR + 1), d = cI + 1;
      idx.push(a, cI, b, b, cI, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/** La pelouse : un vert qui n'est pas un aplat, avec ses passes de tondeuse. */
function textureGazon(THREE, th) {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d');
  c.fillStyle = css(th.grass); c.fillRect(0, 0, N, N);
  c.fillStyle = css(th.grass, 1.06);
  c.fillRect(0, 0, N / 2, N);
  let seed = 12345;
  const al = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 9000; i++) {
    const x = al() * N, y = al() * N;
    c.fillStyle = al() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    c.fillRect(x, y, 1.6, 3.2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = 16;
  return t;
}

/**
 * LES TRIBUNES, ET LA FOULE QUI EST DEDANS.
 *
 * Les gradins sont de la geometrie : une marche et une contremarche par rang,
 * bati sur la meme piste. Le public, lui, est un MAILLAGE INSTANCIE — une
 * seule silhouette, envoyee au processeur graphique une fois, puis repetee
 * quinze mille fois avec une matrice et une couleur par personne.
 *
 * C'est la difference qui change tout par rapport a la version 2D. La-bas, une
 * foule dense coutait si cher qu'il a fallu la cuire dans une tuile repetee —
 * et une tuile se reconnait. Ici quinze mille spectateurs tiennent en UN appel
 * de dessin : ils sont tous differents, tous places, et la grille a disparu
 * parce qu'il n'y a plus de grille.
 */
function tribunes(THREE, T, th, sMin, sMax, rBord, groupe, opts) {
  const o = opts || {};
  // `sens` vaut +1 pour la tribune du dehors, -1 pour celle d'en face, de
  // l'autre cote de la pelouse. Les gradins s'elevent en s'eloignant de la
  // piste dans les deux cas : c'est le seul parametre qui les distingue.
  const sens = o.sens || 1;
  const rangs = o.rangs || 22, prof = 0.82 * sens, haut = 0.42;
  const depart = rBord + 3.2 * sens;
  const pos = [], nor = [], col = [], idx = [];
  const cTread = srgb(THREE, th.tread), cRiser = srgb(THREE, th.riser);
  const nS = Math.max(8, Math.round((sMax - sMin) / 3));
  const pousse = (p, n, c) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c.r, c.g, c.b); };

  for (let t = 0; t < rangs; t++) {
    const r0 = depart + t * prof, z0 = 0.9 + t * haut;
    for (let i = 0; i < nS; i++) {
      const s0 = sMin + (sMax - sMin) * (i / nS);
      const s1 = sMin + (sMax - sMin) * ((i + 1) / nS);
      const a = posR(T, s0, r0), b = posR(T, s1, r0);
      const a2 = posR(T, s0, r0 + prof), b2 = posR(T, s1, r0 + prof);
      const base = pos.length / 3;
      // la contremarche, verticale
      const nr = [0, -sens, 0];
      pousse([a[0], a[1], z0 - haut], nr, cRiser);
      pousse([b[0], b[1], z0 - haut], nr, cRiser);
      pousse([b[0], b[1], z0], nr, cRiser);
      pousse([a[0], a[1], z0], nr, cRiser);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      // la marche, horizontale
      const b2i = pos.length / 3;
      pousse([a[0], a[1], z0], [0, 0, 1], cTread);
      pousse([b[0], b[1], z0], [0, 0, 1], cTread);
      pousse([b2[0], b2[1], z0], [0, 0, 1], cTread);
      pousse([a2[0], a2[1], z0], [0, 0, 1], cTread);
      idx.push(b2i, b2i + 1, b2i + 2, b2i, b2i + 2, b2i + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, metalness: 0,
  }));
  mesh.receiveShadow = true;
  groupe.add(mesh);

  // Le muret et les panneaux publicitaires, au pied des gradins.
  const murG = new THREE.BufferGeometry();
  const mp = [], mn = [], mc = [], mi = [];
  for (let i = 0; i < nS; i++) {
    const s0 = sMin + (sMax - sMin) * (i / nS);
    const s1 = sMin + (sMax - sMin) * ((i + 1) / nS);
    const a = posR(T, s0, rBord + 1.4 * sens), b = posR(T, s1, rBord + 1.4 * sens);
    const teinte = srgb(THREE, th.panels[i % th.panels.length]);
    const base = mp.length / 3;
    mp.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], 1.05, a[0], a[1], 1.05);
    for (let k = 0; k < 4; k++) { mn.push(0, -sens, 0); mc.push(teinte.r, teinte.g, teinte.b); }
    mi.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  murG.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  murG.setAttribute('normal', new THREE.Float32BufferAttribute(mn, 3));
  murG.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3));
  murG.setIndex(mi);
  groupe.add(new THREE.Mesh(murG, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.6, metalness: 0,
  })));

  // LE PUBLIC. Un corps, une tete, et quinze mille exemplaires.
  const corps = new THREE.CapsuleGeometry(0.19, 0.42, 6, 12);
  const tete = new THREE.SphereGeometry(0.13, 12, 10);
  tete.translate(0, 0.42, 0);
  const merge = fusionner(THREE, [corps, tete]);
  merge.rotateX(Math.PI / 2);          // debout dans un monde en Z

  const total = o.foule == null ? 15000 : o.foule;
  const inst = new THREE.InstancedMesh(merge,
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), total);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(),
        P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  // Des teintes de VETEMENT. Le premier essai tirait dans un nuancier de
  // bonbons, et quinze mille bonbons empiles font une tribune en plastique :
  // dans une foule reelle, l'ecrasante majorite des gens porte du sombre, du
  // neutre ou du delave, et les couleurs franches sont l'exception qui se
  // remarque justement parce qu'elle est rare.
  const teintes = [
    [46, 48, 58], [62, 58, 56], [88, 92, 104], [38, 44, 62], [120, 116, 110],
    [172, 168, 160], [206, 202, 194], [74, 70, 82], [54, 62, 74], [98, 88, 82],
    th.crowdHi, th.crowdLo,
    [172, 62, 58], [56, 96, 158], [206, 172, 78], [72, 132, 96],
  ];
  let seed = 7777;
  const al = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let n = 0; n < total; n++) {
    const t = (al() * rangs) | 0;
    const r = depart + t * prof + 0.25 + al() * 0.3;
    const s = sMin + (sMax - sMin) * al();
    const p = posR(T, s, r);
    P.set(p[0], p[1], 0.9 + t * haut + 0.42);
    Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), al() * 0.6 - 0.3);
    const e = 0.82 + al() * 0.2;
    S.set(e, e, e);
    M.compose(P, Q, S);
    inst.setMatrixAt(n, M);
    const c = teintes[(al() * teintes.length) | 0];
    inst.setColorAt(n, srgb(THREE, c, 0.8 + al() * 0.4));
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.frustumCulled = false;
  groupe.add(inst);
  return inst;
}

/** Fusion de geometries non indexees, sans dependre d'un module d'exemples. */
function fusionner(THREE, liste) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of liste) {
    const gp = g.attributes.position.array, gn = g.attributes.normal.array;
    for (let i = 0; i < gp.length; i++) pos.push(gp[i]);
    for (let i = 0; i < gn.length; i++) nor.push(gn[i]);
    const gi = g.index ? g.index.array : null;
    if (gi) for (let i = 0; i < gi.length; i++) idx.push(gi[i] + base);
    else for (let i = 0; i < gp.length / 3; i++) idx.push(i + base);
    base += gp.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

/** Les blocs de depart, un par couloir, dans l'axe de leur couloir. */
function blocs(THREE, T, groupe) {
  const C = K().C;
  // Du materiel, pas du decor : un cadre sombre, des cales caoutchoutees, et
  // juste assez de metal pour accrocher la lumiere. Le premier essai les
  // peignait en gris clair — vues d'en haut, elles devenaient deux feuilles de
  // papier posees sur la piste.
  const cadre = new THREE.MeshStandardMaterial({
    color: srgb(THREE, [38, 40, 48]), roughness: 0.38, metalness: 0.75 });
  const cale = new THREE.MeshStandardMaterial({
    color: srgb(THREE, [26, 28, 34]), roughness: 0.85, metalness: 0.05 });
  const vif = new THREE.MeshStandardMaterial({
    color: srgb(THREE, [212, 90, 42]), roughness: 0.5, metalness: 0.1 });
  const bord = (e) => T.curved ? T.edge(e) : e * C.LANE_W;
  for (let e = 0; e < C.LANE_COUNT; e++) {
    const rc = (bord(e) + bord(e + 1)) / 2;
    const p0 = posR(T, 0, rc), p1 = posR(T, 1, rc);
    const g = new THREE.Group();
    g.position.set(p0[0], p0[1], 0);
    g.rotation.z = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.10, 0.055), cadre);
    rail.position.set(-0.70, 0, 0.028);
    rail.castShadow = true; g.add(rail);
    // Les deux pieds d'ancrage, a l'avant du rail.
    const ancre = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.34, 0.04), cadre);
    ancre.position.set(-0.12, 0, 0.02); ancre.castShadow = true; g.add(ancre);

    // LES CALES. Une plaque inclinee a cinquante degres, portee par une
    // equerre. L'arriere est plus haute et plus reculee que l'avant : c'est la
    // position reelle d'un depart de sprint, et c'est aussi ce qui empeche les
    // deux de se lire comme un seul bloc.
    for (const [d, h, inc] of [[-0.40, 0.19, -0.92], [-0.80, 0.26, -0.86]]) {
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.045), cale);
      plaque.position.set(d, 0, h);
      plaque.rotation.y = inc;
      plaque.castShadow = true; g.add(plaque);
      // Un liseret de couleur sur le chant : c'est ce qu'on voit d'un bloc sur
      // une photographie de depart, et c'est ce qui lui donne son echelle.
      const liseret = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.37, 0.05), vif);
      liseret.position.set(d + Math.sin(-inc) * 0.13, 0, h + Math.cos(inc) * 0.13);
      liseret.rotation.y = inc;
      g.add(liseret);
      // L'equerre qui tient la plaque au rail.
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, h * 1.5), cadre);
      pied.position.set(d + 0.07, 0, h * 0.72);
      pied.castShadow = true; g.add(pied);
    }
    groupe.add(g);
  }
}

/** Les deux poteaux d'arrivee, et la camera de photo finish. */
function poteaux(THREE, T, groupe, rIn, rOut) {
  const blanc = new THREE.MeshStandardMaterial({
    color: srgb(THREE, [246, 248, 252]), roughness: 0.55 });
  const noir = new THREE.MeshStandardMaterial({
    color: srgb(THREE, [26, 28, 36]), roughness: 0.4, metalness: 0.4 });
  for (const [rr, cam] of [[rIn - 0.9, true], [rOut + 1.1, false]]) {
    const p = posR(T, T.total, rr);
    const g = new THREE.Group();
    g.position.set(p[0], p[1], 0);
    const fut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.32, 20), blanc);
    fut.rotation.x = Math.PI / 2; fut.position.z = 0.66; fut.castShadow = true;
    g.add(fut);
    const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.2, 20), noir);
    bande.rotation.x = Math.PI / 2; bande.position.z = 0.95; g.add(bande);
    if (cam) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.24), noir);
      box.position.set(0, 0.1, 1.44); box.castShadow = true; g.add(box);
      const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 16), noir);
      obj.rotation.x = Math.PI / 2; obj.position.set(0, 0.24, 1.44); g.add(obj);
    }
    groupe.add(g);
  }
}

/**
 * Le ciel : un degrade, et rien de plus.
 *
 * Une sphere renversee plutot qu'une couleur de fond, parce qu'un degrade
 * vertical fait la moitie du travail d'un ciel — l'horizon est toujours plus
 * clair que le zenith, et c'est a cela qu'on lit la hauteur d'une image.
 */
function ciel(THREE, th, scene) {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = N;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, N);
  g.addColorStop(0, css(th.skyTop));
  g.addColorStop(0.62, css(th.skyBot));
  g.addColorStop(1, css(th.lointain || th.skyBot, 1.06));
  c.fillStyle = g; c.fillRect(0, 0, 4, N);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 24),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false }));
  dome.rotation.x = Math.PI / 2;
  scene.add(dome);
  return dome;
}

/**
 * Le stade entier, bati une fois.
 */
export function construireStade(THREE, scene, T, th) {
  const C = K().C;
  const [rIn, rOut] = bordsPiste(T);
  const sMin = -32, sMax = T.total + 46;
  const groupe = new THREE.Group();

  // La piste.
  const matPiste = new THREE.MeshStandardMaterial({
    map: texturePiste(THREE, T, th, sMin, sMax, rIn, rOut),
    roughness: 0.93, metalness: 0,
  });
  groupe.add(nappeSol(THREE, T, sMin, sMax, rIn, rOut, 1.5, 0.4, matPiste, true));

  // La pelouse du dedans et celle du dehors.
  const matGazon = new THREE.MeshStandardMaterial({
    map: textureGazon(THREE, th), roughness: 0.96, metalness: 0,
  });
  const rFond = rIn - 58;
  groupe.add(nappeSol(THREE, T, sMin, sMax, rFond, rIn, 6, 6, matGazon, false));
  groupe.add(nappeSol(THREE, T, sMin, sMax, rOut, rOut + 3.4, 4, 1.2, matGazon, false));

  // DEUX TRIBUNES, PAS UNE. Avec la seule tribune du dehors, l'autre moitie de
  // l'image etait un pre vert qui s'arretait sur une ligne d'horizon nette :
  // un terrain d'entrainement, pas un stade. Celle d'en face ferme le cadre
  // exactement comme le fait la ligne droite opposee d'un vrai anneau — et
  // c'est elle qu'on voit derriere les coureurs sur toutes les images de
  // television.
  tribunes(THREE, T, th, sMin, sMax, rOut, groupe, { sens: 1, foule: 15000 });
  tribunes(THREE, T, th, sMin, sMax, rFond, groupe,
           { sens: -1, rangs: 16, foule: 9000 });
  blocs(THREE, T, groupe);
  poteaux(THREE, T, groupe, rIn, rOut);
  ciel(THREE, th, scene);

  scene.add(groupe);
  return { groupe, rIn, rOut, sMin, sMax };
}
