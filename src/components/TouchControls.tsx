import React, { useCallback, useEffect, useRef } from 'react';
import { useInputHandlers } from '@/hooks/use-inputs';
import { useGameStore, SprinterApp, setStepCue, HAS_VIBRATION } from '@/game/engine';
import { APPEL_JOUEUR } from '@/game/canal';
import { approcheHaies, appelHaies, haiesPosees } from '@/game/haies-course.js';

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

/**
 * La haie et l'arc par-dessus. Pas un mot : ces deux touches doivent se lire
 * d'un coup d'oeil en pleine course, et le jeu parle quatorze langues sur la
 * branche d'a cote. Le dessin est asymetrique — la jambe d'attaque part du
 * cote de la touche — pour que gauche et droite ne se confondent pas au coin
 * de l'oeil, la ou un pictogramme symetrique aurait ete illisible.
 */
function Franchir({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="-26 -20 52 40" className="w-10 h-8 md:w-14 md:h-11 block" aria-hidden="true">
      <g transform={`scale(${dir} 1)`} fill="none" stroke="currentColor"
         strokeLinecap="round" strokeLinejoin="round">
        {/* l'arc du franchissement : on monte de loin, on retombe court */}
        <path d="M-22 12 C -14 -16, 8 -18, 16 6" strokeWidth="4" />
        {/* la haie */}
        <path d="M6 -2 L 22 -2" strokeWidth="4" opacity="0.95" />
        <path d="M14 -2 L 14 13" strokeWidth="3" opacity="0.5" />
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
   LES TOUCHES D'ATTAQUE (canal.ts, APPEL_JOUEUR)
   ---------------------------------------------------------------------------
   Une bande au-dessus des paves, coupee en deux comme eux, bord a bord et sans
   interstice — pour la meme raison qu'eux : ici, un appui perdu ne se contente
   pas de manquer, il fait percuter la haie.

   ELLES S'ALLUMENT A L'APPROCHE, ET DU BON COTE. Le reste du temps elles sont
   la, eteintes : une bande qui apparaitrait d'un coup deplacerait le pouce au
   pire moment. La reserve tient toujours — ce prototype existe pour savoir si
   un pouce peut quitter un pave qu'il martele et y revenir.
--------------------------------------------------------------------------- */

/** Le cote annonce : allume, franc, il appelle le pouce. */
const ATT_LIT = {
  bg: 'rgb(var(--primaire-rgb) / 0.26)',
  border: 'rgb(var(--primaire-rgb) / 0.95)',
  fg: 'rgb(var(--primaire-rgb))',
  glow: '0 0 0 1px rgb(var(--primaire-rgb) / 0.6), 0 0 26px rgb(var(--primaire-rgb) / 0.38)',
};
/** L'autre cote pendant l'approche : arme, mais ce n'est pas celui-la. */
const ATT_ARME = {
  bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.20)',
  fg: 'rgba(255,255,255,0.30)', glow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
};
/** Hors approche : la bande existe, elle ne demande rien. */
const ATT_REPOS = {
  bg: 'rgba(0,0,0,0.22)', border: 'rgba(255,255,255,0.08)',
  fg: 'rgba(255,255,255,0.16)', glow: 'none',
};

/**
 * CE QUE LA JAUGE VAUT, SELON CE QUE VAUDRAIT L'APPEL A CET INSTANT.
 *
 * Trois etats, et un seul qu'on apprend a viser : le vert plein. Le joueur n'a
 * pas a lire une graduation en pleine course — il attend que ca devienne vert
 * et il appuie. Avant, c'est terne ; apres, c'est rouge, et il a compris sans
 * qu'on lui explique qu'il etait en retard.
 *
 * Les couleurs sont celles que le bandeau de verdict emploie deja pour les
 * memes mots (HaiesHUD) : la jauge et le jugement doivent se reconnaitre.
 */
const ZONE_JAUGE: Record<string, { fond: string; halo: string }> = {
  plane:   { fond: 'rgba(255,255,255,0.16)', halo: 'none' },
  bon:     { fond: 'rgb(var(--primaire-rgb) / 0.55)', halo: 'none' },
  parfait: { fond: 'rgba(52,211,153,0.85)',
             halo: '0 0 18px 2px rgba(52,211,153,0.75)' },
  hache:   { fond: 'rgba(239,68,68,0.70)', halo: 'none' },
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
  const attL = useRef<HTMLDivElement | null>(null);
  const attR = useRef<HTMLDivElement | null>(null);
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

  // LA JAUGE D'APPEL, IMAGE PAR IMAGE ET NON PAR LE STORE.
  //
  // L'approche vit dans la boucle de simulation, qui tourne a 240 pas par
  // seconde. La faire passer par React ferait re-rendre tout l'ecran plusieurs
  // fois par haie, en pleine course. On lit donc l'etat des haies a chaque
  // image et on peint les noeuds — exactement ce que `light()` fait plus bas
  // pour les paves, et pour la meme raison.
  //
  // CE QUE LA JAUGE CORRIGE, et pourquoi une simple lumiere ne suffisait pas.
  // La premiere version allumait le bon cote a l'approche, et c'est tout : elle
  // disait QUEL POUCE, jamais QUAND. A l'essai, le joueur la voyait s'allumer
  // puis jugeait l'instant sur une haie qui arrive en vue isometrique — donc il
  // REAGISSAIT, et le temps de reaction plus le voyage du pouce le mettaient en
  // retard de 150 ms a chaque haie, toujours du meme cote. 17,22 s sur le 110 m
  // haies la ou le meme joueur a l'heure fait 13,12. Un retard systematique ne
  // se rattrape par aucune tolerance elargie : il faut un signal qui se voie
  // VENIR.
  //
  // La jauge se remplit donc pendant toute l'approche et elle est PLEINE au
  // point d'appel du reglement. Le joueur anticipe au lieu de reagir, ce qui
  // est la seule facon de viser a 65 ms pres.
  //
  // LA COULEUR EST LE JUGEMENT, PAS UNE DECORATION. `zone` vient de
  // jugerAppel() — la fonction meme qui notera l'appel une image plus tard. Un
  // ecran qui recalculerait la sienne finirait par mentir, et le joueur
  // apprendrait a viser le mensonge.
  //
  // Rien a eteindre a l'appel : quitter le sol referme l'approche et tout
  // revient au repos de soi-meme.
  const enCourse = state === 'race' || state === 'count';
  useEffect(() => {
    if (!APPEL_JOUEUR || !enCourse) return;
    let raf = 0;
    let vuCote: string | null | undefined;
    let vuH = -1, vuZone = '';
    const tick = () => {
      const a = approcheHaies() as
        { cote: 'left' | 'right'; avance: number; zone: string } | null;
      const cote = a ? a.cote : null;

      if (cote !== vuCote) {
        vuCote = cote;
        const paires = [[attL.current, 'left'], [attR.current, 'right']] as const;
        for (const [el, cle] of paires) {
          if (!el) continue;
          const t = cote === null ? ATT_REPOS : cote === cle ? ATT_LIT : ATT_ARME;
          el.style.backgroundColor = t.bg;
          el.style.borderColor = t.border;
          el.style.color = t.fg;
          el.style.boxShadow = t.glow;
        }
      }

      // La jauge, sur les deux noeuds : celle du mauvais cote reste a zero.
      const h = a ? Math.round(Math.min(1, a.avance) * 100) : 0;
      const zone = a ? a.zone : '';
      if (h !== vuH || zone !== vuZone) {
        vuH = h; vuZone = zone;
        const remplissage = ZONE_JAUGE[zone] || ZONE_JAUGE.plane;
        for (const [el, cle] of [[jaugeL.current, 'left'], [jaugeR.current, 'right']] as const) {
          if (!el) continue;
          const sien = a && cote === cle;
          el.style.height = sien ? `${h}%` : '0%';
          el.style.background = remplissage.fond;
          el.style.boxShadow = sien && zone === 'parfait' ? remplissage.halo : 'none';
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
    'bg-gradient-to-b from-white/12 via-transparent to-black/30 ' +
    'flex items-center justify-center pointer-events-none';

  return (
    <>
    {!HAS_VIBRATION && (
      <>
        <div ref={edgeL} className="fixed left-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
        <div ref={edgeR} className="fixed right-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
      </>
    )}
    {APPEL_JOUEUR && haiesPosees() && (
      // LA BANDE D'ATTAQUE. Elle se cale sur la hauteur des paves, en vh comme
      // eux. Leur min-h/max-h peut l'en decoller de quelques pixels sur un
      // ecran tres court ou tres long ; a la taille d'un telephone (20 vh
      // valent 170 px sur 812 pt) les deux bandes se touchent, et c'est le seul
      // format que ce prototype a a servir.
      <div className="absolute w-full portrait:bottom-[20vh] landscape:bottom-[17vh]
                      portrait:h-[9vh] landscape:h-[8vh] min-h-[46px] max-h-[110px]
                      flex z-50 pointer-events-none">
        {(['left', 'right'] as const).map(cote => (
          <div
            key={cote}
            className={hitClass}
            onPointerDown={(e) => { e.preventDefault(); appelHaies(cote); }}
          >
            <div
              ref={cote === 'left' ? attL : attR}
              className="w-full h-full rounded-xl border-2 backdrop-blur-sm relative
                         overflow-hidden flex items-center justify-center pointer-events-none"
              style={{
                backgroundColor: ATT_REPOS.bg,
                borderColor: ATT_REPOS.border,
                color: ATT_REPOS.fg,
                boxShadow: ATT_REPOS.glow,
                marginLeft: cote === 'left' ? 'max(env(safe-area-inset-left),0.5rem)' : '0.25rem',
                marginRight: cote === 'right' ? 'max(env(safe-area-inset-right),0.5rem)' : '0.25rem',
                transition: 'background-color 90ms ease-out, border-color 90ms ease-out, ' +
                            'color 90ms ease-out, box-shadow 120ms ease-out',
              }}
            >
              {/* La jauge monte du bas : pleine au point d'appel du reglement. */}
              <div
                ref={cote === 'left' ? jaugeL : jaugeR}
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{ height: '0%', background: ZONE_JAUGE.plane.fond }}
              />
              <span className="relative">
                <Franchir dir={cote === 'left' ? -1 : 1} />
              </span>
            </div>
          </div>
        ))}
      </div>
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
          <Chevrons dir={-1} />
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
          <Chevrons dir={1} />
        </div>
      </div>

      {/* La consigne « alterne les deux touches » vit juste au-dessus des paves,
          c'est-a-dire exactement la ou la bande d'attaque se pose. Elle lui cede
          la place : sur une course de haies, l'alternance n'est plus la seule
          chose a savoir, et deux consignes superposees n'en font aucune. */}
      {!(APPEL_JOUEUR && haiesPosees()) && (
        <div className="absolute top-[-20px] md:top-[-30px] w-full text-center pointer-events-none left-0">
          <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase bg-black/40 px-3 py-0.5 md:px-4 md:py-1 rounded-full">
            {SprinterApp.N.t('alternate')}
          </span>
        </div>
      )}
    </div>
    </>
  );
}
