// L'image que le joueur emporte.
//
// Le partage existant envoie du texte : un code de defi, un lien, une phrase.
// Il marche, et il ne se voit pas — un code a six lettres dans une
// conversation ne ressemble a rien, et personne ne le republie. Une image, si.
//
// Rien de tout ceci ne passe par un serveur, et pour la meme raison que la
// video de la course : le jeu tourne sur des Workers Cloudflare, qui ne
// savent pas rasteriser, et la seule machine du circuit capable de dessiner
// cette image est celle qui vient de dessiner la course. Voir l'en-tete de
// game/review.ts, qui pose le meme raisonnement.
//
// Le trace lui-meme vit dans trace-affiche.js, partage avec l'atelier de
// publication du compte du jeu. Ce fichier-ci ne s'occupe que du reste :
// fabriquer le fichier, et le faire sortir de l'application.

// @ts-ignore — module JS pur, partage avec une page servie sans compilation.
import { dessinerCourse } from './trace-affiche.js';

export type Course = {
  /** Le chrono, en millisecondes. Le seul champ obligatoire. */
  chronoMs: number;
  /** Les epreuves courues : ['100'] ou ['100','200','400']. */
  epreuves?: string[];
  /** Le nom que le joueur s'est donne, s'il s'en est donne un. */
  nom?: string;
  /** Le fantome affronte, s'il y en avait un. */
  fantomeNom?: string;
  fantomeMs?: number | null;
  /** Le rang au classement, s'il est connu. */
  rang?: number | null;
  /**
   * Ceux qu'on a devances, dans l'ordre d'arrivee.
   *
   * Une course en direct se court contre quelqu'un, et l'image ne le disait
   * pas. `ms` peut manquer sur un abandon — l'affiche le dit alors au lieu de
   * calculer un ecart sur un chrono qui n'existe pas.
   */
  battus?: Array<{ nom: string; ms?: number | null; abandon?: boolean }>;
};

/** Le nom du fichier. Date en tete : il se range tout seul dans une pellicule. */
function nomDeFichier(c: Course): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const jour = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const t = (c.chronoMs / 1000).toFixed(2).replace('.', 'x');
  return `sprinter-${jour}-${t}s.jpg`;
}

/**
 * Fabrique l'image, en JPEG.
 *
 * JPEG et pas PNG : l'image est une photographie de nuit avec un degrade, ce
 * que le PNG compresse tres mal — trois fois le poids pour une difference que
 * personne ne verra, puisque Instagram et TikTok reencodent de toute facon. Et
 * le poids compte : cette image part par la feuille de partage d'un telephone,
 * souvent en donnees mobiles.
 */
export async function fabriquer(course: Course): Promise<Blob | null> {
  try {
    // Les polices doivent etre chargees AVANT le trace : un canvas dessine
    // pendant qu'une police arrive encore ecrit en police de repli, et il ne se
    // redessine pas quand elle finit par arriver. Le jeu tourne depuis un
    // moment quand ce bouton est atteint, donc elles sont la — mais un premier
    // partage sur une connexion lente ne doit pas sortir en Helvetica.
    if (typeof document !== 'undefined' && (document as any).fonts) {
      try {
        await Promise.all([
          (document as any).fonts.load('900 200px Outfit'),
          (document as any).fonts.load('700 200px "Space Mono"'),
        ]);
      } catch { /* on dessinera avec ce qu'on a */ }
    }
    const cv = document.createElement('canvas');
    dessinerCourse(cv, course);
    return await new Promise<Blob | null>(r => cv.toBlob(b => r(b), 'image/jpeg', 0.92));
  } catch {
    return null;
  }
}

/**
 * Le telephone sait-il partager un fichier ?
 *
 * `canShare({files})` et pas seulement `share` : le niveau 1 de l'API partage
 * du texte et refuse les fichiers en silence sur plusieurs navigateurs. Poser
 * la question avec le fichier lui-meme est la seule reponse qui vaille — c'est
 * d'ailleurs ce que la specification recommande.
 */
export function peutPartagerImage(): boolean {
  try {
    const n: any = navigator;
    if (typeof n?.share !== 'function' || typeof n?.canShare !== 'function') return false;
    // Un fichier temoin, du bon type : certains navigateurs repondent selon le
    // type MIME, pas selon la presence de la cle.
    const temoin = new File([new Uint8Array([0xFF, 0xD8, 0xFF])], 't.jpg', { type: 'image/jpeg' });
    return n.canShare({ files: [temoin] });
  } catch {
    return false;
  }
}

export type Sortie = 'partage' | 'telechargement' | 'annule' | 'echec';

/**
 * Fait sortir l'image de l'application.
 *
 * Deux chemins, et le second n'est pas un pis-aller honteux : sur un
 * ordinateur, la feuille de partage n'existe pas et enregistrer le fichier est
 * exactement ce qu'on veut. On ne cache donc pas le bouton la ou l'API manque
 * — on change ce qu'il fait.
 *
 * Rend ce qui s'est reellement produit. L'appelant en a besoin : « enregistre
 * dans tes images » et « envoye » ne se disent pas au meme moment, et annoncer
 * l'un pour l'autre est le genre de petit mensonge qui se voit tout de suite.
 */
export async function partager(course: Course): Promise<Sortie> {
  const blob = await fabriquer(course);
  if (!blob) return 'echec';
  const nom = nomDeFichier(course);

  if (peutPartagerImage()) {
    try {
      const fichier = new File([blob], nom, { type: 'image/jpeg' });
      // Pas de `url` a cote du fichier : plusieurs applications de destination
      // ne gardent que l'un des deux, et c'est souvent le lien qu'elles
      // gardent — on perdrait l'image, qui est tout l'objet du geste.
      // L'adresse du jeu est ecrite DANS l'image, la ou rien ne peut la
      // retirer.
      await (navigator as any).share({ files: [fichier] });
      return 'partage';
    } catch (e: any) {
      // Refermer la feuille de partage n'est pas un echec : c'est un choix, et
      // l'ecran ne doit pas repondre par un message d'erreur a quelqu'un qui a
      // simplement change d'avis.
      if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'annule';
      // Le partage a echoue pour une autre raison : plutot que de laisser le
      // joueur sans rien, on lui donne le fichier.
    }
  }

  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'telechargement';
  } catch {
    return 'echec';
  }
}
