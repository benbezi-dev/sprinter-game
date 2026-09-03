// Voix en direct entre les deux participants d'un duel.
//
// Le son ne passe pas par le serveur. La salle ne sert qu'a mettre les deux
// navigateurs en relation — elle transporte une offre, une reponse et des
// candidats ICE, sans rien comprendre a ce qu'elle transporte — puis les deux
// pairs se parlent directement. C'est ce qui permet d'avoir une latence de
// conversation plutot qu'une latence de diffusion, et c'est aussi ce qui evite
// de faire transiter de l'audio par un Durable Object facture au temps eveille.
//
// Trois choses meritent d'etre dites parce qu'elles ne se devinent pas :
//
// 1. Le micro n'est PRIS que pendant les fenetres de parole, et rendu des
//    qu'elles se referment.
//
//    On gardait avant la capture ouverte pour toute la duree du duel, en se
//    contentant de basculer `enabled`. Sur un ordinateur cela ne se voit pas.
//    Sur un telephone, si : tant qu'une capture existe, le systeme considere
//    que l'application tient le micro, et il ne le donne a personne d'autre.
//    Un joueur en communication WhatsApp qui ouvrait un duel n'etait plus
//    entendu de son correspondant — pour le systeme, le micro etait ici, et il
//    y restait jusqu'a ce qu'on quitte la salle. Une piste `enabled = false`
//    n'y change rien : elle cesse d'emettre, elle ne rend pas l'appareil.
//
//    On rend donc reellement le micro entre les fenetres. Le cout est de
//    quelques centaines de millisecondes au debut de chaque prise de parole,
//    le temps que la capture demarre ; le gain est qu'un duel n'accapare plus
//    le micro du telephone pendant plusieurs minutes.
//
//    Pour que ce va-et-vient ne coute pas une renegociation a chaque fois, la
//    place de la voix est reservee des le depart : un emetteur vide, negocie
//    une seule fois, sur lequel on pose puis retire la piste. Le SDP ne bouge
//    plus.
//
// 2. Une seule des deux parties emet l'offre, sinon les deux se croisent et la
//    negociation echoue (« glare »). C'est l'hote, arbitrairement mais
//    stablement — les deux cotes connaissent deja qui il est.
// 3. Un refus de micro n'interrompt rien. On monte quand meme la connexion :
//    celui qui a refuse continue d'entendre l'autre, et le duel se joue. C'est
//    le comportement demande, et c'est aussi le seul raisonnable — perdre une
//    course parce qu'on a dit non a une permission serait absurde.

/**
 * Serveurs de mise en relation.
 *
 * STUN suffit a la grande majorite des connexions : il sert seulement a
 * decouvrir son adresse publique. Les joueurs derriere un NAT symetrique —
 * certains reseaux mobiles, beaucoup de reseaux d'entreprise — ne peuvent pas
 * etablir de lien direct et ont besoin d'un relais TURN, qui est un service
 * payant. La liste est ici pour qu'on puisse en ajouter un sans toucher au
 * reste : `TURN` rempli, la connexion aboutit pour tout le monde.
 */
const STUN = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];
/** A remplir le jour ou l'on prend un service TURN. Voir la note ci-dessus. */
const TURN: RTCIceServer[] = [];

/** Ce qu'on demande a la capture, une fois pour toutes. */
const AUDIO: MediaTrackConstraints = {
  echoCancellation: true, noiseSuppression: true, autoGainControl: true,
};

/**
 * Souvenir d'une permission deja accordee.
 *
 * Il sert a une seule chose : savoir s'il faut demander le micro AVANT la
 * premiere fenetre de parole. La boite de dialogue du systeme mangerait les
 * cinq secondes du joueur, donc on la provoque en amont — mais une seule fois
 * dans la vie de l'installation, parce que la provoquer prend le micro un
 * instant, et que prendre le micro est exactement ce qu'on cherche a eviter.
 *
 * L'API des permissions repond mieux quand elle existe ; ce drapeau est le
 * filet pour les navigateurs qui ne connaissent pas « microphone », dont
 * Safari, c'est-a-dire l'application iOS.
 */
const ACCORD = 'sprinter.micro.accorde';
const dejaAccorde = () => { try { return localStorage.getItem(ACCORD) === '1'; } catch { return false; } };
const noterAccord = () => { try { localStorage.setItem(ACCORD, '1'); } catch { /* stockage refuse */ } };

export type EtatVoix = {
  /** La capture est possible : permission accordee, appareil present. */
  micro: boolean;
  /** L'utilisateur a refuse la permission : on continue sans sa voix. */
  refuse: boolean;
  /** Ma fenetre de parole est ouverte, et le micro est reellement pris. */
  ouvert: boolean;
  /** Le pair est joignable et l'audio circule. */
  connecte: boolean;
};

type Options = {
  /** Envoie un message de signalisation par la salle. */
  envoyer: (type: 'sdp' | 'ice', charge: any) => void;
  onEtat?: (e: EtatVoix) => void;
};

export class Voix {
  private pc: RTCPeerConnection | null = null;
  private flux: MediaStream | null = null;
  private piste: MediaStreamTrack | null = null;
  /** La place reservee a ma voix dans la negociation. Elle survit aux fenetres. */
  private emetteur: RTCRtpSender | null = null;
  private audio: HTMLAudioElement | null = null;
  private minuteur: any = null;
  private enAttente: RTCIceCandidateInit[] = [];
  private distantPose = false;
  private o: Options;

  /**
   * Numero de la fenetre de parole en cours.
   *
   * Demander le micro prend du temps, et la fenetre peut s'etre refermee
   * pendant que le systeme repondait — un tour de presentation qui s'acheve,
   * un joueur qui quitte. Le numero permet de reconnaitre une capture qui
   * arrive trop tard et de la rendre aussitot, plutot que de laisser une piste
   * orpheline ouverte pour le reste du duel.
   */
  private fenetre = 0;

  private etat: EtatVoix = { micro: false, refuse: false, ouvert: false, connecte: false };

  constructor(o: Options) { this.o = o; }

  private prevenir(p: Partial<EtatVoix>) {
    this.etat = { ...this.etat, ...p };
    this.o.onEtat?.(this.etat);
  }

  /** Le navigateur sait-il faire ce qu'on lui demande ? */
  static supporte(): boolean {
    return typeof RTCPeerConnection !== 'undefined' &&
           !!navigator.mediaDevices?.getUserMedia;
  }

  /**
   * L'application passe a l'arriere-plan : on rend le micro sans attendre la
   * fin de la fenetre.
   *
   * Repondre a un appel, c'est precisement passer a l'arriere-plan. Si l'on
   * gardait la capture le temps du minuteur, on reprendrait au correspondant
   * la voix qu'on vient de lui rendre.
   */
  private auFond = () => { if (document.hidden) this.fermerMicro(); };

  /**
   * Monte la connexion. `initiateur` doit etre vrai chez un seul des deux.
   *
   * Ne rejette jamais : un echec de micro ou de reseau degrade l'experience,
   * il n'interrompt pas le duel.
   */
  async demarrer(initiateur: boolean) {
    if (!Voix.supporte()) return;

    try {
      this.pc = new RTCPeerConnection({ iceServers: [...STUN, ...TURN] });
    } catch {
      return;
    }

    this.pc.onicecandidate = ev => {
      if (ev.candidate) this.o.envoyer('ice', ev.candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      this.prevenir({ connecte: s === 'connected' });
    };
    this.pc.ontrack = ev => this.jouerDistant(ev.streams[0]);

    // La place de ma voix, negociee vide.
    //
    // C'est ce qui rend le va-et-vient du micro invisible pour la connexion :
    // poser une piste sur un emetteur deja negocie ne demande pas de nouvelle
    // offre, alors qu'ajouter une piste en cours de route en demanderait une a
    // chaque fenetre de parole.
    try {
      this.emetteur = this.pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    } catch {
      this.emetteur = null;
    }

    document.addEventListener('visibilitychange', this.auFond);

    if (initiateur) {
      try {
        const offre = await this.pc.createOffer();
        await this.pc.setLocalDescription(offre);
        this.o.envoyer('sdp', this.pc.localDescription);
      } catch { /* la voix se passera de cette course */ }
    }

    // Volontairement apres la negociation, et sans l'attendre : la boite de
    // dialogue de permission ne doit retarder ni l'offre ni la reponse.
    void this.sonderPermission();
  }

  /**
   * Savoir si l'on pourra parler, sans prendre le micro pour le savoir.
   *
   * L'API des permissions repond sans rien allumer. Quand elle ne connait pas
   * « microphone » — Safari, donc l'application iOS — on se rabat sur le
   * souvenir d'un accord passe. Il ne reste qu'un cas ou l'on demande vraiment
   * la capture : la toute premiere fois, pour que le joueur reponde a la
   * question avant son tour de parole et non pendant. On rend l'appareil dans
   * la foulee.
   */
  private async sonderPermission() {
    let etat: PermissionState | null = null;
    try {
      const p = await (navigator as any).permissions?.query({ name: 'microphone' });
      etat = p?.state ?? null;
      if (p) p.onchange = () => this.prevenir({
        micro: p.state !== 'denied', refuse: p.state === 'denied',
      });
    } catch { /* permission inconnue de ce navigateur */ }

    if (etat === 'granted') { noterAccord(); this.prevenir({ micro: true, refuse: false }); return; }
    if (etat === 'denied') { this.prevenir({ micro: false, refuse: true }); return; }
    if (dejaAccorde()) { this.prevenir({ micro: true, refuse: false }); return; }

    try {
      const f = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
      f.getTracks().forEach(t => t.stop());
      noterAccord();
      this.prevenir({ micro: true, refuse: false });
    } catch {
      this.prevenir({ micro: false, refuse: true });
    }
  }

  /** Un message de signalisation arrive de l'autre pair. */
  async recu(type: 'sdp' | 'ice', charge: any) {
    if (!this.pc || !charge) return;
    try {
      if (type === 'sdp') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(charge));
        this.distantPose = true;
        // Les candidats arrives avant la description n'avaient nulle part ou
        // aller : on les rejoue maintenant.
        for (const c of this.enAttente) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
        }
        this.enAttente = [];

        if (charge.type === 'offer') {
          const rep = await this.pc.createAnswer();
          await this.pc.setLocalDescription(rep);
          this.o.envoyer('sdp', this.pc.localDescription);
        }
      } else {
        if (!this.distantPose) { this.enAttente.push(charge); return; }
        await this.pc.addIceCandidate(new RTCIceCandidate(charge));
      }
    } catch {
      // Un candidat refuse n'est pas fatal : il en viendra d'autres.
    }
  }

  private jouerDistant(flux: MediaStream) {
    if (!flux) return;
    if (!this.audio) {
      this.audio = document.createElement('audio');
      this.audio.autoplay = true;
      (this.audio as any).playsInline = true;
      this.audio.style.display = 'none';
      document.body.appendChild(this.audio);
    }
    this.audio.srcObject = flux;
    // Le navigateur peut refuser de jouer sans geste utilisateur. Ici il y en
    // a eu un — on ne rejoint pas une salle sans cliquer — mais on ne fait pas
    // dependre le duel de cette promesse.
    this.audio.play().catch(() => { /* le son restera muet */ });
  }

  /**
   * L'etat courant, pour qui l'affiche sans etre abonne.
   *
   * La presentation des athletes vit hors de l'arbre qui a monte cette
   * liaison : elle ne peut pas recevoir les mises a jour, elle vient donc les
   * chercher a chaque battement.
   */
  lireEtat(): EtatVoix { return this.etat; }

  /**
   * Rebranche l'affichage sur cette liaison.
   *
   * L'ecran qui l'a montee est demonte a chaque course et remonte apres. Le
   * nouveau vient donc reprendre le fil, et recoit l'etat courant dans la
   * foulee : sans cela il afficherait un micro eteint pendant qu'il est
   * ouvert, parce que la derniere nouvelle est partie vers un composant mort.
   */
  brancherEtat(surEtat: (e: EtatVoix) => void) {
    this.o.onEtat = surEtat;
    surEtat(this.etat);
  }

  /**
   * Ouvre le micro pour une duree donnee, puis le referme tout seul.
   *
   * Le minuteur est arme tout de suite, la capture est demandee en parallele :
   * une fenetre de cinq secondes dure cinq secondes, que le systeme ait mis
   * cinquante millisecondes ou trois cents a repondre. Rien n'attend une
   * action de l'utilisateur pour se refermer — c'est exactement ce qu'on veut
   * d'un micro qui s'ouvre tout seul.
   */
  ouvrirMicro(ms: number) {
    clearTimeout(this.minuteur);
    const f = ++this.fenetre;
    this.minuteur = setTimeout(() => this.fermerMicro(), ms);
    void this.prendreLeMicro(f);
  }

  private async prendreLeMicro(f: number) {
    // Deux fenetres qui s'enchainent sans respirer : la capture est encore la,
    // on ne la redemande pas.
    if (this.piste) {
      this.piste.enabled = true;
      this.prevenir({ ouvert: true });
      return;
    }

    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
    } catch {
      // Permission refusee, pas de micro sur l'appareil, ou micro tenu par une
      // autre application : on ecoute sans parler.
      this.prevenir({ micro: false, refuse: true, ouvert: false });
      return;
    }

    // La fenetre s'est refermee pendant que le systeme repondait.
    if (f !== this.fenetre) { flux.getTracks().forEach(t => t.stop()); return; }

    noterAccord();
    this.flux = flux;
    this.piste = flux.getAudioTracks()[0] || null;
    if (!this.piste) { this.rendreLeMicro(); this.prevenir({ micro: false, ouvert: false }); return; }

    try { await this.emetteur?.replaceTrack(this.piste); } catch { /* on parlera dans le vide */ }
    if (f !== this.fenetre) { this.rendreLeMicro(); return; }

    this.prevenir({ micro: true, refuse: false, ouvert: true });
  }

  /** Referme la fenetre et rend l'appareil. Le voyant doit s'eteindre ici. */
  fermerMicro() {
    clearTimeout(this.minuteur);
    this.minuteur = null;
    this.fenetre++;
    this.rendreLeMicro();
    this.prevenir({ ouvert: false });
  }

  /**
   * Rend physiquement le micro au systeme.
   *
   * `enabled = false` ne suffisait pas : la piste cesse d'emettre mais
   * l'appareil reste pris, et aucune autre application ne peut s'en servir.
   * Seul `stop()` le libere.
   */
  private rendreLeMicro() {
    try { this.emetteur?.replaceTrack(null); } catch { /* connexion deja fermee */ }
    if (this.piste) this.piste.enabled = false;
    try { this.flux?.getTracks().forEach(t => t.stop()); } catch { /* deja rendu */ }
    this.flux = null;
    this.piste = null;
  }

  /** Rend le micro et coupe tout. Le voyant de l'appareil doit s'eteindre. */
  arreter() {
    clearTimeout(this.minuteur);
    this.minuteur = null;
    this.fenetre++;
    document.removeEventListener('visibilitychange', this.auFond);
    this.rendreLeMicro();
    try { this.pc?.close(); } catch { /* ignore */ }
    if (this.audio) {
      try { this.audio.srcObject = null; this.audio.remove(); } catch { /* ignore */ }
      this.audio = null;
    }
    this.pc = null; this.emetteur = null;
    this.enAttente = []; this.distantPose = false;
    this.prevenir({ micro: false, ouvert: false, connecte: false });
  }
}
