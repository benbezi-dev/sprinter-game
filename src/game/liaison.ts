// La liaison avec une salle : la socket, et l'heure.
//
// Trois salles vivent dans ce jeu — le duel en direct, le relais d'une equipe,
// la confrontation de plusieurs — et elles n'ont en commun ni leur etat, ni
// leur protocole. Elles ont en commun ceci, qui n'est pas rien : une WebSocket
// qui peut mourir, et un ecart d'horloge a mesurer.
//
// L'ecart merite d'etre a un seul endroit. Tout le jeu se cale sur des dates
// absolues annoncees par le serveur — le coup de pistolet, la fin d'un
// decompte — et deux telephones ne sont pas d'accord sur l'heure a la seconde
// pres. Se tromper d'estimation ne casse rien de visible : cela fait juste
// partir quelqu'un un peu avant les autres, ce qui est le genre de defaut
// qu'on ne diagnostique jamais depuis une capture d'ecran.

/** Combien de mesures avant de s'arreter, et a quel rythme. */
const PINGS = 4;
const PERIODE_MS = 700;

export class Liaison {
  private ws: WebSocket | null = null;
  private timer: any = null;
  private restants = 0;
  private meilleur = Infinity;
  /** Temps serveur moins temps local, en millisecondes. */
  decalage = 0;

  constructor(
    private url: string,
    private ec: {
      onMessage: (m: any) => void;
      onOuvert?: () => void;
      onFerme?: (raison: string) => void;
    },
  ) {}

  ouvrir() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.restants = PINGS;
      this.meilleur = Infinity;
      this.mesurer();
      this.timer = setInterval(() => this.mesurer(), PERIODE_MS);
      this.ec.onOuvert?.();
    };
    ws.onmessage = ev => {
      let m: any;
      try { m = JSON.parse(ev.data); } catch { return; }
      // Le pong ne remonte jamais : c'est de la mecanique d'horloge, pas du
      // jeu, et l'appelant n'a rien a en faire.
      if (m && m.t === 'pong') { this.noter(m); return; }
      this.ec.onMessage(m);
    };
    ws.onerror = () => this.ec.onFerme?.('reseau');
    ws.onclose = () => { clearInterval(this.timer); this.ec.onFerme?.('fermee'); };
  }

  private mesurer() {
    if (this.restants-- <= 0) { clearInterval(this.timer); this.timer = null; return; }
    this.envoyer({ t: 'ping', a: Date.now() });
  }

  /**
   * L'ecart, estime sur l'aller-retour le plus rapide.
   *
   * On ne fait pas la moyenne : un aller-retour lent est lent d'un cote ou de
   * l'autre, et on ne sait pas duquel — l'estimation qu'il donne est donc
   * fausse d'autant. Le plus rapide des quatre est celui ou le trajet a le
   * plus de chances d'avoir ete symetrique.
   */
  private noter(m: any) {
    const aller = Date.now() - m.a;
    if (aller >= this.meilleur) return;
    this.meilleur = aller;
    this.decalage = m.serveur - (m.a + aller / 2);
  }

  /** L'heure du serveur, telle qu'on l'estime ici. */
  maintenant() { return Date.now() + this.decalage; }

  envoyer(o: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
    } catch { /* onclose previendra */ }
  }

  fermer() {
    clearInterval(this.timer);
    this.timer = null;
    try { this.ws?.close(); } catch { /* deja fermee */ }
    this.ws = null;
  }
}
