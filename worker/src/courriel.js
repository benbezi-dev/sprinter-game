/* ---------------------------------------------------------------------------
   L'ALERTE PAR COURRIEL
   ---------------------------------------------------------------------------
   Une demande de recuperation ne se voyait que sur le tableau d'activite, et
   le tableau ne s'ouvre que quand on pense a l'ouvrir. Un joueur qui a perdu
   son code pouvait donc attendre des jours derriere un ecran que personne ne
   regardait. Ce mot part au moment du depot, porte de quoi trancher, et ne
   demande a personne de se souvenir de rien.

   Il ne part QU'A LA BOITE DU JEU. Le joueur, lui, n'a pas d'adresse ici et
   n'en aura pas : l'identite tient dans un nom et un code court, sans tiers et
   sans e-mail (voir identite.js). Ce courriel previent l'arbitre — il ne
   remplace pas la preuve, qui reste le message envoye DEPUIS le compte
   Instagram lie au nom.

   Rien de tout ceci ne peut faire echouer une demande. L'envoi part dans un
   `waitUntil` : sans cle, sur un refus de Resend ou sur une coupure, le joueur
   a quand meme depose sa demande et la file l'a bien. Le courriel est un
   rappel, pas un maillon.

   Ce qu'il faut poser une fois :

       npx wrangler secret put RESEND_CLE

   Et, si l'on veut autre chose que les valeurs ci-dessous, les variables
   `MAIL_DEST` et `MAIL_EXPEDITEUR` dans wrangler.toml. Le domaine de
   l'expediteur doit etre verifie chez Resend (SPF/DKIM), sans quoi l'envoi est
   refuse ; `onboarding@resend.dev` fonctionne le temps d'un essai.
--------------------------------------------------------------------------- */

const DEST_DEFAUT = 'contact@sprinter-game.com';
const EXPEDITEUR_DEFAUT = 'Sprinter <recuperations@sprinter-game.com>';

/** L'heure de Paris, en toutes lettres. Sur un fuseau que l'environnement ne
    saurait pas nommer, on retombe sur l'heure UTC plutot que sur rien. */
function quand(ms) {
  const d = new Date(ms);
  try {
    return d.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short',
    });
  } catch {
    return d.toISOString().replace('T', ' à ').slice(0, 19) + ' UTC';
  }
}

/**
 * Previens la boite du jeu qu'une demande vient d'etre deposee.
 *
 * A n'appeler que sur une demande NEUVE : ni un appareil encore relie (il n'y
 * a rien a arbitrer), ni un second appui sur le bouton (meme demande, meme mot
 * de passage). Sinon le meme joueur ferait sonner la boite a chaque fois qu'il
 * rouvre le jeu, et l'alerte finirait dans un filtre.
 *
 * Rend `true` si le mot est parti, `false` sinon. Personne n'attend cette
 * reponse : elle sert aux traces de `wrangler tail`.
 */
export async function alerterRecuperation(env, d) {
  const cle = env && env.RESEND_CLE;
  if (!cle) {
    // Ferme par defaut plutot qu'ouvert par oubli — mais on le dit, sinon on
    // cherche la panne du cote du joueur pendant des jours.
    console.log('recuperation : aucune RESEND_CLE posee, pas de courriel envoye');
    return false;
  }

  const nom = String(d.nom || '').slice(0, 40) || 'sans nom';
  const indice = String(d.indice || '').trim().slice(0, 280);
  const preuve = d.insta && d.phrase
    ? [
        `Preuve attendue : un message privé à @${d.compte},`,
        `envoyé DEPUIS @${d.insta}, portant le mot de passage`,
        ``,
        `    ${d.phrase}`,
        ``,
        `Ce message est la seule vérification réelle : déclarer un pseudo ne`,
        `prouve rien, écrire depuis le compte si.`,
      ].join('\n')
    : [
        `Aucun compte Instagram n'est lié à ce nom : il n'y a rien à vérifier.`,
        `La demande se tranche à la main, sur ce que le joueur raconte et sur`,
        `ce que la file affiche (courses, appareils, dernière course).`,
      ].join('\n');

  const corps = [
    `${nom} demande à récupérer son compte.`,
    ``,
    preuve,
    ``,
    indice ? `Ce que le joueur dit de lui :\n« ${indice} »` : `Aucun indice fourni.`,
    ``,
    `À trancher dans le tableau d'activité, section « Récupérations de`,
    `compte » : npm run tableau, puis`,
    `http://localhost:4178/tableau-activite.html`,
    `(bouton « Clé admin » si la file reste fermée).`,
    ``,
    `Accepter ne relie rien tout seul : c'est l'appareil demandeur qui vient`,
    `chercher sa réponse, et lui seul en profite.`,
    ``,
    `Demande n° ${d.id ?? '?'} · déposée le ${quand(d.cree_le || Date.now())}`,
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: (env.MAIL_EXPEDITEUR || EXPEDITEUR_DEFAUT),
        to: [(env.MAIL_DEST || DEST_DEFAUT)],
        subject: `Récupération de compte — ${nom}`
               + (d.insta ? '' : ' (sans Instagram)'),
        text: corps,
      }),
    });
    if (!r.ok) {
      /* Le corps de l'erreur dit lequel des trois cas on tient : cle refusee,
         domaine non verifie, ou destinataire mal forme. Sans lui, les trois se
         ressemblent — et on change la mauvaise chose. */
      console.log(`recuperation : Resend a refuse (${r.status}) ` +
        (await r.text().catch(() => '')).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.log('recuperation : envoi impossible — ' + (e && e.message));
    return false;
  }
}
