// Les deux couches du classement, mises a l'epreuve sans rien monter.
//
// C'est le genre d'endroit ou une erreur ne se voit pas. Un gain de
// vingt-trois points au lieu de vingt-cinq ressemble a un gain de vingt-cinq ;
// un MMR qui monte de six au lieu de douze ressemble a un MMR qui monte. Les
// deux se decouvriraient six mois plus tard, sur un classement devenu faux
// sans que personne puisse dire quand.
//
// On verifie donc les proprietes, pas seulement les nombres : que battre plus
// fort que soi rapporte plus, que l'avantage du releveur soit dans la
// prediction et non dans la recompense, et qu'on ne puisse pas descendre
// eternellement.

import {
  ETAGES, DIVISIONS, LEGENDE, PALIER_MAX, LP_PAR_PALIER, rangDe,
  MMR_DEPART, AVANTAGE_RELEVEUR, facteurK, esperance, majMmr,
  LP, mmrAttendu, modulation, gainLp, BOUCLIER, appliquerLp,
  appliquerDuelAuClassement,
} from '../worker/src/classement.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/** Un joueur neuf, au bas de l'echelle. */
const neuf = (o = {}) => ({ mmr: MMR_DEPART, duels: 50, palier: 0, lp: 0, bouclier: 0, ...o });

/* ------------------------------------------------------------------ l'echelle */

titre("L'ECHELLE");

ok('le premier palier est departemental IV',
   rangDe(0).etage === 'departemental' && rangDe(0).division === 4,
   JSON.stringify(rangDe(0)));
ok('la division compte a l envers : I est la sortie',
   rangDe(3).division === 1 && rangDe(3).etage === 'departemental',
   JSON.stringify(rangDe(3)));
ok('le palier suivant change d etage',
   rangDe(4).etage === 'regional' && rangDe(4).division === 4,
   JSON.stringify(rangDe(4)));
ok('legende n a pas de division',
   rangDe(LEGENDE).etage === 'legende' && rangDe(LEGENDE).division === 0,
   JSON.stringify(rangDe(LEGENDE)));
ok('on ne depasse pas legende',
   rangDe(99).palier === LEGENDE && rangDe(-5).palier === 0);
ok('quatre etages de quatre divisions, plus le sommet',
   ETAGES.length * DIVISIONS === LEGENDE && PALIER_MAX === LEGENDE);

/* ---------------------------------------------------------------------- MMR */

titre('LE MMR, ET CE QU IL MESURE');

ok('a force egale et sans role, la prediction est de moitie',
   Math.abs(esperance(1200, 1200) - 0.5) < 1e-9);
ok('quatre cents points d ecart valent une chance sur dix',
   Math.abs(esperance(1200, 1600) - 0.0909) < 0.001,
   esperance(1200, 1600).toFixed(4));
ok('le K decroit avec l experience',
   facteurK(0) > facteurK(20) && facteurK(20) > facteurK(50) && facteurK(50) > facteurK(500),
   [0, 20, 50, 500].map(facteurK).join(' > '));

// 1. Victoire du lanceur contre un releveur de meme niveau.
const egalLanceur = majMmr({ mmrLanceur: 1200, mmrReleveur: 1200,
                             duelsLanceur: 50, duelsReleveur: 50, issue: 'challenger' });
ok('le lanceur qui gagne contre son egal monte',
   egalLanceur.delta_lanceur > 0 && egalLanceur.delta_releveur < 0,
   `${egalLanceur.delta_lanceur} / ${egalLanceur.delta_releveur}`);
ok('le MMR ne se cree pas : ce que l un prend, l autre le perd',
   egalLanceur.delta_lanceur + egalLanceur.delta_releveur === 0,
   `${egalLanceur.delta_lanceur} + ${egalLanceur.delta_releveur}`);

// 2. Victoire du releveur, meme niveau : il etait favori, il gagne moins.
const egalReleveur = majMmr({ mmrLanceur: 1200, mmrReleveur: 1200,
                              duelsLanceur: 50, duelsReleveur: 50, issue: 'opponent' });
ok('l avantage du releveur est dans la prediction, pas dans la recompense',
   egalReleveur.delta_releveur < egalLanceur.delta_lanceur,
   `releveur ${egalReleveur.delta_releveur} < lanceur ${egalLanceur.delta_lanceur}`);
ok('le releveur est bien donne favori a force egale',
   egalLanceur.esperance_lanceur < 0.5,
   egalLanceur.esperance_lanceur.toFixed(4));
ok('l avantage vaut ce qu on a dit, et rien de plus',
   Math.abs(egalLanceur.esperance_lanceur - esperance(1200, 1200 + AVANTAGE_RELEVEUR)) < 1e-9);

// 3. L outsider bat le cador.
const surprise = majMmr({ mmrLanceur: 900, mmrReleveur: 1700,
                          duelsLanceur: 50, duelsReleveur: 50, issue: 'challenger' });
ok('battre bien plus fort que soi rapporte beaucoup',
   surprise.delta_lanceur > egalLanceur.delta_lanceur * 1.8,
   `${surprise.delta_lanceur} contre ${egalLanceur.delta_lanceur} entre egaux`);
const attendu = majMmr({ mmrLanceur: 1700, mmrReleveur: 900,
                         duelsLanceur: 50, duelsReleveur: 50, issue: 'challenger' });
ok('gagner comme prevu ne rapporte presque rien',
   attendu.delta_lanceur < 3, String(attendu.delta_lanceur));
ok('le cador qui tombe paie cher',
   surprise.delta_releveur < -15, String(surprise.delta_releveur));
ok('un debutant bouge plus vite qu un habitue',
   majMmr({ mmrLanceur: 1200, mmrReleveur: 1200, duelsLanceur: 0,
            duelsReleveur: 50, issue: 'challenger' }).delta_lanceur >
   egalLanceur.delta_lanceur);
ok('le MMR ne descend pas sous son plancher',
   majMmr({ mmrLanceur: 100, mmrReleveur: 2400, duelsLanceur: 0,
            duelsReleveur: 0, issue: 'opponent' }).lanceur >= 100);

// Un nul laisse les deux ou ils sont, ou presque.
const nul = majMmr({ mmrLanceur: 1200, mmrReleveur: 1200,
                     duelsLanceur: 50, duelsReleveur: 50, issue: 'draw' });
ok('un nul entre egaux ne deplace presque rien',
   Math.abs(nul.delta_lanceur) <= 1 && Math.abs(nul.delta_releveur) <= 1,
   `${nul.delta_lanceur} / ${nul.delta_releveur}`);

/* ---------------------------------------------------------- points de ligue */

titre('LES POINTS DE LIGUE');

const aSaPlace = mmrAttendu(4);   // un joueur pile au niveau de sa division

ok('a sa place, le releveur gagne plus que le lanceur',
   gainLp({ role: 'releveur', issue: 'opponent', mmr: aSaPlace, palier: 4 }) >
   gainLp({ role: 'lanceur', issue: 'challenger', mmr: aSaPlace, palier: 4 }),
   `${gainLp({ role: 'releveur', issue: 'opponent', mmr: aSaPlace, palier: 4 })} contre ` +
   `${gainLp({ role: 'lanceur', issue: 'challenger', mmr: aSaPlace, palier: 4 })}`);
ok('a sa place, le bareme est celui annonce',
   gainLp({ role: 'releveur', issue: 'opponent', mmr: aSaPlace, palier: 4 }) === LP.releveur.victoire &&
   gainLp({ role: 'lanceur', issue: 'challenger', mmr: aSaPlace, palier: 4 }) === LP.lanceur.victoire);
ok('le lanceur qui tombe perd plus que le releveur qui tombe',
   gainLp({ role: 'lanceur', issue: 'opponent', mmr: aSaPlace, palier: 4 }) <
   gainLp({ role: 'releveur', issue: 'challenger', mmr: aSaPlace, palier: 4 }));
ok('un nul ne donne rien, quel que soit le role',
   gainLp({ role: 'lanceur', issue: 'draw', mmr: aSaPlace, palier: 4 }) === 0 &&
   gainLp({ role: 'releveur', issue: 'draw', mmr: aSaPlace, palier: 4 }) === 0);
ok('lancer un defi ne figure pas ici : seul un duel tranche donne des points',
   gainLp({ role: 'lanceur', issue: 'draw', mmr: aSaPlace, palier: 0 }) === 0);

ok('trop fort pour sa division, on monte plus vite',
   gainLp({ role: 'lanceur', issue: 'challenger', mmr: aSaPlace + 300, palier: 4 }) >
   gainLp({ role: 'lanceur', issue: 'challenger', mmr: aSaPlace, palier: 4 }));
ok('trop fort pour sa division, on descend moins vite',
   gainLp({ role: 'lanceur', issue: 'opponent', mmr: aSaPlace + 300, palier: 4 }) >
   gainLp({ role: 'lanceur', issue: 'opponent', mmr: aSaPlace, palier: 4 }));
ok('la modulation est bornee des deux cotes',
   modulation(aSaPlace + 5000, 4, true) <= 1.6 && modulation(aSaPlace - 5000, 4, true) >= 0.5);

/* ------------------------------------------------ promotions et relegations */

titre('MONTER, DESCENDRE');

// 4. Promotion au franchissement du seuil.
const promu = appliquerLp({ palier: 2, lp: 85, bouclier: 0, delta: 25 });
ok('on change de division en depassant cent points',
   promu.palier === 3 && promu.monte === 1, JSON.stringify(promu));
ok('les points en trop suivent : gagner de justesse et gagner large different',
   promu.lp === 10, String(promu.lp));
ok('une promotion arme le bouclier', promu.bouclier === BOUCLIER);

const etage = appliquerLp({ palier: 3, lp: 95, bouclier: 0, delta: 20 });
ok('la derniere division mene a l etage suivant',
   rangDe(etage.palier).etage === 'regional' && rangDe(etage.palier).division === 4,
   JSON.stringify(rangDe(etage.palier)));

const bond = appliquerLp({ palier: 0, lp: 0, bouclier: 0, delta: 350 });
ok('un apport enorme fait franchir plusieurs paliers d un coup',
   bond.palier === 3 && bond.lp === 50 && bond.monte === 3, JSON.stringify(bond));

ok('legende accumule au lieu de monter',
   appliquerLp({ palier: LEGENDE, lp: 340, bouclier: 0, delta: 25 }).palier === LEGENDE &&
   appliquerLp({ palier: LEGENDE, lp: 340, bouclier: 0, delta: 25 }).lp === 365);

// Le bouclier tient deux defaites, puis cede.
let etat = { palier: 5, lp: 0, bouclier: BOUCLIER };
const suite = [];
for (let i = 0; i < 3; i++) {
  etat = appliquerLp({ ...etat, delta: -25 });
  suite.push(`${etat.palier}@${etat.lp}`);
}
ok('le bouclier absorbe deux defaites avant la descente',
   suite[0] === '5@0' && suite[1] === '5@0' && suite[2] === '4@75',
   suite.join(' → '));
ok('on ne descend pas sous le premier palier',
   appliquerLp({ palier: 0, lp: 5, bouclier: 0, delta: -80 }).palier === 0 &&
   appliquerLp({ palier: 0, lp: 5, bouclier: 0, delta: -80 }).lp === 0);

/* --------------------------------------------------------- les deux couches */

titre('LES DEUX COUCHES ENSEMBLE');

const duel = appliquerDuelAuClassement({
  lanceur: neuf({ mmr: 1200, palier: 4, lp: 90 }),
  releveur: neuf({ mmr: 1200, palier: 4, lp: 50 }),
  issue: 'opponent',
});
ok('un duel bouge les deux couches a la fois',
   duel.releveur.delta_lp > 0 && duel.releveur.delta_mmr > 0 &&
   duel.lanceur.delta_lp < 0 && duel.lanceur.delta_mmr < 0,
   `releveur ${duel.releveur.delta_lp} lp / ${duel.releveur.delta_mmr} mmr`);

// La modulation doit lire le MMR d'AVANT le duel : sinon la victoire
// compterait deux fois, une fois dans le MMR et une fois dans la montee.
const avant = neuf({ mmr: 1200, palier: 4, lp: 0 });
const attendus = gainLp({ role: 'releveur', issue: 'opponent', mmr: avant.mmr, palier: avant.palier });
const obtenus = appliquerDuelAuClassement({
  lanceur: neuf({ mmr: 1200, palier: 4 }), releveur: { ...avant }, issue: 'opponent',
}).releveur.delta_lp;
ok('la montee se calcule sur le MMR d avant, pas sur celui d apres',
   obtenus === attendus, `${obtenus} contre ${attendus}`);

// Un outsider qui gagne : gros gain de MMR, et montee acceleree.
const outsider = appliquerDuelAuClassement({
  lanceur: neuf({ mmr: 1500, palier: 8, lp: 40 }),
  releveur: neuf({ mmr: 950, palier: 2, lp: 40 }),
  issue: 'opponent',
});
ok('l outsider qui gagne prend beaucoup de MMR',
   outsider.releveur.delta_mmr >= 15, String(outsider.releveur.delta_mmr));

// Un joueur tres au-dessus de sa division traverse l echelle.
let grimpe = neuf({ mmr: 1600, palier: 0, lp: 0 });
for (let i = 0; i < 6; i++) {
  const r = appliquerDuelAuClassement({
    lanceur: neuf({ mmr: 1000 }), releveur: grimpe, issue: 'opponent',
  }).releveur;
  grimpe = { ...grimpe, palier: r.palier, lp: r.lp, bouclier: r.bouclier };
}
ok('un joueur trop fort pour sa division la quitte vite',
   grimpe.palier >= 2, `palier ${grimpe.palier} apres six duels`);

titre('LA COURSE EN DIRECT N A PAS DE ROLES');
// Tout le bareme des roles repose sur une chose : le chrono du lanceur est
// pose, et celui qui releve sait ce qu'il doit battre. En direct, les deux
// partent au meme coup de pistolet et personne ne connait l'issue. Ce qui se
// verifie ici n'est donc pas un chiffre mais une propriete : le resultat ne
// doit pas dependre de qui a ouvert la piste.

ok('les deux roles sont payes pareil en direct',
   LP.direct.victoire === -LP.direct.defaite,
   `${LP.direct.victoire} / ${LP.direct.defaite}`);
// L amplitude — ce qui separe une victoire d une defaite — ne doit pas
// s ecarter de celle des roles : le direct ne choisit pas de camp, il ne
// devient pas pour autant un mode ou l on gagne moins ou plus.
const ampleDirect = LP.direct.victoire - LP.direct.defaite;
const ampleRoles = (LP.lanceur.victoire - LP.lanceur.defaite
                  + LP.releveur.victoire - LP.releveur.defaite) / 2;
ok('et une course en direct pese autant qu un defi differe',
   Math.abs(ampleDirect - ampleRoles) <= 1, `${ampleDirect} vs ${ampleRoles}`);

// A rang egal, la victoire du lanceur et celle du releveur se valent.
const vLanceur = gainLp({ role: 'lanceur', issue: 'challenger',
                          mmr: MMR_DEPART, palier: 3, direct: true });
const vReleveur = gainLp({ role: 'releveur', issue: 'opponent',
                           mmr: MMR_DEPART, palier: 3, direct: true });
ok('gagner en ayant ouvert la piste vaut gagner en l ayant rejointe',
   vLanceur === vReleveur, `${vLanceur} vs ${vReleveur}`);
const dLanceur = gainLp({ role: 'lanceur', issue: 'opponent',
                          mmr: MMR_DEPART, palier: 3, direct: true });
const dReleveur = gainLp({ role: 'releveur', issue: 'challenger',
                           mmr: MMR_DEPART, palier: 3, direct: true });
ok('et perdre coute la meme chose des deux cotes',
   dLanceur === dReleveur, `${dLanceur} vs ${dReleveur}`);
ok('le bareme des roles reste asymetrique, lui',
   gainLp({ role: 'lanceur', issue: 'challenger', mmr: MMR_DEPART, palier: 3 })
     !== gainLp({ role: 'releveur', issue: 'opponent', mmr: MMR_DEPART, palier: 3 }));

// L avantage du releveur sort de la prediction, puisqu il n a plus lieu.
const enDirect = majMmr({
  mmrLanceur: MMR_DEPART, mmrReleveur: MMR_DEPART,
  duelsLanceur: 50, duelsReleveur: 50, issue: 'draw', direct: true,
});
ok('a force egale et en direct, le modele ne designe pas de favori',
   Math.abs(enDirect.esperance_lanceur - 0.5) < 1e-9,
   String(enDirect.esperance_lanceur));
const enDiffere = majMmr({
  mmrLanceur: MMR_DEPART, mmrReleveur: MMR_DEPART,
  duelsLanceur: 50, duelsReleveur: 50, issue: 'draw',
});
ok('alors qu il en designe un sur un defi differe',
   enDiffere.esperance_lanceur < 0.5 && AVANTAGE_RELEVEUR > 0,
   String(enDiffere.esperance_lanceur));

// Et de bout en bout : deux joueurs identiques, la meme course lue des deux
// cotes. Ce que l un gagne quand il ouvre, l autre le gagne quand il rejoint.
const parLHote = appliquerDuelAuClassement({
  lanceur: neuf({ palier: 4, lp: 30 }), releveur: neuf({ palier: 4, lp: 30 }),
  issue: 'challenger', direct: true,
});
const parLInvite = appliquerDuelAuClassement({
  lanceur: neuf({ palier: 4, lp: 30 }), releveur: neuf({ palier: 4, lp: 30 }),
  issue: 'opponent', direct: true,
});
ok('une piste en direct ne taxe pas celui qui l a ouverte',
   parLHote.lanceur.delta_lp === parLInvite.releveur.delta_lp &&
   parLHote.releveur.delta_lp === parLInvite.lanceur.delta_lp,
   `${parLHote.lanceur.delta_lp}/${parLInvite.releveur.delta_lp}`);
// Le contre-exemple : sans « direct », l hote perd a chaque revanche.
const sansDirect = appliquerDuelAuClassement({
  lanceur: neuf({ palier: 4, lp: 30 }), releveur: neuf({ palier: 4, lp: 30 }),
  issue: 'challenger',
});
ok('sans direct, la meme course n aurait pas paye pareil',
   sansDirect.lanceur.delta_lp !== parLHote.lanceur.delta_lp,
   `${sansDirect.lanceur.delta_lp} vs ${parLHote.lanceur.delta_lp}`);

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
