/* -----------------------------------------------------------------------
   SPRINTER — LA COUCHE DE FINITION.

   Ce qui separe une image lisible d'une image qu'on a envie de regarder ne
   tient jamais a la geometrie. Le stade etait deja juste : la piste est a la
   bonne echelle, les gradins montent, les athletes ont du volume. Ce qui
   manquait, ce sont les choses qu'aucun trace ne donne — la profondeur de
   l'air, le grain d'une surface, la douceur d'une ombre, la poussiere qu'un
   pied souleve, et le fait qu'une image est REGARDEE depuis un point, donc
   plus sombre sur ses bords.

   Tout tient ici, dans un seul module, et RIEN n'y est indispensable : le jeu
   tourne sans, exactement comme avant. C'est voulu. Chaque effet a un cout, et
   le telephone d'entree de gamme qui rame doit pouvoir les perdre un par un,
   du plus cher au moins cher, sans qu'une seule ligne du rendu principal ait
   a le savoir (voir `mesurer`).

   AUCUN DE CES EFFETS N'EST EN TROIS DIMENSIONS. Le jeu reste ce qu'il est :
   une projection isometrique dessinee au canvas 2D. Mais la projection a une
   propriete dont on ne se servait pas — l'ecran = (Y-X)·cos, -(X+Y)·sin - Z —
   la PROFONDEUR y descend tout droit vers le bas de l'image. Ce qui est haut
   est loin. Une simple degradation verticale devient donc une vraie brume de
   distance, et c'est gratuit.
   ----------------------------------------------------------------------- */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // -------------------------------------------------------------------
  // LE NIVEAU DE DETAIL, ET POURQUOI IL SE REGLE TOUT SEUL.
  //
  // Un reglage graphique dans un menu suppose que le joueur sache ce qu'est
  // un « grain de surface » et ce qu'il coute sur SON telephone. Personne ne
  // le sait, et personne ne devrait avoir a le savoir : c'est au jeu de
  // mesurer ce qu'il tient et de s'y tenir.
  //
  // Trois paliers, du plus complet au plus sobre. On ne descend qu'apres une
  // seconde entiere passee sous le seuil — une image longue arrive a tout le
  // monde (un ramasse-miettes, un onglet qui revient au premier plan) et ne
  // doit rien declencher. On remonte deux fois plus lentement qu'on ne
  // descend, sinon la qualite oscillerait juste au-dessus du seuil, et une
  // image qui change de finition toutes les deux secondes est bien pire
  // qu'une image constamment sobre.
  // -------------------------------------------------------------------
  const PLEIN = 2, MOYEN = 1, SOBRE = 0;
  let niveau = PLEIN;
  let budget = 0, lent = 0, rapide = 0;
  // Le pas de temps de l'image en cours. Le rendu du monde ne le recoit pas —
  // il dessine, il ne simule pas — mais la poussiere et les flashs, eux, en
  // ont besoin. La boucle d'image le depose ici en appelant `mesurer`, et les
  // effets le relisent : une seule source, jamais deux horloges.
  let _dt = 1 / 60;
  // Un reglage pose a la main (depuis la console, ou par un futur menu)
  // desarme la mesure : entre le jugement du joueur et celui d'une moyenne
  // glissante, c'est le joueur qui gagne.
  let verrou = false;

  function mesurer(dt) {
    _dt = dt;
    if (verrou) return;
    // Moyenne glissante du temps d'image, en millisecondes.
    budget += ((dt * 1000) - budget) * 0.08;
    if (budget > 26 && niveau > SOBRE) {
      lent += dt; rapide = 0;
      if (lent > 1.0) { niveau--; lent = 0; }
    } else if (budget < 15 && niveau < PLEIN) {
      rapide += dt; lent = 0;
      if (rapide > 4.0) { niveau++; rapide = 0; }
    } else { lent = 0; rapide = 0; }
  }

  // -------------------------------------------------------------------
  // LA BRUME DE DISTANCE.
  //
  // Trente metres de piste, deux mille personnes dans les gradins et la ligne
  // d'horizon etaient peints avec la meme franchise que la chaussure du
  // coureur au premier plan. C'est ce qui donnait a l'image son aspect de
  // decoupage : tout y etait a la meme distance parce que tout y avait le
  // meme contraste.
  //
  // L'air n'est pas transparent. Sur cent metres ca ne se voit pas, mais sur
  // la profondeur d'un stade entier — les tribunes d'en face, la colline
  // derriere — la couleur du ciel s'interpose et mange le contraste. C'est le
  // seul indice de profondeur qu'un dessin plat puisse donner sans perspective,
  // et le cinema ne s'en prive jamais.
  //
  // Ici la profondeur descend vers le bas de l'image (voir l'en-tete) : une
  // degradation verticale suffit, et elle coute un seul remplissage.
  // -------------------------------------------------------------------
  let _brumeCle = '', _brumeDeg = null;

  function brume(ctx, th, G) {
    if (niveau < MOYEN) return;
    const c = th.brumeCol || th.lointain || th.skyBot;
    if (!c) return;
    // La brume s'arrete au coureur : devant lui, l'air est transparent.
    const bas = G.VH * 0.50;
    const cle = c.join() + '|' + (bas | 0) + '|' + (th.brumeForce || 1);
    if (cle !== _brumeCle) {
      const g = ctx.createLinearGradient(0, 0, 0, bas);
      const f = th.brumeForce == null ? 1 : th.brumeForce;
      const col = (a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
      // Trois arrets plutot que deux : une brume lineaire se voit comme un
      // voile pose sur l'image, une brume qui s'eteint en courbe se lit comme
      // de l'air.
      g.addColorStop(0, col((0.17 * f).toFixed(3)));
      g.addColorStop(0.45, col((0.06 * f).toFixed(3)));
      g.addColorStop(1, col(0));
      _brumeDeg = g; _brumeCle = cle;
    }
    ctx.fillStyle = _brumeDeg;
    ctx.fillRect(0, 0, G.VW, bas);
  }

  // -------------------------------------------------------------------
  // LES BANDES DE TONTE.
  //
  // La pelouse interieure est la plus grande surface de l'image — souvent un
  // bon tiers — et c'etait un aplat parfaitement uni. Aucune pelouse au monde
  // n'est unie : on la tond en passes, et chaque passe couche les brins dans
  // un sens. Une passe sur deux renvoie donc la lumiere vers vous et parait
  // claire, l'autre parait sombre. C'est ce qui fait qu'on reconnait un stade
  // sur une photographie prise de trop loin pour y lire quoi que ce soit.
  //
  // Cinq pour cent d'ecart, pas davantage : au-dela, ce ne sont plus des
  // passes de tondeuse mais des rayures peintes.
  //
  // Le trace reprend exactement la machinerie des bandes de la piste (le
  // peintre passe en argument), donc les passes suivent les virages et
  // defilent avec le monde, sans un calcul de plus.
  // -------------------------------------------------------------------
  const PASSE = 6;      // la largeur d'une passe de tondeuse, en metres

  function tonte(ctx, th, P, rIn, rOut, horizon) {
    // LA PELOUSE EST UNIE PAR DEFAUT, ET IL FAUT LA DEMANDER POUR L'AVOIR
    // RAYEE. Le drapeau existait deja, mais dans l'autre sens : tous les
    // stades etaient tondus, et un theme pouvait s'en dispenser. A l'ecran ou
    // se joue la course — la camera colle au coureur — ces passes ne se
    // lisaient pas comme une tonte mais comme deux verts qui alternent, la
    // meme rayure que la piste avait en travers. Un stade qui veut ses passes
    // pose maintenant `tonte: true` dans son theme.
    if (niveau < MOYEN || th.pinceau || !th.tonte) return;
    // Des tranches DEUX FOIS plus fines que celles du decor. Le pas de rendu
    // ordinaire fait douze metres : a l'echelle ou la camera tient le
    // coureur, une passe de douze metres barre le tiers de l'ecran, et ce
    // n'est plus une tonte, c'est un damier. Six metres, c'est la largeur
    // reelle d'un passage de tondeuse autoportee.
    const sm = P.samples(PASSE), courbe = P.G.track.curved;
    // Quatre pour cent d'ecart. La tonte ne doit pas SE VOIR : elle doit
    // empecher la pelouse d'etre un aplat, ce qui n'est pas la meme chose.
    // Au-dela, on peint des rayures sur un terrain de jeu video.
    const clair = P.rgb(th.grass, 1.045), sombre = P.rgb(th.grass, 0.955);
    for (let i = 0; i + 1 < sm.length; i++) {
      const col = i % 2 === 0 ? clair : sombre;
      const tranche = [sm[i], sm[i + 1]];
      // Le dedans : du centre au bord interieur de la piste.
      P.band(ctx, tranche, courbe ? 0 : rIn - 60, rIn, col);
      // Le dehors : du bord exterieur jusqu'a l'horizon du stade.
      P.band(ctx, tranche, rOut, rOut + horizon, col);
    }
  }

  // -------------------------------------------------------------------
  // LE GRAIN DE LA PISTE.
  //
  // Le tartan d'une piste est une resine chargee de granulat : de pres c'est
  // une peau, jamais une teinte plate. A l'echelle ou on la voit ici, ce n'est
  // pas le granulat qu'on distingue mais son effet — une surface qui n'a pas
  // partout exactement la meme valeur.
  //
  // La tuile est cuite UNE FOIS, en noir et blanc translucide : posee sur du
  // rouge elle donne un rouge grene, sur le jaune de la Nuit etoilee un jaune
  // grene. Un grain colore aurait demande une tuile par stade.
  //
  // Et elle est ancree au MONDE, pas a l'ecran : le meme decalage que pour la
  // foule (voir bandPattern). Sans cela le grain resterait colle a
  // l'affichage et la piste aurait l'air de glisser dessous.
  // -------------------------------------------------------------------
  const TUILE_GRAIN = 192;
  let _grainMotif = null;

  function motifGrain(ctx) {
    if (_grainMotif) return _grainMotif;
    const t = document.createElement('canvas');
    t.width = TUILE_GRAIN; t.height = TUILE_GRAIN;
    const c = t.getContext('2d');
    // Suite deterministe : la piste doit avoir le meme grain d'une partie a
    // l'autre. Un stade qui se reteinte a chaque lancement n'est pas un lieu.
    let s = 0x9e3779b9 >>> 0;
    const al = () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    // DEUX ECHELLES, ET C'EST LA TOUT LE SUJET.
    //
    // Une seule donnait soit des taches (des pastilles regulierement semees,
    // qu'on lisait comme de la rougeole) soit rien du tout. Une surface
    // reelle a les deux a la fois : un grain serre, a l'echelle du pixel, et
    // une variation lente qui court sur des metres — l'usure du couloir, la
    // reprise de resine, la trace des annees.
    //
    // La grande echelle passe d'abord, tres douce et tres pale ; le grain fin
    // se pose dessus, pixel par pixel. Aucun des deux ne se voit seul, et
    // c'est ainsi qu'il faut les regler : un grain qui SE VOIT est un defaut
    // d'impression, pas une piste.
    for (let i = 0; i < 26; i++) {
      const x = al() * TUILE_GRAIN, y = al() * TUILE_GRAIN;
      const r = TUILE_GRAIN * (0.08 + al() * 0.16), clair = al() < 0.5;
      for (const dx of [0, -TUILE_GRAIN, TUILE_GRAIN]) {
        for (const dy of [0, -TUILE_GRAIN, TUILE_GRAIN]) {
          const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          g.addColorStop(0, clair ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.050)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
    }
    // Le grain fin, ecrit directement dans les pixels : quinze mille arcs de
    // cercle donneraient la meme chose en cent fois plus de temps, et la
    // tuile est cuite une seule fois de toute la partie.
    const img = c.getImageData(0, 0, TUILE_GRAIN, TUILE_GRAIN);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = al();
      // Un pixel sur deux reste intact : un bruit qui touche tout est un
      // voile, un bruit clairseme est un granulat.
      if (n < 0.5) continue;
      const clair = n > 0.75;
      const a = Math.round((n - 0.5) * (clair ? 46 : 40));
      const av = d[i + 3];
      // Composition « source-over » a la main, pour ne pas ecraser les taches
      // larges deja posees.
      const na = av + a - (av * a) / 255;
      if (na <= 0) continue;
      const cv = clair ? 255 : 0;
      d[i] = (d[i] * av * (255 - a) / 255 + cv * a) / na;
      d[i + 1] = (d[i + 1] * av * (255 - a) / 255 + cv * a) / na;
      d[i + 2] = (d[i + 2] * av * (255 - a) / 255 + cv * a) / na;
      d[i + 3] = na;
    }
    c.putImageData(img, 0, 0);
    _grainMotif = ctx.createPattern(t, 'repeat');
    return _grainMotif;
  }

  function grain(ctx, P, rIn, rOut) {
    if (niveau < PLEIN) return;
    const m = motifGrain(ctx);
    if (!m) return;
    const a = P.ground(0, 0);
    P.bandPattern(ctx, P.samples(), rIn, rOut, m, 0,
                  a[0] % TUILE_GRAIN, a[1] % TUILE_GRAIN);
  }

  // -------------------------------------------------------------------
  // LE GRAIN DE LA PELOUSE.
  //
  // La pelouse est la plus grande surface de l'image — un bon tiers du cadre
  // en course — et depuis que les passes de tondeuse sont eteintes (voir
  // `tonte`) c'est un aplat parfait. Un aplat de cette taille ne se lit pas
  // comme de l'herbe : il se lit comme du papier de couleur, et il tire tout
  // le reste de l'image vers l'illustration.
  //
  // Le remede n'est pas de remettre des rayures, c'est de rendre la surface
  // IRREGULIERE. Une pelouse de stade n'est jamais d'une seule valeur : elle
  // a des plaques plus denses, des reprises plus pales, l'ombre du gradin sur
  // un bord. Rien de tout cela n'est aligne, et c'est ce qui la distingue
  // d'une tonte.
  //
  // Meme machinerie que le grain du tartan — une tuile noir et blanc
  // translucide, cuite une fois, ancree au monde — avec trois reglages
  // opposes : des taches DEUX FOIS plus larges (l'herbe pousse par plaques),
  // deux fois plus contrastees, et un bruit fin plus doux (un gazon n'a pas
  // de granulat, il a des brins).
  // -------------------------------------------------------------------
  const TUILE_HERBE = 256;
  let _herbeMotif = null;

  function motifHerbe(ctx) {
    if (_herbeMotif) return _herbeMotif;
    const t = document.createElement('canvas');
    t.width = TUILE_HERBE; t.height = TUILE_HERBE;
    const c = t.getContext('2d');
    // Meme suite deterministe que le grain de piste, autre graine : deux
    // surfaces qui partageraient leur semis se reconnaitraient l'une l'autre.
    let s = 0x85ebca6b >>> 0;
    const al = () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 34; i++) {
      const x = al() * TUILE_HERBE, y = al() * TUILE_HERBE;
      const r = TUILE_HERBE * (0.10 + al() * 0.22), clair = al() < 0.48;
      for (const dx of [0, -TUILE_HERBE, TUILE_HERBE]) {
        for (const dy of [0, -TUILE_HERBE, TUILE_HERBE]) {
          const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          g.addColorStop(0, clair ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.075)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
    }
    // Les brins : de courts traits, tous dans des sens differents. C'est la
    // difference avec le granulat de la piste, qui est un semis de points —
    // et c'est ce qui empeche l'oeil d'y lire une direction, donc une tonte.
    //
    // ILS DOIVENT SE SENTIR ET NON SE VOIR. A pleine opacite le semis se
    // lisait comme des confettis poses sur du vert : on comptait les traits.
    // Un tiers de cette densite, et l'oeil ne voit plus qu'une surface qui
    // n'est pas lisse — ce qui est exactement le but.
    c.lineWidth = 1;
    for (let i = 0; i < 620; i++) {
      const x = al() * TUILE_HERBE, y = al() * TUILE_HERBE;
      const a = al() * Math.PI, lg = 2 + al() * 3.5;
      c.strokeStyle = al() < 0.5 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.036)';
      c.beginPath();
      c.moveTo(x - Math.cos(a) * lg, y - Math.sin(a) * lg);
      c.lineTo(x + Math.cos(a) * lg, y + Math.sin(a) * lg);
      c.stroke();
    }
    _herbeMotif = ctx.createPattern(t, 'repeat');
    return _herbeMotif;
  }

  /**
   * Les deux pelouses : celle du dedans, celle qui court jusqu'a l'horizon.
   * Memes bornes que `tonte`, qui habillait les memes surfaces.
   */
  function herbe(ctx, th, P, rIn, rOut, horizon) {
    if (niveau < MOYEN || th.pinceau) return;
    const m = motifHerbe(ctx);
    if (!m) return;
    const a = P.ground(0, 0);
    const ox = a[0] % TUILE_HERBE, oy = a[1] % TUILE_HERBE;
    const sm = P.samples(), courbe = P.G.track.curved;
    P.bandPattern(ctx, sm, courbe ? 0 : rIn - 60, rIn, m, 0, ox, oy);
    P.bandPattern(ctx, sm, rOut, rOut + horizon, m, 0, ox, oy);
  }

  // -------------------------------------------------------------------
  // L'OCCLUSION DES BORDS.
  //
  // Les gradins se dressent au ras de la piste, et pourtant la piste etait
  // aussi claire contre eux qu'en son milieu : rien ne disait qu'un mur de
  // vingt metres de haut lui coupait la lumiere du ciel. C'est le defaut le
  // plus visible d'un rendu sans occlusion — les volumes ne SE TOUCHENT pas,
  // ils sont simplement poses cote a cote.
  //
  // Quatre bandes noires de plus en plus transparentes, du bord vers le
  // milieu, suffisent a recoller les deux : la piste s'assombrit contre le
  // muret et l'ensemble tient au sol. Meme chose au liseret interieur, contre
  // la pelouse.
  // -------------------------------------------------------------------
  function occlusion(ctx, P, rIn, rOut) {
    if (niveau < MOYEN) return;
    const sm = P.samples();
    for (let i = 0; i < 4; i++) {
      const a = (0.085 * (1 - i / 4)).toFixed(3);
      ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
      // Le bord exterieur, contre les tribunes : l'ombre porte plus loin.
      P.bandBrute(ctx, sm, rOut - (i + 1) * 0.55, rOut - i * 0.55);
      // Le bord interieur, contre la pelouse : plus courte, plus douce.
      if (i < 3) P.bandBrute(ctx, sm, rIn + i * 0.32, rIn + (i + 1) * 0.32);
    }
  }

  // -------------------------------------------------------------------
  // LES NAPPES DES PROJECTEURS.
  //
  // Le stade de nuit avait ses lampes — une rangee de rampes tres blanches
  // au-dessus des tribunes, avec leur halo — ET UNE PISTE ECLAIREE PAR
  // PERSONNE. La surface orange y avait partout exactement la meme valeur,
  // d'un bout du cadre a l'autre, comme en plein midi. Les projecteurs
  // etaient un objet du decor, pas une source de lumiere, et c'est la
  // difference entre un stade de nuit et un stade sombre avec des lampes
  // dessinees dedans.
  //
  // Une reunion nocturne se reconnait justement a CA : la piste n'y est pas
  // uniformement claire, elle est une suite de nappes qui se recouvrent, avec
  // des coutures un peu plus sombres entre deux rampes. On les pose donc au
  // sol, sous la rangee, a l'echelle de la piste.
  //
  // LA NAPPE EST UNE ELLIPSE PROJETEE, PAS UNE ELLIPSE DESSINEE. Un cercle
  // pose a plat sur le sol devient, a l'ecran, un parallelogramme incline qui
  // tourne avec le virage. On prend donc deux vecteurs sur le sol lui-meme —
  // un le long de la piste, un en travers —, on en fait la matrice du
  // contexte, et on remplit un simple disque : c'est la projection qui se
  // charge de l'incliner, exactement comme pour le reste du stade.
  // -------------------------------------------------------------------
  const NAPPE_PAS = 16;          // une nappe tous les seize metres

  function nappes(ctx, P, th, rIn, rOut) {
    if (niveau < MOYEN || !th.projecteurs) return;
    const sm = P.samples(NAPPE_PAS);
    if (sm.length < 2) return;
    const G = P.G;
    // LE CENTRE DE LA NAPPE N'EST PAS LE MILIEU DE LA PISTE.
    //
    // Les rampes sont d'un seul cote — celui des tribunes qu'on voit — et une
    // lampe n'eclaire pas aussi bien ce qui est loin d'elle. La nappe se pose
    // donc un peu vers l'exterieur, et le couloir 1, contre la pelouse, reste
    // le plus sombre. C'est exactement ce qu'on lit sur une photographie de
    // nocturne, et ca ne coute qu'un coefficient.
    const rc = rIn + (rOut - rIn) * 0.60;
    // Un peu plus large que la piste : une nappe qui s'arreterait pile au
    // liseret aurait un bord, et la lumiere n'a pas de bord.
    const demiLarge = (rOut - rIn) * 0.74;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i + 1 < sm.length; i++) {
      const a = P.ptOf(sm[i], rc);
      const p = P.ground(a[0], a[1]);
      // Le long de la piste : jusqu'a la nappe suivante, et un peu au-dela,
      // pour que deux nappes voisines se recouvrent au lieu de se toucher.
      const b = P.ptOf(sm[i + 1], rc);
      const pb = P.ground(b[0], b[1]);
      const lx = (pb[0] - p[0]) * 0.68, ly = (pb[1] - p[1]) * 0.68;
      // En travers : un metre, puis mis a l'echelle de la demi-largeur.
      const c = P.ptOf(sm[i], rc + 1);
      const pc = P.ground(c[0], c[1]);
      const tx = (pc[0] - p[0]) * demiLarge, ty = (pc[1] - p[1]) * demiLarge;
      if (!(Math.abs(lx) + Math.abs(ly) > 0.5)) continue;
      // Le cadrage se fait sur l'EMPRISE REELLE de la nappe, pas sur son
      // centre avec une marge au jugé. Une nappe fait presque mille pixels de
      // long : une marge fixe assez large pour ne jamais en couper une en
      // laissait passer trois ou quatre entierement hors champ, et un degrade
      // radial hors champ se paie au meme prix qu'un degrade visible.
      const ex = Math.abs(lx) + Math.abs(tx), ey = Math.abs(ly) + Math.abs(ty);
      if (p[0] + ex < 0 || p[0] - ex > G.VW ||
          p[1] + ey < 0 || p[1] - ey > G.VH) continue;
      ctx.save();
      ctx.transform(lx, ly, tx, ty, p[0], p[1]);
      // Variation fixe tiree de la position : deux rampes voisines n'ont pas
      // exactement la meme puissance, et une rangee de nappes rigoureusement
      // identiques se lit comme un motif imprime. Voir drawProjecteurs, qui
      // fait deja la meme chose sur les lampes elles-memes.
      const v = 0.82 + ((Math.imul(i + 1, 2654435761) >>> 0) % 100) / 100 * 0.18;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(255,248,228,' + (0.145 * v).toFixed(4) + ')');
      g.addColorStop(0.55, 'rgba(255,244,216,' + (0.062 * v).toFixed(4) + ')');
      g.addColorStop(1, 'rgba(255,240,208,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // LES OMBRES DES COUREURS.
  //
  // C'etait une ellipse noire a 42 % — un disque de peinture pose sous les
  // pieds, a bord net, de la meme densite partout. Une ombre reelle n'a pas
  // de bord : le soleil est une source large, la penombre s'etale, et seul le
  // contact du pied reste franc.
  //
  // On dessine donc DEUX ombres. Une large et tres douce, qui pose le coureur
  // dans le stade ; une petite et dense, sous les appuis, qui le pose au sol.
  // C'est exactement ce que fait une ombre au soleil, et c'est ce qui empeche
  // les athletes de flotter.
  //
  // La tache est cuite une fois dans un canevas hors ecran puis etiree a la
  // demande : huit degrades radiaux par image coutent plus cher que huit
  // drawImage, et le resultat est le meme au pixel pres.
  // -------------------------------------------------------------------
  const TACHE = 96;
  let _tache = null;

  function tache() {
    if (_tache) return _tache;
    const t = document.createElement('canvas');
    t.width = TACHE; t.height = TACHE;
    const c = t.getContext('2d');
    const g = c.createRadialGradient(TACHE / 2, TACHE / 2, 0, TACHE / 2, TACHE / 2, TACHE / 2);
    // La courbe compte plus que les valeurs : une ombre s'eteint vite pres du
    // centre puis tres lentement sur ses bords. Un degrade lineaire donnerait
    // un halo de brouillard, pas une ombre.
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.28, 'rgba(0,0,0,0.74)');
    g.addColorStop(0.58, 'rgba(0,0,0,0.34)');
    g.addColorStop(0.82, 'rgba(0,0,0,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, TACHE, TACHE);
    _tache = t;
    return _tache;
  }

  /**
   * @param m  echelle du monde en pixels par metre (scaleM)
   * @param k  1 pour un coureur, plus petit pour une silhouette lointaine
   * @param phase  la foulee, pour que l'ombre respire avec les appuis
   */
  // L'eventail d'une rampe de projecteurs : les deux lobes lateraux, en
  // fractions de la largeur du contact, et leur part de densite. Le lobe
  // central, lui, reste l'ombre ordinaire — voir `ombre`.
  const FAN = [[-0.78, -0.18, 0.42], [0.86, -0.12, 0.42]];

  function ombre(ctx, x, y, m, k, phase, lampes) {
    const t = tache();
    // A l'appui l'ombre se resserre et fonce, en suspension elle s'etale et
    // palit. Deux appuis par cycle de foulee, donc le double de la phase.
    const appui = phase == null ? 0.5 : 0.5 + 0.5 * Math.cos(phase * 2);
    const large = m * (k || 1) * (1.12 - 0.12 * appui);
    const haut = large * 0.38;
    ctx.save();
    if (niveau >= MOYEN) {
      // La penombre : large, a peine visible, elle situe le corps dans le lieu.
      ctx.globalAlpha = 0.26 + 0.06 * appui;
      ctx.drawImage(t, x - large, y - haut, large * 2, haut * 2);
    }
    const p = large * 0.40, ph = p * 0.44;
    // SOUS UNE RAMPE, UN CORPS A TROIS OMBRES, ET ELLES S'ECARTENT EN EVENTAIL.
    //
    // C'est la premiere chose qu'on remarque sur une photographie de meeting
    // en nocturne, et c'est ce qui ne trompe pas : le soleil est une source,
    // une rangee de projecteurs en est une dizaine, et chacune pose sa propre
    // ombre. Une seule ombre franche sous une rampe de lampes est une image de
    // plein jour a laquelle on aurait baisse la luminosite.
    //
    // Trois suffisent — au-dela, elles se recouvrent et redeviennent une
    // tache — et chacune ne porte qu'un peu plus du tiers de la densite d'une
    // ombre de soleil : dix lampes ne font pas dix fois plus sombre.
    const dense = 0.40 + 0.18 * appui;
    if (lampes && niveau >= MOYEN) {
      // Les deux lobes lateraux D'ABORD, sous le contact : une lampe est plus
      // proche que les autres, son ombre reste la plus franche, et c'est elle
      // qui plante les pieds au sol. Trois ombres de meme densite donnaient
      // une tache large sans centre — un coureur qui flotte.
      for (const [ex, ey, part] of FAN) {
        ctx.globalAlpha = dense * part;
        ctx.drawImage(t, x - p + p * ex, y - ph + ph * ey, p * 2, ph * 2);
      }
      ctx.globalAlpha = dense * 0.82;
      ctx.drawImage(t, x - p + m * 0.04, y - ph + m * 0.01, p * 2, ph * 2);
      ctx.restore();
      return;
    }
    // Le contact : etroit, dense, il pose les pieds au sol.
    ctx.globalAlpha = dense;
    // Decale a l'oppose de la lumiere (elle vient de la gauche et du haut,
    // cf. LIGHT dans sprinter-core) : une ombre parfaitement centree sous les
    // pieds est une ombre de midi, et le stade n'est pas eclaire a midi.
    ctx.drawImage(t, x - p + m * 0.06, y - ph + m * 0.012, p * 2, ph * 2);
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // LA POUSSIERE.
  //
  // Huit athletes a douze metres par seconde sur une piste, et rien ne
  // bougeait au sol. Ce n'est pas un detail de decor : c'est le seul endroit
  // ou la VITESSE devient visible autrement que par un chiffre. Une foulee
  // qui arrache de la matiere au sol se lit instantanement comme un effort.
  //
  // Les particules vivent en coordonnees de MONDE — elles restent ou le pied
  // les a laissees pendant que la camera avance, ce qui est precisement
  // l'effet recherche. Un systeme en coordonnees d'ecran donnerait des points
  // qui suivent le coureur, soit exactement le contraire.
  //
  // Le plafond est dur (cent-vingt) et la plus vieille cede sa place : sur une
  // piste a huit coureurs, un systeme sans plafond finit toujours par couter
  // plus cher que tout le reste de l'image.
  // -------------------------------------------------------------------
  const MAX_POUSSIERE = 120;
  const poudre = [];
  let curseur = 0;

  function semer(X, Y, vx, vy, vz, vie, r, col) {
    let p;
    if (poudre.length < MAX_POUSSIERE) { p = {}; poudre.push(p); }
    else { p = poudre[curseur]; curseur = (curseur + 1) % MAX_POUSSIERE; }
    p.X = X; p.Y = Y; p.z = 0.02;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.t = 0; p.vie = vie; p.r = r; p.col = col;
  }

  /**
   * Un appui. Appele par le rendu des athletes quand la foulee change de
   * pied, jamais par le moteur : c'est un effet, il n'a pas a exister dans la
   * simulation.
   */
  function appui(th, X, Y, dirX, dirY, v) {
    if (niveau < PLEIN || v < 5) return;
    const col = th.dust || [220, 200, 180];
    // Plus on va vite, plus l'arrachement est violent — et plus il part en
    // arriere, parce que le pied pousse vers l'arriere.
    const f = clamp((v - 5) / 7, 0, 1);
    const n = 2 + ((Math.random() * (1 + f * 2)) | 0);
    for (let i = 0; i < n; i++) {
      const ec = (Math.random() - 0.5) * 0.4;
      semer(X + ec * dirY, Y - ec * dirX,
            -dirX * (1.0 + f * 2.2) * (0.5 + Math.random() * 0.9),
            -dirY * (1.0 + f * 2.2) * (0.5 + Math.random() * 0.9),
            0.55 + Math.random() * 0.85,
            0.26 + Math.random() * 0.22,
            0.015 + Math.random() * 0.030, col);
    }
  }

  /** Le nuage du depart : les huit blocs lachent en meme temps. */
  function depart(th, coureurs, T) {
    if (niveau < PLEIN) return;
    const col = th.dust || [220, 200, 180];
    for (const r of coureurs) {
      const p = T.pos(r.d, r.lane);
      for (let i = 0; i < 5; i++)
        semer(p[0], p[1],
              (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4,
              0.8 + Math.random() * 1.2, 0.42 + Math.random() * 0.34,
              0.03 + Math.random() * 0.055, col);
    }
  }

  function avancerPoussiere() {
    const dt = _dt;
    for (let i = poudre.length - 1; i >= 0; i--) {
      const p = poudre[i];
      p.t += dt;
      if (p.t >= p.vie) { poudre.splice(i, 1); if (curseur > i) curseur--; continue; }
      p.X += p.vx * dt; p.Y += p.vy * dt; p.z += p.vz * dt;
      // Pas de gravite : une poussiere de cette taille ne retombe pas, elle
      // ralentit et se disperse. La freiner suffit, et c'est plus juste.
      p.vx *= 1 - 2.6 * dt; p.vy *= 1 - 2.6 * dt; p.vz *= 1 - 3.4 * dt;
      p.r += dt * 0.20;
    }
  }

  function dessinerPoussiere(ctx, P) {
    if (!poudre.length) return;
    const m = P.scaleM();
    ctx.save();
    for (const p of poudre) {
      const s = P.solid(p.X, p.Y, p.z);
      if (s[0] < -40 || s[0] > P.G.VW + 40 || s[1] < -40 || s[1] > P.G.VH + 40) continue;
      const u = p.t / p.vie;
      // Elle apparait vite et s'efface longuement : une poussiere qui nait en
      // fondu n'a pas ete arrachee, elle a ete allumee.
      const a = (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88) * 0.26;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgb(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ')';
      ctx.beginPath();
      ctx.arc(s[0], s[1], Math.max(0.7, p.r * m), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function viderPoussiere() { poudre.length = 0; curseur = 0; }

  // -------------------------------------------------------------------
  // LES FLASHS DANS LES TRIBUNES.
  //
  // Trente-cinq mille personnes immobiles et silencieuses : le public etait
  // dense, il n'etait pas vivant. Un stade plein, vu de la piste, scintille en
  // permanence — des centaines d'ecrans et d'appareils, jamais deux au meme
  // moment. C'est le detail le moins cher et le plus reconnaissable d'une
  // grande soiree d'athletisme.
  //
  // Ils sont poses dans le MONDE (un echantillon de piste, un rang de gradin,
  // une hauteur) et non a l'ecran : ils defilent donc avec les tribunes, et
  // sortent du cadre quand le coureur les depasse.
  // -------------------------------------------------------------------
  const flashs = [];
  let prochain = 0;
  // La rafale de l'arrivee : le nombre d'eclats qu'il reste a lacher.
  let rafaleRestante = 0;

  /**
   * Le passage de la ligne.
   *
   * C'est le seul instant de la course ou une tribune entiere fait la meme
   * chose au meme moment, et il ne se voyait nulle part : le coureur franchit
   * la ligne, le chrono s'arrete, et le stade derriere lui continue de
   * scintiller a son rythme de croisiere comme s'il ne s'etait rien passe.
   *
   * On ne change rien au mecanisme — ce sont les memes eclats, poses sur les
   * memes gradins — on en lache simplement trente d'un coup. Une seconde et
   * demie plus tard le stade a repris son rythme, et c'est exactement la duree
   * d'une arrivee.
   */
  function rafale(n) {
    if (niveau < MOYEN) return;
    rafaleRestante = n || 34;
  }

  function avancerFlashs(densite, P, near, tiers, sr, sz) {
    const dt = _dt;
    for (let i = flashs.length - 1; i >= 0; i--) {
      flashs[i].t += dt;
      if (flashs[i].t > 0.26) flashs.splice(i, 1);
    }
    if (niveau < MOYEN) { rafaleRestante = 0; return; }
    if (rafaleRestante > 0) {
      // Trois par image pendant une seconde et demie : assez dense pour que
      // la tribune paraisse partir d'un bloc, assez etale pour qu'on distingue
      // encore les eclats les uns des autres.
      for (let k = 0; k < 3 && rafaleRestante > 0; k++) {
        rafaleRestante--;
        poserFlash(P, near, tiers, sr, sz);
      }
      return;
    }
    if (densite <= 0) return;
    prochain -= dt;
    if (prochain > 0) return;
    // Un toutes les 90 ms dans une finale, une toutes les 700 ms a la
    // rencontre scolaire. La foule n'a pas la meme densite d'une etape a
    // l'autre, l'eclat non plus.
    prochain = 0.07 + Math.random() * 0.16 / clamp(densite, 0.12, 1);
    poserFlash(P, near, tiers, sr, sz);
  }

  function poserFlash(P, near, tiers, sr, sz) {
    const sm = P.samples();
    if (!sm.length) return;
    // On ne tire que dans les tranches qui sont a l'ecran : tirer sur tout le
    // tour reviendrait a allumer neuf flashs sur dix hors du cadre.
    for (let essai = 0; essai < 6; essai++) {
      const s = sm[(Math.random() * sm.length) | 0];
      const t = (Math.random() * tiers) | 0;
      const r = near + t * sr + Math.random() * sr;
      const z = 1.05 + (t + 1) * sz + sr * 0.5;
      const q = P.ptOf(s, r);
      const pt = P.solid(q[0], q[1], z);
      if (pt[0] < 0 || pt[0] > P.G.VW || pt[1] < 0 || pt[1] > P.G.VH * 0.8) continue;
      flashs.push({ x: pt[0], y: pt[1], t: 0, r: 2.2 + Math.random() * 2.4 });
      return;
    }
  }

  function dessinerFlashs(ctx, P) {
    if (!flashs.length) return;
    const u = P.ui();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flashs) {
      // Montee immediate, extinction en un quart de seconde : un flash n'a
      // pas d'attaque.
      const a = Math.pow(1 - f.t / 0.26, 2.2);
      ctx.globalAlpha = a * 0.9;
      const r = f.r * u * (1 + f.t * 2.2);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, 'rgba(255,255,248,1)');
      g.addColorStop(0.4, 'rgba(220,232,255,0.55)');
      g.addColorStop(1, 'rgba(180,208,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function viderFlashs() { flashs.length = 0; rafaleRestante = 0; }

  // -------------------------------------------------------------------
  // LA PASSE FINALE.
  //
  // Jusqu'ici l'image etait uniformement exposee d'un bord a l'autre, comme
  // un plan technique. Aucune image REGARDEE ne l'est : l'oeil comme
  // l'objectif perdent de la lumiere sur les bords, et c'est ce qui dit au
  // spectateur ou regarder. Le coureur est au centre exact de l'ecran pendant
  // toute la course (voir originX/originY) — le vignettage tombe donc
  // exactement la ou il faut, sans un calcul.
  //
  // S'y ajoute, a pleine vitesse seulement, un resserrement : le vignettage
  // se ferme et de fines trainees filent vers les bords. C'est la traduction
  // visuelle de ce que le joueur fait avec ses doigts, et la seule
  // recompense visuelle qu'il y avait a aller vite etait un nombre en haut a
  // droite.
  // -------------------------------------------------------------------
  // LE VIGNETTAGE EST UNE IMAGE, PAS UN DEGRADE, ET C'EST MESURE.
  //
  // Ecrit naivement — un degrade radial rempli sur toute la surface a chaque
  // image — il coutait A LUI SEUL 14 ms sur cinq millions de pixels, soit
  // presque autant que le stade entier (22 ms). Un degrade radial se calcule
  // pixel par pixel : une racine carree et une interpolation, cinq millions
  // de fois, soixante fois par seconde, pour un resultat qui ne change
  // jamais.
  //
  // On le cuit donc UNE FOIS dans une vignette de 320 pixels de large, et on
  // l'etire. Le degrade n'a aucun detail — c'est sa nature meme — donc
  // l'agrandissement ne se voit pas, et il ne reste que le melange, qu'aucune
  // methode ne peut eviter. Mesure apres : 2 ms.
  const VIG_L = 320;
  let _vigCle = '', _vigImg = null;

  function vignette(ctx, G, force) {
    const W = G.VW, H = G.VH;
    const cle = (W / H).toFixed(3);
    if (cle !== _vigCle) {
      const h = Math.max(8, Math.round(VIG_L * H / W));
      const t = _vigImg || (_vigImg = document.createElement('canvas'));
      t.width = VIG_L; t.height = h;
      const c = t.getContext('2d');
      c.clearRect(0, 0, VIG_L, h);
      const r = Math.hypot(VIG_L, h) * 0.5;
      const g = c.createRadialGradient(VIG_L / 2, h / 2, r * 0.36, VIG_L / 2, h / 2, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.40)');
      c.fillStyle = g; c.fillRect(0, 0, VIG_L, h);
      _vigCle = cle;
    }
    ctx.save();
    ctx.globalAlpha = clamp(force, 0, 1);
    ctx.drawImage(_vigImg, 0, 0, W, H);
    ctx.restore();
  }

  /**
   * LE COUP DE VITESSE, ET POURQUOI CELUI D'AVANT DISAIT LE CONTRAIRE.
   *
   * Il y avait ici trente traits blancs tires en travers de l'ecran des que
   * le coureur passait les trois quarts de sa vitesse. Mesure sur une course
   * entiere, cela faisait DEUX IMAGES SUR TROIS — 65 %, part moyenne 0,50.
   * Un effet permanent n'est plus un effet, c'est un decor.
   *
   * Et il disait le contraire de ce qu'on voulait. Des traits blancs
   * suspendus en l'air, qui filent vers le coureur par-dessus les gradins et
   * le ciel, ne se lisent pas comme de la vitesse : ils se lisent comme du
   * VENT DE FACE. Un sprinteur avec du vent de face, c'est un sprinteur
   * qu'on freine.
   *
   * Deux changements, donc.
   *
   * QUAND. L'effet ne suit plus la vitesse, il recompense un geste : la
   * reaction parfaite au coup de pistolet, la transition parfaite en sortie
   * de poussee. Deux fois par course au mieux, et seulement quand le joueur
   * l'a merite. C'est ce qu'il vient chercher, c'est maintenant ce qui se
   * voit.
   *
   * QUOI. Rien dans l'air, rien sur le decor. Tout part du coureur : sa
   * trainee, l'onde au sol sous ses appuis, l'aura sur son buste. Le dessin
   * vit dans sprinter-app.js, qui seul connait sa position ; ici on ne tient
   * que l'horloge de l'impulsion, dont les deux lectures sont utiles — la
   * FORCE pour ce qui s'allume et s'eteint, l'AGE pour ce qui s'ouvre.
   */
  const POUSS_DUREE = 0.85;
  let poussT0 = -1e9, poussF = 0;

  /** Arme le coup de vitesse. `force` vaut 1 pour un geste parfait. */
  function poussee(force) {
    poussF = clamp(force, 0, 1);
    poussT0 = performance.now() / 1000;
  }

  /**
   * L'age de l'impulsion : 0 au declenchement, 1 a la fin. C'est lui qu'il
   * faut pour une onde qui s'ouvre — la force, elle, monte puis retombe, et
   * une onde qui se retracte n'existe pas.
   */
  function agePoussee() {
    const t = performance.now() / 1000 - poussT0;
    if (t < 0 || t > POUSS_DUREE) return -1;
    return t / POUSS_DUREE;
  }

  /** Ou en est l'impulsion : elle monte d'un trait et retombe doucement. */
  function partPoussee() {
    const t = performance.now() / 1000 - poussT0;
    if (t < 0 || t > POUSS_DUREE) return 0;
    const u = t / POUSS_DUREE;
    return poussF * (u < 0.10 ? u / 0.10
                              : Math.pow(1 - (u - 0.10) / 0.90, 1.9));
  }

  globalThis.RenduPremium = {
    get niveau() { return niveau; },
    set niveau(v) { niveau = clamp(v | 0, SOBRE, PLEIN); verrou = true; },
    get auto() { return !verrou; },
    set auto(v) { verrou = !v; },
    PLEIN, MOYEN, SOBRE,
    mesurer, brume, tonte, herbe, grain, occlusion, nappes, ombre,
    appui, depart, avancerPoussiere, dessinerPoussiere, viderPoussiere,
    avancerFlashs, dessinerFlashs, viderFlashs, rafale,
    vignette, poussee, partPoussee, agePoussee,
  };
})();
