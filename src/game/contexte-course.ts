// Le vrai mode d'une course, tel que le tableau de bord le compte.
//
// Le moteur ne connait que deux modes, `campaign` et `oneshot`, et c'est tout
// ce que le serveur gardait. Or presque tout passe par le one shot : la course
// en direct, la serie de championnat, le defi recu, le duel lance, l'Objectif
// du jour, le defi d'une vedette, l'etape de la Legende, la nuit au cimetiere.
// « Combien de parties en direct cette semaine » n'avait donc pas de reponse.
//
// On ne touche pas au mode : il commande le moteur (reprise, faux depart, ecran
// de fin) et le serveur s'en sert deja. On ajoute une ETIQUETTE, lue au moment
// ou la course se termine — c'est-a-dire avant que l'ecran de fin ou le retour
// a l'accueil n'efface les drapeaux qui la portent.
//
// L'ordre des tests compte : une serie de championnat est aussi une course en
// direct (`liveOn`), un defi de la demi pose aussi l'echauffement. Le plus
// precis passe en premier.
//
// Les modes que les drapeaux du moteur ne distinguent pas (vedette, Legende,
// cimetiere, edition) posent `G.etiquette` en passant par les options de
// `startOneShot` ; le moteur la remet a zero a chaque depart.

export const CONTEXTES = [
  'carriere', 'solo', 'direct', 'championnat', 'defi_demie', 'echauffement',
  'defi', 'duel', 'fantome', 'objectif', 'vedette', 'legende', 'halloween',
  'edition', 'rejeu',
] as const;
export type Contexte = typeof CONTEXTES[number];

const ETIQUETTES = new Set<string>(CONTEXTES);

export function contexteDeLaCourse(G: any): Contexte {
  if (!G) return 'solo';
  if (G.rejeu) return 'rejeu';
  if (G.champDirect) return 'championnat';
  if (G.defiDemie) return 'defi_demie';
  if (G.echauffementChamp) return 'echauffement';
  if (G.liveOn) return 'direct';
  if (G.etiquette && ETIQUETTES.has(G.etiquette)) return G.etiquette as Contexte;
  if (G.challenge) return 'defi';
  if (G.revancheId || G.challengeTarget || G.defiSansCible) return 'duel';
  if (G.objectifEnCours) return 'objectif';
  if (G.mode === 'campaign') return 'carriere';
  if (G.ghost || G.ghostSet) return 'fantome';
  return 'solo';
}
