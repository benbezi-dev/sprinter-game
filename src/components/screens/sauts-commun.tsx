import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import '@/game/sauts-mots.js'; // les mots des sauts, hors de la table commune
import { EST_TEST } from '@/game/canal';

/**
 * CE QUE LES CONCOURS DE SAUT PARTAGENT A L'ECRAN : la memoire du joueur,
 * la carte qui presente chaque etape, le drapeau du juge.
 *
 * Ce module ne voyage qu'avec les sauts (Jumper.tsx, charge a la demande
 * derriere SAUTS_OUVERTS).
 */

/* ------------------------------------------------------------ la memoire */

/**
 * La memoire d'une epreuve, dans l'appareil.
 *
 *   debloque   la plus haute etape ouverte au one shot
 *   plusLoin   la plus loin qu'une carriere soit allee (0 a 6)
 *   pb         le record personnel
 *   marques    les cinq meilleures marques de concours, la meilleure d'abord
 *
 * Les anciennes memoires n'avaient que les deux premiers champs : elles se
 * lisent toujours.
 */
export type MemoireSaut = {
  debloque: number; plusLoin: number;
  pb: { m: number; vent?: number } | null;
  marques: { m: number; etape: number }[];
};

export function lireMemoire(cle: string): MemoireSaut {
  try {
    const m = JSON.parse(localStorage.getItem(cle) || 'null');
    if (m && typeof m.debloque === 'number') {
      return {
        debloque: m.debloque, plusLoin: typeof m.plusLoin === 'number' ? m.plusLoin : m.debloque,
        pb: m.pb || null, marques: Array.isArray(m.marques) ? m.marques : [],
      };
    }
  } catch { /* stockage indisponible : on repart de zero */ }
  return { debloque: 0, plusLoin: 0, pb: null, marques: [] };
}

export function ecrireMemoire(cle: string, m: MemoireSaut) {
  try { localStorage.setItem(cle, JSON.stringify(m)); } catch { /* sans stockage, rien ne se retient */ }
}

/** La memoire, apres un concours : sa meilleure marque, et jusqu'ou il est alle. */
export function apresConcours(m: MemoireSaut, { marque, etape, podium, carriere }:
  { marque: number; etape: number; podium: boolean; carriere: boolean }): MemoireSaut {
  const n = { ...m, marques: m.marques.slice() };
  if (marque > 0) {
    n.marques.push({ m: marque, etape });
    n.marques.sort((a, b) => b.m - a.m);
    n.marques = n.marques.slice(0, 5);
  }
  if (podium && etape + 1 > n.debloque) n.debloque = Math.min(5, etape + 1);
  if (carriere) n.plusLoin = Math.max(n.plusLoin, etape + (podium ? 1 : 0));
  return n;
}

/* ------------------------------------------------------ la carte d'etape */

/**
 * LA PRESENTATION D'UNE ETAPE, comme Sprinter presente la sienne (CutScreen) :
 * en haut l'etape, sur une carte le favori et ce qu'il annonce, puis les
 * lignes de son histoire qui arrivent une a une. Deux touches pour passer.
 *
 * Le stade reste net derriere : le sautoir est deja arme, et c'est lui qu'on
 * regarde en lisant.
 *
 * ET LE FAVORI EST LA, EN PERSONNE. Sprinter fait entrer son champion en
 * courant, en grand, a gauche de la carte (GameCanvas, dessinerCinematique) ;
 * la carte des sauts ne montrait qu'un nom. Il entre maintenant de la meme
 * facon, avec le meme dessin (drawIcon) et sa propre allure — celle que le
 * moteur lui donne a partir de son nom (lookFor), ou la sienne s'il est un
 * ZEZE — et son ombre de course.
 */
export function CarteEtape({ etape, rival, annonce, lignes, onFin }: {
  etape: number; rival: string; annonce: string; lignes: string[]; onFin: () => void;
}) {
  const { N } = SprinterApp;
  const [t, setT] = useState(0);
  const [arme, setArme] = useState(false);
  const fini = useRef(false);
  const finir = () => { if (!fini.current) { fini.current = true; onFin(); } };
  const duree = 1.3 + lignes.length * 2.6 + 2.2;
  const toile = useRef<HTMLCanvasElement>(null);
  const favori = useRef<any>(null);
  if (!favori.current && rival) {
    const K = (globalThis as any).SprinterCore;
    const L = SprinterApp.LEVELS[etape];
    favori.current = {
      name: rival, look: (K.ZEZE && K.ZEZE[rival]) || K.lookFor(rival, L && L.pool),
      stride: 0, v: 10.5, maxSpeed: 11, fallAnim: 0, celebrate: 0,
    };
  }

  useEffect(() => {
    let id = 0;
    const t0 = performance.now();
    let avant = t0;
    const boucle = (now: number) => {
      const s = (now - t0) / 1000;
      setT(s);
      if (s >= duree) { finir(); return; }
      dessinerFavori(toile.current, favori.current, s, (now - avant) / 1000);
      avant = now;
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!arme) return;
    const id = setTimeout(() => setArme(false), 1600);
    return () => clearTimeout(id);
  }, [arme]);

  const carte = Math.max(0, Math.min(1, (t - 0.35) / 0.4));
  const glisse = 1 - Math.pow(1 - carte, 3);
  const accent = 'rgb(var(--primaire-rgb))';
  const pastille = 'inline-block max-w-full truncate rounded-full bg-[rgba(8,11,22,0.72)] px-3 py-1 md:px-4 md:py-1.5';

  return (
    <div className="fixed inset-0 z-[47] pointer-events-auto select-none"
         onClick={() => { if (arme) finir(); else setArme(true); }}>
      <canvas ref={toile} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />
      {carte > 0 && (
        <div
          className="absolute z-10 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(9,12,24,0.82)]
                     shadow-[0_18px_48px_rgba(0,0,0,0.38)]
                     pl-5 pr-4 py-3 sm:pl-6 sm:pr-5 sm:py-4 md:pl-8 md:pr-7 md:py-6
                     portrait:left-4 portrait:right-4 portrait:bottom-[calc(max(env(safe-area-inset-bottom),1.25rem)+2.5rem)]
                     landscape:left-[45vw] landscape:top-[12vh] landscape:w-[min(46vw,38rem)]"
          style={{ opacity: carte, transform: `translateY(${((1 - glisse) * 14).toFixed(1)}px)` }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5" style={{ backgroundColor: accent }} />
          <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase mb-1 md:mb-2" style={{ color: accent }}>
            {N.t('saut_rival')}
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight uppercase leading-[0.95] text-foreground">
            {rival}
          </h2>
          <div className="h-1 w-11/12 mt-2 md:mt-3" style={{ backgroundColor: accent }} />
          <div className="mt-2 md:mt-4 text-sm sm:text-base md:text-lg font-bold text-primary">
            {N.t('saut_annonce', { m: annonce })}
          </div>
          <div className="flex flex-col">
            {lignes.map((line, i) => {
              const lt = t - (1.3 + i * 2.6);
              const a = Math.max(0, Math.min(1, lt / 0.45));
              return (
                <div key={i} className="grid transition-[grid-template-rows] duration-500 ease-out"
                     style={{ gridTemplateRows: lt > 0 ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <div className={`${i === 0 ? 'pt-3 md:pt-5' : 'pt-1.5 md:pt-3'} text-xs sm:text-sm md:text-base font-medium text-foreground/90 leading-snug`}
                         style={{ opacity: a }}>
                      {line}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Sous le bandeau du canal de test quand il est la. */}
      <div className={`absolute ${EST_TEST ? 'top-[calc(max(env(safe-area-inset-top),1.25rem)+2.2rem)]' : 'top-[max(env(safe-area-inset-top),1.25rem)]'} w-full text-center px-4 z-10`}>
        <span className={`${pastille} text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase text-foreground/75`}>
          {`${N.t('stage_up')}${etape + 1}  —  ${N.levelName(etape)}`}
        </span>
      </div>
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] w-full text-center px-4 z-10">
        <span className={`${pastille} text-[10px] sm:text-xs md:text-base font-bold tracking-widest ${arme ? 'text-primary animate-pulse' : 'text-foreground/70'}`}>
          {arme ? N.t('skip_now') : N.t('skip_twice')}
        </span>
      </div>
    </div>
  );
}

/**
 * Le favori qui entre en courant, a la place et a la taille ou Sprinter fait
 * entrer le sien (GameCanvas, pointDuPersonnage et dessinerCinematique) : au
 * quart gauche en paysage, au-dessus de la carte en portrait, les pieds aux
 * trois quarts de la hauteur. Il glisse depuis la gauche pendant une
 * demi-seconde, puis court sur place.
 */
function dessinerFavori(cv: HTMLCanvasElement | null, homme: any, s: number, dt: number) {
  if (!cv || !homme) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  homme.stride += Math.min(dt, 0.1) * 11;
  const portrait = h > w;
  const gx = (portrait ? 0.5 : 0.24) * w * dpr;
  const gy = (portrait ? 0.46 : 0.8) * h * dpr;
  // la taille est celle d'un deux-metres en pixels : le personnage en fait ~90 %
  const taille = (portrait ? 0.42 : 0.72) * h * dpr;
  const app = Math.max(0, Math.min(1, s / 0.55));
  const x = gx - taille * 0.85 * (1 - (1 - Math.pow(1 - app, 3)));
  const Prem = (globalThis as any).RenduPremium;
  const K = (globalThis as any).SprinterCore;
  if (Prem && K) Prem.ombre(ctx, x, gy, taille / 2, homme.look.h / K.C.MODEL_H, homme.stride, false);
  SprinterApp.drawIcon(ctx, homme, x, gy, taille, false);
}

/* ------------------------------------------------------------ le drapeau */

/** Le drapeau du juge : blanc valable, rouge nul. */
export function Drapeau({ blanc }: { blanc: boolean }) {
  return (
    <svg viewBox="0 0 24 28" className="w-7 h-8 shrink-0" aria-hidden>
      <line x1="4" y1="2" x2="4" y2="27" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 3 C 11 1, 15 6, 22 3 L 22 15 C 15 18, 11 13, 5 15 Z"
            fill={blanc ? '#f6f6f2' : '#e22828'} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
    </svg>
  );
}

/** Le premier mot d'un nom, pour le recit. */
export const prenom = (nom: string) => (nom || '').split(' ')[0];

/**
 * LA FIN D'UN CONCOURS, dans la carriere ou en one shot. Rend les boutons a
 * poser sous le classement : l'etape suivante si le podium est la, sinon la
 * carriere recommence — c'est la regle de Sprinter, ou une etape manquee
 * arrete le parcours.
 */
export function BoutonsFin({ carriere, podium, etape, derniere, onSuivant, onRejouer, onCarriere, onQuitter }: {
  carriere: boolean; podium: boolean; etape: number; derniere: boolean;
  onSuivant: () => void; onRejouer: () => void; onCarriere: () => void; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const plein = 'py-2.5 rounded-xl font-black font-display tracking-widest text-sm text-black bg-primary';
  const vide = 'py-2.5 rounded-xl font-black font-display tracking-widest text-sm border border-white/20 text-white';
  void etape;
  return (
    <div className="flex flex-col gap-2">
      {carriere && podium && !derniere && (
        <button onClick={onSuivant} className={plein}>{N.t('saut_suivant')}</button>
      )}
      {carriere && !podium && (
        <button onClick={onCarriere} className={plein}>{N.t('saut_carriere_refaire')}</button>
      )}
      {!carriere && <button onClick={onRejouer} className={plein}>{N.t('saut_refaire')}</button>}
      <button onClick={onQuitter} className={carriere && podium && derniere ? plein : vide}>
        {N.t('saut_accueil')}
      </button>
    </div>
  );
}
