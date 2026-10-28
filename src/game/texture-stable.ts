// UNE TEXTURE QUI N'EST JAMAIS NOIRE (27/10/2026).
//
// « La piste est noire a l'ouverture de la partie avant de prendre ses couleurs ; elle doit etre stable des
// l'ouverture » (l'auteur, 27/10). Une texture de TextureLoader.load() n'a pas d'image tant que le fichier
// n'est pas arrive : la matiere qui la lit sort NOIRE pendant ce temps (le tartan de 0,5 a 0,7 Mo de la salle
// et d'Amsalem), et la lumiere cuite de la salle n'arrivait qu'apres, en changeant la matiere en cours de route.
//
// Ici, des la premiere image, la texture lit une toile AUX DIMENSIONS DU FICHIER, peinte de sa teinte moyenne
// (mesuree sur le fichier, zones utiles seulement) ; quand le fichier arrive, il est peint dans cette meme toile.
// Meme taille : three garde son allocation (texStorage2D est a dimensions fixes — changer d'image pour une autre
// taille la casserait), aucune matiere ne change. Une toile par fichier, partagee (THREE.Source) par toutes les
// textures qui le lisent : la course suivante l'a deja.

import * as THREE from 'three';

type Fichier = { moy: [number, number, number]; l: number; h: number };
/** Les fichiers de piste et de lumiere : teinte moyenne (octets du fichier) et dimensions, mesurees le 27/10. */
export const FICHIERS = {
  'modeles/salle/textures/tartan.jpg': { moy: [208, 208, 208], l: 1024, h: 1024 },
  'modeles/salle/textures/tartan-relief.jpg': { moy: [127, 128, 239], l: 1024, h: 1024 },
  'modeles/salle/textures/tartan-rugosite.jpg': { moy: [194, 194, 194], l: 1024, h: 1024 },
  'modeles/salle/textures/bois-chene.jpg': { moy: [162, 117, 84], l: 1024, h: 1024 },
  'modeles/salle/textures/bois-chene-relief.jpg': { moy: [128, 127, 255], l: 1024, h: 1024 },
  'modeles/salle/textures/bardage.jpg': { moy: [142, 142, 142], l: 1024, h: 1024 },
  'modeles/salle/textures/bardage-relief.jpg': { moy: [128, 128, 244], l: 1024, h: 1024 },
  'modeles/salle/lumiere-coque.jpg': { moy: [124, 123, 125], l: 2048, h: 2048 },
  'modeles/salle/lumiere-sol.jpg': { moy: [166, 162, 156], l: 2048, h: 1316 },
  'modeles/salle/lumiere-coque-nuit.jpg': { moy: [110, 108, 110], l: 2048, h: 2048 },
  'modeles/salle/lumiere-sol-nuit.jpg': { moy: [152, 146, 141], l: 2048, h: 1316 },
} satisfies Record<string, Fichier>;
export type NomStable = keyof typeof FICHIERS;

const sources = new Map<string, THREE.Source>();

/** La texture du fichier `nom` (sous `base`) : sa teinte moyenne tout de suite, son image des qu'elle arrive. */
export function textureStable(base: string, nom: NomStable): THREE.Texture {
  let source = sources.get(nom);
  if (!source) {
    const f: Fichier = FICHIERS[nom];
    const toile = document.createElement('canvas'); toile.width = f.l; toile.height = f.h;
    const c = toile.getContext('2d')!;
    c.fillStyle = `rgb(${f.moy[0]},${f.moy[1]},${f.moy[2]})`; c.fillRect(0, 0, f.l, f.h);
    const s = new THREE.Source(toile);
    source = s;
    sources.set(nom, s);
    // (un fichier absent : la teinte moyenne reste, la course aussi)
    new THREE.ImageLoader().loadAsync(base + nom).then(img => { c.drawImage(img, 0, 0, f.l, f.h); s.needsUpdate = true; }, () => {});
  }
  const t = new THREE.Texture();
  t.source = source;
  t.needsUpdate = true;
  return t;
}
