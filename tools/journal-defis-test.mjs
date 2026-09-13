// Le journal des defis, mis a l'epreuve sans navigateur.
//
// Il tient la seule memoire du jeu sur qui nous a cherches : un defi recu et
// jamais releve, une invitation en direct expiree pendant qu'on faisait autre
// chose. Rien de tout cela n'est rattrapable ailleurs — la boite du serveur
// oublie ce qu'on releve, l'invitation en direct meurt en dix minutes. Si ce
// module se trompe, le tort ne se voit pas : il ne manque qu'un nom que
// personne ne savait devoir etre la.
//
// On verifie donc les proprietes qui comptent :
//   - sept jours, pas un de plus, et l'oubli se fait tout seul a la lecture ;
//   - un etat ne recule jamais : un duel gagne ne redevient pas « en attente »
//     parce que le sondage repasse dessus ;
//   - une invitation en direct devient « manquee » toute seule quand son heure
//     est passee, meme si le jeu etait ferme a ce moment-la ;
//   - un defi absent de la boite n'est declare manque qu'apres un delai de
//     grace, et jamais sur une boite qu'on n'a pas pu lire.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* -------------------------------------------------------------- le decor */

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: k => memoire.delete(k),
};

const dossier = mkdtempSync(join(tmpdir(), 'sprinter-journal-'));
const entree = join(dossier, 'entree.ts');
const sortie = join(dossier, 'paquet.mjs');
writeFileSync(entree, `
  export * from '${join(process.cwd(), 'src/game/journal-defis.ts')}';
`);
await build({
  entryPoints: [entree], outfile: sortie, bundle: true,
  format: 'esm', platform: 'neutral', logLevel: 'silent',
});
const M = await import(sortie);

const JOUR = 24 * 60 * 60 * 1000;
const T0 = 1_757_000_000_000;          // une date fixe : rien ne depend de l'heure
const RAZ = () => memoire.clear();

/* ------------------------------------------------------------ sept jours */

titre('SEPT JOURS, PAS UN DE PLUS');

RAZ();
M.noterDefi({ cle: 'defi:A', genre: 'defi', sens: 'recu', etat: 'manque',
              nom: 'Ana', at: T0 }, T0);
M.noterDefi({ cle: 'defi:B', genre: 'defi', sens: 'recu', etat: 'manque',
              nom: 'Bo', at: T0 + 3 * JOUR }, T0 + 3 * JOUR);

ok('les deux lignes sont la au troisieme jour',
   M.lireJournal(T0 + 3 * JOUR).length === 2);

ok('la plus recente vient en tete',
   M.lireJournal(T0 + 3 * JOUR)[0].cle === 'defi:B');

const apres = M.lireJournal(T0 + 7 * JOUR + 1000);
ok('a sept jours et une seconde, la premiere a disparu',
   apres.length === 1 && apres[0].cle === 'defi:B', apres.map(x => x.cle).join(','));

ok("l'oubli est ecrit, pas seulement calcule",
   JSON.parse(memoire.get('sprinter_journal_defis')).length === 1);

ok('la semaine vaut bien sept jours', M.SEMAINE_MS === 7 * JOUR);

RAZ();
M.noterDefi({ cle: 'defi:vieux', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Cy', at: T0 - 30 * JOUR }, T0);
ok('un defi ancien qui nous attend toujours s\'inscrit quand meme',
   M.lireJournal(T0).length === 1);

/* --------------------------------------------------- un etat ne recule pas */

titre('UN ETAT NE RECULE PAS');

RAZ();
M.noterDefi({ cle: 'defi:C', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Dia', at: T0 }, T0);
M.noterDefi({ cle: 'defi:C', genre: 'defi', sens: 'recu', etat: 'gagne',
              nom: 'Dia', lp: 12 }, T0 + 60000);
M.noterDefi({ cle: 'defi:C', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Dia' }, T0 + 120000);

let l = M.lireJournal(T0 + 200000);
ok('le sondage qui repasse ne rouvre pas un duel gagne',
   l.length === 1 && l[0].etat === 'gagne', l[0]?.etat);
ok('les points du duel sont gardes', l[0].lp === 12);

M.noterDefi({ cle: 'defi:C', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Dia Cisse', epreuves: ['200'] }, T0 + 130000);
l = M.lireJournal(T0 + 200000);
ok('un nom appris apres coup complete quand meme la ligne',
   l[0].nom === 'Dia Cisse' && l[0].epreuves.join() === '200',
   `${l[0].nom} / ${l[0].epreuves.join()}`);

RAZ();
M.noterDefi({ cle: 'defi:D', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Eve', at: T0 }, T0);
M.noterDefi({ cle: 'defi:D', genre: 'defi', sens: 'recu', etat: 'releve',
              nom: 'Eve' }, T0 + 6 * JOUR);
ok('relever six jours plus tard ne repart pas pour une semaine',
   M.lireJournal(T0 + 6 * JOUR).length === 1 &&
   M.lireJournal(T0 + 7 * JOUR + 1).length === 0);

/* ------------------------------------------------- l'invitation qui expire */

titre("L'INVITATION QUI EXPIRE TOUTE SEULE");

RAZ();
M.noterDefi({ cle: 'direct:7', genre: 'direct', sens: 'recu', etat: 'attente',
              nom: 'Fara', at: T0, expire: T0 + 600000 }, T0);

ok('avant son heure, elle attend toujours',
   M.lireJournal(T0 + 300000)[0].etat === 'attente');

const perimee = M.lireJournal(T0 + 700000);
ok('passee son heure, elle est manquee sans que personne ne l\'ait touchee',
   perimee[0].etat === 'manque', perimee[0].etat);

ok('le constat est ecrit une fois pour toutes',
   JSON.parse(memoire.get('sprinter_journal_defis'))[0].etat === 'manque');

ok('elle rejoint ceux qu\'on peut redefier',
   M.aRedefier(T0 + 700000).map(x => x.nom).join() === 'Fara');

RAZ();
M.noterDefi({ cle: 'direct:8', genre: 'direct', sens: 'recu', etat: 'attente',
              nom: 'Gil', at: T0, expire: T0 + 600000 }, T0);
M.noterDefi({ cle: 'direct:8', genre: 'direct', sens: 'recu', etat: 'releve',
              nom: 'Gil' }, T0 + 10000);
ok('celle qu\'on a rejointe ne devient pas manquee a son expiration',
   M.lireJournal(T0 + 700000)[0].etat === 'releve');

/* --------------------------------------------------- rapprocher la boite */

titre('RAPPROCHER LA BOITE');

RAZ();
M.noterDefi({ cle: 'defi:E', genre: 'defi', sens: 'recu', etat: 'attente',
              nom: 'Hana', at: T0 }, T0);
M.rapprocherBoite([], T0 + 1000);
ok('un defi releve a l\'instant n\'est pas declare manque',
   M.lireJournal(T0 + 1000)[0].etat === 'attente');

M.rapprocherBoite(['E'], T0 + 10 * 60000);
ok('tant qu\'il figure dans la boite, il attend',
   M.lireJournal(T0 + 10 * 60000)[0].etat === 'attente');

M.rapprocherBoite([], T0 + 20 * 60000);
ok('disparu de la boite et le delai passe : il est manque',
   M.lireJournal(T0 + 20 * 60000)[0].etat === 'manque');

RAZ();
M.noterDefi({ cle: 'defi:F', genre: 'defi', sens: 'lance', etat: 'attente',
              nom: 'Ilo', at: T0 }, T0);
M.rapprocherBoite([], T0 + 20 * 60000);
ok('un defi QU\'ON A LANCE n\'est pas dans notre boite : on n\'y touche pas',
   M.lireJournal(T0 + 20 * 60000)[0].etat === 'attente');

/* ------------------------------------------------------- qui redefier */

titre('QUI REDEFIER');

RAZ();
M.noterDefi({ cle: 'defi:G', genre: 'defi', sens: 'recu', etat: 'attente', nom: 'Jo', at: T0 }, T0);
M.noterDefi({ cle: 'defi:H', genre: 'defi', sens: 'recu', etat: 'manque', nom: 'Kim', at: T0 }, T0);
M.noterDefi({ cle: 'defi:I', genre: 'defi', sens: 'recu', etat: 'perdu', nom: 'Lou', at: T0 }, T0);
M.noterDefi({ cle: 'defi:J', genre: 'defi', sens: 'lance', etat: 'attente', nom: 'Moe', at: T0 }, T0);

const noms = M.aRedefier(T0).map(x => x.nom).sort().join(',');
ok('ceux qui ont tendu la main sans reponse, et eux seuls', noms === 'Jo,Kim', noms);
ok('le compteur du panneau dit la meme chose', M.combienARelever(T0) === 2);

/* ------------------------------------------------------ un journal casse */

titre('UN JOURNAL ILLISIBLE NE CASSE RIEN');

RAZ();
memoire.set('sprinter_journal_defis', '{pas du json');
ok('un stockage abime se lit comme un journal vide', M.lireJournal(T0).length === 0);
M.noterDefi({ cle: 'defi:K', genre: 'defi', sens: 'recu', etat: 'attente', nom: 'Nia', at: T0 }, T0);
ok('et se laisse reecrire', M.lireJournal(T0).length === 1);

memoire.set('sprinter_journal_defis', JSON.stringify([{ cle: '', at: 0 }, null, 3]));
ok('les lignes sans identite ni date sont jetees', M.lireJournal(T0).length === 0);

console.log(e ? `\n${e} echec(s)\n` : '\nTout est vert.\n');
process.exit(e ? 1 : 0);
