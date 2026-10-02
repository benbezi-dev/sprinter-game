/* -----------------------------------------------------------------------
   SPRINTER — la lumiere de l'heure.

   Les stades a ciel de jour se courent a l'heure ou l'on joue : en plein
   jour le matin et a midi, dans la lumiere doree de l'apres-midi, au soleil
   couchant le soir, et la nuit sous les projecteurs.

   L'HEURE EST CELLE DU SOLEIL, PAS DE LA PENDULE. A dix-huit heures en
   decembre il fait nuit depuis une heure ; en juin le soleil est encore
   haut. Les limites se calent donc sur le lever et le coucher du jour,
   calcules pour la date et le fuseau de l'appareil (voir soleil()).

   QUATRE MOMENTS, DEUX FACONS DE LES PEINDRE.

   - Le jour : le stade tel qu'il a ete regle. Rien ne change.
   - L'apres-midi et le soir : le ciel change de couleur, puis l'image
     entiere est etalonnee (appliquerAmbiance, sauts-stades.js) — la lumiere
     que les sauts donnent deja au regional et au national. Le soir baisse
     aussi la palette, et la tire vers le rose (voir SOIR).
   - La nuit : un etalonnage aurait assombri les coureurs avec le reste. Or
     un stade de nuit ECLAIRE ses coureurs, et c'est ce que font deja le
     Danube et le cimetiere, par leur seule palette. La nuit refait donc la
     palette du stade — la piste sous les rampes, la pelouse a demi, les
     tribunes et le lointain dans le noir — et allume ce que les stades de
     nuit allument : projecteurs, nappes au sol, ombres en eventail, ecrans
     LED, etoiles. Les images rendues dans Blender (public, decors), qui ne
     passent pas par la palette, sont teintes a part (voir image()).

   Les stades qui ont deja leur heure — le cosmos, la piste arc-en-ciel, la
   nuit etoilee, le Danube, le cimetiere, la planete aux trois soleils — la
   gardent : seuls les themes marques `heure: true` suivent le soleil. Les
   sauts gardent aussi la leur (sauts-stades.js) : chaque etape y a son
   heure, et elle monte avec la competition.

   POUR FORCER UN MOMENT — une capture, un harnais, un essai : `?heure=nuit`
   (ou jour, apres-midi, soir) dans l'adresse, ou
   `SprinterHeure.forcer('nuit')` depuis la console ; `forcer(null)` rend la
   main au soleil.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const MOMENTS = ['jour', 'apres-midi', 'soir', 'nuit'];
  const RAD = Math.PI / 180;

  // -------------------------------------------------------------------
  // OU EST LE JOUEUR.
  //
  // On n'a que son fuseau. Pour ceux ou l'on joue le plus, une latitude et
  // une longitude ; ailleurs, une latitude moyenne et le meridien du fuseau.
  // La longitude compte autant que la latitude : la France vit a l'heure de
  // Berlin, et son midi solaire tombe pres d'une heure apres midi.
  // -------------------------------------------------------------------
  const LIEUX = {
    'Europe/Paris': [48.85, 2.35], 'Europe/Brussels': [50.8, 4.4],
    'Europe/Luxembourg': [49.6, 6.1], 'Europe/Zurich': [46.8, 8.2],
    'Europe/Monaco': [43.7, 7.4], 'Africa/Abidjan': [5.3, -4.0],
    'Africa/Dakar': [14.7, -17.4], 'Africa/Bamako': [12.6, -8.0],
    'Indian/Reunion': [-21.1, 55.5], 'America/Martinique': [14.6, -61.0],
    'America/Guadeloupe': [16.2, -61.6], 'America/Cayenne': [4.9, -52.3],
    'America/Montreal': [45.5, -73.6], 'America/Toronto': [43.7, -79.4],
  };

  function lieu(d) {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* vieux moteur */ }
    if (LIEUX[tz]) return LIEUX[tz];
    // Le meridien du fuseau, heure d'hiver : le decalage le plus faible de
    // l'annee (getTimezoneOffset compte a l'envers).
    const an = d.getFullYear();
    const hiver = Math.max(new Date(an, 0, 1).getTimezoneOffset(), new Date(an, 6, 1).getTimezoneOffset());
    return [45, -hiver / 60 * 15];
  }

  /**
   * Le lever, le midi et le coucher du soleil, en heures de la pendule
   * locale, pour le jour de `d` — a quelques minutes pres, pour le lieu du
   * fuseau. Le soleil se leve quand son bord franchit l'horizon, refraction
   * comprise (-0,83°), et le midi solaire avance ou recule d'un quart
   * d'heure selon la saison (l'equation du temps) : sans elle, Paris se
   * couchait neuf minutes trop tard en octobre.
   */
  function soleil(d) {
    const [lat, lon] = lieu(d);
    const n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const decl = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365) * RAD;
    const x = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) /
              (Math.cos(lat * RAD) * Math.cos(decl));
    const demi = Math.acos(Math.max(-1, Math.min(1, x))) / RAD / 15;
    const B = 2 * Math.PI * (n - 81) / 365;
    const eqTemps = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // minutes
    const midi = 12 - d.getTimezoneOffset() / 60 - lon / 15 - eqTemps / 60;
    return { lever: midi - demi, midi, coucher: midi + demi };
  }

  /**
   * Le moment de la journee a la date `d`.
   *
   * La nuit commence quarante minutes apres le coucher et finit une demi-
   * heure avant le lever : le crepuscule eclaire encore. Le soir, c'est
   * l'heure et quart qui precede le coucher. L'apres-midi commence deux
   * heures et demie apres midi — ou deux heures et demie avant le coucher,
   * si c'est plus tot : en hiver le soleil est bas des le debut de
   * l'apres-midi.
   */
  function momentDe(d) {
    const s = soleil(d);
    const h = d.getHours() + d.getMinutes() / 60;
    if (h < s.lever - 0.5 || h >= s.coucher + 0.67) return 'nuit';
    if (h >= s.coucher - 1.25) return 'soir';
    if (h >= Math.min(s.midi + 2.5, s.coucher - 2.5)) return 'apres-midi';
    return 'jour';
  }

  // -------------------------------------------------------------------
  // LE MOMENT EN COURS.
  //
  // IL NE CHANGE PAS PENDANT UNE COURSE. Lu a la pendule a chaque image, il
  // basculerait a l'heure dite, en pleine ligne droite : la nuit tomberait
  // d'un coup sur le soixante-dixieme metre. On ne le relit donc qu'a
  // l'accueil, et pas plus d'une fois toutes les quinze secondes ; partout
  // ailleurs on garde celui avec lequel on est parti.
  // -------------------------------------------------------------------
  let force = null;
  try {
    const q = new URLSearchParams(root.location ? root.location.search : '').get('heure');
    force = normaliser(q);
  } catch (e) { /* pas de location : un harnais Node */ }

  function normaliser(m) {
    if (!m) return null;
    const k = String(m).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]/g, '-');
    if (k === 'apresmidi') return 'apres-midi';
    return MOMENTS.includes(k) ? k : null;
  }

  let _moment = null, _lu = 0;
  function moment(G) {
    if (force) return force;
    const t = Date.now();
    const accueil = !G || G.state === 'title' || G.state === 'open';
    if (_moment && (!accueil || t - _lu < 15000)) return _moment;
    _moment = momentDe(new Date(t));
    _lu = t;
    return _moment;
  }

  /** Force un moment (`null` rend la main au soleil). Rend le moment retenu. */
  function forcer(m) {
    force = normaliser(m);
    _moment = null;
    return force;
  }

  // -------------------------------------------------------------------
  // LES COULEURS DE CHAQUE MOMENT.
  // -------------------------------------------------------------------
  const melange = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const fois = (c, L) => c.map((v, i) => Math.min(255, Math.round(v * L[i])));
  const estCouleur = (v) => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number');

  // PLUS IL FAIT SOMBRE, PLUS LE STADE S'ECLAIRE.
  //
  // La palette baissait avec le soleil, partout, et la nuit retombait d'un
  // bloc : la piste sous ses rampes a 80 %, les gradins et leur public a un
  // tiers, le decor dans le noir. Un vrai stade fait l'inverse : quand le jour
  // s'en va, ses projecteurs prennent le relais, et c'est la piste, les
  // coureurs, les gradins et le public qu'ils eclairent — le ciel, lui, reste
  // noir. La lumiere de chaque part est donc DEUX lumieres : celle du ciel
  // (`ambiant`), qui baisse, et celle des rampes, qui monte avec ECLAIRAGE et
  // porte moins loin a mesure qu'on s'eloigne de la piste (PORTEE). Elles
  // s'additionnent comme deux lampes sur un meme objet : 1 - (1 - a)(1 - l).
  //
  // ET L'OBSCURITE RETIRE LES COULEURS, sauf la ou l'on eclaire. Dans le noir
  // l'oeil voit en gris : une pelouse simplement assombrie restait verte, et
  // le stade avait l'air d'un jour sous-expose. Chaque part perd une part de
  // sa saturation (`gris`) — et la lumiere des rampes la lui rend.
  const ECLAIRAGE = { jour: 0, 'apres-midi': 0.15, soir: 0.55, nuit: 1 };
  const PORTEE = { piste: 1, proche: 0.8, gradins: 0.7, loin: 0.35 };
  // un blanc de projecteur, a peine froid
  const LAMPE = [0.98, 0.99, 1];
  function eclaire(ambiant, gris, E, tour) {
    const lum = { gris: {} };
    for (const part in PORTEE) {
      const l = E * PORTEE[part];
      lum[part] = ambiant.map((a, i) => +(1 - (1 - a) * (1 - l * LAMPE[i])).toFixed(3));
      lum.gris[part] = +(gris[part] * (1 - l)).toFixed(3);
    }
    lum.tour = tour; lum.gris.tour = 0;
    return lum;
  }
  // La nuit, le ciel ne donne plus que la lune : un bleu sombre. Le bleu
  // baisse moins que le rouge, et c'est ce qui distingue un stade de nuit
  // d'une photo sous-exposee. La tour s'allume : doree, et non noire comme ce
  // qui l'entoure.
  const NUIT = eclaire([0.17, 0.20, 0.34], { piste: 0, proche: 0.45, gradins: 0.45, loin: 0.6 },
                       ECLAIRAGE.nuit, [0.92, 0.74, 0.46]);
  // Le soir, le soleil couchant met tout le stade dans la meme lumiere, basse
  // et rouge — et les rampes, deja allumees, eclaircissent la piste et les
  // gradins.
  const SOIR_L = [0.94, 0.80, 0.76];
  const SOIR = eclaire(SOIR_L, { piste: 0.08, proche: 0.08, gradins: 0.08, loin: 0.08 },
                       ECLAIRAGE.soir, SOIR_L);
  SOIR.gris.tour = 0.08;

  const grisDe = (c, g) => {
    if (!g) return c;
    const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return c.map(v => v + (l - v) * g);
  };
  /** `c` dans la lumiere `lum` (NUIT), pour la part `part` du stade. */
  const sous = (c, lum, part) => fois(grisDe(c, lum.gris[part] || 0), lum[part]);
  const PARTS = {
    // Les panneaux sont des ecrans la nuit (pubsLed) : ils restent vifs.
    piste: ['trackA', 'trackB', 'lane', 'kerb', 'panels'],
    proche: ['grass', 'grassEdge', 'barrier', 'dust', 'accent', 'eau', 'eauFond', 'haieSombre'],
    gradins: ['tread', 'riser', 'roof', 'crowdLo', 'crowdHi'],
  };
  const partDe = {};
  for (const p in PARTS) for (const k of PARTS[p]) partDe[k] = p;
  const CIEL = { skyTop: 1, skyBot: 1 };

  // L'ETALONNAGE BAISSE QUAND LES RAMPES MONTENT. Il teint toute l'image,
  // coureurs compris : le soir, il les assombrissait autant que le decor,
  // alors que les projecteurs sont justement la pour eux. Il garde sa teinte
  // et perd de sa force a mesure que l'eclairage monte.
  const forceDeLAmbiance = (m) => +(1 - 0.6 * ECLAIRAGE[m]).toFixed(3);

  function deriver(th, m) {
    const d = Object.assign({}, th, { base: th, moment: m });
    if (m === 'apres-midi') {
      // Le bas du ciel se dore ; l'etalonnage fait le reste.
      d.skyBot = melange(th.skyBot, [255, 222, 168], 0.32);
      d.ambiance = 'doree';
      d.ambianceForce = forceDeLAmbiance(m);
    } else if (m === 'soir') {
      // Le haut du ciel fonce vers le violet, le bas s'embrase. Les ecrans du
      // stade et ses rampes sont deja allumes.
      for (const k in th) {
        if (CIEL[k]) continue;
        const v = th[k];
        const part = partDe[k] || 'loin';
        if (estCouleur(v)) d[k] = sous(v, SOIR, part);
        else if (Array.isArray(v) && v.length && v.every(estCouleur)) d[k] = v.map(c => sous(c, SOIR, part));
      }
      d.skyTop = melange(th.skyTop, [70, 64, 150], 0.55);
      d.skyBot = melange(th.skyBot, [255, 156, 104], 0.72);
      d.ambiance = 'couchant';
      d.ambianceForce = forceDeLAmbiance(m);
      d.eclairage = ECLAIRAGE.soir;
      d.pubsLed = true;
      d.lumiere = SOIR;
    } else if (m === 'nuit') {
      for (const k in th) {
        if (CIEL[k]) continue;
        const v = th[k];
        const part = partDe[k] || 'loin';
        if (estCouleur(v)) d[k] = sous(v, NUIT, part);
        else if (Array.isArray(v) && v.length && v.every(estCouleur)) d[k] = v.map(c => sous(c, NUIT, part));
      }
      if (th.tour) d.tour = fois(th.tour, [1.6, 1.5, 1.1]);
      d.skyTop = [8, 12, 34];
      d.skyBot = [34, 42, 86];
      d.stars = 160;
      d.projecteurs = true;
      d.eclairage = ECLAIRAGE.nuit;
      d.pubsLed = true;
      // Ni nuages blancs ni avion dans un ciel noir.
      d.clouds = false;
      d.avion = false;
      d.lumiere = NUIT;
    }
    return d;
  }

  /**
   * Le theme `th` a l'heure qu'il est. Le meme objet tant que le moment ne
   * change pas : les caches de tuiles et de teintes (casierTuiles, tribune.js,
   * rendu-premium.js) se rangent par theme, et un theme refait a chaque image
   * les viderait a chaque image.
   *
   * Un theme sans `heure`, ou deja derive, est rendu tel quel. `base` pointe
   * toujours vers le theme d'origine : c'est lui qu'il faut comparer a
   * THEMES.day, ou chercher par son nom.
   */
  const _derives = new WeakMap();
  function eclairer(th, G) {
    if (!th || !th.heure || th.base) return th;
    const m = moment(G);
    if (m === 'jour') return th;
    let par = _derives.get(th);
    if (!par) _derives.set(th, par = {});
    return par[m] || (par[m] = deriver(th, m));
  }

  /** La couleur `c` sous la lumiere du theme, pour la part `part` du stade. */
  function teinte(th, c, part) {
    const lum = th && th.lumiere;
    return lum && lum[part || 'loin'] && estCouleur(c) ? sous(c, lum, part || 'loin') : c;
  }

  // -------------------------------------------------------------------
  // LES IMAGES RENDUES DANS BLENDER.
  //
  // Elles portent la lumiere du jour dans leurs pixels : un decor de Blender
  // pose tel quel dans un stade de nuit est un objet en plein soleil au
  // milieu du noir. On en tire une copie teinte, une fois par image et par
  // lumiere — le gris d'abord (un melange en `saturation`), le multiplie
  // ensuite, puis l'alpha de l'image d'origine, que les deux auraient rempli.
  //
  // `poser(th)` dit quelle lumiere vaut pour les images de l'image en cours :
  // drawWorld l'appelle en premier, et les pieces debout, dessinees apres
  // les coureurs, la retrouvent sans qu'on ait a leur passer le theme.
  // -------------------------------------------------------------------
  let _lum = null;
  function poser(th) { _lum = (th && th.lumiere) || null; }

  const _teintes = new WeakMap();
  function image(im, part) {
    if (!_lum || !im) return im;
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    if (!(w > 0 && h > 0) || (im.complete === false)) return im;
    part = part || 'loin';
    const L = _lum[part];
    if (!L || typeof document === 'undefined') return im;
    const g = (_lum.gris && _lum.gris[part]) || 0;
    let par = _teintes.get(im);
    if (!par) _teintes.set(im, par = new Map());
    const cle = L.join(',') + '|' + g;
    let cv = par.get(cle);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      c.drawImage(im, 0, 0);
      if (g > 0) {
        c.globalCompositeOperation = 'saturation';
        c.globalAlpha = g;
        c.fillStyle = '#808080';
        c.fillRect(0, 0, w, h);
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = 'rgb(' + L.map(v => Math.round(Math.min(1, v) * 255)).join(',') + ')';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(im, 0, 0);
      par.set(cle, cv);
    }
    return cv;
  }

  /**
   * La couleur `c` sous la lumiere de l'image en cours (voir poser) : pour ce
   * qui est peint a la main avec des couleurs ecrites en dur, comme le public
   * du Champ-de-Mars et ses drapeaux.
   */
  function couleur(c, part) {
    return _lum && estCouleur(c) ? sous(c, _lum, part || 'loin') : c;
  }

  root.SprinterHeure = { MOMENTS, ECLAIRAGE, soleil, momentDe, moment, forcer, eclairer, teinte, poser, image, couleur };
})(globalThis);
