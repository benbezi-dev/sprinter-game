/* ---------------------------------------------------------------------------
   ENVOYER UNE PUBLICATION SUR INSTAGRAM
   ---------------------------------------------------------------------------
   L'atelier prepare tout — l'image, la legende, les mots-cles — et il fallait
   encore ouvrir Instagram, glisser le fichier, recoller le texte. Ce module
   supprime ce dernier trajet.

   LE POINT QUI DICTE TOUTE LA FORME. L'API d'Instagram ne recoit pas un
   fichier : elle recoit une ADRESSE, et ce sont les serveurs de Meta qui vont
   chercher l'image. Or l'image est dessinee dans le navigateur, sur un canvas,
   et n'existe donc nulle part sur le reseau. Il faut un depot, joignable
   publiquement, et c'est ce que ce module ajoute — a contrecoeur, parce qu'une
   image publique est une image que n'importe qui peut lire.

   Trois precautions, chacune contre un risque precis :

   1. L'adresse n'est pas devinable. L'identifiant est tire au hasard sur
      16 octets, pas un numero qui s'incremente : sans cela, il suffirait de
      compter pour lire toutes les publications preparees, y compris celles
      qu'on a finalement ecartees.
   2. Le depot est temporaire. Une image se supprime des que Meta l'a prise,
      et de toute facon au bout d'une heure. Ce qui doit vivre longtemps, c'est
      la publication sur Instagram — pas la copie qui a servi a la deposer.
   3. Le jeton ne traverse jamais le navigateur. L'atelier envoie l'image et le
      texte ; c'est le Worker qui parle a Meta, avec un secret que la page ne
      voit pas. Un jeton Instagram pose dans une page ouverte sur un poste de
      travail est un jeton qui finira par fuir.

   CE QU'IL FAUT POSER POUR QUE CELA MARCHE — et que je ne peux pas poser a
   votre place, parce que ce sont des identifiants :

       cd worker
       npx wrangler secret put IG_JETON      # le jeton d'acces longue duree
       npx wrangler secret put IG_COMPTE     # l'identifiant numerique du compte

   Sans ces deux secrets, la route repond que l'envoi n'est pas configure, et
   l'atelier continue de proposer le telechargement. Rien ne casse.

   L'App Review de Meta n'est PAS necessaire pour publier sur son propre
   compte : en mode developpement, une app publie sur les comptes des personnes
   qui y ont un role. La revue ne sert qu'a publier sur le compte des autres,
   ce que ce projet ne fera jamais.
--------------------------------------------------------------------------- */

/** La version de l'API visee. Ecrite une fois. */
const API = 'https://graph.facebook.com/v21.0';

/** Au-dela, l'image ne part pas : Instagram refuse, et D1 aussi. */
const MAX_OCTETS = 900 * 1024;

/** Ce qu'une image deposee a de temps a vivre, meme si rien ne la reprend. */
const DUREE_MS = 60 * 60 * 1000;

const pret = new WeakSet();

export async function ensureEnvoiTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS reseaux_images (
      id TEXT PRIMARY KEY,
      -- Le JPEG lui-meme, en base64. D1 et pas R2 : R2 demande un moyen de
      -- paiement, l'image ne vit qu'une heure, et une story pese moins de
      -- trois cents kilo-octets. Le jour ou le volume change, c'est ici qu'on
      -- bascule, et nulle part ailleurs.
      jpeg TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      -- L'heure ou Meta est venu la chercher. Renseignee, elle dit que le
      -- depot a servi et qu'il peut disparaitre.
      pris_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS reseaux_images_age
                  ON reseaux_images(cree_le)`),
  ]);
  pret.add(db);
}

/** Un identifiant qu'on ne devine pas. */
function tirerId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Range une image et rend son identifiant.
 *
 * Le menage se fait ici plutot que dans une tache planifiee : il n'y en a
 * aucune sur ce Worker, et un depot qui grossit sans que personne ne regarde
 * est exactement le genre de chose qu'on decouvre trop tard. Chaque depot
 * paie donc le nettoyage du precedent.
 */
export async function deposerImage(db, jpegBase64) {
  await ensureEnvoiTables(db);
  const taille = Math.floor(String(jpegBase64 || '').length * 0.75);
  if (!jpegBase64) throw new Error('image vide');
  if (taille > MAX_OCTETS) throw new Error('image trop lourde');

  try {
    await db.prepare(`DELETE FROM reseaux_images WHERE cree_le < ?`)
      .bind(Date.now() - DUREE_MS).run();
  } catch { /* le menage ne doit pas empecher le depot */ }

  const id = tirerId();
  await db.prepare(
    `INSERT INTO reseaux_images (id, jpeg, cree_le) VALUES (?, ?, ?)`
  ).bind(id, jpegBase64, Date.now()).run();
  return id;
}

/** Rend une image deposee, ou null si elle a expire. */
export async function lireImage(db, id) {
  await ensureEnvoiTables(db);
  const l = await db.prepare(
    `SELECT jpeg, cree_le FROM reseaux_images WHERE id = ?`
  ).bind(String(id || '')).first();
  if (!l) return null;
  if (Date.now() - Number(l.cree_le) > DUREE_MS) return null;
  // On note le passage : c'est ce qui permet de dire, apres coup, si Meta est
  // reellement venu chercher l'image. Sans cette trace, un echec de
  // publication ne se distingue pas d'une image jamais lue.
  try {
    await db.prepare(`UPDATE reseaux_images SET pris_le = ? WHERE id = ? AND pris_le IS NULL`)
      .bind(Date.now(), id).run();
  } catch { /* la trace est un agrement */ }
  return l.jpeg;
}

export async function oublierImage(db, id) {
  try {
    await ensureEnvoiTables(db);
    await db.prepare(`DELETE FROM reseaux_images WHERE id = ?`).bind(String(id || '')).run();
  } catch { /* elle partira avec le menage suivant */ }
}

/** L'envoi est-il configure sur ce Worker ? */
export function envoiPret(env) {
  return !!(jeton(env) && compte(env));
}

/* ------------------------------------------------------- le jeton, lu juste
   Un secret se pose en le collant, et un collage emporte ce qui l'entoure :
   un retour a la ligne (`echo … | wrangler secret put`), des guillemets
   recopies d'un fichier, une espace. Meta repond alors « Cannot parse access
   token » pour un jeton pourtant juste — c'est ce qui est arrive le 10
   septembre 2026, et rien, cote Meta, ne dit que le probleme est autour.

   DEUX FAMILLES de jetons publient, avec les memes appels mais pas chez le
   meme serveur :
     - « Facebook Login » (EAA…) : graph.facebook.com, via la Page liee ;
     - « Instagram Login » (IG…) : graph.instagram.com, sans Page.
   La console de Meta fabrique l'une ou l'autre selon l'ecran d'ou l'on part,
   et envoyer la seconde au premier serveur donne exactement la meme erreur
   qu'un jeton tronque. On choisit donc le serveur d'apres le jeton. */
const API_IG = 'https://graph.instagram.com/v21.0';
const nettoyer = v => String(v || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
const jeton = env => nettoyer(env && env.IG_JETON);
const compte = env => nettoyer(env && env.IG_COMPTE);
const estInstagramLogin = j => /^IG/.test(j);
const hote = env => (estInstagramLogin(jeton(env)) ? API_IG : API);

/**
 * Ce qu'on peut dire des deux secrets SANS les montrer : leur forme, puis
 * l'avis de Meta. Ni le jeton ni un fragment ne sortent — sauf ses trois
 * premiers caracteres, qui disent sa famille (EAA, IGA) et rien de plus.
 */
export async function diagnostiquer(env) {
  const brut = String((env && env.IG_JETON) || '');
  const j = jeton(env), c = compte(env);
  const d = {
    jeton: {
      pose: !!brut,
      longueur: j.length,
      debut: j.slice(0, 3),
      famille: estInstagramLogin(j) ? 'Instagram Login (graph.instagram.com)'
             : /^EAA/.test(j) ? 'Facebook Login (graph.facebook.com)' : 'inconnue',
      entoure: brut !== j,              // blancs ou guillemets retires autour
      blancsDedans: /\s/.test(j),       // un jeton n'en contient jamais
    },
    compte: { pose: !!c, numerique: /^\d+$/.test(c), longueur: c.length },
    hote: hote(env),
  };
  if (!j) return d;
  try {
    const moi = estInstagramLogin(j) ? '/me?fields=user_id,username' : '/me?fields=id,name';
    const r = await fetch(`${hote(env)}${moi}&access_token=${encodeURIComponent(j)}`);
    const m = await r.json().catch(() => ({}));
    d.meta = r.ok ? { ok: true, nom: m.username || m.name || null, id: m.user_id || m.id || null }
                  : { ok: false, http: r.status, erreur: messageMeta(m) };
    if (r.ok && c) {
      const rc = await fetch(`${hote(env)}/${encodeURIComponent(c)}?fields=id,username`
                           + `&access_token=${encodeURIComponent(j)}`);
      const mc = await rc.json().catch(() => ({}));
      d.meta.compte = rc.ok ? { ok: true, username: mc.username || null }
                            : { ok: false, http: rc.status, erreur: messageMeta(mc) };
    }
  } catch (e) {
    d.meta = { ok: false, erreur: String(e && e.message || e) };
  }
  return d;
}

/* ------------------------------------------------------------ les formats
   Ce que chaque format demande a Meta, ecrit une fois. Une image passe par le
   depot ci-dessus : Meta la lit a une adresse. Une video, non — elle est trop
   lourde pour D1, et c'est Meta qui la RECOIT directement (voir chargerVideo).

   Une story ne porte pas de legende : l'API ne la prend pas. Le texte d'une
   story est dans l'image elle-meme, ou dans les stickers poses a la main. */
const IMAGE = { fil: {}, story: { media_type: 'STORIES' } };
const VIDEO = { reel: 'REELS', story: 'STORIES' };

/** Ce que ce Worker sait envoyer. L'atelier le lit avant de proposer un bouton :
    un calendrier deploye avant le Worker ne doit pas offrir un reel qui ne
    partira pas. */
export const FORMATS = ['fil', 'story', 'reel', 'story-video'];

/** La limite d'un corps de requete sur un Worker est de 100 Mo ; on garde de
    la marge. Une story video en accepte 100 chez Meta, un reel 300 : ce sont
    donc les notres qui tombent en premier, et il vaut mieux le dire ici que
    laisser Cloudflare couper la requete sans explication. */
export const MAX_VIDEO_OCTETS = 95 * 1024 * 1024;

const echec = (etape, erreur, http) => ({ ok: false, etape, erreur, http });
const nonPret = () => echec('configuration',
  'IG_JETON et IG_COMPTE ne sont pas poses sur le Worker');

/** Le message de Meta, s'il en a donne un. */
const messageMeta = d => (d && d.error && d.error.message) || 'reponse inattendue';

/** Cree un conteneur. Rend son identifiant, et l'adresse de depot pour une video. */
async function creerConteneur(env, champs) {
  try {
    const r = await fetch(`${hote(env)}/${compte(env)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...champs, access_token: jeton(env) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return echec('conteneur', messageMeta(d), r.status);
    return { ok: true, creation: String(d.id), uri: d.uri || null };
  } catch (e) {
    return echec('conteneur', String(e && e.message || e));
  }
}

/**
 * Ou en est un conteneur ? IN_PROGRESS tant que Meta lit ou transcode,
 * FINISHED quand il peut partir, ERROR sinon — et dans ce cas `detail` porte
 * le code de Meta (« 2207026 » : format video refuse), qui est la seule piste.
 */
export async function etatConteneur(env, creation) {
  if (!envoiPret(env)) return nonPret();
  if (!/^\d+$/.test(String(creation || ''))) return echec('verification', 'conteneur inconnu');
  try {
    const r = await fetch(`${hote(env)}/${creation}?fields=status_code,status`
                        + `&access_token=${encodeURIComponent(jeton(env))}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return echec('etat', messageMeta(d), r.status);
    return { ok: true, etat: d.status_code || 'INCONNU', detail: d.status || null };
  } catch (e) {
    return echec('etat', String(e && e.message || e));
  }
}

/** L'adresse publique d'une publication, pour pouvoir aller la voir. Un
    agrement : si Meta ne la donne pas, la publication n'en est pas moins faite. */
async function lienDe(env, media) {
  try {
    const r = await fetch(`${hote(env)}/${media}?fields=permalink`
                        + `&access_token=${encodeURIComponent(jeton(env))}`);
    const d = await r.json().catch(() => ({}));
    return d.permalink || null;
  } catch { return null; }
}

/** Publie un conteneur pret. C'est le seul appel de ce module qui se voit. */
export async function publierConteneur(env, creation) {
  if (!envoiPret(env)) return nonPret();
  if (!/^\d+$/.test(String(creation || ''))) return echec('verification', 'conteneur inconnu');
  try {
    const r = await fetch(`${hote(env)}/${compte(env)}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: String(creation), access_token: jeton(env) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return echec('publication', messageMeta(d), r.status);
    return { ok: true, publication: d.id, lien: await lienDe(env, d.id) };
  } catch (e) {
    return echec('publication', String(e && e.message || e));
  }
}

/**
 * Publie une image sur Instagram — au fil, ou en story.
 *
 * Meta demande d'abord de creer un « conteneur » a partir de l'adresse de
 * l'image, puis de le publier. Les deux appels peuvent echouer pour des
 * raisons differentes, et il faut le dire : « la publication a echoue » sans
 * plus de detail oblige a aller lire les journaux de Meta, ce que personne ne
 * fait.
 *
 * Entre les deux, Meta telecharge l'image. Ce n'est pas instantane, et publier
 * un conteneur qui n'est pas pret echoue : on attend donc qu'il annonce
 * FINISHED, sans depasser un temps raisonnable.
 */
export async function publierInstagram(env, { adresseImage, legende, format = 'fil' }) {
  if (!envoiPret(env)) return nonPret();
  if (!(format in IMAGE)) return echec('verification', `format inconnu : ${format}`);

  // --- 1. le conteneur -----------------------------------------------------
  const champs = { image_url: adresseImage, ...IMAGE[format] };
  if (format === 'fil') champs.caption = legende || '';
  const c = await creerConteneur(env, champs);
  if (!c.ok) return c;

  // --- 2. attendre que Meta ait pris l'image -------------------------------
  // Sans cette attente, la publication echoue par intermittence — et une panne
  // intermittente est celle qu'on met le plus longtemps a comprendre.
  for (let i = 0; i < 10; i++) {
    const e = await etatConteneur(env, c.creation);
    if (e.ok && e.etat === 'FINISHED') break;
    if (e.ok && e.etat === 'ERROR') {
      return echec('preparation', `Meta n a pas pu lire l image deposee${e.detail ? ' — ' + e.detail : ''}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  // --- 3. la publication ---------------------------------------------------
  return publierConteneur(env, c.creation);
}

/* ------------------------------------------------------------- les videos
   Trois temps, et c'est l'atelier qui les enchaine, pas le Worker :

     1. ouvrirVideo    — Meta cree le conteneur et rend une adresse de depot ;
     2. chargerVideo   — les octets du MP4 passent A TRAVERS le Worker, en flux,
                         jusqu'a cette adresse. Le jeton reste ici, la video ne
                         s'arrete nulle part : ni D1, ni R2, ni memoire ;
     3. publierConteneur, une fois que etatConteneur annonce FINISHED.

   Pourquoi pas une seule requete : Meta met de quelques secondes a plusieurs
   minutes a transcoder un reel. Tenir une requete ouverte tout ce temps, c'est
   parier sur la patience du navigateur et du reseau ; l'atelier, lui, peut
   interroger toutes les trois secondes et dire ou il en est. */

/** Etape 1. `couverture` est l'adresse d'une image deja deposee, ou rien. */
export async function ouvrirVideo(env, { format, legende, partagerAuFil = true, couverture = null }) {
  if (!envoiPret(env)) return nonPret();
  const type = VIDEO[format];
  if (!type) return echec('verification', `format video inconnu : ${format}`);
  const champs = { media_type: type, upload_type: 'resumable' };
  if (type === 'REELS') {
    champs.caption = legende || '';
    champs.share_to_feed = !!partagerAuFil;
    if (couverture) champs.cover_url = couverture;
  }
  const c = await creerConteneur(env, champs);
  if (!c.ok) return c;
  if (!c.uri) return echec('conteneur', 'Meta n a pas rendu d adresse de depot');
  return c;
}

/**
 * Etape 2. `corps` est le flux de la requete de l'atelier, `taille` sa longueur.
 *
 * L'adresse de depot revient de l'atelier, qui l'a recue de Meta a l'etape 1.
 * C'est la seule adresse de ce module qu'on ne construit pas soi-meme, et on y
 * envoie le jeton : elle est donc verifiee avant — un jeton parti ailleurs que
 * chez Meta est un jeton perdu.
 */
export async function chargerVideo(env, { creation, uri, corps, taille }) {
  if (!envoiPret(env)) return nonPret();
  let adresse;
  try { adresse = new URL(String(uri || '')); } catch { adresse = null; }
  if (!/^\d+$/.test(String(creation || ''))
      || !adresse || adresse.protocol !== 'https:'
      || adresse.hostname !== 'rupload.facebook.com'
      || !adresse.pathname.endsWith('/' + creation)) {
    return echec('verification', 'adresse de depot refusee');
  }
  if (!corps || !(taille > 0)) return echec('verification', 'video vide');
  if (taille > MAX_VIDEO_OCTETS) {
    return echec('verification', `video trop lourde : ${Math.round(taille / 1048576)} Mo, `
                               + `${Math.round(MAX_VIDEO_OCTETS / 1048576)} au plus`);
  }
  try {
    // Un flux de longueur annoncee : sans elle, le Worker enverrait en
    // morceaux, et le depot de Meta attend un fichier dont il connait la taille.
    const { readable, writable } = new FixedLengthStream(taille);
    corps.pipeTo(writable).catch(() => { /* l'echec se lira dans la reponse */ });
    const r = await fetch(adresse.href, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${jeton(env)}`,
        offset: '0',
        file_size: String(taille),
      },
      body: readable,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) {
      return echec('chargement',
        (d.debug_info && d.debug_info.message) || messageMeta(d), r.status);
    }
    return { ok: true };
  } catch (e) {
    return echec('chargement', String(e && e.message || e));
  }
}
