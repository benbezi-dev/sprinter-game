// La reponse du perdant au mot du vainqueur, contre le vrai serveur.
//
//   npx wrangler dev --local --port 8795      (dans worker/)
//   BASE=http://127.0.0.1:8795 node tools/reponse-perdant-test.mjs
//
// Ce que le harnais cherche a prendre en defaut :
//   0. les listes — serveur, jeu, dictionnaire — disent la meme chose ;
//   A. le lanceur gagne : le perdant ne repond qu'apres un vrai mot, une seule
//      fois, et rien d'autre qu'une phrase de la liste ; ni le vainqueur ni un
//      tiers ne repondent a sa place ; la reponse revient au vainqueur une
//      fois, et pas au perdant ;
//   B. le releveur gagne : le lanceur battu repond depuis son appareil, et la
//      reponse revient au releveur ;
//   C. le vainqueur a bloque le perdant : la reponse ne remonte pas.

import fs from 'node:fs';
import { REPONSES } from '../worker/src/mot.js';

const B = process.env.BASE || 'http://127.0.0.1:8795';
const H = { 'Content-Type': 'application/json' };
const attendre = ms => new Promise(r => setTimeout(r, ms));

/** Un POST, qui patiente une fois si le limiteur d'IP l'arrete. */
async function post(u, b) {
  for (let essai = 0; essai < 2; essai++) {
    const r = await fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) });
    if (r.status === 429 && essai === 0) { await attendre(61_000); continue; }
    return { statut: r.status, corps: await r.json().catch(() => ({})) };
  }
}
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const dev = n => 'dev-' + n.toLowerCase();

/** Un defi pose puis releve. */
async function duel(lanceur, releveur, msLanceur, msReleveur) {
  const c = await post('/challenge', {
    name: lanceur, device_id: dev(lanceur),
    races: ['100'], level_idx: 4, splits: [msLanceur], total_ms: msLanceur,
    traces: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  });
  const id = c.corps.id;
  if (!id) throw new Error('defi refuse : ' + JSON.stringify(c.corps));
  await post('/challenge/attempt', {
    id, name: releveur, device_id: dev(releveur),
    splits: [msReleveur], total_ms: msReleveur,
  });
  return id;
}

const resultats = n =>
  lire(`/duel/results?device_id=${dev(n)}&name=${encodeURIComponent(n)}`)
    .then(d => d.results || []);
const vus = (n, ids) => post('/duel/results/seen', { device_id: dev(n), name: n, ids });
const repondre = (id, n, reponse, device_id = dev(n)) =>
  post('/duel/reponse', { id, name: n, device_id, reponse });

(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  LA REPONSE DU PERDANT                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  titre('0. les listes');
  {
    const jeu = fs.readFileSync(new URL('../src/game/mot.ts', import.meta.url), 'utf8');
    const dico = fs.readFileSync(new URL('../src/game/sprinter-i18n.js', import.meta.url), 'utf8');
    const bloc = jeu.slice(jeu.indexOf('export const REPONSES'), jeu.indexOf('] as const'));
    const idsJeu = [...bloc.matchAll(/'(r_[a-z]+)'/g)].map(x => x[1]);
    ok('le jeu et le serveur ont la meme liste, dans le meme ordre',
       JSON.stringify(idsJeu) === JSON.stringify(REPONSES),
       `jeu ${idsJeu.join(',')} / serveur ${REPONSES.join(',')}`);
    const sansTexte = REPONSES.filter(q =>
      !new RegExp(`reponse_${q}:\\s*\\['[^']+',\\s*'[^']+'\\]`).test(dico));
    ok('chaque phrase a son texte en francais et en anglais', !sansTexte.length, sansTexte.join(', '));
  }

  titre('A. le lanceur gagne');
  {
    const L = `RPA${m}L`, R = `RPA${m}R`, X = `RPA${m}X`;
    const id = await duel(L, R, 9000, 9600);
    // Le vainqueur apprend son resultat et referme : la reponse devra revenir
    // par sa branche a elle, pas avec le resultat.
    const av = await resultats(L);
    ok('le vainqueur voit son resultat', av.some(d => d.id === id && d.issue === 'challenger'));
    await vus(L, [id]);
    ok('referme, le resultat ne revient plus', !(await resultats(L)).some(d => d.id === id));

    let r = await repondre(id, R, 'r_vent');
    ok('pas de reponse sans mot', r.statut === 403, JSON.stringify(r));

    r = await post('/duel/mot', { id, name: L, texte: 'merci pour l echauffement' });
    ok('le vainqueur pose son mot', r.statut === 200, JSON.stringify(r));

    r = await repondre(id, L, 'r_vent');
    ok('le vainqueur ne se repond pas', r.statut === 403, JSON.stringify(r));
    r = await repondre(id, X, 'r_vent');
    ok('un tiers ne repond pas', r.statut === 403, JSON.stringify(r));
    r = await repondre(id, R, 'tu es nul');
    ok('du texte libre est refuse', r.statut === 403, JSON.stringify(r));

    const perdant = await resultats(R);
    const ligne = perdant.find(d => d.id === id);
    ok('le perdant recoit le mot', ligne && ligne.mot === 'merci pour l echauffement', JSON.stringify(ligne));
    ok('le perdant ne recoit pas de reponse', ligne && !ligne.reponse);

    r = await repondre(id, R, 'r_vent');
    ok('le perdant repond', r.statut === 200 && r.corps.reponse === 'r_vent', JSON.stringify(r));
    r = await repondre(id, R, 'r_bien');
    ok('une seule fois', r.statut === 409, JSON.stringify(r));

    const g = (await resultats(L)).find(d => d.id === id);
    ok('la reponse revient au vainqueur', g && g.reponse === 'r_vent', JSON.stringify(g));
    ok('sans le mot qu il a ecrit', g && !g.mot);
    await vus(L, [id]);
    ok('lue, elle ne revient plus', !(await resultats(L)).some(d => d.id === id));

    // Le perdant referme son annonce : le mot est lu, la reponse reste posee.
    await vus(R, [id]);
    ok('le mot lu ne revient plus au perdant', !(await resultats(R)).some(d => d.id === id));
  }

  titre('B. le releveur gagne');
  {
    const L = `RPB${m}L`, R = `RPB${m}R`;
    const id = await duel(L, R, 9800, 9100);
    let r = await post('/duel/mot', { id, name: R, texte: 'la ligne c est par la' });
    ok('le releveur pose son mot', r.statut === 200, JSON.stringify(r));
    // Le lanceur battu, reconnu par l'appareil qui a cree le defi.
    r = await repondre(id, '', 'r_note', dev(L));
    ok('le lanceur repond depuis son appareil', r.statut === 200, JSON.stringify(r));
    const g = (await resultats(R)).find(d => d.id === id);
    ok('la reponse revient au releveur', g && g.reponse === 'r_note' && g.role === 'opponent',
       JSON.stringify(g));
    await vus(R, [id]);
    ok('lue, elle ne revient plus', !(await resultats(R)).some(d => d.id === id));
  }

  titre('C. le vainqueur a bloque le perdant');
  {
    const L = `RPC${m}L`, R = `RPC${m}R`;
    const id = await duel(L, R, 9000, 9700);
    await vus(L, [id]);
    await post('/duel/mot', { id, name: L, texte: 'trop facile' });
    const b = await post('/moderation/bloquer', { name: L, cible: R });
    ok('le blocage passe', b.statut === 200, JSON.stringify(b));
    const r = await repondre(id, R, 'r_blocs');
    ok('la reponse est acceptee sans rien dire du blocage', r.statut === 200, JSON.stringify(r));
    ok('elle ne remonte pas chez le vainqueur', !(await resultats(L)).some(d => d.id === id));
  }

  console.log(echecs ? `\n✗ ${echecs} echec(s)\n` : '\n✓ tout passe\n');
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
