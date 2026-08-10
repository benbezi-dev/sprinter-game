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

function MainGame() {
  const state = useGameStore(s => s.state);
  
  return (
    <div className="relative w-full h-[100dvh] bg-[#060913] overflow-hidden font-sans text-foreground select-none touch-none">
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
