// Les noms d'un mouchoir : ranges entiers, rendus masques, repeches quand ils
// manquent.
//
// Trois proprietes, et la deuxieme est celle qui protege les joueurs :
//
//   1. Un classement resserre range les pseudonymes ENTIERS. Il ne le faisait
//      pas : il masquait des l'ecriture, et la ligne rangee ne pouvait donc
//      plus jamais etre publiee avec les noms, meme si les huit joueurs
//      disaient oui.
//   2. La LECTURE masque quand meme (§5.4). Le defaut ne bouge pas d'un cran :
//      les noms ne sortent en clair que si on les demande.
//   3. Le rattrapage des vieilles lignes NE DEVINE RIEN. Un nom n'est rendu
//      que si le classement le confirme, seul, au meme chrono. Une image de
//      compte de marque qui attribue le chrono d'un joueur a un autre est pire
//      que la meme image sans les noms.
//
// Pas de serveur : le module de la file ne connait de la base que quelques
// requetes, et une base de mensonge suffit a les lui rendre. Le harnais qui
// parle au vrai worker est a cote — tools/reseaux-test.mjs.
//
//   node tools/reseaux-noms-test.mjs

import {
  masquer, regarderClassement, fileDAttente, reparerNoms,
} from '../worker/src/reseaux.js';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

/**
 * Une base de mensonge, qui comprend les quelques requetes de reseaux.js.
 *
 * On reconnait la requete a sa forme plutot que de l'interpreter : ce n'est
 * pas un moteur SQL, c'est un decor. Le jour ou le module ecrira autre chose,
 * le decor rendra `undefined` et le test tombera — ce qui est le bon sens de
 * l'echec : un harnais qui invente une reponse pour une requete qu'il ne
 * connait pas passe au vert sans avoir rien verifie.
 */
function baseFactice(lignes = []) {
  let suivant = lignes.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  const db = {
    lignes,
    batch: async () => [],
    prepare(sql) {
      return { bind: (...args) => executer(sql, args) };
    },
  };
  const executer = (sql, args) => ({
    async first() { return (await rendre(sql, args)).results[0] || null; },
    async all() { return await rendre(sql, args); },
    async run() { return await rendre(sql, args); },
  });
  const rendre = async (sql, args) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (/^CREATE /i.test(q)) return { results: [], meta: { changes: 0 } };
    if (/^INSERT INTO reseaux_file/i.test(q)) {
      const [type, cle, donnees, poids, vu_le] = args;
      if (lignes.some(l => l.cle === cle)) return { results: [], meta: { changes: 0 } };
      lignes.push({ id: suivant++, type, cle, donnees, poids, vu_le,
                    etat: 'propose', publie_le: null, reseaux: null });
      return { results: [], meta: { changes: 1 } };
    }
    if (/^SELECT id, type, donnees FROM reseaux_file WHERE id = \?/i.test(q)) {
      return { results: lignes.filter(l => l.id === Number(args[0])) };
    }
    if (/^SELECT id, type, cle, donnees.* WHERE etat = \?/i.test(q)) {
      return { results: lignes.filter(l => l.etat === args[0])
                              .sort((a, b) => b.poids - a.poids || b.vu_le - a.vu_le)
                              .slice(0, Number(args[1])) };
    }
    if (/^UPDATE reseaux_file SET donnees = \? WHERE id = \?/i.test(q)) {
      const l = lignes.find(x => x.id === Number(args[1]));
      if (!l) return { results: [], meta: { changes: 0 } };
      l.donnees = args[0];
      return { results: [], meta: { changes: 1 } };
    }
    throw new Error('requete que le decor ne connait pas : ' + q.slice(0, 90));
  };
  return db;
}

// Huit coureurs en dix-huit centiemes : le mouchoir de la publication du
// 30 aout, avec deux chronos identiques a la troisieme place — c'est le cas ou
// le chrono seul ne suffit pas a designer quelqu'un.
const HAUT = [
  { name: 'Tonnerre',   best_split_ms: 8250 },
  { name: 'Do',         best_split_ms: 8280 },
  { name: '9Secondes',  best_split_ms: 8300 },
  { name: 'Bolide',     best_split_ms: 8300 },
  { name: 'Puce',       best_split_ms: 8350 },
  { name: 'Kestrel',    best_split_ms: 8350 },
  { name: 'Eclair',     best_split_ms: 8410 },
  { name: 'Kilomet',    best_split_ms: 8430 },
];

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LES NOMS D UN CLASSEMENT RESSERRE                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ------------------------------------------------ ce qui est range, et ce qui sort
console.log('\n── RANGE ENTIER, RENDU MASQUE ───────────────────────────────');
const db = baseFactice();
await regarderClassement({ db, test: false }, '100', 'Tonnerre', 8250, HAUT);
const ligne = db.lignes.find(l => l.type === 'mouchoir');
ok('le mouchoir est bien signale', !!ligne,
   'types vus : ' + db.lignes.map(l => l.type).join(', '));
if (ligne) {
  const d = JSON.parse(ligne.donnees);
  ok('la base garde les pseudonymes entiers',
     d.noms.join('|') === HAUT.map(e => e.name).join('|'), d.noms.join(', '));
  ok('elle garde aussi les chronos, dans le meme ordre',
     d.chronos_ms.join('|') === HAUT.map(e => e.best_split_ms).join('|'));
}

// La file rend le plus fort d'abord — la tete du classement, ici, qui a ete
// signalee par la meme arrivee. C'est le mouchoir qu'on regarde.
const vue = (await fileDAttente(db, {})).find(m => m.type === 'mouchoir');
ok('la file, elle, ne rend que des noms masques',
   vue && vue.donnees.noms.every(n => n.includes('•')), JSON.stringify(vue && vue.donnees.noms));
ok('et ils restent lisibles comme des noms',
   vue && vue.donnees.noms[0] === 'T' + '•'.repeat(7), vue && vue.donnees.noms[0]);
const claire = (await fileDAttente(db, { avecNoms: true })).find(m => m.type === 'mouchoir');
ok('on les obtient en le demandant, et pas autrement',
   claire && claire.donnees.noms.join('|') === HAUT.map(e => e.name).join('|'));

// ------------------------------------------------------- le rattrapage
console.log('\n── LES VIEILLES LIGNES, REPECHEES ───────────────────────────');

/** Une ligne telle que l'ancien code l'ecrivait : noms deja masques. */
const ancienne = (noms = HAUT.map(e => masquer(e.name))) => baseFactice([{
  id: 7, type: 'mouchoir', cle: 'mouchoir:100:8:180', poids: 55, vu_le: Date.now(),
  etat: 'propose', publie_le: null, reseaux: null,
  donnees: JSON.stringify({
    race: '100', combien: 8, ecart_ms: 180, premier_ms: 8250, dernier_ms: 8430,
    noms, chronos_ms: HAUT.map(e => e.best_split_ms),
  }),
}]);

const db2 = ancienne();
const r2 = await reparerNoms(db2, 7, async () => HAUT);
ok('le rattrapage rend les huit noms', r2.ok && r2.retrouves === 8, JSON.stringify(r2));
ok('et il les ecrit dans la file',
   JSON.parse(db2.lignes[0].donnees).noms.join('|') === HAUT.map(e => e.name).join('|'));
ok('les homonymes de chrono ne sont pas intervertis',
   JSON.parse(db2.lignes[0].donnees).noms[2] === '9Secondes' &&
   JSON.parse(db2.lignes[0].donnees).noms[3] === 'Bolide');
ok('la reponse ne transporte pas les noms',
   !JSON.stringify(r2).includes('Tonnerre'), JSON.stringify(r2));

// Un classement qui a bouge : le huitieme chrono n'y est plus.
const db3 = ancienne();
const r3 = await reparerNoms(db3, 7, async () => HAUT.slice(0, 7));
ok('un chrono disparu fait refuser la ligne entiere', !r3.ok, JSON.stringify(r3));
ok('elle nomme la place qui manque', Array.isArray(r3.places) && r3.places.includes(8));
ok('et rien n a ete ecrit',
   JSON.parse(db3.lignes[0].donnees).noms.every(n => n.includes('•')));

// Deux joueurs, meme chrono, meme initiale, meme longueur : le masque ne
// designe plus personne. On refuse plutot que de tirer au sort.
const db4 = ancienne();
const ambigu = HAUT.map(e => e.name === 'Kestrel' ? { name: 'Komodos', best_split_ms: 8350 } : e)
                   .concat([{ name: 'Kestrel', best_split_ms: 8350 }]);
const r4 = await reparerNoms(db4, 7, async () => ambigu);
ok('deux candidats possibles font refuser', !r4.ok, JSON.stringify(r4));
ok('rien n est devine',
   JSON.parse(db4.lignes[0].donnees).noms.every(n => n.includes('•')));

// Une ligne ecrite apres le changement : rien a faire, et ce n'est pas une
// erreur. L'atelier doit pouvoir appeler sans regarder ce qu'il a.
const db5 = ancienne(HAUT.map(e => e.name));
const r5 = await reparerNoms(db5, 7, async () => { throw new Error('inutile'); });
ok('une ligne deja entiere ne demande pas le classement', r5.ok && r5.retrouves === 0,
   JSON.stringify(r5));

const r6 = await reparerNoms(ancienne(), 999, async () => HAUT);
ok('un identifiant inconnu se dit introuvable',
   !r6.ok && r6.raison === 'introuvable', JSON.stringify(r6));

console.log(echecs ? `\n${echecs} verification(s) en echec\n` : '\nTout tient.\n');
process.exit(echecs ? 1 : 0);
