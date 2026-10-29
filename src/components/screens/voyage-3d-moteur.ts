// LE MOTEUR 3D DES CINEMATIQUES DE LA LEGENDE (23/10) — un seul WebGLRenderer, hors ecran,
// dont l'image se pose sur la toile 2D de la cinematique (voir LegendeCinematiques.tsx,
// « LES VOYAGES EN 3D », et LegendeKarman.tsx). Sans WebGL, ou avec ?rendu=2d, rien : la
// cinematique reste celle d'avant.

import * as THREE from 'three';

const TELEPHONE = (() => {
  try { return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch { return false; }
})();

let moteurVoyage: { r: THREE.WebGLRenderer; cv: HTMLCanvasElement } | null | false = null;
export function moteur3D() {
  if (moteurVoyage === null) {
    try {
      if (/[?&]rendu=2d/.test(location.search)) throw new Error('2d');
      const cv = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' });
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      moteurVoyage = { r, cv };
    } catch { moteurVoyage = false; }
  }
  return moteurVoyage || null;
}
/** Rend `scene` a la taille de l'ecran et la pose sur la toile 2D. */
export function poserLaScene(ctx: CanvasRenderingContext2D, scene: THREE.Scene, cam: THREE.PerspectiveCamera, W: number, H: number) {
  const m = moteur3D();
  if (!m) return;
  // un pixel et demi par point sur un telephone : a deux, un ecran de 2640 px de haut faisait
  // repeindre et recopier pres de six millions de pixels a chaque image (Galaxy Flip, 23/10)
  const dpr = Math.min(TELEPHONE ? 1.5 : 2, window.devicePixelRatio || 1), w = Math.round(W * dpr), h = Math.round(H * dpr);
  if (m.cv.width !== w || m.cv.height !== h) m.r.setSize(w, h, false);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  m.r.render(scene, cam);
  ctx.drawImage(m.cv, 0, 0, W, H);
}
export const texture3D = (im: CanvasImageSource) => {
  const t = im instanceof HTMLCanvasElement ? new THREE.CanvasTexture(im) : new THREE.Texture(im as HTMLImageElement);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  return t;
};
/** Une decoupe debout face a la camera (x-z), le pied (ax, ay) a l'origine, `larg` metres de large. */
export function panneau(im: CanvasImageSource, w: number, h: number, ax: number, ay: number, larg: number, brume = true) {
  const haut = larg * h / w;
  const g = new THREE.PlaneGeometry(larg, haut).rotateX(Math.PI / 2).translate((0.5 - ax / w) * larg, 0, (ay / h - 0.5) * haut);
  const mat = new THREE.MeshBasicMaterial({ map: texture3D(im), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, fog: brume, depthWrite: true });
  return new THREE.Mesh(g, mat);
}
export const FOV_VOYAGE = 40;
