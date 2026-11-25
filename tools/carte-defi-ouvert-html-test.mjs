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
     4. L'ECRITURE DES EPREUVES. « 100 m », et « 100 m H » pour les haies :
        c'est `EPREUVE` de `trace-affiche.js` qui en decide pour tout le jeu.
        Les deux cartes collaient « m » sans regarder la cle et ecrivaient
        « 100h m » sur un defi de haies.
     5. L'ADRESSE DU SERVEUR ET CELLE DU SITE. Une page qui interroge un
        ancien worker rend une carte plausible avec un compteur faux.
     6. QUE LA CARTE LIBRE NE MENTE PAS. Chaque champ propose remplace une
        ligne REELLEMENT dessinee, et un champ laisse vide rend la parole au
        defi au lieu d'effacer sa ligne. Un champ qui ne fait rien est pire
        qu'un champ absent : on croit avoir change la carte.
     7. QUE LA PAGE RESTE AUTONOME. Un `import` ajoute un jour de bonne foi —
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
import { EPREUVE } from '../src/game/trace-affiche.js';

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
// Le seul bloc <script> de la page. Deux sections le lisent : celle qui verifie
// que la carte libre atteint de vraies lignes, et celle qui refuse un `import`.
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

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

  // UN `import` SE DIT ICI, AVANT D'EVALUER. La derniere section du fichier
  // refuse les imports, mais elle ne parlait jamais : un module ne s'evalue
  // pas comme un script, si bien que la page partait en trace de pile deux
  // cents lignes plus haut et on cherchait la panne dans le harnais.
  if (/^\s*import\s/m.test(scripts[0])) {
    throw new Error("la page porte un `import` : Chrome refuse les modules ES"
      + ' en file://, et le double-clic ne marcherait plus. Voir la section'
      + ' « LA PAGE RESTE OUVRABLE PAR UN DOUBLE-CLIC ».');
  }

  // Le strict minimum de navigateur : la page accroche deux ecouteurs et lit
  // un champ au chargement. Tout le reste attend qu'on appuie.
  const element = () => new Proxy({}, {
    get: (_, p) => (p === 'value' || p === 'textContent' || p === 'className' ? ''
                  : p === 'hidden' ? true : () => element()),
    set: () => true,
  });
  const contexte = vm.createContext({
    // `head` est la pour que la pose de la barre du tableau, si sa condition de
    // protocole disparaissait, ne fasse pas planter la lecture avant la section
    // qui la verifie. Un plantage a la place d'une phrase, c'est ce qu'on
    // cherche a ne plus avoir.
    document: { getElementById: element, createElement: element, head: element(),
                querySelector: element, fonts: { load: async () => [], ready: Promise.resolve() } },
    // `protocol` absent : en lisant la page hors d'un navigateur, la condition
    // est fausse et la barre ne se pose pas. C'est bien ce qu'on veut mesurer.
    location: { search: '' },
    URLSearchParams, fetch, setTimeout, console, URL,
  });
  const rendus = ['API', 'SITE', 'FOND', 'OR', 'OR_RVB', 'BLANC', 'ENCRE', 'LUEUR',
                  'RETRAIT_VIRGULE', 'NUIT', 'HALO', 'FLAMME', 'ENCRE_NUIT',
                  'FORMATS', 'unite', 'echelle', 'tally', 'virgule', 'EPREUVE',
                  'ligne', 'CLES_LIBRE', 'TITRES'];
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

titre('L ECRITURE DES EPREUVES EST CELLE DE LA CHARTE');
{
  // Les deux cartes composaient `${e} m` : sur un defi de haies, la cle
  // « 100h » donnait « 100h m ». La charte ecrit « 100 m H », et c'est
  // `EPREUVE` de `trace-affiche.js` qui le decide pour tout le jeu — les
  // affiches, les cartes de course, et maintenant celles du defi ouvert.
  // Toutes les cles de `RaceKey` y passent : un test qui ne voit que « 100 »
  // ne voit justement pas le defaut qu'on corrige.
  for (const cle of ['100', '200', '400', '100h', '110h', '400h']) {
    ok(`« ${cle} » s ecrit « ${EPREUVE(cle)} »`, page.EPREUVE(cle) === EPREUVE(cle),
       `la page dit « ${page.EPREUVE(cle)} »`);
  }
  // Une epreuve absente ne doit pas devenir une unite toute seule.
  ok('une epreuve vide reste vide', page.EPREUVE('') === EPREUVE(''),
     `la page dit « ${page.EPREUVE('')} »`);
  // L'outil tourne sous node : il n'a aucune raison d'en garder une copie.
  // Une deuxieme copie serait une deuxieme derive a surveiller.
  ok('l outil prend EPREUVE a la source',
     /import \{ EPREUVE \} from '\.\.\/src\/game\/trace-affiche\.js'/.test(outil));
  // Le geste corrige, exige des deux cotes a la fois. On regarde ce que le
  // code FAIT et non ce qu'il mentionne : les deux fichiers citent l'ancienne
  // ecriture dans un commentaire, pour qu'on sache pourquoi elle a change.
  ok('les deux composent le libelle avec EPREUVE',
     /libelleEpreuve: epreuves\.map\(EPREUVE\)\.join/.test(html)
     && /const libelleEpreuve = epreuves\.map\(EPREUVE\)\.join/.test(outil));
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

titre('LA CARTE LIBRE REMPLACE DES LIGNES QUI EXISTENT');
{
  // `ligne` est tout le mecanisme : elle choisit entre ce qu'on a ecrit et ce
  // que le defi dicte. Un champ vide n'est pas une ligne vide.
  const d = { libre: { fort: 'Neuf ont essayé.' } };
  ok('une ligne reecrite remplace la sienne',
     page.ligne(d, 'fort', 'par defaut') === 'Neuf ont essayé.');
  ok('un champ vide rend la parole au defi',
     page.ligne({ libre: { fort: '' } }, 'fort', 'par defaut') === 'par defaut');
  ok('un champ absent aussi', page.ligne(d, 'doux', 'par defaut') === 'par defaut');
  ok('et une carte sans carte libre du tout',
     page.ligne({}, 'fort', 'par defaut') === 'par defaut');

  // CHAQUE CHAMP DOIT PEINDRE QUELQUE CHOSE. Le jour ou une maquette est
  // remaniee et perd une ligne, le champ correspondant resterait dans le
  // formulaire a ne rien faire — et on croirait la carte changee.
  for (const cle of page.CLES_LIBRE) {
    ok(`« ${cle} » est bien lue par une maquette`,
       new RegExp(`ligne\\(d, '${cle}'`).test(script));
  }

  // ...ET CHAQUE LIGNE PEINTE DOIT AVOIR SON CHAMP. L'inverse du test du
  // dessus : une ligne reecrite dans le script sans champ dans le formulaire
  // serait une porte sans poignee.
  //
  // `titre` fait exception : il se reecrit lui aussi, mais par le champ du
  // haut du formulaire, celui qui existait avant la carte libre. Il est donc
  // atteignable sans figurer dans CLES_LIBRE.
  const AILLEURS = ['titre'];
  const lues = [...script.matchAll(/ligne\(d, '([a-zA-Z]+)'/g)].map(m => m[1]);
  const sansChamp = [...new Set(lues)]
    .filter(c => !page.CLES_LIBRE.includes(c) && !AILLEURS.includes(c));
  ok('aucune ligne lue sans champ pour l ecrire', sansChamp.length === 0,
     sansChamp.join(', '));
  ok('le titre garde son champ a lui', /id="titre"/.test(html)
     && /ligne\(d, 'titre', d\.titreAffiche\)/.test(script)
     && /ligne\(d, 'titre', d\.titreCarte\)/.test(script));

  // Le formulaire et la liste des clefs ne peuvent pas se desynchroniser.
  const champs = [...html.matchAll(/id="l-([a-zA-Z]+)"/g)].map(m => m[1]);
  ok('le formulaire porte exactement les clefs annoncees',
     champs.slice().sort().join() === page.CLES_LIBRE.slice().sort().join(),
     `formulaire : ${champs.join(' ')}`);

  // Les textes qui etaient en dur sont maintenant des DEFAUTS, pas des
  // constantes : s'ils redeviennent litteraux, le champ ne les atteint plus.
  for (const dur of ['CODE DU DÉFI', 'à taper dans le jeu, onglet DÉFI',
                     'SPRINTER', 'JEU DE SPRINT']) {
    ok(`« ${dur} » n est plus qu un defaut`,
       new RegExp(`ligne\\(d, '[a-zA-Z]+', '${dur.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}'\\)`).test(script));
  }

  // LE DEBORD SE MESURE SUR LES LIMITES DURES, pas sur la zone de centrage.
  // Mesure a la main : le format paysage depasse sa zone de 7 px de chaque
  // cote depuis toujours, sans rien toucher. Une alerte qui se declenche sur
  // la carte par defaut est une alerte qu'on apprend a ignorer.
  ok('le debord se mesure sur le surtitre et le pied',
     /const limiteHaut = hautY \+ LH \* tSur;/.test(script)
     && /const limiteBas = Math\.round\(H - marge \* 1\.5\);/.test(script));
  // Chaque maquette mesure le sien sur SA geometrie, et le rendu garde le
  // plus grand des trois formats : un debord qui n'arrive qu'en paysage doit
  // se dire, meme si le carre tient.
  ok('l affiche mesure son debord',
     /const debord = Math\.max\(0, limiteHaut - y\) \+ Math\.max\(0, y \+ total - limiteBas\);/
       .test(script));
  ok('la carte mesure le sien sur sa propre zone',
     /const debord = Math\.max\(0, hHaut \+ hBillet \+ hBas - dispo\);/.test(script));
  ok('le rendu garde le plus grand des trois formats',
     /debord = Math\.max\(debord, dessiner\(c, f\.w, f\.h, donnees\) \|\| 0\);/.test(script));
}

titre('LES VINGT-CINQ ACCROCHES');
{
  // Ce que ce harnais peut verifier : la liste, sa forme, et qu'elle n'a qu'une
  // seule source. Ce qu'il ne peut PAS verifier : qu'une accroche tienne dans
  // le cadre — il faudrait un canvas et les fontes de la charte, que node n'a
  // pas. Cette mesure-la se fait dans le navigateur, et les nombres releves
  // sont ecrits dans le commentaire de TITRES pour qu'on sache le budget.
  ok('vingt-cinq accroches', page.TITRES.length === 25, `${page.TITRES.length}`);
  ok('cinq familles, cinq par famille',
     new Set(page.TITRES.map(x => x.f)).size === 5
     && [...new Set(page.TITRES.map(x => x.f))]
          .every(f => page.TITRES.filter(x => x.f === f).length === 5));
  ok('chacune a une forme courte et une longue',
     page.TITRES.every(x => x.c && x.l && typeof x.c === 'string' && typeof x.l === 'string'));
  ok('aucune forme courte en double',
     new Set(page.TITRES.map(x => x.c)).size === 25);

  // LE PLAFOND DE LONGUEUR. Mesure dans le navigateur : le cadre du titre se
  // remplit vers vingt-cinq signes, et c'est la coupe aux mots qui decide, pas
  // le compte — « Treize appuis par seconde » (25) tient, « Neuf secondes, pas
  // une » (22) deborde. Ce plafond-ci n'est donc pas la mesure : c'est le
  // garde-fou qui arrete une phrase entiere collee dans la colonne courte.
  const longues = page.TITRES.filter(x => x.c.length > 26);
  ok('aucune forme courte au-dela de 26 signes', longues.length === 0,
     longues.map(x => `${x.c.length} — ${x.c}`).join(' ; '));
  ok('les formes longues sont bien plus longues',
     page.TITRES.every(x => x.l.length > x.c.length));

  // Les deux listes se remplissent depuis TITRES et de nulle part ailleurs :
  // une liste ecrite en dur dans le HTML derive au premier ajout.
  ok('les deux listes se remplissent depuis TITRES',
     /for \(const \[id, champ\] of \[\['titre-choix', 'c'\], \['sous-choix', 'l'\]\]\)/.test(script));
  ok('le formulaire porte les deux listes vides',
     /<select id="titre-choix">/.test(html) && /<select id="sous-choix"/.test(html)
     && (html.match(/<optgroup/g) || []).length === 0);
  // La forme longue va dans la phrase qui SE COUPE AUX MOTS. La phrase forte se
  // dessine d'un seul trait : une accroche entiere y sortirait par le cote.
  ok('la forme longue va dans « sous », pas dans « fort »',
     /\$\('sous-choix'\)[\s\S]{0,200}\$\('l-sous'\)\.value/.test(script)
     && !/'l-fort'\)\.value = /.test(script));

  // LE DEBORD SE MESURE AUSSI EN LARGEUR. Sans ca, une phrase forte trop longue
  // sortait du cadre par le cote et la page repondait « tout va bien ».
  ok('centre() mesure la largeur de chaque ligne',
     /debordLarge = Math\.max\(debordLarge, c\.measureText\(texte\)\.width - cadreLarge\);/
       .test(script));
  ok('les deux maquettes arment la mesure',
     (script.match(/cadreLarge = utile; debordLarge = 0;/g) || []).length === 2);
  ok('et la rendent avec le debord vertical',
     (script.match(/return debord \+ Math\.max\(0, debordLarge\);/g) || []).length === 2);
}

titre('LA PAGE RESTE OUVRABLE PAR UN DOUBLE-CLIC');
{
  // Le jour ou l'une de ces trois lignes passe, la page ne s'ouvre plus qu'a
  // travers un serveur — c'est-a-dire plus du tout, le soir ou l'on poste.
  ok('aucun import de module', !/^\s*import\s/m.test(script));
  ok('aucun require', !/\brequire\s*\(/.test(script));
  // On regarde le BALISAGE, pas le script. Le bloc <script> est du JavaScript :
  // il a le droit de citer `<script src="nav.js">` dans un commentaire pour
  // expliquer ce que font les autres pages du tableau, et cette citation n'est
  // pas une balise. Le test portait sur le fichier entier et tombait donc sur
  // le commentaire — un garde-fou qui crie sur une explication.
  const balisage = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  ok('aucune balise de script exterieure', !/<script[^>]+src=/i.test(balisage));

  // ...ET LA BARRE DU TABLEAU EST POSEE A L'EXECUTION, SOUS CONDITION. C'est la
  // seule facon d'avoir les deux : le double-clic, qui ne doit faire aucune
  // requete, et le retour vers les autres pages quand la page est servie.
  ok('la barre du tableau est posee en JavaScript',
     /barre\.src = 'nav\.js';/.test(script));
  ok('...et seulement quand la page est servie',
     /if \(location\.protocol === 'http:' \|\| location\.protocol === 'https:'\) \{/
       .test(script));
  // La seule dependance exterieure tolérée, et elle a un repli : sans reseau
  // la page le DIT au lieu de rendre une carte en Arial sans prevenir.
  ok('les polices viennent de Google Fonts', /fonts\.googleapis\.com/.test(html));
  ok('une carte en police de repli est signalee',
     /police de repli/.test(html) && /policesPretes/.test(html));
}

console.log(e ? `\n${e} ecart(s). La page et l outil ne rendent plus la meme carte.\n`
              : '\nLa page et l outil rendent la meme carte.\n');
process.exit(e ? 1 : 0);
