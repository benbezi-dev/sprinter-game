import React from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '@/game/engine';
import { nuitEnCours, nuitCourante, etatDeLaChasse, resteAuChrono } from '@/game/halloween';
import { mot, chrono } from '@/game/halloween-mots';

/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — ce qu'on lit pendant la course
   ---------------------------------------------------------------------------
   Deux choses, et surtout pas trois : combien de metres la bete a encore a
   rattraper, et a quel point c'est en train de mal tourner.

   LE COMPTE A REBOURS N'EST PAS ICI. Il a pris la place du chronometre
   ordinaire, en haut a droite, la ou le joueur regarde deja (voir RaceHUD).
   Un second grand nombre affiche ailleurs aurait partage le regard en deux
   pendant onze secondes ou l'on n'a le temps de rien lire.

   LA BARRE EST EN BAS, PAS EN HAUT. Ce qu'elle mesure arrive par derriere :
   la mettre en haut de l'ecran, avec le reste du tableau de bord, l'aurait
   rangee parmi les informations. En bas, sous la piste, elle est a l'endroit
   d'ou vient la menace, et on la voit monter sans quitter le coureur des yeux.

   ET ELLE NE S'ALLUME QU'A DOUZE METRES. Une jauge presente d'un bout a
   l'autre de la course devient un decor ; celle-ci apparait quand la bete
   entre dans la zone ou l'on peut encore faire quelque chose, et c'est son
   apparition elle-meme qui porte l'information.
--------------------------------------------------------------------------- */

/** A partir de quel ecart la jauge se montre, en metres. */
const PORTEE = 12;

export function HalloweenHUD() {
  // On lit a chaque image : la bete avance entre deux battements de coeur.
  const elapsed = useGameStore(s => s.elapsed);
  const state = useGameStore(s => s.state);
  void elapsed;

  if (!nuitEnCours()) return null;
  const c = etatDeLaChasse();
  const nuit = nuitCourante();
  if (!c || !nuit) return null;

  // Avant le coup de pistolet, la bete est couchee derriere la ligne : il n'y
  // a rien a mesurer, et une jauge pleine pendant le decompte annoncerait une
  // morsure qui n'a pas commence.
  if (state !== 'race') return null;

  const ecart = Math.max(0, c.ecart);
  const proche = ecart <= PORTEE && c.verdict === 'court';
  // La menace : 0 loin derriere, 1 la gueule sur les talons.
  const menace = Math.max(0, Math.min(1, 1 - ecart / PORTEE));

  return (
    <div className="absolute inset-x-0 bottom-[22%] flex flex-col items-center pointer-events-none">
      {/* LE NOM DE LA NUIT, tout petit, le temps des deux premieres secondes.
          Il dit ou l'on est sans jamais rester : passe la premiere foulee, le
          joueur n'a plus rien a faire de ce nom. */}
      {resteAuChrono() > nuit.imparti - 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="mb-2 font-mono text-[9px] sm:text-[10px] tracking-[0.3em]
                               text-[#E86826]/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          {mot('hw_nuit_n', { n: String(nuit.n) })}
        </motion.div>
      )}

      {proche && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
        >
          {/* LES METRES, EN CHIFFRES. Une barre seule ne dit pas « trois
              metres » — et trois metres, c'est ce qu'on raconte apres. */}
          <span className={`font-black font-display tracking-wider text-lg sm:text-xl
                            ${menace > 0.75 ? 'text-destructive' : 'text-[#F8A02E]'}`}>
            {ecart < 1.2 ? mot('hw_dans_lecou')
                         : mot('hw_derriere', { m: ecart.toFixed(1) })}
          </span>

          {/* La jauge. Elle se remplit vers la DROITE, dans le sens de la
              course : une jauge qui se viderait aurait raconte le contraire de
              ce qui se passe — ce n'est pas le joueur qui s'epuise, c'est la
              bete qui arrive. */}
          <div className="w-28 sm:w-36 h-1.5 rounded-full bg-black/60 overflow-hidden
                          border border-[#E86826]/30">
            <div
              className="h-full transition-[width] duration-75"
              style={{
                width: `${Math.round(menace * 100)}%`,
                backgroundColor: menace > 0.75 ? 'rgb(228,48,22)' : 'rgb(236,124,32)',
              }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Le compte a rebours, tel que le tableau de course l'affiche a la place du
 * chronometre.
 *
 * Rend `null` hors d'une nuit, et c'est ce que RaceHUD teste : sans nuit en
 * cours, il garde son chrono qui monte, et rien de ce fichier ne le concerne.
 */
export function reboursDeLaNuit(): number | null {
  if (!nuitEnCours()) return null;
  return resteAuChrono();
}

/**
 * La couleur du compte a rebours.
 *
 * Trois etats et pas un degrade : au-dessus de deux secondes c'est l'orange du
 * mode, en dessous le rouge, et zero fige en rouge. Un degrade continu aurait
 * change de teinte sans qu'on sache quand — or le seul moment qui compte est
 * celui ou il faut arreter de gerer et tout donner.
 */
export function couleurDuRebours(reste: number): string {
  if (reste <= 0) return 'text-destructive';
  return reste < 2 ? 'text-destructive' : 'text-[#F8A02E]';
}

/** Le compte a rebours, ecrit. */
export function texteDuRebours(reste: number): string {
  return chrono(reste);
}
