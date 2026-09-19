// LE CLASSEMENT DES RECRUTEURS — contre qui on court le plus.
//
// Le jeu n'avait qu'un tableau, et il ne recompensait qu'une chose : aller
// vite. C'est un classement que la plupart des joueurs ne gagneront jamais, et
// il ne leur donne aucune raison de donner leur code a quelqu'un.
//
// Celui-ci en recompense une autre, que n'importe qui peut faire des sa
// premiere course. On y monte en etant COURU : chaque personne qui releve un
// de vos defis — le code de votre video, celui que vous avez dicte a un ami —
// vous fait une recrue. Un joueur lent a enfin un tableau ou il peut gagner,
// et partager cesse d'etre un service rendu au jeu pour devenir un coup joue.
//
// LE CHIFFRE EXISTAIT DEJA, il n'etait affiche nulle part : le serveur garde
// une ligne par (defi, appareil) depuis toujours. On ne mesure donc pas
// quelque chose de neuf, on montre quelque chose qu'on avait sous la main.
//
// Ce que le serveur compte, et pourquoi, est explique a la route — voir
// /recruteurs dans `worker/src/index.js`. En deux lignes : des PERSONNES et
// non des courses (un ami tetu ne fait pas vingt recrues), jamais soi-meme, et
// toutes distances confondues, parce que c'est la personne qu'on regarde.

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type LigneRecruteur = {
  name: string;
  /** Combien de personnes differentes ont couru contre un de ses fantomes. */
  recrues: number;
  /** Combien de courses en tout — un meme adversaire peut revenir. */
  courses: number;
  /** Sa place, ou `null` quand il est hors du tableau et qu'on l'a recalcule. */
  rank: number | null;
  pays?: string | null;
};

export type TableauRecruteurs = {
  classement: LigneRecruteur[];
  /**
   * Ma ligne, meme hors du tableau.
   *
   * Le serveur la recalcule pour moi seul quand je n'y figure pas : celui qui
   * n'est pas encore dans les cinq cents est precisement celui qu'on veut
   * accrocher, et lui montrer son chiffre a la 900e place est tout l'interet
   * du classement pour lui. `null` quand personne n'a encore couru contre lui.
   */
  moi: LigneRecruteur | null;
};

const VIDE: TableauRecruteurs = { classement: [], moi: null };

/**
 * Le tableau, et ma ligne dedans.
 *
 * Rend un tableau vide plutot que de lever : cet ecran est une curiosite, pas
 * un passage oblige, et une erreur reseau ne doit pas en faire un mur. L'ecran
 * dit alors « personne pour l'instant », ce qui est ce qu'il montrerait de
 * toute facon un jour de base neuve.
 */
export async function fetchRecruteurs(nom?: string): Promise<TableauRecruteurs> {
  const q = nom && nom.trim() ? `?name=${encodeURIComponent(nom.trim())}` : '';
  try {
    const res = await fetch(`${API_BASE}/recruteurs${q}`);
    if (!res.ok) return VIDE;
    const data = await res.json();
    return {
      classement: Array.isArray(data.classement) ? data.classement : [],
      moi: data.moi || null,
    };
  } catch {
    return VIDE;
  }
}
