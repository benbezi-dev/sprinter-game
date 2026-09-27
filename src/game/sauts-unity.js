/* ---------------------------------------------------------------------------
   JUMPER — la longueur et le triple, rendus par Unity
   ---------------------------------------------------------------------------
   UNE AUTRE SCENE PAR-DESSUS LE MEME JEU. Comme sauts-3d.js, ce fichier ne
   decide de rien : le saut reste celui de longueur-course.js. Il lit l'etat
   du saut et le squelette du sauteur a chaque image, les range dans un
   Float32Array (window.__jumperEtat), et la scene Unity (unity/JumperSaut) les
   relit par son pont (Assets/Plugins/WebGL/Pont.jslib). Les indices sont ceux
   d'Assets/Scripts/Etat.cs : changer l'un, c'est changer l'autre.

   UNITY EST LOURD, ON LE GARDE. Son chargement coute plusieurs secondes et
   plusieurs dizaines de Mo de memoire : l'instance est creee une fois, puis
   mise en pause entre deux concours plutot que detruite. Tant qu'elle n'a pas
   rendu sa premiere image, la scene three.js tient la place.

   Seul le canal de test l'embarque (vite.config.ts, UNITY_JUMPER).
--------------------------------------------------------------------------- */

import { SprinterApp, SprinterCore } from './engine';
import { etatSaut, sauteurLocal, PISTE_Y } from './longueur-course.js';
import { monterScene3D } from './sauts-3d.js';

const ETAT = {
  N: 96, Tic: 0, Phase: 1, Epreuve: 2, T: 3, D: 4, Y: 5, K: 6,
  HipX: 7, HipY: 8, HipZ: 9, Bassin: 10, Buste: 11, Tete: 12, LacetBas: 13, LacetHaut: 14, Chute: 15,
  JambeA: 16, JambeB: 19, BrasA: 22, BrasB: 24, Epaule: 26, Hanche: 27,
  Ligne: 28, FosseX: 29, FosseFin: 30, Gerbe: 31, GerbeX: 32, GerbeY: 33, GerbeForce: 34,
  Empreinte: 35, EmpreinteX: 36, EmpreinteY: 37, Drapeau: 38, Mesure: 39, MesureA: 40, Metres: 41,
  Vitesse: 42, Vent: 43, Bond: 44, Etape: 45, Planches: 46, Lignes: 50, Look: 62, Tenu: 77,
  Portrait: 78, Reception: 79,
};
const PHASES = ['repos', 'attente', 'elan', 'appel', 'vol', 'pose', 'reception', 'temps', 'traverse', 'casse'];

/** Le rendu choisi : Unity par defaut, three.js si on le demande. */
const CLE = 'jumper_rendu';
export function renduChoisi() {
  try { return localStorage.getItem(CLE) === 'three' ? 'three' : 'unity'; } catch { return 'unity'; }
}
export function choisirRendu(r) {
  try { localStorage.setItem(CLE, r); } catch { /* rien */ }
}

/* ------------------------------------------------------------ l'instance */

const BASE = `${import.meta.env.BASE_URL}unity-jumper/Build/`;
let instance = null;       // la promesse de l'instance Unity
let pret = false;          // a-t-elle rendu sa premiere image ?
const surPret = new Set();

function chargerScript(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => ko(new Error('chargement ' + src));
    document.head.appendChild(s);
  });
}

let toile = null;
function instanceUnity(hote) {
  if (instance) return instance;
  toile = document.createElement('canvas');
  toile.id = 'jumper-unity';
  toile.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;visibility:hidden;';
  toile.tabIndex = -1;
  window.__jumperPret = () => { pret = true; for (const f of surPret) f(); };
  // Le loader mesure la toile pour regler son rendu : elle doit etre dans la
  // page avant qu'il ne demarre, meme invisible.
  hote.appendChild(toile);
  instance = chargerScript(BASE + 'jumper-saut.loader.js').then(() =>
    window.createUnityInstance(toile, {
      dataUrl: BASE + 'jumper-saut.data.unityweb',
      frameworkUrl: BASE + 'jumper-saut.framework.js.unityweb',
      codeUrl: BASE + 'jumper-saut.wasm.unityweb',
      companyName: 'Sprinter', productName: 'Jumper', productVersion: '1',
      // Un ecran de telephone a trois pixels par point : deux suffisent, et
      // divisent par plus de deux le travail du GPU.
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      matchWebGLToCanvasSize: true,
    })).catch((err) => { instance = null; throw err; });
  return instance;
}

/* ------------------------------------------------------------ l'etat */

const etat = new Float32Array(ETAT.N);
window.__jumperEtat = etat;
let tic = 0, gerbeVue = null, gerbeId = 0;

/** Une couleur du look : [r, g, b] en 0-255, ou une chaine CSS. */
function rgb(c, i) {
  let r = 0.5, g = 0.5, b = 0.5;
  if (Array.isArray(c)) { r = c[0] / 255; g = c[1] / 255; b = c[2] / 255; }
  else if (typeof c === 'string' && c[0] === '#' && c.length >= 7) {
    r = parseInt(c.slice(1, 3), 16) / 255; g = parseInt(c.slice(3, 5), 16) / 255; b = parseInt(c.slice(5, 7), 16) / 255;
  }
  etat[i] = r; etat[i + 1] = g; etat[i + 2] = b;
}

/** Remplir l'etat. Faux hors d'un concours. */
function ecrireEtat() {
  const e = etatSaut(), ou = sauteurLocal(), G = SprinterApp.G, j = G.player;
  if (!e || !ou || !j) return false;
  // La posture du saut (ciseau, ramene, reception) est posee par le jeu sur
  // le coureur avant qu'on le dessine : on la redemande, comme sauts-3d.js.
  if (G.obstacles && G.obstacles.preparer) G.obstacles.preparer(j, G, SprinterCore.C);
  j.squelette = j.squelette || {};
  SprinterCore.pose(j);
  const sq = j.squelette;
  if (!sq.hip) return false;

  const fsh = SprinterCore.fallShape(j.fallAnim);
  const sautW = j.saut ? Math.max(0, Math.min(1, j.saut.w)) : 0;
  const chute = (fsh ? fsh.pitch : 0) -
    (j.drivePitch || 0) * Math.pow(1 - Math.max(0, Math.min(1, j.enBloc || 0)), 2) * (1 - sautW);

  etat[ETAT.Tic] = ++tic;
  etat[ETAT.Phase] = Math.max(0, PHASES.indexOf(e.phase));
  etat[ETAT.Epreuve] = e.epreuve === 'triple' ? 1 : 0;
  etat[ETAT.T] = e.t || 0;
  etat[ETAT.D] = ou.d;
  etat[ETAT.Y] = ou.y - PISTE_Y;
  etat[ETAT.K] = (j.look && j.look.h ? j.look.h : 1.8) / SprinterCore.C.MODEL_H;
  etat[ETAT.HipX] = sq.hip[0]; etat[ETAT.HipY] = sq.hip[1]; etat[ETAT.HipZ] = sq.hip[2];
  etat[ETAT.Bassin] = sq.bassin; etat[ETAT.Buste] = sq.buste; etat[ETAT.Tete] = sq.tete;
  etat[ETAT.LacetBas] = sq.lacetBas; etat[ETAT.LacetHaut] = sq.lacetHaut; etat[ETAT.Chute] = chute;
  for (let i = 0; i < 3; i++) { etat[ETAT.JambeA + i] = sq.l[i]; etat[ETAT.JambeB + i] = sq.r[i]; }
  for (let i = 0; i < 2; i++) { etat[ETAT.BrasA + i] = sq.al[i]; etat[ETAT.BrasB + i] = sq.ar[i]; }

  etat[ETAT.Ligne] = e.ligne;
  etat[ETAT.FosseX] = e.fosseX;
  const fin = e.fosseX + 9;
  etat[ETAT.FosseFin] = fin;
  if (e.gerbe && e.gerbe !== gerbeVue) { gerbeVue = e.gerbe; gerbeId++; }
  if (!e.gerbe) gerbeVue = null;
  etat[ETAT.Gerbe] = gerbeId;
  if (e.gerbe) {
    etat[ETAT.GerbeX] = e.gerbe.x; etat[ETAT.GerbeY] = e.gerbe.y - PISTE_Y; etat[ETAT.GerbeForce] = e.gerbe.force || 1;
  }
  etat[ETAT.Empreinte] = e.empreinte ? 1 : 0;
  if (e.empreinte) { etat[ETAT.EmpreinteX] = e.empreinte.x; etat[ETAT.EmpreinteY] = e.empreinte.y - PISTE_Y; }
  etat[ETAT.Drapeau] = e.drapeau ? (e.drapeau.blanc ? 1 : 2) : 0;
  etat[ETAT.Mesure] = e.mesure ? 1 : 0;
  etat[ETAT.MesureA] = e.mesure ? e.mesure.a : 0;
  const r = e.resultat;
  etat[ETAT.Metres] = r && !r.mordu && r.marque != null ? r.marque : -1;
  etat[ETAT.Vitesse] = j.v || 0;
  etat[ETAT.Vent] = e.vent || 0;
  etat[ETAT.Bond] = e.bond || 0;
  etat[ETAT.Etape] = e.etape || 0;
  for (let i = 0; i < 2; i++) {
    const p = e.planches[i];
    etat[ETAT.Planches + i * 2] = p ? p.x : 0;
    etat[ETAT.Planches + i * 2 + 1] = p && p.actif ? 1 : 0;
  }
  for (let i = 0; i < 3; i++) {
    const l = (e.lignes || [])[i];
    etat[ETAT.Lignes + i * 4] = l ? l.m : -1;
  }
  const L = j.look || {};
  rgb(L.skin, ETAT.Look); rgb(L.jersey, ETAT.Look + 3); rgb(L.shorts, ETAT.Look + 6);
  rgb(L.shoe, ETAT.Look + 9); rgb(L.hairCol, ETAT.Look + 12);
  etat[ETAT.Tenu] = e.appel ? e.appel.u || 0 : 0;
  etat[ETAT.Reception] = e.reception ? e.reception.t : 0;
  return true;
}

/* ------------------------------------------------------------ la scene */

/**
 * Monter la scene Unity par-dessus le canvas du moteur. Rend `detruire()`.
 * Pendant le chargement, et si Unity echoue, c'est la scene three.js qu'on
 * voit.
 */
export function monterSceneUnity() {
  const G = SprinterApp.G;
  const hote = G.cv && G.cv.parentElement;
  if (!hote) return () => {};
  let vivant = true, id = 0;
  let detruire3D = monterScene3D();

  const montrer = () => {
    if (!vivant || !toile) return;
    toile.style.visibility = 'visible';
    // la scene three.js a fait son office : on la rend
    if (detruire3D) { detruire3D(); detruire3D = null; }
  };

  instanceUnity(hote).then((u) => {
    if (!vivant) return;
    if (toile.parentElement !== hote) hote.appendChild(toile);
    try { u.Module.resumeMainLoop && u.Module.resumeMainLoop(); } catch { /* rien */ }
    if (pret) montrer(); else surPret.add(montrer);
  }).catch((err) => {
    // Unity ne se charge pas (reseau, memoire, WebGL2 absent) : three.js reste.
    console.warn('[jumper] scene Unity indisponible :', err && err.message);
  });

  const image = () => {
    if (!vivant) return;
    id = requestAnimationFrame(image);
    ecrireEtat();
  };
  id = requestAnimationFrame(image);

  return function detruire() {
    vivant = false;
    cancelAnimationFrame(id);
    surPret.delete(montrer);
    if (detruire3D) detruire3D();
    if (toile) {
      toile.style.visibility = 'hidden';
      toile.remove();
    }
    // En pause entre deux concours : plus une image, plus un cycle GPU.
    if (instance) instance.then((u) => {
      try { u.Module.pauseMainLoop && u.Module.pauseMainLoop(); } catch { /* rien */ }
    }).catch(() => {});
  };
}
