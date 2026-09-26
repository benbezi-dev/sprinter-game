// REGARDER UN CHAMPIONNAT SANS Y COURIR — la page publique.
//
// `sprinter-game.com/?regarder=<edition>` : un lien qu'on colle en bio, dans
// une story, dans un message. Celui qui l'ouvre n'a ni nom, ni pays, ni
// partie en cours ; il vient voir des courses. On ne lui demande donc rien —
// ni bienvenue, ni tutoriel, ni installation — et on lui montre le programme
// du weekend, course par course, avec un bouton sur chacune de celles qui ont
// ete courues.
//
// RIEN NE SE DIFFUSE. Le rejeu est celui de l'application (`champ-rejeu`) : le
// moteur tourne dans le navigateur, huit chronos suffisent a faire courir la
// course. Le serveur n'a donc rien de plus a fournir que ce que l'ecran du
// championnat lit deja, `/champ/edition/<id>` et `/champ/direct` — deux routes
// publiques.
//
// Ce que ce n'est PAS : un direct a la milliseconde. Une course se regarde des
// que ses chronos sont ranges, pas pendant qu'elle se court.

import {
  etatEdition, fluxDirect, grille, arrivee,
  type Edition, type Partant, type RendezVous,
} from './championnats';
import { rejouerCourse } from './champ-rejeu';
import { SprinterApp } from './engine';

/** Ce que l'URL demande : une edition, et peut-etre une course precise. */
export type Demande = { edition: string | null; course: string | null };

/**
 * Lu une fois, au chargement.
 *
 * `?regarder` seul (sans valeur) est valide : il veut dire « le championnat
 * du moment », qu'on retrouve par le fil d'annonces.
 */
export function demandeDeLUrl(): Demande | null {
  try {
    const q = new URLSearchParams(window.location.search);
    if (!q.has('regarder')) return null;
    const ed = (q.get('regarder') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c = (q.get('course') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    return { edition: ed || null, course: c || null };
  } catch {
    return null;
  }
}

/** Le lien a partager. `?regarder=` et non `/c/` : il repond 200, et porte l'apercu. */
export function lienDeLEdition(id: string, course?: string | null): string {
  const base = window.location.origin + (import.meta.env.BASE_URL || '/');
  return base + '?regarder=' + encodeURIComponent(id)
    + (course ? '&course=' + encodeURIComponent(course) : '');
}

/**
 * L'edition la plus recente du fil d'annonces.
 *
 * Il n'existe pas de route « le championnat en cours » : on prend celui qui a
 * parle le dernier. C'est exact le weekend d'une competition — le seul moment
 * ou ce lien sans identifiant circule.
 */
export async function editionDuMoment(): Promise<string | null> {
  const f = await fluxDirect(0);
  if (!f || !f.annonces.length) return null;
  const a = [...f.annonces].reverse().find(x => x.edition);
  return a ? a.edition : null;
}

export { etatEdition };

/** Une course du programme, telle que la page l'affiche. */
export type CourseDuProgramme = {
  /** « serie-2 », « finale-1 » — la forme de l'URL. */
  cle: string;
  phase: string;
  numero: number;
  /** « Série 2 », « Finale ». */
  nom: string;
  /** L'heure au calendrier, si le calendrier la dit. */
  at: number | null;
  courue: boolean;
  /** Les couloirs, s'ils sont connus : une phase pas encore tiree n'en a pas. */
  couloirs: { couloir: number; nom: string; pays?: string | null }[];
  arrivee: { place: number; nom: string; ms: number | null; couloir: number | null }[];
};

/** La cle d'URL d'une course. */
export const cleDeCourse = (phase: string, numero: number) => `${phase}-${numero}`;

/**
 * LES COULOIRS D'UNE COURSE, passee ou a venir.
 *
 * La regle est celle de l'ecran du championnat (voir `Grille` dans
 * Championnat.tsx) : les partants de la course, tries par rang de duel ; la
 * position dans cette liste EST le couloir. Le serveur ne le stocke pas.
 *
 * Pour la phase en cours on part de la meme liste que l'application —
 * `grille(e)` —, pour ne jamais annoncer un autre couloir qu'elle. Pour une
 * phase passee, `grille` ne sait plus rien : les qualifies ont change de phase
 * et les elimines l'ont gardee. On repart alors des resultats, qui disent
 * exactement qui a couru cette course-la, et on applique la meme regle.
 */
function couloirsDe(e: Edition, phase: string, numero: number): Partant[] {
  if (phase === e.phase) {
    const g = grille(e).find(x => x.course === numero);
    if (g) return g.couloirs;
  }
  const par = new Map(e.partants.map(p => [p.name_key, p]));
  return e.resultats
    .filter(r => r.phase === phase && r.course === numero)
    .map(r => par.get(r.name_key))
    .filter((p): p is Partant => !!p)
    .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99));
}

function heureDe(cal: RendezVous[], phase: string, numero: number): number | null {
  const rv = cal.find(r => r.phase === phase && r.course === numero)
          || cal.find(r => r.phase === phase && r.course == null && !r.reveal && !r.ceremonie);
  return rv ? rv.at : null;
}

/** Tout le weekend, phase par phase, course par course. */
export function programme(e: Edition): CourseDuProgramme[] {
  const N = SprinterApp.N;
  const cal = e.calendrier || [];
  const out: CourseDuProgramme[] = [];
  for (const ph of e.phases) {
    for (let n = 1; n <= ph.courses; n++) {
      const partants = couloirsDe(e, ph.cle, n);
      const couloirDe = new Map(partants.map((p, i) => [p.name_key, i + 1]));
      const fin = arrivee(e, ph.cle, n);
      out.push({
        cle: cleDeCourse(ph.cle, n),
        phase: ph.cle, numero: n,
        nom: N.courseNom(ph.cle, n, ph.courses, ph.nom),
        at: heureDe(cal, ph.cle, n),
        courue: fin.length > 0,
        couloirs: partants.map((p, i) => ({ couloir: i + 1, nom: p.nom, pays: p.pays })),
        arrivee: fin.map((r, i) => ({
          place: i + 1, nom: r.nom, ms: r.ms, couloir: couloirDe.get(r.name_key) ?? null,
        })),
      });
    }
  }
  return out;
}

/**
 * Lance le rejeu d'une course, comme le bouton « Revoir » de l'application.
 *
 * Les memes arguments que `BoutonRevoir` (Championnat.tsx), a une difference
 * pres : personne n'est « moi ». Le spectateur n'a pas couru, la camera suit
 * le vainqueur.
 *
 * Le son s'ouvre ici, dans le geste : un navigateur refuse l'audio qu'aucun
 * appui n'a demande, et la page n'a pas d'ecran « touchez pour commencer ».
 */
export function regarderLaCourse(e: Edition, c: CourseDuProgramme): boolean {
  if (!c.courue) return false;
  const { N, Audio_ } = SprinterApp;
  try { Audio_.init(); Audio_.ctx?.resume?.(); } catch { /* sans le son, la course se voit */ }
  const partants = couloirsDe(e, c.phase, c.numero);
  const couloirDe = new Map(partants.map((p, i) => [p.name_key, i + 1]));
  const fin = arrivee(e, c.phase, c.numero);
  const mot = (e.mots || []).find(m => m.phase === c.phase && m.course === c.numero) || null;
  const competition = N.titreEdition(e) || e.titre;
  return rejouerCourse(
    e.epreuve,
    fin.map(r => ({ nom: r.nom, cle: r.name_key, ms: r.ms, couloir: couloirDe.get(r.name_key),
                    motif: r.motif ?? null, motif_ms: r.motif_ms ?? null })),
    3500, true,
    {
      titre: c.nom,
      sousTitre: `${competition} · ${e.epreuve} M`,
      competition,
      quand: c.at,
      course: { edition: e.id, phase: c.phase, numero: c.numero },
      mot: mot && { nom: mot.nom, texte: mot.texte, a_voix: mot.a_voix },
      lieu: e.lieu,
    },
  );
}
