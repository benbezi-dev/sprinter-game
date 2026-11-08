// LA SILHOUETTE D'UN SPRINTEUR (08/11). L'auteur, sur les coureurs Rocketbox : « son torse est trop large, son ventre
// trop gros, ce n'est pas la morphologie d'un athlete type sprint », « pareil pour la femme ».
//
// Le corps est affine AU CHARGEMENT, sur la pose de repos des morceaux de `Coureur` (position, avant le squelette : devant
// vers +x, le haut vers +y, la largeur sur z, en metres depuis le sol — les reperes de course-3d.ts) plutot que dans
// le .glb : le fichier sort de deux scripts Blender a la suite (rocketbox_coureur.py, puis les pointes), et le refaire
// risquait de perdre l'un des deux. Chaque sommet bouge en proportion du poids que lui donnent les os du tronc (ou des
// cuisses) : les bras, la tete et le bas des jambes ne bougent pas, la tenue (zones du meme maillage) suit la peau.

const TRONC = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03']);
const CUISSES = new Set(['thigh_l', 'thigh_r']);

/** Une bosse douce : 1 en c, 0 a plus de r. */
const bosse = (h: number, c: number, r: number) => { const t = (h - c) / r; return t >= 1 || t <= -1 ? 0 : (1 - t * t) ** 2; };

/** Les retouches, en part de ce qui depasse de l'axe du corps (0,14 = 14 % plus etroit au centre de la bosse). */
const REGLAGES = {
  homme: { ventre: 0.50, taille: 0.22, torse: 0.10, hanches: 0.06, cuisses: 0 },
  femme: { ventre: 0.42, taille: 0.17, torse: 0.05, hanches: 0.14, cuisses: 0.14 },
};

export function affinerLaSilhouette(scene: any, genre: 'homme' | 'femme') {
  const R = REGLAGES[genre];
  // `Coureur` arrive en un morceau par matiere (peau, debardeur, short...) : tous ensemble, pour un seul axe
  const morceaux: any[] = [];
  scene.traverse((o: any) => {
    if (o.isSkinnedMesh && o.parent && o.parent.name === 'Coureur' && !o.geometry.userData.silhouette) morceaux.push(o);
  });
  const poids = morceaux.map((o: any) => {
    const g = o.geometry, I = g.attributes.skinIndex, W = g.attributes.skinWeight, n = g.attributes.position.count;
    const os = o.skeleton.bones.map((b: any) => b.name), tronc = new Float32Array(n), cuisse = new Float32Array(n);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 4; k++) {
        const nom = os[I.getComponent(i, k)], w = W.getComponent(i, k);
        if (TRONC.has(nom)) tronc[i] += w; else if (CUISSES.has(nom)) cuisse[i] += w;
      }
    return { tronc, cuisse };
  });
  // l'axe avant-arriere du tronc, par tranche de 2 cm : le milieu entre le dos et le ventre (sur la peau)
  const TR = 0.02, mini = new Map<number, number>(), maxi = new Map<number, number>();
  morceaux.forEach((o: any, m: number) => {
    if (!/peau/.test(o.material && o.material.name)) return;
    const P = o.geometry.attributes.position, { tronc } = poids[m];
    for (let i = 0; i < P.count; i++) if (tronc[i] > 0.5) {
      const t = Math.round(P.getY(i) / TR), x = P.getX(i);
      mini.set(t, Math.min(mini.get(t) ?? x, x)); maxi.set(t, Math.max(maxi.get(t) ?? x, x));
    }
  });
  morceaux.forEach((o: any, m: number) => {
    const g = o.geometry, P = g.attributes.position, { tronc, cuisse } = poids[m];
    for (let i = 0; i < P.count; i++) {
      const h = P.getY(i);
      if (tronc[i] > 0) {
        const w = Math.min(1, tronc[i]), t = Math.round(h / TR);
        const x0 = mini.has(t) ? (mini.get(t)! + maxi.get(t)!) / 2 : P.getX(i);
        const x = P.getX(i);
        // le ventre rentre (le devant seulement : le dos et les fessiers restent)
        if (x > x0) P.setX(i, x0 + (x - x0) * (1 - R.ventre * w * bosse(h, 1.0, 0.16)));
        // la taille et le torse s'affinent sur les cotes ; les hanches aussi
        const k = R.taille * bosse(h, 1.04, 0.14) + R.torse * bosse(h, 1.26, 0.14) + R.hanches * bosse(h, 0.86, 0.10);
        P.setZ(i, P.getZ(i) * (1 - k * w));
      } else if (cuisse[i] > 0 && R.cuisses) {
        // l'exterieur de la cuisse seulement, vers l'axe de la jambe : l'entrejambe ne bouge pas
        const z = P.getZ(i), c = Math.sign(z) * 0.09;
        if (Math.abs(z) > Math.abs(c)) P.setZ(i, c + (z - c) * (1 - R.cuisses * Math.min(1, cuisse[i]) * bosse(h, 0.72, 0.18)));
      }
    }
    P.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData.silhouette = true;
  });
  return scene;
}
