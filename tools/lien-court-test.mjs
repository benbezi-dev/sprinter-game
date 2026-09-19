// LA PORTE DES DEFIS — sprinter-game.com/d/K7M2QX
//
// Ce test execute le VRAI fichier `public/404.html`, pas une copie de sa
// logique. C'est tout l'interet : une copie serait exactement ce qui part a la
// derive, et on ne s'en apercevrait qu'en perdant des joueurs — silencieusement,
// un par un, chacun tombant sur une page d'erreur au lieu d'une course.
//
// Les pieges qu'il garde, dans l'ordre ou ils couteraient cher :
//
//   1. LE CANAL. GitHub Pages sert le repli de la RACINE, y compris pour un
//      chemin sous « /test/ ». Une porte qui lirait le canal dans son propre
//      emplacement enverrait tous les liens de test sur la production, et donc
//      sur la vraie base. Les deux bases D1 existent pour empecher exactement
//      ca ; ce serait dommage de rouvrir la porte a cote.
//   2. LA BARRE FINALE. Les claviers de telephone en ajoutent une tout seuls
//      apres un chemin. « /d/K7M2QX/ » doit ouvrir la meme course.
//   3. LE SEGMENT DE TROP. « /d/K7M2QX/autre » n'est pas un defi qu'on aurait
//      mal ecrit : c'est une adresse dont on ne sait rien. Deviner ici, c'est
//      ouvrir une course au hasard a quelqu'un qui en cherchait une autre.
//   4. LA BOUCLE. Une redirection posee avec `assign` laisse cette page dans
//      l'historique : le bouton « retour » y revient, et elle redirige encore.
//      On n'en sort qu'en fermant l'onglet.
//   5. LE JUGEMENT DU CODE. La porte transporte, elle ne trie pas.
//      `normalizeCode` reste seul juge cote jeu. Deux avis sur ce qu'est un
//      code, c'est un jour ou l'un accepte ce que l'autre refuse.
//
//     node tools/lien-court-test.mjs

import fs from 'node:fs';
import vm from 'node:vm';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const PAGE = fs.readFileSync('public/404.html', 'utf8');

/**
 * Le script de la page, extrait tel quel.
 *
 * On prend le contenu du `<script>` sans attribut — celui de la porte. Le
 * `<noscript>` n'en est pas un et ne contient rien d'executable ; s'il le
 * devenait, ce filtre le laisserait de cote et la ligne suivante s'en
 * plaindrait plutot que de tester la mauvaise chose.
 */
function scriptDeLaPorte() {
  const m = /<script>([\s\S]*?)<\/script>/.exec(PAGE);
  if (!m) throw new Error('aucun <script> dans public/404.html');
  return m[1];
}

/**
 * Ouvre la page comme un navigateur le ferait, sur un chemin donne.
 *
 * Rend ce qui s'est passe : soit l'adresse vers laquelle elle a redirige, soit
 * la page restee la avec le lien de secours qu'elle propose. On rejoue le
 * fichier a chaque cas, parce qu'une porte qui garderait un etat d'un appel a
 * l'autre serait justement le defaut qu'on cherche.
 */
function ouvrir(chemin, hash = '', recherche = '') {
  let remplace = null, assigne = null, classe = '';
  const retour = { href: '/' };
  const fenetre = {
    location: {
      pathname: chemin, hash, search: recherche,
      replace: v => { remplace = v; },
      assign: v => { assigne = v; },
    },
  };
  const doc = {
    getElementById: () => ({ setAttribute: (k, v) => { if (k === 'href') retour.href = v; } }),
    body: { parentNode: { get className() { return classe; }, set className(v) { classe = v; } } },
  };
  const bac = vm.createContext({ window: fenetre, document: doc, console });
  vm.runInContext(scriptDeLaPorte(), bac);
  return { vers: remplace, assigne, reste: !remplace, retour: retour.href, classe,
           porte: bac.porteDuDefi };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA PORTE DES DEFIS — un chemin, une course                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('LE CHEMIN COURT OUVRE LA COURSE');
{
  ok('/d/CODE mene au defi', ouvrir('/d/K7M2QX').vers === '/?defi=K7M2QX');
  ok('la barre finale se pardonne', ouvrir('/d/K7M2QX/').vers === '/?defi=K7M2QX');
  // Le code voyage a l'oral et a l'ecran : personne ne garantit la casse.
  // On le transporte tel quel, le jeu le normalise.
  ok('la casse passe telle quelle', ouvrir('/d/k7m2qx').vers === '/?defi=k7m2qx');
  ok('un code pourcent-encode est rendu lisible',
     ouvrir('/d/K7M2%51X').vers === '/?defi=K7M2QX');
  // Un « % » solitaire fait echouer decodeURIComponent. La porte doit rester
  // debout : mieux vaut un code que le jeu refusera qu'une page blanche.
  ok('un encodage casse ne fait pas tomber la porte',
     ouvrir('/d/K7M2%QX').vers === '/?defi=K7M2%25QX', JSON.stringify(ouvrir('/d/K7M2%QX').vers));
  // L'ancre sert aux onglets du jeu. La perdre en route enverrait sur
  // l'accueil quelqu'un qu'on avait mene jusqu'au defi.
  ok('l ancre suit', ouvrir('/d/K7M2QX', '#duels').vers === '/?defi=K7M2QX#duels');
  // La provenance accrochee au lien est la reponse a « d'ou viennent les
  // joueurs ? ». La perdre sur le chemin qu'on vient de creer pour en amener
  // serait une ironie couteuse.
  ok('la provenance suit',
     ouvrir('/d/K7M2QX', '', '?utm_source=tiktok').vers === '/?defi=K7M2QX&utm_source=tiktok',
     JSON.stringify(ouvrir('/d/K7M2QX', '', '?utm_source=tiktok').vers));
  // Le chemin fait foi : un `defi=` traine dans la question ne doit pas
  // produire deux codes dans la meme adresse, dont le jeu prendrait le premier.
  ok('un defi= en double est ecarte',
     ouvrir('/d/K7M2QX', '', '?defi=AUTRE&a=1').vers === '/?defi=K7M2QX&a=1',
     JSON.stringify(ouvrir('/d/K7M2QX', '', '?defi=AUTRE&a=1').vers));
}

titre('LE CANAL DE TEST RESTE DANS LE CANAL DE TEST');
{
  // Pages sert le repli de la RACINE pour « /test/... ». La porte lit donc le
  // chemin DEMANDE, jamais l'endroit d'ou elle a ete servie.
  ok('/test/d/CODE reste en test', ouvrir('/test/d/K7M2QX').vers === '/test/?defi=K7M2QX');
  ok('la barre finale aussi', ouvrir('/test/d/K7M2QX/').vers === '/test/?defi=K7M2QX');
  ok('la production ne part pas en test', ouvrir('/d/K7M2QX').vers.indexOf('/test/') !== 0);
  // « /testament/d/X » commence par « /test » sans etre le canal de test.
  ok('un chemin qui commence pareil n est pas le canal',
     ouvrir('/testament/d/K7M2QX').reste, JSON.stringify(ouvrir('/testament/d/K7M2QX').vers));
}

titre('CE QUI N EST PAS UN DEFI NE DEVIENT PAS UN DEFI');
{
  for (const c of ['/', '/test/', '/d/', '/d', '/inconnu', '/d/K7M2QX/autre',
                   '/dashboard/', '/decors/piste.png', '/confidentialite.html']) {
    ok(`${c} ne redirige pas`, ouvrir(c).reste, JSON.stringify(ouvrir(c).vers));
  }
}

titre('QUAND ELLE RESTE, ELLE RAMENE AU BON JEU');
{
  const p = ouvrir('/inconnu');
  ok('elle se montre', /montre/.test(p.classe), JSON.stringify(p.classe));
  ok('elle propose le jeu', p.retour === '/');
  const t = ouvrir('/test/inconnu');
  ok('en test, elle propose le jeu de test', t.retour === '/test/');
  // Le cas courant est une redirection : une page qui s'affiche puis disparait
  // est un clignotement, et un clignotement entre une video et une course est
  // ce qui fait fermer l'onglet.
  ok('elle ne se montre pas quand elle redirige', !/montre/.test(ouvrir('/d/K7M2QX').classe));
}

titre('LA REDIRECTION NE PIEGE PAS LE BOUTON RETOUR');
{
  const p = ouvrir('/d/K7M2QX');
  ok('elle remplace, elle n empile pas', p.vers !== null && p.assigne === null);
}

titre('LA PORTE NE JUGE PAS CE QU EST UN CODE');
{
  // Six caracteres est la forme du jour ; l'alphabet aussi. Les figer ici en
  // ferait une seconde definition, et le jour ou l'une bouge, un code valide
  // se ferait refuser a la porte sans que rien ne l'explique.
  const p = ouvrir('/d/ABC').vers, l = ouvrir('/d/CODEBEAUCOUPTROPLONG').vers;
  ok('un code court passe quand meme', p === '/?defi=ABC');
  ok('un code long aussi', l === '/?defi=CODEBEAUCOUPTROPLONG');
}

titre('CE QUI EST IMPRIME, LA PORTE L OUVRE');
{
  /*
    LE VRAI RISQUE DE CE CHANTIER N'EST PAS LA PORTE, C'EST L'ECART.
    Trois programmes ECRIVENT cette adresse — le carton de fin d'une video, et
    les deux maquettes de cartes — et un seul l'OUVRE. Le jour ou l'un d'eux
    ecrit « /defi/ » au lieu de « /d/ », rien ne casse : la carte sort, la
    video sort, elles sont belles, et chaque personne qui tape ce qu'elle y lit
    tombe sur une page d'erreur. Personne ne le signale — on ne signale pas une
    adresse qui ne marche pas, on passe a autre chose.

    On relit donc ce que chaque fichier imprime VRAIMENT, et on le fait passer
    par la porte.
  */
  const SITE = 'sprinter-game.com', CODE = 'K7M2QX';

  /**
   * Toutes les adresses qu'un fichier compose apres le nom de domaine.
   *
   * On les prend TOUTES et pas la premiere : l'outil des cartes porte deux
   * maquettes, et n'en corriger qu'une donnerait une carte juste et une carte
   * morte, sorties par la meme commande le meme jour.
   *
   * Le gabarit nomme le code differemment selon le fichier — `${code}` dans le
   * jeu, `${echappe(args.code)}` dans l'outil. On remplace n'importe quelle
   * interpolation par un vrai code, ce qui rend le chemin tel qu'il sera lu.
   */
  function imprimePar(fichier) {
    const src = fs.readFileSync(fichier, 'utf8');
    const trouves = src.match(/\$\{SITE\}\/(?:[^`<"'\s]|\$\{[^}]*\})*/g) || [];
    return trouves.map(t => t.slice('${SITE}'.length).replace(/\$\{[^}]*\}/g, CODE));
  }

  for (const f of ['src/game/carton-film.ts', 'tools/carte-defi-ouvert.mjs']) {
    const chemins = imprimePar(f);
    ok(`${f.split('/').pop()} imprime une adresse de defi`, chemins.length > 0,
       'aucun gabarit trouve — le test ne verifie plus rien');
    for (const chemin of chemins) {
      // Deux formes sont legitimes, et une seule autre est possible : une
      // troisieme qu'on aurait inventee. `?defi=` est la forme qu'on ENVOIE,
      // celle qui repond 200 et garde son apercu — la porte n'a rien a en
      // faire. Tout le reste doit s'ouvrir.
      if (chemin.indexOf('/?defi=') === 0) {
        ok(`   ${SITE}${chemin} est la forme longue, assumee`, chemin === '/?defi=' + CODE);
        continue;
      }
      const p = ouvrir(chemin);
      ok(`   la porte ouvre ${SITE}${chemin}`, p.vers === '/?defi=' + CODE,
         JSON.stringify(p.vers));
    }
  }
}

titre('LA PAGE TIENT SES PROMESSES D AFFICHAGE');
{
  // Le fond du jeu, pose par le CSS et non attendu du bundle : un dixieme de
  // seconde de blanc entre une video et le jeu, c'est l'ecran qui clignote au
  // moment ou l'on demande a quelqu'un de nous faire confiance.
  ok('le fond du jeu est pose des le premier octet', /background:\s*#060913/.test(PAGE));
  ok('elle ne se laisse pas indexer', /name="robots"\s+content="noindex"/.test(PAGE));
  ok('elle parle aussi sans JavaScript', /<noscript>/.test(PAGE));
  // Une page de repli qui irait chercher une police ou un script ailleurs
  // attendrait le reseau avant de rediriger — sur la connexion d'un stade,
  // c'est une seconde perdue pile quand on n'en a pas.
  ok('elle ne depend de rien d exterieur',
     !/<(script|link|img)[^>]+(src|href)=["']https?:/i.test(PAGE));
}

console.log(e ? `\n✗ ${e} essai(s) en echec\n` : '\n✓ tout passe\n');
process.exit(e ? 1 : 0);
