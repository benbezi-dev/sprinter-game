import { AFFICHE, OR, ROUGE } from './pinceau-film';

export type Impact = 'depart' | 'transition';
export const COUCHES_IMPACT = ['elan', 'premierMot', 'titre'] as const;
export type CoucheImpact = typeof COUCHES_IMPACT[number];
export const LIBELLE_IMPACT = { depart: 'MONSTER KICK !', transition: 'BEAST MODE' };
export const LARGEUR_IMPACT = 260;
export const HAUTEUR_IMPACT = 70;

const dureeFlash = { depart: 2.2, transition: 2.4 };
const mouvementReduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');
const borne = (n: number) => Math.min(1, Math.max(0, n));

// Poses en secondes de course. Le deuxième mot a son propre point d'impact.
type Cle = [temps: number, x: number, y: number, largeur: number, hauteur: number, angle: number];
const fin = 1.22;
const poses: Record<Impact, Record<CoucheImpact, Cle[]>> = {
  depart: {
    premierMot: [
      [0, -53, 12, 0.72, 0.74, -13], [0.13, 2, -1, 1.12, 1.08, 1],
      [0.23, 0, 3, 1.02, 0.86, -1], [0.32, -5, -5, 1.04, 1.08, -4],
      [0.47, -2, -1, 1, 1, 0], [0.99, 4, -2, 1.04, 1.04, -2],
      [fin, -45, -13, 0.8, 0.8, -10],
    ],
    titre: [
      [0.12, 35, -16, 1.5, 1.65, 8], [0.23, 0, 4, 1.31, 0.74, -2],
      [0.33, -3, -3, 0.97, 1.22, -4], [0.46, 0, 0, 1.05, 1, 0],
      [0.99, 6, 1, 1.13, 1.07, -2], [fin, 63, 4, 1.35, 0.72, -6],
    ],
    elan: [[0.21, 0, 5, 0.35, 0.3, 0], [0.31, 0, 4, 0.88, 0.85, -3], [0.61, 0, 3, 1.25, 1.1, -6]],
  },
  transition: {
    premierMot: [
      [0, -81, 7, 1.36, 0.75, -9], [0.15, -2, 0, 1, 1.05, -2],
      [0.29, 3, 0, 0.96, 1, 0], [0.54, -9, 2, 0.95, 1.07, 1],
      [0.65, 1, 0, 1.1, 0.95, -2], [0.98, 8, -1, 1, 1, -2], [fin, 108, -10, 1.45, 0.69, -5],
    ],
    titre: [
      [0.13, -56, 13, 0.54, 0.62, -12], [0.27, 9, -2, 1.19, 1.12, -3],
      [0.39, 4, 0, 1, 1, 0], [0.54, -5, 1, 0.96, 1.07, 1],
      [0.65, 16, -1, 1.14, 0.96, -2], [0.98, 12, -1, 1, 1, -2], [1.17, 105, -11, 1.38, 0.7, -5],
    ],
    elan: [[0.49, -35, 3, 0.32, 0.72, 0], [0.65, -6, 0, 1.05, 1, -2], [1.1, 48, -4, 1.2, 0.6, -4]],
  },
};

export function mouvementImpact(type: Impact, reste: number, couche: CoucheImpact = 'titre') {
  const t = Math.max(0, dureeFlash[type] - reste);
  if (t >= fin) return null;
  if (mouvementReduit && mouvementReduit.matches) {
    return couche === 'elan' ? null : { alpha: borne(t / 0.06) * borne((fin - t) / 0.15), x: 0, y: 0, largeur: 1, hauteur: 1, angle: 0 };
  }
  const cles = poses[type][couche];
  const debut = cles[0][0];
  const derniere = cles[cles.length - 1][0];
  if (couche === 'elan' && (t < debut || t >= derniere)) return null;
  let i = 1;
  while (i < cles.length - 1 && t > cles[i][0]) i++;
  const a = cles[i - 1], b = cles[i];
  const progression = borne((t - a[0]) / (b[0] - a[0]));
  const interpoler = (v: number, w: number) => v + (w - v) * progression;
  const alpha = borne((t - debut) / 0.045) * borne((derniere - t) / (couche === 'elan' ? 0.23 : 0.15));
  return { alpha, x: interpoler(a[1], b[1]), y: interpoler(a[2], b[2]),
    largeur: interpoler(a[3], b[3]), hauteur: interpoler(a[4], b[4]), angle: interpoler(a[5], b[5]) };
}

export function peindreImpact(c: CanvasRenderingContext2D, type: Impact, couche: CoucheImpact = 'titre') {
  c.save();
  c.translate(LARGEUR_IMPACT / 2, HAUTEUR_IMPACT / 2);
  if (couche === 'elan') {
    // Au départ les éclats s'écartent du point de frappe. En transition les traits suivent la foulée.
    const rayons = type === 'depart'
      ? [[-112,-19,-76,-9],[-99,-32,-63,-16],[-122,16,-81,10],[-79,32,-53,21],[76,-19,107,-32],[81,-7,126,-15],[77,10,122,23],[53,20,72,32]]
      : [[-125,-17,-48,-17],[-121,-6,-74,-6],[-127,6,-64,6],[-113,18,-38,18],[68,-22,113,-22],[84,12,121,12]];
    rayons.forEach(([x,y,finX,finY], i) => {
      c.fillStyle = i % 2 ? ROUGE : OR;
      c.beginPath(); c.moveTo(x,y); c.lineTo(finX,finY); c.lineTo(finX-8,finY+5); c.closePath(); c.fill();
    });
  } else {
    c.rotate(type === 'depart' ? -0.055 : -0.035);
    c.transform(1, 0, -0.14, 1, 0, 0);
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.lineJoin = 'round';
    const mot = (texte: string, x: number, y: number, taille: number, largeur: number) => {
      c.font = '900 ' + taille + 'px ' + AFFICHE;
      c.strokeStyle = '#060913'; c.lineWidth = 7;
      c.strokeText(texte, x, y+2, largeur);
      c.fillStyle = '#8f222b'; c.fillText(texte, x, y+3, largeur);
      const encre = c.createLinearGradient(0, y-taille/2, 0, y+taille/2);
      encre.addColorStop(0, '#ffb260'); encre.addColorStop(0.43, '#ff5948'); encre.addColorStop(1, ROUGE);
      c.fillStyle = encre; c.fillText(texte, x, y, largeur);
    };
    if (type === 'depart') {
      if (couche === 'premierMot') mot('MONSTER', -4, -14, 25, 145);
      else mot('KICK !', 4, 12, 39, 145);
    } else if (couche === 'premierMot') {
      mot('BEAST', -47, -1, 36, 102);
    } else {
      mot('MODE', 48, -1, 36, 85);
      c.fillStyle = OR;
      c.beginPath(); c.moveTo(-1,19); c.lineTo(89,15); c.lineTo(76,20); c.lineTo(-6,22); c.fill();
    }
  }
  c.restore();
}
