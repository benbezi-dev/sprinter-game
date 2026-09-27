/* -----------------------------------------------------------------------
   SPRINTER — LA PISTE ARC-EN-CIEL.

   Une piste qui flotte dans l'espace, et qui ne ressemble a aucune autre du
   jeu parce qu'elle n'est pas en tartan : elle est en LUMIERE.

   - LES COULEURS, UNIES. Chaque couloir a la sienne, saturee et opaque, de
     la corde vers l'exterieur. Une premiere version les voulait
     translucides, avec un liseret clair au coeur de chaque couloir, des
     joints de dalles et un reflet blanc qui courait dessus : tout cela
     ajoutait du blanc ou du noir a chaque couleur, et la piste en sortait
     delavee. Huit aplats francs se lisent mieux qu'une surface travaillee.
     C'est aussi pourquoi ce theme n'a ni brume ni grain (`sansBrume`,
     `sansGrain`).
   - LES GUIRLANDES. Une ampoule tous les metres et demi sur les deux bords,
     dont les couleurs se poursuivent. Le long d'une piste qui flotte, c'est
     la seule limite qui se voie — et elle defile avec le coureur, ce qui
     donne la vitesse.

   Tout est reserve au theme qui porte `arcEnCiel` : aucun autre stade ne
   passe par ici. Et rien n'y est indispensable — sans ce module, la piste
   serait peinte de sa couleur `trackA`, comme les autres.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const AMPOULE_PAS = 1.5;    // metres entre deux ampoules

  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const horloge = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  /** Le rayon d'une ligne peinte, ligne droite comprise. */
  function ligne(T, C, e) {
    return T.curved ? T.edge(e) : e * C.LANE_W;
  }

  /**
   * La surface : un aplat par couloir. Remplace le `band(trackA)` des autres
   * stades, au meme endroit du trace.
   */
  function surface(ctx, P, th, sm) {
    const T = P.G.track, C = P.C, cols = th.arcEnCiel;
    for (let e = 0; e < C.LANE_COUNT; e++) {
      P.band(ctx, sm, ligne(T, C, e), ligne(T, C, e + 1), rgba(cols[e % cols.length], 1));
    }
  }

  // -------------------------------------------------------------------
  // LES AMPOULES
  // -------------------------------------------------------------------
  // Une image par couleur, cuite une fois : un coeur blanc, la couleur, puis
  // la lueur qui s'eteint. Posee en mode additif, elle eclaire ce qu'elle
  // recouvre au lieu de le cacher.
  const _sprites = new Map();
  function sprite(col) {
    const cle = col.join();
    let s = _sprites.get(cle);
    if (s) return s;
    const R = 32;
    s = document.createElement('canvas');
    s.width = s.height = R * 2;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.16, rgba(col, 1));
    g.addColorStop(0.4, rgba(col, 0.35));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, R * 2, R * 2);
    _sprites.set(cle, s);
    return s;
  }

  /**
   * Les guirlandes des deux bords. A appeler apres les lignes peintes : une
   * ampoule est posee sur la bordure, elle ne passe pas dessous.
   */
  function guirlandes(ctx, P, th, rIn, rOut) {
    const G = P.G, cols = th.arcEnCiel, n = cols.length;
    const sm = P.samples(AMPOULE_PAS), t = horloge();
    const taille = Math.max(6, 0.62 * P.scaleM());
    const decale = Math.floor(t * 7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [r, sens] of [[rIn - 0.12, 1], [rOut + 0.12, -1]]) {
      for (let i = 0; i < sm.length; i++) {
        const p = P.solid(...P.ptOf(sm[i], r), 0.12);
        if (p[0] < -taille || p[0] > G.VW + taille || p[1] < -taille || p[1] > G.VH + taille) continue;
        // Les couleurs se poursuivent : chaque ampoule prend celle de sa
        // voisine un septieme de seconde plus tard.
        const col = cols[(((i + sens * decale) % n) + n) % n];
        ctx.drawImage(sprite(col), p[0] - taille / 2, p[1] - taille / 2, taille, taille);
      }
    }
    ctx.restore();
  }

  root.PisteArcEnCiel = { surface, guirlandes };
})(typeof globalThis !== 'undefined' ? globalThis : this);
