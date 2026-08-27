/* -----------------------------------------------------------------------
   SPRINTER — noyau commun (aucune dependance au navigateur)

   Constantes, cycle de foulee, geometrie de piste, physique et donnees des
   athletes. Ce fichier ne touche ni au DOM ni au canvas : il peut donc etre
   charge tel quel dans une page ou dans Node pour etre teste.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;

  const C = {
    // --- projection isometrique 2:1 -----------------------------------
    ISO_COS: 2 / Math.sqrt(5),
    ISO_SIN: 1 / Math.sqrt(5),

    // --- physique ------------------------------------------------------
    // vitesse moyenne tenue = BOOST * cadence / DRAG, plafonnee
    BOOST: 1.05,
    DRAG: 0.80,
    STUMBLE_BASE: 0.48,
    STUMBLE_SPEED: 0.42,
    STUMBLE_KEEP: 0.20,
    STUMBLE_TIME: 0.62,
    // Au doigt on n'a ni le relief des touches ni leur precision : le pouce
    // part legerement a cote, se pose deux fois, ou arrive en retard. La
    // meme rigueur qu'au clavier se paie donc bien plus cher sur telephone.
    // On attenue le risque de chute quand on joue au toucher. 1 = clavier.
    STUMBLE_INPUT_SCALE: 1,
    STUMBLE_TOUCH_SCALE: 0.55,
    // iOS perd nettement plus d'appuis qu'Android a cadence de course. La
    // cause n'a pas pu etre isolee — un appui physique y produit pourtant
    // bien un evenement et un seul — mais l'ecart de chutes entre les deux
    // plateformes est net. Compensation assumee, a retirer le jour ou la
    // cause reelle sera trouvee.
    STUMBLE_IOS_SCALE: 0.35,
    // Duree de l'ANIMATION de chute, volontairement plus longue que la
    // penalite de vitesse (STUMBLE_TIME) : le coureur a le temps de
    // partir de travers, mouliner des bras et se retablir en titubant,
    // sans pour autant etre penalise plus longtemps qu'avant.
    FALL_TIME: 1.15,

    // --- depart : mise en action, transition, vitesse maximale ----------
    // Un sprinteur sort des blocs corps tres incline, pousse en foulees
    // courtes et frequentes, puis se redresse progressivement. Le
    // redressement s'acheve vers quarante metres, quand la vitesse maximale
    // est atteinte.
    DRIVE_END: 15.0,          // fin de la phase de poussee, en metres
    TRANS_END: 40.0,          // corps entierement redresse
    DRIVE_PITCH: 0.62,        // inclinaison du corps a la sortie des blocs
    // temps de reaction : 0,100 s est le plancher legal, l'elite tourne
    // autour de 0,13 s, au-dela de 0,30 s il n'y a plus rien a gagner
    REACT_BEST: 0.12,
    REACT_WINDOW: 0.32,
    REACT_BONUS: 1.35,        // m/s offerts sur une reaction parfaite
    FALSE_START_FREEZE: 0.28, // blocage si on part avant le signal
    // Transition : la cadence doit monter pendant la poussee. On compare les
    // MEDIANES des deux moities de la phase, pas trois appuis contre trois.
    //
    // Mesure a l'appui : avec trois contre trois, vingt millisecondes d'ecart
    // sur le depart faisaient passer la reussite de 227/300 a 39/300 — le
    // bruit du doigt decidait a la place du joueur. Sur les medianes de
    // moities, taper a fond plafonne a 1,082 et la moindre montee demarre a
    // 1,094 : la separation est franche, la note cesse d'etre un pile ou face.
    TRANS_GOOD: 1.09,
    TRANS_PERFECT: 1.20,
    // Plancher de cadence sur la seconde moitie. Sans lui, le chemin le plus
    // facile vers la note parfaite etait de trainer expres sur les premiers
    // appuis — ratio 3,76, le double d'une vraie montee en puissance.
    // --- relais : la zone de lancement et le passage de temoin ----------
    // Le receveur ne part pas arrete : il dispose de 30 metres pour se lancer,
    // et le temoin change de main quelque part dans cette zone. C'est ce qui
    // rend un relais plus rapide que quatre 100 m mis bout a bout — un depart
    // arrete coute 1,11 s, mesure sur cette physique.
    RELAY_LAUNCH: 30.0,
    // Le passage se joue a deux : le donneur et le receveur touchent au meme
    // instant. L'ecart entre les deux touches, mesure sur l'horloge commune de
    // la salle, donne la note. Les fenetres tiennent compte de ce que la
    // synchronisation d'horloge laisse d'incertitude — moins de 15 ms mesures
    // sur l'infrastructure reelle — et de la variabilite humaine, qui est
    // l'ordre de grandeur dominant.
    RELAY_SYNC_PERFECT: 0.070,
    RELAY_SYNC_GOOD: 0.180,
    // Effets, dans l'ordre rate / bon / parfait.
    //
    // Ils portent A LA FOIS sur le plafond de vitesse et sur le freinage, et
    // pour toute la duree du relais. C'est la mesure qui l'impose : la vitesse
    // tenue vaut BOOST / (1 - exp(-DRAG x cadence)), plafonnee par maxSpeed.
    // Un joueur a cadence lente est limite par le freinage et ne sent pas le
    // plafond ; un joueur rapide tape dans le plafond et ne sent pas le
    // freinage. N'agir que sur l'un des deux ne toucherait que la moitie des
    // joueurs. Agir seulement au moment de la passe ne toucherait personne :
    // sur 100 m le coureur reaccelere, et toute correction ponctuelle se
    // dissout — c'est la raison pour laquelle l'effet dure.
    RELAY_PASS_VMAX: [0.940, 1.000, 1.045],
    RELAY_PASS_DRAG: [1.080, 1.000, 0.930],
    RELAY_PASS_BOOST: [0, 0.20, 0.45],
    RELAY_PASS_KEEP: [0.60, 1.00, 1.00],   // part de la vitesse de lancement gardee
    RELAY_PASS_FREEZE: [0.15, 0, 0],       // le temoin echappe des mains
    // Le lieu du passage ne se negocie pas : hors de la zone, avant la zone,
    // ou temoin lache — l'equipe est eliminee. Il n'y a donc pas de bareme
    // pour un passage mal place, seulement pour un passage mal synchronise.
    // C'est la regle de l'athletisme, et elle change la nature du mode : on
    // n'y perd pas des secondes, on y perd la course.
    // L'effet couvre tout le relais : au-dela de la duree d'une portion, la
    // valeur exacte n'a plus d'importance.
    RELAY_EFFECT_TIME: 30.0,

    TRANS_FLOOR: 0.125,
    TRANS_MIN_PRESS: 8,
    TRANS_BOOST: [0, 0.26, 0.55],   // impulsion immediate, selon la note
    TRANS_DRAG: [1.0, 0.88, 0.78],  // freinage allege pendant TRANS_TIME
    TRANS_TIME: [0, 2.2, 3.0],
    // Une transition reussie ne donne pas seulement un coup d'accelerateur :
    // elle fixe la vitesse maximale tenue jusqu'a l'arrivee. C'est la que se
    // joue l'essentiel du gain, de l'ordre du dixieme de seconde.
    //
    // Releve juste assez pour que jouer la transition rapporte vraiment :
    // avec l'imprecision reelle du doigt, l'ancienne valeur la rendait
    // legerement perdante (-0,025 s), donc decorative.
    TRANS_VMAX: [1.0, 1.018, 1.042],

    // --- morphologie ---------------------------------------------------
    MODEL_H: 1.72,
    MIN_H: 1.60,
    MAX_H: 2.00,

    // --- piste ----------------------------------------------------------
    LANE_W: 1.22,
    LANE_COUNT: 8,
    R1: 36.80,
    RUNOUT: 26.0
  };

  // Trois epreuves. Le 100 m est le cas particulier sans virage ; le 400 m
  // est un tour complet de piste (deux virages, deux lignes droites).
  const RACES = {
    '100': {
      key: '100', label: '100 METRES', sub: 'la ligne droite',
      arc: 0, straight: 100, maxSpeed: 12.435, best: 9.10,
      ranges: [[12.50, 15.00], [11.20, 12.50], [10.00, 10.50],
               [9.58, 10.00], [9.58, 9.85], [9.11, 9.58]]
    },
    '200': {
      key: '200', label: '200 METRES', sub: 'virage et ligne droite',
      arc: 115.61, straight: 84.39, maxSpeed: 12.021, best: 18.20,
      ranges: [[25.00, 30.00], [22.40, 25.00], [20.00, 21.00],
               [19.16, 20.00], [19.16, 19.70], [18.22, 19.16]]
    },
    // Le relais emprunte la geometrie du 400 m — un tour de piste — mais se
    // court en quatre portions de cent metres. La vitesse de pointe est celle
    // du 100 m : un relayeur sprinte, il ne gere pas un tour.
    '4x100': {
      key: '4x100', label: '4 x 100 METRES', sub: 'le relais',
      fullLap: true, relay: true, legs: 4, legLength: 100,
      arc: 115.61, straight: 84.39, maxSpeed: 12.435, best: 36.84,
      ranges: [[50.00, 60.00], [45.00, 50.00], [40.00, 44.00],
               [38.00, 40.00], [37.20, 38.00], [36.84, 37.60]]
    },
    '400': {
      key: '400', label: '400 METRES', sub: 'un tour de piste', fullLap: true,
      arc: 115.61, straight: 84.39, maxSpeed: 11.536, best: 36.90,
      ranges: [[55.00, 60.00], [49.00, 55.00], [44.50, 49.00],
               [43.50, 44.50], [43.18, 43.50], [36.98, 37.98]]
    }
  };

  // pool : carnation du plateau. 'divers' pour les etapes locales,
  // 'sprint' pour le mondial, les Jeux et la finale ZEZE.
  const LEVELS = [
    { name: 'Competition scolaire', theme: 'day', pool: 'divers',
      names: ['Paul Martin', 'Leo Dubois', 'Noah Petit', 'Enzo Roy',
              'Nathan Blanc', 'Lina Fontaine', 'Rayan Girard'] },
    { name: 'Niveau regional', theme: 'day', pool: 'divers',
      names: ['Karim Faure', 'Yanis Perrin', 'Bilal Moreau', 'Malik Simon',
              'Idris Laurent', 'Ana Ferreira', 'Souleymane Garcia'] },
    { name: 'Niveau national', theme: 'day', pool: 'divers',
      names: ['Vince Rapido', 'Max Eclair', 'Eddie Foudre', 'Timo Flash',
              'Ken Turbo', 'Dan Sonic', 'Lea Comet'] },
    { name: 'Championnat du monde', theme: 'day', pool: 'sprint',
      names: ['Erik Rocket', 'Ivan Blitz', 'Otto Rush', 'Sven Dash',
              'Lars Zoom', 'Nils Storm', 'Freya Comet'] },
    { name: 'Jeux olympiques', theme: 'olympic', pool: 'sprint',
      names: ['Blaze Kade', 'Jett Cruz', 'Rex Solar', 'Kai Volt',
              'Ash Comet', 'Neo Flash', 'Ray Quick'] },
    { name: 'Inter galactique', theme: 'cosmos', pool: 'sprint',
      names: ['Benbezi ZEZE', 'Ryan ZEZE', 'Mickeal ZEZE', 'Greta ZEZE',
              'Herman ZEZE', 'Ervie ZEZE', 'Victoire ZEZE'] }
  ];

  // ---------------------------------------------------------------------
  // CYCLE DE FOULEE
  // ---------------------------------------------------------------------
  // Points cles d'un cycle de sprint (deux appuis), interpoles par une
  // spline de Catmull-Rom : la vitesse angulaire reste continue d'un point
  // au suivant, ce qu'une sinusoide ne donne pas.
  //   q = 0.00 pose du pied      q = 1.50 poussee
  //   q = 2.70 talon-fesse       q = 4.85 genou haut

  function catmull(keys, n) {
    n = n || 192;
    const m = keys.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const q = TAU * i / n;
      let j = 0;
      for (let t = 0; t < m; t++) {
        let q0 = keys[t][0], q1 = keys[(t + 1) % m][0];
        if (q1 < q0) q1 += TAU;
        const qq = q >= q0 ? q : q + TAU;
        if (qq >= q0 && qq <= q1) { j = t; break; }
      }
      const p0 = keys[(j - 1 + m) % m][1], p1 = keys[j][1];
      const p2 = keys[(j + 1) % m][1], p3 = keys[(j + 2) % m][1];
      let a0 = keys[j][0], a1 = keys[(j + 1) % m][0];
      if (a1 < a0) a1 += TAU;
      const qq = q >= a0 ? q : q + TAU;
      const t = (qq - a0) / Math.max(1e-6, a1 - a0), t2 = t * t;
      out[i] = 0.5 * (2 * p1 + (-p0 + p2) * t +
                      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                      (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t);
    }
    return out;
  }

  function gait(table, q) {
    const n = table.length;
    let x = ((q % TAU) + TAU) % TAU / TAU * n;
    const i = Math.floor(x), f = x - i;
    return table[i % n] + (table[(i + 1) % n] - table[i % n]) * f;
  }

  const GAIT = {
    thigh: catmull([[0, 0.38], [0.75, -0.02], [1.50, -0.50], [2.20, -0.30],
                    [3.10, 0.20], [4.10, 0.68], [4.85, 0.80], [5.55, 0.66]]),
    knee: catmull([[0, -0.28], [0.50, -0.60], [1.10, -0.30], [1.50, -0.16],
                   [2.10, -1.20], [2.70, -2.00], [3.40, -2.05], [4.20, -1.55],
                   [5.00, -0.90], [5.60, -0.42]]),
    ankle: catmull([[0, 0.12], [0.60, 0.02], [1.45, -0.52], [2.10, -0.30],
                    [3.20, 0.16], [4.60, 0.20], [5.60, 0.14]]),
    arm: catmull([[0, 0.42], [1.10, 0.10], [2.20, -0.46], [3.14, -0.95],
                  [4.10, -0.60], [5.10, 0.05], [5.70, 0.30]]),
    elbow: catmull([[0, 1.60], [1.10, 1.34], [2.20, 0.98], [3.14, 0.78],
                    [4.10, 1.04], [5.10, 1.44], [5.70, 1.56]])
  };

  // Couplage bras / jambes (biomecanique du sprint) : le bras doit etre au
  // plus loin en arriere quand la cuisse du MEME cote est au plus haut
  // devant, et inversement. Les deux courbes n'ayant pas leurs extremes au
  // meme endroit du cycle (cuisse avant vers 4,81 rad, bras arriere vers
  // 3,18 rad), un simple dephasage de PI ne les met PAS en opposition : on
  // obtenait un bras et un genou qui montaient du meme cote, ce qui ne
  // ressemble a rien d'athletique. On cale donc le bras sur la cuisse a
  // partir des extremes reels des tables, plutot qu'en supposant qu'elles
  // sont alignees.
  // ---- profils de foulee -------------------------------------------------
  // Chaque athlete court avec SA biomecanique. Les tables donnent la forme du
  // cycle (angles au fil de la foulee) ; les scalaires donnent le caractere :
  // amplitude des membres, inclinaison du buste, rebond vertical, et longueur
  // d'appui (stride) qui arbitre entre foulee longue et haute frequence.
  // 'base' reprend a l'identique la foulee historique : tout athlete sans
  // profil declare court exactement comme avant.
  const GAITS = {
    base: Object.assign({}, GAIT, {
      boost: 1.18, armAmp: 1.00, lean: 1.00, bob: 1.00, stride: 1.00
    }),

    // Cadence tres elevee plutot que foulee longue, recuperation talon-fessier
    // tres compacte et maintenue tard, buste haut, bras relaches.
    cadence: {
      thigh: catmull([[0, 0.34], [0.75, -0.02], [1.50, -0.44], [2.20, -0.26],
                      [3.10, 0.18], [4.10, 0.62], [4.85, 0.74], [5.55, 0.60]]),
      knee: catmull([[0, -0.26], [0.50, -0.58], [1.10, -0.30], [1.50, -0.18],
                     [2.10, -1.44], [2.70, -2.28], [3.40, -2.34], [4.20, -1.86],
                     [5.00, -1.02], [5.60, -0.40]]),
      ankle: catmull([[0, 0.14], [0.60, 0.04], [1.45, -0.48], [2.10, -0.28],
                      [3.20, 0.18], [4.60, 0.22], [5.60, 0.15]]),
      arm: catmull([[0, 0.36], [1.10, 0.08], [2.20, -0.40], [3.14, -0.82],
                    [4.10, -0.52], [5.10, 0.04], [5.70, 0.26]]),
      elbow: catmull([[0, 1.72], [1.10, 1.48], [2.20, 1.12], [3.14, 0.92],
                      [4.10, 1.18], [5.10, 1.58], [5.70, 1.68]]),
      boost: 1.14, armAmp: 0.90, lean: 0.82, bob: 0.88, stride: 0.97
    },

    // Sprinteur vif : appuis brefs, genou avant qui remonte tot et vite,
    // bras nerveux. Amplitude contenue, tout est dans la frequence.
    sharp: {
      thigh: catmull([[0, 0.42], [0.75, 0.00], [1.50, -0.46], [2.20, -0.24],
                      [3.10, 0.28], [4.10, 0.76], [4.85, 0.84], [5.55, 0.66]]),
      knee: catmull([[0, -0.30], [0.50, -0.64], [1.10, -0.32], [1.50, -0.14],
                     [2.10, -1.34], [2.70, -2.12], [3.40, -2.08], [4.20, -1.44],
                     [5.00, -0.78], [5.60, -0.38]]),
      ankle: catmull([[0, 0.16], [0.60, 0.02], [1.45, -0.56], [2.10, -0.32],
                      [3.20, 0.20], [4.60, 0.24], [5.60, 0.16]]),
      arm: catmull([[0, 0.48], [1.10, 0.12], [2.20, -0.50], [3.14, -1.02],
                    [4.10, -0.64], [5.10, 0.06], [5.70, 0.34]]),
      elbow: catmull([[0, 1.62], [1.10, 1.32], [2.20, 0.94], [3.14, 0.72],
                      [4.10, 1.00], [5.10, 1.46], [5.70, 1.58]]),
      boost: 1.20, armAmp: 1.08, lean: 1.06, bob: 0.94, stride: 0.94
    },

    // Puissance : poussee longue, forte extension derriere, jambe plus
    // tendue a l'appui, bras amples. Frequence plus basse, foulee qui avale.
    power: {
      thigh: catmull([[0, 0.40], [0.75, -0.06], [1.50, -0.64], [2.20, -0.40],
                      [3.10, 0.18], [4.10, 0.72], [4.85, 0.86], [5.55, 0.72]]),
      knee: catmull([[0, -0.22], [0.50, -0.50], [1.10, -0.26], [1.50, -0.12],
                     [2.10, -1.02], [2.70, -1.74], [3.40, -1.80], [4.20, -1.40],
                     [5.00, -0.84], [5.60, -0.38]]),
      ankle: catmull([[0, 0.10], [0.60, 0.00], [1.45, -0.62], [2.10, -0.34],
                      [3.20, 0.14], [4.60, 0.18], [5.60, 0.12]]),
      arm: catmull([[0, 0.50], [1.10, 0.12], [2.20, -0.54], [3.14, -1.08],
                    [4.10, -0.68], [5.10, 0.06], [5.70, 0.36]]),
      elbow: catmull([[0, 1.52], [1.10, 1.26], [2.20, 0.90], [3.14, 0.70],
                      [4.10, 0.96], [5.10, 1.36], [5.70, 1.48]]),
      boost: 1.26, armAmp: 1.12, lean: 1.14, bob: 1.10, stride: 1.03
    },

    // Foulee huilee : aucune cassure, extremes adoucis, tres peu de rebond.
    // Amplitude large mais posee - l'impression de glisser sans forcer.
    fluid: {
      thigh: catmull([[0, 0.36], [0.75, -0.04], [1.50, -0.54], [2.20, -0.34],
                      [3.10, 0.16], [4.10, 0.64], [4.85, 0.76], [5.55, 0.64]]),
      knee: catmull([[0, -0.26], [0.50, -0.54], [1.10, -0.32], [1.50, -0.20],
                     [2.10, -1.10], [2.70, -1.80], [3.40, -1.88], [4.20, -1.50],
                     [5.00, -0.92], [5.60, -0.44]]),
      ankle: catmull([[0, 0.11], [0.60, 0.02], [1.45, -0.46], [2.10, -0.28],
                      [3.20, 0.14], [4.60, 0.17], [5.60, 0.12]]),
      arm: catmull([[0, 0.38], [1.10, 0.10], [2.20, -0.42], [3.14, -0.86],
                    [4.10, -0.56], [5.10, 0.04], [5.70, 0.28]]),
      elbow: catmull([[0, 1.56], [1.10, 1.34], [2.20, 1.02], [3.14, 0.84],
                      [4.10, 1.08], [5.10, 1.42], [5.70, 1.52]]),
      boost: 1.16, armAmp: 0.96, lean: 0.88, bob: 0.72, stride: 0.98
    },

    // Frequence elevee ET grande amplitude, talon qui claque tres haut sous
    // la fesse, buste redresse jusqu'a paraitre en arriere, epaules relachees.
    lyles: {
      thigh: catmull([[0, 0.38], [0.75, -0.04], [1.50, -0.58], [2.20, -0.32],
                      [3.10, 0.24], [4.10, 0.78], [4.85, 0.92], [5.55, 0.74]]),
      knee: catmull([[0, -0.28], [0.50, -0.62], [1.10, -0.34], [1.50, -0.18],
                     [2.10, -1.50], [2.70, -2.34], [3.40, -2.42], [4.20, -1.92],
                     [5.00, -1.06], [5.60, -0.44]]),
      ankle: catmull([[0, 0.14], [0.60, 0.02], [1.45, -0.58], [2.10, -0.32],
                      [3.20, 0.18], [4.60, 0.22], [5.60, 0.14]]),
      arm: catmull([[0, 0.44], [1.10, 0.10], [2.20, -0.48], [3.14, -0.92],
                    [4.10, -0.58], [5.10, 0.05], [5.70, 0.32]]),
      elbow: catmull([[0, 1.66], [1.10, 1.40], [2.20, 1.06], [3.14, 0.86],
                      [4.10, 1.12], [5.10, 1.50], [5.70, 1.62]]),
      boost: 1.22, armAmp: 0.98, lean: 0.70, bob: 0.92, stride: 1.00
    },

    // Puissance appuyee : buste plus engage, poussee qui dure, rebond franc.
    // Une foulee qui laboure plutot qu'elle ne caresse.
    drive: {
      thigh: catmull([[0, 0.44], [0.75, -0.02], [1.50, -0.60], [2.20, -0.38],
                      [3.10, 0.22], [4.10, 0.70], [4.85, 0.82], [5.55, 0.70]]),
      knee: catmull([[0, -0.24], [0.50, -0.56], [1.10, -0.28], [1.50, -0.14],
                     [2.10, -1.16], [2.70, -1.90], [3.40, -1.96], [4.20, -1.52],
                     [5.00, -0.88], [5.60, -0.40]]),
      ankle: catmull([[0, 0.13], [0.60, 0.00], [1.45, -0.60], [2.10, -0.34],
                      [3.20, 0.17], [4.60, 0.21], [5.60, 0.13]]),
      arm: catmull([[0, 0.52], [1.10, 0.14], [2.20, -0.52], [3.14, -1.04],
                    [4.10, -0.66], [5.10, 0.07], [5.70, 0.36]]),
      elbow: catmull([[0, 1.50], [1.10, 1.24], [2.20, 0.88], [3.14, 0.68],
                      [4.10, 0.94], [5.10, 1.34], [5.70, 1.46]]),
      boost: 1.24, armAmp: 1.10, lean: 1.20, bob: 1.14, stride: 1.04
    },

    // Foulee aerienne : suspension longue, genou qui monte haut et retombe
    // lentement, peu d'appuis. Silhouette longiligne qui semble planer.
    glide: {
      thigh: catmull([[0, 0.34], [0.75, -0.06], [1.50, -0.56], [2.20, -0.36],
                      [3.10, 0.14], [4.10, 0.66], [4.85, 0.84], [5.55, 0.68]]),
      knee: catmull([[0, -0.28], [0.50, -0.52], [1.10, -0.34], [1.50, -0.22],
                     [2.10, -1.06], [2.70, -1.72], [3.40, -1.84], [4.20, -1.56],
                     [5.00, -0.98], [5.60, -0.46]]),
      ankle: catmull([[0, 0.10], [0.60, 0.03], [1.45, -0.44], [2.10, -0.26],
                      [3.20, 0.13], [4.60, 0.16], [5.60, 0.11]]),
      arm: catmull([[0, 0.34], [1.10, 0.09], [2.20, -0.38], [3.14, -0.80],
                    [4.10, -0.52], [5.10, 0.03], [5.70, 0.24]]),
      elbow: catmull([[0, 1.58], [1.10, 1.38], [2.20, 1.08], [3.14, 0.90],
                      [4.10, 1.14], [5.10, 1.46], [5.70, 1.54]]),
      boost: 1.20, armAmp: 0.92, lean: 0.78, bob: 1.06, stride: 1.06
    }
  };

  // Couplage bras / jambes (biomecanique du sprint) : le bras doit etre au
  // plus loin en arriere quand la cuisse du MEME cote est au plus haut
  // devant, et inversement. Les deux courbes n'ayant pas leurs extremes au
  // meme endroit du cycle, un simple dephasage de PI ne les met PAS en
  // opposition : on obtenait un bras et un genou qui montaient du meme cote,
  // ce qui ne ressemble a rien d'athletique. On cale donc le bras sur la
  // cuisse a partir des extremes reels des tables, plutot qu'en supposant
  // qu'elles sont alignees. Chaque profil ayant ses propres tables, le
  // dephasage se calcule par profil (et se retient, c'est un balayage).
  function peakAt(table, sign) {
    let best = -Infinity, at = 0;
    for (let i = 0; i < 720; i++) {
      const q = TAU * i / 720, v = sign * gait(table, q);
      if (v > best) { best = v; at = q; }
    }
    return at;
  }

  const armPhaseCache = new Map();
  function armPhaseOf(P) {
    let v = armPhaseCache.get(P);
    if (v === undefined) {
      v = ((peakAt(P.arm, -1) - peakAt(P.thigh, 1)) % TAU + TAU) % TAU;
      armPhaseCache.set(P, v);
    }
    return v;
  }

  const EMPTY_MORPH = {};

  function gaitOf(look) {
    return (look && GAITS[look.gait]) || GAITS.base;
  }

  const ARM_PHASE = armPhaseOf(GAITS.base);

  // ---------------------------------------------------------------------
  // ATHLETES
  // ---------------------------------------------------------------------
  const SKIN = {
    ebene: [74, 46, 32], cacao: [96, 60, 40], acajou: [108, 66, 42],
    noisette: [120, 76, 50], bronze: [142, 92, 58],
    ambre: [176, 122, 78], miel: [198, 150, 104],
    olive: [206, 166, 118], sable: [224, 186, 142],
    clair: [238, 204, 166], porcelaine: [246, 220, 190]
  };
  // Les etapes locales reunissent un plateau tire au hasard parmi toutes
  // les carnations (rien n'empeche deux ou six coureurs de sortir avec la
  // meme couleur, c'est un vrai tirage). A partir du championnat du monde,
  // le plateau est exclusivement noir, comme les vraies finales du 100 m.
  const SKIN_POOL = {
    divers: ['ebene', 'cacao', 'acajou', 'noisette', 'bronze', 'ambre',
             'miel', 'olive', 'sable', 'clair', 'porcelaine'],
    sprint: ['ebene']
  };
  const HAIR_COLS = {
    noir: [28, 22, 22], brun: [56, 36, 24], chatain: [92, 62, 36],
    blond: [188, 154, 88], roux: [148, 74, 38], gris: [176, 176, 182]
  };
  const HAIR = HAIR_COLS.noir;

  function look(o) {
    return {
      build: o.build || 'm',
      skin: SKIN[o.skin] || SKIN.cacao,
      jersey: o.jersey,
      shorts: o.shorts || [28, 28, 42],
      shoe: o.shoe || [250, 250, 255],
      hair: o.hair || 'crop',
      hairCol: o.hairCol || HAIR,
      h: Math.max(C.MIN_H, Math.min(C.MAX_H, o.h || 1.80)),
      // Profil de foulee (voir GAITS) et retouches de gabarit : deux athletes
      // de meme taille doivent pouvoir avoir une silhouette et une gestuelle
      // reconnaissables. Absents => foulee historique et gabarit standard.
      gait: o.gait || 'base',
      morph: o.morph || null
    };
  }

  // Meme regle que le reste du plateau "sprint" a partir du mondial :
  // que des carnations noires (ebene) pour la finale ZEZE.
  const ZEZE = {
    // Sept athletes, sept foulees et sept gabarits : chacun doit etre
    // reconnaissable de loin a sa silhouette, et de pres a sa gestuelle.
    // Le profil (voir GAITS) porte la biomecanique, morph le gabarit.
    'Benbezi ZEZE': look({ build: 'm', skin: 'ebene', jersey: [214, 48, 62],
      shorts: [26, 26, 40], hair: 'fade', h: 1.86,
      gait: 'lyles', morph: { sh: 1.06, hip: 0.98, arm: 1.04, leg: 1.04 } }),
    'Ryan ZEZE': look({ build: 'm', skin: 'ebene', jersey: [48, 132, 232],
      shorts: [24, 30, 52], shoe: [250, 224, 70], hair: 'crop', h: 1.78,
      gait: 'sharp', morph: { sh: 1.02, hip: 0.98, arm: 1.02, leg: 1.06 } }),
    'Mickeal ZEZE': look({ build: 'm', skin: 'ebene', jersey: [44, 190, 128],
      shorts: [22, 34, 32], shoe: [246, 126, 46], hair: 'flattop', h: 1.85,
      gait: 'power', morph: { sh: 1.14, hip: 1.02, arm: 1.16, leg: 1.12 } }),
    'Herman ZEZE': look({ build: 'm', skin: 'ebene', jersey: [246, 150, 40],
      shorts: [34, 26, 22], shoe: [126, 226, 250], hair: 'shaved', h: 2.00,
      gait: 'fluid', morph: { sh: 0.96, hip: 0.94, arm: 0.92, leg: 0.94 } }),
    'Greta ZEZE': look({ build: 'f', skin: 'ebene', jersey: [162, 92, 232],
      shorts: [28, 22, 44], hair: 'bun', h: 1.70,
      gait: 'drive', morph: { sh: 1.12, hip: 1.06, arm: 1.10, leg: 1.14 } }),
    'Ervie ZEZE': look({ build: 'f', skin: 'ebene', jersey: [36, 198, 196],
      shorts: [20, 34, 36], shoe: [250, 224, 70], hair: 'braids', h: 1.75,
      gait: 'glide', morph: { sh: 0.92, hip: 0.94, arm: 0.88, leg: 0.92 } }),
    'Victoire ZEZE': look({ build: 'f', skin: 'ebene', jersey: [236, 96, 178],
      shorts: [36, 22, 36], shoe: [246, 126, 46], hair: 'ponytail', h: 1.63,
      gait: 'cadence', morph: { sh: 0.98, hip: 1.02, arm: 0.96, leg: 1.12 } })
  };

  const PLAYER_LOOK = look({ build: 'm', skin: 'ebene', jersey: [248, 205, 74],
    shorts: [38, 40, 68], hair: 'crop', h: 1.82 });

  const JERSEYS = [[64, 178, 235], [72, 214, 132], [236, 92, 88],
                   [176, 108, 235], [46, 206, 190], [246, 166, 52],
                   [226, 96, 168]];
  const SHOES = [[250, 250, 255], [250, 224, 70], [246, 126, 46],
                 [126, 226, 250]];
  const HAIRS = ['crop', 'fade', 'shaved', 'bun', 'ponytail', 'braids',
                 'flattop'];

  // Generateur deterministe : un meme nom donne toujours le meme athlete.
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  function lookFor(name, pool) {
    if (ZEZE[name]) return ZEZE[name];
    let s = hashSeed(name + '|' + (pool || 'divers'));
    const nx = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
    const skins = SKIN_POOL[pool] || SKIN_POOL.divers;
    const skin = skins[Math.floor(nx() * skins.length)];
    // Les cheveux clairs ne vont qu'avec les carnations claires.
    const pale = ['sable', 'clair', 'porcelaine', 'olive'].indexOf(skin) >= 0;
    const hairs = pale ? ['noir', 'brun', 'chatain', 'blond', 'roux']
                       : ['noir', 'noir', 'brun'];
    return look({
      build: nx() < 0.34 ? 'f' : 'm',
      skin: skin,
      jersey: JERSEYS[Math.floor(nx() * JERSEYS.length)],
      shorts: [26 + Math.floor(nx() * 14), 26 + Math.floor(nx() * 10),
               36 + Math.floor(nx() * 16)],
      shoe: SHOES[Math.floor(nx() * SHOES.length)],
      hair: HAIRS[Math.floor(nx() * HAIRS.length)],
      hairCol: HAIR_COLS[hairs[Math.floor(nx() * hairs.length)]],
      h: C.MIN_H + nx() * (C.MAX_H - C.MIN_H)
    });
  }

  // ---------------------------------------------------------------------
  // PISTE
  // ---------------------------------------------------------------------
  // Le 200 m enchaine un virage puis une ligne droite ; le 100 m est le meme
  // trace avec un virage de longueur nulle. Comme l'arc parcouru est le meme
  // pour tous les couloirs alors que les rayons different, l'angle balaye
  // diminue vers l'exterieur : c'est le depart en quinconce.
  //
  // Le 400 m est un tour complet : ce meme virage + ligne droite, suivi
  // d'un second demi-tour identique tourne de 180 degres. Contrairement au
  // premier virage (ou demarre la course, d'ou le depart en quinconce),
  // le second virage n'est jamais un point de depart : tous les couloirs y
  // balaient exactement le meme angle (un demi-tour, pi radians), a l'image
  // d'un vrai virage "interieur" de piste ou personne ne prend d'avance.
  // Les deux portions se raccordent exactement bout a bout (verifie
  // numeriquement : pour le couloir 1, le point de depart et la ligne
  // d'arrivee du 400 m tombent alors au meme endroit, comme sur une vraie
  // piste ou ce couloir boucle un tour parfait).
  function Track(race) {
    this.arc = race.arc;
    this.straight = race.straight;
    this.fullLap = !!race.fullLap;
    this.total = this.fullLap ? 2 * (race.arc + race.straight) : race.arc + race.straight;
    this.curved = race.arc > 0;
  }
  Track.prototype.radius = function (lane) {
    return C.R1 + lane * C.LANE_W + C.LANE_W * 0.5;
  };
  Track.prototype.edge = function (e) { return C.R1 + e * C.LANE_W; };
  Track.prototype.posR = function (v, r, onBend) {
    if (this.curved && onBend) return [-r * Math.sin(v), r * Math.cos(v)];
    return [v, this.curved ? r : r];
  };
  // Second demi-tour : meme forme que le premier (bascule vers la formule
  // "pure", puisqu'on n'y demarre jamais), tourne de 180 degres et
  // translate pour raccorder exactement au bout de la premiere ligne droite.
  Track.prototype.posLap2 = function (s2, r) {
    const A = this.arc, S = this.straight;
    if (s2 < A) {
      const phi = Math.PI * (A - s2) / A;
      return [S + r * Math.sin(phi), -r * Math.cos(phi)];
    }
    return [S - (s2 - A), -r];
  };
  // Position a la distance s, pour un rayon donne directement (pas
  // necessairement le centre d'un couloir : sert aussi au rendu, qui
  // dessine des reperes a des rayons arbitraires comme les bords de piste).
  Track.prototype.posAtR = function (s, r) {
    if (this.fullLap && s >= this.arc + this.straight) {
      return this.posLap2(s - (this.arc + this.straight), r);
    }
    if (s < this.arc) {
      const phi = (this.arc - s) / r;
      return [-r * Math.sin(phi), r * Math.cos(phi)];
    }
    return [s - this.arc, r];
  };
  Track.prototype.pos = function (s, lane) {
    if (!this.curved) return [s, C.LANE_W * (lane + 0.5)];
    return this.posAtR(s, this.radius(lane));
  };
  Track.prototype.heading = function (s, lane) {
    if (!this.curved) return 0;
    if (this.fullLap && s >= this.arc + this.straight) {
      const s2 = s - (this.arc + this.straight);
      if (s2 < this.arc) return Math.PI * (this.arc - s2) / this.arc - Math.PI;
      return -Math.PI;
    }
    if (s >= this.arc) return 0;
    return (this.arc - s) / this.radius(lane);
  };
  Track.prototype.lean = function (s, lane, v) {
    if (!this.curved) return 0;
    let sBend = null;
    if (this.fullLap && s >= this.arc + this.straight) {
      const s2 = s - (this.arc + this.straight);
      if (s2 < this.arc) sBend = s2;
    } else if (s < this.arc) {
      sBend = s;
    }
    if (sBend === null) return 0;
    const a = Math.atan((v * v) / (9.81 * this.radius(lane)));
    const fade = Math.max(0, Math.min(1, (this.arc - sBend) / 9));
    // En debut de courbe (depart en quinconce, ou en sortie du second
    // virage), l'orientation (headAng) peut depasser 90 degres : combinee
    // a l'inclinaison laterale, la projection isometrique ecrasait
    // visuellement le coureur. On attenue donc l'inclinaison quand le cap
    // s'ecarte trop de l'axe de course, pour ne la laisser pleinement
    // visible qu'une fois le coureur revenu vers cet axe.
    const heading = Math.abs(this.heading(s, lane));
    const tempered = Math.max(0.4, 1 - heading / (Math.PI * 0.85));
    return Math.min(a, 0.38) * fade * tempered;
  };

  // ---------------------------------------------------------------------
  // COUREUR
  // ---------------------------------------------------------------------
  function Runner(name, lane, opts) {
    opts = opts || {};
    this.name = name;
    this.lane = lane;
    this.isPlayer = !!opts.isPlayer;
    this.look = this.isPlayer ? PLAYER_LOOK : lookFor(name, opts.pool);
    this.d = 0; this.v = 0;
    this.finished = false; this.finishTime = null;
    this.stride = Math.random() * TAU;
    this.lastStep = 0;
    this.stumbleTimer = 0; this.fallAnim = 0; this.lastKey = null;
    // depart : reaction, cadence de poussee, note de transition
    this.reaction = null; this.reactBonus = 0; this.jumped = false;
    this.freeze = 0; this.pressTimes = []; this.stumbledInDrive = false;
    // Relais : note du passage recu, et ecart entre les deux touches.
    this.passGrade = null; this.passGap = 0;
    // Ou commence la portion de ce coureur, et sur quelle longueur il se met
    // en action. Zero et DRIVE_END pour une course ordinaire — un relayeur,
    // lui, demarre a 100, 200 ou 300 metres du depart, et dispose de trente
    // metres de lancement au lieu de quinze de poussee. Sans ces deux
    // reperes, la transition serait notee au mauvais endroit et le troisieme
    // relayeur serait juge sur une phase qu'il a franchie depuis longtemps.
    this.legStart = 0;
    this.driveEnd = C.DRIVE_END;
    this.transGrade = null; this.transRatio = 0;
    this.boostT = 0; this.boostDrag = 1; this.drivePitch = C.DRIVE_PITCH;
    this.target = opts.target || null;
    this.maxSpeed = opts.maxSpeed || 12;
    this.best = opts.best || 9.1;
    this.total = opts.total || 100;
    if (this.target) this.setPace(this.target);
  }

  Runner.prototype.setPace = function (T) {
    // v(t) = vmax (1 - e^-t/tau) : montee en vitesse puis allure tenue.
    // Une courbe en S ferait ralentir le coureur jusqu'a l'arret sur la
    // ligne, ce qui donne l'illusion d'etre double au dernier metre.
    this.target = T;
    this.tau = Math.max(0.35, Math.min(1.10, T * 0.16));
    const den = T - this.tau * (1 - Math.exp(-T / this.tau));
    this.vmax = this.total / Math.max(0.01, den);
  };

  // Distance couverte par UN appui (un pied), pas par le cycle complet :
  // un sprinteur d'elite pose le pied environ tous les 2,2 a 2,5 m a pleine
  // vitesse (~41 a 48 appuis sur 100 m). r.stride avance de PI (demi-tour)
  // par appui, donc de TAU (le cycle complet, 2 appuis) pour deux fois
  // cette distance - c'est ce qui fixe le bon nombre de foulees vs le
  // chrono, plutot qu'un cycle deux fois trop rapide.
  Runner.prototype.strideLength = function () {
    const amp = 0.34 + 0.66 * Math.min(1, this.v / this.maxSpeed);
    const leg = 0.87 * (this.look.h / C.MODEL_H);
    // stride > 1 : foulee qui avale, moins d'appuis. stride < 1 : haute
    // frequence. La vitesse ne change pas, seul le nombre d'appuis pour la
    // couvrir - c'est la difference entre un finisseur et un frequenciel.
    const P = gaitOf(this.look);
    return Math.max(0.85, 4 * leg * P.stride *
                    Math.sin(Math.min(1.15, 0.70 * amp)));
  };

  // Inclinaison du corps entier, en radians, d'apres la distance parcourue.
  // Maximale a la sortie des blocs, nulle une fois la vitesse maximale
  // atteinte. La decroissance est en puissance 1,6 : le redressement est
  // rapide sur les premiers metres puis s'adoucit, comme chez un sprinteur.
  Runner.prototype.pitchAt = function () {
    const q = Math.min(1, Math.max(0, (this.d - this.legStart) / C.TRANS_END));
    return C.DRIVE_PITCH * Math.pow(1 - q, 1.6);
  };

  // Phase courante : 0 poussee, 1 transition, 2 vitesse maximale.
  Runner.prototype.phase = function () {
    const p = this.d - this.legStart;
    if (p < this.driveEnd) return 0;
    return p < C.TRANS_END ? 1 : 2;
  };

  // Note de transition : on compare la cadence de la premiere moitie de la
  // poussee a celle de la seconde. Un bon depart monte en frequence sans
  // a-coup ; trebucher annule la note.
  //
  // Deux precautions, chacune corrigeant un defaut mesure. On prend les
  // MEDIANES de chaque moitie, et non la moyenne de trois appuis : sur si peu
  // d'echantillons, l'imprecision du doigt pesait plus lourd que l'intention,
  // et la note basculait sur vingt millisecondes. Et la seconde moitie doit
  // atteindre une cadence reelle : autrement le moyen le plus sur d'obtenir la
  // note parfaite etait de trainer expres au depart, ce qui recompensait
  // exactement le contraire d'un bon demarrage.
  function mediane(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  /**
   * Note un passage de temoin et en applique les effets.
   *
   * `ecart` est le decalage entre les deux touches, en secondes, mesure sur
   * l'horloge commune de la salle — pas sur celle d'un telephone.
   *
   * Cette note ne juge que la SYNCHRONISATION. Le lieu du passage, lui, ne se
   * note pas : hors zone, l'equipe est eliminee, et la question du bareme ne
   * se pose plus.
   *
   * La vitesse de lancement acquise dans la zone n'est pas remplacee : elle
   * est conservee, entierement sur un bon passage, amputee sur un mauvais.
   * C'est le sens du geste — on ne redonne pas de la vitesse a celui qui rate,
   * on lui retire celle qu'il avait construite.
   */
  Runner.prototype.gradeHandoff = function (ecart) {
    const e = Math.abs(Number(ecart) || 0);
    const g = e <= C.RELAY_SYNC_PERFECT ? 2 : e <= C.RELAY_SYNC_GOOD ? 1 : 0;
    this.passGrade = g;
    this.passGap = e;
    this.v = Math.min(this.maxSpeed,
                      this.v * C.RELAY_PASS_KEEP[g] + C.RELAY_PASS_BOOST[g]);
    this.maxSpeed *= C.RELAY_PASS_VMAX[g];
    this.boostT = C.RELAY_EFFECT_TIME;
    this.boostDrag = C.RELAY_PASS_DRAG[g];
    if (C.RELAY_PASS_FREEZE[g] > 0) this.stumbleTimer = C.RELAY_PASS_FREEZE[g];
    return g;
  };

  Runner.prototype.gradeTransition = function () {
    const p = this.pressTimes;
    if (this.stumbledInDrive || p.length < C.TRANS_MIN_PRESS) {
      this.transGrade = 0; return;
    }
    const gap = [];
    for (let i = 1; i < p.length; i++) gap.push(p[i] - p[i - 1]);
    const moitie = Math.floor(gap.length / 2);
    const late = mediane(gap.slice(moitie));
    const ratio = late > 0.0001 ? mediane(gap.slice(0, moitie)) / late : 0;
    this.transRatio = ratio;
    // Une montee qui n'aboutit pas a une vraie cadence ne vaut rien : c'est
    // ce qui distingue un demarrage maitrise d'un depart simplement lent.
    const abouti = late <= C.TRANS_FLOOR;
    this.transGrade = !abouti ? 0
      : (ratio >= C.TRANS_PERFECT ? 2 : (ratio >= C.TRANS_GOOD ? 1 : 0));
    const g = this.transGrade;
    this.maxSpeed *= C.TRANS_VMAX[g];
    this.v = Math.min(this.maxSpeed, this.v + C.TRANS_BOOST[g]);
    this.boostT = C.TRANS_TIME[g];
    this.boostDrag = C.TRANS_DRAG[g];
  };

  Runner.prototype.press = function (key, elapsed) {
    if (this.finished || this.stumbleTimer > 0 || this.freeze > 0) return false;
    // premier appui : on mesure le temps de reaction et on en fait un gain
    if (this.reaction === null && elapsed !== undefined) {
      this.reaction = Math.max(0, elapsed);
      if (!this.jumped) {
        const w = C.REACT_WINDOW - C.REACT_BEST;
        this.reactBonus = C.REACT_BONUS *
          Math.min(1, Math.max(0, (C.REACT_WINDOW - this.reaction) / w));
        this.v += this.reactBonus;
      }
    }
    if (elapsed !== undefined && this.d - this.legStart < this.driveEnd)
      this.pressTimes.push(elapsed);
    let stumbled = false;
    if (this.lastKey === key) {
      const risk = (C.STUMBLE_BASE +
        C.STUMBLE_SPEED * Math.min(1, this.v / this.maxSpeed)) *
        C.STUMBLE_INPUT_SCALE;
      if (Math.random() < risk) {
        this.v *= C.STUMBLE_KEEP;
        this.stumbleTimer = C.STUMBLE_TIME;
        this.fallAnim = 1;
        if (this.d - this.legStart < this.driveEnd) this.stumbledInDrive = true;
        stumbled = true;
      } else {
        this.v = Math.min(this.maxSpeed, this.v + C.BOOST * 0.3);
      }
    } else {
      this.v = Math.min(this.maxSpeed, this.v + C.BOOST);
    }
    this.lastKey = key;
    return stumbled;
  };

  Runner.prototype.stepPlayer = function (dt, elapsed) {
    if (this.fallAnim > 0) {
      this.fallAnim = Math.max(0, this.fallAnim - dt / C.FALL_TIME);
    }
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt);
    if (this.finished) {
      this.v *= Math.exp(-1.15 * dt);
      this.d += this.v * dt;
      this.stride += this.v * dt * (Math.PI / this.strideLength());
      this.drivePitch = 0;
      return;
    }
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      this.v *= Math.exp(-6 * dt);
    } else {
      // le freinage est allege quelques secondes apres une bonne transition
      const drag = C.DRAG * (this.boostT > 0 ? this.boostDrag : 1);
      this.v *= Math.exp(-drag * dt);
    }
    const before = this.d;
    this.d += this.v * dt;
    this.stride += this.v * dt * (Math.PI / this.strideLength());
    this.drivePitch = this.pitchAt();
    const fin = this.legStart + this.driveEnd;
    if (this.transGrade === null && before < fin && this.d >= fin) {
      this.gradeTransition();
    }
    if (this.d >= this.total) {
      this.finished = true;
      // Le chrono affiche doit toujours etre le temps reellement couru : le
      // plancher a `this.best` cachait les performances qui le battaient
      // (rendait par exemple un 37 s affiche comme 40,50 s sur le 400 m).
      this.finishTime = elapsed;
    }
  };

  Runner.prototype.stepAI = function (dt, elapsed) {
    this.drivePitch = this.finished ? 0 : this.pitchAt();
    if (this.finished) {
      this.v *= Math.exp(-1.05 * dt);
      this.d += this.v * dt;
      this.stride += this.v * dt * (Math.PI / this.strideLength());
      return;
    }
    if (elapsed >= this.target) {
      this.d = this.total;
      this.v = this.vmax * (1 - Math.exp(-this.target / this.tau));
      this.finished = true;
      this.finishTime = this.target;
      return;
    }
    const t = elapsed;
    let d = this.vmax * (t - this.tau * (1 - Math.exp(-t / this.tau)));
    d = Math.max(0, Math.min(this.total, d));
    if (dt > 0) this.v = Math.max(0, (d - this.d) / dt);
    this.d = Math.max(this.d, d);
    this.stride += this.v * dt * (Math.PI / this.strideLength());
  };

  Runner.prototype.tookStep = function () {
    const s = Math.floor(this.stride / Math.PI);
    if (s !== this.lastStep) { this.lastStep = s; return true; }
    return false;
  };

  // Forme de la chute, a partir de fallAnim (1 au faux pas -> 0 a la fin).
  // L'ancienne version basculait le corps d'un coup a 1,25 rad puis le
  // redressait lineairement : ca partait raide et ca se terminait mou.
  // Ici tout passe par une enveloppe qui part de zero, culmine, puis
  // retombe, avec des oscillations amorties par dessus : le coureur pique
  // du nez, part de travers, mouline des bras et se retablit en titubant.
  function fallShape(fallAnim) {
    if (!fallAnim || fallAnim <= 0) return null;
    const p = 1 - Math.max(0, Math.min(1, fallAnim));   // 0 -> 1
    // montee rapide (p^0.45), retour plus lent : le desequilibre est
    // brutal, le retablissement laborieux — c'est ce qui fait le comique.
    const env = Math.sin(Math.PI * Math.pow(p, 0.45));
    const damp = 1 - p;                                  // oscillations qui s'eteignent
    return {
      // piqué du nez + rebonds de redressement
      pitch: env * (0.92 + 0.34 * Math.sin(p * Math.PI * 4.6) * damp),
      // deport lateral : on titube d'un cote puis de l'autre
      roll: env * 0.46 * Math.sin(p * Math.PI * 2.4),
      // moulinets de bras, a fond au plus fort du desequilibre
      flail: env
    };
  }

  // ---------------------------------------------------------------------
  // SQUELETTE
  // ---------------------------------------------------------------------
  // Chaque element : [couleur, pivot, angle, decalage, dimensions, lacet]
  // dimensions = [demi-x bas, demi-y bas, demi-x haut, demi-y haut, demi-h]
  function pose(r) {
    const L = r.look, fem = L.build === 'f';
    const p = r.stride;
    const sp = Math.max(0, Math.min(1, r.v / (r.maxSpeed || 12)));
    const P = gaitOf(L);
    const A = 0.34 + 0.66 * sp;
    const lean = -(0.05 + 0.16 * sp) * P.lean;
    const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a),
                              x * Math.sin(a) + z * Math.cos(a)];

    // Foulee plus marquee (genou plus haut, bras plus amples, buste plus
    // vivant). Le meme facteur s'applique a toute la chaine (cuisse ET
    // mollet, bras ET avant-bras) : amplifier seulement le premier
    // segment sans le second cassait l'effet d'entrainement naturel d'un
    // membre (le bout semblait trainer derriere le haut), ce qui donnait
    // une impression de mouvement disloque plutot que coordonne.
    const LIMB_BOOST = P.boost;
    function leg(q) {
      const th = gait(P.thigh, q) * A * LIMB_BOOST;
      const kn = gait(P.knee, q) * (0.42 + 0.58 * A) * LIMB_BOOST;
      const an = gait(P.ankle, q) * (0.50 + 0.50 * A) * LIMB_BOOST;
      return [th, th + kn, th + kn + an];
    }
    function arm(q) {
      const ua = gait(P.arm, q) * (0.55 + 0.45 * A) * LIMB_BOOST * P.armAmp;
      const ef = gait(P.elbow, q) * (0.62 + 0.38 * A) * LIMB_BOOST;
      return [ua, ua + ef];
    }

    // cote +1 : jambe en phase p, donc bras cale en opposition sur cette
    // meme phase ; cote -1 : tout est decale d'un demi-cycle.
    const AP = armPhaseOf(P);
    const l = leg(p), rr = leg(p + Math.PI);
    let al = arm(p + AP), ar = arm(p + Math.PI + AP);
    const cel = r.celebrate || 0;
    if (cel > 0) {
      const ul = 2.55 + 0.22 * Math.sin(p * 0.8);
      const ur = 2.55 + 0.22 * Math.sin(p * 0.8 + 1.1);
      al = [al[0] * (1 - cel) + ul * cel, al[1] * (1 - cel) + (ul + 0.3) * cel];
      ar = [ar[0] * (1 - cel) + ur * cel, ar[1] * (1 - cel) + (ur + 0.3) * cel];
    }
    // Moulinets de bras pendant la chute : les deux bras tournent en
    // opposition, bien plus vite que la foulee, comme quelqu'un qui essaie
    // de rattraper son equilibre.
    const fsh = fallShape(r.fallAnim);
    if (fsh && fsh.flail > 0.01) {
      const f = fsh.flail, w = (1 - r.fallAnim) * Math.PI * 5.4;
      const wl = 1.9 + 1.5 * Math.sin(w);
      const wr = 1.9 + 1.5 * Math.sin(w + 2.4);
      al = [al[0] * (1 - f) + wl * f, al[1] * (1 - f) + (wl + 0.55) * f];
      ar = [ar[0] * (1 - f) + wr * f, ar[1] * (1 - f) + (wr + 0.55) * f];
    }

    const bob = -0.036 * A * Math.cos(2 * (p - 0.75)) * P.bob;
    const yawHip = -0.16 * A * Math.sin(p);
    const yawTop = 0.21 * A * Math.sin(p);
    const sway = 0.016 * A * Math.sin(p);

    // Gabarit plus athletique qu'un mannequin filiforme : torse et epaules
    // elargis, cuisses epaisses qui s'affinent vers le mollet, bras avec
    // un vrai galbe biceps/avant-bras. Seules les largeurs changent, pas
    // les longueurs de segment (deja calees sur la taille du personnage).
    // Gabarit de base selon le sexe, puis retouches par athlete : epaules,
    // bassin, bras et cuisses se reglent independamment pour que chaque
    // silhouette soit reconnaissable de loin, avant meme la gestuelle.
    const MO = L.morph || EMPTY_MORPH;
    const shY = (fem ? 0.130 : 0.154) * (MO.sh || 1);
    const hipY = (fem ? 0.094 : 0.082) * (MO.hip || 1);
    const armR = (fem ? 0.052 : 0.060) * (MO.arm || 1);
    const legR = (fem ? 0.082 : 0.090) * (MO.leg || 1);
    const hip = [0, sway, 0.87 + bob];
    const out = [];
    const add = (c, pv, a, o, hb, ht, hz, yaw) =>
      out.push([c, pv, a, o, [hb[0], hb[1], ht[0], ht[1], hz], yaw || 0]);

    add(L.shorts, hip, 0, [0, 0, 0], [0.122, hipY + 0.045],
        [0.112, hipY + 0.032], 0.098, yawHip);
    // taille marquee : plus etroite juste au-dessus du short qu'au niveau
    // des cotes, pour rompre le profil "tube" entre bassin et buste.
    add(L.jersey, hip, lean, [0, 0, 0.170], [0.084, shY * 0.78],
        [0.113, shY * 1.05], 0.086, yawTop);
    add(L.jersey, hip, lean, [0, 0, 0.352], [0.118, shY * 1.15],
        [0.129, shY * 1.30], 0.128, yawTop);
    add([242, 242, 238], hip, lean, [0.086, 0, 0.352], [0.010, shY * 0.46],
        [0.010, shY * 0.50], 0.060, yawTop);
    // bande de couleur sur le maillot et le short, assortie aux chaussures :
    // un vrai kit d'athletisme plutot qu'un aplat uniforme.
    add(L.shoe, hip, lean, [0.078, 0, 0.28], [0.015, 0.015],
        [0.017, 0.017], 0.19, yawTop);
    add(L.shoe, hip, 0, [0.09, 0, 0], [0.014, 0.014],
        [0.014, 0.014], 0.09, yawHip);

    for (const side of [1, -1]) {
      add(L.skin, hip, lean, [0, side * shY, 0.462], [0.073, 0.057],
          [0.065, 0.049], 0.050, yawTop);
    }
    add(L.skin, hip, lean, [0, 0, 0.552], [0.042, 0.048], [0.040, 0.046],
        0.042, yawTop * 0.5);
    add(L.skin, hip, lean, [0.006, 0, 0.672 - bob * 0.55], [0.084, 0.081],
        [0.088, 0.086], 0.086, yawTop * 0.2);

    const hy = yawTop * 0.2, hc = L.hairCol;
    switch (L.hair) {
      case 'shaved':
        add(hc, hip, lean, [-0.004, 0, 0.744], [0.076, 0.075], [0.070, 0.069],
            0.016, hy); break;
      case 'flattop':
        add(hc, hip, lean, [-0.004, 0, 0.772], [0.074, 0.074], [0.072, 0.072],
            0.048, hy); break;
      case 'fade':
        add(hc, hip, lean, [-0.006, 0, 0.752], [0.077, 0.077], [0.070, 0.070],
            0.030, hy);
        add(hc, hip, lean, [-0.058, 0, 0.690], [0.020, 0.070], [0.022, 0.072],
            0.046, hy); break;
      case 'bun':
        add(hc, hip, lean, [-0.006, 0, 0.756], [0.078, 0.078], [0.072, 0.072],
            0.034, hy);
        add(hc, hip, lean, [-0.084, 0, 0.742], [0.040, 0.044], [0.044, 0.048],
            0.044, hy); break;
      case 'ponytail':
        add(hc, hip, lean, [-0.006, 0, 0.754], [0.078, 0.078], [0.072, 0.072],
            0.032, hy);
        add(hc, hip, lean + 0.22 * Math.sin(p) * A, [-0.104, 0, 0.674],
            [0.058, 0.032], [0.036, 0.022], 0.028, hy); break;
      case 'braids':
        add(hc, hip, lean, [-0.006, 0, 0.756], [0.078, 0.078], [0.072, 0.072],
            0.034, hy);
        for (const dy of [-0.044, 0, 0.044]) {
          add(hc, hip, lean + 0.18 * Math.sin(p) * A, [-0.092, dy, 0.662],
              [0.046, 0.015], [0.030, 0.012], 0.018, hy);
        }
        break;
      default:
        add(hc, hip, lean, [-0.004, 0, 0.750], [0.077, 0.076], [0.072, 0.071],
            0.026, hy);
    }

    const sh = rot(0, 0.470, lean);
    for (const [side, aArm, aFore] of [[1, al[0], al[1]], [-1, ar[0], ar[1]]]) {
      const S = [hip[0] + sh[0], side * shY, hip[2] + sh[1]];
      // biceps galbe : le bras se scinde en deux tronçons au lieu d'un
      // seul cone, plus large au milieu qu'a l'epaule ou au coude.
      add(L.skin, S, aArm, [0, 0, -0.05], [armR + 0.014, armR + 0.014],
          [armR + 0.004, armR + 0.008], 0.05, yawTop);
      add(L.skin, S, aArm, [0, 0, -0.175], [armR - 0.010, armR - 0.008],
          [armR + 0.014, armR + 0.014], 0.075, yawTop);
      const e = rot(0, -0.250, aArm);
      const E = [S[0] + e[0], S[1], S[2] + e[1]];
      add(L.skin, E, aFore, [0, 0, -0.112], [armR - 0.012, armR - 0.010],
          [armR - 0.004, armR - 0.001], 0.112, yawTop);
      add(L.skin, E, aFore, [0.006, 0, -0.238], [armR - 0.006, armR - 0.004],
          [armR - 0.010, armR - 0.008], 0.036, yawTop);
    }

    for (const [side, th, sk, ft] of [[1, l[0], l[1], l[2]],
                                      [-1, rr[0], rr[1], rr[2]]]) {
      const H = [hip[0], side * hipY, hip[2] - 0.02];
      // quadriceps galbe : meme principe que le bras, la cuisse gonfle
      // vers son tiers superieur puis s'affine jusqu'au genou.
      add(L.skin, H, th, [0, 0, -0.075], [legR + 0.026, legR + 0.026],
          [legR + 0.008, legR + 0.012], 0.075, yawHip);
      add(L.skin, H, th, [0, 0, -0.265], [legR - 0.024, legR - 0.020],
          [legR + 0.026, legR + 0.026], 0.115, yawHip);
      const k = rot(0, -0.392, th);
      const K = [H[0] + k[0], H[1], H[2] + k[1]];
      add(L.skin, K, sk, [-0.008, 0, -0.098], [legR - 0.020, legR - 0.014],
          [legR - 0.004, legR + 0.002], 0.100, yawHip);
      add(L.skin, K, sk, [0, 0, -0.288], [legR - 0.034, legR - 0.030],
          [legR - 0.022, legR - 0.018], 0.092, yawHip);
      const a = rot(0, -0.380, sk);
      const An = [K[0] + a[0], K[1], K[2] + a[1]];
      // semelle claire, legerement plus large : elle deborde sous la
      // couleur de la chaussure pour suggerer une vraie basket bicolore.
      add([236, 236, 232], An, ft, [0.036, 0, -0.030], [0.098, 0.046],
          [0.080, 0.052], 0.028, yawHip);
      add(L.shoe, An, ft, [0.036, 0, -0.030], [0.086, 0.040], [0.070, 0.046],
          0.028, yawHip);
    }
    return out;
  }

  const CUBE = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const FACES = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]],
                 [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]],
                 [[0, 1, 5, 4], [0, -1, 0]], [[3, 7, 6, 2], [0, 1, 0]]];
  const LIGHT = (function () {
    const v = [-0.42, 0.28, 0.86];
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  })();

  root.SprinterCore = {
    TAU, C, RACES, LEVELS, GAIT, GAITS, gaitOf, gait, catmull, Track, Runner,
    pose, fallShape,
    ZEZE, PLAYER_LOOK, lookFor, look, CUBE, FACES, LIGHT, SKIN, SKIN_POOL
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
