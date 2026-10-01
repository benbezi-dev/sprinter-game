import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp } from '@/game/engine';
import '@/game/sauts-mots.js'; // les mots des sauts, hors de la table commune
import { EST_TEST } from '@/game/canal';
import { recitDe } from '@/game/sauts-recits.js';
import {
  lireMemoire, ecrireMemoire, apresConcours, CarteEtape, Drapeau, BoutonsFin, prenom,
  type MemoireSaut,
} from './sauts-commun';
import { RECORDS, lireHauteur, cm } from '@/game/hauteur.js';
import {
  PLATEAU, nouveauConcours, avancerJusquAuJoueur, aQui, classement, joueurEnLice,
  placeDuJoueur, meilleur, aLaBarre, inscrire, inscrireJoueur, deciderPartage, choisirBarre, arreter,
  tempsDuJoueur, VITESSE_JUSTE,
} from '@/game/hauteur-jeu.js';
import {
  armerConcoursHauteur, appelerSauteur, mettreAuRepos, montrerBarre, rangerConcoursHauteur,
  ecouterHauteur, etatHauteur,
} from '@/game/hauteur-course.js';

/**
 * LE CONCOURS DE SAUT EN HAUTEUR.
 *
 * Le saut se joue dans le stade, sur le moteur de Sprinter : cet ecran ne
 * dessine pas l'athlete, il tient le CONCOURS — la barre qui monte, l'ordre de
 * passage, les adversaires qui sautent avant toi, la minute, la feuille avec
 * ses « o », ses « x » et ses « – », le departage, le barrage. Et la seule
 * decision que le reglement laisse a l'athlete en dehors du saut : sauter
 * cette barre, ou la PASSER.
 *
 * Il se pose PAR-DESSUS la piste, transparent, et ne prend jamais les appuis :
 * les paves de course sont en dessous, et ce sont eux qui sautent.
 */

const CLE = 'sprinter.hauteur.v1';
const RECORD = RECORDS.hommes;

type Memoire = MemoireSaut;

/** Les finalistes : le plateau de Sprinter, et quatre de plus aux grands championnats. */
const RENFORTS: Record<number, string[]> = {
  3: ['Mutaz Salto', 'Gian Tambor', 'Ilya Vysok', 'Juvaun Hale'],
  4: ['Zane Orbit', 'Milo Vaux', 'Dario Luce', 'Kenji Sora'],
};
function nomsDe(etape: number): string[] {
  const L = SprinterApp.LEVELS[etape];
  return [...((L && L.names) || []), ...(RENFORTS[etape] || [])];
}

const hauteur = (m: number) => lireHauteur(m, SprinterApp.N.getLang() === 'fr' ? ',' : '.');

/** Un essai tel que la feuille l'ecrit. */
function Essai({ c }: { c: string }) {
  const couleur = c === 'o' ? 'rgb(74,222,128)' : c === 'x' ? '#f87171' : 'rgba(255,255,255,0.45)';
  return <span style={{ color: couleur }}>{c === '-' ? '–' : c.toUpperCase()}</span>;
}

type Proprietes = {
  etape: number; carriere: boolean;
  onQuitter: () => void; onSuivant: () => void; onRejouer: () => void; onCarriere: () => void;
};

/** Un concours de hauteur, lance depuis l'accueil de Jumper. */
export function Hauteur({ etape, carriere, onQuitter, onSuivant, onRejouer, onCarriere }: Proprietes) {
  const [memoire, setMemoire] = useState<Memoire>(() => lireMemoire(CLE));
  return (
    <Concours etape={etape} carriere={carriere} accent="rgb(var(--primaire-rgb))" memoire={memoire}
              onMemoire={(m) => { setMemoire(m); ecrireMemoire(CLE, m); }}
              onSuivant={onSuivant} onRejouer={onRejouer} onCarriere={onCarriere} onQuitter={onQuitter} />
  );
}

/* --------------------------------------------------------- le concours */

type Temps = 'carte' | 'autres' | 'decision' | 'toi' | 'partage' | 'fin';
type Fait = { index: number; nom: string; h: number; essai: string; barrage?: boolean };
type Annonce = { sorte: string; texte: string; sous?: string; couleur: string; drapeau?: boolean };

function Concours({ etape, carriere, accent, memoire, onMemoire, onSuivant, onRejouer, onCarriere, onQuitter }: {
  etape: number; carriere: boolean; accent: string; memoire: Memoire;
  onMemoire: (m: Memoire) => void; onSuivant: () => void; onRejouer: () => void; onCarriere: () => void;
  onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const c = useRef<any>(nouveauConcours({ etape, noms: nomsDe(etape), joueur: N.t('you') }));
  // La carte d'etape d'abord, comme dans Sprinter.
  const [temps, setTemps] = useState<Temps>('carte');
  const carte = useRef<null | { rival: string; annonce: string; lignes: string[] }>(null);
  if (!carte.current) {
    const fav = c.current.athletes.filter((a: any) => !a.joueur).sort((a: any, b: any) => b.niveau - a.niveau)[0];
    carte.current = fav
      ? { rival: fav.nom, annonce: `${hauteur(fav.niveau)} m`, lignes: recitDe(etape, N.getLang(), prenom(fav.nom)) }
      : { rival: '', annonce: '', lignes: [] };
  }
  const [file, setFile] = useState<Fait[]>([]);
  const [vus, setVus] = useState(0);
  const [, rafraichir] = useState(0);
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [live, setLive] = useState<{ phase: string; v: number; horloge: number } | null>(null);
  const [record, setRecord] = useState(false);
  const quitte = useRef(false);
  const memoireRef = useRef(memoire);
  memoireRef.current = memoire;

  const joueur = c.current.athletes.findIndex((a: any) => a.joueur);
  const C = c.current;

  /* --- l'armement du stade, et son rangement --- */
  useEffect(() => {
    armerConcoursHauteur(etape);
    montrerBarre(c.current.h);
    return () => { if (!quitte.current) rangerConcoursHauteur(); };
  }, [etape]);

  /* --- faire sauter les autres jusqu'a toi --- */
  const avancerRef = useRef<() => void>(() => {});
  const avancer = useCallback(() => avancerRef.current(), []);
  avancerRef.current = () => {
    const K = c.current;
    if (K.partage) { mettreAuRepos(K.h); setTemps('partage'); return; }
    const faits = avancerJusquAuJoueur(K, Math.random) as Fait[];
    if (faits.length) {
      mettreAuRepos(faits[0].h);
      setFile(faits);
      setVus(0);
      setTemps('autres');
      return;
    }
    if (K.partage) { mettreAuRepos(K.h); setTemps('partage'); return; }
    if (K.fini || aQui(K) === null) { finir(); return; }
    mettreAuRepos(K.h);
    setAnnonce(null);
    setTemps('decision');
  };

  const sauter = () => {
    const K = c.current;
    appelerSauteur({ hauteur: K.h, temps: tempsDuJoueur(K) });
    setAnnonce(null);
    setRecord(false);
    setTemps('toi');
  };

  const passer = () => {
    const K = c.current;
    inscrire(K, joueur, '-');
    rafraichir(x => x + 1);
    avancer();
  };

  const finir = () => {
    setTemps('fin');
    mettreAuRepos(c.current.h);
    const place = placeDuJoueur(c.current) || 99;
    const moi = meilleur(c.current.athletes[joueur]);
    onMemoire(apresConcours(memoireRef.current, { marque: moi, etape, podium: moi > 0 && place <= 3, carriere }));
  };

  /* --- le deroule des autres, un par un --- */
  useEffect(() => {
    if (temps !== 'autres') return;
    if (vus >= file.length) {
      const id = setTimeout(() => avancer(), file.length ? 700 : 0);
      return () => clearTimeout(id);
    }
    // La barre du stade suit celle de l'essai qu'on regarde.
    if (file[vus]) montrerBarre(file[vus].h);
    const id = setTimeout(() => setVus(v => v + 1), file[vus] && file[vus].essai === '-' ? 420 : 850);
    return () => clearTimeout(id);
  }, [temps, vus, file, avancer]);

  /* --- ce qui se passe au sautoir --- */
  useEffect(() => ecouterHauteur((evt: any) => {
    if (evt.type === 'range') {
      if (!quitte.current) { quitte.current = true; onQuitter(); }
      return;
    }
    if (evt.type === 'appel') {
      const elan = evt.elan as string;
      const couleur = elan === 'juste' ? 'rgb(74,222,128)' : elan === 'trop' ? '#f87171' : 'rgb(250,214,60)';
      setAnnonce({ sorte: 'appel', texte: N.t('haut_elan_' + elan),
        sous: `${N.t('saut_elan')} ${evt.vElan.toFixed(1)} m/s · ${N.t('haut_appel', { d: evt.ecart.toFixed(2).replace('.', N.getLang() === 'fr' ? ',' : '.') })}`,
        couleur });
    }
    if (evt.type === 'envol') {
      setAnnonce(a => a ? { ...a, sous: `${a.sous || ''} · ${N.t('saut_angle')} ${Math.round(evt.angle)}° (${N.t('haut_vise', { a: String(Math.round(evt.vise)) })})` } : a);
    }
    if (evt.type === 'marque') {
      const r = evt.resultat;
      const h = c.current.h;
      if (r.franchi) {
        const notes = [N.t('haut_cambre_' + r.cambre), N.t('haut_jambes_' + r.jambes)].join(' · ');
        setAnnonce({ sorte: 'marque', drapeau: true, texte: `${hauteur(h)} · ${N.t('haut_franchi')}`,
          sous: (r.tremble ? N.t('haut_tremble') + ' · ' : '') + notes, couleur: accent });
        const mem = memoireRef.current;
        if (!mem.pb || cm(h) > cm(mem.pb.m)) { setRecord(true); onMemoire({ ...mem, pb: { m: h } }); }
      } else if (r.raison === 'barre') {
        const notes = [N.t('haut_cambre_' + r.cambre), N.t('haut_jambes_' + r.jambes)].join(' · ');
        setAnnonce({ sorte: 'marque', drapeau: true, texte: N.t('haut_tombee'),
          sous: `${N.t('haut_par_' + r.par)} · ${notes}`, couleur: '#f87171' });
      } else {
        setAnnonce({ sorte: 'marque', drapeau: true, texte: N.t('haut_echec'),
          sous: N.t('haut_nul_' + r.raison), couleur: '#f87171' });
      }
    }
    if (evt.type === 'fin') {
      const r = evt.resultat;
      inscrireJoueur(c.current, r.franchi ? 'o' : 'x');
      rafraichir(x => x + 1);
      setTimeout(() => { setAnnonce(null); setRecord(false); avancer(); }, 250);
    }
  }), [avancer]);

  /* --- les chiffres de l'essai en cours --- */
  useEffect(() => {
    if (temps !== 'toi') { setLive(null); return; }
    let id = 0, dernier = 0;
    const boucle = (t: number) => {
      if (t - dernier > 66) {
        dernier = t;
        const e = etatHauteur();
        const j = SprinterApp.G.player;
        if (e && j) setLive({ phase: e.phase, v: j.v, horloge: e.horloge });
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [temps]);

  const quitter = () => { quitte.current = true; rangerConcoursHauteur(); onQuitter(); };

  const cl = classement(C);
  const moi = C.athletes[joueur];
  const aMaBarre = aLaBarre(moi, C.h);
  const libre = C.libre && temps === 'decision' && !C.barrage && aMaBarre === '' && joueurEnLice(C);
  // Les barres du joueur, les quatre dernieres, comme sur la feuille du juge.
  const feuille = Object.keys(moi.feuille).map(Number).sort((x, y) => x - y).slice(-4);
  const essaiNo = C.barrage ? 1 : aMaBarre.replace('-', '').length + 1;

  if (temps === 'carte') {
    const K = carte.current!;
    return <CarteEtape etape={etape} rival={K.rival} annonce={K.annonce} lignes={K.lignes}
                       onFin={() => { setTemps('autres'); avancer(); }} />;
  }

  return (
    <div className={`fixed inset-0 z-[46] pointer-events-none select-none
                    px-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]
                    ${EST_TEST ? 'pt-[calc(max(env(safe-area-inset-top),0.6rem)+2.2rem)]' : 'pt-[max(env(safe-area-inset-top),0.6rem)]'}`}>
      {/* L'EN-TETE : l'epreuve, l'etape, la barre, et la feuille du joueur. */}
      <div className="max-w-lg mx-auto flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black tracking-tight text-base leading-none" style={{ color: accent }}>
              {N.t('disc_hauteur')}
            </span>
            <span className="text-[9px] tracking-widest uppercase text-white/50 truncate">{N.levelName(etape)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
            <span className="px-2 h-6 rounded-md border border-white/40 bg-black/45 flex items-center font-mono text-[11px] font-bold text-white tabular-nums">
              {N.t('haut_barre', { h: hauteur(C.h) })}
            </span>
            {feuille.map(k => (
              <span key={k} className="px-1.5 h-6 rounded-md border border-white/10 bg-black/35 flex items-center gap-1 font-mono text-[9px] tabular-nums text-white/60">
                {hauteur(k / 100)}
                <span className="font-bold">{moi.feuille[k].split('').map((x: string, i: number) => <Essai key={i} c={x} />)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button onPointerDown={e => { e.stopPropagation(); quitter(); }}
                  className="pointer-events-auto px-2.5 py-1 rounded-full border border-white/15 bg-black/40
                             text-white/60 text-[9px] tracking-widest hover:text-white">
            {N.t('saut_quitter')}
          </button>
          {/* Les echecs de suite : trois, et c'est fini. */}
          <span className="flex gap-1" aria-label={N.t('haut_suite', { n: String(moi.suite) })}>
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full"
                    style={{ background: i < moi.suite ? '#f87171' : 'rgba(255,255,255,0.18)' }} />
            ))}
          </span>
          {temps === 'toi' && live && live.phase === 'attente' && (
            <span className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: live.horloge <= 15 ? 'rgb(250,214,60)' : 'rgba(255,255,255,0.8)' }}>
              {Math.max(0, Math.ceil(live.horloge))} s
            </span>
          )}
          {/* LE TABLEAU : les trois premiers, et toi si tu n'y es pas. En
              haut a droite, sous l'en-tete, sur un verre transparent a 80 %,
              comme a la longueur : a gauche, il couvrait le sautoir. */}
          {temps !== 'fin' && (
            <div className="mt-1">
              <Tableau lignes={cl} accent={accent} h={C.h} court />
            </div>
          )}
        </div>
      </div>

      {/* CE QUE FONT LES AUTRES, un par un. */}
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
                    <div key={f.index + ':' + f.h + ':' + k}
                         className={`flex items-center justify-between gap-2 ${dernier ? '' : 'opacity-45'}`}>
                      <span className="text-[11px] font-bold tracking-wide text-white truncate">{f.nom}</span>
                      <span className="font-mono text-[12px] tabular-nums flex items-center gap-2">
                        <span className="text-white/60">{hauteur(f.h)}</span>
                        <span style={{ color: f.essai === 'o' ? accent : f.essai === 'x' ? '#f87171' : 'rgba(255,255,255,0.45)' }}>
                          {N.t(f.essai === 'o' ? 'haut_franchi' : f.essai === 'x' ? 'haut_echec' : 'haut_passe')}
                        </span>
                      </span>
                    </div>
                  );
                })}
                {vus < file.length && (
                  <div className="text-[10px] tracking-widest text-white/50">
                    {N.t('haut_saute', { n: file[vus].nom, h: hauteur(file[vus].h) })}
                  </div>
                )}
              </div>
              <div className="mt-2 text-center text-[8px] tracking-widest uppercase text-white/30">{N.t('saut_passer')}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A TOI : sauter cette barre, ou la passer. Seul et vainqueur, choisir la barre. */}
      <AnimatePresence>
        {temps === 'decision' && (
          <motion.div key={'decision' + C.h + ':' + aMaBarre} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-[34%] flex justify-center pointer-events-auto">
            <div className="w-[min(92vw,21rem)] rounded-2xl border border-white/15 bg-black/75 backdrop-blur-sm p-4 flex flex-col gap-3 text-center">
              <p className="text-[9px] tracking-widest uppercase text-white/50">
                {C.barrage ? N.t('haut_barrage_essai') : libre ? N.t('haut_libre') : N.t('saut_a_toi')}
              </p>
              <p className="font-display font-black text-4xl tracking-tight tabular-nums" style={{ color: accent }}>
                {hauteur(C.h)} m
              </p>
              {cm(C.h) > cm(RECORD.m) && <p className="text-[10px] font-bold tracking-widest text-[rgb(250,204,21)]">{N.t('haut_record_tente')}</p>}
              {!C.barrage && !libre && (
                <p className="text-[10px] tracking-widest text-white/60">
                  {N.t('haut_essai', { n: String(essaiNo) })}
                  {moi.suite > 0 && ` · ${N.t('haut_suite', { n: String(moi.suite) })}`}
                </p>
              )}
              {libre && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[0.01, 0.02, 0.03, 0.05].map(d => {
                    const h = Math.round((meilleur(moi) + d) * 100) / 100;
                    return (
                      <button key={d} onClick={() => { choisirBarre(C, h); montrerBarre(h); rafraichir(x => x + 1); }}
                              className={`px-2.5 py-1 rounded-full border font-mono text-[11px]
                                ${cm(h) === cm(C.h) ? 'border-white/70 text-white' : 'border-white/20 text-white/60'}`}>
                        {hauteur(h)}
                      </button>
                    );
                  })}
                  {cm(meilleur(moi)) <= cm(RECORD.m) && (
                    <button onClick={() => { const h = RECORD.m + 0.01; choisirBarre(C, h); montrerBarre(h); rafraichir(x => x + 1); }}
                            className={`px-2.5 py-1 rounded-full border font-mono text-[11px]
                              ${cm(C.h) === cm(RECORD.m + 0.01) ? 'border-[rgb(250,204,21)] text-[rgb(250,204,21)]' : 'border-[rgb(250,204,21)]/40 text-[rgb(250,204,21)]/80'}`}>
                      {N.t('saut_rm')} {hauteur(RECORD.m + 0.01)}
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={sauter}
                        className="flex-1 py-2.5 rounded-xl font-black font-display tracking-widest text-sm text-black"
                        style={{ backgroundColor: accent }}>
                  {N.t('haut_sauter')}
                </button>
                {!C.barrage && !libre && (
                  <button onClick={passer}
                          className="flex-1 py-2.5 rounded-xl font-black font-display tracking-widest text-sm border border-white/25 text-white">
                    {N.t('haut_passer')}
                  </button>
                )}
                {libre && (
                  <button onClick={() => { arreter(C, joueur); rafraichir(x => x + 1); avancer(); }}
                          className="flex-1 py-2.5 rounded-xl font-black font-display tracking-widest text-sm border border-white/25 text-white">
                    {N.t('haut_arreter')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EX AEQUO POUR L'OR : partager, ou le barrage. */}
      <AnimatePresence>
        {temps === 'partage' && C.partage && (
          <motion.div key="partage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/30">
            <div className="w-[min(92vw,22rem)] rounded-2xl border border-white/15 bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-3 text-center">
              <p className="font-display font-black text-xl tracking-tight" style={{ color: accent }}>{N.t('haut_partage_titre')}</p>
              <p className="text-[11px] leading-snug text-white/70">{N.t('haut_partage_txt')}</p>
              <p className="text-[11px] font-bold text-white">
                {C.partage.en.map((i: number) => C.athletes[i].nom).join(' · ')} — {hauteur(C.partage.h)} m
              </p>
              <div className="flex gap-2">
                <button onClick={() => { deciderPartage(C, false); rafraichir(x => x + 1); finir(); }}
                        className="flex-1 py-2.5 rounded-xl font-black font-display tracking-widest text-sm text-black"
                        style={{ backgroundColor: 'rgb(250,204,21)' }}>
                  {N.t('haut_partager')}
                </button>
                <button onClick={() => { deciderPartage(C, true); montrerBarre(C.h); rafraichir(x => x + 1); avancer(); }}
                        className="flex-1 py-2.5 rounded-xl font-black font-display tracking-widest text-sm border border-white/25 text-white">
                  {N.t('haut_barrage')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A TOI, puis les chiffres qui comptent. */}
      {temps === 'toi' && live && live.phase === 'attente' && (
        <div className="absolute inset-x-0 top-[40%] flex flex-col items-center">
          <span className="font-display font-black tracking-tight text-3xl" style={{ color: accent }}>
            {N.t('saut_a_toi')}
          </span>
          <span className="font-mono text-sm text-white/80">{hauteur(C.h)} m</span>
        </div>
      )}
      {temps === 'toi' && live && live.phase === 'elan' && (
        <div className="absolute inset-x-0 bottom-[calc(22vh+2.2rem)] flex justify-center">
          {/* LA VITESSE SE CONTROLE : verte autour de la vitesse juste, rouge au-dessus. */}
          <span className="font-mono text-sm tabular-nums bg-black/45 rounded-full px-3 py-0.5"
                style={{ color: live.v > VITESSE_JUSTE + 0.45 ? '#f87171'
                  : live.v >= VITESSE_JUSTE - 0.35 ? 'rgb(74,222,128)' : 'rgba(255,255,255,0.85)' }}>
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
                              ${annonce.sorte === 'marque' ? 'text-4xl' : 'text-xl'}`}
                  style={{ color: annonce.couleur }}>
              {annonce.drapeau && <Drapeau blanc={annonce.couleur !== '#f87171'} />}
              {annonce.texte}
            </span>
            {annonce.sous && (
              <span className="text-[10px] tracking-wider text-white/85 bg-black/45 rounded-full px-3 py-0.5 text-center max-w-[92vw]">
                {annonce.sous}
              </span>
            )}
            {annonce.sorte === 'marque' && record && (
              <span className="mt-1 text-[10px] font-bold tracking-widest" style={{ color: 'rgb(250,214,60)' }}>
                {N.t('saut_record_perso')}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {temps === 'fin' && (
          <motion.div key="fin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/40">
            <Fin C={C} etape={etape} carriere={carriere} accent={accent}
                 onRejouer={() => { quitte.current = true; onRejouer(); }}
                 onSuivant={() => { quitte.current = true; onSuivant(); }}
                 onCarriere={() => { quitte.current = true; onCarriere(); }}
                 onQuitter={quitter} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ le tableau */

function Tableau({ lignes, accent, h, court = false }: { lignes: any[]; accent: string; h: number; court?: boolean }) {
  const { N } = SprinterApp;
  let vues = lignes;
  if (court) {
    vues = lignes.slice(0, 3);
    const moi = lignes.find(l => l.joueur);
    if (moi && !vues.includes(moi)) vues = [...vues, moi];
  }
  return (
    <div className={`rounded-xl ${court
      ? 'bg-[rgba(6,9,19,0.2)] border border-white/10 backdrop-blur-[2px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] w-[min(46vw,15rem)] text-left'
      : ''} px-2 py-1.5 flex flex-col gap-0.5`}>
      {!court && <div className="text-[9px] tracking-widest uppercase text-white/40 mb-1">{N.t('saut_classement')}</div>}
      {vues.map(l => {
        const ici = l.feuille[cm(h)] || '';
        return (
          <div key={l.index} className={`flex items-center gap-2 text-[10px] ${l.elimine && court ? 'opacity-45' : ''}`}>
            <span className="w-5 font-mono text-white/45 tabular-nums">{l.meilleur > 0 ? l.place : '–'}</span>
            <span className={`flex-1 truncate ${l.joueur ? 'font-black' : 'font-semibold'}`}
                  style={{ color: l.joueur ? accent : 'rgba(255,255,255,0.85)' }}>{l.nom}</span>
            {court && ici && (
              <span className="font-mono text-[9px]">{ici.split('').map((x: string, i: number) => <Essai key={i} c={x} />)}</span>
            )}
            <span className="font-mono tabular-nums text-white/85 min-w-9 text-right whitespace-nowrap">
              {l.meilleur > 0 ? hauteur(l.meilleur) : (Object.keys(l.feuille).length ? N.t('saut_nm') : '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Fin({ C, etape, carriere, accent, onRejouer, onSuivant, onCarriere, onQuitter }: {
  C: any; etape: number; carriere: boolean; accent: string;
  onRejouer: () => void; onSuivant: () => void; onCarriere: () => void; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const cl = classement(C);
  const place = placeDuJoueur(C) || cl.length;
  const moi = cl.find((l: any) => l.joueur);
  const podium = !!moi && moi.meilleur > 0 && place <= 3;
  const medaille = podium ? ['saut_or', 'saut_argent', 'saut_bronze'][place - 1] : null;
  const couleur = medaille ? ['rgb(250,204,21)', 'rgb(203,213,225)', 'rgb(217,119,6)'][place - 1] : accent;
  const derniere = etape + 1 >= PLATEAU.length;
  return (
    <div className="w-[min(94vw,24rem)] rounded-2xl border border-white/12 bg-black/80 backdrop-blur-md p-4 flex flex-col gap-3">
      <div className="text-center">
        <p className="text-[9px] tracking-widest uppercase text-white/45">{N.t('saut_fini')} · {N.levelName(etape)}</p>
        <p className="mt-1 font-display font-black tracking-tight text-3xl" style={{ color: couleur }}>
          {medaille ? N.t(medaille) : N.t('saut_place', { p: N.ord(place) })}
        </p>
        <p className="font-mono text-xl text-white">
          {moi && moi.meilleur > 0 ? `${hauteur(moi.meilleur)} m` : N.t('saut_nm')}
        </p>
        {carriere && (
          <p className="mt-1 text-[10px] tracking-widest" style={{ color: podium ? accent : '#f87171' }}>
            {podium ? (derniere ? N.t('saut_champion') : N.t('saut_qualifie_etape')) : N.t('saut_carriere_finie')}
          </p>
        )}
      </div>
      <Tableau lignes={cl} accent={accent} h={C.h} />
      <p className="text-center text-[8px] tracking-wide text-white/35">
        {N.t('saut_record', { m: hauteur(RECORD.m), n: RECORD.qui, a: String(RECORD.an) })}
      </p>
      <BoutonsFin carriere={carriere} podium={podium} etape={etape} derniere={derniere}
                  onSuivant={onSuivant} onRejouer={onRejouer} onCarriere={onCarriere} onQuitter={onQuitter} />
    </div>
  );
}
