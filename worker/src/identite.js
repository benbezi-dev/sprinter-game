/* ---------------------------------------------------------------------------
   RETROUVER SON NOM
   ---------------------------------------------------------------------------
   Un nom appartient a qui le reserve, et cette appartenance se prouve par un
   code court garde dans le navigateur. Tant que le navigateur garde, tout va
   bien. Le jour ou il oublie, le joueur se retrouve devant son propre nom qui
   lui est refuse, et le jeu n'avait rien a lui proposer.

   Le navigateur oublie plus souvent qu'on ne le croit. Il oublie quand on
   efface les donnees de navigation, quand Safari applique sa peremption de
   sept jours a un site qu'on n'a pas ouvert, quand on change de telephone — et
   il a oublie pour TOUT LE MONDE le jour ou le jeu a change d'adresse, parce
   que `localStorage` est cloisonne par origine et que la redirection emmene
   l'URL, pas le stockage.

   Deux chemins, donc, et ils ne repondent pas a la meme question.

   LE TRANSFERT repond a « j'ai un appareil qui me connait deja ». C'est le cas
   courant et il se resout tout seul : l'appareil relie tire un jeton, le
   telephone le presente, et le serveur relie le second au meme nom. Rien a
   retaper, rien a arbitrer — l'appareil d'origine fait foi, exactement comme
   le code qu'il detient ferait foi.

   LA RECUPERATION repond a « je n'ai plus rien ». Elle ne peut pas se resoudre
   toute seule, et il faut le dire franchement : sans e-mail, sans tiers, sans
   mot de passe, aucune verification automatique ne distingue le proprietaire
   d'un nom de quelqu'un qui le convoite. Le chrono, le pseudo Instagram, le
   rang : tout cela est affiche au TOP 500, donc tout cela est connu de qui
   veut le lire. Une question secrete batie sur des donnees publiques n'est pas
   une preuve, c'est une formalite.

   Alors on ne fait pas semblant : la demande est deposee, et un humain
   tranche. C'est lent, c'est manuel, et c'est la seule chose honnete quand la
   seule preuve possible vit en dehors du jeu — un message, une reconnaissance,
   un « oui c'est bien lui ». Le jeu ne pretend pas verifier ; il transmet.

   INSTAGRAM, quand le joueur en a lie un, change la nature de cet arbitrage.

   Attention a ce qui prouve quoi. Declarer un pseudo ne prouve rien : le
   pseudo est affiche au TOP 500, n'importe qui peut le recopier et jurer que
   c'est le sien. Ce qui prouve, c'est d'ECRIRE DEPUIS ce compte — cela, seul
   son titulaire peut le faire.

   D'ou le mot de passage. Le serveur en tire un, unique, pour cette demande ;
   le joueur l'envoie en message prive a @sprintergame depuis le compte lie au
   nom ; celui qui tranche lit la boite du jeu et voit les deux choses qui
   comptent ensemble — le message vient bien de ce compte-la, et il porte bien
   ce mot-la. La decision n'est plus une impression, c'est un constat.

   Meta a retire fin 2024 l'API qui aurait permis de lire cela tout seul pour
   un compte personnel. L'humain remplace donc l'appel d'API, mais il verifie
   exactement la meme chose — et il la verifie mieux qu'une question secrete
   batie sur des chiffres publics.
--------------------------------------------------------------------------- */

/** Le compte du jeu, celui qui recoit les messages de recuperation. */
export const COMPTE_JEU = 'sprintergame';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * La duree de vie d'un jeton de transfert.
 *
 * Dix minutes : le temps de sortir son telephone et de viser un QR code, pas
 * le temps qu'un jeton oublie dans un historique de navigation serve encore le
 * mois prochain. Le jeton est de toute facon consomme a la premiere liaison —
 * la peremption ne couvre que celui qu'on tire sans s'en servir.
 */
const VIE_JETON_MS = 10 * 60 * 1000;

/** Un jeton de transfert : court, sans caractere ambigu, jamais devine. */
function tirerJeton(n = 8) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

// Comme ailleurs dans ce worker, la memoire des migrations est tenue PAR BASE :
// le worker en sert deux, et un simple booleen laisserait la seconde sans
// tables parce que la premiere aurait deja eteint la migration.
const pret = new WeakSet();
export async function ensureIdentiteTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS transferts (
      jeton TEXT PRIMARY KEY,
      name_key TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL,
      utilise_le INTEGER,
      utilise_par TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS transferts_peremption
                  ON transferts(expire_le)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recuperations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      device_id TEXT NOT NULL,
      indice TEXT,
      cree_le INTEGER NOT NULL,
      etat TEXT NOT NULL DEFAULT 'attente',
      tranche_le INTEGER,
      rendu_le INTEGER,
      insta TEXT,
      phrase TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS recuperations_file
                  ON recuperations(etat, cree_le)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS recuperations_demandeur
                  ON recuperations(name_key, device_id, cree_le)`),
  ]);
  pret.add(db);
}

/**
 * Le mot de passage a envoyer depuis son compte Instagram.
 *
 * Prefixe pour qu'il ne se confonde avec rien dans une boite de messages, et
 * pour que celui qui le recoit sache tout de suite de quoi il s'agit.
 */
function tirerPhrase() {
  return 'SPRINTER-' + tirerJeton(6);
}

/** Cet appareil est-il deja reconnu sous ce nom ? */
async function appareilRelie(db, nameKey, deviceId) {
  const r = await db.prepare(
    `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
  ).bind(nameKey, deviceId).first();
  return !!r;
}

/* ------------------------------------------------------------- le transfert */

/**
 * Tirer un jeton depuis un appareil qui connait deja le nom.
 *
 * L'appelant doit etre relie : c'est toute la verification, et elle suffit.
 * Un appareil relie detient deja le code — il pourrait le dicter. Lui laisser
 * tirer un jeton ne lui donne aucun pouvoir de plus, cela lui evite seulement
 * de faire epeler six caracteres a quelqu'un qui tient un telephone.
 */
export async function ouvrirTransfert(db, nameKey, deviceId) {
  await ensureIdentiteTables(db);
  if (!(await appareilRelie(db, nameKey, deviceId))) return { erreur: 'pas-a-toi' };

  // Les jetons perimes de ce nom partent au passage. Ils ne servent plus a
  // rien et personne d'autre ne viendra jamais les balayer.
  const now = Date.now();
  await db.prepare(
    `DELETE FROM transferts WHERE name_key = ? AND (expire_le < ? OR utilise_le IS NOT NULL)`
  ).bind(nameKey, now).run();

  const jeton = tirerJeton();
  const expire = now + VIE_JETON_MS;
  await db.prepare(
    `INSERT INTO transferts (jeton, name_key, cree_le, expire_le) VALUES (?, ?, ?, ?)`
  ).bind(jeton, nameKey, now, expire).run();
  return { jeton, expire_le: expire, vie_ms: VIE_JETON_MS };
}

/**
 * Presenter un jeton depuis le nouvel appareil.
 *
 * Un jeton ne sert qu'une fois. La consommation se fait par une ecriture
 * conditionnelle — `WHERE utilise_le IS NULL` — plutot que par une lecture
 * suivie d'une ecriture : deux telephones qui viseraient le meme QR code dans
 * la meme seconde passeraient tous les deux le test de lecture, et le second
 * n'a rien a faire dans ce nom.
 */
export async function utiliserTransfert(db, jeton, deviceId) {
  await ensureIdentiteTables(db);
  const j = String(jeton || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(j)) return { erreur: 'inconnu' };

  const now = Date.now();
  const pris = await db.prepare(
    `UPDATE transferts SET utilise_le = ?, utilise_par = ?
      WHERE jeton = ? AND utilise_le IS NULL AND expire_le >= ?`
  ).bind(now, deviceId, j, now).run();

  if (!(pris && pris.meta && pris.meta.changes)) {
    // Rien n'a bouge : le jeton n'existe pas, il a deja servi, ou il est
    // perime. On distingue les deux derniers cas du premier, parce qu'ils
    // n'appellent pas la meme phrase a l'ecran : « redemande un lien » plutot
    // que « ce lien n'a jamais existe ».
    const t = await db.prepare(
      `SELECT expire_le, utilise_le FROM transferts WHERE jeton = ?`).bind(j).first();
    if (!t) return { erreur: 'inconnu' };
    return { erreur: t.utilise_le ? 'deja-utilise' : 'perime' };
  }

  const t = await db.prepare(
    `SELECT name_key FROM transferts WHERE jeton = ?`).bind(j).first();
  const p = await db.prepare(
    `SELECT name, code FROM players WHERE name_key = ?`).bind(t.name_key).first();
  if (!p) return { erreur: 'inconnu' };

  await db.prepare(
    `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
  ).bind(t.name_key, deviceId, now).run();

  return { ok: true, name: p.name, code: p.code };
}

/* --------------------------------------------------------- la recuperation */

/**
 * Deposer une demande de recuperation.
 *
 * Un cas se resout sans deranger personne : l'appareil est deja relie et c'est
 * le code seul qui a ete perdu. Il n'y a alors rien a arbitrer — l'appareil
 * prouve deja ce qu'il faut prouver, on lui rend son code.
 *
 * Sinon la demande entre dans la file. Une seule par appareil et par nom tant
 * qu'elle attend : reappuyer sur le bouton ne doit pas remplir la file de la
 * meme demande, et celui qui attend a besoin de voir sa demande, pas d'en
 * empiler dix.
 */
export async function demanderRecuperation(db, { nameKey, nom, deviceId, indice }) {
  await ensureIdentiteTables(db);

  const p = await db.prepare(
    `SELECT name, code, insta FROM players WHERE name_key = ?`).bind(nameKey).first();
  if (!p) return { erreur: 'inconnu' };

  if (await appareilRelie(db, nameKey, deviceId)) {
    return { ok: true, direct: true, name: p.name, code: p.code };
  }

  const enCours = await db.prepare(
    `SELECT id, cree_le, insta, phrase FROM recuperations
      WHERE name_key = ? AND device_id = ? AND etat = 'attente'`
  ).bind(nameKey, deviceId).first();
  // La meme demande rend le meme mot de passage : le joueur qui reappuie sur
  // le bouton apres avoir ferme le jeu doit retrouver celui qu'il a peut-etre
  // deja envoye, pas un second qui invaliderait son message.
  if (enCours) {
    return {
      ok: true, etat: 'attente', id: enCours.id, deja: true,
      insta: enCours.insta, phrase: enCours.phrase, compte: COMPTE_JEU,
    };
  }

  // Le mot de passage n'a de sens que s'il y a un compte d'ou l'envoyer. Sans
  // Instagram lie, la demande part quand meme — elle sera tranchee sur ce que
  // le joueur raconte, ce qui est plus faible, et c'est justement pourquoi
  // l'ecran l'invite d'abord a lier son compte.
  const phrase = p.insta ? tirerPhrase() : null;

  const texte = String(indice || '').trim().slice(0, 280) || null;
  const r = await db.prepare(
    `INSERT INTO recuperations (name_key, nom, device_id, indice, cree_le, insta, phrase)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(nameKey, String(nom || p.name).slice(0, 40), deviceId, texte, Date.now(),
         p.insta || null, phrase).run();

  return {
    ok: true, etat: 'attente', id: (r && r.meta && r.meta.last_row_id) || null,
    insta: p.insta || null, phrase, compte: COMPTE_JEU,
  };
}

/**
 * Ou en est ma demande ?
 *
 * C'est ici que l'acceptation prend effet, et pas au moment ou l'administrateur
 * tranche : le code n'est rendu qu'a l'appareil qui vient le chercher, quand il
 * vient le chercher. Trancher marque une decision, cette route la delivre —
 * de sorte qu'un « oui » donne a un appareil ne relie que cet appareil-la.
 */
export async function etatRecuperation(db, nameKey, deviceId) {
  await ensureIdentiteTables(db);

  // Le code a pu revenir autrement entre-temps : par un transfert, ou parce
  // que le joueur a retrouve son bout de papier. Inutile de lui parler d'une
  // demande en attente s'il n'attend plus rien.
  const p = await db.prepare(
    `SELECT name, code, insta FROM players WHERE name_key = ?`).bind(nameKey).first();
  if (!p) return { etat: 'inconnu' };
  if (await appareilRelie(db, nameKey, deviceId)) {
    return { etat: 'accepte', name: p.name, code: p.code };
  }

  const d = await db.prepare(
    `SELECT id, etat, cree_le, tranche_le, insta, phrase FROM recuperations
      WHERE name_key = ? AND device_id = ?
      ORDER BY cree_le DESC LIMIT 1`
  ).bind(nameKey, deviceId).first();
  if (!d) return { etat: 'aucune' };
  // En attente, on redonne le mot de passage : c'est la seule chose que le
  // joueur ait a faire, et il a pu fermer le jeu avant de l'envoyer.
  if (d.etat === 'attente') {
    return {
      etat: 'attente', depuis: d.cree_le,
      insta: d.insta, phrase: d.phrase, compte: COMPTE_JEU,
    };
  }
  if (d.etat === 'refuse') return { etat: 'refuse', tranche_le: d.tranche_le };

  // Accepte : on relie maintenant, et on rend le code.
  const now = Date.now();
  await db.prepare(
    `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
  ).bind(nameKey, deviceId, now).run();
  await db.prepare(
    `UPDATE recuperations SET rendu_le = ? WHERE id = ? AND rendu_le IS NULL`
  ).bind(now, d.id).run();
  return { etat: 'accepte', name: p.name, code: p.code };
}

/**
 * La file, pour celui qui tranche.
 *
 * Chaque demande arrive avec de quoi decider : depuis quand le nom existe,
 * combien de courses il porte, quand il a joue pour la derniere fois, et le
 * pseudo Instagram si le joueur en a declare un. Trancher sans ces lignes
 * reviendrait a tirer a pile ou face.
 */
export async function listerRecuperations(db, { toutes } = {}) {
  await ensureIdentiteTables(db);
  const filtre = toutes ? '' : `WHERE r.etat = 'attente'`;
  const { results } = await db.prepare(
    `SELECT r.id, r.name_key, r.nom, r.device_id, r.indice, r.cree_le,
            r.etat, r.tranche_le, r.phrase, r.insta AS insta_attendu,
            p.created_at AS nom_cree_le, p.insta,
            (SELECT COUNT(*) FROM player_devices d WHERE d.name_key = r.name_key)
              AS appareils,
            (SELECT COUNT(*) FROM races c WHERE c.name_key = r.name_key)
              AS courses,
            (SELECT MAX(c.created_at) FROM races c WHERE c.name_key = r.name_key)
              AS derniere_course
       FROM recuperations r
       LEFT JOIN players p ON p.name_key = r.name_key
       ${filtre}
      ORDER BY r.etat = 'attente' DESC, r.cree_le DESC
      LIMIT 200`
  ).all();
  return (results || []).map(r => ({
    id: r.id,
    nom: r.nom,
    name_key: r.name_key,
    appareil: String(r.device_id || '').slice(0, 8),
    indice: r.indice,
    cree_le: r.cree_le,
    etat: r.etat,
    tranche_le: r.tranche_le,
    nom_cree_le: r.nom_cree_le,
    // Les deux moities de la preuve : de quel compte le message doit venir, et
    // quel mot il doit porter. Celui qui tranche n'a que ces deux lignes a
    // confronter a sa boite de reception.
    insta: r.insta_attendu || r.insta,
    phrase: r.phrase,
    compte: COMPTE_JEU,
    appareils: r.appareils,
    courses: r.courses,
    derniere_course: r.derniere_course,
  }));
}

/**
 * Trancher.
 *
 * On ecrit la decision, on ne relie pas encore : c'est l'appareil demandeur
 * qui declenchera la liaison en venant chercher sa reponse. La condition
 * `etat = 'attente'` empeche de revenir sur une demande deja tranchee — un
 * second clic, un onglet reste ouvert, deux personnes devant la meme file.
 */
export async function trancherRecuperation(db, id, accepte) {
  await ensureIdentiteTables(db);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return { erreur: 'demande inconnue' };
  const r = await db.prepare(
    `UPDATE recuperations SET etat = ?, tranche_le = ?
      WHERE id = ? AND etat = 'attente'`
  ).bind(accepte ? 'accepte' : 'refuse', Date.now(), n).run();
  const touche = r && r.meta && r.meta.changes;
  return touche ? { ok: true, id: n, etat: accepte ? 'accepte' : 'refuse' }
                : { erreur: 'demande inconnue ou deja tranchee' };
}

/**
 * Ce texte est-il le code de quelqu'un ?
 *
 * Sert a rattraper le geste qui a coute une demi-heure a son auteur : coller
 * son code de recuperation dans le champ du nom. Le jeu reservait alors le
 * code comme s'il s'agissait d'un pseudo, rendait un second code, et le joueur
 * se retrouvait avec un nom qu'il n'avait pas choisi et un code qui n'ouvrait
 * rien.
 *
 * On ne devine pas sur la forme — un pseudo a le droit de ressembler a un
 * code. On regarde si cette chaine EST un code en base : c'est le seul test
 * qui ne se trompe jamais dans les deux sens.
 */
export async function estUnCode(db, texte) {
  const t = String(texte || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(t)) return null;
  const p = await db.prepare(
    `SELECT name FROM players WHERE code = ?`).bind(t).first();
  return p ? p.name : null;
}
