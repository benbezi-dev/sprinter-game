// La confrontation de relais, vue du jeu.
//
// Une equipe seule court contre le chrono. Deux a huit equipes courent l'une
// contre l'autre, et c'est un autre sport : on voit le temoin d'a cote avancer,
// on sait qu'on est en retard avant l'arrivee, et un passage rate se paie
// devant temoin.
//
// Ce module est le jumeau de salle-relais.ts, et la difference tient en un mot :
// chaque message porte le code de l'equipe a qui il appartient. C'est ce qui
// permet de dessiner huit temoins au lieu d'un — et c'est aussi le seul endroit
// ou l'on peut se tromper de couloir.
//
// Les fantomes n'ont rien de particulier ici. Le serveur les fait avancer et
// annonce leurs positions comme celles de n'importe quelle equipe : de ce cote
// de la socket, une course enregistree et quatre joueurs connectes se
// ressemblent au point de ne pas avoir a etre distingues.

import { getSavedName } from './leaderboard';
import { avecAcces, codeAcces, EST_TEST } from './canal';
import { Liaison } from './liaison';
import { LEG, TAILLE, ARRIVEE, type Zone, type JoueurRelais } from './salle-relais';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export const MIN_EQUIPES = 2;
export const MAX_EQUIPES = 8;

export type PasseRelais = {
  de: number; vers: number; a: number; dans_zone: number;
  ecart: number; note: number;
};

/** Une equipe dans la confrontation, telle que la salle la voit. */
export type EquipeEnCourse = {
  equipe: string;
  nom: string;
  porteur: number;
  temoin_d: number;
  passes: PasseRelais[];
  elimine: { raison: string; relais: number } | null;
  total: number | null;
  coureurs: { relais: number; d: number; fini: boolean }[];
  presents: number;
  prets: number;
  joueurs: JoueurRelais[];
};

export type PlaceConfrontation = {
  place: number | null;
  equipe: string;
  nom: string;
  total: number | null;
  passes?: number[];
  elimine?: { raison: string; relais: number };
};

export type EtatConfrontation = {
  code: string;
  epreuve: string;
  max: number;
  depart_a: number | null;
  equipes: EquipeEnCourse[];
  classement: PlaceConfrontation[];
};

type Ecouteurs = {
  onEtat?: (e: EtatConfrontation) => void;
  onDepart?: (dansMs: number) => void;
  /** Le temoin d'une equipe a bouge. */
  onPos?: (equipe: string, relais: number, d: number) => void;
  onPasse?: (equipe: string, p: PasseRelais) => void;
  onElimine?: (equipe: string, raison: string, relais: number) => void;
  onFini?: (equipe: string, totalMs: number) => void;
  /** Tout le monde a fini, d'une facon ou d'une autre. */
  onTermine?: (e: EtatConfrontation) => void;
  onFerme?: (raison: string) => void;
};

export class SalleConfrontation {
  private lien: Liaison | null = null;
  private ec: Ecouteurs;
  private departPose = false;
  private finEnvoyee = false;
  moi = '';
  monRelais = 0;
  maZone: Zone | null = null;
  marque = 0;
  departA: number | null = null;
  /** Le code de la confrontation, et celui de mon equipe dedans. */
  code: string;
  equipe: string;

  constructor(code: string, equipe: string, ec: Ecouteurs) {
    this.code = code.toUpperCase();
    this.equipe = equipe.toUpperCase();
    this.ec = ec;
  }

  /**
   * @param max      combien d'equipes au plus — le premier arrive le fixe.
   * @param fantomes les courses enregistrees a affronter, par identifiant.
   */
  connecter(max = MAX_EQUIPES, fantomes: number[] = []) {
    if (EST_TEST && !codeAcces()) { this.ec.onFerme?.('acces'); return; }
    const q = new URLSearchParams({
      name: getSavedName() || 'Anonyme',
      team: this.equipe,
      max: String(Math.max(MIN_EQUIPES, Math.min(MAX_EQUIPES, max))),
    });
    if (fantomes.length) q.set('fantomes', fantomes.slice(0, 7).join(','));
    this.lien = new Liaison(avecAcces(`${WS_BASE}/relay/conf/${this.code}?${q}`), {
      onMessage: m => this.recu(m),
      onFerme: r => this.ec.onFerme?.(r),
    });
    this.lien.ouvrir();
  }

  private recu(m: any) {
    switch (m && m.t) {
      case 'bienvenue':
        this.moi = m.moi;
        this.maZone = m.zone || null;
        this.monRelais = m.relais || 0;
        this.marque = this.maZone ? this.maZone.debut : (this.monRelais - 1) * LEG;
        this.majEtat(m);
        return;
      case 'salle':
      case 'sorti':
        this.majEtat(m);
        return;
      // La position ne porte pas d'etat complet : elle arrive dix fois par
      // seconde et par equipe, et rendre toute la salle a chaque fois ferait
      // du bruit dans React sans rien montrer de plus.
      case 'pos':
        this.ec.onPos?.(m.equipe, m.relais, m.d);
        return;
      case 'passe':
        this.ec.onPasse?.(m.equipe, m as PasseRelais);
        this.majEtat(m);
        return;
      case 'elimine':
        this.ec.onElimine?.(m.equipe, m.raison, m.relais);
        this.majEtat(m);
        return;
      case 'fini':
        this.ec.onFini?.(m.equipe, m.total);
        this.majEtat(m);
        return;
      case 'termine':
        this.departPose = false;
        this.majEtat(m);
        this.ec.onTermine?.(m as EtatConfrontation);
        return;
    }
  }

  private majEtat(m: any) {
    this.departA = m.depart_a ?? null;
    if (m.equipes) this.ec.onEtat?.(m as EtatConfrontation);
    if (m.depart_a && !this.departPose) {
      this.departPose = true;
      this.finEnvoyee = false;
      this.ec.onDepart?.(m.depart_a - this.maintenant());
    }
    if (!m.depart_a) this.departPose = false;
  }

  private maintenant() { return this.lien ? this.lien.maintenant() : Date.now(); }
  private envoyer(o: any) { this.lien?.envoyer(o); }

  msCourse(): number {
    if (!this.departA) return 0;
    return this.maintenant() - this.departA;
  }

  /** Mon equipe, dans un etat recu. */
  mienne(e: EtatConfrontation | null): EquipeEnCourse | null {
    return e?.equipes.find(x => x.equipe === this.equipe) || null;
  }

  pret(v: boolean) { this.envoyer({ t: 'pret', pret: v }); }
  placer(d: number) { this.marque = d; this.envoyer({ t: 'marque', d }); }
  position(d: number) { this.envoyer({ t: 'pos', d }); }
  temoin() { this.envoyer({ t: 'temoin' }); }
  fini(ms: number) { this.envoyer({ t: 'fini', ms: Math.round(ms) }); }

  /** Voir salle-relais.ts : le moteur compte deja en metres absolus. */
  avancer(dAbs: number) {
    this.position(dAbs);
    if (dAbs >= ARRIVEE) this.terminer();
  }

  terminer() {
    if (this.monRelais !== TAILLE || this.finEnvoyee) return;
    this.finEnvoyee = true;
    this.fini(this.msCourse());
  }

  fermer() { this.lien?.fermer(); this.lien = null; }
}
