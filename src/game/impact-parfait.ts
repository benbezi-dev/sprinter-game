import { AFFICHE, OR, ROUGE } from './pinceau-film';

export type Impact = 'depart' | 'transition';
export const COUCHES_IMPACT = ['choc', 'elan', 'premierMot', 'titre'] as const;
export type CoucheImpact = typeof COUCHES_IMPACT[number];
export const LIBELLE_IMPACT = { depart: 'MONSTER KICK !', transition: 'BEAST MODE' };
export const LARGEUR_IMPACT = 260;
export const HAUTEUR_IMPACT = 70;

// Annonces ouvertes au lendemain du Championnat de France du 19/12 (heure de Paris).
const OUVERTURE_IMPACTS = Date.parse('2026-12-20T00:00:00+01:00');
export const impactsOuverts = (maintenant = Date.now()) => maintenant >= OUVERTURE_IMPACTS;

export const dureeFlash = { depart: 2.2, transition: 2.4 };
const mouvementReduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');
const borne = (n: number) => Math.min(1, Math.max(0, n));

// Poses en secondes de course. Le deuxième mot a son propre point d'impact.
type Cle = [temps: number, x: number, y: number, largeur: number, hauteur: number, angle: number, alpha: number];
export const FIN_IMPACT = 1.22;
const poses: Record<Impact, Record<CoucheImpact, Cle[]>> = {
  depart: {
    premierMot: [
      [0, -78, 13, 0.68, 0.86, -14, 0], [0.08, 1, -2, 1.14, 1.1, 0, 1],
      [0.16, 1, 3, 1.08, 0.85, 1, 1], [0.24, -7, -5, 1.1, 1.11, -5, 1],
      [0.41, -3, -2, 1.04, 1.04, -2, 1], [0.94, 6, -3, 1.12, 1.08, -3, 1],
      [1.04, 9, -2, 1.08, 1.06, -1, 1], [1.21, -65, -13, 0.79, 0.8, -12, 0],
    ],
    titre: [
      [0.1, 32, -17, 1.7, 1.65, 9, 0], [0.16, 0, 4, 1.35, 0.72, 1, 1],
      [0.25, -4, -4, 1.02, 1.25, -5, 1], [0.41, -1, 0, 1.1, 1.02, -2, 1],
      [0.94, 8, 1, 1.22, 1.15, -3, 1], [1.04, 4, 2, 1.15, 1.08, -1, 1],
      [1.21, 90, 5, 1.48, 0.68, -7, 0],
    ],
    choc: [[0.12, 0, 3, 0.15, 0.2, 4, 0], [0.17, 0, 4, 0.96, 0.88, 2, 1],
      [0.25, -2, 1, 1.11, 1.08, -2, 1], [0.48, -2, 0, 1.17, 1.12, -4, 0]],
    elan: [[0.14, 0, 4, 0.38, 0.26, 2, 0], [0.20, 0, 4, 0.84, 0.75, -2, 1],
      [0.34, 0, 2, 1.22, 1.08, -5, 1], [0.53, 0, 2, 1.39, 1.2, -8, 0]],
  },
  transition: {
    premierMot: [
      [0, -110, 8, 1.4, 0.7, -9, 0], [0.12, -4, 1, 1.03, 1.1, -2, 1],
      [0.22, 3, 0, 1, 1, -1, 1], [0.43, -11, 2, 0.91, 1.08, 2, 1],
      [0.57, 8, -2, 1.14, 0.94, -4, 1], [0.91, 13, -2, 1.05, 1.04, -3, 1],
      [1.04, 17, -2, 1.05, 1, -2, 1], [1.21, 131, -11, 1.47, 0.73, -7, 0],
    ],
    titre: [
      [0.10, -58, 11, 0.48, 0.64, -13, 0], [0.21, 11, -1, 1.21, 1.12, -4, 1],
      [0.30, 4, 0, 1, 1, 0, 1], [0.43, -9, 2, 0.94, 1.08, 2, 1],
      [0.57, 23, -2, 1.22, 0.94, -4, 1], [0.91, 16, -2, 1.04, 1.04, -3, 1],
      [1.00, 21, -3, 1.08, 1, -3, 1], [1.16, 116, -12, 1.5, 0.7, -8, 0],
    ],
    choc: [[0.32, -127, 4, 0.32, 0.7, -3, 0], [0.43, -66, 2, 1, 1, -3, 1],
      [0.62, 90, -3, 1.25, 1.04, -4, 1], [0.76, 148, -6, 1.42, 0.7, -5, 0]],
    elan: [[0.04, -57, 3, 0.26, 0.75, 0, 0], [0.17, -17, 0, 0.95, 1, -2, 1],
      [0.43, -29, 1, 0.77, 0.94, -1, 0.7], [0.57, 10, -1, 1.12, 1, -4, 1], [0.89, 55, -5, 1.35, 0.68, -5, 0]],
  },
};

const fondu: Cle[] = [[0, 0, 0, 1, 1, 0, 0], [0.06, 0, 0, 1, 1, 0, 1],
  [FIN_IMPACT - 0.15, 0, 0, 1, 1, 0, 1], [FIN_IMPACT, 0, 0, 1, 1, 0, 0]];

export function clesImpact(type: Impact, couche: CoucheImpact, reduit: boolean) {
  if (!reduit) return poses[type][couche];
  return couche === 'titre' || couche === 'premierMot' ? fondu : [];
}

export function mouvementImpact(type: Impact, reste: number, couche: CoucheImpact = 'titre') {
  const t = Math.max(0, dureeFlash[type] - reste);
  const cles = clesImpact(type, couche, !!mouvementReduit && mouvementReduit.matches);
  if (t >= FIN_IMPACT || !cles.length) return null;
  let i = 1;
  while (i < cles.length - 1 && t > cles[i][0]) i++;
  const a = cles[i - 1], b = cles[i];
  const progression = borne((t - a[0]) / (b[0] - a[0]));
  const interpoler = (v: number, w: number) => v + (w - v) * progression;
  return { alpha: interpoler(a[6], b[6]), x: interpoler(a[1], b[1]), y: interpoler(a[2], b[2]),
    largeur: interpoler(a[3], b[3]), hauteur: interpoler(a[4], b[4]), angle: interpoler(a[5], b[5]) };
}

export function peindreImpact(c: CanvasRenderingContext2D, type: Impact, couche: CoucheImpact = 'titre') {
  c.save();
  c.translate(LARGEUR_IMPACT / 2, HAUTEUR_IMPACT / 2);
  if (couche === 'choc') {
    if (type === 'depart') {
      // Encre de l'impact, en dents de scie derrière le lettrage.
      const pointes = [[-91, 8], [-113, -8], [-72, -5], [-94, -27], [-53, -16], [-51, -29],
        [-19, -18], [9, -31], [18, -20], [82, -29], [65, -13], [113, -16], [83, 1],
        [103, 12], [68, 12], [74, 25], [40, 18], [-6, 31], [-14, 22], [-81, 30], [-65, 16]];
      c.beginPath();
      pointes.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
      c.closePath(); c.fillStyle = '#151722'; c.fill();
      c.strokeStyle = OR; c.lineWidth = 2.5; c.stroke();
    } else {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 21;
        c.beginPath(); c.moveTo(x - 14, -20); c.lineTo(x, -20); c.lineTo(x + 16, -1);
        c.lineTo(x - 2, 20); c.lineTo(x - 18, 20); c.lineTo(x + 1, -1); c.closePath();
        c.fillStyle = i === 2 ? OR : ROUGE; c.fill();
        c.strokeStyle = '#101322'; c.lineWidth = 2; c.stroke();
      }
    }
  } else if (couche === 'elan') {
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
