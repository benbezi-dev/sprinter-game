# pixelfx (copie partielle)

Source : https://github.com/patch-gg/pixelfx, commit 5294518ce7c72e48b6100a744596e0acf57f2826 (v0.3.1), licence MIT — voir LICENSE et NOTICE.md, à garder avec ces fichiers.

Copié tel quel : `src/core/` entier, et quatre effets avec leurs `_lib.js` :
projectiles/muzzle-pistol, impacts/hit-spark, impacts/crit-hit, explosions/firework-burst.

Rien de la galerie (la police Patch Pixel n'est pas libre). Branché par `src/game/effets-pixel.ts`.
Pour ajouter un effet : copier `src/fx/<categorie>/<nom>.js` (et son `_lib.js`) depuis le même commit,
puis l'ajouter à la table EFFETS de effets-pixel.ts. Les effets marqués `actor:` dessinent leur propre
personnage : à éviter sur la piste.
