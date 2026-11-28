import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Lock, Clock, BookOpen, Play, RotateCcw, CalendarDays, ChevronRight } from 'lucide-react';
import { MONTEE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { useRetour } from '@/hooks/use-retour';
import {
  NB_CASES, CASES, caseDe, carnet, blocage, gagnee, jouables, courirLaCase, caseEnCours, ouvertureDe,
  maintenantAvent, recalerSurLeServeur, dernierResultat, ecouterResultat, chrono, type Resultat,
} from '@/game/avent';
import { chapitreDe, EPILOGUE, SOIRS_PERDUS, type Ligne } from '@/game/avent-chapitres';

/* ---------------------------------------------------------------------------
   LE CALENDRIER DE L'AVENT — « La Course de l'Etoile » (game/avent.ts).

   Vingt-quatre cases. Chacune dit ce qui lui manque, sans mentir : sa date (et
   le temps qu'il reste), la victoire de la veille, ou rien — alors on peut la
   courir. Une case gagnee devient d'or, garde le meilleur chrono et rouvre son
   chapitre a volonte.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const OR = '#f6d68c';
const ROUGE = '#c41e2a';
const GLACE = '#bfe6ff';

function useFr() { return SprinterApp.N.getLang() === 'fr'; }
const L = (l: Ligne, fr: boolean) => (fr ? l[0] : l[1]);

/** Une horloge qui bat chaque seconde (les comptes a rebours des cases). */
function useBattement(pas = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set(x => x + 1), pas); return () => clearInterval(id); }, [pas]);
}

/** Recale le calendrier sur l'heure du serveur, une fois (le tableau de Noel la donne). */
function useHeureDuServeur() {
  useEffect(() => {
    let vivant = true;
    import('@/game/noel').then(m => m.fetchTableau()).then(t => { if (vivant) recalerSurLeServeur(t.maintenant); })
      .catch(() => { /* hors ligne : le cliquet */ });
    return () => { vivant = false; };
  }, []);
}

function dans(ms: number, fr: boolean): string {
  if (ms <= 0) return fr ? 'maintenant' : 'now';
  const j = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60;
  if (j > 0) return fr ? `dans ${j} j ${h} h` : `in ${j}d ${h}h`;
  if (h > 0) return fr ? `dans ${h} h ${m} min` : `in ${h}h ${m}m`;
  const s = Math.floor(ms / 1000) % 60;
  return fr ? `dans ${m} min ${s} s` : `in ${m}m ${s}s`;
}

const DISTANCE: Record<string, [string, string]> = { '100': ['100 m', '100 m'], '200': ['200 m', '200 m'], '400': ['400 m', '400 m'] };

let rouvrirAuRetour = false;

/* ============================================================== la banniere */

export function BanderoleAvent() {
  const fr = useFr();
  const reduit = useAnimationsReduites();
  const [ouvert, setOuvert] = useState(rouvrirAuRetour);
  useEffect(() => { rouvrirAuRetour = false; }, []);
  const k = carnet();
  const j = jouables();
  const aCourir = j > k.gagnees ? j : null;

  return (
    <motion.div {...MONTEE}>
      <motion.button onClick={() => setOuvert(true)} whileTap={{ scale: 0.98 }}
        className="relative w-full rounded-2xl border-2 overflow-hidden flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ borderColor: OR, background: 'linear-gradient(100deg, rgba(196,30,42,0.32), rgba(246,214,140,0.16))' }}>
        <motion.span className="relative shrink-0"
          animate={reduit ? {} : { scale: [1, 1.12, 1] }}
          transition={reduit ? {} : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <CalendarDays className="w-7 h-7" style={{ color: OR }} aria-hidden />
        </motion.span>
        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? 'Calendrier de l’Avent · 24 courses' : 'Advent calendar · 24 races'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight truncate">
            {fr ? 'La Course de l’Étoile' : 'The Star Race'}
          </span>
          <span className="text-[10px] md:text-xs text-foreground/70 leading-snug truncate">
            {k.gagnees >= NB_CASES
              ? (fr ? 'Les 24 cases sont gagnées. Joyeux Noël !' : 'All 24 doors won. Merry Christmas!')
              : aCourir
                ? (fr ? `Case ${aCourir} ouverte · ${k.gagnees}/24 gagnées` : `Door ${aCourir} open · ${k.gagnees}/24 won`)
                : (fr ? `${k.gagnees}/24 gagnées · prochaine case à 22 h` : `${k.gagnees}/24 won · next door at 10 pm`)}
          </span>
        </span>
        <span className="relative shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest" style={{ background: OR }}>
          {fr ? 'OUVRIR' : 'OPEN'}
        </span>
      </motion.button>
      <AnimatePresence>
        {ouvert && <EcranAvent onClose={() => setOuvert(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ============================================================== l'ecran */

export function EcranAvent({ onClose }: { onClose: () => void }) {
  useRetour(onClose);
  useHeureDuServeur();
  useBattement();
  const fr = useFr();
  const [choisie, setChoisie] = useState<number | null>(null);
  const [lecture, setLecture] = useState<number | 'fin' | null>(null);
  const k = carnet();

  const courir = (n: number) => {
    rouvrirAuRetour = true;
    if (courirLaCase(n)) onClose(); else rouvrirAuRetour = false;
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'radial-gradient(circle at 50% 0%, #1d3a7a 0%, #0b1530 55%, #070b18 100%)' }}>
      <Neige />
      <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-4">
        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] md:text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: GLACE }}>
              {fr ? 'Calendrier de l’Avent' : 'Advent calendar'}
            </span>
            <h2 className="font-display font-black text-2xl md:text-3xl leading-none" style={{ color: OR }}>
              {fr ? 'LA COURSE DE L’ÉTOILE' : 'THE STAR RACE'}
            </h2>
            <span className="text-[10px] md:text-xs text-white/70 mt-1 leading-snug">
              {fr ? 'Une case chaque soir à 22 h, au Village de l’Étoile. Bats le chrono, et l’histoire avance.'
                  : 'One door every evening at 10 pm, at Star Village. Beat the clock, and the story moves on.'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0"
                  aria-label={fr ? 'Fermer' : 'Close'}>
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {/* Les lueurs de Givre : une par case gagnee */}
        <div className="w-full flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(k.gagnees / NB_CASES) * 100}%`, background: `linear-gradient(90deg, ${GLACE}, ${OR})` }} />
          </div>
          <span className="text-[10px] font-bold tracking-wide text-white/80 tabular-nums">{k.gagnees}/24</span>
        </div>

        <div className="w-full grid grid-cols-4 sm:grid-cols-6 gap-2">
          {CASES.map(c => <Porte key={c.n} n={c.n} fr={fr} onClick={() => setChoisie(c.n)} />)}
        </div>

        {k.gagnees >= NB_CASES && (
          <button onClick={() => setLecture('fin')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-black font-black text-xs tracking-widest" style={{ background: OR }}>
            <Star className="w-4 h-4" aria-hidden /> {fr ? 'LE MATIN DE NOËL' : 'CHRISTMAS MORNING'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {choisie !== null && (
          <DetailCase n={choisie} fr={fr} onClose={() => setChoisie(null)}
                      courir={() => courir(choisie)} lire={() => { setLecture(choisie); setChoisie(null); }} />
        )}
        {lecture !== null && <Lecteur cle={lecture} fr={fr} onClose={() => setLecture(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function Neige() {
  const reduit = useAnimationsReduites();
  const flocons = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, d: 6 + (i % 5) * 1.7, r: i * 0.45, s: 8 + (i % 3) * 4 })), []);
  if (reduit) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {flocons.map((f, i) => (
        <motion.span key={i} className="absolute" style={{ left: `${f.x}%`, top: -20, color: 'white', opacity: 0.5, fontSize: f.s }}
          animate={{ y: ['0vh', '105vh'] }} transition={{ duration: f.d, delay: f.r, repeat: Infinity, ease: 'linear' }}>❄</motion.span>
      ))}
    </div>
  );
}

/** Une case du calendrier : gagnee (or), a courir (rouge vif), ou fermee (et pourquoi). */
function Porte({ n, fr, onClick }: { n: number; fr: boolean; onClick: () => void }) {
  const reduit = useAnimationsReduites();
  const b = blocage(n);
  const g = gagnee(n);
  const k = carnet();
  const ouverte = !g && b === 'ouverte';
  const reste = ouvertureDe(n) - maintenantAvent();
  const fond = g ? 'linear-gradient(160deg, #f6d68c, #b8862e)' : ouverte ? `linear-gradient(160deg, #e0303c, ${ROUGE})` : 'linear-gradient(160deg, #3a1c24, #24121a)';
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.95 }}
      animate={ouverte && !reduit ? { boxShadow: ['0 0 0px rgba(246,214,140,0)', '0 0 18px rgba(246,214,140,0.85)', '0 0 0px rgba(246,214,140,0)'] } : {}}
      transition={ouverte ? { duration: 1.8, repeat: Infinity } : {}}
      className="relative aspect-[4/5] rounded-xl border flex flex-col items-center justify-center gap-0.5 overflow-hidden"
      style={{ background: fond, borderColor: g || ouverte ? OR : 'rgba(246,214,140,0.25)' }}
      aria-label={`${fr ? 'Case' : 'Door'} ${n}`}>
      <span className="font-display font-black text-2xl md:text-3xl leading-none"
            style={{ color: g ? '#3a2208' : ouverte ? '#fff6dc' : 'rgba(246,214,140,0.55)' }}>{n}</span>
      {g && <span className="text-[9px] font-bold text-[#3a2208] tabular-nums">{chrono(k.meilleurs[n] ?? caseDe(n).imparti, fr)}</span>}
      {ouverte && <span className="text-[8px] font-black tracking-widest text-white/90">{fr ? 'COURIR' : 'RUN'}</span>}
      {!g && b === 'date' && <span className="text-[8px] text-white/55 leading-tight text-center px-1">{reste < 86_400_000 ? dans(reste, fr) : `${n} ${fr ? 'déc.' : 'Dec'}`}</span>}
      {!g && b === 'victoire' && <Lock className="w-3 h-3 text-white/40" aria-hidden />}
      {g && <Star className="absolute top-1 right-1 w-3 h-3" style={{ color: '#3a2208', fill: '#3a2208' }} aria-hidden />}
    </motion.button>
  );
}

/* ---------------------------------------------------------------- une case */

function DetailCase({ n, fr, onClose, courir, lire }: { n: number; fr: boolean; onClose: () => void; courir: () => void; lire: () => void }) {
  const c = caseDe(n);
  const ch = chapitreDe(n);
  const b = blocage(n);
  const g = gagnee(n);
  const k = carnet();
  const meilleur = k.meilleurs[n];
  const reste = ouvertureDe(n) - maintenantAvent();
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-3"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
        className="w-full max-w-sm rounded-2xl border p-4 flex flex-col gap-3"
        style={{ borderColor: OR, background: 'linear-gradient(170deg, #1a2550, #0c1229)' }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GLACE }}>
            {fr ? `Case ${n} · ${n} décembre` : `Door ${n} · ${n} December`}
          </span>
          <span className="text-[10px] font-bold text-white/70">{DISTANCE[c.epreuve][fr ? 0 : 1]}</span>
        </div>
        <h3 className="font-display font-black text-xl leading-tight" style={{ color: OR }}>{L(ch.titre, fr)}</h3>
        <p className="text-sm text-white/85 italic leading-snug">{L(ch.accroche, fr)}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-2 flex flex-col">
            <span className="text-[9px] tracking-widest uppercase text-white/55">{fr ? 'Chrono à battre' : 'Time to beat'}</span>
            <span className="font-black text-lg tabular-nums">{chrono(c.imparti, fr)}</span>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-2 flex flex-col">
            <span className="text-[9px] tracking-widest uppercase text-white/55">{fr ? 'Ton meilleur' : 'Your best'}</span>
            <span className="font-black text-lg tabular-nums" style={{ color: g ? OR : undefined }}>{meilleur !== undefined ? chrono(meilleur, fr) : '—'}</span>
          </div>
        </div>
        {b === 'date' && (
          <p className="flex items-center gap-2 text-xs text-white/75"><Clock className="w-4 h-4" aria-hidden />
            {fr ? `S’ouvre le ${n} décembre à 22 h (${dans(reste, fr)}).` : `Opens on ${n} December at 10 pm (${dans(reste, fr)}).`}</p>
        )}
        {b === 'victoire' && !g && (
          <p className="flex items-center gap-2 text-xs text-white/75"><Lock className="w-4 h-4" aria-hidden />
            {fr ? `Gagne d’abord la case ${n - 1}.` : `Win door ${n - 1} first.`}</p>
        )}
        <div className="flex gap-2">
          {b === 'ouverte' && (
            <button onClick={courir} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm tracking-widest text-white"
                    style={{ background: ROUGE }}>
              <Play className="w-4 h-4" aria-hidden /> {g ? (fr ? 'RECOURIR' : 'RUN AGAIN') : (fr ? 'COURIR' : 'RUN')}
            </button>
          )}
          {g && (
            <button onClick={lire} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm tracking-widest text-black"
                    style={{ background: OR }}>
              <BookOpen className="w-4 h-4" aria-hidden /> {fr ? 'LE CHAPITRE' : 'THE CHAPTER'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- la lecture */

/** Le chapitre d'une case (trois pages), ou l'epilogue du matin de Noel. */
function Lecteur({ cle, fr, onClose }: { cle: number | 'fin'; fr: boolean; onClose: () => void }) {
  const pages: Ligne[][] = cle === 'fin' ? [EPILOGUE.lignes] : chapitreDe(cle).pages;
  const titre = cle === 'fin' ? EPILOGUE.titre : chapitreDe(cle).titre;
  const [p, setP] = useState(0);
  const derniere = p >= pages.length - 1;
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Pages titre={L(titre, fr)} sur={cle === 'fin' ? '' : (fr ? `CHAPITRE ${cle}` : `CHAPTER ${cle}`)}
             lignes={pages[p]} fr={fr} page={p} total={pages.length}
             suite={derniere ? (fr ? 'FERMER' : 'CLOSE') : (fr ? 'SUITE' : 'NEXT')}
             onSuite={() => (derniere ? onClose() : setP(p + 1))} />
    </motion.div>
  );
}

function Pages({ titre, sur, lignes, fr, page, total, suite, onSuite }: {
  titre: string; sur: string; lignes: Ligne[]; fr: boolean; page: number; total: number; suite: string; onSuite: () => void;
}) {
  return (
    <motion.div key={page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-2xl border p-5 flex flex-col gap-3"
      style={{ borderColor: OR, background: 'linear-gradient(170deg, #1a2550, #0c1229)' }}>
      {sur && <span className="text-[10px] font-bold tracking-[0.3em]" style={{ color: GLACE }}>{sur}</span>}
      <h3 className="font-display font-black text-xl leading-tight" style={{ color: OR }}>{titre}</h3>
      <div className="flex flex-col gap-1.5">
        {lignes.map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.35 }}
            className="text-[15px] leading-snug text-white/90">{L(l, fr)}</motion.p>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-white/45 tabular-nums">{total > 1 ? `${page + 1}/${total}` : ''}</span>
        <button onClick={onSuite} className="flex items-center gap-1 px-4 py-2 rounded-xl font-black text-xs tracking-widest text-black" style={{ background: OR }}>
          {suite} <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}

/* ============================================================== pendant la course */

/** Le chrono a battre, et ce qu'il reste, en haut au centre. */
export function AventHUD() {
  const elapsed = useGameStore(s => s.elapsed);
  const state = useGameStore(s => s.state);
  const fr = useFr();
  const c = caseEnCours();
  if (!c || (state !== 'race' && state !== 'count')) return null;
  const reste = state === 'race' ? c.imparti - (elapsed || 0) : c.imparti;
  const tard = reste < 0;
  return (
    <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full border text-center"
         style={{ borderColor: OR, background: 'rgba(12,18,41,0.75)' }}>
      <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: GLACE }}>
        {fr ? `Case ${c.n} · à battre ${chrono(c.imparti, fr)}` : `Door ${c.n} · beat ${chrono(c.imparti, fr)}`}
      </span>
      {state === 'race' && (
        <span className="block font-black text-lg tabular-nums leading-none" style={{ color: tard ? '#ff7a7a' : OR }}>
          {tard ? '+' : ''}{Math.abs(reste).toFixed(1)}
        </span>
      )}
    </div>
  );
}

/* ============================================================== la fin d'une case */

export function aventEnCours(): boolean { return caseEnCours() !== null; }

// (z-[56] et pointer-events-auto comme la fin d'une nuit d'Halloween : le calque des ecrans
//  de fin laisse passer les clics vers le jeu, chaque ecran se rend cliquable lui-meme)
export function FinDeCase() {
  const fr = useFr();
  const c = caseEnCours();
  const [r, setR] = useState<Resultat | null>(() => (dernierResultat && c && dernierResultat.n === c.n ? dernierResultat : null));
  const [lecture, setLecture] = useState(false);
  useEffect(() => ecouterResultat(x => setR(x)), []);
  if (!c) return null;
  if (!r) return (
    <div className="fixed inset-0 z-[56] pointer-events-auto flex items-center justify-center"><span className="text-white/70 text-sm">…</span></div>
  );

  const calendrier = () => { rouvrirAuRetour = true; (SprinterApp as any).goHome(); };
  const encore = () => { if (!courirLaCase(r.n)) calendrier(); };
  const suivante = r.n < NB_CASES && blocage(r.n + 1) === 'ouverte' && !gagnee(r.n + 1) ? r.n + 1 : null;
  const perdu = SOIRS_PERDUS[r.perdu % SOIRS_PERDUS.length];
  const ch = chapitreDe(r.n);

  if (lecture && r.gagne) {
    return (
      <div className="fixed inset-0 z-[56] pointer-events-auto flex items-center justify-center bg-black/70 p-4">
        <LecteurFin n={r.n} fr={fr} onClose={() => setLecture(false)} />
      </div>
    );
  }

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-[56] pointer-events-auto flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl border p-5 flex flex-col gap-3"
           style={{ borderColor: r.gagne ? OR : 'rgba(191,230,255,0.4)', background: 'linear-gradient(170deg, #1a2550, #0c1229)' }}>
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: GLACE }}>
          {fr ? `Case ${r.n} · ${DISTANCE[c.epreuve][0]}` : `Door ${r.n} · ${DISTANCE[c.epreuve][1]}`}
        </span>
        <h3 className="font-display font-black text-2xl leading-tight" style={{ color: r.gagne ? OR : 'white' }}>
          {r.gagne ? (r.nouvelle ? (fr ? 'CASE GAGNÉE !' : 'DOOR WON!') : (fr ? 'DANS LE TEMPS' : 'IN TIME'))
                   : L(perdu.titre, fr)}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-2 flex flex-col">
            <span className="text-[9px] tracking-widest uppercase text-white/55">{fr ? 'Ton chrono' : 'Your time'}</span>
            <span className="font-black text-xl tabular-nums" style={{ color: r.gagne ? OR : '#ff9a9a' }}>{chrono(r.t, fr)}</span>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-2 flex flex-col">
            <span className="text-[9px] tracking-widest uppercase text-white/55">{fr ? 'À battre' : 'To beat'}</span>
            <span className="font-black text-xl tabular-nums">{chrono(r.imparti, fr)}</span>
          </div>
        </div>
        {r.gagne ? (
          <p className="text-sm text-white/85 leading-snug">
            {r.nouvelle
              ? (fr ? `Une nouvelle lueur brille dans la neige. Le chapitre ${r.n} s’ouvre : « ${L(ch.titre, fr)} ».`
                    : `A new glow shines in the snow. Chapter ${r.n} opens: “${L(ch.titre, fr)}”.`)
              : (fr ? (r.record ? 'Nouveau record sur cette case.' : 'Case déjà gagnée : l’histoire ne bouge pas.')
                    : (r.record ? 'New best on this door.' : 'Door already won: the story stays put.'))}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {perdu.lignes.map((l, i) => <p key={i} className="text-sm text-white/80 leading-snug">{L(l, fr)}</p>)}
            <p className="text-xs text-white/55 mt-1">
              {fr ? `Il t’a manqué ${(r.t - r.imparti).toFixed(2).replace('.', ',')} s.` : `You were ${(r.t - r.imparti).toFixed(2)} s short.`}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {r.gagne && (
            <button onClick={() => setLecture(true)} className="flex-1 min-w-[45%] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs tracking-widest text-black" style={{ background: OR }}>
              <BookOpen className="w-4 h-4" aria-hidden /> {fr ? 'LIRE LE CHAPITRE' : 'READ THE CHAPTER'}
            </button>
          )}
          {!r.gagne && (
            <button onClick={encore} className="flex-1 min-w-[45%] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs tracking-widest text-white" style={{ background: ROUGE }}>
              <RotateCcw className="w-4 h-4" aria-hidden /> {fr ? 'RECOURIR' : 'RUN AGAIN'}
            </button>
          )}
          {suivante && (
            <button onClick={() => { if (!courirLaCase(suivante)) calendrier(); }} className="flex-1 min-w-[45%] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs tracking-widest text-white" style={{ background: ROUGE }}>
              <Play className="w-4 h-4" aria-hidden /> {fr ? `CASE ${suivante}` : `DOOR ${suivante}`}
            </button>
          )}
          <button onClick={calendrier} className="flex-1 min-w-[45%] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs tracking-widest bg-white/10 border border-white/15">
            <CalendarDays className="w-4 h-4" aria-hidden /> {fr ? 'LE CALENDRIER' : 'THE CALENDAR'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function LecteurFin({ n, fr, onClose }: { n: number; fr: boolean; onClose: () => void }) {
  const ch = chapitreDe(n);
  const pages: { titre: Ligne; sur: string; lignes: Ligne[] }[] = ch.pages.map(l => ({ titre: ch.titre, sur: fr ? `CHAPITRE ${n}` : `CHAPTER ${n}`, lignes: l }));
  // la case 24 gagnee : l'epilogue suit le dernier chapitre
  if (n === NB_CASES) pages.push({ titre: EPILOGUE.titre, sur: '', lignes: EPILOGUE.lignes });
  const [p, setP] = useState(0);
  const derniere = p >= pages.length - 1;
  return (
    <Pages titre={L(pages[p].titre, fr)} sur={pages[p].sur} lignes={pages[p].lignes} fr={fr} page={p} total={pages.length}
           suite={derniere ? (fr ? 'FERMER' : 'CLOSE') : (fr ? 'SUITE' : 'NEXT')} onSuite={() => (derniere ? onClose() : setP(p + 1))} />
  );
}
