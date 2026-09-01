/* ---------------------------------------------------------------------------
   CE QUE LE JEU RACONTE AUX RESEAUX
   ---------------------------------------------------------------------------
   Jusqu'ici, publier ce qui se passait dans le jeu demandait d'aller le
   chercher : piloter un navigateur jusqu'au TOP 500, capturer l'ecran, relire
   les chronos a l'oeil et ecrire la legende. C'est ce que font
   `suivi/publications/capture-classement.mjs` et son voisin. Cela marche, et
   cela ne tient pas la distance — il faut savoir qu'il s'est passe quelque
   chose pour aller le regarder, et on ne le sait qu'en regardant.

   Ce module renverse le sens : le jeu signale lui-meme ses moments, au moment
   ou ils arrivent, la ou l'information existe deja. Un record entre au top 3
   dans `/submit`, un championnat se clot dans `championnats.js` — ces endroits
   savent. Ils n'avaient simplement personne a qui le dire.

   TROIS REGLES QUI NE SONT PAS NEGOCIABLES, et qui vivent ici plutot que dans
   la tete de celui qui publiera.

   1. RIEN DU CANAL DE TEST NE SORT. La charte le dit (§5.2) et la raison est
      seche : les chronos joues sur /test/ n'entrent dans aucun classement, et
      un record annonce depuis la serait une fausse nouvelle publiee par nous.
      La garantie n'est pas un `if` a l'appel — c'est `noter()` qui refuse la
      base de test, et qui ne peut donc pas l'oublier.

   2. AUCUN PSEUDONYME NE PART SANS ACCORD (§5.4). Le nom est range ici, parce
      qu'il faut bien savoir de qui l'on parle, mais rien ne le publie tel
      quel : ce qui sort par defaut est une forme masquee, et la montrer en
      clair est un geste explicite de celui qui valide, jamais un defaut.

   3. RIEN NE PART TOUT SEUL. Ce module remplit une file, il ne publie pas.
      Le jeu accepte du texte libre — les pseudonymes, le mot du vainqueur — et
      un compte de marque qui republie du texte libre sans le lire publie une
      insulte tot ou tard. La publication est un second geste, humain, ailleurs.
--------------------------------------------------------------------------- */

/**
 * Les moments que le jeu sait reconnaitre, et ce qu'ils valent.
 *
 * Le poids n'est pas decoratif : la file se remplira plus vite qu'on ne
 * publie — trois publications par semaine, dit la charte — et il faut donc que
 * ce qui remonte en tete soit ce qui merite la place, pas ce qui est arrive en
 * dernier. Un sacre de championnat vaut plus qu'un duel serre, et c'est vrai
 * meme si le duel est arrive apres.
 *
 * Les valeurs sont espacees de dix pour laisser de la place entre elles : le
 * jour ou un moment nouveau se glisse entre deux existants, on n'a pas a
 * renumeroter la liste entiere.
 */
export const MOMENTS = {
  // Quelqu'un prend la tete d'une epreuve. Le plus fort de tous : il y a un
  // avant et un apres, et cela ne peut pas se produire deux fois pour rien.
  tete:    { poids: 90, pilier: 1, titre: 'La tete du classement change' },
  // Un sacre de championnat. Une date, un nom, un titre — le pilier 3 dans sa
  // forme la plus pure.
  sacre:   { poids: 80, pilier: 3, titre: 'Un titre est attribue' },
  // Une entree au top 3 qui ne prend pas la tete.
  podium:  { poids: 60, pilier: 1, titre: 'Une entree sur le podium' },
  // Le haut du classement tient dans un mouchoir. C'est le moment que la
  // publication du 30 aout racontait, et il ne s'etait vu qu'a l'oeil.
  mouchoir:{ poids: 55, pilier: 1, titre: 'Le haut du classement se resserre' },
  // Un duel tranche a presque rien. Deux chronos cote a cote et l'ecart :
  // c'est un format entier de la charte, et il n'a besoin de rien d'autre.
  duel:    { poids: 40, pilier: 1, titre: 'Un duel se joue aux centiemes' },
  // Un cap de frequentation. Le plus faible, et volontairement : il interesse
  // celui qui fait le jeu bien plus que celui qui le regarde.
  cap:     { poids: 20, pilier: 2, titre: 'Un cap est franchi' },
};

/**
 * Ce que le mouchoir tolere.
 *
 * Vingt centiemes entre le premier et le huitieme. Le seuil vient de la
 * publication du 30 aout — dix-neuf centiemes pour huit coureurs — qui avait
 * ete jugee digne d'etre racontee. On garde la mesure qui a produit un bon
 * resultat plutot que d'en inventer une ronde.
 */
const MOUCHOIR_MS = 200;
const MOUCHOIR_MIN = 6;

/** Un duel merite d'etre montre en dessous de cet ecart. */
const DUEL_SERRE_MS = 50;

/** Les caps de frequentation qui valent un signalement. */
const CAPS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

// Comme ailleurs dans ce worker, la memoire des tables est tenue par base.
// Un booleen mentirait a la seconde base, qui resterait sans tables parce que
// la premiere a deja eteint la migration. Ici l'enjeu est moindre — la base de
// test n'aura jamais ces tables, par construction — mais la forme reste la
// meme que dans acces.js et duels.js, et une forme qui se ressemble partout
// est une forme qu'on relit sans y penser.
const pret = new WeakSet();

export async function ensureReseauxTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS reseaux_file (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      -- L'identite du moment, pas celle de la ligne. Deux signalements du meme
      -- fait portent la meme cle et le second ne cree rien : sans elle, un
      -- joueur qui rejoue son record a la virgule pres remplirait la file de
      -- copies, et c'est exactement ce qui arrive un soir ou l'on teste.
      cle TEXT NOT NULL UNIQUE,
      -- Tout ce qu'il faut pour dessiner le visuel, en JSON. On range le fait,
      -- pas l'image : le gabarit changera, le fait non, et une file remplie
      -- d'images figees serait perimee au premier changement de charte.
      donnees TEXT NOT NULL,
      poids INTEGER NOT NULL,
      vu_le INTEGER NOT NULL,
      -- propose | ecarte | publie
      etat TEXT NOT NULL DEFAULT 'propose',
      publie_le INTEGER,
      -- Les reseaux ou c'est reellement parti, separes par des virgules. On
      -- garde la trace pour ne pas republier deux fois le meme fait au meme
      -- endroit, et pour savoir ce qui a marche ou.
      reseaux TEXT
    )`),
    // La file se lit toujours dans le meme ordre : ce qui attend, le plus fort
    // d'abord. L'index porte donc sur ce couple et pas sur l'un des deux.
    db.prepare(`CREATE INDEX IF NOT EXISTS reseaux_file_attente
                  ON reseaux_file(etat, poids DESC, vu_le DESC)`),
    // Les caps deja franchis. Une table plutot qu'un calcul : le nombre de
    // courses ne redescend pas, mais il se recalcule a chaque requete, et
    // relire « a-t-on deja passe les mille » dans la file elle-meme obligerait
    // a y chercher une chaine de caracteres.
    db.prepare(`CREATE TABLE IF NOT EXISTS reseaux_caps (
      quoi TEXT NOT NULL,
      seuil INTEGER NOT NULL,
      vu_le INTEGER NOT NULL,
      PRIMARY KEY (quoi, seuil)
    )`),
  ]);
  pret.add(db);
}

/**
 * Le nom, tel qu'il peut sortir sans accord.
 *
 * La charte interdit de publier un pseudonyme sans l'accord de son porteur
 * (§5.4), capture de classement comprise. Le nom entier reste range dans la
 * file — il faut bien pouvoir demander l'accord a quelqu'un, donc savoir qui —
 * mais ce qui accompagne le fait est cette forme-ci.
 *
 * On garde la premiere lettre et la longueur : « M••••• » se lit comme un nom
 * et ne designe personne, la ou « ••••• » ressemble a une donnee manquante et
 * la ou trois points ne diraient pas que le pseudonyme etait long. C'est le
 * minimum qui laisse l'image lisible.
 */
export function masquer(nom) {
  const n = String(nom || '').trim();
  if (!n) return '';
  if (n.length === 1) return n;
  return n[0] + '•'.repeat(Math.min(n.length - 1, 7));
}

/**
 * Range un moment dans la file.
 *
 * Le premier argument n'est pas la base mais l'ensemble des bases et le canal :
 * c'est ce qui rend la regle 1 structurelle. Une fonction qui recevrait `db`
 * publierait ce qu'on lui donne, et le jour ou un appel oublierait le test —
 * un seul, dans l'un des cinq endroits qui signalent — un chrono de test
 * partirait sur le compte du jeu. Ici l'oubli n'est pas possible : sans le
 * canal, la fonction ne sait pas quelle base prendre, et avec lui elle refuse
 * le test d'elle-meme.
 *
 * Rend `false` quand rien n'a ete range : canal de test, moment deja connu, ou
 * ecriture refusee. Aucun appelant n'a besoin de ce retour pour fonctionner —
 * signaler est accessoire au geste en cours, et une file pleine ne doit jamais
 * faire echouer une course — mais les tests s'en servent.
 */
export async function noter(canal, type, cle, donnees) {
  // REGLE 1, et c'est ici qu'elle tient. Le canal de test ouvre tout et ses
  // chronos n'entrent dans aucun classement : ce qui s'y passe n'existe pas
  // pour le dehors.
  if (!canal || canal.test) return false;
  const m = MOMENTS[type];
  if (!m) return false;
  const db = canal.db;
  if (!db) return false;

  try {
    await ensureReseauxTables(db);
    const r = await db.prepare(
      `INSERT INTO reseaux_file (type, cle, donnees, poids, vu_le)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cle) DO NOTHING`
    ).bind(type, cle, JSON.stringify(donnees || {}), m.poids, Date.now()).run();
    return !!(r.meta && r.meta.changes);
  } catch {
    // Signaler ne doit jamais casser ce qui l'a declenche. Un joueur qui vient
    // de battre son record recoit son classement, que la file ait accepte la
    // ligne ou non.
    return false;
  }
}

/* ---------------------------------------------------------------------------
   LES DETECTEURS
   ---------------------------------------------------------------------------
   Chacun repond a une seule question : ce qui vient d'arriver merite-t-il
   d'etre raconte ? Ils vivent ici et pas sur le trajet de la requete, pour que
   `/submit` reste ce qu'il est — l'enregistrement d'un chrono — et pour qu'on
   puisse relire la regle editoriale sans traverser cinq cents lignes de
   classement.
--------------------------------------------------------------------------- */

/**
 * Un chrono vient d'entrer au classement d'une epreuve. Y a-t-il un moment ?
 *
 * `entrees` est le classement tel que `/submit` vient de le relire, dans
 * l'ordre. On ne le recalcule pas : il est deja la, et le redemander couterait
 * une requete pour un resultat identique.
 */
export async function regarderClassement(canal, race, nom, chronoMs, entrees) {
  if (!canal || canal.test) return;
  const liste = Array.isArray(entrees) ? entrees : [];
  if (!liste.length) return;

  // Le rang de ce chrono. On le cherche par la valeur plutot que par le nom :
  // deux joueurs peuvent porter le meme, un seul porte ce chrono a cette
  // seconde.
  const rang = liste.findIndex(e => Number(e.best_split_ms ?? e.time_ms) === Number(chronoMs)) + 1;

  if (rang === 1) {
    // La tete change. La cle porte le chrono : reprendre la tete avec le meme
    // temps ne se raconte qu'une fois, la reprendre plus vite est un autre
    // moment.
    const second = liste[1];
    await noter(canal, 'tete', `tete:${race}:${chronoMs}`, {
      race, nom, chrono_ms: chronoMs,
      // L'ecart avec le suivant : c'est lui qui fait la phrase, et sans lui
      // l'image dit « premier » sans dire de combien.
      ecart_ms: second ? Number(second.best_split_ms ?? second.time_ms) - chronoMs : null,
      second: second ? second.name : null,
      classes: liste.length,
    });
  } else if (rang === 2 || rang === 3) {
    await noter(canal, 'podium', `podium:${race}:${chronoMs}`, {
      race, nom, chrono_ms: chronoMs, rang, classes: liste.length,
      tete_ms: Number(liste[0].best_split_ms ?? liste[0].time_ms),
      tete_nom: liste[0].name,
    });
  }

  // Le mouchoir. Il ne depend pas du chrono qui vient d'arriver mais de l'etat
  // du haut du classement — sauf que c'est cette arrivee-la qui peut l'avoir
  // resserre, et c'est donc le bon moment pour regarder.
  const haut = liste.slice(0, 8);
  if (haut.length >= MOUCHOIR_MIN) {
    const premier = Number(haut[0].best_split_ms ?? haut[0].time_ms);
    const dernier = Number(haut[haut.length - 1].best_split_ms ?? haut[haut.length - 1].time_ms);
    const ecart = dernier - premier;
    if (ecart > 0 && ecart <= MOUCHOIR_MS) {
      // La cle porte l'ecart et le nombre : le classement se resserre par
      // paliers, et chaque palier est un moment distinct. Elle ne porte pas de
      // date — un mouchoir de dix-neuf centiemes sur huit coureurs ne se
      // raconte qu'une fois, meme s'il tient trois semaines.
      await noter(canal, 'mouchoir', `mouchoir:${race}:${haut.length}:${ecart}`, {
        race, combien: haut.length, ecart_ms: ecart,
        premier_ms: premier, dernier_ms: dernier,
        // Les noms partent masques des l'ecriture pour ce moment-ci : une liste
        // de huit pseudonymes demanderait huit accords, et l'image se tient
        // tres bien sans eux — c'est l'ecart qu'elle raconte, pas les porteurs.
        noms: haut.map(e => masquer(e.name)),
        chronos_ms: haut.map(e => Number(e.best_split_ms ?? e.time_ms)),
      });
    }
  }
}

/** Un duel vient d'etre tranche. */
export async function regarderDuel(canal, a, b) {
  if (!canal || canal.test) return;
  const ta = Number(a && a.total_ms), tb = Number(b && b.total_ms);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return;
  const ecart = Math.abs(ta - tb);
  if (ecart > DUEL_SERRE_MS || ecart === 0) return;

  const gagnant = ta < tb ? a : b;
  const perdant = ta < tb ? b : a;
  // La cle range les deux noms dans l'ordre alphabetique : le meme duel signale
  // deux fois — une par joueur qui rend son chrono — ne doit produire qu'une
  // ligne.
  const paire = [String(a.nom || ''), String(b.nom || '')].sort().join('|');
  await noter(canal, 'duel', `duel:${paire}:${Math.min(ta, tb)}:${ecart}`, {
    ecart_ms: ecart,
    gagnant: gagnant.nom, gagnant_ms: Math.min(ta, tb),
    perdant: perdant.nom, perdant_ms: Math.max(ta, tb),
    epreuves: a.epreuves || b.epreuves || null,
  });
}

/** Un championnat vient de rendre son titre. */
export async function regarderSacre(canal, edition) {
  if (!canal || canal.test) return;
  if (!edition || !edition.champion) return;
  await noter(canal, 'sacre', `sacre:${edition.id}`, {
    echelon: edition.echelon || null,
    pays: edition.pays || null,
    epreuve: edition.epreuve || null,
    champion: edition.champion,
    chrono_ms: edition.chrono_ms ?? null,
    deuxieme: edition.deuxieme || null,
    deuxieme_ms: edition.deuxieme_ms ?? null,
    partants: edition.partants ?? null,
  });
}

/**
 * Un compteur vient de bouger. A-t-il franchi un cap ?
 *
 * `quoi` nomme la serie ('courses', 'joueurs', 'duels'), `valeur` est le total
 * courant. On ne signale que le franchissement, une seule fois, et la table
 * des caps est ce qui le garantit meme si la valeur oscille — ce qu'elle fait,
 * puisqu'un compte de joueurs distincts peut baisser quand un nom change.
 */
export async function regarderCap(canal, quoi, valeur) {
  if (!canal || canal.test) return;
  const n = Number(valeur);
  if (!Number.isFinite(n)) return;
  const seuil = [...CAPS].reverse().find(c => n >= c);
  if (!seuil) return;
  const db = canal.db;
  if (!db) return;
  try {
    await ensureReseauxTables(db);
    const r = await db.prepare(
      `INSERT INTO reseaux_caps (quoi, seuil, vu_le) VALUES (?, ?, ?)
       ON CONFLICT(quoi, seuil) DO NOTHING`
    ).bind(quoi, seuil, Date.now()).run();
    // Sans changement, le cap etait deja franchi : on ne le raconte pas deux
    // fois. C'est la table qui le sait, pas la file.
    if (!(r.meta && r.meta.changes)) return;
    await noter(canal, 'cap', `cap:${quoi}:${seuil}`, { quoi, seuil, valeur: n });
  } catch { /* signaler n'est jamais bloquant */ }
}

/* ---------------------------------------------------------------------------
   LA FILE, VUE DE CELUI QUI PUBLIE
--------------------------------------------------------------------------- */

/**
 * Ce qui attend, le plus fort d'abord.
 *
 * Les noms partent masques. C'est le point ou la regle 2 s'applique vraiment :
 * la file garde le nom entier, cette lecture-ci ne le rend pas, et il faut
 * demander `avecNoms` — un geste explicite — pour l'obtenir. Un ecran de
 * validation branche naivement sur cette route affiche donc des noms masques,
 * ce qui est le bon defaut.
 */
export async function fileDAttente(db, { etat = 'propose', limite = 50, avecNoms = false } = {}) {
  await ensureReseauxTables(db);
  const { results } = await db.prepare(
    `SELECT id, type, cle, donnees, poids, vu_le, etat, publie_le, reseaux
       FROM reseaux_file WHERE etat = ?
       ORDER BY poids DESC, vu_le DESC LIMIT ?`
  ).bind(etat, Math.min(Number(limite) || 50, 200)).all();

  return (results || []).map(l => {
    let d = {};
    try { d = JSON.parse(l.donnees); } catch { /* ligne illisible : on rend le reste */ }
    if (!avecNoms) d = sansNoms(d);
    const m = MOMENTS[l.type] || {};
    return {
      id: l.id, type: l.type, titre: m.titre || l.type, pilier: m.pilier || null,
      poids: l.poids, vu_le: l.vu_le, etat: l.etat,
      publie_le: l.publie_le, reseaux: l.reseaux ? l.reseaux.split(',') : [],
      donnees: d,
    };
  });
}

/**
 * Les champs qui portent un pseudonyme, masques.
 *
 * La liste est ecrite en dur plutot que devinee : masquer « tout ce qui
 * ressemble a un nom » laisserait passer le champ qu'on ajoutera demain sans
 * y penser, et un masquage qui echoue en silence est pire que pas de masquage
 * — on le croit fait.
 */
function sansNoms(d) {
  const c = { ...d };
  for (const champ of ['nom', 'second', 'tete_nom', 'gagnant', 'perdant',
                       'champion', 'deuxieme']) {
    if (c[champ]) c[champ] = masquer(c[champ]);
  }
  if (Array.isArray(c.noms)) c.noms = c.noms.map(masquer);
  return c;
}

/** Ecarte un moment : il ne sera plus propose, et il ne revient pas. */
export async function ecarter(db, id) {
  await ensureReseauxTables(db);
  const r = await db.prepare(
    `UPDATE reseaux_file SET etat = 'ecarte' WHERE id = ? AND etat = 'propose'`
  ).bind(Number(id)).run();
  return !!(r.meta && r.meta.changes);
}

/**
 * Marque un moment comme publie, et ou.
 *
 * Appele apres coup, par celui qui a publie. Le worker n'envoie rien lui-meme —
 * voir l'en-tete, regle 3 — mais il tient le registre : sans lui, on ne saurait
 * pas ce qui est deja sorti, et le meme record ressortirait le mois suivant
 * depuis une file qu'on relit.
 */
export async function marquerPublie(db, id, reseaux) {
  await ensureReseauxTables(db);
  const ou = Array.isArray(reseaux) ? reseaux.filter(Boolean).join(',') : String(reseaux || '');
  const r = await db.prepare(
    `UPDATE reseaux_file SET etat = 'publie', publie_le = ?, reseaux = ?
      WHERE id = ? AND etat = 'propose'`
  ).bind(Date.now(), ou, Number(id)).run();
  return !!(r.meta && r.meta.changes);
}
