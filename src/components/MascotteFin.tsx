import React, { Suspense, lazy } from 'react';
import type { IssueRival, REACTIONS_COURSE } from '@/game/mascotte-reactions';
import { EST_TEST } from '@/game/canal';

/**
 * LES MASCOTTES NE SONT PAS PRETES (« retire les mascottes du jeu pour l'instant, elles ne sont pas
 * pretes, mets-les dans la version test », l'auteur, 20/11/2026) : elles ne vivent plus que sur le
 * canal de test (/test/, /test3d/). En production, aucun de ces composants ne rend quoi que ce soit —
 * ni place reservee, ni three.js charge, ni fichier demande.
 */
export const MASCOTTE_OUVERTE = EST_TEST;

// LA MASCOTTE DANS LES ECRANS, chargee a part : three.js et son fichier ne partent qu'ici, jamais
// avec l'ouverture (3,2 s au plus, qui n'attend que les images du jeu — chargement.ts).
const MascotteReaction = lazy(() => import('./MascotteReaction').then((m) => ({ default: m.MascotteReaction })));
const Mascotte = lazy(() => import('./Mascotte').then((m) => ({ default: m.Mascotte })));

/**
 * En tete d'un ecran : le heros reagit a la course, ou — avec `rival` — le rival de duel reagit a
 * son issue (game/mascotte-reactions.ts). La place est reservee d'emblee.
 */
export function MascotteFin({ hauteur = 170, rival, heros }: {
  hauteur?: number; rival?: IssueRival; heros?: keyof typeof REACTIONS_COURSE;
}) {
  if (!MASCOTTE_OUVERTE) return null;
  return (
    <div className="pointer-events-none shrink-0 flex justify-center" style={{ height: hauteur }}>
      <Suspense fallback={null}><MascotteReaction hauteur={hauteur} rival={rival} heros={heros} /></Suspense>
    </div>
  );
}

/**
 * A L'ACCUEIL : elle salue, puis attend en frimant, debout sur le cote de la scene des coureurs
 * (la zone `data-accueil-scene` de TitleScreen). Elle ne capte aucun toucher.
 */
export function MascotteAccueil() {
  if (!MASCOTTE_OUVERTE) return null;
  return (
    <div className="pointer-events-none absolute right-0 bottom-0 h-full" style={{ width: '34%', maxWidth: 170 }}>
      <Suspense fallback={null}>
        {/* il salue, attend en frimant, puis change de pose de temps en temps */}
        <Mascotte personnage="heros" geste="salut" suite={[['heros', 'attente']]} lacet={-0.35}
          repos={{ p: 'heros', gestes: ['attente', 'frime', 'defi', 'echauffement', 'montre', 'bras_croises', 'gammes', 'epaules', 'lunettes'] }} />
      </Suspense>
    </div>
  );
}
