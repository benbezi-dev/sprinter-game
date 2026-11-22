/**
 * LA HAUTEUR DE L'ECRAN, FIGEE PENDANT QU'ON TAPE.
 *
 * Les variantes `court:` et `serre:` (index.css) regardaient la hauteur de la
 * fenetre en direct. Or le clavier du telephone la rogne de moitie
 * (Capacitor, `Keyboard.resize: 'native'`) : poser le doigt dans « LAISSE UN
 * MOT » a l'ecran de fin faisait passer un telephone debout sous 620 px, et
 * l'ecran basculait d'un coup dans sa mise en page « telephone couche » — deux
 * colonnes, boutons en rangee — sous les doigts (constate le 22/11/2026).
 *
 * Elles lisent donc des classes posees ici sur <html>, et ces classes ne
 * bougent pas pendant une saisie : seul un changement de LARGEUR (on tourne le
 * telephone) les recalcule alors. Le clavier ne change jamais la largeur.
 */

const BAS = 620;
const SERRE_H = 960;
const SERRE_L = 1100;

function enSaisie(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  if (a.isContentEditable) return true;
  if (a.tagName === 'TEXTAREA') return true;
  if (a.tagName !== 'INPUT') return false;
  const t = ((a as HTMLInputElement).type || 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image'].includes(t);
}

let largeurVue = -1;

function poser(force: boolean) {
  const w = window.innerWidth, h = window.innerHeight;
  if (!force && w === largeurVue && enSaisie()) return;
  largeurVue = w;
  const html = document.documentElement;
  html.classList.toggle('ecran-bas', h <= BAS);
  html.classList.toggle('ecran-serre', h <= SERRE_H && w <= SERRE_L);
}

export function brancherHauteurFigee() {
  if (typeof window === 'undefined') return;
  poser(true);
  window.addEventListener('resize', () => poser(false));
  window.addEventListener('orientationchange', () => setTimeout(() => poser(true), 300));
  // Le clavier se replie apres la perte du focus : on repasse quand il est rentre.
  document.addEventListener('focusout', () => {
    setTimeout(() => poser(false), 350);
    setTimeout(() => poser(false), 900);
  });
}
