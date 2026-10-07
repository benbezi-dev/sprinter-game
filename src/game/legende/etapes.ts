// LES SIX ETAPES DE LA LEGENDE — ou l'on court, contre qui, et comment on y va.
//
// La meme echelle que la carriere classique (LEVELS, sprinter-core.js) : la
// cour d'ecole, le regional, le national, le mondial, 0.Games, l'apotheose.
// Ce qui change, c'est le monde autour. Chaque etape a un LIEU reel, que la
// carte situe, et un BOSS — un adversaire par plateau, qu'on reconnait en
// ombre chinoise, a la maniere de Street Fighter (decision de l'auteur,
// 6 octobre 2026).
//
// Le regional, le national et le mondial se TIRENT AU SORT, une fois par
// carriere : trois lieux chacun (game/legende/tirage.ts). Une etape tiree garde son
// lieu tant que la carriere dure — recommencer une course ne relance pas le
// de.
//
// LES BOSS SONT PROVISOIRES tant que l'auteur n'a pas valide leur casting
// (projets/carriere-legende/PLAN.md, §5) : leurs noms vivent ici et nulle part
// ailleurs, pour qu'en changer ne touche qu'une ligne.
//
// Les noms des lieux et des boss sont des noms propres : ils ne se traduisent
// pas. Ce qui se traduit — l'intitule de l'etape — est en [francais, anglais],
// comme le reste du jeu.

export type Transport = 'velo' | 'voiture' | 'car' | 'avion' | 'fusee';

export type Lieu = {
  cle: string;
  /** Le nom affiche sur la carte. */
  nom: string;
  pays: string;
  /** Code ISO du drapeau, '' quand le lieu n'est pas sur Terre. */
  drapeau: string;
  /** Latitude et longitude, en degres ; null hors de la Terre. */
  geo: [number, number] | null;
  /** Le stade du moteur qu'on y court, en attendant le decor du lieu. */
  theme: string;
  boss: string;
  /** Surnom du boss, en [francais, anglais]. */
  surnom: [string, string];
  /** Sa presentation, en [francais, anglais] : qui il est, d'ou il vient. */
  bio: [string, string];
  /**
   * Ce qu'il dit en arrivant, DANS SA LANGUE (`vo`), puis traduit. `vo` vide :
   * il parle la langue du joueur. La bulle ne porte que `vo` (ou la replique
   * dans la langue du joueur) : elle tient en DEUX lignes, et sa police grandit
   * avec le plan serre de l'entree — une trentaine de caracteres au plus. La
   * traduction passe dans le bandeau de presentation pendant qu'il parle.
   * Les repliques en langue etrangere sont a faire relire par quelqu'un qui
   * la parle avant toute ouverture.
   */
  replique: { vo: string; fr: string; en: string };
  /** Son entree, propre a lui et a sa culture (game/legende/entrees.ts). */
  entree: string;
  /** Les six autres couloirs. */
  plateau: string[];
};

export type Etape = {
  /** 0 a 5, comme `G.levelIdx` en carriere. */
  rang: number;
  intitule: [string, string];
  /** Le moyen d'ARRIVER a cette etape (decision de l'auteur). */
  transport: Transport;
  /** Un lieu, ou trois entre lesquels tirer. */
  lieux: Lieu[];
};

const MENOLE: Lieu = {
  cle: 'menole', nom: 'Plage de Menolé', pays: 'San-Pédro, Côte d’Ivoire', drapeau: 'ci',
  // San-Pedro, sur la parole de l'auteur : « Menole » ne sort d'aucune carte
  // en ligne. La cote de la ville, a quelques centaines de metres pres.
  geo: [4.75, -6.64],
  theme: 'riviera',
  boss: 'Kouassi', surnom: ['Le Crabe', 'The Crab'],
  // Le roi de la plage : il arrive de cote, en crabe, les pinces ouvertes —
  // c'est d'ou lui vient son nom — puis montre la ligne. « Y a pas drap » :
  // « pas de probleme », en francais de Cote d'Ivoire. A FAIRE RELIRE.
  bio: ['12 ans. Invaincu sur le sable de Menolé depuis trois saisons. Toujours pieds nus.',
        '12 years old. Unbeaten on the sand of Menolé for three seasons. Always barefoot.'],
  replique: { vo: 'Y a pas drap !', fr: 'Pas de souci ! Le sable, c’est chez moi.', en: 'No worries! The sand is my home.' },
  entree: 'crabe',
  plateau: ['Aya Koffi', 'Yao Kouamé', 'Adjoua Brou', 'Ismaël Traoré', 'Affoué Yapi', 'Moussa Coulibaly'],
};

const KYOTO: Lieu = {
  cle: 'kyoto', nom: 'Kyoto', pays: 'Japon', drapeau: 'jp',
  geo: [35.01, 135.77],
  theme: 'day',
  boss: 'Sora Kanzaki', surnom: ['Kitsune', 'Kitsune'],
  // Il entre sans un mot de trop : il s'arrete a la ligne, salue d'une
  // reverence (le rei, a trente degres), ferme les yeux, puis les rouvre sur
  // l'arrivee. Le renard (kitsune) est le messager d'Inari, dont le sanctuaire
  // de Fushimi est son terrain d'entrainement. Devise inventee pour lui :
  // « kitsune wa furikaeranai ». A FAIRE RELIRE.
  bio: ['24 ans. Il s’entraîne à l’aube dans les escaliers de Fushimi Inari, sous les milliers de torii.',
        '24. He trains at dawn on the steps of Fushimi Inari, under thousands of torii gates.'],
  // (sans le point final : la bulle coupe le japonais a la lettre, et le
  // « 。 » passait seul a la ligne)
  replique: { vo: '狐は振り返らない', fr: 'Le renard ne se retourne jamais.', en: 'The fox never looks back.' },
  entree: 'reverence',
  plateau: ['Haruto Sato', 'Yuto Suzuki', 'Sota Takahashi', 'Riku Tanaka', 'Aoi Watanabe', 'Kaito Ito'],
};

// LE REGIONAL SE TIRE AUSSI (l'auteur, 06/10 : « dans le niveau deux ajoute
// aussi en destination la Jamaique, Kingston, et un pays de l'Asie mineure »).
// Kyoto, Kingston ou Izmir — piste classique, et pour le decor les monuments
// de chacune, comme aux autres etapes.
//
// L'ASIE MINEURE, C'EST L'ANATOLIE, et Izmir y est tout entiere, Ephese a une
// heure de route. Istanbul aurait parle plus vite au joueur, mais ses grands
// monuments — Sainte-Sophie, la Mosquee bleue — sont sur la rive europeenne
// du Bosphore : ce n'est plus l'Asie mineure.
const KINGSTON: Lieu = {
  cle: 'kingston', nom: 'Kingston', pays: 'Jamaïque', drapeau: 'jm',
  geo: [17.97, -76.79],
  theme: 'day',
  boss: 'Damion Clarke', surnom: ['Tallawah', 'Tallawah'],
  // « Tallawah » : petit mais coriace, en patois jamaicain. Il arrive en
  // rebondissant, quelques pas de dancehall, les epaules qui roulent, puis
  // montre la ligne. Rien de la pose d'un recordman du monde jamaicain : elle
  // est a lui. Sa replique est la devise que tout le pays connait. A FAIRE
  // RELIRE.
  bio: ['23 ans, de Kingston. Il a gagné Champs — le championnat des écoles, au National Stadium — trois années de suite.',
        '23, from Kingston. He won Champs — the schools’ championship at the National Stadium — three years running.'],
  replique: { vo: 'We likkle but we tallawah!', fr: 'Petits, mais costauds !', en: 'We’re small, but mighty!' },
  entree: 'dancehall',
  plateau: ['Kemar Brown', 'Javon Henry', 'Romario Grant', 'Tajay Lewis', 'Kimone Bailey', 'Odane Miller'],
};
const IZMIR: Lieu = {
  cle: 'izmir', nom: 'İzmir', pays: 'Turquie — Asie mineure', drapeau: 'tr',
  geo: [38.42, 27.14],
  theme: 'day',
  boss: 'Kerem Aydın', surnom: ['Zeybek', 'Zeybek'],
  // Le zeybek, la danse de la mer Egee et de ses guerriers : les bras ouverts
  // comme un aigle, des pas lents, une claque sur la cuisse, un genou a terre,
  // et l'on se releve. Une danse populaire, pas un rite. A FAIRE RELIRE.
  bio: ['26 ans, d’İzmir. Il court sur le Kordon au lever du soleil, face à la mer Égée.',
        '26, from İzmir. He runs along the Kordon at sunrise, facing the Aegean Sea.'],
  replique: { vo: 'Hadi bakalım!', fr: 'Allez, on y va !', en: 'Come on, let’s go!' },
  entree: 'zeybek',
  plateau: ['Emre Yılmaz', 'Burak Demir', 'Mert Kaya', 'Can Öztürk', 'Elif Şahin', 'Oğuz Çelik'],
};

// Le national garde la piste rouge du jeu de base, au bit pres : c'est la
// consigne, et c'est le theme `day` qui la porte (trackA 138,10,10).
const BARCELONE: Lieu = {
  cle: 'barcelone', nom: 'Barcelone', pays: 'Espagne', drapeau: 'es',
  geo: [41.39, 2.17],
  theme: 'day',
  boss: 'Marc Puig', surnom: ['Trencadís', 'Trencadís'],
  // Ancien casteller : a la ligne, il leve la main ouverte tout la-haut, le
  // geste de l'enxaneta qui couronne un castell (« fer l'aleta »). Sa replique
  // est la devise des castellers. A FAIRE RELIRE.
  bio: ['26 ans. Né à deux rues de la Sagrada Família. Enfant, il montait tout en haut des castells.',
        '26. Born two streets from the Sagrada Família. As a child, he climbed to the very top of the castells.'],
  replique: { vo: 'Força, equilibri, valor i seny!', fr: 'Force, équilibre, courage et sagesse !',
              en: 'Strength, balance, courage and good sense!' },
  entree: 'enxaneta',
  plateau: ['Pablo Ruiz', 'Javier Morales', 'Sergio Navarro', 'Iker Romero', 'Lucía Torres', 'Adrián Gil'],
};
const CASABLANCA: Lieu = {
  cle: 'casablanca', nom: 'Casablanca', pays: 'Maroc', drapeau: 'ma',
  geo: [33.57, -7.59],
  theme: 'day',
  boss: 'Yassine Benali', surnom: ['L’Atlas', 'The Atlas'],
  // Grand et calme : la main sur le coeur et un signe de tete vers les
  // tribunes — le salut qu'on se fait partout au Maroc —, puis la main en
  // visiere, comme on regarde un sommet : il regarde l'arrivee. Replique en
  // darija. A FAIRE RELIRE.
  bio: ['27 ans. Il a appris à courir dans les montées de l’Atlas, au-dessus d’Imlil, avant de descendre sur la corniche de Casablanca.',
        '27. He learned to run on the climbs of the Atlas above Imlil, before coming down to the Casablanca corniche.'],
  replique: { vo: 'Yallah, nchoufou chkoun lwel!', fr: 'Allez, on va voir qui est le premier !',
              en: 'Come on, let’s see who comes first!' },
  entree: 'atlas',
  plateau: ['Hamza El Idrissi', 'Ayoub Bennani', 'Omar Tazi', 'Mehdi Alaoui', 'Salma Berrada', 'Anas Chraibi'],
};
const ABUJA: Lieu = {
  cle: 'abuja', nom: 'Abuja', pays: 'Nigeria', drapeau: 'ng',
  geo: [9.06, 7.49],
  theme: 'day',
  boss: 'Chidi Okafor', surnom: ['Zuma', 'Zuma'],
  // Il arrive en dansant, quelques pas de legwork — la danse des clips
  // d'afrobeats —, roule des epaules, montre le ciel puis la ligne. Replique
  // en pidgin du Nigeria. A FAIRE RELIRE.
  bio: ['25 ans. Il court au pied de Zuma Rock, « la porte d’Abuja ». Casque sur les oreilles, toujours de l’afrobeats.',
        '25. He runs at the foot of Zuma Rock, "the gateway to Abuja". Headphones on, always afrobeats.'],
  replique: { vo: 'No shaking! Na my race.', fr: 'T’inquiète ! Cette course, elle est à moi.',
              en: 'No worries! This race is mine.' },
  entree: 'legwork',
  plateau: ['Emeka Nwosu', 'Tunde Adeyemi', 'Ibrahim Musa', 'Segun Bakare', 'Ngozi Eze', 'Femi Olawale'],
};

// Le mondial passe sur la piste bleue : celle du theme `mondiaux`
// (trackA 21,70,158). Paris court deja au Champ-de-Mars, sa tour comprise.
const PARIS: Lieu = {
  cle: 'paris', nom: 'Paris', pays: 'France', drapeau: 'fr',
  geo: [48.86, 2.35],
  theme: 'mondiaux',
  boss: 'Théo Garnier', surnom: ['Le Dandy', 'The Dandy'],
  // Le flaneur : il arrive sans se presser, ajuste son foulard des deux mains,
  // leve un pied derriere lui pour verifier le reflet de sa pointe, et hoche
  // la tete, satisfait.
  bio: ['29 ans. Champion de France en titre. Il court en foulard de soie — « pour l’élégance, et pour savoir d’où vient le vent ».',
        '29. Reigning French champion. He races in a silk scarf — "for elegance, and to know where the wind comes from".'],
  replique: { vo: '', fr: 'Le style, ça ne s’apprend pas.', en: 'Style can’t be taught.' },
  entree: 'dandy',
  plateau: ['Hugo Lambert', 'Yanis Haddad', 'Jules Mercier', 'Inès Marchand', 'Bastien Roche', 'Ibrahim Diallo'],
};
const NEW_YORK: Lieu = {
  cle: 'newyork', nom: 'New York', pays: 'États-Unis', drapeau: 'us',
  geo: [40.71, -74.01],
  theme: 'mondiaux',
  boss: 'Jayden Brooks', surnom: ['Empire', 'Empire'],
  // A la ligne, il prend la pose de la statue de la Liberte — le bras droit
  // tendu au ciel comme la torche, l'autre serrant la tablette contre lui —,
  // puis montre l'arrivee.
  bio: ['26 ans, du Bronx. Il s’entraîne la nuit à l’Icahn Stadium, face aux lumières de Manhattan.',
        '26, from the Bronx. He trains at night at Icahn Stadium, facing the lights of Manhattan.'],
  replique: { vo: 'Welcome to my city.', fr: 'Bienvenue dans ma ville.', en: 'Welcome to my city.' },
  entree: 'liberte',
  plateau: ['Tyler Johnson', 'Marcus Reed', 'Andre Williams', 'Kevin Ortiz', 'Brianna Lewis', 'Darius Carter'],
};
const LONDRES: Lieu = {
  cle: 'londres', nom: 'Londres', pays: 'Royaume-Uni', drapeau: 'gb',
  geo: [51.51, -0.13],
  theme: 'mondiaux',
  boss: 'Oliver Hart', surnom: ['Big Ben', 'Big Ben'],
  // Ponctuel : il arrive d'un pas mesure, consulte sa montre a gousset, la
  // referme d'un coup sec, puis salue d'un chapeau qu'il n'a pas. « Mind the
  // gap », l'annonce du metro de Londres — l'ecart, c'est lui qui le fera.
  bio: ['31 ans. Jamais une seconde de retard — ni sur un train, ni sur une ligne d’arrivée.',
        '31. Never a second late — not for a train, not for a finish line.'],
  replique: { vo: 'Mind the gap.', fr: 'Attention à l’écart.', en: 'Mind the gap.' },
  entree: 'montre',
  plateau: ['Harry Collins', 'Jamal Okoye', 'George Whitaker', 'Callum Reid', 'Amelia Grant', 'Kwame Asante'],
};

// La ligne de Karman : cent kilometres au-dessus de la ville du mondial. Le
// plateau est celui des coureurs de la mythologie, le boss le plus rapide des
// dieux grecs.
const KARMAN: Lieu = {
  cle: 'karman', nom: 'Ligne de Kármán', pays: '100 km', drapeau: '',
  geo: null,
  // Un paysage dans les nuages, pas l'espace (l'auteur, 07/10, images a
  // l'appui) : le stade de jour, repeint en ciel rose, nuages, marbre et or
  // (THEME_DU_LIEU, stades.ts), la cite celeste au loin (decors.ts).
  theme: 'day',
  boss: 'Hermès', surnom: ['Le Messager', 'The Messenger'],
  // Il ne marche pas jusqu'a la ligne : il y descend du ciel, les bras
  // ouverts, et s'y pose sur la pointe des pieds. Le jour de sa naissance il
  // volait deja les boeufs d'Apollon (Hymne homerique a Hermes). Replique en
  // grec ancien : « okus hos anemos ». A FAIRE RELIRE.
  bio: ['Messager des dieux, le plus rapide de l’Olympe. Le jour de sa naissance, il volait déjà les bœufs d’Apollon.',
        'Messenger of the gods, the fastest on Olympus. On the day he was born, he was already stealing Apollo’s cattle.'],
  replique: { vo: 'Ὠκὺς ὡς ἄνεμος.', fr: 'Rapide comme le vent.', en: 'Swift as the wind.' },
  entree: 'descente',
  plateau: ['Atalante', 'Hippomène', 'Achille', 'Iris', 'Ladas', 'Phidippidès'],
};

// L'OLYMPE A QUATRE MAITRES POSSIBLES (l'auteur, 06/10 : « pour l'Olympe mets
// 4 dieux possibles : 1 europeen, 1 asiatique, 1 africain, 1 sud-americain —
// l'europeen c'est deja Hermes »). Le meme lieu, tire au sort comme les
// villes : seul le maitre des lieux change. Ceux d'Asie, d'Afrique et
// d'Amerique du Sud sont ceux des pantheons valides le 06/10.
const KARMAN_WUKONG: Lieu = {
  ...KARMAN, cle: 'karman-wukong',
  boss: 'Sun Wukong', surnom: ['Le Roi Singe', 'The Monkey King'],
  // Ne d'un rocher, le heros du « Voyage vers l'Ouest » : d'un seul saut
  // perilleux sur son nuage, il franchit cent huit mille li. Il arrive en
  // bondissant, tourne sur lui-meme et prend sa pose — la main en visiere, un
  // genou leve. Sa replique est sa formule d'entree : « le vieux Sun est la ! »
  // A FAIRE RELIRE.
  bio: ['Le Roi Singe, né d’un rocher. D’un seul saut périlleux sur son nuage, il franchit cent huit mille li.',
        'The Monkey King, born from a rock. A single somersault on his cloud carries him a hundred and eight thousand li.'],
  replique: { vo: '俺老孙来也！', fr: 'Le vieux Sun est arrivé !', en: 'Old Sun has arrived!' },
  entree: 'nuage',
};
const KARMAN_ANANSI: Lieu = {
  ...KARMAN, cle: 'karman-anansi',
  boss: 'Anansi', surnom: ['L’Araignée', 'The Spider'],
  // L'araignee des contes akan : il a achete toutes les histoires du monde au
  // dieu du ciel, et voulu cacher toute la sagesse dans une jarre — d'ou le
  // proverbe qu'il dit en arrivant (« Ti korɔ nkɔ agyina », releve dans les
  // 50 proverbes akan d'adinkrasymbols.org, le 07/10 : la forme d'abord
  // ecrite, « Nyansa nni baako tirim », ne s'y trouvait pas). Il descend du
  // ciel au bout de son fil, agite l'index, salue la main sur le coeur.
  // A FAIRE RELIRE par un locuteur twi.
  bio: ['L’Araignée des contes akan. Il a acheté toutes les histoires du monde au dieu du ciel, et voulu cacher toute la sagesse dans une jarre.',
        'The Spider of the Akan tales. He bought all the world’s stories from the sky god, and tried to hide all wisdom in a pot.'],
  replique: { vo: 'Ti korɔ nkɔ agyina.', fr: 'Une seule tête ne tient pas conseil.', en: 'One head alone does not hold council.' },
  entree: 'fil',
};
const KARMAN_INTI: Lieu = {
  ...KARMAN, cle: 'karman-inti',
  boss: 'Inti', surnom: ['Le Soleil', 'The Sun'],
  // Le soleil des Incas, pere du premier Inca ; chaque juin Cusco fete son
  // retour, l'Inti Raymi. Il est a genoux a la ligne quand la camera arrive,
  // et se leve en ouvrant les bras au ciel. Replique en quechua. A FAIRE
  // RELIRE.
  bio: ['Le dieu soleil des Incas, père du premier Inca. Chaque juin, Cusco fête son retour : l’Inti Raymi.',
        'The sun god of the Incas, father of the first Inca. Every June, Cusco celebrates his return: the Inti Raymi.'],
  replique: { vo: 'Ñuqa Inti kani.', fr: 'Je suis le Soleil.', en: 'I am the Sun.' },
  entree: 'soleil',
};

const APOTHEOSE: Lieu = {
  cle: 'apotheose', nom: 'Apothéose', pays: 'Galaxie', drapeau: '',
  geo: null,
  theme: 'cosmos',
  boss: 'Zénith', surnom: ['L’Astre', 'The Star'],
  // Ne d'une etoile : il descend lentement de tres haut et s'ouvre en V,
  // les bras au ciel, quand il touche la piste.
  bio: ['Né de la poussière d’une étoile. Personne ne l’a jamais vu courir : on n’a vu que la lumière qu’il laisse derrière lui.',
        'Born from the dust of a star. No one has ever seen him run, only the light he leaves behind.'],
  replique: { vo: '', fr: 'Je suis l’arrivée.', en: 'I am the finish line.' },
  entree: 'astre',
  plateau: ['Sirius', 'Orion', 'Nova', 'Pulsar', 'Andromède', 'Comète'],
};

export const ETAPES: Etape[] = [
  { rang: 0, intitule: ['L’innocence', 'Innocence'], transport: 'velo', lieux: [MENOLE] },
  { rang: 1, intitule: ['Régional', 'Regional'], transport: 'voiture', lieux: [KYOTO, KINGSTON, IZMIR] },
  { rang: 2, intitule: ['National', 'National'], transport: 'car', lieux: [BARCELONE, CASABLANCA, ABUJA] },
  { rang: 3, intitule: ['Mondial', 'World'], transport: 'avion', lieux: [PARIS, NEW_YORK, LONDRES] },
  { rang: 4, intitule: ['0.Games', '0.Games'], transport: 'fusee', lieux: [KARMAN, KARMAN_WUKONG, KARMAN_ANANSI, KARMAN_INTI] },
  { rang: 5, intitule: ['L’apothéose', 'Apotheosis'], transport: 'fusee', lieux: [APOTHEOSE] },
];

/**
 * D'ou part le joueur, avant la premiere etape : le quartier, a velo jusqu'a la
 * plage. La carte de la premiere etape ne traverse donc pas le monde — elle
 * longe la cote de San-Pedro.
 */
export const DEPART: Lieu = {
  ...MENOLE, cle: 'quartier', nom: 'San-Pédro', geo: [4.76, -6.62],
};
