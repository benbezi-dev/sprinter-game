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

const AVANT_DEPART_MS = 5000;          // le temps de se mettre en place
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
    return {
      equipe: this.equipe, epreuve: this.epreuve, joueurs,
      depart_a: this.departA, horloge: Date.now(),
      porteur: c.porteur, temoin_d: Math.round(c.temoinD * 10) / 10,
      passes: c.passes, elimine: c.elimine, total: c.total,
    };
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
    // pas son rang en se connectant.
    let relais = 0;
    if (this.base() && this.equipe) {
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
    // Un relais ne se court pas a trois : si quelqu'un part en pleine course,
    // l'equipe ne peut pas finir.
    const c = this.laCourse();
    if (this.departA && !c.finie()) {
      this.eliminer('un relayeur a quitte la course', j.relais);
    }
    this.diffuser({ t: 'sorti', nom: j.nom, relais: j.relais, ...this.vue() });
    // Plus personne : on eteint le minuteur. Un setTimeout en attente suffit a
    // maintenir l'objet eveille, et donc facture, pour rien.
    if (this.joueurs.size === 0) { clearTimeout(this.minuteur); this.minuteur = null; }
  }

  eliminer(raison, relais) {
    const el = this.laCourse().eliminer(raison, relais);
    if (!el) return;
    this.departA = null;
    this.programmerFermeture(APRES_COURSE_MS, 'course terminee');
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
        const tous = this.joueurs.size === TAILLE &&
                     [...this.joueurs.values()].every(x => x.pret);
        if (tous && !this.departA) {
          this.departA = Date.now() + AVANT_DEPART_MS;
          c.reinitialiser();
        }
        this.etat();
        return;
      }

      // Faux depart du premier relayeur : l'equipe est eliminee.
      case 'faux_depart':
        if (j.relais === 1) this.eliminer('faux depart', 1);
        return;

      // Le receveur se place dans sa zone avant le depart.
      case 'marque': {
        if (this.departA) return;
        if (c.placer(j.relais, m.d)) this.etat();
        return;
      }

      case 'pos': {
        this.vivante();
        const r = c.avancer(j.relais, m.d,
                            this.departA ? Date.now() - this.departA : null);
        if (r.elimine) {
          this.departA = null;
          this.programmerFermeture(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...r.elimine, ...this.vue() });
          return;
        }
        if (r.d != null) {
          this.diffuser({ t: 'pos', relais: j.relais, d: Math.round(r.d * 10) / 10 }, ws);
        }
        return;
      }

      // Les deux touchent : le serveur date, verifie la geometrie, et tranche.
      case 'temoin': {
        const r = c.taper(j.relais, Date.now());
        if (r.elimine) {
          this.departA = null;
          this.programmerFermeture(APRES_COURSE_MS, 'course terminee');
          this.diffuser({ t: 'elimine', ...r.elimine, ...this.vue() });
          return;
        }
        if (r.passe) this.diffuser({ t: 'passe', ...r.passe, ...this.vue() });
        return;
      }

      case 'fini': {
        const r = c.terminer(j.relais, m.ms);
        if (r.total == null) return;
        this.departA = null;
        this.programmerFermeture(APRES_COURSE_MS, 'course terminee');
        this.diffuser({ t: 'fini', total: r.total, passes: c.passes, ...this.vue() });
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
