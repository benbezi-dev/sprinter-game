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
  transFlash: number;
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
  mode: 'campaign' | 'oneshot';
  shotRaces: string[];
  shotIdx: number;
  ghostName: string;
  ghostTime: number;
  challenge: any;
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

/**
 * Safari sur iOS n'implemente pas l'API Vibration, et ne l'a jamais fait :
 * aucun iPhone, aucune version. Android rend donc une petite secousse a
 * chaque foulee reconnue et une plus franche a chaque faux pas, quand
 * l'iPhone ne rend rien du tout.
 *
 * Cette secousse n'est pas un ornement : c'est la boucle de retour qui
 * permet de tenir l'alternance sans regarder ses pouces. Prive de ce canal,
 * on court a l'aveugle en fixant le coureur, le rythme se delite, et les
 * repetitions — seule cause de chute du jeu — se multiplient.
 *
 * Faute de vibreur, on rend le meme signal en vision peripherique.
 */
export const HAS_VIBRATION = typeof navigator !== 'undefined' &&
  (typeof navigator.vibrate === 'function' ||
   !!(window as any).Capacitor?.Plugins?.Haptics);

type Cue = (side: 'left' | 'right', kind: 'step' | 'trip') => void;
let stepCue: Cue | null = null;
export function setStepCue(fn: Cue | null) { stepCue = fn; }
function cue(side: 'left' | 'right', kind: 'step' | 'trip') {
  if (!HAS_VIBRATION && stepCue) stepCue(side, kind);
}

// Deux appuis du meme cote separes de moins de DUP_MS ne sont pas une faute
// de jeu : personne ne tape deux fois le meme pad en 80 ms. C'est un rebond
// du pouce, un double contact, ou la repetition automatique d'une touche
// maintenue. Les compter comme une repetition, c'est offrir une chute pour
// rien. On les ignore purement et simplement.
const DUP_MS = 80;
// Un appui du meme cote qui arrive apres un temps mort n'est pas une faute
// non plus : c'est le signe qu'un appui s'est perdu en route. Le joueur a
// bien alterne, mais le systeme n'a pas transmis un des deux coups — bord de
// l'ecran capte par un geste du systeme, doigt mal pose, image sautee. Une
// vraie faute, elle, tombe dans la cadence. On compare donc l'ecart au rythme
// que le joueur tient : au-dela de MISSED_BEAT fois sa cadence, il manque un
// temps, et on traite l'appui comme une alternance normale.
const MISSED_BEAT = 1.55;
let lastSide: 'left' | 'right' | null = null;
let lastAt = 0;
let cadence = 0;   // moyenne glissante de l'ecart entre deux appuis, en ms

/** Nouvelle course : le rythme de la precedente n'a rien a y faire. */
export function resetInputRhythm() {
  lastSide = null; lastAt = 0; cadence = 0;
}

const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

/**
 * Le jeu se joue-t-il au doigt ? Regle la tolerance aux fautes d'appui.
 * iOS perd nettement plus d'appuis qu'Android a cadence de course, sans que
 * la cause ait pu etre isolee : a geste identique les joueurs iPhone chutent
 * beaucoup plus. En attendant d'en trouver l'origine, on compense.
 */
export function setTouchInput(on: boolean) {
  C.STUMBLE_INPUT_SCALE = on
    ? (IS_IOS ? C.STUMBLE_IOS_SCALE : C.STUMBLE_TOUCH_SCALE)
    : 1;
}

export function padPress(side: 'left' | 'right') {
  const now = performance.now();
  const gap = lastAt ? now - lastAt : 0;
  const repeat = side === lastSide;

  if (repeat && lastAt && gap < DUP_MS) return;          // rebond, on ignore
  const missedBeat = repeat && cadence > 0 && gap > cadence * MISSED_BEAT;

  lastSide = side; lastAt = now;
  // Un temps mort fausserait la cadence : on ne l'y verse pas.
  if (gap > 0 && gap < 1000 && !missedBeat) {
    cadence = cadence ? cadence * 0.7 + gap * 0.3 : gap;
  }

  if (G.state === 'count') {
    if (!G.player.jumped) {
      G.player.jumped = true;
      G.player.freeze = C.FALSE_START_FREEZE;
      G.falseFlash = 1.6; G.shake = 0.7; Audio_.sfx('trip'); buzz(30);
    }
    return;
  }
  if (G.state !== 'race') return;
  // Appui manifestement perdu : le joueur a bien alterne, le moteur ne doit
  // pas y voir une repetition. On efface le dernier cote pour qu'il compte
  // comme une foulee normale, avec sa poussee pleine.
  if (missedBeat) G.player.lastKey = null;
  if (G.player.press(side, G.elapsed)) {
    G.stumbleFlash = 0.9; G.shake = 1; Audio_.sfx('trip'); buzz(30);
    cue(side, 'trip');
  } else if (G.player.tookStep()) {
    buzz(6);
    cue(side, 'step');
  }
}

// Garde l'attribut lang du document aligne sur la langue du jeu. Sans ca
// la page annonce une langue qui n'est pas celle affichee, et les
// navigateurs proposent de la traduire — une traduction navigateur
// reecrit les noeuds de texte sous les pieds de React et le fait planter.
export function syncHtmlLang() {
  try { document.documentElement.lang = SprinterApp.N.getLang(); } catch (e) { }
}

export function toggleLang() {
  SprinterApp.N.toggle();
  SprinterApp.save();
  syncHtmlLang();
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
  G.transFlash = Math.max(0, G.transFlash - dt);
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
    if (G.countT >= 3) {
      Audio_.sfx('go'); G.state = 'race'; G.elapsed = 0;
      resetInputRhythm();
    }
  } else if (G.state === 'race') {
    G.acc += dt;
    const step = 1 / 240;
    while (G.acc >= step) {
      G.acc -= step; G.elapsed += step;
      G.player.stepPlayer(step, G.elapsed);
      for (const r of G.runners) if (!r.isPlayer) r.stepAI(step, G.elapsed);
    }
    
    // Enregistre la course pour qu'un adversaire puisse la reaffronter en
    // fantome, et fait avancer le fantome que l'on affronte.
    if (G.recTrace) {
      while (G.elapsed >= G.recNext) {
        G.recTrace.push(Math.round(G.player.d * 10));
        G.recNext += SprinterApp.REC_STEP;
      }
    }
    SprinterApp.stepGhost(dt);

    if (G.player.reaction !== null && !G.reactShown) {
      G.reactShown = true; G.reactFlash = 2.2;
      if (!G.player.jumped) Audio_.sfx('beep');
    }
    if (G.player.transGrade !== null && !G.transShown) {
      G.transShown = true; G.transFlash = 2.4;
      if (G.player.transGrade) { Audio_.sfx('win'); G.flash = 0.6; }
    }
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
    transFlash: G.transFlash,
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
    mode: G.mode,
    shotRaces: G.shotRaces,
    shotIdx: G.shotIdx,
    ghostName: G.ghostName,
    ghostTime: G.ghostTime,
    challenge: G.challenge,
  });
}
