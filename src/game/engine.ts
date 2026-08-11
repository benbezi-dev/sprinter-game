import './sprinter-i18n.js';
import './sprinter-core.js';
import './sprinter-app.js';
import { useSyncExternalStore } from 'react';

export const SprinterI18N = (globalThis as any).SprinterI18N;
export const SprinterCore = (globalThis as any).SprinterCore;
export const SprinterApp = (globalThis as any).SprinterApp;

// RACES and LEVELS live on SprinterCore; mirror them onto SprinterApp so
// consumers can destructure either object.
SprinterApp.RACES = SprinterCore.RACES;
SprinterApp.LEVELS = SprinterCore.LEVELS;
SprinterApp.C = SprinterCore.C;

export type GameState = {
  state: 'open' | 'title' | 'cut' | 'count' | 'race' | 'result' | 'over' | 'winall';
  elapsed: number;
  countT: number;
  openT: number;
  shake: number;
  flash: number;
  stumbleFlash: number;
  reactFlash: number;
  falseFlash: number;
  cut: any;
  levelIdx: number;
  raceKey: '100' | '200' | '400';
  won: boolean;
  player: any;
  runners: any[];
  champion: string;
  championTime: number;
  runTime: number;
  furthest: { '100': number, '200': number, '400': number };
  badge: [string, string] | null;
  runRank: number | null;
  runs: { '100': number[], '200': number[], '400': number[] };
  skipArm: number;
  overChoice: number;
  ranking: any[];
  runSplits: number[];
};

// Create a reactive store to expose the game state to React without Zustand
class Store {
  state: GameState;
  listeners: Set<() => void>;

  constructor() {
    this.state = { ...SprinterApp.G };
    this.listeners = new Set();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.state;
  }

  setState(newState: Partial<GameState>) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach((l) => l());
  }
}

export const gameStore = new Store();

export function useGameStore(): GameState;
export function useGameStore<T>(selector: (state: GameState) => T): T;
export function useGameStore<T>(selector?: (state: GameState) => T) {
  const state = useSyncExternalStore(
    (l) => gameStore.subscribe(l),
    () => gameStore.getSnapshot()
  );
  return selector ? selector(state) : state;
}

// We'll write the update loop here
const { G, Audio_, clamp, THEMES, LEVELS, RACES } = SprinterApp;
const { C } = SprinterCore;
const { N } = SprinterI18N;

export function buzz(ms: number) {
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Haptics) {
      cap.Plugins.Haptics.impact({ style: ms > 12 ? 'MEDIUM' : 'LIGHT' });
      return;
    }
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { }
}

export function padPress(side: 'left' | 'right') {
  if (G.state === 'count') {
    if (!G.player.jumped) {
      G.player.jumped = true;
      G.player.freeze = C.FALSE_START_FREEZE;
      G.falseFlash = 1.6; G.shake = 0.7; Audio_.sfx('trip'); buzz(30);
    }
    return;
  }
  if (G.state !== 'race') return;
  if (G.player.press(side, G.elapsed)) {
    G.stumbleFlash = 0.9; G.shake = 1; Audio_.sfx('trip'); buzz(30);
  } else if (G.player.tookStep()) {
    buzz(6);
  }
}

export function toggleLang() {
  SprinterApp.N.toggle();
  SprinterApp.save();
  // Force a re-render so text updates
  gameStore.setState({});
}

export function toggleAudio() {
  SprinterApp.Audio_.toggle();
  gameStore.setState({});
}

export function updateLogic(dt: number) {
  G.skipArm = Math.max(0, G.skipArm - dt);
  G.reactFlash = Math.max(0, G.reactFlash - dt);
  G.falseFlash = Math.max(0, G.falseFlash - dt);
  G.shake = Math.max(0, G.shake - dt * 3.2);
  G.flash = Math.max(0, G.flash - dt * 1.4);
  G.stumbleFlash = Math.max(0, G.stumbleFlash - dt);

  if (G.state === 'title' || G.state === 'open') Audio_.music('menu');
  else if (G.state === 'cut')
    Audio_.music(G.cut && G.cut.kind === 'intro' ? Audio_.raceTrack(G.levelIdx) : 'menu');
  else if (G.state === 'race' || G.state === 'count')
    Audio_.music(Audio_.raceTrack(G.levelIdx));

  if (G.state === 'open') {
    G.openT += dt;
    if (G.openT > 6.4) G.state = 'title';
  } else if (G.state === 'cut') {
    G.cut.t += dt;
    G.cut.man.stride += dt * (G.cut.kind === 'intro' ? 11 : 3.2);
    if (G.cut.t > 15.4) SprinterApp.nextCut();
  } else if (G.state === 'count') {
    const prev = Math.floor(G.countT);
    G.countT += dt;
    if (Math.floor(G.countT) !== prev && G.countT < 3) Audio_.sfx('beep');
    SprinterApp.followCam(dt);
    if (G.countT >= 3) { Audio_.sfx('go'); G.state = 'race'; G.elapsed = 0; }
  } else if (G.state === 'race') {
    G.acc += dt;
    const step = 1 / 240;
    while (G.acc >= step) {
      G.acc -= step; G.elapsed += step;
      G.player.stepPlayer(step, G.elapsed);
      for (const r of G.runners) if (!r.isPlayer) r.stepAI(step, G.elapsed);
    }
    
    if (G.player.reaction !== null && !G.reactShown) {
      G.reactShown = true; G.reactFlash = 2.2;
      if (!G.player.jumped) Audio_.sfx('beep');
    }
    // Le rythme n'a plus de "moment" a annoncer : il se lit en direct sur
    // la jauge du HUD, donc plus de flash ponctuel ici.
    SprinterApp.followCam(dt);
    
    const out = G.player.finished && G.player.d >= G.track.total + C.RUNOUT;
    const slow = G.player.finished && G.elapsed >= G.player.finishTime + 3;
    if (out || slow || G.elapsed >= 90) {
      for (const r of G.runners)
        if (!r.finished && !r.isPlayer) r.finishTime = r.target;
      SprinterApp.finishRace();
    }
  }

  // Update React store
  gameStore.setState({
    state: G.state,
    elapsed: G.elapsed,
    countT: G.countT,
    openT: G.openT,
    shake: G.shake,
    flash: G.flash,
    stumbleFlash: G.stumbleFlash,
    reactFlash: G.reactFlash,
    falseFlash: G.falseFlash,
    cut: G.cut,
    levelIdx: G.levelIdx,
    raceKey: G.raceKey,
    won: G.won,
    player: G.player,
    runners: G.runners,
    champion: G.champion,
    championTime: G.championTime,
    runTime: G.runTime,
    furthest: G.furthest,
    badge: G.badge,
    runRank: G.runRank,
    runs: G.runs,
    skipArm: G.skipArm,
    overChoice: G.overChoice,
    ranking: G.ranking,
    runSplits: G.runSplits,
  });
}
