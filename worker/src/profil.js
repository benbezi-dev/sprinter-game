// Le profil d'un joueur, garde sous son nom pour survivre a l'appareil.
//
// CE QUI SE PERDAIT. La progression vit dans le stockage du telephone : la
// carriere, la Legende, le vestiaire, les defis battus. Reinstaller l'appli ou
// changer de telephone l'effacait, et le jeu relancait la course d'initiation
// a un joueur qui courait depuis des semaines (21/10/2026). Le nom et les
// chronos du classement revenaient avec le code ; le reste, jamais.
//
// CE QUI EST GARDE. Un instantane par nom RESERVE : un objet { cle: valeur }
// des cles du jeu (`sprinter_*`, `halloween2026.*`), valeurs en texte, tel que le stockage local
// les tient. Le serveur ne les interprete pas — c'est le jeu qui sait les
// fusionner (src/game/profil.ts). Le serveur garantit deux choses seulement :
//
//   1. SEUL UN APPAREIL RELIE AU NOM lit ou ecrit le profil (`player_devices`,
//      la meme preuve que pour courir sous ce nom). Un nom libre n'a pas de
//      profil : n'importe qui pourrait l'ecrire.
//   2. DEUX TELEPHONES NE S'ECRASENT PAS. Chaque ecriture porte la revision sur
//      laquelle elle s'appuie ; si une autre est passee entre-temps, elle est
//      refusee avec la version courante, que le jeu fusionne avant de
//      renvoyer. Un telephone neuf qui vient d'etre relie ne peut donc pas
//      remplacer une carriere par une page blanche.

export const PROFIL_MAX_OCTETS = 256 * 1024;
// `sprinter_*`, `sprinter.*` et le carnet `halloween2026.v1` : les noms que le jeu emploie.
const CLE_VALIDE = /^(sprinter|halloween)[a-z0-9_.]{1,70}$/;

const pret = new WeakSet();
export async function ensureProfils(db) {
  if (pret.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS profils (
    name_key TEXT PRIMARY KEY,
    donnees TEXT NOT NULL,
    rev INTEGER NOT NULL,
    maj_at INTEGER NOT NULL,
    device_id TEXT NOT NULL
  )`).run();
  pret.add(db);
}

/** Un instantane acceptable : un objet plat de cles du jeu vers du texte. */
export function donneesValides(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  for (const [k, v] of Object.entries(d)) {
    if (!CLE_VALIDE.test(k) || typeof v !== 'string') return false;
  }
  return true;
}

/** Cet appareil est-il relie a ce nom reserve ? Un nom libre : non. */
export async function appareilRelie(db, nameKey, deviceId) {
  if (!nameKey) return false;
  const d = await db.prepare(
    `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
  ).bind(nameKey, deviceId).first();
  return !!d;
}

/** Le profil garde, ou une revision 0 sans donnees. */
export async function lireProfil(db, nameKey) {
  await ensureProfils(db);
  const p = await db.prepare(
    `SELECT donnees, rev, maj_at FROM profils WHERE name_key = ?`).bind(nameKey).first();
  if (!p) return { rev: 0, donnees: null, maj_at: null };
  let donnees = null;
  try { donnees = JSON.parse(p.donnees); } catch { /* illisible : comme absent */ }
  return { rev: p.rev, donnees, maj_at: p.maj_at };
}

/**
 * Ecrire par-dessus la revision `base`. Rend { ok, rev } ou, si une autre
 * ecriture est passee, { conflit, rev, donnees } : la version a fusionner.
 */
export async function ecrireProfil(db, { nameKey, deviceId, base, donnees, now = Date.now() }) {
  await ensureProfils(db);
  const texte = JSON.stringify(donnees);
  // Le premier depot ne passe que s'il n'y a encore rien ; les suivants, que
  // sur la revision attendue. La condition est dans la requete : deux
  // ecritures simultanees ne peuvent pas passer toutes les deux.
  const r = base === 0
    ? await db.prepare(
        `INSERT INTO profils (name_key, donnees, rev, maj_at, device_id) VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(name_key) DO NOTHING`
      ).bind(nameKey, texte, now, deviceId).run()
    : await db.prepare(
        `UPDATE profils SET donnees = ?, rev = rev + 1, maj_at = ?, device_id = ?
          WHERE name_key = ? AND rev = ?`
      ).bind(texte, now, deviceId, nameKey, base).run();
  if (r.meta && r.meta.changes > 0) return { ok: true, rev: base + 1 };
  const courant = await lireProfil(db, nameKey);
  return { conflit: true, rev: courant.rev, donnees: courant.donnees };
}
