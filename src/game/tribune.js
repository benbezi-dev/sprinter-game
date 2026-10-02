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

  // DEUX ATLAS : l'ordinaire, et celui du palier ULTRA (tribune.py --ultra),
  // une fois et demie plus dense, pour une toile a trois pixels par point —
  // a quatre-vingts pixels par metre, le public y etait agrandi, flou. On n'en
  // charge qu'UN : les deux ensemble passeraient quatre cents megaoctets
  // decodes. Le choix suit la densite de la toile, qui ne change qu'aux menus
  // (voir dpr() dans rendu-premium.js). `ppm` : la densite des images
  // composees, celle de l'atlas — la copie reste exacte, pixel pour pixel.
  const JEUX = {
    ordinaire: { man: () => root.SprinterTribuneManifeste, dossier: '/decors/tribune/', ppm: 80, ppmDrapeau: 64 },
    ultra: { man: () => root.SprinterTribuneManifesteUltra, dossier: '/decors-ultra/tribune/', ppm: 120,
             ppmDrapeau: 128 },
  };
  let jeu = JEUX.ordinaire;
  const MAN = () => jeu.man();
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');

  // -------------------------------------------------------------------
  // L'ATLAS
  // -------------------------------------------------------------------
  const atlas = {};
  let pret = false;
  /**
   * L'atlas qui convient a la toile du moment. En changer lache les images de
   * l'autre et vide les images composees : leurs ancres sont en pixels de
   * l'atlas qui les a faites.
   */
  function choisirJeu() {
    const A = root.SprinterApp, G = A && A.G;
    const mu = JEUX.ultra.man();
    const voulu = G && G.dpr > 2 && mu && mu.passes ? JEUX.ultra : JEUX.ordinaire;
    if (voulu === jeu) return;
    jeu = voulu;
    for (const p in atlas) delete atlas[p];
    pret = false;
    cache.clear(); chantiers.clear();
  }

  function charger() {
    choisirJeu();
    const man = MAN();
    if (!man || !man.passes) return false;
    if (pret) return true;
    let tous = true;
    for (const p of man.passes) {
      let im = atlas[p];
      if (!im) {
        im = new Image();
        im.decoding = 'async';
        im.src = BASE + jeu.dossier + p + '.webp';
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
    namek: [226, 118, 38], champdemars: [26, 60, 150], arcenciel: [236, 96, 196],
    // Jean-Delbert n'a pas de sieges : des gradins-bancs de beton clair.
    montreuil: [206, 204, 198],
  };
  const hexa = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  // La couleur `c` dans la lumiere des gradins de `th` — la meme, le jour.
  const teinteNuit = (th, c) => (root.SprinterHeure ? root.SprinterHeure.teinte(th, c, 'gradins') : c);

  function hauts(th) {
    const out = [];
    for (const c of th.panels || []) out.push(c);
    out.push([244, 244, 240], [36, 42, 64], [214, 52, 58]);
    return out;
  }

  // LES CHEVEUX ET LE BAS, POUR QUE LA FOULE CESSE D'ETRE UNE EQUIPE.
  //
  // Noir, brun fonce, chatain, roux, blond, blond clair, gris, blanc — et la
  // chevelure suit la carnation, comme dans une vraie foule : on tire ses
  // cheveux dans une table ponderee par peau, pas au hasard dans toutes.
  const CHEVEUX = [[26, 22, 20], [54, 36, 26], [96, 62, 38], [140, 78, 40],
                   [188, 146, 86], [222, 196, 140], [148, 144, 140], [210, 208, 200]];
  const CHEVEUX_PAR_PEAU = [
    [2, 3, 3, 1, 2, 1, 1, 1],
    [3, 3, 2, 0.5, 1, 0.3, 1, 0.5],
    [5, 3, 1, 0, 0, 0, 0.7, 0.3],
    [7, 2, 0, 0, 0, 0, 0.6, 0.4],
    [7, 2, 0, 0, 0, 0, 0.6, 0.4],
  ];
  // Jean, jean brut, noir, gris, beige, kaki, blanc, marine : ce que porte
  // une tribune, le jean en tete.
  const PANTALONS = [[50, 72, 112], [34, 44, 72], [30, 30, 34], [96, 98, 106],
                     [178, 154, 114], [110, 106, 74], [222, 220, 212], [40, 46, 74]];
  const POIDS_PANTALONS = [5, 3, 3, 2, 1.5, 1, 0.5, 2];
  // Cheveux courts, longs, casquette (voir tribune.py).
  const POIDS_SILHOUETTES = [0.5, 0.32, 0.18];
  // Assez de personnages pour qu'on ne reconnaisse pas deux fois le meme dans
  // un cadre, pas davantage : chacun coute une image composee par geste et
  // par cap (voir `image`), et le cache n'en garde que MAX_IMAGES.
  //
  // VINGT-QUATRE, ET C'EST UNE MESURE. Une image a six couches coute moitie
  // plus a composer qu'a quatre, et sur un 200 m le public en compose des
  // centaines en pleine course, a mesure que le virage montre de nouveaux
  // caps. Avec trente-deux personnages (97 images par cap), le 29/09/2026, un
  // processeur bride comme celui d'un telephone y passait 2,2 s par course
  // contre 1,3 s pour l'ancien public : la course ramait. Vingt-quatre, c'est
  // 73 images par cap, contre 106 pour l'ancien public (cinq carnations par
  // sept hauts) — et trois silhouettes, cheveux et pantalons en plus.
  const N_PERSONNAGES = 24;

  function tirer(poids, u) {
    let total = 0;
    for (const p of poids) total += p;
    let v = u * total;
    for (let i = 0; i < poids.length; i++) { v -= poids[i]; if (v < 0) return i; }
    return poids.length - 1;
  }

  /**
   * Les personnages d'un stade : une carnation, une coiffure (ou une
   * casquette), un haut, un bas. Tires une fois, d'une suite fixe — le meme
   * stade retrouve le meme public d'une course a l'autre —, et chacun des
   * spectateurs en endosse un selon sa place.
   */
  function personnages(th) {
    // LA NUIT, LA FOULE EST DANS LA LUMIERE DES GRADINS (heure-du-jour.js).
    // Ses couleurs se tirent du stade tel qu'il est de jour — ses panneaux
    // de nuit sont des ecrans, pas des maillots —, puis baissent avec lui.
    const jour = th.base || th;
    const nuit = (c) => teinteNuit(th, c);
    const hautsC = hauts(jour);
    // Les casquettes : les couleurs du stade, et le noir, le blanc et le
    // marine qu'on voit partout.
    const casquettes = (jour.panels || []).concat([[30, 30, 34], [244, 244, 240], [36, 42, 64]]);
    let g = 0x6d2b79f5 >>> 0;
    const al = () => { g ^= g << 13; g >>>= 0; g ^= g >>> 17; g ^= g << 5; g >>>= 0; return g / 4294967296; };
    const out = [];
    for (let i = 0; i < N_PERSONNAGES; i++) {
      const peau = i % PEAUX.length;
      const sil = tirer(POIDS_SILHOUETTES, al());
      const tete = sil === 2 ? casquettes[Math.floor(al() * casquettes.length)]
                             : CHEVEUX[tirer(CHEVEUX_PAR_PEAU[peau], al())];
      out.push({
        id: i, sil,
        peau: hexa(nuit(PEAUX[peau])),
        cheveux: hexa(nuit(tete)),
        haut: hexa(nuit(hautsC[Math.floor(al() * hautsC.length)])),
        pantalon: hexa(nuit(PANTALONS[tirer(POIDS_PANTALONS, al())])),
        // un personnage sur huit vient avec un drapeau (voir dessiner)
        drapeau: i % 8 === 3,
      });
    }
    return out;
  }

  // -------------------------------------------------------------------
  // LES DRAPEAUX DU PUBLIC
  // -------------------------------------------------------------------
  // Des tricolores, et rien d'autre : a quinze pixels de large, un drapeau se
  // reconnait a ses trois bandes, et un embleme ne serait qu'une tache. Les
  // bandes verticales d'abord, puis les horizontales.
  const DRAPEAUX = [
    { v: [[0, 85, 164], [255, 255, 255], [239, 65, 53]] },    // France
    { v: [[0, 146, 70], [255, 255, 255], [206, 43, 55]] },    // Italie
    { v: [[22, 155, 98], [255, 255, 255], [255, 136, 62]] },  // Irlande
    { v: [[30, 30, 30], [253, 218, 36], [239, 51, 64]] },     // Belgique
    { v: [[247, 127, 0], [255, 255, 255], [0, 158, 96]] },    // Cote d'Ivoire
    { v: [[20, 181, 58], [252, 209, 22], [206, 17, 38]] },    // Mali
    { v: [[0, 135, 81], [255, 255, 255], [0, 135, 81]] },     // Nigeria
    { h: [[30, 30, 30], [221, 0, 0], [255, 206, 0]] },        // Allemagne
    { h: [[174, 28, 40], [255, 255, 255], [33, 70, 139]] },   // Pays-Bas
    { h: [[206, 41, 57], [255, 255, 255], [71, 112, 80]] },   // Hongrie
    { h: [[237, 41, 57], [255, 255, 255], [237, 41, 57]] },   // Autriche
  ];
  // Quatre ombrages par bande, prepares une fois : un drapeau qui ondule
  // fabriquerait sinon ses chaines de couleur a chaque tranche et a chaque
  // image.
  const OMBRES_DRAPEAU = [0.8, 0.88, 0.95, 1.0];
  const TEINTES_DRAPEAU = DRAPEAUX.map(d => (d.v || d.h).map(c =>
    OMBRES_DRAPEAU.map(f => hexa([c[0] * f, c[1] * f, c[2] * f]))));

  /**
   * Un drapeau brandi : la hampe part de la main, le drapeau flotte a son
   * sommet. Une onde court de la hampe vers le bord libre — six tranches,
   * decalees et ombrees chacune, comme les pavillons du Champ-de-Mars.
   */
  function drapeau(ctx, x, y, m, t, phase, k) {
    const hampe = 0.95 * m, lw = 0.8 * m, lh = 0.52 * m;
    const top = y - hampe;
    ctx.strokeStyle = 'rgb(58,54,50)';
    ctx.lineWidth = Math.max(1, 0.045 * m);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
    const d = DRAPEAUX[k], teintes = TEINTES_DRAPEAU[k], n = 6;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const o0 = Math.sin(t * 6 + phase - u0 * 5) * lh * 0.14 * u0;
      const o1 = Math.sin(t * 6 + phase - u1 * 5) * lh * 0.14 * u1;
      const c = Math.cos(t * 6 + phase - (u0 + u1) * 2.5);
      const f = c > 0.5 ? 3 : c > 0 ? 2 : c > -0.5 ? 1 : 0;
      const xa = x + u0 * lw, xb = x + u1 * lw + 0.5;
      if (d.v) {
        ctx.fillStyle = teintes[Math.min(2, Math.floor(u0 * 3 + 1e-6))][f];
        ctx.beginPath();
        ctx.moveTo(xa, top + o0); ctx.lineTo(xb, top + o1);
        ctx.lineTo(xb, top + o1 + lh); ctx.lineTo(xa, top + o0 + lh);
        ctx.closePath(); ctx.fill();
      } else {
        for (let b = 0; b < 3; b++) {
          const ya = b * lh / 3, yb = (b + 1) * lh / 3 + (b < 2 ? 0.5 : 0);
          ctx.fillStyle = teintes[b][f];
          ctx.beginPath();
          ctx.moveTo(xa, top + o0 + ya); ctx.lineTo(xb, top + o1 + ya);
          ctx.lineTo(xb, top + o1 + yb); ctx.lineTo(xa, top + o0 + yb);
          ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  // CHAQUE DRAPEAU EST UNE IMAGE, PAS SIX TRANCHES. Trace a chaque image, un
  // drapeau coutait six remplissages et un trait ; a une finale, quand la
  // tribune se leve, il y en a des dizaines dans le cadre. On cuit donc une
  // fois, par pays, douze moments de l'ondulation, et on les colle : l'onde
  // avance d'une image sur douze, a peu pres une par dixieme de seconde.
  // Cuit a la densite de l'atlas en service (voir JEUX) : a soixante-quatre
  // pixels par metre, sur une toile a trois pixels par point, le drapeau
  // s'affichait agrandi deux fois, flou au milieu d'un public net.
  const NF_DRAPEAU = 12, MAX_DRAPEAUX = 40;
  const spritesDrapeau = new Map();
  function spriteDrapeau(k, f) {
    const m = jeu.ppmDrapeau, marge = 2;
    const cle = (m * 64 + k) * NF_DRAPEAU + f;
    let e = spritesDrapeau.get(cle);
    if (e) return e;
    const lw = 0.8 * m, lh = 0.52 * m, hampe = 0.95 * m;
    // le pied de la hampe, la ou la main la tient
    const x0 = marge + 1, y0 = Math.ceil(marge + lh * 0.14 + 1 + hampe);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(x0 + lw + 1 + marge);
    cv.height = y0 + marge;
    drapeau(cv.getContext('2d'), x0, y0, m, 0, f * Math.PI * 2 / NF_DRAPEAU, k);
    e = { cv, x0, y0, m };
    spritesDrapeau.set(cle, e);
    return e;
  }

  // -------------------------------------------------------------------
  // LA COMPOSITION D'UNE IMAGE
  // -------------------------------------------------------------------
  // Les pixels par metre des images composees : ceux de l'atlas en service
  // (voir JEUX).
  const ppmImage = () => jeu.ppm;
  const MAX_IMAGES = 1400;        // au-dela, on oublie les plus anciennes
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

  // LA COMPOSITION SE FAIT COUCHE PAR COUCHE, ET S'ARRETE A L'HEURE.
  //
  // Une image de spectateur, c'est six couches. Composee d'un bloc, elle
  // tombait entiere dans une seule image de la course : le budget, verifie
  // AVANT chaque composition, laissait passer la derniere jusqu'au bout.
  // Mesure le 29/09/2026 sur un 200 m, processeur bride comme celui d'un
  // telephone : cinq millisecondes par image composee, et deux fois plus
  // d'images au-dela de trente-trois millisecondes qu'avec l'ancien public.
  // On compose donc une couche a la fois et l'on s'arrete des que l'heure est
  // passee : l'image reprend ou elle en etait a l'appel suivant, et le
  // spectateur apparait quelques images plus tard — ce que personne ne voit,
  // alors qu'une course qui accroche se sent.
  const chantiers = new Map();
  const MAX_CHANTIERS = 64;

  /**
   * L'image d'un spectateur : une ligne de l'atlas (silhouette et geste, ou
   * le siege vide), un cap, un personnage, la couleur des sieges. `null` tant
   * qu'elle n'est pas finie.
   */
  function image(ligne, capI, pers, siege) {
    const cle = ligne + '|' + capI + '|' + (pers ? pers.id : -1) + '|' + siege;
    let e = cache.get(cle);
    if (e) return e;
    if (performance.now() > limite) return null;
    let ch = chantiers.get(cle);
    if (!ch) {
      if (budget <= 0) return null;
      budget--;
      ch = commencer(ligne, capI, pers, siege);
      chantiers.set(cle, ch);
      if (chantiers.size > MAX_CHANTIERS) chantiers.delete(chantiers.keys().next().value);
    }
    while (ch.i < ch.couches.length) {
      if (performance.now() > limite) return null;
      const [im, col] = ch.couches[ch.i++];
      // les chaussures ne se teignent pas : directement sur l'image, sans le
      // detour par le canevas de passage
      if (col) couche(ch.c, im, ch.sx, ch.sy, ch.sw, ch.sh, ch.w, ch.h, col);
      else ch.c.drawImage(im, ch.sx, ch.sy, ch.sw, ch.sh, 0, 0, ch.w, ch.h);
    }
    chantiers.delete(cle);
    e = { cv: ch.cv, ax: ch.ax, ay: ch.ay, w: ch.w, h: ch.h };
    cache.set(cle, e);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    return e;
  }

  /** Le chantier d'une image : son canevas et la liste de ses couches. */
  function commencer(ligne, capI, pers, siege) {
    const man = MAN();
    const [ax, ay] = man.ancres[ligne][capI];
    const [x0, y0, x1, y1] = man.cadres[ligne][capI];
    const k = ppmImage() / man.ppm;
    // Le rectangle source tombe sur des pixels entiers de l'atlas : a la meme
    // densite que l'image composee, la copie est alors exacte, sans le flou
    // d'un echantillonnage a cheval sur deux pixels.
    const sx = Math.floor(ax + x0), sy = Math.floor(ay + y0);
    const sw = Math.ceil(ax + x1) - sx, sh = Math.ceil(ay + y1) - sy;
    const w = Math.max(1, Math.ceil(sw * k)), h = Math.max(1, Math.ceil(sh * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const couches = [[atlas.siege, siege]];
    if (pers) {
      couches.push([atlas.base, null], [atlas.pantalon, pers.pantalon], [atlas.peau, pers.peau],
                   [atlas.maillot, pers.haut], [atlas.cheveux, pers.cheveux]);
    }
    return { cv, c: cv.getContext('2d'), couches, i: 0, sx, sy, sw, sh, w, h,
             ax: (ax - sx) * k, ay: (ay - sy) * k };
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
  let _personnages = null;
  /** La pose retenue par chaque spectateur, et le geste ou il l'a choisie. */
  const poses = new Map();
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
    if (th !== _themeCourant) {
      cache.clear(); chantiers.clear(); capsVus.clear(); poses.clear(); capsDuTrace = null;
      _themeCourant = th; _personnages = null;
    }
    budget = 48;
    const G = api.G, T = G.track;
    limite = performance.now() + (G.state === 'race' ? BUDGET_COURSE_MS : BUDGET_REPOS_MS);
    const vue = T.curved ? api.WROT_DEG : 0;
    const s = api.scaleM() / ppmImage();
    const PAS = 0.56;                       // un siege de stade, d'axe en axe
    if (!_personnages) _personnages = personnages(th);
    const pers = _personnages;
    const siegeC = hexa(teinteNuit(th, SIEGES[nom] || (th.base || th).accent || [80, 90, 120]));
    const man = MAN();
    const iAssis = 0, iApplaudit = 1, iDebout = 2, iVide = 3;
    // la ligne de l'atlas d'une silhouette et d'un geste (voir tribune.py)
    const nG = man.gestes.length, ligneVide = man.poses.indexOf('vide');
    const ligneDe = (sil, geste) => sil * nG + geste;
    const t = performance.now() / 1000;
    // en metres : un metre trois quarts et trois metres un quart, quel que soit
    // l'atlas (cent quarante et deux cent soixante pixels a quatre-vingts)
    const margeX = 1.75 * api.scaleM() * 1.6, margeY = 3.25 * api.scaleM() * 1.6;
    // part des spectateurs debout : presque personne a une rencontre
    // scolaire, un bon dixieme a la finale
    const debout = 0.02 + 0.10 * densite;

    // LE PUBLIC SUIT LA COURSE.
    //
    // `G.ferveur` dit ou en est la course (voir majFerveur, sprinter-app.js) :
    // silence au depart, montee vers l'arrivee, ovation sur la ligne. Elle
    // pese sur tout le gradin, mais davantage la ou passent les coureurs : on
    // se leve quand le peloton arrive devant soi, pas quand il est a cent
    // metres. A zero, rien ne change — c'est le public d'avant, qui vit sa vie.
    const ferveur = G.ferveur || 0;
    const foyers = [];
    if (ferveur > 0 && G.state === 'race' && T.pos) {
      for (const r of G.runners || []) {
        if (r.isGhost) continue;
        const q = T.pos(r.d, r.lane);
        foyers.push(q[0], q[1]);
      }
    }
    // A quel point ce bout de gradin a les coureurs sous les yeux : 1 a six
    // metres, plus rien au-dela de vingt-quatre.
    const presDe = (X, Y) => {
      let d2 = Infinity;
      for (let f = 0; f < foyers.length; f += 2) {
        const dx = foyers[f] - X, dy = foyers[f + 1] - Y;
        const e = dx * dx + dy * dy;
        if (e < d2) d2 = e;
      }
      if (d2 === Infinity) return 0;
      const d = Math.sqrt(d2);
      return d <= 6 ? 1 : d >= 24 ? 0 : 1 - (d - 6) / 18;
    };
    if (poses.size > 60000) poses.clear();

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
        // L'emotion de ce bout de rangee, une fois pour tous ses sieges.
        const eLoc = ferveur > 0 ? ferveur * (0.6 + 0.4 * presDe(a[0] + dx * 0.5, a[1] + dy * 0.5)) : 0;
        const pDebout = debout + 0.62 * eLoc;
        const pApplaudit = Math.min(0.96 - pDebout, 0.22 + 0.14 * eLoc);
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
            // chacun change de geste de temps en temps, jamais tous ensemble.
            //
            // LE RYTHME NE DEPEND PAS DE LA FERVEUR, et c'est voulu. Il en
            // dependait : la periode du geste raccourcissait quand le stade
            // s'enflammait. Mais `t` compte depuis l'ouverture de la page —
            // des centaines de secondes —, et diviser un grand nombre par une
            // periode qui bouge fait sauter le numero du geste a chaque
            // image : le public scintillait au lieu de s'animer. La ferveur
            // joue donc sur CE que chacun fait (debout, applaudir), jamais
            // sur la frequence a laquelle il change d'avis.
            //
            // ET LA POSE NE SE DECIDE QU'AU CHANGEMENT DE GESTE. La ferveur
            // bouge a chaque image — elle monte avec la course, et la
            // proximite des coureurs la module a chaque pas. Comparee a
            // chaque image au tirage de chacun, elle faisait basculer sans
            // cesse ceux dont le tirage tombait pres du seuil : des gens qui
            // se levaient et se rasseyaient n'importe quand, au hasard. On
            // retient donc la pose choisie jusqu'au geste suivant, et la
            // ferveur n'agit qu'a ce moment-la : le stade se leve peu a peu,
            // chacun a son tour.
            const cycle = Math.floor(t / (2.2 + (h % 7) * 0.3) + (h % 97) / 97 * 5);
            const vu = poses.get(h);
            if (vu && vu[0] === cycle) pose = vu[1];
            else {
              const v = hache(h, cycle, 3) % 1000 / 1000;
              pose = v < pDebout ? iDebout : (v < pDebout + pApplaudit ? iApplaudit : iAssis);
              poses.set(h, [cycle, pose]);
            }
          }
          items.push([api.depthOf(X, Y), g[0], g[1], pose, capI, h]);
        }
      }
    }
    // LES DRAPEAUX NE SORTENT QU'AUX GRANDS RENDEZ-VOUS. Une rencontre
    // scolaire ne brandit rien ; a partir du national, ceux qui sont venus
    // avec le leur le levent quand ils se levent — et la tribune se couvre de
    // couleurs a mesure que la course arrive devant elle (voir la ferveur,
    // plus haut). Ils passent dans la pile de leur porteur : le rang de
    // devant cache le bas de la hampe, le drapeau passe devant le rang de
    // derriere.
    const R = root.RenduPremium;
    const avecDrapeaux = densite >= 0.6 && !(R && R.niveau < R.MOYEN);
    const m = api.scaleM(), TOUR = Math.PI * 2;
    let drapeaux = 0;
    // du plus loin au plus pres
    items.sort((p, q) => q[0] - p[0]);
    for (const it of items) {
      const h = it[5];
      const pose = it[3];
      const p = pose === iVide ? null : pers[(h >>> 4) % pers.length];
      const im = image(p ? ligneDe(p.sil, pose) : ligneVide, it[4], p, siegeC);
      if (!im) continue;
      ctx.drawImage(im.cv, it[1] - im.ax * s, it[2] - im.ay * s, im.w * s, im.h * s);
      // la main levee d'un spectateur debout : un peu a droite, a 1,9 m
      // Le pays se tire a la place et non au personnage : quatre personnages
      // portent un drapeau, la tribune en montre onze.
      if (avecDrapeaux && pose === iDebout && p.drapeau && drapeaux < MAX_DRAPEAUX) {
        drapeaux++;
        const onde = ((t * 6 + (h % 628) / 100) % TOUR + TOUR) % TOUR;
        const e = spriteDrapeau((h >>> 11) % DRAPEAUX.length,
                                Math.floor(onde / TOUR * NF_DRAPEAU) % NF_DRAPEAU);
        const sd = m / e.m;
        // la nuit, une copie teinte du drapeau (heure-du-jour.js)
        const cvD = root.SprinterHeure ? root.SprinterHeure.image(e.cv, 'gradins') : e.cv;
        ctx.drawImage(cvD, it[1] + 0.2 * m - e.x0 * sd, it[2] - 1.9 * m - e.y0 * sd,
                      e.cv.width * sd, e.cv.height * sd);
      }
    }
    // TOUT COMPOSER AVANT LE PISTOLET. Hors course, le temps qui reste dans
    // l'image sert a composer d'avance TOUTES les combinaisons des caps du
    // trace. Mesure le 23 septembre 2026 au Champ-de-Mars : aucune tribune
    // n'est visible avant 42 m, rien n'etait donc compose, et la PREMIERE
    // composition — celle qui reveille les quatre planches de l'atlas
    // (4 862 × 1 188 chacune, decodees au premier dessin) — coutait 62 ms en
    // pleine course ; les suivantes, 0,4 ms. Faite ici, elle tombe pendant la
    // presentation ou le decompte.
    if (G.state !== 'race') {
      for (const capI of capsVus) {
        if (!image(ligneVide, capI, null, siegeC)) return true;
        for (let pose = 0; pose < 3; pose++) {
          for (const p of pers) {
            if (!image(ligneDe(p.sil, pose), capI, p, siegeC)) return true;
          }
        }
      }
    }
    return true;
  }

  // `images` : l'atlas du palier courant, pour que l'ecran d'ouverture le
  // decode avant la premiere course (chargement.ts).
  root.Tribune = { dessiner, pret: () => charger(), images: () => Object.values(atlas) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
