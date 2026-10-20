/* ---------------------------------------------------------------------------
   LE PROFIL QUI SURVIT AU TELEPHONE
   ---------------------------------------------------------------------------
   Reinstaller l'appli efface son stockage, et avec lui la carriere, la
   Legende, le vestiaire : le jeu relancait la course d'initiation a un joueur
   qui courait depuis des semaines (21/10/2026). Le nom et ses chronos du
   classement revenaient avec le code de recuperation, le reste jamais.

   Le profil — les cles de CLES_PROFIL (profil-fusion.js) — est donc garde sous
   le nom RESERVE, sur le serveur (worker/src/profil.js), par tout appareil qui
   en detient le code :

     ENVOYER   a l'ouverture, apres chaque course, quand l'appli passe en
               arriere-plan. Chaque envoi porte la revision connue ; si un
               autre appareil a ecrit entre-temps, le serveur rend sa version,
               on la fusionne ici, et on renvoie.
     REPRENDRE des que l'appareil recoit le code d'un nom (reserve, relie,
               transfere, rendu — identity.ts, APPAREIL_RELIE) : la version du
               serveur est fusionnee dans le stockage, et le jeu la relit sans
               recharger la page.

   La fusion ne fait jamais de somme (profil-fusion.js) : un telephone neuf qui
   reprend un profil puis le renvoie ne double rien.
--------------------------------------------------------------------------- */

import { getDeviceId, getSavedName } from './leaderboard';
import { savedCode, APPAREIL_RELIE } from './identity';
import { CLES_PROFIL, fusionnerProfils } from './profil-fusion.js';
import { SprinterApp } from './engine';
import { relireVestiaire } from './vestiaire';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
/** La derniere revision du serveur que cet appareil a vue. Propre a l'appareil. */
const CLE_REV = 'sprinter_profil_rev';

/** Le profil a ete repris d'un autre appareil (l'accueil peut le dire). */
export const PROFIL_REPRIS = 'sprinter:profil-repris';

type Profil = Record<string, string>;

function instantane(): Profil {
  const p: Profil = {};
  for (const k of CLES_PROFIL) {
    try { const v = localStorage.getItem(k); if (v != null) p[k] = v; } catch { /* stockage ferme */ }
  }
  return p;
}

/** Poser dans le stockage ce qui a change, et dire au jeu de le relire. */
function appliquer(avant: Profil, apres: Profil): boolean {
  let change = false;
  for (const [k, v] of Object.entries(apres)) {
    if (avant[k] === v) continue;
    try { localStorage.setItem(k, v); change = true; } catch { /* stockage plein : on garde l'ancien */ }
  }
  if (!change) return false;
  // La carriere vit en memoire (G.scores…) et `save()` la reecrirait depuis
  // la : on la recharge. Le vestiaire garde un cache. Le reste se relit a
  // chaque usage — sauf les ecrans de saut, qui lisent a l'ouverture.
  // shortcut: un ecran de saut ouvert pendant une fusion garde son etat d'avant jusqu'a sa reouverture.
  try { SprinterApp.load(); } catch { /* moteur absent : relu au prochain lancement */ }
  try { relireVestiaire(); } catch { /* idem */ }
  return true;
}

function lireRev(): number {
  try { const n = Number(localStorage.getItem(CLE_REV)); return Number.isInteger(n) && n > 0 ? n : 0; }
  catch { return 0; }
}
function poserRev(n: number) { try { localStorage.setItem(CLE_REV, String(n)); } catch { /* relu au conflit suivant */ } }

async function poster(route: string, corps: object, keepalive = false): Promise<any | null> {
  try {
    const r = await fetch(`${API_BASE}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps), keepalive,
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Le nom sous lequel cet appareil peut garder un profil, ou '' (pas de code). */
function nomRelie(): string {
  const n = (getSavedName() || '').trim();
  return n && n.toLowerCase() !== 'anonyme' && savedCode() ? n : '';
}

let enCours: Promise<void> | null = null;

/**
 * Envoyer le profil. Un seul envoi a la fois ; un conflit se fusionne et se
 * renvoie, deux fois au plus (au-dela, le prochain envoi reprendra).
 */
export function envoyerProfil(keepalive = false): Promise<void> {
  const nom = nomRelie();
  if (!nom) return Promise.resolve();
  if (enCours) return enCours;
  enCours = (async () => {
    for (let essai = 0; essai < 3; essai++) {
      const donnees = instantane();
      const r = await poster('/profil/ecrire',
        { device_id: getDeviceId(), name: nom, rev: lireRev(), donnees }, keepalive);
      if (!r || r.non_relie) return;
      if (r.ok) { poserRev(r.rev); return; }
      if (!r.conflit) return;
      appliquer(donnees, fusionnerProfils(donnees, r.donnees || {}));
      poserRev(r.rev);
    }
  })().finally(() => { enCours = null; });
  return enCours;
}

/** Reprendre le profil garde sous `nom`, puis renvoyer la version fusionnee. */
export async function reprendreProfil(nom: string): Promise<boolean> {
  const r = await poster('/profil/lire', { device_id: getDeviceId(), name: nom });
  if (!r || !r.ok) return false;
  let repris = false;
  if (r.donnees) {
    const ici = instantane();
    repris = appliquer(ici, fusionnerProfils(ici, r.donnees));
  }
  poserRev(r.rev || 0);
  if (repris) {
    // Un joueur qui retrouve sa carriere n'est pas un nouveau venu : les
    // premiers pas (premiers-pas.ts) et le tutoriel ne se representent plus.
    try {
      localStorage.setItem('sprinter_premiers_pas', 'fait');
      localStorage.setItem('sprinter_tuto_vu', '1');
      localStorage.setItem('sprinter_tour_vu', '1');
      localStorage.setItem('sprinter_bienvenue_vue', '1');
    } catch { /* sans memoire */ }
    try { window.dispatchEvent(new Event(PROFIL_REPRIS)); } catch { /* hors navigateur */ }
  }
  await envoyerProfil();
  return repris;
}

let branche = false;
/** A l'ouverture du jeu (App.tsx), une fois. */
export function brancherProfil() {
  if (branche) return;
  branche = true;
  window.addEventListener(APPAREIL_RELIE, (e) => {
    const nom = String((e as CustomEvent).detail?.name || '').trim();
    // Apres le tour en cours : l'appelant enregistre le nom juste apres le code.
    if (nom) setTimeout(() => { void reprendreProfil(nom); }, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void envoyerProfil(true);
  });
  // Les joueurs deja relies avant cette version deposent leur premier profil.
  setTimeout(() => { void envoyerProfil(); }, 4000);
}
