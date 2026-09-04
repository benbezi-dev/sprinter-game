import React from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'framer-motion';
import { Trophy, Loader2 } from 'lucide-react';
import type { RaceOutcome } from '@/game/leaderboard';
import { Compteur } from './Compteur';
import { MonteeAuClassement } from './MonteeClassement';

/**
 * LE RECORD A SON MOMENT, AVANT LE MENU DE FIN.
 *
 * Il a d'abord vecu en panneau, coince dans la colonne de l'ecran de fin,
 * entre les chronos et « DEFIER UN AMI ». Il y etait exact et il n'y etait
 * rien : la meme bordure que les autres, la meme largeur, la meme place dans
 * la descente. On battait son record et on lisait une ligne de plus.
 *
 * Battre son record n'est pas une information de plus sur un ecran de
 * resultat : c'est la seule chose qui distingue cette course des cinquante
 * precedentes. Elle prend donc l'ecran entier, tout de suite, avec les
 * confettis et le chrono qui defile jusqu'a sa valeur — et le menu de fin
 * attend derriere, intact, a un bouton d'ici.
 *
 * LA PLACE AU TOP 500 EST ICI, ET NULLE PART AILLEURS. C'est le seul instant
 * ou elle veut dire quelque chose : le chrono vient de tomber, et on apprend
 * dans la meme phrase qu'il entre au classement de tous les temps a telle
 * place. Sur le menu de fin, la meme ligne n'etait qu'un nombre de plus a
 * enjamber pour atteindre RECOMMENCER.
 *
 * IL N'Y A RIEN A REMPLIR. Le nom se pose une fois a l'accueil et le chrono
 * part tout seul dessous. Ne restent que les phrases qui disent ce qui a
 * empeche l'envoi : un record qui disparait sans un mot se lit comme un bug.
 */
export function RecordBattu({
  tops, statut, nom, onFermer,
}: {
  /** Les chronos qui ameliorent le record personnel. Jamais vide. */
  tops: RaceOutcome[];
  statut: 'checking' | 'sansnom' | 'sending' | 'done' | 'error' | 'pris';
  /** Le nom sous lequel l'envoi est parti, vide s'il n'y en a pas. */
  nom: string;
  onFermer: () => void;
}) {
  const { N } = SprinterApp;
  const seul = tops.length === 1 ? tops[0] : null;

  /**
   * L'EPREUVE DONT LA MONTEE SE MONTRE, ET IL N'Y EN A QU'UNE.
   *
   * « 9e au TOP 500 » est un nombre ; ce qu'on est venu chercher est le
   * deplacement qui l'a produit. On le joue donc pour de bon — le nom qui
   * traverse le classement et se pose entre ceux qu'il vient de doubler.
   *
   * Un programme a plusieurs epreuves peut faire monter deux fois. On garde la
   * plus grande montee et rien d'autre : deux animations l'une sous l'autre se
   * regardent l'une apres l'autre, et la carte finirait plus haute que
   * l'ecran. Un premier chrono — aucune place d'avant — compte pour la plus
   * grande de toutes : entrer au tableau est le plus grand des deplacements.
   */
  const gain = (t: RaceOutcome) =>
    t.ownRank == null ? Number.MAX_SAFE_INTEGER : t.ownRank - t.rank;
  const montee = nom
    ? [...tops].filter(t => t.voisins.length && gain(t) > 0)
               .sort((a, b) => gain(b) - gain(a))[0] || null
    : null;

  /** Ce que ce chrono vaut face au precedent, ou face a rien du tout. */
  const ecart = (t: RaceOutcome) =>
    t.ownMs == null
      ? N.t('os_record_premier')
      : N.t('os_record_gain', { s: ((t.ownMs - t.ms) / 1000).toFixed(2) });

  // Les confettis ne sont pas montes ici : ils appartiennent a l'ecran de fin,
  // qui les garde quand cette fenetre se ferme. Attaches a elle, ils seraient
  // coupes net au bouton CONTINUER ; poses derriere, ils traversent la fete
  // puis retombent sur le menu.
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[56] flex items-center justify-center bg-black/85 backdrop-blur-md
                   pointer-events-auto px-[max(env(safe-area-inset-left),1rem)]
                   pr-[max(env(safe-area-inset-right),1rem)]
                   pt-[max(env(safe-area-inset-top),1rem)]
                   pb-[max(env(safe-area-inset-bottom),1rem)] overflow-y-auto"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      >
        <motion.div
          initial={{ scale: 0.7, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="relative w-full max-w-sm my-auto rounded-3xl border-2 border-primary/60 bg-card/95
                     p-6 md:p-8 court:p-4 flex flex-col items-center gap-2
                     shadow-[0_0_60px_rgba(248,205,74,0.35)]"
        >
          {/* Le halo qui respire : le record doit se voir de loin. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-3xl border-2 border-primary/50 pointer-events-none"
            animate={{ opacity: [0.15, 0.7, 0.15], scale: [1, 1.035, 1] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            initial={{ rotate: -18, scale: 0.5 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.1 }}
          >
            <Trophy className="w-10 h-10 md:w-12 md:h-12 court:w-8 court:h-8 text-primary
                               drop-shadow-[0_0_16px_rgba(248,205,74,0.7)]" />
          </motion.div>

          <h2 className="font-black font-display tracking-tight uppercase text-2xl md:text-3xl court:text-xl
                         text-primary text-center leading-none">
            {N.t(tops.length > 1 ? 'os_record_titre_n' : 'os_record_titre')}
          </h2>

          {/* UNE EPREUVE : LE CHRONO EN GRAND. C'est le cas courant — un one
              shot se court sur une distance — et le nombre qu'on vient
              d'arracher merite d'occuper la moitie de la carte. */}
          {seul ? (
            <>
              <p className="text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground text-center">
                {N.t('os_record_sur', { d: seul.race })}
              </p>
              <div className="font-mono font-black text-5xl md:text-6xl court:text-4xl
                              text-foreground tabular-nums my-1">
                <Compteur vers={seul.ms / 1000} />
                <span className="text-2xl md:text-3xl court:text-xl text-primary"> s</span>
              </div>
              <p className="text-[11px] md:text-xs text-foreground text-center -mt-1">
                {ecart(seul)}
              </p>
              <p className="text-xs md:text-sm font-bold tracking-wide text-primary text-center">
                {N.t('os_record_rang', { r: N.ord(seul.rank) })}
              </p>
            </>
          ) : (
            /* Plusieurs epreuves dans le meme programme : une ligne chacune,
               dans l'ordre couru. Aucune ne passe en grand — les mettre a
               egalite est plus juste que d'en elire une. */
            <div className="flex flex-col gap-2 w-full mt-1">
              {tops.map((t, i) => (
                <div key={'r' + i}
                     className="rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2
                                flex flex-col items-center gap-0.5">
                  <p className="flex items-baseline gap-2">
                    <span className="font-bold tracking-wide text-foreground text-sm">{t.race} m</span>
                    <span className="font-mono font-black text-xl text-foreground tabular-nums">
                      {(t.ms / 1000).toFixed(2)}
                      <span className="text-sm text-primary"> s</span>
                    </span>
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground text-center">
                    {ecart(t)}
                    {' · '}
                    <span className="text-primary font-bold">
                      {N.t('os_record_rang', { r: N.ord(t.rank) })}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* LE DEPLACEMENT, TOUT DE SUITE APRES LE NOMBRE.

              Monte des le premier rendu plutot qu'apparu apres coup : la
              carte garde sa hauteur, et le bouton CONTINUER ne se derobe pas
              sous le doigt une seconde apres qu'on l'a vise. Le trajet, lui,
              attend que le chrono ait fini de defiler. */}
          {montee && (
            <div className="w-full mt-1">
              <MonteeAuClassement
                titre={tops.length > 1 ? `${montee.race} M · ${N.t('top500')}` : N.t('top500')}
                nom={nom}
                rangAvant={montee.ownRank}
                rangApres={montee.rank}
                lignes={montee.voisins}
                delai={0.85}
              />
            </div>
          )}

          {/* CE QUI EST ARRIVE A L'ENVOI, EN UNE LIGNE. Aucune ne demande de
              geste : le nom se pose a l'accueil, un nom pris s'y change, un
              reseau muet se rattrape a la course suivante. */}
          {statut === 'sending' && (
            <p className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/70" />
              {N.t('wr_saving')}
            </p>
          )}
          {statut === 'done' && !!nom && (
            <p className="text-[10px] md:text-xs text-muted-foreground text-center">
              {N.t('os_record_saved', { n: nom })}
            </p>
          )}
          {statut === 'sansnom' && (
            <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
              {N.t('os_record_sansnom')}
            </p>
          )}
          {statut === 'error' && (
            <p className="text-[10px] md:text-xs text-destructive text-center">
              {N.t('score_save_fail')}
            </p>
          )}
          {statut === 'pris' && (
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] md:text-xs text-destructive text-center">
                {N.t('score_name_taken')}
              </p>
              <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
                {N.t('score_taken_help')}
              </p>
            </div>
          )}

          {/* Un seul bouton, large : ce qu'il y a derriere est le menu de fin,
              et on n'a rien a decider ici. */}
          <button
            onClick={onFermer}
            className="w-full mt-2 py-3 court:py-2 rounded-xl font-black font-display tracking-widest
                       text-background bg-primary hover:bg-primary/90 transition-colors"
          >
            {N.t('os_record_suite')}
          </button>
        </motion.div>
      </motion.div>
    </>
  );
}
