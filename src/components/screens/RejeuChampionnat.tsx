import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MONTEE, FONDU } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { suivreRejeu, lireRejeu, fermerRejeu, lancerLeDepartDuRejeu } from '@/game/champ-rejeu';

/**
 * LA RETRANSMISSION D'UNE COURSE DE CHAMPIONNAT.
 *
 * La piste a ete debarrassee des pastilles de nom (voir `champ-rejeu`) : rien
 * ne flotte plus au-dessus des tetes pendant les dix secondes qui comptent. La
 * question « qui court » ne disparait pas pour autant — elle se pose avant et
 * apres, et c'est la qu'on y repond.
 *
 * ON LA POSE COMME UNE FINALE, ET PAS COMME UN MENU.
 *
 * Une liste a huit lignes affichee dans un coin dit qui est sur la piste, et
 * c'est tout ce qu'elle dit. Un championnat se regarde autrement : la camera
 * descend sur chaque athlete, seul, dans son couloir ; son nom occupe l'ecran ;
 * il leve les bras ; on passe au suivant. Le moteur sait deja faire cela —
 * c'est `presenterCoureur`, ecrit pour la salle du direct, ou la camera glisse
 * en travelling et les autres coureurs reprennent leur place. On s'en sert.
 *
 * Le decoupage est celui d'une retransmission, et ce n'est pas une coquetterie :
 * c'est le seul qui laisse voir la course.
 *
 *   generique         le titre de la reunion, puis celui de la course
 *   presentation      les huit, un par un, camera sur eux
 *   course            rien. La piste, et huit coureurs.
 *   arrivee           le tableau, revele du dernier au premier
 */

const OR = '#F8CD4A';

/** Le generique, avant le premier athlete. */
const GENERIQUE_MS = 2400;
/** Chaque athlete. Trois secondes seraient un meeting ; ici on enchaine. */
const PAR_ATHLETE_MS = 1750;

/** Le tableau se remplit du dernier vers le premier : le vainqueur en dernier. */
const CASCADE_MS = 130;

function chrono(ms: number | null): string {
  return ms == null ? '—' : (ms / 1000).toFixed(3) + ' s';
}

/** Le coureur du moteur qui occupe ce couloir. */
function coureurDuCouloir(couloir: number) {
  const G = SprinterApp.G;
  return (G.runners || []).find((r: any) => r.lane + 1 === couloir) || null;
}

/* --------------------------------------------------------- la presentation */

function Presentation({ titre, sousTitre, grille }: {
  titre: string; sousTitre: string; grille: { couloir: number; nom: string }[];
}) {
  // −1 : le generique. 0..n−1 : l'athlete. n : fini, le starter prend la main.
  const [index, setIndex] = useState(-1);
  const debut = useRef(0);
  const designe = useRef(-2);
  const rendu = useRef(false);

  useEffect(() => {
    debut.current = Date.now();
    designe.current = -2;
    rendu.current = false;

    // Une horloge, pas une file de `setTimeout` : un onglet qui passe en
    // arriere-plan etire les minuteurs et la sequence se desynchroniserait de
    // ce que la camera montre. En relisant l'heure, on retombe toujours juste.
    const battre = () => {
      const ecoule = Date.now() - debut.current;
      const i = ecoule < GENERIQUE_MS
        ? -1
        : Math.floor((ecoule - GENERIQUE_MS) / PAR_ATHLETE_MS);

      if (i >= grille.length) {
        if (!rendu.current) {
          rendu.current = true;
          SprinterApp.presenterCoureur(null);
          lancerLeDepartDuRejeu();
        }
        return;
      }
      setIndex(i);
      if (i !== designe.current) {
        designe.current = i;
        // On designe l'athlete au moteur : la camera vient sur lui, il leve
        // les bras, les autres redescendent.
        SprinterApp.presenterCoureur(i < 0 ? null : coureurDuCouloir(grille[i].couloir));
      }
    };

    battre();
    const t = setInterval(battre, 80);
    return () => { clearInterval(t); SprinterApp.presenterCoureur(null); };
  }, [grille]);

  const courant = index >= 0 && index < grille.length ? grille[index] : null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between
                    pt-[max(env(safe-area-inset-top),1rem)]
                    pb-[max(env(safe-area-inset-bottom),1.25rem)]">
      {/* Deux voiles plutot qu'un rideau : la piste reste visible, c'est elle
          qu'on est venu montrer. */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 to-transparent" />

      {/* Le bandeau de la reunion, tenu du debut a la fin : c'est lui qui dit
          qu'on n'est pas dans une course de campagne. */}
      <div className="relative flex flex-col items-center gap-1">
        <span className="text-[9px] tracking-[0.45em] text-white/45 font-bold uppercase">
          {sousTitre}
        </span>
        <span className="text-[11px] tracking-[0.35em] font-black uppercase" style={{ color: OR }}>
          {titre}
        </span>
        <span className="h-px w-16 mt-0.5" style={{ background: OR, opacity: 0.5 }} />
      </div>

      <AnimatePresence mode="wait">
        {!courant ? (
          /* LE GENERIQUE. Rien d'autre que le nombre de partants : c'est
             l'annonce qui fait lever la tete dans un stade. */
          <motion.div key="generique" {...FONDU}
            className="relative self-center flex flex-col items-center gap-2 px-6">
            <span className="font-display font-black text-5xl md:text-7xl tracking-tight text-white
                             drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] text-center leading-none">
              {titre}
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/60">
              {grille.length} {SprinterApp.N.t('champ_partants')}
            </span>
          </motion.div>
        ) : (
          <motion.div key={courant.couloir} {...MONTEE}
            className="relative self-center flex flex-col items-center gap-2 px-6 w-full">
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/55">
              {SprinterApp.N.t('pres_lane')} {courant.couloir}
            </span>
            <h2 className="font-display font-black tracking-tight text-white text-center
                           leading-none text-4xl md:text-6xl break-words max-w-full
                           drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
              {courant.nom}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ou l'on en est dans la sequence : huit traits qui se remplissent. */}
      <div className="relative flex justify-center gap-1.5">
        {grille.map((c, i) => (
          <span key={c.couloir}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === index ? 30 : 14,
              background: i === index ? OR : i < index ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.14)',
            }} />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------- le rappel des couloirs */

/**
 * QUI EST QUI, SANS RIEN POSER SUR LA PISTE.
 *
 * La piste est nue pendant la course : pas de cercle au sol, pas d'etiquette
 * au-dessus des tetes. Reste a repondre a « lequel est Untel », et la reponse
 * n'a pas besoin d'etre affichee pendant dix secondes — il suffit qu'elle le
 * soit au moment ou la question se pose, c'est-a-dire tout de suite apres le
 * coup de pistolet, quand le peloton est encore group et que l'oeil cherche
 * quelqu'un.
 *
 * Un bandeau bas, monochrome, du numero de couloir et du nom. Il s'efface au
 * bout de quatre secondes et ne revient pas : passe ce delai, la course s'est
 * etiree et c'est la place qui compte, plus l'identite.
 */
const RAPPEL_MS = 4000;

function RappelCouloirs({ grille }: { grille: { couloir: number; nom: string }[] }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), RAPPEL_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-x-0 bottom-0 z-20 pointer-events-none
                     flex justify-center
                     px-[max(env(safe-area-inset-left),0.75rem)]
                     pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="w-full max-w-[380px] grid grid-cols-4 gap-x-2 gap-y-0.5
                          rounded-lg bg-black/45 backdrop-blur-[2px] px-2.5 py-1.5">
            {grille.map(c => (
              <div key={c.couloir} className="flex items-baseline gap-1 min-w-0">
                <span className="font-mono text-[9px] text-white/40 shrink-0">{c.couloir}</span>
                <span className="text-[9px] font-semibold tracking-wide truncate text-white/75">
                  {c.nom}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------- l'arrivee */

function Arrivee({ titre, sousTitre, lignes }: {
  titre: string; sousTitre: string;
  lignes: { place: number; nom: string; ms: number | null }[];
}) {
  const { N } = SprinterApp;
  // LE TABLEAU SE LIT DE HAUT EN BAS, MAIS IL SE REMPLIT DE BAS EN HAUT.
  //
  // Deux choses differentes, et les confondre coute la moitie de l'effet. Un
  // classement ou le huitieme est en haut se lit a l'envers et personne n'y
  // trouve le vainqueur. Mais un tableau qui s'affiche en commencant par le
  // premier a tout dit a sa premiere ligne : les sept suivantes tombent dans
  // le vide. On garde donc l'ordre du classement, et on inverse l'ordre
  // D'APPARITION — le huitieme d'abord, le vainqueur en dernier.
  const dernier = lignes.length - 1;

  return (
    <motion.div {...MONTEE}
      className="absolute inset-0 z-30 flex items-center justify-center
                 bg-gradient-to-b from-black/85 via-black/75 to-black/90 backdrop-blur-[2px]
                 px-[max(env(safe-area-inset-left),1rem)] pointer-events-auto">
      <div className="w-full max-w-[420px] flex flex-col gap-3">
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.45em] text-white/45 uppercase">
            {sousTitre}
          </div>
          <div className="font-display font-black text-2xl tracking-widest" style={{ color: OR }}>
            {titre || N.t('champ_arrivee')}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {lignes.map((r, i) => (
            <motion.div key={r.nom + r.place}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: ((dernier - i) * CASCADE_MS) / 1000, duration: 0.22 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                ${r.place === 1 ? 'border-primary/60 bg-primary/15'
                  : r.place <= 3 ? 'border-white/15 bg-white/[0.06]'
                  : 'border-white/8 bg-black/30'}`}>
              <span className="font-display font-black text-base w-5 shrink-0 tabular-nums"
                    style={{ color: r.place === 1 ? OR : 'rgba(255,255,255,0.55)' }}>
                {r.place}
              </span>
              <span className={`flex-1 min-w-0 truncate tracking-wide
                ${r.place === 1 ? 'text-[14px] font-black' : 'text-[12px] font-bold'}`}>
                {r.nom}
              </span>
              <span className="font-mono text-[12px] tabular-nums shrink-0"
                    style={{ color: r.place === 1 ? OR : 'rgba(255,255,255,0.7)' }}>
                {chrono(r.ms)}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.button onClick={fermerRejeu}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: (lignes.length * CASCADE_MS) / 1000 + 0.3 }}
          className="mt-1 self-center px-6 py-2.5 rounded-full border border-white/20
                     bg-white/[0.06] text-[11px] font-bold tracking-[0.2em]
                     active:scale-95 transition">
          {N.t('champ_fermer')}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- l'ecran */

export function RejeuChampionnat() {
  const etat = useSyncExternalStore(suivreRejeu, lireRejeu, lireRejeu);
  if (!etat.actif) return null;

  if (etat.phase === 'presentation') {
    return <Presentation titre={etat.titre} sousTitre={etat.sousTitre} grille={etat.grille} />;
  }
  if (etat.phase === 'arrivee' && etat.arrivee) {
    return <Arrivee titre={etat.titre} sousTitre={etat.sousTitre} lignes={etat.arrivee} />;
  }
  // Pendant la course : le rappel des couloirs, quatre secondes, puis rien.
  return <RappelCouloirs grille={etat.grille} />;
}
