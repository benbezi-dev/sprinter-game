/* ---------------------------------------------------------------------------
   ACCES A LA VERSION DE TEST
   ---------------------------------------------------------------------------
   La version de test ouvre tout : duels, relais, championnats, course en
   direct. Elle vit a la meme adresse que le jeu, dans un sous-dossier, et il
   faut donc pouvoir decider qui y entre — et surtout pouvoir revenir sur cette
   decision.

   Un code par personne, plutot qu'un mot de passe commun. La difference est
   entiere : avec un mot de passe partage, retirer l'acces a quelqu'un oblige a
   le changer pour tout le monde et a le redistribuer. Avec un code par
   personne, on en revoque un et lui seul cesse d'entrer.

   Deux precisions sur ce que cette porte protege, et ce qu'elle ne protege pas.

   La porte cote navigateur est une porte, pas un coffre : le code du jeu est
   public, quelqu'un de determine peut la contourner. Ce qui compte vraiment se
   joue ici, sur le serveur — sans code valide, les routes du relais et des
   championnats repondent 403, et surtout les ecritures partent dans la base de
   test, jamais dans celle de production.

   La revocation est immediate parce qu'elle est verifiee a chaque requete. Il
   n'y a pas de jeton qui survivrait a sa revocation, pas de session a expirer :
   le code est presente a chaque fois, et le jour ou il ne vaut plus rien, il ne
   vaut plus rien tout de suite.
--------------------------------------------------------------------------- */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Un code court, lisible a voix haute : ni O/0 ni I/1 ni L. */
function tirerCode(n = 6) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const pret = new WeakSet();
export async function ensureAccesTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS acces_test (
      code TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      revoque_le INTEGER,
      dernier_vu INTEGER,
      vus INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS acces_test_vivants
                  ON acces_test(revoque_le)`),
  ]);
  pret.add(db);
}

/**
 * Le code donne-t-il acces, a cette seconde ?
 *
 * Renvoie { code, nom } si oui, null sinon. On note le passage au passage :
 * savoir qui s'est servi de son code, et quand, est la seule facon de reperer
 * un code qui circule plus qu'il ne devrait.
 */
export async function verifierAcces(db, code, ctx) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(c)) return null;
  await ensureAccesTables(db);

  const r = await db.prepare(
    `SELECT code, nom, revoque_le FROM acces_test WHERE code = ?`
  ).bind(c).first();
  if (!r || r.revoque_le) return null;

  // La trace de passage ne doit jamais retarder la reponse ni la faire
  // echouer : le joueur a le droit d'entrer, le reste est de la comptabilite.
  const noter = db.prepare(
    `UPDATE acces_test SET dernier_vu = ?, vus = vus + 1 WHERE code = ?`
  ).bind(Date.now(), c).run().catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(noter);

  return { code: r.code, nom: r.nom };
}

/**
 * Ouvre un acces au nom de quelqu'un.
 *
 * `codeVoulu` permet de choisir le code plutot que de le subir. Un code qu'on
 * a choisi se donne au telephone sans le faire repeter — et c'est bien ainsi
 * qu'un acces de test circule, de vive voix. Sans code voulu, on en tire un.
 */
export async function creerAcces(db, nom, codeVoulu) {
  await ensureAccesTables(db);
  const n = String(nom || '').trim().slice(0, 40) || 'sans nom';

  if (codeVoulu) {
    const c = String(codeVoulu).trim().toUpperCase();
    // Meme forme que celle acceptee a l'entree : ce qui ne peut pas etre saisi
    // ne doit pas pouvoir etre cree.
    if (!/^[A-Z0-9]{4,12}$/.test(c)) {
      return { erreur: 'code invalide : 4 a 12 lettres ou chiffres' };
    }
    const deja = await db.prepare(
      `SELECT code FROM acces_test WHERE code = ?`).bind(c).first();
    if (deja) return { erreur: 'ce code est deja pris', code: c };
    await db.prepare(
      `INSERT INTO acces_test (code, nom, cree_le) VALUES (?, ?, ?)`
    ).bind(c, n, Date.now()).run();
    return { code: c, nom: n, choisi: true };
  }

  for (let essai = 0; essai < 6; essai++) {
    const code = tirerCode();
    try {
      await db.prepare(
        `INSERT INTO acces_test (code, nom, cree_le) VALUES (?, ?, ?)`
      ).bind(code, n, Date.now()).run();
      return { code, nom: n };
    } catch (e) {
      // collision de code : on retire.
    }
  }
  return { erreur: 'impossible de tirer un code libre' };
}

/**
 * Retire l'acces. On garde la ligne plutot que de l'effacer : savoir a qui
 * l'acces a ete retire, et quand, vaut mieux qu'un trou dans la liste.
 */
export async function revoquerAcces(db, code) {
  await ensureAccesTables(db);
  const c = String(code || '').trim().toUpperCase();
  const r = await db.prepare(
    `UPDATE acces_test SET revoque_le = ? WHERE code = ? AND revoque_le IS NULL`
  ).bind(Date.now(), c).run();
  const touche = r && r.meta && r.meta.changes;
  return touche ? { ok: true, code: c } : { erreur: 'code inconnu ou deja revoque' };
}

/** Rend un acces revoque. */
export async function rendreAcces(db, code) {
  await ensureAccesTables(db);
  const c = String(code || '').trim().toUpperCase();
  const r = await db.prepare(
    `UPDATE acces_test SET revoque_le = NULL WHERE code = ?`
  ).bind(c).run();
  const touche = r && r.meta && r.meta.changes;
  return touche ? { ok: true, code: c } : { erreur: 'code inconnu' };
}

/** Qui a acces, qui ne l'a plus, et qui s'en est servi. */
export async function listerAcces(db) {
  await ensureAccesTables(db);
  const { results } = await db.prepare(
    `SELECT code, nom, cree_le, revoque_le, dernier_vu, vus
       FROM acces_test ORDER BY revoque_le IS NOT NULL, cree_le DESC`
  ).all();
  return (results || []).map(r => ({
    code: r.code, nom: r.nom,
    actif: !r.revoque_le,
    cree_le: r.cree_le, revoque_le: r.revoque_le,
    dernier_vu: r.dernier_vu, passages: r.vus,
  }));
}

/**
 * L'appelant est-il l'administrateur ?
 *
 * La cle vit dans un secret Cloudflare, jamais dans le depot. Sans secret pose,
 * l'administration est fermee — plutot fermee que grande ouverte par defaut.
 */
export function estAdmin(request, env) {
  return memeCle(request.headers.get('X-Sprinter-Admin'), env.ADMIN_CLE);
}

/**
 * L'appelant a-t-il le droit de lire le tableau de bord ?
 *
 * Une cle a part, et pas celle de l'administration : lire des compteurs n'est
 * pas refaire un classement. `ADMIN_CLE` ouvre `/duels/recalculer`, qui reecrit
 * le rang de tout le monde, et cree ou revoque les acces au canal de test. La
 * poser dans le navigateur pour consulter des chiffres reviendrait a promener
 * les cles de la maison pour aller chercher le courrier — d'autant que le
 * tableau s'ouvre depuis la page publique du jeu, ou n'importe quelle faille
 * d'affichage donnerait au passage tout ce que la cle permet.
 *
 * `TABLEAU_CLE` ne donne que la lecture de `/stats`. L'administrateur passe
 * aussi, parce qu'il peut deja tout : lui refuser la lecture serait une gene
 * sans etre une protection.
 *
 * Se pose une fois sur le Worker deploye :
 *
 *     npx wrangler secret put TABLEAU_CLE
 *
 * Sans ce secret, `/stats` reste ferme a tout le monde. C'est voulu : ferme par
 * defaut plutot qu'ouvert par oubli — et le jour ou l'on redeploie sans y
 * penser, on perd un tableau, pas la discretion de ses chiffres.
 */
export function estTableau(request, env) {
  return memeCle(request.headers.get('X-Sprinter-Tableau'), env.TABLEAU_CLE)
      || estAdmin(request, env);
}

/**
 * Deux chaines sont-elles la meme cle ?
 *
 * Sans cle attendue, personne ne passe. La comparaison se fait a temps
 * constant : une comparaison naive fuit la cle, caractere par caractere, a qui
 * prend la peine de chronometrer.
 */
function memeCle(donne, attendu) {
  if (!attendu) return false;
  const d = donne || '';
  if (d.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= d.charCodeAt(i) ^ attendu.charCodeAt(i);
  return diff === 0;
}
