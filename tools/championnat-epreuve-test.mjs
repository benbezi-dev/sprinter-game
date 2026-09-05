// De quoi un champion est-il champion ?
//
// L'edition ne portait aucune distance. Elle avait un echelon, une zone et un
// weekend, et ses chronos etaient ranges dans `champ_resultats` sans qu'on
// puisse dire sur quoi ils avaient ete courus — « Champion de France » ne
// designait donc rien de precis, et l'annoncer publiquement aurait promis une
// competition qui n'existait pas sous ce nom.
//
// Ce harnais tient les quatre choses qu'on attend d'une colonne pareille :
// elle se pose, elle se relit, elle refuse ce qui n'est pas une epreuve du
// jeu, et son absence retombe sur le 100 m plutot que sur `null` — les appels
// ecrits avant qu'elle existe doivent ouvrir exactement ce qu'ils ouvraient.
//
//   node tools/championnat-peupler.mjs        (une fois, pour la grille)
//   BASE=http://127.0.0.1:8788 node tools/championnat-epreuve-test.mjs

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const B = process.env.BASE || 'http://127.0.0.1:8788';

const ADMIN = {
  'Content-Type': 'application/json',
  'X-Sprinter-Admin': 'cle-de-test-locale-uniquement',
};
const _acces = await fetch(B + '/test/admin/creer', {
  method: 'POST', headers: ADMIN, body: JSON.stringify({ nom: 'harnais-epreuve' }),
}).then(r => r.json());
const H = { ...ADMIN, 'X-Sprinter-Test': _acces.code };

const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

/**
 * Une edition neuve.
 *
 * Une zone ne tient qu'un championnat a la fois — c'est la regle, et on ne la
 * contourne pas pour un test. On remet donc les editions a zero entre deux
 * ouvertures, avec l'outil qui existe deja pour ca. Il ne touche que la base
 * locale, et il n'y a pas de route HTTP pour cela : effacer les championnats
 * d'un coup n'est pas quelque chose que le serveur doit savoir faire.
 */
function viderEditions() {
  execFileSync('node', [join(RACINE, 'tools', 'championnat-peupler.mjs'), '--vider-editions'],
               { cwd: RACINE, stdio: 'ignore' });
}
async function ouvrir(corps) {
  viderEditions();
  return post('/champ/ouvrir', corps);
}

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  L EPREUVE D UN CHAMPIONNAT                                ║');
console.log('╚════════════════════════════════════════════════════════════╝');

// ---------------------------------------------------------------------------
titre('une epreuve inconnue est refusee');

// Ce cas se juge AVANT la grille : la validation passe avant le tirage, donc
// elle repond meme sur une base vide. C'est voulu — une distance fantaisiste
// ne doit pas dependre du nombre de joueurs pour etre refusee.
const bidon = await post('/champ/ouvrir', {
  pays: 'FR', debut: Date.UTC(2026, 9, 3), epreuve: '150',
});
ok('150 m est refuse', bidon.error === 'epreuve inconnue', JSON.stringify(bidon));

const vide = await post('/champ/ouvrir', {
  pays: 'FR', debut: Date.UTC(2026, 9, 3), epreuve: '',
});
ok('une epreuve vide est refusee aussi', vide.error === 'epreuve inconnue', JSON.stringify(vide));

// ---------------------------------------------------------------------------
titre('la grille');

const sonde = await ouvrir({ pays: 'FR', debut: Date.UTC(2026, 9, 3) });
const grillePleine = !sonde.error;

if (!grillePleine) {
  console.log(`\n   La base locale n'a pas de quoi ouvrir une edition :`);
  console.log(`   ${JSON.stringify(sonde)}`);
  console.log(`\n   Les trois epreuves ci-dessus se jugent sans grille et sont passees.`);
  console.log(`   Pour le reste : node tools/championnat-peupler.mjs\n`);
  process.exit(echecs ? 1 : 0);
}

ok('sans epreuve, on ouvre un 100 m', sonde.epreuve === '100', JSON.stringify(sonde.epreuve));

const etat0 = await get('/champ/edition/' + sonde.edition);
ok('et l edition relue le dit aussi', etat0.epreuve === '100', JSON.stringify(etat0.epreuve));

// ---------------------------------------------------------------------------
titre('une autre distance se pose et se relit');

const deux = await ouvrir({ pays: 'FR', debut: Date.UTC(2026, 9, 10), epreuve: '200' });
ok('le 200 m s ouvre', !deux.error && deux.epreuve === '200', JSON.stringify(deux));

const etat2 = await get('/champ/edition/' + deux.edition);
ok('il survit a l aller-retour en base', etat2.epreuve === '200', JSON.stringify(etat2.epreuve));

// ---------------------------------------------------------------------------
titre('l epreuve suit l edition partout ou elle se montre');

const monde = await get('/champ/monde');
const ligne = [...(monde.encours || []), ...(monde.sacres || [])]
  .find(x => x.edition === deux.edition);
ok('le recapitulatif mondial la porte', ligne && ligne.epreuve === '200',
   JSON.stringify(ligne && ligne.epreuve));

const fil = await get('/champ/direct?zone=FR');
const ouverture = (fil.annonces || []).find(a => a.edition === deux.edition && a.type === 'ouverture');
ok('l annonce d ouverture l annonce en toutes lettres',
   !!ouverture && /^200 m\./.test(ouverture.texte || ''),
   ouverture ? JSON.stringify(ouverture.texte) : 'annonce introuvable');

console.log(echecs ? `\n✗ ${echecs} echec(s)\n` : '\n✓ tout passe\n');
process.exit(echecs ? 1 : 0);
