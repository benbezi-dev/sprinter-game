/* ------------------------------------------------------------ plausibilite
   Un chrono arrive du client, et le client est l'appareil du joueur : rien
   n'y est verifiable. `MIN_TIME_MS` vaut 1 seconde pour toutes les epreuves
   — un plafond de securite contre une valeur aberrante, pas une regle de
   jeu. Il laisse donc poser un 100 m en une seconde, et `best_split_ms`,
   qui est ce qui CLASSE, n'etait meme pas tenu par lui : il lui suffisait
   d'etre positif et sous le cumul.

   Le plancher ci-dessous se deduit du moteur au lieu d'etre choisi. Chaque
   epreuve a une vitesse de pointe (`RACES[...].maxSpeed` dans
   sprinter-core.js), et une seule chose peut la relever au cours d'une course
   individuelle : la note de transition, au mieux `TRANS_VMAX[2]` = 1.042, et
   une seule fois par course (`gradeTransition` est gardee par
   `transGrade === null`). Le temps qu'il faudrait pour couvrir la distance en
   tenant DEJA cette vitesse au premier metre est donc une borne que rien ne
   franchit — d'autant que la montee en vitesse est exponentielle,
   `v(t) = vmax (1 - e^-t/tau)`, et n'atteint jamais vmax.

   Ce que cela donne : 7,718 s au 100 m, 15,967 s au 200, 33,276 s au 400 —
   entre quatre et sept pour cent sous ce que les meilleurs joueurs font
   reellement, sans qu'aucune course jouable ne puisse tomber dessous.

   LES SEULES EPREUVES CONCERNEES SONT LE 100, LE 200 ET LE 400 M. Les haies et
   le reste n'ont pas de plancher derive : leur moteur n'a pas ete releve, et
   inventer une borne refuserait peut-etre une course honnete. Elles gardent le
   comportement d'avant — la seconde forfaitaire de `MIN_TIME_MS`, que les
   routes appliquent toujours elles-memes.

   Recopie plutot qu'importee : le worker ne partage pas de module avec le
   client, et une dependance vers `src/` casserait le deploiement. Le prix est
   qu'un reglage du moteur doit etre reporte ici — d'ou le controle
   `tools/verifier-plancher.mjs`, qui relit sprinter-core.js et compare. */
export const VMAX_EPREUVE = { '100': 12.435, '200': 12.021, '400': 11.536 };
export const DISTANCE_M = { '100': 100, '200': 200, '400': 400 };
export const TRANS_VMAX_MAX = 1.042;

/** Ce que rend le worker quand un chrono passe sous le plancher. */
export const MESSAGE_PLANCHER = 'temps impossible sur cette epreuve';

/** La seconde forfaitaire des epreuves sans plancher derive (`MIN_TIME_MS`). */
const PLANCHER_FORFAIT_MS = 1000;

/** Cette epreuve a-t-elle un plancher derive du moteur ? */
export function aUnPlancher(race) {
  return Object.prototype.hasOwnProperty.call(VMAX_EPREUVE, race);
}

/**
 * Le temps en dessous duquel aucune course jouable ne peut descendre, en ms.
 * Pour une epreuve sans plancher derive : la seconde forfaitaire.
 */
export function plancherMs(race) {
  if (!aUnPlancher(race)) return PLANCHER_FORFAIT_MS;
  return Math.floor(1000 * DISTANCE_M[race] / (VMAX_EPREUVE[race] * TRANS_VMAX_MAX));
}

/**
 * Le plancher d'une suite d'epreuves courues d'affilee : la somme de celles
 * qui en ont un. Les autres n'ajoutent rien — la suite ne descend jamais sous
 * la seconde forfaitaire, comme avant, et un cumul ne devient pas plus strict
 * pour avoir compte une epreuve de haies de plus.
 */
export function plancherTotalMs(races) {
  const somme = (Array.isArray(races) ? races : [])
    .filter(aUnPlancher).reduce((s, r) => s + plancherMs(r), 0);
  return Math.max(PLANCHER_FORFAIT_MS, somme);
}

/**
 * Ce chrono est-il en dessous de ce qu'on peut courir sur cette epreuve ?
 * Ne regarde QUE le plancher : les routes gardent leurs propres bornes
 * (nombre fini, plafond `MAX_TIME_MS`, seconde forfaitaire).
 */
export function sousLePlancher(race, ms) {
  return aUnPlancher(race) && Number.isFinite(ms) && ms < plancherMs(race);
}

/** Meme question pour un cumul d'epreuves. Sans epreuve a plancher : jamais. */
export function sousLePlancherTotal(races, ms) {
  const eps = Array.isArray(races) ? races : [];
  return eps.some(aUnPlancher) && Number.isFinite(ms) && ms < plancherTotalMs(eps);
}

/* La trace est une position en decimetres relevee tous les REC_STEP (0,08 s,
   voir sprinter-app.js). Sa longueur dit donc la duree de la course aussi
   surement que le chrono annonce, et les deux doivent se ressembler.

   La tolerance est large a dessein — 0,6x a 1,6x — parce qu'un faux positif
   couterait un fantome a un joueur honnete, alors que le plancher ci-dessus
   tient deja la triche grossiere. Ce controle vise la trace fabriquee, pas la
   trace imprecise.

   En cas de desaccord on ecarte LA TRACE, pas le chrono : une trace absente
   prive d'un fantome, un chrono refuse prive d'un record. */
const REC_STEP_MS = 80;

/** Cette trace raconte-t-elle une autre course que le chrono annonce ?
 *  Seules les epreuves a plancher sont jugees : les autres rendent false. */
export function traceIncoherente(race, ms, trace) {
  if (!aUnPlancher(race) || !trace || !trace.length) return false;
  const dureeTrace = trace.length * REC_STEP_MS;
  if (dureeTrace < 0.6 * ms || dureeTrace > 1.6 * ms + 1000) return true;
  // Aucun intervalle ne peut couvrir plus que la vitesse de pointe permet.
  const bondMax = VMAX_EPREUVE[race] * TRANS_VMAX_MAX * (REC_STEP_MS / 1000) * 10 * 1.5;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i] - trace[i - 1] > bondMax) return true;
  }
  return false;
}
