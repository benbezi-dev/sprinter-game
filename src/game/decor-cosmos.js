/* -----------------------------------------------------------------------
   SPRINTER — LE VIDE SOUS LA PISTE INTERGALACTIQUE.

   Le stade Inter galactique posait une piste violette sur un aplat violet
   sombre : la « pelouse » y etait la meme surface qu'ailleurs, repeinte de
   nuit. Rien ne disait qu'on courait dans l'espace, sinon la couleur — et une
   couleur ne raconte pas un lieu. A l'ecran, un tiers de l'image etait un
   fond uni.

   Ici, ce fond devient ce qu'il pretend etre : le VIDE, loin sous la piste.
   Trois choses le disent.

   - Un champ d'etoiles et des nebuleuses, en une tuile cuite une fois.
   - Des planetes, posees le long du trace.
   - LA PARALLAXE, qui fait tout. Etoiles et planetes defilent MOINS VITE que
     la piste : l'oeil en conclut, sans qu'on le lui dise, qu'elles sont
     loin en dessous. La piste cesse d'etre posee sur un sol violet, elle
     flotte. Les etoiles a 30 % de la vitesse du monde, les planetes a 55 % :
     deux profondeurs, et le vide a de l'epaisseur.

   Et le bord de la piste s'allume (voir `neon`), pour qu'une surface qui
   flotte dans le noir ait une limite qui se voie.

   Rien de tout cela n'est indispensable : le theme doit porter `espace` pour
   que ce module dessine quoi que ce soit, et le jeu tourne sans lui.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const PAR_ETOILES = 0.30, PAR_PLANETES = 0.55;

  // -------------------------------------------------------------------
  // LA TUILE D'ETOILES
  // -------------------------------------------------------------------
  // Assez grande pour que la repetition ne se lise pas : a 768 pixels, et
  // avec la parallaxe, une meme nebuleuse ne revient pas deux fois dans le
  // cadre.
  const TUILE = 768;
  let _motif = null, _ctxMotif = null;

  function motif(ctx, th) {
    if (_motif && _ctxMotif === ctx) return _motif;
    const t = document.createElement('canvas');
    t.width = TUILE; t.height = TUILE;
    const c = t.getContext('2d');
    // Suite deterministe : le ciel est le meme d'une course a l'autre.
    let s = 0x2545f491 >>> 0;
    const al = () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    const rgba = (col, a) => 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')';
    // Chaque tache est dessinee neuf fois, decalee d'une tuile : la tuile se
    // raccorde a elle-meme sans couture.
    const neuf = (x, y, r, fn) => {
      for (const dx of [0, -TUILE, TUILE]) {
        for (const dy of [0, -TUILE, TUILE]) {
          if (x + dx + r < 0 || x + dx - r > TUILE || y + dy + r < 0 || y + dy - r > TUILE) continue;
          fn(x + dx, y + dy);
        }
      }
    };

    // Les nebuleuses : de grandes nappes tres douces, aux couleurs du stade.
    // Assez pales pour rester un fond — elles donnent au noir une matiere,
    // pas un sujet.
    const teintes = th.nebuleuses || [[196, 72, 190], [52, 150, 220], [120, 70, 210]];
    for (let i = 0; i < 7; i++) {
      const x = al() * TUILE, y = al() * TUILE;
      const r = TUILE * (0.16 + al() * 0.22);
      const col = teintes[i % teintes.length];
      const a = 0.07 + al() * 0.07;
      neuf(x, y, r, (px, py) => {
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgba(col, a.toFixed(3)));
        g.addColorStop(0.5, rgba(col, (a * 0.45).toFixed(3)));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(px - r, py - r, r * 2, r * 2);
      });
    }

    // Les etoiles : trois calibres. Beaucoup de poussiere a peine visible,
    // quelques etoiles franches, et une poignee de brillantes avec leur
    // croix — c'est la hierarchie qui fait un ciel, pas le nombre.
    const teinteEtoile = () => {
      const v = al();
      return v < 0.12 ? [180, 220, 255] : v < 0.2 ? [255, 206, 240] : v < 0.26 ? [255, 232, 180] : [255, 255, 255];
    };
    for (let i = 0; i < 520; i++) {
      const x = al() * TUILE, y = al() * TUILE;
      c.fillStyle = rgba(teinteEtoile(), (0.25 + al() * 0.45).toFixed(2));
      const z = al() < 0.8 ? 1 : 1.5;
      c.fillRect(x, y, z, z);
    }
    for (let i = 0; i < 60; i++) {
      const x = al() * TUILE, y = al() * TUILE, r = 2.2 + al() * 1.8;
      const col = teinteEtoile();
      neuf(x, y, r * 2, (px, py) => {
        const g = c.createRadialGradient(px, py, 0, px, py, r * 2);
        g.addColorStop(0, rgba(col, 0.95));
        g.addColorStop(0.25, rgba(col, 0.45));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
      });
    }
    for (let i = 0; i < 9; i++) {
      const x = al() * TUILE, y = al() * TUILE, L = 7 + al() * 7;
      const col = teinteEtoile();
      neuf(x, y, L, (px, py) => {
        const g = c.createRadialGradient(px, py, 0, px, py, L * 0.7);
        g.addColorStop(0, rgba(col, 0.9));
        g.addColorStop(0.3, rgba(col, 0.25));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(px - L, py - L, L * 2, L * 2);
        c.strokeStyle = rgba(col, 0.55);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(px - L, py); c.lineTo(px + L, py);
        c.moveTo(px, py - L); c.lineTo(px, py + L);
        c.stroke();
      });
    }
    _motif = ctx.createPattern(t, 'repeat');
    _ctxMotif = ctx;
    return _motif;
  }

  // -------------------------------------------------------------------
  // LES PLANETES
  // -------------------------------------------------------------------
  // Ou elles sont, en part de la course et en couloirs du cote de la
  // pelouse : negatif, c'est l'interieur de la piste, la moitie de l'image
  // que les tribunes ne cachent pas. `R` est le rayon en metres, avant
  // parallaxe.
  const PLANETES = [
    { f: 0.10, couloir: -12, R: 5.2, col: [214, 92, 200], anneau: true, bandes: 3 },
    { f: 0.42, couloir: -24, R: 10.5, col: [58, 170, 214], anneau: false, bandes: 5 },
    { f: 0.72, couloir: -10, R: 2.6, col: [236, 162, 84], anneau: false, bandes: 0 },
    { f: 0.95, couloir: -18, R: 6.4, col: [130, 110, 236], anneau: true, bandes: 4 },
  ];
  const _sprites = new Map();

  const eclaircir = (col, k) => col.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  const rgb = (col) => 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
  const rgba = (col, a) => 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')';

  /** L'image d'une planete, cuite une fois par taille a l'ecran. */
  function sprite(i, pl, r) {
    const cle = i + '|' + r;
    let e = _sprites.get(cle);
    if (e) return e;
    const marge = pl.anneau ? 2.4 : 1.9;
    const w = Math.ceil(r * marge * 2) + 4;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = w;
    const c = cv.getContext('2d');
    const cx = w / 2, cy = w / 2;
    const inc = -0.38;
    const anneau = (devant) => {
      c.save();
      c.translate(cx, cy); c.rotate(inc);
      c.beginPath();
      // La moitie basse de l'anneau passe DEVANT la planete, la haute
      // derriere : on les trace en deux fois, de part et d'autre du disque.
      c.rect(-w, devant ? 0 : -w, 2 * w, w);
      c.clip();
      for (const [k, a, lw] of [[2.15, 0.30, 0.20], [1.75, 0.55, 0.16], [1.45, 0.35, 0.08]]) {
        c.beginPath();
        c.ellipse(0, 0, r * k, r * k * 0.26, 0, 0, TAU);
        c.strokeStyle = rgba(eclaircir(pl.col, 1.5), a);
        c.lineWidth = Math.max(1, r * lw);
        c.stroke();
      }
      c.restore();
    };
    // Le halo : l'atmosphere, eclairee par-derriere.
    const h = c.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.8);
    h.addColorStop(0, rgba(pl.col, 0.35));
    h.addColorStop(1, rgba(pl.col, 0));
    c.fillStyle = h;
    c.fillRect(0, 0, w, w);
    if (pl.anneau) anneau(false);
    // Le disque, eclaire d'en haut a gauche — la ou sont les projecteurs du
    // stade dans tout le jeu.
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    const g = c.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, rgb(eclaircir(pl.col, 1.55)));
    g.addColorStop(0.45, rgb(pl.col));
    g.addColorStop(1, rgb(eclaircir(pl.col, 0.28)));
    c.fillStyle = g;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Les bandes d'une geante gazeuse, inclinees comme son anneau.
    if (pl.bandes) {
      c.translate(cx, cy); c.rotate(inc);
      for (let b = 0; b < pl.bandes; b++) {
        const y = -r + (b + 0.7) * (2 * r / (pl.bandes + 0.4));
        c.fillStyle = b % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.13)';
        c.fillRect(-r * 1.2, y, r * 2.4, r * (0.12 + 0.1 * ((b * 7) % 3)));
      }
    }
    c.restore();
    // Le liseret de lumiere du cote eclaire.
    c.beginPath(); c.arc(cx, cy, r - 0.5, Math.PI * 0.95, Math.PI * 1.6);
    c.strokeStyle = rgba(eclaircir(pl.col, 1.9), 0.55);
    c.lineWidth = Math.max(1, r * 0.05);
    c.stroke();
    if (pl.anneau) anneau(true);
    e = { cv, w };
    _sprites.set(cle, e);
    if (_sprites.size > 64) _sprites.delete(_sprites.keys().next().value);
    return e;
  }

  // -------------------------------------------------------------------
  // LES ASTRES RENDUS DANS BLENDER
  // -------------------------------------------------------------------
  // Un theme peut remplacer les planetes peintes ci-dessus par des images
  // rendues en eclairage reel (tools/blender/decors/astres.py) : `astres`
  // en donne la liste, et chaque image porte son astre au centre, d'un rayon
  // de RAYON_ASTRE pixels. Tant qu'une image n'est pas chargee, son astre
  // n'est simplement pas dessine.
  const RAYON_ASTRE = 200;
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');
  const _images = new Map();
  function imageAstre(chemin) {
    let im = _images.get(chemin);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.src = BASE + '/decors/' + chemin;
      _images.set(chemin, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  function planetes(ctx, P, th) {
    const G = P.G, T = G.track;
    if (!T || !T.pos) return;
    const cx = G.VW / 2, cy = G.VH / 2;
    const m = P.scaleM();
    if (th.astres) {
      for (const a of th.astres) {
        const w = T.pos(a.f * T.total, a.couloir);
        const g = P.ground(w[0], w[1]);
        const x = cx + (g[0] - cx) * PAR_PLANETES, y = cy + (g[1] - cy) * PAR_PLANETES;
        const r = a.R * m * PAR_PLANETES;
        const im = imageAstre(a.img);
        if (!im) continue;
        const k = r / RAYON_ASTRE, L = im.naturalWidth * k;
        if (x + L / 2 < 0 || x - L / 2 > G.VW || y + L / 2 < 0 || y - L / 2 > G.VH) continue;
        ctx.drawImage(im, x - L / 2, y - L / 2, L, L);
      }
      return;
    }
    for (let i = 0; i < PLANETES.length; i++) {
      const pl = PLANETES[i];
      const w = T.pos(pl.f * T.total, pl.couloir);
      const g = P.ground(w[0], w[1]);
      // La parallaxe : l'ecart au centre de l'ecran est reduit, comme pour
      // un objet plus loin de la camera que la piste.
      const x = cx + (g[0] - cx) * PAR_PLANETES, y = cy + (g[1] - cy) * PAR_PLANETES;
      const r = Math.max(2, Math.round(pl.R * m * PAR_PLANETES));
      const marge = r * 2.6;
      if (x < -marge || x > G.VW + marge || y < -marge || y > G.VH + marge) continue;
      const sp = sprite(i, pl, r);
      ctx.drawImage(sp.cv, x - sp.w / 2, y - sp.w / 2);
    }
  }

  /**
   * Le vide, par-dessus la « pelouse » et sous tout le reste. A appeler
   * juste apres les aplats de pelouse : la piste, les gradins et le decor
   * viennent le recouvrir.
   */
  function fond(ctx, P, th) {
    if (!th.espace) return;
    const G = P.G;
    const m = motif(ctx, th);
    if (m) {
      const a = P.ground(0, 0);
      const ox = (((a[0] * PAR_ETOILES) % TUILE) + TUILE) % TUILE;
      const oy = (((a[1] * PAR_ETOILES) % TUILE) + TUILE) % TUILE;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = m;
      ctx.fillRect(-ox, -oy, G.VW, G.VH);
      ctx.restore();
    }
    planetes(ctx, P, th);
  }

  /**
   * LE BORD QUI S'ALLUME. Deux traits larges et translucides sous le liseret
   * interieur et le bord exterieur : une lueur, sans flou — `shadowBlur`
   * coute trop cher a un telephone pour une ligne qui court sur tout le
   * cadre. A appeler AVANT les lignes peintes, qui restent nettes dessus.
   */
  function neon(ctx, P, th, sm, rIn, rOut) {
    if (!th.neon) return;
    const k = P.ui();
    for (const [r, col] of [[rIn, th.neon], [rOut, th.neonExt || th.neon]]) {
      P.rail(ctx, sm, r, rgba(col, 0.10), 16 * k);
      P.rail(ctx, sm, r, rgba(col, 0.22), 8 * k);
      P.rail(ctx, sm, r, rgba(col, 0.45), 3.5 * k);
    }
  }

  root.DecorCosmos = { fond, neon };
})(typeof globalThis !== 'undefined' ? globalThis : this);
