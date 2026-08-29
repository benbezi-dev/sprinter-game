// Le relais joue comme le JEU le joue, et non comme un script le jouerait.
//
// Les autres harnais menent la course a leur guise. Celui-ci suit exactement ce
// que fait le client, geste par geste, parce que c'est la que les erreurs se
// cachent — le serveur, lui, est deja couvert :
//
//   depart      le pistolet est celui des QUATRE. Les trois derniers entrent
//               en course avec le premier et attendent debout dans leur zone.
//   position    en metres absolus depuis le depart, jamais en metres
//               parcourus : le troisieme relayeur est au deux-centieme metre,
//               pas au zeroieme.
//   marque      chacun se pose dans sa zone, et c'est de la qu'il compte.
//   arrivee     quatre cents metres.
//   chrono      celui de l'EQUIPE, depuis le coup de pistolet — le temps de
//               course du quatrieme ne vaudrait que sa portion, et le serveur
//               le refuserait en silence.
//
// Deux details ont fait echouer ce harnais avant de tenir, et ce sont les deux
// memes qui menacaient le client : un receveur ne voit avancer le porteur que
// par les messages de position — les etats complets n'arrivent qu'aux passages
// — et un porteur ne recoit pas ses propres positions en echo.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const attendre = ms => new Promise(r => setTimeout(r, ms));

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

const LEG = 100, TAILLE = 4, ARRIVEE = LEG * TAILLE, ZONE = 30;
/** Ou chacun pose sa marque dans sa zone, en metres depuis l'entree. */
const DANS_ZONE = 12;
/** A quelle distance du porteur on se met a courir. */
const DECLENCHE = 9;
const VMAX = 10.5, ACCEL = 6;      // m/s et m/s2

async function monterEquipe(prefixe) {
  const m = Math.random().toString(36).slice(2, 5).toUpperCase();
  const noms = [1, 2, 3, 4].map(i => `${prefixe}${i}${m}`);
  const c = await post('/relay/team', { name: prefixe + m, creator: noms[0], members: noms.slice(1) });
  if (!c.equipe) throw new Error('equipe refusee : ' + JSON.stringify(c));
  for (const n of noms.slice(1)) await post('/relay/answer', { id: c.equipe.id, name: n, accept: true });
  return { id: c.equipe.id, noms };
}

/**
 * Un relayeur, tel que le jeu le pilote.
 *
 * `dLocal` est ce que le moteur connait : des metres parcourus depuis zero. Il
 * n'a aucune idee de la piste reelle, et c'est tout l'interet — c'est le meme
 * moteur qui joue un cent metres solo.
 */
function relayeur(equipe, nom, conf) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ name: nom, acces: ACCES });
    let url = `${WS}/relay/room/${equipe}?${q}`;
    if (conf) {
      q.set('team', equipe);
      q.set('max', String(conf.max));
      if (conf.fantomes && conf.fantomes.length) q.set('fantomes', conf.fantomes.join(','));
      url = `${WS}/relay/conf/${conf.code}?${q}`;
    }
    const ws = new WebSocket(url);
    const envoyer = o => { try { ws.send(JSON.stringify(o)); } catch { /* fermee */ } };

    let moi = 0, marque = 0, dLocal = 0, v = 0, cours = false;
    let porteur = 1, temoin = 0, fini = false, finEnvoyee = false;
    let departA = null, boucle = null;
    const vu = { adverse: 0, autresEquipes: 0, finiesAilleurs: 0 };

    /** La traduction, mot pour mot celle du client. */
    const avancer = () => {
      const abs = marque + Math.max(0, dLocal);
      envoyer({ t: 'pos', d: abs });
      if (moi === TAILLE && abs >= ARRIVEE && !finEnvoyee) {
        finEnvoyee = true;
        envoyer({ t: 'fini', ms: Date.now() - departA });
      }
      return abs;
    };

    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      // En confrontation, chaque message porte le code de son equipe. Tout ce
      // qui vient d'ailleurs se regarde mais ne se joue pas.
      if (m.equipe && m.equipe !== equipe && m.t !== 'salle') {
        if (m.t === 'pos') vu.autresEquipes++;
        if (m.t === 'fini') vu.finiesAilleurs++;
        return;
      }
      if (conf && m.equipes) {
        const x = m.equipes.find(y => y.equipe === equipe);
        if (x) { m.porteur = x.porteur; m.temoin_d = x.temoin_d; m.total = x.total;
                 m.elimine = x.elimine; m.passes = x.passes; }
      }
      switch (m.t) {
        case 'bienvenue':
          moi = m.relais;
          // Le client pose sa marque a l'entree de zone, puis la deplace.
          marque = m.zone ? m.zone.debut + DANS_ZONE : 0;
          if (m.zone) envoyer({ t: 'marque', d: marque });
          envoyer({ t: 'pret', pret: true });
          break;
        case 'salle':
        case 'passe':
          if (m.porteur != null) porteur = m.porteur;
          if (m.temoin_d != null) temoin = m.temoin_d;
          if (m.depart_a && !departA) {
            departA = m.depart_a;
            // Le pistolet est celui de tout le monde : les quatre entrent en
            // course a la meme seconde. Les trois derniers attendent debout
            // dans leur zone — ne pas courir est ici une action.
            const dans = Math.max(0, m.depart_a - Date.now());
            setTimeout(() => {
              if (moi === 1) cours = true;
              boucle = setInterval(() => {
                if (fini) return;
                // On s'elance quand le temoin arrive a portee.
                if (!cours && moi > 1 && porteur === moi - 1 &&
                    marque - temoin <= DECLENCHE) cours = true;
                // Un receveur part de l'arret : c'est ce qui permet au porteur,
                // lance a pleine vitesse, de le rejoindre dans la zone. Deux
                // coureurs a vitesse constante ne se rattrapent jamais, et le
                // temoin sortirait de la zone sans changer de main.
                if (cours) { v = Math.min(VMAX, v + ACCEL * 0.1); dLocal += v * 0.1; }
                const abs = avancer();
                // Le porteur ne recoit pas ses propres positions en echo : sa
                // seule source sur l'endroit ou est le temoin, c'est lui-meme.
                if (moi === porteur) temoin = abs;
                // La tape : les deux touchent quand ils se rejoignent.
                if (!fini && Math.abs(abs - temoin) < 2.2 &&
                    (moi === porteur + 1 || moi === porteur) && porteur < TAILLE) {
                  envoyer({ t: 'temoin' });
                }
                if (moi === TAILLE && abs >= ARRIVEE) fini = true;
              }, 100);
            }, dans);
          }
          break;
        case 'pos':
          if (m.relais !== moi) vu.adverse++;
          // Le temoin ne bouge que la. Les messages d'etat complets n'arrivent
          // qu'aux passages : un receveur qui n'ecouterait que ceux-la verrait
          // le porteur immobile a zero et ne s'elancerait jamais.
          if (m.relais === porteur) temoin = m.d;
          break;
        case 'fini':
          fini = true; clearInterval(boucle);
          resolve({ moi, total: m.total, passes: m.passes, vu });
          ws.close();
          break;
        case 'elimine':
          fini = true; clearInterval(boucle);
          resolve({ moi, elimine: m, vu });
          ws.close();
          break;
        case 'termine':
          if (!fini) { fini = true; clearInterval(boucle); resolve({ moi, vu }); }
          ws.close();
          break;
      }
    };
    ws.onerror = () => reject(new Error('socket ' + nom));
    setTimeout(() => { clearInterval(boucle); resolve({ moi, timeout: true, vu }); }, 90000);
  });
}

(async () => {
  console.log('\n── LE RELAIS, JOUE COMME LE JEU LE JOUE ─────────────────────\n');
  const eq = await monterEquipe('CL');
  ok('equipe montee', !!eq.id, JSON.stringify(eq));

  const courses = eq.noms.map(n => relayeur(eq.id, n));
  const r = await Promise.all(courses);

  const elimine = r.find(x => x.elimine);
  ok('personne n est elimine', !elimine,
     elimine ? `${elimine.elimine.raison} (relais ${elimine.elimine.relais})` : '');

  const total = r.find(x => x.total != null)?.total ?? null;
  ok('la course a un chrono', total != null);
  // Un 4x100 court en dessous de quarante secondes ; le serveur refuse tout ce
  // qui sort de [10 s, 600 s], et un chrono local aurait fait onze secondes.
  ok('le chrono est celui de l equipe, pas d un relayeur',
     total != null && total > 30000 && total < 60000, `${total} ms`);

  const passes = r.find(x => x.passes)?.passes || [];
  ok('les trois passages ont eu lieu', passes.length === 3,
     `${passes.length} passage(s)`);
  ok('chaque passage est dans sa zone',
     passes.every(p => p.dans_zone >= 0 && p.dans_zone <= ZONE),
     passes.map(p => p.dans_zone).join(' / '));
  ok('chacun a vu courir les autres', r.every(x => x.vu.adverse > 20),
     r.map(x => x.vu.adverse).join(' / '));

  if (total) console.log(`\n     ${(total / 1000).toFixed(3)} s  ·  passages ` +
                         passes.map(p => p.note).join('/'));

  /* ------------------------------------------------------- le mode fantome */

  console.log('\n── LE MEME JEU, CONTRE UNE COURSE ENREGISTREE ───────────────\n');
  const g = await fetch(B + '/relay/ghosts', { headers: H }).then(r => r.json());
  const dispo = (g.fantomes || []).filter(f => f.equipe_id !== eq.id);
  ok('la course qu on vient de courir est rejouable',
     (g.fantomes || []).some(f => f.equipe_id === eq.id),
     `${(g.fantomes || []).length} fantome(s)`);

  const cible = dispo[0] || (g.fantomes || [])[0];
  if (!cible) {
    console.log('   (aucun fantome a affronter : on s arrete la)');
  } else {
    const eq2 = await monterEquipe('FA');
    const conf = { code: (await post('/relay/confrontation', {})).id,
                   max: 2, fantomes: [cible.id] };
    ok('la confrontation est ouverte', !!conf.code, JSON.stringify(conf));

    const r2 = await Promise.all(eq2.noms.map(n => relayeur(eq2.id, n, conf)));
    const el2 = r2.find(x => x.elimine);
    ok('une equipe humaine seule part quand meme contre un fantome', !el2 || !el2.timeout,
       el2 ? el2.elimine.raison : '');
    ok('le fantome court : ses positions arrivent',
       r2.some(x => x.vu.autresEquipes > 50),
       r2.map(x => x.vu.autresEquipes).join(' / '));
    const t2 = r2.find(x => x.total != null)?.total ?? null;
    ok('l equipe humaine a son propre chrono', t2 != null && t2 > 30000 && t2 < 60000,
       `${t2} ms`);
    if (t2) console.log(`\n     ${(t2 / 1000).toFixed(3)} s  contre le fantome ` +
                        `${cible.equipe} a ${(cible.total_ms / 1000).toFixed(3)} s`);
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
  process.exit(e ? 1 : 0);
})().catch(x => { console.error(x); process.exit(1); });
