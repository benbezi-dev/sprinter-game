// Le tchat rapide : des phrases ecrites par le jeu, envoyees par les joueurs.
//
// Un tchat libre dans une salle de course, c'est un texte ecrit par un inconnu
// qui s'affiche chez un autre, sans personne pour le relire. L'organisateur l'a
// tranche le 26/09 : pas de texte libre. Le joueur choisit une phrase, le
// serveur ne transporte que son identifiant (worker/src/tchat-rapide.js), et
// chaque telephone l'ecrit dans SA langue. Rien a filtrer, rien a traduire.
//
// Ce fichier tient trois choses :
// - le catalogue, qui doit rester identique a celui du serveur ;
// - la salle a qui parler : celle du direct ou celle d'une serie de
//   championnat, qui survivent toutes deux au demontage des ecrans (voir
//   salon-direct.ts et champ-direct.ts) — les bulles vivent donc ici, au-dessus
//   des composants, pour la meme raison ;
// - les bulles recues, que la surcouche (TchatRapide.tsx) affiche.

import { useSyncExternalStore } from 'react';
import { SprinterApp } from './engine';

export type Famille = 'piques' | 'encouragements' | 'arcade';

/** Les phrases, par famille, dans l'ordre ou le choix les presente. */
export const FAMILLES: { cle: Famille; ids: string[] }[] = [
  { cle: 'piques',
    ids: ['p_echauffement', 'p_ralenti', 'p_personne', 'p_blocs', 'p_forcer', 'p_ligne'] },
  { cle: 'encouragements',
    ids: ['e_marques', 'e_meilleur', 'e_envoie', 'e_propre', 'e_bien', 'e_revanche'] },
  { cle: 'arcade', ids: ['a_go', 'a_perfect', 'a_photo', 'a_combo'] },
];

/**
 * Les emojis. Choisis pour la piste — le feu, l'eclair, le drapeau a damier —
 * et pour ce qu'un coureur ressent : l'effort, la rage, le rire jaune, le
 * choc d'un photo-finish. Aucun ne peut servir a autre chose.
 */
export const EMOJIS: Record<string, string> = {
  x_feu: '🔥', x_eclair: '⚡', x_bravo: '👏', x_force: '💪',
  x_rage: '😤', x_oups: '😅', x_choc: '😱', x_drapeau: '🏁',
};

/** Tout ce que le serveur accepte. */
export const RAPIDES: string[] = [...FAMILLES.flatMap(f => f.ids), ...Object.keys(EMOJIS)];

/** Le texte d'un identifiant, dans la langue du joueur. */
export function texteRapide(q: string): string {
  if (Object.prototype.hasOwnProperty.call(EMOJIS, q)) return EMOJIS[q];
  // L'espace qui precede un point d'interrogation ou d'exclamation devient
  // insecable : dans une bulle etroite, « ? » partait seul a la ligne.
  return SprinterApp.N.t('rapide_' + q).replace(/ ([?!])/g, '\u00a0$1');
}

export const estEmoji = (q: string) => Object.prototype.hasOwnProperty.call(EMOJIS, q);

/** Combien de temps une bulle reste a l'ecran, et combien a la fois. */
export const DUREE_BULLE_MS = 4500;
const MAX_BULLES = 4;
/** L'ecart que le serveur impose entre deux envois (ECART_MS la-bas). */
export const ECART_MS = 2000;

export type Bulle = {
  cle: number;
  /** L'identifiant de l'envoyeur dans la salle. */
  id: string;
  /** Son nom, ou null pour une tribune au nom non verifie. */
  nom: string | null;
  q: string;
  moi: boolean;
};

/** Ce qu'il faut a ce fichier d'une salle : son identite, et de quoi envoyer. */
export type EmetteurRapide = { moi: string; rapide: (q: string) => void };

type Etat = {
  /** Une salle est ouverte : on peut envoyer. */
  actif: boolean;
  bulles: Bulle[];
  /** Instant local jusqu'auquel l'envoi attend. */
  attenteJusqua: number;
  coupe: boolean;
  /** Le choix des phrases est ouvert. Il s'ouvre du salon comme du bouton. */
  choix: boolean;
};

const CLE_COUPE = 'sprinter:rapide-coupe';
function lireCoupe(): boolean {
  try { return localStorage.getItem(CLE_COUPE) === '1'; } catch { return false; }
}

let emetteur: EmetteurRapide | null = null;
let etat: Etat = { actif: false, bulles: [], attenteJusqua: 0, coupe: lireCoupe(), choix: false };
let prochaine = 1;
const abonnes = new Set<() => void>();

function publier(p: Partial<Etat>) {
  etat = { ...etat, ...p };
  for (const f of [...abonnes]) {
    try { f(); } catch { /* un abonne casse n'empeche pas les autres */ }
  }
}

/** La salle qui vient d'ouvrir devient celle a qui l'on parle. */
export function brancherRapide(s: EmetteurRapide) {
  emetteur = s;
  publier({ actif: true, bulles: [] });
}

/** Elle ferme : plus d'envoi, plus de bulles. Une autre salle n'est pas touchee. */
export function debrancherRapide(s: EmetteurRapide) {
  if (emetteur !== s) return;
  emetteur = null;
  publier({ actif: false, bulles: [], choix: false });
}

/** Une bulle arrive de la salle. */
export function recevoirRapide(s: EmetteurRapide, m: { id?: string; nom?: string | null; q?: string }) {
  if (s !== emetteur || typeof m.q !== 'string' || !RAPIDES.includes(m.q)) return;
  const moi = !!m.id && m.id === s.moi;
  // Couper les bulles coupe celles des autres. La sienne s'affiche quand meme :
  // sans elle, on ne saurait pas si la phrase est partie.
  if (etat.coupe && !moi) return;
  const b: Bulle = { cle: prochaine++, id: String(m.id || ''), nom: m.nom || null, q: m.q, moi };
  publier({ bulles: [...etat.bulles, b].slice(-MAX_BULLES) });
  setTimeout(() => {
    if (etat.bulles.some(x => x.cle === b.cle)) {
      publier({ bulles: etat.bulles.filter(x => x.cle !== b.cle) });
    }
  }, DUREE_BULLE_MS);
}

/** Le serveur a trouve qu'on allait trop vite : on attend l'ecart entier. */
export function refusRapide() {
  publier({ attenteJusqua: Date.now() + ECART_MS });
}

/**
 * Envoyer une phrase. Rend false quand il faut attendre : l'ecran le dit au
 * lieu d'envoyer une phrase que le serveur jetterait.
 */
export function envoyerRapide(q: string): boolean {
  if (!emetteur || !RAPIDES.includes(q)) return false;
  if (Date.now() < etat.attenteJusqua) return false;
  emetteur.rapide(q);
  publier({ attenteJusqua: Date.now() + ECART_MS });
  return true;
}

/** Ouvre, ou referme, le choix des phrases. Sans salle, il reste ferme. */
export function ouvrirChoixRapide(v = true) {
  publier({ choix: v && !!emetteur });
}

/** Couper, ou remettre, les bulles des autres. Garde sur l'appareil. */
export function couperRapide(v: boolean) {
  try { localStorage.setItem(CLE_COUPE, v ? '1' : '0'); } catch { /* reste pour la session */ }
  publier({ coupe: v, bulles: v ? etat.bulles.filter(b => b.moi) : etat.bulles });
}

export function useTchatRapide(): Etat {
  return useSyncExternalStore(
    l => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => etat, () => etat,
  );
}
