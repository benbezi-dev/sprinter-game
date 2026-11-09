import React, { useEffect, useState } from 'react';
import { monEdition } from '@/game/championnats';
import { getSavedName } from '@/game/leaderboard';
import { Championnat } from './Championnat';
import { DefiDemieSpectateur } from './DefiDemie';

/**
 * Le championnat, s'il y en a un.
 *
 * Rien n'est affiche a qui n'y participe pas : un championnat auquel on n'est
 * pas engage n'est pas une fonctionnalite, c'est du bruit sur l'accueil. On
 * cherche par le nom du joueur, comme partout ailleurs dans le jeu.
 *
 * UNE EXCEPTION, LE DEFI DE LA DEMI (27/09). Entre les deux demi-finales, qui
 * n'est pas engage a quelque chose a jouer : courir la demi-finale 1 contre ses
 * vrais chronos. Il ne voit que cette carte, et seulement a ce moment-la.
 */
export function ChampPanel() {
  const [editions, setEditions] = useState<string[]>([]);
  const [dehors, setDehors] = useState(false);

  useEffect(() => {
    let vivant = true;
    const nom = getSavedName();
    if (!nom) { setDehors(true); return; }
    monEdition(nom).then(r => {
      if (!vivant) return;
      const ids = r?.editions?.length ? r.editions : r?.edition ? [r.edition] : [];
      if (ids.length) setEditions(ids);
      else if (r) setDehors(true);
    });
    return () => { vivant = false; };
  }, []);

  // Deux championnats le meme weekend (duel des epreuves a egalite) : un panneau chacun.
  if (editions.length) return <>{editions.map(id => <Championnat key={id} edition={id} />)}</>;
  if (dehors) return <DefiDemieSpectateur />;
  return null;
}
