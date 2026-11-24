// LES REGLAGES DE LA MISE A JOUR AU LANCEMENT — un seul endroit, rien dans l'ecran.
//
// Les seuils de version, eux, ne sont PAS ici : ils vivent cote serveur
// (worker/wrangler.toml, APP_*_LATEST / APP_*_MIN) pour se changer sans
// soumettre l'application. Ce qui suit ne bouge qu'avec une nouvelle version.

/** Le worker qui sert GET /app/version (le meme que les defis : game/objectif). */
export const API_VERSIONS = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev/app/version';

/** L'identifiant Apple de Sprinter (App Store Connect), pour ouvrir sa fiche. */
export const ID_APPLE = '6829487830';
/** L'identifiant du paquet Android (android/app/build.gradle). */
export const PAQUET_ANDROID = 'dev.benbezi.sprinter';

/** Au-dela, la verification abandonne et le jeu se lance comme si de rien n'etait. */
export const DELAI_MS = 4000;
/** « Plus tard » : la meme version ne se repropose pas avant ce delai. */
export const REPORT_MS = 24 * 60 * 60 * 1000;
/** Au retour au premier plan, on ne reverifie pas plus souvent que cela. */
export const REVERIFIER_MS = 30 * 60 * 1000;
/** La cle du « Plus tard » dans le stockage local. */
export const CLE_REPORT = 'sprinter.maj.report';

/**
 * Le drapeau de developpement. `VITE_MAJ=off` coupe la verification ;
 * `optionnelle` ou `obligatoire` montre la modale correspondante sans reseau,
 * dans `npm run dev` comme dans un build d'essai. Absent : comportement reel,
 * sauf en developpement ou la verification est coupee par defaut (le serveur
 * de dev n'est pas une application installee).
 */
export const SIMULATION = ((): 'off' | 'optionnelle' | 'obligatoire' | null => {
  const v = import.meta.env.VITE_MAJ;
  if (v === 'off' || v === 'optionnelle' || v === 'obligatoire') return v;
  return import.meta.env.DEV ? 'off' : null;
})();
