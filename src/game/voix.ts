// Voix en direct entre les deux participants d'un duel.
//
// Le son ne passe pas par le serveur. La salle ne sert qu'a mettre les deux
// navigateurs en relation — elle transporte une offre, une reponse et des
// candidats ICE, sans rien comprendre a ce qu'elle transporte — puis les deux
// pairs se parlent directement. C'est ce qui permet d'avoir une latence de
// conversation plutot qu'une latence de diffusion, et c'est aussi ce qui evite
// de faire transiter de l'audio par un Durable Object facture au temps eveille.
//
// Quatre choses meritent d'etre dites parce qu'elles ne se devinent pas :
//
// 1. Le micro est PRIS pour la duree d'une sequence de parole, et rendu des
//    qu'elle s'acheve.
//
//    On l'a d'abord garde pour tout le duel, en se contentant de basculer
//    `enabled`. Sur un ordinateur cela ne se voit pas. Sur un telephone, si :
//    tant qu'une capture existe, le systeme considere que l'application tient
//    le micro, et il ne le donne a personne d'autre. Un joueur en communication
//    WhatsApp qui ouvrait un duel n'etait plus entendu de son correspondant —
//    pour le systeme, le micro etait ici, et il y restait jusqu'a ce qu'on
//    quitte la salle. Une piste `enabled = false` n'y change rien : elle cesse
//    d'emettre, elle ne rend pas l'appareil.
//
//    On l'a ensuite rendu entre CHAQUE fenetre de parole. C'etait trop loin
//    dans l'autre sens, et c'est ce qui rendait le micro capricieux. Une
//    fenetre de presentation dure 2 200 ms ; demander la capture en coute 300 a
//    900 sur un telephone, parfois davantage juste apres l'avoir rendue. Le
//    joueur parlait donc pendant la moitie de son tour, le voyant rouge
//    arrivait en retard, et il arrivait que la capture soit prete APRES la
//    fermeture de la fenetre — auquel cas personne n'avait rien entendu.
//
//    La capture est donc prise une fois pour la sequence — la presentation, ou
//    les cinq secondes du vainqueur — gardee muette entre les tours, et rendue
//    a la fin. Entre deux tours elle n'emet rien : `enabled = false` et la
//    piste retiree de l'emetteur. Le micro n'est tenu que pendant les quelques
//    secondes ou l'on va effectivement s'en servir, ce qui repond au probleme
//    WhatsApp sans faire payer la latence a chaque prise de parole.
//
//    Pour que ce va-et-vient ne coute pas une renegociation, la place de la
//    voix est reservee des le depart : un emetteur vide, negocie une seule
//    fois, sur lequel on pose puis retire la piste. Le SDP ne bouge plus.
//
// 2. Pendant la course, la liaison se met en veille.
//
//    Personne ne parle entre le pistolet et l'arrivee — aucune fenetre n'est
//    ouverte. Mais tant qu'un flux distant est branche sur un element audio, le
//    systeme considere qu'une conversation est en cours, et le jeu sort au
//    volume d'un appel telephonique. On coupe donc l'ecoute au depart et on la
//    rebranche au resultat. La connexion, elle, reste montee : rien a
//    renegocier, et le mot du vainqueur part sans attendre.
//
// 3. Une seule des deux parties emet l'offre, sinon les deux se croisent et la
//    negociation echoue (« glare »). C'est l'hote, arbitrairement mais
//    stablement — les deux cotes connaissent deja qui il est. Si malgre tout
//    deux offres se croisent, l'hote garde la sienne et l'autre range la sienne
//    pour repondre : une negociation qui echoue est une voix perdue pour tout
//    le duel.
// 4. Un refus de micro n'interrompt rien. On monte quand meme la connexion :
//    celui qui a refuse continue d'entendre l'autre, et le duel se joue. C'est
//    le comportement demande, et c'est aussi le seul raisonnable — perdre une
//    course parce qu'on a dit non a une permission serait absurde.

import { rendreLeSonAuJeu } from './session-audio';
import { serveursGlace } from './turn';

/** Ce qu'on demande a la capture, une fois pour toutes. */
const AUDIO: MediaTrackConstraints = {
  echoCancellation: true, noiseSuppression: true, autoGainControl: true,
};

/**
 * Attente avant de redemander une capture que le systeme vient de refuser
 * pour une raison passagere. Voir `capturer`.
 */
const REPRISE_MICRO_MS = 300;

/**
 * Delai avant de relancer une connexion qui a decroche sans tomber.
 *
 * `disconnected` n'est pas `failed` : un telephone qui passe du wifi a la 4G
 * repasse souvent par cet etat et s'en sort tout seul. On lui laisse le temps
 * de le faire avant d'aller le secouer.
 */
const AVANT_RELANCE_MS = 4000;

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

const patienter = (ms: number) => new Promise<void>(f => setTimeout(f, ms));

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
  /** Le flux annonce dans le SDP. Vide, mais nomme : voir `demarrer`. */
  private fluxLocal: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  /** La voix de l'autre, gardee pour pouvoir la rebrancher apres la course. */
  private fluxDistant: MediaStream | null = null;
  private minuteur: any = null;
  /** Rend l'appareil a l'echeance de `tenirJusqua`. */
  private liberation: any = null;
  private relance: any = null;
  private enAttente: RTCIceCandidateInit[] = [];
  /** Signalisation arrivee avant que la connexion existe. Voir `recu`. */
  private enAvance: { type: 'sdp' | 'ice'; charge: any }[] = [];
  private distantPose = false;
  private initiateur = false;
  private enVeille = false;
  private o: Options;

  /**
   * Numero de la fenetre de parole en cours.
   *
   * La capture peut mettre du temps a venir, et la fenetre peut s'etre
   * refermee pendant ce temps — un tour de presentation qui s'acheve, un
   * joueur qui quitte. Le numero permet de reconnaitre une prise de parole qui
   * arrive trop tard et de la taire aussitot, plutot que d'ouvrir un micro que
   * personne n'attend plus.
   */
  private fenetre = 0;

  /** Fin de la fenetre en cours, pour la reprendre au retour du fond. */
  private finFenetre = 0;

  /**
   * Date jusqu'a laquelle on garde l'appareil, meme micro coupe.
   *
   * C'est ce qui fait tenir la capture d'un tour de presentation au suivant :
   * entre les deux elle est muette, mais elle est la, et la fenetre suivante
   * s'ouvre instantanement.
   */
  private tenirJusqua = 0;

  /** Une demande de capture en cours : on n'en lance jamais deux. */
  private demande: Promise<MediaStreamTrack | null> | null = null;

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
   * fin de la fenetre. Et on le reprend au retour, si le tour dure encore.
   *
   * Repondre a un appel, c'est precisement passer a l'arriere-plan. Si l'on
   * gardait la capture le temps du minuteur, on reprendrait au correspondant
   * la voix qu'on vient de lui rendre. Mais un joueur qui regarde une
   * notification et revient dans la seconde ne doit pas perdre son tour pour
   * autant : sa fenetre est encore ouverte, on la lui rend.
   */
  private auFond = () => {
    if (document.hidden) {
      clearTimeout(this.minuteur);
      this.minuteur = null;
      this.fenetre++;
      this.tenirJusqua = 0;
      this.taire();
      this.rendreLeMicro();
      this.prevenir({ ouvert: false });
      return;
    }
    const reste = this.finFenetre - Date.now();
    if (reste > 0) this.ouvrirMicro(reste);
  };

  /**
   * Monte la connexion. `initiateur` doit etre vrai chez un seul des deux.
   *
   * Ne rejette jamais : un echec de micro ou de reseau degrade l'experience,
   * il n'interrompt pas le duel.
   */
  async demarrer(initiateur: boolean) {
    if (!Voix.supporte()) return;

    this.initiateur = initiateur;

    // Par ou la voix passera : STUN seul, ou STUN plus un relais pour les
    // reseaux qui refusent le lien direct. La liste est prechargee a l'entree
    // du salon, donc cette attente est presque toujours nulle — et quand elle
    // ne l'est pas, `recu` met de cote ce qui arrive entre-temps.
    const glace = await serveursGlace();

    try {
      this.pc = new RTCPeerConnection({ iceServers: glace });
    } catch {
      this.enAvance = [];
      return;
    }

    this.pc.onicecandidate = ev => {
      if (ev.candidate) this.o.envoyer('ice', ev.candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => this.surEtatConnexion();
    this.pc.ontrack = ev => {
      // `ev.streams` peut etre VIDE, et c'est le cas ici plus souvent
      // qu'ailleurs : un emetteur cree par `addTransceiver` n'appartient a
      // aucun flux, le SDP ne porte alors pas de `msid`, et le navigateur
      // d'en face recoit une piste sans flux autour. On lui en fabrique un,
      // sinon la voix de l'autre n'est jamais jouee — silencieusement, sans
      // erreur, ce qui est la pire facon de ne pas marcher.
      const f = ev.streams[0] || new MediaStream([ev.track]);
      this.fluxDistant = f;
      if (!this.enVeille) this.jouerDistant(f);
    };

    // La place de ma voix, negociee vide.
    //
    // C'est ce qui rend le va-et-vient du micro invisible pour la connexion :
    // poser une piste sur un emetteur deja negocie ne demande pas de nouvelle
    // offre, alors qu'ajouter une piste en cours de route en demanderait une a
    // chaque fenetre de parole.
    //
    // Le flux vide passe en `streams` n'est pas decoratif : il donne au SDP un
    // `msid` a annoncer, donc a l'autre bout un flux ou ranger la piste.
    try {
      this.fluxLocal = new MediaStream();
      this.emetteur = this.pc.addTransceiver('audio', {
        direction: 'sendrecv', streams: [this.fluxLocal],
      }).sender;
    } catch {
      try {
        this.emetteur = this.pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
      } catch {
        this.emetteur = null;
      }
    }

    document.addEventListener('visibilitychange', this.auFond);

    if (initiateur) {
      try {
        const offre = await this.pc.createOffer();
        await this.pc.setLocalDescription(offre);
        this.o.envoyer('sdp', this.pc.localDescription);
      } catch { /* la voix se passera de cette course */ }
    }

    // Ce qui est arrive pendant que la liste des serveurs se chargeait.
    // L'ordre est celui de la salle, et il compte : la description avant les
    // candidats qui la suivent.
    const enAvance = this.enAvance;
    this.enAvance = [];
    for (const m of enAvance) await this.recu(m.type, m.charge);

    // Volontairement apres la negociation, et sans l'attendre : la boite de
    // dialogue de permission ne doit retarder ni l'offre ni la reponse.
    void this.sonderPermission();
  }

  /**
   * Ce qu'on fait d'une connexion qui decroche.
   *
   * Elle decroche : un telephone change de reseau au milieu d'une
   * presentation, un wifi faiblit, un tunnel passe. Sans rien ici, la voix
   * s'arretait la et ne revenait plus — pour le joueur, « le micro ne marche
   * pas », alors que c'est le lien qui est tombe. Une relance ICE rejoue le
   * chemin sans rien renegocier d'autre ; elle part de l'hote seul, pour la
   * meme raison que l'offre.
   */
  private surEtatConnexion() {
    const s = this.pc?.connectionState;
    this.prevenir({ connecte: s === 'connected' });

    if (s === 'connected' || s === 'closed') {
      clearTimeout(this.relance);
      this.relance = null;
      return;
    }
    if (s === 'failed') { void this.relancerIce(); return; }
    if (s === 'disconnected' && !this.relance) {
      this.relance = setTimeout(() => {
        this.relance = null;
        if (this.pc?.connectionState === 'disconnected') void this.relancerIce();
      }, AVANT_RELANCE_MS);
    }
  }

  private async relancerIce() {
    if (!this.pc || !this.initiateur) return;
    try {
      const o = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(o);
      this.o.envoyer('sdp', this.pc.localDescription);
    } catch { /* on retentera au prochain decrochage */ }
  }

  /**
   * Savoir si l'on pourra parler, sans prendre le micro pour le savoir.
   *
   * L'API des permissions repond sans rien allumer. Quand elle ne connait pas
   * « microphone » — Safari, donc l'application iOS — on se rabat sur le
   * souvenir d'un accord passe. Il ne reste qu'un cas ou l'on demande vraiment
   * la capture : la toute premiere fois, pour que le joueur reponde a la
   * question avant son tour de parole et non pendant. On rend l'appareil dans
   * la foulee — sauf si une sequence de parole a commence entre-temps, auquel
   * cas la capture lui sert directement.
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

    await this.capturer();
    this.planifierLiberation();
  }

  /** Un message de signalisation arrive de l'autre pair. */
  async recu(type: 'sdp' | 'ice', charge: any) {
    if (!charge) return;
    // La connexion n'est pas encore montee : monter demande d'aller chercher
    // les serveurs de mise en relation, et une offre peut arriver pendant ce
    // temps. La jeter, c'est une negociation qui n'aboutit jamais et un duel
    // entier sans voix — on la garde, `demarrer` la rejouera.
    if (!this.pc) {
      if (this.enAvance.length < 32) this.enAvance.push({ type, charge });
      return;
    }
    try {
      if (type === 'sdp') {
        // Deux offres qui se croisent. Cela ne devrait pas arriver — seul
        // l'hote offre — mais une liaison recreee des deux cotes en meme temps
        // y suffit, et une negociation cassee est une voix perdue pour tout le
        // duel. L'hote garde donc la sienne et ignore celle qui arrive ;
        // l'autre range la sienne et repond. Un des deux cede, toujours le
        // meme : c'est tout ce qu'il faut pour que cela se termine.
        if (charge.type === 'offer' && this.pc.signalingState !== 'stable') {
          if (this.initiateur) return;
          try { await this.pc.setLocalDescription({ type: 'rollback' } as any); }
          catch { return; }
        }

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
    // dependre le duel de cette promesse : si elle casse, le premier contact
    // suivant relance la lecture.
    this.audio.play().catch(() => {
      const reprendre = () => { this.audio?.play().catch(() => { /* muet */ }); };
      document.addEventListener('pointerdown', reprendre, { once: true });
    });
  }

  /** Debranche l'ecoute sans toucher a la connexion. Voir `veille`. */
  private detacherDistant() {
    try { this.pc?.getReceivers().forEach(r => { if (r.track) r.track.enabled = false; }); }
    catch { /* connexion deja fermee */ }
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.srcObject = null;
      this.audio.remove();
    } catch { /* deja parti */ }
    this.audio = null;
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
   * Prend le micro pour la duree d'une sequence, avant qu'on en ait besoin.
   *
   * Appele au debut de la presentation, avec la duree de la sequence entiere.
   * La capture est demandee tout de suite et gardee MUETTE : la piste n'est pas
   * posee sur l'emetteur et `enabled` reste faux, donc rien ne part. Quand le
   * tour du joueur arrive, il n'y a plus qu'a poser la piste, ce qui est
   * instantane — au lieu des quelques centaines de millisecondes que coute une
   * capture, sur une fenetre qui n'en dure que deux mille deux cents.
   *
   * C'est aussi ce qui provoque la boite de dialogue de permission au bon
   * moment : pendant l'annonce, pas pendant le tour de parole.
   */
  prechauffer(ms: number) {
    if (!Voix.supporte() || this.enVeille || ms <= 0) return;
    this.tenirJusqua = Math.max(this.tenirJusqua, Date.now() + ms);
    void this.capturer().then(() => this.planifierLiberation());
  }

  /**
   * Ouvre le micro pour une duree donnee, puis le referme tout seul.
   *
   * Le minuteur est arme tout de suite : une fenetre de cinq secondes dure
   * cinq secondes, que le systeme ait mis cinquante millisecondes ou trois
   * cents a repondre. Rien n'attend une action de l'utilisateur pour se
   * refermer — c'est exactement ce qu'on veut d'un micro qui s'ouvre tout seul.
   */
  ouvrirMicro(ms: number) {
    if (this.enVeille) return;
    clearTimeout(this.minuteur);
    const f = ++this.fenetre;
    this.finFenetre = Date.now() + ms;
    this.tenirJusqua = Math.max(this.tenirJusqua, this.finFenetre);
    this.minuteur = setTimeout(() => this.fermerMicro(), ms);
    void this.prendreLaParole(f);
  }

  private async prendreLaParole(f: number) {
    const p = this.piste || await this.capturer();
    if (!p) return;
    // La fenetre s'est refermee pendant que le systeme repondait : la capture
    // reste, elle servira peut-etre au tour suivant, mais elle ne parle pas.
    if (f !== this.fenetre) { this.taire(); return; }

    p.enabled = true;
    try { await this.emetteur?.replaceTrack(p); } catch { /* on parlera dans le vide */ }
    if (f !== this.fenetre) { this.taire(); return; }

    this.prevenir({ micro: true, refuse: false, ouvert: true });
  }

  /**
   * Obtient la capture, ou rend celle qu'on a deja.
   *
   * Deux demandes ne partent jamais en meme temps — le prechauffage et la
   * premiere fenetre se suivent de pres — et un echec passager ne condamne pas
   * la voix du duel. `NotReadableError` et `AbortError` veulent dire « pas
   * maintenant » : le systeme n'a pas fini de rendre l'appareil, une autre
   * application le tenait une seconde. On reessaie une fois. Le refus, lui,
   * porte un nom precis, et c'est le seul qui allume « micro coupe » a l'ecran.
   */
  private async capturer(): Promise<MediaStreamTrack | null> {
    if (this.piste) return this.piste;
    if (this.demande) return this.demande;

    this.demande = (async () => {
      for (let essai = 0; essai < 2; essai++) {
        try {
          const f = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
          const p = f.getAudioTracks()[0] || null;
          if (!p) {
            f.getTracks().forEach(t => t.stop());
            this.prevenir({ micro: false, ouvert: false });
            return null;
          }
          // Muette a la naissance : c'est l'ouverture d'une fenetre qui donne
          // la parole, jamais la capture elle-meme.
          p.enabled = false;
          p.onended = () => { if (this.piste === p) this.rendreLeMicro(); };
          this.flux = f;
          this.piste = p;
          noterAccord();
          this.prevenir({ micro: true, refuse: false });
          return p;
        } catch (e: any) {
          const nom = (e && e.name) || '';
          if (nom === 'NotAllowedError' || nom === 'SecurityError') {
            this.prevenir({ micro: false, refuse: true, ouvert: false });
            return null;
          }
          if (essai === 0) { await patienter(REPRISE_MICRO_MS); continue; }
          // Pas de micro sur l'appareil, ou il reste pris ailleurs. On ecoute
          // sans parler — mais on ne dit pas que le joueur a refuse, parce
          // qu'il n'a rien refuse du tout.
          this.prevenir({ micro: false, ouvert: false });
          return null;
        }
      }
      return null;
    })();

    try { return await this.demande; } finally { this.demande = null; }
  }

  /** Coupe l'emission sans rendre l'appareil. */
  private taire() {
    try { this.emetteur?.replaceTrack(null); } catch { /* connexion deja fermee */ }
    if (this.piste) this.piste.enabled = false;
  }

  /** Referme la fenetre. Le voyant rouge doit s'eteindre ici. */
  fermerMicro() {
    clearTimeout(this.minuteur);
    this.minuteur = null;
    this.fenetre++;
    this.finFenetre = 0;
    this.taire();
    this.planifierLiberation();
    this.prevenir({ ouvert: false });
  }

  /**
   * Rend l'appareil a l'echeance prevue, ou tout de suite si elle est passee.
   *
   * Sans prechauffage, l'echeance est celle de la fenetre qui vient de se
   * fermer : le micro est rendu immediatement, comme avant. Avec, il est garde
   * muet jusqu'a la fin de la sequence.
   */
  private planifierLiberation() {
    clearTimeout(this.liberation);
    this.liberation = null;
    if (!this.flux) return;
    const reste = this.tenirJusqua - Date.now();
    if (reste <= 0) { this.rendreLeMicro(); return; }
    this.liberation = setTimeout(() => this.rendreLeMicro(), reste);
  }

  /**
   * Rend physiquement le micro au systeme.
   *
   * `enabled = false` ne suffisait pas : la piste cesse d'emettre mais
   * l'appareil reste pris, et aucune autre application ne peut s'en servir.
   * Seul `stop()` le libere.
   *
   * Et rendre l'appareil ne suffit pas non plus a rendre le son : iOS garde la
   * session en mode conversation apres la capture, ce qui laisse le jeu au
   * volume d'un appel telephonique pour toute la course qui suit. On va donc
   * la rechercher — voir `session-audio.ts`.
   */
  private rendreLeMicro() {
    clearTimeout(this.liberation);
    this.liberation = null;
    const avait = !!this.flux;
    try { this.emetteur?.replaceTrack(null); } catch { /* connexion deja fermee */ }
    if (this.piste) { this.piste.enabled = false; this.piste.onended = null; }
    try { this.flux?.getTracks().forEach(t => t.stop()); } catch { /* deja rendu */ }
    this.flux = null;
    this.piste = null;
    this.tenirJusqua = 0;
    if (avait) rendreLeSonAuJeu();
  }

  /**
   * La course commence : plus de micro, plus d'ecoute, mais la connexion reste.
   *
   * Rien ne se dit entre le pistolet et l'arrivee — aucune fenetre n'est
   * ouverte, et le joueur court. Ce qui reste, en revanche, c'est un flux
   * distant branche sur un element audio, et cela suffit a garder le systeme
   * en mode conversation : le jeu sort alors au volume d'un appel, et
   * l'annulation d'echo mange sa musique. On coupe donc l'ecoute pour la duree
   * de la course, sans defaire la negociation — le mot du vainqueur doit
   * partir a la seconde ou l'arrivee est prononcee.
   */
  veille() {
    if (this.enVeille) return;
    this.enVeille = true;
    clearTimeout(this.minuteur);
    this.minuteur = null;
    this.fenetre++;
    this.finFenetre = 0;
    this.tenirJusqua = 0;
    this.taire();
    this.rendreLeMicro();
    this.detacherDistant();
    this.prevenir({ ouvert: false });
    rendreLeSonAuJeu();
  }

  /** L'arrivee est prononcee : on rebranche l'ecoute. */
  reveil() {
    if (!this.enVeille) return;
    this.enVeille = false;
    try { this.pc?.getReceivers().forEach(r => { if (r.track) r.track.enabled = true; }); }
    catch { /* connexion deja fermee */ }
    if (this.fluxDistant) this.jouerDistant(this.fluxDistant);
  }

  /** Rend le micro et coupe tout. Le voyant de l'appareil doit s'eteindre. */
  arreter() {
    clearTimeout(this.minuteur);
    clearTimeout(this.relance);
    this.minuteur = null;
    this.relance = null;
    this.fenetre++;
    this.finFenetre = 0;
    this.tenirJusqua = 0;
    document.removeEventListener('visibilitychange', this.auFond);
    this.rendreLeMicro();
    this.detacherDistant();
    try { this.pc?.close(); } catch { /* ignore */ }
    this.pc = null; this.emetteur = null; this.fluxLocal = null;
    this.fluxDistant = null;
    this.enVeille = false;
    this.enAttente = []; this.enAvance = []; this.distantPose = false;
    this.prevenir({ micro: false, ouvert: false, connecte: false });
  }
}
