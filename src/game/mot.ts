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

/* ------------------------------------------------------------ le format
   Un enregistrement doit pouvoir etre JOUE PAR L'AUTRE, et c'est tout ce qui
   compte ici. MediaRecorder rend ce que l'appareil sait produire : de l'Opus
   dans un conteneur WebM sur Android, du MP4/AAC sur iPhone. Les deux se
   relisent chez soi — d'ou un enregistrement qui semble parfait a qui le fait
   — mais Safari ne lit pas le WebM. Une voix enregistree sur Android arrivait
   donc muette sur un iPhone, sans message, sans erreur : le bouton se pressait
   et il ne se passait rien.

   On reencode donc en WAV avant l'envoi. C'est le seul format qu'aucun
   navigateur ne refuse, parce qu'il n'y a rien a decoder : ce sont les
   echantillons, tels quels. Huit kilohertz en mono, seize bits — la qualite du
   telephone, ce qui est exactement ce qu'il faut pour six secondes de
   chambrage, et ce qui garde le fichier sous les cent kilooctets.

   Si la conversion echoue — un navigateur sans AudioContext, un decodage qui
   refuse — on envoie l'original plutot que rien : mal lu par certains vaut
   mieux que perdu pour tous. */

/** Huit kilohertz : la bande passante d'un telephone, et elle suffit. */
const WAV_HZ = 8000;

function wav(pcm: Float32Array, hz: number): Blob {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);              // PCM, sans compression
  v.setUint16(22, 1, true);              // mono
  v.setUint32(24, hz, true);
  v.setUint32(28, hz * 2, true);         // octets par seconde
  v.setUint16(32, 2, true);              // octets par echantillon
  v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // Le clip protege de la saturation : un echantillon hors bornes repasse
    // de l'autre cote du nombre signe et claque dans l'oreille.
    const e = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, e < 0 ? e * 0x8000 : e * 0x7FFF, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Melange les canaux et reechantillonne, sans dependre d'un OfflineContext
 *  dont le constructeur refuse encore 8000 Hz sur certains navigateurs. */
function versMono8k(b: AudioBuffer): Float32Array {
  const src = b.getChannelData(0);
  const n2 = b.numberOfChannels > 1 ? b.getChannelData(1) : null;
  const pas = b.sampleRate / WAV_HZ;
  const sortie = new Float32Array(Math.max(1, Math.floor(b.length / pas)));
  for (let i = 0; i < sortie.length; i++) {
    // Moyenne du bloc plutot que le seul echantillon le plus proche : sans
    // elle, reduire de 48 kHz a 8 kHz laisse un crepitement metallique.
    const d = Math.floor(i * pas), f = Math.min(b.length, Math.floor((i + 1) * pas));
    let somme = 0, compte = 0;
    for (let j = d; j < f; j++) {
      somme += n2 ? (src[j] + n2[j]) / 2 : src[j];
      compte++;
    }
    sortie[i] = compte ? somme / compte : 0;
  }
  return sortie;
}

/** Le meme enregistrement, en WAV lisible partout. L'original en cas d'echec. */
export async function enWav(b: Blob): Promise<Blob> {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return b;
    const ctx = new Ctx();
    try {
      const donnees = await b.arrayBuffer();
      const audio: AudioBuffer = await new Promise((ok, non) => {
        // La forme a rappels est la seule que Safari accepte pour un contexte
        // qui n'a pas ete demarre par un geste.
        const p = (ctx as AudioContext).decodeAudioData(donnees, ok, non);
        if (p && typeof (p as any).then === 'function') (p as any).then(ok, non);
      });
      if (!audio || !audio.length) return b;
      return wav(versMono8k(audio), WAV_HZ);
    } finally {
      try { await (ctx as AudioContext).close(); } catch { /* deja fermee */ }
    }
  } catch {
    return b;
  }
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
      const brut = new Blob(this.morceaux, { type: this.rec?.mimeType || 'audio/webm' });
      this.rendreLeMicro();
      if (!brut.size) { this.blob = null; this.dire('repos'); return; }
      // On garde l'original sous la main le temps de la conversion : l'ecoute
      // de controle doit repondre tout de suite, meme sur un vieux telephone
      // qui met une seconde a reencoder.
      this.blob = brut;
      this.dire('prete');
      enWav(brut).then(w => { if (this.blob === brut) this.blob = w; });
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
