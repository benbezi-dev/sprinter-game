// Le saut en hauteur, verifie sans le moteur : le reglement, le modele du
// franchissement, et le concours — la montee de la barre, les essais, les
// passes, les trois echecs, le departage et le barrage.
//
//   node tools/hauteur-test.mjs

import {
  MONTANTS, BARRE, TAPIS, RECORDS, progressionValide, tempsEssai, lireHauteur, cm,
} from '../src/game/hauteur.js';
import {
  VITESSE_JUSTE, vitesseUtile, impulsion, vol, plafond, instantsJustes, plafondParfait,
  meilleurAngle, sauter, sortDeLaBarre, jugerGeste, PLATEAU, pesanteurDe, CONCURRENTS,
  nouveauConcours, aQui, inscrire, avancerJusquAuJoueur, classement, joueurEnLice,
  placeDuJoueur, deciderPartage, inscrireJoueur, choisirBarre, arreter, devant, tempsDuJoueur,
  ANGLE_MIN, ANGLE_MAX, APPEL_MAXI, APPEL_MINI, ecartJuste,
} from '../src/game/hauteur-jeu.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const f2 = (x) => x.toFixed(2);
let graine = 7;
const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;

/** Le meilleur saut possible : l'appel et l'angle cherches sur une grille. */
function sautParfait(v, g = 9.81) {
  let best = { h: -9 };
  for (let ecart = 0.6; ecart <= 2.2; ecart += 0.05) {
    const m = meilleurAngle(v, ecart, g);
    if (m.h > best.h) best = { h: m.h, ecart, angle: m.angle };
  }
  return best;
}

titre('LE REGLEMENT');
ok('montants ecartes de 4,00 a 4,04 m', MONTANTS.ecart >= 4.00 && MONTANTS.ecart <= 4.04);
ok('barre de 4 m, 30 mm, fleche sous 2 cm', BARRE.longueur === 4 && BARRE.diametre === 0.03 && BARRE.fleche <= BARRE.flecheMax);
ok('tapis 6 x 4 x 0,7 m', TAPIS.largeur === 6 && TAPIS.profondeur === 4 && TAPIS.hauteur === 0.7);
ok('records : 2,45 (Sotomayor) et 2,10 (Mahuchikh)', RECORDS.hommes.m === 2.45 && RECORDS.femmes.m === 2.10);
ok('une hauteur se lit au centimetre', lireHauteur(2.3) === '2,30' && cm(2.2399999) === 224);
ok('temps : 1 min, 1 min 30 a deux ou trois, 3 min seul, 2 min de suite',
   tempsEssai(8) === 60 && tempsEssai(3) === 90 && tempsEssai(1) === 180 && tempsEssai(5, true) === 120);
ok('5, 5, 4, 3 est une montee reglementaire', progressionValide([2.10, 2.15, 2.20, 2.24, 2.27]));
ok('3 puis 4 ne l est pas', !progressionValide([2.10, 2.13, 2.17]));
ok('1 cm non plus', !progressionValide([2.10, 2.11]));
for (let i = 0; i < PLATEAU.length; i++) {
  ok(`etape ${i} : la montee est reglementaire`, progressionValide(PLATEAU[i].barres), PLATEAU[i].barres.join(' '));
}

titre('L ELAN SE CONTROLE');
ok('a la vitesse juste, tout sert', vitesseUtile(VITESSE_JUSTE) === VITESSE_JUSTE);
ok('trop vite, on perd', vitesseUtile(9.0) < vitesseUtile(8.0) && vitesseUtile(9.0) < vitesseUtile(7.5));
{
  const p8 = sautParfait(8.0), p75 = sautParfait(7.5), p7 = sautParfait(7.0), p88 = sautParfait(8.8);
  console.log(`      parfait : 7,0 m/s ${f2(p7.h)} · 7,5 ${f2(p75.h)} · 8,0 ${f2(p8.h)} · 8,8 ${f2(p88.h)}`);
  ok('record du monde a la portee du saut parfait, a peine', p8.h >= 2.455 && p8.h <= 2.52, f2(p8.h));
  ok('un demi-metre par seconde de moins coute 5 a 15 cm', p8.h - p75.h > 0.05 && p8.h - p75.h < 0.15, f2(p8.h - p75.h));
  ok('courir a 8,8 m/s coute plus qu arriver a 7,5', p88.h < p75.h + 0.01, `${f2(p88.h)} / ${f2(p75.h)}`);
  ok(`l appel juste est a ${f2(p8.ecart)} m du plan de la barre`, p8.ecart >= 0.9 && p8.ecart <= 1.8);
  ok(`l angle juste est de ${p8.angle}°`, p8.angle >= 42 && p8.angle <= 54);
  const imp = impulsion(8.0, p8.angle);
  ok(`vitesses d envol humaines : ${f2(imp.vy)} m/s vers le haut, ${f2(imp.vh)} a l horizontale`,
     imp.vy > 4.2 && imp.vy < 5.0 && imp.vh > 3.0 && imp.vh < 5.0);
}

titre('LA JAUGE DE L APPEL');
for (const g of [9.81, 7.5]) for (const v of [6.5, 7.5, 8.0, 8.8]) {
  const juste = ecartJuste(v, g);
  const a = meilleurAngle(v, juste, g).h, p = (() => { let b = -9; for (let x = 0.5; x <= 2.4; x += 0.05) b = Math.max(b, meilleurAngle(v, x, g).h); return b; })();
  ok(`g ${g}, ${v} m/s : l appel montre (${f2(juste)} m) coute moins de 2 cm (${f2(p - a)})`, p - a < 0.02);
}

titre('L ANGLE DEPEND DE L APPEL');
{
  const loin = meilleurAngle(8.0, 1.9, 9.81), pres = meilleurAngle(8.0, 0.8, 9.81);
  ok(`appel loin : plus rasant (${loin.angle}°), appel pres : plus redresse (${pres.angle}°)`, loin.angle < pres.angle);
  const m = meilleurAngle(8.0, 1.3, 9.81);
  const moins = plafondParfait(8.0, m.angle - 6, 1.3, 9.81), plus = plafondParfait(8.0, m.angle + 6, 1.3, 9.81);
  ok(`six degres de trop ou de moins coutent : ${f2(m.h - moins)} / ${f2(m.h - plus)} m`,
     m.h - moins > 0.02 && m.h - plus > 0.02);
  ok('l eventail va de 30 a 70°', ANGLE_MIN === 30 && ANGLE_MAX === 70);
  ok('la fenetre de l appel va de 30 cm a 2 m', APPEL_MINI === 0.30 && APPEL_MAXI === 2.00);
}

titre('LE FRANCHISSEMENT');
{
  const p = sautParfait(8.0);
  const V = vol(8.0, p.angle, p.ecart);
  const j = instantsJustes(V);
  const P = plafond(V, j.cambre, j.jambes);
  console.log(`      cambrure a ${f2(j.cambre)} s, jambes a ${f2(j.jambes)} s, sommet a ${f2(V.sommetT)} s`);
  ok('la cambrure vient avant les jambes', j.cambre < j.jambes);
  ok('les jambes partent quand le bassin a passe', j.jambes >= P.passages.find(x => x.cle === 'bassin').t - 1e-6);
  const sans = plafond(V, null, null).h;
  const cambreSeul = plafond(V, j.cambre, null).h;
  ok(`sans cambrure ni jambes, 15 cm de moins au moins (${f2(P.h - sans)})`, P.h - sans >= 0.15);
  ok(`cambre sans lancer les jambes : ce sont les talons (${f2(P.h - cambreSeul)})`,
     plafond(V, j.cambre, null).par === 'talons' || plafond(V, j.cambre, null).par === 'genoux');
  const tot = plafond(V, j.cambre - 0.14, j.jambes);
  ok(`cambre trop tot : les epaules plongent (${tot.par}, ${f2(P.h - tot.h)})`, tot.par === 'epaules' && tot.h < P.h - 0.02);
  const tard = plafond(V, j.cambre + 0.12, Math.max(j.jambes, j.cambre + 0.14));
  ok(`cambre trop tard : le bassin (${tard.par}, ${f2(P.h - tard.h)})`, tard.par === 'bassin' && tard.h < P.h - 0.02);
  const jTot = plafond(V, j.cambre, j.jambes - 0.10);
  ok(`jambes trop tot : le bassin retombe (${jTot.par}, ${f2(P.h - jTot.h)})`, jTot.par === 'bassin' && jTot.h < P.h - 0.03);
  const jTard = plafond(V, j.cambre, j.jambes + 0.14);
  ok(`jambes trop tard : les talons (${jTard.par}, ${f2(P.h - jTard.h)})`, (jTard.par === 'talons' || jTard.par === 'genoux') && jTard.h < P.h - 0.03);
  // un petit ecart ne doit pas etre un drame
  const presque = plafond(V, j.cambre + 0.025, j.jambes - 0.02);
  ok(`deux centiemes a cote ne coutent pas plus de 2 cm (${f2(P.h - presque.h)})`, P.h - presque.h <= 0.02);
  ok('au bon instant, c est parfait', jugerGeste(j.cambre, j.cambre, j.fenetres.cambre) === 'parfait');
  ok('pas de geste : « sans »', jugerGeste(null, j.cambre, j.fenetres.cambre) === 'sans');
  const trop = plafond(vol(8.0, p.angle, 0.45), ...(() => { const J = instantsJustes(vol(8.0, p.angle, 0.45)); return [J.cambre, J.jambes]; })());
  const tropV = vol(8.0, p.angle, 0.45);
  const tropT = trop.passages.find(x => x.cle === trop.par).t;
  ok(`appel trop pres : la barre se touche en montant (${trop.par}, a ${f2(tropT)} s, sommet a ${f2(tropV.sommetT)} s)`,
     tropT < tropV.sommetT && trop.h < P.h - 0.1);
  const V2 = vol(8.0, p.angle, 2.3), J2 = instantsJustes(V2), loin = plafond(V2, J2.cambre, J2.jambes);
  ok(`appel trop loin : le sommet tombe avant la barre (${loin.par}, ${f2(P.h - loin.h)})`, loin.h < P.h - 0.1);
}

titre('LA BARRE TOUCHEE');
ok('au-dessus de la marge : rien', !sortDeLaBarre(0.02).tombe && !sortDeLaBarre(0.02).tremble);
ok('effleuree : elle tremble et tient', !sortDeLaBarre(0.004).tombe && sortDeLaBarre(0.004).tremble);
ok('franchement dessous : elle tombe', sortDeLaBarre(-0.03).tombe);
{
  let tient = 0;
  for (let k = 0; k < 400; k++) if (!sortDeLaBarre(-0.004, alea).tombe) tient++;
  ok(`juste dessous, elle tient parfois (${tient}/400)`, tient > 60 && tient < 340);
}
{
  const p = sautParfait(8.0);
  const V = vol(8.0, p.angle, p.ecart), j = instantsJustes(V);
  const r = sauter({ vElan: 8.0, ecart: p.ecart, angle: p.angle, tCambre: j.cambre, tJambes: j.jambes, hauteur: 2.45 });
  ok(`2,45 franchi au saut parfait (marge ${f2(r.marge)})`, r.franchi && r.cambre === 'parfait' && r.jambes === 'parfait');
  const r2 = sauter({ vElan: 8.0, ecart: p.ecart, angle: p.angle, hauteur: 2.30 });
  ok(`2,30 sans geste en l air : barre tombee, par ${r2.par}`, !r2.franchi && r2.tContact > 0);
}

titre('LA STATION INTERGALACTIQUE');
{
  const g = pesanteurDe(5);
  const p = sautParfait(8.0, g);
  ok(`pesanteur de la station : ${g} m/s²`, g < 9.81 && g > 6);
  ok(`le saut parfait y passe ${f2(p.h)} m, au-dessus du plateau (${PLATEAU[5].niveaux[1]})`, p.h >= PLATEAU[5].niveaux[1] + 0.03);
  const V = vol(8.0, p.angle, p.ecart, g);
  ok('et le vol dure plus longtemps', V.sommetT > vol(8.0, p.angle, p.ecart).sommetT);
}

titre('LE CONCOURS : LA MONTEE, LES ESSAIS, LES PASSES');
const NOMS = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fox', 'Gus', 'Hal', 'Ivo', 'Jo', 'Kai'];
{
  graine = 11;
  const c = nouveauConcours({ etape: 3, noms: NOMS, alea, joueur: 'TOI' });
  ok(`douze au championnat du monde (${c.athletes.length})`, c.athletes.length === CONCURRENTS[3]);
  // Le joueur passe tout jusqu'a 2,30, puis franchit au premier essai jusqu'a 2,36.
  let tours = 0;
  while (!c.fini && !c.partage && tours++ < 500) {
    avancerJusquAuJoueur(c, alea);
    const i = aQui(c);
    if (i === null) break;
    if (c.h < 2.30) inscrire(c, i, '-');
    else if (c.h <= 2.36) inscrire(c, i, 'o');
    else inscrire(c, i, 'x');
  }
  const moi = c.athletes[0];
  ok('le joueur a passe les premieres barres', moi.feuille[cm(2.14)] === '-' && moi.feuille[cm(2.27)] === '-');
  ok('trois echecs de suite eliminent', moi.elimine && Object.values(moi.feuille).join('').endsWith('xxx'));
  ok('le concours finit', c.fini || !!c.partage);
  const cl = classement(c);
  ok('le classement a une place par athlete', cl.length === c.athletes.length);
  const moiCl = cl.find(l => l.joueur);
  ok(`2,36 au premier essai, 3 echecs au-dessus qui ne comptent pas : place ${moiCl.place}`,
     moiCl.meilleur === 2.36 && moiCl.essais === 1 && moiCl.echecs === 0);
  const adv = c.athletes.slice(1);
  ok('chaque adversaire a saute ou passe quelque chose', adv.every(a => Object.keys(a.feuille).length > 0));
  ok('un adversaire entre sous son niveau, jamais au-dessus du programme',
     adv.every(a => a.entree < a.niveau));
}
{
  // passer apres un echec : les essais se reportent
  graine = 3;
  const c = nouveauConcours({ etape: 1, noms: NOMS.slice(0, 7), alea, joueur: 'TOI' });
  const j = 0;
  let vu = false;
  for (let k = 0; k < 400 && !c.fini && !c.partage; k++) {
    avancerJusquAuJoueur(c, alea);
    const i = aQui(c); if (i === null) break;
    if (c.h < 1.93) inscrire(c, i, 'o');
    else if (c.h === 1.93 && !c.athletes[j].feuille[193]) inscrire(c, i, 'x');
    else if (c.h === 1.93) { inscrire(c, i, '-'); vu = true; }
    else inscrire(c, i, 'x');
  }
  const f = c.athletes[j].feuille;
  ok('« x- » : un echec, puis la barre passee', vu && f[193] === 'x-');
  ok('il ne reste que deux essais a la barre suivante', f[196] === 'xx' && c.athletes[j].elimine);
}

titre('LE DEPARTAGE');
{
  const A = (feuille) => ({ feuille, joueur: false, elimine: true });
  const a = A({ 220: 'o', 224: 'xo', 227: 'xxx' });
  const b = A({ 220: 'xo', 224: 'o', 227: 'xxx' });
  const c2 = A({ 220: 'o', 224: 'xxo', 227: 'xxx' });
  ok('a meme barre, le moins d essais a cette barre passe devant', devant(b, a) < 0 && devant(a, c2) < 0);
  const d = A({ 220: 'xo', 224: 'xo', 227: 'xxx' });
  ok('puis le moins d echecs jusqu a elle', devant(a, d) < 0);
  const f = A({ 220: 'o', 224: 'xo', 227: 'xxx', 230: '' });
  ok('les echecs au-dessus ne comptent pas', devant(a, f) === 0);
}
{
  // Deux ex aequo pour l'or, dont le joueur : il choisit. Partage, puis barrage.
  for (const barrage of [false, true]) {
    graine = 5;
    const c = nouveauConcours({ etape: 0, noms: ['Rival'], alea, joueur: 'TOI' });
    const r = c.athletes[1];
    r.forme = 1.60; r.entree = 1.30;
    c.ordre = [1, 0];
    // les deux passent 1,30 a 1,50 au premier essai, puis manquent tout
    let garde = 0;
    while (!c.fini && !c.partage && garde++ < 100) {
      const i = aQui(c); if (i === null) break;
      inscrire(c, i, c.h <= 1.50 ? 'o' : 'x');
    }
    ok(`ex aequo parfaits : le joueur est interroge (${barrage ? 'barrage' : 'partage'})`, !!c.partage && !c.fini);
    deciderPartage(c, barrage);
    if (!barrage) {
      const cl = classement(c);
      ok('partage : deux premiers', cl.filter(l => l.place === 1).length === 2 && c.fini);
    } else {
      ok(`barrage a ${lireHauteur(c.h)}, la barre au-dessus`, c.barrage && c.h === 1.55);
      // le rival manque, le joueur passe : le joueur gagne
      r.forme = 0;
      let g2 = 0;
      while (!c.fini && g2++ < 20) {
        const f = avancerJusquAuJoueur(c, alea);
        if (c.fini) break;
        const i = aQui(c); if (i === null) break;
        inscrireJoueur(c, 'o');
        void f;
      }
      const cl = classement(c);
      ok('barrage gagne : seul premier', c.fini && cl[0].joueur && cl[0].place === 1 && cl[1].place === 2, JSON.stringify(cl.map(l => [l.nom, l.place])));
    }
  }
}
{
  // Tout le monde manque au barrage : la barre descend.
  graine = 9;
  const c = nouveauConcours({ etape: 0, noms: ['Rival'], alea, joueur: 'TOI' });
  const r = c.athletes[1];
  r.forme = 1.60; r.entree = 1.30; c.ordre = [0, 1];
  let garde = 0;
  while (!c.fini && !c.partage && garde++ < 100) { const i = aQui(c); if (i === null) break; inscrire(c, i, c.h <= 1.45 ? 'o' : 'x'); }
  deciderPartage(c, true);
  const h0 = c.h;
  r.forme = 0;
  inscrireJoueur(c, 'x');
  avancerJusquAuJoueur(c, alea);
  ok(`personne ne passe : la barre descend de 2 cm (${lireHauteur(h0)} -> ${lireHauteur(c.h)})`, cm(c.h) === cm(h0) - 2);
}
{
  // Seul et vainqueur : le joueur choisit sa barre, puis s'arrete.
  graine = 21;
  const c = nouveauConcours({ etape: 3, noms: NOMS, alea, joueur: 'TOI' });
  for (const a of c.athletes.slice(1)) { a.forme = 2.20; }
  let garde = 0, libre = false;
  while (!c.fini && !c.partage && garde++ < 800) {
    avancerJusquAuJoueur(c, alea);
    const i = aQui(c); if (i === null) break;
    if (c.libre) {
      libre = true;
      if (c.h < 2.46) { choisirBarre(c, 2.46); continue; }
      arreter(c, 0);
      continue;
    }
    inscrire(c, i, 'o');
  }
  ok('seul et vainqueur, le joueur choisit sa barre', libre && c.athletes[0].feuille[246] === undefined && c.fini);
  ok('et finit premier', placeDuJoueur(c) === 1);
  ok('seul en lice : trois minutes', tempsDuJoueur({ ...c, athletes: [c.athletes[0]], dernierSauteur: null }) === 180);
}

titre('LES PLATEAUX');
{
  // Un joueur moyen : un bon elan, l'appel a 20 cm pres, l'angle a 3 degres,
  // les gestes a 3 centiemes. Il doit gagner a l'ecole, pas au monde.
  const niveau = (etape, bruit) => {
    const g = pesanteurDe(etape);
    const p = sautParfait(8.0 - bruit.v, g);
    const V = vol(8.0 - bruit.v, p.angle + bruit.a, p.ecart + bruit.d, g);
    const j = instantsJustes(V);
    return plafond(V, j.cambre + bruit.t, j.jambes - bruit.t).h;
  };
  const moyen = { v: 0.4, a: 3, d: 0.2, t: 0.03 };
  const bon = { v: 0.15, a: 1.5, d: 0.08, t: 0.015 };
  for (let k = 0; k < 6; k++) {
    const hm = niveau(k, moyen), hb = niveau(k, bon);
    const [lo, hi] = PLATEAU[k].niveaux;
    console.log(`      etape ${k} : plateau ${f2(lo)}-${f2(hi)} · joueur moyen ${f2(hm)} · bon ${f2(hb)}`);
  }
  ok('le joueur moyen domine l ecole', niveau(0, moyen) > PLATEAU[0].niveaux[1] + 0.2);
  ok('le joueur moyen ne gagne pas le championnat du monde', niveau(3, moyen) < PLATEAU[3].niveaux[1]);
  ok('le bon joueur y joue la medaille', niveau(3, bon) > PLATEAU[3].niveaux[0] + 0.05);
  ok('la station intergalactique demande le meilleur', niveau(5, bon) < PLATEAU[5].niveaux[1] + 0.03);
}

console.log(e ? `\n   ${e} ECHEC(S)\n` : '\n──────────────────────────────────────────────────────────────\n   TOUT PASSE.\n');
process.exit(e ? 1 : 0);
