// La fusion de deux profils (src/game/profil-fusion.js), sans navigateur.
//   node tools/profil-fusion-test.mjs
import { fusionnerProfils, fusionnerCle } from '../src/game/profil-fusion.js';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const J = JSON.stringify, P = JSON.parse;

// ---------------------------------------------- le telephone neuf
const ancien = {
  sprinter_web_v1: J({ scores: { '100:0': [10.5, 11.2] }, runs: { '100': [70.1] }, furthest: { '100': 4 }, lang: 'fr' }),
  sprinter_history: J([{ r: '100', t: 10.5, m: 'campaign', l: 0, d: 2000 }, { r: '100', t: 11.2, m: 'campaign', l: 0, d: 1000 }]),
  sprinter_legende_v1: J({ plusLoin: 3, accomplies: 0, meilleurs: { plage: 12.3 } }),
  sprinter_carrieres_gagnees_v1: J({ total: 4, par: { '100': 4 }, premiere: 1, derniere: 9, avant: 6 }),
  sprinter_vestiaire: J({ gagnes: ['aurel'], porte: 'aurel' }),
  'halloween2026.v1': J({ v: 1, tenues: 5, dernierJour: 50, sc: 'x' }),
};
// Ce qu'un appareil reinstalle tient avant restauration : la course d'initiation.
const neuf = {
  sprinter_web_v1: J({ scores: { '100:0': [12.9] }, runs: { '100': [] }, furthest: { '100': 0 }, lang: 'en' }),
  sprinter_history: J([{ r: '100', t: 12.9, m: 'campaign', l: 0, d: 3000 }]),
  sprinter_carrieres_gagnees_v1: J({ total: 0, par: {}, premiere: 0, derniere: 0, avant: 0 }),
  'halloween2026.v1': J({ v: 1, tenues: 0, dernierJour: 60, sc: 'y' }),
};
console.log('\n── LE TELEPHONE NEUF RECOIT L\'ANCIEN ──');
const f = fusionnerProfils(neuf, ancien);
const w = P(f.sprinter_web_v1);
ok('les chronos des deux appareils sont gardes', J(w.scores['100:0']) === J([10.5, 11.2, 12.9]), J(w.scores));
ok('le meilleur parcours revient', J(w.runs['100']) === J([70.1]));
ok('l\'etape la plus loin est la plus haute', w.furthest['100'] === 4);
ok('la langue reste celle de cet appareil', w.lang === 'en');
const h = P(f.sprinter_history);
ok('l\'historique reunit les deux, le plus recent d\'abord', h.length === 3 && h[0].d === 3000 && h[2].d === 1000);
ok('la Legende revient', P(f.sprinter_legende_v1).plusLoin === 3);
const c = P(f.sprinter_carrieres_gagnees_v1);
ok('le compte des carrieres est pris entier (4 + 6), jamais additionne', c.total === 4 && c.avant === 6);
ok('le skin gagne revient, et reste porte', J(P(f.sprinter_vestiaire)) === J({ gagnes: ['aurel'], porte: 'aurel' }));
ok('le carnet le plus avance est pris tel quel, sceau compris', f['halloween2026.v1'] === ancien['halloween2026.v1']);

console.log('\n── LA MEME HISTOIRE DES DEUX COTES ──');
const deux = fusionnerProfils(f, f);
ok('fusionner deux fois la meme chose ne double rien', J(deux) === J(f));
const encore = fusionnerProfils(f, ancien);
ok('refusionner l\'ancien ne double aucun chrono', P(encore.sprinter_history).length === 3
  && P(encore.sprinter_web_v1).scores['100:0'].length === 3);

console.log('\n── DEUX TELEPHONES QUI ONT JOUE CHACUN ──');
const a = { sprinter_legende_v1: J({ plusLoin: 2, accomplies: 1, meilleurs: { plage: 12, kyoto: 14 } }),
            sprinter_defis_vedettes_battus: J({ 'aurel:100': true }),
            sprinter_defis_vedettes: J({ aurel: 9.1 }),
            'sprinter.longueur.v1': J({ debloque: 2, plusLoin: 2, pb: { m: 7.1 }, marques: [{ m: 7.1, etape: 1 }] }) };
const b = { sprinter_legende_v1: J({ plusLoin: 4, accomplies: 0, meilleurs: { plage: 11.5 } }),
            sprinter_defis_vedettes_battus: J({ 'meba:200': true }),
            sprinter_defis_vedettes: J({ aurel: 8.9, meba: 9.5 }),
            'sprinter.longueur.v1': J({ debloque: 3, plusLoin: 1, pb: { m: 6.8 }, marques: [{ m: 6.8, etape: 2 }] }) };
const ab = fusionnerProfils(a, b);
const l = P(ab.sprinter_legende_v1);
ok('Legende : le plus loin et le meilleur de chaque lieu', l.plusLoin === 4 && l.accomplies === 1
  && l.meilleurs.plage === 11.5 && l.meilleurs.kyoto === 14);
ok('vedettes battues : l\'union', J(P(ab.sprinter_defis_vedettes_battus)) === J({ 'aurel:100': true, 'meba:200': true }));
ok('vedettes : le meilleur temps', J(P(ab.sprinter_defis_vedettes)) === J({ aurel: 8.9, meba: 9.5 }));
const s = P(ab['sprinter.longueur.v1']);
ok('saut : deblocage max, meilleure marque, marques reunies', s.debloque === 3 && s.plusLoin === 2
  && s.pb.m === 7.1 && s.marques.length === 2 && s.marques[0].m === 7.1);

console.log('\n── CE QUI NE SE LIT PAS ──');
ok('une valeur illisible ici cede a celle du serveur', fusionnerCle('sprinter_legende_v1', '{oups', a.sprinter_legende_v1) === a.sprinter_legende_v1);
ok('une valeur illisible au serveur ne remplace rien', fusionnerCle('sprinter_legende_v1', a.sprinter_legende_v1, '{oups') === a.sprinter_legende_v1);
ok('une piece d\'Halloween vue d\'un cote est vue', fusionnerCle('sprinter_halloween_piece_3_vue', null, '1') === '1');
ok('une cle hors profil n\'est pas copiee', !('sprinter_cle_admin' in fusionnerProfils({}, { sprinter_cle_admin: 'secret' })));

console.log(echecs ? `\n✗ ${echecs} echec(s)\n` : '\n✓ tout passe\n');
process.exit(echecs ? 1 : 0);
