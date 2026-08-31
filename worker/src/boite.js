/* ---------------------------------------------------------------------------
   LA BOITE — la liaison permanente d'un joueur
   ---------------------------------------------------------------------------
   Tout ce que le jeu apprend de quelqu'un d'autre arrivait par sondage : un
   defi recu au bout de vingt secondes, un resultat de duel au bout de dix, et
   seulement si le joueur se trouvait sur un ecran calme. Entre deux personnes
   qui jouent l'une en face de l'autre, ces secondes-la se voient — on se
   defie, et il ne se passe rien pendant une demi-minute. L'echange s'eteint
   avant d'avoir commence.

   Une boite par joueur, tenue par un Durable Object, et une WebSocket ouverte
   pendant qu'il joue. Le serveur y depose un signal des qu'il ecrit quelque
   chose qui le concerne, et le jeu l'apprend dans la seconde, qu'on soit dans
   la meme piece ou a deux fuseaux d'ecart.

   CE QUI PASSE PAR LA SOCKET EST UN COUP DE SONNETTE, PAS LE COURRIER. Le
   signal ne porte que le genre de la nouvelle — un defi, un duel tranche, un
   mot depose — et le jeu va chercher le contenu par les routes qui existent
   deja. C'est ce qui rend cette brique petite et sans danger : aucune regle
   n'est recopiee ici, rien de ce qui compte ne depend de la socket, et le
   sondage reste en place derriere. Si la liaison tombe — telephone en veille,
   metro, wifi capricieux — on retombe simplement sur le rythme d'avant.

   La boite est adressee par l'IDENTIFIANT D'APPAREIL, jamais par le nom : les
   trois nouvelles qu'elle porte se resolvent toutes en un appareil precis cote
   serveur, et un nom peut etre porte par plusieurs personnes.
--------------------------------------------------------------------------- */

/** Le silence n'est pas un probleme : c'est l'hibernation qui garde la boite
 *  ouverte sans la facturer. On n'a donc rien a fermer au bout de x minutes. */
export class Boite {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Le battement de coeur du client recoit une reponse sans reveiller
    // l'objet : c'est la difference entre une boite qui dort et une boite qui
    // coute. Pose une fois, il survit a l'hibernation.
    try {
      this.state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    } catch (e) { /* runtime sans reponse automatique : le ping passera par message */ }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // --- depot d'un signal, par le worker et par personne d'autre
    //
    // Cette route n'est pas joignable de l'exterieur : le worker n'expose que
    // /boite/<appareil> en WebSocket, et s'adresse ici par le lien interne du
    // Durable Object, qui ne passe pas par le reseau public.
    if (request.method === 'POST' && url.pathname.endsWith('/pousser')) {
      let evt;
      try { evt = await request.json(); } catch { return new Response('{}', { status: 400 }); }
      const texte = JSON.stringify({ t: String(evt.t || 'courrier'), le: Date.now() });
      let n = 0;
      for (const ws of this.state.getWebSockets()) {
        try { ws.send(texte); n++; } catch (e) { /* socket morte : le close fera le menage */ }
      }
      return new Response(JSON.stringify({ ok: true, n }),
                          { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('websocket attendu', { status: 426 });
    }

    const paire = new WebSocketPair();
    const [client, serveur] = Object.values(paire);
    // Hibernation, contrairement a la salle de course : une boite ne tient
    // aucun etat en memoire — elle ne fait que relayer — et elle reste ouverte
    // des heures. C'est exactement le cas ou l'hibernation est faite, et le
    // contraire du cas d'une course, qui dure dix secondes et se souvient de
    // tout.
    this.state.acceptWebSocket(serveur);
    try {
      serveur.send(JSON.stringify({ t: 'ouverte', le: Date.now() }));
    } catch (e) { /* deja fermee */ }
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Le client ne dit rien d'utile : il bat le coeur, et c'est tout.
   *
   * La reponse automatique posee au constructeur repond deja aux pings sans
   * reveiller l'objet ; ce qui arrive ici est le repli pour un runtime qui ne
   * la connaitrait pas, ou un client qui parlerait autrement.
   */
  webSocketMessage(ws, message) {
    let m;
    try { m = JSON.parse(String(message)); } catch { return; }
    if (m && m.t === 'ping') {
      try { ws.send('{"t":"pong"}'); } catch (e) { /* deja fermee */ }
    }
  }

  webSocketClose(ws, code, raison, propre) {
    try { ws.close(code === 1006 ? 1000 : code, raison); } catch (e) { /* deja fermee */ }
  }

  webSocketError() { /* le close suit toujours : rien a faire ici */ }
}

/**
 * Depose un signal dans la boite d'un appareil.
 *
 * Volontairement silencieuse en cas d'echec : une notification est un confort,
 * pas une ecriture. Si la boite ne repond pas, le jeu retombe sur son sondage
 * et personne ne perd rien — alors qu'une exception ici ferait echouer la
 * requete qui vient, elle, d'enregistrer un defi ou un resultat.
 */
export async function sonner(env, deviceId, type, canalTest) {
  try {
    if (!env || !env.BOITES || !deviceId) return;
    const nom = canalTest ? 'T-' + deviceId : deviceId;
    const id = env.BOITES.idFromName(nom);
    await env.BOITES.get(id).fetch('https://boite/pousser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: type }),
    });
  } catch (e) {
    // Le sondage reste derriere : on ne casse pas une ecriture pour une sonnerie.
  }
}
