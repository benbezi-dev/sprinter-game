/* ---------------------------------------------------------------------------
   QUI EST LA — la presence des joueurs
   ---------------------------------------------------------------------------
   Le classement des duels montrait cinq cents noms et ne disait pas lesquels
   avaient le jeu ouvert. Inviter quelqu'un en direct revenait a tirer au
   hasard : l'invitation vit dix minutes, et neuf fois sur dix elle tombait
   chez quelqu'un qui dormait.

   Un seul Durable Object pour tout le monde, et une WebSocket par joueur qui a
   le jeu au premier plan. ETRE CONNECTE, C'EST ETRE LA : il n'y a pas de table
   a tenir a jour, pas d'heure de derniere visite a ecrire toutes les trente
   secondes — la liste des presents est la liste des liaisons ouvertes.

   Ce qui la rend peu couteuse :
   - l'HIBERNATION. L'objet ne tient rien en memoire : chaque liaison porte sa
     fiche (appareil, nom, activite) en piece jointe, qui survit au sommeil.
   - le BATTEMENT repondu sans reveil, comme pour la boite. Un joueur qui ne
     change pas d'ecran ne coute rien ; seul un changement d'activite reveille
     l'objet, et la lecture de la liste.

   CE QUI SORT D'ICI : des noms, une activite, depuis quand. JAMAIS
   l'identifiant d'appareil — c'est lui qui ouvre la boite d'un joueur, et etre
   present ne doit pas rendre joignable.

   LE NOM N'EST PAS CRU SUR PAROLE. Le worker ne le transmet qu'apres avoir
   verifie que ce nom est reserve ET relie a cet appareil (`player_devices`).
   Sans cela, n'importe qui pourrait faire apparaitre « en ligne » le nom d'un
   autre. Un joueur sans nom reserve est compte, mais pas nomme.
--------------------------------------------------------------------------- */

/**
 * Ce qu'un joueur peut etre en train de faire.
 *
 * `menu` est le seul etat ou il est disponible tout de suite : c'est celui
 * qu'on cherche quand on veut lancer un direct. Les autres disent pourquoi il
 * ne repondra pas dans la seconde.
 */
export const ACTIVITES = ['menu', 'course', 'duel', 'direct', 'championnat', 'relais'];

/**
 * Au-dela, une liaison muette est tenue pour morte.
 *
 * Le jeu bat toutes les vingt-cinq secondes : soixante-dix en laissent passer
 * deux sans conclure. Un telephone mis en poche sans fermer proprement sa
 * socket disparait donc de la liste en un peu plus d'une minute, au lieu
 * d'attendre que le reseau s'apercoive de sa mort.
 */
export const VIVANT_MS = 70_000;

function activite(q) {
  const s = String(q || '');
  return ACTIVITES.includes(s) ? s : 'menu';
}

export class Presence {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Repondu par la plateforme, sans reveiller l'objet. C'est l'horodatage de
    // cette reponse qui dit, plus bas, si la liaison vit encore.
    try {
      this.state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    } catch (e) { /* runtime sans reponse automatique : le ping passera par message */ }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // --- la liste, demandee par le worker et par personne d'autre
    if (request.method === 'GET' && url.pathname.endsWith('/liste')) {
      return new Response(JSON.stringify(this.liste()),
                          { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }

    // Poses par le worker, qui a deja verifie l'appareil et le nom. Le client
    // n'a aucun moyen d'ecrire ces en-tetes lui-meme : le worker les remplace.
    const appareil = request.headers.get('X-Presence-Appareil') || '';
    let nom = '';
    try { nom = decodeURIComponent(request.headers.get('X-Presence-Nom') || ''); }
    catch { nom = ''; }
    if (!appareil) return new Response('appareil manquant', { status: 400 });

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    this.state.acceptWebSocket(serveur);
    const maintenant = Date.now();
    serveur.serializeAttachment({
      a: appareil,
      n: nom,
      q: activite(url.searchParams.get('quoi')),
      d: maintenant,          // depuis quand il fait ce qu'il fait
      o: maintenant,          // ouverture de la liaison
      v: maintenant,          // dernier signe de vie recu par message
    });
    // Le jeu apprend si son nom a ete reconnu : un nom tape a l'instant peut
    // ne pas encore etre reserve, et il retentera un peu plus tard.
    try {
      serveur.send(JSON.stringify({ t: 'ouverte', nomme: !!nom, le: maintenant }));
    } catch (e) { /* deja fermee */ }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Le jeu ne dit qu'une chose : ce qu'il est en train de faire. */
  webSocketMessage(ws, message) {
    let m;
    try { m = JSON.parse(String(message)); } catch { return; }
    if (!m) return;
    let fiche;
    try { fiche = ws.deserializeAttachment(); } catch { fiche = null; }
    if (!fiche) return;
    const maintenant = Date.now();

    if (m.t === 'ping') {
      fiche.v = maintenant;
      try { ws.serializeAttachment(fiche); ws.send('{"t":"pong"}'); } catch (e) { /* fermee */ }
      return;
    }
    if (m.t === 'quoi') {
      const q = activite(m.q);
      // « Depuis » ne bouge que si l'activite change : repeter « menu » toutes
      // les minutes ne doit pas remettre a zero le temps passe au menu.
      if (q !== fiche.q) { fiche.q = q; fiche.d = maintenant; }
      fiche.v = maintenant;
      try { ws.serializeAttachment(fiche); } catch (e) { /* fermee */ }
    }
  }

  webSocketClose(ws, code, raison) {
    try { ws.close(code === 1006 ? 1000 : code, raison); } catch (e) { /* deja fermee */ }
  }

  webSocketError() { /* le close suit toujours : rien a faire ici */ }

  /**
   * Qui est la, maintenant.
   *
   * Un appareil peut avoir deux liaisons un court instant — l'ancienne pas
   * encore tombee, la nouvelle deja ouverte apres une coupure : la plus
   * recente fait foi. Un joueur peut avoir deux appareils : une seule ligne,
   * celle dont l'activite a change le plus recemment.
   */
  liste() {
    const maintenant = Date.now();
    const parAppareil = new Map();
    for (const ws of this.state.getWebSockets()) {
      let fiche;
      try { fiche = ws.deserializeAttachment(); } catch { fiche = null; }
      if (!fiche || !fiche.a) continue;
      let vu = Math.max(fiche.v || 0, fiche.o || 0);
      try {
        const t = this.state.getWebSocketAutoResponseTimestamp(ws);
        if (t) vu = Math.max(vu, t.getTime());
      } catch (e) { /* runtime sans horodatage : on s'en tient aux messages */ }
      if (maintenant - vu > VIVANT_MS) {
        // Muette depuis trop longtemps : on la ferme plutot que de la laisser
        // compter. Le jeu, s'il est encore la, rouvrira.
        try { ws.close(1000, 'silence'); } catch (e) { /* deja fermee */ }
        continue;
      }
      const prec = parAppareil.get(fiche.a);
      if (!prec || fiche.o > prec.o) parAppareil.set(fiche.a, fiche);
    }

    const parNom = new Map();
    let anonymes = 0;
    for (const f of parAppareil.values()) {
      if (!f.n) { anonymes++; continue; }
      const k = f.n.trim().toLowerCase();
      const prec = parNom.get(k);
      if (!prec || f.d > prec.d) parNom.set(k, f);
    }

    const joueurs = [...parNom.values()]
      .map(f => ({ nom: f.n, quoi: f.q, depuis: f.d }))
      .sort((x, y) => x.nom.localeCompare(y.nom));
    return { n: joueurs.length + anonymes, joueurs, le: maintenant };
  }
}
