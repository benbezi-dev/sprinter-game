// LA COURSE EN VRAIE 3D — PROTOTYPE (22/10/2026).
//
// Rien du jeu ne change : le moteur fait avancer `G` comme toujours, et ce
// fichier ne fait que le REGARDER autrement. Il n'est charge que derriere
// `?rendu=3d` (components/GameCanvas.tsx) et ne remplace le dessin 2D que
// pendant le decompte, la course et le faux depart ; accueil, cinematiques
// et resultats restent ceux du jeu.
//
// LES COUREURS SONT CEUX DU JEU. `personCapsules` (sprinter-app.js) rend deja
// chaque athlete en troncs de cone dans un repere metrique 3D — x devant,
// y a gauche, z en haut — que le jeu aplatit ensuite pour son dessin. On les
// rend ici tels quels : looks, foulees, blocs, chutes et fatigue viennent
// gratuitement. Un seul maillage instancie pour tous les troncs, un autre
// pour les articulations : deux appels de dessin, quel que soit le nombre
// de coureurs.
//
// LES VIRAGES (200 et 400 m) : le jeu pose ces courses dans son propre repere,
// le virage de depart centre sur l'origine (voir Track, sprinter-core.js). `caler`
// le ramene sur le stade, l'arrivee toujours au bout de la ligne droite principale.
//
// shortcut: pas de relais, pas de concours (ils restent en 2D,
// GameCanvas.tsx), pas d'enregistreur video.
//
// LA CAMERA SERT LE JEU ACTUEL (l'auteur, 22/10) : on y court en voyant les
// huit couloirs, pour se mesurer aux autres. Par defaut, elle se tient donc en
// hauteur, de trois quarts arriere et un peu sur le cote, et cadre toute la
// piste en suivant le joueur. `?cam=dos` la met derriere lui, dans son couloir.
//
// Reglages d'URL : ?cam=dos ?haut= (hauteur, m) ?recul= (m derriere le
// joueur) ?cote= (m sur le cote) ?ombres=0 (sans ombres, telephones faibles)
// ?stade=or (habille la course 3D d'un autre stade du jeu, pour le voir sans le
// canal de test : la liste des stades, elle, ne change pas).
//
// LE DECOUPAGE (11/11, lot 2 de docs/audit-refonte-3d-2026-11-10.md) : ce fichier ne garde que l'image
// (rendre), l'affichage et la projection a l'ecran ; le reste est dans course-3d/ :
//   reglages.ts     les reglages d'URL et les mesures de la piste
//   paliers.ts      les paliers de qualite, la cadence mesuree, le compteur ?ips
//   scene.ts        le moteur de rendu, la scene, les lumieres, les tubes des coureurs
//   repere.ts       du repere du jeu a celui du stade
//   camera.ts       les plans de camera, le survol, le soleil qui suit la camera
//   stade.ts        le stade de l'etape, aux couleurs du theme
//   decors.ts       l'espace, le Stade Neon, les pieces de chaque stade
//   public.ts       la foule en cartes
//   salle-noire.ts  la competition dans le noir (extinction, lampes, presentation au sol)
//   corps.ts        les coureurs en vrai maillage, leurs tenues, les boss et vedettes
//   haies.ts, bete.ts, effets.ts   les haies, le molosse, les coups de poussee

import * as THREE from 'three';
import { uVent } from './drapeau-3d';
import { STADE_FORCE, tourDuChamp, MAX_TRONCS, R_CORDE } from './course-3d/reglages';
import { oublierLaMesure, IPS, compterLesImages, tenirLaCadence, laisserCompiler } from './course-3d/paliers';
import { camera, toile, renderer, vignetteDe, initialiser, monde, _a, _b, _d, _c, _q, AXE_Y, _m, _s, troncs, aR, joints, scene } from './course-3d/scene';
import { ouCourt, caler, capIci, virageApres, ici } from './course-3d/repere';
import { chargerLePublic, uFoule } from './course-3d/public';
import { voute, pluie, filante } from './course-3d/decors';
import { videoPub, stade, themeVu, formeVue, stadeVu, construireLeStade, ruelle, pubAnim, hologrammes } from './course-3d/stade';
import { chargerLeCorps, chargerLeBloc, corps, poserLeCorps } from './course-3d/corps';
import { poserLesHaies } from './course-3d/haies';
import { chargerLaBete, poserLaBete } from './course-3d/bete';
import { initialiserLesEffets, dessinerLesEffets } from './course-3d/effets';
import { lacherLaCamera, cadrer } from './course-3d/camera';

let imagePrecedente3D: number | null = null;
const _camLocale = new THREE.Vector3(), _camCap = new THREE.Vector3();
let visible = false;
export let nCouloirs = 8;
let filanteT = 0;
/** LA BULLE DE PAROLE EN 3D (sprinter-app.js, drawBulle) : ou tombe, a l'ecran, le point juste
 *  au-dessus de la tete de `r` — en pixels de la toile du jeu (G.VW x G.VH). */
export function ecranDe(App: any, r: any, haut = 1.28): { x: number; y: number } | null {
  const G = App.G, T = G.track;
  if (!camera || !r || !T || !toile || toile.style.display === 'none') return null;
  const p = ouCourt(T, r);
  const v = _ecran.set(p[0], -p[1], (r.look && r.look.h ? r.look.h : 1.75) * haut).project(camera);
  if (v.z > 1 || v.z < -1) return null;
  return { x: (v.x + 1) / 2 * G.VW, y: (1 - v.y) / 2 * G.VH };
}
const _ecran = new THREE.Vector3();

/** Montrer ou cacher la scene 3D (le dessin 2D reprend la main hors course). */
export function afficher(oui: boolean) {
  if (oui === visible || !renderer) { visible = oui && !!renderer; if (renderer) toile.style.display = visible ? 'block' : 'none'; return; }
  visible = oui;
  toile.style.display = oui ? 'block' : 'none';
  if (vignetteDe) vignetteDe.style.display = oui ? 'block' : 'none';
  if (!oui) { lacherLaCamera(); imagePrecedente3D = null; oublierLaMesure(); }
  if (!oui && videoPub) videoPub.pause();     // rendre() la relance au retour en piste
}

/** Une image de la course, lue sur l'etat du jeu. */
export function rendre(App: any, dt: number) {
  if (IPS) compterLesImages();
  const { G, C } = App;
  // La qualite suit le temps reel du rendu, jamais le pas plafonne de la
  // simulation ni le ralenti d'un tutoriel.
  const maintenantImage = performance.now();
  const dtRendu = imagePrecedente3D === null ? 0 : (maintenantImage - imagePrecedente3D) / 1000;
  imagePrecedente3D = maintenantImage;
  tenirLaCadence(dtRendu, !G.paused && !document.hidden && G.state === 'race' && G.elapsed > 1);
  const T = G.track;
  if (!renderer) {
    const lanes = (G.runners || []).map((r: any) => r.lane | 0);
    nCouloirs = Math.max(8, ...lanes.map((l: number) => l + 1));
    initialiser(nCouloirs, G.cv || null);
    initialiserLesEffets();
    chargerLeCorps();
    chargerLeBloc();
    chargerLePublic();
  }
  // le stade de l'etape en cours (le theme a l'heure ou l'on joue, comme le dessin 2D)
  // (l'eclairage de l'heure rend un nouvel objet : c'est le theme brut qui dit si l'etape a change)
  // le stade force passe lui aussi par l'heure (?stade=plage&heure=nuit), comme App.theme()
  const forceBrut = STADE_FORCE && App.THEMES && App.THEMES[STADE_FORCE];
  const force = forceBrut && App.eclaire ? App.eclaire(forceBrut) : forceBrut;
  const brut = forceBrut || (App.themeBrut ? App.themeBrut() : null);
  // ... et la forme de la course : ligne droite, demi-tour ou tour complet
  // ... et l'etape : les pieces du stade des quatre premieres en sortent de plus en plus
  const forme = (T.curved ? (T.fullLap ? 'tour' : 'demi') + T.straight : 'droite') + T.total + '/' + (G.levelIdx | 0)
    + '/' + ((App.theme && App.theme() && App.theme().moment) || 'jour')   // le moment de la journee aussi
    + '/' + (tourDuChamp() || '');   // echauffement > course, ou reponse du serveur apres le premier stade : on rebatit
  caler(T);
  if (!stade || brut !== themeVu || forme !== formeVue) {
    stadeVu(brut, forme);
    const b = (brut && brut.base) || brut, TH = App.THEMES || {};
    const stadeCle = Object.keys(TH).find(k => TH[k] === b) || null;
    const affluence = force ? 0.92 : App.fouleDe ? App.fouleDe(G.levelIdx | 0) : 1;
    construireLeStade(nCouloirs, force || (App.theme ? App.theme() : {}), T, C, stadeCle, force ? 9 : G.levelIdx | 0, affluence);
    // Une compilation initiale ne doit pas condamner la qualite de toute la partie.
    laisserCompiler();
  }
  if (!toile || toile.style.display === 'none') {
    afficher(true);
  }
  const tous = (G.ghost && G.runners.indexOf(G.ghost.runner) < 0) ? G.runners.concat([G.ghost.runner]) : G.runners;
  // les blocs et le « prets » : c'est le dessin du jeu qui les pose, a chaque image
  for (const r of tous) App.phaseBlocs(r);

  // les corps des coureurs d'une course passee s'en vont avec elle
  for (const [r, c] of corps) {
    c.m.racine.visible = false;
    if (tous.indexOf(r) < 0) { monde.remove(c.m.racine); corps.delete(r); }
  }
  poserLesHaies(G, T, C);
  let n = 0, nj = 0;
  for (const r of tous) {
    if (!r || !r.look) continue;
    const p = ouCourt(T, r);
    const cap = capIci(T.heading(r.d, r.lane)) - virageApres(T, r.lane, r.d) + (r.retour ? Math.PI : 0) + (r.cap || 0);
    const k = (r.look.h || C.MODEL_H) / C.MODEL_H;
    const lean = T.lean(r.d, r.lane, r.v) + (r.roulis || 0);
    r.squelette3D = true;
    // le saut d'une haie : c'est l'obstacle qui pose la posture, a chaque image (drawRunner, sprinter-app.js)
    if (G.obstacles && G.obstacles.haies3D) G.obstacles.preparer(r, G, C);
    const caps = App.personCapsules(r, cap, lean, false, false, r === G.player ? 0 : 1);
    if (poserLeCorps(App, r, p, cap, lean, k)) continue;
    for (const [col, e0, e1] of caps) {
      if (n >= MAX_TRONCS || nj >= MAX_TRONCS - 1) break;
      _a.set(p[0] + e0[0] * k, p[1] + e0[1] * k, e0[2] * k);
      _b.set(p[0] + e1[0] * k, p[1] + e1[1] * k, e1[2] * k);
      _d.subVectors(_b, _a);
      const L = _d.length();
      _c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);
      if (L > 1e-4) {
        _q.setFromUnitVectors(AXE_Y, _d.divideScalar(L));
        _m.compose(_s.addVectors(_a, _b).multiplyScalar(0.5), _q, _d.set(1, L, 1));
        troncs.setMatrixAt(n, _m);
        aR.setXY(n, e0[3] * k, e1[3] * k);
        troncs.setColorAt(n, _c);
        n++;
      }
      for (const e of [e0, e1]) {
        const rr = e[3] * k;
        _m.compose(_s.set(p[0] + e[0] * k, p[1] + e[1] * k, e[2] * k), _q.identity(), _d.set(rr, rr, rr));
        joints.setMatrixAt(nj, _m); joints.setColorAt(nj, _c); nj++;
      }
    }
  }
  troncs.count = n; joints.count = nj;
  troncs.instanceMatrix.needsUpdate = true; joints.instanceMatrix.needsUpdate = true;
  aR.needsUpdate = true;
  // LA NUIT DU MOLOSSE : la ruelle vit (brume, reverberes), la bete court derriere le joueur
  const nuitDuMolosse = typeof G.raceKey === 'string' && G.raceKey.startsWith('nuit-');
  if (ruelle) {
    const qui = G.spectateur && G.suivi ? G.suivi : G.player;
    const pj = ici(T.pos(qui ? qui.d : 0, qui ? qui.lane : 0));
    ruelle.animer(camera.position.x, -camera.position.y, pj[0], pj[1], performance.now() / 1000);
  }
  if (nuitDuMolosse) chargerLaBete();
  poserLaBete(G, T, nuitDuMolosse);
  if (troncs.instanceColor) troncs.instanceColor.needsUpdate = true;
  if (joints.instanceColor) joints.instanceColor.needsUpdate = true;

  const pl = cadrer(G, T, dt, nuitDuMolosse);
  // la foule : ou est la camera (dans le repere du monde), ou est le joueur, l'arrivee passee
  if (voute) voute.rotation.y += (dt || 0.016) * 0.006;
  if (pubAnim.length && stade) {
    const t = performance.now() / 1000, c = stade.worldToLocal(_camLocale.copy(camera.position));
    camera.getWorldDirection(_camCap);
    const cap = Math.atan2(-_camCap.y, _camCap.x);            // le cap de la camera, dans le repere du stade (monde en miroir)
    for (const f of pubAnim) f(t, c.x, c.y, cap);
  }
  if (hologrammes.length) {
    const t = performance.now() / 1000;
    hologrammes.forEach((m, i) => {
      // un gresillement de temps en temps, sinon une lueur qui respire
      const g = Math.sin(t * 23 + i * 7) > 0.97 ? 0.25 : 0.82 + 0.12 * Math.sin(t * 1.7 + i);
      (m.material as THREE.MeshBasicMaterial).opacity = g;
    });
  }
  if (pluie) {
    // la pluie tombe autour de la camera (dans le repere de la scene, hors du monde en miroir)
    pluie.position.set(camera.position.x, camera.position.y, -((performance.now() / 1000 * 26) % 30));
  }
  if (filante) {
    filanteT -= dt || 0.016;
    if (filanteT < -0.9) {
      // une nouvelle, quelque part dans le ciel, toutes les cinq a dix secondes
      filanteT = 5 + Math.random() * 5;
      const a = Math.random() * Math.PI * 2;
      filante.position.set(44 + 260 * Math.cos(a), -R_CORDE + 260 * Math.sin(a), 70 + Math.random() * 90);
      filante.lookAt(44, -R_CORDE, 0);
      filante.rotateZ(Math.random() * Math.PI);
    }
    filante.visible = filanteT < 0;
    if (filanteT < 0) {
      filante.translateX(-(dt || 0.016) * 120);
      (filante.material as THREE.MeshBasicMaterial).opacity = Math.min(1, -filanteT * 4) * (1 + filanteT);
    }
  }
  uFoule.uT.value = performance.now() / 1000;
  uVent.value = uFoule.uT.value;
  monde.worldToLocal(uFoule.uCam.value.copy(camera.position));
  if (pl) {
    const q = ouCourt(T, pl);
    uFoule.uJoueur.value.set(q[0], q[1]);
    const fini = pl.d >= T.total ? 0.9 : 0;
    uFoule.uLiesse.value += (fini - uFoule.uLiesse.value) * Math.min(1, (dt || 0.016) * 1.5);
  }
  dessinerLesEffets(App);
  renderer!.render(scene, camera);
  // LE FILM D'APRES COURSE (review.ts) recopie l'image 3D ici, juste apres son trace : plus tard
  // dans l'image, le navigateur a deja vide le tampon WebGL et la copie sortait noire
  const filmer = (globalThis as any).__filmer3D;
  // (le film ne doit jamais pouvoir arreter la course : une erreur ici remontait dans la boucle du jeu)
  if (filmer) try { filmer(renderer!.domElement); } catch { /* cette image manquera au film */ }
}
