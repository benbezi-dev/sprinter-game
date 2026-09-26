import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { MONTEE, FONDU, SURGISSEMENT, RESSORT } from '@/lib/mouvement';
import { Trophy, Loader2, Timer, Flag, Sparkles, Medal, Crown, Play } from 'lucide-react';
import { SprinterApp, buzz } from '@/game/engine';
import {
  lancerCeremonie, useCeremonieChampionnat, ceremonieSurLaPiste,
} from '@/game/ceremonie-championnat';
import { saluerALAccueil } from '@/game/scene-accueil';
import { Drapeau, drapeauDe } from '@/components/Insignes';
import { rejouerCourse, niveauDuLieu } from '@/game/champ-rejeu';
import { entrerEnDirect } from '@/game/champ-direct';
import { EST_TEST } from '@/game/canal';
import { getSavedName } from '@/game/leaderboard';
import { useFilmDeLaCourse, partagerLeFilm } from '@/game/film-course';
import { ReviewVideo } from './ReviewVideo';
import {
  etatEdition, fluxDirect, prochain, grille, arrivee,
  bossVu, marquerBossVu,
  type Edition, type Annonce, type Partant, type TenantEnTitre,
} from '@/game/championnats';

/**
 * Le championnat, tel qu'on le suit.
 *
 * Quatre moments, un seul ecran : la grille de depart, l'avancee dans les
 * phases, la revelation des repeches, et le sacre. Les separer en quatre
 * ecrans aurait oblige le spectateur a naviguer pendant que la competition se
 * joue — or il n'a rien a faire d'autre que regarder.
 *
 * Le fil d'annonces est la seule source de mouvement. On le lit par curseur,
 * et chaque annonce declenche une relecture de l'etat : c'est le serveur qui
 * decide de ce qui s'est passe, jamais l'ecran qui le devine.
 */

const CADENCE_MS = 4000;
const OR = '#F8CD4A';

/** « 2 h 14 min » a partir d'un delai en millisecondes. */
function delai(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${s} s`;
}

// Virgule en francais, point en anglais — comme le tableau d'arrivee du
// direct (`ChampDirect.tsx`), pour qu'un meme chrono s'ecrive pareil partout.
const chrono = (ms: number | null) => ms == null ? '—'
  : (ms / 1000).toFixed(3).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',') + ' s';

/* ------------------------------------------------------------------ phases */

function FilDesPhases({ e }: { e: Edition }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {e.phases.map((p, i) => {
        const passee = i < e.phaseIndex || e.etat === 'terminee';
        const active = i === e.phaseIndex && e.etat !== 'terminee';
        return (
          <React.Fragment key={p.cle}>
            {i > 0 && <span className={`h-px w-4 ${passee ? 'bg-primary/60' : 'bg-white/12'}`} />}
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest border
              ${active ? 'bg-primary/20 text-primary border-primary/50'
                : passee ? 'text-primary/70 border-primary/25'
                : 'text-muted-foreground/50 border-white/8'}`}>
              {SprinterApp.N.phaseNom(p.cle, p.nom)}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------- la grille de depart */

function Couloir({ p, couloir, place, ms, direct, motif }: {
  p: Partant; couloir?: number | null; place?: number | null;
  ms?: number | null; direct: boolean;
  /** Pourquoi il n'a pas de chrono, quand la course a ete courue en direct. */
  motif?: string | null;
}) {
  const couru = place != null;
  // UN CARTON ROUGE N'EST PAS UNE HUITIEME PLACE. Sans chrono, pas de rang :
  // la ligne dit pourquoi, en rouge pour la disqualification.
  const raison = motif === 'faux_depart' ? SprinterApp.N.t('champ_dq')
    : motif === 'forfait' ? SprinterApp.N.t('champ_dns')
    : motif === 'abandon' ? SprinterApp.N.t('champ_dnf') : null;
  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border
      ${couru && direct ? 'bg-primary/12 border-primary/40'
        : couru ? 'bg-black/25 border-white/8'
        : 'bg-black/20 border-white/6'}`}>
      <span className={`font-mono text-[10px] w-4 shrink-0 tabular-nums
        ${couru ? 'text-primary' : 'text-muted-foreground/60'}`}>
        {couru ? (raison ? '—' : place) : '·'}
      </span>
      {/* LE COULOIR, QUE LA COURSE A FAIT DISPARAITRE.
          Avant la course, les lignes SONT les couloirs : elles sont dans cet
          ordre-la et le numero se compte tout seul. Des que la course est
          courue, la liste se retrie par le chrono et cette lecture est
          perdue — « qui etait dans le 5 » n'a plus de reponse, ni ici ni sur
          le rejeu. On l'ecrit donc, et seulement une fois la course courue :
          avant, ce serait un chiffre de plus qui repete la position. */}
      {couru && (
        <span className="font-mono text-[9px] w-4 h-4 shrink-0 grid place-items-center
                         rounded border border-white/12 bg-white/[0.04]
                         text-muted-foreground/70 tabular-nums leading-none">
          {couloir ?? '—'}
        </span>
      )}
      <Drapeau pays={p.pays} className="text-[12px]" />
      <span className="text-[11px] font-bold tracking-wide truncate flex-1 text-foreground">
        {p.nom}
      </span>
      {/* Le tenant du titre, sur sa ligne. Il est seme au MMR comme tout le
          monde et peut donc tomber dans n'importe quelle serie : sans ce sigle,
          rien ne distingue le champion en titre du vingt-septieme. */}
      {p.tenant && (
        <span className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded
                         border text-[8px] font-black tracking-widest"
              style={{ color: OR, borderColor: 'rgba(248,205,74,0.45)',
                       backgroundColor: 'rgba(248,205,74,0.12)' }}>
          <Crown className="w-2.5 h-2.5" />
          {SprinterApp.N.t('champ_tenant')}
        </span>
      )}
      {p.rang_duel != null && !couru && (
        <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
          {SprinterApp.N.ord(p.rang_duel)}
        </span>
      )}
      {couru && (
        <span className={`font-mono text-[10px] tabular-nums shrink-0
          ${motif === 'faux_depart' ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
          {raison || chrono(ms ?? null)}
        </span>
      )}
      {couru && direct && (
        <span className="text-[8px] font-bold tracking-widest text-primary shrink-0">Q</span>
      )}
    </div>
  );
}

function Grille({ e }: { e: Edition }) {
  const courses = grille(e);
  if (!courses.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {courses.map(({ course, couloirs }) => {
        const fin = arrivee(e, e.phase, course);
        const places = new Map(fin.map((r, i) => [r.name_key, { place: i + 1, ms: r.ms, motif: r.motif }]));
        const courue = fin.length > 0;
        // LE COULOIR SE DERIVE ICI, ET NULLE PART AILLEURS.
        //
        // Le serveur ne le stocke pas — il l'a dit explicitement : « le
        // couloir se derive du rang de semis a l'affichage, et le deriver deux
        // fois serait deux occasions de ne plus dire la meme chose » (voir
        // championnats.js). `couloirs` arrive deja trie par rang de duel ; sa
        // position EST le couloir. C'est cette table qui alimente a la fois la
        // ligne du tableau et le rejeu, pour qu'ils ne puissent pas diverger.
        const couloirDe = new Map(couloirs.map((p, i) => [p.name_key, i + 1]));
        // L'HEURE DE CETTE COURSE-LA, prise au calendrier de l'edition.
        //
        // Elle part avec le rejeu et s'affiche en en-tete de la video (voir
        // `bandeau-rejeu`). Une course numerotee a son propre rendez-vous ;
        // une phase qui n'en a qu'un — la finale — le porte sans numero. On
        // essaie donc le numero d'abord, puis la phase seule, et on se tait
        // si le calendrier ne dit rien plutot que d'annoncer une heure qui
        // serait celle d'une autre course.
        const rv = (e.calendrier || []).find(r => r.phase === e.phase && r.course === course)
                || (e.calendrier || []).find(r => r.phase === e.phase && r.course == null);
        // Le mot que le vainqueur de CETTE course a laisse, s'il l'a fait.
        const mot = (e.mots || []).find(m => m.phase === e.phase && m.course === course) || null;
        return (
          <div key={course} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                {SprinterApp.N.courseNom(e.phase, course, e.courses, e.phaseNom)}
              </span>
              {courue && e.directsParCourse > 0 && (
                <span className="text-[9px] text-primary/70 tracking-wide">
                  {SprinterApp.N.t('champ_directs', { n: e.directsParCourse })}
                </span>
              )}
            </div>
            {(courue
              ? fin.map(r => e.partants.find(p => p.name_key === r.name_key)!).filter(Boolean)
              : couloirs
            ).map((p, i) => {
              const r = places.get(p.name_key);
              return (
                <Couloir key={p.name_key} p={p}
                         couloir={couloirDe.get(p.name_key)}
                         place={r?.place} ms={r?.ms} motif={r?.motif}
                         direct={!!r && r.ms != null && r.place <= e.directsParCourse} />
              );
            })}
            {/* DEUX LIBELLES QUI PARTENT AVEC LA VIDEO.
                `competition` : `e.titre` est compose par le serveur et reste
                en francais ; `titreEdition` est la forme qui suit la langue du
                joueur (voir sprinter-i18n).
                `titre` : « Série 3 », « Demi-finale 1 », « Finale » — au
                singulier et avec son numero, parce que c'est UNE course de la
                phase et non la phase entiere. */}
            {!courue && rv && (
              <BoutonDirect e={e} course={course} at={rv.at}
                partant={couloirs.some(p => p.name_key === (getSavedName() || '').trim().toLowerCase())} />
            )}
            {courue && (
              <BoutonRevoir
                epreuve={e.epreuve} arrivees={fin} couloirs={couloirDe}
                competition={SprinterApp.N.titreEdition(e) || e.titre}
                quand={rv ? rv.at : null}
                course={{ edition: e.id, phase: e.phase, numero: course }}
                mot={mot && { nom: mot.nom, texte: mot.texte, a_voix: mot.a_voix }}
                lieu={e.lieu}
                fr={e.echelon === 'national' && e.zone === 'FR'}
                titre={SprinterApp.N.courseNom(e.phase, course, e.courses, e.phaseNom)}
                sousTitre={`${SprinterApp.N.titreEdition(e) || e.titre} · ${e.epreuve} M`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------- la course en direct */

/** La chambre d'appel ouvre un quart d'heure avant ; la course se manque a +2 min. */
const OUVERTURE_DIRECT_MS = 15 * 60 * 1000;
const RETARD_DIRECT_MS = 2 * 60 * 1000;

/**
 * Une course qui n'a pas encore eu lieu se court — ou se regarde — en direct,
 * a son heure. Le partant entre dans le stade ; les autres y entrent aussi,
 * en spectateurs : la salle sait qui est qui, l'ecran ne fait que proposer.
 *
 * Sur le canal de test, le bouton reste la une fois l'heure passee : les
 * editions d'essai sont datees au hasard, et leurs courses se lancent a la
 * main (`/champ/salle/.../lancer`).
 */
function BoutonDirect({ e, course, at, partant }: {
  e: Edition; course: number; at: number; partant: boolean;
}) {
  const maintenant = Date.now();
  if (maintenant < at - OUVERTURE_DIRECT_MS) return null;
  if (!EST_TEST && maintenant > at + RETARD_DIRECT_MS) return null;
  const entrer = () => entrerEnDirect(e.id, e.phase, course,
    { epreuve: e.epreuve, lieu: e.lieu, echelon: e.echelon, zone: e.zone });
  return (
    <button onClick={entrer}
      className={`mt-1 self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full border
                  text-[10px] font-bold tracking-widest active:scale-95 transition
                  ${partant ? 'border-destructive/60 bg-destructive/15 text-destructive'
                            : 'border-primary/40 bg-primary/10 text-primary'}`}>
      <Play className="w-3 h-3" />
      {SprinterApp.N.t(partant ? 'champ_entrer' : 'champ_regarder_dir')}
    </button>
  );
}

/* ------------------------------------------------------- revoir la course */

/**
 * Une course courue se regarde.
 *
 * Le championnat n'echange que des chronos ; la piste, elle, est deja dans le
 * telephone. Huit chronos suffisent donc a rejouer la course — voir
 * `champ-rejeu`. Rien ne se telecharge, et l'ecart d'arrivee est exactement
 * celui que le tableau affiche au-dessus.
 *
 * La camera suit le joueur s'il courait cette course-la, et le vainqueur
 * sinon : on ne cadre pas un inconnu quand on regarde une finale.
 */
function BoutonRevoir({ epreuve, arrivees, couloirs, competition, quand, course, mot, lieu, titre, sousTitre, fr }: {
  /** Championnat de France : le rejeu joue la musique du championnat. */
  fr?: boolean;
  epreuve: string;
  arrivees: { name_key: string; nom: string; ms: number | null;
              motif?: 'faux_depart' | 'abandon' | 'forfait' | null; motif_ms?: number | null }[];
  /** Le couloir de chacun, derive du rang de semis par `Grille`. */
  couloirs: Map<string, number>;
  /** « Championnat de France » — l'en-tete que la video portera. */
  competition: string;
  /** L'heure de la course au calendrier, ou `null` s'il ne la dit pas. */
  quand: number | null;
  /** A quelle course adresser le mot du vainqueur. */
  course: { edition: string; phase: string; numero: number };
  /** Le mot deja pose, s'il y en a un. */
  mot: { nom: string; texte: string | null; a_voix: boolean } | null;
  /** Le lieu impose par l'edition, s'il y en a un. */
  lieu?: string | null;
  titre: string;
  sousTitre: string;
}) {
  if (!arrivees.length) return null;
  const moi = (getSavedName() || '').trim().toLowerCase();
  const revoir = () => {
    rejouerCourse(
      epreuve,
      // LE COULOIR PART AVEC LE CHRONO.
      //
      // `arrivees` est trie par le chrono. Sans le couloir, le rejeu posait
      // donc les coureurs sur la piste DANS L'ORDRE D'ARRIVEE — le vainqueur
      // au couloir 1, le deuxieme au 2 — et le tableau de fin, qui affiche ce
      // couloir, n'aurait fait que repeter la place sous un autre nom. Une
      // course se regarde avec ses couloirs a leur place.
      arrivees.map(r => ({
        nom: r.nom, cle: r.name_key,
        ms: r.ms, motif: r.motif ?? null, motif_ms: r.motif_ms ?? null,
        couloir: couloirs.get(r.name_key),
        moi: !!moi && r.name_key === moi,
      })),
      3500, true, { titre, sousTitre, competition, quand, course, mot, lieu, fr },
    );
  };
  return (
    <button onClick={revoir}
      className="mt-1 self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 border border-primary/40 bg-primary/10 text-primary
                 text-[10px] font-bold tracking-widest active:scale-95 transition">
      <Play className="w-3 h-3" />
      {SprinterApp.N.t('champ_revoir')}
    </button>
  );
}

/* ------------------------------------------------ la revelation des repeches */

/**
 * Le seul moment de la competition ou le suspense est fabrique plutot que
 * couru : les repeches n'ont gagne aucune course, ils sortent du classement de
 * toutes. On les fait donc apparaitre un par un — sans cela, l'information la
 * plus attendue du weekend tomberait comme une ligne de tableau.
 */
function Revelation({ a, onFini }: { a: Annonce; onFini: () => void }) {
  const { N } = SprinterApp;
  const repeches: {
    nom: string; ms: number | null; course: number; doffice?: boolean;
    motif?: 'chrono' | 'doffice' | 'priorite' | 'place_libre' | 'organisation';
  }[] = (a.donnees && a.donnees.repeches) || [];
  const [montres, setMontres] = useState(0);

  useEffect(() => {
    if (montres >= repeches.length) return;
    const t = setTimeout(() => setMontres(m => m + 1), montres === 0 ? 900 : 700);
    return () => clearTimeout(t);
  }, [montres, repeches.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#05070d]"
         style={{ backgroundImage:
           'radial-gradient(120% 80% at 50% 35%, rgba(248,205,74,0.06), transparent 70%)' }}>
      <motion.div {...MONTEE}
                  className="w-full max-w-sm flex flex-col items-center gap-4">
        <Sparkles className="w-5 h-5" style={{ color: OR }} />
        <h2 className="font-display font-black tracking-widest text-center text-lg"
            style={{ color: OR }}>
          {N.t('champ_reveal')}
        </h2>
        <p className="text-[11px] text-white/50 text-center leading-snug max-w-[26ch]">
          {N.t('champ_reveal_desc')}
        </p>

        <div className="w-full flex flex-col gap-1.5 mt-1">
          {repeches.slice(0, montres).map((r, i) => (
            <motion.div key={r.nom + i}
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={RESSORT.panneau}
              className="flex items-center gap-3 px-3 py-2 rounded-xl
                         bg-primary/12 border border-primary/35">
              <span className="font-mono text-[10px] text-primary/70 w-4">{i + 1}</span>
              {/* Le nom, et dessous POURQUOI il passe, en quelques mots : depuis
                  le 26/09 un repeche peut aussi entrer pour completer la grille,
                  ou par decision de l'organisation — ce que le chrono seul ne
                  dit pas. Les annonces d'avant ne portent pas de motif : on les
                  lit comme avant (d'office, sinon au chrono). */}
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-bold text-sm tracking-wide truncate text-foreground">
                  {r.nom}
                </span>
                <span className="text-[9px] tracking-wide text-muted-foreground truncate">
                  {N.t('champ_rep_' + (r.motif || (r.doffice ? 'doffice' : 'chrono')))}
                </span>
              </span>
              {/* Une place prise par un titre n'est pas une place prise au
                  chrono, et l'ecran doit le dire. Le taire ferait passer un
                  passe-droit pour un repechage merite — c'est la seule chose
                  qui rendrait cette regle injuste aux yeux des sept autres. */}
              {r.doffice ? (
                <span className="text-[9px] font-bold tracking-wide shrink-0" style={{ color: OR }}>
                  {N.t('champ_repeche_doffice')}
                </span>
              ) : (
                r.ms != null && (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {chrono(r.ms)}
                  </span>
                )
              )}
            </motion.div>
          ))}
        </div>

        {montres >= repeches.length && (
          <motion.button {...FONDU}
            onClick={onFini}
            className="mt-3 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                       text-background text-sm"
            style={{ backgroundColor: OR }}>
            {N.t('champ_continue')}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------- l'entree en lice du tenant */

/**
 * LA CINEMATIQUE DU CHAMPION EN TITRE.
 *
 * Elle se joue une fois par edition, a la cloture : l'instant ou le tenant du
 * titre entre en lice et ou l'on sait enfin qui, parmi les trente-deux, a
 * quelque chose a perdre.
 *
 * Elle passe par la meme porte que ses deux soeurs — le fil d'annonces
 * declenche, l'ecran met en scene — et non par un chemin qu'elle serait seule a
 * prendre. C'est ce qui garantit qu'un joueur qui rouvre l'application ne la
 * revoit pas : le rattrapage du curseur marque les annonces passees comme vues
 * sans les rejouer, et cela vaut pour celle-ci sans une ligne de plus.
 *
 * Ce que le serveur envoie et ce que cet ecran en fait sont deux choses. Le
 * serveur dit : voici le tenant, son titre, sa serie, et il est en finale
 * d'office. Rien de tout cela n'est recalcule ici — pas meme la phrase « en
 * finale d'office », qui arrive comme un drapeau et non comme une regle a
 * reappliquer.
 */
function Boss({ t, e, onFini }: { t: TenantEnTitre; e: Edition; onFini: () => void }) {
  const { N } = SprinterApp;
  const partant = e.partants.find(p => p.name_key === t.name_key);
  const pays = partant ? partant.pays : null;

  // La scene se ferme d'elle-meme. Un bouton « continuer » conviendrait a la
  // revelation des repeches — huit noms qu'on lit — mais pas ici : il n'y a
  // qu'un nom, et le faire valider transformerait une entree en lice en
  // formulaire.
  //
  // LE MINUTEUR NE DOIT PAS DEPENDRE DE `onFini`, et c'est tout l'objet de ce
  // detour par une reference. L'ecran parent porte une horloge qui avance
  // toutes les secondes pour son compte a rebours ; il se rerend donc chaque
  // seconde, et la lambda qu'il passe ici est neuve a chaque fois. Un effet qui
  // en dependait relancait son minuteur une fois par seconde : la scene ne se
  // fermait jamais, et restait sur l'ecran pour toujours.
  //
  // Ses deux soeurs n'ont pas ce probleme parce qu'elles se ferment sur un
  // bouton, jamais sur un delai. Celle-ci est la seule a s'auto-fermer, donc la
  // seule exposee.
  const fermer = useRef(onFini);
  fermer.current = onFini;
  useEffect(() => {
    const t = setTimeout(() => fermer.current(), 5200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#05070d]"
         style={{ backgroundImage:
           'radial-gradient(120% 80% at 50% 40%, rgba(248,205,74,0.10), transparent 70%)' }}>
      <motion.div {...SURGISSEMENT}
                  className="w-full max-w-sm flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={RESSORT.panneau}>
          <Crown className="w-8 h-8" style={{ color: OR }} />
        </motion.div>

        <p className="text-[10px] font-black tracking-[0.3em] text-center"
           style={{ color: OR }}>
          {N.t('champ_boss')}
        </p>

        {/* Le nom, seul et grand. C'est la seule information de cet ecran qui
            doive se lire d'un coup d'oeil depuis l'autre bout d'une piece. */}
        <h2 className="font-display font-black text-3xl tracking-tight text-center
                       flex items-center justify-center gap-2 text-foreground">
          <Drapeau pays={pays} className="text-2xl" />
          {t.nom}
        </h2>

        {t.libelle && (
          <p className="text-[11px] font-bold tracking-widest uppercase text-white/55 text-center">
            {t.libelle}
          </p>
        )}

        <p className="text-[11px] text-white/50 text-center leading-snug max-w-[28ch] mt-1">
          {N.t('champ_boss_desc')}
        </p>

        {/* Les deux faits qui changent sa competition : sa serie, et le fait
            qu'aucun resultat ne l'en sortira. */}
        <div className="flex flex-col items-center gap-1.5 mt-2 w-full">
          {t.course != null && (
            <span className="text-[10px] font-mono tracking-widest text-white/45">
              {/* `sel_ma_serie` et non le nom de la phase : celui-ci est au
                  pluriel (« Séries »), et « Séries 2 » n'est pas du francais.
                  C'est la meme cle que la scene de selection affiche deux
                  secondes plus tot — le joueur lit donc deux fois la meme
                  phrase, ce qui est exactement ce qu'on veut. */}
              {N.t('sel_ma_serie', { n: t.course })}
            </span>
          )}
          {t.finaleDOffice && (
            <motion.span {...FONDU}
              className="px-3 py-1.5 rounded-lg border text-[9px] font-black tracking-widest"
              style={{ color: OR, borderColor: 'rgba(248,205,74,0.45)',
                       backgroundColor: 'rgba(248,205,74,0.12)' }}>
              {N.t('champ_boss_finale')}
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- le podium */

function Podium({ e, onFerme }: { e: Edition; onFerme: () => void }) {
  const { N } = SprinterApp;
  const fin = arrivee(e, 'finale', 1);
  const trois = fin.slice(0, 3);
  // Le pays de chacun : sur un podium continental ou mondial, c'est la moitie
  // de ce qu'on regarde.
  const paysDe = (cle: string) =>
    e.partants.find(p => p.name_key === cle)?.pays || null;
  const paysDuChampion = trois[0] ? paysDe(trois[0].name_key) : null;
  // L'ordre visuel d'un podium : deuxieme, premier, troisieme.
  const ordre = [trois[1], trois[0], trois[2]].filter(Boolean);
  const hauteurs = [64, 96, 48];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6
                    bg-[#05070d]"
         style={{ backgroundImage:
           'radial-gradient(120% 80% at 50% 30%, rgba(248,205,74,0.07), transparent 70%)' }}>
      <motion.div {...SURGISSEMENT}
                  className="w-full max-w-sm flex flex-col items-center gap-5">
        <Trophy className="w-7 h-7" style={{ color: OR }} />
        <div className="text-center">
          {/* Sur l'ecran du sacre, la distance compte autant que la zone :
              c'est d'elle qu'on est champion. */}
          <p className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-1">
            {SprinterApp.N.titreEdition(e)} · {e.epreuve} m
          </p>
          <h2 className="font-display font-black text-3xl tracking-tight flex items-center justify-center gap-2"
              style={{ color: OR }}>
            <Drapeau pays={paysDuChampion} className="text-2xl" />
            {e.champion}
          </h2>
        </div>

        {/* L'etiquette de chaque marche (medaille, nom, chrono) est posee
            AU-DESSUS d'elle, en `-top-11` : 44 px hors de la boite. La marge
            du haut les reserve. Avec 28 px seulement, l'etiquette de la
            marche 1 — la plus haute — montait dans le titre, et la medaille
            d'or se posait sur le nom du champion. */}
        <div className="flex items-end justify-center gap-2 w-full mt-10">
          {ordre.map((r, i) => {
            const rang = trois.indexOf(r) + 1;
            return (
              <motion.div key={r.name_key}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: hauteurs[i], opacity: 1 }}
                transition={{ ...RESSORT.jauge, delay: 0.25 + i * 0.18 }}
                className="flex-1 flex flex-col justify-end items-center rounded-t-lg border-t border-x
                           px-1 pb-2 relative"
                style={{
                  borderColor: rang === 1 ? OR : 'rgba(255,255,255,0.14)',
                  background: rang === 1
                    ? 'linear-gradient(to top, rgba(248,205,74,0.22), rgba(248,205,74,0.05))'
                    : 'rgba(255,255,255,0.05)',
                }}>
                <span className="absolute -top-11 flex flex-col items-center gap-0.5 w-full">
                  <Medal className="w-3.5 h-3.5"
                         style={{ color: rang === 1 ? OR : rang === 2 ? '#CBD5E1' : '#B45309' }} />
                  <span className="flex items-center gap-1 max-w-full px-1">
                    <Drapeau pays={paysDe(r.name_key)} className="text-[11px]" />
                    <span className="text-[10px] font-bold tracking-wide truncate text-foreground">
                      {r.nom}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                    {chrono(r.ms)}
                  </span>
                </span>
                <span className="font-display font-black text-lg"
                      style={{ color: rang === 1 ? OR : 'rgba(255,255,255,0.5)' }}>
                  {rang}
                </span>
              </motion.div>
            );
          })}
        </div>

        <p className="text-[10px] text-white/35 text-center mt-2">
          {N.t('champ_titre_duree')}
        </p>
        <button onClick={onFerme}
          className="mt-1 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background text-sm"
          style={{ backgroundColor: OR }}>
          {N.t('champ_continue')}
        </button>
      </motion.div>
    </div>
  );
}


/* ------------------------------------------------- le sacre sur la piste */

/**
 * La ceremonie.
 *
 * Un podium n'est pas un tableau de resultats : le classement est deja lisible
 * a l'ecran d'arrivee, et le refaire ici n'apprendrait rien a personne. Ce que
 * cet ecran doit produire, c'est le moment — d'ou une sequence qui se deroule
 * plutot qu'un etat qui s'affiche : les marches montent du bas dans l'ordre du
 * suspense (bronze, argent, or), chaque plaque arrive quand sa marche s'est
 * posee, et le nom du champion ne tombe qu'apres, seul, quand plus rien ne
 * bouge autour.
 *
 * Deux regles tenues du bout a l'autre :
 *
 *  - **Aucune hauteur n'est animee.** Les marches montent par `translateY`
 *    derriere un `overflow-hidden` : le navigateur ne recalcule pas la mise en
 *    page a chaque image, et surtout le contenu de la marche ne s'ecrase pas
 *    comme le ferait un `scaleY`.
 *  - **Les plaques sont dans le flux.** L'ancienne version les posait en
 *    `absolute -top-11`, donc la mise en page ne leur reservait aucune place :
 *    la marche du vainqueur faisant 96 px, sa plaque remontait dans le nom du
 *    champion et les deux s'ecrivaient l'un sur l'autre. Une colonne est
 *    desormais une pile — plaque, puis marche — et le chevauchement ne peut
 *    plus revenir, quelle que soit la hauteur des marches.
 */

/** La hauteur d'une marche, et le moment ou elle se leve. */
const MARCHE = {
  1: { hauteur: 132, retard: 1.30 },
  2: { hauteur: 96,  retard: 0.90 },
  3: { hauteur: 66,  retard: 0.55 },
} as const;

const METAL = { 1: OR, 2: '#CBD5E1', 3: '#B45309' } as const;

/** La hauteur reservee aux plaques. Fixe : les trois colonnes s'alignent. */
const PLAQUE_H = 74;

function PodiumSurLaPiste({ e, onFerme }: { e: Edition; onFerme: () => void }) {
  const { N } = SprinterApp;
  const doux = useReducedMotion();
  // Sur un ecran qui refuse le mouvement, la ceremonie n'a pas lieu : tout est
  // deja pose. Rien n'est retire pour autant — le podium se lit entier.
  const t = (secondes: number) => (doux ? 0 : secondes);

  const fin = arrivee(e, 'finale', 1);
  const trois = fin.slice(0, 3);

  /**
   * LE SACRE SE TIENT DANS LE STADE DE L'EDITION.
   *
   * La piste qu'on voit derriere le podium est celle que l'accueil a construite
   * — l'etape de la carriere, le plus souvent. Une edition qui impose son lieu
   * (`lieu` de /champ/edition : le Champ-de-Mars pour le premier Championnat de
   * France) y a couru toutes ses courses, en direct comme au rejeu ; son titre
   * doit s'y remettre aussi. On construit donc ce stade a l'ouverture, et l'on
   * remet celui d'avant a la fermeture.
   *
   * L'epreuve de l'accueil, elle, ne change pas. La camera de l'accueil tient
   * sa place par epreuve (voir `placerLaCameraDeLAccueil`) et ne peut pas la
   * remesurer pendant que l'ecran-titre est efface : changer d'epreuve ici
   * laisserait un ecran sans stade.
   *
   * Un lieu que ce jeu ne connait pas ne deplace rien : on reste ou l'on est
   * plutot que d'aller au stade olympique de `niveauDuLieu`.
   */
  useEffect(() => {
    const G: any = SprinterApp.G;
    const ici = niveauDuLieu(e.lieu);
    if (!G || !e.lieu || SprinterApp.LEVELS?.[ici]?.cle !== e.lieu) return;
    const avant = G.levelIdx;
    if (avant === ici) return;
    SprinterApp.buildLevel(ici);
    return () => {
      if (G.state === 'title' && G.levelIdx === ici) SprinterApp.buildLevel(avant);
    };
  }, [e.lieu]);

  /**
   * Un athlete salue sur la piste, derriere le podium.
   *
   * La piste de l'accueil a sa propre meute — trois coureurs dessines par
   * `scene-accueil`, et non les partants d'une course — et c'est elle qu'on
   * voit quand l'ecran-titre s'efface. Le coureur du milieu leve donc les bras
   * pendant que les marches montent, et les baisse a la fermeture.
   */
  useEffect(() => {
    saluerALAccueil(1);
    return () => { saluerALAccueil(null); };
  }, []);

  /**
   * Le son et la secousse, cales sur les marches.
   *
   * Trois petites secousses qui montent — bronze, argent, or — puis le son de
   * victoire au moment ou la marche d'or se pose. L'escalier s'entend autant
   * qu'il se voit, et sur un telephone tenu en main c'est la secousse, pas
   * l'image, qui fait sursauter.
   *
   * `sfx` passe par le melangeur du jeu : coupe le son du jeu, la ceremonie
   * se tait avec lui. La secousse suit `prefers-reduced-motion`, qui vaut
   * aussi pour ce qu'on sent.
   */
  useEffect(() => {
    if (doux) { try { SprinterApp.Audio_.sfx('win'); } catch { /* muet */ } return; }
    const rendez = [
      { a: (MARCHE[3].retard + 0.62) * 1000, faire: () => buzz(10) },
      { a: (MARCHE[2].retard + 0.62) * 1000, faire: () => buzz(14) },
      { a: (MARCHE[1].retard + 0.62) * 1000, faire: () => {
          buzz(32); try { SprinterApp.Audio_.sfx('win'); } catch { /* muet */ } } },
    ];
    const t = rendez.map(r => setTimeout(r.faire, r.a));
    return () => t.forEach(clearTimeout);
  }, [doux]);

  // Le pays de chacun : sur un podium continental ou mondial, c'est la moitie
  // de ce qu'on regarde.
  const paysDe = (cle: string) =>
    e.partants.find(p => p.name_key === cle)?.pays || null;
  const paysDuChampion = trois[0] ? paysDe(trois[0].name_key) : null;
  // L'ordre visuel d'un podium : deuxieme, premier, troisieme.
  const ordre = [trois[1], trois[0], trois[2]].filter(Boolean);

  // Les paillettes sont tirees une fois pour toutes : recalculees a chaque
  // rendu, elles sauteraient d'une position a l'autre au premier battement du
  // fil d'annonces, qui continue de tourner derriere la ceremonie.
  const paillettes = React.useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const h = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      x: h(1) * 100,
      taille: 3 + h(2) * 4,
      retard: 1.45 + h(3) * 1.1,
      duree: 2.4 + h(4) * 1.8,
      tour: (h(5) - 0.5) * 540,
      or: h(6) > 0.35,
    };
  }), []);

  // Le partage de l'ecran, qui est tout le sujet.
  //
  // Piste et ceremonie superposees se genent : le trophee tombait sur la tete
  // d'un athlete et le titre passait sur le rouge des couloirs, illisible. On
  // les separe donc en hauteur — le stade en haut, la ceremonie en bas, sur du
  // noir. C'est l'idee des deux voiles de la presentation d'avant-course : ne
  // montrer du jeu que la bande qui sert.
  //
  // Le degrade est porte par la BANDE, pas par l'ecran. En pourcentages de
  // l'ecran il tombait juste sur un grand telephone et faux sur un petit :
  // a 360 x 640 la ceremonie, qui mesure ce qu'elle mesure, remontait dans la
  // partie claire et le titre repassait sur le rouge des couloirs. Ancre au
  // contenu, le fondu se place toujours juste au-dessus du trophee, quelle que
  // soit la hauteur de l'ecran.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center
                    backdrop-blur-[1px] overflow-hidden"
         style={{ backgroundColor: 'rgba(5,7,13,0.34)' }}>
      <div className="w-full flex justify-center px-6 pt-24
                      pb-[max(env(safe-area-inset-bottom),1.5rem)]"
           style={{ backgroundImage: [
             'radial-gradient(120% 70% at 50% 60%, rgba(248,205,74,0.10), transparent 72%)',
             // Des arrets en PIXELS, pas en pourcentages. En pourcentages, le
             // fondu se dilate avec la bande : sur un ecran court la bande
             // occupe presque tout, le fondu s'etale, et le trophee se retrouve
             // encore dans le clair. En pixels il fait toujours 120 px et finit
             // juste au-dessus du trophee, a 360 x 640 comme a 390 x 844.
             'linear-gradient(to bottom, rgba(5,7,13,0) 0px, rgba(5,7,13,0.72) 44px,' +
             ' rgba(5,7,13,0.95) 82px, rgb(5,7,13) 124px)',
           ].join(', ') }}>

      {/* La lueur qui respire. Elle ne dit rien, elle empeche seulement le fond
          d'etre une surface morte pendant les trois secondes ou l'on regarde. */}
      {!doux && (
        <motion.div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage:
            'radial-gradient(65% 45% at 50% 62%, rgba(248,205,74,0.16), transparent 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.62, 0.9] }}
          transition={{ delay: 1.2, duration: 6, times: [0, 0.2, 0.6, 1], repeat: Infinity }} />
      )}

      {/* Les paillettes tombent une fois, pas en boucle : une chute perpetuelle
          derriere un ecran qui attend un appui devient un papier peint. */}
      {!doux && (
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          {paillettes.map((p, i) => (
            <motion.span key={i} className="absolute top-0 rounded-[1px]"
              style={{
                left: `${p.x}%`, width: p.taille, height: p.taille * 2.2,
                backgroundColor: p.or ? OR : 'rgba(255,255,255,0.75)',
              }}
              initial={{ y: -30, opacity: 0, rotate: 0 }}
              animate={{ y: '105vh', opacity: [0, 1, 1, 0], rotate: p.tour }}
              transition={{ delay: p.retard, duration: p.duree, ease: 'linear',
                            opacity: { times: [0, 0.08, 0.75, 1], duration: p.duree } }} />
          ))}
        </div>
      )}

      {/* Un seul balayage, a l'instant ou la marche d'or se pose. Repete, il
          deviendrait un effet ; une fois, il marque le moment. */}
      {!doux && (
        <motion.div aria-hidden
          className="absolute inset-y-0 w-40 pointer-events-none"
          style={{ left: 0, backgroundImage:
            'linear-gradient(100deg, transparent, rgba(255,246,210,0.13), transparent)' }}
          initial={{ x: '-40vw', opacity: 0 }}
          animate={{ x: '110vw', opacity: [0, 1, 1, 0] }}
          transition={{ delay: 1.62, duration: 0.95, ease: 'easeOut',
                        opacity: { times: [0, 0.15, 0.7, 1], duration: 0.95 } }} />
      )}

      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: t(0.35) }}
                  className="relative w-full max-w-sm flex flex-col items-center">

        <motion.div initial={{ opacity: 0, y: -14, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: t(0.15), type: 'spring', stiffness: 260, damping: 16 }}>
          <Trophy className="w-7 h-7" style={{ color: OR }} />
        </motion.div>

        <motion.p className="text-[10px] tracking-[0.3em] text-white/40 uppercase mt-4 text-center"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: t(0.35), duration: t(0.4) }}>
          {/* Sur l'ecran du sacre, la distance compte autant que la zone :
              c'est d'elle qu'on est champion. */}
          {SprinterApp.N.titreEdition(e)} · {e.epreuve} m
        </motion.p>

        {/* Le nom arrive apres les trois marches : il est la conclusion de la
            sequence, pas son titre. Le reflet qui le traverse une fois est ce
            qui fait la difference entre « affiche en dore » et « sacre ». */}
        <motion.div className="flex items-center justify-center gap-2 mt-1 min-h-[2.6rem]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: t(1.75), duration: t(0.5), ease: [0.25, 0.46, 0.45, 0.94] }}>
          <Drapeau pays={paysDuChampion} className="text-2xl" />
          <motion.h2 className="font-display font-black text-3xl tracking-tight text-center"
            style={doux ? { color: OR } : {
              backgroundImage: `linear-gradient(100deg, ${OR} 0%, ${OR} 38%, #FFF6D2 50%, ${OR} 62%, ${OR} 100%)`,
              backgroundSize: '260% 100%', backgroundPosition: '160% 0%',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}
            animate={doux ? undefined : { backgroundPosition: ['160% 0%', '-60% 0%'] }}
            transition={{ delay: t(2.05), duration: 1.4, ease: 'easeInOut' }}>
            {e.champion}
          </motion.h2>
        </motion.div>

        <div className="flex items-end justify-center gap-2 w-full mt-4">
          {ordre.map(r => {
            const rang = (trois.indexOf(r) + 1) as 1 | 2 | 3;
            const { hauteur, retard } = MARCHE[rang];
            return (
              <div key={r.name_key} className="flex-1 flex flex-col items-center justify-end">

                {/* La plaque, dans le flux et a hauteur fixe : les trois se
                    lisent sur la meme ligne quelles que soient les marches. */}
                <motion.div
                  className="flex flex-col items-center justify-end gap-0.5 w-full px-0.5 pb-2"
                  style={{ height: PLAQUE_H }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: t(retard + 0.34), duration: t(0.4) }}>
                  <Medal className="w-3.5 h-3.5 shrink-0" style={{ color: METAL[rang] }} />
                  <span className="flex items-center gap-1 max-w-full">
                    <Drapeau pays={paysDe(r.name_key)} className="text-[11px]" />
                    <span className="text-[10px] font-bold tracking-wide truncate text-foreground">
                      {r.nom}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                    {chrono(r.ms)}
                  </span>
                </motion.div>

                {/* La marche. Le cadre garde la hauteur finale des le depart —
                    c'est lui qui reserve la place — et le bloc monte dedans. */}
                <div className="w-full overflow-hidden" style={{ height: hauteur }}>
                  <motion.div
                    className="h-full flex items-end justify-center rounded-t-lg border-t border-x pb-2"
                    style={{
                      borderColor: rang === 1 ? OR : 'rgba(255,255,255,0.14)',
                      background: rang === 1
                        ? 'linear-gradient(to top, rgba(248,205,74,0.22), rgba(248,205,74,0.05))'
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: rang === 1 ? `0 0 24px -6px ${OR}55` : undefined,
                    }}
                    initial={{ y: '100%' }} animate={{ y: '0%' }}
                    transition={{ delay: t(retard), duration: t(0.62),
                                  ease: [0.16, 0.84, 0.34, 1] }}>
                    <span className="font-display font-black text-lg"
                          style={{ color: rang === 1 ? OR : 'rgba(255,255,255,0.5)' }}>
                      {rang}
                    </span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Le sol. Sans lui les marches s'arretent sur un bord net et paraissent
            coupees plutot que posees. Le reflet en dessous fait le reste : c'est
            lui, et pas la ligne, qui donne une matiere au sol. */}
        <motion.div aria-hidden
          className="h-px w-full max-w-[19rem] bg-gradient-to-r from-transparent via-white/28 to-transparent"
          initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: t(0.5), duration: t(0.5) }} />
        <motion.div aria-hidden
          className="w-full max-w-[19rem] h-10 -mt-px pointer-events-none"
          style={{ backgroundImage:
            'radial-gradient(60% 100% at 50% 0%, rgba(248,205,74,0.20), transparent 72%)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: t(1.9), duration: t(0.8) }} />

        <motion.p className="text-[10px] text-white/35 text-center mt-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: t(2.3), duration: t(0.4) }}>
          {N.t('champ_titre_duree')}
        </motion.p>

        <motion.button onClick={onFerme}
          className="mt-3 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background text-sm"
          style={{ backgroundColor: OR }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(2.45), duration: t(0.4) }}>
          {N.t('champ_continue')}
        </motion.button>
      </motion.div>
      </div>
    </div>
  );
}

/**
 * La ceremonie, montee par App et non par le panneau.
 *
 * Elle ne rend rien tant que personne ne l'a declaree ; c'est ce qui permet de
 * la poser inconditionnellement a cote des autres calques.
 */
export function CeremonieChampionnat() {
  const c = useCeremonieChampionnat();
  return (
    <AnimatePresence>
      {c && <PodiumSurLaPiste key={c.edition.id} e={c.edition} onFerme={c.onFini} />}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------- l'entracte */

/**
 * CE QUI SE PASSE ENTRE DEUX COURSES.
 *
 * Le defaut que cet ecran avait, et que toute competition d'athletisme a :
 * entre deux series il ne se passe rien. On avait un chronometre qui descend
 * et quatre lignes de fil qui ne bougent plus. Un stade fait mieux que ca — il
 * presente les engages, il rappelle qui defend son titre, il ressort le
 * meilleur chrono du tour.
 *
 * L'entracte ne fabrique AUCUNE information. Il n'y a pas une donnee ici qui
 * ne soit deja dans `Edition` : le tenant, les partants, leurs pays, les
 * chronos deja courus. C'est deliberé — une animation qui invente du contenu
 * pour meubler se voit au deuxieme passage, et ce qu'on regarde entre deux
 * courses doit rester la competition, pas un habillage pose dessus.
 *
 * Il ne parait QUE s'il reste du temps. A moins de trente secondes du depart,
 * le compte a rebours redevient la seule chose interessante de l'ecran, et lui
 * passer des cartes devant serait le cacher au moment ou il compte.
 */

const ENTRACTE_MS = 6000;
const ENTRACTE_SEUIL_S = 30;

type Carte = { cle: string; haut: string; bas: string; fort?: string };

/**
 * Les cartes de l'entracte, dans l'ordre ou elles se presentent.
 *
 * L'ordre n'est pas decoratif : on ouvre sur le tenant du titre parce que
 * c'est l'enjeu, et on finit sur le meilleur chrono parce que c'est la barre a
 * battre a la course suivante. Ce qui manque de donnees ne produit pas de
 * carte — une carte vide serait pire que pas de carte.
 */
function cartesDe(e: Edition): Carte[] {
  const { N } = SprinterApp;
  const c: Carte[] = [];

  if (e.tenant && e.etat !== 'terminee') {
    c.push({
      cle: 'tenant',
      haut: N.t('entracte_tenant'),
      fort: e.tenant.nom,
      bas: e.tenant.finaleDOffice ? N.t('champ_boss_finale') : e.tenant.libelle,
    });
  }

  // Les nations en lice. Elle ne parait qu'a partir de deux pays : « 1 pays
  // represente » sur un championnat national est une evidence ecrite en gros.
  const pays = new Map<string, number>();
  for (const p of e.partants) if (p.pays) pays.set(p.pays, (pays.get(p.pays) || 0) + 1);
  if (pays.size >= 2) {
    const tete = [...pays.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    c.push({
      cle: 'nations',
      haut: N.t('entracte_nations'),
      fort: String(pays.size),
      bas: tete.map(([k, n]) => `${drapeauDe(k) || k.toUpperCase()} ${n}`).join('   '),
    });
  }

  // Le meilleur chrono couru depuis le debut de l'edition. C'est la barre.
  const best = e.resultats.filter(r => r.ms != null)
    .sort((a, b) => (a.ms as number) - (b.ms as number))[0];
  if (best) {
    const qui = e.partants.find(p => p.name_key === best.name_key);
    c.push({
      cle: 'chrono',
      haut: N.t('entracte_chrono'),
      fort: chrono(best.ms),
      bas: qui ? qui.nom : '',
    });
  }

  // Combien restent en lice, et combien sont deja sortis. Le chiffre dit
  // l'entonnoir mieux qu'une phrase.
  const restants = e.partants.filter(p => !p.sorti_en).length;
  if (restants && restants < e.partants.length) {
    c.push({
      cle: 'restants',
      haut: N.t('entracte_restants'),
      fort: String(restants),
      bas: N.t('entracte_sortis', { n: String(e.partants.length - restants) }),
    });
  }

  return c;
}

function Entracte({ e, secondes }: { e: Edition; secondes: number }) {
  const cartes = cartesDe(e);
  const [i, setI] = useState(0);

  // Le carrousel ne tourne que s'il y a plus d'une carte a montrer. Une seule
  // carte qui se remplace par elle-meme toutes les six secondes est un
  // clignotement, pas une animation.
  useEffect(() => {
    if (cartes.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % cartes.length), ENTRACTE_MS);
    return () => clearInterval(t);
  }, [cartes.length]);

  if (!cartes.length || secondes < ENTRACTE_SEUIL_S) return null;
  const carte = cartes[i % cartes.length];

  return (
    <div className="relative h-[58px] overflow-hidden rounded-xl bg-black/25 border border-white/8">
      <AnimatePresence mode="wait">
        <motion.div
          key={carte.cle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={FONDU}
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-3"
        >
          <span className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground/70">
            {carte.haut}
          </span>
          <span className="flex items-baseline gap-2 max-w-full">
            {carte.fort && (
              <span className="font-display font-black tracking-tight text-base leading-none truncate"
                    style={{ color: OR }}>
                {carte.fort}
              </span>
            )}
            <span className="text-[10px] text-foreground/60 truncate">{carte.bas}</span>
          </span>
        </motion.div>
      </AnimatePresence>
      {/* Les temoins de progression : ils disent qu'il y a autre chose a voir,
          et que ca tourne tout seul. Sans eux, une carte qui change surprend. */}
      {cartes.length > 1 && (
        <div className="absolute bottom-1 inset-x-0 flex justify-center gap-1">
          {cartes.map((c, k) => (
            <span key={c.cle} className="h-[2px] rounded-full transition-all"
                  style={{
                    width: k === i % cartes.length ? 10 : 4,
                    backgroundColor: k === i % cartes.length ? OR : 'rgba(255,255,255,0.2)',
                  }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ l'ecran */

export function Championnat({ edition, onQuitter }: {
  edition: string; onQuitter?: () => void;
}) {
  const { N } = SprinterApp;
  const [e, setE] = useState<Edition | null>(null);
  const [fil, setFil] = useState<Annonce[]>([]);
  const [revelation, setRevelation] = useState<Annonce | null>(null);
  const [boss, setBoss] = useState(false);
  const [podium, setPodium] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());

  /**
   * LA VIDEO DE LA COURSE QU'ON VIENT DE REVOIR.
   *
   * Le rejeu filme ce qu'il rejoue (voir `champ-rejeu`) et rentre ici. La
   * prise porte le genre « direct », partage avec le salon du meme nom : on ne
   * montre donc le bouton que lorsqu'elle est prete.
   */
  const film = useFilmDeLaCourse();
  const curseur = useRef(0);
  const vu = useRef(new Set<number>());

  // L'horloge locale, pour le compte a rebours du prochain rendez-vous.
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Le fil commande tout : chaque annonce provoque une relecture de l'etat.
  // C'est le serveur qui dit ce qui s'est passe, jamais l'ecran qui le devine.
  useEffect(() => {
    let vivant = true;
    const battre = async () => {
      const f = await fluxDirect(curseur.current);
      if (!vivant || !f) return;
      if (f.annonces.length) {
        curseur.current = f.curseur;
        const miennes = f.annonces.filter(a => a.edition === edition);
        if (miennes.length) {
          setFil(v => [...miennes.reverse(), ...v].slice(0, 30));
          const etat = await etatEdition(edition);
          if (vivant && etat) setE(etat);
          for (const a of miennes) {
            if (vu.current.has(a.id)) continue;
            vu.current.add(a.id);
            if (a.type === 'reveal-demies' || a.type === 'reveal-finale') setRevelation(a);
            // L'annonce `boss` ne declenche RIEN ici, et ce n'est pas un oubli :
            // elle est emise a la cloture, l'instant meme ou ce panneau
            // apparait, si bien que personne n'a l'ecran ouvert pour la
            // recevoir. Elle sert la notification et le fil ; la scene, elle,
            // se declenche sur l'etat — voir l'effet plus bas.
            if (a.type === 'sacre') setPodium(true);
          }
        }
      }
    };
    // Premiere lecture : on prend l'etat, puis on se cale sur la FIN du fil.
    //
    // « La fin » demande une boucle, et c'est le piege : le serveur repond par
    // pages, si bien qu'une seule requete laisse le curseur au milieu de
    // l'historique. Les annonces suivantes arrivent alors comme si elles
    // etaient nouvelles — a l'ouverture, l'ecran rejouait la revelation des
    // repeches d'un championnat termine il y a des jours, dans un autre pays.
    (async () => {
      const etat = await etatEdition(edition);
      if (vivant && etat) setE(etat);
      for (let page = 0; page < 40; page++) {
        const f = await fluxDirect(curseur.current);
        if (!vivant || !f) return;
        f.annonces.forEach(a => vu.current.add(a.id));
        if (!f.annonces.length || f.curseur === curseur.current) break;
        curseur.current = f.curseur;
      }
    })();
    const t = setInterval(battre, CADENCE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [edition]);

  // L'ENTREE EN LICE DU TENANT. Une fois par edition et par appareil.
  //
  // Sur l'etat et non sur le fil, parce que l'annonce arrive avant que cet
  // ecran existe (voir `bossVu`). La memoire est marquee au declenchement et
  // non a la fermeture : un rechargement au milieu de la scene ne doit pas la
  // rejouer, et une scene manquee vaut mieux qu'une scene en boucle.
  useEffect(() => {
    if (!e || !e.tenant || e.etat === 'terminee') return;
    if (bossVu(e.id)) return;
    marquerBossVu(e.id);
    setBoss(true);
  }, [e]);

  /**
   * On declare la ceremonie plutot que de la rendre.
   *
   * La jouer ici la condamnerait a rester dans le panneau, donc par-dessus le
   * menu, donc sans la piste derriere. Elle est donc confiee au module qui la
   * porte, et l'ecran-titre s'efface pendant qu'elle dure — ce panneau compris.
   * D'ou le fait qu'on lui passe `e` en entier : quand elle joue, plus personne
   * ici ne peut lui repondre.
   *
   * Rien ne se rejoue au remontage : le curseur du fil est deja cale sur la fin
   * et toutes les annonces passees sont marquees vues.
   *
   * Et surtout : **on ne l'annule pas au demontage**. Declarer la ceremonie
   * efface l'ecran-titre, donc ce panneau, donc le nettoyage de cet effet — qui
   * l'annulait dans la foulee, ramenait le menu, remontait le panneau, et ainsi
   * de suite. L'ecran clignotait sans jamais rien montrer. Une fois lancee, la
   * ceremonie ne s'arrete que par sa propre sortie.
   *
   * Tant que `ceremonieSurLaPiste()` est faux, rien de tout cela : le podium se
   * joue dans le panneau, plus bas, comme il l'a toujours fait.
   */
  const declaree = useRef(false);
  useEffect(() => {
    if (!e || boss || revelation || !podium || e.etat !== 'terminee') return;
    if (!ceremonieSurLaPiste() || declaree.current) return;
    declaree.current = true;
    lancerCeremonie({
      edition: e,
      onFini: () => { lancerCeremonie(null); declaree.current = false; setPodium(false); },
    });
  }, [e, boss, revelation, podium]);

  if (!e) {
    return (
      <div className="bg-card/70 border border-white/10 rounded-2xl p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rv = prochain(e.calendrier, maintenant);

  return (
    <>
      {/* Trois scenes, et jamais deux a la fois. L'ordre n'est pas celui du
          hasard : l'entree en lice passe avant tout le reste puisqu'elle ouvre
          la competition, le podium apres tout le reste puisqu'il la ferme. */}
      <AnimatePresence>
        {boss && e.tenant && (
          <Boss t={e.tenant} e={e} onFini={() => setBoss(false)} />
        )}
        {!boss && revelation && (
          <Revelation a={revelation} onFini={() => setRevelation(null)} />
        )}
        {!boss && !revelation && podium && e.etat === 'terminee' && !ceremonieSurLaPiste() && (
          <Podium e={e} onFerme={() => setPodium(false)} />
        )}
      </AnimatePresence>

      <motion.div
        {...MONTEE}
        className="bg-card/70 backdrop-blur-xl border rounded-2xl p-4 md:p-5 shadow-2xl
                   flex flex-col gap-4"
        style={{ borderColor: 'rgba(248,205,74,0.28)' }}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" style={{ color: OR }} />
            <h3 className="text-[10px] md:text-xs font-bold tracking-widest" style={{ color: OR }}>
              {SprinterApp.N.titreEdition(e).toUpperCase()}
            </h3>
            {/* La distance se lit a cote du titre, et pas dedans : le titre est
                deja accorde par le serveur (« Championnat de France »)
                et on ne recolle pas du texte au milieu d'une phrase faite. */}
            <span className="text-[10px] md:text-xs font-mono font-bold tracking-widest
                             text-foreground/55">
              {e.epreuve} M
            </span>
          </div>
          {e.etat === 'terminee' && e.champion && (
            <button onClick={() => setPodium(true)}
                    className="text-[11px] font-bold tracking-wide text-primary underline-offset-2 hover:underline">
              {N.t('champ_sacre', { n: e.champion })}
            </button>
          )}
          {/* Le tenant du titre, tant que l'edition court.
              La cinematique ne passe qu'une fois, a la cloture : celui qui
              ouvre l'ecran le dimanche matin ne l'a jamais vue, et c'est
              pourtant la premiere chose a savoir sur ce championnat. */}
          {e.etat !== 'terminee' && e.tenant && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide"
                  style={{ color: OR }}>
              <Crown className="w-3 h-3" />
              {N.t('champ_tenant_defend', { n: e.tenant.nom })}
            </span>
          )}
        </div>

        <FilDesPhases e={e} />

        {/* Le prochain rendez-vous. Le calendrier est en UTC et s'affiche a
            l'heure d'ici : « le meme weekend partout » n'a de sens que sur une
            horloge commune, mais personne ne veut lire UTC. */}
        {rv && e.etat !== 'terminee' && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl
                          bg-black/30 border border-white/8">
            <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <Timer className="w-3.5 h-3.5" />
              {rv.reveal ? N.t('champ_rv_reveal')
                : rv.ceremonie ? N.t('champ_rv_sacre')
                : N.t('champ_rv_course')}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: OR }}>
              {delai(rv.at - maintenant)}
            </span>
          </div>
        )}

        {/* L'entracte : entre deux courses, le stade continue de parler. */}
        {rv && e.etat !== 'terminee' && (
          <Entracte e={e} secondes={(rv.at - maintenant) / 1000} />
        )}

        {film.genre === 'direct' && (film.phase === 'prete' || film.phase === 'expiree') && (
          <ReviewVideo etat={film} onPartager={partagerLeFilm} />
        )}

        <Grille e={e} />

        {/* Le fil, en petit : ce qui vient de se passer, dans l'ordre inverse. */}
        {fil.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-white/8">
            {fil.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-baseline gap-2">
                <Flag className="w-2.5 h-2.5 shrink-0 mt-1" style={{ color: OR, opacity: 0.7 }} />
                <span className="text-[10px] text-muted-foreground leading-snug">
                  <span className="text-foreground/80 font-bold">{a.titre}</span>
                  {a.texte ? ' — ' + a.texte : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {onQuitter && (
          <button onClick={onQuitter}
                  className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {N.t('champ_quitter')}
          </button>
        )}
      </motion.div>
    </>
  );
}
