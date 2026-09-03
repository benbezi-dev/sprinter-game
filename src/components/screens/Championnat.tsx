import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Trophy, Loader2, Timer, Flag, Sparkles, Medal } from 'lucide-react';
import { SprinterApp, buzz } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { lancerCeremonie, useCeremonieChampionnat } from '@/game/ceremonie-championnat';
import { Drapeau } from '@/components/Insignes';
import {
  etatEdition, fluxDirect, prochain, grille, arrivee,
  type Edition, type Annonce, type Partant,
} from '@/game/championnats';

/**
 * Le championnat, tel qu'on le suit.
 *
 * Quatre moments, un seul ecran : la grille de depart, l'avancee dans les
 * phases, la revelation des repeches, et le sacre. Les separer en quatre
 * ecrans aurait oblige le spectateur a naviguer pendant que la competition se
 * joue — or il n'a rien a faire d'autre que regarder.
 *
 * Le fil d'annonces est la seule source de mouvement. On le lit par curseur,
 * et chaque annonce declenche une relecture de l'etat : c'est le serveur qui
 * decide de ce qui s'est passe, jamais l'ecran qui le devine.
 */

const CADENCE_MS = 4000;
const OR = '#F8CD4A';

/** « 2 h 14 min » a partir d'un delai en millisecondes. */
function delai(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${s} s`;
}

const chrono = (ms: number | null) => ms == null ? '—' : (ms / 1000).toFixed(3) + ' s';

/* ------------------------------------------------------------------ phases */

function FilDesPhases({ e }: { e: Edition }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {e.phases.map((p, i) => {
        const passee = i < e.phaseIndex || e.etat === 'terminee';
        const active = i === e.phaseIndex && e.etat !== 'terminee';
        return (
          <React.Fragment key={p.cle}>
            {i > 0 && <span className={`h-px w-4 ${passee ? 'bg-primary/60' : 'bg-white/12'}`} />}
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest border
              ${active ? 'bg-primary/20 text-primary border-primary/50'
                : passee ? 'text-primary/70 border-primary/25'
                : 'text-muted-foreground/50 border-white/8'}`}>
              {p.nom}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------- la grille de depart */

function Couloir({ p, place, ms, direct }: {
  p: Partant; place?: number | null; ms?: number | null; direct: boolean;
}) {
  const couru = place != null;
  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border
      ${couru && direct ? 'bg-primary/12 border-primary/40'
        : couru ? 'bg-black/25 border-white/8'
        : 'bg-black/20 border-white/6'}`}>
      <span className={`font-mono text-[10px] w-4 shrink-0 tabular-nums
        ${couru ? 'text-primary' : 'text-muted-foreground/60'}`}>
        {couru ? place : '·'}
      </span>
      <Drapeau pays={p.pays} className="text-[12px]" />
      <span className="text-[11px] font-bold tracking-wide truncate flex-1 text-foreground">
        {p.nom}
      </span>
      {p.rang_duel != null && !couru && (
        <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
          {SprinterApp.N.ord(p.rang_duel)}
        </span>
      )}
      {couru && (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
          {chrono(ms ?? null)}
        </span>
      )}
      {couru && direct && (
        <span className="text-[8px] font-bold tracking-widest text-primary shrink-0">Q</span>
      )}
    </div>
  );
}

function Grille({ e }: { e: Edition }) {
  const courses = grille(e);
  if (!courses.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {courses.map(({ course, couloirs }) => {
        const fin = arrivee(e, e.phase, course);
        const places = new Map(fin.map((r, i) => [r.name_key, { place: i + 1, ms: r.ms }]));
        const courue = fin.length > 0;
        return (
          <div key={course} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                {e.phaseNom} {e.courses > 1 ? course : ''}
              </span>
              {courue && e.directsParCourse > 0 && (
                <span className="text-[9px] text-primary/70 tracking-wide">
                  {SprinterApp.N.t('champ_directs', { n: e.directsParCourse })}
                </span>
              )}
            </div>
            {(courue
              ? fin.map(r => e.partants.find(p => p.name_key === r.name_key)!).filter(Boolean)
              : couloirs
            ).map((p, i) => {
              const r = places.get(p.name_key);
              return (
                <Couloir key={p.name_key} p={p}
                         place={r?.place} ms={r?.ms}
                         direct={!!r && r.place <= e.directsParCourse} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------ la revelation des repeches */

/**
 * Le seul moment de la competition ou le suspense est fabrique plutot que
 * couru : les repeches n'ont gagne aucune course, ils sortent du classement de
 * toutes. On les fait donc apparaitre un par un — sans cela, l'information la
 * plus attendue du weekend tomberait comme une ligne de tableau.
 */
function Revelation({ a, onFini }: { a: Annonce; onFini: () => void }) {
  const { N } = SprinterApp;
  const repeches: { nom: string; ms: number | null; course: number }[] =
    (a.donnees && a.donnees.repeches) || [];
  const [montres, setMontres] = useState(0);

  useEffect(() => {
    if (montres >= repeches.length) return;
    const t = setTimeout(() => setMontres(m => m + 1), montres === 0 ? 900 : 700);
    return () => clearTimeout(t);
  }, [montres, repeches.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#05070d]"
         style={{ backgroundImage:
           'radial-gradient(120% 80% at 50% 35%, rgba(248,205,74,0.06), transparent 70%)' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-sm flex flex-col items-center gap-4">
        <Sparkles className="w-5 h-5" style={{ color: OR }} />
        <h2 className="font-display font-black tracking-widest text-center text-lg"
            style={{ color: OR }}>
          {N.t('champ_reveal')}
        </h2>
        <p className="text-[11px] text-white/50 text-center leading-snug max-w-[26ch]">
          {N.t('champ_reveal_desc')}
        </p>

        <div className="w-full flex flex-col gap-1.5 mt-1">
          {repeches.slice(0, montres).map((r, i) => (
            <motion.div key={r.nom + i}
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl
                         bg-primary/12 border border-primary/35">
              <span className="font-mono text-[10px] text-primary/70 w-4">{i + 1}</span>
              <span className="flex-1 font-bold text-sm tracking-wide truncate text-foreground">
                {r.nom}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {chrono(r.ms)}
              </span>
            </motion.div>
          ))}
        </div>

        {montres >= repeches.length && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={onFini}
            className="mt-3 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                       text-background text-sm"
            style={{ backgroundColor: OR }}>
            {N.t('champ_continue')}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- le podium */

/**
 * La ceremonie.
 *
 * Un podium n'est pas un tableau de resultats : le classement est deja lisible
 * a l'ecran d'arrivee, et le refaire ici n'apprendrait rien a personne. Ce que
 * cet ecran doit produire, c'est le moment — d'ou une sequence qui se deroule
 * plutot qu'un etat qui s'affiche : les marches montent du bas dans l'ordre du
 * suspense (bronze, argent, or), chaque plaque arrive quand sa marche s'est
 * posee, et le nom du champion ne tombe qu'apres, seul, quand plus rien ne
 * bouge autour.
 *
 * Deux regles tenues du bout a l'autre :
 *
 *  - **Aucune hauteur n'est animee.** Les marches montent par `translateY`
 *    derriere un `overflow-hidden` : le navigateur ne recalcule pas la mise en
 *    page a chaque image, et surtout le contenu de la marche ne s'ecrase pas
 *    comme le ferait un `scaleY`.
 *  - **Les plaques sont dans le flux.** L'ancienne version les posait en
 *    `absolute -top-11`, donc la mise en page ne leur reservait aucune place :
 *    la marche du vainqueur faisant 96 px, sa plaque remontait dans le nom du
 *    champion et les deux s'ecrivaient l'un sur l'autre. Une colonne est
 *    desormais une pile — plaque, puis marche — et le chevauchement ne peut
 *    plus revenir, quelle que soit la hauteur des marches.
 */

/** La hauteur d'une marche, et le moment ou elle se leve. */
const MARCHE = {
  1: { hauteur: 132, retard: 1.30 },
  2: { hauteur: 96,  retard: 0.90 },
  3: { hauteur: 66,  retard: 0.55 },
} as const;

const METAL = { 1: OR, 2: '#CBD5E1', 3: '#B45309' } as const;

/** La hauteur reservee aux plaques. Fixe : les trois colonnes s'alignent. */
const PLAQUE_H = 74;

function Podium({ e, onFerme }: { e: Edition; onFerme: () => void }) {
  const { N } = SprinterApp;
  const doux = useReducedMotion();
  // Sur un ecran qui refuse le mouvement, la ceremonie n'a pas lieu : tout est
  // deja pose. Rien n'est retire pour autant — le podium se lit entier.
  const t = (secondes: number) => (doux ? 0 : secondes);

  const fin = arrivee(e, 'finale', 1);
  const trois = fin.slice(0, 3);

  /**
   * Un athlete salue sur la piste, derriere le podium.
   *
   * Le moteur sait deja le faire — c'est `presenterCoureur`, la presentation
   * d'avant-course — et il montre la piste en permanence derriere l'ecran
   * titre. Il n'y a donc rien a dessiner : on designe quelqu'un, la camera
   * vient sur lui et il leve les bras.
   *
   * Qui, cela depend. Si le champion est le joueur, c'est SON coureur : le
   * salut lui revient. Sinon on prend un rival, et surtout pas le sien —
   * voir son propre athlete triompher d'un titre gagne par un autre serait
   * un mensonge que le nom affiche juste au-dessus dementirait aussitot.
   */
  useEffect(() => {
    const G: any = SprinterApp.G;
    const coureurs: any[] = G?.runners || [];
    if (!coureurs.length) return;
    const moi = getSavedName().trim().toLowerCase();
    const cestMoi = !!e.champion && e.champion.trim().toLowerCase() === moi;
    const cible = cestMoi ? G.player
      : coureurs.find(r => r !== G.player) || G.player;
    SprinterApp.presenterCoureur(cible || null);
    return () => { SprinterApp.presenterCoureur(null); };
  }, [e.champion]);

  /**
   * Le son et la secousse, cales sur les marches.
   *
   * Trois petites secousses qui montent — bronze, argent, or — puis le son de
   * victoire au moment ou la marche d'or se pose. L'escalier s'entend autant
   * qu'il se voit, et sur un telephone tenu en main c'est la secousse, pas
   * l'image, qui fait sursauter.
   *
   * `sfx` passe par le melangeur du jeu : coupe le son du jeu, la ceremonie
   * se tait avec lui. La secousse suit `prefers-reduced-motion`, qui vaut
   * aussi pour ce qu'on sent.
   */
  useEffect(() => {
    if (doux) { try { SprinterApp.Audio_.sfx('win'); } catch { /* muet */ } return; }
    const rendez = [
      { a: (MARCHE[3].retard + 0.62) * 1000, faire: () => buzz(10) },
      { a: (MARCHE[2].retard + 0.62) * 1000, faire: () => buzz(14) },
      { a: (MARCHE[1].retard + 0.62) * 1000, faire: () => {
          buzz(32); try { SprinterApp.Audio_.sfx('win'); } catch { /* muet */ } } },
    ];
    const t = rendez.map(r => setTimeout(r.faire, r.a));
    return () => t.forEach(clearTimeout);
  }, [doux]);

  // Le pays de chacun : sur un podium continental ou mondial, c'est la moitie
  // de ce qu'on regarde.
  const paysDe = (cle: string) =>
    e.partants.find(p => p.name_key === cle)?.pays || null;
  const paysDuChampion = trois[0] ? paysDe(trois[0].name_key) : null;
  // L'ordre visuel d'un podium : deuxieme, premier, troisieme.
  const ordre = [trois[1], trois[0], trois[2]].filter(Boolean);

  // Les paillettes sont tirees une fois pour toutes : recalculees a chaque
  // rendu, elles sauteraient d'une position a l'autre au premier battement du
  // fil d'annonces, qui continue de tourner derriere la ceremonie.
  const paillettes = React.useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const h = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      x: h(1) * 100,
      taille: 3 + h(2) * 4,
      retard: 1.45 + h(3) * 1.1,
      duree: 2.4 + h(4) * 1.8,
      tour: (h(5) - 0.5) * 540,
      or: h(6) > 0.35,
    };
  }), []);

  // Le partage de l'ecran, qui est tout le sujet.
  //
  // Piste et ceremonie superposees se genent : le trophee tombait sur la tete
  // d'un athlete et le titre passait sur le rouge des couloirs, illisible. On
  // les separe donc en hauteur — le stade en haut, la ceremonie en bas, sur du
  // noir. C'est l'idee des deux voiles de la presentation d'avant-course : ne
  // montrer du jeu que la bande qui sert.
  //
  // Le degrade est porte par la BANDE, pas par l'ecran. En pourcentages de
  // l'ecran il tombait juste sur un grand telephone et faux sur un petit :
  // a 360 x 640 la ceremonie, qui mesure ce qu'elle mesure, remontait dans la
  // partie claire et le titre repassait sur le rouge des couloirs. Ancre au
  // contenu, le fondu se place toujours juste au-dessus du trophee, quelle que
  // soit la hauteur de l'ecran.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center
                    backdrop-blur-[1px] overflow-hidden"
         style={{ backgroundColor: 'rgba(5,7,13,0.34)' }}>
      <div className="w-full flex justify-center px-6 pt-24
                      pb-[max(env(safe-area-inset-bottom),1.5rem)]"
           style={{ backgroundImage: [
             'radial-gradient(120% 70% at 50% 60%, rgba(248,205,74,0.10), transparent 72%)',
             // Des arrets en PIXELS, pas en pourcentages. En pourcentages, le
             // fondu se dilate avec la bande : sur un ecran court la bande
             // occupe presque tout, le fondu s'etale, et le trophee se retrouve
             // encore dans le clair. En pixels il fait toujours 120 px et finit
             // juste au-dessus du trophee, a 360 x 640 comme a 390 x 844.
             'linear-gradient(to bottom, rgba(5,7,13,0) 0px, rgba(5,7,13,0.72) 44px,' +
             ' rgba(5,7,13,0.95) 82px, rgb(5,7,13) 124px)',
           ].join(', ') }}>

      {/* La lueur qui respire. Elle ne dit rien, elle empeche seulement le fond
          d'etre une surface morte pendant les trois secondes ou l'on regarde. */}
      {!doux && (
        <motion.div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage:
            'radial-gradient(65% 45% at 50% 62%, rgba(248,205,74,0.16), transparent 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.62, 0.9] }}
          transition={{ delay: 1.2, duration: 6, times: [0, 0.2, 0.6, 1], repeat: Infinity }} />
      )}

      {/* Les paillettes tombent une fois, pas en boucle : une chute perpetuelle
          derriere un ecran qui attend un appui devient un papier peint. */}
      {!doux && (
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          {paillettes.map((p, i) => (
            <motion.span key={i} className="absolute top-0 rounded-[1px]"
              style={{
                left: `${p.x}%`, width: p.taille, height: p.taille * 2.2,
                backgroundColor: p.or ? OR : 'rgba(255,255,255,0.75)',
              }}
              initial={{ y: -30, opacity: 0, rotate: 0 }}
              animate={{ y: '105vh', opacity: [0, 1, 1, 0], rotate: p.tour }}
              transition={{ delay: p.retard, duration: p.duree, ease: 'linear',
                            opacity: { times: [0, 0.08, 0.75, 1], duration: p.duree } }} />
          ))}
        </div>
      )}

      {/* Un seul balayage, a l'instant ou la marche d'or se pose. Repete, il
          deviendrait un effet ; une fois, il marque le moment. */}
      {!doux && (
        <motion.div aria-hidden
          className="absolute inset-y-0 w-40 pointer-events-none"
          style={{ left: 0, backgroundImage:
            'linear-gradient(100deg, transparent, rgba(255,246,210,0.13), transparent)' }}
          initial={{ x: '-40vw', opacity: 0 }}
          animate={{ x: '110vw', opacity: [0, 1, 1, 0] }}
          transition={{ delay: 1.62, duration: 0.95, ease: 'easeOut',
                        opacity: { times: [0, 0.15, 0.7, 1], duration: 0.95 } }} />
      )}

      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: t(0.35) }}
                  className="relative w-full max-w-sm flex flex-col items-center">

        <motion.div initial={{ opacity: 0, y: -14, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: t(0.15), type: 'spring', stiffness: 260, damping: 16 }}>
          <Trophy className="w-7 h-7" style={{ color: OR }} />
        </motion.div>

        <motion.p className="text-[10px] tracking-[0.3em] text-white/40 uppercase mt-4 text-center"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: t(0.35), duration: t(0.4) }}>
          {e.titre}
        </motion.p>

        {/* Le nom arrive apres les trois marches : il est la conclusion de la
            sequence, pas son titre. Le reflet qui le traverse une fois est ce
            qui fait la difference entre « affiche en dore » et « sacre ». */}
        <motion.div className="flex items-center justify-center gap-2 mt-1 min-h-[2.6rem]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: t(1.75), duration: t(0.5), ease: [0.25, 0.46, 0.45, 0.94] }}>
          <Drapeau pays={paysDuChampion} className="text-2xl" />
          <motion.h2 className="font-display font-black text-3xl tracking-tight text-center"
            style={doux ? { color: OR } : {
              backgroundImage: `linear-gradient(100deg, ${OR} 0%, ${OR} 38%, #FFF6D2 50%, ${OR} 62%, ${OR} 100%)`,
              backgroundSize: '260% 100%', backgroundPosition: '160% 0%',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}
            animate={doux ? undefined : { backgroundPosition: ['160% 0%', '-60% 0%'] }}
            transition={{ delay: t(2.05), duration: 1.4, ease: 'easeInOut' }}>
            {e.champion}
          </motion.h2>
        </motion.div>

        <div className="flex items-end justify-center gap-2 w-full mt-4">
          {ordre.map(r => {
            const rang = (trois.indexOf(r) + 1) as 1 | 2 | 3;
            const { hauteur, retard } = MARCHE[rang];
            return (
              <div key={r.name_key} className="flex-1 flex flex-col items-center justify-end">

                {/* La plaque, dans le flux et a hauteur fixe : les trois se
                    lisent sur la meme ligne quelles que soient les marches. */}
                <motion.div
                  className="flex flex-col items-center justify-end gap-0.5 w-full px-0.5 pb-2"
                  style={{ height: PLAQUE_H }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: t(retard + 0.34), duration: t(0.4) }}>
                  <Medal className="w-3.5 h-3.5 shrink-0" style={{ color: METAL[rang] }} />
                  <span className="flex items-center gap-1 max-w-full">
                    <Drapeau pays={paysDe(r.name_key)} className="text-[11px]" />
                    <span className="text-[10px] font-bold tracking-wide truncate text-foreground">
                      {r.nom}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                    {chrono(r.ms)}
                  </span>
                </motion.div>

                {/* La marche. Le cadre garde la hauteur finale des le depart —
                    c'est lui qui reserve la place — et le bloc monte dedans. */}
                <div className="w-full overflow-hidden" style={{ height: hauteur }}>
                  <motion.div
                    className="h-full flex items-end justify-center rounded-t-lg border-t border-x pb-2"
                    style={{
                      borderColor: rang === 1 ? OR : 'rgba(255,255,255,0.14)',
                      background: rang === 1
                        ? 'linear-gradient(to top, rgba(248,205,74,0.22), rgba(248,205,74,0.05))'
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: rang === 1 ? `0 0 24px -6px ${OR}55` : undefined,
                    }}
                    initial={{ y: '100%' }} animate={{ y: '0%' }}
                    transition={{ delay: t(retard), duration: t(0.62),
                                  ease: [0.16, 0.84, 0.34, 1] }}>
                    <span className="font-display font-black text-lg"
                          style={{ color: rang === 1 ? OR : 'rgba(255,255,255,0.5)' }}>
                      {rang}
                    </span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Le sol. Sans lui les marches s'arretent sur un bord net et paraissent
            coupees plutot que posees. Le reflet en dessous fait le reste : c'est
            lui, et pas la ligne, qui donne une matiere au sol. */}
        <motion.div aria-hidden
          className="h-px w-full max-w-[19rem] bg-gradient-to-r from-transparent via-white/28 to-transparent"
          initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: t(0.5), duration: t(0.5) }} />
        <motion.div aria-hidden
          className="w-full max-w-[19rem] h-10 -mt-px pointer-events-none"
          style={{ backgroundImage:
            'radial-gradient(60% 100% at 50% 0%, rgba(248,205,74,0.20), transparent 72%)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: t(1.9), duration: t(0.8) }} />

        <motion.p className="text-[10px] text-white/35 text-center mt-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: t(2.3), duration: t(0.4) }}>
          {N.t('champ_titre_duree')}
        </motion.p>

        <motion.button onClick={onFerme}
          className="mt-3 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background text-sm"
          style={{ backgroundColor: OR }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(2.45), duration: t(0.4) }}>
          {N.t('champ_continue')}
        </motion.button>
      </motion.div>
      </div>
    </div>
  );
}

/**
 * La ceremonie, montee par App et non par le panneau.
 *
 * Elle ne rend rien tant que personne ne l'a declaree ; c'est ce qui permet de
 * la poser inconditionnellement a cote des autres calques.
 */
export function CeremonieChampionnat() {
  const c = useCeremonieChampionnat();
  return (
    <AnimatePresence>
      {c && <Podium key={c.edition.id} e={c.edition} onFerme={c.onFini} />}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ l'ecran */

export function Championnat({ edition, onQuitter }: {
  edition: string; onQuitter?: () => void;
}) {
  const { N } = SprinterApp;
  const [e, setE] = useState<Edition | null>(null);
  const [fil, setFil] = useState<Annonce[]>([]);
  const [revelation, setRevelation] = useState<Annonce | null>(null);
  const [podium, setPodium] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());
  const curseur = useRef(0);
  const vu = useRef(new Set<number>());

  // L'horloge locale, pour le compte a rebours du prochain rendez-vous.
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Le fil commande tout : chaque annonce provoque une relecture de l'etat.
  // C'est le serveur qui dit ce qui s'est passe, jamais l'ecran qui le devine.
  useEffect(() => {
    let vivant = true;
    const battre = async () => {
      const f = await fluxDirect(curseur.current);
      if (!vivant || !f) return;
      if (f.annonces.length) {
        curseur.current = f.curseur;
        const miennes = f.annonces.filter(a => a.edition === edition);
        if (miennes.length) {
          setFil(v => [...miennes.reverse(), ...v].slice(0, 30));
          const etat = await etatEdition(edition);
          if (vivant && etat) setE(etat);
          for (const a of miennes) {
            if (vu.current.has(a.id)) continue;
            vu.current.add(a.id);
            if (a.type === 'reveal-demies' || a.type === 'reveal-finale') setRevelation(a);
            if (a.type === 'sacre') setPodium(true);
          }
        }
      }
    };
    // Premiere lecture : on prend l'etat, puis on se cale sur la FIN du fil.
    //
    // « La fin » demande une boucle, et c'est le piege : le serveur repond par
    // pages, si bien qu'une seule requete laisse le curseur au milieu de
    // l'historique. Les annonces suivantes arrivent alors comme si elles
    // etaient nouvelles — a l'ouverture, l'ecran rejouait la revelation des
    // repeches d'un championnat termine il y a des jours, dans un autre pays.
    (async () => {
      const etat = await etatEdition(edition);
      if (vivant && etat) setE(etat);
      for (let page = 0; page < 40; page++) {
        const f = await fluxDirect(curseur.current);
        if (!vivant || !f) return;
        f.annonces.forEach(a => vu.current.add(a.id));
        if (!f.annonces.length || f.curseur === curseur.current) break;
        curseur.current = f.curseur;
      }
    })();
    const t = setInterval(battre, CADENCE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [edition]);

  /**
   * On declare la ceremonie plutot que de la rendre.
   *
   * La jouer ici la condamnerait a rester dans le panneau, donc par-dessus le
   * menu, donc sans la piste derriere. Elle est donc confiee au module qui la
   * porte, et l'ecran-titre s'efface pendant qu'elle dure — ce panneau compris.
   * D'ou le fait qu'on lui passe `e` en entier : quand elle joue, plus personne
   * ici ne peut lui repondre.
   *
   * Rien ne se rejoue au remontage : le curseur du fil est deja cale sur la fin
   * et toutes les annonces passees sont marquees vues.
   *
   * Et surtout : **on ne l'annule pas au demontage**. Declarer la ceremonie
   * efface l'ecran-titre, donc ce panneau, donc le nettoyage de cet effet — qui
   * l'annulait dans la foulee, ramenait le menu, remontait le panneau, et ainsi
   * de suite. L'ecran clignotait sans jamais rien montrer. Une fois lancee, la
   * ceremonie ne s'arrete que par sa propre sortie.
   */
  const declaree = useRef(false);
  useEffect(() => {
    if (!e || revelation || !podium || e.etat !== 'terminee') return;
    if (declaree.current) return;
    declaree.current = true;
    lancerCeremonie({ edition: e, onFini: () => lancerCeremonie(null) });
  }, [e, revelation, podium]);

  if (!e) {
    return (
      <div className="bg-card/70 border border-white/10 rounded-2xl p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rv = prochain(e.calendrier, maintenant);

  return (
    <>
      <AnimatePresence>
        {revelation && (
          <Revelation a={revelation} onFini={() => setRevelation(null)} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card/70 backdrop-blur-xl border rounded-2xl p-4 md:p-5 shadow-2xl
                   flex flex-col gap-4"
        style={{ borderColor: 'rgba(248,205,74,0.28)' }}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" style={{ color: OR }} />
            <h3 className="text-[10px] md:text-xs font-bold tracking-widest" style={{ color: OR }}>
              {e.titre.toUpperCase()}
            </h3>
          </div>
          {e.etat === 'terminee' && e.champion && (
            <button onClick={() => setPodium(true)}
                    className="text-[11px] font-bold tracking-wide text-primary underline-offset-2 hover:underline">
              {N.t('champ_sacre', { n: e.champion })}
            </button>
          )}
        </div>

        <FilDesPhases e={e} />

        {/* Le prochain rendez-vous. Le calendrier est en UTC et s'affiche a
            l'heure d'ici : « le meme weekend partout » n'a de sens que sur une
            horloge commune, mais personne ne veut lire UTC. */}
        {rv && e.etat !== 'terminee' && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl
                          bg-black/30 border border-white/8">
            <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <Timer className="w-3.5 h-3.5" />
              {rv.reveal ? N.t('champ_rv_reveal')
                : rv.ceremonie ? N.t('champ_rv_sacre')
                : N.t('champ_rv_course')}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: OR }}>
              {delai(rv.at - maintenant)}
            </span>
          </div>
        )}

        <Grille e={e} />

        {/* Le fil, en petit : ce qui vient de se passer, dans l'ordre inverse. */}
        {fil.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-white/8">
            {fil.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-baseline gap-2">
                <Flag className="w-2.5 h-2.5 shrink-0 mt-1" style={{ color: OR, opacity: 0.7 }} />
                <span className="text-[10px] text-muted-foreground leading-snug">
                  <span className="text-foreground/80 font-bold">{a.titre}</span>
                  {a.texte ? ' — ' + a.texte : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {onQuitter && (
          <button onClick={onQuitter}
                  className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {N.t('champ_quitter')}
          </button>
        )}
      </motion.div>
    </>
  );
}
