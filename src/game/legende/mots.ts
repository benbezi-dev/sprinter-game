// LES MOTS DE LA LEGENDE, en [francais, anglais].
//
// Ils vivent ici et non dans sprinter-i18n.js, pour la raison de la nuit du
// molosse (halloween-mots.ts) : tout le mode doit sortir du paquet public d'un
// seul drapeau (LEGENDE_OUVERTE), et une table posee sur un global y serait
// restee — un bundler ne suit pas ce qui passe par un global.

const MOTS: Record<string, [string, string]> = {
  titre:        ['CARRIÈRE LÉGENDE', 'LEGEND CAREER'],
  sous:         ['Six étapes, du sable de San-Pédro à l’apothéose.', 'Six stages, from the sand of San-Pédro to the apotheosis.'],
  verrou:       ['Après {n} carrières gagnées', 'After {n} careers won'],
  compte:       ['{k} / {n} · toutes épreuves confondues', '{k} / {n} · all events combined'],
  forcer:       ['ESSAYER', 'TRY IT'],
  force_note:   ['Canal de test : la Légende est ouverte sans les 99 carrières.', 'Test channel: the Legend is open without the 99 careers.'],
  commencer:    ['COMMENCER', 'START'],
  plus_loin:    ['Plus loin : étape {n} sur 6', 'Furthest: stage {n} of 6'],
  accomplies:   ['Légende accomplie ×{n}', 'Legend completed ×{n}'],
  essai:        ['ESSAI — PARTIR DE L’ÉTAPE', 'TEST — START FROM STAGE'],
  etape:        ['ÉTAPE {n}', 'STAGE {n}'],
  contre:       ['VS', 'VS'],
  toi:          ['TOI', 'YOU'],
  a_battre:     ['à battre : {s}', 'to beat: {s}'],
  partir:       ['PARTIR', 'GO'],
  depuis:       ['{t} depuis {d}', '{t} from {d}'],
  velo:         ['À vélo', 'By bike'],
  voiture:      ['En voiture', 'By car'],
  car:          ['En car', 'By coach'],
  avion:        ['En avion', 'By plane'],
  fusee:        ['En fusée', 'By rocket'],
  gagnee:       ['ÉTAPE GAGNÉE', 'STAGE WON'],
  passer:       ['TOUCHE POUR PASSER', 'TAP TO SKIP'],
  tropo:        ['TROPOSPHÈRE', 'TROPOSPHERE'],
  strato:       ['STRATOSPHÈRE', 'STRATOSPHERE'],
  meso:         ['MÉSOSPHÈRE', 'MESOSPHERE'],
  karman_titre: ['LIGNE DE KÁRMÁN · 100 KM', 'KÁRMÁN LINE · 100 KM'],
  accomplie:    ['LÉGENDE ACCOMPLIE', 'LEGEND COMPLETE'],
  // les cinematiques des voyages, de l'apotheose et du sacre
  lune:         ['LA LUNE', 'THE MOON'],
  saturne:      ['SATURNE', 'SATURN'],
  orion:        ['NÉBULEUSE D’ORION', 'ORION NEBULA'],
  sgr:          ['SAGITTARIUS A* · LE CŒUR DE LA GALAXIE', 'SAGITTARIUS A* · THE HEART OF THE GALAXY'],
  apotheose_t:  ['L’APOTHÉOSE', 'THE APOTHEOSIS'],
  legende:      ['LÉGENDE', 'LEGEND'],
  battus:       ['Ils sont tombés, un par un.', 'They fell, one by one.'],
  fois:         ['×{n}', '×{n}'],
  u_km:         ['km', 'km'],
  u_md:         ['Md km', 'bn km'],
  u_al:         ['al', 'ly'],
  perdue:       ['LA LÉGENDE S’ARRÊTE ICI', 'THE LEGEND ENDS HERE'],
  faux:         ['FAUX DÉPART', 'FALSE START'],
  place:        ['{o} à l’arrivée', '{o} at the line'],
  avance:       ['{s} devant {b}', '{s} ahead of {b}'],
  retard:       ['{s} derrière {b}', '{s} behind {b}'],
  suivante:     ['ÉTAPE SUIVANTE', 'NEXT STAGE'],
  recommencer:  ['RECOMMENCER LA LÉGENDE', 'RESTART THE LEGEND'],
  accueil:      ['ACCUEIL', 'HOME'],
  regle_perte:  ['Une étape perdue, et la Légende repart de la plage.', 'Lose a stage, and the Legend starts again from the beach.'],
};

function langue(): number {
  const N = (globalThis as any).SprinterI18N;
  try { return N && N.index ? N.index() : 0; } catch { return 0; }
}

export function mot(cle: string, vars?: Record<string, string | number>): string {
  const ligne = MOTS[cle];
  let s = ligne ? ligne[langue()] : cle;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Un chrono a l'ecran : « 9,70 s » en francais, « 9.70 s » en anglais. */
export function chrono(t: number | null | undefined): string {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—';
  const s = Math.abs(t).toFixed(2);
  return (langue() === 0 ? s.replace('.', ',') : s) + ' s';
}

/** Un nombre a l'ecran, aux separateurs de la langue du jeu. */
export function nombre(n: number, dec = 0): string {
  return new Intl.NumberFormat(langue() === 0 ? 'fr-FR' : 'en-US',
                               { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

/** Le texte d'une paire [francais, anglais] dans la langue du jeu. */
export function dans(paire: [string, string]): string {
  return paire[langue()];
}
