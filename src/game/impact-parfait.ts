import { AFFICHE, OR, ROUGE } from './pinceau-film';

export type Impact = 'depart' | 'transition';
export const LIBELLE_IMPACT = { depart: 'MONSTER KICK 💥!', transition: 'BEAST MODE 🔥' };
export const LARGEUR_IMPACT = 250;
export const HAUTEUR_IMPACT = 44;

// Horloge des messages existants (engine.ts). La course filmée et le HUD suivent le même geste.
const dureeFlash = { depart: 2.2, transition: 2.4 };
const mouvementReduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');

export function mouvementImpact(type: Impact, reste: number) {
  const t = Math.max(0, dureeFlash[type] - reste);
  if (t >= 1.35) return null;
  const entree = Math.max(0, 1 - t / 0.22);
  const sortie = Math.max(0, (t - 1.08) / 0.27);
  const alpha = Math.min(1, t / 0.065, 1 - sortie);
  if (mouvementReduit && mouvementReduit.matches) return { alpha, x: 0, y: 0, taille: 1 };
  if (type === 'transition') return { alpha, x: -48 * entree ** 3 + 16 * sortie ** 2, y: 0, taille: 1 };
  return { alpha, x: 0, y: -4 * entree ** 2, taille: 1 + 0.28 * entree ** 2 - 0.055 * Math.sin(Math.PI * entree) };
}

// Coordonnées en points CSS. Le bitmap du HUD ne change pas pendant le mouvement.
export function peindreImpact(c: CanvasRenderingContext2D, type: Impact) {
  c.save();
  const bande = (couleur: string, x: number, y: number, largeur: number, hauteur: number, biais: number) => {
    c.fillStyle = couleur;
    c.beginPath();
    c.moveTo(x + biais, y); c.lineTo(x + largeur + biais, y);
    c.lineTo(x + largeur, y + hauteur); c.lineTo(x, y + hauteur); c.closePath(); c.fill();
  };
  bande('#060913', 10, 5, 224, 34, 10);
  bande(OR, 13, 36, 69, 3, 3);
  bande(ROUGE, 5, 12, 4, 21, 7);
  bande(OR, 237, 9, 3, 21, 7);
  c.translate(LARGEUR_IMPACT / 2, 23);
  c.transform(1, 0, -0.115, 1, 0, 0);
  c.font = '900 23px ' + AFFICHE;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const texte = LIBELLE_IMPACT[type];
  c.fillStyle = '#7c2029';
  c.fillText(texte, 0, 2, 210);
  c.fillStyle = ROUGE;
  c.fillText(texte, 0, 0, 210);
  c.restore();
}
