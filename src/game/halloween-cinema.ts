// LA NUIT DU MOLOSSE — ce qu'on raconte apres la course.
//
// Quatorze scenettes : six pour les nuits tenues, huit pour les morsures. Elles
// sont le vrai contenu du mode — la course dure onze secondes, la scene reste.
//
// DEUX REGLES D'ECRITURE, ET ELLES VALENT PLUS QUE LE RESTE DU FICHIER.
//
// 1. LA CHUTE EST TOUJOURS SUR LA DERNIERE LIGNE, et les trois premieres ne
//    font que la charger. Une scenette qui expliquerait sa blague avant de la
//    finir n'en est pas une. Le jeu affiche les quatre lignes une par une, a
//    intervalle fixe : le rythme est celui d'une histoire racontee, et la
//    derniere ligne arrive dans un silence qu'on a le temps de sentir.
//
// 2. ON NE MONTRE JAMAIS LA BLESSURE. Le molosse arrache un mollet, une
//    oreille, un talon — et la scenette parle d'un rond-point, d'une lampe de
//    poche et d'un reglement de competition. C'est ce qui separe une plaisante-
//    rie macabre d'un truc desagreable : le gore se raconte au passe, de loin,
//    et par ses consequences administratives. Un jeu ou l'on court se joue
//    aussi chez des gens de douze ans.
//
// CE QUI SE PERD N'EST PAS TOUJOURS UN MORCEAU. Une scenette sur deux fait
// perdre autre chose — une ombre, des dimanches, la moitie d'un nom. La serie
// tiendrait mal sur huit membres arraches : au troisieme, le joueur sait ce
// qu'il va lire. L'alternance est ce qui garde la surprise jusqu'a la huitieme.
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
   CE QU'IL A COMPRIS — les nuits tenues
   ---------------------------------------------------------------------------
   Toutes racontent la meme chose sous six angles : un homme ordinaire
   decouvre, a cause d'un chien, qu'il court plus vite que sa vie ne le lui
   avait jamais demande. Aucune ne le dit en ces termes — c'est un tiers qui
   constate, un radar, un gardien, un club, un bus.

   LE HEROS N'EST JAMAIS FIER, et c'est ce qui les rend drôles. Il ne
   triomphe pas : il est promu, flashe, filme, refuse par un club. Sa vitesse
   lui arrive dessus comme un ennui administratif de plus.
--------------------------------------------------------------------------- */
export const TENUES: readonly Scene[] = [
  {
    cle: 'facteur',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['LA TOURNEE', 'THE ROUND'],
    lignes: [
      ['Le facteur du quartier avait un chien.', 'The local postman had a dog.'],
      ['Pendant six ans, il a distribue le courrier en marchant.',
       'For six years he delivered the mail at walking pace.'],
      ['Depuis cette nuit-la, il fait sa tournee en quatre minutes.',
       'Since that night he does the whole round in four minutes.'],
      ['La poste l\'a promu. Il n\'a jamais explique pourquoi.',
       'The post office promoted him. He never explained why.'],
    ],
  },
  {
    cle: 'radar',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['LE RADAR', 'THE SPEED CAMERA'],
    lignes: [
      ['Le radar de l\'avenue l\'a flashe a 2 h 40 du matin.',
       'The camera on the avenue flashed him at 2:40 in the morning.'],
      ['Le dossier a ete classe : pas de plaque d\'immatriculation.',
       'The case was dropped: no licence plate.'],
      ['Il a demande un tirage. Il l\'a fait encadrer.',
       'He asked for a print. He had it framed.'],
      ['C\'est le seul document au monde qui dise ce qu\'il vaut.',
       'It is the only document in the world that states what he is worth.'],
    ],
  },
  {
    cle: 'camera',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['LA BANDE', 'THE TAPE'],
    lignes: [
      ['Le gardien du cimetiere a revu la video du portail.',
       'The cemetery keeper reviewed the footage from the gate.'],
      ['Il a d\'abord cru a un defaut de compression.',
       'At first he assumed it was a compression glitch.'],
      ['Il l\'a montree a son fils, qui a dit : « papa, c\'est un monsieur ».',
       'He showed his son, who said: "dad, that\'s a man".'],
      ['Il a demissionne le lendemain matin.', 'He resigned the next morning.'],
    ],
  },
  {
    cle: 'bus',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['LE 7 H 12', 'THE 7:12'],
    lignes: [
      ['Il courait apres le bus de 7 h 12 depuis onze ans.',
       'He had been running for the 7:12 bus for eleven years.'],
      ['Il ne l\'avait jamais attrape une seule fois.',
       'He had never once caught it.'],
      ['Cette nuit-la, il a double le bus.', 'That night, he overtook the bus.'],
      ['Puis le suivant. Puis un scooter. Puis il a continue a pied.',
       'Then the next one. Then a scooter. Then he just kept going.'],
    ],
  },
  {
    cle: 'club',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['LA CANDIDATURE', 'THE APPLICATION'],
    lignes: [
      ['Le club d\'athletisme refusait ses dossiers depuis quatre ans.',
       'The athletics club had turned him down four years running.'],
      ['« Monsieur, on ne recrute plus au-dela de trente ans. »',
       '"Sir, we no longer recruit over the age of thirty."'],
      ['Il s\'est presente un mardi soir, un chien noir a six metres derriere.',
       'He turned up on a Tuesday evening, a black dog six metres behind him.'],
      ['Le club a cree une categorie.', 'The club created a new category.'],
    ],
  },
  {
    cle: 'lent',
    sur: ['CE QU\'IL A COMPRIS', 'WHAT HE WORKED OUT'],
    titre: ['CE QU\'ON LUI DISAIT', 'WHAT HE HAD BEEN TOLD'],
    lignes: [
      ['Toute sa vie, on lui avait dit qu\'il etait lent.',
       'All his life he had been told he was slow.'],
      ['Son professeur de sport le disait. Son pere le disait.',
       'His PE teacher said it. His father said it.'],
      ['Le molosse, lui, n\'a rien dit du tout.',
       'The hound, for its part, said nothing at all.'],
      ['Il a simplement couru tres vite. Et ca n\'a pas suffi.',
       'It simply ran very fast. And it was not enough.'],
    ],
  },
];

/* ---------------------------------------------------------------------------
   CE QU'IL A PERDU — les morsures
   ---------------------------------------------------------------------------
   Huit facons de se faire rattraper, et une seule regle : ce qui a ete
   arrache n'est jamais decrit. On apprend la perte par ce qu'elle change —
   un rond-point, une tasse de cafe, un reglement de competition, un contrat
   oral. La bete, elle, sort du cadre des la premiere ligne.
--------------------------------------------------------------------------- */
export const MORSURES: readonly Scene[] = [
  {
    cle: 'mollet',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE MOLLET GAUCHE', 'THE LEFT CALF'],
    lignes: [
      ['La bete n\'a pris qu\'une bouchee, et elle a bien choisi :',
       'The beast took a single bite, and it chose well:'],
      ['le mollet gauche. Celui qui poussait.',
       'the left calf. The one that pushed.'],
      ['Il court toujours. Il tire un peu sur la droite.',
       'He still runs. He pulls slightly to the right.'],
      ['On l\'a retrouve trois jours plus tard dans un rond-point.',
       'They found him three days later, circling a roundabout.'],
    ],
  },
  {
    cle: 'auriculaire',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE PETIT DOIGT', 'THE LITTLE FINGER'],
    lignes: [
      ['Le molosse lui a pris l\'auriculaire de la main gauche.',
       'The hound took the little finger of his left hand.'],
      ['« Un detail », a dit le medecin des urgences.',
       '"A detail," said the doctor in A&E.'],
      ['Il ne sait toujours pas boire un cafe sans lever le petit doigt.',
       'He still cannot drink a coffee without raising his little finger.'],
      ['Il ne l\'a plus. Le geste, lui, est reste.',
       'He no longer has it. The gesture stayed.'],
    ],
  },
  {
    cle: 'short',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE SHORT', 'THE SHORTS'],
    lignes: [
      ['La gueule s\'est refermee sur le short, et non sur la jambe.',
       'The jaws closed on the shorts, not on the leg.'],
      ['Il a franchi la ligne d\'arrivee. Il l\'a franchie le premier.',
       'He crossed the finish line. He crossed it first.'],
      ['Les commissaires ont refuse d\'homologuer le chrono.',
       'The officials refused to ratify the time.'],
      ['Le reglement est tres clair au sujet de la tenue.',
       'The rulebook is extremely clear on the subject of kit.'],
    ],
  },
  {
    cle: 'ombre',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['SON OMBRE', 'HIS SHADOW'],
    lignes: [
      ['La bete n\'a mordu aucun morceau de lui.',
       'The beast did not bite any part of him.'],
      ['Elle a happe son ombre, et elle l\'a emportee.',
       'It snapped up his shadow, and carried it off.'],
      ['Depuis, il marche en plein soleil sans rien projeter au sol.',
       'Since then he walks in full sun and casts nothing on the ground.'],
      ['Personne ne l\'a jamais remarque. C\'est ca, le pire.',
       'Nobody has ever noticed. That is the worst part.'],
    ],
  },
  {
    cle: 'nom',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LA FIN DE SON NOM', 'THE END OF HIS NAME'],
    lignes: [
      ['Ce qu\'il a laisse cette nuit-la n\'etait pas un membre.',
       'What he left behind that night was not a limb.'],
      ['C\'etait la seconde moitie de son nom de famille.',
       'It was the second half of his surname.'],
      ['Il s\'appelle desormais Jean-Pierre Cour.',
       'His name is now Jean-Pierre Brave.'],
      ['Il s\'appelait Jean-Pierre Courageux.',
       'It used to be Jean-Pierre Bravery.'],
    ],
  },
  {
    cle: 'talon',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['LE TALON DROIT', 'THE RIGHT HEEL'],
    lignes: [
      ['Le molosse a emporte le talon droit.',
       'The hound took the right heel.'],
      ['Chez un sprinteur, le talon droit ne sert presque a rien.',
       'On a sprinter, the right heel is of almost no use at all.'],
      ['Presque.', 'Almost.'],
      ['Il aura mis douze secondes a apprendre ce mot-la.',
       'It took him twelve seconds to learn that word.'],
    ],
  },
  {
    cle: 'dimanches',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['SES DIMANCHES', 'HIS SUNDAYS'],
    lignes: [
      ['Elle ne lui a arrache aucun morceau de viande.',
       'It did not tear off a single piece of him.'],
      ['Elle a pris ses dimanches.', 'It took his Sundays.'],
      ['Il travaille depuis sept jours sur sept, sans savoir pourquoi.',
       'He has worked seven days a week ever since, without knowing why.'],
      ['Le contrat etait oral. Il n\'y a aucun recours.',
       'The contract was verbal. There is no appeal.'],
    ],
  },
  {
    cle: 'oreille',
    sur: ['CE QU\'IL A PERDU', 'WHAT HE LOST'],
    titre: ['L\'OREILLE GAUCHE', 'THE LEFT EAR'],
    lignes: [
      ['Il a perdu l\'oreille gauche entre la sixieme et la septieme tombe.',
       'He lost his left ear between the sixth and the seventh grave.'],
      ['Il l\'a cherchee deux heures, avec une lampe de poche.',
       'He searched for two hours with a torch.'],
      ['Il l\'a retrouvee. Elle ecoutait encore.',
       'He found it. It was still listening.'],
      ['Il a prefere la laisser la ou elle etait.',
       'He decided to leave it where it was.'],
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

/**
 * Peindre la scene, a l'instant `t` (en secondes depuis son debut).
 *
 * `mordu` decide de ce qu'on regarde : la bete court derriere l'homme, ou elle
 * s'assoit sur ses talons et hurle. Rien d'autre ne change — c'est la meme
 * nuit, vue de la meme place, et la carte de texte fait le reste.
 */
export function peindreLaScene(
  ctx: CanvasRenderingContext2D, L: number, H: number, t: number, mordu: boolean,
) {
  const sol = H * 0.78;
  const m = Math.min(L / 12, H / 7);

  // LE CIEL. Le meme degrade que le stade du cimetiere, pour qu'on reconnaisse
  // le lieu d'ou l'on sort.
  const ciel = ctx.createLinearGradient(0, 0, 0, sol);
  ciel.addColorStop(0, 'rgb(12,7,22)');
  ciel.addColorStop(1, 'rgb(52,26,62)');
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, L, sol);

  // LA LUNE, enorme et basse. Elle sert de projecteur : tout ce qui est devant
  // elle devient noir, ce qui est exactement le contre-jour qu'on cherche.
  const lx = L * 0.74, ly = sol - H * 0.34, lr = Math.min(L, H) * 0.19;
  const halo = ctx.createRadialGradient(lx, ly, lr * 0.7, lx, ly, lr * 3.1);
  halo.addColorStop(0, 'rgba(255,196,112,0.30)');
  halo.addColorStop(1, 'rgba(255,196,112,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 3.1, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(252,226,168)';
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
  // Trois meres, posees a la main : une lune parfaitement lisse ressemble a un
  // rond jaune, et un rond jaune ne dit pas « la nuit ».
  ctx.fillStyle = 'rgba(226,196,146,0.55)';
  for (const [dx, dy, r] of [[-0.34, -0.22, 0.20], [0.26, 0.10, 0.26], [-0.08, 0.40, 0.14]]) {
    ctx.beginPath(); ctx.arc(lx + dx * lr, ly + dy * lr, r * lr, 0, TAU); ctx.fill();
  }

  // LE SOL. Presque noir, et une simple ligne pour le separer du ciel.
  //
  // Il a ete un vert de pelouse, et c'etait une erreur que la page d'apercu a
  // rendue evidente : une bande claire en bas de l'image tirait le regard
  // sous les personnages, au seul endroit ou il ne se passe rien. Un
  // cimetiere de nuit n'a pas de pelouse visible — il a une masse sombre, et
  // la lune par-dessus.
  ctx.fillStyle = 'rgb(9,11,10)';
  ctx.fillRect(0, sol, L, H - sol);
  ctx.fillStyle = 'rgba(140,116,74,0.22)';
  ctx.fillRect(0, sol, L, 2);

  // LES TOMBES ET LES CYPRES, en contre-jour. Ils defilent lentement vers la
  // gauche : la scene est fixe, mais le monde derriere ne l'est pas — et c'est
  // ce leger glissement qui empeche l'image de ressembler a une capture.
  const glisse = (t * 26) % (L + 400);
  ctx.fillStyle = 'rgb(8,10,12)';
  for (let k = 0; k < 9; k++) {
    const x = ((k * 190 - glisse) % (L + 400) + L + 400) % (L + 400) - 200;
    if (k % 3 === 2) {
      // un cypres
      ctx.beginPath();
      ctx.moveTo(x, sol);
      ctx.quadraticCurveTo(x - m * 0.30, sol - m * 1.5, x, sol - m * 2.6);
      ctx.quadraticCurveTo(x + m * 0.30, sol - m * 1.5, x, sol);
      ctx.fill();
    } else {
      // une pierre tombale, arrondie du haut et plantee de travers
      const l = m * 0.42, h = m * (0.62 + (k % 4) * 0.12);
      const pente = ((k * 37) % 11 - 5) * 0.012;
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

  // LES DEUX SILHOUETTES. L'homme a gauche, la bete derriere lui, toutes deux
  // en noir plein sur la lune.
  const cycle = (t * (mordu ? 1.1 : 3.4)) % 1;
  ctx.fillStyle = 'rgb(5,5,8)';
  ctx.strokeStyle = 'rgb(5,5,8)';
  if (mordu) {
    silhouetteAssise(ctx, L * 0.62, sol, m, t);
    silhouetteTombee(ctx, L * 0.40, sol, m, t);
  } else {
    silhouetteChien(ctx, L * 0.30, sol, m, cycle);
    silhouetteCoureur(ctx, L * 0.54, sol, m, cycle);
  }
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
                         mesure: number, cycle: number) {
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

  // L'OEIL, le seul point clair de la silhouette. Sans lui la bete n'est
  // qu'une masse noire, et une masse noire ne regarde personne.
  ctx.fillStyle = 'rgb(255,86,42)';
  ctx.beginPath(); ctx.arc(x + m * 0.96, y + m * 0.12, m * 0.055, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(5,5,8)';
}

/**
 * La bete assise sur ses talons, museau au ciel.
 *
 * C'est l'image de la defaite, et elle ne montre rien de ce qui vient de se
 * passer : le chien ne devore pas, il annonce. Un hurlement se comprend de
 * dos, de loin, et en silhouette — ce qu'une gueule pleine ne ferait pas.
 */
function silhouetteAssise(ctx: CanvasRenderingContext2D, x: number, sol: number,
                          m: number, t: number) {
  const souffle = Math.sin(t * 2.2) * m * 0.02;
  ctx.lineCap = 'round';
  // l'arriere-train pose au sol, le poitrail dresse
  ctx.lineWidth = m * 0.40;
  ctx.beginPath();
  ctx.moveTo(x - m * 0.30, sol - m * 0.26);
  ctx.lineTo(x + m * 0.16, sol - m * 0.92 + souffle);
  ctx.stroke();
  // les deux pattes avant, tendues
  ctx.lineWidth = m * 0.12;
  for (const dx of [-0.04, 0.12]) {
    ctx.beginPath();
    ctx.moveTo(x + m * (0.18 + dx), sol - m * 0.80 + souffle);
    ctx.lineTo(x + m * (0.30 + dx), sol);
    ctx.stroke();
  }
  // le cou et le museau, leves vers la lune
  ctx.lineWidth = m * 0.22;
  ctx.beginPath();
  ctx.moveTo(x + m * 0.16, sol - m * 0.92 + souffle);
  ctx.lineTo(x + m * 0.40, sol - m * 1.34 + souffle);
  ctx.stroke();
  ctx.lineWidth = m * 0.15;
  ctx.beginPath();
  ctx.moveTo(x + m * 0.40, sol - m * 1.34 + souffle);
  ctx.lineTo(x + m * 0.74, sol - m * 1.62 + souffle);
  ctx.stroke();
  // la queue, posee au sol
  ctx.lineWidth = m * 0.09;
  ctx.beginPath();
  ctx.moveTo(x - m * 0.30, sol - m * 0.22);
  ctx.lineTo(x - m * 0.86, sol - m * 0.06);
  ctx.stroke();
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
