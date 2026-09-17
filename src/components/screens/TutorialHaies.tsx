import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE, SURGISSEMENT, TRANSITION } from '@/lib/mouvement';
import { ChevronLeft, ChevronRight, Check, X, RotateCcw } from 'lucide-react';
import { APPEL, CISEAU_VISE, volDe, jugerAppel, jugerCiseau,
         PLAFOND_INTERVALLE } from '@/game/haies-jeu.js';

/**
 * Tutoriel des haies — montre, puis fais.
 *
 * Meme patron que celui de Sprinter, et pour la meme raison : trois choses
 * decident d'une course de haies, et aucune ne se transmet par une phrase. On
 * les joue devant le joueur, sur les paves memes qu'il va utiliser, puis on lui
 * rend la main. Le texte se reduit a un titre de deux mots.
 *
 *   L'APPEL     la jauge monte pendant l'approche ; on appuie quand elle est
 *               pleine. C'est le seul instant ou un appui devient un decollage.
 *   LE CISEAU   on garde le pouce pendant le vol, et on relache quand la jauge
 *               se remplit une seconde fois. Appuyer lance la jambe d'attaque,
 *               relacher ramene la jambe arriere : un seul geste continu.
 *   LA CADENCE  ni plus vite ni plus lent. C'est la seule qui contredit
 *               Sprinter, et c'est celle qui merite le plus d'exister.
 *   LA RELANCE  ce que la reception decide pour l'intervalle suivant. La
 *               quatrieme etape est arrivee apres les autres, avec le systeme
 *               qu'elle enseigne : mal se recevoir coupe la vitesse, et on ne
 *               la reprend pas en tapant plus fort — on la reprend en courant
 *               les trois foulees. C'est la synthese, et c'est ce qui fait que
 *               les trois premieres comptent.
 *
 * LE TUTORIEL NE TOUCHE PAS AU MOTEUR — MAIS IL NOTE AVEC SES FORMULES. Les
 * verdicts sortent de jugerAppel() et de jugerCiseau(), les memes fonctions qui
 * noteront le joueur en course. Un tutoriel qui recalculerait sa propre note
 * enseignerait autre chose que le jeu, et le joueur apprendrait le mensonge.
 */

const VU = 'sprinter_tuto_haies_vu';

export function tutoHaiesVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTutoHaiesVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

type Cote = 'left' | 'right';

/**
 * Le 110 m haies sert de reference, et la vitesse est celle d'un hurdleur en
 * pleine course — 9,2 m/s, a un dixieme de ce que Coh a mesure sur Jackson.
 * Le tutoriel doit demander exactement ce que la course demandera.
 */
const CLE = '110h';
const V = 9.2;

/**
 * Ce que la jauge d'approche represente, en metres : deux foulees de hurdleur
 * jusqu'au point d'appel (haies-pas.js, FENETRE_APPEL). A 9,2 m/s cela fait
 * quatre dixiemes de seconde — c'est court, et c'est le jeu. La demo se rejoue
 * autant de fois qu'on veut.
 */
const APPROCHE_M = 3.7;
const APPROCHE_S = APPROCHE_M / V;

/** La duree du vol, et l'instant ou le ciseau doit tomber dedans. */
const VOL_S = volDe(CLE, V);
const CISEAU_S = VOL_S * CISEAU_VISE;

/**
 * LA BANDE DE CADENCE JUSTE, en frappes par seconde.
 *
 * Mesuree, pas choisie : c'est la bande ou le compte du reglement tombe — sept
 * appuis jusqu'a la premiere haie puis quatre par intervalle. En dessous on
 * s'etire, au-dessus on hache. tools/haies-course-test.mjs la CHERCHE a chaque
 * passage plutot que de la poser ; si elle se deplace un jour, c'est ici qu'il
 * faudra la suivre.
 */
const BANDE = [8, 10];
const BANDE_MS = [1000 / BANDE[1], 1000 / BANDE[0]];   // 100 a 125 ms
const CADENCE_DEMO = (BANDE[0] + BANDE[1]) / 2;
const FRAPPES_CIBLE = 12;

/** Combien de haies reussies avant de passer a la suite. */
const REUSSITES = 2;

/**
 * DE COMBIEN ON RALENTIT LES PREMIERS ESSAIS, et pendant combien.
 *
 * Le geste des haies se joue en quatre dixiemes de seconde a l'approche et en
 * un sixieme au ciseau. C'est le jeu, et c'est trop rapide pour une premiere
 * fois : le joueur n'a pas le temps de faire le lien entre ce qu'il voit et ce
 * qu'il fait, donc il ne l'apprend pas, il le subit. On joue donc les deux
 * premiers essais de chaque etape au ralenti, puis a la vitesse vraie.
 *
 * Le jugement, lui, ne ralentit pas : il porte sur la POSITION de la jauge, pas
 * sur le temps ecoule. Un ciseau net au ralenti est un ciseau net.
 */
const RALENTI = 1.8;
const ESSAIS_RALENTIS = 2;

function mediane(v: number[]): number {
  if (!v.length) return 0;
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** La distance a la haie quand la jauge d'approche en est la. */
const avantDe = (jauge: number) => APPEL[CLE].avant + (1 - jauge) * APPROCHE_M;

export function TutorialHaies({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;

  const [etape, setEtape] = useState(0);        // 0,1,2,3 puis 4 = fin
  // L'etape du ciseau et celle de la relance se jouent de la meme facon : une
  // approche, un appel, un vol, un relache. Seul change ce qu'on regarde.
  const etapeHaie = etape === 0 || etape === 1 || etape === 3;
  const [demo, setDemo] = useState(true);       // on montre avant de rendre la main

  // La jauge, de 0 a 1 puis au-dela quand on est en retard. `phase` dit ce
  // qu'elle represente : l'approche, le vol, ou rien.
  const [jauge, setJauge] = useState(0);
  const [phase, setPhase] = useState<'rien' | 'approche' | 'vol'>('rien');
  const [flash, setFlash] = useState<Cote | null>(null);

  const [note, setNote] = useState<string | null>(null);
  const [reussies, setReussies] = useState(0);
  const [essais, setEssais] = useState(0);
  // Le plafond laisse par la derniere reception, et sa remontee — l'etape 4.
  const [relance, setRelance] = useState<number | null>(null);
  const lent = essais < ESSAIS_RALENTIS;
  const facteur = lent ? RALENTI : 1;

  // Etape de la cadence : les intervalles entre frappes, et leur mediane.
  const [frappes, setFrappes] = useState<number[]>([]);
  const [verdictCadence, setVerdictCadence] = useState<string | null>(null);

  const raf = useRef(0);
  const minuteurs = useRef<number[]>([]);
  const t0 = useRef(0);
  const tenu = useRef<Cote | null>(null);
  const derniereFrappe = useRef(0);
  const dernierCote = useRef<Cote | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    minuteurs.current.forEach(clearTimeout);
    minuteurs.current = [];
  }, []);

  const attendre = (ms: number, f: () => void) => {
    minuteurs.current.push(window.setTimeout(f, ms));
  };

  useEffect(() => stop, [stop]);

  /** La jauge monte de 0 a `fin` en `duree` secondes, puis appelle `apres`. */
  const monter = useCallback((duree: number, fin: number, apres?: () => void) => {
    t0.current = performance.now();
    const pas = () => {
      const e = (performance.now() - t0.current) / 1000;
      const v = e / duree;
      setJauge(Math.min(fin, v));
      if (v < fin) raf.current = requestAnimationFrame(pas);
      else if (apres) apres();
    };
    raf.current = requestAnimationFrame(pas);
  }, []);

  /* --- la demo : on joue le geste devant le joueur ---------------------- */

  const lancerDemo = useCallback((e: number) => {
    stop();
    setDemo(true); setNote(null); setJauge(0); setPhase('rien');
    setFlash(null); setFrappes([]); setVerdictCadence(null);

    if (e === 0) {
      // L'approche monte, le pave s'allume pile a la jauge pleine.
      attendre(500, () => {
        setPhase('approche');
        monter(APPROCHE_S, 1, () => {
          setFlash('left'); setNote('parfait');
          attendre(260, () => setFlash(null));
          attendre(1400, () => { setPhase('rien'); setJauge(0); setDemo(false); setNote(null); });
        });
      });
      return;
    }

    if (e === 1 || e === 3) {
      attendre(400, () => {
        setPhase('approche');
        monter(APPROCHE_S, 1, () => {
          setFlash('left');                         // on appuie — et on GARDE
          setPhase('vol');
          monter(CISEAU_S, 1, () => {
            setFlash(null);                         // on relache : le ciseau
            setNote('ciseau');
            // A l'etape de la relance, la demo montre AUSSI ce qu'un ciseau
            // rate couterait : la barre tombe, puis se remplit.
            if (e === 3) {
              attendre(500, () => {
                setRelance(PLAFOND_INTERVALLE.absent);
                const t0r = performance.now();
                const remonte = () => {
                  const x = Math.min(1, (performance.now() - t0r) / 1400);
                  setRelance(PLAFOND_INTERVALLE.absent + (1 - PLAFOND_INTERVALLE.absent) * x);
                  if (x < 1) raf.current = requestAnimationFrame(remonte);
                  else attendre(600, () => { setRelance(null); setPhase('rien'); setJauge(0); setDemo(false); setNote(null); });
                };
                raf.current = requestAnimationFrame(remonte);
              });
              return;
            }
            attendre(1500, () => { setPhase('rien'); setJauge(0); setDemo(false); setNote(null); });
          });
        });
      });
      return;
    }

    // La cadence : les deux paves battent la bande juste, l'un apres l'autre.
    const gap = 1000 / CADENCE_DEMO;
    for (let i = 0; i < FRAPPES_CIBLE; i++) {
      attendre(400 + i * gap, () => {
        setFlash(i % 2 ? 'right' : 'left');
        attendre(Math.min(70, gap / 2), () => setFlash(null));
      });
    }
    attendre(400 + FRAPPES_CIBLE * gap + 700, () => setDemo(false));
  }, [monter, stop]);

  useEffect(() => { if (etape < 4) lancerDemo(etape); return stop; }, [etape, lancerDemo, stop]);

  /* --- a toi ------------------------------------------------------------ */

  /** Le tour du joueur commence : la jauge repart. */
  const armer = useCallback(() => {
    stop(); setNote(null); setJauge(0);
    setPhase('approche');
    // Elle deborde jusqu'a 1,6 : etre en retard doit se voir, pas s'arreter.
    //
    // ET LA HAIE MANQUEE SE RELEVE. Sans le minuteur qui rend la main, le
    // verdict restait affiche pour toujours : `note` n'etait efface que par une
    // pression, et une pression est refusee hors approche. Le joueur qui ratait
    // sa toute premiere haie se retrouvait devant un tutoriel mort.
    monter(APPROCHE_S * facteur, 1.6, () => {
      setPhase('rien'); setNote('percute'); setEssais(e => e + 1);
      attendre(1200, () => { setNote(null); setJauge(0); });
    });
  }, [monter, stop, facteur]);

  useEffect(() => {
    if (demo || !etapeHaie) return;
    if (note !== null) return;
    if (phase === 'rien') attendre(400, armer);
  }, [demo, etapeHaie, phase, note, armer]);

  const presser = useCallback((cote: Cote) => {
    if (demo) return;

    if (etape === 2) {
      const t = performance.now();
      if (dernierCote.current === cote) return;     // on alterne, comme en course
      if (derniereFrappe.current) {
        setFrappes(f => {
          const n = [...f, t - derniereFrappe.current];
          if (n.length >= FRAPPES_CIBLE) {
            const m = mediane(n);
            setVerdictCadence(m < BANDE_MS[0] ? 'hache' : m > BANDE_MS[1] ? 'etire' : 'juste');
          }
          return n;
        });
      }
      derniereFrappe.current = t; dernierCote.current = cote;
      setFlash(cote); attendre(60, () => setFlash(null));
      return;
    }

    if (phase !== 'approche' || note !== null) return;
    // LA MEME FORMULE QUE LA COURSE. La jauge dit ou l'on en est de l'approche ;
    // jugerAppel() en tire la note, exactement comme appeler() le fera.
    const j = jugerAppel(CLE, avantDe(Math.min(1, jauge)), V);
    stop();
    if (etape === 0) {
      setNote(j.note); setFlash(cote);
      attendre(220, () => setFlash(null));
      if (j.note === 'parfait' || j.note === 'bon') setReussies(r => r + 1);
      setEssais(e => e + 1);
      attendre(1200, () => { setNote(null); setJauge(0); setPhase('rien'); });
      return;
    }
    // Etape du ciseau : l'appel ouvre le vol, et l'on attend le relache.
    tenu.current = cote; setFlash(cote);
    setPhase('vol');
    monter(CISEAU_S * facteur, 2.2, () => {
      setPhase('rien'); setNote('absent'); setFlash(null); tenu.current = null;
      setEssais(e => e + 1);
      attendre(1300, () => { setNote(null); setJauge(0); });
    });
  }, [demo, etape, phase, jauge, note, monter, stop, facteur]);

  const relacher = useCallback((cote: Cote) => {
    if (demo || (etape !== 1 && etape !== 3) || phase !== 'vol' || tenu.current !== cote) return;
    stop(); setFlash(null); tenu.current = null;
    const jc = jugerCiseau(Math.min(1, jauge) * CISEAU_VISE, VOL_S);
    setNote(jc.note); setPhase('rien');
    if (jc.note === 'ciseau' || jc.note === 'bon') setReussies(r => r + 1);
    setEssais(e => e + 1);
    if (etape === 3) {
      // CE QUE LA RECEPTION VIENT DE DECIDER. La barre tombe a ce que le
      // ciseau a laisse, puis remonte — comme en course, ou elle l'a retrouve
      // au point d'appel suivant.
      const bas = (PLAFOND_INTERVALLE as Record<string, number>)[jc.note] ?? 1;
      setRelance(bas);
      const t0r = performance.now();
      const remonte = () => {
        const x = Math.min(1, (performance.now() - t0r) / 1400);
        setRelance(bas + (1 - bas) * x);
        if (x < 1) raf.current = requestAnimationFrame(remonte);
        else attendre(500, () => { setRelance(null); setNote(null); setJauge(0); });
      };
      raf.current = requestAnimationFrame(remonte);
      return;
    }
    attendre(1300, () => { setNote(null); setJauge(0); });
  }, [demo, etape, phase, jauge, stop]);

  // Trois haies reussies et l'on passe : on ne fait pas repeter pour repeter.
  useEffect(() => {
    if (reussies >= REUSSITES) {
      setReussies(0); setEssais(0);
      attendre(500, () => setEtape(e => e + 1));
    }
  }, [reussies]);

  useEffect(() => {
    if (verdictCadence === 'juste') attendre(1200, () => setEtape(3));
  }, [verdictCadence]);

  // Le clavier repete le geste du pouce : maintenir et relacher.
  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') presser('left');
      else if (e.key === 'ArrowRight') presser('right');
      else if (e.key === 'Escape') onClose(false);
    };
    const haut = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') relacher('left');
      else if (e.key === 'ArrowRight') relacher('right');
    };
    window.addEventListener('keydown', bas);
    window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  }, [presser, relacher, onClose]);

  const titres = ['tutoh_1_t', 'tutoh_2_t', 'tutoh_3_t', 'tutoh_4_t'];
  const sous = ['tutoh_1_s', 'tutoh_2_s', 'tutoh_3_s', 'tutoh_4_s'];
  const avancement = etape === 2
    ? Math.min(1, frappes.length / FRAPPES_CIBLE)
    : Math.min(1, reussies / REUSSITES);

  // La couleur de la jauge EST le jugement : la meme regle qu'en course, ou
  // l'ecran ne doit jamais montrer autre chose que ce qu'il notera.
  const zone = phase === 'approche' ? jugerAppel(CLE, avantDe(Math.min(1, jauge)), V).note
    : phase === 'vol' ? jugerCiseau(Math.min(1, jauge) * CISEAU_VISE, VOL_S).note
    : null;
  const teinte = zone === 'parfait' || zone === 'ciseau' ? 'bg-emerald-400'
    : zone === 'bon' ? 'bg-primary'
    : zone === 'hache' || zone === 'traine' ? 'bg-destructive'
    : 'bg-white/30';

  const motVerdict = note === null ? null
    : note === 'percute' ? 'haie_percute'
    : ['ciseau', 'accroche', 'traine', 'absent'].includes(note) ? 'haie_c_' + note
    : note === 'bon' && etape === 1 ? 'haie_c_bon'
    : 'haie_' + note;
  const tonVerdict = note === 'parfait' || note === 'ciseau' ? 'text-green-400'
    : note === 'bon' ? 'text-primary'
    : note === 'plane' || note === 'accroche' || note === 'traine' ? 'text-amber-400'
    : 'text-destructive';

  return (
    <div className="fixed inset-0 z-[60] bg-[#060913] flex flex-col pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      <div className="w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-primary" initial={false}
                animate={{ width: i < etape ? '100%' : i === etape ? `${avancement * 100}%` : '0%' }}
                transition={TRANSITION.progression} />
            </div>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-3 py-3 min-h-0">

        {etape < 4 && (
          <motion.div key={`t${etape}`} {...MONTEE} className="flex flex-col items-center gap-1">
            <span className={`text-[9px] md:text-[10px] font-bold tracking-[0.35em]
              ${demo ? 'text-cyan-300' : 'text-primary/70'}`}>
              {N.t(demo ? 'tuto_watch' : 'tuto_your_turn')}
              {/* On dit qu'on ralentit. Un geste qui change de vitesse sans
                  prevenir se reapprend a la vitesse suivante. */}
              {!demo && lent && etapeHaie && (
                <span className="ml-2 text-amber-300/80">· {N.t('tutoh_ralenti')}</span>
              )}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight uppercase text-primary text-center">
              {N.t(titres[etape])}
            </h2>
            {/* UNE LIGNE, ET UNE SEULE. Celui de Sprinter n'en a pas, parce
                qu'alterner se voit. Tenir ne se voit pas : un pouce pose et un
                pouce qui tape ont la meme image. Il faut le dire. */}
            <p className="text-[11px] md:text-xs text-foreground/60 text-center max-w-[30ch] leading-snug">
              {N.t(sous[etape])}
            </p>
          </motion.div>
        )}

        {/* --- la scene --- */}
        <div className="w-full flex-1 min-h-[110px] flex flex-col items-center justify-center gap-3">

          {etapeHaie && (
            <>
              {/* La haie, et le coureur qui vient dessus. Rien d'autre : ce
                  qu'il faut regarder est la jauge, en bas, sur le pave. */}
              <div className="relative w-full max-w-xs h-14">
                <div className="absolute inset-x-0 bottom-0 h-px bg-white/20" />
                <div className="absolute bottom-0 right-8 w-10 h-9 border-t-2 border-x-2 border-white/45 rounded-t-sm" />
                <motion.div
                  className="absolute bottom-1 w-2.5 h-2.5 rounded-full bg-primary"
                  initial={false}
                  animate={{
                    left: `${8 + Math.min(1.25, jauge) * 62}%`,
                    bottom: phase === 'vol' ? 26 : 4,
                  }}
                  transition={{ duration: 0.06, ease: 'linear' }}
                />
              </div>

              {/* LA BARRE DE RELANCE — l'etape 4. Elle tombe a ce que la
                  reception a laisse, puis remonte : on ne reprend pas sa
                  vitesse en tapant plus fort, on la reprend en courant. C'est
                  la meme barre qu'en course (HaiesHUD). */}
              {relance !== null && (
                <motion.div {...SURGISSEMENT} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] tracking-[0.3em] text-amber-300/90">
                    {N.t('haie_relance')}
                  </span>
                  <div className="w-24 h-1.5 rounded-full bg-black/50 overflow-hidden">
                    <div className="h-full bg-amber-300/80"
                         style={{ width: `${Math.round(relance * 100)}%` }} />
                  </div>
                </motion.div>
              )}

              {motVerdict && (
                <motion.div {...SURGISSEMENT} className="flex flex-col items-center gap-0.5">
                  <span className={`font-black font-display tracking-wider text-xl ${tonVerdict}`}>
                    {N.t(motVerdict)}
                  </span>
                  {/* La faute la plus frequente merite qu'on redise quoi faire,
                      la, sous le verdict — pas dans un coin de l'ecran. */}
                  {note === 'absent' && (
                    <span className="text-[11px] tracking-widest text-amber-300/90">
                      {N.t('tutoh_tenir')}
                    </span>
                  )}
                </motion.div>
              )}
            </>
          )}

          {etape === 2 && (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex gap-1 h-10 items-end w-full">
                {Array.from({ length: FRAPPES_CIBLE }).map((_, i) => {
                  const g = frappes[i];
                  const dedans = g >= BANDE_MS[0] && g <= BANDE_MS[1];
                  return (
                    <div key={i} className="flex-1 flex items-end h-full">
                      <motion.div initial={false}
                        animate={{ height: g ? `${Math.max(8, Math.min(100, (g / 200) * 100))}%` : '6%' }}
                        className={`w-full rounded-sm ${g ? (dedans ? 'bg-emerald-400' : 'bg-destructive/70') : 'bg-white/12'}`} />
                    </div>
                  );
                })}
              </div>
              {/* La bande juste, dessinee : le joueur vise une zone, pas un chiffre. */}
              <div className="w-full h-1 rounded-full bg-white/10 relative overflow-hidden">
                <div className="absolute inset-y-0 bg-emerald-400/60"
                     style={{ left: `${(BANDE_MS[0] / 200) * 100}%`, width: `${((BANDE_MS[1] - BANDE_MS[0]) / 200) * 100}%` }} />
              </div>
              {verdictCadence && (
                <motion.span {...SURGISSEMENT}
                             className={`font-black font-display tracking-wider text-xl
                               ${verdictCadence === 'juste' ? 'text-green-400' : 'text-destructive'}`}>
                  {N.t('tutoh_c_' + verdictCadence)}
                </motion.span>
              )}
            </div>
          )}

          {etape === 4 && (
            <motion.div {...SURGISSEMENT} className="flex flex-col items-center gap-3">
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

      {/* --- les paves : la jauge y vit, comme en course --- */}
      {etape < 4 ? (
        <div className="w-full max-w-lg mx-auto shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {(['left', 'right'] as Cote[]).map(cote => {
              const allume = flash === cote;
              // LA JAUGE DU VOL S'ALLUME DES DEUX COTES : le pouce est pose sur
              // le pave qu'il tient, et elle monte du bas — elle se remplissait
              // donc sous le doigt. « Relache quand c'est plein » en cachant le
              // plein. L'autre pave est libre, et il montre la meme chose.
              const sienne = etapeHaie && (demo ? cote === 'left' : phase !== 'rien');
              return (
                <button
                  key={cote}
                  onPointerDown={e => { e.preventDefault(); presser(cote); }}
                  onPointerUp={() => relacher(cote)}
                  onPointerCancel={() => relacher(cote)}
                  className={`relative overflow-hidden h-24 sm:h-28 md:h-32 rounded-2xl border-2
                              flex items-center justify-center select-none touch-none
                              transition-[background-color,border-color] duration-75
                              ${allume ? 'border-cyan-300 bg-cyan-300/30'
                                : 'border-white/15 bg-white/[0.06] active:bg-primary/25 active:border-primary/50'}
                              ${demo ? 'opacity-90' : ''}`}
                >
                  {sienne && phase !== 'rien' && (
                    <div className={`absolute inset-x-0 bottom-0 ${teinte} transition-[height] duration-[60ms]`}
                         style={{ height: `${Math.min(1, jauge) * 100}%`, opacity: 0.55 }} />
                  )}
                  <span className="relative">
                    {cote === 'left'
                      ? <ChevronLeft className={`w-9 h-9 md:w-11 md:h-11 ${allume ? 'text-cyan-100' : 'text-foreground/55'}`} />
                      : <ChevronRight className={`w-9 h-9 md:w-11 md:h-11 ${allume ? 'text-cyan-100' : 'text-foreground/55'}`} />}
                  </span>
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
            <button onClick={() => onClose(false)}
                    className="px-2 py-1.5 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              {N.t('tuto_skip')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg mx-auto flex flex-col gap-2 shrink-0">
          <button onClick={() => onClose(true)}
                  className="w-full py-4 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest
                             text-background bg-primary hover:bg-primary/90 transition-all
                             border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1">
            {N.t('tuto_start')}
          </button>
          <button onClick={() => { setReussies(0); setFrappes([]); setVerdictCadence(null); setEtape(0); }}
                  className="w-full py-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {N.t('tuto_replay')}
          </button>
        </div>
      )}
    </div>
  );
}
