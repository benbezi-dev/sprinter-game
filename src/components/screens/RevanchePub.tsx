import React, { useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { usePieces } from '@/game/pieces';
import { Reprises, repriseOfferte } from './Reprises';

/**
 * LA REVANCHE APRES UN FAUX DEPART, EN ONE SHOT : UNE PUB OU DES PIECES.
 *
 * DECISIONS DE L'AUTEUR DU 10 NOVEMBRE 2026 :
 *  - « les faux departs lors des one shot devront aussi beneficier de la pub
 *    pour une revanche, sinon on recommence sans la revanche » ;
 *  - « 3 pub max par revanche, je teste et on reduit ou augmente ensuite » ;
 *  - « un faux depart, une pub pour recommencer ou des pieces ».
 *
 * Meme regle qu'en carriere, et le meme bloc (Reprises.tsx) : le faux depart
 * brule la tentative, une pub ou un Continue en pieces la rend. Le parcours
 * aupres du serveur est la revanche elle-meme (`revanche-<id du duel venge>`) :
 * le serveur y compte les Continue payes, le prix monte comme en carriere ; les
 * pubs se comptent ici, pour la session, plafonnees a PUBS_PAR_REVANCHE.
 *
 * Deux endroits : le duel perdu sur faux depart (PRENDRE MA REVANCHE) et le
 * faux depart pendant une revanche (la retenter). Sans pub ni pieces, rien ne
 * se montre : il reste RECOMMENCER, qui part sur une course neuve et oublie la
 * revanche (recommencer() du moteur).
 *
 * AFTER A ONE SHOT FALSE START, THE REMATCH IS RETRIED WITH AN AD (AT MOST
 * PUBS_PAR_REVANCHE PER REMATCH) OR COINS; otherwise RECOMMENCER drops it.
 */
export const PUBS_PAR_REVANCHE = 3;

type Compte = Record<string, number>;
const lire = (champ: 'revanchesPub' | 'revanchesAchats', cle: string): number =>
  ((SprinterApp.G[champ] || {}) as Compte)[cle] || 0;
const poser = (champ: 'revanchesPub' | 'revanchesAchats', cle: string, n: number) => {
  SprinterApp.G[champ] = { ...((SprinterApp.G[champ] || {}) as Compte), [cle]: n };
};

/** L'identifiant de parcours que le serveur accepte ([a-zA-Z0-9-]{8,64}). */
function parcoursDe(cle: string | null | undefined): string {
  const id = String(cle || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 54);
  return id ? `revanche-${id}` : '';
}

/** Une pub ou des pieces sont-elles proposees pour cette revanche ? */
export function useRevancheRachetable(cle: string | null | undefined): boolean {
  const pieces = usePieces();
  const parcours = parcoursDe(cle);
  return !!parcours && repriseOfferte(pieces, {
    parcours, achetes: lire('revanchesAchats', parcours), pubs: lire('revanchesPub', parcours),
    pubsMax: PUBS_PAR_REVANCHE,
  });
}

export function RevanchePub({ cle, adversaire, onRevanche }: {
  /** L'identifiant du duel que la revanche venge. */
  cle: string;
  adversaire: string;
  onRevanche: () => void;
}) {
  const { N } = SprinterApp;
  const parcours = parcoursDe(cle);
  const [, rafraichir] = useState(0);
  if (!parcours) return null;
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <Reprises parcours={parcours}
        achetes={lire('revanchesAchats', parcours)} pubs={lire('revanchesPub', parcours)}
        pubsMax={PUBS_PAR_REVANCHE}
        etape={N.t('duel_revanche_etape', { n: adversaire })}
        recaler={n => { poser('revanchesAchats', parcours, n); rafraichir(x => x + 1); }}
        reprendre={parPub => {
          if (parPub) poser('revanchesPub', parcours, lire('revanchesPub', parcours) + 1);
          else poser('revanchesAchats', parcours, lire('revanchesAchats', parcours) + 1);
          onRevanche();
        }} />
    </div>
  );
}
