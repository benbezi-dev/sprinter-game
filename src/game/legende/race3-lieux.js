// LA MUSIQUE DE CHAQUE DESTINATION DE LA LEGENDE — declinee de race3.
//
// L'auteur, 18/10 : « une musique iconique qui respecte le pays et le
// personnage », « dans le style de la course des ZEZE » (race3), « qui reste
// en tete ». Un essai par ElevenLabs a ete juge trop loin de race3 ; on
// repart donc de race3 lui-meme (fabriquerCourse, sprinter-app.js) : meme
// batterie, meme basse en doubles-croches, meme arpege, meme bourdon, meme
// stab, a 160 BPM. Ce qui fait le pays tient en quatre reglages :
//   prog        l'harmonie (la cadence andalouse a Barcelone...) ;
//   bassPat     le dessin de basse de race3, juste ses notes changees ;
//   claps       les mains du public quand le lieu en a (palmas, qraqeb...) ;
//   couches     LE REFRAIN : [demi-ton depuis le la, temps, duree en temps]
//               par mesure, joue par un instrument synthetise avec les memes
//               briques (`tone`) — voir INSTRUMENTS dans sprinter-app.js ;
//   contretemps les accords plaques sur les contretemps (skank reggae).
// Un fichier de donnees pur : le jeu le lit (Audio_.buildRace) et
// tools/musique/legende-race3.mjs aussi, pour l'ecoute hors du navigateur.

const MIN = [0, 3, 7], MAJ = [0, 4, 7], AUG = [0, 4, 8], DIM = [0, 3, 6];

/** race3, tel que le moteur le fabrique (sprinter-app.js). */
export const RACE3 = {
  bpm: 150, prog: [[0, DIM], [-1, DIM], [-2, DIM], [-3, AUG]],
  kick: [0, 0.75, 1.5, 2, 2.75, 3.5], snare: [1, 2.5, 3, 3.75], hats: 16,
  bassDiv: 16, bassPat: [0, 0, 6, 0, 0, 0, 6, 0, 12, 0, 6, 0, 0, 6, 0, 6],
  bassAmp: 0.52, padAmp: 0.10, arp: 16, arpAmp: 0.13, drone: 0.20, droneSemi: -5, stab: 0.20,
};

const BASE = { ...RACE3, bpm: 160 };
// la basse de race3, sa quinte diminuee devenue juste (tonalites majeures et mineures)
const BASSE_JUSTE = [0, 0, 7, 0, 0, 0, 7, 0, 12, 0, 7, 0, 0, 7, 0, 7];
// la meme, avec la seconde mineure des modes orientaux et phrygiens
const BASSE_B2 = [0, 0, 7, 0, 0, 0, 7, 0, 12, 0, 7, 0, 1, 0, 7, 0];
/** Une mesure de refrain transposee de k demi-tons. */
const tr = (mesure, k) => mesure.map(([s, x, l]) => [s + k, x, l]);

export const MUSIQUES_LEGENDE = {
  // MENOLE — Kouassi « le Crabe », 12 ans, pieds nus. Le coupe-decale :
  // majeur, guitare zouglou qui saute en pentatonique, claps sur les
  // contretemps comme a la plage.
  menole: {
    ...BASE, prog: [[0, MAJ], [5, MAJ], [7, MAJ], [5, MAJ]], bassPat: BASSE_JUSTE,
    stabSemi: 7, claps: [0.5, 1.5, 2.5, 3.5], clapAmp: 1.1,
    couches: [{ instrument: 'pincee', octave: 3, amp: 0.24, melodie: [
      [[12, 0, .25], [9, .25, .25], [7, .5, .25], [9, .75, .25], [12, 1, .5], [9, 1.5, .25], [7, 1.75, .25], [4, 2, .5], [7, 2.5, .5], [9, 3, .5], [7, 3.5, .5]],
      [[14, 0, .25], [12, .25, .25], [9, .5, .25], [12, .75, .25], [14, 1, .5], [12, 1.5, .25], [9, 1.75, .25], [5, 2, .5], [9, 2.5, .5], [12, 3, .5], [9, 3.5, .5]],
      [[16, 0, .25], [14, .25, .25], [11, .5, .25], [14, .75, .25], [16, 1, .5], [14, 1.5, .25], [11, 1.75, .25], [7, 2, .5], [11, 2.5, .5], [14, 3, .5], [11, 3.5, .5]],
      [[14, 0, .5], [12, .5, .5], [9, 1, .5], [7, 1.5, .5], [4, 2, .5], [2, 2.5, .5], [0, 3, 1]],
    ] }],
  },

  // KYOTO — Sora Kanzaki « Kitsune », l'aube sur les marches de Fushimi Inari.
  // La gamme in (miyako-bushi : la, si bemol, re, mi, fa) ; le shakuhachi
  // tient le refrain en notes longues, un koto egrene dessous.
  kyoto: {
    ...BASE, prog: [[0, MIN], [1, MAJ], [5, MIN], [0, MIN]], bassPat: BASSE_B2, stabSemi: 1,
    couches: [
      { instrument: 'souffle', octave: 4, amp: 0.26, melodie: [
        [[7, 0, 1.5], [8, 1.5, .5], [7, 2, 1], [5, 3, 1]],
        [[5, 0, 1], [1, 1, 1], [5, 2, .5], [7, 2.5, .5], [8, 3, 1]],
        [[12, 0, 1.5], [8, 1.5, .5], [7, 2, 1], [5, 3, 1]],
        [[1, 0, 1], [0, 1, 3]],
      ] },
      { instrument: 'pincee', octave: 4, amp: 0.10, melodie: [
        [[0, 0, .25], [7, .5, .25], [8, 1, .25], [12, 1.5, .25], [8, 2, .25], [7, 2.5, .25], [5, 3, .25], [1, 3.5, .25]],
      ] },
    ],
  },

  // KINGSTON — Damion Clarke « Tallawah ». Le reggae : majeur, un riff de
  // cuivres qui se chante, la guitare skank sur chaque contretemps.
  kingston: {
    ...BASE, prog: [[0, MAJ], [5, MAJ], [7, MAJ], [5, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    contretemps: { instrument: 'pincee', octave: 4, amp: 0.07, temps: [0.5, 1.5, 2.5, 3.5] },
    couches: [{ instrument: 'anche', octave: 4, amp: 0.20, melodie: [
      [[4, 0, .5], [7, .5, .5], [9, 1, .75], [7, 1.75, .25], [4, 2, .5], [2, 2.5, .5], [0, 3, 1]],
      [[5, 0, .5], [9, .5, .5], [12, 1, .75], [9, 1.75, .25], [5, 2, .5], [4, 2.5, .5], [2, 3, 1]],
      [[7, 0, .5], [11, .5, .5], [14, 1, .75], [11, 1.75, .25], [7, 2, .5], [4, 2.5, .5], [2, 3, 1]],
      [[9, 0, .5], [7, .5, .5], [4, 1, .5], [2, 1.5, .5], [0, 2, 2]],
    ] }],
  },

  // IZMIR — Kerem Aydin « Zeybek ». Le mode hijaz (la, si bemol, do diese,
  // re, mi, fa, sol) a la zurna, les mains de la tribune sur 2 et 4.
  izmir: {
    ...BASE, prog: [[0, MAJ], [1, MAJ], [-2, MIN], [0, MAJ]], bassPat: BASSE_B2, stabSemi: 1,
    claps: [1, 3], clapAmp: 1.0,
    couches: [{ instrument: 'anche', octave: 4, amp: 0.22, melodie: [
      [[0, 0, .5], [1, .5, .25], [4, .75, .25], [5, 1, .5], [7, 1.5, .5], [8, 2, .25], [7, 2.25, .25], [5, 2.5, .5], [4, 3, .5], [1, 3.5, .5]],
      [[5, 0, .5], [4, .5, .25], [5, .75, .25], [7, 1, .5], [8, 1.5, .5], [10, 2, 1], [8, 3, .5], [7, 3.5, .5]],
      [[5, 0, .5], [7, .5, .5], [5, 1, .25], [4, 1.25, .25], [1, 1.5, .5], [4, 2, .5], [5, 2.5, .5], [4, 3, .5], [1, 3.5, .5]],
      [[0, 0, 2], [1, 2, .5], [0, 2.5, 1.5]],
    ] }],
  },

  // BARCELONE — Marc Puig « Trencadis ». La cadence andalouse (la, sol, fa,
  // mi majeur), le stab sur la seconde mineure du flamenco, les palmas, et
  // a la guitare une phrase qui descend en phrygien, la meme sur chaque accord.
  barcelone: {
    ...BASE, prog: [[0, MIN], [-2, MAJ], [-4, MAJ], [-5, MAJ]], bassPat: BASSE_JUSTE,
    stabSemi: 1, claps: [0.5, 1.5, 2.5, 3, 3.5], clapAmp: 1.2,
    couches: [{ instrument: 'pincee', octave: 4, amp: 0.22, melodie: [
      [[7, 0, .5], [8, .5, .25], [7, .75, .25], [5, 1, .5], [3, 1.5, .5], [2, 2, .5], [3, 2.5, .25], [2, 2.75, .25], [0, 3, 1]],
      [[5, 0, .5], [7, .5, .25], [5, .75, .25], [3, 1, .5], [2, 1.5, .5], [0, 2, .5], [2, 2.5, .25], [0, 2.75, .25], [-2, 3, 1]],
      [[3, 0, .5], [5, .5, .25], [3, .75, .25], [0, 1, .5], [-2, 1.5, .5], [-4, 2, .5], [-2, 2.5, .25], [0, 2.75, .25], [3, 3, 1]],
      [[2, 0, .5], [3, .5, .25], [2, .75, .25], [-1, 1, .5], [0, 1.5, .25], [-1, 1.75, .25], [-4, 2, .5], [-1, 2.5, .25], [-4, 2.75, .25], [-5, 3, 1]],
    ] }],
  },

  // CASABLANCA — Yassine Benali « l'Atlas ». La transe gnaoua : un riff de
  // guembri grave qui tourne (pentatonique avec sa quinte diminuee), les
  // qraqeb en rafales, un violon chaabi qui repond par-dessus.
  casablanca: {
    ...BASE, prog: [[0, MIN], [0, MIN], [-2, MAJ], [0, MIN]],
    bassPat: [0, 0, 3, 5, 0, 0, 3, 0, 7, 5, 3, 0, 0, 3, 5, 6], stabSemi: 6,
    claps: [0, 0.75, 1.5, 2, 2.75, 3.5], clapAmp: 1.3,
    couches: [
      { instrument: 'pincee', octave: 2, amp: 0.30, melodie: [
        [[12, 0, .5], [15, .5, .25], [12, .75, .25], [10, 1, .5], [7, 1.5, .5], [10, 2, .5], [12, 2.5, .5], [6, 3, .5], [7, 3.5, .5]],
      ] },
      { instrument: 'anche', octave: 4, amp: 0.16, melodie: [
        [[12, 0, .75], [10, .75, .25], [7, 1, .5], [10, 1.5, .5], [12, 2, .75], [15, 2.75, .25], [12, 3, 1]],
        [[10, 0, .75], [7, .75, .25], [6, 1, .5], [7, 1.5, .5], [10, 2, .75], [12, 2.75, .25], [10, 3, 1]],
        [[7, 0, .75], [5, .75, .25], [3, 1, .5], [5, 1.5, .5], [7, 2, .75], [10, 2.75, .25], [7, 3, 1]],
        [[5, 0, .5], [3, .5, .5], [0, 1, 3]],
      ] },
    ],
  },

  // ABUJA — Chidi Okafor « Zuma », l'afrobeats dans le casque. Le tour la
  // mineur, fa, do, sol ; une guitare highlife qui arpege en souplesse.
  abuja: {
    ...BASE, prog: [[0, MIN], [-4, MAJ], [3, MAJ], [-2, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    claps: [1, 3], clapAmp: 0.9,
    couches: [{ instrument: 'pincee', octave: 4, amp: 0.21, melodie: [
      [[0, 0, .25], [3, .25, .25], [7, .5, .25], [12, .75, .5], [10, 1.25, .25], [7, 1.5, .5], [3, 2, .25], [5, 2.25, .25], [7, 2.5, .5], [10, 3, .5], [7, 3.5, .5]],
      [[-4, 0, .25], [0, .25, .25], [3, .5, .25], [8, .75, .5], [7, 1.25, .25], [3, 1.5, .5], [0, 2, .25], [3, 2.25, .25], [5, 2.5, .5], [8, 3, .5], [7, 3.5, .5]],
      [[3, 0, .25], [7, .25, .25], [10, .5, .25], [15, .75, .5], [12, 1.25, .25], [10, 1.5, .5], [7, 2, .25], [10, 2.25, .25], [12, 2.5, .5], [15, 3, .5], [12, 3.5, .5]],
      [[-2, 0, .25], [2, .25, .25], [5, .5, .25], [10, .75, .5], [7, 1.25, .25], [5, 1.5, .5], [2, 2, .5], [0, 2.5, .5], [-2, 3, 1]],
    ] }],
  },

  // PARIS — Theo Garnier « le Dandy », le foulard de soie. La musette :
  // la mineur, re mineur, mi majeur ; l'accordeon brode en chromatique.
  paris: {
    ...BASE, prog: [[0, MIN], [5, MIN], [-5, MAJ], [0, MIN]], bassPat: BASSE_JUSTE, stabSemi: 7,
    couches: [{ instrument: 'anche', octave: 4, amp: 0.21, melodie: [
      [[7, 0, .5], [8, .5, .25], [7, .75, .25], [6, 1, .25], [7, 1.25, .25], [12, 1.5, 1], [11, 2.5, .5], [12, 3, 1]],
      [[8, 0, .5], [10, .5, .25], [8, .75, .25], [7, 1, .25], [8, 1.25, .25], [12, 1.5, 1], [10, 2.5, .5], [8, 3, 1]],
      [[11, 0, .5], [12, .5, .25], [11, .75, .25], [10, 1, .25], [11, 1.25, .25], [14, 1.5, 1], [11, 2.5, .5], [7, 3, 1]],
      [[8, 0, .5], [7, .5, .5], [3, 1, .5], [2, 1.5, .5], [0, 2, 2]],
    ] }],
  },

  // NEW YORK — Jayden Brooks « Empire », le Bronx la nuit. Le blues mineur
  // aux cuivres de big band, avec sa note bleue ; la tribune frappe 2 et 4.
  newyork: {
    ...BASE, prog: [[0, MIN], [0, MIN], [5, MIN], [-5, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 6,
    claps: [1, 3], clapAmp: 1.1,
    couches: [{ instrument: 'anche', octave: 4, amp: 0.24, melodie: [
      [[0, 0, .5], [3, .5, .5], [5, 1, .25], [6, 1.25, .25], [7, 1.5, 1], [3, 2.5, .5], [5, 3, 1]],
      [[0, 0, .5], [3, .5, .5], [5, 1, .25], [6, 1.25, .25], [7, 1.5, .5], [10, 2, .5], [12, 2.5, 1.5]],
      [[5, 0, .5], [8, .5, .5], [10, 1, .25], [11, 1.25, .25], [12, 1.5, 1], [8, 2.5, .5], [10, 3, 1]],
      [[11, 0, .5], [10, .5, .25], [7, .75, .25], [6, 1, .5], [5, 1.5, .5], [3, 2, .5], [0, 2.5, 1.5]],
    ] }],
  },

  // LONDRES — Oliver Hart « Big Ben », jamais une seconde de retard. Le
  // carillon de Westminster (1793, domaine public), ses quatre changements
  // aux cloches, un par mesure, sur mi, la, fa diese mineur, si.
  londres: {
    ...BASE, prog: [[-5, MAJ], [0, MAJ], [-3, MIN], [2, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    couches: [{ instrument: 'cloche', octave: 4, amp: 0.30, melodie: [
      [[-1, 0, 1], [-3, 1, 1], [-5, 2, 1], [-10, 3, 1]],
      [[-5, 0, 1], [-1, 1, 1], [-3, 2, 1], [-10, 3, 1]],
      [[-5, 0, 1], [-3, 1, 1], [-1, 2, 1], [-5, 3, 1]],
      [[-1, 0, 1], [-5, 1, 1], [-3, 2, 1], [-10, 3, 1]],
    ] }],
  },

  // KARMAN, HERMES « le Messager ». Le mode dorien, l'aulos qui monte et
  // redescend, la lyre qui pince dessous.
  karman: {
    ...BASE, prog: [[0, MIN], [5, MAJ], [0, MIN], [-2, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    couches: [
      { instrument: 'anche', octave: 4, amp: 0.20, melodie: [
        [[0, 0, .5], [2, .5, .5], [3, 1, .5], [5, 1.5, .5], [7, 2, 1], [9, 3, 1]],
        [[9, 0, .5], [7, .5, .5], [5, 1, .5], [9, 1.5, .5], [12, 2, 2]],
        [[10, 0, .5], [9, .5, .5], [7, 1, .5], [5, 1.5, .5], [3, 2, .5], [5, 2.5, .5], [7, 3, 1]],
        [[5, 0, .5], [3, .5, .5], [2, 1, .5], [-2, 1.5, .5], [0, 2, 2]],
      ] },
      { instrument: 'pincee', octave: 3, amp: 0.11, melodie: [
        [[0, 0, .5], [7, 1, .5], [12, 2, .5], [7, 3, .5]],
      ] },
    ],
  },

  // KARMAN, SUN WUKONG « le Roi Singe ». La pentatonique au dizi, qui saute
  // comme lui ; un gong a chaque tour, les claquettes de l'opera de Pekin.
  'karman-wukong': {
    ...BASE, prog: [[0, MAJ], [-3, MIN], [5, MAJ], [7, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    claps: [1.5, 3.5], clapAmp: 1.0,
    couches: [
      { instrument: 'souffle', octave: 4, amp: 0.24, melodie: [
        [[12, 0, .25], [9, .25, .25], [7, .5, .5], [9, 1, .25], [12, 1.25, .25], [14, 1.5, .5], [16, 2, .5], [14, 2.5, .25], [12, 2.75, .25], [9, 3, 1]],
        [[9, 0, .25], [7, .25, .25], [4, .5, .5], [7, 1, .25], [9, 1.25, .25], [12, 1.5, .5], [9, 2, .5], [7, 2.5, .5], [4, 3, 1]],
        [[9, 0, .25], [12, .25, .25], [14, .5, .5], [12, 1, .25], [9, 1.25, .25], [7, 1.5, .5], [9, 2, .5], [12, 2.5, .5], [14, 3, 1]],
        [[16, 0, .5], [14, .5, .5], [12, 1, .5], [9, 1.5, .5], [7, 2, .5], [4, 2.5, .5], [2, 3, .5], [0, 3.5, .5]],
      ] },
      { instrument: 'cloche', octave: 2, amp: 0.30, melodie: [[[0, 0, 4]], [], [], []] },
    ],
  },

  // KARMAN, ANANSI « l'Araignee ». La kalimba qui tisse en pentatonique,
  // la cloche gankogui des Akan qui tourne au-dessus.
  'karman-anansi': {
    ...BASE, prog: [[0, MIN], [-2, MAJ], [0, MIN], [3, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    couches: [
      { instrument: 'cloche', octave: 4, amp: 0.24, melodie: (() => {
        const m = [[0, 0, .25], [7, .25, .25], [12, .5, .25], [10, .75, .25], [7, 1, .25], [12, 1.25, .25], [15, 1.5, .5], [12, 2, .25], [10, 2.25, .25], [7, 2.5, .25], [10, 2.75, .25], [12, 3, .5], [7, 3.5, .5]];
        return [m, tr(m, -2), m, tr(m, 3)];
      })() },
      { instrument: 'cloche', octave: 5, amp: 0.08, melodie: [
        [[12, 0, .1], [12, .5, .1], [12, 1.25, .1], [12, 1.75, .1], [12, 2.5, .1], [12, 3, .1], [12, 3.5, .1]],
      ] },
    ],
  },

  // KARMAN, INTI « le Soleil ». La quena en pentatonique andine, au rythme
  // du huayno (longue, breve), le charango qui gratte dessous.
  'karman-inti': {
    ...BASE, prog: [[0, MIN], [-2, MAJ], [3, MAJ], [-5, MAJ]], bassPat: BASSE_JUSTE, stabSemi: 7,
    contretemps: { instrument: 'pincee', octave: 5, amp: 0.05, temps: [0, 0.75, 1.5, 2, 2.75, 3.5] },
    couches: [{ instrument: 'souffle', octave: 4, amp: 0.26, melodie: [
      [[12, 0, .75], [10, .75, .25], [7, 1, .5], [10, 1.5, .5], [12, 2, .75], [15, 2.75, .25], [12, 3, 1]],
      [[10, 0, .75], [7, .75, .25], [5, 1, .5], [7, 1.5, .5], [10, 2, .75], [12, 2.75, .25], [10, 3, 1]],
      [[15, 0, .75], [12, .75, .25], [10, 1, .5], [12, 1.5, .5], [15, 2, .75], [17, 2.75, .25], [15, 3, 1]],
      [[12, 0, .5], [10, .5, .5], [7, 1, .5], [5, 1.5, .5], [3, 2, .5], [2, 2.5, .5], [0, 3, 1]],
    ] }],
  },

  // L'APOTHEOSE — Zenith « l'Astre ». race3 est deja la musique de
  // l'inter galactique : on la garde entiere, accords diminues compris, et
  // un cristal monte les arpeges des accords, une octave au-dessus.
  apotheose: {
    ...BASE,
    couches: [{ instrument: 'cloche', octave: 5, amp: 0.22, melodie: [
      [[0, 0, 1], [3, 1, 1], [6, 2, 1], [12, 3, 1]],
      tr([[0, 0, 1], [3, 1, 1], [6, 2, 1], [12, 3, 1]], -1),
      tr([[0, 0, 1], [3, 1, 1], [6, 2, 1], [12, 3, 1]], -2),
      [[-3, 0, 1], [1, 1, 1], [5, 2, 1], [9, 3, 1]],
    ] }],
  },
};
