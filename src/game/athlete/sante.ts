// LA SANTE DE L'ATHLETE — le medecin du sport, l'imagerie, l'osteopathe.
//
// L'auteur, 25/10 : « osteopathe, IRM, radiographie, medecin du sport etc. ».
// Le corps (regles.ts, « le corps ») blesse ; ce fichier soigne :
// - SANS DIAGNOSTIC on ne connait qu'une douleur, et l'arret s'allonge d'une
//   semaine (on reprend trop tot, on retarde) ;
// - le MEDECIN DU SPORT nomme la blessure et prescrit l'examen qui va avec ;
//   il delivre aussi le certificat medical, exige des adultes pour courir ;
// - la RADIOGRAPHIE (cheville, tibia) ecarte ou trouve une fracture de fatigue ;
//   l'IRM (ischios, Achille) donne le grade de la lesion, donc la vraie duree ;
//   l'imagerie est a la clinique de Louviers : une demi-journee en bus ;
// - avec le bon examen, la reeducation est adaptee : une semaine de moins ;
// - l'OSTEOPATHE soulage une gene et la fatigue, une fois par semaine.
//
// Les sommes sont des montants de jeu, pas des tarifs reels. Qui paie : les
// parents d'une famille aisee prennent tout en charge pour un mineur ; un
// mineur de famille modeste paie une petite part ; un adulte paie le reste a
// charge.

import { type Athlete, type TypeBlessure, BLESSURES, SAISON, avancer, payer, noter, etape, soulager } from './regles';

export type Texte = [string, string];
export type Soin = 'medecin' | 'radio' | 'irm' | 'osteo';

/** Ce qu'on ressent avant de savoir ce qu'on a. */
export const SYMPTOMES: Record<TypeBlessure, Texte> = {
  ischio: ['Douleur vive à l’arrière de la cuisse', 'Sharp pain at the back of the thigh'],
  periostite: ['Douleur le long du tibia', 'Pain along the shin'],
  achille: ['Douleur au-dessus du talon', 'Pain above the heel'],
  cheville: ['Cheville gonflée', 'Swollen ankle'],
  surmenage: ['Épuisement, jambes lourdes', 'Exhaustion, heavy legs'],
};

/** L'examen qui va avec chaque blessure. */
export const EXAMEN: Record<TypeBlessure, 'radio' | 'irm' | null> = { ischio: 'irm', achille: 'irm', cheville: 'radio', periostite: 'radio', surmenage: null };

const PRIX: Record<Soin, number> = { medecin: 50, radio: 45, irm: 120, osteo: 55 };
/** Ce que l'athlete paie lui-meme, selon qui le prend en charge. */
export function resteACharge(a: Athlete, s: Soin): number {
  const mineur = etape(a) !== 'adulte';
  if (mineur && a.origine === 'aisee') return 0;
  // l'osteopathe n'est pas rembourse ; le reste l'est en grande partie
  const part = s === 'osteo' ? 1 : mineur ? 0.15 : 0.35;
  return Math.round(PRIX[s] * part);
}

export const saisonDe = (a: Athlete) => Math.floor((a.semaine - 1) / SAISON);
/** Un adulte doit avoir son certificat medical de la saison pour courir. */
export const certificatRequis = (a: Athlete) => etape(a) === 'adulte' && a.certificat !== saisonDe(a);

/** Ce que l'athlete sait de son etat : rien, une douleur, ou la blessure nommee. */
export function etatDeSante(a: Athlete): { titre: Texte; detail: Texte | null; grave: boolean } | null {
  if (a.blessure > 0 && a.blessureType) {
    const d = a.diagnostic;
    if (!d) return { titre: SYMPTOMES[a.blessureType], detail: ['Pas encore de diagnostic : va voir le médecin du sport.', 'No diagnosis yet: see the sports doctor.'], grave: true };
    const nom = d.fracture ? ['Fracture de fatigue du tibia', 'Tibial stress fracture'] as Texte : BLESSURES[a.blessureType].nom;
    const grade = d.grade ? ` · grade ${d.grade}` : '';
    return { titre: [nom[0] + grade, nom[1] + grade], detail: [`Encore ${a.blessure} semaine${a.blessure > 1 ? 's' : ''} d’arrêt.`, `${a.blessure} more week${a.blessure > 1 ? 's' : ''} out.`], grave: true };
  }
  if (a.gene) return { titre: ['Une gêne', 'A niggle'], detail: BLESSURES[a.gene].gene, grave: false };
  return null;
}

/** Peut-on recevoir ce soin maintenant ? Rend la raison sinon. */
export function soinPossible(a: Athlete, s: Soin): Texte | null {
  if (a.argent < resteACharge(a, s)) return ['Pas assez d’argent', 'Not enough money'];
  if (s === 'osteo' && a.osteo) return ['Déjà vu cette semaine', 'Already seen this week'];
  if (s === 'radio' || s === 'irm') {
    const d = a.diagnostic;
    if (!d || !a.blessureType || EXAMEN[a.blessureType] !== s) return ['Sur prescription du médecin', 'Needs a doctor’s prescription'];
    if (d.examen) return ['Déjà fait', 'Already done'];
  }
  return null;
}

/**
 * Recevoir un soin : payer sa part, prendre le temps, et ce que le soin
 * apprend ou change. Rend ce que dit le soignant.
 */
export function soigner(a: Athlete, s: Soin): { texte: Texte } | { refus: Texte } {
  const refus = soinPossible(a, s); if (refus) return { refus };
  const cout = resteACharge(a, s);
  const NOMS: Record<Soin, Texte> = { medecin: ['Médecin du sport', 'Sports doctor'], radio: ['Radiographie', 'X-ray'], irm: ['IRM', 'MRI'], osteo: ['Ostéopathe', 'Osteopath'] };
  payer(a, -cout, NOMS[s][0], NOMS[s][1]);

  if (s === 'medecin') {
    avancer(a, 40);
    // le certificat de la saison, au passage
    a.certificat = saisonDe(a);
    if (a.blessure > 0 && a.blessureType) {
      a.diagnostic = { type: a.blessureType };
      const ex = EXAMEN[a.blessureType], nom = BLESSURES[a.blessureType].nom;
      noter(a, `Médecin du sport : ${nom[0].toLowerCase()}.`, `Sports doctor: ${nom[1].toLowerCase()}.`);
      if (ex === 'irm') return { texte: [`« ${nom[0]}. Je te prescris une IRM pour voir l’étendue de la lésion. »`, `“${nom[1]}. I’m prescribing an MRI to see how bad it is.”`] };
      if (ex === 'radio') return { texte: [`« Probablement : ${nom[0].toLowerCase()}. Une radio pour écarter une fracture. »`, `“Probably: ${nom[1].toLowerCase()}. An X-ray to rule out a fracture.”`] };
      return { texte: ['« Tu es en surmenage. Repos complet, sommeil, et on reprend doucement. »', '“You’re overtrained. Full rest, sleep, and an easy restart.”'] };
    }
    if (a.gene) { a.gene = null; return { texte: ['« C’est une alerte. Deux jours sans intensité et ça passera. »', '“It’s a warning. Two easy days and it will pass.”'] }; }
    return { texte: ['« Tout va bien. Voilà ton certificat médical pour la saison. »', '“All good. Here’s your medical certificate for the season.”'] };
  }

  if (s === 'osteo') {
    avancer(a, 50);
    a.osteo = true;
    a.fatigue = Math.max(0, a.fatigue - 12);
    a.moral = Math.min(100, a.moral + 4);
    // l'osteo detend tout le corps : dix points d'usure partout
    const gene = a.gene; soulager(a, 10);
    return { texte: gene && !a.gene ? ['« Le bassin était bloqué, ça tirait sur la chaîne. Tu devrais sentir la différence. »', '“Your pelvis was locked, it pulled on the chain. You should feel the difference.”']
      : ['« Quelques tensions dans le dos. Bois de l’eau, dors bien. »', '“Some tension in your back. Drink water, sleep well.”'] };
  }

  // l'imagerie, a la clinique de Louviers : le bus, l'attente, l'examen, le retour
  avancer(a, 180);
  const d = a.diagnostic!, t = a.blessureType!;
  d.examen = s;
  if (s === 'irm') {
    // l'IRM lit ce que le corps a subi : le grade vient de l'usure au moment de la blessure
    d.grade = a.blessureGrade || 1;
    // une reeducation adaptee fait gagner une semaine
    a.blessure = Math.max(1, a.blessure - 1);
    noter(a, `IRM : lésion de grade ${d.grade}.`, `MRI: grade ${d.grade} injury.`);
    return { texte: [`IRM : lésion de grade ${d.grade}. Avec une rééducation adaptée : ${a.blessure} semaine${a.blessure > 1 ? 's' : ''}.`, `MRI: grade ${d.grade} injury. With proper rehab: ${a.blessure} week${a.blessure > 1 ? 's' : ''}.`] };
  }
  // la radio : la periostite cache parfois une fracture de fatigue
  // la fracture de fatigue : un tibia pousse jusqu'au grade 3 (sa duree est deja la sienne)
  if (t === 'periostite' && a.blessureGrade === 3) {
    d.fracture = true;
    noter(a, 'Radio : fracture de fatigue du tibia.', 'X-ray: tibial stress fracture.');
    return { texte: [`Radio : fracture de fatigue. ${a.blessure} semaines sans courir.`, `X-ray: stress fracture. ${a.blessure} weeks without running.`] };
  }
  a.blessure = Math.max(1, a.blessure - 1);
  return { texte: [`Radio : pas de fracture. Rééducation adaptée : ${a.blessure} semaine${a.blessure > 1 ? 's' : ''}.`, `X-ray: no fracture. Proper rehab: ${a.blessure} week${a.blessure > 1 ? 's' : ''}.`] };
}
