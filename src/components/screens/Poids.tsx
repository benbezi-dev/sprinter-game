import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp, buzz } from '@/game/engine';
import { MONDES } from '@/game/mondes';
import { ESSAIS, RECORDS, MASSE, CERCLE } from '@/game/poids.js';
import {
  essai as lancer, meilleur, marque, portee, vitesseA,
  ANGLE_MIN, ANGLE_MAX, SEUIL_MORSURE,
} from '@/game/poids-jeu.js';

/**
 * LE LANCER DU POIDS.
 *
 * Sprinter tient sur un geste repete pendant dix secondes. Un lancer est fini
 * avant d'avoir commence : il fallait qu'UNE pression porte assez de decision
 * pour qu'on ait envie de recommencer six fois.
 *
 * D'ou la forme de cet ecran : deux jauges qui balayent, deux pressions pour
 * les figer, et un risque visible entre les deux. On regle la poussee, puis
 * l'angle — l'ordre du geste reel, et l'ordre dans lequel un lanceur les
 * arbitre. La troisieme decision n'a pas de jauge : c'est de savoir si l'on va
 * chercher le dernier pour cent avant le rouge.
 *
 * LE MEME VOCABULAIRE D'ENTREE QUE LE RESTE DU JEU. Une pression, n'importe ou,
 * ou la barre d'espace. Sprinter se joue a deux touches parce que c'est ce
 * qu'un telephone sait faire sans clavier ; un lancer se joue a une, pour la
 * meme raison. Aucun glissement, aucun maintien, aucune visee au doigt : ce
 * sont des gestes qui ne survivent pas a un pouce sur un ecran de 5 pouces.
 */

/* ------------------------------------------------------------- les jauges */

/**
 * La vitesse de balayage, en aller-retour par seconde.
 *
 * La poussee balaye plus vite que l'angle, et c'est ce qui hierarchise les deux
 * decisions. La poussee est celle qui rapporte — sept metres separent une
 * bonne d'une mauvaise a l'etape mondiale — donc c'est elle qui doit etre
 * difficile. L'angle pardonne davantage dans le modele, il pardonne donc
 * davantage a la main.
 */
const CADENCE = { poussee: 0.62, angle: 0.42 };

type Phase = 'poussee' | 'angle' | 'vol' | 'marque' | 'fini';

/** Le va-et-vient d'une jauge : 0 -> 1 -> 0, sans a-coup aux extremites. */
function vaEtVient(t: number, cadence: number) {
  const x = (t * cadence) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

/* ------------------------------------------------------------- le terrain */

/**
 * Le lancer vu de cote, en SVG.
 *
 * Un SVG plutot qu'un canvas : le dessin ne bouge qu'a un endroit — l'engin —
 * et tout le reste est fixe. Un canvas aurait demande une boucle de rendu pour
 * redessiner un decor qui ne change pas.
 *
 * L'echelle suit l'etape : au niveau scolaire on voit douze metres, a
 * l'intergalactique trente-cinq. Une echelle fixe aurait rendu les premiers
 * lancers minuscules, ou les derniers hors champ.
 */
function Terrain({ metresVus, vol, marqueM, accent }: {
  metresVus: number;
  vol: { v: number; angle: number; t: number } | null;
  marqueM: number | null;
  accent: string;
}) {
  /*
   * L'ESPACE DE COORDONNEES FAIT LA TAILLE DE L'ECRAN, ET PAS MILLE UNITES.
   *
   * Il en faisait mille. Sur un telephone de 375 px, une unite valait alors
   * 0,375 px : les chiffres ecrits en 16 arrivaient a 6 px, et les reperes de
   * distance etaient illisibles. Un viewBox n'est pas une resolution — c'est
   * un systeme de mesure, et le prendre dix fois trop grand ne gagne aucune
   * finesse, ca ne fait que diviser toutes les tailles de texte par trois.
   *
   * 400 x 420 : proche de la taille reelle en pixels, donc ce qu'on ecrit 13
   * se lit 13.
   */
  const L = 400, HT = 420;
  const sol = HT - 52;
  /*
   * LA VERTICALE EST EXAGEREE, ET IL LE FAUT.
   *
   * Un lancer a 23 m culmine a 8 m : a l'echelle, la courbe serait un trait
   * legerement bombe dans un tiers inferieur d'image, et le reste de la
   * hauteur ne servirait a rien. La hauteur montree vaut donc 45 % de la
   * portee montree, ce qui etire le sommet d'environ deux fois et demie.
   *
   * C'est une deformation assumee, et elle ne ment sur rien de mesurable : la
   * seule chose qu'on lit sur ce dessin est l'abscisse de la chute, qui reste
   * a l'echelle. La verticale, elle, ne sert qu'a montrer qu'un lancer tendu
   * et un lancer en cloche ne sont pas le meme geste.
   */
  const hautVu = Math.max(6, metresVus * 0.45);
  const px = (m: number) => 26 + (m / metresVus) * (L - 46);
  const py = (m: number) => sol - (m / hautVu) * (sol - 30);

  // La trajectoire complete, echantillonnee. On la trace en entier derriere
  // l'engin : voir la courbe est ce qui apprend l'angle.
  let chemin = '';
  let balle = null as null | { x: number; y: number };
  if (vol) {
    const a = vol.angle * Math.PI / 180;
    const vx = vol.v * Math.cos(a), vy0 = vol.v * Math.sin(a);
    const g = 9.81, h0 = 2.10, x0 = 0.25;
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * vol.t;
      const x = x0 + vx * t;
      const y = h0 + vy0 * t - 0.5 * g * t * t;
      if (y < 0) break;
      pts.push(`${px(x).toFixed(1)},${py(y).toFixed(1)}`);
      balle = { x: px(x), y: py(y) };
    }
    chemin = pts.join(' ');
  }

  return (
    <svg viewBox={`0 0 ${L} ${HT}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet"
         role="img" aria-hidden>
      {/* le sol */}
      <line x1="0" y1={sol} x2={L} y2={sol} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      {/* les reperes de distance, tous les cinq metres */}
      {Array.from({ length: Math.floor(metresVus / 5) }, (_, i) => (i + 1) * 5).map(m => (
        <g key={m}>
          <line x1={px(m)} y1={sol} x2={px(m)} y2={sol + 6}
                stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          <text x={px(m)} y={sol + 20} textAnchor="middle"
                fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="ui-monospace, monospace">
            {m}
          </text>
        </g>
      ))}
      {/* le cercle et le butoir : le lanceur est dessus, la mesure part de la */}
      <rect x={px(-CERCLE)} y={sol - 2} width={px(0) - px(-CERCLE)} height="2"
            fill="rgba(255,255,255,0.16)" />
      <rect x={px(0) - 2} y={sol - 9} width="3" height="9" fill={accent} opacity="0.85" />
      {/* la trajectoire */}
      {chemin && (
        <polyline points={chemin} fill="none" stroke={accent} strokeWidth="1.8"
                  strokeOpacity="0.55" strokeLinecap="round" />
      )}
      {balle && <circle cx={balle.x} cy={balle.y} r="5.5" fill={accent} />}
      {/* La marque au sol. Le chiffre se pose AU-DESSUS du trait et non a cote
          de l'engin : a la fin du vol les deux occupent le meme point, et le
          nombre se posait sur la boule. */}
      {marqueM != null && (
        <g>
          <line x1={px(marqueM)} y1={sol - 12} x2={px(marqueM)} y2={sol + 3}
                stroke={accent} strokeWidth="2" />
          <text x={px(marqueM)} y={sol - 20} textAnchor="middle"
                fill={accent} fontSize="15" fontWeight="700"
                fontFamily="ui-monospace, monospace">
            {marqueM.toFixed(2)}
          </text>
        </g>
      )}
    </svg>
  );
}

/* --------------------------------------------------------------- l'ecran */

export function Poids({ etape = 3, onQuitter }: { etape?: number; onQuitter: () => void }) {
  const { N } = SprinterApp;
  const accent = MONDES.thrower.accent;

  const [phase, setPhase] = useState<Phase>('poussee');
  const [jauge, setJauge] = useState(0);
  const [poussee, setPoussee] = useState(0);
  const [essais, setEssais] = useState<ReturnType<typeof lancer>[]>([]);
  const [vol, setVol] = useState<{ v: number; angle: number; t: number } | null>(null);
  const [dernier, setDernier] = useState<ReturnType<typeof lancer> | null>(null);

  const depart = useRef(0);
  const brut = useRef(0);

  const numero = essais.length + 1;
  const best = meilleur(essais);
  // Ce que le terrain montre : la portee maximale de l'etape, arrondie au
  // multiple de cinq au-dessus, pour que les reperes tombent juste.
  const metresVus = Math.ceil(portee(vitesseA(
    [10, 11.55, 12.95, 14.86, 16.4, 18.2][Math.min(5, Math.max(0, etape))], 38), 38) / 5) * 5 + 2;

  /* --- le balayage des deux jauges --- */
  useEffect(() => {
    if (phase !== 'poussee' && phase !== 'angle') return;
    depart.current = performance.now();
    let id = 0;
    const boucle = (t: number) => {
      const s = (t - depart.current) / 1000;
      brut.current = vaEtVient(s, CADENCE[phase]);
      setJauge(brut.current);
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  /* --- la pression : elle fige ce qui balaye --- */
  const presser = useCallback(() => {
    if (phase === 'poussee') {
      setPoussee(brut.current);
      buzz(12);
      setPhase('angle');
      return;
    }
    if (phase === 'angle') {
      const angle = ANGLE_MIN + brut.current * (ANGLE_MAX - ANGLE_MIN);
      const r = lancer({ etape, poussee, angle });
      setDernier(r);
      buzz(r.mordu ? 60 : 20);
      if (r.mordu) {
        setEssais(e => [...e, r]);
        setPhase('marque');
        return;
      }
      // La duree du vol, pour que l'animation dure ce que dure le lancer.
      const a = angle * Math.PI / 180;
      const vy = r.vitesse * Math.sin(a);
      const t = (vy + Math.sqrt(vy * vy + 2 * 9.81 * 2.10)) / 9.81;
      setVol({ v: r.vitesse, angle, t });
      setEssais(e => [...e, r]);
      setPhase('vol');
      return;
    }
    if (phase === 'marque') {
      setVol(null);
      setDernier(null);
      setPhase(essais.length >= ESSAIS ? 'fini' : 'poussee');
    }
  }, [phase, poussee, etape, essais.length]);

  /* --- le vol dure ce qu'il dure, puis la marque s'inscrit --- */
  useEffect(() => {
    if (phase !== 'vol' || !vol) return;
    const id = setTimeout(() => setPhase('marque'), Math.max(450, vol.t * 420));
    return () => clearTimeout(id);
  }, [phase, vol]);

  /* --- clavier : la barre d'espace fait ce que fait le doigt --- */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); presser(); }
      if (e.code === 'Escape') onQuitter();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [presser, onQuitter]);

  const recommencer = () => {
    setEssais([]); setDernier(null); setVol(null); setPoussee(0); setPhase('poussee');
  };

  const record = RECORDS.hommes;
  const marqueVue = dernier && !dernier.mordu ? marque(dernier.metres) : null;

  return (
    <div
      className="fixed inset-0 z-[46] flex flex-col select-none
                 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
      style={{ background: MONDES.thrower.fond }}
      onPointerDown={phase === 'fini' ? undefined : presser}
    >
      {/* l'en-tete */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h2 className="font-display font-black tracking-tight text-lg leading-none"
              style={{ color: accent }}>
            {N.t('disc_poids')}
          </h2>
          <span className="text-[9px] tracking-widest text-white/40 uppercase mt-1">
            {N.levelName(etape)} · {String(MASSE.hommes).replace('.', ',')} kg
          </span>
        </div>
        <button onPointerDown={e => { e.stopPropagation(); onQuitter(); }}
                className="px-3 py-1.5 rounded-full border border-white/15 bg-black/30
                           text-white/60 text-[10px] tracking-widest hover:text-white transition-colors">
          {N.t('monde_retour')}
        </button>
      </div>

      {/* les six essais, en pastilles */}
      <div className="w-full max-w-lg mx-auto flex items-center gap-1.5 mt-3 shrink-0">
        {Array.from({ length: ESSAIS }, (_, i) => {
          const e = essais[i];
          const encours = i === essais.length && phase !== 'fini';
          return (
            <div key={i}
              className={`flex-1 h-8 rounded-lg border flex items-center justify-center
                          font-mono text-[10px] tabular-nums
                ${encours ? 'border-white/40' : 'border-white/10'}`}
              style={{
                background: e && !e.mordu ? accent + '1a' : 'rgba(255,255,255,0.02)',
                color: !e ? 'rgba(255,255,255,0.25)'
                     : e.mordu ? 'rgba(248,113,113,0.85)' : accent,
              }}>
              {!e ? i + 1 : e.mordu ? 'X' : marque(e.metres)!.toFixed(2)}
            </div>
          );
        })}
      </div>

      {/* le terrain */}
      {/* Le terrain prend toute la hauteur qui reste. `min-h-0` est ce qui le
          permet : sans lui, un enfant en `flex-1` refuse de retrecir sous sa
          taille intrinseque, et le SVG poussait les jauges hors de l'ecran. */}
      <div className="w-full max-w-lg mx-auto mt-2 flex-1 min-h-0 flex items-stretch">
        <Terrain metresVus={metresVus} vol={phase === 'vol' || phase === 'marque' ? vol : null}
                 marqueM={phase === 'marque' && marqueVue ? marqueVue : null} accent={accent} />
      </div>

      {/* les jauges et les messages */}
      <div className="w-full max-w-lg mx-auto shrink-0 flex flex-col gap-3 pb-2">
        {phase === 'poussee' && (
          <Jauge titre={N.t('poids_poussee')} valeur={jauge} accent={accent} seuil={SEUIL_MORSURE} />
        )}

        {phase === 'angle' && (
          <>
            <Jauge titre={N.t('poids_poussee')} valeur={poussee} accent={accent}
                   seuil={SEUIL_MORSURE} fige />
            <Jauge titre={N.t('poids_angle')} valeur={jauge} accent={accent}
                   legende={`${Math.round(ANGLE_MIN + jauge * (ANGLE_MAX - ANGLE_MIN))}°`} />
          </>
        )}

        <AnimatePresence mode="wait">
          {phase === 'marque' && dernier && (
            <motion.p key="m" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center font-display font-black tracking-tight text-2xl"
                      style={{ color: dernier.mordu ? '#f87171' : accent }}>
              {dernier.mordu
                ? N.t('poids_mordu')
                : `${marqueVue!.toFixed(2)} m`}
            </motion.p>
          )}
          {phase === 'fini' && (
            <motion.div key="f" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-2">
              <p className="text-center font-display font-black tracking-tight text-3xl"
                 style={{ color: accent }}>
                {best > 0 ? `${marque(best)!.toFixed(2)} m` : N.t('poids_aucune')}
              </p>
              <p className="text-[9px] text-white/35 tracking-wide text-center">
                {N.t('poids_record', {
                  m: String(record.m).replace('.', ','), n: record.qui, a: String(record.an),
                })}
              </p>
              <button onPointerDown={e => { e.stopPropagation(); recommencer(); }}
                      className="mt-1 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                                 text-sm text-black"
                      style={{ backgroundColor: accent }}>
                {N.t('poids_relancer')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {phase !== 'fini' && (
          <p className="text-center text-[10px] tracking-widest text-white/35">
            {phase === 'marque' ? N.t('poids_suite')
              : phase === 'vol' ? ' '
              : N.t('poids_figer', { n: String(numero), t: String(ESSAIS) })}
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- la jauge */

function Jauge({ titre, valeur, accent, seuil, legende, fige = false }: {
  titre: string; valeur: number; accent: string;
  seuil?: number; legende?: string; fige?: boolean;
}) {
  const dansLeRouge = seuil != null && valeur > seuil;
  return (
    <div className={fige ? 'opacity-45' : ''}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[9px] tracking-widest uppercase text-white/45">{titre}</span>
        {legende && (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: accent }}>
            {legende}
          </span>
        )}
      </div>
      <div className="relative h-4 rounded-full bg-white/8 overflow-hidden">
        {/* La zone rouge, VISIBLE. C'est tout le jeu de la poussee : la
            meilleure marque legale est juste dessous, et la jauge va vite. */}
        {seuil != null && (
          <div className="absolute inset-y-0 right-0 bg-red-500/25"
               style={{ left: `${seuil * 100}%` }} />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full transition-none"
             style={{
               width: `${Math.min(1, valeur) * 100}%`,
               backgroundColor: dansLeRouge ? '#ef4444' : accent,
             }} />
        {seuil != null && (
          <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${seuil * 100}%` }} />
        )}
      </div>
    </div>
  );
}
