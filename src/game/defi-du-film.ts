// LE DEFI DE LA VIDEO — celui dont le code est ecrit sur le carton de fin.
//
// Le carton portait le code d'un defi seulement quand il y en avait deja un,
// c'est-a-dire quand le joueur venait d'en relever un. Partout ailleurs il se
// taisait, et la video repartait sans rien a jouer : elle invitait, elle ne
// defiait pas.
//
// LE PROBLEME EST UN PROBLEME D'HORLOGE, ET RIEN D'AUTRE. Un defi s'ecrit sur
// le serveur, et jusqu'ici il ne s'ecrivait qu'au clic sur « DEFIER UN AMI »,
// depuis l'ecran de fin — donc plusieurs secondes APRES que la camera se soit
// arretee. Le code n'existait pas encore a l'instant ou il aurait fallu le
// peindre.
//
// Ce module avance ce moment. A l'arrivee, quand le film se termine, il ouvre
// le defi sans attendre personne. Le carton l'affiche si le serveur repond a
// temps, et se tait sinon — voir `carton-film.ts`, qui lui garde sa place
// pendant qu'il arrive pour que rien ne bouge quand il se pose.
//
// OUVRIR N'EST PAS LANCER, et c'est tout l'equilibre de ce fichier.
//
//   OUVRIR est un geste de la camera. Le defi existe, son code est imprimable,
//     n'importe qui peut courir contre ce fantome. Il ne vise personne, ne
//     fait sonner aucun telephone, et ne compte pas au tableau des defis
//     lances — une course courue n'est pas un defi envoye.
//   LANCER est un geste du joueur, et il n'a pas change : c'est le bouton de
//     l'ecran de fin. Il vise, il compte, il sonne.
//
// Les confondre aurait ete facile — une seule route, un seul appel — et ca
// aurait fausse le classement des duels de tout le monde, en comptant comme
// « defi lance » chaque course filmee par quelqu'un qui n'a jamais appuye sur
// rien. Voir `ensureChallengeLance`, cote serveur.
//
// ET C'EST LE MEME DEFI DES DEUX COTES. Le bouton ne cree plus le sien : il
// lance celui que la camera a ouvert. Sans cela le joueur aurait deux codes
// pour une seule course — celui de sa video et celui de son ecran — et aucune
// facon de deviner lequel donner.

import { SprinterApp } from './engine';
import { ouvrirChallenge, lancerChallenge } from './challenge';
import type { GenreFilm } from './film-course';

/** Ce que le carton a besoin de savoir, et rien de plus. */
export type DefiDuFilm = {
  /** Un code est en route. Le carton lui garde sa place plutot que de sauter. */
  attendu: boolean;
  /** Le code, une fois arrive. Vide tant qu'il ne l'est pas. */
  id: string;
  /** L'instant de son arrivee, pour le poser en douceur et non d'un coup. */
  arriveA: number;
};

const REPOS: DefiDuFilm = { attendu: false, id: '', arriveA: 0 };
let etat: DefiDuFilm = REPOS;

export function defiDuFilm(): DefiDuFilm { return etat; }

/** Le code de la video, ou une chaine vide. Pour l'ecran de fin. */
export function codeDuFilm(): string { return etat.id; }

/** Une prise neuve, un defi neuf : celui d'avant ne la concerne pas. */
export function oublierLeDefiDuFilm() { etat = REPOS; }

/**
 * LA COURSE PEUT-ELLE DEVENIR UN DEFI ?
 *
 * Les bornes sont celles du serveur, recopiees ici pour ne pas lui envoyer ce
 * qu'il refusera : il repondrait 400, on l'aurait derange pour rien, et le
 * carton aurait garde une place vide le temps du voyage.
 *
 * LE RELAIS N'EN EST PAS. Son chrono appartient a l'equipe, et le fantome
 * qu'on tirerait d'un seul relayeur ne rejouerait pas la course qu'on voit
 * dans la video — il en rejouerait un quart. Un code qui ment sur ce qu'il
 * ouvre est pire que pas de code : le carton se tait, et garde son chrono.
 */
function courseDefiable(G: any, genre: GenreFilm): { races: string[]; traces: number[][]; splits: number[]; totalMs: number; levelIdx: number } | null {
  if (genre === 'relais') return null;
  if (!G || G.falseOut) return null;

  const races: string[] = (G.shotRaces || []).map(String).filter(Boolean);
  if (!races.length || races.length > 6) return null;

  // Un parcours incomplet n'a pas de fantome a offrir : la meme regle que
  // l'ecran de fin, qui cache le bouton dans ce cas (`complete`).
  const splits: any[] = G.runSplits || [];
  if (splits.length !== races.length || splits.some((s: any) => s == null)) return null;

  const totalMs = Math.round(Number(G.runTime || 0) * 1000);
  if (!Number.isFinite(totalMs) || totalMs < 1000 || totalMs > 20 * 60000) return null;

  // Sans trace, le defi existe mais on ne peut pas courir contre : le serveur
  // l'accepterait — une trace vide reste une trace — et l'adversaire se
  // retrouverait seul sur la piste.
  const traces: number[][] = G.shotTraces || [];
  if (traces.length !== races.length || traces.some(t => !Array.isArray(t) || t.length < 2)) return null;

  return {
    races, traces, totalMs,
    splits: splits.map((s: number) => Math.round(s * 1000)),
    levelIdx: Number(G.shotLevel) || 0,
  };
}

/**
 * Ouvre le defi de cette course, sans attendre sa reponse.
 *
 * On ne rend pas de promesse, et c'est voulu : l'appelant est `arreterLeFilm`,
 * dont le travail est d'arreter une camera. Le faire patienter sur un
 * aller-retour reseau rallongerait la fin de chaque course d'autant, y compris
 * chez quelqu'un dont le reseau rame — pour un code qui n'est qu'un bonus sur
 * un carton. Le code arrive quand il arrive ; s'il arrive trop tard, ou pas
 * du tout, le carton sort sans lui.
 *
 * DEJA UN DEFI EN MAIN : on n'en ouvre pas un second. Un joueur qui vient de
 * relever un defi a deja un code, celui de la course qu'il vient de courir, et
 * c'est exactement celui que le carton doit montrer — il rejoue la meme course
 * contre le meme fantome.
 */
export function ouvrirLeDefiDuFilm(genre: GenreFilm) {
  const G: any = SprinterApp.G;
  if (G?.challenge?.id) { oublierLeDefiDuFilm(); return; }

  const course = courseDefiable(G, genre);
  if (!course) { oublierLeDefiDuFilm(); return; }

  // Une prise a la fois, et la place est prise des maintenant : le carton
  // commence a se peindre dans la milliseconde qui suit.
  const ouverture = { attendu: true, id: '', arriveA: 0 };
  etat = ouverture;

  void (async () => {
    try {
      const { id } = await ouvrirChallenge({
        races: course.races as any,
        levelIdx: course.levelIdx,
        totalMs: course.totalMs,
        splits: course.splits,
        traces: course.traces,
      });
      // La prise a pu etre jetee pendant le voyage — le joueur est reparti a
      // l'ecran-titre. On ne ressuscite pas un carton qui n'existe plus.
      if (etat !== ouverture) return;
      etat = { attendu: true, id, arriveA: performance.now() };
    } catch {
      // Hors ligne, serveur muet, defi refuse : le carton rend sa place et
      // sort avec le chrono et l'adresse, ce qui reste l'essentiel.
      if (etat === ouverture) etat = REPOS;
    }
  })();
}

/**
 * Lance le defi de la video : le geste du joueur, sur le bouton.
 *
 * Rend `null` quand il n'y a rien a lancer — pas de defi ouvert, ou une
 * ouverture qui n'a jamais abouti. L'appelant retombe alors sur la creation
 * ordinaire, exactement comme avant ce module.
 */
export async function lancerLeDefiDuFilm(input: {
  name?: string;
  targetScoreId?: number | null;
  revancheDe?: string | null;
}) {
  const id = etat.id;
  if (!id) return null;
  return lancerChallenge({
    id,
    name: input.name,
    targetScoreId: input.targetScoreId ?? null,
    revancheDe: input.revancheDe ?? null,
  });
}
