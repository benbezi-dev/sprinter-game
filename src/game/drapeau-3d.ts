// LES DRAPEAUX FLOTTENT (« les drapeaux sont raides, figes, pas de mouvement », l'auteur, 24/10).
// Ils etaient des plaques rigides : immobiles sur la facade, pivotant d'un bloc a 0.Games. La toile
// ondule desormais dans le shader : une vague qui part du mat (uv.x = 0) et grandit vers le bout
// libre, le long de la normale de la plaque, avec un leger frisson en hauteur. Chaque drapeau a son
// decalage, tire de sa place dans le monde : aucun ne bat en meme temps que son voisin.
import * as THREE from 'three';

/** Le temps du vent, partage par tous les drapeaux (course-3d.ts le pose a chaque image). */
export const uVent = { value: 0 };

/** Une toile assez decoupee pour onduler : `l` le long du vent, `h` en hauteur. */
export function toileDeDrapeau(l: number, h: number) {
  return new THREE.PlaneGeometry(l, h, 14, 4);
}

/** Fait flotter les drapeaux de ce materiau (un materiau Lambert ou Basic, mat a uv.x = 0). */
export function flotter<M extends THREE.Material>(mat: M, ampleur = 0.22): M {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uVent = uVent;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uVent;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = dot(modelMatrix[3].xy, vec2(0.37, 0.23));
float libre = uv.x * uv.x;
float vague = sin(uVent * 4.2 - uv.x * 7.0 + ph) + 0.35 * sin(uVent * 7.3 - uv.x * 13.0 + uv.y * 4.0 + ph * 1.7);
transformed += normal * (${ampleur.toFixed(3)} * libre * vague);`);
  };
  mat.customProgramCacheKey = () => 'drapeau' + ampleur;
  return mat;
}
