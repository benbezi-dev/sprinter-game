// REDRESSER LA VILLE — des murs droits et des angles droits.
//
// L'auteur, 25/10 : « les lignes ne sont pas droites, les immeubles non plus ».
// Les contours d'OpenStreetMap sont releves a la main : des sommets en trop,
// des murs qui zigzaguent d'un demi-metre, des angles a 87 ou 93 degres. On
// les simplifie (Douglas-Peucker), puis on aligne chaque batiment sur son axe
// principal : un mur a moins de 15 degres d'un angle droit devient droit, et
// deux murs consecutifs se recoupent exactement. Les rues sont simplifiees de
// la meme facon. Un batiment que le redressage abime (aire qui change de plus
// de 20 %, contour qui se croise) garde son contour simplifie.
//
//   node tools/ville/redresser.mjs        (appele aussi par osm-val-de-reuil.mjs)

import { readFileSync, writeFileSync } from 'fs';

const F = 'public/athlete/val-de-reuil.json';

/** Douglas-Peucker sur une ligne ouverte. */
export function simplifier(l, tol) {
  if (l.length < 3) return l;
  const garde = new Uint8Array(l.length); garde[0] = garde[l.length - 1] = 1;
  const pile = [[0, l.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop();
    const [ax, az] = l[a], [bx, bz] = l[b], dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz) || 1e-9;
    let im = -1, dm = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((l[i][0] - ax) * dz - (l[i][1] - az) * dx) / n;
      if (d > dm) { dm = d; im = i; }
    }
    if (im >= 0) { garde[im] = 1; pile.push([a, im], [im, b]); }
  }
  return l.filter((_, i) => garde[i]);
}

/** Douglas-Peucker sur un anneau : coupe au point le plus eloigne du premier, deux moitiees. */
export function simplifierAnneau(p, tol) {
  if (p.length < 4) return p;
  let k = 1, dm = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > dm) { dm = d; k = i; } }
  const a = simplifier(p.slice(0, k + 1), tol), b = simplifier([...p.slice(k), p[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

const aire = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; };

function seCroise(p) {
  const n = p.length;
  const coupe = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (coupe(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
  }
  return false;
}

/** Un contour ferme (sans repeter le premier point) aligne sur son axe principal. */
export function equerre(p0) {
  // simplifier le contour ferme : on l'ouvre au premier point
  let p = simplifierAnneau(p0, 0.45);
  if (p.length < 3) return p0;
  // l'axe principal : la moyenne des directions des murs, modulo 90 degres, ponderee par la longueur
  let c = 0, s = 0;
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], l = Math.hypot(bx - ax, bz - az);
    const a = Math.atan2(bz - az, bx - ax);
    c += Math.cos(4 * a) * l; s += Math.sin(4 * a) * l;
  }
  const axe = Math.atan2(s, c) / 4;
  // chaque mur : sa direction redressee si elle est proche d'un angle droit
  const murs = [];
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
    let a = Math.atan2(bz - az, bx - ax);
    const k = Math.round((a - axe) / (Math.PI / 2)), snap = axe + k * Math.PI / 2;
    if (Math.abs(a - snap) < 15 * Math.PI / 180) a = snap;
    const prec = murs[murs.length - 1];
    const m = { x: (ax + bx) / 2, z: (az + bz) / 2, a, l: Math.hypot(bx - ax, bz - az) };
    // deux murs dans le meme alignement n'en font qu'un
    if (prec && Math.abs(Math.sin(prec.a - a)) < 1e-6) { const t = prec.l + m.l; prec.x = (prec.x * prec.l + m.x * m.l) / t; prec.z = (prec.z * prec.l + m.z * m.l) / t; prec.l = t; continue; }
    murs.push(m);
  }
  if (murs.length > 2 && Math.abs(Math.sin(murs[0].a - murs[murs.length - 1].a)) < 1e-6) {
    const a = murs.pop(), b = murs[0], t = a.l + b.l;
    b.x = (a.x * a.l + b.x * b.l) / t; b.z = (a.z * a.l + b.z * b.l) / t; b.l = t;
  }
  if (murs.length < 3) return p;
  // les coins : l'intersection de deux murs consecutifs
  const q = [];
  for (let i = 0; i < murs.length; i++) {
    const m1 = murs[(i - 1 + murs.length) % murs.length], m2 = murs[i];
    const d1 = [Math.cos(m1.a), Math.sin(m1.a)], d2 = [Math.cos(m2.a), Math.sin(m2.a)];
    const det = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(det) < 1e-6) continue;
    const t = ((m2.x - m1.x) * d2[1] - (m2.z - m1.z) * d2[0]) / det;
    q.push([Math.round((m1.x + d1[0] * t) * 10) / 10, Math.round((m1.z + d1[1] * t) * 10) / 10]);
  }
  if (q.length < 3 || seCroise(q)) return p;
  const r = Math.abs(aire(q)) / (Math.abs(aire(p)) || 1);
  return r > 0.8 && r < 1.2 ? q : p;
}

export function redresser(d) {
  let redresses = 0;
  for (const b of d.batiments) {
    const q = equerre(b.p);
    if (q !== b.p) redresses++;
    b.p = q.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
  }
  let avant = 0, apres = 0;
  for (const r of d.routes) { avant += r.l.length; r.l = simplifier(r.l, r.w > 4 ? 0.7 : 0.4); apres += r.l.length; }
  for (const r of d.rails) r.l = simplifier(r.l, 0.5);
  for (const v of d.vert) v.p = simplifierAnneau(v.p, 0.5);
  return { redresses, total: d.batiments.length, sommetsRoutes: `${avant} -> ${apres}` };
}

if (process.argv[1] && process.argv[1].endsWith('redresser.mjs')) {
  const d = JSON.parse(readFileSync(F, 'utf8'));
  const r = redresser(d);
  writeFileSync(F, JSON.stringify(d));
  console.log(F, r);
}
