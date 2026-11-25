// Les face-a-face d'un joueur : bete noire, victime favorite et bilans par
// epreuve. Le calcul est au serveur (worker/src/face-a-face.js), qui relit
// les duels avec les memes regles que le classement.

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/** La vue « toutes epreuves ». */
export const TOUTES = '*';

export type Bilan = { v: number; n: number; d: number };
export type Adversaire = Bilan & { nom: string; total: number };
export type FaceAFaceEpreuve = {
  epreuve: string;
  bilan: Bilan;
  bete_noire: Adversaire | null;
  victime_favorite: Adversaire | null;
  adversaires: Adversaire[];
};

/** `null` : serveur injoignable. Une liste vide : aucun duel tranche. */
export async function lireFaceAFace(nom: string): Promise<FaceAFaceEpreuve[] | null> {
  const n = (nom || '').trim();
  if (!n || n.toLowerCase() === 'anonyme') return [];
  try {
    const r = await fetch(`${API_BASE}/duels/face-a-face?name=${encodeURIComponent(n)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json() as { epreuves?: FaceAFaceEpreuve[] };
    return Array.isArray(d.epreuves) ? d.epreuves : [];
  } catch {
    return null;
  }
}

/** « 3 V - 1 N - 2 D », dans la langue du jeu. */
export function formatBilan(b: Bilan, lang: string): string {
  return lang === 'en' ? `${b.v} W - ${b.n} D - ${b.d} L` : `${b.v} V - ${b.n} N - ${b.d} D`;
}
