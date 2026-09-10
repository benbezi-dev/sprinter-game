// UN DEFI PAR DISTANCE — verifie sur une vraie base, pas sur une fausse.
//
// `objectif-test.mjs` couvre le calcul et les routes. Il ne couvre pas ce qui
// se passe ENTRE les deux : deux fonctions qui parlent a D1 — `joueursAServir`
// et `creerObjectif` — et dont tout le travail est dans les requetes. Une
// fausse base en JavaScript ne dit rien d'un `ROW_NUMBER` par distance, d'une
// jointure qui melange deux epreuves, ou d'une fenetre de trente courses prise
// du mauvais cote. Ce sont pourtant les trois seuls endroits ou ce changement
// pouvait se tromper en silence : un joueur servi sur une distance qu'il n'a
// jamais courue, ou une cible de 400 m taillee dans des 100 m.
//
// On ouvre donc le fichier SQLite que miniflare ecrit pour la base locale, on
// l'enveloppe dans le peu d'interface D1 que ces fonctions utilisent, et on les
// laisse travailler pour de vrai.
//
//   (cd worker && npx wrangler dev --local)   # une fois, pour creer les tables
//   node tools/objectif-distances-test.mjs
//
// Le harnais SEME ET NETTOIE : il ajoute un joueur a lui, sous un nom marque,
// et le retire a la fin — y compris si une verification echoue. Aucune ligne
// d'un autre essai n'est touchee.

import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { joueursAServir, creerObjectif, CRENEAUX } from '../worker/src/objectif.js';
import { decalageDe } from '../worker/src/journal.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------- la base locale */

const DOSSIER = 'worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

/** Le fichier qui porte le classement — il y en a plusieurs, un par binding. */
function baseLocale() {
  let fichiers = [];
  try { fichiers = readdirSync(DOSSIER).filter(f => f.endsWith('.sqlite')); }
  catch { return null; }
  for (const f of fichiers) {
    try {
      const d = new DatabaseSync(join(DOSSIER, f));
      const tables = d.prepare(
        `SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
      if (tables.includes('scores') && tables.includes('races')
          && tables.includes('objectifs')) return d;
      d.close();
    } catch { /* pas celle-la */ }
  }
  return null;
}

const base = baseLocale();
if (!base) {
  console.log('\n   ⚠ pas de base locale — le SQL du defi n est PAS VERIFIE.');
  console.log('     (cd worker && npx wrangler dev --local), puis relancer.\n');
  process.exit(0);
}

/** Le peu de D1 qu'utilisent les deux fonctions : prepare/bind/all/first/run. */
const d1 = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => base.prepare(sql).run(...args),
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  async batch(liste) { for (const x of liste) await x.run(); return []; },
};

/* ------------------------------------------------------------ le semis */

// Un nom a nous, reconnaissable, et qui ne peut appartenir a personne.
const NOM = 'tm-distances';
const RECORDS = { '100': 8500, '200': 17200, '400': 35800 };
const PAS = { '100': 20, '200': 40, '400': 80 };

function nettoyer() {
  for (const t of ['objectifs', 'races']) {
    base.prepare(`DELETE FROM ${t} WHERE name_key = ?`).run(NOM);
  }
  base.prepare(`DELETE FROM scores WHERE lower(trim(name)) = ?`).run(NOM);
}

function semer(epreuves) {
  const t = Date.now();
  for (const ep of epreuves) {
    const pb = RECORDS[ep];
    base.prepare(
      `INSERT INTO scores (device_id, race_key, name, time_ms, updated_at, best_split_ms)
       VALUES (?, ?, ?, ?, ?, ?)`).run('tm-dev', ep, NOM, pb, t, pb);
    // Dix courses, toutes plus lentes que le record : de quoi calibrer, et de
    // quoi reconnaitre une cible tiree de la mauvaise distance.
    for (let i = 1; i <= 10; i++) {
      base.prepare(
        `INSERT INTO races (device_id, name_key, name, race_key, time_ms, mode,
                            level_idx, created_at)
         VALUES (?, ?, ?, ?, ?, 'oneshot', 4, ?)`
      ).run('tm-dev', NOM, NOM, ep, pb + 100 + i * PAS[ep], t);
    }
  }
}

/** L'instant ou CE joueur est servi : son creneau, decale comme le sien. */
function instantDuMidi() {
  const t = new Date();
  const midi = CRENEAUX.midi.envoi;
  // On construit l'heure de Paris a la main plutot que de chercher un instant
  // qui tombe juste : le harnais doit passer a n'importe quelle heure du jour.
  const p = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(),
                              midi.heure, midi.minute, 30));
  const ecart = new Date(p.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
              - new Date(p.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(p.getTime() - ecart + decalageDe(NOM) * 60000);
}

/* --------------------------------------------------------- les epreuves */

try {
  titre('UN DEFI PAR DISTANCE, SUR LA VRAIE BASE');

  nettoyer();
  semer(['100', '200', '400']);
  const quand = instantDuMidi();

  const dus = await joueursAServir(d1, quand);
  const moi = dus.find(j => j.nameKey === NOM);
  ok('le joueur classe sur trois distances est servi', !!moi,
     `${dus.length} joueurs dus a ${quand.toISOString()}`);

  if (moi) {
    ok('...sur les trois, dans l ordre du programme',
       moi.epreuves.map(x => x.epreuve).join(',') === '100,200,400',
       JSON.stringify(moi.epreuves.map(x => x.epreuve)));
    ok('...chacune avec SON record',
       moi.epreuves.every(x => x.pb === RECORDS[x.epreuve]),
       JSON.stringify(moi.epreuves.map(x => x.pb)));
    // Le piege du changement : une fenetre de courses prise sans la distance
    // aurait melange les trente derniers chronos des trois epreuves, et taille
    // la cible du 400 m dans des 100 m.
    ok('...et SES courses de CETTE distance, jamais celles d une autre',
       moi.epreuves.every(x =>
         x.courses.length === 10
         && x.courses.every(c => c > RECORDS[x.epreuve] && c < RECORDS[x.epreuve] * 1.2)),
       JSON.stringify(moi.epreuves.map(x => x.courses.length)));

    const r = await creerObjectif(d1, moi, quand);
    ok('trois defis sont poses', r.objectifs.length === 3 && r.nouveaux.length === 3,
       `${r.objectifs.length} poses, ${r.nouveaux.length} neufs`);
    ok('...un par distance, sans doublon',
       new Set(r.objectifs.map(o => o.race_key)).size === 3);
    ok('...chacun vise plus lent que le record, et plus vite que ses courses',
       r.objectifs.every(o => o.cible_ms > o.pb_ms
                           && o.cible_ms < RECORDS[o.race_key] * 1.2),
       r.objectifs.map(o => `${o.race_key}:${o.cible_ms}`).join(' '));
    ok('...avec son propre plateau : trois graines differentes',
       new Set(r.objectifs.map(o => o.graine)).size === 3,
       'sinon le 200 m se courrait sur le plateau du 100 m');
    ok('...dans une seule fenetre : c est un creneau, pas trois',
       new Set(r.objectifs.map(o => o.expire_le)).size === 1);

    const encore = await creerObjectif(d1, moi, quand);
    ok('un cron rejoue retrouve les trois sans en creer un seul',
       encore.objectifs.length === 3 && encore.nouveaux.length === 0);
  }

  // Et celui qui ne court qu'une distance n'en recoit qu'une : on ne taille
  // pas une cible sur un record qui n'existe pas.
  nettoyer();
  semer(['100']);
  const seul = (await joueursAServir(d1, quand)).find(j => j.nameKey === NOM);
  ok('un joueur classe sur une seule distance n a qu un defi',
     !!seul && seul.epreuves.length === 1 && seul.epreuves[0].epreuve === '100',
     seul ? JSON.stringify(seul.epreuves.map(x => x.epreuve)) : 'pas servi');
} finally {
  nettoyer();
  base.close();
}

console.log(e ? `\n   ${e} erreur(s)\n` : '\n   TOUT PASSE.\n');
process.exit(e ? 1 : 0);
