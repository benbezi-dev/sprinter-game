// La serie de victoires, contre une vraie base.
//
// Ce qu'un test pur ne peut pas atteindre : la serie vit dans une colonne, elle
// traverse deux ecritures par duel, et elle doit survivre au recalcul — qui
// rejoue tout l'historique et refait les compteurs a partir de rien. Une serie
// qui ne se rejoue pas a l'identique serait un nombre qu'on ne peut plus
// verifier apres coup.
//
//   - cinq victoires d'affilee valent cinq, pas cinq points de quelque chose.
//   - une defaite ramene a zero, et le maximum ne redescend pas avec elle.
//   - un nul garde la serie sans l'allonger.
//   - le recalcul rend exactement les memes series.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
const ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b, h = {}) => fetch(B + u, { method: 'POST', headers: { ...H, ...h },
  body: JSON.stringify(b) }).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nom = r => `SE${m}${r}`;

/** Un defi pose, puis releve. Celui qui releve gagne si son chrono est plus bas. */
async function duel(lanceur, releveur, msLanceur, msReleveur) {
  const c = await post('/challenge', {
    name: lanceur, device_id: 'dev-' + lanceur.toLowerCase(),
    races: ['100'], level_idx: 4, splits: [msLanceur],
    total_ms: msLanceur, traces: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  });
  const id = c.corps.id || c.corps.code;
  if (!id) throw new Error('defi refuse : ' + JSON.stringify(c.corps));
  const r = await post('/challenge/attempt', {
    id, name: releveur, device_id: 'dev-' + releveur.toLowerCase(),
    splits: [msReleveur], total_ms: msReleveur,
  });
  // La reponse imbrique le duel : `duel` porte l'issue, les points et les
  // series, `corps` porte les chronos. On rend les deux a plat pour le test.
  return { id, ...r.corps, ...(r.corps.duel || {}) };
}

const ligne = (b, n) => b.classement.find(x => x.name === n) || null;
const serieDe = async n => { const l = ligne(await lire('/duels'), n); return l ? l.serie : null; };
const maxDe   = async n => { const l = ligne(await lire('/duels'), n); return l ? l.serie_max : null; };

(async () => {
  const moi = nom('MOI');
  // Cinq adversaires distincts : un duel ne se resout qu'une fois par paire de
  // defi, et se battre soi-meme est refuse.
  const autres = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(x => nom(x));

  titre('LA FLAMME S ALLUME A CINQ');

  for (let i = 0; i < 4; i++) await duel(autres[i], moi, 12000, 11000);
  ok('quatre victoires d affilee valent quatre', await serieDe(moi) === 4,
     String(await serieDe(moi)));

  const cinq = await duel(autres[4], moi, 12000, 11000);
  ok('la cinquieme victoire porte la serie a cinq', await serieDe(moi) === 5,
     String(await serieDe(moi)));
  ok('le duel rend la serie a l ecran d arrivee', cinq.serie === 5,
     JSON.stringify({ serie: cinq.serie, avant: cinq.serie_avant }));
  ok('et ce qu elle valait avant, pour savoir qu elle vient de s allumer',
     cinq.serie_avant === 4, String(cinq.serie_avant));

  titre('UN NUL LA GARDE, SANS L ALLONGER');

  await duel(autres[5], moi, 11000, 11000);
  ok('apres un nul la serie tient toujours a cinq', await serieDe(moi) === 5,
     String(await serieDe(moi)));

  titre('CELUI QUI PERD REPART DE ZERO');

  // Le perdant de ces six duels a perdu six fois de suite : sa serie n'a
  // jamais quitte zero.
  ok('celui qui n a jamais gagne reste a zero', await serieDe(autres[0]) === 0,
     String(await serieDe(autres[0])));

  const perdu = await duel(autres[6], moi, 10000, 11000);
  ok('une defaite eteint la serie', await serieDe(moi) === 0,
     String(await serieDe(moi)));
  ok('le duel dit qu elle valait cinq juste avant', perdu.serie_avant === 5,
     JSON.stringify({ serie: perdu.serie, avant: perdu.serie_avant }));
  ok('la plus longue serie tenue ne redescend pas avec elle',
     await maxDe(moi) === 5, String(await maxDe(moi)));

  titre('LES DEUX COTES SONT COMPTES');

  // Celui qui a gagne le dernier duel l'a gagne en LANCANT : sa serie doit
  // avoir bouge aussi, sinon seuls ceux qui relevent auraient une flamme.
  ok('le lanceur qui gagne voit sa serie monter aussi',
     await serieDe(autres[6]) === 1, String(await serieDe(autres[6])));
  ok('et le duel la rend de son cote', perdu.serie_adverse === 1,
     String(perdu.serie_adverse));

  titre('LE RECALCUL REND LES MEMES SERIES');

  // On ne compare que les joueurs de CETTE execution. Les duels joues avant
  // que la colonne existe n'ont jamais ete comptes en direct : le recalcul les
  // rattrape, et leurs series changent donc au premier passage. C'est la
  // propriete recherchee — sans elle, l'ouverture remettrait tout le monde a
  // zero le meme jour — mais elle rend une comparaison globale sans objet.
  const miens = b => b.classement
    .filter(r => r.name.startsWith('SE' + m))
    .map(r => `${r.name}:${r.serie}/${r.serie_max}`).join(' ');

  const avant = miens(await lire('/duels'));
  const rc = await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': ADMIN });
  const apres = miens(await lire('/duels'));
  ok('le recalcul passe', rc.statut === 200, JSON.stringify(rc.corps));
  ok('rejouer l historique rend exactement les memes series', avant === apres,
     `\n     avant : ${avant}\n     apres : ${apres}`);

  // Et deux fois de suite, sinon le recalcul ne serait pas un outil : on ne
  // pourrait pas s'en servir pour changer une regle sans se demander ce qu'il
  // reste de l'existant.
  await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': ADMIN });
  const tous1 = (await lire('/duels')).classement
    .map(r => `${r.name}:${r.serie}/${r.serie_max}`).join(' ');
  await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': ADMIN });
  const tous2 = (await lire('/duels')).classement
    .map(r => `${r.name}:${r.serie}/${r.serie_max}`).join(' ');
  ok('deux recalculs de suite ne bougent plus rien, pour personne',
     tous1 === tous2, `${tous1.slice(0, 120)}\n     ${tous2.slice(0, 120)}`);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
  process.exit(e ? 1 : 0);
})().catch(x => { console.error(x); process.exit(1); });
