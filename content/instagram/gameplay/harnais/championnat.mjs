/**
 * Ouvrir et faire courir un cycle de championnats sur le serveur local.
 *
 * Les championnats ne sont pas un ecran qu'on ouvre : c'est un calendrier qui
 * tourne. Sans edition ouverte, sans series courues et sans finale, l'ecran du
 * jeu est vide — et filmer un ecran vide ne raconte pas la fonctionnalite.
 *
 * Ce script fait donc ce que ferait le calendrier, en accelere : il ouvre les
 * nationaux du weekend, deroule chaque phase avec des chronos plausibles, et
 * sacre un champion par pays. Les chronos sont derives du rang de duel du
 * partant — un tete de serie court plus vite qu'un repeche — pour que la
 * grille ait un sens quand on la filme.
 *
 *   node championnat.mjs [national|continental|mondial]
 */
const B = process.env.API || 'http://127.0.0.1:8787';
const ADMIN = { 'Content-Type': 'application/json',
                'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
/* Le serveur limite les POST a trente par minute et par adresse. Un
   championnat complet en demande plus de deux cents : on attend et on
   recommence plutot que d'abandonner l'edition en cours de serie — une
   edition laissee a mi-parcours bloque le weekend suivant. */
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function post(u, b) {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(B + u, { method: 'POST', headers: ADMIN, body: JSON.stringify(b) }).then(x => x.json());
    if (!/trop de tentatives/i.test(r.error || '')) return r;
    process.stdout.write('.');
    await dormir(12000);
  }
  return { error: 'limite de debit jamais levee' };
}
const get  = u => fetch(B + u).then(r => r.json());

let graine = 20260906;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/** Deroule une edition, de la premiere serie au sacre. */
async function courir(id, favori = null) {
  const niveau = {};
  for (let garde = 0; garde < 8; garde++) {
    const etat = await get('/champ/edition/' + id);
    if (etat.error) return { erreur: etat.error };
    if (etat.etat === 'terminee') return { champion: etat.champion };
    const courses = [...new Set(etat.partants.filter(p => p.phase === etat.phase).map(p => p.course))].sort((a, b) => a - b);
    for (const c of courses) {
      const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
      const chronos = partants.map(p => {
        if (niveau[p.name_key] == null) {
          // Le favori qu'on filme court un cran devant : il faut bien que
          // quelqu'un gagne, et l'ecran suit ce joueur-la.
          const base = 9400 + (p.rang_duel || 16) * 22;
          niveau[p.name_key] = favori && p.name_key === favori ? base - 190 : base;
        }
        return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 220) };
      });
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) return { erreur: `${r.error} (course ${c})` };
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) return { erreur: cl.error };
    if (cl.finale) return { champion: cl.champion, libelle: cl.libelle, podium: cl.podium };
  }
  return { erreur: 'trop de phases' };
}

const echelon = process.argv[2] || 'national';
const samedi = Date.UTC(2026, 8, 5);
const cycle = await post('/champ/cycle', { debut: samedi, echelon });
if (!cycle || !Array.isArray(cycle.ouvertes)) {
  console.log('   /champ/cycle :', JSON.stringify(cycle).slice(0, 300)); process.exit(1);
}
// La cle de l'edition s'appelle `edition`, pas `id` — et une edition deja
// ouverte revient dans `ecartes`, avec la meme cle. La relancer plutot que la
// declarer perdue est ce qui permet de rejouer le meme weekend sans repartir
// d'une base vide.
const aCourir = [
  ...cycle.ouvertes.map(e => ({ zone: e.zone, edition: e.edition || e.id })),
  ...(cycle.ecartes || []).filter(e => e.edition).map(e => ({ zone: e.zone, edition: e.edition })),
];
console.log(`   ${echelon} : ${aCourir.length} edition(s)`);
for (const e of aCourir) {
  const r = await courir(e.edition, e.zone === 'FR' ? 'kenza' : null);
  console.log(`     ${String(e.zone).padEnd(4)} → ${r.champion || r.erreur}`);
}
