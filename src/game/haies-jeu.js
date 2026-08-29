/* ---------------------------------------------------------------------------
   HURDLERS — ce qui se joue entre deux haies
   ---------------------------------------------------------------------------
   La geometrie vit dans haies.js. Ici vivent les regles : combien d'appuis
   tient un intervalle, d'ou l'on doit attaquer la haie, et ce que coute une
   attaque manquee.

   Le moteur de Sprinter fait deja la moitie du travail sans le savoir. Un
   coureur y avance par appuis alternes, et taper deux fois du meme pied fait
   trebucher. C'est exactement la contrainte du hurdleur : la haie se franchit
   d'un pied donne, et le nombre d'appuis dans l'intervalle decide duquel.

   D'ou la regle qui porte les deux courses courtes :

       QUATRE APPUIS — nombre PAIR — on repart du meme pied a chaque haie.
       CINQ APPUIS   — nombre IMPAIR — on change de pied a chaque haie.

   Un athlete lent a la foulee courte, il lui faut cinq appuis la ou un rapide
   en met quatre, et il attaque alors une haie sur deux du mauvais pied. Ce
   n'est pas une penalite ajoutee sur le lent : c'est la meme penalite pour
   tout le monde, et c'est sa lenteur qui la lui fait rencontrer. C'est ce que
   demandait le cahier des charges — plus d'appuis, donc plus d'occasions de se
   tromper — mais par la cause plutot que par un malus.

   LE TOUR NE MARCHE PAS COMME CA, et il a fallu s'en rendre compte. Sur 35 m
   d'intervalle, exiger un nombre d'appuis pair rendait le jeu absurde : a
   2,20 m de foulee le rythme tombait juste, a 2,40 m il cassait, a 2,60 m il
   retombait juste. Accelerer pouvait nuire. Une regle qui punit le progres
   n'est pas une difficulte, c'est un defaut.

   Le vrai 400 m haies ne se joue pas sur la parite — les hurdleurs y courent
   a treize ou quinze foulees, l'un comme l'autre, et changent de jambe sans
   drame. Ce qui casse un 400 m haies, c'est de DEVOIR CHANGER de rythme en
   course : la fatigue raccourcit la foulee, l'intervalle ne passe plus au
   meme nombre d'appuis, et il faut se reorganiser en pleine ligne droite.
   C'est cela que le jeu fait payer sur le tour — non pas le nombre, mais le
   changement de nombre.
--------------------------------------------------------------------------- */

import { HAIES, APPUIS_IDEAL, positionsDes } from './haies.js';

/**
 * Ou l'on quitte le sol devant la haie, et ou l'on retombe derriere.
 *
 * Ces distances ne sont pas des reglages : ce sont les valeurs mesurees sur
 * des hurdleurs. Elles expliquent pourquoi la foulee entre les haies est si
 * courte — sur un intervalle de 9,14 m, l'appel et la reception en mangent
 * 3,55 a eux seuls, et il reste 5,6 m pour trois foulees. Un hurdleur ne
 * court pas comme un sprinteur : il court plus serre et plus vite en
 * frequence, et c'est tout le jeu.
 */
export const APPEL = {
  '100h': { avant: 2.00, apres: 1.05 },
  '110h': { avant: 2.15, apres: 1.40 },
  '400h': { avant: 2.15, apres: 1.20 },
};

/**
 * Ce qui fait perdre le rythme, selon l'epreuve.
 *
 * PARITE  : le pied d'appel doit revenir. C'est le jeu des courses courtes,
 *           ou l'intervalle est trop bref pour se reorganiser.
 * CONSTANCE : le nombre d'appuis ne doit pas changer d'un intervalle a
 *           l'autre. C'est le jeu du tour, ou l'on tient un rythme quarante
 *           secondes durant et ou c'est la fatigue qui vient le prendre.
 */
export const REGLE = { '100h': 'parite', '110h': 'parite', '400h': 'constance' };

/**
 * La tolerance autour du point d'appel, en metres.
 *
 * PARFAIT : on passe sans rien perdre. La zone est etroite — c'est ce qui
 * fait qu'un bon intervalle se sent.
 * BON : on passe, on gratte. La zone est large exprès : un jeu ou seul le
 * parfait paie est un jeu ou l'on subit, pas un jeu ou l'on court.
 * Au-dela : trop pres on hache la foulee, trop loin on plane. Les deux
 * coutent, et pas de la meme facon.
 */
export const TOLERANCE = { parfait: 0.30, bon: 0.75 };

/**
 * Ce que garde un coureur selon son appel, en part de sa vitesse.
 *
 * Le hache (trop pres) coute plus que le plane (trop loin) : arriver sur la
 * haie est un mur, l'aborder de loin n'est qu'un temps perdu en l'air. Un
 * hurdleur le dirait autrement — on se releve d'un appel long, on ne se releve
 * pas d'un appel court.
 */
export const GARDE = { parfait: 1, bon: 0.985, plane: 0.945, hache: 0.90 };

/**
 * Ce que coute un rythme rompu, en part de vitesse gardee.
 *
 * Le mauvais pied sur les courtes, le changement d'appuis sur le tour : deux
 * facons de perdre le fil, un seul cout. Ils meritent le meme parce qu'ils
 * font la meme chose au coureur — il arrive sur la haie sans savoir comment
 * il va la passer.
 */
export const GARDE_RYTHME_ROMPU = 0.955;

/**
 * Combien d'appuis pour couvrir un intervalle, a cette longueur de foulee.
 *
 * Le calcul porte sur la partie COURUE de l'intervalle : ni l'appel ni la
 * reception ne sont des foulees, ils sont du vol. C'est ce qui fait qu'un
 * intervalle de 9,14 m se boucle en trois foulees et non en quatre.
 */
export function appuisPour(cle, foulee) {
  const h = HAIES[cle].haies;
  const a = APPEL[cle];
  const courue = h.ecart - a.avant - a.apres;
  return 1 + Math.max(1, Math.ceil(courue / Math.max(0.85, foulee) - 1e-6));
}

/**
 * Le rythme est-il celui de l'epreuve ?
 *
 * Un nombre d'appuis PAIR ramene au meme pied d'appel a chaque haie : c'est le
 * rythme que cherche un hurdleur, et c'est celui de la cible. Un nombre IMPAIR
 * fait alterner, et alterner sur dix haies est ce qui casse les courses.
 */
export function rythmeDe(cle, appuis, precedent) {
  const ideal = APPUIS_IDEAL[cle];
  const tenu = REGLE[cle] === 'parite'
    ? appuis % 2 === ideal % 2
    : precedent === undefined || appuis === precedent;
  return { appuis, ideal, tenu, ecart: appuis - ideal, regle: REGLE[cle] };
}

/**
 * Juger un appel : a quelle distance de la haie le dernier appui est-il tombe ?
 *
 * `avant` est la distance restante devant la haie au moment de quitter le sol.
 * Positif toujours : on n'attaque pas une haie depuis derriere.
 */
export function jugerAppel(cle, avant) {
  const vise = APPEL[cle].avant;
  const ecart = avant - vise;
  const e = Math.abs(ecart);
  if (e <= TOLERANCE.parfait) return { note: 'parfait', garde: GARDE.parfait, ecart };
  if (e <= TOLERANCE.bon) return { note: 'bon', garde: GARDE.bon, ecart };
  return ecart > 0
    ? { note: 'plane', garde: GARDE.plane, ecart }
    : { note: 'hache', garde: GARDE.hache, ecart };
}

/**
 * Ce que devient la vitesse au franchissement.
 *
 * Deux causes se multiplient plutot que de s'ajouter : un mauvais pied sur un
 * appel deja hache doit couter plus que la somme des deux, parce que c'est
 * exactement la haie ou l'on tombe. Le plancher evite qu'une serie noire
 * arrete le coureur net — une course perdue reste une course.
 */
export function franchir(cle, v, avant, rythmeTenu) {
  const j = jugerAppel(cle, avant);
  const garde = j.garde * (rythmeTenu ? 1 : GARDE_RYTHME_ROMPU);
  return { ...j, rythmeTenu, v: Math.max(v * 0.55, v * garde) };
}

/**
 * De quelle part la foulee raccourcit quand la vitesse baisse.
 *
 * Recopie de strideLength() du moteur : meme amplitude, meme sinus, meme
 * plancher a 34 %. Deux modeles de foulee dans un meme jeu finiraient par
 * diverger, et c'est la course simulee qui aurait tort au moment de caler un
 * plateau.
 */
export function fouleeRelative(part) {
  const amp = a => Math.sin(Math.min(1.15, 0.70 * (0.34 + 0.66 * a)));
  return amp(Math.max(0, Math.min(1, part))) / amp(1);
}

/**
 * La course entiere, jouee par un coureur qui tient une vitesse donnee.
 *
 * Sert au calibrage : c'est ce qui dit si un plateau est atteignable avant
 * qu'un joueur y passe une soiree. La simulation ne remplace pas le jeu, mais
 * elle repond a la seule question qui compte ici — un coureur a 9,3 m/s
 * finit-il dans le plateau mondial ?
 *
 * `reprise` est la part de l'ecart a la vitesse nominale que le coureur
 * reprend dans l'intervalle suivant. C'est elle qui empeche une faute de
 * peser sur toute la course.
 *
 * `usure` est la part de vitesse perdue de la premiere haie a la derniere.
 * Sur le tour elle n'est pas un detail : c'est elle qui raccourcit la foulee,
 * fait passer l'intervalle de quatorze a quinze appuis, et declenche le
 * changement de rythme que l'epreuve fait payer. Sur les courses courtes elle
 * est presque nulle — on ne fatigue pas en treize secondes.
 */
export function simuler(cle, { vitesse, foulee, precision = 1, usure = 0, reprise = 0.55 }) {
  const positions = positionsDes(cle);
  const a = APPEL[cle];

  let v = vitesse, t = 0, d = 0, pied = 0, tenues = 0, precedent;
  const detail = [];

  for (let i = 0; i < positions.length; i++) {
    const haie = positions[i];

    // La foulee suit la vitesse SELON LA COURBE DU MOTEUR, et pas
    // proportionnellement. La difference n'est pas cosmetique : en
    // proportionnel, perdre 20 % de vitesse coutait 20 % de foulee, donc deux
    // appuis de plus, donc un rythme rompu, donc encore de la vitesse — un
    // tour de piste finissait a 68 secondes par emballement. La vraie courbe
    // rend 11 % de foulee pour 20 % de vitesse : on ralentit, on ne s'ecroule
    // pas.
    const f = foulee * fouleeRelative(v / vitesse);
    const appuis = appuisPour(cle, f);
    const r = rythmeDe(cle, appuis, precedent);

    // Sur les courtes, la parite decide du pied ; le premier appel est
    // toujours bon, on choisit sa jambe avant le depart.
    const tenu = REGLE[cle] === 'parite' ? (r.tenu || pied === 0) : r.tenu;

    // L'ecart d'appel : parfait au centre, degrade quand la precision baisse.
    // Le signe alterne pour ne pas simuler un joueur qui se trompe toujours
    // dans le meme sens — ce joueur-la n'existe pas.
    const dev = (1 - precision) * TOLERANCE.bon * 2 * (i % 2 ? 1 : -1);
    const avant = a.avant + dev;

    t += (haie - avant - d) / v;
    d = haie - avant;

    const p = franchir(cle, v, avant, tenu);
    if (p.note === 'parfait' && tenu) tenues++;
    v = p.v;
    if (REGLE[cle] === 'parite' && !r.tenu) pied = 1 - pied;
    precedent = appuis;

    // Le vol par-dessus la haie, a la vitesse de sortie.
    t += (a.avant + a.apres) / v;
    d = haie + a.apres;

    // LA REPRISE. Sans elle, chaque haie manquee retirait de la vitesse pour
    // toujours et les pertes se multipliaient : un coureur a cinq appuis
    // perdait un cinquieme de sa vitesse sur la course entiere, et deux
    // plateaux du 110 m devenaient inatteignables — il y avait un trou de
    // deux secondes entre le niveau olympique et le regional, ou aucun chrono
    // ne pouvait tomber.
    //
    // C'etait faux, et pas seulement pour le jeu : un hurdleur qui accroche
    // une haie reaccelere derriere. Ce qu'il paie, il le paie sur cet
    // intervalle-la. La faute coute donc a chaque haie, mais elle ne
    // s'installe pas.
    const nominal = vitesse * (1 - usure * (i + 1) / positions.length);
    v += (nominal - v) * reprise;

    detail.push({ haie: i + 1, appuis, note: p.note, tenu, v: +v.toFixed(2) });
  }

  const ligne = HAIES[cle].fullLap ? 400 : HAIES[cle].straight;
  t += (ligne - d) / v;
  return {
    temps: +t.toFixed(2), tenues, vFin: +v.toFixed(2),
    appuis: detail.map(x => x.appuis), detail,
  };
}
