// LE CARTON DE FIN : la derniere seconde et demie du film.
//
// La video de la course sortait sur la ligne d'arrivee et s'arretait la. Elle
// partait ensuite dans une conversation, une story, un fil — et rien dedans ne
// disait a quoi on venait d'assister. Celui qui la recevait voyait courir un
// bonhomme, trouvait ca joli, et n'avait AUCUN moyen d'aller courir a son tour :
// ni le nom du jeu, ni son adresse, ni le chrono qu'il faudrait battre.
//
// C'est ce que ce fichier repare. Une seconde et demie de plus a la fin du
// film, ou l'image se voile et ou tiennent les quatre choses qui manquaient :
//
//   LE CHRONO, en grand, parce que c'est lui l'enjeu et qu'il se lit d'un
//     coup d'oeil sur un ecran de telephone tenu a bout de bras ;
//   L'EPREUVE et LE NOM, parce qu'un chrono seul ne veut rien dire — 9,12 s
//     sur 100 m et 9,12 s sur 400 m ne racontent pas la meme histoire ;
//   LE CODE DU DEFI, quand il y en a un : celui qui regarde peut alors courir
//     EXACTEMENT la meme course, contre le meme fantome ;
//   L'ADRESSE, une fois, en bas a droite, sans point d'exclamation.
//
// CE QU'IL NE FAIT PAS, ET C'EST VOULU. Pas de « abonne-toi », pas de « lien
// en bio », pas de logo qui tourne. La charte de communication bannit ces
// formes (§1.4) et elle a raison ici plus qu'ailleurs : le carton se regarde
// une seconde et demie, apres une course qu'on vient de gagner ou de perdre.
// Un chrono et une adresse suffisent a donner envie ; une reclame, elle, fait
// passer le film entier pour une publicite — et personne ne partage une
// publicite.
//
// LE CODE ARRIVE EN RETARD, ET LE CARTON L'ATTEND SANS BOUGER. Un defi s'ecrit
// sur le serveur ; `defi-camera.ts` le pose a l'instant ou la camera
// s'arrete, et la reponse met le temps qu'elle met. Le carton, lui, commence a
// se peindre tout de suite.
//
// D'ou la place gardee. Des qu'un code est ATTENDU, sa pastille compte dans la
// hauteur du bloc, meme vide : sans cela le bloc serait centre sans elle, puis
// recentre avec, et tout sauterait d'un cran a l'instant ou le code se pose —
// au milieu d'un film qu'on ne peut plus remonter. La pastille apparait donc
// en fondu, a sa place, et rien d'autre ne bouge.
//
// Et s'il n'arrive pas — hors ligne, serveur muet, course qui ne peut pas
// faire un defi — le carton sort avec le chrono et l'adresse. Il se tait
// plutot que d'inventer un code qui n'ouvrirait rien.

import { SprinterApp } from './engine';
import { getSavedName } from './leaderboard';
import { defiDeLaCamera, type DefiDeLaCamera } from './defi-camera';
import {
  CYAN, TEXTE, SOURDINE, NUIT, AFFICHE, CHIFFRES,
  ecrire, largeur, tailler,
} from './pinceau-film';

/**
 * L'ADRESSE, ECRITE EN DUR.
 *
 * Et surtout pas `window.location.host`. Le jeu tourne a trois endroits — le
 * site, une page GitHub Pages, et une WebView d'application ou l'hote est un
 * `capacitor://localhost` qui ne mene nulle part. Le carton s'adresse a
 * quelqu'un qui n'a PAS le jeu : il lui faut la porte d'entree, la meme pour
 * tout le monde, pas celle par laquelle le joueur est entre.
 */
const SITE = 'sprinter-game.com';

/**
 * L'ACCENT DU CARTON : le cyan, et non l'or.
 *
 * `OR` est la couleur de Sprinter et suit `--primary` ; elle bougera le jour
 * ou le theme bougera, et un carton doit sortir pareil d'un post a l'autre.
 * Surtout, c'est la couleur que le HUD met sur le chrono PENDANT la course :
 * la reprendre ici ferait de la derniere image une image de plus, alors que
 * le carton dit justement que la course est finie.
 *
 * Le cyan, lui, est celui des LED du stade et des bandeaux du jeu — deja fixe,
 * deja de la maison, et franchement detache de l'or. Voir `CYAN` dans
 * `pinceau-film.ts` : cyan-400, ecrit en dur comme le reste de la palette.
 */
const ACCENT = CYAN;

/**
 * LE CHRONO, ECRIT COMME LES CARTES L'ECRIVENT.
 *
 * Virgule en francais, point en anglais. Le HUD, lui, garde le point partout :
 * il compte pendant la course, il n'est pas lu, il est surveille. Le carton de
 * fin est l'inverse — une image qui se pose dans un fil, a cote des cartes de
 * `tools/carte-*.mjs`, qui ecrivent « 8,64 ». Deux conventions dans le meme
 * fil, sur le meme chrono, et c'est le jeu qui a l'air mal fini.
 */
function chronoEcrit(ms: number, fr: boolean): string {
  const s = (ms / 1000).toFixed(2);
  return fr ? s.replace('.', ',') : s;
}

/** Le voile est pose en {V} sur cette part de la duree, puis il tient. */
const OUVERTURE = 0.22;

/**
 * Le temps que met le code a se poser, une fois arrive.
 *
 * Il ne suit pas l'entree du carton : il arrive quand le serveur repond,
 * c'est-a-dire a n'importe quel moment des une seconde et demie. Un fondu
 * court le pose sans qu'il ait l'air d'un defaut d'affichage — et sans le
 * faire attendre, ce qui serait du temps de lecture pris a un carton qui n'en
 * a pas beaucoup.
 */
const POSE_CODE_MS = 280;

/** Ce que le voile laisse passer du stade, une fois pose. */
const VOILE = 0.9;

/* ------------------------------------------------------------- ce qu'il dit */

/**
 * Le nom de l'epreuve, ou des epreuves.
 *
 * Une seule course prend son libelle complet — « 100 MÈTRES », « 400 M HAIES »
 * — parce qu'il y a la place et que c'est ainsi que le jeu la nomme partout
 * ailleurs. Un one shot en compte jusqu'a trois, et trois libelles complets
 * bout a bout ne tiennent sur aucun telephone : on retombe alors sur la forme
 * courte des duels, « 100 + 200 + 400 M » (voir `nomDiscipline`).
 *
 * `t()` rend la cle qu'on lui donne quand elle lui est inconnue. On le verifie
 * plutot que de laisser « disc_100h » s'afficher en toutes lettres sur un film
 * que quelqu'un s'apprete a publier.
 */
function libelleEpreuves(G: any, N: any): string {
  const brut = (G?.shotRaces && G.shotRaces.length ? G.shotRaces : [G?.raceKey])
    .filter(Boolean).map((k: any) => String(k));
  if (!brut.length) return '';
  if (brut.length === 1) {
    const cle = `disc_${brut[0]}`;
    const dit = String(N?.t ? N.t(cle) : cle);
    return (dit === cle ? `${brut[0]} M` : dit).toUpperCase();
  }
  return `${brut.join(' + ').toUpperCase()} M`;
}

/**
 * Le chrono du carton, en millisecondes — ou `null`.
 *
 * `runTime` est le cumul de la prise : une course pour un direct, jusqu'a
 * trois pour un one shot, et c'est bien le total qu'il faut montrer puisque
 * c'est lui qui departage. On retombe sur le chrono de la derniere course
 * quand le cumul n'a pas ete tenu — un relais, par exemple, ou le verdict
 * appartient a l'equipe et pas au coureur.
 *
 * Un faux depart n'arrive jamais ici : `film-course.ts` jette la prise avant.
 */
function chronoDuCarton(G: any): number | null {
  const s = Number(G?.runTime) || Number(G?.player?.finishTime) || 0;
  return s > 0 && Number.isFinite(s) ? s * 1000 : null;
}

/* --------------------------------------------------------------- la peinture */

/**
 * Peint le carton par-dessus l'image gelee de l'arrivee.
 *
 * `l` et `h` sont en POINTS CSS — `review.ts` a deja mis le pinceau a
 * l'echelle de l'appareil. `avancement` va de 0 a 1 sur la duree du carton :
 * il ne sert qu'a l'entree, le carton tenant ensuite immobile jusqu'a la fin.
 *
 * `defi` est l'etat du defi de la camera, et il se lit tout seul : le
 * film ne le passe jamais. Il est la pour la page d'apercu, qui doit pouvoir
 * montrer les trois etats du code — absent, attendu, arrive — sans attendre
 * un serveur ni tripatouiller l'etat d'un module depuis le dehors.
 *
 * TOUT SE MESURE SUR LE PLUS PETIT COTE. Un telephone tenu droit, le meme
 * couche, un navigateur sur un ecran large : le film sort dans les trois
 * formats, et un carton cale sur la largeur deborderait du premier ou se
 * perdrait dans le dernier. Le plus petit cote est la seule mesure qui donne
 * le meme carton, a la meme place, dans les trois.
 */
export function peindreLeCarton(ctx: CanvasRenderingContext2D, l: number, h: number,
                                avancement: number, defi: DefiDeLaCamera = defiDeLaCamera()) {
  const G: any = SprinterApp.G;
  const N: any = SprinterApp.N;

  const ouvert = Math.max(0, Math.min(1, avancement / OUVERTURE));
  // Une entree qui decelere : le voile arrive vite puis se pose, au lieu de
  // monter tout droit — c'est ce qui le fait ressembler a une fin et non a une
  // coupure de courant.
  const doux = 1 - (1 - ouvert) * (1 - ouvert);

  ctx.fillStyle = `rgba(${NUIT}, ${VOILE * doux})`;
  ctx.fillRect(0, 0, l, h);
  if (doux <= 0.02) return;

  const base = Math.min(l, h);
  const M = Math.round(base * 0.07);
  const cx = l / 2;
  const dispo = l - M * 2;

  // Les corps suivent ceux des cartes : un surtitre discret et lettre, un
  // chrono qui prend toute la place, et LE CODE JUSTE DERRIERE LUI. Sur
  // Instagram et TikTok aucun lien n'est cliquable — le code a six caracteres
  // est le seul chemin vers le jeu, et il doit se lire sur un telephone tenu
  // a bout de bras, dans un fil qui defile. C'est ce qui lui vaut sa taille et
  // son inter-lettrage : un code se recopie caractere par caractere.
  const tSur    = Math.round(base * 0.034);
  const tChrono = Math.round(base * 0.220);
  const tUnite  = Math.round(base * 0.068);
  const tNom    = Math.round(base * 0.040);
  const tEtiq   = Math.round(base * 0.030);
  const tCode   = Math.round(base * 0.085);
  const tUrl    = Math.round(base * 0.030);
  const tPied   = Math.round(base * 0.032);

  const epreuve = libelleEpreuves(G, N);
  const chronoMs = chronoDuCarton(G);
  const nom = String(getSavedName() || G?.player?.name || '').trim();

  // DEUX PROVENANCES, ET LA PREMIERE PASSE DEVANT. Un joueur qui vient de
  // relever un defi a deja le bon code en main, sans un aller-retour : c'est
  // celui de la course qu'on regarde. Sinon c'est celui que la camera a
  // pose a l'arrivee, et il peut n'etre pas encore la.
  const releve = String(G?.challenge?.id || '').trim();
  const duFilm = defi;
  const code = releve || duFilm.id;
  // Attendu vaut place gardee : voir l'en-tete du fichier.
  const attendu = !!releve || duFilm.attendu;
  // Un code deja en main se pose avec le carton ; un code qui arrive du
  // reseau a son propre petit fondu, compte depuis son arrivee.
  const poseCode = releve || !duFilm.arriveA
    ? 1
    : Math.max(0, Math.min(1, (performance.now() - duFilm.arriveA) / POSE_CODE_MS));

  // LE BILLET DU CODE : deux filets, une etiquette, le code, l'adresse. Il
  // n'existe que si un code est attendu — sans lui l'adresse redescend dans le
  // pied, et le carton ne perd rien de ce qu'il devait dire.
  const hEtiq   = tEtiq * 2.0;
  const hLigne  = tCode * 1.35;
  const hUrl    = tUrl * 2.2;
  const hBillet = attendu ? tEtiq * 1.4 + hEtiq + hLigne + hUrl + tEtiq * 1.4 : 0;

  const hSur    = epreuve ? tSur * 1.9 : 0;
  const hChrono = chronoMs !== null ? tChrono * 1.16 : 0;
  const hNom    = nom ? tNom * 2.2 : 0;
  const hBloc   = hSur + hChrono + hNom + hBillet;

  // Le bloc est centre un peu au-dessus du milieu — le centre optique d'un
  // cadre est au-dessus de son centre geometrique — et jamais si haut qu'il
  // monte dans la marge, ni si bas qu'il touche le pied.
  const hautPied = h - M - tPied * 2.2;
  const y0 = Math.max(M * 1.2,
                      Math.min((h - hBloc) / 2 - base * 0.02, hautPied - hBloc - M * 0.6));
  // L'entree : le bloc monte de trois points sur sa derniere fraction de
  // seconde. Le voile, lui, ne bouge pas — sans quoi l'image entiere glisserait.
  let y = y0 + (1 - doux) * base * 0.03;
  const A = (v = 1) => v * doux;

  if (epreuve) {
    // « SPRINTER · 100 MÈTRES » : le nom du jeu d'abord, comme sur les cartes.
    // Celui qui recoit la video ne sait pas encore de quoi il s'agit.
    const e = { taille: tSur, gras: 700, couleur: SOURDINE, espace: tSur * 0.30,
                alpha: A(0.9), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, tailler(ctx, `SPRINTER · ${epreuve}`, dispo, e), cx, y + tSur / 2, e);
    y += hSur;
  }

  if (chronoMs !== null) {
    // Le chiffre et son unite, poses ensemble et centres ensemble. L'unite
    // s'aligne sur la LIGNE DE PIED des chiffres, pas sur leur milieu : une
    // petite lettre centree sur un grand nombre flotte au milieu du vide.
    const eCh = { taille: tChrono, gras: 900, police: AFFICHE, couleur: ACCENT,
                  espace: -tChrono * 0.02, alpha: A() };
    const eUn = { taille: tUnite, gras: 700, police: AFFICHE, couleur: SOURDINE,
                  alpha: A(0.75) };
    const txt = chronoEcrit(chronoMs, N?.getLang ? N.getLang() === 'fr' : true);
    const lCh = largeur(ctx, txt, eCh);
    const ecart = tUnite * 0.34;
    const lUn = largeur(ctx, 's', eUn);
    const x0 = cx - (lCh + ecart + lUn) / 2;
    ecrire(ctx, txt, x0, y + tChrono / 2, eCh);
    ecrire(ctx, 's', x0 + lCh + ecart, y + tChrono * 0.66, eUn);
    y += hChrono;
  } else if (epreuve) {
    // Sans chrono, l'epreuve reprend la place du chiffre plutot que de laisser
    // un carton a moitie vide. Le cas est rare — une prise arretee sans que le
    // coureur ait franchi la ligne — mais il ne doit pas sortir un trou.
    const e = { taille: Math.round(base * 0.1), gras: 900, police: AFFICHE,
                couleur: ACCENT, espace: base * 0.004, alpha: A(),
                aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, tailler(ctx, epreuve, dispo, e), cx, y + base * 0.06, e);
    y += base * 0.14;
  }

  if (nom) {
    const e = { taille: tNom, gras: 700, couleur: TEXTE, espace: tNom * 0.12,
                alpha: A(0.85), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, tailler(ctx, nom.toUpperCase(), dispo, e), cx, y + tNom / 2, e);
    y += hNom;
  }

  // LE BILLET DU CODE. Deux filets, une etiquette, le code, l'adresse — le
  // meme bloc que les cartes de communication, pour la meme raison : c'est la
  // seule partie de l'image qu'on doit pouvoir recopier.
  //
  // La place est comptee des que le code est ATTENDU, meme s'il n'est pas
  // encore la. Le filet, l'etiquette et l'adresse se posent avec le carton ;
  // seul le code a son fondu a lui, compte depuis son arrivee.
  if (attendu) {
    const P = (v = 1) => v * doux * poseCode;
    const haut = y;
    filet(ctx, M, haut, l - M, doux);
    let yb = haut + tEtiq * 1.4;

    ecrire(ctx, String(N?.t ? N.t('carton_defi') : 'CODE'), cx, yb + tEtiq / 2,
           { taille: tEtiq, gras: 700, couleur: SOURDINE, espace: tEtiq * 0.34,
             alpha: A(0.85), aligne: 'center' });
    yb += hEtiq;

    if (code) {
      const e = { taille: tCode, gras: 800, police: CHIFFRES, couleur: TEXTE,
                  espace: tCode * 0.14, alpha: P() };
      // CENTRER UN TEXTE LETTRE. `letterSpacing` ajoute son espace APRES chaque
      // caractere, le dernier compris : un `textAlign: center` cale donc le
      // code d'un demi-espace trop a gauche. On mesure avec et sans pour
      // retrancher exactement le dernier — et l'ecart vaut zero de lui-meme
      // sur les navigateurs qui ignorent `letterSpacing`, ou rien n'est
      // ajoute. La feuille de style de la carte fait la meme correction, sous
      // le nom de `text-indent`.
      const lLettre = largeur(ctx, code, e);
      const lNu = largeur(ctx, code, { ...e, espace: 0 });
      const trop = code.length ? (lLettre - lNu) / code.length : 0;
      ecrire(ctx, code, cx - (lLettre - trop) / 2, yb + hLigne / 2, e);
    }
    yb += hLigne;

    ecrire(ctx, SITE, cx, yb + hUrl / 2,
           { taille: tUrl, gras: 500, couleur: SOURDINE, alpha: A(0.8),
             aligne: 'center' });

    filet(ctx, M, haut + hBillet, l - M, doux);
    y += hBillet;
  }

  // L'ADRESSE DESCEND DANS LE PIED quand il n'y a pas de billet pour la
  // porter. Elle ne disparait jamais : c'est la seule chose du carton dont on
  // ne peut pas se passer.
  const fr = N?.getLang ? N.getLang() === 'fr' : true;
  pied(ctx, l, h, M, tPied, doux,
       attendu ? String(N?.t ? N.t('carton_pied') : (fr ? 'JEU DE SPRINT' : 'SPRINT GAME'))
               : SITE,
       !attendu);
}

/** Un filet, de marge a marge. Le meme que celui du pied. */
function filet(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number,
               doux: number) {
  ctx.save();
  ctx.globalAlpha = doux;
  ctx.strokeStyle = 'rgba(34,211,238,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * Le pied : la signature a gauche, et a droite ce qui reste a dire.
 *
 * Le meme geste que l'affiche partageable (`trace-affiche.js`, `poserPied`) —
 * un filet, deux mots, rien au milieu. Ce qui va a droite depend de ce que le
 * carton porte au-dessus : la signature du jeu quand le billet affiche deja
 * l'adresse, et l'adresse elle-meme sinon. Un film voyage seul dans une
 * conversation ou personne ne portera le lien a sa place ; il ne doit jamais
 * sortir sans lui.
 */
function pied(ctx: CanvasRenderingContext2D, l: number, h: number, M: number,
              t: number, doux: number, droite: string, accent: boolean) {
  const y = h - M;
  filet(ctx, M, y - t * 1.75, l - M, doux);

  const ligne = y - t * 0.55;
  ecrire(ctx, 'SPRINTER', M, ligne,
         { taille: t, gras: 700, police: AFFICHE, couleur: TEXTE,
           alpha: doux * 0.5, espace: t * 0.28 });
  ecrire(ctx, droite, l - M, ligne,
         { taille: t, gras: 700, police: AFFICHE,
           couleur: accent ? ACCENT : SOURDINE,
           alpha: doux * (accent ? 0.9 : 0.5),
           espace: t * (accent ? 0.04 : 0.28), aligne: 'right' });
}
