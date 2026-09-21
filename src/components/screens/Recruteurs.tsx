import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { Loader2, UserPlus } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { fetchRecruteurs, type TableauRecruteurs } from '@/game/recruteurs';
import { Drapeau } from '@/components/Insignes';
import { useRetour } from '@/hooks/use-retour';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * LE CLASSEMENT DES RECRUTEURS, a cote de celui des chronos.
 *
 * Le meme ecran que les duels — meme fond, meme entete, meme facon de mettre
 * sa propre ligne en avant — parce que c'est le meme geste : on vient s'y
 * chercher. Ce qui change est ce qu'on y lit : non pas qui court le plus vite,
 * mais CONTRE QUI ON COURT LE PLUS.
 *
 * SA RAISON D'ETRE TIENT EN UNE LIGNE. Le classement des chronos ne se gagne
 * que d'une facon, et la plupart des joueurs n'y arriveront pas. Celui-ci se
 * gagne en donnant son code — ce que tout le monde peut faire des la premiere
 * course, et ce que le jeu avait besoin qu'on fasse.
 *
 * MA LIGNE EST LA MEME SI JE NE SUIS PAS DANS LES CINQ CENTS. Le serveur la
 * recalcule pour moi seul (voir `fetchRecruteurs`) : celui qui n'y est pas
 * encore est exactement celui qu'on veut accrocher, et un tableau qui ne lui
 * montre rien ne l'accroche pas.
 */
export function Recruteurs({ onClose }: { onClose: () => void }) {
  // Le glissement depuis le bord gauche fait ce que fait la croix.
  useRetour(onClose);
  const { N } = SprinterApp;
  const moiNom = getSavedName();
  const [tab, setTab] = useState<TableauRecruteurs | null>(null);

  useEffect(() => {
    let vivant = true;
    fetchRecruteurs(moiNom).then(t => { if (vivant) setTab(t); });
    return () => { vivant = false; };
  }, [moiNom]);

  const cle = moiNom.trim().toLowerCase();

  return (
    <motion.div
      {...MONTEE}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col items-center gap-4">

        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserPlus className="w-6 h-6 text-primary shrink-0" aria-hidden />
            <div className="flex flex-col min-w-0">
              <h2 className="font-black font-display tracking-tight text-primary
                             text-xl md:text-2xl leading-tight">
                {N.t('recr_title')}
              </h2>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t('recr_sub')}
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
          {N.t('recr_regle')}
        </p>

        {/* Ma ligne, mise en avant — ou l'invitation quand elle est vide.
            Un zero affiche franchement vaut mieux qu'une absence : il dit
            qu'il y a une place a prendre, ce qu'un tableau muet ne dit pas. */}
        {tab && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/10
                          px-4 py-3 flex items-center justify-between gap-3">
            {tab.moi ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-primary text-lg shrink-0">
                    {tab.moi.rank ? N.ord(tab.moi.rank) : '—'}
                  </span>
                  <span className="font-bold truncate">{tab.moi.name}</span>
                </div>
                <Compte r={tab.moi.recrues} c={tab.moi.courses} fort />
              </>
            ) : (
              <div className="flex flex-col gap-0.5 py-0.5">
                <span className="text-sm font-bold">{N.t('recr_rien')}</span>
                <span className="text-[11px] text-muted-foreground">
                  {N.t('recr_rien_sous')}
                </span>
              </div>
            )}
          </div>
        )}

        {!tab && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          </p>
        )}

        {tab && tab.classement.length === 0 && (
          <p className="text-sm text-muted-foreground py-8">{N.t('recr_vide')}</p>
        )}

        <div className="w-full flex flex-col gap-1">
          {(tab?.classement || []).map(r => {
            const moi = r.name.trim().toLowerCase() === cle;
            return (
              <div
                key={`${r.rank}-${r.name}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border
                  ${moi ? 'bg-primary/10 border-primary/40'
                        : 'bg-card/60 border-white/5'}`}
              >
                <span className={`w-9 shrink-0 text-right font-bold tabular-nums text-sm
                  ${r.rank && r.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {r.rank}
                </span>
                {r.pays ? <Drapeau pays={r.pays} /> : <span className="w-4 shrink-0" />}
                <span className="flex-1 min-w-0 truncate font-semibold text-sm">
                  {r.name}
                </span>
                <Compte r={r.recrues} c={r.courses} />
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Les deux nombres d'une ligne.
 *
 * Les recrues d'abord et en gros : c'est le classement. Les courses dessous,
 * en petit — elles disent qu'un adversaire est revenu, ce qui est une autre
 * histoire et ne doit pas se confondre avec la premiere.
 */
function Compte({ r, c, fort }: { r: number; c: number; fort?: boolean }) {
  const { N } = SprinterApp;
  return (
    <div className="flex flex-col items-end shrink-0 leading-tight">
      <span className={`font-black tabular-nums ${fort ? 'text-primary text-lg' : 'text-base'}`}>
        {r}
        <span className="ml-1 text-[9px] font-bold tracking-wider text-muted-foreground">
          {N.t(r > 1 ? 'recr_recrues' : 'recr_recrue')}
        </span>
      </span>
      {c > r && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {c} {N.t(c > 1 ? 'recr_courses' : 'recr_course')}
        </span>
      )}
    </div>
  );
}
