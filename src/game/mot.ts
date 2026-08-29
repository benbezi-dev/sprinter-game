// Le mot du vainqueur, cote jeu.
//
// Six secondes de voix, ou cent quarante caracteres. Le serveur reverifie tout
// ce qui suit — un client peut mentir sur la duree comme sur la taille — mais
// les bornes vivent aussi ici, parce qu'une limite qu'on decouvre au refus est
// une limite mal posee.

import { getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export const MAX_TEXTE = 140;
/** Six secondes. Au-dela ce n'est plus une pique, c'est un discours. */
export const MAX_VOIX_MS = 6000;

export type MotPose = { ok?: true; texte?: string | null; voix?: boolean; error?: string };

/** Depose le mot. Seul le vainqueur y est autorise, et une seule fois. */
export async function poserMot(
  id: string, m: { texte?: string; voix?: Blob | null },
): Promise<MotPose> {
  try {
    const corps: any = { id, name: getSavedName() || '' };
    if (m.texte) corps.texte = m.texte.slice(0, MAX_TEXTE);
    if (m.voix) {
      corps.voix = await enBase64(m.voix);
      corps.voix_type = m.voix.type || 'audio/webm';
    }
    const r = await fetch(`${API_BASE}/duel/mot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: (d && d.error) || 'refus du serveur' };
    return d as MotPose;
  } catch {
    return { error: 'reseau' };
  }
}

/**
 * Le blob en base64, sans son prefixe.
 *
 * `FileReader` rend une URL de donnees complete — « data:audio/webm;base64,… »
 * — et le serveur n'accepte que la partie encodee : le type voyage a part,
 * verifie contre une liste, plutot que recopie depuis une chaine que le client
 * fabrique.
 */
function enBase64(b: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const l = new FileReader();
    l.onerror = () => rejeter(new Error('lecture'));
    l.onload = () => {
      const s = String(l.result || '');
      resoudre(s.slice(s.indexOf(',') + 1));
    };
    l.readAsDataURL(b);
  });
}

/** Une URL jouable a partir de ce que le serveur a renvoye. */
export function urlDeLaVoix(b64: string, type: string): string {
  const brut = atob(b64);
  const o = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) o[i] = brut.charCodeAt(i);
  return URL.createObjectURL(new Blob([o], { type: type || 'audio/webm' }));
}

export type EtatVoix = 'repos' | 'demande' | 'enregistre' | 'prete' | 'refuse';

/**
 * L'enregistrement d'un mot vocal.
 *
 * Le micro se rend des que l'enregistrement s'arrete, et pas au demontage du
 * composant : le voyant du telephone doit s'eteindre quand on lache le bouton,
 * pas quand React voudra bien s'en apercevoir. C'est la meme regle que pour la
 * voix des courses en direct, et elle vaut d'etre repetee — un micro qui reste
 * allume sans raison visible est ce qui fait desinstaller une application.
 */
export class Enregistreur {
  private flux: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private morceaux: Blob[] = [];
  private minuteur: any = null;
  etat: EtatVoix = 'repos';
  blob: Blob | null = null;

  constructor(private sur: (e: EtatVoix, ms: number) => void) {}

  private dire(e: EtatVoix, ms = 0) { this.etat = e; this.sur(e, ms); }

  async demarrer() {
    if (this.etat === 'enregistre') return;
    this.dire('demande');
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.dire('refuse');
      return;
    }
    this.morceaux = [];
    this.blob = null;
    try {
      this.rec = new MediaRecorder(this.flux, choisirType());
    } catch {
      this.rec = new MediaRecorder(this.flux);
    }
    this.rec.ondataavailable = ev => { if (ev.data && ev.data.size) this.morceaux.push(ev.data); };
    this.rec.onstop = () => {
      this.blob = new Blob(this.morceaux, { type: this.rec?.mimeType || 'audio/webm' });
      this.rendreLeMicro();
      this.dire(this.blob.size > 0 ? 'prete' : 'repos');
    };
    this.rec.start();
    const debut = Date.now();
    this.dire('enregistre', 0);
    // Le compte a rebours sert a l'affichage, la coupure a la regle : six
    // secondes sont six secondes, meme si personne ne regarde l'ecran.
    this.minuteur = setInterval(() => {
      const t = Date.now() - debut;
      if (t >= MAX_VOIX_MS) { this.arreter(); return; }
      this.sur('enregistre', t);
    }, 100);
  }

  arreter() {
    clearInterval(this.minuteur);
    this.minuteur = null;
    try { this.rec?.state === 'recording' && this.rec.stop(); } catch { /* deja arrete */ }
    if (!this.rec) this.rendreLeMicro();
  }

  /** Jeter ce qui a ete enregistre, et rendre le micro s'il est encore pris. */
  jeter() {
    this.arreter();
    this.morceaux = [];
    this.blob = null;
    this.rendreLeMicro();
    this.dire('repos');
  }

  private rendreLeMicro() {
    try { this.flux?.getTracks().forEach(t => t.stop()); } catch { /* deja rendu */ }
    this.flux = null;
  }
}

/**
 * Le format que ce navigateur sait produire.
 *
 * Opus dans un conteneur WebM partout, sauf sur iOS ou seul MP4 sort. On teste
 * plutot que de deviner d'apres le navigateur : la liste des formats change
 * plus souvent que le code.
 */
function choisirType(): MediaRecorderOptions {
  const essais = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const t of essais) {
    try { if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, audioBitsPerSecond: 32000 }; }
    catch { /* navigateur sans isTypeSupported */ }
  }
  return {};
}
