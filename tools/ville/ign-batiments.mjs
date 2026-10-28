// LES VRAIS BATIMENTS DE VAL-DE-REUIL, D'APRES L'IGN (BD TOPO).
//
// L'auteur, 26/10 : « la ville n'est pas reconnaissable ». Les batiments viennent
// d'OpenStreetMap, ou presque aucun n'a sa hauteur : le script en devinait une par
// type (6 m pour un batiment sans type) — une ville de boites pareilles. La BD TOPO
// de l'IGN (licence ouverte Etalab 2.0) donne pour chaque batiment sa hauteur mesuree,
// ses etages, son usage, son annee et la matiere de ses murs et de son toit.
//
// On garde les contours OSM (alignes et redresses sur nos rues) et on leur donne ce
// que dit l'IGN du batiment qui contient leur centre ; les batiments IGN absents d'OSM
// sont ajoutes. On ne l'execute qu'a la main, apres osm-val-de-reuil.mjs :
//
//   node tools/ville/ign-batiments.mjs
//
// Source : IGN, BD TOPO (data.geopf.fr), licence ouverte — mention dans la ville.

import { readFileSync, writeFileSync } from 'fs';

const F = 'public/athlete/val-de-reuil.json';
const d = JSON.parse(readFileSync(F, 'utf8'));
const [LAT0, LON0] = d.origine, BBOX = d.bbox;
const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
const m = (lat, lon) => [Math.round((lon - LON0) * KX * 10) / 10, Math.round(-(lat - LAT0) * KZ * 10) / 10];

// toutes les pages du WFS (1 000 objets par page)
const ign = [];
for (let depart = 0; ; depart += 1000) {
  const u = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment'
    + `&COUNT=1000&STARTINDEX=${depart}&OUTPUTFORMAT=application/json&BBOX=${BBOX[0]},${BBOX[1]},${BBOX[2]},${BBOX[3]},urn:ogc:def:crs:EPSG::4326`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`WFS ${r.status}`);
  const j = await r.json();
  for (const f of j.features) {
    const g = f.geometry; if (!g) continue;
    const anneau = (g.type === 'MultiPolygon' ? g.coordinates[0][0] : g.coordinates[0]);
    // GeoJSON : [lon, lat] (le WFS rend l'ordre GeoJSON meme demande en EPSG:4326)
    const p = anneau.map(([lon, lat]) => m(lat, lon));
    ign.push({ p, pr: f.properties });
  }
  if (j.features.length < 1000) break;
}
console.log('IGN', ign.length, 'batiments');

const dedans = (p, x, z) => {
  let v = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[i], [bx, bz] = p[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) v = !v;
  }
  return v;
};
const centre = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
/** Ce qu'on garde de l'IGN, en clair et compact. */
const fiche = pr => {
  const o = {};
  if (pr.hauteur > 0) o.h = Math.round(pr.hauteur * 10) / 10;
  if (pr.nombre_d_etages > 0) o.e = pr.nombre_d_etages;
  if (pr.usage_1) o.u = pr.usage_1;
  if (pr.materiaux_des_murs) o.mm = pr.materiaux_des_murs;
  if (pr.materiaux_de_la_toiture) o.mt = pr.materiaux_de_la_toiture;
  const an = pr.date_d_apparition && parseInt(pr.date_d_apparition, 10); if (an) o.an = an;
  if (pr.nature && pr.nature !== 'Indifférenciée') o.na = pr.nature;
  return o;
};

const utilises = new Set();
let apparies = 0;
for (const b of d.batiments) {
  const [cx, cz] = centre(b.p);
  const k = ign.findIndex(x => dedans(x.p, cx, cz));
  if (k < 0) continue;
  utilises.add(k); apparies++;
  Object.assign(b, fiche(ign[k].pr));
}
// les batiments IGN qu'OSM n'a pas
let ajoutes = 0;
ign.forEach((x, k) => {
  if (utilises.has(k)) return;
  const [cx, cz] = centre(x.p);
  if (d.batiments.some(b => dedans(b.p, cx, cz))) return;
  const f = fiche(x.pr); if (!f.h) return;
  d.batiments.push({ p: x.p.slice(0, -1), t: 'ign', ...f }); ajoutes++;
});
d.sources = { ...(d.sources || {}), batiments: 'OSM (contours) + IGN BD TOPO (hauteurs, etages, usages, materiaux), licence ouverte' };
writeFileSync(F, JSON.stringify(d));
const h = d.batiments.map(b => b.h).sort((a, b) => a - b);
console.log({ osm: d.batiments.length - ajoutes, apparies, ajoutes, hauteurMediane: h[h.length >> 1], max: h[h.length - 1] });
