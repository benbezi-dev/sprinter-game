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
  var PRES = 0, MOYEN = 1, LOIN = 2;

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

  // MESURE (8) dit au rendu que la section est une ellipse RELEVEE. Tout le
  // reste — cheveux, chaussures, dossard — garde ses dimensions ecrites a la
  // main, que le rendu a toujours arrondies en moyenne : les y dessiner en
  // ellipse changerait des pieces que personne n'a demande de toucher.
  var MESURE = 8;

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
   */
  function chaine(add, pro, nom, niv, col, pv, ang, oy, yaw, k, dz, bas, haut, depuis) {
    var tr = pro[nom][niv], d = dz || 0;
    var i0 = 0;
    if (depuis !== undefined) {
      while (i0 < tr.length - 1 && tr[i0][0] < depuis) i0++;
    }
    for (var i = i0; i < tr.length; i++) {
      var t = tr[i];
      // t = [centre z, demi-hauteur, cambrure, prof. bas, larg. bas,
      //      prof. haut, larg. haut]
      var f = MESURE;
      f |= (i === i0) ? (bas || 0) : ENFOUI_BAS;
      f |= (i === tr.length - 1) ? (haut || 0) : ENFOUI_HAUT;
      // LIBRE ne dit pas QUEL bout s'arrondit : le rendu arrondit celui qui
      // fait face a la camera. Un bout libre ne se declare donc qu'en face
      // d'un bout enfoui — sinon, sur une chaine d'un seul tronc, la calotte
      // irait coiffer l'autre extremite.
      add(col, pv, ang, [t[2] * k, oy, t[0] + d],
          [t[3] * k, t[4] * k], [t[5] * k, t[6] * k], t[1], yaw, f);
    }
  }

  /** Le rayon moyen mesure a une extremite de chaine : 'bas' ou 'haut'. */
  function rayon(pro, nom, niv, cote, k) {
    var tr = pro[nom][niv];
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
    var tr = pro[nom][niv], best = null, dmin = 1e9;
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
    var tr = pro[nom][niv], best = null, dmin = 1e9;
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
    chaine: chaine, avant: avant, rayon: rayon, section: section,
    PRES: PRES, MOYEN: MOYEN, LOIN: LOIN,
    LIBRE: LIBRE, ENFOUI_BAS: ENFOUI_BAS, ENFOUI_HAUT: ENFOUI_HAUT, MESURE: MESURE,
    profils: function (fem) { return fem ? HD.f : HD.m; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
