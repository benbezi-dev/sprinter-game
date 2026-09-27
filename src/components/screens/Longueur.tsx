import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { MONDES } from '@/game/mondes';
import { EST_TEST } from '@/game/canal';
import { RECORDS, ESSAIS, TEMPS_ESSAI, lireVent, homologable } from '@/game/longueur.js';
import {
  PLATEAU, nouveauConcours, avancerJusquAuJoueur, inscrire, classement, aQui, tirerVent,
  joueurEnLice, placeDuJoueur, meilleur, tours,
} from '@/game/longueur-jeu.js';
import {
  armerConcoursSaut, appelerSauteur, mettreAuRepos, rangerConcoursSaut, ecouterSaut, etatSaut,
} from '@/game/longueur-course.js';

/**
 * LE CONCOURS DE SAUT EN LONGUEUR.
 *
 * Le saut se joue dans le stade, sur le moteur de Sprinter : cet ecran ne
 * dessine pas l'athlete, il tient le CONCOURS — l'ordre de passage, les
 * adversaires qui sautent avant toi, la minute, le tableau, la coupe apres le
 * troisieme essai, le podium. C'est ce qu'on voit sur le tableau d'affichage
 * d'un stade, et rien de plus : tout ce qui se lit sur la piste (l'angle, la
 * planche, l'empreinte, le drapeau du juge) y reste.
 *
 * Il se pose PAR-DESSUS la piste, transparent, et ne prend jamais les appuis :
 * les paves de course sont en dessous, et ce sont eux qui sautent.
 */

const CLE = 'sprinter.longueur.v1';
type Memoire = { debloque: number; pb: { m: number; vent: number } | null };

function lireMemoire(): Memoire {
  try {
    const m = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (m && typeof m.debloque === 'number') return { debloque: m.debloque, pb: m.pb || null };
  } catch { /* stockage indisponible : on repart de zero */ }
  return { debloque: 0, pb: null };
}
function ecrireMemoire(m: Memoire) {
  try { localStorage.setItem(CLE, JSON.stringify(m)); } catch { /* sans stockage, rien ne se retient */ }
}

/**
 * Les finalistes de chaque etape. Les sept noms du plateau de Sprinter, et
 * quatre de plus aux grands championnats, ou la finale se saute a douze.
 * Inventes, comme partout ailleurs dans le jeu.
 */
const RENFORTS: Record<number, string[]> = {
  3: ['Tomas Weit', 'Kofi Salto', 'Juan Brinco', 'Aki Hane'],
  4: ['Zane Orbit', 'Milo Vaux', 'Dario Luce', 'Kenji Sora'],
};
function nomsDe(etape: number): string[] {
  const L = SprinterApp.LEVELS[etape];
  return [...((L && L.names) || []), ...(RENFORTS[etape] || [])];
}

const virgule = (m: number) => m.toFixed(2).replace('.', SprinterApp.N.getLang() === 'fr' ? ',' : '.');

type Essai = { mordu: boolean; marque: number | null; metres: number; vent: number;
               raison?: string | null; ramene?: string; ciseau?: boolean; ecart?: number;
               angle?: number; vElan?: number; passe?: boolean };
type Fait = { index: number; nom: string; tour: number; essai: Essai };

export function Longueur({ onQuitter }: { onQuitter: () => void }) {
  const { N } = SprinterApp;
  const accent = MONDES.jumper.accent;
  const [memoire, setMemoire] = useState<Memoire>(lireMemoire);
  const [etape, setEtape] = useState<number | null>(null);
  // Chaque concours est une partie neuve : un compteur, et non l'etape seule,
  // pour que REFAIRE remonte le concours au lieu de garder l'ancien.
  const [partie, setPartie] = useState(0);
  void N;

  if (etape === null) {
    return <Choix memoire={memoire} accent={accent} onChoisir={setEtape} onQuitter={onQuitter} />;
  }
  return (
    <Concours key={partie} etape={etape} accent={accent} memoire={memoire}
              onMemoire={(m) => { setMemoire(m); ecrireMemoire(m); }}
              onRejouer={(e) => { setEtape(e); setPartie(p => p + 1); }} onQuitter={onQuitter} />
  );
}

/* ----------------------------------------------------------- le choix */

function Choix({ memoire, accent, onChoisir, onQuitter }: {
  memoire: Memoire; accent: string; onChoisir: (e: number) => void; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto pointer-events-auto"
         style={{ background: MONDES.jumper.fond }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-45"
           style={{ background: `radial-gradient(60% 100% at 50% 0%, ${accent}, transparent 70%)` }} />
      <div className="relative max-w-md mx-auto w-full flex flex-col gap-4
                      px-[max(env(safe-area-inset-left),1.25rem)] pr-[max(env(safe-area-inset-right),1.25rem)]
                      pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="text-center">
          <h1 className="font-display font-black tracking-tight text-3xl" style={{ color: accent }}>
            {N.t('disc_longueur')}
          </h1>
          <p className="mt-1 text-[10px] tracking-widest uppercase text-white/50">{N.t('saut_choix')}</p>
        </div>

        {/* Les quatre gestes, dans l'ordre ou ils viennent. */}
        <ol className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {['saut_aide_1', 'saut_aide_2', 'saut_aide_3', 'saut_aide_4'].map((k, i) => (
            <li key={k} className="flex gap-2 text-[11px] leading-snug text-white/75">
              <span className="font-mono font-bold shrink-0" style={{ color: accent }}>{i + 1}</span>
              <span>{N.t(k)}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2">
          {PLATEAU.map(([lo, hi], i) => {
            const ouvert = i <= memoire.debloque;
            return (
              <button key={i} disabled={!ouvert} onClick={() => onChoisir(i)}
                className={`w-full px-4 py-3 rounded-2xl border flex items-center gap-3 text-left
                  ${ouvert ? 'border-white/20 bg-white/[0.06] hover:bg-white/[0.10]' : 'border-white/8 bg-white/[0.02]'}`}>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-bold tracking-widest text-sm"
                        style={{ color: ouvert ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                    {N.levelName(i)}
                  </span>
                  <span className="font-mono text-[9px] tracking-wide text-white/35">
                    {virgule(lo)} – {virgule(hi)} m
                  </span>
                </span>
                {ouvert
                  ? <span className="text-[9px] tracking-widest shrink-0" style={{ color: accent }}>{N.t('monde_jouer')}</span>
                  : <Lock className="w-3.5 h-3.5 text-white/35 shrink-0" />}
              </button>
            );
          })}
        </div>
        <p className="text-center text-[9px] tracking-wide text-white/35">
          {N.t('saut_regle')} · {N.t('saut_verrou')}
        </p>
        {memoire.pb && (
          <p className="text-center text-[10px] tracking-widest text-white/55">
            {N.t('saut_record_perso')} <span className="font-mono" style={{ color: accent }}>{virgule(memoire.pb.m)} m</span>
          </p>
        )}
        <button onClick={onQuitter}
                className="mx-auto mt-2 px-4 py-2 rounded-full border border-white/15 bg-black/30
                           text-white/60 text-[10px] tracking-widest hover:text-white transition-colors">
          {N.t('monde_retour')}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- le concours */

type Temps = 'autres' | 'toi' | 'coupe' | 'fin';

function Concours({ etape, accent, memoire, onMemoire, onRejouer, onQuitter }: {
  etape: number; accent: string; memoire: Memoire;
  onMemoire: (m: Memoire) => void; onRejouer: (e: number) => void; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  // Le concours vient d'un module JavaScript : on le tient pour ce qu'il est.
  const c = useRef<any>(nouveauConcours({ etape, noms: nomsDe(etape), joueur: N.t('you') }));
  const [temps, setTemps] = useState<Temps>('autres');
  const [file, setFile] = useState<Fait[]>([]);
  const [vus, setVus] = useState(0);
  const [, rafraichir] = useState(0);
  const [annonce, setAnnonce] = useState<null | { sorte: string; texte: string; sous?: string; couleur: string }>(null);
  const [live, setLive] = useState<{ phase: string; v: number; angle: number | null; horloge: number } | null>(null);
  const [record, setRecord] = useState<null | { m: number; vent: number; ok: boolean }>(null);
  const coupeVue = useRef(false);
  const quitte = useRef(false);
  // Les rappels du concours vivent plus longtemps qu'un rendu : ils lisent la
  // memoire par une reference, sans quoi un record retenu pendant l'essai
  // serait ecrase par la memoire d'avant a la fin du concours.
  const memoireRef = useRef(memoire);
  memoireRef.current = memoire;

  const joueur = c.current.athletes.findIndex((a: any) => a.joueur);
  const cl = classement(c.current);

  /* --- l'armement du stade, et son rangement --- */
  useEffect(() => {
    armerConcoursSaut(etape);
    return () => { if (!quitte.current) rangerConcoursSaut(); };
  }, [etape]);

  /* --- faire sauter les autres jusqu'a toi --- */
  const avancerRef = useRef<() => void>(() => {});
  const avancer = useCallback(() => avancerRef.current(), []);
  avancerRef.current = () => {
    const C = c.current;
    // LA COUPE, annoncee une fois : qualifie ou non pour les trois derniers.
    if (C.coupe && !coupeVue.current && C.athletes.length > ESSAIS.qualifies) {
      coupeVue.current = true;
      setTemps('coupe');
      return;
    }
    const faits = avancerJusquAuJoueur(C, Math.random) as Fait[];
    if (faits.length) {
      mettreAuRepos();
      setFile(faits);
      setVus(0);
      setTemps('autres');
      return;
    }
    if (C.fini || aQui(C) === null) { finir(); return; }
    aToi();
  };

  const aToi = () => {
    const C = c.current;
    const autres = classement(C).filter((x: any) => !x.joueur);
    const lignes: { m: number; couleur: string; texte: string }[] = [];
    const tete = autres.length ? autres[0].meilleur : 0;
    if (tete > 0) lignes.push({ m: tete, couleur: accent, texte: virgule(tete) });
    const moi = meilleur(C.athletes[joueur]);
    if (moi > 0) lignes.push({ m: moi, couleur: 'rgba(255,255,255,0.85)', texte: virgule(moi) });
    if (etape >= 3) lignes.push({ m: RECORDS.hommes.m, couleur: 'rgb(248,113,113)', texte: 'WR ' + virgule(RECORDS.hommes.m) });
    appelerSauteur({ vent: tirerVent(Math.random), lignes: lignes as any });
    setAnnonce(null);
    setTemps('toi');
  };

  const finir = () => {
    setTemps('fin');
    mettreAuRepos();
    const place = placeDuJoueur(c.current) || 99;
    const m = { ...memoireRef.current };
    if (place <= 3 && etape + 1 > m.debloque && etape + 1 < PLATEAU.length) m.debloque = etape + 1;
    onMemoire(m);
  };

  useEffect(() => { avancer(); }, [avancer]);

  /* --- le deroule des autres, un par un --- */
  useEffect(() => {
    if (temps !== 'autres') return;
    if (vus >= file.length) {
      const id = setTimeout(() => avancer(), file.length ? 700 : 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setVus(v => v + 1), 850);
    return () => clearTimeout(id);
  }, [temps, vus, file.length, avancer]);

  /* --- ce qui se passe sur la piste --- */
  useEffect(() => ecouterSaut((evt: any) => {
    if (evt.type === 'range') {
      if (!quitte.current) { quitte.current = true; onQuitter(); }
      return;
    }
    if (evt.type === 'appel') {
      // UN APPEL MORDU NE SE DIT PAS TOUT DE SUITE. Le joueur le decouvre comme
      // au stade : au drapeau rouge, une fois dans le sable. L'annoncer sur la
      // planche lui volerait le seul saut qu'il ait fait.
      setAnnonce(evt.ecart < 0 ? null
        : { sorte: 'planche', texte: `${N.t('saut_planche')} · ${Math.round(evt.ecart * 100)} cm`,
            couleur: evt.ecart <= 0.2 ? 'rgb(74,222,128)' : 'rgb(250,214,60)' });
    }
    if (evt.type === 'envol') {
      const sous = `${N.t('saut_angle')} ${Math.round(evt.angle)}° · ${N.t('saut_elan')} ${evt.vElan.toFixed(1)} m/s`;
      setAnnonce(a => a ? { ...a, sous } : { sorte: 'envol', texte: '', sous, couleur: '#fff' });
    }
    if (evt.type === 'contact' && !evt.resultat.mordu) {
      const r = evt.resultat;
      setAnnonce(a => ({ sorte: 'ramene',
        texte: N.t('saut_r_' + r.ramene) + (r.ciseau ? ' · ' + N.t('saut_ciseau') : ''),
        sous: (a && a.sous) || undefined, couleur: r.ramene === 'parfait' ? 'rgb(74,222,128)'
          : r.ramene === 'assis' ? '#f87171' : 'rgb(250,214,60)' }));
    }
    if (evt.type === 'marque') {
      const r = evt.resultat as Essai;
      if (r.mordu) {
        setAnnonce({ sorte: 'marque', texte: N.t('saut_mordu'),
          sous: N.t('saut_nul_' + (r.raison || 'planche')), couleur: '#f87171' });
      } else {
        const vent = lireVent(r.vent);
        setAnnonce(a => ({ sorte: 'marque', texte: `${virgule(r.marque!)} m`,
          sous: (homologable(r.vent) ? N.t('saut_vent', { v: vent }) : N.t('saut_vent_trop', { v: vent }))
            + (a && a.sorte === 'ramene' ? ' · ' + a.texte : ''),
          couleur: accent }));
        // LE RECORD PERSONNEL : seul un vent de moins de deux metres le fait
        // entrer au palmares. Au-dela, on le dit, sans le retenir.
        const mem = memoireRef.current;
        if (!mem.pb || r.marque! > mem.pb.m) {
          const ok = homologable(r.vent);
          setRecord({ m: r.marque!, vent: r.vent, ok });
          if (ok) onMemoire({ ...mem, pb: { m: r.marque!, vent: r.vent } });
        }
      }
    }
    if (evt.type === 'fin') {
      const r = evt.resultat as Essai;
      inscrire(c.current, {
        mordu: !!r.mordu, marque: r.mordu ? null : r.marque, metres: r.metres || 0, vent: r.vent,
        raison: r.raison, ramene: r.ramene, ciseau: r.ciseau, ecart: r.ecart, angle: r.angle,
      });
      setRecord(null);
      rafraichir(x => x + 1);
      setTimeout(() => { setAnnonce(null); avancer(); }, 250);
    }
  }), [avancer]);

  /* --- les chiffres de l'essai en cours, a quinze images par seconde --- */
  useEffect(() => {
    if (temps !== 'toi') { setLive(null); return; }
    let id = 0, dernier = 0;
    const boucle = (t: number) => {
      if (t - dernier > 66) {
        dernier = t;
        const e = etatSaut();
        const j = SprinterApp.G.player;
        if (e && j) setLive({ phase: e.phase, v: j.v, angle: e.appel ? e.appel.angle : null, horloge: e.horloge });
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [temps]);

  const quitter = () => { quitte.current = true; rangerConcoursSaut(); onQuitter(); };

  const C = c.current;
  const tour = Math.min(C.tour, tours());
  const essais = C.athletes[joueur].essais as Essai[];

  return (
    <div className={`fixed inset-0 z-[46] pointer-events-none select-none
                    px-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]
                    ${EST_TEST ? 'pt-[calc(max(env(safe-area-inset-top),0.6rem)+2.2rem)]' : 'pt-[max(env(safe-area-inset-top),0.6rem)]'}`}>
      {/* L'EN-TETE : l'epreuve, l'etape, l'essai, et les six cases du joueur. */}
      <div className="max-w-lg mx-auto flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black tracking-tight text-base leading-none" style={{ color: accent }}>
              {N.t('disc_longueur')}
            </span>
            <span className="text-[9px] tracking-widest uppercase text-white/50 truncate">{N.levelName(etape)}</span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: tours() }, (_, i) => {
              const e = essais[i];
              const encours = i === essais.length && temps === 'toi';
              const coupe = C.coupe && !C.coupe.includes(joueur) && i >= ESSAIS.premiers;
              return (
                <div key={i}
                  className={`w-11 h-6 rounded-md border flex items-center justify-center font-mono text-[9px] tabular-nums
                    ${encours ? 'border-white/60' : 'border-white/10'}`}
                  style={{
                    background: e && !e.mordu ? accent + '26' : 'rgba(0,0,0,0.35)',
                    color: !e ? 'rgba(255,255,255,0.3)' : e.mordu ? 'rgba(248,113,113,0.95)' : '#fff',
                    opacity: coupe ? 0.3 : 1,
                  }}>
                  {!e ? (coupe ? '–' : i + 1) : e.mordu ? 'X' : virgule(e.marque!)}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button onPointerDown={e => { e.stopPropagation(); quitter(); }}
                  className="pointer-events-auto px-2.5 py-1 rounded-full border border-white/15 bg-black/40
                             text-white/60 text-[9px] tracking-widest hover:text-white">
            {N.t('saut_quitter')}
          </button>
          <span className="text-[9px] tracking-widest text-white/50 font-mono">
            {N.t('saut_tour', { n: String(tour), t: String(tours()) })}
          </span>
          {/* LA MINUTE. Jaune aux quinze dernieres secondes, comme le drapeau
              que leve l'officiel du chronometre. */}
          {temps === 'toi' && live && live.phase === 'attente' && (
            <span className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: live.horloge <= 15 ? 'rgb(250,214,60)' : 'rgba(255,255,255,0.8)' }}>
              {Math.max(0, Math.ceil(live.horloge))} s
            </span>
          )}
        </div>
      </div>

      {/* LE TABLEAU : les trois premiers, et toi si tu n'y es pas. */}
      {/* Decale a droite du bouton de pause, qui tient le coin gauche. */}
      {temps !== 'fin' && (
        <div className="max-w-lg mx-auto mt-2 pl-10">
          <Tableau lignes={cl} accent={accent} court />
        </div>
      )}

      {/* CE QUE FONT LES AUTRES, un par un, pendant que tu attends. */}
      <AnimatePresence>
        {temps === 'autres' && file.length > 0 && (
          <motion.div key="autres" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-auto"
            onPointerDown={() => setVus(file.length)}>
            <div className="w-[min(92vw,22rem)] rounded-2xl border border-white/12 bg-black/65 backdrop-blur-sm p-3">
              <div className="flex flex-col gap-1">
                {file.slice(Math.max(0, vus - 3), vus).map((f, k) => {
                  const dernier = f === file[vus - 1];
                  return (
                    <div key={f.index + ':' + f.tour + ':' + k}
                         className={`flex items-center justify-between gap-2 ${dernier ? '' : 'opacity-45'}`}>
                      <span className="text-[11px] font-bold tracking-wide text-white truncate">{f.nom}</span>
                      <span className="font-mono text-[12px] tabular-nums"
                            style={{ color: f.essai.mordu ? '#f87171' : accent }}>
                        {f.essai.mordu ? N.t('saut_mordu') : `${virgule(f.essai.marque!)} m`}
                        <span className="text-white/35 text-[9px] ml-1.5">{lireVent(f.essai.vent)}</span>
                      </span>
                    </div>
                  );
                })}
                {vus < file.length && (
                  <div className="text-[10px] tracking-widest text-white/50">
                    {N.t('saut_saute', { n: file[vus].nom })}
                  </div>
                )}
              </div>
              <div className="mt-2 text-center text-[8px] tracking-widest uppercase text-white/30">{N.t('saut_passer')}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A TOI : l'appel du juge, puis les chiffres qui comptent. */}
      {temps === 'toi' && live && live.phase === 'attente' && (
        <div className="absolute inset-x-0 top-[40%] flex justify-center">
          <span className="font-display font-black tracking-tight text-3xl" style={{ color: accent }}>
            {N.t('saut_a_toi')}
          </span>
        </div>
      )}
      {temps === 'toi' && live && live.phase === 'elan' && (
        <div className="absolute inset-x-0 bottom-[calc(22vh+2.2rem)] flex justify-center">
          <span className="font-mono text-sm tabular-nums text-white/85 bg-black/40 rounded-full px-3 py-0.5">
            {N.t('saut_elan')} {live.v.toFixed(1)} m/s
          </span>
        </div>
      )}

      <AnimatePresence>
        {temps === 'toi' && annonce && (
          <motion.div key={annonce.sorte + annonce.texte} initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-1">
            <span className={`flex items-center gap-2 font-display font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]
                              ${annonce.sorte === 'marque' ? 'text-5xl' : 'text-xl'}`}
                  style={{ color: annonce.couleur }}>
              {/* Le drapeau du juge de planche : blanc valable, rouge mordu.
                  Il est leve la-bas, au bord de la piste ; on le rappelle ici,
                  ou l'on regarde. */}
              {annonce.sorte === 'marque' && (
                <Drapeau blanc={annonce.couleur !== '#f87171'} />
              )}
              {annonce.texte}
            </span>
            {annonce.sous && (
              <span className="text-[10px] tracking-wider text-white/85 bg-black/45 rounded-full px-3 py-0.5">
                {annonce.sous}
              </span>
            )}
            {annonce.sorte === 'marque' && record && (
              <span className="mt-1 text-[10px] font-bold tracking-widest"
                    style={{ color: record.ok ? 'rgb(250,214,60)' : 'rgba(255,255,255,0.55)' }}>
                {N.t('saut_record_perso')}{record.ok ? '' : ` · ${N.t('saut_vent_trop', { v: lireVent(record.vent) })}`}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* LA COUPE, apres le troisieme essai. */}
      <AnimatePresence>
        {temps === 'coupe' && (
          <motion.div key="coupe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            onPointerDown={() => avancer()}>
            <div className="w-[min(92vw,22rem)] rounded-2xl border border-white/12 bg-black/75 backdrop-blur-sm p-4 text-center">
              <p className="font-display font-black text-lg tracking-tight"
                 style={{ color: joueurEnLice(C) ? accent : '#f87171' }}>
                {joueurEnLice(C) ? N.t('saut_qualifie') : N.t('saut_elimine')}
              </p>
              <div className="mt-3"><Tableau lignes={cl} accent={accent} /></div>
              <p className="mt-2 text-[8px] tracking-widest uppercase text-white/30">{N.t('saut_passer')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LA FIN : la place, la medaille, et ce qu'on fait ensuite. */}
      <AnimatePresence>
        {temps === 'fin' && (
          <motion.div key="fin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/40">
            <Fin C={C} etape={etape} accent={accent} memoire={memoire}
                 onRejouer={() => { quitte.current = true; onRejouer(etape); }}
                 onSuivant={() => { quitte.current = true; onRejouer(etape + 1); }}
                 onQuitter={quitter} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ le drapeau */

function Drapeau({ blanc }: { blanc: boolean }) {
  return (
    <svg viewBox="0 0 24 28" className="w-7 h-8 shrink-0" aria-hidden>
      <line x1="4" y1="2" x2="4" y2="27" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 3 C 11 1, 15 6, 22 3 L 22 15 C 15 18, 11 13, 5 15 Z"
            fill={blanc ? '#f6f6f2' : '#e22828'} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
    </svg>
  );
}

/* ------------------------------------------------------------ le tableau */

function Tableau({ lignes, accent, court = false }: { lignes: any[]; accent: string; court?: boolean }) {
  const { N } = SprinterApp;
  let vues = lignes;
  if (court) {
    vues = lignes.slice(0, 3);
    const moi = lignes.find(l => l.joueur);
    if (moi && !vues.includes(moi)) vues = [...vues, moi];
  }
  return (
    <div className={`rounded-xl ${court ? 'bg-black/45 w-[min(62vw,15rem)]' : ''} px-2 py-1.5 flex flex-col gap-0.5`}>
      {!court && <div className="text-[9px] tracking-widest uppercase text-white/40 mb-1">{N.t('saut_classement')}</div>}
      {vues.map(l => (
        <div key={l.index} className={`flex items-center gap-2 text-[10px] ${l.qualifie ? '' : 'opacity-40'}`}>
          <span className="w-5 font-mono text-white/45 tabular-nums">{l.meilleur > 0 ? l.place : '–'}</span>
          <span className={`flex-1 truncate ${l.joueur ? 'font-black' : 'font-semibold'}`}
                style={{ color: l.joueur ? accent : 'rgba(255,255,255,0.85)' }}>{l.nom}</span>
          <span className="font-mono tabular-nums text-white/85">
            {l.meilleur > 0 ? virgule(l.meilleur) : (l.essais.length ? N.t('saut_nm') : '')}
          </span>
        </div>
      ))}
    </div>
  );
}

function Fin({ C, etape, accent, memoire, onRejouer, onSuivant, onQuitter }: {
  C: any; etape: number; accent: string; memoire: Memoire;
  onRejouer: () => void; onSuivant: () => void; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const cl = classement(C);
  const place = placeDuJoueur(C) || cl.length;
  const moi = cl.find((l: any) => l.joueur);
  const medaille = moi && moi.meilleur > 0 && place <= 3
    ? ['saut_or', 'saut_argent', 'saut_bronze'][place - 1] : null;
  const couleur = medaille ? ['rgb(250,204,21)', 'rgb(203,213,225)', 'rgb(217,119,6)'][place - 1] : accent;
  const suivant = etape + 1 < PLATEAU.length && etape + 1 <= memoire.debloque;
  const r = RECORDS.hommes;
  return (
    <div className="w-[min(94vw,24rem)] rounded-2xl border border-white/12 bg-black/80 backdrop-blur-md p-4 flex flex-col gap-3">
      <div className="text-center">
        <p className="text-[9px] tracking-widest uppercase text-white/45">{N.t('saut_fini')} · {N.levelName(etape)}</p>
        <p className="mt-1 font-display font-black tracking-tight text-3xl" style={{ color: couleur }}>
          {medaille ? N.t(medaille) : N.t('saut_place', { p: N.ord(place) })}
        </p>
        <p className="font-mono text-xl text-white">
          {moi && moi.meilleur > 0 ? `${virgule(moi.meilleur)} m` : N.t('saut_nm')}
        </p>
      </div>
      <Tableau lignes={cl} accent={accent} />
      <p className="text-center text-[8px] tracking-wide text-white/35">
        {N.t('saut_record', { m: virgule(r.m), n: r.qui, a: String(r.an) })}
      </p>
      {medaille && suivant && (
        <p className="text-center text-[10px] tracking-widest" style={{ color: accent }}>{N.t('saut_debloque')}</p>
      )}
      <div className="flex flex-col gap-2">
        {suivant && (
          <button onClick={onSuivant} className="py-2.5 rounded-xl font-black font-display tracking-widest text-sm text-black"
                  style={{ backgroundColor: accent }}>
            {N.t('saut_suivant')}
          </button>
        )}
        <button onClick={onRejouer}
                className={`py-2.5 rounded-xl font-black font-display tracking-widest text-sm
                  ${suivant ? 'border border-white/20 text-white' : 'text-black'}`}
                style={suivant ? undefined : { backgroundColor: accent }}>
          {N.t('saut_refaire')}
        </button>
        <button onClick={onQuitter} className="py-2 text-[10px] tracking-widest text-white/55 hover:text-white">
          {N.t('monde_retour')}
        </button>
      </div>
    </div>
  );
}
