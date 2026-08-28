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

export class SalleRelais {
  private ws: WebSocket | null = null;
  private ec: Ecouteurs;
  private decalage = 0;
  private pings = 0;
  private meilleur = Infinity;
  private timerPing: any = null;
  private departPose = false;
  moi = '';
  /** Mon rang de relais, de 1 a 4. Connu des l'accueil. */
  monRelais = 0;
  maZone: Zone | null = null;
  equipe: string;

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
    const ws = new WebSocket(avecAcces(`${WS_BASE}/relay/room/${this.equipe}?${q}`));
    this.ws = ws;
    ws.onopen = () => {
      this.pings = 0; this.meilleur = Infinity;
      this.ping();
      this.timerPing = setInterval(() => this.ping(), 700);
    };
    ws.onmessage = ev => this.recu(ev.data);
    ws.onerror = () => this.ec.onFerme?.('reseau');
    ws.onclose = () => { clearInterval(this.timerPing); this.ec.onFerme?.('fermee'); };
  }

  private ping() {
    if (this.pings++ >= 4) { clearInterval(this.timerPing); return; }
    this.envoyer({ t: 'ping', a: Date.now() });
  }

  private recu(brut: string) {
    let m: any;
    try { m = JSON.parse(brut); } catch { return; }
    switch (m.t) {
      case 'pong': {
        const aller = Date.now() - m.a;
        if (aller < this.meilleur) {
          this.meilleur = aller;
          this.decalage = m.serveur - (m.a + aller / 2);
        }
        return;
      }
      case 'bienvenue':
        this.moi = m.moi;
        this.maZone = m.zone || null;
        this.monRelais = (m.joueurs || []).find((j: JoueurRelais) => j.id === m.moi)?.relais || 0;
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
    this.ec.onEtat?.(m as EtatRelais);
    if (m.depart_a && !this.departPose) {
      this.departPose = true;
      // Comme partout : une date, pas un signal. Chacun compte chez lui.
      this.ec.onDepart?.(m.depart_a - (Date.now() + this.decalage));
    }
    if (!m.depart_a) this.departPose = false;
  }

  private envoyer(o: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
    } catch { /* onclose previendra */ }
  }

  pret(v: boolean) { this.envoyer({ t: 'pret', pret: v }); }
  /** Placer sa marque dans sa zone, avant le depart. */
  marque(d: number) { this.envoyer({ t: 'marque', d }); }
  position(d: number) { this.envoyer({ t: 'pos', d }); }
  /** Taper. Le donneur et le receveur doivent taper presque en meme temps. */
  temoin() { this.envoyer({ t: 'temoin' }); }
  fauxDepart() { this.envoyer({ t: 'faux_depart' }); }
  fini(ms: number) { this.envoyer({ t: 'fini', ms: Math.round(ms) }); }

  fermer() {
    clearInterval(this.timerPing);
    try { this.ws?.close(); } catch { /* deja fermee */ }
    this.ws = null;
  }
}
