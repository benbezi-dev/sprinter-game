// La lumiere de l'heure (src/game/heure-du-jour.js), sans navigateur.
//
// Ce qui doit tenir : le moment suit le soleil de Paris selon la saison, il
// ne change pas pendant une course, un stade qui a deja son heure n'y touche
// pas, et la nuit allume ce que les stades de nuit allument.
//
//   TZ=Europe/Paris node tools/heure-du-jour-test.mjs
//
// Le fuseau est impose par le script lui-meme s'il manque : les heures
// attendues sont celles de Paris.

if (process.env.TZ !== 'Europe/Paris') {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname],
                      { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Paris' } });
  process.exit(r.status ?? 1);
}

await import('../src/game/heure-du-jour.js');
const H = globalThis.SprinterHeure;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);
const a = (an, mois, j, h, mn = 0) => new Date(an, mois - 1, j, h, mn);
const hm = h => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA LUMIERE DE L\'HEURE                                       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('le soleil de Paris');
// Les heures publiees pour Paris (lever / coucher), a cinq minutes pres.
for (const [d, lever, coucher] of [
  [a(2026, 10, 1, 12), 7 + 55 / 60, 19 + 28 / 60],
  [a(2026, 12, 21, 12), 8 + 42 / 60, 16 + 56 / 60],
  [a(2026, 6, 21, 12), 5 + 47 / 60, 21 + 58 / 60],
]) {
  const s = H.soleil(d);
  ok(`${d.toLocaleDateString('fr-FR')} : lever ${hm(s.lever)}, coucher ${hm(s.coucher)}`,
     Math.abs(s.lever - lever) < 5 / 60 && Math.abs(s.coucher - coucher) < 5 / 60,
     `attendu ${hm(lever)} / ${hm(coucher)}`);
}

titre('le moment suit la saison');
for (const [d, m] of [
  [a(2026, 10, 1, 10), 'jour'], [a(2026, 10, 1, 17), 'apres-midi'],
  [a(2026, 10, 1, 19), 'soir'], [a(2026, 10, 1, 22), 'nuit'], [a(2026, 10, 1, 3), 'nuit'],
  // A dix-huit heures et demie : le soir en octobre, la nuit en decembre,
  // encore l'apres-midi en juin.
  [a(2026, 10, 1, 18, 30), 'soir'], [a(2026, 12, 21, 18, 30), 'nuit'], [a(2026, 6, 21, 18, 30), 'apres-midi'],
  [a(2026, 6, 21, 21, 30), 'soir'], [a(2026, 12, 21, 8), 'nuit'],
]) {
  ok(`${d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} → ${m}`, H.momentDe(d) === m, H.momentDe(d));
}

titre('le moment ne change pas pendant une course');
{
  const vrai = Date.now;
  try {
    let t = a(2026, 10, 1, 19, 0).getTime();
    Date.now = () => t;
    const G = { state: 'title' };
    ok('a l\'accueil, 19 h : le soir', H.moment(G) === 'soir');
    G.state = 'race';
    t = a(2026, 10, 1, 21, 30).getTime();
    ok('en course a 21 h 30 : toujours le soir', H.moment(G) === 'soir', H.moment(G));
    G.state = 'title';
    ok('revenu a l\'accueil : la nuit', H.moment(G) === 'nuit', H.moment(G));
  } finally { Date.now = vrai; }
}

titre('le theme a l\'heure');
const jour = {
  heure: true, skyTop: [68, 81, 167], skyBot: [82, 95, 181], stars: 0, clouds: true,
  grass: [29, 115, 17], trackA: [170, 12, 12], tread: [175, 177, 187],
  panels: [[214, 74, 62], [44, 108, 186]], feuillage: [44, 104, 38],
};
const danube = { skyTop: [30, 20, 52], skyBot: [84, 56, 112], projecteurs: true, grass: [22, 21, 26] };
const G = { state: 'title' };

H.forcer('jour');
ok('le jour rend le theme tel quel', H.eclairer(jour, G) === jour);

H.forcer('nuit');
const nuit = H.eclairer(jour, G);
ok('la nuit derive un autre objet', nuit !== jour && nuit.base === jour && nuit.moment === 'nuit');
ok('le meme objet d\'une image a l\'autre (les caches de tuiles s\'y rangent)', H.eclairer(jour, G) === nuit);
ok('un theme deja derive n\'est pas derive deux fois', H.eclairer(nuit, G) === nuit);
ok('projecteurs, ecrans LED et etoiles allumes', nuit.projecteurs && nuit.pubsLed && nuit.stars > 0);
ok('ni nuages ni avion', nuit.clouds === false && nuit.avion === false);
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
ok('sous les rampes, la piste garde sa lumiere du jour', lum(nuit.trackA) / lum(jour.trackA) > 0.95,
   (lum(nuit.trackA) / lum(jour.trackA)).toFixed(2));
ok('la pelouse est eclairee, moins que la piste',
   lum(nuit.grass) / lum(jour.grass) > 0.6 && lum(nuit.grass) / lum(jour.grass) < lum(nuit.trackA) / lum(jour.trackA),
   (lum(nuit.grass) / lum(jour.grass)).toFixed(2));
ok('les gradins plus sombres que la pelouse',
   lum(nuit.tread) / lum(jour.tread) < lum(nuit.grass) / lum(jour.grass));
ok('le theme d\'origine n\'a pas bouge', jour.grass[1] === 115 && jour.stars === 0 && !jour.projecteurs);
ok('un stade qui a deja son heure n\'y touche pas', H.eclairer(danube, G) === danube);

H.forcer('soir');
const soir = H.eclairer(jour, G);
ok('le soir porte l\'etalonnage du couchant', soir.ambiance === 'couchant' && soir.base === jour);
ok('le bas du ciel s\'embrase', soir.skyBot[0] > jour.skyBot[0] + 80 && soir.skyBot[2] < jour.skyBot[2]);
ok('la nuit et le soir ne partagent pas leur objet', soir !== nuit);
ok('plus il fait sombre, plus les rampes eclairent',
   H.ECLAIRAGE.jour < H.ECLAIRAGE['apres-midi'] && H.ECLAIRAGE['apres-midi'] < H.ECLAIRAGE.soir
   && H.ECLAIRAGE.soir < H.ECLAIRAGE.nuit && soir.eclairage < nuit.eclairage);
ok('la nuit, la piste est plus claire que le soir', lum(nuit.trackA) > lum(soir.trackA),
   lum(nuit.trackA).toFixed(0) + ' / ' + lum(soir.trackA).toFixed(0));
ok('l\'etalonnage du couchant faiblit sous les rampes', soir.ambianceForce > 0 && soir.ambianceForce < 1);

H.forcer('apres-midi');
ok('l\'apres-midi porte la lumiere doree', H.eclairer(jour, G).ambiance === 'doree');

titre('les couleurs ecrites en dur');
H.poser(null);
ok('le jour, une couleur fixe reste la meme', H.couleur([200, 100, 50], 'gradins').join() === '200,100,50');
H.poser(nuit);
const c = H.couleur([200, 100, 50], 'gradins');
ok('la nuit, elle baisse — moins sous les rampes que dans le lointain',
   lum(c) < lum([200, 100, 50]) && lum(H.couleur([200, 100, 50], 'loin')) < lum(c) * 0.75, c.join());
ok('une image sans pixels est rendue telle quelle', H.image({ width: 0, height: 0 }, 'proche').width === 0);

titre('forcer le moment');
ok('« après-midi » s\'ecrit avec ou sans accent', H.forcer('après-midi') === 'apres-midi');
ok('un moment inconnu rend la main au soleil', H.forcer('crepuscule') === null);
H.forcer(null);

console.log(e ? `\n✗ ${e} echec(s)\n` : '\n✓ tout tient\n');
process.exit(e ? 1 : 0);
