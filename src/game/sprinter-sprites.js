/* -----------------------------------------------------------------------
   SPRINTER — rendu des athletes par planches de sprites.

   Les sept ZEZE sont modelises dans Blender puis rendus en planches
   (12 poses x 8 orientations) dans la projection isometrique EXACTE du
   moteur. Ce module remplace le dessin en capsules pour ces athletes-la ;
   pour tous les autres, et tant que les planches ne sont pas chargees, il
   refuse poliment et le rendu procedural reprend la main. Le jeu reste
   donc jouable meme si les images ne sont jamais arrivees.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const K = root.SprinterCore;

  // --- geometrie des planches (voir assets/sprites/manifest.json) --------
  // Le rendu Blender est en pixels carres alors que la projection du jeu a
  // deux echelles differentes : on retablit l'ecart en etirant la largeur.
  const TILE_W = 96, TILE_H = 112;
  const ANGLES = 8, FRAMES = 12;
  const ANCHOR_X = 48, ANCHOR_Y = 98.82;
  const ANISO = 1.069045;
  // pixels par unite de hauteur monde dans la planche :
  // pixelsPerUnit (53.3333) x composante Z de l'axe vertical (0.845154)
  const PX_PER_Z = 45.0749;

  // Reglages de calage, volontairement exposes : la correspondance entre
  // l'azimut d'une ligne de planche et le cap du coureur, puis le decalage
  // entre la phase de foulee du moteur et celle des tables Blender.
  // Ces deux valeurs ne sont pas devinees : elles viennent d'une correlation
  // silhouette a silhouette entre le rendu en capsules et chacune des huit
  // orientations, sur tout le cycle. Le meilleur recouvrement (IoU 0,627)
  // tombe sur la ligne 0 sans decalage ; les trois candidats suivants sont
  // la meme ligne a une image pres, ce qui confirme l'orientation.
  const TUNE = {
    angleOffset: 0.0,           // ligne de planche = cap du coureur
    phaseOffset: 0.0,           // en fraction de cycle
    enabled: true,
    // Sans ceci, seules les sept ZEZE de la derniere etape auraient un
    // sprite et tout le reste du jeu resterait en capsules. A false, on
    // revient a ce comportement strict.
    morphFallback: true,
    // Repeint maillot / short / chaussures aux couleurs du coureur, sinon il
    // porte celles de la planche qu'on lui a pretee.
    tint: true
  };

  const SHEETS = Object.create(null);   // cle -> {img, ok}
  const BY_BUILD = { m: [], f: [] };    // planches classees par gabarit
  let manifest = null;

  function keyOf(name) {
    if (!name) return null;
    const m = /^([A-Za-z]+)\s+ZEZE$/.exec(name);
    return m ? m[1].toLowerCase() : null;
  }

  /** Les sept planches ne couvrent que le roster ZEZE, qui n'apparait qu'a
      la derniere etape. Pour tout le reste du plateau on prete la planche du
      gabarit le plus proche (meme sexe, taille voisine) : le maillot ne sera
      pas celui du coureur, mais la silhouette et la foulee sont justes. */
  function pickByMorph(look) {
    if (!look) return null;
    const list = BY_BUILD[look.build === 'f' ? 'f' : 'm'];
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = Math.abs(list[i].h - (look.h || 1.8));
      if (d < bd) { bd = d; best = list[i]; }
    }
    if (!best) return null;
    const s = SHEETS[best.key];
    return (s && s.ok) ? s : null;
  }

  /** Charge le manifeste puis les planches. Tout echec est silencieux :
      le moteur continue avec ses capsules. */
  function load(base) {
    const root_ = (base || '/').replace(/\/$/, '') + '/sprites/';
    return fetch(root_ + 'manifest.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (mf) {
        manifest = mf;
        BY_BUILD.m.length = 0; BY_BUILD.f.length = 0;
        Object.keys(mf.characters || {}).forEach(function (key) {
          const c = mf.characters[key];
          const img = new Image();
          const slot = { img: img, ok: false, key: key,
                         mask: null, maskOk: false, colors: c.colors || null };
          SHEETS[key] = slot;
          (BY_BUILD[c.build === 'f' ? 'f' : 'm']).push({ key: key, h: c.heightM || 1.8 });
          img.onload = function () { slot.ok = true; };
          img.onerror = function () { slot.ok = false; };
          img.src = root_ + c.file;
          // Masque de zones : sans lui, on dessine la planche telle quelle et
          // le coureur porte le maillot du ZEZE qui lui a ete prete.
          if (c.mask) {
            const mk = new Image();
            slot.mask = mk;
            mk.onload = function () { slot.maskOk = true; };
            mk.onerror = function () { slot.maskOk = false; };
            mk.src = root_ + c.mask;
          }
        });
      })
      .catch(function () { manifest = null; });
  }

  function sheetFor(person) {
    if (!TUNE.enabled || !person) return null;
    const key = keyOf(person.name);
    if (key) {
      const s = SHEETS[key];
      if (s && s.ok) return s;
    }
    return TUNE.morphFallback ? pickByMorph(person.look) : null;
  }

  /** Dessine l'athlete depuis sa planche.
      Renvoie false si aucun sprite n'est disponible : l'appelant doit alors
      retomber sur le rendu en capsules. */
  function draw(ctx, person, ax, ay, k, headAng, lean, mirror) {
    const slot = sheetFor(person);
    if (!slot) return false;

    const look = person.look;
    // k porte deja la taille de l'athlete ; les planches aussi (les sept
    // sont rendus a la meme echelle). On revient donc a l'echelle du monde
    // pour ne pas appliquer deux fois la stature.
    const m = k * K.C.MODEL_H / (look && look.h ? look.h : K.C.MODEL_H);
    const sv = m / PX_PER_Z;
    const sh = sv * ANISO;

    const TAU = Math.PI * 2;
    let a = Math.round(((headAng || 0) + TUNE.angleOffset) / (TAU / ANGLES));
    a = ((a % ANGLES) + ANGLES) % ANGLES;

    const ph = ((person.stride || 0) / TAU) + TUNE.phaseOffset;
    let f = Math.floor((ph - Math.floor(ph)) * FRAMES);
    if (f < 0) f = 0; else if (f >= FRAMES) f = FRAMES - 1;

    const dw = TILE_W * sh, dh = TILE_H * sv;
    const dx = ax - ANCHOR_X * sh, dy = ay - ANCHOR_Y * sv;

    const tilt = lean || 0;
    const flip = !!mirror;
    if (tilt || flip) {
      ctx.save();
      ctx.translate(ax, ay);
      if (tilt) ctx.rotate(-tilt);
      // le miroir des capsules inverse l'axe avant/arriere du coureur ;
      // sur un sprite deja projete, le retournement horizontal en est
      // l'equivalent le plus proche.
      if (flip) ctx.scale(-1, 1);
      ctx.translate(-ax, -ay);
    }
    // la transformation ci-dessus miroite deja autour de ax : on dessine
    // aux memes coordonnees, sans repositionner a la main.
    let tinted = null;
    if (TUNE.tint && needsTint(slot, look)) tinted = tintedTile(slot, look, a, f);
    if (tinted) ctx.drawImage(tinted, 0, 0, TILE_W, TILE_H, dx, dy, dw, dh);
    else ctx.drawImage(slot.img, f * TILE_W, a * TILE_H, TILE_W, TILE_H,
                       dx, dy, dw, dh);
    if (tilt || flip) ctx.restore();
    return true;
  }

  // --- reteinte du kit ---------------------------------------------------
  // Une planche est rendue avec le maillot d'un athlete precis. Pour que les
  // autres coureurs gardent LEURS couleurs, on repeint les zones du masque en
  // conservant l'ombrage : on garde le rapport de luminance entre le pixel et
  // la couleur d'origine, et on l'applique a la couleur voulue.
  const TINT = new Map();
  const TINT_MAX = 420;               // tuiles reteintes gardees en memoire
  let scratch = null, scratchMask = null;

  function lum(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

  function rgbKey(c) {
    return c ? (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) : '-';
  }

  function needsTint(slot, look) {
    if (!slot.maskOk || !slot.colors || !look) return false;
    return rgbKey(look.jersey) !== rgbKey(slot.colors.jersey) ||
           rgbKey(look.shorts) !== rgbKey(slot.colors.shorts) ||
           rgbKey(look.shoe)   !== rgbKey(slot.colors.shoe);
  }

  function tintedTile(slot, look, a, f) {
    const key = slot.key + '|' + rgbKey(look.jersey) + '|' + rgbKey(look.shorts) +
                '|' + rgbKey(look.shoe) + '|' + a + '|' + f;
    const hit = TINT.get(key);
    if (hit) return hit;

    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = TILE_W; scratch.height = TILE_H;
      scratchMask = document.createElement('canvas');
      scratchMask.width = TILE_W; scratchMask.height = TILE_H;
    }
    const sx = f * TILE_W, sy = a * TILE_H;
    const g = scratch.getContext('2d', { willReadFrequently: true });
    const gm = scratchMask.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, TILE_W, TILE_H);
    gm.clearRect(0, 0, TILE_W, TILE_H);
    g.drawImage(slot.img, sx, sy, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H);
    gm.drawImage(slot.mask, sx, sy, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H);

    let px, mx;
    try {
      px = g.getImageData(0, 0, TILE_W, TILE_H);
      mx = gm.getImageData(0, 0, TILE_W, TILE_H);
    } catch (e) { return null; }      // canvas sali : on renonce proprement

    const d = px.data, m = mx.data;
    const src = slot.colors;
    const zones = [
      [lum(src.jersey[0], src.jersey[1], src.jersey[2]), look.jersey],
      [lum(src.shorts[0], src.shorts[1], src.shorts[2]), look.shorts],
      [lum(src.shoe[0],   src.shoe[1],   src.shoe[2]),   look.shoe]
    ];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8 || m[i + 3] < 128) continue;
      const zi = (m[i] > 128) ? 0 : (m[i + 1] > 128) ? 1 : (m[i + 2] > 128) ? 2 : -1;
      if (zi < 0) continue;
      const z = zones[zi], tgt = z[1];
      if (!tgt) continue;
      const ratio = z[0] > 1 ? lum(d[i], d[i + 1], d[i + 2]) / z[0] : 1;
      const r = tgt[0] * ratio, gg = tgt[1] * ratio, b = tgt[2] * ratio;
      d[i]     = r  > 255 ? 255 : r;
      d[i + 1] = gg > 255 ? 255 : gg;
      d[i + 2] = b  > 255 ? 255 : b;
    }
    g.putImageData(px, 0, 0);

    const out = document.createElement('canvas');
    out.width = TILE_W; out.height = TILE_H;
    out.getContext('2d').drawImage(scratch, 0, 0);
    if (TINT.size >= TINT_MAX) TINT.delete(TINT.keys().next().value);
    TINT.set(key, out);
    return out;
  }

  function ready() {
    let n = 0;
    for (const key in SHEETS) if (SHEETS[key].ok) n++;
    return n;
  }

  root.SprinterSprites = {
    load: load, draw: draw, ready: ready, TUNE: TUNE,
    keyOf: keyOf, sheets: SHEETS,
    geom: { TILE_W: TILE_W, TILE_H: TILE_H, ANGLES: ANGLES, FRAMES: FRAMES,
            ANCHOR_X: ANCHOR_X, ANCHOR_Y: ANCHOR_Y, ANISO: ANISO,
            PX_PER_Z: PX_PER_Z }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
