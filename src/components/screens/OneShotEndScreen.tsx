import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { Ghost, Loader2, Copy, Check } from 'lucide-react';
import { getSavedName, saveName } from '@/game/leaderboard';
import { createChallenge, submitAttempt, challengeLink } from '@/game/challenge';

/** Chrono ou abandon, sans jamais appeler toFixed sur un null. */
function fmt(v: number | null | undefined, dnf: string) {
  return v == null ? dnf : `${v.toFixed(2)} s`;
}

export function OneShotEndScreen() {
  const { runTime, runSplits, shotRaces, ghostName, ghostTime, challenge } = useGameStore();
  const { N, RACES } = SprinterApp;

  const [name, setName] = useState(getSavedName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [sent, setSent] = useState(false);
  const submitted = useRef(false);

  const ghostSplits: number[] = (SprinterApp.G.ghostSplits || []) as number[];
  const complete = runSplits.length === shotRaces.length && runSplits.every(s => s != null);
  const beaten = !!challenge && complete && runTime < ghostTime;

  // Defi en cours : on envoie le chrono une seule fois, des l'arrivee.
  useEffect(() => {
    if (!challenge || submitted.current || !complete) return;
    submitted.current = true;
    submitAttempt({
      id: challenge.id,
      totalMs: runTime * 1000,
      splits: runSplits.map(s => (s || 0) * 1000),
      name: getSavedName() || undefined,
    }).then(() => setSent(true)).catch(() => { /* le chrono local reste affiche */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const finalName = name.trim();
    if (finalName) saveName(finalName);
    setBusy(true); setErr(false);
    try {
      const id = await createChallenge({
        races: shotRaces as ('100' | '200' | '400')[],
        levelIdx: SprinterApp.G.shotLevel,
        totalMs: runTime * 1000,
        splits: runSplits.map(s => (s || 0) * 1000),
        traces: SprinterApp.G.shotTraces || [],
        name: finalName || undefined,
      });
      setCode(id);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  // Le code se dicte, le lien s'envoie : les deux servent, on propose les deux.
  const handleCopy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : challengeLink(code));
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // presse-papiers refuse : le code reste lisible et recopiable a la main
    }
  };

  const handleReplay = () => {
    SprinterApp.startOneShot(shotRaces, {
      levelIdx: SprinterApp.G.shotLevel,
      ghosts: SprinterApp.G.ghostSet,
      ghostSplits,
      ghostName,
      ghostTime,
      challenge,
    });
  };

  const dnf = N.t('dnf_short');

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-md overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-2xl w-full py-6 md:py-8 gap-4 md:gap-6">

          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            <h1 className={`text-3xl sm:text-4xl md:text-6xl font-black font-display tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(248,205,74,0.35)]
              ${challenge ? (beaten ? 'text-primary' : 'text-destructive') : 'text-primary'}`}>
              {challenge ? N.t(beaten ? 'challenge_won' : 'challenge_lost') : N.t('oneshot_done')}
            </h1>
            <div className="text-[10px] sm:text-xs md:text-base font-medium text-foreground/80 tracking-widest uppercase">
              {N.t('total_in')}<span className="text-white font-bold ml-1 md:ml-2">{runTime.toFixed(2)} s</span>
            </div>
            {challenge && (
              <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest text-cyan-300 uppercase">
                {N.t('challenge_gap', { s: (Math.abs(runTime - ghostTime)).toFixed(2) })}
              </div>
            )}
          </div>

          {/* Chronos epreuve par epreuve, face au fantome si defi */}
          <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-8 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-3">
              {shotRaces.map((r, i) => {
                const mine = runSplits[i];
                const his = challenge ? ghostSplits[i] : undefined;
                const ahead = mine != null && his != null && mine < his;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border border-white/5 bg-black/20 gap-2">
                    <span className="font-bold tracking-wide text-foreground text-sm md:text-base truncate">
                      {RACES[r].label}
                    </span>
                    <div className="flex items-center gap-3 md:gap-5 shrink-0">
                      {his != null && (
                        <span className="font-mono text-xs md:text-sm text-cyan-300/70">
                          {his.toFixed(2)} s
                        </span>
                      )}
                      <span className={`font-mono font-bold text-base md:text-lg
                        ${mine == null ? 'text-destructive' : his == null ? 'text-primary' : ahead ? 'text-emerald-400' : 'text-destructive'}`}>
                        {fmt(mine, dnf)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center px-2 md:px-4 gap-2">
              <span className="font-bold tracking-widest text-foreground uppercase text-sm md:text-base">
                {challenge ? N.t('you_label') : 'TOTAL'}
              </span>
              <span className="font-mono font-black text-xl md:text-2xl text-primary">{runTime.toFixed(2)} s</span>
            </div>
            {challenge && (
              <div className="flex justify-between items-center px-2 md:px-4 gap-2 mt-1">
                <span className="font-bold tracking-widest text-cyan-300 uppercase text-sm md:text-base truncate flex items-center gap-2">
                  <Ghost className="w-4 h-4 shrink-0" />{ghostName || N.t('ghost_label')}
                </span>
                <span className="font-mono font-black text-xl md:text-2xl text-cyan-300">{ghostTime.toFixed(2)} s</span>
              </div>
            )}
          </div>

          {/* Creer un defi a partir de cette course. Hors defi c'est le
              partage normal ; apres un defi gagne c'est la revanche, qu'on
              renvoie a l'adversaire. */}
          {(!challenge || beaten) && (
            <div className={`w-full bg-card/60 border rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl flex flex-col gap-3
              ${beaten ? 'border-primary/40' : 'border-white/10'}`}>
              <div className="flex items-center gap-2 justify-center">
                <Ghost className="w-4 h-4 text-primary" />
                <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">
                  {N.t(beaten ? 'challenge_rematch' : 'challenge_make')}
                </h2>
              </div>

              {!code && (
                <>
                  <p className="text-center text-[10px] md:text-xs text-muted-foreground">
                    {N.t(beaten ? 'challenge_rematch_sub' : 'challenge_share')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={N.t('your_name')}
                      maxLength={20}
                      className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={handleCreate}
                      disabled={busy || !complete}
                      className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {busy ? N.t('challenge_making') : N.t(beaten ? 'challenge_rematch' : 'challenge_make')}
                    </button>
                  </div>
                  {err && <p className="text-center text-xs text-destructive">{N.t('challenge_net')}</p>}
                </>
              )}

              {code && (
                <div className="flex flex-col items-center gap-2">
                  <div className="font-mono font-black text-3xl md:text-4xl tracking-[0.35em] text-primary pl-[0.35em]">
                    {code}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => handleCopy('code')}
                      className="px-4 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-2"
                    >
                      {copied === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === 'code' ? N.t('code_copied') : N.t('challenge_copy_code')}
                    </button>
                    <button
                      onClick={() => handleCopy('link')}
                      className="px-4 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-2"
                    >
                      {copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === 'link' ? N.t('challenge_copied') : N.t('challenge_copy')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {challenge && sent && (
            <p className="text-[10px] md:text-xs text-muted-foreground tracking-wide">
              {N.t('challenge_from', { n: challenge.owner_name })} &middot; {challenge.id}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-md mt-2">
            <button onClick={handleReplay} className="flex-1 py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
              {N.t('replay')}
            </button>
            <button onClick={() => SprinterApp.goHome()} className="flex-1 py-3 md:py-4 rounded-xl font-bold tracking-widest text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1">
              {N.t('home')}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
