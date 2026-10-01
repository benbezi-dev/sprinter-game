/* -----------------------------------------------------------------------
   SPRINTER — monter les profils Blender sur le rig du jeu.

   coureur-hd.js ne contient que des mesures. Ce fichier-ci les pose sur le
   squelette : quel profil va sur quel os, de quelle couleur, a quel niveau
   de detail, et lesquels de ses bouts se voient.

   POURQUOI CE DECOUPAGE. Les mesures sont reengendrees a chaque fois qu'on
   retouche l'anatomie dans Blender ; ce code-ci, non. Les melanger
   reviendrait a reecrire la logique du jeu a chaque coup de sculpteur.

   CE QUI NE CHANGE PAS. Les pivots, les longueurs et les angles restent
   ceux de pose(). Un coureur premium n'est pas un nouveau personnage
   branche a cote du moteur : c'est le meme corps, avec des epaisseurs
   relevees au lieu d'epaisseurs devinees. C'est ce qui fait qu'il court
   dans le virage sans qu'une seule ligne du rendu ait a le savoir — la
   rotation s'applique aux segments, et il n'est fait que de segments.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  var HD = root.SprinterHD;

  // Trois niveaux, du plus fin au plus grossier. Le choix se fait sur la
  // taille a l'ecran, pas sur la distance de course : un coureur de dos a
  // dix metres occupe plus de pixels qu'un coureur de face a cinquante.
  //
  // Et un quatrieme, l'ULTRA, plus fin que PRES mais range APRES les trois
  // autres : le rang est l'adresse d'un niveau dans coureur-hd.js, et les
  // trois premiers ne devaient pas bouger. Il sert au palier ULTRA de la
  // couche de finition (rendu-premium.js) et au sauteur de Jumper, seul au
  // centre de l'image. Ne pas en deduire qu'un niveau
  // plus grand est plus grossier : c'est `detaille` qui le dit.
  var PRES = 0, MOYEN = 1, LOIN = 2, ULTRA = 3;

  /** Ce niveau porte-t-il le corps en gros plan — mains, pieds, doigts ? */
  function detaille(niv) {
    return niv === PRES || niv === ULTRA;
  }

  /**
   * Le niveau qu'un corps peut vraiment servir.
   *
   * Un athlete sculpte avant l'ultra n'a que trois niveaux : on lui rend son
   * niveau pres plutot qu'un tableau vide, qui ferait tomber pose().
   */
  function niveauDe(pro, lod) {
    if (lod === undefined || lod === null) return PRES;
    return pro && pro.torso && pro.torso[lod] ? lod : PRES;
  }

  // CE QUE LE RENDU DOIT FAIRE DES BOUTS D'UN SEGMENT.
  //
  //   LIBRE (1)       le bout visible s'arrondit d'une calotte — un crane,
  //                   une main. C'est le sens historique de ce drapeau.
  //   ENFOUI_BAS (2)  aucun disque en e0 ;
  //   ENFOUI_HAUT (4) aucun disque en e1.
  //
  // Les deux derniers existent pour les chaines. Sur un os coupe en six
  // troncs, chaque jonction interne portait son disque : invisible en
  // theorie, mais deux troncs voisins sont a la meme profondeur, l'ordre
  // entre eux tient au millimetre, et les disques ressortaient en anneaux le
  // long des cuisses — puis en rondelle sombre au-dessus du short des que le
  // buste se penchait.
  var LIBRE = 1, ENFOUI_BAS = 2, ENFOUI_HAUT = 4;

  // De combien un tronc mord dans son voisin, en part de sa demi-hauteur.
  // Un bon cinquieme suffit — sept millimetres sur une cuisse — et c'est plus
  // que le plus large des ecarts de bord mesures : cinq millimetres au
  // mollet, la ou la cambrure tourne le plus vite.
  var RECOUVRE = 0.22;

  // MESURE (8) dit au rendu que la section est une ellipse RELEVEE. Tout le
  // reste — cheveux, chaussures, dossard — garde ses dimensions ecrites a la
  // main, que le rendu a toujours arrondies en moyenne : les y dessiner en
  // ellipse changerait des pieces que personne n'a demande de toucher.
  var MESURE = 8;

  // COLLE (16) dit au rendu de dessiner la piece JUSTE APRES celle qui la
  // precede dans la liste de pose(), au lieu de la ranger a sa propre
  // profondeur. C'est pour ce qui se porte PAR-DESSUS un volume de meme
  // centre — un bandeau sur la calotte de cheveux : a profondeur egale, le
  // tri les departageait au millimetre, et le bandeau passait dessous.
  var COLLE = 16;

  // APRES (32) dit au rendu de dessiner la piece AU PLUS TOT juste apres
  // celle qui la precede dans la liste de pose() : elle garde sa propre
  // profondeur si elle passe deja apres, sinon elle se colle derriere. C'est
  // la calotte de cheveux sur le haut du crane. Au niveau ULTRA, le crane est
  // coupe en troncs plus courts, le centre du dernier remonte a six
  // millimetres de celui de la calotte, et le moindre decalage de la
  // chevelure vers la nuque suffisait a inverser le tri : un crane nu par-
  // dessus des cheveux qu'on ne voyait plus qu'en bande (vu le 30/09/2026).
  var APRES = 32;


  /** Le premier tronc dont le centre atteint cette hauteur locale. */
  function coupe(tr, h) {
    var i = 0;
    while (i < tr.length - 1 && tr[i][0] < h) i++;
    return i;
  }

  /**
   * L'ULTRA COUPE LA OU COUPE LE NIVEAU PRES.
   *
   * `coupe` tombe au premier joint dont le tronc suivant a son centre au-dessus
   * de la hauteur demandee. Sur des troncs deux fois plus courts, ce joint-la
   * n'est plus le meme : le poignet de l'ultra remontait de 2,7 cm, et la main
   * — qui part du poignet et finit au bout des doigts — s'allongeait d'autant,
   * justement sur les gros plans ou elle se voit.
   *
   * Or l'ultra coupe chaque chaine en deux fois plus de troncs que le niveau
   * pres, sur le meme intervalle (anatomie.chaines) : chacun des joints du
   * niveau pres est aussi un joint de l'ultra. On cherche donc le joint du
   * niveau pres, et l'on coupe l'ultra au meme endroit — le short, le
   * bandeau du poignet et la main tombent exactement ou ils tombaient.
   */
  function coupeA(pro, nom, niv, h) {
    var tr = troncs(pro, nom, niv);
    var pres = pro[nom][PRES];
    if (niv !== ULTRA || !pres) return coupe(tr, h);
    var t = pres[coupe(pres, h)], joint = t[0] - t[1];
    var i = 0;
    while (i < tr.length - 1 && tr[i][0] - tr[i][1] < joint - 1e-4) i++;
    return i;
  }

  /**
   * Poser une chaine de troncs mesures sur un os.
   *
   * @param add    la fonction d'ajout de pose()
   * @param pro    les profils du gabarit (HD.m ou HD.f)
   * @param nom    quelle chaine — 'thigh', 'torso', ...
   * @param niv    niveau de detail
   * @param col    couleur du segment
   * @param pv     pivot dans le repere du corps
   * @param ang    angle de l'os
   * @param oy     decalage lateral (nul quand le pivot le porte deja)
   * @param yaw    lacet herite du buste ou du bassin
   * @param k      facteur de gabarit de l'athlete (epaules, bras, jambes)
   * @param dz     glissement vertical de toute la chaine (le rebond de la
   *               foulee, que la tete suit moins que le bassin)
   * @param bas    sort du bout bas de la chaine : 0 disque, LIBRE, ENFOUI_BAS
   * @param haut   sort du bout haut : 0 disque, LIBRE, ENFOUI_HAUT
   * @param depuis ne poser que les troncs centres au-dessus de cette hauteur
   *               locale (une jambe de short n'habille que le haut de la
   *               cuisse)
   * @param jusqua ne poser que les troncs SOUS cette hauteur locale
   *
   * COUPER UN OS EN DEUX SANS LAISSER DE JOINT. `depuis` et `jusqua` se
   * lisent a la meme regle — `coupe()` — et sont donc exactement
   * complementaires : la chaine habillee prend `depuis: h`, la chaine de
   * peau `jusqua: h`, et les deux se partagent les troncs sans en perdre ni
   * en doubler un, a tous les niveaux de detail. C'est ce qui permet de
   * vetir le haut d'une cuisse SANS poser par-dessus elle un second cone
   * un peu plus large : deux volumes coaxiaux a la meme profondeur se
   * departagent au millimetre, et le short ressortait en lanieres noires en
   * travers de la cuisse des que le genou montait.
   */
  /**
   * Les troncs d'une chaine a un niveau de detail. Le niveau ULTRA n'existe
   * que pour les corps mesures avec lui : un
   * athlete reel releve avant lui retombe sur « pres », son niveau le plus fin.
   */
  function troncs(pro, nom, niv) {
    var ch = pro[nom];
    return ch[niv] || ch[PRES];
  }

  function chaine(add, pro, nom, niv, col, pv, ang, oy, yaw, k, dz, bas, haut,
                  depuis, jusqua) {
    var tr = troncs(pro, nom, niv), d = dz || 0;
    var i0 = depuis === undefined ? 0 : coupeA(pro, nom, niv, depuis);
    var i1 = jusqua === undefined ? tr.length - 1 : coupeA(pro, nom, niv, jusqua) - 1;
    for (var i = i0; i <= i1; i++) {
      var t = tr[i];
      // t = [centre z, demi-hauteur, cambrure, prof. bas, larg. bas,
      //      prof. haut, larg. haut]
      var f = MESURE;
      f |= (i === i0) ? (bas || 0) : ENFOUI_BAS;
      f |= (i === i1) ? (haut || 0) : ENFOUI_HAUT;
      // LIBRE ne dit pas QUEL bout s'arrondit : le rendu arrondit celui qui
      // fait face a la camera. Un bout libre ne se declare donc qu'en face
      // d'un bout enfoui — sinon, sur une chaine d'un seul tronc, la calotte
      // irait coiffer l'autre extremite.
      var h = t[1];
      // LES TRONCS D'UN MEME OS SE CHEVAUCHENT AUX JOINTS.
      //
      // Deux troncs poses bout a bout partagent un bord calcule DEUX FOIS,
      // une fois par tronc, et jamais tout a fait de la meme facon : la
      // section n'est pas facettee avec le meme nombre de cotes de part et
      // d'autre si le rayon change de palier, et le bord n'est pas dans le
      // meme plan si l'axe s'incline avec la cambrure. Il suffit d'un
      // dixieme de millimetre d'ecart pour que la piste passe entre les
      // deux, en fuseau, en travers du mollet ou de la cuisse — et ce
      // fuseau-la grandit avec la taille du coureur a l'ecran.
      //
      // Aucun ajustement de bord ne ferme cela pour de bon. Ce qui le ferme,
      // c'est que les troncs se RECOUVRENT : chaque tronc depasse d'un bon
      // cinquieme dans son voisin, et le cone est prolonge a sa propre pente
      // pour que sa peau reste exactement celle de la mesure. Les intervalles
      // se chevauchent, donc il n'y a plus de bord commun par ou voir a
      // travers. Seuls les joints INTERNES a l'os s'allongent : les deux
      // bouts de l'os gardent leur place, et l'os sa longueur.
      var eB = i > 0 ? RECOUVRE * h : 0;
      var eH = i < tr.length - 1 ? RECOUVRE * h : 0;
      // La cambrure de chaque BOUT, prise a mi-chemin des deux troncs qui
      // s'y rencontrent : c'est la meme valeur des deux cotes du joint, donc
      // les deux troncs suivent la meme courbe de chair au lieu de rester
      // paralleles a l'os, chacun decale du sien. Elle se lit sur les
      // voisins dans le profil, jamais sur les bornes de la chaine — une
      // cuisse coupee a l'ourlet garde ainsi un joint continu entre sa part
      // de short et sa part de peau. Aux extremites de l'os, le tronc garde
      // la sienne : il n'y a rien au-dela avec quoi s'accorder.
      var cb = i > 0 ? (tr[i - 1][2] + t[2]) * 0.5 : t[2];
      var ch = i < tr.length - 1 ? (t[2] + tr[i + 1][2]) * 0.5 : t[2];
      // Les pentes du tronc, par unite de hauteur : prolonger a la pente,
      // c'est prolonger le cone mesure, pas en fabriquer un autre.
      var pp = (t[5] - t[3]) / (2 * h), pl = (t[6] - t[4]) / (2 * h);
      var pc = (ch - cb) / (2 * h);
      add(col, pv, ang,
          [(cb - pc * eB) * k, oy, t[0] + (eH - eB) * 0.5 + d, (ch + pc * eH) * k],
          [(t[3] - pp * eB) * k, (t[4] - pl * eB) * k],
          [(t[5] + pp * eH) * k, (t[6] + pl * eH) * k],
          h + (eB + eH) * 0.5, yaw, f);
    }
  }

  /**
   * OU UNE CHAINE SE COUPE VRAIMENT.
   *
   * `depuis` et `jusqua` ne coupent pas a la hauteur demandee : ils coupent
   * au JOINT DE TRONCS le plus proche, par `coupe()`, et ce joint tombe plus
   * bas quand le corps est echantillonne grossierement. Tant que les deux
   * parts sortent de la meme chaine — le short et la peau d'une cuisse —
   * personne n'a besoin de savoir ou : elles se partagent les troncs sans
   * en perdre ni en doubler un.
   *
   * Une piece ECRITE A LA MAIN qui prend la suite, elle, doit le savoir : une
   * main posee au poignet suppose a -20 cm y serait bien au niveau fin, ou le
   * joint tombe a -21,9 ; au niveau moyen il tombe a -18,3 et au plus
   * grossier a -13,7, et le bras se serait ouvert de un a six centimetres
   * entre les deux. Elle lit donc le bord au lieu de le supposer.
   */
  function bord(pro, nom, niv, h) {
    var t = troncs(pro, nom, niv)[coupeA(pro, nom, niv, h)];
    return t[0] - t[1];
  }

  /** Le rayon moyen mesure a une extremite de chaine : 'bas' ou 'haut'. */
  function rayon(pro, nom, niv, cote, k) {
    var tr = troncs(pro, nom, niv);
    var t = cote === 'bas' ? tr[0] : tr[tr.length - 1];
    var r = cote === 'bas' ? (t[3] + t[4]) : (t[5] + t[6]);
    return r * 0.5 * (k || 1);
  }

  /**
   * Ou se trouve la peau, devant, a une hauteur donnee d'une chaine.
   *
   * Sert a poser ce qui s'accroche au corps — un dossard, une bande de
   * maillot. Les coller a une abscisse fixe les faisait flotter devant la
   * poitrine des que le torse changeait d'epaisseur ; ici ils suivent la
   * mesure.
   */
  function avant(pro, nom, niv, z, k) {
    var tr = troncs(pro, nom, niv), best = null, dmin = 1e9;
    for (var i = 0; i < tr.length; i++) {
      var dd = Math.abs(tr[i][0] - z);
      if (dd < dmin) { dmin = dd; best = tr[i]; }
    }
    if (!best) return 0;
    return (best[2] + (best[3] + best[5]) * 0.5) * k;
  }

  /**
   * La section mesuree a une hauteur donnee : [cambrure, demi-profondeur,
   * demi-largeur], a l'echelle k. `avant` n'en donne que la somme des deux
   * premieres ; il faut les trois pour poser une piece qui EPOUSE la courbe
   * du corps au lieu de s'y planter — le dossard, voir pose().
   */
  function section(pro, nom, niv, z, k) {
    var tr = troncs(pro, nom, niv), best = null, dmin = 1e9;
    for (var i = 0; i < tr.length; i++) {
      var dd = Math.abs(tr[i][0] - z);
      if (dd < dmin) { dmin = dd; best = tr[i]; }
    }
    if (!best) return [0, 0, 0];
    // Dans le tronc, la section va lineairement du bas au haut : on la lit a
    // la hauteur demandee plutot qu'en moyenne, pour qu'une piece posee a mi-
    // tronc colle a la peau et non a une epaisseur moyenne.
    var f = best[1] > 0 ? (z - (best[0] - best[1])) / (2 * best[1]) : 0.5;
    f = Math.max(0, Math.min(1, f));
    return [best[2] * k,
            (best[3] + (best[5] - best[3]) * f) * k,
            (best[4] + (best[6] - best[4]) * f) * k];
  }

  root.SprinterPremium = {
    chaine: chaine, avant: avant, rayon: rayon, section: section, bord: bord,
    detaille: detaille, niveauDe: niveauDe,
    PRES: PRES, MOYEN: MOYEN, LOIN: LOIN, ULTRA: ULTRA,
    LIBRE: LIBRE, ENFOUI_BAS: ENFOUI_BAS, ENFOUI_HAUT: ENFOUI_HAUT, MESURE: MESURE,
    COLLE: COLLE, APRES: APRES,
    /**
     * Les profils d'un corps : celui d'un athlete reel s'il en a un
     * (coureur-vedettes.js, lu a l'appel et non au chargement — il se pose
     * sur SprinterHD apres ce fichier-ci), le corps commun sinon.
     */
    profils: function (fem, profil) {
      var V = root.SprinterHD && root.SprinterHD.vedettes;
      return (profil && V && V[profil]) || (fem ? HD.f : HD.m);
    },
    /** Ce corps a-t-il ete sculpte a part ? */
    sculpte: function (profil) {
      var V = root.SprinterHD && root.SprinterHD.vedettes;
      return !!(profil && V && V[profil]);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
