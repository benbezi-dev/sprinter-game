// LA CITE CELESTE — le lointain de la ligne de Karman, peint a la main.
//
// L'auteur, le 07/10, images de reference a l'appui : « je veux que le
// decor et la piste soient celestes ». Pas de modele : une toile peinte une
// fois au canvas (puis gardee), d'apres ses images — du fond vers l'avant :
//
//   - les rayons dores qui tombent du ciel derriere la porte ;
//   - deux iles de nuage qui flottent, leurs petites tours et leurs cascades ;
//   - deux grandes tours de marbre blanc a filets d'or, coiffees d'un
//     croissant, une porte qui brille a leur pied ;
//   - au centre la porte d'or : l'arche de marbre en ogive, sa lumiere, les
//     grandes feuilles d'or et les croissants qui l'encadrent ;
//   - des colombes, de la poussiere d'or, et le banc de nuages ou tout pose.
//
// Elle se pose comme les monuments (decors.ts) : son pied (AX, AY) sur
// l'horizon du stade, a une position d'ECRAN.

export const W = 1400, H = 1300;
export const AX = 700, AY = 1230;

import { cumulus, cumulusCharges, poserCumulus } from './nuages';

let toile: HTMLCanvasElement | null = null;
// les cumulus que la toile en cache a connus : elle se repeint quand d'autres
// arrivent (avant, ses nuages sont les bouffees peintes ci-dessous)
let charges = -1;

const OR = '#E9B84E', OR_CLAIR = '#FFE29A', MARBRE = '#FBF7F2', MARBRE_OMBRE = '#E2D4DE';

function bouffee(c: CanvasRenderingContext2D, x: number, y: number, r: number, clair: string, ombre: string) {
  const g = c.createRadialGradient(x - r * 0.25, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, clair); g.addColorStop(0.7, ombre); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

function banc(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, r: number, graine: number) {
  // les cumulus rendus, en rang serre ; a defaut, des bouffees
  if (cumulus(0)) {
    for (let i = 0; x0 + i * r * 2.2 < x1 + r * 2; i++) {
      const g = Math.imul(i + graine, 2654435761) >>> 0;
      const im = cumulus(g);
      if (im) poserCumulus(c, im, x0 + i * r * 2.2 + (g % 60) - 30, y + ((g >>> 12) % 30),
                           r * (3.6 + ((g >>> 8) % 120) / 100), ((g >>> 3) & 1) === 1);
    }
    return;
  }
  for (let i = 0; x0 + i * r * 0.55 < x1; i++) {
    const g = Math.imul(i + graine, 2654435761) >>> 0;
    const x = x0 + i * r * 0.55 + (g % 40) - 20;
    const rr = r * (0.7 + ((g >>> 8) % 60) / 100);
    bouffee(c, x, y - ((g >>> 16) % 50), rr, 'rgba(255,250,246,0.98)', 'rgba(238,216,226,0.9)');
  }
}

function croissant(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const g = c.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, OR_CLAIR); g.addColorStop(1, OR);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI, false);
  c.arc(0, -r * 0.32, r * 0.86, Math.PI, 0, true);
  c.closePath(); c.fill();
  c.restore();
}

function feuille(c: CanvasRenderingContext2D, x: number, y: number, l: number, ang: number) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const g = c.createLinearGradient(0, 0, 0, -l);
  g.addColorStop(0, OR); g.addColorStop(1, OR_CLAIR);
  c.fillStyle = g; c.strokeStyle = 'rgba(190,140,40,0.8)'; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(l * 0.32, -l * 0.25, l * 0.26, -l * 0.75, 0, -l);
  c.bezierCurveTo(-l * 0.26, -l * 0.75, -l * 0.32, -l * 0.25, 0, 0);
  c.fill();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -l * 0.95); c.stroke();
  c.restore();
}

function tour(c: CanvasRenderingContext2D, x: number, bas: number, haut: number, w: number) {
  // le fut, effile, ombre a droite
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, MARBRE); g.addColorStop(0.6, '#F3ECEA'); g.addColorStop(1, MARBRE_OMBRE);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - w / 2, bas); c.lineTo(x - w * 0.3, haut); c.lineTo(x + w * 0.3, haut); c.lineTo(x + w / 2, bas);
  c.closePath(); c.fill();
  // la fleche
  c.beginPath(); c.moveTo(x - w * 0.34, haut); c.lineTo(x, haut - w * 1.1); c.lineTo(x + w * 0.34, haut); c.closePath(); c.fill();
  // les filets d'or
  c.strokeStyle = OR; c.lineWidth = Math.max(2, w * 0.04);
  c.beginPath();
  c.moveTo(x - w / 2, bas); c.lineTo(x - w * 0.3, haut); c.lineTo(x, haut - w * 1.1); c.lineTo(x + w * 0.3, haut); c.lineTo(x + w / 2, bas);
  for (let k = 1; k < 4; k++) {
    const yy = bas + (haut - bas) * k / 4, ww = w / 2 - (w * 0.2) * k / 4;
    c.moveTo(x - ww, yy); c.lineTo(x + ww, yy);
  }
  c.stroke();
  // la porte qui brille au pied, en ogive
  const pw = w * 0.36, ph = w * 0.8;
  const lum = c.createLinearGradient(0, bas - ph, 0, bas);
  lum.addColorStop(0, '#FFF6D8'); lum.addColorStop(1, '#FFC860');
  c.fillStyle = lum;
  c.beginPath();
  c.moveTo(x - pw / 2, bas); c.lineTo(x - pw / 2, bas - ph * 0.6);
  c.quadraticCurveTo(x - pw / 2, bas - ph, x, bas - ph * 1.05);
  c.quadraticCurveTo(x + pw / 2, bas - ph, x + pw / 2, bas - ph * 0.6);
  c.lineTo(x + pw / 2, bas); c.closePath(); c.fill();
  // le croissant au sommet
  croissant(c, x, haut - w * 1.25, w * 0.32, 0);
}

function ile(c: CanvasRenderingContext2D, x: number, y: number, s: number, graine: number) {
  // la cascade, sous l'ile
  const cas = c.createLinearGradient(0, y, 0, y + 260 * s);
  cas.addColorStop(0, 'rgba(255,248,228,0.95)'); cas.addColorStop(1, 'rgba(255,248,228,0)');
  c.fillStyle = cas; c.fillRect(x + 20 * s, y, 26 * s, 260 * s);
  // les petites tours
  tour(c, x - 40 * s, y - 20 * s, y - 150 * s, 46 * s);
  tour(c, x + 50 * s, y - 25 * s, y - 110 * s, 34 * s);
  // le nuage qui la porte
  const nu = cumulus(graine);
  if (nu) { poserCumulus(c, nu, x, y + 60 * s, 420 * s, graine % 2 === 1); return; }
  for (let i = 0; i < 6; i++) {
    const g = Math.imul(i + graine, 2246822519) >>> 0;
    bouffee(c, x + (i - 2.5) * 34 * s, y + ((g >>> 4) % 20) * s, (46 + (g % 24)) * s,
            'rgba(255,250,246,0.98)', 'rgba(232,212,226,0.92)');
  }
}

function porte(c: CanvasRenderingContext2D, x: number, bas: number) {
  // le halo
  const halo = c.createRadialGradient(x, bas - 330, 20, x, bas - 330, 520);
  halo.addColorStop(0, 'rgba(255,240,190,0.9)'); halo.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = halo; c.fillRect(x - 600, bas - 900, 1200, 1000);
  // les grandes feuilles d'or, de part et d'autre
  for (const [dx, l, a] of [[-150, 430, -0.55], [-110, 520, -0.28], [150, 430, 0.55], [110, 520, 0.28], [-190, 320, -0.85], [190, 320, 0.85]] as const) {
    feuille(c, x + dx, bas - 40, l, a);
  }
  // l'arche de marbre, en ogive
  const aw = 300, ah = 560;
  c.fillStyle = MARBRE;
  c.beginPath();
  c.moveTo(x - aw / 2 - 34, bas); c.lineTo(x - aw / 2 - 34, bas - ah * 0.55);
  c.quadraticCurveTo(x - aw / 2 - 34, bas - ah - 40, x, bas - ah - 90);
  c.quadraticCurveTo(x + aw / 2 + 34, bas - ah - 40, x + aw / 2 + 34, bas - ah * 0.55);
  c.lineTo(x + aw / 2 + 34, bas); c.closePath(); c.fill();
  c.strokeStyle = OR; c.lineWidth = 7; c.stroke();
  // la lumiere de la porte
  const lum = c.createLinearGradient(0, bas - ah, 0, bas);
  lum.addColorStop(0, '#FFFBEA'); lum.addColorStop(0.6, '#FFE7A8'); lum.addColorStop(1, '#FFC458');
  c.fillStyle = lum;
  c.beginPath();
  c.moveTo(x - aw / 2, bas); c.lineTo(x - aw / 2, bas - ah * 0.55);
  c.quadraticCurveTo(x - aw / 2, bas - ah, x, bas - ah - 40);
  c.quadraticCurveTo(x + aw / 2, bas - ah, x + aw / 2, bas - ah * 0.55);
  c.lineTo(x + aw / 2, bas); c.closePath(); c.fill();
  // les entrelacs d'or dans la lumiere
  c.strokeStyle = 'rgba(214,160,60,0.75)'; c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x - 60, bas); c.bezierCurveTo(x - 110, bas - 200, x + 40, bas - 280, x - 20, bas - ah + 40);
  c.moveTo(x + 60, bas); c.bezierCurveTo(x + 110, bas - 200, x - 40, bas - 280, x + 20, bas - ah + 40);
  c.stroke();
  // les croissants qui l'encadrent, et celui du sommet
  croissant(c, x - aw / 2 - 70, bas - 120, 120, Math.PI * 0.42);
  croissant(c, x + aw / 2 + 70, bas - 120, 120, -Math.PI * 0.42);
  croissant(c, x, bas - ah - 150, 64, 0);
}

export function citeCeleste(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const n = cumulusCharges();
  if (toile && n === charges) return toile;
  charges = n;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return null;
  // les rayons qui tombent du ciel, derriere la porte
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.16;
    const g = c.createLinearGradient(AX, 560, AX + Math.cos(a) * 1200, 560 + Math.sin(a) * 1200);
    g.addColorStop(0, 'rgba(255,236,180,0.22)'); g.addColorStop(1, 'rgba(255,236,180,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(AX, 560);
    c.lineTo(AX + Math.cos(a - 0.05) * 1400, 560 + Math.sin(a - 0.05) * 1400);
    c.lineTo(AX + Math.cos(a + 0.05) * 1400, 560 + Math.sin(a + 0.05) * 1400);
    c.closePath(); c.fill();
  }
  c.restore();
  // les iles flottantes, au loin
  ile(c, 300, 560, 0.9, 7);
  ile(c, 1110, 470, 0.75, 13);
  // les grandes tours
  tour(c, 120, 1180, 360, 150);
  tour(c, 1290, 1180, 300, 160);
  // la porte d'or
  porte(c, AX, 1160);
  // les colombes
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 4; c.lineCap = 'round';
  for (const [x, y, s] of [[520, 300, 1], [860, 240, 0.8], [980, 380, 0.7], [420, 420, 0.6], [1180, 200, 0.7]] as const) {
    c.beginPath(); c.moveTo(x - 18 * s, y - 6 * s); c.quadraticCurveTo(x - 8 * s, y - 14 * s, x, y);
    c.quadraticCurveTo(x + 8 * s, y - 14 * s, x + 18 * s, y - 6 * s); c.stroke();
  }
  // la poussiere d'or
  for (let i = 0; i < 140; i++) {
    const g = Math.imul(i + 101, 2654435761) >>> 0;
    const x = g % W, y = (g >>> 11) % (H - 200), r = 1 + ((g >>> 22) % 4);
    c.fillStyle = `rgba(255,226,150,${0.35 + ((g >>> 5) % 50) / 100})`;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // le banc de nuages ou tout pose
  banc(c, -60, W + 60, 1230, 120, 3);
  banc(c, -30, W + 30, 1290, 100, 17);
  toile = cv;
  return cv;
}
