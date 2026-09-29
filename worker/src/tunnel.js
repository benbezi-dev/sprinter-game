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

const CONNUES = new Set([...ETAPES_TUNNEL, ...ETAPES_A_COTE]);
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
  pret.add(db);
}

/** La premiere fois compte, les suivantes sont ignorees. */
export async function noterEtape(db, deviceId, etape, now = Date.now()) {
  await ensureTunnel(db);
  await db.prepare(
    `INSERT OR IGNORE INTO tunnel (device_id, etape, premier_at) VALUES (?, ?, ?)`
  ).bind(deviceId, etape, now).run();
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

  return {
    jours, depuis, mesure_depuis: premier,
    cohorte: base,
    etapes: ETAPES_TUNNEL.map(ligne),
    a_cote: ETAPES_A_COTE.map(ligne),
    rejoue: { base: rejoue?.base || 0, n: rejoue?.n || 0 },
  };
}
