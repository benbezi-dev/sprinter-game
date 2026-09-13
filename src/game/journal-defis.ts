// Le journal des defis : qui nous a defies, et ce qu'on en a fait.
//
// Rien de tout cela n'existait quelque part ou on puisse le relire. Un defi
// recu vit dans la boite du serveur jusqu'a ce qu'on le releve, puis il
// disparait. Une invitation a courir en direct dure dix minutes, et celle
// qu'on laisse passer ne laisse aucune trace : la personne a essaye de nous
// joindre, on n'etait pas la, et le lendemain on ne sait meme plus qu'elle
// a essaye. Le resultat d'un duel s'annonce une fois, et s'efface avec la
// fenetre qui l'annonce.
//
// D'ou ce journal, tenu SUR L'APPAREIL et nulle part ailleurs. Il ne demande
// rien au serveur, il note ce qui lui passe sous les yeux : un defi arrive,
// une invitation expire, un duel se tranche. Il sert a une seule chose, et
// c'est sa mesure — retrouver le nom de quelqu'un pour le redefier.
//
// UNE SEMAINE, PAS UN JOUR DE PLUS. Ce n'est pas une archive : un defi
// manque il y a trois semaines ne se rattrape plus, et une liste qui garde
// tout finit par ne plus rien montrer. Ce qui depasse sept jours s'efface, a
// la lecture comme a l'ecriture, sans qu'on ait rien a declencher.

const CLE = 'sprinter_journal_defis';

/** Sept jours. La duree de vie d'une ligne, et toute la regle de menage. */
export const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Un plafond de securite : le stockage local n'est pas extensible. */
const MAX = 300;

/**
 * De quoi vient la ligne.
 *
 * 'defi'   — un defi differe, celui qui se releve quand on a le temps.
 * 'direct' — une invitation a courir maintenant, qui expire toute seule.
 */
export type GenreDefi = 'defi' | 'direct';

/** De quel cote on etait : on l'a recu, ou c'est nous qui l'avons lance. */
export type SensDefi = 'recu' | 'lance';

export type EtatDefi =
  | 'attente'   // il nous attend, et il est encore relevable
  | 'manque'    // personne ne l'a releve : expire, refuse, ou laisse passer
  | 'releve'    // on est parti courir ; l'issue n'est pas encore connue
  | 'gagne' | 'perdu' | 'nul';

/**
 * L'ordre dans lequel un etat peut en remplacer un autre.
 *
 * Le journal se fait ecrire par plusieurs endroits qui ne se parlent pas — la
 * boite aux defis sonde, l'invitation en direct decompte, l'annonce des duels
 * interroge de son cote — et le sondage repasse sur des lignes deja tranchees.
 * Sans cet ordre, un defi gagne redeviendrait « en attente » a la seconde
 * suivante, simplement parce qu'il figure encore dans la boite.
 */
const RANG: Record<EtatDefi, number> = {
  attente: 0, manque: 1, releve: 2, gagne: 3, perdu: 3, nul: 3,
};

export type EntreeDefi = {
  /** Identifiant stable : `defi:<code>` ou `direct:<id>`. */
  cle: string;
  genre: GenreDefi;
  sens: SensDefi;
  /** L'autre, tel qu'il s'affiche. Vide quand on ne le connait pas. */
  nom: string;
  /** Les epreuves du defi, pour pouvoir en relancer un pareil. */
  epreuves: string[];
  /** Quand la ligne est nee. C'est cette date qui decide de l'oubli. */
  at: number;
  etat: EtatDefi;
  /** Dernier changement d'etat : sert a ordonner l'historique. */
  maj: number;
  /** Pour une invitation en direct : l'heure ou elle cesse d'etre relevable. */
  expire?: number;
  /** Ce que le duel a rapporte, quand il s'est joue. */
  lp?: number;
  mon_ms?: number;
  son_ms?: number;
};

/** Ce que le journal accepte qu'on lui donne : le reste, il le complete. */
export type Depot = {
  cle: string;
  genre: GenreDefi;
  sens: SensDefi;
  etat: EtatDefi;
  nom?: string;
  epreuves?: string[];
  at?: number;
  expire?: number;
  lp?: number;
  mon_ms?: number;
  son_ms?: number;
};

const ecouteurs = new Set<() => void>();

/** Prevenu a chaque ecriture : l'ecran ouvert se remet a jour sans sondage. */
export function surJournal(f: () => void): () => void {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

function prevenir() {
  for (const f of [...ecouteurs]) {
    try { f(); } catch { /* un ecouteur casse n'empeche pas les autres */ }
  }
}

function valide(x: any): EntreeDefi | null {
  if (!x || typeof x !== 'object') return null;
  const cle = String(x.cle || '');
  const genre: GenreDefi = x.genre === 'direct' ? 'direct' : 'defi';
  const sens: SensDefi = x.sens === 'lance' ? 'lance' : 'recu';
  const etat: EtatDefi = RANG[x.etat as EtatDefi] === undefined ? 'attente' : x.etat;
  const at = Number(x.at) || 0;
  if (!cle || !at) return null;
  return {
    cle, genre, sens, etat, at,
    nom: String(x.nom || ''),
    epreuves: Array.isArray(x.epreuves) ? x.epreuves.map(String) : [],
    maj: Number(x.maj) || at,
    expire: Number(x.expire) || undefined,
    lp: x.lp == null ? undefined : Number(x.lp),
    mon_ms: x.mon_ms == null ? undefined : Number(x.mon_ms),
    son_ms: x.son_ms == null ? undefined : Number(x.son_ms),
  };
}

/**
 * Le menage, applique partout ou le journal passe.
 *
 * Deux choses, et elles se font ensemble : on jette ce qui a plus d'une
 * semaine, et on constate les invitations perimees. Le constat compte autant
 * que l'oubli — une invitation en direct expire pendant que le telephone est
 * dans une poche, sans qu'aucun code ne tourne pour le voir. La declarer
 * manquee a la relecture est le seul moment ou on peut le faire honnetement.
 */
function menage(liste: EntreeDefi[], maintenant: number): EntreeDefi[] {
  const limite = maintenant - SEMAINE_MS;
  const gardees: EntreeDefi[] = [];
  for (const e of liste) {
    if (e.at < limite) continue;
    if (e.etat === 'attente' && e.expire && e.expire <= maintenant) {
      gardees.push({ ...e, etat: 'manque', maj: Math.max(e.maj, e.expire) });
    } else {
      gardees.push(e);
    }
  }
  gardees.sort((a, b) => b.at - a.at);
  return gardees.slice(0, MAX);
}

function brut(): EntreeDefi[] {
  try {
    const t = JSON.parse(localStorage.getItem(CLE) || '[]');
    if (!Array.isArray(t)) return [];
    return t.map(valide).filter((e): e is EntreeDefi => !!e);
  } catch {
    return [];
  }
}

function ecrire(liste: EntreeDefi[]) {
  try { localStorage.setItem(CLE, JSON.stringify(liste)); }
  catch { /* stockage plein ou refuse : le journal vaut ce qu'il vaut */ }
}

/**
 * Le journal, du plus recent au plus ancien, deja nettoye.
 *
 * Le nettoyage est reecrit quand il change quelque chose : sans quoi une
 * invitation perimee serait recalculee a chaque ouverture de l'ecran, et le
 * jour ou elle sortirait de la semaine elle partirait avec son etat d'origine.
 */
export function lireJournal(maintenant = Date.now()): EntreeDefi[] {
  const avant = brut();
  const apres = menage(avant, maintenant);
  if (apres.length !== avant.length ||
      apres.some((e, i) => e.etat !== avant[i]?.etat)) ecrire(apres);
  return apres;
}

/**
 * Poser une ligne, ou faire avancer celle qui existe deja.
 *
 * La date de naissance ne bouge jamais : c'est elle qui decide de l'oubli, et
 * un defi qu'on releve six jours plus tard ne doit pas repartir pour une
 * semaine. Un etat ne recule pas non plus — voir RANG.
 */
export function noterDefi(d: Depot, maintenant = Date.now()): void {
  if (!d.cle) return;
  const liste = menage(brut(), maintenant);
  const i = liste.findIndex(e => e.cle === d.cle);
  const ancien = i >= 0 ? liste[i] : null;

  /** Ce qui se voit a l'ecran. Le reste peut changer en silence. */
  const memeLigne = (a: EntreeDefi, b: EntreeDefi) =>
    a.etat === b.etat && a.nom === b.nom && a.lp === b.lp &&
    a.epreuves.join() === b.epreuves.join();

  if (ancien && RANG[d.etat] < RANG[ancien.etat]) {
    // L'etat recule : on ne le retient pas, mais le reste peut completer.
    // Un nom appris apres coup vaut mieux qu'une ligne anonyme.
    const fusion: EntreeDefi = {
      ...ancien,
      nom: d.nom || ancien.nom,
      epreuves: d.epreuves?.length ? d.epreuves : ancien.epreuves,
      expire: d.expire ?? ancien.expire,
    };
    liste[i] = fusion;
    ecrire(liste);
    if (!memeLigne(ancien, fusion)) prevenir();
    return;
  }

  // La date fournie est celle de l'evenement — un defi porte l'heure ou il a
  // ete lance. Quand elle est deja hors de la semaine, on prend celle du jour :
  // un defi vieux de huit jours qui nous attend toujours dans la boite doit
  // pouvoir s'inscrire, sinon le menage le jetterait a l'ecriture meme et la
  // ligne ne tiendrait jamais.
  const donnee = d.at || maintenant;
  const at = ancien ? ancien.at
    : (donnee < maintenant - SEMAINE_MS ? maintenant : donnee);
  const entree: EntreeDefi = {
    cle: d.cle,
    genre: d.genre,
    sens: d.sens,
    nom: d.nom || ancien?.nom || '',
    epreuves: d.epreuves?.length ? d.epreuves : (ancien?.epreuves || []),
    at,
    etat: d.etat,
    maj: maintenant,
    expire: d.expire ?? ancien?.expire,
    lp: d.lp ?? ancien?.lp,
    mon_ms: d.mon_ms ?? ancien?.mon_ms,
    son_ms: d.son_ms ?? ancien?.son_ms,
  };
  if (i >= 0) liste[i] = entree; else liste.unshift(entree);
  ecrire(menage(liste, maintenant));
  // Le sondage repose la meme ligne toutes les vingt secondes. Reveiller
  // l'ecran a chaque passage le ferait se redessiner pour rien ; on ne
  // previent que quand quelque chose a vraiment change de visage.
  if (!ancien || !memeLigne(ancien, entree)) prevenir();
}

/**
 * Ce que la boite aux defis ne contient plus est un defi qu'on n'a pas releve.
 *
 * A n'appeler QUE sur une reponse serveur reussie. Une boite vide parce que le
 * reseau a manque declarerait manques tous les defis qui nous attendent — et
 * c'est exactement ceux-la qu'on ne veut pas perdre de vue.
 *
 * Le delai de grace evite l'autre faux positif, plus sournois : le defi qu'on
 * vient de relever a disparu de la boite avant que la course ne commence.
 */
const GRACE_MS = 2 * 60 * 1000;

export function rapprocherBoite(ids: string[], maintenant = Date.now()): void {
  const vivants = new Set(ids.map(id => `defi:${id}`));
  const liste = menage(brut(), maintenant);
  let change = false;
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (e.genre !== 'defi' || e.sens !== 'recu' || e.etat !== 'attente') continue;
    if (vivants.has(e.cle) || maintenant - e.maj < GRACE_MS) continue;
    liste[i] = { ...e, etat: 'manque', maj: maintenant };
    change = true;
  }
  if (change) { ecrire(liste); prevenir(); }
}

/** Ceux qu'on peut redefier : ils ont tendu la main, on n'a pas repondu. */
export function aRedefier(maintenant = Date.now()): EntreeDefi[] {
  return lireJournal(maintenant)
    .filter(e => e.sens === 'recu' && (e.etat === 'attente' || e.etat === 'manque'));
}

/** Combien de mains tendues attendent encore une reponse. */
export function combienARelever(maintenant = Date.now()): number {
  return aRedefier(maintenant).length;
}

/** Tout oublier d'un coup. Sert aux tests, et a rien d'autre pour l'instant. */
export function viderJournal(): void {
  try { localStorage.removeItem(CLE); } catch { /* deja parti */ }
  prevenir();
}
