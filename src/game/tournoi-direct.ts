// Le tournoi a elimination du direct, cote jeu.
//
// De trois a huit partants, la piste court des manches et le dernier de
// chacune sort, jusqu'a la finale a deux. Tout ce qui se decide — qui court,
// qui sort, quand part la suite — se decide dans la salle (voir « LE TOURNOI
// A ELIMINATION » dans worker/src/salle.js). Ce fichier ne tient que ce que le
// telephone a en propre :
//
// - LE REGARD DES ELIMINES. Sortir d'un tournoi ne fait pas quitter la salle :
//   on reste dans les tribunes et on regarde les manches suivantes, sur la
//   meme piste, avec la meme camera que le spectateur d'un championnat. Le
//   moteur sait deja le faire (`G.spectateur`, `G.suivi`) ; on lui demande
//   seulement de retirer notre coureur et de suivre un des autres.
// - LA MANCHE QU'ON VIENT DE REGARDER, pour le bandeau qui la conclut.
// - L'ENVIE DE REGARDER. La manche suivante part toute seule, et un elimine
//   qui lit son resultat, ou revoit sa course, n'a pas forcement envie d'etre
//   tire vers la suivante. Il peut le dire ; la salle n'en sait rien, c'est
//   une affaire entre lui et son ecran.

import { useSyncExternalStore } from 'react';
import type { EtatTournoi, JoueurSalle, ResultatDirect } from './live';


// Lu a l'appel, pas a l'import : ce fichier ne doit rien supposer de l'ordre
// dans lequel le moteur et lui sont charges.
const app = (): any => (globalThis as any).SprinterApp;

type Regard = {
  /** L'identifiant du coureur que la camera suit. */
  suivi: string | null;
  /** Le verdict de la manche regardee, des qu'il tombe. */
  resultat: ResultatDirect | null;
  /** L'elimine veut-il etre tire vers les manches suivantes ? */
  regarder: boolean;
};

let etat: Regard = { suivi: null, resultat: null, regarder: true };
const abonnes = new Set<() => void>();

function publier(p: Partial<Regard>) {
  etat = { ...etat, ...p };
  for (const f of abonnes) {
    try { f(); } catch { /* un ecran casse n'empeche pas les autres */ }
  }
}

export function useRegardTournoi(): Regard {
  return useSyncExternalStore(
    f => { abonnes.add(f); return () => { abonnes.delete(f); }; },
    () => etat,
  );
}

/** Un elimine veut-il voir la suite ? Vrai par defaut : c'est le spectacle. */
export function veutRegarder(): boolean { return etat.regarder; }
export function regarderLaSuite(oui: boolean) { publier({ regarder: oui }); }

/** Les coureurs du direct encore sur la piste, du plus petit couloir au plus grand. */
function enPiste(): [string, any][] {
  const G = app().G;
  return [...(G.lives || new Map()).entries()]
    .map(([id, g]: any) => [id, g.runner] as [string, any])
    .sort((a, b) => a[1].lane - b[1].lane);
}

/**
 * Passer en tribune : la piste vient d'etre montee pour une manche qu'on ne
 * court pas. Notre coureur la quitte, la camera suit le premier couloir.
 *
 * Le moteur fait le reste : un spectateur n'emet rien (`pousserPosition`), ne
 * peut pas partir trop tot, et ne voit ni le tableau de course ni les paves.
 */
export function regarderLaManche() {
  const G = app().G;
  if (!G || !G.liveOn) return;
  G.spectateur = true;
  const i = G.runners.indexOf(G.player);
  if (i >= 0) G.runners.splice(i, 1);
  publier({ resultat: null });
  const garde = etat.suivi && G.lives?.get(etat.suivi);
  if (garde) { G.suivi = garde.runner; return; }
  const premier = enPiste()[0];
  G.suivi = premier ? premier[1] : null;
  publier({ suivi: premier ? premier[0] : null });
}

/** Spectateur : suivre ce coureur-la. */
export function suivreEnTournoi(id: string) {
  app().suivreCoureurChamp(id);
  publier({ suivi: id });
}

/**
 * La salle a change ses coureurs pendant qu'on regardait — un forfait : la
 * camera ne doit pas rester sur un couloir vide.
 */
export function recalerLeRegard() {
  const G = app().G;
  if (!G?.spectateur || !G.liveOn) return;
  if (etat.suivi && G.lives?.has(etat.suivi)) return;
  const premier = enPiste()[0];
  if (!premier) return;
  G.suivi = premier[1];
  publier({ suivi: premier[0] });
}

/** Le verdict de la manche regardee : le bandeau le montre avant le retour. */
export function mancheRegardee(r: ResultatDirect) { publier({ resultat: r }); }

/** Le bandeau montre-t-il encore ce verdict-la ? Une manche neuve l'efface. */
export function regardSur(r: ResultatDirect): boolean { return etat.resultat === r; }

/** On sort des tribunes : rien de cette manche ne doit survivre a la suivante. */
export function oublierLeRegard() { publier({ resultat: null }); }

/** On quitte la salle : tout repart de zero, l'envie de regarder comprise. */
export function remettreLeRegard() {
  etat = { suivi: null, resultat: null, regarder: true };
  publier({});
}

/**
 * Le nom d'une manche, tel qu'on le lit : « FINALE » quand il ne reste que
 * deux coureurs, « MANCHE 3/7 » sinon.
 */
export function nomDeManche(N: any, manche: number, manches: number, partants: number): string {
  if (partants === 2) return N.t('tournoi_finale');
  return N.t('tournoi_manche', { m: manche, n: Math.max(manche, manches) });
}

/** Une ligne du classement d'un tournoi. */
export type LigneTournoi = {
  id: string; nom: string;
  /** Nulle tant qu'il est encore en lice. */
  place: number | null;
  /** La manche ou il est sorti, nulle pour le champion et ceux en lice. */
  manche: number | null;
  champion: boolean;
  forfait: boolean;
  abandon: boolean;
};

/**
 * LE CLASSEMENT D'UN TOURNOI : ceux qui courent encore en tete, par couloir —
 * ou le champion, une fois connu — puis les elimines du mieux place au
 * premier sorti. C'est la meme liste au salon, sur l'ecran de fin et pour
 * ceux qui regardent.
 */
export function classementDuTournoi(t: EtatTournoi, joueurs: JoueurSalle[]): LigneTournoi[] {
  const nomDe = (id: string) => joueurs.find(j => j.id === id)?.nom || '—';
  const couloirDe = (id: string) => joueurs.find(j => j.id === id)?.couloir || 99;
  const tete: LigneTournoi[] = t.etat === 'fini'
    ? (t.champion ? [{ id: t.champion.id, nom: t.champion.nom, place: 1, manche: null,
                       champion: true, forfait: false, abandon: false }] : [])
    : [...t.en_lice].sort((a, b) => couloirDe(a) - couloirDe(b))
        .map(id => ({ id, nom: nomDe(id), place: null, manche: null,
                      champion: false, forfait: false, abandon: false }));
  const sortis = [...t.elimines].sort((a, b) => a.place - b.place)
    .map(e => ({ id: e.id, nom: e.nom, place: e.place, manche: e.manche,
                 champion: false, forfait: e.forfait, abandon: e.abandon }));
  return [...tete, ...sortis];
}

/** Ma place dans un tournoi fini ou en cours ; nulle si je suis encore en lice. */
export function maPlace(t: EtatTournoi | null | undefined, moi: string): number | null {
  if (!t || !moi) return null;
  if (t.etat === 'fini' && t.champion?.id === moi) return 1;
  return t.elimines.find(e => e.id === moi)?.place ?? null;
}
