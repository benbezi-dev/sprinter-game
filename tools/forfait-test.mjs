// Le defi sans reponse, gagne par forfait — contre un vrai worker local.
//
// La regle : un defi ADRESSE a quelqu'un, qui reste sept jours sans reponse
// de sa part, est gagne par celui qui l'a lance. Voir worker/src/forfaits.js.
//
// Ce que ce harnais tient sous surveillance :
//
//   1. rien ne tombe avant la semaine, et tout tombe apres ;
//   2. le forfait compte au classement des duels comme un duel ordinaire —
//      une victoire d'un cote, une defaite de l'autre ;
//   3. les deux joueurs l'apprennent, et le perdant le reconnait par son
//      APPAREIL, puisqu'il n'a jamais couru ;
//   4. courir apres coup, meme sous un autre nom, ne rouvre pas le duel ;
//   5. un defi releve ne tombe jamais en forfait ;
//   6. une absence ne vaut qu'un forfait par semaine contre la meme personne ;
//   7. ce qu'on a bloque ne gagne pas contre nous.
//
// La semaine ne s'attend pas : sur le canal de test, /duels/forfaits accepte
// l'heure qu'il est. C'est pour cela que tout ici passe par ce canal.
//
//   npx wrangler dev --local --port 8788      (depuis worker/)
//   node tools/forfait-test.mjs

const B = process.env.BASE || 'http://127.0.0.1:8788';
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const JOUR = 24 * 3600 * 1000;

const _acces = await fetch(B + '/test/admin/creer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN },
  body: JSON.stringify({ nom: 'harnais-forfait' }),
}).then(r => r.json()).catch(() => ({}));

if (!_acces.code) {
  console.log(`\n   Pas d'acces au canal de test sur ${B}.`);
  console.log(`   Le serveur tourne-t-il ? (npx wrangler dev --local --port 8788)`);
  console.log(`   BASE=... pour interroger ailleurs, ADMIN_CLE=... pour la cle.\n`);
  process.exit(1);
}

const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': _acces.code };
const post = (u, b, h = {}) => fetch(B + u, {
  method: 'POST', headers: { ...H, ...h }, body: JSON.stringify(b || {}),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const joueur = l => ({
  nom: `FF${m}${l}`,
  dev: `ff${m.toLowerCase()}-${l.toLowerCase()}-0000-0000-000000000000`,
});
const A = joueur('A'), Bj = joueur('B'), C = joueur('C');

/** Pose un chrono au TOP 500 et rend la ligne qu'on peut viser. */
async function auTop(j, race = '100', ms = 10500) {
  await post('/submit', { device_id: j.dev, race_key: race, name: j.nom, time_ms: ms, best_split_ms: ms });
  const l = await lire(`/leaderboard?race=${race}&by=race`);
  return (l.entries || []).find(x => x.name === j.nom);
}

/** A lance un defi adresse a la ligne `cible`. */
async function defier(de, cible, race = '100', ms = 10200) {
  const r = await post('/challenge', {
    device_id: de.dev, name: de.nom, races: [race], level_idx: 4,
    total_ms: ms, splits: [ms], traces: [[0, 10, 20, 30]],
    target_score_id: cible ? cible.id : null,
  });
  return r.corps;
}

/** Le balayage, a l'heure qu'on veut. Repasse tant qu'il trouve du travail,
 *  pour que l'arriere d'autres harnais ne cache pas nos defis. */
async function balayer(maintenant) {
  const tout = [];
  for (let i = 0; i < 20; i++) {
    const r = await post('/duels/forfaits', { maintenant }, { 'X-Sprinter-Admin': CLE_ADMIN });
    const t = (r.corps && r.corps.tranches) || [];
    tout.push(...t);
    if (t.length < 25) break;
  }
  return tout;
}
const issueDe = (tranches, id) => (tranches.find(t => t.id === id) || {}).issue;

const ligne = (b, n) => (b.classement || []).find(x => x.name === n) || null;
const resultats = (j, avecNom = true) =>
  lire(`/duel/results?device_id=${j.dev}&name=${avecNom ? encodeURIComponent(j.nom) : ''}`)
    .then(r => r.results || []);

(async () => {
  const maintenant = Date.now();

  titre('LE DEFI PART, AVEC SON ECHEANCE');
  const ligneB = await auTop(Bj);
  ok('B est au TOP 500', !!(ligneB && ligneB.id != null));
  const d1 = await defier(A, ligneB);
  ok('le defi part, adresse a B', d1.id && d1.target_name === Bj.nom, JSON.stringify(d1));

  const boite = await lire(`/inbox?device_id=${Bj.dev}`);
  const recu = (boite.defis || []).find(x => x.id === d1.id);
  ok('B le trouve dans sa boite', !!recu);
  ok('avec une echeance a sept jours',
     recu && recu.echeance === recu.created_at + 7 * JOUR, JSON.stringify(recu && recu.echeance));

  titre('RIEN AVANT LA SEMAINE');
  const t6 = await balayer(maintenant + 6 * JOUR);
  ok('a six jours, le defi n est pas tranche', !issueDe(t6, d1.id), issueDe(t6, d1.id));
  const t7 = await balayer(maintenant + 7 * JOUR + 5 * 60 * 1000);
  ok('a sept jours et cinq minutes non plus : celui qui court a sa grace',
     !issueDe(t7, d1.id), issueDe(t7, d1.id));

  titre('LA SEMAINE PASSEE : VICTOIRE PAR FORFAIT');
  const plusTard = maintenant + 7 * JOUR + 20 * 60 * 1000;
  const t8 = await balayer(plusTard);
  ok('le defi est gagne par forfait', issueDe(t8, d1.id) === 'forfait',
     JSON.stringify(t8.find(t => t.id === d1.id)));
  const t8bis = await balayer(plusTard + 60 * 1000);
  ok('un second passage ne le retranche pas', !issueDe(t8bis, d1.id));

  const board = await lire('/duels?epreuve=100');
  const la = ligne(board, A.nom), lb = ligne(board, Bj.nom);
  ok('A compte une victoire', la && la.wins === 1 && la.losses === 0, JSON.stringify(la));
  ok('B compte une defaite', lb && lb.losses === 1 && lb.wins === 0, JSON.stringify(lb));
  ok('A prend des points de ligue', la && la.lp > 0, String(la && la.lp));

  ok('le defi n est plus propose a B',
     !((await lire(`/inbox?device_id=${Bj.dev}`)).defis || []).some(x => x.id === d1.id));

  titre('LES DEUX L APPRENNENT');
  const rA = (await resultats(A)).find(r => r.id === d1.id);
  ok('A apprend sa victoire', rA && rA.role === 'challenger' && rA.issue === 'challenger',
     JSON.stringify(rA));
  ok('marquee comme forfait', rA && rA.forfait === true);
  ok('avec ses points', rA && rA.lp > 0, String(rA && rA.lp));

  // B ne donne PAS de nom : c'est son appareil qui etait vise.
  const rB = (await resultats(Bj, false)).find(r => r.id === d1.id);
  ok('B apprend sa defaite par son seul appareil',
     rB && rB.role === 'opponent' && rB.issue === 'challenger' && rB.forfait === true,
     JSON.stringify(rB));
  ok('B voit qui l a battu', rB && rB.adversaire === A.nom);
  ok('et ce qu il y perd', rB && rB.lp < 0, String(rB && rB.lp));

  const fantome = await lire(`/duel/fantome?id=${d1.id}&device_id=${Bj.dev}&name=`);
  ok('B peut courir sa revanche contre le fantome de A', fantome.found === true,
     JSON.stringify(fantome).slice(0, 120));

  await post('/duel/results/seen', { device_id: Bj.dev, name: '', ids: [d1.id] });
  ok('l annonce de B ne revient pas une fois vue',
     !(await resultats(Bj, false)).some(r => r.id === d1.id));
  await post('/duel/results/seen', { device_id: A.dev, name: A.nom, ids: [d1.id] });
  ok('celle de A non plus', !(await resultats(A)).some(r => r.id === d1.id));

  titre('LE RECALCUL REJOUE LES FORFAITS');
  // Le forfait est range comme un duel : le recalcul, qui ne connait que des
  // issues, doit le retrouver tel quel. Une regle a part serait oubliee ici.
  //
  // Verifie ICI, avant tout autre duel : le harnais date ses forfaits dans le
  // futur, et un duel couru ensuite « maintenant » serait rejoue avant eux —
  // un ordre que la production, ou le cron date a l'heure reelle, ne connait
  // pas.
  const avant = await lire('/duels?epreuve=100');
  await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': CLE_ADMIN });
  const apres = await lire('/duels?epreuve=100');
  const pareil = n => {
    const x = ligne(avant, n), y = ligne(apres, n);
    return x && y && x.wins === y.wins && x.losses === y.losses && x.lp === y.lp && x.palier === y.palier;
  };
  ok('A garde ses victoires et ses points', pareil(A.nom),
     JSON.stringify([ligne(avant, A.nom), ligne(apres, A.nom)]));
  ok('B garde ses defaites', pareil(Bj.nom));

  titre('COURIR APRES COUP NE ROUVRE RIEN');
  const tard = await post('/challenge/attempt', {
    id: d1.id, device_id: Bj.dev, name: Bj.nom + 'X', total_ms: 9000, splits: [9000],
  });
  ok('la course de B arrive sur un duel deja tranche',
     tard.corps.duel && tard.corps.duel.deja === true && tard.corps.duel.forfait === true,
     JSON.stringify(tard.corps.duel));
  const board2 = await lire('/duels?epreuve=100');
  ok('meme sous un autre nom, le classement ne bouge pas',
     !ligne(board2, Bj.nom + 'X') && ligne(board2, A.nom).wins === 1);

  titre('UN DEFI RELEVE NE TOMBE PAS EN FORFAIT');
  const ligneC = await auTop(C);
  const d2 = await defier(A, ligneC);
  await post('/challenge/attempt', {
    id: d2.id, device_id: C.dev, name: C.nom, total_ms: 10000, splits: [10000],
  });
  const t9 = await balayer(plusTard);
  ok('C a couru : pas de forfait', !issueDe(t9, d2.id), issueDe(t9, d2.id));
  const lc = ligne(await lire('/duels?epreuve=100'), C.nom);
  ok('et le duel reste celui qu il a gagne', lc && lc.wins === 1 && lc.losses === 0,
     JSON.stringify(lc));

  titre('UNE ABSENCE, UN FORFAIT PAR SEMAINE');
  const d3 = await defier(A, ligneB);
  const d4 = await defier(A, ligneB);
  const t10 = await balayer(plusTard + 2 * 60 * 1000);
  const issues = [issueDe(t10, d3.id), issueDe(t10, d4.id)];
  ok('deux defis de plus a B dans la semaine : aucun ne rapporte',
     issues.every(i => i === 'deja_cette_semaine'), JSON.stringify(issues));
  ok('A n a toujours qu une victoire sur B', ligne(await lire('/duels?epreuve=100'), A.nom).wins === 1);
  // Une semaine apres le premier forfait, une nouvelle absence recompte.
  const d5 = await defier(A, ligneB);
  const t12 = await balayer(plusTard + 8 * JOUR);
  ok('une semaine plus tard, une nouvelle absence est un nouveau forfait',
     issueDe(t12, d5.id) === 'forfait', issueDe(t12, d5.id));
  ok('A compte alors deux victoires', ligne(await lire('/duels?epreuve=100'), A.nom).wins === 2);

  titre('CE QU ON A BLOQUE NE GAGNE PAS');
  const D = joueur('D');
  const ligneD = await auTop(D);
  await post('/moderation/bloquer', { name: D.nom, cible: A.nom });
  const d6 = await defier(A, ligneD);
  const t13 = await balayer(plusTard);
  ok('D a bloque A : pas de forfait', issueDe(t13, d6.id) === 'bloque', issueDe(t13, d6.id));

  titre('LE DEFI QUI NE VISE PERSONNE');
  const d7 = await defier(A, null);
  const t14 = await balayer(plusTard);
  ok('un code sans destinataire n est jamais tranche', !issueDe(t14, d7.id));

  console.log(`\n${e ? `✗ ${e} echec(s)` : '✓ tout tient'}\n`);
  process.exit(e ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
