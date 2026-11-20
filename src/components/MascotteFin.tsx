import React, { Suspense, lazy } from 'react';
import type { IssueRival } from '@/game/mascotte-reactions';

// LA MASCOTTE DANS LES ECRANS, chargee a part : three.js et son fichier ne partent qu'ici, jamais
// avec l'ouverture (3,2 s au plus, qui n'attend que les images du jeu — chargement.ts).
const MascotteReaction = lazy(() => import('./MascotteReaction').then((m) => ({ default: m.MascotteReaction })));
const Mascotte = lazy(() => import('./Mascotte').then((m) => ({ default: m.Mascotte })));

/**
 * En tete d'un ecran : le heros reagit a la course, ou — avec `rival` — le rival de duel reagit a
 * son issue (game/mascotte-reactions.ts). La place est reservee d'emblee.
 */
export function MascotteFin({ hauteur = 170, rival }: { hauteur?: number; rival?: IssueRival }) {
  return (
    <div className="pointer-events-none shrink-0 flex justify-center" style={{ height: hauteur }}>
      <Suspense fallback={null}><MascotteReaction hauteur={hauteur} rival={rival} /></Suspense>
    </div>
  );
}

/**
 * A L'ACCUEIL : elle salue, puis attend en frimant, debout sur le cote de la scene des coureurs
 * (la zone `data-accueil-scene` de TitleScreen). Elle ne capte aucun toucher.
 */
export function MascotteAccueil() {
  return (
    <div className="pointer-events-none absolute right-0 bottom-0 h-full" style={{ width: '34%', maxWidth: 170 }}>
      <Suspense fallback={null}>
        <Mascotte personnage="heros" geste="salut" ensuite="attente" lacet={-0.35} />
      </Suspense>
    </div>
  );
}
