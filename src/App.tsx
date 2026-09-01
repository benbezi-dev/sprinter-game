import { type ReactNode, useEffect, useState } from 'react';
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

import { useGameStore } from '@/game/engine';
import { useBackGuard } from '@/hooks/use-back-guard';
import { GameCanvas } from '@/components/GameCanvas';
import { TouchControls } from '@/components/TouchControls';
import { EST_TEST } from '@/game/canal';
import { PorteTest } from '@/components/screens/PorteTest';
import { PisteRelais } from '@/components/screens/PisteRelais';
import { PresentationDirect } from '@/components/screens/PresentationDirect';
import { Mondes } from '@/components/screens/Mondes';
import { OpenScreen } from '@/components/screens/OpenScreen';
import { TitleScreen } from '@/components/screens/TitleScreen';
import { CutScreen } from '@/components/screens/CutScreen';
import { RaceHUD } from '@/components/screens/RaceHUD';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { OverScreen } from '@/components/screens/OverScreen';
import { WinAllScreen } from '@/components/screens/WinAllScreen';
import { FalseStartCut } from '@/components/screens/FalseStartCut';
import { OneShotEndScreen } from '@/components/screens/OneShotEndScreen';
import { RecordPopup } from '@/components/screens/RecordPopup';
import { QuitRace } from '@/components/screens/QuitRace';
import { DuelResultPopup } from '@/components/screens/DuelResultPopup';
import { InboxPopup } from '@/components/screens/InboxPopup';
import { InstallPrompt } from '@/components/screens/InstallPrompt';
import { LiaisonParLien } from '@/components/screens/LiaisonParLien';
import { Dashboard } from '@/components/screens/Dashboard';
import { dashboardRequested, pingVisit } from '@/game/stats';
import { ouvrirBoite } from '@/game/boite';
import { DUELS_OUVERTS } from '@/game/duels';

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
  useVisualViewportHeight();
  useBackGuard();

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
  /** Le decompte suspendu, c'est la presentation des athletes. */
  const enPresentation = state === 'count' && countT <= -90;

  return (
    <div className="relative w-full h-[var(--app-height,100dvh)] bg-[#060913] overflow-hidden font-sans text-foreground select-none touch-none">
      {EST_TEST && <PorteTest onOuvert={setAcces} />}
      {acces && (<>
      <GameCanvas />
      
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {state === 'open' && <OpenScreen />}
        {state === 'title' && <TitleScreen />}
        {state === 'cut' && <CutScreen />}
        {/* Pendant la presentation, le decompte est suspendu et l'etat vaut
            deja « count ». Le tableau de course n'a rien a y faire : « POUSSÉE
            0.00 », « à battre », « ALTERNE LES DEUX TOUCHES » s'empilaient
            par-dessus la presentation alors que personne ne court encore. */}
        {(state === 'count' || state === 'race') && !enPresentation && <RaceHUD />}
        {state === 'falseout' && <FalseStartCut />}
        {state === 'result' && <ResultScreen />}
        {state === 'over' && <OverScreen />}
        {/* Le one-shot a son propre recapitulatif : epreuves choisies,
            comparaison au fantome, creation du defi. Le TOP 500 ne concerne
            que la carriere complete, un cumul one-shot n'y a pas sa place. */}
        {state === 'winall' && (mode === 'oneshot' ? <OneShotEndScreen /> : <WinAllScreen />)}
      </div>
      
      {/* Invisible overlay for receiving touches during the race */}
      <TouchControls />

      {/* Record mondial sur une course : passe au-dessus de tout ecran de fin,
          qu'on sorte d'une etape de carriere ou d'une epreuve one shot. */}
      <RecordPopup />
      <QuitRace />
      <InboxPopup />
      {/* Le lanceur d'un defi n'assiste pas a sa resolution : on la lui
          annonce ici, des son retour au calme. Comme pour PisteRelais
          ci-dessous, la porte se pose ici et non a l'interieur du composant :
          DUELS_OUVERTS vaut false en dur en production, et c'est cette forme
          precise — la constante en tete du && — qui permet au bundler de
          sortir le composant du build plutot que de l'y livrer inerte. */}
      {DUELS_OUVERTS && <DuelResultPopup />}
      {/* La course de relais se pose ici, et non dans l'onglet du vestiaire :
          l'ecran-titre disparait au coup de pistolet, et une salle tenue par
          un panneau demonte se fermerait a l'instant precis ou la course
          commence. En production, EST_TEST vaut false en dur et tout ceci
          sort du build. */}
      {EST_TEST && <PisteRelais />}
      {/* La presentation des athletes se joue SUR la piste, et doit donc
          survivre au montage de celle-ci — qui fait disparaitre l'ecran-titre
          et le panneau du direct avec lui. */}
      <PresentationDirect />
      {/* Les trois autres jeux, atteints par un geste depuis l'accueil. En
          production, MONDES_OUVERTS vaut false en dur et rien de tout ceci
          n'est embarque. */}
      {EST_TEST && <Mondes />}
      <InstallPrompt />
      {/* Le telephone qu'on vient de viser arrive avec un jeton dans l'adresse.
          Il se consomme ici, au-dessus de tout : la liaison est la premiere
          chose a regler, avant meme l'ecran-titre. */}
      <LiaisonParLien />
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
  // GitHub Pages n'a pas de repli SPA ici, un chemin dedie renverrait une 404
  // au chargement direct. Meme convention que le lien de defi, ?defi=.
  const [stats] = useState(dashboardRequested);

  // Un passage compte une fois par session, et seulement pour le jeu : ouvrir
  // le tableau de bord ne doit pas gonfler ses propres chiffres.
  useEffect(() => { if (!stats) pingVisit(); }, [stats]);

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
