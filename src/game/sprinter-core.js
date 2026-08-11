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
    // --- rythme : le moteur d'acceleration ------------------------------
    // Remplace l'ancienne "transition", notee une seule fois en sortie de
    // blocs sur un critere invisible. Ici tout est continu et lisible :
    // chaque appui est evalue au moment ou il tombe, et deux leviers
    // independants pilotent la vitesse.
    //   - la CADENCE (combien d'appuis par seconde) : le levier evident,
    //     accessible des la premiere partie ;
    //   - le RYTHME (la regularite de ces appuis) : le levier de maitrise,
    //     qui rend chaque appui plus efficace et releve la vitesse de pointe.
    // Un joueur qui tape vite mais anarchiquement plafonne ; un joueur qui
    // tape vite ET regulier va nettement plus vite. Aucun jugement cache :
    // la jauge de rythme du HUD montre l'etat en direct.
    RHY_TOL: 0.34,        // ecart relatif tolere d'un appui a l'autre
    RHY_RISE: 0.30,       // vitesse de montee du rythme, par appui
    RHY_DECAY: 0.30,      // perte de rythme par seconde sans appui
    RHY_START: 0.60,      // rythme initial : la mise en action n'est pas punie
    RHY_STUMBLE: 0.45,    // fraction de rythme conservee apres une trebuche
    // Plancher volontairement haut : un joueur irregulier reste jouable
    // (il progresse quand meme), il est simplement nettement moins rapide
    // qu'un joueur regulier. A cadence egale, le rythme vaut ~2,5 a 3,8 s
    // sur 400 m — assez pour compter, pas assez pour bloquer un debutant.
    RHY_GAIN: [0.94, 1.24],  // multiplicateur d'impulsion (pire -> meilleur)
    RHY_VMAX: [0.95, 1.05],  // multiplicateur de vitesse de pointe

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
      arc: 0, straight: 100, maxSpeed: 12.073, best: 9.10,
      ranges: [[12.50, 15.00], [11.20, 12.50], [10.00, 10.50],
               [9.58, 10.00], [9.58, 9.85], [9.11, 9.58]]
    },
    '200': {
      key: '200', label: '200 METRES', sub: 'virage et ligne droite',
      arc: 115.61, straight: 84.39, maxSpeed: 11.671, best: 18.20,
      ranges: [[25.00, 30.00], [22.40, 25.00], [20.00, 21.00],
               [19.16, 20.00], [19.16, 19.70], [18.22, 19.16]]
    },
    '400': {
      key: '400', label: '400 METRES', sub: 'un tour de piste', fullLap: true,
      arc: 115.61, straight: 84.39, maxSpeed: 11.20, best: 36.90,
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
  const ARM_PHASE = (function () {
    function peakAt(table, sign) {
      let best = -Infinity, at = 0;
      for (let i = 0; i < 720; i++) {
        const q = TAU * i / 720, v = sign * gait(table, q);
        if (v > best) { best = v; at = q; }
      }
      return at;
    }
    const thighForward = peakAt(GAIT.thigh, 1);
    const armBackward = peakAt(GAIT.arm, -1);
    return ((armBackward - thighForward) % TAU + TAU) % TAU;
  })();

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
      h: Math.max(C.MIN_H, Math.min(C.MAX_H, o.h || 1.80))
    };
  }

  // Meme regle que le reste du plateau "sprint" a partir du mondial :
  // que des carnations noires (ebene) pour la finale ZEZE.
  const ZEZE = {
    'Benbezi ZEZE': look({ build: 'm', skin: 'ebene', jersey: [214, 48, 62],
      shorts: [26, 26, 40], hair: 'fade', h: 1.96 }),
    'Ryan ZEZE': look({ build: 'm', skin: 'ebene', jersey: [48, 132, 232],
      shorts: [24, 30, 52], shoe: [250, 224, 70], hair: 'crop', h: 1.78 }),
    'Mickeal ZEZE': look({ build: 'm', skin: 'ebene', jersey: [44, 190, 128],
      shorts: [22, 34, 32], shoe: [246, 126, 46], hair: 'flattop', h: 1.85 }),
    'Herman ZEZE': look({ build: 'm', skin: 'ebene', jersey: [246, 150, 40],
      shorts: [34, 26, 22], shoe: [126, 226, 250], hair: 'shaved', h: 2.00 }),
    'Greta ZEZE': look({ build: 'f', skin: 'ebene', jersey: [162, 92, 232],
      shorts: [28, 22, 44], hair: 'bun', h: 1.70 }),
    'Ervie ZEZE': look({ build: 'f', skin: 'ebene', jersey: [36, 198, 196],
      shorts: [20, 34, 36], shoe: [250, 224, 70], hair: 'braids', h: 1.75 }),
    'Victoire ZEZE': look({ build: 'f', skin: 'ebene', jersey: [236, 96, 178],
      shorts: [36, 22, 36], shoe: [246, 126, 46], hair: 'ponytail', h: 1.63 })
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
    this.freeze = 0;
    // rythme : 0 = appuis anarchiques, 1 = cadence parfaitement reguliere
    this.rhythm = C.RHY_START;
    this.gapAvg = 0; this.lastPressT = null;
    this.rhythmSum = 0; this.rhythmN = 0;  // moyenne, pour le bilan de course
    this.drivePitch = C.DRIVE_PITCH;
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
    return Math.max(0.85, 4 * leg * Math.sin(Math.min(1.15, 0.70 * amp)));
  };

  // Inclinaison du corps entier, en radians, d'apres la distance parcourue.
  // Maximale a la sortie des blocs, nulle une fois la vitesse maximale
  // atteinte. La decroissance est en puissance 1,6 : le redressement est
  // rapide sur les premiers metres puis s'adoucit, comme chez un sprinteur.
  Runner.prototype.pitchAt = function () {
    const q = Math.min(1, Math.max(0, this.d / C.TRANS_END));
    return C.DRIVE_PITCH * Math.pow(1 - q, 1.6);
  };

  // Phase courante : 0 poussee, 1 transition, 2 vitesse maximale.
  Runner.prototype.phase = function () {
    if (this.d < C.DRIVE_END) return 0;
    return this.d < C.TRANS_END ? 1 : 2;
  };

  // Vitesse de pointe accessible a l'instant present : elle depend du
  // rythme, donc elle monte quand le joueur est regulier et redescend quand
  // il part en vrille. C'est ce qui remplace le bonus fige de l'ancienne
  // transition.
  Runner.prototype.speedCap = function () {
    return this.maxSpeed * (C.RHY_VMAX[0] +
      (C.RHY_VMAX[1] - C.RHY_VMAX[0]) * this.rhythm);
  };

  // Rythme moyen tenu sur la course, pour l'affichage de fin.
  Runner.prototype.rhythmAvg = function () {
    return this.rhythmN ? this.rhythmSum / this.rhythmN : 0;
  };

  // Evalue la regularite de l'appui qui vient de tomber. On compare son
  // ecart au precedent a la moyenne lissee des ecarts : une cadence qui
  // monte progressivement (ce que fait naturellement un sprinteur) reste
  // donc consideree comme reguliere, seuls les a-coups font chuter le
  // rythme.
  Runner.prototype.feelRhythm = function (elapsed) {
    if (elapsed === undefined) return;
    if (this.lastPressT !== null) {
      const gap = elapsed - this.lastPressT;
      if (gap > 0.001) {
        const avg = this.gapAvg > 0 ? this.gapAvg : gap;
        const rel = Math.abs(gap - avg) / Math.max(gap, avg);
        const q = Math.max(0, Math.min(1, 1 - rel / C.RHY_TOL));
        this.rhythm += (q - this.rhythm) * C.RHY_RISE;
        this.gapAvg = avg + (gap - avg) * 0.34;
        this.rhythmSum += this.rhythm; this.rhythmN++;
      }
    }
    this.lastPressT = elapsed;
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
    this.feelRhythm(elapsed);
    // un appui bien place pousse plus fort qu'un appui a contretemps
    const eff = C.RHY_GAIN[0] + (C.RHY_GAIN[1] - C.RHY_GAIN[0]) * this.rhythm;
    const cap = this.speedCap();
    let stumbled = false;
    if (this.lastKey === key) {
      const risk = C.STUMBLE_BASE +
        C.STUMBLE_SPEED * Math.min(1, this.v / this.maxSpeed);
      if (Math.random() < risk) {
        this.v *= C.STUMBLE_KEEP;
        this.stumbleTimer = C.STUMBLE_TIME;
        this.fallAnim = 1;
        this.rhythm *= C.RHY_STUMBLE;
        stumbled = true;
      } else {
        this.v = Math.min(cap, this.v + C.BOOST * 0.3 * eff);
      }
    } else {
      this.v = Math.min(cap, this.v + C.BOOST * eff);
    }
    this.lastKey = key;
    return stumbled;
  };

  Runner.prototype.stepPlayer = function (dt, elapsed) {
    if (this.fallAnim > 0) {
      this.fallAnim = Math.max(0, this.fallAnim - dt / C.STUMBLE_TIME);
    }
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    // Le rythme se perd si on cesse d'appuyer : il se tient, il ne
    // s'acquiert pas une fois pour toutes.
    if (!this.finished) this.rhythm = Math.max(0, this.rhythm - C.RHY_DECAY * dt);
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
      this.v *= Math.exp(-C.DRAG * dt);
    }
    this.d += this.v * dt;
    this.stride += this.v * dt * (Math.PI / this.strideLength());
    this.drivePitch = this.pitchAt();
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

  // ---------------------------------------------------------------------
  // SQUELETTE
  // ---------------------------------------------------------------------
  // Chaque element : [couleur, pivot, angle, decalage, dimensions, lacet]
  // dimensions = [demi-x bas, demi-y bas, demi-x haut, demi-y haut, demi-h]
  function pose(r) {
    const L = r.look, fem = L.build === 'f';
    const p = r.stride;
    const sp = Math.max(0, Math.min(1, r.v / (r.maxSpeed || 12)));
    const A = 0.34 + 0.66 * sp;
    const lean = -(0.05 + 0.16 * sp);
    const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a),
                              x * Math.sin(a) + z * Math.cos(a)];

    // Foulee plus marquee (genou plus haut, bras plus amples, buste plus
    // vivant). Le meme facteur s'applique a toute la chaine (cuisse ET
    // mollet, bras ET avant-bras) : amplifier seulement le premier
    // segment sans le second cassait l'effet d'entrainement naturel d'un
    // membre (le bout semblait trainer derriere le haut), ce qui donnait
    // une impression de mouvement disloque plutot que coordonne.
    const LIMB_BOOST = 1.18;
    function leg(q) {
      const th = gait(GAIT.thigh, q) * A * LIMB_BOOST;
      const kn = gait(GAIT.knee, q) * (0.42 + 0.58 * A) * LIMB_BOOST;
      const an = gait(GAIT.ankle, q) * (0.50 + 0.50 * A) * LIMB_BOOST;
      return [th, th + kn, th + kn + an];
    }
    function arm(q) {
      const ua = gait(GAIT.arm, q) * (0.55 + 0.45 * A) * LIMB_BOOST;
      const ef = gait(GAIT.elbow, q) * (0.62 + 0.38 * A) * LIMB_BOOST;
      return [ua, ua + ef];
    }

    // cote +1 : jambe en phase p, donc bras cale en opposition sur cette
    // meme phase ; cote -1 : tout est decale d'un demi-cycle.
    const l = leg(p), rr = leg(p + Math.PI);
    let al = arm(p + ARM_PHASE), ar = arm(p + Math.PI + ARM_PHASE);
    const cel = r.celebrate || 0;
    if (cel > 0) {
      const ul = 2.55 + 0.22 * Math.sin(p * 0.8);
      const ur = 2.55 + 0.22 * Math.sin(p * 0.8 + 1.1);
      al = [al[0] * (1 - cel) + ul * cel, al[1] * (1 - cel) + (ul + 0.3) * cel];
      ar = [ar[0] * (1 - cel) + ur * cel, ar[1] * (1 - cel) + (ur + 0.3) * cel];
    }

    const bob = -0.036 * A * Math.cos(2 * (p - 0.75));
    const yawHip = -0.16 * A * Math.sin(p);
    const yawTop = 0.21 * A * Math.sin(p);
    const sway = 0.016 * A * Math.sin(p);

    // Gabarit plus athletique qu'un mannequin filiforme : torse et epaules
    // elargis, cuisses epaisses qui s'affinent vers le mollet, bras avec
    // un vrai galbe biceps/avant-bras. Seules les largeurs changent, pas
    // les longueurs de segment (deja calees sur la taille du personnage).
    const shY = fem ? 0.130 : 0.154;
    const hipY = fem ? 0.094 : 0.082;
    const armR = fem ? 0.052 : 0.060;
    const legR = fem ? 0.082 : 0.090;
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
    TAU, C, RACES, LEVELS, GAIT, gait, catmull, Track, Runner, pose,
    ZEZE, PLAYER_LOOK, lookFor, look, CUBE, FACES, LIGHT, SKIN, SKIN_POOL
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
