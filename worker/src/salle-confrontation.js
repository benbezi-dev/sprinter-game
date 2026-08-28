/* ---------------------------------------------------------------------------
   CONFRONTATION DE RELAIS — deux a huit equipes, un seul coup de pistolet
   ---------------------------------------------------------------------------
   Une equipe seule court contre le chrono. Deux equipes courent l'une contre
   l'autre, et c'est un sport different : on voit le temoin de l'autre avancer
   dans le couloir d'a cote, on sait qu'on est en retard avant l'arrivee, et un
   passage rate se paie devant temoin.

   Ce que cette salle ajoute a la precedente est mince, et c'est voulu : les
   regles du temoin, des zones et des eliminations vivent dans relais-course.js
   et ne sont pas recopiees ici. Une confrontation n'est rien d'autre que N
   courses d'equipe qui partagent trois choses :

   1. un coup de pistolet. Une seule date, annoncee a tout le monde.
   2. un classement. A l'arrivee on compare, ce qu'une equipe seule ne fait
      jamais.
   3. le regard des autres. Les positions de chaque equipe partent a toutes,
      sans quoi personne ne verrait contre qui il court.

   Une equipe eliminee ne fait pas tomber la confrontation : les autres
   continuent. C'est la difference avec un relais solitaire, ou l'elimination
   met fin a tout — ici elle met fin a une equipe, et le classement la range
   derriere celles qui ont fini.
--------------------------------------------------------------------------- */

import { enregistrerRelais, equipe as chargerEquipe } from './relais.js';
import { CourseEquipe, zoneDe, TAILLE } from './relais-course.js';

const MIN_EQUIPES = 2;
const MAX_EQUIPES = 8;
const AVANT_DEPART_MS = 6000;   // un peu plus qu'a une equipe : il y a du monde
const VIE_MS = 30 * 60 * 1000;
const APRES_COURSE_MS = 90 * 1000;
const INACTIVITE_MS = 8 * 60 * 1000;

function net(nom) {
  const s = String(nom || '').trim().slice(0, 20).replace(/[<>]/g, '');
  return s || 'Anonyme';
}

export class SalleConfrontation {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.test = false;
    this.code = '';
    this.epreuve = '4x100';
    this.max = MAX_EQUIPES;
    this.departA = null;
    /** @type {Map<WebSocket, {id,nom,cle,equipe,relais,pret}>} */
    this.joueurs = new Map();
    /** @type {Map<string, CourseEquipe>} */
    this.equipes = new Map();
    this.minuteur = null;
    this.ne = Date.now();
  }

  base() {
    return this.test && this.env.DB_TEST ? this.env.DB_TEST : this.env.DB;
  }

  /** La course d'une equipe, creee a sa premiere connexion. */
  courseDe(id, nom = '') {
    if (!this.equipes.has(id)) this.equipes.set(id, new CourseEquipe(id, nom));
    return this.equipes.get(id);
  }

  // --- vue publique --------------------------------------------------------

  vue() {
    const parEquipe = new Map();
    for (const j of this.joueurs.values()) {
      if (!parEquipe.has(j.equipe)) parEquipe.set(j.equipe, []);
      parEquipe.get(j.equipe).push(j);
    }
    const equipes = [...this.equipes.entries()].map(([id, c]) => {
      const v = c.vue();
      const distances = new Map(v.coureurs.map(x => [x.relais, x]));
      return {
        ...v,
        presents: (parEquipe.get(id) || []).length,
        prets: (parEquipe.get(id) || []).filter(x => x.pret).length,
        joueurs: (parEquipe.get(id) || [])
          .sort((a, b) => a.relais - b.relais)
          .map(j => ({ id: j.id, nom: j.nom, relais: j.relais, pret: j.pret,
                       d: distances.get(j.relais)?.d ?? 0 })),
      };
    });
    return {
      code: this.code, epreuve: this.epreuve, max: this.max,
      depart_a: this.departA, horloge: Date.now(),
      equipes, classement: this.classement(),
    };
  }

  /**
   * Le classement, des qu'il y a de quoi.
   *
   * Les equipes qui ont fini se rangent au chrono ; celles qui ont ete
   * eliminees passent derriere, quel que soit le moment de leur elimination.
   * Une equipe eliminee au troisieme passage n'a pas mieux couru qu'une autre
   * eliminee au premier : elles n'ont ni l'une ni l'autre boucle le relais.
   */
  classement() {
    const finies = [...this.equipes.values()].filter(c => c.total != null);
    const sorties = [...this.equipes.values()].filter(c => c.elimine);
    finies.sort((a, b) => a.total - b.total);
    return [
      ...finies.map((c, i) => ({
        place: i + 1, equipe: c.equipe, nom: c.nom, total: c.total,
        passes: c.passes.map(p => p.note),
      })),
      ...sorties.map(c => ({
        place: null, equipe: c.equipe, nom: c.nom, total: null,
        elimine: c.elimine,
      })),
    ];
  }

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

  /** Tout le monde a fini, d'une facon ou d'une autre. */
  toutEstJoue() {
    return this.equipes.size > 0 &&
           [...this.equipes.values()].every(c => c.finie());
  }

  cloreSiFini() {
    if (!this.toutEstJoue()) return;
    this.departA = null;
    this.programmerFermeture(APRES_COURSE_MS, 'confrontation terminee');
    this.diffuser({ t: 'termine', ...this.vue() });
    const ecrire = this.ecrire();
    if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
  }

  // --- connexion -----------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    this.code = this.code || (url.searchParams.get('conf') || '').toUpperCase();
    if (url.searchParams.get('canal') === 'test') this.test = true;

    if (url.pathname.endsWith('/etat')) {
      return new Response(JSON.stringify({ existe: this.joueurs.size > 0, ...this.vue() }),
                          { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }

    const equipeId = (url.searchParams.get('team') || '').toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(equipeId)) {
      return new Response('equipe invalide', { status: 400 });
    }
    // Le premier arrive fixe la taille de la confrontation.
    if (this.equipes.size === 0 && !this.departA) {
      const m = parseInt(url.searchParams.get('max') || String(MAX_EQUIPES), 10);
      this.max = Number.isFinite(m)
        ? Math.max(MIN_EQUIPES, Math.min(MAX_EQUIPES, m)) : MAX_EQUIPES;
    }
    if (!this.equipes.has(equipeId) && this.equipes.size >= this.max) {
      return new Response('confrontation complete', { status: 409 });
    }

    const nom = net(url.searchParams.get('name'));
    const cle = nom.trim().toLowerCase();

    // Le rang vient de l'equipe, comme dans une salle simple : on ne choisit
    // pas son relais, et on n'entre pas dans une equipe dont on n'est pas.
    let relais = 0, nomEquipe = equipeId;
    if (this.base()) {
      const e = await chargerEquipe(this.base(), equipeId);
      const m = e && e.membres.find(x => x.cle === cle && x.etat === 'in');
      if (!m || !m.relais) return new Response('pas dans cette equipe', { status: 403 });
      relais = m.relais;
      nomEquipe = e.nom || equipeId;
    } else {
      relais = [...this.joueurs.values()].filter(j => j.equipe === equipeId).length + 1;
    }
    for (const j of this.joueurs.values()) {
      if (j.equipe === equipeId && j.relais === relais) {
        return new Response('relais deja tenu', { status: 409 });
      }
    }

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    serveur.accept();

    const j = { id: crypto.randomUUID().slice(0, 8), nom, cle,
                equipe: equipeId, relais, pret: false };
    this.joueurs.set(serveur, j);
    this.courseDe(equipeId, nomEquipe);
    this.vivante();

    serveur.addEventListener('message', ev => this.recu(serveur, ev.data));
    serveur.addEventListener('close', () => this.parti(serveur));
    serveur.addEventListener('error', () => this.parti(serveur));

    try {
      serveur.send(JSON.stringify({
        t: 'bienvenue', moi: j.id, equipe: equipeId, relais,
        zone: relais > 1 ? zoneDe(relais) : null, ...this.vue(),
      }));
    } catch (e) { /* deja fermee */ }
    this.etat();
    return new Response(null, { status: 101, webSocket: client });
  }

  parti(ws) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    this.joueurs.delete(ws);
    const c = this.equipes.get(j.equipe);
    // Le depart d'un relayeur elimine SON equipe, pas la confrontation : les
    // autres n'y sont pour rien et continuent de courir.
    if (this.departA && c && !c.finie()) {
      const el = c.eliminer('un relayeur a quitte la course', j.relais);
      if (el) this.diffuser({ t: 'elimine', equipe: j.equipe, ...el, ...this.vue() });
      this.cloreSiFini();
    }
    this.diffuser({ t: 'sorti', nom: j.nom, equipe: j.equipe, relais: j.relais, ...this.vue() });
    if (this.joueurs.size === 0) { clearTimeout(this.minuteur); this.minuteur = null; }
  }

  // --- protocole -----------------------------------------------------------

  recu(ws, brut) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    let m;
    try { m = JSON.parse(brut); } catch { return; }
    const c = this.courseDe(j.equipe);

    switch (m && m.t) {
      case 'ping':
        try { ws.send(JSON.stringify({ t: 'pong', a: m.a, serveur: Date.now() })); } catch (e) { }
        return;

      case 'pret': {
        j.pret = !!m.pret;
        this.vivante();
        // On part quand chaque equipe presente est au complet et prete, et
        // qu'il y en a au moins deux. Attendre une equipe absente
        // indefiniment n'aurait pas de sens ; partir a trois relayeurs non
        // plus.
        const parEquipe = new Map();
        for (const x of this.joueurs.values()) {
          if (!parEquipe.has(x.equipe)) parEquipe.set(x.equipe, []);
          parEquipe.get(x.equipe).push(x);
        }
        const pretes = [...parEquipe.values()]
          .filter(v => v.length === TAILLE && v.every(x => x.pret)).length;
        const tous = pretes >= MIN_EQUIPES && pretes === parEquipe.size;
        if (tous && !this.departA) {
          this.departA = Date.now() + AVANT_DEPART_MS;
          for (const course of this.equipes.values()) course.reinitialiser();
        }
        this.etat();
        return;
      }

      case 'faux_depart':
        if (j.relais === 1) {
          const el = c.eliminer('faux depart', 1);
          if (el) {
            this.diffuser({ t: 'elimine', equipe: j.equipe, ...el, ...this.vue() });
            this.cloreSiFini();
          }
        }
        return;

      case 'marque': {
        if (this.departA) return;
        if (c.placer(j.relais, m.d)) this.etat();
        return;
      }

      case 'pos': {
        this.vivante();
        const r = c.avancer(j.relais, m.d);
        if (r.elimine) {
          this.diffuser({ t: 'elimine', equipe: j.equipe, ...r.elimine, ...this.vue() });
          this.cloreSiFini();
          return;
        }
        // La position part a TOUT LE MONDE, pas seulement a l'equipe : c'est
        // toute la difference d'une confrontation. Sans cela, chacun courrait
        // seul en croyant courir contre les autres.
        if (r.d != null) {
          this.diffuser({ t: 'pos', equipe: j.equipe, relais: j.relais,
                          d: Math.round(r.d * 10) / 10 }, ws);
        }
        return;
      }

      case 'temoin': {
        const r = c.taper(j.relais, Date.now());
        if (r.elimine) {
          this.diffuser({ t: 'elimine', equipe: j.equipe, ...r.elimine, ...this.vue() });
          this.cloreSiFini();
          return;
        }
        if (r.passe) this.diffuser({ t: 'passe', equipe: j.equipe, ...r.passe, ...this.vue() });
        return;
      }

      case 'fini': {
        const r = c.terminer(j.relais, m.ms);
        if (r.total == null) return;
        this.diffuser({ t: 'fini', equipe: j.equipe, total: r.total, ...this.vue() });
        this.cloreSiFini();
        return;
      }
    }
  }

  async ecrire() {
    try {
      if (!this.base()) return;
      for (const c of this.equipes.values()) {
        if (c.total == null) continue;
        const part = Math.round(c.total / TAILLE);
        await enregistrerRelais(this.base(), {
          team_id: c.equipe, race_key: this.epreuve,
          legs: [part, part, part, c.total - 3 * part],
        });
      }
    } catch (e) { /* le classement se passera de cette confrontation */ }
  }

  perimee() { return Date.now() - this.ne > VIE_MS && this.joueurs.size === 0; }
}
