// LES STADES DE LA LEGENDE, inscrits dans la table du moteur — a l'execution.
//
// Une etape de la Legende EST un 100 m couru dans un stade hors serie, comme
// une nuit du molosse ou un defi de vedette : le moteur pose la piste et sept
// adversaires, le reste se greffe par-dessus (game/legende/legende.ts).
//
// POURQUOI PAS DANS STADES_HORS_SERIE (sprinter-core.js). Ce qui y est ecrit
// VOYAGE : le moteur publie la liste sur un global, et un bundler ne peut pas
// suivre ce qui passe par un global — un stade ferme y est inatteignable, pas
// absent, et ses noms partent dans le paquet public. La Legende ne doit etre
// ni visible ni accessible hors du canal de test (consigne de l'auteur) ; ses
// dix lieux et leurs boss s'inscrivent donc ICI, depuis un morceau que la
// production n'a pas, au moment ou l'on ouvre la Legende.
//
// ILS PASSENT EN DERNIER, ET C'EST LE CONTRAT D'ORDRE QUI LE DEMANDE. L'index
// d'un stade voyage avec les courses (historique, classement, LEVEL_NAMES —
// voir la boucle qui remplit LEVELS dans sprinter-app.js). Poses a la fin,
// apres tous les stades du canal de test, ils ne decalent l'index d'aucun
// autre. Le leur, lui, n'est pas garanti d'une version a l'autre : on le
// relit donc toujours par la clef (`indexDuLieu`), jamais en dur.

import { ETAPES, type Lieu } from './etapes';
// LES CORPS DES BOSS, faits dans Tripo et rigges par vedette_tripo.py. Sous
// src/assets/legende/ et non dans public/ : hors du canal de test, le greffon
// HORS_PRODUCTION de vite.config.ts ne resout jamais ces imports.
import kouassiGlb from '@/assets/legende/boss/kouassi.glb?url';
import damionGlb from '@/assets/legende/boss/damion.glb?url';
import keremGlb from '@/assets/legende/boss/kerem.glb?url';
import zenithGlb from '@/assets/legende/boss/zenith.glb?url';
import wukongGlb from '@/assets/legende/boss/wukong.glb?url';
import anansiGlb from '@/assets/legende/boss/anansi.glb?url';
import soraGlb from '@/assets/legende/boss/sora.glb?url';
import marcGlb from '@/assets/legende/boss/marc.glb?url';
import yassineGlb from '@/assets/legende/boss/yassine.glb?url';
import theoGlb from '@/assets/legende/boss/theo.glb?url';
import jaydenGlb from '@/assets/legende/boss/jayden.glb?url';
import oliverGlb from '@/assets/legende/boss/oliver.glb?url';
import hermesGlb from '@/assets/legende/boss/hermes.glb?url';
import intiGlb from '@/assets/legende/boss/inti.glb?url';

/**
 * LA DIFFICULTE, ETAPE PAR ETAPE, au 100 m. L'auteur, le 06/10 : « baisse le
 * temps du premier niveau a 8,99, garde le temps du dernier niveau et retranche
 * un dixieme jusqu'au dernier » — 8,99, 8,89, 8,79, 8,69, 8,59, puis 8,42.
 *
 * La Legende s'ouvre a qui a gagne 99 carrieres, donc battu 99 fois la finale
 * ZEZE (8,75 a 9,00 s). L'echelle classique (RACES['100'].ranges) lui serait
 * une promenade. Celle-ci part plus haut et finit plus bas : la plage se gagne
 * a l'echauffement, Hermes court au niveau du meilleur ZEZE, et l'apotheose
 * se joue a quelques centiemes du defi de Meba-Mickael Zeze (8,39 s).
 *
 * `plateau` : la fourchette des six autres couloirs. `boss` : son chrono, FIXE
 * (`cibles`), pour que le battre ne depende pas du tirage — c'est la regle des
 * vedettes. Le boss est toujours le plus rapide du plateau.
 */
export const DIFFICULTE: { plateau: [number, number]; boss: number }[] = [
  { plateau: [9.11, 9.39], boss: 8.99 },      // la plage
  { plateau: [9.01, 9.29], boss: 8.89 },      // le regional
  { plateau: [8.91, 9.19], boss: 8.79 },      // le national
  { plateau: [8.81, 9.09], boss: 8.69 },      // le mondial
  { plateau: [8.71, 8.99], boss: 8.59 },      // Karman — Hermes
  { plateau: [8.50, 8.75], boss: 8.42 },      // l'apotheose, gardee
];

/** Le remplissage des gradins (fouleDe, sprinter-app.js), de la plage a l'apotheose. */
const FOULE = [0.12, 0.55, 0.78, 0.97, 1.0, 1.0];

// LES CARNATIONS DE CHAQUE LIEU. Le tirage d'un plateau (lookFor) puise dans
// une liste nommee ; celles-ci s'ajoutent a SKIN_POOL a l'inscription. Un
// plateau de quartier a San-Pedro ou de Kyoto qui tirerait dans les onze
// carnations du plateau `divers` ne ressemblerait a aucun des deux.
const CARNATIONS: Record<string, string[]> = {
  'legende-ci': ['ebene', 'cacao', 'acajou', 'noisette'],
  'legende-jp': ['porcelaine', 'clair', 'sable', 'miel'],
  'legende-es': ['clair', 'sable', 'olive', 'miel', 'noisette'],
  'legende-ma': ['olive', 'miel', 'ambre', 'bronze', 'sable', 'noisette'],
  'legende-ng': ['ebene', 'cacao', 'acajou'],
  'legende-jm': ['ebene', 'cacao', 'acajou', 'noisette'],
  'legende-tr': ['clair', 'sable', 'olive', 'miel', 'ambre'],
};
const POOL_DU_LIEU: Record<string, string> = {
  menole: 'legende-ci', kyoto: 'legende-jp', kingston: 'legende-jm', izmir: 'legende-tr',
  // l'Olympe : des coureurs de toutes les legendes, toutes les carnations
  karman: 'divers', 'karman-wukong': 'divers', 'karman-anansi': 'divers', 'karman-inti': 'divers',
  barcelone: 'legende-es', casablanca: 'legende-ma', abuja: 'legende-ng',
};

/**
 * Le chemin d'un maillage tel que vedette-3d.ts l'attend : relatif a la base
 * du site, qu'il remet lui-meme devant (url(), vedette-3d.ts). Vite rend une
 * adresse deja prefixee (/test/assets/... une fois construit) : on retire ce
 * prefixe, sans quoi il serait double.
 */
function cheminDuMaillage(adresse: string): string | null {
  if (!adresse) return null;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const a = adresse.startsWith(base) ? adresse.slice(base.length) : adresse;
  return a.replace(/^\//, '');
}

/**
 * LES BOSS : leur maillage Tripo, et leur doublure en tubes.
 *
 * Chaque corps est fait dans Tripo (Smart Mesh + texture) puis rigge, BENBEZI
 * floque sur la tenue, par vedette_tripo.py (`corps`). Le look garde ce que
 * les tubes savent dessiner — couleurs proches de la texture, silhouette,
 * accessoire — car ce sont eux qu'on voit tant que le maillage charge. Ils
 * entrent dans VEDETTES, que `lookFor` consulte avant de tirer un coureur au
 * hasard.
 */
/**
 * Ce qu'un boss qui a son maillage ajoute a son look : le fichier, et l'ecart
 * des epaules et des hanches (`sh`, `hip`) que vedette_tripo.py a LUS sur lui
 * (ligne MORPH de son journal), pour que les mains et les pieds du jeu tombent
 * sur les siens. Les tubes du look restent sa doublure le temps qu'il charge.
 */
function corps(glb: string, sh: number, hip: number) {
  return { morph: { sh, hip }, maillage: cheminDuMaillage(glb), facettes: 48, lisse: true };
}

function looksDesBoss(look: (o: any) => any, SKIN: Record<string, number[]>): Record<string, any> {
  const or: [number, number, number] = [222, 178, 70];
  return {
    // LE MAILLOT DE COTE D'IVOIRE (l'auteur, 06/10) : orange, col et manches
    // verts — sans ecusson ni equipementier, ce sont des marques. Pieds nus :
    // la chaussure prend la couleur de la peau. SON CORPS EST UN MAILLAGE
    // (kouassi.glb) ; `sh` et `hip` sont ceux que vedette_tripo.py lit sur lui
    // (0,73 / 1,14), pour que les mains et les pieds du jeu tombent sur les
    // siens. Les tubes restent sa doublure le temps qu'il charge.
    'Kouassi': look({ build: 'm', skin: [122, 65, 47], jersey: [244, 130, 34], shorts: [244, 244, 240],
      shoe: [122, 65, 47], hair: 'shaved', h: 1.60, gait: 'sharp',
      chaine: [238, 230, 210], ...corps(kouassiGlb, 0.73, 1.14) }),
    'Sora Kanzaki': look({ build: 'm', skin: 'clair', jersey: [246, 244, 240], shorts: [222, 58, 34],
      shoe: [230, 66, 38], hair: 'crop', hairCol: [24, 20, 22], h: 1.76, gait: 'sharp',
      poignet: { col: [222, 58, 34], cote: 1 }, ...corps(soraGlb, 1.02, 1.05) }),
    'Damion Clarke': look({ build: 'm', skin: 'cacao', jersey: [0, 140, 70], shorts: [22, 22, 26],
      shoe: [250, 204, 40], hair: 'fade', h: 1.84, gait: 'whip',
      poignet: { col: [250, 204, 40], cote: 1 }, ...corps(damionGlb, 1.05, 1.03) }),
    'Kerem Aydın': look({ build: 'm', skin: 'olive', jersey: [214, 30, 40], shorts: [244, 244, 240],
      shoe: [244, 244, 240], hair: 'crop', hairCol: [30, 22, 18], h: 1.85, gait: 'power',
      barbe: [30, 22, 18], ...corps(keremGlb, 1.24, 1.22) }),
    'Marc Puig': look({ build: 'm', skin: 'olive', jersey: [40, 168, 196], shorts: [244, 150, 40],
      shoe: [244, 196, 40], hair: 'fade', hairCol: [44, 30, 22], h: 1.82, gait: 'whip',
      lunettes: [30, 30, 36], ...corps(marcGlb, 1.11, 1.01) }),
    'Yassine Benali': look({ build: 'm', skin: 'ambre', jersey: [20, 116, 72], shorts: [176, 30, 42],
      shoe: [244, 240, 232], hair: 'crop', hairCol: [24, 18, 16], h: 1.92, gait: 'base',
      poignet: { col: [120, 72, 40], cote: -1 }, ...corps(yassineGlb, 0.95, 0.95) }),
    'Chidi Okafor': look({ build: 'm', skin: 'ebene', jersey: [22, 150, 82], shorts: [30, 140, 80],
      shoe: [22, 150, 82], hair: 'flattop', h: 1.86, gait: 'power',
      morph: { sh: 1.14, hip: 1.02, arm: 1.16, leg: 1.10 } }),
    'Théo Garnier': look({ build: 'm', skin: 'clair', jersey: [26, 36, 92], shorts: or,
      shoe: or, hair: 'crop', hairCol: [22, 18, 16], h: 1.84, gait: 'whip',
      barbe: [30, 22, 18], ...corps(theoGlb, 1.19, 1.08) }),
    'Jayden Brooks': look({ build: 'm', skin: 'cacao', jersey: [20, 20, 24], shorts: or,
      shoe: or, hair: 'fade', h: 1.83, gait: 'power', chaine: or,
      bandeau: [20, 20, 24], ...corps(jaydenGlb, 1.24, 1.23) }),
    'Oliver Hart': look({ build: 'm', skin: 'porcelaine', jersey: [118, 24, 40], shorts: [30, 26, 34],
      shoe: [246, 220, 190], hair: 'crop', hairCol: [148, 74, 38], h: 1.88, gait: 'base',
      barbe: [148, 74, 38], poignet: { col: or, cote: 1 }, ...corps(oliverGlb, 1.27, 1.14) }),
    // Le plus rapide des dieux grecs : tout d'or et de blanc, le bandeau pour
    // le casque aile, les pointes d'or pour les sandales.
    'Hermès': look({ build: 'm', skin: 'miel', jersey: [248, 246, 240], shorts: or,
      shoe: [240, 200, 90], hair: 'crop', hairCol: [176, 132, 64], h: 1.86, gait: 'whip',
      bandeau: [240, 200, 90], ...corps(hermesGlb, 0.66, 0.98) }),
    // Le Roi Singe : armure d'or, cape rouge que les tubes ne portent pas, et
    // le cercle d'or sur le front.
    'Sun Wukong': look({ build: 'm', skin: 'ambre', jersey: [232, 182, 52], shorts: [190, 30, 30],
      shoe: [190, 30, 30], hair: 'crop', hairCol: [120, 70, 30], h: 1.70, gait: 'whip',
      bandeau: [240, 200, 80], ...corps(wukongGlb, 1.26, 1.30) }),
    // Anansi : les couleurs du kente, or, vert et rouge.
    'Anansi': look({ build: 'm', skin: 'ebene', jersey: [232, 172, 30], shorts: [20, 120, 60],
      shoe: [180, 30, 30], hair: 'shaved', h: 1.78, gait: 'sharp',
      poignet: { col: [180, 30, 30], cote: 1 }, ...corps(anansiGlb, 0.78, 0.82) }),
    // Inti : la tunique rouge des textiles andins sous le disque d'or du
    // soleil, et le bandeau d'or. Les rayons de sa couronne sont retires du
    // maillage avant le rig : comptes dans sa taille, ils mettaient le cou
    // dans la tete et les epaules a 12 cm.
    'Inti': look({ build: 'm', skin: 'bronze', jersey: [190, 36, 40], shorts: [176, 30, 36],
      shoe: [244, 192, 40], hair: 'crop', hairCol: [20, 16, 14], h: 1.84, gait: 'power',
      bandeau: [250, 210, 60], ...corps(intiGlb, 1.45, 1.31) }),
    // Un corps de lumiere, nu et violet d'un bout a l'autre, veine d'or : la
    // carnation n'est pas humaine, comme le vert du stade des Trois Soleils.
    'Zénith': look({ build: 'm', skin: [118, 84, 206], jersey: [104, 70, 196], shorts: [92, 58, 180],
      shoe: [118, 84, 206], hair: 'shaved', h: 1.95, gait: 'whip',
      ...corps(zenithGlb, 1.03, 1.04) }),
  };
}

const CLE = (l: Lieu) => `legende-${l.cle}`;

/** L'entree d'un lieu dans la table des etapes du moteur. */
export function stadeDe(l: Lieu, rang: number): any {
  const d = DIFFICULTE[rang];
  // LE BOSS AU COULOIR 5, juste a droite du joueur (couloir 4) : buildLevel
  // range les trois premiers noms aux couloirs 1 a 3 et les suivants a partir
  // du 5. C'est la place de Meba-Mickael Zeze et d'Aurel Manga dans leurs
  // defis — et celle pour laquelle leur entree a ete reglee (entrerEnBoss,
  // engine.ts : son chemin evite le couloir 6).
  const names = [...l.plateau.slice(0, 3), l.boss, ...l.plateau.slice(3)];
  return {
    cle: CLE(l), name: l.nom, theme: l.theme,
    pool: POOL_DU_LIEU[l.cle] || (rang >= 3 ? 'sprint' : 'divers'),
    horsSerie: true,
    // Ni ouvert ni choisissable : ces stades n'existent que pour la Legende,
    // et seulement sur le canal de test (on n'arrive ici que par lui). Sur ce
    // canal, `reserve` ne suffit pas a les cacher du choix du lieu en one shot
    // — c'est `legende` qui le fait (ModePanels.tsx). Pas `evenement` : il
    // retirerait aussi au joueur le skin qu'il porte (vestiaire.ts).
    ouvert: false, reserve: true, legende: true,
    foule: FOULE[rang],
    plateau: { '100': d.plateau },
    cibles: { '100': { [l.boss]: d.boss } },
    names,
  };
}

let inscrits = false;

/**
 * Inscrire les dix lieux dans LEVELS et leurs noms dans LEVEL_NAMES, une fois.
 * Sans effet hors du navigateur (harnais) : il n'y a pas de moteur a remplir.
 */
export function inscrireLesStades(): void {
  if (inscrits) return;
  const K = (globalThis as any).SprinterCore;
  const N = (globalThis as any).SprinterI18N;
  if (!K || !K.LEVELS) return;
  inscrits = true;
  for (const [pool, peaux] of Object.entries(CARNATIONS)) K.SKIN_POOL[pool] = peaux;
  Object.assign(K.VEDETTES, looksDesBoss(K.look, K.SKIN));
  ETAPES.forEach((e, rang) => {
    for (const l of e.lieux) {
      if (K.LEVELS.some((s: any) => s && s.cle === CLE(l))) continue;
      const idx = K.LEVELS.length;
      K.LEVELS.push(stadeDe(l, rang));
      // Par l'index et non par push : LEVEL_NAMES suit LEVELS, mais rien ne
      // garantit qu'il en ait exactement la longueur sur ce canal.
      if (N && N.LEVEL_NAMES) N.LEVEL_NAMES[idx] = [l.nom, l.nom];
    }
  });
}

/** L'index du stade d'un lieu dans LEVELS, ou -1. */
export function indexDuLieu(l: Lieu): number {
  const K = (globalThis as any).SprinterCore;
  if (!K || !K.LEVELS) return -1;
  return K.LEVELS.findIndex((s: any) => s && s.cle === CLE(l));
}
