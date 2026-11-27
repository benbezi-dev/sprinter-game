/* ---------------------------------------------------------------------------
   JUMPER — la telemetrie des sauts (27/11/2026)
   ---------------------------------------------------------------------------
   Avec `?telemetrie=1` dans l'adresse, chaque essai (le joueur et les
   adversaires a style) ecrit une ligne dans la console : vitesse d'approche,
   vitesses et angle d'envol, perte de vitesse horizontale a chaque appui,
   repartition des bonds au triple, marque. Sans le parametre : rien.
--------------------------------------------------------------------------- */

const ACTIVE = typeof location !== 'undefined' && /[?&]telemetrie=1\b/.test(location.search);
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);

/** Les chiffres d'un essai, a plat : `s` est le resultat de sauter() ou de sauterTriple(). */
export function chiffres(s) {
  if (!s) return null;
  if (s.bonds && s.bonds.length) {
    const tot = s.bonds.reduce((a, b) => a + b, 0) || 1;
    const v = s.vitesses || [];
    return {
      approche: r2(s.vElan), vx: v.slice(1).map(r2),
      perteVx: v.slice(1).map((x, i) => r2(x - v[i])),
      bonds: s.bonds.map(r2), repartition: s.bonds.map(b => Math.round(1000 * b / tot) / 10),
      angles: (s.angles || []).map(r2), poses: s.notes, marque: s.marque, nul: s.raison || null,
    };
  }
  const v = s.vol || {};
  return {
    approche: r2(s.vElan), vx: r2(v.vx), vy: r2(v.vy), angle: r2(s.angle),
    perteVx: r2(v.vx != null ? v.vx - s.vElan : null), planche: r2(s.ecart), ramene: s.ramene, marque: s.marque, mordu: s.mordu,
  };
}

/** Une ligne de console, pour un essai d'adversaire ou du joueur. */
export function journaliser(athlete, essai) {
  if (!ACTIVE) return;
  const qui = athlete.joueur ? 'JOUEUR' : `${athlete.nom} (${athlete.style || 'sans style'})`;
  console.info('[saut]', qui, essai.telemetrie ? chiffres(essai.telemetrie) : { marque: essai.marque, mordu: essai.mordu });
}

/** Le saut du joueur, a la mesure. */
export function journaliserJoueur(resultat) {
  if (!ACTIVE) return;
  console.info('[saut] JOUEUR', chiffres(resultat));
}
