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

import { DEPARTAGE, FORMAT, FORMAT_REDUIT_MIN } from './championnats-config.js';

/** Le nombre de couloirs d'une piste : le format nominal en fixe la mesure. */
const COULOIRS = FORMAT.phases[0].parCourse;

/**
 * Une manche amont : combien de courses, et par ou l'on passe.
 *
 * Les deux portes gardent la proportion du format nominal — un direct pour
 * quatre partants, le reste repeche au chrono. Le plafond n'est pas decoratif :
 * au-dela, le nombre de repeches deviendrait negatif, c'est-a-dire que les
 * qualifies directs sortiraient a eux seuls plus de monde que la phase suivante
 * n'en accueille.
 *
 * Quand l'effectif entrant est deja celui de la sortie, la manche ne qualifie
 * rien : tout le monde passe, et l'annoncer comme un repechage serait fabriquer
 * un suspense qui n'existe pas. C'est la « manche de forme ».
 */
function manche(modele, entrants, sortie) {
  const courses = Math.ceil(entrants / COULOIRS);
  const parCourse = Math.ceil(entrants / courses);
  const plafond = Math.floor(sortie / courses);
  const directsParCourse = entrants === sortie
    ? plafond
    : Math.min(plafond, Math.max(1, Math.floor(Math.round(entrants / 4) / courses)));
  return {
    ...modele,
    courses, parCourse, directsParCourse,
    repechages: sortie - directsParCourse * courses,
  };
}

/**
 * Le format d'une edition dont l'effectif n'est pas celui du format nominal.
 *
 * Trois phases, toujours, et jamais moins : c'est la structure qui fait qu'un
 * championnat a douze joueurs reste un championnat — des series, un repechage
 * revele apres la derniere, des demies, une finale. Un format a deux phases
 * serait un tournoi, pas un championnat, et le premier titre du jeu ne peut pas
 * se gagner sur une autre forme que ceux qui suivront.
 *
 * La finale tient dans une piste : huit au plus, moins s'il n'y a pas huit
 * personnes. Chaque phase amont vise a peu pres la moitie de son effectif
 * entrant, ce qui donne l'allure du format nominal (32 -> 16 -> 8) quel que
 * soit le nombre de partants.
 */
export function formatDynamique(n) {
  const partants = Math.max(FORMAT_REDUIT_MIN,
                            Math.min(FORMAT.partants, Math.round(Number(n) || 0)));
  const finale = Math.min(COULOIRS, partants);
  const milieu = Math.max(finale, Math.min(partants, Math.round(partants / 2)));
  const [mSeries, mDemies, mFinale] = FORMAT.phases;
  return {
    partants,
    phases: [
      manche(mSeries, partants, milieu),
      manche(mDemies, milieu, finale),
      {
        ...mFinale,
        courses: 1, parCourse: finale,
        directsParCourse: 0, repechages: 0,
        podium: Math.min(mFinale.podium, finale),
      },
    ],
  };
}

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
 *
 * `format` decide des creneaux qui existent vraiment. Le calendrier est ecrit
 * pour trente-deux partants, donc pour quatre series ; une edition qui n'en
 * court que deux ne doit pas afficher un rendez-vous a quinze heures trente
 * pour une course qui n'aura pas lieu.
 */
export function calendrier(debutSamedi, config, format = FORMAT) {
  const JOUR = 24 * 60 * 60 * 1000;
  const rendez = [];
  for (const [i, jour] of [[0, config.jour1], [1, config.jour2]]) {
    for (const e of jour) {
      const phase = format.phases.find(p => p.cle === e.phase);
      if (!phase) continue;
      if (e.course != null && e.course > phase.courses) continue;
      rendez.push({ ...e, at: debutSamedi + i * JOUR + e.minute * 60 * 1000 });
    }
  }
  return rendez.sort((a, b) => a.at - b.at);
}

/** Le prochain rendez-vous d'une edition, a partir d'un instant donne. */
export function prochain(rendezVous, maintenant) {
  return rendezVous.find(r => r.at > maintenant) || null;
}
