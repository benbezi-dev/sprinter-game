// La video de la course, enregistree chez le joueur et perissable.
//
// Rien de tout ceci ne passe par un serveur, et ce n'est pas un raccourci :
// l'infrastructure du jeu est faite de Workers Cloudflare, qui ne peuvent pas
// encoder de video, et d'une base D1, qui n'est pas un stockage de media. La
// seule machine capable de produire ce fichier est celle qui a dessine la
// course — le navigateur du joueur, image par image, sur son propre canvas.
//
// Elle s'en va de deux facons, et la premiere est de loin la plus frequente.
//
// UNE FOIS SORTIE, ELLE NE REVIENT PAS. Des que la feuille de partage s'est
// refermee — que le joueur ait envoye la video ou qu'il ait simplement change
// d'avis — le film est libere ici meme. C'est la regle demandee, et elle se
// defend : le fichier est parti chez lui, ou il a decide qu'il n'en voulait
// pas ; dans les deux cas le jeu n'a plus de raison de garder plusieurs
// dizaines de mega-octets dans la memoire d'un onglet. Seul un echec franc —
// rien n'est sorti du tout — laisse le film en place, parce que retirer le
// bouton a quelqu'un a qui il n'a rien donne serait le punir d'un incident
// dont il n'est pas l'auteur.
//
// DEUX HEURES, SINON. C'est la borne du film auquel personne n'a touche. Elle
// se tient toute seule, sans tache de nettoyage a planifier nulle part : le
// fichier vit dans la memoire de l'onglet, un minuteur le libere, et il
// disparait aussi si le joueur ferme la page.
//
// Ce que l'utilisateur a telecharge, en revanche, est sorti de l'application et
// ne nous appartient plus — c'est un fichier a lui, sur son appareil, que rien
// ici ne peut ni ne doit effacer.

/**
 * Deux heures, comme demande.
 *
 * Ce n'est PAS la duree de quoi que ce soit d'autre : le direct s'en servait
 * pour decider quand couper la liaison audio d'apres-course, et une liaison
 * ouverte deux heures n'est pas ce qu'on veut. Voir LivePanel, qui a repris sa
 * propre duree.
 */
export const TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Ou en est le film.
 *
 * `rendue` et `expiree` disent toutes deux qu'il n'y a plus de fichier, et
 * elles ne se confondent pas : la premiere est un depart — la video est sortie
 * par la feuille de partage — la seconde une fin de vie. L'ecran ne dit donc
 * pas la meme chose dans les deux cas, et surtout il ne va pas annoncer « la
 * video a ete effacee » a quelqu'un qui vient de l'envoyer a ses amis.
 */
export type PhaseReview =
  'inactif' | 'enregistre' | 'prete' | 'rendue' | 'expiree' | 'impossible';

/**
 * Ce qui s'est reellement produit quand le joueur a appuye.
 *
 * Le meme vocabulaire que `affiche.ts`, et pour la meme raison : « enregistre
 * dans tes videos » et « envoye a quelqu'un » ne se disent pas au meme moment.
 * Le type est redefini ici plutot qu'importe — ce module n'a aucun import, et
 * c'est voulu : il se charge seul, sans reveiller la moitie du jeu.
 */
export type Sortie = 'partage' | 'telechargement' | 'annule' | 'echec';

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
 *
 * DEUX LISTES, PARCE QU'UN CONTENEUR NE SUFFIT PAS A PROMETTRE UNE PISTE SON.
 * Demander « video/mp4;codecs=avc1 » avec du son dans le flux, c'est demander
 * un film muet et lui tendre un micro : selon le navigateur, la piste audio
 * est ignoree en silence — le replay sort sans le coup de pistolet, sans la
 * foule, sans rien, et personne ne sait pourquoi. On nomme donc explicitement
 * le codec audio des qu'il y a du son a mettre.
 */
const FORMATS_MUETS = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

const FORMATS_SONORES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  'video/webm',
];

function choisirFormat(avecSon = false): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const f of avecSon ? FORMATS_SONORES : FORMATS_MUETS) {
    try { if (MediaRecorder.isTypeSupported(f)) return f; } catch { /* suivant */ }
  }
  // Un appareil qui sait filmer mais pas sonoriser filme quand meme. Un replay
  // muet vaut mieux que pas de replay.
  return avecSon ? choisirFormat(false) : null;
}

/**
 * Le telephone sait-il faire sortir un fichier de cette taille et de ce type ?
 *
 * La question se pose avec le fichier lui-meme, comme dans `affiche.ts` :
 * `canShare` repond selon le type MIME, pas selon la presence de la cle. Un
 * temoin d'un octet suffit — c'est l'etiquette qu'on teste, pas le contenu.
 *
 * Sur iOS, cette question decide de tout. Une WKWebView n'a pas de
 * telechargement : `<a download>` y est un clic dans le vide, sans erreur et
 * sans fichier. Le bouton s'allumait, le compte a rebours s'ecoulait, et il ne
 * se passait rien — la pire des trois issues possibles, parce qu'elle ne se
 * distingue pas d'un jeu casse. La feuille de partage, elle, y fonctionne et
 * propose « Enregistrer dans Fichiers ».
 */
function peutPartager(type: string): boolean {
  try {
    const n: any = navigator;
    if (typeof n?.share !== 'function' || typeof n?.canShare !== 'function') return false;
    const temoin = new File([new Uint8Array(1)], 't', { type: type || 'video/mp4' });
    return n.canShare({ files: [temoin] });
  } catch {
    return false;
  }
}

export class Review {
  private rec: MediaRecorder | null = null;
  /** Le flux tire du canvas, garde pour pouvoir le relacher. Voir `rendreLeCanvas`. */
  private fluxVideo: MediaStream | null = null;
  private morceaux: Blob[] = [];
  private url: string | null = null;
  /**
   * Les donnees du film, gardees a cote de leur URL.
   *
   * Ce n'est pas une seconde copie : `createObjectURL` maintient deja ce blob
   * vivant en memoire, et le nommer ne coute donc rien de plus. Sans ce nom,
   * le partage n'aurait rien a partager — `morceaux` est vide des la fin de
   * l'enregistrement, et une URL d'objet ne se remonte pas en fichier sans
   * detour. Il tombe exactement en meme temps que l'URL : au bout des dix
   * minutes, ou quand on jette tout.
   */
  private donnees: Blob | null = null;
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
  demarrer(canvas: HTMLCanvasElement | null, sons: Array<MediaStreamTrack | null | undefined> = []) {
    if (!canvas) return;
    // Les pistes qu'on nous tend n'appartiennent PAS a cet enregistreur : le
    // son du jeu sort d'un noeud qui vit aussi longtemps que l'onglet, la voix
    // de l'adversaire d'une connexion qui a sa propre vie. On les emprunte le
    // temps du film, et on ne les arretera jamais — arreter la piste du jeu
    // couperait le son pour de bon, ce qui serait une facon spectaculaire de
    // rater un replay.
    const pistes = sons.filter((p): p is MediaStreamTrack => !!p && p.readyState === 'live');
    const format = choisirFormat(pistes.length > 0);
    if (!format) { this.prevenir({ phase: 'impossible' }); return; }
    this.jeter();

    try {
      const flux = (canvas as any).captureStream(30) as MediaStream;
      this.fluxVideo = flux;
      for (const p of pistes) {
        try { flux.addTrack(p); } catch { /* on filmera sans celle-la */ }
      }
      this.format = format;
      this.morceaux = [];
      this.rec = new MediaRecorder(flux, {
        mimeType: format,
        videoBitsPerSecond: 2_500_000,
        // De quoi rendre une foule et un coup de pistolet sans peser : le son
        // du jeu est synthetise, il n'a pas la matiere d'un enregistrement.
        audioBitsPerSecond: 128_000,
      });
      this.rec.ondataavailable = ev => { if (ev.data && ev.data.size) this.morceaux.push(ev.data); };
      this.rec.onerror = () => this.prevenir({ phase: 'impossible' });
      this.rec.start(1000);
      this.prevenir({ phase: 'enregistre', url: null, taille: 0, reste: 0 });
    } catch {
      this.prevenir({ phase: 'impossible' });
    }
  }

  /**
   * Rend le canvas a lui-meme.
   *
   * `captureStream` laisse une piste vivante branchee sur le canvas tant qu'on
   * ne l'arrete pas : elle continue d'en tirer des images, pour personne. Une
   * seule ne se voyait pas ; une par course, sur une soiree de one shots,
   * finit par se sentir.
   *
   * Les pistes SON, elles, sont retirees du flux sans etre arretees — elles ne
   * sont pas a nous. Voir `demarrer`.
   */
  private rendreLeCanvas() {
    const f = this.fluxVideo;
    this.fluxVideo = null;
    if (!f) return;
    try {
      for (const p of f.getAudioTracks()) f.removeTrack(p);
      for (const p of f.getVideoTracks()) p.stop();
    } catch { /* deja rendu */ }
  }

  /**
   * Suspend la capture, et la reprend.
   *
   * Un one shot peut compter trois epreuves, separees par un ecran de
   * resultat que le joueur regarde le temps qu'il veut. Filmer d'une traite
   * mettrait cette attente dans le film — parfois une minute d'ecran fixe,
   * pour rien, et autant de mega-octets a faire passer ensuite par la feuille
   * de partage. On ne filme donc que ce qui court, en une seule prise.
   *
   * `pause()` peut manquer sur un navigateur ancien. On ne s'en formalise
   * pas : le film contiendra l'ecran de resultat, ce qui est moins bien mais
   * reste une video de la course. C'est exactement le genre de detail pour
   * lequel il ne faut pas renoncer a la fonction entiere.
   */
  pause() {
    const r = this.rec;
    if (!r || r.state !== 'recording' || typeof r.pause !== 'function') return;
    try { r.pause(); } catch { /* on continue de filmer, tant pis */ }
  }

  reprendre() {
    const r = this.rec;
    if (!r || r.state !== 'paused' || typeof r.resume !== 'function') return;
    try { r.resume(); } catch { /* la suite manquera au film */ }
  }

  /** Une prise est-elle en cours ? Sert a distinguer reprendre de recommencer. */
  filme(): boolean {
    return !!this.rec && this.rec.state !== 'inactive';
  }

  /** L'etat courant, pour qui arrive apres coup. */
  lireEtat(): EtatReview { return this.etat; }

  /** Arrete la capture et publie le fichier. Demarre le compte a rebours. */
  arreter(): Promise<void> {
    return new Promise(resolve => {
      const r = this.rec;
      if (!r || r.state === 'inactive') { resolve(); return; }
      r.onstop = () => {
        this.rec = null;
        this.rendreLeCanvas();
        if (!this.morceaux.length) { this.prevenir({ phase: 'impossible' }); resolve(); return; }
        const blob = new Blob(this.morceaux, { type: this.format });
        this.morceaux = [];
        this.donnees = blob;
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
      try { r.stop(); } catch { this.rec = null; this.rendreLeCanvas(); resolve(); }
    });
  }

  /**
   * Le compte a rebours, et la suppression au bout.
   *
   * Elle est inconditionnelle : que le joueur ait telecharge ou non ne change
   * rien, comme demande. On revoque l'URL, ce qui rend le lien inutilisable et
   * laisse le navigateur liberer la memoire du blob.
   *
   * On ne previent que quand l'ECRAN changerait. Le minuteur bat toujours a la
   * seconde, mais sur deux heures le compte a rebours s'affiche a la minute :
   * prevenir a chaque battement, ce serait repeindre sept mille fois l'ecran
   * de fin — le plus charge du jeu — pour y reecrire le meme texte.
   */
  private battre() {
    clearInterval(this.battement);
    let dernier = compteARebours(TTL_MS);
    this.battement = setInterval(() => {
      const reste = this.expireA - Date.now();
      if (reste <= 0) { this.expirer(); return; }
      const vu = compteARebours(reste);
      if (vu === dernier) return;
      dernier = vu;
      this.prevenir({ reste });
    }, 1000);
  }

  /**
   * La video est sortie du jeu : on la libere ici.
   *
   * La difference avec `expirer` n'est pas dans le geste — c'est le meme — mais
   * dans ce qu'on en dit. Voir l'en-tete du fichier : une video partagee est
   * partie chez son proprietaire, une video expiree n'est allee nulle part.
   */
  private rendre() {
    clearInterval(this.battement);
    this.battement = null;
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch { /* ignore */ } }
    this.url = null;
    this.donnees = null;
    this.expireA = 0;
    this.prevenir({ phase: 'rendue', url: null, reste: 0 });
  }

  private expirer() {
    clearInterval(this.battement);
    this.battement = null;
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch { /* ignore */ } }
    this.url = null;
    this.donnees = null;
    this.prevenir({ phase: 'expiree', url: null, reste: 0 });
  }

  /**
   * Fait sortir la video de l'application.
   *
   * A partir de la, le fichier appartient a l'utilisateur : il est sorti de
   * l'onglet, et l'expiration ci-dessus ne le concerne plus.
   *
   * Deux chemins, et le second n'est pas un pis-aller : sur un ordinateur, la
   * feuille de partage n'existe pas et enregistrer le fichier est exactement
   * ce qu'on veut. La methode s'appelait `telecharger` ; elle ne telecharge
   * plus toujours, et un nom qui ment sur un telephone valait moins que trois
   * appels a renommer.
   */
  async partager(): Promise<Sortie> {
    if (!this.url || this.etat.phase !== 'prete') return 'echec';
    const sortie = await this.sortir();
    // ET LA VIDEO S'EN VA. Envoyee, enregistree, ou refusee d'un revers de
    // pouce : dans les trois cas la feuille s'est refermee et le geste a eu
    // lieu. Ce qui devait sortir est sorti, le reste ne nous appartient plus,
    // et le bouton n'a plus rien a proposer — voir l'en-tete du fichier.
    //
    // `echec` seul fait exception : la, rien n'est sorti, et le joueur doit
    // pouvoir reessayer.
    if (sortie !== 'echec') this.rendre();
    return sortie;
  }

  /** Le geste lui-meme, sans la consequence. */
  private async sortir(): Promise<Sortie> {
    const url = this.url;
    if (!url) return 'echec';
    const type = this.format || 'video/mp4';
    if (this.donnees && peutPartager(type)) {
      try {
        const fichier = new File([this.donnees], this.etat.fichier, { type });
        // Pas de `url` a cote du fichier : plusieurs applications de
        // destination ne gardent que l'un des deux, et c'est souvent le lien
        // qu'elles gardent — on perdrait la video, qui est tout l'objet du
        // geste.
        await (navigator as any).share({ files: [fichier] });
        return 'partage';
      } catch (e: any) {
        // Refermer la feuille n'est pas un echec : c'est un choix, et l'ecran
        // ne doit pas repondre par un message d'erreur a quelqu'un qui a
        // simplement change d'avis.
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'annule';
        // Echec pour une autre raison : plutot que de laisser le joueur sans
        // rien, on tente quand meme de lui donner le fichier.
      }
    }

    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = this.etat.fichier;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return 'telechargement';
    } catch {
      return 'echec';
    }
  }

  /** Libere tout, sans attendre l'expiration. */
  jeter() {
    clearInterval(this.battement);
    this.battement = null;
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch { /* ignore */ }
    this.rec = null;
    this.rendreLeCanvas();
    this.morceaux = [];
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch { /* ignore */ } }
    this.url = null;
    this.donnees = null;
    this.expireA = 0;
    this.prevenir({ phase: 'inactif', url: null, reste: 0, taille: 0 });
  }
}

/**
 * Le reste, ecrit comme on le lirait.
 *
 * Trois formes, parce qu'une seule ne tient pas sur deux heures : « 120:00 »
 * n'est pas une duree qu'un oeil humain lit, et compter les secondes d'une
 * heure et demie n'apprend rien a personne. On dit donc l'heure et la minute
 * loin de la fin, la minute ensuite, et la seconde seulement dans les deux
 * dernieres — la ou elle commence a compter.
 *
 * C'est aussi ce qui cadence le battement : voir `battre`, qui ne previent
 * l'ecran que lorsque CETTE chaine change.
 */
export function compteARebours(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  if (s >= 120) return `${Math.ceil(s / 60)} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
