import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { MONTEE, COURBE, DUREE, useAnimationsReduites } from '@/lib/mouvement';
import { editionActive, EDITION_HALLOWEEN } from '@/game/edition';
import { EST_TEST, HALLOWEEN_2026_OUVERT } from '@/game/canal';
import {
  NB_NUITS as CAL_NB, ouvertureDe, instantDOuverture, blocageDe, nuitsJouables,
  maintenant, simuler, jourSimule, sourceDuTemps, decalageDeLAppareil,
} from '@/game/halloween-calendrier';
import { reglerLHorloge, horlogeImmediate } from '@/game/halloween-horloge';
import {
  NUITS, nuitDe, nuitOuverte, carnet, chronoDe, etapeDuCimetiere,
  armerLaNuit, rangerLaNuit, nuitEnCours, nuitCourante, etatDeLaChasse,
  tenirLaNuit, compterLaMorsure, tirerLaScene, noterLaScene, toutesTenues,
} from '@/game/halloween';
import { cameraDe } from '@/game/halloween-cameras.js';
import { prechargerLaNuit } from '@/game/chargement';
import { mesurerLaNuit } from '@/game/halloween-mesure';
import { preparerLaTraque, frayeurReduite, poserFrayeurReduite } from '@/game/halloween-traque';
import {
  CLES_MORSURES, chapitreDe, morsureDe, dit, peindreLaScene, prechargerLaCarte,
  type Scene,
} from '@/game/halloween-cinema';
import { mot, chrono } from '@/game/halloween-mots';
import { COURSES, distanceDe } from '@/game/halloween-courses.js';
import { chargerLaMusique } from '@/game/halloween-musique';

/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — les trois ecrans du mode
   ---------------------------------------------------------------------------
   Une banderole sur l'accueil, un tableau des treize nuits, et ce qu'on
   raconte apres la course. Rien de plus : le mode n'a ni classement, ni duel,
   ni onglet dans le vestiaire — il se joue seul, contre une bete, et il se
   ferme comme il s'ouvre.

   LE MODE SE POSE SUR LE ONE SHOT, il ne s'en fabrique pas un autre. Une nuit
   EST un 100 m au cimetiere municipal, lance par `startOneShot` comme
   n'importe quel 100 m ; ce qui la distingue tient dans ce que
   `armerLaNuit` ajoute par-dessus. Un mode qui aurait pose sa propre boucle de
   course aurait perdu au passage le faux depart, la pause, l'enregistrement de
   la trace, le film de la course et les records — tout ce que le one shot
   sait faire et dont personne ici n'a envie de se souvenir.
--------------------------------------------------------------------------- */

/* --- le panneau ouvert ou ferme --------------------------------------------
   Un etat de module plutot qu'un contexte React : deux composants le lisent,
   il change trois fois par session, et le porter dans l'arbre aurait demande
   un fournisseur au-dessus de tout le jeu pour un booleen. */
let ouvert = false;
const abonnes = new Set<() => void>();
function poserOuvert(v: boolean) {
  if (ouvert === v) return;
  ouvert = v;
  // LE MORCEAU SE DEMANDE EN OUVRANT LE TABLEAU, pas au lancement de la
  // course : il reste alors quelques secondes — le temps de choisir une nuit
  // — pour que sept cents kilo-octets arrivent et se decodent. Demande au
  // coup de pistolet, il serait pret vers la troisieme foulee.
  //
  // L'appel ne bloque rien et son echec ne se voit pas : sans lui, la course
  // part sur la musique ordinaire.
  if (v) void chargerLaMusique();
  // Et les sons de la bete, un par un, pendant qu'on choisit sa nuit.
  if (v) preparerLaTraque();
  // L'HEURE AVANT TOUT CALCUL. Le panneau decide ce qui s'ouvre : il doit le
  // decider sur l'heure retenue (le cliquet, puis le serveur), jamais sur
  // celle de l'appareil — meme le temps d'une premiere image. Voir
  // horlogeImmediate (halloween-horloge.ts).
  if (v) {
    horlogeImmediate();
    mesurerLaNuit('entree');
    // Et le decor de la nuit qu'on va courir, pendant qu'on choisit.
    const prochaine = Math.max(1, Math.min(CAL_NB, nuitsOuvertes()));
    prechargerLaNuit(cameraDe(prochaine).deg);
  }
  for (const f of abonnes) f();
}
function usePanneau(): boolean {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => ouvert, () => ouvert,
  );
}

/**
 * Le nom court d'un trace, pour le tableau des nuits, dans la langue du joueur.
 * Le libelle de la table des courses n'existe qu'en francais : l'interface
 * anglaise affichait « 400 M EN LIGNE ».
 */
function trace(cle: string): string {
  const traduit = mot('hw_trace_' + cle);
  if (traduit !== 'hw_trace_' + cle) return traduit;
  const c = (COURSES as any)[cle];
  return c ? c.label : cle;
}

/** La distance d'une nuit, en metres. */
function distanceDeLaNuit(nuit: { epreuve: string } | null): number {
  return nuit ? distanceDe(nuit.epreuve) : 100;
}

/**
 * LA NUIT LA PLUS HAUTE QU'ON PEUT COURIR, A CET INSTANT — et la seule
 * fonction a consulter avant d'en lancer une.
 *
 * Trois regimes, et c'est ici seulement qu'ils se tranchent :
 *   — sans edition datee (`HALLOWEEN_2026_OUVERT` faux) : la victoire seule ;
 *   — sur /test sans jour simule : les treize, dans n'importe quel ordre (le
 *     §9 bis du brief, voir PanneauMolosse) ;
 *   — sinon : la date ET la victoire (game/halloween-calendrier.ts).
 */
function nuitsOuvertes(): number {
  if (!HALLOWEEN_2026_OUVERT) return nuitOuverte();
  if (EST_TEST && jourSimule() === null) return CAL_NB;
  return nuitsJouables(carnet().tenues, maintenant(), decalageDeLAppareil());
}

/** Cette nuit se court-elle maintenant ? */
function jouableMaintenant(n: number): boolean {
  return n >= 1 && n <= nuitsOuvertes();
}

/**
 * Lancer une nuit : son trace au cimetiere, avec la bete par-dessus.
 *
 * ELLE REFUSE UNE NUIT FERMEE, quel que soit le bouton qui la demande. Le
 * bouton « NUIT SUIVANTE » de l'ecran de fin l'appelait sans rien verifier :
 * le 19 octobre, un joueur qui tenait la nuit 1 enchainait la 2, puis la 3…
 * et finissait l'edition le premier soir (audit du 16/10). Le verrou vit donc
 * ici, a la porte, plutot que dans chacun des ecrans qui menent a elle.
 */
function partir(n: number): boolean {
  if (!jouableMaintenant(n)) return false;
  poserOuvert(false);
  prechargerLaNuit(cameraDe(n).deg);
  // L'image du chapitre se charge pendant la course : elle est la recompense,
  // elle ne doit pas arriver apres le noir de l'ecran de fin.
  prechargerLaCarte(chapitreDe(n).cle);
  mesurerLaNuit('nuit', n);
  // CHAQUE NUIT A SON TRACE (halloween-loi.js) : cent metres, cent metres en
  // courbe, ou une ligne droite de deux, trois ou quatre cents. C'est ce qui
  // empeche les treize nuits d'etre treize fois la meme course.
  const nuit = nuitDe(n);
  (SprinterApp as any).startOneShot([nuit.epreuve], { levelIdx: etapeDuCimetiere(), etiquette: 'halloween' });
  // APRES `startOneShot`, ET PAS AVANT. C'est lui qui construit la course, et
  // la construction range les obstacles de la precedente — une bete armee
  // avant aurait ete balayee par le menage du 100 m qu'on vient de demander.
  armerLaNuit(n);
  return true;
}

/**
 * Le compte a rebours jusqu'a l'ouverture d'une nuit, ecrit court, dans la
 * langue du joueur. Vide si elle est deja ouverte par la date.
 *
 * La treizieme compte jusqu'a 18 h CHEZ LE JOUEUR (instantDOuverture) : elle
 * affichait « ouvre a 18 h » sans dire dans combien de temps.
 */
function resteAvant(n: number, ms: number): string {
  const d = instantDOuverture(n, decalageDeLAppareil()) - ms;
  if (d <= 0) return '';
  const j = Math.floor(d / 86400000);
  const h = Math.floor((d % 86400000) / 3600000);
  const m = Math.max(1, Math.ceil((d % 3600000) / 60000));
  if (j > 0) return mot('hw_duree_j', { j: String(j), h: String(h) });
  if (h > 0) return mot('hw_duree_h', { h: String(h), m: String(m === 60 ? 59 : m) });
  return mot('hw_duree_m', { m: String(m) });
}

/* ===========================================================================
   LA BANDEROLE DE L'ACCUEIL
   =========================================================================== */

/**
 * L'annonce du mode, en haut de la colonne de l'accueil.
 *
 * ELLE SUIT LA FENETRE, MAIS ELLE NE REPREND RIEN. Pendant les dix jours de
 * l'edition, elle s'affiche a tout le monde. Passe la fenetre, elle disparait
 * pour ceux qui n'y ont jamais touche — et elle RESTE, plus discrete, pour
 * ceux qui ont commence : treize nuits ne se tiennent pas en une semaine, et
 * un joueur arrive a la neuvieme le 3 novembre n'a pas a decouvrir le
 * 4 novembre que son chemin vers les quatre dernieres a ete retire.
 */
export function BanderoleMolosse() {
  const c = carnet();
  // LA PORTE, ET LA FENETRE. `editionActive` ne repond que sur des dates —
  // c'est un predicat pur, et le harnais s'y appuie. Savoir s'il faut MONTRER
  // l'entree est une autre question, et le canal y entre : c'est ici qu'on la
  // tranche, pas dans game/edition.ts, qui se charge nu sous node et ne peut
  // rien importer.
  //
  // SUR /test, TOUJOURS OUVERTE, et c'est la raison d'etre de ce canal : il
  // montre ce qui n'est pas encore ouvert, sans quoi il n'y a rien a y essayer.
  //
  // LE MODE A ETE INJOUABLE SUR /test PENDANT TOUT CE TEMPS, et c'est ce
  // qu'aucun des deux verrous ne disait seul. `HALLOWEEN_OUVERT` decide QUI
  // voit le mode — le canal de test, et lui seul ; la fenetre decide QUAND on
  // l'annonce — a partir du 24 octobre a l'epoque, du 19 depuis. Chacun etait bien regle. Leur
  // intersection, elle, etait vide : le code partait bien dans le paquet de
  // /test, et l'accueil n'affichait rien, parce que cette banderole est la
  // SEULE porte du mode et qu'un joueur neuf n'a pas de carnet pour la forcer.
  //
  // En production rien ne change : `EST_TEST` y vaut `false` en dur, le bundler
  // replie la condition, et les dates restent seules maitresses.
  const dansLaFenetre = EST_TEST || editionActive(EDITION_HALLOWEEN);
  const commence = c.tenues > 0 || c.morsures > 0;
  if (!dansLaFenetre && !commence) return null;

  return <CarteDuMolosse commence={commence} />;
}

/* --- LA CARTE VIVANTE (09/10, « plus vivante et effrayante, avec du design
   motion ») -----------------------------------------------------------------
   La premiere carte etait un aplat : deux points rouges dans un rond, trois
   lignes de texte. Elle disait « un mode de plus », pas « une bete t'attend ».

   CE QUI VIT ICI, du plus lent au plus brusque :
     - la TETE du molosse (la meme image FLUX que la carte de morsure) SORT DU
       NOIR a l'arrivee de l'accueil, puis RESPIRE ;
     - la BRUME passe devant, les BRAISES montent, le TITRE GRESILLE comme une
       lanterne qui va s'eteindre, le bouton BAT comme un coeur, le bord rougeoie ;
     - les YEUX brulent et CLIGNENT, a intervalles jamais egaux ;
     - et de temps en temps la bete SE JETTE : la tete bondit vers l'ecran, la
       carte tremble, un eclair rouge, trois griffures qui dechirent le haut
       de la carte.
   La rage revient toutes les sept a onze secondes : assez pour qu'on la voie
   en passant sur l'accueil, assez rare pour ne pas devenir un clignotant.

   CE QUI NE COUTE RIEN AU TELEPHONE LE PLUS FAIBLE. Tout ce qui bouge ne
   bouge qu'en `transform` et en `opacity` — rien qui force le navigateur a
   repeindre : pas de filtre anime, pas d'ombre animee, des halos peints une
   fois en degrade. L'accueil se demonte des que la course part (App.tsx :
   `state === 'title'`), et les minuteries s'arretent quand le tableau des
   nuits est ouvert par-dessus.

   POUR QUI A DEMANDE MOINS D'ANIMATIONS, la carte est une image fixe : la
   tete, les yeux allumes, rien qui saute.

   L'IMAGE NE PART PAS EN PRODUCTION (HORS_PRODUCTION, vite.config.ts), comme
   tout le mode. Tant qu'elle n'est pas chargee, seuls les yeux brulent dans le
   noir — la carte n'attend pas l'image pour etre effrayante. */

/** Les yeux dans l'image FLUX (graine 1313), en fraction du carre. */
const YEUX: Array<[number, number]> = [[0.303, 0.223], [0.66, 0.213]];

let teteUrl: string | null = null;
function useTeteDuMolosse(): string | null {
  const [url, poser] = useState<string | null>(teteUrl);
  useEffect(() => {
    if (teteUrl) return;
    let vivant = true;
    import('@/assets/molosse-tete.webp?url')
      .then(m => { teteUrl = (m.default as string) || null; if (vivant) poser(teteUrl); })
      .catch(() => { /* les yeux seuls */ });
    return () => { vivant = false; };
  }, []);
  return url;
}

/** Une minuterie aux intervalles jamais egaux, tant que `actif`. */
function useAuHasard(actif: boolean, premier: number, min: number, max: number, f: () => void) {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => {
    if (!actif) return;
    let id = 0;
    const suivant = (dans: number) => {
      id = window.setTimeout(() => { ref.current(); suivant(min + Math.random() * (max - min)); }, dans);
    };
    suivant(premier);
    return () => clearTimeout(id);
  }, [actif, premier, min, max]);
}

type Animer = ReturnType<typeof useAnimate>[1];

/**
 * LA BETE, dans un perimetre (`animer` vient de `useAnimate` : ses selecteurs
 * ne cherchent que sous la carte ou le panneau qui l'a cree, jamais chez
 * l'autre). Les yeux clignent ; et de temps en temps elle se jette.
 */
function useLaBete(animer: Animer, vivant: boolean, premier: number, min: number, max: number, secousse = 4) {
  useAuHasard(vivant, Math.max(600, premier - 1000), 3200, 6400, () => {
    animer('.mol-oeil', { scaleY: [1, 0.08, 1] }, { duration: 0.17, ease: 'easeInOut' });
  });
  useAuHasard(vivant, premier, min, max, () => {
    const s = secousse;
    animer('.mol-bond', { scale: [1, 1.18, 1.05, 1], x: [0, 5, 2, 0], y: [0, 3, 1, 0] },
      { duration: 0.75, times: [0, 0.18, 0.5, 1], ease: 'easeOut' });
    animer('.mol-corps', { x: [0, -s, s, -0.75 * s, 0.5 * s, -0.25 * s, 0] }, { duration: 0.5, delay: 0.08, ease: 'linear' });
    animer('.mol-eclair', { opacity: [0, 0.32, 0] }, { duration: 0.6, times: [0, 0.12, 1], ease: 'easeOut' });
    animer('.mol-oeil', { scale: [1, 1.9, 1] }, { duration: 0.6, ease: 'easeOut' });
    animer('.mol-griffe', { pathLength: [0, 1, 1], opacity: [1, 1, 0] },
      { duration: 1.5, times: [0, 0.14, 1], delay: 0.1, ease: 'easeOut' });
  });
}

/** La tete : elle sort du noir, respire, et porte ses deux yeux. */
function TeteVivante({ cote, style, vivant, reduit, retard = 0.2 }: {
  cote: number; style: React.CSSProperties; vivant: boolean; reduit: boolean; retard?: number;
}) {
  const tete = useTeteDuMolosse();
  const halo = Math.round(cote * 0.147);
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ width: cote, height: cote, ...style }}
      initial={reduit ? false : { opacity: 0, scale: 1.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.8, delay: retard, ease: COURBE.sortie as any }}
    >
      <motion.div
        className="absolute inset-0"
        animate={vivant ? { scale: [1, 1.035, 1], y: [0, -1.5, 0] } : { scale: 1, y: 0 }}
        transition={vivant ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      >
        <div className="mol-bond absolute inset-0">
          {tete && (
            <img
              src={tete} alt="" draggable={false}
              className="absolute inset-0 w-full h-full object-cover select-none"
              style={{
                WebkitMaskImage: 'radial-gradient(closest-side at 46% 50%, #000 58%, transparent 100%)',
                maskImage: 'radial-gradient(closest-side at 46% 50%, #000 58%, transparent 100%)',
              }}
            />
          )}
          {/* les yeux : un halo peint une fois, qui pulse en opacite */}
          {YEUX.map(([fx, fy], i) => (
            <motion.span
              key={i}
              className="mol-oeil absolute block rounded-full"
              style={{
                left: fx * cote - halo / 2, top: fy * cote - halo / 2, width: halo, height: halo,
                background: 'radial-gradient(circle, #FFE7B0 0%, #FF7A1E 22%, rgba(255,60,10,0.45) 45%, rgba(255,40,0,0) 72%)',
              }}
              initial={reduit ? false : { opacity: 0 }}
              animate={vivant ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
              transition={vivant
                ? { opacity: { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: retard + 1.2 + i * 0.12 } }
                : { duration: 0 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** La brume : deux nappes qui ne vont pas a la meme vitesse. */
function Brume() {
  return <>
    <motion.div className="absolute -inset-x-1/2 bottom-[-30%] h-[80%] pointer-events-none"
      style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(160,140,190,0.16) 0%, rgba(160,140,190,0) 70%)' }}
      animate={{ x: ['-18%', '18%'] }}
      transition={{ duration: 14, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
    <motion.div className="absolute -inset-x-1/2 bottom-[-40%] h-[70%] pointer-events-none"
      style={{ background: 'radial-gradient(45% 50% at 50% 50%, rgba(120,100,160,0.14) 0%, rgba(120,100,160,0) 70%)' }}
      animate={{ x: ['22%', '-22%'] }}
      transition={{ duration: 19, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
  </>;
}

/** Les braises qui montent : position, taille, duree, retard — fixes. */
const BRAISES = [
  [0.18, 2, 4.6, 0.0], [0.34, 1.5, 5.4, 1.7], [0.52, 2.5, 4.1, 0.9],
  [0.68, 1.5, 5.8, 2.6], [0.83, 2, 4.9, 3.4], [0.93, 1.5, 5.2, 0.4],
] as const;
function Braises({ hauteur = 120 }: { hauteur?: number }) {
  return <>{BRAISES.map(([fx, taille, duree, retard], i) => (
    <motion.span key={i}
      className="absolute bottom-0 block rounded-full pointer-events-none"
      style={{ left: `${fx * 100}%`, width: taille * 2, height: taille * 2,
               background: 'radial-gradient(circle, #FFC27A 0%, #FF5A14 60%, rgba(255,60,0,0) 100%)' }}
      animate={{ y: [6, -hauteur], x: [0, i % 2 ? 10 : -10], opacity: [0, 0.9, 0] }}
      transition={{ duration: duree, delay: retard, repeat: Infinity, ease: 'easeOut' }} />
  ))}</>;
}

/** Les griffures, invisibles jusqu'a ce que la bete se jette. */
function Griffes({ className }: { className: string }) {
  return (
    <svg className={`absolute pointer-events-none ${className}`} viewBox="0 0 100 100"
         preserveAspectRatio="none" aria-hidden="true">
      {['M18 6 C 34 30, 48 58, 60 94', 'M36 2 C 52 28, 64 56, 76 90', 'M54 4 C 68 30, 80 56, 92 84'].map((d, i) => (
        <motion.path key={i} d={d} className="mol-griffe" fill="none"
          stroke="#FF4A1A" strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }} />
      ))}
    </svg>
  );
}

/** La nuit du fond : violette, une lueur de braise en bas a gauche. */
const FOND_DE_NUIT = 'radial-gradient(120% 90% at 12% 100%, rgba(150,36,10,0.55) 0%, rgba(60,12,30,0.35) 38%, rgba(8,5,12,0) 70%), linear-gradient(100deg, #0B0710 0%, #160B20 55%, #0E0814 100%)';

/** Le battement de coeur : deux coups, puis l'attente. */
const BATTEMENT = { scale: [1, 1.08, 1, 1.05, 1, 1] };
const BATTEMENT_T = { duration: 1.5, times: [0, 0.08, 0.18, 0.26, 0.4, 1], repeat: Infinity, ease: 'easeOut' as const };

/** Le titre qui gresille, comme une lanterne qui va s'eteindre. */
const GRESILLE = { opacity: [1, 0.3, 1, 0.55, 1, 1] };
const GRESILLE_T = { duration: 5.5, times: [0, 0.015, 0.035, 0.05, 0.08, 1], repeat: Infinity, delay: 2.5 };

function CarteDuMolosse({ commence }: { commence: boolean }) {
  // LA NUIT QUI ATTEND LE JOUEUR, ET CE QUI LA RETIENT. La carte disait
  // « NUIT 2 » des la nuit 1 tenue, alors que le calendrier ne l'ouvre que le
  // lendemain : elle annoncait une course que le tableau refusait. Elle lit
  // maintenant la meme regle que lui (nuitsOuvertes), et dit quand la nuit
  // s'ouvre si c'est la date qui manque.
  //
  // L'heure retenue se pose au montage, avant le calcul (horlogeImmediate),
  // et un battement tient le compte a rebours a jour.
  const [, battre] = useState(() => { horlogeImmediate(); return 0; });
  useEffect(() => {
    const id = setInterval(() => battre(x => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const n = Math.min(CAL_NB, carnet().tenues + 1);
  const fini = toutesTenues();
  const attente = !fini && n > nuitsOuvertes() ? resteAvant(n, maintenant()) : '';
  const reduit = useAnimationsReduites();
  const panneau = usePanneau();
  const vivant = !reduit && !panneau;
  const [scope, animer] = useAnimate();
  useLaBete(animer, vivant, 3200, 7000, 11000);

  return (
    <motion.div {...MONTEE}>
      <motion.button
        ref={scope}
        onClick={() => poserOuvert(true)}
        whileTap={{ scale: 0.98 }}
        className="block w-full text-left"
      >
        <div className="mol-corps relative overflow-hidden rounded-2xl bg-[#08050C] min-h-[132px]">
          <div className="absolute inset-0" style={{ background: FOND_DE_NUIT }} />

          {/* la tete : un carre de 150 px qui deborde a gauche et en haut, les
              yeux a 20 px du bord, les crocs en bas de la carte */}
          <TeteVivante cote={150} style={{ left: -16, top: -14 }} vivant={vivant} reduit={reduit} />

          {/* un voile qui assombrit la tete sous le texte */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'linear-gradient(90deg, rgba(8,5,12,0) 22%, rgba(8,5,12,0.55) 42%, rgba(8,5,12,0.8) 100%)' }} />

          {vivant && <Brume />}
          {vivant && <Braises />}
          <Griffes className="right-3 top-1 w-32 h-28" />
          <div className="mol-eclair absolute inset-0 bg-[#C0140A] opacity-0 pointer-events-none" />

          {/* le bord, qui rougeoie */}
          <motion.div className="absolute inset-0 rounded-2xl border-2 border-[#FF4A1C] pointer-events-none"
            animate={vivant ? { opacity: [0.3, 0.85, 0.3] } : { opacity: 0.6 }}
            transition={vivant ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} />

          <div className="relative flex flex-col gap-1 pl-[112px] pr-4 py-3 min-h-[132px] justify-center">
            <span className="text-[9px] font-bold tracking-[0.24em] uppercase text-[#7CD04E]">
              {mot('hw_sur')}
            </span>
            <motion.span
              className="font-black text-lg md:text-xl leading-[1.05] text-[#F4E6D8]"
              style={{ textShadow: '0 0 12px rgba(255,80,20,0.45)' }}
              animate={vivant ? GRESILLE : { opacity: 1 }}
              transition={vivant ? GRESILLE_T : { duration: 0 }}
            >
              {mot('hw_titre')}
            </motion.span>
            {/* L'ACCROCHE DU CHAPITRE A VENIR, des qu'une nuit est tenue : c'est
                elle qui fait revenir le lendemain, pas le chrono. Avant la
                premiere, la phrase du mode suffit. */}
            <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
              {fini ? mot('hw_toutes_sous')
                : carnet().tenues > 0 ? <>{mot('hw_ch_n', { n: String(n) })} · <i>{dit(chapitreDe(n).accroche)}</i></>
                : mot('hw_sous')}
            </span>
            <span className="mt-1 flex items-center gap-2">
              <motion.span
                className="relative px-3 py-1 rounded-lg bg-[#E86826] text-black text-[11px] font-black tracking-widest"
                animate={vivant ? BATTEMENT : { scale: 1 }}
                transition={vivant ? BATTEMENT_T : { duration: 0 }}
              >
                {commence ? mot('hw_reprendre') : mot('hw_courir')}
              </motion.span>
              {!fini && (
                <span className="text-[9px] text-foreground/55 tracking-wide uppercase">
                  {mot('hw_nuit_n', { n: String(n) })}
                  {attente && <> · {mot('hw_ouvre_dans', { d: attente })}</>}
                </span>
              )}
            </span>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ===========================================================================
   LE TABLEAU DES TREIZE NUITS
   =========================================================================== */

/**
 * Le panneau du mode : la regle, puis les treize nuits.
 *
 * ON PEUT REJOUER N'IMPORTE QUELLE NUIT DEJA TENUE. Une echelle qui ne
 * laisserait courir que le palier suivant transformerait les douze premieres
 * en couloir a sens unique ; or c'est la qu'est le jeu — revenir sur la nuit 4
 * pour y poser deux dixiemes de moins est exactement ce qu'on a envie de faire
 * quand la nuit 9 resiste.
 */
/* ===========================================================================
   L'EDITION DATEE — une nuit par jour, du 19 au 31 octobre
   ===========================================================================
   Le mode a d'abord vecu sans calendrier : les treize nuits s'enchainaient a
   la victoire, et on pouvait toutes les courir dans la soiree. L'edition 2026
   ajoute la DATE — une nuit par jour — et garde la victoire. Il faut donc les
   DEUX pour ouvrir une nuit.

   CE QUI SE DECIDE ICI ET CE QUI SE DECIDE AILLEURS. Tout le calcul est dans
   game/halloween-calendrier.ts, ou un harnais l'eprouve sur les fuseaux, le
   changement d'heure et les trois garde-fous contre la montre avancee. Cet
   ecran ne fait que LIRE ce calcul et le dire. La seule chose qu'il tranche,
   c'est ce que le canal de test change — et c'est le §9 bis du brief.

   SUR /test, TOUT EST OUVERT PAR DEFAUT, et c'est la raison d'etre du canal :
   la premiere nuit ouvre le 19 octobre, et sans cela un testeur du mois de
   septembre trouverait treize cartes scellees et rien a essayer. Le voyageur
   temporel, lui, REMET les verrous tels qu'un joueur les aura ce jour-la :
   c'est l'outil qui permet de verifier le calendrier sans attendre octobre.
=========================================================================== */

/** Le jour choisi par le voyageur temporel, ou `null` pour l'heure reelle. */
function useVoyageur(): [number | null, (n: number | null) => void] {
  const [jour, setJour] = useState<number | null>(jourSimule() === null ? null : 1);
  const poser = (n: number | null) => {
    simuler(n === null ? null : ouvertureDe(n) + 3600000);  // 1 h du matin ce jour-la
    setJour(n);
  };
  return [jour, poser];
}


/**
 * Le bandeau du mode test, toujours visible pendant qu'on joue.
 *
 * LE BRIEF LE VEUT PERMANENT, et il a raison : un retour de testeur qui dit
 * « la nuit 9 ne s'ouvre pas » ne vaut rien si l'on ignore quel jour il
 * simulait. Il porte donc les trois choses qui rendent un retour exploitable —
 * qu'on est en test, quel jour est simule, et d'ou vient l'heure.
 */
function BandeauTest({ jour }: { jour: number | null }) {
  if (!EST_TEST) return null;
  const source = sourceDuTemps();
  return (
    <div className="flex items-center gap-2 mb-3 rounded-lg border border-[#7CD04E]/30
                    bg-[#7CD04E]/5 px-2.5 py-1.5">
      <span className="shrink-0 text-[8px] font-black tracking-[0.2em] text-[#7CD04E]">
        {mot('hw_test_bandeau')}
      </span>
      <span className="flex-1 min-w-0 text-[9px] font-mono text-foreground/60 truncate">
        {jour === null
          ? `${mot('hw_test_tout')} · ${mot('hw_test_source', { s: source })}`
          : mot('hw_test_jour', { d: mot('hw_date', { d: String(18 + jour) }) })}
      </span>
    </div>
  );
}

/**
 * Le voyageur temporel — le selecteur de jour simule.
 *
 * IL PILOTE EXACTEMENT LA MEME LOGIQUE QUE LA DATE REELLE, et c'est une
 * exigence du brief plutot qu'une commodite : `simuler()` SUBSTITUE l'instant
 * dans game/halloween-calendrier.ts, il n'ajoute pas une branche. Ce qu'on
 * verifie ici est donc ce qui tournera en octobre, pas une doublure.
 */
function Voyageur({ jour, poser }: { jour: number | null; poser: (n: number | null) => void }) {
  if (!EST_TEST) return null;
  return (
    <div className="mb-4 rounded-xl border border-[#7CD04E]/25 bg-[#0A140A] px-3 py-2.5">
      <div className="text-[8px] font-black tracking-[0.2em] text-[#7CD04E] mb-1.5">
        {mot('hw_test_voyage')}
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => poser(null)}
          className={`px-2 py-1 rounded text-[9px] font-bold tracking-wider transition-colors
            ${jour === null ? 'bg-[#7CD04E] text-black' : 'bg-white/5 text-foreground/50'}`}
        >
          {mot('hw_test_reel')}
        </button>
        {Array.from({ length: CAL_NB }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => poser(n)}
            className={`w-7 py-1 rounded text-[9px] font-mono font-bold transition-colors
              ${jour === n ? 'bg-[#7CD04E] text-black' : 'bg-white/5 text-foreground/50'}`}
          >
            {18 + n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PanneauMolosse() {
  const affiche = usePanneau();
  const state = useGameStore(s => s.state);
  const c = carnet();
  const [jour, poserJour] = useVoyageur();
  const [, rafraichir] = useState(0);
  // Le chapitre relu, ou null. Les chapitres gagnes se relisent depuis le
  // tableau : on y revient avant d'aller chercher le suivant.
  const [lu, lire] = useState<number | null>(null);

  /* L'HORLOGE SE REGLE A L'OUVERTURE DU PANNEAU, PAS AU CHARGEMENT DU JEU.
     Un joueur qui n'entre jamais dans le mode n'a aucune raison d'appeler le
     serveur, et l'edition n'a aucune raison de se signaler dans son trafic.

     DEUX TEMPS, ET LE PREMIER EST IMMEDIAT. `horlogeImmediate` pose tout de
     suite ce que le cliquet sait ; `reglerLHorloge` corrige quand le serveur
     repond. Sans cela, le Calendrier s'afficherait une fraction de seconde
     avec `Date.now()` — et sur la machine d'un joueur qui a avance sa montre,
     cette fraction de seconde montrerait treize cartes ouvertes. */
  //
  // (L'horloge immediate, elle, est posee par `poserOuvert`, AVANT le premier
  // rendu : appelee ici, dans un effet, elle passait apres une premiere image
  // calculee sur l'horloge de l'appareil.)
  //
  // ET ELLE SE REDEMANDE QUAND LA PAGE REVIENT AU PREMIER PLAN. L'heure avance
  // sur la montre monotone du navigateur (halloween-calendrier.ts), qu'iOS
  // suspend quand le telephone dort : un panneau laisse ouvert toute la nuit
  // se reveillerait a l'heure du coucher.
  useEffect(() => {
    if (!affiche || !HALLOWEEN_2026_OUVERT) return;
    let vivant = true;
    const regler = () => {
      reglerLHorloge().then(() => { if (vivant) rafraichir(x => x + 1); });
    };
    regler();
    const auRetour = () => { if (document.visibilityState === 'visible') regler(); };
    document.addEventListener('visibilitychange', auRetour);
    return () => { vivant = false; document.removeEventListener('visibilitychange', auRetour); };
  }, [affiche]);
  // Les ouvertures et les « dans X min » se lisent a l'horloge, qui avance
  // maintenant d'elle-meme : un battement les redessine tant que le panneau
  // est ouvert (il ne se redessine plus a chaque image, voir useGameStore).
  useEffect(() => {
    if (!affiche) return;
    const id = setInterval(() => rafraichir(x => x + 1), 15_000);
    return () => clearInterval(id);
  }, [affiche]);

  /* CE QUE LE CANAL DE TEST CHANGE, ET RIEN D'AUTRE.

     Sur /test SANS jour simule, LES TREIZE SONT OUVERTES, dans n'importe quel
     ordre, verrou de victoire compris. Le §9 bis l'exige mot pour mot, et il a
     raison deux fois : la premiere nuit n'ouvre que le 19 octobre, donc sans
     cela un testeur de septembre trouverait treize cartes scellees ; et un
     testeur a qui l'on demande d'essayer la nuit 11 ne doit pas avoir a en
     gagner dix d'abord.

     DES QU'UN JOUR EST SIMULE, LES DEUX VERROUS REPRENNENT — la date ET la
     victoire, exactement dans la forme qu'ils auront ce jour-la pour un vrai
     joueur. C'est l'outil de verification, et il ne vaut que s'il ne triche
     pas : un voyageur temporel qui laisserait tout ouvert ne verifierait rien.

     En production, `HALLOWEEN_2026_OUVERT` vaut `false` en dur et tout ce
     bloc se replie : on retombe sur `nuitOuverte()`, l'enchainement par la
     victoire seule, qui est le mode tel qu'il vit aujourd'hui. */
  const toutOuvert = EST_TEST && jour === null;
  const ms = maintenant();
  const dec = decalageDeLAppareil();
  // La meme regle que `partir`, qui la reverifie au moment de lancer.
  const ouverte = nuitsOuvertes();

  /* LE PANNEAU VIT AUSSI (09/10, « celle-la aussi »). La meme bete que sur la
     carte de l'accueil, en plus grand, dans l'en-tete : elle sort du noir a
     l'ouverture, respire, cligne, et se jette toutes les huit a treize
     secondes — le panneau tremble, les griffures passent sur l'en-tete. Les
     nuits entrent l'une apres l'autre, et la PROCHAINE a courir bat comme un
     coeur : c'est celle qu'on cherche des yeux en ouvrant le tableau. Au bord
     de l'ecran, un pouls rouge. Les memes regles que la carte : transform et
     opacite seulement, rien pour qui a demande moins d'animations. */
  const reduit = useAnimationsReduites();
  const montre = affiche && (state === 'title' || state === 'open');
  const vivant = montre && !reduit;
  const [scope, animer] = useAnimate();
  useLaBete(animer, vivant, 2600, 8000, 13000, 3);
  const prochaine = NUITS.find(x => x.n > c.tenues && x.n <= ouverte)?.n ?? null;

  // Le panneau appartient a l'accueil : une course lancee le referme, et il ne
  // se rouvre pas par-dessus une piste montee.
  if (!affiche || (state !== 'title' && state !== 'open')) return null;

  return (
    // Au-dessus du bouton flottant du tchat (z-55, TchatMarques.tsx) : il se
    // posait sur les dernieres nuits du calendrier, au telephone.
    <motion.div
      className="absolute inset-0 z-[56] flex items-end sm:items-center justify-center
                 bg-black/70 backdrop-blur-sm pointer-events-auto p-0 sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DUREE.rapide }}
    >
      {/* le pouls de la bete, au bord de l'ecran */}
      {vivant && (
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(140,10,0,0.55) 100%)' }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <motion.div
        ref={scope}
        initial={reduit ? { opacity: 0 } : { opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl
                   border-2 border-[#E86826]/50 bg-[#0D0814]"
      >
        <div className="mol-corps px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {/* L'EN-TETE : la bete, en grand, a droite ; le titre a gauche */}
          <div className="relative -mx-5 mb-3 h-[156px] overflow-hidden">
            <div className="absolute inset-0" style={{ background: FOND_DE_NUIT }} />
            <TeteVivante cote={236} style={{ right: -40, top: -22 }} vivant={vivant} reduit={reduit} retard={0.15} />
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'linear-gradient(90deg, rgba(13,8,20,0.92) 0%, rgba(13,8,20,0.65) 40%, rgba(13,8,20,0) 72%), linear-gradient(0deg, #0D0814 0%, rgba(13,8,20,0) 38%)' }} />
            {vivant && <Brume />}
            {vivant && <Braises hauteur={150} />}
            <Griffes className="left-[36%] top-2 w-40 h-32" />
            <div className="mol-eclair absolute inset-0 bg-[#C0140A] opacity-0 pointer-events-none" />
            <div className="relative h-full flex flex-col justify-end px-5 pb-3">
              <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">
                {mot('hw_sur')}
              </div>
              <motion.h2
                className="font-black font-display text-2xl sm:text-3xl uppercase leading-none text-[#F8A02E] max-w-[75%]"
                style={{ textShadow: '0 0 14px rgba(255,90,20,0.55)' }}
                animate={vivant ? GRESILLE : { opacity: 1 }}
                transition={vivant ? GRESILLE_T : { duration: 0 }}
              >
                {mot('hw_titre')}
              </motion.h2>
              <p className="mt-1 text-[11px] leading-snug text-foreground/60 max-w-[62%]">
                {mot('hw_sous')}
              </p>
            </div>
          </div>

          {/* LA REGLE, DITE UNE FOIS ET EN ENTIER. Elle tient en trois phrases,
              et elle merite d'etre lue avant la premiere nuit plutot que devinee
              pendant. Elle disparait des qu'une nuit a ete tenue : on ne
              reexplique pas a quelqu'un qui joue. */}
          {c.tenues === 0 && (
            <div className="rounded-xl border border-[#E86826]/25 bg-[#160D22] px-3 py-2.5 mb-4">
              <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#E86826] mb-1">
                {mot('hw_regle_titre')}
              </div>
              <p className="text-[11px] leading-snug text-foreground/75">{mot('hw_regle')}</p>
              {/* L'AVERTISSEMENT, une fois, avant la premiere nuit : la bete
                  fait maintenant du bruit, et elle est faite pour surprendre. */}
              <p className="mt-1.5 text-[10px] leading-snug text-foreground/50">{mot('hw_avertissement')}</p>
            </div>
          )}

          <Frayeur />

          <BandeauTest jour={jour} />
          <Voyageur jour={jour} poser={n => { poserJour(n); rafraichir(x => x + 1); }} />

          <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-foreground/45 mb-2">
            {HALLOWEEN_2026_OUVERT ? mot('hw_cal_titre') : mot('hw_nuits')}
            {HALLOWEEN_2026_OUVERT && (
              <span className="ml-2 normal-case tracking-normal font-normal text-foreground/40">
                {mot('hw_cal_sous')}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {NUITS.map((nuit, i) => {
              const tenue = nuit.n <= c.tenues;
              const jouable = nuit.n <= ouverte;
              const best = chronoDe(nuit.n);
              /* CE QUI MANQUE, ET POURQUOI ON LE DISTINGUE. Une carte qui
                 affiche un compte a rebours alors que c'est la victoire de la
                 veille qui manque envoie le joueur attendre pour rien. */
              const blocage = HALLOWEEN_2026_OUVERT && !toutOuvert
                ? blocageDe(nuit.n, c.tenues, ms, dec) : 'ouverte';
              const parLaDate = !jouable && blocage === 'date';
              const elle = nuit.n === prochaine;
              return (
                <motion.div key={nuit.n}
                     initial={reduit ? false : { opacity: 0, y: 14 }}
                     animate={{ opacity: jouable ? 1 : 0.5, y: 0 }}
                     transition={{ delay: 0.3 + i * 0.045, duration: DUREE.base, ease: COURBE.sortie as any }}
                     className={`relative rounded-xl border px-3 py-2 flex items-center gap-3
                       ${elle ? 'border-[#FF4A1C]/50 bg-[#22101C]'
                         : jouable ? 'border-[#E86826]/35 bg-[#160D22]'
                         : 'border-white/5 bg-white/[0.02]'}`}>
                  {/* la prochaine nuit : son bord rougeoie au rythme du coeur */}
                  {elle && vivant && (
                    <motion.span className="absolute -inset-px rounded-xl border-2 border-[#FF4A1C] pointer-events-none"
                      animate={{ opacity: [0.15, 0.9, 0.15] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
                  )}
                  <motion.span className={`shrink-0 w-7 text-center font-black font-display text-lg
                    ${tenue ? 'text-[#7CD04E]' : jouable ? 'text-[#F8A02E]' : 'text-foreground/30'}`}
                    style={elle ? { textShadow: '0 0 10px rgba(255,90,20,0.8)' } : undefined}
                    animate={elle && vivant ? BATTEMENT : { scale: 1 }}
                    transition={elle && vivant ? BATTEMENT_T : { duration: 0 }}>
                    {nuit.n}
                  </motion.span>
                  <span className="flex-1 min-w-0 flex flex-col leading-tight">
                    <span className="font-bold text-xs text-foreground truncate">
                      {dit(nuit.nom)}
                    </span>
                    <span className="text-[10px] text-foreground/55 font-mono tabular-nums">
                      {/* LE TRACE S'ANNONCE, et le temps avec. Le cacher aurait
                          fait une surprise une fois et une frustration les
                          douze suivantes : on ne se prepare pas a une ligne
                          droite de quatre cents metres comme a un cent
                          metres. */}
                      {jouable
                        ? <>{trace(nuit.epreuve)} · {mot('hw_imparti', { s: chrono(nuit.imparti) })}
                            {/* et comment on part : on ne se met pas en garde de
                                la meme facon pour une surprise que pour des blocs */}
                            {' · '}{mot(nuit.depart === 'surpris' ? 'hw_dep_surpris'
                                       : nuit.depart === 'elan' ? 'hw_dep_elan' : 'hw_dep_blocs')}</>
                        : parLaDate
                          ? mot('hw_ouvre_dans', { d: resteAvant(nuit.n, ms) || '—' })
                          : mot('hw_verrouille')}
                      {best !== null && <> · {mot('hw_meilleur', { s: chrono(best) })}</>}
                    </span>
                    {/* LA PROMESSE DU CHAPITRE A GAGNER : ce qu'on saura en tenant
                        cette nuit. Une seule ligne, sur la nuit qui l'ouvre. */}
                    {nuit.n === c.tenues + 1 && (
                      <span className="mt-0.5 text-[10px] italic leading-snug text-[#F8A02E]/85">
                        {dit(chapitreDe(nuit.n).accroche)}
                      </span>
                    )}
                  </span>
                  {tenue && (
                    <motion.button
                      onClick={() => lire(nuit.n)}
                      whileTap={{ scale: 0.92 }}
                      className="relative shrink-0 px-2 py-1 rounded-lg border border-[#7CD04E]/50
                                 text-[#7CD04E] text-[10px] font-black tracking-widest"
                    >
                      {mot('hw_lire')}
                    </motion.button>
                  )}
                  {jouable && (
                    <motion.button
                      onClick={() => partir(nuit.n)}
                      whileTap={{ scale: 0.92 }}
                      animate={elle && vivant ? BATTEMENT : { scale: 1 }}
                      transition={elle && vivant ? BATTEMENT_T : { duration: 0 }}
                      className={`relative shrink-0 px-2.5 py-1 rounded-lg text-black text-[10px] font-black tracking-widest
                        ${elle ? 'bg-[#FF5A1C]' : 'bg-[#E86826]'}`}
                    >
                      {tenue ? mot('hw_encore') : mot('hw_partir')}
                    </motion.button>
                  )}
                  {tenue && !jouable && (
                    <span className="shrink-0 text-[9px] font-black tracking-widest text-[#7CD04E]">
                      {mot('hw_tenue')}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          <button
            onClick={() => poserOuvert(false)}
            className="w-full mt-4 py-2.5 rounded-xl border border-white/10 text-foreground/60
                       text-[11px] font-bold tracking-widest uppercase"
          >
            {mot('hw_fermer')}
          </button>
        </div>
      </motion.div>

      {lu !== null && lu <= c.tenues && (
        <LecteurDuRecit n={lu} dernier={c.tenues} aller={lire} />
      )}
    </motion.div>
  );
}

/* ===========================================================================
   LE RECIT, RELU
   =========================================================================== */

/** L'horloge d'une scene, en secondes, sur sa propre boucle ; repart a chaque `cle`. */
function useHorlogeDeScene(cle: string | number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    let vivant = true;
    const depart = performance.now();
    setT(0);
    const battre = () => {
      if (!vivant) return;
      setT((performance.now() - depart) / 1000);
      requestAnimationFrame(battre);
    };
    requestAnimationFrame(battre);
    return () => { vivant = false; };
  }, [cle]);
  return t;
}

/** La toile de la scene : la carte en image si elle existe, la nuit dessinee sinon. */
function ToileDeScene({ t, mordu, cle }: { t: number; mordu: boolean; cle: string }) {
  const toile = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = toile.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const L = el.clientWidth, H = el.clientHeight;
    if (el.width !== L * r || el.height !== H * r) {
      el.width = Math.max(1, Math.round(L * r));
      el.height = Math.max(1, Math.round(H * r));
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    peindreLaScene(ctx, L, H, t, mordu, cle);
  }, [t, mordu, cle]);
  return <canvas ref={toile} className="absolute inset-0 w-full h-full" />;
}

/**
 * LA CARTE DE TEXTE. Sa mise en forme est celle des cinematiques du jeu
 * (voir CutScreen) : meme carte sombre, meme filet de couleur a gauche, meme
 * place a l'ecran. Une scenette d'Halloween qui aurait invente sa propre boite
 * aurait eu l'air d'un morceau rapporte — le mode est une edition du jeu, pas
 * un autre jeu.
 */
function CarteDuTexte({ s, couleur, visibles, pied }: {
  s: Scene; couleur: string; visibles: number; pied?: React.ReactNode;
}) {
  return (
    <div className="absolute z-10 overflow-hidden rounded-2xl border border-white/10
                    bg-[rgba(9,7,16,0.86)] shadow-[0_18px_48px_rgba(0,0,0,0.5)]
                    pl-5 pr-4 py-3 sm:pl-6 sm:pr-5 sm:py-4 md:pl-8 md:pr-7 md:py-6
                    portrait:left-4 portrait:right-4 portrait:bottom-[calc(max(env(safe-area-inset-bottom),1.25rem)+4.5rem)]
                    landscape:left-[45vw] landscape:top-[12vh] landscape:w-[min(46vw,38rem)]">
      <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5" style={{ backgroundColor: couleur }} />
      <div className="text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 md:mb-2"
           style={{ color: couleur }}>
        {dit(s.sur)}
      </div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight
                     uppercase leading-[0.95] text-foreground">
        {dit(s.titre)}
      </h2>
      <div className="h-1 w-11/12 mt-2 md:mt-3" style={{ backgroundColor: couleur }} />
      <div className="mt-3 flex flex-col gap-1.5">
        <AnimatePresence>
          {s.lignes.slice(0, visibles).map((l, k) => (
            <motion.p key={k}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] sm:text-sm md:text-base leading-snug text-foreground/85">
              {dit(l)}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
      {pied}
    </div>
  );
}

/**
 * Un chapitre gagne, relu depuis le tableau. Les lignes arrivent plus vite
 * qu'a la premiere lecture : on connait la fin, on vient la retrouver. On
 * passe d'un chapitre a l'autre sans sortir, jusqu'au dernier gagne — jamais
 * au-dela : la suite se gagne.
 */
function LecteurDuRecit({ n, dernier, aller }: {
  n: number; dernier: number; aller: (n: number | null) => void;
}) {
  const ch = chapitreDe(n);
  const t = useHorlogeDeScene(n);
  const visibles = Math.min(ch.lignes.length, Math.floor(Math.max(0, t - 0.3) / 0.45) + 1);
  const suivant = n < 13 ? chapitreDe(n + 1) : null;
  return (
    <div className="absolute inset-0 z-10 bg-[#0B0710] pointer-events-auto">
      <ToileDeScene t={t} mordu={false} cle={ch.cle} />
      <CarteDuTexte s={ch} couleur="#7CD04E" visibles={visibles} pied={
        suivant && n === dernier && visibles === ch.lignes.length ? (
          <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-0.5">
            <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-[#F8A02E]">
              {mot('hw_la_suite', { n: String(suivant.n) })}
            </span>
            <span className="text-[11px] sm:text-xs italic leading-snug text-foreground/70">{dit(suivant.accroche)}</span>
          </div>
        ) : undefined
      } />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] flex gap-2">
        <button onClick={() => aller(n - 1)} disabled={n <= 1}
                className="w-12 py-3 rounded-xl border border-white/15 bg-black/50 text-foreground/70
                           text-sm font-black disabled:opacity-25">‹</button>
        <button onClick={() => aller(null)}
                className="flex-1 py-3 rounded-xl border border-white/15 bg-black/50
                           text-foreground/70 text-[11px] font-black tracking-widest uppercase">
          {mot('hw_refermer')}
        </button>
        <button onClick={() => aller(n + 1)} disabled={n >= dernier}
                className="w-12 py-3 rounded-xl border border-white/15 bg-black/50 text-foreground/70
                           text-sm font-black disabled:opacity-25">›</button>
      </div>
    </div>
  );
}

/**
 * LE REGLAGE « FRAYEUR REDUITE » : pas de signal d'arrivee, pas d'aboiement,
 * pas de coeur, pas de secousse ni de vibration. La bete reste audible — ses
 * pattes et sa gorge sont l'information du mode —, elle cesse de faire
 * sursauter. Range sur l'appareil (halloween-traque.ts).
 */
function Frayeur() {
  const [doux, poser] = useState(frayeurReduite);
  return (
    <button
      onClick={() => { poserFrayeurReduite(!doux); poser(!doux); }}
      role="switch" aria-checked={doux}
      className="w-full mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02]
                 px-3 py-2 text-left"
    >
      <span className="flex-1 min-w-0 flex flex-col leading-tight">
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-foreground/70">
          {mot('hw_frayeur')}
        </span>
        <span className="text-[10px] text-foreground/45">{mot('hw_frayeur_sous')}</span>
      </span>
      <span className={`relative shrink-0 w-9 h-5 rounded-full transition-colors
                        ${doux ? 'bg-[#7CD04E]' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-[left]
                          ${doux ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/* ===========================================================================
   CE QU'ON RACONTE APRES
   =========================================================================== */

/** Combien de temps s'ecoule entre deux lignes de la scenette, en secondes. */
const LIGNE = 1.9;

/**
 * L'ecran de fin d'une nuit : la scenette, puis la suite.
 *
 * IL REMPLACE LE RECAPITULATIF DU ONE SHOT, il ne se pose pas dessus. Le
 * tableau ordinaire propose huit choses — refaire, defier, partager, voir le
 * classement — et aucune n'a de sens ici : on vient de se faire arracher une
 * oreille, la seule question est de savoir si l'on y retourne.
 */
export function FinDeLaNuit() {
  const state = useGameStore(s => s.state);
  // Ce qui manquait au COUREUR, et non a la bete. Les deux sont au meme point
  // a l'instant de la morsure, donc l'un valait l'autre — mais lire la
  // position du chien pour parler de la course du joueur est le genre de
  // raccourci qui devient faux le jour ou la morsure change de regle.
  const joueur = useGameStore(s => s.player);
  // LA NUIT TENUE DONNE SON CHAPITRE, toujours le meme pour la meme nuit
  // (LE RECIT, halloween-cinema.ts) ; la morsure tire un cauchemar.
  const [scene] = useState<{ mordu: boolean; s: Scene }>(() => {
    const c = etatDeLaChasse();
    const mordu = !c || c.verdict !== 'passe';
    if (!mordu && c) return { mordu, s: chapitreDe(c.nuit.n) };
    return { mordu: true, s: morsureDe(tirerLaScene(CLES_MORSURES)) };
  });
  const t = useHorlogeDeScene(0);

  const c = etatDeLaChasse();
  const nuit = nuitCourante();

  // LE RESULTAT SE RANGE UNE SEULE FOIS, au montage de cet ecran. Le poser
  // dans la boucle de course aurait compte une morsure a chaque image ou la
  // bete tient le joueur ; le poser au demontage l'aurait perdu si le joueur
  // ferme l'onglet. Ici, il est ecrit au moment ou la nuit se termine, et une
  // seule fois — React ne monte cet ecran qu'une fois par course.
  useEffect(() => {
    const e = etatDeLaChasse();
    if (!e || !nuit) return;
    if (e.verdict === 'passe') {
      tenirLaNuit(nuit.n, e.chrono, e.ecartMin);
      mesurerLaNuit('tenue', nuit.n);
    } else compterLaMorsure();
    // Le cauchemar est montre : on le note maintenant, une fois (voir tirerLaScene).
    if (scene.mordu) noterLaScene(scene.s.cle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state !== 'winall' || !nuitEnCours() || !nuit) return null;

  const s = scene.s;
  const visibles = Math.min(s.lignes.length, Math.floor(Math.max(0, t - 0.6) / LIGNE) + 1);
  const finie = t > 0.6 + s.lignes.length * LIGNE;

  const passe = !!c && c.verdict === 'passe';
  const suivante = nuit.n < NUITS.length ? nuit.n + 1 : null;
  // LA SUIVANTE N'EST PROPOSEE QUE SI ELLE EST OUVERTE. Ce bouton menait a la
  // nuit d'apres sans rien demander au calendrier — treize nuits le premier
  // soir. Fermee par la date, on dit quand elle s'ouvre, et on propose de
  // rejouer celle-ci pour gratter des dixiemes.
  const suivanteOuverte = suivante !== null && jouableMaintenant(suivante);
  const attenteSuivante = passe && suivante !== null && !suivanteOuverte
    ? resteAvant(suivante, maintenant()) : '';
  // L'ecart le plus court de la course : ce qui se raconte apres une victoire
  // — quand il vaut d'etre raconte. Huit metres ne sont pas un frisson.
  const frole = passe && c && c.ecartMin < 4 ? c.ecartMin : null;
  // LA SUITE, ou ce qui reste a gagner. Tenue : l'accroche du chapitre
  // suivant, et quand sa nuit s'ouvre. Mordu : le chapitre de cette nuit reste
  // ferme, et l'accroche dit ce qu'on y apprendra.
  const aVenir = passe ? (suivante !== null ? chapitreDe(suivante) : null) : chapitreDe(nuit.n);

  const sortir = () => { rangerLaNuit(); (SprinterApp as any).goHome(); };
  // Une nuit que le calendrier refuse ramene a l'accueil plutot que de laisser
  // le joueur sur un ecran de fin sans nuit (le cas ne devrait pas se
  // presenter : les boutons ne proposent que des nuits ouvertes).
  const rejouer = (n: number) => { rangerLaNuit(); if (!partir(n)) (SprinterApp as any).goHome(); };

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto bg-[#0B0710]">
      <ToileDeScene t={t} mordu={scene.mordu} cle={s.cle} />

      {/* LE VERDICT, EN HAUT. Trois mots et un chrono : c'est ce que le joueur
          cherche en premier, et la scenette n'a pas a le lui faire attendre.
          L'histoire vient ensuite, et elle a tout son temps. */}
      <div className="absolute inset-x-0 top-0 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]
                      flex flex-col items-center gap-0.5">
        <span className={`font-black font-display text-2xl sm:text-3xl uppercase tracking-tight
                          drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]
                          ${passe ? 'text-[#7CD04E]' : 'text-destructive'}`}>
          {passe ? mot('hw_passe') : mot('hw_mordu')}
        </span>
        <span className="font-mono tabular-nums text-sm text-foreground/80
                         drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          {passe && c
            ? <>{mot('hw_chrono', { s: chrono(c.chrono) })}
                {' · '}
                {mot('hw_marge', { s: chrono(Math.max(0, nuit.imparti - c.chrono)) })}</>
            : <>{mot('hw_manque', {
                // La distance de CETTE nuit : cent metres en dur donnait
                // « il te manquait 100 m » sur une ligne droite de quatre
                // cents, ou il en manquait trois cent quatre-vingts.
                m: Math.max(0, distanceDeLaNuit(nuit) - Math.max(0, joueur ? joueur.d : 0)).toFixed(0),
              })}</>}
        </span>
      </div>

      <CarteDuTexte s={s} couleur={passe ? '#7CD04E' : '#E86826'} visibles={visibles} pied={
        /* LE PIED DE LA CARTE : ce qu'on retient de cette nuit, et la suite.
           Dans la carte plutot qu'a cote : poses en haut ou au-dessus des
           boutons, ils passaient sous elle, en paysage comme en portrait. */
        (frole !== null || (finie && aVenir)) ? (
          <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-0.5">
            {frole !== null && (
              <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-[#F8A02E]">
                {mot('hw_frole', { m: frole.toFixed(1) })}
              </span>
            )}
            {finie && aVenir && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-foreground/60">
                  {passe
                    ? <>{mot('hw_la_suite', { n: String(aVenir.n) })}
                        {' · '}
                        {attenteSuivante
                          ? mot('hw_ouvre_dans', { d: attenteSuivante })
                          : mot('hw_ch_ouvert', { n: String(aVenir.n) })}</>
                    : mot('hw_ch_ferme', { n: String(aVenir.n) })}
                </span>
                <span className="text-[11px] sm:text-xs italic leading-snug text-[#F8A02E]">
                  {dit(aVenir.accroche)}
                </span>
              </motion.div>
            )}
          </div>
        ) : undefined
      } />

      {/* LES BOUTONS N'ARRIVENT QU'A LA FIN DE L'HISTOIRE. Poses tout de suite,
          ils auraient tue la scenette : personne ne lit quatre lignes quand un
          bouton « ENCORE » attend deja sous son pouce. */}
      <AnimatePresence>
        {finie && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="absolute inset-x-0 bottom-0 px-4
                                 pb-[max(env(safe-area-inset-bottom),1rem)] flex gap-2">
            <button onClick={sortir}
                    className="flex-1 py-3 rounded-xl border border-white/15 bg-black/50
                               text-foreground/70 text-[11px] font-black tracking-widest uppercase">
              {mot('hw_sortir')}
            </button>
            {passe && suivante && suivanteOuverte ? (
              <button onClick={() => rejouer(suivante)}
                      className="flex-[2] py-3 rounded-xl bg-[#E86826] text-black
                                 text-[11px] font-black tracking-widest uppercase active:scale-95
                                 transition-transform">
                {mot('hw_suivante')}
              </button>
            ) : (
              <button onClick={() => rejouer(nuit.n)}
                      className="flex-[2] py-3 rounded-xl bg-[#E86826] text-black
                                 text-[11px] font-black tracking-widest uppercase active:scale-95
                                 transition-transform">
                {mot('hw_encore')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Les treize nuits tombees : on le dit ici, une fois, et le mode ne
          change rien d'autre — le cimetiere reste ouvert et les nuits se
          rejouent. Une recompense qui fermerait quoi que ce soit apres coup
          serait exactement ce que ce jeu ne fait jamais. */}
      {passe && !suivante && toutesTenues() && finie && (
        <div className="absolute inset-x-0 top-[38%] text-center px-6 pointer-events-none">
          <span className="font-black font-display text-lg sm:text-xl uppercase text-[#7CD04E]
                           drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            {mot('hw_toutes')}
          </span>
        </div>
      )}
    </div>
  );
}

/** Le mode a-t-il quelque chose a afficher a la place de l'ecran de fin ? */
export function finDeNuitEnCours(): boolean { return nuitEnCours(); }

/** Fermer le panneau — appele quand le jeu quitte l'accueil par un autre chemin. */
export function fermerLeMolosse() { poserOuvert(false); }
