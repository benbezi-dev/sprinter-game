// LA NUIT DU MOLOSSE — ce qu'on raconte apres la course.
//
// Quatorze scenettes : six pour les nuits tenues, huit pour les morsures. Elles
// sont le vrai contenu du mode — la course dure onze secondes, la scene reste.
//
// ELLES FONT PEUR (08/10, « je veux qu'il fasse peur »). La premiere serie
// faisait rire : un facteur promu, un short refuse par les commissaires. Elle
// allait contre tout le reste du mode — la lune rousse, les yeux entre les
// tombes, la tete de la bete au premier plan —, et le joueur sortait de la
// scene plus leger qu'il n'y etait entre. Elle est reecrite d'un bout a
// l'autre ; les deux regles qui suivent sont celles qui ont survecu.
//
// DEUX REGLES D'ECRITURE, ET ELLES VALENT PLUS QUE LE RESTE DU FICHIER.
//
// 1. LE FROID EST TOUJOURS SUR LA DERNIERE LIGNE, et les trois premieres ne
//    font que le preparer. Les trois premieres sont ordinaires, presque
//    rassurantes : un medecin, un bus, une porte fermee a double tour. Le jeu
//    affiche les quatre lignes une par une, a intervalle fixe, et la derniere
//    arrive dans un silence qu'on a le temps de sentir — c'est elle qui doit
//    retourner les trois autres. Une scenette qui annoncerait la peur avant
//    de la poser n'en ferait aucune.
//
// 2. ON NE MONTRE JAMAIS LA BLESSURE. Le molosse emporte un mollet, une
//    oreille, un talon — et la scenette parle d'une fenetre, d'un miroir, d'un
//    pas dans la rue. La peur vient de ce qui revient la nuit, pas de ce qui
//    saigne : c'est ce qui separe une histoire qui glace d'un truc
//    desagreable. Un jeu ou l'on court se joue aussi chez des gens de douze
//    ans.
//
// CE QUI SE PERD N'EST PAS TOUJOURS UN MORCEAU. Une scenette sur deux fait
// perdre autre chose — une ombre, un nom, le sommeil. La serie tiendrait mal
// sur huit membres arraches : au troisieme, le joueur sait ce qu'il va lire.
// L'alternance est ce qui garde la surprise jusqu'a la huitieme.
//
// LES TEXTES VIVENT ICI ET NON DANS sprinter-i18n.js. Tout le mode doit
// pouvoir sortir du paquet d'un seul drapeau (canal.ts, HALLOWEEN_OUVERT) ;
// quatorze scenettes en deux langues posees dans la table commune y seraient
// restees, puisqu'un bundler ne peut pas suivre ce qui est publie sur un
// global. La forme, elle, est celle du reste du jeu : [francais, anglais].

import { SprinterI18N } from './engine';

export type Scene = {
  cle: string;
  /** Le bandeau au-dessus du titre. */
  sur: [string, string];
  /** Le titre, gros. */
  titre: [string, string];
  /** Les quatre lignes, servies une a une. */
  lignes: [string, string][];
};

/** La langue courante, sous la forme que ces tables attendent. */
function i(): 0 | 1 { return SprinterI18N.index() as 0 | 1; }

/** Le texte de la langue courante. */
export function dit(paire: [string, string]): string { return paire[i()]; }

/* ---------------------------------------------------------------------------
   IL S'EN EST SORTI — les nuits tenues
   ---------------------------------------------------------------------------
   Le bandeau le dit, et chacune le dement. Le joueur vient de passer la ligne
   avant la bete : la scenette lui raconte que ca ne suffit pas. La bete ne
   l'a pas eu, elle l'a REPERE — elle dort devant sa porte, elle monte dans
   son bus, elle s'aligne avec son club. Aucune ne le dit en ces termes : c'est
   un tiers qui le constate, un facteur, un radar, un gardien, un entraineur.
--------------------------------------------------------------------------- */
export const TENUES: readonly Scene[] = [
  {
    cle: 'paillasson',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['LE FACTEUR', 'THE POSTMAN'],
    lignes: [
      ['Le lendemain matin, le facteur a sonné chez lui.',
       'The next morning, the postman rang his bell.'],
      ['« Votre chien a encore dormi devant la porte. »',
       '"Your dog slept outside the door again."'],
      ['Il n\'a pas de chien. Il n\'en a jamais eu.',
       'He has no dog. He never has.'],
      ['« Encore », avait dit le facteur.',
       '"Again," the postman had said.'],
    ],
  },
  {
    cle: 'cliches',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['LE RADAR', 'THE SPEED CAMERA'],
    lignes: [
      ['Le radar de l\'avenue l\'a flashé à 2 h 40 du matin.',
       'The avenue\'s speed camera flashed him at 2:40 a.m.'],
      ['Il a demandé les clichés. On lui en a envoyé deux.',
       'He asked for the photos. They sent him two.'],
      ['Sur le premier, il court seul dans l\'avenue vide.',
       'In the first, he runs alone down the empty avenue.'],
      ['Sur le second, quelque chose regarde l\'objectif.',
       'In the second, something is looking into the lens.'],
    ],
  },
  {
    cle: 'portail',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['LA BANDE', 'THE TAPE'],
    lignes: [
      ['Le gardien du cimetière a revu la vidéo du portail.',
       'The cemetery keeper reviewed the footage from the gate.'],
      ['À 2 h 41, un homme passe en courant. Puis plus rien.',
       'At 2:41 a man runs past. Then nothing.'],
      ['À 3 h 20, le portail s\'ouvre tout seul. De l\'intérieur.',
       'At 3:20 the gate opens by itself. From the inside.'],
      ['Il a arrêté la bande. Il n\'a jamais voulu voir la suite.',
       'He stopped the tape. He never wanted to see the rest.'],
    ],
  },
  {
    cle: 'terminus',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['LE 7 H 12', 'THE 7:12'],
    lignes: [
      ['Le lendemain, il a pris le 7 h 12, comme tous les jours.',
       'The next day he took the 7:12, as he does every day.'],
      ['À chaque arrêt, un chien noir attendait sur le trottoir.',
       'At every stop, a black dog was waiting on the pavement.'],
      ['Le même chien. Toujours un arrêt d\'avance.',
       'The same dog. Always one stop ahead.'],
      ['Au terminus, il était assis à côté de lui.',
       'At the terminus, it was sitting next to him.'],
    ],
  },
  {
    cle: 'neuvieme',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['L\'ENTRAÎNEMENT', 'TRAINING'],
    lignes: [
      ['Il s\'est inscrit au club pour ne plus être rattrapé.',
       'He joined the club, so he would never be caught again.'],
      ['Mardi soir, ils étaient huit sur la ligne de départ.',
       'On Tuesday night, eight of them lined up at the start.'],
      ['À l\'arrivée, l\'entraîneur en a compté neuf.',
       'At the finish, the coach counted nine.'],
      ['Le neuvième courait à quatre pattes.',
       'The ninth was running on all fours.'],
    ],
  },
  {
    cle: 'sixieme',
    sur: ['IL S\'EN EST SORTI', 'HE GOT AWAY'],
    titre: ['LA NUIT SUIVANTE', 'THE NEXT NIGHT'],
    lignes: [
      ['Il est rentré chez lui. Il a fermé à double tour.',
       'He got home. He double-locked the door.'],
      ['Vers trois heures, on a gratté à la porte. Doucement.',
       'Around three, something scratched at the door. Gently.'],
      ['Puis à la fenêtre du salon. Puis à celle de la chambre.',
       'Then at the living-room window. Then at the bedroom one.'],
      ['Il habite au sixième étage.',
       'He lives on the sixth floor.'],
    ],
  },
];

/* ---------------------------------------------------------------------------
   CE QU'IL A PERDU — les morsures
   ---------------------------------------------------------------------------
   Huit facons de se faire rattraper, et une seule regle : ce qui a ete
   arrache n'est jamais decrit. On apprend la perte par ce qui revient la nuit
   — une odeur sous la fenetre, un pas dans la rue, une ombre sous un
   reverbere. La bete n'a pas fini : c'est tout ce que ces huit-la disent.
--------------------------------------------------------------------------- */
export const MORSURES: readonly Scene[] = [
  {
    cle: 'gout',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE MOLLET GAUCHE', 'THE LEFT CALF'],
    lignes: [
      ['La bête n\'a pris qu\'une bouchée. Le mollet gauche.',
       'The beast took a single bite. The left calf.'],
      ['Les médecins disent qu\'il a eu de la chance.',
       'The doctors say he was lucky.'],
      ['Chaque nuit, quelque chose renifle sous sa fenêtre.',
       'Every night, something sniffs beneath his window.'],
      ['Elle connaît son goût, maintenant.',
       'It knows how he tastes now.'],
    ],
  },
  {
    cle: 'doigt',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE PETIT DOIGT', 'THE LITTLE FINGER'],
    lignes: [
      ['Le molosse lui a pris l\'auriculaire de la main gauche.',
       'The hound took the little finger of his left hand.'],
      ['« Un détail », a dit le médecin des urgences.',
       '"A detail," said the doctor in A&E.'],
      ['Certaines nuits, il le sent encore. Il le sent bouger.',
       'Some nights he can still feel it. He can feel it move.'],
      ['Il le sent gratter, sous la terre, pour revenir.',
       'He feels it scratching through the earth, coming back.'],
    ],
  },
  {
    cle: 'humide',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE SHORT', 'THE SHORTS'],
    lignes: [
      ['La gueule s\'est refermée sur le short, pas sur la jambe.',
       'The jaws closed on the shorts, not on the leg.'],
      ['Il a laissé le tissu entre ses crocs, et il a couru.',
       'He left the cloth between its fangs, and he ran.'],
      ['Le lendemain, le short était plié sur son lit.',
       'The next day, the shorts were folded on his bed.'],
      ['Encore humide.', 'Still damp.'],
    ],
  },
  {
    cle: 'ombre',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['SON OMBRE', 'HIS SHADOW'],
    lignes: [
      ['La bête n\'a mordu aucun morceau de lui.',
       'The beast did not bite any part of him.'],
      ['Elle a happé son ombre, et elle l\'a emportée.',
       'It snapped up his shadow, and carried it off.'],
      ['Depuis, en plein soleil, il ne projette plus rien au sol.',
       'Since then, in full sun, he casts nothing on the ground.'],
      ['La nuit, son ombre revient. Elle marche à quatre pattes.',
       'At night his shadow comes back. It walks on all fours.'],
    ],
  },
  {
    cle: 'hurle',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['SON NOM', 'HIS NAME'],
    lignes: [
      ['Ce qu\'il a laissé cette nuit-là n\'était pas un membre.',
       'What he left behind that night was not a limb.'],
      ['C\'était son nom. La bête l\'a emporté entre ses dents.',
       'It was his name. The beast carried it off in its teeth.'],
      ['Plus personne ne s\'en souvient. Ni ses amis, ni sa mère.',
       'Nobody remembers it now. Not his friends, not his mother.'],
      ['La nuit, au fond du cimetière, quelque chose le hurle.',
       'At night, deep in the cemetery, something howls it.'],
    ],
  },
  {
    cle: 'pas',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE TALON DROIT', 'THE RIGHT HEEL'],
    lignes: [
      ['Le molosse a emporté le talon droit.',
       'The hound took the right heel.'],
      ['Depuis, il boite : un pas lourd, un pas léger.',
       'He has limped ever since: one heavy step, one light.'],
      ['La nuit, dans la rue vide, il l\'entend derrière lui.',
       'At night, in the empty street, he hears it behind him.'],
      ['Il a cessé de se retourner. Le pas, lui, se rapproche.',
       'He no longer turns round. The steps keep getting closer.'],
    ],
  },
  {
    cle: 'sommeil',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['SON SOMMEIL', 'HIS SLEEP'],
    lignes: [
      ['Elle ne lui a rien arraché. Pas même un cheveu.',
       'It did not tear anything off him. Not even a hair.'],
      ['Elle a pris son sommeil.', 'It took his sleep.'],
      ['Dès qu\'il ferme les yeux, il est de retour au cimetière.',
       'Whenever he closes his eyes, he is back in the cemetery.'],
      ['Et chaque nuit, la bête part un peu plus près de lui.',
       'And every night, the beast starts a little closer.'],
    ],
  },
  {
    cle: 'respire',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['L\'OREILLE GAUCHE', 'THE LEFT EAR'],
    lignes: [
      ['Il a perdu l\'oreille gauche entre deux tombes.',
       'He lost his left ear between two graves.'],
      ['Il l\'a cherchée deux heures, avec une lampe de poche.',
       'He searched for two hours with a torch.'],
      ['Il ne l\'a jamais retrouvée. Mais il entend encore avec.',
       'He never found it. But he can still hear through it.'],
      ['La nuit, il entend quelque chose respirer sous la terre.',
       'At night, he hears something breathing under the earth.'],
    ],
  },
];

/** Les clefs des scenettes de victoire, pour le tirage. */
export const CLES_TENUES = TENUES.map(s => s.cle);
/** Les clefs des scenettes de morsure, pour le tirage. */
export const CLES_MORSURES = MORSURES.map(s => s.cle);

/** La scenette de cette clef, ou la premiere du lot a defaut. */
export function sceneDe(cle: string, mordu: boolean): Scene {
  const lot = mordu ? MORSURES : TENUES;
  return lot.find(s => s.cle === cle) || lot[0];
}

/* ---------------------------------------------------------------------------
   LA SCENE DESSINEE
   ---------------------------------------------------------------------------
   Derriere le texte, une image fixe et vivante : la silhouette d'un homme qui
   court, la bete a ses trousses, la lune derriere, et les tombes d'un
   cimetiere qui defile.

   ELLE EST EN SILHOUETTE, ET C'EST UNE DECISION PLUTOT QU'UNE ECONOMIE. Les
   cinematiques du jeu se jouent DANS le stade, avec le vrai coureur et ses
   vraies couleurs ; celle-ci se joue dans le souvenir de quelqu'un. Un
   contre-jour raconte cela sans une ligne de texte, et il laisse a la carte de
   texte le seul endroit lumineux de l'image — c'est elle qu'on doit lire.
--------------------------------------------------------------------------- */

const TAU = Math.PI * 2;

/* LA SCENE FAIT PEUR, ET C'EST LA SECONDE VERSION (07/10, « les scenes ne
   font pas assez peur »). La premiere etait une gravure : une lune pale et
   ronde, deux silhouettes nettes, un cimetiere qui defile. Belle, et calme —
   rien n'y menacait le regard. Ce qui fait peur dans une image fixe tient en
   quatre choses, et elles sont ajoutees dans cet ordre :

     - CE QU'ON NE VOIT PAS EN ENTIER : des nuages passent sur la lune, une
       brume monte du sol, les bords de l'image se noient dans le noir ;
     - CE QUI REGARDE : des paires d'yeux s'allument et s'eteignent entre les
       tombes. Il n'y a pas qu'une bete ;
     - CE QUI SURGIT : un eclair, deux fois par histoire, decoupe tout en
       blanc — et c'est a ce moment-la qu'on voit vraiment la bete ;
     - CE QUI EST TROP PRES : apres une morsure, la bete n'est plus au loin
       a hurler. Sa tete occupe le premier plan, de face, les yeux sur nous.

   La lune devient rousse : c'est la couleur des yeux, et le seul rouge de la
   scene avec eux. */

/** Un tirage fixe : les memes yeux et les memes eclairs d'une image a l'autre. */
function hasard(k: number): number {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * L'eclair a l'instant `t` : 0 la plupart du temps, 1 au plus fort. Il frappe
 * en deux coups rapproches, comme un vrai — un seul flash se lit comme une
 * erreur d'affichage. Le premier tombe a 1,6 s, quand la premiere ligne vient
 * d'apparaitre et que l'oeil s'est pose sur le texte.
 */
function eclairA(t: number): number {
  const DATES = [1.6, 6.4, 11.8, 17.5];
  let e = 0;
  for (const d of DATES) {
    const u = t - d;
    if (u < 0 || u > 0.9) continue;
    e = Math.max(e, Math.exp(-u * 9) + (u > 0.16 ? 0.8 * Math.exp(-(u - 0.16) * 6) : 0));
  }
  return Math.min(1, e);
}

let grain: HTMLCanvasElement | null = null;
/** Une trame de bruit, faite une fois : la pellicule d'une vieille bande. */
function trameDeGrain(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const g = grain.getContext('2d')!;
  const im = g.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random() * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return grain;
}

/**
 * Peindre la scene, a l'instant `t` (en secondes depuis son debut).
 *
 * `mordu` decide de ce qu'on regarde : la bete court derriere l'homme, ou
 * l'homme est a terre et la bete est sur nous. Le reste est la meme nuit.
 */
export function peindreLaScene(
  ctx: CanvasRenderingContext2D, L: number, H: number, t: number, mordu: boolean,
) {
  // La ligne de sol remonte en portrait : la carte de texte se pose en bas,
  // sur toute la largeur, et les silhouettes doivent rester au-dessus d'elle.
  const portrait = H > L * 1.1;
  const sol = H * (portrait ? 0.54 : 0.78);
  const m = Math.min(L / 12, H / (portrait ? 11 : 7));
  const eclair = eclairA(t);

  // LA SECOUSSE : l'eclair, et les appuis de la bete quand elle court.
  ctx.save();
  const tremble = eclair * m * 0.10 + (mordu ? 0 : Math.max(0, Math.sin(t * 3.4 * TAU)) * m * 0.02);
  ctx.translate((hasard(Math.floor(t * 30)) - 0.5) * tremble, (hasard(Math.floor(t * 30) + 7) - 0.5) * tremble);

  // LE CIEL : un noir qui tire au sang vers l'horizon.
  const ciel = ctx.createLinearGradient(0, 0, 0, sol);
  ciel.addColorStop(0, 'rgb(5,3,9)');
  ciel.addColorStop(0.7, 'rgb(26,8,18)');
  ciel.addColorStop(1, 'rgb(58,14,20)');
  ctx.fillStyle = ciel;
  ctx.fillRect(-m, -m, L + 2 * m, sol + m);

  // LA LUNE ROUSSE, a gauche (la seule zone libre des deux orientations, voir
  // FinDeLaNuit), et les silhouettes se decoupent dessus.
  const lx = L * 0.24, ly = sol - H * 0.36, lr = Math.min(L, H) * 0.19;
  const respire = 1 + Math.sin(t * 0.9) * 0.04;
  const halo = ctx.createRadialGradient(lx, ly, lr * 0.6, lx, ly, lr * 3.4 * respire);
  halo.addColorStop(0, 'rgba(220,60,36,0.34)');
  halo.addColorStop(1, 'rgba(220,60,36,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 3.4 * respire, 0, TAU); ctx.fill();
  const disque = ctx.createRadialGradient(lx - lr * 0.3, ly - lr * 0.3, lr * 0.1, lx, ly, lr);
  disque.addColorStop(0, 'rgb(236,120,74)');
  disque.addColorStop(1, 'rgb(170,44,30)');
  ctx.fillStyle = disque;
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(110,22,18,0.45)';
  for (const [dx, dy, r] of [[-0.34, -0.22, 0.20], [0.26, 0.10, 0.26], [-0.08, 0.40, 0.14]]) {
    ctx.beginPath(); ctx.arc(lx + dx * lr, ly + dy * lr, r * lr, 0, TAU); ctx.fill();
  }

  // LES NUAGES, qui passent devant la lune et la mangent par moments. Des
  // bords flous : en aplats nets, ils faisaient des barres noires posees sur
  // l'image, pas un ciel.
  for (let k = 0; k < 4; k++) {
    const v = 0.035 + 0.02 * k;
    const cx = ((hasard(k) * 1.6 + t * v) % 1.6 - 0.3) * L;
    const cy = ly + (hasard(k + 9) - 0.5) * lr * 2.2;
    const R = lr * (1.5 + hasard(k + 3));
    for (const [dx, a] of [[-0.35, 0.55], [0, 0.75], [0.4, 0.5]]) {
      ctx.save();
      ctx.translate(cx + dx * R, cy);
      ctx.scale(1, 0.14 + 0.08 * hasard(k + 5));
      const n = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
      n.addColorStop(0, `rgba(8,3,8,${a})`);
      n.addColorStop(1, 'rgba(8,3,8,0)');
      ctx.fillStyle = n;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // L'ECLAIR. Le ciel blanchit, et une fourche descend sur l'horizon : tout
  // ce qui est devant devient une decoupe noire nette.
  if (eclair > 0.02) {
    ctx.fillStyle = `rgba(214,206,236,${0.85 * eclair})`;
    ctx.fillRect(-m, -m, L + 2 * m, sol + m);
    const graine = Math.floor((t + 0.9) / 5);
    ctx.strokeStyle = `rgba(255,255,255,${eclair})`;
    ctx.lineWidth = Math.max(1.5, m * 0.05);
    ctx.beginPath();
    let x = L * (0.55 + 0.35 * hasard(graine)), y = 0;
    ctx.moveTo(x, y);
    for (let k = 1; k <= 7; k++) {
      x += (hasard(graine * 13 + k) - 0.5) * m * 1.6;
      y = sol * 0.85 * k / 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // LE SOL, presque noir, qui s'enfonce dans la nuit.
  const terre = ctx.createLinearGradient(0, sol, 0, H);
  terre.addColorStop(0, 'rgb(12,10,12)');
  terre.addColorStop(1, 'rgb(3,3,4)');
  ctx.fillStyle = terre;
  ctx.fillRect(-m, sol, L + 2 * m, H - sol + m);
  ctx.fillStyle = 'rgba(160,60,40,0.22)';
  ctx.fillRect(0, sol, L, 2);

  // LES TOMBES, LES CYPRES ET UN ARBRE MORT, en contre-jour, qui defilent.
  const glisse = (t * 26) % (L + 400);
  ctx.fillStyle = 'rgb(7,6,9)';
  ctx.strokeStyle = 'rgb(7,6,9)';
  for (let k = 0; k < 9; k++) {
    const x = ((k * 190 - glisse) % (L + 400) + L + 400) % (L + 400) - 200;
    if (k % 3 === 2) {
      ctx.beginPath();
      ctx.moveTo(x, sol);
      ctx.quadraticCurveTo(x - m * 0.30, sol - m * 1.5, x, sol - m * 2.6);
      ctx.quadraticCurveTo(x + m * 0.30, sol - m * 1.5, x, sol);
      ctx.fill();
    } else if (k === 4) {
      arbreMort(ctx, x, sol, m);
    } else {
      const l = m * 0.42, h = m * (0.62 + (k % 4) * 0.12);
      const pente = ((k * 37) % 11 - 5) * 0.03;
      ctx.save();
      ctx.translate(x, sol); ctx.rotate(pente);
      ctx.beginPath();
      ctx.moveTo(-l, 0); ctx.lineTo(-l, -h + l);
      ctx.arc(0, -h + l, l, Math.PI, 0);
      ctx.lineTo(l, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // LES YEUX DANS LE NOIR. Cinq paires, chacune a son rythme : elles
  // s'allument, restent, clignent, s'eteignent. Jamais deux en meme temps au
  // meme endroit, et jamais sur la lune — elles sont dans la terre sombre.
  for (let k = 0; k < 5; k++) {
    const periode = 3.2 + hasard(k + 20) * 3;
    const u = ((t + hasard(k + 30) * periode) % periode) / periode;
    if (u > 0.45) continue;
    const allume = Math.min(1, u / 0.08) * Math.min(1, (0.45 - u) / 0.08);
    const cligne = Math.abs(((u * periode) % 1.3) - 0.6) < 0.05 ? 0.1 : 1;
    const ex = L * (0.42 + 0.55 * hasard(k + 40 + Math.floor((t + hasard(k + 30) * periode) / periode)));
    const ey = sol + (H - sol) * (portrait ? 0.06 : 0.12) * hasard(k + 50) - m * 0.15;
    const r = m * (0.035 + 0.02 * hasard(k + 60));
    ctx.fillStyle = `rgba(255,${50 + 40 * hasard(k)},30,${0.9 * allume * cligne})`;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(ex + s * r * 2.2, ey, r, r * 0.6, 0, 0, TAU); ctx.fill();
    }
  }

  // LA BRUME, qui monte du sol par nappes et noie les pieds de tout le monde.
  for (let k = 0; k < 5; k++) {
    const v = 8 + 10 * hasard(k + 70);
    const bx = ((hasard(k + 80) * (L + 600) + t * v) % (L + 600)) - 300;
    const by = sol + m * (0.1 - 0.35 * hasard(k + 90));
    const br = m * (2.4 + 1.5 * hasard(k + 100));
    const nappe = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    nappe.addColorStop(0, `rgba(150,120,140,${0.16 + 0.10 * eclair})`);
    nappe.addColorStop(1, 'rgba(150,120,140,0)');
    ctx.fillStyle = nappe;
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.35, 0, 0, TAU); ctx.fill();
  }

  // LES SILHOUETTES.
  const cycle = (t * 3.4) % 1;
  ctx.fillStyle = 'rgb(4,3,6)';
  ctx.strokeStyle = 'rgb(4,3,6)';
  if (mordu) {
    // L'homme a terre, au loin, contre la lune. Et la bete sur nous.
    silhouetteTombee(ctx, L * 0.24, sol, m, t);
    teteDeFace(ctx, L, H, sol, m, t, eclair, portrait);
  } else {
    silhouetteChien(ctx, L * 0.09, sol, m * 1.25, cycle, t);
    silhouetteCoureur(ctx, L * 0.32, sol, m, cycle);
  }

  // LE NOIR QUI SE REFERME SUR LES BORDS, plus fort quand l'eclair retombe.
  const vignette = ctx.createRadialGradient(L * 0.45, sol * 0.8, Math.min(L, H) * 0.25,
                                            L * 0.45, sol * 0.8, Math.max(L, H) * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${0.82 - 0.4 * eclair})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(-m, -m, L + 2 * m, H + 2 * m);

  // LE GRAIN, d'une vieille bande : il bouge a chaque image.
  const motif = ctx.createPattern(trameDeGrain(), 'repeat');
  if (motif) {
    ctx.globalAlpha = 0.07;
    ctx.translate(hasard(Math.floor(t * 24)) * 128, hasard(Math.floor(t * 24) + 3) * 128);
    ctx.fillStyle = motif;
    ctx.fillRect(-256, -256, L + 512, H + 512);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Un arbre mort : un tronc tordu et des branches nues, comme des doigts. */
function arbreMort(ctx: CanvasRenderingContext2D, x: number, sol: number, m: number) {
  ctx.lineCap = 'round';
  const branche = (x0: number, y0: number, a: number, l: number, w: number, n: number) => {
    const x1 = x0 + Math.cos(a) * l, y1 = y0 - Math.sin(a) * l;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (n > 0) {
      branche(x1, y1, a + 0.5 + hasard(n + x0) * 0.3, l * 0.68, w * 0.62, n - 1);
      branche(x1, y1, a - 0.45 - hasard(n + y0) * 0.3, l * 0.62, w * 0.6, n - 1);
    }
  };
  branche(x, sol, Math.PI / 2 + 0.12, m * 1.3, m * 0.24, 4);
}

/**
 * LA TETE DE LA BETE, DE FACE, AU PREMIER PLAN — l'image de la morsure.
 *
 * Elle a remplace le chien assis qui hurlait a la lune : il racontait que
 * c'etait fini, la ou il fallait raconter que ca ne l'est pas. La tete monte
 * du bas de l'image, plus large que l'homme a terre n'est haut, et elle
 * respire. On ne voit d'elle que la masse noire, deux yeux en braise et les
 * crocs — l'eclair seul la decoupe en entier.
 */
function teteDeFace(ctx: CanvasRenderingContext2D, L: number, H: number, sol: number,
                    m: number, t: number, eclair: number, portrait: boolean) {
  // Elle monte pendant la premiere seconde, puis respire.
  const monte = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
  const s = Math.min(L, H) * (portrait ? 0.42 : 0.36) * (1 + Math.sin(t * 1.7) * 0.015);
  const cx = L * (portrait ? 0.66 : 0.40);
  // la gueule au-dessus de la carte de texte, qui couvre le bas de l'image
  const cy = sol - s * (portrait ? 0.12 : 0.02) + (1 - monte) * s * 1.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgb(3,2,5)';
  // les epaules, qui sortent du cadre
  ctx.beginPath(); ctx.ellipse(0, s * 0.95, s * 1.15, s * 0.65, 0, 0, TAU); ctx.fill();
  // les oreilles, courtes et couchees : grandes et dressees, elles faisaient
  // un chat, ou un hibou
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * s * 0.30, -s * 0.46);
    ctx.lineTo(k * s * 0.62, -s * 0.66);
    ctx.lineTo(k * s * 0.52, -s * 0.30);
    ctx.closePath(); ctx.fill();
  }
  // les cretes de l'echine, derriere la nuque
  for (let k = -3; k <= 3; k++) {
    const bx = k * s * 0.17, by = -s * 0.42 + Math.abs(k) * s * 0.06;
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.06, by); ctx.lineTo(bx + k * s * 0.02, by - s * (0.30 - Math.abs(k) * 0.03));
    ctx.lineTo(bx + s * 0.06, by);
    ctx.closePath(); ctx.fill();
  }
  // le crane et les bajoues
  ctx.beginPath(); ctx.ellipse(0, -s * 0.18, s * 0.50, s * 0.42, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.58, s * 0.34, 0, 0, TAU); ctx.fill();
  // la gueule ouverte : le fond rouge sombre, puis les crocs
  const ouvre = s * (0.16 + 0.03 * Math.sin(t * 2.3));
  ctx.fillStyle = 'rgb(62,6,10)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.30, s * 0.30, ouvre, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(232,226,214)';
  const croc = (x: number, y: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.035, y); ctx.lineTo(x, y + h); ctx.lineTo(x + s * 0.035, y);
    ctx.closePath(); ctx.fill();
  };
  for (const x of [-0.20, -0.09, 0.09, 0.20]) croc(x * s, s * 0.30 - ouvre * 0.85, s * (Math.abs(x) > 0.15 ? 0.15 : 0.08));
  for (const x of [-0.16, 0.16]) croc(x * s, s * 0.30 + ouvre * 0.85, -s * 0.10);
  // la bave, qui tombe d'un croc
  ctx.fillStyle = 'rgba(220,220,230,0.55)';
  const goutte = (t * 0.8) % 1;
  ctx.beginPath(); ctx.ellipse(s * 0.20, s * 0.47 + goutte * s * 0.5, s * 0.012, s * 0.03, 0, 0, TAU); ctx.fill();
  // la truffe
  ctx.fillStyle = 'rgb(3,2,5)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.02, s * 0.15, s * 0.09, 0, 0, TAU); ctx.fill();
  // LES YEUX : deux fentes en braise, le coin interieur plus bas, et une
  // arcade qui tombe dessus. Ronds, ils etaient ceux d'une peluche ; c'est le
  // sourcil qui fait la colere.
  const pulse = 0.85 + 0.15 * Math.sin(t * 6.5);
  for (const k of [-1, 1]) {
    const ox = k * s * 0.22, oy = -s * 0.20;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, s * 0.26 * pulse);
    g.addColorStop(0, 'rgba(255,90,40,0.7)');
    g.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox, oy, s * 0.26 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgb(255,${130 + 80 * eclair},70)`;
    ctx.beginPath(); ctx.ellipse(ox, oy, s * 0.10, s * 0.032, -k * 0.38, 0, TAU); ctx.fill();
    // l'arcade, en biais vers la truffe
    ctx.fillStyle = 'rgb(3,2,5)';
    ctx.beginPath();
    ctx.moveTo(k * s * 0.06, oy - s * 0.005);
    ctx.lineTo(k * s * 0.38, oy - s * 0.075);
    ctx.lineTo(k * s * 0.40, oy - s * 0.22);
    ctx.lineTo(k * s * 0.04, oy - s * 0.22);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Un coureur en contre-jour, jambes et bras en pleine foulee. */
function silhouetteCoureur(ctx: CanvasRenderingContext2D, x: number, sol: number,
                           m: number, cycle: number) {
  const a = cycle * TAU;
  const h = m * 1.75;
  const bassin = sol - h * 0.52;
  const epaule = sol - h * 0.86;
  const bond = Math.abs(Math.sin(a)) * m * 0.10;
  const y0 = sol - bond;

  ctx.lineCap = 'round';
  // jambes
  for (const s of [1, -1]) {
    const p = a + (s > 0 ? 0 : Math.PI);
    const genou = [x + Math.sin(p) * m * 0.34, bassin - bond + m * 0.42];
    const pied = [x + Math.sin(p) * m * 0.62, y0 - Math.max(0, Math.sin(p)) * m * 0.30];
    ctx.lineWidth = m * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, bassin - bond); ctx.lineTo(genou[0], genou[1]); ctx.lineTo(pied[0], pied[1]);
    ctx.stroke();
  }
  // bras
  for (const s of [1, -1]) {
    const p = a + (s > 0 ? Math.PI : 0);
    ctx.lineWidth = m * 0.11;
    ctx.beginPath();
    ctx.moveTo(x, epaule - bond);
    ctx.lineTo(x + Math.sin(p) * m * 0.30, epaule - bond + m * 0.28);
    ctx.lineTo(x + Math.sin(p) * m * 0.52, epaule - bond + Math.cos(p) * m * 0.10);
    ctx.stroke();
  }
  // tronc et tete
  ctx.lineWidth = m * 0.26;
  ctx.beginPath();
  ctx.moveTo(x, bassin - bond); ctx.lineTo(x + m * 0.06, epaule - bond); ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + m * 0.10, epaule - bond - m * 0.20, m * 0.17, 0, TAU); ctx.fill();
}

/**
 * La bete en contre-jour, au galop.
 *
 * SES PATTES SUIVENT LA MEME FOULEE QUE CELLE DU JEU, et pas un cercle.
 * Elles en decrivaient un — un cosinus pour l'avancee, un sinus pour la
 * hauteur — et le resultat se voyait a la page d'apercu : quatre pieds qui
 * tournaient comme des pedales sous un corps immobile. Le contact se fait
 * donc au sol, en reculant sous le corps, et le rappel ramene la patte
 * devant en la repliant, exactement comme `pied()` dans halloween-molosse.js.
 */
function silhouetteChien(ctx: CanvasRenderingContext2D, x: number, sol: number,
                         mesure: number, cycle: number, t = 0) {
  // LA BETE EST PLUS GRANDE ICI QUE SUR LA PISTE, ET C'EST VOULU.
  //
  // A l'echelle exacte — la moitie d'un coureur — elle faisait quarante
  // pixels de haut dans cette scene, et ses pattes se confondaient en une
  // masse : on voyait une barre noire avec un oeil rouge. Or cette image
  // n'est pas une vue de la piste, c'est un souvenir, et un souvenir grossit
  // ce qui a fait peur. Un tiers de plus suffit a rendre le galop lisible
  // sans qu'elle depasse l'homme.
  const m = mesure * 1.35;
  const dos = sol - m * 0.86;
  const bond = Math.max(0, Math.sin(cycle * TAU - 0.6)) * m * 0.12;
  const y = dos - bond;
  const amp = m * 0.52;
  ctx.lineCap = 'round';

  // Les quatre pattes, aux memes decalages de phase que le galop du jeu.
  const phases = [0, 0.12, 0.45, 0.57];
  for (let k = 0; k < 4; k++) {
    const u = (cycle + phases[k]) % 1;
    const avant = k >= 2;
    const hx = x + (avant ? m * 0.58 : -m * 0.50);
    const hy = y + m * 0.06;
    // Contact sur la premiere moitie, rappel sur la seconde : la patte quitte
    // le sol, se replie et revient devant.
    let px: number, py: number;
    if (u < 0.5) { px = amp * (0.5 - u / 0.5); py = 0; }
    else { const q = (u - 0.5) / 0.5; px = amp * (-0.5 + q); py = Math.sin(q * Math.PI) * amp * 0.52; }
    const fx = hx + px;
    const fy = sol - bond - py;
    // Le coude, pousse vers l'avant devant et vers l'arriere derriere : c'est
    // lui qui fait lire un quadrupede plutot qu'un homme a quatre jambes.
    const mx = (hx + fx) * 0.5 + (avant ? m * 0.07 : -m * 0.10);
    const my = (hy + fy) * 0.5;
    ctx.lineWidth = m * 0.10;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.lineTo(fx, fy); ctx.stroke();
  }

  // Le tronc : le poitrail plus haut et plus epais que le rein.
  ctx.lineWidth = m * 0.30;
  ctx.beginPath(); ctx.moveTo(x - m * 0.54, y + m * 0.06); ctx.lineTo(x + m * 0.58, y); ctx.stroke();
  ctx.lineWidth = m * 0.38;
  ctx.beginPath(); ctx.moveTo(x + m * 0.24, y); ctx.lineTo(x + m * 0.56, y + m * 0.02); ctx.stroke();

  // La queue, tendue vers l'arriere comme celle du jeu.
  ctx.lineWidth = m * 0.08;
  ctx.beginPath();
  ctx.moveTo(x - m * 0.54, y + m * 0.04);
  ctx.lineTo(x - m * 1.02, y - m * 0.04 + Math.sin(cycle * TAU * 1.5) * m * 0.14);
  ctx.stroke();

  // Cou, crane, museau — la tete basse, en position de poursuite.
  ctx.lineWidth = m * 0.22;
  ctx.beginPath(); ctx.moveTo(x + m * 0.52, y); ctx.lineTo(x + m * 0.88, y + m * 0.16); ctx.stroke();
  ctx.lineWidth = m * 0.16;
  ctx.beginPath(); ctx.moveTo(x + m * 0.88, y + m * 0.16); ctx.lineTo(x + m * 1.24, y + m * 0.20); ctx.stroke();

  // L'oreille, couchee vers l'arriere.
  ctx.beginPath();
  ctx.moveTo(x + m * 0.86, y + m * 0.02);
  ctx.lineTo(x + m * 0.62, y - m * 0.24);
  ctx.lineTo(x + m * 0.84, y + m * 0.10);
  ctx.closePath(); ctx.fill();

  // LA GUEULE OUVERTE, et deux crocs qui accrochent la lumiere de la lune.
  ctx.fillStyle = 'rgb(232,226,214)';
  for (const [dx, sens] of [[1.12, 1], [1.02, 1], [1.08, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + m * (dx - 0.025), y + m * 0.22);
    ctx.lineTo(x + m * dx, y + m * (0.22 + sens * 0.08));
    ctx.lineTo(x + m * (dx + 0.025), y + m * 0.22);
    ctx.closePath(); ctx.fill();
  }

  // SON SOUFFLE, en buee devant le museau : deux bouffees par foulee.
  for (let k = 0; k < 3; k++) {
    const u = ((t * 2 + k / 3) % 1);
    ctx.fillStyle = `rgba(190,170,190,${0.22 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(x + m * (1.30 + u * 0.5), y + m * (0.18 - u * 0.12), m * (0.06 + u * 0.16), 0, TAU);
    ctx.fill();
  }

  // L'OEIL, le seul point clair de la silhouette, et son halo qui bat.
  const ox = x + m * 0.96, oy = y + m * 0.12;
  const pulse = 0.8 + 0.2 * Math.sin(t * 7);
  const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, m * 0.30 * pulse);
  halo.addColorStop(0, 'rgba(255,80,40,0.8)');
  halo.addColorStop(1, 'rgba(255,40,20,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(ox, oy, m * 0.30 * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(255,120,60)';
  ctx.beginPath(); ctx.arc(ox, oy, m * 0.055, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(4,3,6)';
}

/**
 * L'homme, au sol, qui se redresse sur un coude.
 *
 * Il n'est ni mort ni mange : il est assis dans l'herbe, et il regarde la bete
 * hurler. Toute la serie des morsures tient dans cet ecart — ce qui est arrive
 * est grave, et la scene est calme.
 */
function silhouetteTombee(ctx: CanvasRenderingContext2D, x: number, sol: number,
                          m: number, t: number) {
  const respire = Math.sin(t * 3.1) * m * 0.015;
  ctx.lineCap = 'round';
  // les jambes, allongees devant lui
  ctx.lineWidth = m * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, sol - m * 0.16);
  ctx.lineTo(x - m * 0.52, sol - m * 0.20);
  ctx.lineTo(x - m * 0.86, sol - m * 0.04);
  ctx.stroke();
  // le tronc, incline en arriere
  ctx.lineWidth = m * 0.24;
  ctx.beginPath();
  ctx.moveTo(x, sol - m * 0.18);
  ctx.lineTo(x + m * 0.26, sol - m * 0.70 + respire);
  ctx.stroke();
  // le bras qui le tient
  ctx.lineWidth = m * 0.10;
  ctx.beginPath();
  ctx.moveTo(x + m * 0.24, sol - m * 0.62);
  ctx.lineTo(x + m * 0.46, sol - m * 0.30);
  ctx.lineTo(x + m * 0.44, sol);
  ctx.stroke();
  // la tete, tournee vers la bete
  ctx.beginPath();
  ctx.arc(x + m * 0.32, sol - m * 0.88 + respire, m * 0.16, 0, TAU);
  ctx.fill();
}
