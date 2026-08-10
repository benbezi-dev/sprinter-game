import { type ReactNode, useEffect } from 'react';
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
import { GameCanvas } from '@/components/GameCanvas';
import { TouchControls } from '@/components/TouchControls';
import { OpenScreen } from '@/components/screens/OpenScreen';
import { TitleScreen } from '@/components/screens/TitleScreen';
import { CutScreen } from '@/components/screens/CutScreen';
import { RaceHUD } from '@/components/screens/RaceHUD';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { OverScreen } from '@/components/screens/OverScreen';
import { WinAllScreen } from '@/components/screens/WinAllScreen';

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
  useVisualViewportHeight();

  return (
    <div className="relative w-full h-[var(--app-height,100dvh)] bg-[#060913] overflow-hidden font-sans text-foreground select-none touch-none">
      <GameCanvas />
      
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {state === 'open' && <OpenScreen />}
        {state === 'title' && <TitleScreen />}
        {state === 'cut' && <CutScreen />}
        {(state === 'count' || state === 'race') && <RaceHUD />}
        {state === 'result' && <ResultScreen />}
        {state === 'over' && <OverScreen />}
        {state === 'winall' && <WinAllScreen />}
      </div>
      
      {/* Invisible overlay for receiving touches during the race */}
      <TouchControls />
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
