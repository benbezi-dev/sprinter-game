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
// 1. Le micro n'est jamais « ferme » au sens ou l'on couperait la capture. On
//    garde la piste ouverte et on bascule `enabled`. Redemander getUserMedia a
//    chaque fenetre de cinq secondes rallumerait la diode de l'appareil a
//    chaque fois, reveillerait la demande de permission sur certains
//    navigateurs, et ferait perdre les premieres syllabes le temps que la
//    capture demarre.
// 2. Une seule des deux parties emet l'offre, sinon les deux se croisent et la
//    negociation echoue (« glare »). C'est l'hote, arbitrairement mais
//    stablement — les deux cotes connaissent deja qui il est.
// 3. Un refus de micro n'interrompt rien. On monte quand meme la connexion,
//    en reception seule : celui qui a refuse continue d'entendre l'autre, et
//    le duel se joue. C'est le comportement demande, et c'est aussi le seul
//    raisonnable — perdre une course parce qu'on a dit non a une permission
//    serait absurde.

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

export type EtatVoix = {
  /** La capture locale fonctionne. */
  micro: boolean;
  /** L'utilisateur a refuse la permission : on continue sans sa voix. */
  refuse: boolean;
  /** Ma fenetre de parole est ouverte en ce moment. */
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
  private audio: HTMLAudioElement | null = null;
  private minuteur: any = null;
  private enAttente: RTCIceCandidateInit[] = [];
  private distantPose = false;
  private o: Options;

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

    // On demande le micro avant de negocier : la piste doit exister au moment
    // de fabriquer l'offre, sinon il faudrait renegocier juste apres.
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      this.piste = this.flux.getAudioTracks()[0] || null;
      if (this.piste) {
        // Coupe des le depart : on ne parle que dans les fenetres prevues.
        this.piste.enabled = false;
        this.pc.addTrack(this.piste, this.flux);
      }
      this.prevenir({ micro: !!this.piste, refuse: false });
    } catch {
      // Permission refusee, pas de micro sur l'appareil, ou contexte non
      // securise : on ecoute sans parler.
      this.prevenir({ micro: false, refuse: true });
      try { this.pc.addTransceiver('audio', { direction: 'recvonly' }); } catch { /* ignore */ }
    }

    if (initiateur) {
      try {
        const offre = await this.pc.createOffer();
        await this.pc.setLocalDescription(offre);
        this.o.envoyer('sdp', this.pc.localDescription);
      } catch { /* la voix se passera de cette course */ }
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
   * Ouvre le micro pour une duree donnee, puis le referme tout seul.
   *
   * Le minuteur est remplace a chaque appel : deux fenetres qui se
   * chevaucheraient ne doivent pas laisser la premiere couper la seconde.
   * Rien n'attend une action de l'utilisateur pour se refermer — c'est
   * exactement ce qu'on veut d'un micro qui s'ouvre tout seul.
   */
  /**
   * L'etat courant, pour qui l'affiche sans etre abonne.
   *
   * La presentation des athletes vit hors de l'arbre qui a monte cette
   * liaison : elle ne peut pas recevoir les mises a jour, elle vient donc les
   * chercher a chaque battement.
   */
  lireEtat(): EtatVoix { return this.etat; }

  ouvrirMicro(ms: number) {
    if (!this.piste) return;
    clearTimeout(this.minuteur);
    this.piste.enabled = true;
    this.prevenir({ ouvert: true });
    this.minuteur = setTimeout(() => this.fermerMicro(), ms);
  }

  fermerMicro() {
    clearTimeout(this.minuteur);
    this.minuteur = null;
    if (this.piste) this.piste.enabled = false;
    this.prevenir({ ouvert: false });
  }

  /** Rend le micro et coupe tout. Le voyant de l'appareil doit s'eteindre. */
  arreter() {
    clearTimeout(this.minuteur);
    this.minuteur = null;
    try { this.flux?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    if (this.audio) {
      try { this.audio.srcObject = null; this.audio.remove(); } catch { /* ignore */ }
      this.audio = null;
    }
    this.pc = null; this.flux = null; this.piste = null;
    this.enAttente = []; this.distantPose = false;
    this.prevenir({ micro: false, ouvert: false, connecte: false });
  }
}
