// Le record qui n'est pas encore arrive.
//
// LE CONSTAT. Un record du monde se court une fois. La fenetre qui l'annonce
// l'envoyait aussitot, et si l'envoi echouait elle affichait « reessaie » —
// puis le joueur fermait, et le chrono disparaissait. Pas au classement : de
// PARTOUT. Ni dans `scores`, ni dans `races`, ni dans l'historique distant.
// La course la plus rapide jamais courue sur ce jeu n'avait laissé aucune
// trace ailleurs que sur la photo d'ecran d'un joueur qui demandait pourquoi.
//
// Rien dans le jeu ne rattrapait cela. `checked` ne laisse la fenetre s'ouvrir
// qu'une fois par course, il n'y avait pas de seconde chance, et le bouton
// « plus tard » ne menait a aucun plus tard.
//
// CE QUE FAIT CE MODULE. Il garde le chrono sur l'appareil, et le renvoie tout
// seul : au lancement du jeu, et des que le nom du joueur change. Ce second
// moment est le bon precisement pour le refus qui ne s'arrange pas — un nom
// reserve par un autre appareil. Le joueur va relier le sien dans MES COURSES,
// `saveName` emet NOM_CHANGE, et le record part dans la seconde qui suit, sans
// que personne ait a y repenser.
//
// UN SEUL PAR EPREUVE, ET LE MEILLEUR. Le serveur ne garde de toute facon que
// le meilleur chrono par appareil et par epreuve : empiler les tentatives
// n'ajouterait que des requetes. Un record garde qui se fait battre par un
// autre record garde est donc simplement remplace.
//
// IL NE CASSE JAMAIS UNE COURSE. Stockage refuse, JSON abime, serveur muet :
// on rend une liste vide et le jeu continue. Un record qu'on ne peut pas
// garder est un record perdu comme avant, pas une partie qui s'arrete.

import {
  getSavedName, submitRaceRecord, raisonDe,
  NOM_CHANGE, type RaceKey, type RaisonRefus,
} from './leaderboard';

const CLE = 'sprinter_records_en_attente';

export type RecordEnAttente = {
  race: RaceKey;
  /** Le chrono, en millisecondes — la mesure du serveur, pas les secondes. */
  ms: number;
  /** Le nom sous lequel il a ete refuse. */
  nom: string;
  /** Pourquoi il n'est pas passe, au dernier essai. */
  raison: RaisonRefus;
  /** Quand la course a eu lieu. */
  le: number;
};

function lire(): RecordEnAttente[] {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '[]');
    if (!Array.isArray(brut)) return [];
    return brut.filter((r): r is RecordEnAttente =>
      !!r && typeof r.race === 'string' && Number.isFinite(r.ms) && r.ms > 0);
  } catch {
    return [];                      // stockage refuse ou contenu abime
  }
}

function ecrire(liste: RecordEnAttente[]) {
  try { localStorage.setItem(CLE, JSON.stringify(liste)); }
  catch { /* stockage plein ou refuse : on aura au moins essaye d'envoyer */ }
}

/** Ce qui attend encore, pour une epreuve ou pour toutes. */
export function enAttente(race?: RaceKey): RecordEnAttente[] {
  const l = lire();
  return race ? l.filter(r => r.race === race) : l;
}

/**
 * Un record vient d'etre refuse : on le garde.
 *
 * Rend ce qui a ete retenu, ou null si un chrono deja garde etait meilleur —
 * auquel cas il n'y avait rien a remplacer.
 */
export function garder(
  race: RaceKey, ms: number, nom: string, raison: RaisonRefus,
): RecordEnAttente | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const liste = lire();
  const autres = liste.filter(r => r.race !== race);
  const deja = liste.find(r => r.race === race);
  if (deja && deja.ms <= ms) {
    // Le chrono garde est deja meilleur. On note quand meme la raison du jour :
    // c'est elle que l'ecran montre, et une raison perimee ferait dire « ton
    // nom est pris » a quelqu'un qui vient de le recuperer.
    ecrire([...autres, { ...deja, raison }]);
    return null;
  }
  const garde: RecordEnAttente = { race, ms: Math.round(ms), nom, raison, le: Date.now() };
  ecrire([...autres, garde]);
  return garde;
}

/** Ce record est arrive, ou n'a plus lieu d'attendre. */
export function oublier(race: RaceKey) {
  const liste = lire();
  const reste = liste.filter(r => r.race !== race);
  if (reste.length !== liste.length) ecrire(reste);
}

/**
 * Renvoyer ce qui attend.
 *
 * Le nom du jour prime sur celui sous lequel le record a ete refuse : c'est
 * tout l'interet d'attendre. Un joueur qui vient de relier son appareil, ou
 * qui a simplement change de nom, envoie sous le nom qu'il porte maintenant —
 * renvoyer sous l'ancien reprendrait le meme 403 pour l'eternite.
 *
 * Ne leve jamais : elle est appelee au lancement du jeu et sur un evenement,
 * deux endroits ou personne n'attrape rien.
 *
 * @returns le nombre de records reellement enregistres.
 */
export async function rejouerLesAttentes(): Promise<number> {
  const liste = lire();
  if (!liste.length) return 0;
  const nom = getSavedName().trim();
  if (!nom) return 0;               // sans nom, le serveur n'a rien a classer

  let passes = 0;
  for (const r of liste) {
    try {
      await submitRaceRecord(r.race, nom, r.ms);
      oublier(r.race);
      passes++;
    } catch (e) {
      // Toujours refuse : on garde, en notant pourquoi. La prochaine occasion
      // viendra du prochain lancement, ou du prochain changement de nom.
      garder(r.race, r.ms, nom, raisonDe(e));
    }
  }
  return passes;
}

/**
 * Brancher le rattrapage, une fois pour la vie de l'application.
 *
 * Deux declencheurs, et le second est le vrai : le lancement rattrape les
 * pannes de reseau, le changement de nom rattrape les noms reserves.
 */
let branche = false;
export function brancherRattrapage() {
  if (branche) return;
  branche = true;
  void rejouerLesAttentes();
  try {
    window.addEventListener(NOM_CHANGE, () => { void rejouerLesAttentes(); });
  } catch { /* hors navigateur : le lancement aura suffi */ }
}
