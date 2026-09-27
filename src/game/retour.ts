// REVENIR EN ARRIERE, PAR UN SEUL CHEMIN.
//
// Le joueur dispose de trois façons de sortir d'un panneau : la croix, le
// glissement depuis le bord gauche, et le retour arriere du systeme — geste de
// bord sur iOS, geste ou touche materielle sur Android. Elles doivent faire
// exactement la meme chose, sinon le jeu repond differemment selon la main qui
// le tient.
//
// LE GESTE DE BORD N'EST PAS A NOUS, ET C'EST TOUT LE PROBLEME. Sur Safari,
// un doigt parti du bord gauche est confisque par le navigateur : la page ne
// recoit aucun evenement tactile, elle recoit un retour d'historique. Un
// simple ecouteur de gestes ne verrait donc jamais rien sur un iPhone — c'est
// deja ce que raconte use-back-guard. On fait donc l'inverse : tout passe par
// l'historique. Le geste que la page voit, lui, se contente d'appeler
// `history.back()`, et le travail se fait au meme endroit pour tout le monde.
//
// Les panneaux s'annoncent ici en s'ouvrant, et le dernier ouvert est le
// premier a se refermer : depuis le classement des duels on ouvre les nations,
// et un retour doit rendre les duels, pas l'accueil.

type Fermeture = () => void;

const pile: { id: number; fermer: Fermeture }[] = [];
let prochainId = 1;

// Vrai quand une entree d'historique a nous est en place et qu'un retour
// arriere sera donc rattrape. Sans elle, `history.back()` ferait QUITTER la
// page au lieu de fermer un panneau — on ferme alors directement.
let historiqueArme = false;

export function armerHistorique(v: boolean) { historiqueArme = v; }

/**
 * Un panneau s'annonce, et rend de quoi se retirer.
 *
 * Le retrait se fait par identite et non par position : un panneau peut se
 * demonter alors qu'un autre s'est ouvert par-dessus, et depiler « le dernier »
 * fermerait le mauvais.
 */
export function empiler(fermer: Fermeture): () => void {
  const id = prochainId++;
  pile.push({ id, fermer });
  return () => {
    const i = pile.findIndex(e => e.id === id);
    if (i >= 0) pile.splice(i, 1);
  };
}

/** Y a-t-il quelque chose a refermer avant de songer a quitter la page ? */
export function aFermer() { return pile.length > 0; }

/** Referme le panneau du dessus. Rend faux s'il n'y avait rien. */
export function fermerLeDessus(): boolean {
  const e = pile.pop();
  if (!e) return false;
  e.fermer();
  return true;
}

/**
 * Ce que demande le GESTE, par opposition au retour du systeme.
 *
 * Il ne ferme rien lui-meme quand l'historique est en place : il tire la meme
 * ficelle que le geste de bord d'un iPhone, pour qu'il n'existe qu'un seul
 * chemin a verifier. Rend faux quand il n'y avait rien a fermer — l'appelant
 * sait alors que le geste ne s'adressait pas a lui.
 */
export function demanderRetour(): boolean {
  if (!aFermer()) return false;
  if (historiqueArme) { history.back(); return true; }
  return fermerLeDessus();
}
