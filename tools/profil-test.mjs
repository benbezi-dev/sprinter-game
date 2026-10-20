// Le profil garde sous le nom (worker/src/profil.js), contre le worker local.
//   cd worker && npx wrangler dev --local --port 8788
//   node tools/profil-test.mjs            (BASE=http://127.0.0.1:8798 pour un autre port)
//
// Ce qu'on cherche a prendre en defaut :
//   1. un appareil qui n'a pas le code du nom ne lit ni n'ecrit rien ;
//   2. un appareil relie retrouve ce qu'un autre a garde ;
//   3. deux appareils ne s'ecrasent pas : une ecriture sur une revision
//      depassee est refusee avec la version courante.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond ? '' : ' — ' + JSON.stringify(detail)}`);
  if (!cond) echecs++;
};

const sel = Date.now().toString(36);
const nom = `Profil${sel}`.slice(0, 20);
const tel1 = `tel1-${sel}-aaaaaaaa`, tel2 = `tel2-${sel}-bbbbbbbb`, intrus = `intrus-${sel}-cccc`;
const profil = { sprinter_web_v1: JSON.stringify({ furthest: { '100': 4 } }), 'halloween2026.v1': '{"v":1}' };

console.log(`\n── PROFIL (${B}) ──`);
const claim = await post('/claim', { device_id: tel1, name: nom });
ok('le nom se reserve', claim.corps.ok && claim.corps.code, claim);
const code = claim.corps.code;

const libre = await post('/profil/lire', { device_id: tel1, name: `Libre${sel}` });
ok('un nom libre n\'a pas de profil', libre.corps.non_relie === true, libre);

const vide = await post('/profil/lire', { device_id: tel1, name: nom });
ok('un nom reserve commence sans profil, revision 0', vide.corps.ok && vide.corps.rev === 0 && vide.corps.donnees === null, vide);

const e1 = await post('/profil/ecrire', { device_id: tel1, name: nom, rev: 0, donnees: profil });
ok('le premier depot passe en revision 1', e1.corps.ok && e1.corps.rev === 1, e1);

const lu = await post('/profil/lire', { device_id: intrus, name: nom });
ok('un appareil sans le code ne lit rien', lu.corps.non_relie === true && !lu.corps.donnees, lu);
const ecrit = await post('/profil/ecrire', { device_id: intrus, name: nom, rev: 1, donnees: {} });
ok('un appareil sans le code n\'ecrit rien', ecrit.corps.non_relie === true, ecrit);

const lien = await post('/link', { device_id: tel2, name: nom, code });
ok('le second telephone se relie avec le code', lien.corps.ok, lien);
const repris = await post('/profil/lire', { device_id: tel2, name: nom });
ok('il retrouve le profil garde par le premier', repris.corps.rev === 1
  && JSON.stringify(repris.corps.donnees) === JSON.stringify(profil), repris);

const page = await post('/profil/ecrire', { device_id: tel2, name: nom, rev: 0, donnees: {} });
ok('une page blanche sur la revision 0 ne remplace rien : conflit', page.corps.conflit === true
  && page.corps.rev === 1 && JSON.stringify(page.corps.donnees) === JSON.stringify(profil), page);

const e2 = await post('/profil/ecrire', { device_id: tel2, name: nom, rev: 1, donnees: { ...profil, sprinter_vestiaire: '{}' } });
ok('sur la revision courante, l\'ecriture passe (revision 2)', e2.corps.ok && e2.corps.rev === 2, e2);
const retard = await post('/profil/ecrire', { device_id: tel1, name: nom, rev: 1, donnees: profil });
ok('le premier telephone, en retard d\'une revision, recoit la version courante', retard.corps.conflit === true
  && retard.corps.rev === 2 && 'sprinter_vestiaire' in retard.corps.donnees, retard);

console.log('\n── CE QUI EST REFUSE ──');
const mauvaise = await post('/profil/ecrire', { device_id: tel1, name: nom, rev: 2, donnees: { sprinter_cle: 3 } });
ok('une valeur qui n\'est pas du texte', mauvaise.statut === 400, mauvaise);
const etrangere = await post('/profil/ecrire', { device_id: tel1, name: nom, rev: 2, donnees: { 'autre.cle': 'x' } });
ok('une cle qui n\'est pas du jeu', etrangere.statut === 400, etrangere);
const lourd = await post('/profil/ecrire', { device_id: tel1, name: nom, rev: 2, donnees: { sprinter_history: 'x'.repeat(300 * 1024) } });
ok('un profil de plus de 256 ko', lourd.statut === 413, { statut: lourd.statut });
const sansRev = await post('/profil/ecrire', { device_id: tel1, name: nom, donnees: profil });
ok('une ecriture sans revision', sansRev.statut === 400, sansRev);

console.log(echecs ? `\n✗ ${echecs} echec(s)\n` : '\n✓ tout passe\n');
process.exit(echecs ? 1 : 0);
