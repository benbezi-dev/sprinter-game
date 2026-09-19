/* -----------------------------------------------------------------------
   SPRINTER 3D — LA MAQUETTE.

   Ce qu'elle est : LE jeu, sous une autre camera. Le moteur charge ici est le
   meme fichier que celui du jeu publie — meme physique, meme cycle de foulee,
   meme piste, memes adversaires et leurs chronos vises. Rien n'est rejoue ni
   approxime : `pose()` donne le squelette, `Track` donne le terrain, et seule
   la couche qui les regarde a change.

   Ce qu'elle n'est PAS : une version a publier. Elle vit dans sa propre page
   (`3d.html`), qui n'entre dans aucun build — `vite build` ne construit que
   `index.html`. Trois.js reste une dependance de developpement, et le paquet
   du jeu ne bouge pas d'un octet.

   POURQUOI ELLE EXISTE. « Faut-il passer en 3D ? » est une question a laquelle
   aucune capture d'ecran d'un autre jeu ne repond. Elle se tranche en
   regardant CES athletes, sur CETTE piste, dans CE stade — avec une camera de
   television posee derriere le coureur, ce que la projection isometrique ne
   peut pas faire. C'est ce que cette page montre.
   ----------------------------------------------------------------------- */
import * as THREE from 'three';
import '../game/sprinter-core.js';
import '../game/chiffres-piste.js';
import { construireStade, posR, bordsPiste } from './monde.js';
import { Athlete3D, Materiaux } from './athlete.js';

const K = globalThis.SprinterCore;
const { C, RACES, Track, Runner } = K;

// LE HAUT EST LE Z. Three.js prefere le Y ; le moteur du jeu travaille en Z
// depuis toujours. Convertir a chaque acces serait une source de bugs sans
// aucun benefice — on change donc la convention de Three.js, une fois, avant
// de creer quoi que ce soit.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

/* --------------------------------------------------------------- stades --
   Les palettes sont reprises telles quelles des themes du jeu 2D. Elles ne
   sont pas importees : `sprinter-app.js` embarque tout le rendu canvas, le
   son et l'etat de partie, et cette page n'a besoin que de douze couleurs.
   -------------------------------------------------------------------- */
const STADES = {
  jour: {
    nom: 'Stade olympique — plein jour',
    skyTop: [58, 92, 178], skyBot: [128, 176, 226], lointain: [186, 212, 234],
    grass: [38, 118, 30], trackA: [186, 48, 44], trackB: [172, 42, 40],
    lane: [246, 244, 238], kerb: [252, 252, 252],
    tread: [176, 178, 186], riser: [132, 136, 148],
    panels: [[214, 74, 62], [44, 108, 186], [240, 196, 70], [60, 152, 118]],
    crowdLo: [64, 60, 78], crowdHi: [238, 232, 224],
    soleil: [1.0, 0.96, 0.88], force: 3.1, ambiant: 0.55, nuit: false,
  },
  nuit: {
    nom: 'Stade du Danube — nocturne',
    skyTop: [12, 9, 26], skyBot: [40, 26, 60], lointain: [58, 40, 84],
    grass: [22, 21, 26], trackA: [232, 104, 38], trackB: [206, 86, 28],
    lane: [255, 255, 255], kerb: [244, 244, 250],
    tread: [52, 44, 68], riser: [30, 26, 44],
    panels: [[236, 46, 150], [56, 214, 236], [128, 78, 222], [240, 122, 40]],
    crowdLo: [40, 34, 54], crowdHi: [196, 182, 214],
    soleil: [0.72, 0.78, 1.0], force: 0.35, ambiant: 0.16, nuit: true,
  },
};

/* ---------------------------------------------------------------- scene -- */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// L'etalonnage qu'on avait renonce a faire a la main sur le canvas 2D : une
// courbe filmique, et non un ecretage brutal des hautes lumieres. C'est ce qui
// empeche une piste au soleil de virer au blanc pur et une nocturne de se
// boucher dans les noirs.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
camera.up.set(0, 0, 1);

let stade = null, sol = null, mats = null;
let T = null, coureurs = [], joueur = null, athletes = [];
let soleil = null, hemi = null, lampes = [];
let themeCle = 'jour';

/* ---------------------------------------------------------------- course -- */
let etat = 'compte', compte = 3, elapsed = 0, acc = 0;
// L'etat d'alternance du pilote automatique (voir Sprinter3D.simuler).
let simCote = 0, simProchain = 0;
// MODE CAPTURE. La boucle d'image avance normalement la course du temps ecoule
// depuis l'image precedente. Pour filmer, c'est exactement ce qu'il ne faut
// pas : on veut qu'UNE image rendue vaille UN pas de temps choisi, sinon la
// videa obtenue rejoue une course dont chaque image dure ce qu'a dure son
// calcul. Le drapeau gele donc la simulation, et le harnais l'avance lui-meme.
let capture = false;

function monterCourse(cle) {
  themeCle = cle;
  const th = STADES[cle];
  // On vide la scene precedente sans fuir : geometries et matieres d'un stade
  // pesent quelques dizaines de mega-octets sur la carte, et changer de stade
  // dix fois ne doit pas les empiler.
  while (scene.children.length) {
    const o = scene.children.pop();
    o.traverse && o.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) (Array.isArray(n.material) ? n.material : [n.material])
        .forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  lampes = [];

  const R = RACES['100'];
  T = new Track(R);
  stade = construireStade(THREE, scene, T, th);

  // Lumiere. Une voute, un soleil, et la nuit ses projecteurs.
  hemi = new THREE.HemisphereLight(
    new THREE.Color(th.skyBot[0] / 255, th.skyBot[1] / 255, th.skyBot[2] / 255),
    new THREE.Color(th.grass[0] / 255, th.grass[1] / 255, th.grass[2] / 255),
    th.ambiant);
  scene.add(hemi);

  soleil = new THREE.DirectionalLight(
    new THREE.Color(th.soleil[0], th.soleil[1], th.soleil[2]), th.force);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  soleil.shadow.camera.near = 1;
  soleil.shadow.camera.far = 120;
  // LA BOITE D'OMBRE SUIT LE COUREUR. Une carte d'ombre qui couvrirait le
  // stade entier n'aurait, a 2048 pixels, qu'un texel tous les dix
  // centimetres : les doigts et les pointes n'y projetteraient rien. Trente
  // metres autour du joueur, et un texel fait un centimetre et demi.
  const d = 18;
  Object.assign(soleil.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  // SANS CETTE LIGNE, TOUT LE MONDE EST NOIR. Poser les bornes d'une camera
  // orthographique ne suffit pas : sa matrice de projection n'est recalculee
  // que sur demande. Elle restait donc au gabarit par defaut, une boite de dix
  // metres de cote — et hors de cette boite, le rendu prend le bord de la
  // carte d'ombre, ce qui plonge les athletes dans une ombre qu'aucune lampe
  // ne projette. Le symptome trompe : on cherche la lumiere, le defaut est
  // dans l'ombre.
  soleil.shadow.camera.updateProjectionMatrix();
  soleil.shadow.bias = -0.0004;
  // Le decalage le long de la normale, plutot que le long du rayon : sur des
  // membres cylindriques il supprime l'acne d'ombre sans decoller l'ombre du
  // pied, ce que `bias` seul ne sait pas faire.
  soleil.shadow.normalBias = 0.045;
  scene.add(soleil);
  scene.add(soleil.target);

  if (th.nuit) {
    // Les rampes du stade de nuit : elles eclairent VRAIMENT la piste ici. En
    // 2D il avait fallu peindre a la main les nappes qu'elles auraient dues
    // projeter ; une source reelle les dessine elle-meme, et elles bougent
    // avec la camera sans qu'on ait rien a recalculer.
    for (let i = 0; i < 6; i++) {
      const s = -10 + i * 24;
      const p = posR(T, s, stade.rOut + 16);
      const l = new THREE.SpotLight(0xfff4e0, 900, 90, Math.PI / 5.2, 0.55, 1.6);
      l.position.set(p[0], p[1], 26);
      const c = posR(T, s, stade.rIn + 4);
      l.target.position.set(c[0], c[1], 0);
      l.castShadow = i === 2;
      if (l.castShadow) { l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.001; }
      scene.add(l); scene.add(l.target);
      lampes.push(l);
      // Le luminaire lui-meme, pour que la lumiere ait une origine visible.
      const boite = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.5, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xf6f2e6, emissive: 0xfff2d8, emissiveIntensity: 2.4 }));
      boite.position.set(p[0], p[1], 26);
      scene.add(boite);
    }
  }

  scene.fog = new THREE.Fog(
    new THREE.Color(th.lointain[0] / 255, th.lointain[1] / 255, th.lointain[2] / 255),
    th.nuit ? 40 : 70, th.nuit ? 240 : 340);

  // Les coureurs : le vrai plateau de l'etape, avec leurs chronos vises.
  mats = new Materiaux(THREE);
  coureurs = []; athletes = [];
  const noms = ['Ivan Blitz', 'Erik Rocket', 'Otto Rush', 'Freya Comet',
                'Sven Dash', 'Nils Storm', 'Lars Zoom'];
  joueur = new Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed, best: R.best, total: T.total });
  coureurs.push(joueur);
  noms.forEach((n, i) => {
    const lane = i < 3 ? i : i + 1;
    coureurs.push(new Runner(n, lane, {
      target: 9.62 + K.alea() * 0.5, maxSpeed: R.maxSpeed, total: T.total, pool: 'sprint' }));
  });
  for (const r of coureurs) {
    const a = new Athlete3D(THREE, r, mats);
    scene.add(a.groupe);
    athletes.push(a);
  }
  etat = 'compte'; compte = 3; elapsed = 0; acc = 0;
  document.getElementById('lieu').textContent = th.nom;
}

/* ------------------------------------------------------------ commandes -- */
const touches = { ArrowLeft: 'L', ArrowRight: 'R', a: 'L', e: 'R' };
addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const k = touches[ev.key];
  if (k && etat === 'course') { joueur.press(k, elapsed); ev.preventDefault(); return; }
  if (ev.key === '1' || ev.key === '2' || ev.key === '3') vue = +ev.key - 1;
  if (ev.key.toLowerCase() === 'n') monterCourse(themeCle === 'jour' ? 'nuit' : 'jour');
  if (ev.key.toLowerCase() === 'r') monterCourse(themeCle);
});

/* --------------------------------------------------------------- camera -- */
let vue = 0;
const camPos = new THREE.Vector3(), camCib = new THREE.Vector3();
const VUES = ['poursuite', 'travelling', 'arrivee'];

function placerCamera(dt) {
  const p = T.pos(joueur.d, joueur.lane);
  const h = T.heading(joueur.d, joueur.lane);
  const fx = Math.cos(h), fy = Math.sin(h);
  let px, py, pz, tx, ty, tz;
  if (vue === 0) {
    // La camera de television : derriere l'epaule, un peu au-dessus, et qui
    // regarde devant le coureur plutot que lui. C'est le plan que la
    // projection isometrique ne peut pas donner — celui ou la piste FUIT.
    const recul = 6.2 + Math.min(2.4, joueur.v * 0.22);
    px = p[0] - fx * recul - fy * 1.1;
    py = p[1] - fy * recul + fx * 1.1;
    pz = 2.15 + Math.min(0.5, joueur.v * 0.03);
    tx = p[0] + fx * 6; ty = p[1] + fy * 6; tz = 1.15;
  } else if (vue === 1) {
    // Le travelling lateral, depuis le bord de piste, comme un rail.
    px = p[0] + fx * 2.0 - fy * 13;
    py = p[1] + fy * 2.0 + fx * 13;
    pz = 2.0;
    tx = p[0]; ty = p[1]; tz = 1.0;
  } else {
    // La camera d'arrivee, basse, dans l'axe, posee derriere la ligne.
    const a = posR(T, T.total + 11, (stade.rIn + stade.rOut) / 2);
    px = a[0]; py = a[1]; pz = 1.25;
    tx = p[0]; ty = p[1]; tz = 1.0;
  }
  // Un glissement doux tant qu'on suit la course ; un SAUT des que la cible
  // est ailleurs. Sans cela, changer de vue ou relancer la course fait
  // traverser le stade a la camera en glissant, et on regarde le voyage au
  // lieu de regarder le depart.
  const cible = new THREE.Vector3(px, py, pz);
  if (camPos.distanceTo(cible) > 22) { camPos.copy(cible); camCib.set(tx, ty, tz); }
  const k = 1 - Math.exp(-(vue === 0 ? 7 : 4) * dt);
  camPos.lerp(cible, k);
  camCib.lerp(new THREE.Vector3(tx, ty, tz), k);
  camera.position.copy(camPos);
  camera.lookAt(camCib);
  // La boite d'ombre suit le joueur, pas la camera : c'est lui qui doit avoir
  // des ombres nettes.
  soleil.position.set(p[0] - 26, p[1] - 34, 44);
  soleil.target.position.set(p[0], p[1], 0);
  soleil.target.updateMatrixWorld();
}

/* ----------------------------------------------------------------- HUD --- */
function majHud() {
  const cl = coureurs.slice().sort((a, b) => b.d - a.d);
  document.getElementById('chrono').textContent =
    etat === 'compte' ? Math.ceil(compte).toFixed(0) : elapsed.toFixed(2);
  document.getElementById('vitesse').textContent = (joueur.v * 3.6).toFixed(1) + ' km/h';
  document.getElementById('rang').textContent =
    (cl.indexOf(joueur) + 1) + '/' + coureurs.length;
  document.getElementById('dist').textContent = joueur.d.toFixed(1) + ' m';
  document.getElementById('vue').textContent = VUES[vue];
}

/* ---------------------------------------------------------------- boucle -- */
function redimensionner() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);

let dernier = performance.now();
function image(now) {
  const dt = Math.min(0.05, (now - dernier) / 1000 || 0.016);
  dernier = now;

  if (capture) {
    // Ni physique ni dessin : le harnais mene les deux, une image a la fois.
    requestAnimationFrame(image);
    return;
  }
  if (etat === 'compte') {
    compte -= dt;
    if (compte <= 0) { etat = 'course'; elapsed = 0; }
  } else if (etat === 'course') {
    // Le meme pas fixe que le jeu : 240 Hz. La physique d'un sprint se joue au
    // centieme, et un pas variable rendrait les chronos incomparables avec
    // ceux du jeu 2D — ce qui retirerait tout son sens a la comparaison.
    acc += dt;
    const pas = 1 / 240;
    while (acc >= pas) {
      acc -= pas; elapsed += pas;
      joueur.stepPlayer(pas, elapsed);
      for (const r of coureurs) if (!r.isPlayer) r.stepAI(pas, elapsed);
    }
    if (joueur.finished && joueur.d > T.total + 22) etat = 'fini';
  }

  dessiner(dt);
  requestAnimationFrame(image);
}

/**
 * Une image : poser les squelettes, placer la camera, rendre.
 *
 * Elle est sortie de la boucle pour que le harnais de capture puisse
 * l'appeler lui-meme, une fois par image filmee. Sans cela il fallait rendre
 * la main au navigateur et attendre deux rafraichissements pour etre sur
 * qu'une image avait ete calculee — soit le double du travail pour le meme
 * resultat, et sur un rasteriseur logiciel le double de trois secondes.
 */
function dessiner(dt) {
  for (let i = 0; i < coureurs.length; i++) {
    const r = coureurs[i], a = athletes[i];
    const p = T.pos(r.d, r.lane);
    a.groupe.position.set(p[0], p[1], 0);
    a.groupe.rotation.z = T.heading(r.d, r.lane);
    a.poser(T.lean(r.d, r.lane, r.v));
  }
  placerCamera(dt);
  majHud();
  renderer.render(scene, camera);
}

redimensionner();
monterCourse('jour');
requestAnimationFrame(image);

// De quoi piloter la page depuis un harnais de capture, sans passer par le
// clavier : la maquette doit pouvoir etre photographiee sans qu'on joue.
globalThis.Sprinter3D = {
  get etat() { return etat; },
  set etat(v) { etat = v; },
  get joueur() { return joueur; },
  get coureurs() { return coureurs; },
  vue: (n) => { vue = n; },
  get capture() { return capture; },
  set capture(v) { capture = !!v; },
  get compte() { return compte; },
  set compte(v) { compte = v; },
  get chrono() { return elapsed; },
  /**
   * Un pas de film : on avance la course de `dt`, puis on dessine UNE image.
   * Tout est synchrone, donc une image rendue vaut exactement un pas de temps
   * choisi — c'est ce qui permet de filmer a vitesse reelle une maquette qui
   * met une seconde et demie a calculer chaque image.
   */
  pas: (dt, cadence) => {
    if (etat === 'compte') compte -= dt;
    else if (etat === 'course') globalThis.Sprinter3D.simuler(dt, cadence);
    dessiner(dt);
    return { d: joueur.d, t: elapsed, compte };
  },
  /**
   * Le mode leger, pour filmer sur un rasteriseur logiciel.
   *
   * Sans carte graphique, le cout d'une image est domine par deux choses : le
   * filtrage anisotrope de la piste — jusqu'a seize echantillons de texture par
   * pixel, sur une surface qui remplit l'ecran — et la carte d'ombre. Les deux
   * se baissent sans toucher a la geometrie ni a la lumiere, donc sans changer
   * ce que la maquette DEMONTRE. Sur une vraie carte, rien de tout cela ne se
   * pose : on laisse le reglage plein par defaut.
   */
  leger: (on) => {
    scene.traverse((n) => {
      if (n.material && n.material.map) {
        n.material.map.anisotropy = on ? 2 : 16;
        n.material.map.needsUpdate = true;
      }
    });
    if (soleil) {
      soleil.shadow.mapSize.set(on ? 1024 : 2048, on ? 1024 : 2048);
      if (soleil.shadow.map) { soleil.shadow.map.dispose(); soleil.shadow.map = null; }
    }
    // Et surtout : on ne dessine qu'une partie du public. `count` sur un
    // maillage instancie coupe le nombre d'exemplaires sans rien reconstruire,
    // et c'est LA depense qui compte sans carte graphique.
    if (stade && stade.foules) {
      for (const f of stade.foules) {
        if (f.__plein == null) f.__plein = f.count;
        f.count = on ? Math.round(f.__plein * 0.28) : f.__plein;
      }
    }
  },
  stade: (cle) => monterCourse(cle),
  avancer: (d, v) => { for (const r of coureurs) { r.d = d + (r.isPlayer ? 0 : (K.alea() - 0.5) * 6); r.v = v; r.stride += 0.7; } },
  /**
   * Faire courir la physique SANS attendre l'affichage.
   *
   * La boucle d'image avance la simulation du temps ecoule depuis l'image
   * precedente, plafonne a cinquante millisecondes — c'est la bonne regle pour
   * jouer, et c'est une impasse pour photographier : sur un rendu logiciel a
   * deux images par seconde, dix secondes de capture ne font avancer la course
   * que d'un metre. On appelle donc le moteur directement, au meme pas de
   * 240 Hz et avec des appuis alternes a une cadence donnee. La foulee obtenue
   * est une vraie foulee, pas une pose figee au hasard dans un cycle.
   */
  simuler: (duree, cadence) => {
    const pas = 1 / 240;
    const inter = 1 / (cadence || 10);
    // L'ALTERNANCE SURVIT ENTRE DEUX APPELS, et c'est tout le sujet. Gardee
    // locale, elle repartait du meme pied a chaque appel : le moteur voyait
    // donc toujours la meme touche, ce qui est precisement ce qu'il punit
    // d'un faux pas. Le coureur trebuchait en boucle et avancait de cinq
    // metres en vingt secondes de simulation.
    if (etat !== 'course') { etat = 'course'; elapsed = 0; simCote = 0; simProchain = 0; }
    for (let t = 0; t < duree; t += pas) {
      if (elapsed >= simProchain) {
        joueur.press(simCote ? 'L' : 'R', elapsed);
        // Un peu de flottement : un pouce n'est pas un metronome, et une
        // cadence parfaitement reguliere donne une foulee de machine.
        simCote ^= 1; simProchain = elapsed + inter * (0.86 + Math.random() * 0.28);
      }
      elapsed += pas;
      joueur.stepPlayer(pas, elapsed);
      for (const r of coureurs) if (!r.isPlayer) r.stepAI(pas, elapsed);
    }
    return { d: joueur.d, v: joueur.v, t: elapsed };
  },
};
