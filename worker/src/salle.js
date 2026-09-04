/* ---------------------------------------------------------------------------
   SALLE DE COURSE EN DIRECT
   ---------------------------------------------------------------------------
   De un a huit joueurs, une seule piste, en meme temps.

   Le mode fantome faisait courir contre un enregistrement : on savait deja que
   l'autre avait fini, on ne faisait que rattraper une trace. Ici personne ne
   sait qui va gagner, et c'est tout l'interet — mais cela impose trois choses
   qu'un simple Worker sans etat ne sait pas faire :

   1. un point de rendez-vous unique. Deux joueurs a deux bouts du monde
      doivent tomber sur le meme objet ; c'est exactement ce qu'est un Durable
      Object, adresse par le code de la salle.
   2. une horloge commune. Le depart ne peut pas etre « quand chacun est
      pret » : il est annonce a une date absolue, et chaque client mesure son
      decalage avec l'horloge de la salle pour tomber juste.
   3. un arbitre. Les chronos sont annonces par les clients, donc bornes ici :
      on refuse ce qui est physiquement impossible plutot que de faire
      confiance a la page web.

   Le protocole tient en quelques messages, en JSON, sur une WebSocket.
--------------------------------------------------------------------------- */

import { appliquerDuel } from './duels.js';

// Personne n'attend indefiniment : une salle sans vie est liberee.
const VIE_SALLE_MS = 20 * 60 * 1000;
// Un Durable Object est facture au temps ou il reste eveille, et une WebSocket
// ouverte l'y maintient. Une salle qui a rendu son verdict ne sert plus a rien
// mais coute autant qu'une salle en pleine course : on la ferme.
//
// Pas immediatement — les deux joueurs regardent leur resultat et peuvent
// vouloir remettre ca. On leur laisse le temps de se decider, et le moindre
// « pret » annule la fermeture.
const APRES_RESULTAT_MS = 45 * 1000;
// Et une salle ou il ne se passe rien finit aussi par fermer, sans quoi deux
// joueurs qui l'ouvrent et s'en vont la laisseraient eveillee vingt minutes.
const INACTIVITE_MS = 4 * 60 * 1000;
// Delai entre « tout le monde est pret » et le coup de pistolet. Assez long
// pour absorber une latence mediocre, assez court pour ne pas ennuyer.
const AVANT_DEPART_MS = 4000;

// --- presentation des participants, facon championnat ----------------------
// Chaque participant passe face camera, un par un, avant la course. Les durees
// sont ici et pas dans le client : c'est la salle qui les annonce, sinon deux
// clients avec des reglages differents presenteraient des athletes differents
// au meme instant.
//
// Le temps de reaction humain n'entre pas en jeu ici, donc rien n'est annonce
// comme un signal : comme le depart, la presentation est une date absolue et
// chacun compte avec sa propre horloge recalee.
const AVANT_PRESENTATION_MS = 1500;
/**
 * TROIS SECONDES PAR ATHLETE, quel que soit le nombre de partants.
 *
 * Le cahier des charges d'origine demandait cinq a huit secondes. Le creneau
 * valait donc six, resserre par un plafond sur la sequence entiere : douze
 * secondes a deux, dix-huit a trois, vingt-quatre des quatre et au-dela. Deux
 * defauts, et le second est le pire :
 *
 * - c'etait long. Personne n'attend une demi-minute pour courir dix secondes,
 *   et le mode ou l'on relance quatre fois de suite le payait a chaque fois.
 * - c'etait imprevisible. La duree d'un creneau dependait du nombre de
 *   partants, si bien qu'on ne pouvait pas apprendre le rythme de la
 *   sequence : elle etait lente a deux et pressee a huit.
 *
 * Trois secondes pour tout le monde repond aux deux. C'est ce qu'il faut pour
 * lire un nom, voir l'athlete lever les bras et l'entendre — c'etait deja le
 * plancher que le resserrement visait a huit — et la sequence entiere devient
 * une simple multiplication : six secondes a deux, vingt-quatre a huit, la ou
 * il y a effectivement huit personnes a montrer.
 */
const PRESENTATION_PAR_JOUEUR_MS = 3000;
// La fenetre micro tient dans le creneau du participant, pas a cheval dessus :
// sans quoi on parlerait encore pendant la presentation du suivant. C'est donc
// le creneau qui la borne — 2 200 ms sur les 3 000 — et le plafond de cinq
// secondes ne sert plus que de garde-fou si le creneau s'allongeait un jour.
const PRESENTATION_MICRO_MS = 5000;
const MICRO_MARGE_MS = 800;

/**
 * Le creneau de chacun.
 *
 * Il ne depend plus du nombre de partants ; la fonction reste parce que la
 * salle annonce cette duree au client, qui compte avec, et parce qu'un creneau
 * qui redeviendrait variable se recalculerait ici, a un seul endroit.
 */
function creneauPresentation() {
  return PRESENTATION_PAR_JOUEUR_MS;
}
// Bornes de credibilite d'un chrono annonce par un client.
const MIN_MS = 1000, MAX_MS = 20 * 60000;
// Au-dela, on considere que le joueur a abandonne la course en cours.
const ABANDON_MS = 3 * 60000;

/**
 * Le plafond d'une piste.
 *
 * Huit, parce que c'est le nombre de couloirs d'une piste d'athletisme et donc
 * le format d'une serie de championnat. Le duel a deux reste le cas courant :
 * la taille est decidee par celui qui ouvre la piste, et vaut deux par defaut.
 * Toutes les tailles entre les deux existent, y compris les impaires : on est
 * trois bien plus souvent qu'on est quatre.
 *
 * Ce que la taille change vraiment n'est pas l'affichage mais le sens de la
 * course. A un, c'est un tour de piste seul. A deux, c'est un duel : il y a un
 * vainqueur, un perdant, et des points qui changent de main. A trois ou plus,
 * c'est une course : il y a un classement, et rien ne bouge au classement des
 * duels — un bareme concu pour une paire n'a pas de generalisation honnete a
 * huit.
 */
const PLAFOND_JOUEURS = 8;
/**
 * Le plancher, lui, est UN.
 *
 * Pas par symetrie : parce qu'une piste se remplit avec les gens qu'on a. Un
 * couloir, c'est un tour de piste seul — le meme stade, la meme video, sans
 * personne a attendre. Et surtout, un plancher a deux forcait a arrondir : on
 * ne proposait que des tailles paires, si bien qu'un groupe de trois ouvrait
 * une piste a quatre et restait plante devant un couloir que personne ne
 * venait prendre. Le depart attend que la piste soit pleine ; une piste qu'on
 * ne peut pas remplir ne part jamais.
 */
const PLANCHER_JOUEURS = 1;
const DEFAUT_JOUEURS = 2;

function net(nom) {
  const s = String(nom || '').trim().slice(0, 20).replace(/[<>]/g, '');
  return s || 'Anonyme';
}

export class SalleDirecte {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, {id:string,nom:string,pret:boolean,d:number,fin:number|null,parti:boolean}>} */
    this.joueurs = new Map();
    this.epreuves = null;      // fixees par le premier arrive
    this.niveau = 4;
    this.departA = null;       // date absolue du coup de pistolet, ms epoch
    this.presentationA = null; // date absolue du debut de la presentation
    this.ordre = [];           // les participants dans l'ordre des couloirs
    this.max = DEFAUT_JOUEURS; // taille de la piste, fixee par le createur
    this.hote = null;          // identifiant du createur : c'est lui l'initiateur
    this.termine = false;
    this.test = false;         // salle du canal de test : ecrit ailleurs
    this.code = '';            // le code de la salle, pose au premier appel
    this.minuteur = null;      // fermeture programmee
    this.ne = Date.now();
  }

  // --- utilitaires ---------------------------------------------------------

  /** Etat public de la salle, tel que le voit un client. */
  vue() {
    const joueurs = [...this.joueurs.values()].map((j, i) => ({
      id: j.id, nom: j.nom, pret: j.pret, d: Math.round(j.d * 10) / 10,
      fin: j.fin, hote: j.id === this.hote,
      // Le couloir suit l'ordre d'arrivee sur la piste. Il sert au jeu a
      // placer chaque adversaire, et a la presentation a les faire passer.
      couloir: i + 1,
    }));
    return {
      joueurs, epreuves: this.epreuves, niveau: this.niveau, max: this.max,
      depart_a: this.departA, horloge: Date.now(), termine: this.termine,
      presentation: this.presentationA ? {
        debut_a: this.presentationA,
        par: creneauPresentation(),
        micro: Math.min(PRESENTATION_MICRO_MS,
                        creneauPresentation() - MICRO_MARGE_MS),
        ordre: this.ordre,
      } : null,
    };
  }

  /**
   * Programme la fermeture de la salle. Toute activite la repousse : c'est le
   * silence qui ferme, pas l'horloge.
   */
  programmerFermeture(delai, raison) {
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.diffuser({ t: 'ferme', raison });
      for (const [ws] of this.joueurs) {
        try { ws.close(1000, raison); } catch (e) { /* deja fermee */ }
      }
      this.joueurs.clear();
    }, delai);
  }

  /** Il se passe quelque chose : la salle ne ferme pas maintenant. */
  vivante() {
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.programmerFermeture(0, 'inactivite'),
                               INACTIVITE_MS);
  }

  diffuser(msg, sauf) {
    const texte = JSON.stringify(msg);
    for (const [ws] of this.joueurs) {
      if (ws === sauf) continue;
      try { ws.send(texte); } catch (e) { /* socket morte, le close fera le menage */ }
    }
  }

  envoyerEtat() {
    this.diffuser({ t: 'salle', ...this.vue() });
  }

  // --- cycle de vie --------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    // Le code voyage dans l'URL : le Durable Object ne connait pas le nom
    // sous lequel on l'a adresse, et il en a besoin pour identifier la
    // rencontre au classement.
    this.code = this.code || (url.searchParams.get('code') || '').toUpperCase();
    // Le canal est pose par le worker, jamais par le client : une salle de test
    // ecrit son resultat dans la base de test, et nulle part ailleurs.
    if (url.searchParams.get('canal') === 'test') this.test = true;

    // Consultation sans WebSocket : sert au client a savoir si un code existe
    // avant d'ouvrir quoi que ce soit.
    if (url.pathname.endsWith('/etat')) {
      return new Response(JSON.stringify({
        existe: this.joueurs.size > 0 || !!this.epreuves,
        complete: this.joueurs.size >= this.max,
        ...this.vue(),
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }

    if (this.joueurs.size >= this.max) {
      return new Response('salle complete', { status: 409 });
    }

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    // Acceptation classique, pas l'API d'hibernation : la salle tient tout son
    // etat en memoire (qui est la, qui est pret, ou en est chacun), et une
    // hibernation le perdrait. Une course dure dix secondes, l'objet peut bien
    // rester eveille le temps qu'elle se joue. L'hibernation delivre en outre
    // ses evenements a des methodes de classe, pas aux ecouteurs poses ici.
    serveur.accept();

    const id = crypto.randomUUID().slice(0, 8);
    const nom = net(url.searchParams.get('name'));
    const premier = this.joueurs.size === 0;
    if (premier) {
      this.hote = id;
      const eps = (url.searchParams.get('races') || '100').split(',')
        .filter(r => r === '100' || r === '200' || r === '400').slice(0, 3);
      this.epreuves = eps.length ? eps : ['100'];
      const n = parseInt(url.searchParams.get('level') || '4', 10);
      this.niveau = Number.isFinite(n) && n >= 0 && n <= 5 ? n : 4;
      // Seul le premier arrive decide de la taille : la changer en cours de
      // route ferait entrer ou sortir des gens d'une course deja formee.
      const m = parseInt(url.searchParams.get('max') || String(DEFAUT_JOUEURS), 10);
      this.max = Number.isFinite(m)
        ? Math.max(PLANCHER_JOUEURS, Math.min(PLAFOND_JOUEURS, m))
        : DEFAUT_JOUEURS;
    }

    this.joueurs.set(serveur, {
      id, nom, pret: false, d: 0, fin: null, parti: false,
    });
    this.vivante();

    serveur.addEventListener('message', ev => this.recu(serveur, ev.data));
    serveur.addEventListener('close', () => this.parti(serveur));
    serveur.addEventListener('error', () => this.parti(serveur));

    // Le nouvel arrivant recoit son identite, puis tout le monde recoit l'etat.
    try {
      serveur.send(JSON.stringify({ t: 'bienvenue', moi: id, ...this.vue() }));
    } catch (e) { /* deja fermee */ }
    this.envoyerEtat();

    return new Response(null, { status: 101, webSocket: client });
  }

  parti(ws) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    this.joueurs.delete(ws);
    // Un depart en pleine course laisse l'autre seul : on le lui dit plutot
    // que de le laisser courir contre un couloir vide.
    this.diffuser({ t: 'sorti', id: j.id, nom: j.nom, ...this.vue() });
    if (this.joueurs.size === 0) this.termine = false;
    // Plus personne : on eteint le minuteur. Un setTimeout en attente suffit a
    // maintenir l'objet eveille, et donc facture, pour rien.
    if (this.joueurs.size === 0) { clearTimeout(this.minuteur); this.minuteur = null; }
  }

  recu(ws, brut) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    let m;
    try { m = JSON.parse(brut); } catch { return; }

    switch (m && m.t) {
      // Mesure du decalage d'horloge. Le client envoie son heure, on lui
      // renvoie la notre avec la sienne : il en deduit son offset et sa
      // latence sans qu'on ait rien a retenir.
      case 'ping':
        try { ws.send(JSON.stringify({ t: 'pong', a: m.a, serveur: Date.now() })); } catch (e) { }
        return;

      case 'pret': {
        j.pret = !!m.pret;
        this.vivante();
        // Le depart se declenche quand la salle est pleine et que tout le
        // monde a confirme. On l'annonce a une date absolue : chacun compte
        // avec sa propre horloge recalee, personne n'attend le signal d'un
        // autre.
        const tous = this.joueurs.size === this.max &&
                     [...this.joueurs.values()].every(x => x.pret);
        if (tous && !this.departA) {
          // L'ordre des couloirs est l'ordre d'inscription : l'hote a ouvert
          // la salle, il passe le premier. C'est arbitraire mais stable, et
          // les deux clients doivent en avoir exactement le meme.
          this.ordre = [...this.joueurs.values()].map((x, i) => ({
            id: x.id, nom: x.nom, couloir: i + 1,
          }));
          // Seul sur la piste, on ne se presente a personne : la sequence est
          // faite pour qu'on se regarde avant de courir, et six secondes de
          // presentation face a des couloirs vides ne sont plus qu'une attente.
          // On passe directement au pistolet.
          const seul = this.ordre.length < 2;
          this.presentationA = seul ? null : Date.now() + AVANT_PRESENTATION_MS;
          // Le pistolet tombe apres que tout le monde soit passe. Une seule
          // soustraction cote client suffit alors a savoir ou l'on en est.
          this.departA = seul
            ? Date.now() + AVANT_DEPART_MS
            : this.presentationA
              + this.ordre.length * creneauPresentation()
              + AVANT_DEPART_MS;
          this.termine = false;
          for (const x of this.joueurs.values()) { x.d = 0; x.fin = null; x.parti = false; }
        }
        this.envoyerEtat();
        return;
      }

      // --- signalisation WebRTC ---------------------------------------------
      // La salle ne comprend rien a ce qu'elle transporte : une offre, une
      // reponse et des candidats ICE sont des donnees opaques qu'elle passe a
      // l'autre bout, en ajoutant seulement qui les envoie. C'est le minimum
      // qu'un point de rendez-vous doit faire, et c'est deja tout ce dont deux
      // navigateurs ont besoin pour s'entendre directement.
      case 'sdp':
      case 'ice': {
        this.vivante();
        this.diffuser({ t: m.t, de: j.id, charge: m.charge }, ws);
        return;
      }

      // Position en course. On ne renvoie que ce qui bouge, et on ne le
      // renvoie qu'a l'autre : se recevoir soi-meme en retard ferait sauter
      // son propre coureur.
      case 'pos': {
        const d = Number(m.d);
        if (!Number.isFinite(d) || d < 0 || d > 2000) return;
        // La distance ne recule pas : un paquet en retard ne doit pas faire
        // reculer l'adversaire a l'ecran.
        if (d > j.d) j.d = d;
        j.parti = true;
        this.vivante();
        this.diffuser({ t: 'pos', id: j.id, d: Math.round(j.d * 10) / 10 }, ws);
        return;
      }

      case 'fini': {
        if (j.fin !== null) return;
        const ms = Math.round(Number(m.ms));
        if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return;
        j.fin = ms;
        this.diffuser({ t: 'fini', id: j.id, nom: j.nom, ms });
        this.peutTrancher();
        return;
      }

      // Abandon volontaire, ou faux depart eliminatoire.
      case 'abandon': {
        if (j.fin !== null) return;
        j.fin = ABANDON_MS;
        this.diffuser({ t: 'fini', id: j.id, nom: j.nom, ms: j.fin, abandon: true });
        this.peutTrancher();
        return;
      }
    }
  }

  peutTrancher() {
    if (this.termine) return;
    const tous = [...this.joueurs.values()];
    if (tous.length < this.max || tous.some(x => x.fin === null)) return;
    this.termine = true;
    // De quelle course on parle : l'instant du pistolet, retenu avant d'etre
    // efface. Il ne sert qu'a nommer ce duel-la au classement, et il est le
    // seul nombre de la salle qui change a chaque depart.
    const course = this.departA || Date.now();
    this.departA = null;
    // La presentation appartient a la course qui vient d'avoir lieu : une
    // revanche en refera une neuve, avec l'ordre du moment.
    this.presentationA = null;
    this.ordre = [];

    // Le verdict est rendu : la salle n'a plus de raison d'etre eveillee. On
    // laisse le temps de le lire et de relancer, puis on ferme.
    this.programmerFermeture(APRES_RESULTAT_MS, 'course terminee');

    // L'ordre d'arrivee, quel que soit le nombre de partants. Un abandon porte
    // un chrono sentinelle, donc il se range naturellement en dernier.
    const ordre = [...tous].sort((a, b) => a.fin - b.fin);
    const classement = ordre.map((x, i) => ({
      place: i + 1, id: x.id, nom: x.nom, ms: x.fin,
      abandon: x.fin >= ABANDON_MS,
    }));

    const message = { t: 'resultat', classement, partants: tous.length };

    // A deux, c'est un duel : on garde les champs historiques pour que
    // l'annonce du resultat et le classement des duels continuent de
    // fonctionner tels quels.
    if (this.max === 2) {
      const hote = tous.find(x => x.id === this.hote) || tous[0];
      const invite = tous.find(x => x !== hote);
      // L'hote a lance la partie : c'est lui l'initiateur, au sens du bareme.
      message.issue = hote.fin < invite.fin ? 'challenger'
                    : hote.fin > invite.fin ? 'opponent' : 'draw';
      message.hote = { id: hote.id, nom: hote.nom, ms: hote.fin };
      message.invite = { id: invite.id, nom: invite.nom, ms: invite.fin };
      this.diffuser(message);

      // Les points passent par le meme chemin que ceux d'un defi differe : une
      // course en direct et un defi rejoue en fantome doivent compter pareil.
      // On n'attend pas l'ecriture pour annoncer le resultat — si la base est
      // indisponible, la course reste jouee et affichee, seuls les points
      // manquent, ce qui vaut mieux que deux joueurs bloques sur une attente.
      const ecrire = this.ecrire(hote, invite, course);
      if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
      return;
    }

    // A trois ou plus, c'est une course : un classement, et rien au classement
    // des duels. Le bareme est fait pour une paire — l'etendre a huit
    // supposerait d'inventer une regle qu'on n'a pas, et le premier reflexe
    // (vingt-huit duels croises pour huit partants) gonflerait le classement
    // sans rien mesurer de juste. Les series de championnat, elles, ont leur
    // propre chemin d'enregistrement.
    this.diffuser(message);
  }

  async ecrire(hote, invite, course) {
    try {
      const base = this.test && this.env.DB_TEST ? this.env.DB_TEST : this.env.DB;
      if (!base || !this.code) return;
      // Prefixe distinct : un code de salle et un code de defi vivent dans le
      // meme espace de cles, et rien ne garantit qu'ils ne se croisent jamais.
      //
      // Et la course fait partie du nom, pas seulement la salle. Un duel ne se
      // resout qu'une fois — c'est la cle de duel_results qui le garantit — si
      // bien qu'avec le seul code de salle, la revanche etait vue comme le
      // meme duel : elle se courait, s'affichait, annoncait un vainqueur, et
      // ne rapportait rien. Une salle vit quarante-cinq secondes apres le
      // verdict justement pour qu'on la relance ; chaque depart est donc un
      // duel a lui.
      const points = await appliquerDuel(base, {
        id: 'LIVE-' + this.code + '-' + course,
        challengerName: hote.nom,
        opponentName: invite.nom,
        challengerMs: hote.fin,
        opponentMs: invite.fin,
      });
      this.annoncerPoints(hote, invite, points);
    } catch (e) { /* le classement se passera de ce duel */ }
  }

  /**
   * Ce que le duel a rapporte, dit aux deux joueurs.
   *
   * Sans cela, une course en direct comptait en silence : les points partaient
   * au classement, l'ecran de fin montrait deux chronos, et il fallait aller
   * ouvrir le tableau pour deviner ce qui avait bouge. Un defi releve, lui,
   * annonce ses points a l'arrivee depuis toujours — c'est la reponse de la
   * route qui les porte. Le direct n'a pas de reponse a porter : la course est
   * finie quand l'ecriture commence.
   *
   * D'ou un message de suite, et non un champ de plus dans `resultat` :
   * l'ecriture est volontairement hors du chemin de l'annonce, pour qu'une
   * base indisponible ne laisse pas deux joueurs devant un ecran vide. Le
   * verdict part donc toujours le premier, les points quand ils existent.
   *
   * Chacun est nomme par son identifiant plutot que par son role : le jeu
   * prend le sien sans avoir a savoir ce que « lanceur » veut dire ici.
   */
  annoncerPoints(hote, invite, points) {
    // Un duel deja tranche ne redistribue rien : il n'y a pas de points a
    // annoncer, et un « 0 PL » se lirait comme un match nul.
    if (!points || points.deja || typeof points.lp !== 'number') return;
    this.diffuser({
      t: 'duel',
      hote: {
        id: hote.id, lp: points.lp_adverse, rang: points.rang_adverse,
        monte: !!points.monte_adverse, descend: !!points.descend_adverse,
      },
      invite: {
        id: invite.id, lp: points.lp, rang: points.rang,
        monte: !!points.monte, descend: !!points.descend,
      },
    });
  }

  // Purge : une salle qui n'a plus servi depuis longtemps ne garde rien.
  perimee() {
    return Date.now() - this.ne > VIE_SALLE_MS && this.joueurs.size === 0;
  }
}
