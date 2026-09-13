/* ---------------------------------------------------------------------------
   LE CALENDRIER DE L'ATHLETISME REEL — ce qui se court dehors
   ---------------------------------------------------------------------------
   Le tableau de bord a un calendrier : celui des publications Instagram. Il dit
   ce que NOUS publions. Il ne dit rien de ce qui se passe pendant ce temps sur
   les pistes — et c'est pourtant la que se decide l'attention disponible. Une
   finale du 100 m mondial un jeudi soir, c'est le seul soir du trimestre ou le
   mot « sprint » est dans toutes les bouches ; publier ce soir-la, ou publier
   le lendemain matin, n'a pas le meme prix.

   Ce fichier est donc la liste des competitions reelles, rangees dans le temps,
   avec pour chacune ce qu'elle vaut pour nous. C'est une liste de FAITS
   EXTERIEURS : des dates que World Athletics, European Athletics et la FFA
   tiennent, pas nous.

   TROIS REGLES, et elles ne sont pas decoratives.

   1. AUCUNE DATE SANS SOURCE. Chaque entree porte le lien d'ou elle vient. Une
      date d'athletisme se deplace — une reunion change de weekend, un mondial
      avance d'un jour pour loger sa ceremonie d'ouverture — et sans la source
      on ne sait pas quoi relire pour le verifier.

   2. LE DOUTE SE DIT. `statut` vaut 'confirme' ou 'a-confirmer', et la page le
      montre. Une date annoncee par un communique de circuit un an a l'avance
      n'a pas la meme solidite qu'un mondial affiche par la federation. Melanger
      les deux dans la meme typographie serait mentir par mise en page.

   3. CE CALENDRIER NE PROMET RIEN DU JEU. La charte est nette : on ne publie
      pas une date que le code ne tient pas. Les competitions ci-dessous sont
      des rendez-vous du dehors, pas des rendez-vous du jeu. Le champ `jeu` dit
      ce qu'on peut en faire — une matiere, un angle, une fenetre d'attention —
      et jamais « le championnat du jeu s'ouvre ce jour-la » : cette date-la,
      c'est le moteur des championnats qui la donne, et lui seul.

   Le perimetre est le sprint : 100, 200, 400, et les relais. Ce sont les trois
   epreuves du jeu (voir worker/src/epreuves.js) et c'est ce dont notre compte
   parle. Les rendez-vous hors sprint — cross, route, marathons — n'entrent ici
   que s'ils occupent l'espace mediatique au point qu'on doive le savoir ; ils
   portent alors `sprint: []`, et la page les range a part.

   Se lit avec `node tools/calendrier-athletisme.mjs`, se rend en page avec
   `npm run calendrier`. Se verifie avec `node tools/calendrier-athletisme-test.mjs`.
--------------------------------------------------------------------------- */

/** La fenetre que cette liste couvre. Au-dela, elle ne sait rien — et le dire
 *  vaut mieux que laisser croire qu'il n'y a rien. */
export const FENETRE = {
  debut: '2026-09-01',
  fin: '2027-09-30',
  // Releve le 13 septembre 2026. La date sert a la page : passe six mois, une
  // liste de dates d'athletisme a forcement bouge quelque part.
  releve: '2026-09-13',
};

/** Les rangs, du plus rare au plus ordinaire, et ce qu'ils pesent. */
export const RANGS = {
  mondial: { nom: 'Mondial', poids: 4, teinte: '#f5c33b' },
  continental: { nom: 'Continental', poids: 3, teinte: '#7dd3fc' },
  national: { nom: 'National', poids: 2, teinte: '#a7f3d0' },
  circuit: { nom: 'Circuit', poids: 1, teinte: '#c4b5fd' },
};

/**
 * Une competition.
 *
 *   cle        identifiant stable — il sert de point d'ancrage dans la page
 *   nom        tel qu'on l'ecrit dans une legende
 *   lieu/pays  ou elle se court
 *   debut/fin  ISO. Une journee unique : debut === fin
 *   rang       voir RANGS
 *   salle      vrai si c'est de la piste couverte (60 m au lieu du 100 m)
 *   sprint     les epreuves de sprint au programme, vide si aucune
 *   statut     'confirme' | 'a-confirmer'
 *   source     l'adresse d'ou vient la date
 *   quoi       une phrase : de quoi il s'agit, pour qui ne suit pas
 *   jeu        ce que ca vaut pour nous. Jamais une promesse du jeu (regle 3).
 */
export const COMPETITIONS = [
  {
    cle: 'wauc-budapest-2026',
    nom: 'World Athletics Ultimate Championship',
    lieu: 'Budapest', pays: 'Hongrie',
    debut: '2026-09-11', fin: '2026-09-13',
    rang: 'mondial', salle: false,
    sprint: ['100', '200', '400', '4x100'],
    statut: 'confirme',
    source: 'https://worldathletics.org/competitions/world-athletics-ultimate-championship/2026',
    quoi: 'La toute première édition : trois soirs, aucune série inutile, les meilleurs mondiaux convoqués et une dotation record. Le format est fait pour la télévision — des finales, rien que des finales.',
    jeu: 'Le sprint est à la une trois soirs de suite, et c’est la seule semaine de l’automne où il y sera. Une course du jeu publiée ces soirs-là trouve un public déjà tourné vers la piste — à condition de ne jamais se faire passer pour la compétition elle-même.',
  },
  {
    cle: 'mondiaux-route-copenhague-2026',
    nom: 'Championnats du monde de course sur route',
    lieu: 'Copenhague', pays: 'Danemark',
    debut: '2026-09-19', fin: '2026-09-20',
    rang: 'mondial', salle: false,
    sprint: [],
    statut: 'confirme',
    source: 'https://cphhalf.dk/en/wrrc-copenhagen-26/',
    quoi: 'Semi-marathon, 5 km et mile, sur route. Aucun sprint au programme.',
    jeu: 'À savoir, pas à suivre : le week-end où l’athlétisme parle d’endurance. Rien à en tirer pour un jeu de 100 m, et se greffer dessus sonnerait faux.',
  },
  {
    cle: 'france-cross-sarrebourg-2027',
    nom: 'Championnats de France de cross-country',
    lieu: 'Sarrebourg', pays: 'France',
    debut: '2027-02-27', fin: '2027-02-28',
    rang: 'national', salle: false,
    sprint: [],
    statut: 'confirme',
    source: 'https://www.athle.fr/actualites/championnats-de-france-2027-les-elite-retrouvent-saint-etienne-le-cross-debarque-a-sarrebourg/23005',
    quoi: 'Le cross national, sur les bords de l’étang Lévêque. Aucun sprint au programme.',
    jeu: 'Rien pour nous, sinon que l’athlétisme français a ce week-end-là les yeux ailleurs.',
  },
  {
    cle: 'euro-salle-valence-2027',
    nom: 'Championnats d’Europe en salle',
    lieu: 'Valence', pays: 'Espagne',
    debut: '2027-03-04', fin: '2027-03-07',
    rang: 'continental', salle: true,
    sprint: ['60', '400', '4x400'],
    statut: 'confirme',
    source: 'https://www.equipe-france.fr/athletisme/championnats-d-europe-en-salle-2027',
    quoi: 'Quatre jours de piste couverte. Le 60 m y remplace le 100 m : un départ, vingt mètres de lancement, et c’est fini.',
    jeu: 'Le meilleur moment de l’année pour parler du DÉPART, parce que c’est la seule chose dont tout le monde parlera : en salle, un temps de réaction raté ne se rattrape plus. C’est exactement ce que le jeu fait ressentir en dix secondes.',
  },
  {
    cle: 'dl-doha-2027',
    nom: 'Wanda Diamond League — Doha',
    lieu: 'Doha', pays: 'Qatar',
    debut: '2027-05-07', fin: '2027-05-07',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'L’ouverture de la saison du circuit mondial.',
    jeu: 'La saison de plein air redémarre : le premier chrono de l’année sur 100 m donne un point de comparaison que tout le monde comprend.',
  },
  {
    cle: 'dl-shanghai-2027',
    nom: 'Wanda Diamond League — Shanghai',
    lieu: 'Shanghai', pays: 'Chine',
    debut: '2027-05-15', fin: '2027-05-15',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'Deuxième étape du circuit, et la première de la tournée asiatique.',
    jeu: '',
  },
  {
    cle: 'dl-rome-2027',
    nom: 'Wanda Diamond League — Rome',
    lieu: 'Rome', pays: 'Italie',
    debut: '2027-05-27', fin: '2027-05-27',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'Le Golden Gala, une des étapes historiques du circuit.',
    jeu: '',
  },
  {
    cle: 'dl-oslo-2027',
    nom: 'Wanda Diamond League — Oslo',
    lieu: 'Oslo', pays: 'Norvège',
    debut: '2027-06-03', fin: '2027-06-03',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'Bislett Games — la plus ancienne des réunions du circuit, et un stade où le public est presque sur la piste.',
    jeu: '',
  },
  {
    cle: 'dl-stockholm-2027',
    nom: 'Wanda Diamond League — Stockholm',
    lieu: 'Stockholm', pays: 'Suède',
    debut: '2027-06-06', fin: '2027-06-06',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'Bauhaus Galan, au stade olympique de 1912 — la piste la plus étroite du circuit, et des virages qui se voient à l’œil nu.',
    jeu: '',
  },
  {
    cle: 'euro-equipes-istanbul-2027',
    nom: 'Championnats d’Europe par équipes — 1re division',
    lieu: 'Istanbul', pays: 'Turquie',
    debut: '2027-06-25', fin: '2027-06-27',
    rang: 'continental', salle: false,
    sprint: ['100', '200', '400', '4x100', '4x400'],
    statut: 'a-confirmer',
    source: 'https://www.european-athletics.com/',
    quoi: 'L’Europe par nations : chaque pays marque des points, et le classement se joue sur l’ensemble des épreuves.',
    jeu: 'Une compétition où l’équipe compte plus que l’individu — c’est le relais du jeu, et la seule fois de l’année où le grand public voit un classement par pays.',
  },
  {
    cle: 'dl-londres-2027',
    nom: 'Wanda Diamond League — Londres',
    lieu: 'Londres', pays: 'Royaume-Uni',
    debut: '2027-07-17', fin: '2027-07-17',
    rang: 'circuit', salle: false,
    sprint: ['100', '200', '400'],
    statut: 'a-confirmer',
    source: 'https://www.diamondleague.com/calendar/',
    quoi: 'London Athletics Meet, au stade olympique de 2012.',
    jeu: '',
  },
  {
    cle: 'france-elite-saint-etienne-2027',
    nom: 'Championnats de France Élite',
    lieu: 'Saint-Étienne', pays: 'France',
    debut: '2027-07-30', fin: '2027-08-01',
    rang: 'national', salle: false,
    sprint: ['100', '200', '400', '4x100', '4x400'],
    statut: 'confirme',
    source: 'https://www.athle.fr/actualites/championnats-de-france-2027-les-elite-retrouvent-saint-etienne-le-cross-debarque-a-sarrebourg/23005',
    quoi: 'Trois jours au stade Henri-Lux : les titres nationaux, et la sélection pour les mondiaux qui suivent six semaines plus tard.',
    jeu: 'Le rendez-vous français de l’année, et le seul où le mot « champion de France » circule hors du milieu. Le jeu en décerne un, lui aussi — mais son édition suit le cycle du moteur, jamais le calendrier ci-contre.',
  },
  {
    cle: 'mondiaux-pekin-2027',
    nom: 'Championnats du monde d’athlétisme',
    lieu: 'Pékin', pays: 'Chine',
    debut: '2027-09-10', fin: '2027-09-19',
    rang: 'mondial', salle: false,
    sprint: ['100', '200', '400', '4x100', '4x400'],
    statut: 'confirme',
    source: 'https://worldathletics.org/competitions/world-athletics-championships/beijing27/about-event',
    quoi: 'Dix jours au Nid d’oiseau, près de vingt ans après les Jeux de 2008. Une session en soirée chaque jour — l’ouverture a été avancée au 10 pour loger la cérémonie avec la première session.',
    jeu: 'Le sommet de la saison, et la fenêtre d’attention la plus large de l’année pour un jeu de sprint. Tout ce qui doit être prêt l’est avant le 10 septembre : pendant dix jours, on suit, on ne prépare plus.',
  },
];

/**
 * CE QUE CETTE LISTE NE SAIT PAS ENCORE.
 *
 * Un calendrier tait ses trous par construction : l'absence d'une ligne ne se
 * distingue pas d'une absence de competition. Ces trous-la sont connus, et
 * c'est pour ca qu'ils sont ecrits — la page les affiche.
 */
export const TROUS = [
  {
    quoi: 'Le calendrier complet de la Diamond League 2027',
    pourquoi: 'Les étapes ci-dessus sont celles qu’on a pu attribuer à une source. Il en manque (Xiamen, Rabat, Paris, Eugene, Monaco, Lausanne, Silésie) et la finale de Zurich n’a pas de date. Le circuit publie son calendrier définitif à l’automne.',
    ou: 'https://www.diamondleague.com/calendar/',
  },
  {
    quoi: 'Le Meeting de Paris 2027',
    pourquoi: 'L’étape française du circuit : la seule date du calendrier mondial où l’on peut voir une finale de sprint à Paris, et elle manque ici.',
    ou: 'https://www.diamondleague.com/calendar/',
  },
  {
    quoi: 'Les Championnats de France Élite en salle 2027',
    pourquoi: 'Ville et dates non trouvées au relevé. Le 60 m national se court en général fin février, avant l’Euro en salle.',
    ou: 'https://www.athle.fr/contenu/calendrier-championnats-de-france/32',
  },
  {
    quoi: 'Le World Athletics Indoor Tour 2027',
    pourquoi: 'Le circuit en salle occupe janvier et février, et aucune de ses étapes n’a de date vérifiée ici.',
    ou: 'https://worldathletics.org/competitions/world-athletics-indoor-tour',
  },
  {
    quoi: 'Après septembre 2027',
    pourquoi: 'La fenêtre de ce calendrier s’arrête aux mondiaux de Pékin. Le rendez-vous suivant qui compte est olympique — Los Angeles, été 2028 — et son programme d’athlétisme n’est pas fixé.',
    ou: 'https://worldathletics.org/competitions',
  },
];

/* --------------------------------------------------------------------------
   Ce qui se calcule a partir de la liste. Rien ici ne connait le HTML : la
   page et le terminal appellent les memes fonctions, et disent donc la meme
   chose.
--------------------------------------------------------------------------- */

/** Minuit UTC du jour donne — deux dates ISO se comparent alors en jours
 *  entiers, sans qu'un fuseau ne decale un rendez-vous d'une journee. */
function jour(iso) {
  return Date.parse(`${iso}T00:00:00Z`);
}

const JOUR_MS = 86_400_000;

/**
 * Ou en est une competition par rapport a un instant donne.
 * Retourne 'passe', 'en-cours' ou 'a-venir', et le nombre de jours qui separe.
 */
export function etat(c, maintenant = new Date()) {
  const aujourdhui = jour(new Date(maintenant).toISOString().slice(0, 10));
  const debut = jour(c.debut);
  const fin = jour(c.fin);
  if (aujourdhui > fin) return { etat: 'passe', jours: Math.round((aujourdhui - fin) / JOUR_MS) };
  if (aujourdhui >= debut) return { etat: 'en-cours', jours: 0 };
  return { etat: 'a-venir', jours: Math.round((debut - aujourdhui) / JOUR_MS) };
}

/** Les competitions dans l'ordre du temps. La liste source est deja triee —
 *  le test le verifie — mais s'appuyer sur un ordre de saisie, c'est attendre
 *  le jour ou quelqu'un ajoutera une ligne au mauvais endroit. */
export function parDate(liste = COMPETITIONS) {
  return [...liste].sort((a, b) => jour(a.debut) - jour(b.debut) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Celles qui viennent, la plus proche d'abord. */
export function aVenir(maintenant = new Date(), liste = COMPETITIONS) {
  return parDate(liste).filter((c) => etat(c, maintenant).etat !== 'passe');
}

/** Les dates d'une competition, ecrites comme on les lit. */
export function periode(c) {
  const d = new Date(jour(c.debut));
  const f = new Date(jour(c.fin));
  const mois = (x) => x.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  // « 1 septembre » n'existe pas en francais : le premier du mois est ordinal,
  // et lui seul.
  const num = (x) => (x.getUTCDate() === 1 ? '1er' : x.getUTCDate());
  const an = (x) => x.getUTCFullYear();
  if (c.debut === c.fin) return `${num(d)} ${mois(d)} ${an(d)}`;
  if (mois(d) === mois(f) && an(d) === an(f)) return `${num(d)} → ${num(f)} ${mois(f)} ${an(f)}`;
  if (an(d) === an(f)) return `${num(d)} ${mois(d)} → ${num(f)} ${mois(f)} ${an(f)}`;
  return `${num(d)} ${mois(d)} ${an(d)} → ${num(f)} ${mois(f)} ${an(f)}`;
}

/** Le mois d'une competition, pour grouper : « septembre 2026 ». */
export function mois(c) {
  return new Date(jour(c.debut)).toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** Les epreuves de sprint, ecrites : ['100','4x100'] → « 100 m · 4 × 100 m ». */
export function epreuves(c) {
  return c.sprint
    .map((e) => (e.includes('x') ? e.replace('x', ' × ') + ' m' : `${e} m`))
    .join(' · ');
}

/** Le compte rendu d'une liste, tel qu'on l'affiche en pied de page. */
export function compte(liste = COMPETITIONS, maintenant = new Date()) {
  const restantes = aVenir(maintenant, liste);
  return {
    total: liste.length,
    aVenir: restantes.length,
    sprint: liste.filter((c) => c.sprint.length > 0).length,
    aConfirmer: liste.filter((c) => c.statut === 'a-confirmer').length,
    prochaine: restantes[0] || null,
  };
}
