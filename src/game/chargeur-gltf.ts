// LE CHARGEUR GLB COMMUN : Meshopt (geometrie) + KTX2/Basis (textures compressees du GPU).
// Un seul KTX2Loader pour tout le jeu (ses workers de transcodage sont partages).
// Chaque moteur appelle brancherKTX2(rendu) des qu'il a son WebGLRenderer : le transcodeur
// doit savoir quels formats le GPU lit (ASTC, ETC, BC...) avant le premier GLB en KTX2.
// Les decodeurs Basis sont servis depuis public/basis/ (copies de three/examples/jsm/libs/basis).
import type { WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const ktx2 = new KTX2Loader().setTranscoderPath(((import.meta as any).env?.BASE_URL || '/') + 'basis/');
let detecte = false;

export function brancherKTX2(rendu: WebGLRenderer): void {
  if (detecte) return; // meme appareil, meme GPU : la premiere detection vaut pour tous les moteurs
  ktx2.detectSupport(rendu);
  detecte = true;
}

export function chargeurGLTF(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
}
