// LE CLASSEMENT DES NATIONS — la guerre des drapeaux.
//
// Le jeu classait des personnes ; celui-ci classe des PAYS. C'est le seul
// tableau ou l'on ne peut rien faire seul, et c'est exactement ce qui le rend
// utile : on n'y monte pas en courant plus vite, on y monte en etant plus
// nombreux a courir vite. Un joueur qui veut voir son drapeau remonter a une
// raison d'en faire venir d'autres — la meme boucle que les recruteurs, prise
// par l'autre bout.
//
// CE QU'ON MESURE EST LA MEDIANE DES CINQUANTE MEILLEURS de chaque pays, et
// non son record. Un classement au record se decide a une personne pres : un
// seul joueur rapide placerait son pays premier, et le tableau raconterait
// l'histoire d'un individu sous un drapeau. La mediane mesure la profondeur,
// et une mediane ne se deplace pas a une personne pres.
//
// Le detail — le seuil d'effectif, la coupe aux cinquante meilleurs, la
// semaine figee dont viennent les fleches — est explique la ou il s'applique,
// dans `worker/src/nations.js`.
//
// AUCUN NOM DE JOUEUR NE PASSE PAR ICI. La route n'en renvoie pas : ce tableau
// est fait pour etre montre et poste, et la charte interdit de publier le
// pseudonyme de quelqu'un sans son accord (§5.4).

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type LigneNation = {
  /** Le code ISO a deux lettres — c'est lui qui dessine le drapeau. */
  pays: string;
  /** Le nom du pays. Son code, quand le serveur ne sait pas encore le nommer. */
  nom: string;
  nomEn?: string;
  /** La mediane des cinquante meilleurs, en millisecondes. */
  median: number;
  /** Combien de joueurs comptent — au plus cinquante. */
  joueurs: number;
  /** Le record du pays. Il se lit, il ne classe pas. */
  meilleur: number;
  rang: number;
  /** L'ecart a la tete, en millisecondes. Zero pour le premier. */
  ecart: number;
  /** Le rang de lundi dernier, ou `null` si cette semaine-la n'a pas ete figee. */
  rangPrecedent: number | null;
  /** Positif = on est monte. `null` quand il n'y a rien a comparer. */
  mouvement: number | null;
  medianPrecedent: number | null;
};

export type MaNation = LigneNation & {
  /** Combien de joueurs il manque a mon pays pour entrer au tableau. */
  manque: number;
};

export type TableauNations = {
  epreuve: string;
  /** Le lundi de la semaine en cours, en `2026-09-14`. */
  semaine: string;
  precedente: string;
  /** Combien de joueurs par pays entrent dans la mediane. */
  top: number;
  /** L'effectif minimum pour paraitre au tableau. */
  minJoueurs: number;
  classement: LigneNation[];
  /**
   * Mon pays, MEME s'il n'atteint pas le seuil.
   *
   * C'est la ligne qui compte le plus pour le recrutement : un joueur d'un
   * pays de trois personnes qui ne trouve pas son drapeau en conclut que le
   * tableau ne le concerne pas. Lui dire « il manque deux joueurs » est
   * exactement le message qui fait envoyer un code.
   */
  moi: MaNation | null;
};

const VIDE: TableauNations = {
  epreuve: '100', semaine: '', precedente: '', top: 50, minJoueurs: 5,
  classement: [], moi: null,
};

/**
 * Le tableau des nations, et mon pays dedans.
 *
 * Rend un tableau vide plutot que de lever : cet ecran est une curiosite, pas
 * un passage oblige, et une erreur reseau ne doit pas en faire un mur.
 *
 * `pays` plutot que `nom` quand on le connait deja : le serveur accepte les
 * deux, mais lui donner le pays lui evite de retrouver le joueur pour ne lire
 * que son drapeau.
 */
export async function fetchNations(
  { epreuve = '100', pays = '', nom = '' }: { epreuve?: string; pays?: string; nom?: string } = {},
): Promise<TableauNations> {
  const q = new URLSearchParams({ race: epreuve });
  if (pays) q.set('pays', pays);
  else if (nom.trim()) q.set('name', nom.trim());
  try {
    const res = await fetch(`${API_BASE}/nations?${q}`);
    if (!res.ok) return VIDE;
    const data = await res.json();
    if (!Array.isArray(data?.classement)) return VIDE;
    return { ...VIDE, ...data, moi: data.moi || null };
  } catch {
    return VIDE;
  }
}

/** « 9,17 » — la mediane a la francaise, deux decimales comme partout ailleurs. */
export function medianeDite(ms: number, fr: boolean): string {
  const s = (ms / 1000).toFixed(2);
  return fr ? s.replace('.', ',') : s;
}

/** « +0,56 » — un ecart, signe, sans quoi il se lit comme un chrono. */
export function ecartDit(ms: number, fr: boolean): string {
  const s = (ms / 1000).toFixed(2);
  return (ms > 0 ? '+' : '') + (fr ? s.replace('.', ',') : s);
}
