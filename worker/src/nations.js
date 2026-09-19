/* ---------------------------------------------------------------------------
   LE CLASSEMENT DES NATIONS — la guerre des drapeaux
   ---------------------------------------------------------------------------
   Un chiffre par pays, une fois par semaine, et un conflit que personne n'a
   besoin d'entretenir. C'est le format de rente du plan de lancement : il ne
   coute rien a produire, il se lit en une seconde, et il fabrique une dispute
   recurrente que la communaute reprend a son compte.

   CE QU'ON CLASSE, ET POURQUOI CE N'EST PAS LE MEILLEUR CHRONO. Un classement
   au record national se decide a une personne pres : un seul joueur rapide
   place son pays premier, et le tableau raconte alors l'histoire d'un individu
   sous un drapeau. La MEDIANE des cinquante meilleurs raconte autre chose — la
   profondeur d'un pays — et c'est ce qui en fait un sujet collectif : pour
   faire bouger une mediane, il faut etre plusieurs.

   C'est aussi ce qui la rend difficile a manipuler. Un tricheur deplace un
   minimum ; il ne deplace pas une mediane.

   LE SEUIL, ET CE QU'IL COUTE. Un pays qui n'a que deux joueurs classes a une
   « mediane » qui ne veut rien dire. On demande donc un effectif minimum pour
   paraitre au tableau — et on l'affiche, parce qu'un pays de sept joueurs et
   un pays de cinquante n'ont pas gagne la meme chose, meme a mediane egale.

   PAS UN SEUL NOM DE JOUEUR NE SORT D'ICI. La charte interdit de publier le
   pseudonyme de quelqu'un sans son accord, capture de classement comprise
   (§5.4), et c'est l'erreur n° 5 du plan. Le levier « nommez le joueur qui a
   le plus fait gagner son pays » reste donc un geste humain : `carte-nations`
   ne cite personne a moins qu'on lui donne le nom a la main, ce qui est
   exactement le moment ou l'on confirme avoir demande.
--------------------------------------------------------------------------- */

import { ensureChampTables, nomZone } from './championnats.js';

/** L'epreuve par defaut du tableau. Le 100 m est la vitrine du jeu. */
export const EPREUVE_NATIONS = '100';

/**
 * COMBIEN DE JOUEURS ON PREND PAR PAYS.
 *
 * Cinquante, comme le plan le demande. Ce n'est pas une limite d'affichage :
 * c'est la population sur laquelle la mediane se calcule, et l'elargir
 * changerait le classement — un pays profond y gagnerait, un pays a l'elite
 * mince y perdrait. Le nombre fait partie de la definition, pas du reglage.
 */
export const TOP_PAR_PAYS = 50;

/**
 * L'EFFECTIF MINIMUM POUR PARAITRE.
 *
 * Cinq, et c'est un compromis assume. Plus bas, la mediane d'un pays de deux
 * joueurs est un chrono individuel deguise en statistique nationale. Plus haut
 * — les trente-deux que demande un championnat, par exemple — le tableau
 * serait vide pendant des mois et le rendez-vous du lundi n'aurait rien a
 * montrer.
 *
 * La mediane fait deja le gros du travail : a cinq joueurs, c'est le
 * troisieme, et un seul chrono exceptionnel ne la deplace pas. Le seuil ne
 * defend pas contre le joueur rapide, il defend contre le pays qui n'existe
 * pas encore.
 */
export const MIN_JOUEURS = 5;

/** Combien de pays le tableau rend. Huit tiennent sur une carte ; on en rend
 *  plus, et c'est la carte qui coupe — un ecran, lui, peut derouler. */
const TOP_PAYS = 50;

/**
 * LE LUNDI DE LA SEMAINE D'UN INSTANT, en UTC, sous la forme `2026-09-14`.
 *
 * Une date et non un numero de semaine ISO : les semaines 52, 53 et 1 se
 * chevauchent selon l'annee, et une cle qui se repete ou qui saute fait
 * silencieusement disparaitre une comparaison. Un lundi est un lundi.
 *
 * Le rendez-vous du plan est le lundi ; la semaine commence donc la, et non le
 * dimanche comme `getUTCDay()` le voudrait.
 */
export function lundiDe(ms) {
  const d = new Date(ms);
  const jour = (d.getUTCDay() + 6) % 7;            // lundi = 0
  const lundi = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - jour);
  return new Date(lundi).toISOString().slice(0, 10);
}

const SEMAINE = 7 * 24 * 3600 * 1000;

const nationsPretes = new WeakSet();
async function ensureNationsTable(db) {
  if (nationsPretes.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS nations_semaine (
    -- Le lundi de la semaine figee, en UTC.
    semaine TEXT NOT NULL,
    epreuve TEXT NOT NULL,
    pays TEXT NOT NULL,
    median INTEGER NOT NULL,
    joueurs INTEGER NOT NULL,
    rang INTEGER NOT NULL,
    fige_le INTEGER NOT NULL,
    PRIMARY KEY (semaine, epreuve, pays)
  )`).run();
  nationsPretes.add(db);
}

/**
 * La mediane d'une liste DEJA TRIEE.
 *
 * On la calcule ici plutot qu'en SQL parce que SQLite n'a pas de mediane, et
 * que les contorsions qui l'imitent (deux LIMIT/OFFSET symetriques) se lisent
 * mal et se trompent d'une place sur les listes paires.
 */
function mediane(tries) {
  const n = tries.length;
  if (!n) return 0;
  const m = n >> 1;
  return n % 2 ? tries[m] : Math.round((tries[m - 1] + tries[m]) / 2);
}

/**
 * Le classement vivant, tel qu'il est a cet instant.
 *
 * UNE SEULE REQUETE, ET UNE FENETRE. `ROW_NUMBER() OVER (PARTITION BY pays)`
 * numerote les joueurs de chaque pays du plus rapide au plus lent ; on ne
 * garde que les cinquante premiers de chacun. La solution naive — une requete
 * par pays — ferait cinquante allers-retours pour une carte qu'on publie une
 * fois par semaine.
 *
 * LE JOUEUR, PAS L'APPAREIL. `GROUP BY lower(trim(name))` est la meme cle
 * d'identite que le classement mondial : quelqu'un qui joue sur un telephone
 * et une tablette compte pour une personne, sinon il pese deux fois dans la
 * mediane de son pays.
 */
async function mesurerLesPays(db, epreuve) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `WITH records AS (
       SELECT lower(trim(s.name)) AS cle, MIN(s.best_split_ms) AS chrono
         FROM scores s
        WHERE s.race_key = ? AND s.best_split_ms > 0
        GROUP BY lower(trim(s.name))
     ),
     ranges AS (
       SELECT g.pays AS pays, r.chrono AS chrono,
              ROW_NUMBER() OVER (PARTITION BY g.pays ORDER BY r.chrono ASC) AS n
         FROM records r JOIN player_pays g ON g.name_key = r.cle
        WHERE g.pays IS NOT NULL AND trim(g.pays) <> ''
     )
     SELECT pays, chrono FROM ranges WHERE n <= ? ORDER BY pays, n`
  ).bind(String(epreuve || EPREUVE_NATIONS), TOP_PAR_PAYS).all();

  const parPays = new Map();
  for (const r of results || []) {
    const p = String(r.pays).toUpperCase();
    if (!parPays.has(p)) parPays.set(p, []);
    parPays.get(p).push(r.chrono);
  }

  // TOUS les pays, seuil compris, parce que celui qui n'y est pas encore est
  // precisement celui a qui l'on veut dire combien il lui manque.
  const mesures = new Map();
  for (const [pays, chronos] of parPays) {
    mesures.set(pays, { pays, median: mediane(chronos), joueurs: chronos.length,
                        meilleur: chronos[0] });
  }
  return mesures;
}

/** Le classement vivant : les pays qui atteignent le seuil, dans l'ordre. */
export async function classementDesNations(db, epreuve = EPREUVE_NATIONS) {
  return ordonner(await mesurerLesPays(db, epreuve));
}

function ordonner(mesures) {
  const lignes = [...mesures.values()].filter(l => l.joueurs >= MIN_JOUEURS);
  // A mediane egale, le pays le plus profond passe devant : c'est la seule
  // facon de departager qui reste fidele a ce que le tableau mesure.
  lignes.sort((a, b) => a.median - b.median || b.joueurs - a.joueurs ||
                        a.pays.localeCompare(b.pays));
  return lignes.slice(0, TOP_PAYS).map((l, i) => ({ ...l, rang: i + 1 }));
}

/**
 * Le nom du pays, tel que le serveur le nomme — le jeu n'a pas sa table.
 *
 * `avec` est la forme a preposition (« de France », « du Canada », « des
 * Etats-Unis »). Elle sert d'abord aux titres de championnat, mais la carte du
 * lundi en tire aussi l'article — « la France est 6e » — parce que « France
 * est 6e » n'est pas une phrase francaise, et qu'une carte qu'on poste se lit.
 */
function nommer(l) {
  const n = nomZone(l.pays, 'national');
  return { ...l, nom: n.nom, nomEn: n.nomEn, avec: n.avec };
}

/**
 * Les rangs d'une semaine deja figee, par pays.
 *
 * Rend une Map vide si cette semaine-la n'a jamais ete figee : c'est le cas au
 * tout premier lundi, et c'est normal. Un tableau sans fleches vaut mieux
 * qu'un tableau avec des fleches inventees.
 */
async function rangsFiges(db, semaine, epreuve) {
  await ensureNationsTable(db);
  const { results } = await db.prepare(
    `SELECT pays, rang, median FROM nations_semaine WHERE semaine = ? AND epreuve = ?`
  ).bind(semaine, String(epreuve || EPREUVE_NATIONS)).all();
  const m = new Map();
  for (const r of results || []) m.set(String(r.pays).toUpperCase(), r);
  return m;
}

/**
 * Le tableau tel qu'on le publie : le classement vivant, plus le mouvement.
 *
 * LE MOUVEMENT EST LA NOUVELLE. Un classement qui ne bouge pas ne se poste
 * qu'une fois ; « la France passe 7e, +2 » se poste chaque semaine. On compare
 * donc au dernier lundi fige, jamais a celui d'aujourd'hui — sans quoi on
 * comparerait le tableau a lui-meme et toutes les fleches seraient a zero.
 */
export async function tableauDesNations(db, { epreuve = EPREUVE_NATIONS,
                                              quand = Date.now(), pays = null } = {}) {
  const ep = String(epreuve || EPREUVE_NATIONS);
  const mesures = await mesurerLesPays(db, ep);
  const classement = ordonner(mesures);
  const semaine = lundiDe(quand);
  const precedente = lundiDe(quand - SEMAINE);
  const avant = await rangsFiges(db, precedente, ep);

  const tete = classement.length ? classement[0].median : 0;

  /* MON PAYS, MEME SOUS LE SEUIL. Un joueur d'un pays de trois personnes ouvre
     l'ecran et n'y trouve pas son drapeau : sans cette ligne, il en conclut
     que le tableau ne le concerne pas. Avec elle, il lit qu'il manque deux
     joueurs — et c'est exactement le message qui fait envoyer un code. */
  const p = pays ? String(pays).toUpperCase() : '';
  const sien = p ? mesures.get(p) : null;
  const moi = !p ? null : nommer(sien
    ? { ...sien, rang: classement.find(l => l.pays === p)?.rang ?? null,
        manque: Math.max(0, MIN_JOUEURS - sien.joueurs) }
    : { pays: p, median: null, joueurs: 0, meilleur: null, rang: null, manque: MIN_JOUEURS });

  return {
    epreuve: ep, semaine, precedente, moi,
    top: TOP_PAR_PAYS, minJoueurs: MIN_JOUEURS,
    classement: classement.map(l => {
      const a = avant.get(l.pays);
      return {
        ...nommer(l),
        // L'ecart a la tete, en millisecondes. C'est la phrase du post :
        // « quatre dixiemes derriere la Jamaique » se dit, « 8,91 contre
        // 8,52 » se calcule.
        ecart: l.median - tete,
        rangPrecedent: a ? a.rang : null,
        // Positif = on est monte. Le signe qu'attend une fleche, pas celui
        // qu'attend une soustraction de rangs — on remonte en baissant.
        mouvement: a ? a.rang - l.rang : null,
        medianPrecedent: a ? a.median : null,
      };
    }),
  };
}

/**
 * Fige la semaine en cours, une fois, et repond si elle l'a ete.
 *
 * APPELE PAR LE CRON, QUI PASSE 288 FOIS PAR JOUR. `INSERT OR IGNORE` sur une
 * cle qui porte la semaine fait que seule la toute premiere execution du lundi
 * ecrit : les 2015 suivantes ne coutent qu'un conflit de cle. C'est ce qui
 * remplace une tache hebdomadaire qu'il faudrait poser, surveiller et
 * rattraper quand elle a saute.
 *
 * ON NE FIGE PAS UN TABLEAU VIDE. Au debut du jeu, aucun pays n'atteint le
 * seuil ; ecrire zero ligne marquerait quand meme la semaine comme figee si
 * l'on s'y prenait autrement, et la comparaison de la semaine suivante
 * porterait sur du vide sans que rien ne le dise.
 */
export async function figerLaSemaine(db, quand = Date.now(), epreuve = EPREUVE_NATIONS) {
  await ensureNationsTable(db);
  const ep = String(epreuve || EPREUVE_NATIONS);
  const semaine = lundiDe(quand);

  const deja = await db.prepare(
    `SELECT COUNT(*) AS n FROM nations_semaine WHERE semaine = ? AND epreuve = ?`
  ).bind(semaine, ep).first();
  if (deja && deja.n > 0) return { semaine, epreuve: ep, figees: 0, deja: deja.n };

  const classement = await classementDesNations(db, ep);
  if (!classement.length) return { semaine, epreuve: ep, figees: 0, deja: 0 };

  const maintenant = Date.now();
  await db.batch(classement.map(l => db.prepare(
    `INSERT OR IGNORE INTO nations_semaine
       (semaine, epreuve, pays, median, joueurs, rang, fige_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(semaine, ep, l.pays, l.median, l.joueurs, l.rang, maintenant)));

  return { semaine, epreuve: ep, figees: classement.length, deja: 0 };
}
