/* ---------------------------------------------------------------------------
   LES DEUX COUCHES DU CLASSEMENT DES DUELS
   ---------------------------------------------------------------------------
   Un nombre cache qui estime la force, une echelle visible qui recompense.

   Elles n'ont pas le meme metier, et c'est pour cela qu'elles sont deux :

   - le MMR mesure QUI COURT LE PLUS VITE. Il n'a le droit de recompenser rien
     ni personne ; sa seule qualite est d'etre juste. Un joueur qui bat plus
     fort que lui gagne beaucoup, un favori qui gagne comme prevu gagne peu.
   - les points de ligue mesurent CE QU'ON A MERITE. Ils portent l'asymetrie
     des roles, les promotions, la descente — tout ce qui se raconte.

   La tentation est de tout mettre dans le meme nombre. Elle se paie tout de
   suite : donner un bonus de MMR a celui qui releve un defi reviendrait a
   affirmer qu'il court plus vite parce qu'il a pris un risque. Au bout de
   quelques centaines de duels, le nombre cense predire les resultats ne
   prédirait plus rien, et les appariements comme la vitesse de montee
   seraient faux pour tout le monde.

   Ce module ne connait ni base de donnees, ni requete, ni joueur. Il prend des
   nombres et en rend d'autres. C'est ce qui permet de le mettre a l'epreuve
   sans rien monter — et le classement est exactement le genre d'endroit ou une
   erreur ne se voit pas : un gain de vingt-trois points au lieu de vingt-cinq
   ressemble a un gain de vingt-cinq.
--------------------------------------------------------------------------- */

/* ------------------------------------------------------------------ l'echelle */

/**
 * Les paliers, du premier au dernier.
 *
 * Quatre etages de quatre divisions, puis un sommet sans division. Les noms
 * viennent de l'athletisme francais plutot que des metaux : on ne monte pas de
 * bronze en argent, on passe du departemental au regional.
 */
export const ETAGES = ['departemental', 'regional', 'national', 'elite'];
export const DIVISIONS = 4;
export const LEGENDE = ETAGES.length * DIVISIONS;      // 16 : le sommet
export const PALIER_MAX = LEGENDE;

/** Ce qu'il faut de points de ligue pour passer au palier suivant. */
export const LP_PAR_PALIER = 100;

/**
 * Le rang lisible d'un palier.
 *
 * La division compte a l'envers — IV est la porte d'entree, I la sortie — ce
 * qui est l'usage du sport et l'inverse de l'intuition d'un tableau. On la
 * derive plutot que de la stocker : deux colonnes a tenir d'accord finissent
 * toujours par se contredire, et une promotion n'est ici qu'un palier de plus.
 */
export function rangDe(palier) {
  const p = Math.max(0, Math.min(PALIER_MAX, Math.round(Number(palier) || 0)));
  if (p >= LEGENDE) return { palier: LEGENDE, etage: 'legende', division: 0 };
  return { palier: p, etage: ETAGES[Math.floor(p / DIVISIONS)],
           division: DIVISIONS - (p % DIVISIONS) };
}

/* --------------------------------------------------------------------- le MMR */

export const MMR_DEPART = 1200;
export const MMR_PLANCHER = 100;

/**
 * L'avantage de celui qui releve, en points Elo.
 *
 * Il ne court pas la meme course : le chrono est pose, il sait exactement ce
 * qu'il doit battre, et il peut se regler dessus. A force egale il l'emporte
 * donc un peu plus souvent — et sans le dire au calcul, le systeme prendrait
 * cette regularite pour du talent et surestimerait tous les releveurs.
 *
 * Vingt points est une estimation de depart, pas une mesure. Elle se calibre
 * sur les duels reels : la valeur juste est celle qui rend la part de
 * victoires des releveurs egale a la part que le modele leur prédit.
 */
export const AVANTAGE_RELEVEUR = 20;

/**
 * Le facteur K : combien un resultat peut deplacer le MMR.
 *
 * Grand au debut, quand on ne sait rien du joueur et que chaque course
 * apprend beaucoup ; petit ensuite, quand une centaine de duels ont deja dit
 * ou il se situe et qu'une contre-performance ne doit pas tout defaire. C'est
 * le travail que fait l'ecart-type dans Glicko ; ici il n'est pas stocke, et
 * un K decroissant en tient lieu — moins fin, et honnete sur ce qu'il est.
 */
export function facteurK(duelsJoues) {
  const n = Math.max(0, Number(duelsJoues) || 0);
  if (n < 10) return 48;
  if (n < 30) return 32;
  if (n < 100) return 20;
  return 14;
}

/** La probabilite que A l'emporte, vue par le modele. */
export function esperance(mmrA, mmrB) {
  return 1 / (1 + Math.pow(10, (mmrB - mmrA) / 400));
}

/**
 * Le MMR des deux joueurs apres un duel.
 *
 * `issue` vaut 'challenger', 'opponent' ou 'draw' — les mots que la base
 * emploie deja, pour n'avoir a les traduire nulle part.
 *
 * L'avantage du releveur entre dans l'ESPERANCE, jamais dans le gain : il
 * corrige la prediction, il ne recompense pas. La difference se voit sur un
 * duel entre egaux — le releveur y est legerement favori, sa victoire lui
 * rapporte donc un peu moins que celle du lanceur.
 */
export function majMmr({ mmrLanceur, mmrReleveur, duelsLanceur, duelsReleveur, issue }) {
  const a = Number(mmrLanceur) || MMR_DEPART;
  const b = Number(mmrReleveur) || MMR_DEPART;
  // Le releveur est attendu un peu plus haut qu'il ne l'est reellement.
  const eLanceur = esperance(a, b + AVANTAGE_RELEVEUR);
  const eReleveur = 1 - eLanceur;

  const sLanceur = issue === 'challenger' ? 1 : issue === 'opponent' ? 0 : 0.5;
  const sReleveur = 1 - sLanceur;

  const kA = facteurK(duelsLanceur), kB = facteurK(duelsReleveur);
  const dA = Math.round(kA * (sLanceur - eLanceur));
  const dB = Math.round(kB * (sReleveur - eReleveur));

  return {
    lanceur: Math.max(MMR_PLANCHER, a + dA),
    releveur: Math.max(MMR_PLANCHER, b + dB),
    delta_lanceur: dA,
    delta_releveur: dB,
    esperance_lanceur: eLanceur,
  };
}

/* ------------------------------------------------------ les points de ligue */

/**
 * Le bareme, par role.
 *
 * Celui qui lance abat sa carte le premier : son chrono est pose, et l'autre
 * le voit courir en fantome en sachant exactement ce qu'il doit battre. On le
 * paie donc moins quand il l'emporte quand meme, et on le sanctionne plus
 * franchement quand il tombe. Celui qui releve gagne gros et perd peu — c'est
 * la seule facon de rendre le fait de relever plus attirant que le fait
 * d'attendre.
 */
export const LP = {
  lanceur:  { victoire: 20, defaite: -25, nul: 0 },
  releveur: { victoire: 25, defaite: -20, nul: 0 },
};

/** Le MMR qu'on attend d'un joueur a ce palier. */
export const MMR_PALIER_BASE = 900;
export const MMR_PALIER_PAS = 45;
export function mmrAttendu(palier) {
  const p = Math.max(0, Math.min(PALIER_MAX, Math.round(Number(palier) || 0)));
  return MMR_PALIER_BASE + p * MMR_PALIER_PAS;
}

/** Au-dela de cet ecart de MMR, la modulation ne bouge plus. */
export const ECART_PLEIN = 300;
export const MODULATION_MIN = 0.5, MODULATION_MAX = 1.6;

/**
 * De combien le MMR accelere ou freine la montee.
 *
 * C'est ici, et nulle part ailleurs, que les deux couches se rejoignent. Un
 * joueur dont le MMR depasse largement sa division ne gagne pas seulement ses
 * duels : il les gagne contre des gens que le systeme estime en dessous de
 * lui, et il traverse donc ses divisions vite. Celui qui stagne au-dessus de
 * son niveau reel monte au ralenti et redescend vite.
 *
 * Sans cela, les deux couches vivraient cote a cote sans jamais se parler, et
 * le MMR ne servirait a rien de visible.
 */
export function modulation(mmr, palier, gagne) {
  const ecart = (Number(mmr) || MMR_DEPART) - mmrAttendu(palier);
  const brut = gagne ? 1 + ecart / ECART_PLEIN : 1 - ecart / ECART_PLEIN;
  return Math.max(MODULATION_MIN, Math.min(MODULATION_MAX, brut));
}

/** Les points de ligue gagnes ou perdus sur un duel. */
export function gainLp({ role, issue, mmr, palier }) {
  const bareme = role === 'lanceur' ? LP.lanceur : LP.releveur;
  const gagnant = role === 'lanceur' ? 'challenger' : 'opponent';
  if (issue === 'draw') return 0;
  const gagne = issue === gagnant;
  const base = gagne ? bareme.victoire : bareme.defaite;
  return Math.round(base * modulation(mmr, palier, gagne));
}

/* ------------------------------------------------ promotions et relegations */

/**
 * Combien de defaites a zero point de ligue avant de descendre.
 *
 * Sans ce sursis, une promotion arrachee se perd au duel suivant et l'on fait
 * l'ascenseur entre deux divisions toute la soiree. Deux courses, c'est assez
 * pour ne pas redescendre sur un accident, trop peu pour s'installer dans une
 * division qu'on ne tient pas.
 */
export const BOUCLIER = 2;

/**
 * Applique un mouvement de points de ligue, promotions et descentes comprises.
 *
 * Les points en trop ne sont pas perdus a la promotion : gagner de justesse et
 * gagner largement ne doivent pas laisser au meme endroit, sans quoi le
 * dernier duel avant un passage de division ne compte pour rien.
 */
export function appliquerLp({ palier, lp, bouclier = 0, delta }) {
  let p = Math.max(0, Math.min(PALIER_MAX, Math.round(Number(palier) || 0)));
  let points = Math.round(Number(lp) || 0) + Math.round(Number(delta) || 0);
  let bo = Math.max(0, Math.round(Number(bouclier) || 0));
  let monte = 0, descend = 0;

  // Legende n'a pas de division au-dessus : les points s'y accumulent, et ce
  // sont eux qui ordonnent le sommet du classement.
  while (points >= LP_PAR_PALIER && p < PALIER_MAX) {
    points -= LP_PAR_PALIER;
    p += 1; monte += 1;
    bo = BOUCLIER;
  }

  while (points < 0) {
    if (p === 0) { points = 0; break; }        // le plancher de l'echelle
    if (bo > 0) { bo -= 1; points = 0; break; } // sursis
    p -= 1; descend += 1;
    points += LP_PAR_PALIER;
  }

  return { palier: p, lp: points, bouclier: bo, monte, descend };
}

/**
 * Un duel, de bout en bout : le MMR cache des deux joueurs, et leurs points.
 *
 * Une seule fonction pour les deux couches, parce qu'elles se lisent l'une
 * l'autre — la modulation des points depend du MMR, et il faut celui d'AVANT
 * le duel. Les calculer separement laisserait un jour passer la version mise
 * a jour, et la montee dependrait du resultat deux fois.
 */
export function appliquerDuelAuClassement({ lanceur, releveur, issue }) {
  const mmr = majMmr({
    mmrLanceur: lanceur.mmr, mmrReleveur: releveur.mmr,
    duelsLanceur: lanceur.duels, duelsReleveur: releveur.duels,
    issue,
  });

  const dLanceur = gainLp({ role: 'lanceur', issue, mmr: lanceur.mmr, palier: lanceur.palier });
  const dReleveur = gainLp({ role: 'releveur', issue, mmr: releveur.mmr, palier: releveur.palier });

  return {
    lanceur: {
      ...appliquerLp({ palier: lanceur.palier, lp: lanceur.lp,
                       bouclier: lanceur.bouclier, delta: dLanceur }),
      mmr: mmr.lanceur, delta_mmr: mmr.delta_lanceur, delta_lp: dLanceur,
    },
    releveur: {
      ...appliquerLp({ palier: releveur.palier, lp: releveur.lp,
                       bouclier: releveur.bouclier, delta: dReleveur }),
      mmr: mmr.releveur, delta_mmr: mmr.delta_releveur, delta_lp: dReleveur,
    },
  };
}
