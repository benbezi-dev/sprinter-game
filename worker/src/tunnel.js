// Le tunnel des premiers pas : ou un nouveau joueur s'arrete.
//
// CE QUE LE TABLEAU NE SAVAIT PAS. On savait qu'un appareil etait passe
// (`visits`) et ce qu'il avait couru (`races`), pas ou il avait lache entre
// les deux : combien ouvrent le jeu sans jamais partir des blocs, combien
// lachent a l'etape 2 de la carriere. Le jeu envoie donc une ligne la
// PREMIERE fois qu'un appareil franchit chacune des etapes ci-dessous, et
// jamais ensuite — une ligne par appareil et par etape, rien de nominatif,
// l'identifiant anonyme deja utilise par le classement.
//
// SEULS LES APPAREILS NEUFS FORMENT UNE COHORTE. Le jour du deploiement, chaque
// joueur deja la envoie toutes ses etapes d'un coup a sa premiere ouverture :
// il « ouvre », « part », « arrive » pour la premiere fois aux yeux de cette
// table, alors qu'il court depuis des semaines. Le compter ferait un tunnel
// parfait et faux. Un appareil n'entre donc dans une cohorte que si `visits`
// ne l'a jamais vu AVANT le jour de son ouverture ici.
//
// « REJOUE UN AUTRE JOUR » NE VIENT PAS DU JEU. Il se lit dans `races` : une
// course terminee un jour posterieur a celui de l'ouverture. C'est la
// retention sur le JEU, pas sur l'ouverture — celle du tableau compte comme
// revenu un appareil qui rouvre sans courir. `races` est purgee a 300 courses
// par appareil, mais elle garde les plus RECENTES : un joueur qui a rejoue a
// forcement une course recente, la purge ne peut pas l'effacer.

/** Le chemin, dans l'ordre ou un nouveau joueur le parcourt. */
export const ETAPES_TUNNEL = [
  'ouverture',      // le jeu est charge (pas le tableau de bord)
  'ecran',          // la page est visible ET une image est peinte : quelqu'un a pu voir le jeu
  'accueil',        // l'intro est passee, l'ecran-titre s'affiche
  'depart',         // une course est lancee : le decompte commence
  'premier_appui',  // le joueur a appuye pendant la course : il est parti des blocs
  'arrivee',        // une course est allee au bout
  'carriere_2',     // l'etape 2 de la carriere est lancee
  'carriere_3',
  'carriere_4',
  'carriere_5',
  'carriere_6',
];

/** Ce qui se franchit a cote du chemin, sans en etre une marche. */
export const ETAPES_A_COTE = [
  'visite',         // la visite du jeu est fermee, vue ou passee
  'nom',            // un nom est pose — facultatif, on court sans
  'carriere_1',     // la carriere est lancee (et non le one shot)
  'oneshot',        // un one shot est lance
];

// L'OUVERTURE PART AU MONTAGE, AVANT QUE QUOI QUE CE SOIT NE S'AFFICHE. Sur 418
// appareils neufs en 30 jours, 225 n'avaient rien envoye d'autre et 211 avaient
// charge la page une seule fois : on ne savait pas distinguer un joueur qui
// part pendant le chargement d'un apercu de lien, d'un onglet ouvert en
// arriere-plan ou du navigateur integre d'Instagram ou de TikTok. D'ou
// « ecran » (la page est visible et peinte) et la fiche d'appareil ci-dessous.

/**
 * Les classes de navigateur que le jeu sait nommer (game/navigateur.ts). Toute
 * autre valeur est ignoree : la table ne doit contenir que des classes, jamais
 * une chaine saisie ou fabriquee par le client.
 */
export const NAVIGATEURS = [
  'instagram', 'tiktok', 'facebook', 'snapchat', 'autre-integre',
  'safari-ios', 'chrome-android', 'chrome', 'firefox', 'samsung', 'edge',
  'appli', 'robot', 'autre',
];
const NAVIGATEURS_OK = new Set(NAVIGATEURS);
export const navigateurValide = n => typeof n === 'string' && NAVIGATEURS_OK.has(n);

/** Du premier octet reçu a l'accueil : au-dela de deux minutes, ce n'est plus un chargement. */
export const CHARGEMENT_MAX_MS = 120000;
export const chargementValide = ms => Number.isInteger(ms) && ms >= 0 && ms <= CHARGEMENT_MAX_MS;

/**
 * LES TREIZE NUITS D'HALLOWEEN, nuit par nuit (16/10/2026).
 *
 * Trois marches par appareil : il a ouvert le mode, il a TENTE la nuit n, il
 * l'a TENUE. Une premiere fois chacune, comme le reste du tunnel. C'est ce qui
 * dit, pendant l'edition et pas apres, qu'une nuit bloque presque tout le
 * monde — et les temps impartis sont des constantes du jeu
 * (src/game/halloween-loi.js) : on les regle en un deploiement.
 *
 * A PART DU TUNNEL DES NOUVEAUX, et c'est voulu : ces marches se comptent sur
 * TOUS les appareils (lireHalloween), pas sur la cohorte des appareils neufs.
 */
export const ETAPES_HALLOWEEN = [
  'hw_entree',
  ...Array.from({ length: 13 }, (_, i) => `hw_nuit_${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `hw_tenue_${i + 1}`),
];

const CONNUES = new Set([...ETAPES_TUNNEL, ...ETAPES_A_COTE, ...ETAPES_HALLOWEEN]);
export const etapeConnue = e => typeof e === 'string' && CONNUES.has(e);

const pret = new WeakSet();
export async function ensureTunnel(db) {
  if (pret.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS tunnel (
    device_id TEXT NOT NULL,
    etape TEXT NOT NULL,
    premier_at INTEGER NOT NULL,
    PRIMARY KEY (device_id, etape)
  )`).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS tunnel_etape ON tunnel (etape, premier_at)`).run();
  // La fiche d'appareil : une ligne par appareil, la classe de navigateur et
  // le temps de chargement jusqu'a l'accueil. Aucune chaine d'agent brute.
  await db.prepare(`CREATE TABLE IF NOT EXISTS tunnel_appareil (
    device_id TEXT PRIMARY KEY,
    navigateur TEXT,
    chargement_ms INTEGER,
    at INTEGER
  )`).run();
  pret.add(db);
}

/** La premiere fois compte, les suivantes sont ignorees. */
export async function noterEtape(db, deviceId, etape, now = Date.now()) {
  await ensureTunnel(db);
  await db.prepare(
    `INSERT OR IGNORE INTO tunnel (device_id, etape, premier_at) VALUES (?, ?, ?)`
  ).bind(deviceId, etape, now).run();
}

/**
 * La fiche d'appareil, quand le jeu en envoie une avec une etape.
 *
 * Les deux champs sont facultatifs et arrivent a des moments differents : la
 * classe avec l'ouverture, la duree avec l'accueil. Chacun ne s'ecrit donc que
 * s'il est valide, et jamais par-dessus une valeur deja posee — la premiere
 * mesure d'un appareil est celle qui compte, comme pour les etapes.
 */
export async function noterAppareil(db, deviceId, fiche, now = Date.now()) {
  const navigateur = navigateurValide(fiche?.navigateur) ? fiche.navigateur : null;
  const chargement = chargementValide(fiche?.chargement_ms) ? fiche.chargement_ms : null;
  if (navigateur === null && chargement === null) return;
  await ensureTunnel(db);
  await db.prepare(
    `INSERT OR IGNORE INTO tunnel_appareil (device_id, navigateur, chargement_ms, at)
     VALUES (?, ?, ?, ?)`).bind(deviceId, navigateur, chargement, now).run();
  // La ligne existait peut-etre deja, avec l'autre moitie seulement.
  await db.prepare(
    `UPDATE tunnel_appareil
        SET navigateur = COALESCE(navigateur, ?1),
            chargement_ms = COALESCE(chargement_ms, ?2)
      WHERE device_id = ?3`).bind(navigateur, chargement, deviceId).run();
}

const JOUR = 86400000;
const debutDuJour = ms => Math.floor(ms / JOUR) * JOUR;

/** Mediane d'une liste de nombres, ou null. */
function mediane(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Percentile (rang le plus proche) d'une liste de nombres, ou null. */
function centile(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}

/**
 * Le tunnel des appareils NEUFS ouverts sur les `jours` derniers jours.
 *
 * Pour chaque etape : combien de la cohorte l'ont franchie, et le temps
 * median depuis l'ouverture — c'est la ou l'on voit qu'un joueur « perd du
 * temps ». Tout est compte sur la meme cohorte : un tunnel dont chaque marche
 * aurait sa propre population ne se lirait pas comme un tunnel.
 */
export async function lireTunnel(db, jours = 30, now = Date.now()) {
  await ensureTunnel(db);
  const depuis = now - jours * JOUR;

  // Depuis quand la table existe : avant, il n'y a rien a lire, et le
  // tableau doit le dire plutot que de laisser croire a un tunnel vide.
  const premier = (await db.prepare(
    `SELECT MIN(premier_at) AS t FROM tunnel WHERE etape = 'ouverture'`).first())?.t || null;

  // La cohorte : ouverte dans la fenetre, jamais vue par `visits` avant ce
  // jour-la. `visits.day` est un jour UTC en texte, comme ici.
  const cohorte = `
    SELECT o.device_id, o.premier_at AS o_at
      FROM tunnel o
     WHERE o.etape = 'ouverture' AND o.premier_at >= ?1
       AND NOT EXISTS (
         SELECT 1 FROM visits v
          WHERE v.device_id = o.device_id
            AND v.day < date(o.premier_at / 1000, 'unixepoch'))`;

  const { results } = await db.prepare(
    `WITH c AS (${cohorte})
     SELECT t.etape, t.premier_at - c.o_at AS d
       FROM tunnel t JOIN c ON c.device_id = t.device_id
      LIMIT 200000`).bind(depuis).all();

  const parEtape = new Map();
  for (const r of results || []) {
    if (!parEtape.has(r.etape)) parEtape.set(r.etape, []);
    parEtape.get(r.etape).push(Math.max(0, r.d || 0));
  }
  const base = parEtape.get('ouverture')?.length || 0;
  const ligne = e => {
    const ds = parEtape.get(e) || [];
    return { etape: e, n: ds.length, delai_median_ms: e === 'ouverture' ? 0 : mediane(ds) };
  };

  // Rejoue un autre jour : parmi la cohorte dont le jour d'ouverture est
  // CLOS (aujourd'hui ne peut pas encore avoir de lendemain), combien ont une
  // course terminee un jour posterieur.
  const aujourdhui = debutDuJour(now);
  const rejoue = await db.prepare(
    `WITH c AS (${cohorte})
     SELECT COUNT(*) AS base,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM races r
               WHERE r.device_id = c.device_id
                 AND r.created_at >= (c.o_at / 86400000 + 1) * 86400000
            ) THEN 1 ELSE 0 END) AS n
       FROM c WHERE c.o_at < ?2`).bind(depuis, aujourdhui).first()
    .catch(() => null);

  // LA FICHE D'APPAREIL, sur la meme cohorte. Un appareil sans fiche est un
  // ancien client (ou une ouverture dont la fiche n'est pas arrivee) : il est
  // compte a part, jamais range dans « autre ».
  const { results: fiches } = await db.prepare(
    `WITH c AS (${cohorte})
     SELECT a.navigateur, a.chargement_ms,
            EXISTS (SELECT 1 FROM tunnel t WHERE t.device_id = c.device_id AND t.etape = 'ecran')   AS ecran,
            EXISTS (SELECT 1 FROM tunnel t WHERE t.device_id = c.device_id AND t.etape = 'accueil') AS accueil,
            EXISTS (SELECT 1 FROM tunnel t WHERE t.device_id = c.device_id AND t.etape = 'depart')  AS depart,
            EXISTS (SELECT 1 FROM tunnel t WHERE t.device_id = c.device_id AND t.etape = 'arrivee') AS arrivee
       FROM c LEFT JOIN tunnel_appareil a ON a.device_id = c.device_id
      LIMIT 200000`).bind(depuis).all();

  const parNav = new Map();
  const chargements = [];
  let sansFiche = 0;
  for (const r of fiches || []) {
    if (chargementValide(r.chargement_ms)) chargements.push(r.chargement_ms);
    if (!navigateurValide(r.navigateur)) { sansFiche++; continue; }
    let l = parNav.get(r.navigateur);
    if (!l) parNav.set(r.navigateur, l = { navigateur: r.navigateur, n: 0, ecran: 0, accueil: 0, depart: 0, arrivee: 0 });
    l.n++;
    l.ecran += r.ecran ? 1 : 0;
    l.accueil += r.accueil ? 1 : 0;
    l.depart += r.depart ? 1 : 0;
    l.arrivee += r.arrivee ? 1 : 0;
  }

  return {
    jours, depuis, mesure_depuis: premier,
    cohorte: base,
    etapes: ETAPES_TUNNEL.map(ligne),
    a_cote: ETAPES_A_COTE.map(ligne),
    rejoue: { base: rejoue?.base || 0, n: rejoue?.n || 0 },
    // Ajouts : un tableau plus ancien ignore ces trois champs.
    par_navigateur: [...parNav.values()].sort((a, b) => b.n - a.n || a.navigateur.localeCompare(b.navigateur)),
    chargement: { n: chargements.length, mediane_ms: mediane(chargements), p90_ms: centile(chargements, 0.9) },
    sans_fiche: sansFiche,
  };
}

/**
 * Les treize nuits, sur tous les appareils : combien ont ouvert le mode, tente
 * et tenu chaque nuit. `part` est la part des tentants qui ont tenu — la ou
 * elle s'effondre, la nuit est trop dure.
 */
export async function lireHalloween(db) {
  await ensureTunnel(db);
  const { results } = await db.prepare(
    `SELECT etape, COUNT(*) AS n FROM tunnel WHERE etape LIKE 'hw_%' GROUP BY etape`).all();
  const n = new Map((results || []).map(r => [r.etape, r.n || 0]));
  return {
    entree: n.get('hw_entree') || 0,
    nuits: Array.from({ length: 13 }, (_, i) => {
      const tentee = n.get(`hw_nuit_${i + 1}`) || 0;
      const tenue = n.get(`hw_tenue_${i + 1}`) || 0;
      return { nuit: i + 1, tentee, tenue, part: tentee ? Math.round((tenue / tentee) * 1000) / 10 : null };
    }),
  };
}
