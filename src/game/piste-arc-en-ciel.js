/* -----------------------------------------------------------------------
   SPRINTER — LA PISTE ARC-EN-CIEL.

   Une piste qui flotte dans l'espace, et qui ne ressemble a aucune autre du
   jeu parce qu'elle n'est pas en tartan : elle est en LUMIERE. Quatre choses
   la font, et chacune tient ici.

   - LES COULEURS. Chaque couloir a la sienne, les sept du ciel plus une, de
     la corde vers l'exterieur. Elles sont un peu translucides : le champ
     d'etoiles peint dessous (decor-cosmos.js) transparait a travers, et
     c'est ce qui dit que la piste est un pont de lumiere et non un sol.
   - LES DALLES. Un joint fin tous les deux metres et demi : une surface
     d'une seule coulee sur cent metres se lit comme un ruban de papier ; des
     dalles se lisent comme un ouvrage.
   - LE REFLET QUI COURT. Une vague de lumiere blanche parcourt la piste dans
     le sens de la course, plus vite que les coureurs. C'est le seul
     mouvement du decor que l'oeil voit sans le chercher, et c'est lui qui
     rend la piste vivante meme quand personne ne court.
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

  const DALLE = 2.5;          // metres entre deux joints
  const REFLET_PERIODE = 34;  // metres entre deux vagues de lumiere
  const REFLET_VITESSE = 16;  // m/s : plus vite que le plus rapide des coureurs
  const AMPOULE_PAS = 1.5;    // metres entre deux ampoules
  const TAU = Math.PI * 2;

  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const horloge = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  /** Le rayon d'une ligne peinte, ligne droite comprise. */
  function ligne(T, C, e) {
    return T.curved ? T.edge(e) : e * C.LANE_W;
  }

  /**
   * La surface : les couloirs, les joints des dalles et le reflet qui court.
   * Remplace le `band(trackA)` des autres stades, au meme endroit du trace.
   */
  function surface(ctx, P, th, sm, rIn, rOut) {
    const T = P.G.track, C = P.C;
    const cols = th.arcEnCiel;
    const alpha = th.arcAlpha == null ? 0.86 : th.arcAlpha;
    for (let e = 0; e < C.LANE_COUNT; e++) {
      P.band(ctx, sm, ligne(T, C, e), ligne(T, C, e + 1), rgba(cols[e % cols.length], alpha));
    }
    // Un liseret plus clair au milieu de chaque couloir : la lumiere vient du
    // coeur de la dalle, pas de ses bords.
    for (let e = 0; e < C.LANE_COUNT; e++) {
      const a = ligne(T, C, e), b = ligne(T, C, e + 1), m = (a + b) / 2, l = (b - a) * 0.18;
      P.band(ctx, sm, m - l, m + l, 'rgba(255,255,255,0.10)');
    }

    // Les joints : des traits en travers, d'une ligne de bord a l'autre.
    const joints = P.samples(DALLE);
    ctx.beginPath();
    for (let i = 0; i < joints.length; i++) {
      const a = P.ground(...P.ptOf(joints[i], rIn)), b = P.ground(...P.ptOf(joints[i], rOut));
      if ((a[0] < -40 && b[0] < -40) || (a[0] > P.G.VW + 40 && b[0] > P.G.VW + 40)) continue;
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.strokeStyle = 'rgba(16,6,40,0.30)';
    ctx.lineWidth = Math.max(1, 1.1 * P.ui());
    ctx.stroke();

    // Le reflet qui court. La distance d'un echantillon se compte a son rang :
    // `samples(pas)` les pose a pas regulier, virage compris.
    const pas = 1.25, fin = P.samples(pas), t = horloge();
    for (let i = 0; i + 1 < fin.length; i++) {
      const x = i * pas - t * REFLET_VITESSE;
      const c = Math.cos(TAU * x / REFLET_PERIODE);
      if (c < 0.55) continue;
      const a = 0.26 * Math.pow((c - 0.55) / 0.45, 3);
      if (a < 0.01) continue;
      P.band(ctx, [fin[i], fin[i + 1]], rIn, rOut, 'rgba(255,255,255,' + a.toFixed(3) + ')');
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
