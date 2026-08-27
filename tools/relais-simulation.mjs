/* ---------------------------------------------------------------------------
   Un 4x100 complet, joue de bout en bout dans la vraie physique du jeu.
   ---------------------------------------------------------------------------
   Regles appliquees, telles qu'elles ont ete arretees :

   - la course part du meme endroit que le 400 m ;
   - le premier relayeur part arrete, comme sur un 100 m ; faux depart de sa
     part, l'equipe est eliminee ;
   - chacun des trois autres se place ou il veut dans une zone de 30 metres et
     y attend celui qui le precede ;
   - le temoin doit changer de main DANS cette zone. Avant la zone, apres la
     zone, ou lache : l'equipe est eliminee. Il n'y a pas de penalite de temps
     pour un passage mal place, seulement l'elimination.

   Ne se note que la synchronisation des deux touches, qui decide de la
   vitesse conservee — pas du droit de continuer.
--------------------------------------------------------------------------- */
import { readFileSync } from 'fs';
new Function(readFileSync('src/game/sprinter-core.js', 'utf8'))();
const { C, Runner, RACES } = globalThis.SprinterCore;
const PAS = 1 / 240;
const R = RACES['4x100'];
const ZONE = C.RELAY_LAUNCH;             // 30 m

/**
 * @param cadences  cadence d'appui des quatre, en secondes
 * @param marques   ou chaque receveur se place dans sa zone, en metres depuis
 *                  le debut de la zone (3 valeurs, 0 a 30)
 * @param departs   a quelle distance du receveur le porteur declenche le
 *                  depart de celui-ci (3 valeurs, en metres)
 * @param ecarts    desynchronisation des deux touches, en secondes
 */
export function courirRelais({ cadences, marques, departs, ecarts, trace = false }) {
  const coureurs = [0, 1, 2, 3].map(k => {
    const r = new Runner('R' + (k + 1), 1, { maxSpeed: R.maxSpeed, total: 400, pool: [] });
    r.isPlayer = true;
    const ligne = k * R.legLength;
    // Le receveur se place dans sa zone ; le premier part de la ligne.
    r.legStart = k === 0 ? 0 : ligne + Math.max(0, Math.min(ZONE, marques[k - 1]));
    r.driveEnd = k === 0 ? C.DRIVE_END : ZONE;
    r.d = r.legStart;
    r.zoneDebut = ligne;
    r.zoneFin = ligne + ZONE;
    r.actif = k === 0;
    return r;
  });

  let t = 0, echange = 0;
  const prochain = coureurs.map(() => 0), cote = coureurs.map(() => 0);
  const journal = [], passes = [];
  const finir = (raison) => ({ elimine: true, raison, journal, passes, total: null });

  while (t < 90) {
    for (let k = 0; k < 4; k++) {
      const r = coureurs[k];
      if (!r.actif || r.finished) continue;
      if (t >= prochain[k]) {
        prochain[k] = t + cadences[k];
        r.press(cote[k] ? 'right' : 'left', t);
        cote[k] ^= 1;
      }
      r.stepPlayer(PAS, t);
    }

    if (echange < 3) {
      const porteur = coureurs[echange], receveur = coureurs[echange + 1];

      if (!receveur.actif && receveur.legStart - porteur.d <= departs[echange]) {
        receveur.actif = true;
        if (trace) journal.push(`${t.toFixed(2)}s  R${echange + 2} s'elance depuis ${receveur.legStart.toFixed(0)} m`);
      }

      // Le temoin ne peut pas etre donne avant la zone.
      if (porteur.d >= receveur.d && porteur.d < receveur.zoneDebut) {
        journal.push(`${t.toFixed(2)}s  ELIMINEE : temoin donne avant la zone (${porteur.d.toFixed(1)} m)`);
        return finir('passage avant la zone');
      }

      // Ni apres : si le receveur sort de la zone sans le temoin, c'est fini.
      if (receveur.actif && receveur.d > receveur.zoneFin) {
        journal.push(`${t.toFixed(2)}s  ELIMINEE : R${echange + 2} a quitte la zone sans le temoin`);
        return finir('sortie de zone sans temoin');
      }
      // Ni si le porteur depasse la zone en le gardant.
      if (porteur.d > receveur.zoneFin) {
        journal.push(`${t.toFixed(2)}s  ELIMINEE : le temoin a depasse la zone`);
        return finir('temoin hors zone');
      }

      if (receveur.actif && porteur.d >= receveur.d &&
          receveur.d >= receveur.zoneDebut && receveur.d <= receveur.zoneFin) {
        const g = receveur.gradeHandoff(ecarts[echange]);
        porteur.actif = false;
        passes.push({ a: receveur.d, dansZone: receveur.d - receveur.zoneDebut, note: g, t });
        if (trace) journal.push(`${t.toFixed(2)}s  passage a ${receveur.d.toFixed(1)} m (${(receveur.d - receveur.zoneDebut).toFixed(1)} m dans la zone) -> ${['RATE', 'BON', 'PARFAIT'][g]}`);
        echange++;
      }
    }

    if (coureurs[3].finished) break;
    t += PAS;
  }
  return { elimine: false, total: coureurs[3].finishTime, passes, journal };
}
