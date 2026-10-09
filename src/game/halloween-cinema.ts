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
// 2. ON NE MONTRE JAMAIS LA BLESSURE. La scenette parle d'une cicatrice qui
//    chauffe, d'un miroir, de traces autour d'un lit. La peur vient de ce qui
//    revient la nuit, pas de ce qui saigne : c'est ce qui separe une histoire
//    qui glace d'un truc desagreable. Un jeu ou l'on court se joue aussi chez
//    des gens de douze ans.
//
// ET ON NE FAIT PAS L'INVENTAIRE DE CE QUI EST ARRACHE (09/10). La serie du
// 08/10 faisait perdre un short, un petit doigt, une oreille, un nom : ecrit
// au plus froid, le principe restait un gag. Voir MORSURES.
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
   APRES LA MORSURE — les nuits perdues
   ---------------------------------------------------------------------------
   PLUS DE LISTE DE CE QU'IL A PERDU (09/10, « les cartes restent droles »).
   La serie precedente comptait les pertes — le short, le petit doigt,
   l'oreille, son nom — et le principe meme faisait gag : un inventaire
   d'objets arraches se lit comme une chute, pas comme une menace. Celle-ci
   ne retire rien au joueur. Elle dit que la bete l'a MARQUE et qu'elle
   revient : une cicatrice qui chauffe, des yeux dans un miroir, des traces
   autour du lit. Toujours aucune blessure montree, et le froid sur la
   derniere ligne.
--------------------------------------------------------------------------- */
export const MORSURES: readonly Scene[] = [
  {
    cle: 'marque',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['LA MARQUE', 'THE MARK'],
    lignes: [
      ['La morsure a guéri en une nuit. Sans un point.',
       'The bite healed overnight. Not a single stitch.'],
      ['Il reste quatre petites marques, en demi-cercle.',
       'Four small marks are left, in a half circle.'],
      ['Chaque soir, elles sont un peu plus chaudes.',
       'Every evening, they are a little warmer.'],
      ['Ce soir, elles battent. Comme des pas qui approchent.',
       'Tonight they throb. Like footsteps coming closer.'],
    ],
  },
  {
    cle: 'miroir',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['LE MIROIR', 'THE MIRROR'],
    lignes: [
      ['Rentré chez lui, il s\'est lavé le visage dans le noir.',
       'Back home, he washed his face in the dark.'],
      ['Dans le miroir, ses yeux ont brillé. Rouges.',
       'In the mirror, his eyes glowed. Red.'],
      ['Une seconde à peine. Il a cru rêver.',
       'Only for a second. He thought he was dreaming.'],
      ['Puis deux autres yeux se sont allumés, derrière lui.',
       'Then two more eyes lit up, behind him.'],
    ],
  },
  {
    cle: 'appel',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['L’APPEL', 'THE CALL'],
    lignes: [
      ['À 3 h 12, son téléphone a sonné. Numéro masqué.',
       'At 3:12 his phone rang. Number withheld.'],
      ['Il a décroché. Personne. Juste un souffle, lent.',
       'He answered. Nobody. Just slow breathing.'],
      ['Puis des griffes, tout près du micro.',
       'Then claws, right against the microphone.'],
      ['Le même souffle, derrière la porte de sa chambre.',
       'The same breathing, behind his bedroom door.'],
    ],
  },
  {
    cle: 'traces',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['LES TRACES', 'THE TRACKS'],
    lignes: [
      ['Au matin, il y avait de la terre sur son parquet.',
       'In the morning, there was soil on his floor.'],
      ['Des traces de pattes, larges comme une main.',
       'Paw prints, as wide as a hand.'],
      ['Elles faisaient le tour de son lit. Lentement.',
       'They circled his bed. Slowly.'],
      ['Elles ne ressortaient nulle part.',
       'They did not lead out anywhere.'],
    ],
  },
  {
    cle: 'faim',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['LA FAIM', 'THE HUNGER'],
    lignes: [
      ['Depuis la morsure, la lumière lui brûle les yeux.',
       'Since the bite, light burns his eyes.'],
      ['Il mange la nuit, debout, sans allumer.',
       'He eats at night, standing, lights off.'],
      ['Hier, les chiens du quartier aboyaient sur son passage.',
       'Yesterday, the neighbourhood dogs barked at him.'],
      ['Aujourd\'hui, ils se taisent. Et ils baissent la tête.',
       'Today they fall silent. And they lower their heads.'],
    ],
  },
  {
    cle: 'tombe',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['LA TOMBE', 'THE GRAVE'],
    lignes: [
      ['Le gardien l\'a appelé : une tombe neuve, au fond.',
       'The keeper called him: a new grave, at the back.'],
      ['Pas de fleurs, pas de date. Juste un nom gravé.',
       'No flowers, no date. Just a carved name.'],
      ['Le sien.',
       'His own.'],
      ['Et tout autour, la terre labourée par des griffes.',
       'And all around, the earth torn up by claws.'],
    ],
  },
  {
    cle: 'sommeil',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['SON SOMMEIL', 'HIS SLEEP'],
    lignes: [
      ['Elle ne l\'a pas lâché. Elle a seulement desserré.',
       'It did not let go. It only loosened its grip.'],
      ['Dès qu\'il ferme les yeux, il est de retour au cimetière.',
       'Whenever he closes his eyes, he is back in the cemetery.'],
      ['Et il court. Il court toute la nuit.',
       'And he runs. He runs all night.'],
      ['Chaque nuit, la bête part un peu plus près de lui.',
       'Every night, the beast starts a little closer.'],
    ],
  },
  {
    cle: 'odeur',
    sur: ['APRÈS LA MORSURE', 'AFTER THE BITE'],
    titre: ['L’ODEUR', 'THE SCENT'],
    lignes: [
      ['Elle l\'a lâché à la grille. Elle avait son odeur.',
       'It let go at the gate. It had his scent.'],
      ['Il a changé de rue. Puis de ville. Puis de nom.',
       'He changed streets. Then towns. Then his name.'],
      ['Hier soir, sous sa fenêtre, quelque chose a reniflé.',
       'Last night, under his window, something sniffed.'],
      ['Elle n\'a jamais perdu une piste.',
       'It has never lost a trail.'],
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

  // LA NUIT TENUE EST UNE IMAGE (09/10) quand elle est chargee : elle couvre
  // tout ce qui precede (ciel, lune, tombes) ; la brume, l'eclair, le noir des
  // bords et le grain passent par-dessus comme sur le reste. Voir
  // imageDeVictoire.
  const fond = mordu ? null : victoire;
  if (fond) peindreLaVictoire(ctx, fond, L, H, t, eclair);

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
  // RIEN DE DESSINE AU TRAIT N'Y RESTE (09/10, « les cartes restent droles ») :
  // le chien en silhouette et l'homme couche a terre se lisaient comme des
  // figurines de dessin anime. Il ne reste que la bete en image, et un homme
  // minuscule en contre-jour quand il s'en sort.
  if (mordu) {
    // La bete sur nous, et rien d'autre.
    teteDeFace(ctx, L, H, sol, m, t, eclair, portrait);
  } else if (!fond) {
    // Il court vers la lune, petit et loin. La bete ne le poursuit plus : elle
    // le REGARDE partir, du noir du premier plan. Elle sait ou il habite.
    silhouetteCoureur(ctx, L * 0.26, sol, m * 0.7, cycle);
    teteQuiGuette(ctx, L, H, sol, t, eclair, portrait);
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

/* LA TETE EST UNE IMAGE, PLUS UN DESSIN (09/10, « les cartes ne sont pas
   effrayantes mais droles »). Le trace au canvas — oreilles en triangles,
   crocs en dents de scie, yeux en fentes — se lisait comme un chat de dessin
   anime, quoi qu'on fasse du sourcil. La tete vient maintenant de FLUX
   (assets-sources/molosse-tete/, graine 1313) : un molosse de face qui sort du
   noir, les yeux en braise. Le fond de l'image est noir, et ses bords sont
   fondus une fois pour toutes (`teteFondue`) : posee sur le ciel rouge, elle
   n'a pas de cadre.

   Le fichier ne part pas en production (HORS_PRODUCTION, vite.config.ts). Tant
   qu'il n'est pas charge — ou s'il ne l'est jamais —, seuls deux yeux brulent
   dans le noir (`yeuxSeuls`) : l'ancien trace de la tete, qui faisait rire,
   ne revient jamais. */
let teteImage: HTMLImageElement | null = null;
let teteFondueCache: HTMLCanvasElement | null = null;
import('@/assets/molosse-tete.webp?url').then(m => {
  const url = m.default as string;
  if (!url) return;
  const im = new Image();
  im.onload = () => { teteImage = im; };
  im.src = url;
}).catch(() => { /* la doublure reste */ });

/** L'image de la tete, les bords fondus au noir transparent. */
function teteFondue(): HTMLCanvasElement | null {
  if (teteFondueCache || !teteImage) return teteFondueCache;
  const c = document.createElement('canvas');
  const W = c.width = c.height = teteImage.naturalWidth || 1024;
  const g = c.getContext('2d')!;
  g.drawImage(teteImage, 0, 0, W, W);
  g.globalCompositeOperation = 'destination-in';
  const masque = g.createRadialGradient(W * 0.5, W * 0.47, W * 0.20, W * 0.5, W * 0.47, W * 0.47);
  masque.addColorStop(0, 'rgba(0,0,0,1)');
  masque.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = masque;
  g.fillRect(0, 0, W, W);
  teteFondueCache = c;
  return c;
}

/* LA CARTE DE VICTOIRE (09/10, « les cartes restent droles »). Le chien en
   silhouette qui poursuivait le coureur se lisait comme un dessin anime. La
   scene vient de Tripo Studio (outil Image, Nano Banana, 9:16 ;
   assets-sources/molosse-victoire/) : un cimetiere dans le brouillard sous
   la lune rouge, l'homme minuscule qui s'enfuit sur l'allee, et la bete au
   premier plan qui le laisse partir — elle sait ou il habite. Le bas de
   l'image est noir : c'est la que se pose la carte de texte.

   Invite : « Vertical horror film still. Night, an old overgrown cemetery in
   heavy fog under a huge blood-red full moon in the upper left of the sky.
   Far away in the middle distance, a tiny lone athlete in running clothes
   sprints away along a path toward the moon, seen only as a dark silhouette.
   In the foreground on the right, crouched low between crooked gravestones,
   an enormous black mastiff hellhound watches him, mostly lost in shadow,
   only its two glowing ember-red eyes and its bared wet fangs catching the
   light. [...] No text, no letters, no logo. »

   Hors production comme la tete (HORS_PRODUCTION). Tant qu'elle n'est pas
   chargee, la scene dessinee (la tete qui guette) tient sa place. */
let victoire: HTMLImageElement | null = null;
import('@/assets/molosse-victoire.webp?url').then(m => {
  const url = m.default as string;
  if (!url) return;
  const im = new Image();
  im.onload = () => { victoire = im; };
  im.src = url;
}).catch(() => { /* la tete qui guette reste */ });

/** Les yeux de la bete dans l'image de victoire, mesures sur l'image (fractions). */
const YEUX_VICTOIRE = [[0.6354, 0.4825], [0.7043, 0.4811]];
/** Sa gueule (d'ou sort le souffle) et les deux filets de bave, au meme compte. */
const GUEULE_VICTOIRE = [0.671, 0.540];
const BAVE_VICTOIRE = [[0.655, 0.572], [0.686, 0.574]];
/** Le point vers lequel la camera s'avance : la bete. */
const FOYER_VICTOIRE = [0.67, 0.50];

/** L'image de victoire, en couverture (rognee sur les cotes en portrait). */
function peindreLaVictoire(ctx: CanvasRenderingContext2D, im: HTMLImageElement,
                          L: number, H: number, t: number, eclair: number) {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const k = Math.max(L / iw, H / ih);
  // LE TRAVELLING AVANT : la camera s'approche de la bete, lentement, sur
  // quatorze secondes — dix pour cent, assez pour qu'on le sente sans le voir.
  const u = Math.min(1, t / 14);
  const zoom = 1 + 0.10 * (1 - Math.pow(1 - u, 2));
  const w0 = iw * k, h0 = ih * k;
  const bx = (L - w0) * 0.5, by = (H - h0) * 0.42;
  const fx = bx + FOYER_VICTOIRE[0] * w0, fy = by + FOYER_VICTOIRE[1] * h0;
  const w = w0 * zoom, h = h0 * zoom;
  const x0 = fx - FOYER_VICTOIRE[0] * w, y0 = fy - FOYER_VICTOIRE[1] * h;
  // elle sort du noir pendant la premiere seconde
  const entre = Math.min(1, t / 1.0);
  ctx.save();
  ctx.fillStyle = 'rgb(3,2,5)';
  ctx.fillRect(-L, -H, 3 * L, 3 * H);
  ctx.globalAlpha = entre;
  ctx.drawImage(im, x0, y0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.35 * eclair;
    ctx.drawImage(im, x0, y0, w, h);
  }
  // LES YEUX BATTENT, et clignent lentement : l'image est une photo, ce sont
  // eux qui la font vivre.
  const pulse = 0.75 + 0.25 * Math.sin(t * 5.5);
  const cligne = ((t % 4.3) < 0.12) ? 0.1 : 1;
  ctx.globalAlpha = entre * cligne;
  for (const [u, v] of YEUX_VICTOIRE) {
    const ox = x0 + u * w, oy = y0 + v * h, r = w * 0.03 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(255,80,40,0.8)');
    g.addColorStop(1, 'rgba(255,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = entre;
  // SON SOUFFLE, en buee devant la gueule : une bouffee toutes les 1,7 s,
  // qui gonfle, monte un peu et se dissout dans le froid.
  const gx = x0 + GUEULE_VICTOIRE[0] * w, gy = y0 + GUEULE_VICTOIRE[1] * h;
  for (let i = 0; i < 2; i++) {
    const a = ((t + i * 0.85) % 1.7) / 1.7;
    const r = w * (0.03 + 0.09 * a);
    const cy = gy - a * w * 0.03;
    const b = ctx.createRadialGradient(gx, cy, 0, gx, cy, r);
    b.addColorStop(0, `rgba(200,210,225,${0.34 * (1 - a)})`);
    b.addColorStop(1, 'rgba(200,210,225,0)');
    ctx.fillStyle = b;
    ctx.beginPath(); ctx.ellipse(gx, cy, r * 1.3, r, 0, 0, TAU); ctx.fill();
  }
  // LA BAVE, qui s'etire puis tombe des crocs, chaque filet a son rythme.
  BAVE_VICTOIRE.forEach(([u0, v0], i) => {
    const a = ((t * 0.7 + i * 0.45) % 1);
    const bx2 = x0 + u0 * w, by2 = y0 + v0 * h;
    // le filet s'etire sous le croc, puis une goutte s'en detache et tombe
    const long = h * (0.003 + 0.010 * Math.min(1, a / 0.62));
    const chute = a > 0.62 ? (a - 0.62) / 0.38 : 0;
    ctx.fillStyle = 'rgba(190,198,210,0.30)';
    ctx.beginPath();
    ctx.ellipse(bx2, by2 + long * 0.5, w * 0.0018, long * 0.5, 0, 0, TAU);
    ctx.fill();
    if (chute > 0) {
      ctx.fillStyle = `rgba(190,198,210,${0.35 * (1 - chute)})`;
      ctx.beginPath();
      ctx.ellipse(bx2, by2 + long + chute * h * 0.05, w * 0.0022, w * 0.0035, 0, 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
}

/** Ou sont les yeux et le croc gauche dans l'image (fractions de son cote). */
const OEIL_G = [0.293, 0.230], OEIL_D = [0.6875, 0.215], CROC = [0.375, 0.80];

/**
 * LA TETE DE LA BETE, DE FACE, AU PREMIER PLAN — l'image de la morsure.
 *
 * Elle monte du bas pendant la premiere seconde, puis respire ; les yeux
 * battent, la bave tombe, et l'eclair la blanchit d'un coup.
 */
function teteDeFace(ctx: CanvasRenderingContext2D, L: number, H: number, sol: number,
                    m: number, t: number, eclair: number, portrait: boolean) {
  const img = teteFondue();
  if (!img) {
    const D = Math.min(L, H) * (portrait ? 0.92 : 0.83);
    yeuxSeuls(ctx, L * (portrait ? 0.62 : 0.40) - D / 2, sol - D * 0.6, D, t);
    return;
  }
  const monte = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
  const s = Math.min(L, H) * (portrait ? 0.42 : 0.36) * (1 + Math.sin(t * 1.7) * 0.015);
  const D = s * (portrait ? 2.2 : 2.3);
  const cx = L * (portrait ? 0.62 : 0.40);
  // la gueule au-dessus de la carte de texte, qui couvre le bas de l'image
  const cy = sol - s * (portrait ? 0.22 : 0.10) + (1 - monte) * s * 1.4;
  const x0 = cx - D / 2, y0 = cy - D / 2;
  ctx.save();
  ctx.globalAlpha = monte;
  ctx.drawImage(img, x0, y0, D, D);
  ctx.globalCompositeOperation = 'lighter';
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.45 * eclair;
    ctx.drawImage(img, x0, y0, D, D);
  }
  // LES YEUX BATTENT, comme un pouls : l'image seule est une photo, ce sont
  // eux qui la font vivre.
  const pulse = 0.75 + 0.25 * Math.sin(t * 6.5);
  ctx.globalAlpha = monte;
  for (const [u, v] of [OEIL_G, OEIL_D]) {
    const ox = x0 + u * D, oy = y0 + v * D, r = D * 0.06 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(255,90,30,0.75)');
    g.addColorStop(1, 'rgba(255,30,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // la bave, qui tombe d'un croc
  ctx.fillStyle = 'rgba(210,205,215,0.6)';
  const goutte = (t * 0.8) % 1;
  ctx.beginPath();
  ctx.ellipse(x0 + CROC[0] * D, y0 + CROC[1] * D + goutte * D * 0.18, D * 0.005, D * 0.014, 0, 0, TAU);
  ctx.fill();
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
 * Deux yeux en braise dans le noir. `x0, y0, D` : le cadre de l'image de la
 * tete (les yeux tombent ou ils sont sur elle), qu'elle soit dessinee ou non.
 */
function yeuxSeuls(ctx: CanvasRenderingContext2D, x0: number, y0: number, D: number, t: number) {
  // un clignement lent, toutes les quatre secondes
  const cligne = ((t % 4.1) < 0.12) ? 0.08 : 1;
  const pulse = 0.8 + 0.2 * Math.sin(t * 6.5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [u, v] of [OEIL_G, OEIL_D]) {
    const ox = x0 + u * D, oy = y0 + v * D;
    const r = D * 0.045 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, `rgba(255,120,50,${0.95 * cligne})`);
    g.addColorStop(0.25, `rgba(230,40,20,${0.6 * cligne})`);
    g.addColorStop(1, 'rgba(200,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ox, oy, r, r * 0.55 * cligne + 0.5, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

let teteEteinteCache: HTMLCanvasElement | null = null;
/** La tete fondue, assombrie aux trois quarts : on devine la masse, pas le detail. */
function teteEteinte(img: HTMLCanvasElement): HTMLCanvasElement {
  if (teteEteinteCache) return teteEteinteCache;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(2,1,4,0.72)';
  g.fillRect(0, 0, c.width, c.height);
  teteEteinteCache = c;
  return c;
}

/**
 * LA BETE QUI GUETTE — l'image de la nuit tenue.
 *
 * La meme tete que la morsure, mais presque eteinte : posee tres sombre au
 * premier plan, a droite, coupee par le bas de l'image. On n'en devine que
 * l'arrondi du crane et la truffe ; ce qui se voit, ce sont les yeux, qui
 * suivent l'homme minuscule qui s'enfuit vers la lune.
 */
function teteQuiGuette(ctx: CanvasRenderingContext2D, L: number, H: number, sol: number,
                       t: number, eclair: number, portrait: boolean) {
  const D = Math.min(L, H) * (portrait ? 1.05 : 0.95);
  const cx = L * (portrait ? 0.74 : 0.70);
  // elle se leve lentement du noir pendant les deux premieres secondes
  const leve = 1 - Math.pow(1 - Math.min(1, t / 2.2), 3);
  const cy = sol + D * 0.10 + (1 - leve) * D * 0.25;
  const img = teteFondue();
  const x0 = cx - D / 2, y0 = cy - D / 2;
  if (!img) { yeuxSeuls(ctx, x0, y0, D, t); return; }
  // OPAQUE, MAIS ETEINTE. Posee en transparence, elle laissait voir les
  // tombes a travers elle : un fantome, pas une bete. On la pose pleine et
  // assombrie (`teteEteinte`) ; l'eclair la revele en entier.
  ctx.save();
  ctx.globalAlpha = leve;
  ctx.drawImage(teteEteinte(img), x0, y0, D, D);
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.7 * eclair * leve;
    ctx.drawImage(img, x0, y0, D, D);
  }
  ctx.restore();
  // les yeux, eux, brulent fort — et ils clignent, lentement
  yeuxSeuls(ctx, x0, y0, D, t);
}
