// La regle de reprise, verifiee sur les seize cas possibles.
//
// Quatre booleens font seize combinaisons. C'est assez peu pour les parcourir
// toutes plutot que d'en choisir quelques-unes : une regle qui decide si un
// chrono peut repartir chez un adversaire merite qu'on la regarde en entier,
// et non aux endroits ou l'on pensait deja avoir raison.
//
// Le fichier teste est en TypeScript. On le lit sans le compiler : les types
// s'effacent, la regle reste. Un harnais qui exigerait une compilation serait
// un harnais qu'on ne lance pas.

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/game/reprise.ts', import.meta.url), 'utf8')
  .replace(/export type [\s\S]*?};\n/g, '')
  .replace(/export type Verrou[^\n]*\n/g, '')
  .replace(/: EtatCourse/g, '')
  .replace(/: Verrou/g, '')
  .replace(/: boolean/g, '')
  .replace(/export /g, '');
const mod = new Function(`${src}; return { verrouDeReprise, peutRejouer, fauxDepartEstUneDefaite };`)();
const { verrouDeReprise, peutRejouer, fauxDepartEstUneDefaite } = mod;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const cas = (defiRecu, defiEnvoye, fauxDepart, chaineDeDuel) =>
  ({ defiRecu, defiEnvoye, fauxDepart, chaineDeDuel });

titre('LA COURSE QU ON COURT POUR SOI SE REJOUE');

ok('une course ordinaire se rejoue', peutRejouer(cas(false, false, false, false)));
ok('un faux depart hors duel se rejoue', peutRejouer(cas(false, false, true, false)),
   'le joueur n a rien promis a personne');
ok('et il ne fait perdre a personne',
   !fauxDepartEstUneDefaite(cas(false, false, true, false)));

titre('DES QU UN ADVERSAIRE EST ENGAGE, LE CHRONO EST DONNE');

ok('repondre a un defi ne se rejoue pas',
   verrouDeReprise(cas(true, false, false, false)) === 'defi_recu',
   'le resultat part au serveur des l arrivee');
ok('un defi envoye verrouille la course',
   verrouDeReprise(cas(false, true, false, false)) === 'defi_envoye',
   'le code est deja chez l ami, avec le chrono a battre');
ok('un faux depart dans une revanche ne se rejoue pas',
   verrouDeReprise(cas(false, false, true, true)) === 'faux_depart_duel');

titre('LE FAUX DEPART EN DUEL EST UNE DEFAITE');

ok('celui qui recoit le defi perd',
   fauxDepartEstUneDefaite(cas(true, false, true, false)));
ok('celui qui le renvoie apres l avoir recu perd aussi',
   fauxDepartEstUneDefaite(cas(false, false, true, true)));
ok('mais pas celui qui court seul',
   !fauxDepartEstUneDefaite(cas(false, false, true, false)));
ok('et pas de defaite sans faux depart',
   !fauxDepartEstUneDefaite(cas(true, true, false, true)),
   'perdre un duel au chrono n est pas la meme chose');

titre('LES SEIZE CAS, SANS EN CHOISIR AUCUN');

// La verite de reference, ecrite a la main. Le test ne vaut que s'il connait
// la reponse par un autre chemin que la fonction qu'il teste.
let compte = 0, rejouables = 0;
for (const a of [false, true]) for (const b of [false, true])
for (const c of [false, true]) for (const d of [false, true]) {
  const etat = cas(a, b, c, d);
  const attendu = !a && !b && !(c && d);
  compte++;
  if (attendu) rejouables++;
  ok(`recu=${+a} envoye=${+b} faux=${+c} chaine=${+d} → ${attendu ? 'rejouable' : 'verrouille'}`,
     peutRejouer(etat) === attendu,
     `la regle dit ${peutRejouer(etat) ? 'rejouable' : verrouDeReprise(etat)}`);
}
ok(`les seize cas sont couverts`, compte === 16, String(compte));
// Trois, et le compte se refait a la main : les deux premiers booleens sont
// des interdits secs, donc il faut recu=0 et envoye=0. Restent quatre cas, et
// le faux depart en chaine de duel en retire un.
ok('trois d entre eux se rejouent', rejouables === 3, String(rejouables));

titre('L ORDRE DES VERROUS NE MENT PAS');

// Quand plusieurs interdits s'appliquent, celui qu'on annonce doit etre le
// plus fort. Dire « tu as deja envoye » a quelqu'un qui repondait a un defi
// l'enverrait chercher un envoi qu'il n'a jamais fait.
ok('repondre a un defi passe avant tout le reste',
   verrouDeReprise(cas(true, true, true, true)) === 'defi_recu');
ok('l envoi passe avant le faux depart',
   verrouDeReprise(cas(false, true, true, true)) === 'defi_envoye');

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
