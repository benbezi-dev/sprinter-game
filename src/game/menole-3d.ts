// LA PLAGE DE MENOLE EN 3D — premiere etape de la Carriere Legende (23/10/2026).
//
// « Il ne faut pas que Menole ressemble au stade de la plage, Menole doit etre a part »
// (l'auteur). La Plage Paradis (plage-3d.ts) est une carte postale : lagon turquoise,
// yachts, transats, parasols. Menole est l'inverse : une plage de pecheurs a San-Pedro,
// la ou la Legende commence. L'Atlantique, vert-bleu et lourd, dont les rouleaux
// viennent mourir sur le sable ; du sable ocre ; des pirogues peintes aux couleurs du
// pays tirees au sec ; des filets qui sechent ; des paillotes ; des cocotiers penches
// vers la mer ; au loin, le port et ses cargos. Le public est debout dans le sable,
// derriere une corde ; des enfants jouent au ballon entre les pirogues.
//
// Meme repere que plage-3d.ts : x le long de la ligne droite, y vers la mer (le rivage
// au-dela de la piste), z en haut. La camera de profil regarde de ce cote.

import * as THREE from 'three';

export type ContexteMenole = {
  stade: THREE.Group;
  W: number; D0: number; D1: number;
  hasard: () => number;
  /** Une carte du public : x, y, z, geste (1 applaudit, 2 bras leves, 3 calme), cap. */
  spectateur: (x: number, y: number, z: number, geste: number, face: number) => void;
  /** La nuit : la lune sur la mer, les feux de la plage, les lanternes. */
  nuit?: boolean;
};

/** Le rivage : au-dela de la piste, apres une bande de sable ou se tient le public. */
export const RIVAGE_MENOLE = (W: number) => W + 34;

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

/** Le sable de Menole : ocre, ride par le vent, seme d'algues et de coquillages. */
function sable(hasard: () => number) {
  const t = toile((c, w, h) => {
    c.fillStyle = '#c99a5e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 0.85 + hasard() * 0.3;
      c.fillStyle = `rgba(${(201 * v) | 0},${(154 * v) | 0},${(94 * v) | 0},0.5)`;
      c.fillRect(hasard() * w, hasard() * h, 2 + hasard() * 3, 1 + hasard() * 2);
    }
    // les rides du vent
    c.strokeStyle = 'rgba(150,108,60,0.22)'; c.lineWidth = 1.2;
    for (let y = 4; y < h; y += 7 + hasard() * 4) {
      c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5);
      c.stroke();
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(60,70,40,0.5)'; c.fillRect(hasard() * w, hasard() * h, 4 + hasard() * 6, 1); }
  }, 256, 256);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function construireMenole(o: ContexteMenole): (t: number) => void {
  const { stade, W, D0, D1, hasard } = o;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const yE = RIVAGE_MENOLE(W), xc = (D0 + D1) / 2, S = D1 - D0;
  const plat = (w: number, l: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.position.set(x, y, z); m.receiveShadow = true; return ajoute(m);
  };

  // --- LE SABLE, partout ; la piste se fond dedans -------------------------------------
  const tSable = sable(hasard); tSable.repeat.set(160, 120);
  plat(1800, 1400, new THREE.MeshLambertMaterial({ map: tSable }), xc, yE - 700, -0.12);
  // le sable que le vent pousse sur les bords de la piste
  const depot = new THREE.MeshLambertMaterial({ color: c3(196, 150, 92), transparent: true, opacity: 0.75 });
  for (let i = 0; i < 260; i++) {
    const x = D0 - 20 + hasard() * (S + 60), y = hasard() < 0.5 ? -0.6 - hasard() * 1.5 : W + 0.2 + hasard() * 1.6;
    const m = plat(1, 1, depot, x, y, 0.008); m.scale.set(0.6 + hasard() * 2.4, 0.15 + hasard() * 0.5, 1); m.rotation.z = (hasard() - 0.5) * 0.3;
  }

  // --- L'ATLANTIQUE : lourd, vert-bleu, ses rouleaux qui avancent ----------------------
  const cles: [number, THREE.Color][] = [[0, c3(92, 150, 140)], [0.05, c3(38, 110, 118)], [0.2, c3(22, 82, 102)], [0.5, c3(14, 56, 84)], [1, c3(10, 38, 62)]];
  const mer = (u: number) => {
    for (let k = 0; k < cles.length - 1; k++)
      if (u <= cles[k + 1][0]) return cles[k][1].clone().lerp(cles[k + 1][1], (u - cles[k][0]) / (cles[k + 1][0] - cles[k][0]));
    return cles[cles.length - 1][1].clone();
  };
  for (let i = 0; i < 20; i++) {
    const u0 = i / 20, u1 = (i + 1) / 20, ya = yE + 1200 * u0 * u0, yb = yE + 1200 * u1 * u1;
    plat(2600, yb - ya + 0.2, new THREE.MeshStandardMaterial({ color: mer((u0 + u1) / 2), roughness: 0.35, metalness: 0.05 }), xc, (ya + yb) / 2, -0.2);
  }
  // le sable mouille, plus sombre, que la vague vient de quitter
  plat(2600, 6, new THREE.MeshStandardMaterial({ color: c3(150, 112, 70), roughness: 0.25 }), xc, yE - 2.5, -0.07);
  // LES ROULEAUX : une crete d'ecume qui avance vers le sable, enfle, deferle et s'etale
  const tEcume = toile((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(240,248,250,0.95)'); g.addColorStop(0.6, 'rgba(230,242,245,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(Math.random() * w, h * (0.3 + Math.random() * 0.4), 3, 2); }
  }, 256, 32);
  tEcume.wrapS = THREE.RepeatWrapping; tEcume.repeat.set(30, 1);
  const rouleaux = [0, 1, 2, 3].map((k) => {
    const m = plat(2600, 3, new THREE.MeshBasicMaterial({ map: tEcume, transparent: true, depthWrite: false, opacity: 0 }), xc, yE + 60, -0.05);
    return { m, k };
  });
  const lisiere = plat(2600, 2.4, new THREE.MeshBasicMaterial({ map: tEcume, transparent: true, depthWrite: false, opacity: 0.8 }), xc, yE + 0.4, -0.04);

  // --- AU LOIN, LE PORT DE SAN-PEDRO : des cargos, des grues ---------------------------
  const silhouette = new THREE.MeshLambertMaterial({ color: c3(70, 84, 96) });
  const coqueCargo = new THREE.MeshLambertMaterial({ color: c3(90, 50, 44) });
  for (const [x, y, L] of [[xc - 260, 520, 160], [xc + 180, 640, 210], [xc + 520, 460, 120]]) {
    const c = ajoute(new THREE.Mesh(new THREE.BoxGeometry(L, 18, 12), coqueCargo)); c.position.set(x, yE + y, 4);
    for (let k = 0; k < 6; k++) {
      const b = ajoute(new THREE.Mesh(new THREE.BoxGeometry(L / 9, 14, 8 + hasard() * 6), silhouette));
      b.position.set(x - L / 2 + L * 0.15 + k * L / 8, yE + y, 13);
    }
    const p = ajoute(new THREE.Mesh(new THREE.BoxGeometry(14, 14, 18), silhouette)); p.position.set(x + L * 0.42, yE + y, 19);
  }
  // LES PORTIQUES A CONTENEURS DU QUAI, a droite : quatre pieds en portail, une fleche qui
  // s'avance au-dessus de l'eau, son mat en A et ses haubans, la cabine ; rouges et blancs.
  // (Des poteaux et une barre ne se lisaient pas comme des grues.)
  const rouge = new THREE.MeshLambertMaterial({ color: c3(178, 52, 40) }), blanc = new THREE.MeshLambertMaterial({ color: c3(226, 226, 220) });
  const barre = (m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, e: number) => {
    const g = ajoute(new THREE.Mesh(new THREE.BoxGeometry(e, a.distanceTo(b), e), m));
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return g;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const quai = ajoute(new THREE.Mesh(new THREE.BoxGeometry(520, 60, 6), new THREE.MeshLambertMaterial({ color: c3(120, 120, 116) })));
  quai.position.set(xc + 760, yE + 330, 1);
  for (let k = 0; k < 4; k++) {
    const x = xc + 580 + k * 70, y = yE + 340, h = 42, z0 = 4;
    for (const [dx, dy] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) barre(k % 2 ? blanc : rouge, V(x + dx, y + dy, z0), V(x + dx, y + dy, z0 + h), 2.2);
    for (const dy of [-8, 8]) barre(rouge, V(x - 13, y + dy, z0 + h), V(x + 13, y + dy, z0 + h), 2.4);
    barre(rouge, V(x, y - 40, z0 + h + 3), V(x, y + 75, z0 + h + 3), 3);           // la fleche, vers l'eau
    barre(blanc, V(x - 7, y, z0 + h), V(x, y, z0 + h + 28), 1.8);                    // le mat en A
    barre(blanc, V(x + 7, y, z0 + h), V(x, y, z0 + h + 28), 1.8);
    barre(blanc, V(x, y, z0 + h + 28), V(x, y + 72, z0 + h + 4), 0.6);               // les haubans
    barre(blanc, V(x, y, z0 + h + 28), V(x, y - 38, z0 + h + 4), 0.6);
    const cab = ajoute(new THREE.Mesh(new THREE.BoxGeometry(10, 9, 7), blanc)); cab.position.set(x, y - 6, z0 + h + 8);
  }
  // les conteneurs empiles sur le quai
  const teintes = [c3(40, 90, 150), c3(178, 52, 40), c3(230, 170, 40), c3(60, 120, 70), c3(220, 220, 214)];
  const boite = new THREE.BoxGeometry(12, 2.5, 2.6);
  const piles = new THREE.InstancedMesh(boite, new THREE.MeshLambertMaterial(), 220);
  let n = 0;
  for (let a = 0; a < 11 && n < 220; a++) for (let b = 0; b < 5 && n < 220; b++) for (let c = 0; c < 1 + ((a + b) % 4); c++) {
    piles.setMatrixAt(n, new THREE.Matrix4().makeTranslation(xc + 560 + a * 26, yE + 312 + b * 3, 5.3 + c * 2.6));
    piles.setColorAt(n, teintes[(a * 7 + b * 3 + c) % teintes.length]); n++;
  }
  piles.count = n; ajoute(piles);

  // --- LES PIROGUES, tirees sur le sable, peintes aux couleurs du pays -----------------
  // une coque effilee (un pave dont les bouts se pincent et se relevent), sa bande peinte
  // LE NOM DE LA PIROGUE, en grand sur son flanc : il se lit de la camera de profil (la
  // premiere passe le peignait en lettres de vingt centimetres, sur des pirogues tournees
  // proue vers la mer — on n'en voyait que l'etrave)
  const NOMS = ['DIEU MERCI', 'MENOLÉ', 'LA GRÂCE', 'SAN-PÉDRO', 'ESPOIR', 'BÉNÉDICTION', 'MAMAN', 'PATIENCE'];
  const FONDS = ['#e8742a', '#1f8a4c', '#2a5fa8', '#f2c230', '#c83a2c', '#f4efe2'];
  const flanc = (nom: string, fond: string, miroir: boolean) => {
    const t = toile((c, w, h) => {
      c.fillStyle = fond; c.fillRect(0, 0, w, h);
      ['#f77f00', '#ffffff', '#009e60'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, h * (0.04 + i * 0.05), w, h * 0.05); });
      c.fillStyle = '#20180f'; c.fillRect(0, h * 0.9, w, h * 0.1);
      c.font = `900 ${h * 0.62}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = h * 0.06; c.strokeStyle = fond === '#f4efe2' || fond === '#f2c230' ? '#20180f' : '#f4efe2';
      c.strokeText(nom, w / 2, h * 0.56, w * 0.8);
      c.fillStyle = fond === '#f4efe2' || fond === '#f2c230' ? '#c83a2c' : '#20180f';
      c.fillText(nom, w / 2, h * 0.56, w * 0.8);
    }, 1024, 128);
    // le monde est en miroir (course-3d.ts) : le flanc vu de la camera se lirait a l'envers
    if (miroir) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    return new THREE.MeshLambertMaterial({ map: t });
  };
  const bois = new THREE.MeshLambertMaterial({ color: c3(92, 62, 36) });
  const coque = (L: number) => {
    // un bordé haut (1,1 m) : c'est lui qui porte le nom, et il doit se lire de loin
    const g = new THREE.BoxGeometry(L, 1.05, 1.1, 24, 2, 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = Math.min(1, Math.abs(p.getX(i)) / (L / 2)), pince = 1 - Math.pow(u, 3);
      p.setY(i, p.getY(i) * Math.max(0.08, pince));
      p.setZ(i, p.getZ(i) * (0.7 + 0.3 * pince) + Math.pow(u, 4) * 0.55 + 0.5);
    }
    g.computeVertexNormals();
    return g;
  };
  const pirogue = (x: number, y: number, z: number, L: number, cap: number, k: number) => {
    const nom = NOMS[k % NOMS.length], fond = FONDS[(k * 5) % FONDS.length];
    const p = ajoute(new THREE.Mesh(coque(L), [bois, bois, flanc(nom, fond, false), flanc(nom, fond, true), bois, bois]));
    p.position.set(x, y, z); p.rotation.z = cap; p.castShadow = true;
    return p;
  };
  // une rangee juste derriere la corde, de flanc, devant le public ; d'autres au bord de l'eau
  const pirogues: number[][] = [];
  let k = 0;
  for (let x = D0 - 14; x <= D1 + 30; x += 12 + hasard() * 5) { pirogue(x, W + 5.6, 0, 7.5 + hasard() * 2.5, (hasard() - 0.5) * 0.12, k++); pirogues.push([x, W + 5.6]); }   // derriere les panneaux (W + 1,7), qui en cachaient le flanc
  for (let x = D0 - 20; x <= D1 + 40; x += 10 + hasard() * 8) pirogue(x, yE - 6 - hasard() * 3, 0, 7 + hasard() * 4, (hasard() - 0.5) * 0.5, k++);
  // deux au large, qui rentrent de la peche
  for (const [x, y] of [[xc - 30, yE + 70], [xc + 90, yE + 130]]) pirogue(x, y, -0.3, 9, 0.2, k++);

  // --- LES FILETS QUI SECHENT, tendus entre des perches --------------------------------
  const tFilet = toile((c, w, h) => {
    c.strokeStyle = 'rgba(40,70,60,0.9)'; c.lineWidth = 1;
    for (let i = 0; i <= w; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
    for (let j = 0; j <= h; j += 6) { c.beginPath(); c.moveTo(0, j); c.lineTo(w, j); c.stroke(); }
  }, 128, 64);
  tFilet.wrapS = tFilet.wrapT = THREE.RepeatWrapping; tFilet.repeat.set(4, 2);
  const matFilet = new THREE.MeshBasicMaterial({ map: tFilet, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const x = D0 + 6 + k * 30 + hasard() * 8, y = yE - 18 - hasard() * 3;
    for (const dx of [-3, 3]) { const pe = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6).rotateX(Math.PI / 2), bois)); pe.position.set(x + dx, y, 1.2); }
    const f = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), matFilet)); f.position.set(x, y, 1.45); f.rotation.x = Math.PI / 2;
  }

  // --- LES PAILLOTES : des poteaux, un toit de palmes en cone ---------------------------
  const paille = new THREE.MeshLambertMaterial({ color: c3(168, 130, 72) });
  const PAILLOTES = [[D1 + 18, yE - 22], [D1 + 34, yE - 15], [D0 - 22, yE - 20], [xc - 8, yE - 24]];
  for (const [x, y] of PAILLOTES) {
    for (const [dx, dy] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      const p = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6).rotateX(Math.PI / 2), bois)); p.position.set(x + dx, y + dy, 1.2);
    }
    const toit = ajoute(new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.8, 10).rotateX(Math.PI / 2), paille)); toit.position.set(x, y, 3.2); toit.castShadow = true;
  }

  // --- LES COCOTIERS : un stipe qui se courbe vers la mer, une couronne de palmes -------
  const stipe = new THREE.MeshLambertMaterial({ color: c3(110, 84, 58) });
  const palme = new THREE.MeshLambertMaterial({ color: c3(58, 112, 48), side: THREE.DoubleSide });
  const cocotier = (x: number, y: number, h: number, penche: number) => {
    let px = x, py = y, pz = 0;
    for (let k = 0; k < 8; k++) {
      const u = (k + 0.5) / 8, nx = x + 0, ny = y + penche * h * u * u, nz = h * (k + 1) / 8;
      const seg = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1, 7), stipe));
      const a = new THREE.Vector3(px, py, pz), b = new THREE.Vector3(nx, ny, nz);
      seg.position.copy(a).add(b).multiplyScalar(0.5); seg.scale.y = a.distanceTo(b);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      seg.castShadow = true;
      px = nx; py = ny; pz = nz;
    }
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2, f = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), palme));
      f.position.set(px + Math.cos(a) * 1.5, py + Math.sin(a) * 1.5, pz - 0.5);
      f.rotation.set(0, 0, a); f.rotateY(0.55);
      f.castShadow = true;
    }
  };
  // cote mer, entre les pirogues et l'eau (plus pres, ils poussaient au bord de la piste)
  for (let i = 0; i < 9; i++) cocotier(D0 - 30 + hasard() * (S + 80), yE - 4 - hasard() * 3, 8 + hasard() * 4, 0.18 + hasard() * 0.2);
  for (let i = 0; i < 26; i++) cocotier(D0 - 60 + hasard() * (S + 140), -28 - hasard() * 60, 8 + hasard() * 5, -(0.05 + hasard() * 0.2));

  // --- LE DRAPEAU DU PAYS, sur des perches de bambou -----------------------------------
  const tDrapeau = toile((c, w, h) => { ['#f77f00', '#ffffff', '#009e60'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 3, 0, w / 3 + 1, h); }); }, 96, 64);
  const matDrapeau = new THREE.MeshLambertMaterial({ map: tDrapeau, side: THREE.DoubleSide });
  for (const x of [D0 + 2, xc, D1 - 2, D1 + 26]) {
    const m = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 5, 6).rotateX(Math.PI / 2), bois)); m.position.set(x, W + 15, 2.5);
    const d = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), matDrapeau)); d.position.set(x + 0.75, W + 15, 4.4); d.rotation.x = Math.PI / 2;
  }

  // --- LA CORDE, et le public debout derriere ; les enfants entre les pirogues ---------
  for (let x = D0 - 10; x <= D1 + 20; x += 6) {
    const p = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 6).rotateX(Math.PI / 2), bois)); p.position.set(x, W + 2.2, 0.5);
  }
  const corde = ajoute(new THREE.Mesh(new THREE.BoxGeometry(S + 30, 0.025, 0.025), new THREE.MeshLambertMaterial({ color: c3(200, 180, 140) })));
  corde.position.set(xc + 5, W + 2.2, 0.95);
  const face = -Math.PI / 2;
  for (let i = 0; i < 160; i++) {
    const x = D0 - 12 + hasard() * (S + 34), y = W + 7.2 + Math.pow(hasard(), 1.6) * 9;
    const u = hasard(), geste = u < 0.5 ? 3 : u < 0.8 ? 1 : 2;
    o.spectateur(x, y, 0, geste, face + (hasard() - 0.5) * 0.5);
  }
  for (const [x, y] of pirogues) if (hasard() < 0.6) o.spectateur(x + (hasard() - 0.5) * 4, y + 1.1, 0, hasard() < 0.5 ? 2 : 1, face + (hasard() - 0.5));
  const ballon = ajoute(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })));
  ballon.position.set(xc + 20, yE - 12, 0.11);

  // --- LA NUIT : la lune sur l'Atlantique et son chemin d'argent ; sur la plage, ce sont
  // les feux et les lanternes qui eclairent (pas de projecteurs : un village de pecheurs)
  const flammes: { s: THREE.Sprite; l: THREE.PointLight | null; b: number }[] = [];
  if (o.nuit) {
    const halo = (couleur: string) => toile((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, couleur); g.addColorStop(0.3, couleur.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 64, 64);
    const lune = ajoute(new THREE.Sprite(new THREE.SpriteMaterial({ map: halo('rgba(240,244,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    lune.position.set(xc + 120, yE + 700, 150); lune.scale.setScalar(140);
    const argent = new THREE.MeshBasicMaterial({ color: c3(200, 214, 240), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 500; i++) {
      const t = 10 + Math.pow(hasard(), 0.6) * 650, e = (hasard() - 0.5) * (4 + t * 0.06);
      const m = plat(0.8 + t * 0.012, 0.08 + t * 0.001, argent, xc + 120 * t / 700 + e, yE + t, -0.1);
      m.receiveShadow = false;
    }
    const feu = new THREE.SpriteMaterial({ map: halo('rgba(255,150,50,1)'), blending: THREE.AdditiveBlending, depthWrite: false });
    const braise = new THREE.MeshBasicMaterial({ color: c3(255, 120, 40) });
    // les feux de camp sur le sable, entre le public et l'eau
    for (const [x, y, avecLumiere] of [[D0 + 10, yE - 12, 1], [xc + 6, yE - 11, 1], [D1 - 6, yE - 13, 1], [D1 + 26, yE - 9, 0]] as number[][]) {
      for (let b = 0; b < 4; b++) {
        const bu = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), bois)); bu.position.set(x, y, 0.15); bu.rotation.set(Math.PI / 2, 0, b * 0.8); bu.rotateX(0.5);
      }
      ajoute(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), braise)).position.set(x, y, 0.2);
      const sp = ajoute(new THREE.Sprite(feu)); sp.position.set(x, y, 0.9); sp.scale.setScalar(3);
      const l = avecLumiere ? ajoute(new THREE.PointLight(0xff8a3a, 30, 26, 1.6)) : null;
      if (l) l.position.set(x, y, 1.4);
      flammes.push({ s: sp, l, b: hasard() * 6 });
    }
    // une lanterne sous chaque paillote, une sur les pirogues du bord de l'eau
    const lanterne = new THREE.SpriteMaterial({ map: halo('rgba(255,206,120,1)'), blending: THREE.AdditiveBlending, depthWrite: false });
    PAILLOTES.forEach(([x, y], i) => {
      const sp = ajoute(new THREE.Sprite(lanterne)); sp.position.set(x, y, 2.3); sp.scale.setScalar(2.2);
      if (i < 2) { const l = ajoute(new THREE.PointLight(0xffc27a, 14, 16, 1.6)); l.position.set(x, y, 2.2); }
    });
    for (const [x, y] of pirogues) { const sp = ajoute(new THREE.Sprite(lanterne)); sp.position.set(x + 2, y, 1.4); sp.scale.setScalar(1.2); }
  }

  // chaque image : les rouleaux avancent, deferlent et s'etalent, en decale ; les feux vacillent
  return (t: number) => {
    for (const f of flammes) {
      const v = 0.85 + 0.15 * Math.sin(t * 9 + f.b) * Math.sin(t * 5.3 + f.b * 2);
      f.s.scale.setScalar(3 * v);
      if (f.l) f.l.intensity = 30 * v;
    }
    for (const r of rouleaux) {
      const u = ((t / 7 + r.k / 4) % 1);                 // une vague toutes les ~1,75 s
      const y = yE + 70 * (1 - u) * (1 - u) + 0.5;
      r.m.position.y = y;
      r.m.scale.y = 1 + u * 2.5;
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, u * 3) * (u > 0.85 ? (1 - u) / 0.15 : 1) * 0.9;
    }
    (lisiere.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(t * 1.7);
    lisiere.position.y = yE + 0.4 + Math.sin(t * 0.9) * 0.8;
  };
}
