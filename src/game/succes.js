// Les succes du joueur, sans navigateur : tout se deduit de ce que le jeu
// garde deja (les cles du profil, profil-fusion.js), rien n'est enregistre en
// plus. Ils suivent donc le joueur d'un telephone a l'autre avec le profil, et
// un joueur ancien les trouve deja gagnes.
//   node tools/succes-test.mjs

const lire = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const objet = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const SALLE = new Set(['60', '200s', '400s', '60hf', '60h']);
const HAIES = new Set(['100h', '110h', '400h', '60hf', '60h']);

/**
 * Les succes, dans l'ordre de l'ecran. `cle` sert de nom de traduction
 * (`succ_<cle>`), `but` est le nombre a atteindre, `mesure` lit l'etat.
 * shortcut: l'historique est plafonne a 300 courses (sprinter-app.js), d'ou le
 * dernier palier ; pour aller au-dela il faudrait un compteur a part.
 */
export const SUCCES = [
  { cle: 'course_1',     but: 1,   mesure: e => e.courses },
  { cle: 'course_10',    but: 10,  mesure: e => e.courses },
  { cle: 'course_50',    but: 50,  mesure: e => e.courses },
  { cle: 'course_100',   but: 100, mesure: e => e.courses },
  { cle: 'course_300',   but: 300, mesure: e => e.courses },
  { cle: 'epreuves_3',   but: 3,   mesure: e => e.epreuves },
  { cle: 'epreuves_6',   but: 6,   mesure: e => e.epreuves },
  { cle: 'haies',        but: 1,   mesure: e => e.haies },
  { cle: 'salle',        but: 1,   mesure: e => e.salle },
  { cle: 'saut',         but: 1,   mesure: e => e.sauts },
  { cle: 'carriere_1',   but: 1,   mesure: e => e.carrieres },
  { cle: 'carriere_10',  but: 10,  mesure: e => e.carrieres },
  { cle: 'carriere_30',  but: 30,  mesure: e => e.carrieres },
  { cle: 'legende',      but: 1,   mesure: e => e.legendes },
  { cle: 'vedette_1',    but: 1,   mesure: e => e.vedettes },
  { cle: 'vedette_3',    but: 3,   mesure: e => e.vedettes },
  { cle: 'tenue',        but: 1,   mesure: e => e.tenues },
  { cle: 'marchal',      but: 13,  mesure: e => e.pieces },
];

/** Ce que le profil dit du joueur. `get(cle)` rend le texte stocke, ou null. */
export function lireEtat(get) {
  const hist = lire(get('sprinter_history'));
  const courses = Array.isArray(hist) ? hist.filter(c => c && typeof c.r === 'string') : [];
  const cles = new Set(courses.map(c => c.r));
  const compte = objet(lire(get('sprinter_carrieres_gagnees_v1')));
  // une vedette battue sur une epreuve compte une fois, quelle que soit l'epreuve
  const battus = Object.entries(objet(lire(get('sprinter_defis_vedettes_battus'))))
    .filter(([, v]) => v).map(([k]) => k.split(':')[0]);
  const sauts = ['sprinter.longueur.v1', 'sprinter.triple.v1', 'sprinter.hauteur.v1']
    .filter(k => n(objet(objet(lire(get(k))).pb).m) > 0).length;
  const tenues = objet(lire(get('sprinter_vestiaire'))).gagnes;
  let pieces = 0;
  for (let i = 1; i <= 13; i++) if (get(`sprinter_halloween_piece_${i}_vue`) === '1') pieces++;
  return {
    courses: courses.length,
    epreuves: cles.size,
    haies: [...cles].some(k => HAIES.has(k)) ? 1 : 0,
    salle: [...cles].some(k => SALLE.has(k)) ? 1 : 0,
    sauts: Math.min(sauts, 1),
    carrieres: n(compte.total) + n(compte.avant),
    legendes: n(objet(lire(get('sprinter_legende_v1'))).accomplies),
    vedettes: new Set(battus).size,
    tenues: Array.isArray(tenues) ? tenues.length : 0,
    pieces,
  };
}

/** Chaque succes avec sa progression : { cle, but, fait (plafonne au but), gagne }. */
export function succesDu(get) {
  const e = lireEtat(get);
  return SUCCES.map(s => {
    const fait = Math.min(s.but, s.mesure(e));
    return { cle: s.cle, but: s.but, fait, gagne: fait >= s.but };
  });
}
