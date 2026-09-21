import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE, TRANSITION } from '@/lib/mouvement';
import { Check, X, RotateCcw } from 'lucide-react';
import { bilanHaies } from '@/game/haies-course.js';
import { demarrerSequence, pasDuTuto, rangerLeTuto } from '@/game/haies-tuto.js';
import { HaiesHUD } from './HaiesHUD';

/**
 * Tutoriel des haies — SUR LA PISTE, avec le coureur et les vraies haies.
 *
 * La premiere version de cet ecran dessinait le geste : une jauge, deux paves,
 * une haie au trait. Elle enseignait proprement, et elle enseignait A COTE. Le
 * joueur apprenait a lire une jauge sur fond noir, puis decouvrait en course
 * une haie qui arrive en vue isometrique, un coureur qui occupe l'ecran, une
 * camera qui le suit. Rien de ce qu'il venait d'apprendre ne se retrouvait au
 * meme endroit, et la premiere haie reelle restait sa premiere haie.
 *
 * Ici il n'y a pas de maquette. Le moteur tourne, le coureur court, les haies
 * sont celles du reglement, et ce qui le note est ce qui le notera demain. Cet
 * ecran n'est qu'une incrustation par-dessus : un titre, une vitesse, deux
 * boutons. Tout le reste est le jeu. Voir game/haies-tuto.js.
 *
 * TROIS VITESSES, ET LE PALIER MONTE A LA REUSSITE.
 *
 * Le geste se joue en quatre dixiemes de seconde a l'approche et en un sixieme
 * au ciseau : trop vite pour une premiere fois, ou le joueur n'a pas le temps
 * de relier ce qu'il voit a ce qu'il fait. On ralentit donc le monde entier —
 * coureur, haies, camera et chrono ensemble, par game/tempo.ts — on le remonte
 * a mi-chemin, puis on le rend tel qu'il sera couru. Il faut reussir a chaque
 * palier pour passer au suivant : compte sur les ESSAIS plutot que sur les
 * reussites, un joueur juste du premier coup validait l'etape sans avoir
 * jamais joue a la vitesse de la course, et le tutoriel certifiait un geste
 * qu'il n'avait pas fait.
 *
 * Un echec ne fait pas redescendre. Celui qui rate a vitesse vraie a deja
 * montre qu'il reussissait au ralenti ; il a besoin de recommencer la ou il
 * est, pas d'etre renvoye en arriere.
 */

const VU = 'sprinter_tuto_haies_vu';

export function tutoHaiesVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTutoHaiesVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

/**
 * Les paliers, et le mot qui les nomme a l'ecran.
 *
 * Ce sont des facteurs du monde, pas des multiplicateurs de geste : a 0,45 la
 * course entiere tourne a un peu moins de la moitie de sa vitesse. Plus bas,
 * la scene devient poisseuse et le joueur perd le rythme au lieu de le voir ;
 * plus haut, la haie arrive encore trop vite pour une premiere fois.
 */
const VITESSES = [0.45, 0.7, 1];
const MOT_VITESSE = ['tutoh_ralenti', 'tutoh_mi_vitesse', 'tutoh_vitesse_vraie'];

/** Une reussite par palier : on ne quitte l'etape qu'apres la vitesse vraie. */
const REUSSITES = VITESSES.length;

/**
 * DEUX HAIES PAR SEQUENCE, ET LA SECONDE SEULE COMPTE.
 *
 * La premiere sert a arriver : on y installe sa cadence, on la franchit comme
 * on peut. C'est la seconde qui est jugee, parce qu'elle est la seule ou le
 * joueur arrive dans les conditions d'une course — lance, en rythme, et avec
 * une reception derriere lui. Une haie seule n'enseignerait que le depart
 * lance, qui n'existe dans aucune course.
 */
const HAIES_PAR_SEQUENCE = 2;

/**
 * Les quatre etapes, et ce que chacune regarde dans le bilan.
 *
 * Le tutoriel ne calcule aucune note : il lit celles que la course vient
 * d'ecrire. Un tutoriel qui recalculerait enseignerait autre chose que le jeu.
 */
const ETAPES = [
  { t: 'tutoh_1_t', s: 'tutoh_1_s', juge: 'appel' },
  { t: 'tutoh_2_t', s: 'tutoh_2_s', juge: 'ciseau' },
  { t: 'tutoh_3_t', s: 'tutoh_3_s', juge: 'cadence' },
  { t: 'tutoh_4_t', s: 'tutoh_4_s', juge: 'relance' },
] as const;

/** Les notes qui valent une reussite, de chaque cote du geste. */
const BONNES_APPEL = new Set(['parfait', 'bon']);
const BONS_CISEAUX = new Set(['ciseau', 'bon']);

/** Le compte d'appuis que le reglement demande dans un intervalle de 110 m. */
const APPUIS_JUSTES = 4;

type Bilan = {
  notes: string[];
  ciseaux: { note: string }[];
  appuis: number[];
} | null;

const lire = () => bilanHaies() as Bilan;

/**
 * Ce que la derniere haie vaut, pour l'etape qu'on joue.
 *
 * `avant` est le bilan pris au lancement de la sequence : on ne regarde que ce
 * qui s'y est ajoute depuis. Sans ce point de depart, une reussite d'il y a
 * trois essais validerait celui-ci — les listes du bilan ne se vident pas
 * entre deux sequences, et c'est tant mieux : elles sont ce que la course a
 * vraiment vu.
 */
function reussi(juge: string, avant: Bilan, apres: Bilan): boolean {
  if (!apres) return false;
  const notes = apres.notes.slice(avant ? avant.notes.length : 0);
  const ciseaux = apres.ciseaux.slice(avant ? avant.ciseaux.length : 0);
  const appuis = apres.appuis.slice(avant ? avant.appuis.length : 0);
  const dn = notes[notes.length - 1];
  const dc = ciseaux[ciseaux.length - 1];

  if (juge === 'appel') return !!dn && BONNES_APPEL.has(dn);
  if (juge === 'ciseau') return !!dc && BONS_CISEAUX.has(dc.note);
  // LA CADENCE SE LIT SUR LE COMPTE D'APPUIS, pas sur un chronometre. Quatre
  // appuis dans l'intervalle, c'est le rythme du reglement ; cinq, c'est une
  // foulee trop courte, donc une cadence trop lente pour la vitesse tenue.
  if (juge === 'cadence') return appuis[appuis.length - 1] === APPUIS_JUSTES;
  // LA RELANCE TIENT LES DEUX BOUTS : une reception nette, et la haie suivante
  // franchie avec. C'est la synthese, et c'est pour cela qu'elle vient en
  // dernier — mal se recevoir ne se paie qu'a la haie d'apres.
  return !!dc && BONS_CISEAUX.has(dc.note) && !!dn && BONNES_APPEL.has(dn);
}

export function TutorialHaies({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;

  const [etape, setEtape] = useState(0);        // 0..3 puis 4 = fin
  const [reussies, setReussies] = useState(0);
  const [demo, setDemo] = useState(true);       // on montre avant de rendre la main
  const [juste, setJuste] = useState<boolean | null>(null);

  const palier = Math.min(reussies, VITESSES.length - 1);
  const raf = useRef(0);
  const avant = useRef<Bilan>(null);
  const traite = useRef(false);
  const minuteurs = useRef<number[]>([]);

  const attendre = (ms: number, f: () => void) => {
    minuteurs.current.push(window.setTimeout(f, ms));
  };

  /** Lancer une sequence, demo ou essai, au palier demande. */
  const lancer = useCallback((estDemo: boolean, p: number) => {
    setJuste(null);
    traite.current = false;
    avant.current = lire();
    demarrerSequence({
      // LA DEMO ET L'ESSAI PARTENT DE LA MEME HAIE. En changer entre les deux
      // changerait la geometrie sous les pieds du joueur a l'instant precis ou
      // on lui rend la main.
      haie: 0,
      nb: HAIES_PAR_SEQUENCE,
      // La demo se joue toujours au ralenti : c'est la seule fois ou le joueur
      // n'a encore rien vu. L'essai suit le palier ou il en est.
      tempo: estDemo ? VITESSES[0] : VITESSES[p],
      demo: estDemo,
    });
    setDemo(estDemo);
  }, []);

  // A l'entree d'une etape : la demonstration.
  useEffect(() => {
    if (etape < ETAPES.length) lancer(true, 0);
  }, [etape, lancer]);

  // LA BOUCLE. Elle fait avancer le tutoriel — le pilote de la demo, le gel a
  // la derniere haie — et regarde si la sequence vient de se terminer.
  useEffect(() => {
    if (etape >= ETAPES.length) return;
    const pas = () => {
      const e = pasDuTuto();
      if (e && e.fini && !traite.current) {
        traite.current = true;
        if (e.demo) {
          // Un temps d'arret sur l'image, puis on rend la main.
          attendre(900, () => lancer(false, palier));
        } else {
          // Une sequence abandonnee — le coureur s'est arrete avant la haie —
          // n'est pas une haie ratee mais une haie jamais tentee. Elle ne peut
          // pas valoir une reussite, meme si la haie precedente etait bonne.
          const ok = !e.abandon && reussi(ETAPES[etape].juge, avant.current, lire());
          setJuste(ok);
          attendre(1100, () => { if (ok) setReussies(r => r + 1); else lancer(false, palier); });
        }
      }
      raf.current = requestAnimationFrame(pas);
    };
    raf.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf.current);
  }, [etape, palier, lancer]);

  // Trois haies reussies — une par vitesse — et l'on passe : on ne fait pas
  // repeter pour repeter, on fait repeter pour accelerer.
  useEffect(() => {
    if (reussies === 0) return;
    if (reussies >= REUSSITES) { setReussies(0); setEtape(e => e + 1); return; }
    attendre(400, () => lancer(false, Math.min(reussies, VITESSES.length - 1)));
  }, [reussies, lancer]);

  // Le tutoriel rend la piste en partant. Sans cela le monde resterait au
  // ralenti et les haies suivraient le joueur sur sa prochaine course.
  useEffect(() => () => {
    minuteurs.current.forEach(clearTimeout);
    rangerLeTuto();
  }, []);

  const fini = etape >= ETAPES.length;
  const avancement = Math.min(1, reussies / REUSSITES);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col pointer-events-none
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      {/* LE HUD DES HAIES, CELUI DE LA COURSE. Les verdicts que le joueur lit
          ici sont ceux qu'il lira demain, au meme endroit de l'ecran et dans
          les memes couleurs. C'est la moitie de ce que ce tutoriel enseigne. */}
      {!fini && <HaiesHUD />}

      {/* Un voile en haut seulement : la piste doit rester lisible, le texte
          aussi, et le bas de l'ecran appartient aux touches d'attaque. */}
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
            {/* On dit a quelle vitesse on joue, DEMO COMPRISE. Montrer un
                ralenti sans le dire le fait passer pour le vrai, et le geste
                se reapprend a la vitesse suivante. On nomme aussi la vitesse
                vraie : savoir qu'on vient de tenir le geste de la course fait
                partie de ce qu'on apprend. */}
            <span className={`ml-2 ${demo || palier < VITESSES.length - 1
              ? 'text-amber-300/90' : 'text-emerald-300/90'}`}>
              · {N.t(MOT_VITESSE[demo ? 0 : palier])}
            </span>
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight
                         uppercase text-primary text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            {N.t(ETAPES[etape].t)}
          </h2>
          <p className="text-[11px] md:text-xs text-white/80 text-center max-w-[32ch] leading-snug
                        drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
            {N.t(ETAPES[etape].s)}
          </p>
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
        /* LA BARRE DU BAS NE PREND PAS TOUTE LA LARGEUR. C'est la, en dessous,
           que le joueur tape : une barre pleine largeur en pointer-events-auto
           lui volerait ses appuis au moment ou on lui demande d'en donner. */
        <div className="relative w-full max-w-lg mx-auto flex items-center justify-between gap-2 shrink-0">
          <button onClick={() => lancer(true, palier)}
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
