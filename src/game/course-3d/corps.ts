// LA COURSE EN VRAIE 3D — les coureurs en vrai maillage (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { chargeurGLTF } from '../chargeur-gltf';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { poser, type Modele } from '../vedette-3d';
import { zSol } from '../salle-3d';
import { OMBRES } from './reglages';
import { ULTRA } from './paliers';
import { monde } from './scene';
import { salleActive } from './repere';
import { c3, refaireLeStade } from './stade';

// --- LE CORPS EN VRAI MAILLAGE -------------------------------------------------
//
// Un seul corps generique (tools/blender/coureur_generique.py : Quaternius, CC0,
// passe par la chaine des vedettes), clone par coureur et teint a son look par
// zones. Il est pose par `poser` (vedette-3d.ts) sur r.squelette, que pose()
// releve des que r.squelette3D est vrai : memes angles que ses tubes. Tant qu'il
// n'est pas charge, ou si le chargement echoue, les tubes restent.
// shortcut: un corps d'homme pour tous, coureuses comprises — un corps de femme
// passe par le meme script le jour ou l'on va plus loin.
export const Qgl = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
export let gabarit: THREE.Object3D | null = null;
// LES CORPS ROCKETBOX (28/10 ; Microsoft, licence MIT ; tools/blender/rocketbox_coureur.py) : Sports_Male_01 (le
// gabarit) et Sports_Female_01, en maillot de bain, pres du corps. Sports_Male_04 et Sports_Female_02 ont leurs
// vetements (short ample, pantalon) dans la peau : peints, ils faisaient des jambes en blocs — ecartes. La variete
// vient des physiques (PHYSIQUES).
const autresCorps: { homme: THREE.Object3D[]; femme: THREE.Object3D[] } = { homme: [], femme: [] };
const premium: { sc: THREE.Object3D; femme: boolean }[] = [];   // (corps Tripo riggés, tools/assets/tripo-vers-jeu.mjs)
let chargement: Promise<void> | null = null;
// LES POINTES TRIPO (30/10, « genere des pointes d'athletisme sans la marque sur Tripo », puis « applique-les a tous les
// assets du jeu, tu peux varier les couleurs ») : le modele allege et cale sur chaque pied (scratchpad caler-pointes.py)
const pointesTripo: { homme: THREE.Object3D | null; femme: THREE.Object3D | null } = { homme: null, femme: null };
// echelle : un maillage Tripo n'a pas la taille du corps du jeu (Kouassi : 1,82 m au repos
// contre 1,54) — ramene a lui, il a la taille de son look comme les autres
export type Corps = { m: Modele; mats: Record<string, THREE.MeshStandardMaterial>; echelle?: number; tissu?: Map<THREE.Bone, { a: number; w: number; p: number | null }>; tPrec?: number };
const hauteurDe = (o: THREE.Object3D) => { const b = new THREE.Box3().setFromObject(o); return b.max.y - b.min.y; };
export const corps = new Map<any, Corps>();

// LE BLOC DE DEPART : la piece Blender des images 2D (pieces.blocs), exportee par
// tools/blender/bloc_depart_glb.py, fondue en un maillage par matiere : quatre
// appels de dessin pour les huit couloirs. Ses couleurs, perdues a l'export, sont
// celles de pieces.py. Tant qu'il n'est pas la, pas de blocs (jamais de bloc au trait).
export let blocLots: { geo: THREE.BufferGeometry; mat: THREE.Material }[] | null = null;
let blocDemande = false;
const BLOC_COULEURS: Record<string, number[]> = {
  aluminium: [190, 196, 208], fonte: [58, 62, 76], caoutchouc: [40, 42, 52], chariot: [204, 48, 54],
};
export function chargerLeBloc() {
  if (blocDemande) return;
  blocDemande = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const l = chargeurGLTF();
  l.loadAsync(base + 'modeles/bloc-depart.glb').then(g => {
    g.scene.updateMatrixWorld(true);
    const parMat = new Map<string, THREE.BufferGeometry[]>();
    g.scene.traverse((o: any) => {
      if (!o.isMesh) return;
      const brut = o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', brut.getAttribute('position'));
      geo.setAttribute('normal', brut.getAttribute('normal'));
      const n = o.material.name;
      if (!parMat.has(n)) parMat.set(n, []);
      parMat.get(n)!.push(geo);
    });
    blocLots = [...parMat].map(([n, gs]) => ({
      geo: mergeGeometries(gs)!,
      mat: new THREE.MeshLambertMaterial({ color: c3(BLOC_COULEURS[n], [128, 128, 128]) }),
    }));
    refaireLeStade();   // le stade se refait, avec ses blocs
  }).catch(() => { /* pas de blocs */ });
}

export function chargerLeCorps() {
  if (chargement) return;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const l = chargeurGLTF();
  chargement = l.loadAsync(base + 'modeles/coureur-homme.glb')
    .then(g => { gabarit = g.scene; })
    .catch(() => { /* les tubes restent */ });
  for (const genre of ['homme', 'femme'] as const)
    l.loadAsync(base + 'modeles/pointes-' + genre + '.glb').then(g => { pointesTripo[genre] = g.scene; }).catch(() => { /* les anciennes chaussures restent */ });
  // DEMO LOCALE : les 8 corps premium, un par couloir (?anciens : les corps d'avant, pour comparer)
  if (!/[?&]anciens/.test(location.search)) for (const c of ['h1', 'h2', 'h3', 'h4', 'f1', 'f2', 'f3', 'f4'])
    l.loadAsync(base + 'modeles/premium/' + c + 'v2.glb').then(g => { premium.push({ sc: g.scene, femme: c[0] === 'f' }); }).catch(() => { /* un corps de moins */ });
  for (const [genre, fichier] of [['femme', 'coureur-femme']] as const)
    l.loadAsync(base + 'modeles/' + fichier + '.glb').then(g => { autresCorps[genre].push(g.scene); }).catch(() => { /* un corps de moins */ });
}

export function modeleDe(racineGltf: THREE.Object3D): Modele {
  const racine = new THREE.Group();
  racine.matrixAutoUpdate = false;
  racine.add(racineGltf);
  racineGltf.updateMatrixWorld(true);
  const os = new Map<string, THREE.Bone>();
  racineGltf.traverse((o: any) => {
    if (o.isBone) os.set(o.name, o);
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = OMBRES; }
  });
  const prof = (b: THREE.Object3D) => { let n = 0; while (b.parent) { b = b.parent; n++; } return n; };
  const ordre = [...os.values()].sort((a, b) => prof(a) - prof(b));
  const repos = new Map<THREE.Bone, THREE.Quaternion>(), reposLocal = new Map<THREE.Bone, THREE.Quaternion>();
  const inv = new THREE.Matrix4().copy(racineGltf.matrixWorld).invert();
  for (const b of ordre) {
    repos.set(b, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld)));
    reposLocal.set(b, b.quaternion.clone());
  }
  const bassin = os.get('pelvis')!;
  const bassinParent = new THREE.Matrix4().multiplyMatrices(inv, bassin.parent!.matrixWorld);
  return { racine, os, ordre, repos, reposLocal, bassinParent } as Modele;
}

const SANS_CHEVEUX = new Set(['ras', 'shaved']);
// LE LISERE DES ATHLETES (Stade d'Or). Pour qu'on les voie au depart dans un stade
// volontairement sombre, ce sont EUX qu'on eclaire, pas le decor : un contre-jour dore
// sur leurs contours et un rien de lumiere propre. Des flaques et des faisceaux poses sur
// la piste « cassaient le style du stade » (l'auteur, 22/10). Eteint (0) ailleurs.
export const uLisere = { value: 0 }, uLisereCoul = { value: new THREE.Color(0xffc76b) }, uLisereForce = { value: 0.9 }, uLisereFace = { value: 0 };
// LES LED DE LA SALLE (« au moins 800 lux », « pas de spot directement sur eux, plusieurs LED dans le stade »,
// l'auteur, 29/10) : sous le toit, les corps baignent dans la lumiere d'une piece eclairee de partout
// (RoomEnvironment), la nuit dehors comme le jour. Le decor garde sa lumiere cuite. null ailleurs.
let envCorps: THREE.Texture | null = null;
function eclairerCorps(m: THREE.MeshStandardMaterial) {
  if (m.envMap === envCorps) return;
  m.envMap = envCorps; m.envMapIntensity = 0.5; m.needsUpdate = true;
}
// (les corps deja poses quand le stade change)
export function eclairerLesCorps(env: THREE.Texture | null) {
  envCorps = env;
  for (const c of corps.values()) c.m.racine.traverse((o: any) => { if (o.isMesh) for (const m of [].concat(o.material)) eclairerCorps(m); });
}
// LES VETEMENTS RESTENT SUR LE CORPS (« les vetements sur les assets ne restent pas », l'auteur, 08/11 soir : ils
// se decollaient, disparaissaient par moments, des taches noires). Les nouveaux corps Tripo (tripo_coureur.py) portent
// la tenue en coques a 3-10 mm de la peau, menees par des os de tissu un peu libres, sur un corps plus galbe que
// muscle encore le jeu (PHYSIQUES, jusqu'a 14 mm) : la peau passait au travers — un short disparu, une brassiere
// trouee —, et la ou peau et tissu se confondaient, la carte graphique ne savait plus lequel montrer (les taches).
// A l'image, chaque piece est donc poussee le long de sa normale APRES le squelette (metres, ci-dessous) et gagne les
// egalites de profondeur contre la peau. Le dossard un cran plus loin, pour rester devant le debardeur.
const EPAIS_TISSU: Record<string, number> = { brassiere: 0.007, debardeur: 0.009, shortlarge: 0.009, dossard: 0.012 };
function porterAuDessus(m: THREE.MeshStandardMaterial, e: number) {
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
transformed += normalize(objectNormal) * ${e.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'tissu' + e;
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
}

// LE CUISSARD MONTE SOUS LE NOMBRIL (« le cuissard est trop bas au niveau du haut du ventre », l'auteur, 08/11 soir) :
// sa zone peinte s'arrete aux hanches (0,92 m sur la coureuse), et sous une brassiere tout le ventre restait nu. Le
// bas du ventre prend la couleur du bas jusqu'a `haut` (metres, position de repos : la limite suit le corps).
function ceintureHaute(m: THREE.MeshStandardMaterial, couleur: THREE.Color, haut: number) {
  const avant = m.onBeforeCompile;
  const uBas = { value: couleur.clone() }, uHaut = { value: haut };
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.uniforms.uCeintureBas = uBas; sh.uniforms.uCeintureHaut = uHaut;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHautRepos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHautRepos = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHautRepos; uniform vec3 uCeintureBas; uniform float uCeintureHaut;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vHautRepos < uCeintureHaut) diffuseColor.rgb = uCeintureBas;');
  };
  m.customProgramCacheKey = () => 'ceinture';
}

export function lisere(m: THREE.MeshStandardMaterial) {
  eclairerCorps(m);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLisere = uLisere; sh.uniforms.uLisereCoul = uLisereCoul; sh.uniforms.uLisereForce = uLisereForce; sh.uniforms.uLisereFace = uLisereFace;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLisere, uLisereForce, uLisereFace; uniform vec3 uLisereCoul;')
      .replace('#include <opaque_fragment>', `
// (normale GEOMETRIQUE : avec le relief cuit des corps Tripo, chaque pli — l'emmanchure — s'allumait en lisere)
float bord = pow(1.0 - clamp(dot(normalize(nonPerturbedNormal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
// une lumiere de face douce, venue d'en haut a gauche de la camera : le cote qu'on voit
float face = max(dot(normalize(normal), normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
outgoingLight += uLisere * (uLisereCoul * bord * uLisereForce + diffuseColor.rgb * (0.12 + 0.02 * uLisereFace + 0.5 * uLisereFace * face));
#include <opaque_fragment>`);
  };
}

// LES ATHLETES EN VRAI MAILLAGE (look.maillage : les boss de la Legende, les vedettes) :
// leur GLB Tripo (vedette_tripo.py) a le squelette du coureur du jeu — il se pose pareil.
// Ses textures restent les siennes. Tant qu'il charge, les tubes tiennent sa place.
const maillages = new Map<string, THREE.Object3D | null | false>();
const PLEINS = 'anansi|chidi|damion|hermes|inti|jayden|kerem|kouassi|marc|oliver|sora|theo|wukong|yassine|zenith|meba|manga-corps';
function maillageDe(chemin: string): THREE.Object3D | null | false {
  if (!maillages.has(chemin)) {
    maillages.set(chemin, null);
    const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/?$/, '/');
    const l = chargeurGLTF();
    const leger = () => l.loadAsync(base + chemin.replace(/^\//, ''));
    // EN ULTRA, LA PLEINE RESOLUTION (« les assets dans leur plein potentiel », 23/10) : la meme
    // vedette, texture Tripo a sa taille d'origine (4096 px, en KTX2 depuis le 10/11), sans meshopt
    // (boss_pleine_resolution.py) ; la legere si elle manque
    // (pas sur un appareil a moins de 2 Go : la texture 4096 en KTX2 pese ~22 Mo de memoire graphique,
    // contre ~90 Mo en PNG quand le seuil etait a 4 Go)
    const memoire = (navigator as any).deviceMemory;
    const nom = ULTRA && !(memoire && memoire < 2) &&(chemin.match(new RegExp('(?:^|/)(' + PLEINS + ')(?:[-.][^/]*)?\\.glb$')) || [])[1];
    // MEBA-MICKAEL ZEZE AU MAXIMUM, A TOUS LES PALIERS (« rends le skin de Mickael au maximum de sa
    // qualite », l'auteur, 24/10) : sa texture 2048 en PNG, ses sommets sans la compression qui les
    // arrondit, et une subdivision lissee (31 000 faces au lieu de 10 000, coutures ressoudees).
    // Hors de boss-plein, que test3d ne publie pas.
    const meba = /(?:^|\/)meba\.glb$/.test(chemin);
    (meba ? l.loadAsync(base + 'vedettes/meba-plein.glb').catch(leger)
      : nom ? l.loadAsync(base + 'modeles/boss-plein/' + nom + '.glb').catch(leger) : leger())
      .then((g) => { maillages.set(chemin, g.scene); })
      .catch(() => { maillages.set(chemin, false); });
  }
  return maillages.get(chemin)!;
}

function corpsDe(r: any): Corps | null {
  (window as any).__corps = corps;   // DEMO LOCALE
  let c = corps.get(r);
  if (c) return c;
  const chemin = r.look && r.look.maillage;
  const sc = chemin ? maillageDe(chemin) : false;
  if (sc === null) return null;                // il charge : les tubes en attendant
  if (sc) {
    try {
      const copie = clonerSquelette(sc);
      copie.traverse((o: any) => {
        if (!o.isMesh) return;
        const m = (o.material as THREE.MeshStandardMaterial).clone();
        lisere(m);
        o.material = m;
      });
      const hGabarit = gabarit ? hauteurDe(gabarit) : 1.54, hMaillage = hauteurDe(sc);
      c = { m: modeleDe(copie), mats: {}, echelle: hMaillage > 0.5 ? hGabarit / hMaillage : 1 };
      monde.add(c.m.racine);
      corps.set(r, c);
      return c;
    } catch { maillages.set(chemin, false); }    // pas le squelette du jeu : le corps generique
  }
  if (!gabarit) return null;
  let femme = r.look?.build === 'f' && autresCorps.femme.length > 0;
  const tirage = Math.abs(hacher('corps' + String(r.name || r.lane || '')));
  const choix = femme ? autresCorps.femme : [gabarit, ...autresCorps.homme];
  const p = premium.length ? premium[((r.lane ?? 0) as number) % premium.length] : null;   // DEMO LOCALE : un corps premium par couloir
  const source = p ? p.sc : choix[tirage % choix.length];
  if (p) femme = p.femme;   // (les pointes suivent le corps)
  const copie = clonerSquelette(source);
  doserLePhysique(copie, r.look, tirage);
  const mats: Record<string, THREE.MeshStandardMaterial> = {};
  copie.traverse((o: any) => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neufs = liste.map((m: any) => {
      const zone = String(m.name || '').replace('Coureur_', '');
      // LE LOGO DES POINTES BENBEZI (tools/blender/chaussures_coureur.py) : sa texture, le logo du jeu, est gardee
      const n = new THREE.MeshStandardMaterial({ roughness: zone === 'peau' ? 0.55 : zone === 'semelle' || zone === 'plaque' ? 0.45 : 0.7, metalness: 0,
        normalMap: m.normalMap ?? null, ...(m.normalMap ? { normalScale: m.normalScale } : {}),   // (GLTFLoader inverse y sans tangentes : sans lui le relief est eclaire a l'envers)
          // le relief cuit des corps premium (athlete_premium.py) ; null sur les anciens
        ...(zone === 'tripo' ? { map: m.map } : {}),   // corps Tripo (tripo-vers-jeu.mjs) : sa couleur, pas de teinte
        ...(zone === 'logo' ? { map: m.map, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } : {}) });
      lisere(n);
      if (EPAIS_TISSU[zone]) porterAuDessus(n, EPAIS_TISSU[zone]);
      mats[zone] = n;
      return n;
    });
    o.material = Array.isArray(o.material) ? neufs : neufs[0];
  });
  const L = r.look, rgb = (v: number[], k = 1) => new THREE.Color().setRGB(v[0] / 255 * k, v[1] / 255 * k, v[2] / 255 * k, THREE.SRGBColorSpace);
  mats.peau?.color.copy(rgb(L.skin));
  mats.maillot?.color.copy(rgb(L.jersey || [200, 40, 50]));
  mats.short?.color.copy(rgb(L.shorts));
  // LES POINTES BENBEZI (« les assets du jeu sont pieds nus : cree-leur des chaussures avec la marque Benbezi, reprends le
  // logo du jeu », l'auteur, 27/10 ; tools/blender/chaussures_coureur.py) : la tige a la couleur de chaussure du look, la
  // semelle blanche, la plaque a pointes noire, le logo argent. L'ancienne zone « pointes » n'etait que le pied teint :
  // elle reste dans la chaussure, et au-dessus du col c'est la cheville — couleur de peau.
  mats.pointes?.color.copy(mats.chaussure ? rgb(L.skin) : rgb(L.shoe));
  mats.chaussure?.color.copy(rgb(L.shoe));
  // (le lacage : blanc sur une chaussure foncee, noir sur une claire)
  if (mats.lacets) { const c = rgb(L.shoe); mats.lacets.color.setRGB(...((c.r + c.g + c.b) / 3 > 0.45 ? [0.08, 0.08, 0.09] : [0.93, 0.93, 0.92]) as [number, number, number], THREE.SRGBColorSpace); }
  mats.semelle?.color.setRGB(0.93, 0.93, 0.91, THREE.SRGBColorSpace);
  // (28/10, d'apres les pointes de reference : la plaque et le contrefort du talon prennent la couleur du maillot,
  //  les clous sont en metal)
  if (mats.talon) mats.plaque?.color.copy(rgb(L.jersey || [200, 40, 50]));
  else mats.plaque?.color.setRGB(0.06, 0.06, 0.07, THREE.SRGBColorSpace);
  mats.talon?.color.copy(rgb(L.jersey || [200, 40, 50]));
  if (mats.clous) { mats.clous.color.setRGB(0.82, 0.82, 0.85, THREE.SRGBColorSpace); mats.clous.metalness = 0.9; mats.clous.roughness = 0.25; }
  mats.cheveux?.color.copy(SANS_CHEVEUX.has(L.hair) ? rgb(L.skin, 0.8) : rgb(L.hairCol || [20, 16, 14]));
  // LES VRAIS VETEMENTS (tools/blender/coureur_realiste.py, 28/10 : « des vrais vetements de sport ») : le debardeur
  // et le short fendu sont des pieces a part, teintes comme le maillot et le short du look ; chaque coureur tire sa
  // tenue (comme en finale : tout le monde n'a pas la meme), le dossard numerote par-dessus.
  const maillot = rgb(L.jersey || [200, 40, 50]);
  const liste = femme ? TENUES_FEMMES : TENUES;
  // (un maillot de club se porte en debardeur : c'est la piece qui flotte, LE TISSU)
  const tenue = L.kit ? (femme ? 'debardeur-culotte' : 'debardeur-short')
    : liste[Math.abs(hacher(String(r.name || r.lane || ''))) % liste.length];
  const brassiere = tenue.startsWith('brassiere'), culotte = tenue.endsWith('culotte');
  // (une piece : le debardeur reste, le bas prend sa couleur ; la zone peinte du corps avait un bord en dents de scie)
  const bas = tenue === 'une-piece' ? maillot : rgb(L.shorts);
  if (mats.tripo) tenueTripo(copie, mats.tripo, maillot, bas, femme, L.kit === 'vrac' || /[?&]vrac/.test(location.search) /* (DEMO LOCALE : ?vrac) */, dossardDe(((r.lane ?? 0) as number) + 1));
  mats.debardeur?.color.copy(maillot); mats.brassiere?.color.copy(maillot); mats.shortlarge?.color.copy(bas);
  if (mats.debardeur) mats.debardeur.visible = !brassiere;
  if (mats.brassiere) mats.brassiere.visible = brassiere;
  if (mats.shortlarge) mats.shortlarge.visible = tenue === 'debardeur-short';
  mats.short?.color.copy(bas);
  // sous la brassiere le ventre est nu. LA CULOTTE COUVRE LES FESSES (« les vetements de femme disparaissent et on voit
  // leurs fesses », l'auteur, 08/11 soir) : peinte sur le corps, elle s'arretait 11,5 cm sous la taille
  // (coureur_realiste.decouper_tenues), et les corps Tripo, plus galbes, descendent plus bas. Le bas de la zone prend
  // donc toujours la couleur du bas : une culotte se porte en cuissard court.
  void culotte;
  mats.ventre?.color.copy(brassiere ? rgb(L.skin) : maillot);
  mats.shortbas?.color.copy(bas);
  if (brassiere && mats.ventre) {
    // le haut actuel de la zone du short, sur ce corps (homme et femme n'ont pas la meme taille), plus cinq centimetres
    let hautShort = 0;
    copie.traverse((o: any) => { if (o.isMesh && o.material === mats.short) { o.geometry.computeBoundingBox(); hautShort = Math.max(hautShort, o.geometry.boundingBox.max.y); } });
    if (hautShort > 0) ceintureHaute(mats.ventre, bas, hautShort + 0.05);
  }
  if (mats.dossard) { mats.dossard.map = dossardDe(((r.lane ?? 0) as number) + 1); mats.dossard.roughness = 0.9; mats.dossard.side = THREE.DoubleSide; dossardALEndroit(mats.dossard); }
  for (const z of ['debardeur', 'shortlarge', 'brassiere']) if (mats[z]) mats[z].side = THREE.DoubleSide;   // (l'ourlet se voit par-dessous)
  if (L.kit === 'vrac' && mats.debardeur) {
    maillotTripo(mats.debardeur, femme);
    if (mats.dossard) dossardSousLaBande(mats.dossard);
  }
  chausserTripo(copie, femme, L.shoe);
  // (le corps de femme est plus petit que celui d'homme : ramene a lui, la taille du look decide seule, comme avant)
  c = { m: modeleDe(copie), mats, echelle: source !== gabarit ? hauteurDe(gabarit) / hauteurDe(source) : undefined };
  monde.add(c.m.racine);
  corps.set(r, c);
  return c;
}

// LE MAILLOT DU VAL-DE-REUIL ATHLETIQUE CLUB (29/10, game/vestiaire.ts MAILLOTS ; d'apres deux photos de l'auteur, sans
// les sponsors) : haut blanc, bas bleu roi, col en V et emmanchures bleus ; devant, le petit logo ; dans le dos, le grand
// logo, la bande verte et ses hachures ; sur les flancs, un panneau vert raye borde de blanc. Peint sur le DEBARDEUR, la piece qui flotte (LE TISSU) : il bouge en course comme les autres. Le motif
// se lit sur la pose de repos du maillage (`position`, avant le squelette) : il suit le tissu au lieu de glisser
// dessus. Reperes mesures sur coureur-homme/femme.glb : debardeur de 0,87 a 1,415 m, le devant vers +x.
// Un grain de maille, un rien de lumiere rasante : un maillot, pas une peinture.
// LE COL ET LES EMMANCHURES (« au niveau du col ca va pas », l'auteur, 29/10) : le liseré bleu du vrai maillot suit les
// bords du debardeur. Ils se trouvent une fois par maillage : les aretes qui n'ont qu'un triangle, une fois soudees les
// coutures des UV ; chaque sommet garde sa distance au bord le plus proche (`aBord`, en metres). L'ourlet du bas n'en
// est pas : il reste bleu comme le bas du maillot.
function bordsDuDebardeur(g: THREE.BufferGeometry) {
  if (g.getAttribute('aBord')) return;
  const pos = g.getAttribute('position'), n = pos.count;
  const ids = new Map<string, number>(), soude = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    let id = ids.get(k); if (id === undefined) { id = ids.size; ids.set(k, id); } soude[i] = id;
  }
  const tri = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
  const aretes = new Map<string, number>();
  for (let t = 0; t + 2 < tri.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = soude[tri[t + e]], b = soude[tri[t + (e + 1) % 3]];
    const k = a < b ? `${a}_${b}` : `${b}_${a}`; aretes.set(k, (aretes.get(k) || 0) + 1);
  }
  const auBord = new Set<number>();
  for (const [k, c] of aretes) if (c === 1) for (const v of k.split('_')) auBord.add(+v);
  const bords: number[] = [];
  for (let i = 0; i < n; i++) if (auBord.has(soude[i]) && pos.getY(i) > 1.0) bords.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let m = 0.1;
    for (let j = 0; j < bords.length; j += 3) {
      const dx = x - bords[j], dy = y - bords[j + 1], dz = z - bords[j + 2], q = dx * dx + dy * dy + dz * dz;
      if (q < m * m) m = Math.sqrt(q);
    }
    d[i] = m;
  }
  g.setAttribute('aBord', new THREE.BufferAttribute(d, 1));
}
// LE DOSSARD DU DOS A L'ENDROIT : les deux dossards partagent une texture, ecrite a l'envers pour celui du devant
// (le maillage est en miroir) ; celui du dos se lisait donc en miroir (« SPRINTER » et le numero, 29/10)
function dossardALEndroit(m: THREE.MeshStandardMaterial) {
  if ((m as any).__aLEndroit) return;
  (m as any).__aLEndroit = true;
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nif (position.x < 0.0) vMapUv.x = 1.0 - vMapUv.x;\n#endif');
  };
  m.customProgramCacheKey = () => 'dossard';
  m.needsUpdate = true;
}
// LE DOSSARD SOUS LA BANDE (les photos du club : la bande verte et ses hachures se voient au-dessus du dossard) : avec
// ce maillot, le dossard descend de 6 cm, sur un devant presque plat a cet endroit (1,01 a 1,22 m, mesure).
function dossardSousLaBande(m: THREE.MeshStandardMaterial) {
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    // (celui du devant seulement : celui du dos, plus bas, ressortait sous l'ourlet)
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nif (position.x > 0.0) transformed.y -= 0.06;');
  };
  m.customProgramCacheKey = () => 'dossard-vrac';
  m.needsUpdate = true;
}
// LE MAILLOT TRIPO (29-30/10 : « fait ce maillot via Tripo pour le jeu », d'apres la face et le dos dessines par l'auteur) :
// le modele Tripo, cale sur le debardeur, y est CUIT dans ses UV (scratchpad cuire-maillot.py, Blender) — une image par
// corps. Le debardeur garde ainsi son squelette, ses os de tissu et les physiques : le maillot bouge comme avant.
const textesTripo: Record<string, THREE.Texture> = {};
function maillotTripo(m: THREE.MeshStandardMaterial, femme: boolean) {
  const n = femme ? 'vrac-femme' : 'vrac-homme';
  if (!textesTripo[n]) {
    const base = (import.meta as any).env?.BASE_URL || '/';
    const t = new THREE.TextureLoader().load(base + 'modeles/maillots/' + n + '.jpg');
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;   // (les UV du glb : sans retournement)
    textesTripo[n] = t;
  }
  m.map = textesTripo[n]; m.color.setRGB(1, 1, 1); m.roughness = 0.82;
  // LE VRAI LOGO DU CLUB, devant : Tripo en avait deforme le texte. Un carre blanc l'efface, le fichier du club s'y pose
  // (repere de la pose de repos : z vers la droite du coureur vu de face, y la hauteur)
  const base = (import.meta as any).env?.BASE_URL || '/';
  for (const n of ['vrac-logo.png', 'vrac-ville.png']) if (!textesTripo[n]) {
    const t = new THREE.TextureLoader().load(base + 'modeles/maillots/' + n); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    textesTripo[n] = t;
  }
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.uniforms.uLogoVRAC = { value: textesTripo['vrac-logo.png'] }; sh.uniforms.uVilleVRAC = { value: textesTripo['vrac-ville.png'] };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKit; varying vec3 vKitN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKit = position; vKitN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKit; varying vec3 vKitN; uniform sampler2D uLogoVRAC, uVilleVRAC;')
      .replace('#include <map_fragment>', `#include <map_fragment>
if (vKitN.x > 0.2) {
  vec2 q = vec2((vKit.z - ${LOGO_DEVANT.z}) / ${LOGO_DEVANT.l}, (vKit.y - ${LOGO_DEVANT.y}) / ${LOGO_DEVANT.h});
  if (all(greaterThan(q, vec2(-0.08, -0.25))) && all(lessThan(q, vec2(1.08, 1.25)))) diffuseColor.rgb = vec3(0.9);
  if (all(greaterThan(q, vec2(0.0))) && all(lessThan(q, vec2(1.0)))) { vec4 t = texture2D(uLogoVRAC, q); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, t.a); }
  vec2 v = vec2((vKit.z - ${VILLE_DEVANT.z}) / ${VILLE_DEVANT.l}, (vKit.y - ${VILLE_DEVANT.y}) / ${VILLE_DEVANT.h});
  if (all(greaterThan(v, vec2(-0.06))) && all(lessThan(v, vec2(1.06)))) diffuseColor.rgb = vec3(0.9);
  if (all(greaterThan(v, vec2(0.0))) && all(lessThan(v, vec2(1.0)))) diffuseColor.rgb = texture2D(uVilleVRAC, v).rgb;
}`);
  };
  m.customProgramCacheKey = () => 'maillot-tripo';
  m.needsUpdate = true;
}
// LA TENUE DES CORPS TRIPO PREND LES COULEURS DU COUREUR. Leur texture porte une tenue GRISE (debardeur ou brassiere,
// cuissard) : entre les genoux et les epaules, ce qui est gris est du tissu, ce qui est colore est de la peau. Le gris
// garde ses ombres et prend la couleur du maillot au-dessus de la taille, celle du short en dessous. La hauteur est
// lue au REPOS (avant le squelette), pour que la limite ne bouge pas avec la foulee.
function tenueTripo(copie: THREE.Object3D, m: THREE.MeshStandardMaterial, maillot: THREE.Color, bas: THREE.Color, femme: boolean, vrac: boolean, dossard: THREE.Texture) {
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
  // LE MAILLOT DU CLUB : la face et le dos dessines par l'auteur, poses a plat sur le torse (repere de repos : y la
  // hauteur, z la largeur, le devant vers +x). Le dessin va de l'ourlet (0,96 m) au haut des epaules (1,46 m).
  if (vrac) for (const n of ['vrac-face.jpg', 'vrac-dos.jpg']) if (!textesTripo[n]) {
    const t = new THREE.TextureLoader().load(((import.meta as any).env?.BASE_URL || '/') + 'modeles/maillots/' + n);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textesTripo[n] = t;
  }
  // LE DOSSARD, devant et dans le dos : sur le debardeur des hommes, sur la brassiere des femmes (plus petit).
  const bib = femme ? new THREE.Vector3(1.225, 0.105, 0.131) : new THREE.Vector3(1.03, 0.16, 0.20);   // (bas, hauteur, largeur — metres)
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.uniforms.uMaillot = { value: maillot }; sh.uniforms.uBas = { value: bas }; sh.uniforms.uBib = { value: bib };
    sh.uniforms.uTaille = { value: femme ? 1.10 : 0.96 };   // (la ceinture du cuissard des femmes monte plus haut que l'ourlet du debardeur ; entre brassiere et cuissard, la peau)
    sh.uniforms.uVrac = { value: vrac ? 1 : 0 }; sh.uniforms.uDossard = { value: dossard };
    sh.uniforms.uVracFace = { value: vrac ? textesTripo['vrac-face.jpg'] : dossard }; sh.uniforms.uVracDos = { value: vrac ? textesTripo['vrac-dos.jpg'] : dossard };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tronc; varying vec3 vRepos, vReposN; varying float vTronc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRepos = position; vReposN = normal; vTronc = tronc;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRepos, vReposN; varying float vTronc; uniform vec3 uMaillot, uBas, uBib; uniform float uVrac, uTaille; uniform sampler2D uDossard, uVracFace, uVracDos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  // (le masque du tissu est dans l'alpha de la texture — tripo-vers-jeu.mjs ; sans alpha, rien n'est teint)
  float masque = 1.0 - smoothstep(0.15, 0.85, diffuseColor.a); diffuseColor.a = 1.0;
  vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b));
  float tissu = masque * smoothstep(0.50, 0.56, vRepos.y) * (1.0 - smoothstep(1.44, 1.50, vRepos.y)) * smoothstep(0.35, 0.6, vTronc);
  float haut = step(uTaille, vRepos.y), devant = step(0.0, vReposN.x);
  vec3 teinte = mix(uBas, uMaillot, haut);
  if (uVrac > 0.5 && haut > 0.5) {
    vec2 q = vec2(0.19 + (vRepos.z + 0.20) / 0.40 * 0.62, 0.109 + (1.46 - vRepos.y) / 0.50 * 0.806);
    q = clamp(q, vec2(0.02, 0.11), vec2(0.98, 0.91));
    teinte = devant > 0.5 ? texture2D(uVracFace, vec2(q.x, 1.0 - q.y)).rgb : texture2D(uVracDos, vec2(1.0 - q.x, 1.0 - q.y)).rgb;
  }
  vec3 couleur = teinte * clamp(hi / 0.16, 0.55, 1.25);
  // (dossardDe ecrit en miroir : on le relit a l'envers devant)
  vec2 d = vec2(vRepos.z / uBib.z + 0.5, (uBib.x + uBib.y - vRepos.y) / uBib.y);
  if (abs(vReposN.x) > 0.35 && all(greaterThan(d, vec2(0.0))) && all(lessThan(d, vec2(1.0))))
    couleur = texture2D(uDossard, vec2(devant > 0.5 ? 1.0 - d.x : d.x, d.y)).rgb * clamp(hi / 0.16, 0.8, 1.1);
  diffuseColor.rgb = mix(c, couleur, tissu);
}`);
  };
  m.customProgramCacheKey = () => 'tenue-tripo';
  m.needsUpdate = true;
}
// Chaque pointe prend la place de la chaussure du jeu (tige, semelle, plaque, clous, logo, masques) : un maillage
// accroche au meme os du pied, avec le meme squelette. L'eclair et le talon vert-jaune du modele prennent la couleur de
// chaussure du coureur ; une couleur trop sombre garde le vert d'origine (sinon l'eclair disparait dans la tige noire).
const geoPointes = new Map<string, THREE.BufferGeometry>();
function chausserTripo(copie: THREE.Object3D, femme: boolean, couleur: number[] | undefined) {
  const src = pointesTripo[femme ? 'femme' : 'homme'];
  if (!src) return;
  for (const c of ['l', 'r']) {
    const tige = copie.getObjectByName('Tige_foot_' + c);
    let peau: any = null;
    tige?.traverse((o: any) => { if (!peau && o.isSkinnedMesh) peau = o; });
    let modele: any = null;
    src.getObjectByName('pointe_' + c)?.traverse((o: any) => { if (!modele && o.isMesh) modele = o; });
    if (!peau || !modele) continue;
    const cle = (femme ? 'f' : 'h') + c;
    let geo = geoPointes.get(cle);
    if (!geo) {
      // l'os qui porte le plus la chaussure du jeu porte toute la pointe
      const si = peau.geometry.getAttribute('skinIndex'), sw = peau.geometry.getAttribute('skinWeight');
      const poids = new Map<number, number>();
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) poids.set(si.getComponent(i, k), (poids.get(si.getComponent(i, k)) || 0) + sw.getComponent(i, k));
      const os = [...poids.entries()].sort((a, b) => b[1] - a[1])[0][0];
      geo = modele.geometry.clone() as THREE.BufferGeometry;
      const n = geo.getAttribute('position').count;
      const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { idx[i * 4] = os; w[i * 4] = 1; }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
      geoPointes.set(cle, geo);
    }
    const m = new THREE.MeshStandardMaterial({ map: modele.material.map, roughness: 0.6, metalness: 0 });
    const t = couleur ? new THREE.Color().setRGB(couleur[0] / 255, couleur[1] / 255, couleur[2] / 255, THREE.SRGBColorSpace) : null;
    const teinte = t && t.r * 0.3 + t.g * 0.59 + t.b * 0.11 > 0.04 ? t : null;
    lisere(m);   // (avant la teinte : lisere remplace onBeforeCompile, la teinte s'y enchaine)
    if (teinte) {
      const avant = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        avant.call(m, sh, r);
        sh.uniforms.uTeinte = { value: teinte };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uTeinte;')
          .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
  float vif = smoothstep(0.35, 0.6, hi > 0.0 ? (hi - lo) / hi : 0.0) * step(c.b, c.g * 0.6) * step(c.r, c.g * 1.15);
  diffuseColor.rgb = mix(c, uTeinte * clamp(hi / 0.7, 0.4, 1.3), vif);
}`);
      };
      m.customProgramCacheKey = () => 'pointe-tripo';
    }
    const sm = new THREE.SkinnedMesh(geo, m);
    sm.name = 'pointe_' + c;
    sm.bind(peau.skeleton, peau.bindMatrix);
    tige!.parent!.add(sm);
    for (const nom of ['Tige', 'Semelle', 'Plaque', 'Clous', 'Logo']) { const o = copie.getObjectByName(nom + '_foot_' + c); if (o) o.visible = false; }
  }
}
const LOGO_DEVANT = { z: '0.042', y: '1.222', l: '0.094', h: '0.0349' };
// (« VAL DE REUIL » et son triangle, decoupes dans le dessin de l'auteur : Tripo en avait abime le D)
const VILLE_DEVANT = { z: '-0.040', y: '1.212', l: '0.080', h: '0.0513' };
let logoVRAC: THREE.Texture | null = null;
const lin = (c: number) => new THREE.Color(c);   // (hex sRGB, range lineaire par three)
const uVRAC = { blanc: { value: lin(0xf4f6f8) }, vert: { value: lin(0x4cb248) }, bleu: { value: lin(0x1c40c4) } };
// LE COL EN V, MOINS PROFOND (« le col est trop bas », « le col est en V mais tu l'as fait trop bas », l'auteur, 29/10) :
// le debardeur du jeu est echancre jusqu'a 1,29 m ; le V du club a sa pointe a 1,312 m et remonte vers la base du cou
// (1,36 m chez l'homme, 1,35 chez la femme, mesure). Le haut de la poitrine se peint donc sur la PEAU, dans l'echancrure
// seulement (au-dessus de 1,28 m), sous la ligne du V, avec son liseré : `peau` ne garde que ce col.
// (« la partie entouree existe des deux cotes, supprime-les » : l'ancien V depassait sous la jonction des bretelles ;
//  le col se nettoie et se borde jusqu'a 9 cm du milieu, sur la bretelle comme sur la peau)
const COL_VRAC = 'float yCol = 1.312 + 0.62 * abs(vKit.z); bool dansLeCol = vKit.x > 0.02 && abs(vKit.z) < 0.09 && vKit.y > 1.25 && vKit.y < yCol;';
function maillotDuClub(m: THREE.MeshStandardMaterial, peau = false) {
  if (!logoVRAC) {
    const base = (import.meta as any).env?.BASE_URL || '/';
    logoVRAC = new THREE.TextureLoader().load(base + 'modeles/maillots/vrac-logo.png');
    logoVRAC.colorSpace = THREE.SRGBColorSpace; logoVRAC.anisotropy = 4;
  }
  if (!peau) { m.color.setRGB(1, 1, 1); m.roughness = 0.82; }
  const avant = m.onBeforeCompile;   // (le lisere s'y pose deja)
  m.onBeforeCompile = (sh, r) => {
    avant.call(m, sh, r);
    sh.uniforms.uLogoVRAC = { value: logoVRAC };
    sh.uniforms.uBlancVRAC = uVRAC.blanc; sh.uniforms.uVertVRAC = uVRAC.vert; sh.uniforms.uBleuVRAC = uVRAC.bleu;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBord; varying float vBord; varying vec3 vKit; varying vec3 vKitN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKit = position; vKitN = normal; vBord = aBord;');
    sh.fragmentShader = (peau ? '#define PEAU_VRAC\n' : '') + sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBord; varying vec3 vKit; varying vec3 vKitN;\nuniform sampler2D uLogoVRAC; uniform vec3 uBlancVRAC, uVertVRAC, uBleuVRAC;')
      .replace('#include <map_fragment>', `#include <map_fragment>
bool sansOmbreVRAC = false, enversVRAC = false;
{
  ${COL_VRAC}
#ifdef PEAU_VRAC
  // (et toute la peau de l'ancien V, jusqu'a la bande : celui des coureuses descendait jusque-la, et ses bords
  // percaient le tissu en lignes sombres, 29/10)
  if (dansLeCol || (vKit.x > 0.02 && abs(vKit.z) < 0.11 && vKit.y > 1.10 && vKit.y < yCol)) {
  sansOmbreVRAC = true;   // (dans la fente, l'ombre du tissu la noircissait : elle prend la lumiere du tissu)
#endif
  float y = vKit.y, z = vKit.z, nz = abs(vKitN.z);
  bool devant = vKitN.x > 0.15, dos = vKitN.x < -0.15;
  // le haut blanc, le bas bleu roi
  vec3 kc = y > 1.215 ? uBlancVRAC : uBleuVRAC;
  // DEVANT ET DANS LE DOS (les photos du club) : la bande verte, et ses hachures en biais sous elle, du cote droit du
  // coureur — a gauche quand on le regarde de face, a droite de dos
  float h = 1.185 - y;
  if (y > 1.185 && y <= 1.215) kc = uVertVRAC;
  if (dos && h > 0.0 && h < 0.075 && z > -0.02 && z < 0.11 && fract((h - z) * 34.0) < 0.42) kc = uVertVRAC;
  if (devant && h > 0.0 && h < 0.06 && z > -0.11 && z < 0.0 && fract((h + z) * 34.0) < 0.42) kc = uVertVRAC;
  if (dos) {
    vec2 uv = vec2((0.095 - z) / 0.19, (y - 1.252) / 0.070);
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { vec4 t = texture2D(uLogoVRAC, uv); kc = mix(kc, t.rgb, t.a); }
  }
  // LES FLANCS (les photos de profil) : un panneau vert uni sous la bande, de l'aisselle a l'ourlet, qui s'evase vers
  // le bas en mordant sur le devant et le dos, borde d'un filet blanc
  // (« la bande verte sur le cote est beaucoup trop importante », l'auteur, 29/10 : une bande etroite sur la couture)
  float evase = clamp((1.185 - y) * 0.35, 0.0, 0.05);
  if (y < 1.185 && nz > 0.935 - evase) kc = nz > 0.955 - evase ? uVertVRAC : uBlancVRAC;
  // LE DEVANT, comme sur la photo : le logo du club cote gauche du coureur (sans les logos des partenaires, l'auteur, 29/10)
  if (devant) {
    vec2 uv = vec2((z - 0.034) / 0.072, (y - 1.252) / 0.027);
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { vec4 t = texture2D(uLogoVRAC, uv); kc = mix(kc, t.rgb, t.a); }
  }
  // le liseré bleu du col et des emmanchures (bordsDuDebardeur), un peu plus d'un centimetre
  // (le bord du V, recouvert par le col rond, n'a plus de liseré ; le col rond a le sien)
#ifndef PEAU_VRAC
  // (ni sur les bords de l'ancien V, qui chez les coureuses descend jusqu'a la bande : ils tracaient des lignes sur la poitrine)
  bool ancienV = vKit.x > 0.02 && abs(vKit.z) < 0.125 && vKit.y > 1.10 && vKit.y < yCol;
  if (vBord < 0.013 && !dansLeCol && !ancienV) kc = uBleuVRAC;
  // (l'envers du tissu, qui se retourne au bord de l'ancien V : sans lumiere il tracait des lignes noires)
  enversVRAC = !gl_FrontFacing && ancienV;
  sansOmbreVRAC = ancienV;
#endif
  // (sur la position, pas la normale : au bord du tissu elle tourne, et l'ancien V gardait son liseré)
  // (le V ne se trace que sur la peau, dans l'echancrure : il s'arrete au bord de la bretelle, dont le liseré prend le relais)
#ifdef PEAU_VRAC
  if (dansLeCol && yCol - y < 0.012) kc = uBleuVRAC;
#endif
  float maille = 0.96 + 0.04 * sin(vKit.y * 900.0) * sin(vKit.z * 900.0 + vKit.x * 600.0);
  diffuseColor.rgb = kc * maille;
#ifdef PEAU_VRAC
  }
#endif
}`);
    if (!peau) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nif (enversVRAC) totalEmissiveRadiance += diffuseColor.rgb * 0.75;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin.split('receiveShadow )').join('receiveShadow && !sansOmbreVRAC )'));
  };
  m.customProgramCacheKey = () => (peau ? 'maillot-vrac-col' : 'maillot-vrac');
  m.needsUpdate = true;
}

// LES PHYSIQUES (28/10, « fais des corpulences et des physiques differents d'athletes ») : quatre formes dans chaque
// corps (coureur_realiste.formes : muscle, sec, epaules, bassin). Une vedette a sa morphologie (look.morph : sh, hip,
// arm, leg) ; les autres tirent un physique d'athlete.
const PHYSIQUES: Record<string, number>[] = [
  { muscle: 1, epaules: 0.7, bassin: 0.2 },      // le sprinteur puissant
  { sec: 0.85, epaules: 0.1 },                  // le longiligne du 400
  { muscle: 0.6, bassin: 0.5 },                 // le compact
  { muscle: 0.35, epaules: 0.3 },               // l'athlete
  { sec: 0.4, muscle: 0.2 },                    // le sec
  { muscle: 1, epaules: 1, bassin: 0.6 },       // le massif
];
const borne = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
function doserLePhysique(o: THREE.Object3D, look: any, tirage: number) {
  const MO = look?.morph;
  const membres = MO ? ((MO.arm || 1) + (MO.leg || 1)) / 2 : 1;
  const dose = MO ? { muscle: borne((membres - 1) / 0.12, 0, 1), sec: borne((1 - membres) / 0.1, 0, 1),
    epaules: borne(((MO.sh || 1) - 1) / 0.14, -0.5, 1), bassin: borne(((MO.hip || 1) - 1) / 0.06, -0.5, 1) }
    : PHYSIQUES[(tirage >> 3) % PHYSIQUES.length];
  o.traverse((m: any) => {
    if (!m.morphTargetDictionary || !m.morphTargetInfluences) return;
    for (const [nom, i] of Object.entries(m.morphTargetDictionary as Record<string, number>)) m.morphTargetInfluences[i] = (dose as any)[nom] || 0;
  });
}

const TENUES = ['debardeur-short', 'debardeur-cuissard', 'debardeur-short', 'une-piece'];
// (les coureuses : brassiere et culotte, comme en finale, ou debardeur, cuissard, une piece)
const TENUES_FEMMES = ['brassiere-culotte', 'debardeur-culotte', 'brassiere-cuissard', 'brassiere-culotte', 'une-piece'];
const hacher = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; };
/** Le dossard : un carton blanc, le numero en noir, la marque du jeu en tete. */
function dossardDe(n: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 205;
  const x = c.getContext('2d')!;
  x.translate(256, 0); x.scale(-1, 1);   // (le maillage est exporte en miroir : on ecrit a l'envers pour qu'il se lise a l'endroit)
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 205);
  x.fillStyle = '#ff7a1a'; x.fillRect(0, 0, 256, 40);
  x.fillStyle = '#fff'; x.font = '700 28px Outfit, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SPRINTER', 128, 21);
  x.fillStyle = '#111'; x.font = '900 128px Outfit, sans-serif'; x.fillText(String(n), 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  return t;
}

// LE TISSU (28/10 : « des vetements qui bougent lorsque la vitesse est importante ») : le bas du debardeur, des jambes
// du short et des dossards pend a des os de tissu (coureur_realiste.py). Chacun est un ressort autour de l'axe lateral
// du coureur : il garde son orientation quand son parent tourne (la cuisse qui balance, le buste qui se penche), le
// vent de la course le rabat vers l'arriere, et il claque un peu a haute vitesse. Quelques os par coureur : rien
// pour un petit telephone.
// (inertie : la part du mouvement du parent que le tissu refuse de suivre ; borne : son angle maximal)
// (08/11 soir, « les vetements ne restent pas » : jusqu'a 0,45-0,8 rad, le bas du short pivotait loin de la cuisse et
//  la jambe ressortait au travers, le debardeur s'ouvrait sur le ventre. Bornes et inertie reduites des deux tiers :
//  le tissu bouge encore a pleine vitesse, il ne quitte plus le corps.)
const TISSU: Record<string, { k: number; amort: number; vent: number; claque: number; inertie: number; borne: number }> = {
  tissu_avant: { k: 60, amort: 9, vent: -0.06, claque: 0.03, inertie: 0.2, borne: 0.14 },     // plaque contre le ventre par le vent
  tissu_dos: { k: 45, amort: 7, vent: 0.18, claque: 0.05, inertie: 0.25, borne: 0.24 },       // s'ecarte du dos
  tissu_short_l: { k: 90, amort: 10, vent: 0.06, claque: 0.03, inertie: 0.08, borne: 0.15 },  // suit la cuisse, en retard
  tissu_short_r: { k: 90, amort: 10, vent: 0.06, claque: 0.03, inertie: 0.08, borne: 0.15 },
  tissu_dossard: { k: 35, amort: 5, vent: -0.05, claque: 0.06, inertie: 0.3, borne: 0.2 },
  tissu_dossard_dos: { k: 35, amort: 5, vent: 0.22, claque: 0.08, inertie: 0.3, borne: 0.3 },
};
const _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ax = new THREE.Vector3(), _dir = new THREE.Vector3(), _bas = new THREE.Vector3();
const LATERAL_MODELE = new THREE.Vector3(0, 0, -1);   // l'axe y du jeu (le cote), dans le repere du modele (Qi)
function faireFlotter(c: Corps, v: number, dt: number, t: number) {
  if (!c.tissu) { c.tissu = new Map(); for (const [n, b] of c.m.os) if (TISSU[n]) c.tissu.set(b, { a: 0, w: 0, p: null }); }
  if (!c.tissu.size) return;
  c.m.racine.updateMatrixWorld(true);
  const racine = c.m.racine.children[0];
  const lat = _ax.copy(LATERAL_MODELE).applyQuaternion(racine.getWorldQuaternion(_qw)).normalize();
  const vite = Math.min(1, Math.max(0, v / 11)), h = Math.min(0.05, dt || 0.016);
  for (const [b, e] of c.tissu) {
    const r = TISSU[b.name], parent = b.parent!;
    // l'angle du parent autour de l'axe lateral (sa direction, rapportee au bas)
    parent.getWorldQuaternion(_qp);
    _dir.set(0, 1, 0).applyQuaternion(_qp);
    _bas.set(0, -1, 0).applyQuaternion(_qw);
    const ap = Math.atan2(_bas.clone().cross(_dir).dot(lat), _bas.dot(_dir));
    if (e.p !== null) e.a -= (ap - e.p) * r.inertie;           // l'inertie : le tissu garde (en partie) son orientation
    e.p = ap;
    const cible = r.vent * vite * vite + r.claque * vite * Math.sin(t * 17 + b.id);
    e.w += (r.k * (cible - e.a) - r.amort * e.w) * h;
    e.a = Math.max(-r.borne, Math.min(r.borne, e.a + e.w * h));
    // la rotation, autour de l'axe lateral exprime dans le repere du parent
    const axe = _dir.copy(lat).applyQuaternion(_qp.invert()).normalize();
    b.quaternion.copy(c.m.reposLocal.get(b)!).premultiply(new THREE.Quaternion().setFromAxisAngle(axe, e.a));
  }
}

export const _M = new THREE.Matrix4(), _S = new THREE.Matrix4(), _T = new THREE.Matrix4();
/** Le maillage du coureur, pose et place ; faux s'il n'est pas (encore) la. */
export function poserLeCorps(App: any, r: any, p: number[], cap: number, lean: number, k: number): boolean {
  const c = corpsDe(r);
  if (!c || !r.squelette) return false;
  poser(c.m, r.squelette);
  const [ex, ey, ez] = App.repereDuCoureur(r, cap, lean, false, false);
  _M.set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0, ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
  const ke = k * (c.echelle || 1);
  c.m.racine.matrix.multiplyMatrices(_T.makeTranslation(p[0], p[1], salleActive ? zSol(p[0], p[1]) : 0), _S.makeScale(ke, ke, ke))
    .multiply(_M).multiply(Qgl);
  c.m.racine.matrixWorldNeedsUpdate = true;
  c.m.racine.visible = true;
  const maintenant = performance.now() / 1000;
  faireFlotter(c, r.v || 0, c.tPrec ? maintenant - c.tPrec : 1 / 60, maintenant);
  c.tPrec = maintenant;
  return true;
}
