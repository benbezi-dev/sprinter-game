import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Loader2 } from 'lucide-react';
import {
  fetchRaceBest, submitRaceRecord, fetchLeaderboardRaw,
  rankByRaceTime, rankOf, getSavedName, saveName, type RaceKey,
} from '@/game/leaderboard';
import { LeaderboardScreen } from './LeaderboardScreen';
// Le meme chrono qui defile que sur l'ecran du record personnel.
import { Compteur } from './Compteur';

/** Ecrans qui suivent une course. La cinematique n'en fait pas partie. */
const AFTER_RACE = new Set(['result', 'winall', 'over']);

export function RecordPopup() {
  const { state, player, raceKey } = useGameStore();
  const { N } = SprinterApp;

  const [open, setOpen] = useState(false);
  const [split, setSplit] = useState(0);      // chrono du record, en secondes
  const [prev, setPrev] = useState<number | null>(null);
  const [race, setRace] = useState<RaceKey>('100');
  const [name, setName] = useState(getSavedName());
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [rank, setRank] = useState<number | null>(null);
  const [showTop, setShowTop] = useState(false);

  // Un coureur neuf est cree a chaque course : son identite sert de jeton
  // pour ne verifier qu'une fois par course, sans compteur a maintenir.
  const checked = useRef<unknown>(null);

  useEffect(() => {
    if (!AFTER_RACE.has(state)) return;
    if (!player || checked.current === player) return;
    checked.current = player;

    const t = player.finishTime;
    if (t == null) return;               // abandon : pas de chrono a comparer
    const key = raceKey as RaceKey;
    let cancelled = false;

    fetchRaceBest(key)
      .then(best => {
        if (cancelled) return;
        // Tableau vide : le premier chrono en est forcement le meilleur.
        if (best !== null && t * 1000 >= best) return;
        setSplit(t); setPrev(best); setRace(key);
        const nom = getSavedName();
        setName(nom);
        setStatus('idle'); setRank(null);
        setOpen(true);
        // Nom deja connu : le record part tout seul. C'est souvent la seule
        // occasion de l'enregistrer — en carriere, le chrono d'une etape ne
        // remonte qu'a la fin des six, et un joueur qui s'arrete la perdrait
        // son record mondial.
        if (nom.trim()) envoyer(nom.trim(), key, t);
      })
      .catch(() => { /* classement injoignable : pas de record annonce */ });

    return () => { cancelled = true; };
  }, [state, player, raceKey]);

  const envoyer = async (finalName: string, key: RaceKey, chrono: number) => {
    saveName(finalName);
    setStatus('sending');
    try {
      await submitRaceRecord(key, finalName, chrono * 1000);
      // On relit le tableau pour annoncer une place reellement constatee.
      const list = rankByRaceTime(await fetchLeaderboardRaw(key));
      setRank(rankOf(list, chrono * 1000));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const handleSave = () => {
    const finalName = name.trim();
    if (!finalName) return;
    envoyer(finalName, race, split);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="relative w-full max-w-sm rounded-3xl border-2 border-primary/60 bg-card/95 p-6 md:p-8 flex flex-col items-center gap-3 shadow-[0_0_60px_rgba(248,205,74,0.35)]"
            >
              {/* halo qui respire : le record doit se voir de loin */}
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
                <Trophy className="w-10 h-10 md:w-12 md:h-12 text-primary drop-shadow-[0_0_16px_rgba(248,205,74,0.7)]" />
              </motion.div>

              <h2 className="font-black font-display tracking-tight uppercase text-2xl md:text-3xl text-primary text-center leading-none">
                {N.t('wr_title')}
              </h2>
              <p className="text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground -mt-1 text-center">
                {N.t('wr_sub', { d: race })}
              </p>

              <div className="font-mono font-black text-5xl md:text-6xl text-foreground tabular-nums my-1">
                <Compteur vers={split} /> <span className="text-2xl md:text-3xl text-primary">s</span>
              </div>

              <p className="text-[11px] md:text-xs text-muted-foreground text-center -mt-1">
                {prev === null
                  ? N.t('wr_first')
                  : `${N.t('wr_old', { s: (prev / 1000).toFixed(2) })} · ${N.t('wr_gain', { s: (prev / 1000 - split).toFixed(2) })}`}
              </p>

              {status === 'done' && rank !== null ? (
                <div className="flex flex-col items-center gap-3 w-full mt-2">
                  <p className="text-center text-primary font-bold text-sm md:text-base">
                    {N.t('wr_done', { n: name.trim(), r: N.ord(rank) })}
                  </p>
                  <button
                    onClick={() => setShowTop(true)}
                    className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background bg-primary hover:bg-primary/90 transition-colors"
                  >
                    {N.t('wr_see')}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-[10px] md:text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {N.t('close')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full mt-2">
                  <div className="flex gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                      placeholder={N.t('your_name')}
                      maxLength={20}
                      className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
                    />
                    <button
                      onClick={handleSave}
                      disabled={!name.trim() || status === 'sending'}
                      className="shrink-0 px-4 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                    >
                      {status === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {status === 'sending' ? N.t('wr_saving') : N.t('wr_save')}
                    </button>
                  </div>
                  {status === 'error' && (
                    <p className="text-center text-xs text-destructive">{N.t('wr_fail')}</p>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="text-[10px] md:text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors pt-1"
                  >
                    {N.t('wr_later')}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showTop && (
        <LeaderboardScreen initialRace={race} onClose={() => { setShowTop(false); setOpen(false); }} />
      )}
    </>
  );
}
