// UNE SERIE DE CHAMPIONNAT, COURUE EN DIRECT.
//
// Le branchement entre la salle (worker/src/salle-championnat.js) et le
// moteur. C'est le meme travail que LivePanel fait pour le direct — monter la
// piste a la presentation, poser le depart a l'heure annoncee, relayer les
// positions — avec trois differences qui sont tout le championnat :
//
// 1. PERSONNE NE CHOISIT SA PISTE. On entre dans la salle de SA serie, dans
//    son couloir ; la salle sait qui court et qui regarde.
// 2. LE FAUX DEPART EST UN RAPPEL. La salle l'annonce, le moteur joue la scene
//    (rappelChamp), puis tout le monde repart — sauf les fautifs, qui passent
//    spectateurs.
// 3. PAS DE REVANCHE. La course est rangee par la salle ; l'ecran de fin est
//    un tableau d'arrivee, pas le recapitulatif du one shot.
//
// Il vit hors de l'arbre React, comme la presentation : monter la piste fait
// sortir le jeu de l'ecran-titre, et tout ce qui vivait dedans avec lui.

import { useSyncExternalStore } from 'react';
import { Salle, type EtatSalle, type Rappel, type Arrivee, type Presentation } from './live';
import { brancherSalle, reinitialiserEnvoi } from './engine';
import { lancerPresentation } from './presentation-directe';
import { niveauDuLieu } from './champ-rejeu';
import { chargerFiches } from './fiches-champ';
import {
  entrerDansLeTour, presentationAnnoncee, pistoletAnnonce, rappelSiffle,
  verdictRendu, arreterLaMusique,
} from './musique-championnat';

const SprinterApp: any = (globalThis as any).SprinterApp;

export type EtapeChamp =
  'connexion' | 'attente' | 'echauffement' | 'presentation' | 'course' | 'rappel' | 'fin' | 'erreur';

export type EtatChampDirect = {
  ouvert: boolean;
  etape: EtapeChamp;
  role: 'coureur' | 'spectateur';
  moi: string;
  salle: EtatSalle | null;
  /** Le rappel en cours : sa date de debut chez soi, et si l'on est sorti. */
  rappel: (Rappel & { debut: number; moiSorti: boolean }) | null;
  /** Vrai des qu'on a pris le carton rouge. */
  sorti: boolean;
  resultat: { classement: Arrivee[]; partants: number } | null;
  enregistre: { ok: boolean; erreur: string | null } | null;
  erreur: string | null;
  /** Le coureur que la camera suit, en spectateur. */
  suivi: string | null;
};

const VIDE: EtatChampDirect = {
  ouvert: false, etape: 'connexion', role: 'coureur', moi: '', salle: null,
  rappel: null, sorti: false, resultat: null, enregistre: null, erreur: null,
  suivi: null,
};

let etat: EtatChampDirect = VIDE;
const abonnes = new Set<() => void>();
function publier(p: Partial<EtatChampDirect>) {
  etat = { ...etat, ...p };
  for (const f of abonnes) f();
}

export function lireChampDirect(): EtatChampDirect { return etat; }
export function useChampDirect(): EtatChampDirect {
  return useSyncExternalStore(
    l => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => etat, () => etat,
  );
}

let salle: Salle | null = null;
let edition = '';
let epreuve = '100';
let niveau = 4;
/** Le pistolet annonce, dans notre horloge, en attendant la fin de la presentation. */
let cibleDepart: number | null = null;
let dateDepart: number | null = null;
let presEnCours = false;
let minuteurRappel: ReturnType<typeof setTimeout> | null = null;
/** Le lien moteur → salle, gardé pour le rebrancher après un échauffement. */
let lien: Parameters<typeof brancherSalle>[0] = null;
let veilleEchauffement: ReturnType<typeof setInterval> | null = null;

/** Mon couloir dans la grille de la salle, s'il y en a un. */
function monCouloir(): number | undefined {
  const g = salle?.dernierEtat?.champ?.grille || [];
  return g.find(x => x.cle === salle?.moi)?.couloir;
}

/**
 * Les autres coureurs encore en lice, lus dans la SALLE : ses ecouteurs sont
 * crees une fois, et ce qu'ils captureraient de React daterait de la
 * connexion. Les fautifs n'y sont plus — la salle les a passes en `dq`.
 */
function autres() {
  const s = salle;
  return (s?.dernierEtat?.joueurs || [])
    .filter(j => j.id !== s?.moi && (!j.statut || j.statut === 'engage'))
    .map(j => ({ id: j.id, nom: j.nom, couloir: j.couloir || 0, cible_ms: j.cible_ms }));
}

/**
 * Monte la piste sans donner le depart : a la presentation, ou au pistolet
 * si la salle n'en annonce pas. Un spectateur n'a pas de coureur : on retire
 * le sien de la piste et la camera suit le premier couloir.
 */
function monterLaPiste() {
  const G = SprinterApp.G;
  if (G.state === 'count' || G.state === 'race') return;
  const spectateur = salle?.role === 'spectateur';
  SprinterApp.startLive([epreuve], {
    levelIdx: niveau, autres: autres(), sansOrdinateur: true, photoFinish: true,
    championnat: true, monCouloir: spectateur ? undefined : monCouloir(),
  });
  if (spectateur) devenirSpectateur();
}

function devenirSpectateur() {
  const G = SprinterApp.G;
  G.spectateur = true;
  const i = G.runners.indexOf(G.player);
  if (i >= 0) G.runners.splice(i, 1);
  if (!G.suivi) {
    // Les coureurs en lice : ceux du reseau et les fictifs, par couloir.
    const tous: [string, any][] = [
      ...[...(G.lives || new Map()).entries()].map(([id, g]: any) => [id, g.runner] as [string, any]),
      ...[...(G.fictifs || new Map()).entries()] as [string, any][],
    ].sort((a, b) => a[1].lane - b[1].lane);
    if (tous[0]) { G.suivi = tous[0][1]; publier({ suivi: tous[0][0] }); }
  }
}

function lancerCourse() {
  const G = SprinterApp.G;
  if (G.state !== 'count' && G.state !== 'race') monterLaPiste();
  else SprinterApp.majLives(autres());
  const dans = Math.max(0, (cibleDepart ?? Date.now()) - Date.now());
  SprinterApp.liveDepart(dans, dateDepart);
  publier({ etape: 'course' });
}

function ecouteurs() {
  return {
    onEtat: (e: EtatSalle) => {
      publier({
        salle: e, moi: salle?.moi || '', role: salle?.role || 'coureur',
        etape: etat.etape === 'connexion' ? 'attente' : etat.etape,
      });
      // LES FICHES PARTENT DE LA CHAMBRE D'APPEL, pas de la presentation : un
      // athlete y a trois secondes, et sa fiche doit etre la des la premiere.
      // La grille entiere, absents compris — on ne sait pas encore qui sera
      // la a l'appel. Deja demandees, elles ne repartent pas.
      const grille = e.champ?.grille;
      if (edition && grille?.length) void chargerFiches({ edition }, grille.map(g => g.cle));
      const G = SprinterApp.G;
      if (G.liveOn && G.champDirect && (G.state === 'count' || G.state === 'race') && !G.rappel) {
        SprinterApp.majLives(autres());
      }
    },
    onPresentation: (p: Presentation) => {
      if (etat.etape === 'echauffement') finirEchauffement();
      presEnCours = true;
      publier({ etape: 'presentation' });
      presentationAnnoncee(p.dansMs, p.ordre.length);
      monterLaPiste();
      lancerPresentation({
        presentation: p,
        moi: salle?.moi || '',
        onTour: () => { /* pas de micro en championnat */ },
        onFini: () => {
          lancerPresentation(null);
          presEnCours = false;
          if (cibleDepart != null) lancerCourse();
        },
        etatVoix: () => ({ micro: false, refuse: false, ouvert: false, connecte: false } as any),
        // Chaque athlete presente avec son palmares, son niveau en duel et
        // son bilan — sur la distance de l'edition.
        fiches: edition ? { edition, epreuve } : undefined,
      });
    },
    onDepart: (dansMs: number, departA: number) => {
      if (etat.etape === 'echauffement') finirEchauffement();
      cibleDepart = Date.now() + dansMs;
      dateDepart = departA;
      pistoletAnnonce(dansMs);
      if (!presEnCours) lancerCourse();
    },
    onPos: (id: string, d: number, c?: number) => SprinterApp.liveDistDe(id, d, c),
    onFini: (_n: string, ms: number, abandon: boolean, id?: string) => {
      if (id) SprinterApp.liveFiniDe(id, ms, abandon);
    },
    onRappel: (r: Rappel, dansMs: number | null) => {
      const moiSorti = r.fautifs.some(f => f.id === etat.moi);
      const nouveauPistolet = dansMs == null ? null : Date.now() + dansMs;
      // La musique se tait pendant la scene, et reprend au 3-2-1 du nouveau depart.
      rappelSiffle();
      if (dansMs != null) pistoletAnnonce(dansMs);
      // L'etat que porte le rappel est deja celui d'apres : les fautifs y sont
      // en `dq`. Sans le republier, l'ecran proposait encore de suivre un
      // coureur qui venait de quitter la piste.
      publier({ etape: 'rappel', rappel: { ...r, debut: Date.now(), moiSorti },
                salle: salle?.dernierEtat || etat.salle,
                sorti: etat.sorti || moiSorti,
                role: moiSorti ? 'spectateur' : etat.role });
      SprinterApp.rappelChamp(r.fautifs.map(f => f.id), moiSorti);
      if (minuteurRappel) clearTimeout(minuteurRappel);
      minuteurRappel = setTimeout(() => {
        minuteurRappel = null;
        const reste = nouveauPistolet == null ? null : Math.max(0, nouveauPistolet - Date.now());
        SprinterApp.finRappelChamp(reste, r.depart_a);
        const G = SprinterApp.G;
        const suivi = G.spectateur && G.suivi
          ? [...(G.lives || new Map()).entries()].find((x: any) => x[1].runner === G.suivi)?.[0]
            || [...(G.fictifs || new Map()).entries()].find((x: any) => x[1] === G.suivi)?.[0]
            || null
          : etat.suivi;
        // La scene est finie : on repart, ou l'on attend le verdict si
        // personne ne repart.
        publier({ etape: etat.resultat ? 'fin' : 'course', rappel: null, suivi });
      }, r.rappel_ms);
    },
    onResultat: (r: any) => {
      verdictRendu();
      publier({ resultat: { classement: r.classement || [], partants: r.partants || 0 },
                etape: etat.etape === 'rappel' ? 'rappel' : 'fin' });
    },
    onEnregistre: (ok: boolean, erreur: string | null) => publier({ enregistre: { ok, erreur } }),
    onFerme: (raison: string) => {
      if (etat.etape === 'fin') return;
      publier({ etape: 'erreur', erreur: raison });
    },
  };
}

/**
 * Entrer dans la salle d'une serie.
 *
 * @param lieu la cle du stade impose par l'edition, s'il y en a un
 * @param echelon, zone ce que l'edition est : la musique enregistree
 *   (game/musique-championnat.ts) est celle du Championnat de France
 */
export function entrerEnDirect(ed: string, phase: string, course: number,
                               opts: { epreuve: string; lieu?: string | null;
                                       echelon?: string; zone?: string }) {
  quitterDirect(false);
  // LE SON S'OUVRE DANS LE GESTE, comme sur la page Regarder. Ce clic est le
  // dernier appui avant le pistolet : sans lui, c'etait le PREMIER APPUI DE LA
  // COURSE qui ouvrait l'audio — et `Audio_.init()` fabrique tous les sons du
  // jeu d'un coup (275 ms mesurees sur un Mac, davantage sur un telephone),
  // au coup de pistolet, sous les yeux de tout le monde. Il privait en plus
  // la presentation et le decompte de la voix du starter.
  try { SprinterApp.Audio_.init(); SprinterApp.Audio_.ctx?.resume?.(); } catch { /* sans le son, la course se court */ }
  edition = String(ed || '').toUpperCase();
  epreuve = opts.epreuve || '100';
  niveau = niveauDuLieu(opts.lieu);
  cibleDepart = null; dateDepart = null; presEnCours = false;
  // Le morceau du tour se charge des l'entree : la chambre d'appel laisse
  // plusieurs minutes avant la presentation. Il est ecrit pour le Championnat
  // de France ; ailleurs, aucun tour ne s'ouvre, les annonces de la salle ne
  // trouvent rien a programmer, et la course garde sa musique ordinaire.
  if (opts.echelon === 'national' && opts.zone === 'FR') entrerDansLeTour(phase);
  else arreterLaMusique();
  const s = new Salle(`${ed}-${phase}-${course}`, ecouteurs());
  salle = s;
  lien = {
    position: (d: number, c?: number) => s.position(d, c),
    fini: (ms: number) => s.fini(ms),
    fauxDepart: (ms: number) => s.fauxDepart(ms),
  };
  brancherSalle(lien);
  publier({ ...VIDE, ouvert: true });
  s.connecterChampionnat(ed, phase, course);
}

/* ----------------------------------------------------------- l'echauffement */

/**
 * S'ECHAUFFER SUR LA PISTE PENDANT L'ATTENTE (demande de l'organisateur, 26/09).
 *
 * Un partant qui attend en chambre d'appel peut courir un 100 m seul, sur la
 * piste du championnat, autant de fois qu'il veut. Rien n'en part : le moteur
 * est DEBRANCHE de la salle le temps de l'echauffement — un faux depart
 * d'echauffement signale a la salle l'y aurait disqualifie, car elle juge les
 * signalements quelle que soit la phase. Il revient en chambre d'appel apres
 * chaque course, et d'office 40 s avant l'appel : la presentation monte la
 * piste du championnat, et ne le ferait pas sur une course en cours.
 */
const FIN_ECHAUFFEMENT_AVANT_APPEL_MS = 40_000;
const APPEL_AVANT_PISTOLET_MS = 29_500;

/** Le temps qui reste avant la fin forcee de l'echauffement, ou null. */
export function resteEchauffement(): number | null {
  const at = etat.salle?.champ?.at;
  if (!salle || !at) return null;
  return salle.versLocal(at) - APPEL_AVANT_PISTOLET_MS - FIN_ECHAUFFEMENT_AVANT_APPEL_MS - Date.now();
}

/** Vrai quand ce joueur peut partir s'echauffer maintenant. */
export function peutSEchauffer(): boolean {
  const r = resteEchauffement();
  return !!salle && etat.role === 'coureur' && etat.salle?.champ?.etat === 'ouverte'
    && etat.etape === 'attente' && r != null && r > 5_000;
}

export function echauffer() {
  if (!peutSEchauffer()) return;
  const G = SprinterApp.G;
  brancherSalle(null);
  G.champDirect = false;
  SprinterApp.startLive([epreuve], { levelIdx: niveau, autres: [], sansOrdinateur: true });
  SprinterApp.liveDepart(3000, null);
  publier({ etape: 'echauffement' });
  let finiDepuis: number | null = null;
  if (veilleEchauffement) clearInterval(veilleEchauffement);
  veilleEchauffement = setInterval(() => {
    const r = resteEchauffement();
    if (r == null || r <= 0) { finirEchauffement(); return; }
    // La course d'echauffement est finie (arrivee, faux depart) : on laisse
    // le temps de voir son chrono, puis retour en chambre d'appel.
    const enCourse = G.state === 'count' || G.state === 'race';
    if (enCourse) { finiDepuis = null; return; }
    if (finiDepuis == null) finiDepuis = Date.now();
    else if (Date.now() - finiDepuis > 2_500) finirEchauffement();
  }, 250);
}

export function finirEchauffement() {
  if (veilleEchauffement) { clearInterval(veilleEchauffement); veilleEchauffement = null; }
  if (etat.etape !== 'echauffement') return;
  const G = SprinterApp.G;
  G.liveOn = false;
  if (G.state !== 'title' && G.state !== 'open') SprinterApp.goHome();
  if (lien) { brancherSalle(lien); reinitialiserEnvoi(); }
  publier({ etape: 'attente' });
}

/** Spectateur : suivre ce coureur-la. */
export function suivre(id: string) {
  SprinterApp.suivreCoureurChamp(id);
  publier({ suivi: id });
}

/** Une date de la salle dans notre horloge (pour les comptes a rebours). */
export function versLocal(t: number): number {
  return salle ? salle.versLocal(t) : t;
}

/**
 * Quitter la salle. `accueil` ramene le jeu a l'ecran-titre : c'est le cas
 * du bouton ; entrer dans une autre salle ne le demande pas.
 */
export function quitterDirect(accueil = true) {
  if (minuteurRappel) { clearTimeout(minuteurRappel); minuteurRappel = null; }
  if (veilleEchauffement) { clearInterval(veilleEchauffement); veilleEchauffement = null; }
  lien = null;
  if (salle) {
    const s = salle; salle = null;
    s.ecouter({});
    s.fermer();
  }
  brancherSalle(null);
  lancerPresentation(null);
  arreterLaMusique();
  const etaitOuvert = etat.ouvert;
  publier({ ...VIDE });
  if (accueil && etaitOuvert) {
    const G = SprinterApp.G;
    G.liveOn = false;
    if (G.state !== 'title' && G.state !== 'open') SprinterApp.goHome();
  }
}
