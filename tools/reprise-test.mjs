// La regle de reprise, verifiee sur les soixante-quatre cas possibles.
//
// Six booleens font soixante-quatre combinaisons. C'est assez peu pour les parcourir
// toutes plutot que d'en choisir quelques-unes : une regle qui decide si un
// chrono peut repartir chez un adversaire merite qu'on la regarde en entier,
// et non aux endroits ou l'on pensait deja avoir raison.
//
// Le fichier teste est en TypeScript. On le lit sans le compiler : les types
// s'effacent, la regle reste. Un harnais qui exigerait une compilation serait
// un harnais qu'on ne lance pas.

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
const { verrouDeReprise, peutRejouer, fauxDepartEstUneDefaite } = mod;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const cas = (defiRecu, defiEnvoye, fauxDepart, chaineDeDuel,
             courseEnDirect = false, duelsOuverts = false) =>
  ({ defiRecu, defiEnvoye, fauxDepart, chaineDeDuel, courseEnDirect, duelsOuverts });

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

titre('LA COURSE EN DIRECT NE SE REJOUE JAMAIS');

// Le cas qu'on oublie : une course en direct emprunte la plomberie du one
// shot et finit sur le meme ecran, sans defi recu ni envoye. Elle passait
// entre les trois autres verrous, et le bouton s'affichait apres un duel en
// direct perdu. Personne n'aurait ecrit ce cas de tete — il est venu d'une
// question posee a voix haute.
ok('un direct gagne ne se rejoue pas',
   verrouDeReprise(cas(false, false, false, false, true)) === 'course_directe');
ok('un direct perdu non plus',
   verrouDeReprise(cas(false, false, false, true, true)) === 'course_directe');
ok('et il passe avant tous les autres verrous',
   verrouDeReprise(cas(true, true, true, true, true)) === 'course_directe',
   'c est l engagement le plus fort');
ok('un faux depart en direct est une defaite',
   fauxDepartEstUneDefaite(cas(false, false, true, false, true)));

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

titre('LE 5 SEPTEMBRE REFERME LE FAUX DEPART');

// Avant : partir avant le signal, seul sur la piste, se reprend. Apres :
// l'elimination redevient ce qu'elle etait, et cela vaut meme sans adversaire.
// Le meme drapeau ouvre le classement et referme cette porte.
ok('avant le 5, un faux depart en solo se rejoue',
   peutRejouer(cas(false, false, true, false, false, false)));
ok('apres le 5, il elimine',
   verrouDeReprise(cas(false, false, true, false, false, true)) === 'faux_depart_elimine');

// Ce qui NE change pas le 5 : un chrono qui ne plait pas se rejoue toujours,
// tant que le defi n'est pas parti. C'est la distinction qui porte tout — ce
// qui redevient severe est le faux depart, pas la course entiere.
ok('apres le 5, un chrono decevant se rejoue encore',
   peutRejouer(cas(false, false, false, false, false, true)),
   'seul le faux depart redevient eliminatoire');
ok('apres le 5, un defi envoye verrouille toujours',
   verrouDeReprise(cas(false, true, false, false, false, true)) === 'defi_envoye');

// Et l'elimination n'est pas une defaite : il n'y a personne a qui perdre.
// L'ancien ecran annoncait « le duel est perdu » a un joueur qui courait seul.
ok('un faux depart en solo apres le 5 elimine sans faire perdre',
   !fauxDepartEstUneDefaite(cas(false, false, true, false, false, true)),
   'on remet l elimination, pas le mensonge');

titre('LES SOIXANTE-QUATRE CAS, SANS EN CHOISIR AUCUN');

// La verite de reference, ecrite a la main. Le test ne vaut que s'il connait
// la reponse par un autre chemin que la fonction qu'il teste.
let compte = 0, rejouables = 0, faux = 0;
for (const a of [false, true]) for (const b of [false, true])
for (const c of [false, true]) for (const d of [false, true])
for (const e2 of [false, true]) for (const f of [false, true]) {
  const etat = cas(a, b, c, d, e2, f);
  const attendu = !e2 && !a && !b && !(c && (d || f));
  const defaiteAttendue = c && (e2 || a || d);
  compte++;
  if (attendu) rejouables++;
  if (defaiteAttendue) faux++;
  ok(`ouvert=${+f} direct=${+e2} recu=${+a} envoye=${+b} faux=${+c} chaine=${+d} → ${attendu ? 'rejouable' : 'verrouille'}`,
     peutRejouer(etat) === attendu && fauxDepartEstUneDefaite(etat) === defaiteAttendue,
     `la regle dit ${peutRejouer(etat) ? 'rejouable' : verrouDeReprise(etat)}`);
}
ok(`les soixante-quatre cas sont couverts`, compte === 64, String(compte));
// Le compte se refait a la main : direct, recu et envoye sont des interdits
// secs, donc les trois a zero. Restent huit cas (faux x chaine x ouvert), dont
// trois seulement se rejouent — ceux sans faux depart, plus le faux depart
// solo d'avant le 5.
ok('cinq cas se rejouent', rejouables === 5, String(rejouables));
ok('les cinquante-neuf autres sont verrouilles', compte - rejouables === 59,
   String(compte - rejouables));
ok(`le faux depart fait perdre dans ${faux} cas sur soixante-quatre`,
   faux === 28, String(faux));

titre('L ORDRE DES VERROUS NE MENT PAS');

// Quand plusieurs interdits s'appliquent, celui qu'on annonce doit etre le
// plus fort. Dire « tu as deja envoye » a quelqu'un qui repondait a un defi
// l'enverrait chercher un envoi qu'il n'a jamais fait.
ok('le direct passe avant tout le reste',
   verrouDeReprise(cas(true, true, true, true, true)) === 'course_directe');
ok('puis repondre a un defi',
   verrouDeReprise(cas(true, true, true, true)) === 'defi_recu');
ok('l envoi passe avant le faux depart',
   verrouDeReprise(cas(false, true, true, true)) === 'defi_envoye');

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
