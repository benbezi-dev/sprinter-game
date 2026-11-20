// LA MASCOTTE ANIMEE — le heros, le rival et leurs expressions, avec LEURS gestes Tripo.
//
// Les corps de course (public/modeles/mascotte/*.glb) sont poses par le code, sans clip. Ceux-ci
// (public/modeles/mascotte/anime/*.glb, tools/assets/mascotte-animee.mjs) gardent le squelette
// UE5 de Tripo et leurs animations, jouees par un THREE.AnimationMixer, comme le molosse.
// La mascotte n'est pas jouable : elle reagit (fin de course), accueille (ouverture) et tourne
// dans les videos (page /mascotte.html).
//
// UNE SCENE PAR TOILE. Chaque vue (composant Mascotte, page de tournage) cree sa scene sur sa
// toile ; les fichiers, eux, ne se chargent qu'une fois (cache) et chaque scene en clone le
// squelette. Tant qu'un fichier charge, ou si WebGL manque, la toile reste transparente : on ne
// voit jamais un trou ni une erreur, la mascotte n'apparait simplement pas.
//
// VISAGE ET CORPS VONT ENSEMBLE (assets-sources/mascotte/EXPRESSIONS.md) : chaque fichier
// d'expression n'a que des gestes de la meme emotion. Le geste se demande donc avec son fichier.

import * as THREE from 'three';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { chargeurGLTF, brancherKTX2 } from './chargeur-gltf';

/** Les fichiers et leurs gestes (noms courts poses par mascotte-animee.mjs). */
export const MASCOTTES = {
  'heros': ['idle', 'echauffement', 'salut', 'frime', 'attente', 'defi', 'celebration'],
  'heros-hilare': ['idle', 'rire', 'fourire', 'applaudit', 'joie'],
  'heros-furieux': ['idle', 'trepigne', 'rage', 'colere'],
  'heros-larmes': ['idle', 'pleure', 'genoux', 'abattu'],
  'heros-choque': ['idle', 'doubletake', 'stupeur'],
  'rival': ['idle', 'defi', 'toise', 'applaudit', 'echauffement'],
  'rival-sourire': ['idle', 'nargue', 'victoire', 'doigt'],
  'rival-fureur': ['idle', 'colere', 'controle'],
  'rival-stupeur': ['idle', 'stupeur', 'silence'],
} as const;
export type Personnage = keyof typeof MASCOTTES;

type Modele = { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
const modeles = new Map<Personnage, Promise<Modele | null>>();

function url(p: Personnage): string {
  return ((import.meta as any).env?.BASE_URL || '/').replace(/\/?$/, '/') + 'modeles/mascotte/anime/' + p + '.glb';
}

/**
 * Les corrections d'un geste (tools/mascotte-verifier.mjs), un echantillon tous les `pas` s :
 * le decalage du bout de chaque membre (main `l`/`r`, pied `jl`/`jr`) dans le repere du bassin, en
 * unites du modele, et `y`, de combien relever tout le corps (un pied qui passait sous le sol).
 */
export type Membre = 'l' | 'r' | 'jl' | 'jr';
export type Corrections = Record<string, { pas: number; y?: number[]; tete?: number[] } & { [m in Membre]?: number[][] }>;
/** Les trois os de chaque membre : racine, articulation du milieu, bout. */
export const CHAINES: Record<Membre, [string, string, string]> = {
  l: ['upperarm_l', 'lowerarm_l', 'hand_l'], r: ['upperarm_r', 'lowerarm_r', 'hand_r'],
  jl: ['thigh_l', 'calf_l', 'foot_l'], jr: ['thigh_r', 'calf_r', 'foot_r'],
};
let corrections: Corrections | null = null;
let correctionsDemandees = false;
function chargerCorrections() {
  if (correctionsDemandees) return;
  correctionsDemandees = true;
  fetch(url('corrections' as Personnage).replace(/\.glb$/, '.json'))
    .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && !corrections) corrections = j; }).catch(() => {});
}
/** Poser les corrections a la main (tools/mascotte-verifier.mjs, entre deux passes). */
export function poserCorrections(c: Corrections | null) { corrections = c; correctionsDemandees = true; }

/** Charger (une seule fois) le fichier d'une mascotte. Rend null s'il ne peut pas l'etre. */
export function chargerMascotte(p: Personnage): Promise<Modele | null> {
  chargerCorrections();
  let m = modeles.get(p);
  if (!m) {
    m = chargeurGLTF().loadAsync(url(p))
      .then((g) => { preparerClips(g.scene, g.animations); return { scene: g.scene, clips: g.animations }; })
      .catch(() => { modeles.delete(p); return null; });   // un echec ne condamne pas la demande suivante
    modeles.set(p, m);
  }
  return m;
}

/** Les gestes joues en boucle (l'attente apres chaque geste, celle de l'accueil). */
const EN_BOUCLE = new Set(['idle', 'attente']);
/** Jusqu'ou le bassin peut s'ecarter de sa place au repos, en part de la taille (voir retenir). */
const ZONE = 0.12;

/**
 * LES CLIPS TRIPO REMIS D'APLOMB, une fois au chargement (audit du 20/11/2026, « il y a beaucoup de
 * problemes dans l'animation », l'auteur). Deux defauts des clips bruts, mesures image par image :
 *
 * 1. LE BASSIN QUI SE PROMENE. « Stay in place » ne retient pas tout : le bassin du salut part de
 *    1,8 m, l'echauffement de 2 m. retenir() ramenait le corps d'un coup sec au bord d'une zone ;
 *    pendant le fondu vers le geste suivant, le corps revenait alors au centre en deux images (8 cm
 *    par image). Ici, l'ecart horizontal du bassin est borne EN DOUCEUR dans la piste elle-meme
 *    (tanh : intact pres du repos, jamais plus de ZONE), si bien que les fondus melangent de petits
 *    ecarts et que rien ne glisse.
 *
 * 2. LA BOUCLE QUI NE SE REFERME PAS. La derniere image d'idle ne rejoint pas la premiere (6 cm au
 *    bassin chez le rival) : toutes les 6 s, la mascotte au repos sursautait. Pour les gestes joues
 *    en boucle, l'ecart fin-debut de chaque piste est reparti sur toute la duree : la fin retombe
 *    exactement sur le debut.
 */
function preparerClips(scene: THREE.Object3D, clips: THREE.AnimationClip[]) {
  scene.updateMatrixWorld(true);
  const bassin = scene.getObjectByName('pelvis');
  const haut = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).y || 1.6;
  let haute: THREE.Vector3 | null = null, repos: THREE.Vector3 | null = null, zone = 0;
  if (bassin?.parent) {
    // la verticale et la zone, dans le repere du parent du bassin (Tripo : z en haut, centimetres)
    const inv = new THREE.Matrix4().copy(bassin.parent.matrixWorld).invert();
    const o = new THREE.Vector3().applyMatrix4(inv);
    const h = new THREE.Vector3(0, 1, 0).applyMatrix4(inv).sub(o);
    const echelle = h.length() || 1;   // longueur locale d'une unite du monde
    haute = h.normalize();
    repos = bassin.position.clone();
    zone = ZONE * haut * echelle;
  }
  const v = new THREE.Vector3(), d = new THREE.Vector3(), dv = new THREE.Vector3();
  const q = new THREE.Quaternion(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), qd = new THREE.Quaternion(), qi = new THREE.Quaternion();
  for (const clip of clips) {
    for (const piste of clip.tracks) {
      const val = piste.values, n = piste.times.length;
      if (bassin && haute && repos && zone > 0 && piste.name === bassin.name + '.position') {
        for (let k = 0; k < n; k++) {
          v.fromArray(val, k * 3);
          d.subVectors(v, repos);
          const vert = d.dot(haute);
          dv.copy(haute).multiplyScalar(vert);      // la hauteur ne change jamais (saut, genou a terre)
          d.sub(dv);                                // l'ecart horizontal
          const l = d.length();
          if (l > 1e-9) d.multiplyScalar((zone * Math.tanh(l / zone)) / l);
          v.copy(repos).add(dv).add(d).toArray(val, k * 3);
        }
      }
      if (!EN_BOUCLE.has(clip.name) || n < 2 || clip.duration <= 0) continue;
      const t0 = piste.times[0], T = piste.times[n - 1] - t0 || 1;
      if (piste instanceof THREE.QuaternionKeyframeTrack) {
        q0.fromArray(val, 0); q1.fromArray(val, (n - 1) * 4);
        if (q0.dot(q1) < 0) q1.set(-q1.x, -q1.y, -q1.z, -q1.w);
        qd.copy(q0).multiply(q1.invert());         // ce qui manque a la fin pour retomber sur le debut
        for (let k = 1; k < n; k++) {
          qi.identity().slerp(qd, (piste.times[k] - t0) / T);
          q.fromArray(val, k * 4).premultiply(qi).normalize().toArray(val, k * 4);
        }
      } else if (piste.getValueSize() === 3) {
        const a = [val[0], val[1], val[2]], b = [val[(n - 1) * 3], val[(n - 1) * 3 + 1], val[(n - 1) * 3 + 2]];
        for (let k = 1; k < n; k++) {
          const f = (piste.times[k] - t0) / T;
          for (let c = 0; c < 3; c++) val[k * 3 + c] += (a[c] - b[c]) * f;
        }
      }
    }
  }
}

export type Cadrage = 'pied' | 'buste';

export type Options = {
  /** La toile ou dessiner ; sa taille CSS fixe l'image (le rapport de pixels est pris en compte). */
  toile: HTMLCanvasElement;
  /** Rapport de pixels (par defaut celui de l'ecran, plafonne a 2). */
  pixels?: number;
  /** De face (0) ou de trois quarts (radians, positif : tourne vers la gauche de l'ecran). */
  lacet?: number;
  cadrage?: Cadrage;
  /** Horloge manuelle (tournage image par image) : rien ne bouge sans avancer(). */
  manuelle?: boolean;
  /** Faux : sans les corrections de mains de corrections.json (mesure du geste brut). */
  corriger?: boolean;
};

export type Vue = {
  /** Montrer cette mascotte et lui faire jouer ce geste ; `ensuite` en boucle a la fin (par defaut idle). */
  jouer(p: Personnage, geste: string, ensuite?: string | null): Promise<boolean>;
  /** Avancer l'horloge (secondes) et dessiner : pour l'horloge manuelle. */
  avancer(dt: number): void;
  /** La duree du geste en cours (secondes), 0 sans geste. */
  duree(): number;
  /** La vue tient-elle un rendu WebGL ? Faux : la toile restera vide. */
  ok: boolean;
  /** Pour la mesure (tools/mascotte-verifier.mjs) : le corps pose et le temps du geste. */
  inspecter(): { corps: THREE.Object3D; bassin: THREE.Object3D | null; temps: number; haut: number } | null;
  /** Replier un bras pour poser la main en `cible` (monde), sur la pose en cours (mesure des corrections). */
  plier(m: Membre, cible: THREE.Vector3): void;
  /** Relever la tete (cou tourne de `angle` radians autour de l'axe des epaules), sur la pose en cours. */
  leverTete(angle: number): void;
  liberer(): void;
};

/** Ouvrir une vue sur une toile. */
export function vueMascotte(o: Options): Vue {
  let rendu: THREE.WebGLRenderer | null = null;
  try {
    rendu = new THREE.WebGLRenderer({ canvas: o.toile, alpha: true, antialias: true, premultipliedAlpha: true,
      preserveDrawingBuffer: !!o.manuelle });   // (le tournage relit l'image apres le dessin)
    brancherKTX2(rendu);
    rendu.setPixelRatio(o.pixels ?? Math.min(2, window.devicePixelRatio || 1));
    rendu.outputColorSpace = THREE.SRGBColorSpace;
    rendu.toneMapping = THREE.ACESFilmicToneMapping;
    rendu.toneMappingExposure = 1.05;
    rendu.setClearColor(0x000000, 0);
  } catch { rendu = null; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  // UNE LUMIERE DE PLATEAU : une cle chaude de trois quarts haut, un debouche froid, un contre-jour
  // qui detache le contour sur n'importe quel fond (ecran de fin, ouverture, video)
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2f28, 1.25));
  const cle = new THREE.DirectionalLight(0xfff1e0, 2.4); cle.position.set(1.6, 2.6, 3.0); scene.add(cle);
  const contre = new THREE.DirectionalLight(0xbfd8ff, 2.0); contre.position.set(-2.2, 2.0, -2.6); scene.add(contre);

  const pivot = new THREE.Group();
  pivot.rotation.y = o.lacet ?? 0.32;
  scene.add(pivot);

  let actuel: { p: Personnage; corps: THREE.Object3D; mel: THREE.AnimationMixer; clips: THREE.AnimationClip[];
    bassin: THREE.Object3D | null; base: THREE.Vector3; repos: THREE.Vector3 } | null = null;
  let action: THREE.AnimationAction | null = null;
  let suite: string | null = 'idle';
  let demande = 0;
  let largeur = 0, hauteur = 0, haut = 1.6;
  let anim = 0, prec = 0;

  function cadrer() {
    if (!rendu) return;
    const r = o.toile.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== largeur || h !== hauteur) { largeur = w; hauteur = h; rendu.setSize(w, h, false); }
    camera.aspect = w / h;
    // le corps entier (ou le buste) tient dans l'image, avec une marge pour les bras leves
    const vise = o.cadrage === 'buste' ? haut * 0.55 : haut * 1.18;
    const cy = o.cadrage === 'buste' ? haut * 0.72 : haut * 0.5;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    let d = (vise / 2) / Math.tan(fov / 2);
    if (camera.aspect < 0.62) d *= 0.62 / camera.aspect;   // toile tres etroite : reculer
    camera.position.set(0, cy + haut * 0.08, d);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }

  function dessiner() {
    if (!rendu) return;
    cadrer();
    rendu.render(scene, camera);
  }

  // SUR PLACE, POUR DE BON. « Stay in place » chez Tripo ne retient pas tous les gestes : le bassin
  // du salut part de 1,8 m sur le cote (le heros sortait de l'image et revenait), l'echauffement de
  // 2 m, l'abattu de 0,8 m. Le corps entier est donc ramene sous son bassin des que celui-ci
  // s'eloigne de plus de ZONE (en part de la taille) de sa place au repos ; en deca, rien ne
  // bouge : les balancements naturels (un poids du corps qui change de jambe) restent.
  // La hauteur n'est jamais touchee — un saut, un genou a terre restent ce qu'ils sont.
  // (les pistes sont deja bornees en douceur au chargement, preparerClips : ceci reste un filet)
  const _p = new THREE.Vector3();
  function retenir() {
    if (!actuel?.bassin) return;
    const { corps, bassin, base, repos } = actuel;
    corps.position.copy(base);
    pivot.updateMatrixWorld(true);
    pivot.worldToLocal(bassin.getWorldPosition(_p));
    const z = ZONE * haut;
    const ecart = (d: number) => Math.sign(d) * Math.max(0, Math.abs(d) - z);
    corps.position.x -= ecart(_p.x - repos.x);
    corps.position.z -= ecart(_p.z - repos.z);
  }

  // LES MAINS SUR LE VENTRE (« hilare, il a la main dans le dossard », l'auteur, 20/11/2026). Le
  // fou rire « se tient le ventre » d'un corps au torse long : sur le buste court de la mascotte,
  // les mains montaient a la poitrine et entraient dans le dossard. Pour les gestes de MAINS_BASSES,
  // la main ne monte jamais au-dessus de l'os `plafond` : le bras est replie a nouveau (deux os,
  // epaule-coude-poignet, longueurs gardees, coude du cote ou il etait), la main garde son
  // orientation. En dessous du plafond, rien ne change.
  const MAINS_BASSES: Record<string, string> = { 'heros-hilare/fourire': 'spine_01' };
  const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3(), _t = new THREE.Vector3();
  const _d = new THREE.Vector3(), _pole = new THREE.Vector3(), _e2 = new THREE.Vector3(), _v = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qm = new THREE.Quaternion();
  // LES OS RETOUCHES SONT RENDUS AU MIXEUR (audit du 20/11/2026). Le mixeur de three.js n'ecrit un
  // os que si sa valeur animee CHANGE d'une image a l'autre (PropertyMixer.apply). Sur une pose
  // tenue — la fin figee de chaque geste, un debut immobile — il ne reecrivait donc rien, et le
  // repli des bras (corriger, mainsBasses) s'ajoutait a celui de l'image d'avant : la main derivait
  // de 2 cm par image puis revenait d'un coup quand l'animation repartait. Avant chaque mise a jour,
  // chaque os retouche reprend la valeur que le mixeur lui avait donnee.
  const retouches = new Map<THREE.Object3D, THREE.Quaternion>();
  function noter(os: THREE.Object3D) { if (!retouches.has(os)) retouches.set(os, os.quaternion.clone()); }
  function rendre() {
    for (const [os, q] of retouches) os.quaternion.copy(q);
    retouches.clear();
  }
  function tourner(os: THREE.Object3D, de: THREE.Vector3, vers: THREE.Vector3) {
    // tourne l'os (dans le monde) pour amener la direction `de` sur `vers`
    noter(os);
    _q.setFromUnitVectors(de.normalize(), vers.normalize());
    os.getWorldQuaternion(_qm);
    _qm.premultiply(_q);
    os.parent!.getWorldQuaternion(_qp);
    os.quaternion.copy(_qp.invert().multiply(_qm));
    os.updateMatrixWorld(true);
  }
  function mainsBasses() {
    if (!actuel) return;
    // (le geste qui s'efface garde sa retenue au prorata de son poids, comme dans corriger)
    let plafondNom = '', w = 0;
    for (const c of actuel.clips) {
      const nom = MAINS_BASSES[actuel.p + '/' + c.name];
      const a = nom ? actuel.mel.existingAction(c) : null;
      if (a && a.getEffectiveWeight() > w) { w = a.getEffectiveWeight(); plafondNom = nom; }
    }
    if (!plafondNom || w <= 0) return;
    const plafond = actuel.corps.getObjectByName(plafondNom);
    if (!plafond) return;
    actuel.corps.updateMatrixWorld(true);
    const yMax = plafond.getWorldPosition(_v).y;
    for (const c of ['l', 'r'] as const) {
      const main = actuel.corps.getObjectByName('hand_' + c);
      if (!main) continue;
      main.getWorldPosition(_h);
      if (_h.y <= yMax) continue;
      plier(c, _t.set(_h.x, _h.y + (yMax - _h.y) * w, _h.z));
    }
  }

  // RIEN NE PASSE A TRAVERS LE CORPS NI LE SOL (« verifie tous les autres et resous ce genre de
  // probleme », puis « pas seulement les mains, tous les endroits », l'auteur, 20/11/2026).
  // tools/mascotte-verifier.mjs mesure, image par image, ou une main, un avant-bras, une jambe ou un
  // pied entre dans le corps, et ou un pied passe sous le sol, et en tire, geste par geste, le
  // decalage qui l'en sort : public/modeles/mascotte/anime/corrections.json. Ici, on le relit au
  // temps du geste : tout le corps releve de `y`, puis chaque membre replie jusqu'a son bout decale.
  //
  // TOUS LES GESTES EN COURS, CHACUN A SON POIDS (audit du 20/11/2026). Seul le geste « courant »
  // etait corrige : au passage d'un geste a l'attente (fondu de 0,3 s), ses corrections tombaient
  // d'un coup a zero alors que son mouvement s'effacait encore — la main sautait de plusieurs
  // centimetres a chaque enchainement. Chaque action qui pese encore apporte donc sa part, au
  // prorata de son poids, et un geste en boucle relit ses corrections en boucle (la derniere
  // image rejoint la premiere au lieu de sauter).
  const _o = new THREE.Vector3(), _qb = new THREE.Quaternion();
  const somme: Record<Membre, THREE.Vector3> = { l: new THREE.Vector3(), r: new THREE.Vector3(), jl: new THREE.Vector3(), jr: new THREE.Vector3() };
  function corriger() {
    if (o.corriger === false || !actuel || !corrections || !actuel.bassin) return;
    let y = 0, tete = 0, rien = true;
    for (const m of ['l', 'r', 'jl', 'jr'] as const) somme[m].set(0, 0, 0);
    for (const c of actuel.clips) {
      const a = actuel.mel.existingAction(c);
      const cor = corrections[actuel.p + '/' + c.name];
      const w = a ? a.getEffectiveWeight() : 0;
      if (!a || !cor || w <= 0) continue;
      rien = false;
      const boucle = a.loop === THREE.LoopRepeat;
      const f = Math.max(0, a.time) / cor.pas, i = Math.floor(f), u = f - i;
      const at = (n: number, k: number) => (boucle ? ((k % n) + n) % n : Math.min(k, n - 1));
      const lire1 = (l: number[]) => { const n = l.length; return l[at(n, i)] + (l[at(n, i + 1)] - l[at(n, i)]) * u; };
      if (cor.y && cor.y.length) y += lire1(cor.y) * w;
      if (cor.tete && cor.tete.length) tete += lire1(cor.tete) * w;
      for (const m of ['l', 'r', 'jl', 'jr'] as const) {
        const l = cor[m];
        if (!l || !l.length) continue;
        const A = l[at(l.length, i)], B = l[at(l.length, i + 1)];
        somme[m].x += (A[0] + (B[0] - A[0]) * u) * w;
        somme[m].y += (A[1] + (B[1] - A[1]) * u) * w;
        somme[m].z += (A[2] + (B[2] - A[2]) * u) * w;
      }
    }
    if (rien) return;
    actuel.corps.position.y += y;
    actuel.corps.updateMatrixWorld(true);
    // le menton qui rentrait dans la poitrine : la tete relevee (angle, autour de l'axe des epaules)
    if (tete) leverTete(tete);
    actuel.bassin.getWorldQuaternion(_qb);
    for (const m of ['l', 'r', 'jl', 'jr'] as const) {
      const bout = actuel.corps.getObjectByName(CHAINES[m][2]);
      if (!bout || somme[m].lengthSq() < 1e-10) continue;
      _o.copy(somme[m]).applyQuaternion(_qb);
      plier(m, bout.getWorldPosition(_t).add(_o));
    }
  }

  /** Tourner le cou (neck_01) de `angle` radians autour de l'axe gauche-droite du corps. */
  const _axe = new THREE.Vector3(), _qc = new THREE.Quaternion();
  function leverTete(angle: number) {
    if (!actuel || Math.abs(angle) < 1e-5) return;
    const cou = actuel.corps.getObjectByName('neck_01');
    if (!cou) return;
    actuel.corps.getWorldQuaternion(_qc);
    _axe.set(1, 0, 0).applyQuaternion(_qc);
    _q.setFromAxisAngle(_axe, angle);
    noter(cou);
    cou.getWorldQuaternion(_qm).premultiply(_q);
    cou.parent!.getWorldQuaternion(_qp);
    cou.quaternion.copy(_qp.invert().multiply(_qm));
    cou.updateMatrixWorld(true);
  }

  /** Replier le membre `m` (deux os, longueurs gardees, coude ou genou de son cote) pour poser son bout en `cible`. */
  function plier(m: Membre, cible: THREE.Vector3) {
    if (!actuel) return;
    const [n0, n1, n2] = CHAINES[m];
    const bras = actuel.corps.getObjectByName(n0), avant = actuel.corps.getObjectByName(n1),
          main = actuel.corps.getObjectByName(n2);
    if (!bras || !avant || !main) return;
    {
      bras.getWorldPosition(_s); avant.getWorldPosition(_e); main.getWorldPosition(_h);
      _t.copy(cible);
      const a = _s.distanceTo(_e), b = _e.distanceTo(_h);
      // ni tendu au-dela de sa longueur, ni replie plus que ses deux os ne le permettent (une cible
      // collee a l'epaule donnait une division par zero : membre en NaN, mascotte effacee)
      let d = _s.distanceTo(_t);
      d = Math.max(Math.abs(a - b) * 1.001 + 1e-4, Math.min(d, (a + b) * 0.999));
      if (_s.distanceTo(_t) < 1e-6) return;
      _d.subVectors(_t, _s).normalize();
      // le coude reste du cote ou il etait (le « pole »)
      _pole.subVectors(_e, _s); _pole.addScaledVector(_d, -_pole.dot(_d));
      if (_pole.lengthSq() < 1e-8) return;
      _pole.normalize();
      const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
      _e2.copy(_s).addScaledVector(_d, a * cosA).addScaledVector(_pole, a * Math.sqrt(1 - cosA * cosA));
      main.getWorldQuaternion(_qm); const qMain = _qm.clone();
      tourner(bras, _v.subVectors(_e, _s).clone(), _v.subVectors(_e2, _s).clone());
      avant.getWorldPosition(_e); main.getWorldPosition(_h);
      tourner(avant, _v.subVectors(_h, _e).clone(), _v.subVectors(_t, _e).clone());
      // la main garde son orientation dans le monde (doigts poses sur le ventre)
      avant.getWorldQuaternion(_qp);
      noter(main);
      main.quaternion.copy(_qp.invert().multiply(qMain));
      main.updateMatrixWorld(true);
    }
  }

  function avancer(dt: number) {
    // (suivre en dernier : la nouvelle action n'a son vrai poids qu'a la mise a jour suivante)
    if (actuel) { rendre(); actuel.mel.update(dt); retenir(); mainsBasses(); corriger(); suivre(); }
    dessiner();
  }

  function boucle(t: number) {
    anim = requestAnimationFrame(boucle);
    if (document.hidden) { prec = t; return; }
    const dt = prec ? Math.min(0.1, (t - prec) / 1000) : 0;
    prec = t;
    avancer(dt);
  }

  let enchainer = false;
  function suivre() {
    if (!enchainer || !actuel || !action) return;
    enchainer = false;
    const c = clipDe(suite);
    if (!c) return;
    const a = actuel.mel.clipAction(c);
    a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    action.crossFadeTo(a, 0.35, false);
    action = a;
  }

  function clipDe(nom: string | null) {
    return (nom && actuel?.clips.find((c) => c.name === nom)) || null;
  }

  async function jouer(p: Personnage, geste: string, ensuite: string | null = 'idle') {
    const n = ++demande;
    const m = await chargerMascotte(p);
    if (!m || n !== demande || !rendu) return false;
    if (!actuel || actuel.p !== p) {
      if (actuel) { pivot.remove(actuel.corps); actuel.mel.stopAllAction(); }
      retouches.clear();
      const corps = clonerSquelette(m.scene);
      corps.traverse((x: any) => { if (x.isMesh) x.frustumCulled = false; });
      // les pieds au sol, au milieu de la scene ; la taille mesuree au repos
      const boite = new THREE.Box3().setFromObject(corps);
      corps.position.set(-(boite.min.x + boite.max.x) / 2, -boite.min.y, -(boite.min.z + boite.max.z) / 2);
      haut = Math.max(0.5, boite.max.y - boite.min.y);
      pivot.add(corps);
      // la place du bassin au repos, dans le repere de la scene tournee (voir retenir)
      const bassin = corps.getObjectByName('pelvis') || null;
      pivot.updateMatrixWorld(true);
      const repos = bassin ? pivot.worldToLocal(bassin.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3();
      actuel = { p, corps, mel: new THREE.AnimationMixer(corps), clips: m.clips, bassin, base: corps.position.clone(), repos };
      action = null;
      // LA SUITE PART APRES LA MISE A JOUR, PAS PENDANT (audit du 20/11/2026) : lancee dans
      // l'evenement, au milieu de mel.update, l'attente comptait une image a plein poids (le poids
      // par defaut de three.js, pas encore recalcule) : ses corrections s'ajoutaient a celles du
      // geste, la mascotte sursautait d'un cran a chaque fin de geste.
      actuel.mel.addEventListener('finished', (e: any) => {
        if (action && e.action === action) enchainer = true;
      });
    }
    const c = clipDe(geste) || clipDe('idle');
    if (!c) return false;
    suite = ensuite;
    enchainer = false;
    const a = actuel.mel.clipAction(c);
    a.reset();
    if (ensuite && ensuite !== geste) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    else a.setLoop(THREE.LoopRepeat, Infinity);
    a.play();
    if (action && action !== a) action.crossFadeTo(a, 0.3, false);
    action = a;
    if (!o.manuelle && !anim) anim = requestAnimationFrame(boucle);
    if (o.manuelle) dessiner();
    return true;
  }

  return {
    jouer,
    avancer,
    duree: () => action?.getClip().duration || 0,
    ok: !!rendu,
    inspecter: () => actuel && { corps: actuel.corps, bassin: actuel.bassin, temps: action?.time || 0, haut },
    plier: (m, cible) => plier(m, cible),
    leverTete: (a) => leverTete(a),
    liberer() {
      cancelAnimationFrame(anim); anim = 0; demande++;
      actuel?.mel.stopAllAction();
      // LE CONTEXTE WEBGL SE REND, PAS SEULEMENT LA MEMOIRE (20/11/2026) : dispose() vide les
      // tampons mais garde le contexte ouvert. Chaque passage par l'accueil ou une fin de course en
      // laissait un de plus ; un telephone n'en tient qu'une poignee, et quand il en manque, le
      // navigateur ferme le plus ancien — celui de la course, qui restait blanche. On le rend donc
      // explicitement (forceContextLoss), apres avoir vide la memoire.
      rendu?.dispose();
      rendu?.forceContextLoss();
      rendu = null;
    },
  };
}
