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
// LES CORPS PREMIUM (13/11, course-3d/corps.ts ; 14/11 « remplace les avatars actuels du jeu par les nouveaux crees ») :
// huit athletes Tripo, peau, visage et cheveux CUITS dans la texture. Le look prend celui de son genre dont la peau est
// la plus proche ; la coiffure choisie ne s'y voit donc pas. Pas sous 4 Go de memoire ; ?anciens : les corps d'avant.
const PREMIUM: { cle: string; femme: boolean; peau: number[] }[] = [
  { cle: 'h1', femme: false, peau: [58, 38, 30] }, { cle: 'h2', femme: false, peau: [140, 92, 62] },
  { cle: 'h3', femme: false, peau: [188, 146, 108] }, { cle: 'h4', femme: false, peau: [228, 192, 168] },
  { cle: 'f1', femme: true, peau: [58, 38, 30] }, { cle: 'f2', femme: true, peau: [140, 92, 62] },
  { cle: 'f3', femme: true, peau: [188, 146, 108] }, { cle: 'f4', femme: true, peau: [228, 192, 168] },
];
export const SANS_PREMIUM = typeof navigator !== 'undefined' && (navigator as any).deviceMemory < 4
  || typeof location !== 'undefined' && /[?&]anciens/.test(location.search);
/** La cle du corps premium de ce look (h1..h4, f1..f4). */
export function premiumCle(look: any): string {
  const femme = look?.build === 'f', s = look?.skin || [150, 110, 80];
  const ecart = (p: number[]) => (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 + (p[2] - s[2]) ** 2;
  return PREMIUM.filter((p) => p.femme === femme).sort((a, b) => ecart(a.peau) - ecart(b.peau))[0].cle;
}
/** Le fichier du corps de ce look (public/). */
export const cheminDe = (look: any) => SANS_PREMIUM
  ? `modeles/coureur-${look && look.build === 'f' ? 'femme' : 'homme'}.glb`
  : `modeles/premium/${premiumCle(look)}v2.glb`;
void silhouetteDe;

export type Teinte = { teintes: { value: THREE.Color[] }; sansCheveux: { value: number };
  /** Un coureur Rocketbox : ses matieres, par zone (le nom de la matiere sans « Coureur_ »). */
  zones?: [string, THREE.MeshStandardMaterial][];
  /** Un corps premium : les reglages de sa tenue (tenueTripo). */
  tripo?: TenueTripo };

const VETEMENTS = new Set(['debardeur', 'shortlarge', 'brassiere', 'dossard']);
/** La couleur d'une zone du coureur Rocketbox d'apres le look (course-3d.ts teint le meme corps en course). */
function teindreLeCoureur(zones: [string, THREE.MeshStandardMaterial][], L: any, tripo?: TenueTripo) {
  const t = L.tenue, sport = !t || t.moment === 'competition';
  const rgb = (v: number[] | undefined, d: number[]) => { const a = v || d; return new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace); };
  const peau = rgb(L.skin, [180, 130, 100]);
  const haut = rgb(t ? (sport && L.jersey ? L.jersey : t.haut) : L.jersey, [200, 40, 50]);
  const bas = rgb(t ? t.bas : L.shorts, [30, 30, 40]), pied = rgb(t ? t.chaussures : L.shoe, [240, 240, 240]);
  const clair = (pied.r + pied.g + pied.b) / 3 > 0.45;
  if (tripo) reglerTenueTripo(tripo, haut, bas, L.build === 'f', sport && L.kit === 'vrac', null);
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
  if (T.zones) { teindreLeCoureur(T.zones, L, T.tripo); return; }
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
      ...(z === 'tripo' ? { map: o.material.map, normalMap: o.material.normalMap ?? null } : {}),
      ...(z === 'logo' ? { map: o.material.map, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } : {}),
      // les vetements poses sur le corps passent devant lui (sinon la peau perce a l'encolure dans l'apercu)
      ...(VETEMENTS.has(z) ? { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 } : {}) });
    // et s'ecartent de 6 mm de la peau : le corps traversait le debardeur a l'encolure (points de peau)
    if (VETEMENTS.has(z)) mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * 0.006;'); };
    (T.zones ||= []).push([z, mat]);
    mat.name = o.material.name; o.material = mat; o.frustumCulled = false; o.castShadow = true;
    if (z === 'tripo') T.tripo = tenueTripo(racine, mat);
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

// LA TENUE DES CORPS TRIPO PREND LES COULEURS DU COUREUR (deplace de course-3d/corps.ts le 14/11 : l'avatar, la
// carriere et la ville portent les memes corps). Leur texture porte une tenue GRISE (debardeur ou brassiere,
// cuissard) : entre les genoux et les epaules, ce qui est gris est du tissu, ce qui est colore est de la peau. Le gris
// garde ses ombres et prend la couleur du maillot au-dessus de la taille, celle du short en dessous. La hauteur est
// lue au REPOS (avant le squelette), pour que la limite ne bouge pas avec la foulee. Les couleurs sont des uniformes :
// un meme corps se reteint a chaque dessin (vedette-3d.ts) par reglerTenueTripo.
export type TenueTripo = Record<string, { value: any }>;
const textesVrac: Record<string, THREE.Texture> = {};
const VIDE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
VIDE.needsUpdate = true;
export function tenueTripo(copie: THREE.Object3D, m: THREE.MeshStandardMaterial): TenueTripo {
  // LE TISSU EST SUR LE TRONC ET LES CUISSES : les bras, les mains, la tete et les cheveux (une queue de cheval dans le
  // dos, une main sombre le long de la hanche) ne se teignent pas. Part des os du tronc dans chaque sommet, une fois par
  // geometrie (les copies d'un meme corps la partagent).
  copie.traverse((o: any) => {
    if (!o.isSkinnedMesh || o.material !== m || o.geometry.getAttribute('tronc')) return;
    const si = o.geometry.getAttribute('skinIndex'), sw = o.geometry.getAttribute('skinWeight');
    const duTronc = o.skeleton.bones.map((b: THREE.Bone) => /^(pelvis|spine_|thigh_|clavicle_)/.test(b.name));
    const t = new Float32Array(si.count);
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (duTronc[si.getComponent(i, k)]) t[i] += sw.getComponent(i, k);
    o.geometry.setAttribute('tronc', new THREE.BufferAttribute(t, 1));
  });
  const U: TenueTripo = {
    uMaillot: { value: new THREE.Color() }, uBas: { value: new THREE.Color() }, uBib: { value: new THREE.Vector3() },
    uTaille: { value: 0.96 }, uDecal: { value: 0 }, uVrac: { value: 0 },
    uDossard: { value: VIDE }, uVracFace: { value: VIDE }, uVracDos: { value: VIDE },
  };
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tronc; varying vec3 vRepos, vReposN; varying float vTronc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRepos = position; vReposN = normal; vTronc = tronc;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRepos, vReposN; varying float vTronc; uniform vec3 uMaillot, uBas, uBib; uniform float uVrac, uTaille, uDecal; uniform sampler2D uDossard, uVracFace, uVracDos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  // (le masque du tissu est dans l'alpha de la texture — tripo-vers-jeu.mjs ; sans alpha, rien n'est teint)
  float masque = 1.0 - smoothstep(0.15, 0.85, diffuseColor.a); diffuseColor.a = 1.0;
  vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b));
  float tissu = masque * smoothstep(0.50, 0.56, vRepos.y) * (1.0 - smoothstep(1.44, 1.50, vRepos.y)) * smoothstep(0.35, 0.6, vTronc);
  float haut = step(uTaille, vRepos.y), devant = step(0.0, vReposN.x);
  vec3 teinte = mix(uBas, uMaillot, haut);
  if (uVrac > 0.5 && haut > 0.5) {
    vec2 q = vec2(0.19 + (vRepos.z + 0.20) / 0.40 * 0.62, 0.109 + uDecal + (1.46 - vRepos.y) / 0.50 * 0.806);
    q = clamp(q, vec2(0.02, 0.11), vec2(0.98, 0.91));
    teinte = devant > 0.5 ? texture2D(uVracFace, vec2(q.x, 1.0 - q.y)).rgb : texture2D(uVracDos, vec2(1.0 - q.x, 1.0 - q.y)).rgb;
  }
  vec3 couleur = teinte * clamp(hi / 0.16, 0.55, 1.25);
  // (dossardDe ecrit en miroir : on le relit a l'envers devant)
  diffuseColor.rgb = mix(c, couleur, tissu);
  // LE DOSSARD est epingle : il couvre le tissu comme la peau (le ventre des femmes, sous la brassiere), sur le tronc
  vec2 d = vec2(vRepos.z / uBib.z + 0.5, (uBib.x + uBib.y - vRepos.y) / uBib.y);
  if (abs(vReposN.x) > 0.35 && all(greaterThan(d, vec2(0.0))) && all(lessThan(d, vec2(1.0))))
    diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uDossard, vec2(devant > 0.5 ? 1.0 - d.x : d.x, d.y)).rgb * clamp(hi / 0.16, 0.8, 1.1), smoothstep(0.35, 0.6, vTronc));
}`);
  };
  m.customProgramCacheKey = () => 'tenue-tripo';
  m.needsUpdate = true;
  return U;
}
/** Les couleurs de la tenue, le maillot du club, le dossard (null : pas de dossard). */
export function reglerTenueTripo(U: TenueTripo, maillot: THREE.Color, bas: THREE.Color, femme: boolean, vrac: boolean, dossard: THREE.Texture | null) {
  // LE MAILLOT DU CLUB : la face et le dos dessines par l'auteur, poses a plat sur le torse (repere de repos : y la
  // hauteur, z la largeur, le devant vers +x). Le dessin va de l'ourlet (0,96 m) au haut des epaules (1,46 m).
  if (vrac) for (const n of ['vrac-face.jpg', 'vrac-dos.jpg']) if (!textesVrac[n]) {
    const t = new THREE.TextureLoader().load(((import.meta as any).env?.BASE_URL || '/') + 'modeles/maillots/' + n);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textesVrac[n] = t;
  }
  U.uMaillot.value.copy(maillot); U.uBas.value.copy(bas);
  // LE DOSSARD, devant et dans le dos : sur le debardeur des hommes, sur le ventre des femmes (epingle sous la brassiere).
  // Sans dossard, son cadre part hors du corps (bas a 10 m).
  if (dossard) U.uBib.value.set(...((femme ? [1.04, 0.14, 0.175] : [1.03, 0.16, 0.20]) as [number, number, number]));   // (bas, hauteur, largeur — metres)
  else U.uBib.value.set(10, 0.1, 0.1);
  U.uDossard.value = dossard || VIDE;
  U.uTaille.value = femme ? 1.10 : 0.96;   // (la ceinture du cuissard des femmes monte plus haut que l'ourlet du debardeur ; entre brassiere et cuissard, la peau)
  // (la brassiere ne montre que le haut du dessin : il remonte de 6 cm, pour que le logo et la bande verte y tiennent)
  U.uDecal.value = femme ? -0.094 : 0;
  U.uVrac.value = vrac ? 1 : 0;
  U.uVracFace.value = vrac ? textesVrac['vrac-face.jpg'] : VIDE; U.uVracDos.value = vrac ? textesVrac['vrac-dos.jpg'] : VIDE;
}
