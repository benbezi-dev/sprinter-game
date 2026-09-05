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
  return !!(env && env.IG_JETON && env.IG_COMPTE);
}

/**
 * Publie une image sur Instagram, en deux temps.
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
export async function publierInstagram(env, { adresseImage, legende }) {
  if (!envoiPret(env)) {
    return { ok: false, etape: 'configuration',
             erreur: 'IG_JETON et IG_COMPTE ne sont pas poses sur le Worker' };
  }
  const jeton = env.IG_JETON;
  const compte = env.IG_COMPTE;

  // --- 1. le conteneur -----------------------------------------------------
  let creation;
  try {
    const r = await fetch(`${API}/${compte}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: adresseImage, caption: legende || '',
                             access_token: jeton }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) {
      return { ok: false, etape: 'conteneur', http: r.status,
               erreur: (d.error && d.error.message) || 'reponse inattendue' };
    }
    creation = d.id;
  } catch (e) {
    return { ok: false, etape: 'conteneur', erreur: String(e && e.message || e) };
  }

  // --- 2. attendre que Meta ait pris l'image -------------------------------
  // Sans cette attente, la publication echoue par intermittence — et une panne
  // intermittente est celle qu'on met le plus longtemps a comprendre.
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(`${API}/${creation}?fields=status_code&access_token=${encodeURIComponent(jeton)}`);
      const d = await r.json().catch(() => ({}));
      if (d.status_code === 'FINISHED') break;
      if (d.status_code === 'ERROR') {
        return { ok: false, etape: 'preparation',
                 erreur: 'Meta n a pas pu lire l image deposee' };
      }
    } catch { /* on retente */ }
    await new Promise(r => setTimeout(r, 1500));
  }

  // --- 3. la publication ---------------------------------------------------
  try {
    const r = await fetch(`${API}/${compte}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creation, access_token: jeton }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) {
      return { ok: false, etape: 'publication', http: r.status,
               erreur: (d.error && d.error.message) || 'reponse inattendue' };
    }
    return { ok: true, publication: d.id };
  } catch (e) {
    return { ok: false, etape: 'publication', erreur: String(e && e.message || e) };
  }
}
