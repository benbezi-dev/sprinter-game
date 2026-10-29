// LA CADENCE DU JOUEUR A L'ARRIVEE (l'auteur, 30/10 : « afficher la cadence ») — canal de test seulement.
// Depart = les appuis de la poussee (pressTimes, jusqu'a driveEnd) ; ensuite = ceux d'apres ; moyenne = tous,
// du pistolet a la ligne. En appuis par seconde de course.

type Coureur = { appuis?: number[]; pressTimes?: number[]; finishTime?: number | null } | null | undefined;

const frequence = (t: number[]) => t.length > 1 ? (t.length - 1) / (t[t.length - 1] - t[0]) : null;

export function cadenceDe(p: Coureur) {
  const tous = (p?.appuis || []).filter(t => t >= 0);
  const pousse = p?.pressTimes || [];
  if (tous.length < 4 || !p?.finishTime) return null;
  const finPoussee = pousse.length ? pousse[pousse.length - 1] : 0;
  return {
    depart: frequence(tous.filter(t => t <= finPoussee)),
    ensuite: frequence(tous.filter(t => t >= finPoussee)),
    moyenne: tous.length / p.finishTime,
  };
}

export function ligneCadence(p: Coureur, tr: (k: string, v: Record<string, string>) => string) {
  if (import.meta.env.VITE_CANAL !== 'test') return null;
  const c = cadenceDe(p);
  if (!c) return null;
  const f = (x: number | null) => x == null || !isFinite(x) ? '--' : x.toFixed(1);
  return tr('cadence_line', { d: f(c.depart), c: f(c.ensuite), m: f(c.moyenne) });
}
