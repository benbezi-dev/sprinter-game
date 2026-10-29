// LES CORPS MAKEHUMAN DES GENS DU JEU (26/10/2026) — la ville et les mini-jeux.
//
// L'auteur : « pourquoi je ne peux pas avoir un personnage aussi abouti ? », puis « fais
// de ce prototype les corps du jeu », « propose des noirs, des blancs, des asiatiques, des
// indiens », « prends les nouveaux assets pour les mini-jeux ».
//
// tools/blender/corps_mpfb.py fait un fichier par corps (femme, homme) et par SILHOUETTE
// (ce que couvre la tenue : debardeur et short, t-shirt et pantalon...). Chaque fichier :
//  - une texture ou les pieces a teindre sont grises (moyenne GRIS) : la tenue de
//    garde-robe.ts, la peau et les cheveux du look en donnent la couleur ;
//  - la zone de chaque sommet dans sa deuxieme carte UV (peau, haut, bas, chaussures,
//    cheveux, fixe : yeux, cils, sourcils) ;
//  - deux cles de forme, « europe » et « asie », sur un corps de base africain : chaque
//    origine est un dosage (indien, maghrebin, metis...).

import * as THREE from 'three';

export const ORIGINES = ['afrique', 'europe', 'asie', 'inde', 'maghreb', 'metis'] as const;
export type Origine = typeof ORIGINES[number];
export const NOMS_ORIGINES: Record<Origine, [string, string]> = {
  afrique: ['Afrique', 'Africa'], europe: ['Europe', 'Europe'], asie: ['Asie', 'East Asia'],
  inde: ['Inde', 'South Asia'], maghreb: ['Maghreb', 'North Africa'], metis: ['Métis', 'Mixed'],
};
const DOSAGE: Record<Origine, Record<string, number>> = {
  afrique: {}, europe: { europe: 1 }, asie: { asie: 1 },
  inde: { europe: 0.6, asie: 0.15 }, maghreb: { europe: 0.75 }, metis: { europe: 0.5 },
};

/** Une origine pour quelqu'un dont on ne connait que le nom et la peau : vraisemblable pour sa peau. */
export function origineDe(nom: string, peau: number[] | undefined): Origine {
  const p = peau || [180, 130, 100];
  const lum = (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
  let h = 11; for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const l: Origine[] = lum < 0.33 ? ['afrique', 'afrique', 'afrique', 'metis']
    : lum < 0.55 ? ['metis', 'inde', 'maghreb', 'afrique', 'inde']
    : ['europe', 'europe', 'asie', 'maghreb', 'asie', 'inde'];
  return l[h % l.length];
}

const GRIS = 0.6; // corps_mpfb.py, le gris moyen d'une piece teinte
const Z_PEAU = 0, Z_HAUT = 1, Z_BAS = 2, Z_CHAUSSURES = 3, Z_CHEVEUX = 4;
const SANS_CHEVEUX = new Set(['ras', 'shaved']);

function silhouetteDe(look: any): string {
  const t = look && look.tenue, c = (t && t.couvre) || {};
  if (look && look.build === 'f' && c.short === 'haut') return 'robe';
  if (c.avantbras) return 'pull-pantalon';
  if (!c.manches) return 'debardeur-short';
  return c.mollets ? 'tshirt-pantalon' : 'tshirt-short';
}
// LES CORPS ROCKETBOX (29/10, l'auteur : « change ces assets, ils sont moches », « les hommes ont des seins ») : la
// carriere prend les coureurs de la course 3D (tools/blender/rocketbox_coureur.py), une matiere par zone (Coureur_*)
// au lieu de la carte des zones MakeHuman. Ils sont en tenue de sport : la tenue de garde-robe.ts en donne les
// couleurs (haut, bas, chaussures) ; l'origine ne se voit plus qu'a la peau. silhouetteDe reste pour les fichiers
// MakeHuman (public/modeles/gens), que rien ne charge plus.
/** Le fichier du corps de ce look (public/). */
export const cheminDe = (look: any) => `modeles/coureur-${look && look.build === 'f' ? 'femme' : 'homme'}.glb`;
void silhouetteDe;

export type Teinte = { teintes: { value: THREE.Color[] }; sansCheveux: { value: number };
  /** Un coureur Rocketbox : ses matieres, par zone (le nom de la matiere sans « Coureur_ »). */
  zones?: [string, THREE.MeshStandardMaterial][] };

const VETEMENTS = new Set(['debardeur', 'shortlarge', 'brassiere', 'dossard']);
/** La couleur d'une zone du coureur Rocketbox d'apres le look (course-3d.ts teint le meme corps en course). */
function teindreLeCoureur(zones: [string, THREE.MeshStandardMaterial][], L: any) {
  const t = L.tenue, sport = !t || t.moment === 'competition';
  const rgb = (v: number[] | undefined, d: number[]) => { const a = v || d; return new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace); };
  const peau = rgb(L.skin, [180, 130, 100]);
  const haut = rgb(t ? (sport && L.jersey ? L.jersey : t.haut) : L.jersey, [200, 40, 50]);
  const bas = rgb(t ? t.bas : L.shorts, [30, 30, 40]), pied = rgb(t ? t.chaussures : L.shoe, [240, 240, 240]);
  const clair = (pied.r + pied.g + pied.b) / 3 > 0.45;
  for (const [z, m] of zones) {
    if (z === 'peau' || z === 'pointes') m.color.copy(peau);
    else if (z === 'maillot' || z === 'debardeur' || z === 'ventre') m.color.copy(haut);
    else if (z === 'short' || z === 'shortbas' || z === 'shortlarge') m.color.copy(bas);
    else if (z === 'chaussure' || z === 'talon' || z === 'plaque') m.color.copy(pied);
    else if (z === 'lacets') m.color.setRGB(...((clair ? [0.08, 0.08, 0.09] : [0.93, 0.93, 0.92]) as [number, number, number]), THREE.SRGBColorSpace);
    else if (z === 'semelle') m.color.setRGB(0.93, 0.93, 0.91, THREE.SRGBColorSpace);
    else if (z === 'clous') m.color.setRGB(0.82, 0.82, 0.85, THREE.SRGBColorSpace);
    else if (z === 'cheveux') { m.color.copy(rgb(L.hairCol, [20, 16, 14])); m.visible = !SANS_CHEVEUX.has(L.hair); }
    // pas de brassiere en ville ; le dossard ne se porte qu'en competition
    if (z === 'brassiere') m.visible = false;
    if (z === 'dossard') m.visible = !!(t && t.moment === 'competition');
  }
}

/** La couleur de chaque zone, et l'origine (les cles de forme), d'apres le look. */
export function teindre(T: Teinte, racine: THREE.Object3D, L: any) {
  if (!L) return;
  if (T.zones) { teindreLeCoureur(T.zones, L); return; }
  // la texture des pieces teintes est grise a GRIS : la couleur voulue s'obtient en multipliant par c / GRIS
  const rgb = (c: THREE.Color, v: number[] | undefined, d: number[]) => { const a = v || d; c.setRGB(a[0] / 255 / GRIS, a[1] / 255 / GRIS, a[2] / 255 / GRIS, THREE.SRGBColorSpace); };
  const z = T.teintes.value, peau = L.skin || [180, 130, 100];
  rgb(z[Z_PEAU], peau, peau);
  const t = L.tenue;
  rgb(z[Z_HAUT], t ? (t.moment === 'competition' && L.jersey ? L.jersey : t.haut) : L.jersey, [200, 40, 50]);
  rgb(z[Z_BAS], t ? t.bas : L.shorts, [30, 30, 40]);
  rgb(z[Z_CHAUSSURES], t ? t.chaussures : L.shoe, [240, 240, 240]);
  rgb(z[Z_CHEVEUX], L.hairCol, [20, 16, 14]);
  T.sansCheveux.value = SANS_CHEVEUX.has(L.hair) ? 1 : 0;
  const dose = DOSAGE[(L.origine as Origine)] || DOSAGE[origineDe('', peau)];
  racine.traverse((o: any) => {
    if (!o.morphTargetInfluences || !o.morphTargetDictionary) return;
    for (const [nom, i] of Object.entries(o.morphTargetDictionary as Record<string, number>)) o.morphTargetInfluences[i] = dose[nom] || 0;
  });
}

/**
 * Donner a chaque maillage de `racine` (un clone du fichier) la matiere des zones, puis la teindre.
 * Rend les reglages de cette matiere : `teindre` les change ensuite sans recompiler.
 */
export function habiller(racine: THREE.Object3D, look: any): Teinte {
  const T: Teinte = { teintes: { value: Array.from({ length: 6 }, () => new THREE.Color(1, 1, 1)) }, sansCheveux: { value: 0 } };
  // le coureur Rocketbox : une matiere neuve par zone, que teindreLeCoureur colore (le logo garde sa texture)
  racine.traverse((o: any) => {
    if (!o.isMesh || !String(o.material?.name || '').startsWith('Coureur_')) return;
    const z = o.material.name.replace('Coureur_', '');
    const mat = new THREE.MeshStandardMaterial({ roughness: z === 'peau' ? 0.55 : 0.7, metalness: z === 'clous' ? 0.9 : 0, side: THREE.DoubleSide,
      ...(z === 'logo' ? { map: o.material.map, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } : {}),
      // les vetements poses sur le corps passent devant lui (sinon la peau perce a l'encolure dans l'apercu)
      ...(VETEMENTS.has(z) ? { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 } : {}) });
    // et s'ecartent de 6 mm de la peau : le corps traversait le debardeur a l'encolure (points de peau)
    if (VETEMENTS.has(z)) mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * 0.006;'); };
    (T.zones ||= []).push([z, mat]);
    mat.name = o.material.name; o.material = mat; o.frustumCulled = false; o.castShadow = true;
  });
  if (T.zones) { teindre(T, racine, look); return T; }
  racine.traverse((o: any) => {
    if (!o.isMesh) return;
    const g = o.geometry as THREE.BufferGeometry;
    if (!g.getAttribute('zone')) {
      const uv1 = g.getAttribute('uv1');
      const z = new Float32Array(g.getAttribute('position').count);
      if (uv1) for (let i = 0; i < z.length; i++) z[i] = uv1.getX(i);
      g.setAttribute('zone', new THREE.BufferAttribute(z, 1));
    }
    o.frustumCulled = false; o.castShadow = true;
    const mat = new THREE.MeshStandardMaterial({ map: (o.material && o.material.map) || null, alphaTest: 0.5, roughness: 0.7, metalness: 0 });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, T);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float zone;\nvarying float vZone;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZone = zone;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 teintes[6];\nuniform float sansCheveux;\nvarying float vZone;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        int zi = int(vZone + 0.5);
        if (zi == ${Z_CHEVEUX} && sansCheveux > 0.5) discard;
        diffuseColor.rgb *= teintes[zi];`);
    };
    o.material = mat;
  });
  teindre(T, racine, look);
  return T;
}
