// Habillage Halloween de l'accueil — l'interrupteur, et lui seul.
//
// Un decor saisonnier pose UNIQUEMENT sur l'ecran d'ouverture et le menu, pas
// sur la course. Il suit la MEME porte que le mode molosse, HALLOWEEN_OUVERT
// (canal.ts) : ouvert, l'accueil est habille ; ferme, il reprend son or et le
// decor sort du build — il est charge en lazy derriere cette meme constante
// (voir App.tsx), comme tout le reste du mode.
//
// ?halloween=0 l'eteint ponctuellement, le temps d'une capture de l'accueil
// normal.
import { HALLOWEEN_OUVERT } from '@/game/canal';

export function estHalloween(): boolean {
  if (!HALLOWEEN_OUVERT) return false;
  try {
    const p = new URLSearchParams(location.search).get('halloween');
    if (p === '0' || p === 'off') return false;
  } catch {
    // Pas d'URL exploitable : on s'en tient a la porte.
  }
  return true;
}
