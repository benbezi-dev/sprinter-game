// Course en direct — deux joueurs, une piste, en meme temps.
//
// Le defi differe fait courir contre une trace : on rattrape quelqu'un qui a
// deja fini. Ici l'adversaire court pendant qu'on court, personne ne connait
// l'issue, et c'est ce qui change tout.
//
// Trois problemes a resoudre, dans l'ordre d'importance :
//
// 1. Partir ensemble. Le serveur n'envoie pas un « partez » — il annonce une
//    date. Chaque joueur mesure son decalage d'horloge avec la salle et
//    declenche son propre depart a l'instant voulu. Un signal diffuse
//    arriverait avec la latence de chacun ; une date, non.
// 2. Voir l'autre bouger sans a-coups. Les positions arrivent dix fois par
//    seconde ; le moteur dessine soixante images. L'interpolation se fait
//    cote moteur (voir stepGhost), ici on ne fait que transmettre.
// 3. Ne pas mentir. Le chrono est calcule par le client — c'est inevitable,
//    la physique tourne chez lui. Le serveur borne ce qu'il accepte.

import { getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export type JoueurSalle = {
  id: string; nom: string; pret: boolean; d: number;
  fin: number | null; hote: boolean;
};

export type EtatSalle = {
  joueurs: JoueurSalle[];
  epreuves: string[] | null;
  niveau: number;
  depart_a: number | null;
  termine: boolean;
};

export type ResultatDirect = {
  issue: 'challenger' | 'opponent' | 'draw';
  hote: { id: string; nom: string; ms: number };
  invite: { id: string; nom: string; ms: number };
};

type Ecouteurs = {
  onEtat?: (e: EtatSalle) => void;
  onDepart?: (dansMs: number) => void;
  onPos?: (d: number) => void;
  onFini?: (nom: string, ms: number, abandon: boolean) => void;
  onResultat?: (r: ResultatDirect) => void;
  onSorti?: (nom: string) => void;
  onFerme?: (raison: string) => void;
};

/** Demande un code de salle au serveur : meme alphabet que les defis. */
export async function ouvrirSalle(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/live/nouveau`, { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()).id || null;
  } catch {
    return null;
  }
}

/** La salle existe-t-elle, et reste-t-il une place ? */
export async function etatSalle(code: string) {
  try {
    const res = await fetch(`${API_BASE}/live/${encodeURIComponent(code)}/etat`);
    if (!res.ok) return null;
    return await res.json() as EtatSalle & { existe: boolean; complete: boolean };
  } catch {
    return null;
  }
}

export class Salle {
  private ws: WebSocket | null = null;
  private ec: Ecouteurs;
  /** Decalage entre l'horloge de la salle et la notre, en millisecondes. */
  private decalage = 0;
  private pings = 0;
  private timerPing: any = null;
  private departPose = false;
  moi = '';
  code: string;
  suisHote = false;
  adversaire = '';

  constructor(code: string, ec: Ecouteurs) {
    this.code = code.toUpperCase();
    this.ec = ec;
  }

  connecter(epreuves: string[], niveau: number) {
    const q = new URLSearchParams({
      name: getSavedName() || 'Anonyme',
      races: epreuves.join(','),
      level: String(niveau),
    });
    const ws = new WebSocket(`${WS_BASE}/live/${this.code}?${q}`);
    this.ws = ws;

    ws.onopen = () => {
      // Trois mesures d'horloge d'affilee : on garde la meilleure, celle dont
      // l'aller-retour a ete le plus court. Une mesure isolee peut tomber sur
      // un hoquet du reseau et decaler le depart de tout le monde.
      this.pings = 0;
      this.meilleur = Infinity;
      this.ping();
      this.timerPing = setInterval(() => this.ping(), 700);
    };

    ws.onmessage = ev => this.recu(ev.data);
    ws.onerror = () => this.ec.onFerme?.('reseau');
    ws.onclose = () => {
      clearInterval(this.timerPing);
      this.ec.onFerme?.('fermee');
    };
  }

  private meilleur = Infinity;

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
        this.suisHote = (m.joueurs || []).some((j: JoueurSalle) => j.id === m.moi && j.hote);
        this.majEtat(m);
        return;
      case 'salle':
        this.majEtat(m);
        return;
      case 'pos':
        this.ec.onPos?.(m.d);
        return;
      case 'fini':
        this.ec.onFini?.(m.nom, m.ms, !!m.abandon);
        return;
      case 'sorti':
        this.ec.onSorti?.(m.nom);
        this.majEtat(m);
        return;
      case 'resultat':
        this.departPose = false;
        this.ec.onResultat?.(m as ResultatDirect);
        return;
    }
  }

  private majEtat(m: any) {
    const autre = (m.joueurs || []).find((j: JoueurSalle) => j.id !== this.moi);
    this.adversaire = autre ? autre.nom : '';
    this.ec.onEtat?.(m as EtatSalle);
    if (m.depart_a && !this.departPose) {
      this.departPose = true;
      // Le depart est une date, pas un signal : on la ramene dans notre
      // propre horloge et on laisse le jeu compter tout seul.
      this.ec.onDepart?.(m.depart_a - (Date.now() + this.decalage));
    }
    if (!m.depart_a) this.departPose = false;
  }

  private envoyer(o: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(o));
      }
    } catch {
      // socket morte : onclose previendra
    }
  }

  pret(v: boolean) { this.envoyer({ t: 'pret', pret: v }); }
  position(d: number) { this.envoyer({ t: 'pos', d }); }
  fini(ms: number) { this.envoyer({ t: 'fini', ms: Math.round(ms) }); }
  abandon() { this.envoyer({ t: 'abandon' }); }

  fermer() {
    clearInterval(this.timerPing);
    try { this.ws?.close(); } catch { /* deja fermee */ }
    this.ws = null;
  }
}

/** Le lien a partager pour rejoindre une salle. */
export function lienSalle(code: string): string {
  const u = new URL(window.location.href);
  u.search = `?direct=${encodeURIComponent(code)}`;
  u.hash = '';
  return u.toString();
}

/** Un lien ?direct=CODE ouvre directement la salle correspondante. */
export function codeDirectUrl(): string {
  try {
    const v = new URL(window.location.href).searchParams.get('direct') || '';
    return /^[A-Za-z0-9]{4,10}$/.test(v) ? v.toUpperCase() : '';
  } catch {
    return '';
  }
}

export function nettoyerUrlDirect() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('direct')) return;
    u.searchParams.delete('direct');
    window.history.replaceState({}, '', u.toString());
  } catch {
    // pas d'historique : l'URL restera, sans consequence
  }
}
