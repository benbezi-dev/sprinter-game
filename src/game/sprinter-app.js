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
    },
    // Stade de la Riviera : le ciel, la piscine et les palmiers des affiches
    // de Hiroshi Nagai. La palette ne cherche pas le realisme d'un stade, elle
    // cherche l'aplat — turquoise, corail, creme, poses cote a cote et jamais
    // desatures : chez Nagai le soleil ne fatigue aucune couleur. Les gradins
    // sont blancs, et leur ombre tire sur le violet plutot que sur le gris.
    //
    // LA TOITURE EST TURQUOISE, ET C'EST UN REPORT. Le ciel de ce stade ne se
    // voit presque jamais : la camera colle au coureur, et le cadre s'arrete
    // une quinzaine de metres au-dela du bord de piste — les gradins bouchent
    // l'horizon pendant toute la course. Le grand aplat bleu-vert de l'image,
    // celui qui fait tenir la triade, doit donc etre porte par la seule
    // surface haute qu'on voit vraiment : le toit des tribunes. Le ciel, lui,
    // et les nuages qui vont avec, reviennent des qu'on joue en paysage ou sur
    // grand ecran, ou le champ s'ouvre.
    //
    // Les quatre derniers champs n'existent que pour ce stade. `clouds` et
    // `palms` allument un decor que les autres n'ont pas — des nuages a bord
    // net, des palmiers derriere les tribunes — et les deux teintes qui
    // suivent habillent ces palmiers. Un stade qui ne les porte pas ne paie
    // rien : le test se fait sur le theme, pas sur le niveau.
    riviera: {
      // LE CIEL EST PROFOND, PAS PALE. Sur la toile de reference — le court de
      // tennis — le bleu reste franc jusqu'au ras de la haie : il ne blanchit
      // pas a l'horizon comme un ciel de photo. Le degrade existe, mais il va
      // du cobalt au bleu moyen, jamais au blanc. Notre ciel delavait tout le
      // haut de l'image et emportait avec lui la saturation du reste.
      skyTop: [12, 92, 186], skyBot: [116, 194, 234], stars: 0,
      grass: [58, 168, 104], grassEdge: [40, 140, 88],
      trackA: [236, 124, 106], trackB: [222, 108, 92],
      lane: [255, 252, 244], kerb: [86, 206, 208],
      tread: [246, 242, 232], riser: [178, 168, 202], roof: [72, 184, 194],
      barrier: [255, 253, 247],
      panels: [[240, 131, 156], [46, 190, 200], [247, 201, 96], [40, 122, 193]],
      crowdLo: [92, 78, 128], crowdHi: [255, 248, 236],
      accent: [247, 138, 100], dust: [240, 222, 196],
      clouds: true, avion: true, arbres: 'palmier', piscine: true,
      // L'horizon pose pres, et la mer derriere : voir drawWorld. C'est ce qui
      // fait entrer le ciel — et donc l'avion et les nuages — dans le cadre de
      // la course, au lieu de les peindre pour personne.
      // Mesure : avec quatre gradins et un toit, le ciel occupe 4 % du haut de
      // l'image ; a deux gradins et sans toit, 35 %. C'est tout l'ecart entre
      // un ciel qu'on peint pour personne et un ciel qu'on regarde en courant.
      horizon: 6, lointain: [96, 198, 224], lointainFond: [18, 104, 168],
      vagues: true, toiture: false, gradins: 2, immeubles: true, transats: true,
      haie: true, haieSombre: [24, 104, 76], musique: 'riviera',
      eau: [96, 214, 226], eauFond: [22, 146, 190],
      palmTrunk: [206, 172, 132], palmLeaf: [20, 122, 100]
    },
    // Stade de la Nuit etoilee : Van Gogh, et non une nuit de jeu video. La
    // difference tient en un mot, le MOUVEMENT. Chez lui le ciel n'est pas un
    // fond sombre pique de points blancs, c'est une matiere qui tourne — des
    // tourbillons, des astres cernes d'un halo, et le coup de pinceau visible
    // jusque dans l'herbe. Un aplat bleu nuit avec des etoiles ne rappellerait
    // personne ; c'est deja ce que fait le stade Inter galactique, deux lignes
    // plus haut.
    //
    // Meme report que pour la Riviera, et pour la meme raison : le ciel ne se
    // voit presque pas en course. Ce qui porte le tableau a l'ecran, c'est la
    // piste — un jaune de chrome, SA couleur — posee sur une pelouse bleu-vert
    // entre des gradins outremer. Les trois couleurs du tableau, aux trois
    // surfaces qu'on regarde.
    nuit: {
      skyTop: [10, 24, 72], skyBot: [42, 88, 156], stars: 300,
      grass: [26, 68, 72], grassEdge: [46, 108, 98],
      trackA: [206, 152, 46], trackB: [188, 134, 38],
      lane: [248, 236, 190], kerb: [246, 210, 96],
      tread: [58, 92, 140], riser: [28, 50, 102], roof: [22, 44, 96],
      barrier: [176, 200, 232],
      panels: [[240, 200, 70], [46, 86, 168], [126, 148, 74], [214, 122, 44]],
      crowdLo: [22, 34, 68], crowdHi: [220, 228, 246],
      accent: [246, 214, 110], dust: [188, 200, 224],
      tourbillons: true, arbres: 'cypres', pinceau: true,
      horizon: 6, lointain: [28, 52, 96], toiture: false, gradins: 2,
      village: true, villageSombre: [12, 24, 56], musique: 'nuit',
      cypresSombre: [16, 38, 34], cypresClair: [48, 88, 58]
    }
  };

  // Le stade en plus n'entre dans la liste que sur le canal de test.
  //
  // Pourquoi ici, et pas dans le moteur ou vivent les donnees de jeu : le
  // moteur est charge tel quel par les harnais de `tools/` — parfois en module
  // Node, parfois evalue dans un `new Function` — et `import.meta` n'existe
  // dans ni l'un ni l'autre. La ligne ci-dessous, ecrite la-bas, casserait
  // trois outils d'un coup. Elle vit donc dans la couche navigateur, la seule
  // qui passe toujours par Vite.
  //
  // CE QUE CE DRAPEAU FAIT, ET CE QU'IL NE FAIT PAS. Ecrite exactement ainsi,
  // la condition se replie en `false` a la compilation publique, et le stade
  // n'entre jamais dans LEVELS : aucun ecran ne le propose, aucune course ne
  // s'y court. Mais sa description, elle, VOYAGE : `STADES_HORS_SERIE` est
  // pose sur un objet global par le moteur, et un bundler ne peut pas suivre
  // ce qui est publie sur un global. Ce n'est pas le cas de canal.ts, ou le
  // drapeau retire vraiment le code du bundle. Ici il rend le stade
  // inatteignable, pas absent — sept noms et huit chronos font le voyage. Le
  // jour ou il faudra qu'il ne parte plus du tout, c'est la definition
  // elle-meme qu'il faudra sortir du moteur, pas cette condition.
  //
  // La troisieme etape, elle, CHANGE DE DECOR SANS CHANGER DE RANG.
  //
  // « Niveau national » dit ou l'on en est sur l'echelle du championnat, pas ou
  // la reunion se tient : le nom reste donc celui-la. Poser un nom de lieu au
  // milieu de scolaire / regional / mondial / olympique casserait la seule
  // chose que cette liste raconte, la montee — et l'ecran d'etape annonce
  // « ETAPE 3 » a partir de cette place, pas a partir du nom.
  //
  // Rien d'autre ne bouge : meme plateau, memes adversaires, meme foule. Seul
  // le theme change, donc seules les couleurs et le bord de mer.
  //
  // Et LES ZEZE ONT DEUX STADES.
  //
  // La finale intergalactique se court tantot dans le stade cosmos, tantot
  // sous la nuit etoilee de Van Gogh — et LEQUEL DES DEUX N'EST PAS UN HASARD :
  // il depend du chrono qu'on vient de poser a l'etape precedente (voir
  // buildLevel et enDessousDuNiveau). Qui arrive a leur vitesse est recu dans
  // le stade cosmos, celui de la vraie finale ; qui arrive plus lent que le
  // plus lent d'entre eux est recu ailleurs, sous les etoiles.
  //
  // Un tirage au sort aurait dit « les ZEZE ont deux stades ». Celui-ci dit
  // quelque chose de plus : il donne au decor le role d'un verdict, rendu
  // avant meme le coup de pistolet, et que le joueur peut lire sans qu'on le
  // lui ecrive.
  const ETAPE_BORD_DE_MER = 2, ETAPE_ZEZE = 5;
  if (import.meta.env.VITE_CANAL === 'test') {
    for (const stade of K.STADES_HORS_SERIE) LEVELS.push(stade);
    LEVELS[ETAPE_BORD_DE_MER].theme = 'riviera';
    LEVELS[ETAPE_ZEZE].stades = { aNiveau: 'cosmos', enDessous: 'nuit' };
  }

  // Public dans les gradins : des personnages a facettes cuits dans une
  // tuile (voir getCrowdPattern), et non plus des sprites plats. Le
  // remplissage croit avec l'importance de l'etape — une competition
  // scolaire n'attire pas la meme foule qu'une finale intergalactique.
  const CROWD_BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');
  // Les six etapes du championnat, puis les stades hors serie. La Riviera est
  // un meeting d'ete au bord de l'eau : gradins bien garnis, sans l'affluence
  // d'une finale mondiale.
  const CROWD_DENSITY = [0.25, 0.40, 0.60, 0.80, 0.95, 1.00, 0.72];
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
  // LA VOIX DU STARTER
  // -------------------------------------------------------------------
  /**
   * « A VOS MARQUES »… « PRET »… ET LE COUP DE PISTOLET.
   *
   * Ces trois sons sont synthetises, comme tout le reste du jeu — la musique,
   * les tambours, les bruitages. Ce n'est pas une coquetterie, c'est ce qui
   * leur permet d'exister partout :
   *
   * - un enregistrement, il aurait fallu le faire dans deux langues, le
   *   livrer avec le jeu et l'attendre au chargement, pour trois secondes de
   *   son. Le jeu tient aujourd'hui sans un seul fichier audio.
   * - `speechSynthesis` parle vraiment, mais il ne passe pas par le graphe
   *   audio du jeu : il ne serait ni dans le replay ni coupe par le bouton
   *   son, il prendrait la voix systeme de l'appareil — et il arrive quand il
   *   veut. Un depart se joue au centieme ; on ne le confie pas a un moteur
   *   qui peut repondre trois cents millisecondes plus tard.
   *
   * LE PRINCIPE, LUI, EST CELUI DE LA PAROLE. Une voyelle n'est rien d'autre
   * que trois bosses dans le spectre — ses formants. On excite trois
   * resonateurs avec une source (des impulsions glottales pour ce qui est
   * voise, du bruit pour les consonnes), on fait GLISSER leurs frequences
   * d'un phoneme au suivant, et l'oreille entend des mots. C'est la glissade
   * qui fait la voix : trois bourdons poses cote a cote ne s'entendent que
   * comme trois bourdons.
   *
   * Les valeurs sont celles d'une voix d'homme grave, passee au haut-parleur
   * du stade — c'est ce qu'on attend d'un starter, et cela tombe bien : ce
   * timbre-la pardonne beaucoup a une synthese.
   */
  const FORMANTS = {
    //          F1    F2    F3   source
    a:        [ 730, 1150, 2450, 'v'],   // « a », « marques »
    ah:       [ 700, 1220, 2500, 'v'],   // « marks », anglais
    o:        [ 400,  760, 2400, 'v'],   // « vos »
    aw:       [ 570,  900, 2450, 'v'],   // « on », anglais
    eh:       [ 550, 1770, 2490, 'v'],   // « pret », « set »
    j:        [ 300, 2200, 3000, 'v'],   // le yod de « your »
    m:        [ 250, 1100, 2200, 'n'],
    n:        [ 250, 1700, 2600, 'n'],
    v:        [ 350, 1300, 2200, 'z'],   // fricative voisee
    r:        [ 420, 1250, 1900, 'z'],   // le R francais, gratte dans la gorge
    rr:       [ 320, 1000, 1500, 'v'],   // le r anglais : F3 tres bas
    s:        [1300, 4800, 7000, 'f'],   // sifflante : tout est dans l'aigu
    k:        [ 450, 1800, 2400, 'x'],   // occlusive : silence, puis explosion
    p:        [ 400,  900, 2100, 'x'],
    t:        [ 400, 1900, 2700, 'x'],
    _:        [ 400, 1400, 2400, '.'],   // le silence, et le repos des formants
  };

  /**
   * Les deux commandes, dans les deux langues.
   *
   * Les durees ne sont pas decoratives : ce sont elles qui donnent le debit
   * d'un starter — pose sur les voyelles, net sur les consonnes. « A vos
   * marques » s'etire, « pret » se tient.
   */
  const COMMANDES = {
    marques_fr: [['a', 0.26], ['v', 0.07], ['o', 0.23], ['m', 0.09],
                 ['a', 0.18], ['r', 0.09], ['k', 0.08]],
    pret_fr:    [['p', 0.07], ['r', 0.07], ['eh', 0.40]],
    marques_en: [['aw', 0.21], ['n', 0.07], ['j', 0.05], ['o', 0.12],
                 ['rr', 0.09], ['m', 0.08], ['ah', 0.23], ['rr', 0.08],
                 ['k', 0.06], ['s', 0.14]],
    pret_en:    [['s', 0.14], ['eh', 0.28], ['t', 0.07]],
  };

  // -------------------------------------------------------------------
  // SON
  // -------------------------------------------------------------------
  const Audio_ = {
    ok: false, on: true, ctx: null, buf: {}, src: null, cur: null, gain: null,
    // La SORTIE unique, et la prise branchee dessus.
    //
    // Tout passait auparavant directement sur `ctx.destination` : la musique
    // par son gain, les bruitages et les annonces par le leur. Trois fils vers
    // la meme prise murale, ce qui marche tant qu'on ne veut qu'entendre — et
    // qui ne donne aucun endroit ou POSER UN MICRO quand on veut aussi
    // enregistrer. Les trois passent maintenant par un seul noeud, et c'est de
    // celui-la que part le replay. Voir `prise`.
    sortie: null, capture: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.sortie = this.ctx.createGain();
        this.sortie.connect(this.ctx.destination);
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.34;
        this.gain.connect(this.sortie);
        this.build();
        this.ok = true;
      } catch (e) { this.ok = false; }
    },

    /**
     * LE SON DU JEU, SOUS FORME DE FLUX — pour le replay, et rien d'autre.
     *
     * On derive, on ne detourne pas : `sortie` reste branchee sur les
     * haut-parleurs, et la prise est un SECOND fil pose a cote. Le joueur
     * continue donc d'entendre exactement ce qu'il entendait, enregistrement
     * ou pas.
     *
     * Elle se cree une fois et ne se defait jamais : un noeud de capture qui
     * ne recoit personne ne coute rien, et le rebrancher a chaque course
     * ferait claquer le graphe au pire moment.
     *
     * Ce qui est coupe n'est pas enregistre — la prise est APRES le bouton
     * son. C'est voulu : le replay rend ce que la course a sonne, et non ce
     * qu'elle aurait sonne si on avait ecoute.
     */
    prise() {
      this.init();
      if (!this.ok || !this.ctx || typeof this.ctx.createMediaStreamDestination !== 'function') return null;
      try {
        if (!this.capture) {
          this.capture = this.ctx.createMediaStreamDestination();
          this.sortie.connect(this.capture);
        }
        // Un contexte suspendu ne produit rien : le premier geste du joueur l'a
        // normalement reveille, mais un depart lance au clavier peut arriver
        // avant. On insiste ici, ou cela ne coute qu'une promesse ignoree.
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* muet */ });
        return this.capture.stream;
      } catch (e) { return null; }
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

      // --- les deux stades qui ont leur propre musique -----------------
      //
      // Les quatre paliers ci-dessus racontent une MONTEE : le tempo, la
      // densite et l'harmonie se tendent d'une etape a l'autre, et une piste
      // de plus dans cette suite n'aurait rien voulu dire. Ces deux stades ne
      // sont pas des paliers, ce sont des lieux — ils ont donc leur morceau,
      // accroche au theme et non au rang (voir raceTrack).
      //
      // Ils ne sont fabriques que sur le canal de test : ecrite ainsi, la
      // condition se replie a la compilation publique, et ce sont deux tampons
      // de pres d'un mega-octet et demi chacun qu'on evite d'allouer pour une
      // musique qu'aucun ecran ne peut jouer.
      if (import.meta.env.VITE_CANAL === 'test') {
        const M7 = [0, 4, 7, 11], D7 = [0, 4, 7, 10], m7 = [0, 3, 7, 10];

        // LA RIVIERA — city pop. Le tour d'accords des annees quatre-vingt
        // japonaises : quatrieme degre majeur sept, dominante, tierce mineure,
        // retour a la tonique mineure. Tempo pose, batterie qui ne pousse
        // jamais, basse bavarde — c'est elle qui fait avancer le morceau, pas
        // la grosse caisse. Rien ici ne doit donner envie de courir plus vite
        // que le soleil ne le permet.
        this.buf.riviera = this.buildRace({
          bpm: 112, prog: [[-4, M7], [-2, D7], [-5, m7], [0, m7]],
          kick: [0, 2, 2.5], snare: [1, 3], hats: 8,
          bassDiv: 8, bassPat: [0, 0, 7, 12, 0, 7, 10, 7], bassAmp: 0.38,
          padAmp: 0.105, arp: 8, arpAmp: 0.085, drone: 0, droneSemi: 0, stab: 0
        });

        // LA NUIT ETOILEE — le contraire. Lent, large, et un arpege deux fois
        // plus rapide que tout le reste : c'est le ciel qui tourne au-dessus
        // d'une piste ou rien ne presse. Le bourdon grave tient la nuit, la
        // caisse claire ne tombe qu'une fois par mesure, et l'harmonie
        // s'eloigne puis revient — la, fa, re, mi, comme on rentre chez soi.
        this.buf.nuit = this.buildRace({
          bpm: 84, prog: [[0, m7], [-4, M7], [5, m7], [7, D7]],
          kick: [0, 2], snare: [3], hats: 8,
          bassDiv: 4, bassPat: [0, 0, 7, 0], bassAmp: 0.36,
          padAmp: 0.115, arp: 16, arpAmp: 0.10, drone: 0.12, droneSemi: 0, stab: 0
        });
      }

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

      // Le depart : les deux commandes dans les deux langues, et le pistolet.
      //
      // Les quatre sont fabriquees ici, une fois pour toutes, et non a la
      // demande : le starter parle a l'instant ou il parle, et une seconde de
      // synthese au milieu d'un decompte se verrait. La langue peut changer
      // en cours de partie, on tient donc les deux pretes.
      this.buf.marques_fr = this.parole(COMMANDES.marques_fr);
      this.buf.pret_fr = this.parole(COMMANDES.pret_fr, { f0: 112 });
      this.buf.marques_en = this.parole(COMMANDES.marques_en);
      this.buf.pret_en = this.parole(COMMANDES.pret_en, { f0: 112 });
      this.buf.coup = this.pistolet();
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
    /* ---------------------------------------------------- la voix du stade */

    /**
     * UNE PHRASE, RENDUE ECHANTILLON PAR ECHANTILLON.
     *
     * Le detail de la fabrique — voir l'en-tete de FORMANTS pour le principe.
     *
     * La source change avec le phoneme : des impulsions glottales pour une
     * voyelle, du bruit pour une sifflante, les deux pour un « v », un silence
     * suivi d'une explosion pour un « k ». Les trois resonateurs, eux, ne
     * s'arretent jamais : leur etat traverse les phonemes, et leurs
     * frequences GLISSENT vers celles du suivant sur quarante
     * millisecondes. Sans cette glissade, on entend une suite de sons ; avec,
     * on entend quelqu'un parler.
     *
     * La sortie passe ensuite par un haut-parleur de stade : coupe dans les
     * graves, un peu saturee, et renvoyee deux fois par les tribunes.
     */
    parole(seq, opts) {
      const sr = this.ctx.sampleRate;
      const o = opts || {};
      const f0 = o.f0 || 104;
      const duree = seq.reduce((s, p) => s + p[1], 0);
      // La queue laisse la place aux renvois du stade.
      const d = this.ctx.createBuffer(1, ((duree + 0.5) * sr) | 0, sr);
      const ch = d.getChannelData(0);
      const n = ch.length;

      // Etat des trois resonateurs : deux echantillons chacun, plus les deux
      // derniers echantillons de la source, communs aux trois.
      const y1 = [0, 0, 0], y2 = [0, 0, 0];
      let x1 = 0, x2 = 0;
      // Le poids de chaque formant, une fois la source aplanie (voir la
      // pre-accentuation plus bas). Le deuxieme formant est celui qui porte la
      // voyelle : c'est lui qui separe un « a » d'un « o », et il ne doit pas
      // rester dix decibels sous le premier.
      const AMP = [1, 0.80, 0.50];
      const BW = [70, 110, 170];
      let phase = 0;                       // phase glottale, en periodes
      let pic = 0;                         // echantillons restants d'une impulsion
      const PIC = [1, 0.8, 0.35];          // sa forme, sur trois echantillons
      let seed = 22222;
      const bruit = () => {
        seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff;
        return seed / 0x3fffffff - 1;
      };

      let i0 = 0;
      let avant = FORMANTS._;
      for (let k = 0; k < seq.length; k++) {
        const nom = seq[k][0], dur = seq[k][1];
        const ici = FORMANTS[nom] || FORMANTS._;
        const src = ici[3];
        const len = Math.max(1, (dur * sr) | 0);
        const gliss = Math.min(len, (0.04 * sr) | 0);
        // Une occlusive, c'est d'abord une bouche fermee : le silence fait
        // autant pour l'entendre que l'explosion qui le suit.
        const fermeture = src === 'x' ? (len * 0.55) | 0 : 0;
        const att = Math.min((0.012 * sr) | 0, (len / 3) | 0);
        const rel = Math.min((0.025 * sr) | 0, (len / 3) | 0);
        // Les nasales sont sourdes : on elargit les bandes, le son s'etouffe.
        const large = src === 'n' ? 2.4 : 1;
        for (let i = 0; i < len; i++) {
          const idx = i0 + i; if (idx >= n) break;
          const g = gliss > 0 ? Math.min(1, i / gliss) : 1;
          // L'intonation : la voix du starter descend en fin de commande.
          const q = (i0 + i) / (duree * sr);
          const f = f0 * (1.06 - 0.16 * q);
          // La source.
          let x = 0;
          if (i >= fermeture) {
            const voise = src === 'v' || src === 'n' || src === 'z';
            if (voise) {
              // L'EXCITATION EST UNE IMPULSION PAR PERIODE, ET RIEN ENTRE DEUX.
              //
              // C'est la source de la synthese a formants depuis Klatt, et
              // elle a une propriete qu'aucune forme plus douce n'a : son
              // spectre est PLAT. Toutes les harmoniques sortent au meme
              // niveau, les trois resonateurs recoivent donc de quoi
              // travailler jusqu'a trois mille hertz, et ce sont eux — et eux
              // seuls — qui dessinent la voyelle.
              //
              // Une forme arrondie sonnerait plus humaine et ne dirait plus
              // rien : son energie retombe d'elle-meme avant le deuxieme
              // formant, celui qui separe justement un « a » d'un « o ». On
              // garde donc le grain un peu dur d'une voix de haut-parleur,
              // qui est de toute facon celle qu'on veut ici.
              phase += f / sr;
              if (phase >= 1) { phase -= 1; pic = 3; }
              if (pic > 0) { x += PIC[3 - pic]; pic--; }
              x *= src === 'n' ? 0.55 : 1;
            }
            if (src === 'z') x = x * 0.55 + bruit() * 0.45;
            if (src === 'f') x = bruit() * 0.9;
            if (src === 'x') {
              // L'explosion : tout est dans les dix premieres millisecondes.
              const e = (i - fermeture) / Math.max(1, len - fermeture);
              x = bruit() * Math.exp(-9 * e);
            }
          }
          // Les trois resonateurs, en parallele.
          //
          // Chacun recoit `x - x2`, c'est-a-dire la source privee de son
          // continu et de son extreme aigu. C'est ce qui rend le montage en
          // parallele utilisable : un resonateur ordinaire laisse passer les
          // graves presque autant qu'il amplifie sa propre frequence, et les
          // trois cumulaient donc leurs fuites — un ronflement grave qui
          // couvrait les deux formants du haut, c'est-a-dire tout ce qui
          // distingue un « a » d'un « o ».
          const xd = x - x2;
          let out = 0;
          for (let b = 0; b < 3; b++) {
            const F = avant[b] + (ici[b] - avant[b]) * g;
            const th = TAU * F / sr;
            const r = Math.exp(-Math.PI * BW[b] * large / sr);
            const a1 = 2 * r * Math.cos(th), a2 = -r * r;
            // Chaque branche est ramenee a un gain de UN a sa propre
            // frequence : sans cela, la formule favorise mecaniquement les
            // formants graves, et « pret » sort avec la couleur d'un « o ».
            const c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
            const den = Math.sqrt((1 - r * c2) * (1 - r * c2) + r * s2 * r * s2);
            const gain = (1 - r) * den / Math.max(1e-4, 2 * Math.sin(th));
            const v = gain * xd + a1 * y1[b] + a2 * y2[b];
            y2[b] = y1[b]; y1[b] = v;
            out += v * AMP[b];
          }
          x2 = x1; x1 = x;
          // L'enveloppe du phoneme : pas de clic au raccord.
          let env = 1;
          if (i < att) env *= i / att;
          if (i > len - rel) env *= (len - i) / rel;
          ch[idx] += out * env * (o.amp || 1);
        }
        i0 += len;
        avant = ici;
      }

      // Le haut-parleur du stade : rien sous deux cents hertz, rien au-dessus
      // de quatre mille cinq cents, et une legere saturation. Les trois font
      // la meme chose — ils enlevent a cette voix ce qu'elle a de trop propre,
      // et c'est ce qui la rend croyable.
      let bas = 0, haut = 0;
      const kb = TAU * 190 / sr, kh = TAU * 4500 / sr;
      for (let i = 0; i < n; i++) {
        bas += (ch[i] - bas) * kb;
        haut += (ch[i] - bas - haut) * kh;
        ch[i] = Math.tanh(1.5 * haut);
      }
      // Et les tribunes renvoient la voix, deux fois. L'ecriture en place fait
      // d'elle-meme une queue qui s'eteint : chaque renvoi renvoie a son tour.
      const r1 = (0.085 * sr) | 0, r2 = (0.17 * sr) | 0;
      for (let i = r1; i < n; i++) {
        ch[i] += 0.30 * ch[i - r1];
        if (i >= r2) ch[i] += 0.16 * ch[i - r2];
      }
      return this.norm(d);
    },

    /**
     * LE COUP DE PISTOLET.
     *
     * Trois choses en une : le claquement — du bruit qui s'eteint en un
     * dixieme de seconde —, le coup dans la poitrine — une sinusoide qui
     * plonge de cent cinquante a quarante hertz —, et le stade qui le renvoie
     * trois fois. C'est le troisieme qui fait le stade : un claquement sec et
     * seul, c'est une porte qui claque.
     */
    pistolet() {
      const sr = this.ctx.sampleRate;
      const d = this.ctx.createBuffer(1, (1.2 * sr) | 0, sr);
      const ch = d.getChannelData(0);
      let seed = 7777;
      const bruit = () => {
        seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff;
        return seed / 0x3fffffff - 1;
      };
      const nb = (0.14 * sr) | 0;
      for (let i = 0; i < nb; i++) {
        const q = i / nb;
        ch[i] += bruit() * Math.exp(-15 * q) * Math.min(1, i / 8);
      }
      let ph = 0;
      const nl = (0.24 * sr) | 0;
      for (let i = 0; i < nl; i++) {
        const q = i / nl;
        ph += (155 * Math.exp(-9 * q) + 44) / sr;
        ch[i] += 0.8 * Math.exp(-10 * q) * Math.sin(TAU * ph);
      }
      // Les renvois, de plus en plus flous : chacun est une moyenne du
      // precedent, ce qui emousse les aigus comme le fait une tribune.
      [[0.075, 0.38], [0.155, 0.22], [0.29, 0.13]].forEach(([t, a]) => {
        const dec = (t * sr) | 0;
        for (let i = dec + 2; i < ch.length; i++) {
          ch[i] += a * (ch[i - dec] + ch[i - dec - 1] + ch[i - dec - 2]) / 3;
        }
      });
      return this.norm(d);
    },

    /**
     * LE STARTER PARLE — ou tire.
     *
     * `quoi` vaut « marques », « pret » ou « feu ». La langue est celle du
     * jeu : un starter qui donnerait ses ordres dans une autre langue que
     * l'ecran serait un starter qu'on n'ecoute pas.
     *
     * Rend la duree de ce qui vient d'etre lance, en secondes — zero si le
     * son est coupe ou indisponible.
     */
    starter(quoi) {
      if (!this.ok || !this.on) return 0;
      const nom = quoi === 'feu' ? 'coup'
        : (quoi === 'pret' ? 'pret_' : 'marques_') + (N.index() ? 'en' : 'fr');
      const b = this.buf[nom]; if (!b) return 0;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      g.gain.value = quoi === 'feu' ? 0.95 : 0.85;
      s.buffer = b; s.connect(g); g.connect(this.sortie); s.start();
      // La musique passe derriere le temps de l'annonce. Une consigne de
      // depart qu'on n'entend pas est une consigne qui n'existe pas — et sur
      // un telephone, le stade couvre tout.
      if (quoi !== 'feu') this.retrait(b.duration);
      return b.duration;
    },

    /** Met la musique en retrait, et la remonte toute seule. */
    retrait(duree) {
      if (!this.gain || !this.ctx) return;
      try {
        const t0 = this.ctx.currentTime;
        this.gain.gain.cancelScheduledValues(t0);
        this.gain.gain.setTargetAtTime(0.10, t0, 0.04);
        this.gain.gain.setTargetAtTime(0.34, t0 + Math.max(0.1, duree), 0.15);
      } catch (e) { /* le navigateur refuse : on parlera par-dessus */ }
    },

    // La musique de course se durcit a partir du championnat du monde.
    /**
     * Quelle musique pour quelle etape.
     *
     * LE STADE PASSE AVANT L'ECHELLE. Les quatre pistes `race0..3` disent un
     * RANG — la tension monte avec l'etape — et c'est juste tant qu'on gravit
     * le championnat. Un stade qui n'est pas un palier n'a rien a faire dans
     * cette suite : il porte sa musique dans son theme, et elle gagne.
     *
     * Le repli en fin de ligne repare un trou au passage : au-dela de la
     * sixieme etape, l'ancienne formule reclamait un `race4` qui n'existe pas,
     * et `music()` sortait sans rien jouer. Un stade hors serie se courait donc
     * en silence, sans que rien ne le signale.
     */
    raceTrack(level) {
      const lvl = LEVELS[level];
      const th = lvl && THEMES[lvl.theme];
      if (th && th.musique && this.buf[th.musique]) return th.musique;
      return 'race' + (level <= 2 ? 0 : Math.min(3, level - 2));
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
      s.buffer = b; s.connect(g); g.connect(this.sortie); s.start();
    },
    sfx(name) {
      if (!this.ok || !this.on) return;
      const b = this.buf[name]; if (!b) return;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain(); g.gain.value = 0.55;
      s.buffer = b; s.connect(g); g.connect(this.sortie); s.start();
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
    /** Le depart en cours : sa longueur, sa tenue, et ce que le starter a
     *  deja dit. Voir poserLeDepart. */
    depart: null,
    // Le nom de celui a qui renvoyer le code apres une defaite. Nul le reste
    // du temps : c'est ce qui distingue une course ordinaire d'une revanche.
    revanche: null,
    // L'identifiant du duel qu'on venge, et le chrono qu'il faut battre pour
    // que le defi reparte tout seul — voir /challenge, cote worker. Sans le
    // second, `revanche` ne suffirait pas a savoir si le nouveau chrono a
    // suffi : c'est la regle « on ne derange pas avec un temps moins bon ».
    revancheId: null, revancheMs: 0,
    /** L'athlete mis en avant pendant la presentation, ou nul. */
    presente: null,
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
    // Course en direct : l'adversaire court en meme temps que nous.
    liveOn: false, liveNom: '', liveFin: null, liveResultat: null,
    // Les points du duel, quand la salle les annonce : ils arrivent apres le
    // resultat et se lisent sur l'ecran de fin.
    liveDuel: null,
    // Un adversaire par identifiant de joueur. Vide en duel a deux ancienne
    // maniere, remplie des qu'on court a plusieurs.
    lives: null,
    scores: {}, runs: { '100': [], '200': [], '400': [] }, furthest: { '100': 0, '200': 0, '400': 0 },
    keyLeft: false, touches: {}, acc: 0, last: 0, fps: 60,

    // Joueur du TOP 500 que l'on est en train de defier : retenu le temps de
    // la course, pour adresser le defi a la bonne personne a l'arrivee.
    challengeTarget: null,
    // Nom vise par un defi lance depuis le classement des duels, quand le
    // TOP 500 ne l'a pas retrouve : le code partira, mais a personne.
    defiSansCible: null,

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
    // La graine du defi en cours, ou null. Voir startShotRace.
    graineCourse: null,
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

  /**
   * Est-on arrive SOUS le niveau qu'il faut pour gagner ici ?
   *
   * On compare le chrono de la course precedente aux cotes de l'etape ou l'on
   * entre. Le seuil est la borne HAUTE de la fourchette, c'est-a-dire le plus
   * lent des adversaires : y etre superieur, c'est n'avoir battu aucun d'eux
   * au tour precedent — un « en dessous du niveau » qui ne se discute pas. La
   * borne basse aurait demande de battre le meilleur, ce qu'aucun plateau
   * anterieur ne permet vraiment de prouver.
   *
   * On ne compare que des courses COMPARABLES. En championnat la question ne
   * se pose pas : les six etapes se courent sur la meme distance. En one shot,
   * l'epreuve precedente peut etre un 400 m avant un 100 m, et un chrono de
   * 43 s dirait n'importe quoi — on renonce alors, et le stade reste celui de
   * la finale.
   */
  function enDessousDuNiveau(R, idx) {
    const s = G.runSplits;
    if (!s || !s.length) return false;
    if (G.mode === 'oneshot' && G.shotRaces[G.shotIdx - 1] !== G.raceKey) return false;
    const precedent = s[s.length - 1];
    const bornes = R.ranges && R.ranges[idx];
    if (precedent == null || !bornes) return false;
    return precedent > bornes[1];
  }

  // --- mise en place d'une course ------------------------------------
  /* ----------------------------------------------------------- le depart */

  /**
   * LA LONGUEUR DU DEPART N'EST PLUS FIXE.
   *
   * Trois secondes, toujours les memes, c'est un metronome : au bout de deux
   * courses on ne part plus sur le signal mais sur le rythme, et le temps de
   * reaction ne mesure plus rien du tout. Un starter, lui, ne dit jamais quand
   * il va tirer — c'est meme toute sa fonction. Entre trois et dix secondes
   * separent donc « a vos marques » du coup de pistolet, et la seule facon de
   * bien partir redevient d'attendre vraiment.
   *
   * Le tirage penche vers les departs courts. Dix secondes existent, et c'est
   * parce qu'elles sont rares qu'elles sont redoutables : une attente qui
   * arriverait une fois sur deux ne serait plus une surprise, seulement une
   * lenteur.
   */
  const DEPART_MIN = 3, DEPART_MAX = 10;
  /** Ce que le starter TIENT, entre « pret » et le coup. */
  const TENUE_MIN = 1.2, TENUE_MAX = 3.0;
  /** Et ce qu'il laisse pour se placer, entre les marques et « pret ». */
  const MARQUES_MIN = 1.5;

  /** Une longueur de depart, tiree au sort. */
  function tirerLeDepart() {
    return DEPART_MIN + (DEPART_MAX - DEPART_MIN) * Math.pow(Math.random(), 1.5);
  }

  /**
   * Un tirage reproductible a partir d'un nombre.
   *
   * Mulberry32, comme `K.alea`, mais sans etat : semer le hasard du jeu pour
   * une histoire de depart rejouerait le meme plateau d'adversaires a la
   * course suivante.
   */
  function tirageDe(graine) {
    let t = ((graine >>> 0) + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * POSE LE DEPART : ou tombent les deux commandes, et le coup.
   *
   * `secondes` est le temps qui reste jusqu'au pistolet. Seul, il est tire au
   * sort ici meme. En direct et en relais, c'est la SALLE qui l'annonce et il
   * n'est pas negociable : le coup doit tomber a la meme milliseconde sur tous
   * les telephones, sinon ce n'est plus la meme course.
   *
   * `graine` rend la tenue reproductible. Sans elle, deux joueurs de la meme
   * course entendraient « pret » a deux instants differents — le pistolet
   * serait bien commun, mais l'un aurait ete prevenu plus tot que l'autre. Les
   * salles passent donc la date du depart, qui est la meme partout.
   *
   * LE DECOMPTE NE CHANGE PAS DE FORME. `countT` monte toujours jusqu'a 3, et
   * 3 reste le coup de pistolet ; c'est son POINT DE DEPART qui bouge. Tout ce
   * qui lit ce nombre ailleurs — la presentation suspendue a -99, le tableau
   * de course, la camera — continue de le lire comme avant.
   */
  function poserLeDepart(secondes, graine) {
    G.depart = dessinerLeDepart(secondes, graine);
    G.countT = 3 - Math.max(0, Number(secondes) || 0);
    return G.depart;
  }

  /**
   * Le dessin d'un depart, sans le poser : sa longueur et sa tenue.
   *
   * Le tutoriel s'en sert pour faire repeter le vrai depart sans toucher a
   * l'etat du jeu — c'est un exercice, pas une course.
   */
  function dessinerLeDepart(secondes, graine) {
    const d = Math.max(0, Number(secondes) || 0);
    // La sequence tient dans ses bornes : un starter n'appelle pas les marques
    // vingt secondes avant de tirer, et il ne tire pas non plus dans la foulee
    // de son annonce.
    const seq = clamp(d, DEPART_MIN, DEPART_MAX);
    const r = graine == null ? Math.random() : tirageDe(graine);
    const haut = Math.min(TENUE_MAX, Math.max(0.6, seq - MARQUES_MIN));
    const bas = Math.min(TENUE_MIN, haut);
    return { duree: seq, tenue: bas + r * (haut - bas), dit: 0 };
  }

  /**
   * LE STARTER, D'UNE IMAGE A L'AUTRE.
   *
   * La boucle l'appelle a chaque tour pendant le decompte ; il dit ce qu'il a
   * a dire quand l'heure est venue, et se tait le reste du temps. Rend 1 ou 2
   * quand il vient de parler, pour qui voudrait s'en servir.
   */
  function starterParle() {
    const d = G.depart;
    if (!d) return 0;
    if (d.dit < 1 && G.countT >= 3 - d.duree) {
      d.dit = 1; Audio_.starter('marques'); return 1;
    }
    if (d.dit < 2 && G.countT >= 3 - d.tenue) {
      d.dit = 2; Audio_.starter('pret'); return 2;
    }
    return 0;
  }

  /**
   * LE COUP DE PISTOLET.
   *
   * Le son, l'eclair du canon, la secousse. L'eclair n'est pas un ornement :
   * un telephone tenu a bout de bras dans le bruit, et c'est l'oeil qui part
   * en premier — comme sur une piste, ou le juge de depart leve son pistolet
   * bien en vue.
   */
  function coupDePistolet() {
    Audio_.starter('feu');
    G.flash = 0.45; G.shake = 0.4;
    if (G.depart) G.depart.dit = 3;
  }

  function buildLevel(idx) {
    // Un index hors du tableau ne doit pas faire tomber le jeu, et le cas
    // n'est pas theorique : les stades hors serie n'existent que sur le canal
    // de test, et un defi enregistre la-bas porte son index avec lui. Ouvert
    // dans la version publique, cet index designerait un stade absent — on
    // court alors au stade olympique plutot que sur un ecran noir.
    if (!LEVELS[idx]) idx = OLYMPIC;
    G.levelIdx = idx;
    const lvl = LEVELS[idx], R = G.race;
    // Deux decors pour une meme etape : lequel se decide en arrivant, sur le
    // chrono de la course precedente (voir enDessousDuNiveau).
    if (lvl.stades) {
      lvl.theme = enDessousDuNiveau(R, idx) ? lvl.stades.enDessous : lvl.stades.aNiveau;
    }
    // Un stade hors serie porte son propre plateau : les `ranges` d'une
    // epreuve sont alignees sur les six etapes du championnat, et il n'en est
    // pas une.
    const [lo, hi] = lvl.plateau ? lvl.plateau[R.key] : R.ranges[idx];
    G.track = new Track(R);
    G.runners = [];
    const pl = new Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed,
      best: R.best, total: G.track.total });
    G.player = pl; G.runners.push(pl);
    let best = 1e9;
    const names = idx === OLYMPIC ? olympicNames() : lvl.names;
    names.forEach((n, i) => {
      // Seme pendant un defi : c'est CE tirage qui decide du plateau — qui
      // court a cote de toi, et en combien. Le laisser au hasard rendrait deux
      // defis « identiques » incomparables.
      const t = lo + K.alea() * (hi - lo);
      const lane = i < 3 ? i : i + 1;
      const r = new Runner(n, lane, { target: t, maxSpeed: R.maxSpeed,
        total: G.track.total, pool: lvl.pool });
      if (t < best) { best = t; G.champion = n; G.championTime = t; }
      G.runners.push(r);
    });
    G.parts = [];
    G.elapsed = 0; G.shake = 0; G.flash = 0;
    // Le depart de CETTE course : sa longueur, et l'heure de ses deux
    // commandes. Le direct et le relais le reposeront sur l'heure annoncee par
    // leur salle — voir liveDepart.
    poserLeDepart(tirerLeDepart());
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
    // La revanche ne concerne qu'une course : de retour a l'accueil, le nom
    // de celui a qui renvoyer le code n'a plus rien a designer.
    G.revanche = null; G.revancheId = null; G.revancheMs = 0;
    G.presente = null;
    G.paused = false;
    G.falseOut = false;
    G.liveOn = false; G.liveNom = ''; G.liveFin = null; G.liveResultat = null;
    G.liveDuel = null;
    G.lives = null;
    G.challengeTarget = null;
    G.defiSansCible = null;
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
    // On retient de quoi refaire EXACTEMENT cette course. Rejouer en
    // reconstruisant les options a la main donnerait une course qui ressemble
    // a la premiere : meme distance, mais plus de fantome, ou un plateau par
    // defaut. Le joueur croirait rejouer et courrait autre chose.
    G.shotOpts = opts;
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
    // LA GRAINE SE REPOSE A CHAQUE COURSE, ET C'EST INDISPENSABLE.
    //
    // Un defi se joue autant de fois qu'on veut, et les tentatives doivent se
    // courir sur LE MEME plateau — sinon « seule la meilleure compte » revient
    // a garder le tirage le plus chanceux. Semer une seule fois au depart ne
    // suffit pas : la course consomme le tirage, et la deuxieme tentative
    // repartirait de la ou la premiere s'est arretee, avec d'autres
    // adversaires.
    //
    // `graineCourse` est posee par le jeu quand il entre dans un defi, et
    // retiree quand il en sort. Hors defi elle vaut null, et le tirage reste
    // celui du systeme.
    if (G.graineCourse != null) K.semer(G.graineCourse); else K.desemer();
    buildLevel(G.shotLevel);
    armGhost();
    // pas de cinematique de presentation : le one-shot va droit au but
    queueCuts([], 'count');
  }
  /**
   * RECOMMENCER : lancer une course de plus, tout de suite.
   *
   * Ce n'est pas rejouer la precedente, et la nuance porte tout le reste. La
   * course qui vient de finir garde son chrono ; s'il etait parti dans un
   * duel, il y reste. On en commence simplement une autre, sur les memes
   * epreuves et au meme plateau — ce que le joueur faisait jusqu'ici en
   * repassant par l'accueil, le menu et le mode, soit quatre ecrans pour
   * refaire dix secondes de course.
   *
   * ON REPART SEUL, ET C'EST VOULU. Le defi auquel on repondait est joue,
   * l'adversaire en direct est parti, la revanche est consommee : les
   * rembarquer ferait croire qu'on recourt la meme rencontre. Seule la cible
   * d'un defi survit, parce qu'elle est une intention et non un resultat —
   * qui visait quelqu'un au TOP 500 avant un faux depart le vise encore.
   *
   * Le detour par les options d'origine n'aurait pas convenu ici : pour une
   * course en direct elles ne passent meme pas par startOneShot, et l'on
   * relancerait une salle qui n'existe plus.
   */
  function recommencer() {
    if (G.mode !== 'oneshot' || !G.shotRaces || !G.shotRaces.length) return false;
    G.liveOn = false; G.liveResultat = null; G.liveNom = null; G.liveDuel = null;
    // La revanche est consommee ici comme partout ailleurs sur ce chemin :
    // RECOMMENCER part sur une course neuve, pas sur une nouvelle tentative
    // de la meme revanche — pour ca, c'est le bouton dedie qui relance
    // startOneShot en laissant G.revancheId intact.
    G.revanche = null; G.revancheId = null; G.revancheMs = 0; G.defiSansCible = null;
    startOneShot(G.shotRaces, { levelIdx: G.shotLevel });
    return true;
  }

  // Faux depart eliminatoire. Reserve au one-shot et au defi : partir avant le
  // signal met fin a la course, comme sur une vraie piste.
  //
  // Ce qui suit depend de qui court. Seul, on peut la reprendre — voir
  // game/reprise. Engage dans un duel, non : le faux depart y est une defaite,
  // pour celui qui recoit le defi comme pour celui qui le renvoie. Les
  // epreuves restantes comptent pour abandon et le duel est perdu — c'est ce
  // que renvoie le vrai : true si l'on vient bien d'eliminer le joueur.
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

  /**
   * Course en direct. On emprunte toute la plomberie du one-shot — chronos,
   * splits, entree au TOP 500, absence de reprise — et on remplace seulement
   * l'adversaire : au lieu d'une trace enregistree, quelqu'un qui court
   * maintenant, a l'autre bout d'une WebSocket.
   *
   * Le depart n'est pas « dans trois secondes » mais « a telle date ». Le
   * decompte est donc cale sur ce que la salle a annonce, converti en temps
   * de jeu : les deux joueurs voient le meme 3-2-1 et partent ensemble, quelle
   * que soit leur latence.
   *
   * @param opts.sansOrdinateur ne garder sur la piste que les vrais partants —
   *   c'est ce que veut la course en direct. Le relais, qui passe par ici
   *   aussi, garde son plateau : une portion courue seule contre le chrono n'a
   *   sinon plus personne autour.
   */
  function startLive(races, opts) {
    opts = opts || {};
    G.mode = 'oneshot';
    G.liveOn = true;
    G.liveNom = opts.adversaire || '';
    G.liveFin = null;
    G.liveResultat = null;
    // Une revanche ne rejoue pas les points de la course d'avant.
    G.liveDuel = null;
    G.shotRaces = races.slice();
    G.shotIdx = 0;
    G.shotLevel = opts.levelIdx == null ? 4 : opts.levelIdx;
    G.runTime = 0; G.runSplits = []; G.runRank = null;
    G.shotTraces = [];
    G.challenge = null;
    G.ghostSet = null; G.ghostSplits = []; G.ghostName = opts.adversaire || '';
    G.ghostTime = 0;
    G.raceKey = G.shotRaces[0];
    G.race = RACES[G.raceKey];
    buildLevel(G.shotLevel);
    // Un seul chemin, a deux comme a huit.
    //
    // Il y en a eu deux un moment, et cela s'est paye tout de suite : les
    // positions recues etaient routees par identifiant vers une table que le
    // chemin « a deux » ne remplissait pas. L'adversaire restait donc immobile
    // sur la ligne pendant toute la course — dans le mode dont c'est
    // precisement le seul interet.
    // Une liste vide n'est pas une liste absente. Un relais couru seul contre
    // le chrono annonce `autres: []` : lui armer l'adversaire du vieux chemin
    // posait sur la piste un coureur immobile etiquete ADVERSAIRE, contre qui
    // personne ne courait.
    if (opts.autres) armLives(opts.autres);
    else armLive(G.liveNom);
    // Une piste en direct ne se remplit pas : voir retirerOrdinateur.
    if (opts.sansOrdinateur) retirerOrdinateur();
    queueCuts([], 'count');
    // Le decompte reste suspendu tant que la salle n'a pas donne l'heure.
    G.countT = -99;
  }

  /**
   * Une portion de relais.
   *
   * On ne joue PAS un cent metres. La piste est celle du 4x100 — un tour
   * complet, quatre cents metres — et le relayeur y est pose a sa marque. Cela
   * n'a l'air que d'un detail de mise en place, et ce sont trois choses :
   *
   * - les distances n'ont plus a etre traduites. Le moteur compte en metres
   *   absolus depuis le depart, exactement comme la salle. Une portion posee
   *   sur une piste de cent metres obligeait a ajouter la marque a chaque
   *   position sortante, et le troisieme relayeur franchissait sa ligne
   *   d'arrivee a trois cent quinze metres du depart.
   * - le relayeur peut courir jusqu'a la zone suivante. Sur cent metres il
   *   terminait sa course avant d'avoir pu donner le temoin, et le jeu
   *   affichait un ecran de fin au milieu du relais.
   * - la zone de lancement existe. Un receveur ne part pas des blocs : il a
   *   trente metres pour se lancer, et c'est ce que le moteur note a la place
   *   de la poussee. Sans cela, le troisieme relayeur serait juge sur une
   *   phase qu'il a franchie depuis longtemps.
   *
   * @param opts.relais 1 a 4 — le rang de ce coureur.
   * @param opts.marque ou il est pose, en metres absolus.
   * @param opts.autres les temoins adverses : [{ id, nom, couloir }].
   */
  function startRelais(opts) {
    opts = opts || {};
    const relais = Math.max(1, Math.min(4, opts.relais || 1));
    const marque = Math.max(0, Number(opts.marque) || (relais - 1) * 100);
    startLive(['4x100'], {
      levelIdx: opts.levelIdx == null ? 4 : opts.levelIdx,
      adversaire: '', autres: opts.autres || [],
    });
    const p = G.player;
    p.legStart = marque;
    p.d = marque;
    // Le premier part des blocs, avec sa poussee et sa reaction ; les trois
    // autres partent lances, et c'est la zone que l'on note.
    if (relais > 1) {
      p.driveEnd = C.RELAY_LAUNCH;
      p.reaction = 0;
    }
    G.relaisRang = relais;
    return marque;
  }

  /**
   * Le temoin vient d'arriver dans mes mains.
   *
   * L'ecart entre les deux tapes est mesure par la salle, sur son horloge :
   * c'est la seule qui soit commune aux deux telephones. Il ne reste au jeu
   * qu'a en tirer les consequences physiques — la vitesse gardee, le plafond
   * et le freinage pour le reste du relais.
   */
  function recevoirTemoin(ecartMs) {
    if (!G.player) return null;
    return G.player.gradeHandoff((Number(ecartMs) || 0) / 1000);
  }

  /**
   * Cale le decompte sur le coup de pistolet annonce par la salle.
   *
   * `departA` est la date du coup en temps serveur — la meme pour tout le
   * monde. Elle ne sert pas a compter (chacun compte chez lui, sur l'ecart
   * qu'il a mesure) mais a tirer la tenue du starter : c'est ce qui fait que
   * les huit couloirs entendent « pret » au meme instant.
   */
  function liveDepart(dansMs, departA) {
    if (!G.liveOn) return;
    poserLeDepart(Math.max(0, dansMs) / 1000, departA == null ? null : departA);
    G.state = 'count';
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
    // Un fantome est l'adversaire aussi, meme s'il a couru hier : sur une piste
    // a huit, savoir lequel des coureurs porte le chrono a battre vaut autant
    // qu'en direct.
    r.repere = { couleur: CYAN, nom: G.ghostName || t('ghost_label') };
    const splits = G.ghostSplits || [];
    G.ghost = { trace, step: REC_STEP, runner: r, time: splits[G.shotIdx] || 0 };
    marquerJoueur();
  }
  // Avance le fantome a la position qu'avait l'adversaire au meme instant.
  /**
   * Ou en etait le fantome a l'instant t. Sert a dessiner sa trainee : sans
   * elle il glisse le long du couloir comme un decor, avec elle on lit d'un
   * coup d'oeil s'il accelere ou s'il rentre dans le mur.
   */
  /**
   * Adversaire en direct : meme couloir que le fantome, meme rendu, mais
   * pilote par le reseau au lieu d'une trace enregistree. Tout ce qui lit
   * G.ghost — la camera, le classement, l'ecart affiche — continue de
   * fonctionner sans rien savoir de la difference.
   */
  /**
   * Plusieurs adversaires en direct, un par couloir.
   *
   * `autres` vient de la salle : [{ id, nom, couloir }], sans le joueur local.
   *
   * Les coureurs reseau entrent dans G.runners a la place des adversaires
   * pilotes par la machine, plutot que de vivre a cote comme le fantome. C'est
   * ce qui fait que tout le rendu, les ombres, le classement en course et la
   * camera continuent de fonctionner sans savoir qu'ils viennent du reseau.
   *
   * G.ghost continue d'exister et pointe, a chaque image, sur l'adversaire le
   * plus proche du joueur. Tout ce qui le lit — la camera, l'ecart affiche —
   * montre donc celui contre qui on se bat vraiment a cet instant, ce qui a
   * plus de sens a huit que de suivre toujours le meme.
   */
  function armLives(autres) {
    G.ghost = null;
    G.lives = new Map();
    marquerJoueur();
    if (!autres || !autres.length) return;

    const monCouloir = G.player ? G.player.lane : 3;
    // Le joueur occupe toujours le meme couloir chez lui ; les adversaires se
    // repartissent sur les autres. On tient la liste de ce qui est pris, sinon
    // deux adversaires finissent superposes et l'un des deux devient invisible.
    const pris = new Set([monCouloir]);
    const suivantLibre = () => {
      for (let l = 1; l <= 8; l++) if (!pris.has(l)) return l;
      return monCouloir === 1 ? 2 : 1;   // piste pleine : cas theorique
    };

    autres.forEach((autre) => {
      // On respecte le couloir annonce par la salle quand il est libre : les
      // deux clients doivent placer les memes gens aux memes endroits, sans
      // quoi on ne se double pas au meme couloir.
      let lane = autre.couloir;
      if (!lane || lane < 1 || lane > 8 || pris.has(lane)) lane = suivantLibre();
      pris.add(lane);
      const idx = G.runners.findIndex(r => !r.isPlayer && r.lane === lane);
      if (idx >= 0) G.runners.splice(idx, 1);
      const r = new Runner(autre.nom || 'ADVERSAIRE', lane, {
        maxSpeed: G.race.maxSpeed, total: G.track.total, pool: LEVELS[G.levelIdx].pool
      });
      r.isGhost = true; r.isLive = true; r.d = 0; r.v = 0;
      r.repere = { couleur: couleurCouloir(lane), nom: autre.nom || '' };
      G.runners.push(r);
      G.lives.set(autre.id, { live: true, cible: 0, vEst: 0, depuis: 0, runner: r,
                              trace: [], step: REC_STEP, time: 0 });
    });
  }

  /**
   * Ne laisse sur la piste que ceux qui courent vraiment.
   *
   * `buildLevel` remplit toujours les sept couloirs voisins avec le plateau de
   * l'ordinateur, parce que c'est ce qu'il faut a une etape de campagne : une
   * finale olympique sans personne dans les couloirs d'a cote n'est pas une
   * finale. En direct, c'est l'inverse. Les gens presents dans la salle sont
   * la raison d'etre du mode ; poser six coureurs maison a cote d'un duel
   * revient a noyer l'adversaire au milieu de figurants qui, eux, ne risquent
   * rien. On ne sait plus qui regarder, et le classement d'arrivee melange
   * deux natures de coureurs.
   *
   * Un couloir vide se lit donc comme ce qu'il est : une place que personne
   * n'a prise. C'est aussi ce que dit le salon avant le depart.
   *
   * Le favori annonce disparait avec le plateau : il venait de ses chronos
   * vises, et le HUD n'a pas a afficher un nom a battre qui ne court pas.
   */
  function retirerOrdinateur() {
    // Le fantome vit hors de G.runners sur le chemin a un seul adversaire ; le
    // test le garde quand il y est, sur le chemin a plusieurs.
    const fantome = G.ghost ? G.ghost.runner : null;
    G.runners = G.runners.filter(r => r.isPlayer || r.isLive || r === fantome);
    G.champion = ''; G.championTime = 0;
  }

  /**
   * Le joueur porte son propre repere.
   *
   * Se retrouver soi-meme est la premiere chose qu'on cherche sur une piste a
   * huit, et le maillot ne suffit pas : la camera suit le joueur, mais elle
   * suit aussi ceux qui le doublent.
   */
  function marquerJoueur() {
    if (!G.player) return;
    G.player.repere = { couleur: couleurCouloir(G.player.lane), nom: t('you'), moi: true };
  }

  /** Position annoncee par un adversaire donne. */
  function liveDistDe(id, d) {
    // Le filet : si la table est vide, c'est qu'on est sur l'ancien chemin a
    // un seul adversaire. Mieux vaut le faire avancer que de laisser la course
    // se jouer contre une statue.
    const g = (G.lives && G.lives.get(id)) || (!G.lives || !G.lives.size ? G.ghost : null);
    if (!g || !g.live) return;
    const dt = Math.max(0.02, G.elapsed - g.depuis);
    if (d > g.cible) {
      g.vEst = Math.max(0, Math.min(15, (d - g.cible) / dt));
      g.cible = d;
      g.depuis = G.elapsed;
    }
  }

  function armLive(nom) {
    G.ghost = null;
    const lane = 4;
    const idx = G.runners.findIndex(r => !r.isPlayer && r.lane === lane);
    if (idx >= 0) G.runners.splice(idx, 1);
    const r = new Runner(nom || 'ADVERSAIRE', lane, {
      maxSpeed: G.race.maxSpeed, total: G.track.total, pool: LEVELS[G.levelIdx].pool
    });
    r.isGhost = true; r.d = 0; r.v = 0;
    // Un duel n'a qu'un adversaire, et c'est justement la ou le repere compte
    // le plus : sept coureurs de l'ordinateur l'entourent, tous pareils.
    r.repere = { couleur: couleurCouloir(lane), nom: nom || t('opponent') };
    G.ghost = { live: true, cible: 0, vEst: 0, depuis: 0, runner: r,
                trace: [], step: REC_STEP, time: 0 };
    marquerJoueur();
  }

  /** Derniere position connue de l'adversaire, telle qu'annoncee par lui. */
  function liveDist(d) {
    const g = G.ghost;
    if (!g || !g.live) return;
    const dt = Math.max(0.02, G.elapsed - g.depuis);
    if (d > g.cible) {
      g.vEst = Math.max(0, Math.min(15, (d - g.cible) / dt));
      g.cible = d;
      g.depuis = G.elapsed;
    }
  }

  function ghostDistAt(t) {
    const g = G.ghost;
    if (!g || g.live || t <= 0) return 0;
    const tr = g.trace, last = tr.length - 1;
    if (last < 0) return 0;
    const x = t / g.step;
    if (x >= last) return tr[last] / 10;
    const i0 = Math.max(0, Math.floor(x));
    const i1 = Math.min(last, i0 + 1);
    const f = Math.max(0, Math.min(1, x - i0));
    return (tr[i0] + (tr[i1] - tr[i0]) * f) / 10;
  }

  /**
   * Avance un adversaire en direct d'une image.
   *
   * Les positions arrivent par paquets, dix fois par seconde au mieux. Sauter
   * d'un paquet a l'autre ferait tressauter l'adversaire a chaque message : on
   * extrapole doucement depuis la derniere position connue et sa vitesse, puis
   * on glisse vers cette cible. Le resultat est une foulee continue, avec un
   * retard de quelques centiemes — invisible a l'oeil, alors qu'un saut de
   * quarante centimetres ne l'est pas.
   */
  function avancerLive(g, dt) {
    const r = g.runner;
    const vmax = G.race.maxSpeed * 1.15;
    // L'extrapolation ne va pas au-dela de ce qu'un coureur peut faire : quand
    // un paquet tarde, mieux vaut un adversaire legerement en retard qu'un
    // adversaire qui file a vingt metres par seconde puis s'arrete net au
    // paquet suivant.
    const age = Math.min(0.4, Math.max(0, G.elapsed - g.depuis));
    const vise = Math.min(g.cible + Math.min(g.vEst, vmax) * age,
                          g.cible + vmax * age);
    const avant = r.d;
    r.d += (vise - r.d) * Math.min(1, dt * 11);
    if (r.d < avant) r.d = avant;          // un adversaire ne recule jamais
    // La vitesse sert a animer la foulee et a chiffrer l'ecart : elle doit
    // etre lisse. Une difference brute d'une image a l'autre, avec des paquets
    // irreguliers, donne des pics qui font battre les jambes n'importe comment
    // et clignoter l'ecart affiche.
    const brut = dt > 0 ? (r.d - avant) / dt : r.v;
    r.v = r.v * 0.78 + Math.max(0, Math.min(vmax, brut)) * 0.22;
    r.stride += r.v * dt * (Math.PI / r.strideLength());
    r.drivePitch = r.pitchAt();
    if (!r.finished && r.d >= G.track.total) {
      r.finished = true; r.finishTime = g.time || G.elapsed;
    }
  }

  function stepGhost(dt) {
    // A plusieurs, chaque adversaire avance pour son compte, puis on designe
    // le plus proche comme « le » fantome : la camera et l'ecart affiche n'ont
    // rien a savoir de plus.
    if (G.lives && G.lives.size) {
      let meilleur = null, ecart = Infinity;
      const moi = G.player ? G.player.d : 0;
      for (const g of G.lives.values()) {
        avancerLive(g, dt);
        const e = Math.abs(g.runner.d - moi);
        if (e < ecart) { ecart = e; meilleur = g; }
      }
      G.ghost = meilleur;
      return;
    }
    const g = G.ghost;
    if (!g) return;
    const r = g.runner;
    // En direct, les positions arrivent par paquets, dix fois par seconde au
    // mieux. Sauter d'un paquet a l'autre ferait tressauter l'adversaire a
    // chaque message : on extrapole doucement depuis la derniere position
    // connue et sa vitesse, puis on glisse vers cette cible. Le resultat est
    // une foulee continue, avec un retard de quelques centiemes — invisible a
    // l'oeil, alors qu'un saut de 40 cm ne l'est pas.
    if (g.live) { avancerLive(g, dt); return; }
    const tr = g.trace;
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

  /**
   * La presentation des athletes, sur la piste.
   *
   * Le moteur est deja entre en course — decompte suspendu, tout le monde en
   * place dans son couloir — et cette fonction ne fait que trois choses : elle
   * amene la camera sur celui qu'on presente, elle lui fait lever les bras, et
   * elle laisse les autres tranquilles.
   *
   * Le salut n'est pas une animation nouvelle : c'est `celebrate`, deja utilise
   * par les cinematiques, qui melange la position des bras vers le haut. Un
   * geste que le jeu sait deja faire vaut mieux qu'un geste de plus a entretenir.
   */
  function presenterCoureur(r) {
    G.presente = r || null;
  }

  const CELEBRE_MONTEE = 2.6, CELEBRE_DESCENTE = 3.4;

  function stepPresentation(dt) {
    if (!G.track || !G.runners) return;
    // La camera glisse plus lentement que pendant la course : c'est un
    // travelling de presentation, pas une poursuite.
    const vise = G.presente || G.player;
    if (vise) {
      const p = G.track.pos(vise.d, vise.lane);
      const k = 1 - Math.exp(-3.4 * dt);
      G.camX += (p[0] - G.camX) * k;
      G.camY += (p[1] - G.camY) * k;
    }
    for (const r of G.runners) {
      const cible = r === G.presente ? 1 : 0;
      const vitesse = cible > (r.celebrate || 0) ? CELEBRE_MONTEE : CELEBRE_DESCENTE;
      const c = r.celebrate || 0;
      r.celebrate = c + Math.max(-vitesse * dt, Math.min(vitesse * dt, cible - c));
      // Un souffle dans la foulee : sans lui les athletes sont des statues, et
      // une piste de statues se voit immediatement.
      r.stride += dt * (r === G.presente ? 1.1 : 0.5);
      r.drivePitch = 0;
    }
  }

  /**
   * Les bras redescendent quand la presentation est finie.
   *
   * `celebrate` est monte a 1 sur l'athlete presente, et redescendu a 0 sur
   * les autres — mais uniquement DANS stepPresentation, qui cesse d'etre
   * appele au coup de pistolet. Le dernier presente gardait donc son salut
   * pendant toute la course : on courait les bras en l'air, sans que rien ne
   * puisse l'annuler avant le retour a l'accueil. C'etait d'autant plus
   * visible que le dernier presente est souvent le joueur lui-meme.
   *
   * On redescend au lieu de remettre a zero d'un coup : un salut qui se coupe
   * net a l'image du depart se voit autant que le salut bloque.
   */
  function finirLesSaluts(dt) {
    G.presente = null;
    if (!G.runners) return;
    for (const r of G.runners) {
      if (!r.celebrate) continue;
      r.celebrate = Math.max(0, r.celebrate - CELEBRE_DESCENTE * dt);
    }
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
  // Meme trace que band(), mais rempli d'un DEGRADE plutot que d'un aplat.
  //
  // Les affiches de Nagai ne sont pas faites que d'aplats, et c'est l'erreur
  // qu'on avait faite ici : le ciel, la mer et l'eau d'un bassin y fondent
  // d'un ton a l'autre, du profond vers le clair. C'est ce fondu, et lui seul,
  // qui donne la profondeur — sans ajouter un detail, sans texture, sans
  // ombre. Un aplat de mer ressemble a du papier bleu ; la meme bande avec
  // deux tons ressemble a de l'eau.
  //
  // Le degrade est calcule sur l'emprise REELLE de la bande a l'ecran, pas sur
  // la hauteur de l'ecran : la bande est oblique et sa position bouge avec la
  // camera, un degrade fixe se decalerait a chaque pas du coureur.
  function bandeDegradee(ctx, sm, rA, rB, colLoin, colPres, z) {
    if (sm.length < 2) return;
    const pts = [];
    let y0 = Infinity, y1 = -Infinity;
    const pousse = (p) => { pts.push(p); if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; };
    for (let i = 0; i < sm.length; i++) pousse(solid(...ptOf(sm[i], rA), z || 0));
    for (let i = sm.length - 1; i >= 0; i--) pousse(solid(...ptOf(sm[i], rB), z || 0));
    y0 = Math.max(y0, -400); y1 = Math.min(y1, G.VH + 400);
    if (!(y1 > y0)) { band(ctx, sm, rA, rB, rgb(colPres), z); return; }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgb(colLoin));
    g.addColorStop(1, rgb(colPres));
    ctx.fillStyle = g; ctx.fill();
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

  /* ------------------------------------------------------ le bord de mer
   *
   * Deux decors qui n'appartiennent qu'au stade de la Riviera : des nuages
   * plats dans le ciel, des palmiers derriere les tribunes. Ce sont les deux
   * signatures des affiches de Hiroshi Nagai, et la palette seule ne les
   * remplace pas — un ciel bleu sans nuage decoupe reste un ciel de jeu.
   *
   * Ils ne coutent rien aux trois autres stades : leur theme ne porte pas les
   * drapeaux, et personne ne les appelle.
   */

  // Le nuage de Nagai : un blanc franc, un contour decoupe, un dessous plat.
  // Ni degrade ni flou — c'est ce qui le distingue d'un nuage de jeu video,
  // et c'est aussi ce qui le rend gratuit a dessiner.
  function nuage(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - 1.85 * s, y);
    ctx.arc(x - 1.12 * s, y, 0.73 * s, Math.PI, 0);
    ctx.arc(x - 0.20 * s, y, 1.02 * s, Math.PI, 0);
    ctx.arc(x + 0.86 * s, y, 0.68 * s, Math.PI, 0);
    ctx.lineTo(x + 1.54 * s, y);
    ctx.closePath();
    // Blanc franc en haut, a peine bleute en bas : le nuage a une EPAISSEUR.
    // Le contour reste decoupe — c'est le remplissage qui fond, pas le bord,
    // et c'est toute la difference avec un nuage flou de jeu video.
    const gn = ctx.createLinearGradient(0, y - 1.05 * s, 0, y);
    gn.addColorStop(0, 'rgba(255,255,255,0.98)');
    gn.addColorStop(0.62, 'rgba(248,252,255,0.97)');
    gn.addColorStop(1, 'rgba(214,234,248,0.96)');
    ctx.fillStyle = gn;
    ctx.fill();
    // Le liseret du dessous, plus marque : il pose le nuage a plat dans le ciel.
    ctx.fillStyle = 'rgba(178,214,240,0.92)';
    ctx.fillRect(x - 1.85 * s, y - 0.07 * s, 3.39 * s, 0.07 * s);
  }

  // Position et taille de chaque nuage, en fractions de l'ecran : le ciel est
  // compose une fois pour toutes, il ne se retire pas au hasard a chaque
  // course. Une image dont les nuages sautent d'une partie a l'autre n'est
  // plus une affiche, c'est un fond d'ecran.
  const CLOUDS = [
    [0.05, 0.14, 1.25], [0.23, 0.52, 0.78], [0.37, 0.05, 1.00],
    [0.54, 0.34, 1.50], [0.71, 0.12, 0.72], [0.85, 0.46, 1.05],
    [0.96, 0.22, 0.88]
  ];
  function drawClouds(ctx) {
    // Ils suivent la camera au douzieme, et derivent lentement d'eux-memes.
    // Fixes a l'ecran, ils auraient l'air peints sur la vitre ; poses dans le
    // monde a l'echelle du reste, ils passeraient devant les gradins.
    const anchor = ground(0, 0);
    const derive = performance.now() / 1000 * 4.2;
    const s0 = ui() * 25;
    const large = G.VW + s0 * 8;
    const bande = G.VH * (G.portrait ? 0.30 : 0.26);
    for (let i = 0; i < CLOUDS.length; i++) {
      const c = CLOUDS[i], s = s0 * c[2];
      let x = (c[0] * large - anchor[0] * 0.085 - derive) % large;
      if (x < 0) x += large;
      nuage(ctx, x - s0 * 4, 14 + c[1] * bande, s);
    }
  }

  // La mer, au-dela de la pelouse : quelques rides blanches, plates et
  // courtes, posees dans le monde pour qu'elles defilent avec la piste. Chez
  // Nagai l'eau n'a pas de matiere — c'est un aplat, et deux traits blancs
  // suffisent a dire que c'est la mer et non un mur bleu.
  function vaguesDuLointain(ctx, sm, rMer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2 * ui();
    ctx.lineCap = 'round';
    const stp = G.track.curved ? 8 : 1;
    for (let i = 0; i + 1 < sm.length; i += stp) {
      const graine = ((i + 5) * 2654435761) >>> 0;
      for (let k = 0; k < 2; k++) {
        const rr = rMer + 0.8 + ((graine >>> (k * 5)) % 3);
        const a = ground(...ptOf(sm[i], rr));
        if (a[0] < -30 || a[0] > G.VW + 30 || a[1] < -30 || a[1] > G.VH + 30) continue;
        const b = ground(...ptOf(sm[i + 1], rr + 0.2));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        ctx.lineTo(a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5);
        ctx.stroke();
      }
    }
  }

  // L'AVION DE NAGAI.
  //
  // Il y en a un dans presque chaque affiche, minuscule, tres haut, et c'est
  // lui qui donne l'echelle du ciel : sans lui le bleu n'a pas de fond. Il
  // traverse l'ecran en trois quarts de minute, assez lentement pour qu'on le
  // remarque sans le suivre.
  //
  // Il vit en coordonnees d'ecran, comme les nuages, et passe DERRIERE eux :
  // un avion peint par-dessus un nuage se colle a la vitre.
  function drawAvion(ctx, th) {
    const u = ui(), t = performance.now() / 1000;
    const L = G.VW + 300 * u;
    const x = ((t % 44) / 44) * L - 150 * u;
    const y = G.VH * (G.portrait ? 0.085 : 0.075) + Math.sin(t * 0.18) * 5 * u;
    const e = 13 * u;                    // demi-longueur du fuselage

    // la trainee, qui s'efface vers l'arriere
    const g = ctx.createLinearGradient(x - 12 * e, y, x - e, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.strokeStyle = g; ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 12 * e, y + 0.6 * u); ctx.lineTo(x - e, y); ctx.stroke();

    // ailes en fleche, empennage, fuselage : des aplats, pas un modele
    ctx.fillStyle = 'rgba(246,248,252,0.96)';
    ctx.beginPath();
    ctx.moveTo(x + 0.15 * e, y);
    ctx.lineTo(x - 0.75 * e, y - 0.95 * e);
    ctx.lineTo(x - 0.30 * e, y - 0.05 * e);
    ctx.lineTo(x - 0.75 * e, y + 0.95 * e);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 0.80 * e, y);
    ctx.lineTo(x - 1.15 * e, y - 0.45 * e);
    ctx.lineTo(x - 0.95 * e, y);
    ctx.lineTo(x - 1.15 * e, y + 0.45 * e);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 0.35 * e, y, e, 0.24 * e, 0, 0, TAU);
    ctx.fill();
    // le liseret : la seule couleur de l'appareil, prise a l'accent du stade
    ctx.strokeStyle = rgb(th.accent); ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(x - 1.1 * e, y - 0.05 * e); ctx.lineTo(x + 0.6 * e, y - 0.05 * e);
    ctx.stroke();
  }

  // Une palme : un fuseau courbe qui se souleve puis retombe. Le rayon `w`
  // ecarte les deux bords perpendiculairement a la palme, sinon les palmes
  // horizontales seraient larges et les verticales plates.
  function palme(c, x, y, ang, len, w, col) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const px = -dy * w, py = dx * w;
    const mx = x + dx * len * 0.5, my = y + dy * len * 0.5 - len * 0.14;
    const ex = x + dx * len, ey = y + dy * len + len * 0.40;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(mx + px, my + py, ex, ey);
    c.quadraticCurveTo(mx - px, my - py, x, y);
    c.closePath();
    c.fillStyle = col; c.fill();
  }

  // Le palmier est CUIT UNE FOIS dans une tuile, comme le public des gradins,
  // puis repose par drawImage. Le dessiner trait par trait a chaque image —
  // un tronc courbe, ses anneaux, neuf palmes, trois noix — reviendrait a
  // repayer une trentaine de chemins remplis par arbre et par image, pour un
  // objet qui ne bouge pas. Trois inclinaisons suffisent a ce que l'alignement
  // ne se voie pas.
  // Le palmier eventail (washingtonia), tel qu'il est peint : une boule de
  // palmes raides en etoile, chacune pointue, et un stipe epais couvert de
  // vieilles palmes. Rien ne retombe — c'est exactement l'inverse du cocotier,
  // et c'est ce contraste qui fait une vraie palmeraie.
  function eventailTile(th) {
    const W = 460, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const axe = W / 2, by = H, ty = H * 0.40;

    // le stipe : epais, droit, et hirsute — des encoches courtes plutot que
    // les anneaux nets du cocotier
    const b0 = 26, b1 = 20;
    c.beginPath();
    c.moveTo(axe - b0, by);
    c.quadraticCurveTo(axe - b1 * 1.2, (by + ty) / 2, axe - b1, ty);
    c.lineTo(axe + b1, ty);
    c.quadraticCurveTo(axe + b1 * 1.2, (by + ty) / 2, axe + b0, by);
    c.closePath();
    c.fillStyle = rgb(th.palmTrunk, 0.92); c.fill();
    c.save(); c.clip();
    c.strokeStyle = rgb(th.palmTrunk, 0.66); c.lineWidth = 4;
    for (let i = 1; i < 26; i++) {
      const y = ty + (by - ty) * i / 26;
      const d = 10 + (i % 3) * 7;
      c.beginPath(); c.moveTo(axe - d, y); c.lineTo(axe + d, y - 2); c.stroke();
    }
    c.restore();

    // la couronne : des palmes en etoile, plus longues sur les cotes, a peine
    // tombantes en bas. Chacune est une lame pointue, pas un fuseau.
    const n = 17;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 1.06 + (i + 0.5) / n * Math.PI * 1.12;
      const haute = Math.sin(a) < -0.35;
      const len = 150 + ((i * 53) % 34);
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = -dy, py = dx;
      const tombe = haute ? 0 : len * 0.16;
      const w = 17 + (i % 3) * 4;
      c.beginPath();
      c.moveTo(axe, ty + 6);
      c.quadraticCurveTo(axe + dx * len * 0.55 + px * w, ty + dy * len * 0.55 + py * w,
                         axe + dx * len, ty + dy * len + tombe);
      c.quadraticCurveTo(axe + dx * len * 0.55 - px * w, ty + dy * len * 0.55 - py * w,
                         axe, ty + 6);
      c.closePath();
      c.fillStyle = rgb(th.palmLeaf, haute ? 1.26 : 0.84);
      c.fill();
      // la nervure, qui fait la raideur de la palme
      c.strokeStyle = rgb(th.palmLeaf, 0.58); c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(axe, ty + 6);
      c.lineTo(axe + dx * len * 0.96, ty + dy * len * 0.96 + tombe * 0.9);
      c.stroke();
    }
    // le manchon de vieilles palmes, sous la couronne
    c.fillStyle = rgb(th.palmTrunk, 0.78);
    c.beginPath();
    c.moveTo(axe - 30, ty + 2);
    c.lineTo(axe + 30, ty + 2);
    c.lineTo(axe + 22, ty + 52);
    c.lineTo(axe - 22, ty + 52);
    c.closePath(); c.fill();

    return cv;
  }

  const PALM_W = 460, PALM_H = 512;
  const palmTiles = new Map();
  function palmTile(th, variante) {
    let tab = palmTiles.get(th);
    if (!tab) { tab = []; palmTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];
    // La troisieme variante n'est pas un cocotier mais un PALMIER EVENTAIL, et
    // c'est celui de la toile de reference : couronne ronde de palmes raides
    // qui rayonnent, tronc epais et hirsute. Les deux especes cohabitent chez
    // Nagai, et n'avoir que des cocotiers donnait une palmeraie trop molle.
    if (variante === 2) { tab[2] = eventailTile(th); return tab[2]; }

    const cv = document.createElement('canvas');
    cv.width = PALM_W; cv.height = PALM_H;
    const c = cv.getContext('2d');
    const bx = PALM_W / 2, by = PALM_H;
    const pente = (variante - 1) * 28;
    const tx = bx + pente, ty = PALM_H * 0.34;
    const kx = bx + pente * 0.12, ky = PALM_H * 0.64;

    // le stipe : deux bords quadratiques, du pied evase a la tete fine
    const b0 = 18, b1 = 9;
    c.beginPath();
    c.moveTo(bx - b0, by);
    c.quadraticCurveTo(kx - b1 * 1.7, ky, tx - b1, ty);
    c.lineTo(tx + b1, ty);
    c.quadraticCurveTo(kx + b1 * 1.7, ky, bx + b0, by);
    c.closePath();
    c.fillStyle = rgb(th.palmTrunk); c.fill();

    // les anneaux, dans le trace du stipe : c'est ce qui empeche le tronc de
    // n'etre qu'un ruban beige.
    c.save(); c.clip();
    c.strokeStyle = rgb(th.palmTrunk, 0.74); c.lineWidth = 3.5;
    for (let i = 1; i < 18; i++) {
      const t = i / 18, u = 1 - t;
      const px = u * u * bx + 2 * u * t * kx + t * t * tx;
      const py = u * u * by + 2 * u * t * ky + t * t * ty;
      c.beginPath(); c.moveTo(px - 22, py - 3); c.lineTo(px + 22, py + 3); c.stroke();
    }
    c.restore();

    // la couronne : neuf palmes en eventail, les hautes eclairees, les basses
    // dans l'ombre de la tete. On dessine celles qui partent vers le haut en
    // premier, pour que les retombantes passent devant.
    const feuilles = 9;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < feuilles; i++) {
        const a = -Math.PI + (i + 0.5) / feuilles * Math.PI;
        const haute = Math.sin(a) < -0.55;
        if ((pass === 0) !== haute) continue;
        const len = 152 + ((i * 37) % 30);
        palme(c, tx, ty, a, len, 25 + (i % 3) * 5,
              rgb(th.palmLeaf, haute ? 1.22 : 0.86));
      }
    }
    // la nervure, un ton plus sombre : la palme se lit alors en deux moities
    for (let i = 0; i < feuilles; i++) {
      const a = -Math.PI + (i + 0.5) / feuilles * Math.PI;
      const len = 152 + ((i * 37) % 30);
      c.strokeStyle = rgb(th.palmLeaf, 0.62); c.lineWidth = 3;
      c.beginPath(); c.moveTo(tx, ty);
      c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5,
                         ty + Math.sin(a) * len * 0.5 - len * 0.14,
                         tx + Math.cos(a) * len, ty + Math.sin(a) * len + len * 0.40);
      c.stroke();
    }
    // les noix, sous la tete
    c.fillStyle = rgb(th.palmTrunk, 0.72);
    for (const d of [[-13, 9], [5, 15], [16, 4]]) {
      c.beginPath(); c.arc(tx + d[0], ty + d[1], 9, 0, TAU); c.fill();
    }

    tab[variante] = cv;
    return cv;
  }

  // Les palmiers, plantes juste derriere les tribunes.
  //
  // La distance n'est pas decorative, elle decide si on les voit. La camera
  // colle au coureur et le cadre est etroit : passe une douzaine de metres au
  // dela du bord de piste, un objet sort du champ par le coin haut-droit et
  // n'y revient jamais. Plantes la, en revanche, leur tete depasse du toit des
  // gradins et traverse le haut de l'ecran pendant la course.
  // Le cypres de Van Gogh, cuit dans sa tuile comme le palmier.
  //
  // Ce n'est pas un cone : c'est une FLAMME. Le profil s'ouvre vite au-dessus
  // du pied, se referme en pointe, et les deux bords ondulent en se decalant
  // l'un par rapport a l'autre — c'est ce decalage qui fait la torsion, et la
  // torsion qui fait le cypres. Un triangle vert sombre n'aurait rien dit.
  const CYPRES_W = 150, CYPRES_H = 620;
  const cypresTiles = new Map();
  function cypresTile(th, variante) {
    let tab = cypresTiles.get(th);
    if (!tab) { tab = []; cypresTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];

    const cv = document.createElement('canvas');
    cv.width = CYPRES_W; cv.height = CYPRES_H;
    const c = cv.getContext('2d');
    const axe = CYPRES_W / 2, N = 32;
    const torsion = (t) => Math.sin(t * 3.1 + variante * 1.7) * CYPRES_W * 0.14;
    // Le profil fait tout. Pointe en haut, ventre au premier tiers, pied
    // etroit : c'est cette silhouette-la qu'on reconnait de loin. Un fuseau
    // regulier, large au milieu et arrondi aux deux bouts, donne un cocon.
    // L'ondulation est multipliee par le profil lui-meme, pour qu'elle
    // s'eteigne a la pointe au lieu d'y decouper des dents.
    const bord = (sens) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;                       // 0 au sommet, 1 au pied
        const prof = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.98);
        const large = Math.pow(prof, 0.78) * CYPRES_W * 0.40;
        const ond = Math.sin(t * 13 + variante * 2.2 + (sens > 0 ? 0 : 1.6))
                  * CYPRES_W * 0.07 * prof;
        pts.push([axe + torsion(t) + sens * (large + ond), 6 + t * (CYPRES_H - 6)]);
      }
      return pts;
    };
    const g = bord(-1), d = bord(1);
    c.beginPath();
    c.moveTo(g[0][0], g[0][1]);
    for (const q of g) c.lineTo(q[0], q[1]);
    for (let i = d.length - 1; i >= 0; i--) c.lineTo(d[i][0], d[i][1]);
    c.closePath();
    c.fillStyle = rgb(th.cypresSombre); c.fill();

    // Les coups de pinceau du dedans : ils montent en tournant, plus clairs
    // que la masse. Sans eux le cypres redevient une silhouette decoupee.
    c.save(); c.clip();
    c.lineCap = 'round';
    c.globalAlpha = 0.55;
    for (let k = 0; k < 30; k++) {
      const t0 = 0.04 + ((k * 7) % 15) / 15 * 0.93, cote = k % 2 ? -1 : 1;
      const y0 = 6 + t0 * (CYPRES_H - 6);
      const x0 = axe + torsion(t0) + cote * CYPRES_W * (0.06 + (k % 3) * 0.06);
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(x0 + cote * 16, y0 - 26, x0 - cote * 7, y0 - 48);
      c.strokeStyle = rgb(th.cypresClair, k % 3 ? 1.15 : 0.78);
      c.lineWidth = 2.4;
      c.stroke();
    }
    c.restore();

    tab[variante] = cv;
    return cv;
  }

  // LA HAIE FLEURIE.
  //
  // Sur la toile de reference, entre le mur du court et le ciel, court une
  // ligne de buissons ronds pointilles de petites fleurs blanches. C'est un
  // detail qu'on ne remarque qu'une fois enleve : sans elle, le decor se
  // reduit a trois aplats qui se touchent, et le stade a l'air decoupe aux
  // ciseaux. Avec elle, il y a quelque chose entre le sol et le ciel.
  const HAIE_W = 260, HAIE_H = 110;
  const haieTiles = new Map();
  function haieTile(th, variante) {
    let tab = haieTiles.get(th);
    if (!tab) { tab = []; haieTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];

    const cv = document.createElement('canvas');
    cv.width = HAIE_W; cv.height = HAIE_H;
    const c = cv.getContext('2d');
    const sol = HAIE_H;
    // des boules qui se chevauchent, deux tons de vert : la haie n'est jamais
    // une bande, c'est une suite de touffes
    for (let k = 0; k < 9; k++) {
      const g2 = ((k + variante * 7 + 3) * 2654435761) >>> 0;
      const x = 14 + k * 29 + (g2 % 9);
      const r = 26 + (g2 >>> 5) % 14;
      c.beginPath(); c.arc(x, sol - r * 0.55, r, 0, TAU);
      c.fillStyle = rgb(th.haieSombre || th.palmLeaf, k % 2 ? 1.0 : 0.78);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.90)';
    for (let k = 0; k < 26; k++) {
      const g2 = ((k + variante * 13 + 5) * 2246822519) >>> 0;
      const x = (g2 % (HAIE_W - 20)) + 10;
      const y = sol - 10 - ((g2 >>> 7) % 46);
      c.fillRect(x, y, 3.4, 3.4);
    }
    tab[variante] = cv;
    return cv;
  }

  function drawHaie(ctx, th, sm, rOut, horizon) {
    const stp = G.track.curved ? 6 : 1;
    for (let i = 0; i < sm.length; i += stp) {
      const graine = ((i + 23) * 2654435761) >>> 0;
      // Juste au-dela de la pelouse, et assez haute pour depasser du dernier
      // gradin : posee en deca, elle disparaissait entierement derriere le
      // public — les gradins sont traces apres elle.
      const r = rOut + horizon + 0.8;
      const h = 2.8 * scaleM();
      const tuile = haieTile(th, (graine >>> 9) % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(...ptOf(sm[i], r), 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  // L'IMMEUBLE BLANC, DE L'AUTRE COTE DE L'EAU.
  //
  // Apres la piscine et le palmier, c'est l'objet le plus reconnaissable de
  // Nagai : un bloc blanc a toit plat, des rangees de balcons, une face a
  // l'ombre franche, et pas un degrade dessus. Il n'a rien d'un batiment
  // realiste — c'est une architecture de decor, posee la pour que l'eau ait
  // une rive et le ciel une hauteur.
  //
  // Il se tient au-DELA de la mer, jamais devant : l'ordre de trace le met
  // derriere elle, et c'est ce qui fait la rive opposee.
  const IMM_W = 340, IMM_H = 260;
  const immTiles = new Map();
  function immeubleTile(th, variante) {
    let tab = immTiles.get(th);
    if (!tab) { tab = []; immTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];

    const cv = document.createElement('canvas');
    cv.width = IMM_W; cv.height = IMM_H;
    const c = cv.getContext('2d');
    const blanc = rgb(th.barrier), ombre = rgb(th.riser, 1.06);
    const sol = IMM_H;

    // Trois silhouettes : un long bloc bas, une tour, un bloc a redans. Ce
    // sont les trois qu'il peint, et trois suffisent a faire une station.
    const plans = [
      [[24, 118, 3], [150, 92, 2], [252, 66, 2]],
      [[30, 70, 2], [116, 168, 4], [230, 88, 3]],
      [[20, 96, 3], [128, 74, 2], [214, 132, 4]]
    ][variante % 3];

    for (const [x, h, etages] of plans) {
      const l = 78;
      // le corps, puis la face a l'ombre : deux aplats, pas un fondu
      c.fillStyle = blanc; c.fillRect(x, sol - h, l, h);
      c.fillStyle = ombre; c.fillRect(x + l - 18, sol - h, 18, h);
      // l'acrotere : le toit plat de Nagai a toujours ce petit rebord
      c.fillStyle = blanc; c.fillRect(x - 4, sol - h - 7, l + 8, 7);
      c.fillStyle = ombre; c.fillRect(x - 4, sol - h - 1, l + 8, 2);
      // les balcons : des fentes sombres barrees d'un garde-corps clair
      for (let e = 0; e < etages; e++) {
        const y = sol - h + 16 + e * (h - 22) / Math.max(1, etages);
        c.fillStyle = rgb(th.riser, 0.72);
        c.fillRect(x + 7, y, l - 32, 9);
        c.fillStyle = blanc;
        c.fillRect(x + 7, y + 7, l - 32, 3);
      }
    }
    // Le liseret de la station, a l'accent du stade : un seul trait de couleur
    // sur tout ce blanc, comme l'auvent d'un motel.
    c.fillStyle = rgb(th.accent);
    c.fillRect(plans[0][0] - 4, sol - 9, 96, 4);

    tab[variante] = cv;
    return cv;
  }

  function drawImmeubles(ctx, th, sm, rOut, horizon) {
    // Un echantillon sur un : la fenetre ou un objet de cette hauteur tient
    // dans le cadre ne fait que quelques metres de piste, et un immeuble tous
    // les vingt-quatre metres n'y tombait presque jamais. Le tiers saute
    // au-dessous, ce qui laisse des trous : une station balneaire, pas un mur.
    const stp = G.track.curved ? 11 : 1;
    for (let i = 0; i < sm.length; i += stp) {
      const graine = ((i + 17) * 2654435761) >>> 0;
      if ((graine >>> 3) % 3 === 0) continue;      // des trous : pas un mur
      // SUR LA RIVE, PAS DERRIERE L'EAU. Pose au-dela de la mer, l'immeuble
      // n'entrait dans le cadre que sur deux metres de piste — la hauteur
      // compte plus de deux fois la distance au sol a l'ecran, et tout ce qui
      // s'eloigne sort par le haut. Pose au bord, la mer passe DERRIERE lui
      // (elle est tracee avant), ce qui est de toute facon la vraie image :
      // l'hotel sur la plage, l'eau dans son dos.
      const r = rOut + horizon + 0.3 + (graine % 2);
      const h = (3.4 + ((graine >>> 5) % 3) * 0.55) * scaleM();
      const tuile = immeubleTile(th, (graine >>> 11) % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(...ptOf(sm[i], r), 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  // LE BORD DU BASSIN : PARASOL ET TRANSATS.
  //
  // Trois objets minuscules, et pourtant c'est eux qui disent qu'on est chez
  // lui plutot qu'au bord d'une piscine municipale. Le parasol a des quartiers
  // alternes, le transat une seule couleur : chez Nagai le mobilier n'a jamais
  // plus de deux tons.
  const MOB_W = 190, MOB_H = 200;
  const mobTiles = new Map();
  function mobilierTile(th, variante) {
    let tab = mobTiles.get(th);
    if (!tab) { tab = []; mobTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];

    const cv = document.createElement('canvas');
    cv.width = MOB_W; cv.height = MOB_H;
    const c = cv.getContext('2d');
    const sol = MOB_H, blanc = rgb(th.barrier);

    // le transat : une assise inclinee, deux pieds
    const transat = (x, col) => {
      c.strokeStyle = col; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, sol - 6); c.lineTo(x + 30, sol - 20);
      c.lineTo(x + 46, sol - 46); c.stroke();
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(x + 6, sol - 4); c.lineTo(x + 18, sol - 22); c.stroke();
      c.beginPath(); c.moveTo(x + 34, sol - 4); c.lineTo(x + 40, sol - 24); c.stroke();
    };
    if (variante === 2) {
      // le parasol : un mat, une toile a quartiers alternes
      const px = 96, py = sol - 118;
      c.strokeStyle = blanc; c.lineWidth = 5;
      c.beginPath(); c.moveTo(px, sol - 6); c.lineTo(px, py); c.stroke();
      for (let k = 0; k < 8; k++) {
        c.beginPath();
        c.moveTo(px, py - 6);
        c.arc(px, py - 6, 56, Math.PI + k * Math.PI / 8, Math.PI + (k + 1) * Math.PI / 8);
        c.closePath();
        c.fillStyle = k % 2 ? blanc : rgb(th.accent);
        c.fill();
      }
      transat(20, rgb(th.accent));
    } else if (variante === 1) {
      transat(30, blanc); transat(96, rgb(th.accent));
    } else {
      transat(46, rgb(th.eau, 0.9)); transat(112, blanc);
    }

    tab[variante] = cv;
    return cv;
  }

  // Le mobilier vit sur la margelle, entre le bassin et la piste, et seulement
  // le long du bassin : des transats en pleine pelouse, cent metres plus loin,
  // ne voudraient rien dire.
  function drawMobilier(ctx, th, rIn) {
    const T = G.track;
    const at = (m, r) => T.curved ? T.posAtR(m, r) : [m, r];
    const r = rIn - PISCINE.dedans0 + 1.1;
    for (let k = 0; k < 4; k++) {
      const m = PISCINE.m0 + 2 + k * ((PISCINE.m1 - PISCINE.m0 - 4) / 3);
      const q = at(m, r);
      if (!q) continue;
      const h = 2.9 * scaleM();
      const tuile = mobilierTile(th, k % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(q[0], q[1], 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  // LE VILLAGE SOUS LES ETOILES.
  //
  // Le dernier morceau de la toile, et le plus facile a oublier : sous le ciel
  // qui tourne, Van Gogh a peint un village endormi, ses fenetres allumees, et
  // un clocher qui monte plus haut que les toits. Sans lui la nuit n'a pas de
  // sol — les tourbillons flottent au-dessus de rien.
  //
  // Il est pose sur la bande de lointain, juste derriere les tribunes : assez
  // loin pour etre un decor, assez pres pour que ses fenetres se voient.
  const VILLAGE_W = 300, VILLAGE_H = 200;
  const villageTiles = new Map();
  function villageTile(th, variante) {
    let tab = villageTiles.get(th);
    if (!tab) { tab = []; villageTiles.set(th, tab); }
    if (tab[variante]) return tab[variante];

    const cv = document.createElement('canvas');
    cv.width = VILLAGE_W; cv.height = VILLAGE_H;
    const c = cv.getContext('2d');
    const sol = VILLAGE_H;
    const sombre = rgb(th.villageSombre || [14, 26, 58]);
    const feu = 'rgba(250,214,110,0.92)';

    // une maison : un bloc, un toit en bache, deux fenetres allumees
    const maison = (x, l, h, fenetres) => {
      c.fillStyle = sombre;
      c.fillRect(x, sol - h, l, h);
      c.beginPath();
      c.moveTo(x - 5, sol - h);
      c.lineTo(x + l / 2, sol - h - l * 0.42);
      c.lineTo(x + l + 5, sol - h);
      c.closePath(); c.fill();
      c.fillStyle = feu;
      for (let i = 0; i < fenetres; i++) {
        c.fillRect(x + 7 + i * 15, sol - h + 11, 8, 9);
      }
    };
    // l'eglise : la meme chose, plus un clocher qui depasse tout
    const eglise = (x) => {
      const l = 42, h = 54;
      maison(x, l, h, 2);
      c.fillStyle = sombre;
      c.fillRect(x + l * 0.34, sol - h - 46, 16, 50);
      c.beginPath();
      c.moveTo(x + l * 0.34 - 5, sol - h - 46);
      c.lineTo(x + l * 0.34 + 8, sol - h - 84);
      c.lineTo(x + l * 0.34 + 21, sol - h - 46);
      c.closePath(); c.fill();
      c.fillStyle = feu;
      c.fillRect(x + l * 0.34 + 5, sol - h - 34, 6, 8);
    };

    if (variante === 0) { eglise(120); maison(30, 52, 40, 3); maison(200, 60, 34, 3); }
    else if (variante === 1) { maison(24, 58, 38, 3); maison(110, 46, 46, 2); maison(190, 70, 32, 4); }
    else { maison(40, 64, 34, 4); maison(130, 50, 44, 2); maison(206, 54, 38, 3); }

    tab[variante] = cv;
    return cv;
  }

  // Le village, pose sur la bande de lointain. Il est trace AVANT les
  // tribunes : elles doivent lui passer devant, sinon les maisons flottent
  // au-dessus du public.
  function drawVillage(ctx, th, sm, rOut, horizon) {
    // Un hameau tous les douze metres : la fenetre de vue est etroite (une
    // vingtaine de metres de piste), et un village espace de quarante metres
    // n'etait dans le cadre qu'une fois sur trois.
    const stp = G.track.curved ? 12 : 1;
    for (let i = 0; i < sm.length; i += stp) {
      const graine = ((i + 13) * 2654435761) >>> 0;
      // Bas et pres : la hauteur compte plus de deux fois la distance au sol
      // a l'ecran, et un village de six metres pose neuf metres plus loin sort
      // par le haut du cadre — on n'en voyait que les fenetres allumees.
      const r = rOut + horizon + 0.5 + (graine % 2);
      const h = (3.2 + ((graine >>> 5) % 3) * 0.45) * scaleM();
      const tuile = villageTile(th, (graine >>> 11) % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(...ptOf(sm[i], r), 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  // Quel arbre pousse dans quel stade, et de quelle taille. Les hauteurs sont
  // en metres : un cypres depasse un palmier, et les deux rangees ne font pas
  // la meme taille — celle du dedans reste plus basse pour ne pas manger
  // l'ecran, puisqu'elle est beaucoup plus pres de la camera.
  // `pas` espace la rangee : a 1 un arbre par echantillon utile, a 2 un sur
  // deux. La palmeraie de la Riviera etait trop dense — une haie plutot qu'un
  // decor — et se compte donc par deux.
  const ARBRE = {
    palmier: { tuile: palmTile,   dehors: [6.2, 0.55], dedans: [5.6, 0.50], pas: 2 },
    cypres:  { tuile: cypresTile, dehors: [8.6, 0.70], dedans: [7.2, 0.60], pas: 1 }
  };

  function drawArbres(ctx, th, sm, rOut) {
    const A = ARBRE[th.arbres];
    if (!A) return;
    // Le pas se compte en ECHANTILLONS, et ceux-ci ne mesurent pas la meme
    // longueur partout : 1,2 m dans le virage, 12 m en ligne droite (voir
    // samples()). Un pas unique donnerait des arbres tous les vingt metres
    // d'un cote et un seul de l'autre — un cent metres n'a qu'une douzaine
    // d'echantillons en tout.
    const stp = (G.track.curved ? 10 : 1) * A.pas;
    // Ils tiennent DANS la pelouse, quelle que soit sa largeur : plantes plus
    // loin que l'horizon du stade, ils pousseraient dans la mer.
    const large = (th.horizon || 46) - 2;
    for (let i = 0; i < sm.length; i += stp) {
      const graine = ((i + 7) * 2654435761) >>> 0;
      const r = rOut + Math.min(9, large - 2) + (graine % Math.max(1, Math.min(5, large - 7)));
      const h = (A.dehors[0] + ((graine >>> 5) % 5) * A.dehors[1]) * scaleM();
      const tuile = A.tuile(th, (graine >>> 11) % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(...ptOf(sm[i], r), 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  // L'ombre portee d'un arbre : longue, dure, toujours dans la meme
  // direction. Chez Nagai l'ombre est un aplat, jamais un degrade, et c'est
  // elle qui pose l'objet au sol — un palmier sans ombre flotte au-dessus de
  // la pelouse. Elle donne aussi l'heure : longue, elle dit un soleil bas.
  function ombreArbre(ctx, x, y, h) {
    ctx.fillStyle = 'rgba(10,52,64,0.24)';
    ctx.beginPath();
    ctx.ellipse(x - h * 0.30, y + h * 0.03, h * 0.33, h * 0.07, -0.30, 0, TAU);
    ctx.fill();
  }

  // LA RANGEE DE PALMIERS DU DEDANS, ET POURQUOI ELLE EXISTE.
  //
  // Ceux de derriere les tribunes ne se voient qu'en paysage ou sur grand
  // ecran : le cadre du jeu s'ouvre vers l'INTERIEUR de la piste, jamais vers
  // l'exterieur — mesure faite, un objet pose au-dela d'une douzaine de metres
  // du bord sort par le coin haut-droit et n'y revient plus. Or un stade de
  // Nagai sans palmier visible n'est plus qu'une piste corail. On en plante
  // donc une seconde rangee dans la pelouse interieure, la ou le joueur les a
  // reellement sous les yeux pendant qu'il court.
  //
  // Ils sont traces APRES la piste, et ce n'est pas un detail : ce qui se
  // trouve en deca du couloir 1 est PLUS PRES de la camera que la piste (la
  // profondeur croit avec la distance au centre), donc doit la recouvrir.
  // Traces avant, ils se faisaient repeindre par les couloirs des que leur
  // tete montait assez haut.
  function drawArbresDedans(ctx, th, sm, rIn) {
    const A0 = ARBRE[th.arbres];
    if (!A0) return;
    const stp = (G.track.curved ? 12 : 1) * A0.pas;
    for (let i = 0; i < sm.length; i += stp) {
      const graine = ((i + 3) * 2246822519) >>> 0;
      // Entre la piste et le bassin, jamais dedans : le bassin commence a
      // sept metres du bord (voir PISCINE), et un palmier plante au milieu de
      // l'eau se remarque tout de suite.
      //
      // LA LIMITE ASSUMEE : les coureurs, eux, sont traces apres tout le
      // decor, donc un coureur des premiers couloirs passe DEVANT la palme
      // quand elle deborde sur la piste. Trier les arbres avec les huit
      // athletes couterait un tri global a chaque image pour rattraper une
      // demi-seconde de recouvrement — on prefere l'arbre visible.
      const r = rIn - 4 - (graine % 3);
      const A = ARBRE[th.arbres];
      if (!A) return;
      const h = (A.dedans[0] + ((graine >>> 5) % 4) * A.dedans[1]) * scaleM();
      const tuile = A.tuile(th, (graine >>> 11) % 3);
      const w = h * (tuile.width / tuile.height);
      const p = solid(...ptOf(sm[i], r), 0);
      if (p[0] < -w || p[0] > G.VW + w || p[1] < -h || p[1] > G.VH + h) continue;
      ombreArbre(ctx, p[0], p[1], h);
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - h, w, h);
    }
  }

  /* -------------------------------------------------------- la piscine
   *
   * L'objet de Nagai, et le clin d'oeil du stade. Un rectangle d'eau, sa
   * margelle blanche, trois rides plates, un plongeoir : aucun degrade nulle
   * part. Chez lui l'eau est un aplat turquoise raye de blanc, et c'est
   * precisement cette absence de matiere qui la rend reconnaissable d'un coup
   * d'oeil — une eau texturee ferait un moteur de jeu, pas une affiche.
   *
   * Elle vit dans la pelouse interieure pour la meme raison que les palmiers
   * du dedans : c'est le seul cote que le cadre montre. Etant plate, elle ne
   * recouvre jamais la piste, et peut donc rester tracee avec la pelouse.
   */
  const PISCINE = { m0: 38, m1: 62, dedans0: 7, dedans1: 16 };
  function drawPiscine(ctx, th, rIn) {
    const T = G.track;
    const at = (m, r) => T.curved ? T.posAtR(m, r) : [m, r];
    const r0 = rIn - PISCINE.dedans1, r1 = rIn - PISCINE.dedans0;

    // Le bassin suit la piste : sur un tour, un rectangle a quatre coins
    // couperait la courbe en biais. On decoupe donc les deux longs cotes.
    const contour = (marge) => {
      const pts = [], N = 8;
      const a0 = PISCINE.m0 - marge, a1 = PISCINE.m1 + marge;
      for (let i = 0; i <= N; i++) {
        const q = at(a0 + (a1 - a0) * i / N, r0 - marge);
        if (q) pts.push(ground(q[0], q[1]));
      }
      for (let i = N; i >= 0; i--) {
        const q = at(a0 + (a1 - a0) * i / N, r1 + marge);
        if (q) pts.push(ground(q[0], q[1]));
      }
      return pts;
    };
    const remplir = (pts, col) => {
      if (pts.length < 3) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    };

    const eau = contour(0);
    if (!eau.length) return;
    // Hors champ : on ne paie ni la margelle ni les rides.
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const q of eau) {
      if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0];
      if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1];
    }
    if (maxx < -40 || minx > G.VW + 40 || maxy < -40 || miny > G.VH + 40) return;

    remplir(contour(1.7), rgb(th.barrier));
    // L'eau fond du fond vers le bord, comme chez lui : le turquoise n'est
    // jamais le meme d'un bout a l'autre du bassin.
    if (th.eauFond && eau.length > 2) {
      let y0 = Infinity, y1 = -Infinity;
      for (const q of eau) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
      ctx.beginPath(); ctx.moveTo(eau[0][0], eau[0][1]);
      for (let i = 1; i < eau.length; i++) ctx.lineTo(eau[i][0], eau[i][1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgb(th.eauFond)); g.addColorStop(1, rgb(th.eau));
      ctx.fillStyle = g; ctx.fill();
    } else {
      remplir(eau, rgb(th.eau));
    }

    // Les rides : trois traits blancs poses a plat, pas une texture.
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 2.2 * ui(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const rr = r0 + (r1 - r0) * (0.26 + k * 0.24);
      const a = at(PISCINE.m0 + 4 + k * 2.4, rr), b = at(PISCINE.m0 + 12.5 + k * 2.4, rr);
      if (!a || !b) continue;
      const pa = ground(a[0], a[1]), pb = ground(b[0], b[1]);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }

    // Le plongeoir : une planche blanche en porte-a-faux, a un metre au-dessus
    // de l'eau. Elle est basse — assez pour se lire en volume, pas assez pour
    // aller mordre sur les couloirs quand elle monte a l'ecran.
    const rm = (r0 + r1) / 2, z = 1.15;
    const coins = [[PISCINE.m1 + 1.2, rm - 0.6], [PISCINE.m1 + 1.2, rm + 0.6],
                   [PISCINE.m1 - 4.2, rm + 0.6], [PISCINE.m1 - 4.2, rm - 0.6]];
    const proj = coins.map(c => { const q = at(c[0], c[1]); return q ? solid(q[0], q[1], z) : null; });
    if (proj.every(Boolean)) {
      // le pied, puis la planche
      const pied = at(PISCINE.m1 + 0.9, rm);
      if (pied) {
        const bas = ground(pied[0], pied[1]), haut = solid(pied[0], pied[1], z);
        ctx.strokeStyle = rgb(th.barrier, 0.82);
        ctx.lineWidth = 4 * ui();
        ctx.beginPath(); ctx.moveTo(bas[0], bas[1]); ctx.lineTo(haut[0], haut[1]); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(proj[0][0], proj[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(proj[i][0], proj[i][1]);
      ctx.closePath(); ctx.fillStyle = rgb(th.barrier); ctx.fill();
    }
  }

  /* ---------------------------------------------------- la nuit etoilee
   *
   * Trois gestes, et c'est tout ce qui separe une nuit de Van Gogh d'une nuit
   * de jeu video : le ciel TOURNE, les astres portent un halo qui mord sur le
   * bleu, et la matiere se voit — le coup de pinceau reste lisible partout,
   * jusque dans l'herbe. Rien de tout cela n'est une texture : ce sont des
   * traits, traces un par un, comme ils l'ont ete sur la toile.
   */

  // Les tourbillons. Quatre spirales qui se repondent, et de longues coulees
  // entre elles. Elles tournent tres lentement sur elles-memes : le ciel de ce
  // tableau n'est pas un decor pose derriere, c'est ce qui bouge le plus.
  const SPIRALES = [
    [0.14, 0.34, 0.21, 1], [0.42, 0.15, 0.14, -1],
    [0.70, 0.36, 0.25, 1], [0.92, 0.13, 0.12, -1]
  ];
  function drawTourbillons(ctx) {
    const anchor = ground(0, 0);
    const t = performance.now() / 1000;
    const w = G.VW, h = G.VH * (G.portrait ? 0.30 : 0.26);
    const dx = -anchor[0] * 0.07, L = w * 1.4;
    const enroule = (x) => ((x % L) + L) % L - w * 0.2;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = (0.07 + i * 0.15) * h;
      ctx.beginPath();
      for (let x = -30; x <= w + 30; x += 22) {
        const yy = y + Math.sin((x - dx) / 84 + i * 1.7) * 8 * ui();
        x === -30 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = i % 2 ? 'rgba(126,170,228,0.22)' : 'rgba(74,116,190,0.30)';
      ctx.lineWidth = 2.4 * ui();
      ctx.stroke();
    }
    for (let n = 0; n < SPIRALES.length; n++) {
      const sp = SPIRALES[n];
      const cx = enroule(sp[0] * w + dx), cy = sp[1] * h;
      const R = sp[2] * Math.min(w, h * 2.4), sens = sp[3];
      for (let k = 0; k < 5; k++) {
        const r = R * (0.30 + k * 0.18);
        const a0 = sens * (t * 0.05 + k * 0.62 + n * 1.3);
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + sens * 2.2, sens < 0);
        ctx.strokeStyle = k % 2 ? 'rgba(158,196,244,0.30)' : 'rgba(238,226,150,0.20)';
        ctx.lineWidth = (2.8 - k * 0.32) * ui();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // La lune et les grosses etoiles. Ce ne sont pas des points : chez Van Gogh
  // l'astre est un disque entoure d'un halo qui deborde largement sur le ciel,
  // et c'est le halo qui fait la lumiere, pas le disque.
  // Onze, comme sur la toile — Van Gogh en a peint onze autour de sa lune, et
  // c'est leur NOMBRE qui fait la nuit : trois etoiles font un ciel degage,
  // onze font une nuit qui bouge.
  const ASTRES = [
    [0.05, 0.16, 1.00], [0.13, 0.05, 0.55], [0.21, 0.28, 0.72],
    [0.31, 0.11, 0.88], [0.39, 0.33, 0.50], [0.48, 0.07, 0.95],
    [0.57, 0.24, 0.62], [0.66, 0.13, 0.78], [0.79, 0.30, 0.58],
    [0.88, 0.09, 1.00], [0.95, 0.22, 0.66]
  ];
  function drawAstres(ctx) {
    const anchor = ground(0, 0);
    // Une bande BASSE, et c'est mesure : au-dela du quart superieur, les
    // gradins et la pelouse reprennent la main et l'astre disparait derriere
    // eux. La lune et les onze etoiles se tiennent donc toutes dans le ciel
    // reellement visible pendant la course.
    const w = G.VW, h = G.VH * (G.portrait ? 0.22 : 0.19);
    const dx = -anchor[0] * 0.07, L = w * 1.4;
    const enroule = (x) => ((x % L) + L) % L - w * 0.2;
    // L'ASTRE DE VAN GOGH N'EST PAS UN POINT FLOU.
    //
    // C'est un noyau clair cerne d'ANNEAUX concentriques, poses au pinceau
    // l'un apres l'autre — du jaune au bleu pale, de plus en plus larges et de
    // plus en plus effaces. Un degrade radial donne une lampe de jeu video, et
    // c'est exactement ce qu'on avait ; les anneaux donnent la toile. Le
    // dernier anneau est volontairement le plus large et le plus pale : c'est
    // lui qui fait mordre l'astre sur le bleu au lieu de s'y poser.
    //
    // Une legere ovalisation et un decalage par astre evitent la cible de
    // flechettes : chez lui aucun cercle n'est parfait.
    const astre = (x, y, r, chaud) => {
      const u = ui();
      // le voile, tres pale, qui empeche les anneaux de flotter dans le vide
      const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
      g.addColorStop(0, chaud ? 'rgba(250,224,140,0.30)' : 'rgba(226,236,255,0.22)');
      g.addColorStop(1, 'rgba(226,236,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, TAU); ctx.fill();
      // les anneaux, du plus large au plus serre
      for (let k = 4; k >= 1; k--) {
        const rr = r * (0.72 + k * 0.62);
        const chaudK = k <= 2;
        ctx.beginPath();
        ctx.ellipse(x + (k % 2 ? 0.5 : -0.5) * u, y, rr, rr * 0.94, 0.3, 0, TAU);
        ctx.strokeStyle = chaudK
          ? 'rgba(250,220,124,' + (0.40 - k * 0.055).toFixed(2) + ')'
          : 'rgba(186,214,250,' + (0.34 - k * 0.05).toFixed(2) + ')';
        ctx.lineWidth = (1.4 + k * 0.9) * u;
        ctx.stroke();
      }
      // le noyau : petit, franc, sans transparence
      ctx.fillStyle = chaud ? 'rgba(255,246,206,0.99)' : 'rgba(255,252,232,0.99)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    };

    for (const e of ASTRES) {
      astre(enroule(e[0] * w + dx), e[1] * h, e[2] * 8.5 * ui(), false);
    }

    // La lune : les memes anneaux, en plus large et en plus chaud, et un
    // croissant a la place du noyau. Deux arcs, celui du dedans trace a
    // l'envers — un disque troue serait plus simple, mais il faudrait effacer,
    // et on ne peut pas effacer un ciel deja peint.
    const mx = enroule(0.74 * w + dx), my = 0.16 * h, mr = 21 * ui();
    astre(mx, my, mr * 0.34, true);
    for (let k = 5; k >= 1; k--) {
      ctx.beginPath();
      ctx.ellipse(mx, my, mr * (1 + k * 0.42), mr * (1 + k * 0.42) * 0.95, 0.2, 0, TAU);
      ctx.strokeStyle = 'rgba(250,214,116,' + (0.30 - k * 0.045).toFixed(2) + ')';
      ctx.lineWidth = (1.6 + k * 1.1) * ui();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,244,190,0.99)';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0.62, Math.PI * 2 - 0.62);
    ctx.arc(mx + mr * 0.62, my, mr * 0.92, Math.PI * 2 - 0.95, 0.95, true);
    ctx.closePath(); ctx.fill();
  }

  // LE COUP DE PINCEAU DANS L'HERBE.
  //
  // Les autres stades cassent l'aplat de la pelouse avec un grain pointilliste
  // — de petits carres plus clairs ou plus sombres. Van Gogh ne pointille pas,
  // il tire des traits, et ces traits suivent une direction. La pelouse reprend
  // donc le geste : de courts arcs orientes le long de la piste, poses dans le
  // monde (ils defilent avec elle), des DEUX cotes — celui du dedans est le
  // seul que le cadre montre vraiment pendant la course.
  function coupsDePinceau(ctx, th, rIn, rOut, horizon) {
    // On avance EN METRES, pas en echantillons. Les echantillons du decor sont
    // espaces de 1,2 m dans le virage et de 12 m en ligne droite : un trait
    // tire de l'un au suivant mesurerait douze metres de long sur une ligne
    // droite, ce qui n'est plus un coup de pinceau mais une rayure.
    const T = G.track;
    const at = (m, r) => T.curved ? T.posAtR(m, r) : [m, r];
    const fin = T.total + 20;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.1 * ui();
    for (let m = -10, n = 0; m < fin; m += 2.0, n++) {
      const graine = ((n + 11) * 2654435761) >>> 0;
      for (let k = 0; k < 3; k++) {
        const g2 = (graine >>> (k * 8)) & 0xffff;
        const rr = k < 2 ? rIn - 1.5 - (g2 % 14)
                         : rOut + 3 + (g2 % Math.max(6, (horizon || 46) - 4));
        const q0 = at(m + (g2 % 7) * 0.3, rr);
        if (!q0) continue;
        const a = ground(q0[0], q0[1]);
        if (a[0] < -30 || a[0] > G.VW + 30 || a[1] < -30 || a[1] > G.VH + 30) continue;
        const q1 = at(m + (g2 % 7) * 0.3 + 1.9, rr + 0.8);
        if (!q1) continue;
        const b = ground(q1[0], q1[1]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 6 * ui(), (a[1] + b[1]) / 2 - 5 * ui(),
                             b[0], b[1]);
        ctx.strokeStyle = rgb(th.grassEdge, g2 & 1 ? 1.28 : 0.76);
        ctx.stroke();
      }
    }
  }

  function drawWorld(ctx, th) {
    const T = G.track;
    // ciel
    const g = ctx.createLinearGradient(0, 0, 0, G.VH);
    g.addColorStop(0, rgb(th.skyTop)); g.addColorStop(1, rgb(th.skyBot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, G.VW, G.VH);
    // Les tourbillons passent SOUS les etoiles : ce sont eux le ciel, les
    // etoiles sont posees dessus.
    if (th.tourbillons) drawTourbillons(ctx);
    if (th.stars) {
      // La bande ou elles tombent depend du stade. Etalees sur les deux tiers
      // de la hauteur, comme au stade cosmos, les neuf dixiemes finissent
      // derriere la pelouse et les gradins : il n'en restait qu'une poignee au
      // ras du bord. Le ciel peint en montre une nappe entiere — on les
      // resserre donc dans la bande qui se voit vraiment.
      const bande = G.VH * (th.tourbillons ? 0.24 : 0.7);
      for (let i = 0; i < th.stars; i++) {
        const s = (i * 7919) % 9973;
        if (!th.tourbillons) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect((s * 13) % G.VW, (s * 7) % bande, 1.4, 1.4);
          continue;
        }
        // LE SEMIS, ET POURQUOI IL A FALLU LE REFAIRE. Les deux modulos
        // ci-dessus tirent x et y de la MEME suite : leurs restes marchent au
        // pas, et sur une bande large ca ne se voit pas. Resserree au quart
        // superieur, la correlation saute aux yeux — le ciel se rayait de
        // diagonales pointillees, ce qui est tout sauf une nuit peinte. On
        // brasse donc les bits avant de prendre les restes.
        let a = Math.imul(i + 1, 2654435761) >>> 0;
        a ^= a >>> 13; a = Math.imul(a, 1274126177) >>> 0; a ^= a >>> 16;
        let b2 = Math.imul((i + 7) ^ (a >>> 9), 2246822519) >>> 0;
        b2 ^= b2 >>> 15; b2 = Math.imul(b2, 3266489917) >>> 0; b2 ^= b2 >>> 11;
        // trois calibres : un ciel de Van Gogh n'a pas deux etoiles pareilles
        const t = (a % 7) / 7, c = 1.1 + t * 1.6;
        ctx.fillStyle = 'rgba(255,252,' + (208 + ((a % 3) * 16)) + ',' +
                        (0.52 + t * 0.45).toFixed(2) + ')';
        ctx.fillRect(a % G.VW, b2 % bande, c, c);
      }
    }
    if (th.tourbillons) drawAstres(ctx);
    if (th.avion) drawAvion(ctx, th);
    if (th.clouds) drawClouds(ctx);
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
    // LA PELOUSE EXTERIEURE, ET SURTOUT OU ELLE S'ARRETE.
    //
    // Par defaut elle court sur quarante-six metres. Si loin que le ciel du
    // stade ne se voit jamais en course : la camera colle au coureur, et
    // au-dessus des tribunes on trouve encore de l'herbe. Sans consequence
    // pour un stade ordinaire ; mais cela vide de leur sujet ceux dont le
    // ciel EST le sujet — les nuages et l'avion de la Riviera, les etoiles et
    // la lune de la Nuit etoilee. On les peignait pour personne.
    //
    // Un theme peut donc poser son horizon plus pres. La pelouse s'arrete
    // alors juste derriere les tribunes, une bande de lointain prend le
    // relais — la mer d'un cote, les collines de l'autre — et le ciel occupe
    // enfin le haut de l'image pendant toute la course.
    const horizon = th.horizon || 46;
    band(ctx, sm, rOut, rOut + horizon, rgb(th.grass));
    if (th.lointain) {
      // La bande de lointain est etroite A DESSEIN, et c'est mesure : la
      // hauteur a l'ecran compte plus de deux fois la distance au sol (voir
      // solid()), si bien que le toit des tribunes monte plus haut que le bord
      // de la pelouse. Le ciel visible commence donc au-dessus du toit, et il
      // n'en reste qu'un cinquieme d'image. Une mer de quatorze metres le
      // remplissait a elle seule ; a quatre, elle n'est plus que la couture
      // entre la pelouse et le ciel, et laisse la place aux nuages, a l'avion
      // et aux etoiles.
      if (th.lointainFond) {
        bandeDegradee(ctx, sm, rOut + horizon, rOut + horizon + 3.5,
                      th.lointainFond, th.lointain);
      } else {
        band(ctx, sm, rOut + horizon, rOut + horizon + 3.5, rgb(th.lointain));
      }
      if (th.vagues) vaguesDuLointain(ctx, sm, rOut + horizon);
      if (th.immeubles) drawImmeubles(ctx, th, sm, rOut, horizon);
      if (th.haie) drawHaie(ctx, th, sm, rOut, horizon);
      if (th.village) drawVillage(ctx, th, sm, rOut, horizon);
    }

    // Grain sur la pelouse exterieure : quelques touches plus claires/sombres
    // ancrees au monde (elles defilent avec la piste, pas avec l'ecran), pour
    // casser l'aplat plutot qu'une texture image plaquee sans rapport avec
    // notre perspective isometrique maison.
    if (th.pinceau) coupsDePinceau(ctx, th, rIn, rOut, horizon);
    else for (let i = 0; i < sm.length; i += 3) {
      const seed = i * 13;
      for (let k = 0; k < 3; k++) {
        const rr = rOut + 3 + ((seed + k * 17) % Math.max(6, horizon - 4));
        const p = ground(...ptOf(sm[i], rr));
        if (p[0] < -20 || p[0] > G.VW + 20 || p[1] < -20 || p[1] > G.VH + 20) continue;
        const light = (seed + k) % 2 === 0;
        ctx.fillStyle = rgb(th.grassEdge, light ? 1.35 : 0.85);
        ctx.fillRect(p[0], p[1], 1.6 * ui(), 1.6 * ui());
      }
    }

    // La piscine, posee dans la pelouse interieure (voir drawPiscine).
    if (th.piscine) drawPiscine(ctx, th, rIn);
    if (th.transats) drawMobilier(ctx, th, rIn);

    // Palmiers derriere les tribunes. Ils sont traces AVANT elles, et c'est
    // ce qui les met derriere : sans tampon de profondeur, l'ordre du trace
    // est le seul rangement dont on dispose. Leur pied disparait donc derriere
    // les gradins, comme il le ferait vraiment, et seule la tete depasse.
    if (th.arbres) drawArbres(ctx, th, sm, rOut);

    // Tribune simplifiee : muret, gradins, toiture. Elle est dessinee AVANT
    // la piste. Ces bandes sont posees en hauteur, et dans le virage leur
    // projection retombe sur la surface de course : peintes apres, elles
    // recouvraient la piste et les coureurs.
    // Le nombre de gradins est un reglage de THEME, pas une constante : une
    // tribune haute remplit le haut de l'image (voir la toiture, plus bas), et
    // un stade dont le sujet est le ciel ne peut pas se le permettre.
    const near = rOut + 1.6, tiers = th.gradins || 4, sr = 1.7, sz = 0.58;
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
    // LA TOITURE, ET POURQUOI DEUX STADES S'EN PASSENT.
    //
    // Elle est posee tres haut, et la hauteur compte plus de deux fois la
    // distance au sol a l'ecran (voir solid()) : le toit monte donc plus haut
    // que le bord lointain de la pelouse, et REMPLIT tout le haut de l'image
    // pendant la course. Mesure faite sur un cadre de telephone : au ras du
    // bord superieur, il n'y avait que du toit, d'un cote a l'autre.
    //
    // Aucune importance pour un stade couvert. Mais un stade dont le sujet est
    // le ciel — les nuages et l'avion de la Riviera, les etoiles de la Nuit
    // etoilee — n'a alors plus de ciel du tout. Ces deux-la ont donc des
    // gradins A CIEL OUVERT : le public s'arrete, et au-dessus commence
    // l'horizon. C'est aussi ce que sont vraiment un stade de bord de mer et
    // une reunion nocturne.
    if (th.toiture !== false) {
      band(ctx, sm, near + 0.3, near + tiers * sr + 1, rgb(th.roof),
           1.05 + tiers * sz + 2.4);
    }

    // Fanions a damier le long du toit des tribunes, pour donner plus de
    // "definition" au decor (accent visuel base sur un asset plutot que sur
    // un aplat de couleur uni). Sans toit, ils n'ont rien ou pendre.
    if (th.toiture !== false) {
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

    // Rayon d'une ligne peinte, ligne droite comprise.
    const lineR = (e) => T.curved ? T.edge(e) : e * C.LANE_W;

    // Un repere de couloir se trace RADIALEMENT, a l'angle de ce couloir :
    // court, perpendiculaire a SA propre trajectoire, d'une ligne peinte a
    // l'autre. C'est ce qui donne le depart en quinconce — sur un 400 m,
    // cinquante-trois metres separent le repere du couloir 1 de celui du
    // couloir 8, et les reperes voisins ne se rejoignent pas. Relier deux
    // points pris a la meme distance parcourue donnerait un trait de
    // travers : dans un virage ils ne sont pas sur le meme rayon.
    const tick = (m, e, col, w) => {
      const sa = T.markAt(m, e);
      const qa = ptOf(sa, lineR(e)), qb = ptOf(sa, lineR(e + 1));
      const a = ground(qa[0], qa[1]), b = ground(qb[0], qb[1]);
      if ((a[0] < -200 && b[0] < -200) || (a[0] > G.VW + 200 && b[0] > G.VW + 200)) return;
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };

    // Reperes au sol : uniquement le depart, la ligne des 100 m et celle
    // des 50 derniers metres (comme les marquages permanents d'une vraie
    // piste), plus la ligne d'arrivee dessinee plus bas. Pas de grille
    // tous les 10 m, ca n'existe pas sur une piste reelle.
    const markerSet = new Set([0]);
    if (T.total - 100 > 0) markerSet.add(T.total - 100);
    if (T.total - 50 > 0) markerSet.add(T.total - 50);
    const markers = Array.from(markerSet).sort((a, b) => a - b);

    for (const m of markers)
      for (let e = 0; e < C.LANE_COUNT; e++)
        tick(m, e, 'rgba(255,255,255,0.90)', m === 0 ? 3 : 1.6);

    // Zones de transmission du relais, en jaune comme sur une piste.
    // La zone fait trente metres depuis 2018 — l'ancienne zone de vingt
    // metres a absorbe la zone d'elan de dix — et porte une ligne de
    // repere a vingt metres de son debut. Le jeu pose le receveur au debut
    // de sa zone et lui donne trente metres pour se lancer : l'ensemble est
    // donc decale de vingt metres par rapport au marquage officiel, mais la
    // geometrie est la bonne, et les debuts de zone restent a cent metres
    // l'un de l'autre comme sur une vraie piste.
    if (T.relay && T.legLength > 0) {
      for (let k = 1; k < T.legs; k++) {
        const z0 = k * T.legLength;
        for (let e = 0; e < C.LANE_COUNT; e++) {
          tick(z0, e, 'rgba(255,206,0,0.92)', 2.4);
          tick(z0 + C.RELAY_LAUNCH, e, 'rgba(255,206,0,0.92)', 2.4);
          tick(z0 + 20, e, 'rgba(255,206,0,0.45)', 1.4);
        }
      }
    }

    // Numeros de couloir, peints juste avant chaque ligne de depart. Ce
    // sont des chiffres traces, pas du texte : une piste porte l'identite
    // graphique de sa competition, et une fonte systeme n'a jamais ete
    // peinte au sol nulle part. Voir chiffres-piste.js.
    const CH = globalThis.ChiffresPiste;
    if (CH) {
      for (let e = 0; e < C.LANE_COUNT; e++) {
        const q = ptOf(T.markAt(-1.7, e), lineR(e) + C.LANE_W * 0.5);
        const p = ground(q[0], q[1]);
        if (p[0] < -60 || p[0] > G.VW + 60 || p[1] < -40 || p[1] > G.VH + 40) continue;
        CH.dessiner(ctx, e + 1, p[0], p[1], 17 * ui(), 'rgba(255,255,255,0.60)');
      }
    }

    // Distances sur l'herbe exterieure, aux memes reperes — posees a cote
    // du repere du couloir exterieur, qui est celui qu'elles annoncent.
    // Memes chiffres que les numeros de couloir : tout ce qui est chiffre
    // autour d'une piste vient du meme dessin. Seul le mot du depart reste
    // du texte — on n'a pas de lettres, seulement des chiffres.
    ctx.save();
    ctx.font = '600 ' + (13 * ui()) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of markers) {
      const q = ptOf(T.markAt(m, C.LANE_COUNT - 1), rOut + 2.4);
      if (!q) continue;
      const p = ground(q[0], q[1]);
      if (p[0] < -80 || p[0] > G.VW + 80) continue;
      if (m === 0) ctx.fillText(t('depart'), p[0], p[1]);
      else if (CH) CH.dessinerNombre(ctx, m, p[0], p[1], 15 * ui(), 'rgba(255,255,255,0.80)');
      else ctx.fillText(String(m), p[0], p[1]);
    }
    ctx.restore();

    // damier d'arrivee : positionne par distance de course (qui gere le
    // second demi-tour du 400 m) plutot que par coordonnee locale fixe,
    // sinon la ligne d'arrivee tomberait au mauvais endroit sur un tour
    // complet. Elle, au moins, est bien radiale : tous les couloirs y
    // arrivent au meme endroit, c'est la definition d'une ligne d'arrivee.
    const at = (m, r) => T.curved ? T.posAtR(m, r) : [m, r];
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

    // Les palmiers du dedans, en dernier : ils sont plus pres que la piste et
    // doivent la recouvrir (voir drawArbresDedans).
    if (th.arbres) drawArbresDedans(ctx, th, sm, rIn);
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
    const caps = personCapsules(r, headAng, lean, false, curved);
    drawFacetFigure(ctx, caps, ax, ay, k);
  }

  /* ------------------------------------------------- reperes des coureurs */

  /**
   * Une couleur par couloir.
   *
   * Le couloir vient de la salle, jamais du client : les huit telephones
   * placent donc les memes gens aux memes endroits, et cette couleur-ci se
   * deduit du couloir plutot que de s'echanger. Deux joueurs voient forcement
   * le meme adversaire de la meme couleur, sans qu'un seul message ait ete
   * ajoute au protocole.
   *
   * Huit teintes ecartees les unes des autres, et aucune ne ressemble au
   * maillot des coureurs de l'ordinateur — c'est precisement ce qu'il faut
   * pouvoir distinguer.
   */
  const REPERES = ['rgb(52,211,153)', 'rgb(248,205,74)', 'rgb(96,165,250)',
                   'rgb(244,114,182)', 'rgb(167,139,250)', 'rgb(251,146,60)',
                   'rgb(45,212,191)', 'rgb(248,113,113)'];
  function couleurCouloir(lane) {
    return REPERES[(Math.max(1, lane || 1) - 1) % REPERES.length];
  }

  /**
   * Le cerceau au sol, et le nom au-dessus.
   *
   * Sept coureurs pilotes par l'ordinateur et un adversaire reel se ressemblent
   * trait pour trait : sur une piste a huit, rien ne disait lequel etait
   * l'autre joueur. Le cerceau se lit du coin de l'oeil pendant qu'on court,
   * le nom se lit quand on releve la tete.
   *
   * Jamais la couleur seule : le nom est ecrit a cote, et le joueur porte un
   * cerceau double. Huit teintes sur un ecran de telephone, en pleine course,
   * ne suffisent a personne — et a plus forte raison a qui les distingue mal.
   */
  function drawRepere(ctx, r, x, y, m) {
    const rep = r.repere;
    if (!rep) return;
    const rx = 19 * m / 30, ry = 7.6 * m / 30;
    ctx.save();
    ctx.strokeStyle = rep.couleur;
    ctx.lineWidth = Math.max(1.6, 2.4 * ui());
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    // Le joueur porte un second cerceau : sur une piste pleine, se retrouver
    // soi-meme est la premiere chose qu'on cherche.
    if (rep.moi) {
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 1.32, ry * 1.32, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Le nom, en pastille, au-dessus de la tete. */
  function drawNomRepere(ctx, r, x, y, m) {
    const rep = r.repere;
    if (!rep || !rep.nom) return;
    const taille = Math.max(9, 11 * ui());
    const haut = y - m * (r.look.h / C.MODEL_H) * 1.34 - 6 * ui();
    ctx.save();
    ctx.font = '800 ' + taille + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const l = ctx.measureText(rep.nom).width + 10 * ui();
    const h = taille + 6 * ui();
    ctx.fillStyle = 'rgba(6,9,19,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - l / 2, haut - h / 2, l, h, h / 2);
    else ctx.rect(x - l / 2, haut - h / 2, l, h);
    ctx.fill();
    ctx.strokeStyle = rep.couleur;
    ctx.lineWidth = Math.max(1, 1.4 * ui());
    ctx.stroke();
    ctx.fillStyle = rep.couleur;
    ctx.fillText(rep.nom, x, haut + 0.5);
    ctx.restore();
  }

  /* ----------------------------------------------------------- le starter */

  /**
   * LE JUGE DE DEPART, EN CHAIR ET EN OS.
   *
   * On l'entend depuis que le decompte a laisse la place a un starter ; il
   * fallait aussi le voir. Trois positions, et rien de plus :
   *
   *   « a vos marques »  le pistolet pend le long du corps
   *   « pret »           il leve le bras, l'arme vise le ciel
   *   le coup            recul, eclair au canon, fumee qui monte
   *
   * Rien de tout cela n'est anime a la main : le canon prolonge l'avant-bras
   * (voir `pose` dans sprinter-core.js), donc lever le bras suffit a lever
   * l'arme. Le reste est du temps — `countT` avant le coup, `elapsed` apres.
   *
   * OU IL SE TIENT, ET POURQUOI DEVANT.
   *
   * Sur la pelouse, en dedans du premier couloir, et quelques metres DEVANT
   * les blocs — c'est la place du starter sur un vrai stade. Il ne se met pas
   * derriere : il faut que les huit coureurs le voient sans tourner la tete,
   * et qu'ils partent vers lui plutot que de le laisser dans leur dos. A
   * l'ecran, cela le pose dans la bande d'herbe en bas a gauche, juste devant
   * la ligne, et les coureurs le depassent dans la premiere seconde.
   */
  const STARTER_D = 2.0;           // deux metres APRES la ligne, donc devant eux
  const STARTER_COULOIR = -1.0;    // en dedans du premier couloir, sur l'herbe

  /** Sa tenue : le blanc des officiels, et des chaussures de ville. */
  const LOOK_STARTER = K.look({
    build: 'm', skin: 'ambre', jersey: [234, 238, 246], shorts: [34, 38, 58],
    shoe: [38, 40, 50], hair: 'crop', h: 1.78,
  });

  /**
   * ET AU STADE DES ZEZE, LE STARTER N'EST PAS D'ICI.
   *
   * La finale intergalactique se court chez eux, pas chez nous : le juge de
   * depart y est un autochtone — vert, deux antennes, un peu plus grand que
   * nous et un peu plus fin. Rien d'autre ne change, ni le geste ni le
   * pistolet : les regles de l'athletisme sont les memes dans toute la
   * galaxie.
   */
  const LOOK_ALIEN = (() => {
    // Le meme blanc d'officiel que son collegue d'ici : c'est ce qui le fait
    // lire comme un starter et non comme un spectateur, et c'est aussi ce qui
    // detache sa peau verte sur une piste violette.
    const l = K.look({
      build: 'm', skin: 'ambre', jersey: [230, 236, 250], shorts: [58, 26, 96],
      shoe: [186, 128, 246], hair: 'shaved', h: 1.96,
      morph: { sh: 0.92, hip: 0.90, arm: 1.16, leg: 1.14 },
    });
    // Une peau qui n'est dans aucune table de carnations, et c'est voulu :
    // celles-la sont humaines, celle-ci ne l'est pas.
    l.skin = [126, 216, 140];
    l.hairCol = [126, 216, 140];
    return l;
  })();

  /** L'eclair au canon, et la fumee qui monte. */
  function dessinerLeCoup(ctx, x, y, t, k) {
    ctx.save();
    // L'eclair ne dure rien — un dixieme de seconde, comme le vrai.
    if (t < 0.15) {
      // Plein feu pendant quatre centiemes, puis il s'eteint. Un eclair qui
      // commence deja a moitie efface ne ressemble a rien.
      const a = t < 0.04 ? 1 : 1 - (t - 0.04) / 0.11;
      const r = k * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,242,' + (0.96 * a).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(255,214,120,' + (0.66 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,170,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      // Quatre branches : c'est ce qui fait lire un eclair plutot qu'une
      // lampe. Elles s'ecartent avec le temps, comme la lumiere se dilue.
      ctx.strokeStyle = 'rgba(255,244,210,' + (0.95 * a).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1.8, k * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI / 2 + 0.5;
        const l = r * (1.1 + 0.5 * (1 - a));
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l * 0.7);
      }
      ctx.stroke();
    }
    // La fumee : trois bouffees qui montent, s'ouvrent et s'effacent. C'est
    // elle qui dit, une seconde plus tard, que le coup a bien ete tire.
    for (let i = 0; i < 3; i++) {
      const tt = t - i * 0.17;
      if (tt <= 0 || tt > 1.7) continue;
      const q = tt / 1.7;
      const rr = k * (0.06 + 0.30 * q);
      const yy = y - k * (0.10 + 0.72 * q) - i * k * 0.04;
      const xx = x + k * 0.16 * q * (i - 1);
      ctx.fillStyle = 'rgba(226,228,236,' + (0.36 * (1 - q) * (1 - q)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(xx, yy, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawStarter(ctx) {
    const T = G.track, d = G.depart;
    if (!T || !d) return;
    // Le coup est parti quand la course a commence : `elapsed` compte alors
    // exactement le temps ecoule depuis, ce qui donne le recul, l'eclair et
    // la fumee sans qu'on ait a tenir un chronometre de plus.
    const tir = G.state === 'race' ? G.elapsed : -1;
    if (G.state !== 'count' && !(tir >= 0 && tir < 2.6)) return;
    // Pendant la presentation des athletes, il attend comme les autres.
    const p = T.pos(STARTER_D, STARTER_COULOIR);
    const g2 = ground(p[0], p[1]);
    if (g2[0] < -240 || g2[0] > G.VW + 240 || g2[1] < -280 || g2[1] > G.VH + 260) return;

    const alien = G.levelIdx === ETAPE_ZEZE;
    const look = alien ? LOOK_ALIEN : LOOK_STARTER;
    const m = scaleM(), k = m * (look.h / C.MODEL_H);

    // Le bras monte au « pret », en une demi-seconde — un starter ne leve pas
    // son arme d'un coup sec — et redescend une fois la course partie.
    let leve = d.dit >= 2 ? clamp((G.countT - (3 - d.tenue)) / 0.45, 0, 1) : 0;
    if (tir >= 0) leve = 1 - clamp((tir - 0.7) / 0.9, 0, 1);
    const recul = tir >= 0 && tir < 1 ? 0.30 * Math.exp(-tir * 8) : 0;
    const BAS = 0.12, HAUT = 2.98;
    const bras = BAS + (HAUT - BAS) * leve + recul;

    const person = {
      look: look, stride: 0.55, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0,
      // Un seul bras travaille ; l'autre reste le long du corps. Le coude se
      // deplie a mesure que le bras monte : on ne vise pas le ciel avec un
      // bras casse.
      //
      // C'est le bras du COTE DE LA CAMERA qui tient l'arme. Sur l'autre, le
      // corps la masque a moitie — et une arme a moitie cachee ne raconte pas
      // grand-chose.
      bras: [0.08, bras, 0.16, 0.20 * (1 - leve) + 0.04],
      pistolet: -1,
      // Les bulbes prennent l'accent du stade : le magenta des tribunes
      // cosmos. Il est d'ici, lui, et cela se voit jusque sur sa tete.
      antennes: alien ? [236, 132, 220] : null,
    };
    // Il fait face aux blocs, donc a la camera : demi-tour par rapport au sens
    // de la course. Les coureurs, eux, sont dessines dans l'axe de leur
    // course — de dos ; un starter de dos ne montrerait ni son bras ni son
    // arme, et surtout ne regarderait personne.
    const caps = personCapsules(person, T.heading(STARTER_D, 0) + Math.PI,
                                0, false, !!T.curved);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(g2[0], g2[1], 15 * m / 30, 6 * m / 30, 0, 0, TAU);
    ctx.fill();
    drawFacetFigure(ctx, caps, g2[0], g2[1], k);

    // Le bout du canon, pour y poser l'eclair : c'est la derniere capsule que
    // `pose` ajoute, et son premier bout. Le contrat est ecrit des deux cotes.
    if (tir >= 0) {
      const bout = caps[caps.length - 1][1];
      const x = g2[0] + (bout[1] - bout[0]) * C.ISO_COS * k;
      const y = g2[1] - (bout[0] + bout[1]) * C.ISO_SIN * k - bout[2] * k;
      dessinerLeCoup(ctx, x, y, tir, k);
    }
  }

  function drawAthletes(ctx) {
    const T = G.track, m = scaleM();
    // Le starter passe avant tout le monde : il se tient derriere la ligne,
    // donc derriere les coureurs.
    drawStarter(ctx);
    const vis = [];
    // A plusieurs, les adversaires en direct sont deja dans G.runners : le
    // fantome designe ne doit pas etre dessine une seconde fois par-dessus
    // lui-meme, ce qui doublerait son opacite et le ferait paraitre plus net
    // que les autres.
    const all = (G.ghost && G.runners.indexOf(G.ghost.runner) < 0)
      ? G.runners.concat([G.ghost.runner]) : G.runners;
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
    // Les cerceaux passent apres toutes les ombres et avant tous les coureurs :
    // sinon l'ombre du voisin recouvrirait le cerceau de celui de devant.
    for (const [r, g2] of vis) drawRepere(ctx, r, g2[0], g2[1], m);
    for (const [r, g2, p] of vis) {
      // le fantome est translucide : on voit qu'il n'est pas vraiment la,
      // tout en suivant precisement l'ecart avec lui
      // La trainee raconte une trace enregistree. En direct il n'y a rien a
      // rejouer : l'adversaire est la, maintenant, et on le dessine plein.
      if (r.isGhost) {
        const live = r.isLive || (G.ghost && G.ghost.live && G.ghost.runner === r);
        if (!live) drawGhostTrail(ctx, r, m);
        ctx.globalAlpha = live ? 0.92 : 0.42;
      }
      drawRunner(ctx, r, g2[0], g2[1], depthOf(p[0], p[1]),
                 m * (r.look.h / C.MODEL_H),
                 T.heading(r.d, r.lane), T.lean(r.d, r.lane, r.v));
      if (r.isGhost) ctx.globalAlpha = 1;
    }
    // Les noms tout en haut de la pile : une pastille a demi cachee par le
    // coureur de devant ne se lit pas, et c'est la seule chose qui distingue
    // deux adversaires de couleurs voisines.
    for (const [r, g2] of vis) drawNomRepere(ctx, r, g2[0], g2[1], m);
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
    const caps = personCapsules(man, 0, 0, mirror, false);
    drawFacetFigure(ctx, caps, cx2, cy2, k);
  }

  globalThis.SprinterApp = { G, THEMES, Audio_, load, save, levelScores,
    falseStartOut,
    recordTime, recordRun, buildLevel, queueCuts, nextCut, startRun,
    startLevel, finishRace, ground, solid, depthOf, followCam, drawWorld, ui,
    startOneShot, recommencer, startShotRace, nextShotRace, stepGhost, ghostDistAt,
    finirLesSaluts,
    armLive, liveDist, armLives, liveDistDe, startLive, liveDepart,
    startRelais, recevoirTemoin, presenterCoureur, stepPresentation,
    poserLeDepart, dessinerLeDepart, tirerLeDepart, starterParle, coupDePistolet,
    REC_STEP, goHome,
    raceHistory,
    drawAthletes, drawIcon, scaleM, originX, originY, rgb, clamp, lerp, mix,
    CUT_INTRO, CUT_DEFEAT, CUT_CHAMPION, CUT_TAUNT, GOLD, CREAM, MUTED, CYAN, GREEN,
    N, t,
    RED, MAGENTA };
})();
