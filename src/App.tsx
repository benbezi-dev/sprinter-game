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
import { InboxPopup } from '@/components/screens/InboxPopup';
import { InstallPrompt } from '@/components/screens/InstallPrompt';
import { Dashboard } from '@/components/screens/Dashboard';
import { dashboardRequested, pingVisit } from '@/game/stats';

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
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', () => setTimeout(setHeight, 120));
    return () => window.removeEventListener('resize', setHeight);
  }, []);
}

function MainGame() {
  const state = useGameStore(s => s.state);
  const mode = useGameStore(s => s.mode);
  useVisualViewportHeight();
  useBackGuard();

  return (
    <div className="relative w-full h-[var(--app-height,100dvh)] bg-[#060913] overflow-hidden font-sans text-foreground select-none touch-none">
      <GameCanvas />
      
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {state === 'open' && <OpenScreen />}
        {state === 'title' && <TitleScreen />}
        {state === 'cut' && <CutScreen />}
        {(state === 'count' || state === 'race') && <RaceHUD />}
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
      <InstallPrompt />
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
