import React, { Suspense, lazy, useEffect, useState } from 'react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio } from '@/game/engine';
import { Globe, Globe2 } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { RecordChip } from './RecordPerso';
import { CarteObjectif } from './Revanche';
import { lireObjectif, lancerObjectif } from '@/game/objectif';
import { OneShotPanel, ChallengePanel } from './ModePanels';
import { DuelRanking } from './DuelRanking';
import { DUELS_OUVERTS, fetchDuels, type MonRang } from '@/game/duels';
import { Ecusson } from '@/components/Insignes';
import { Swords } from 'lucide-react';
import { codeFromUrl } from '@/game/challenge';
import { codeDirectUrl } from '@/game/live';
import { tutoVu, marquerTutoVu } from './Tutorial';
import { ouvrirLeTuto as ouvrirLeTutoSprint } from '@/game/sprint-tuto.js';
import { tutoHaiesVu, marquerTutoHaiesVu } from './TutorialHaies';
import { ouvrirLeTuto } from '@/game/haies-tuto.js';
import { NameChip } from './NameChip';
import { BanderoleSelection } from './Selection';
import { BanderoleEdition } from './BanderoleEdition';
// Charge a la demande, pour la raison expliquee dans App.tsx : un import
// ordinaire fait voyager tout le mode dans le build public, drapeau ferme ou
// non. Et `@__PURE__` pour la seconde moitie de la meme raison — sans elle,
// Rollup garde l'appel a `lazy`, donc l'`import()`, donc le morceau, qui se
// telechargeait alors depuis la production.
const BanderoleMolosse = /* @__PURE__ */ lazy(() => import('./Halloween')
  .then(m => ({ default: m.BanderoleMolosse })));
import { GameTour, tourVu, marquerTourVu } from './GameTour';
import { TutoPropose } from './TutoPropose';
import { allerAu, mondeVers, MONDES_OUVERTS } from '@/game/mondes';
import { useJeu, epreuvesDuJeu, nomCourt, jeuDe, estUneCourseDeHaies } from '@/game/jeux';
import { APPEL_JOUEUR, HALLOWEEN_OUVERT } from '@/game/canal';
import type { RaceKey } from '@/game/leaderboard';
import { useGesteMondes } from '@/hooks/use-geste-mondes';
import { usePassage } from '@/game/passage';
import { accueilPose } from '@/game/scene-accueil';
import type { Direction } from '@/game/mondes';
import { ChevronDown, ChevronUp, ChevronLeft as FlecheG, ChevronRight as FlecheD } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Tab = 'career' | 'oneshot' | 'versus';
const TABS: { id: Tab; key: string }[] = [
  { id: 'career', key: 'mode_career' },
  { id: 'oneshot', key: 'mode_oneshot' },
  { id: 'versus', key: 'mode_versus' },
];

/**
 * Le pied de l'accueil : les trois liens de bas de page.
 *
 * Il se tient SOUS le rouleau, hors de lui, et ne bouge donc plus. Avant,
 * chaque onglet portait ses liens au bas de son propre contenu : ils
 * remontaient avec le defi, dont le panneau est court, descendaient avec la
 * carriere, dont le panneau est long, et le contact se retrouvait seul quand
 * les deux autres ne vivaient qu'en carriere. Trois emplacements pour la meme
 * chose, decides par la hauteur du contenu et celle de la fenetre.
 *
 * Trois libelles sur une seule ligne, en entier — « NOUS CONT… » coupe au
 * bord de l'ecran ne dit rien a personne, et un lien qu'on ne lit pas n'est
 * pas un lien. Ce qui les fait tenir : plus d'icones, un espacement de
 * lettres sobre, et une largeur laissee a chacun selon la longueur de son mot
 * plutot que trois colonnes egales — « DÉCOUVRIR LE JEU » a besoin de plus
 * d'un tiers de la barre, « NOUS CONTACTER » de moins.
 *
 * La taille suit la largeur de l'ecran (clamp) au lieu de sauter a des
 * paliers : les trois libelles francais, les plus longs, demandent environ
 * 33 fois la taille du texte pour tenir cote a cote, soit un peu moins de
 * 3 % de la largeur par point de police. Entre les deux bornes, personne ne
 * voit jamais un mot coupe ni un mot passe a la ligne — ni sur l'ecran de
 * couverture d'un pliable, ni sur un moniteur.
 *
 * `haies` change UN mot et UNE destination : sur Hurdlers, « comment on joue »
 * devient « comment on passe une haie », et ouvre le tutoriel des haies. Le
 * geste n'y est pas celui de Sprinter — appuyer, maintenir, relacher — et
 * renvoyer le joueur vers le tutoriel du plat lui apprendrait exactement le
 * contraire de ce qu'il doit faire.
 */
function PiedLiens({ onTour, onTuto, haies }:
                   { onTour: () => void; onTuto: () => void; haies: boolean }) {
  const { N } = SprinterApp;
  const liens = [
    { cle: 'tour_open', action: onTour },
    { cle: haies ? 'tutoh_open' : 'tuto_open', action: onTuto },
    // mailto: par window.location — un <a href> ne mene nulle part dans la
    // fenetre sans barre d'adresse d'une application installee.
    { cle: 'contact',
      action: () => { window.location.href = 'mailto:support@sprinter-game.com'; } },
  ];

  return (
    // mt-4 et non mt-3 : le menu au-dessus deborde de 16 px vers le bas
    // (`-mb-4`, pour le halo de COMMENCER). Avec 12 px d'ecart, ses cartes
    // passaient sous les liens — vu en 414 x 736 avec la carte du championnat.
    <div className="relative z-10 shrink-0 w-full max-w-md mx-auto mt-4
                    flex items-center justify-between gap-1">
      {liens.map(({ cle, action }) => (
        <button
          key={cle}
          onClick={action}
          className="px-0.5 py-1.5 whitespace-nowrap
                     text-[clamp(7px,2.6vw,11px)] font-bold tracking-wide leading-none
                     text-muted-foreground hover:text-primary transition-colors"
        >
          {N.t(cle)}
        </button>
      ))}
    </div>
  );
}

export function TitleScreen() {
  const { raceKey, runs, furthest } = useGameStore();
  const { Audio_, N, RACES } = SprinterApp;
  // Sprinter ou Hurdlers : le meme accueil, avec les epreuves du jeu courant.
  const jeu = useJeu();
  const haies = jeu === 'hurdlers';
  const epreuves = epreuvesDuJeu(jeu);
  const [showTop500, setShowTop500] = useState(false);
  const [showDuels, setShowDuels] = useState(false);
  // La visite du jeu ne s'impose pas a quelqu'un qui arrive pour un duel.
  //
  // Un lien ?defi= ou ?direct= veut dire qu'on vient courir contre quelqu'un
  // de precis, souvent parce qu'un ami vient d'envoyer son chrono. Le duel se
  // joue entre gens qui savent deja courir : on ne les retient pas sur un
  // ecran d'explication. La visite reste a portee depuis l'accueil.
  //
  // Le relais fera exception le jour venu — le passage de temoin est un geste
  // neuf, qui ne se devine pas et qu'il faudra montrer.
  const venuPourUnDuel = !!(codeFromUrl() || codeDirectUrl());
  const [tour, setTour] = useState(() => !tourVu() && !venuPourUnDuel);
  /**
   * Ma MEILLEURE division, affichee a l'entree du classement.
   *
   * Il n'y a plus une division mais une par distance, et l'accueil n'a la
   * place que d'une : c'est la plus haute qu'on montre, avec la distance ou
   * elle a ete gagnee. Un ecusson sans distance mentirait maintenant par
   * omission — « NATIONAL II » ferait croire a un niveau partout, alors qu'il
   * est peut-etre departemental sur les deux autres.
   *
   * Sans marquer la visite : ouvrir le jeu ne doit pas effacer les fleches
   * qu'on n'a pas encore vues. C'est le meme piege que sur l'ecran du
   * classement, ou un rafraichissement automatique les aurait fait
   * disparaitre toutes seules.
   */
  //
  // Celle du jeu courant : un ecusson de haies n'a rien a faire sur l'accueil
  // de Sprinter, ni l'inverse. Une discipline combinee appartient au jeu de sa
  // premiere epreuve — un one shot ne melange jamais les deux jeux.
  const [mesRangs, setMesRangs] = useState<MonRang[]>([]);
  useEffect(() => {
    if (!DUELS_OUVERTS) return;
    let annule = false;
    // Le serveur rend mes disciplines classees, la plus haute en tete.
    fetchDuels(undefined, false)
      .then(b => { if (!annule) setMesRangs(b?.mes_epreuves || []); });
    return () => { annule = true; };
  }, []);
  const monRang = mesRangs.find(r => jeuDe(String(r.epreuve).split('+')[0]) === jeu) || null;
  const [propose, setPropose] = useState(false);
  // Un lien ?defi=CODE ou ?direct=CODE doit tomber sur l'onglet du defi.
  const [tab, setTab] = useState<Tab>(() => (venuPourUnDuel ? 'versus' : 'career'));

  // Premiere course : on PROPOSE le tutoriel, on ne l'impose pas. Le joueur
  // vient d'appuyer sur COMMENCER — il voulait courir. Lui ouvrir un tutoriel
  // d'office, avec un lien « passer » en petit dans un coin, c'est lui donner
  // autre chose que ce qu'il a demande.
  // LES HAIES ONT LEUR PROPRE TUTORIEL, et il fallait bien : leur geste n'est
  // pas celui de Sprinter. On appuie sur le pave pour s'appeler, on le GARDE
  // pendant le vol, on le relache pour ciseauter, et la cadence juste n'est
  // plus la cadence maximale. Un joueur qui a appris Sprinter arriverait avec
  // exactement les mauvais reflexes.
  //
  // Il ne se propose que la ou ce geste existe (canal.ts, APPEL_JOUEUR) : le
  // proposer ailleurs enseignerait une commande que le jeu n'a pas.
  const tutoDesHaies = APPEL_JOUEUR && estUneCourseDeHaies(raceKey);

  const handleStart = () => {
    if (tutoDesHaies) {
      if (!tutoHaiesVu()) { setPropose(true); return; }
    } else if (!tutoVu()) { setPropose(true); return; }
    SprinterApp.startRun();
  };

  // Les deux reponses valent acceptation : on ne repose pas la question a la
  // course suivante, et le tutoriel reste a portee depuis l'accueil.
  const repondrePropose = (apprendre: boolean) => {
    setPropose(false);
    if (tutoDesHaies) marquerTutoHaiesVu(); else marquerTutoVu();
    if (apprendre) { if (tutoDesHaies) ouvrirLeTuto(); else ouvrirLeTutoSprint(); }
    else SprinterApp.startRun();
  };

  const handleRaceToggle = (key: RaceKey) => {
    SprinterApp.G.raceKey = key;
    SprinterApp.G.race = RACES[key];
    SprinterApp.buildLevel(0);
  };

  const currentRuns = runs[raceKey] || [];

  // On demande l'objectif du jour a l'ouverture de l'accueil. Sans nom, sans
  // reseau ou hors fenetre, il n'y en a pas et la carte ne s'affiche pas.
  React.useEffect(() => { void lireObjectif(); }, []);

  // Le geste qui mene aux trois autres jeux. Le doigt se pose n'importe ou sur
  // l'accueil, mais c'est la position du MENU, seul a defiler, qui dit si l'on
  // est au bout — et donc si tirer encore veut dire « montre-moi les haies »
  // plutot que « fais defiler ».
  const zoneGeste = React.useRef<HTMLDivElement>(null);
  const rouleau = React.useRef<HTMLDivElement>(null);
  //
  // Depuis Hurdlers, le meme geste vers le bas ramene a Sprinter — c'est ce
  // que faisait deja l'ancien accueil des haies — et les deux cotes ne menent
  // nulle part : les concours sont autour de Sprinter, pas autour des haies.
  useGesteMondes(zoneGeste, (d: Direction) => {
    if (!haies) allerAu(mondeVers(d));
    else if (d === 'bas') allerAu('sprinter');
  }, MONDES_OUVERTS, rouleau);

  // La touche « retour » du telephone ramene de Hurdlers a Sprinter plutot
  // que de sortir du jeu : on y est entre par un geste, on en sort par celui
  // que le systeme propose.
  useEffect(() => {
    if (!haies) return;
    const sortir = () => allerAu('sprinter');
    window.addEventListener('popstate', sortir);
    return () => window.removeEventListener('popstate', sortir);
  }, [haies]);

  // Le canvas a dessine l'image ou l'on arrive ici avant que cet ecran existe :
  // on la lui fait refaire, scene en place, avant qu'elle s'affiche.
  React.useLayoutEffect(() => { accueilPose(); }, []);

  /**
   * L'ACCUEIL S'EFFACE QUAND ON QUITTE VRAIMENT LE STADE, ET PAS AUTREMENT.
   *
   * Vers les concours, le stade sort de l'image pour laisser la place a leur
   * accueil : un menu pose dessus donnerait exactement ce qu'on cherchait a
   * eviter, un calque immobile devant un monde qui bouge. Vers Hurdlers, au
   * contraire, on ne va nulle part — le menu RESTE, et c'est lui qui change de
   * couleur pendant que les haies se dressent derriere.
   *
   * Il part sans fondu et revient avec. Un fondu de sortie le laissait visible
   * deux dixiemes de trop : au retour, il se decouvrait sous l'accueil du
   * concours en train de disparaitre, et les deux menus se lisaient l'un sur
   * l'autre. A l'arrivee, en revanche, le fondu compte : il pose le menu sur
   * un stade deja immobile.
   */
  const passage = usePassage();
  const efface = !!passage && !passage.surPlace;

  return (
    <div style={efface
           ? { opacity: 0, pointerEvents: 'none' }
           : { opacity: 1, transition: 'opacity 240ms ease-out' }}
         className="w-full h-full flex flex-col pointer-events-auto overflow-hidden bg-black/20 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      {/* Tout ce qui recoit le geste des mondes : l'accueil entier, le pied de
          page et les fenetres posees par-dessus exceptes. */}
      <div ref={zoneGeste} className="flex-1 min-h-0 flex flex-col">
        {/* Header controls */}
        <div className="w-full flex justify-between items-start z-20 shrink-0 mb-2 md:mb-4">
          <button 
            onClick={() => toggleLang()}
            className="bg-card/80 backdrop-blur-md border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2 hover:bg-white/10 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <span className="font-bold text-xs md:text-sm text-foreground/90">{N.getLang().toUpperCase()}</span>
          </button>

          {/* Le nom du joueur occupe le centre du bandeau, qui etait vide.
              C'est le seul ecran que tout le monde traverse. */}
          <NameChip />

          <button
            onClick={() => toggleAudio()}
            className="bg-card/80 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <img
              src={`${BASE}/icons/${Audio_.on ? 'audio-on' : 'audio-off'}.png`}
              alt=""
              className={`w-4 h-4 md:w-5 md:h-5 ${Audio_.on ? 'opacity-100' : 'opacity-40'}`}
            />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col landscape:flex-row items-center landscape:items-stretch gap-2 landscape:gap-8 max-w-5xl mx-auto w-full">

          {/* LE TITRE, ET LA SCENE DES TROIS COUREURS DU STADE.

              Cette moitie-la ne defile jamais. Les coureurs sont dessines
              dans le stade, derriere l'accueil : une carte qui passerait sur
              leur scene les couvrirait, et un stade qui defilerait pour les
              suivre bougerait sous les doigts. La scene est donc une vraie
              place dans la mise en page, que le canvas relit a chaque image
              (data-accueil-scene, voir game/scene-accueil.ts).

              En portrait elle suit le titre et prend la hauteur que le menu
              laisse, sans descendre sous un minimum ; le menu defile en
              dessous s'il le faut. En paysage elle se tient au-dessus du
              titre, la ou la piste traverse deja l'ecran, et le titre reste
              au milieu de sa moitie. */}
          <div className="flex-1 w-full flex flex-col items-center landscape:items-start text-center landscape:text-left">
            <div className="order-1 landscape:order-2 shrink-0 mt-2 md:mt-0 bg-card/60 backdrop-blur-sm border border-white/10 px-6 py-5 md:px-8 md:py-6 rounded-2xl landscape:w-full max-w-md border-t-white/20">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-display tracking-tight text-primary drop-shadow-md">
                {haies ? 'HURDLERS' : 'SPRINTER'}
              </h1>
              <p className="mt-1 md:mt-2 text-[10px] sm:text-xs md:text-base lg:text-xl font-medium text-foreground/80 tracking-wide uppercase">
                {tab === 'career'
                  ? <>{RACES[raceKey].label} &mdash; {N.t('six_stages_bare')}</>
                  : N.t(tab === 'oneshot' ? 'oneshot_desc' : 'versus_desc')}
              </p>
            </div>
            <div data-accueil-scene aria-hidden
                 className="order-2 landscape:order-1 w-full max-w-md flex-1 min-h-[84px] landscape:min-h-[96px]" />
            <div className="hidden landscape:block order-3 flex-1" />
          </div>

          {/* LE MENU, SEUL A DEFILER. Sa zone deborde de sa colonne, marge
              interieure comprise : le halo de COMMENCER (trente pixels) s'y
              dessine en entier au lieu d'etre coupe net au bord.
              Le bas s'estompe sur 24 px, la hauteur de `pb-6` : une carte
              coupee par le defilement se fond au lieu de buter sur les liens
              du pied, et en fin de defilement seule la marge vide s'efface. */}
          <div ref={rouleau}
               className="flex-initial landscape:flex-1 min-h-0 overflow-y-auto flex flex-col
                          w-[calc(100%+4rem)] max-w-[calc(28rem+4rem)] -mx-8 px-8 -mb-4
                          [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]">
          <div className="my-auto flex flex-col gap-3 sm:gap-4 md:gap-6 w-full pt-2 pb-6">

            {/* L'EDITION DU MOMENT, tout en haut de la colonne.
                Au-dessus du defi du jour parce qu'elle ne dure qu'une
                semaine, quand le defi revient tous les jours : c'est la
                seule chose de cet ecran qu'on peut rater. Hors fenetre,
                elle disparait entierement. */}
            {/* L'edition et le defi du jour lancent un 100 m : ce sont des
                rendez-vous de Sprinter, que Hurdlers ne montre pas tant que le
                serveur ne propose rien avec des haies. */}
            {/* LA NUIT DU MOLOSSE, au-dessus de l'edition de stade : c'est un
                mode entier et date, quand l'autre est un lieu de plus. Il
                s'affiche sous les memes reserves — dans Sprinter, pas dans
                Hurdlers, qui ne court pas apres les chiens. */}
            {!haies && HALLOWEEN_OUVERT && <Suspense fallback={null}><BanderoleMolosse /></Suspense>}

            {!haies && <BanderoleEdition />}

            {/* LE DEFI DU JOUR, au-dessus du selecteur de mode.
                Il n'apparait que s'il y en a un d'ouvert : hors fenetre, hors
                classement, ou serveur muet, la carte disparait plutot que
                d'annoncer un defi qui n'existe pas. */}
            {!haies && <CarteObjectif
              onLancer={(o) => lancerObjectif(o)}
              onFin={() => { void lireObjectif(); }}
            />}

            {/* LA SÉLECTION DU CHAMPIONNAT, sur les trois onglets.
                Sous le défi du jour et au-dessus du sélecteur de mode : c'est
                une échéance, pas un mode de jeu, et elle concerne autant qui
                joue en carrière que qui ne fait que des duels.

                Elle n'apparaît que si un championnat est annoncé dans le pays
                du joueur — sinon rien, comme la carte de l'objectif. Et si le
                joueur est qualifié, elle mène au panneau du championnat, qui
                vit dans l'onglet du versus.

                Fermée avec les duels : la sélection lit leur classement, elle
                ne peut pas ouvrir avant lui. */}
            {DUELS_OUVERTS && !haies && <BanderoleSelection onVoir={() => setTab('versus')} />}

            {/* Selecteur de mode */}
            {/* Le selecteur flotte au-dessus de la piste, tres claire : sans
                fond assez opaque les onglets inactifs deviennent illisibles. */}
            <div className="flex gap-1 p-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs transition-all
                    ${tab === t.id
                      ? 'bg-primary text-background shadow-[0_0_15px_rgb(var(--primaire-rgb)/0.25)]'
                      : 'text-foreground/70 hover:text-foreground hover:bg-white/10'}`}
                >
                  {N.t(t.key)}
                </button>
              ))}
            </div>

            {/* Classement des duels : accessible depuis les trois onglets,
                c'est une facon de jouer a part entiere. La piste derriere est
                claire et bariolee — sans fond opaque le bouton s'y noie.
                Ferme tant que DUELS_OUVERTS vaut false (voir game/duels). */}
            {DUELS_OUVERTS && <button
              onClick={() => setShowDuels(true)}
              className="w-full px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-md
                         border border-primary/50 hover:bg-black/85 transition-colors
                         shadow-[0_0_25px_rgb(var(--primaire-rgb)/0.2)]
                         flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Swords className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                <span className="flex flex-col min-w-0">
                  <span className="font-bold tracking-widest text-primary text-[11px] md:text-sm truncate">
                    {N.t('duel_open')}
                  </span>
                  <span className="text-[9px] md:text-[10px] text-foreground/60 truncate">
                    {N.t('duel_sub')}
                  </span>
                </span>
              </span>
              {/* Le rang, et rien d'autre.
                  Le bareme figurait ici sous forme de chiffres ; il n'a plus
                  de sens hors contexte, puisque ce qu'un duel rapporte depend
                  d'ou l'on se situe. Ce que le joueur vient chercher d'un coup
                  d'oeil, c'est sa division. */}
              {monRang
                ? <Ecusson etage={monRang.etage} division={monRang.division}
                           epreuve={monRang.epreuve}
                           lp={monRang.etage === 'legende' ? monRang.lp : undefined} />
                : <span className="font-mono text-[9px] md:text-[10px] text-primary/60
                                   shrink-0 tracking-wider">—</span>}
            </button>}

            {/* Les trois autres jeux, annonces.
                Un geste que rien n'annonce n'existe pas : personne ne tire
                l'ecran vers le bas pour voir s'il se passe quelque chose. Ces
                trois reperes sont la pour etre remarques une fois, et oublies
                ensuite — c'est pourquoi ils sont discrets et ne prennent pas
                de place. */}
            {MONDES_OUVERTS && haies && (
              <div className="flex items-center justify-center gap-2 px-1 pt-1 pb-0.5">
                <button onClick={() => allerAu('sprinter')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  <ChevronUp className="w-3 h-3" /> SPRINTER
                </button>
              </div>
            )}
            {MONDES_OUVERTS && !haies && (
              <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-0.5">
                <button onClick={() => allerAu('thrower')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  <FlecheG className="w-3 h-3" /> THROWER
                </button>
                <button onClick={() => allerAu('hurdlers')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  HURDLERS <ChevronDown className="w-3 h-3" />
                </button>
                <button onClick={() => allerAu('jumper')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  JUMPER <FlecheD className="w-3 h-3" />
                </button>
              </div>
            )}

            {tab === 'oneshot' && <OneShotPanel />}
            {tab === 'versus' && <ChallengePanel />}

            {tab === 'career' && <>
            {/* Les meilleurs parcours, resserres.
                Cette carte poussait COMMENCER sous la ligne de flottaison : il
                fallait derouler pour lancer une course, sur l'ecran dont c'est
                la seule raison d'etre. Trois blocs empiles sont devenus deux
                lignes, sans qu'aucune information disparaisse.

                Le titre et le bouton du TOP 500 partageaient le meme sens et
                occupaient deux etages ; ils tiennent sur une ligne. Et les
                lignes vides — celles des parcours qu'on n'a pas encore courus —
                ne sont plus dessinees : montrer cinq rangs dont quatre affichent
                « -- » prend la place de cinq resultats pour n'en donner qu'un. */}
            <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-5 shadow-2xl flex flex-col gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <img src={`${BASE}/icons/trophy.png`} alt="" className="w-4 h-4 shrink-0" />
                {/* Le titre passe a la ligne plutot que de se faire couper :
                    sur un ecran etroit il ne tient pas a cote du bouton, et
                    « MEILLEU… » ne dit rien. Deux lignes de titre restent bien
                    plus courtes que les deux blocs empiles d'avant. */}
                <h2 className="flex-1 min-w-0 font-bold tracking-widest text-primary
                               text-[11px] md:text-sm leading-tight">
                  {N.t('best_runs')}
                </h2>
                <button
                  onClick={() => setShowTop500(true)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30
                             text-primary font-bold tracking-widest text-[9px] md:text-[11px]
                             flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
                >
                  <Globe2 className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                  {N.t('top500_court')}
                </button>
              </div>

              {/* Le record, NOMME. La liste au-dessous le contenait deja — son
                  premier rang — mais rien ne disait que c'en etait un, et le
                  mot « record » n'apparaissait nulle part dans le jeu. Il vient
                  du serveur quand le joueur a un nom : c'est alors son record a
                  LUI, telephone et ordinateur confondus, et pas celui de
                  l'appareil qu'il tient. */}
              <RecordChip race={raceKey as any} />

              {!currentRuns.length ? (
                <p className="text-[11px] md:text-sm text-center leading-snug text-muted-foreground">
                  {N.t('no_run')}
                  {' — '}
                  <span className="text-foreground/90 font-bold uppercase tracking-wide">
                    {N.t('furthest')} {furthest[raceKey]} {N.t('of_six')}
                  </span>
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {currentRuns.slice(0, 5).map((run, i) => (
                    <div key={i} className="flex items-center text-[11px] md:text-sm font-mono
                                            bg-black/20 rounded-md px-2 py-1 md:px-3 md:py-1.5
                                            border border-white/5">
                      <span className="w-4 md:w-6 text-muted-foreground/50">{i + 1}.</span>
                      <span className={`font-bold ml-1 md:ml-2
                        ${i === 0 ? 'text-primary' : i < 3 ? 'text-cyan-400' : 'text-foreground'}`}>
                        {run.toFixed(2)} s
                      </span>
                      <div className="flex-1 ml-2 md:ml-4 h-1 md:h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${i === 0 ? 'bg-primary' : i < 3 ? 'bg-cyan-400' : 'bg-white/40'}`}
                          style={{ width: `${(currentRuns[0] / run) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Race Selectors */}
            <div className="flex gap-2">
              {epreuves.map(k => (
                <button
                  key={k}
                  onClick={() => handleRaceToggle(k)}
                  className={`flex-1 py-2 md:py-4 rounded-xl font-bold tracking-wider transition-all border-b-2 text-sm md:text-base
                    ${raceKey === k 
                      ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgb(var(--primaire-rgb)/0.2)]' 
                      : 'bg-card/80 text-muted-foreground border-transparent hover:bg-white/10'}`}
                >
                  {nomCourt(k)}
                </button>
              ))}
            </div>

            {/* Start Button */}
            <button 
              onClick={handleStart}
              className="w-full py-3 md:py-5 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1 shadow-[0_0_30px_rgb(var(--primaire-rgb)/0.4)]"
            >
              {N.t('start')}
            </button>

            </>}

          </div>
          </div>
        </div>
      </div>

      <PiedLiens onTour={() => setTour(true)} haies={tutoDesHaies}
                 onTuto={() => (tutoDesHaies ? ouvrirLeTuto() : ouvrirLeTutoSprint())} />

      {/* A la toute premiere visite on montre le jeu avant de le faire jouer :
          un joueur qui n'a vu que l'accueil ignore qu'il existe un classement
          mondial et des defis. Le tutoriel du geste, lui, reste au moment de
          la premiere course — deux tutoriels d'affilee avant de courir, ce
          serait un de trop. */}
      {tour && <GameTour onClose={(jouer) => { marquerTourVu(); setTour(false); if (jouer) handleStart(); }} />}

      {propose && (
        <TutoPropose
          onChoix={repondrePropose}
          cles={tutoDesHaies
            ? { t: 'tutoh_ask_t', s: 'tutoh_ask_s', oui: 'tutoh_ask_yes' }
            : { t: 'tuto_ask_t', s: 'tuto_ask_s', oui: 'tuto_ask_yes' }}
        />
      )}


      {DUELS_OUVERTS && showDuels && <DuelRanking onClose={() => setShowDuels(false)} />}

      {showTop500 && (
        <LeaderboardScreen initialRace={raceKey} onClose={() => setShowTop500(false)} />
      )}
    </div>
  );
}
