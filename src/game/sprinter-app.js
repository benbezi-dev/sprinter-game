/* -----------------------------------------------------------------------
   SPRINTER — couche navigateur : rendu, ecrans, tactile, son.
   ----------------------------------------------------------------------- */
(function () {
  'use strict';
  const K = globalThis.SprinterCore;
  const { TAU, C, RACES, LEVELS, Track, Runner, pose, ZEZE, PLAYER_LOOK,
          CUBE, FACES, LIGHT } = K;

  const THEMES = {
    day: {
      // Couleurs calees sur le decor du jeu de reference (bmp_field) :
      // ciel #4451a7, piste #8d0000, pelouse #1e6f00, quasiment plates.
      skyTop: [68, 81, 167], skyBot: [82, 95, 181], stars: 0,
      grass: [30, 111, 0], grassEdge: [20, 88, 0],
      trackA: [138, 10, 10], trackB: [122, 6, 8],
      lane: [246, 242, 234], kerb: [252, 252, 252],
      tread: [176, 178, 186], riser: [132, 136, 148], roof: [78, 82, 98],
      barrier: [232, 234, 238],
      panels: [[214, 74, 62], [44, 108, 186], [240, 196, 70], [60, 152, 118]],
      crowdLo: [44, 40, 54], crowdHi: [250, 242, 232],
      accent: [240, 158, 46], dust: [226, 190, 160]
    },
    cosmos: {
      skyTop: [11, 7, 26], skyBot: [58, 24, 92], stars: 220,
      grass: [24, 16, 44], grassEdge: [44, 28, 74],
      trackA: [98, 40, 134], trackB: [83, 31, 118],
      lane: [228, 204, 255], kerb: [234, 216, 250],
      tread: [58, 38, 88], riser: [40, 24, 64], roof: [26, 15, 44],
      barrier: [120, 84, 168],
      panels: [[196, 72, 190], [86, 92, 220], [52, 190, 196], [236, 158, 72]],
      crowdLo: [56, 44, 78], crowdHi: [214, 188, 244],
      accent: [232, 121, 216], dust: [216, 196, 236]
    },
    // Jeux olympiques : piste bleue, lignes blanches et liseret vert au
    // couloir interieur, comme la piste d'athletisme de Vallehermoso.
    olympic: {
      skyTop: [68, 81, 167], skyBot: [82, 95, 181], stars: 0,
      grass: [30, 111, 0], grassEdge: [20, 88, 0],
      trackA: [21, 70, 158], trackB: [16, 56, 132],
      lane: [255, 255, 255], kerb: [56, 196, 92],
      tread: [176, 178, 186], riser: [132, 136, 148], roof: [78, 82, 98],
      barrier: [232, 234, 238],
      panels: [[56, 196, 92], [255, 255, 255], [240, 196, 70], [214, 74, 62]],
      crowdLo: [44, 40, 54], crowdHi: [250, 242, 232],
      accent: [56, 196, 92], dust: [210, 222, 236]
    }
  };

  // Public dans les gradins : des personnages a facettes cuits dans une
  // tuile (voir getCrowdPattern), et non plus des sprites plats. Le
  // remplissage croit avec l'importance de l'etape — une competition
  // scolaire n'attire pas la meme foule qu'une finale intergalactique.
  const CROWD_BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');
  const CROWD_DENSITY = [0.25, 0.40, 0.60, 0.80, 0.95, 1.00];
  const FLAG_IMG = new Image();
  FLAG_IMG.src = CROWD_BASE + '/icons/flag-checkered.png';

  const GOLD = 'rgb(248,205,74)', CREAM = 'rgb(238,240,248)';
  const MUTED = 'rgb(140,146,182)', CYAN = 'rgb(104,216,236)';
  const GREEN = 'rgb(108,226,138)', RED = 'rgb(250,106,106)';
  const MAGENTA = 'rgb(232,121,216)';
  const rgb = (c, f) => 'rgb(' + Math.min(255, c[0] * (f || 1) | 0) + ',' +
    Math.min(255, c[1] * (f || 1) | 0) + ',' + Math.min(255, c[2] * (f || 1) | 0) + ')';
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t),
                            lerp(a[2], b[2], t)];

  // -------------------------------------------------------------------
  // TEXTES : ils vivent tous dans sprinter-i18n.js, en francais et en
  // anglais. On ne garde ici que les raccourcis.
  // -------------------------------------------------------------------
  const N = globalThis.SprinterI18N;
  const t = (k, v) => N.t(k, v);
  const CUT_INTRO = N.CUT_INTRO, CUT_DEFEAT = N.CUT_DEFEAT;
  const CUT_CHAMPION = N.CUT_CHAMPION, CUT_TAUNT = N.CUT_TAUNT;
  // chaque variante est un couple [francais, anglais]
  const pickLang = a => a[Math.floor(Math.random() * a.length)][N.index()];

  // -------------------------------------------------------------------
  // SON
  // -------------------------------------------------------------------
  const Audio_ = {
    ok: false, on: true, ctx: null, buf: {}, src: null, cur: null, gain: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.34;
        this.gain.connect(this.ctx.destination);
        this.build();
        this.ok = true;
      } catch (e) { this.ok = false; }
    },
    tone(d, t0, dur, f, amp, wave, decay) {
      const sr = d.sampleRate, ch = d.getChannelData(0);
      const i0 = (t0 * sr) | 0, n = (dur * sr) | 0;
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const k = i0 + i; if (k >= ch.length) break;
        ph += f / sr; const p = ph - (ph | 0);
        let s;
        if (wave === 'sq') s = p < 0.5 ? 1 : -1;
        else if (wave === 'saw') s = 2 * p - 1;
        else if (wave === 'tri') s = 4 * Math.abs(p - 0.5) - 1;
        else if (wave === 'pulse') s = p < 0.25 ? 1 : -1;
        else s = Math.sin(TAU * p);
        let env = Math.exp(-decay * i / sr);
        if (i < 120) env *= i / 120;
        ch[k] += amp * env * s;
      }
    },
    drum(d, t0, kind) {
      const sr = d.sampleRate, ch = d.getChannelData(0);
      const i0 = (t0 * sr) | 0;
      const n = ((kind === 'k' ? 0.16 : kind === 's' ? 0.13 : 0.05) * sr) | 0;
      let ph = 0, seed = 12345;
      for (let i = 0; i < n; i++) {
        const k = i0 + i; if (k >= ch.length) break;
        const q = i / n;
        seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff;
        const nz = seed / 0x3fffffff - 1;
        if (kind === 'k') {
          ph += (118 * Math.exp(-5.2 * q) + 42) / sr;
          ch[k] += 0.9 * Math.exp(-7 * q) * Math.sin(TAU * ph);
        } else if (kind === 's') {
          ph += 190 / sr;
          ch[k] += 0.42 * Math.exp(-13 * q) * (0.72 * nz + 0.28 * Math.sin(TAU * ph));
        } else {
          ch[k] += 0.15 * Math.exp(-42 * i / sr) * nz;
        }
      }
    },
    norm(d) {
      const ch = d.getChannelData(0);
      let pk = 0;
      for (let i = 0; i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i]));
      const g = pk > 0.001 ? 0.86 / pk : 1;
      const fade = (0.006 * d.sampleRate) | 0;
      for (let i = 0; i < ch.length; i++) {
        let v = ch[i] * g;
        if (v > 1) v = 1; else if (v < -1) v = -1;
        if (i < fade) v *= i / fade;
        else if (i > ch.length - fade) v *= (ch.length - i) / fade;
        ch[i] = v;
      }
      return d;
    },
    note(name, oct) {
      const N = { A: 0, B: 2, C: 3, D: 5, E: 7, F: 8, G: 10 };
      return 55 * Math.pow(2, oct - 1) * Math.pow(2, N[name] / 12);
    },
    // frequence a partir d'un ecart en demi-tons depuis le la de l'octave
    semi(s, oct) { return 55 * Math.pow(2, (oct || 2) - 1) * Math.pow(2, s / 12); },

    // Une seule fabrique pour les quatre musiques de course. La tension
    // monte par le tempo, l'harmonie (mineur simple -> dominante -> napolitain
    // -> accords diminues chromatiques), la densite rythmique et un bourdon
    // grave qui n'apparait qu'a partir du championnat du monde.
    buildRace(cfg) {
      const sr = this.ctx.sampleRate;
      const beat = 60 / cfg.bpm, bar = beat * 4, tot = bar * 4;
      const d = this.ctx.createBuffer(1, (tot * sr) | 0, sr);
      const F = (s, o) => this.semi(s, o);
      cfg.prog.forEach((ch, b) => {
        const t = b * bar, root = ch[0], tri = ch[1];
        // grosse caisse et caisse claire
        cfg.kick.forEach(x => this.drum(d, t + x * beat, 'k'));
        cfg.snare.forEach(x => this.drum(d, t + x * beat, 's'));
        for (let i = 0; i < cfg.hats; i++)
          this.drum(d, t + i * beat * 4 / cfg.hats, 'h');
        // basse
        const div = cfg.bassDiv, bl = beat * 4 / div;
        for (let i = 0; i < div; i++) {
          const sm = cfg.bassPat[i % cfg.bassPat.length];
          this.tone(d, t + i * bl, bl * 0.92, F(root + sm, 2),
                    cfg.bassAmp, 'saw', 5);
        }
        // nappe d'accord
        tri.forEach(n => this.tone(d, t, bar * 0.94, F(root + n, 3),
                                   cfg.padAmp, 'tri', 1.1));
        // bourdon grave, seulement quand la tension monte
        if (cfg.drone > 0) {
          this.tone(d, t, bar * 0.99, F(cfg.droneSemi, 1), cfg.drone, 'sin', 0.22);
          this.tone(d, t, bar * 0.99, F(cfg.droneSemi + 0.14, 1), cfg.drone * 0.7,
                    'sin', 0.22);   // battement lent, effet d'oppression
        }
        // arpege aigu
        const n2 = cfg.arp;
        for (let i = 0; i < n2; i++)
          this.tone(d, t + i * bar / n2, bar / n2 * 0.55,
                    F(root + tri[i % tri.length], 5), cfg.arpAmp, 'pulse', 9);
        // coups de tension : quinte diminuee sur le dernier temps
        if (cfg.stab)
          this.tone(d, t + beat * 3.5, beat * 0.45, F(root + 6, 4),
                    cfg.stab, 'saw', 7);
      });
      return this.norm(d);
    },

    build() {
      const sr = this.ctx.sampleRate;
      const prog = [['A', 2, ['A', 'C', 'E']], ['F', 2, ['F', 'A', 'C']],
                    ['C', 2, ['C', 'E', 'G']], ['G', 2, ['G', 'B', 'D']]];

      // --- les quatre paliers de course -------------------------------
      const MIN = [0, 3, 7], MAJ = [0, 4, 7], AUG = [0, 4, 8], DIM = [0, 3, 6];
      this.buf.race0 = this.buildRace({          // etapes 1 a 3 : entrainant
        bpm: 124, prog: [[0, MIN], [-4, MAJ], [3, MAJ], [-2, MAJ]],
        kick: [0, 1.5, 2, 3.5], snare: [1, 3], hats: 8,
        bassDiv: 8, bassPat: [0, 0, 12, 0, 7, 0, 12, 3], bassAmp: 0.40,
        padAmp: 0.075, arp: 8, arpAmp: 0.10, drone: 0, droneSemi: 0, stab: 0
      });
      this.buf.race1 = this.buildRace({          // championnat du monde
        bpm: 132, prog: [[0, MIN], [-4, MAJ], [5, MIN], [7, MAJ]],
        kick: [0, 1.5, 2, 2.75, 3.5], snare: [1, 3], hats: 12,
        bassDiv: 8, bassPat: [0, 0, 7, 0, 12, 0, 7, -1], bassAmp: 0.44,
        padAmp: 0.085, arp: 8, arpAmp: 0.11, drone: 0.10, droneSemi: 0, stab: 0
      });
      this.buf.race2 = this.buildRace({          // jeux olympiques
        bpm: 140, prog: [[0, MIN], [1, MAJ], [-4, MAJ], [7, AUG]],
        kick: [0, 1, 1.5, 2, 3, 3.5], snare: [1, 3, 3.75], hats: 16,
        bassDiv: 16, bassPat: [0, 0, 0, 12, 0, 0, 7, 0, 0, 0, 12, 0, 1, 0, 7, 0],
        bassAmp: 0.48, padAmp: 0.095, arp: 12, arpAmp: 0.12,
        drone: 0.15, droneSemi: 0, stab: 0.14
      });
      this.buf.race3 = this.buildRace({          // inter galactique
        bpm: 150, prog: [[0, DIM], [-1, DIM], [-2, DIM], [-3, AUG]],
        kick: [0, 0.75, 1.5, 2, 2.75, 3.5], snare: [1, 2.5, 3, 3.75], hats: 16,
        bassDiv: 16,
        bassPat: [0, 0, 6, 0, 0, 0, 6, 0, 12, 0, 6, 0, 0, 6, 0, 6],
        bassAmp: 0.52, padAmp: 0.10, arp: 16, arpAmp: 0.13,
        drone: 0.20, droneSemi: -5, stab: 0.20
      });
      this.buf.race = this.buf.race0;

      // accueil
      let beat, bar, tot, d;
      beat = 60 / 92; bar = beat * 4; tot = bar * 4;
      d = this.ctx.createBuffer(1, (tot * sr) | 0, sr);
      prog.forEach((ch, b) => {
        const t = b * bar;
        this.drum(d, t, 'k'); this.drum(d, t + beat * 2, 'k');
        this.tone(d, t, bar * 0.96, this.note(ch[0], ch[1]), 0.26, 'tri', 1.4);
        ch[2].forEach(n => this.tone(d, t, bar * 0.96, this.note(n, 4),
                                     0.085, 'sin', 1.0));
        this.tone(d, t + beat * 2, beat * 0.8, this.note(ch[2][2], 5), 0.09,
                  'sin', 2.4);
      });
      this.buf.menu = this.norm(d);
      // bruitages
      const blip = (f, dur, amp, glide) => {
        const b = this.ctx.createBuffer(1, (dur * sr) | 0, sr);
        const ch = b.getChannelData(0); let ph = 0;
        for (let i = 0; i < ch.length; i++) {
          const q = i / ch.length;
          ph += f * (1 + (glide - 1) * q) / sr;
          ch[i] = amp * Math.exp(-6 * q) * Math.min(1, i / 90) * Math.sin(TAU * ph);
        }
        return this.norm(b);
      };
      this.buf.beep = blip(660, 0.16, 0.3, 1);
      this.buf.go = blip(1050, 0.34, 0.34, 1.3);
      this.buf.trip = blip(160, 0.22, 0.32, 0.55);
      this.buf.win = blip(760, 0.6, 0.3, 1.6);
      this.buf.lose = blip(300, 0.5, 0.3, 0.6);
      // Deux phrases pour les fins de duel. Un blip de 0,5 s ne porte pas un
      // resultat definitif : la fanfare monte a l'octave, la chute descend.
      this.buf.fanfare = this.phrase([
        [0, 0.00, 0.16], [4, 0.15, 0.16], [7, 0.30, 0.16],
        [12, 0.45, 0.22], [7, 0.68, 0.14], [12, 0.83, 0.85],
      ], 3);
      this.buf.dirge = this.phrase([
        [0, 0.00, 0.34], [-1, 0.34, 0.34], [-4, 0.68, 0.40],
        [-9, 1.10, 1.10],
      ], 2, 'tri');
    },
    // Une phrase jouee une seule fois : [demi-tons, depart, duree].
    phrase(notes, oct, wave) {
      const sr = this.ctx.sampleRate;
      const fin = notes.reduce((m, n) => Math.max(m, n[1] + n[2]), 0);
      const d = this.ctx.createBuffer(1, ((fin + 0.3) * sr) | 0, sr);
      notes.forEach(n => {
        this.tone(d, n[1], n[2], this.semi(n[0], oct), 0.34, wave || 'tri', 2.0);
        this.tone(d, n[1], n[2], this.semi(n[0], oct + 1), 0.15, 'sin', 2.4);
        this.tone(d, n[1], n[2], this.semi(n[0], oct - 1), 0.18, 'sq', 3.0);
      });
      return this.norm(d);
    },
    // La musique de course se durcit a partir du championnat du monde.
    raceTrack(level) {
      return 'race' + (level <= 2 ? 0 : level - 2);
    },
    music(name) {
      if (!this.ok || !this.on || this.cur === name) return;
      if (this.src) { try { this.src.stop(); } catch (e) { } }
      const b = this.buf[name]; if (!b) return;
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.loop = true; s.connect(this.gain); s.start();
      this.src = s; this.cur = name;
    },
    stop() {
      if (this.src) { try { this.src.stop(); } catch (e) { } }
      this.src = null; this.cur = null;
    },
    // Annonce de fin : la boucle de fond s'arrete, la phrase reste seule.
    // Une fanfare par-dessus la musique de course ne s'entendrait pas.
    cue(name) {
      if (!this.ok || !this.on) return;
      this.stop();
      const b = this.buf[name]; if (!b) return;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain(); g.gain.value = 0.75;
      s.buffer = b; s.connect(g); g.connect(this.ctx.destination); s.start();
    },
    sfx(name) {
      if (!this.ok || !this.on) return;
      const b = this.buf[name]; if (!b) return;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain(); g.gain.value = 0.55;
      s.buffer = b; s.connect(g); g.connect(this.ctx.destination); s.start();
    },
    toggle() { this.on = !this.on; if (!this.on) this.stop(); return this.on; }
  };

  // -------------------------------------------------------------------
  // JEU
  // -------------------------------------------------------------------
  const SAVE = 'sprinter_web_v1';
  const G = {
    cv: null, cx: null, VW: 960, VH: 640, dpr: 1, portrait: false,
    state: 'open', t: 0, openT: 0,
    raceKey: '100', race: RACES['100'], track: null,
    levelIdx: 0, runners: [], player: null, parts: [],
    elapsed: 0, countT: 0, camX: 0, camY: 0,
    champion: null, championTime: 0,
    ranking: [], won: false, badge: null, entryRank: null,
    runTime: 0, runSplits: [], runRank: null,
    cut: null, cutQueue: [], cutAfter: 'count', skipArm: 0,
    overChoice: 0, shake: 0, flash: 0, stumbleFlash: 0,
    reactFlash: 0, transFlash: 0, falseFlash: 0,
    reactShown: false, transShown: false,
    // Faux depart eliminatoire : vrai le temps de la cinematique et de
    // l'ecran de fin, remis a zero au depart de la course suivante.
    falseOut: false, falseOutT: 0,
    scores: {}, runs: { '100': [], '200': [], '400': [] }, furthest: { '100': 0, '200': 0, '400': 0 },
    keyLeft: false, touches: {}, acc: 0, last: 0, fps: 60,

    // Joueur du TOP 500 que l'on est en train de defier : retenu le temps de
    // la course, pour adresser le defi a la bonne personne a l'arrivee.
    challengeTarget: null,

    // Course suspendue. Sans cela, ouvrir la sortie laisserait le chrono
    // tourner : renoncer couterait la course qu'on voulait justement garder.
    paused: false,

    // Noms du haut du TOP 500 par discipline, charges en tache de fond et
    // servis aux Jeux olympiques. Vides tant que le reseau n'a pas repondu :
    // le plateau maison prend alors le relais.
    topNames: { '100': [], '200': [], '400': [] },

    // --- mode one-shot ---------------------------------------------------
    // 'campaign' : les six etapes d'affilee, comme avant.
    // 'oneshot'  : une ou plusieurs epreuves choisies, courues une fois. Le
    //              classement face aux adversaires n'interrompt plus rien :
    //              seul le chrono cumule compte, c'est un contre-la-montre.
    mode: 'campaign',
    shotRaces: [], shotIdx: 0, shotLevel: 4,

    // --- fantome -----------------------------------------------------------
    // recTrace : la course en cours est echantillonnee (distance tous les
    // REC_STEP) pour pouvoir etre rejouee plus tard par un adversaire.
    // ghost : la trace d'un autre joueur, rejouee en direct a cote de nous.
    recTrace: null, recNext: 0, shotTraces: [],
    ghost: null, ghostName: '', ghostTime: 0,
    challenge: null      // defi en cours (voir challenge.ts)
  };
  // pas de trace ultra-fine : 12,5 relevés par seconde suffisent a rejouer
  // une course de maniere fluide, et gardent la trace assez courte pour
  // tenir dans la base sans compression.
  const REC_STEP = 0.08;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (d.scores) G.scores = d.scores;
      if (d.runs) G.runs = Object.assign(G.runs, d.runs);
      if (d.furthest) G.furthest = Object.assign(G.furthest, d.furthest);
      N.setLang(d.lang || N.detect());
    } catch (e) { N.setLang(N.detect()); }
  }
  function save() {
    try {
      localStorage.setItem(SAVE, JSON.stringify({
        scores: G.scores, runs: G.runs, furthest: G.furthest,
        lang: N.getLang()
      }));
    } catch (e) { }
  }
  // Historique personnel : toutes les courses terminees, pas seulement celles
  // qui entrent au classement. Le TOP 500 ne garde qu'un chrono par joueur et
  // par epreuve, le meilleur ; tout le reste de ce qu'on a couru disparaissait
  // sans laisser de trace. Garde ici, sur l'appareil, et plafonne.
  const HIST = 'sprinter_history';
  const HIST_MAX = 300;
  function recordHistory(t) {
    if (t == null) return;
    try {
      const h = JSON.parse(localStorage.getItem(HIST) || '[]');
      h.unshift({ r: G.raceKey, t: Math.round(t * 100) / 100,
                  m: G.mode, l: G.levelIdx, d: Date.now() });
      if (h.length > HIST_MAX) h.length = HIST_MAX;
      localStorage.setItem(HIST, JSON.stringify(h));
    } catch (e) { /* stockage plein ou refuse : l'historique n'est pas vital */ }
    // ...puis au serveur, pour que l'historique suive d'un appareil a l'autre.
    try { G.onRaceRecorded && G.onRaceRecorded(G.raceKey, t, G.mode, G.levelIdx); }
    catch (e) { /* le local est deja ecrit, on n'en fait pas un echec */ }
  }
  function raceHistory() {
    try { return JSON.parse(localStorage.getItem(HIST) || '[]'); }
    catch (e) { return []; }
  }

  const skey = i => G.raceKey + ':' + i;
  function levelScores(i) { return G.scores[skey(i)] || []; }
  function recordTime(i, t) {
    const a = (G.scores[skey(i)] || []).concat([Math.round(t * 100) / 100]);
    a.sort((x, y) => x - y); a.length = Math.min(10, a.length);
    G.scores[skey(i)] = a;
    const p = a.indexOf(Math.round(t * 100) / 100);
    return p < 0 ? null : p + 1;
  }
  function recordRun(t) {
    const a = G.runs[G.raceKey].concat([Math.round(t * 100) / 100]);
    a.sort((x, y) => x - y); a.length = Math.min(10, a.length);
    G.runs[G.raceKey] = a;
    const p = a.indexOf(Math.round(t * 100) / 100);
    return p < 0 ? null : p + 1;
  }

  // Aux Jeux olympiques, le plateau n'est plus invente : ce sont les sept
  // meilleurs chronos mondiaux de la discipline, tires du TOP 500 par course.
  //
  // Trois regles. Un joueur peut occuper plusieurs lignes du tableau, il ne
  // prend qu'un seul couloir — on descend alors chercher le suivant. Le nom du
  // joueur lui-meme est retire, sinon il courrait contre son propre fantome
  // homonyme. Et s'il n'y a pas encore sept noms au tableau, on complete avec
  // les adversaires maison, sans doublon.
  const OLYMPIC = 4;
  function myNameKey() {
    try { return (localStorage.getItem('sprinter_player_name') || '').trim().toLowerCase(); }
    catch (e) { return ''; }
  }
  function olympicNames() {
    const base = LEVELS[OLYMPIC].names;
    const top = (G.topNames && G.topNames[G.raceKey]) || [];
    const mine = myNameKey();
    const seen = new Set(), out = [];
    for (const n of top) {
      const k = String(n).trim().toLowerCase();
      if (!k || k === mine || seen.has(k)) continue;
      seen.add(k); out.push(n);
      if (out.length === base.length) return out;
    }
    for (const n of base) {
      const k = n.trim().toLowerCase();
      if (k === mine || seen.has(k)) continue;
      seen.add(k); out.push(n);
      if (out.length === base.length) break;
    }
    return out;
  }

  // --- mise en place d'une course ------------------------------------
  function buildLevel(idx) {
    G.levelIdx = idx;
    const lvl = LEVELS[idx], R = G.race;
    const [lo, hi] = R.ranges[idx];
    G.track = new Track(R);
    G.runners = [];
    const pl = new Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed,
      best: R.best, total: G.track.total });
    G.player = pl; G.runners.push(pl);
    let best = 1e9;
    const names = idx === OLYMPIC ? olympicNames() : lvl.names;
    names.forEach((n, i) => {
      const t = lo + Math.random() * (hi - lo);
      const lane = i < 3 ? i : i + 1;
      const r = new Runner(n, lane, { target: t, maxSpeed: R.maxSpeed,
        total: G.track.total, pool: lvl.pool });
      if (t < best) { best = t; G.champion = n; G.championTime = t; }
      G.runners.push(r);
    });
    G.parts = [];
    G.elapsed = 0; G.countT = 0; G.shake = 0; G.flash = 0;
    G.stumbleFlash = 0; G.acc = 0;
    G.reactFlash = G.transFlash = G.falseFlash = 0;
    G.reactShown = G.transShown = false;
    G.falseOut = false; G.falseOutT = 0;
    G.paused = false;
    // nouvelle course : on repart sur une trace vierge
    G.recTrace = []; G.recNext = 0; G.ghost = null;
    const p0 = G.track.pos(0, 3);
    G.camX = p0[0]; G.camY = p0[1];
  }

  function queueCuts(kinds, after) {
    G.cutAfter = after; G.cutQueue = kinds.slice(); nextCut();
  }
  function nextCut() {
    if (!G.cutQueue.length) { G.cut = null; G.skipArm = 0; G.state = G.cutAfter; return; }
    const kind = G.cutQueue.shift();
    let lines, man;
    if (kind === 'champion') {
      lines = pickLang(CUT_CHAMPION).slice();
      man = { look: PLAYER_LOOK, stride: 0, v: G.race.maxSpeed * 0.18,
              maxSpeed: G.race.maxSpeed, fallAnim: 0, celebrate: 1 };
    } else {
      const tbl = kind === 'intro' ? CUT_INTRO : (kind === 'taunt' ? CUT_TAUNT : CUT_DEFEAT);
      const first = (G.champion || 'Le favori').split(' ')[0];
      lines = pickLang(tbl[G.levelIdx]).map(s => s.split('{n}').join(first));
      man = { name: G.champion || '',
              look: ZEZE[G.champion] ||
                    K.lookFor(G.champion || 'X', LEVELS[G.levelIdx].pool),
              stride: 0, maxSpeed: G.race.maxSpeed,
              v: kind === 'intro' ? G.race.maxSpeed : G.race.maxSpeed * 0.22,
              fallAnim: 0, celebrate: kind === 'taunt' ? 1 : 0 };
    }
    G.cut = { kind, t: 0, lines, man, name: G.champion || '' };
    G.skipArm = 0; G.state = 'cut';
  }

  function startRun() {
    G.mode = 'campaign'; G.ghost = null; G.ghostSet = null; G.challenge = null;
    G.runTime = 0; G.runSplits = []; G.runRank = null;
    startLevel(0);
  }
  function startLevel(i) { buildLevel(i); queueCuts(['intro'], 'count'); }

  // Retour a l'accueil. On repasse en carriere et on oublie l'adversaire :
  // sans ca un defi termine resterait actif sur la course suivante.
  function goHome() {
    G.paused = false;
    G.falseOut = false;
    G.challengeTarget = null;
    G.mode = 'campaign';
    G.ghost = null; G.ghostSet = null; G.ghostSplits = [];
    G.ghostName = ''; G.ghostTime = 0; G.challenge = null;
    G.shotRaces = []; G.shotIdx = 0;
    G.state = 'title';
    buildLevel(0);
  }

  // --- one-shot : une ou plusieurs epreuves, courues une seule fois -------
  // opts.ghost / opts.challenge permettent de rejouer contre un adversaire.
  function startOneShot(races, opts) {
    opts = opts || {};
    G.mode = 'oneshot';
    G.shotRaces = races.slice();
    G.shotIdx = 0;
    G.shotLevel = opts.levelIdx == null ? 4 : opts.levelIdx;
    G.runTime = 0; G.runSplits = []; G.runRank = null;
    G.shotTraces = [];
    G.challenge = opts.challenge || null;
    G.ghostSet = opts.ghosts || null;   // une trace par epreuve, si defi
    G.ghostSplits = opts.ghostSplits || [];
    G.ghostName = opts.ghostName || '';
    G.ghostTime = opts.ghostTime || 0;
    startShotRace();
  }
  function startShotRace() {
    G.raceKey = G.shotRaces[G.shotIdx];
    G.race = RACES[G.raceKey];
    buildLevel(G.shotLevel);
    armGhost();
    // pas de cinematique de presentation : le one-shot va droit au but
    queueCuts([], 'count');
  }
  // Faux depart eliminatoire. Reserve au one-shot et au defi : la course y
  // est unique et sans reprise, partir avant le signal met donc fin a tout,
  // comme sur une vraie piste. Les epreuves restantes comptent pour abandon
  // et le duel est perdu — c'est ce que renvoie le vrai : true si l'on vient
  // bien d'eliminer le joueur.
  function falseStartOut() {
    if (G.mode !== 'oneshot' || G.falseOut) return false;
    G.falseOut = true; G.falseOutT = 0;
    G.player.jumped = true;
    while (G.runSplits.length < G.shotRaces.length) G.runSplits.push(null);
    while (G.shotTraces.length < G.shotRaces.length) G.shotTraces.push([]);
    G.shotIdx = G.shotRaces.length;
    G.flash = 1; G.shake = 1.6; G.falseFlash = 2.4;
    Audio_.cue('dirge');
    G.state = 'falseout';
    return true;
  }

  function nextShotRace() {
    G.shotIdx++;
    if (G.shotIdx >= G.shotRaces.length) { G.state = 'winall'; return; }
    startShotRace();
  }

  // Prepare le fantome de l'epreuve courante : un coureur pilote par une
  // trace enregistree, place dans le couloir d'un adversaire (qu'on retire)
  // pour rester lisible a cote du joueur.
  function armGhost() {
    G.ghost = null;
    const set = G.ghostSet;
    if (!set) return;
    const trace = set[G.shotIdx];
    if (!trace || !trace.length) return;
    const lane = 4;
    const idx = G.runners.findIndex(r => !r.isPlayer && r.lane === lane);
    if (idx >= 0) G.runners.splice(idx, 1);
    const r = new Runner(G.ghostName || 'FANTOME', lane, {
      maxSpeed: G.race.maxSpeed, total: G.track.total, pool: LEVELS[G.levelIdx].pool
    });
    r.isGhost = true; r.d = 0; r.v = 0;
    const splits = G.ghostSplits || [];
    G.ghost = { trace, step: REC_STEP, runner: r, time: splits[G.shotIdx] || 0 };
  }
  // Avance le fantome a la position qu'avait l'adversaire au meme instant.
  /**
   * Ou en etait le fantome a l'instant t. Sert a dessiner sa trainee : sans
   * elle il glisse le long du couloir comme un decor, avec elle on lit d'un
   * coup d'oeil s'il accelere ou s'il rentre dans le mur.
   */
  function ghostDistAt(t) {
    const g = G.ghost;
    if (!g || t <= 0) return 0;
    const tr = g.trace, last = tr.length - 1;
    const x = t / g.step;
    if (x >= last) return tr[last] / 10;
    const i0 = Math.max(0, Math.floor(x));
    const i1 = Math.min(last, i0 + 1);
    const f = Math.max(0, Math.min(1, x - i0));
    return (tr[i0] + (tr[i1] - tr[i0]) * f) / 10;
  }

  function stepGhost(dt) {
    const g = G.ghost;
    if (!g) return;
    const r = g.runner, tr = g.trace;
    const last = tr.length - 1;
    const x = G.elapsed / g.step;
    if (x >= last) {
      // Trace epuisee : l'adversaire a franchi la ligne. On le laisse
      // decelerer comme un vrai coureur plutot que de le figer net sur la
      // piste, ce qui se verrait immediatement.
      if (!r.finished) { r.finished = true; r.finishTime = g.time || last * g.step; }
      r.v *= Math.exp(-1.15 * dt);
      r.d += r.v * dt;
      r.stride += r.v * dt * (Math.PI / r.strideLength());
      r.drivePitch = 0;
      return;
    }
    const i0 = Math.max(0, Math.floor(x));
    const i1 = Math.min(last, i0 + 1);
    const f = Math.max(0, Math.min(1, x - i0));
    const d = (tr[i0] + (tr[i1] - tr[i0]) * f) / 10;
    r.v = dt > 0 ? Math.max(0, (d - r.d) / dt) : r.v;
    r.d = d;
    r.stride += r.v * dt * (Math.PI / r.strideLength());
    r.drivePitch = r.pitchAt();
  }

  function finishRace() {
    // Le fantome court hors de G.runners (il n'a pas d'IA), mais il doit
    // apparaitre au classement comme n'importe quel adversaire. S'il n'a pas
    // eu le temps de finir avant l'arret de la course, on lui rend son chrono
    // reel plutot que de l'afficher abandonnant.
    let field = G.runners;
    if (G.ghost) {
      const gr = G.ghost.runner;
      if (gr.finishTime == null) gr.finishTime = G.ghost.time || null;
      field = G.runners.concat([gr]);
    }
    const order = field.slice().sort((a, b) =>
      (a.finishTime === null ? 1e9 : a.finishTime) -
      (b.finishTime === null ? 1e9 : b.finishTime));
    G.ranking = order;
    const rank = order.indexOf(G.player) + 1;
    G.won = rank === 1 && G.player.finishTime !== null;
    G.badge = null; G.entryRank = null;
    if (G.player.finishTime !== null) {
      const p = recordTime(G.levelIdx, G.player.finishTime);
      G.entryRank = p;
      if (p === 1) G.badge = ['new_record', GOLD];
      else if (p && p <= 3) G.badge = ['top3', CYAN];
      else if (p) G.badge = ['top10', GREEN];
    }
    Audio_.stop();
    // Toute course terminee entre a l'historique personnel, qu'elle batte un
    // record ou non — c'est justement ce que le classement ne peut pas garder.
    recordHistory(G.player.finishTime);
    // One-shot : contre-la-montre. La place face aux adversaires ne decide
    // plus de la suite — on enchaine toujours, et c'est le cumul des chronos
    // qui departage, y compris face au fantome d'un adversaire.
    if (G.mode === 'oneshot') {
      const tt = G.player.finishTime;
      G.runSplits.push(tt);
      G.runTime += tt || 0;
      G.shotTraces.push(G.recTrace || []);
      save(); G.flash = 1;
      Audio_.sfx(tt !== null ? 'win' : 'lose');
      if (G.shotIdx + 1 < G.shotRaces.length) { G.state = 'result'; return; }
      G.state = 'winall'; return;
    }
    if (G.won) {
      G.runSplits.push(G.player.finishTime);
      G.runTime += G.player.finishTime;
      G.furthest[G.raceKey] = Math.max(G.furthest[G.raceKey], G.levelIdx + 1);
      if (G.levelIdx + 1 >= LEVELS.length) {
        G.runRank = recordRun(G.runTime); save(); G.flash = 1;
        Audio_.sfx('win'); queueCuts(['defeat', 'champion'], 'winall'); return;
      }
      save(); G.flash = 1; Audio_.sfx('win');
      queueCuts(['defeat'], 'result'); return;
    }
    save(); Audio_.sfx('lose'); G.overChoice = 0;
    queueCuts(['taunt'], 'over'); return;
  }

  // --- projection -----------------------------------------------------
  // Echelle commune a toute l'interface. On prend la plus petite des deux
  // dimensions rapportee a un ecran de reference : sur un telephone etroit
  // et haut, se caler sur la hauteur seule ferait deborder tout le texte.
  function ui() {
    return Math.max(0.62, Math.min(1.7, Math.min(G.VW / 430, G.VH / 660)));
  }
  function scaleM() {
    return ui() * (G.race.arc > 0 ? 44 : 30);
  }
  // Pendant la course, le joueur doit rester au centre exact de l'image ;
  // ailleurs (titre, cinematiques...) on garde la composition d'origine,
  // decalee pour laisser de la place au HUD et au decor.
  function originX() {
    if (G.state === 'race' || G.state === 'count') return G.VW * 0.5;
    return G.VW * (G.portrait ? 0.58 : 0.60);
  }
  function originY() {
    if (G.state === 'race' || G.state === 'count') return G.VH * 0.5;
    return G.VH * (G.portrait ? 0.44 : 0.56);
  }

  const WROT = -14 * Math.PI / 180, WC = Math.cos(WROT), WS = Math.sin(WROT);
  function ground(X, Y) {
    let ax = X - G.camX, ay = Y - G.camY;
    if (G.track && G.track.curved) {
      const t = ax * WC - ay * WS; ay = ax * WS + ay * WC; ax = t;
    }
    const m = scaleM(), u = ax * m, v = ay * m;
    return [originX() - u * C.ISO_COS + v * C.ISO_COS,
            originY() - u * C.ISO_SIN - v * C.ISO_SIN];
  }
  function solid(X, Y, z) {
    const p = ground(X, Y);
    return [p[0], p[1] - z * scaleM()];
  }
  function depthOf(X, Y) {
    let ax = X - G.camX, ay = Y - G.camY;
    if (G.track && G.track.curved) {
      const t = ax * WC - ay * WS; ay = ax * WS + ay * WC; ax = t;
    }
    return (ax + ay) * scaleM();
  }

  function followCam(dt) {
    const T = G.track, s = G.player ? G.player.d : 0, lane = 3;
    // La camera vise la position exacte du joueur (pas de decalage vers
    // l'avant) : combine a l'origine centree, il reste au milieu de l'ecran.
    const p = T.pos(s, lane);
    const tx = p[0], ty = p[1];
    const k = 1 - Math.exp(-6.5 * dt);
    G.camX += (tx - G.camX) * k; G.camY += (ty - G.camY) * k;
  }

  // --- rendu de la piste ---------------------------------------------
  // Decoupage de la piste en tranches. Dans le virage, trente segments de
  // six degres se voyaient : la courbe apparaissait facettee. On echantillonne
  // maintenant tous les 1,2 m environ, et la ligne droite au meme pas pour
  // que les bandes du decor gardent la meme longueur partout.
  const ARC_STEPS = 96;
  function segLen() { return Math.PI * C.R1 / ARC_STEPS; }
  function decorStride() { return G.track.curved ? 12 : 4; }
  function samples() {
    const T = G.track, out = [];
    if (T.curved) {
      const st = segLen();
      for (let i = 0; i <= ARC_STEPS; i++)
        out.push([true, Math.PI * (1 - i / ARC_STEPS), 0]);
      const s1End = T.fullLap ? T.straight : T.straight + C.RUNOUT;
      for (let x = st; x <= s1End; x += st) out.push([false, x, 0]);
      // Tour complet (400 m) : second virage + seconde ligne droite,
      // symetriques du premier couple (voir Track.posLap2), pour que le
      // decor (pelouse, gradins, couloirs) existe sur tout le tour et pas
      // seulement sur la moitie ou demarre la course.
      if (T.fullLap) {
        for (let i = 0; i <= ARC_STEPS; i++)
          out.push([true, Math.PI * (1 - i / ARC_STEPS), 1]);
        for (let x = st; x <= T.straight + C.RUNOUT; x += st) out.push([false, x, 1]);
      }
    } else {
      for (let x = -20; x <= T.straight + C.RUNOUT; x += 12) out.push([false, x, 0]);
    }
    return out;
  }
  function ptOf(sm, r) {
    const T = G.track;
    if (!T.curved) return [sm[1], r];
    if (sm[2] === 1) {
      // Second demi-tour (voir Track.posLap2) : meme rotation de 180
      // degres + translation, mais a partir d'un angle phi deja calcule
      // (comme pour le premier virage) plutot que d'une distance s.
      if (sm[0]) return [T.straight + r * Math.sin(sm[1]), -r * Math.cos(sm[1])];
      return [T.straight - sm[1], -r];
    }
    return T.posR(sm[1], r, sm[0]);
  }
  function band(ctx, sm, rIn, rOut, col, z) {
    if (sm.length < 2) return;
    ctx.beginPath();
    for (let i = 0; i < sm.length; i++) {
      const p = solid(...ptOf(sm[i], rIn), z || 0);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    for (let i = sm.length - 1; i >= 0; i--) {
      const p = solid(...ptOf(sm[i], rOut), z || 0);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  // Meme trace que band(), mais rempli avec un motif au lieu d'une teinte
  // unie : utilise pour le public des gradins (voir getCrowdPattern), qui
  // doit paraitre completement dense sans dessiner un sprite par personne
  // (des dizaines de milliers d'appels drawImage par image feraient chuter
  // le framerate, surtout sur telephone).
  // (ox, oy) decale l'origine du motif sans bouger la forme remplie : on
  // translate le contexte puis on retranche le meme decalage aux points du
  // trace. C'est ce qui permet d'ancrer la foule au monde (elle defile avec
  // la piste). On evite volontairement pattern.setTransform(), qui refait
  // le rendu de la tuile a chaque image et coutait ~35% du framerate.
  function bandPattern(ctx, sm, rIn, rOut, pattern, z, ox, oy) {
    if (sm.length < 2 || !pattern) return;
    ox = ox || 0; oy = oy || 0;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    for (let i = 0; i < sm.length; i++) {
      const p = solid(...ptOf(sm[i], rIn), z || 0);
      i ? ctx.lineTo(p[0] - ox, p[1] - oy) : ctx.moveTo(p[0] - ox, p[1] - oy);
    }
    for (let i = sm.length - 1; i >= 0; i--) {
      const p = solid(...ptOf(sm[i], rOut), z || 0);
      ctx.lineTo(p[0] - ox, p[1] - oy);
    }
    ctx.closePath(); ctx.fillStyle = pattern; ctx.fill();
    ctx.restore();
  }
  // Motif de foule : une tuile dessinee une seule fois (des dizaines de
  // supporters juxtapoles et decales, toujours opaques), repetee ensuite
  // par le moteur canvas lui-meme sur toute la surface du gradin. Le
  // remplissage progressif par etape vient du NOMBRE de personnes bakees
  // dans la tuile (une tuile clairsemee pour la 1ere competition, dense
  // pour la finale) plutot que d'une opacite reduite sur tout le motif —
  // sinon le public entier parait transparent au lieu d'etre juste moins
  // nombreux.
  const CROWD_TILE = 180;
  const crowdPatternCache = {};
  function getCrowdPattern(ctx, levelIdx) {
    if (crowdPatternCache[levelIdx]) return crowdPatternCache[levelIdx];
    const density = CROWD_DENSITY[levelIdx] ?? 1;
    const count = Math.max(15, Math.round(90 * density));
    const tile = document.createElement('canvas');
    tile.width = CROWD_TILE; tile.height = CROWD_TILE;
    const tctx = tile.getContext('2d');
    // Chaque supporter est un vrai personnage a facettes, eclaire comme les
    // coureurs, et non plus un sprite plat. Comme tout est cuit une seule
    // fois dans la tuile puis repete par le moteur canvas, le public gagne
    // du volume sans rien couter par frame — ce qui serait impossible en
    // dessinant les dizaines de milliers de spectateurs un par un.
    for (let n = 0; n < count; n++) {
      const seed = ((n + 1) * 2654435761) >>> 0;
      const fan = {
        look: K.lookFor('fan' + levelIdx + '_' + n, 'divers'),
        stride: (seed % 628) / 100,
        v: 0, maxSpeed: 12, fallAnim: 0,
        // bras leves : un public qui encourage, pas qui court
        celebrate: 0.72 + (seed % 28) / 100
      };
      const caps = personCapsules(fan, 0, 0, (seed & 1) === 1, false);
      const k = 11 + (seed % 5);
      const x = seed % CROWD_TILE;
      const y = ((seed / 211) | 0) % CROWD_TILE;
      // dessine aussi les copies debordantes, sinon la tuile se raccorde
      // sur des corps coupes et le raccord se voit
      for (const dx of [0, -CROWD_TILE]) {
        for (const dy of [0, -CROWD_TILE]) {
          if ((dx || dy) && x + dx < -40 && y + dy < -40) continue;
          drawFacetFigure(tctx, caps, x + dx, y + dy, k);
        }
      }
    }
    crowdPatternCache[levelIdx] = ctx.createPattern(tile, 'repeat');
    return crowdPatternCache[levelIdx];
  }
  // Face VERTICALE le long de la piste, entre deux hauteurs. C'est ce qui
  // manquait au decor : les gradins n'etaient qu'un empilement de bandes
  // horizontales, donc plats. Avec la contremarche reellement dessinee et
  // eclairee selon son orientation, l'escalier se lit en volume.
  //
  // La normale d'une contremarche est horizontale et tourne avec la piste :
  // en virage les gradins ne prennent donc pas la lumiere de la meme
  // maniere partout. On decoupe en troncons pour capter cette variation
  // sans payer une facette par echantillon.
  function wall(ctx, sm, r, zLo, zHi, baseCol, chunk) {
    if (sm.length < 2) return;
    const step = Math.max(1, chunk | 0);
    for (let i = 0; i < sm.length - 1; i += step) {
      const j = Math.min(i + step, sm.length - 1);
      const a = ptOf(sm[i], r), aOut = ptOf(sm[i], r + 1);
      let nx = aOut[0] - a[0], ny = aOut[1] - a[1];
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const d = nx * LIGHT[0] + ny * LIGHT[1];
      const shade = 0.45 + 0.55 * (d > 0 ? d : 0);
      // On ne reprend pas tous les echantillons du troncon : quelques
      // points suffisent a epouser la courbe a cette echelle, et cela
      // divise par trois le nombre de projections a calculer.
      const sub = Math.max(1, step >> 2);
      ctx.beginPath();
      let first = true;
      for (let q = i; q <= j; q += sub) {
        const p = solid(...ptOf(sm[q], r), zLo);
        first ? (ctx.moveTo(p[0], p[1]), first = false) : ctx.lineTo(p[0], p[1]);
      }
      const pEndLo = solid(...ptOf(sm[j], r), zLo);
      ctx.lineTo(pEndLo[0], pEndLo[1]);
      const pEndHi = solid(...ptOf(sm[j], r), zHi);
      ctx.lineTo(pEndHi[0], pEndHi[1]);
      for (let q = j - sub; q >= i; q -= sub) {
        const p = solid(...ptOf(sm[q], r), zHi);
        ctx.lineTo(p[0], p[1]);
      }
      const pStartHi = solid(...ptOf(sm[i], r), zHi);
      ctx.lineTo(pStartHi[0], pStartHi[1]);
      ctx.closePath();
      ctx.fillStyle = rgb(baseCol, shade);
      ctx.fill();
    }
  }
  function rail(ctx, sm, r, col, w, z) {
    if (sm.length < 2) return;
    ctx.beginPath();
    for (let i = 0; i < sm.length; i++) {
      const p = solid(...ptOf(sm[i], r), z || 0);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function drawWorld(ctx, th) {
    const T = G.track;
    // ciel
    const g = ctx.createLinearGradient(0, 0, 0, G.VH);
    g.addColorStop(0, rgb(th.skyTop)); g.addColorStop(1, rgb(th.skyBot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, G.VW, G.VH);
    if (th.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < th.stars; i++) {
        const s = (i * 7919) % 9973;
        ctx.fillRect((s * 13) % G.VW, (s * 7) % (G.VH * 0.7), 1.4, 1.4);
      }
    }
    const sm = samples();
    const rIn = T.curved ? T.edge(0) : 0;
    const rOut = T.curved ? T.edge(C.LANE_COUNT) : C.LANE_W * C.LANE_COUNT;

    // pelouse interieure
    if (T.curved) {
      ctx.beginPath();
      sm.forEach((s, i) => {
        const p = ground(...ptOf(s, rIn));
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      });
      if (T.fullLap) {
        // Tour complet : les echantillons font deja tout le tour du bord
        // interieur (les deux virages et les deux lignes droites) ; on
        // referme simplement la boucle plutot que de couper par le centre.
        ctx.closePath();
      } else {
        let p = ground(T.straight + C.RUNOUT, 0); ctx.lineTo(p[0], p[1]);
        p = ground(0, 0); ctx.lineTo(p[0], p[1]);
        ctx.closePath();
      }
      ctx.fillStyle = rgb(th.grass); ctx.fill();
    } else {
      band(ctx, sm, rIn - 60, rIn, rgb(th.grass));
    }
    band(ctx, sm, rOut, rOut + 46, rgb(th.grass));

    // Grain sur la pelouse exterieure : quelques touches plus claires/sombres
    // ancrees au monde (elles defilent avec la piste, pas avec l'ecran), pour
    // casser l'aplat plutot qu'une texture image plaquee sans rapport avec
    // notre perspective isometrique maison.
    for (let i = 0; i < sm.length; i += 3) {
      const seed = i * 13;
      for (let k = 0; k < 3; k++) {
        const rr = rOut + 3 + ((seed + k * 17) % 40);
        const p = ground(...ptOf(sm[i], rr));
        if (p[0] < -20 || p[0] > G.VW + 20 || p[1] < -20 || p[1] > G.VH + 20) continue;
        const light = (seed + k) % 2 === 0;
        ctx.fillStyle = rgb(th.grassEdge, light ? 1.35 : 0.85);
        ctx.fillRect(p[0], p[1], 1.6 * ui(), 1.6 * ui());
      }
    }

    // Tribune simplifiee : muret, gradins, toiture. Elle est dessinee AVANT
    // la piste. Ces bandes sont posees en hauteur, et dans le virage leur
    // projection retombe sur la surface de course : peintes apres, elles
    // recouvraient la piste et les coureurs.
    const near = rOut + 1.6, tiers = 4, sr = 1.7, sz = 0.58;
    const stp = decorStride();
    band(ctx, sm, near, near + 0.35, rgb(th.barrier), 1.05);
    // Panneaux publicitaires : face verticale eclairee au lieu d'une bande
    // posee a plat, pour qu'ils se dressent vraiment devant les gradins.
    for (let i = 0; i + stp < sm.length; i += stp) {
      wall(ctx, sm.slice(i, i + stp + 1), near, 0.02, 1.05,
           th.panels[(i / stp) % th.panels.length], stp);
    }
    for (let t = 0; t < tiers; t++) {
      const r0 = near + t * sr, z1 = 1.05 + (t + 1) * sz, f = 1 - t * 0.05;
      // contremarche : vraie face verticale, du gradin precedent a celui-ci,
      // eclairee selon son orientation -> l'escalier a du relief
      wall(ctx, sm, r0, z1 - sz, z1, th.riser, stp);
      // marche : surface horizontale, pleinement exposee a la lumiere
      band(ctx, sm, r0, r0 + sr, rgb(th.tread, f), z1);
    }
    // Public dans les gradins : motif de foule dense (getCrowdPattern) plutot
    // que des sprites individuels. Multiplier encore le nombre de personnes
    // dessinees une a une (deja 35 000+ a l'etape 6) ferait chuter le
    // framerate, surtout sur telephone, sans que ca se voie vraiment a
    // l'ecran — un motif repete donne un gradin visuellement complet, sans
    // aucun cout supplementaire quelle que soit la "densite" recherchee.
    // Uniquement sur les lignes droites : dans le virage, seuls les gradins
    // nus restent visibles (pas de tribune principale en courbe).
    const crowdPat = getCrowdPattern(ctx, G.levelIdx);
    if (crowdPat) {
      // Le motif est ancre au MONDE, pas a l'ecran : on le decale de la
      // position ecran d'un point fixe du terrain (l'origine). Comme la
      // projection est lineaire en (X - camX, Y - camY), un deplacement de
      // camera se traduit par une simple translation : les spectateurs
      // defilent donc avec la piste et sortent de l'ecran quand le coureur
      // les depasse, au lieu de rester colles a l'affichage. Le decalage est
      // ramene modulo la taille de la tuile (le motif se repete de toute
      // facon) pour garder de petites valeurs. Une legere oscillation dans
      // le temps s'y ajoute pour le mouvement de foule.
      const tnow = performance.now() / 1000;
      const anchor = ground(0, 0);
      const ox = (anchor[0] + Math.sin(tnow * 1.3) * 2.4) % CROWD_TILE;
      const oy = (anchor[1] + Math.cos(tnow * 0.85) * 1.2) % CROWD_TILE;
      const straightRuns = [];
      let run = null;
      for (const s of sm) {
        if (!s[0]) { if (!run) { run = []; straightRuns.push(run); } run.push(s); }
        else run = null;
      }
      for (let t = 0; t < tiers; t++) {
        const r0 = near + t * sr, z1 = 1.05 + (t + 1) * sz + sr * 0.55;
        for (const straightRun of straightRuns) bandPattern(ctx, straightRun, r0, r0 + sr, crowdPat, z1, ox, oy);
      }
    }
    band(ctx, sm, near + 0.3, near + tiers * sr + 1, rgb(th.roof),
         1.05 + tiers * sz + 2.4);

    // Fanions a damier le long du toit des tribunes, pour donner plus de
    // "definition" au decor (accent visuel base sur un asset plutot que sur
    // un aplat de couleur uni).
    {
      const fh = scaleM() * 0.42, fw = fh * (32 / 27);
      const fz = 1.05 + tiers * sz + 2.55, fr = near + tiers * sr + 0.5;
      const fstp = decorStride() * 2;
      if (FLAG_IMG.complete && FLAG_IMG.naturalWidth) {
        for (let i = 0; i < sm.length; i += fstp) {
          const p = solid(...ptOf(sm[i], fr), fz);
          if (p[0] < -40 || p[0] > G.VW + 40 || p[1] < -40 || p[1] > G.VH + 40) continue;
          ctx.drawImage(FLAG_IMG, p[0] - fw / 2, p[1] - fh, fw, fh);
        }
      }
    }

    // la piste par-dessus : elle reste toujours entierement lisible
    band(ctx, sm, rIn, rOut, rgb(th.trackA));
    for (let i = 0; i + 1 < sm.length; i += stp) {
      if ((i / stp) % 2 === 0)
        band(ctx, sm.slice(i, i + stp + 1), rIn, rOut, rgb(th.trackB));
    }

    rail(ctx, sm, rIn, rgb(th.kerb), 3);
    for (let e = 1; e < C.LANE_COUNT; e++) {
      rail(ctx, sm, T.curved ? T.edge(e) : e * C.LANE_W, rgb(th.lane), 1.6);
    }
    rail(ctx, sm, rOut, rgb(th.lane), 2.2);

    // Position d'un point de la piste a la distance m et au rayon r.
    const at = (m, r) => T.curved ? T.posAtR(m, r) : [m, r];

    // Reperes au sol : uniquement le depart, la ligne des 100 m et celle
    // des 50 derniers metres (comme les marquages permanents d'une vraie
    // piste), plus la ligne d'arrivee dessinee plus bas. Pas de grille
    // tous les 10 m, ca n'existe pas sur une piste reelle.
    const markerSet = new Set([0]);
    if (T.total - 100 > 0) markerSet.add(T.total - 100);
    if (T.total - 50 > 0) markerSet.add(T.total - 50);
    const markers = Array.from(markerSet).sort((a, b) => a - b);

    // Le depart en quinconce n'est PAS un trait continu qui traverse tous
    // les couloirs sur une vraie piste : chaque couloir a son propre
    // repere, court et perpendiculaire a SA propre trajectoire, dessine a
    // l'angle donne par SON propre rayon (l'ecart peut depasser 20 m entre
    // le couloir 1 et le couloir 8 sur un 200 m). Les reperes de couloirs
    // voisins ne se rejoignent donc pas.
    for (const m of markers) {
      const inBend = T.curved && m < T.arc;
      ctx.strokeStyle = 'rgba(255,255,255,0.90)';
      ctx.lineWidth = m === 0 ? 3 : 1.6;
      if (inBend) {
        for (let e = 0; e < C.LANE_COUNT; e++) {
          const laneR = T.radius(e);
          const qa = at(m, laneR - C.LANE_W * 0.5), qb = at(m, laneR + C.LANE_W * 0.5);
          if (!qa || !qb) continue;
          const a = ground(qa[0], qa[1]), b = ground(qb[0], qb[1]);
          if ((a[0] < -200 && b[0] < -200) || (a[0] > G.VW + 200 && b[0] > G.VW + 200)) continue;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      } else {
        const qa = at(m, rIn), qb = at(m, rOut);
        if (!qa || !qb) continue;
        const a = ground(qa[0], qa[1]), b = ground(qb[0], qb[1]);
        if (a[0] < -200 && b[0] < -200) continue;
        if (a[0] > G.VW + 200 && b[0] > G.VW + 200) continue;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    // chiffres sur l'herbe exterieure, aux memes reperes
    ctx.font = '600 ' + (13 * ui()) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    for (const m of markers) {
      const q = at(m, rOut + 2.4);
      if (!q) continue;
      const p = ground(q[0], q[1]);
      if (p[0] < -80 || p[0] > G.VW + 80) continue;
      ctx.fillText(m === 0 ? t('depart') : String(m), p[0], p[1]);
    }

    // damier d'arrivee : positionne par distance de course (via at(), qui
    // gere le second demi-tour du 400 m) plutot que par coordonnee locale
    // fixe, sinon la ligne d'arrivee tomberait au mauvais endroit sur un
    // tour complet.
    for (let i = 0; i < C.LANE_COUNT * 2; i++) {
      const rr = rIn + i * C.LANE_W * 0.5;
      ctx.fillStyle = i % 2 ? 'rgb(56,58,72)' : '#fff';
      ctx.beginPath();
      const c0 = at(T.total - 0.35, rr), c1 = at(T.total + 0.35, rr),
            c2 = at(T.total + 0.35, rr + C.LANE_W * 0.5), c3 = at(T.total - 0.35, rr + C.LANE_W * 0.5);
      const q = [ground(c0[0], c0[1]), ground(c1[0], c1[1]),
                 ground(c2[0], c2[1]), ground(c3[0], c3[1])];
      ctx.moveTo(q[0][0], q[0][1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(q[j][0], q[j][1]);
      ctx.closePath(); ctx.fill();
    }
  }

  // -------------------------------------------------------------------
  // RENDU A FACETTES
  // -------------------------------------------------------------------
  // Un seul style pour toute l'appli (course, cinematiques, accueil), a
  // partir du meme squelette pose() : chaque segment est un volume
  // eclaire, et non plus une capsule 2D a teinte plate. La rotation en
  // virage (headAng) reste correcte puisqu'elle fait partie du meme
  // calcul que pour le reste de la scene.
  //
  // Chaque segment du corps est un tronc de cone a N faces, eclairees une
  // par une par LIGHT. Le corps a donc un vrai relief, la ou la capsule
  // ne donnait qu'un aplat cerne.
  //
  // Trois choses tiennent le cout de rendu, indispensable avec huit
  // coureurs a l'ecran :
  //   - le nombre de faces suit la taille a l'ecran du segment (un doigt
  //     ne merite pas autant de facettes qu'un torse) ;
  //   - les faces qui tournent le dos a la camera sont eliminees, ce qui
  //     retire la moitie du travail ;
  //   - le tri reste par segment (un tube est convexe, donc trier ses
  //     propres faces suffit) plutot qu'un tri global de milliers de faces.

  // Direction de vue de la projection isometrique, deduite de la
  // projection elle-meme : ecran = ((Y-X)*ISO_COS, -(X+Y)*ISO_SIN - Z).
  const VIEW = (function () {
    const v = [C.ISO_COS, C.ISO_COS, -2 * C.ISO_COS * C.ISO_SIN];
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  })();

  const RING_MAX = 10;
  // tampons reutilises d'une frame a l'autre : ce code tourne des
  // centaines de fois par image, il ne doit rien allouer.
  const _p0x = new Float64Array(RING_MAX), _p0y = new Float64Array(RING_MAX), _p0z = new Float64Array(RING_MAX);
  const _p1x = new Float64Array(RING_MAX), _p1y = new Float64Array(RING_MAX), _p1z = new Float64Array(RING_MAX);
  const _nx = new Float64Array(RING_MAX), _ny = new Float64Array(RING_MAX), _nz = new Float64Array(RING_MAX);
  const _s0x = new Float64Array(RING_MAX), _s0y = new Float64Array(RING_MAX);
  const _s1x = new Float64Array(RING_MAX), _s1y = new Float64Array(RING_MAX);
  const _fDepth = new Float64Array(RING_MAX + 2);
  const _fShade = new Float64Array(RING_MAX + 2);
  const _fKind = new Int32Array(RING_MAX + 2);
  const _fOrder = new Int32Array(RING_MAX + 2);

  function facetCount(rpx) {
    if (rpx < 2.5) return 4;
    if (rpx < 5) return 6;
    if (rpx < 10) return 8;
    return RING_MAX;
  }

  function drawSegmentFacets(ctx, col, e0, e1, ax, ay, k) {
    const r0 = e0[3], r1 = e1[3];
    let dx = e1[0] - e0[0], dy = e1[1] - e0[1], dz = e1[2] - e0[2];
    let len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) { dx = 0; dy = 0; dz = 1; len = 1e-6; }
    const axx = dx / len, axy = dy / len, axz = dz / len;

    // base orthonormee perpendiculaire a l'axe du segment
    let hx = 0, hy = 0, hz = 1;
    if (Math.abs(axz) > 0.9) { hx = 1; hz = 0; }
    let ux = axy * hz - axz * hy, uy = axz * hx - axx * hz, uz = axx * hy - axy * hx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    const vx = axy * uz - axz * uy, vy = axz * ux - axx * uz, vz = axx * uy - axy * ux;

    const N = facetCount(Math.max(r0, r1) * k);
    const dr = (r1 - r0) / len;

    for (let i = 0; i < N; i++) {
      const a = TAU * i / N, ca = Math.cos(a), sa = Math.sin(a);
      const rx = ux * ca + vx * sa, ry = uy * ca + vy * sa, rz = uz * ca + vz * sa;
      // normale d'un tronc de cone : radiale, inclinee par la variation de rayon
      let mx = rx - axx * dr, my = ry - axy * dr, mz = rz - axz * dr;
      const ml = Math.hypot(mx, my, mz) || 1;
      _nx[i] = mx / ml; _ny[i] = my / ml; _nz[i] = mz / ml;

      const X0 = e0[0] + rx * r0, Y0 = e0[1] + ry * r0, Z0 = e0[2] + rz * r0;
      const X1 = e1[0] + rx * r1, Y1 = e1[1] + ry * r1, Z1 = e1[2] + rz * r1;
      _p0x[i] = X0; _p0y[i] = Y0; _p0z[i] = Z0;
      _p1x[i] = X1; _p1y[i] = Y1; _p1z[i] = Z1;
      _s0x[i] = ax + (Y0 - X0) * C.ISO_COS * k;
      _s0y[i] = ay - (X0 + Y0) * C.ISO_SIN * k - Z0 * k;
      _s1x[i] = ax + (Y1 - X1) * C.ISO_COS * k;
      _s1y[i] = ay - (X1 + Y1) * C.ISO_SIN * k - Z1 * k;
    }

    // faces laterales visibles, plus les deux disques de bout
    let nf = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const mx = (_nx[i] + _nx[j]) * 0.5, my = (_ny[i] + _ny[j]) * 0.5, mz = (_nz[i] + _nz[j]) * 0.5;
      if (mx * VIEW[0] + my * VIEW[1] + mz * VIEW[2] >= 0) continue;   // dos a la camera
      _fKind[nf] = i;
      _fDepth[nf] = (_p0x[i] + _p0y[i] + _p0x[j] + _p0y[j] +
                     _p1x[i] + _p1y[i] + _p1x[j] + _p1y[j]) * 0.25;
      const nl = mx * LIGHT[0] + my * LIGHT[1] + mz * LIGHT[2];
      _fShade[nf] = 0.56 + 0.60 * (nl < 0 ? -nl : 0);
      nf++;
    }
    // bouchons : sans eux les extremites (mains, pieds, tete) sont creuses
    if (-(axx * VIEW[0] + axy * VIEW[1] + axz * VIEW[2]) < 0) {
      _fKind[nf] = -1;
      _fDepth[nf] = e0[0] + e0[1];
      const nl = -(axx * LIGHT[0] + axy * LIGHT[1] + axz * LIGHT[2]);
      _fShade[nf] = 0.56 + 0.60 * (nl > 0 ? nl : 0);
      nf++;
    }
    if (axx * VIEW[0] + axy * VIEW[1] + axz * VIEW[2] < 0) {
      _fKind[nf] = -2;
      _fDepth[nf] = e1[0] + e1[1];
      const nl = axx * LIGHT[0] + axy * LIGHT[1] + axz * LIGHT[2];
      _fShade[nf] = 0.56 + 0.60 * (nl > 0 ? nl : 0);
      nf++;
    }

    for (let i = 0; i < nf; i++) _fOrder[i] = i;
    // tri par insertion : nf vaut au plus 12, c'est plus rapide qu'un sort()
    for (let i = 1; i < nf; i++) {
      const cur = _fOrder[i], d = _fDepth[cur];
      let j = i - 1;
      while (j >= 0 && _fDepth[_fOrder[j]] < d) { _fOrder[j + 1] = _fOrder[j]; j--; }
      _fOrder[j + 1] = cur;
    }

    for (let f = 0; f < nf; f++) {
      const id = _fOrder[f], kind = _fKind[id];
      ctx.beginPath();
      if (kind >= 0) {
        const i = kind, j = (i + 1) % N;
        ctx.moveTo(_s0x[i], _s0y[i]);
        ctx.lineTo(_s0x[j], _s0y[j]);
        ctx.lineTo(_s1x[j], _s1y[j]);
        ctx.lineTo(_s1x[i], _s1y[i]);
      } else if (kind === -1) {
        ctx.moveTo(_s0x[0], _s0y[0]);
        for (let i = 1; i < N; i++) ctx.lineTo(_s0x[i], _s0y[i]);
      } else {
        ctx.moveTo(_s1x[0], _s1y[0]);
        for (let i = 1; i < N; i++) ctx.lineTo(_s1x[i], _s1y[i]);
      }
      ctx.closePath();
      ctx.fillStyle = rgb(col, _fShade[id]);
      ctx.fill();
    }
  }

  function drawFacetFigure(ctx, caps, ax, ay, k) {
    const order = [];
    for (let i = 0; i < caps.length; i++) {
      const e0 = caps[i][1], e1 = caps[i][2];
      order.push([(e0[0] + e0[1] + e1[0] + e1[1]) * 0.5, i]);
    }
    order.sort((a, b) => b[0] - a[0]);
    for (let n = 0; n < order.length; n++) {
      const c = caps[order[n][1]];
      drawSegmentFacets(ctx, c[0], c[1], c[2], ax, ay, k);
    }
  }

  function personCapsules(person, headAng, lean, mirror, applyCurve) {
    const parts = pose(person);
    const sgn = mirror ? -1 : 1;
    const hc = Math.cos(headAng || 0), hs = Math.sin(headAng || 0);
    // La chute ajoute son propre deport lateral par-dessus l'inclinaison
    // du virage : le coureur part de travers au lieu de piquer droit devant.
    const fsh = K.fallShape(person.fallAnim);
    const roll = (lean || 0) + (fsh ? fsh.roll : 0);
    const rc = Math.cos(roll), rs = Math.sin(roll);
    const fall = (fsh ? fsh.pitch : 0) - (person.drivePitch || 0);
    const fc = Math.cos(fall), fs = Math.sin(fall);
    const caps = [];
    for (const [col, pv, ang, off, hf, yaw] of parts) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const yc = Math.cos(yaw), ys = Math.sin(yaw);
      const ends = [];
      for (const zSign of [-1, 1]) {
        const hx = zSign < 0 ? hf[0] : hf[2], hy = zSign < 0 ? hf[1] : hf[3];
        const lx = off[0], lz = off[2] + zSign * hf[4];
        let wx = pv[0] + lx * ca - lz * sa;
        let wz = pv[2] + lx * sa + lz * ca;
        let wy = pv[1] + off[1];
        if (yaw) { const t = wx * yc - wy * ys; wy = wx * ys + wy * yc; wx = t; }
        if (lean) { const t = wy * rc - wz * rs; wz = wy * rs + wz * rc; wy = t; }
        if (Math.abs(fall) > 0.001) { const t = wx * fc - wz * fs; wz = wx * fs + wz * fc; wx = t; }
        if (wz < 0) wz = 0;
        wx *= sgn;
        let rx = wx, ry = wy;
        if (headAng) { const t = wx * hc - wy * hs; ry = wx * hs + wy * hc; rx = t; }
        if (applyCurve) { const t = rx * WC - ry * WS; ry = rx * WS + ry * WC; rx = t; }
        ends.push([rx, ry, wz, (hx + hy) * 0.5]);
      }
      caps.push([col, ends[0], ends[1]]);
    }
    return caps;
  }

  // --- rendu d'un athlete en course --------------------------------------
  function drawRunner(ctx, r, ax, ay, adepth, k, headAng, lean) {
    const curved = !!(G.track && G.track.curved);
    // Les sept ZEZE sont dessines depuis leur planche de sprites ; pour tout
    // le reste du plateau, et tant que les images ne sont pas chargees, on
    // garde le rendu en capsules. Sur piste courbe le monde entier tourne de
    // WROT : le sprite doit donc etre choisi sur le cap deja tourne.
    const S = globalThis.SprinterSprites;
    if (S && S.draw(ctx, r, ax, ay, k,
                    (headAng || 0) + (curved ? WROT : 0), lean)) return;
    const caps = personCapsules(r, headAng, lean, false, curved);
    drawFacetFigure(ctx, caps, ax, ay, k);
  }

  function drawAthletes(ctx) {
    const T = G.track, m = scaleM();
    const vis = [];
    const all = G.ghost ? G.runners.concat([G.ghost.runner]) : G.runners;
    for (const r of all) {
      const p = T.pos(r.d, r.lane), g2 = ground(p[0], p[1]);
      if (g2[0] > -200 && g2[0] < G.VW + 200 && g2[1] > -260 && g2[1] < G.VH + 200)
        vis.push([r, g2, p]);
    }
    for (const [r, g2] of vis) {
      if (r.isGhost) continue;          // un fantome ne porte pas d'ombre
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(g2[0], g2[1], 15 * m / 30, 6 * m / 30, 0, 0, TAU);
      ctx.fill();
    }
    for (const [r, g2, p] of vis) {
      // le fantome est translucide : on voit qu'il n'est pas vraiment la,
      // tout en suivant precisement l'ecart avec lui
      if (r.isGhost) { drawGhostTrail(ctx, r, m); ctx.globalAlpha = 0.42; }
      drawRunner(ctx, r, g2[0], g2[1], depthOf(p[0], p[1]),
                 m * (r.look.h / C.MODEL_H),
                 T.heading(r.d, r.lane), T.lean(r.d, r.lane, r.v));
      if (r.isGhost) ctx.globalAlpha = 1;
    }
  }

  /**
   * Trois echos derriere le fantome, pris sur sa propre trace. Ils espacent
   * l'image quand il va vite et la resserrent quand il ralentit : l'ecart
   * devient lisible sans quitter la piste des yeux, ce que ne donne aucun
   * chiffre affiche en haut de l'ecran.
   */
  function drawGhostTrail(ctx, r, m) {
    const T = G.track;
    const dNow = r.d;
    const strideNow = r.stride;
    for (let k = 3; k >= 1; k--) {
      const d = ghostDistAt(G.elapsed - k * 0.13);
      if (d <= 0 || dNow - d < 0.05) continue;
      const p = T.pos(d, r.lane), g2 = ground(p[0], p[1]);
      if (g2[0] < -200 || g2[0] > G.VW + 200) continue;
      ctx.globalAlpha = 0.10 * (4 - k) / 3;
      r.d = d; r.stride = strideNow - (dNow - d) * (Math.PI / r.strideLength());
      drawRunner(ctx, r, g2[0], g2[1], depthOf(p[0], p[1]),
                 m * (r.look.h / C.MODEL_H),
                 T.heading(d, r.lane), T.lean(d, r.lane, r.v));
    }
    r.d = dNow; r.stride = strideNow;
    ctx.globalAlpha = 1;
  }

  // athlete isole, pour les cinematiques et l'accueil : meme style que
  // pendant la course, sans rotation de virage (personnage pose seul).
  function drawIcon(ctx, man, cx2, cy2, pxFor2m, mirror) {
    const k = pxFor2m * (man.look.h / C.MODEL_H) / 2;
    const S = globalThis.SprinterSprites;
    if (S && S.draw(ctx, man, cx2, cy2, k, 0, 0, mirror)) return;
    const caps = personCapsules(man, 0, 0, mirror, false);
    drawFacetFigure(ctx, caps, cx2, cy2, k);
  }

  globalThis.SprinterApp = { G, THEMES, Audio_, load, save, levelScores,
    falseStartOut,
    recordTime, recordRun, buildLevel, queueCuts, nextCut, startRun,
    startLevel, finishRace, ground, solid, depthOf, followCam, drawWorld, ui,
    startOneShot, startShotRace, nextShotRace, stepGhost, ghostDistAt,
    REC_STEP, goHome,
    raceHistory,
    drawAthletes, drawIcon, scaleM, originX, originY, rgb, clamp, lerp, mix,
    CUT_INTRO, CUT_DEFEAT, CUT_CHAMPION, CUT_TAUNT, GOLD, CREAM, MUTED, CYAN, GREEN,
    N, t,
    RED, MAGENTA };
})();
