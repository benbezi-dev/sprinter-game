// Le tunnel des premiers pas, cote jeu.
//
// Chaque etape part UNE fois par appareil, la premiere fois qu'il la franchit :
// le serveur ne garde que la premiere de toute facon (voir worker/src/tunnel.js),
// et un appel par course ou par retour a l'accueil serait du bruit pour rien.
// Ce qui est parti est retenu dans le localStorage, et seulement une fois que
// le serveur a repondu : hors ligne, l'etape repartira au prochain lancement
// plutot que de disparaitre.
//
// Le moteur n'a pas a connaitre ce fichier au-dela de deux appels :
// `suivreTunnel(G)` a chaque image, qui lit les changements d'etat, et
// `etapeTunnel('premier_appui')` au premier appui en course.

import { getDeviceId, getSavedName, NOM_CHANGE } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const PARTIES = 'sprinter_tunnel';

export type EtapeTunnel =
  | 'ouverture' | 'accueil' | 'visite' | 'nom'
  | 'depart' | 'premier_appui' | 'arrivee' | 'oneshot'
  | 'carriere_1' | 'carriere_2' | 'carriere_3'
  | 'carriere_4' | 'carriere_5' | 'carriere_6';

let parties: Set<string> | null = null;
/** Envoyees pendant ce lancement, reponse ou pas : on ne les redemande pas. */
const enCours = new Set<string>();

function dejaParties(): Set<string> {
  if (parties) return parties;
  try { parties = new Set(JSON.parse(localStorage.getItem(PARTIES) || '[]')); }
  catch { parties = new Set(); }
  return parties;
}

export function etapeTunnel(etape: EtapeTunnel) {
  const faites = dejaParties();
  if (faites.has(etape) || enCours.has(etape)) return;
  enCours.add(etape);
  fetch(`${API_BASE}/etape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: getDeviceId(), etape }),
    keepalive: true,
  }).then(res => {
    if (!res.ok) return;
    faites.add(etape);
    try { localStorage.setItem(PARTIES, JSON.stringify([...faites])); } catch { /* sans memoire */ }
  }).catch(() => { /* hors ligne : elle repartira au prochain lancement */ });
}

let etatVu = '';

/**
 * A chaque image : ce qui vient de changer d'etat.
 *
 * Un rejeu de championnat n'est la course de personne — les huit couloirs y
 * sont pilotes par leur chrono — et ne doit donc rien faire avancer.
 */
export function suivreTunnel(G: any) {
  const etat = G.state;
  if (etat === etatVu) return;
  etatVu = etat;
  if (G.rejeu) return;
  if (etat === 'title') etapeTunnel('accueil');
  else if (etat === 'count') {
    etapeTunnel('depart');
    if (G.mode === 'oneshot') etapeTunnel('oneshot');
    else {
      const n = (G.levelIdx | 0) + 1;
      if (n >= 1 && n <= 6) etapeTunnel(`carriere_${n}` as EtapeTunnel);
    }
  }
}

/**
 * Au lancement du jeu : l'ouverture, et les deux signaux que l'accueil emet.
 *
 * `sprinter:tour-vu` est ecrit en toutes lettres plutot qu'importe : la
 * constante vit dans un composant (GameTour), et le moteur, qui importe ce
 * fichier, n'a pas a tirer React derriere lui. La visite compte des qu'elle
 * est FERMEE — vue jusqu'au bout ou passee : c'est ce que retient l'accueil.
 */
let demarre = false;
export function demarrerTunnel() {
  // Une fois par lancement : le mode strict de React rejoue les effets.
  if (demarre) return;
  demarre = true;
  etapeTunnel('ouverture');
  const nomPose = () => { if (getSavedName().trim()) etapeTunnel('nom'); };
  nomPose();
  try {
    window.addEventListener('sprinter:tour-vu', () => etapeTunnel('visite'));
    window.addEventListener(NOM_CHANGE, nomPose);
  } catch { /* hors navigateur */ }
}
