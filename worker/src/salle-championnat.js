/* ---------------------------------------------------------------------------
   SALLE DE CHAMPIONNAT — une serie courue en direct, avec son faux depart
   ---------------------------------------------------------------------------
   Jusqu'ici, une course de championnat ne se courait pas : un harnais posait
   huit chronos sur `/champ/course`, et le jeu les rejouait. Cette salle est la
   course elle-meme. Elle parle le protocole de la salle en direct (salle.js)
   — `bienvenue`, `salle`, `pos`, `fini`, `resultat`, l'horloge par ping — pour
   que le jeu s'y branche avec ce qu'il sait deja faire, et elle y ajoute ce
   qu'un championnat a de plus :

   1. UNE GRILLE FIXE. On ne rejoint pas une serie : on y est convoque. Seuls
      ses partants courent, chacun dans le couloir que le semis lui donne ;
      tout autre visiteur regarde.
   2. UNE HEURE IMPOSEE. Le pistolet tombe a l'heure du calendrier, pas quand
      tout le monde est pret. Qui n'est pas la trente secondes avant est
      forfait — son couloir reste vide.
   3. LE FAUX DEPART. Le premier fautif declenche le rappel : tout le monde
      revient sur la ligne, les fautifs prennent un carton rouge et passent
      spectateurs, les autres repartent. Les regles vivent dans faux-depart.js.
   4. L'ECRITURE. A l'arrivee, la salle range elle-meme les resultats — les
      chronos, et pour les autres la raison de leur absence.

   Le canal de test et la production sont deux objets distincts, adresses par
   des noms distincts (voir index.js), et chacun ecrit dans sa propre base.
--------------------------------------------------------------------------- */

import { avantDepart } from './depart.js';
import { contexteCourse, enregistrerCourse } from './championnats.js';
import { jugerSignalement, jugerPosition, classerLaCourse } from './faux-depart.js';

/** La salle ouvre un quart d'heure avant le pistolet. */
const OUVERTURE_AVANT_MS = 15 * 60 * 1000;
/**
 * L'appel : la grille est arretee trente secondes avant le pistolet.
 *
 * C'est ce qu'il faut pour presenter huit athletes a trois secondes chacun,
 * plus le decompte, plus l'instant de silence qui precede la presentation.
 * Arrive apres, on regarde.
 */
const PRESENTATION_PAR_JOUEUR_MS = 3000;
const AVANT_PRESENTATION_MS = 1500;
const AVANT_DEPART_MS = 4000;
const APPEL_AVANT_MS = 8 * PRESENTATION_PAR_JOUEUR_MS + AVANT_DEPART_MS + AVANT_PRESENTATION_MS;
/**
 * Une salle qui s'eveille en retard — personne n'y etait a l'appel, et le
 * premier arrive se presente apres l'heure — ne declare pas tout le monde
 * forfait pour quelques secondes : elle repousse le pistolet d'autant. Au-dela
 * de deux minutes, la course est manquee ; la salle ne la court plus.
 */
const RETARD_TOLERE_MS = 2 * 60 * 1000;
/**
 * Et quand elle s'eveille ainsi en retard, l'appel attend cinq secondes : le
 * premier arrive n'est pas seul a etre a l'heure, il est seulement le premier
 * a avoir ouvert la porte.
 */
const APPEL_TARDIF_MS = 5000;
/**
 * LE RAPPEL : quatre secondes de scene, puis le decompte du nouveau depart.
 *
 * Assez pour voir les coureurs revenir, le carton se lever, le couloir se
 * vider ; pas assez pour que l'adrenaline retombe. Le decompte qui suit est le
 * meme qu'au premier depart.
 */
const RAPPEL_MS = 4000;
/**
 * Deux fautifs sur le meme depart sortent tous les deux. Le second signalement
 * peut arriver une latence apres le premier : le rappel attend donc un
 * instant avant de partir, et jamais avant le coup de pistolet lui-meme — un
 * rappel se donne APRES le coup, c'est le double coup de feu.
 */
const FENETRE_COMPLICES_MS = 600;
const RAPPEL_APRES_COUP_MS = 250;
/** Sans chrono si longtemps apres le pistolet, on n'arrivera plus. */
const ABANDON_MS = 3 * 60 * 1000;
const MIN_MS = 1000, MAX_MS = 20 * 60000;
/** Le temps de lire le resultat, puis la salle ferme. */
const APRES_RESULTAT_MS = 90 * 1000;

export class SalleChampionnat {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.test = false;
    this.cle = null;            // { edition, phase, course }
    this.ctx = null;            // contexteCourse, charge une fois
    this.erreur = null;
    this.at = null;             // pistolet prevu (calendrier, ou lance a la main)
    /** @type {Map<WebSocket, {id:string, cle:string|null, nom:string, role:'coureur'|'spectateur'}>} */
    this.sockets = new Map();
    /** @type {Map<string, any>} les partants, par cle */
    this.coureurs = new Map();
    this.phase = 'ouverte';     // ouverte | appel (jusqu'au pistolet) | course | terminee
    this.presentationA = null;
    this.ordre = [];
    this.departA = null;
    this.departN = 0;
    this.fautifs = [];          // signalements du depart en cours
    this.minuteurs = new Set();
    this.minuteurRappel = null;
    this.minuteurAppel = null;
    this.appelPrevuA = null;
    this.resultat = null;
  }

  // --- utilitaires ---------------------------------------------------------

  base() {
    return this.test && this.env.DB_TEST ? this.env.DB_TEST : this.env.DB;
  }

  plus_tard(ms, f) {
    const t = setTimeout(() => { this.minuteurs.delete(t); f(); }, Math.max(0, ms));
    this.minuteurs.add(t);
    return t;
  }

  toutArreter() {
    for (const t of this.minuteurs) clearTimeout(t);
    this.minuteurs.clear();
    clearTimeout(this.minuteurRappel); this.minuteurRappel = null;
    clearTimeout(this.minuteurAppel); this.minuteurAppel = null;
    this.appelPrevuA = null;
  }

  engages() {
    return [...this.coureurs.values()].filter(c => c.statut === 'engage');
  }

  vue() {
    const joueurs = [...this.coureurs.values()]
      .filter(c => c.statut !== 'forfait' && (c.statut !== 'attente' || c.ws))
      .map(c => ({
        id: c.cle, nom: c.nom, cle: c.cle, couloir: c.couloir, pret: true,
        d: Math.round(c.d * 10) / 10, fin: c.fin, statut: c.statut,
      }));
    return {
      joueurs, epreuves: this.ctx ? [this.ctx.epreuve] : null, niveau: 4,
      max: this.ctx ? this.ctx.grille.length : 0,
      depart_a: this.departA, horloge: Date.now(),
      termine: this.phase === 'terminee',
      presentation: this.presentationA ? {
        debut_a: this.presentationA, par: PRESENTATION_PAR_JOUEUR_MS,
        micro: 0, ordre: this.ordre,
      } : null,
      champ: this.ctx ? {
        edition: this.ctx.edition, phase: this.ctx.phase, course: this.ctx.course,
        titre: this.ctx.titre, phaseNom: this.ctx.phaseNom, lieu: this.ctx.lieu,
        courses: this.ctx.courses,
        at: this.at, etat: this.phase, depart_n: this.departN,
        spectateurs: [...this.sockets.values()].filter(s => s.role === 'spectateur').length,
        grille: [...this.coureurs.values()].map(c => ({
          cle: c.cle, nom: c.nom, couloir: c.couloir, present: !!c.ws,
          statut: c.statut, motif: c.motif, motif_ms: c.motif_ms,
        })),
      } : null,
      resultat: this.resultat,
      erreur: this.erreur,
    };
  }

  diffuser(msg) {
    const texte = JSON.stringify(msg);
    for (const [ws] of this.sockets) {
      try { ws.send(texte); } catch (e) { /* le close fera le menage */ }
    }
  }

  envoyerEtat() { this.diffuser({ t: 'salle', ...this.vue() }); }

  // --- chargement ----------------------------------------------------------

  async charger(url) {
    if (this.ctx || this.erreur) return;
    const edition = (url.searchParams.get('edition') || '').toUpperCase();
    const phase = url.searchParams.get('phase') || '';
    const course = parseInt(url.searchParams.get('course') || '', 10);
    this.cle = { edition, phase, course };
    const c = await contexteCourse(this.base(), edition, phase, course);
    if (c.erreur) { this.erreur = c.erreur; return; }
    this.ctx = c;
    this.at = c.at;
    for (const g of c.grille) {
      this.coureurs.set(g.cle, {
        cle: g.cle, nom: g.nom, couloir: g.couloir, ws: null,
        statut: 'attente', d: 0, c: null, fin: null, motif: null, motif_ms: null,
      });
    }
    if (c.deja) { this.phase = 'terminee'; this.erreur = 'course deja courue'; }
  }

  /**
   * Replace les rendez-vous de la salle sur `this.at`.
   *
   * Appelee a chaque evenement qui peut les changer : le premier chargement,
   * une arrivee, un lancement a la main. Elle ne fait rien une fois l'appel
   * passe — la grille est alors arretee et le pistolet annonce.
   */
  planifier() {
    if (this.phase !== 'ouverte' || !this.at) return;
    const maintenant = Date.now();
    if (maintenant > this.at + RETARD_TOLERE_MS) return;       // course manquee
    let appel = this.at - APPEL_AVANT_MS;
    if (maintenant >= appel) {
      // En retard sur l'appel : il faut quelqu'un pour l'ouvrir, et on laisse
      // aux autres le temps d'arriver. Le pistolet reculera d'autant qu'il le
      // faut pour presenter tout le monde (voir `appel`).
      if (![...this.coureurs.values()].some(c => c.ws)) return;
      if (this.minuteurAppel) return;               // deja programme
      appel = maintenant + APPEL_TARDIF_MS;
    }
    if (this.minuteurAppel && this.appelPrevuA === appel) return;
    clearTimeout(this.minuteurAppel);
    this.appelPrevuA = appel;
    this.minuteurAppel = setTimeout(() => {
      this.minuteurAppel = null; this.appelPrevuA = null;
      this.appel();
    }, appel - maintenant);
  }

  // --- l'appel, la presentation, le pistolet --------------------------------

  appel() {
    if (this.phase !== 'ouverte') return;
    const presents = [...this.coureurs.values()].filter(c => c.ws);
    for (const c of this.coureurs.values()) {
      c.statut = c.ws ? 'engage' : 'forfait';
      if (!c.ws) c.motif = 'forfait';
    }
    if (!presents.length) {
      // Personne a l'appel : tous forfaits, et la course est rangee telle.
      this.terminer();
      return;
    }
    this.phase = 'appel';
    this.ordre = presents.sort((a, b) => a.couloir - b.couloir)
      .map(c => ({ id: c.cle, nom: c.nom, couloir: c.couloir }));
    const maintenant = Date.now();
    const seul = this.ordre.length < 2;
    const presentation = seul ? 0 : this.ordre.length * PRESENTATION_PAR_JOUEUR_MS;
    const attente = avantDepart(this.test, AVANT_DEPART_MS);
    // Le pistolet reste a l'heure si on a le temps de tout montrer ; sinon il
    // recule d'autant, jamais il n'avance.
    const auPlusTot = maintenant + (seul ? 0 : AVANT_PRESENTATION_MS) + presentation + attente;
    this.at = Math.max(this.at || 0, auPlusTot);
    this.presentationA = seul ? null : this.at - attente - presentation;
    this.poserDepart(this.at);
    this.envoyerEtat();
  }

  poserDepart(date) {
    this.departA = date;
    this.departN += 1;
    this.fautifs = [];
    for (const c of this.engages()) { c.d = 0; c.c = null; c.fin = null; }
    const n = this.departN;
    this.plus_tard(date - Date.now(), () => this.coupDePistolet(n));
  }

  coupDePistolet(n) {
    if (n !== this.departN || this.phase === 'terminee') return;
    // Un partant parti entre l'appel et le pistolet n'est pas sur la ligne.
    for (const c of this.engages()) {
      if (!c.ws) { c.statut = 'abandon'; c.motif = 'abandon'; }
    }
    this.phase = 'course';
    this.plus_tard(ABANDON_MS, () => this.fermerLaCourse(n));
    this.peutTrancher();
  }

  // --- le faux depart -------------------------------------------------------

  signaler(c, verdict) {
    if (!verdict.faux || c.statut !== 'engage') return;
    if (this.phase !== 'appel' && this.phase !== 'course') return;
    if (this.fautifs.some(f => f.cle === c.cle)) return;
    this.fautifs.push({ cle: c.cle, ms: verdict.ms });
    if (this.minuteurRappel) return;
    const n = this.departN;
    const quand = Math.max(Date.now() + FENETRE_COMPLICES_MS,
                           this.departA + RAPPEL_APRES_COUP_MS);
    this.minuteurRappel = setTimeout(() => {
      this.minuteurRappel = null;
      this.rappel(n);
    }, quand - Date.now());
  }

  rappel(n) {
    if (n !== this.departN || this.phase === 'terminee') return;
    const fautifs = [];
    for (const f of this.fautifs) {
      const c = this.coureurs.get(f.cle);
      if (!c || c.statut !== 'engage') continue;
      c.statut = 'dq'; c.motif = 'faux_depart'; c.motif_ms = f.ms;
      c.fin = null;
      for (const s of this.sockets.values()) if (s.cle === c.cle) s.role = 'spectateur';
      fautifs.push({ id: c.cle, cle: c.cle, nom: c.nom, couloir: c.couloir, ms: f.ms });
    }
    // Les minuteurs du depart rappele — le pistolet, la fermeture — ne valent
    // plus rien : on repart d'une ligne neuve.
    this.toutArreter();
    if (!this.engages().length) {
      this.diffuser({ t: 'rappel', fautifs, depart_a: null, rappel_ms: RAPPEL_MS,
                      ...this.vue() });
      this.terminer();
      return;
    }
    this.phase = 'appel';
    const attente = avantDepart(this.test, AVANT_DEPART_MS);
    this.poserDepart(Date.now() + RAPPEL_MS + attente);
    this.diffuser({ t: 'rappel', fautifs, depart_a: this.departA, depart_n: this.departN,
                    rappel_ms: RAPPEL_MS, ...this.vue() });
  }

  // --- l'arrivee ------------------------------------------------------------

  peutTrancher() {
    if (this.phase !== 'course') return;
    if (this.engages().some(c => c.fin == null)) return;
    this.terminer();
  }

  fermerLaCourse(n) {
    if (n !== this.departN || this.phase !== 'course') return;
    for (const c of this.engages()) {
      if (c.fin == null) { c.statut = 'abandon'; c.motif = 'abandon'; }
    }
    this.terminer();
  }

  async terminer() {
    if (this.phase === 'terminee') return;
    this.phase = 'terminee';
    this.toutArreter();
    this.departA = null;
    this.presentationA = null;
    const tous = [...this.coureurs.values()].map(c => ({
      cle: c.cle, nom: c.nom, couloir: c.couloir,
      fin: c.statut === 'engage' || c.statut === 'fini' ? c.fin : null,
      motif: c.statut === 'engage' || c.statut === 'fini' ? null : (c.motif || 'abandon'),
      motif_ms: c.motif_ms,
    }));
    const classement = classerLaCourse(tous);
    this.resultat = { classement, partants: tous.length };
    this.diffuser({ t: 'resultat', classement: classement.map(l => ({
      ...l, id: l.cle,
      // Le client du direct attend un nombre et un drapeau d'abandon : une
      // ligne sans chrono porte donc le nombre sentinelle du direct, et le
      // motif dit le reste.
      ms: l.ms == null ? ABANDON_MS : l.ms, abandon: l.ms == null,
    })), partants: tous.length, champ: true });

    const ecrire = (async () => {
      try {
        const r = await enregistrerCourse(this.base(), {
          edition: this.ctx.edition, phase: this.ctx.phase, course: this.ctx.course,
          chronos: classement.map(l => ({ cle: l.cle, ms: l.ms, motif: l.motif,
                                          motif_ms: l.motif_ms })),
        });
        this.diffuser({ t: 'enregistre', ok: !r.erreur, erreur: r.erreur || null,
                        directs: r.directs || [] });
      } catch (e) {
        this.diffuser({ t: 'enregistre', ok: false, erreur: String(e && e.message || e) });
      }
    })();
    if (this.state.waitUntil) this.state.waitUntil(ecrire);
    this.plus_tard(APRES_RESULTAT_MS, () => this.fermer('course terminee'));
    await ecrire;
  }

  fermer(raison) {
    this.diffuser({ t: 'ferme', raison });
    for (const [ws] of this.sockets) {
      try { ws.close(1000, raison); } catch (e) { /* deja fermee */ }
    }
    this.sockets.clear();
  }

  // --- cycle de vie --------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    if (url.searchParams.get('canal') === 'test') this.test = true;
    await this.charger(url);
    const json = (o, status = 200) => new Response(JSON.stringify(o),
      { status, headers: { 'Content-Type': 'application/json' } });

    if (url.pathname.endsWith('/etat')) {
      this.planifier();
      return json({ existe: !!this.ctx, ...this.vue() });
    }

    // Lancer a la main : le canal de test et les harnais n'attendent pas
    // l'heure du calendrier. Le worker ne laisse passer que l'admin.
    if (url.pathname.endsWith('/lancer')) {
      if (!this.ctx) return json({ error: this.erreur || 'course inconnue' }, 400);
      if (this.phase !== 'ouverte') return json({ error: 'deja appelee', etat: this.phase }, 409);
      const dans = Math.max(0, parseInt(url.searchParams.get('dans') || '0', 10) || 0);
      this.at = Date.now() + dans;
      clearTimeout(this.minuteurAppel); this.minuteurAppel = null; this.appelPrevuA = null;
      this.planifier();
      this.envoyerEtat();
      return json({ ok: true, at: this.at });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }
    if (!this.ctx) return json({ error: this.erreur || 'course inconnue' }, 404);

    const maintenant = Date.now();
    if (this.at && maintenant < this.at - OUVERTURE_AVANT_MS && this.phase === 'ouverte') {
      return json({ error: 'salle pas encore ouverte', ouvre_a: this.at - OUVERTURE_AVANT_MS }, 425);
    }

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    serveur.accept();

    // Le worker a verifie que cet appareil porte bien ce nom (`verifie=1`) :
    // sans cette preuve, on regarde, on ne court pas.
    const cle = String(url.searchParams.get('name') || '').trim().toLowerCase();
    const verifie = url.searchParams.get('verifie') === '1';
    const partant = verifie ? this.coureurs.get(cle) : null;
    // Avant l'appel, un partant prend son couloir. Apres, seulement s'il y
    // etait deja et que le reseau l'a lache : il le reprend, tant que le
    // pistolet n'est pas parti.
    const peutCourir = !!partant && !partant.ws &&
      (this.phase === 'ouverte' || (this.phase === 'appel' && partant.statut === 'engage'));
    const id = peutCourir ? cle : 'spec-' + crypto.randomUUID().slice(0, 6);
    const place = { id, cle: peutCourir ? cle : null,
                    nom: partant ? partant.nom : cle || 'Spectateur',
                    role: peutCourir ? 'coureur' : 'spectateur' };
    this.sockets.set(serveur, place);
    if (peutCourir) partant.ws = serveur;

    serveur.addEventListener('message', ev => this.recu(serveur, ev.data));
    serveur.addEventListener('close', () => this.parti(serveur));
    serveur.addEventListener('error', () => this.parti(serveur));

    try {
      serveur.send(JSON.stringify({ t: 'bienvenue', moi: id, role: place.role, ...this.vue() }));
    } catch (e) { /* deja fermee */ }
    this.planifier();
    this.envoyerEtat();
    return new Response(null, { status: 101, webSocket: client });
  }

  parti(ws) {
    const s = this.sockets.get(ws);
    if (!s) return;
    this.sockets.delete(ws);
    const c = s.cle ? this.coureurs.get(s.cle) : null;
    if (c && c.ws === ws) {
      c.ws = null;
      // Parti en pleine course : il n'arrivera pas. Avant l'appel, il n'a
      // encore rien perdu — il peut revenir prendre son couloir.
      if (c.statut === 'engage' && this.phase === 'course') {
        c.statut = 'abandon'; c.motif = 'abandon';
        this.diffuser({ t: 'fini', id: c.cle, nom: c.nom, ms: ABANDON_MS, abandon: true });
        this.peutTrancher();
      }
    }
    if (this.phase !== 'terminee') this.envoyerEtat();
  }

  recu(ws, brut) {
    const s = this.sockets.get(ws);
    if (!s) return;
    let m;
    try { m = JSON.parse(brut); } catch { return; }
    if (m && m.t === 'ping') {
      try { ws.send(JSON.stringify({ t: 'pong', a: m.a, serveur: Date.now() })); } catch (e) { }
      return;
    }
    // Un spectateur ne fait que regarder : rien de ce qu'il envoie ne compte.
    if (s.role !== 'coureur') return;
    const c = this.coureurs.get(s.cle);
    if (!c || c.ws !== ws || c.statut !== 'engage') return;
    const recuA = Date.now();

    switch (m && m.t) {
      case 'faux_depart': {
        // Le depart vise : un signalement du depart d'avant, arrive apres le
        // rappel, ne doit pas en declencher un second.
        if (m.n != null && Number(m.n) !== this.departN) return;
        this.signaler(c, jugerSignalement({ departA: this.departA, recuA, ms: m.ms }));
        return;
      }

      case 'pos': {
        const d = Number(m.d);
        if (!Number.isFinite(d) || d < 0 || d > 2000) return;
        // Une position porte le numero du depart ou elle a ete courue. Apres
        // un rappel, celles du depart annule arrivent encore quelques
        // instants : elles ne comptent pour rien — ni pour la piste, ni
        // surtout pour le controle dur, qui y verrait des coureurs partis
        // avant le NOUVEAU pistolet.
        if (m.n != null && Number(m.n) !== this.departN) return;
        // Le controle dur, pendant tout le decompte : avancer avant le coup.
        if (this.phase === 'appel') {
          if (m.n != null) this.signaler(c, jugerPosition({ departA: this.departA, recuA, d }));
          return;
        }
        if (this.phase !== 'course') return;
        const t = Number(m.c);
        const date = m.c != null && Number.isFinite(t) && t >= 0 && t <= MAX_MS;
        if (d >= c.d) { c.d = d; c.c = date ? Math.round(t) : null; }
        const pos = { t: 'pos', id: c.cle, d: Math.round(c.d * 100) / 100 };
        if (c.c != null) pos.c = c.c;
        const texte = JSON.stringify(pos);
        for (const [autre] of this.sockets) {
          if (autre === ws) continue;
          try { autre.send(texte); } catch (e) { }
        }
        return;
      }

      case 'fini': {
        if (this.phase !== 'course' || c.fin != null) return;
        if (m.n != null && Number(m.n) !== this.departN) return;
        const ms = Math.round(Number(m.ms));
        if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return;
        c.fin = ms;
        this.diffuser({ t: 'fini', id: c.cle, nom: c.nom, ms });
        this.peutTrancher();
        return;
      }

      case 'abandon': {
        if (this.phase !== 'course') return;
        c.statut = 'abandon'; c.motif = 'abandon';
        this.diffuser({ t: 'fini', id: c.cle, nom: c.nom, ms: ABANDON_MS, abandon: true });
        this.peutTrancher();
        return;
      }
    }
  }
}
