// Le classement des duels, contre une vraie base.
//
// Le module de calcul est deja couvert sans rien monter ; ce qui reste a
// prendre en defaut est ailleurs, et c'est la partie qu'aucun test pur ne peut
// atteindre :
//
//   - un duel ne doit crediter qu'une fois, meme rejoue.
//   - lancer un defi ne doit rien rapporter tant que personne ne l'a releve.
//   - le MMR ne doit jamais sortir du serveur.
//   - le recalcul doit etre rejouable : deux passages de suite donnent le meme
//     classement, sinon on ne peut pas s'en servir pour changer un bareme.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
// La cle d'administration du worker local, telle que .dev.vars la pose.
const ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b, h = {}) => fetch(B + u, { method: 'POST', headers: { ...H, ...h },
  body: JSON.stringify(b) }).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nom = r => `CL${m}${r}`;

/** Un defi pose, puis releve : c'est le chemin normal d'un duel. */
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
  return { id, ...r.corps };
}

const ligne = (b, n) => b.classement.find(x => x.name === n) || null;

(async () => {
  titre('UN DUEL, ET CE QU IL DEPLACE');

  const board0 = await lire('/duels');
  const a = nom('A'), z = nom('Z');
  const r1 = await duel(a, z, 11000, 10500);           // le releveur gagne
  ok('le duel se tranche', r1.duel && r1.duel.issue === 'opponent',
     JSON.stringify(r1.duel));
  ok('le releveur qui gagne prend des points de ligue',
     r1.duel && r1.duel.lp > 0, String(r1.duel && r1.duel.lp));
  ok('le lanceur qui tombe en perd',
     r1.duel && r1.duel.lp_adverse < 0, String(r1.duel && r1.duel.lp_adverse));
  // Deux joueurs neufs partent au bas de l'echelle avec un MMR de milieu de
  // tableau : le systeme les estime tous deux au-dessus de leur division, et
  // les fait donc monter vite et tomber doucement. C'est la periode de
  // placement, et elle doit se voir des le premier duel.
  ok('un joueur neuf monte plus vite que le bareme nominal',
     r1.duel && r1.duel.lp > board0.bareme.releveur.victoire,
     `${r1.duel && r1.duel.lp} contre ${board0.bareme.releveur.victoire} nominal`);
  ok('et tombe moins vite',
     r1.duel && r1.duel.lp_adverse > board0.bareme.lanceur.defaite,
     `${r1.duel && r1.duel.lp_adverse} contre ${board0.bareme.lanceur.defaite} nominal`);
  ok('le rang remonte avec le resultat',
     !!(r1.duel && r1.duel.rang && r1.duel.rang.etage),
     JSON.stringify(r1.duel && r1.duel.rang));

  titre('CE QUE LE SERVEUR NE DIT PAS');

  const board = await lire('/duels');
  const lz = ligne(board, z);
  ok('le classement expose le palier et les points', lz && lz.lp != null && lz.etage,
     JSON.stringify(lz && { etage: lz.etage, division: lz.division, lp: lz.lp }));
  ok('le MMR ne sort jamais du serveur',
     lz && lz.mmr === undefined && !JSON.stringify(board).includes('"mmr"'));
  ok('l echelle voyage avec le classement',
     board.echelle && board.echelle.etages.length === 4 &&
     board.echelle.lp_par_palier === 100, JSON.stringify(board.echelle));
  ok('le bareme annonce est celui des roles',
     board.bareme.releveur.victoire > board.bareme.lanceur.victoire,
     JSON.stringify(board.bareme));

  titre('UN DUEL NE COMPTE QU UNE FOIS');

  const avant = ligne(await lire('/duels'), z);
  const rejoue = await post('/challenge/attempt', {
    id: r1.id, name: z, device_id: 'dev-' + z.toLowerCase(),
    splits: [10400], total_ms: 10400,
  });
  const apres = ligne(await lire('/duels'), z);
  ok('rejouer un duel deja tranche ne redistribue rien',
     avant.lp === apres.lp && avant.palier === apres.palier,
     `${avant.palier}@${avant.lp} → ${apres.palier}@${apres.lp}`);
  ok('et le serveur le dit plutot que de se taire',
     rejoue.corps.duel && rejoue.corps.duel.deja === true,
     JSON.stringify(rejoue.corps.duel));

  titre('LANCER UN DEFI NE RAPPORTE RIEN');

  const seul = nom('S');
  await post('/challenge', {
    name: seul, device_id: 'dev-seul', races: ['100'], level_idx: 4,
    splits: [10800], total_ms: 10800, traces: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  });
  ok('un defi sans reponse ne fait pas entrer au classement',
     ligne(await lire('/duels'), seul) === null);

  titre('L OUTSIDER, ET LA MONTEE');

  // Un joueur qui gagne beaucoup traverse ses divisions.
  const grimpeur = nom('G');
  for (let i = 0; i < 8; i++) {
    await duel(nom('V' + i), grimpeur, 12000, 10000 + i);
  }
  const g = ligne(await lire('/duels'), grimpeur);
  ok('huit victoires font changer de division',
     g && (g.palier > 0), JSON.stringify(g && { etage: g.etage, division: g.division, lp: g.lp }));
  ok('le classement est ordonne par l echelle visible',
     (await lire('/duels')).classement.every((r, i, t) =>
       i === 0 || t[i - 1].palier > r.palier ||
       (t[i - 1].palier === r.palier && t[i - 1].lp >= r.lp)));

  titre('LE RECALCUL SE REJOUE');

  const admin = { 'X-Sprinter-Admin': ADMIN };
  const un = await post('/duels/recalculer', {}, admin);
  ok('le recalcul rejoue tout l historique',
     un.statut === 200 && un.corps.duels > 0, JSON.stringify(un.corps));
  const apres1 = (await lire('/duels')).classement;
  const deux = await post('/duels/recalculer', {}, admin);
  const apres2 = (await lire('/duels')).classement;
  ok('deux recalculs de suite donnent le meme classement',
     JSON.stringify(apres1) === JSON.stringify(apres2),
     `${apres1.length} lignes`);
  ok('le recalcul ne perd personne',
     deux.statut === 200 && deux.corps.duels === un.corps.duels,
     `${un.corps.duels} → ${deux.corps.duels}`);

  const refuse = await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': 'faux' });
  ok('sans la cle, on ne recalcule pas le classement de tout le monde',
     refuse.statut === 403, String(refuse.statut));

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
  process.exit(e ? 1 : 0);
})().catch(x => { console.error(x); process.exit(1); });
