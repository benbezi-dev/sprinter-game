import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SprinterApp, SprinterCore } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

const { C } = SprinterCore;

/**
 * Tutoriel — on apprend en faisant.
 *
 * Trois choses decident d'une course, et aucune ne s'explique bien par un
 * texte : alterner sans se prendre les pieds, partir au signal, et monter la
 * cadence. Les deux premieres se comprennent en trois secondes une fois
 * essayees ; la troisieme, la transition, est la mecanique propre du jeu et
 * reste opaque tant qu'on ne l'a pas sentie. Chaque etape est donc un petit
 * bac a sable : on ne passe a la suivante qu'en ayant reussi le geste.
 *
 * Le tutoriel ne touche pas au moteur. Il rejoue les memes regles avec ses
 * propres compteurs — un bac a sable ne doit pas pouvoir abimer une course.
 */

const VU = 'sprinter_tuto_vu';

export function tutoVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTutoVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

type Cote = 'left' | 'right';
type Etape = 0 | 1 | 2 | 3;

/** Mediane, comme le moteur la calcule pour noter la transition. */
function mediane(v: number[]): number {
  if (!v.length) return 0;
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function Tutorial({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;
  const [etape, setEtape] = useState<Etape>(0);

  // --- etape 1 : alterner ---------------------------------------------------
  const [alt, setAlt] = useState(0);
  const [faute, setFaute] = useState(false);

  // --- etape 2 : le signal --------------------------------------------------
  const [compte, setCompte] = useState<number | null>(null);
  const [pistolet, setPistolet] = useState(0);          // performance.now() du coup
  const [reaction, setReaction] = useState<number | null>(null);
  const [tropTot, setTropTot] = useState(false);

  // --- etape 3 : monter la cadence -----------------------------------------
  const [appuis, setAppuis] = useState<number[]>([]);
  const [note, setNote] = useState<number | null>(null);
  const [ratio, setRatio] = useState(0);
  const [tenue, setTenue] = useState(0);
  const dernierCote = useRef<Cote | null>(null);

  const CIBLE_ALT = 6;
  const CIBLE_CADENCE = 14;

  const reset3 = () => { setAppuis([]); setNote(null); setRatio(0); setTenue(0); dernierCote.current = null; };

  // Le decompte de l'etape 2, relance a chaque essai.
  const lancerDepart = useCallback(() => {
    setReaction(null); setTropTot(false);
    setCompte(3);
    const t0 = performance.now();
    const id = setInterval(() => {
      const ecoule = (performance.now() - t0) / 1000;
      const reste = 3 - ecoule;
      if (reste <= 0) {
        clearInterval(id);
        setCompte(0);
        setPistolet(performance.now());
      } else {
        setCompte(Math.ceil(reste));
      }
    }, 60);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (etape === 1) return lancerDepart();
  }, [etape, lancerDepart]);

  // --- le geste, quelle que soit sa provenance ------------------------------
  const toucher = useCallback((cote: Cote) => {
    if (etape === 0) {
      if (dernierCote.current === cote) {
        setFaute(true); setAlt(0);
        setTimeout(() => setFaute(false), 550);
      } else {
        dernierCote.current = cote;
        setAlt(n => {
          const v = n + 1;
          if (v >= CIBLE_ALT) setTimeout(() => { dernierCote.current = null; setEtape(1); }, 450);
          return v;
        });
      }
      return;
    }

    if (etape === 1) {
      if (compte === null) return;
      if (compte > 0) {                       // parti avant le pistolet
        setTropTot(true); setCompte(null);
        setTimeout(lancerDepart, 900);
        return;
      }
      if (reaction !== null) return;
      const r = (performance.now() - pistolet) / 1000;
      setReaction(r);
      setTimeout(() => { reset3(); setEtape(2); }, 1600);
      return;
    }

    if (etape === 2) {
      if (note !== null) return;
      if (dernierCote.current === cote) {
        setFaute(true);
        setTimeout(() => setFaute(false), 450);
        return;                               // un faux pas invalide la montee
      }
      dernierCote.current = cote;
      const t = performance.now() / 1000;
      setAppuis(prev => {
        const v = [...prev, t];
        if (v.length >= CIBLE_CADENCE) noter(v);
        return v;
      });
    }
  }, [etape, compte, reaction, pistolet, note, lancerDepart]);

  /** Meme calcul que le moteur : rapport des medianes, et cadence atteinte. */
  const noter = (t: number[]) => {
    const gaps: number[] = [];
    for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
    const moitie = Math.floor(gaps.length / 2);
    const tard = mediane(gaps.slice(moitie));
    const r = tard > 0.0001 ? mediane(gaps.slice(0, moitie)) / tard : 0;
    const abouti = tard <= C.TRANS_FLOOR;
    setRatio(r); setTenue(tard);
    setNote(!abouti ? 0 : r >= C.TRANS_PERFECT ? 2 : r >= C.TRANS_GOOD ? 1 : 0);
  };

  // Clavier : les memes fleches que dans la course.
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
  const sous = ['tuto_1_s', 'tuto_2_s', 'tuto_3_s'];

  // Progression de l'etape en cours, pour la barre du haut.
  const avancement = etape === 0 ? alt / CIBLE_ALT
    : etape === 1 ? (reaction !== null ? 1 : 0)
    : etape === 2 ? Math.min(1, appuis.length / CIBLE_CADENCE) : 1;

  return (
    <div className="fixed inset-0 z-[60] bg-[#060913] flex flex-col pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      {/* En-tete : ou on en est, et par ou sortir */}
      <div className="w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={false}
                animate={{ width: i < etape ? '100%' : i === etape ? `${avancement * 100}%` : '0%' }}
                transition={{ duration: 0.25 }}
              />
            </div>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-4 py-4 min-h-0">
        {/* Pas d'animation de sortie : elle n'aboutit pas quand le telephone
            met la page en veille, et laisse alors le titre d'une etape
            au-dessus du contenu de la suivante. L'entree suffit. */}
        <motion.div
            key={etape}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center text-center gap-2 w-full"
          >
            <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-primary/70">
              {N.t('tuto_step', { n: etape + 1, t: 3 })}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight uppercase text-primary">
              {N.t(titres[etape] || 'tuto_1_t')}
            </h2>
            <p className="text-xs md:text-sm text-foreground/80 leading-snug max-w-sm">
              {N.t(sous[etape] || 'tuto_1_s')}
            </p>
          </motion.div>

        {/* --- la zone vivante, propre a chaque etape --- */}
        <div className="w-full flex-1 min-h-[120px] flex flex-col items-center justify-center gap-3">

          {etape === 0 && (
            <>
              <div className="flex gap-2">
                {Array.from({ length: CIBLE_ALT }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i < alt ? 1 : 0.7,
                      opacity: i < alt ? 1 : 0.25,
                    }}
                    className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${i < alt ? 'bg-primary' : 'bg-white/30'}`}
                  />
                ))}
              </div>
              <AnimatePresence>
                {faute && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="text-sm md:text-base font-black tracking-widest text-destructive uppercase"
                  >
                    {N.t('tuto_same_foot')}
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}

          {etape === 1 && (
            <div className="flex flex-col items-center gap-2">
              {tropTot ? (
                <motion.div initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="text-2xl md:text-4xl font-black font-display tracking-tight text-destructive uppercase">
                  {N.t('false_start')}
                </motion.div>
              ) : reaction !== null ? (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center gap-1">
                  <span className={`text-xl md:text-3xl font-black font-display tracking-tight uppercase
                    ${reaction <= C.REACT_BEST ? 'text-primary' : reaction <= C.REACT_WINDOW ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {reaction <= C.REACT_BEST ? N.t('react_top') : N.t('reaction')}
                  </span>
                  <span className="font-mono text-sm md:text-base text-cyan-300">
                    {reaction.toFixed(3)} s
                    {reaction < C.REACT_WINDOW &&
                      ` · +${(C.REACT_BONUS * Math.min(1, Math.max(0,
                        (C.REACT_WINDOW - reaction) / (C.REACT_WINDOW - C.REACT_BEST)))).toFixed(2)} m/s`}
                  </span>
                  {reaction >= C.REACT_WINDOW && (
                    <span className="text-[10px] md:text-xs text-muted-foreground">{N.t('tuto_slow')}</span>
                  )}
                </motion.div>
              ) : (
                <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full border-4 flex items-center justify-center
                  ${compte === 0 ? 'border-primary bg-primary/20' : 'border-white/20 bg-card/60'}`}>
                  <span className={`text-3xl md:text-5xl font-black font-display
                    ${compte === 0 ? 'text-primary' : 'text-white'}`}>
                    {compte === 0 ? N.t('go') : compte}
                  </span>
                </div>
              )}
            </div>
          )}

          {etape === 2 && (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Les intervalles, dessines a mesure : le geste devient visible.
                  Une barre haute est un intervalle long, donc une cadence
                  lente. Le but est un profil qui descend. */}
              <div className="w-full max-w-xs h-16 md:h-20 flex items-end justify-center gap-1">
                {Array.from({ length: CIBLE_CADENCE - 1 }).map((_, i) => {
                  const g = appuis[i + 1] != null ? appuis[i + 1] - appuis[i] : null;
                  const h = g == null ? 0 : Math.max(6, Math.min(100, (g / 0.45) * 100));
                  const bon = g != null && g <= C.TRANS_FLOOR;
                  return (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.12 }}
                      className={`flex-1 rounded-t-sm ${g == null ? 'bg-white/10'
                        : bon ? 'bg-primary' : 'bg-cyan-400/70'}`}
                      style={{ minHeight: 3 }}
                    />
                  );
                })}
              </div>

              {note === null ? (
                <span className="text-[10px] md:text-xs tracking-widest text-muted-foreground uppercase">
                  {N.t('tuto_press_left', { n: CIBLE_CADENCE - appuis.length })}
                </span>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-1">
                  <span className={`text-lg md:text-2xl font-black tracking-widest uppercase
                    ${note === 2 ? 'text-primary' : note === 1 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {N.t(`trans_${note}`)}
                  </span>
                  <span className="font-mono text-[10px] md:text-xs text-muted-foreground">
                    {N.t('tuto_ratio', { r: ratio.toFixed(2), c: (tenue * 1000).toFixed(0) })}
                  </span>
                  <span className="text-[10px] md:text-xs text-foreground/70 text-center max-w-xs leading-snug">
                    {N.t(note === 0
                      ? (tenue > C.TRANS_FLOOR ? 'tuto_hint_slow' : 'tuto_hint_flat')
                      : note === 1 ? 'tuto_hint_good' : 'tuto_hint_perfect')}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <button onClick={reset3}
                            className="px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-widest
                                       text-foreground bg-white/5 border border-white/15 hover:bg-white/10 transition-colors">
                      {N.t('tuto_again')}
                    </button>
                    <button onClick={() => setEtape(3)}
                            className="px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-widest
                                       text-background bg-primary hover:bg-primary/90 transition-colors">
                      {N.t('tuto_next')}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {etape === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight uppercase text-primary">
                {N.t('tuto_done_t')}
              </h2>
              <p className="text-xs md:text-sm text-foreground/80 max-w-sm leading-snug">
                {N.t('tuto_done_s', { d: C.DRIVE_END, t: C.TRANS_END })}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* --- les pads, identiques a ceux de la course --- */}
      {etape < 3 ? (
        <div className="w-full max-w-lg mx-auto grid grid-cols-2 gap-2 md:gap-3 shrink-0">
          {(['left', 'right'] as Cote[]).map(cote => (
            <button
              key={cote}
              onPointerDown={e => { e.preventDefault(); toucher(cote); }}
              className={`h-24 sm:h-28 md:h-32 rounded-2xl border-2 flex items-center justify-center
                          transition-colors select-none touch-none
                          ${faute && dernierCote.current === cote
                            ? 'border-destructive bg-destructive/20'
                            : 'border-white/15 bg-white/[0.06] active:bg-primary/25 active:border-primary/50'}`}
            >
              {cote === 'left'
                ? <ChevronLeft className="w-8 h-8 md:w-10 md:h-10 text-foreground/60" />
                : <ChevronRight className="w-8 h-8 md:w-10 md:h-10 text-foreground/60" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-lg mx-auto flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onClose(true)}
            className="w-full py-4 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest
                       text-background bg-primary hover:bg-primary/90 transition-all
                       border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
          >
            {N.t('tuto_start')}
          </button>
          <button
            onClick={() => { setEtape(0); setAlt(0); dernierCote.current = null; }}
            className="w-full py-2 text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            {N.t('tuto_replay')}
          </button>
        </div>
      )}

      {etape < 3 && (
        <button onClick={() => onClose(false)}
                className="w-full max-w-lg mx-auto pt-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {N.t('tuto_skip')}
        </button>
      )}
    </div>
  );
}
