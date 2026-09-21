import { type ReactNode, Suspense, lazy, useEffect, useState, useSyncExternalStore } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { SprinterApp, useGameStore } from '@/game/engine';
import { useBackGuard } from '@/hooks/use-back-guard';
import { useGesteRetour } from '@/hooks/use-geste-retour';
import { GameCanvas } from '@/components/GameCanvas';
import { TouchControls } from '@/components/TouchControls';
import { EST_TEST, RELAIS_OUVERT } from '@/game/canal';
import { MONDES_OUVERTS } from '@/game/mondes';
import { PorteTest } from '@/components/screens/PorteTest';
import { PisteRelais } from '@/components/screens/PisteRelais';
import { PresentationDirect } from '@/components/screens/PresentationDirect';
import { Mondes } from '@/components/screens/Mondes';
import { OpenScreen } from '@/components/screens/OpenScreen';
import { TutorialHaies, marquerTutoHaiesVu } from '@/components/screens/TutorialHaies';
import { tutoOuvert, abonnerAuTuto, fermerLeTuto } from '@/game/haies-tuto.js';
import { TitleScreen } from '@/components/screens/TitleScreen';
import { CutScreen } from '@/components/screens/CutScreen';
import { Generique } from '@/components/screens/Generique';
import { RaceHUD } from '@/components/screens/RaceHUD';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { OverScreen } from '@/components/screens/OverScreen';
import { WinAllScreen } from '@/components/screens/WinAllScreen';
import { FalseStartCut } from '@/components/screens/FalseStartCut';
import { OneShotEndScreen } from '@/components/screens/OneShotEndScreen';
import { Revanche } from '@/components/screens/Revanche';
import { useObjectif, ouvrirDepuisNotification } from '@/game/objectif';
import { surCourrier } from '@/game/boite';
import { RecordPopup } from '@/components/screens/RecordPopup';
import { QuitRace } from '@/components/screens/QuitRace';
import { DuelResultPopup } from '@/components/screens/DuelResultPopup';
import { SceneSelection } from '@/components/screens/Selection';
import { InboxPopup } from '@/components/screens/InboxPopup';
import { AnnoncePopup } from '@/components/screens/AnnoncePopup';
import { InvitationDirecte } from '@/components/screens/InvitationDirecte';
import { InstallPrompt } from '@/components/screens/InstallPrompt';
import { InviteNotifs } from '@/components/screens/InviteNotifs';
import { Bienvenue } from '@/components/screens/Bienvenue';
import { LiaisonEntrante } from '@/components/screens/LiaisonEntrante';
import { Dashboard } from '@/components/screens/Dashboard';
import { FileRecuperations } from '@/components/screens/FileRecuperations';
import { FeteRecords } from '@/components/screens/FeteRecords';
import { HALLOWEEN_OUVERT } from '@/game/canal';

/* LA NUIT DU MOLOSSE SE CHARGE A LA DEMANDE, ET C'EST UNE CONDITION POUR
   QU'ELLE SORTE DU BUILD PUBLIC.

   Importe normalement, le mode partait en production malgre son drapeau
   ferme : le bundler retire bien le code que `HALLOWEEN_OUVERT && ...` rend
   inatteignable, mais il garde les MODULES importes — et avec eux les
   quatorze scenettes en clair, les treize nuits et le morceau de cinquante
   secondes. On lisait les blagues dans le paquet public d'un mode qui n'y
   existe pas. C'est exactement l'accident que canal.ts raconte a propos des
   37 Ko de WebRTC.

   Derriere `lazy`, le mode devient un morceau separe. Le `Suspense` ne sert
   qu'a satisfaire React : son repli est nul, parce qu'il n'y a rien a montrer
   pendant le chargement d'un panneau que le joueur vient tout juste de
   demander.

   ET IL FAUT `@__PURE__`, SANS QUOI LE MORCEAU EST PUBLIE QUAND MEME.

   C'etait la moitie manquante, et elle s'est mesuree en ligne :
   sprinter-game.com/assets/Halloween-*.js repondait 200 sur la PRODUCTION,
   vingt-et-un kilo-octets, avec les treize nuits et leurs noms en clair. Le
   `HALLOWEEN_OUVERT && ...` plus bas faisait bien son travail — aucun joueur
   ne pouvait ouvrir le mode — mais quiconque lisait la liste des fichiers
   avait la surprise entiere avant le 24 octobre.

   La raison tient en une ligne : `lazy(...)` est un APPEL au niveau du module.
   Rollup ne supprime pas un appel dont il ne sait rien, meme quand plus
   personne ne se sert du resultat ; il garde donc la constante, et avec elle
   l'`import()` qu'elle enferme, et avec lui le morceau. L'annotation dit ce
   que Rollup ne peut pas deviner : cet appel ne fait rien d'autre que rendre
   une valeur. Inutilisee, elle s'en va — et le morceau avec.

   Ce qu'on verifie : tools/molosse-canal-test.mjs bâtit le vrai paquet de
   production et exige qu'aucun fichier Halloween n'en sorte. */
const PanneauMolosse = /* @__PURE__ */ lazy(() => import('@/components/screens/Halloween')
  .then(m => ({ default: m.PanneauMolosse })));
const FinDeLaNuit = /* @__PURE__ */ lazy(() => import('@/components/screens/Halloween')
  .then(m => ({ default: m.FinDeLaNuit })));
import { dashboardRequested, pingVisit } from '@/game/stats';
import { ouvrirBoite } from '@/game/boite';
import { DUELS_OUVERTS } from '@/game/duels';
import { reprendrePush } from '@/game/push';
import { brancherRattrapage } from '@/game/record-attente';
import { useFilmerLeOneShot } from '@/game/film-course';
import { nuitEnCours } from '@/game/halloween';

const queryClient = new QueryClient();

// Certains navigateurs mobiles (Chrome Android en paysage notamment) ne
// recalculent pas 100dvh correctement quand leur barre d'adresse reste
// affichee : le contenu se retrouve dessine sous la barre plutot qu'en
// dessous. On mesure la hauteur reellement visible via window.innerHeight
// (fiable sur ce point, contrairement a dvh sur ces navigateurs) et on
// l'applique via une variable CSS, avec un court delai apres rotation le
// temps que la barre du navigateur se stabilise.
function useVisualViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    setHeight();
    // Une application lancee depuis l'ecran d'accueil sur iOS met parfois
    // plusieurs images a etablir sa hauteur definitive — et n'emet alors aucun
    // evenement de redimensionnement. Sans ces quelques repassages, la variable
    // reste figee sur la valeur du demarrage pour toute la session, et
    // l'application s'affiche plus courte que l'ecran.
    const rappels = [80, 300, 800, 1600].map(d => setTimeout(setHeight, d));
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', () => setTimeout(setHeight, 120));
    // Au retour d'arriere-plan, la hauteur peut avoir change sans evenement.
    window.addEventListener('pageshow', setHeight);
    return () => {
      rappels.forEach(clearTimeout);
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('pageshow', setHeight);
    };
  }, []);
}

function MainGame() {
  const state = useGameStore(s => s.state);
  const mode = useGameStore(s => s.mode);
  const countT = useGameStore(s => s.countT);
  const cut = useGameStore(s => s.cut);
  // La cinematique qui s'efface par-dessus celle qui commence — le sacre vers
  // le generique, et rien d'autre. Nulle le reste du temps.
  const sortie = useGameStore(s => s.sortie);
  // Le defi du jour est-il en cours ? C'est lui qui decide de l'ecran de fin.
  const defiEnCours = useObjectif().enCours;

  // La notification de l'objectif ouvre le defi, sans ecran intermediaire.
  //
  // Elle arrive par la meme porte que les autres — un coup de sonnette qui dit
  // le genre de la nouvelle — et c'est le seul genre qui LANCE quelque chose
  // plutot que d'afficher un ecran. `ouvrirDepuisNotification` refuse d'elle-
  // meme si l'on est au milieu d'une course : interrompre celle qu'on court
  // pour en ouvrir une autre serait pire que de ne rien faire.
  useEffect(() => surCourrier(quoi => {
    if (quoi === 'objectif') void ouvrirDepuisNotification();
  }), []);
  useVisualViewportHeight();
  useBackGuard();
  // Le glissement depuis le bord gauche referme le panneau ouvert. Pose
  // ici, une fois pour tout le jeu : c'est un geste sur la fenetre, pas sur
  // un panneau — et la ou le systeme le confisque, c'est useBackGuard
  // ci-dessus qui recoit le retour a sa place.
  useGesteRetour();
  // La camera du one shot. Elle se pose ici parce que c'est le seul endroit
  // qui voie passer TOUTE la course : l'ecran de fin, lui, n'existe qu'une
  // fois la derniere ligne franchie. Voir game/film-course.ts.
  useFilmerLeOneShot();

  // Sur le canal de test, le jeu ne se monte qu'une fois l'acces accorde.
  //
  // Le poser en simple calque par-dessus un jeu deja demarre ne suffisait pas :
  // les ecrans montes dessous partaient travailler avant que le code ne soit
  // saisi. En particulier, le panneau du direct rejoint automatiquement la
  // piste d'un lien d'invitation des son montage — sans code, cette connexion
  // partait sur le canal de production, et les deux joueurs se retrouvaient
  // dans deux salles differentes en croyant etre sur la meme piste.
  //
  // En production, EST_TEST vaut false en dur : la valeur initiale est vraie,
  // la porte disparait du build, et rien de tout ceci n'existe.
  const [acces, setAcces] = useState(!EST_TEST);

  /**
   * La liaison permanente s'ouvre des que le jeu est jouable.
   *
   * Apres la porte du canal de test, et pas avant : sans code d'acces la boite
   * n'existe pas, et frapper quand meme mettrait le jeu a sonder une adresse
   * de production depuis la version de test. Elle ne se referme jamais — c'est
   * le module qui gere veille, coupures et retours.
   */
  useEffect(() => {
    if (!acces || !DUELS_OUVERTS) return;
    ouvrirBoite();
  }, [acces]);

  // Au lancement : redire au serveur où joindre ce téléphone.
  //
  // Rien ne s'affiche, et rien n'est demandé — sans permission déjà accordée,
  // l'appel ne fait rien. Il existe parce qu'un jeton Firebase tourne : il
  // change à une réinstallation, à une restauration, après des mois sans
  // ouvrir le jeu. Sans ce rappel, le serveur continuerait d'envoyer vers un
  // jeton mort, et personne ne verrait rien — ni le joueur, ni les journaux.
  useEffect(() => {
    if (!acces) return;
    reprendrePush().catch(() => { /* best-effort */ });
  }, [acces]);

  // Le record du monde qui n'est pas passe la premiere fois.
  //
  // Un chrono refuse — reseau coupe, nom reserve par un autre appareil —
  // etait perdu pour de bon : la fenetre ne s'ouvre qu'une fois par course.
  // Il est desormais garde sur l'appareil, et ce branchement le renvoie au
  // lancement puis a chaque changement de nom. C'est ce dernier moment qui
  // compte : un nom reserve ne se debloque qu'en reliant l'appareil, et le
  // record part alors sans que le joueur ait a y repenser.
  useEffect(() => {
    if (!acces) return;
    brancherRattrapage();
  }, [acces]);

  // La permission push se demande depuis un bouton, et depuis rien d'autre.
  //
  // Elle se demandait ici, après le premier résultat de course : le moment
  // était le bon, l'appel ne l'était pas. Une demande de permission qui ne
  // part pas d'un geste du joueur n'est pas traitée comme les autres — Safari
  // la rejette (`NotAllowedError`), Chrome la réduit à une pastille dans la
  // barre d'adresse que personne ne voit sur un téléphone. Résultat : sur
  // 90 appareils connus du serveur, 3 abonnements.
  //
  // La carte `InviteNotifs`, plus bas, propose au même moment — mais avec un
  // bouton, et c'est le clic qui ouvre la fenêtre du système.

  /** Le decompte suspendu, c'est la presentation des athletes. */
  const enPresentation = state === 'count' && countT <= -90;

  /**
   * Le generique de fin de carriere, plutot que la cinematique ordinaire.
   *
   * C'est une cinematique par l'etat — `cut` — mais rien d'autre ne lui
   * ressemble : elle dure un morceau au lieu de quinze secondes, elle porte sa
   * propre musique, et son texte defile. Elle a donc son ecran. Voir
   * game/generique.ts et game/scene-generique.ts.
   */
  const generique = state === 'cut' && !!cut && cut.kind === 'ending';

  // LE TUTORIEL DES HAIES. Son ouverture ne vit pas dans un etat React d'ecran
  // — l'accueil qui l'ouvre se demonte des que le tutoriel met le jeu en
  // course — mais dans game/haies-tuto.js, ou elle decrit la meme chose que la
  // sequence en piste.
  const tutoHaies = useSyncExternalStore(abonnerAuTuto, tutoOuvert, tutoOuvert);
  const fermerLeTutoHaies = (lancer: boolean) => {
    marquerTutoHaiesVu();
    fermerLeTuto();
    // LE DEMONTAGE REND LA PISTE, ET IL N'A PAS ENCORE EU LIEU. C'est lui qui
    // remet le monde a sa vitesse et range les haies (rangerLeTuto). Lancer la
    // course d'ici la ferait construire, puis defaire. On attend l'image
    // suivante, ou le tutoriel a fini de ranger derriere lui.
    if (lancer) requestAnimationFrame(() => SprinterApp.startRun());
  };

  return (
    <div className="relative w-full h-[var(--app-height,100dvh)] bg-[#060913] overflow-hidden font-sans text-foreground select-none touch-none">
      {EST_TEST && <PorteTest onOuvert={setAcces} />}
      {acces && (<>
      <GameCanvas />
      
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {state === 'open' && <OpenScreen />}
        {state === 'title' && <TitleScreen />}
        {state === 'cut' && !generique && <CutScreen />}
        {generique && <Generique />}
        {/* Le sacre s'eteint par-dessus le generique plutot que de disparaitre
            d'un coup : deux secondes ou les deux scenes se croisent, le temps
            que la musique parte. Voir nextCut dans game/sprinter-app.js. */}
        {generique && !!sortie && sortie.a > 0 && <CutScreen fige={sortie} />}
        {/* Pendant la presentation, le decompte est suspendu et l'etat vaut
            deja « count ». Le tableau de course n'a rien a y faire : « POUSSÉE
            0.00 », « à battre », « ALTERNE LES DEUX TOUCHES » s'empilaient
            par-dessus la presentation alors que personne ne court encore. */}
        {/* LE TUTORIEL DES HAIES MET LE JEU EN COURSE, et le tableau de
            course n'y a rien a faire : il annoncerait un chrono, un
            classement et un record a battre sur une sequence de deux
            haies. Le tutoriel monte a la place le seul bandeau qui le
            concerne, celui des haies. */}
        {(state === 'count' || state === 'race') && !enPresentation && !tutoHaies && <RaceHUD />}
        {state === 'falseout' && <FalseStartCut />}
        {state === 'result' && <ResultScreen />}
        {state === 'over' && <OverScreen />}
        {/* Le one-shot a son propre recapitulatif : epreuves choisies,
            comparaison au fantome, creation du defi. Le TOP 500 ne concerne
            que la carriere complete, un cumul one-shot n'y a pas sa place. */}
        {/* Le defi du jour a son propre ecran de fin. Il ne remplace pas
            celui du one shot : il repond a une autre question. Le recapitulatif
            ordinaire demande de choisir entre huit choses ; apres avoir rate de
            neuf centiemes, choisir c'est fermer le jeu. */}
        {/* LA NUIT DU MOLOSSE PASSE AVANT LE RECAPITULATIF DU ONE SHOT.
            Une nuit EST un one shot — c'est ce qui lui donne le faux depart,
            la pause et l'enregistrement de la trace — mais son ecran de fin
            n'a rien a voir : le tableau ordinaire propose huit choses, et
            apres une morsure la seule question est de savoir si l'on y
            retourne. Il rend la main de lui-meme hors du mode. */}
        {state === 'winall' && (
          HALLOWEEN_OUVERT && nuitEnCours() ? <Suspense fallback={null}><FinDeLaNuit /></Suspense>
            : defiEnCours ? <Revanche />
            : mode === 'oneshot' ? <OneShotEndScreen /> : <WinAllScreen />)}
      </div>
      
      {/* Invisible overlay for receiving touches during the race */}
      <TouchControls />

      {/* LE TUTORIEL DES HAIES SE JOUE SUR LA PISTE, donc il vit ici et non
          dans l'accueil : il met le jeu en etat `race`, et l'accueil —
          monte au seul etat `title` — se serait demonte en emportant le
          tutoriel avec lui a la premiere sequence. Il passe APRES les
          touches d'attaque pour que ses deux boutons restent cliquables,
          et le reste de sa surface laisse passer les appuis. */}
      {tutoHaies && <TutorialHaies onClose={fermerLeTutoHaies} />}

      {/* Record mondial sur une course : passe au-dessus de tout ecran de fin,
          qu'on sorte d'une etape de carriere ou d'une epreuve one shot. */}
      <RecordPopup />
      <QuitRace />
      <InboxPopup />
      <AnnoncePopup />
      <InvitationDirecte />
      {/* Le lanceur d'un defi n'assiste pas a sa resolution : on la lui
          annonce ici, des son retour au calme. Comme pour PisteRelais
          ci-dessous, la porte se pose ici et non a l'interieur du composant :
          DUELS_OUVERTS vaut false en dur en production, et c'est cette forme
          precise — la constante en tete du && — qui permet au bundler de
          sortir le composant du build plutot que de l'y livrer inerte. */}
      {DUELS_OUVERTS && <DuelResultPopup />}
      {/* Le verdict de la sélection, une fois par championnat.
          Posé ici et non dans l'ecran-titre pour la meme raison que Bienvenue :
          il doit passer AU-DESSUS de l'accueil, pas dedans. Le composant decide
          seul s'il a une nouvelle a annoncer — et il n'en a une qu'au gel de la
          grille, pour qui etait dans la zone ou ca se jouait. */}
      {DUELS_OUVERTS && <SceneSelection />}
      {/* La course de relais se pose ici, et non dans l'onglet du vestiaire :
          l'ecran-titre disparait au coup de pistolet, et une salle tenue par
          un panneau demonte se fermerait a l'instant precis ou la course
          commence. */}
      {RELAIS_OUVERT && <PisteRelais />}
      {/* La presentation des athletes se joue SUR la piste, et doit donc
          survivre au montage de celle-ci — qui fait disparaitre l'ecran-titre
          et le panneau du direct avec lui. */}
      <PresentationDirect />
      {/* Les trois autres jeux, atteints par un geste depuis l'accueil. */}
      {MONDES_OUVERTS && <Mondes />}
      <InstallPrompt />
      <InviteNotifs />
      {/* Le nom, la nationalite, Instagram : demandes une fois, sur l'accueil,
          avant la premiere course. Le composant decide seul s'il a quelque
          chose a demander — pose ici plutot que dans l'ecran-titre pour
          passer AU-DESSUS de lui, et non dedans. */}
      <Bienvenue />
      {/* Le telephone qui vient de viser un QR code : la liaison se fait seule,
          et se pose au-dessus de tout le reste — c'est la seule chose que ce
          joueur-la ait demandee en ouvrant le jeu. */}
      <LiaisonEntrante />
      {/* Les confettis d'un record personnel et les feux d'artifice d'un
          record du monde. Montes ici, au-dessus de tous les ecrans de fin :
          une course de carriere, une epreuve one shot ou meme une defaite ou
          le chrono est tombe quand meme ont droit a la meme fete. */}
      <FeteRecords />
      {/* Le tableau des treize nuits. Pose ici plutot que dans l'ecran-titre
          pour la meme raison que Bienvenue : il doit passer AU-DESSUS de
          l'accueil, pas dedans. Il decide seul de s'afficher. */}
      {HALLOWEEN_OUVERT && <Suspense fallback={null}><PanneauMolosse /></Suspense>}
      </>)}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={MainGame} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  // Le tableau de bord passe par un parametre d'URL plutot que par une route :
  // GitHub Pages sert des fichiers, et un chemin dedie renverrait une 404 au
  // chargement direct — rien ne se chargerait, donc aucune route de wouter ne
  // serait atteinte.
  //
  // `public/404.html` ouvre une exception, et une seule : le chemin court des
  // defis, `/d/CODE`, qu'elle traduit en `?defi=` avant que quoi que ce soit
  // ne demarre. Ce n'est PAS un repli SPA — elle ne sert pas le jeu, elle
  // redirige — et c'est voulu : un repli complet enverrait les chemins de
  // `/test/` sur la production, puisque Pages sert le repli de la racine. Le
  // tableau de bord reste donc sur son parametre, comme le lien de defi.
  const [stats] = useState(dashboardRequested);
  // La file des recuperations suit la meme convention, et reste separee du
  // tableau de bord : elle ne s'ouvre pas avec la meme cle.
  const [file] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('recuperations'); }
    catch { return false; }
  });

  // Un passage compte une fois par session, et seulement pour le jeu : ouvrir
  // le tableau de bord ne doit pas gonfler ses propres chiffres.
  useEffect(() => { if (!stats && !file) pingVisit(); }, [stats, file]);

  if (file) return <FileRecuperations />;
  if (stats) return <Dashboard />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
