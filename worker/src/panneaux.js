/**
 * LES PANNEAUX VENDUS — ce que le stade affiche a la place du logo BENBEZI.
 *
 * La liste vit sur le serveur pour qu'un contrat n'attende jamais une mise a
 * jour Play ou App Store : on ajoute une ligne ici, l'image dans
 * public/pubs/sponsors/, et on pousse sur main.
 *
 *   id    : le nom du contrat, pour s'y retrouver
 *   image : URL absolue, 1000 x 250, fond transparent (voir panneaux.ts)
 *   debut, fin : la campagne, en millisecondes ; fin exclue
 *   test  : vrai = seulement sur le canal de test, pour voir avant d'ouvrir
 *
 * Ne poser un nom ou un logo qu'avec l'accord ecrit de la marque.
 */
export const PANNEAUX = [];

export function panneauxDuMoment(liste, maintenant, canalTest) {
  return liste
    .filter(p => maintenant >= p.debut && maintenant < p.fin && (!p.test || canalTest))
    .map(p => ({ id: p.id, image: p.image }));
}

/**
 * LE BILAN D'UNE CAMPAGNE. Une ligne par (panneau, jour UTC, appareil) : le
 * nombre de courses vues, et, en les comptant, le nombre d'appareils distincts.
 * Une « vue » = une course reellement partie avec ce panneau au bord de la piste.
 *
 * PLAFOND : un appareil ne pese jamais plus de PLAFOND_VUES_PAR_JOUR, pour qu'un
 * script en boucle ne gonfle pas un chiffre vendu a une marque. Il ne protege pas
 * d'un script qui change d'appareil : a dire si le chiffre est conteste.
 */
export const PLAFOND_VUES_PAR_JOUR = 200;

const pret = new WeakSet();
async function ensurePanneaux(db) {
  if (pret.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS panneaux_affichages (
    panneau TEXT NOT NULL, jour TEXT NOT NULL, device_id TEXT NOT NULL,
    vues INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (panneau, jour, device_id))`).run();
  pret.add(db);
}

export async function noterVue(db, panneau, deviceId, maintenant) {
  await ensurePanneaux(db);
  await db.prepare(`INSERT INTO panneaux_affichages (panneau, jour, device_id, vues) VALUES (?, ?, ?, 1)
    ON CONFLICT (panneau, jour, device_id) DO UPDATE SET vues = MIN(vues + 1, ?)`)
    .bind(panneau, new Date(maintenant).toISOString().slice(0, 10), deviceId, PLAFOND_VUES_PAR_JOUR).run();
}

export async function bilanPanneau(db, panneau) {
  await ensurePanneaux(db);
  const { results: jours } = await db.prepare(`SELECT jour, SUM(vues) AS vues, COUNT(*) AS appareils
    FROM panneaux_affichages WHERE panneau = ? GROUP BY jour ORDER BY jour`).bind(panneau).all();
  const { results: [t] } = await db.prepare(`SELECT COALESCE(SUM(vues), 0) AS vues, COUNT(DISTINCT device_id) AS appareils
    FROM panneaux_affichages WHERE panneau = ?`).bind(panneau).all();
  return { panneau, vues: t.vues, appareils: t.appareils, jours };
}
