// La video de la course, enregistree chez le joueur et perissable.
//
// Rien de tout ceci ne passe par un serveur, et ce n'est pas un raccourci :
// l'infrastructure du jeu est faite de Workers Cloudflare, qui ne peuvent pas
// encoder de video, et d'une base D1, qui n'est pas un stockage de media. La
// seule machine capable de produire ce fichier est celle qui a dessine la
// course — le navigateur du joueur, image par image, sur son propre canvas.
//
// La duree de vie de dix minutes se tient donc toute seule, sans tache de
// nettoyage a planifier nulle part : le fichier vit dans la memoire de l'onglet,
// un minuteur le libere, et il disparait aussi si le joueur ferme la page. Ce
// que l'utilisateur a telecharge, en revanche, est sorti de l'application et ne
// nous appartient plus — c'est un fichier a lui, sur son appareil, que rien
// ici ne peut ni ne doit effacer.

/** Dix minutes, comme demande. Au-dela, le bouton s'eteint. */
export const TTL_MS = 10 * 60 * 1000;

export type PhaseReview = 'inactif' | 'enregistre' | 'prete' | 'expiree' | 'impossible';

export type EtatReview = {
  phase: PhaseReview;
  url: string | null;
  fichier: string;
  /** Millisecondes restantes avant suppression. */
  reste: number;
  /** Taille du fichier, en octets. */
  taille: number;
};

/**
 * Les formats, du plus souhaitable au plus tolere.
 *
 * MP4 d'abord parce que c'est le seul que les appareils Apple savent relire
 * partout une fois telecharge : un WebM sauve depuis un iPhone finit dans la
 * pellicule sans pouvoir s'ouvrir, ce qui est pire que pas de video du tout.
 */
const FORMATS = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function choisirFormat(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const f of FORMATS) {
    try { if (MediaRecorder.isTypeSupported(f)) return f; } catch { /* suivant */ }
  }
  return null;
}

export class Review {
  private rec: MediaRecorder | null = null;
  private morceaux: Blob[] = [];
  private url: string | null = null;
  private expireA = 0;
  private battement: any = null;
  private format = '';
  private onEtat: (e: EtatReview) => void;

  private etat: EtatReview = {
    phase: 'inactif', url: null, fichier: 'sprinter.mp4', reste: 0, taille: 0,
  };

  constructor(onEtat: (e: EtatReview) => void) { this.onEtat = onEtat; }

  /** L'appareil sait-il enregistrer son propre canvas ? */
  static supporte(): boolean {
    return typeof MediaRecorder !== 'undefined' &&
           typeof HTMLCanvasElement !== 'undefined' &&
           typeof (HTMLCanvasElement.prototype as any).captureStream === 'function' &&
           !!choisirFormat();
  }

  private prevenir(p: Partial<EtatReview>) {
    this.etat = { ...this.etat, ...p };
    this.onEtat(this.etat);
  }

  /**
   * Commence a filmer le canvas.
   *
   * On ne capture que la course : c'est la sequence la plus courte, la plus
   * legere a encoder, et celle qui a le plus de chances d'aboutir sur un
   * telephone. Un enregistrement qui tourne longtemps finit par voler des
   * images a la course elle-meme, ce qu'on ne peut pas se permettre dans un
   * jeu ou l'on compte en centiemes.
   */
  demarrer(canvas: HTMLCanvasElement | null) {
    if (!canvas) return;
    const format = choisirFormat();
    if (!format) { this.prevenir({ phase: 'impossible' }); return; }
    this.jeter();

    try {
      const flux = (canvas as any).captureStream(30) as MediaStream;
      this.format = format;
      this.morceaux = [];
      this.rec = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 2_500_000 });
      this.rec.ondataavailable = ev => { if (ev.data && ev.data.size) this.morceaux.push(ev.data); };
      this.rec.onerror = () => this.prevenir({ phase: 'impossible' });
      this.rec.start(1000);
      this.prevenir({ phase: 'enregistre', url: null, taille: 0, reste: 0 });
    } catch {
      this.prevenir({ phase: 'impossible' });
    }
  }

  /** Arrete la capture et publie le fichier. Demarre le compte a rebours. */
  arreter(): Promise<void> {
    return new Promise(resolve => {
      const r = this.rec;
      if (!r || r.state === 'inactive') { resolve(); return; }
      r.onstop = () => {
        this.rec = null;
        if (!this.morceaux.length) { this.prevenir({ phase: 'impossible' }); resolve(); return; }
        const blob = new Blob(this.morceaux, { type: this.format });
        this.morceaux = [];
        this.url = URL.createObjectURL(blob);
        this.expireA = Date.now() + TTL_MS;
        const ext = this.format.startsWith('video/mp4') ? 'mp4' : 'webm';
        const jour = new Date().toISOString().slice(0, 10);
        this.prevenir({
          phase: 'prete', url: this.url, taille: blob.size,
          fichier: `sprinter-${jour}.${ext}`, reste: TTL_MS,
        });
        this.battre();
        resolve();
      };
      try { r.stop(); } catch { this.rec = null; resolve(); }
    });
  }

  /**
   * Le compte a rebours, et la suppression au bout.
   *
   * Elle est inconditionnelle : que le joueur ait telecharge ou non ne change
   * rien, comme demande. On revoque l'URL, ce qui rend le lien inutilisable et
   * laisse le navigateur liberer la memoire du blob.
   */
  private battre() {
    clearInterval(this.battement);
    this.battement = setInterval(() => {
      const reste = this.expireA - Date.now();
      if (reste <= 0) { this.expirer(); return; }
      this.prevenir({ reste });
    }, 1000);
  }

  private expirer() {
    clearInterval(this.battement);
    this.battement = null;
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch { /* ignore */ } }
    this.url = null;
    this.prevenir({ phase: 'expiree', url: null, reste: 0 });
  }

  /**
   * Declenche le telechargement.
   *
   * A partir de la, le fichier appartient a l'utilisateur : il est sorti de
   * l'onglet, et l'expiration ci-dessus ne le concerne plus.
   */
  telecharger() {
    if (!this.url || this.etat.phase !== 'prete') return;
    const a = document.createElement('a');
    a.href = this.url;
    a.download = this.etat.fichier;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Libere tout, sans attendre l'expiration. */
  jeter() {
    clearInterval(this.battement);
    this.battement = null;
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch { /* ignore */ }
    this.rec = null;
    this.morceaux = [];
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch { /* ignore */ } }
    this.url = null;
    this.expireA = 0;
    this.prevenir({ phase: 'inactif', url: null, reste: 0, taille: 0 });
  }
}

/** « 4:07 » a partir d'un reste en millisecondes. */
export function compteARebours(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
