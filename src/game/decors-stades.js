/* -----------------------------------------------------------------------
   SPRINTER — les decors des stades, rendus dans Blender.

   Le moteur dessine lui-meme la piste, la pelouse, les gradins et les
   coureurs. Ce qu'il ne sait pas faire en quelques lignes de canvas — une
   cage de lancer et son filet, un sautoir, une tente, un mat et son pavillon
   — est modelise dans Blender (tools/blender/decors/), rendu SOUS LA VUE DU
   JEU et AVEC SA LUMIERE, puis pose ici comme une image.

   « Sous la vue du jeu » n'est pas une approximation : la camera Blender est
   derivee de la projection de ground(), et verifiee au pixel (0,18 px
   d'ecart au pire, voir verifier-vue.py). Une piece rendue a un angle a
   peine different glisserait quand la camera suit le coureur.

   DEUX SORTES DE PIECES.

   - Les pieces DEBOUT portent leur ombre et se posent par leur pied. Elles
     sont dessinees APRES les coureurs, et ce n'est pas un raccourci : tout
     ce qui vit dans la pelouse interieure est plus pres de la camera que
     n'importe quel couloir. Une cage de sept metres dessinee avant eux se
     ferait traverser par le coureur qui passe derriere.

   - Les pieces AU SOL (fosse de saut, cercle de lancer) sont des textures
     vues d'aplomb. La projection du jeu est affine au sol : une texture s'y
     plaque exactement, a n'importe quel angle, avec une seule matrice. Elles
     passent avec la pelouse, sous tout le reste.

   Rien ici n'est indispensable : tant qu'une image n'est pas chargee, sa
   piece n'est simplement pas dessinee, et un stade sans decor reste le stade
   d'avant.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  // Lu a l'usage et non au chargement : engine.ts le pose sur globalThis, et
  // ses `import` sont evalues avant sa premiere ligne de code — ce module-ci
  // passerait donc avant le manifeste.
  const VIDE = { pxParM: 96, stades: {} };
  const MAN = () => root.SprinterDecorsManifeste || VIDE;
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');

  // -------------------------------------------------------------------
  // LES IMAGES, CHARGEES A LA DEMANDE ET UNE SEULE FOIS.
  // -------------------------------------------------------------------
  const images = new Map();
  function image(stade, f) {
    const cle = stade + '/' + f;
    let im = images.get(cle);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.src = BASE + '/decors/' + cle;
      images.set(cle, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  // -------------------------------------------------------------------
  // OU POSER LES PIECES.
  //
  // Un lieu se donne par rapport au bord INTERIEUR de la piste, pas en
  // coordonnees absolues : `d` metres vers le centre du stade. C'est ce qui
  // les garde a leur place d'une epreuve a l'autre — la ligne droite du 100 m
  // n'est pas au meme endroit du plan que celle du 200 m.
  //
  //   droite : a `x` metres le long de la ligne droite d'arrivee
  //   virage : a l'angle `a` (degres) du premier virage, 0 a sa sortie
  //   arriere, virage2 : les memes, sur la moitie opposee d'un tour
  //
  // La camera colle au coureur et le cadre ne montre qu'une bande d'une
  // quinzaine de metres de pelouse : un decor pose plus loin ne se voit
  // jamais. `d` reste donc entre six et dix-huit metres.
  // -------------------------------------------------------------------
  const RAD = Math.PI / 180;
  function lieu(T, l) {
    const rIn = T.curved ? T.edge(0) : 0;
    const d = l.d;
    if (!T.curved) {
      if (l.droite === undefined) return null;
      return { X: l.droite, Y: -d, yaw: 0, nx: 0, ny: -1 };
    }
    const r = rIn - d, S = T.straight;
    // La ligne droite d'un tour de piste est plus courte que le cent metres
    // en ligne : passe sa fin, le point tomberait dans le second virage — sur
    // la piste elle-meme. Une piece prevue au-dela n'existe pas sur ce trace.
    if (l.droite !== undefined) {
      if (l.droite < 1 || l.droite > S - 1) return null;
      return { X: l.droite, Y: r, yaw: 0, nx: 0, ny: -1 };
    }
    if (l.virage !== undefined) {
      const p = l.virage * RAD;
      return { X: -r * Math.sin(p), Y: r * Math.cos(p), yaw: l.virage,
               nx: Math.sin(p), ny: -Math.cos(p) };
    }
    if (!T.fullLap) return null;
    if (l.arriere !== undefined) {
      if (l.arriere < 1 || l.arriere > S - 1) return null;
      return { X: S - l.arriere, Y: -r, yaw: 180, nx: 0, ny: 1 };
    }
    if (l.virage2 !== undefined) {
      const p = l.virage2 * RAD;
      return { X: S + r * Math.sin(p), Y: -r * Math.cos(p), yaw: l.virage2 + 180,
               nx: -Math.sin(p), ny: Math.cos(p) };
    }
    return null;
  }

  // LE CAP LE PLUS PROCHE PARMI CEUX QUI ONT ETE RENDUS. La vue d'une course
  // en virage est tournee de WROT : une piece alignee sur la piste s'y
  // presente donc de biais, et c'est ce biais-la qui a ete rendu.
  function cap(rendus, yaw) {
    let best = null, ecart = 1e9;
    for (const k in rendus) {
      let e = Math.abs(((yaw - Number(k)) % 360 + 540) % 360 - 180);
      if (e < ecart) { ecart = e; best = rendus[k]; }
    }
    return best;
  }

  // -------------------------------------------------------------------
  // CE QUE CHAQUE STADE PORTE.
  //
  // `des` : a partir de quelle etape la piece apparait. Le stade des quatre
  // premieres etapes est le meme, et c'est l'occasion de raconter la montee
  // sans rien ecrire : une competition scolaire n'a qu'une fosse et un
  // cercle, un championnat du monde sort tout son materiel. C'est le meme
  // principe que la foule, qui grossit d'une etape a l'autre.
  // -------------------------------------------------------------------
  //
  // LA BANDE QU'ON VOIT. Mesure faite sur la course, la camera ne montre de la
  // pelouse qu'un triangle : du bord de piste jusqu'a une douzaine de metres
  // vers l'interieur, en bas a gauche de l'image, le long de ce que le coureur
  // a devant et un peu derriere lui. Une premiere mise en place a quinze ou
  // dix-huit metres ne laissait rien voir du tout — la cage disparaissait
  // sous le bord de l'ecran. Tout se tient donc entre quatre et onze metres,
  // et les pieces se succedent tous les douze a quinze metres le long de la
  // ligne droite : c'est a peu pres ce qui tient dans un cadre.
  //
  // `rot` tourne la piece sur elle-meme, en plus de l'orientation de la piste
  // (le secteur du poids s'ouvre vers le centre du stade, pas le long des
  // couloirs). Le depart se tient libre : c'est la place du starter.
  //
  // OU LA CAMERA PASSE VRAIMENT. Deux reperes, tires de la course elle-meme :
  //
  // - En LIGNE DROITE, la pelouse est sous la piste et le cadre en montre
  //   une douzaine de metres. Seules y vont des pieces basses (voir degage),
  //   tous les douze a seize metres : c'est ce qui tient dans un cadre.
  // - En VIRAGE, la pelouse est au-dessus de la piste mais le cadre n'en
  //   montre qu'une bande etroite, juste au bord : une piece posee a huit ou
  //   dix metres y sortait par le haut sans jamais se voir. Les pieces du
  //   virage se tiennent donc a cinq ou sept metres du bord — et c'est la
  //   que vont les grandes, qui s'elevent loin des coureurs.
  // - LE DEPART RESTE NU. Le 200 m part au bout du virage (180 degres) : une
  //   perche posee a 165 degres faisait un grand bloc bleu colle aux blocs,
  //   pile au moment ou tout se joue sur la reaction. Rien au-dela de 150.
  const PLAN = {
    // L'ECHELLE DU CHAMPIONNAT SE LIT DANS LA PELOUSE.
    //
    // Une rencontre scolaire se court sur une piste nue : un chariot de haies
    // au bord de l'herbe, rien de plus. La regionale sort la fosse et le
    // cercle de lancer ; la nationale, le sautoir en hauteur, la tente des
    // juges et les premiers mats ; le championnat du monde, tout le materiel
    // d'un grand stade. La tribune grandit au meme rythme (tribuneDe,
    // sprinter-app.js), et la foule avec elle.
    day: [
      { p: 'haies',    l: { droite: 8, d: 5.0 }, des: 0 },
      { p: 'longueur', sol: true, l: { droite: 44, d: 4.4 }, des: 1 },
      { p: 'poids',    sol: true, l: { droite: 96, d: 6.5 }, rot: -90, des: 1 },
      { p: 'haies',    l: { arriere: 45, d: 5.0 }, des: 1 },
      { p: 'tente',    l: { droite: 22, d: 8.0 }, des: 2 },
      { p: 'hauteur',  l: { droite: 70, d: 6.5 }, des: 2 },
      { p: 'hauteur',  l: { virage: 55, d: 6.0 }, des: 2 },
      { p: 'drapeaux', l: { virage: 85, d: 6.0 }, des: 2 },
      { p: 'haies',    l: { droite: 58, d: 5.0 }, des: 3 },
      { p: 'tente',    l: { droite: 104, d: 8.0 }, des: 3 },
      { p: 'tente',    l: { virage: 20, d: 8.0 }, des: 3 },
      { p: 'perche',   l: { virage: 115, d: 7.5 }, des: 3 },
      { p: 'cage',     l: { virage: 145, d: 7.0 }, des: 3 },
      { p: 'perche',   l: { arriere: 25, d: 7.5 }, des: 3 },
      { p: 'cage',     l: { arriere: 60, d: 7.0 }, des: 3 },
      { p: 'drapeaux', l: { arriere: 80, d: 6.0 }, des: 3 },
    ],
  };
  // Les Jeux mondiaux sortent tout le materiel.
  PLAN.mondiaux = PLAN.day.map(e => Object.assign({}, e, { des: 0 }));

  const tous = (liste) => liste.map(e => Object.assign({ des: 0 }, e));

  // Inter galactique : des cristaux qui eclairent le sol sombre, un monolithe
  // sous son anneau, un rocher qui flotte — l'ombre decalee sous lui le dit
  // mieux que n'importe quel effet.
  PLAN.cosmos = tous([
    { p: 'cristaux',        l: { droite: 10, d: 7.5 } },
    { p: 'rocher_flottant', l: { droite: 30, d: 8.8 } },
    { p: 'cristaux',        l: { droite: 52, d: 7.5 } },
    { p: 'cristaux',        l: { droite: 78, d: 7.5 } },
    { p: 'rocher_flottant', l: { droite: 100, d: 8.8 } },
    { p: 'obelisque',       l: { virage: 60, d: 6.0 } },
    { p: 'cristaux',        l: { virage: 85, d: 5.5 } },
    { p: 'antenne',         l: { virage: 110, d: 6.0 } },
    { p: 'rocher_flottant', l: { virage: 135, d: 6.0 } },
    { p: 'antenne',         l: { arriere: 25, d: 6.0 } },
    { p: 'obelisque',       l: { arriere: 55, d: 6.0 } },
    { p: 'cristaux',        l: { arriere: 80, d: 5.5 } },
  ]);

  // Le Danube : le materiel d'une soiree televisee, et rien qui porte un nom
  // (voir juridique/edition-danube.md). Le long de la ligne droite, ce qui
  // reste bas : cameras, caisses, projecteurs de sol. Les tours et la grue
  // dans le virage.
  PLAN.danube = tous([
    { p: 'camera_tv',      l: { droite: 14, d: 5.5 } },
    { p: 'caisses',        l: { droite: 30, d: 5.5 } },
    { p: 'projecteur_sol', l: { droite: 48, d: 5.5 } },
    { p: 'camera_tv',      l: { droite: 66, d: 5.5 } },
    { p: 'caisses',        l: { droite: 84, d: 5.5 } },
    { p: 'ecran_retour',   l: { droite: 104, d: 9.6 } },
    { p: 'projecteur_sol', l: { virage: 30, d: 5.5 } },
    { p: 'tour_lumiere',   l: { virage: 65, d: 6.0 } },
    { p: 'grue',           l: { virage: 95, d: 5.5 } },
    { p: 'ecran_retour',   l: { virage: 125, d: 6.0 } },
    { p: 'tour_lumiere',   l: { virage: 150, d: 6.0 } },
    { p: 'tour_lumiere',   l: { arriere: 30, d: 6.0 } },
    { p: 'grue',           l: { arriere: 60, d: 6.0 } },
    { p: 'camera_tv',      l: { arriere: 80, d: 5.0 } },
  ]);

  // La Riviera : la piscine tient deja le milieu de la ligne droite (38 a
  // 62 m) et une grande part du virage, les palmiers la bande des quatre a
  // six metres. Les pieces se posent au-dela et hors de ces zones.
  PLAN.riviera = tous([
    { p: 'cabines', l: { droite: 20, d: 8.0 } },
    { p: 'cabines', l: { droite: 76, d: 8.0 } },
    { p: 'cabines', l: { droite: 100, d: 8.0 } },
    { p: 'vigie',   l: { virage: 120, d: 7.5 } },
    { p: 'cabines', l: { virage: 148, d: 7.5 } },
    { p: 'vigie',   l: { arriere: 30, d: 7.5 } },
    { p: 'cabines', l: { arriere: 60, d: 7.5 } },
  ]);

  // La Nuit etoilee : les meules des toiles d'Arles, et une lanterne de
  // terrasse avec sa table, qui pose sa flaque jaune sur la pelouse bleue.
  // Les cypres tiennent la bande des quatre a six metres.
  PLAN.nuit = tous([
    { p: 'meule',    l: { droite: 12, d: 7.5 } },
    { p: 'meule',    l: { droite: 40, d: 8.0 } },
    { p: 'lanterne', l: { droite: 54, d: 9.6 } },
    { p: 'meule',    l: { droite: 68, d: 7.5 } },
    { p: 'meule',    l: { droite: 96, d: 8.0 } },
    { p: 'lanterne', l: { virage: 60, d: 7.0 } },
    { p: 'meule',    l: { virage: 90, d: 7.5 } },
    { p: 'lanterne', l: { virage: 120, d: 7.0 } },
    { p: 'meule',    l: { virage: 148, d: 7.5 } },
    { p: 'meule',    l: { arriere: 30, d: 7.5 } },
    { p: 'lanterne', l: { arriere: 60, d: 7.0 } },
  ]);

  // Les Trois Soleils : des rochers ronds et des arbustes a bulbe, cernes a
  // l'encre comme le reste du decor. Les arbres a chapeau tiennent la bande
  // des quatre a six metres.
  PLAN.namek = tous([
    { p: 'rocs',     l: { droite: 12, d: 6.5 } },
    { p: 'bulbes',   l: { droite: 30, d: 7.5 } },
    { p: 'rocs',     l: { droite: 50, d: 6.5 } },
    { p: 'bulbes',   l: { droite: 72, d: 7.5 } },
    { p: 'rocs',     l: { droite: 96, d: 6.5 } },
    { p: 'aiguille', l: { virage: 70, d: 7.0 } },
    { p: 'rocs',     l: { virage: 100, d: 6.5 } },
    { p: 'aiguille', l: { virage: 125, d: 7.0 } },
    { p: 'bulbes',   l: { virage: 150, d: 7.0 } },
    { p: 'aiguille', l: { arriere: 35, d: 7.0 } },
    { p: 'rocs',     l: { arriere: 65, d: 6.5 } },
  ]);

  function nomDuTheme(THEMES, th) {
    for (const k in THEMES) if (THEMES[k] === th) return k;
    return null;
  }

  // LA COURSE D'ABORD : AUCUNE PIECE NE SE DRESSE DEVANT LES COUREURS.
  //
  // A l'image, un objet qui monte avance vers le haut de l'ecran. La ou la
  // pelouse est SOUS la piste — la ligne droite d'arrivee, l'entree et la
  // sortie du virage —, monter veut dire traverser les couloirs : une cage de
  // lancer de six metres et demi posee au bord de l'herbe barrait la course
  // en plein milieu. La ou la pelouse est AU-DESSUS de la piste — le coeur du
  // virage, la ligne opposee —, la meme cage s'eleve loin des coureurs.
  //
  // On ne s'en remet donc pas au nom du lieu : on regarde, sur l'image, de
  // quel cote tombe l'interieur du stade. S'il est dessous, la piece n'est
  // gardee que si sa PORTEE — jusqu'ou elle semble avancer vers la piste une
  // fois sa hauteur comptee, mesuree sur le modele (fabriquer.py) — reste
  // en deca du bord, avec une marge. Sinon elle n'est pas posee du tout :
  // mieux vaut un decor en moins qu'un coureur cache.
  const MARGE_COURSE = 0.6;
  function degage(api, T, L, e, man) {
    const rendus = man.debout[e.p];
    if (!rendus) return false;
    let portee = 0;
    for (const k in rendus) { portee = rendus[k].portee || 0; break; }
    const g0 = api.ground(L.X, L.Y), g1 = api.ground(L.X + L.nx, L.Y + L.ny);
    const dessous = g1[1] > g0[1];
    if (!dessous) return true;
    return e.l.d >= portee + MARGE_COURSE;
  }

  function pieces(api, th, etape, sol) {
    const nom = nomDuTheme(api.THEMES, th);
    const plan = nom && PLAN[nom];
    const man = nom && MAN().stades[nom];
    if (!plan || !man) return [];
    const T = api.G.track;
    const out = [];
    for (const e of plan) {
      if (!!e.sol !== sol || etape < e.des) continue;
      const L = lieu(T, e.l);
      if (!L) continue;
      if (e.rot) L.yaw += e.rot;
      if (!sol && !degage(api, T, L, e, man)) continue;
      out.push({ e, L, nom, man });
    }
    return out;
  }

  /** Les pieces au sol : a appeler avec la pelouse, avant la piste. */
  function sol(ctx, api, th, etape) {
    for (const { e, L, nom, man } of pieces(api, th, etape, true)) {
      const m = man.sol[e.p];
      if (!m) continue;
      const im = image(nom, m.f);
      if (!im) continue;
      const yaw = L.yaw * RAD, c = Math.cos(yaw), s = Math.sin(yaw);
      const at = (x, y) => api.ground(L.X + x * c - y * s, L.Y + x * s + y * c);
      const o = at(m.x0, m.y0), ex = at(m.x0 + 1, m.y0), ey = at(m.x0, m.y0 + 1);
      // pixels de texture par metre
      const k = im.naturalWidth / m.mw;
      ctx.save();
      ctx.transform((ex[0] - o[0]) / k, (ex[1] - o[1]) / k,
                    (ey[0] - o[0]) / k, (ey[1] - o[1]) / k, o[0], o[1]);
      ctx.drawImage(im, 0, 0);
      ctx.restore();
    }
  }

  /** Les pieces debout : a appeler apres les coureurs. */
  function debout(ctx, api, th, etape) {
    const liste = pieces(api, th, etape, false);
    if (!liste.length) return;
    const G = api.G, T = G.track, m = api.scaleM();
    const vue = T.curved ? api.WROT_DEG : 0;
    // du plus loin au plus pres
    liste.sort((a, b) => api.depthOf(b.L.X, b.L.Y) - api.depthOf(a.L.X, a.L.Y));
    for (const { e, L, nom, man } of liste) {
      const rendus = man.debout[e.p];
      if (!rendus) continue;
      const r = cap(rendus, L.yaw + vue);
      const im = r && image(nom, r.f);
      if (!im) continue;
      const p = api.ground(L.X, L.Y);
      const k = m / (r.ppm || MAN().pxParM);
      const x = p[0] - r.ax * k, y = p[1] - r.ay * k, w = r.w * k, h = r.h * k;
      if (x > G.VW || y > G.VH || x + w < 0 || y + h < 0) continue;
      ctx.drawImage(im, x, y, w, h);
    }
  }

  /**
   * Un bloc de depart pose sur la piste, au pied d'un coureur.
   *
   * `X, Y` : le point de depart du couloir (la ou pose() met le coureur au
   * coup de feu) ; `angle` : la direction de la course a cet endroit, en
   * degres, vue comprise. Rend faux si l'image n'est pas encore la — le
   * moteur dessine alors son ancien bloc.
   */
  function bloc(ctx, api, X, Y, angle) {
    const man = MAN().stades.materiel;
    const rendus = man && man.debout.blocs;
    if (!rendus) return false;
    const r = cap(rendus, angle);
    const im = r && image('materiel', r.f);
    if (!im) return false;
    const p = api.ground(X, Y);
    const k = api.scaleM() / (r.ppm || MAN().pxParM);
    ctx.drawImage(im, p[0] - r.ax * k, p[1] - r.ay * k, r.w * k, r.h * k);
    return true;
  }

  root.DecorsStades = { sol, debout, bloc, PLAN };
})(typeof globalThis !== 'undefined' ? globalThis : this);
