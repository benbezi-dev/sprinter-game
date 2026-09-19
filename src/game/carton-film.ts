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
//   L'ADRESSE, une fois, sans point d'exclamation.
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
// D'ou la place gardee. Des qu'un code est ATTENDU, il compte dans la
// hauteur du bloc, meme vide : sans cela le bloc serait centre sans elle, puis
// recentre avec, et tout sauterait d'un cran a l'instant ou il se pose —
// au milieu d'un film qu'on ne peut plus remonter. La pastille apparait donc
// Le code apparait donc en fondu, a sa place, et rien d'autre ne bouge.
//
// Et s'il n'arrive pas — hors ligne, serveur muet, course qui ne peut pas
// faire un defi — le carton sort avec le chrono et l'adresse. Il se tait
// plutot que d'inventer un code qui n'ouvrirait rien.

import { SprinterApp } from './engine';
import { getSavedName } from './leaderboard';
import { defiDeLaCamera, type DefiDeLaCamera } from './defi-camera';
import { AFFICHE, CHIFFRES, ecrire, largeur, tailler } from './pinceau-film';

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

/* -------------------------------------------- la maquette « affiche »

   CELLE DU JEU, ET C'EST UNE REGLE, PAS UN GOUT. Le style de Sprinter — fond
   #060913, lueur doree en haut, Outfit 900, chrono en Space Mono dore, pied
   « SPRINTER / JEU DE SPRINT » — est la VOIX ORDINAIRE des visuels du compte.
   Le bleu nuit et le degrade orange sont celle des JOURS DE COMPETITION, quand
   le compte parle d'autre chose que de lui : un record du monde, une finale,
   un chrono d'ailleurs. Voir `tools/carte-defi-ouvert.mjs`, qui porte les deux
   maquettes et l'explique.

   Le carton de fin joue a l'arrivee de CHAQUE course, tous les jours. Il est
   donc de la voix ordinaire, et il en reprend les valeurs une par une : un
   joueur qui voit le post, puis l'ecran de fin, doit reconnaitre la meme main.

   Les nombres sont recopies de la maquette `pageAffiche`, qui les tient
   elle-meme de `game/trace-affiche.js`. Un canvas ne lit pas une feuille de
   style, et l'outil des cartes est un programme que le jeu n'embarque pas :
   c'est la seule facon de les avoir des deux cotes. */

const FOND      = '#060913';
const OR_JEU    = '#F8CD4A';                 // le chrono, et la lueur
const BLANC     = '#ffffff';                 // le code
const ENCRE_46  = 'rgba(255,255,255,0.46)';  // surtitre, etiquette, pied gauche
const ENCRE_55  = 'rgba(255,255,255,0.55)';  // le nom
const ENCRE_38  = 'rgba(255,255,255,0.38)';  // l'adresse
const ENCRE_30  = 'rgba(255,255,255,0.30)';  // pied droit
const FILET     = 'rgba(255,255,255,0.10)';

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

/**
 * LE CHRONO, ECRIT COMME LES CARTES L'ECRIVENT.
 *
 * Virgule en francais, point en anglais. Le HUD, lui, garde le point partout :
 * il compte pendant la course, il n'est pas lu, il est surveille. Le carton de
 * fin est l'inverse — une image qui se pose dans un fil, a cote des cartes.
 */
function chronoEcrit(ms: number, fr: boolean): string {
  const s = (ms / 1000).toFixed(2);
  return fr ? s.replace('.', ',') : s;
}

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

/** Un filet, de marge a marge. */
function filet(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number,
               alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = FILET;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * LE CHRONO, ET SA VIRGULE QUI NE PREND PAS UNE CHASSE ENTIERE.
 *
 * Space Mono est a chasse fixe : la virgule y occupe la case d'un chiffre, et
 * « 9,12 » se lit alors « 9 , 12 » — deux nombres au lieu d'un. La maquette
 * lui retire trois dixiemes de chasse de chaque cote (`.virgule`, marges
 * negatives) ; le jeu fait de meme dans `morceauxChrono`. On decoupe donc le
 * chrono en trois et on rapproche, plutot que de poser une chaine d'un bloc.
 *
 * Le point anglais a exactement le meme defaut, et recoit le meme traitement :
 * la maquette ne le traite pas parce qu'elle n'ecrit qu'en francais.
 *
 * Rend la largeur prise, pour que l'appelant sache ou il en est.
 */
function ecrireLeChrono(ctx: CanvasRenderingContext2D, txt: string, cx: number,
                        y: number, e: any): number {
  const sep = txt.includes(',') ? ',' : '.';
  const i = txt.indexOf(sep);
  if (i < 0) { ecrire(ctx, txt, cx, y, { ...e, aligne: 'center' }); return largeur(ctx, txt, e); }

  const g = txt.slice(0, i), d = txt.slice(i + 1);
  const chasse = largeur(ctx, '0', e);
  const retrait = chasse * 0.30;
  const lG = largeur(ctx, g, e), lSep = largeur(ctx, sep, e), lD = largeur(ctx, d, e);
  const total = lG + lSep - retrait * 2 + lD;

  let x = cx - total / 2;
  ecrire(ctx, g, x, y, e);
  x += lG - retrait;
  ecrire(ctx, sep, x, y, e);
  x += lSep - retrait;
  ecrire(ctx, d, x, y, e);
  return total;
}

/**
 * Peint le carton par-dessus l'image gelee de l'arrivee.
 *
 * `l` et `h` sont en POINTS CSS — `review.ts` a deja mis le pinceau a
 * l'echelle de l'appareil. `avancement` va de 0 a 1 sur la duree du carton :
 * il ne sert qu'a l'entree, le carton tenant ensuite immobile jusqu'a la fin.
 *
 * `defi` est l'etat du defi de la camera, et il se lit tout seul : le film ne
 * le passe jamais. Il est la pour la page d'apercu, qui doit pouvoir montrer
 * les trois etats du code — absent, attendu, arrive — sans attendre un serveur
 * ni tripatouiller l'etat d'un module depuis le dehors.
 *
 * L'UNITE DE MESURE EST CELLE DE LA MAQUETTE, et elle n'est pas le plus petit
 * cote : c'est la LARGEUR en portrait, et 62 % de la hauteur en paysage. Un
 * format large est trois fois moins haut que large — une taille exprimee en
 * fraction de sa largeur y devient enorme, et le chrono mangerait le cadre.
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
  const A = (v = 1) => v * doux;

  // LE FOND DU JEU, ET SA LUEUR. Un aplat ferait un trou dans l'image ; la
  // lueur doree en haut est la signature de l'affiche, et c'est elle qui fait
  // reconnaitre le jeu avant meme qu'on ait lu un mot.
  ctx.save();
  ctx.globalAlpha = VOILE * doux;
  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, l, h);
  const lueur = ctx.createRadialGradient(l * 0.5, h * 0.08, 0,
                                         l * 0.5, h * 0.08, l * 0.85);
  lueur.addColorStop(0, 'rgba(248,205,74,0.20)');
  lueur.addColorStop(1, 'rgba(248,205,74,0)');
  ctx.fillStyle = lueur;
  ctx.fillRect(0, 0, l, h);
  ctx.restore();
  if (doux <= 0.02) return;

  const paysage = l > h;
  const u = paysage ? h * 0.62 : l;
  const T = (t: number) => Math.round(u * t);
  const M = Math.round(l * 0.082);
  const cx = l / 2;
  const dispo = l - M * 2;

  const tSur   = Math.round(l * 0.0205);
  const tChrono = T(0.20);
  const tQui   = T(0.034);
  const tEtiq  = T(0.022);
  const tCode  = T(0.105);
  const tLien  = T(0.026);
  const tPied  = Math.round(l * 0.0205);

  const epreuve = libelleEpreuves(G, N);
  const chronoMs = chronoDuCarton(G);
  const nom = String(getSavedName() || G?.player?.name || '').trim();

  // DEUX PROVENANCES, ET LA PREMIERE PASSE DEVANT. Un joueur qui vient de
  // relever un defi a deja le bon code en main, sans un aller-retour : c'est
  // celui de la course qu'on regarde. Sinon c'est celui que la camera a pose a
  // l'arrivee, et il peut n'etre pas encore la.
  const releve = String(G?.challenge?.id || '').trim();
  const code = releve || defi.id;
  const attendu = !!releve || defi.attendu;
  const poseCode = releve || !defi.arriveA
    ? 1
    : Math.max(0, Math.min(1, (performance.now() - defi.arriveA) / POSE_CODE_MS));

  /* LE SURTITRE NE PARTICIPE PAS AU CENTRAGE. Il tient sa place quoi qu'il
     arrive, a 10,5 % de la hauteur — exactement comme dans le jeu. */
  if (epreuve) {
    const e = { taille: tSur, gras: 700, police: AFFICHE, couleur: ENCRE_46,
                espace: tSur * 0.36, alpha: A(), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, tailler(ctx, `SPRINTER · ${epreuve}`, dispo, e), cx, Math.round(h * 0.105), e);
  }

  /* LA PILE : la zone ou le sujet a le droit de vivre, et il s'y centre. */
  const haut = Math.round(h * 0.105) + Math.round(l * 0.055);
  const basZone = h - M * 2.1;

  const hChrono = chronoMs !== null ? tChrono * 1.05 : 0;
  const hQui    = nom || epreuve ? T(0.045) + tQui * 1.4 : 0;
  const hBillet = attendu ? T(0.085) + T(0.055) + tEtiq * 1.4 + T(0.028)
                          + tCode * 1.1 + T(0.030) + tLien * 1.4 : 0;
  const hPile   = hChrono + hQui + hBillet;

  let y = haut + Math.max(0, (basZone - haut - hPile) / 2)
              + (1 - doux) * u * 0.03;

  if (chronoMs !== null) {
    const e = { taille: tChrono, gras: 700, police: CHIFFRES, couleur: OR_JEU,
                alpha: A() };
    ecrireLeChrono(ctx, chronoEcrit(chronoMs, N?.getLang ? N.getLang() === 'fr' : true),
                   cx, y + tChrono / 2, e);
    y += hChrono;
  }

  if (nom || epreuve) {
    y += T(0.045);
    const e = { taille: tQui, gras: 500, police: AFFICHE, couleur: ENCRE_55,
                alpha: A(), aligne: 'center' as CanvasTextAlign };
    const dit = [nom, epreuve].filter(Boolean).join(' · ');
    ecrire(ctx, tailler(ctx, dit, dispo, e), cx, y + tQui / 2, e);
    y += tQui * 1.4;
  }

  /* LE BILLET. L'affiche du jeu garde cette zone pour la trace de la course ;
     ici elle porte la seule chose qui ramene quelqu'un dans le jeu. Un seul
     filet, en haut — c'est ce que fait la maquette. */
  if (attendu) {
    const P = (v = 1) => v * doux * poseCode;
    y += T(0.085);
    filet(ctx, M, y, l - M, doux);
    y += T(0.055);

    const eE = { taille: tEtiq, gras: 700, police: AFFICHE, couleur: ENCRE_46,
                 espace: tEtiq * 0.36, alpha: A(), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, String(N?.t ? N.t('carton_defi') : 'CODE'), cx, y + tEtiq / 2, eE);
    y += tEtiq * 1.4 + T(0.028);

    if (code) {
      const e = { taille: tCode, gras: 700, police: CHIFFRES, couleur: BLANC,
                  espace: tCode * 0.12, alpha: P() };
      // CENTRER UN TEXTE LETTRE. `letterSpacing` ajoute son espace APRES chaque
      // caractere, le dernier compris : un `textAlign: center` calerait le code
      // d'un demi-espace trop a gauche. On mesure avec et sans pour retrancher
      // exactement le dernier — et l'ecart vaut zero de lui-meme la ou
      // `letterSpacing` n'existe pas. La maquette fait la meme correction, sous
      // le nom de `text-indent`.
      const lLettre = largeur(ctx, code, e);
      const lNu = largeur(ctx, code, { ...e, espace: 0 });
      const trop = code.length ? (lLettre - lNu) / code.length : 0;
      ecrire(ctx, code, cx - (lLettre - trop) / 2, y + tCode / 2, e);
    }
    y += tCode * 1.1 + T(0.030);

    const eL = { taille: tLien, gras: 500, police: AFFICHE, couleur: ENCRE_38,
                 alpha: A(), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, SITE, cx, y + tLien / 2, eL);
  }

  /* LE PIED DU JEU, AU PIXEL : meme filet, meme graisse, meme inter-lettrage.
     A droite, la signature quand le billet porte deja l'adresse — et l'adresse
     elle-meme sinon. Elle ne disparait jamais : c'est la seule chose du carton
     dont on ne peut pas se passer. */
  filet(ctx, M, h - M * 1.5, l - M, doux);
  const yPied = h - M * 0.92;
  const eP = { taille: tPied, gras: 700, police: AFFICHE, espace: l * 0.006 };
  ecrire(ctx, 'SPRINTER', M, yPied, { ...eP, couleur: ENCRE_46, alpha: A() });
  ecrire(ctx, attendu ? String(N?.t ? N.t('carton_pied') : 'JEU DE SPRINT') : SITE,
         l - M, yPied,
         { ...eP, couleur: attendu ? ENCRE_30 : OR_JEU, alpha: A(attendu ? 1 : 0.9),
           espace: attendu ? l * 0.006 : l * 0.001, aligne: 'right' });
}
