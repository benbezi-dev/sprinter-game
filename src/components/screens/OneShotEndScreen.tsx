import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { Ghost, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2, Globe2 } from 'lucide-react';
import {
  getSavedName, saveName, qualifyingRaces, submitRaceRecord,
  type RaceKey, type RaceOutcome,
} from '@/game/leaderboard';
import { primeTopNames } from '@/game/engine';
import {
  createChallenge, submitAttempt, challengeLink,
  shareText, whatsappUrl, smsUrl, canNativeShare, nativeShare,
} from '@/game/challenge';

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

  // Les chronos d'un one shot ou d'un defi valent ceux de la carriere : un
  // 100 m reste un 100 m. On les propose donc au TOP 500, epreuve par epreuve
  // dans la categorie PAR COURSE, et seulement ceux qui y entrent vraiment.
  const [outcomes, setOutcomes] = useState<RaceOutcome[] | null>(null);
  const [topName, setTopName] = useState(getSavedName());
  const [topStatus, setTopStatus] = useState<'checking' | 'idle' | 'sending' | 'done' | 'error'>('checking');

  useEffect(() => {
    let cancelled = false;
    qualifyingRaces(shotRaces as RaceKey[], runSplits)
      .then(list => {
        if (cancelled) return;
        setOutcomes(list);
        setTopStatus(list.some(o => o.beatsOwn) ? 'idle' : 'done');
      })
      .catch(() => { if (!cancelled) { setOutcomes([]); setTopStatus('error'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seuls les chronos qui ameliorent le record personnel sont envoyes : le
  // serveur ecarterait les autres de toute facon.
  const tops = (outcomes || []).filter(o => o.beatsOwn);
  const kept = (outcomes || []).filter(o => !o.beatsOwn);

  const handleSaveTop = async () => {
    const finalName = topName.trim();
    if (!finalName || !tops.length) return;
    saveName(finalName);
    setTopStatus('sending');
    try {
      for (const t of tops) await submitRaceRecord(t.race, finalName, t.ms);
      primeTopNames();          // le plateau olympique se met a jour
      setTopStatus('done');
    } catch {
      setTopStatus('error');
    }
  };

  // Message envoye a l'ami : chrono realise, code, lien direct.
  const msg = code ? shareText(code, shotRaces, runTime * 1000, N.getLang() === 'fr') : '';

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
            {/* Titre en trois mots : tracking-tighter les collait en un seul
                bloc. On respire un peu et on garde le mot entier soude. */}
            <h1 className={`text-3xl sm:text-4xl md:text-6xl font-black font-display tracking-tight uppercase text-balance drop-shadow-[0_0_30px_rgba(248,205,74,0.35)]
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

          {/* Inscription au TOP 500, epreuve par epreuve */}
          {(topStatus === 'checking' || (outcomes && outcomes.length > 0)) && (
            <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 justify-center">
                <Globe2 className="w-4 h-4 text-primary" />
                <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">{N.t('top500')}</h2>
              </div>

              {topStatus === 'checking' && (
                <p className="text-center text-xs text-muted-foreground animate-pulse">
                  {N.t('os_top_checking')}
                </p>
              )}

              {outcomes && outcomes.length > 0 && (
                <>
                  {tops.length > 0 && (
                    <p className="text-center text-[10px] md:text-xs text-primary font-bold tracking-wide">
                      {N.t(tops.length > 1 ? 'os_top_intro_n' : 'os_top_intro', { n: tops.length })}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {tops.map((t, i) => (
                      <div key={'n' + i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/25 border border-white/5">
                        <span className="text-xs md:text-sm font-bold text-foreground">{t.race} m</span>
                        <span className="font-mono text-xs md:text-sm text-primary">{(t.ms / 1000).toFixed(2)} s</span>
                        <span className="text-[10px] md:text-xs text-muted-foreground">{N.ord(t.rank)}</span>
                      </div>
                    ))}
                    {/* Chronos plus lents que son propre record : le tableau
                        ne bougera pas, on le dit au lieu de laisser croire
                        a un enregistrement sans effet. */}
                    {kept.map((t, i) => (
                      <div key={'k' + i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/15 border border-white/5 opacity-70">
                        <span className="text-xs md:text-sm text-muted-foreground">{t.race} m</span>
                        <span className="font-mono text-[10px] md:text-xs text-muted-foreground">
                          {N.t('os_top_better', { d: t.race, s: ((t.ownMs || 0) / 1000).toFixed(2) })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {topStatus === 'done' ? (
                    tops.length > 0 ? (
                      <p className="text-center text-sm text-primary font-bold">
                        {N.t('os_top_saved', { n: topName.trim() })}
                      </p>
                    ) : null
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={topName}
                          onChange={e => setTopName(e.target.value)}
                          placeholder={N.t('your_name')}
                          maxLength={20}
                          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={handleSaveTop}
                          disabled={!topName.trim() || topStatus === 'sending'}
                          className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                        >
                          {topStatus === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {N.t('save_score')}
                        </button>
                      </div>
                      {topStatus === 'error' && (
                        <p className="text-center text-xs text-destructive">{N.t('score_save_fail')}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

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

                  {/* Envoi direct. WhatsApp et SMS acceptent un message
                      prerempli par simple lien. Snapchat et Instagram non :
                      ils passent par la feuille de partage du telephone. */}
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground mt-1">
                    {N.t('share_send')}
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <a
                      href={whatsappUrl(msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {N.t('share_whatsapp')}
                    </a>
                    <a
                      href={smsUrl(msg)}
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#4FC3F7' }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {N.t('share_sms')}
                    </a>
                    {canNativeShare() && (
                      <button
                        onClick={() => nativeShare(msg, code)}
                        className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {N.t('share_other')}
                      </button>
                    )}
                  </div>
                  {canNativeShare() && (
                    <p className="text-[9px] md:text-[10px] text-muted-foreground text-center max-w-xs leading-snug">
                      {N.t('share_other_hint')}
                    </p>
                  )}

                  {/* Copier reste un repli : traite en lien discret pour que
                      la rangee d'envoi garde le premier plan. */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center pt-1">
                    <button
                      onClick={() => handleCopy('code')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'code' ? N.t('code_copied') : N.t('challenge_copy_code')}
                    </button>
                    <button
                      onClick={() => handleCopy('link')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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
