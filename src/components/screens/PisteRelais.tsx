import React from 'react';
import { usePiste, entrerSurLaPiste } from '@/game/piste';
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
  if (!quoi) return null;
  const sortir = () => entrerSurLaPiste(null);

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
