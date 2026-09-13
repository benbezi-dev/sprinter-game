// Le calendrier de l'athletisme reel, verifie.
//
// Ce que ce test cherche a prendre en defaut n'est pas du code : c'est une
// LISTE DE DATES, et une liste de dates se degrade en silence. Une entree sans
// source, une date de fin avant sa date de debut, un rang invente, une ligne
// ajoutee au mauvais endroit dans l'ordre du temps — rien de tout cela ne
// plante. Cela produit une page qui a l'air juste et qui ne l'est pas, ce qui
// est exactement le contraire de ce qu'on demande a un calendrier.
//
//   node tools/calendrier-athletisme-test.mjs

import {
  COMPETITIONS, FENETRE, RANGS, TROUS,
  aVenir, compte, epreuves, etat, parDate, periode,
} from '../content/athletisme/calendrier.mjs';
import { rendreHTML, rendreMarkdown } from './calendrier-athletisme.mjs';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const jour = (iso) => Date.parse(`${iso}T00:00:00Z`);

console.log('\n  CHAQUE ENTREE\n');

const cles = new Set();
for (const c of COMPETITIONS) {
  const nom = c.cle || '(sans cle)';
  ok(`${nom} — cle unique`, c.cle && !cles.has(c.cle));
  cles.add(c.cle);
  ok(`${nom} — dates ISO`, ISO.test(c.debut) && ISO.test(c.fin), `${c.debut} → ${c.fin}`);
  ok(`${nom} — la fin ne precede pas le debut`, jour(c.fin) >= jour(c.debut));
  ok(`${nom} — dans la fenetre annoncee`,
    jour(c.debut) >= jour(FENETRE.debut) && jour(c.debut) <= jour(FENETRE.fin),
    `${c.debut} hors de ${FENETRE.debut} → ${FENETRE.fin}`);
  ok(`${nom} — rang connu`, Object.hasOwn(RANGS, c.rang), c.rang);
  ok(`${nom} — statut connu`, c.statut === 'confirme' || c.statut === 'a-confirmer', c.statut);
  // La regle 1 du fichier de donnees : aucune date sans source.
  ok(`${nom} — une source en https`, typeof c.source === 'string' && c.source.startsWith('https://'));
  ok(`${nom} — dit de quoi il s'agit`, typeof c.quoi === 'string' && c.quoi.length > 20);
  ok(`${nom} — lieu et pays`, Boolean(c.lieu && c.pays));
  ok(`${nom} — epreuves de sprint declarees`, Array.isArray(c.sprint));
}

console.log('\n  LA LISTE ENTIERE\n');

const trie = parDate();
ok('deja rangee dans l\'ordre du temps',
  trie.every((c, i) => c.cle === COMPETITIONS[i].cle),
  'la liste source n\'est pas triee : ' + trie.map((c) => c.cle).join(', '));

ok('au moins un rendez-vous de sprint', COMPETITIONS.some((c) => c.sprint.length > 0));
ok('les trous sont declares', TROUS.length > 0 && TROUS.every((t) => t.quoi && t.pourquoi && t.ou));
ok('le releve est une date ISO', ISO.test(FENETRE.releve));

console.log('\n  CE QUI SE CALCULE\n');

// Un instant fixe : le test ne doit pas changer de resultat selon le jour ou
// on le lance. C'est le piege de tout ce qui compte des jours.
const LE_15_SEPTEMBRE_2026 = new Date('2026-09-15T10:00:00Z');

const budapest = COMPETITIONS.find((c) => c.cle === 'wauc-budapest-2026');
ok('un rendez-vous fini est passe', etat(budapest, LE_15_SEPTEMBRE_2026).etat === 'passe');
ok('un rendez-vous en cours se dit en cours',
  etat(budapest, new Date('2026-09-12T23:00:00Z')).etat === 'en-cours');
ok('un rendez-vous a venir compte ses jours',
  etat(budapest, new Date('2026-09-01T00:00:00Z')).jours === 10,
  String(etat(budapest, new Date('2026-09-01T00:00:00Z')).jours));

// Le decalage horaire est le vrai piege : a 23 h a Paris, le 12 septembre, il
// est deja le 13 a Tokyo. Le calcul se fait en jours UTC, pas en heures.
ok('un fuseau ne decale pas un rendez-vous',
  etat(budapest, new Date('2026-09-13T22:30:00Z')).etat === 'en-cours');

ok('les suivants sont dans l\'ordre',
  aVenir(LE_15_SEPTEMBRE_2026).every((c, i, l) => i === 0 || jour(l[i - 1].debut) <= jour(c.debut)));
ok('le premier suivant est le prochain',
  compte(COMPETITIONS, LE_15_SEPTEMBRE_2026).prochaine?.cle === 'mondiaux-route-copenhague-2026');

ok('une journee unique s\'ecrit sans fleche',
  periode({ debut: '2027-05-07', fin: '2027-05-07' }) === '7 mai 2027',
  periode({ debut: '2027-05-07', fin: '2027-05-07' }));
ok('deux jours du meme mois ne repetent pas le mois',
  periode({ debut: '2026-09-11', fin: '2026-09-13' }) === '11 → 13 septembre 2026',
  periode({ debut: '2026-09-11', fin: '2026-09-13' }));
ok('le premier du mois est ordinal',
  periode({ debut: '2026-09-01', fin: '2026-09-01' }) === '1er septembre 2026',
  periode({ debut: '2026-09-01', fin: '2026-09-01' }));
ok('un rendez-vous a cheval sur deux mois nomme les deux',
  periode({ debut: '2027-07-30', fin: '2027-08-01' }) === '30 juillet → 1er août 2027',
  periode({ debut: '2027-07-30', fin: '2027-08-01' }));
ok('un relais s\'ecrit avec son signe',
  epreuves({ sprint: ['100', '4x100'] }) === '100 m · 4 × 100 m',
  epreuves({ sprint: ['100', '4x100'] }));

console.log('\n  LES DEUX SORTIES\n');

const html = rendreHTML();
ok('la page se rend', html.startsWith('<!doctype html>') && html.length > 4000);
ok('la page porte chaque rendez-vous',
  COMPETITIONS.every((c) => html.includes(`data-cle="${c.cle}"`)));
ok('la page ne fige aucun decompte',
  !/dans \d+ jours/.test(html.replace(/'dans ' \+ d \+ ' jours'/, '')),
  'un « dans N jours » ecrit au rendu serait faux des le lendemain');
ok('la page ne va chercher ni police ni script dehors',
  !/(https?:)?\/\/[^"']*\.(js|css|woff2?)/.test(html));
ok('la page affiche ses trous', TROUS.every((t) => html.includes(t.quoi.replace(/'/g, '’'))
  || html.includes(t.quoi)));

const md = rendreMarkdown(LE_15_SEPTEMBRE_2026);
ok('la fiche se rend', md.startsWith('# Le calendrier World Athletics'));
ok('la fiche porte chaque rendez-vous', COMPETITIONS.every((c) => md.includes(c.nom)));
ok('la fiche porte chaque source', COMPETITIONS.every((c) => md.includes(c.source)));
ok('la fiche rappelle que le jeu ne promet rien', md.includes('ne promet rien du jeu'));

console.log(`\n  ${echecs === 0 ? 'Tout passe.' : echecs + ' echec(s).'}\n`);
process.exit(echecs === 0 ? 0 : 1);
