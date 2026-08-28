import React, { useEffect, useState } from 'react';
import { monEdition } from '@/game/championnats';
import { getSavedName } from '@/game/leaderboard';
import { Championnat } from './Championnat';

/**
 * Le championnat, s'il y en a un.
 *
 * Rien n'est affiche a qui n'y participe pas : un championnat auquel on n'est
 * pas engage n'est pas une fonctionnalite, c'est du bruit sur l'accueil. On
 * cherche par le nom du joueur, comme partout ailleurs dans le jeu.
 */
export function ChampPanel() {
  const [edition, setEdition] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const nom = getSavedName();
    if (!nom) return;
    monEdition(nom).then(r => { if (vivant && r?.edition) setEdition(r.edition); });
    return () => { vivant = false; };
  }, []);

  if (!edition) return null;
  return <Championnat edition={edition} />;
}
