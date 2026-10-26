// LA PISTE COUVERTE — le stade couvert Jesse Owens, Val-de-Reuil.
//
// L'auteur, 25/10 : « la piste fait 200 m avec les virages releves, le 400 m fait
// deux tours » ; virages a 15 degres, 6 couloirs sur l'anneau, 8 sur la ligne droite
// centrale (le 60 m). Le reste suit l'anneau type homologue : rayon 17,20 m a la
// corde, couloirs de 0,90 m, ligne de mesure a 0,20 m de la ligne au couloir 1 et
// au-dela ; les lignes droites sont ce qu'il faut pour que le couloir 1 mesure 200 m.
// Le moteur (sprinter-core.js, Track.boucle) fait tourner l'anneau.
//
// shortcut: virages en demi-cercles purs, sans raccords de rayon ; et le 400 m reste
// en couloirs sur ses deux tours (depart en quinconce sur quatre virages) au lieu de
// se rabattre apres le premier tour : le moteur n'a pas d'evitement entre coureurs.

export const SALLE = {
  rayon: 17.2, couloir: 0.9, mes1: 0.2, mesN: 0.2,
  couloirs: 6, couloirsDroite: 8,
  inclinaison: 15 * Math.PI / 180,
};
const R1 = SALLE.rayon + SALLE.mes1;
/** La ligne droite : ce qui reste au couloir 1 d'un tour de 200 m, ses deux virages comptes. */
export const DROITE = (200 - 2 * Math.PI * R1) / 2;
const ARC = Math.PI * R1;

/** Les plateaux d'une epreuve en salle : ceux du plein air, un peu plus lents en virage serre. */
const plus = (ranges, k) => ranges.map(([a, b]) => [Math.round(a * k * 100) / 100, Math.round(b * k * 100) / 100]);
const R200 = [[25.00, 30.00], [22.40, 25.00], [20.00, 21.00], [19.16, 20.00], [19.16, 19.70], [17.75, 18.00]];
const R400 = [[55.00, 60.00], [49.00, 55.00], [44.50, 49.00], [43.50, 44.50], [43.18, 43.50], [36.70, 37.00]];

export const COURSES_EN_SALLE = {
  '60': {
    key: '60', label: '60 METRES', sub: 'la ligne droite en salle', salleDroite: true,
    arc: 0, straight: 60, maxSpeed: 12.435, best: 5.70,
    ranges: [[7.80, 9.00], [7.10, 7.80], [6.75, 7.00], [6.55, 6.75], [6.50, 6.65], [6.30, 6.45]],
  },
  '200s': {
    key: '200s', label: '200 METRES EN SALLE', sub: 'un tour d’anneau',
    salle: { ...SALLE, tours: 1 }, total: 200,
    arc: ARC, straight: DROITE, maxSpeed: 11.9, best: 18.60,
    ranges: plus(R200, 1.02),
  },
  '400s': {
    key: '400s', label: '400 METRES EN SALLE', sub: 'deux tours d’anneau',
    salle: { ...SALLE, tours: 2 }, total: 400,
    arc: ARC, straight: DROITE, maxSpeed: 11.45, best: 37.40,
    ranges: plus(R400, 1.015),
  },
};
export const EST_EN_SALLE = (cle) => !!COURSES_EN_SALLE[cle];
