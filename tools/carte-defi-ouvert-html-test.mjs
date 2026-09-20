/* ===========================================================================
   LA PAGE DES CARTES NE DOIT PAS DERIVER DE L'OUTIL
   ---------------------------------------------------------------------------
   `tools/carte-defi-ouvert.html` fabrique les memes trois images que
   `tools/carte-defi-ouvert.mjs`, et elle le fait avec une COPIE des couleurs
   de la charte. La copie est assumee et elle a une raison : Chrome refuse les
   modules ES a une page ouverte en `file://`, donc importer
   `palette-affiche.js` rendrait la page morte exactement dans le cas ou elle
   sert — une machine ou rien n'est monte, un soir de publication.

   Une copie non surveillee derive, et on ne s'en apercoit qu'apres avoir
   poste. C'est deja arrive une fois : la copie de `trace-affiche.js` du depot
   de suivi a pris cinq jours de retard sans que rien ne le dise, et deux
   visuels du meme jeu se sont croises dans le meme fil avec deux ors
   differents. Ce fichier est ce qui refuse la deuxieme fois.

   CE QU'IL SURVEILLE :

     1. LES COULEURS DES DEUX VOIX. La voix ordinaire vient de
        `src/game/palette-affiche.js`, celle des jours de competition de
        `tools/voix-competition.mjs`. Chaque valeur de la page est comparee a
        sa source, une par une.
     2. LES DEUX REGLES DE MESURE. `unite` et `echelle` sont les lignes qu'on
        recopie de travers au format suivant — et le chrono mange alors le
        cadre en paysage la ou il tenait en portrait. On les eprouve dans les
        deux orientations, parce qu'un test qui n'en teste qu'une passe
        toujours.
     3. LES PHRASES DU COMPTEUR. « 23 ont essaye, 3 ont fait mieux » est la
        voix du compte, pas un detail de mise en page. Deux outils qui rendent
        la meme carte ne doivent pas ecrire deux phrases differentes.
     4. L'ADRESSE DU SERVEUR ET CELLE DU SITE. Une page qui interroge un
        ancien worker rend une carte plausible avec un compteur faux.
     5. QUE LA PAGE RESTE AUTONOME. Un `import` ajoute un jour de bonne foi —
        « c'est plus propre » — tue le double-clic, et la panne ne se voit
        qu'a la machine suivante.

     node tools/carte-defi-ouvert-html-test.mjs
=========================================================================== */
import fs from 'node:fs';
import vm from 'node:vm';
import { FOND, OR, OR_RVB, BLANC, ENCRE, LUEUR, unite, RETRAIT_VIRGULE }
  from '../src/game/palette-affiche.js';
import { NUIT, HALO, FLAMME, ENCRE as ENCRE_NUIT, echelle, FORMATS }
  from './voix-competition.mjs';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA PAGE DES CARTES — une copie surveillee, pas une derive   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const PAGE = 'tools/carte-defi-ouvert.html';
const OUTIL = 'tools/carte-defi-ouvert.mjs';
const html = fs.readFileSync(PAGE, 'utf8');
const outil = fs.readFileSync(OUTIL, 'utf8');

/**
 * Les valeurs de la page, lues en la faisant tourner pour de vrai.
 *
 * Une lecture par expression reguliere dirait que `#F8CD4A` est ecrit quelque
 * part ; elle ne dirait pas que c'est bien lui que le canvas peint. On evalue
 * donc le script tel quel, avec juste ce qu'il faut de navigateur pour qu'il
 * arrive au bout, et on lui demande ses propres constantes.
 *
 * Les declarations `const` d'un script ne se posent pas sur l'objet global :
 * d'ou l'enveloppe en fonction, qui les rend au lieu de les chercher.
 */
function lirePage() {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scripts.length !== 1) throw new Error(`${scripts.length} blocs <script> au lieu d'un`);

  // Le strict minimum de navigateur : la page accroche deux ecouteurs et lit
  // un champ au chargement. Tout le reste attend qu'on appuie.
  const element = () => new Proxy({}, {
    get: (_, p) => (p === 'value' || p === 'textContent' || p === 'className' ? ''
                  : p === 'hidden' ? true : () => element()),
    set: () => true,
  });
  const contexte = vm.createContext({
    document: { getElementById: element, createElement: element,
                querySelector: element, fonts: { load: async () => [], ready: Promise.resolve() } },
    location: { search: '' },
    URLSearchParams, fetch, setTimeout, console, URL,
  });
  const rendus = ['API', 'SITE', 'FOND', 'OR', 'OR_RVB', 'BLANC', 'ENCRE', 'LUEUR',
                  'RETRAIT_VIRGULE', 'NUIT', 'HALO', 'FLAMME', 'ENCRE_NUIT',
                  'FORMATS', 'unite', 'echelle', 'tally', 'virgule'];
  return new vm.Script(`(function(){${scripts[0]}\nreturn {${rendus.join(',')}};})()`)
    .runInContext(contexte);
}

const page = lirePage();

titre('LA VOIX ORDINAIRE, VALEUR PAR VALEUR');
{
  ok('le fond', page.FOND === FOND, `${page.FOND} ≠ ${FOND}`);
  ok('l or', page.OR === OR, `${page.OR} ≠ ${OR}`);
  ok('l or en composantes', page.OR_RVB === OR_RVB, `${page.OR_RVB} ≠ ${OR_RVB}`);
  ok('le blanc', page.BLANC === BLANC, `${page.BLANC} ≠ ${BLANC}`);
  // Les encres ne sont pas interchangeables : le nom se lit plus que le
  // surtitre, moins que le chrono. Cette hierarchie EST la mise en page.
  for (const role of Object.keys(ENCRE)) {
    ok(`l encre « ${role} »`, page.ENCRE[role] === ENCRE[role],
       `${page.ENCRE[role]} ≠ ${ENCRE[role]}`);
  }
  ok('aucune encre en trop', Object.keys(page.ENCRE).length === Object.keys(ENCRE).length,
     `${Object.keys(page.ENCRE).length} contre ${Object.keys(ENCRE).length}`);
  for (const cle of Object.keys(LUEUR)) {
    ok(`la lueur, ${cle}`, page.LUEUR[cle] === LUEUR[cle], `${page.LUEUR[cle]} ≠ ${LUEUR[cle]}`);
  }
  ok('le retrait de la virgule', page.RETRAIT_VIRGULE === RETRAIT_VIRGULE,
     `${page.RETRAIT_VIRGULE} ≠ ${RETRAIT_VIRGULE}`);
  // La page ecrit la chasse restante et non le retrait : si l'une des deux
  // ecritures bouge seule, « 8,64 » se relit « 8 , 64 ».
  ok('la chasse restante est bien calculee, pas recopiee',
     /1 - RETRAIT_VIRGULE \* 2/.test(html));
}

titre('LA VOIX DES JOURS DE COMPETITION');
{
  ok('le bleu nuit', page.NUIT === NUIT, `${page.NUIT} ≠ ${NUIT}`);
  for (const cle of Object.keys(HALO)) {
    ok(`le halo, ${cle}`, page.HALO[cle] === HALO[cle], `${page.HALO[cle]} ≠ ${HALO[cle]}`);
  }
  for (const cle of Object.keys(FLAMME)) {
    ok(`la flamme, ${cle}`, page.FLAMME[cle] === FLAMME[cle],
       `${page.FLAMME[cle]} ≠ ${FLAMME[cle]}`);
  }
  // `rang` ne sert qu'aux cartes de nations : la page n'en a pas besoin, mais
  // ce qu'elle porte doit etre juste.
  for (const role of Object.keys(page.ENCRE_NUIT)) {
    ok(`l encre de nuit « ${role} »`, page.ENCRE_NUIT[role] === ENCRE_NUIT[role],
       `${page.ENCRE_NUIT[role]} ≠ ${ENCRE_NUIT[role]}`);
  }
}

titre('LES DEUX REGLES DE MESURE, DANS LES DEUX ORIENTATIONS');
{
  for (const [l, h] of [[1080, 1350], [1080, 1920], [1600, 900], [1000, 1000]]) {
    ok(`unite(${l}, ${h})`, page.unite(l, h) === unite(l, h),
       `${page.unite(l, h)} ≠ ${unite(l, h)}`);
    ok(`echelle(${l}, ${h})`, page.echelle(l, h) === echelle(l, h),
       `${page.echelle(l, h)} ≠ ${echelle(l, h)}`);
  }
}

titre('LES TROIS FORMATS SONT LES MEMES');
{
  ok('il y en a trois', page.FORMATS.length === FORMATS.length);
  for (const attendu of FORMATS) {
    const trouve = page.FORMATS.find(f => f.cle === attendu.cle);
    ok(`${attendu.cle} fait ${attendu.w}×${attendu.h}`,
       !!trouve && trouve.w === attendu.w && trouve.h === attendu.h,
       trouve ? `${trouve.w}×${trouve.h}` : 'absent');
  }
  // Les noms de fichier sont ce qui se retrouve dans le dossier de
  // publication : deux outils qui nomment differemment font deux jeux d'images
  // qu'on croit distincts.
  ok('les suffixes de fichier sont ceux de l outil',
     /\$\{base\}-\$\{style\}-\$\{f\.cle\}\.png/.test(html)
     && /\$\{base\}-\$\{args\.style\}-\$\{f\.s\}\.png/.test(outil));
}

titre('LES PHRASES DU COMPTEUR SONT CELLES DE L OUTIL');
{
  // Chaque etat du compteur, tel que la page le rend, doit se retrouver mot
  // pour mot dans l'outil. Un chiffre invente ou une phrase reecrite d'un seul
  // cote, ce sont deux posts du meme compte qui ne parlent pas pareil.
  const ARGS = {
    'hors ligne':       [true, 0, 0],
    'personne':         [false, 0, 0],
    'un seul essai':    [false, 1, 0],
    'aucun battu':      [false, 12, 0],
    'un battu':         [false, 12, 1],
    'plusieurs battus': [false, 23, 3],
  };
  const cas = Object.entries(ARGS).map(([nom, a]) => [nom, page.tally(...a)]);
  // Le `tally` de l'outil, extrait de sa source et joue pour de vrai. Une
  // comparaison de texte aurait bute sur `${essais}` face a « 23 » et sur
  // `${battus === 1 ? 'a' : 'ont'}` face a « a » ; on ne compare donc pas des
  // lignes, on compare des phrases rendues.
  const corps = outil.match(/function tally\(\) \{[\s\S]*?\n\}/);
  ok('le tally de l outil est lisible', !!corps);
  const tallyOutil = corps && new vm.Script(
    `(function(horsLigne, essais, battus){${corps[0]}\nreturn tally();})`).runInThisContext();
  for (const [nom, rendu] of cas) {
    if (!tallyOutil) break;
    const [horsLigne, essais, battus] = ARGS[nom];
    const attendu = tallyOutil(horsLigne, essais, battus);
    ok(`${nom} — « ${rendu.fort} »`, rendu.fort === attendu.fort, `l outil dit « ${attendu.fort} »`);
    ok(`${nom} — « ${rendu.doux} »`, rendu.doux === attendu.doux, `l outil dit « ${attendu.doux} »`);
  }
}

titre('LE SERVEUR ET LE SITE SONT LES MEMES');
{
  const lire = (src, nom) => (src.match(new RegExp(`const ${nom}\\s*=\\s*'([^']+)'`)) || [])[1];
  ok('la meme API', page.API === lire(outil, 'API'), `${page.API} ≠ ${lire(outil, 'API')}`);
  ok('le meme site', page.SITE === lire(outil, 'SITE'), `${page.SITE} ≠ ${lire(outil, 'SITE')}`);
  // Le lien ecrit sur la carte est celui qui se dicte a voix haute ; l'autre,
  // celui qui s'envoie. Les confondre coute un apercu ou un lien mort.
  ok('la carte porte le lien court', html.includes('${SITE}/d/${d.code}')
     && outil.includes('${SITE}/d/${echappe(args.code)}'));
  ok('le recapitulatif porte le lien a envoyer', html.includes('https://${SITE}/?defi=${code}'));
}

titre('LES DEUX MAQUETTES GARDENT CHACUNE SON DEFAUT');
{
  // L'affiche annonce le format, la carte de competition annonce le chrono.
  // Les intervertir change ce que dit le post sans qu'on l'ait decide.
  ok('l affiche titre « Défi ouvert »',
     html.includes("titreAffiche: titre || 'Défi ouvert'")
     && outil.includes("args.titre || 'Défi ouvert'"));
  ok('la carte titre le chrono',
     html.includes('titreCarte: titre || `${virgule(totalMs)} s`')
     && outil.includes('args.titre || `${virgule(totalMs)} s`'));
  ok('le chrono s ecrit a la virgule', page.virgule(8640) === '8,64', page.virgule(8640));
}

titre('LA PAGE RESTE OUVRABLE PAR UN DOUBLE-CLIC');
{
  // Le jour ou l'une de ces trois lignes passe, la page ne s'ouvre plus qu'a
  // travers un serveur — c'est-a-dire plus du tout, le soir ou l'on poste.
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  ok('aucun import de module', !/^\s*import\s/m.test(script));
  ok('aucun require', !/\brequire\s*\(/.test(script));
  ok('aucun script exterieur', !/<script[^>]+src=/i.test(html));
  // La seule dependance exterieure tolérée, et elle a un repli : sans reseau
  // la page le DIT au lieu de rendre une carte en Arial sans prevenir.
  ok('les polices viennent de Google Fonts', /fonts\.googleapis\.com/.test(html));
  ok('une carte en police de repli est signalee',
     /police de repli/.test(html) && /policesPretes/.test(html));
}

console.log(e ? `\n${e} ecart(s). La page et l outil ne rendent plus la meme carte.\n`
              : '\nLa page et l outil rendent la meme carte.\n');
process.exit(e ? 1 : 0);
