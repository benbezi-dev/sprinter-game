import React, { useCallback, useEffect, useRef } from 'react';
import { useInputHandlers } from '@/hooks/use-inputs';
import { useGameStore, SprinterApp, setStepCue, HAS_VIBRATION } from '@/game/engine';
import { APPEL_JOUEUR } from '@/game/canal';
import { approcheHaies, ciseauHaies } from '@/game/haies-course.js';

// Double chevron : plus lisible et plus soigne qu'un caractere "<" ou ">",
// et surtout parfaitement centrable puisqu'on maitrise le viewBox. La
// couleur suit currentColor, donc l'icone s'allume avec le pad.
function Chevrons({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="-24 -24 48 48" className="w-11 h-11 md:w-16 md:h-16 block" aria-hidden="true">
      <g
        transform={`scale(${dir} 1)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M-1 -11 L 10 0 L -1 11" />
        <path d="M-13 -11 L -2 0 L -13 11" opacity="0.45" />
      </g>
    </svg>
  );
}

const LIT_BG = 'rgb(var(--primaire-rgb) / 0.20)';
const LIT_BORDER = 'rgb(var(--primaire-rgb) / 0.90)';
const LIT_FG = 'rgb(var(--primaire-rgb))';
const IDLE_FG = 'rgba(255,255,255,0.34)';
// L'ombre portee du pave allume. Elle deborde du bord, donc elle se voit du
// coin de l'oeil — ce que ne fait pas un changement de couleur a l'interieur
// d'un cadre, surtout sur une piste claire ou le jaune du pad se noie.
const LIT_GLOW = '0 0 0 1px rgb(var(--primaire-rgb) / 0.55), 0 0 22px rgb(var(--primaire-rgb) / 0.32)';
// Au repos, le pave n'est pas un rectangle sombre pose sur l'image : il a un
// dessus et un dessous. Le degre est minuscule — huit pour cent de blanc en
// haut, seize de noir en bas — mais c'est ce qui fait la difference entre une
// surface et une decoupe.
const REPOS_GLOW = 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 10px rgba(0,0,0,0.25)';
// Duree minimale d'allumage. A pleine cadence (~10 appuis/s, soit un appui
// tous les 200 ms sur un meme pad) la lumiere reste donc bien visible : elle
// clignote au rythme de la foulee au lieu de disparaitre.
const LIT_MS = 110;

/* ---------------------------------------------------------------------------
   LA JAUGE DE LA HAIE, DANS LE PAVE (canal.ts, APPEL_JOUEUR)
   ---------------------------------------------------------------------------
   Il y avait deux touches d'attaque au-dessus des paves. Elles ont disparu, et
   c'est le geste entier qui a change de nature.

   ON NE SAUTE PAS UNE HAIE, ON LA COURT — c'est la phrase que tous les
   entraineurs repetent, et un bouton de saut separe enseignait exactement le
   contraire. Le geste vit donc sur le pave de course, comme une foulee plus
   longue : APPUYER lance la jambe d'attaque, MAINTENIR porte le vol, RELACHER
   ramene la jambe arriere. Un seul geste continu, comme un hurdleur qui ne fait
   pas deux choses mais une.

   Le pouce ne quitte plus son pave. Et le maintien occupe le vol, ou l'on ne
   doit de toute facon plus marteler : le geste ne prend rien a la course, il
   occupe le temps que la haie lui prenait deja.

   LA JAUGE A DEUX TEMPS, ET UNE SEULE REGLE : on agit quand elle est pleine.
   Elle se remplit pendant l'approche, pleine au point d'appel — on appuie. Elle
   repart de zero pendant le vol, pleine au point du ciseau — on relache.
--------------------------------------------------------------------------- */

/**
 * CE QUE VAUT LE GESTE A CET INSTANT, en couleur.
 *
 * Les deux temps partagent la meme echelle, et ce n'est pas une economie : le
 * joueur n'a qu'une chose a apprendre. Terne, c'est trop tot. Bleu, ca passe.
 * Vert plein, c'est le moment. Rouge, c'est deja trop tard.
 *
 * Les noms viennent de jugerAppel() et jugerCiseau() — les fonctions memes qui
 * noteront le geste une image plus tard. Un ecran qui recalculerait sa propre
 * couleur finirait par mentir, et le joueur apprendrait a viser le mensonge.
 */
const ZONE_JAUGE: Record<string, { fond: string; halo: string }> = {
  // trop tot — dans l'approche comme dans le vol
  plane:    { fond: 'rgba(255,255,255,0.16)', halo: 'none' },
  accroche: { fond: 'rgba(255,255,255,0.16)', halo: 'none' },
  // ca passe
  bon:      { fond: 'rgb(var(--primaire-rgb) / 0.55)', halo: 'none' },
  // le moment
  parfait:  { fond: 'rgba(52,211,153,0.85)', halo: '0 0 18px 2px rgba(52,211,153,0.75)' },
  ciseau:   { fond: 'rgba(52,211,153,0.85)', halo: '0 0 18px 2px rgba(52,211,153,0.75)' },
  // trop tard
  hache:    { fond: 'rgba(239,68,68,0.70)', halo: 'none' },
  traine:   { fond: 'rgba(239,68,68,0.70)', halo: 'none' },
};

export function TouchControls() {
  const { handleLeftTouch, handleRightTouch, handleTouchEnd } = useInputHandlers();
  const state = useGameStore(s => s.state);
  const countT = useGameStore(s => s.countT);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const edgeL = useRef<HTMLDivElement | null>(null);
  const edgeR = useRef<HTMLDivElement | null>(null);
  const timers = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const edgeTimers = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const jaugeL = useRef<HTMLDivElement | null>(null);
  const jaugeR = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    clearTimeout(timers.current.left);
    clearTimeout(timers.current.right);
    clearTimeout(edgeTimers.current.left);
    clearTimeout(edgeTimers.current.right);
  }, []);

  // Remplacant du vibreur, pour les appareils qui n'en ont pas — c'est-a-dire
  // tous les iPhone. Une lueur breve sur le bord de l'ecran du cote joue :
  // la vision peripherique capte tres bien un eclat sans quitter le coureur
  // des yeux, la ou l'allumage du pad oblige a baisser le regard.
  useEffect(() => {
    if (HAS_VIBRATION) return;
    setStepCue((side, kind) => {
      const el = side === 'left' ? edgeL.current : edgeR.current;
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = kind === 'trip' ? '1' : '0.42';
      el.style.background = kind === 'trip'
        ? `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, rgba(239,68,68,0.85), transparent)`
        : `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, rgb(var(--primaire-rgb) / 0.75), transparent)`;
      clearTimeout(edgeTimers.current[side]);
      edgeTimers.current[side] = window.setTimeout(() => {
        el.style.transition = `opacity ${kind === 'trip' ? 260 : 130}ms ease-out`;
        el.style.opacity = '0';
      }, kind === 'trip' ? 90 : 45);
    });
    return () => setStepCue(null);
  }, []);

  // LA JAUGE, IMAGE PAR IMAGE ET NON PAR LE STORE.
  //
  // L'approche et le vol vivent dans la boucle de simulation, qui tourne a 240
  // pas par seconde. Les faire passer par React ferait re-rendre tout l'ecran
  // plusieurs fois par haie, en pleine course. On lit donc l'etat des haies a
  // chaque image et on peint le noeud — exactement ce que `light()` fait plus
  // bas pour les paves, et pour la meme raison.
  //
  // CE QUE LA JAUGE CORRIGE. La premiere version allumait le bon cote a
  // l'approche, et c'est tout : elle disait QUEL POUCE, jamais QUAND. A
  // l'essai, le joueur la voyait s'allumer puis jugeait l'instant sur une haie
  // qui arrive en vue isometrique — donc il REAGISSAIT, et le temps de reaction
  // le mettait en retard de 150 ms a chaque haie, toujours du meme cote. 17,22 s
  // sur le 110 m la ou le meme joueur a l'heure fait 13,12. Un retard
  // systematique ne se rattrape par aucune tolerance elargie : il faut un signal
  // qui se voie VENIR.
  //
  // DEUX TEMPS, UNE SEULE REGLE : on agit quand c'est plein. Pendant
  // l'approche, la jauge monte vers le point d'appel — on appuie. Pendant le
  // vol, elle repart de zero et monte vers le point du ciseau — on relache.
  const enCourse = state === 'race' || state === 'count';
  useEffect(() => {
    if (!APPEL_JOUEUR || !enCourse) return;
    let raf = 0;
    let vuH = -1, vuZone = '', vuCote: string | null = null;
    const tick = () => {
      const app = approcheHaies() as
        { cote: 'left' | 'right'; avance: number; zone: string } | null;
      const vol = ciseauHaies() as
        { cote: 'left' | 'right' | null; part: number; vise: number; fait: boolean; zone: string } | null;

      let cote: string | null = null, h = 0, zone = '';
      if (app) {
        cote = app.cote;
        h = Math.round(Math.min(1, app.avance) * 100);
        zone = app.zone;
      } else if (vol && !vol.fait && vol.cote) {
        // Le vol : pleine au point du ciseau, pas a la reception. La meme regle
        // que l'approche, donc le meme geste a apprendre.
        cote = vol.cote;
        h = Math.round(Math.min(1, vol.part / Math.max(0.01, vol.vise)) * 100);
        zone = vol.zone;
      }

      if (h !== vuH || zone !== vuZone || cote !== vuCote) {
        vuH = h; vuZone = zone; vuCote = cote;
        const t = ZONE_JAUGE[zone] || ZONE_JAUGE.plane;
        const paires = [[jaugeL.current, 'left'], [jaugeR.current, 'right']] as const;
        for (const [el, cle] of paires) {
          if (!el) continue;
          const sien = cote === cle;
          el.style.height = sien ? `${h}%` : '0%';
          el.style.background = t.fond;
          el.style.boxShadow = sien && t.halo !== 'none' ? t.halo : 'none';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enCourse]);

  // L'allumage est pilote directement sur le noeud, pas par une classe CSS
  // :active ni par un etat React :
  //   - preventDefault() sur pointerdown empeche le navigateur de poser
  //     l'etat :active, donc l'ancien surlignage CSS ne partait pas ;
  //   - une transition de couleur n'a pas le temps d'aboutir sur un appui
  //     de 100 ms, donc a pleine vitesse on ne voyait plus rien.
  // Ici l'allumage est immediat (transition coupee), et il est garanti
  // visible au moins LIT_MS meme si le doigt se leve tout de suite.
  const light = useCallback((side: 'left' | 'right') => {
    const el = side === 'left' ? leftRef.current : rightRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.backgroundColor = LIT_BG;
    el.style.borderColor = LIT_BORDER;
    el.style.color = LIT_FG;
    el.style.boxShadow = LIT_GLOW;
    clearTimeout(timers.current[side]);
    timers.current[side] = window.setTimeout(() => {
      el.style.transition = 'background-color 130ms ease-out, border-color 130ms ease-out, ' +
        'color 130ms ease-out, box-shadow 160ms ease-out';
      el.style.backgroundColor = '';
      el.style.borderColor = '';
      el.style.color = IDLE_FG;
      el.style.boxShadow = REPOS_GLOW;
    }, LIT_MS);
  }, []);

  if (state !== 'race' && state !== 'count') return null;
  // Le decompte suspendu, c'est la presentation des athletes : on regarde, on
  // ne court pas encore. Les pavés et leur consigne n'y ont rien a faire — ils
  // recouvraient la moitie basse de la piste au moment ou l'on presente
  // quelqu'un.
  if (state === 'count' && countT <= -90) return null;

  // Zone sensible et zone visible sont deux choses distinctes.
  //
  // Avant, c'etait la carte arrondie elle-meme qui recevait l'appui : les
  // marges, l'ecart central et la marge de securite du bas ne declenchaient
  // rien. Mesure sur un ecran de 375 pt : 8 px a gauche, 8 px entre les deux
  // pads, 7 px a droite, 8 px en bas — 6 % de la largeur, pile la ou les
  // pouces se posent, et l'ecart central tombe entre les deux mains.
  //
  // Or un appui perdu ne se contente pas de manquer : le coup suivant, du
  // cote oppose, devient une repetition aux yeux du jeu. Et une repetition,
  // c'est une chute dans un cas sur deux, jusqu'a neuf sur dix a pleine
  // vitesse. Une marge de 8 px se payait donc en chutes.
  //
  // Les deux moities sensibles couvrent maintenant toute la bande, bord a
  // bord, sans interstice. Les cartes arrondies ne sont plus que du decor.
  const hitClass =
    'flex-1 h-full flex items-center justify-center select-none touch-none pointer-events-auto';
  // La teinte de fond ET le degrade, pas l'un a la place de l'autre :
  // `bg-card/40` pose une couleur, `bg-gradient-to-b` pose une image par
  // dessus. Le degrade seul, essaye d'abord, laissait passer la pelouse : sur
  // le stade olympique les deux paves devenaient deux rectangles vert clair
  // ou le chevron ne se lisait plus.
  const cardClass =
    'w-full h-full rounded-2xl border-2 border-white/10 backdrop-blur-sm bg-card/45 ' +
    'bg-gradient-to-b from-white/12 via-transparent to-black/30 relative overflow-hidden ' +
    'flex items-center justify-center pointer-events-none';
  // La jauge de la haie, posee DANS le pave : elle monte du bas, le chevron
  // reste lisible par-dessus. Hors haies elle est a zero et ne se voit pas.
  const jauge = (cote: 'left' | 'right') => (
    <div
      ref={cote === 'left' ? jaugeL : jaugeR}
      className="absolute inset-x-0 bottom-0 pointer-events-none"
      style={{ height: '0%', background: ZONE_JAUGE.plane.fond }}
    />
  );

  return (
    <>
    {!HAS_VIBRATION && (
      <>
        <div ref={edgeL} className="fixed left-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
        <div ref={edgeR} className="fixed right-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
      </>
    )}
    <div className="absolute bottom-0 w-full portrait:h-[20vh] landscape:h-[17vh] min-h-[70px] max-h-[250px] flex z-50 pointer-events-none">
      <div
        className={hitClass}
        onPointerDown={(e) => { e.preventDefault(); light('left'); handleLeftTouch(); }}
        onPointerUp={() => handleTouchEnd('left')}
        onPointerCancel={() => handleTouchEnd('left')}
      >
        <div
          ref={leftRef}
          className={cardClass}
          style={{
            color: IDLE_FG,
            boxShadow: REPOS_GLOW,
            marginLeft: 'max(env(safe-area-inset-left),0.5rem)',
            marginRight: '0.25rem',
            marginBottom: 'max(env(safe-area-inset-bottom),0.5rem)',
          }}
        >
          {APPEL_JOUEUR && jauge('left')}
          <span className="relative"><Chevrons dir={-1} /></span>
        </div>
      </div>

      <div
        className={hitClass}
        onPointerDown={(e) => { e.preventDefault(); light('right'); handleRightTouch(); }}
        onPointerUp={() => handleTouchEnd('right')}
        onPointerCancel={() => handleTouchEnd('right')}
      >
        <div
          ref={rightRef}
          className={cardClass}
          style={{
            color: IDLE_FG,
            boxShadow: REPOS_GLOW,
            marginLeft: '0.25rem',
            marginRight: 'max(env(safe-area-inset-right),0.5rem)',
            marginBottom: 'max(env(safe-area-inset-bottom),0.5rem)',
          }}
        >
          {APPEL_JOUEUR && jauge('right')}
          <span className="relative"><Chevrons dir={1} /></span>
        </div>
      </div>

      {/* La bande d'attaque a disparu : la consigne retrouve sa place. */}
      <div className="absolute top-[-20px] md:top-[-30px] w-full text-center pointer-events-none left-0">
        <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase bg-black/40 px-3 py-0.5 md:px-4 md:py-1 rounded-full">
          {SprinterApp.N.t('alternate')}
        </span>
      </div>
    </div>
    </>
  );
}
