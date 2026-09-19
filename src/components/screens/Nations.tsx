import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { Loader2, Globe2, ChevronUp, ChevronDown } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { fetchNations, medianeDite, ecartDit, type TableauNations, type LigneNation }
  from '@/game/nations';
import { Drapeau } from '@/components/Insignes';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * LE CLASSEMENT DES NATIONS, l'ecran ou l'on ne peut pas gagner seul.
 *
 * Les autres tableaux du jeu classent des personnes. Celui-ci classe des PAYS,
 * et c'est ce qui en fait autre chose qu'un classement de plus : on n'y monte
 * pas en courant plus vite, on y monte en etant plus nombreux a courir vite.
 * Un joueur qui veut voir son drapeau remonter a une raison d'en faire venir
 * d'autres.
 *
 * LA MEDIANE, PAS LE RECORD. Un classement au record se decide a une personne
 * pres. La mediane des cinquante meilleurs mesure la profondeur d'un pays, et
 * une mediane ne bouge pas a une personne pres — c'est ce qui en fait un sujet
 * collectif. L'effectif est affiche ligne par ligne, parce qu'a mediane egale
 * un pays de cinquante et un pays de six n'ont pas gagne la meme chose.
 *
 * MON DRAPEAU EST LA MEME S'IL N'EST PAS CLASSE. Un joueur d'un pays de trois
 * personnes qui ne trouve pas son drapeau en conclut que le tableau ne le
 * concerne pas. Lui ecrire « il manque deux joueurs » est exactement le
 * message qui fait envoyer un code — et c'est ce qui transforme un tableau en
 * levier.
 */
export function Nations({ onClose }: { onClose: () => void }) {
  const { N } = SprinterApp;
  const fr = N.getLang() === 'fr';
  const moiNom = getSavedName();
  const [tab, setTab] = useState<TableauNations | null>(null);

  useEffect(() => {
    let vivant = true;
    fetchNations({ nom: moiNom }).then(t => { if (vivant) setTab(t); });
    return () => { vivant = false; };
  }, [moiNom]);

  const mien = tab?.moi?.pays || '';

  return (
    <motion.div
      {...MONTEE}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col items-center gap-4">

        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe2 className="w-6 h-6 text-primary shrink-0" aria-hidden />
            <div className="flex flex-col min-w-0">
              <h2 className="font-black font-display tracking-tight text-primary
                             text-xl md:text-2xl leading-tight">
                {N.t('nat_title')}
              </h2>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t('nat_sub')}
              </span>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl bg-card/80 border border-white/10
                             hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        <p className="w-full text-[9px] md:text-[10px] text-muted-foreground/80
                      text-center leading-snug px-2">
          {N.t('nat_regle').replace('{n}', String(tab?.top ?? 50))}
        </p>

        {/* Mon pays, mis en avant — ou ce qu'il lui manque pour y entrer. */}
        {tab && tab.moi && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/10
                          px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-black text-primary text-lg shrink-0">
                {tab.moi.rang ? N.ord(tab.moi.rang) : '—'}
              </span>
              <Drapeau pays={tab.moi.pays} className="text-xl" />
              <span className="font-bold truncate">{tab.moi.nom}</span>
            </div>
            {tab.moi.rang ? (
              <div className="flex flex-col items-end shrink-0 leading-tight">
                <span className="font-black tabular-nums text-primary text-lg">
                  {medianeDite(tab.moi.median, fr)}
                </span>
                {tab.moi.ecart > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {ecartDit(tab.moi.ecart, fr)} {N.t('nat_sur_tete')}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground text-right shrink-0">
                {N.t(tab.moi.manque > 1 ? 'nat_manque' : 'nat_manque_un')
                  .replace('{n}', String(tab.moi.manque))}
              </span>
            )}
          </div>
        )}

        {!tab && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          </p>
        )}

        {tab && tab.classement.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center px-6">
            {N.t('nat_vide').replace('{n}', String(tab.minJoueurs))}
          </p>
        )}

        <div className="w-full flex flex-col gap-1">
          {(tab?.classement || []).map(l => (
            <Ligne key={l.pays} l={l} fr={fr} moi={l.pays === mien} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Une nation.
 *
 * La fleche ne s'affiche que s'il y a quelque chose a dire : un « 0 » a cote
 * d'un rang pose la question « pourquoi il est la ? » a chaque lecteur, et la
 * premiere semaine il n'y a rien a comparer du tout.
 */
function Ligne({ l, fr, moi }: { l: LigneNation; fr: boolean; moi: boolean }) {
  const { N } = SprinterApp;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border
      ${moi ? 'bg-primary/10 border-primary/40' : 'bg-card/60 border-white/5'}`}>
      <span className={`w-9 shrink-0 text-right font-bold tabular-nums text-sm
        ${l.rang <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
        {l.rang}
      </span>
      <Drapeau pays={l.pays} className="text-lg" />
      <span className="flex-1 min-w-0 truncate font-semibold text-sm">{l.nom}</span>

      {l.mouvement !== null && l.mouvement !== 0 && (
        <span className={`flex items-center text-[10px] font-bold tabular-nums shrink-0
          ${l.mouvement > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {l.mouvement > 0
            ? <ChevronUp className="w-3 h-3" aria-hidden />
            : <ChevronDown className="w-3 h-3" aria-hidden />}
          {Math.abs(l.mouvement)}
        </span>
      )}

      <div className="flex flex-col items-end shrink-0 leading-tight">
        <span className="font-black tabular-nums text-base">{medianeDite(l.median, fr)}</span>
        {/* L'effectif n'est pas decoratif : a mediane egale, un pays de
            cinquante et un pays de six n'ont pas gagne la meme chose. */}
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {l.joueurs} {N.t(l.joueurs > 1 ? 'nat_joueurs' : 'nat_joueur')}
        </span>
      </div>
    </div>
  );
}
