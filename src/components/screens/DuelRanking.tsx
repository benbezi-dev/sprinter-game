import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { fetchDuels, type DuelBoard, type DuelRow } from '@/game/duels';
import { getSavedName } from '@/game/leaderboard';
import { Drapeau, Medaille } from '@/components/Insignes';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Fleche de deplacement depuis la derniere visite. */
function Mouvement({ move }: { move: number }) {
  if (!move) return <span className="w-8 shrink-0" />;
  const monte = move > 0;
  return (
    <motion.span
      initial={{ opacity: 0, y: monte ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-8 shrink-0 flex items-center justify-center gap-0.5 text-[10px] font-bold
        ${monte ? 'text-emerald-400' : 'text-destructive'}`}
    >
      {monte ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(move)}
    </motion.span>
  );
}

export function DuelRanking({ onClose }: { onClose: () => void }) {
  const { N } = SprinterApp;
  const [board, setBoard] = useState<DuelBoard | null>(null);
  const [chargement, setChargement] = useState(true);
  const moiKey = (getSavedName() || '').trim().toLowerCase();

  useEffect(() => {
    let annule = false;
    fetchDuels().then(b => { if (!annule) { setBoard(b); setChargement(false); } });
    // Le classement bouge pendant qu'on le regarde : on rafraichit sans
    // remettre le repere de visite, sinon les fleches s'effaceraient seules.
    const id = setInterval(() => {
      fetchDuels(false).then(b => { if (!annule && b) setBoard(b); });
    }, 20000);
    return () => { annule = true; clearInterval(id); };
  }, []);

  const rows = board?.classement || [];
  const bareme = board?.bareme;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center
                    pointer-events-auto overflow-y-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center py-6 md:py-8 gap-4">

        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <h2 className="font-black font-display tracking-tight text-primary text-xl md:text-2xl leading-tight">
                {N.t('duel_title')}
              </h2>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t('duel_sub')}
              </span>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {/* Deux baremes, parce que les deux roles ne courent pas le meme
            risque. Les afficher cote a cote est la seule facon de rendre la
            regle lisible d'un coup d'oeil. */}
        {bareme && (
          <div className="w-full flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-2">
              {([['duel_rules_init', bareme.initie, 'text-cyan-300 border-cyan-400/30 bg-cyan-400/[0.06]'],
                 ['duel_rules_recv', bareme.recu, 'text-primary border-primary/30 bg-primary/[0.07]']] as const)
                .map(([cle, b, style]) => (
                <div key={cle} className={`rounded-xl border px-3 py-2 flex flex-col items-center gap-0.5 ${style}`}>
                  <span className="text-[9px] md:text-[10px] font-bold tracking-widest">
                    {N.t(cle)}
                  </span>
                  <span className="font-mono text-[10px] md:text-xs text-foreground/85 text-center">
                    {N.t('duel_rules_line', {
                      v: b.victoire > 0 ? `+${b.victoire}` : b.victoire,
                      d: b.defaite,
                      n: b.nul,
                    })}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[9px] md:text-[10px] text-muted-foreground/70 text-center leading-snug">
              {N.t('duel_rules_all')} — {N.t('duel_rules_why')}
            </span>
          </div>
        )}

        {/* Ma position, mise en avant */}
        {board?.moi && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3
                          flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-black text-primary text-lg">{N.ord(board.moi.rank)}</span>
              <span className="font-bold text-primary truncate">{N.t('duel_you')}</span>
            </div>
            {/* Ni total ni gain : seule la place compte, et le mouvement la
                raconte. */}
            <div className="flex items-center gap-2 shrink-0">
              <Mouvement move={board.moi.move || 0} />
            </div>
          </div>
        )}
        {!chargement && !board?.moi && (
          <div className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-center">
            <span className="text-[10px] md:text-xs text-muted-foreground">{N.t('duel_unranked')}</span>
          </div>
        )}

        <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl">
          {chargement && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> {N.t('loading_ranks')}
            </p>
          )}
          {!chargement && rows.length === 0 && (
            <div className="py-8 flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground text-center">{N.t('duel_empty')}</p>
              <p className="text-[10px] text-muted-foreground/70 text-center">{N.t('duel_must')}</p>
            </div>
          )}
          {!chargement && rows.length > 0 && (
            <>
              <div className="flex items-baseline justify-between px-1 pb-2 mb-1 border-b border-white/10">
                <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground">
                  {rows.length} {rows.length > 1 ? 'joueurs' : 'joueur'}
                </span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground/70">
                  {N.t('duel_since')}
                </span>
              </div>
              {/* layout anime : une ligne qui change de rang glisse a sa place */}
              <div className="flex flex-col gap-1.5 max-h-[calc(100dvh-24rem)] min-h-[36vh] overflow-y-auto overscroll-contain pr-1">
                <AnimatePresence initial={false}>
                  {rows.map((r: DuelRow) => {
                    const moi = r.name.trim().toLowerCase() === moiKey;
                    return (
                      <motion.div
                        key={r.name.toLowerCase()}
                        layout
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border
                          ${moi ? 'bg-primary/15 border-primary/40' : 'border-white/5 bg-black/20'}`}
                      >
                        <span className={`font-bold w-6 md:w-8 shrink-0 text-xs md:text-sm
                          ${r.rank === 1 ? 'text-primary' : r.rank === 2 ? 'text-slate-300'
                            : r.rank === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {r.rank}.
                        </span>
                        <Mouvement move={r.move || 0} />
                        {/* Le pseudo occupe sa ligne entiere. La medaille est
                            passee en dessous, avec le bilan : mise a cote du
                            nom elle le faisait tronquer, et c'est le nom qu'on
                            vient lire. */}
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Drapeau pays={r.pays} className="text-[13px]" />
                            <span className={`font-bold tracking-wide truncate text-xs md:text-sm
                              ${moi ? 'text-primary' : 'text-foreground'}`}>
                              {r.name}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Medaille m={r.medaille} />
                            <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                              {N.t('duel_record', { v: r.wins, d: r.losses, n: r.draws })}
                              {' · '}
                              {N.t('duel_counts', { l: r.launched || 0, r: r.received || 0 })}
                            </span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
