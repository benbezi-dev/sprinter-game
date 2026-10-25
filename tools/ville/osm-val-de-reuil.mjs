// VAL-DE-REUIL, D'APRES OPENSTREETMAP — la ville de la carriere d'athlete.
//
// L'auteur, 25/10 : « re-creer la ville de Val-de-Reuil ». Ce script telecharge
// une fois la zone (Overpass), la convertit en metres autour du centre et
// l'ecrit, compacte, dans public/athlete/val-de-reuil.json, que ville.ts lit.
// On ne l'execute qu'a la main, pour rafraichir la ville :
//
//   node tools/ville/osm-val-de-reuil.mjs
//
// Donnees © contributeurs OpenStreetMap, licence ODbL : la mention est
// affichee dans la ville (ville.ts).

import { writeFileSync } from 'fs';
import { redresser } from './redresser.mjs';

// sud, ouest, nord, est : du stade Bernard Amsalem a la gare
const BBOX = [49.2640, 1.1925, 49.2795, 1.2295];
const LAT0 = (BBOX[0] + BBOX[2]) / 2, LON0 = (BBOX[1] + BBOX[3]) / 2;
const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
/** lat/lon -> metres : x vers l'est, z vers le sud (le repere de ville.ts). */
const m = (lat, lon) => [Math.round((lon - LON0) * KX * 10) / 10, Math.round(-(lat - LAT0) * KZ * 10) / 10];

const b = BBOX.join(',');
const Q = `[out:json][timeout:120];(
  way["building"](${b});
  way["highway"](${b});
  way["railway"~"rail|platform"](${b});
  way["natural"~"water|wood"](${b}); relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green|farmland|retail|commercial"](${b});
  way["leisure"~"park|pitch|track|playground|garden|sports_centre|stadium"](${b});
  relation["leisure"~"park|sports_centre|track"](${b});
  way["amenity"~"parking|school|marketplace"](${b});
  node["natural"="tree"](${b});
);out geom tags;`;

const MIROIRS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let d = null;
for (const u of MIROIRS) {
  try {
    const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(Q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'sprinter-game-dev/1.0 (contact@sprinter-game.com)' } });
    if (r.ok) { d = await r.json(); console.log('Overpass :', u); break; }
    console.log(u, r.status);
  } catch (e) { console.log(u, e.message); }
}
if (!d) { console.error('Aucun miroir Overpass ne repond.'); process.exit(1); }

const ligne = g => g.map(p => m(p.lat, p.lon));
const out = { origine: [LAT0, LON0], bbox: BBOX, batiments: [], routes: [], rails: [], eau: [], vert: [], arbres: [], pistes: [], parkings: [] };
const LARGEURS = { primary: 9, secondary: 8, tertiary: 7, residential: 6, unclassified: 6, living_street: 5, service: 4,
  pedestrian: 5, footway: 2.4, path: 2, cycleway: 2.4, steps: 2, track: 3, primary_link: 6, secondary_link: 6, tertiary_link: 6 };

for (const e of d.elements) {
  const t = e.tags || {};
  if (e.type === 'node') { if (t.natural === 'tree') out.arbres.push(m(e.lat, e.lon)); continue; }
  // Une relation : ses contours exterieurs, ou toutes ses voies (une piste
  // d'athletisme y range son anneau sans role).
  const geoms = e.type === 'way' ? [e.geometry]
    : (e.members || []).filter(x => x.geometry && (x.role === 'outer' || (t.leisure === 'track' && x.role !== 'inner'))).map(x => x.geometry);
  for (const g of geoms) {
    if (!g || g.length < 2) continue;
    const p = ligne(g);
    if (t.building) {
      const niv = parseFloat(t['building:levels']) || 0;
      const h = parseFloat(t.height) || (niv ? niv * 3 + 1 : { apartments: 13, residential: 9, house: 6, detached: 6, school: 8, commercial: 7, retail: 6, industrial: 8, garage: 3, garages: 3, shed: 3 }[t.building] || 6);
      out.batiments.push({ p: p.slice(0, -1), h: Math.round(h * 10) / 10, t: t.building, ...(t.name ? { n: t.name } : {}), ...(t.amenity ? { a: t.amenity } : {}), ...(t['roof:shape'] ? { r: t['roof:shape'] } : {}) });
    } else if (t.highway && LARGEURS[t.highway]) {
      out.routes.push({ l: p, w: LARGEURS[t.highway], t: t.highway, ...(t.name ? { n: t.name } : {}) });
    } else if (t.railway) {
      out.rails.push({ l: p, t: t.railway });
    } else if (t.natural === 'water' || t.waterway === 'riverbank') {
      out.eau.push(p);
    } else if (t.leisure === 'track') {
      out.pistes.push({ p, sport: t.sport || '', ferme: g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon, ...(t.lanes ? { lanes: +t.lanes } : {}) });
    } else if (t.amenity === 'parking') {
      out.parkings.push(p);
    } else {
      const k = t.natural === 'wood' || t.landuse === 'forest' ? 'bois'
        : t.leisure === 'pitch' ? 'terrain' : t.leisure === 'playground' ? 'jeux'
        : t.landuse === 'farmland' ? 'champ' : t.landuse === 'retail' || t.landuse === 'commercial' || t.amenity === 'marketplace' ? 'dalle'
        : t.amenity === 'school' ? 'ecole' : 'herbe';
      out.vert.push({ k, p, ...(t.name ? { n: t.name } : {}) });
    }
  }
}
console.log('redressage', redresser(out));
const f = 'public/athlete/val-de-reuil.json';
writeFileSync(f, JSON.stringify(out));
console.log(f, Object.fromEntries(Object.entries(out).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])));
