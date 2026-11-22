import React, { useEffect, useRef } from 'react';
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
/**
 * LE LIEN D'INVITATION A UN SALON, `?relais=CODE` (envoye depuis la salle
 * d'attente, CourseRelais). Lu une fois au chargement, retire de l'adresse,
 * et le jeu entre dans le salon a la place retenue (la premiere libre si elle
 * est prise).
 */
function salonDuLien(): string {
  try {
    const url = new URL(window.location.href);
    const c = (url.searchParams.get('relais') || '').toUpperCase();
    if (!c) return '';
    url.searchParams.delete('relais');
    window.history.replaceState(window.history.state, '', url.toString());
    return /^[A-Z0-9]{4,10}$/.test(c) ? c : '';
  } catch { return ''; }
}

function placeRetenue(): number {
  try {
    const v = Number(localStorage.getItem('sprinter.relais.solo.rang'));
    return v >= 1 && v <= 4 ? v : 1;
  } catch { return 1; }
}

export function PisteRelais() {
  const quoi = usePiste();
  useEffect(() => {
    const code = salonDuLien();
    if (code) entrerSurLaPiste({ genre: 'relais_salon', code, rang: placeRetenue() });
  }, []);
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
    // Le moteur a pu revenir a l'accueil sans nous (pause, invitation…) : il
    // y est deja, mais toujours sur le 4 x 100, qu'il faut lui retirer.
    if (G.raceKey === '4x100') {
      if (G.state !== 'title') SprinterApp.goHome();
      const k = avant.current && avant.current !== '4x100'
        && SprinterApp.RACES[avant.current] ? avant.current : '100';
      G.raceKey = k;
      G.race = SprinterApp.RACES[k];
      SprinterApp.buildLevel(0);
    }
    entrerSurLaPiste(null);
  };

  if (quoi.genre === 'relais_solo') {
    // Recourir : on sort de la piste comme pour CONTINUER — le moteur revient a
    // l'accueil — puis on y rentre aussitot, a la meme place, avec une salle
    // neuve et trois nouveaux coequipiers.
    const solo = quoi;
    const rejouer = () => {
      sortir();
      setTimeout(() => entrerSurLaPiste({ ...solo }), 0);
    };
    return <CourseRelais equipe={solo.equipe} solo={{ rang: solo.rang }}
                         onQuitter={sortir} onRejouer={rejouer} />;
  }
  if (quoi.genre === 'relais_salon') {
    // Recourir au salon : on en sort et on y rentre, a la meme place si elle
    // est encore libre. Les autres joueurs restent dans le meme salon.
    const sal = quoi;
    // A la place qu'on tenait a l'arrivee, pas a celle demandee en entrant :
    // on a pu en changer dans la salle d'attente.
    const rejouer = (rang: number) => {
      sortir();
      setTimeout(() => entrerSurLaPiste({ ...sal, rang }), 0);
    };
    return <CourseRelais equipe={sal.code} salon={{ rang: sal.rang }}
                         onQuitter={sortir} onRejouer={rejouer} />;
  }
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
