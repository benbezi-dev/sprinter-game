import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, ScanLine } from 'lucide-react';
import { MONTEE, FONDU } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { suivreRejeu, lireRejeu, fermerRejeu, lancerLeDepartDuRejeu, presentationDuRejeu } from '@/game/champ-rejeu';
import { useFilmDeLaCourse, partagerLeFilm } from '@/game/film-course';
import { ReviewVideo } from './ReviewVideo';
import { LaisserUnMot } from './MotDuel';
import { poserMotDeCourse, voixDuMotDeCourse, urlDeLaVoix } from '@/game/mot';
import { getSavedName } from '@/game/leaderboard';
import { arriveeSerree, ecartLePlusSerre, partagerPhotoFinish } from '@/game/photo-finish';
import type { MotDuVainqueur } from '@/game/champ-rejeu';
import { RappelEnScene } from './ChampDirect';
import { FichePresentation } from './FichePresentation';
import {
  ouvrirLaPresentation, ouvrirLeCreneau, fermerLaPresentation,
} from '@/game/tension-presentation';
import {
  VoilePouls, EclairArrivee, CouloirGeant, Sablier, CLAQUE, favoriDe, sortieVive,
} from './TensionPresentation';
import { useFiches, type SourceFiches } from '@/game/fiches-champ';
import { partagerLArrivee } from '@/game/affiche-champ';
import { EPREUVE } from '@/game/trace-affiche';
import { Drapeau } from '@/components/Insignes';

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
 *   arrivee           le tableau, du premier au dernier
 */

const OR = '#F8CD4A';

/** Le generique, avant le premier athlete. */
const GENERIQUE_MS = 2400;
/**
 * Chaque athlete. On enchainait en une seconde trois quarts, du temps ou
 * l'on ne lisait qu'un nom et un couloir. Chacun porte maintenant sa fiche —
 * palmares, niveau en duel, bilan —, et elle se lit en trois secondes, comme
 * en direct : la retransmission presente les athletes au meme rythme que le
 * stade.
 */
const PAR_ATHLETE_MS = 3000;

/** Le pas entre deux lignes du tableau, qui tombent du premier au dernier. */
const CASCADE_MS = 130;

function chrono(ms: number | null): string {
  return ms == null ? '—' : (ms / 1000).toFixed(3).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',') + ' s';
}

/** Le coureur du moteur qui occupe ce couloir. */
function coureurDuCouloir(couloir: number) {
  const G = SprinterApp.G;
  return (G.runners || []).find((r: any) => r.lane + 1 === couloir) || null;
}

/* --------------------------------------------------------- la presentation */

function Presentation({ titre, sousTitre, grille, fiches }: {
  titre: string; sousTitre: string; grille: { couloir: number; nom: string; cle?: string }[];
  fiches: (SourceFiches & { epreuve: string }) | null;
}) {
  // −1 : le generique. 0..n−1 : l'athlete. n : fini, le starter prend la main.
  const [index, setIndex] = useState(-1);
  /** Ou en est le creneau de l'athlete du moment, de 0 a 1 : le sablier. */
  const [avancement, setAvancement] = useState(0);
  const debut = useRef(0);
  const designe = useRef(-2);
  const rendu = useRef(false);
  const tendu = !!fiches;

  useEffect(() => {
    debut.current = Date.now();
    designe.current = -2;
    rendu.current = false;
    // Le coeur bat des le generique, lentement ; la musique s'efface.
    if (tendu) ouvrirLaPresentation(GENERIQUE_MS, grille.length * PAR_ATHLETE_MS);
    // Au Championnat de France, la musique du championnat cale ses blocs
    // d'athlete sur ceux-ci (le coeur se tait alors de lui-meme).
    presentationDuRejeu(GENERIQUE_MS, grille.length);

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
          fermerLaPresentation();
          SprinterApp.presenterCoureur(null);
          lancerLeDepartDuRejeu();
        }
        return;
      }
      setIndex(i);
      if (i >= 0) setAvancement((ecoule - GENERIQUE_MS - i * PAR_ATHLETE_MS) / PAR_ATHLETE_MS);
      if (i !== designe.current) {
        designe.current = i;
        // On designe l'athlete au moteur : la camera vient sur lui, il leve
        // les bras, les autres redescendent — et, avec une fiche, elle avance
        // vers lui au rythme du coeur (voir tension-presentation).
        const plan = i >= 0 && tendu ? ouvrirLeCreneau(i, grille.length, PAR_ATHLETE_MS) : undefined;
        SprinterApp.presenterCoureur(i < 0 ? null : coureurDuCouloir(grille[i].couloir), plan);
      }
    };

    battre();
    const t = setInterval(battre, 80);
    return () => {
      clearInterval(t);
      if (tendu) fermerLaPresentation();
      SprinterApp.presenterCoureur(null);
    };
  }, [grille, tendu]);

  // Deja demandees au montage de la piste (voir rejouerCourse) : on relit.
  const fiche = useFiches(fiches, grille.map(g => g.cle || '').filter(Boolean));

  const courant = index >= 0 && index < grille.length ? grille[index] : null;
  const favori = tendu ? favoriDe(grille.map(g => g.cle), fiche) : null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between
                    pt-[max(env(safe-area-inset-top),1rem)]
                    pb-[max(env(safe-area-inset-bottom),1.25rem)]">
      {/* Deux voiles plutot qu'un rideau : la piste reste visible, c'est elle
          qu'on est venu montrer. */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/85 to-transparent" />
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent
                       ${fiches ? 'h-96' : 'h-64'}`} />
      {tendu && <VoilePouls />}
      {tendu && courant && <EclairArrivee cle={courant.couloir} />}

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
          /* Avec une fiche, le bloc descend au-dessus des traits de la
             sequence, comme en direct : centre, il couvrait l'athlete que la
             camera vient cadrer au milieu de l'ecran. */
          <motion.div key={courant.couloir} {...(tendu ? sortieVive(MONTEE) : MONTEE)}
            className={`relative self-center flex flex-col items-center gap-2 px-6 w-full
                        ${fiches ? 'mt-auto mb-3' : ''}`}>
            {tendu && <CouloirGeant couloir={courant.couloir} couleur="rgba(248,205,74,0.34)" />}
            <motion.h2 {...(tendu ? CLAQUE : {})}
              className="relative font-display font-black tracking-tight text-white text-center
                         leading-none text-4xl md:text-6xl break-words max-w-full
                         drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
              {courant.nom}
            </motion.h2>
            {/* Le couloir SOUS le nom, comme en direct : qui, puis ou. */}
            <div className="relative flex items-baseline gap-3">
              {courant.cle && fiche(courant.cle)?.pays && (
                <Drapeau pays={fiche(courant.cle)!.pays} className="text-base" />
              )}
              <span className="font-mono text-sm tracking-[0.35em] text-white/75 font-bold
                               drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {SprinterApp.N.t('pres_lane')} {courant.couloir}
              </span>
            </div>
            {/* Puis ce qu'il a gagne, a quel niveau il se bat, et son bilan. */}
            {fiches && courant.cle && (
              <FichePresentation fiche={fiche(courant.cle)} epreuve={fiches.epreuve}
                                 favori={favori === courant.cle} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ou l'on en est dans la sequence : huit traits qui se remplissent —
          et, avec les fiches, celui du moment qui se vide comme un sablier. */}
      {tendu ? (
        <Sablier n={grille.length} index={index} avancement={avancement} couleur={OR} />
      ) : (
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
      )}
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
 * bout de quatre secondes de COURSE et ne revient pas : passe ce delai, la
 * course s'est etiree et c'est la place qui compte, plus l'identite.
 *
 * QUATRE SECONDES DE COURSE, ET NON QUATRE SECONDES D'ECRAN. Le compte partait
 * du montage du bandeau, c'est-a-dire de la fin de la presentation — trois
 * secondes et demie AVANT le coup de pistolet. Il ne restait donc qu'une
 * demi-seconde de course affichee, exactement a l'instant ou la question « qui
 * est qui » commence a se poser. Le bandeau se regle maintenant sur le chrono
 * du moteur, qui ne bouge pas tant que le pistolet n'a pas tire.
 */
const RAPPEL_MS = 4000;

function RappelCouloirs({ grille }: { grille: { couloir: number; nom: string }[] }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Une horloge plutot qu'un `setTimeout` : le depart ne tombe pas a un
    // instant connu d'ici — le moteur borne le decompte qu'on lui demande — et
    // un onglet passe en arriere-plan etirerait un minuteur.
    const t = setInterval(() => {
      const G: any = SprinterApp.G;
      if ((G.elapsed || 0) * 1000 >= RAPPEL_MS) setVisible(false);
    }, 100);
    return () => clearInterval(t);
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

/* ------------------------------------------------------ le mot du vainqueur */

/**
 * CE QUE LE GAGNANT A DIT AUX AUTRES.
 *
 * Un duel oppose deux personnes et le mot va a celle qui vient de perdre ; une
 * course en oppose huit, et il va aux sept autres. C'est la meme mecanique
 * (voir `mot.ts`, `MotDuel`) avec une seule difference de fond : il ne
 * s'efface pas a la lecture, parce qu'il en reste six qui ne l'ont pas encore
 * ouvert.
 *
 * LA VOIX NE SE TELECHARGE QU'A LA DEMANDE. Six secondes encodees pesent
 * jusqu'a deux cents kilooctets ; les faire voyager avec chaque edition, a
 * chaque ouverture de l'ecran, pour un enregistrement que personne n'ecoutera
 * peut-etre, serait payer cher un silence.
 */
function MotDuGagnant({ mot, course }: {
  mot: MotDuVainqueur;
  course: { edition: string; phase: string; numero: number } | null;
}) {
  const { N } = SprinterApp;
  const [charge, setCharge] = useState(false);

  const ecouter = async () => {
    if (!course || charge) return;
    setCharge(true);
    const v = await voixDuMotDeCourse({
      edition: course.edition, phase: course.phase, course: course.numero,
    });
    if (!v) { setCharge(false); return; }
    try {
      const a = new Audio(urlDeLaVoix(v.voix, v.voix_type));
      a.onended = () => setCharge(false);
      await a.play();
    } catch { setCharge(false); }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5"
         style={{ borderColor: 'rgba(248,205,74,0.35)', background: 'rgba(248,205,74,0.08)' }}>
      <span className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: OR }}>
        {N.t('mot_du_vainqueur')} · {mot.nom}
      </span>
      {mot.texte && (
        <p className="text-[12px] leading-snug text-white/85">« {mot.texte} »</p>
      )}
      {mot.a_voix && (
        <button onClick={ecouter} disabled={charge}
          className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full
                     border border-white/20 bg-white/[0.06] text-[9px] font-bold
                     tracking-[0.2em] active:scale-95 transition disabled:opacity-50">
          {charge ? '…' : N.t('mot_ecouter_voix')}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- l'arrivee */

function Arrivee({ titre, sousTitre, lignes: toutes, course, mot, competition, epreuve, quand }: {
  titre: string; sousTitre: string;
  lignes: { place: number | null; nom: string; ms: number | null; couloir: number | null;
            motif?: string | null }[];
  course: { edition: string; phase: string; numero: number } | null;
  mot: MotDuVainqueur | null;
  competition: string; epreuve: string; quand: number | null;
}) {
  const { N } = SprinterApp;
  // L'image, le releve et le photo-finish ne parlent que des arrives : un
  // carton rouge n'a ni rang ni chrono a y porter. Le tableau, lui, les montre
  // tous (`toutes`).
  const lignes = toutes.filter(r => r.place != null) as
    { place: number; nom: string; ms: number | null; couloir: number | null }[];

  /**
   * LA VIDEO SE PROPOSE ICI, ET PAS TROIS ECRANS PLUS LOIN.
   *
   * Le rejeu filme ce qu'il rejoue, et le bouton de partage n'existait que
   * dans le panneau du championnat : il fallait fermer le tableau, rentrer a
   * l'accueil, rouvrir le championnat et faire defiler pour retrouver la
   * course qu'on venait de regarder. La video se partage dans la minute qui
   * suit l'arrivee ou elle ne se partage pas ; on la pose donc sous le
   * tableau, la ou le regard est deja.
   *
   * La prise porte le genre « direct » (voir `champ-rejeu`), et le composant
   * ne montre rien tant qu'elle n'est pas prete — l'arret de l'enregistreur
   * precede l'ouverture du tableau, mais le montage, lui, prend le temps
   * qu'il prend.
   */
  const film = useFilmDeLaCourse();

  /**
   * LE GAGNANT PEUT CLASHER LES AUTRES — et lui seul, une seule fois.
   *
   * On le reconnait au nom enregistre sur ce telephone, mais ce n'est qu'une
   * politesse d'affichage : le serveur relit lui-meme qui a gagne cette
   * course-la et refuse tout mot venu d'un autre. Un client qui mentirait ici
   * n'obtiendrait qu'un 403.
   *
   * Le bloc ne s'ouvre que sur une course de CHAMPIONNAT : un rejeu lance a la
   * main n'a pas d'edition a qui adresser le mot.
   */
  const [pose, setPose] = useState(false);

  /**
   * L'IMAGE DU RESULTAT, A COTE DE LA VIDEO.
   *
   * Deux gestes differents et non deux versions du meme : on envoie une video
   * a quelqu'un qui va la regarder dix secondes, on poste une image qu'on lit
   * d'un coup d'oeil en faisant defiler. Un jour de competition, le compte a
   * besoin des deux — et elles sortent toutes les deux dans la voix des jours
   * de competition (voir `affiche-champ`).
   */
  const [image, setImage] = useState<'' | 'en cours' | 'faite' | 'ratee'>('');
  const fabriquerLImage = async () => {
    setImage('en cours');
    const r = await partagerLArrivee({
      competition: competition || sousTitre,
      course: titre,
      epreuve: EPREUVE(epreuve),
      quand,
      lignes,
      mot: mot && mot.texte ? { nom: mot.nom, texte: mot.texte } : null,
      etiquetteMot: N.t('mot_du_vainqueur'),
    }, N.getLang() !== 'en');
    setImage(r === 'echec' ? 'ratee' : 'faite');
  };

  /**
   * LE PHOTO-FINISH, ET POURQUOI IL N'EST PAS TOUJOURS LA.
   *
   * Un releve de camera a fente ne sert qu'a departager. Sur une course gagnee
   * d'un dixieme, il ne dirait que ce que le tableau dit deja, en moins clair —
   * et un bouton qui promet un photo-finish sur une arrivee etalee devient un
   * mot creux au bout de deux courses. Il n'apparait donc que si deux places
   * qui se suivent tiennent dans le meme centieme (voir `arriveeSerree`), ce
   * qui est exactement le cas ou un juge va voir l'image.
   *
   * L'ecart affiche sur le bouton dit POURQUOI il est la. Sans lui, personne ne
   * sait pourquoi cette course-ci a droit a une image que la precedente n'avait
   * pas.
   */
  const serree = arriveeSerree(lignes);
  const ecartMs = ecartLePlusSerre(lignes);
  const [releve, setReleve] = useState<'' | 'en cours' | 'fait' | 'rate'>('');
  const fabriquerLeReleve = async () => {
    setReleve('en cours');
    const r = await partagerPhotoFinish({
      competition: competition || sousTitre,
      nomCourse: titre,
      epreuve: EPREUVE(epreuve),
      quand,
      lignes,
    }, N.getLang() !== 'en');
    setReleve(r === 'echec' ? 'rate' : 'fait');
  };

  const moi = (getSavedName() || '').trim().toLowerCase();
  const vainqueur = lignes.find(r => r.place === 1);
  const jaiGagne = !!course && !!moi && !!vainqueur
    && vainqueur.nom.trim().toLowerCase() === moi;

  // LE TABLEAU SE LIT ET SE REMPLIT DANS LE MEME SENS : DU PREMIER AU DERNIER.
  //
  // Il a d'abord ete ecrit a l'envers — le huitieme affiche d'abord, le
  // vainqueur en dernier — pour garder le nom du gagnant pour la fin. Mais
  // c'est une feuille de resultats, pas une remise de medailles : on vient y
  // chercher qui a gagne et en combien, et le regard part en haut. Une
  // cascade qui descend depuis le vainqueur donne cette reponse tout de
  // suite, puis deroule le reste dans l'ordre ou on le lira.
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
          {toutes.map((r, i) => (r.place == null ? (
            <motion.div key={r.nom + (r.motif || '')}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (i * CASCADE_MS) / 1000, duration: 0.22 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                ${r.motif === 'faux_depart' ? 'border-destructive/40 bg-destructive/10' : 'border-white/8 bg-black/30'}`}>
              <span className="font-display font-black text-base w-5 shrink-0 text-white/40">—</span>
              <span className="font-mono text-[10px] w-5 h-5 shrink-0 grid place-items-center
                               rounded border border-white/15 bg-white/[0.04]
                               text-white/50 tabular-nums leading-none">
                {r.couloir ?? '—'}
              </span>
              <span className="flex-1 min-w-0 truncate tracking-wide text-[12px] font-bold">{r.nom}</span>
              <span className={`font-mono text-[12px] font-bold shrink-0
                ${r.motif === 'faux_depart' ? 'text-destructive' : 'text-white/50'}`}>
                {N.t(r.motif === 'faux_depart' ? 'champ_dq' : r.motif === 'forfait' ? 'champ_dns' : 'champ_dnf')}
              </span>
            </motion.div>
          ) : (
            <motion.div key={r.nom + r.place}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (i * CASCADE_MS) / 1000, duration: 0.22 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                ${r.place === 1 ? 'border-primary/60 bg-primary/15'
                  : r.place <= 3 ? 'border-white/15 bg-white/[0.06]'
                  : 'border-white/8 bg-black/30'}`}>
              <span className="font-display font-black text-base w-5 shrink-0 tabular-nums"
                    style={{ color: r.place === 1 ? OR : 'rgba(255,255,255,0.55)' }}>
                {r.place}
              </span>
              {/* LE COULOIR, DANS SA CASE.
                  Deux nombres sur une meme ligne se confondent : la place est
                  en gros et pleine, le couloir est encadre et fin — c'est le
                  meme chiffre, dans la meme graisse, que la liste de depart
                  affichee quatre secondes apres le pistolet (`RappelCouloirs`),
                  pour que l'oeil fasse le lien sans qu'on ait a l'ecrire. */}
              <span className="font-mono text-[10px] w-5 h-5 shrink-0 grid place-items-center
                               rounded border border-white/15 bg-white/[0.04]
                               text-white/50 tabular-nums leading-none">
                {r.couloir ?? '—'}
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
          )))}
        </div>

        {/* CE QU'ON LIT, OU CE QU'ON ECRIT — jamais les deux : un mot pose
            ferme la porte, et le vainqueur relit le sien comme les autres. */}
        {mot ? (
          <MotDuGagnant mot={mot} course={course} />
        ) : jaiGagne && !pose && course ? (
          <LaisserUnMot
            duel="" adversaire=""
            titre={N.t('mot_titre_course')}
            confirme={N.t('mot_envoye_course')}
            poser={m => poserMotDeCourse(
              { edition: course.edition, phase: course.phase, course: course.numero }, m)}
            onPose={() => setPose(true)} />
        ) : null}

        {film.genre === 'direct' && (film.phase === 'prete' || film.phase === 'expiree') && (
          <ReviewVideo etat={film} onPartager={partagerLeFilm} titre={N.t('review_title_rejeu')} />
        )}

        {serree && (
          <button onClick={fabriquerLeReleve} disabled={releve === 'en cours'}
            className="self-center flex items-center gap-2 px-4 py-2 rounded-full
                       border border-primary/40 bg-primary/10 text-primary
                       text-[10px] font-bold tracking-[0.2em]
                       active:scale-95 transition disabled:opacity-50">
            <ScanLine className="w-3.5 h-3.5" />
            {releve === 'fait' ? N.t('champ_image_faite')
              : releve === 'rate' ? N.t('champ_image_ratee')
              : N.t('pf_bouton')}
            {releve === '' && ecartMs != null && (
              <span className="font-mono opacity-70">
                {(ecartMs / 1000).toFixed(3).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',')} s
              </span>
            )}
          </button>
        )}

        <button onClick={fabriquerLImage} disabled={image === 'en cours'}
          className="self-center flex items-center gap-2 px-4 py-2 rounded-full
                     border border-white/20 bg-white/[0.06] text-[10px] font-bold
                     tracking-[0.2em] active:scale-95 transition disabled:opacity-50">
          <ImageIcon className="w-3.5 h-3.5" />
          {image === 'faite' ? N.t('champ_image_faite')
            : image === 'ratee' ? N.t('champ_image_ratee')
            : N.t('champ_image')}
        </button>

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
    return <Presentation titre={etat.titre} sousTitre={etat.sousTitre} grille={etat.grille}
                         fiches={etat.fiches} />;
  }
  if (etat.phase === 'arrivee' && etat.arrivee) {
    return <Arrivee titre={etat.titre} sousTitre={etat.sousTitre} lignes={etat.arrivee}
                    course={etat.course} mot={etat.mot}
                    competition={SprinterApp.G.rejeuBandeau?.competition || etat.sousTitre}
                    epreuve={etat.epreuve}
                    quand={SprinterApp.G.rejeuBandeau?.quand ?? null} />;
  }
  // Pendant la course : le rappel des couloirs, quatre secondes, puis rien —
  // et, si quelqu'un est parti trop tot, la scene du faux depart par-dessus.
  return (
    <>
      <RappelCouloirs grille={etat.grille} />
      {etat.rappel && (
        <RappelEnScene key={etat.rappel.debut} fautifs={etat.rappel.fautifs} moiSorti={false} />
      )}
    </>
  );
}
