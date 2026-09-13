/* ===========================================================================
   Combien de records sont tombes pendant que Budapest courait.

   Le post du bilan, dimanche soir, oppose un chiffre a un autre : zero record
   du monde la-bas, N chez nous. Le N doit etre releve, pas estime — c'est la
   seule phrase du pack qu'on ne peut pas ecrire d'avance et la premiere que
   quelqu'un ira verifier.

     node tools/records-weekend.mjs              depuis vendredi 11/09 00:00
     node tools/records-weekend.mjs 2026-09-12   depuis une autre date

   Ce qu'on compte : les joueurs dont le classement porte une amelioration
   posterieure a la date. `updated_at` ne bouge que quand un chrono s'ameliore
   — c'est donc bien un record personnel battu, pas une simple partie jouee.
   =========================================================================== */
const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const EPREUVES = ['100', '200', '400'];

const depuisArg = process.argv[2] || '2026-09-11';
const depuis = Date.parse(`${depuisArg}T00:00:00Z`);
if (!Number.isFinite(depuis)) {
  console.error(`Date illisible : « ${depuisArg} ». Attendu AAAA-MM-JJ.`);
  process.exit(1);
}

let total = 0;
const lignes = [];

for (const ep of EPREUVES) {
  const res = await fetch(`${API}/leaderboard?race=${ep}`);
  if (!res.ok) { console.error(`${ep} m : le classement repond ${res.status}`); process.exit(1); }
  const { entries } = await res.json();
  const recents = entries.filter(e => e.updated_at && e.updated_at >= depuis);
  const meilleur = entries.reduce((a, b) => (a.best_split_ms <= b.best_split_ms ? a : b));
  total += recents.length;
  lignes.push({ ep, n: recents.length, classes: entries.length, meilleur });
}

const jour = new Date(depuis).toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});

console.log(`\nRecords personnels battus depuis ${jour} :\n`);
for (const l of lignes) {
  console.log(`  ${l.ep.padStart(3)} m   ${String(l.n).padStart(3)} sur ${l.classes} classes` +
              `   — record ${(l.meilleur.best_split_ms / 1000).toFixed(3)} s, ${l.meilleur.name}`);
}
console.log(`\n  TOTAL  ${total}\n`);
console.log(`A ecrire tel quel dans le post. Si le chiffre est petit, dis-le`);
console.log(`autrement — « le top 3 du 100 m tient en cinq centiemes » reste`);
console.log(`vrai et parle mieux qu'un decompte qui deçoit.\n`);
