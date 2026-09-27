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

import { DEPARTAGE, TENANT } from './championnats-config.js';

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
 * Trois portes, et l'ordre compte. On prend d'abord les premiers de chaque
 * course — c'est la porte qu'on gagne en course, la seule que le public voit
 * se franchir en direct. Puis on repeche au chrono parmi TOUS les autres,
 * toutes courses confondues : c'est la porte qui recompense un bon chrono
 * couru dans une course rapide, et c'est elle qui reste a reveler apres la
 * derniere course.
 *
 * LA TROISIEME PORTE EST CELLE DU TENANT DU TITRE, et elle ne s'ouvre que pour
 * lui. `dOffice` est l'ensemble des cles qui passent quoi qu'il arrive : le
 * champion en titre de cette edition-la, verse en finale par son titre
 * (`TENANT.finaleDOffice`). Il court quand meme, ses chronos comptent pour le
 * classement de sa course, mais aucun resultat ne l'elimine — pas meme un
 * abandon, qui le laisserait sinon sans chrono a comparer.
 *
 * Ce que ce passe-droit coute est pris au repechage, et seulement quand il
 * coute quelque chose : un tenant qui se qualifie au merite — premier de sa
 * course, ou meilleur chrono des repeches — ne prend la place de personne, et
 * le repechage garde ses quatre places. C'est la distinction que la version
 * naive de cette regle rate : retirer une place de repechage a chaque fois
 * qu'un tenant est engage punirait tout le monde pour un privilege qui n'a pas
 * servi.
 *
 * `courses` est un tableau de tableaux de resultats bruts.
 * `dOffice` est un Set de cles, ou null.
 * Renvoie { directs, repeches, elimines, ordreParCourse }.
 */
export function qualifier(courses, { directsParCourse, repechages }, dOffice = null) {
  const ordreParCourse = courses.map(ordonner);

  const directs = [];
  const restants = [];
  // PAS DE CHRONO, PAS DE PORTE. Une place directe se gagne en franchissant
  // la ligne : tant que les courses se remplissaient au harnais, chacun avait
  // un chrono et la question ne se posait pas. Courues en direct, une serie
  // peut compter moins d'arrivants que de places directes — forfaits, cartons
  // rouges — et la place prise par le rang aurait qualifie un disqualifie.
  // La place non gagnee reste vide : elle n'est pas donnee au repechage, qui
  // garde son nombre.
  ordreParCourse.forEach((ordre, iCourse) => {
    ordre.forEach((r, pos) => {
      const enrichi = { ...r, course: iCourse + 1, place: pos + 1 };
      if (pos < directsParCourse && r.ms != null) directs.push(enrichi);
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

  // Le repechage au merite, tel qu'il a toujours ete. On le calcule AVANT de
  // regarder les titres : c'est lui qui dit si le passe-droit du tenant sert a
  // quelque chose ou s'il se serait qualifie tout seul.
  const auMerite = ordreRepechage.slice(0, repechages);
  const dejaPris = new Set(auMerite.map(r => r.cle));

  // Les tenants qui ne passaient pas, et qui passent quand meme. Ils sont zero
  // ou un dans les faits — une edition n'a qu'un tenant — mais rien ici ne
  // suppose ce nombre : le compte des places cedees se derive de la liste.
  const versesDOffice = dOffice
    ? restants.filter(r => dOffice.has(r.cle) && !dejaPris.has(r.cle))
    : [];

  const places = Math.max(0, repechages - versesDOffice.length * TENANT.repechagesCedes);
  const repeches = [
    // Le tenant ouvre la liste. L'ordre est celui de la revelation, et un
    // passe-droit annonce apres les chronos ressemblerait a un rattrapage
    // decide sur le moment.
    ...versesDOffice.map(r => ({ ...r, doffice: true })),
    ...ordreRepechage.slice(0, places),
  ];
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
