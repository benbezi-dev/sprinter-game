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
  // LA SERIE ULTRA (fabriquer.py --ultra) : deux fois la densite, et des
  // formes rondes trois fois plus fines. Le jeu ne la demande qu'a trois
  // pixels par point (voir dpr() dans rendu-premium.js), piece par piece, et
  // garde l'image ordinaire tant que la fine n'est pas arrivee : a cette
  // densite, une piece rendue pour deux s'affichait agrandie, floue.
  const MANU = () => root.SprinterDecorsManifesteUltra || VIDE;
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');

  // -------------------------------------------------------------------
  // LES IMAGES, CHARGEES A LA DEMANDE ET UNE SEULE FOIS, ET RENDUES
  // DECODEES (images-pretes.js).
  // -------------------------------------------------------------------
  function image(stade, f, dossier) {
    return root.SprinterImages.image(BASE + '/' + (dossier || 'decors') + '/' + stade + '/' + f);
  }

  /**
   * Le rendu d'une piece et son image : la serie ULTRA si la toile est a
   * trois pixels par point et que l'image fine est la, l'ordinaire sinon.
   * `choisir` prend les rendus d'une piece (par cap) et rend celui qui sert.
   * Rend [rendu, image, manifeste] ou null.
   */
  function rendu(api, genre, nom, p, choisir) {
    if (api.G.dpr > 2) {
      const mu = MANU().stades[nom];
      const ru = mu && mu[genre][p] && choisir(mu[genre][p]);
      const imu = ru && image(nom, ru.f, 'decors-ultra');
      if (imu) return [ru, imu, MANU()];
    }
    const m = MAN().stades[nom];
    const r = m && m[genre][p] && choisir(m[genre][p]);
    const im = r && image(nom, r.f);
    return im ? [r, im, MAN()] : null;
  }
  const lui = (x) => x;

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

  // La piste arc-en-ciel : des bornes lumineuses tout du long, au ras de la
  // piste, et entre elles ce qui flotte — arcs-en-ciel, etoiles, satellites,
  // planetes, fusees. Les pieces hautes sont posees plus loin du bord : sur
  // la ligne droite, la pelouse passe SOUS la piste a l'image, et `degage`
  // retirerait une arche de cinq metres posee a moins de douze.
  PLAN.arcenciel = tous([
    { p: 'borne',     l: { droite: 6,  d: 5.0 } },
    { p: 'arche',     l: { droite: 13, d: 14.5 } },
    { p: 'borne',     l: { droite: 18, d: 5.0 } },
    { p: 'etoile',    l: { droite: 25, d: 10.0 } },
    { p: 'borne',     l: { droite: 30, d: 5.0 } },
    { p: 'planete',   l: { droite: 37, d: 11.0 } },
    { p: 'borne',     l: { droite: 42, d: 5.0 } },
    { p: 'satellite', l: { droite: 49, d: 12.0 } },
    { p: 'borne',     l: { droite: 54, d: 5.0 } },
    { p: 'fusee',     l: { droite: 61, d: 15.0 } },
    { p: 'borne',     l: { droite: 66, d: 5.0 } },
    { p: 'etoile',    l: { droite: 73, d: 10.0 } },
    { p: 'borne',     l: { droite: 78, d: 5.0 } },
    { p: 'arche',     l: { droite: 86, d: 14.5 } },
    { p: 'borne',     l: { droite: 90, d: 5.0 } },
    { p: 'planete',   l: { droite: 98, d: 11.0 } },
    { p: 'borne',     l: { droite: 102, d: 5.0 } },
    { p: 'satellite', l: { virage: 40, d: 9.0 } },
    { p: 'fusee',     l: { virage: 65, d: 8.0 } },
    { p: 'arche',     l: { virage: 92, d: 9.0 } },
    { p: 'etoile',    l: { virage: 115, d: 7.0 } },
    { p: 'planete',   l: { virage: 138, d: 8.0 } },
    { p: 'borne',     l: { virage: 20, d: 4.0 } },
    { p: 'borne',     l: { virage: 160, d: 4.0 } },
    { p: 'fusee',     l: { arriere: 18, d: 8.0 } },
    { p: 'arche',     l: { arriere: 45, d: 9.0 } },
    { p: 'satellite', l: { arriere: 70, d: 9.0 } },
  ]);

  // LE STADE JEAN-DELBERT, A MONTREUIL — le defi Aurel Manga, un 110 m haies.
  //
  // Deux pieces sorties de Tripo d'apres les photos du lieu (voir
  // pieces_tripo.py) : la cabine du chronometrage sur ses pilotis, et un mat
  // d'eclairage. Au vrai stade, elles sont de l'autre cote, au bout de la
  // tribune et dans les virages — hors du cadre pendant toute la course, que
  // la camera filme a hauteur des premiers rangs. On les pose donc cote
  // pelouse (decision du 03/10/2026).
  //
  // OU, C'EST UNE MESURE (03/10, 110 m haies, ecran de 412 x 915 points).
  // Au-dessus des deux touches, la pelouse visible fait moins de cinq metres :
  // le pied d'une piece n'y entre jamais, seul son haut se voit. Et l'endroit
  // le plus longtemps filme est le DEPART — tout le decompte et les attitudes
  // s'y passent. Les deux pieces y sont donc, et nulle part ailleurs : un mat
  // pose apres l'arrivee n'etait jamais vu, la course passe au resultat sur
  // la ligne.
  //
  // `libre` : chacune a ete placee pour ne jamais passer devant un coureur a
  // l'image, ce que la regle de `degage` — prudente, elle compte deux fois la
  // hauteur — aurait refuse. A l'ecran, un point de hauteur Z pose a d metres
  // de la corde atteint le premier couloir des que Z depasse 0,894 d.
  //   - LA CABINE (5,7 m, son dos a 1,75 m de son centre) : a 9 m, le haut de
  //     son dos reste a 0,894 x 7,25 = 6,5 m, sous la corde. Vue 6,6 s.
  //   - LE MAT (25 m) passe forcement devant la piste a l'image ; a vingt
  //     metres derriere la ligne et 8,5 m dans la pelouse, il ne la croise
  //     qu'entre -11,5 et -1,7 m : derriere les blocs, ou personne ne se
  //     tient. Sa tete se voit 5 s, pendant le decompte.
  // Sur un tour de piste (200, 400 m), `droite` negatif n'existe pas : le
  // stade y reste sans ces pieces (voir lieu).
  PLAN.montreuil = tous([
    { p: 'cabine', l: { droite: -2, d: 9 }, libre: true },
    { p: 'mat', l: { droite: -20, d: 8.5 }, libre: true },
  ]);

  // LA RUELLE DE LA NUIT DU MOLOSSE (09/10, « creer un decor dans une ruelle
  // avec la piste qui se fond dans la ruelle, on fait le decor avec Tripo »).
  //
  // Une rangee de maisons a colombages (Tripo, onze metres) borde la piste du
  // cote qui MONTE a l'ecran : a l'exterieur en ligne droite, a l'interieur
  // dans les virages (« la pelouse est au-dessus de la piste », plus haut).
  // Elles sont toutes `fond` : dessinees AVANT la piste et les coureurs, a la
  // place des gradins — derriere eux, jamais devant. Des reverberes se
  // dressent au bord de la piste, entre elle et les facades.
  //
  // UNE SEULE MAISON, TROIS VISAGES. Son plan est presque carre : tournee
  // d'un quart de tour, elle montre un autre flanc (`rot`), et la rangee ne
  // se repete plus a l'identique. Les rendus couvrent tous les caps (voir
  // palettes.py, `virage`).
  //
  // Le cote de la piste ou elles se dressent : `d` est compte depuis la corde
  // vers le centre ; en ligne droite, le bord exterieur est a -9,8 m.
  const RUELLE_PAS = 5.6, RUELLE_DEHORS = -14.2, RUELLE_DEDANS = 4.2;
  const ruelle = [];
  {
    // LES DEUX COTES, ET L'ECRAN CHOISIT. Selon l'endroit du tour, le cote qui
    // monte a l'ecran n'est pas le meme : l'exterieur en ligne droite, tantot
    // l'un tantot l'autre dans un virage. Les maisons sont donc posees des
    // deux cotes, et `debout` ne garde, a chaque image, que celles qui se
    // trouvent AU-DESSUS de la piste (voir `auDessus`).
    const tours = [0, 90, 270, 0, 270, 90];
    let i = 0;
    const maison = (l, rot) => ruelle.push({ p: 'maison', l, rot, fond: true, libre: true });
    for (let x = -40; x <= 175; x += RUELLE_PAS, i++) {
      maison({ droite: x, d: RUELLE_DEHORS }, tours[i % 6]);
      maison({ droite: x, d: RUELLE_DEDANS }, 180 + tours[(i + 2) % 6]);
      maison({ arriere: x, d: RUELLE_DEHORS }, tours[(i + 4) % 6]);
      maison({ arriere: x, d: RUELLE_DEDANS }, 180 + tours[(i + 1) % 6]);
    }
    for (let a = 0; a <= 180; a += 7, i++) {
      for (const v of ['virage', 'virage2']) {
        // dedans, la facade regarde la piste, donc vers l'exterieur
        maison({ [v]: a, d: RUELLE_DEDANS }, 180 + tours[i % 6]);
        maison({ [v]: a, d: RUELLE_DEHORS }, tours[(i + 3) % 6]);
      }
    }
    for (let x = -24; x <= 168; x += 18) {
      ruelle.push({ p: 'reverbere', l: { droite: x, d: -10.9 }, fond: true, libre: true });
      ruelle.push({ p: 'reverbere', l: { droite: x + 9, d: 1.1 }, fond: true, libre: true });
    }
  }
  PLAN.halloween = tous(ruelle);

  // Rendues au soleil de Blender : la nuit, une copie teinte (heure-du-jour.js).
  const nuit = (im, part) => (root.SprinterHeure ? root.SprinterHeure.image(im, part) : im);

  function nomDuTheme(THEMES, th) {
    // Un stade a une autre heure garde les pieces du sien (heure-du-jour.js).
    const b = (th && th.base) || th;
    for (const k in THEMES) if (THEMES[k] === b) return k;
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

  function pieces(api, th, etape, sol, fond) {
    const base = nomDuTheme(api.THEMES, th);
    const plan = base && PLAN[base];
    // la serie rendue sous la camera du moment, s'il y en a (fabriquer --angle)
    const nom = base && serieDeLaVue(api, base);
    const man = nom && MAN().stades[nom];
    if (!plan || !man) return [];
    const T = api.G.track;
    // UNE ZONE QU'UN JEU S'EST RESERVEE. Le saut en longueur pose sa propre
    // piste d'elan et sa propre fosse dans la pelouse ; un chariot de haies ou
    // une tente qui s'y trouvait se dresserait en travers de l'elan, et la
    // fosse du decor ferait une seconde fosse a cote de la vraie.
    const Z = api.G.zoneReservee;
    const out = [];
    for (const e of plan) {
      if (!!e.sol !== sol || !!e.fond !== !!fond || etape < e.des) continue;
      const L = lieu(T, e.l);
      if (!L) continue;
      if (Z && L.X >= Z.x0 && L.X <= Z.x1 && L.Y >= Z.y0 && L.Y <= Z.y1) continue;
      if (e.rot) L.yaw += e.rot;
      // `libre` : posee hors de la zone de course (voir PLAN.montreuil)
      if (!sol && !e.libre && !degage(api, T, L, e, man)) continue;
      out.push({ e, L, nom, man });
    }
    return out;
  }

  /** Les pieces au sol : a appeler avec la pelouse, avant la piste. */
  function sol(ctx, api, th, etape) {
    for (const { e, L, nom } of pieces(api, th, etape, true)) {
      const ri = rendu(api, 'sol', nom, e.p, lui);
      if (!ri) continue;
      const [m, im] = ri;
      const yaw = L.yaw * RAD, c = Math.cos(yaw), s = Math.sin(yaw);
      const at = (x, y) => api.ground(L.X + x * c - y * s, L.Y + x * s + y * c);
      const o = at(m.x0, m.y0), ex = at(m.x0 + 1, m.y0), ey = at(m.x0, m.y0 + 1);
      // pixels de texture par metre
      const k = im.naturalWidth / m.mw;
      ctx.save();
      ctx.transform((ex[0] - o[0]) / k, (ex[1] - o[1]) / k,
                    (ey[0] - o[0]) / k, (ey[1] - o[1]) / k, o[0], o[1]);
      ctx.drawImage(nuit(im, 'proche'), 0, 0);
      ctx.restore();
    }
  }

  /**
   * Les pieces du FOND (`fond`) : derriere la piste, a appeler avant elle et
   * avant les coureurs — la ou se dessinaient les gradins. Meme pose que
   * `debout`.
   */
  function fond(ctx, api, th, etape) {
    debout(ctx, api, th, etape, true);
  }

  // LA NUIT DE LA RUELLE (`assombrir` du theme). Les pieces sont rendues a la
  // lumiere du jeu, en plein jour ; la ruelle est de nuit. Chaque image en
  // recoit une copie teinte une fois pour toutes — multipliee par la couleur
  // de la nuit —, plutot qu'un filtre a chaque image.
  const _eteintes = new WeakMap();
  function eteinte(im, teinte) {
    let c = _eteintes.get(im);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(' + teinte.join(',') + ')';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(im, 0, 0);
    _eteintes.set(im, c);
    return c;
  }

  // LES REVERBERES S'ALLUMENT : un halo autour de la lanterne et une flaque
  // de lumiere sur les pavés, peints par-dessus l'image. La lanterne est
  // mesuree sur le rendu (x 0,71, y 0,18 de l'image).
  function lueur(ctx, x, y, w, h, pied, m, t) {
    const lx = x + w * 0.71, ly = y + h * 0.18;
    const vacille = 0.92 + 0.08 * Math.sin(t * 13 + x) * Math.sin(t * 7.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, m * 2.2);
    g.addColorStop(0, `rgba(255,190,90,${0.55 * vacille})`);
    g.addColorStop(0.25, `rgba(255,150,60,${0.18 * vacille})`);
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(lx, ly, m * 2.2, 0, Math.PI * 2); ctx.fill();
    // la flaque au sol, ecrasee comme le sol a l'ecran
    ctx.translate(pied[0], pied[1]);
    ctx.scale(1, 0.32);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, m * 3.2);
    g.addColorStop(0, `rgba(255,170,80,${0.22 * vacille})`);
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, m * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /**
   * Une piece du fond est-elle AU-DESSUS de la piste a l'image ? On regarde
   * ou tombe, a l'ecran, un point pris trois metres vers la piste : s'il est
   * plus haut que le pied de la piece, la piste passe au-dessus d'elle — la
   * piece serait du cote de la camera, et on ne la dessine pas.
   */
  function auDessus(api, L, e) {
    const vers = e.l.d < 0 ? 1 : -1;
    const g0 = api.ground(L.X, L.Y);
    const g1 = api.ground(L.X + L.nx * 3 * vers, L.Y + L.ny * 3 * vers);
    return g1[1] >= g0[1];
  }

  /** Les pieces debout : a appeler apres les coureurs. */
  function debout(ctx, api, th, etape, auFond) {
    const liste = pieces(api, th, etape, false, !!auFond);
    if (!liste.length) return;
    const G = api.G, T = G.track, m = api.scaleM();
    const vue = T.curved ? api.WROT_DEG : 0;
    // du plus loin au plus pres
    liste.sort((a, b) => api.depthOf(b.L.X, b.L.Y) - api.depthOf(a.L.X, a.L.Y));
    for (const { e, L, nom } of liste) {
      if (auFond && !auDessus(api, L, e)) continue;
      const ri = rendu(api, 'debout', nom, e.p, (rendus) => cap(rendus, L.yaw + vue));
      if (!ri) continue;
      const [r, im, M] = ri;
      const p = api.ground(L.X, L.Y);
      const k = m / (r.ppm || M.pxParM);
      const x = p[0] - r.ax * k, y = p[1] - r.ay * k, w = r.w * k, h = r.h * k;
      // La copie de nuit de chaque piece se fait AVANT le pistolet, meme hors
      // du cadre : faite a son entree dans le champ, elle tombait en course.
      if (G.state !== 'race') nuit(im, 'proche');
      if (x > G.VW || y > G.VH || x + w < 0 || y + h < 0) continue;
      const base = (th.base || th);
      ctx.drawImage(base.assombrir ? eteinte(im, base.assombrir) : nuit(im, 'proche'), x, y, w, h);
      if (base.assombrir && e.p === 'reverbere') lueur(ctx, x, y, w, h, p, m, G.elapsed || 0);
    }
  }

  /**
   * Un bloc de depart pose sur la piste, au pied d'un coureur.
   *
   * `X, Y` : le point de depart du couloir (la ou pose() met le coureur au
   * coup de feu) ; `angle` : la direction de la course a cet endroit, en
   * degres, vue comprise. Rend faux si l'image n'est pas encore la — rien
   * ne se dessine alors.
   */
  function bloc(ctx, api, X, Y, angle) {
    const ri = demanderBloc(api, angle);
    if (!ri) return false;
    const [r, im, M] = ri;
    const p = api.ground(X, Y);
    const k = api.scaleM() / (r.ppm || M.pxParM);
    ctx.drawImage(nuit(im, 'piste'), p[0] - r.ax * k, p[1] - r.ay * k, r.w * k, r.h * k);
    return true;
  }

  /**
   * Le bloc d'un couloir, sans le dessiner : son image et sa copie de nuit.
   * Le moteur le demande avant le pistolet pour les couloirs hors du cadre —
   * au 400 m, les blocs decales entrent dans le champ pendant la course.
   */
  function demanderBloc(api, angle) {
    const ri = rendu(api, 'debout', materielDeLaVue(api), 'blocs', (rendus) => cap(rendus, angle));
    if (ri) nuit(ri[1], 'piste');
    return ri;
  }

  // LE BLOC SE REND POUR CHAQUE CAMERA. Rendu sous la vue du sprint (26,6°),
  // il se lisait faux sous les cameras basses des nuits du molosse (5 a 22°,
  // halloween-cameras.js) : on le rend donc aussi sous chacune d'elles
  // (fabriquer.py --angle), sous « materiel-a<deg> ». On prend la serie dont
  // l'angle est le plus proche de la vue du moment ; « materiel » est celle du
  // sprint. Le Champ-de-Mars (15°) garde la serie du sprint : sa vue est
  // ramenee a celle-ci par capALEcran (sprinter-app.js), voir `vueGardee`.
  const SPRINT_DEG = Math.atan(0.5) * 180 / Math.PI;
  const seriesConnues = {};
  /**
   * La serie de `base` rendue sous l'angle le plus proche de la vue : `base`
   * elle-meme (la vue du sprint) ou `base-a<deg>`. Vaut pour le materiel et
   * pour tout stade rendu sous d'autres cameras (la ruelle du molosse).
   */
  function serieDeLaVue(api, base) {
    let liste = seriesConnues[base];
    if (!liste) {
      liste = seriesConnues[base] = [];
      const re = new RegExp('^' + base + '-a([\\d.]+)$');
      for (const k of Object.keys(MAN().stades || {})) {
        if (k === base) liste.push([SPRINT_DEG, k]);
        const m = re.exec(k);
        if (m) liste.push([parseFloat(m[1]), k]);
      }
    }
    if (liste.length < 2) return base;
    const C = api.C || (root.SprinterCore && root.SprinterCore.C);
    const sin = api.vueGardee ? api.vueGardee.sin : (C ? C.ISO_SIN : 1 / Math.sqrt(5));
    const deg = Math.asin(Math.max(-1, Math.min(1, sin))) * 180 / Math.PI;
    let mieux = base, ecart = Infinity;
    for (const [a, k] of liste) {
      if (Math.abs(a - deg) < ecart) { ecart = Math.abs(a - deg); mieux = k; }
    }
    return mieux;
  }
  const materielDeLaVue = (api) => serieDeLaVue(api, 'materiel');

  root.DecorsStades = { sol, fond, debout, bloc, demanderBloc, PLAN };
})(typeof globalThis !== 'undefined' ? globalThis : this);
