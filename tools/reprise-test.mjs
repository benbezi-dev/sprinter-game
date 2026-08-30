// Recommencer n'est pas effacer.
//
// Le harnais verifiait autrefois soixante-quatre combinaisons pour savoir
// quand le bouton devait disparaitre. Il n'en verifie plus aucune, parce que
// le bouton ne disparait plus : recommencer lance une course de plus et ne
// reprend rien a personne. Ce qui reste a verifier est l'autre question — ce
// qui est ACQUIS de la course qu'on vient de finir, pour l'annoncer a cote du
// bouton plutot qu'a sa place.

import { readFileSync } from 'node:fs';

// On lit le fichier de regle sans le compiler a la main.
//
// La premiere version effacait les types elle-meme, et s'est cassee deux fois
// de suite : d'abord sur une union tenant sur deux lignes, puis sur un type
// objet dont chaque champ se termine par un point-virgule. Ecrire un troisieme
// effaceur aurait ete s'entetter — esbuild est deja une dependance de Vite et
// fait exactement cela, correctement.
const { transform } = await import('esbuild');
const ts = readFileSync(new URL('../src/game/reprise.ts', import.meta.url), 'utf8');
const { code } = await transform(ts, { loader: 'ts', format: 'esm' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { verrouDeReprise, peutRecommencer, fauxDepartEstUneDefaite } = mod;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const cas = (defiRecu, defiEnvoye, fauxDepart, chaineDeDuel, courseEnDirect = false) =>
  ({ defiRecu, defiEnvoye, fauxDepart, chaineDeDuel, courseEnDirect });

titre('ON PEUT TOUJOURS LANCER UNE COURSE DE PLUS');

// La propriete qui a coute le plus cher a comprendre. Elle ne depend de rien,
// et c'est exactement ce qu'il faut verifier : aucun etat de la course
// precedente ne doit pouvoir la rendre fausse.
ok('recommencer est toujours possible', peutRecommencer() === true);
ok('et cela ne depend d aucun etat', peutRecommencer.length === 0,
   'la fonction ne prend rien : il n y a rien a examiner');

titre('CE QUI EST ACQUIS SE DIT, MAIS N INTERDIT RIEN');

for (const [nom, etat, attendu] of [
  ['une course ordinaire ne laisse rien de definitif', cas(false, false, false, false), null],
  ['repondre a un defi est definitif',                 cas(true, false, false, false), 'defi_recu'],
  ['un defi envoye est definitif',                     cas(false, true, false, false), 'defi_envoye'],
  ['une course en direct est definitive',              cas(false, false, false, false, true), 'course_directe'],
  ['un faux depart en chaine de duel est une defaite', cas(false, false, true, true), 'faux_depart_duel'],
  ['un faux depart solo ne laisse rien',               cas(false, false, true, false), null],
]) {
  ok(nom, verrouDeReprise(etat) === attendu,
     `la regle dit ${verrouDeReprise(etat)}`);
  // Et dans TOUS ces cas, le raccourci reste offert.
  ok(`   ...et le raccourci reste offert`, peutRecommencer() === true);
}

titre('L ORDRE DE CE QU ON ANNONCE NE MENT PAS');

// Quand plusieurs choses sont acquises, on annonce la plus forte. Dire « tu as
// deja envoye » a quelqu'un qui repondait a un defi l'enverrait chercher un
// envoi qu'il n'a jamais fait.
ok('le direct passe avant tout le reste',
   verrouDeReprise(cas(true, true, true, true, true)) === 'course_directe');
ok('puis repondre a un defi',
   verrouDeReprise(cas(true, true, true, true)) === 'defi_recu');
ok('puis l envoi',
   verrouDeReprise(cas(false, true, true, true)) === 'defi_envoye');

titre('LE FAUX DEPART EN DUEL RESTE UNE DEFAITE');

ok('celui qui recoit le defi perd',
   fauxDepartEstUneDefaite(cas(true, false, true, false)));
ok('celui qui le renvoie apres l avoir recu perd aussi',
   fauxDepartEstUneDefaite(cas(false, false, true, true)));
ok('celui qui court en direct perd',
   fauxDepartEstUneDefaite(cas(false, false, true, false, true)));
ok('mais pas celui qui court seul',
   !fauxDepartEstUneDefaite(cas(false, false, true, false)),
   'il n y a personne a qui perdre');
ok('et perdre au chrono n est pas un faux depart',
   !fauxDepartEstUneDefaite(cas(true, true, false, true)));

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
