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
//
// LES HAIES, ET LA ROUTE QUI LES REND. Depuis qu'elles ont leurs defis, la
// question n'est plus seulement « combien de defis » mais « a quel jeu ». Si
// le worker local repond, le harnais lui demande les defis qu'il vient de
// poser, comme le ferait un jeu d'avant les haies puis comme le fait celui
// d'aujourd'hui, et court un 110 m haies pour voir lequel des deux il valide :
//
//   (cd worker && npx wrangler dev --local --port 8788)
//   BASE=http://127.0.0.1:8788 node tools/objectif-distances-test.mjs

import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { joueursAServir, creerObjectif, CRENEAUX } from '../worker/src/objectif.js';
import { decalageDe } from '../worker/src/journal.js';
import { PAS_S } from '../worker/src/preuve.js';

const B = process.env.BASE || 'http://127.0.0.1:8788';

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
const RECORDS = { '100': 8500, '200': 17200, '400': 35800,
                  '100h': 12800, '110h': 14200, '400h': 41000 };
const PAS = { '100': 20, '200': 40, '400': 80,
              '100h': 30, '110h': 30, '400h': 90 };

function nettoyer() {
  for (const t of ['objectifs', 'races']) {
    base.prepare(`DELETE FROM ${t} WHERE name_key = ?`).run(NOM);
  }
  base.prepare(`DELETE FROM scores WHERE lower(trim(name)) = ?`).run(NOM);
  // Une tentative validee credite le Classement des Objectifs : la ligne est
  // a nous aussi. La table n'existe qu'une fois une tentative passee.
  try { base.prepare(`DELETE FROM objectif_classement WHERE name_key = ?`).run(NOM); }
  catch { /* pas encore de classement */ }
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

/* ------------------------------------------------------------- la route */

/**
 * Une course reguliere, telle que preuve.js l'attend : la distance en
 * decimetres, un point tous les PAS_S, la ligne franchie a l'instant du chrono.
 */
function traceReguliere(metres, ms) {
  const t = ms / 1000;
  const n = Math.ceil(t / PAS_S) + 3;
  return Array.from({ length: n },
    (_, i) => Math.round(metres * 10 * Math.min(1.05, (i * PAS_S) / t)));
}

/**
 * Ce que la route rend des defis qu'on vient de poser, selon le jeu qui les
 * demande — et ce que valide un 110 m haies couru.
 */
async function verifierLaRoute(poses) {
  const joignable = await fetch(B + '/leaderboard?race=100', { signal: AbortSignal.timeout(5000) })
    .then(r => r.ok).catch(() => false);
  if (!joignable) {
    console.log(`   ⚠ ${B} ne repond pas — la route des haies n est PAS VERIFIEE.`);
    return;
  }

  // La fenetre, ouverte de force : celle du midi ne l'est que l'apres-midi, et
  // le harnais doit passer a toute heure.
  const t = Date.now();
  base.prepare(`UPDATE objectifs SET ouvre_le = ?, expire_le = ? WHERE name_key = ?`)
      .run(t - 60000, t + 3600000, NOM);

  const lire = async (q) =>
    (await fetch(`${B}/objectif?nom=${NOM}${q}`, { signal: AbortSignal.timeout(8000) })).json();
  const eps = d => (d.objectifs || []).map(o => o.epreuve).join(',');

  const ancien = await lire('');
  if (!ancien.objectifs || !ancien.objectifs.length) {
    console.log('   ⚠ le worker ne voit pas les defis poses ici : ce n est pas la meme base.');
    console.log('     La route des haies n est PAS VERIFIEE.');
    return;
  }
  // Le jeu d'avant les haies — une application des stores pas encore mise a
  // jour — poserait un 110 m haies sur l'accueil de Sprinter.
  ok('un jeu qui ne dit rien ne recoit que Sprinter', eps(ancien) === '100', eps(ancien));
  ok('...et son epreuve de tete est l une des siennes', ancien.tete === '100',
     String(ancien.tete));

  const deux = await lire('&jeux=sprinter,hurdlers');
  ok('un jeu qui demande les deux les recoit, dans l ordre du programme',
     eps(deux) === '100,110h', eps(deux));
  ok('...avec une epreuve de tete parmi eux', ['100', '110h'].includes(deux.tete),
     String(deux.tete));

  const haies = await lire('&jeux=hurdlers');
  ok('Hurdlers seul ne recoit que ses haies',
     eps(haies) === '110h' && haies.tete === '110h', `${eps(haies)} / ${haies.tete}`);

  // Un 110 m haies couru : il doit viser le defi de haies, et lui seul.
  const ms = RECORDS['110h'] + 400;
  const r = await fetch(B + '/objectif/tentative', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: NOM, device_id: 'tm-distances-' + Math.random().toString(36).slice(2, 8),
      ms, epreuve: '110h', langue: 'fr', trace: traceReguliere(110, ms),
    }),
    signal: AbortSignal.timeout(8000),
  });
  const res = await r.json().catch(() => ({}));
  ok('un 110 m haies passe la preuve et vise le defi de haies',
     r.status === 200 && res.resultat?.epreuve === '110h',
     `statut ${r.status} ${JSON.stringify(res).slice(0, 120)}`);

  const tentatives = Object.fromEntries(base.prepare(
    `SELECT race_key, tentatives FROM objectifs WHERE name_key = ?`).all(NOM)
    .map(l => [l.race_key, l.tentatives]));
  ok('...et lui seul : le 100 m n a rien recu',
     tentatives['110h'] === 1 && tentatives['100'] === 0, JSON.stringify(tentatives));
  ok('...qui le paie au bareme commun', res.resultat?.palier === 'bronze'
     && res.resultat?.points > 0, JSON.stringify(res.resultat || {}).slice(0, 120));
  // Les poses rendues par creerObjectif restent la reference : la route ne
  // doit pas avoir invente une autre cible.
  const pose = poses.find(o => o.race_key === '110h');
  ok('...contre la cible posee, pas une autre',
     !!pose && res.resultat?.cibleMs === pose.cible_ms,
     `${res.resultat?.cibleMs} / ${pose && pose.cible_ms}`);
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

  /* ------------------------------------------------------------ les haies */

  titre('LES HAIES ONT LEURS DEFIS, SUR LA VRAIE BASE');

  nettoyer();
  semer(['100', '110h']);
  const mixte = (await joueursAServir(d1, quand)).find(j => j.nameKey === NOM);
  ok('classe au 100 m et au 110 m haies, il est servi sur les deux',
     !!mixte && mixte.epreuves.map(x => x.epreuve).join(',') === '100,110h',
     mixte ? JSON.stringify(mixte.epreuves.map(x => x.epreuve)) : 'pas servi');

  if (mixte) {
    // Le piege est le meme qu'entre le 100 et le 400 m, en plus visible : une
    // cible de haies taillee dans des 100 m plats serait deja battue de cinq
    // secondes.
    ok('...et le 110 m haies se calibre sur SES courses de haies',
       mixte.epreuves.every(x =>
         x.courses.length === 10
         && x.courses.every(c => c > RECORDS[x.epreuve] && c < RECORDS[x.epreuve] * 1.2)),
       JSON.stringify(mixte.epreuves.map(x => [x.epreuve, x.courses.length])));

    const r = await creerObjectif(d1, mixte, quand);
    const haie = r.objectifs.find(o => o.race_key === '110h');
    ok('deux defis poses, dont un de haies',
       r.objectifs.length === 2 && !!haie,
       r.objectifs.map(o => o.race_key).join(','));
    ok('...la cible de haies est au-dessus de son record de haies',
       !!haie && haie.cible_ms > RECORDS['110h'] && haie.cible_ms < RECORDS['110h'] * 1.2,
       haie ? String(haie.cible_ms) : 'absent');
    ok('...avec son propre plateau',
       new Set(r.objectifs.map(o => o.graine)).size === 2);

    await verifierLaRoute(r.objectifs);
  }
} finally {
  nettoyer();
  base.close();
}

console.log(e ? `\n   ${e} erreur(s)\n` : '\n   TOUT PASSE.\n');
process.exit(e ? 1 : 0);
