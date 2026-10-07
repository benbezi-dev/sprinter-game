// LA MONTEE VERS LA LIGNE DE KARMAN — la cinematique d'entree de 0.Games.
//
// Le storyboard (projets/carriere-legende/PLAN.md, §3), au canvas et sans un
// modele Tripo : la fusee monte du pas de tir et traverse les couches dans
// leur ordre vrai — troposphere (0 a 12 km : cumulus, un long-courrier vers
// dix kilometres), stratosphere (12 a 50 km : le bleu fonce, l'horizon se
// courbe, un ballon-sonde, la lueur de la couche d'ozone), mesosphere (50 a
// 85 km : le noir, les nuages noctulescents, deux etoiles filantes qui
// brulent EN DESSOUS de nous) — puis les moteurs se coupent a 100 km, sur la
// ligne de Karman, et l'Olympe apparait : le temple, et les dieux qui
// regardent.
//
// Toute la scene est calculee depuis le temps : rien ne s'accumule, et la
// toile se redessine a la taille de l'ecran. Une touche passe.

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { citeCeleste, W as CITE_W, AX as CITE_AX, AY as CITE_AY } from '@/game/legende/cite-celeste';
import { cumulus, chargerLesCumulus, poserCumulus } from '@/game/legende/nuages';
import { dieuxSpectateurs } from '@/game/legende/decors';
import { mot } from '@/game/legende/mots';

const DUREE = 12.5;

type Rgb = [number, number, number];
const melange = (a: Rgb, b: Rgb, t: number): Rgb =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lisse = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fenetre = (t: number, a: number, b: number) => lisse((t - a) / (b - a));

// L'altitude, en km, au fil des secondes : lente au decollage, puis la
// poussee, et l'arret net a cent kilometres.
const JALONS: [number, number][] = [[0, 0], [1.4, 0], [3.6, 12], [6.0, 50], [8.4, 85], [9.6, 100], [DUREE, 100]];
function altitude(t: number) {
  for (let i = 1; i < JALONS.length; i++) {
    const [t1, a1] = JALONS[i], [t0, a0] = JALONS[i - 1];
    if (t <= t1) return a0 + (a1 - a0) * lisse((t - t0) / (t1 - t0 || 1));
  }
  return 100;
}
// Le ciel par altitude : (km, haut, bas)
const CIELS: [number, Rgb, Rgb][] = [
  [0, [118, 170, 232], [250, 178, 120]],      // crepuscule au pas de tir
  [12, [52, 108, 196], [130, 184, 236]],
  [50, [12, 26, 72], [34, 66, 132]],
  [85, [3, 4, 14], [10, 14, 34]],
  [100, [0, 0, 4], [4, 4, 12]],
];
function ciel(alt: number): [Rgb, Rgb] {
  for (let i = 1; i < CIELS.length; i++) {
    if (alt <= CIELS[i][0]) {
      const t = (alt - CIELS[i - 1][0]) / (CIELS[i][0] - CIELS[i - 1][0]);
      return [melange(CIELS[i - 1][1], CIELS[i][1], t), melange(CIELS[i - 1][2], CIELS[i][2], t)];
    }
  }
  return [CIELS[CIELS.length - 1][1], CIELS[CIELS.length - 1][2]];
}
const COUCHES: [number, number, string][] = [[1.6, 3.8, 'tropo'], [3.9, 6.2, 'strato'], [6.3, 8.6, 'meso']];

function fusee(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flamme: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (flamme > 0) {
    const f = (26 + Math.sin(t * 50) * 5) * flamme;
    const g = ctx.createLinearGradient(0, 20, 0, 20 + f);
    g.addColorStop(0, 'rgba(255,248,200,1)'); g.addColorStop(0.4, 'rgba(255,170,60,0.95)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-6, 20); ctx.quadraticCurveTo(0, 20 + f * 1.1, 6, 20); ctx.closePath(); ctx.fill();
  }
  // les ailerons
  ctx.fillStyle = '#E5302C';
  ctx.beginPath(); ctx.moveTo(-7, 8); ctx.lineTo(-14, 22); ctx.lineTo(-7, 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(14, 22); ctx.lineTo(7, 18); ctx.closePath(); ctx.fill();
  // le corps
  ctx.fillStyle = '#F4F4F2'; ctx.strokeStyle = '#5A6070'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-7, 20); ctx.lineTo(-7, -10); ctx.quadraticCurveTo(-6, -26, 0, -34);
  ctx.quadraticCurveTo(6, -26, 7, -10); ctx.lineTo(7, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E5302C';
  ctx.beginPath(); ctx.moveTo(-5.2, -18); ctx.quadraticCurveTo(0, -20, 5.2, -18); ctx.quadraticCurveTo(4, -28, 0, -34);
  ctx.quadraticCurveTo(-4, -28, -5.2, -18); ctx.fill();
  ctx.fillStyle = '#9FD6F2'; ctx.beginPath(); ctx.arc(0, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function nuage(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  // UN SEUL TRACE, rempli une fois : cinq disques remplis chacun a part,
  // translucides, laissaient voir leurs recouvrements comme des coutures.
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  for (const [dx, dy, k] of [[0, 0, 1], [-0.9, 0.2, 0.75], [0.9, 0.25, 0.7], [-0.4, -0.45, 0.7], [0.45, -0.35, 0.65]]) {
    const cx = x + dx * r, cy = y + dy * r;
    ctx.moveTo(cx + r * k, cy); ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
  }
  ctx.fill();
}

export function CinematiqueKarman({ lieu, onFin }: { lieu: string; onFin: () => void }) {
  const toile = useRef<HTMLCanvasElement | null>(null);
  const fini = useRef(false);
  // Le parent passe une fonction neuve a chaque rendu : dans les dependances,
  // elle relancerait la cinematique a chaque fois.
  const surFin = useRef(onFin);
  surFin.current = onFin;
  useEffect(() => {
    const cv = toile.current!;
    const ctx = cv.getContext('2d')!;
    chargerLesCumulus();
    let cite = citeCeleste();
    const dieux = dieuxSpectateurs(lieu).map(d => { const im = new Image(); im.src = d.url; return { im, p: d.p }; });
    const etoiles = Array.from({ length: 160 }, (_, i) => {
      const g = Math.imul(i + 11, 2654435761) >>> 0;
      return [(g % 1000) / 1000, ((g >>> 10) % 1000) / 1000, 0.5 + ((g >>> 20) % 10) / 8];
    });
    const nuages = Array.from({ length: 12 }, (_, i) => {
      const g = Math.imul(i + 3, 2246822519) >>> 0;
      return { x: (g % 1000) / 1000, t: 1.7 + (i / 12) * 1.8, r: 0.07 + ((g >>> 12) % 100) / 1200 };
    });
    const t0 = performance.now();
    let raf = 0;
    const finir = () => { if (fini.current) return; fini.current = true; surFin.current(); };
    const image = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = (now - t0) / 1000;
      if (t >= DUREE) { finir(); return; }
      const alt = altitude(t);
      const [haut, bas] = ciel(alt);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, css(haut)); g.addColorStop(1, css(bas));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // les etoiles, des la stratosphere
      const nuit = fenetre(alt, 30, 90);
      if (nuit > 0) for (const [x, y, r] of etoiles) {
        ctx.fillStyle = `rgba(255,255,255,${nuit * (0.45 + 0.35 * Math.sin(t * 2 + x * 40))})`;
        ctx.fillRect(x * W, y * H * 0.85, r, r);
      }

      // la Terre : au pas de tir, le sol ; puis l'horizon qui s'arrondit
      const courbe = fenetre(alt, 8, 100);
      const R = W * (14 - 12.4 * courbe);
      const sommet = H * (0.86 + 0.08 * courbe);
      ctx.fillStyle = alt < 4 ? css(melange([40, 52, 70], [26, 70, 128], fenetre(alt, 0, 4))) : '#1E5AA0';
      ctx.beginPath(); ctx.arc(W / 2, sommet + R, R, 0, Math.PI * 2); ctx.fill();
      // l'atmosphere en liseret, et la lueur orangee de l'ozone
      ctx.strokeStyle = `rgba(150,210,255,${0.25 + 0.5 * courbe})`; ctx.lineWidth = 3 + 4 * courbe;
      ctx.beginPath(); ctx.arc(W / 2, sommet + R, R + 2, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      const ozone = fenetre(t, 4.0, 4.8) * (1 - fenetre(t, 6.4, 7.2));
      if (ozone > 0) {
        ctx.strokeStyle = `rgba(255,160,80,${0.55 * ozone})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(W / 2, sommet + R, R + 10, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      }

      // la troposphere : les cumulus traverses, de haut en bas
      nuages.forEach((n, i) => {
        const u = (t - n.t) / 1.0;
        if (u < 0 || u > 1) return;
        const im = cumulus(i);
        if (im) poserCumulus(ctx, im, n.x * W, -H * 0.1 + u * H * 1.4, n.r * W * 4.2, i % 2 === 1);
        else nuage(ctx, n.x * W, -H * 0.2 + u * H * 1.4, n.r * W, 0.85);
      });
      // le long-courrier, vers dix kilometres
      const avion = fenetre(t, 2.6, 3.5);
      if (avion > 0 && avion < 1) {
        const x = W * (1.1 - 1.3 * avion), y = H * (0.25 + 0.4 * avion);
        ctx.fillStyle = '#EEF1F6';
        ctx.beginPath(); ctx.ellipse(x, y, 16, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 6, y - 11); ctx.lineTo(x + 9, y - 11); ctx.lineTo(x + 5, y); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + 90, y - 30); ctx.stroke();
      }
      // le ballon-sonde, dans la stratosphere
      const ballon = fenetre(t, 4.3, 5.8);
      if (ballon > 0 && ballon < 1) {
        const x = W * 0.24, y = -H * 0.1 + ballon * H * 1.2;
        ctx.fillStyle = '#F4F4F2'; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#C8CCD4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 44); ctx.stroke();
        ctx.fillStyle = '#E5302C'; ctx.fillRect(x - 3, y + 44, 6, 5);
      }
      // la mesosphere : les nuages noctulescents, argentes, sous la fusee
      const noct = fenetre(t, 6.2, 6.9) * (1 - fenetre(t, 8.4, 9.0));
      if (noct > 0) {
        for (let i = 0; i < 5; i++) {
          const y = H * (0.68 + i * 0.045) + Math.sin(t + i) * 4;
          const gr = ctx.createLinearGradient(0, y, W, y);
          gr.addColorStop(0, 'rgba(170,220,255,0)'); gr.addColorStop(0.5, `rgba(190,230,255,${0.32 * noct})`); gr.addColorStop(1, 'rgba(170,220,255,0)');
          ctx.fillStyle = gr; ctx.fillRect(0, y, W, 5);
        }
      }
      // deux etoiles filantes, qui brulent EN DESSOUS de nous
      for (const [d, x0] of [[6.8, 0.15], [7.5, 0.6]]) {
        const u = (t - d) / 0.6;
        if (u < 0 || u > 1) continue;
        const x = W * (x0 + 0.3 * u), y = H * (0.66 + 0.1 * u);
        const gr = ctx.createLinearGradient(x - 60, y - 20, x, y);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,240,200,${1 - u})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 60, y - 20); ctx.lineTo(x, y); ctx.stroke();
      }

      // L'OLYMPE : les dieux, puis le temple, qui sortent du noir
      const olympe = fenetre(t, 9.6, 11.0);
      if (olympe > 0) {
        ctx.save();
        ctx.globalAlpha = olympe;
        // le noir de l'espace s'ouvre sur le ciel celeste, du bleu profond a l'or
        const cielO = ctx.createLinearGradient(0, 0, 0, H);
        cielO.addColorStop(0, 'rgb(48,56,116)'); cielO.addColorStop(0.7, 'rgb(236,170,120)'); cielO.addColorStop(1, 'rgb(252,214,160)');
        ctx.fillStyle = cielO; ctx.fillRect(0, 0, W, H);
        const halo = ctx.createRadialGradient(W / 2, H * 0.36, 10, W / 2, H * 0.36, W * 0.7);
        halo.addColorStop(0, 'rgba(255,214,120,0.45)'); halo.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
        const hD = H * 0.46 * (0.92 + 0.08 * olympe);
        // celui du milieu derriere la porte ; les deux autres DEVANT la cite :
        // derriere, les tours de ses iles leur traversaient le visage
        const dieu = (i: number) => {
          const d = dieux[i];
          if (!d || !d.im.complete || !d.im.naturalWidth) return;
          const k = hD / d.p.ay, x = W * [0.16, 0.84, 0.5][i] , y = H * 0.62 - (1 - olympe) * 30;
          ctx.globalAlpha = olympe * (i === 2 ? 0.55 : 0.92);
          ctx.drawImage(d.im, x - d.p.ax * k, y - d.p.ay * k, d.p.w * k, d.p.h * k);
        };
        dieu(2);
        ctx.globalAlpha = olympe;
        cite = citeCeleste();
        if (cite) {
          // la cite celeste, son pied sur le banc de nuages
          const k = Math.min(W * 1.05, 700) / CITE_W;
          ctx.drawImage(cite, W / 2 - CITE_AX * k, H * 0.8 - CITE_AY * k + (1 - olympe) * 20, cite.width * k, cite.height * k);
        }
        dieu(0); dieu(1);
        ctx.globalAlpha = olympe;
        // et sous elle, la mer de nuages jusqu'au bas de l'ecran, en rangs
        // de plus en plus grands a mesure qu'ils approchent
        for (let rang = 0; rang < 4; rang++) {
          const y = H * (0.82 + rang * 0.065), l = W * (0.34 + rang * 0.1);
          for (let j = -1; j * l * 0.6 < W + l; j++) {
            const g = Math.imul(j + 7 + rang * 31, 2654435761) >>> 0;
            const im = cumulus(g);
            if (im) poserCumulus(ctx, im, j * l * 0.6 + (rang % 2) * l * 0.3 + Math.sin(t * 0.4 + j) * 4,
                                 y + (1 - olympe) * 30 + (g % 12), l * (0.9 + ((g >>> 6) % 30) / 100), ((g >>> 3) & 1) === 1);
          }
        }
        ctx.restore();
      }

      // la fusee : au centre, tremblante tant que les moteurs poussent
      const pousse = t < 9.6 ? 1 : 0;
      const tremble = pousse * (t > 1.2 ? 1.6 : 0.4);
      const yF = t < 1.4 ? H * (0.74 - 0.02 * lisse(t / 1.4)) : H * 0.62;
      const sortie = fenetre(t, 9.6, 10.6);
      fusee(ctx, W / 2 + Math.sin(t * 70) * tremble, yF - sortie * H * 0.8, Math.min(2.2, W / 220),
            t < 1.0 ? 0.3 : pousse, t);
      // la vapeur au pied, au decollage
      if (t < 2.4) {
        for (let i = 0; i < 9; i++) nuage(ctx, W / 2 + (i - 4) * 24, H * 0.82 + Math.sin(i) * 6, 16 + i % 3 * 5,
                                          0.5 * (1 - fenetre(t, 1.2, 2.4)));
      }

      // LE HUD : le compte, l'altitude, la couche
      ctx.textAlign = 'center';
      if (t < 1.4) {
        const n = 3 - Math.floor(t / 0.47);
        if (n > 0) { ctx.font = `900 ${Math.round(H * 0.12)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText(String(n), W / 2, H * 0.34); }
      }
      ctx.font = `700 ${Math.round(Math.max(12, H * 0.018))}px ui-monospace, monospace`;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`ALT ${alt.toFixed(alt < 10 ? 1 : 0)} km`, 18, 34);
      ctx.textAlign = 'center';
      for (const [a, b, nom] of COUCHES) {
        const v = fenetre(t, a, a + 0.4) * (1 - fenetre(t, b - 0.4, b));
        if (v <= 0) continue;
        ctx.font = `800 ${Math.round(Math.max(14, H * 0.026))}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * v})`; ctx.fillText(mot(nom), W / 2, H * 0.16);
      }
      const titre = fenetre(t, 9.0, 9.5);
      if (titre > 0) {
        ctx.font = `900 ${Math.round(Math.max(18, H * 0.036))}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255,214,120,${titre})`; ctx.fillText(mot('karman_titre'), W / 2, H * 0.16);
      }
      ctx.font = `600 ${Math.round(Math.max(10, H * 0.014))}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(mot('passer'), W / 2, H - 22);
      // le fondu de sortie
      const noir = fenetre(t, DUREE - 0.6, DUREE);
      if (noir > 0) { ctx.fillStyle = `rgba(0,0,0,${noir})`; ctx.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, [lieu]);

  return createPortal(
    <div data-legende="karman" className="fixed inset-0 z-[60] bg-black" onPointerDown={() => { if (!fini.current) { fini.current = true; surFin.current(); } }}>
      <canvas ref={toile} className="w-full h-full block" />
    </div>,
    document.body,
  );
}
