/* ---------------------------------------------------------------------------
   LES DEUX SECRETS D'INSTAGRAM, VERIFIES AVANT D'ETRE POSES
   ---------------------------------------------------------------------------
   `suivi/instagram-connexion.md` le disait franchement : « la publication
   reelle n'est pas verifiable sans vos identifiants — le premier envoi sera
   donc le vrai test ». C'est vrai, et c'est un mauvais moment pour decouvrir
   qu'un jeton est du mauvais type ou qu'une permission manque : la publication
   part pour de bon, ou echoue avec un message de Meta ecrit pour un debogueur.

   Ce script prend le pas d'avant. Il repond a la seule question qui compte —
   « est-ce que ces deux valeurs vont marcher ? » — sans rien publier, et en
   nommant ce qui manque plutot qu'en rendant un echec.

       node tools/instagram-verifier.mjs

   Il demande le jeton et ne l'affiche pas pendant la frappe. Rien a preparer,
   rien a exporter.

   `IG_COMPTE` est facultatif : sans lui, le script le CHERCHE et vous le donne.
   C'est la valeur que tout le monde rate — ce n'est pas le pseudonyme, c'est
   une suite de chiffres, et l'explorateur de Meta ne la montre pas d'evidence.

   Rien de ce qui est secret ne s'affiche : le jeton n'est jamais imprime, ni
   en entier ni en fragment. Ce qui sort est ce que vous auriez lu sur l'ecran
   de Meta, plus le verdict.

   POURQUOI JAMAIS EN ARGUMENT : un argument de ligne de commande est visible
   de toute la machine dans `ps`, et il reste dans l'historique du shell. La
   saisie a l'invite n'ecrit ni l'un ni l'autre.

   `IG_JETON` reste accepte en variable d'environnement, pour enchainer sans
   les doigts. La premiere version ne proposait QUE cela, avec un `read -rs`
   cote shell, et c'etait un mauvais conseil : cette commande n'imprime rien —
   ni invite, ni etoiles — si bien que le terminal a l'air fige. On ne sait pas
   s'il attend, s'il a plante, ou si le collage est passe. Une invite qui ne
   dit pas qu'elle attend n'est pas une invite.
--------------------------------------------------------------------------- */

// La MEME version que `worker/src/instagram-envoi.js`. Verifier contre une
// autre version que celle qui publiera ne verifie rien.
const API = 'https://graph.facebook.com/v21.0';
const API_IG = 'https://graph.instagram.com/v21.0';

/* DEUX FAMILLES de jetons publient, et elles ne parlent pas au meme serveur —
   c'est la meme regle que `worker/src/instagram-envoi.js`, et elle doit rester
   la meme des deux cotes :

     « Facebook Login » (EAA…) : graph.facebook.com, via la Page liee ;
     « Instagram Login » (IGA…) : graph.instagram.com, sans Page.

   Ce fichier n'interrogeait que le premier. Un jeton d'Instagram Login envoye
   a graph.facebook.com se fait repondre « Cannot parse access token » — le
   message EXACT d'un collage tronque. On a donc cherche un defaut de collage
   pendant que le jeton etait bon et le serveur faux (12 septembre 2026). */
const estInstagramLogin = () => /^IG/.test(jeton);
const hote = () => (estInstagramLogin() ? API_IG : API);

/** Les permissions dont depend l'envoi, par famille. Les deux premieres de
    chaque liste sont vitales. Instagram Login les nomme autrement — chercher
    `instagram_basic` dans un jeton IGA le declarerait manquant a tort. */
const PERMISSIONS_FB = [
  ['instagram_basic',           true,  'lire le compte'],
  ['instagram_content_publish', true,  'publier — sans elle, rien ne part'],
  ['pages_show_list',           false, 'retrouver la Page liee'],
  ['pages_read_engagement',     false, 'lire la Page liee'],
];
const PERMISSIONS_IG = [
  ['instagram_business_basic',           true,  'lire le compte'],
  ['instagram_business_content_publish', true,  'publier — sans elle, rien ne part'],
];

let jeton = (process.env.IG_JETON || '').trim();
let compte = (process.env.IG_COMPTE || '').trim();

let echecs = 0, alertes = 0;
const ok    = (t, d) => console.log(`   \x1b[32m✓\x1b[0m ${t}${d ? ' — ' + d : ''}`);
const rate  = (t, d) => { echecs++;  console.log(`   \x1b[31m✗\x1b[0m ${t}${d ? ' — ' + d : ''}`); };
const tiede = (t, d) => { alertes++; console.log(`   \x1b[33m!\x1b[0m ${t}${d ? ' — ' + d : ''}`); };
const titre = t => console.log(`\n\x1b[1m${t}\x1b[0m`);

/** Un appel a Meta. Le jeton part en en-tete, jamais dans l'URL : une URL se
    retrouve dans les journaux, un en-tete beaucoup moins. */
async function meta(chemin) {
  const r = await fetch(`${hote()}${chemin}`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  const d = await r.json().catch(() => ({}));
  return { http: r.status, ok: r.ok, d,
           erreur: d && d.error ? d.error.message : null };
}

/**
 * Demande une valeur sans l'afficher pendant la frappe.
 *
 * En mode brut, et non par `readline`. La premiere version passait par lui en
 * muselant `_writeToOutput` : la frappe ne s'echotait plus, mais readline
 * continuait d'emettre ses sequences de redessin — un `ESC[1G ESC[0J` qui
 * EFFACE l'invite au premier caractere. On retombait donc exactement sur ce
 * qu'on voulait eviter : un ecran vide qui ne dit pas qu'il attend.
 *
 * Le mode brut demande de regerer trois choses a la main, et les voici :
 * l'effacement arriere, Ctrl-C, et les marqueurs de collage entre crochets —
 * ces `ESC[200~` que la plupart des terminaux ajoutent autour d'un coller et
 * que readline retirait pour nous. Non retires, ils entrent dans le jeton et
 * Meta repond « Cannot parse access token » pour une valeur pourtant juste.
 */
async function demanderMuet(invite) {
  process.stdout.write(invite);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  let tampon = '';
  return new Promise(res => {
    const finir = v => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', surDonnee);
      process.stdout.write('\n');
      res(v);
    };
    const surDonnee = brut => {
      // Les marqueurs de collage, avant tout le reste.
      for (const ch of String(brut).replace(/\u001b\[20[01]~/g, '')) {
        if (ch === '\r' || ch === '\n') return finir(tampon.trim());
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }  // Ctrl-C
        if (ch === '\u0004') return finir(tampon.trim());                        // Ctrl-D
        if (ch === '\u007f' || ch === '\b') { tampon = tampon.slice(0, -1); continue; }
        // Tout autre caractere de controle est une touche qu'on ne gere pas
        // (fleches, tabulation) : l'ignorer vaut mieux que la ranger dans le
        // jeton, ou elle ne se verrait qu'au refus de Meta.
        if (ch >= ' ') tampon += ch;
      }
    };
    process.stdin.on('data', surDonnee);
  });
}

/**
 * Ce qu'on peut dire d'un jeton sans le montrer.
 *
 * Un collage tronque est le premier soupcon quand Meta repond qu'il ne sait
 * pas lire le jeton, et c'est invisible : on a colle, on n'a rien vu, on ne
 * sait pas ce qui est arrive. La longueur et le prefixe le disent sans rien
 * reveler — un jeton d'acces Facebook fait plusieurs centaines de caracteres
 * et commence presque toujours par « EAA ».
 */
function allureDuJeton(j) {
  const notes = [];
  notes.push(`${j.length} caracteres recus`);
  if (j.length < 50) notes.push('\x1b[31mbeaucoup trop court — le collage a ete tronque\x1b[0m');
  else if (!j.startsWith('EAA')) notes.push('\x1b[33mne commence pas par « EAA »\x1b[0m');
  return notes.join(' · ');
}

if (!jeton) {
  // Sans terminal — dans un tuyau, une tache planifiee — il n'y a personne a
  // qui demander. On le dit, plutot que d'attendre indefiniment une frappe qui
  // ne viendra pas.
  if (!process.stdin.isTTY) {
    console.error(`
Il manque le jeton, et il n'y a pas de terminal pour le demander.

    IG_JETON=... node tools/instagram-verifier.mjs

Depuis un terminal, lancez simplement le script : il vous le demandera.
`);
    process.exit(2);
  }
  console.log(`
Le jeton d'acces Meta — celui de l'explorateur d'API, etendu a 60 jours.

Il ne s'affichera pas pendant la frappe : c'est voulu, l'invite attend bien.
Il n'est ecrit nulle part — ni dans l'historique du shell, ni sur le disque.`);
  jeton = await demanderMuet('\n  Colle-le puis Entree : ');
  if (!jeton) {
    console.error('\nRien recu. Rien fait.\n');
    process.exit(2);
  }
}

console.log('\nVerification des identifiants Instagram — rien ne sera publie.');
console.log(`\x1b[2m   jeton : ${allureDuJeton(jeton)}\x1b[0m`);

/* --------------------------------------------------- 1. le jeton lui-meme */
titre('1. Le jeton');
const moi = await meta(estInstagramLogin() ? '/me?fields=user_id,username'
                                          : '/me?fields=id,name');
if (!moi.ok) {
  rate('Meta refuse le jeton', moi.erreur || `HTTP ${moi.http}`);
  const tronque = jeton.length < 50;
  console.log(`
   C'est le message de Meta, pas le notre, et les deux qu'il envoie ne disent
   pas la meme chose :

     « Cannot parse access token »  la chaine n'a pas la FORME d'un jeton.
                                    Presque toujours un collage tronque ou
                                    incomplet — pas un probleme de compte.
     « Session has expired »        le jeton etait bon, il ne l'est plus.

   Et une TROISIEME cause rend le premier message sans etre un collage rate :
   le jeton parle a l'autre serveur. Un jeton « IGA… » (Instagram Login) doit
   aller sur graph.instagram.com, un « EAA… » (Facebook Login) sur
   graph.facebook.com. Interroge ici : ${hote().replace('https://', '')}.

   ${tronque
     ? `\x1b[31mIci : ${jeton.length} caracteres seulement. Un jeton d'acces en fait plusieurs\n   centaines. Ce n'est pas le bon texte, ou le collage s'est arrete en route.\x1b[0m`
     : `Ici : ${jeton.length} caracteres, ce qui est plausible pour un jeton.`}

   Ou en obtenir un : voir suivi/instagram-connexion.md, section
   « 3 bis. Le jeton, pas a pas ».
`);
  process.exit(1);
}
ok('Meta accepte le jeton',
   [moi.d.username ? '@' + moi.d.username : moi.d.name,
    `via ${hote().replace('https://', '')}`].filter(Boolean).join(' · '));

/* ------------------------------------- 2. ce que le jeton porte reellement */
titre('2. Ce que le jeton porte');
/* `debug_token` est une route de graph.facebook.com ; graph.instagram.com ne
   l'a pas. Pour un jeton d'Instagram Login, l'echeance et la liste des
   permissions ne sont donc PAS lisibles — ne rien afficher vaut mieux que de
   les deviner. La date reste a noter a la main : Meta delivre 60 jours. */
const dbg = estInstagramLogin()
  ? { d: {}, http: 0, ok: false }
  : await meta(`/debug_token?input_token=${encodeURIComponent(jeton)}`);
const info = dbg.d && dbg.d.data;
if (estInstagramLogin()) {
  tiede('Echeance et permissions illisibles',
        'graph.instagram.com n\'expose pas debug_token. Notez la date : 60 jours '
        + `a partir d'aujourd'hui, soit le ${new Date(Date.now() + 60 * 86400000).toLocaleDateString('fr-FR')}.`);
  console.log(`     \x1b[2mLes permissions se lisent dans la console Meta, page « Autorisations
     et fonctionnalites » : instagram_business_basic et
     instagram_business_content_publish doivent etre « Prete pour le test ».\x1b[0m`);
} else
if (!info) {
  tiede('Impossible de lire le detail du jeton', dbg.erreur || `HTTP ${dbg.http}`);
} else {
  if (info.is_valid) ok('Le jeton est valide');
  else rate('Le jeton est marque invalide par Meta');

  // L'echeance : c'est le piege annonce dans instagram-connexion.md, et il se
  // referme silencieusement soixante jours plus tard.
  if (!info.expires_at) {
    ok('Pas de date d\'expiration', 'jeton de longue duree');
  } else {
    const quand = new Date(info.expires_at * 1000);
    const jours = Math.round((quand - Date.now()) / 86400000);
    const texte = `${quand.toLocaleDateString('fr-FR')} — dans ${jours} jour${jours > 1 ? 's' : ''}`;
    if (jours <= 1)      rate('Le jeton expire tout de suite', texte);
    else if (jours < 15) tiede('Le jeton expire bientot', texte + '. Etendez-le avant de le poser.');
    else                 ok('Echeance du jeton', texte);
    console.log(`     \x1b[2mNotez cette date : le jour ou le bouton repondra « Invalid OAuth\n     access token », ce sera cela, et rien d'autre.\x1b[0m`);
  }

  const scopes = info.scopes || [];
  for (const [nom, vital, role] of PERMISSIONS_FB) {
    if (scopes.includes(nom)) ok(nom, role);
    else if (vital)           rate(`${nom} MANQUE`, role);
    else                      tiede(`${nom} manque`, role);
  }
}

/* --------------------------------------- 3. l'identifiant numerique du compte */
titre('3. Le compte Instagram');
if (!compte && estInstagramLogin()) {
  /* Instagram Login n'a ni Page ni `/me/accounts` : l'identifiant a poser est
     le `user_id` que `/me` vient de rendre. C'est la valeur que tout le monde
     rate, parce que ce n'est pas le pseudonyme. */
  if (moi.d.user_id) {
    compte = String(moi.d.user_id);
    ok('IG_COMPTE trouve', `${compte} — c'est cette valeur qu'il faut poser`);
  } else {
    rate('Meta n\'a pas rendu d\'identifiant numerique',
         'relancez en demandant le champ user_id, ou lisez-le dans la console Meta');
  }
} else if (!compte) {
  console.log('   IG_COMPTE n\'est pas fourni — je le cherche.');
  const pages = await meta('/me/accounts?fields=name,instagram_business_account');
  const liste = (pages.d && pages.d.data) || [];
  const lies = liste.filter(p => p.instagram_business_account);
  if (!liste.length) {
    rate('Aucune Page Facebook accessible',
         'la Page est obligatoire, meme si vous n\'y publiez rien : c\'est par elle que l\'API s\'authentifie');
  } else if (!lies.length) {
    rate(`${liste.length} Page(s) trouvee(s), aucune liee a un compte Instagram`,
         'liez le compte Instagram a la Page, puis refabriquez le jeton');
  } else {
    for (const p of lies) {
      ok(`Page « ${p.name} »`, `IG_COMPTE = ${p.instagram_business_account.id}`);
    }
    if (lies.length === 1) compte = lies[0].instagram_business_account.id;
    else tiede('Plusieurs comptes lies', 'choisissez celui du jeu et relancez avec IG_COMPTE=...');
  }
} else if (!/^\d+$/.test(compte)) {
  rate('IG_COMPTE n\'est pas un nombre',
       'ce n\'est pas le pseudonyme mais un identifiant numerique — relancez sans IG_COMPTE, je le chercherai');
}

if (compte && /^\d+$/.test(compte)) {
  const c = await meta(`/${compte}?fields=${estInstagramLogin() ? 'user_id,username,media_count' : 'id,username,media_count'}`);
  if (!c.ok) rate(`Le compte ${compte} est injoignable`, c.erreur || `HTTP ${c.http}`);
  else ok(`Compte @${c.d.username}`,
          `id ${c.d.id || c.d.user_id || compte}${c.d.media_count != null ? ` · ${c.d.media_count} publication(s)` : ''}`);

  /* CE QUE LE COMPTE PORTE VRAIMENT.
     Le 12 septembre 2026, `media_count` disait 4 pendant que le profil
     Instagram affichait « 1 publication » : un compteur ne dit pas OU sont
     les medias ni ce qu'ils sont. La liste, elle, donne le type et le
     permalien — de quoi ouvrir la publication et trancher. */
  const liste = await meta(`/${compte}/media?fields=id,media_type,media_product_type,permalink,timestamp,caption&limit=6`);
  const medias = (liste.d && liste.d.data) || [];
  if (!medias.length) {
    tiede('Aucun media listé', liste.erreur || 'le compte ne rend rien');
  } else {
    console.log(`   \x1b[2mLes ${medias.length} plus recents :\x1b[0m`);
    for (const m of medias) {
      const quand = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR') : '?';
      const type = [m.media_type, m.media_product_type].filter(Boolean).join('/');
      const debut = (m.caption || '').replace(/\s+/g, ' ').slice(0, 40);
      console.log(`     \x1b[2m· ${quand} · ${type} · ${m.permalink || 'sans lien'}${debut ? ' · ' + debut + '…' : ''}\x1b[0m`);
    }
  }

  // Le quota. Instagram plafonne a 50 publications par 24 h, et un quota
  // epuise echoue exactement comme une permission manquante — sauf que
  // l'attente le repare toute seule.
  const q = await meta(`/${compte}/content_publishing_limit?fields=quota_usage,config`);
  const u = q.d && q.d.data && q.d.data[0];
  if (u) {
    const max = (u.config && u.config.quota_total) || 50;
    if (u.quota_usage >= max) rate('Quota de publication epuise', `${u.quota_usage}/${max} sur 24 h`);
    else ok('Quota de publication', `${u.quota_usage}/${max} sur les 24 dernieres heures`);
  }
}

/* ------------------------------ 4. le brouillon, si une image est fournie */
// L'etape que rien d'autre ne sait tester : Meta va-t-il reellement CHERCHER
// une image a une adresse ? On cree un conteneur et on ne le publie pas — un
// conteneur jamais publie expire seul au bout de 24 h, et rien n'apparait sur
// le compte.
const imageTest = (process.env.IG_IMAGE_TEST || '').trim();
if (imageTest && compte) {
  titre('4. Le brouillon (aucune publication)');
  const r = await fetch(`${hote()}/${compte}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ image_url: imageTest, caption: 'verification — non publie' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) {
    rate('Meta refuse de creer le conteneur', (d.error && d.error.message) || `HTTP ${r.status}`);
  } else {
    ok('Conteneur cree', `Meta a accepte l'adresse. Il expirera seul, rien n'est publie.`);
    for (let i = 0; i < 8; i++) {
      await new Promise(s => setTimeout(s, 1500));
      const s = await meta(`/${d.id}?fields=status_code`);
      if (s.d.status_code === 'FINISHED') { ok('Meta a bien telecharge l\'image'); break; }
      if (s.d.status_code === 'ERROR')    { rate('Meta n\'a pas pu lire l\'image', 'adresse injoignable, format refuse, ou image trop lourde'); break; }
      if (i === 7)                          tiede('Meta n\'a pas fini a temps', 'ce n\'est pas forcement un echec, mais l\'envoi reel attendra aussi');
    }
  }
} else if (compte) {
  titre('4. Le brouillon');
  console.log(`   \x1b[2mNon teste. Pour verifier que Meta sait aller CHERCHER une image —
   la seule etape qu'on ne peut pas deviner — relancez avec une adresse
   publique d'image JPEG :

       IG_IMAGE_TEST=https://exemple/photo.jpg node tools/instagram-verifier.mjs

   Un conteneur sera cree et JAMAIS publie ; il expire seul en 24 h.\x1b[0m`);
}

/* ----------------------------------------------------------- le verdict */
titre('Verdict');
if (echecs) {
  console.log(`   ${echecs} probleme(s) bloquant(s)${alertes ? `, ${alertes} avertissement(s)` : ''}.`);
  console.log('   Corrigez-les avant de poser les secrets : un secret pose ne se relit pas.\n');
  process.exit(1);
}
console.log(`   Ces identifiants marcheront.${alertes ? ` (${alertes} avertissement(s) ci-dessus.)` : ''}`);
console.log(`
   Il reste a poser sur le Worker ce qui manque, et vous seul pouvez le faire :

       cd worker
       npx wrangler secret put IG_JETON      # collez le jeton
       npx wrangler secret put IG_COMPTE     # collez ${compte || 'l\'identifiant numerique'}

   Puis verifiez que l'atelier le voit — le bouton n'apparait que si le
   Worker repond « pret » :

       curl -s -H "X-Sprinter-Admin: VOTRE_ADMIN_CLE" \\
         https://sprinter-leaderboard.benbezi-sprinter.workers.dev/reseaux/envoi

   Attendu : {"pret":true}
`);
