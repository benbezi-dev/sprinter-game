import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { useFete } from '@/game/fete';
import { Confettis } from './Confettis';
import { Feux } from './Feux';
import { defiPerdu } from '@/game/vedettes';
import { LEGENDE_OUVERTE } from '@/game/canal';
import { etapeLegendePerdue } from '@/game/legende/etat';

/**
 * LE CALQUE DE LA FETE, MONTE UNE FOIS POUR TOUT LE JEU.
 *
 * Les confettis vivaient dans l'ecran de fin du one shot, ou ils etaient nes.
 * Ils n'y tombaient donc que la : une carriere entiere pouvait battre six
 * records personnels sans qu'un seul papier ne vole, et l'ecran de defaite
 * — ou l'on bat pourtant son chrono une fois sur deux — n'avait jamais rien
 * a feter. Poses ici, au-dessus de tous les ecrans de fin, ils tombent la ou
 * le record est tombe, quel que soit le mode qui l'a produit.
 *
 * MONTE UNE FOIS, ET UNE SEULE. C'est la raison d'etre de ce calque : trois
 * endroits decident d'une fete (voir fete.ts), et deux pluies de confettis
 * superposees ne font pas une plus belle fete, elles font deux fois le meme
 * travail sur la meme image.
 *
 * APRES LA COURSE, PAS PENDANT. La cinematique n'en fait pas partie : on ne
 * fete pas un chrono par-dessus la scenette qui raconte la course. L'ecran de
 * resultat arrive une seconde plus tard, et c'est la qu'on lit le nombre.
 *
 * ET PAS DE CONFETTIS SUR UNE DEFAITE (consigne de Benbezi, 29 septembre
 * 2026). Battre son chrono en se faisant eliminer, ou en perdant le defi d'une
 * vedette, reste un record — l'ecran le dit — mais une pluie de papier sous
 * « IL T'A BATTU » se lit comme une erreur. Les feux d'artifice d'un record du
 * monde, eux, ne sont pas concernes.
 */

/** Ecrans qui suivent une course, la cinematique exclue — comme RecordPopup. */
const APRES_COURSE = new Set(['result', 'winall', 'over']);

export function FeteRecords() {
  const state = useGameStore(s => s.state);
  const player = useGameStore(s => s.player);
  const fete = useFete();

  if (!APRES_COURSE.has(state)) return null;
  // Une defaite : l'elimination de la carriere (`over`), ou un defi de vedette
  // perdu, qui finit sur l'ecran de fin du one shot (`winall`) — comme une
  // etape perdue de la Legende (canal de test).
  const defaite = state === 'over' || (state === 'winall' && defiPerdu())
    || (LEGENDE_OUVERTE && state === 'winall' && etapeLegendePerdue(SprinterApp.G));

  // Le jeton est le coureur : une fete gagnee a la course d'avant ne se
  // rejoue pas sur celle-ci, sans qu'il ait fallu l'effacer nulle part. Le
  // `!!player` n'est pas une precaution de style : sans coureur, les deux
  // cotes valent null et l'egalite serait vraie — il pleuvrait sur un ecran
  // qui n'a rien fete du tout.
  return (
    <>
      {!!player && fete.perso === player && !defaite && <Confettis />}
      {!!player && fete.monde === player && <Feux />}
    </>
  );
}
