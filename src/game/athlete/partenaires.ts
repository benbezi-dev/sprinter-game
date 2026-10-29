// LES PARTENAIRES DE LA CARRIERE D'ATHLETE — un vrai club, un jour, a la place
// du club invente.
//
// L'auteur, 25/10 : « je vais peut-etre avec un sponsor d'ici la fin de soiree
// avec le club de Val-de-Reuil, il faudra injecter le logo ». Tant que
// CLUB_PARTENAIRE vaut null, le jeu garde ses clubs inventes (« Les Foulees du
// Quartier », « Horizon Athletisme ») et ne nomme aucun vrai club. Le jour ou
// l'accord ECRIT est signe, on remplit ce seul objet : le club de quartier
// devient le vrai club, avec son nom, son logo et ses couleurs, partout ou il
// apparait (ville, fiche du club, panneau au bord de la piste).
//
// Le logo se pose dans public/athlete/partenaires/ (SVG, ou PNG a fond
// transparent) ; `logo` est son chemin depuis public/, sans barre au debut.

export type ClubPartenaire = {
  /** Le nom officiel, tel que le club l'ecrit. */
  nom: string;
  /** Le sigle ou le nom court, pour les etiquettes. */
  court: string;
  logo: string;
  /** Les couleurs du club : [principale, secondaire], en hex. */
  couleurs: [string, string];
  /** La date de l'accord ecrit (aaaa-mm-jj) : sans elle, on ne publie pas. */
  accord: string;
};

export const CLUB_PARTENAIRE: ClubPartenaire | null = null;

/** Le chemin complet du logo, ou null. */
export function logoDuClub(): string | null {
  if (!CLUB_PARTENAIRE) return null;
  const base = (import.meta as any).env?.BASE_URL || '/';
  return base + CLUB_PARTENAIRE.logo;
}

/** Le nom du club `id` (regles.ts, CLUBS) a l'ecran : le vrai club s'il y a un accord. */
export function nomDuClub(id: string, fr: string): string {
  return id === 'quartier' && CLUB_PARTENAIRE ? CLUB_PARTENAIRE.nom : fr;
}
