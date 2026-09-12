/** Les repères posés par la caméra, lus par nom. */
import { readFileSync } from 'node:fs';
export function marques(rush) {
  const m = JSON.parse(readFileSync(`${rush}/marques.json`, 'utf8'));
  const t = Object.fromEntries(m.marques.map(x => [x.nom, x.t]));
  return { ...t, _duree: m.duree, _ips: m.ips };
}
/** Le montage, plan par plan : bornes de chaque plan dans le film fini. */
export function bornes(plans) {
  let t = 0;
  return plans.map(p => { const b = { de: t, a: t + (p.a - p.de) }; t = b.a; return b; });
}
