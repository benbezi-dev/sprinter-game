/* ---------------------------------------------------------------------------
   SALLE DE RELAIS
   ---------------------------------------------------------------------------
   Quatre joueurs, une piste, un temoin.

   La salle de duel arbitrait deux coureurs independants : chacun courait sa
   course, on comparait les chronos a la fin. Ici les quatre courent la MEME
   course, l'un apres l'autre, et c'est le temoin qui fait le lien. Cela change
   ce que le serveur doit tenir :

   - une seule horloge de course, partagee. Le chrono de l'equipe n'est pas la
     somme de quatre chronos annonces, c'est l'instant ou le quatrieme franchit
     la ligne, compte depuis le coup de pistolet.
   - la position du temoin, qui est la seule verite. Un joueur ne court que
     s'il l'a, ou s'il attend dans sa zone.
   - l'arbitrage des passages. Les deux joueurs touchent, le serveur date les
     deux touches sur SON horloge et decide : passage valide et note, ou
     equipe eliminee. Un client ne peut pas s'auto-declarer valide.

   Les regles elles-memes vivent dans relais-course.js, parce que la salle de
   confrontation en a besoin a l'identique. Cette salle-ci ne fait plus que
   deux choses : tenir les sockets, et donner l'heure du depart.
--------------------------------------------------------------------------- */

import { enregistrerRelais, equipe as chargerEquipe } from './relais.js';
import { CourseEquipe, zoneDe, TAILLE, LEG } from './relais-course.js';
import { Fictifs, tirerNoms, PAS_MS } from './relais-fictifs.js';
import { avantDepart } from './depart.js';

// Le temps de se mettre en place — quatre joueurs, quatre relais. Le depart
// part au decompte, sur les deux canaux. Voir depart.js.
const AVANT_DEPART_MS = 5000;
const VIE_MS = 20 * 60 * 1000;
// Un Durable Object se facture au temps ou il reste eveille, et une WebSocket
// ouverte l'y maintient. Le probleme est particulierement net ici : un relais
// dure quarante secondes mais son salon peut rester ouvert dix minutes pendant
// que les quatre s'organisent. On ferme donc des que la course est jouee, et on
// ferme aussi un salon ou il ne se passe rien.
const APRES_COURSE_MS = 60 * 1000;
const INACTIVITE_MS = 5 * 60 * 1000;

function net(nom) {
  const s = String(nom || '').trim().slice(0, 20).replace(/[<>]/g, '');
  return s || 'Anonyme';
}

export class SalleRelais {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.test = false;         // salle du canal de test : ecrit ailleurs
    /** @type {Map<WebSocket, {id,nom,cle,relais,pret}>} */
    this.joueurs = new Map();
    this.equipe = null;                // code de l'equipe
    this.epreuve = '4x100';
    this.departA = null;               // date absolue du coup de pistolet
    this.course = null;                // pose au premier appel, avec le code
    this.minuteur = null;
    this.ne = Date.now();
    /**
     * LE SALON : une salle sans equipe, ouverte par un code. Chacun y choisit
     * sa place, et les places que personne ne prend sont courues par des
     * relayeurs fictifs (relais-fictifs.js) — deux joueurs et deux fictifs,
     * trois et un. Rien n'y est ecrit au classement des equipes.
     */
    this.salon = false;
    /** Les fictifs des places libres, poses au pistolet. */
    this.fictifs = null;
    /** Les noms des fictifs, gardes tant que la composition ne change pas. */
    this.nomsFictifs = null;
    /** Le minuteur qui les fait courir. */
    this.simulation = null;
  }

  /** Les places que personne ne tient. */
  placesLibres() {
    const prises = new Set([...this.joueurs.values()].map(j => j.relais));
    return [1, 2, 3, 4].filter(r => !prises.has(r));
  }

  /**
   * Les fictifs du salon, tels qu'ils courraient maintenant. Recrees quand la
   * composition change avant le pistolet ; leurs noms, eux, ne bougent pas
   * d'une course a l'autre tant que les memes places restent libres.
   */
  preparerFictifs() {
    if (!this.salon) return null;
    const libres = this.placesLibres();
    const cle = libres.join(',');
    if (!this.nomsFictifs || this.nomsFictifs.cle !== cle) {
      this.nomsFictifs = { cle, noms: tirerNoms(libres.length, [...this.joueurs.values()].map(j => j.nom)) };
    }
    this.fictifs = new Fictifs(this.laCourse(), libres, this.nomsFictifs.noms);
    return this.fictifs;
  }

  arreterSimulation() {
    if (this.simulation) clearInterval(this.simulation);
    this.simulation = null;
  }

  /** Les fictifs courent, du pistolet a la fin de la course. */
  lancerSimulation() {
    this.arreterSimulation();
    if (!this.fictifs || !this.fictifs.liste.length) return;
    this.simulation = setInterval(() => {
      if (!this.departA) { this.arreterSimulation(); return; }
      const encore = this.fictifs.pas(Date.now(), this.departA, {
        pos: (relais, d, t) => this.diffuser({ t: 'pos', relais, d: Math.round(d * 100) / 100, c: Math.round(t) }),
        passe: (p) => this.diffuser({ t: 'passe', ...p, ...this.vue() }),
        elimine: (el) => {
          this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...el, ...this.vue() });
        },
        fini: (total) => {
          const c = this.laCourse();
          this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'fini', total, passes: c.passes, ...this.vue() });
        },
      });
      if (!encore) this.arreterSimulation();
    }, PAS_MS);
  }

  /** La course de l'equipe, creee a la volee. */
  laCourse() {
    if (!this.course) this.course = new CourseEquipe(this.equipe || '', '');
    return this.course;
  }

  // --- vue publique --------------------------------------------------------

  vue() {
    const c = this.laCourse();
    const distances = new Map(c.vue().coureurs.map(x => [x.relais, x]));
    const joueurs = [...this.joueurs.values()]
      .sort((a, b) => a.relais - b.relais)
      .map(j => ({
        id: j.id, nom: j.nom, relais: j.relais, pret: j.pret,
        d: distances.get(j.relais)?.d ?? 0,
        fini: distances.get(j.relais)?.fini ?? false,
      }));
    // Au salon, les places libres sont tenues par des fictifs : on les montre
    // comme des coequipiers, toujours prets.
    if (this.salon && this.fictifs) {
      for (const f of this.fictifs.liste) {
        joueurs.push({ id: f.id, nom: f.nom, relais: f.relais, pret: true, fictif: true,
                       d: distances.get(f.relais)?.d ?? 0, fini: distances.get(f.relais)?.fini ?? false });
      }
      joueurs.sort((a, b) => a.relais - b.relais);
    }
    return {
      salon: this.salon,
      equipe: this.equipe, epreuve: this.epreuve, joueurs,
      depart_a: this.departA, horloge: Date.now(),
      porteur: c.porteur, temoin_d: Math.round(c.temoinD * 10) / 10,
      passes: c.passes, elimine: c.elimine, total: c.total,
    };
  }

  /**
   * LA COURSE EST FINIE — par la ligne ou par l'elimination.
   *
   * Trois choses, et la deuxieme manquait : on desarme le depart, ON EFFACE
   * LES DECLARATIONS DE PRESENCE, et on programme la fermeture.
   *
   * Sans l'effacement, les quatre restaient marques prets apres l'arrivee.
   * Or `case 'pret'` rearme des que les quatre le sont et que `departA` est
   * retombe a null : le PREMIER message `pret` venu — un seul joueur qui
   * bascule son bouton pour recourir — relancait donc le pistolet pour tout
   * le monde ET appelait `reinitialiser()`, qui efface le chrono, les passes
   * et l'elimination. Les trois autres, encore sur leur ecran d'arrivee,
   * voyaient leur resultat disparaitre au profit d'une course qu'ils
   * n'avaient pas demandee.
   *
   * C'est exactement ce que dit l'intention d'origine, juste en dessous :
   * « une equipe qui veut recourir n'a qu'a SE REDECLARER prete ». Encore
   * fallait-il que la declaration precedente cesse de valoir.
   */
  cloreLaCourse(delai, raison) {
    this.arreterSimulation();
    this.departA = null;
    for (const j of this.joueurs.values()) j.pret = false;
    this.programmerFermeture(delai, raison);
  }

  /**
   * Programme la fermeture. Toute activite la repousse : c'est le silence qui
   * ferme, pas l'horloge. Une equipe qui veut recourir n'a qu'a se redeclarer
   * prete.
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

  vivante() {
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.programmerFermeture(0, 'inactivite'),
                               INACTIVITE_MS);
  }

  diffuser(msg, sauf) {
    const texte = JSON.stringify(msg);
    for (const [ws] of this.joueurs) {
      if (ws === sauf) continue;
      try { ws.send(texte); } catch (e) { /* socket morte */ }
    }
  }
  etat() { this.diffuser({ t: 'salle', ...this.vue() }); }

  zoneDe(relais) { return zoneDe(relais); }

  /**
   * La base a laquelle cette salle parle.
   *
   * Une salle du canal de test ne doit jamais toucher au classement reel : ses
   * equipes, ses chronos et ses fantomes vivent dans la base de test.
   */
  base() {
    return this.test && this.env.DB_TEST ? this.env.DB_TEST : this.env.DB;
  }

  // --- connexion -----------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    this.equipe = this.equipe || (url.searchParams.get('team') || '').toUpperCase();
    // Le canal est pose par le worker, jamais par le client.
    if (url.searchParams.get('canal') === 'test') this.test = true;
    if (url.searchParams.get('salon') === '1') this.salon = true;

    if (url.pathname.endsWith('/etat')) {
      return new Response(JSON.stringify({ existe: this.joueurs.size > 0, ...this.vue() }),
                          { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }
    if (this.joueurs.size >= TAILLE) {
      return new Response('salle complete', { status: 409 });
    }

    const nom = net(url.searchParams.get('name'));
    const cle = nom.trim().toLowerCase();

    // Le relais de chacun vient de l'equipe, pas du client : on ne choisit
    // pas son rang en se connectant. SAUF AU SALON, ou l'on demande sa place
    // (`relais`) : on l'obtient si elle est libre, sinon la premiere libre.
    let relais = 0;
    if (this.salon) {
      if (this.departA) return new Response('course en cours', { status: 409 });
      const libres = this.placesLibres();
      const voulu = parseInt(url.searchParams.get('relais') || '', 10);
      relais = libres.includes(voulu) ? voulu : libres[0];
      if (!relais) return new Response('salle complete', { status: 409 });
      // Revenir apres une arrivee (REJOUER) ne remet PAS la course a zero : les
      // autres liraient encore leur ecran d'arrivee, qui disparaitrait sous
      // leurs yeux. La course repart au prochain pistolet (`pret`) ; le
      // revenant, lui, ne prend pour arrivee que celle d'une course qu'il a
      // vue partir (CourseRelais).
    } else if (this.base() && this.equipe) {
      const e = await chargerEquipe(this.base(), this.equipe);
      const m = e && e.membres.find(x => x.cle === cle && x.etat === 'in');
      if (!m || !m.relais) return new Response('pas dans cette equipe', { status: 403 });
      relais = m.relais;
    } else {
      relais = this.joueurs.size + 1;          // repli hors base, pour les tests
    }
    for (const j of this.joueurs.values()) {
      if (j.relais === relais) return new Response('relais deja tenu', { status: 409 });
    }

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    serveur.accept();

    const j = { id: crypto.randomUUID().slice(0, 8), nom, cle, relais, pret: false };
    this.joueurs.set(serveur, j);
    this.laCourse();
    this.preparerFictifs();
    this.vivante();

    serveur.addEventListener('message', ev => this.recu(serveur, ev.data));
    serveur.addEventListener('close', () => this.parti(serveur));
    serveur.addEventListener('error', () => this.parti(serveur));

    try {
      serveur.send(JSON.stringify({ t: 'bienvenue', moi: j.id, relais: j.relais,
                                    zone: relais > 1 ? zoneDe(relais) : null,
                                    ...this.vue() }));
    } catch (e) { /* deja fermee */ }
    this.etat();
    return new Response(null, { status: 101, webSocket: client });
  }

  parti(ws) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    this.joueurs.delete(ws);
    if (this.salon && !this.departA) this.preparerFictifs();
    // Un relais ne se court pas a trois : si quelqu'un part en pleine course,
    // l'equipe ne peut pas finir.
    const c = this.laCourse();
    if (this.departA && !c.finie()) {
      if (this.salon) {
        // AU SALON, UN FICTIF REPREND SA PLACE. Celui qui a deja donne le temoin
        // n'a plus rien a courir ; celui qui part avant le pistolet, en cours de
        // portion ou en attendant la sienne laisse un fictif finir pour lui.
        // Eliminer trois joueurs pour le reseau d'un quatrieme serait les punir
        // de ce qui ne depend pas d'eux.
        if (j.relais >= c.porteur) {
          if (!this.fictifs) this.fictifs = new Fictifs(c, [], []);
          this.fictifs.prendreLaPlace(j.relais, {
            id: j.id, nom: j.nom, v: this.fictifs.vitesseDe(j.relais),
          });
          if (!this.simulation) { this.fictifs.dernierPas = Date.now(); this.lancerSimulation(); }
        }
      } else {
        this.eliminer('un relayeur a quitte la course', j.relais);
      }
    }
    this.diffuser({ t: 'sorti', nom: j.nom, relais: j.relais, ...this.vue() });
    // Plus personne : on eteint le minuteur. Un setTimeout en attente suffit a
    // maintenir l'objet eveille, et donc facture, pour rien.
    if (this.joueurs.size === 0) {
      clearTimeout(this.minuteur); this.minuteur = null;
      this.arreterSimulation();
    }
  }

  eliminer(raison, relais) {
    const el = this.laCourse().eliminer(raison, relais);
    if (!el) return;
    this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
    this.diffuser({ t: 'elimine', ...el, ...this.vue() });
  }

  // --- protocole -----------------------------------------------------------

  recu(ws, brut) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    let m;
    try { m = JSON.parse(brut); } catch { return; }
    const c = this.laCourse();

    switch (m && m.t) {
      case 'ping':
        try { ws.send(JSON.stringify({ t: 'pong', a: m.a, serveur: Date.now() })); } catch (e) { }
        return;

      case 'pret': {
        j.pret = !!m.pret;
        this.vivante();
        // Au salon, il suffit que les joueurs presents soient prets : les
        // places libres sont tenues par des fictifs.
        const complet = this.salon ? this.joueurs.size >= 1 : this.joueurs.size === TAILLE;
        const tous = complet && [...this.joueurs.values()].every(x => x.pret);
        if (tous && !this.departA) {
          this.departA = Date.now() + avantDepart(this.test, AVANT_DEPART_MS);
          c.reinitialiser();
          if (this.salon) {
            // Les marques des joueurs survivent a la remise a zero de la course.
            for (const x of this.joueurs.values()) if (x.marque != null) c.placer(x.relais, x.marque);
            this.preparerFictifs();
            this.fictifs.reinitialiser(Date.now());
            this.lancerSimulation();
          }
          // Les instants de course repartent de zero avec le pistolet.
          for (const x of this.joueurs.values()) { x.dch = 0; x.ch = null; }
        }
        this.etat();
        return;
      }

      // Faux depart du premier relayeur : l'equipe est eliminee.
      case 'faux_depart':
        // Seulement pendant une course : avant le pistolet ou apres l'arrivee,
        // un appui n'est pas un faux depart.
        if (j.relais === 1 && this.departA && !c.finie()) this.eliminer('faux depart', 1);
        return;

      // Le receveur se place dans sa zone avant le depart.
      case 'marque': {
        if (this.departA) return;
        if (c.placer(j.relais, m.d)) { j.marque = c.coureur(j.relais).d; this.etat(); }
        return;
      }

      // Au salon, changer de place avant le pistolet, vers une place libre.
      case 'place': {
        if (!this.salon || this.departA) return;
        const r = parseInt(m.relais, 10);
        if (!this.placesLibres().includes(r)) return;
        j.relais = r; j.marque = null; j.pret = false;
        this.preparerFictifs();
        try {
          ws.send(JSON.stringify({ t: 'bienvenue', moi: j.id, relais: j.relais,
                                   zone: r > 1 ? zoneDe(r) : null, ...this.vue() }));
        } catch (e) { /* deja fermee */ }
        this.etat();
        return;
      }

      case 'pos': {
        // Hors course, personne n'avance : la marque se pose par `marque`.
        // Et pendant la course, la salle borne ce que le telephone annonce
        // par ce qu'il a pu courir — voir VITESSE_MAX dans relais-course.js.
        // Une position tardive, apres l'arrivee, ne repousse pas la fermeture.
        if (!this.departA) return;
        this.vivante();
        const r = c.avancer(j.relais, m.d, Date.now() - this.departA, m.c);
        // La position retenue par la course, bornee — pas celle annoncee.
        if (this.fictifs && r.d != null) this.fictifs.noterHumain(j.relais, r.d, Date.now() - this.departA);
        if (r.elimine) {
          this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...r.elimine, ...this.vue() });
          return;
        }
        if (r.d != null) {
          // Avec l'instant de SA course (`c`, en millisecondes depuis le coup
          // de pistolet), quand le client l'envoie : chaque ecran montre le
          // coequipier ou il en est a son propre instant, et non ou il etait
          // quand le paquet est parti. C'est le meme remede qu'en course en
          // direct, voir salle.js et recevoirPosition dans sprinter-app.js.
          // L'instant ne va qu'avec la distance la plus lointaine annoncee,
          // puisque c'est elle que la course garde.
          const ch = Number(m.c);
          const date = m.c != null && Number.isFinite(ch) && ch >= 0 && ch <= 20 * 60000;
          const v = Number(m.d);
          if (v >= (j.dch || 0)) { j.dch = v; j.ch = date ? Math.round(ch) : null; }
          const pos = { t: 'pos', relais: j.relais, d: Math.round(r.d * 100) / 100 };
          if (j.ch != null) pos.c = j.ch;
          this.diffuser(pos, ws);
        }
        return;
      }

      // Les deux touchent : le serveur date, verifie la geometrie, et tranche.
      case 'temoin': {
        // Au salon, un fictif tend la main avec le joueur : Fictifs.tapeHumaine.
        // Entre deux joueurs, la salle attend les deux tapes, comme toujours.
        const rf = this.fictifs && this.departA ? this.fictifs.tapeHumaine(j.relais, Date.now()) : null;
        const r = rf || c.taper(j.relais, Date.now());
        // Les deux mains se sont tendues ensemble, mais trop loin l'une de
        // l'autre. Ce n'est pas une faute — on le DIT, sinon les deux
        // coureurs tapent dans le vide sans comprendre pourquoi le temoin ne
        // part pas, et le receveur finit par sortir de sa zone.
        if (r.tropLoin) {
          this.diffuser({ t: 'trop_loin', ...r.tropLoin });
          return;
        }
        if (r.elimine) {
          this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...r.elimine, ...this.vue() });
          return;
        }
        if (r.passe) this.diffuser({ t: 'passe', ...r.passe, ...this.vue() });
        return;
      }

      case 'fini': {
        const r = c.terminer(j.relais, m.ms,
                             this.departA ? Date.now() - this.departA : null);
        if (r.elimine) {
          this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...r.elimine, ...this.vue() });
          return;
        }
        if (r.total == null) return;
        this.cloreLaCourse(APRES_COURSE_MS, 'course terminee');
        this.diffuser({ t: 'fini', total: r.total, passes: c.passes, ...this.vue() });
        // Le salon ne s'inscrit pas au classement des equipes.
        if (this.salon) return;
        const ecrire = this.ecrire();
        if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
        return;
      }
    }
  }

  async ecrire() {
    try {
      const c = this.laCourse();
      if (!this.base() || !this.equipe || c.total == null) return;
      // Les quatre temps de portion ne sont pas encore transmis par les
      // clients : on inscrit le cumul reparti, la course entiere etant la
      // seule chose que le serveur a reellement chronometree.
      const part = Math.round(c.total / TAILLE);
      await enregistrerRelais(this.base(), {
        team_id: this.equipe, race_key: this.epreuve,
        legs: [part, part, part, c.total - 3 * part],
        traces: c.traceReguliere(),
      });
    } catch (e) { /* le classement se passera de cette course */ }
  }

  perimee() { return Date.now() - this.ne > VIE_MS && this.joueurs.size === 0; }
}
