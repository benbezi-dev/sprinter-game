// LA COURSE EN VRAIE 3D — la foule, en cartes (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { refaireLeStade } from './stade';

// --- LE PUBLIC, EN CARTES -----------------------------------------------------
//
// Quinze mille spectateurs ne se modelisent pas : un corps fait douze mille faces.
// Chacun est donc une CARTE — deux triangles —, rendue dans Blender depuis de vrais
// corps (tools/blender/public_cartes.py : Quaternius CC0, homme et femme, trois
// coiffures, quatre gestes, cinq angles). Le shader la tourne vers la camera, prend
// l'angle rendu le plus proche et la teint : la case porte sa passe (peau, maillot,
// cheveux, pantalon, siege, chaussures) en rouge et sa lumiere en vert, et chaque
// spectateur a ses couleurs. Une seule texture, un seul appel de dessin.
//
// LA FOULE VIT. Elle se leve et saute au passage du joueur, et tout le stade se
// leve apres l'arrivee (uLiesse) ; ceux qui applaudissent sautillent.
export const P_SIL = 6, P_GESTES = 5, P_ANGLES = 5, CARTE_L = 1.1, CARTE_H = 2.2;
export let atlasPublic: THREE.Texture | null = null, publicDemande = false;
// le public de la plage : memes corps, sans siege de stade (public_cartes.py --plage)
export let atlasPlage: THREE.Texture | null = null, plageDemandee = false;
export const uFoule = {
  uAtlas: { value: null as THREE.Texture | null }, uCam: { value: new THREE.Vector3() },
  uT: { value: 0 }, uJoueur: { value: new THREE.Vector2(1e4, 1e4) }, uLiesse: { value: 0 },
  uSiege: { value: new THREE.Color(0x2457b8) }, uLum: { value: 1 },
};
export function chargerLaPlage() {
  if (plageDemandee) return;
  plageDemandee = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  new THREE.TextureLoader().loadAsync(base + 'modeles/stades/public-plage-cartes.png').then(t => {
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    atlasPlage = t;
    refaireLeStade();
  }).catch(() => { /* une plage sans public */ });
}
export function chargerLePublic() {
  if (publicDemande) return;
  publicDemande = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  new THREE.TextureLoader().loadAsync(base + 'modeles/stades/public-cartes.png').then(t => {
    // au plus proche, sans mipmaps : une passe melangee a sa voisine n'existe pas
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    atlasPublic = uFoule.uAtlas.value = t;
    refaireLeStade();   // le stade se refait, peuple
  }).catch(() => { /* gradins vides */ });
}
/** La foule : `cartes` = par spectateur x, y, z, cap, variante, phase, puis quatre couleurs. */
export function laFoule(cartes: number[]) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(cartes), 18);
  const at = (n: string, taille: number, decal: number) => g.setAttribute(n, new THREE.InterleavedBufferAttribute(ib, taille, decal));
  at('aPos', 3, 0); at('aFace', 1, 3); at('aVar', 1, 4); at('aPh', 1, 5);
  at('aC1', 3, 6); at('aC2', 3, 9); at('aC3', 3, 12); at('aC4', 3, 15);
  g.instanceCount = cartes.length / 18;
  // LE PUBLIC SANS CRENELAGE (« extremement important, je ne veux pas de crenelage », l'auteur, 24/10).
  // L'atlas se lit au plus proche (ses zones sont des codes, pas des couleurs a melanger) et la carte
  // etait decoupee au seuil : ses bords echappaient a l'anticrenelage et ses teintes scintillaient au
  // loin — le moire des gradins. Chaque pixel lit donc la carte en quatre points, decode chacun, et
  // moyenne ; la part couverte va a l'anticrenelage (alphaToCoverage), qui lisse les silhouettes.
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, alphaToCoverage: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uFoule);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aPos, aC1, aC2, aC3, aC4;
attribute float aFace, aVar, aPh;
uniform vec3 uCam; uniform float uT, uLiesse; uniform vec2 uJoueur;
varying vec2 vCase; varying vec3 vC1, vC2, vC3, vC4;`)
      .replace('#include <begin_vertex>', `
vec2 versCam = uCam.xy - aPos.xy;
float ang = atan(versCam.y, versCam.x);
float ge0 = mod(aVar, ${P_GESTES}.0);
// LES PHOTOGRAPHES SUIVENT LA COURSE : leur objectif tourne vers le joueur (« en
// mouvement, pas tout droit », l'auteur, 22/10), chacun avec son petit ecart
float face = aFace;
if (ge0 > 3.5) face = atan(uJoueur.y - aPos.y, uJoueur.x - aPos.x) + (fract(aPh * 37.1) - 0.5) * 0.5;
float rel = mod(degrees(ang - face) + 180.0, 360.0) - 180.0;
float ia = clamp(floor((rel + 60.0) / 30.0 + 0.5), 0.0, ${P_ANGLES - 1}.0);
float sil = floor(aVar / ${P_GESTES}.0), ge = mod(aVar, ${P_GESTES}.0);
// au passage du joueur, et toute entiere apres l'arrivee, la foule se leve
float h = fract(sin(aPh * 91.7) * 4375.85);
float pres = 1.0 - smoothstep(10.0, 24.0, distance(aPos.xy, uJoueur));
if (ge < 2.5 && h < max(pres * 0.8, uLiesse)) ge = h < 0.5 ? 2.0 : 1.0;
float saut = (ge > 0.5 && ge < 2.5) ? abs(sin(uT * 7.0 + aPh * 6.2832)) * 0.08 : 0.0;
vec2 droite = vec2(-sin(ang), cos(ang));
vec3 transformed = aPos + vec3(droite * position.x * ${CARTE_L}, position.y * ${CARTE_H} + saut);
vCase = vec2((sil * ${P_GESTES}.0 + ge + uv.x) / ${P_SIL * P_GESTES}.0, 1.0 - (ia + 1.0 - uv.y) / ${P_ANGLES}.0);
vC1 = aC1; vC2 = aC2; vC3 = aC3; vC4 = aC4;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uAtlas; uniform vec3 uSiege; uniform float uLum;
varying vec2 vCase; varying vec3 vC1, vC2, vC3, vC4;
vec4 carte(vec2 uv) {
  vec4 tx = texture2D(uAtlas, uv);
  float zo = floor(tx.r * 255.0 / 32.0 + 0.5);
  vec3 cz = zo < 0.5 ? vec3(0.05) : zo < 1.5 ? vC1 : zo < 2.5 ? vC2 : zo < 3.5 ? uSiege : zo < 4.5 ? vC3 : vC4;
  return vec4(cz * (0.28 + 0.9 * tx.g), step(0.5, tx.a));
}`)
      .replace('#include <map_fragment>', `
vec2 ex = dFdx(vCase), ey = dFdy(vCase);
vec4 c0 = carte(vCase - 0.125 * ex - 0.375 * ey), c1 = carte(vCase + 0.375 * ex - 0.125 * ey);
vec4 c2 = carte(vCase + 0.125 * ex + 0.375 * ey), c3 = carte(vCase - 0.375 * ex + 0.125 * ey);
float couvre = c0.a + c1.a + c2.a + c3.a;
if (couvre < 0.5) discard;
diffuseColor.rgb = (c0.rgb * c0.a + c1.rgb * c1.a + c2.rgb * c2.a + c3.rgb * c3.a) / couvre * uLum;
diffuseColor.a = couvre * 0.25;`);
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}
