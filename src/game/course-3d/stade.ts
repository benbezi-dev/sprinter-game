// LA COURSE EN VRAIE 3D — le stade de l'etape, aux couleurs du theme du jeu (decoupe de course-3d.ts, 11/11/2026).

import { sponsorDeLaCourse } from '../panneaux';
import * as THREE from 'three';
import { construirePlage } from '../plage-3d';
import { construireAmsalem, habillerLeTartan, pelouseAmsalem, TRIBUNE_AMSALEM, RANGS_AMSALEM } from '../amsalem-3d';
import { construirePalais, cristalTaille } from '../palais-3d';
import { construireSalle, zSol, SALLE_LUMIERE, SALLE_NUIT, SALLE_FINALE, placesDuPublic } from '../salle-3d';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { construireRuelle, type Ruelle } from '../ruelle-3d';
import { construireLegende } from '../legende-3d';
import { construireMenole } from '../menole-3d';
import { construireChamp, BLEU, BLANC, ROUGE } from '../champ-de-mars-3d';
import { pisteMouillee } from '../piste-mouillee';
import { flotter, toileDeDrapeau } from '../drapeau-3d';
import { arbresDuLieu, riviera, nuitEtoilee, pelouseAuPinceau, zeroGames } from '../stades-classiques-3d';
import { DROITE1, DROITE0_100, LANE_W, tourDuChamp, Q, R_CORDE, VIRAGE_SEG, PUBLIC } from './reglages';
import { ULTRA, palier } from './paliers';
import { monde, texteCanvas, scene, hemi, soleil, renderer } from './scene';
import { salleActive, ici, milieu, capIci } from './repere';
import { chargerLaPlage, uFoule, atlasPlage, atlasPublic, P_SIL, P_GESTES, laFoule } from './public';
import { carteNeon, retirerLaPluie, oublierLEspace, espaceAutour, pieceDuStade, planetesSousLaPiste, voute, villeNeon, poserLesPieces } from './decors';
import { lExtinction, presente, presenteTexte, lesLampesDuPublic, laPresentationAuSol, DUREE_EXTINCTION, lesLignesRouges, lArriveeEnOr } from './salle-noire';
import { uLisere, eclairerLesCorps, uLisereCoul, uLisereForce, uLisereFace, blocLots, _T } from './corps';
import { soleilDecal } from './camera';

let envPalais: THREE.Texture | null = null;
// LE REFLET DU STADE NEON (23/10, « plus de reflets de ce type sur la piste du stade cyberpunk ») :
// une ville de neons — barres magenta, cyan, violettes, enseignes jaunes — cuite une fois en
// carte d'environnement, que la laque mouillee de la piste renvoie
let envNeon: THREE.Texture | null = null;
let miroir: { dispose(): void } | null = null;
// le Champ-de-Mars porte `angle: 15` en 2D pour que la tour tienne dans le ciel : en 3D, un profil plus bas qui vise plus haut
export let profilBas = false;
export let amsalemActif = false;
// le stade a-t-il l'anneau complet apres l'arrivee ? (pas le Champ-de-Mars, ni le stade Amsalem : voir virageApres)
export let virageApresLigne = true;
// le Stade Neon : ses hologrammes (qui gresillent) et sa pluie (qui suit la camera)
export let hologrammes: THREE.Mesh[] = [];
// la nuit du molosse : sa ruelle (ruelle-3d.ts) et sa bete (molosse.glb)
export let ruelle: Ruelle | null = null;
// la Carriere Legende : ses decors (legende/decors.ts), charges a la demande — le canal de test seul les sert
let legendeDecors: typeof import('../legende/decors') | null = null, legendeNuages: typeof import('../legende/nuages') | null = null;
let legendeDemande = false, legendeEssais = 0;
// les panneaux animes et le film de l'ecran geant (voir LES PANNEAUX LED)
// (t, et la camera dans le repere du stade : ce qui doit tenir au loin, comme la tour du Champ-de-Mars)
export let pubAnim: ((t: number, camX: number, camY: number, cap: number) => void)[] = [], videoPub: HTMLVideoElement | null = null;
// --- LE STADE, AUX COULEURS DU THEME DU JEU ----------------------------------
//
// Chaque stade du jeu est un theme (THEMES, sprinter-app.js) : ciel, pelouse et
// sa tonte, piste, marches et contremarches des gradins, toit, barriere,
// panneaux, public, feuillage. Le stade 3D se construit sur ces memes couleurs :
// l'etape en cours a donc sa version 3D sans rien dessiner de plus, et un
// changement d'etape le reconstruit.
//
// UN VRAI STADE, PAS UN DECOR DE THEATRE. La ligne droite tient dans un anneau
// complet : deux virages, la ligne opposee, une tribune principale a deux
// etages (loges vitrees, toit, facade), des tribunes qui suivent les virages et
// la ligne opposee, quatre pylones d'eclairage, un ecran geant, des drapeaux,
// des arbres et des nuages autour ; sur la piste, les blocs, le portique du
// chrono, des officiels et des photographes a l'arrivee. La camera se tient du
// cote de la corde : la tribune principale est en face, derriere ses panneaux.
//
// TOUT CE QUI SE REPETE EST INSTANCIE : marches, sieges, spectateurs, poteaux,
// troncs, feuillages — un appel de dessin par sorte d'objet, quel que soit le
// nombre. Le public est fait de deux formes basses (un buste, une tete de
// vingt faces) : une dizaine de milliers de gens pour quelques centaines de
// milliers de triangles. `?public=0.5` en met deux fois moins.
// shortcut: les pieces de decor propres a chaque stade (images Blender du jeu,
// cuites pour sa vue 2D) ne sont pas reprises : seul le theme l'est.
export let stade: THREE.Group | null = null;
export let themeVu: any = null, formeVue = '';
/** Le stade se refait a la prochaine image (une piece, un atlas, un corps vient d'arriver). */
export function refaireLeStade() { formeVue = ''; }
export function stadeVu(brut: any, forme: string) { themeVu = brut; formeVue = forme; }
// LES BLOCS DE L'ANNEAU S'ENLEVENT (« les starting-blocks doivent disparaitre du depart du 200 m une fois
// la course lancee, pour le 200 m et le 400 m », l'auteur, 27/10) : comme le font les officiels, des que
// tout le monde a quitte les blocs ; on les y revoit au depart suivant. Le 60 m garde les siens.
export const blocsSalle: THREE.Object3D[] = [];
// LE TOIT DES TRIBUNES S'EFFACE SOUS LA CAMERA HAUTE (« la camera filme le dessus du toit dans la
// derniere ligne droite », stades couverts) : sur un telephone en portrait, en vue 2D, la camera passe au-dessus
// du toit en porte-a-faux (21 m aux Mondiaux), qui remplissait tout l'ecran. On le cache quand la camera passe au-dessus de lui, hors survol — comme le plafond
// de la salle (salle-3d.ts). zTop : la hauteur du toit, dans le repere du stade.
export const toitsStade: { obj: THREE.Object3D; zTop: number }[] = [];
export let cameraSalle: ((x: number, y: number, z: number, survol: boolean, cam?: THREE.Camera, vise?: THREE.Vector3) => void) | null = null;
/** La finale : le couloir presente (-1 : aucun) et le point ou s'ecrit son nom — la camera le cadre. */
export let finaleVue = false;
export const c3 = (v: number[] | undefined, d: number[]) => {
  const a = v || d;
  return new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);
};
export const css = (v: number[], k = 1) => `rgb(${Math.min(255, v[0] * k) | 0},${Math.min(255, v[1] * k) | 0},${Math.min(255, v[2] * k) | 0})`;

// LE SOL EN COUCHES (27/10, « le beug du dernier couloir vers la droite », sur toutes les pistes) : la nuit, la
// bande au pied des tribunes, les nappes des projecteurs et le halo des panneaux se posaient a 4, 6 et 7 mm, en
// debordant sur le dernier couloir et la bande exterieure. A cette distance, un GPU de telephone ne les departage
// plus : la nappe beige ne passait que par morceaux, en dents de scie. Rien ne deborde plus sur le tartan, et ce
// qui se pose dessus (la lumiere, en addition) monte d'un centimetre par couche — invisible a hauteur d'homme.
const SOL_BORD = 0.01, SOL_LUMIERE = 0.02, SOL_LUEUR = 0.03;

function plan(w: number, l: number, mat: THREE.Material, x: number, y: number, z = 0) {
  // CE QUI EST PEINT SUR LA PISTE PASSE DEVANT ELLE (24/10) : les couloirs alternes sont tires en avant
  // (polygonOffset, voir LES LIGNES EN POINTILLES) ; sans le meme reglage, plus fort, le damier
  // d'arrivee, les numeros et les halos n'apparaissaient plus qu'un couloir sur deux
  if (z > 0 && !mat.polygonOffset) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  stade!.add(m);
  return m;
}

/** Un lot d'objets identiques, poses un par un puis rendus en un seul InstancedMesh. */
class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(m: THREE.Matrix4, c: THREE.Color | null = null) { this.m.push(m.clone()); this.c.push(c ? c.clone() : null); }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
    return im;
  }
}

const _bx = new THREE.Matrix4(), _tr = new THREE.Matrix4(), _sc = new THREE.Matrix4();
/** Une boite du repere local `M` : centre (x, y, z), cotes (lx, ly, lz). */
function boite(lot: Lot, M: THREE.Matrix4, x: number, y: number, z: number, lx: number, ly: number, lz: number, c: THREE.Color | null = null) {
  lot.poser(_bx.copy(M).multiply(_tr.makeTranslation(x, y, z)).multiply(_sc.makeScale(lx, ly, lz)), c);
}

/** Les couleurs du public : peaux, maillots, cheveux, pantalons (le stade et la salle). */
function paletteDuPublic(th: any, luxe: boolean, cyber: boolean) {
  const couleur = (v: number[]) => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace);
  const lo = th.crowdLo || [43, 38, 56], hi = th.crowdHi || [252, 242, 230];
  // au luxe, le public est en tenue de soiree : surtout du noir, un peu de creme, d'or, de bordeaux
  const maillots: number[][] = cyber
    ? [[10, 10, 16], [18, 16, 26], [26, 20, 40], [10, 40, 50], [40, 10, 36], [10, 10, 16], [0, 200, 230], [230, 40, 190]]
    : luxe
    ? [[14, 13, 15], [20, 19, 22], [28, 25, 24], [38, 32, 28], [14, 13, 15], [201, 164, 92], [217, 207, 189], [74, 20, 24]]
    : [...(th.panels || [[231, 60, 45], [28, 106, 202], [255, 203, 55], [50, 162, 121]]), lo, hi, [240, 240, 240]];
  // HUIT TEINTES DE PEAU, LA MOITIE NOIRES ET BRUNES (« il n'y a pas de personnes noires ? »,
  // l'auteur, 22/10) : a deux sur cinq, sur des visages de quelques pixels, elles ne se voyaient pas
  const peaux = [[44, 28, 20], [66, 42, 30], [92, 58, 38], [120, 76, 50], [160, 108, 70], [196, 142, 98],
    [224, 186, 142], [246, 220, 190]].map(couleur);
  const coulMaillots = maillots.map(couleur);
  const coulCheveux = [[28, 20, 16], [58, 38, 24], [104, 70, 40], [196, 160, 98], [140, 136, 132]].map(couleur);
  const coulPantalons = [[30, 38, 68], [24, 24, 28], [58, 84, 128], [196, 178, 142], [96, 98, 104]].map(couleur);
  return { peaux, coulMaillots, coulCheveux, coulPantalons };
}

export function construireLeStade(nCouloirs: number, th: any, T: any, C: any, stadeCle: string | null, etape: number, affluence = 1) {
  // le virage du depart : celui du stade sur un virage, plus loin derriere au 100 m (sa ligne droite est plus longue)
  const DROITE0 = T.curved ? DROITE1 - T.straight : DROITE0_100;
  if (stade) { monde.remove(stade); stade.traverse((o: any) => { o.geometry?.dispose?.(); }); }
  if (miroir) { miroir.dispose(); miroir = null; }
  stade = new THREE.Group();
  monde.add(stade);
  toitsStade.length = 0;
  const W = nCouloirs * LANE_W;
  let alea = 7;
  const hasard = () => ((alea = (alea * 16807) % 2147483647) / 2147483647);
  const couleur = (v: number[]) => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace);
  const base = (import.meta as any).env?.BASE_URL || '/';

  // LE CIEL, en degrade, et ses nuages
  const ciel = texteCanvas((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(th.skyTop || [57, 73, 178])); g.addColorStop(1, css(th.skyBot || [71, 87, 192], 1.3));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 4, 256);
  scene.background = ciel;
  scene.fog = new THREE.Fog(c3(th.skyBot, [71, 87, 192]).getHex(), 160, 420);
  // LA NUIT : un ciel sombre (ou etoile) eteint le soleil et allume les projecteurs du
  // stade — une lumiere froide et dure, une ambiance basse, la foule dans la penombre.
  const ct = th.skyTop || [68, 81, 167];
  // LE PALAIS ROYAL (palais-3d.ts) : un interieur — ni ciel, ni heure, ni gradins ; la lumiere des lustres
  const palais = !!th.palais;
  // LE CHAMP-DE-MARS (champ-de-mars-3d.ts) : pas de stade, une tribune provisoire d'un gradin, la piste tricolore
  const cdm = !!th.champDeMars;
  // LE STADE BERNARD AMSALEM (amsalem-3d.ts) : un lieu reel — sa tribune, sa halle, ses mats ; rien du stade generique
  const amsalem = !!th.amsalem;
  virageApresLigne = !cdm && !amsalem;
  amsalemActif = amsalem;
  // ... son EDITION CHAMPIONNAT DE FRANCE (THEMES.amsalemFrance) : panneaux LED, ecran geant, arche, mats allumes
  const championnat = amsalem && !!th.championnat;
  profilBas = cdm;
  // LA PISTE ARC-EN-CIEL : un couloir, une couleur pure (piste-arc-en-ciel.js en 2D)
  const arc: number[][] | null = th.arcEnCiel || null;
  // (le Danube porte `heure: 'nuit'` : hors de la nuit, son ciel est celui de l'heure bleue, mais ses projecteurs restent allumes)
  const nuit = !palais && (th.heure === 'nuit' || !!th.stars || 0.3 * ct[0] + 0.59 * ct[1] + 0.11 * ct[2] < 60);
  // LE LUXE (Stade d'Or) : la nuit y est chaude — des projecteurs couleur d'or sur une
  // piste laquee, une ambiance presque nulle, la foule dans l'ombre (StadeOr.cs, Unity).
  const luxe = !!th.luxe;
  // LE STADE NEON (cyberpunk, StadeCyber.cs) : une nuit violette, des neons, la pluie
  const cyber = !!th.cyber;
  // LA PLAGE (plage-3d.ts) : un soleil bas et dore de fin d'apres-midi, pas de gradins
  // la plage de Menole (Carriere Legende) : la lumiere et l'absence de gradins d'une plage,
  // mais son decor a elle (menole-3d.ts), pas celui de la Plage Paradis
  const menole = stadeCle === 'legende-menole';
  const plage = !!th.plage || menole;
  if (plage) chargerLaPlage();
  uFoule.uAtlas.value = plage ? atlasPlage : atlasPublic;
  hemi.color.set(luxe ? 0x6a5638 : cyber ? 0x9a38d8 : plage ? 0xffe2c0 : nuit ? 0x7a88c0 : 0xdfefff);
  hemi.groundColor.set(luxe ? 0x080604 : cyber ? 0x1c0634 : plage ? 0xd8b080 : nuit ? 0x1a1f2a : 0x5a7a40);
  hemi.intensity = luxe ? 0.45 : cyber ? 0.7 : plage ? 1.25 : nuit ? 0.6 : 1.6;
  soleil.color.set(luxe ? 0xffd49a : cyber ? 0xe0a0ff : plage ? 0xffc58a : nuit ? 0xe6eeff : 0xfff4e0);
  soleil.intensity = luxe ? 2.6 : cyber ? 1.7 : plage ? 2.6 : nuit ? 2.0 : 2.2;
  soleilDecal.set(plage ? 22 : -10, plage ? 50 : -18, plage ? 16 : 30);   // a la plage, bas, au-dessus de la mer
  // LA LUMIERE DE L'HEURE (heure-du-jour.js : le theme du moment porte `moment`). Le jour
  // reste tel quel ; l'apres-midi le soleil baisse et se rechauffe ; le soir il est orange
  // et rasant, les ombres s'allongent ; la nuit, ce sont les projecteurs (plus haut).
  const moment = th.moment || 'jour';
  if (!luxe && !cyber && !plage && !th.espace && !nuit && moment === 'apres-midi') {
    hemi.color.set(0xfff0dc); hemi.intensity = 1.45;
    soleil.color.set(0xffe2b8); soleil.intensity = 2.3;
    soleilDecal.set(-30, -14, 20);
  } else if (!luxe && !cyber && !plage && !th.espace && !nuit && moment === 'soir') {
    // (trop rasant au premier essai, a 11 m : le soleil n'eclairait plus le sol, et le soir
    // sortait aussi sombre que la nuit)
    hemi.color.set(0xffd0b0); hemi.groundColor.set(0x806050); hemi.intensity = 1.35;
    soleil.color.set(0xffa860); soleil.intensity = 2.8;
    soleilDecal.set(-40, -12, 20);
    uFoule.uLum.value = 0.92;
  }
  uFoule.uLum.value = luxe ? 0.42 : cyber ? 0.5 : nuit ? 0.7 : 1;
  if (plage && nuit) {
    // LA PLAGE DE NUIT : la lune au-dessus de la mer, une ambiance bleue, les torches (plage-3d.ts)
    // la lumiere qui porte les ombres vient de la mer, des yachts : chaude ; la lune ne fait que l'ambiance
    hemi.color.set(0x5a6a9a); hemi.groundColor.set(0x3a3024); hemi.intensity = 0.7;
    soleil.color.set(0xffc890); soleil.intensity = 1.6;
    // a Menole, pas de yachts : la lumiere qui porte les ombres est celle de la lune
    if (menole) { soleil.color.set(0xb8c8ff); soleil.intensity = 1.2; }
  }
  uLisere.value = luxe || cyber ? 1 : 0;
  eclairerLesCorps(null);
  uLisereCoul.value.set(cyber ? 0x30e8ff : 0xffc76b);
  // au Stade Neon, le lisere reste un fil (« les neons sur les personnages sont trop forts,
  // un jeu de lumiere qui fait qu'on les voit clairement », 22/10) : la lumiere de face fait le reste
  uLisereForce.value = cyber ? 0.22 : 0.45;   // Stade d'Or : moitie moins (« reduis la lumiere qui emane du joueur », 22/10)
  uLisereFace.value = cyber ? 1 : 0;   // le Stade d'Or garde le reglage valide
  // LES COUREURS SE VOIENT PARFAITEMENT DE NUIT (« les assets doivent etre visible parfaitement de nuit », l'auteur,
  // 08/11 soir) : sous une ambiance a 0,6 et des projecteurs froids venus d'en face, la camera de course les filmait a
  // contre-jour, presque noirs. Comme a la television, une lumiere blanche douce venue de la camera (la meme que celle
  // du Stade Neon, uLisereFace) et un fil de lisere a peine visible. Les nuits qui ont deja leur reglage le gardent.
  if (nuit && !luxe && !cyber && !plage) {
    uLisere.value = 1; uLisereCoul.value.set(0xe6ecff); uLisereForce.value = 0.16; uLisereFace.value = 1;
  }
  if (plage && nuit) {
    // la plage de nuit : les yachts eclairent de la mer, les coureurs vus de la piste sont a
    // contre-jour — un liseré chaud (les bateaux) et la lumiere de face du Stade Neon
    uLisere.value = 1; uLisereCoul.value.set(0xffc890); uLisereForce.value = 0.35; uLisereFace.value = 1;
  }
  uFoule.uSiege.value.set(luxe ? 0x1a1714 : cyber ? 0x14121e : plage ? 0xec7860 : palais ? 0x8a0f1e : 0x2457b8);
  // la couleur des sieges du stade (tribune.js, SIEGES) : un stade a UNE couleur de sieges
  const siegeDuStade = stadeCle && (globalThis as any).Tribune?.SIEGES?.[stadeCle];
  if (siegeDuStade && !luxe && !cyber && !plage && !palais) uFoule.uSiege.value.copy(c3(siegeDuStade, siegeDuStade));
  if (palais) {
    // la lumiere chaude des lustres, de haut ; une brume doree qui fond le fond de la galerie
    hemi.color.set(0xfff0d8); hemi.groundColor.set(0x9a7448); hemi.intensity = 1.2;
    soleil.color.set(0xffdcaa); soleil.intensity = 2.0; soleilDecal.set(-8, -10, 40);
    scene.background = new THREE.Color(0x2a1c12);
    scene.fog = new THREE.Fog(0xcaa878, 150, 560);
    uFoule.uLum.value = 0.95;
    uLisere.value = 1; uLisereCoul.value.set(0xffd890); uLisereForce.value = 0.22; uLisereFace.value = 0;
    if (!envPalais && renderer) envPalais = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  }
  if (cyber && !envNeon && renderer) envNeon = carteNeon(renderer);
  if (plage) scene.fog = nuit ? new THREE.Fog(0x0c1530, 220, 1100) : new THREE.Fog(0xf3c9a2, 260, 1300);
  if (luxe) scene.fog = new THREE.Fog(c3(th.skyBot, [28, 21, 13]).getHex(), 70, 300);
  if (cyber) {
    // les couleurs du Stade Neon poussees (« accentue au niveau des couleurs », 22/10) : un ciel
    // magenta sur violet profond, une brume violette, des lumieres plus saturees
    scene.background = texteCanvas((c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#12042a'); g.addColorStop(0.6, '#3a0c5e'); g.addColorStop(1, '#a3168c');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 4, 256);
    scene.fog = new THREE.Fog(0x2c0a46, 50, 420);
  }
  hologrammes = [];
  pubAnim = [];
  if (videoPub) { videoPub.pause(); videoPub.removeAttribute('src'); videoPub.load(); videoPub = null; }
  retirerLaPluie();
  // L'ESPACE (Intergalactique, Arc-en-ciel) : pas de pelouse, la piste FLOTTE dans le vide
  // (decor-cosmos.js en 2D) — des etoiles et des nebuleuses tout autour ET en dessous, des
  // planetes loin sous la piste, une galaxie, ses bords en neon (« une atmosphere plus
  // cosmique, la piste qui flotte dans l'espace », l'auteur, 22/10).
  const espace = !!th.espace;
  oublierLEspace();
  if (salleActive) {
    // LA SALLE : sous le toit — ni ciel, ni pelouse, ni gradins du stade ; sa propre lumiere, de jour ou de nuit
    // (le theme `salle` ne suit pas l'heure : on lit le moment du joueur, ?heure= compris)
    const nuitSalle = (globalThis as any).SprinterHeure?.moment((globalThis as any).SprinterApp?.G) === 'nuit';
    // LA COMPETITION DANS LE NOIR (Championnat de France du 19/12 ; l'auteur, 8/11 : « toute la competition se deroulera
    // dans le noir ; une animation pour passer de la salle classique a la salle dans le noir pour chaque serie, ensuite
    // on garde la salle dans le noir pour les demies et la finale »). En attendant le branchement au championnat :
    // ?serie=1 (la salle allumee s'eteint avant la presentation), ?finale=1 (demies et finale : deja dans le noir),
    // seulement une fois la salle noire ouverte par le serveur (noirOuvert).
    const tourChamp = tourDuChamp();
    const finaleNoire = tourChamp !== null;
    const SL0 = nuitSalle ? SALLE_NUIT : SALLE_LUMIERE;
    scene.background = new THREE.Color(SL0.fond);
    scene.fog = new THREE.Fog(SL0.brume, 110, 320);
    soleilDecal.set(-6, 10, 40);
    uLisere.value = 0;
    /** La lumiere de la salle, de 1 (allumee, SL0) a 0 (eteinte, SALLE_FINALE) : le ciel, la brume, les lumieres, le public. */
    const _c0 = new THREE.Color(), _c1 = new THREE.Color();
    const eclairerSalle = (k: number) => {
      const melange = (a: number, b: number, c: THREE.Color) => c.copy(_c0.set(b)).lerp(_c1.set(a), k);
      melange(SL0.fond, SALLE_FINALE.fond, scene.background as THREE.Color);
      melange(SL0.brume, SALLE_FINALE.brume, (scene.fog as THREE.Fog).color);
      melange(SL0.hemiCiel, SALLE_FINALE.hemiCiel, hemi.color); melange(SL0.hemiSol, SALLE_FINALE.hemiSol, hemi.groundColor);
      melange(SL0.soleilCouleur, SALLE_FINALE.soleilCouleur, soleil.color);
      hemi.intensity = SALLE_FINALE.hemi + (SL0.hemi - SALLE_FINALE.hemi) * k;
      soleil.intensity = SALLE_FINALE.soleil + (SL0.soleil - SALLE_FINALE.soleil) * k;
      uFoule.uLum.value = 0.32 + 0.68 * k;
    };
    eclairerSalle(tourChamp === 'noir' ? 0 : 1);
    if (!envPalais && renderer) envPalais = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    eclairerLesCorps(envPalais);
    const base = (import.meta as any).env?.BASE_URL || '/';
    const salle = construireSalle({ stade, renderer, base, nuit: nuitSalle, finale: finaleNoire, droite: !T.curved });
    pubAnim.push(salle.animer); cameraSalle = salle.camera;
    if (tourChamp) {
      salle.eteindre(tourChamp === 'noir' ? 0 : 1, tourChamp === 'noir' ? 1 : 0);
      if (tourChamp === 'serie') pubAnim.push(lExtinction(salle.eteindre, eclairerSalle));
    }
    // L'ECRAN GEANT DE LA SALLE (l'auteur, 8/11) : le film de promotion quinze secondes, puis six secondes de la
    // campagne en cours (panneaux.ts) ou, sans campagne, du logo BENBEZI balaye d'un reflet ; en boucle
    {
      const film = document.createElement('video');
      film.src = base + (ULTRA ? 'pubs/videos/sprinter-direct.mp4' : 'pubs/videos/sprinter-direct-640.mp4');
      film.muted = true; film.loop = true; film.playsInline = true; film.preload = 'auto'; film.setAttribute('playsinline', '');
      videoPub = film;
      const tFilm = new THREE.VideoTexture(film); tFilm.colorSpace = THREE.SRGBColorSpace;
      const logo = new Image(); logo.src = base + 'pubs/benbezi-logo-3d-cadre-halo.webp';
      const toileE = document.createElement('canvas'); toileE.width = 1024; toileE.height = 512;
      const ce = toileE.getContext('2d')!, tE = new THREE.CanvasTexture(toileE); tE.colorSpace = THREE.SRGBColorSpace;
      const matG = salle.ecranGeant; matG.map = tE; matG.needsUpdate = true;
      let imageE = -1;
      pubAnim.push(t => {
        if (film.paused) film.play().catch(() => {});
        // PENDANT LA PRESENTATION, l'ecran montre l'athlete presente, comme a la television (l'auteur, 9/11 : « une
        // atmosphere de grande competition ») : son couloir, son nom (TOI pour le joueur), le titre de l'epreuve
        if (finaleVue && presente >= 0) {
          matG.map = tE;
          const img = Math.floor(t * 30); if (img === imageE) return; imageE = img;
          const w = 1024, h = 512, moi = presenteTexte === 'TOI';
          ce.globalCompositeOperation = 'source-over';
          const fond = ce.createLinearGradient(0, 0, w, h); fond.addColorStop(0, '#020616'); fond.addColorStop(1, '#0a1640');
          ce.fillStyle = fond; ce.fillRect(0, 0, w, h);
          ce.fillStyle = moi ? '#ffd34a' : '#3d7bff'; ce.fillRect(0, 0, 230, h);
          ce.textAlign = 'center'; ce.textBaseline = 'middle'; ce.fillStyle = '#04050a';
          ce.font = '900 44px Outfit, system-ui, sans-serif'; ce.fillText('COULOIR', 115, 150, 196);
          ce.font = '900 230px Outfit, system-ui, sans-serif'; ce.fillText(String(presente + 1), 115, 315);
          ce.textAlign = 'left'; ce.fillStyle = moi ? '#ffd34a' : '#f2f8ff';
          ce.font = '900 110px Outfit, system-ui, sans-serif'; ce.fillText(presenteTexte, 270, 250, w - 300);
          ce.fillStyle = 'rgba(200,220,255,0.75)'; ce.font = '700 38px Outfit, system-ui, sans-serif';
          ce.fillText('CHAMPIONNAT DE FRANCE · SALLE', 274, 360, w - 300);
          // le liseré qui balaie l'ecran
          const x = ((t % 3) / 3 * 1.6 - 0.3) * w, g = ce.createLinearGradient(x - 90, 0, x + 90, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ce.globalCompositeOperation = 'lighter'; ce.fillStyle = g; ce.fillRect(0, 0, w, h);
          tE.needsUpdate = true;
          return;
        }
        const cycle = t % 21;
        if (cycle < 15 && film.readyState >= 2) { matG.map = tFilm; return; }
        matG.map = tE;
        const img = Math.floor(t * 30); if (img === imageE) return; imageE = img;   // (30 images/s suffisent)
        const w = 1024, h = 512, u = ((cycle - 15 + 6) % 6) / 6;
        ce.globalCompositeOperation = 'source-over'; ce.fillStyle = '#04050a'; ce.fillRect(0, 0, w, h);
        const sponsor = sponsorDeLaCourse((globalThis as any).SprinterApp?.G);
        if (sponsor) ce.drawImage(sponsor, w * 0.06, (h - w * 0.88 / 4) / 2, w * 0.88, w * 0.88 / 4);   // (1000 x 250, sans deformer)
        else if (logo.complete && logo.naturalWidth) { const lw = w * 0.86, lh = lw * logo.naturalHeight / logo.naturalWidth; ce.drawImage(logo, (w - lw) / 2, (h - lh) / 2, lw, lh); }
        // le reflet qui traverse l'ecran
        const x = (u * 1.8 - 0.4) * w, g = ce.createLinearGradient(x - 120, 0, x + 120, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ce.globalCompositeOperation = 'lighter'; ce.fillStyle = g; ce.fillRect(0, 0, w, h);
        tE.needsUpdate = true;
      });
    }
    // le public de la salle : les memes cartes que le stade (LE PUBLIC, EN CARTES)
    if (Q.get('foule') !== '0') {
      const pal = paletteDuPublic(th, false, false), cartes: number[] = [], lampes: number[] = [];
      const choix = (t: THREE.Color[]) => t[(hasard() * t.length) | 0];
      for (const p of placesDuPublic(affluence, hasard)) {
        // dans le noir, quatre spectateurs sur dix levent leur telephone, lampe allumee, a hauteur de tete
        if (finaleNoire && hasard() < 0.4) lampes.push(p.x, p.y, p.z + (p.debout ? 1.7 : 1.3));
        const u = hasard(), geste = p.debout ? 3 : u < 0.6 ? 0 : u < 0.85 ? 1 : 2;
        cartes.push(p.x, p.y, p.z, p.face, ((hasard() * P_SIL) | 0) * P_GESTES + geste, hasard());
        for (const c of [choix(pal.peaux), choix(pal.coulMaillots), choix(pal.coulCheveux), choix(pal.coulPantalons)]) cartes.push(c.r, c.g, c.b);
      }
      if (cartes.length) { const f = laFoule(cartes); f.userData.sansReflet = true; salle.interieur.add(f); }
      if (lampes.length) pubAnim.push(lesLampesDuPublic(salle.interieur, lampes, hasard));
    }
    // LES BLOCS DE DEPART (« il n'y a de starting-block sur aucune epreuve », l'auteur, 26/10) : les
    // memes que dehors, au milieu de chaque couloir, la ou le coureur part — a la hauteur du releve
    blocsSalle.length = 0;
    if (blocLots) for (const { geo, mat } of blocLots) {
      const l = new Lot(geo, mat, true);
      for (let k = 0; k < (T.lanes || nCouloirs); k++) {
        const p = ici(T.posDemi(0, k, milieu(T, k))), a = capIci(T.heading(0, k));
        l.poser(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), a).setPosition(p[0], p[1], zSol(p[0], p[1])));
      }
      const n0 = salle.interieur.children.length;
      l.finir(salle.interieur);
      blocsSalle.push(...salle.interieur.children.slice(n0));
    }
    finaleVue = finaleNoire;
    // (en serie, la presentation attend la fin de l'extinction)
    if (finaleNoire) pubAnim.push(laPresentationAuSol(T, salle.interieur, salle.fleches, tourChamp === 'serie' ? DUREE_EXTINCTION : 0));
    if (finaleNoire) pubAnim.push(lesLignesRouges(salle.alerte), lArriveeEnOr(T, salle.interieur));
    // UNE SEULE PASSE POUR LES LUMIERES ADDITIVES (mesure du 8/11 : la salle noire perdait la moitie de ses images) :
    // three dessine une matiere transparente double face en deux passes, dos puis face, en la marquant a recompiler
    // a chacune — une verification de programme par dessin, pour les neons, les fleches et les noms. En additif,
    // l'ordre des faces ne change rien a l'image.
    salle.interieur.traverse((o: any) => {
      for (const m of [].concat(o.material || []) as THREE.Material[])
        if (m.transparent && m.side === THREE.DoubleSide && m.blending === THREE.AdditiveBlending && !m.depthWrite) m.forceSinglePass = true;
    });
    return;
  }
  if (espace) espaceAutour(th, hasard);
  if (th.stars) {
    const n = Math.min(espace ? 4000 : 2500, th.stars * (espace ? 16 : 8)), pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = hasard() * Math.PI * 2, h = espace ? Math.asin(hasard() * 2 - 1) : 0.08 + hasard() * 0.9, r = 380;
      pts.set([44 + r * Math.cos(a) * Math.cos(h), -R_CORDE + r * Math.sin(a) * Math.cos(h), r * Math.sin(h)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }
  if (!th.stars && !luxe && !cyber && !plage && !palais && !nuit) {
    // Des sprites loin autour du stade, comme a la plage : des plaques fixes a 300 m se
    // voyaient de biais et de pres pendant le survol — des taches blanches coupees net.
    // Les bouffees restent dans la toile (x 0,2-0,8, rayon <= 0,34 h) : aucun bord droit.
    const nuages = [0, 1, 2].map(() => texteCanvas((c, w, h) => {
      for (let i = 0; i < 22; i++) {
        const x = w * (0.2 + 0.6 * hasard()), y = h * (0.38 + 0.24 * hasard()), r = h * (0.12 + 0.22 * hasard());
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
    }, 256, 128));
    for (let i = 0; i < 16; i++) {
      const a = hasard() * Math.PI * 2, d = 480 + hasard() * 260, lg = 140 + hasard() * 180;
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: nuages[i % 3], transparent: true, depthWrite: false, fog: false }));
      n.position.set(44 + Math.cos(a) * d, -R_CORDE + Math.sin(a) * d, 90 + hasard() * 120);
      n.scale.set(lg, lg * (0.3 + hasard() * 0.15), 1);
      stade.add(n);
    }
  }

  ruelle = null;
  if (th.ruelle) {
    // LA NUIT DU MOLOSSE : la ruelle des Tanneurs a la place du stade, sur toute la
    // longueur de la nuit (ruelle-3d.ts). Une lune froide, une ambiance violette, les
    // reverberes font le reste ; les coureurs gardent un liseré chaud pour se detacher.
    hemi.color.set(0x4a3a72); hemi.groundColor.set(0x16101e); hemi.intensity = 0.55;
    soleil.color.set(0xb4c4ff); soleil.intensity = 1.1;
    soleilDecal.set(-6, 14, 30);
    scene.fog = new THREE.Fog(c3(th.skyBot, [46, 24, 58]).getHex(), 30, 150);
    uLisere.value = 1; uLisereCoul.value.set(0xffa860); uLisereForce.value = 0.3; uLisereFace.value = 1;
    ruelle = construireRuelle({ stade: stade!, T, W, R1: R_CORDE, ici, th, hasard, piece: pieceDuStade });
    return;
  }

  // LA PELOUSE et sa tonte en bandes
  const herbe = th.grass || [29, 115, 17], bord = th.grassEdge || [18, 91, 9];
  const tonte = texteCanvas((c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = css(herbe, i % 2 ? 0.88 : 1.06); c.fillRect(i * w / 8, 0, w / 8, h); }
  }, 256, 8);
  tonte.wrapS = THREE.RepeatWrapping; tonte.repeat.set(10, 1);
  // a Amsalem, l'herbe a du grain (amsalem-3d.ts)
  if (amsalem) { const p = pelouseAmsalem(herbe, hasard); tonte.image = p.image; tonte.wrapT = THREE.RepeatWrapping; tonte.repeat.set(10, 10); tonte.needsUpdate = true; }
  // (au Champ-de-Mars, le parc s'etend jusqu'aux facades)
  if (cdm) tonte.repeat.set(30, 1);
  // la Nuit etoilee peint sa pelouse a coups de pinceau ; la tonte « en long » suit la piste
  const pinceau = th.pinceau ? pelouseAuPinceau(th, hasard) : null;
  if (pinceau) { pinceau.wrapS = pinceau.wrapT = THREE.RepeatWrapping; pinceau.repeat.set(40, 40); }
  if (!espace && !plage && !palais) {
    const pel = plan(cdm ? 1200 : 400, cdm ? 1200 : 400, new THREE.MeshLambertMaterial({ map: pinceau || tonte }), 44, -R_CORDE, -0.1);
    if (th.tonte === 'long' && !pinceau) pel.rotation.z = Math.PI / 2;
  }

  // LA PISTE : les deux lignes droites et les deux virages, couloir par couloir
  const A = th.trackA || [148, 0, 0], B = th.trackB || A;
  // la piste du luxe est une laque : elle prend un reflet des projecteurs
  // ... et celle du Stade Neon, une chaussee mouillee qui renvoie les neons
  // ... et celle du palais, un cristal poli : reflet de la salle, une lueur bleutee
  const brillant = (c: THREE.Color) => palais ? cristalTaille(c, envPalais) : cyber ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.06, metalness: 0.6,
      envMap: envNeon, envMapIntensity: 0.8 })
    : luxe ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.1 }) : new THREE.MeshLambertMaterial({ color: c });
  const matA = brillant(c3(A, A)), matB = brillant(c3(B, B));
  const ligne = new THREE.MeshBasicMaterial({ color: c3(th.lane, [247, 242, 233]) });
  // LES LIGNES EN POINTILLES (« les lignes blanches au sol en pointille genent », l'auteur, 23/10) :
  // a un ou deux millimetres de la piste, vues au ras du sol (le rail), la profondeur ne les
  // departageait plus et la piste les coupait par endroits. Un decalage de profondeur les tient dessus.
  matB.polygonOffset = true; matB.polygonOffsetFactor = -1; matB.polygonOffsetUnits = -2;
  ligne.polygonOffset = true; ligne.polygonOffsetFactor = -2; ligne.polygonOffsetUnits = -4;
  const LD = DROITE1 - DROITE0, XD = (DROITE0 + DROITE1) / 2;
  const yOppose = -2 * R_CORDE - W;          // la ligne opposee, de l'autre cote de la pelouse
  // UNE PISTE PEINTE (arc-en-ciel, Champ-de-Mars) : une bande par couloir, en couleurs de sommet,
  // sur les deux lignes droites et les deux virages — la couleur suit le couloir (arc-en-ciel)
  // ou l'avancement de la course (le drapeau du Champ-de-Mars : bleu, perle, rouge)
  const peinte = !!arc || cdm;
  if (peinte) {
    const echant: number[][] = [];
    for (let d = 0; d <= T.total; d += 1) { const p = ici(T.pos(d, nCouloirs >> 1)); echant.push([p[0], p[1], d / T.total]); }
    const avance = (x: number, y: number) => {
      let best = Infinity, t = 0;
      for (const e of echant) { const q = (e[0] - x) ** 2 + (e[1] - y) ** 2; if (q < best) { best = q; t = e[2]; } }
      return t;
    };
    // les memes arrets qu'en 2D : le bleu tient le premier tiers, le rouge le dernier
    const ARRETS = [[0, 0], [0.30, 0], [0.47, 1], [0.53, 1], [0.70, 2], [1, 2]];
    const tricolore = (pal: number[][], t: number) => {
      for (let k = 1; k < ARRETS.length; k++) {
        const [t1, c1] = ARRETS[k], [t0, c0] = ARRETS[k - 1];
        if (t <= t1) { const u = (t - t0) / Math.max(1e-6, t1 - t0), e = u * u * (3 - 2 * u); return pal[c0].map((v, i) => v + (pal[c1][i] - v) * e); }
      }
      return pal[2];
    };
    const bande = (r0: number, r1: number, z: number, teinte: (x: number, y: number) => number[], mat: THREE.Material) => {
      const pos: number[] = [], col: number[] = [], c = new THREE.Color();
      const quad = (a: number[], b: number[], cc: number[], d: number[]) => {
        for (const p of [a, b, cc, a, cc, d]) {
          pos.push(p[0], p[1], z);
          const v = teinte(p[0], p[1]); c.setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace); col.push(c.r, c.g, c.b);
        }
      };
      for (let x = DROITE0; x < DROITE1 - 1e-6; x += 1) {
        const x2 = Math.min(DROITE1, x + 1);
        quad([x, r0 - R_CORDE], [x2, r0 - R_CORDE], [x2, r1 - R_CORDE], [x, r1 - R_CORDE]);
        quad([x, -R_CORDE - r1], [x2, -R_CORDE - r1], [x2, -R_CORDE - r0], [x, -R_CORDE - r0]);
      }
      for (const [xc, a0] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) for (let i = 0; i < VIRAGE_SEG; i++) {
        const a = a0 + (i / VIRAGE_SEG) * Math.PI, b = a0 + ((i + 1) / VIRAGE_SEG) * Math.PI;
        const P = (r: number, t: number) => [xc + r * Math.cos(t), -R_CORDE + r * Math.sin(t)];
        quad(P(r0, a), P(r0, b), P(r1, b), P(r1, a));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; stade!.add(m);
    };
    const PISTE = [BLEU, BLANC, ROUGE], LIGNE = [[255, 255, 255], [22, 40, 96], [255, 255, 255]];
    // sans eclairage a l'arc-en-ciel : « une piste de lumiere n'a pas de gris »
    // (hors de la courbe ACES : elle delavait les teintes pures en pastel — « trop pales », 23/10)
    const matP = arc ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })
      : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    // LE FONDU DE L'ARC-EN-CIEL (« je veux que la piste arc-en-ciel ressemble a la piste avec Mario, avec un fondu des
    // couleurs ; la notre est trop seche », l'auteur, 28/10) : chaque couloir est pur en son milieu et se fond dans ses
    // voisins vers ses bords — quatre bandes par couloir, la teinte suit le rayon (pas la course)
    const rayonEn = (x: number, y: number) => x >= DROITE0 && x <= DROITE1 ? Math.abs(y + R_CORDE)
      : Math.hypot(x - (x > DROITE1 ? DROITE1 : DROITE0), y + R_CORDE);
    const fondu = (x: number, y: number) => {
      const t = Math.min(nCouloirs - 1, Math.max(0, (rayonEn(x, y) - R_CORDE) / LANE_W - 0.5));
      const i = Math.floor(t), f = t - i, e = f * f * (3 - 2 * f), a = arc![i % arc!.length], b = arc![Math.min(nCouloirs - 1, i + 1) % arc!.length];
      return a.map((v, j) => v + (b[j] - v) * e);
    };
    for (let k = 0; k < nCouloirs; k++) {
      const r0 = R_CORDE + k * LANE_W - (k === 0 ? 0.8 : 0), r1 = R_CORDE + (k + 1) * LANE_W + (k === nCouloirs - 1 ? 0.8 : 0);
      if (arc) for (let q = 0; q < 4; q++) bande(r0 + (r1 - r0) * q / 4, r0 + (r1 - r0) * (q + 1) / 4, 0, fondu, matP);
      else bande(r0, r1, 0, (x, y) => tricolore(PISTE, avance(x, y)), matP);
    }
    if (cdm) for (let k = 0; k <= nCouloirs; k++) {
      const r = R_CORDE + k * LANE_W, e = k === 0 || k === nCouloirs ? 0.05 : 0.03;
      bande(r - e, r + e, 0.002, (x, y) => tricolore(LIGNE, avance(x, y)), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    }
  }
  // au Palais, des filets d'or plus larges, et l'or qui brille (voir plus bas, la bordure)
  // 8 cm, pas 5 : au loin, une ligne plus fine qu'un pixel se casse en tirets (24/10)
  const largeL = palais ? 0.085 : 0.08;
  if (palais) { (ligne as any).toneMapped = false; ligne.color.multiplyScalar(1.15); }
  for (const y0 of peinte ? [] : [0, yOppose]) {
    plan(LD, W + 1.6, matA, XD, y0 + W / 2, 0);
    for (let k = 1; k < nCouloirs; k += 2) plan(LD, LANE_W, matB, XD, y0 + (k + 0.5) * LANE_W, 0.001);
    for (let k = 0; k <= nCouloirs; k++) plan(LD, largeL, ligne, XD, y0 + k * LANE_W, 0.002);
  }
  // (sur le fondu, les lignes de couloir en filets de lumiere translucides ; departs et arrivee restent nets, `ligne`)
  const ligneCouloir = arc ? Object.assign(ligne.clone(), { transparent: true, opacity: 0.32, depthWrite: false }) : ligne;
  if (arc) for (const y0 of [0, yOppose]) for (let k = 0; k <= nCouloirs; k++) plan(LD, largeL, ligneCouloir, XD, y0 + k * LANE_W, 0.002);
  // les virages : des anneaux autour des deux centres, sur la pelouse
  for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
    const anneau = (r0: number, r1: number, mat: THREE.Material, z: number) => {
      // 192 segments par demi-tour, pas 64 : au couloir exterieur, un coude tous les 2,3 m se voyait
      // dans les lignes du virage (« des bandes dans le virage », 24/10)
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, VIRAGE_SEG, 1, debut, Math.PI), mat);
      m.position.set(xc, -R_CORDE, z); m.receiveShadow = true; stade!.add(m);
    };
    if (!peinte) anneau(R_CORDE - 0.8, R_CORDE + W + 0.8, matA, 0);
    for (let k = 1; !peinte && k < nCouloirs; k += 2) anneau(R_CORDE + k * LANE_W, R_CORDE + (k + 1) * LANE_W, matB, 0.001);
    for (let k = 0; !cdm && k <= nCouloirs; k++) anneau(R_CORDE + k * LANE_W - largeL / 2, R_CORDE + k * LANE_W + largeL / 2, ligneCouloir, 0.002);
  }
  // LA LISSE DE CORDE (`kerb`) : un filet saillant au bord interieur du couloir 1 — blanc au
  // stade de jour, vert a 0.Games, turquoise a la Riviera, or a la Nuit etoilee
  if (th.kerb && !peinte && !palais && !espace) {
    const mk = new THREE.MeshLambertMaterial({ color: c3(th.kerb, th.kerb) });
    for (const y of [-0.1, yOppose + W + 0.1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(LD, 0.14, 0.06), mk); b.position.set(XD, y, 0.03); b.castShadow = false; b.receiveShadow = true; stade.add(b);
    }
    for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
      const g = new THREE.Mesh(new THREE.RingGeometry(R_CORDE - 0.17, R_CORDE - 0.03, VIRAGE_SEG, 1, debut, Math.PI), mk);
      g.position.set(xc, -R_CORDE, 0.06); stade.add(g);
    }
  }
  // LES BORDS EN NEON (th.neon, th.neonExt) : une surface qui flotte dans le noir doit
  // avoir une limite qui se voie. Un trait vif et deux halos additifs de chaque cote.
  if (th.neon) {
    for (const [e, col] of [[0, th.neon], [nCouloirs, th.neonExt || th.neon]] as const) {
      const r = R_CORDE + (e as number) * LANE_W;
      for (const [demi, op] of [[0.05, 1], [0.18, 0.45], [0.42, 0.18], [0.8, 0.07]]) {
        const m = new THREE.MeshBasicMaterial({ color: c3(col as number[], [96, 226, 255]), transparent: op < 1, opacity: op,
          blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
        for (const y0 of [0, yOppose]) plan(LD, demi * 2, m, XD, y0 + (e as number) * LANE_W, SOL_BORD).receiveShadow = false;
        for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
          const g = new THREE.Mesh(new THREE.RingGeometry(r - demi, r + demi, VIRAGE_SEG, 1, debut, Math.PI), m);
          g.position.set(xc, -R_CORDE, SOL_BORD); stade.add(g);
        }
      }
    }
  }
  if (palais) {
    // LA BORDURE D'OR, de part et d'autre de la piste : un listel de vingt centimetres, poli
    const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.22, envMap: envPalais, envMapIntensity: 1.2 });
    for (const y0 of [0, yOppose]) for (const yy of [y0 - 0.8, y0 + W + 0.8]) plan(LD, 0.22, or, XD, yy, 0.003).receiveShadow = true;
    for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) for (const r of [R_CORDE - 0.8, R_CORDE + W + 0.8]) {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.11, r + 0.11, VIRAGE_SEG, 1, debut, Math.PI), or);
      m.position.set(xc, -R_CORDE, 0.003); m.receiveShadow = true; stade.add(m);
    }
  }
  if (espace && !arc) {
    // LA PARALLAXE de decor-cosmos.js : les planetes defilent a 55 % de la piste, les etoiles a
    // 30 % — elles suivent la camera de 45 % et 70 % : la piste FLOTTE devant le vide
    const planetes = planetesSousLaPiste(T, hasard), v = voute as THREE.Object3D | null, dep = ici(T.pos(0, 0));
    pubAnim.push((t, cx, cy) => {
      planetes.position.set((cx - dep[0]) * 0.45, (cy - dep[1]) * 0.45, 0);
      if (v) v.position.set(44 + (cx - 44) * 0.7, -R_CORDE + (cy + R_CORDE) * 0.7, 0);
    });
  }
  if (arc) {
    // LES TRAITS DE LUMIERE QUI FILENT (la piste de Mario, l'auteur, 28/10 : « les traits de lumiere qui donnent la
    // vitesse ») : une nappe additive sur toute la piste, des filets blancs et pastel dans le sens de la course, qui
    // defilent vers l'arriere plus vite que le joueur et s'allument avec sa vitesse (rien a l'arret). Une seule nappe,
    // une seule texture : un appel de dessin, pour le plus faible des telephones.
    {
      const r0 = R_CORDE - 0.6, r1 = R_CORDE + W + 0.6, rm = (r0 + r1) / 2, REP = 12;   // une tuile tous les 12 m
      const stations: [number, number, number, number][] = [];   // [x0, y0, x1, y1] aux deux bords, dans le sens de la course
      for (let x = DROITE0; x <= DROITE1; x += 1) stations.push([x, r0 - R_CORDE, x, r1 - R_CORDE]);
      const pas = 1 / rm;
      for (let a = Math.PI / 2 - pas; a > -Math.PI / 2; a -= pas) stations.push([DROITE1 + r0 * Math.cos(a), -R_CORDE + r0 * Math.sin(a), DROITE1 + r1 * Math.cos(a), -R_CORDE + r1 * Math.sin(a)]);
      for (let x = DROITE1; x >= DROITE0; x -= 1) stations.push([x, -R_CORDE - r0, x, -R_CORDE - r1]);
      for (let a = -Math.PI / 2 - pas; a > -1.5 * Math.PI; a -= pas) stations.push([DROITE0 + r0 * Math.cos(a), -R_CORDE + r0 * Math.sin(a), DROITE0 + r1 * Math.cos(a), -R_CORDE + r1 * Math.sin(a)]);
      stations.push(stations[0]);
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      let u = 0;
      stations.forEach((st, i) => {
        if (i) { const p = stations[i - 1]; u += Math.hypot((st[0] + st[2]) / 2 - (p[0] + p[2]) / 2, (st[1] + st[3]) / 2 - (p[1] + p[3]) / 2); }
        pos.push(st[0], st[1], 0.012, st[2], st[3], 0.012); uv.push(u / REP, 0, u / REP, 1);
        if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const traits = texteCanvas((c, w, h) => {
        c.clearRect(0, 0, w, h);
        for (let i = 0; i < 110; i++) {
          const y = hasard() * h, l = 80 + hasard() * 520, e = 1 + hasard() * 3, x = hasard() * w;
          const teinte = hasard() < 0.6 ? '255,255,255' : ['255,200,240', '200,240,255', '255,250,200'][(hasard() * 3) | 0];
          const g = c.createLinearGradient(0, 0, l, 0);
          g.addColorStop(0, `rgba(${teinte},0)`); g.addColorStop(0.7, `rgba(${teinte},${0.5 + hasard() * 0.5})`); g.addColorStop(1, `rgba(${teinte},0)`);
          c.fillStyle = g;
          for (const dx of [0, -w]) { c.save(); c.translate(x + dx, y); c.fillRect(0, -e / 2, l, e); c.restore(); }
        }
      }, 1024, 256);
      traits.wrapS = THREE.RepeatWrapping; traits.wrapT = THREE.ClampToEdgeWrapping;
      const mat = new THREE.MeshBasicMaterial({ map: traits, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
        toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -8 });
      const nappe = new THREE.Mesh(geo, mat); nappe.receiveShadow = false; nappe.renderOrder = 2; stade.add(nappe);
      nappe.visible = Q.get('traits') !== '0';   // (?traits=0 : pour mesurer leur cout sur un telephone)
      let tPrec = -1;
      pubAnim.push(t => {
        const dt = tPrec < 0 ? 0 : Math.min(0.1, Math.max(0, t - tPrec)); tPrec = t;
        const v = Math.max(0, (globalThis as any).SprinterApp?.G?.player?.v || 0);
        traits.offset.x += v * 0.8 * dt / REP;
        mat.opacity = 0.6 * Math.min(1, v / 11);
      });
    }
    // LES GUIRLANDES : une ampoule tous les 1,5 m sur les deux bords, les couleurs qui
    // defilent (sept decalages par seconde, piste-arc-en-ciel.js)
    const pts: number[] = [];
    for (const r of [R_CORDE - 0.12, R_CORDE + W + 0.12]) {
      const S = DROITE1 - DROITE0, L = 2 * S + 2 * Math.PI * r, n = Math.round(L / 1.5);
      for (let i = 0; i < n; i++) {
        let s = (i / n) * L, x: number, y: number;
        if (s < S) { x = DROITE0 + s; y = r - R_CORDE; }
        else if ((s -= S) < Math.PI * r) { const a = Math.PI / 2 - s / r; x = DROITE1 + r * Math.cos(a); y = -R_CORDE + r * Math.sin(a); }
        else if ((s -= Math.PI * r) < S) { x = DROITE1 - s; y = -R_CORDE - r; }
        else { s -= S; const a = -Math.PI / 2 - s / r; x = DROITE0 + r * Math.cos(a); y = -R_CORDE + r * Math.sin(a); }
        pts.push(x, y, 0.12);
      }
    }
    const g = new THREE.BufferGeometry(), n = pts.length / 3, cols = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ampoule = texteCanvas((c, w, h) => {
      const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.9)'); r.addColorStop(0.45, 'rgba(255,255,255,0.3)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = r; c.fillRect(0, 0, w, h);
    }, 64, 64);
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: ampoule, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending })));
    const teintes = arc.map(v => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace));
    let decale = -1;
    pubAnim.push(t => {
      const d = Math.floor(t * 7);
      if (d === decale) return;
      decale = d;
      for (let i = 0; i < n; i++) { const c = teintes[(i + d) % teintes.length]; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      g.attributes.color.needsUpdate = true;
    });
    // ET L'ARC-EN-CIEL LUI-MEME, immense, derriere le stade : un pont de lumiere dans le vide
    for (let k = 0; k < 7; k++) {
      const v = arc[k], r0 = 300 - k * 9;
      const m = new THREE.Mesh(new THREE.RingGeometry(r0 - 9, r0, 128, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace),
          transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(44, W + 520, -60); m.rotation.x = Math.PI / 2;
      stade.add(m);
    }
  }

  const damier = texteCanvas((c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 40; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : luxe ? '#d8b46a' : cyber ? '#ffe11a' : '#f4f4f4'; c.fillRect(i * w / 4, j * h / 40, w / 4, h / 40);
    }
  }, 64, 640);
  plan(0.5, W, new THREE.MeshBasicMaterial({ map: damier }), 100.25, W / 2, 0.003);
  // LE DEPART, couloir par couloir : en ligne au 100 m, en quinconce dans le virage sinon
  const UP0 = new THREE.Vector3(0, 0, 1);
  const departs: [THREE.Matrix4, number, number][] = [];
  for (let k = 0; k < nCouloirs; k++) {
    const p = ici(T.pos(0, k)), a = capIci(T.heading(0, k));
    // le coureur court sur la ligne de mesure, pres du bord interieur : le milieu du couloir est plus loin
    const mil = milieu(T, k);
    departs.push([new THREE.Matrix4().makeRotationAxis(UP0, a).setPosition(p[0], p[1], 0), a, mil]);
  }
  for (let k = 0; k < nCouloirs; k++) {
    const [Md, a, mil] = departs[k];
    const q = new THREE.Vector3(0, mil, 0).applyMatrix4(Md);
    const l = plan(0.05, LANE_W, ligne, q.x, q.y, 0.003);
    l.rotation.z = a;
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = css(th.lane || [247, 242, 233]); c.font = `900 ${h * 0.9}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(k + 1), w / 2, h / 2 + h * 0.04);
    }, 128, 128);
    const qn = new THREE.Vector3(-2.2, mil, 0).applyMatrix4(Md);
    const m = plan(1.0, 1.0, new THREE.MeshBasicMaterial({ map: t, transparent: true }), qn.x, qn.y, 0.004);
    m.rotation.z = a - Math.PI / 2;
    m.scale.x = -1;   // le monde est en miroir (voir initialiser) : le chiffre, lui, se lit a l'endroit
  }

  // LES LOTS : tout ce qui se repete
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const lMarche = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.tread, [175, 177, 187]) }));
  const lContre = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.riser, [130, 135, 150]) }));
  const lSiege = new Lot(new THREE.BoxGeometry(0.46, 0.38, 0.34), new THREE.MeshLambertMaterial({ color: uFoule.uSiege.value }));
  const lToit = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.roof, [76, 81, 100]) }), true);
  const lBeton = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0xc9c6c0 }));
  const lBlanc = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.barrier, [231, 234, 239]) }));
  const lVitre = new Lot(cube, new THREE.MeshLambertMaterial(luxe ? { color: 0x2a2014, emissive: 0x4a3410 }
    : cyber ? { color: 0x1a0a2a, emissive: 0xb02ad8 } : { color: 0x9fc4dc, emissive: 0x1a2a38 }));
  const OR = new THREE.Color(0xc9a45c);
  const lMetal = new Lot(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cyber
    ? new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.4, metalness: 0.5 }) : luxe
    // satine, pas miroir : sans ciel a refleter, un metal pur sortait noir (pylones en triangles noirs)
    ? new THREE.MeshStandardMaterial({ color: OR, roughness: 0.45, metalness: 0.3, emissive: 0x5a3e14 })
    : new THREE.MeshLambertMaterial({ color: 0xd8dbe2 }), true);
  // les filets d'or (nez des gradins, muret) : sans lumiere propre, ils brillent dans le noir
  const lFilet = new Lot(cube, new THREE.MeshBasicMaterial({ color: new THREE.Color(cyber ? 0x00e5ff : 0xe2bd6e) }));
  const lFilet2 = new Lot(cube, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6) }));   // le magenta du Stade Neon
  const lBloc = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0x8b9099 }));
  const lTronc = new Lot(new THREE.CylinderGeometry(0.22, 0.3, 1, 7), new THREE.MeshLambertMaterial({ color: 0x5b4030 }));
  const lFeuille = new Lot(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: c3(th.feuillage, [38, 111, 31]) }), true);
  const { peaux, coulMaillots, coulCheveux, coulPantalons } = paletteDuPublic(th, luxe, cyber);
  const cartes: number[] = [];
  const _p = new THREE.Vector3(), _f = new THREE.Vector3();
  const choix = (t: THREE.Color[]) => t[(hasard() * t.length) | 0];
  const UP = new THREE.Vector3(0, 0, 1);
  const repere = (x: number, y: number, a: number) => new THREE.Matrix4().makeRotationAxis(UP, a).setPosition(x, y, 0);

  /**
   * Un spectateur au point local (x, y, z) du repere M, tourne vers -y (la piste) :
   * une carte du public (voir LE PUBLIC, EN CARTES). `pied` : debout, bras le long
   * du corps et sans siege (officiels, photographes) ; `face` force son cap.
   */
  const spectateur = (M: THREE.Matrix4, x: number, y: number, z: number, pied: boolean | number = false, face?: number) => {
    _p.set(x, y, z).applyMatrix4(M);
    if (face === undefined) { _f.set(0, -1, 0).transformDirection(M); face = Math.atan2(_f.y, _f.x); }
    // `pied` : vrai pour un officiel debout (3), ou le geste lui-meme (4 : photographe)
    const u = hasard(), geste = typeof pied === 'number' ? pied : pied ? 3 : u < 0.6 ? 0 : u < 0.85 ? 1 : 2;
    cartes.push(_p.x, _p.y, _p.z, face, ((hasard() * P_SIL) | 0) * P_GESTES + geste, hasard());
    for (const c of [choix(peaux), choix(coulMaillots), choix(coulCheveux), choix(coulPantalons)]) cartes.push(c.r, c.g, c.b);
  };

  /**
   * DES GRADINS dans le repere local M : x le long de la tribune (0 -> L),
   * y en s'eloignant de la piste, z en haut. Rend la hauteur atteinte.
   */
  // L'AFFLUENCE SUIT L'ENVERGURE DE L'EPREUVE (fouleDe, sprinter-app.js : un quart des
  // places au scolaire, tout le stade a l'Intergalactique ; « trop de monde pour une
  // competition scolaire », l'auteur, 22/10). Un stade a moitie vide se remplit par le
  // bas : on s'assoit pres de la piste, les derniers rangs restent clairsemes.
  const occupe = (r: number, rangs: number) =>
    0.95 * Math.min(1, Math.max(0.03, affluence * 1.6 - (r / rangs) * 1.6 * (1 - affluence)));
  const gradins = (M: THREE.Matrix4, L: number, rangs: number, y0: number, z0: number, prof = 0.85, monte = 0.42) => {
    const pas = 0.55, n = Math.max(1, Math.floor(L / pas));
    for (let r = 0; r < rangs; r++) {
      const y = y0 + r * prof, z = z0 + r * monte;
      boite(lMarche, M, L / 2, y + prof / 2, z - 0.04, L, prof, 0.08);
      if (luxe || cyber) boite(cyber && r % 2 ? lFilet2 : lFilet, M, L / 2, y + 0.02, z + 0.005, L, 0.04, 0.02);
      boite(lContre, M, L / 2, y + prof, z + monte / 2, L, 0.06, monte);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (L / n);
        // la carte porte son siege ; un siege vide reste un siege
        if (atlasPublic && hasard() < occupe(r, rangs) * PUBLIC) spectateur(M, x, y + prof * 0.55, z);
        else boite(lSiege, M, x, y + prof * 0.55, z + 0.19, 1, 1, 1);
      }
    }
    // le dessous, plein : on ne voit pas le jour entre les marches
    boite(lBeton, M, L / 2, y0 + rangs * prof / 2, z0 / 2 - 0.1, L, rangs * prof, z0);
    return z0 + rangs * monte;
  };

  // LA TRIBUNE PRINCIPALE, le long de la ligne droite, en face de la camera
  // ELLE S'ARRETE OU COMMENCENT LES VIRAGES : elle debordait de quatre metres de chaque
  // cote et s'enfoncait dans les tribunes des virages (« pas de chevauchement », 22/10)
  const yS = W + 3.2, XA = DROITE0, LS = DROITE1 - DROITE0;
  const Mp = repere(XA, yS, 0);
  let z1 = 0, yLoges = 0, z2 = 0, yFond = 0;
  const rS = R_CORDE + W + 3.2;
  // LES TRIBUNES BASSES DE LA RIVIERA ET DE LA NUIT ETOILEE (ciel ouvert en 2D, `toiture:false`),
  // par defaut depuis le 23/10 (« oui, mets les tribunes basses par defaut ») ; ?tribunes=hautes
  // remet la grande tribune couverte
  const basses = Q.get('tribunes') !== 'hautes' && (stadeCle === 'riviera' || stadeCle === 'nuit');
  if (cdm) {
    // LA TRIBUNE PROVISOIRE du Champ-de-Mars : un gradin, sans toit, qui s'arrete a l'arrivee —
    // assez pour porter le public et ses drapeaux, trop basse pour cacher le parc
    boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
    z1 = z2 = gradins(Mp, LS, 7, 0.4, 1.2);
    yFond = 0.4 + 7 * 0.85;
    boite(lBlanc, Mp, LS / 2, yFond + 0.05, z2 + 0.5, LS, 0.08, 1.0);        // la rambarde du haut
  } else if (amsalem) {
    // LA TRIBUNE DU STADE BERNARD AMSALEM (OSM : 25,3 x 9,9 m, au milieu de la ligne droite, a 17 m de
    // la piste) : le modele Tripo (amsalem-3d.ts) ; ici, le public assis sur ses rangs (RANGS_AMSALEM)
    // (le modele est etire autour de son milieu, TRIBUNE_AMSALEM.echelle : ses rangs le sont avec lui)
    const t = TRIBUNE_AMSALEM, r = RANGS_AMSALEM, Mt = repere(DROITE1 - 84.39 / 2 + t.a0, t.n0 - R_CORDE + t.prof / 2, 0)
      .multiply(new THREE.Matrix4().makeScale(...t.echelle));
    for (let k = 0; atlasPublic && k < r.rangs; k++) for (const [x0, x1, dz] of r.blocs) for (let x = x0 + 0.28; x < x1; x += 0.55)
      if (hasard() < occupe(k, r.rangs) * PUBLIC) spectateur(Mt, x, r.y0 + k * r.prof, r.z0 + dz + k * r.monte);
  } else if (basses) {
    // les tribunes du 2D pour les stades a ciel ouvert — basses et sans toit, pour laisser voir
    // la mer et le ciel (essayees le 23/10, « montre-moi le resultat si on reduit », puis
    // adoptees ; reduire les autres reste refuse, 22/10)
    boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
    z1 = z2 = gradins(Mp, LS, 7, 0.4, 1.2);
    yFond = 0.4 + 7 * 0.85;
    boite(lBlanc, Mp, LS / 2, yFond + 0.05, z2 + 0.5, LS, 0.08, 1.0);
    for (const [xc, sens] of [[DROITE1, 1], [DROITE0, -1]] as const) {
      const N = 18, L = Math.PI * (rS + 6) / N + 0.6;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N * Math.PI, nx = sens * Math.sin(t), ny = Math.cos(t);
        const M = repere(xc + rS * nx, -R_CORDE + rS * ny, Math.atan2(ny, nx) - Math.PI / 2).multiply(_tr.makeTranslation(-L / 2, 0, 0));
        boite(lBlanc, M, L / 2, -0.15, 0.6, L, 0.25, 1.2);
        gradins(M, L, 5, 0.4, 1.2);
      }
    }
    const Mo2 = repere(DROITE1, yOppose - 3.2, Math.PI);
    boite(lBlanc, Mo2, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
    gradins(Mo2, LS, 5, 0.4, 1.2);
  } else if (!plage && !palais) {                // la plage et le palais n'ont pas de gradins
  boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);                       // le muret
  if (luxe || cyber) boite(cyber ? lFilet2 : lFilet, Mp, LS / 2, -0.15, 1.22, LS, 0.27, 0.04);
  z1 = gradins(Mp, LS, 13, 0.4, 1.2);
  yLoges = 0.4 + 13 * 0.85;
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 0.3, LS, 2.4, 0.6);
  boite(lVitre, Mp, LS / 2, yLoges + 1.9, z1 + 1.9, LS, 0.2, 2.6);           // les loges vitrees
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 3.3, LS, 2.6, 0.3);
  z2 = gradins(Mp, LS, 15, yLoges + 2.6, z1 + 3.6, 0.85, 0.5);
  yFond = yLoges + 2.6 + 15 * 0.85;
  if (cyber) {
    // a ciel ouvert sur la ville : un dernier filet de neon en haut des gradins
    boite(lFilet, Mp, LS / 2, yFond, z2 + 0.05, LS, 0.08, 0.08);
  } else {
    boite(lToit, Mp, LS / 2, yFond + 0.2, (z2 + 3.4) / 2, LS, 0.4, z2 + 3.4);  // la facade
    // le toit en porte-a-faux va dans son propre lot : il s'efface sous la camera haute (voir toitsStade)
    const lToitPlat = new Lot(cube, lToit.mat, true);
    boite(lToitPlat, Mp, LS / 2, yFond - 9, z2 + 3.4, LS + 2, 20, 0.35);
    const imToit = lToitPlat.finir(stade);
    if (imToit) toitsStade.push({ obj: imToit, zTop: z2 + 3.4 });
    if (luxe) boite(lFilet, Mp, LS / 2, yFond - 19, z2 + 3.4, LS + 2, 0.12, 0.4);
    for (let x = 0; x <= LS; x += 14) boite(lMetal, Mp, x, yFond - 1, z2 + 2, 0.35, 0.35, 3.0);
  }

  // LES TRIBUNES DES VIRAGES ET DE LA LIGNE OPPOSEE, plus basses, en segments
  for (const [xc, sens] of [[DROITE1, 1], [DROITE0, -1]] as const) {
    const N = 18, L = Math.PI * (rS + 6) / N + 0.6;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N * Math.PI;
      const nx = sens * Math.sin(t), ny = Math.cos(t);       // la normale, vers l'exterieur
      const px = xc + rS * nx, py = -R_CORDE + rS * ny;
      // repere local : x le long (tangente), y vers l'exterieur
      const a = Math.atan2(ny, nx) - Math.PI / 2;
      const M = repere(px, py, a).multiply(_tr.makeTranslation(-L / 2, 0, 0));
      boite(lBlanc, M, L / 2, -0.15, 0.6, L, 0.25, 1.2);
      const z = gradins(M, L, 16, 0.4, 1.2);
      if (!cyber) boite(lToit, M, L / 2, 0.4 + 16 * 0.85 + 0.2, (z + 2) / 2, L, 0.4, z + 2);
      if (luxe) boite(lFilet, M, L / 2, 0.4 + 16 * 0.85, z + 2, L, 0.1, 0.1);
      if (cyber) boite(lFilet, M, L / 2, 0.4 + 16 * 0.85, z + 0.05, L, 0.08, 0.08);
    }
  }
  const Mo = repere(DROITE1, yOppose - 3.2, Math.PI);                        // ligne opposee
  boite(lBlanc, Mo, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
  const zo = gradins(Mo, LS, 16, 0.4, 1.2);
  if (!cyber) boite(lToit, Mo, LS / 2, 0.4 + 16 * 0.85 + 0.2, (zo + 2) / 2, LS, 0.4, zo + 2);
  if (luxe) boite(lFilet, Mo, LS / 2, 0.4 + 16 * 0.85, zo + 2, LS, 0.1, 0.1);
  if (cyber) boite(lFilet, Mo, LS / 2, 0.4 + 16 * 0.85, zo + 0.05, LS, 0.08, 0.08);
  }

  // LES PANNEAUX LED, au bord de la piste, devant la tribune principale — animes (« exploiter
  // les panneaux publicitaires : videos de promotion, logos animes », 22/10). Une toile
  // redessinee enchaine, six secondes chacun : le logo balaye d'un reflet, le logo qui
  // defile, une accroche. Le film, lui, passe sur l'ecran geant (un panneau d'un metre de
  // haut n'en montrerait qu'une vignette).
  const logoPub = new Image(); logoPub.src = base + 'pubs/benbezi-logo-3d-cadre.webp';
  const toileLed = document.createElement('canvas'); toileLed.width = 512; toileLed.height = 106;
  const cl = toileLed.getContext('2d')!;
  const pub = new THREE.CanvasTexture(toileLed);
  pub.colorSpace = THREE.SRGBColorSpace; pub.wrapS = THREE.RepeatWrapping; pub.repeat.set(LS / 5, 1);
  const pubHaut = pub.clone(); pubHaut.repeat.set(LS / 3.4, 1);
  const accent = css(th.accent || [255, 122, 26]);
  const accroches = championnat
    ? ['CHAMPIONNAT DE FRANCE', 'SPRINTER', 'FINALE ' + (T.fullLap ? '400' : T.curved ? '200' : '100') + ' M', 'VAL-DE-REUIL']
    : ['SPRINTER', 'DÉFIE TES AMIS', (T.fullLap ? '400' : T.curved ? '200' : '100') + ' M EN DIRECT'];   // plus le mot BENBEZI en vert (« retire ce logo », 24/10)
  let imageLed = -1;
  pubAnim.push(t => {
    const img = Math.floor(t * 20);          // 20 images/s suffisent a un panneau
    if (img === imageLed) return;
    imageLed = img;
    const w = 512, h = 106, n = Math.floor(t / 6), u = (t % 6) / 6, sorte = n % 3;
    cl.globalCompositeOperation = 'source-over';
    cl.fillStyle = '#050608'; cl.fillRect(0, 0, w, h);
    // Une campagne en cours prend la place du logo, sans deformer la marque (1000 x 250).
    const sponsor = sponsorDeLaCourse((globalThis as any).SprinterApp?.G);
    const poser = (x: number) => sponsor
      ? cl.drawImage(sponsor, x + (w - h * 4) / 2, 0, h * 4, h)
      : cl.drawImage(logoPub, x, 0, w, h);
    if (sorte < 2 && (sponsor || (logoPub.complete && logoPub.naturalWidth))) {
      if (sorte === 0) {
        poser(0);
        // le reflet qui traverse le panneau
        const x = (u * 1.8 - 0.4) * w, g = cl.createLinearGradient(x - 60, 0, x + 60, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        cl.globalCompositeOperation = 'lighter'; cl.fillStyle = g; cl.fillRect(0, 0, w, h);
      } else {
        const x = -((u * 3) % 1) * w;
        poser(x); poser(x + w);
      }
    } else {
      // l'accroche entre en grandissant, respire, puis s'eteint
      const k = Math.min(1, u * 6), f = Math.min(1, (1 - u) * 8);
      cl.globalAlpha = f;
      cl.fillStyle = accent; cl.textAlign = 'center'; cl.textBaseline = 'middle';
      const mot = accroches[Math.floor(n / 3) % accroches.length];
      let px = h * (0.42 + 0.12 * k + 0.02 * Math.sin(t * 6));
      cl.font = `900 ${Math.round(px)}px system-ui, sans-serif`;
      const lg = cl.measureText(mot).width;
      if (lg > w * 0.9) { px *= w * 0.9 / lg; cl.font = `900 ${Math.round(px)}px system-ui, sans-serif`; }   // tient dans le panneau
      cl.fillText(mot, w / 2, h / 2 + 2);
      cl.globalAlpha = 1;
    }
    if (cyber && Math.random() < 0.18) {
      // le panneau du Stade Neon gresille : des tranches decalees, une frange magenta
      for (let k = 0; k < 3; k++) {
        const y = (Math.random() * (h - 12)) | 0, hh = 4 + ((Math.random() * 10) | 0);
        cl.drawImage(toileLed, 0, y, w, hh, (Math.random() - 0.5) * 40, y, w, hh);
      }
      cl.globalCompositeOperation = 'lighter'; cl.fillStyle = 'rgba(255,43,214,0.25)'; cl.fillRect(0, 0, w, h);
      cl.globalCompositeOperation = 'source-over';
    }
    pub.needsUpdate = true; pubHaut.needsUpdate = true;
  });
  const panneau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 1.03), new THREE.MeshBasicMaterial({ map: pub }));
  panneau.position.set(XA + LS / 2, W + 1.7, 0.55); panneau.rotation.x = Math.PI / 2; panneau.scale.x = -1;  // (monde en miroir)
  // (pas a Amsalem : aucun panneau au bord de sa piste sur les photos — sauf en edition championnat, ou ils bordent la
  // ligne droite, devant la rambarde)
  if (!amsalem || championnat) {
  stade.add(panneau);
  boite(lBloc, repere(0, 0, 0), XA + LS / 2, W + 1.78, 0.55, LS, 0.12, 1.1);
  }
  // ... et le bandeau entre les deux etages (pas a la plage : pas de tribune)
  if (!plage && !palais && !cdm && !basses && !amsalem) {
  const bandeau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 0.7), new THREE.MeshBasicMaterial({ map: pubHaut }));
  bandeau.position.set(XA + LS / 2, yS + yLoges + 0.05, z1 + 0.3); bandeau.rotation.x = Math.PI / 2; bandeau.scale.x = -1;
  stade.add(bandeau);
  }

  // L'ECRAN GEANT, au-dessus du virage d'arrivee, tourne vers la ligne droite (pas a la plage)
  if (!plage && !palais && !cdm && (!amsalem || championnat)) {
  const ecran = texteCanvas((c, w, h) => {
    c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (cyber) {
      c.fillStyle = '#ff2bd6'; c.font = `900 ${h * 0.4}px ui-monospace, Menlo, monospace`;
      c.fillText('SPRINTER', w / 2, h * 0.42);
      c.font = `700 ${h * 0.14}px ui-monospace, Menlo, monospace`;
    } else if (luxe) {
      // la planche du style : un serif d'or en italique, un filet, des capitales espacees
      c.fillStyle = '#d8b46a'; c.font = `italic 500 ${h * 0.36}px Georgia, 'Times New Roman', serif`;
      c.fillText("Stade d'Or", w / 2, h * 0.42);
      c.fillRect(w * 0.38, h * 0.62, w * 0.24, 2);
      c.font = `400 ${h * 0.1}px Georgia, serif`;
    } else {
      c.fillStyle = '#ff7a1a'; c.font = `900 ${h * 0.42}px system-ui, sans-serif`;
      c.fillText('SPRINTER', w / 2, h * 0.42);
      c.font = `700 ${h * 0.16}px system-ui, sans-serif`;
    }
    c.fillStyle = luxe ? '#c9a45c' : cyber ? '#00e5ff' : '#e8ecf4';
    c.fillText((T.fullLap ? '400' : T.curved ? '200' : '100') + ' M  ·  LIVE', w / 2, h * 0.78);
  }, 512, 256);
  const xE = DROITE1 + rS + 22;
  const ec = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: ecran, fog: false }));
  ec.position.set(xE, -R_CORDE + 6, 22); ec.rotation.set(Math.PI / 2, -Math.PI / 2, 0); ec.scale.x = -1;
  stade.add(ec);
  // ... et le film de promotion (public/pubs/videos, tire du reel « course en direct »,
  // remonte en 2:1) : quinze secondes de film, six d'habillage du stade, en boucle
  const film = document.createElement('video');
  // en ULTRA le film plein (1280 x 640) ; sinon sa version 640 x 320 : une image video se
  // televerse a chaque image, et sur un telephone c'est autant de memoire a recopier
  film.src = base + (ULTRA ? 'pubs/videos/sprinter-direct.mp4' : 'pubs/videos/sprinter-direct-640.mp4');
  film.muted = true; film.loop = true; film.playsInline = true; film.preload = 'auto'; film.setAttribute('playsinline', '');
  videoPub = film;
  const tFilm = new THREE.VideoTexture(film); tFilm.colorSpace = THREE.SRGBColorSpace;
  const matE = ec.material as THREE.MeshBasicMaterial;
  pubAnim.push(t => {
    if (film.paused) film.play().catch(() => {});
    matE.map = t % 21 < 15 && film.readyState >= 2 ? tFilm : ecran;
  });
  boite(lBloc, repere(0, 0, 0), xE + 0.4, -R_CORDE + 6, 22, 0.6, 17, 9);
  boite(lMetal, repere(0, 0, 0), xE + 0.6, -R_CORDE + 6, 9, 1.2, 1.2, 18);
  }

  // LES PYLONES D'ECLAIRAGE, aux quatre coins
  const lampes = texteCanvas((c, w, h) => {
    c.fillStyle = '#20242c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      c.fillStyle = luxe ? '#ffe0a6' : '#fffbe8'; c.fillRect(4 + j * (w - 8) / 6, 4 + i * (h - 8) / 4, (w - 8) / 6 - 4, (h - 8) / 4 - 4);
    }
  }, 128, 96);
  const matLampes = new THREE.MeshBasicMaterial({ map: lampes });
  for (const [x, y] of cyber || plage || palais || cdm || espace || amsalem ? [] : [[DROITE1 + 30, W + 34], [DROITE0 - 30, W + 34], [DROITE1 + 30, yOppose - 34], [DROITE0 - 30, yOppose - 34]]) {
    boite(lMetal, repere(0, 0, 0), x, y, 24, 1.4, 1.4, 48);
    const p = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 6), [matLampes, matLampes, matLampes, matLampes, matLampes, matLampes]);
    p.position.set(x, y, 49); p.lookAt(44, -R_CORDE, 0); stade.add(p);
  }

  // LES DRAPEAUX, sur la facade de la tribune principale
  const lDrap = cdm
    // au Champ-de-Mars, de grands pavillons tricolores hisses tous les seize metres
    ? [flotter(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: texteCanvas((c, w, h) => {
        [BLEU, BLANC, ROUGE].forEach((v, i) => { c.fillStyle = css(v); c.fillRect(i * w / 3, 0, w / 3, h); }); }, 96, 64) }), 0.3)]
    : coulMaillots.slice(0, 4).map(c => flotter(new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })));
  for (let i = 0, x = 4; !plage && !palais && !amsalem && x < LS; x += cdm ? 16 : 9, i++) {
    boite(lMetal, Mp, x, yFond + 0.1, z2 + 5.4, 0.08, 0.08, 4);
    // une toile qui flotte (drapeau-3d.ts), le mat a gauche
    const d = new THREE.Mesh(toileDeDrapeau(1.8, 1.1), lDrap[i % lDrap.length]);
    d.position.copy(new THREE.Vector3(x + 0.9, yFond + 0.1, z2 + 6.8).applyMatrix4(Mp));
    d.rotation.x = Math.PI / 2; d.rotation.y = 0.25 * Math.sin(i);
    stade.add(d);
  }

  // SUR LA PISTE : les blocs, le portique du chrono, officiels et photographes
  const M0 = repere(0, 0, 0);
  // les blocs du jeu, la ou pose() met chaque coureur au coup de feu (voir drawBlocs)
  if (blocLots) for (const { geo, mat } of blocLots) {
    const l = new Lot(geo, mat, true);
    // au milieu du couloir, sous les pieds du coureur (voir ouCourt)
    for (const [Md, , mil] of departs) l.poser(Md.clone().multiply(_T.makeTranslation(0, mil, 0)));
    l.finir(stade);
  }
  for (const y of [-0.9, W + 0.9]) boite(lMetal, M0, 100, y, 1.6, 0.18, 0.18, 3.2);
  boite(lBlanc, M0, 100, W / 2, 3.25, 0.25, W + 1.8, 0.3);
  // LE CHRONO DE L'ARRIVEE TOURNE (« les panneaux de chronos de tous les stades sauf le Champ-de-Mars ne se
  // declenchent pas », l'auteur, 27/10 : il etait peint une fois, « 0.00 ») : la regle de l'horloge du
  // Champ-de-Mars (decor-champ-de-mars.js, chronoAffiche) — le temps de course, fige sur celui du vainqueur
  // des qu'il a passe la ligne. Repeint seulement quand le centieme change.
  const ecrireChrono = (c: CanvasRenderingContext2D, w: number, h: number, s: string) => {
    c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd23a'; c.font = `700 ${h * 0.7}px ui-monospace, monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, w / 2, h / 2);
  };
  const chrono = texteCanvas((c, w, h) => ecrireChrono(c, w, h, '0.00'), 256, 96);
  let chronoVu = '0.00';
  pubAnim.push(() => {
    const G = (globalThis as any).SprinterApp?.G;
    if (!G) return;
    let vainqueur = Infinity;
    for (const r of G.runners || []) if (r.finished && r.finishTime < vainqueur) vainqueur = r.finishTime;
    const s = (vainqueur < Infinity ? vainqueur : G.state === 'race' ? (G.elapsed || 0) : 0).toFixed(2);
    if (s === chronoVu) return;
    chronoVu = s;
    const cv = chrono.image as HTMLCanvasElement;
    ecrireChrono(cv.getContext('2d')!, cv.width, cv.height, s);
    chrono.needsUpdate = true;
  });
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: chrono }));
  ch.position.set(103, W + 1.2, 1.4); ch.rotation.set(Math.PI / 2, -Math.PI / 2, 0); ch.scale.x = -1;
  stade.add(ch);
  boite(lBloc, M0, 103.1, W + 1.2, 1.0, 0.2, 2.6, 2.0);
  // une poignee de gens au bord de la piste : officiels a l'arrivee, photographes apres la ligne
  if (atlasPublic) {
    // tournes vers la piste (+y) : officiels a l'arrivee, commissaires
    for (let i = 0; i < 6; i++) spectateur(M0, 101 + i * 0.7, -1.6 - (i % 2) * 0.6, 0, true, Math.PI / 2);
    // pas de photographes (l'auteur, 22/10 : « retire les photographes »)
    for (let i = 0; i < 4; i++) spectateur(M0, 30 + i * 18, -1.8, 0, true, Math.PI / 2);
  }

  // LES NAPPES DE LUMIERE, au luxe : sous chaque projecteur, une flaque doree sur la
  // laque — peinte (un degrade radial en addition) plutot qu'eclairee : une lumiere de
  // plus couterait sur chaque pixel du plus faible des telephones.
  if (luxe) {
    const nappe = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,196,110,0.9)'); g.addColorStop(0.45, 'rgba(230,150,60,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 256);
    // le faisceau : vif a la rampe (haut de la toile = sommet du cone), eteint au sol
    const faisceau = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, opacity: 0.1, map: texteCanvas((c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(255,214,140,1)'); g.addColorStop(0.5, 'rgba(230,160,70,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 4, 128) });
    const mat = new THREE.MeshBasicMaterial({ map: nappe, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    for (let x = DROITE0 + 8; x < DROITE1 + 10; x += 24) {
      const m = plan(34, W + 10, mat, x, W / 2, SOL_LUMIERE);
      m.receiveShadow = false;
    }
    // LES QUATRE PROJECTEURS eclairent tout le stade (« utilise la lumiere des projecteurs
    // sans perdre l'aspect luxueux, sublime-le », 22/10) : vu du ciel, seule la ligne
    // d'arrivee sortait du noir. Toujours peint en addition (aucune lumiere de plus) :
    // une large nappe par pylone sur la pelouse et les virages, un halo sur chaque
    // rampe, un faisceau d'or tres leger jusqu'au sol.
    const large = new THREE.MeshBasicMaterial({ map: nappe, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const xc = 44, yc = -R_CORDE;
    for (const [x, y] of [[DROITE1 + 30, W + 34], [DROITE0 - 30, W + 34], [DROITE1 + 30, yOppose - 34], [DROITE0 - 30, yOppose - 34]]) {
      const cx = x + (xc - x) * 0.55, cy = y + (yc - y) * 0.55;
      const m = plan(150, 110, large, cx, cy, 0.02);
      m.rotation.z = Math.atan2(yc - y, xc - x); m.receiveShadow = false;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: nappe, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
      halo.position.set(x, y, 49); halo.scale.set(22, 22, 1);
      stade.add(halo);
      const bout = new THREE.Vector3(x, y, 48), sol = new THREE.Vector3(cx, cy, 0);
      const long = bout.distanceTo(sol);
      const f = new THREE.Mesh(new THREE.ConeGeometry(20, long, 32, 1, true), faisceau);
      f.position.copy(bout).add(sol).multiplyScalar(0.5);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bout.clone().sub(sol).normalize());
      stade.add(f);
    }
  }

  // LE STADE DE NUIT AUX PROJECTEURS (Danube) : ce qui le fait en 2D (drawProjecteurs, nappes de
  // rendu-premium.js), c'est la lumiere — une rangee de lampes tres blanches sous la rive du toit,
  // des nappes de lumiere sur la piste tous les seize metres, cote exterieur (le couloir 1 reste
  // plus sombre), et le halo des panneaux LED au sol. Tout peint en addition, aucune lumiere de plus.
  // (pas a Amsalem : la nuit, l'heure du jour lui donne `projecteurs` et ce bloc posait les lampes des tribunes generiques
  // — des barres blanches sur la piste —, des nappes en stries sur les couloirs et leur eblouissement ; elle a sa lumiere,
  // la lueur de ses quatre mats, amsalem-3d.ts. Vu le 27/10 au soir)
  if (nuit && th.projecteurs && !luxe && !cyber && !plage && !palais && !cdm && !espace && !amsalem) {
    const tache = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      // (24/10) un centre moins blanc et un fondu plus large, a moitie moins fort : sur une piste claire,
      // le blanc pur en addition saturait — des taches blanches sous les projecteurs
      g.addColorStop(0, 'rgba(255,244,222,0.75)'); g.addColorStop(0.5, 'rgba(255,236,205,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 256);
    const nappe = new THREE.MeshBasicMaterial({ map: tache, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.18,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let x = DROITE0 + 8; x < DROITE1; x += 16) for (const y of [W * 0.6, yOppose + W * 0.4]) plan(20, W * 1.3, nappe, x, y, SOL_LUMIERE).receiveShadow = false;
    for (const [xc, a0, sens] of [[DROITE1, -Math.PI / 2, 1], [DROITE0, Math.PI / 2, 1]] as const) {
      const r = R_CORDE + W * 0.6;
      for (let i = 0; i < 7; i++) {
        const a = a0 + sens * (i + 0.5) / 7 * Math.PI;
        const m = plan(18, W * 1.3, nappe, xc + r * Math.cos(a), -R_CORDE + r * Math.sin(a), SOL_LUMIERE);
        m.rotation.z = a + Math.PI / 2; m.receiveShadow = false;
      }
    }
    // la rangee de lampes, tous les quatre metres sous le bord du toit principal et en haut des
    // tribunes d'en face : une barre blanche et son halo
    const lampe = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const halo = new THREE.SpriteMaterial({ map: tache, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85, fog: false });
    const lLampe = new Lot(cube, lampe);
    const rangee = (M: THREE.Matrix4, L: number, y: number, z: number) => {
      for (let x = 2; x < L; x += 4) {
        boite(lLampe, M, x, y, z, 1.1, 0.25, 0.18);
        const q = new THREE.Vector3(x, y - 0.3, z - 0.1).applyMatrix4(M);
        const h = new THREE.Sprite(halo); h.position.copy(q); const k = 3.2 + (x * 7.3 % 1) * 0.8; h.scale.set(k, k, 1); stade!.add(h);
      }
    };
    rangee(Mp, LS, yFond - 18.8, z2 + 3.1);
    rangee(repere(DROITE1, yOppose - 3.2, Math.PI), LS, 0.4 + 16 * 0.85, 1.2 + 16 * 0.42 + 2.3);
    lLampe.finir(stade);
    // la foule est DANS les gradins violet-noir, pas devant (sprinter-app.js, danube) : dans la penombre
    uFoule.uLum.value = 0.48;
    // LA BANDE MAGENTA au pied des tribunes, entre la piste et les panneaux (la capture de reference
    // du 12/09) : un bandeau lumineux, le long des deux lignes droites
    const bandeMag = new THREE.MeshBasicMaterial({ color: c3(th.accent, [236, 46, 150]).multiplyScalar(0.7) });
    // (elle commencait sur le tartan, a W + 0,43 : voir LE SOL EN COUCHES)
    plan(LS, 1.15, bandeMag, XA + LS / 2, W + 0.8 + 0.575, SOL_BORD).receiveShadow = false;
    plan(LS, 1.15, bandeMag, XA + LS / 2, yOppose - 0.8 - 0.575, SOL_BORD).receiveShadow = false;
    // le halo des panneaux LED, sur la piste devant eux
    if (th.pubsLed) {
      const lueur = new THREE.MeshBasicMaterial({ color: c3(th.accent, [236, 46, 150]), transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, map: texteCanvas((c, w, h) => {
          const g = c.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
          c.fillStyle = g; c.fillRect(0, 0, w, h);
        }, 4, 64) });
      plan(LS, 2.2, lueur, XA + LS / 2, W + 0.6, SOL_LUEUR).receiveShadow = false;
    }
  }

  // LA POUSSIERE D'OR, en suspension au-dessus de la piste (le luxe seulement)
  if (luxe) {
    const n = 900, pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pts.set([DROITE0 + hasard() * (DROITE1 - DROITE0 + 20), -6 + hasard() * (W + 14), 0.4 + hasard() * 7], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8c47a, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false })));
  }

  if (cyber) {
    villeNeon(hasard, rS);
    // LA PISTE MOUILLEE (piste-mouillee.ts) : un vrai miroir sous la piste, ride et etire
    if (renderer && matA instanceof THREE.MeshStandardMaterial) {
      const mouille = pisteMouillee(stade, renderer, [matA, matB as THREE.MeshStandardMaterial], XD, -R_CORDE,
        palier >= 3 ? 0.5 : palier === 2 ? 0.33 : 0.25);
      miroir = mouille.miroir;
      pubAnim.push(t => mouille.animer(t));
    }
  }
  if (menole) pubAnim.push(construireMenole({ stade, W, D0: DROITE0, D1: DROITE1, hasard, nuit,
    spectateur: (x, y, z, geste, face) => { if (atlasPlage) spectateur(repere(0, 0, 0), x, y, z, geste, face); } }));
  else if (cdm) pubAnim.push(construireChamp({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard,
    dossier: base + (ULTRA ? 'decors-ultra/champdemars/' : 'decors/champdemars/') }));
  else if (palais) pubAnim.push(construirePalais({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard, env: envPalais,
    spectateur: (x, y, z, geste, face) => { if (atlasPublic) spectateur(repere(0, 0, 0), x, y, z, geste, face); } }));
  else if (amsalem) habillerLeTartan(stade, [matA, matB, ...construireAmsalem({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard, base, ultra: ULTRA, nuit, championnat,
    spectateur: (x, y, z, geste, face) => { if (atlasPublic) spectateur(repere(0, 0, 0), x, y, z, geste, face); } })], base);
  else if (plage) construirePlage({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard, base, nuit,
    spectateur: (x, y, z, geste, face) => { if (atlasPlage) spectateur(repere(0, 0, 0), x, y, z, geste, face); } });

  // LES ARBRES, autour du stade (pas au luxe : autour, c'est le noir ; pas au Stade Neon : la ville)
  // (ni dans le vide de l'espace, ni autour d'un stade de nuit au sol noir, ni au Champ-de-Mars : ses rideaux de tilleuls)
  // LES ARBRES DU LIEU (stades-classiques-3d.ts) : platanes, palmiers, cypres — a la place des blocs
  const ctxClassique = { stade, th, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard };
  const arbresPoses = !(luxe || cyber || plage || palais || cdm || espace || amsalem) && arbresDuLieu(ctxClassique);
  if (th.piscine && !plage) pubAnim.push(riviera(ctxClassique));
  if (th.tourbillons) pubAnim.push(nuitEtoilee(ctxClassique));
  // 0.Games : son decor propre, a la place du materiel du Championnat du monde (voir poserLesPieces)
  if (stadeCle === 'mondiaux') pubAnim.push(zeroGames(ctxClassique));
  for (let i = 0; i < (arbresPoses || luxe || cyber || plage || palais || cdm || espace || amsalem || (nuit && th.projecteurs) ? 0 : 70); i++) {
    const a = hasard() * Math.PI * 2, rx = 150 + hasard() * 40, ry = 95 + hasard() * 30;
    const x = 44 + rx * Math.cos(a), y = -R_CORDE + ry * Math.sin(a), h = 5 + hasard() * 5;
    boite(lTronc, M0, x, y, h * 0.3, 1, 1, h * 0.6);
    const r = 2.2 + hasard() * 1.6;
    boite(lFeuille, M0, x, y, h * 0.65 + r * 0.6, r, r, r * 1.2);
  }

  if (cartes.length && Q.get('foule') !== '0') { const f = laFoule(cartes); f.userData.sansReflet = true; stade.add(f); }
  stade.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });   // (voir pieceDuStade : seuls les coureurs projettent)
  if (stadeCle !== 'mondiaux') poserLesPieces(T, stadeCle, etape);
  // LA CARRIERE LEGENDE : le monument du lieu, ses objets, sa guirlande (legende-3d.ts)
  if (stadeCle && stadeCle.startsWith('legende-')) {
    if (!legendeDecors) {
      if (!legendeDemande) {
        legendeDemande = true;
        Promise.all([import('../legende/decors'), import('../legende/nuages')])
          .then(([d, n]) => { legendeDecors = d; legendeNuages = n; refaireLeStade(); })
          .catch(() => { legendeDemande = false; });
      }
    } else {
      const manque = construireLegende({ stade, lieu: stadeCle.slice('legende-'.length), W, D0: DROITE0, D1: DROITE1, R1: R_CORDE,
        hasard, decors: legendeDecors, nuages: legendeNuages });
      // une image pas encore chargee : on reconstruit un peu plus tard (six fois au plus)
      if (manque && legendeEssais++ < 6) setTimeout(() => { refaireLeStade(); }, 1500);
      else if (!manque) legendeEssais = 0;
    }
  }
  for (const l of [lMarche, lContre, lSiege, lToit, lBeton, lBlanc, lVitre, lMetal, lBloc, lTronc, lFeuille, lFilet, lFilet2]) l.finir(stade);
}
