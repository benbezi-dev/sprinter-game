/* ---------------------------------------------------------------------------
   INVITER QUELQU'UN A UNE COURSE EN DIRECT
   ---------------------------------------------------------------------------
   Le mode direct se rejoignait par un code : on ouvre une salle, on copie six
   lettres, on les envoie par un autre canal, et l'autre les retape. Cela marche
   avec des gens qu'on a deja au telephone — c'est meme pour eux que le mode a
   ete fait. Cela ne marche pas avec quelqu'un croise au classement des duels,
   dont on ne connait rien d'autre que le pseudonyme.

   Ce module ajoute le chemin qui manquait : depuis le classement, designer un
   adversaire et lui faire parvenir l'invitation, sans jamais connaitre son
   numero ni son adresse.

   CE QUI DICTE LA FORME : une invitation en direct est PERISSABLE. Elle propose
   d'aller courir maintenant, dans une salle ouverte a l'instant, contre
   quelqu'un qui attend devant son ecran. Une invitation lue vingt minutes plus
   tard ne vaut rien — la salle est fermee, l'hote est parti — et pire, elle
   ment : elle propose une course qui n'existe plus.

   D'ou :
   - une duree de vie de DIX MINUTES, pas une heure et pas un jour ;
   - le menage a chaque ecriture, parce qu'aucune tache planifiee ne tourne sur
     ce Worker et qu'une table qui grossit sans surveillance se decouvre trop
     tard ;
   - rien qui ressemble a une boite de reception qu'on releve : ce qui a expire
     disparait, il ne s'accumule pas.

   CE QUE L'ON NE PUBLIE PAS. L'invitation porte le nom de celui qui invite et
   le code de la salle. Elle ne porte NI l'identifiant d'appareil de l'hote, ni
   quoi que ce soit qui permette de le retrouver ailleurs : etre au classement
   ne doit pas rendre joignable. C'est le serveur qui fait la jonction entre un
   pseudonyme et un appareil, et cette jonction ne sort jamais d'ici.
--------------------------------------------------------------------------- */

/**
 * Dix minutes. Le temps qu'une salle reste plausible.
 *
 * Assez pour aller chercher son telephone, trop peu pour qu'une invitation
 * ressorte le lendemain d'une poche.
 */
const VIE_MS = 10 * 60 * 1000;

/** Personne ne peut inviter plus de sept adversaires : la piste a huit couloirs. */
const MAX_CIBLES = 7;

const pret = new WeakSet();

export async function ensureInvitationsTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS invitations_directes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      -- Le nom de l'hote, tel qu'il s'affichera. On garde le nom et pas la
      -- cle : c'est ce qu'on montre, et le retrouver a chaque lecture
      -- couterait une jointure pour rien.
      de_nom TEXT NOT NULL,
      -- L'appareil vise. C'est la seule colonne qui designe quelqu'un, et elle
      -- ne sort jamais de ce module.
      vers_device TEXT NOT NULL,
      vers_nom TEXT NOT NULL,
      code TEXT NOT NULL,
      epreuve TEXT,
      cree_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL,
      -- Renseignee quand l'invite a vu passer l'invitation. Sert a ne pas la
      -- lui remontrer a chaque sondage une fois qu'il a tranche.
      vue_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS invitations_pour
                  ON invitations_directes(vers_device, expire_le)`),
  ]);
  pret.add(db);
}

/** Le menage. Appele a chaque ecriture, jamais tout seul. */
async function balayer(db) {
  try {
    await db.prepare(`DELETE FROM invitations_directes WHERE expire_le < ?`)
      .bind(Date.now()).run();
  } catch { /* le menage ne doit pas empecher l'invitation */ }
}

/** La cle sous laquelle un nom est range. Meme regle que partout ailleurs. */
const cle = n => String(n || '').trim().toLowerCase();

/**
 * Invite des joueurs, designes par leur nom au classement.
 *
 * Rend la liste des appareils a faire sonner — ce module ne sonne pas
 * lui-meme : la sonnerie est le travail de `boite.js`, et melanger les deux
 * obligerait a passer `env` entier ici pour un service qui ne nous regarde pas.
 *
 * Un joueur peut avoir plusieurs appareils : on invite sur TOUS, parce qu'on
 * ignore lequel il a en main. Une invitation par appareil, donc, et c'est
 * voulu — celui qui repond le premier entre dans la salle.
 *
 * Un nom qu'on ne retrouve pas n'est pas une erreur : beaucoup de joueurs
 * figurent au classement sans avoir reserve leur nom, et ceux-la ne sont
 * joignables par personne. On le dit a l'appelant plutot que d'echouer.
 */
export async function inviterEnDirect(db, { deNom, versNoms, code, epreuve }) {
  await ensureInvitationsTables(db);
  await balayer(db);

  const noms = [...new Set((Array.isArray(versNoms) ? versNoms : [])
    .map(n => String(n || '').trim()).filter(Boolean))].slice(0, MAX_CIBLES);
  if (!noms.length) return { invites: [], injoignables: [], appareils: [] };

  const maintenant = Date.now();
  const expire = maintenant + VIE_MS;
  const invites = [], injoignables = [], appareils = [];

  for (const nom of noms) {
    let lignes = [];
    try {
      const r = await db.prepare(
        `SELECT device_id FROM player_devices WHERE name_key = ?`
      ).bind(cle(nom)).all();
      lignes = r.results || [];
    } catch { lignes = []; }

    // Personne derriere ce nom : il court sans avoir reserve son pseudonyme,
    // et rien ne permet de le joindre. Ce n'est pas une panne.
    if (!lignes.length) { injoignables.push(nom); continue; }

    for (const l of lignes) {
      try {
        await db.prepare(
          `INSERT INTO invitations_directes
             (de_nom, vers_device, vers_nom, code, epreuve, cree_le, expire_le)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(String(deNom || '').trim() || 'Un joueur', l.device_id, nom,
               String(code || '').trim().toUpperCase(), epreuve || null,
               maintenant, expire).run();
        appareils.push(l.device_id);
      } catch { /* un appareil manque, les autres passent */ }
    }
    invites.push(nom);
  }

  return { invites, injoignables, appareils };
}

/**
 * Les invitations qui attendent cet appareil.
 *
 * Ne rend que ce qui est encore vivant ET pas encore tranche. Une invitation
 * qu'on a vue ne revient pas : le jeu sonde toutes les secondes, et une
 * proposition qui reapparait sans fin est une proposition qu'on finit par
 * fermer sans lire.
 */
export async function mesInvitationsDirectes(db, deviceId) {
  await ensureInvitationsTables(db);
  const { results } = await db.prepare(
    `SELECT id, de_nom, code, epreuve, cree_le, expire_le
       FROM invitations_directes
      WHERE vers_device = ? AND expire_le > ? AND vue_le IS NULL
      ORDER BY cree_le DESC LIMIT 5`
  ).bind(String(deviceId || ''), Date.now()).all();

  return (results || []).map(l => ({
    id: l.id, de: l.de_nom, code: l.code, epreuve: l.epreuve,
    // Ce qu'il reste a vivre, plutot que l'heure d'expiration : l'ecran veut
    // afficher un decompte, pas convertir une date.
    reste_ms: Math.max(0, Number(l.expire_le) - Date.now()),
  }));
}

/** L'invite a tranche : l'invitation ne lui sera plus proposee. */
export async function trancherInvitation(db, id, deviceId) {
  await ensureInvitationsTables(db);
  const r = await db.prepare(
    `UPDATE invitations_directes SET vue_le = ?
      WHERE id = ? AND vers_device = ? AND vue_le IS NULL`
  ).bind(Date.now(), Number(id), String(deviceId || '')).run();
  return !!(r.meta && r.meta.changes);
}
