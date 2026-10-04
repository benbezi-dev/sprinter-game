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
import { EPREUVES } from './epreuves.js';

/**
 * Les epreuves qu'une salle va courir, a partir de ce que l'hote a demande.
 *
 * Celles d'un seul jeu : une salle court du sprint ou des haies, jamais les
 * deux, et c'est la premiere epreuve reconnue qui decide du jeu. Trois au plus,
 * le 100 m quand rien n'est reconnaissable.
 */
export function epreuvesDeSalle(demande) {
  const connues = String(demande || '100').split(',')
    .filter(r => Object.prototype.hasOwnProperty.call(EPREUVES, r));
  const jeu = connues.length ? EPREUVES[connues[0]].jeu : 'sprinter';
  const eps = connues.filter(r => EPREUVES[r].jeu === jeu).slice(0, 3);
  return eps.length ? eps : ['100'];
}

/**
 * Un partant sans nom ne se classe pas.
 *
 * Le jeu envoie « Anonyme » a la place d'un nom vide, et la salle fait de meme
 * quand il n'envoie rien. Compter ces courses-la ferait une seule ligne de
 * classement pour tous ceux qui n'ont pas de nom — des inconnus qui se
 * partagent des points — et deux anonymes ne se rencontreraient meme pas : ils
 * portent la meme cle. Le jeu demande donc un nom valide avant d'ouvrir ou de
 * rejoindre une salle ; la salle, elle, ne range rien sous un nom qui n'en est
 * pas un, pour les versions du jeu qui ne le demandaient pas encore.
 */
export function estAnonyme(nom) {
  const n = String(nom || '').trim().toLowerCase();
  return !n || n === 'anonyme';
}

/**
 * LES DUELS D'UNE COURSE EN DIRECT, DE DEUX A HUIT COULOIRS.
 *
 * Une course en direct reste un duel, a deux comme a huit : chaque partant a
 * couru contre chacun des autres, au meme coup de pistolet, et le classement
 * des duels compte chacune de ces rencontres. Huit partants, c'est donc sept
 * duels pour chacun — gagnes contre ceux qu'on devance, perdus contre ceux qui
 * nous devancent, nuls a la milliseconde pres. C'est ce qu'on a vecu sur la
 * piste, et c'est la seule lecture qui n'invente rien : le bareme reste celui
 * d'une paire, il s'applique simplement a toutes les paires de la course.
 *
 * QUI LANCE, DANS CHAQUE PAIRE. Le bareme distingue celui qui lance de celui
 * qui releve. A deux, l'hote a toujours ete l'initiateur — il a ouvert la
 * salle — et cela ne change pas. Entre deux invites, c'est le premier arrive
 * dans la salle : un ordre arbitraire mais stable, le meme que celui des
 * couloirs.
 *
 * DANS QUEL ORDRE. Les duels s'appliquent les uns apres les autres, et la
 * serie de victoires depend de l'ordre : le quatrieme sur huit a battu quatre
 * coureurs et en a perdu trois, et sa serie doit finir eteinte — il a ete
 * battu dans cette course. On applique donc, pour chaque coureur, ses
 * victoires AVANT ses defaites : les paires sont rangees de celle dont le
 * meilleur des deux est le moins bien place a celle dont il est le premier.
 * Le vainqueur, lui, aligne ses sept victoires d'affilee.
 *
 * L'IDENTIFIANT DE CHAQUE RENCONTRE. A deux, c'est celui de toujours —
 * `LIVE-<salle>-<pistolet>` — pour que l'historique deja en base se relise
 * comme avant. Au-dela, le lanceur s'y ajoute : la cle de duel_results est le
 * couple (rencontre, releveur), et un meme coureur releve plusieurs fois dans
 * la meme course.
 *
 * Les anonymes courent, et ne comptent pas (voir estAnonyme). Rendu dans
 * l'ordre ou il faut ecrire ; vide quand il reste moins de deux partants
 * nommes.
 */
export function rencontresDeLaCourse(partants, { code, course, hote = null }) {
  const nommes = (partants || []).filter(x => x && !estAnonyme(x.nom));
  // L'hote d'abord, les autres dans l'ordre ou ils sont arrives.
  const roles = [
    ...nommes.filter(x => x.id === hote),
    ...nommes.filter(x => x.id !== hote),
  ];
  if (roles.length < 2) return [];
  // La place de chacun dans TOUTE la course, anonymes compris : finir
  // troisieme derriere un anonyme reste finir troisieme.
  const place = x => 1 + (partants || []).filter(y => y && y.fin < x.fin).length;
  const deux = roles.length === 2 && (partants || []).length === 2;
  const paires = [];
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const lanceur = roles[i], releveur = roles[j];
      paires.push({
        id: `LIVE-${code}-${course}` + (deux ? '' : `-${lanceur.id}`),
        lanceur, releveur,
        meilleure: Math.min(place(lanceur), place(releveur)),
        rang: paires.length,
      });
    }
  }
  paires.sort((a, b) => (b.meilleure - a.meilleure) || (a.rang - b.rang));
  return paires.map(({ id, lanceur, releveur }) => ({ id, lanceur, releveur }));
}

/**
 * LE TOURNOI A ELIMINATION : QUI SORT A L'ISSUE D'UNE MANCHE.
 *
 * De trois a huit partants, la piste court des manches successives et le
 * DERNIER de chacune sort, jusqu'a la finale a deux. Huit, ce sont sept
 * manches ; trois, deux. C'est le format de l'elimination des velodromes :
 * on ne gagne pas une manche, on evite d'en etre le dernier.
 *
 * Trois cas, et chacun a sa raison :
 *
 * - le dernier, au chrono, sort. Un abandon ou un faux depart porte le chrono
 *   sentinelle : il est donc dernier, et c'est lui qui sort.
 * - DEUX DERNIERS EX AEQUO SORTENT ENSEMBLE. Deux faux departs dans la meme
 *   manche, c'est deux disqualifies ; departager l'un par l'autre a la
 *   milliseconde inventerait un vainqueur la ou il n'y a que deux fautes.
 * - mais si TOUT LE MONDE est a egalite — tous en faux depart, ou une arrivee
 *   impossible a separer — personne ne sort : la manche se recourt. Vider la
 *   piste d'un coup ne laisserait aucun champion.
 *
 * Un partant qui a quitte la salle pendant la manche sort quoi qu'il arrive
 * (`forfait`) : il ne courra pas la suivante, et la garder en lice ferait
 * attendre tout le monde devant un couloir vide.
 *
 * Rend les identifiants qui sortent, dans l'ordre d'arrivee.
 */
export function eliminesDeLaManche(partants) {
  const liste = (partants || []).filter(x => x && x.id);
  if (liste.length < 2) return [];
  const pire = Math.max(...liste.map(x => x.fin));
  const derniers = liste.filter(x => x.fin === pire);
  const sortis = new Set(derniers.length < liste.length ? derniers.map(x => x.id) : []);
  for (const x of liste) if (x.forfait) sortis.add(x.id);
  return [...liste].sort((a, b) => a.fin - b.fin)
    .filter(x => sortis.has(x.id)).map(x => x.id);
}

/** Un tournoi neuf, qui attend que la piste soit pleine et prete. */
function nouveauTournoi() {
  return {
    // 'inscription' : on remplit la piste ; 'manche' : une manche se court ;
    // 'pause' : entre deux manches ; 'fini' : le champion est connu.
    etat: 'inscription',
    manche: 0,       // la manche en cours, ou la derniere courue
    manches: 0,      // combien il en faudra en tout, si personne n'est ex aequo
    en_lice: [],     // les identifiants encore en course
    elimines: [],    // dans l'ordre ou ils sont sortis, avec leur place finale
    champion: null,
    prochaine_a: null, // le depart automatique de la manche suivante
  };
}

/**
 * Ajoute un duel au bilan de course d'un partant.
 *
 * Le bilan dit ce qu'on lit a l'arrivee : les points de toute la course, la
 * division ou l'on finit, celle d'ou l'on partait, la serie avant le premier
 * duel et apres le dernier — et chaque duel, pour le journal.
 */
function noterBilan(bilans, moi, lui, gagne, nul, p) {
  let b = bilans.get(moi.id);
  if (!b) {
    b = { lp: 0, rang: null, palier_avant: p.palier_avant ?? 0,
          serie: 0, serie_avant: p.serie_avant ?? 0, duels: [] };
    bilans.set(moi.id, b);
  }
  b.lp += Number(p.lp) || 0;
  b.rang = p.rang || b.rang;
  b.serie = p.serie ?? b.serie;
  b.duels.push({
    id: lui.id, nom: lui.nom,
    issue: nul ? 'nul' : gagne ? 'gagne' : 'perdu',
    lp: Number(p.lp) || 0,
  });
}
import { avantDepart } from './depart.js';
import { rapideRecevable, DebitRapide } from './tchat-rapide.js';

// Personne n'attend indefiniment : une salle sans vie est liberee.
const VIE_SALLE_MS = 20 * 60 * 1000;
// Un Durable Object est facture au temps ou il reste eveille, et une WebSocket
// ouverte l'y maintient. Une salle qui a rendu son verdict ne sert plus a rien
// mais coute autant qu'une salle en pleine course : on la ferme.
//
// Pas immediatement — les joueurs regardent leur resultat et peuvent vouloir
// remettre ca. On leur laisse le temps de se decider, et le moindre « pret »
// annule la fermeture.
//
// Quatre-vingt-dix secondes, et non plus quarante-cinq : la revanche se propose
// maintenant depuis l'ecran de fin, ou l'on commence par lire son chrono, son
// ecart, ses points, et parfois par revoir l'arrivee. Quarante-cinq secondes
// fermaient la piste sous les yeux de qui s'appretait a appuyer. Une salle
// fermee se rouvre sous le meme code (voir Salle.rouvrir dans src/game/live.ts),
// mais celui qui la rouvre ne voit plus qui l'attend ; mieux vaut qu'elle soit
// encore la.
const APRES_RESULTAT_MS = 90 * 1000;
// Et une salle ou il ne se passe rien finit aussi par fermer, sans quoi deux
// joueurs qui l'ouvrent et s'en vont la laisseraient eveillee vingt minutes.
const INACTIVITE_MS = 4 * 60 * 1000;
// Delai entre « tout le monde est pret » et le depart. Assez long pour absorber
// une latence mediocre, assez court pour ne pas ennuyer. Le depart part au
// decompte, sur les deux canaux. Voir depart.js.
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
 * course. A un, c'est un tour de piste seul. De deux a huit, ce sont des
 * duels : chacun contre chacun des autres, avec des points qui changent de
 * main a chaque paire (voir rencontresDeLaCourse). A deux, il y en a un ; a
 * huit, sept par partant, et un ordre d'arrivee pour les raconter.
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

/**
 * LE TOURNOI COMMENCE A TROIS.
 *
 * A deux, eliminer le dernier, c'est deja la finale : le tournoi ne serait
 * qu'un duel avec un autre titre. Une piste plus petite qui le demande court
 * donc comme avant, en course simple.
 */
const TOURNOI_MIN = 3;
/**
 * Le temps de lire sa manche avant la suivante.
 *
 * Elle part plus tot si tous ceux qui restent en lice se sont dits prets, et
 * d'elle-meme a l'heure dite sinon : un tournoi a huit, ce sont sept manches,
 * et un seul joueur parti chercher un verre ne doit pas tenir les six autres.
 * Trente secondes, parce que c'est ce que prend un ecran de fin quand on le
 * lit — son chrono, sa place, ses points — et qu'on veut le lire.
 */
const ENTRE_MANCHES_MS = 30 * 1000;
/**
 * LE RETARDATAIRE.
 *
 * Une manche se tranche quand tout le monde a franchi la ligne, et un
 * telephone en veille ne la franchira jamais : sans limite, la manche
 * attendrait indefiniment et le tournoi avec elle. Le premier arrive ouvre
 * donc un delai — autant de temps qu'il en a mis lui-meme, vingt secondes au
 * moins — apres quoi ceux qui courent encore sont comptes en abandon. Courir
 * deux fois plus lentement que le premier, c'est ne plus courir.
 */
const RETARD_MIN_MS = 20 * 1000;

function net(nom) {
  const s = String(nom || '').trim().slice(0, 20).replace(/[<>]/g, '');
  return s || 'Anonyme';
}

export class SalleDirecte {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, {id:string,nom:string,pret:boolean,d:number,c:number|null,fin:number|null,parti:boolean}>} */
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
    this.debitRapide = new DebitRapide();  // la cadence du tchat rapide
    this.tournoi = null;       // le tournoi a elimination, si l'hote l'a demande
    this.coureurs = [];        // tournoi : les partants de la manche en cours
    this.minuteurTournoi = null; // tournoi : la limite de la manche, ou la suivante
    this.limiteManche = null;  // tournoi : l'instant ou les retardataires abandonnent
  }

  // --- utilitaires ---------------------------------------------------------

  /** Etat public de la salle, tel que le voit un client. */
  vue() {
    const t = this.tournoi;
    const lances = this.tournoiLance();
    const joueurs = [...this.joueurs.values()].map((j, i) => ({
      id: j.id, nom: j.nom, pret: j.pret, d: Math.round(j.d * 10) / 10,
      fin: j.fin, hote: j.id === this.hote,
      // Le couloir suit l'ordre d'arrivee sur la piste. Il sert au jeu a
      // placer chaque adversaire, et a la presentation a les faire passer.
      //
      // En tournoi, il est fixe au premier pistolet et ne bouge plus : un
      // elimine qui quitte la salle decalerait sinon tous ceux d'apres, et
      // l'on changerait de couloir d'une manche a l'autre sans avoir rien
      // demande.
      couloir: lances && j.couloir ? j.couloir : i + 1,
      // Tournoi : encore en course, ou sorti. Le jeu ne met sur la piste que
      // ceux qui courent ; les autres regardent.
      ...(t ? { en_lice: !lances || t.en_lice.includes(j.id) } : {}),
    }));
    return {
      joueurs, epreuves: this.epreuves, niveau: this.niveau, max: this.max,
      tournoi: t ? { ...t, en_lice: t.en_lice.slice(), elimines: t.elimines.slice() } : null,
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
      this.viderPiste();
    }, delai);
  }

  /**
   * Plus personne sur la piste : ce qu'elle courait ne la concerne plus.
   *
   * Une salle fermee se rouvre sous le meme code, et c'est ce qui permet une
   * revanche sans en creer une autre. Le premier qui revient fixe a nouveau
   * l'hote, les epreuves et la taille ; mais un depart reste pose — une salle
   * fermee pour inactivite en pleine course — annoncait a celui qui revenait un
   * pistolet tire depuis longtemps, et le faisait partir seul, sur-le-champ.
   * Un `termine` reste vrai disait aussi au nouvel arrivant qu'une course venait
   * de finir, alors qu'il n'en avait couru aucune.
   */
  viderPiste() {
    this.departA = null;
    this.presentationA = null;
    this.ordre = [];
    this.termine = false;
    // Le tournoi aussi : celui qui revient le premier refonde la piste, et il
    // dit lui-meme s'il veut un tournoi. Un minuteur de manche laisse en
    // route relancerait une course dans une salle vide.
    clearTimeout(this.minuteurTournoi); this.minuteurTournoi = null;
    this.limiteManche = null;
    this.coureurs = [];
    this.tournoi = null;
  }

  /** Un tournoi est-il en train de se courir — manche, ou pause entre deux ? */
  tournoiLance() {
    const e = this.tournoi && this.tournoi.etat;
    return e === 'manche' || e === 'pause';
  }

  /** Ce joueur court-il la manche en cours ? */
  court(j) {
    return !!this.tournoi && this.tournoi.etat === 'manche' && this.coureurs.includes(j);
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
        complete: this.joueurs.size >= this.max || this.tournoiLance(),
        // Un tournoi lance ne prend plus personne, meme quand un couloir s'est
        // libere : on n'entre pas a la cinquieme manche d'une elimination.
        en_cours: this.tournoiLance(),
        ...this.vue(),
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }

    if (this.joueurs.size >= this.max) {
      return new Response('salle complete', { status: 409 });
    }
    if (this.tournoiLance()) {
      return new Response('tournoi en cours', { status: 409 });
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
      this.epreuves = epreuvesDeSalle(url.searchParams.get('races'));
      const n = parseInt(url.searchParams.get('level') || '4', 10);
      this.niveau = Number.isFinite(n) && n >= 0 && n <= 5 ? n : 4;
      // Seul le premier arrive decide de la taille : la changer en cours de
      // route ferait entrer ou sortir des gens d'une course deja formee.
      const m = parseInt(url.searchParams.get('max') || String(DEFAUT_JOUEURS), 10);
      this.max = Number.isFinite(m)
        ? Math.max(PLANCHER_JOUEURS, Math.min(PLAFOND_JOUEURS, m))
        : DEFAUT_JOUEURS;
      // Le tournoi aussi se decide a l'ouverture, et seulement a partir de
      // trois couloirs (voir TOURNOI_MIN).
      this.tournoi = url.searchParams.get('tournoi') === '1' && this.max >= TOURNOI_MIN
        ? nouveauTournoi() : null;
    }

    this.joueurs.set(serveur, {
      id, nom, pret: false, d: 0, c: null, fin: null, parti: false,
      couloir: null, forfait: false,
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
    this.debitRapide.oublier(j.id);
    // TOURNOI : PARTIR, C'EST DECLARER FORFAIT. En pleine manche, on compte
    // un abandon — les autres voient son couloir s'arreter, et la manche peut
    // se trancher sans lui. Entre deux manches, on sort tout de suite.
    const t = this.tournoi;
    if (t && this.court(j)) {
      j.forfait = true;
      if (j.fin === null) {
        j.fin = ABANDON_MS;
        this.diffuser({ t: 'fini', id: j.id, nom: j.nom, ms: j.fin, abandon: true });
      }
    } else if (t && t.etat === 'pause' && t.en_lice.includes(j.id)) {
      this.forfaitEntreManches(j);
    }
    // Un depart en pleine course laisse l'autre seul : on le lui dit plutot
    // que de le laisser courir contre un couloir vide.
    this.diffuser({ t: 'sorti', id: j.id, nom: j.nom, ...this.vue() });
    // Plus personne : on eteint le minuteur. Un setTimeout en attente suffit a
    // maintenir l'objet eveille, et donc facture, pour rien.
    if (this.joueurs.size === 0) {
      this.viderPiste();
      clearTimeout(this.minuteur); this.minuteur = null;
      return;
    }
    // Le forfait a peut-etre ete la derniere arrivee qu'on attendait, ou le
    // dernier « pas pret » d'une pause.
    if (t && t.etat === 'manche') this.peutTrancher();
    else if (t && t.etat === 'pause') {
      this.pretTournoi();
      if (this.tournoi && this.tournoi.etat === 'manche') this.envoyerEtat();
    }
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
        // En tournoi, « pret » ne fait pas partir la meme chose selon le
        // moment : le premier pistolet, la manche suivante, ou un tournoi neuf.
        if (this.tournoi) {
          this.pretTournoi();
          this.envoyerEtat();
          return;
        }
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
          const attente = avantDepart(this.test, AVANT_DEPART_MS);
          this.departA = seul
            ? Date.now() + attente
            : this.presentationA
              + this.ordre.length * creneauPresentation()
              + attente;
          this.termine = false;
          for (const x of this.joueurs.values()) { x.d = 0; x.c = null; x.fin = null; x.parti = false; }
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
      //
      // AVEC L'INSTANT DE SA COURSE. `c` est le chronometre de l'emetteur au
      // moment ou il etait a `d`, en millisecondes depuis son coup de
      // pistolet. Le relayer permet a chaque ecran de montrer les autres la ou
      // ils en sont a SON instant de course, sur la meme echelle que les
      // chronos que l'on compare a l'arrivee — et non la ou ils etaient quand
      // le paquet est parti. Sans lui, un duel serre s'affichait a l'envers :
      // voir recevoirPosition dans src/game/sprinter-app.js. Un client qui ne
      // l'envoie pas n'en recoit simplement pas.
      //
      // Au centimetre, plus au decimetre : l'autre en tire une vitesse sur un
      // dixieme de seconde, et dix centimetres d'arrondi y faisaient un metre
      // par seconde d'erreur.
      case 'pos': {
        // Un elimine ne court plus : il regarde.
        if (this.tournoi && !this.court(j)) return;
        const d = Number(m.d);
        if (!Number.isFinite(d) || d < 0 || d > 2000) return;
        const c = Number(m.c);
        const date = m.c != null && Number.isFinite(c) && c >= 0 && c <= MAX_MS;
        // La distance ne recule pas : un paquet en retard ne doit pas faire
        // reculer l'adversaire a l'ecran. A distance egale, l'instant avance
        // quand meme : c'est ainsi que l'autre apprend qu'on s'est arrete.
        if (d >= j.d) { j.d = d; j.c = date ? Math.round(c) : null; }
        j.parti = true;
        this.vivante();
        const pos = { t: 'pos', id: j.id, d: Math.round(j.d * 100) / 100 };
        if (j.c != null) pos.c = j.c;
        this.diffuser(pos, ws);
        return;
      }

      case 'fini': {
        if (j.fin !== null) return;
        if (this.tournoi && !this.court(j)) return;
        const ms = Math.round(Number(m.ms));
        if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return;
        j.fin = ms;
        this.diffuser({ t: 'fini', id: j.id, nom: j.nom, ms });
        // Le premier arrive d'une manche ouvre le delai des retardataires.
        if (this.tournoi) this.limiterManche(Date.now() + Math.max(RETARD_MIN_MS, ms));
        this.peutTrancher();
        return;
      }

      // Abandon volontaire, ou faux depart eliminatoire.
      case 'abandon': {
        if (j.fin !== null) return;
        if (this.tournoi && !this.court(j)) return;
        j.fin = ABANDON_MS;
        this.diffuser({ t: 'fini', id: j.id, nom: j.nom, ms: j.fin, abandon: true });
        this.peutTrancher();
        return;
      }

      // Le tchat rapide : un identifiant de la liste, jamais du texte (voir
      // tchat-rapide.js). Il repart chez tout le monde, l'envoyeur compris :
      // sa bulle s'affiche quand la salle l'a acceptee, pas avant.
      //
      // Il ne tient pas la salle en vie : une salle ferme quand on n'y court
      // plus, et six phrases toutes les vingt secondes suffiraient sinon a la
      // garder eveillee — et facturee — indefiniment.
      case 'rapide': {
        if (!rapideRecevable(m.q)) return;
        const refus = this.debitRapide.juger(j.id);
        if (refus === 'debit') {
          try { ws.send(JSON.stringify({ t: 'rapide_refus', raison: refus })); } catch (e) { }
        }
        if (refus) return;
        this.diffuser({ t: 'rapide', id: j.id, nom: j.nom, q: m.q });
        return;
      }
    }
  }

  peutTrancher() {
    if (this.tournoi) { this.trancherManche(); return; }
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
    // LA REVANCHE SE DEMANDE A TOUT LE MONDE, ET DE NOUVEAU.
    //
    // « Pret » valait pour la course qui vient de finir, et il restait pose
    // apres elle. Le premier qui se declarait pret pour la suivante trouvait
    // donc tous les autres deja prets — de la course d'avant — et relancait la
    // salle a lui seul : ses adversaires, encore sur leur ecran de resultat, se
    // retrouvaient tires vers une presentation qu'ils n'avaient pas demandee.
    // Chacun redit maintenant oui ; la salle repart quand le dernier l'a dit.
    for (const x of tous) x.pret = false;

    // Le verdict est rendu : la salle n'a plus de raison d'etre eveillee. On
    // laisse le temps de le lire et de relancer, puis on ferme.
    this.programmerFermeture(APRES_RESULTAT_MS, 'course terminee');

    // L'ordre d'arrivee, quel que soit le nombre de partants. Un abandon porte
    // un chrono sentinelle, donc il se range naturellement en dernier.
    //
    // Une egalite a la milliseconde partage la place, comme sur une vraie
    // piste : on compte ceux qui sont arrives STRICTEMENT avant. Numeroter
    // dans l'ordre du tri donnait « 1er » a l'un et « 2e » a l'autre pour le
    // meme temps, selon l'ordre ou les telephones s'etaient connectes — et
    // contredisait le tableau de course, qui donne deja la meme place aux deux.
    const ordre = [...tous].sort((a, b) => a.fin - b.fin);
    const classement = ordre.map(x => ({
      place: 1 + ordre.filter(y => y.fin < x.fin).length, id: x.id, nom: x.nom, ms: x.fin,
      abandon: x.fin >= ABANDON_MS,
    }));

    // `course` voyage avec le verdict : c'est l'instant du pistolet, le seul
    // nombre qui distingue une revanche de la course d'avant dans la meme
    // salle. Le jeu s'en sert pour tenir une ligne de journal par course.
    const message = { t: 'resultat', classement, partants: tous.length, course };

    // A deux, on garde les champs historiques — l'issue, l'hote, l'invite —
    // pour que les versions du jeu qui ne lisent qu'eux continuent d'afficher
    // le duel tel quel.
    if (this.max === 2 && tous.length === 2) {
      const hote = tous.find(x => x.id === this.hote) || tous[0];
      const invite = tous.find(x => x !== hote);
      // L'hote a lance la partie : c'est lui l'initiateur, au sens du bareme.
      message.issue = hote.fin < invite.fin ? 'challenger'
                    : hote.fin > invite.fin ? 'opponent' : 'draw';
      message.hote = { id: hote.id, nom: hote.nom, ms: hote.fin };
      message.invite = { id: invite.id, nom: invite.nom, ms: invite.fin };
    }
    this.diffuser(message);
    // Puis l'etat : personne n'est plus pret, et c'est de la que part la
    // revanche. Apres le verdict, pour que l'ecran de fin soit deja la
    // quand il arrive.
    this.envoyerEtat();

    // De deux a huit, chaque paire de partants est un duel (voir
    // rencontresDeLaCourse). Seul sur la piste, il n'y a personne a battre.
    //
    // Les points passent par le meme chemin que ceux d'un defi differe : une
    // course en direct et un defi rejoue en fantome doivent compter pareil.
    // On n'attend pas l'ecriture pour annoncer le resultat — si la base est
    // indisponible, la course reste jouee et affichee, seuls les points
    // manquent, ce qui vaut mieux que des joueurs bloques sur une attente.
    // Les series de championnat, elles, ont leur propre salle et leur propre
    // chemin d'enregistrement.
    if (tous.length < 2) return;
    const ecrire = this.ecrire(tous, course);
    if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
  }

  /* -------------------------------------------------------------------------
     LE TOURNOI A ELIMINATION
     -------------------------------------------------------------------------
     Une piste de trois a huit couloirs, ouverte en tournoi. Elle se remplit
     comme une autre ; au premier « pret » general part la manche 1, avec la
     presentation de tout le monde. Le dernier sort. Ceux qui restent courent
     la manche suivante — trente secondes plus tard, ou des que tous se sont
     dits prets — et ainsi de suite jusqu'a la finale a deux, presentee elle
     aussi. Son vainqueur est le champion.

     CHAQUE MANCHE EST UNE COURSE EN DIRECT, ET COMPTE COMME TELLE. Chaque
     paire de partants y est un duel au classement (rencontresDeLaCourse) :
     c'est ce qui s'est passe sur la piste, manche apres manche. Les elimines
     ne courent plus, et ne comptent donc plus ; ils restent dans la salle et
     regardent la suite.
  ------------------------------------------------------------------------- */

  /** Un « pret » vient de changer : de quoi faire partir quelque chose ? */
  pretTournoi() {
    const t = this.tournoi;
    if (!t) return;
    const presents = [...this.joueurs.values()];
    if (t.etat === 'inscription' || t.etat === 'fini') {
      // Le premier pistolet, ou un tournoi neuf : comme une course simple,
      // la piste pleine et tout le monde d'accord.
      if (presents.length === this.max && presents.every(x => x.pret)) this.demarrerTournoi();
    } else if (t.etat === 'pause') {
      // La suite : seuls ceux qui courent encore ont leur mot a dire.
      const enLice = presents.filter(x => t.en_lice.includes(x.id));
      if (enLice.length >= 2 && enLice.every(x => x.pret)) this.lancerManche();
    }
  }

  /** Tout le monde au depart de la manche 1, chacun dans son couloir. */
  demarrerTournoi() {
    const presents = [...this.joueurs.values()];
    presents.forEach((x, i) => { x.couloir = i + 1; });
    this.tournoi = {
      ...nouveauTournoi(),
      manches: presents.length - 1,
      en_lice: presents.map(x => x.id),
    };
    this.lancerManche();
  }

  /**
   * La manche suivante : ceux qui sont encore en lice, dans leurs couloirs.
   *
   * La presentation n'a lieu qu'a la premiere et a la finale. Elle dure trois
   * secondes par athlete : a huit, la refaire a chaque manche ajouterait plus
   * d'une minute et demie d'attente a un tournoi qui se court en dix secondes
   * par manche — et entre deux, on sait deja qui est la.
   */
  lancerManche() {
    const t = this.tournoi;
    if (!t) return;
    clearTimeout(this.minuteurTournoi); this.minuteurTournoi = null;
    const coureurs = [...this.joueurs.values()]
      .filter(x => t.en_lice.includes(x.id))
      .sort((a, b) => a.couloir - b.couloir);
    if (coureurs.length < 2) { this.finirTournoi(); return; }
    t.manche++;
    t.etat = 'manche';
    t.prochaine_a = null;
    this.coureurs = coureurs;
    this.ordre = coureurs.map(x => ({ id: x.id, nom: x.nom, couloir: x.couloir }));
    const presenter = t.manche === 1 || coureurs.length === 2;
    this.presentationA = presenter ? Date.now() + AVANT_PRESENTATION_MS : null;
    const attente = avantDepart(this.test, AVANT_DEPART_MS);
    this.departA = presenter
      ? this.presentationA + coureurs.length * creneauPresentation() + attente
      : Date.now() + attente;
    this.termine = false;
    for (const x of this.joueurs.values()) {
      x.d = 0; x.c = null; x.fin = null; x.parti = false; x.forfait = false;
    }
    // Le filet : personne ne reste en piste plus de trois minutes apres le
    // pistolet, meme si personne n'arrive (voir RETARD_MIN_MS).
    this.limiteManche = null;
    this.limiterManche(this.departA + ABANDON_MS);
    this.vivante();
  }

  /** Ramene la limite de la manche a cette date, si elle est plus proche. */
  limiterManche(date) {
    if (!this.tournoi || this.tournoi.etat !== 'manche') return;
    if (this.limiteManche != null && this.limiteManche <= date) return;
    this.limiteManche = date;
    clearTimeout(this.minuteurTournoi);
    this.minuteurTournoi = setTimeout(() => this.cloreManche(),
                                      Math.max(0, date - Date.now()));
  }

  /** L'heure est passee : ceux qui courent encore abandonnent. */
  cloreManche() {
    this.minuteurTournoi = null;
    if (!this.tournoi || this.tournoi.etat !== 'manche') return;
    for (const x of this.coureurs) {
      if (x.fin !== null) continue;
      x.fin = ABANDON_MS;
      this.diffuser({ t: 'fini', id: x.id, nom: x.nom, ms: x.fin, abandon: true });
    }
    this.trancherManche();
  }

  /**
   * Le verdict d'une manche : l'ordre d'arrivee, qui sort, et la suite.
   *
   * Le message est celui d'une course simple — un classement, des partants,
   * l'instant du pistolet — avec un bloc `tournoi` en plus, et chaque ligne
   * du classement dit si son coureur est elimine. Un jeu qui ne connait pas
   * le tournoi y lit donc une course ordinaire.
   */
  trancherManche() {
    const t = this.tournoi;
    if (!t || t.etat !== 'manche') return;
    const tous = this.coureurs;
    if (!tous.length || tous.some(x => x.fin === null)) return;
    clearTimeout(this.minuteurTournoi); this.minuteurTournoi = null;
    this.limiteManche = null;

    const course = this.departA || Date.now();
    this.departA = null;
    this.presentationA = null;
    this.ordre = [];
    this.termine = true;
    // Comme apres une course simple : la suite se redemande a chacun.
    for (const x of this.joueurs.values()) x.pret = false;

    const sortis = eliminesDeLaManche(tous.map(x => ({ id: x.id, fin: x.fin, forfait: x.forfait })));
    const ordre = [...tous].sort((a, b) => a.fin - b.fin);
    const classement = ordre.map(x => ({
      place: 1 + ordre.filter(y => y.fin < x.fin).length, id: x.id, nom: x.nom, ms: x.fin,
      abandon: x.fin >= ABANDON_MS, couloir: x.couloir,
      elimine: sortis.includes(x.id),
      ...(x.forfait ? { motif: 'forfait' } : {}),
    }));

    // La place dans le tournoi : ceux qui sortent ensemble prennent les
    // dernieres places de la manche, departages par leur chrono ; deux
    // abandons la partagent. Un forfait passe derriere tout le monde, meme
    // s'il avait franchi la ligne avant de partir : il n'est plus la pour la
    // suite, celui qui a fini dernier, si.
    const restent = tous.length - sortis.length;
    const sortants = ordre.filter(x => sortis.includes(x.id));
    const rang = x => (x.forfait ? 2 * ABANDON_MS : x.fin);
    for (const x of sortants) {
      t.elimines.push({
        id: x.id, nom: x.nom, manche: t.manche,
        place: restent + 1 + sortants.filter(y => rang(y) < rang(x)).length,
        ms: x.fin >= ABANDON_MS ? null : x.fin,
        abandon: x.fin >= ABANDON_MS, forfait: !!x.forfait,
      });
    }
    t.en_lice = t.en_lice.filter(id => !sortis.includes(id));
    t.manches = t.manche + t.en_lice.length - 1;

    if (t.en_lice.length <= 1) {
      this.finirTournoi();
    } else {
      // La pause : la manche suivante part d'elle-meme a l'heure dite, ou
      // plus tot si tout le monde est pret (pretTournoi).
      t.etat = 'pause';
      const attente = ENTRE_MANCHES_MS;
      t.prochaine_a = Date.now() + attente;
      this.minuteurTournoi = setTimeout(() => {
        this.minuteurTournoi = null;
        if (this.tournoi && this.tournoi.etat === 'pause') {
          this.lancerManche();
          this.envoyerEtat();
        }
      }, attente);
    }

    this.diffuser({
      t: 'resultat', classement, partants: tous.length, course,
      tournoi: {
        manche: t.manche, manches: t.manches, elimines: sortis,
        fini: t.etat === 'fini', champion: t.champion,
      },
    });
    this.envoyerEtat();

    // Les duels de la manche, comme ceux d'une course simple.
    if (tous.length < 2) return;
    const ecrire = this.ecrire(tous.slice(), course);
    if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
  }

  /** Parti pendant une pause : il sort, a la derniere place qui reste. */
  forfaitEntreManches(j) {
    const t = this.tournoi;
    t.en_lice = t.en_lice.filter(id => id !== j.id);
    t.elimines.push({
      id: j.id, nom: j.nom, manche: t.manche, place: t.en_lice.length + 1,
      ms: null, abandon: true, forfait: true,
    });
    t.manches = t.manche + t.en_lice.length - 1;
    if (t.en_lice.length <= 1) this.finirTournoi();
  }

  /**
   * Le champion est connu — ou personne ne reste, si tout le monde est parti.
   * La salle se comporte ensuite comme apres une course simple : on lit, on
   * peut redemander un tournoi a tout le monde, et elle ferme sinon.
   */
  finirTournoi() {
    const t = this.tournoi;
    if (!t) return;
    clearTimeout(this.minuteurTournoi); this.minuteurTournoi = null;
    this.limiteManche = null;
    this.coureurs = [];
    t.etat = 'fini';
    t.prochaine_a = null;
    const id = t.en_lice[0];
    const c = id ? [...this.joueurs.values()].find(x => x.id === id) : null;
    t.champion = c ? { id: c.id, nom: c.nom } : null;
    this.programmerFermeture(APRES_RESULTAT_MS, 'tournoi termine');
  }

  async ecrire(tous, course) {
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
      const rencontres = rencontresDeLaCourse(tous, {
        code: this.code, course, hote: this.hote,
      });
      const bilans = new Map();
      // Les duels s'ecrivent UN PAR UN, dans l'ordre rendu : chacun lit le
      // classement que le precedent vient d'ecrire, comme le recalcul qui
      // rejouera l'historique dans ce meme ordre.
      for (const r of rencontres) {
        let points = null;
        try {
          points = await appliquerDuel(base, {
            id: r.id,
            challengerName: r.lanceur.nom,
            opponentName: r.releveur.nom,
            challengerMs: r.lanceur.fin,
            opponentMs: r.releveur.fin,
            // La distance decide du classement touche : une course en direct
            // sur 400 m ne doit rien deplacer au classement du 100 m. La salle
            // les tient depuis le premier arrive, et c'est le meme programme
            // pour tout le monde.
            epreuves: this.epreuves,
          });
        } catch (e) { continue; /* les autres paires comptent quand meme */ }
        // Un duel deja tranche ne redistribue rien : il n'y a pas de points a
        // annoncer, et un « 0 LP » se lirait comme un match nul.
        if (!points || points.deja || typeof points.lp !== 'number') continue;
        noterBilan(bilans, r.lanceur, r.releveur, points.issue === 'challenger',
                   points.issue === 'draw', {
          lp: points.lp_adverse, rang: points.rang_adverse,
          palier_avant: points.palier_avant_adverse,
          serie: points.serie_adverse, serie_avant: points.serie_avant_adverse,
        });
        noterBilan(bilans, r.releveur, r.lanceur, points.issue === 'opponent',
                   points.issue === 'draw', {
          lp: points.lp, rang: points.rang,
          palier_avant: points.palier_avant,
          serie: points.serie, serie_avant: points.serie_avant,
        });
      }
      this.annoncerPoints(tous, bilans, course);
    } catch (e) { /* le classement se passera de cette course */ }
  }

  /**
   * Ce que la course a rapporte, dit a chacun.
   *
   * Sans cela, une course en direct comptait en silence : les points partaient
   * au classement, l'ecran de fin montrait les chronos, et il fallait aller
   * ouvrir le tableau pour deviner ce qui avait bouge. Un defi releve, lui,
   * annonce ses points a l'arrivee depuis toujours — c'est la reponse de la
   * route qui les porte. Le direct n'a pas de reponse a porter : la course est
   * finie quand l'ecriture commence.
   *
   * D'ou un message de suite, et non un champ de plus dans `resultat` :
   * l'ecriture est volontairement hors du chemin de l'annonce, pour qu'une
   * base indisponible ne laisse pas les joueurs devant un ecran vide. Le
   * verdict part donc toujours le premier, les points quand ils existent.
   *
   * Chacun est nomme par son identifiant plutot que par son role : le jeu
   * prend le sien sans avoir a savoir ce que « lanceur » veut dire ici. Pour
   * chacun : le total de la course, sa division apres, s'il a change de
   * division, sa serie avant et apres, et le detail duel par duel — c'est ce
   * detail que le journal des defis inscrit.
   *
   * A deux, `hote` et `invite` restent : ce sont les seuls champs que lisent
   * les versions du jeu d'avant les courses a plusieurs.
   */
  annoncerPoints(tous, bilans, course) {
    if (!bilans.size) return;
    const vu = j => {
      const b = bilans.get(j.id);
      if (!b) return null;
      const palier = b.rang ? b.rang.palier : b.palier_avant;
      return {
        id: j.id, lp: b.lp, rang: b.rang,
        monte: palier > b.palier_avant, descend: palier < b.palier_avant,
        serie: b.serie, serie_avant: b.serie_avant,
        duels: b.duels,
      };
    };
    const message = {
      t: 'duel', course,
      joueurs: tous.map(vu).filter(Boolean),
    };
    if (this.max === 2 && tous.length === 2) {
      const hote = tous.find(x => x.id === this.hote) || tous[0];
      const invite = tous.find(x => x !== hote);
      const h = vu(hote), i = vu(invite);
      if (h && i) { message.hote = h; message.invite = i; }
    }
    this.diffuser(message);
  }

  // Purge : une salle qui n'a plus servi depuis longtemps ne garde rien.
  perimee() {
    return Date.now() - this.ne > VIE_SALLE_MS && this.joueurs.size === 0;
  }
}
