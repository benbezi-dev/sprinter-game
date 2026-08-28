import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Loader2, Timer, Flag, Sparkles, Medal } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6
                    bg-gradient-to-b from-black/94 via-black/90 to-black/95 backdrop-blur-sm">
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

function Podium({ e, onFerme }: { e: Edition; onFerme: () => void }) {
  const { N } = SprinterApp;
  const fin = arrivee(e, 'finale', 1);
  const trois = fin.slice(0, 3);
  // L'ordre visuel d'un podium : deuxieme, premier, troisieme.
  const ordre = [trois[1], trois[0], trois[2]].filter(Boolean);
  const hauteurs = [64, 96, 48];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6
                    bg-gradient-to-b from-black/95 via-[#0a0a12]/95 to-black/96">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-sm flex flex-col items-center gap-5">
        <Trophy className="w-7 h-7" style={{ color: OR }} />
        <div className="text-center">
          <p className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-1">
            {e.titre}
          </p>
          <h2 className="font-display font-black text-3xl tracking-tight" style={{ color: OR }}>
            {e.champion}
          </h2>
        </div>

        <div className="flex items-end justify-center gap-2 w-full mt-2">
          {ordre.map((r, i) => {
            const rang = trois.indexOf(r) + 1;
            return (
              <motion.div key={r.name_key}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: hauteurs[i], opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.18, type: 'spring', stiffness: 200, damping: 22 }}
                className="flex-1 flex flex-col justify-end items-center rounded-t-lg border-t border-x
                           px-1 pb-2 relative"
                style={{
                  borderColor: rang === 1 ? OR : 'rgba(255,255,255,0.14)',
                  background: rang === 1
                    ? 'linear-gradient(to top, rgba(248,205,74,0.22), rgba(248,205,74,0.05))'
                    : 'rgba(255,255,255,0.05)',
                }}>
                <span className="absolute -top-11 flex flex-col items-center gap-0.5 w-full">
                  <Medal className="w-3.5 h-3.5"
                         style={{ color: rang === 1 ? OR : rang === 2 ? '#CBD5E1' : '#B45309' }} />
                  <span className="text-[10px] font-bold tracking-wide truncate max-w-full px-1 text-foreground">
                    {r.nom}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                    {chrono(r.ms)}
                  </span>
                </span>
                <span className="font-display font-black text-lg"
                      style={{ color: rang === 1 ? OR : 'rgba(255,255,255,0.5)' }}>
                  {rang}
                </span>
              </motion.div>
            );
          })}
        </div>

        <p className="text-[10px] text-white/35 text-center mt-2">
          {N.t('champ_titre_duree')}
        </p>
        <button onClick={onFerme}
          className="mt-1 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background text-sm"
          style={{ backgroundColor: OR }}>
          {N.t('champ_continue')}
        </button>
      </motion.div>
    </div>
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
    // Premiere lecture : on prend l'etat, et on se cale sur la fin du fil pour
    // ne pas rejouer a l'ouverture toutes les annonces deja passees.
    (async () => {
      const etat = await etatEdition(edition);
      if (vivant && etat) setE(etat);
      const f = await fluxDirect(0);
      if (vivant && f) { curseur.current = f.curseur; f.annonces.forEach(a => vu.current.add(a.id)); }
    })();
    const t = setInterval(battre, CADENCE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [edition]);

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
        {!revelation && podium && e.etat === 'terminee' && (
          <Podium e={e} onFerme={() => setPodium(false)} />
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
