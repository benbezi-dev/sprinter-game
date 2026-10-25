// LE DESSIN DU JEU PRINCIPAL, MIS EN PAUSE DERRIERE UNE SCENE PLEIN ECRAN.
//
// La ville de la carriere (game/athlete/ville.ts) couvre tout l'ecran ; derriere elle, le
// moteur redessinait son accueil anime a pleine resolution, a chaque image, pour personne
// (mesure du 25/10 sur Mac M1 : deux toiles de 2068×1324, la page plafonnait a 30 i/s).
// Tant qu'une scene le demande et que le moteur n'est qu'a l'accueil, sa boucle saute le
// dessin. Une course lancee depuis la carriere se dessine normalement.
let demandes = 0;
export function suspendreLeDessin(oui: boolean) { demandes = Math.max(0, demandes + (oui ? 1 : -1)); }
export const dessinSuspendu = () => demandes > 0;
