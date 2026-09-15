/** Les repères posés par la caméra, lus par nom. */
import { readFileSync } from 'node:fs';
export function marques(rush) {
  const m = JSON.parse(readFileSync(`${rush}/marques.json`, 'utf8'));
  const t = Object.fromEntries(m.marques.map(x => [x.nom, x.t]));
  return { ...t, _duree: m.duree, _ips: m.ips };
}
/** Le montage, plan par plan : bornes de chaque plan dans le film fini.
 *  Un plan ralenti ou fige (`vitesse`, `duree` — voir plans.py) dure dans le
 *  film autre chose que ce qu'il prend au rush. */
export function bornes(plans) {
  let t = 0;
  return plans.map(p => {
    const d = p.duree ?? (p.a - p.de) / (p.vitesse ?? 1);
    const b = { de: t, a: t + d }; t = b.a; return b;
  });
}
