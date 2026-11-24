/* ---------------------------------------------------------------------------
   LES LISTES DU FILTRE DES PSEUDOS — des donnees, aucune logique
   ---------------------------------------------------------------------------
   La logique vit dans `pseudo.js`. Ce fichier ne contient que des mots : on
   l'enrichit sans toucher a rien d'autre. Le jeu importe CE MEME fichier
   (src/game/pseudo.ts) : un ajout ici vaut des deux cotes, au prochain
   deploiement du worker et du jeu.

   Comment ecrire une entree :
   - en minuscules, sans accents, sans espaces : « enculé » s'ecrit
     « encule ». La normalisation fait le reste (casse, accents, leet,
     lettres repetees, separateurs, sosies cyrilliques).
   - `mots` : refuses quand ils forment un MOT ENTIER du pseudo, pluriel en -s
     compris. « con » refuse « Jules le con » et laisse « Conrad », « Second ».
   - `morceaux` : refuses meme colles dans le pseudo (« elisepedale »). Un
     morceau doit etre relu contre les mots innocents qui le contiennent ; si
     l'un d'eux existe, on l'ajoute a `BLANCHE` plutot que de renoncer.

   Les langues : celle du pays du joueur, plus toujours le francais et
   l'anglais — les deux langues du jeu et de son public. Sans pays connu, le
   francais et l'anglais seuls.
--------------------------------------------------------------------------- */

/** Toujours appliquees, quel que soit le pays : les langues du jeu. */
export const LANGUES_TOUJOURS = ['fr', 'en'];

/** Le pays (ISO 3166 alpha-2, comme `player_pays`) donne la langue. */
export const PAYS_LANGUE = {
  // francophones (le francais est deja toujours la)
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', ML: 'fr',
  BF: 'fr', NE: 'fr', GN: 'fr', BJ: 'fr', TG: 'fr', GA: 'fr', CG: 'fr', CD: 'fr',
  HT: 'fr', MG: 'fr', RE: 'fr', GP: 'fr', MQ: 'fr', GF: 'fr', NC: 'fr', PF: 'fr',
  CA: 'fr', CH: 'de',
  // Maghreb et monde arabe : l'arabe ecrit en lettres latines (« arabizi »)
  MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', EG: 'ar', SA: 'ar', AE: 'ar', QA: 'ar',
  KW: 'ar', BH: 'ar', OM: 'ar', JO: 'ar', LB: 'ar', SY: 'ar', IQ: 'ar', MR: 'ar',
  // hispanophones
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es',
  GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es',
  CR: 'es', PA: 'es', UY: 'es', PR: 'es',
  // lusophones
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt',
  // germanophones
  DE: 'de', AT: 'de', LI: 'de',
  // italophones
  IT: 'it', SM: 'it', VA: 'it',
  // neerlandophones
  NL: 'nl', SR: 'nl',
  // anglophones (l'anglais est deja toujours la)
  US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en', ZA: 'en', NG: 'en', GH: 'en',
  KE: 'en', JM: 'en', IN: 'en',
};

export const LISTES = {
  fr: {
    mots: [
      // insultes et vulgarite
      'con', 'conne', 'connard', 'conard', 'connasse', 'conasse', 'salope', 'salop',
      'salaud', 'pute', 'putain', 'ptn', 'pouffiasse', 'poufiasse', 'encule',
      'enculee', 'enculer', 'enculeur', 'batard', 'batarde', 'fdp', 'ntm', 'nique',
      'niquer', 'niquez', 'niques', 'nik', 'niker', 'tg', 'ftg', 'merde', 'merdeux',
      'merdeuse', 'trouduc', 'enfoire', 'enfoiree', 'abruti', 'abrutie', 'cretin',
      'cretine', 'gogol', 'triso', 'debile', 'chiasse', 'caca', 'cacas',
      'tamere', 'tonpere',
      // sexuel
      'bite', 'teub', 'zob', 'zizi', 'couille', 'couilles', 'chatte', 'cul',
      'nichon', 'nichons', 'seins', 'nibard', 'nibards', 'branleur', 'branleuse',
      'branlette', 'branler', 'suce', 'sucer', 'suceur', 'suceuse', 'gobeuse', 'gobeur', 'avaleuse', 'foutre', 'porno', 'baise', 'baiser',
      'baiseur', 'baiseuse', 'sodomie', 'sodomiser', 'fellation', 'turlute',
      'partouze', 'orgie', 'orgasme', 'sexe', 'sexy', 'gode', 'godemiche', 'string',
      'tanga', 'cochonne', 'chaudasse', 'salace', 'bandant', 'bandante', 'bander',
      'ejacule', 'sperme', 'clito', 'vagin', 'penis', 'pedale', // injures racistes, antisemites, homophobes
      'pd', 'pede', 'tapette', 'tarlouze', 'tafiole', 'gouine', 'negre', 'negresse',
      'bougnoule', 'bougnoul', 'bicot', 'youpin', 'youpine', 'chinetoque', 'bamboula',
      'nazi', 'nazie', 'hitler', 'zamel', 'zemel', 'kahba', 'zebi',
    ],
    morceaux: [
      'connard', 'connasse', 'encule', 'salope', 'salaud', 'putain', 'pute',
      'pouffiasse', 'batard', 'filsdepute', 'niquetamere', 'niquetonpere',
      'niquetarace', 'nikmok', 'niktamere', 'niquer', 'niquez', 'tagueule',
      'suicidetoi', 'branleur', 'branleuse', 'branlette', 'suceuse', 'suceur',
      'gobeuse', 'avaleuse', 'sodomi', 'fellation', 'partouze', 'pedale', 'enfoire',
      'trouduc', 'tarlouze', 'tafiole', 'tapette', 'bougnoul', 'chinetoque',
      'youpin', 'negresse', 'hitler', 'caca', 'string', 'sexe', 'porno', 'nichon',
      'zizi', 'couille', 'tamere', 'tonpere', 'tesmorts', 'grossebite', 'mabite',
      'tabite', 'chaudasse', 'cochonne', 'merdeux', 'merdeuse', 'chiasse',
    ],
  },
  en: {
    mots: [
      'fuck', 'fucked', 'fucker', 'fucking', 'fuckin', 'fck', 'motherfucker',
      'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'bastard', 'ass',
      'asshole', 'arsehole', 'arse', 'dick', 'dickhead', 'cock', 'cunt', 'pussy',
      'whore', 'hoe', 'slut', 'slutty', 'fag', 'faggot', 'nigger', 'nigga',
      'retarded', 'twat', 'wanker', 'wank', 'prick', 'porn', 'porno',
      'sex', 'sexy', 'boobs', 'boob', 'tits', 'titties', 'nude', 'nudes', 'horny',
      'milf', 'dildo', 'cum', 'jizz', 'blowjob', 'handjob', 'anal', 'penis',
      'vagina', 'thong', 'rapist', 'kys', 'stfu', 'gtfo', 'nazi', 'hitler',
      'kkk', 'xxx', 'hentai', 'orgy', 'pedo', 'pedophile', 'incest',
    ],
    morceaux: [
      'fuck', 'shit', 'bitch', 'asshole', 'arsehole', 'cunt', 'nigger', 'nigga',
      'faggot', 'whore', 'dickhead', 'motherf', 'wanker', 'porn', 'blowjob',
      'handjob', 'dildo', 'boobs', 'titties', 'penis', 'vagina', 'rapist', 'hentai',
      'pedophil', 'killyourself', 'siegheil', 'hitler', 'xxx', 'milf', 'horny',
      'jizz', 'sexy', 'cumshot', 'deepthroat', 'thong',
    ],
  },
  es: {
    mots: [
      'puta', 'puto', 'putas', 'mierda', 'cabron', 'cabrona', 'pendejo', 'pendeja',
      'gilipollas', 'polla', 'cono', 'joder', 'jodete', 'follar', 'maricon',
      'marica', 'zorra', 'culo', 'chingada', 'chingar', 'verga', 'mamon',
      'mamada', 'boludo', 'pelotudo', 'hijueputa', 'malparido', 'tetas',
      ],
    morceaux: [
      'gilipollas', 'hijodeputa', 'hijoputa', 'hijueputa', 'pendejo', 'maricon',
      'chingada', 'malparido', 'pelotudo', 'mierda', 'cabron', 'putamadre',
    ],
  },
  pt: {
    mots: [
      'porra', 'caralho', 'buceta', 'puta', 'foda', 'foder', 'fodase', 'viado',
      'merda', 'arrombado', 'otario', 'cuzao', 'xota', 'xoxota',
      'punheta', 'safado', 'safada', 'vadia', ],
    morceaux: [
      'caralho', 'buceta', 'arrombado', 'filhodaputa', 'punheta', 'xoxota',
      'cuzao', 'fodase', 'vaisefoder',
    ],
  },
  it: {
    mots: [
      'cazzo', 'vaffanculo', 'stronzo', 'stronza', 'puttana', 'troia', 'minchia',
      'coglione', 'figa', 'frocio', 'fanculo', 'bastardo', 'merda', 'culo',
      'zoccola', 'mignotta', 'pompino', 'tette',
    ],
    morceaux: [
      'cazzo', 'vaffanculo', 'stronzo', 'stronza', 'puttana', 'coglion', 'minchia',
      'zoccola', 'mignotta', 'pompino', 'figliodiputtana',
    ],
  },
  de: {
    mots: [
      'scheisse', 'arschloch', 'arsch', 'fotze', 'wichser', 'hurensohn', 'hure',
      'schlampe', 'ficken', 'fick', 'missgeburt', 'schwuchtel', 'spast', 'spasti',
      'titten', 'muschi', 'schwanz', 'nutte', 'kanake', 'neger', ],
    morceaux: [
      'scheisse', 'arschloch', 'fotze', 'wichser', 'hurensohn', 'schlampe',
      'schwuchtel', 'missgeburt', 'fickdich', 'nutte', 'kanake', 'siegheil',
    ],
  },
  nl: {
    mots: [
      'kut', 'klootzak', 'hoer', 'kanker', 'kankerlijer', 'godverdomme',
      'tering', 'mongool', 'flikker', 'neuken', 'tieten', 'slet', ],
    morceaux: [
      'klootzak', 'godverdomme', 'kankerlijer', 'kankerhoer', 'teringlijer',
      'flikker',
    ],
  },
  ar: {
    mots: [
      'zebi', 'zeb', 'kahba', 'qahba', '9ahba', 'charmouta', 'sharmouta', 'zamel',
      'zemel', 'nikmok', 'nik', 'tabon', 'tabonmok', 'terma', 'manyak', 'ayre', 'khara', ],
    morceaux: [
      'kahba', 'qahba', '9ahba', 'charmouta', 'sharmouta', 'nikmok', 'tabonmok',
      'zamel', 'manyak', 'kosomak', 'koskhtak',
    ],
  },
};

/**
 * La liste blanche : des mots innocents qui CONTIENNENT un morceau interdit.
 * Leur presence n'efface que l'endroit qu'ils couvrent — « dispute » ne
 * rachete pas un « pute » ecrit ailleurs dans le meme pseudo.
 */
export const BLANCHE = [
  // pute, putain
  'dispute', 'disputer', 'computer', 'compute', 'computing', 'depute', 'deputee',
  'reputation', 'reputer', 'imputer', 'amputer', 'putter', 'putting',
  // salope
  'salopette',
  // sexe
  'unisexe', 'middlesex', 'essex', 'sussex', 'wessex',
  // caca
  'cacao', 'cacahuete', 'cacahouete', 'cacatoes', 'cacatois', 'macaca',
  // string
  'stringer', 'bowstring', 'shoestring', 'hamstring', 'heartstring',
  // porno, porn
  'pornic', 'pornichet',
  // shit
  'shitake', 'shiitake', 'mishit',
  // cunt
  'scunthorpe',
  // asshole
  'passhole',
  // penis
  'penistone',
  // milf
  'milford',
  // horny
  'thorny',
  // niquer
  'piqueniquer', 'piqueniquez',
  // batard
  'combatard', 'combatardent',
];
