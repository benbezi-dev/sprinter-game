// Le tunnel des premiers pas (worker/src/tunnel.js) et la fiche d'appareil, sur
// une base SQLite en memoire : la route POST /etape de bout en bout, la table
// `tunnel_appareil`, la repartition par navigateur de `lireTunnel`, et la
// classification cote jeu (src/game/navigateur.ts, lue telle quelle par node).
//
//   node tools/tunnel-test.mjs
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/src/index.js';
import {
  ETAPES_TUNNEL, NAVIGATEURS as NAV_SERVEUR, noterEtape, noterAppareil, lireTunnel,
} from '../worker/src/tunnel.js';
import { classerNavigateur, NAVIGATEURS as NAV_JEU, UA_INTEGRE } from '../src/game/navigateur.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || d === undefined ? '' : ' — ' + JSON.stringify(d)}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => { const r = base.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  async batch(liste) { for (const x of liste) await x.run(); return []; },
};
// Ce que lireTunnel lit hors de ses propres tables.
base.exec(`CREATE TABLE visits (device_id TEXT, day TEXT)`);
base.exec(`CREATE TABLE races (device_id TEXT, created_at INTEGER)`);

const ctx = { waitUntil() {}, passThroughOnException() {} };
const post = (corps) => worker.fetch(new Request('https://x.test/etape', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: typeof corps === 'string' ? corps : JSON.stringify(corps),
}), { DB: db }, ctx);
const fiche = id => base.prepare(`SELECT * FROM tunnel_appareil WHERE device_id = ?`).get(id);
const etapes = id => base.prepare(`SELECT etape FROM tunnel WHERE device_id = ? ORDER BY etape`).all(id).map(r => r.etape);

titre('l\'ordre du chemin');
ok('« ecran » est juste apres « ouverture »',
  ETAPES_TUNNEL[0] === 'ouverture' && ETAPES_TUNNEL[1] === 'ecran' && ETAPES_TUNNEL[2] === 'accueil', ETAPES_TUNNEL);

titre('POST /etape : l\'etape et la fiche');
let r = await post({ device_id: 'appareil-ig-0001', etape: 'ouverture', navigateur: 'instagram' });
ok('ouverture + navigateur : 200', r.status === 200);
ok('la table tunnel_appareil a ete creee et porte la fiche',
  fiche('appareil-ig-0001')?.navigateur === 'instagram' && fiche('appareil-ig-0001')?.chargement_ms === null, fiche('appareil-ig-0001'));
ok('la ligne porte une date', fiche('appareil-ig-0001')?.at > 0);

r = await post({ device_id: 'appareil-ig-0001', etape: 'ecran' });
ok('ecran sans fiche : accepte', r.status === 200 && etapes('appareil-ig-0001').includes('ecran'));

r = await post({ device_id: 'appareil-ig-0001', etape: 'accueil', chargement_ms: 3456 });
ok('accueil + chargement_ms : pose', r.status === 200 && fiche('appareil-ig-0001').chargement_ms === 3456, fiche('appareil-ig-0001'));
r = await post({ device_id: 'appareil-ig-0001', etape: 'accueil', chargement_ms: 99 });
ok('chargement_ms deja pose : jamais ecrase', fiche('appareil-ig-0001').chargement_ms === 3456);
r = await post({ device_id: 'appareil-ig-0001', etape: 'ouverture', navigateur: 'chrome' });
ok('navigateur deja pose : jamais ecrase', fiche('appareil-ig-0001').navigateur === 'instagram');

titre('POST /etape : valeurs refusees, etape notee quand meme');
const cas = [
  ['navigateur hors liste', { navigateur: 'netscape' }, 'navigateur'],
  ['navigateur = agent brut', { navigateur: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }, 'navigateur'],
  ['navigateur non texte', { navigateur: 42 }, 'navigateur'],
  ['navigateur vide', { navigateur: '' }, 'navigateur'],
  ['chargement negatif', { chargement_ms: -1 }, 'chargement'],
  ['chargement > 120000', { chargement_ms: 120001 }, 'chargement'],
  ['chargement decimal', { chargement_ms: 12.5 }, 'chargement'],
  ['chargement en texte', { chargement_ms: '3000' }, 'chargement'],
  ['chargement NaN (null en JSON)', { chargement_ms: null }, 'chargement'],
];
let k = 0;
for (const [nom, extra, quoi] of cas) {
  const id = `appareil-refus-${String(++k).padStart(3, '0')}`;
  r = await post({ device_id: id, etape: 'ouverture', ...extra });
  ok(`${nom} : etape notee, rien dans la fiche`,
    r.status === 200 && etapes(id).includes('ouverture') && !fiche(id), fiche(id));
}
// Un champ valide a cote d'un champ refuse : le valide passe.
r = await post({ device_id: 'appareil-mixte-01', etape: 'accueil', navigateur: 'safari-ios', chargement_ms: 999999 });
ok('navigateur valide + chargement refuse : seul le navigateur reste',
  fiche('appareil-mixte-01')?.navigateur === 'safari-ios' && fiche('appareil-mixte-01')?.chargement_ms === null, fiche('appareil-mixte-01'));
r = await post({ device_id: 'appareil-mixte-01', etape: 'accueil', chargement_ms: 0 });
ok('la moitie manquante se complete ensuite (0 ms est valide)', fiche('appareil-mixte-01')?.chargement_ms === 0);
r = await post({ device_id: 'appareil-chargement-seul', etape: 'accueil', chargement_ms: 1500 });
ok('chargement sans navigateur : ligne creee', fiche('appareil-chargement-seul')?.navigateur === null && fiche('appareil-chargement-seul')?.chargement_ms === 1500);
r = await post({ device_id: 'appareil-chargement-seul', etape: 'ecran', navigateur: 'firefox' });
ok('le navigateur arrive apres : complete la ligne', fiche('appareil-chargement-seul')?.navigateur === 'firefox' && fiche('appareil-chargement-seul')?.chargement_ms === 1500);

titre('POST /etape : le contrat d\'avant ne bouge pas');
r = await post({ device_id: 'appareil-sec-0001', etape: 'ouverture' });
ok('sans aucun champ nouveau : 200, pas de fiche', r.status === 200 && !fiche('appareil-sec-0001'));
r = await post({ device_id: 'court', etape: 'ouverture' });
ok('device_id invalide : 400', r.status === 400);
r = await post({ device_id: 'appareil-sec-0001', etape: 'nimporte', navigateur: 'chrome' });
ok('etape inconnue : 400, et pas de fiche', r.status === 400 && !fiche('appareil-sec-0001'));
r = await post('pas du json');
ok('JSON invalide : 400', r.status === 400);

titre('lireTunnel : repartition par navigateur');
// Une cohorte construite a la main, un jour fixe. Chaque appareil : sa classe,
// son temps de chargement, les etapes franchies.
base.exec(`DELETE FROM tunnel; DELETE FROM tunnel_appareil; DELETE FROM visits; DELETE FROM races`);
const T = Date.UTC(2026, 9, 10, 12);
const NOW = Date.UTC(2026, 9, 14, 12);
async function appareil(id, nav, ms, franchies) {
  for (const et of franchies) await noterEtape(db, id, et, T + 1000);
  if (nav || ms !== null) await noterAppareil(db, id, { navigateur: nav, chargement_ms: ms ?? undefined }, T);
}
const OA = ['ouverture'], OE = ['ouverture', 'ecran'], OEA = [...OE, 'accueil'], OEAD = [...OEA, 'depart'];
await appareil('c-ig-1', 'instagram', null, OA);
await appareil('c-ig-2', 'instagram', null, OA);
await appareil('c-ig-3', 'instagram', 4000, OEA);
await appareil('c-sa-1', 'safari-ios', 1000, OEAD);
await appareil('c-sa-2', 'safari-ios', 2000, [...OEAD, 'arrivee']);
await appareil('c-sa-3', 'safari-ios', 3000, OEA);
await appareil('c-sa-4', 'safari-ios', 5000, OE);
await appareil('c-ro-1', 'robot', null, OA);
await appareil('c-vieux-1', null, null, OEA);                   // ancien client : aucune fiche
await appareil('c-vieux-2', null, null, OA);
// Hors cohorte : deja vu par `visits` AVANT son jour d'ouverture.
base.exec(`INSERT INTO visits VALUES ('c-ancien', '2026-09-01')`);
await appareil('c-ancien', 'chrome', 100, OEAD);
// Hors fenetre : ouvert il y a 60 jours.
await noterEtape(db, 'c-trop-vieux', 'ouverture', NOW - 60 * 86400000);
await noterAppareil(db, 'c-trop-vieux', { navigateur: 'firefox' }, NOW - 60 * 86400000);

const t = await lireTunnel(db, 30, NOW);
const nav = n => t.par_navigateur.find(x => x.navigateur === n);
ok('cohorte : 10 appareils neufs (ni l\'ancien ni le trop vieux)', t.cohorte === 10, t.cohorte);
ok('le format existant est intact',
  Array.isArray(t.etapes) && Array.isArray(t.a_cote) && t.rejoue && 'jours' in t && 'depuis' in t && 'mesure_depuis' in t
  && t.etapes[1].etape === 'ecran' && t.etapes[1].n === 6, t.etapes.map(x => [x.etape, x.n]));
ok('instagram : 3 ouvertures, 1 ecran, 1 accueil, 0 depart',
  JSON.stringify(nav('instagram')) === JSON.stringify({ navigateur: 'instagram', n: 3, ecran: 1, accueil: 1, depart: 0, arrivee: 0 }), nav('instagram'));
ok('safari-ios : 4, 4 ecrans, 3 accueils, 2 departs, 1 arrivee',
  JSON.stringify(nav('safari-ios')) === JSON.stringify({ navigateur: 'safari-ios', n: 4, ecran: 4, accueil: 3, depart: 2, arrivee: 1 }), nav('safari-ios'));
ok('robot : 1 ouverture, rien d\'autre', nav('robot')?.n === 1 && nav('robot')?.ecran === 0);
ok('l\'appareil ancien et le trop vieux ne sont dans aucune classe', !nav('chrome') && !nav('firefox'));
ok('trie du plus nombreux au moins nombreux', t.par_navigateur.map(x => x.navigateur).join() === 'safari-ios,instagram,robot', t.par_navigateur.map(x => x.navigateur));
ok('anciens clients : 2 sans fiche', t.sans_fiche === 2, t.sans_fiche);
// Chargements : 4000, 1000, 2000, 3000, 5000 -> mediane 3000, p90 = rang 5 = 5000.
ok('chargement : n = 5, mediane 3000 ms, 90e centile 5000 ms',
  t.chargement.n === 5 && t.chargement.mediane_ms === 3000 && t.chargement.p90_ms === 5000, t.chargement);

// Dix valeurs : le 90e centile au rang le plus proche est la 9e.
for (let i = 1; i <= 5; i++) await appareil(`c-dix-${i}`, 'chrome-android', i * 10000, OEA);
const t2 = await lireTunnel(db, 30, NOW);
ok('10 mesures : p90 = 9e valeur (40000), mediane = moyenne des 5e et 6e (7500)',
  t2.chargement.n === 10 && t2.chargement.p90_ms === 40000 && t2.chargement.mediane_ms === 7500, t2.chargement);

titre('lireTunnel : perdus pendant le telechargement');
base.exec(`DELETE FROM tunnel; DELETE FROM tunnel_appareil; DELETE FROM visits`);
await noterEtape(db, 'p-joue', 'page', T); await noterEtape(db, 'p-joue', 'ouverture', T + 3000);
await noterEtape(db, 'p-parti-1', 'page', T);
await noterEtape(db, 'p-parti-2', 'page', T);
await noterEtape(db, 'p-en-cours', 'page', NOW - 60 * 1000);    // il y a une minute : pas encore un abandon
base.exec(`INSERT INTO visits VALUES ('p-ancien', '2026-09-01')`);
await noterEtape(db, 'p-ancien', 'page', T);                     // deja vu avant : hors cohorte
const tp = await lireTunnel(db, 30, NOW);
ok('telechargement : 3 pages neuves, 2 perdus', tp.telechargement.pages === 3 && tp.telechargement.perdus === 2, tp.telechargement);
ok('« page » ne change pas la cohorte (ancree sur l\'ouverture)', tp.cohorte === 1, tp.cohorte);

titre('lireTunnel : base sans aucune fiche');
base.exec(`DELETE FROM tunnel; DELETE FROM tunnel_appareil`);
await noterEtape(db, 'seul-sans-fiche', 'ouverture', T);
const t3 = await lireTunnel(db, 30, NOW);
ok('rien de nouveau a afficher : listes vides, mediane nulle, 1 sans fiche',
  t3.par_navigateur.length === 0 && t3.chargement.n === 0 && t3.chargement.mediane_ms === null && t3.chargement.p90_ms === null && t3.sans_fiche === 1, t3);

titre('la classification cote jeu');
const UA = {
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.1.20.103',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.0 Android',
  tiktok: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 [FBAN/FBIOS;FBAV/460.0.0]',
  snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 Snapchat/12.0',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 Safari Line/14.0',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  ipadBureau: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  chromeBureau: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  apercu: 'WhatsApp/2.24.10.80 A',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36',
  cubot: 'Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
  vide: '',
};
const c = (ua, plus = {}) => classerNavigateur({ ua, ...plus });
for (const [nom, ua, attendu, plus] of [
  ['instagram iOS', UA.instagramIos, 'instagram'],
  ['instagram Android (avant Chrome)', UA.instagramAndroid, 'instagram'],
  ['tiktok', UA.tiktok, 'tiktok'],
  ['facebook', UA.facebook, 'facebook'],
  ['snapchat', UA.snapchat, 'snapchat'],
  ['line = autre navigateur integre', UA.line, 'autre-integre'],
  ['safari iPhone', UA.safariIos, 'safari-ios'],
  ['chrome iPhone = chrome', UA.chromeIos, 'chrome'],
  ['iPad en mode bureau (tactile)', UA.ipadBureau, 'safari-ios', { tactile: 5 }],
  ['Safari d\'un Mac (non tactile)', UA.safariMac, 'autre'],
  ['chrome Android', UA.chromeAndroid, 'chrome-android'],
  ['samsung', UA.samsung, 'samsung'],
  ['chrome bureau', UA.chromeBureau, 'chrome'],
  ['edge', UA.edge, 'edge'],
  ['firefox', UA.firefox, 'firefox'],
  ['opera', UA.opera, 'autre'],
  ['Googlebot', UA.googlebot, 'robot'],
  ['apercu WhatsApp', UA.apercu, 'robot'],
  ['Chrome sans tete', UA.headless, 'robot'],
  ['navigator.webdriver prime sur tout', UA.chromeBureau, 'robot', { webdriver: true }],
  ['Capacitor (appli) prime sur le navigateur', UA.safariIos, 'appli', { appli: true }],
  ['un robot dans l\'appli reste un robot', UA.safariIos, 'robot', { appli: true, webdriver: true }],
  ['telephone CUBOT : pas un robot', UA.cubot, 'chrome-android'],
  ['agent vide', UA.vide, 'autre'],
]) ok(`${nom} -> ${attendu}`, c(ua, plus) === attendu, c(ua, plus));
ok('chaque classe rendue figure dans la liste du serveur',
  Object.values(UA).every(ua => NAV_SERVEUR.includes(c(ua))));
ok('les listes du jeu et du serveur sont identiques', JSON.stringify([...NAV_JEU]) === JSON.stringify(NAV_SERVEUR), [NAV_JEU, NAV_SERVEUR]);
ok('le bandeau « Ouvrir dans le navigateur » : meme regle qu\'avant le 14/10',
  [UA.instagramIos, UA.instagramAndroid, UA.tiktok, UA.facebook, UA.snapchat, UA.line].every(u => UA_INTEGRE.test(u))
  && ![UA.safariIos, UA.chromeAndroid, UA.chromeBureau, UA.firefox, UA.googlebot].some(u => UA_INTEGRE.test(u)));

console.log(e ? `\n${e} ECHEC(S)` : '\ntout est vert');
process.exit(e ? 1 : 0);
