/* -----------------------------------------------------------------------
   SPRINTER — les chiffres peints sur la piste

   Les numeros de couloir ne sont pas du texte. Sur une piste ils sont
   peints, au pochoir, et ils portent l'identite graphique de la
   competition : a Paris en 2024 c'etait un dessin Art Deco, en hommage aux
   Jeux de Paris 1924.

   On ne peut pas embarquer la fonte des Jeux : elle est proprietaire, faite
   pour cette competition-la, et les copies qui circulent en telechargement
   libre n'ont rien d'officiel. Ces chiffres sont donc redessines — huit
   glyphes, de 1 a 8, construits comme l'Art Deco les construit : au compas
   et a la regle. Cercles entiers pour les panses, barres horizontales
   franches, diagonales droites, une seule graisse partout.

   Les tracer plutot que les ecrire a trois avantages qui comptent ici :
   aucune fonte a charger (le jeu s'installe et tourne hors ligne), aucun
   rendu different d'un telephone a l'autre, et une graisse qui suit
   exactement l'echelle du dessin de la piste.

   Le glyphe est defini dans une boite unite : x de 0 a LARGE, y de 0 (haut)
   a 1 (bas), et c'est l'axe des lignes MEDIANES du trait — les extremites
   sont donc rentrees d'une demi-graisse pour que l'encre reste dans la
   boite.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const LARGE = 0.62;          // largeur de la boite, hauteur = 1
  const TRAIT = 0.175;         // graisse du trait
  const D = TRAIT / 2;         // rentre des extremites

  const G = LARGE - D;         // bord droit des medianes
  const H = D;                 // bord gauche des medianes
  const HAUT = D, BAS = 1 - D;
  const MIL = LARGE / 2;       // axe vertical
  const R = (G - H) / 2;       // rayon d'une panse pleine largeur

  // Centre de la panse basse : elle touche la ligne de pied.
  const YBAS = BAS - R;

  const TAU = Math.PI * 2;

  // Les huit glyphes. Chacun trace son chemin dans la boite unite ; le
  // remplissage et la graisse sont poses par dessiner().
  const GLYPHES = {
    // Fut et drapeau. Pas de pied : sur une piste le 1 est nu.
    1: (c) => {
      c.moveTo(H, 0.38); c.lineTo(MIL, HAUT); c.lineTo(MIL, BAS);
    },
    // Demi-cercle, diagonale franche, barre de pied pleine largeur.
    2: (c) => {
      c.arc(MIL, HAUT + R, R, Math.PI, TAU);
      c.lineTo(H, BAS);
      c.lineTo(G, BAS);
    },
    // Barre de tete plate — le 3 Art Deco ne commence pas par une courbe —
    // puis diagonale et panse basse ouverte a gauche.
    3: (c) => {
      c.moveTo(H, HAUT); c.lineTo(G, HAUT);
      c.lineTo(MIL, YBAS - R);
      c.arc(MIL, YBAS, R, -Math.PI / 2, Math.PI);
    },
    // Compteur ferme, en triangle. Le fut traverse la barre.
    4: (c) => {
      c.moveTo(0.47, HAUT); c.lineTo(H, 0.70); c.lineTo(G, 0.70);
      c.moveTo(0.47, HAUT); c.lineTo(0.47, BAS);
    },
    // Barre de tete, fut jusqu'a mi-hauteur, epaule, puis panse basse. Le
    // fut s'arrete AU-DESSUS de la panse : c'est cet ecart qui ouvre le 5
    // a gauche. Le faire descendre jusqu'au flanc de la panse refermait la
    // boucle et donnait un B.
    5: (c) => {
      c.moveTo(G, HAUT); c.lineTo(H, HAUT); c.lineTo(H, 0.44);
      c.arc(MIL, YBAS, R, -Math.PI / 2, Math.PI);
    },
    // Cercle plein en bas, et une courbe qui monte le chercher.
    6: (c) => {
      c.moveTo(0.50, 0.15);
      c.bezierCurveTo(0.30, 0.00, H, 0.20, H, YBAS);
      c.moveTo(H, YBAS); c.arc(MIL, YBAS, R, Math.PI, Math.PI + TAU);
    },
    // Barre de tete et diagonale, sans barre mediane.
    7: (c) => {
      c.moveTo(H, HAUT); c.lineTo(G, HAUT); c.lineTo(0.21, BAS);
    },
    // Deux cercles, le haut plus petit que le bas : le 8 Deco est assis.
    8: (c) => {
      const rh = 0.185, yh = HAUT + rh;
      c.moveTo(MIL + rh, yh); c.arc(MIL, yh, rh, 0, TAU);
      c.moveTo(MIL + R, YBAS); c.arc(MIL, YBAS, R, 0, TAU);
    }
  };

  /**
   * Peindre un chiffre centre sur (x, y), d'une hauteur de `haut` pixels.
   *
   * `graisse` multiplie l'epaisseur du trait — la peinture d'une piste est
   * franche, on ne l'amincit pas quand le chiffre est petit.
   */
  function dessiner(ctx, chiffre, x, y, haut, couleur, graisse) {
    const g = GLYPHES[chiffre];
    if (!g || !(haut > 0)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(haut, haut);
    ctx.translate(-LARGE / 2, -0.5);
    ctx.beginPath();
    g(ctx);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = TRAIT * (graisse || 1);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;
    ctx.stroke();
    ctx.restore();
  }

  /** Largeur au sol d'un chiffre de cette hauteur, pour le centrer. */
  function largeur(haut) { return LARGE * haut; }

  root.ChiffresPiste = { dessiner, largeur, LARGE, TRAIT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
