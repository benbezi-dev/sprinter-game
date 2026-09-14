/* -----------------------------------------------------------------------
   SPRINTER — monter les profils Blender sur le rig du jeu.

   coureur-hd.js ne contient que des mesures. Ce fichier-ci les pose sur le
   squelette : quel profil va sur quel os, de quelle couleur, et a quel
   niveau de detail.

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

  /**
   * Poser une chaine de troncs mesures sur un os.
   *
   * @param add   la fonction d'ajout de pose()
   * @param pro   les profils du gabarit (HD.m ou HD.f)
   * @param nom   quelle chaine — 'thigh', 'torso', ...
   * @param niv   niveau de detail
   * @param col   couleur du segment
   * @param pv    pivot dans le repere du corps
   * @param ang   angle de l'os
   * @param oy    decalage lateral (nul quand le pivot le porte deja)
   * @param yaw   lacet herite du buste ou du bassin
   * @param k     facteur de gabarit de l'athlete (epaules, bras, jambes)
   * @param dz    glissement vertical de toute la chaine (le rebond de la
   *              foulee, que la tete suit moins que le bassin)
   * @param bouts quelles extremites boucher : 1 le bas, 2 le haut, 3 les
   *              deux. Certaines sont toujours enfouies dans un autre
   *              volume — le haut du bassin sous le maillot, le haut d'une
   *              cuisse dans le bassin — et le disque qui les ferme
   *              finissait par ressortir : deux segments voisins sont a la
   *              meme profondeur, l'ordre entre eux tient a un millimetre,
   *              et il suffisait que le buste se penche pour qu'une
   *              rondelle sombre apparaisse en travers des hanches.
   */
  function chaine(add, pro, nom, niv, col, pv, ang, oy, yaw, k, dz, bouts) {
    var tr = pro[nom][niv], d = dz || 0, b = bouts === undefined ? 3 : bouts;
    for (var i = 0; i < tr.length; i++) {
      var t = tr[i];
      // t = [centre z, demi-hauteur, cambrure, prof. bas, larg. bas,
      //      prof. haut, larg. haut]
      add(col, pv, ang, [t[2] * k, oy, t[0] + d],
          [t[3] * k, t[4] * k], [t[5] * k, t[6] * k], t[1], yaw,
          ((i === 0 ? 1 : 0) | (i === tr.length - 1 ? 2 : 0)) & b);
    }
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
      var d = Math.abs(tr[i][0] - z);
      if (d < dmin) { dmin = d; best = tr[i]; }
    }
    if (!best) return 0;
    return (best[2] + (best[3] + best[5]) * 0.5) * k;
  }

  root.SprinterPremium = {
    chaine: chaine, avant: avant,
    PRES: PRES, MOYEN: MOYEN, LOIN: LOIN,
    profils: function (fem) { return fem ? HD.f : HD.m; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
