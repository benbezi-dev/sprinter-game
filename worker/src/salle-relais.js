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

   L'elimination est immediate et sans appel : hors zone, avant la zone, ou
   temoin lache. C'est la regle de l'athletisme, elle n'est pas negociable
   ici non plus.
--------------------------------------------------------------------------- */

import { enregistrerRelais, equipe as chargerEquipe } from './relais.js';

const TAILLE = 4;
const ZONE = 30;                       // zone de lancement et de transmission
const LEG = 100;                       // longueur d'une portion
const AVANT_DEPART_MS = 5000;          // le temps de se mettre en place
const FENETRE_TOUCHE_MS = 600;         // au-dela, les deux touches ne vont plus ensemble
const VIE_MS = 20 * 60 * 1000;

function net(nom) {
  const s = String(nom || '').trim().slice(0, 20).replace(/[<>]/g, '');
  return s || 'Anonyme';
}

export class SalleRelais {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, {id,nom,cle,relais,pret,d,parti,fini}>} */
    this.joueurs = new Map();
    this.equipe = null;                // code de l'equipe
    this.epreuve = '4x100';
    this.departA = null;               // date absolue du coup de pistolet
    this.porteur = 1;                  // quel relais detient le temoin
    this.temoinD = 0;                  // ou en est le temoin, en metres
    this.passes = [];                  // {relais, a, ecart, note}
    this.touches = new Map();          // relais -> date de la touche temoin
    this.elimine = null;
    this.total = null;
    this.ne = Date.now();
  }

  // --- vue publique --------------------------------------------------------

  vue() {
    const joueurs = [...this.joueurs.values()]
      .sort((a, b) => a.relais - b.relais)
      .map(j => ({ id: j.id, nom: j.nom, relais: j.relais, pret: j.pret,
                   d: Math.round(j.d * 10) / 10, fini: j.fini }));
    return {
      equipe: this.equipe, epreuve: this.epreuve, joueurs,
      depart_a: this.departA, horloge: Date.now(),
      porteur: this.porteur, temoin_d: Math.round(this.temoinD * 10) / 10,
      passes: this.passes, elimine: this.elimine, total: this.total,
    };
  }

  diffuser(msg, sauf) {
    const texte = JSON.stringify(msg);
    for (const [ws] of this.joueurs) {
      if (ws === sauf) continue;
      try { ws.send(texte); } catch (e) { /* socket morte */ }
    }
  }
  etat() { this.diffuser({ t: 'salle', ...this.vue() }); }

  /** Geometrie : la zone du relayeur k (2..4), en metres absolus. */
  zoneDe(relais) {
    const debut = (relais - 1) * LEG;
    return { debut, fin: debut + ZONE };
  }

  // --- connexion -----------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    this.equipe = this.equipe || (url.searchParams.get('team') || '').toUpperCase();

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
    if (this.env.DB && this.equipe) {
      const e = await chargerEquipe(this.env.DB, this.equipe);
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

    const j = { id: crypto.randomUUID().slice(0, 8), nom, cle, relais,
                pret: false, d: (relais - 1) * LEG, parti: false, fini: false };
    this.joueurs.set(serveur, j);

    serveur.addEventListener('message', ev => this.recu(serveur, ev.data));
    serveur.addEventListener('close', () => this.parti(serveur));
    serveur.addEventListener('error', () => this.parti(serveur));

    try {
      serveur.send(JSON.stringify({ t: 'bienvenue', moi: j.id, relais: j.relais,
                                    zone: relais > 1 ? this.zoneDe(relais) : null,
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
    if (this.departA && !this.total && !this.elimine) {
      this.eliminer('un relayeur a quitte la course', j.relais);
    }
    this.diffuser({ t: 'sorti', nom: j.nom, relais: j.relais, ...this.vue() });
  }

  eliminer(raison, relais) {
    if (this.elimine) return;
    this.elimine = { raison, relais: relais || null };
    this.departA = null;
    this.diffuser({ t: 'elimine', ...this.elimine, ...this.vue() });
  }

  // --- protocole -----------------------------------------------------------

  recu(ws, brut) {
    const j = this.joueurs.get(ws);
    if (!j) return;
    let m;
    try { m = JSON.parse(brut); } catch { return; }

    switch (m && m.t) {
      case 'ping':
        try { ws.send(JSON.stringify({ t: 'pong', a: m.a, serveur: Date.now() })); } catch (e) { }
        return;

      case 'pret': {
        j.pret = !!m.pret;
        const tous = this.joueurs.size === TAILLE &&
                     [...this.joueurs.values()].every(x => x.pret);
        if (tous && !this.departA) {
          this.departA = Date.now() + AVANT_DEPART_MS;
          this.porteur = 1; this.temoinD = 0; this.passes = [];
          this.touches.clear(); this.elimine = null; this.total = null;
          for (const x of this.joueurs.values()) {
            x.d = (x.relais - 1) * LEG; x.parti = false; x.fini = false;
          }
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
        if (this.departA || j.relais === 1) return;
        const z = this.zoneDe(j.relais);
        const v = Number(m.d);
        if (!Number.isFinite(v)) return;
        j.d = Math.max(z.debut, Math.min(z.fin, v));
        this.etat();
        return;
      }

      case 'pos': {
        if (this.elimine) return;
        const d = Number(m.d);
        if (!Number.isFinite(d) || d < 0 || d > 500) return;
        if (d > j.d) j.d = d;
        j.parti = true;
        if (j.relais === this.porteur) this.temoinD = j.d;

        // Le receveur qui quitte sa zone sans le temoin elimine l'equipe.
        if (j.relais === this.porteur + 1) {
          const z = this.zoneDe(j.relais);
          if (j.d > z.fin) {
            this.eliminer('sortie de zone sans le temoin', j.relais);
            return;
          }
        }
        // Le porteur qui depasse la zone en gardant le temoin, aussi.
        if (this.porteur < TAILLE) {
          const z = this.zoneDe(this.porteur + 1);
          if (j.relais === this.porteur && j.d > z.fin) {
            this.eliminer('le temoin a depasse la zone', j.relais);
            return;
          }
        }
        this.diffuser({ t: 'pos', relais: j.relais, d: Math.round(j.d * 10) / 10 }, ws);
        return;
      }

      // Les deux touchent : le serveur date, verifie la geometrie, et tranche.
      case 'temoin': {
        if (this.elimine || this.porteur >= TAILLE) return;
        if (j.relais !== this.porteur && j.relais !== this.porteur + 1) return;
        this.touches.set(j.relais, Date.now());
        this.tenterPasse();
        return;
      }

      case 'fini': {
        if (this.elimine || this.total !== null) return;
        if (j.relais !== TAILLE) return;
        const ms = Math.round(Number(m.ms));
        if (!Number.isFinite(ms) || ms < 10000 || ms > 600000) return;
        j.fini = true;
        this.total = ms;
        this.diffuser({ t: 'fini', total: ms, passes: this.passes, ...this.vue() });
        const ecrire = this.ecrire();
        if (this.state.waitUntil) this.state.waitUntil(ecrire); else ecrire.catch(() => {});
        return;
      }
    }
  }

  /**
   * Un passage a lieu quand les deux touches sont la, rapprochees, et que la
   * geometrie le permet. Tout le reste elimine.
   */
  tenterPasse() {
    const donneur = this.porteur, receveur = this.porteur + 1;
    const tD = this.touches.get(donneur), tR = this.touches.get(receveur);
    if (!tD || !tR) return;

    const ecart = Math.abs(tD - tR);
    if (ecart > FENETRE_TOUCHE_MS) {
      // Trop loin l'une de l'autre : on ne considere pas que c'est un passage,
      // on oublie la plus ancienne et on attend.
      this.touches.delete(tD < tR ? donneur : receveur);
      return;
    }

    const jD = [...this.joueurs.values()].find(x => x.relais === donneur);
    const jR = [...this.joueurs.values()].find(x => x.relais === receveur);
    if (!jD || !jR) return;

    const z = this.zoneDe(receveur);
    if (jR.d < z.debut || jR.d > z.fin) {
      this.eliminer('temoin passe hors de la zone', receveur);
      return;
    }
    if (jD.d < z.debut) {
      this.eliminer('temoin donne avant la zone', donneur);
      return;
    }
    if (jD.d > z.fin) {
      this.eliminer('temoin passe hors de la zone', donneur);
      return;
    }

    this.porteur = receveur;
    this.temoinD = jR.d;
    this.touches.clear();
    const p = { relais: receveur, a: Math.round(jR.d * 10) / 10,
                dans_zone: Math.round((jR.d - z.debut) * 10) / 10, ecart };
    this.passes.push(p);
    this.diffuser({ t: 'passe', ...p, ...this.vue() });
  }

  async ecrire() {
    try {
      if (!this.env.DB || !this.equipe || this.total == null) return;
      // Les quatre temps de portion ne sont pas encore transmis par les
      // clients : on inscrit le cumul reparti, la course entiere etant la
      // seule chose que le serveur a reellement chronometree.
      const part = Math.round(this.total / TAILLE);
      await enregistrerRelais(this.env.DB, {
        team_id: this.equipe, race_key: this.epreuve,
        legs: [part, part, part, this.total - 3 * part],
      });
    } catch (e) { /* le classement se passera de cette course */ }
  }

  perimee() { return Date.now() - this.ne > VIE_MS && this.joueurs.size === 0; }
}
