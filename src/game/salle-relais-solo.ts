// Le relais en solo : un joueur, trois relayeurs fictifs.
//
// Le relais demande quatre joueurs connectes en meme temps, et c'est ce qui le
// rendait injouable la plupart du temps : on montait une equipe, puis on
// attendait. Ici le joueur choisit sa place, et les trois autres portions sont
// courues par le jeu.
//
// LES REGLES SONT CELLES DU SERVEUR, PAS UNE COPIE. On importe `CourseEquipe`
// de worker/src/relais-course.js : zones, portee, eliminations, note des
// passages. Et LES FICTIFS SONT CEUX DU SERVEUR : worker/src/relais-fictifs.js
// les fait courir ici comme dans le salon de relais en ligne (deux joueurs et
// deux fictifs, trois et un).
//
// La salle est locale : pas de WebSocket, pas d'horloge distante, rien
// d'enregistre au classement des equipes. Elle expose la meme surface que
// `SalleRelais`, si bien que l'ecran de course (CourseRelais) ne sait pas
// qu'il n'y a personne d'autre.

import { getSavedName } from './leaderboard';
import {
  CourseEquipe, zoneDe, TAILLE as TAILLE_SERVEUR, ARRIVEE as ARRIVEE_SERVEUR,
  // @ts-ignore — module JavaScript du worker, sans declaration de types.
} from '../../worker/src/relais-course.js';
// @ts-ignore — module JavaScript du worker, sans declaration de types.
import { Fictifs, tirerNoms, PAS_MS } from '../../worker/src/relais-fictifs.js';
import { ELAN, type EtatRelais, type Ecouteurs, type JoueurRelais, type Zone } from './salle-relais';

const TAILLE: number = TAILLE_SERVEUR;
const ARRIVEE: number = ARRIVEE_SERVEUR;

/** Le temps de se mettre en place, comme la vraie salle. */
const AVANT_DEPART_MS = 5000;

/**
 * LE RECORD PERSO, PAR PLACE.
 *
 * Une course solo ne compte pas au classement des equipes : sans rien a battre,
 * on la courait une fois. Le meilleur temps a chaque place reste donc sur le
 * telephone — c'est un repere pour soi, pas un classement, et il n'a aucune
 * raison de partir au serveur.
 */
const CLE_RECORDS = 'sprinter.relais.solo.records';

function lireRecords(): Record<string, number> {
  try {
    const o = JSON.parse(localStorage.getItem(CLE_RECORDS) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}

export function recordSolo(rang: number): number | null {
  const v = Number(lireRecords()[String(rang)]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Note un temps ; dit s'il bat le record, et quel etait l'ancien. */
export function noterRecordSolo(rang: number, ms: number): { nouveau: boolean; avant: number | null } {
  const avant = recordSolo(rang);
  const nouveau = avant == null || ms < avant;
  if (nouveau) {
    try {
      const o = lireRecords(); o[String(rang)] = Math.round(ms);
      localStorage.setItem(CLE_RECORDS, JSON.stringify(o));
    } catch { /* sans memoire, le record vit le temps de l'ecran */ }
  }
  return { nouveau, avant };
}

export class SalleRelaisSolo {
  private ec: Ecouteurs;
  private course: any;
  private fictifs: any;
  private minuteur: ReturnType<typeof setInterval> | null = null;
  private pret_ = false;
  private finEnvoyee = false;
  /** Fermee : plus rien ne part vers l'ecran, plus rien ne s'y accepte. */
  private fermee = false;

  moi = 'moi';
  monRelais: number;
  maZone: Zone | null;
  equipe: string;
  departA: number | null = null;
  marque: number;

  constructor(rang: number, equipe: string, ec: Ecouteurs) {
    this.monRelais = Math.max(1, Math.min(TAILLE, Math.round(rang) || 1));
    this.equipe = equipe;
    this.ec = ec;
    this.maZone = this.monRelais > 1 ? zoneDe(this.monRelais) : null;
    this.marque = this.maZone ? this.maZone.debut : 0;
    this.course = new CourseEquipe(equipe, equipe);
    const rangs = [1, 2, 3, 4].filter(r => r !== this.monRelais);
    this.fictifs = new Fictifs(this.course, rangs, tirerNoms(rangs.length, [getSavedName() || '']));
    this.fictifs.reinitialiser(Date.now());
  }

  /* ----------------------------------------------------------- l'etat */

  private joueurs(): JoueurRelais[] {
    const dist = new Map<number, { d: number; fini: boolean }>(
      this.course.vue().coureurs.map((c: any) => [c.relais, c]));
    const moi: JoueurRelais = {
      id: this.moi, nom: getSavedName() || 'TOI', relais: this.monRelais, pret: this.pret_,
      d: dist.get(this.monRelais)?.d ?? 0, fini: dist.get(this.monRelais)?.fini ?? false,
    };
    const autres = this.fictifs.liste.map((f: any) => ({
      id: f.id, nom: f.nom, relais: f.relais, pret: true, fictif: true,
      d: dist.get(f.relais)?.d ?? 0, fini: dist.get(f.relais)?.fini ?? false,
    }));
    return [moi, ...autres].sort((a, b) => a.relais - b.relais);
  }

  private vue(): EtatRelais {
    const c = this.course;
    return {
      equipe: this.equipe, epreuve: '4x100', joueurs: this.joueurs(),
      depart_a: this.departA, porteur: c.porteur,
      temoin_d: Math.round(c.temoinD * 10) / 10,
      passes: c.passes, elimine: c.elimine, total: c.total,
      zone: this.maZone,
    };
  }

  private etat() { this.ec.onEtat?.(this.vue()); }

  /* ----------------------------------------------------- la surface */

  connecter() {
    // Asynchrone, comme une vraie salle : l'ecran a fini de poser ses refs.
    setTimeout(() => { if (!this.fermee) this.etat(); }, 0);
  }

  pret(v: boolean) {
    if (this.fermee) return;
    this.pret_ = !!v;
    if (this.pret_ && !this.departA) {
      const maintenant = Date.now();
      this.departA = maintenant + AVANT_DEPART_MS;
      this.course.reinitialiser();
      this.fictifs.reinitialiser(maintenant);
      if (this.maZone) this.course.placer(this.monRelais, this.marque);
      this.finEnvoyee = false;
      this.etat();
      this.ec.onDepart?.(this.departA - Date.now(), this.departA);
      this.minuteur = setInterval(() => this.pas(), PAS_MS);
      return;
    }
    if (!this.departA) this.etat();
  }

  placer(d: number) {
    if (this.departA || this.fermee) return;
    // La marque retenue est celle que la course accepte, bornee a la zone :
    // c'est elle que la piste dessine et d'ou le moteur fait partir le joueur.
    if (this.course.placer(this.monRelais, d)) {
      this.marque = this.course.coureur(this.monRelais).d;
      this.etat();
    }
  }

  msCourse(): number {
    return this.departA ? Date.now() - this.departA : 0;
  }

  position(d: number, c?: number) {
    if (!this.departA || this.course.finie() || this.fermee) return;
    const t = this.msCourse();
    this.fictifs.noterHumain(this.monRelais, d, t);
    const r = this.course.avancer(this.monRelais, d, t, c);
    if (r.elimine) this.eliminer(r.elimine);
  }

  avancer(dAbs: number, c?: number) {
    this.position(dAbs, c);
    if (dAbs >= ARRIVEE) this.terminer();
  }

  terminer() {
    if (this.monRelais !== TAILLE || this.finEnvoyee) return;
    // Retenu seulement si la course l'accepte : une arrivee refusee (le
    // temoin pas encore la, une position en retard) se retente a la position
    // suivante au lieu de laisser la course sans fin.
    this.finEnvoyee = this.fini(this.msCourse());
  }

  /** Vrai quand la course est close, par l'arrivee ou par l'elimination. */
  fini(ms: number): boolean {
    if (this.fermee) return true;
    const r = this.course.terminer(this.monRelais, ms, this.msCourse());
    if (r.elimine) { this.eliminer(r.elimine); return true; }
    if (r.total != null) { this.finir(); return true; }
    return false;
  }

  /**
   * Ma tape. Mon partenaire fictif tend la main avec moi s'il est a portee,
   * et c'est la course qui juge : LE PASSAGE HORS ZONE ELIMINE, MEME SEUL
   * (l'auteur, 14/11/2026). Voir Fictifs.tapeHumaine.
   */
  temoin() {
    if (!this.departA || this.course.finie() || this.fermee) return;
    const r = this.fictifs.tapeHumaine(this.monRelais, Date.now());
    if (r) this.traiterTape(r);
  }

  fauxDepart() {
    if (this.monRelais === 1 && !this.fermee) {
      const el = this.course.eliminer('faux depart', 1);
      if (el) this.eliminer(el);
    }
  }

  /** Ou chaque receveur pose sa marque d'elan, pour la dessiner sur la piste. */
  marquesElan(): { relais: number; d: number }[] {
    const m = this.fictifs.marquesElan() as { relais: number; d: number }[];
    if (this.monRelais > 1) m.push({ relais: this.monRelais, d: this.marque - ELAN });
    return m.sort((a, b) => a.relais - b.relais);
  }

  /**
   * Fermer pour de bon. Les ecouteurs sont coupes : un etat tardif (le
   * `connecter` differe, un double montage en mode strict) ne doit plus
   * toucher le moteur — il y deplacerait le temoin d'une course finie.
   */
  fermer() {
    this.fermee = true;
    this.arreter();
    this.ec = {};
  }

  /* --------------------------------------------- le cours de la course */

  private arreter() {
    if (this.minuteur) clearInterval(this.minuteur);
    this.minuteur = null;
  }

  private eliminer(el: { raison: string; relais: number }) {
    this.arreter();
    this.ec.onElimine?.(el.raison, el.relais);
    this.etat();
  }

  private finir() {
    this.arreter();
    const v = this.vue();
    this.ec.onFini?.(this.course.total, v);
    this.etat();
  }

  private traiterTape(r: any) {
    if (r.tropLoin) { this.ec.onTropLoin?.(r.tropLoin); return; }
    if (r.elimine) { this.eliminer(r.elimine); return; }
    if (r.passe) {
      this.ec.onPasse?.(r.passe, this.vue());
      this.etat();
    }
  }

  private pas() {
    if (!this.departA || this.fermee) { this.arreter(); return; }
    this.fictifs.pas(Date.now(), this.departA, {
      pos: (relais: number, d: number, t: number) => this.ec.onPos?.(relais, d, t),
      passe: (p: any) => { this.ec.onPasse?.(p, this.vue()); this.etat(); },
      elimine: (el: any) => this.eliminer(el),
      fini: () => this.finir(),
    });
  }
}
