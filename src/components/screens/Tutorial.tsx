import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SprinterApp, SprinterCore } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE, SURGISSEMENT, TRANSITION } from '@/lib/mouvement';
import { Check, X, RotateCcw } from 'lucide-react';
import { demarrerSequence, pasDuTuto, rangerLeTuto, figerLaPiste } from '@/game/sprint-tuto.js';

const { C } = SprinterCore;

/**
 * Tutoriel de Sprinter — SUR LA PISTE, avec le coureur et le starter.
 *
 * La premiere version dessinait le geste : deux paves qui s'allument tout
 * seuls, des barres d'intervalle, un fond noir. Elle enseignait proprement, et
 * elle enseignait A COTE — le joueur apprenait a suivre des pastilles, puis
 * decouvrait en course un stade, une camera qui suit, un starter qui parle et
 * huit couloirs. Rien de ce qu'il venait d'apprendre ne se retrouvait au meme
 * endroit.
 *
 * Ici le moteur tourne. Le starter dit « a vos marques », le pistolet part, le
 * coureur sort des blocs, et ce qui note le joueur est ce qui le notera
 * demain : `reaction`, `pressTimes`, `transGrade`, les faux pas. Cet ecran
 * n'est qu'une incrustation par-dessus. Voir game/sprint-tuto.js.
 *
 * LE RALENTI NE SERT QU'UNE ETAPE SUR TROIS, et c'est ce qui distingue ce
 * tutoriel de celui des haies.
 *
 *   ALTERNER se voit : au ralenti, le pied qui se prend dans l'autre devient
 *   lisible. Les trois vitesses y ont tout leur sens.
 *
 *   LE DEPART est un reflexe, pas un geste. Ralentir le monde donnerait au
 *   joueur deux fois plus de temps reel pour repondre au meme pistolet : sa
 *   reaction s'ameliorerait sans que lui ne change, et on lui apprendrait un
 *   reflexe qu'il n'a pas.
 *
 *   LA CADENCE est une frequence, mesuree en secondes de course. Taper au meme
 *   rythme reel sous un ralenti donnerait des intervalles simules deux fois
 *   plus courts, donc une note fausse dans l'autre sens.
 *
 * Les deux dernieres se jouent donc a la vitesse de la course, toujours. Seule
 * la DEMONSTRATION ralentit partout : on regarde, on n'est pas note.
 */

const VU = 'sprinter_tuto_vu';

export function tutoVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTutoVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

/** La vitesse de toutes les demonstrations : on montre au ralenti. */
const DEMO = 0.45;

/**
 * Les trois etapes : ce qu'on apprend, et a quelles vitesses on le joue.
 *
 * `vitesses` est aussi le nombre de reussites demandees — une par palier. Les
 * deux dernieres etapes en demandent deux a la vitesse de la course : une
 * reaction juste peut etre un coup de chance, deux le sont moins.
 */
const ETAPES = [
  { t: 'tuto_1_t', s: 'tuto_1_s', geste: 'alterner', vitesses: [0.45, 0.7, 1] },
  { t: 'tuto_2_t', s: 'tuto_2_s', geste: 'depart', vitesses: [1, 1] },
  { t: 'tuto_3_t', s: 'tuto_3_s', geste: 'cadence', vitesses: [1, 1] },
] as const;

const MOT_VITESSE = (v: number) =>
  v <= 0.5 ? 'tutoh_ralenti' : v < 1 ? 'tutoh_mi_vitesse' : 'tutoh_vitesse_vraie';

/**
 * AU-DELA DE QUOI UNE REACTION NE VAUT PLUS RIEN : la fenetre du moteur.
 * C'est exactement le point ou `reactBonus` tombe a zero — le tutoriel ne pose
 * pas son propre seuil, il lit celui de la course.
 */
const REACTION_LIMITE = C.REACT_WINDOW;
/** Et en dessous de quoi elle est franchement bonne : la moitie de la fenetre. */
const REACTION_BELLE = (C.REACT_BEST + C.REACT_WINDOW) / 2;

type Etat = {
  geste: string; demo: boolean; fini: boolean; abandon: boolean;
  fautes: number; reaction: number | null; fauxDepart: boolean;
  transition: number | null;
} | null;

/** Ce que la sequence vaut, et le mot qui le dit. `null` tant qu'on court. */
function juger(geste: string, e: Etat): { ok: boolean; mot: string } | null {
  if (!e) return null;
  if (e.abandon) return { ok: false, mot: 'tuto_v_slow' };

  if (geste === 'alterner') {
    return e.fautes > 0
      ? { ok: false, mot: 'tuto_v_croise' }
      : { ok: true, mot: 'tuto_v_perfect' };
  }
  if (geste === 'depart') {
    if (e.fauxDepart) return { ok: false, mot: 'tuto_v_early' };
    if (e.reaction === null) return null;
    if (e.reaction > REACTION_LIMITE) return { ok: false, mot: 'tuto_v_late' };
    return { ok: true, mot: e.reaction <= REACTION_BELLE ? 'tuto_v_perfect' : 'tuto_v_good' };
  }
  if (e.fauxDepart) return { ok: false, mot: 'tuto_v_early' };
  if (e.transition === null) return null;
  // LA NOTE DE TRANSITION EST CELLE DU MOTEUR : 2 la montee parfaite, 1 la
  // montee reussie, 0 un rythme qui n'a pas monte ou qui n'aboutit pas.
  if (e.transition >= 2) return { ok: true, mot: 'tuto_v_perfect' };
  if (e.transition >= 1) return { ok: true, mot: 'tuto_v_good' };
  return { ok: false, mot: 'tuto_v_flat' };
}

export function Tutorial({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;

  const [etape, setEtape] = useState(0);        // 0,1,2 puis 3 = fin
  const [reussies, setReussies] = useState(0);
  const [demo, setDemo] = useState(true);
  const [verdict, setVerdict] = useState<{ ok: boolean; mot: string } | null>(null);
  const [reaction, setReaction] = useState<number | null>(null);

  const courante = etape < ETAPES.length ? ETAPES[etape] : ETAPES[0];
  const vitesses = courante.vitesses;
  const palier = Math.min(reussies, vitesses.length - 1);
  const tempo = demo ? DEMO : vitesses[palier];

  const raf = useRef(0);
  const traite = useRef(false);
  const minuteurs = useRef<number[]>([]);

  const attendre = (ms: number, f: () => void) => {
    minuteurs.current.push(window.setTimeout(f, ms));
  };

  /** Lancer une sequence, demo ou essai, au palier demande. */
  const lancer = useCallback((estDemo: boolean, e: number, p: number) => {
    setVerdict(null); setReaction(null);
    traite.current = false;
    const et = ETAPES[Math.min(e, ETAPES.length - 1)];
    demarrerSequence({
      geste: et.geste,
      tempo: estDemo ? DEMO : et.vitesses[Math.min(p, et.vitesses.length - 1)],
      demo: estDemo,
    });
    setDemo(estDemo);
  }, []);

  // A l'entree d'une etape : la demonstration. A la fin des trois, la piste se
  // fige — la page de felicitations ne doit pas s'afficher au-dessus d'un
  // coureur qui continue sa course.
  useEffect(() => {
    if (etape < ETAPES.length) lancer(true, etape, 0);
    else figerLaPiste();
  }, [etape, lancer]);

  // LA BOUCLE : elle fait avancer le tutoriel et regarde s'il vient de juger.
  useEffect(() => {
    if (etape >= ETAPES.length) return;
    const pas = () => {
      const e = pasDuTuto() as Etat;
      if (e && e.reaction !== null) setReaction(e.reaction);
      if (e && e.fini && !traite.current) {
        traite.current = true;
        if (e.demo) {
          attendre(1000, () => lancer(false, etape, palier));
        } else {
          const v = juger(ETAPES[etape].geste, e) ?? { ok: false, mot: 'tuto_v_slow' };
          setVerdict(v);
          attendre(1300, () => {
            if (v.ok) setReussies(r => r + 1);
            else lancer(false, etape, palier);
          });
        }
      }
      raf.current = requestAnimationFrame(pas);
    };
    raf.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf.current);
  }, [etape, palier, lancer]);

  // Une reussite par palier, et l'on passe : on ne fait pas repeter pour
  // repeter, on fait repeter pour accelerer.
  useEffect(() => {
    if (reussies === 0) return;
    if (reussies >= vitesses.length) { setReussies(0); setEtape(e => e + 1); return; }
    attendre(500, () => lancer(false, etape, reussies));
  }, [reussies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Le tutoriel rend la piste en partant : sans cela le monde resterait au
  // ralenti et l'accueil se jouerait au tiers de sa vitesse.
  useEffect(() => () => {
    minuteurs.current.forEach(clearTimeout);
    rangerLeTuto();
  }, []);

  const fini = etape >= ETAPES.length;
  const avancement = Math.min(1, reussies / vitesses.length);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col pointer-events-none
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      {/* Un voile en haut seulement : la piste doit rester lisible, le texte
          aussi, et le bas de l'ecran appartient aux touches. */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/75 to-transparent" />

      <div className="relative w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {ETAPES.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
              <motion.div className="h-full bg-primary" initial={false}
                animate={{ width: i < etape ? '100%' : i === etape ? `${avancement * 100}%` : '0%' }}
                transition={TRANSITION.progression} />
            </div>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="pointer-events-auto shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      {!fini && (
        <motion.div key={`t${etape}`} {...MONTEE}
                    className="relative flex flex-col items-center gap-1 mt-2 shrink-0">
          <span className={`text-[9px] md:text-[10px] font-bold tracking-[0.35em]
            ${demo ? 'text-cyan-300' : 'text-primary/90'}`}>
            {N.t(demo ? 'tuto_watch' : 'tuto_your_turn')}
            {/* On dit a quelle vitesse on joue, DEMO COMPRISE : montrer un
                ralenti sans le dire le fait passer pour le vrai. Aux deux
                dernieres etapes il n'y a rien a dire pendant l'essai — elles se
                jouent a la vitesse de la course, et le mot le dit. */}
            <span className={`ml-2 ${tempo < 1 ? 'text-amber-300/90' : 'text-emerald-300/90'}`}>
              · {N.t(MOT_VITESSE(tempo))}
            </span>
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight
                         uppercase text-primary text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            {N.t(courante.t)}
          </h2>
          <p className="text-[11px] md:text-xs text-white/80 text-center max-w-[32ch] leading-snug
                        drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
            {N.t(courante.s)}
          </p>
        </motion.div>
      )}

      {/* LE VERDICT, AU MEME ENDROIT QUE CELUI DES HAIES — sous le titre, au
          tiers de l'ecran, la ou le regard revient apres avoir suivi le
          coureur. Le chiffre de la reaction l'accompagne : une note sans sa
          mesure n'apprend pas a la corriger. */}
      {!fini && verdict && (
        <motion.div {...SURGISSEMENT}
                    className="absolute inset-x-0 top-[34%] flex flex-col items-center gap-0.5
                               pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          <span className={`font-black font-display tracking-wider text-2xl sm:text-3xl
            ${verdict.ok ? 'text-emerald-400' : 'text-destructive'}`}>
            {N.t(verdict.mot)}
          </span>
          {courante.geste === 'depart' && reaction !== null && (
            <span className="font-mono font-bold text-[10px] sm:text-xs tracking-widest text-white/80">
              {reaction.toFixed(3)} s
            </span>
          )}
        </motion.div>
      )}

      <div className="flex-1" />

      {fini ? (
        <div className="relative w-full max-w-lg mx-auto flex flex-col items-center gap-3 shrink-0
                        pointer-events-auto bg-[#060913]/90 rounded-2xl p-5">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight uppercase text-primary">
            {N.t('tuto_done_t')}
          </h2>
          <button onClick={() => onClose(true)}
                  className="w-full py-4 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest
                             text-background bg-primary hover:bg-primary/90 transition-all
                             border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1">
            {N.t('tuto_start')}
          </button>
          <button onClick={() => { setReussies(0); setEtape(0); }}
                  className="w-full py-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {N.t('tuto_replay')}
          </button>
        </div>
      ) : (
        /* La barre du bas ne prend pas toute la largeur : c'est la, en dessous,
           que le joueur tape, et une barre pleine largeur en pointer-events-auto
           lui volerait ses appuis au moment ou on lui en demande. */
        <div className="relative w-full max-w-lg mx-auto flex items-center justify-between gap-2 shrink-0">
          <button onClick={() => lancer(true, etape, palier)}
                  className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-lg
                             bg-black/55 text-[10px] tracking-widest
                             text-white/70 hover:text-cyan-300 transition-colors">
            <RotateCcw className="w-3 h-3" />{N.t('tuto_replay_demo')}
          </button>
          <button onClick={() => onClose(false)}
                  className="pointer-events-auto px-3 py-2 rounded-lg bg-black/55 text-[10px] tracking-widest
                             text-white/70 hover:text-white transition-colors">
            {N.t('tuto_skip')}
          </button>
        </div>
      )}
    </div>
  );
}
