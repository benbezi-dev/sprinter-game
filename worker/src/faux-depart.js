/* ---------------------------------------------------------------------------
   LE FAUX DEPART EN CHAMPIONNAT — les regles, et rien d'autre
   ---------------------------------------------------------------------------
   Ailleurs dans le jeu, le faux depart se juge sur le telephone : en one shot
   il met fin a la course, en carriere il coute un blocage. En championnat il y
   a un titre en jeu et huit personnes sur la piste, et un telephone ne peut
   plus se juger lui-meme — ni juger les autres. C'est la salle qui tranche.

   CE QUE LA SALLE PEUT SAVOIR, ET CE QU'ELLE NE PEUT PAS.

   Elle ne voit pas le doigt. Entre l'appui et son arrivee ici il y a la
   latence du reseau, cinquante a cent cinquante millisecondes, soit plus que
   toute la fenetre qu'on voudrait juger. Elle juge donc sur deux choses :

   1. le signalement du telephone. Un appui pendant le decompte part ici avec
      l'instant ou il a eu lieu, compte depuis le coup de pistolet (donc
      negatif). La salle verifie qu'il est vraisemblable — arrive a temps,
      pour le depart en cours, d'un coureur encore en course — et applique la
      sanction. Aucun telephone ne peut en signaler un autre.
   2. un controle dur. Un coureur qui AVANCE avant le coup de pistolet, a
      l'heure de la salle, est parti trop tot quoi qu'il en dise. Avec une
      marge : les horloges sont recalees a une demi-latence pres, et une
      erreur d'horloge n'est pas une faute du joueur.

   Ce que cela n'empeche pas : un client modifie qui tairait son propre faux
   depart. C'est la meme limite que pour le chrono, que le client annonce lui
   aussi — et c'est dit ici plutot que laisse croire.

   LE SEUIL EST LE COUP DE PISTOLET, pas les cent millisecondes de la regle
   reelle. Choisi le 23 septembre 2026 : le moteur donne son bonus de reaction
   maximal entre 0 et 120 ms (REACT_BEST), et le depart est un decompte 3-2-1
   regulier. Punir en championnat ce que le jeu recompense partout ailleurs
   aurait distribue des cartons rouges a ceux qui jouent le mieux.

   Tout est pur ici : memes entrees, memes sorties, testable sans rien monter.
--------------------------------------------------------------------------- */

/** Partir avant ce nombre de millisecondes apres le pistolet est une faute. */
export const SEUIL_MS = 0;

/**
 * Un signalement arrive trop tard ne compte plus.
 *
 * Il part au moment de l'appui, donc avant le pistolet ; il arrive une
 * latence plus tard. Une seconde et demie couvre un reseau tres mauvais sans
 * laisser un telephone signaler un faux depart au milieu de la course.
 */
export const TOLERANCE_RECEPTION_MS = 1500;

/** Plus tot que ceci avant le pistolet, le signalement n'est pas credible. */
export const ANTICIPATION_MAX_MS = 10000;

/**
 * Le controle dur : avancer de plus de DEUX METRES plus de 300 ms avant le
 * pistolet de la salle.
 *
 * Un appui pendant le decompte ne fait pas bouger le coureur — il le marque
 * seulement. Un telephone honnete n'avance donc qu'apres SON pistolet, et
 * ses positions arrivent une latence plus tard encore. Pour qu'une position
 * arrive ici avant le pistolet de la salle, il faut une horloge en avance de
 * plus que la latence, plus ces 300 ms : ce n'est plus une imprecision.
 */
export const CONTROLE_DISTANCE_M = 2;
export const CONTROLE_MARGE_MS = 300;

/**
 * Juge le signalement d'un telephone.
 *
 * @param {object} p
 * @param {number|null} p.departA  date du pistolet en cours, horloge salle
 * @param {number} p.recuA         date de reception, horloge salle
 * @param {number} p.ms            instant de l'appui, depuis le pistolet
 * @returns {{ faux: boolean, ms?: number, raison?: string }}
 */
export function jugerSignalement({ departA, recuA, ms }) {
  if (!departA) return { faux: false, raison: 'pas de depart annonce' };
  const t = Number(ms);
  if (!Number.isFinite(t)) return { faux: false, raison: 'instant illisible' };
  if (recuA > departA + TOLERANCE_RECEPTION_MS) return { faux: false, raison: 'trop tard' };
  if (t >= SEUIL_MS) return { faux: false, raison: 'parti apres le coup' };
  if (t < -ANTICIPATION_MAX_MS) return { faux: false, raison: 'pas credible' };
  return { faux: true, ms: Math.round(t) };
}

/**
 * Le controle dur, sur une position recue.
 *
 * @returns {{ faux: boolean, ms?: number }}
 */
export function jugerPosition({ departA, recuA, d }) {
  if (!departA) return { faux: false };
  const dist = Number(d);
  if (!Number.isFinite(dist) || dist <= CONTROLE_DISTANCE_M) return { faux: false };
  if (recuA >= departA - CONTROLE_MARGE_MS) return { faux: false };
  return { faux: true, ms: Math.round(recuA - departA) };
}

/**
 * L'ordre d'une course de championnat courue en direct.
 *
 * Ceux qui ont franchi la ligne au chrono, une egalite partageant la place ;
 * puis ceux qui n'ont pas de chrono, dans un ordre fixe — l'abandon (il a
 * couru), le faux depart (il etait sur la ligne), le forfait (il n'est pas
 * venu). Ceux-la n'ont pas de place : « DQ » n'est pas une neuvieme place.
 *
 * Le serveur ne s'en sert que pour ANNONCER. La qualification passe toujours
 * par `ordonner` et ses departages, sur ce que `enregistrerCourse` a range.
 *
 * @param {{cle:string, nom:string, couloir:number, fin:number|null, motif:string|null, motif_ms?:number|null}[]} coureurs
 */
export function classerLaCourse(coureurs) {
  const RANG_MOTIF = { abandon: 1, faux_depart: 2, forfait: 3 };
  const arrives = coureurs.filter(c => c.fin != null && !c.motif)
    .sort((a, b) => a.fin - b.fin);
  const autres = coureurs.filter(c => c.fin == null || c.motif)
    .sort((a, b) => (RANG_MOTIF[a.motif] || 9) - (RANG_MOTIF[b.motif] || 9)
                 || a.couloir - b.couloir);
  return [
    ...arrives.map(c => ({
      place: 1 + arrives.filter(x => x.fin < c.fin).length,
      cle: c.cle, nom: c.nom, couloir: c.couloir, ms: c.fin, motif: null,
    })),
    ...autres.map(c => ({
      place: null, cle: c.cle, nom: c.nom, couloir: c.couloir, ms: null,
      motif: c.motif || 'abandon', motif_ms: c.motif_ms ?? null,
    })),
  ];
}
