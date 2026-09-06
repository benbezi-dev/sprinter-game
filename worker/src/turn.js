// Le relais de la voix, pour les reseaux qui refusent le lien direct.
//
// La voix d'un duel ne passe pas par le serveur : les deux navigateurs se
// parlent directement, et la salle ne transporte qu'une offre, une reponse et
// des candidats. C'est ce qui donne une latence de conversation et ce qui evite
// de payer un Durable Object au temps eveille pour convoyer de l'audio.
//
// Encore faut-il que les deux puissent se joindre. STUN suffit a la plupart :
// il ne fait que dire a chacun son adresse publique. Mais derriere un NAT
// symetrique — beaucoup de reseaux mobiles, presque tous les reseaux
// d'entreprise, la plupart des wifis d'hotel — l'adresse observee par le
// serveur n'est pas celle que verra le pair, et aucun trou perce ne tient. Ces
// joueurs-la n'avaient tout simplement pas de voix : la connexion passait en
// `failed`, la presentation se jouait muette, et rien a l'ecran ne disait
// pourquoi.
//
// TURN est la reponse, et c'est un relais : le son transite par Cloudflare
// plutot qu'en droite ligne. On le paie au gigaoctet, ce qui est la raison de
// tout ce qui suit.
//
// POURQUOI LES IDENTIFIANTS SONT COURTS ET FABRIQUES ICI. Un identifiant TURN
// pose en dur dans le jeu est un identifiant publie : le paquet web est lisible
// par tout le monde, l'application se desassemble, et n'importe qui pourrait
// faire passer son propre trafic par un relais facture a nous. Cloudflare
// fabrique donc a la demande des identifiants qui expirent, et cette fabrique
// vit sur le serveur, seul endroit ou la cle du compte peut rester une cle.
//
// UNE HEURE, ET PAS DAVANTAGE. Un duel, sa revanche et les dix minutes de
// review tiennent tres large dedans, donc un joueur ne demande qu'une fois par
// partie. Et un identifiant qui fuite ne vaut qu'une heure de relais — assez
// pour que l'abus se voie dans les analyses avant de couter quelque chose.
//
// SANS SECRET, PAS DE PANNE. Tant que `TURN_KEY_ID` et `TURN_API_TOKEN` ne sont
// pas poses, cette route repond une liste vide et le jeu retombe sur STUN seul,
// c'est-a-dire exactement le comportement d'avant. On peut donc deployer le
// code avant d'ouvrir le service, et l'ouvrir sans redeployer.

const API = 'https://rtc.live.cloudflare.com/v1/turn/keys';

/** Duree de vie d'un identifiant, en secondes. Voir la note ci-dessus. */
const TTL_S = 3600;

/** Reponse de repli : STUN seul, ce que le jeu sait deja faire. */
const RIEN = { iceServers: [], ttl: 0 };

/**
 * Fabrique un identifiant TURN pour un appareil.
 *
 * `customIdentifier` etiquette la consommation avec l'appareil qui l'a
 * demandee. C'est ce qui permet, le jour ou la facture surprend, de voir dans
 * les analyses de Cloudflare si un seul identifiant releve tout le trafic —
 * autrement dit de distinguer un succes d'un abus.
 */
export async function identifiantsTurn(env, deviceId) {
  const cle = env.TURN_KEY_ID;
  const jeton = env.TURN_API_TOKEN;
  if (!cle || !jeton) return RIEN;

  try {
    const r = await fetch(`${API}/${encodeURIComponent(cle)}/credentials/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ttl: TTL_S,
        customIdentifier: String(deviceId || '').slice(0, 64),
      }),
    });
    if (!r.ok) return RIEN;

    const d = await r.json();
    // Cloudflare rend un objet unique, pas un tableau — la forme de l'ebauche
    // d'RFC dont elle s'inspire. On accepte les deux : le jour ou elle change
    // d'avis, le jeu n'a pas a etre redeploye pour continuer a parler.
    const s = d && d.iceServers;
    const liste = Array.isArray(s) ? s : (s ? [s] : []);
    if (!liste.length) return RIEN;
    return { iceServers: liste, ttl: TTL_S };
  } catch {
    // Le service de relais est injoignable : le duel se jouera en direct ou
    // sans voix, mais il se jouera.
    return RIEN;
  }
}
