import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Share2, Radio, ChevronDown, Crown, Loader2 } from 'lucide-react';
import { OuvrirDansLeNavigateur } from '@/components/OuvrirDansLeNavigateur';
import { MONTEE } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { GameCanvas } from '@/components/GameCanvas';
import { Drapeau } from '@/components/Insignes';
import { RejeuChampionnat } from './RejeuChampionnat';
import { RaceHUD } from './RaceHUD';
import { suivreRejeu, lireRejeu } from '@/game/champ-rejeu';
import { fluxDirect, type Edition } from '@/game/championnats';
import {
  demandeDeLUrl, editionDuMoment, etatEdition, programme, regarderLaCourse,
  lienDeLEdition, type CourseDuProgramme,
} from '@/game/regarder';

/**
 * LA PAGE PUBLIQUE D'UN CHAMPIONNAT — `?regarder=<edition>`.
 *
 * Le stade tourne derriere, flou et sombre ; devant, le programme du weekend.
 * Une course courue porte un bouton, et ce bouton lance exactement le rejeu de
 * l'application (presentation des huit, course, tableau). A la fermeture du
 * tableau, le moteur rentre a l'accueil et le programme revient.
 *
 * Rien du jeu ordinaire n'est monte ici : ni bienvenue, ni tutoriel, ni
 * invitation a installer, ni boite aux lettres. Le spectateur n'a pas de
 * compte et n'en a pas besoin. Seul le bouton du bas l'invite a jouer.
 *
 * LE FIL SE LIT PAR CURSEUR, comme dans l'application : une annonce de cette
 * zone fait relire l'edition. Relire l'edition entiere toutes les dix secondes
 * pour chaque spectateur couterait quatre requetes D1 par personne ; le fil
 * n'en coute qu'une.
 */

const CADENCE_MS = 10_000;
const OR = '#F8CD4A';

const chrono = (ms: number | null) => ms == null ? '—' : (ms / 1000).toFixed(3) + ' s';

function delai(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const j = Math.floor(s / 86400);
  if (j >= 1) return `${j} j ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}

/** L'heure, dans le fuseau et la langue du spectateur — il n'est pas forcement en France. */
function heure(at: number): string {
  try {
    return new Date(at).toLocaleString(SprinterApp.N.getLang() === 'en' ? 'en-GB' : 'fr-FR',
      { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/* --------------------------------------------------------------- une course */

function CarteCourse({ c, ouverte, onBasculer, onRegarder, neuve }: {
  c: CourseDuProgramme; ouverte: boolean; neuve: boolean;
  onBasculer: () => void; onRegarder: () => void;
}) {
  const { N } = SprinterApp;
  const podium = c.arrivee.slice(0, 3);
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-col gap-2
      ${c.courue ? 'bg-black/45 border-primary/30' : 'bg-black/30 border-white/8'}
      ${neuve ? 'ring-2 ring-primary/70' : ''}`}>
      <div className="flex items-center gap-2">
        <button onClick={onBasculer} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className="font-display font-black tracking-wider text-sm text-foreground truncate">
            {c.nom}
          </span>
          {c.at != null && (
            <span className="text-[10px] text-muted-foreground truncate">{heure(c.at)}</span>
          )}
          {(c.couloirs.length > 0 || c.arrivee.length > 0) && (
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform
              ${ouverte ? 'rotate-180' : ''}`} />
          )}
        </button>
        {c.courue ? (
          <button onClick={onRegarder}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                       bg-primary text-primary-foreground text-[10px] font-black tracking-widest
                       active:scale-95 transition">
            <Play className="w-3 h-3 fill-current" />
            {N.t('regarder_bouton')}
          </button>
        ) : (
          <span className="shrink-0 text-[9px] font-bold tracking-widest text-muted-foreground/70">
            {N.t('regarder_a_venir')}
          </span>
        )}
      </div>

      {/* Le podium tient sur une ligne, sans ouvrir la carte : c'est ce qu'on
          vient chercher quand on n'a pas le temps de regarder la course. */}
      {c.courue && !ouverte && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {podium.map(r => (
            <span key={r.place} className="truncate">
              <span className="font-mono text-primary">{r.place}</span> {r.nom}
              <span className="font-mono opacity-70"> {chrono(r.ms)}</span>
            </span>
          ))}
        </div>
      )}

      {ouverte && (
        <div className="flex flex-col gap-1">
          {c.courue
            ? c.arrivee.map(r => (
                <div key={r.place} className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono w-4 text-primary tabular-nums">{r.place}</span>
                  <span className="font-mono text-[9px] w-4 h-4 grid place-items-center rounded
                                   border border-white/12 text-muted-foreground/70">{r.couloir ?? '—'}</span>
                  <span className="flex-1 truncate font-bold">{r.nom}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{chrono(r.ms)}</span>
                </div>
              ))
            : c.couloirs.length > 0
              ? c.couloirs.map(p => (
                  <div key={p.couloir} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-[9px] w-4 h-4 grid place-items-center rounded
                                     border border-white/12 text-muted-foreground/70">{p.couloir}</span>
                    <Drapeau pays={p.pays} className="text-[12px]" />
                    <span className="flex-1 truncate font-bold">{p.nom}</span>
                  </div>
                ))
              : <p className="text-[10px] text-muted-foreground">{N.t('regarder_attente')}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- l'ecran */

function Programme({ e, focus }: { e: Edition; focus: string | null }) {
  const { N } = SprinterApp;
  const prog = useMemo(() => programme(e), [e]);
  const [ouvertes, setOuvertes] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  const [maintenant, setMaintenant] = useState(Date.now());
  const [copie, setCopie] = useState(false);

  // Les courses qui viennent d'arriver pendant que la page etait ouverte. On
  // les souligne plutot que de les lancer : un rejeu qui part tout seul, son
  // compris, dans un onglet qu'on regardait a peine, c'est une page qu'on ferme.
  const vues = useRef<Set<string> | null>(null);
  const [neuves, setNeuves] = useState<string[]>([]);
  useEffect(() => {
    const courues = prog.filter(c => c.courue).map(c => c.cle);
    if (vues.current) {
      const n = courues.filter(k => !vues.current!.has(k));
      if (n.length) setNeuves(v => [...v, ...n]);
    }
    vues.current = new Set(courues);
  }, [prog]);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const suivante = prog.find(c => !c.courue && c.at != null && c.at > maintenant) || null;
  const derniere = neuves.length ? prog.find(c => c.cle === neuves[neuves.length - 1]) : null;
  const titre = N.titreEdition(e) || e.titre;

  const partager = async () => {
    const url = lienDeLEdition(e.id);
    try {
      if (navigator.share) { await navigator.share({ title: titre, url }); return; }
    } catch { /* annule : on retombe sur la copie */ }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true); setTimeout(() => setCopie(false), 2000);
    } catch { /* rien a faire de plus */ }
  };

  const regarder = (c: CourseDuProgramme) => {
    setNeuves(v => v.filter(k => k !== c.cle));
    regarderLaCourse(e, c);
  };

  const phases = e.phases.map(p => ({
    p, courses: prog.filter(c => c.phase === p.cle),
  }));

  return (
    <motion.div {...MONTEE}
      className="absolute inset-0 z-20 pointer-events-auto overflow-y-auto
                 bg-[#060913]/80 backdrop-blur-[2px]">
      <div className="mx-auto w-full max-w-md px-4 flex flex-col gap-4
                      pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <OuvrirDansLeNavigateur />
        <header className="flex flex-col items-center gap-1.5 text-center">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-400/40
                           bg-red-500/15 text-red-300 text-[9px] font-black tracking-[0.25em]">
            <Radio className="w-3 h-3" /> {N.t('regarder_direct')}
          </span>
          <h1 className="font-display font-black tracking-wider text-2xl leading-tight flex items-center gap-2">
            <Drapeau pays={e.echelon === 'national' ? e.zone : null} className="text-xl" />
            {titre}
          </h1>
          <p className="text-[11px] font-bold tracking-[0.3em] text-primary">{e.epreuve} M</p>
          {e.champion && (
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: OR }}>
              <Crown className="w-4 h-4" /> {N.t('regarder_champion')} · {e.champion}
            </p>
          )}
          {e.etat === 'annulee' && (
            <p className="text-xs text-muted-foreground">{N.t('regarder_annulee')}</p>
          )}
        </header>

        <AnimatePresence>
          {derniere && (
            <motion.button key={derniere.cle} {...MONTEE} onClick={() => regarder(derniere)}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                         bg-primary text-primary-foreground font-black text-xs tracking-wider
                         active:scale-[0.98] transition">
              <span>{N.t('regarder_nouveau', { c: derniere.nom })}</span>
              <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5 fill-current" />{N.t('regarder_bouton')}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {suivante && suivante.at != null && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl
                          border border-primary/35 bg-primary/10">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold tracking-[0.25em] text-primary/80">{N.t('regarder_prochaine')}</span>
              <span className="font-display font-black text-base">{suivante.nom}</span>
              <span className="text-[10px] text-muted-foreground">{heure(suivante.at)}</span>
            </div>
            <span className="font-mono font-bold text-lg tabular-nums text-primary">
              {N.t('regarder_dans', { d: delai(suivante.at - maintenant) })}
            </span>
          </div>
        )}

        {phases.map(({ p, courses }) => (
          <section key={p.cle} className="flex flex-col gap-2">
            <h2 className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground px-1">
              {N.phaseNom(p.cle, p.nom)}
            </h2>
            {courses.map(c => (
              <CarteCourse key={c.cle} c={c}
                neuve={neuves.includes(c.cle)}
                ouverte={ouvertes.has(c.cle)}
                onBasculer={() => setOuvertes(s => {
                  const n = new Set(s); if (n.has(c.cle)) n.delete(c.cle); else n.add(c.cle); return n;
                })}
                onRegarder={() => regarder(c)} />
            ))}
          </section>
        ))}

        <p className="text-[10px] text-center text-muted-foreground/70">{N.t('regarder_rejeu_note')}</p>

        <div className="flex flex-col gap-2 items-center">
          <button onClick={partager}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20
                       bg-white/[0.06] text-[11px] font-bold tracking-[0.2em] active:scale-95 transition">
            <Share2 className="w-3.5 h-3.5" />
            {copie ? N.t('regarder_copie') : N.t('regarder_partager')}
          </button>
          <a href={import.meta.env.BASE_URL || '/'}
            className="px-5 py-2.5 rounded-full bg-primary/15 border border-primary/40 text-primary
                       text-[11px] font-black tracking-[0.2em] active:scale-95 transition">
            {N.t('regarder_jouer')}
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function Message({ texte, attente }: { texte: string; attente?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center px-6 bg-[#060913]/80 pointer-events-auto">
      <div className="flex flex-col items-center gap-4 text-center">
        {attente && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        <p className="text-sm text-muted-foreground max-w-[28ch]">{texte}</p>
        {!attente && (
          <a href={import.meta.env.BASE_URL || '/'}
            className="px-5 py-2.5 rounded-full bg-primary/15 border border-primary/40 text-primary
                       text-[11px] font-black tracking-[0.2em]">
            {SprinterApp.N.t('regarder_jouer')}
          </a>
        )}
      </div>
    </div>
  );
}

export function Regarder() {
  const [demande] = useState(demandeDeLUrl);
  const [id, setId] = useState<string | null>(demande?.edition ?? null);
  const [e, setE] = useState<Edition | null>(null);
  const [perdu, setPerdu] = useState(false);
  const rejeu = useSyncExternalStore(suivreRejeu, lireRejeu, lireRejeu);
  const state = useGameStore(s => s.state);
  const countT = useGameStore(s => s.countT);

  // Le jeu s'ouvre sur son generique (« SPRINTER » qui tombe lettre a lettre,
  // « tap to start »). Le spectateur n'a rien a toucher : on passe directement
  // au stade.
  useEffect(() => { if (SprinterApp.G.state === 'open') SprinterApp.G.state = 'title'; }, []);

  useEffect(() => {
    if (id) return;
    let vivant = true;
    editionDuMoment().then(x => { if (!vivant) return; if (x) setId(x); else setPerdu(true); });
    return () => { vivant = false; };
  }, [id]);

  const relire = useCallback(async () => {
    if (!id) return;
    const x = await etatEdition(id);
    if (x) setE(x); else setPerdu(p => p || true);
  }, [id]);

  useEffect(() => { void relire(); }, [relire]);

  // Le fil de la zone : une annonce nouvelle, et on relit.
  useEffect(() => {
    if (!e) return;
    let curseur = -1;
    let vivant = true;
    const tic = async () => {
      if (document.hidden) return;
      const f = await fluxDirect(Math.max(0, curseur), e.zone);
      if (!vivant || !f) return;
      if (curseur >= 0 && f.annonces.some(a => a.edition === e.id)) void relire();
      curseur = f.curseur;
    };
    void tic();
    const t = setInterval(tic, CADENCE_MS);
    const auRetour = () => { if (!document.hidden) void relire(); };
    document.addEventListener('visibilitychange', auRetour);
    return () => { vivant = false; clearInterval(t); document.removeEventListener('visibilitychange', auRetour); };
  }, [e?.id, e?.zone, relire]);

  useEffect(() => {
    if (e) document.title = `${SprinterApp.N.titreEdition(e) || e.titre} · ${e.epreuve} m — Sprinter`;
  }, [e]);

  const { N } = SprinterApp;
  return (
    <div className="relative w-full h-[var(--app-height,100dvh)] bg-[#060913] overflow-hidden font-sans text-foreground select-none">
      <GameCanvas />
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {/* Le chrono et l'en-tete de la retransmission, comme dans le jeu — mais
            pas pendant la presentation, ou le decompte est suspendu. */}
        {rejeu.actif && (state === 'count' || state === 'race') && !(state === 'count' && countT <= -90)
          && <RaceHUD />}
        <RejeuChampionnat />
      </div>
      {!rejeu.actif && (
        e ? <Programme e={e} focus={demande?.course ?? null} />
          : perdu ? <Message texte={N.t('regarder_rien')} />
          : <Message texte={N.t('regarder_chargement')} attente />
      )}
    </div>
  );
}
