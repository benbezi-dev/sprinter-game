// Le mot du vainqueur, cote jeu.
//
// Six secondes de voix, ou cent quarante caracteres. Le serveur reverifie tout
// ce qui suit — un client peut mentir sur la duree comme sur la taille — mais
// les bornes vivent aussi ici, parce qu'une limite qu'on decouvre au refus est
// une limite mal posee.

import { getSavedName, getDeviceId } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export const MAX_TEXTE = 140;
/** Six secondes. Au-dela ce n'est plus une pique, c'est un discours. */
export const MAX_VOIX_MS = 6000;

export type MotPose = {
  ok?: true; texte?: string | null; voix?: boolean; error?: string;
  /**
   * Pourquoi le filtre du serveur a refuse le texte : 'vide', 'long', 'lien',
   * 'contact', 'grossier'. Absent pour tout autre refus.
   */
  raison?: string;
};

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

/* ------------------------------------------------- la reponse du perdant
   Le perdant ne repond pas par du texte : il choisit une phrase dans une
   liste ecrite par le jeu, et seul son identifiant voyage. Le serveur tient la
   meme liste (worker/src/mot.js, REPONSES) et refuse le reste — les deux se
   modifient ensemble. Les textes vivent dans sprinter-i18n.js, `reponse_r_*`.

   La voix est celle du coureur battu : beau joueur, ou mauvaise foi assumee
   — le vent, l'echauffement, les blocs. Jamais blessant, et jamais une pique
   retournee : on ne chambre pas celui qui vient de gagner, on lui repond. */

/** Les phrases, dans l'ordre ou le choix les presente. */
export const REPONSES = [
  'r_bien', 'r_note', 'r_prochaine', 'r_echauffement', 'r_vent', 'r_blocs',
] as const;
export type Reponse = typeof REPONSES[number];

export function estReponse(q: unknown): q is Reponse {
  return typeof q === 'string' && (REPONSES as readonly string[]).includes(q);
}

const CLE_REPONSES = 'sprinter_reponses';

/**
 * Ce que j'ai deja repondu sur ce duel, depuis cet appareil.
 *
 * Le serveur refuse une seconde reponse ; ce souvenir local sert a ne pas
 * reproposer le choix quand la meme annonce revient — le mot reste a l'ecran
 * tant que la fenetre n'est pas refermee, et parfois au-dela.
 */
export function maReponse(duel: string): Reponse | null {
  try {
    const q = JSON.parse(localStorage.getItem(CLE_REPONSES) || '{}')[duel];
    return estReponse(q) ? q : null;
  } catch { return null; }
}

function retenir(duel: string, q: Reponse) {
  try {
    const m = JSON.parse(localStorage.getItem(CLE_REPONSES) || '{}');
    m[duel] = q;
    // Les cinquante dernieres suffisent : une annonce ne revient pas des mois
    // apres.
    const garde = Object.fromEntries(Object.entries(m).slice(-50));
    localStorage.setItem(CLE_REPONSES, JSON.stringify(garde));
  } catch { /* stockage refuse : le serveur garde la seule verite */ }
}

/**
 * Envoie la reponse du perdant. Une seule fois : un « deja repondu » du
 * serveur compte comme un succes, l'autre l'a deja recue.
 */
export async function repondreAuMot(duel: string, q: Reponse): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/duel/reponse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: duel, reponse: q,
        name: getSavedName() || '', device_id: getDeviceId(),
      }),
    });
    if (r.ok || r.status === 409) { retenir(duel, q); return true; }
    return false;
  } catch {
    return false;
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

/**
 * Depose le mot du vainqueur d'une COURSE DE CHAMPIONNAT.
 *
 * Meme geste que pour un duel, et volontairement la meme fonction d'envoi :
 * seule l'adresse change. Ce qui change vraiment est de l'autre cote — le mot
 * d'un duel va a une personne, celui d'une course va aux sept autres partants,
 * et il reste tant que l'edition existe (voir `champ_mots` dans le worker).
 *
 * Le serveur relit lui-meme qui a gagne : rien de ce qu'on envoie ici ne le
 * convainc d'accepter un mot d'un autre que le vainqueur.
 */
export async function poserMotDeCourse(
  c: { edition: string; phase: string; course: number },
  m: { texte?: string; voix?: Blob | null },
): Promise<MotPose> {
  try {
    // L'appareil voyage avec le nom : le serveur verifie que CE telephone
    // porte bien le nom du vainqueur. Le nom seul se tape sur n'importe quel
    // telephone.
    const corps: any = {
      edition: c.edition, phase: c.phase, course: c.course,
      name: getSavedName() || '', device_id: getDeviceId(),
    };
    if (m.texte) corps.texte = m.texte.slice(0, MAX_TEXTE);
    if (m.voix) {
      corps.voix = await enBase64(m.voix);
      corps.voix_type = m.voix.type || 'audio/webm';
    }
    const r = await fetch(`${API_BASE}/champ/mot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { error: (d && d.error) || 'refus du serveur',
               raison: (d && typeof d.raison === 'string' && d.raison) || undefined };
    }
    return d as MotPose;
  } catch {
    return { error: 'reseau' };
  }
}

/* ------------------------------------------------------------ la bulle
   A partir des demi-finales, chaque partant peut poser une phrase courte,
   affichee en bulle au-dessus de sa tete pendant SES trois secondes de
   presentation — en direct comme au rejeu. Une phrase prete, ou la sienne.

   Les bornes vivent ici comme celles du mot : le serveur les reverifie et
   filtre tout (worker/src/mot.js, `texteRecevable`), phrases pretes comprises
   — elles ne sont qu'un raccourci, pas un laissez-passer. */

/** Une bulle se lit en trois secondes : quarante caracteres, pas un de plus. */
export const BULLE_MAX = 40;

/**
 * Les phrases pretes, [francais, anglais]. C'est le texte de la langue du
 * joueur qui part : une phrase anglaise passe le filtre comme un texte libre.
 * Les francaises sont celles du serveur (`BULLES_PRETES`,
 * worker/src/championnats-config.js).
 */
export const BULLES_PRETES: [string, string][] = [
  ['Je suis venu gagner.', 'I came here to win.'],
  ['Rendez-vous sur la ligne.', 'See you at the line.'],
  ['Pour ma ville.', 'For my city.'],
  ['Personne ne me rattrape.', 'Nobody catches me.'],
  ['Premier départ, dernier mot.', 'First to go, last word.'],
  ['Regardez bien mon couloir.', 'Keep your eyes on my lane.'],
  ['Ce soir, c’est ma course.', 'Tonight is my race.'],
  ['Que le meilleur gagne.', 'May the best one win.'],
  ['Le chrono va parler.', 'The clock will do the talking.'],
  ['Je viens chercher la finale.', 'I came for the final.'],
];

export type BullePosee =
  | { ok: true; texte: string }
  | { ok: false; raison?: string; erreur?: string };

/**
 * Pose (ou remplace) la bulle de ce joueur pour la phase en cours.
 *
 * Refusee une fois sa course appelee (30 s avant le pistolet) : la salle a
 * deja fixe l'ordre de presentation. Le serveur le dit par « trop tard », que
 * l'on rend ici sous la forme d'une raison comme les autres ('trop_tard').
 */
export async function poserBulle(
  c: { edition: string; phase: string }, texte: string,
): Promise<BullePosee> {
  try {
    const r = await fetch(`${API_BASE}/champ/bulle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edition: c.edition, phase: c.phase,
        name: getSavedName() || '', device_id: getDeviceId(),
        texte: String(texte || '').slice(0, BULLE_MAX),
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && d.ok) return { ok: true, texte: String(d.texte || texte) };
    const erreur = (d && d.error) ? String(d.error) : 'refus du serveur';
    const raison = (d && typeof d.raison === 'string' && d.raison)
      || (/trop tard/i.test(erreur) ? 'trop_tard' : undefined);
    return { ok: false, raison, erreur };
  } catch {
    return { ok: false, erreur: 'reseau' };
  }
}

/** La voix d'un mot de course, a la demande — elle ne voyage pas avec l'edition. */
export async function voixDuMotDeCourse(
  c: { edition: string; phase: string; course: number },
): Promise<{ voix: string; voix_type: string } | null> {
  try {
    const q = `edition=${encodeURIComponent(c.edition)}&phase=${encodeURIComponent(c.phase)}&course=${c.course}`;
    const r = await fetch(`${API_BASE}/champ/mot?${q}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
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
