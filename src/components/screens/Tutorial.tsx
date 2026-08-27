import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SprinterApp, SprinterCore } from '@/game/engine';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, RotateCcw } from 'lucide-react';

const { C } = SprinterCore;

/**
 * Tutoriel — montre, puis fais.
 *
 * Trois choses decident d'une course, et aucune ne se transmet par une phrase :
 * alterner sans se prendre les pieds, partir au signal, installer sa cadence.
 * On les joue donc devant le joueur, sur les pads memes qu'il va utiliser —
 * ils s'allument tout seuls au bon rythme — puis on lui rend la main. Le texte
 * se reduit a un titre de deux mots : ce qu'on peut montrer ne s'ecrit pas.
 *
 * La troisieme etape est la seule qui merite d'exister. Le rythme qui paie
 * n'est pas celui qu'on devine : quelques appuis larges, puis une cadence
 * rapide installee d'un coup et tenue. Une descente progressive echoue, un
 * martelage constant aussi. La demo joue exactement le bon profil, et pendant
 * l'essai il reste dessine en fond : le joueur a un modele a superposer plutot
 * qu'une regle a retenir.
 *
 * Le tutoriel ne touche pas au moteur — mais il note avec sa formule exacte,
 * sans quoi il enseignerait autre chose que le jeu.
 */

const VU = 'sprinter_tuto_vu';

export function tutoVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTutoVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

type Cote = 'left' | 'right';

/** Le profil a imiter : trois appuis larges, puis la cadence installee. */
const MODELE = [0.34, 0.30, 0.26, 0.115, 0.115, 0.115, 0.115, 0.115,
                0.115, 0.115, 0.115, 0.115, 0.115];
const APPUIS_CIBLE = MODELE.length + 1;      // 14
const ALT_CIBLE = 6;

function mediane(v: number[]): number {
  if (!v.length) return 0;
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Hauteur d'une barre d'intervalle, bornee pour rester lisible. */
const hauteur = (g: number) => Math.max(5, Math.min(100, (g / 0.42) * 100));

export function Tutorial({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;

  const [etape, setEtape] = useState(0);          // 0,1,2 puis 3 = fin
  const [demo, setDemo] = useState(true);         // on montre avant de rendre la main

  // Pad allume par la demo, pour que le rythme se voie sur les pads memes.
  const [flash, setFlash] = useState<Cote | null>(null);
  const [compte, setCompte] = useState<number | null>(null);
  const [modeleVus, setModeleVus] = useState(0);  // barres jouees par la demo

  const [alt, setAlt] = useState(0);
  const [faute, setFaute] = useState(false);
  const [pistolet, setPistolet] = useState(0);
  const [reaction, setReaction] = useState<number | null>(null);
  const [tropTot, setTropTot] = useState(false);
  const [appuis, setAppuis] = useState<number[]>([]);
  const [note, setNote] = useState<number | null>(null);
  const [tenue, setTenue] = useState(0);

  const dernier = useRef<Cote | null>(null);
  const raf = useRef(0);

  const stop = () => { cancelAnimationFrame(raf.current); raf.current = 0; };

  /**
   * Joue une suite d'evenements dates, sur la boucle d'affichage plutot qu'a
   * coups de minuteurs : le rythme de l'etape 3 est le message, il doit etre
   * juste au centieme.
   */
  const jouer = useCallback((evts: { t: number; f: () => void }[], fini: () => void) => {
    stop();
    const t0 = performance.now();
    let i = 0;
    const pas = () => {
      const dt = (performance.now() - t0) / 1000;
      while (i < evts.length && dt >= evts[i].t) evts[i++].f();
      if (i < evts.length) raf.current = requestAnimationFrame(pas);
      else { raf.current = 0; fini(); }
    };
    raf.current = requestAnimationFrame(pas);
  }, []);

  const reinit = () => {
    setAlt(0); setFaute(false); setReaction(null); setTropTot(false);
    setAppuis([]); setNote(null); setTenue(0); setFlash(null);
    setCompte(null); setModeleVus(0); dernier.current = null;
  };

  // --- les trois demonstrations --------------------------------------------
  const lancerDemo = useCallback((e: number) => {
    reinit();
    setDemo(true);
    const ev: { t: number; f: () => void }[] = [];

    if (e === 0) {
      // Gauche, droite, gauche… au rythme d'un depart, pour que l'alternance
      // se lise comme une foulee et non comme une consigne.
      let t = 0.35;
      for (let i = 0; i < 6; i++) {
        const cote: Cote = i % 2 ? 'right' : 'left';
        ev.push({ t, f: () => setFlash(cote) });
        ev.push({ t: t + 0.16, f: () => setFlash(null) });
        t += 0.34;
      }
      ev.push({ t: t + 0.25, f: () => {} });
    } else if (e === 1) {
      // Le decompte, puis l'appui juste apres le signal.
      [3, 2, 1].forEach((n, i) => ev.push({ t: 0.3 + i * 0.7, f: () => setCompte(n) }));
      ev.push({ t: 2.4, f: () => setCompte(0) });
      ev.push({ t: 2.55, f: () => setFlash('left') });
      ev.push({ t: 2.75, f: () => setFlash(null) });
      ev.push({ t: 3.3, f: () => {} });
    } else {
      // Le profil, joue a son vrai tempo : trois appuis larges puis la cadence.
      let t = 0.4, cote: Cote = 'left';
      ev.push({ t, f: () => { setFlash(cote); setModeleVus(0); } });
      ev.push({ t: t + 0.1, f: () => setFlash(null) });
      MODELE.forEach((gap, i) => {
        t += gap;
        cote = cote === 'left' ? 'right' : 'left';
        const c = cote;
        ev.push({ t, f: () => { setFlash(c); setModeleVus(i + 1); } });
        ev.push({ t: t + Math.min(0.09, gap * 0.5), f: () => setFlash(null) });
      });
      ev.push({ t: t + 0.5, f: () => {} });
    }

    jouer(ev, () => {
      setFlash(null); setCompte(null);
      setDemo(false);
      if (e === 1) departReel();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jouer]);

  /** Le vrai decompte de l'etape 2, une fois la demo passee. */
  const departReel = useCallback(() => {
    setReaction(null); setTropTot(false);
    const ev: { t: number; f: () => void }[] = [];
    [3, 2, 1].forEach((n, i) => ev.push({ t: i * 1, f: () => setCompte(n) }));
    ev.push({ t: 3, f: () => { setCompte(0); setPistolet(performance.now()); } });
    jouer(ev, () => {});
  }, [jouer]);

  useEffect(() => { if (etape < 3) lancerDemo(etape); return stop; }, [etape, lancerDemo]);

  // --- le geste -------------------------------------------------------------
  const toucher = useCallback((cote: Cote) => {
    if (demo || etape > 2) return;

    if (etape === 0) {
      if (dernier.current === cote) {
        setFaute(true); setAlt(0);
        setTimeout(() => setFaute(false), 500);
        return;
      }
      dernier.current = cote;
      setAlt(n => {
        const v = n + 1;
        if (v >= ALT_CIBLE) setTimeout(() => setEtape(1), 420);
        return v;
      });
      return;
    }

    if (etape === 1) {
      if (compte === null) return;
      if (compte > 0) {
        setTropTot(true); setCompte(null); stop();
        setTimeout(() => { setTropTot(false); departReel(); }, 850);
        return;
      }
      if (reaction !== null) return;
      setReaction((performance.now() - pistolet) / 1000);
      setTimeout(() => setEtape(2), 1500);
      return;
    }

    if (note !== null) return;
    if (dernier.current === cote) {
      setFaute(true); setTimeout(() => setFaute(false), 400);
      return;
    }
    dernier.current = cote;
    const t = performance.now() / 1000;
    setAppuis(prev => {
      const v = [...prev, t];
      if (v.length >= APPUIS_CIBLE) noter(v);
      return v;
    });
  }, [demo, etape, compte, reaction, pistolet, note, departReel]);

  /** La formule du moteur, mot pour mot. */
  const noter = (t: number[]) => {
    const gaps: number[] = [];
    for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
    const m = Math.floor(gaps.length / 2);
    const tard = mediane(gaps.slice(m));
    const r = tard > 0.0001 ? mediane(gaps.slice(0, m)) / tard : 0;
    setTenue(tard);
    setNote(tard > C.TRANS_FLOOR ? 0 : r >= C.TRANS_PERFECT ? 2 : r >= C.TRANS_GOOD ? 1 : 0);
  };

  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); toucher('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); toucher('right'); }
      else if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', bas);
    return () => window.removeEventListener('keydown', bas);
  }, [toucher, onClose]);

  const titres = ['tuto_1_t', 'tuto_2_t', 'tuto_3_t'];
  const avancement = etape === 0 ? alt / ALT_CIBLE
    : etape === 1 ? (reaction !== null ? 1 : 0)
    : etape === 2 ? Math.min(1, appuis.length / APPUIS_CIBLE) : 1;

  // Verdict de l'etape 3, en deux mots plutot qu'en trois lignes.
  const verdict = note === null ? null
    : note === 2 ? { mot: 'tuto_v_perfect', ton: 'text-primary' }
    : note === 1 ? { mot: 'tuto_v_good', ton: 'text-emerald-400' }
    : tenue > C.TRANS_FLOOR ? { mot: 'tuto_v_slow', ton: 'text-destructive' }
    : { mot: 'tuto_v_flat', ton: 'text-destructive' };

  return (
    <div className="fixed inset-0 z-[60] bg-[#060913] flex flex-col pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      <div className="w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-primary" initial={false}
                animate={{ width: i < etape ? '100%' : i === etape ? `${avancement * 100}%` : '0%' }}
                transition={{ duration: 0.25 }} />
            </div>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-3 py-3 min-h-0">

        {etape < 3 && (
          <motion.div key={`t${etape}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }} className="flex flex-col items-center gap-1">
            <span className={`text-[9px] md:text-[10px] font-bold tracking-[0.35em]
              ${demo ? 'text-cyan-300' : 'text-primary/70'}`}>
              {N.t(demo ? 'tuto_watch' : 'tuto_your_turn')}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight uppercase text-primary text-center">
              {N.t(titres[etape])}
            </h2>
          </motion.div>
        )}

        {/* --- la scene --- */}
        <div className="w-full flex-1 min-h-[110px] flex flex-col items-center justify-center gap-2">

          {etape === 0 && (
            <div className="flex gap-2 h-6 items-center">
              {Array.from({ length: ALT_CIBLE }).map((_, i) => (
                <motion.div key={i} initial={false}
                  animate={{ scale: i < alt ? 1 : 0.65, opacity: i < alt ? 1 : 0.25 }}
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-full ${i < alt ? 'bg-primary' : 'bg-white/35'}`} />
              ))}
              {faute && (
                <motion.span initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                             className="ml-2 text-destructive font-black text-xl">✕</motion.span>
              )}
            </div>
          )}

          {etape === 1 && (
            <div className="h-24 md:h-28 flex items-center justify-center">
              {tropTot ? (
                <motion.span initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                             className="text-2xl md:text-3xl font-black font-display tracking-tight text-destructive uppercase">
                  {N.t('tuto_v_early')}
                </motion.span>
              ) : reaction !== null ? (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center gap-0.5">
                  <span className={`font-mono font-black text-2xl md:text-3xl
                    ${reaction <= C.REACT_BEST ? 'text-primary'
                      : reaction < C.REACT_WINDOW ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {reaction.toFixed(3)}<span className="text-sm font-normal"> s</span>
                  </span>
                  <span className="font-mono text-xs text-cyan-300">
                    {reaction < C.REACT_WINDOW
                      ? `+${(C.REACT_BONUS * Math.min(1, Math.max(0,
                          (C.REACT_WINDOW - reaction) / (C.REACT_WINDOW - C.REACT_BEST)))).toFixed(2)} m/s`
                      : N.t('tuto_v_late')}
                  </span>
                </motion.div>
              ) : (
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 flex items-center justify-center transition-colors
                  ${compte === 0 ? 'border-primary bg-primary/25' : 'border-white/20 bg-card/60'}`}>
                  <span className={`text-3xl md:text-4xl font-black font-display
                    ${compte === 0 ? 'text-primary' : 'text-white'}`}>
                    {compte === 0 ? N.t('go') : compte ?? ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {etape === 2 && (
            <div className="w-full flex flex-col items-center gap-2">
              {/* Le modele reste dessine en fond pendant l'essai : on superpose
                  son rythme au sien, sans avoir a se rappeler une consigne. */}
              <div className="w-full max-w-xs h-20 md:h-24 flex items-end justify-center gap-[3px]">
                {MODELE.map((g, i) => {
                  const mien = appuis[i + 1] != null ? appuis[i + 1] - appuis[i] : null;
                  const vu = demo ? i < modeleVus : true;
                  return (
                    <div key={i} className="flex-1 h-full flex items-end justify-center relative">
                      <div className="absolute bottom-0 w-full rounded-t-sm bg-cyan-400/25"
                           style={{ height: vu ? `${hauteur(g)}%` : '0%',
                                    transition: 'height 90ms linear' }} />
                      {mien != null && (
                        <motion.div initial={{ height: 0 }} animate={{ height: `${hauteur(mien)}%` }}
                          transition={{ duration: 0.1 }}
                          className={`absolute bottom-0 w-[58%] rounded-t-sm
                            ${mien <= C.TRANS_FLOOR ? 'bg-primary' : 'bg-white/70'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="h-8 flex items-center">
                {verdict ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-3">
                    <span className={`text-base md:text-xl font-black tracking-widest uppercase ${verdict.ton}`}>
                      {N.t(verdict.mot)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {(tenue * 1000).toFixed(0)} ms
                    </span>
                  </motion.div>
                ) : !demo && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {APPUIS_CIBLE - appuis.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {etape === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight uppercase text-primary">
                {N.t('tuto_done_t')}
              </h2>
            </motion.div>
          )}
        </div>
      </div>

      {/* --- les pads : ils montrent, puis ils obeissent --- */}
      {etape < 3 ? (
        <div className="w-full max-w-lg mx-auto shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {(['left', 'right'] as Cote[]).map(cote => {
              const allume = flash === cote;
              return (
                <button
                  key={cote}
                  onPointerDown={e => { e.preventDefault(); toucher(cote); }}
                  className={`h-24 sm:h-28 md:h-32 rounded-2xl border-2 flex items-center justify-center
                              select-none touch-none transition-[background-color,border-color] duration-75
                              ${allume ? 'border-cyan-300 bg-cyan-300/30'
                                : faute && dernier.current === cote ? 'border-destructive bg-destructive/20'
                                : 'border-white/15 bg-white/[0.06] active:bg-primary/25 active:border-primary/50'}
                              ${demo ? 'opacity-90' : ''}`}
                >
                  {cote === 'left'
                    ? <ChevronLeft className={`w-9 h-9 md:w-11 md:h-11 ${allume ? 'text-cyan-100' : 'text-foreground/55'}`} />
                    : <ChevronRight className={`w-9 h-9 md:w-11 md:h-11 ${allume ? 'text-cyan-100' : 'text-foreground/55'}`} />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button onClick={() => lancerDemo(etape)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] tracking-widest
                               text-muted-foreground hover:text-cyan-300 transition-colors">
              <RotateCcw className="w-3 h-3" />{N.t('tuto_replay_demo')}
            </button>
            {note !== null ? (
              <div className="flex gap-2">
                <button onClick={() => { setAppuis([]); setNote(null); dernier.current = null; }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest
                                   text-foreground bg-white/5 border border-white/15 hover:bg-white/10 transition-colors">
                  {N.t('tuto_again')}
                </button>
                <button onClick={() => setEtape(3)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest
                                   text-background bg-primary hover:bg-primary/90 transition-colors">
                  {N.t('tuto_next')}
                </button>
              </div>
            ) : (
              <button onClick={() => onClose(false)}
                      className="px-2 py-1.5 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                {N.t('tuto_skip')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg mx-auto flex flex-col gap-2 shrink-0">
          <button onClick={() => onClose(true)}
                  className="w-full py-4 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest
                             text-background bg-primary hover:bg-primary/90 transition-all
                             border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
            {N.t('tuto_start')}
          </button>
          <button onClick={() => setEtape(0)}
                  className="w-full py-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {N.t('tuto_replay')}
          </button>
        </div>
      )}
    </div>
  );
}
