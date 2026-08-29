// La salle de relais, vue du jeu.
//
// Quatre joueurs, un temoin, une seule course. Ce qui la distingue du duel en
// direct n'est pas le nombre : c'est que le temoin passe de main en main, et
// qu'un passage rate elimine toute l'equipe. Personne ne peut donc arbitrer
// chez lui — c'est la salle qui date les deux tapes sur SA propre horloge,
// verifie la geometrie, et tranche.
//
// Le client ne decide de rien. Il annonce sa position, sa marque, sa tape, et
// son chrono final ; tout le reste lui revient.

import { getSavedName } from './leaderboard';
import { avecAcces, codeAcces, EST_TEST } from './canal';
import { Liaison } from './liaison';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export type JoueurRelais = {
  id: string; nom: string; relais: number;
  pret: boolean; d: number; fini: boolean;
};

/** La zone de lancement d'un relayeur : trente metres, transmission comprise. */
export type Zone = { debut: number; fin: number };

export type EtatRelais = {
  equipe: string;
  epreuve: string;
  joueurs: JoueurRelais[];
  depart_a: number | null;
  /** Le relayeur qui porte le temoin en ce moment, de 1 a 4. */
  porteur: number;
  temoin_d: number;
  passes: { de: number; vers: number; a: number; note: number }[];
  elimine: { raison: string; relais: number } | null;
  total: number | null;
  /** Ma zone, envoyee a l'accueil. Le premier relayeur n'en a pas. */
  zone?: Zone | null;
};

type Ecouteurs = {
  onEtat?: (e: EtatRelais) => void;
  onDepart?: (dansMs: number) => void;
  /** Position d'un coequipier, par son rang de relais. */
  onPos?: (relais: number, d: number) => void;
  /** Le temoin est passe : note de 0 a 2, du rate au parfait. */
  onPasse?: (p: { de: number; vers: number; note: number }, e: EtatRelais) => void;
  onElimine?: (raison: string, relais: number) => void;
  onFini?: (totalMs: number, e: EtatRelais) => void;
  onFerme?: (raison: string) => void;
};

/** Un relais fait cent metres, et la course entiere quatre cents. */
export const LEG = 100;
export const TAILLE = 4;
export const ARRIVEE = LEG * TAILLE;

export class SalleRelais {
  private lien: Liaison | null = null;
  private ec: Ecouteurs;
  private departPose = false;
  private finEnvoyee = false;
  moi = '';
  /** Mon rang de relais, de 1 a 4. Connu des l'accueil. */
  monRelais = 0;
  maZone: Zone | null = null;
  equipe: string;
  /** Le coup de pistolet, en temps serveur. Nul tant qu'il n'est pas annonce. */
  departA: number | null = null;
  /**
   * Ou je commence, en metres absolus.
   *
   * Le moteur de jeu ne connait qu'une piste de cent metres et compte de zero :
   * il ignore qu'il joue le troisieme relais. C'est ici que les deux mondes se
   * rejoignent — la salle raisonne en metres absolus depuis le depart, parce
   * que les zones et l'arrivee y sont definies, et le jeu en metres parcourus.
   */
  marque = 0;

  constructor(equipe: string, ec: Ecouteurs) {
    this.equipe = equipe.toUpperCase();
    this.ec = ec;
  }

  connecter() {
    // Meme regle que le duel en direct : sans code, on ne part pas. Une salle
    // de test et une salle de production portant le meme code sont deux objets
    // distincts, et partir sans code menerait a la mauvaise piste.
    if (EST_TEST && !codeAcces()) { this.ec.onFerme?.('acces'); return; }
    const q = new URLSearchParams({ name: getSavedName() || 'Anonyme' });
    this.lien = new Liaison(avecAcces(`${WS_BASE}/relay/room/${this.equipe}?${q}`), {
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
        this.monRelais = (m.joueurs || []).find((j: JoueurRelais) => j.id === m.moi)?.relais || 0;
        this.marque = this.maZone ? this.maZone.debut : (this.monRelais - 1) * LEG;
        this.majEtat(m);
        return;
      case 'salle':
        this.majEtat(m);
        return;
      case 'pos':
        this.ec.onPos?.(m.relais, m.d);
        return;
      case 'passe':
        this.ec.onPasse?.({ de: m.de, vers: m.vers, note: m.note }, m as EtatRelais);
        this.majEtat(m);
        return;
      case 'elimine':
        this.departPose = false;
        this.ec.onElimine?.(m.raison, m.relais);
        this.majEtat(m);
        return;
      case 'fini':
        this.departPose = false;
        this.ec.onFini?.(m.total, m as EtatRelais);
        this.majEtat(m);
        return;
      case 'sorti':
        this.majEtat(m);
        return;
    }
  }

  private majEtat(m: any) {
    this.departA = m.depart_a ?? null;
    this.ec.onEtat?.(m as EtatRelais);
    if (m.depart_a && !this.departPose) {
      this.departPose = true;
      this.finEnvoyee = false;
      // Comme partout : une date, pas un signal. Chacun compte chez lui.
      this.ec.onDepart?.(m.depart_a - this.maintenant());
    }
    if (!m.depart_a) this.departPose = false;
  }

  /**
   * Depuis combien de temps l'equipe court, en temps serveur.
   *
   * Le chrono d'un relais n'est pas la somme de quatre chronos : c'est
   * l'instant ou le quatrieme franchit la ligne, compte depuis le coup de
   * pistolet. Le dernier relayeur ne peut donc pas envoyer SON temps de course,
   * qui ne vaudrait que ses cent metres a lui.
   */
  msCourse(): number {
    if (!this.departA) return 0;
    return this.maintenant() - this.departA;
  }

  /** L'heure du serveur, telle que la liaison l'estime. */
  private maintenant() { return this.lien ? this.lien.maintenant() : Date.now(); }

  private envoyer(o: any) { this.lien?.envoyer(o); }

  pret(v: boolean) { this.envoyer({ t: 'pret', pret: v }); }
  /** Placer sa marque dans sa zone, avant le depart. */
  placer(d: number) { this.marque = d; this.envoyer({ t: 'marque', d }); }
  position(d: number) { this.envoyer({ t: 'pos', d }); }

  /**
   * Le moteur a avance : ce que la salle doit en savoir.
   *
   * La distance arrive deja en metres absolus depuis le depart — le jeu court
   * la piste du 4x100, un tour complet, et le relayeur y est pose a sa marque.
   * Il n'y a donc rien a traduire, et c'est le seul arrangement qui tienne :
   * une portion posee sur une piste de cent metres aurait fait franchir au
   * troisieme relayeur une ligne d'arrivee au trois cent quinzieme metre.
   */
  avancer(dAbs: number) {
    this.position(dAbs);
    if (dAbs >= ARRIVEE) this.terminer();
  }

  /**
   * La ligne, franchie par le dernier.
   *
   * Le chrono envoye est celui de l'EQUIPE, compte depuis le coup de pistolet,
   * et non le temps de course du quatrieme — qui ne vaudrait que sa portion.
   * Le serveur refuse d'ailleurs tout ce qui sort de dix secondes a dix
   * minutes : un temps de portion serait rejete en silence, et la course
   * disparaitrait sans un mot.
   */
  terminer() {
    if (this.monRelais !== TAILLE || this.finEnvoyee) return;
    this.finEnvoyee = true;
    this.fini(this.msCourse());
  }
  /** Taper. Le donneur et le receveur doivent taper presque en meme temps. */
  temoin() { this.envoyer({ t: 'temoin' }); }
  fauxDepart() { this.envoyer({ t: 'faux_depart' }); }
  fini(ms: number) { this.envoyer({ t: 'fini', ms: Math.round(ms) }); }

  fermer() { this.lien?.fermer(); this.lien = null; }
}
