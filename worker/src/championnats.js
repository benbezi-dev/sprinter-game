/* ---------------------------------------------------------------------------
   CHAMPIONNATS — persistance et cycle de vie
   ---------------------------------------------------------------------------
   Le moteur (championnats-moteur.js) sait qui passe ; ce fichier sait qui
   participe, quand, et ce qu'il advient du titre. Il ne contient aucune regle
   de qualification : elles vivent toutes a un seul endroit, et il vaut mieux
   que ce ne soit pas celui qui parle a la base.

   Une precision qui manquait a la specification et sans laquelle rien de tout
   ceci ne tient : le jeu ne savait pas de quel pays est un joueur. Cloudflare
   le donne sur chaque requete, gratuitement et sans rien demander a personne.
   On le note au passage, et le joueur peut le corriger — quelqu'un en voyage
   ou derriere un VPN ne doit pas changer de nationalite sportive.
--------------------------------------------------------------------------- */

import {
  FORMAT, ECHELONS, TITRE_MOIS, REPLI_PAYS_TROP_PETIT, CALENDRIER, MIN_DOFFICE,
  ANNONCES, EPREUVES, EPREUVE_DEFAUT, CLOTURE_JOURS_AVANT, SUIVANTS_GARDES,
  TENANT, lieuDeLEdition,
} from './championnats-config.js';
import { serpentin, qualifier, podium, calendrier, ordonner } from './championnats-moteur.js';
// Les championnats lisent le classement des duels : sur une base neuve, cette
// table doit exister avant qu'on la joigne, sans quoi la requete echoue.
//
// `ordreClassement` vient de la meme place pour une raison de fond : la
// selection doit trier exactement comme le classement affiche, sinon la barre
// des trente-deux qu'on dessine a l'ecran ne designe pas les trente-deux
// qu'on selectionne. Une seule definition, deux lecteurs.
import { ensureDuelTables, ordreClassement } from './duels.js';
// Le mot d'une course suit les memes regles de proprete que celui d'un duel :
// meme longueur, memes types de voix, meme nettoyage des caracteres invisibles.
// Les recopier ici serait la garantie qu'un jour les deux ne refusent plus la
// meme chose.
import { motPropre, voixPropre } from './mot.js';

const JOUR = 24 * 3600 * 1000;

/** Le continent d'un pays. Table courte : on n'y met que ce qu'on utilise. */
const CONTINENTS = {
  EU: ['FR','BE','CH','DE','ES','IT','PT','GB','IE','NL','LU','AT','PL','SE','NO','DK','FI','GR','RO','HU','CZ','SK','BG','HR','RS','UA','RU','TR','AL','BA','MK','SI','LT','LV','EE','IS','MT','CY','MD','ME','MC','AD','SM','LI'],
  AF: ['MA','DZ','TN','LY','EG','SN','CI','ML','BF','NE','TD','CM','GA','CG','CD','AO','ZA','NG','GH','GN','BJ','TG','MR','KE','ET','TZ','UG','RW','BI','ZM','ZW','MZ','MG','MU','SO','SD','CF','GM','GW','SL','LR','CV','DJ','ER','BW','NA','LS','SZ','MW','ST','KM','SC','GQ'],
  AM: ['US','CA','MX','BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GT','CU','HT','DO','HN','NI','CR','PA','SV','JM','TT','GY','SR','BZ','BS','BB'],
  AS: ['CN','JP','KR','IN','ID','PK','BD','VN','TH','PH','MY','SG','MM','KH','LA','NP','LK','KZ','UZ','AZ','GE','AM','IL','SA','AE','QA','KW','BH','OM','JO','LB','SY','IQ','IR','YE','AF','MN','TW','HK','MO','BN','TJ','KG','TM','MV','BT'],
  OC: ['AU','NZ','FJ','PG','NC','PF','SB','VU','WS','TO','KI','FM','MH','PW','NR','TV'],
};
/**
 * Le nom des pays, avec la preposition qui va devant.
 *
 * « Champion de FR » ne veut rien dire, et « Champion de le Maroc » non plus :
 * le francais demande de France, du Maroc, des Etats-Unis, d'Espagne. Le titre
 * est tout l'objet de cette competition — il ne peut pas lire comme un champ de
 * base de donnees. On stocke donc la forme complete, article compris, plutot
 * que d'essayer de la deviner a partir du nom.
 */
const PAYS_NOMS = {
  FR: ['France', 'de France', 'France'],
  BE: ['Belgique', 'de Belgique', 'Belgium'],
  CH: ['Suisse', 'de Suisse', 'Switzerland'],
  CA: ['Canada', 'du Canada', 'Canada'],
  DE: ['Allemagne', "d'Allemagne", 'Germany'],
  ES: ['Espagne', "d'Espagne", 'Spain'],
  IT: ['Italie', "d'Italie", 'Italy'],
  PT: ['Portugal', 'du Portugal', 'Portugal'],
  GB: ['Royaume-Uni', 'du Royaume-Uni', 'United Kingdom'],
  IE: ['Irlande', "d'Irlande", 'Ireland'],
  NL: ['Pays-Bas', 'des Pays-Bas', 'Netherlands'],
  LU: ['Luxembourg', 'du Luxembourg', 'Luxembourg'],
  US: ['États-Unis', 'des États-Unis', 'United States'],
  MX: ['Mexique', 'du Mexique', 'Mexico'],
  BR: ['Brésil', 'du Brésil', 'Brazil'],
  // La forme avec preposition portait une apostrophe de trop — "d'Argentine'"
  // — et le titre sortait « Champion d'Argentine' », guillemet compris.
  AR: ['Argentine', "d'Argentine", 'Argentina'],
  MA: ['Maroc', 'du Maroc', 'Morocco'],
  DZ: ['Algérie', "d'Algérie", 'Algeria'],
  TN: ['Tunisie', 'de Tunisie', 'Tunisia'],
  SN: ['Sénégal', 'du Sénégal', 'Senegal'],
  CI: ["Côte d'Ivoire", "de Côte d'Ivoire", 'Ivory Coast'],
  CM: ['Cameroun', 'du Cameroun', 'Cameroon'],
  ML: ['Mali', 'du Mali', 'Mali'],
  CD: ['Congo', 'du Congo', 'Congo'],
  GA: ['Gabon', 'du Gabon', 'Gabon'],
  GN: ['Guinée', 'de Guinée', 'Guinea'],
  BF: ['Burkina Faso', 'du Burkina Faso', 'Burkina Faso'],
  NE: ['Niger', 'du Niger', 'Niger'],
  TG: ['Togo', 'du Togo', 'Togo'],
  BJ: ['Bénin', 'du Bénin', 'Benin'],
  ZA: ['Afrique du Sud', "d'Afrique du Sud", 'South Africa'],
  NG: ['Nigeria', 'du Nigeria', 'Nigeria'],
  EG: ['Égypte', "d'Égypte", 'Egypt'],
  KE: ['Kenya', 'du Kenya', 'Kenya'],
  JP: ['Japon', 'du Japon', 'Japan'],
  CN: ['Chine', 'de Chine', 'China'],
  KR: ['Corée du Sud', 'de Corée du Sud', 'South Korea'],
  IN: ['Inde', "d'Inde", 'India'],
  AU: ['Australie', "d'Australie", 'Australia'],
  NZ: ['Nouvelle-Zélande', 'de Nouvelle-Zélande', 'New Zealand'],
  PL: ['Pologne', 'de Pologne', 'Poland'],
  SE: ['Suède', 'de Suède', 'Sweden'],
  NO: ['Norvège', 'de Norvège', 'Norway'],
  DK: ['Danemark', 'du Danemark', 'Denmark'],
  FI: ['Finlande', 'de Finlande', 'Finland'],
  GR: ['Grèce', 'de Grèce', 'Greece'],
  TR: ['Turquie', 'de Turquie', 'Turkey'],
  RU: ['Russie', 'de Russie', 'Russia'],
  UA: ['Ukraine', "d'Ukraine", 'Ukraine'],
  RO: ['Roumanie', 'de Roumanie', 'Romania'],

  /* LES NATIONS D'ATHLETISME QUI MANQUAIENT.
     ------------------------------------------------------------------------
     Ajoutees le 19 septembre 2026, et c'est le classement des nations qui l'a
     revele : un pays dont Cloudflare donne le code sans que cette table le
     nomme sort au tableau sous son code — « JM · 9,84 ». Passe inapercu tant
     que le nom ne servait qu'a composer un titre de championnat, ou aucun
     joueur jamaiquain ne s'etait encore inscrit ; impardonnable sur une carte
     qu'on poste, ou la Jamaique est precisement le pays qu'on cite.

     Elles etaient deja dans CONTINENTS — le continent se calculait, le nom
     non. Les nommer les rend aussi choisissables dans le jeu (`listeNations`)
     et leur ouvre un championnat des qu'elles ont l'effectif : c'est la
     consequence voulue, pas un effet de bord. */
  JM: ['Jamaïque', 'de Jamaïque', 'Jamaica'],
  TT: ['Trinité-et-Tobago', 'de Trinité-et-Tobago', 'Trinidad and Tobago'],
  CU: ['Cuba', 'de Cuba', 'Cuba'],
  ET: ['Éthiopie', "d'Éthiopie", 'Ethiopia'],
  GH: ['Ghana', 'du Ghana', 'Ghana'],
  UG: ["Ouganda", "de l'Ouganda", 'Uganda'],
  TZ: ['Tanzanie', 'de Tanzanie', 'Tanzania'],
  ZM: ['Zambie', 'de Zambie', 'Zambia'],
  ZW: ['Zimbabwe', 'du Zimbabwe', 'Zimbabwe'],
  CO: ['Colombie', 'de Colombie', 'Colombia'],
  CL: ['Chili', 'du Chili', 'Chile'],
  HU: ['Hongrie', 'de Hongrie', 'Hungary'],
  CZ: ['Tchéquie', 'de Tchéquie', 'Czechia'],
  IL: ['Israël', "d'Israël", 'Israel'],
  QA: ['Qatar', 'du Qatar', 'Qatar'],
  SA: ['Arabie saoudite', "d'Arabie saoudite", 'Saudi Arabia'],
  AE: ['Émirats arabes unis', 'des Émirats arabes unis', 'United Arab Emirates'],
  ID: ['Indonésie', "d'Indonésie", 'Indonesia'],
  PH: ['Philippines', 'des Philippines', 'Philippines'],
  TH: ['Thaïlande', 'de Thaïlande', 'Thailand'],
  VN: ['Viêt Nam', 'du Viêt Nam', 'Vietnam'],
};

const CONTINENT_NOMS = {
  EU: ['Europe', "d'Europe", 'Europe'],
  AF: ['Afrique', "d'Afrique", 'Africa'],
  AM: ['Amériques', 'des Amériques', 'the Americas'],
  AS: ['Asie', "d'Asie", 'Asia'],
  OC: ['Océanie', "d'Océanie", 'Oceania'],
};

/**
 * Les pays qu'on peut se choisir, nommes.
 *
 * Le jeu ne tient pas sa propre table : c'est le serveur qui sait nommer un
 * titre — « Champion du Maroc », pas « Champion de MA » — et deux tables du
 * meme fait auraient diverge a la premiere retouche. Elle sort donc d'ici, ou
 * elle vit deja, plutot que d'etre recopiee dans le jeu.
 *
 * Triee par nom, et non par code : c'est ainsi qu'on cherche le sien dans une
 * liste de cinquante.
 */
export function listeNations() {
  return Object.entries(PAYS_NOMS)
    .map(([code, [nom]]) => ({ code, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Le nom lisible d'une zone : sa forme simple, sa forme avec preposition, et
 * son nom anglais.
 *
 * `nomEn` a ete ajoute le 9 septembre 2026. Il manquait, et son absence se
 * voyait a l'endroit le plus visible du jeu : le titre d'une edition est
 * compose ICI, article francais compris, et l'ecran l'affichait tel quel — si
 * bien qu'un joueur anglophone lisait « Championnat de France » en haut de son
 * panneau et sur son podium, au milieu d'une interface par ailleurs traduite.
 *
 * L'anglais n'a pas besoin de la forme avec preposition : il pose le nom du
 * pays devant (« France National Championship »), la ou le francais demande
 * de France, du Maroc, des Etats-Unis. C'est pourquoi il n'y a que trois
 * colonnes et non quatre — et pourquoi la composition du titre anglais est du
 * cote du client, avec le reste de sa langue.
 */
export function nomZone(zone, echelon) {
  const z = String(zone || '').toUpperCase();
  const table = echelon === 'continental' ? CONTINENT_NOMS : PAYS_NOMS;
  const e = table[z];
  return e ? { nom: e[0], avec: e[1], nomEn: e[2] || e[0] }
           : { nom: z, avec: 'de ' + z, nomEn: z };
}

const PAYS_CONTINENT = {};
for (const [c, pays] of Object.entries(CONTINENTS)) for (const p of pays) PAYS_CONTINENT[p] = c;

export function continentDe(pays) {
  return PAYS_CONTINENT[String(pays || '').toUpperCase()] || null;
}

// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const pret = new WeakSet();
export async function ensureChampTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    // Le pays d'un joueur. `source` dit d'ou il vient : 'geo' quand c'est
    // Cloudflare qui l'a vu, 'choix' quand le joueur l'a corrige — et un choix
    // ne se fait jamais ecraser par une detection.
    db.prepare(`CREATE TABLE IF NOT EXISTS player_pays (
      name_key TEXT PRIMARY KEY,
      pays TEXT NOT NULL,
      continent TEXT,
      source TEXT NOT NULL,
      vu_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS player_pays_par_pays ON player_pays(pays)`),

    // Les demandes de changement de nationalite, faites depuis le jeu et
    // tranchees par l'administration. Une par joueur : une nouvelle demande
    // remplace la precedente, on ne fait pas la queue contre soi-meme.
    db.prepare(`CREATE TABLE IF NOT EXISTS demandes_pays (
      name_key TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      pays_avant TEXT,
      pays_demande TEXT NOT NULL,
      message TEXT,
      statut TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      traite_le INTEGER
    )`),

    // Une edition : un championnat, un echelon, une zone, une epreuve, un
    // weekend.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_editions (
      id TEXT PRIMARY KEY,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      epreuve TEXT NOT NULL DEFAULT '${EPREUVE_DEFAUT}',
      debut INTEGER NOT NULL,
      cloture INTEGER,
      phase TEXT NOT NULL,
      etat TEXT NOT NULL,
      champion_key TEXT,
      champion_nom TEXT,
      cree_le INTEGER NOT NULL,
      fini_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_editions_zone
                  ON champ_editions(echelon, zone, debut)`),

    // Un partant, sa place dans la grille, et ou il en est.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_partants (
      edition TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      rang_duel INTEGER,
      phase TEXT NOT NULL,
      course INTEGER,
      sorti_en TEXT,
      -- Le tenant du titre de CETTE edition, et il n'y en a qu'un.
      --
      -- Le statut est ecrit ici, une seule fois, a la cloture — et non relu
      -- dans champ_titres a chaque phase. C'est delibere : un titre porte
      -- une date d'expiration, et le lire en cours de weekend ferait qu'un
      -- titre expirant samedi soir changerait les regles entre la quatrieme
      -- serie et les demi-finales. La grille est gelee a la cloture ; le
      -- tenant l'est avec elle.
      tenant INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (edition, name_key)
    )`),

    // L'instantane de la cloture : le classement tel qu'il etait a la seconde
    // ou la selection a ferme, un peu au-dela de la barre.
    //
    // Cette table ne sert jamais a courir. Elle sert a repondre. Une selection
    // qu'on ne peut pas relire sera contestee, et « tu etais 34e » n'a de poids
    // que si l'on peut dire derriere qui, avec quels points, a quelle heure.
    //
    // On y range le palier et les points de ligue — les valeurs du critere —
    // et jamais le MMR. Le publier ici reviendrait a le publier tout court,
    // puisque cette table est faite pour etre montree a qui reclame.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_selection (
      edition TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      rang INTEGER NOT NULL,
      palier INTEGER,
      lp INTEGER,
      retenu INTEGER NOT NULL,
      PRIMARY KEY (edition, name_key)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_selection_ordre
                  ON champ_selection(edition, rang)`),

    // Un chrono couru dans une course d'une edition.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_resultats (
      edition TEXT NOT NULL,
      phase TEXT NOT NULL,
      course INTEGER NOT NULL,
      name_key TEXT NOT NULL,
      ms INTEGER,
      place INTEGER,
      voie TEXT,
      couru_le INTEGER NOT NULL,
      PRIMARY KEY (edition, phase, course, name_key)
    )`),

    /* -----------------------------------------------------------------
       LE MOT DU VAINQUEUR D'UNE COURSE
       -----------------------------------------------------------------
       Le meme geste que dans un duel (voir mot.js), avec une difference qui
       change la regle : un duel oppose deux personnes, une course en oppose
       huit. Le mot ne va donc pas « a celui qui vient de perdre » mais aux
       SEPT autres partants de cette course-la, et il tient tant que
       l'edition existe — on ne peut pas l'effacer a la premiere lecture
       comme on efface la voix d'un duel, parce qu'il en reste six qui ne
       l'ont pas encore ouvert.

       LA CLE PRIMAIRE PORTE LA REGLE. (edition, phase, course) sans le nom :
       il n'y a qu'un mot par course, celui du vainqueur, et une seule fois.
       Ce n'est pas une messagerie — personne ne repond, et le suivant ne
       peut pas ecraser le precedent.

       Ce qu'il faut savoir et ne pas se cacher, comme pour le duel : ce sont
       des mots ecrits par des gens et montres a d'autres gens, sans filtre
       automatique. Ici le cercle est plus large que deux — sept lecteurs, et
       le texte part aussi dans la video que le vainqueur partage. Le jour ou
       une edition reunira des inconnus, il faudra un signalement et de quoi
       le traiter. */
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_mots (
      edition TEXT NOT NULL,
      phase TEXT NOT NULL,
      course INTEGER NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      texte TEXT,
      voix TEXT,
      voix_type TEXT,
      au INTEGER NOT NULL,
      PRIMARY KEY (edition, phase, course)
    )`),

    // Les titres, avec leur date d'expiration : un champion le reste trois
    // mois, puis redevient un joueur comme les autres.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_titres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      libelle TEXT NOT NULL,
      edition TEXT NOT NULL,
      sacre_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL,
      -- L'instant ou ce titre a cesse d'etre porte, avant son echeance.
      --
      -- Deux facons d'y arriver, et une seule consequence. Le tenant perd sa
      -- finale : il perd son statut a la seconde ou elle s'acheve. Ou bien un
      -- autre est sacre pendant qu'il tenait encore le titre : le titre a
      -- change de mains, et l'ancien s'eteint. Dans les deux cas, la ligne
      -- reste — « champion de France du 5 au 26 septembre » est un fait, et
      -- cette table est l'archive du systeme autant que son etat courant.
      --
      -- L'invariant que cette colonne tient : UN SEUL titre vivant par couple
      -- (echelon, zone) a tout instant. Deux « Champion de France » simultanes
      -- seraient un titre qui ne veut plus rien dire.
      revoque_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_titres_porteur
                  ON champ_titres(name_key, expire_le)`),

    // Les medailles. Distinctes des titres : un titre ne va qu'au vainqueur,
    // une medaille va aux trois premiers. On garde les deux plutot que d'en
    // deriver l'une de l'autre, parce qu'elles ne durent pas pareil et ne
    // veulent pas dire la meme chose — « champion » est un statut, « medaille
    // de bronze au mondial » est un resultat.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_medailles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      name_key TEXT NOT NULL,
      nom TEXT NOT NULL,
      place INTEGER NOT NULL,
      edition TEXT NOT NULL,
      obtenu_le INTEGER NOT NULL,
      expire_le INTEGER NOT NULL,
      -- LE PAYS AU MOMENT DU PODIUM, et non celui du joueur aujourd'hui.
      --
      -- Le tableau des nations pourrait se calculer en joignant player_pays,
      -- et c'est ce qu'il a fait d'abord. Mais un pays detecte par Cloudflare
      -- se laisse corriger plus tard par le joueur (choisirPays) : la
      -- jointure aurait alors deplace une medaille deja gagnee d'un pays a
      -- l'autre, et le tableau aurait change tout seul entre deux ouvertures
      -- de l'ecran. Un palmares qui se reecrit n'est pas un palmares.
      --
      -- Null pour les medailles posees avant cette colonne : l'agregation
      -- retombe alors sur la jointure, faute de mieux. On ne peut pas savoir
      -- apres coup sous quel drapeau elles ont ete gagnees.
      pays TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_medailles_porteur
                  ON champ_medailles(name_key, expire_le)`),

    // Le fil des annonces. C'est la seule memoire de ce qui s'est passe en
    // direct, et elle sert trois choses d'un coup : la diffusion dans
    // l'application, les notifications, et le recapitulatif mondial. Les ecrire
    // une fois plutot que de les recalculer trois fois garantit que les trois
    // racontent la meme competition.
    db.prepare(`CREATE TABLE IF NOT EXISTS champ_annonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition TEXT,
      echelon TEXT NOT NULL,
      zone TEXT NOT NULL,
      type TEXT NOT NULL,
      titre TEXT NOT NULL,
      texte TEXT,
      donnees TEXT,
      au INTEGER NOT NULL,
      pousser INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_annonces_fil ON champ_annonces(id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS champ_annonces_zone ON champ_annonces(zone, id)`),
  ]);

  // L'epreuve est arrivee apres la table. Hors du `batch` volontairement : un
  // ALTER sur une colonne deja presente echoue, et il emporterait avec lui
  // toute la creation des autres tables — le batch est atomique. Seul, il ne
  // coute qu'un try/catch, et c'est le meme motif que `ensureScoreGhost`.
  try {
    await db.prepare(
      `ALTER TABLE champ_editions ADD COLUMN epreuve TEXT NOT NULL DEFAULT '${EPREUVE_DEFAUT}'`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  // La cloture est arrivee apres la table elle aussi, et pour la meme raison
  // elle s'ajoute seule. Elle est nullable a dessein : les editions ouvertes
  // avant qu'elle existe n'ont jamais eu d'heure de cloture annoncee, et leur
  // en inventer une apres coup serait affirmer une chose qui n'a pas eu lieu.
  // `null` dit « celle-la n'a pas ete annoncee », ce qui est exact.
  try {
    await db.prepare(
      `ALTER TABLE champ_editions ADD COLUMN cloture INTEGER`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  // L'index sur la cloture vient APRES l'ALTER, et non dans le batch.
  //
  // L'y avoir mis a casse toute la creation au premier essai, et de la facon la
  // plus instructive : sur une base neuve le batch cree la table avec sa
  // colonne et l'index passe, mais sur une base existante la colonne n'arrive
  // qu'a l'ALTER, dix lignes plus bas — l'index echouait donc, et comme le
  // batch est atomique il emportait la creation de TOUTES les autres tables
  // avec lui. Un `CREATE INDEX` qui nomme une colonne ajoutee apres coup
  // appartient a l'apres-coup, pas au batch.
  //
  // Sans cet index, le cron relit toute la table toutes les cinq minutes.
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS champ_editions_echeance
                        ON champ_editions(etat, cloture)`).run();
  } catch (e) { /* la colonne manque encore : l'index attendra le prochain tour */ }

  // Le champion en titre est arrive apres les deux tables qu'il touche, et
  // s'ajoute donc de la meme facon : seul, hors du batch, un ALTER par colonne.
  //
  // Les deux sont nullables ou a defaut zero, ce qui donne aux editions et aux
  // titres d'avant exactement le comportement qu'ils avaient : aucun partant
  // n'est tenant, aucun titre n'est revoque. Une migration de donnees serait
  // ici une invention — on ne peut pas savoir apres coup qui aurait ete tenant
  // d'une edition courue avant que la regle existe.
  try {
    await db.prepare(
      `ALTER TABLE champ_partants ADD COLUMN tenant INTEGER NOT NULL DEFAULT 0`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  try {
    await db.prepare(
      `ALTER TABLE champ_titres ADD COLUMN revoque_le INTEGER`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  // Le pays grave sur la medaille. Meme motif que les precedents, et l'index
  // vient APRES pour la meme raison que celui de la cloture : sur une base
  // existante la colonne n'arrive qu'ici, et un index pose dans le batch
  // aurait emporte la creation de toutes les autres tables avec lui.
  try {
    await db.prepare(
      `ALTER TABLE champ_medailles ADD COLUMN pays TEXT`
    ).run();
  } catch (e) { /* la colonne est deja la */ }

  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS champ_medailles_pays
                        ON champ_medailles(pays)`).run();
  } catch (e) { /* la colonne manque encore : l'index attendra le prochain tour */ }

  // POURQUOI UN CHRONO MANQUE. Tant que les courses se remplissaient au
  // harnais, `ms = null` voulait dire « abandon » et rien d'autre. Courues en
  // direct, elles connaissent trois absences qui ne se valent pas : le faux
  // depart (carton rouge), l'abandon (il a couru, pas fini), le forfait (il
  // n'est pas venu). `motif_ms` porte l'instant du faux depart, compte depuis
  // le coup de pistolet — c'est ce que le rejeu public montre.
  //
  // Nullables, comme les precedentes : une ligne d'avant ne sait pas pourquoi
  // elle n'a pas de chrono, et lui inventer un motif serait affirmer une chose
  // qui n'a pas ete observee.
  try {
    await db.prepare(`ALTER TABLE champ_resultats ADD COLUMN motif TEXT`).run();
  } catch (e) { /* la colonne est deja la */ }
  try {
    await db.prepare(`ALTER TABLE champ_resultats ADD COLUMN motif_ms INTEGER`).run();
  } catch (e) { /* la colonne est deja la */ }

  pret.add(db);
}

/**
 * Ecrit une annonce dans le fil.
 *
 * `pousser` distingue ce qui merite de faire vibrer un telephone de ce qui
 * merite seulement d'apparaitre a l'ecran. La liste est en configuration
 * (`ANNONCES`) parce que c'est un reglage d'audience, pas une regle du sport :
 * trop de notifications et l'application se fait couper le son une fois pour
 * toutes, ce dont on ne revient pas.
 */
export async function annoncer(db, { edition, echelon, zone, type, titre, texte, donnees }) {
  await ensureChampTables(db);
  const r = await db.prepare(
    `INSERT INTO champ_annonces (edition, echelon, zone, type, titre, texte, donnees, au, pousser)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    edition || null, echelon, String(zone || '').toUpperCase(), type,
    titre, texte || null, donnees ? JSON.stringify(donnees) : null,
    Date.now(), ANNONCES.has(type) ? 1 : 0
  ).run();
  return r;
}

/**
 * Donne a un joueur la nationalite du pays d'ou il se connecte, UNE FOIS.
 *
 * C'est sa nationalite tant qu'il n'en choisit pas une autre : elle compte
 * pour les championnats comme un choix. Elle ne suit donc plus la connexion —
 * quelqu'un en deplacement, ou derriere un VPN, ne doit pas changer de
 * nationalite sportive parce qu'il a joue une course depuis un aeroport. Pour
 * en changer : son propre choix (une fois), ou une demande a l'administration.
 *
 * `XX` est le « pays inconnu » de Cloudflare : ce n'est pas une nationalite.
 */
export async function noterPays(db, nameKey, pays) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k || !/^[A-Z]{2}$/.test(p) || p === 'XX') return;
  await ensureChampTables(db);
  await db.prepare(
    `INSERT INTO player_pays (name_key, pays, continent, source, vu_le)
     VALUES (?, ?, ?, 'geo', ?)
     ON CONFLICT(name_key) DO NOTHING`
  ).bind(k, p, continentDe(p), Date.now()).run();
}

/** Le joueur corrige son pays lui-meme. Ce choix prime sur la detection. */
export async function choisirPays(db, nameKey, pays) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k || !/^[A-Z]{2}$/.test(p)) return { erreur: 'pays invalide' };
  await ensureChampTables(db);
  await db.prepare(
    `INSERT INTO player_pays (name_key, pays, continent, source, vu_le)
     VALUES (?, ?, ?, 'choix', ?)
     ON CONFLICT(name_key) DO UPDATE SET
       pays = excluded.pays, continent = excluded.continent,
       source = 'choix', vu_le = excluded.vu_le`
  ).bind(k, p, continentDe(p), Date.now()).run();
  return { ok: true, pays: p, continent: continentDe(p) };
}

/**
 * L'administration pose ou corrige une nationalite. Le seul geste qui passe le
 * verrou.
 *
 * Il existe parce que le verrou est total cote joueur : un doigt qui glisse sur
 * une liste de cinquante pays coute la saison entiere, et sans cette porte la
 * seule reparation serait d'ouvrir la base a la main. Mieux vaut un geste
 * nomme, sous cle, qui dit ce qu'il remplace.
 *
 * Il pose aussi la nationalite de qui n'en a jamais declare (un joueur qui la
 * donne de vive voix, une detection 'geo' a confirmer). Ce qu'il exige, c'est
 * un NOM RESERVE : la faute la plus probable ici n'est pas le mauvais pays,
 * c'est le mauvais joueur, et ecrire une nationalite sur un nom que personne ne
 * porte la ferait tomber sur le premier qui le reserverait.
 *
 * Il rend l'ANCIEN etat autant que le nouveau (`avant`, `avant_source`) : une
 * correction sans trace de ce qu'elle a efface ne se verifie pas.
 */
export async function imposerPays(db, nameKey, pays) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k) return { erreur: 'nom invalide' };
  if (!/^[A-Z]{2}$/.test(p)) return { erreur: 'pays invalide' };
  await ensureChampTables(db);
  const inscrit = await db.prepare(
    `SELECT 1 AS ok FROM players WHERE name_key = ?`).bind(k).first();
  if (!inscrit) return { erreur: 'joueur inconnu', code: 404 };
  const avant = await db.prepare(
    `SELECT pays, source FROM player_pays WHERE name_key = ?`).bind(k).first();
  const avantPays = avant ? avant.pays : null;
  const avantSource = avant ? avant.source : null;
  if (avantSource === 'choix' && avantPays === p) {
    return { ok: true, avant: avantPays, avant_source: avantSource, pays: p, inchange: true };
  }
  await db.prepare(
    `INSERT INTO player_pays (name_key, pays, continent, source, vu_le)
     VALUES (?, ?, ?, 'choix', ?)
     ON CONFLICT(name_key) DO UPDATE SET
       pays = excluded.pays, continent = excluded.continent,
       source = 'choix', vu_le = excluded.vu_le`
  ).bind(k, p, continentDe(p), Date.now()).run();
  return {
    ok: true, avant: avantPays, avant_source: avantSource,
    pays: p, continent: continentDe(p), cree: avantSource !== 'choix',
  };
}

/**
 * Le joueur demande a changer de nationalite. Rien ne change encore : la
 * demande attend l'administration, qui l'accepte (`imposerPays`) ou la refuse.
 *
 * UN SEUL changement par joueur : une demande acceptee ferme la porte. Une
 * demande refusee, elle, n'a rien change — le joueur peut en refaire une.
 * L'administration garde sa correction directe, qui ne passe pas par ici.
 */
export async function demanderPays(db, nameKey, nom, pays, message) {
  const k = String(nameKey || '').trim().toLowerCase();
  const p = String(pays || '').trim().toUpperCase();
  if (!k) return { erreur: 'nom invalide' };
  if (!/^[A-Z]{2}$/.test(p)) return { erreur: 'pays invalide' };
  await ensureChampTables(db);
  const deja = await db.prepare(
    `SELECT statut FROM demandes_pays WHERE name_key = ?`).bind(k).first();
  if (deja && deja.statut === 'acceptee') {
    return { erreur: 'changement deja utilise', code: 409 };
  }
  const avant = await db.prepare(
    `SELECT pays FROM player_pays WHERE name_key = ?`).bind(k).first();
  if (avant && avant.pays === p) return { erreur: 'c est deja ta nationalite' };
  const mot = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 280) || null;
  await db.prepare(
    `INSERT INTO demandes_pays (name_key, nom, pays_avant, pays_demande, message, statut, cree_le, traite_le)
     VALUES (?, ?, ?, ?, ?, 'attente', ?, NULL)
     ON CONFLICT(name_key) DO UPDATE SET
       nom = excluded.nom, pays_avant = excluded.pays_avant,
       pays_demande = excluded.pays_demande, message = excluded.message,
       statut = 'attente', cree_le = excluded.cree_le, traite_le = NULL`
  ).bind(k, String(nom || k), avant ? avant.pays : null, p, mot, Date.now()).run();
  return { ok: true, pays: p, statut: 'attente' };
}

/** La demande d'un joueur, pour que le jeu lui dise ou elle en est. */
export async function demandeDe(db, nameKey) {
  await ensureChampTables(db);
  const d = await db.prepare(
    `SELECT pays_demande AS pays, statut, cree_le, traite_le FROM demandes_pays WHERE name_key = ?`
  ).bind(String(nameKey || '').trim().toLowerCase()).first();
  return d || null;
}

/** Les demandes en attente, les plus anciennes d'abord. */
export async function demandesEnAttente(db) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `SELECT d.name_key, d.nom, d.pays_avant, d.pays_demande, d.message, d.cree_le,
            g.pays AS pays_actuel, g.source AS source_actuelle
       FROM demandes_pays d LEFT JOIN player_pays g ON g.name_key = d.name_key
      WHERE d.statut = 'attente'
      ORDER BY d.cree_le`
  ).all();
  return results || [];
}

/** L'administration tranche. Accepter pose le pays demande, comme une correction. */
export async function traiterDemande(db, nameKey, accepter) {
  const k = String(nameKey || '').trim().toLowerCase();
  await ensureChampTables(db);
  const d = await db.prepare(
    `SELECT pays_demande FROM demandes_pays WHERE name_key = ? AND statut = 'attente'`
  ).bind(k).first();
  if (!d) return { erreur: 'aucune demande en attente', code: 404 };
  let r = { ok: true };
  if (accepter) {
    r = await imposerPays(db, k, d.pays_demande);
    if (r.erreur) return r;
  }
  await db.prepare(
    `UPDATE demandes_pays SET statut = ?, traite_le = ? WHERE name_key = ?`
  ).bind(accepter ? 'acceptee' : 'refusee', Date.now(), k).run();
  return { ...r, statut: accepter ? 'acceptee' : 'refusee', pays_demande: d.pays_demande };
}

/**
 * Combien de joueurs classes et actifs un pays compte-t-il SUR CETTE EPREUVE ?
 *
 * La distance n'est pas un detail de comptage : depuis que les niveaux ne sont
 * plus partages, un pays peut avoir quarante joueurs classes au 100 m et six
 * au 400 m. Compter tous ses joueurs, toutes distances confondues, lui
 * ouvrirait un championnat du 400 m que six personnes disputeraient — et la
 * grille de trente-deux ne se remplirait qu'a la cloture, trop tard.
 */
export async function effectifPays(db, pays, fenetreJours, epreuve = EPREUVE_DEFAUT) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const depuis = Date.now() - fenetreJours * 24 * 3600 * 1000;
  const r = await db.prepare(
    `SELECT COUNT(*) AS n
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE g.pays = ? AND d.epreuve = ?
        AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?`
  ).bind(String(pays).toUpperCase(), String(epreuve || EPREUVE_DEFAUT), depuis).first();
  return (r && r.n) || 0;
}

/** Les pays capables de tenir leur championnat ce cycle-ci, sur l'epreuve ou
 *  il se courra. Un pays de sprinters tient son 100 m et pas son 400 m : c'est
 *  la meme regle qu'avant, appliquee au seul classement qui la concerne. */
export async function paysEligibles(db, epreuve = EPREUVE_DEFAUT) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const cfg = ECHELONS.national;
  const depuis = Date.now() - cfg.fenetreActiviteJours * 24 * 3600 * 1000;
  const { results } = await db.prepare(
    `SELECT g.pays AS pays, COUNT(*) AS n
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE d.epreuve = ? AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      GROUP BY g.pays
      ORDER BY n DESC`
  ).bind(String(epreuve || EPREUVE_DEFAUT), depuis).all();
  return (results || []).map(r => ({
    pays: r.pays, joueurs: r.n,
    eligible: r.n >= cfg.minJoueurs,
    repli: r.n >= cfg.minJoueurs ? null : REPLI_PAYS_TROP_PETIT,
  }));
}

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function code(n = 8) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

/**
 * Le classement d'une zone, pour remplir une grille.
 *
 * QUALIFIER ET SEMER SONT DEUX QUESTIONS, et cette fonction sert les deux sans
 * les confondre. Elle ordonne au classement visible — palier, puis points de
 * ligue — et rend le MMR a cote, sous le nom de `force`. L'appelant qualifie
 * avec l'ordre, et seme avec la force.
 *
 * Pourquoi qualifier au visible. Une selection decidee par le MMR est juste et
 * invisible a la fois : le joueur ne peut ni verifier qu'il etait 33e, ni
 * savoir quoi faire pour ne plus l'etre. Or une competition n'est pas seulement
 * juste parce qu'elle prend les meilleurs ; elle l'est parce que tout le monde
 * connaissait la regle et pouvait se voir dedans. Le classement visible est le
 * seul ordre que le joueur suit deja.
 *
 * Le prix est connu : les points de ligue avantagent qui joue plus. Il est
 * moins lourd qu'il n'y parait, parce que `modulation()` pondere deja chaque
 * gain de points par l'ecart entre le MMR du joueur et ce qu'on attend de sa
 * division — l'echelle visible n'est pas du temps de jeu, c'est du temps de jeu
 * pese au niveau reel.
 *
 * Pourquoi semer au MMR quand meme. Placer les tetes de serie aux points
 * reviendrait a mettre en couloir 4 celui qui a joue le plus, pas celui qui
 * court le plus vite, et le serpentin existe precisement pour equilibrer les
 * series. On qualifie a ce que le joueur voit, on seme a ce qu'on mesure.
 *
 * `maintenant` decide de la fenetre d'activite. Il se passe explicitement
 * plutot que de se lire sur l'horloge : la cloture doit pouvoir dire « un duel
 * classe dans les soixante jours avant mercredi 23h59 » et non « avant
 * l'instant ou le cron est passe ».
 *
 * `epreuve` est celle de l'edition, et le classement lu est le sien. Une
 * edition du 400 m se remplissait autrefois avec les meilleurs d'un classement
 * unique, c'est-a-dire, en pratique, avec les meilleurs du 100 m : on
 * qualifiait pour un tour de piste des gens dont personne — eux compris — ne
 * savait ce qu'ils y valaient.
 */
async function classement(db, {
  pays = null, continent = null, exclure, limite, maintenant = Date.now(),
  epreuve = EPREUVE_DEFAUT,
}) {
  await ensureDuelTables(db);
  const depuis = maintenant - ECHELONS.national.fenetreActiviteJours * JOUR;
  const ou = pays ? 'g.pays = ?' : continent ? 'g.continent = ?' : '1 = 1';
  const args = pays ? [pays] : continent ? [continent] : [];
  const { results } = await db.prepare(
    `SELECT d.name_key AS cle, d.name AS nom, d.mmr AS force,
            d.palier AS palier, d.lp AS lp
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE ${ou} AND d.epreuve = ?
        AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY ${ordreClassement('d.')}
      LIMIT ?`
  ).bind(...args, String(epreuve || EPREUVE_DEFAUT), depuis,
         limite + (exclure ? exclure.size : 0)).all();
  const pris = [];
  for (const r of results || []) {
    if (exclure && exclure.has(r.cle)) continue;
    pris.push(r);
    if (pris.length >= limite) break;
  }
  return pris;
}

/**
 * Les champions en titre d'un echelon, encore porteurs a cette seconde.
 *
 * La table des duels est creee au besoin : un championnat peut s'ouvrir sur une
 * base ou personne n'a encore joue de duel, et lire une table absente y faisait
 * echouer toute l'ouverture avec une erreur cinq cents.
 *
 * `revoque_le IS NULL` est la seule chose que cette requete a apprise avec le
 * champion en titre : un champion qui a perdu sa finale n'est plus champion, et
 * il ne doit donc plus ouvrir la porte du continental a sa place. Sans cette
 * clause, un titre perdu sur la piste continuait a qualifier son ancien
 * porteur pendant les trois mois de son echeance d'origine.
 */
async function championsEnTitre(db, echelon, filtreZone, epreuve = EPREUVE_DEFAUT) {
  await ensureDuelTables(db);
  // Le titre qualifie d'office ; c'est la FORCE qui seme, et elle se lit sur
  // la distance du jour. Un champion national du 100 m qualifie pour le
  // continental du 100 m y arrive avec ce qu'il vaut sur 100 m — et non avec
  // un chiffre moyenne sur trois distances, qui le placerait tete de serie
  // grace a des courses qu'il n'a pas faites ici.
  const { results } = await db.prepare(
    `SELECT t.name_key AS cle, t.nom, t.zone, t.sacre_le,
            COALESCE(d.mmr, 0) AS force, d.palier AS palier, d.lp AS lp
       FROM champ_titres t
       LEFT JOIN duel_players d ON d.name_key = t.name_key AND d.epreuve = ?
      WHERE t.echelon = ? AND t.expire_le > ? AND t.revoque_le IS NULL
      ORDER BY t.sacre_le DESC`
  ).bind(String(epreuve || EPREUVE_DEFAUT), echelon, Date.now()).all();

  const vus = new Set();
  const sortie = [];
  for (const r of results || []) {
    if (vus.has(r.cle)) continue;                 // un seul titre par personne
    if (filtreZone && !filtreZone(r.zone)) continue;
    vus.add(r.cle);
    sortie.push(r);
  }
  return sortie;
}

/**
 * Qui prend le depart, selon l'echelon.
 *
 * Renvoie { joueurs, suivants, doffice } ou une erreur. `doffice` est
 * l'ensemble des cles qualifiees par leur titre plutot que par leur classement
 * — l'information interesse l'affichage, pas la competition.
 *
 * `suivants` sont ceux d'apres la barre. Ils ne courront pas, et on les lit
 * quand meme : c'est le seul moyen de repondre a qui reclame sa place. Sans
 * eux, la selection est une affirmation qu'on ne peut pas relire.
 */
async function pool(db, echelon, zone, maintenant = Date.now(), epreuve = EPREUVE_DEFAUT) {
  // On lit un peu plus loin que la barre : les trente-deux qui courent, et les
  // suivants qu'on garde pour l'archive de la cloture.
  const large = FORMAT.partants + SUIVANTS_GARDES;
  const ep = String(epreuve || EPREUVE_DEFAUT);

  // LE TENANT DU TITRE DE CETTE EDITION, s'il y en a un.
  //
  // Il se cherche a tous les echelons et de la meme facon : le titre exactement
  // en jeu, (echelon, zone). Au national c'est le champion du pays ; au
  // continental celui du continent, et le champion national qui vient d'y
  // arriver n'est pas ce joueur-la — il entre par sa qualification d'office et
  // n'a rien a defendre ici.
  //
  // `prive` porte l'exception d'activite : un champion qui n'a plus joue depuis
  // son sacre n'est le tenant de rien. Il repasse par le classement comme tout
  // le monde, ce qui est le seul moyen d'empecher un titre de devenir une
  // rente que l'on touche sans rejouer.
  const tenant = await tenantDuTitre(db, echelon, zone, maintenant);
  const boss = tenant && !tenant.prive ? tenant : null;
  // Sa place lui est gardee sur la grille de depart, sauf si le levier est
  // baisse. Sans elle, la finale d'office se ferait annuler par le calendrier :
  // un champion absent de la grille n'a pas de finale a rejoindre.
  const bossDOffice = TENANT.entreeDOffice ? boss : null;

  if (echelon === 'national') {
    const cfg = ECHELONS.national;
    const n = await effectifPays(db, zone, cfg.fenetreActiviteJours, ep);
    if (n < cfg.minJoueurs) {
      return { erreur: 'pays trop petit', joueurs: n, requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT };
    }
    // Le tenant est exclu du classement pour ne pas y compter deux fois : il
    // occupe une place, il ne doit pas en occuper deux. Trente-et-une places
    // restent au classement, la trente-deuxieme est la sienne.
    const exclure = new Set(bossDOffice ? [bossDOffice.cle] : []);
    // La limite descend d'autant que le tenant occupe : sans cela l'archive de
    // la barre garderait NEUF suivants au lieu de huit — une place de plus lue
    // que declaree, dans la table meme qui existe pour repondre a qui reclame.
    const l = await classement(db, {
      pays: zone, exclure, limite: large - exclure.size, maintenant, epreuve: ep,
    });
    const place = Math.max(0, FORMAT.partants - (bossDOffice ? 1 : 0));
    const joueurs = [...(bossDOffice ? [bossDOffice] : []), ...l.slice(0, place)];
    return {
      joueurs,
      suivants: l.slice(place),
      doffice: new Set(bossDOffice ? [bossDOffice.cle] : []),
      // Le boss est rendu meme quand il n'a PAS eu besoin de sa place d'office
      // — un champion bien classe entre par le classement, et reste le tenant.
      // On le retrouve donc dans la grille plutot que de le supposer absent.
      tenant: boss && joueurs.some(j => j.cle === boss.cle) ? boss : null,
      tenantEcarte: tenant && tenant.prive ? tenant : null,
    };
  }

  // Continental et mondial partagent la meme mecanique : des champions
  // qualifies d'office, puis un repechage au classement de la zone jusqu'a 32.
  //
  // Cette qualification d'office-la est ANTERIEURE au champion en titre et
  // n'est pas la meme chose : elle fait monter les champions de l'echelon du
  // DESSOUS, et sans elle aucun continental ne peut s'ouvrir (`MIN_DOFFICE`).
  // Elle donne une place sur la grille, jamais la finale ni la cinematique.
  const estContinental = echelon === 'continental';
  const champions = estContinental
    ? await championsEnTitre(db, 'national', z => continentDe(z) === zone, ep)
    : await championsEnTitre(db, 'continental', null, ep);

  const minimum = MIN_DOFFICE[echelon] || 0;
  if (champions.length < minimum) {
    return {
      erreur: 'pas assez de champions',
      champions: champions.length, requis: minimum,
      repli: 'attendre',
    };
  }

  // Le tenant de CET echelon rejoint les qualifies d'office s'il n'y est pas
  // deja. Il y est souvent : le champion d'Europe en titre est presque toujours
  // aussi champion de son pays. Un `Set` de cles suffit a ne pas le compter
  // deux fois, et l'ordre garde le tenant en tete — c'est lui qu'on annonce.
  const dOffice = [];
  const vus = new Set();
  for (const c of [...(bossDOffice ? [bossDOffice] : []), ...champions]) {
    if (vus.has(c.cle)) continue;
    vus.add(c.cle);
    dOffice.push(c);
  }

  const complement = await classement(db, {
    continent: estContinental ? zone : null,
    exclure: vus, limite: large - dOffice.length, maintenant, epreuve: ep,
  });

  // La barre tombe apres les trente-deux, champions d'office compris : c'est
  // eux qui reduisent le nombre de places ouvertes au repechage, et un
  // reclamant a le droit de le savoir.
  const place = Math.max(0, FORMAT.partants - dOffice.length);
  const joueurs = [...dOffice, ...complement.slice(0, place)];
  return {
    joueurs,
    suivants: complement.slice(place),
    doffice: vus,
    tenant: boss && joueurs.some(j => j.cle === boss.cle) ? boss : null,
    tenantEcarte: tenant && tenant.prive ? tenant : null,
  };
}

/** L'heure de cloture d'une edition qui part ce samedi-la. */
export const clotureDe = (debutSamedi) => debutSamedi - CLOTURE_JOURS_AVANT * JOUR;

/**
 * ANNONCER UNE EDITION — premier des deux actes.
 *
 * Ces deux actes n'en faisaient qu'un, et c'est la tout ce qui empechait la
 * selection d'etre juste. Ouvrir une edition, c'etait du meme geste declarer
 * qu'elle aurait lieu ET geler ses trente-deux partants : le classement se
 * lisait donc a l'instant ou quelqu'un lancait la commande. Mercredi matin ou
 * vendredi soir, personne ne pouvait le savoir a l'avance ni le verifier
 * apres. Il n'y avait pas de regle a propos de laquelle etre juste.
 *
 * Ici on ne fait que declarer : la zone, l'epreuve, le samedi du depart, et
 * l'heure a laquelle la selection fermera. Aucun partant. C'est cette edition
 * annoncee, et elle seule, qui donne un decompte a afficher — un decompte vers
 * une echeance sur laquelle le joueur peut encore agir.
 *
 * `debutSamedi` est minuit UTC d'un samedi — `Date.UTC(2026, 8, 19)`, sans
 * heure. Ce n'est plus une consigne mais une condition : voir le refus dans le
 * corps, et pourquoi il vaut mieux qu'un commentaire.
 */
export async function annoncerEchelon(db, { echelon, zone, debutSamedi, epreuve, cloture }) {
  await ensureChampTables(db);
  if (!ECHELONS[echelon]) return { erreur: 'echelon inconnu' };
  const z = String(zone || 'MONDE').toUpperCase();
  // L'epreuve se valide ici et pas a la porte HTTP : `annoncerCycle` annonce
  // trente pays sans repasser par une requete, et une distance fantaisiste
  // doit etre refusee la aussi.
  const ep = String(epreuve == null ? EPREUVE_DEFAUT : epreuve);
  if (!EPREUVES.includes(ep)) return { erreur: 'epreuve inconnue', epreuve: ep };

  const t = Number(debutSamedi);
  if (!Number.isFinite(t)) return { erreur: 'date de debut invalide' };

  // MINUIT UTC, ET UN SAMEDI. Un commentaire ne suffisait pas.
  //
  // `CALENDRIER` porte des minutes depuis minuit — la premiere serie a 9 h, la
  // finale a 19 h — et `calendrier()` les ajoute telles quelles a cette date.
  // Une heure glissee dans `debut` decale donc tout le weekend d'autant, sans
  // que rien ne proteste : la valeur reste un instant parfaitement valide, elle
  // ne veut simplement plus dire ce qu'on croit. C'est arrive en verification,
  // avec sept heures d'ecart — la finale tombait a 2 h du matin le lundi.
  //
  // Et le samedi n'est pas decoratif : `CALENDRIER` a un `jour1` et un `jour2`,
  // donc un depart pose un mercredi produirait des demi-finales le jeudi.
  //
  // On refuse plutot que de corriger en silence. Ramener la valeur a minuit
  // sans le dire changerait ce que l'appelant a demande, et ce genre de
  // correction muette est exactement ce qui rend un defaut introuvable six mois
  // plus tard. `attendu` donne la valeur juste, pour que le refus se repare
  // sans avoir a relire ce fichier.
  const d = new Date(t);
  const minuit = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (t !== minuit) {
    return { erreur: 'debut pas a minuit UTC', debut: t, attendu: minuit };
  }
  // En UTC, et pas dans le fuseau du serveur : le worker tourne la ou
  // Cloudflare le pose, et `getDay()` y repondrait autre chose qu'ici.
  if (d.getUTCDay() !== 6) {
    return { erreur: 'debut pas un samedi', debut: t, jour: d.getUTCDay() };
  }

  const ferme = Number.isFinite(Number(cloture)) ? Number(cloture) : clotureDe(t);
  if (ferme >= t) return { erreur: 'cloture apres le depart', cloture: ferme, debut: t };

  // Une zone ne tient qu'un championnat a la fois. Deux editions ouvertes pour
  // le meme pays produiraient deux champions du meme endroit, et un titre qui
  // ne veut plus rien dire. Une edition annulee, en revanche, ne bloque plus
  // rien : elle n'aura pas lieu, et le cycle suivant doit pouvoir reannoncer.
  const deja = await db.prepare(
    `SELECT id, debut, etat FROM champ_editions
      WHERE echelon = ? AND zone = ? AND etat NOT IN ('terminee', 'annulee') LIMIT 1`
  ).bind(echelon, z).first();
  if (deja) return { erreur: 'edition deja ouverte', edition: deja.id, debut: deja.debut, etat: deja.etat };

  // Un pays qui ne peut pas tenir son championnat se refuse ICI, et pas dans
  // trois jours. `annoncerCycle` ne lui donnerait jamais son tour, mais une
  // annonce a la main le pourrait — et annoncer un championnat pour ensuite
  // l'annuler est bien pire que de ne pas l'annoncer.
  //
  // C'est un COMPTE, pas un classement : on verifie qu'il y a du monde, on ne
  // regarde pas qui. Rien n'est gele, et le classement reste libre de bouger
  // jusqu'a la cloture.
  //
  // Les echelons superieurs n'ont pas droit a cette verification, et c'est
  // volontaire : un continental s'annonce AVANT que les nationaux aient
  // couronne les champions qui le rempliront. Compter ses qualifies d'office a
  // l'annonce reviendrait a refuser tous les continentaux du cycle.
  //
  // Le compte est celui de LA DISTANCE annoncee. Un pays de sprinters a de
  // quoi remplir son 100 m sans avoir de quoi remplir son 400 m, et compter
  // ses joueurs toutes distances confondues lui promettrait une edition dont
  // la grille resterait vide a la cloture — c'est-a-dire une annulation
  // annoncee, exactement ce que cette verification existe pour eviter.
  if (echelon === 'national') {
    const cfg = ECHELONS.national;
    const n = await effectifPays(db, z, cfg.fenetreActiviteJours, ep);
    if (n < cfg.minJoueurs) {
      return {
        erreur: 'pays trop petit', joueurs: n,
        requis: cfg.minJoueurs, repli: REPLI_PAYS_TROP_PETIT,
      };
    }
  }

  // On ne lit PAS le classement ici. Une grille semee a l'annonce serait
  // exactement ce qu'on vient de defaire : un gel a une heure que personne
  // n'a annoncee. La phase de depart est posee des maintenant pour que rien en
  // aval n'ait a traiter une edition sans phase.
  const id = code();
  const phase0 = FORMAT.phases[0];
  await db.prepare(
    `INSERT INTO champ_editions
       (id, echelon, zone, epreuve, debut, cloture, phase, etat, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'annoncee', ?)`
  ).bind(id, echelon, z, ep, t, ferme, phase0.cle, Date.now()).run();

  const nom = nomZone(z, echelon);
  await annoncer(db, {
    edition: id, echelon, zone: z, type: 'annonce',
    titre: echelon === 'mondial' ? 'Championnat du monde' : ECHELONS[echelon].nom + ' ' + nom.avec,
    texte: ep + ' m. Premier départ samedi. Sélection des '
         + FORMAT.partants + ' meilleurs du classement, à la clôture.',
    donnees: { epreuve: ep, debut: t, cloture: ferme, partants: FORMAT.partants },
  });

  return {
    edition: id, echelon, zone: z, epreuve: ep, etat: 'annoncee',
    pays: echelon === 'national' ? z : undefined,
    debut: t, cloture: ferme,
    calendrier: calendrier(t, CALENDRIER),
  };
}

/**
 * CLOTURER LA SELECTION — second acte, et le seul qui lise le classement.
 *
 * « Figes a la cloture » etait deja le principe ; il devient verifiable, parce
 * que la cloture est maintenant une heure annoncee d'avance et non l'instant ou
 * une commande a ete lancee. Apres cet appel, le classement peut bouger comme
 * il veut : la grille ne bouge plus, et personne n'entre ni ne sort entre deux
 * courses.
 *
 * `maintenant` est l'instant de reference — celui de la fenetre d'activite et
 * celui qu'on inscrit. Le cron passe toutes les cinq minutes et peut donc
 * arriver un peu apres l'heure ; on lui passe l'heure annoncee plutot que la
 * sienne, pour que la regle affichee soit celle qui a ete appliquee.
 */
export async function cloturerSelection(db, edition, maintenant = Date.now()) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, etat
       FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat !== 'annoncee') return { erreur: 'edition deja cloturee', etat: e.etat };

  const ep = e.epreuve || EPREUVE_DEFAUT;
  const phase0 = FORMAT.phases[0];
  const nom = nomZone(e.zone, e.echelon);
  const intitule = e.echelon === 'mondial'
    ? 'Championnat du monde' : ECHELONS[e.echelon].nom + ' ' + nom.avec;

  const p = await pool(db, e.echelon, e.zone, maintenant, ep);
  const manque = !p.erreur && p.joueurs.length < FORMAT.partants;

  // La zone a ete annoncee et ne peut pas tenir sa grille : elle a perdu des
  // joueurs actifs depuis l'annonce, ou ses champions ont expire.
  //
  // On annule, et on ne repousse pas. Repousser la cloture de vingt-quatre
  // heures parce qu'il manque un partant reviendrait a deplacer l'echeance
  // apres l'avoir publiee — c'est-a-dire a defaire ce que tout ce decoupage
  // vient de construire. Le cycle suivant reannoncera.
  if (p.erreur || manque) {
    const raison = p.erreur ? p.erreur : 'grille incomplete';
    await db.prepare(
      `UPDATE champ_editions SET etat = 'annulee', fini_le = ? WHERE id = ?`
    ).bind(maintenant, e.id).run();
    await annoncer(db, {
      edition: e.id, echelon: e.echelon, zone: e.zone, type: 'annulation',
      titre: intitule,
      texte: 'Édition annulée : pas assez de partants à la clôture.',
      // Les champs se recopient un par un plutot que d'etaler `p`. Etaler
      // marchait, et par accident : selon la branche, `p.joueurs` est un
      // compte ou la liste complete des partants — et la seconde n'a rien a
      // faire dans une annonce, qui est publique et se lit dans le fil.
      donnees: {
        raison,
        joueurs: manque ? p.joueurs.length : p.joueurs,
        requis: manque ? FORMAT.partants : p.requis,
        champions: p.champions,
        repli: p.repli,
      },
    });
    // Le detail chiffre remonte avec l'erreur. L'ancien `ouvrirEchelon` le
    // rendait, et deux appelants s'en servent pour dire quelque chose d'utile :
    // le harnais France affiche « il faut 32 joueurs, la base en compte 4 », et
    // `ouvrirCycle` le range dans `ecartes`. Sans ces champs, les deux
    // annoncent un echec sans dire de combien.
    return {
      erreur: raison, edition: e.id, annulee: true,
      joueurs: manque ? p.joueurs.length : p.joueurs,
      requis: manque ? FORMAT.partants : p.requis,
      champions: p.champions, repli: p.repli,
    };
  }

  // Le semis se fait au MMR pour tout le monde, titre ou pas — c'est la
  // deuxieme moitie de la regle « on qualifie a ce que le joueur voit, on seme
  // a ce qu'on mesure ». Placer les champions en tete de serie parce qu'ils
  // sont champions desequilibrerait les series, ce que le serpentin existe
  // precisement pour eviter ; les y placer aux points de ligue mettrait en
  // couloir 4 celui qui a le plus joue.
  // Le semis ne connait pas les titres non plus : le tenant est seme au MMR
  // comme tout le monde, et peut tres bien tomber dans la serie 3. Le placer
  // tete de serie parce qu'il est champion desequilibrerait les series, ce que
  // le serpentin existe pour eviter — et un boss qu'on protege de ses
  // adversaires n'est pas un boss.
  const joueurs = [...p.joueurs]
    .sort((a, b) => (b.force || 0) - (a.force || 0))
    .map((j, i) => ({
      cle: j.cle, nom: j.nom, rang: i + 1,
      doffice: p.doffice.has(j.cle),
      // Le statut de tenant est FIGE ICI, avec la grille et pour la meme
      // raison : apres la cloture, plus rien de ce qui decide de la
      // competition ne doit dependre de l'heure a laquelle on le relit.
      tenant: !!(p.tenant && p.tenant.cle === j.cle),
    }));

  const grille = serpentin(joueurs, phase0.courses);

  const lignes = [];
  grille.forEach((course, ic) => course.forEach(j => {
    lignes.push(db.prepare(
      `INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course, tenant)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.id, j.cle, j.nom, j.rang, phase0.cle, ic + 1, j.tenant ? 1 : 0));
  }));

  // L'instantane de la barre. `rang` est la position dans le vivier tel qu'il a
  // servi : au national c'est le rang au classement, tout simplement ; aux
  // echelons superieurs les champions d'office viennent d'abord, puisque ce
  // sont eux qui reduisent le nombre de places ouvertes au repechage.
  [...p.joueurs.map(j => ({ ...j, retenu: 1 })),
   ...p.suivants.map(j => ({ ...j, retenu: 0 }))].forEach((j, i) => {
    lignes.push(db.prepare(
      `INSERT INTO champ_selection (edition, name_key, nom, rang, palier, lp, retenu)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.id, j.cle, j.nom, i + 1, j.palier ?? null, j.lp ?? null, j.retenu));
  });

  await db.batch(lignes);

  await db.prepare(
    `UPDATE champ_editions SET etat = 'ouverte', phase = ? WHERE id = ?`
  ).bind(phase0.cle, e.id).run();

  await annoncer(db, {
    edition: e.id, echelon: e.echelon, zone: e.zone, type: 'ouverture',
    titre: intitule,
    // La distance ouvre la phrase : c'est d'elle qu'on est champion, et le fil
    // d'annonces est le seul endroit ou un joueur lit l'edition en toutes
    // lettres.
    texte: ep + ' m. ' + FORMAT.partants + ' partants, ' + phase0.courses
         + ' séries. Premier départ samedi.',
    donnees: { partants: joueurs.length, doffice: p.doffice.size, epreuve: ep },
  });

  // L'ENTREE EN LICE DU TENANT — le declencheur de la cinematique.
  //
  // C'est une annonce et non un champ d'etat, parce que le fil est ce qui fait
  // bouger l'ecran du championnat : chaque annonce y provoque une relecture, et
  // les deux mises en scene qui existent deja — la revelation des repeches, le
  // podium — sont declenchees exactement comme ceci. La cinematique du boss
  // arrive donc par la meme porte que ses deux soeurs, et non par un chemin
  // qu'elle serait seule a prendre.
  //
  // Le serveur dit QUI et QUAND ; il ne dit pas comment on le montre. `donnees`
  // porte de quoi jouer la scene sans un second appel : le nom, le libelle du
  // titre, sa serie, et son couloir.
  if (p.tenant) {
    const place = joueurs.find(j => j.cle === p.tenant.cle);
    const saCourse = grille.findIndex(c => c.some(j => j.cle === p.tenant.cle)) + 1;
    await annoncer(db, {
      edition: e.id, echelon: e.echelon, zone: e.zone, type: 'boss',
      titre: p.tenant.nom + ' — ' + p.tenant.libelle,
      texte: 'Le tenant du titre entre en lice. Qualifié d’office pour la finale.',
      donnees: {
        cinematique: TENANT.cinematique,
        champion: p.tenant.nom, cle: p.tenant.cle, libelle: p.tenant.libelle,
        echelon: p.tenant.echelon, zone: p.tenant.zone,
        sacre_le: p.tenant.sacre_le,
        // Sa serie et son rang de semis : la scene se joue sur la piste, et il
        // faut savoir ou le placer.
        course: saCourse || null, rang: place ? place.rang : null,
        finaleDOffice: TENANT.finaleDOffice,
        entreeDOffice: p.doffice.has(p.tenant.cle),
      },
    });
  }

  // Le champion ecarte pour inactivite. Il court peut-etre quand meme — s'il
  // etait classe assez haut — mais sans rien de ce que son titre donne, et
  // c'est la seule chose que personne ne devinerait en regardant la grille.
  //
  // Aucune notification pour celle-la : `ANNONCES` ne la contient pas. Faire
  // vibrer un pays pour annoncer qu'un joueur a perdu un privilege est une
  // information de reglement, pas un evenement de competition.
  if (p.tenantEcarte) {
    await annoncer(db, {
      edition: e.id, echelon: e.echelon, zone: e.zone, type: 'tenant-ecarte',
      titre: p.tenantEcarte.nom + ' — ' + p.tenantEcarte.libelle,
      texte: 'Aucun duel classé depuis son sacre : le tenant repart sans ses privilèges.',
      donnees: {
        champion: p.tenantEcarte.nom, cle: p.tenantEcarte.cle,
        sacre_le: p.tenantEcarte.sacre_le, raison: 'inactif depuis le sacre',
      },
    });
  }

  return {
    edition: e.id, echelon: e.echelon, zone: e.zone, epreuve: ep, etat: 'ouverte',
    pays: e.echelon === 'national' ? e.zone : undefined,
    partants: joueurs.length, doffice: p.doffice.size,
    suivants: p.suivants.length,
    cloture: e.cloture, debut: e.debut,
    // Le tenant remonte a l'appelant : le harnais et le tableau de bord des
    // championnats l'affichent, et sans lui une grille de trente-deux noms ne
    // dit pas lequel a un titre a defendre.
    tenant: p.tenant ? { cle: p.tenant.cle, nom: p.tenant.nom, libelle: p.tenant.libelle } : null,
    tenantEcarte: p.tenantEcarte
      ? { cle: p.tenantEcarte.cle, nom: p.tenantEcarte.nom, raison: 'inactif depuis le sacre' }
      : null,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c })),
    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * Annonce et cloture d'un seul geste.
 *
 * C'est l'ancien `ouvrirEchelon`, et il garde sa place : sur le canal de test
 * on veut un championnat maintenant, pas dans trois jours, et les essais du
 * moteur n'ont pas a attendre une echeance. En production c'est l'annonce
 * qu'on appelle — un championnat ouvert sans avoir ete annonce est exactement
 * ce que ce decoupage sert a rendre impossible.
 */
export async function ouvrirEchelon(db, { echelon, zone, debutSamedi, epreuve }) {
  const a = await annoncerEchelon(db, { echelon, zone, debutSamedi, epreuve });
  if (a.erreur) return a;

  const r = await cloturerSelection(db, a.edition);

  // Le geste a echoue : il ne doit rien laisser derriere lui.
  //
  // `cloturerSelection` annule l'edition quand la grille ne se remplit pas, et
  // c'est la bonne reponse pour une edition annoncee : un pays a qui l'on a
  // promis un championnat merite qu'on lui dise qu'il n'aura pas lieu. Mais ici
  // l'annonce et la cloture tombent dans la meme milliseconde — personne ne l'a
  // jamais vue passer, et laisser une edition annulee derriere soi reviendrait
  // a garder la trace d'une promesse qui n'a jamais ete faite.
  //
  // Ce n'est pas cosmetique : `ouvrirCycle` appelle ceci pour trente zones, et
  // celles qui n'ont pas assez de champions en laissaient une chacune. Elles
  // ressortaient ensuite dans le recapitulatif mondial comme des editions
  // existantes, ce qu'elles ne sont pas.
  if (r.erreur) {
    await db.batch([
      db.prepare(`DELETE FROM champ_annonces WHERE edition = ?`).bind(a.edition),
      db.prepare(`DELETE FROM champ_editions WHERE id = ?`).bind(a.edition),
    ]);
  }
  return r;
}

/** Ouvre une edition nationale. Conserve pour les appels existants. */
export async function ouvrirNational(db, { pays, debutSamedi, epreuve }) {
  return ouvrirEchelon(db, { echelon: 'national', zone: pays, debutSamedi, epreuve });
}

/**
 * Ouvre le meme weekend pour tous les pays qui peuvent le tenir.
 *
 * « Tous les championnats nationaux ont lieu le meme weekend » n'est pas un
 * detail d'affichage : c'est ce qui fait qu'un joueur sait que pendant qu'il
 * court sa serie, trente autres pays courent la leur. Une seule date, passee
 * a tout le monde, et les pays trop petits ressortent dans `ecartes` avec
 * leur raison plutot que d'echouer en silence.
 *
 * `acte` decide de ce qu'on fait de chaque zone : l'annoncer, ou l'ouvrir sur
 * le champ. Les deux parcourent exactement la meme liste de zones dans le meme
 * ordre — c'est ce qui garantit qu'un cycle annonce et un cycle ouvert
 * concernent le meme monde.
 */
export async function ouvrirCycle(db, {
  debutSamedi, echelon = 'national', epreuve, acte = ouvrirEchelon,
}) {
  await ensureChampTables(db);
  const ouvertes = [], ecartes = [];

  if (echelon === 'national') {
    for (const p of await paysEligibles(db, epreuve || EPREUVE_DEFAUT)) {
      if (!p.eligible) { ecartes.push({ zone: p.pays, raison: 'pays trop petit', joueurs: p.joueurs, repli: p.repli }); continue; }
      const r = await acte(db, { echelon: 'national', zone: p.pays, debutSamedi, epreuve });
      if (r.erreur) ecartes.push({ zone: p.pays, raison: r.erreur, ...r });
      else ouvertes.push({ zone: p.pays, edition: r.edition, partants: r.partants, cloture: r.cloture });
    }
  } else if (echelon === 'continental') {
    for (const c of Object.keys(CONTINENTS)) {
      const r = await acte(db, { echelon: 'continental', zone: c, debutSamedi, epreuve });
      if (r.erreur) ecartes.push({ zone: c, raison: r.erreur, ...r });
      else ouvertes.push({ zone: c, edition: r.edition, partants: r.partants, cloture: r.cloture });
    }
  } else {
    const r = await acte(db, { echelon: 'mondial', zone: 'MONDE', debutSamedi, epreuve });
    if (r.erreur) ecartes.push({ zone: 'MONDE', raison: r.erreur, ...r });
    else ouvertes.push({ zone: 'MONDE', edition: r.edition, partants: r.partants, cloture: r.cloture });
  }

  return { echelon, debut: debutSamedi, ouvertes, ecartes };
}

/**
 * Annonce le meme weekend a tout le monde, sans lire un seul classement.
 *
 * C'est l'appel d'exploitation en production : on annonce le cycle une ou deux
 * semaines avant, et plus personne n'y touche. Le cron cloture chaque edition
 * a son heure.
 *
 * La liste des pays est arretee ICI, a l'annonce. Un pays qui n'a pas ses
 * trente-deux joueurs actifs ce jour-la n'aura pas de championnat, meme s'il
 * les gagne avant la cloture — et c'est voulu : la liste des pays qui tiennent
 * leur championnat est publiee avec l'annonce, et une liste publiee ne se
 * complete pas en silence.
 */
export async function annoncerCycle(db, { debutSamedi, echelon = 'national', epreuve }) {
  return ouvrirCycle(db, { debutSamedi, echelon, epreuve, acte: annoncerEchelon });
}

/**
 * Cloture toutes les selections dont l'heure est passee.
 *
 * C'est le point d'entree du cron, et c'est ce qui fait de la cloture une
 * echeance plutot qu'une intention. Une deadline qui attend qu'un humain lance
 * une commande n'est pas une deadline : elle glisse d'une journee le jour ou la
 * cle d'administration ne correspond pas, et la regle affichee devient fausse
 * sans que personne ne l'ait decide.
 *
 * On cloture a l'heure ANNONCEE, pas a celle du passage. Le cron balaie toutes
 * les cinq minutes et arrive donc jusqu'a cinq minutes en retard ; lire le
 * classement avec son horloge a lui reviendrait a appliquer une fenetre
 * d'activite de soixante jours et cinq minutes. L'ecart est infime et le
 * principe ne l'est pas : la regle appliquee doit etre celle qui a ete
 * publiee.
 */
export async function cloturerEcheances(db, maintenant = Date.now()) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `SELECT id, cloture FROM champ_editions
      WHERE etat = 'annoncee' AND cloture IS NOT NULL AND cloture <= ?
      ORDER BY cloture`
  ).bind(maintenant).all();

  const cloturees = [], annulees = [];
  for (const e of results || []) {
    const r = await cloturerSelection(db, e.id, e.cloture);
    if (r.annulee) annulees.push({ edition: e.id, raison: r.erreur });
    else if (r.erreur) annulees.push({ edition: e.id, raison: r.erreur, echec: true });
    else cloturees.push({ edition: e.id, zone: r.zone, partants: r.partants });
  }
  return { vues: (results || []).length, cloturees, annulees };
}

/**
 * L'edition annoncee d'une zone, celle vers laquelle on decompte.
 *
 * Distincte de `editionDe`, qui cherche le championnat ou un joueur est
 * ENGAGE : avant la cloture, personne ne l'est encore. C'est cette route qui
 * permet de parler du championnat a qui n'y est pas — c'est-a-dire a ceux
 * qu'il faut convaincre de jouer.
 */
export async function prochaineEdition(db, zone, echelon = 'national') {
  await ensureChampTables(db);
  const z = String(zone || '').toUpperCase();
  if (!z) return null;
  const e = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, etat
       FROM champ_editions
      WHERE echelon = ? AND zone = ? AND etat IN ('annoncee', 'ouverte')
      ORDER BY debut LIMIT 1`
  ).bind(echelon, z).first();
  if (!e) return null;
  const nom = nomZone(e.zone, e.echelon);
  return {
    id: e.id, echelon: e.echelon, zone: e.zone, zoneNom: nom.nom,
    zoneNomEn: nom.nomEn,
    titre: e.echelon === 'mondial' ? ECHELONS.mondial.nom
         : ECHELONS[e.echelon].nom + ' ' + nom.avec,
    epreuve: e.epreuve || EPREUVE_DEFAUT,
    debut: e.debut, cloture: e.cloture, etat: e.etat,
    partants: FORMAT.partants,
    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * La course d'un partant, et l'heure a laquelle elle part.
 *
 * L'heure se calcule ici et non a l'ecran. Le calendrier est une regle de
 * competition — le meme raisonnement que pour le format des phases : la
 * recopier cote client garantit qu'un jour les deux ne diront plus la meme
 * heure, et une heure de convocation fausse est pire que pas d'heure du tout.
 */
async function courseDe(db, edition, nameKey) {
  const r = await db.prepare(
    `SELECT phase, course FROM champ_partants WHERE edition = ? AND name_key = ?`
  ).bind(edition, nameKey).first();
  if (!r || r.course == null) return null;
  const e = await db.prepare(
    `SELECT debut FROM champ_editions WHERE id = ?`).bind(edition).first();
  const rv = calendrier(e ? e.debut : 0, CALENDRIER)
    .find(x => x.phase === r.phase && x.course === r.course);
  return { phase: r.phase, numero: r.course, at: rv ? rv.at : null };
}

/**
 * Ou en est ce joueur par rapport a la barre de selection de son pays.
 *
 * C'est la reponse a « il me manque combien de places », et c'est tout
 * l'interet d'avoir qualifie au classement visible : cette question a
 * desormais une reponse que le joueur peut verifier lui-meme en comptant les
 * lignes du classement.
 *
 * Un RANG sort d'ici, jamais le MMR. Le nombre cache reste cache : il ordonne
 * des noms, ce sont les noms qu'on rend. Une fois la selection cloturee, on
 * lit l'instantane plutot que le classement du jour — sinon la reponse
 * changerait apres la cloture, alors que la grille, elle, ne change plus.
 */
export async function rangSelection(db, nameKey) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const k = String(nameKey || '').trim().toLowerCase();
  if (!k) return null;

  const g = await db.prepare(
    `SELECT pays FROM player_pays WHERE name_key = ?`).bind(k).first();
  if (!g || !g.pays) return { pays: null, raison: 'pays inconnu' };

  const ed = await prochaineEdition(db, g.pays, 'national');
  const places = FORMAT.partants;

  // Le titre et l'epreuve voyagent avec le rang, et l'appel se suffit alors a
  // lui-meme. C'est ce qui permet a la banderole de l'accueil de tenir en UNE
  // requete : sans eux il lui faudrait aussi demander `/champ/prochain` pour
  // savoir comment nommer le championnat dont elle affiche l'ecart.
  const ou = ed
    ? { titre: ed.titre, epreuve: ed.epreuve, zoneNom: ed.zoneNom,
        // `echelon` et `zoneNomEn` accompagnent le titre francais : sans eux
        // la banderole n'a pas de quoi composer sa version anglaise, et elle
        // affichait « Championnat de France » au milieu d'un ecran traduit.
        echelon: ed.echelon, zoneNomEn: ed.zoneNomEn }
    : { titre: null, epreuve: null, zoneNom: null, echelon: null, zoneNomEn: null };

  // Apres la cloture, la verite est dans l'instantane.
  if (ed && ed.etat === 'ouverte') {
    const r = await db.prepare(
      `SELECT rang, retenu FROM champ_selection WHERE edition = ? AND name_key = ?`
    ).bind(ed.id, k).first();
    return {
      pays: g.pays, ...ou, edition: ed.id, etat: ed.etat, places,
      cloture: ed.cloture, debut: ed.debut,
      // Pas de barre apres le gel : le classement du jour ne selectionne plus
      // rien, et une barre tracee dessus designerait des gens qui ne courent
      // pas. C'est la grille qui fait foi, et elle est ailleurs.
      barre: null,
      rang: r ? r.rang : null,
      retenu: r ? !!r.retenu : false,
      manque: r && !r.retenu ? r.rang - places : null,
      gele: true,
      // La course ou il part, quand il part. C'est LA nouvelle du gel, et elle
      // ne vaut que pour les retenus : « serie 3 » ne dit rien a qui n'y est
      // pas. Le couloir ne sort pas d'ici — il se derive du rang de semis a
      // l'affichage, et le deriver deux fois serait deux occasions de ne plus
      // dire la meme chose.
      course: r && r.retenu ? await courseDe(db, ed.id, k) : null,
    };
  }

  // Avant la cloture : le classement du moment, dans l'ordre qui selectionne.
  //
  // Celui de LA DISTANCE ANNONCEE, et il faut le dire au jeu : la barre se
  // trace dans un classement, et celui du 100 m ne selectionne personne pour
  // une edition du 400 m. `epreuve` voyage donc avec le rang — l'ecran ne
  // dessine la barre que dans le classement ou elle veut dire quelque chose.
  const epSelection = (ed && ed.epreuve) || EPREUVE_DEFAUT;
  const { results } = await db.prepare(
    `SELECT d.name_key AS cle
       FROM duel_players d JOIN player_pays g ON g.name_key = d.name_key
      WHERE g.pays = ? AND d.epreuve = ?
        AND d.wins + d.losses + d.draws > 0 AND d.updated_at >= ?
      ORDER BY ${ordreClassement('d.')}`
  ).bind(g.pays, epSelection,
         Date.now() - ECHELONS.national.fenetreActiviteJours * JOUR).all();

  const i = (results || []).findIndex(r => r.cle === k);
  const rang = i < 0 ? null : i + 1;

  // Qui occupe la derniere place qualificative, nomme.
  //
  // Le jeu dessine une barre dans le classement, et il ne peut pas la placer
  // seul : le classement affiche montre TOUT LE MONDE, tandis que la selection
  // exige un duel classe dans les soixante derniers jours. Un joueur endormi
  // depuis trois mois tient donc une ligne a l'ecran sans occuper de place
  // dans le vivier — et compter trente-deux lignes cote client tracerait la
  // barre trop bas, en silence.
  //
  // On rend donc la cle du dernier qualifie plutot qu'un compte. Le jeu trace
  // apres cette ligne-la, ou ne trace rien s'il ne la voit pas.
  const barre = (results || []).length >= places
    ? (results[places - 1] || {}).cle || null
    : null;
  return {
    pays: g.pays, ...ou,
    edition: ed ? ed.id : null,
    etat: ed ? ed.etat : null,
    cloture: ed ? ed.cloture : null,
    debut: ed ? ed.debut : null,
    places, classes: (results || []).length,
    barre,
    rang,
    // `null` quand le joueur n'est pas classe du tout : il n'a pas un ecart a
    // la barre, il n'est pas encore sur la liste. Les deux cas demandent deux
    // phrases differentes a l'ecran, pas la meme avec un zero dedans.
    retenu: rang != null && rang <= places,
    manque: rang != null && rang > places ? rang - places : null,
    gele: false,
    // Avant le gel, personne n'a de course : la grille n'existe pas. Le champ
    // est la quand meme, a `null`, pour que l'ecran n'ait pas deux formes de
    // reponse a distinguer selon le moment ou il a demande.
    course: null,
  };
}

/**
 * Les trois weekends d'un cycle, deduits du premier.
 *
 * Les delais entre echelons sont en configuration : ils servent a agreger les
 * champions et a fabriquer l'attente, et ce sont exactement les nombres qu'on
 * voudra bouger apres le premier cycle.
 */
/* ---------------------------------------------------------------------------
   POSER ET LIRE LE MOT DU VAINQUEUR
--------------------------------------------------------------------------- */

/** Le nom, normalise — meme regle que le classement (voir relais.js). */
const cleNom = (nom) => String(nom || '').trim().toLowerCase();

/**
 * Qui a gagne cette course-la, d'apres les chronos enregistres.
 *
 * On lit la PLACE quand elle est posee, et le chrono sinon : les places sont
 * ecrites apres coup (voir la cloture de course), et un mot depose dans la
 * seconde qui suit l'arrivee ne doit pas etre refuse parce qu'une colonne
 * n'est pas encore remplie.
 */
export async function vainqueurDeLaCourse(db, edition, phase, course) {
  const r = await db.prepare(
    `SELECT name_key FROM champ_resultats
      WHERE edition = ? AND phase = ? AND course = ? AND ms IS NOT NULL
      ORDER BY CASE WHEN place IS NULL THEN 1 ELSE 0 END, place, ms
      LIMIT 1`).bind(edition, phase, course).first();
  return r ? r.name_key : null;
}

/**
 * Depose le mot du vainqueur d'une course.
 *
 * Le serveur reverifie TOUT ce que le client a pu decider : que la course
 * existe, que celui qui parle l'a bien gagnee, que le texte et la voix sont
 * recevables, et qu'aucun mot n'a deja ete pose. Un client peut mentir sur
 * chacun de ces points.
 */
export async function poserMotDeCourse(db, { edition, phase, course, nom, texte, voix, voix_type }) {
  const k = cleNom(nom);
  if (!k) return { error: 'nom manquant' };
  if (!edition || !phase || !Number.isInteger(course)) return { error: 'course manquante' };

  const gagnant = await vainqueurDeLaCourse(db, edition, phase, course);
  if (!gagnant) return { error: 'course inconnue ou pas encore courue', code: 404 };
  if (gagnant !== k) return { error: 'reserve au vainqueur de la course', code: 403 };

  const t = texte ? motPropre(texte) : '';
  const v = voix ? voixPropre(voix, voix_type) : null;
  if (!t && !v) return { error: 'mot vide' };

  // INSERT OR IGNORE plutot qu'un SELECT suivi d'un INSERT : deux envois
  // partis en meme temps depuis deux onglets passeraient tous les deux le
  // test, et le second ecraserait le premier. La cle primaire tranche.
  const r = await db.prepare(
    `INSERT OR IGNORE INTO champ_mots
       (edition, phase, course, name_key, nom, texte, voix, voix_type, au)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(edition, phase, course, k, String(nom).trim(),
         t || null, v ? v.b64 : null, v ? v.type : null, Date.now()).run();

  if (!r.meta || r.meta.changes === 0) {
    return { error: 'un mot a deja ete pose sur cette course', code: 409 };
  }
  return { ok: true, texte: t || null, voix: !!v };
}

/** La voix d'un mot, a la demande. Le texte, lui, voyage avec l'edition. */
export async function voixDuMot(db, edition, phase, course) {
  const r = await db.prepare(
    `SELECT voix, voix_type FROM champ_mots
      WHERE edition = ? AND phase = ? AND course = ?`).bind(edition, phase, course).first();
  if (!r || !r.voix) return null;
  return { voix: r.voix, voix_type: r.voix_type };
}

export function calendrierCycle(debutSamedi) {
  const SEMAINE = 7 * JOUR;
  const nat = debutSamedi;
  const con = nat + ECHELONS.continental.semainesApresPrecedent * SEMAINE;
  const mon = con + ECHELONS.mondial.semainesApresPrecedent * SEMAINE;
  // La cloture voyage avec le weekend. Un calendrier qui annonce trois dates
  // de depart sans dire quand chaque selection ferme est un calendrier
  // inutilisable pour celui qui veut y entrer.
  const w = (echelon, debut) => ({
    echelon, debut, cloture: clotureDe(debut),
    rendezVous: calendrier(debut, CALENDRIER),
  });
  return [w('national', nat), w('continental', con), w('mondial', mon)];
}

/**
 * L'edition en cours ou ce joueur est engage, s'il y en a une.
 *
 * Sans cette route, un joueur n'a aucun moyen de retrouver son championnat :
 * il faudrait qu'il retienne un identifiant qu'on ne lui a jamais montre. On
 * cherche donc par son nom, comme partout ailleurs dans le jeu.
 *
 * On rend aussi la derniere edition terminee : le sacre merite d'etre lu
 * encore un moment apres la finale, pas d'etre efface a la seconde ou elle
 * s'acheve.
 */
export async function editionDe(db, nameKey) {
  await ensureChampTables(db);
  const k = String(nameKey || '').trim().toLowerCase();
  if (!k) return null;
  const r = await db.prepare(
    `SELECT e.id FROM champ_editions e
       JOIN champ_partants p ON p.edition = e.id
      WHERE p.name_key = ?
      ORDER BY e.etat = 'terminee', e.debut DESC
      LIMIT 1`
  ).bind(k).first();
  return r ? r.id : null;
}

/** L'etat complet d'une edition : ou elle en est, qui court quoi. */
export async function etatEdition(db, id) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT * FROM champ_editions WHERE id = ?`).bind(id).first();
  if (!e) return null;
  const { results: partants } = await db.prepare(
    `SELECT name_key, nom, rang_duel, phase, course, sorti_en, tenant
       FROM champ_partants WHERE edition = ? ORDER BY course, rang_duel`).bind(id).all();
  const { results: res } = await db.prepare(
    `SELECT phase, course, name_key, ms, place, motif, motif_ms FROM champ_resultats
      WHERE edition = ? ORDER BY phase, course, place`).bind(id).all();
  // LES MOTS DES VAINQUEURS. La voix ne part pas d'ici : elle pese jusqu'a
  // deux cents kilooctets encodee, et l'edition entiere se recharge a chaque
  // ouverture de l'ecran. On annonce qu'elle existe ; qui veut l'entendre la
  // demande a `/champ/mot?...`, une fois, pour la course qui l'interesse.
  const { results: mots } = await db.prepare(
    `SELECT phase, course, name_key, nom, texte, au,
            CASE WHEN voix IS NULL THEN 0 ELSE 1 END AS a_voix
       FROM champ_mots WHERE edition = ?`).bind(id).all();
  // Le nom lisible et la forme de la phase viennent d'ici, pas du jeu : le
  // format est une regle de competition, et la dupliquer cote client garantit
  // qu'un jour les deux ne diront plus la meme chose.
  const z = nomZone(e.zone, e.echelon);
  const iPhase = FORMAT.phases.findIndex(p => p.cle === e.phase);
  const cfg = FORMAT.phases[iPhase] || null;
  // Le rang de l'edition parmi celles de son echelon et de sa zone, a la date
  // de creation — l'identifiant departage deux creations a la meme milliseconde.
  const avant = await db.prepare(
    `SELECT COUNT(*) AS n FROM champ_editions
      WHERE echelon = ? AND zone = ? AND (cree_le < ? OR (cree_le = ? AND id < ?))`)
    .bind(e.echelon, e.zone, e.cree_le, e.cree_le, e.id).first();
  const rang = ((avant && avant.n) || 0) + 1;
  return {
    id: e.id, echelon: e.echelon, zone: e.zone, debut: e.debut,
    // Le lieu ou l'edition se rejoue, s'il est impose (voir LIEUX), sinon
    // `null` : le client garde alors le sien.
    lieu: lieuDeLEdition(e.echelon, e.zone, rang),
    // `null` pour les editions ouvertes avant que la cloture existe, et pour
    // celles qu'on ouvre d'un geste sur le canal de test. C'est exact : elles
    // n'ont pas eu d'heure de cloture annoncee, et l'ecran ne doit pas
    // decompter vers une echeance qui n'a jamais ete publiee.
    cloture: e.cloture ?? null,
    // Les editions d'avant la colonne n'en portent pas : on retombe sur la
    // valeur par defaut plutot que de rendre `null`, qu'aucun ecran n'attend.
    epreuve: e.epreuve || EPREUVE_DEFAUT,
    zoneNom: z.nom,
    // Le nom anglais de la zone, pour que le client compose son propre titre.
    zoneNomEn: z.nomEn,
    titre: e.echelon === 'mondial' ? ECHELONS.mondial.nom
         : ECHELONS[e.echelon].nom + ' ' + z.avec,
    phase: e.phase, etat: e.etat,
    phaseNom: cfg ? cfg.nom : e.phase,
    phaseIndex: iPhase,
    phases: FORMAT.phases.map(p => ({ cle: p.cle, nom: p.nom, courses: p.courses })),
    courses: cfg ? cfg.courses : 0,
    parCourse: cfg ? cfg.parCourse : 0,
    directsParCourse: cfg ? cfg.directsParCourse : 0,
    repechages: cfg ? cfg.repechages : 0,
    champion: e.champion_nom || null,
    partants: (partants || []).map(p => ({ ...p, tenant: !!p.tenant })),
    resultats: res || [],
    mots: (mots || []).map(m => ({ ...m, a_voix: !!m.a_voix })),

    // LE TENANT DU TITRE, tel que la cloture l'a gele — et le declencheur de la
    // cinematique avec lui.
    //
    // Il est publie ici EN PLUS de l'annonce `boss`, et les deux ne servent pas
    // la meme chose. L'annonce est l'evenement : elle passe une fois, et c'est
    // elle qui joue la scene en direct. Ce champ-ci est l'etat : un joueur qui
    // ouvre l'ecran le dimanche matin n'a jamais vu passer l'annonce, et doit
    // pourtant savoir lequel de ces trente-deux noms a un titre a defendre.
    //
    // `cinematique` est le nom de la mise en scene, pas la mise en scene. Le
    // client decide de ce qu'il en fait — le serveur tient les regles de la
    // competition, et « comment on montre un champion » n'en est pas une.
    tenant: (() => {
      const t = (partants || []).find(p => p.tenant);
      if (!t) return null;
      return {
        name_key: t.name_key, nom: t.nom,
        course: t.course, rang_duel: t.rang_duel,
        sorti_en: t.sorti_en,
        // Le titre remis en jeu, compose par la meme fonction que le sacre.
        // Il se deduit de l'edition et non de `champ_titres` : le titre du
        // tenant peut avoir ete revoque depuis, et l'ecran doit continuer a
        // dire de quoi il etait champion en entrant en lice.
        libelle: libelleTitre(e.echelon, e.zone),
        cinematique: TENANT.cinematique,
        finaleDOffice: TENANT.finaleDOffice,
      };
    })(),

    calendrier: calendrier(e.debut, CALENDRIER),
  };
}

/**
 * Ce qu'une salle de championnat en direct doit savoir de SA course.
 *
 * La grille est la liste des partants de cette course, dans l'ordre des
 * couloirs. Le couloir se derive du rang de semis — le client le fait deja
 * dans `grille()` (src/game/championnats.ts) pour le tableau et le rejeu, sur
 * la liste que `etatEdition` rend triee par course puis rang de duel. La salle
 * fait la meme chose sur la meme liste : les couloirs de la course en direct
 * sont ceux que le tableau affichera ensuite, et ceux du rejeu.
 *
 * `at` est l'heure du coup de pistolet au calendrier. `deja` dit que la course
 * a des resultats : une salle ne la recourt pas.
 */
export async function contexteCourse(db, edition, phase, course) {
  const e = await etatEdition(db, edition);
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat === 'terminee') return { erreur: 'edition terminee' };
  if (e.phase !== phase) return { erreur: 'ce n est pas la phase en cours', phase: e.phase };
  const grille = e.partants
    .filter(p => p.phase === phase && p.course === course)
    .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99))
    .map((p, i) => ({ cle: p.name_key, nom: p.nom, couloir: i + 1, fictif: false }));
  if (!grille.length) return { erreur: 'course inconnue' };
  // LES PARTANTS FICTIFS — ceux que `tools/champ-combler.mjs` a poses pour
  // completer une grille (player_pays.source = 'fictif'). Ils courent un
  // chrono fixe d'avance, ou volent le depart : voir chronoFictif et
  // fauxDepartFictif.
  const fictifs = await clesFictives(db, grille.map(g => g.cle));
  for (const g of grille) {
    g.fictif = fictifs.has(g.cle);
    if (g.fictif) { g.ms = chronoFictif(e.id, phase, g.cle, e.epreuve); g.faux_ms = null; }
  }
  const fautif = fauxDepartFictif(e.id, phase, course, grille.filter(g => g.fictif).map(g => g.cle));
  if (fautif) grille.find(g => g.cle === fautif.cle).faux_ms = fautif.ms;
  const rv = (e.calendrier || []).find(r => r.phase === phase && r.course === course);
  const deja = (e.resultats || []).some(r => r.phase === phase && r.course === course);
  return {
    edition: e.id, phase, course, epreuve: e.epreuve, lieu: e.lieu || null,
    titre: e.titre, phaseNom: e.phaseNom, courses: e.courses,
    at: rv ? rv.at : null, grille, deja,
  };
}

/** Les cles marquees `fictif` dans player_pays, parmi celles demandees. */
export async function clesFictives(db, cles) {
  const out = new Set();
  if (!cles.length) return out;
  const { results } = await db.prepare(
    `SELECT name_key FROM player_pays WHERE source = 'fictif' AND name_key IN (${cles.map(() => '?').join(',')})`
  ).bind(...cles).all();
  for (const r of results || []) out.add(r.name_key);
  return out;
}

/**
 * LE CHRONO D'UN PARTANT FICTIF.
 *
 * Deterministe — la meme edition, la meme phase, le meme partant donnent le
 * meme temps, que la course se coure en direct devant huit telephones ou soit
 * rangee par la tache planifiee — entre 9,05 et 9,15 s au 100 m (decide le
 * 24/09/2026 : les cartes du championnat leur donnent un record entre 8,80 et
 * 9,00, et un 10,90 en course aurait dementi l'affiche). C'est un chrono de
 * repechage possible : un vrai joueur qui court en dessous de 9,05 passe
 * devant, un vrai joueur plus lent ou absent peut rester derriere.
 */
const FACTEUR_EPREUVE = { '100': 1, '200': 2.08, '400': 4.7 };
function hacheFictif(texte) {
  let h = 2166136261;
  for (const ch of texte) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function chronoFictif(edition, phase, cle, epreuve) {
  const u = (hacheFictif(`${edition}|${phase}|${cle}`) % 10000) / 10000;
  return Math.round((9050 + u * 100) * (FACTEUR_EPREUVE[String(epreuve)] || 1));
}

/**
 * LE FAUX DEPART D'UN PARTANT FICTIF : un par course, en series et en demies
 * (choix du 24/09/2026), jamais en finale. Le fautif est tire parmi les
 * fictifs de la course ; il part entre 30 et 150 ms avant le coup, au premier
 * depart. Null si la course n'a pas de fictif, ou si c'est la finale.
 *
 * Deterministe comme le chrono : la salle le joue en direct (carton rouge,
 * rappel, les autres repartent), la tache planifiee le range tel quel quand
 * personne n'est venu, et le rejeu le montre — les trois disent la meme chose.
 */
const PHASES_A_FAUX_DEPART_FICTIF = new Set(['series', 'demies']);
export function fauxDepartFictif(edition, phase, course, clesFictives) {
  if (!PHASES_A_FAUX_DEPART_FICTIF.has(phase) || !clesFictives.length) return null;
  const h = hacheFictif(`${edition}|${phase}|${course}|faux`);
  const cles = [...clesFictives].sort();
  return { cle: cles[h % cles.length], ms: -(30 + (Math.floor(h / cles.length) % 121)) };
}

/**
 * LES COURSES QUE PERSONNE N'EST VENU COURIR.
 *
 * Une salle de championnat ne s'eveille qu'a la premiere connexion : si aucun
 * vrai partant — et aucun spectateur — n'entre dans le stade, la course n'a
 * lieu nulle part, et la phase ne peut plus se clore. La tache planifiee la
 * range donc elle-meme, un quart d'heure apres l'heure : les fictifs avec leur
 * chrono, les vrais partants absents en forfait. Exactement ce qu'aurait
 * range une salle ou personne n'etait a l'appel.
 *
 * Quinze minutes, parce qu'une salle eveillee en retard peut repousser son
 * pistolet (voir RETARD_TOLERE_MS dans salle-championnat.js) et courir encore
 * quelques minutes ; vingt-quatre heures au plus, pour ne pas remplir apres
 * coup les vieilles editions d'essai de la base de test.
 */
export async function courirSansPersonne(db, maintenant = Date.now()) {
  await ensureChampTables(db);
  const { results: eds } = await db.prepare(
    `SELECT id FROM champ_editions WHERE etat = 'ouverte'`).all();
  const rangees = [];
  for (const { id } of eds || []) {
    const e = await etatEdition(db, id);
    if (!e) continue;
    for (const rv of e.calendrier || []) {
      if (rv.phase !== e.phase || !rv.course) continue;
      if (!(rv.at + 15 * 60 * 1000 < maintenant && maintenant < rv.at + 24 * 3600 * 1000)) continue;
      if ((e.resultats || []).some(r => r.phase === e.phase && r.course === rv.course)) continue;
      const c = await contexteCourse(db, id, e.phase, rv.course);
      if (c.erreur || c.deja) continue;
      const chronos = c.grille.map(g => !g.fictif
        ? { cle: g.cle, ms: null, motif: 'forfait' }
        : g.faux_ms != null
          ? { cle: g.cle, ms: null, motif: 'faux_depart', motif_ms: g.faux_ms }
          : { cle: g.cle, ms: g.ms });
      const r = await enregistrerCourse(db, { edition: id, phase: e.phase, course: rv.course, chronos });
      rangees.push({ edition: id, phase: e.phase, course: rv.course, ok: !r.erreur, erreur: r.erreur || null });
    }
  }
  return rangees;
}

/**
 * LES PHASES SE CLOSENT A L'HEURE QUE LE CALENDRIER AFFICHE.
 *
 * Le calendrier annonce trois moments qui ne sont pas des courses : la
 * revelation des repeches du samedi soir, celle du dimanche apres-midi, et le
 * sacre. Chacun est une cloture de phase — `cloturerPhase` produit les deux
 * revelations et le sacre, rien d'autre ne les produit. Tant que cette
 * cloture n'etait appelee que par `/champ/cloturer`, a la main et avec la cle,
 * le jeu affichait « cérémonie 21:20 » et l'heure passait sans que rien
 * n'arrive : l'edition restait en series pour toujours.
 *
 * La tache planifiee tient donc le rendez-vous elle-meme. Le moment est celui
 * de la phase EN COURS qui porte `reveal` ou `ceremonie` ; une fois la phase
 * close, l'edition passe a la suivante et ce moment ne la concerne plus, ce qui
 * rend l'appel sans danger a chaque passage.
 *
 * Une phase dont une course manque n'est pas forcee : `cloturerPhase` refuse,
 * et le passage suivant reessaie. C'est le cas d'une salle qui a repousse son
 * pistolet et court encore a l'heure du sacre. Vingt-quatre heures au plus,
 * comme `courirSansPersonne`, pour ne pas clore apres coup les vieilles
 * editions d'essai de la base de test.
 */
export async function cloturerAuxHeures(db, maintenant = Date.now()) {
  await ensureChampTables(db);
  const { results: eds } = await db.prepare(
    `SELECT id FROM champ_editions WHERE etat = 'ouverte'`).all();
  const closes = [];
  for (const { id } of eds || []) {
    const e = await etatEdition(db, id);
    if (!e) continue;
    const rv = (e.calendrier || []).find(r => r.phase === e.phase && (r.reveal || r.ceremonie));
    if (!rv || !(rv.at <= maintenant && maintenant < rv.at + 24 * 3600 * 1000)) continue;
    closes.push({ edition: id, phase: e.phase, moment: rv.cle, ...(await cloturerPhase(db, id)) });
  }
  return closes;
}

/**
 * Les raisons pour lesquelles un partant n'a pas de chrono. Voir la colonne
 * `motif` de `champ_resultats`.
 */
export const MOTIFS = new Set(['faux_depart', 'abandon', 'forfait']);

/**
 * Enregistre les chronos d'une course.
 *
 * Le serveur ne recalcule rien : il range, et c'est la cloture de la phase qui
 * tranchera. Separer les deux permet de courir les quatre series a des heures
 * differentes — ce que le calendrier impose — sans que la premiere ne decide
 * de rien avant que la quatrieme n'ait eu lieu.
 */
export async function enregistrerCourse(db, { edition, phase, course, chronos }) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT phase, etat FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat === 'terminee') return { erreur: 'edition terminee' };
  if (e.phase !== phase) return { erreur: 'ce n est pas la phase en cours', phase: e.phase };

  const { results: inscrits } = await db.prepare(
    `SELECT name_key FROM champ_partants
      WHERE edition = ? AND phase = ? AND course = ?`).bind(edition, phase, course).all();
  const attendus = new Set((inscrits || []).map(r => r.name_key));
  if (!attendus.size) return { erreur: 'course inconnue' };

  const lignes = [];
  for (const c of chronos || []) {
    const k = String(c.cle || '').toLowerCase();
    if (!attendus.has(k)) continue;                 // un intrus ne court pas
    const ms = c.ms == null ? null : Math.round(Number(c.ms));
    if (ms != null && (!Number.isFinite(ms) || ms < 1000 || ms > 600000)) continue;
    // Un motif n'accompagne qu'un chrono absent : un coureur arrive n'a pas
    // d'excuse a porter. Hors de la liste, il est tu plutot que range tel quel.
    const motif = ms == null && MOTIFS.has(c.motif) ? c.motif : null;
    const mm = motif && c.motif_ms != null && Number.isFinite(Number(c.motif_ms))
      ? Math.round(Number(c.motif_ms)) : null;
    lignes.push(db.prepare(
      `INSERT INTO champ_resultats (edition, phase, course, name_key, ms, motif, motif_ms, couru_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(edition, phase, course, name_key) DO UPDATE SET
         ms = excluded.ms, motif = excluded.motif, motif_ms = excluded.motif_ms,
         couru_le = excluded.couru_le`
    ).bind(edition, phase, course, k, ms, motif, mm, Date.now()));
  }
  if (!lignes.length) return { erreur: 'aucun chrono exploitable' };
  await db.batch(lignes);

  // Les qualifies directs d'une course sont decides par cette course seule :
  // on peut donc les annoncer des l'arrivee, ce que la mise en scene demande.
  // Les repeches, eux, se calculent sur les quatre series et attendent la
  // cloture — c'est tout l'ecart entre ce qui se voit et ce qui se devine.
  const cfgPhase = FORMAT.phases.find(x => x.cle === phase);
  const { results: arrivee } = await db.prepare(
    `SELECT r.name_key AS cle, r.ms, r.motif, p.nom, p.rang_duel AS rang
       FROM champ_resultats r JOIN champ_partants p
         ON p.edition = r.edition AND p.name_key = r.name_key
      WHERE r.edition = ? AND r.phase = ? AND r.course = ?`
  ).bind(edition, phase, course).all();

  const ordre = ordonner(arrivee || []);
  // Les memes que `qualifier` : un chrono, et une place dans les premiers.
  const directs = ordre.slice(0, (cfgPhase && cfgPhase.directsParCourse) || 0)
    .filter(r => r.ms != null);
  const ed = await db.prepare(
    `SELECT echelon, zone FROM champ_editions WHERE id = ?`).bind(edition).first();

  if (ed) {
    await annoncer(db, {
      edition, echelon: ed.echelon, zone: ed.zone,
      type: directs.length ? 'qualification-directe' : 'course-terminee',
      titre: (cfgPhase ? cfgPhase.nom : phase) + ' — course ' + course,
      texte: directs.length
        ? directs.map(r => r.nom).join(' et ') + ' passent directement.'
        : 'Course terminée.',
      donnees: {
        phase, course,
        arrivee: ordre.map((r, i) => ({ place: i + 1, nom: r.nom, ms: r.ms, motif: r.motif || null })),
        directs: directs.map(r => r.nom),
      },
    });
  }

  return { ok: true, enregistres: lignes.length, sur: attendus.size, directs: directs.map(r => r.nom) };
}

/**
 * Cloture la phase en cours : applique les regles, et seme la suivante.
 *
 * On refuse de clore tant qu'une course n'a pas eu lieu. C'est ce qui protege
 * le suspense autant que l'equite : les huit repeches ne peuvent pas etre
 * connus avant la quatrieme serie, puisqu'ils se calculent sur les quatre.
 */
export async function cloturerPhase(db, edition) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT phase, etat, zone, echelon FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };
  if (e.etat === 'terminee') return { erreur: 'edition terminee' };

  const iPhase = FORMAT.phases.findIndex(p => p.cle === e.phase);
  const cfg = FORMAT.phases[iPhase];

  // On rassemble les chronos, course par course, avec de quoi departager.
  //
  // `p.tenant` voyage avec : c'est la colonne gelee a la cloture, et c'est
  // volontairement elle qu'on lit plutot que `champ_titres`. Un titre porte une
  // echeance, et le relire ici ferait qu'un titre expirant samedi soir
  // changerait les regles de qualification entre la quatrieme serie et les
  // demi-finales — la competition n'aurait alors pas ete la meme du debut a la
  // fin, sans que personne l'ait decide.
  const { results: brut } = await db.prepare(
    `SELECT r.course, r.name_key AS cle, r.ms, p.nom, p.rang_duel AS rang,
            p.tenant AS tenant,
            (SELECT MIN(x.ms) FROM champ_resultats x
              WHERE x.edition = r.edition AND x.name_key = r.name_key
                AND x.phase <> r.phase) AS msPrecedent
       FROM champ_resultats r JOIN champ_partants p
         ON p.edition = r.edition AND p.name_key = r.name_key
      WHERE r.edition = ? AND r.phase = ?`).bind(edition, e.phase).all();

  const courses = Array.from({ length: cfg.courses }, () => []);
  for (const r of brut || []) courses[r.course - 1].push(r);
  const manquantes = courses
    .map((c, i) => (c.length ? null : i + 1)).filter(Boolean);
  if (manquantes.length) {
    return { erreur: 'toutes les courses n ont pas eu lieu', manquantes };
  }

  // La finale ne qualifie personne : elle sacre.
  if (iPhase === FORMAT.phases.length - 1) {
    const p = podium(courses[0], cfg.podium);
    const majPlaces = p.classement.map(r => db.prepare(
      `UPDATE champ_resultats SET place = ? WHERE edition = ? AND phase = ? AND name_key = ?`
    ).bind(r.place, edition, e.phase, r.cle));
    await db.batch(majPlaces);
    if (!p.champion) return { erreur: 'aucun finaliste n a de chrono' };
    await poserMedailles(db, edition, e, p.podium);
    // Les finalistes partent avec le sacre : c'est de leur presence en finale
    // que depend la perte du titre du tenant. Un ancien champion elimine en
    // demi-finale garde son titre jusqu'a son echeance — il n'a pas perdu de
    // finale, il n'y est pas arrive.
    const sacre = await sacrer(db, edition,
      { cle: p.champion.cle, nom: p.champion.nom },
      p.classement.map(r => r.cle));
    return { phase: e.phase, finale: true, podium: p.podium, classement: p.classement, ...sacre };
  }

  // La porte du tenant, passee au moteur. C'est un Set de cles et rien de plus :
  // le moteur reste pur, et il n'a pas a savoir ce qu'est un titre — seulement
  // qui passe quoi qu'il arrive.
  const dOffice = TENANT.finaleDOffice
    ? new Set((brut || []).filter(r => r.tenant).map(r => r.cle))
    : null;

  const q = qualifier(courses, cfg, dOffice);
  const suivante = FORMAT.phases[iPhase + 1];

  // Les qualifies repartent en serpentin, semes sur leur chrono du jour : le
  // meilleur temps de la phase est tete de serie de la suivante.
  const qualifies = [...q.directs, ...q.repeches]
    .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity))
    .map((r, i) => ({ ...r, rang: i + 1 }));
  const grille = serpentin(qualifies, suivante.courses);

  const ecritures = [];
  q.ordreParCourse.forEach((ordre, ic) => ordre.forEach((r, pos) => {
    ecritures.push(db.prepare(
      `UPDATE champ_resultats SET place = ? WHERE edition = ? AND phase = ? AND course = ? AND name_key = ?`
    ).bind(pos + 1, edition, e.phase, ic + 1, r.cle));
  }));
  for (const r of q.elimines) {
    ecritures.push(db.prepare(
      `UPDATE champ_partants SET sorti_en = ? WHERE edition = ? AND name_key = ?`
    ).bind(e.phase, edition, r.cle));
  }
  grille.forEach((c, ic) => c.forEach(j => {
    ecritures.push(db.prepare(
      `UPDATE champ_partants SET phase = ?, course = ? WHERE edition = ? AND name_key = ?`
    ).bind(suivante.cle, ic + 1, edition, j.cle));
  }));
  ecritures.push(db.prepare(
    `UPDATE champ_editions SET phase = ? WHERE id = ?`).bind(suivante.cle, edition));
  await db.batch(ecritures);

  // Le seul moment de la competition ou le suspense est fabrique plutot que
  // couru : les repeches n'existaient dans aucune course, ils sortent du
  // classement de toutes.
  await annoncer(db, {
    edition, echelon: e.echelon, zone: e.zone,
    type: suivante.cle === 'finale' ? 'reveal-finale' : 'reveal-demies',
    titre: 'Les repêchés — ' + suivante.nom,
    texte: q.repeches.length
      ? q.repeches.map(r => r.nom).join(', ') + ' sont repêchés au chrono.'
      : 'Aucun repêchage.',
    donnees: {
      directs: q.directs.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
      // `doffice` distingue le tenant verse par son titre d'un repeche au
      // chrono. L'ecran doit pouvoir le dire : presenter un passe-droit comme
      // un repechage merite serait la seule facon de rendre cette regle
      // detestable.
      repeches: q.repeches.map(r => ({
        nom: r.nom, course: r.course, place: r.place, ms: r.ms,
        doffice: !!r.doffice,
      })),
      elimines: q.elimines.length,
      grille: grille.map((c, i) => ({ course: i + 1, joueurs: c.map(j => j.nom) })),
    },
  });

  return {
    phase: e.phase, suivante: suivante.cle,
    directs: q.directs.map(r => ({ nom: r.nom, course: r.course, place: r.place, ms: r.ms })),
    repeches: q.repeches.map(r => ({
      nom: r.nom, course: r.course, place: r.place, ms: r.ms, doffice: !!r.doffice,
    })),
    elimines: q.elimines.length,
    grille: grille.map((c, i) => ({ course: i + 1, joueurs: c.map(j => j.nom) })),
  };
}

/**
 * Les trois premiers d'une finale recoivent leur medaille.
 *
 * Elles durent le meme temps qu'un titre — jusqu'au championnat suivant — pour
 * la meme raison : une medaille qu'on porte a vie finirait par ne plus rien
 * dire, et le classement se couvrirait de sigles sans age.
 */
export async function poserMedailles(db, edition, e, podiumTrois) {
  await ensureChampTables(db);
  const maintenant = Date.now();
  const expire = new Date(maintenant);
  expire.setMonth(expire.getMonth() + TITRE_MOIS);

  // Le pays des trois, lu ICI et grave dans la ligne. Voir le commentaire de
  // la colonne : le lire au moment de l'affichage laisserait le palmares d'un
  // pays bouger apres coup.
  //
  // Un national se court entre gens d'un meme pays, et `e.zone` le nomme ;
  // mais le lire de la sorte ferait deux chemins pour une seule donnee, dont
  // l'un ne vaudrait que pour un echelon. On demande donc a `player_pays`
  // dans tous les cas, et ce qui manque reste null.
  const pays = await paysDe(db, podiumTrois.map(r => r.cle));

  const lignes = podiumTrois.map(r => db.prepare(
    `INSERT INTO champ_medailles
       (echelon, zone, name_key, nom, place, edition, obtenu_le, expire_le, pays)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(e.echelon, e.zone, r.cle, r.nom, r.place, edition, maintenant, expire.getTime(),
         pays.get(String(r.cle || '').toLowerCase()) || null));
  if (lignes.length) await db.batch(lignes);
}

/**
 * Decoupe une liste de cles en paquets interrogeables.
 *
 * SQLite plafonne le nombre de parametres lies d'une requete, et D1 bien plus
 * bas qu'on ne l'imagine. Le classement pouvant compter cinq cents joueurs, un
 * seul `IN (?, ?, ...)` fait echouer la requete entiere — et l'echec ne se
 * serait pas vu tant que le classement restait petit. On interroge donc par
 * paquets.
 */
const PAQUET = 80;
function paquets(liste) {
  const out = [];
  for (let i = 0; i < liste.length; i += PAQUET) out.push(liste.slice(i, i + PAQUET));
  return out;
}

/** Le rang de prestige d'un echelon. Plus c'est haut, plus ca prime. */
const PRESTIGE = { mondial: 3, continental: 2, national: 1 };

/**
 * La meilleure medaille de chacun, pour un ensemble de joueurs.
 *
 * « Meilleure » veut dire la plus prestigieuse, et la competition prime sur la
 * couleur : un bronze mondial passe devant un or national. C'est la regle
 * demandee, et c'est aussi la seule qui se defende — sans quoi un champion
 * national afficherait le meme sigle qu'un medaille du monde.
 *
 * A egalite d'echelon, c'est la couleur qui departage, puis la date.
 */
export async function medaillesDe(db, cles) {
  await ensureChampTables(db);
  const liste = [...new Set((cles || []).map(c => String(c || '').toLowerCase()).filter(Boolean))];
  if (!liste.length) return new Map();
  const maintenant = Date.now();
  const lignes = [];
  for (const bloc of paquets(liste)) {
    const trous = bloc.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT name_key, echelon, zone, place, obtenu_le
         FROM champ_medailles
        WHERE expire_le > ? AND name_key IN (${trous})`
    ).bind(maintenant, ...bloc).all();
    lignes.push(...(results || []));
  }

  const meilleures = new Map();
  for (const r of lignes) {
    const actuel = meilleures.get(r.name_key);
    const mieux = !actuel
      || PRESTIGE[r.echelon] > PRESTIGE[actuel.echelon]
      || (PRESTIGE[r.echelon] === PRESTIGE[actuel.echelon] && r.place < actuel.place)
      || (PRESTIGE[r.echelon] === PRESTIGE[actuel.echelon] && r.place === actuel.place
          && r.obtenu_le > actuel.obtenu_le);
    if (mieux) {
      meilleures.set(r.name_key, {
        echelon: r.echelon, zone: r.zone, place: r.place,
        zoneNom: nomZone(r.zone, r.echelon).nom,
      });
    }
  }
  return meilleures;
}

/** Le pays de chacun, pour un ensemble de joueurs. */
export async function paysDe(db, cles) {
  await ensureChampTables(db);
  const liste = [...new Set((cles || []).map(c => String(c || '').toLowerCase()).filter(Boolean))];
  if (!liste.length) return new Map();
  const m = new Map();
  for (const bloc of paquets(liste)) {
    const trous = bloc.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT name_key, pays FROM player_pays WHERE name_key IN (${trous})`
    ).bind(...bloc).all();
    for (const r of results || []) m.set(r.name_key, r.pays);
  }
  return m;
}

/**
 * Le titre porte par un joueur, s'il en porte un et qu'il court toujours.
 *
 * Un titre revoque n'en fait pas partie : il a ete perdu sur la piste, et le
 * joueur ne le porte plus. La ligne reste en base — c'est l'archive — mais
 * cette fonction repond a « qu'est-ce qu'il porte aujourd'hui », pas a
 * « qu'a-t-il gagne ».
 */
export async function titresDe(db, nameKey) {
  await ensureChampTables(db);
  const { results } = await db.prepare(
    `SELECT echelon, zone, libelle, sacre_le, expire_le
       FROM champ_titres
      WHERE name_key = ? AND expire_le > ? AND revoque_le IS NULL
      ORDER BY sacre_le DESC`
  ).bind(String(nameKey).toLowerCase(), Date.now()).all();
  return results || [];
}

/**
 * LE TENANT DU TITRE d'une edition — le seul joueur a qui son titre donne
 * quelque chose ici.
 *
 * ETANCHEITE. On interroge sur le couple (echelon, zone), et c'est tout le
 * fichier de cette regle. Filtrer sur le seul echelon aurait laisse passer le
 * champion de France dans le championnat d'Espagne, puisque les deux editions
 * sont 'national' — c'est le cas que la specification appelle « etancheite »,
 * et c'est le seul qu'une comparaison d'echelon ne voit pas.
 *
 * Un champion national interroge sur un continental ne remonte donc jamais :
 * ni l'echelon ni la zone ne correspondent. Il peut par ailleurs etre sur la
 * grille de depart de ce continental — sa qualification d'office l'y met
 * (`pool`) — mais il y arrive sans titre a defendre, donc sans finale acquise
 * et sans cinematique. Les deux mecanismes ne se croisent pas.
 *
 * `prive` porte l'exception d'activite : un tenant qui n'a plus joue un seul
 * duel classe DEPUIS SON SACRE perd ses privileges. On le rend quand meme,
 * avec la raison — l'appelant a besoin de savoir qu'il y avait un tenant et
 * qu'il a ete ecarte, sans quoi l'annonce ne peut pas le dire et personne ne
 * comprend pourquoi le champion est parti du fond de la grille.
 *
 * `maintenant` se passe explicitement : la mesure d'activite se prend a la
 * cloture annoncee, pas a l'instant ou le cron est passe.
 */
export async function tenantDuTitre(db, echelon, zone, maintenant = Date.now()) {
  await ensureChampTables(db);
  await ensureDuelTables(db);
  const r = await db.prepare(
    `SELECT t.id AS id, t.name_key AS cle, t.nom, t.libelle, t.echelon, t.zone,
            t.sacre_le, t.expire_le, t.edition AS edition_sacre,
            COALESCE(d.mmr, 0) AS force, d.palier AS palier, d.lp AS lp,
            d.updated_at AS vu_le,
            COALESCE(d.wins + d.losses + d.draws, 0) AS duels
       FROM champ_titres t LEFT JOIN duel_players d ON d.name_key = t.name_key
      WHERE t.echelon = ? AND t.zone = ? AND t.expire_le > ? AND t.revoque_le IS NULL
      ORDER BY t.sacre_le DESC
      LIMIT 1`
  ).bind(echelon, String(zone || '').toUpperCase(), maintenant).first();
  if (!r) return null;

  // « Actif depuis son sacre » se mesure sur `updated_at`, la meme colonne que
  // toute selection lit deja : un duel classe la met a jour, et rien d'autre
  // ne le fait. Un champion sacre a 19 h 20 dimanche a forcement un
  // `updated_at` anterieur a son sacre s'il n'a pas rejoue depuis — c'est
  // exactement la question posee.
  const actif = r.duels > 0 && Number(r.vu_le || 0) > Number(r.sacre_le);
  return {
    id: r.id,
    cle: r.cle, nom: r.nom, libelle: r.libelle,
    echelon: r.echelon, zone: r.zone,
    sacre_le: r.sacre_le, expire_le: r.expire_le, edition_sacre: r.edition_sacre,
    force: r.force, palier: r.palier, lp: r.lp,
    actif,
    prive: TENANT.actifDepuisLeSacre ? !actif : false,
  };
}

/**
 * Le libelle d'un titre : « Champion de France », « Champion d'Europe »,
 * « Champion du monde ».
 *
 * Une seule definition, deux lecteurs — le sacre qui l'inscrit en base, et
 * l'etat d'une edition qui le publie a l'ecran de la cinematique. Le composer
 * deux fois, c'est se garantir qu'un jour le titre affiche pendant la
 * competition ne sera pas celui inscrit apres.
 *
 * « Champion de {zone} » attend la forme avec preposition : de France, du
 * Maroc, des Etats-Unis. Le mondial, lui, n'a pas de zone a nommer.
 */
export function libelleTitre(echelon, zone) {
  const z = nomZone(zone, echelon);
  if (echelon === 'mondial') return ECHELONS.mondial.titre;
  return (ECHELONS[echelon].titre || '{zone}')
    .replace('Champion de {zone}', 'Champion ' + z.avec)
    .replace('Champion d’{zone}', 'Champion ' + z.avec)
    .replace('{zone}', z.nom);
}

/**
 * Le titre perdu s'eteint a la seconde ou la finale s'acheve.
 *
 * Rendu comme une requete plutot qu'execute, pour tenir dans le meme `batch`
 * que le sacre du nouveau champion : les deux faits — celui-ci gagne, celui-la
 * perd son statut — sont un seul evenement, et une base qui les enregistrerait
 * separement pourrait s'arreter entre les deux et laisser deux champions du
 * meme endroit.
 *
 * ON VISE L'IDENTIFIANT DE LA LIGNE, et c'est tout l'interet de cette
 * signature. La version d'avant visait le couple (echelon, zone) et la cle du
 * porteur — ce qui parait plus lisible et qui est faux : dans un `batch`, les
 * instructions s'executent dans l'ordre et sur la meme transaction, si bien
 * que l'UPDATE tombait aussi sur la ligne que l'INSERT venait de poser deux
 * instructions plus haut. Un champion qui CONSERVAIT son titre le perdait donc
 * — le nouveau et l'ancien d'un coup — et le pays se retrouvait sans champion.
 *
 * Le defaut ne se voyait que dans un cas : le tenant gagne sa finale. Tout le
 * reste du systeme passait.
 */
function revoquerTitre(db, id, maintenant) {
  return db.prepare(
    `UPDATE champ_titres SET revoque_le = ? WHERE id = ? AND revoque_le IS NULL`
  ).bind(maintenant, id);
}

/**
 * Sacre le vainqueur d'une finale et lui pose son titre pour trois mois.
 *
 * ET ETEINT CELUI DU TENANT. C'est la troisieme regle du champion en titre, et
 * elle s'applique dans le meme `batch` que le sacre : les deux faits — celui-ci
 * gagne, celui-la n'est plus champion — sont un seul evenement. Les enregistrer
 * separement laisserait une fenetre, courte mais reelle, ou deux joueurs
 * portent le meme titre ; et si la base s'arretait entre les deux, elle y
 * resterait trois mois.
 *
 * L'extinction est inconditionnelle, et c'est plus large que « il perd sa
 * finale » : un ancien champion elimine en demi-finale perd aussi son titre
 * quand un autre est sacre, tout simplement parce qu'il ne peut pas y avoir
 * deux champions de France en meme temps. Le cas ou son titre survit existe
 * quand meme, et c'est le bon : une edition ANNULEE ne sacre personne, donc
 * n'eteint rien — le tenant reste champion jusqu'a son echeance.
 *
 * `finalistes` sert a dire POURQUOI le titre est tombe, et rien d'autre. Perdre
 * une finale et etre depossede sans y avoir couru ne se racontent pas pareil.
 */
export async function sacrer(db, edition, gagnant, finalistes = null) {
  await ensureChampTables(db);
  const e = await db.prepare(
    `SELECT echelon, zone FROM champ_editions WHERE id = ?`).bind(edition).first();
  if (!e) return { erreur: 'edition introuvable' };

  const libelle = libelleTitre(e.echelon, e.zone);
  const maintenant = Date.now();
  const expire = new Date(maintenant);
  expire.setMonth(expire.getMonth() + TITRE_MOIS);

  // Le tenant tel qu'il est A CETTE SECONDE, et non celui gele a la cloture :
  // ici la question n'est plus « qui avait des privileges ce weekend » mais
  // « qui porte le titre que l'on vient de remettre en jeu ».
  const ancien = await tenantDuTitre(db, e.echelon, e.zone, maintenant);
  const detrone = ancien && ancien.cle !== gagnant.cle ? ancien : null;
  const conserve = ancien && ancien.cle === gagnant.cle ? ancien : null;

  const ecritures = [
    db.prepare(
      `INSERT INTO champ_titres (echelon, zone, name_key, nom, libelle, edition, sacre_le, expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.echelon, e.zone, gagnant.cle, gagnant.nom, libelle, edition, maintenant, expire.getTime()),
    db.prepare(
      `UPDATE champ_editions SET etat = 'terminee', champion_key = ?, champion_nom = ?, fini_le = ?
        WHERE id = ?`
    ).bind(gagnant.cle, gagnant.nom, maintenant, edition),
  ];

  // Le titre precedent s'eteint, que son porteur ait perdu la finale ou qu'il
  // ait ete depossede sans y courir. Le tenant qui CONSERVE son titre voit
  // aussi son ancienne ligne s'eteindre — il en a une neuve, avec une echeance
  // neuve, ce qui est exact : il vient de le regagner, il ne le prolonge pas.
  if (ancien) {
    ecritures.push(revoquerTitre(db, ancien.id, maintenant));
  }

  await db.batch(ecritures);

  await annoncer(db, {
    edition, echelon: e.echelon, zone: e.zone, type: 'sacre',
    titre: gagnant.nom + ' — ' + libelle,
    texte: conserve
      ? 'Titre conservé, porté ' + TITRE_MOIS + ' mois de plus.'
      : 'Titre porté ' + TITRE_MOIS + ' mois.',
    donnees: {
      champion: gagnant.nom, libelle, expire_le: expire.getTime(),
      // Le tenant a defendu son titre, ou l'a perdu. Les deux se racontent, et
      // c'est la moitie de ce que la regle du champion en titre apporte au
      // recit : un sacre qui detrone quelqu'un n'est pas un sacre ordinaire.
      titre_conserve: !!conserve,
      detrone: detrone ? detrone.nom : null,
      detrone_en_finale: detrone && Array.isArray(finalistes)
        ? finalistes.includes(detrone.cle) : null,
    },
  });

  return {
    libelle, champion: gagnant.nom, expire_le: expire.getTime(),
    titre_conserve: !!conserve,
    // `detrone` remonte a l'appelant : le harnais l'affiche, et le tableau de
    // bord des championnats en a besoin pour dire ce qui vient de changer.
    detrone: detrone
      ? {
          cle: detrone.cle, nom: detrone.nom, libelle: detrone.libelle,
          en_finale: Array.isArray(finalistes) ? finalistes.includes(detrone.cle) : null,
        }
      : null,
  };
}

/**
 * Le fil des annonces, pour la diffusion en direct.
 *
 * `depuis` est un identifiant, pas une date : un client qui a deja vu
 * l'annonce 412 demande la suite et recoit exactement ce qu'il n'a pas vu,
 * sans trou ni doublon meme si deux annonces tombent dans la meme milliseconde.
 * C'est ce qui permet a un ecran de rester ouvert un weekend entier.
 */
export async function fluxDirect(db, { zone = null, depuis = 0, limite = 50 } = {}) {
  await ensureChampTables(db);
  const z = zone ? String(zone).toUpperCase() : null;
  const { results } = await db.prepare(
    z
      ? `SELECT * FROM champ_annonces WHERE zone = ? AND id > ? ORDER BY id LIMIT ?`
      : `SELECT * FROM champ_annonces WHERE id > ? ORDER BY id LIMIT ?`
  ).bind(...(z ? [z, depuis, limite] : [depuis, limite])).all();

  const annonces = (results || []).map(r => ({
    id: r.id, edition: r.edition, echelon: r.echelon, zone: r.zone,
    zoneNom: nomZone(r.zone, r.echelon).nom,
    type: r.type, titre: r.titre, texte: r.texte,
    donnees: r.donnees ? JSON.parse(r.donnees) : null,
    au: r.au, pousser: !!r.pousser,
  }));
  return {
    annonces,
    curseur: annonces.length ? annonces[annonces.length - 1].id : depuis,
  };
}

/**
 * LE TABLEAU DES MEDAILLES PAR NATION.
 *
 * Le jeu savait deja qui avait gagne quoi, et sous quel drapeau. Il ne savait
 * pas l'additionner. C'est pourtant la seule chose qui fasse regarder un
 * championnat en se demandant ou en est SON pays plutot que ou en est son
 * pseudo — un classement individuel ne fabrique pas de clan.
 *
 * Deux choix demandent a etre dits.
 *
 * 1. LES MEDAILLES EXPIREES COMPTENT. `medaillesDe` filtre sur `expire_le`
 *    parce qu'elle repond a « qu'est-ce qu'il porte aujourd'hui » ; celle-ci
 *    repond a « qu'est-ce que ce pays a gagne », et un palmares ne se vide pas
 *    au bout de trois mois. C'est la meme distinction qu'entre un titre porte
 *    et la ligne qui reste en base apres lui.
 *
 * 2. LES MEDAILLES SANS PAYS NE SONT PAS RANGEES AILLEURS, elles sont
 *    COMPTEES A PART. Les repartir au prorata ou les taire donnerait un
 *    tableau dont la somme ne tombe pas juste, et personne ne saurait
 *    pourquoi. `sansPays` dit combien manquent ; le total, lui, est exact.
 */
export async function tableauNations(db, { echelon = null, epreuve = null } = {}) {
  await ensureChampTables(db);

  const args = [], ou = [];
  if (echelon) { ou.push('m.echelon = ?'); args.push(echelon); }
  if (epreuve) { ou.push('e.epreuve = ?'); args.push(epreuve); }
  const filtre = ou.length ? 'WHERE ' + ou.join(' AND ') : '';

  // `COALESCE(m.pays, p.pays)` : la medaille porte son drapeau depuis qu'elle
  // a une colonne pour ca ; celles d'avant retombent sur le pays actuel du
  // joueur, qui est la moins mauvaise reponse disponible pour elles.
  const { results } = await db.prepare(
    `SELECT COALESCE(m.pays, p.pays) AS pays,
            SUM(CASE WHEN m.place = 1 THEN 1 ELSE 0 END) AS o,
            SUM(CASE WHEN m.place = 2 THEN 1 ELSE 0 END) AS a,
            SUM(CASE WHEN m.place = 3 THEN 1 ELSE 0 END) AS b,
            COUNT(*) AS total,
            COUNT(DISTINCT m.name_key) AS athletes,
            MAX(m.obtenu_le) AS derniere
       FROM champ_medailles m
       LEFT JOIN player_pays p ON p.name_key = m.name_key
       LEFT JOIN champ_editions e ON e.id = m.edition
       ${filtre}
      GROUP BY COALESCE(m.pays, p.pays)`
  ).bind(...args).all();

  let sansPays = 0;
  const nations = [];
  for (const r of results || []) {
    if (!r.pays) { sansPays += r.total; continue; }
    nations.push({
      pays: String(r.pays).toUpperCase(),
      continent: continentDe(r.pays),
      or: r.o, argent: r.a, bronze: r.b,
      total: r.total,
      athletes: r.athletes,
      derniere: r.derniere,
    });
  }

  // L'ordre olympique : l'or d'abord, et aucune quantite d'argent ne rattrape
  // un or. Un classement au total ferait passer trois bronzes devant un titre
  // mondial, ce qu'aucun tableau des medailles n'a jamais fait.
  nations.sort((x, y) =>
    y.or - x.or || y.argent - x.argent || y.bronze - x.bronze
    || x.pays.localeCompare(y.pays));

  // Le rang est calcule ici et non a l'ecran, parce qu'il doit gerer les
  // ex aequo : deux pays au meme palmares portent le meme rang, et le suivant
  // saute d'autant. Laisser l'ecran numeroter les lignes donnerait un 4e et un
  // 5e a deux pays strictement egaux.
  let rang = 0, vus = 0, precedent = null;
  for (const n of nations) {
    vus += 1;
    const cle = `${n.or}/${n.argent}/${n.bronze}`;
    if (cle !== precedent) { rang = vus; precedent = cle; }
    n.rang = rang;
  }

  return {
    echelon: echelon || null,
    epreuve: epreuve || null,
    nations,
    sansPays,
    medailles: nations.reduce((s, n) => s + n.total, 0) + sansPays,
  };
}

/**
 * Le recapitulatif mondial : qui court, qui vient d'etre sacre.
 *
 * L'ecran existe pour une raison precise — un joueur seul devant sa course ne
 * voit pas qu'il participe a quelque chose de mondial. Cette vue le lui montre :
 * les editions en cours partout, et les champions qui tombent un par un.
 */
export async function recapMondial(db, { echelon = null } = {}) {
  await ensureChampTables(db);
  const args = [], ou = [];
  if (echelon) { ou.push('echelon = ?'); args.push(echelon); }
  const filtre = ou.length ? 'WHERE ' + ou.join(' AND ') : '';

  const { results: editions } = await db.prepare(
    `SELECT id, echelon, zone, epreuve, debut, cloture, phase, etat,
            champion_nom, fini_le
       FROM champ_editions ${filtre} ORDER BY debut DESC, zone`
  ).bind(...args).all();

  // Quatre etats, quatre sorts. Ranger tout ce qui n'est pas termine dans
  // « en cours » etait juste tant qu'il n'y avait que deux etats ; ca ne l'est
  // plus. Une edition annoncee ne court pas encore, une edition annulee ne
  // courra pas — les compter parmi celles qui courent afficherait des
  // competitions qui n'ont pas lieu.
  const annoncees = [], encours = [], sacres = [], annulees = [];
  for (const e of editions || []) {
    const z = nomZone(e.zone, e.echelon);
    const ligne = {
      edition: e.id, echelon: e.echelon, zone: e.zone, zoneNom: z.nom,
      epreuve: e.epreuve || EPREUVE_DEFAUT,
      debut: e.debut, phase: e.phase,
      cloture: e.cloture ?? null,
      // L'etat manquait, et le tableau de bord le lisait quand meme : son
      // `e.etat === 'terminee'` etait donc toujours faux, et toute edition
      // s'affichait « en cours ». Le defaut ne se voyait pas tant que la seule
      // autre possibilite etait d'etre effectivement en cours.
      etat: e.etat,
    };
    if (e.etat === 'terminee') sacres.push({ ...ligne, champion: e.champion_nom, fini_le: e.fini_le });
    else if (e.etat === 'annoncee') annoncees.push(ligne);
    else if (e.etat === 'annulee') annulees.push(ligne);
    else encours.push(ligne);
  }
  sacres.sort((a, b) => (b.fini_le || 0) - (a.fini_le || 0));
  // Les prochaines d'abord : ce bloc sert a donner envie d'y etre.
  annoncees.sort((a, b) => a.debut - b.debut);

  return {
    // `annoncees` est le seul endroit du recapitulatif qui parle a qui n'est
    // pas encore selectionne — c'est-a-dire au plus grand nombre.
    annoncees, encours, sacres, annulees,
    // Une edition annulee ne compte pas dans le total : elle n'a pas eu lieu.
    total: annoncees.length + encours.length + sacres.length,
    termines: sacres.length,
  };
}

export { FORMAT, ECHELONS, TITRE_MOIS, CALENDRIER, qualifier, podium, calendrier };
