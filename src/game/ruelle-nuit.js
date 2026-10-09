/* -----------------------------------------------------------------------
   SPRINTER — LA RUELLE DE LA NUIT DU MOLOSSE, ce qui se peint a la main.

   Les maisons, la porte, les poubelles et les reverberes sont des pieces
   Tripo rendues dans Blender (decors-stades.js, PLAN.halloween). Restaient
   deux trous, tous deux dus a la camera basse des nuits :

   - LE BAS DE L'IMAGE ETAIT UN APLAT DE PAVES. C'est le cote de la rue le
     plus proche de la camera : une maison y cacherait les coureurs. On y
     pose donc ce qui est PLAT — un caniveau le long de chaque bord de piste,
     des flaques qui renvoient la lumiere des reverberes, des feuilles
     mortes. Rien ne depasse du sol, rien ne cache personne.
   - AU MILIEU D'UN VIRAGE, ON NE VOYAIT PLUS LA RUE. La piste y remplit
     l'ecran : les bords de la rue sont a six cents pixels de chaque cote.
     Ce qui se voit encore, c'est ce qui est EN HAUT : des guirlandes de
     lanternes tendues d'une facade a l'autre, a six metres, au-dessus de la
     piste. La hauteur se peint droit vers le haut de l'ecran (solid) : elles
     passent au-dessus des coureurs a chaque pas, en ligne droite comme en
     virage, et disent qu'on court entre deux murs.

   Tout ancre au MONDE (les echantillons de la piste) : rien ne glisse avec
   la camera. Reserve au theme qui porte `ruelle`.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  // Un tirage fixe par position : la meme flaque au meme endroit a chaque
  // image, et d'une course a l'autre.
  const hasard = (k) => {
    const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /**
   * Le sol de la ruelle, apres les paves et avant les pieces du fond : le
   * caniveau, les flaques, les feuilles.
   */
  function sol(ctx, P, th, rIn, rOut) {
    const G = P.G, m = P.scaleM(), t = G.elapsed || 0;
    const sm = P.samples(0);
    if (sm.length < 2) return;
    ctx.save();
    // LE CANIVEAU : une rigole de pierre sombre, un metre au-dela de chaque
    // bord, avec un filet d'eau qui accroche la lumiere.
    for (const r of [rIn - 1.0, rOut + 1.0]) {
      P.band(ctx, sm, r - 0.18, r + 0.18, 'rgba(10,10,16,0.55)');
      P.rail(ctx, sm, r, 'rgba(170,150,120,0.18)', Math.max(1, m * 0.03));
    }
    // LES FLAQUES ET LES FEUILLES, semees tous les quelques metres des deux
    // cotes de la piste.
    const pas = P.samples(6);
    for (let i = 0; i < pas.length; i++) {
      for (const cote of [-1, 1]) {
        const k = i * 2 + (cote > 0 ? 1 : 0);
        const loin = 1.6 + 6 * hasard(k + 11);
        const r = cote < 0 ? rIn - loin : rOut + loin;
        const q = P.ptOf(pas[i], r);
        const p = P.ground(q[0], q[1]);
        if (p[0] < -m * 3 || p[0] > G.VW + m * 3 || p[1] < -m * 2 || p[1] > G.VH + m * 2) continue;
        if (hasard(k + 3) < 0.45) {
          // une flaque : sombre et lisse, un reflet chaud qui tremble
          const rx = m * (0.7 + 0.9 * hasard(k + 5)), ry = rx * 0.22;
          ctx.fillStyle = 'rgba(6,8,14,0.55)';
          ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          const tremble = 0.85 + 0.15 * Math.sin(t * 3 + k);
          const g = ctx.createLinearGradient(p[0] - rx, p[1], p[0] + rx, p[1]);
          g.addColorStop(0, 'rgba(255,170,80,0)');
          g.addColorStop(0.5, `rgba(255,170,80,${0.22 * tremble})`);
          g.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(p[0], p[1] - ry * 0.2, rx * 0.8, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          // des feuilles mortes, trois ou quatre, roussies
          const n = 3 + Math.floor(hasard(k + 7) * 3);
          for (let j = 0; j < n; j++) {
            const dx = (hasard(k * 7 + j) - 0.5) * m * 1.4, dy = (hasard(k * 9 + j) - 0.5) * m * 0.3;
            const s = m * (0.08 + 0.05 * hasard(k + j));
            const c = hasard(k * 3 + j);
            ctx.fillStyle = c < 0.5 ? 'rgba(120,58,22,0.75)' : 'rgba(86,48,26,0.75)';
            ctx.beginPath();
            ctx.ellipse(p[0] + dx, p[1] + dy, s, s * 0.45, hasard(k + j * 5) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  // Les guirlandes : une tous les quatorze metres, tendue a six metres et
  // demi d'une facade a l'autre, qui pend d'un metre au milieu.
  // (premiere version : tous les 14 m, lanternes de 16 cm a corps noir — en
  // plein virage on ne voyait que des traits fins sur la piste, qu'on aurait
  // pris pour un defaut de dessin)
  const PAS_FIL = 9, HAUT = 6.5, FLECHE = 1.0, LANTERNES = 9;

  /**
   * Les guirlandes au-dessus de la rue. A appeler apres la piste et les
   * blocs, avant les coureurs : un coureur proche passe devant le fil.
   */
  function guirlandes(ctx, P, th, rIn, rOut) {
    const G = P.G, m = P.scaleM(), t = G.elapsed || 0;
    const sm = P.samples(PAS_FIL);
    const a = rIn - 3.5, b = rOut + 3.5;
    ctx.save();
    for (let i = 0; i < sm.length; i++) {
      // le fil, en chainette approchee par une parabole
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const u = j / 16, r = a + (b - a) * u;
        const z = HAUT - FLECHE * 4 * u * (1 - u);
        pts.push(P.solid(...P.ptOf(sm[i], r), z));
      }
      let vu = false;
      for (const p of pts) if (p[0] > -50 && p[0] < G.VW + 50 && p[1] > -50 && p[1] < G.VH + 50) vu = true;
      if (!vu) continue;
      ctx.strokeStyle = 'rgba(14,12,14,0.95)';
      ctx.lineWidth = Math.max(1.5, m * 0.05);
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      // les lanternes, pendues au fil : un corps sombre, une flamme qui bat
      for (let l = 1; l < LANTERNES; l++) {
        const u = l / LANTERNES, r = a + (b - a) * u;
        const z = HAUT - FLECHE * 4 * u * (1 - u) - 0.35;
        const p = P.solid(...P.ptOf(sm[i], r), z);
        const s = m * 0.26;
        const k = i * LANTERNES + l;
        const bat = 0.75 + 0.25 * Math.sin(t * (5 + 3 * hasard(k)) + k);
        // une lanterne sur cinq est eteinte : la rue n'est pas en fete
        const eteinte = hasard(k + 50) < 0.2;
        // la lanterne de papier : un ovale, ses cotes, sa coiffe noire
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = eteinte ? 'rgba(40,26,20,0.95)' : `rgb(${Math.round(210 * bat)},${Math.round(96 * bat)},30)`;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], s * 0.72, s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,16,6,0.6)';
        ctx.lineWidth = Math.max(1, s * 0.08);
        for (const f of [-0.35, 0, 0.35]) {
          ctx.beginPath(); ctx.ellipse(p[0], p[1], s * 0.72 * Math.abs(f) + 0.5, s, 0, -Math.PI / 2, Math.PI / 2, f < 0); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(10,8,8,0.95)';
        ctx.fillRect(p[0] - s * 0.35, p[1] - s * 1.12, s * 0.7, s * 0.22);
        if (eteinte) continue;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], s * 3.2);
        g.addColorStop(0, `rgba(255,160,60,${0.55 * bat})`);
        g.addColorStop(0.3, `rgba(240,90,20,${0.25 * bat})`);
        g.addColorStop(1, 'rgba(200,60,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p[0], p[1], s * 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  root.RuelleNuit = { sol, guirlandes };
})(typeof globalThis !== 'undefined' ? globalThis : this);
