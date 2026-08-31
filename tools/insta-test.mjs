// Le pseudo Instagram, tel que les gens le donnent.
//
// Le probleme qu'on cherche a prendre en defaut est celui-ci : personne ne
// tape son pseudo « nu ». On ecrit @pseudo, ou bien on colle le lien que
// l'application propose de partager. Si le jeu refuse ces deux formes, il
// refuse la seule facon dont le pseudo est reellement sous la main — et le
// joueur croit que son compte n'existe pas.
//
// Deux nettoyages existent, l'un au serveur et l'autre a l'ecran. Ils doivent
// repondre la meme chose, sinon l'ecran promettrait ce que le serveur refuse.
//
//   node tools/insta-test.mjs

import { nettoyerInsta as serveur } from '../worker/src/insta.js';

// Le jumeau client est en TypeScript, mais n'a pas une ligne de type dans son
// corps : on le lit et on en fait un module, plutot que d'ajouter un
// compilateur pour trois expressions regulieres.
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/insta.ts', import.meta.url), 'utf8')
  .replace('nettoyerInsta(brut: unknown): string | null', 'nettoyerInsta(brut)');
const { nettoyerInsta: client } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

/** Chaque saisie, et le pseudo qu'elle doit donner ('' delie, null refuse). */
const cas = [
  // ce que le joueur tape
  ['usain.bolt',                                   'usain.bolt'],
  ['@usain.bolt',                                  'usain.bolt'],
  ['@@usain.bolt',                                 'usain.bolt'],
  ['  @usain.bolt  ',                              'usain.bolt'],
  ['@ usain.bolt',                                 'usain.bolt'],
  ['usain_bolt',                                   'usain_bolt'],

  // ce que le joueur colle
  ['instagram.com/usain.bolt',                     'usain.bolt'],
  ['www.instagram.com/usain.bolt',                 'usain.bolt'],
  ['https://instagram.com/usain.bolt',             'usain.bolt'],
  ['https://www.instagram.com/usain.bolt/',        'usain.bolt'],
  ['https://www.instagram.com/usain.bolt/?igsh=MXY3', 'usain.bolt'],
  ['http://m.instagram.com/usain.bolt',            'usain.bolt'],
  ['https://www.instagram.com/@usain.bolt',        'usain.bolt'],
  ['instagr.am/usain.bolt',                        'usain.bolt'],
  ['//instagram.com/usain.bolt',                   'usain.bolt'],
  ['https://www.instagram.com/usain.bolt/reels/',  'usain.bolt'],
  ['​usain.bolt​',                       'usain.bolt'],   // invisibles du presse-papier
  ['@usain.bolt ',                            'usain.bolt'],   // espace insecable

  // ce qu'on refuse, et pourquoi
  ['',                                             ''],             // deliaison
  ['   ',                                          ''],
  ['@',                                            null],
  ['us ain',                                       'usain'],        // espace interne : scorie de copie
  ['usain!bolt',                                   null],
  ['a'.repeat(31),                                 null],
  ['a'.repeat(30),                                 'a'.repeat(30)],
  ['instagram.com',                                null],           // ne designe personne
  ['www.instagram.com',                            null],
  ['https://www.tiktok.com/@usain.bolt',           null],           // pas Instagram
  ['facebook.com/usain.bolt',                      null],
];

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE PSEUDO INSTAGRAM, AVEC OU SANS L\'AROBASE                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n── CE QUE LE SERVEUR RETIENT ────────────────────────────────');
for (const [saisie, attendu] of cas) {
  const eu = serveur(saisie);
  ok(`« ${saisie} » → ${attendu === null ? 'refuse' : attendu === '' ? 'delie' : attendu}`,
     eu === attendu, `obtenu ${eu === null ? 'refuse' : `« ${eu} »`}`);
}

console.log('\n── L\'ECRAN DIT LA MEME CHOSE QUE LE SERVEUR ─────────────────');
let ecarts = 0;
for (const [saisie] of cas) if (client(saisie) !== serveur(saisie)) ecarts++;
ok('aucun ecart entre les deux nettoyages', ecarts === 0, `${ecarts} saisie(s) divergente(s)`);

console.log(`\n${echecs ? `✗ ${echecs} echec(s)` : '✓ tout est bon'}\n`);
process.exit(echecs ? 1 : 0);
