// LES CADEAUX — ce que l'auteur offre a un joueur, sans qu'il ait a le gagner.
//
// Un skin et un stade se gagnent en battant une vedette (game/vedettes.ts).
// L'auteur peut aussi les offrir a un joueur qu'il nomme : la liste vit sur le
// serveur (worker/src/cadeaux.js), qui ne la rend qu'a un appareil relie au
// nom reserve — un nom libre se tape par n'importe qui.
//
// CE QUI EST RECU EST RANGE COMME CE QUI EST GAGNE. Le skin entre au vestiaire
// (gagnerSkin), le stade parmi les lieux ouverts (stadeOffert, que lit
// stadeDebloque). Rien ne se reprend : un cadeau recu reste sur l'appareil,
// comme un skin gagne se garde a vie.
//
// DEUX OCCASIONS DE LES RECEVOIR, comme les records en attente
// (game/record-attente.ts) : au lancement, et a chaque changement de nom — le
// moment ou un joueur qui vient de relier son appareil a son nom reserve
// devient celui a qui l'on a offert quelque chose.
//
// IL NE CASSE JAMAIS RIEN. Serveur muet, reseau coupe, stockage ferme : on
// n'a rien recu, et le jeu continue.

import { getDeviceId, getSavedName, NOM_CHANGE } from './leaderboard';
import { gagnerSkin } from './vestiaire';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const CLE_STADES = 'sprinter_stades_offerts';

function stadesOfferts(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_STADES) || '[]');
    return Array.isArray(l) ? l.filter((c: unknown) => typeof c === 'string') : [];
  } catch { return []; }
}

/** Ce stade (sa `cle` dans STADES_HORS_SERIE) a-t-il ete offert sur cet appareil ? */
export function stadeOffert(cle: unknown): boolean {
  return typeof cle === 'string' && stadesOfferts().includes(cle);
}

function offrirStade(cle: string) {
  const l = stadesOfferts();
  if (l.includes(cle)) return;
  try { localStorage.setItem(CLE_STADES, JSON.stringify([...l, cle])); } catch { /* stockage ferme */ }
}

const chaines = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : [];

/** Demander au serveur ce qui est offert au nom porte ici, et le ranger. Ne leve jamais. */
export async function recevoirLesCadeaux(): Promise<void> {
  const nom = getSavedName().trim();
  if (!nom) return;
  try {
    const res = await fetch(`${API_BASE}/cadeaux?name=${encodeURIComponent(nom)}`
      + `&device_id=${encodeURIComponent(getDeviceId())}`);
    if (!res.ok) return;
    const d = await res.json();
    for (const s of chaines(d && d.skins)) gagnerSkin(s);
    for (const s of chaines(d && d.stades)) offrirStade(s);
  } catch { /* rien recu cette fois : la prochaine occasion viendra */ }
}

let branche = false;
export function brancherLesCadeaux() {
  if (branche) return;
  branche = true;
  void recevoirLesCadeaux();
  try {
    window.addEventListener(NOM_CHANGE, () => { void recevoirLesCadeaux(); });
  } catch { /* hors navigateur : le lancement aura suffi */ }
}
