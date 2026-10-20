/* ---------------------------------------------------------------------------
   L'OUVERTURE DE L'EDITION HALLOWEEN — un seul interrupteur
   ---------------------------------------------------------------------------
   AUCUN IMPORT ICI, ET C'EST TOUT SON INTERET : ce fichier est lu par le jeu
   (canal.ts) ET par la configuration du build (vite.config.ts), qui ne
   connait ni `import.meta.env` ni TypeScript.

   POURQUOI UN SEUL INTERRUPTEUR. Ouvrir le mode demandait jusqu'ici CINQ
   gestes dans cinq fichiers — deux drapeaux, la fenetre de la banniere, la
   liste des fichiers retires du build, et une ligne du deploiement qui
   effacait le decor. Un seul oublie, et le mode partait a moitie : sans
   musique, sans bete en volume, ou sur des paves vides, et sans une erreur
   pour le dire (audit du 16/10/2026).

   A `true`, la production embarque le mode entier. CE N'EST PAS LUI QUI
   DECIDE DU JOUR : rien ne se joue avant que le SERVEUR ne dise 19 octobre
   (game/halloween-calendrier.ts), et la banniere n'apparait qu'a partir du
   19 a minuit, heure de Paris (EDITION_HALLOWEEN, game/edition.ts). On peut
   donc publier avant l'heure : le joueur trouve treize nuits scellees, et
   aucune ne s'ouvre avant sa date.

   Ce qu'on cede en publiant tot, et qu'on assume a J-3 : le code du mode est
   lisible dans le paquet public quelques jours avant l'ouverture.

   A `false`, tout se referme comme avant : le mode, ses images, sa musique et
   sa bete ne partent que sur le canal de test.
--------------------------------------------------------------------------- */
export const HALLOWEEN_PUBLIC = true;
