import React, { useEffect, useState } from 'react';
import { monEdition } from '@/game/championnats';
import { getSavedName } from '@/game/leaderboard';
import { Championnat } from './Championnat';

/**
 * Le championnat, s'il y en a un.
 *
 * Rien n'est affiche a qui n'y participe pas : un championnat auquel on n'est
 * pas engage n'est pas une facon de jouer, c'est un onglet de plus a lire. On
 * cherche par le nom du joueur, comme partout ailleurs dans le jeu.
 *
 * La reponse remonte aussi a l'ecran qui nous contient, par `onEdition` : c'est
 * lui qui tient la rangee des onglets, et il ne peut pas y poser CHAMPIONNAT
 * avant de savoir s'il y a quelque chose dessous. La question se pose ici et
 * nulle part ailleurs — la deplacer dans un crochet appele depuis l'accueil
 * paraissait plus simple, mais un crochet ne se met pas derriere un `if` : le
 * bundler ne pouvait plus suivre, et tout le championnat repartait dans le
 * build public alors qu'il y est ferme.
 */
export function ChampPanel({ onEdition }: { onEdition?: (e: string | null) => void }) {
  const [edition, setEdition] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const nom = getSavedName();
    if (!nom) return;
    monEdition(nom).then(r => {
      if (!vivant) return;
      setEdition(r?.edition || null);
      onEdition?.(r?.edition || null);
    });
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!edition) return null;
  return <Championnat edition={edition} />;
}
