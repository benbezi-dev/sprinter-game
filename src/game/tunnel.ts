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
//
// « OUVERTURE » N'EST PAS « VU ». Elle part au montage de React, des que la
// page est visible (depuis le 21/10/2026 ; avant, meme cachee : un apercu de
// lien ou un onglet d'arriere-plan la declenchaient aussi bien qu'un joueur). « ecran » part quand la page est VISIBLE et qu'une premiere image a
// ete peinte. Avec les deux, une fiche d'appareil — la classe de navigateur
// (game/navigateur.ts, jamais l'agent brut) puis, a l'accueil, le temps de
// chargement depuis le debut de la navigation — permet au tableau de dire qui
// part pendant le chargement.
//
// LE TUTORIEL DU GESTE N'EST PAS UNE COURSE. Il met le jeu en `race` ou en
// `count` avec G.mode = 'campaign' et tape les touches : sans garde, il ferait
// partir « depart », « carriere_1 » et « premier_appui » sans que personne ait
// couru. Aucun drapeau n'en est expose sur G ; `tutoEnPiste()` vit dans
// sprint-tuto.js et haies-tuto.js, qui importent le moteur — qui importe ce
// fichier. Un import statique ferait un cycle (haies-course.js dit pourquoi
// le moteur n'importe pas ce genre de fichier) : on les charge donc a part,
// au lancement, et l'on ne regarde que leur reponse.

import { getDeviceId, getSavedName, NOM_CHANGE } from './leaderboard';
import { navigateurActuel } from './navigateur';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const PARTIES = 'sprinter_tunnel';

export type EtapeTunnel =
  | 'ouverture' | 'ecran' | 'accueil' | 'visite' | 'nom'
  | 'depart' | 'premier_appui' | 'arrivee' | 'oneshot'
  | 'carriere_1' | 'carriere_2' | 'carriere_3'
  | 'carriere_4' | 'carriere_5' | 'carriere_6'
  // les treize nuits d'Halloween (game/halloween-mesure.ts, worker/src/tunnel.js)
  | 'hw_entree' | `hw_nuit_${number}` | `hw_tenue_${number}`;

let parties: Set<string> | null = null;
/** Envoyees pendant ce lancement, reponse ou pas : on ne les redemande pas. */
const enCours = new Set<string>();

function dejaParties(): Set<string> {
  if (parties) return parties;
  try { parties = new Set(JSON.parse(localStorage.getItem(PARTIES) || '[]')); }
  catch { parties = new Set(); }
  return parties;
}

/** Les etapes qui supposent une vraie course : muettes pendant un tutoriel. */
const DE_COURSE = new Set<EtapeTunnel>([
  'depart', 'premier_appui', 'arrivee', 'oneshot',
  'carriere_1', 'carriere_2', 'carriere_3', 'carriere_4', 'carriere_5', 'carriere_6',
]);

/** Les `tutoEnPiste` des deux tutoriels, une fois charges. Vide d'ici la. */
let tutos: Array<() => boolean> = [];
function chargerLesTutos() {
  Promise.all([import('./sprint-tuto.js'), import('./haies-tuto.js')])
    .then(ms => { tutos = ms.map((m: any) => m.tutoEnPiste as () => boolean); })
    .catch(() => { /* sans eux, rien n'est mute : le defaut d'avant */ });
}
function tutoEnCours(): boolean {
  try { return tutos.some(f => f()); } catch { return false; }
}

/**
 * La fiche d'appareil, jointe a une etape. `navigateur` part avec l'ouverture
 * et l'ecran (la deuxieme rattrape un ancien client qui avait deja envoye la
 * sienne), `chargement_ms` avec l'accueil. Le serveur ne garde que la
 * premiere valeur de chacun.
 */
function ficheDe(etape: EtapeTunnel): { navigateur?: string; chargement_ms?: number } {
  if (etape === 'ouverture' || etape === 'ecran') return { navigateur: navigateurActuel() };
  if (etape === 'accueil') {
    try {
      const ms = Math.round(performance.now());
      if (Number.isFinite(ms) && ms >= 0) return { chargement_ms: ms };
    } catch { /* sans horloge */ }
  }
  return {};
}

export function etapeTunnel(etape: EtapeTunnel) {
  const faites = dejaParties();
  if (faites.has(etape) || enCours.has(etape)) return;
  if (DE_COURSE.has(etape) && tutoEnCours()) return;
  enCours.add(etape);
  fetch(`${API_BASE}/etape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: getDeviceId(), etape, ...ficheDe(etape) }),
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
 * sont pilotes par leur chrono — et ne doit donc rien faire avancer. Un
 * tutoriel non plus : l'etat est lu (pour ne pas le « revoir » a la sortie du
 * tutoriel) mais rien n'est compte.
 */
export function suivreTunnel(G: any) {
  const etat = G.state;
  if (etat === etatVu) return;
  etatVu = etat;
  if (G.rejeu || tutoEnCours()) return;
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
 * « L'ecran » : la page est visible et une premiere image est peinte.
 *
 * Deux images d'animation de suite : la premiere callback part AVANT la
 * peinture de l'image qu'elle precede, la seconde apres — c'est le seul
 * signal portable d'« une image est a l'ecran ». Cachee au montage (apercu,
 * onglet d'arriere-plan), la page attend `visibilitychange` ; et si elle se
 * cache entre-temps, la peinture n'est pas comptee : on reattend.
 */
function guetterLEcran() {
  let fait = false;
  const envoyer = () => {
    if (fait) return;
    fait = true;
    document.removeEventListener('visibilitychange', essayer);
    etapeTunnel('ecran');
  };
  const essayer = () => {
    if (fait || document.visibilityState !== 'visible') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (document.visibilityState === 'visible') envoyer();
    }));
  };
  try {
    document.addEventListener('visibilitychange', essayer);
    essayer();
  } catch { /* hors navigateur */ }
}

/**
 * Au lancement du jeu : l'ouverture, l'ecran, et les deux signaux que l'accueil emet.
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
  chargerLesTutos();
  // L'ouverture attend que la page soit VISIBLE (l'auteur, 21/10/2026) : un
  // apercu de lien ou un onglet d'arriere-plan qui ne s'affiche jamais n'entre
  // plus dans la cohorte. Avant, ils y entraient et gonflaient la perte
  // « ouverture → ecran » (429 appareils) sans etre des joueurs.
  const ouvrir = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', ouvrir);
    etapeTunnel('ouverture');
  };
  try {
    document.addEventListener('visibilitychange', ouvrir);
    ouvrir();
  } catch { etapeTunnel('ouverture'); /* hors navigateur */ }
  guetterLEcran();
  const nomPose = () => { if (getSavedName().trim()) etapeTunnel('nom'); };
  nomPose();
  try {
    window.addEventListener('sprinter:tour-vu', () => etapeTunnel('visite'));
    window.addEventListener(NOM_CHANGE, nomPose);
  } catch { /* hors navigateur */ }
}
