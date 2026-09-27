/* -----------------------------------------------------------------------
   SPRINTER — le stade du Champ-de-Mars, edition du premier championnat de
   France.

   La piste est posee au milieu des parterres, et ce qui fait le lieu se lit
   en trois plans, du plus loin au plus pres :

   1. LA TOUR. Elle est a huit cents metres : a cette distance un objet ne
      bouge presque pas quand la camera suit le coureur. Elle est donc tenue
      a une position d'ECRAN, a peine derivee par la course, et plantee sur
      l'horizon du stade — la ou la derniere bande de sol rencontre le ciel.
      Son pied passe derriere les rideaux d'arbres, qui sont traces apres
      elle : c'est l'ordre du trace qui la met au fond.
   2. LES RIDEAUX D'ARBRES ET LES FACADES. Les tilleuls du Champ-de-Mars sont
      tailles au carre, en murs de feuillage poses sur des troncs nus : c'est
      la silhouette qu'on reconnait sur toutes les photographies, bien avant
      les facades cremes et leurs toits de zinc qui depassent derriere.
   3. LE TRICOLORE, peint sur la piste apres l'arrivee et derriere le depart,
      peint dans la pelouse interieure, tenu a bout de bras dans les gradins,
      hisse aux mats au sommet des tribunes, et trace dans le ciel par trois
      avions.

   Tout ce qui se pose au sol passe par une transformation affine : la
   projection du jeu l'est (voir ground() dans sprinter-app.js), donc un
   rectangle du monde se dessine d'une seule matrice, texte compris.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const BLEU = [0, 62, 160], BLANC = [250, 250, 248], ROUGE = [226, 30, 44];
  const hex = (c, a) => a == null
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // -------------------------------------------------------------------
  // LES PIECES RENDUES DANS BLENDER (tools/blender/decors/champ-de-mars.py).
  // -------------------------------------------------------------------
  //
  // Chacune a son image et, dans le manifeste, le pixel ou tombe son pied
  // (ax, ay) et l'echelle a laquelle elle a ete rendue (ppm). Tant qu'une
  // image n'est pas chargee — ou si elle ne vaut pas pour la vue du moment —
  // le dessin a la main plus bas prend le relais : rien n'est indispensable.
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');
  const MAN = () => root.ChampDeMarsManifeste || null;
  const images = new Map();
  function rendu(nom) {
    const man = MAN(), p = man && man.pieces && man.pieces[nom];
    if (!p) return null;
    let im = images.get(nom);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.onerror = () => setTimeout(() => images.delete(nom), 2000);
      im.src = BASE + '/decors/champdemars/' + p.f;
      images.set(nom, im);
    }
    return im.complete && im.naturalWidth > 0 ? { im, p } : null;
  }
  // UNE PIECE RENDUE NE VAUT QUE SOUS LA VUE OU ELLE L'A ETE. Quinze degres,
  // et la ligne droite : en virage, le moteur tourne tout le monde de -14°
  // (WROT), et une facade rendue de face s'y poserait de travers.
  function vueDesRendus(api) {
    const man = MAN();
    if (!man || api.G.track.curved) return false;
    const deg = Math.atan2(api.C.ISO_SIN, api.C.ISO_COS) * 180 / Math.PI;
    return Math.abs(deg - man.angle) < 0.3;
  }
  function poser(ctx, api, R, X, Y) {
    const g = api.ground(X, Y), k = api.scaleM() / R.p.ppm;
    const w = R.p.w * k, h = R.p.h * k, x = g[0] - R.p.ax * k, y = g[1] - R.p.ay * k;
    if (x > api.G.VW || x + w < 0 || y > api.G.VH || y + h < 0) return;
    ctx.drawImage(R.im, x, y, w, h);
  }
  // Les pieces se posent tous les `pas` metres, de -60 m jusqu'au bout du decor.
  function enFile(ctx, api, R, pas, depart, Y) {
    const fin = api.G.track.straight + api.finDuDecor();
    for (let x = depart - Math.ceil((depart + 60) / pas) * pas; x < fin; x += pas) poser(ctx, api, R, x, Y);
  }

  // -------------------------------------------------------------------
  // LA TOUR, cuite une fois dans une grande tuile.
  // -------------------------------------------------------------------
  //
  // LE PROFIL EST UNE EXPONENTIELLE, et ce n'est pas une approximation de
  // plus : c'est la courbe que ses ingenieurs ont calculee pour que le vent
  // ne la renverse pas. La demi-largeur vaut 0,04 + 0,96·e^(-3,6 h) — cinquante
  // six pour cent de la base au premier etage (h = 0,17), trente et un au
  // deuxieme (0,35), huit au troisieme (0,84), ce que donnent les cotes
  // reelles a deux points pres.
  const TW = 560, TH = 1400, SOL = TH - 4, HAUT = 1230;   // HAUT : fin de la structure
  const demi = (f) => (TW * 0.47) * (0.04 + 0.96 * Math.exp(-3.6 * f));
  const yDe = (f) => SOL - f * HAUT;
  // Le bord interieur d'un pied : les quatre piliers se rejoignent au
  // deuxieme etage, et entre eux le jour passe.
  const dedans = (f) => demi(f) * 0.6 * Math.max(0, 1 - f / 0.35);

  let _tour = null;
  function tourTile(th) {
    if (_tour && _tour.th === th) return _tour.cv;
    const cv = toile(TW, TH), c = cv.getContext('2d');
    const X = TW / 2;
    const fer = th.tour || [132, 104, 80];
    const clair = mix(fer, [238, 222, 196], 0.30), sombre = mix(fer, [30, 26, 30], 0.35);

    // La silhouette, avec ses deux jours : l'arche sous le premier etage, et
    // la fenetre en ogive entre le premier et le deuxieme.
    const silhouette = () => {
      c.beginPath();
      for (let f = 0; f <= 0.9001; f += 0.01) {
        const p = [X - demi(f), yDe(f)];
        f ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
      }
      for (let f = 0.9; f >= -0.0001; f -= 0.01) c.lineTo(X + demi(f), yDe(f));
      c.closePath();
      // l'arche : des bords interieurs des pieds jusqu'a sa cle, a 0,12
      const fA = 0.035, lA = dedans(fA), yA = yDe(fA), cle = yDe(0.125);
      c.moveTo(X - dedans(0), SOL);
      c.lineTo(X + dedans(0), SOL);
      c.lineTo(X + lA, yA);
      c.bezierCurveTo(X + lA * 0.98, cle - (yA - cle) * 0.10, X + lA * 0.30, cle, X, cle);
      c.bezierCurveTo(X - lA * 0.30, cle, X - lA * 0.98, cle - (yA - cle) * 0.10, X - lA, yA);
      c.closePath();
      // la fenetre du second etage de piliers
      c.moveTo(X - dedans(0.195), yDe(0.195));
      for (let f = 0.195; f <= 0.33; f += 0.01) c.lineTo(X - dedans(f) * 0.92, yDe(f));
      for (let f = 0.33; f >= 0.195; f -= 0.01) c.lineTo(X + dedans(f) * 0.92, yDe(f));
      c.closePath();
    };

    // UNE DENTELLE, PAS UN APLAT. Vue de loin, la tour laisse passer le ciel :
    // un corps plein en ferait un obelisque. On pose donc un voile leger,
    // puis le treillis croise par-dessus, puis les aretes en plein.
    c.save();
    silhouette();
    c.clip('evenodd');
    c.fillStyle = hex(fer, 0.42); c.fillRect(0, 0, TW, TH);
    c.lineWidth = 3.2; c.strokeStyle = hex(fer, 0.95);
    for (let k = -TH; k < TW + TH; k += 20) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k - TH * 0.9, TH); c.stroke();
      c.beginPath(); c.moveTo(k - TH * 0.9, 0); c.lineTo(k, TH); c.stroke();
    }
    c.lineWidth = 2.4;
    for (let y = SOL; y > 0; y -= 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(TW, y); c.stroke(); }
    // l'ombre : la face droite est a contre-jour
    const g = c.createLinearGradient(X - TW * 0.4, 0, X + TW * 0.4, 0);
    g.addColorStop(0, hex(clair, 0.35)); g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, hex(sombre, 0.45));
    c.fillStyle = g; c.fillRect(0, 0, TW, TH);
    c.restore();

    // Les aretes des quatre piliers, en plein : c'est elles qui dessinent la
    // courbe quand le treillis se brouille a petite taille.
    c.strokeStyle = hex(fer); c.lineCap = 'round';
    const arete = (sens, larg, fn, f0, f1) => {
      c.lineWidth = larg; c.beginPath();
      for (let f = f0; f <= f1 + 1e-4; f += 0.01) {
        const p = [X + sens * fn(f), yDe(f)];
        f === f0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
      }
      c.stroke();
    };
    arete(-1, 11, demi, 0, 0.9); arete(1, 11, demi, 0, 0.9);
    arete(-1, 8, dedans, 0, 0.33); arete(1, 8, dedans, 0, 0.33);
    // l'arche, doublee : la frise ajouree tient entre ses deux traits
    c.lineWidth = 7;
    for (const dy of [0, -22]) {
      const fA = 0.035, lA = dedans(fA), yA = yDe(fA) + dy, cle = yDe(0.125) + dy;
      c.beginPath(); c.moveTo(X + lA, yA);
      c.bezierCurveTo(X + lA * 0.98, cle - (yA - cle) * 0.10, X + lA * 0.30, cle, X, cle);
      c.bezierCurveTo(X - lA * 0.30, cle, X - lA * 0.98, cle - (yA - cle) * 0.10, X - lA, yA);
      c.stroke();
    }

    // Les trois etages. Le premier est une galerie haute, festonnee
    // d'arcades ; le deuxieme une plateforme plus mince ; le troisieme une
    // loge vitree, puis la lanterne et l'antenne.
    const plateau = (f, h, deb, ton) => {
      const w = demi(f) + deb, y = yDe(f);
      c.fillStyle = hex(ton || fer); c.fillRect(X - w, y - h, w * 2, h);
      c.fillStyle = hex(clair, 0.55); c.fillRect(X - w, y - h, w * 2, h * 0.22);
    };
    plateau(0.160, 30, 10);
    plateau(0.182, 12, 16, sombre);
    // les arcades sous la galerie
    c.strokeStyle = hex(fer); c.lineWidth = 3;
    const w1 = demi(0.16);
    for (let x = X - w1 + 10; x < X + w1 - 10; x += 22) {
      c.beginPath(); c.arc(x + 11, yDe(0.160) + 2, 10, Math.PI, 0); c.stroke();
    }
    plateau(0.350, 20, 12);
    plateau(0.362, 8, 16, sombre);
    plateau(0.845, 22, 8);
    // la loge du sommet et la lanterne
    c.fillStyle = hex(sombre); c.fillRect(X - demi(0.9) - 4, yDe(0.935), (demi(0.9) + 4) * 2, yDe(0.9) - yDe(0.935));
    c.fillStyle = hex(fer); c.fillRect(X - 10, yDe(0.975), 20, yDe(0.935) - yDe(0.975));
    c.fillStyle = hex(sombre); c.fillRect(X - 4, 6, 8, yDe(0.975) - 6);
    c.fillStyle = hex(ROUGE); c.fillRect(X - 5, 4, 10, 10);

    _tour = { th, cv };
    return cv;
  }

  // -------------------------------------------------------------------
  // LES FACADES DU SEPTIEME : pierre creme, balcons filants, zinc bleu-gris.
  // -------------------------------------------------------------------
  const FW = 640, FH = 300;
  const facades = [];
  function facadeTile(th, v) {
    if (facades[v]) return facades[v];
    const cv = toile(FW, FH), c = cv.getContext('2d');
    const pierre = th.pierre || [230, 214, 184], zinc = th.zinc || [112, 128, 150];
    const toitH = 78, corniche = FH - 200;
    // trois immeubles mitoyens de hauteurs voisines
    const coupes = v === 0 ? [0, 220, 420, 640] : v === 1 ? [0, 180, 430, 640] : [0, 250, 450, 640];
    for (let k = 0; k < 3; k++) {
      const x0 = coupes[k], x1 = coupes[k + 1];
      const dh = ((v * 3 + k) % 3) * 14;
      const top = corniche - dh;
      const ton = mix(pierre, [255, 246, 226], ((v + k) % 2) * 0.35);
      c.fillStyle = hex(ton); c.fillRect(x0, top, x1 - x0, FH - top);
      // le zinc : un toit a la Mansart, brise, perce de lucarnes
      c.fillStyle = hex(zinc);
      c.beginPath(); c.moveTo(x0, top); c.lineTo(x0 + 16, top - toitH * 0.8);
      c.lineTo(x1 - 16, top - toitH * 0.8); c.lineTo(x1, top); c.closePath(); c.fill();
      c.fillStyle = hex(zinc, 1); c.fillStyle = hex(mix(zinc, [40, 48, 60], 0.35));
      c.fillRect(x0 + 16, top - toitH, x1 - x0 - 32, toitH * 0.2);
      for (let x = x0 + 34; x < x1 - 30; x += 40) {
        c.fillStyle = hex(ton); c.fillRect(x, top - toitH * 0.62, 16, toitH * 0.5);
        c.fillStyle = hex([54, 62, 80]); c.fillRect(x + 4, top - toitH * 0.52, 8, toitH * 0.36);
      }
      // les cheminees de brique
      c.fillStyle = hex([178, 108, 82]);
      c.fillRect(x0 + 26, top - toitH - 24, 18, 26); c.fillRect(x1 - 48, top - toitH - 18, 16, 20);
      // six etages de fenetres hautes
      const etage = (FH - top) / 6.2;
      for (let e = 0; e < 6; e++) {
        const y = top + 10 + e * etage;
        for (let x = x0 + 16; x < x1 - 20; x += 34) {
          c.fillStyle = hex([60, 68, 88]); c.fillRect(x, y, 16, etage * 0.62);
        }
        // balcons filants au deuxieme et au cinquieme
        if (e === 1 || e === 4) {
          c.fillStyle = hex([34, 36, 44]); c.fillRect(x0 + 6, y + etage * 0.66, x1 - x0 - 12, 5);
        }
      }
      c.fillStyle = hex(mix(ton, [120, 100, 80], 0.35)); c.fillRect(x0, top - 4, x1 - x0, 6);
      c.fillStyle = 'rgba(40,30,20,0.18)'; c.fillRect(x1 - 3, top, 3, FH - top);
    }
    facades[v] = cv;
    return cv;
  }

  // -------------------------------------------------------------------
  // L'IF TAILLE EN CONE — les sentinelles des parterres.
  // -------------------------------------------------------------------
  const ifs = [];
  function ifTile(th, v) {
    if (ifs[v]) return ifs[v];
    const cv = toile(120, 300), c = cv.getContext('2d');
    const f = th.ifFeuille || [36, 96, 44];
    const w = 44 + v * 6;
    c.fillStyle = hex(mix(f, [0, 0, 0], 0.15));
    c.beginPath(); c.moveTo(60, 8); c.lineTo(60 + w, 286); c.lineTo(60 - w, 286); c.closePath(); c.fill();
    // la face au soleil : la moitie gauche, plus claire
    c.fillStyle = hex(mix(f, [150, 200, 90], 0.25));
    c.beginPath(); c.moveTo(60, 8); c.lineTo(60 - w, 286); c.lineTo(58, 286); c.closePath(); c.fill();
    c.fillStyle = hex([96, 70, 48]); c.fillRect(54, 284, 12, 14);
    ifs[v] = cv;
    return cv;
  }

  // -------------------------------------------------------------------
  // OU POSER LA TOUR.
  // -------------------------------------------------------------------
  //
  // On cherche, sur la ligne d'horizon du stade, le point FOND — la ou elle
  // passe au-dessus de tout le reste — qui tombe a la verticale visee.
  // Sur une ligne droite, cette ligne est invariante quand la camera avance
  // (elle glisse le long d'elle-meme) : une tour tenue a x fixe y resterait
  // clouee a l'ecran, comme un objet a l'infini. Une derive d'un pixel par
  // metre couru lui rend un peu de distance.
  function piedDeLaTour(api, sm, rH) {
    const { G } = api;
    // UN PEU A DROITE DU MILIEU : la ligne d'horizon descend de gauche a
    // droite, et c'est de ce cote que le ciel est le plus haut — donc la tour
    // la plus grande.
    // La derive est celle d'un objet lointain : un metre couru la deplace
    // d'un pixel et demi, quand la piste en defile une vingtaine. Assez pour
    // qu'elle soit dans le monde, trop peu pour qu'elle sorte du cadre.
    const cible = G.VW * (G.portrait ? 0.60 : 0.66) - (G.camX - 50) * 1.4 * api.ui();
    let best = null;
    for (let i = 0; i + 1 < sm.length; i++) {
      const a = api.ground(...api.ptOf(sm[i], rH)), b = api.ground(...api.ptOf(sm[i + 1], rH));
      if ((a[0] - cible) * (b[0] - cible) > 0 || a[0] === b[0]) continue;
      const t = (cible - a[0]) / (b[0] - a[0]);
      const y = a[1] + (b[1] - a[1]) * t;
      if (!best || y < best[1]) best = [cible, y];
    }
    return best;
  }

  function tour(ctx, api, th, sm, rOut, horizon) {
    const { G } = api;
    // LE PIED EST DERRIERE LES FACADES, ET RIEN NE S'ECARTE DEVANT ELLE.
    //
    // Une premiere version ouvrait les rideaux et retirait les immeubles au
    // droit de la tour. Mais la tour ne defile presque pas, et eux defilent
    // avec la piste : la trouee les suivait, si bien que les arbres et les
    // facades naissaient et s'effacaient en passant devant elle, et la tour
    // semblait glisser sur le decor. Elle est donc plantee derriere tout le
    // reste, et c'est le decor qui passe devant elle — par des trouees fixees
    // au sol, comme des rues : ce que fait un objet lointain.
    const pied = piedDeLaTour(api, sm, rOut + horizon + 4.0);
    if (!pied) return;
    // La tour tient le ciel qui reste au-dessus de l'horizon, sans jamais
    // sortir par le haut : une tour decapitee se lit comme une antenne.
    // Le haut du cadre appartient au bandeau de course (chrono, place) : en
    // portrait il en prend un dixieme, et la pointe passait dessous.
    const haut = G.VH * (G.portrait ? 0.10 : 0.06);
    const h = Math.min(G.VH * 0.8, pied[1] - haut);
    if (h < 40) return;
    // La tour de Blender si elle est la : un vrai treillis, rendu face a la
    // camera. Sinon la tuile dessinee a la main.
    const R = rendu('tour');
    if (R) {
      const k = h / R.p.ay;
      ctx.drawImage(R.im, pied[0] - R.p.ax * k, pied[1] - R.p.ay * k, R.p.w * k, R.p.h * k);
      return;
    }
    const im = tourTile(th), w = h * TW / TH;
    ctx.drawImage(im, pied[0] - w / 2, pied[1] - h * (SOL / TH), w, h);
  }

  // -------------------------------------------------------------------
  // LA PATROUILLE — trois fumees, bleu, blanc, rouge.
  // -------------------------------------------------------------------
  function patrouille(ctx, api) {
    const { G } = api;
    const u = api.ui();
    const t = performance.now() / 1000;
    const anc = api.ground(0, 0)[0] * 0.05;
    // la tete de la formation traverse le ciel en quarante secondes
    const L = G.VW * 1.6;
    let x = ((t * G.VW / 40) - anc) % L; if (x < 0) x += L;
    x -= G.VW * 0.3;
    const y = G.VH * (G.portrait ? 0.11 : 0.09);
    const pente = -0.16, long = G.VW * 0.9;
    const cols = [BLEU, BLANC, ROUGE];
    for (let k = 0; k < 3; k++) {
      const ox = x - k * 3 * u, oy = y + (k - 1) * 9 * u;
      const g = ctx.createLinearGradient(ox, oy, ox - long, oy - long * pente);
      g.addColorStop(0, hex(cols[k], 0.85));
      g.addColorStop(0.6, hex(cols[k], 0.35));
      g.addColorStop(1, hex(cols[k], 0));
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = 6.5 * u;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(ox - long * 0.5, oy - long * pente * 0.5 + 6 * u, ox - long, oy - long * pente);
      ctx.stroke();
      // l'avion en tete de sa fumee
      ctx.fillStyle = '#e8ecf2';
      ctx.beginPath();
      ctx.moveTo(ox + 9 * u, oy - 1.4 * u); ctx.lineTo(ox - 3 * u, oy - 4.6 * u);
      ctx.lineTo(ox - 1 * u, oy); ctx.lineTo(ox - 3 * u, oy + 4.6 * u); ctx.closePath(); ctx.fill();
    }
  }

  // -------------------------------------------------------------------
  // LE LOINTAIN : les facades, puis les rideaux d'arbres, puis les ifs.
  // -------------------------------------------------------------------
  function lointain(ctx, api, th, sm, rOut, horizon) {
    const r0 = rOut + horizon;
    const m = api.scaleM();
    const fin = api.samples(3);
    const vis = (p, marge) => p[0] > -marge && p[0] < api.G.VW + marge && p[1] > -marge && p[1] < api.G.VH + marge;

    // LES FACADES, sur une face verticale vraie : chaque troncon de trois
    // metres recoit sa tranche de tuile par une matrice, si bien que les
    // immeubles suivent la ligne du lointain au lieu d'y poser des cartes
    // de face en escalier.
    const rF = r0 + 3.2, hF = 2.5;
    const rR = r0 + 1.1, prof = 1.6, z0 = 0.5, z1 = 1.9;
    // Les pieces de Blender, dans le meme ordre que le dessin : le plus loin
    // d'abord. Memes rues, memes allees, aux memes metres — la version peinte
    // et la version rendue se remplacent l'une l'autre sans que rien bouge.
    if (vueDesRendus(api)) {
      const I = rendu('ilot'), Rd = rendu('rideau'), If = rendu('if');
      if (I && Rd && If) {
        enFile(ctx, api, I, 36, 9, rF);
        enFile(ctx, api, Rd, 36, 4.5, rR);
        enFile(ctx, api, If, 6, 0, r0 + 0.2);
        return;
      }
    }
    for (let i = 0; i + 1 < fin.length; i++) {
      const a = api.ground(...api.ptOf(fin[i], rF)), b = api.ground(...api.ptOf(fin[i + 1], rF));
      if (!vis(a, 200) && !vis(b, 200)) continue;
      // Des rues, tous les trente-six metres : c'est par elles qu'on voit
      // le pied de la tour quand elle passe derriere.
      if (!fin[i][0] && ((((fin[i][1] % 36) + 36) % 36) < 9)) continue;
      const tuile = facadeTile(th, (i >> 2) % 3);
      const part = (i % 4) / 4, sw = FW / 4, hp = hF * m;
      ctx.save();
      ctx.transform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw, 0, hp / FH, a[0], a[1] - hp);
      ctx.drawImage(tuile, part * FW, 0, sw + 0.8, FH, 0, 0, sw + 0.8, FH);
      ctx.restore();
    }

    // LES RIDEAUX : un mur de feuillage pose sur des troncs nus, coupe tous
    // les vingt-quatre metres par une allee. Le dessus est plus clair que la
    // face : il prend le soleil de plein fouet.
    //
    // ILS SONT A DEMI-HAUTEUR, ET C'EST UNE CONVENTION DE PEINTRE. La vue du
    // jeu ne rapetisse rien avec la distance : a leur vraie taille, les
    // rideaux montaient jusqu'au bandeau et ne laissaient pas un pixel de ciel
    // — donc pas de tour. Tout ce qui est lointain est dessine plus bas qu'il
    // n'est, ce que l'oeil lit comme de l'eloignement.
    const feuille = th.rideau || [64, 132, 48];
    const troncons = [];
    let cur = null;
    for (let i = 0; i < fin.length; i++) {
      const s = fin[i][0] ? i * 3 : fin[i][1];
      const trou = (((s % 36) + 36) % 36) < 4.5;
      if (trou) { cur = null; continue; }
      if (!cur) { cur = []; troncons.push(cur); }
      cur.push(fin[i]);
    }
    for (const run of troncons) {
      if (run.length < 2) continue;
      // les troncs, sous le feuillage
      for (let k = 0; k < run.length; k++) {
        const p0 = api.solid(...api.ptOf(run[k], rR + 0.3), 0), p1 = api.solid(...api.ptOf(run[k], rR + 0.3), z0 + 0.1);
        if (!vis(p0, 40)) continue;
        ctx.strokeStyle = 'rgb(84,72,58)'; ctx.lineWidth = Math.max(1, 0.12 * m);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
      api.wall(ctx, run, rR, z0, z1, feuille, 1);
      const dessus = mix(feuille, [190, 220, 120], 0.28);
      api.band(ctx, run, rR, rR + prof, hex(dessus), z1);
      // la frange du dessous, plus sombre : l'ombre du feuillage sur lui-meme
      api.wall(ctx, run, rR, z0, z0 + 0.25, mix(feuille, [10, 30, 10], 0.45), 1);
      // LE FEUILLAGE. Taille au carre, un tilleul reste un tilleul : la face
      // est faite de touffes, claires au soleil, sombres dans les creux, et
      // l'arete du haut ondule. Sans elles le rideau se lisait comme une haie
      // de plastique, un bloc vert pose sur des baguettes.
      for (let k = 0; k < run.length; k++) {
        const g = (Math.imul(k + 5 + run[0][1] * 7 | 0, 2654435761) >>> 0);
        for (let j = 0; j < 4; j++) {
          const zz = z0 + 0.4 + ((g >>> (j * 5)) % 100) / 100 * (z1 - z0 - 0.6);
          const off = ((g >>> (j * 3 + 2)) % 100) / 100 - 0.5;
          const q = api.ptOf(run[Math.min(run.length - 1, k)], rR);
          const q2 = api.ptOf(run[Math.min(run.length - 1, k + 1)], rR);
          const x = q[0] + (q2[0] - q[0]) * (0.5 + off * 0.8), y = q[1] + (q2[1] - q[1]) * (0.5 + off * 0.8);
          const p = api.solid(x, y, zz);
          if (!vis(p, 30)) continue;
          ctx.fillStyle = hex(j % 2 ? mix(feuille, [180, 220, 110], 0.30) : mix(feuille, [10, 40, 10], 0.30), 0.55);
          ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.34 * m, 0.2 * m, 0, 0, TAU); ctx.fill();
        }
        // l'arete du haut : des bosses, pas une regle
        const p = api.solid(...api.ptOf(run[k], rR), z1);
        if (!vis(p, 30)) continue;
        ctx.fillStyle = hex(dessus);
        ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.5 * m, 0.16 * m, 0, 0, TAU); ctx.fill();
      }
    }

    // LES IFS, en sentinelles le long de l'allee de sable, un tous les six
    // metres, devant les rideaux.
    const hI = 1.3 * m;
    for (let i = 0; i < fin.length; i += 2) {
      const p = api.solid(...api.ptOf(fin[i], r0 + 0.2), 0);
      const tuile = ifTile(th, i % 3), w = hI * 120 / 300;
      if (!vis(p, 60)) continue;
      ctx.drawImage(tuile, p[0] - w / 2, p[1] - hI, w, hI);
    }
  }

  // -------------------------------------------------------------------
  // LE TRICOLORE PEINT, sur la piste et dans la pelouse.
  // -------------------------------------------------------------------
  //
  // Un repere local au sol : `o` l'origine, `ex` un metre le long de la piste,
  // `ey` un metre vers l'exterieur. La projection etant affine, la matrice
  // (ex, ey, o) plaque n'importe quel dessin a plat — un rectangle, un mot.
  function repere(api, sa, sb, r) {
    const o = api.ground(...api.ptOf(sa, r));
    const a = api.ground(...api.ptOf(sb, r));
    const e = api.ground(...api.ptOf(sa, r + 1));
    return { o, ex: [a[0] - o[0], a[1] - o[1]], ey: [e[0] - o[0], e[1] - o[1]] };
  }

  function drapeauAuSol(ctx, R, x0, y0, lx, ly, alpha, dansLeSens) {
    ctx.save();
    ctx.transform(R.ex[0], R.ex[1], R.ey[0], R.ey[1], R.o[0], R.o[1]);
    ctx.globalAlpha = alpha;
    // le liseret blanc qui detache le bleu du tartan bleu
    ctx.fillStyle = hex(BLANC);
    ctx.fillRect(x0 - 0.25, y0 - 0.25, lx + 0.5, ly + 0.5);
    const cols = dansLeSens ? [BLEU, BLANC, ROUGE] : [ROUGE, BLANC, BLEU];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = hex(cols[k]);
      ctx.fillRect(x0 + k * lx / 3, y0, lx / 3 + 0.02, ly);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // LA PISTE TRICOLORE.
  // -------------------------------------------------------------------
  //
  // Le tartan passe du bleu au blanc puis au rouge LE LONG DE LA COURSE : on
  // part dans le bleu, on franchit la ligne dans le rouge. Ce n'est pas un
  // drapeau peint sur la piste, c'est la piste qui est le drapeau — et c'est
  // ce qu'on voit en premier, bien avant la tour.
  //
  // LE BLANC N'EST PAS BLANC. Un vrai blanc sous huit lignes blanches les
  // effacerait, et la piste deviendrait un trottoir. Le milieu est un
  // gris-perle tres clair, et les lignes prennent la couleur inverse de la
  // piste qu'elles traversent : blanches sur le bleu et le rouge, marine sur
  // le perle.
  const PISTE = [[18, 72, 196], [236, 238, 246], [222, 34, 48]];
  const LIGNE = [[255, 255, 255], [22, 40, 96], [255, 255, 255]];
  // LE BLEU ET LE ROUGE TIENNENT LE TERRAIN, le blanc ne fait que passer.
  // Etale regulierement sur cent metres, le degrade etait pale partout : la
  // camera n'en cadre qu'une trentaine, et sur trente metres un degrade
  // lineaire n'est qu'un bleu delave. Le bleu plein tient donc le premier
  // tiers, le rouge plein le dernier, et le perle ne fait que la mi-course.
  const ARRETS = [[0, 0], [0.30, 0], [0.47, 1], [0.53, 1], [0.70, 2], [1, 2]];
  function teinte(pal, t) {
    t = Math.max(0, Math.min(1, t));
    for (let k = 1; k < ARRETS.length; k++) {
      const [t1, c1] = ARRETS[k], [t0, c0] = ARRETS[k - 1];
      if (t <= t1) {
        const u = (t - t0) / Math.max(1e-6, t1 - t0);
        const e = u * u * (3 - 2 * u);
        return mix(pal[c0], pal[c1], e);
      }
    }
    return pal[2];
  }
  // Ou commence et ou finit la course, a l'ecran, pour une ligne droite.
  function axe(api, r) {
    const T = api.G.track;
    const a = api.ground(...api.ptOf(T.markAt(0, 0), r));
    const b = api.ground(...api.ptOf(T.markAt(T.total, 0), r));
    return [a, b];
  }
  function degrade(ctx, a, b, pal, alpha) {
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (let k = 0; k <= 40; k++) g.addColorStop(k / 40, hex(teinte(pal, k / 40), alpha));
    return g;
  }
  // Pour un trace courbe, la couleur se donne par tranche : un degrade
  // lineaire a l'ecran ne suit pas un virage. L'abscisse de course de chaque
  // echantillon est la longueur cumulee du trace, recalee sur le depart.
  function abscisses(api, sm, r) {
    const T = api.G.track;
    const d = [0];
    for (let i = 1; i < sm.length; i++) {
      const a = api.ptOf(sm[i - 1], r), b = api.ptOf(sm[i], r);
      d.push(d[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const dep = api.ptOf(T.markAt(0, 0), r);
    let k0 = 0, best = Infinity;
    for (let i = 0; i < sm.length; i++) {
      const p = api.ptOf(sm[i], r), e = Math.hypot(p[0] - dep[0], p[1] - dep[1]);
      if (e < best) { best = e; k0 = i; }
    }
    return d.map(v => (v - d[k0]) / T.total);
  }

  function surface(ctx, api, th, sm, rIn, rOut) {
    const T = api.G.track;
    const mid = (rIn + rOut) / 2;
    if (!T.curved) {
      const [a, b] = axe(api, mid);
      api.band(ctx, sm, rIn, rOut, degrade(ctx, a, b, PISTE));
      // LA PISTE EST POSEE, PAS COULEE. Une course hors stade se court sur
      // des dalles posees sur la pelouse : on en voit le chant, neuf
      // centimetres sombres le long du bord cote camera. Trace SOUS le bord
      // (z negatif), la ou le chant se trouve a l'ecran quand la surface est
      // a hauteur de dalle.
      api.wall(ctx, sm, rIn, -0.09, 0, [34, 38, 52], 1);
      return;
    }
    const fin = api.samples(2), t = abscisses(api, fin, mid);
    api.band(ctx, sm, rIn, rOut, hex(PISTE[1]));
    for (let i = 0; i + 1 < fin.length; i++) {
      api.band(ctx, [fin[i], fin[i + 1]], rIn, rOut, hex(teinte(PISTE, (t[i] + t[i + 1]) / 2)));
    }
  }

  // Les lignes, en couleur inverse. Rend vrai si elles sont tracees ici — le
  // moteur ne trace alors pas les siennes.
  function lignes(ctx, api, th, sm, rIn, rOut, lineR, nb) {
    const T = api.G.track;
    const mid = (rIn + rOut) / 2;
    const trait = (col, r, w) => api.rail(ctx, sm, r, col, w);
    if (!T.curved) {
      const [a, b] = axe(api, mid);
      const g = degrade(ctx, a, b, LIGNE, 0.9), gb = degrade(ctx, a, b, LIGNE, 1);
      trait(gb, rIn, 3);
      for (let e = 1; e < nb; e++) trait(g, lineR(e), 1.6);
      trait(gb, rOut, 2.2);
      return true;
    }
    const fin = api.samples(4), t = abscisses(api, fin, mid);
    for (let i = 0; i + 1 < fin.length; i++) {
      const sl = [fin[i], fin[i + 1]], col = hex(teinte(LIGNE, (t[i] + t[i + 1]) / 2), 0.9);
      api.rail(ctx, sl, rIn, col, 3);
      for (let e = 1; e < nb; e++) api.rail(ctx, sl, lineR(e), col, 1.6);
      api.rail(ctx, sl, rOut, col, 2.2);
    }
    return true;
  }

  // DANS LA PELOUSE INTERIEURE : un drapeau de quinze metres et le nom du
  // pays, a plat, tondus dans l'herbe comme on le fait les soirs de finale.
  function pelouse(ctx, api, th, rIn) {
    const T = api.G.track;
    if (T.curved) return;
    const R = repere(api, [false, 0, 0], [false, 1, 0], rIn);
    drapeauAuSol(ctx, R, 62, -9.5, 10.5, 7, 0.85, false);
    // FRANCE, lu de gauche a droite a l'ecran : il avance vers les x
    // decroissants du monde, glyphes debout vers l'exterieur.
    ctx.save();
    ctx.transform(-R.ex[0], -R.ex[1], -R.ey[0], -R.ey[1], R.o[0], R.o[1]);
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = hex(BLANC);
    // Trois metres de haut : assez pour se lire d'un coup d'oeil depuis la
    // piste, pas assez pour manger la pelouse.
    ctx.font = '900 3.2px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('FRANCE', -30, 5.5);
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // LES DRAPEAUX DE LA TRIBUNE.
  // -------------------------------------------------------------------
  //
  // Deux sortes. Des petits drapeaux brandis dans le public, un pour trois
  // metres environ et jamais au meme rang deux fois de suite ; et de grands
  // pavillons hisses aux mats qui couronnent la tribune, tous les seize
  // metres. Tous flottent : trois bandes decoupees en tranches, chacune
  // decalee d'une onde qui court de la hampe vers le bord libre.
  function flotte(ctx, x, y, lw, lh, t, phase) {
    const n = 9, cols = [BLEU, BLANC, ROUGE];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const o0 = Math.sin(t * 6 + phase - u0 * 5) * lh * 0.16 * u0;
      const o1 = Math.sin(t * 6 + phase - u1 * 5) * lh * 0.16 * u1;
      const ombre = 0.86 + 0.14 * Math.cos(t * 6 + phase - (u0 + u1) * 2.5);
      const c = cols[Math.min(2, Math.floor(u0 * 3 + 1e-6))];
      ctx.fillStyle = hex([c[0] * ombre, c[1] * ombre, c[2] * ombre]);
      ctx.beginPath();
      ctx.moveTo(x + u0 * lw, y + o0); ctx.lineTo(x + u1 * lw + 0.5, y + o1);
      ctx.lineTo(x + u1 * lw + 0.5, y + o1 + lh); ctx.lineTo(x + u0 * lw, y + o0 + lh);
      ctx.closePath(); ctx.fill();
    }
  }

  function tribune(ctx, api, th, sm, near, tiers, sr, sz) {
    const { G } = api;
    const m = api.scaleM(), t = performance.now() / 1000;
    const rangee = api.rangeeDeToiture(sm, 3.2).filter(q => api.auFond(q, near));
    let n = 0;
    for (const q of rangee) {
      n++;
      const graine = (Math.imul(n + 11, 2654435761) >>> 0);
      if (graine % 5 > 2) continue;
      const rang = graine % (tiers * 2);
      const r = near + (rang + 0.5) * (sr / 2), z = 1.05 + (rang + 1) * (sz / 2) + 0.55;
      const p = api.solid(...api.ptOf(q, r), z);
      if (p[0] < -40 || p[0] > G.VW + 40 || p[1] < -40 || p[1] > G.VH + 40) continue;
      const lw = 0.75 * m, lh = 0.5 * m;
      ctx.strokeStyle = 'rgb(60,56,52)'; ctx.lineWidth = Math.max(1, 0.05 * m);
      ctx.beginPath(); ctx.moveTo(p[0], p[1] + 0.5 * m); ctx.lineTo(p[0], p[1] - lh); ctx.stroke();
      // brandi : le drapeau se balance au bout du bras
      const bal = Math.sin(t * 2.2 + graine) * 0.12 * m;
      flotte(ctx, p[0] + bal, p[1] - lh, lw, lh, t, graine % 7);
    }
    // les mats au sommet
    const zS = 1.05 + tiers * sz, rS = near + tiers * sr + 0.2;
    let k = 0;
    for (const q of api.rangeeDeToiture(sm, 16).filter(q2 => api.auFond(q2, near))) {
      k++;
      const b = api.solid(...api.ptOf(q, rS), zS), h = api.solid(...api.ptOf(q, rS), zS + 3.4);
      if (b[0] < -80 || b[0] > G.VW + 80 || h[1] > G.VH || b[1] < -80) continue;
      ctx.strokeStyle = 'rgb(236,236,232)'; ctx.lineWidth = Math.max(1.2, 0.09 * m);
      ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(h[0], h[1]); ctx.stroke();
      flotte(ctx, h[0], h[1], 1.8 * m, 1.2 * m, t * 0.8, k * 1.7);
    }
  }

  // -------------------------------------------------------------------
  // LA TRIBUNE PROVISOIRE ET LE PUBLIC DEBOUT.
  // -------------------------------------------------------------------
  //
  // Une course hors stade n'a pas d'enceinte : une tribune de chantier au
  // bout, face a l'arrivee, et des barrieres partout ailleurs, avec le public
  // debout derriere. C'est ce qui ouvre le ciel — et la tour — pendant les
  // soixante premiers metres : une tribune tout du long bouchait le haut du
  // cadre d'un bout a l'autre de la course.
  // LA TRIBUNE FAIT FACE AUX DERNIERS METRES, ET S'ARRETE A LA LIGNE.
  //
  // Posee jusqu'au bout du decor, elle bouchait la tour au seul moment qu'on
  // regarde et qu'on partage : l'arrivee. Au passage de la ligne, la tour se
  // tient au-dessus de la bande de parc qui SUIT l'arrivee (une dizaine de
  // metres plus loin, au fond) ; la tribune s'arrete donc un peu avant, et
  // le public reprend debout derriere les barrieres. La tour ne disparait
  // que pendant qu'on longe la tribune, comme elle disparaitrait pour de vrai.
  // 0,6 et 0,96 tombent sur des echantillons du cent metres (60 et 96 m,
  // au pas de douze) : la tribune et le public debout se touchent sans trou.
  const TRIBUNE = [0.6, 0.96];   // en fraction de la course
  // L'abscisse de course d'un echantillon de trace, quel qu'il soit : c'est
  // l'inverse de Track.markAt. Avant le depart, elle est negative.
  function abscisseDe(T, q, r) {
    if (!T.curved) return q[1];
    const A = T.bend1(r), S = T.straight, B = Math.PI * r;
    if (q[2] === 0) return q[0] ? A - q[1] * r : A + q[1];
    if (!T.fullLap) return -1;              // la ligne opposee, avant le depart
    return q[0] ? A + S + (B - q[1] * r) : A + S + B + q[1];
  }
  function tribuneSur(api, sm) {
    const T = api.G.track, r = T.curved ? T.edge(4) : 0;
    const dans = (q) => {
      const t = abscisseDe(T, q, r) / T.total;
      return t >= TRIBUNE[0] && t <= TRIBUNE[1];
    };
    return { sm: sm.filter(dans), dans };
  }

  const PEAUX = [[242, 206, 176], [222, 174, 136], [186, 132, 94], [140, 94, 62], [96, 62, 42]];
  const HAUTS = [BLEU, BLANC, ROUGE, BLEU, [22, 40, 96], BLANC, ROUGE, [240, 196, 70], [60, 152, 118]];
  function badauds(ctx, api, th, sm, near, dansTribune) {
    const { G } = api;
    const m = api.scaleM(), t = performance.now() / 1000;
    const pas = api.G.track.curved ? 0.6 : 0.55;
    const fin = api.samples(pas);
    // du plus loin au plus pres : les rangs de devant cachent ceux de derriere
    for (let j = 2; j >= 0; j--) {
      const r = near + 0.55 + j * 0.5;
      for (let i = 0; i < fin.length; i++) {
        const q = fin[i];
        if (dansTribune(q) || !api.auFond(q, near)) continue;
        const g = Math.imul(i * 3 + j * 7919 + 13, 2654435761) >>> 0;
        if (g % 7 < 2 - (j === 0 ? 1 : 0)) continue;           // des trous
        const dx = ((g >>> 8) % 100) / 100 - 0.5;
        const base = api.ptOf(q, r + dx * 0.2);
        const p0 = api.solid(base[0], base[1], 0);
        if (p0[0] < -30 || p0[0] > G.VW + 30 || p0[1] < -60 || p0[1] > G.VH + 60) continue;
        const h = 1.55 + ((g >>> 4) % 30) / 100;
        const epaules = api.solid(base[0], base[1], h - 0.28), tete = api.solid(base[0], base[1], h - 0.1);
        const l = 0.24 * m;
        const haut = HAUTS[(g >>> 12) % HAUTS.length], peau = PEAUX[(g >>> 16) % PEAUX.length];
        // le torse, du genou aux epaules : le bas est derriere la barriere
        const genou = api.solid(base[0], base[1], 0.55);
        ctx.fillStyle = hex([34, 38, 56]);
        ctx.fillRect(genou[0] - l * 0.8, genou[1] - (genou[1] - epaules[1]) * 0.45, l * 1.6, (genou[1] - epaules[1]) * 0.45);
        ctx.fillStyle = hex(haut);
        ctx.fillRect(epaules[0] - l, epaules[1], l * 2, (genou[1] - epaules[1]) * 0.58);
        ctx.fillStyle = hex(peau);
        ctx.beginPath(); ctx.arc(tete[0], tete[1], 0.13 * m, 0, TAU); ctx.fill();
        // un sur six brandit un drapeau, bras leve
        if ((g >>> 20) % 6 === 0) {
          const main = api.solid(base[0], base[1], h + 0.45);
          ctx.strokeStyle = 'rgb(60,56,52)'; ctx.lineWidth = Math.max(1, 0.05 * m);
          ctx.beginPath(); ctx.moveTo(epaules[0] + l, epaules[1]); ctx.lineTo(main[0] + l, main[1]); ctx.stroke();
          flotte(ctx, main[0] + l, main[1] - 0.4 * m, 0.7 * m, 0.46 * m, t, g % 7);
        } else if ((g >>> 20) % 6 === 1) {
          // bras leves, qui applaudissent
          const lev = Math.sin(t * 9 + g) * 0.08 * m;
          ctx.strokeStyle = hex(peau); ctx.lineWidth = Math.max(1, 0.07 * m);
          ctx.beginPath();
          ctx.moveTo(epaules[0] - l * 0.8, epaules[1]); ctx.lineTo(tete[0] - l * 0.6, tete[1] - 0.35 * m + lev);
          ctx.moveTo(epaules[0] + l * 0.8, epaules[1]); ctx.lineTo(tete[0] + l * 0.6, tete[1] - 0.35 * m - lev);
          ctx.stroke();
        }
      }
    }
  }

  // LES BARRIERES VAUBAN, tous les 2,5 m le long du public. Rend faux quand
  // elles ne peuvent pas etre posees : le moteur trace alors ses panneaux.
  function barrieres(ctx, api, th, near) {
    if (!vueDesRendus(api)) return false;
    const R = rendu('vauban');
    if (!R) return false;
    enFile(ctx, api, R, 2.5, 0, near + 0.1);
    return true;
  }

  // LE PORTIQUE D'ARRIVEE ET SON HORLOGE.
  //
  // Le portique est une piece de Blender, posee sur la ligne. L'horloge, elle,
  // est ecrite ici a chaque image, sur la face dont le manifeste donne la
  // position : le chrono de la course pendant qu'on court, fige sur le temps
  // du vainqueur des qu'il a franchi la ligne — comme sur la route.
  function chronoAffiche(G) {
    let vainqueur = Infinity;
    for (const r of G.runners || []) if (r.finished && r.finishTime < vainqueur) vainqueur = r.finishTime;
    if (vainqueur < Infinity) return vainqueur;
    return G.state === 'race' ? (G.elapsed || 0) : 0;
  }
  function portique(ctx, api, th) {
    if (!vueDesRendus(api)) return;
    const R = rendu('portique');
    if (!R) return;
    poser(ctx, api, R, api.G.track.total, 0);
    horloge(ctx, api, R);
  }
  // LE HAUT DU PORTIQUE, APRES LES COUREURS.
  //
  // Dessine entier avant eux, le portique ne masquait personne — mais un
  // coureur qui a passe la ligne est DERRIERE la banniere, et il semblait la
  // survoler. A l'ecran, seuls ceux-la la croisent (un coureur d'avant la
  // ligne a la tete trois metres sous elle) : on repeint donc par-dessus eux
  // la poutre, la banniere, l'horloge et la colonne cote camera, rendues sans
  // ombre et sans la colonne du fond, devant laquelle ils passent vraiment.
  function portiqueDevant(ctx, api, th) {
    if (!vueDesRendus(api)) return;
    const R = rendu('portique_dessus'), P = rendu('portique');
    if (!R || !P) return;
    poser(ctx, api, R, api.G.track.total, 0);
    horloge(ctx, api, P);
  }
  function horloge(ctx, api, R) {
    const X = api.G.track.total;
    const H = R.p.horloge;
    if (!H) return;
    const Xf = X + H.x;
    const o = api.solid(Xf, H.y0, H.z1);
    const a = api.solid(Xf, H.y0 + 1, H.z1), b = api.solid(Xf, H.y0, H.z1 - 1);
    ctx.save();
    ctx.transform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]);
    const t = chronoAffiche(api.G);
    ctx.font = '700 0.5px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb21e';
    ctx.fillText(t.toFixed(2), (H.y1 - H.y0) / 2, (H.z1 - H.z0) / 2 + 0.02);
    ctx.restore();
  }

  root.ChampDeMars = { portique, portiqueDevant, barrieres, tribuneSur, badauds, tour, patrouille, lointain, surface, lignes, pelouse, tribune, ifTile };
})(typeof globalThis !== 'undefined' ? globalThis : window);
