// REVOIR UNE COURSE DE CHAMPIONNAT
//
// Le championnat ne s'echangeait que des chronos : `/champ/course` recoit huit
// nombres, `champ_resultats` en garde le chrono, la place et le couloir. Il n'y
// avait donc rien a regarder — l'ecran remplissait un tableau, et la finale se
// jouait en trois millimes que personne ne voyait passer.
//
// Ce module rejoue la course sur la piste du jeu. Il ne diffuse rien et ne
// telecharge aucune image : le moteur est deja dans le telephone, et huit
// chronos suffisent a le faire courir.
//
// COMMENT, EXACTEMENT.
//
// `Runner.setPace(T)` existait pour les adversaires de la campagne : on donne
// un chrono vise, et le coureur le court — v(t) = vmax·(1 − e^(−t/τ)), calee
// pour franchir la ligne a la seconde demandee. Il suffit donc de poser sur
// les huit couloirs les huit chronos de la course, et la course se rejoue
// d'elle-meme, avec ses ecarts exacts et son ordre d'arrivee exact.
//
// Ce qui n'est PAS reconstitue : la forme de la foulee, la reaction au
// pistolet, un depart manque. Le chrono ne les porte pas. Quand une vraie
// trace sera enregistree — le format existe deja pour les fantomes du defi,
// des decimetres tous les 80 ms — elle remplacera le modele ici, et rien
// d'autre ne bougera.
//
// LE SPECTATEUR OCCUPE UN COULOIR. La camera suit `G.player`, le HUD lit
// `G.player`, l'enregistreur filme ce que la camera cadre. Plutot que de leur
// apprendre a tous qu'un coureur peut n'etre personne, on met le coureur suivi
// a la place du joueur et on le fait avancer par `stepAI` (voir `G.rejeu` dans
// engine.ts). Personne n'appuie, tout le reste fonctionne sans le savoir.

import { programmerLeFilm, arreterLeFilm } from './film-course';
import { entrerDansLeTour, presentationAnnoncee, pistoletAnnonce, rappelSiffle, arreterLaMusique } from './musique-championnat';
import { chargerFiches, type SourceFiches } from './fiches-champ';

const SprinterApp: any = (globalThis as any).SprinterApp;
const SprinterCore: any = (globalThis as any).SprinterCore;

export type CoureurRejeu = {
  nom: string;
  /**
   * La cle du joueur, pour aller chercher sa fiche — palmares, niveau en
   * duel, bilan — et la montrer quand la presentation arrive sur lui.
   * Absente : il est presente par son nom et son couloir, comme avant.
   */
  cle?: string;
  /** Le chrono couru, en millisecondes. `null` pour un abandon. */
  ms: number | null;
  /** Le couloir de la grille, 1 a 8. Absent : l'ordre de la liste. */
  couloir?: number;
  /** Celui que la camera suit. Un seul ; a defaut, le vainqueur. */
  suivi?: boolean;
  /**
   * Le joueur de ce telephone, s'il courait cette course-la.
   *
   * Il est le seul a garder l'apparence du joueur (`PLAYER_LOOK`) : tous les
   * autres reprennent celle que le jeu leur donne partout ailleurs, derivee de
   * leur nom. Sans cette distinction, ou bien le joueur se voit en inconnu sur
   * sa propre course, ou bien sept athletes portent son maillot.
   */
  moi?: boolean;
  /**
   * Pourquoi il n'a pas de chrono, si la course a ete courue en direct.
   *
   * Le forfait n'est pas sur la piste : son couloir reste vide. Le faux
   * depart, lui, y est — il prend le depart, et le rejeu joue le rappel et
   * son carton rouge avant de relancer la course sans lui. L'abandon court,
   * derriere tout le monde, comme avant.
   */
  motif?: 'faux_depart' | 'abandon' | 'forfait' | null;
  /** L'instant du faux depart, depuis le coup de pistolet (negatif). */
  motif_ms?: number | null;
};

/**
 * Le decor.
 *
 * Quatre, c'est le stade olympique : une piste d'athletisme et des gradins
 * pleins. Cinq serait la finale intergalactique des ZEZE, ou la course en
 * direct se tient — mais un championnat de France sous un ciel cosmos ne
 * ressemble a rien de ce qu'il pretend etre, et une video tiree de la ne
 * raconte plus une competition nationale.
 */
const NIVEAU = 4;

/** Un abandon n'a pas de chrono ; il en faut un pour le dessiner quand meme. */
const RETARD_ABANDON_MS = 2500;

/* ---------------------------------------------------------------------------
   CE QUE L'ECRAN SAIT DE LA COURSE EN COURS
   ---------------------------------------------------------------------------
   PAS DE NOM AU-DESSUS DES TETES.

   Huit pastilles suspendues au-dessus de huit coureurs, sur un telephone
   tenu a bout de bras, cachent exactement ce qu'on est venu voir : la piste
   et les corps qui courent. Elles ont leur place dans un duel, ou l'on
   cherche UN adversaire parmi sept figurants ; elles n'en ont aucune dans une
   finale a huit, ou tout le monde compte.

   On dit donc qui court AUTREMENT, et aux deux moments ou la question se
   pose vraiment :

   - AVANT le pistolet, la liste de depart — couloir par couloir, comme le
     speaker l'annonce et comme la television l'affiche ;
   - APRES la ligne, le tableau — place, COULOIR, nom, chrono.

   LE COULOIR EST DANS LES DEUX, ET C'EST LUI QUI LES RELIE. La liste de
   depart dit « 5 : Untel » ; sans le couloir, le tableau ne dit que « 2e :
   Untel », et le spectateur qui a suivi du regard le coureur du 5 n'a aucun
   moyen de savoir lequel des huit noms il vient de regarder courir. La piste
   ne l'aidera qu'au depart : les couloirs y sont bien numerotes, peints au
   sol devant les blocs, mais ces chiffres sortent du cadre au bout de
   quelques metres — la camera suit le coureur — et les athletes n'ont ici ni
   cerceau ni pastille (`r.repere = null` plus bas).

   Entre les deux, il ne reste que la course.
--------------------------------------------------------------------------- */

export type EtatRejeu = {
  /** Une course est armee ou en train de se derouler. */
  actif: boolean;
  /**
   * Ou en est la retransmission.
   *
   *   'presentation' le generique et les huit athletes, un par un
   *   'course'       le pistolet a tire ; l'ecran se tait
   *   'arrivee'      le tableau
   */
  phase: 'presentation' | 'course' | 'arrivee';
  /** « Demi-finale 1 », « Finale » — ce qu'on regarde. */
  titre: string;
  /** Le nom de la competition, sous le titre. */
  sousTitre: string;
  /** La distance courue : '100', '200', '400'. L'image de l'arrivee l'annonce. */
  epreuve: string;
  /** La grille, dans l'ordre des couloirs. `cle` : celle de sa fiche. */
  grille: { couloir: number; nom: string; cle?: string }[];
  /**
   * D'ou viennent les fiches de la presentation, et la distance ou le niveau
   * se lit. `avant` est l'heure de la course : la retransmission d'une finale
   * n'annonce pas, avant le pistolet, la medaille que cette finale a donnee.
   * `null` hors championnat.
   */
  fiches: (SourceFiches & { epreuve: string }) | null;
  /**
   * L'arrivee, une fois la ligne franchie par tout le monde.
   *
   * `couloir` est celui que le coureur occupait REELLEMENT sur la piste, note
   * au moment ou on l'y a place : c'est le meme numero que la liste de depart
   * a annonce. `null` si la correspondance manque, ce qui ne devrait pas
   * arriver — mieux vaut un tiret qu'un couloir invente.
   */
  arrivee: {
    /** `null` pour qui n'a pas de chrono : un carton rouge n'a pas de rang. */
    place: number | null; nom: string; ms: number | null; couloir: number | null;
    motif?: string | null;
  }[] | null;
  /**
   * Le rappel d'un faux depart, le temps de sa scene : qui sort, et quand la
   * scene a commence. L'ecran y pose le carton (voir ChampDirect).
   */
  rappel: { fautifs: { id: string; nom: string; couloir: number; ms: number }[]; debut: number } | null;
  /** La course dont il s'agit, quand elle vient d'un championnat. */
  course: { edition: string; phase: string; numero: number } | null;
  /** Championnat de France : l'image du resultat porte le drapeau devant les noms. */
  fr?: boolean;
  /** Le mot du vainqueur, deja pose. `null` tant que personne n'a parle. */
  mot: MotDuVainqueur | null;
};

const VIDE: EtatRejeu = {
  actif: false, phase: 'presentation', titre: '', sousTitre: '', epreuve: '',
  grille: [], fiches: null, arrivee: null, course: null, mot: null, rappel: null,
};

let etat: EtatRejeu = VIDE;
const guetteurs = new Set<() => void>();

function poser(e: EtatRejeu) {
  etat = e;
  for (const g of guetteurs) { try { g(); } catch { /* un ecran casse n'arrete pas les autres */ } }
}

/** Pour `useSyncExternalStore` : l'abonnement, et la lecture. */
export function suivreRejeu(f: () => void): () => void {
  guetteurs.add(f);
  return () => { guetteurs.delete(f); };
}
export function lireRejeu(): EtatRejeu { return etat; }

/**
 * Referme le tableau et rentre a l'accueil.
 *
 * C'est ici, et seulement ici, que le rejeu se desarme : tant que le tableau
 * est a l'ecran, le moteur doit continuer de se savoir en rejeu — sans quoi il
 * rattraperait la course par sa sortie ordinaire et ouvrirait l'ecran de fin
 * du one shot par-dessus (voir engine.ts).
 */
export function fermerRejeu() {
  annulerLeRappel();
  if (musique) { arreterLaMusique(); musique = false; }
  const G = SprinterApp?.G;
  if (G) { G.rejeu = false; G.rejeuFini = false; G.presente = null; G.rejeuBandeau = null; }
  poser(VIDE);
  SprinterApp?.goHome();
}

/** Ce qu'on affiche autour de la course : ce qu'on regarde, et quand ca s'est couru. */
export type Intitule = {
  /** « Finale », « Demi-finale 2 » — la course elle-meme. */
  titre: string;
  /** « Championnat de France · 100 M » — sous le titre, pendant la presentation. */
  sousTitre: string;
  /**
   * La competition seule, sans l'epreuve : « Championnat de France ».
   *
   * Elle sert l'EN-TETE de la retransmission, celui qui reste en haut a droite
   * pendant toute la course et qui part avec la video (voir `bandeau-rejeu`).
   * Le sous-titre ne peut pas y servir : il porte l'epreuve, que le HUD annonce
   * deja par ailleurs, et l'en-tete doit tenir en petit dans un coin.
   */
  competition?: string;
  /** L'heure de la course, prise au calendrier de l'edition. */
  quand?: number | null;
  /**
   * DE QUELLE COURSE IL S'AGIT, pour le mot du vainqueur.
   *
   * Le tableau d'arrivee est le seul endroit ou ce mot a du sens : c'est la
   * qu'on vient de voir qui a gagne. Encore faut-il savoir a quelle course
   * l'adresser — le rejeu, lui, ne connait que huit chronos.
   */
  course?: { edition: string; phase: string; numero: number } | null;
  /** Le mot que le vainqueur a deja pose, s'il l'a fait. */
  mot?: MotDuVainqueur | null;
  /**
   * Le lieu impose par l'edition (`lieu` de /champ/edition), par sa cle :
   * 'champdemars'. Absent, inconnu de ce jeu, ou absent de ce canal : le
   * stade olympique, comme avant.
   */
  lieu?: string | null;
  /**
   * Vrai pour une course du Championnat de France : le rejeu joue alors la
   * musique du championnat, comme le direct (voir musique-championnat.ts).
   */
  fr?: boolean;
};

/** L'etape ou se rejoue une course : celle du lieu demande, sinon NIVEAU. */
export function niveauDuLieu(lieu?: string | null): number {
  if (!lieu) return NIVEAU;
  const i = (SprinterCore?.LEVELS || []).findIndex((l: any) => l.cle === lieu);
  return i >= 0 ? i : NIVEAU;
}

/** Ce que le tableau d'arrivee sait du mot du vainqueur. */
export type MotDuVainqueur = {
  nom: string;
  texte: string | null;
  /** Un enregistrement existe ; il se demande au serveur, il ne voyage pas. */
  a_voix: boolean;
};

/**
 * Rejoue une course a partir de ses chronos.
 *
 * @param epreuve  '100', '200', '400' — la distance de l'edition.
 * @param coureurs les huit partants, avec leur chrono.
 * @param dansMs   delai avant le coup de pistolet. Le decompte du starter est
 *                 borne a [3 s, 10 s] par le moteur : en dessous de trois
 *                 secondes il l'etire, et le pistolet tombe plus tard qu'on ne
 *                 l'a demande. Voir `dessinerLeDepart`.
 */
export function rejouerCourse(
  epreuve: string,
  coureurs: CoureurRejeu[],
  dansMs = 3500,
  filmer = true,
  intitule: Intitule = { titre: '', sousTitre: '' },
): boolean {
  const app = SprinterApp;
  if (!app || !coureurs || coureurs.length === 0) return false;
  const G = app.G;
  annulerLeRappel();

  // LE FORFAIT N'EST PAS SUR LA PISTE. Il n'est pas venu : son couloir reste
  // vide, et il n'apparait qu'au tableau. Tout ce qui suit place `enPiste`.
  const toute = coureurs;
  coureurs = coureurs.filter(c => c.motif !== 'forfait');
  if (coureurs.length === 0) return false;
  // Ceux qui partiront trop tot : ils prennent le premier depart, puis le
  // rappel les sort (voir lancerLeDepartDuRejeu).
  const fautifs = coureurs.filter(c => c.motif === 'faux_depart');

  // Le pire chrono de la course sert de base aux abandons : ils finissent
  // derriere tout le monde, ce qui est exact, plutot que de disparaitre.
  const chronos = coureurs.map(c => c.ms).filter((m): m is number => m != null);
  const pire = chronos.length ? Math.max(...chronos) : 12000;
  const secondes = (c: CoureurRejeu) => (c.ms == null ? pire + RETARD_ABANDON_MS : c.ms) / 1000;

  // Qui la camera suit : le coureur demande, sinon le vainqueur — c'est lui
  // qu'on veut cadrer quand on ne connait personne dans la course.
  //
  // Jamais un fautif : il quitte la piste au rappel, et la camera avec lui.
  const regulier = coureurs.filter(c => c.motif !== 'faux_depart');
  const candidats = regulier.length ? regulier : coureurs;
  const suivi = candidats.find(c => c.suivi) || candidats.find(c => c.moi)
    || candidats.reduce((a, b) => (secondes(b) < secondes(a) ? b : a));

  /**
   * L'APPARENCE SE DERIVE DU NOM, comme partout ailleurs dans le jeu.
   *
   * `Runner` calcule son allure a la construction, depuis le nom qu'on lui
   * donne : `lookFor(nom, pool)` — morphologie, carnation, maillot, chaussures.
   * Renommer un coureur apres coup, ce que fait ce module, laisse donc en
   * place l'apparence du figurant qu'il remplace : « Jules Bonnet » courait
   * sous les traits de Blaze Kade, et le coureur suivi sous ceux du joueur.
   * Deux personnes qui se connaissent ne se reconnaissaient pas sur la course
   * qu'elles venaient de courir.
   *
   * On recalcule donc, avec le pool de l'etape — le meme que celui dont le jeu
   * se sert pour dessiner un fantome ou un adversaire de cette etape-la.
   */
  const niveau = niveauDuLieu(intitule.lieu);
  const pool = SprinterCore?.LEVELS?.[niveau]?.pool;
  const habiller = (r: any, c: CoureurRejeu) => {
    if (c.moi) { r.look = SprinterCore.PLAYER_LOOK; return; }
    if (SprinterCore?.lookFor) r.look = SprinterCore.lookFor(c.nom, pool);
  };

  // Monte la piste et son plateau : huit couloirs, decompte suspendu
  // (`startLive` laisse `countT` a −99 tant que le depart n'est pas pose).
  // `autres: []` est volontaire — on ne branche aucun adversaire reseau, on
  // garde les sept coureurs que `buildLevel` a poses et on les repeint.
  app.startLive([epreuve], { levelIdx: niveau, adversaire: '', autres: [] });

  // LA MUSIQUE DU CHAMPIONNAT, AUSSI EN REJEU (26/09). Le lien « Regarder »
  // et « Revoir la course » passent par ici, et jouaient la musique ordinaire
  // du jeu. Le morceau du tour se charge maintenant ; la presentation, le
  // pistolet et le rappel du rejeu le pilotent comme ceux de la salle.
  musique = !!(intitule.fr && intitule.course?.phase);
  if (musique) entrerDansLeTour(intitule.course!.phase);
  else arreterLaMusique();

  const ia = G.runners.filter((r: any) => !r.isPlayer);
  const aPlacer = coureurs.filter(c => c !== suivi);

  // LE COULOIR DE CHACUN, NOTE QUAND ON L'Y POSE.
  //
  // Le tableau d'arrivee l'affiche, et il doit etre celui que la liste de
  // depart a annonce. Le retrouver apres coup en cherchant le nom dans
  // `G.runners` marcherait presque : deux homonymes dans une meme finale —
  // deux « Martin » d'un championnat de France — rendraient le premier des
  // deux couloirs aux deux. On note la correspondance a la source, une fois.
  const couloirDe = new Map<CoureurRejeu, number>();
  // Et le coureur du moteur de chacun, avec son chrono vise : le rappel remet
  // tout le monde dans ses blocs, neuf, et il faut alors rendre a chacun le
  // chrono qu'il doit courir.
  const coureurDe = new Map<CoureurRejeu, any>();

  // LE COUREUR SUIVI COURT DANS SON COULOIR, ET PAS DANS CELUI DU JOUEUR.
  //
  // Il prend la place de `G.player` (voir l'en-tete du module) et heritait donc
  // du couloir 3, celui que le jeu donne au joueur. Tant que rien n'affichait
  // de numero, cela ne se voyait pas ; mais cela decalait TOUS les autres d'un
  // cran des que le suivi ne venait pas du 3, et le couloir annonce avant la
  // course n'etait plus celui qu'on voyait courir. On echange donc les deux
  // couloirs — `lane` n'est lu qu'au dessin (`T.pos(r.d, r.lane)`), rien n'en
  // est derive a la construction, et la camera suit le joueur ou qu'il soit.
  if (suivi.couloir != null) {
    const occupant = ia.find((r: any) => r.lane + 1 === suivi.couloir);
    if (occupant) {
      const sienne = G.player.lane;
      G.player.lane = occupant.lane;
      occupant.lane = sienne;
    }
  }

  // CHACUN SUR LE COULOIR QU'IL A COURU.
  //
  // Premiere passe : ceux dont on connait le couloir vont sur le couloir du
  // meme numero. Deuxieme passe : les autres — une liste sans couloirs, un
  // champ manquant — comblent ce qui reste dans l'ordre ou ils sont arrives,
  // ce qui est exactement l'ancien comportement quand personne n'a de couloir.
  const ordonnes = [...ia].sort((a: any, b: any) => a.lane - b.lane);
  const assigne = new Map<any, CoureurRejeu>();
  const places = new Set<CoureurRejeu>();
  for (const c of aPlacer) {
    if (c.couloir == null) continue;
    const r = ordonnes.find((x: any) => x.lane + 1 === c.couloir && !assigne.has(x));
    if (r) { assigne.set(r, c); places.add(c); }
  }
  const restants = aPlacer.filter(c => !places.has(c));
  for (const r of ordonnes) {
    if (assigne.has(r)) continue;
    const c = restants.shift();
    if (c) assigne.set(r, c);
  }

  ordonnes.forEach((r: any) => {
    const c = assigne.get(r);
    if (!c) {
      // Plus de couloirs que de partants : on retire le figurant plutot que de
      // le laisser courir un chrono invente a cote d'une vraie course.
      r.horsCourse = true;
      return;
    }
    r.name = c.nom;
    couloirDe.set(c, r.lane + 1);
    coureurDe.set(c, r);
    habiller(r, c);
    r.setPace(secondes(c));
    // NI CERCEAU NI PASTILLE.
    //
    // Huit cercles de couleur et huit etiquettes suspendues, c'est l'interface
    // d'un jeu ; une finale n'en a pas. Les athletes ont ete presentes un par
    // un, la piste porte ses numeros de couloir devant les blocs, et chacun
    // reste dans le sien du depart a l'arrivee : il n'en faut pas plus pour
    // suivre quelqu'un sur dix secondes. Le numero revient ecrit apres la
    // ligne, dans le tableau, parce que celui du sol est hors cadre des les
    // premiers metres. Le repere reste pour le joueur, et pour lui seul —
    // voir plus bas.
    r.repere = null;
  });
  G.runners = G.runners.filter((r: any) => !r.horsCourse);

  // Le coureur suivi prend la place du joueur — son nom, son allure, et son
  // apparence : il n'est « le joueur » que s'il l'est vraiment.
  G.player.name = suivi.nom;
  couloirDe.set(suivi, G.player.lane + 1);
  coureurDe.set(suivi, G.player);
  habiller(G.player, suivi);
  G.player.setPace(secondes(suivi));
  // LE SEUL REPERE QUI RESTE EST CELUI DU JOUEUR, et il ne s'allume que s'il
  // courait vraiment cette course-la. Se retrouver soi-meme parmi huit est la
  // premiere chose qu'on cherche ; c'est aussi la seule qu'aucune liste de
  // depart ne peut donner en pleine course. Un spectateur, lui, n'a personne a
  // retrouver : la piste reste nue.
  G.player.repere = suivi.moi
    ? { couleur: app.couleurCouloir(G.player.lane + 1), nom: app.N.t('you'), moi: true }
    : null;

  // Le favori du HUD, c'est le vainqueur de cette course-la et pas un nom tire
  // du plateau de la campagne.
  const meilleur = coureurs.reduce((a, b) => (secondes(b) < secondes(a) ? b : a));
  G.champion = meilleur.nom;
  G.championTime = secondes(meilleur);

  // Apres l'armement, jamais avant : `buildLevel` eteint le drapeau.
  G.rejeu = true;

  // L'EN-TETE DE LA RETRANSMISSION, pose sur `G` pour que le pinceau du film
  // le trouve sans avoir a remonter jusqu'ici — voir `bandeau-rejeu.ts`, qui
  // explique pourquoi il ne peut pas lire l'etat du rejeu.
  G.rejeuBandeau = intitule.competition
    ? {
        competition: intitule.competition,
        course: intitule.titre || intitule.sousTitre,
        quand: intitule.quand ?? null,
        // Seul le TEXTE part dans le film : une voix ne se peint pas, et la
        // bande-son de la prise est celle du stade.
        mot: intitule.mot && intitule.mot.texte
          ? { nom: intitule.mot.nom, texte: intitule.mot.texte }
          : null,
      }
    : null;

  // La grille telle qu'elle sera annoncee avant le pistolet : les couloirs
  // reels du moteur, et non l'ordre de la liste d'entree — c'est cette
  // liste-la que le spectateur va comparer avec ce qu'il voit sur la piste.
  const partantDe = new Map<any, CoureurRejeu>([...coureurDe].map(([c, r]) => [r, c]));
  const grille = [...G.runners]
    .map((r: any) => ({ couloir: r.lane + 1, nom: r.name, cle: partantDe.get(r)?.cle }))
    .sort((a, b) => a.couloir - b.couloir);
  // Les fiches partent maintenant, pas a l'arrivee du premier athlete : le
  // generique leur laisse deux secondes et demie pour revenir.
  const fiches = intitule.course?.edition
    ? { edition: intitule.course.edition, avant: intitule.quand ?? null, epreuve }
    : null;
  if (fiches) {
    void chargerFiches(fiches, grille.map(g => g.cle).filter((c): c is string => !!c));
  }
  poser({
    actif: true, phase: 'presentation',
    titre: intitule.titre, sousTitre: intitule.sousTitre, epreuve,
    grille, fiches, arrivee: null,
    course: intitule.course ?? null,
    mot: intitule.mot ?? null,
    rappel: null,
    fr: !!intitule.fr,
  });

  // CE QUI SE PASSE QUAND LE HUITIEME A FRANCHI LA LIGNE.
  //
  // Le moteur appelle ce rappel (voir engine.ts), et l'ordre compte : la
  // prise se ferme AVANT le retour a l'accueil. Le crochet du film jette
  // toute prise encore en cours d'enregistrement quand l'etat revient a
  // « title » — une camera qu'on laisserait tourner jusque-la perdrait la
  // course qu'elle vient de filmer, sans une erreur.
  //
  // Le genre est « direct », et pas « oneshot » : c'est ce qui met la prise
  // hors d'atteinte de la regle qui jette les films du one shot en quittant
  // une course.
  //
  // ET ON NE RENTRE PAS TOUT DE SUITE. La course finie, l'ecran passe au
  // tableau : place, nom, chrono. C'est la reponse a « qui vient de courir »
  // qu'on a retiree de la piste, et c'est aussi ce qu'on regarde deux fois
  // quand l'arrivee s'est jouee en centiemes. Le retour a l'accueil attend
  // que le spectateur ferme le tableau (voir `fermerRejeu`).
  G.rejeuFin = () => {
    // Les arrives au chrono, puis ceux qui n'en ont pas, chacun avec sa
    // raison : l'abandon, le carton rouge, le forfait — dans cet ordre, et
    // sans rang. Une course remplie au harnais n'a pas de motif : ses
    // abandons gardent leur place derriere tout le monde, comme avant.
    const RANG = { abandon: 1, faux_depart: 2, forfait: 3 } as Record<string, number>;
    const avecMotif = (c: CoureurRejeu) => !!c.motif && c.ms == null;
    const arrives = toute.filter(c => !avecMotif(c)).sort((a, b) => secondes(a) - secondes(b));
    const autres = toute.filter(avecMotif)
      .sort((a, b) => (RANG[a.motif!] || 9) - (RANG[b.motif!] || 9));
    const tableau = () => poser({
      ...etat, phase: 'arrivee',
      arrivee: [
        ...arrives.map((c, i) => ({
          place: i + 1, nom: c.nom, ms: c.ms,
          // Le couloir du moteur d'abord — c'est celui qui a ete couru et
          // annonce. Celui de la liste d'entree ne sert que de repli : quand
          // il y a plus de couloirs que de partants, le moteur renumerote.
          couloir: couloirDe.get(c) ?? c.couloir ?? null,
        })),
        ...autres.map(c => ({
          place: null, nom: c.nom, ms: null, motif: c.motif,
          couloir: couloirDe.get(c) ?? c.couloir ?? null,
        })),
      ],
    });
    if (!filmer) return tableau();
    // La prise se ferme d'abord : le tableau n'a pas a entrer dans le film.
    void arreterLeFilm('direct').then(tableau, tableau);
  };

  // LE DEPART N'EST PAS DONNE ICI.
  //
  // La piste est montee, les huit sont dans leurs couloirs, et `startLive` a
  // laisse le decompte suspendu (`countT` a −99) : c'est exactement l'etat ou
  // le moteur joue la presentation — camera qui glisse d'un athlete a l'autre,
  // bras leves, foule. On le laisse dans cet etat le temps du generique et des
  // huit presentations ; c'est l'ecran qui rend la main en appelant
  // `lancerLeDepartDuRejeu` (voir RejeuChampionnat).
  //
  // Le faire ici obligerait a annoncer un depart a vingt secondes — que
  // `dessinerLeDepart` refuserait, sa sequence etant bornee a dix.
  departProgramme = {
    dansMs, filmer,
    fautifs: fautifs.map(c => ({
      coureur: coureurDe.get(c), nom: c.nom, couloir: couloirDe.get(c) ?? c.couloir ?? 0,
      ms: c.motif_ms ?? 0,
    })).filter(f => f.coureur),
    // Le chrono vise de chacun des autres, a rendre apres le rappel.
    allures: [...coureurDe.entries()]
      .filter(([c]) => c.motif !== 'faux_depart')
      .map(([c, r]) => [r, secondes(c)] as [any, number]),
  };
  return true;
}

/** Ce qu'il reste a faire quand la presentation s'acheve. */
let departProgramme: {
  dansMs: number; filmer: boolean;
  fautifs: { coureur: any; nom: string; couloir: number; ms: number }[];
  allures: [any, number][];
} | null = null;

/**
 * LE FAUX DEPART, REJOUE.
 *
 * La salle ne garde pas la course du premier depart — personne ne l'a finie —
 * mais elle garde qui est parti trop tot, et quand. C'est assez pour rejouer
 * ce que le stade a vu : le coup de pistolet, les huit qui partent, le double
 * coup de feu un tiers de seconde plus tard, le retour sur la ligne, le carton
 * rouge, le couloir qui se vide, et le nouveau depart. La scene est celle du
 * direct (rappelChamp dans le moteur), avec les memes durees.
 */
const RAPPEL_APRES_COUP_MS = 350;
/** La duree de la scene, la meme qu'en direct (RAPPEL_MS de la salle). */
const RAPPEL_MS = 6500;
const minuteursRappel: ReturnType<typeof setTimeout>[] = [];
/** Le rejeu en cours joue-t-il la musique du championnat ? */
let musique = false;

/**
 * La presentation du rejeu commence : le generique dure `avantMs`, puis `n`
 * athletes. La musique cale ses blocs dessus, comme en direct.
 */
export function presentationDuRejeu(avantMs: number, n: number) {
  if (musique) presentationAnnoncee(avantMs, n);
}
function annulerLeRappel() {
  while (minuteursRappel.length) clearTimeout(minuteursRappel.pop()!);
}

/**
 * La presentation est finie : le starter peut appeler.
 *
 * Appelee par l'ecran, une seule fois. C'est ici que la camera commence a
 * tourner, et pas avant : un film qui contiendrait vingt secondes de
 * presentation ne serait plus une course.
 */
export function lancerLeDepartDuRejeu() {
  const d = departProgramme;
  if (!d) return;
  departProgramme = null;
  poser({ ...etat, phase: 'course' });
  SprinterApp.liveDepart(d.dansMs, null);
  if (musique) pistoletAnnonce(d.dansMs);
  if (d.filmer) programmerLeFilm('direct', d.dansMs);
  if (!d.fautifs.length) return;
  minuteursRappel.push(setTimeout(() => {
    const G = SprinterApp.G;
    if (!G.rejeu) return;
    poser({ ...etat, rappel: {
      fautifs: d.fautifs.map(f => ({ id: f.nom, nom: f.nom, couloir: f.couloir, ms: f.ms })),
      debut: Date.now(),
    } });
    SprinterApp.rappelChamp([], false, d.fautifs.map(f => f.coureur));
    if (musique) rappelSiffle();
    minuteursRappel.push(setTimeout(() => {
      if (!SprinterApp.G.rejeu) return;
      SprinterApp.finRappelChamp(d.dansMs, null, () => {
        for (const [r, s] of d.allures) r.setPace(s);
      });
      if (musique) pistoletAnnonce(d.dansMs);
      poser({ ...etat, rappel: null });
    }, RAPPEL_MS));
  }, d.dansMs + RAPPEL_APRES_COUP_MS));
}

/** Vrai si une course rejouee est en train de se derouler. */
export function enRejeu(): boolean {
  const G = SprinterApp?.G;
  return !!(G && G.rejeu && (G.state === 'count' || G.state === 'race'));
}
