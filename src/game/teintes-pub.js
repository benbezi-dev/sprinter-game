/* -----------------------------------------------------------------------
   SPRINTER — la couleur du logo BENBEZI sur les panneaux publicitaires.

   Elle est tiree au sort a chaque course, mais jamais n'importe laquelle :
   elle doit se detacher du stade ou elle s'affiche. On ecarte donc toute
   teinte trop proche d'une couleur du decor — piste, sol, ciel, gradins, toit,
   muret, neons, et les panneaux voisins, qui sont les autres annonceurs — en
   mesurant l'ecart comme l'oeil le percoit (CIELAB, ΔE 1976). Le tirage se
   fait parmi celles qui restent.

   Toutes les teintes sont claires : sur le noir de l'ecran LED, le logo
   ressort d'abord par sa lumiere, et un logo sombre y disparaitrait.

   LE BLANC RESTE TOUJOURS DANS LE TIRAGE. C'est le logo tel qu'il sort de
   Blender, sans teinture (`origine`), et il ne passe pas par le filtre : blanc
   sur l'ecran noir, il ressort par sa lumiere dans n'importe quel stade, meme
   la ou le decor porte du blanc ou du gris clair.

   Aucune dependance au navigateur : ce fichier se charge tel quel dans Node
   pour etre verifie (voir tools/teintes-pub-test.mjs).
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const TEINTES = [
    { nom: 'blanc', rgb: [236, 240, 248], origine: true, toujours: true },
    { nom: 'or', rgb: [255, 196, 64] },
    { nom: 'jaune', rgb: [255, 236, 72] },
    { nom: 'citron', rgb: [168, 255, 96] },
    { nom: 'turquoise', rgb: [64, 236, 200] },
    { nom: 'cyan', rgb: [72, 216, 255] },
    { nom: 'bleu', rgb: [96, 150, 255] },
    { nom: 'violet', rgb: [186, 120, 255] },
    { nom: 'rose', rgb: [255, 96, 200] },
    { nom: 'rouge', rgb: [255, 76, 76] },
    { nom: 'orange', rgb: [255, 150, 48] },
    { nom: 'menthe', rgb: [140, 255, 200] },
    { nom: 'ciel', rgb: [130, 200, 255] },
    { nom: 'lavande', rgb: [206, 170, 255] },
    { nom: 'corail', rgb: [255, 128, 110] },
  ];

  // En dessous de cet ecart, deux couleurs se confondent de loin ; au-dessus,
  // elles se distinguent au premier coup d'oeil. A 30, un logo violet passait
  // encore a cote des panneaux violets du Danube, et un orange sur la piste
  // rouge du stade de jour : le seuil est pose au-dessus.
  const ECART_MIN = 35;

  function lineaire(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  /** sRGB -> CIELAB (illuminant D65). */
  function lab(rgb) {
    const r = lineaire(rgb[0]), g = lineaire(rgb[1]), b = lineaire(rgb[2]);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  /** Ecart entre deux couleurs, tel que l'oeil le percoit (ΔE 1976). */
  function ecart(a, b) {
    const p = lab(a), q = lab(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  /** Les couleurs d'un stade que le logo doit fuir. */
  function decor(th) {
    const c = [th.trackA, th.trackB, th.grass, th.grassEdge, th.skyTop, th.skyBot,
               th.tread, th.riser, th.roof, th.barrier, th.neon, th.neonExt];
    for (const p of th.panels || []) c.push(p);
    return c.filter(x => Array.isArray(x) && x.length >= 3);
  }
  function ecartAuDecor(th, rgb) {
    let m = Infinity;
    for (const d of decor(th)) m = Math.min(m, ecart(rgb, d));
    return m;
  }

  /**
   * Les teintes permises dans ce stade : celles qui se detachent de son
   * decor, plus celles qui sont `toujours` la (le blanc). Si aucune ne
   * restait — aucun stade n'en est la —, la plus lointaine de toutes, seule.
   */
  function teintesPour(th) {
    const notees = TEINTES.map(t => ({ nom: t.nom, rgb: t.rgb, origine: !!t.origine,
                                       toujours: !!t.toujours, ecart: ecartAuDecor(th, t.rgb) }));
    const bonnes = notees.filter(t => t.toujours || t.ecart >= ECART_MIN);
    if (bonnes.length) return bonnes;
    return [notees.reduce((a, b) => (b.ecart > a.ecart ? b : a))];
  }

  /** La teinte d'une course : `tirage` est un nombre de [0, 1). */
  function choisir(th, tirage) {
    const l = teintesPour(th);
    return l[Math.min(l.length - 1, Math.floor(tirage * l.length))];
  }

  root.TeintesPub = { TEINTES, ECART_MIN, lab, ecart, decor, teintesPour, choisir };
})(typeof globalThis !== 'undefined' ? globalThis : this);
