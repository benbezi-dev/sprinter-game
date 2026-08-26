import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SprinterApp, buzz, useGameStore } from '@/game/engine';
import {
  fetchLeaderboardRaw, getSavedName, rankByRaceTime, rankOf, saveName,
  submitRaceTime, worldRecord,
  type LeaderboardEntry, type RaceKey,
} from '@/game/leaderboard';
import { setField } from '@/game/olympicField';
import { LeaderboardScreen } from './LeaderboardScreen';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Ecrans de fin de course : c'est la, sur le recapitulatif, que le record
// s'annonce. Pendant la cinematique qui precede, la verification a deja eu
// lieu en fond — le pop-up s'ouvre donc sans attente.
const RECAP = new Set(['result', 'over', 'winall']);

type Pending = {
  race: RaceKey;
  /** chrono du joueur, en millisecondes */
  ms: number;
  /** record precedent de la distance, ou null si le tableau etait vierge */
  previous: LeaderboardEntry | null;
  /** la course enregistree : le record devient affrontable en fantome */
  trace: number[] | null;
};

/**
 * Chrono qui defile jusqu'a sa valeur finale. Un record ne s'affiche pas
 * d'un bloc : on le regarde monter, comme le tableau d'affichage du stade.
 */
function useCountUp(target: number, run: boolean, ms = 900) {
  const [value, setValue] = useState(0);
  // Nouveau chrono : on repart de zero des le rendu, sans quoi l'image qui
  // precede le lancement de l'animation afficherait encore le record
  // precedent.
  const [current, setCurrent] = useState(target);
  if (target !== current) {
    setCurrent(target);
    setValue(run ? 0 : target);
  }
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // sortie amortie : la fin du defilement ralentit sur le chrono exact
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return value;
}

/** Gerbe d'etincelles a l'ouverture : douze traits partant du centre. */
function Sparks() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{
              x: Math.cos(a) * 190,
              y: Math.sin(a) * 130,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 1.1, delay: 0.15 + i * 0.015, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/**
 * Le record du monde de la distance vient de tomber : on l'annonce des la fin
 * de la course, chrono a l'appui, et on propose d'inscrire son nom en tete du
 * TOP 500. Le classement par course ne depend ni du mode ni de la place face
 * aux adversaires : chaque arrivee est un candidat.
 */
export function RecordPopup() {
  const state = useGameStore(s => s.state);
  const raceSeq = useGameStore(s => s.raceSeq);
  const { N } = SprinterApp;

  const [pending, setPending] = useState<Pending | null>(null);
  const [closed, setClosed] = useState(false);
  const [name, setName] = useState(getSavedName);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [rank, setRank] = useState<number | null>(null);
  const [top, setTop] = useState<LeaderboardEntry[] | null>(null);
  const [showTop500, setShowTop500] = useState(false);

  // Une course vient de s'achever : on va comparer son chrono au record du
  // monde de la distance. La requete part pendant la cinematique de fin, le
  // resultat est donc pret quand le recapitulatif s'affiche.
  useEffect(() => {
    if (!raceSeq) return;
    const { lastRaceKey: race, lastRaceTime: time, lastRaceTrace: trace } = SprinterApp.G;
    setPending(null);
    setClosed(false);
    setShowTop500(false);
    setStatus('idle');
    setRank(null);
    setTop(null);
    setName(getSavedName());
    if (time == null) return;   // abandon : pas de chrono, pas de record

    const ms = time * 1000;
    let cancelled = false;
    fetchLeaderboardRaw(race)
      .then(list => {
        if (cancelled) return;
        const previous = worldRecord(list);
        // Il faut faire strictement mieux : egaler le record ne le bat pas.
        if (previous && ms >= previous.best_split_ms) return;
        setPending({ race, ms, previous, trace: trace ? trace.slice() : null });
      })
      // Classement injoignable : on se tait plutot que d'annoncer un record
      // qu'on n'a pas pu verifier.
      .catch(() => { });
    return () => { cancelled = true; };
  }, [raceSeq]);

  // Course suivante lancee (ou retour a l'accueil) : l'annonce n'a plus lieu
  // d'etre, meme si elle n'a jamais ete ouverte.
  useEffect(() => {
    if (state === 'count' || state === 'title' || state === 'open') setPending(null);
  }, [state]);

  const open = !!pending && !closed && RECAP.has(state);

  // Fanfare et vibration a l'ouverture, une seule fois par course.
  const announced = useRef(0);
  useEffect(() => {
    if (!open || announced.current === raceSeq) return;
    announced.current = raceSeq;
    try { SprinterApp.Audio_.sfx('win'); } catch (e) { }
    buzz(40);
  }, [open, raceSeq]);

  // Cible a zero tant que le pop-up n'est pas ouvert : le defilement demarre
  // donc a l'ouverture, jamais sur le chrono deja affiche.
  const shown = useCountUp(open && pending ? pending.ms / 1000 : 0, open);

  const handleClaim = async () => {
    if (!pending) return;
    const finalName = name.trim();
    if (!finalName) return;
    saveName(finalName);
    setStatus('sending');
    try {
      const res = await submitRaceTime(pending.race, finalName, pending.ms, pending.trace);
      const list = rankByRaceTime(res.entries || []);
      // Le joueur vient de prendre la tete du TOP 500 : il alignera donc les
      // Jeux olympiques de cette distance des la prochaine course.
      setField(pending.race, res.entries || []);
      const mine = res.best_split_ms || pending.ms;
      setRank(rankOf(list, mine));
      setTop(list.slice(0, 5));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (showTop500 && pending) {
    return <LeaderboardScreen initialRace={pending.race} onClose={() => setShowTop500(false)} />;
  }

  const previous = pending?.previous || null;
  const gain = pending && previous ? (previous.best_split_ms - pending.ms) / 1000 : 0;

  return (
    <AnimatePresence>
      {open && pending && (
        <motion.div
          key="record"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          {/* halo qui respire derriere la carte */}
          <motion.div
            className="pointer-events-none absolute w-[36rem] h-[36rem] max-w-[150vw] max-h-[150vw] rounded-full bg-[radial-gradient(circle,rgba(248,205,74,0.22),transparent_65%)]"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.9, 1.06, 0.9], opacity: 1 }}
            transition={{ scale: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.5 } }}
          />

          <motion.div
            initial={{ scale: 0.82, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative w-full max-w-md my-auto flex flex-col gap-3 md:gap-4 short:gap-2 rounded-3xl border border-primary/40 bg-card/90 p-4 md:p-6 short:p-3 shadow-[0_0_60px_rgba(248,205,74,0.25)]"
          >
            <Sparks />

            <button
              onClick={() => setClosed(true)}
              aria-label={N.t('close')}
              className="absolute right-3 top-3 p-2 rounded-xl bg-black/40 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <img src={`${BASE}/icons/cross.png`} alt="" className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* titre */}
            <div className="flex flex-col items-center text-center gap-1 pt-2 short:pt-0">
              <motion.img
                src={`${BASE}/icons/medal1.png`}
                alt=""
                className="w-10 h-10 md:w-12 md:h-12 short:hidden"
                initial={{ rotate: -25, scale: 0 }}
                animate={{ rotate: [-8, 8, -8], scale: 1 }}
                transition={{ scale: { type: 'spring', stiffness: 300, damping: 12 }, rotate: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } }}
              />
              <motion.h2
                className="font-black font-display uppercase tracking-tight text-primary text-2xl sm:text-3xl short:text-xl leading-tight"
                animate={{ textShadow: [
                  '0 0 12px rgba(248,205,74,0.35)',
                  '0 0 26px rgba(248,205,74,0.75)',
                  '0 0 12px rgba(248,205,74,0.35)',
                ] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {N.t(previous ? 'wr_title' : 'wr_first')}
              </motion.h2>
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase">
                {N.t('wr_race', { r: SprinterApp.RACES[pending.race].label })}
              </span>
            </div>

            {/* le chrono, au centre de l'annonce */}
            <div className="flex flex-col items-center gap-1 py-1">
              <motion.div
                className="font-mono font-black text-5xl sm:text-6xl short:text-4xl text-white tabular-nums drop-shadow-[0_0_25px_rgba(248,205,74,0.45)]"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ delay: 0.9, duration: 0.45 }}
              >
                {shown.toFixed(2)}<span className="text-2xl sm:text-3xl text-primary ml-1">s</span>
              </motion.div>

              {previous ? (
                <>
                  <span className="text-[11px] md:text-xs text-muted-foreground line-through decoration-destructive/70">
                    {N.t('wr_old', {
                      s: (previous.best_split_ms / 1000).toFixed(2),
                      n: previous.name,
                    })}
                  </span>
                  <motion.span
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] md:text-xs font-bold tracking-widest text-emerald-300 uppercase"
                  >
                    {N.t('wr_gain', { s: gain.toFixed(2) })}
                  </motion.span>
                </>
              ) : (
                <span className="text-[11px] md:text-xs text-muted-foreground">{N.t('wr_none')}</span>
              )}
            </div>

            {/* inscription du nom */}
            {status !== 'done' && (
              <div className="flex flex-col gap-2">
                <span className="text-center text-[11px] md:text-xs font-bold tracking-widest text-primary uppercase">
                  {N.t('wr_ask_name')}
                </span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleClaim(); }}
                  placeholder={N.t('your_name')}
                  maxLength={20}
                  disabled={status === 'sending'}
                  className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 short:py-1.5 text-center text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
                />
                <button
                  onClick={handleClaim}
                  disabled={!name.trim() || status === 'sending'}
                  className="w-full py-3 short:py-2 rounded-xl font-black font-display tracking-widest text-base md:text-lg text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
                >
                  {status === 'sending' ? N.t('saving_score') : N.t('wr_claim')}
                </button>
                {status === 'error' && (
                  <span className="text-center text-xs text-destructive">{N.t('score_save_fail')}</span>
                )}
              </div>
            )}

            {/* nom inscrit : on montre sa ligne dans le TOP 500 */}
            {status === 'done' && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col gap-2"
              >
                <span className="text-center text-[11px] md:text-xs font-bold tracking-widest text-primary uppercase">
                  {rank === 1
                    ? N.t('wr_holder')
                    : N.t('wr_ranked', { r: N.ord(rank || 1) })}
                </span>
                {rank !== null && rank > 1 && (
                  <span className="text-center text-[10px] md:text-xs text-muted-foreground">
                    {N.t('wr_beaten')}
                  </span>
                )}

                <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-2">
                  {(top || []).map((e, i) => {
                    const isMe = i + 1 === rank;
                    return (
                      <motion.div
                        key={i}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.06 * i }}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${isMe ? 'bg-primary/20 border-primary/50' : 'border-white/5 bg-black/20'}`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden pr-2">
                          <span className={`font-bold w-6 shrink-0 text-xs ${i === 0 ? 'text-primary' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {i + 1}.
                          </span>
                          <span className={`font-bold tracking-wide truncate text-xs md:text-sm ${isMe ? 'text-primary' : 'text-foreground'}`}>
                            {e.name}
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-xs md:text-sm shrink-0 ${isMe ? 'text-primary' : 'text-foreground'}`}>
                          {(e.best_split_ms / 1000).toFixed(2)} s
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Faute de frappe sur le nom : on peut revenir a la saisie,
                    le chrono est deja au tableau. */}
                <button
                  onClick={() => setStatus('idle')}
                  className="self-center text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                >
                  {N.t('edit_name')}
                </button>
              </motion.div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowTop500(true)}
                className="flex-1 py-2.5 rounded-xl font-bold tracking-widest text-[11px] md:text-xs text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
              >
                {N.t('view_top500')}
              </button>
              <button
                onClick={() => setClosed(true)}
                className="flex-1 py-2.5 rounded-xl font-bold tracking-widest text-[11px] md:text-xs text-muted-foreground bg-black/40 border border-white/10 hover:text-foreground hover:bg-white/5 transition-colors"
              >
                {N.t('close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
