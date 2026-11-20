// LA COURSE EN VRAIE 3D — les reglages d'URL de la course 3D et les mesures de la piste (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { EST_TEST } from '../canal';

// TOUTE TEXTURE FILTREE AU MIEUX DE L'APPAREIL (24/10, pas de crenelage) : sans cela, celles des
// modeles charges (coureurs, pieces des stades) scintillaient vues de biais ; three ramene 16 au maximum
THREE.Texture.DEFAULT_ANISOTROPY = 16;

export const Q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
// LA SALLE NOIRE, SECRETE JUSQU'AU 19/12 (l'auteur, 8/11) : ?serie=1 / ?finale=1 ne valent que si le serveur dit
// que la premiere serie du Championnat de France en salle a commence (route /salle-noire). Hors ligne : fermee.
// Le canal de test (/test/, /test3d/, derriere la porte a code) l'a toujours (l'auteur, 8/11).
const NOIR_DEMANDE: 'serie' | 'noir' | null = Q.get('finale') === '1' ? 'noir' : Q.get('serie') === '1' ? 'serie' : null;
let noirOuvert = EST_TEST;
if (NOIR_DEMANDE && !EST_TEST) {
  fetch('https://sprinter-leaderboard.benbezi-sprinter.workers.dev/salle-noire')
    .then(r => r.json()).then(j => { noirOuvert = j?.ouvert === true; }).catch(() => {});
}
/** Le tour de la competition dans le noir : celui du vrai championnat (champ-direct.ts, G.champNoir), sinon le
 *  prototype ouvert par le serveur. L'echauffement d'une serie garde la salle allumee : elle s'eteint pour la course. */
export function tourDuChamp(): 'serie' | 'noir' | null {
  const G = (globalThis as any).SprinterApp?.G;
  if (G?.champNoir === 'noir') return 'noir';
  if (G?.champNoir === 'serie') return G.champDirect ? 'serie' : null;
  return noirOuvert ? NOIR_DEMANDE : null;
}
const nombre = (k: string, d: number) => { const v = parseFloat(Q.get(k) || ''); return Number.isFinite(v) ? v : d; };
export const DOS = Q.get('cam') === 'dos';
export const HAUT = nombre('haut', DOS ? 2.5 : 5.5);
export const RECUL = nombre('recul', DOS ? 5.5 : 8.5);
export const COTE = nombre('cote', DOS ? 0 : 2.4);
// Le profil (voir la camera, dans rendre) : ou il commence et s'acheve (en part de la
// course), sa hauteur et sa part d'arriere en portrait. A regler sur le telephone :
// ?pdebut=0.08 ?pfin=0.92 ?phaut=6 ?parriere=0.15 ?ploin=1.2
export const P_DEBUT = nombre('pdebut', 0.08), P_FIN = Math.max(P_DEBUT + 0.05, nombre('pfin', 0.92));
// ?ploin : la distance du profil — 1,2 retenu par l'auteur sur son telephone (22/10)
export const P_LOIN = Math.max(0.4, nombre('ploin', 1.2));
export const P_HAUT = nombre('phaut', 6), P_ARRIERE = Math.min(0.9, Math.max(0, nombre('parriere', 0.15)));
export const OMBRES = Q.get('ombres') !== '0';
export const STADE_FORCE = Q.get('stade');
// ?vue=survol : une vue aerienne fixe du stade entier, pour verifier le decor (rien ne s'y chevauche)
export const SURVOL = Q.get('vue') === 'survol';

export const MAX_TRONCS = 1400;
export const LANE_W = 1.22;
// les segments d'un demi-tour de piste (anneaux, lignes, bandes du virage)
export const VIRAGE_SEG = 192;

export const PUBLIC = Math.max(0, Math.min(1, nombre('public', 1)));
export const R_CORDE = 36.5;                     // rayon de la corde dans les virages (m)
export const DROITE0_100 = -12, DROITE1 = 100;       // la ligne droite, de la sortie du virage a l'arrivee
