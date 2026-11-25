import { AFFICHE, OR, ROUGE } from './pinceau-film';

export type Impact = 'depart' | 'transition';
export type CoucheImpact = 'elan' | 'titre';
export const LIBELLE_IMPACT = { depart: 'MONSTER KICK !', transition: 'BEAST MODE' };
export const LARGEUR_IMPACT = 260;
export const HAUTEUR_IMPACT = 70;

const dureeFlash = { depart: 2.2, transition: 2.4 };
const mouvementReduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');
const borne = (n: number) => Math.min(1, Math.max(0, n));

// Le HUD et le film utilisent le temps de la course, y compris quand le jeu est en pause.
export function mouvementImpact(type: Impact, reste: number, couche: CoucheImpact = 'titre') {
  const t = Math.max(0, dureeFlash[type] - reste);
  if (t >= 1.35) return null;
  const entree = borne(t / 0.18);
  const sortie = borne((t - 1.08) / 0.27);
  const alpha = borne(t / 0.055) * (1 - sortie);
  if (mouvementReduit && mouvementReduit.matches) {
    return couche === 'elan' ? null : { alpha, x: 0, y: 0, taille: 1 };
  }
  if (couche === 'elan') {
    const vol = borne((t - 0.045) / 0.53);
    if (vol === 0 || vol === 1) return null;
    const opacite = borne(vol * 9) * (1 - vol ** 2);
    return type === 'depart'
      ? { alpha: opacite, x: 0, y: 0, taille: 0.55 + 0.52 * (1 - (1 - vol) ** 3) }
      : { alpha: opacite, x: -40 + 54 * vol, y: 0, taille: 0.82 + 0.23 * vol };
  }
  if (type === 'transition') {
    return { alpha, x: -84 * (1 - entree) ** 3 + 28 * sortie ** 2, y: 5 * (1 - entree), taille: 1 };
  }
  const rebond = Math.sin(Math.PI * borne((t - 0.12) / 0.21));
  return { alpha, x: 0, y: -10 * (1 - entree) ** 2, taille: 1 + 0.44 * (1 - entree) ** 2 - 0.075 * rebond };
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
      c.beginPath(); c.moveTo(x,y); c.lineTo(finX,finY); c.lineTo(finX-5,finY+3); c.closePath(); c.fill();
    });
  } else {
    c.rotate(type === 'depart' ? -0.055 : -0.035);
    c.transform(1, 0, -0.14, 1, 0, 0);
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.lineJoin = 'round';
    const mot = (texte: string, y: number, taille: number, largeur: number) => {
      c.font = '900 ' + taille + 'px ' + AFFICHE;
      c.strokeStyle = '#060913'; c.lineWidth = 7;
      c.strokeText(texte, 0, y+2, largeur);
      c.fillStyle = '#8f222b'; c.fillText(texte, 0, y+3, largeur);
      const encre = c.createLinearGradient(0, y-taille/2, 0, y+taille/2);
      encre.addColorStop(0, '#ffb260'); encre.addColorStop(0.43, '#ff5948'); encre.addColorStop(1, ROUGE);
      c.fillStyle = encre; c.fillText(texte, 0, y, largeur);
    };
    if (type === 'depart') {
      mot('MONSTER', -12, 23, 132);
      mot('KICK !', 12, 35, 135);
    } else {
      mot(LIBELLE_IMPACT.transition, -1, 33, 213);
      c.fillStyle = OR;
      c.beginPath(); c.moveTo(-73,18); c.lineTo(75,15); c.lineTo(62,18); c.lineTo(-75,20); c.fill();
    }
  }
  c.restore();
}
