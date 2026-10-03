import './sprinter-i18n.js';
import './coureur-hd.js';
// Les corps des athletes reels, sculptes a part : ils se posent sur
// SprinterHD, donc APRES coureur-hd.js, qui le cree.
import './coureur-vedettes.js';
import './coureur-premium.js';
import './sprinter-core.js';
import './chiffres-piste.js';
// La couche de finition s'installe sur globalThis AVANT le rendu qui l'appelle.
// L'ordre compte : `sprinter-app.js` la cherche a chaque image plutot qu'au
// chargement (voir PREM()), donc le jeu demarrerait meme sans — mais il
// demarrerait alors sans finition pendant les premieres images.
import './rendu-premium.js';
// Le vide sous la piste intergalactique : etoiles, nebuleuses, planetes.
import './decor-cosmos.js';
// La piste arc-en-ciel : ses couloirs de lumiere, ses reflets, ses guirlandes.
import './piste-arc-en-ciel.js';
// Les decors des stades, rendus dans Blender : le manifeste d'abord (ou est le
// pied de chaque piece dans son image), puis le module qui les pose.
import decorsManifeste from './decors-manifeste.json';
(globalThis as any).SprinterDecorsManifeste = decorsManifeste;
// La serie ULTRA des memes pieces (fabriquer.py --ultra), pour une toile a
// trois pixels par point : voir rendu() dans decors-stades.js.
import decorsManifesteUltra from './decors-manifeste-ultra.json';
(globalThis as any).SprinterDecorsManifesteUltra = decorsManifesteUltra;
import './decors-stades.js';
// Le Champ-de-Mars : ses pieces rendues dans Blender (tools/blender/decors/
// champ-de-mars.py), puis le module qui les pose — et qui dessine a la main
// ce qui n'est pas encore charge.
import champDeMarsManifeste from './champ-de-mars-manifeste.json';
(globalThis as any).ChampDeMarsManifeste = champDeMarsManifeste;
import champDeMarsManifesteUltra from './champ-de-mars-manifeste-ultra.json';
(globalThis as any).ChampDeMarsManifesteUltra = champDeMarsManifesteUltra;
import './decor-champ-de-mars.js';
// Le public des gradins, rendu dans Blender : son manifeste, puis ses rangees.
import tribuneManifeste from './tribune-manifeste.json';
(globalThis as any).SprinterTribuneManifeste = tribuneManifeste;
// L'atlas du palier ULTRA (tribune.py --ultra), une fois et demie plus dense :
// tribune.js n'en charge qu'un, selon la densite de la toile.
import tribuneManifesteUltra from './tribune-manifeste-ultra.json';
(globalThis as any).SprinterTribuneManifesteUltra = tribuneManifesteUltra;
import './tribune.js';
// La couleur du logo des panneaux, choisie pour se detacher de chaque stade.
import './teintes-pub.js';
// La lumiere de l'heure : les stades a ciel de jour se courent a l'heure ou
// l'on joue. Lue a l'usage par sprinter-app.js (HEURE()), comme la finition.
import './heure-du-jour.js';
import './sprinter-app.js';
import { useSyncExternalStore } from 'react';
import { jugerLaCourse } from './fete';
import type { RaceKey } from './leaderboard';
import { suivreTunnel, etapeTunnel } from './tunnel';
import { lancerChargement, chargementFini, partChargee } from './chargement';

export const SprinterI18N = (globalThis as any).SprinterI18N;
export const SprinterCore = (globalThis as any).SprinterCore;
export const SprinterApp = (globalThis as any).SprinterApp;

// RACES and LEVELS live on SprinterCore; mirror them onto SprinterApp so
// consumers can destructure either object.
SprinterApp.RACES = SprinterCore.RACES;
SprinterApp.LEVELS = SprinterCore.LEVELS;
SprinterApp.C = SprinterCore.C;

/**
 * LE STARTER EST MUET.
 *
 * Le decompte sonnait trois bips avant le coup de feu — l'appel aux marques,
 * puis « prets ». On les a coupes : trois impulsions egalement espacees
 * annoncent la quatrieme, et le joueur part alors sur une pulsation qu'il
 * compte, et non au coup de feu. C'est la reaction elle-meme qu'on mesure
 * faux. Le decompte se voit toujours a l'ecran ; seule la detonation
 * s'entend.
 *
 * Le geste est garde dans la boucle plutot que supprime : ce reglage a
 * change deux fois, il changera peut-etre encore, et le remettre ne doit
 * pas demander de rouvrir la boucle de jeu.
 */
const STARTER_MUET = true;

// Le moteur est du JavaScript ancien, sans acces aux modules : il previent
// par ce crochet quand une course est terminee, et la couche moderne se
// charge de l'envoyer.
SprinterApp.G.onRaceRecorded = (race: string, t: number, mode: string, level: number) => {
  pushFinishedRace(race, t, mode, level);
  if (!SprinterApp.G.rejeu) etapeTunnel('arrivee');
  // Le chrono se juge ici et nulle part ailleurs : c'est le seul endroit ou
  // l'on voit passer TOUTES les courses terminees, carriere comme one shot,
  // et ou l'historique de la distance est encore sous la main. L'ecran de fin
  // n'aura plus qu'a laisser tomber les confettis.
  jugerLaCourse(race, t, SprinterApp.G.player);
};

export type GameState = {
  state: 'open' | 'title' | 'cut' | 'count' | 'race' | 'result' | 'over' | 'winall' | 'falseout';
  elapsed: number;
  countT: number;
  openT: number;
  /** La part des images chargee par l'ecran d'ouverture, de 0 a 1. */
  chargement: number;
  /**
   * Ce que le starter a deja dit : 0 rien, 1 « a vos marques », 2 « pret »,
   * 3 le coup est parti. C'est ce que le tableau de course affiche a la place
   * du decompte, sur le canal de test — celui qui essaie le starter. Dans le
   * jeu publie, le depart reste un decompte et ce nombre ne bouge pas de 0 :
   * c'est `countT` qu'on y lit.
   */
  starter: number;
  shake: number;
  flash: number;
  stumbleFlash: number;
  reactFlash: number;
  transFlash: number;
  falseFlash: number;
  cut: any;
  /** Le sacre qui s'efface par-dessus le generique, pendant le croisement. */
  sortie: any;
  levelIdx: number;
  raceKey: RaceKey;
  won: boolean;
  player: any;
  runners: any[];
  champion: string;
  championTime: number;
  runTime: number;
  furthest: Record<RaceKey, number>;
  badge: [string, string] | null;
  runRank: number | null;
  runs: Record<RaceKey, number[]>;
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
  paused: boolean;
  falseOut: boolean;
  /** Mode fantome : ou en est l'adversaire, en direct. */
  ghostOn: boolean;
  ghostD: number;
  ghostDone: boolean;
  /** Course en direct : l'adversaire court en meme temps. */
  liveOn: boolean;
  liveNom: string;
  liveResultat: any;
  /** Les points du duel du direct, tels que la salle les a annonces. */
  liveDuel: any;
  /**
   * Le photo-finish d'une arrivee serree en direct, voir suivrePhoto dans
   * sprinter-app.js. `lui` est nul tant que son chrono n'est pas arrive.
   */
  photo: { etat: 'attente' | 'tranche'; nom: string; moi: number;
           lui: number | null; ecartM: number } | null;
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

// Les images des decors et du public, pendant l'ecran d'ouverture.
lancerChargement();
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

/**
 * Charge en tache de fond les noms du haut du TOP 500, dont les Jeux
 * mondiaux garnissent leur plateau. buildLevel est synchrone : les noms
 * doivent etre la avant la course, pas pendant. Si le reseau ne repond pas,
 * G.topNames reste vide et le plateau maison sert de repli.
 */
export function primeTopNames(races: readonly RaceKey[] = ['100', '200', '400']) {
  import('./leaderboard').then(({ fetchTopNames }) => {
    races.forEach(race => {
      fetchTopNames(race)
        .then(names => { G.topNames[race] = names; })
        .catch(() => { /* repli sur le plateau maison */ });
    });
  });
}

/**
 * Une course vient de se terminer : on la pousse a l'historique distant, pour
 * qu'elle suive le joueur d'un appareil a l'autre. Le moteur l'a deja rangee
 * en local, cet envoi ne bloque donc rien.
 */
export function pushFinishedRace(race: string, seconds: number, mode: string, level: number) {
  import('./history').then(({ pushRace }) => pushRace(race as any, seconds, mode, level))
    .catch(() => { /* module ou reseau indisponible : le local suffit */ });
  // Le record de l'appareil vient peut-etre de bouger, et l'ecran d'arrivee
  // s'affiche avant que le serveur en sache quoi que ce soit. Sans cette
  // ligne, il annoncerait « record 8,50 s » sous le 8,43 s qu'il vient
  // lui-meme d'afficher.
  //
  // Import differe, comme au-dessus : `record.ts` importe ce module, et une
  // dependance circulaire au chargement laisserait `SprinterApp` indefini.
  import('./record').then(({ noterCourse }) => noterCourse(race as any))
    .catch(() => { /* l'affichage du record n'est pas vital a la course */ });
}

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
  if (G.paused) return;               // course suspendue : les pads sont muets
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
    // PENDANT LE CRI D'AVANT LES BLOCS, rien n'est annonce : on ne peut pas
    // partir avant un depart qui n'a pas commence (voir G.avantDepart).
    if (G.avantDepart && G.avantDepart.reste > 0) return;
    // EN CHAMPIONNAT, LE TELEPHONE NE SE JUGE PAS. Il dit a la salle qu'on
    // est parti avant le coup, et a quel instant ; c'est elle qui decide du
    // rappel et du carton (voir worker/src/faux-depart.js). Rien ici ne
    // gele le coureur ni ne l'elimine : si la salle ne retient rien, il part
    // simplement sans bonus de reaction.
    //
    // Pas pendant la presentation ni pendant la scene du rappel (`countT`
    // suspendu a -99) : aucun depart n'est annonce, on ne peut pas partir
    // avant lui.
    if (G.champDirect) {
      if (!G.player.jumped && !G.spectateur && !G.rappel && G.countT > -90) {
        G.player.jumped = true;
        salleLive?.fauxDepart?.((G.countT - 3) * 1000);
        buzz(40);
      }
      return;
    }
    if (!G.player.jumped) {
      // One-shot et defi : la course ne se rejoue pas, le faux depart elimine.
      // En carriere il coute seulement un blocage au coup de pistolet.
      if (SprinterApp.falseStartOut()) { buzz(120); return; }
      G.player.jumped = true;
      G.player.freeze = C.FALSE_START_FREEZE;
      G.falseFlash = 1.6; G.shake = 0.7; Audio_.sfx('trip'); buzz(30);
    }
    return;
  }
  if (G.state !== 'race') return;
  // Parti des blocs : la marche du tunnel ou l'on sait qu'il a joue, et pas
  // seulement regarde le decompte. Voir game/tunnel.ts.
  if (!G.rejeu && !G.spectateur) etapeTunnel('premier_appui');

  // LE SAUT EN LONGUEUR, avant tout le reste. Sur la piste d'elan, un appui
  // est une foulee ; dans le dernier metre, c'est l'appel ; en l'air, un
  // ciseau ou le ramene. C'est le jeu du saut qui le dit (longueur-course.js),
  // et il rend `null` quand l'appui est une foulee ordinaire, que le moteur
  // traite comme au 100 m.
  if (G.appuiSaut) {
    const geste = G.appuiSaut(side);
    if (geste) {
      buzz(geste === 'appel' ? 22 : geste === 'ramene' ? 16 : 6);
      cue(side, 'step');
      return;
    }
  }

  // LE PAVE FAIT LA HAIE.
  //
  // Dans la fenetre d'approche, cet appui n'est pas une foulee de plus : c'est
  // l'APPEL, et le moteur ne doit pas le voir passer une seconde fois —
  // appeler() fait deja tout ce que fait press(), et davantage (le rythme, la
  // jambe, la poussee mesuree sur Jackson). On sort donc ici.
  //
  // C'est aussi ce qui rend le geste gratuit : le pouce ne quitte pas son pave,
  // il y reste appuye. Le maintien porte le vol — ou l'on ne doit de toute
  // facon plus marteler — et le relache fait le ciseau (padRelease).
  if (G.appelHaies) {
    const juge = G.appelHaies(side);
    if (juge) { buzz(18); cue(side, 'step'); return; }
  }

  // EN L'AIR, LES PAVES NE POUSSENT PLUS — ILS COUTENT.
  //
  // Runner.press() sort a sa premiere ligne quand le coureur est gele, AVANT
  // de noter la touche : une frappe donnee au-dessus d'une haie ne coutait donc
  // rien, et l'on pouvait tenir sa cadence a travers les dix sans jamais lever
  // les pouces. C'est la moitie de la raison pour laquelle Hurdlers se joue
  // comme Sprinter. Le detour se fait ici, avant le moteur, et le crochet vient
  // des haies (haies-course.js) — le moteur ne les connait toujours pas.
  //
  // Le retour rouge est volontaire : une frappe qui coute doit se voir a
  // l'instant ou elle part, sans quoi le joueur n'apprend jamais a lever le
  // pouce. Plus bref et plus pale qu'un vrai accroc — ce n'est pas une chute.
  if (G.volHaies && G.volHaies()) {
    G.stumbleFlash = 0.35;
    cue(side, 'trip');
    buzz(12);
    return;
  }

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

/**
 * LE POUCE SE LEVE — le ciseau.
 *
 * Appuyer lance la jambe d'attaque, relacher ramene la jambe arriere : un seul
 * geste continu, comme un hurdleur qui ne fait pas deux choses mais une. Hors
 * d'un vol, lever le pouce n'a jamais rien fait et ne fait toujours rien.
 *
 * Le retour est deliberement different des deux cotes du jugement : un ciseau
 * net doit se sentir autrement qu'un ciseau rate, sans quoi le joueur
 * n'apprendrait qu'au bandeau, une demi-seconde trop tard.
 */
export function padRelease(side: 'left' | 'right') {
  if (G.paused) return;
  // Le pouce qui quitte la planche : c'est lui qui fixe l'angle d'envol.
  if (G.relacheSaut) {
    if (G.relacheSaut(side)) buzz(14);
    return;
  }
  if (!G.relacherHaies) return;
  const jc = G.relacherHaies(side);
  if (!jc) return;
  if (jc.note === 'ciseau') { buzz(10); cue(side, 'step'); }
  else { buzz(24); cue(side, 'trip'); }
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

/** Etats ou une course est reellement en cours et peut etre suspendue. */
const PAUSABLE = new Set(['count', 'race']);

export function pauseRace() {
  if (PAUSABLE.has(G.state)) { G.paused = true; gameStore.setState({ paused: true }); }
}
export function resumeRace() {
  G.paused = false; gameStore.setState({ paused: false });
}

/**
 * Salle de course en direct. Le moteur ignore tout du reseau : il expose sa
 * position, et cette couche la transmet. Dix envois par seconde suffisent —
 * l'adversaire est interpole a l'affichage, et un flux plus dense n'ajoute
 * que du trafic.
 *
 * Chaque position part avec l'instant de NOTRE course ou on y etait, en
 * millisecondes depuis notre coup de pistolet : c'est ce qui permet a l'autre
 * de nous montrer la ou nous en sommes a SON instant de course, et non la ou
 * nous etions quand le paquet est parti. Voir recevoirPosition dans
 * sprinter-app.js. Le relais branche ici des fonctions qui ne prennent que la
 * distance ; le second argument leur est simplement inutile.
 */
let salleLive: {
  position(d: number, c?: number): void;
  fini(ms: number): void;
  /** Championnat seulement : signaler un appui avant le coup. */
  fauxDepart?(ms: number): void;
} | null = null;
let prochainEnvoi = 0;
let finEnvoyee = false;

export function brancherSalle(s: typeof salleLive) {
  salleLive = s;
  prochainEnvoi = 0;
  finEnvoyee = false;
}

/**
 * Remet l'emission a zero pour la course qui commence.
 *
 * Les deux compteurs sont cales sur `G.elapsed`, qui repart de zero a chaque
 * coup de pistolet — mais ils vivaient, eux, aussi longtemps que la salle.
 * Une seconde course dans la meme salle heritait donc d'un `prochainEnvoi`
 * pose a la fin de la premiere : dix secondes dans le futur, c'est-a-dire
 * apres l'arrivee. Le joueur ne transmettait plus une seule position, et
 * l'adversaire le voyait immobile sur la ligne de depart du debut a la fin,
 * sans faux depart et sans erreur. `finEnvoyee`, reste vrai, retenait en plus
 * le chrono d'arrivee : la salle n'avait alors plus de quoi trancher.
 *
 * Le relais rebranchait sa salle a chaque depart et echappait donc au piege ;
 * le direct, qui branche la sienne a la connexion, tombait dedans des la
 * revanche. La remise a zero appartient au depart, pas au branchement.
 */
export function reinitialiserEnvoi() {
  prochainEnvoi = 0;
  finEnvoyee = false;
}

function pousserPosition() {
  // Un spectateur ne court plus : la salle ignorerait ce qu'il enverrait.
  if (!salleLive || G.spectateur) return;
  // La ligne d'abord, et a son instant exact : le chrono, pas l'image ou on
  // s'en apercoit, qui arrive jusqu'a un soixantieme plus tard et un peu plus
  // loin. Envoyee apres la position ordinaire de la meme image, elle serait
  // moins loin qu'elle — et la salle, qui ne garde que la plus lointaine,
  // l'aurait jetee.
  if (!finEnvoyee && G.player.finished && G.player.finishTime != null) {
    finEnvoyee = true;
    salleLive.position(G.track.total, G.player.finishTime * 1000);
    salleLive.fini(G.player.finishTime * 1000);
  }
  if (G.elapsed >= prochainEnvoi) {
    prochainEnvoi = G.elapsed + 0.1;
    salleLive.position(G.player.d, G.elapsed * 1000);
  }
}

/** Le temps debout avant « a vos marques », en solo : celui du cri de Meba-Mickael. */
const ATTITUDES_S = 2.6;

/**
 * SES MAINS AVANT LES BLOCS (G.avantDepart.claps, pose par game/vedettes.ts).
 *
 * Debout derriere ses blocs, il crie « LET'S GOO ! » et frappe dans ses mains
 * devant son visage : le clap de son look (L.clap, pose() dans
 * sprinter-core.js), qui monte avec `celebrate` comme quand on le presente. Sa
 * cadence vient de la phase de foulee (`stride`, 1,1 par seconde : celle de la
 * presentation, voir presenterCoureur) ; on la cale pour que chaque frappe
 * tombe a l'instant demande, et le claquement part avec (`meba_clap`, fabrique
 * au chargement du cri). Les bras redescendent ensuite d'eux-memes : le
 * decompte appelle finirLesSaluts.
 */
function applaudir(avD: any, dt: number) {
  const claps: number[] = avD.claps;
  const r = (G.runners || []).find((x: any) => x.look && x.look.clap && !x.isPlayer);
  if (!r) return;
  const t = avD.t, debut = claps[0] - 0.25, fin = claps[claps.length - 1] + 0.25;
  const doux = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  r.celebrate = doux((t - debut) / 0.2) * (1 - doux((t - fin) / 0.3));
  // debout, droit, face a la ligne, des l'ouverture (pose : `debout`)
  r.debout = doux(t / 0.25);
  // pose() frappe quand stride / 1,1 vaut (k + 1/2) / 2,5. DES FRAPPES
  // IRREGULIERES (02/10, « pas assez humain » ; vedettes.ts, humaniser) : entre
  // deux frappes, la phase avance d'une frappe exactement, a la vitesse qu'il
  // faut pour tomber sur la suivante ; avant la premiere et apres la derniere,
  // au rythme de la presentation.
  const P = 1 / 2.5, n = claps.length;
  // SON CRI (03/10, a la demande de l'auteur : « donne plus d'attitude a
  // Mickael lorsqu'il crie let's go »). Il s'arme, accroupi, les poings
  // serres (`cri`) ; sur « LET'S » (0,2 s apres le debut de son
  // enregistrement), il jaillit — un bond, les deux poings au ciel, la tete
  // renversee (`criHaut`, `criBond`) — et ses bras passent aux claps du
  // « GOOO ». Apres le dernier clap, un dernier coup de poings vers le bas
  // (`cri` et `criCoup`), fini avant les blocs. Les angles : CRI et CRI_HAUT
  // (pose, sprinter-core.js).
  // (une premiere version plongeait vers le bas sur « LET'S » : douze
  // centimetres, soit deux points sur un telephone a l'echelle de la course —
  // « pas de modification visible ». Les poings au ciel se voient.)
  const lets = (avD.a ?? 0.25) + 0.20, dernier = claps[n - 1];
  const coup = (x: number) => x <= 0 ? 0 : Math.min(1, 2.2 * (1 - Math.exp(-x / 0.03)) * Math.exp(-x / 0.18));
  r.cri = Math.max(
    doux((t - (lets - 0.32)) / 0.2) * (1 - doux((t - (lets - 0.06)) / 0.1)),
    0.85 * doux((t - (dernier + 0.12)) / 0.15) * (1 - doux((t - (dernier + 0.62)) / 0.2)));
  r.criCoup = 0.8 * coup(t - (dernier + 0.27));
  r.criHaut = doux((t - (lets - 0.06)) / 0.1) * (1 - doux((t - debut) / 0.22));
  const xb = t - (lets - 0.04);
  r.criBond = xb > 0 && xb < 0.3 ? Math.sin(Math.PI * xb / 0.3) : 0;
  // LE PLAN SUR LUI (03/10, « pas de modification visible dans le mode
  // test »). A l'echelle de la course il mesure une cinquantaine de points sur
  // un telephone : son cri ne s'y lisait pas. La camera va le chercher et se
  // resserre pendant qu'il crie — le plan serre de la presentation du direct
  // (zoomPres, que le decompte desserre dans finirLesSaluts, ou la camera est
  // aussi rendue au joueur). Rien de tout cela sous « reduire les animations ».
  if (!animationsReduites()) {
    if (!G.viseCamera) {
      const lui = () => G.track.pos(r.d, r.lane);
      (lui as any).cri = true;
      G.viseCamera = lui;
    }
    const z = G.zoomPres || 1;
    G.zoomPres = z + (PLAN_DU_CRI - z) * (1 - Math.exp(-5 * dt));
  }
  let tc: number;
  if (t <= claps[0]) tc = 0.5 * P - (claps[0] - t);
  else if (t >= claps[n - 1]) tc = (n - 0.5) * P + (t - claps[n - 1]);
  else {
    let k = 0;
    while (t > claps[k + 1]) k++;
    tc = (k + 0.5 + (t - claps[k]) / (claps[k + 1] - claps[k])) * P;
  }
  r.stride = 1.1 * Math.max(0, tc) - (r.decalePas || 0);
  while (avD.frappes < claps.length && t >= claps[avD.frappes] - 0.02) {
    avD.frappes++;
    // les claps de la batterie de son morceau, jamais tout a fait le meme :
    // l'une des quatre variantes (musique-defi-meba.ts). FORT, ET PAS TIMIDE (02/10) :
    // jamais moins fort que son cri (0,95), un peu plus a l'occasion
    const v = Math.floor(Math.random() * 4);
    Audio_.sfx(`meba_clap_${v}`, { gain: 1.0 + 0.15 * Math.random(), rate: 0.96 + 0.08 * Math.random() });
  }
}

/** Le plan serre sur Meba-Mickael pendant son cri (voir applaudir) : a 1,9 il
 *  ne prenait qu'un neuvieme de la hauteur de l'ecran, a 3 un cinquieme — ses
 *  poings au ciel s'y lisent. Le sprint n'a pas d'autre zoom (zoomDuMode = 1). */
const PLAN_DU_CRI = 3.0;

/** Le reglage « reduire les animations » du systeme : ni zoom ni travelling. */
function animationsReduites(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function updateLogic(dt: number) {
  // Le tunnel des premiers pas lit les changements d'etat, rien d'autre.
  suivreTunnel(G);
  // Course suspendue : le monde se fige, mais on continue a rendre l'image
  // et a alimenter React, sinon le panneau de sortie ne s'afficherait pas.
  if (G.paused && PAUSABLE.has(G.state)) {
    gameStore.setState({ paused: true, state: G.state });
    return;
  }

  G.skipArm = Math.max(0, G.skipArm - dt);
  G.reactFlash = Math.max(0, G.reactFlash - dt);
  G.transFlash = Math.max(0, G.transFlash - dt);
  G.falseFlash = Math.max(0, G.falseFlash - dt);
  G.shake = Math.max(0, G.shake - dt * 3.2);
  G.flash = Math.max(0, G.flash - dt * 1.4);
  G.stumbleFlash = Math.max(0, G.stumbleFlash - dt);

  // Le championnat en direct joue son propre morceau, cale sur la salle (voir
  // game/musique-championnat.ts) : la musique de course ferait deux morceaux a
  // la fois. Tant qu'il n'est pas charge, ce drapeau reste faux et la course
  // garde la sienne.
  if (G.musiqueChamp) Audio_.stop();
  else if (G.state === 'title' || G.state === 'open') Audio_.music('menu');
  else if (G.state === 'cut') {
    // Le generique porte sa propre musique, et c'est la seule cinematique dans
    // ce cas : la boucle du menu par-dessus un morceau ferait deux musiques a
    // la fois. Voir game/generique.ts.
    if (G.cut && G.cut.kind === 'ending') Audio_.stop();
    else Audio_.music(G.cut && G.cut.kind === 'intro' ? Audio_.raceTrack(G.levelIdx) : 'menu');
  }
  // Son cri avant les blocs se lance dans le silence : la musique de course
  // part avec « a vos marques », a l'heure ou sa fiche FL Studio l'attend
  // (docs/musique-defi-meba.md).
  // (les attitudes d'avant le depart, elles, se font sur la musique : seul le
  // cri demande le silence)
  else if (G.state === 'count' && G.avantDepart && G.avantDepart.reste > 0 && G.avantDepart.cri) Audio_.stop();
  else if (G.state === 'race' || G.state === 'count')
    Audio_.music(Audio_.raceTrack(G.levelIdx));

  if (G.state === 'open') {
    G.openT += dt;
    // L'ouverture attend que les images soient la (chargement.ts).
    if (G.openT > 6.4 && chargementFini()) G.state = 'title';
  } else if (G.state === 'cut') {
    G.cut.t += dt;
    G.cut.man.stride += dt * (G.cut.kind === 'intro' ? 11
      : G.cut.kind === 'ending' ? 7.5 : 3.2);
    // Le sacre qui s'efface par-dessus le generique continue de vivre le temps
    // du croisement : son coureur court encore, ses confettis tombent encore,
    // et son texte s'eteint avec lui. Un sacre fige pendant deux secondes se
    // verrait autant qu'une coupe. Voir nextCut dans sprinter-app.js.
    if (G.sortie) {
      G.sortie.age += dt;
      G.sortie.t += dt;
      G.sortie.man.stride += dt * 3.2;
      G.sortie.a = clamp(1 - G.sortie.age / G.sortie.duree, 0, 1);
      if (G.sortie.a <= 0) G.sortie = null;
    }
    // Le generique dure ce que dure son morceau, pas quinze secondes : c'est
    // l'ecran qui rend la main, a la derniere note ou au geste du joueur.
    //
    // Le sacre, lui, bascule un croisement plus tot quand c'est le generique
    // qui suit : les deux se chevauchent, et le sacre dure au total ce qu'il
    // durait avant.
    const finDuCut = (G.cut.kind === 'champion' && G.cutQueue[0] === 'ending')
      ? SprinterApp.CUT_DUREE - SprinterApp.CUT_CROISEMENT
      : SprinterApp.CUT_DUREE;
    if (G.cut.kind !== 'ending' && G.cut.t > finDuCut) SprinterApp.nextCut();
  } else if (G.state === 'count') {
    // l'horloge des attitudes d'avant le depart (pose, phaseBlocs)
    G.attT = (G.attT || 0) + dt;
    // En direct, le decompte reste suspendu tant que la salle n'a pas annonce
    // l'heure du coup de pistolet : partir « dans trois secondes » chez soi
    // ferait partir les deux joueurs a des instants differents.
    if (G.liveOn && G.countT <= -90) {
      // LE RAPPEL se joue sur le meme decompte suspendu que la presentation :
      // c'est lui qui fait vivre l'image, le temps que la salle a annonce.
      if (G.rappel) {
        SprinterApp.stepRappel(dt);
        gameStore.setState({ state: G.state, countT: G.countT });
        return;
      }
      // Decompte suspendu : c'est le temps de la presentation. La piste est
      // deja montee, tout le monde est dans son couloir — on fait vivre la
      // scene plutot que de la figer, sans quoi le joueur regarderait une
      // photographie pendant vingt secondes.
      SprinterApp.stepPresentation(dt);
      // `countT` part avec l'etat : c'est a lui qu'on reconnait une
      // presentation d'un vrai decompte, et sans lui l'interface affichait le
      // tableau de course par-dessus — « a battre », « alterne les deux
      // touches » — alors que personne ne court encore.
      gameStore.setState({ state: G.state, countT: G.countT });
      return;
    }
    // LE CRI D'AVANT LES BLOCS (G.avantDepart, pose par game/vedettes.ts).
    //
    // Meba-Mickael Zeze crie « LET'S GOO ! » debout derriere ses blocs, avant
    // de s'y installer. Le decompte part sur « a vos marques » des sa
    // premiere image : il faut donc un temps AVANT lui, ou tout le monde
    // attend debout — `countT` reste a zero (personne n'est dans les blocs,
    // voir phaseBlocs), et l'interface le lit comme une presentation (-99) :
    // ni chiffre, ni « alterne les deux touches ». Les appuis n'y comptent pas
    // (padPress). Le cri part un quart de seconde apres l'ouverture.
    // LES ATTITUDES D'AVANT LE DEPART (02/10, a la demande de l'auteur :
    // « ajoute les attitudes de sprinter avant les departs, c'est trop sec »).
    // En solo, le decompte partait des la premiere image et chacun glissait
    // dans ses blocs en 0,6 s. Il y a maintenant le meme temps debout que pour
    // le cri de Meba-Mickael — qui a deja le sien —, ou chacun fait ses
    // gestes (pose, phaseBlocs), sur la musique, les appuis ignores.
    // Pas en direct, en relais ni en rejeu : leur pistolet est a l'heure de la
    // salle ; pas au tutoriel, qui n'a qu'un coureur et mesure sa reaction.
    if (!G.attitudesFaites) {
      G.attitudesFaites = true;
      if (!G.avantDepart && !G.liveOn && !G.rejeu && !G.spectateur && (G.runners || []).length > 1) {
        G.avantDepart = { reste: ATTITUDES_S, t: 0, dit: true, attitudes: true };
      }
    }
    const avD = G.avantDepart;
    if (avD && avD.reste > 0) {
      avD.t = (avD.t || 0) + dt;
      avD.reste -= dt;
      if (!avD.dit && avD.t >= (avD.a ?? 0.25)) {
        avD.dit = true;
        if (avD.cri) Audio_.sfx(avD.cri, { gain: avD.gain ?? 0.95 });
      }
      if (avD.claps && avD.claps.length) applaudir(avD, dt);
      SprinterApp.followCam(dt);
      gameStore.setState({ state: G.state, countT: -99 });
      return;
    }
    // Le pistolet est annonce : la presentation est finie, et les bras leves
    // pendant celle-ci redescendent. Sans cela, le dernier athlete presente
    // courait toute la course en saluant.
    SprinterApp.finirLesSaluts(dt);
    // LE DECOMPTE PARTOUT, LE STARTER EN PLUS SUR LE CANAL DE TEST.
    //
    // Les deux canaux comptent trois secondes. Le jeu publie marque chacune
    // d'un bip ; sur le canal de test, la voix du starter prend la place du
    // bip au 3 (« a vos marques ») et au 1 (« pret »). `annoncerLeDepart` sait
    // qui parle ; il lui faut la seconde d'AVANT l'increment pour reconnaitre
    // celle qui vient de passer. Voir « deux departs, un par canal » dans
    // sprinter-app.js.
    const avant = Math.floor(G.countT);
    G.countT += dt;
    SprinterApp.annoncerLeDepart(avant);
    SprinterApp.followCam(dt);
    if (G.countT >= 3) {
      SprinterApp.coupDePistolet();
      G.state = 'race'; G.elapsed = 0;
      // Le chronometre de la course repart de zero : ce qui se compte sur lui
      // doit repartir avec, sans quoi la deuxieme course d'une salle emet dans
      // le vide. Voir reinitialiserEnvoi.
      reinitialiserEnvoi();
      resetInputRhythm();
    }
  } else if (G.state === 'race') {
    G.acc += dt;
    const step = 1 / 240;
    while (G.acc >= step) {
      G.acc -= step; G.elapsed += step;
      // EN REJEU, PERSONNE N'APPUIE.
      //
      // Une course de championnat qu'on revoit n'a pas de joueur : les huit
      // couloirs sont pilotes par leur chrono. Le coureur que la camera suit
      // occupe la place du joueur — c'est ce qui fait que le cadrage, le HUD
      // et l'ecart affiche continuent de fonctionner — mais il avance comme
      // les sept autres, par `stepAI`. Sans cette ligne il resterait plante
      // dans ses blocs pendant que la course se deroule autour de lui.
      if (G.rejeu) G.player.stepAI(step, G.elapsed);
      // Sorti au faux depart : il n'est plus sur la piste, et rien ne le fait
      // avancer. Ceux qu'il regarde avancent par le reseau, plus bas.
      else if (G.spectateur) { /* il regarde */ }
      // Le sauteur : son elan est une course ordinaire, mais l'appel, le vol
      // et la reception ne le sont pas. Le jeu du saut prend donc le pas en
      // entier, et rend la main au moteur pour les foulees de l'elan.
      else if (G.pasSauteur) G.pasSauteur(G.player, step, G.elapsed);
      else G.player.stepPlayer(step, G.elapsed);
      // Les haies, quand il y en a. Le moteur ne les connait pas : c'est le
      // jeu des haies qui se pose ici a l'armement, et qui se retire en
      // partant. Sans course de haies, cette ligne est un test qui echoue.
      if (G.pasHaies) G.pasHaies(G.player);
      // Le molosse, quand il y en a un. Meme arrangement que les haies, et
      // pour la meme raison : le moteur ne connait pas la nuit d'Halloween,
      // c'est elle qui se pose ici a l'armement et se retire en partant.
      // Sans nuit en cours, cette ligne est un test qui echoue.
      if (G.pasMolosse) G.pasMolosse(G.player);
      // Un adversaire en direct n'est pas pilote ici : sa position vient du
      // reseau, et `stepGhost` l'interpole plus bas. Le lui appliquer en plus
      // le detruisait — le modele de l'ordinateur se cale sur un chrono vise,
      // qu'un joueur reel n'a pas : sans chrono, la vitesse et la constante de
      // temps ne sont jamais calculees, la position devient NaN, et
      // l'adversaire disparait de la piste sans une erreur.
      for (const r of G.runners) if (!r.isPlayer && !r.isLive) r.stepAI(step, G.elapsed);
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
    // Un depart donne pendant qu'un salut descendait encore : on finit de le
    // rendre en course plutot que de le figer a mi-hauteur.
    SprinterApp.finirLesSaluts(dt);
    if (G.liveOn) pousserPosition();

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
    // LA MORSURE TERMINE LA COURSE, et il faut le dire ici parce que rien
    // d'autre ne le dirait : un coureur rattrape est gele sur place, il
    // n'atteindra jamais la ligne, et les deux conditions ci-dessus attendent
    // toutes deux qu'il l'ait franchie. Sans cette troisieme, le jeu
    // regarderait un athlete immobile pendant les quatre-vingt-dix secondes
    // du garde-fou. Le drapeau est pose par game/halloween.ts et retire avec
    // la nuit ; hors de ce mode il n'existe pas.
    const mordu = !!G.molosseMord;
    // UN REJEU SE TERMINE SUR LE DERNIER, PAS SUR LE PREMIER.
    //
    // Une course jouee s'arrete peu apres le joueur : ce qui se passe derriere
    // lui ne l'interesse plus. Une course qu'on REGARDE est l'inverse — on la
    // coupe au moment ou le huitieme franchit la ligne, sans quoi la moitie
    // du peloton disparait en pleine piste, et c'est precisement la fin qu'on
    // voulait revoir.
    const dernier = G.rejeu
      ? G.runners.reduce((m: number, r: any) => Math.max(m, r.target || 0), 0)
      : 0;
    // Un rejeu n'a aucun resultat a annoncer : la course a deja eu lieu, et
    // l'ecran de fin du one shot proposerait de defier un ami avec le chrono
    // de quelqu'un d'autre. Il rend la main a `champ-rejeu`, qui ferme la
    // prise video et affiche le tableau d'arrivee.
    //
    // LE DRAPEAU NE S'ETEINT PAS ICI, et c'est tout le piege : `slow` est vrai
    // depuis longtemps quand le huitieme franchit la ligne — le coureur suivi,
    // lui, a fini deux ou trois secondes plus tot. Eteindre `rejeu` a cet
    // instant ferait retomber l'image suivante dans la branche ordinaire, et
    // `finishRace` ouvrirait l'ecran du one shot par-dessus le tableau. Le
    // rejeu reste donc arme jusqu'a ce que le spectateur referme le tableau.
    if (G.rejeu) {
      if (!G.rejeuFini && G.elapsed >= dernier + 2.5) {
        G.rejeuFini = true;
        for (const r of G.runners)
          if (!r.finished && !r.isPlayer) r.finishTime = r.target;
        const fin = G.rejeuFin; G.rejeuFin = null;
        if (fin) fin(); else SprinterApp.goHome();
      }
    } else if (G.sautEnCours) {
      // UN CONCOURS DE SAUT N'A PAS DE LIGNE D'ARRIVEE. L'essai finit quand
      // la marque est lue, et c'est le jeu du saut qui le sait : il passe a
      // l'essai suivant sans jamais ouvrir l'ecran de fin d'une course.
    } else if (G.champDirect) {
      // EN CHAMPIONNAT, C'EST LA SALLE QUI TRANCHE. Le joueur qui a franchi la
      // ligne continue de voir les autres finir, et le tableau d'arrivee
      // arrive avec le verdict de la salle (voir game/champ-direct.ts) —
      // jamais l'ecran de fin du one shot, qui proposerait de recommencer une
      // serie qui ne se recourt pas.
    } else if (out || slow || mordu || G.elapsed >= 90) {
      for (const r of G.runners)
        if (!r.finished && !r.isPlayer) r.finishTime = r.target;
      SprinterApp.finishRace();
    }
  }

  // Le public : ce qu'il sait de la course, pour que ses gradins la suivent.
  SprinterApp.majFerveur(dt);

  // Update React store
  gameStore.setState({
    state: G.state,
    elapsed: G.elapsed,
    countT: G.countT,
    starter: G.depart ? G.depart.dit : 0,
    openT: G.openT,
    chargement: partChargee(),
    shake: G.shake,
    flash: G.flash,
    stumbleFlash: G.stumbleFlash,
    reactFlash: G.reactFlash,
    transFlash: G.transFlash,
    falseFlash: G.falseFlash,
    cut: G.cut,
    sortie: G.sortie,
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
    paused: G.paused,
    falseOut: G.falseOut,
    ghostOn: !!G.ghost,
    ghostD: G.ghost ? G.ghost.runner.d : 0,
    ghostDone: G.ghost ? !!G.ghost.runner.finished : false,
    liveOn: G.liveOn,
    liveNom: G.liveNom,
    liveResultat: G.liveResultat,
    liveDuel: G.liveDuel,
    photo: SprinterApp.photoPourHud(),
  });
}
