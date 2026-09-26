// LA MUSIQUE DU CHAMPIONNAT EN DIRECT — trois morceaux, un par tour.
//
// Series « Debout », demi-finales « Galop », finale « Feu » : des morceaux
// enregistres (livraison le-stade-bangers-2-allege : sans clap, et une finale
// a deux « HEY! » seulement), et non la synthese de
// `buildRace`. Chacun est ecrit sur l'horloge de la salle
// (worker/src/salle-championnat.js) : l'appel, trois secondes par athlete, le
// silence et le 3-2-1, le pistolet, la course, la ligne, la fin. Le fichier
// n'est donc pas joue d'un bout a l'autre : ce module le suit, bloc par bloc,
// a la date que la salle annonce.
//
//   l'appel        1,5 s avant le premier athlete ;
//   les athletes   un bloc de 3 s chacun. Avec moins de huit presents, on
//                  joue les DERNIERS blocs : la presentation finit toujours
//                  sur le sommet, et le refrain du chœur s'entend toujours ;
//   3-2-1          les 4 s avant le pistolet. Un « HEY! » de tribune tombe sur
//                  chaque bip du jeu (en finale, sur le « 1 » seulement) —
//                  les bips ne sont pas dans la musique ;
//   le pistolet    la boucle de course part, avec la clameur de la foule. En
//                  finale, la boucle fait un tour puis monte d'un demi-ton ;
//   la ligne       la fanfare, par-dessus la boucle, au passage du premier ;
//   la fin         la boucle s'arrete au passage du dernier (ou au verdict de
//                  la salle), et l'accord final sonne.
//
// TOUT SE PROGRAMME SUR L'HORLOGE AUDIO. Un bloc lance depuis la boucle
// d'image tomberait a seize millisecondes pres, et deux blocs voisins ne se
// raccorderaient plus. On convertit chaque date de la salle en temps du
// contexte audio, et chaque bloc part a son echantillon.
//
// SON ABSENCE NE CASSE RIEN. Tant que le morceau n'est pas decode,
// `G.musiqueChamp` reste faux et le moteur joue sa musique de course
// ordinaire (voir updateLogic dans engine.ts) : un reseau lent donne un
// championnat avec une autre musique, pas un championnat muet. Arrive en
// retard, le morceau reprend la ou la salle en est.
//
// Le fichier de chaque tour est une planche : tous les blocs bout a bout, un
// seul MP3 (voir tools/musique/championnat-planche.mjs et la table
// musique-championnat.json).

import table from './musique-championnat.json';

const app = (): any => (globalThis as any).SprinterApp;

/** Le niveau de la musique : celui de `Audio_.gain`, sur lequel les morceaux ont ete regles. */
const NIVEAU = 0.34;
/** Ce que dure la presentation d'un athlete dans le morceau. */
const BLOC_ATHLETE = 3;
/** L'appel precede le premier athlete de ce temps-la. */
const APPEL = 1.5;
/** Le silence et le 3-2-1 : les 4 s avant le pistolet. */
const AVANT_PISTOLET = 4;

type Tour = 'series' | 'demies' | 'finale';
type Segment = { debut: number; duree: number; boucle?: boolean };
type Planche = { marqueur: number; segments: Record<string, Segment> };
type Categorie = 'presentation' | 'course' | 'fin';

const URLS: Record<Tour, () => Promise<{ default: string }>> = {
  series: () => import('@/assets/championnat/series.mp3?url'),
  demies: () => import('@/assets/championnat/demies.mp3?url'),
  finale: () => import('@/assets/championnat/finale.mp3?url'),
};

/** Le tour d'une phase de championnat. Une phase inconnue prend le morceau des series. */
export function tourDeLaPhase(phase: string): Tour {
  return phase === 'finale' ? 'finale' : phase === 'demies' ? 'demies' : 'series';
}

const tampons: Partial<Record<Tour, AudioBuffer>> = {};
/** Le decalage mesure au decodage, en secondes (voir `decaler`). */
const decalages: Partial<Record<Tour, number>> = {};
const chargements: Partial<Record<Tour, Promise<boolean>>> = {};

/** Ce que la salle a annonce, en millisecondes de notre horloge. */
type Plan = {
  tour: Tour;
  presentation: { premier: number; n: number } | null;
  pistolet: number | null;
  ligne: boolean;
  fin: boolean;
};
let plan: Plan | null = null;
let sortie: GainNode | null = null;
let sons: { src: AudioBufferSourceNode; gain: GainNode; cat: Categorie }[] = [];
let veille: ReturnType<typeof setInterval> | null = null;
let muet = false;

function moteur(): any {
  const A = app()?.Audio_;
  return A && A.ok && A.ctx ? A : null;
}

/**
 * Ou le decodeur a pose le debut. Un decodeur MP3 peut garder ou retirer le
 * silence de tete de l'encodeur ; la planche porte un coup de sinus a une
 * date connue, et l'ecart entre ou il est et ou on l'attendait vaut pour tous
 * les blocs.
 */
function decaler(b: AudioBuffer, attendu: number): number {
  const c = b.getChannelData(0);
  const fin = Math.min(c.length, Math.round(b.sampleRate * 0.6));
  for (let i = 0; i < fin; i++) if (Math.abs(c[i]) > 0.25) return i / b.sampleRate - attendu;
  return 0;
}

/**
 * Charger le morceau d'un tour. Appelable autant qu'on veut ; un refus n'est
 * pas retente pour ce tour (un decodage qui echoue echouera encore), et la
 * musique ordinaire tient la course.
 */
export function chargerLeTour(tour: Tour): Promise<boolean> {
  if (tampons[tour]) return Promise.resolve(true);
  const deja = chargements[tour];
  if (deja) return deja;
  const A = moteur();
  // Pas de contexte avant le premier geste : on n'enregistre pas l'echec,
  // l'appel suivant le trouvera ouvert.
  if (!A) return Promise.resolve(false);
  const p = (async () => {
    try {
      const url = (await URLS[tour]()).default;
      const r = await fetch(url);
      if (!r.ok) throw new Error('reponse ' + r.status);
      const octets = await r.arrayBuffer();
      const b: AudioBuffer = await new Promise((ok, ko) => A.ctx.decodeAudioData(octets, ok, ko));
      decalages[tour] = decaler(b, (table.tours as Record<Tour, Planche>)[tour].marqueur);
      tampons[tour] = b;
      return true;
    } catch {
      return false;
    }
  })();
  chargements[tour] = p;
  return p;
}

/** Une date de notre horloge, en temps du contexte audio. */
function versAudio(A: any, ms: number): number {
  return A.ctx.currentTime + (ms - Date.now()) / 1000;
}

function segment(nom: string): Segment | null {
  if (!plan) return null;
  return (table.tours as Record<Tour, Planche>)[plan.tour].segments[nom] || null;
}

/**
 * Poser un bloc a une date. `de` et `duree` en decoupent un morceau (en
 * secondes dans le bloc) ; une date deja passee fait entrer le bloc la ou il
 * en serait, et un bloc deja fini ne part pas.
 */
function poser(nom: string, quandMs: number, cat: Categorie,
               o: { de?: number; duree?: number; boucle?: boolean } = {}) {
  const A = moteur();
  const b = plan && tampons[plan.tour];
  const s = segment(nom);
  if (!A || !b || !s || !sortie || muet || !A.on) return;
  const maintenant = A.ctx.currentTime;
  let t = versAudio(A, quandMs);
  const de = o.de || 0;
  let dans = de;
  if (t < maintenant) { dans += maintenant - t; t = maintenant; }
  const base = s.debut + (decalages[plan!.tour] || 0);
  const src = A.ctx.createBufferSource();
  src.buffer = b;
  const g = A.ctx.createGain();
  src.connect(g); g.connect(sortie);
  if (o.boucle) {
    src.loop = true;
    src.loopStart = base;
    src.loopEnd = base + s.duree;
    src.start(t, base + ((dans % s.duree) + s.duree) % s.duree);
  } else {
    const jusqua = de + (o.duree ?? s.duree - de);
    if (dans >= jusqua) return;
    src.start(t, base + dans, jusqua - dans);
  }
  const son = { src, gain: g, cat };
  sons.push(son);
  src.onended = () => { sons = sons.filter(x => x !== son); };
}

/** Eteindre une categorie de blocs (toutes sans argument), en `fondu` secondes. */
function eteindre(cat?: Categorie, fondu = 0.05) {
  const A = moteur();
  const t = A ? A.ctx.currentTime : 0;
  for (const s of sons) {
    if (cat && s.cat !== cat) continue;
    try {
      s.gain.gain.setValueAtTime(s.gain.gain.value, t);
      s.gain.gain.linearRampToValueAtTime(0, t + fondu);
      s.src.stop(t + fondu + 0.01);
    } catch { /* deja arrete */ }
  }
  sons = sons.filter(s => cat && s.cat !== cat);
}

/** L'appel puis les blocs d'athlete, dans le morceau. */
function programmerLaPresentation() {
  if (!plan?.presentation) return;
  eteindre('presentation', 0.02);
  const { premier, n } = plan.presentation;
  poser('presentation', premier - APPEL * 1000, 'presentation', { de: 0, duree: APPEL });
  // Les DERNIERS blocs : avec cinq presents, on joue les athletes 4 a 8.
  const saut = Math.max(0, 8 - n) * BLOC_ATHLETE;
  const combien = Math.min(8, n) * BLOC_ATHLETE;
  poser('presentation', premier, 'presentation', { de: APPEL + saut, duree: combien });
}

/** Le 3-2-1, puis la course au pistolet. */
function programmerLeDepart() {
  if (!plan || plan.pistolet == null) return;
  eteindre('course', 0.02);
  const p = plan.pistolet;
  // Le silence et le 3-2-1 : la fin du bloc de presentation.
  poser('presentation', p - AVANT_PISTOLET * 1000, 'course', { de: APPEL + 8 * BLOC_ATHLETE, duree: AVANT_PISTOLET });
  poser('depart', p, 'course');
  const montee = segment('boucleMontee');
  if (montee) {
    const tour = segment('boucle')!.duree * 1000;
    poser('boucle', p, 'course', { duree: segment('boucle')!.duree });
    poser('boucleMontee', p + tour, 'course', { boucle: true });
  } else {
    poser('boucle', p, 'course', { boucle: true });
  }
}

/** Le premier passe la ligne : la fanfare, par-dessus la boucle. */
function laLigne() {
  if (!plan || plan.ligne) return;
  plan.ligne = true;
  poser('ligne', Date.now(), 'fin');
}

/** Le dernier est arrive, ou la salle a tranche : la boucle se tait, l'accord final. */
function laFin() {
  if (!plan || plan.fin || plan.pistolet == null) return;
  plan.fin = true;
  // En finale, la fin qui suit la boucle montee est dans son ton.
  const monte = !!segment('boucleMontee') && Date.now() >= plan.pistolet + segment('boucle')!.duree * 1000;
  eteindre('course', 0.05);
  poser(monte ? 'finMontee' : 'fin', Date.now(), 'fin');
}

/** Le moteur joue-t-il ce morceau ? Sinon, sa musique ordinaire. */
function signaler() {
  const G = app()?.G;
  if (G) G.musiqueChamp = !!(plan && tampons[plan.tour] && !muet);
}

/** Tout reprendre d'apres le plan : le morceau vient d'arriver, ou le son revient. */
function toutReprogrammer() {
  eteindre(undefined, 0.02);
  signaler();
  if (!plan || !tampons[plan.tour]) return;
  const pistoletPasse = plan.pistolet != null && Date.now() >= plan.pistolet;
  if (!pistoletPasse) programmerLaPresentation();
  if (!plan.fin) programmerLeDepart();
}

/**
 * La ronde : qui a passe la ligne, et le bouton du son. Dix fois par seconde
 * suffit — la ligne et la fin sont des moments de la course, pas des
 * battements.
 */
function ronde() {
  const A = app()?.Audio_;
  const G = app()?.G;
  if (!plan || !A || !G) return;
  const coupe = !A.on;
  if (coupe !== muet) {
    muet = coupe;
    if (muet) { eteindre(undefined, 0.05); signaler(); } else toutReprogrammer();
  }
  if (plan.pistolet == null || Date.now() < plan.pistolet + 1000 || G.rappel) return;
  const coureurs: any[] = G.runners || [];
  if (!coureurs.length) return;
  if (!plan.ligne && coureurs.some(r => r.finished)) laLigne();
  if (plan.ligne && !plan.fin && coureurs.every(r => r.finished)) laFin();
}

/* ------------------------------------------------------------ l'exterieur */

/** On entre dans la salle d'une serie : le morceau de son tour se charge. */
export function entrerDansLeTour(phase: string) {
  arreterLaMusique();
  const A = moteur();
  if (!A) return;
  const tour = tourDeLaPhase(phase);
  plan = { tour, presentation: null, pistolet: null, ligne: false, fin: false };
  muet = !A.on;
  if (!sortie || sortie.context !== A.ctx) {
    const g: GainNode = A.ctx.createGain();
    g.gain.value = NIVEAU;
    // Sur la sortie commune : le replay l'enregistre avec le reste du jeu.
    g.connect(A.sortie);
    sortie = g;
  }
  veille = setInterval(ronde, 100);
  void chargerLeTour(tour).then(ok => { if (ok && plan?.tour === tour) toutReprogrammer(); });
}

/** La salle ouvre la presentation : `dansMs` avant le premier athlete. */
export function presentationAnnoncee(dansMs: number, n: number) {
  if (!plan) return;
  plan.presentation = { premier: Date.now() + dansMs, n };
  programmerLaPresentation();
}

/** La salle annonce le pistolet (au premier depart, ou apres un rappel). */
export function pistoletAnnonce(dansMs: number) {
  if (!plan) return;
  plan.pistolet = Date.now() + Math.max(0, dansMs);
  plan.ligne = false; plan.fin = false;
  eteindre('fin', 0.05);
  programmerLeDepart();
}

/** Faux depart : la musique se tait pendant la scene du rappel. */
export function rappelSiffle() {
  if (!plan) return;
  plan.pistolet = null;
  plan.presentation = null;
  eteindre(undefined, 0.12);
}

/** Le verdict de la salle : si l'accord final n'a pas encore sonne, il sonne. */
export function verdictRendu() {
  laFin();
}

/** On quitte la salle. */
export function arreterLaMusique() {
  if (veille) { clearInterval(veille); veille = null; }
  eteindre(undefined, 0.15);
  plan = null;
  signaler();
}
