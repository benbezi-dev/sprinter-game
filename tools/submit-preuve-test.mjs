// La preuve du record : ce que /submit fait de la trace qu'on lui envoie.
//
// POURQUOI CE HARNAIS. Le 29 septembre 2026, les 456 lignes de `scores` etaient
// toutes sans trace — le jeu ne l'envoyait pas — et le record du monde du 100 m
// (8,158 s) ne pouvait donc etre ni confirme ni mis en doute. Depuis, le jeu
// envoie la trace de la course qui a donne le chrono, et /submit la juge avec
// les regles de preuve.js. Ce harnais verifie les deux moities du contrat :
//
//   - une course honnete passe SANS signalement (un faux positif reprocherait
//     un record a celui qui vient de le battre) ;
//   - une trace qui ne soutient pas son chrono est NOTEE, et le chrono reste
//     au classement : on signale, on ne refuse jamais.
//
//   (cd worker && npx wrangler dev --local --port 8798)
//   node tools/submit-preuve-test.mjs
//
//   BASE=... ADMIN=... node tools/submit-preuve-test.mjs   # contre un autre worker
//
// La cle d'administration (lecture de /objectif/suspectes) vient de
// worker/.dev.vars quand ADMIN n'est pas pose.

import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8798';
const ADMIN = process.env.ADMIN || (() => {
  try {
    const m = fs.readFileSync(new URL('../worker/.dev.vars', import.meta.url), 'utf8')
      .match(/^ADMIN_CLE\s*=\s*"?([^"\n]+)"?/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const attendre = ms => new Promise(r => setTimeout(r, ms));

const appareil = () => Array.from({ length: 32 },
  () => Math.floor(Math.random() * 16).toString(16)).join('');
// Un nom neuf par lancement : la base locale garde tout d'un essai a l'autre.
const LOT = Math.random().toString(36).slice(2, 7);
const nom = n => `Pv${LOT}${n}`;

async function poste(route, corps) {
  const r = await fetch(BASE + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  return { statut: r.status, corps: await r.json().catch(() => ({})) };
}

/** Ce que le serveur a note pour ce nom, apres que ses `waitUntil` ont fini. */
async function suspectes(n) {
  await attendre(400);
  const r = await fetch(`${BASE}/objectif/suspectes?n=500`, { headers: { 'X-Sprinter-Admin': ADMIN } });
  const d = await r.json().catch(() => ({}));
  return (d.suspectes || []).filter(s => s.name_key === n.toLowerCase());
}

/**
 * Une trace comme le jeu la range : la distance en decimetres tous les 80 ms,
 * une montee en vitesse puis une allure tenue (la loi de `setPace`), et une
 * seconde de course apres la ligne, comme le coureur qui s'arrete.
 */
function traceDe(ms, metres = 100) {
  const T = ms / 1000, tau = 0.8;
  const vmax = metres / (T - tau * (1 - Math.exp(-T / tau)));
  const out = [];
  for (let t = 0; t <= T + 1; t += 0.08) {
    const d = t <= T ? vmax * (t - tau * (1 - Math.exp(-t / tau)))
                     : metres + vmax * (t - T) * 0.8;
    out.push(Math.round(d * 10));
  }
  return out;
}

const score = (n, dev, ms, trace, race = '100') => poste('/submit', {
  device_id: dev, race_key: race, name: n, time_ms: 1200000, best_split_ms: ms,
  ...(trace ? { trace } : {}),
});

if (!ADMIN) { console.log('ADMIN_CLE introuvable : poser ADMIN=...'); process.exit(1); }

titre('une course honnete ne laisse rien');
{
  const n = nom('a'), dev = appareil();
  const r = await score(n, dev, 9200, traceDe(9200));
  ok('le score est enregistre', r.statut === 200 && r.corps.best_split_ms === 9200, JSON.stringify(r));
  const s = await suspectes(n);
  ok('aucun signalement', s.length === 0, JSON.stringify(s));
  const top = await (await fetch(`${BASE}/leaderboard?race=100`)).json();
  const ligne = (top.entries || top || []).find?.(x => x.name === n);
  ok('la trace est gardee pour le fantome du tableau', !!(ligne && ligne.has_ghost), JSON.stringify(ligne));
}

titre('une trace qui ne soutient pas le chrono est notee');
{
  const n = nom('b'), dev = appareil();
  // La trace franchit la ligne a 9,20 s ; le chrono annonce 8,00 s.
  const r = await score(n, dev, 8000, traceDe(9200));
  ok('le chrono reste au classement', r.statut === 200 && r.corps.best_split_ms === 8000, JSON.stringify(r));
  const s = await suspectes(n);
  ok('signale « trace »', s.length === 1 && s[0].quoi === 'trace', JSON.stringify(s));
  ok('le grief dit ou la ligne est franchie', !!s[0]?.detail?.includes('la ligne est franchie'), s[0]?.detail);
}

titre('une trace qui recule est notee');
{
  const n = nom('c'), dev = appareil();
  const t = traceDe(9500); t[40] = t[39] - 30;
  await score(n, dev, 9500, t);
  const s = await suspectes(n);
  ok('signale « recule »', s.length === 1 && /recule/.test(s[0].detail || ''), JSON.stringify(s));
}

titre('un chrono sans trace au sommet du classement est note');
{
  // Sous le meilleur de la base, qui garde les essais precedents : c'est ce
  // qui le met en tete a chaque lancement, et pas seulement sur une base neuve.
  const top = await (await fetch(`${BASE}/leaderboard?race=100`)).json();
  const meilleur = Math.min(7000, ...(top.entries || []).map(x => x.best_split_ms));
  const n = nom('d'), dev = appareil();
  const r = await score(n, dev, Math.max(1000, meilleur - 10), null);
  ok('le chrono reste au classement', r.statut === 200 && r.corps.rank <= 10, JSON.stringify(r.corps.rank));
  const s = await suspectes(n);
  ok('signale « trace absente »', s.length === 1 && s[0].detail === 'trace absente', JSON.stringify(s));
}

titre('un chrono sans trace loin du sommet ne l\'est pas');
{
  // Dix chronos plus rapides, prouves, pour qu'il y ait un sommet a quitter.
  for (let i = 0; i < 10; i++) {
    await score(nom('t' + i), appareil(), 6000 + i * 10, traceDe(6000 + i * 10));
  }
  const n = nom('e'), dev = appareil();
  const r = await score(n, dev, 14000, null);
  ok('rang au-dela de 10', r.statut === 200 && r.corps.rank > 10, String(r.corps.rank));
  const s = await suspectes(n);
  ok('aucun signalement (une ancienne version du jeu n\'envoie pas de trace)', s.length === 0, JSON.stringify(s));
}

titre('un chrono moins bon que celui de l\'appareil n\'est pas juge');
{
  const n = nom('f'), dev = appareil();
  await score(n, dev, 9000, traceDe(9000));
  await score(n, dev, 9900, traceDe(8000));       // trace fausse, chrono moins bon
  const s = await suspectes(n);
  ok('aucun signalement', s.length === 0, JSON.stringify(s));
}

titre('un bond d\'un coup est note, sans rien refuser');
{
  const n = nom('g'), dev = appareil();
  for (let i = 0; i < 5; i++) {
    await poste('/race', { device_id: dev, name: n, race_key: '100', time_ms: 10200 + i * 50,
                           mode: 'campaign', level_idx: 0 });
  }
  await score(n, dev, 10000, traceDe(10000));
  const r = await score(n, dev, 8000, traceDe(8000));   // 20 % d'un coup, trace honnete
  ok('le chrono reste au classement', r.statut === 200 && r.corps.best_split_ms === 8000, JSON.stringify(r.corps.best_split_ms));
  const s = await suspectes(n);
  ok('signale « bond », et rien d\'autre', s.length === 1 && s[0].quoi === 'bond', JSON.stringify(s));
  ok('le record d\'avant est note', s[0]?.pb_ms === 10000, JSON.stringify(s[0]));
}

titre('le bond se mesure au joueur, pas a l\'appareil');
{
  const n = nom('h');
  for (let i = 0; i < 5; i++) {
    await poste('/race', { device_id: appareil(), name: n, race_key: '100', time_ms: 10200,
                           mode: 'campaign', level_idx: 0 });
  }
  await score(n, appareil(), 10000, traceDe(10000));
  // Un appareil neuf, sans chrono a lui : c'est le 10,00 du joueur qui compte.
  await score(n, appareil(), 8000, traceDe(8000));
  const s = await suspectes(n);
  ok('signale « bond » depuis un appareil neuf', s.length === 1 && s[0].quoi === 'bond', JSON.stringify(s));
}

console.log(e ? `\n${e} ECHEC(S)` : '\nTOUT PASSE');
process.exit(e ? 1 : 0);
