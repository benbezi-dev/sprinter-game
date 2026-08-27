// Quatre joueurs, une salle, un 4x100 de bout en bout.
//
// Chaque client simule un relayeur : il court a vitesse constante, s'elance
// quand le porteur approche, et touche le temoin quand ils sont cote a cote.
const BASE = process.env.BASE || 'ws://127.0.0.1:8788';
const EQUIPE = process.argv[2] || 'PU8G2Z';
const MARQUE = Number(process.argv[3] ?? 0);
const AVANCE = Number(process.argv[4] ?? 10);
const t00 = Date.now();
const LEG = 100;

function joueur(nom) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE}/relay/room/${EQUIPE}?name=${encodeURIComponent(nom)}`);
    const dire = m => console.log(`[${nom.padEnd(5)}] +${String(Date.now() - t00).padStart(6)}ms  ${m}`);
    const envoyer = o => { try { ws.send(JSON.stringify(o)); } catch { } };

    let moi = 0, offset = 0, zone = null, timer = null;
    let dMoi = 0, cours = false, porteur = 1, fini = false, touche = false;
    const pos = {};                       // position des autres, par relais

    ws.onopen = () => envoyer({ t: 'ping', a: Date.now() });
    ws.onerror = () => reject(new Error(nom + ' : socket'));
    ws.onclose = () => { clearInterval(timer); resolve(nom); };

    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      switch (m.t) {
        case 'pong': {
          const rtt = Date.now() - m.a;
          offset = m.serveur - (m.a + rtt / 2);
          envoyer({ t: 'pret', pret: true });
          return;
        }
        case 'bienvenue':
          moi = m.relais; zone = m.zone;
          dMoi = zone ? zone.debut + MARQUE : 0;
          dire(`relais ${moi}` + (zone ? ` — zone ${zone.debut}-${zone.fin} m, marque a ${dMoi} m` : ' — depart arrete'));
          if (zone) envoyer({ t: 'marque', d: dMoi });
          return;
        case 'salle':
          porteur = m.porteur;
          if (m.depart_a && !timer) {
            const dans = m.depart_a - (Date.now() + offset);
            dire(`pistolet dans ${Math.round(dans)} ms`);
            setTimeout(() => { if (moi === 1) cours = true; boucle(); }, Math.max(0, dans));
          }
          return;
        case 'pos':
          pos[m.relais] = m.d;
          return;
        case 'passe':
          dire(`passage vers relais ${m.relais} a ${m.a} m (${m.dans_zone} m dans la zone, ecart ${m.ecart} ms)`);
          porteur = m.relais;
          touche = false;
          return;
        case 'elimine':
          dire(`*** ELIMINEE : ${m.raison} (relais ${m.relais}) ***`);
          setTimeout(() => ws.close(), 250);
          return;
        case 'fini':
          dire(`ARRIVEE — ${(m.total / 1000).toFixed(3)} s`);
          setTimeout(() => ws.close(), 350);
          return;
      }
    };

    function boucle() {
      const t0 = Date.now();
      let depart = null;                 // quand CE relayeur s'est elance
      timer = setInterval(() => {
        if (fini) return;

        // Le receveur s'elance quand le porteur arrive a portee.
        if (!cours && moi > 1 && pos[moi - 1] != null && dMoi - pos[moi - 1] <= AVANCE) {
          cours = true; depart = Date.now();
          dire(`je m'elance (porteur a ${(dMoi - pos[moi - 1]).toFixed(1)} m)`);
        }

        if (cours) {
          // La montee en vitesse part du moment ou l'on s'elance, pas du coup
          // de pistolet : sinon le receveur demarre a pleine vitesse et le
          // porteur ne le rattrape jamais.
          if (depart === null) depart = t0;
          const lance = Math.min(1, (Date.now() - depart) / 1600 + 0.15);
          dMoi += 11.2 * 0.05 * lance;
          envoyer({ t: 'pos', d: dMoi });
        }

        // Cote a cote : les deux touchent. Le porteur regarde le receveur,
        // le receveur regarde le porteur — chacun sur la position de l'autre.
        if (!touche) {
          const autre = moi === porteur ? pos[moi + 1] : (moi === porteur + 1 ? pos[moi - 1] : null);
          if (autre != null && Math.abs(dMoi - autre) < 1.2) {
            touche = true;
            envoyer({ t: 'temoin' });
          }
        }

        if (moi === 4 && cours && dMoi >= 400 && !fini) {
          fini = true;
          envoyer({ t: 'fini', ms: Date.now() - t0 });
          clearInterval(timer);
        }
      }, 50);
    }
  });
}

setTimeout(() => { console.log('--- delai global'); process.exit(1); }, 60000);
await Promise.all([joueur('Ana'), joueur('Bob'), joueur('Carl'), joueur('Dana')]);
console.log('--- termine');
process.exit(0);
