// De quoi peupler une base de test : des joueurs, classes, et d'un pays.
//
// Les harnais de championnat ont besoin d'un monde avant de pouvoir ouvrir
// quoi que ce soit — un pays n'est eligible que s'il compte des joueurs
// classes et actifs. Semer a la main dans SQLite marcherait, mais mentirait :
// on veut des joueurs arrives par le meme chemin que les vrais, c'est-a-dire
// par un duel joue et un pays declare.
//
// C'est aussi ce qui rend les harnais rejouables sur une base neuve : rien
// n'est suppose deja present.

/**
 * Cree `noms.length` joueurs du pays donne, chacun avec un duel joue.
 *
 * Les chronos suivent l'ordre de la liste : le premier nom est le plus rapide.
 * Le classement des duels s'en deduit, et donc le semis de la grille — ce qui
 * rend les tests lisibles (« Alpha doit etre tete de serie ») sans avoir a
 * fouiller le MMR.
 */
export async function semerPays(B, H, pays, noms) {
  const post = (u, b) => fetch(B + u, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
    body: JSON.stringify(b),
  }).then(r => r.json().catch(() => ({})));

  const appareil = n => 'dev-' + n.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, 'x').slice(0, 40);

  for (let i = 0; i < noms.length; i += 2) {
    const a = noms[i];
    const b = noms[i + 1] || noms[0];
    if (a === b) continue;
    const msA = 9500 + i * 30;
    const msB = msA + 40;
    const defi = await post('/challenge', {
      races: ['100'], level_idx: 4, total_ms: msA, splits: [msA],
      traces: [[0, 10, 30, 60]], name: a, device_id: appareil(a),
    });
    if (defi.id) {
      await post('/challenge/attempt', {
        id: defi.id, device_id: appareil(b), name: b,
        total_ms: msB, splits: [msB],
      });
    }
  }

  for (const n of noms) {
    await post('/champ/pays', { device_id: appareil(n), name: n, pays });
  }
  return noms.length;
}

/** Des noms distincts et stables, pour un pays donne. */
export function nomsDe(prefixe, n) {
  return Array.from({ length: n }, (_, i) => prefixe + String(i + 1).padStart(2, '0'));
}
