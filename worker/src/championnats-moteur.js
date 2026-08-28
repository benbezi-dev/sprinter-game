/* ---------------------------------------------------------------------------
   CHAMPIONNATS — le moteur de qualification
   ---------------------------------------------------------------------------
   Deux operations, et rien d'autre. Repartir des joueurs en courses, puis
   decider qui passe. Elles sont ici seules, sans base de donnees ni reseau,
   parce que ce sont les seules regles du systeme dont une erreur ne se verrait
   pas : un bracket mal seme ou un repechage mal compte produit une competition
   qui a l'air normale et qui est injuste.

   Tout est pur : memes entrees, memes sorties, testable sans rien monter.
--------------------------------------------------------------------------- */

import { DEPARTAGE } from './championnats-config.js';

/**
 * Repartition en serpentin.
 *
 * Distribuer 1-8 dans la course A, 9-16 dans la B, etc. donnerait une course de
 * favoris et une course de outsiders : le huitieme meilleur joueur du pays
 * serait elimine par le premier, pendant qu'un vingt-cinquieme passerait en se
 * promenant. Le serpentin fait l'inverse — il descend puis remonte, si bien
 * que chaque course recoit une tranche de chaque niveau.
 *
 *   course A : 1,  8,  9, 16, 17, 24, 25, 32
 *   course B : 2,  7, 10, 15, 18, 23, 26, 31
 *
 * La somme des rangs est alors quasiment identique d'une course a l'autre,
 * ce qui est la definition operatoire de « a parite de niveau ».
 */
export function serpentin(joueurs, nCourses) {
  const courses = Array.from({ length: nCourses }, () => []);
  joueurs.forEach((j, i) => {
    const tour = Math.floor(i / nCourses);
    const pos = i % nCourses;
    // Un tour sur deux se remplit a l'envers : c'est tout le serpentin.
    courses[tour % 2 === 0 ? pos : nCourses - 1 - pos].push(j);
  });
  return courses;
}

/** Vrai si le serpentin a bien equilibre : ecart max entre sommes de rangs. */
export function desequilibre(courses) {
  const sommes = courses.map(c => c.reduce((s, j) => s + (j.rang || 0), 0));
  return Math.max(...sommes) - Math.min(...sommes);
}

/**
 * Ordonne des resultats du meilleur au moins bon.
 *
 * Un abandon n'a pas de chrono : il passe apres tout le monde, quoi qu'il
 * arrive. Le reste se classe au chrono, puis par les departages declares en
 * configuration — sans quoi deux chronos identiques seraient departages par
 * l'ordre d'insertion en base, c'est-a-dire par hasard, et sans le dire.
 */
export function ordonner(resultats) {
  return [...resultats].sort((a, b) => {
    const ta = a.ms == null ? Infinity : a.ms;
    const tb = b.ms == null ? Infinity : b.ms;
    if (ta !== tb) return ta - tb;
    for (const critere of DEPARTAGE) {
      if (critere === 'chrono_precedent') {
        const pa = a.msPrecedent == null ? Infinity : a.msPrecedent;
        const pb = b.msPrecedent == null ? Infinity : b.msPrecedent;
        if (pa !== pb) return pa - pb;
      } else if (critere === 'rang_duel') {
        const ra = a.rang == null ? Infinity : a.rang;
        const rb = b.rang == null ? Infinity : b.rang;
        if (ra !== rb) return ra - rb;
      } else if (critere === 'cle') {
        if (a.cle !== b.cle) return a.cle < b.cle ? -1 : 1;
      }
    }
    return 0;
  });
}

/**
 * Qui passe a la phase suivante.
 *
 * Deux portes, et l'ordre compte. On prend d'abord les premiers de chaque
 * course — c'est la porte qu'on gagne en course, la seule que le public voit
 * se franchir en direct. Puis on repeche au chrono parmi TOUS les autres,
 * toutes courses confondues : c'est la porte qui recompense un bon chrono
 * couru dans une course rapide, et c'est elle qui reste a reveler apres la
 * derniere course.
 *
 * `courses` est un tableau de tableaux de resultats bruts.
 * Renvoie { directs, repeches, elimines, ordreParCourse }.
 */
export function qualifier(courses, { directsParCourse, repechages }) {
  const ordreParCourse = courses.map(ordonner);

  const directs = [];
  const restants = [];
  ordreParCourse.forEach((ordre, iCourse) => {
    ordre.forEach((r, pos) => {
      const enrichi = { ...r, course: iCourse + 1, place: pos + 1 };
      if (pos < directsParCourse) directs.push(enrichi);
      else restants.push(enrichi);
    });
  });

  // Le repechage ne regarde que le chrono, jamais la place dans sa course :
  // un troisieme d'une serie rapide doit pouvoir passer devant un deuxieme
  // d'une serie lente. C'est tout l'objet d'un repechage au temps.
  //
  // Un abandon ne se repeche pas : sans chrono, il n'y a rien a comparer.
  const classables = restants.filter(r => r.ms != null);
  const ordreRepechage = ordonner(classables);
  const repeches = ordreRepechage.slice(0, repechages);
  const prisDansRepechage = new Set(repeches.map(r => r.cle));
  const elimines = restants.filter(r => !prisDansRepechage.has(r.cle));

  return { directs, repeches, elimines, ordreParCourse };
}

/**
 * Le classement final d'une finale : c'est le chrono de cette course, et rien
 * d'autre. Ni le parcours, ni les demies — une finale efface ce qui precede.
 */
export function podium(resultatsFinale, taille = 3) {
  const ordre = ordonner(resultatsFinale);
  return {
    classement: ordre.map((r, i) => ({ ...r, place: i + 1 })),
    podium: ordre.slice(0, taille).map((r, i) => ({ ...r, place: i + 1 })),
    champion: ordre[0] && ordre[0].ms != null ? ordre[0] : null,
  };
}

/**
 * Le calendrier d'une edition, en dates absolues.
 *
 * `debutSamedi` est un instant UTC : le samedi a minuit. Tout le reste s'en
 * deduit, ce qui garantit que deux pays qui courent « le meme weekend »
 * courent bien a la meme seconde, quelle que soit l'heure qu'il est chez eux.
 */
export function calendrier(debutSamedi, config) {
  const JOUR = 24 * 60 * 60 * 1000;
  const rendez = [];
  for (const [i, jour] of [[0, config.jour1], [1, config.jour2]]) {
    for (const e of jour) {
      rendez.push({ ...e, at: debutSamedi + i * JOUR + e.minute * 60 * 1000 });
    }
  }
  return rendez.sort((a, b) => a.at - b.at);
}

/** Le prochain rendez-vous d'une edition, a partir d'un instant donne. */
export function prochain(rendezVous, maintenant) {
  return rendezVous.find(r => r.at > maintenant) || null;
}
