// UNE ETAPE DE LA LEGENDE EST-ELLE SUR LA PISTE ? — la seule question que
// l'application pose a la Legende hors de son morceau.
//
// App.tsx choisit l'ecran de fin d'un one shot : le tableau ordinaire, la fin
// d'une nuit, celle d'un defi... ou celle d'une etape de la Legende. Il lui
// faut le demander sans importer la Legende — un import ordinaire ferait
// voyager tout le mode dans le build public. Ce fichier n'importe rien et ne
// garde qu'un nombre : l'index du stade de l'etape lancee (legende.ts le pose
// et le retire).

let stade: number | null = null;

export function poserEtape(idx: number | null): void { stade = idx; }

/** Le one shot qui vient de finir est-il une etape de la Legende ? */
export function finDEtapeLegende(G: any): boolean {
  return stade !== null && !!G && G.mode === 'oneshot' && G.levelIdx === stade;
}

/**
 * ...et l'a-t-on perdue ? Les confettis d'un record personnel ne tombent pas
 * sous « LA LEGENDE S'ARRETE ICI » (FeteRecords.tsx) — la regle qui vaut deja
 * pour l'elimination de la carriere et pour un defi de vedette perdu.
 */
export function etapeLegendePerdue(G: any): boolean {
  return finDEtapeLegende(G) && !G.won;
}
