import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type Athlete, type Jour, type Exercice, type Stat, type Seance as ResultatSeance,
  SEANCES, exerciceDuJour, faireLaSeance,
} from '@/game/athlete/regles';
import { mot, dans, EXOS } from '@/game/athlete/mots';

/* ---------------------------------------------------------------------------
   LES SEANCES : UN MINI-JEU PAR VRAI EXERCICE
   ---------------------------------------------------------------------------
   L'auteur, 25/10 : « sois varie sur les mini-jeux, il faut qu'ils
   correspondent aux exercices d'athletisme ». Chaque exercice du programme
   (regles.ts, PROGRAMME) a son geste :

     departs     partir au coup de pistolet ; avant, ou sous 0,100 s : faux depart
     lancee      l'elan, puis la frequence maximale dans la zone lancee
     gammes      suivre l'educatif en rythme (genoux, talons-fesses, pas chasses)
     virage      tenir la cadence de la courbe : trop vite on sort du couloir
     cotes       monter avant la fin du temps ; la pente rend chaque appui plus court
     muscu       squat : appuyer pour descendre, relacher dans la zone verte
     bonds       taper quand le pied touche le sol
     gainage     garder le corps aligne contre ce qui le fait pencher
     fractionne  tenir l'allure sur trois repetitions ; la zone se resserre
     tempo       rester dans la zone d'allure jusqu'au bout

   Le score va de 0 a 1 ; regles.ts en fait des points de qualite. Le geste
   reste celui de la course : deux zones, gauche et droite, ou les fleches.
--------------------------------------------------------------------------- */

const VERT = '#3DDC84';
const COULEUR: Record<Stat, string> = { vitesse: '#FF5A5F', force: '#F5A623', technique: '#4AA8FF', endurance: VERT };
const borne = (v: number) => Math.max(0, Math.min(1, v));

type Cote = 'g' | 'd';
type JeuProps = { fini: (score: number) => void; couleur: string };

/** L'horloge d'un jeu : rappelle `tic(t, dt)` a chaque image, t en secondes depuis le debut. */
function useHorloge(tic: (t: number, dt: number) => boolean | void) {
  const f = useRef(tic); f.current = tic;
  useEffect(() => {
    let id = 0, debut = 0, avant = 0;
    const boucle = (ms: number) => {
      if (!debut) { debut = ms; avant = ms; }
      const fin = f.current((ms - debut) / 1000, Math.min(0.05, (ms - avant) / 1000));
      avant = ms;
      if (fin !== true) id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Les appuis : les deux zones, les fleches du clavier, et l'appui long (muscu). */
function useAppuis(surAppui: (c: Cote, t: number) => void, surLache?: (c: Cote) => void) {
  const a = useRef(surAppui); a.current = surAppui;
  const l = useRef(surLache); l.current = surLache;
  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); a.current('g', performance.now() / 1000); }
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); a.current('d', performance.now() / 1000); }
    };
    const haut = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') l.current?.('g');
      else if (e.key === 'ArrowRight' || e.key === ' ') l.current?.('d');
    };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  }, []);
  return {
    zone: (c: Cote) => ({
      onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); a.current(c, performance.now() / 1000); },
      onPointerUp: () => l.current?.(c),
      onPointerCancel: () => l.current?.(c),
    }),
  };
}

function Zones({ zone, libelles = ['←', '→'] }: { zone: (c: Cote) => object; libelles?: [string, string] }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] h-[30vh] shrink-0">
      {(['g', 'd'] as const).map((c, i) => (
        <button key={c} {...zone(c)}
                className="rounded-2xl border-2 border-white/15 bg-white/[0.06] active:bg-white/25 font-black text-2xl text-white/60 select-none">
          {libelles[i]}
        </button>
      ))}
    </div>
  );
}

/** Une piste vue de cote : le coureur avance de 0 a 1. */
function Piste({ p, couleur, marques = [], pente = 0 }: { p: number; couleur: string; marques?: [number, number, string][]; pente?: number }) {
  return (
    <div className="relative w-full max-w-md h-28 mx-auto" style={{ transform: `rotate(${-pente}deg)` }}>
      <div className="absolute inset-x-0 bottom-6 h-3 rounded-full bg-[#C8553D]" />
      {marques.map(([a, b, c], i) => (
        <div key={i} className="absolute bottom-6 h-3 rounded-full" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, background: c }} />
      ))}
      <div className="absolute bottom-9 w-6 h-12 -ml-3 rounded-full" style={{ left: `${borne(p) * 100}%`, background: couleur, boxShadow: `0 0 18px ${couleur}` }} />
    </div>
  );
}

/** La cadence glissante sur la derniere seconde (appuis alternes seulement). */
function useCadence() {
  const appuis = useRef<{ t: number; bon: boolean }[]>([]);
  const dernier = useRef<Cote | null>(null);
  return {
    appui(c: Cote, t: number) {
      const bon = dernier.current !== c; dernier.current = c;
      appuis.current.push({ t, bon });
      return bon;
    },
    cadence(t: number) { return appuis.current.filter(x => x.bon && x.t > t - 1).length; },
    fautes() { return appuis.current.filter(x => !x.bon).length; },
  };
}

const Grand = ({ children }: { children: React.ReactNode }) =>
  <span className="font-black font-display text-5xl tabular-nums">{children}</span>;
const Petit = ({ children, couleur }: { children: React.ReactNode; couleur?: string }) =>
  <span className="text-sm font-bold text-center max-w-xs" style={{ color: couleur }}>{children}</span>;

/* ================================================================ les jeux */

/** Departs en blocs : cinq essais au pistolet. */
function Departs({ fini, couleur }: JeuProps) {
  const [essai, setEssai] = useState(0);
  const [ordre, setOrdre] = useState<'marques' | 'prets' | 'pan' | 'vu'>('marques');
  const [dernier, setDernier] = useState<string>('');
  const scores = useRef<number[]>([]);
  const pan = useRef(0), prets = useRef(1.2), tir = useRef(0);
  const debutEssai = useRef(0);
  const nouvelEssai = (t: number) => { debutEssai.current = t; prets.current = 1.2; tir.current = 1.2 + 1.0 + Math.random() * 1.4; pan.current = 0; setOrdre('marques'); };

  useHorloge(t => {
    if (essai >= 5) return true;
    if (!debutEssai.current) nouvelEssai(t);
    const e = t - debutEssai.current;
    if (ordre === 'marques' && e > prets.current) setOrdre('prets');
    if (ordre === 'prets' && e > tir.current) { setOrdre('pan'); pan.current = performance.now() / 1000; }
    if (ordre === 'pan' && performance.now() / 1000 - pan.current > 0.9) partir(performance.now() / 1000);
  });
  const partir = (t: number) => {
    if (ordre === 'vu' || essai >= 5) return;
    let s = 0, msg: string;
    if (ordre !== 'pan') msg = mot('faux');
    else {
      const r = t - pan.current;
      if (r < 0.1) msg = `${mot('faux')} · ${r.toFixed(3)} s`;
      else { s = borne((0.35 - r) / 0.22); msg = `${dans(['Réaction', 'Reaction'])} ${r.toFixed(3)} s`; }
    }
    scores.current.push(s);
    setDernier(msg); setOrdre('vu');
    setTimeout(() => {
      const n = essai + 1; setEssai(n);
      if (n >= 5) fini(scores.current.reduce((x, y) => x + y, 0) / 5);
      else debutEssai.current = 0;
    }, 900);
  };
  const { zone } = useAppuis((_, t) => partir(t));
  const texte = ordre === 'marques' ? dans(['À vos marques…', 'On your marks…'])
    : ordre === 'prets' ? dans(['Prêts…', 'Set…']) : ordre === 'pan' ? 'PAN !' : dernier;
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-[10px] font-black tracking-[0.3em] text-white/50">{dans(['ESSAI', 'ATTEMPT'])} {Math.min(5, essai + 1)} / 5</span>
        <span className={`font-black font-display text-4xl ${ordre === 'pan' ? 'text-white' : ''}`}
              style={{ color: ordre === 'pan' ? undefined : couleur, textShadow: ordre === 'pan' ? `0 0 30px ${couleur}` : undefined }}>{texte}</span>
        {ordre === 'pan' && <div className="fixed inset-0 pointer-events-none" style={{ background: `${couleur}22` }} />}
      </div>
      <Zones zone={zone} libelles={[dans(['PARTIR', 'GO']), dans(['PARTIR', 'GO'])]} />
    </>
  );
}

/** Vitesse lancee : 3 s d'elan, puis 3 s dans la zone. */
function Lancee({ fini, couleur }: JeuProps) {
  const c = useCadence();
  const [t, setT] = useState(0);
  const zone0 = useRef<number | null>(null), bons = useRef(0);
  const debut = useRef(0);
  useHorloge(tt => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    if (tt >= 6) { fini(borne((bons.current / 3 - 5) / 7) - c.fautes() * 0.01); return true; }
  });
  const { zone } = useAppuis((cote, ts) => {
    const tt = ts - debut.current;
    const bon = c.appui(cote, ts);
    if (bon && tt >= 3) { if (zone0.current === null) zone0.current = tt; bons.current++; }
  });
  const ts = performance.now() / 1000;
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <Petit couleur={t < 3 ? undefined : couleur}>{t < 3 ? dans(['L’élan…', 'Build up…']) : dans(['ZONE LANCÉE : à fond !', 'FLYING ZONE: flat out!'])}</Petit>
        <Grand>{c.cadence(ts)}</Grand>
        <span className="text-xs text-white/50">{mot('appuis', { n: c.cadence(ts) })}</span>
        <Piste p={t / 6} couleur={couleur} marques={[[0.5, 1, '#FFFFFF55']]} />
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Gammes : des notes descendent sur deux couloirs ; on tape quand elles touchent la ligne. */
const EDUCATIFS: { nom: [string, string]; pas: number; motif: Cote[] }[] = [
  { nom: ['Montées de genoux', 'High knees'], pas: 0.42, motif: ['g', 'd'] },
  { nom: ['Talons-fesses', 'Butt kicks'], pas: 0.34, motif: ['g', 'd'] },
  { nom: ['Pas chassés', 'Side shuffles'], pas: 0.4, motif: ['g', 'g', 'd', 'd'] },
  { nom: ['Griffés', 'Pawing'], pas: 0.38, motif: ['g', 'd', 'd', 'g'] },
];
function Gammes({ fini, couleur }: JeuProps) {
  // trois educatifs tires, huit notes chacun
  const notes = useRef<{ t: number; c: Cote; ed: number; vu: boolean }[]>([]);
  if (!notes.current.length) {
    let t = 1.5;
    const ordre = [...EDUCATIFS.keys()].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const k of ordre) {
      const e = EDUCATIFS[k];
      for (let i = 0; i < 8; i++) { notes.current.push({ t, c: e.motif[i % e.motif.length], ed: k, vu: false }); t += e.pas; }
      t += 1;
    }
  }
  const fin = notes.current[notes.current.length - 1].t + 1;
  const [t, setT] = useState(0);
  const debut = useRef(0), touches = useRef(0), fautes = useRef(0);
  useHorloge(tt => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    if (tt >= fin) { fini(borne(touches.current / notes.current.length - fautes.current * 0.02)); return true; }
  });
  const { zone } = useAppuis((c, ts) => {
    const tt = ts - debut.current;
    const n = notes.current.find(x => !x.vu && x.c === c && Math.abs(x.t - tt) <= 0.12);
    if (n) { n.vu = true; touches.current++; } else fautes.current++;
  });
  const enCours = notes.current.find(x => x.t > t - 0.2);
  const AVANCE = 1.6;
  return (
    <>
      <div className="flex-1 flex flex-col items-center gap-2 px-4 pt-2 min-h-0">
        <Petit couleur={couleur}>{enCours ? dans(EDUCATIFS[enCours.ed].nom) : ''}</Petit>
        <div className="relative flex-1 w-full max-w-xs grid grid-cols-2 gap-2 min-h-0">
          {(['g', 'd'] as const).map(c => (
            <div key={c} className="relative rounded-xl bg-white/[0.04] overflow-hidden">
              <div className="absolute inset-x-0 bottom-3 h-1 bg-white/40" />
              {notes.current.filter(n => n.c === c && n.t > t - 0.3 && n.t < t + AVANCE).map((n, i) => (
                <div key={i} className="absolute left-1/2 -ml-5 w-10 h-4 rounded-full transition-opacity"
                     style={{ bottom: `calc(${((n.t - t) / AVANCE) * 100}% + 4px)`, background: n.vu ? '#ffffff33' : couleur, opacity: n.vu ? 0.4 : 1 }} />
              ))}
            </div>
          ))}
        </div>
        <span className="text-xs text-white/60 tabular-nums">{touches.current} / {notes.current.length}</span>
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Virage : la cadence fait la vitesse ; trop vite, la courbe pousse dehors ; trop lent, on perd. */
function Virage({ fini, couleur }: JeuProps) {
  const c = useCadence();
  const [etat, setEtat] = useState({ t: 0, x: 0.5 });
  const dedans = useRef(0), total = useRef(0);
  useHorloge((tt, dt) => {
    const cad = c.cadence(performance.now() / 1000);
    // au-dessus de 9 appuis/s on derive vers l'exterieur, sous 6 on recule a la corde mais on ralentit
    setEtat(e => {
      const x = Math.max(0, Math.min(1, e.x + (cad > 9 ? 0.35 : cad < 6 ? -0.25 : (0.5 - e.x)) * dt));
      if (tt > 1) { total.current++; if (cad >= 6 && cad <= 9 && x > 0.2 && x < 0.8) dedans.current++; }
      return { t: tt, x };
    });
    if (tt >= 10) { fini(borne(total.current ? dedans.current / total.current : 0)); return true; }
  });
  const { zone } = useAppuis((cote, ts) => { c.appui(cote, ts); });
  const cad = c.cadence(performance.now() / 1000);
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <Grand>{cad}</Grand>
        <Petit couleur={cad >= 6 && cad <= 9 ? couleur : '#FF5A5F'}>{cad > 9 ? dans(['Trop vite : tu sors du couloir', 'Too fast: drifting out']) : cad < 6 ? dans(['Trop lent', 'Too slow']) : dans(['Bien à la corde', 'Nicely on the line'])}</Petit>
        <svg viewBox="0 0 200 120" className="w-full max-w-sm">
          <path d="M20 110 A90 90 0 0 1 180 110" fill="none" stroke="#C8553D" strokeWidth="34" />
          <path d="M20 110 A90 90 0 0 1 180 110" fill="none" stroke="#ffffff55" strokeWidth="1" strokeDasharray="4 4" />
          {(() => {
            const a = Math.PI * (1 - etat.t / 10), r = 90 - 17 + etat.x * 34;
            return <circle cx={100 + Math.cos(a) * r} cy={110 - Math.sin(a) * r} r="7" fill={couleur} />;
          })()}
        </svg>
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Cotes : quatre montees de 60 m en 8 s ; plus haut, chaque appui porte moins loin. */
function Cotes({ fini, couleur }: JeuProps) {
  const [rep, setRep] = useState(0);
  const [d, setD] = useState(0);
  const [t, setT] = useState(0);
  const debutRep = useRef(0), scores = useRef<number[]>([]), dist = useRef(0), dernier = useRef<Cote | null>(null);
  const pause = useRef(0);
  useHorloge(tt => {
    if (rep >= 4) return true;
    if (pause.current && tt < pause.current) { setT(0); return; }
    if (pause.current) { pause.current = 0; debutRep.current = tt; dist.current = 0; setD(0); }
    if (!debutRep.current) debutRep.current = tt;
    const e = tt - debutRep.current; setT(e);
    if (dist.current >= 60 || e >= 8) {
      scores.current.push(borne(dist.current / 60) * (dist.current >= 60 ? 1 : 0.85) + (dist.current >= 60 ? borne((8 - e) / 8) * 0.25 : 0));
      const n = rep + 1; setRep(n);
      if (n >= 4) { fini(borne(scores.current.reduce((x, y) => x + y, 0) / 4)); return true; }
      pause.current = tt + 1.4;
    }
  });
  const { zone } = useAppuis(c => {
    if (pause.current) return;
    const bon = dernier.current !== c; dernier.current = c;
    // la pente : 0,9 m par appui en bas, 0,45 m en haut ; deux fois le meme pied, presque rien
    dist.current += bon ? 0.9 - 0.45 * (dist.current / 60) : 0.1;
    setD(dist.current);
  });
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <span className="text-[10px] font-black tracking-[0.3em] text-white/50">{dans(['MONTÉE', 'REP'])} {Math.min(4, rep + 1)} / 4</span>
        <Grand>{Math.min(60, d).toFixed(0)} m</Grand>
        <Petit>{pause.current ? dans(['Retour en marchant…', 'Walk back down…']) : `${Math.max(0, 8 - t).toFixed(1)} s`}</Petit>
        <Piste p={d / 60} couleur={couleur} pente={14} />
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Musculation, le squat : appuyer pour descendre, relacher dans la zone. Cinq repetitions. */
function Muscu({ fini, couleur }: JeuProps) {
  const [prof, setProf] = useState(0);
  const [rep, setRep] = useState(0);
  const [msg, setMsg] = useState('');
  const appuye = useRef(false), monte = useRef(false), bons = useRef(0), bas = useRef(0);
  const ZONE: [number, number] = [0.82, 0.97];
  useHorloge((tt, dt) => {
    if (rep >= 5) return true;
    setProf(p => {
      if (monte.current) { const q = p - dt * 1.6; if (q <= 0) { monte.current = false; return 0; } return q; }
      if (!appuye.current) return p;
      const q = p + dt * 0.75;
      if (q >= 1) { bas.current += dt; if (bas.current > 0.35) lacher(1.01); return 1; }
      return q;
    });
  });
  const lacher = (p?: number) => {
    if (!appuye.current) return;
    appuye.current = false; bas.current = 0;
    const v = p ?? prof;
    let s = 0, m: string;
    if (v > 1) m = dans(['Trop bas, la barre t’écrase', 'Too deep, the bar wins']);
    else if (v >= ZONE[0] && v <= ZONE[1]) { s = 1; m = dans(['Parfait : cuisses parallèles', 'Perfect: thighs parallel']); }
    else if (v >= 0.6) { s = 0.5; m = dans(['Pas assez profond', 'Not deep enough']); }
    else m = dans(['Demi-squat…', 'Half squat…']);
    bons.current += s;
    monte.current = true; setMsg(m);
    const n = rep + 1; setRep(n);
    if (n >= 5) setTimeout(() => fini(bons.current / 5), 700);
  };
  const { zone } = useAppuis(() => { if (!monte.current && rep < 5) appuye.current = true; }, () => lacher());
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <span className="text-[10px] font-black tracking-[0.3em] text-white/50">{dans(['SQUAT', 'SQUAT'])} {Math.min(5, rep + 1)} / 5</span>
        <div className="relative h-56 w-24 rounded-2xl bg-white/[0.05] overflow-hidden">
          <div className="absolute inset-x-0" style={{ top: `${ZONE[0] * 100}%`, height: `${(ZONE[1] - ZONE[0]) * 100}%`, background: `${VERT}55` }} />
          <div className="absolute inset-x-2 h-2 rounded-full" style={{ top: `calc(${Math.min(1, prof) * 100}% - 4px)`, background: couleur, boxShadow: `0 0 14px ${couleur}` }} />
          <div className="absolute -inset-x-6 h-1 bg-white/70" style={{ top: `calc(${Math.min(1, prof) * 100}% - 1px)` }} />
        </div>
        <Petit couleur={couleur}>{msg || dans(['Garde appuyé pour descendre', 'Hold to go down'])}</Petit>
      </div>
      <Zones zone={zone} libelles={[dans(['DESCENDRE', 'DOWN']), dans(['DESCENDRE', 'DOWN'])]} />
    </>
  );
}

/** Bondissements : le pied revient au sol en rythme ; taper a l'impact, du bon pied. */
function Bonds({ fini, couleur }: JeuProps) {
  const [t, setT] = useState(0);
  const contacts = useRef<{ t: number; c: Cote; vu: boolean }[]>([]);
  if (!contacts.current.length) {
    let tt = 1.2, p = 0.62;
    for (let i = 0; i < 12; i++) { contacts.current.push({ t: tt, c: i % 2 ? 'd' : 'g', vu: false }); tt += p; p = Math.max(0.48, p - 0.012); }
  }
  const fin = contacts.current[contacts.current.length - 1].t + 0.8;
  const debut = useRef(0), bons = useRef(0);
  useHorloge(tt => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    if (tt >= fin) { fini(borne(bons.current / contacts.current.length)); return true; }
  });
  const { zone } = useAppuis((c, ts) => {
    const tt = ts - debut.current;
    const k = contacts.current.find(x => !x.vu && Math.abs(x.t - tt) <= 0.09);
    if (k) { k.vu = true; if (k.c === c) bons.current++; }
  });
  // la hauteur du coureur : un arc entre deux contacts
  const i = contacts.current.findIndex(x => x.t > t);
  const a = i > 0 ? contacts.current[i - 1].t : 0, b = i >= 0 ? contacts.current[i].t : fin;
  const h = i < 0 ? 0 : Math.sin(Math.PI * Math.min(1, Math.max(0, (t - a) / (b - a))));
  const prochain = i >= 0 ? contacts.current[i].c : 'g';
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <span className="text-xs text-white/60 tabular-nums">{bons.current} / {contacts.current.length}</span>
        <div className="relative h-40 w-full max-w-sm">
          <div className="absolute inset-x-0 bottom-4 h-1 bg-white/40" />
          <div className="absolute w-8 h-8 -ml-4 rounded-full" style={{ left: `${(t / fin) * 100}%`, bottom: `${20 + h * 90}px`, background: couleur, boxShadow: `0 0 18px ${couleur}` }} />
        </div>
        <Petit couleur={couleur}>{dans(['Pied', 'Foot'])} {prochain === 'g' ? mot('gauche') : mot('droite')}</Petit>
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Gainage : le corps penche ; corriger a gauche et a droite pour rester aligne. */
function Gainage({ fini, couleur }: JeuProps) {
  const [ang, setAng] = useState(0);
  const [t, setT] = useState(0);
  const v = useRef(0), dedans = useRef(0), total = useRef(0), pousse = useRef(0);
  useHorloge((tt, dt) => {
    setT(tt);
    // le tremblement monte avec le temps : la fin d'une planche, on la sent
    pousse.current += (Math.random() - 0.5) * (1.2 + tt * 0.12) * dt * 6;
    pousse.current *= 0.96;
    setAng(a => {
      v.current += (pousse.current + a * 0.9) * dt;
      v.current *= 0.97;
      const n = Math.max(-1, Math.min(1, a + v.current * dt * 3));
      total.current++; if (Math.abs(n) < 0.25) dedans.current++;
      return n;
    });
    if (tt >= 20) { fini(borne(dedans.current / total.current)); return true; }
  });
  const { zone } = useAppuis(c => { v.current += c === 'g' ? -0.35 : 0.35; });
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <Grand>{Math.max(0, 20 - t).toFixed(0)} s</Grand>
        <div className="relative w-64 h-24">
          <div className="absolute left-1/2 top-1/2 w-56 h-3 -ml-28 rounded-full origin-center"
               style={{ transform: `rotate(${ang * 30}deg)`, background: Math.abs(ang) < 0.25 ? couleur : '#FF5A5F' }} />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
        </div>
        <Petit>{Math.abs(ang) < 0.25 ? dans(['Aligné', 'Straight']) : ang < 0 ? dans(['Tu penches à gauche', 'Leaning left']) : dans(['Tu penches à droite', 'Leaning right'])}</Petit>
      </div>
      <Zones zone={zone} />
    </>
  );
}

/** Une zone d'allure a tenir, sur une ou plusieurs repetitions. */
function Allure({ fini, couleur, reps, duree, zones }: JeuProps & { reps: number; duree: number; zones: [number, number][] }) {
  const c = useCadence();
  const [etat, setEtat] = useState({ rep: 0, e: 0, repos: false });
  const debut = useRef(0), dedans = useRef(0), total = useRef(0);
  useHorloge(tt => {
    const cycle = duree + 2, rep = Math.floor(tt / cycle), e = tt - rep * cycle;
    if (rep >= reps) { fini(borne(total.current ? dedans.current / total.current : 0)); return true; }
    const repos = e > duree;
    if (!repos && e > 0.8) {
      const cad = c.cadence(performance.now() / 1000), [lo, hi] = zones[rep];
      total.current++; if (cad >= lo && cad <= hi) dedans.current++;
    }
    setEtat({ rep, e, repos });
    if (!debut.current) debut.current = 1;
  });
  const { zone } = useAppuis((cote, ts) => { if (!etat.repos) c.appui(cote, ts); });
  const cad = c.cadence(performance.now() / 1000), [lo, hi] = zones[Math.min(reps - 1, etat.rep)];
  const ok = cad >= lo && cad <= hi;
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        {reps > 1 && <span className="text-[10px] font-black tracking-[0.3em] text-white/50">{dans(['RÉPÉTITION', 'REP'])} {etat.rep + 1} / {reps}</span>}
        <Grand>{etat.repos ? '…' : cad}</Grand>
        <Petit couleur={etat.repos ? undefined : ok ? couleur : '#FF5A5F'}>
          {etat.repos ? dans(['Récupération', 'Recovery']) : `${dans(['Zone', 'Zone'])} ${lo}–${hi} ${dans(['appuis/s', 'taps/s'])}`}
        </Petit>
        <div className="relative w-full max-w-sm h-6 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0" style={{ left: `${lo / 14 * 100}%`, width: `${(hi - lo) / 14 * 100}%`, background: `${VERT}55` }} />
          <div className="absolute inset-y-0 w-1.5 -ml-0.5" style={{ left: `${Math.min(14, cad) / 14 * 100}%`, background: ok ? couleur : '#FF5A5F' }} />
        </div>
        <Piste p={etat.e / duree} couleur={couleur} />
      </div>
      <Zones zone={zone} />
    </>
  );
}

const JEUX: Record<Exercice, (p: JeuProps) => React.ReactElement> = {
  departs: p => <Departs {...p} />,
  lancee: p => <Lancee {...p} />,
  gammes: p => <Gammes {...p} />,
  virage: p => <Virage {...p} />,
  cotes: p => <Cotes {...p} />,
  muscu: p => <Muscu {...p} />,
  bonds: p => <Bonds {...p} />,
  gainage: p => <Gainage {...p} />,
  fractionne: p => <Allure {...p} reps={3} duree={6} zones={[[6, 9], [6.5, 9], [7, 9]]} />,
  tempo: p => <Allure {...p} reps={1} duree={16} zones={[[5, 7]]} />,
};

/* ================================================================ la seance */

export function SeanceJeu({ jour, a, onFin }: { jour: Jour; a: Athlete; onFin: () => void }) {
  const ex = exerciceDuJour(a, jour);
  const e = EXOS[ex];
  const couleur = COULEUR[SEANCES[jour].stat];
  const [phase, setPhase] = useState<'pret' | 'jeu' | 'fini'>('pret');
  const [res, setRes] = useState<{ score: number; r: ResultatSeance | null } | null>(null);
  const finir = (s: number) => {
    const score = borne(s);
    setRes({ score, r: faireLaSeance(a, jour, score, Math.random) });
    setPhase('fini');
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col bg-[rgba(4,8,7,0.98)] text-foreground select-none touch-none">
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] flex flex-col gap-1 max-w-lg w-full mx-auto shrink-0">
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: couleur }}>
          {mot(jour)} · {mot(SEANCES[jour].stat).toUpperCase()}
        </span>
        <h2 className="font-black font-display text-2xl leading-tight">{dans(e.nom)}</h2>
        <p className="text-xs text-white/70">{dans(a.coach ? e.serie : e.seul)}</p>
      </div>

      {phase === 'pret' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-white/80 max-w-xs leading-relaxed">{dans(e.jeu)}</p>
          <button onClick={() => setPhase('jeu')}
                  className="rounded-2xl px-12 py-4 text-xl font-black tracking-widest text-black" style={{ background: VERT }}>
            {mot('go')}
          </button>
        </div>
      )}
      {phase === 'jeu' && JEUX[ex]({ fini: finir, couleur })}
      {phase === 'fini' && res && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <span className="font-black font-display text-3xl">{mot('score', { n: Math.round(res.score * 100) })}</span>
          {res.r?.blessure
            ? <span className="text-red-400 font-bold">{mot('blessure_s')}</span>
            : res.r && (
              <div className="flex gap-3">
                {Object.entries(res.r.gains).map(([k, v]) => (
                  <span key={k} className="font-black" style={{ color: COULEUR[k as Stat] }}>{mot(k)} +{v}</span>
                ))}
              </div>
            )}
          <button onClick={onFin} className="mt-2 rounded-xl px-8 py-3 font-black tracking-widest text-black" style={{ background: VERT }}>
            {mot('continuer')}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
