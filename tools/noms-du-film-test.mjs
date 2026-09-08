// QUI LE FILM DE LA COURSE A FILME.
//
// La piste peint le pseudonyme de chaque adversaire sur une pastille au-dessus
// de sa tete — c'est ce qui permet de le reconnaitre en pleine course, et c'est
// toute la raison d'etre du repere. Le replay capture le canvas : ces noms
// partent donc avec la video, pendant toute sa duree.
//
// Le joueur a le droit de partager sa course. Il n'a simplement aucun moyen de
// deviner qu'il partage aussi le nom de quelqu'un d'autre : sur l'ecran de fin,
// la piste n'est plus la. L'ecran l'en avertit avant l'envoi, et cet
// avertissement ne vaut que si la liste est juste — trop large il crie au loup
// et on cesse de le lire, trop etroite il oublie quelqu'un.
//
// C'est cette liste qu'on mesure ici, et on la mesure SUR LA VRAIE SOURCE :
// le fichier est relu et la fonction extraite telle qu'elle est ecrite. Une
// copie du calcul dans ce test passerait au vert le jour ou le jeu changerait
// d'avis sans lui.
//
// Le piege est dans `all` : le fantome ne vit pas toujours dans `G.runners`.
// `armLive` l'en retire meme explicitement pour liberer son couloir. Une
// version qui ne lirait que `G.runners` oublierait donc exactement le cas le
// plus courant — le duel contre un fantome, ou l'unique nom affiche est celui
// de l'adversaire.

import fs from 'node:fs';

const FICHIER = 'src/game/sprinter-app.js';
const src = fs.readFileSync(new URL('../' + FICHIER, import.meta.url), 'utf8');
const bloc = src.match(/  function pseudonymesSurLaPiste\(\) \{[\s\S]*?\n  \}/);

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

if (!bloc) {
  console.log(`\n✗ pseudonymesSurLaPiste est introuvable dans ${FICHIER}\n`);
  process.exit(1);
}

// Les libelles, tels que l'i18n les rend. Ils ne designent personne.
const LIBELLES = { you: 'TOI', ghost_label: 'le fantôme', opponent: 'l’adversaire' };

/** Lance la vraie fonction sur une piste fabriquee. */
function surLaPiste(G) {
  return new Function('G', 't', `${bloc[0]}\n return pseudonymesSurLaPiste();`)(
    G, k => (k in LIBELLES ? LIBELLES[k] : k));
}

/** Un coureur, avec ou sans pastille. `null` = un coureur de l'ordinateur. */
const coureur = (nom, extra = {}) => ({ repere: nom === null ? null : { nom, ...extra } });

const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);

titre('la course seul');
{
  ok('les sept coureurs de l ordinateur ne portent pas de nom',
     meme(surLaPiste({ runners: [coureur(null), coureur(null)], ghost: null }), []));
  ok('le joueur ne se compte pas lui-meme',
     meme(surLaPiste({ runners: [coureur('TOI', { moi: true })], ghost: null }), []));
}

titre('le fantome');
{
  // Le cas d'armLive : le fantome a pris le couloir 4 et le coureur de
  // l'ordinateur qui l'occupait a ete retire de G.runners. Le fantome, lui,
  // n'y a jamais ete mis.
  ok('un fantome absent de G.runners est vu quand meme',
     meme(surLaPiste({ runners: [coureur(null)], ghost: { runner: coureur('Théo') } }),
          ['Théo']));

  // Et le cas inverse, celui d'armLives : a plusieurs, l'adversaire designe
  // EST dans G.runners. drawAthletes ne le dessine alors qu'une fois, et on ne
  // doit pas le nommer deux fois non plus.
  const lui = coureur('Théo');
  ok('un fantome deja dans G.runners n est pas compte deux fois',
     meme(surLaPiste({ runners: [lui], ghost: { runner: lui } }), ['Théo']));
}

titre('le direct');
{
  ok('tous les adversaires nommes, dans l ordre des couloirs',
     meme(surLaPiste({ runners: [coureur('TOI', { moi: true }), coureur('Loïc'),
                                 coureur('Naïm'), coureur(null)], ghost: null }),
          ['Loïc', 'Naïm']));
  ok('le fantome et les devances, ensemble',
     meme(surLaPiste({ runners: [coureur('TOI', { moi: true }), coureur('Loïc')],
                       ghost: { runner: coureur('Théo') } }),
          ['Loïc', 'Théo']));
  ok('deux homonymes ne font qu une entree',
     meme(surLaPiste({ runners: [coureur('Théo'), coureur('Théo')], ghost: null }),
          ['Théo']));
}

titre('ce qui ne designe personne');
{
  // « ADVERSAIRE » est le nom de repli que armLive donne au Runner quand la
  // salle n'a transmis aucun pseudonyme : avertir sur celui-la reviendrait a
  // avertir sur rien.
  ok('les libelles generiques ne sont pas des pseudonymes',
     meme(surLaPiste({ runners: [coureur('le fantôme'), coureur('l’adversaire'),
                                 coureur('ADVERSAIRE')], ghost: null }), []));
  ok('un nom vide, ou fait d espaces, ne compte pas',
     meme(surLaPiste({ runners: [coureur(''), coureur('   ')], ghost: null }), []));
}

console.log(e ? `\n✗ ${e} echec(s)\n` : '\n✓ tout passe\n');
process.exit(e ? 1 : 0);
