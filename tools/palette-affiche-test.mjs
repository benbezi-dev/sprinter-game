// LA VOIX ORDINAIRE — un seul endroit, et on le verifie.
//
// Trois programmes dessinent dans le style du jeu et aucun ne peut lire la
// feuille de style de l'autre : le jeu peint sur un canvas (`carton-film.ts`),
// l'outil des cartes ecrit du CSS (`carte-defi-ouvert.mjs`), et l'un tourne
// dans un navigateur quand l'autre tourne dans node. Chacun gardait donc sa
// copie des couleurs. `src/game/palette-affiche.js` y met fin.
//
// Une copie supprimee revient toute seule si rien ne l'en empeche : la ligne
// `color:#F8CD4A` se retape en trois secondes et personne ne la refuse en
// relecture. Ce fichier est ce qui la refuse.
//
// CE QU'IL SURVEILLE, ET POURQUOI CHAQUE PIEGE EST LA :
//
//   1. UN OR RECOPIE. C'est le cas qui est deja arrive : la copie de
//      `trace-affiche.js` du depot de suivi a pris cinq jours de retard sans
//      que rien ne le dise. Deux visuels du meme jeu dans le meme fil avec
//      deux ors differents, ca ne se voit qu'apres avoir poste.
//   2. L'UNITE DE MESURE REECRITE A LA MAIN. `h * 0.62` recopie dans un coin
//      est la ligne qu'on oublie au format suivant — et le chrono mange alors
//      le cadre en paysage, la ou il tient en portrait. On teste les deux
//      orientations, parce qu'un test qui n'en teste qu'une passe toujours.
//   3. LA VIRGULE A CHASSE PLEINE. Space Mono lui donne la case d'un chiffre :
//      « 8,64 » se lit « 8 , 64 », deux nombres au lieu d'un. Le retrait est
//      la seule valeur du fichier qu'on ne devine pas en la regardant, donc
//      la premiere qu'on retape de travers.
//   4. LA HIERARCHIE DES ENCRES. Elles ne sont pas interchangeables : le nom
//      se lit plus que le surtitre, moins que le chrono. Une encre changee
//      d'un cote seulement casse la mise en page des deux.
//
// LA VOIX DES JOURS DE COMPETITION N'EST PAS CONCERNEE. Le bleu nuit et le
// degrade orange de `page()` sont une autre voix, pour un autre jour ; ils ont
// leurs propres valeurs et c'est voulu. Si elle devait un jour porter du blanc
// en transparence, ce test le refuserait a tort — il faudrait alors le
// restreindre a `pageAffiche`, pas lever la regle.
//
//     node tools/palette-affiche-test.mjs

import fs from 'node:fs';
import { FOND, OR, OR_RVB, BLANC, ENCRE, LUEUR, encre, or, unite, RETRAIT_VIRGULE }
  from '../src/game/palette-affiche.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA VOIX ORDINAIRE — les valeurs du style, en un seul endroit║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/**
 * La source d'un fichier, ses commentaires retires.
 *
 * Les deux consommateurs PARLENT de `#060913` en prose — c'est meme la moindre
 * des choses. Un test qui lirait le fichier brut echouerait sur ces phrases-la
 * et on le desactiverait au bout de deux fois.
 *
 * Le `(?<!:)` devant les barres obliques est ce qui sauve `https://` : sans
 * lui, une adresse dans une chaine effacerait la fin de sa ligne, et une vraie
 * copie posee juste apres passerait inapercue.
 */
function sansCommentaires(chemin) {
  return fs.readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/.*$/gm, ' ');
}

titre('AUCUNE COPIE DES COULEURS NE SUBSISTE');
{
  // Ce qu'on ne veut plus voir ecrit ailleurs qu'ici, et le nom a employer.
  const interdits = [
    ['#060913', 'FOND'],
    ['#F8CD4A', 'OR'],
    ['248,205,74', 'OR_RVB, ou or(alpha)'],
    ['rgba(255,255,255', 'encre(ENCRE.<role>)'],
  ];
  for (const f of ['src/game/carton-film.ts', 'tools/carte-defi-ouvert.mjs']) {
    const code = sansCommentaires(f);
    for (const [motif, remede] of interdits) {
      const n = code.split(motif).length - 1;
      ok(`${f.split('/').pop()} n ecrit pas ${motif}`, n === 0,
         `${n} fois — utiliser ${remede} de palette-affiche.js`);
    }
  }
}

titre('LES DEUX CONSOMMATEURS LISENT BIEN LA PALETTE');
{
  for (const f of ['src/game/carton-film.ts', 'tools/carte-defi-ouvert.mjs']) {
    const code = sansCommentaires(f);
    ok(`${f.split('/').pop()} importe la palette`, /from '[^']*palette-affiche(\.js)?'/.test(code));
  }
  // Le fichier est du JavaScript nu POUR QUE node l'avale tel quel. Une
  // annotation de type glissee dedans casserait l'outil des cartes sans
  // toucher au jeu, qui compile — et on ne le verrait qu'a la carte suivante.
  const src = fs.readFileSync('src/game/palette-affiche.js', 'utf8');
  ok('la palette reste du JavaScript nu', !/^\s*export\s+(type|interface)\b/m.test(src)
     && !/:\s*(string|number|boolean)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, ' ')));
}

titre('L UNITE DE MESURE CONNAIT LES DEUX ORIENTATIONS');
{
  ok('en portrait, c est la largeur', unite(1080, 1920) === 1080);
  ok('en story, aussi', unite(1080, 1350) === 1080);
  // Le piege du format large : 1600 de large donnerait un chrono de 320 px de
  // haut sur une carte qui n'en fait que 900. On le ramene a la hauteur.
  ok('en paysage, c est 62 % de la hauteur', unite(1600, 900) === 558);
  ok('le carre passe par la largeur', unite(1000, 1000) === 1000);
}

titre('LES VALEURS QU ON RETAPE DE TRAVERS');
{
  ok('le retrait de la virgule fait trois dixiemes', RETRAIT_VIRGULE === 0.30);
  // Quatre dixiemes de chasse restants : c'est la mesure que `morceauxChrono`
  // donne deja dans trace-affiche.js. Moins, et les chiffres se touchent.
  ok('il en reste quatre dixiemes', +(1 - RETRAIT_VIRGULE * 2).toFixed(10) === 0.4);
  ok('la lueur est centree en haut', LUEUR.x === 0.5 && LUEUR.y === 0.08);
  ok('elle est large comme la carte', LUEUR.rayon === 0.85);
  ok('elle reste un voile', LUEUR.alpha > 0 && LUEUR.alpha <= 0.25);
}

titre('LA HIERARCHIE DES ENCRES TIENT');
{
  ok('le nom se lit plus que le surtitre', ENCRE.nom > ENCRE.surtitre);
  ok('le surtitre et l etiquette parlent pareil', ENCRE.surtitre === ENCRE.etiquette);
  ok('le lien se fait discret', ENCRE.lien < ENCRE.surtitre);
  ok('le pied droit l est encore plus', ENCRE.piedDroit < ENCRE.pied);
  ok('le filet ne fait que suggerer', ENCRE.filet < ENCRE.piedDroit);
  ok('tout est entre zero et un',
     Object.values(ENCRE).every(v => typeof v === 'number' && v > 0 && v < 1));
}

titre('LES FABRIQUES DE COULEUR RENDENT DU CSS VALIDE');
{
  ok('encre rend du blanc en transparence', encre(ENCRE.nom) === 'rgba(255,255,255,0.55)');
  ok('or rend l or en transparence', or(0.85) === 'rgba(248,205,74,0.85)');
  ok('or a zero est le bord du degrade', or(0) === 'rgba(248,205,74,0)');
  // L'or hexadecimal et l'or en composantes doivent etre le MEME or. Deux
  // valeurs qui derivent l'une de l'autre dans le meme fichier, c'est la copie
  // qu'on vient de supprimer, en plus petit.
  const [r, v, b] = OR_RVB.split(',').map(Number);
  const hex = '#' + [r, v, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  ok('les deux ors sont le meme or', hex === OR.toUpperCase(), `${hex} contre ${OR}`);
  ok('le fond et le blanc sont des couleurs', /^#[0-9a-f]{6}$/i.test(FOND) && /^#[0-9a-f]{6}$/i.test(BLANC));
}

console.log(e ? `\n✗ ${e} essai(s) en echec\n` : '\n✓ tout passe\n');
process.exit(e ? 1 : 0);
