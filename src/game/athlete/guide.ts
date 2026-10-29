// LE GUIDE DU MOMENT — ce qu'il faut faire maintenant, et la journee cochee.
//
// L'auteur, 25/10 : « le jeu n'a pas vraiment de sens, lorsqu'une tache est
// effectuee elle reste verte, on ne sait pas ce qu'il doit etre fait, on est
// facilement perdu ». Les Sims montrent toujours le besoin le plus pressant et
// la prochaine chose a faire : ici, UN conseil a la fois (le plus urgent), avec
// le lieu ou aller, et la journee en trois ou quatre lignes cochees.

import {
  type Athlete, type Jour, besoinsDe, heureDe, jourDe, etape, JOUR_DE,
  exerciceDuJour, lieuDeLExercice, DIMANCHE,
} from './regles';

export type Texte = [string, string];
export type Conseil = { titre: Texte; pourquoi: Texte; lieu: string | null; urgent?: boolean };

const JOURS = Object.keys(JOUR_DE) as Jour[];
/** La seance d'aujourd'hui, si c'en est un jour : son jour du programme, son lieu. */
export function seanceDuJourDe(a: Athlete): { j: Jour; lieu: string; faite: boolean } | null {
  const j = JOURS.find(x => JOUR_DE[x] === jourDe(a));
  if (!j) return null;
  return { j, lieu: lieuDeLExercice(a, exerciceDuJour(a, j)), faite: a.faites.includes(j) };
}
export const heureSeance = (j: Jour): [number, number] => (j === 'samedi' ? [9 * 60, 19 * 60] : [16 * 60 + 30, 21 * 60]);
const ecoleDe = (a: Athlete): { lieu: string; nom: Texte } | null => {
  const e = etape(a);
  return e === 'college' ? { lieu: 'college', nom: ['Aller en cours', 'Go to school'] }
    : e === 'lycee' ? { lieu: 'lycee', nom: ['Aller au lycée', 'Go to school'] }
    : { lieu: 'travail', nom: ['Aller au travail', 'Go to work'] };
};

/** Le conseil du moment : le plus urgent d'abord. `competition` : c'est le jour J. */
export function conseil(a: Athlete, competition: boolean): Conseil {
  const b = besoinsDe(a), h = heureDe(a), semaine = jourDe(a) < 5;
  const chezSoi = 'maison';
  if (a.blessure > 0 && !a.diagnostic) return { titre: ['Va voir le médecin du sport', 'See the sports doctor'], pourquoi: ['Tu es blessé·e et sans diagnostic : l’arrêt s’allonge.', 'You’re injured with no diagnosis: time out grows.'], lieu: 'kine', urgent: true };
  if (b.energie < 15) return { titre: ['Rentre dormir', 'Go home and sleep'], pourquoi: ['Plus d’énergie : tu vas t’effondrer.', 'Out of energy: you’re about to collapse.'], lieu: chezSoi, urgent: true };
  if (b.faim < 20) return { titre: ['Mange quelque chose', 'Eat something'], pourquoi: ['Le ventre vide, la séance ne vaut rien.', 'On an empty stomach, training is worthless.'], lieu: chezSoi, urgent: true };
  if (competition && h < 18 * 60) return { titre: ['Jour de compétition : va à la gare', 'Race day: go to the station'], pourquoi: ['Échauffe-toi là-bas, puis cours.', 'Warm up there, then race.'], lieu: 'gare', urgent: true };
  const ecole = ecoleDe(a);
  if (semaine && ecole && !a.cours && h < 9 * 60) return { titre: ecole.nom, pourquoi: ['Ça commence à 9 h. Absent·e, tu le paies.', 'It starts at 9. Miss it and you pay for it.'], lieu: ecole.lieu };
  const s = seanceDuJourDe(a);
  if (s && !s.faite && a.blessure === 0) {
    const [d, f] = heureSeance(s.j);
    if (h >= d - 60 && h <= f) return { titre: ['Va à l’entraînement', 'Go to training'], pourquoi: h < d ? ['La séance commence bientôt.', 'Training starts soon.'] : ['C’est l’heure de la séance.', 'It’s training time.'], lieu: s.lieu };
  }
  if (b.hygiene < 25) return { titre: ['Prends une douche', 'Take a shower'], pourquoi: ['Les autres le remarquent.', 'Other people notice.'], lieu: chezSoi };
  if (h >= 22 * 60 || h < 5 * 60) return { titre: ['Rentre te coucher', 'Go home to bed'], pourquoi: ['Moins de 7 h de sommeil, et le corps récupère mal.', 'Under 7 hours of sleep, the body recovers poorly.'], lieu: chezSoi };
  if (b.faim < 45 && (h >= 11.5 * 60 && h <= 14 * 60 || h >= 18.5 * 60)) return { titre: ['C’est l’heure du repas', 'It’s mealtime'], pourquoi: ['Recharge avant la suite.', 'Refuel before what’s next.'], lieu: chezSoi };
  if (b.social < 30) return { titre: ['Va voir du monde', 'Go and see people'], pourquoi: ['Inès traîne souvent au parc.', 'Inès often hangs out at the park.'], lieu: 'parc' };
  if (s && !s.faite && a.blessure === 0 && h < heureSeance(s.j)[0]) return { titre: ['Temps libre avant la séance', 'Free time before training'], pourquoi: [`Séance à ${s.j === 'samedi' ? '9 h' : '16 h 30'}. Repose-toi ou vois tes amis.`, `Training at ${s.j === 'samedi' ? '9 am' : '4:30 pm'}. Rest or see friends.`], lieu: null };
  if (jourDe(a) === DIMANCHE) return { titre: ['Dimanche : récupère ou cours un meeting', 'Sunday: recover or run a meet'], pourquoi: ['Les meetings partent de la gare.', 'Meets leave from the station.'], lieu: 'gare' };
  return { titre: ['Temps libre', 'Free time'], pourquoi: ['Footing au parc, kiné, petit boulot : à toi de voir.', 'Park jog, physio, a side job: up to you.'], lieu: null };
}

/** La journee en quelques lignes : ce qui compte aujourd'hui, coche quand c'est fait. */
export function journee(a: Athlete, competition: boolean): { texte: Texte; fait: boolean }[] {
  const out: { texte: Texte; fait: boolean }[] = [];
  const ecole = ecoleDe(a);
  if (jourDe(a) < 5 && ecole) out.push({ texte: ecole.nom, fait: !!a.cours });
  const s = seanceDuJourDe(a);
  if (s) out.push({ texte: ['Séance d’entraînement', 'Training session'], fait: s.faite });
  if (competition) out.push({ texte: ['Compétition', 'Race'], fait: false });
  const fait = new Set(a.faitAujourdhui || []);
  out.push({ texte: ['Manger', 'Eat'], fait: fait.has('manger') || fait.has('manger_parents') || fait.has('pizza') });
  out.push({ texte: ['Douche', 'Shower'], fait: fait.has('douche') });
  return out;
}
