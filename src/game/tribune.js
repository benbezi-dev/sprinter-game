/* -----------------------------------------------------------------------
   SPRINTER — le public, assis dans ses gradins.

   Les spectateurs et leurs sieges sont modelises et rendus dans Blender
   (tools/blender/decors/tribune.py), sous la vue du jeu et avec sa lumiere,
   en quatre passes : ce qui garde sa couleur, la peau, le haut, le siege.
   Ce module les pose rangee par rangee sur les gradins et leur donne leurs
   couleurs.

   CE QUI A CHANGE, ET POURQUOI. Le public etait une tuile de figurines de
   onze pixels — le tiers de la taille d'un coureur —, semees au hasard et
   qui se chevauchaient : on ne savait pas ce que c'etait. Ici chacun est a
   la bonne echelle, assis sur SON siege, face a la piste. Le gradin se lit
   comme un gradin parce qu'il porte des rangees de sieges ; le public se lit
   comme des gens parce qu'on voit une tete, un buste, deux bras.

   LE REMPLISSAGE SUIT LA COMPETITION. Un siege sur quatre est occupe a une
   rencontre scolaire, tous a la finale. Les sieges vides restent visibles :
   une tribune clairsemee se lit comme telle, pas comme un gradin nu.

   LE COUT. Une image par combinaison de pose, de cap, de carnation et de
   couleur, composee UNE FOIS a la premiere occasion puis reposee d'un seul
   drawImage. Le travail de composition est borne en temps a chaque image
   (voir BUDGET_COURSE_MS) : un spectateur pas encore compose apparait a
   l'image suivante.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const MAN = () => root.SprinterTribuneManifeste;
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');

  // -------------------------------------------------------------------
  // L'ATLAS
  // -------------------------------------------------------------------
  const atlas = {};
  let pret = false;
  let dernierDessin = 0;             // voir oublier()
  function charger() {
    const man = MAN();
    if (!man) return false;
    dernierDessin = performance.now();
    if (pret) return true;
    let tous = true;
    for (const p of man.passes) {
      let im = atlas[p];
      if (!im) {
        im = new Image();
        im.decoding = 'async';
        im.src = BASE + '/decors/tribune/' + p + '.webp';
        atlas[p] = im;
      }
      if (!(im.complete && im.naturalWidth > 0)) tous = false;
    }
    pret = tous;
    return pret;
  }

  // -------------------------------------------------------------------
  // LES COULEURS
  // -------------------------------------------------------------------
  // Des carnations de toute la palette humaine, et des couleurs de haut
  // prises au stade lui-meme — ses panneaux, plus du blanc et du marine qu'on
  // voit dans toute foule.
  const PEAUX = [[242, 206, 176], [222, 174, 136], [186, 132, 94], [140, 94, 62], [96, 62, 42]];
  // La couleur des sieges, par stade : un stade a UNE couleur de sieges, et
  // c'est ce qui dessine ses rangees de loin.
  const SIEGES = {
    day: [34, 96, 196], mondiaux: [30, 150, 84], cosmos: [120, 72, 196],
    danube: [84, 52, 128], riviera: [44, 176, 190], nuit: [38, 72, 158],
    namek: [226, 118, 38], champdemars: [26, 60, 150],
  };
  const hexa = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';

  function hauts(th) {
    const out = [];
    for (const c of th.panels || []) out.push(c);
    out.push([244, 244, 240], [36, 42, 64], [214, 52, 58]);
    return out;
  }

  // -------------------------------------------------------------------
  // LA COMPOSITION D'UNE IMAGE
  // -------------------------------------------------------------------
  const PPM_IMAGE = 80;           // pixels par metre des images composees
  // LE PLAFOND DOIT TENIR TOUT CE QU'ON PRECOMPOSE — ou la precomposition ne
  // s'arrete jamais. Une piste a virage presente ses spectateurs sous les
  // vingt-six caps, soit 26 × (1 + 3 poses × 5 peaux × 7 hauts) = 2 756
  // images, pour 1 400 places : chaque image hors course composait les
  // premieres, chassait les plus anciennes, et recommencait a l'image
  // suivante. Des dizaines de toiles creees et jetees par seconde, a l'accueil
  // comme au decompte, et jusqu'a 70 Mo de pixels tenus pour rien.
  //
  // Le plafond descend donc a ce que l'ecran montre vraiment (quelques caps a
  // la fois), la precomposition s'arrete aux trois quarts, et l'oubli suit
  // le dernier USAGE et non la premiere composition : un spectateur a
  // l'image n'est jamais chasse par un autre qu'on ne voit pas.
  const MAX_IMAGES = 800;
  const PRECOMPOSE_MAX = MAX_IMAGES * 0.75;
  const cache = new Map();
  let _tmp = null;
  let budget = 0;
  // L'heure au-dela de laquelle on ne compose plus rien dans cette image.
  let limite = 0;
  /**
   * LE BUDGET SE COMPTE EN TEMPS, PAS EN NOMBRE.
   *
   * Quarante-huit compositions par image, c'etait l'ancien plafond — et la
   * promesse « jamais d'a-coup » ne tenait pas : a 1,7 ms la composition, la
   * premiere apparition d'une tribune (vers 44 m au Champ-de-Mars) coutait
   * une image de 84 ms, mesuree le 23 septembre 2026, en pleine course et
   * sous les yeux des huit partants d'une serie de championnat.
   *
   * En course, trois millisecondes par image : la foule se complete en
   * quelques images, sans que le coureur saute. Hors course — presentation,
   * decompte, accueil —, douze : rien ne court, on peut avancer le travail.
   */
  const BUDGET_COURSE_MS = 3, BUDGET_REPOS_MS = 12;

  function couche(c, im, sx, sy, sw, sh, w, h, couleur) {
    const t = _tmp || (_tmp = document.createElement('canvas'));
    if (t.width !== w || t.height !== h) { t.width = w; t.height = h; }
    const x = t.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, w, h);
    x.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    if (couleur) {
      // la passe est rendue en blanc eclaire : la multiplier par la couleur
      // garde tout l'ombrage, puis on lui rend sa forme
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = couleur;
      x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    }
    c.drawImage(t, 0, 0);
  }

  function image(pose, capI, peau, haut, siege, avance) {
    const cle = pose + '|' + capI + '|' + peau + '|' + haut + '|' + siege;
    let e = cache.get(cle);
    if (e) {
      // dessine : il repasse en tete de file. Compose d'avance : on ne touche
      // a rien, sans quoi la precomposition deciderait seule de ce qui reste.
      if (!avance) { cache.delete(cle); cache.set(cle, e); }
      return e;
    }
    if (budget <= 0 || performance.now() > limite) return null;
    budget--;
    const man = MAN();
    const [ax, ay] = man.ancres[pose][capI];
    const [x0, y0, x1, y1] = man.cadres[pose][capI];
    const k = PPM_IMAGE / man.ppm;
    const sw = x1 - x0, sh = y1 - y0;
    const w = Math.max(1, Math.ceil(sw * k)), h = Math.max(1, Math.ceil(sh * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const sx = ax + x0, sy = ay + y0;
    couche(c, atlas.siege, sx, sy, sw, sh, w, h, siege);
    if (man.poses[pose] !== 'vide') {
      couche(c, atlas.base, sx, sy, sw, sh, w, h, null);
      couche(c, atlas.peau, sx, sy, sw, sh, w, h, peau);
      couche(c, atlas.maillot, sx, sy, sw, sh, w, h, haut);
    }
    e = { cv, ax: -x0 * k, ay: -y0 * k, w, h };
    cache.set(cle, e);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    return e;
  }

  function capProche(deg) {
    const caps = MAN().caps;
    let best = 0, ecart = 1e9;
    for (let i = 0; i < caps.length; i++) {
      const e = Math.abs(((deg - caps[i]) % 360 + 540) % 360 - 180);
      if (e < ecart) { ecart = e; best = i; }
    }
    return best;
  }

  const hache = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  };

  let _themeCourant = null;
  /** Les caps de spectateurs de ce stade, pour tout le trace. */
  const capsVus = new Set();
  let capsDuTrace = null;

  /**
   * Le public d'un gradin.
   *
   * @param api      ptOf, solid, ground, depthOf, scaleM, G, WROT_DEG
   * @param th       le theme du stade, et `nom` sa cle dans THEMES
   * @param sm       les echantillons du trace (samples())
   * @param near     rayon du pied de la tribune
   * @param rangs    nombre de rangees
   * @param pr, pz   profondeur et hauteur d'une rangee
   * @param densite  la part des sieges occupes, de 0 a 1
   * @param allees   les centres des escaliers, en coordonnees du jeu
   * @return faux tant que l'atlas n'est pas charge : le jeu garde alors son
   *         ancien public.
   */
  function dessiner(ctx, api, th, nom, sm, near, rangs, pr, pz, densite, allees) {
    if (!charger()) return false;
    if (th !== _themeCourant) { cache.clear(); capsVus.clear(); capsDuTrace = null; _themeCourant = th; }
    budget = 48;
    const G = api.G, T = G.track;
    limite = performance.now() + (G.state === 'race' ? BUDGET_COURSE_MS : BUDGET_REPOS_MS);
    const vue = T.curved ? api.WROT_DEG : 0;
    const s = api.scaleM() / PPM_IMAGE;
    const PAS = 0.56;                       // un siege de stade, d'axe en axe
    const peauxC = PEAUX.map(hexa), hautsL = hauts(th).map(hexa);
    const siegeC = hexa(SIEGES[nom] || th.accent || [80, 90, 120]);
    const man = MAN();
    const iAssis = 0, iApplaudit = 1, iDebout = 2, iVide = 3;
    const t = performance.now() / 1000;
    const margeX = 140 * s * 1.6, margeY = 260 * s * 1.6;
    // part des spectateurs debout : presque personne a une rencontre
    // scolaire, un bon dixieme a la finale
    const debout = 0.02 + 0.10 * densite;

    // Les echantillons dans le cadre, une fois pour toutes les rangees.
    const vis = new Uint8Array(sm.length);
    const rMil = near + rangs * pr * 0.5, zMil = 1.05 + rangs * pz * 0.5;
    // LES CAPS DE TOUT LE TRACE, une fois par piste et hors course : la
    // premiere tribune n'entre dans le champ qu'a 42 m au Champ-de-Mars, et
    // composer d'avance suppose de savoir dans quel sens ses spectateurs
    // regardent. Meme calcul que plus bas, sur la rangee du milieu.
    if (G.state !== 'race' && capsDuTrace !== T) {
      capsDuTrace = T;
      for (let i = 0; i + 1 < sm.length; i++) {
        const a = api.ptOf(sm[i], rMil), o = api.ptOf(sm[i], rMil + 1);
        let nx = o[0] - a[0], ny = o[1] - a[1];
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        capsVus.add(capProche(Math.atan2(-nx, ny) * 180 / Math.PI + vue));
      }
    }
    for (let i = 0; i < sm.length; i++) {
      const q = api.ptOf(sm[i], rMil);
      const g = api.solid(q[0], q[1], zMil);
      vis[i] = (g[0] > -margeX * 3 && g[0] < G.VW + margeX * 3 &&
                g[1] > -margeY * 3 && g[1] < G.VH + margeY * 3) ? 1 : 0;
    }

    // TOUS LES SPECTATEURS DANS UNE SEULE PILE, TRIEE PAR PROFONDEUR.
    //
    // Le premier tri allait de la derniere rangee a la premiere, en supposant
    // la tribune toujours au fond de l'image. C'est vrai le long des lignes
    // droites ; dans un virage, la tribune d'en face passe du cote de la
    // camera, sa derniere rangee devient la plus PROCHE — et le public, peint
    // a l'envers, n'etait plus qu'une palissade de dossiers. Un seul tri, sur
    // la vraie profondeur, vaut pour les deux cotes.
    const items = [];
    for (let j = rangs - 1; j >= 0; j--) {
      const r = near + j * pr + pr * 0.58;
      const z = 1.05 + (j + 1) * pz;
      for (let i = 0; i + 1 < sm.length; i++) {
        if (!vis[i] && !vis[i + 1]) continue;
        const a = api.ptOf(sm[i], r), b = api.ptOf(sm[i + 1], r);
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dx, dy);
        if (L < 1e-3 || L > 40) continue;
        // la normale sortante du gradin, et le cap du spectateur qui lui
        // tourne le dos pour regarder la piste
        const o = api.ptOf(sm[i], r + 1);
        let nx = o[0] - a[0], ny = o[1] - a[1];
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const capI = capProche(Math.atan2(-nx, ny) * 180 / Math.PI + vue);
        capsVus.add(capI);
        const n = Math.max(1, Math.floor(L / PAS));
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const X = a[0] + dx * u, Y = a[1] + dy * u;
          let dansAllee = false;
          for (let e = 0; e < allees.length; e++) {
            const ax = allees[e][0] - X, ay = allees[e][1] - Y;
            if (ax * ax + ay * ay < 0.85 * 0.85) { dansAllee = true; break; }
          }
          if (dansAllee) continue;
          const g = api.solid(X, Y, z);
          if (g[0] < -margeX || g[0] > G.VW + margeX || g[1] < -margeY || g[1] > G.VH + margeY) continue;
          const h = hache(j + 1, i + 7, k + 13);
          let pose;
          if ((h % 1000) / 1000 >= densite) pose = iVide;
          else {
            // chacun change de geste de temps en temps, jamais tous ensemble
            const cycle = Math.floor(t / (2.2 + (h % 7) * 0.3) + (h % 97) / 97 * 5);
            const v = hache(h, cycle, 3) % 1000 / 1000;
            pose = v < debout ? iDebout : (v < debout + 0.22 ? iApplaudit : iAssis);
          }
          items.push([api.depthOf(X, Y), g[0], g[1], pose, capI, h]);
        }
      }
    }
    // du plus loin au plus pres
    items.sort((p, q) => q[0] - p[0]);
    for (const it of items) {
      const h = it[5];
      const pose = it[3];
      const vide = pose === iVide;
      const im = image(pose, it[4], vide ? 0 : peauxC[(h >>> 4) % peauxC.length],
                       vide ? 0 : hautsL[(h >>> 9) % hautsL.length], siegeC);
      if (!im) continue;
      ctx.drawImage(im.cv, it[1] - im.ax * s, it[2] - im.ay * s, im.w * s, im.h * s);
    }
    // TOUT COMPOSER AVANT LE PISTOLET. Hors course, le temps qui reste dans
    // l'image sert a composer d'avance TOUTES les combinaisons des caps du
    // trace. Mesure le 23 septembre 2026 au Champ-de-Mars : aucune tribune
    // n'est visible avant 42 m, rien n'etait donc compose, et la PREMIERE
    // composition — celle qui reveille les quatre planches de l'atlas
    // (4 862 × 1 188 chacune, decodees au premier dessin) — coutait 62 ms en
    // pleine course ; les suivantes, 0,4 ms. Faite ici, elle tombe pendant la
    // presentation ou le decompte.
    if (G.state !== 'race' && cache.size < PRECOMPOSE_MAX) {
      for (const capI of capsVus) {
        if (cache.size >= PRECOMPOSE_MAX) return true;
        if (!image(iVide, capI, 0, 0, siegeC, true)) return true;
        for (let pose = 0; pose < 3; pose++) {
          for (const peau of peauxC) {
            for (const haut of hautsL) {
              if (!image(pose, capI, peau, haut, siegeC, true)) return true;
            }
          }
        }
      }
    }
    return true;
  }

  // PLUS DE TRIBUNE A L'ECRAN, PLUS D'ATLAS EN MEMOIRE. Les quatre planches
  // pesent 23 Mo chacune une fois decodees — 92 Mo, plus les images
  // composees, gardes pendant tout un menu ou rien ne les dessine. Passe
  // OUBLI_MS sans un seul dessin, on les rend ; elles reviennent du cache
  // HTTP a la prochaine tribune, et se recomposent hors course, comme au
  // premier passage.
  const OUBLI_MS = 10000;
  function oublier() {
    if (!pret && !Object.keys(atlas).length) return;
    if (performance.now() - dernierDessin < OUBLI_MS) return;
    for (const p in atlas) { atlas[p].removeAttribute('src'); delete atlas[p]; }
    pret = false;
    cache.clear(); capsVus.clear(); capsDuTrace = null; _themeCourant = null;
  }
  if (typeof setInterval === 'function') setInterval(oublier, OUBLI_MS / 2);

  root.Tribune = { dessiner, pret: () => charger() };
})(typeof globalThis !== 'undefined' ? globalThis : this);
