import React, { useRef } from 'react';
import { usePiste, entrerSurLaPiste } from '@/game/piste';
import { SprinterApp } from '@/game/engine';
import { CourseRelais } from './CourseRelais';
import { CourseConfrontation } from './CourseConfrontation';

/**
 * Ce qui court, par-dessus tout le reste.
 *
 * Monte a la racine de l'application, et non dans l'onglet du vestiaire. La
 * raison est structurelle : l'ecran-titre disparait au coup de pistolet, et
 * avec lui tout ce qu'il contient. Une course posee dans cet onglet perdrait sa
 * salle au moment precis ou elle commence.
 */
export function PisteRelais() {
  const quoi = usePiste();
  // La distance de l'accueil au moment d'entrer sur la piste : le relais la
  // remplace par « 4x100 » au pistolet, et l'accueil la reprendrait telle
  // quelle — « 4 X 100 METRES — SIX ETAPES », sans parcours a montrer.
  const avant = useRef<string | null>(null);
  if (!quoi) { avant.current = null; return null; }
  if (avant.current == null) avant.current = SprinterApp.G.raceKey;

  // Sortir de la piste, c'est aussi sortir de la course. Fermer la salle ne
  // suffisait pas : le moteur restait en 'race' sur le 4 x 100, et le joueur
  // qui touchait CONTINUER a l'arrivee — ou apres une elimination — se
  // retrouvait plante sur la piste, sans accueil. Avant le pistolet, le
  // moteur est encore a l'accueil et il n'y a rien a ramener.
  const sortir = () => {
    const G = SprinterApp.G;
    if (G.liveOn && G.raceKey === '4x100') {
      SprinterApp.goHome();
      const k = avant.current && avant.current !== '4x100'
        && SprinterApp.RACES[avant.current] ? avant.current : '100';
      G.raceKey = k;
      G.race = SprinterApp.RACES[k];
      SprinterApp.buildLevel(0);
    }
    entrerSurLaPiste(null);
  };

  if (quoi.genre === 'relais') {
    return <CourseRelais equipe={quoi.equipe} onQuitter={sortir} />;
  }
  return (
    <CourseConfrontation
      code={quoi.code} equipe={quoi.equipe}
      max={quoi.max} fantomes={quoi.fantomes}
      onQuitter={sortir}
    />
  );
}
