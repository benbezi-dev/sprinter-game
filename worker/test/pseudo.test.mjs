// Le filtre des pseudos (src/pseudo.js). node worker/test/pseudo.test.mjs
import assert from 'node:assert/strict';
import { pseudoRecevable, nomAffichable, languesDe, NOM_MASQUE } from '../src/pseudo.js';

const refuse = (n, pays) => assert.equal(pseudoRecevable(n, pays).ok, false, `devrait refuser : ${n} (${pays})`);
const accepte = (n, pays) => assert.equal(pseudoRecevable(n, pays).ok, true, `devrait accepter : ${n} (${pays})`);

// 1. Insultes et termes sexuels, dans la langue du pays + repli.
// Les pseudos de la capture du 24/11/2026.
for (const n of ['Angélique la gobeuse', 'Axel ma pute', 'Elise la pedale', 'Cacacarine',
  'karineetjujuenstring', 'Niquer vos darones']) refuse(n);
for (const n of ['connard', 'Salope', 'fdp', 'Sexy Jules', 'grosse bite', 'fuck', 'bitch', 'nigga'])
  refuse(n);
// Langue du pays.
refuse('La puta', 'ES'); refuse('Hurensohn', 'DE'); refuse('Vaffanculo', 'IT');
refuse('Caralho', 'BR'); refuse('Klootzak', 'NL'); refuse('Kahba', 'MA');
// Repli : sans pays connu, francais + anglais seulement.
assert.deepEqual(languesDe(null), ['fr', 'en']);
assert.deepEqual(languesDe('ES'), ['es', 'fr', 'en']);
assert.deepEqual(languesDe('zz'), ['fr', 'en']);
accepte('La puta', null);             // espagnol : hors des listes sans pays
refuse('fils de pute', 'ES');         // le francais s'applique toujours
refuse('motherfucker', 'DE');         // l'anglais aussi
// Les classements jugent avec toutes les langues.
assert.equal(nomAffichable('La puta'), NOM_MASQUE);
assert.equal(nomAffichable('Usain'), 'Usain');

// 2. Contournements.
for (const n of [
  'CONNARD', 'cÔnnàrd', 'c0nn4rd', '$alope', 'n1qu3r', 'sh!t', 'p.u.t.e', 's_e_x_e', 'p u t e',
  'FUUUUCK', 'puute', 'sall0ppe', 'ElisePedale', 'Ta mère', 'b!tch', 'f*u*c*k', 'Ｃｏｎｎａｒｄ',
  'сonnard', 'con​nard', 'pédàlé', 'P-É-D-A-L-E',
]) refuse(n);

// 3. Aucun faux positif sur des pseudos ordinaires (probleme de Scunthorpe).
for (const n of [
  'azura', 'Angelise', 'Second', 'Conrad', 'Constance', 'Dispute', 'Computer', 'Monique', 'Véronique',
  'Unique', 'Cocktail', 'Hancock', 'Dickens', 'Analyse', 'Assassin', 'Classe', 'Scunthorpe', 'Pornic',
  'Salopette', 'Cacahuète', 'Cacao', 'Shitake', 'Stringer', 'Hamstring', 'Bastien', 'Mathis', 'Titouan',
  'Jules75', 'Sexton', 'Essex', 'Ice Cone', 'Nazim', 'Kosta', 'Pau', 'Air Max', 'Combat ardent', 'Tamara',
  'Matisse', 'Pascal', 'Pique-niquer', 'Usain Bolt', 'Benbezi', 'Sprinter', 'Léa', 'Zoé_06', 'Mehdi93',
  'Inès', 'Noah', 'Chloé', 'Lucas', 'Anonyme', '', 'Kévin du 13', 'Flash', 'Bolt2.0',
]) accepte(n);

console.log('ok pseudo.test');
