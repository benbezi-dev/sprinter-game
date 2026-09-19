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
// LE CODE N'EST PAS TOUJOURS LA, ET ON NE LE FABRIQUE PAS POUR L'OCCASION. Un
// defi s'ecrit sur le serveur, a la demande du joueur, depuis l'ecran de fin
// (voir OneShotEndScreen) — donc APRES que la camera s'est arretee. Le carton
// affiche celui qui existe deja, c'est-a-dire celui d'un defi qu'on vient de
// relever : la course filmee est alors reproductible a l'identique, et c'est
// exactement ce que le code promet. Ailleurs il n'y en a pas, et le carton se
// tait plutot que d'inventer.

import { SprinterApp } from './engine';
import { s2 } from './record';
import { getSavedName } from './leaderboard';
import {
  OR, TEXTE, SOURDINE, NUIT, CYAN_CLAIR, AFFICHE, CHIFFRES,
  ecrire, largeur, tailler, pastille,
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

/** Le voile est pose en {V} sur cette part de la duree, puis il tient. */
const OUVERTURE = 0.22;

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
 * TOUT SE MESURE SUR LE PLUS PETIT COTE. Un telephone tenu droit, le meme
 * couche, un navigateur sur un ecran large : le film sort dans les trois
 * formats, et un carton cale sur la largeur deborderait du premier ou se
 * perdrait dans le dernier. Le plus petit cote est la seule mesure qui donne
 * le meme carton, a la meme place, dans les trois.
 */
export function peindreLeCarton(ctx: CanvasRenderingContext2D, l: number, h: number,
                                avancement: number) {
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

  const tSur    = Math.round(base * 0.037);
  const tChrono = Math.round(base * 0.235);
  const tUnite  = Math.round(base * 0.072);
  const tNom    = Math.round(base * 0.042);
  const tCode   = Math.round(base * 0.038);
  const tPied   = Math.round(base * 0.034);

  const epreuve = libelleEpreuves(G, N);
  const chronoMs = chronoDuCarton(G);
  const nom = String(getSavedName() || G?.player?.name || '').trim();
  const code = String(G?.challenge?.id || '').trim();

  const hSur    = epreuve ? tSur * 1.9 : 0;
  const hChrono = chronoMs !== null ? tChrono * 1.16 : 0;
  const hNom    = nom ? tNom * 2.1 : 0;
  const hPast   = tCode * 2.5;
  const hCode   = code ? hPast + tCode * 1.9 : 0;
  const hBloc   = hSur + hChrono + hNom + hCode;

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
    const e = { taille: tSur, gras: 700, couleur: SOURDINE, espace: tSur * 0.18,
                alpha: A(0.95), aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, tailler(ctx, epreuve, dispo, e), cx, y + tSur / 2, e);
    y += hSur;
  }

  if (chronoMs !== null) {
    // Le chiffre et son unite, poses ensemble et centres ensemble. L'unite
    // s'aligne sur la LIGNE DE PIED des chiffres, pas sur leur milieu : une
    // petite lettre centree sur un grand nombre flotte au milieu du vide.
    const eCh = { taille: tChrono, gras: 900, police: CHIFFRES, couleur: OR,
                  espace: -tChrono * 0.02, alpha: A() };
    const eUn = { taille: tUnite, gras: 700, police: CHIFFRES, couleur: SOURDINE,
                  alpha: A(0.75) };
    const txt = s2(chronoMs);
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
                couleur: OR, espace: base * 0.004, alpha: A(),
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

  if (code) {
    const e = { taille: tCode, gras: 800, police: CHIFFRES, couleur: CYAN_CLAIR,
                espace: tCode * 0.16, alpha: A() };
    pastille(ctx, `${N?.t ? N.t('carton_defi') : 'CODE'} ${code}`, cx, y, hPast, e,
             `rgba(0,0,0,${A(0.5)})`, `rgba(34,211,238,${A(0.45)})`, tCode * 1.2);
    y += hPast + tCode * 1.2;
    const eS = { taille: tCode * 0.82, gras: 500, couleur: SOURDINE, alpha: A(0.8),
                 aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, String(N?.t ? N.t('carton_defi_sous') : ''), cx, y, eS);
  }

  pied(ctx, l, h, M, tPied, doux);
}

/**
 * Le pied : la signature a gauche, l'adresse a droite.
 *
 * Le meme geste que l'affiche partageable (`trace-affiche.js`, `poserPied`) —
 * un filet, deux mots, rien au milieu — a une difference pres qui compte :
 * l'adresse est ECRITE, et elle est en or. L'affiche pouvait s'en passer,
 * elle se publie sur un compte qui porte deja le lien ; un film, lui, voyage
 * seul dans une conversation ou personne ne portera le lien a sa place.
 */
function pied(ctx: CanvasRenderingContext2D, l: number, h: number, M: number,
              t: number, doux: number) {
  const y = h - M;
  ctx.save();
  ctx.globalAlpha = doux;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, y - t * 1.75);
  ctx.lineTo(l - M, y - t * 1.75);
  ctx.stroke();
  ctx.restore();

  const ligne = y - t * 0.55;
  ecrire(ctx, 'SPRINTER', M, ligne,
         { taille: t, gras: 700, police: AFFICHE, couleur: TEXTE,
           alpha: doux * 0.5, espace: t * 0.28 });
  ecrire(ctx, SITE, l - M, ligne,
         { taille: t, gras: 700, police: AFFICHE, couleur: OR,
           alpha: doux * 0.9, espace: t * 0.04, aligne: 'right' });
}
