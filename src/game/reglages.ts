/**
 * Les reglages du joueur qui survivent a la fermeture du jeu : le son et la
 * vibration. La langue, elle, est deja gardee par SprinterApp.save().
 *
 * Le stockage peut manquer (navigation privee, donnees bloquees) : on retombe
 * alors sur « tout allume », comme avant que l'ecran existe.
 */
const CLE_SON = 'sprinter_son';
const CLE_VIBRE = 'sprinter_vibration';

function lire(cle: string): boolean {
  try { return localStorage.getItem(cle) !== '0'; } catch { return true; }
}
function ecrire(cle: string, on: boolean) {
  try { localStorage.setItem(cle, on ? '1' : '0'); } catch { /* sans stockage */ }
}

let vibre = lire(CLE_VIBRE);
// sprinter-ui.js (ancien code sans import) lit ce drapeau.
(window as any).__sprinterVibre = vibre;

export const sonGarde = () => lire(CLE_SON);
export const garderSon = (on: boolean) => ecrire(CLE_SON, on);

export const vibrationActive = () => vibre;
export function poserVibration(on: boolean) {
  vibre = on;
  (window as any).__sprinterVibre = on;
  ecrire(CLE_VIBRE, on);
}
