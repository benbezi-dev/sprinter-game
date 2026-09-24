import React from 'react';
import { motion } from 'motion/react';
import { MONTEE, retarde } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { nomDiscipline } from '@/game/duels';
import type { FicheAthlete, LignePalmares } from '@/game/fiches-champ';
import { COULEURS_MEDAILLE, nomDuRang, teinteDuRang } from '@/components/Insignes';

/**
 * LA FICHE D'UN ATHLETE, PENDANT SA PRESENTATION.
 *
 * Sous le nom et le couloir, ce qu'un speaker de meeting dit de lui avant de
 * passer au suivant : s'il defend un titre, a quel niveau il se bat en duel,
 * son bilan — victoires, defaites, nuls —, et ce qu'il a deja gagne.
 *
 * C'est un habillage de television, pas un tableau : les lignes tombent
 * l'une apres l'autre, et toutes sont a l'ecran avant la premiere seconde.
 * Un creneau en dure trois ; une fiche encore en train d'arriver a la moitie
 * serait une fiche qu'on n'a pas le temps de lire.
 *
 * Le palmares ne s'affiche que s'il existe. « Aucune medaille » sous le nom
 * d'un athlete qu'on presente, c'est le presenter par ce qui lui manque ; le
 * niveau et le bilan, eux, se montrent toujours — un bilan vierge est une
 * information, celle d'un premier championnat.
 *
 * Partagee par les deux presentations, celle du direct (PresentationDirect)
 * et celle de la retransmission (RejeuChampionnat) : un athlete doit etre
 * annonce de la meme facon qu'on regarde sa course en direct ou apres coup.
 */

const OR = '#F8CD4A';

/** L'instant ou la premiere ligne tombe : juste apres le nom. */
const DEPART = 0.18;
/** Le pas entre deux lignes. */
const PAS = 0.14;
/**
 * Au-dela, « +2 ». Trois lignes de palmares se lisent pendant qu'un athlete
 * leve les bras ; six ne se lisent plus, elles se survolent.
 */
const PALMARES_MAX = 3;

/** Le pluriel de chaque langue : « 0 victoire », mais « 0 wins ». */
function pluriel(n: number): boolean {
  return SprinterApp.N.getLang() === 'en' ? n !== 1 : n > 1;
}

function Chiffre({ n, cle, teinte }: { n: number; cle: string; teinte: string }) {
  const { N } = SprinterApp;
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className={`font-display font-black text-2xl md:text-3xl leading-none tabular-nums ${teinte}`}>
        {n}
      </span>
      <span className="mt-1 text-[8px] md:text-[9px] tracking-[0.2em] font-bold text-white/55
                       uppercase whitespace-nowrap">
        {N.t(pluriel(n) ? cle + '_pl' : cle)}
      </span>
    </div>
  );
}

const COULEUR_MOT = ['nations_or', 'nations_argent', 'nations_bronze'];

/**
 * Une ligne du palmares : la couleur, la competition, la distance, le nombre.
 *
 * La couleur n'est jamais seule — le mot « or » l'accompagne, comme le nom de
 * l'etage accompagne la teinte de l'ecusson. Le sigle de la zone est son nom
 * entier : a cette taille, « FRANCE » tient, et « FRA » ferait un code.
 */
function LigneDePalmares({ l }: { l: LignePalmares }) {
  const { N } = SprinterApp;
  const i = Math.min(2, Math.max(0, l.place - 1));
  const c = COULEURS_MEDAILLE[i];
  const zone = l.echelon === 'mondial' ? N.t('fiche_monde')
    : (N.getLang() === 'en' ? l.zoneNomEn || l.zoneNom : l.zoneNom);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border
                     text-[10px] font-bold tracking-widest uppercase whitespace-nowrap"
          style={{ color: c, borderColor: c + '55', backgroundColor: c + '1f' }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
      <span>{N.t(COULEUR_MOT[i])}</span>
      <span className="text-white/85">{zone}</span>
      <span className="opacity-70">{l.epreuve} M</span>
      {l.n > 1 && <span className="tabular-nums">×{l.n}</span>}
    </span>
  );
}

export function FichePresentation({ fiche, epreuve }: {
  /** `undefined` tant qu'elle n'est pas arrivee, `null` s'il n'y en a pas. */
  fiche: FicheAthlete | null | undefined;
  /** La distance de l'edition : c'est sur elle que le niveau se lit. */
  epreuve: string;
}) {
  const { N } = SprinterApp;
  if (!fiche) return null;
  const { niveau, bilan, palmares } = fiche;
  const montrees = palmares.slice(0, PALMARES_MAX);
  const reste = palmares.length - montrees.length;
  let rang = 0;
  const tombe = () => retarde(MONTEE, DEPART + PAS * rang++);

  return (
    <div className="w-full max-w-sm md:max-w-md flex flex-col items-stretch gap-1.5 mt-1">
      {fiche.tenant && (
        <motion.span {...tombe()}
          className="self-center px-3 py-0.5 rounded-sm text-[10px] font-black tracking-[0.3em]
                     uppercase text-black shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
          style={{ background: OR }}>
          {N.t('champ_boss')}
        </motion.span>
      )}

      {/* LE NIVEAU ET LE BILAN, dans le meme cadre : ils parlent du meme
          classement, celui des duels sur la distance de l'edition. */}
      <motion.div {...tombe()}
        className="rounded-lg border border-white/15 bg-black/60 backdrop-blur-sm
                   shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/10">
          <span className="text-[9px] tracking-[0.25em] text-white/55 font-bold uppercase truncate">
            {N.t('fiche_niveau')} · {nomDiscipline(epreuve)}
          </span>
          {niveau ? (
            <span className={`shrink-0 px-2 py-0.5 rounded-md border font-mono text-[11px] md:text-xs
                              font-bold tracking-wider ${teinteDuRang(niveau.etage)}`}>
              {nomDuRang(niveau.etage, niveau.division)}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] font-bold tracking-wider text-white/45">
              {N.t('fiche_non_classe')}
            </span>
          )}
        </div>
        {/* Dans l'ordre ou l'on compte un bilan : victoires, defaites, nuls. */}
        <div className="grid grid-cols-3 gap-2 px-3 py-2">
          <Chiffre n={bilan.v} cle="fiche_v" teinte="text-emerald-300" />
          <Chiffre n={bilan.d} cle="fiche_d" teinte="text-rose-300" />
          <Chiffre n={bilan.n} cle="fiche_n" teinte="text-white/85" />
        </div>
      </motion.div>

      {montrees.length > 0 && (
        <motion.div {...tombe()}
          className="rounded-lg border bg-black/60 backdrop-blur-sm px-3 py-2
                     flex flex-col items-center gap-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          style={{ borderColor: OR + '40' }}>
          <span className="text-[9px] tracking-[0.35em] font-black uppercase" style={{ color: OR }}>
            {N.t('fiche_palmares')}
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {montrees.map(l => (
              <LigneDePalmares key={`${l.echelon}-${l.zone}-${l.epreuve}-${l.place}`} l={l} />
            ))}
            {reste > 0 && (
              <span className="self-center text-[10px] font-bold tracking-widest text-white/50">
                +{reste}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
