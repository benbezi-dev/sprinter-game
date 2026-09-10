import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VOILE, PANNEAU, MONTEE, FONDU, SURGISSEMENT, TRANSITION, RESSORT, retarde, useAnimationsReduites } from '@/lib/mouvement';
import { Flag, Trophy, ChevronRight } from 'lucide-react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { Drapeau } from '@/components/Insignes';
import { getSavedName } from '@/game/leaderboard';
import { maSelection, restant, type MaSelection } from '@/game/championnats';

/* ---------------------------------------------------------------------------
   LA SÉLECTION, VUE DU JEU
   ---------------------------------------------------------------------------
   Deux écrans, et ils ne racontent pas la même chose parce qu'ils ne tombent
   pas au même moment. La clôture de la sélection coupe le temps en deux, et
   c'est elle qui décide de ce qu'il y a à dire :

   - AVANT, le classement bouge encore. Jouer change quelque chose, et la seule
     phrase qui compte est l'écart : « tu es 41e, il te manque 9 places ». Ça
     vit dans une banderole permanente sur l'accueil — discrète, consultable,
     jamais bloquante.

   - APRÈS, le classement ne décide plus de rien : la grille est gelée. Il n'y
     a plus d'écart à combler, il y a un verdict. Ça mérite qu'on arrête le
     jeu, UNE fois.

   Pourquoi pas la scène tout le temps. Une scène plein écran répétée à chaque
   ouverture devient une publicité qu'on tape pour passer — le jeu a déjà
   appris ce réflexe à ses joueurs avec les cinématiques et leur « touche à
   nouveau pour passer ». L'interruption plein écran est une monnaie : elle
   vaut quelque chose exactement une fois, quand il y a une nouvelle.

   Pourquoi pas la banderole seule. Elle est bonne en ambiance et incapable de
   porter le moment où la nouvelle est grosse. « Tu es dans la grille, série 3 »
   ne se glisse pas dans un bandeau de deux lignes sur un écran d'accueil.
--------------------------------------------------------------------------- */

/** Le nombre de places, le rang, l'écart : tout vient du serveur, rien d'ici. */
function useMaSelection() {
  const [s, setS] = useState<MaSelection | null>(null);
  // Le décompte s'affiche à la seconde près à la fin, à la journée près au
  // début. Un état qui n'existe que pour forcer le rendu : la valeur affichée
  // se recalcule depuis `s.cloture`, jamais depuis un compteur qu'on
  // décrémenterait — un compteur dérive quand l'onglet passe en arrière-plan,
  // une soustraction sur l'horloge ne dérive pas.
  const [, battement] = useState(0);
  const dernier = useRef(0);

  const demander = React.useCallback(() => {
    const nom = getSavedName();
    if (!nom) return;
    dernier.current = Date.now();
    maSelection(nom).then(r => { if (r) setS(r); });
  }, []);

  useEffect(() => { demander(); }, [demander]);

  useEffect(() => {
    const id = setInterval(() => {
      battement(n => n + 1);
      // On ne sonde pas le serveur en boucle pour un décompte qui se calcule
      // tout seul. Une seule chose justifie de redemander : l'heure de clôture
      // est passée et le serveur dit encore que rien n'est gelé — le cron a
      // jusqu'à cinq minutes de retard, et c'est le moment où l'écran doit
      // basculer sans qu'on recharge le jeu.
      const s0 = s;
      if (!s0 || s0.gele || s0.cloture == null) return;
      if (Date.now() < s0.cloture) return;
      if (Date.now() - dernier.current < 60_000) return;
      demander();
    }, 30_000);
    return () => clearInterval(id);
  }, [s, demander]);

  return s;
}

/**
 * Le temps qu'il reste, d'autant plus précis qu'il en reste peu.
 *
 * « 8 j » suffit quand l'échéance est loin — le joueur veut savoir s'il a le
 * temps, pas à quelle minute. Elle se resserre en approchant : « 1 j 6 h »,
 * puis « 6 h 20 min », parce qu'à ce moment-là la question devient « est-ce
 * que je peux encore faire un duel ce soir » et qu'une réponse à la journée
 * près n'y répond plus.
 *
 * Jamais de secondes. Un compte à rebours qui défile attire l'oeil sur
 * lui-même, et dans la dernière minute il n'y a de toute façon plus rien à
 * faire — sauf regarder tourner un chiffre, ce qui n'est pas le but.
 */
function decompte(echeance: number | null): string | null {
  const r = restant(echeance);
  if (!r) return null;
  const { N } = SprinterApp;
  if (r.jours >= 2) return N.t('sel_j', { n: r.jours });
  if (r.jours === 1) return N.t('sel_jh', { n: 1, h: r.heures });
  if (r.heures >= 6) return N.t('sel_h', { n: r.heures });
  if (r.heures > 0) return N.t('sel_hmin', { n: r.heures, m: r.minutes });
  return N.t('sel_min', { n: Math.max(1, r.minutes) });
}

/** Vrai quand l'échéance mérite qu'on la regarde : moins de deux jours. */
const presse = (echeance: number | null) => {
  const r = restant(echeance);
  return !!r && r.jours < 2;
};

/**
 * Un instant dans le fuseau du joueur : « mercredi 16 sept., 02:00 ».
 *
 * Le jour ET l'heure, toujours les deux. La clôture tombe à minuit UTC, soit
 * 02:00 à Paris : dire « mercredi » sans l'heure laisserait croire à une
 * journée entière de mercredi, alors qu'il s'agit de la nuit de mardi à
 * mercredi. C'est l'écart qui rendrait l'échéance injuste, et le seul remède
 * est de l'écrire.
 */
function dateLocale(at: number | null, avecDate = true): string | null {
  if (at == null) return null;
  try {
    return new Date(at).toLocaleString(SprinterApp.N.getLang() === 'en' ? 'en-GB' : 'fr-FR', {
      weekday: 'long',
      ...(avecDate ? { day: 'numeric', month: 'short' } : {}),
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/** L'heure d'une convocation : le jour et l'heure suffisent, la date non. */
const heureLocale = (at: number | null) => dateLocale(at, false);

/* -------------------------------------------------------------- le décompte */

/**
 * La pastille du temps restant.
 *
 * Elle s'allume — bordure et chiffre en or, souffle lent — sous les deux
 * jours. Pas avant : une pastille qui clignote pendant douze jours n'est plus
 * un signal, c'est un décor, et le jour où elle voudra dire quelque chose
 * personne ne la verra. L'urgence ne se dépense qu'une fois.
 *
 * Le souffle s'arrête si le joueur a demandé moins d'animations : un compte à
 * rebours qui bat dans le coin de l'écran est exactement ce que ce réglage
 * existe pour supprimer.
 */
function Decompte({ reste, urgent }: { reste: string; urgent: boolean }) {
  const { N } = SprinterApp;
  const reduit = useAnimationsReduites();
  return (
    <motion.span
      {...SURGISSEMENT}
      className={`shrink-0 flex flex-col items-center justify-center rounded-xl border px-2.5 py-1.5
        ${urgent
          ? 'border-primary/60 bg-primary/[0.12]'
          : 'border-white/12 bg-black/30'}`}
      {...(urgent && !reduit
        ? { animate: { opacity: [1, 0.62, 1] }, transition: TRANSITION.battement }
        : {})}
    >
      <span className={`text-[8px] font-bold tracking-[0.18em] uppercase leading-none
        ${urgent ? 'text-primary/80' : 'text-muted-foreground/70'}`}>
        {N.t('sel_reste')}
      </span>
      <span className={`font-mono font-black tabular-nums leading-tight whitespace-nowrap
                        text-[13px] md:text-sm
        ${urgent ? 'text-primary' : 'text-foreground/90'}`}>
        {reste}
      </span>
    </motion.span>
  );
}

/* ------------------------------------------------------------- la banderole */

/**
 * La banderole de l'accueil.
 *
 * Elle parle à qui n'est PAS sélectionné, et c'est sa raison d'être. Jusqu'ici
 * le championnat n'existait que pour ses trente-deux partants — `ChampPanel`
 * n'affiche rien à qui n'y est pas engagé, et son commentaire le justifie :
 * « un championnat auquel on n'est pas engagé n'est pas une fonctionnalité,
 * c'est du bruit sur l'accueil ». C'était vrai d'un bandeau qui aurait annoncé
 * une date et une règle. Ce n'est plus vrai d'un bandeau qui dit au joueur
 * combien de places le séparent de la grille.
 *
 * Ce qu'elle ne dit jamais : « joue plus ». Le classement récompense les
 * victoires et pas les parties — enchaîner les duels contre plus faible que
 * soi ne rapproche de rien. Promettre le contraire serait mentir sur ce que le
 * jeu mesure.
 */
export function BanderoleSelection({ onVoir }: { onVoir?: () => void }) {
  const s = useMaSelection();
  const { N } = SprinterApp;

  // Rien à dire : pas de nom, pas de championnat annoncé dans ce pays, ou un
  // pays qui n'en tient pas. On disparaît plutôt que d'annoncer une échéance
  // qui n'existe pas.
  if (!s || !s.edition) return null;

  const pays = s.pays;
  const reste = decompte(s.cloture);
  const nom = s.titre || N.t('sel_titre');

  // Trois situations, trois phrases. Elles se lisent de haut en bas dans
  // l'ordre où elles deviennent vraies pour un joueur : pas de pays, pas
  // classé, puis un rang et un écart.
  const ligne = !pays
    ? N.t('sel_pas_de_pays')
    : s.rang == null
      ? N.t('sel_pas_classe')
      : s.retenu
        ? (s.gele ? N.t('sel_dedans_fige') : N.t('sel_dedans'))
        : s.manque === 1
          ? N.t('sel_manque_1')
          : N.t('sel_manque_n', { n: s.manque ?? 0 });

  const dedans = !!s.retenu && !!pays && s.rang != null;
  const cliquable = dedans && s.gele && !!onVoir;
  const Balise: any = cliquable ? 'button' : 'div';

  return (
    <motion.div {...MONTEE}>
      <Balise
        {...(cliquable ? { onClick: onVoir } : {})}
        className={`w-full rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-left
          ${dedans
            ? 'border-primary/60 bg-primary/[0.10]'
            : 'border-white/15 bg-black/40'}
          ${cliquable ? 'hover:bg-primary/[0.16] transition-colors' : ''}`}
      >
        {dedans
          ? <Trophy className="w-5 h-5 text-primary shrink-0" />
          : <Flag className="w-5 h-5 text-foreground/50 shrink-0" />}

        <div className="flex-1 min-w-0 flex flex-col">
          <span className="flex items-center gap-1.5 min-w-0">
            <Drapeau pays={pays} className="text-[12px]" />
            <span className={`text-[9px] font-bold tracking-[0.22em] uppercase truncate
              ${dedans ? 'text-primary' : 'text-foreground/70'}`}>
              {nom}
            </span>
          </span>

          <span className={`font-bold text-sm md:text-base leading-tight
            ${dedans ? 'text-primary' : 'text-foreground'}`}>
            {ligne}
          </span>

          {/* La deuxième ligne : ce qu'il reste à faire, ou ce qui est décidé.
              Avant le gel c'est le rang et l'ÉCHÉANCE EN TOUTES LETTRES — le
              décompte relatif vit dans la pastille à droite, celle-ci dit
              quand. Les deux sont nécessaires : « 8 j » ne permet pas de
              décider quand jouer, « mercredi 02:00 » ne dit pas si c'est loin.
              Après le gel, c'est sa série. */}
          <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
            {s.gele
              ? (dedans && s.course
                  ? `${N.t('sel_ma_serie', { n: s.course.numero })} · ${heureLocale(s.course.at) || ''}`
                  : N.t('sel_prochaine'))
              : s.rang == null
                ? (pays ? N.t('sel_pour_entrer') : N.t('sel_places', { n: s.places }))
                : `${N.t('sel_tu_es', { r: N.ord(s.rang) })} · ${
                    dateLocale(s.cloture)
                      ? N.t('sel_le', { d: dateLocale(s.cloture) })
                      : N.t('sel_ferme')}`}
          </span>
        </div>

        {/* À droite : le décompte tant que la sélection est ouverte, l'accès au
            championnat une fois qu'elle est close. Jamais les deux — ce sont
            les deux moitiés du même moment, et il n'y en a qu'une de vraie à
            la fois. */}
        {!s.gele && reste
          ? <Decompte reste={reste} urgent={presse(s.cloture)} />
          : cliquable && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold
                             uppercase tracking-widest text-primary">
              {N.t('sel_voir')} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}
      </Balise>
    </motion.div>
  );
}

/* --------------------------------------------------- la barre du classement */

/**
 * Où tracer la ligne de sélection dans le classement des duels.
 *
 * C'est la pièce qui manquait, et je la crois plus efficace que les deux
 * autres réunies : le joueur ne lit pas une règle, il se voit neuf lignes sous
 * une barre, avec une horloge en haut de l'écran. Une règle se comprend, une
 * position se ressent.
 *
 * Rend la clé de la ligne après laquelle tracer, ou `null` — et `null` veut
 * dire « ne trace rien », jamais « trace au hasard ». Trois raisons de ne rien
 * tracer, et chacune vaut mieux qu'une barre approximative :
 *
 *   - aucun championnat annoncé dans ce pays : il n'y a pas de sélection ;
 *   - la sélection est close : le classement du jour ne décide plus de rien ;
 *   - le dernier qualifié n'est pas dans les lignes visibles — le classement
 *     s'arrête aux 500 premiers du monde, et un pays peut avoir son 32e
 *     au-delà.
 *
 * La position vient du serveur (`barre`) et jamais d'un comptage local : voir
 * le champ dans `MaSelection`.
 *
 * `epreuve` est la discipline du classement affiché, et c'est une quatrième
 * raison de ne rien tracer : les niveaux ne sont pas partagés, une édition se
 * court sur UNE distance, et sa barre n'a de sens que dans le classement de
 * cette distance-là. Tracée dans celui du 400 m, la barre d'un championnat du
 * 100 m désignerait des gens qui ne courent pas — et le rang lu au-dessus
 * d'elle serait celui d'une autre course.
 */
export function useBarreSelection(rows: { name: string }[], epreuve?: string) {
  const s = useMaSelection();
  return React.useMemo(() => {
    if (!s || !s.edition || !s.pays || s.gele || !s.barre) return null;
    if (epreuve && s.epreuve && s.epreuve !== epreuve) return null;
    const visible = rows.some(r => r.name.trim().toLowerCase() === s.barre);
    if (!visible) return null;
    return { apres: s.barre, titre: s.titre, places: s.places, cloture: s.cloture };
  }, [s, rows, epreuve]);
}

/** La ligne elle-même : un trait, un nom, un décompte. */
export function LigneSelection({ barre }: {
  barre: { titre: string | null; places: number; cloture: number | null };
}) {
  const { N } = SprinterApp;
  const reste = decompte(barre.cloture);
  const quand = dateLocale(barre.cloture);
  const urgent = presse(barre.cloture);
  return (
    <motion.div {...FONDU} className="flex items-center gap-2 py-1.5 px-1 select-none">
      <span className="h-px flex-1 bg-primary/50" />
      <span className="flex flex-col items-center shrink-0">
        <span className="text-[8px] md:text-[9px] font-bold tracking-[0.2em] text-primary uppercase">
          {N.t('sel_barre')}
          {reste && <span className={`ml-1.5 ${urgent ? 'text-primary' : 'text-muted-foreground'}`}>
            {N.t('sel_ferme_dans', { n: reste })}
          </span>}
        </span>
        <span className="text-[8px] text-muted-foreground/80 text-center leading-tight">
          {N.t('sel_barre_desc', { t: barre.titre || '', n: barre.places })}
          {/* L'échéance datée sous la barre. C'est ici qu'un joueur compare sa
              ligne aux autres, donc c'est ici qu'il décide s'il a le temps
              d'aller chercher un duel — et « dans 8 j » ne suffit pas pour ça. */}
          {quand && <span className="block">{N.t('sel_le', { d: quand })}</span>}
        </span>
      </span>
      <span className="h-px flex-1 bg-primary/50" />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ la scène */

const VUE = 'sprinter.selection.vue';

/** Les verdicts déjà montrés, par édition. */
function dejaVue(edition: string): boolean {
  try {
    const brut = localStorage.getItem(VUE);
    return !!brut && JSON.parse(brut).includes(edition);
  } catch { return false; }
}

function marquerVue(edition: string) {
  try {
    const brut = localStorage.getItem(VUE);
    const liste: string[] = brut ? JSON.parse(brut) : [];
    if (!liste.includes(edition)) liste.push(edition);
    // On ne garde que les dernières : une liste qui grandit sans fin dans le
    // stockage local finirait par ne plus tenir, et un verdict de l'an dernier
    // n'a plus à être retenu — l'édition qui le portait est terminée.
    localStorage.setItem(VUE, JSON.stringify(liste.slice(-12)));
  } catch { /* stockage refusé : la scène repassera, ce n'est pas grave */ }
}

/**
 * La scène du gel. Une fois par édition, et seulement s'il y a une nouvelle.
 *
 * « Y a-t-il une nouvelle » a une réponse exacte et gratuite : le serveur ne
 * garde en archive de clôture que les trente-deux retenus et les quelques
 * suivants. Donc après le gel, un `rang` non nul veut dire « tu étais dans la
 * zone où ça se jouait » — qualifié, ou battu de peu. Au-delà, le serveur
 * répond `null` et on n'affiche rien : « tu n'y es pas, 200e » n'est pas une
 * nouvelle, c'est du bruit, et la banderole le dit déjà pour qui veut le lire.
 *
 * Posée sur l'accueil et nulle part ailleurs. Interrompre quelqu'un qui vient
 * de lancer une course pour lui parler de samedi prochain, c'est lui prendre
 * la seule chose qu'il était venu faire.
 */
export function SceneSelection() {
  const { state } = useGameStore();
  const { N } = SprinterApp;
  const s = useMaSelection();
  const [ouvert, setOuvert] = useState(false);
  const decide = useRef<string | null>(null);

  useEffect(() => {
    if (state !== 'title') return;
    if (!s || !s.edition || !s.gele || s.rang == null) return;
    if (decide.current === s.edition) return;
    decide.current = s.edition;
    if (dejaVue(s.edition)) return;
    setOuvert(true);
  }, [s, state]);

  const fermer = () => {
    if (s?.edition) marquerVue(s.edition);
    setOuvert(false);
  };

  if (!s) return null;
  const dedans = !!s.retenu;

  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="fixed inset-0 z-[62] flex items-center justify-center bg-black/90 backdrop-blur-md
                     pointer-events-auto px-[max(env(safe-area-inset-left),1rem)]
                     pr-[max(env(safe-area-inset-right),1rem)]"
          {...VOILE}
          onClick={fermer}
        >
          <motion.div
            {...PANNEAU}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={`relative w-full max-w-sm rounded-3xl border-2 bg-card/95 p-6 md:p-8
                        flex flex-col items-center gap-3 text-center
              ${dedans
                ? 'border-primary/60 shadow-[0_0_60px_rgba(248,205,74,0.35)]'
                : 'border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.6)]'}`}
          >
            {dedans && (
              // Le halo ne bat que pour la bonne nouvelle. Faire respirer un
              // cadre autour de « tu n'y es pas » serait célébrer l'échec.
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-3xl border-2 border-primary/50 pointer-events-none"
                animate={{ opacity: [0.15, 0.7, 0.15], scale: [1, 1.03, 1] }}
                transition={TRANSITION.battement}
              />
            )}

            <motion.div {...SURGISSEMENT}
              transition={{ ...RESSORT.trophee, delay: 0.1 }}>
              {dedans
                ? <Trophy className="w-10 h-10 text-primary" />
                : <Flag className="w-10 h-10 text-foreground/40" />}
            </motion.div>

            <span className="flex items-center gap-1.5">
              <Drapeau pays={s.pays} className="text-[13px]" />
              <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
                {s.titre || N.t('sel_titre')}
              </span>
            </span>

            <h2 className={`text-3xl md:text-4xl font-black font-display tracking-tight uppercase
              ${dedans ? 'text-primary' : 'text-foreground'}`}>
              {dedans ? N.t('sel_dedans_fige') : N.t('sel_dehors_fige')}
            </h2>

            <div className="h-1 w-2/3" style={{ backgroundColor: dedans ? '#F8CD4A' : 'rgba(255,255,255,0.2)' }} />

            {/* Le fait, nu. Une série et une heure pour qui court, un rang pour
                qui ne court pas — et dans les deux cas quelque chose de vrai
                plutôt qu'un encouragement. */}
            {dedans ? (
              <motion.div {...retarde(MONTEE, 0.25)} className="flex flex-col gap-1">
                {s.course && (
                  <span className="font-black font-display text-2xl md:text-3xl text-foreground">
                    {N.t('sel_ma_serie', { n: s.course.numero })}
                  </span>
                )}
                {s.course && heureLocale(s.course.at) && (
                  <span className="text-sm font-bold text-primary">
                    {N.t('sel_convoque', { n: heureLocale(s.course.at) })}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground mt-1">
                  {N.t('sel_bonne_chance')}
                </span>
              </motion.div>
            ) : (
              <motion.div {...retarde(MONTEE, 0.25)} className="flex flex-col gap-1">
                <span className="font-black font-display text-2xl md:text-3xl text-foreground">
                  {N.t('sel_tu_es', { r: N.ord(s.rang || 0) })}
                </span>
                <span className="text-sm font-bold text-foreground/70">
                  {s.manque === 1
                    ? N.t('sel_manque_1')
                    : N.t('sel_manque_n', { n: s.manque ?? 0 })}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">
                  {N.t('sel_prochaine')}
                </span>
              </motion.div>
            )}

            <button
              onClick={fermer}
              className={`mt-2 w-full py-3 rounded-xl font-bold tracking-widest text-xs uppercase
                ${dedans
                  ? 'bg-primary text-background'
                  : 'bg-white/10 text-foreground hover:bg-white/15 transition-colors'}`}
            >
              {N.t('champ_continue')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
