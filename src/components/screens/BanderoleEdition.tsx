import React from 'react';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { editionEnCours, joursRestants } from '@/game/edition';

/* ---------------------------------------------------------------------------
   LA BANDEROLE D'EDITION
   ---------------------------------------------------------------------------
   Elle annonce le stade du moment, et disparait quand la fenetre se referme.

   ELLE DISPARAIT, LE STADE RESTE. C'est toute la difference entre une edition
   et un evenement a duree limitee. Un stade qu'on retire le lundi matin, c'est
   un chrono qu'on ne peut plus rejouer et un joueur qui apprend que revenir
   coute quelque chose. La banniere, elle, n'a plus rien a dire passe la
   semaine ou le sujet vit — et une banniere qui n'a plus rien a dire devient
   une publicite.

   ELLE NE S'AFFICHE PAS SI LE STADE N'EST PAS LA. La fenetre est une date, la
   presence du stade est une autre affaire (canal, version installee). Annoncer
   un lieu qu'on ne peut pas atteindre est pire que ne rien annoncer : on
   cherche le bouton, il n'existe pas.

   LES COULEURS SONT CELLES DU STADE, pas celles du jeu. C'est le seul
   endroit de l'accueil ou l'or de SPRINTER cede la place — orange de piste
   sur un fond de nuit — pour que la banniere se lise comme une nouvelle et
   non comme un element de plus de l'interface.
--------------------------------------------------------------------------- */

/** L'index du stade de l'edition dans LEVELS, ou -1 s'il n'y est pas. */
function indexDuStade(cle: string): number {
  const niveaux = (SprinterApp as any).LEVELS as any[];
  if (!Array.isArray(niveaux)) return -1;
  return niveaux.findIndex(l => l && l.cle === cle);
}

export function BanderoleEdition() {
  const { N } = SprinterApp;
  const edition = editionEnCours();
  if (!edition) return null;

  const idx = indexDuStade(edition.stade);
  if (idx < 0) return null;

  const jours = joursRestants(edition);
  const reste = jours === 0 ? N.t('edition_reste_0')
              : jours === 1 ? N.t('edition_reste_1')
              : N.t('edition_reste_n', { n: jours });

  // Le 100 m, et lui seul. C'est l'epreuve que tout le monde connait, celle
  // du record que la banniere met en jeu, et la plus courte a essayer : une
  // banniere qui embarque sur trois epreuves demande trois minutes a
  // quelqu'un qui voulait juste voir le stade.
  const courir = () => (SprinterApp as any).startOneShot(['100'], { levelIdx: idx });

  return (
    <motion.div {...MONTEE}>
      <button
        onClick={courir}
        className="w-full rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-left
                   border-[#E86826]/70 bg-[#1A1428]/80 hover:bg-[#241A38]/90 transition-colors"
      >
        {/* La piste orange dans le noir, en deux traits. Pas d'icone de
            bibliotheque : aucune ne dit « stade », et celles qui s'en
            approchent disent « trophee », ce qui est deja pris. */}
        <span className="shrink-0 w-5 h-9 rounded-full border-2 border-[#E86826] bg-[#100C1A]" />

        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#EC2E96]">
            {N.t('edition_titre')}
          </span>
          <span className="font-bold text-sm md:text-base leading-tight text-foreground">
            {N.t('edition_ligne')}
          </span>
          <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
            {N.t('edition_sous')}
          </span>
        </span>

        <span className="shrink-0 flex flex-col items-end gap-1">
          <span className="px-2 py-1 rounded-lg bg-[#E86826] text-black text-[10px] font-black tracking-widest">
            {N.t('edition_courir')}
          </span>
          <span className="text-[9px] text-foreground/50 tracking-wide">{reste}</span>
        </span>
      </button>
    </motion.div>
  );
}
