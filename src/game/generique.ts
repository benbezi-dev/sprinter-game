// LE GENERIQUE DE FIN DE CARRIERE — sa musique, et de quoi la regarder.
//
// C'est le premier fichier audio du jeu. Tout le reste est synthetise (voir la
// longue note en tete de `Audio_`, dans sprinter-app.js) : les quatre musiques
// de course, les tambours, jusqu'a la voix du starter. Ce choix tient encore
// pour tout ce qui doit exister partout et tout de suite — un depart se joue au
// centieme, on ne l'attend pas au bout d'un telechargement.
//
// Le generique, lui, ne se joue qu'une fois : apres la sixieme etape gagnee,
// quand il n'y a plus rien a courir. Il peut donc etre un morceau, et il en est
// un.
//
// DEUX PRECAUTIONS, ET ELLES COMPTENT AUTANT L'UNE QUE L'AUTRE :
//
// - Le fichier ne se telecharge qu'au moment de le jouer. L'import est
//   dynamique : les deux mega-octets et demi partent dans leur propre morceau,
//   et une partie qui n'atteint jamais la sixieme etape ne les demande jamais.
//   C'est ce qui rend la chose acceptable sur un jeu qui, sans lui, tient en
//   trois cents kilo-octets — le poids n'est pas paye au lancement.
//
// - Le son passe par le graphe du jeu, pas a cote. Un `new Audio().play()`
//   aurait suffi a l'entendre, et aurait echappe a tout le reste : le bouton
//   son ne l'aurait pas coupe, le replay ne l'aurait pas enregistre, et iOS
//   l'aurait sorti sur un autre circuit que la musique de course. On le
//   branche donc sur `Audio_.sortie`, comme les bruitages et les annonces.

/** Combien de temps dure la scene si la musique ne vient pas, en secondes. */
const REPLI = 26;

/** Montee et descente du volume, en secondes. */
const FONDU = 1.2;

/** Le niveau du morceau. La musique de course tourne a 0,34. */
const VOLUME = 0.52;

type Etat = {
  el: HTMLAudioElement;
  gain: GainNode | null;
  analyse: AnalyserNode | null;
  donnees: Uint8Array | null;
  ctx: AudioContext | null;
};

let etat: Etat | null = null;
let minuteurDeRepli: ReturnType<typeof setTimeout> | null = null;
let niveauLisse = 0;
/** La duree du morceau, connue une fois son entete lu. Nulle avant. */
let duree = 0;
/** Le plus fort et le fond du morceau, sur les dernieres secondes. */
let crete = 0;
let fond = 0;

/**
 * L'adresse du morceau — nulle si le telechargement echoue.
 *
 * `?url` demande a Vite l'adresse du fichier plutot que son contenu : le
 * morceau est copie dans le build et sert par le reseau, il ne traverse pas le
 * paquet JavaScript.
 */
async function adresse(): Promise<string | null> {
  try {
    const m = await import('@/assets/generique-carriere.mp3?url');
    return m.default as string;
  } catch {
    return null;
  }
}

/** Le graphe du jeu, s'il est ouvert. Voir Audio_ dans sprinter-app.js. */
function moteur(): any {
  const A = (globalThis as any).SprinterApp;
  return A && A.Audio_ ? A.Audio_ : null;
}

/**
 * Lance le generique, et previent quand il est fini.
 *
 * `fini` est appele une seule fois : a la derniere note, ou au bout du repli si
 * la musique n'a pas pu partir. La scene s'appuie dessus pour rendre la main —
 * sans quoi un morceau qui ne charge pas laisserait le joueur devant un
 * generique qui ne se termine jamais.
 */
export function jouerLeGenerique(fini: () => void): void {
  const A = moteur();
  // Son coupe : la scene se joue quand meme, elle dure le temps du repli.
  if (A && !A.on) { replier(fini); return; }

  let rendu = false;
  const rendreLaMain = () => {
    if (rendu) return;
    rendu = true;
    fini();
  };

  void adresse().then(url => {
    // Deja arrete pendant le chargement — le joueur a passe la scene avant
    // meme que le fichier n'arrive. On ne lance rien.
    if (rendu) return;
    if (!url) { replier(rendreLaMain); return; }

    const el = new Audio(url);
    el.preload = 'auto';
    el.loop = false;
    el.addEventListener('ended', rendreLaMain);
    // La duree ne se sait qu'une fois l'entete lu. La scene s'en sert pour
    // caler son defile et son fondu final ; tant qu'elle vaut zero, les deux
    // se contentent du temps ecoule.
    el.addEventListener('loadedmetadata', () => {
      duree = Number.isFinite(el.duration) ? el.duration : 0;
    });
    // Un fichier qui ne se charge pas ne doit pas figer la scene.
    el.addEventListener('error', () => replier(rendreLaMain));

    let gain: GainNode | null = null;
    let analyse: AnalyserNode | null = null;
    let donnees: Uint8Array | null = null;
    const ctx: AudioContext | null = A && A.ok ? A.ctx : null;

    if (ctx && A.sortie) {
      try {
        // `createMediaElementSource` deroute la sortie de l'element vers le
        // graphe : a partir d'ici l'element ne s'entend plus tout seul, et
        // c'est exactement ce qu'on veut.
        const source = ctx.createMediaElementSource(el);
        gain = ctx.createGain();
        gain.gain.value = 0;
        analyse = ctx.createAnalyser();
        // Une fenetre large : 1024 points donnent des bandes d'environ 47 Hz,
        // assez fines pour isoler la grosse caisse et la basse. Avec 256 points
        // la premiere bande couvrait a elle seule tout le bas du spectre, et la
        // mesure ne bougeait plus d'un temps a l'autre.
        analyse.fftSize = 1024;
        analyse.smoothingTimeConstant = 0.55;
        donnees = new Uint8Array(analyse.frequencyBinCount);
        source.connect(gain);
        gain.connect(analyse);
        gain.connect(A.sortie);
        const t0 = ctx.currentTime;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(VOLUME, t0 + FONDU);
        // Le contexte peut dormir si le jeu revient d'un arriere-plan.
        if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* refuse */ });
      } catch {
        // Le navigateur refuse la derivation : on garde l'element seul, ce qui
        // s'entend tout de meme — sans le bouton son ni le replay.
        gain = null; analyse = null; donnees = null;
        el.volume = VOLUME;
      }
    } else {
      el.volume = VOLUME;
    }

    etat = { el, gain, analyse, donnees, ctx };

    el.play().catch(() => {
      // Lecture refusee — un navigateur qui exige un geste, une politique
      // d'economie d'energie. La scene tient quand meme, en silence.
      replier(rendreLaMain);
    });
  });
}

/** Le generique s'arrete : fondu court, puis on rend tout. */
export function arreterLeGenerique(): void {
  if (minuteurDeRepli) { clearTimeout(minuteurDeRepli); minuteurDeRepli = null; }
  const e = etat;
  etat = null;
  niveauLisse = 0;
  duree = 0;
  crete = 0;
  fond = 0;
  if (!e) return;

  const couper = () => {
    try { e.el.pause(); } catch { /* deja arrete */ }
    // On RETIRE l'attribut plutot que de lui donner une chaine vide : une
    // source vide se resout sur l'adresse de la page, et le navigateur repart
    // alors telecharger le document entier pour tenter de le decoder. Retirer
    // puis recharger est ce qui rend vraiment le tampon.
    try { e.el.removeAttribute('src'); e.el.load(); } catch { /* deja libere */ }
  };

  if (e.gain && e.ctx) {
    try {
      const t0 = e.ctx.currentTime;
      e.gain.gain.cancelScheduledValues(t0);
      e.gain.gain.setValueAtTime(e.gain.gain.value, t0);
      e.gain.gain.linearRampToValueAtTime(0, t0 + 0.45);
      setTimeout(couper, 520);
      return;
    } catch { /* le navigateur refuse le fondu : on coupe net */ }
  }
  couper();
}

/**
 * La duree du morceau en secondes — zero tant qu'elle n'est pas connue.
 *
 * La scene cale son defile et son fondu dessus. A zero, elle tient sur son
 * seul temps ecoule : le texte defile a son rythme nominal et l'image ne
 * s'eteint pas avant le repli.
 */
export function dureeDuGenerique(): number {
  return duree;
}

/**
 * L'energie du morceau a cet instant, entre 0 et 1.
 *
 * La scene s'en sert pour battre avec la musique plutot qu'a cote : les
 * projecteurs, les feux d'artifice et le halo suivent ce que le morceau fait
 * vraiment, et non une pulsation inventee a cote de lui. Vaut 0 tant que rien
 * ne joue — la scene tient alors sur son seul temps ecoule.
 */
export function niveauDuGenerique(): number {
  const e = etat;
  if (!e || !e.analyse || !e.donnees) return 0;
  try {
    e.analyse.getByteFrequencyData(e.donnees as any);
    const d = e.donnees;
    // LA GROSSE CAISSE ET LA BASSE, ET RIEN D'AUTRE.
    //
    // Entre cinquante et cinq cents hertz. Prendre plus large revenait a
    // mesurer le volume du morceau — qui, sur une musique de danse compressee,
    // ne bouge pour ainsi dire jamais : la mesure restait plate et la scene
    // avec elle. C'est dans cette bande-la que tombent les temps.
    const DEBUT = 1, FIN = Math.min(d.length, 11);
    let somme = 0;
    for (let i = DEBUT; i < FIN; i++) somme += d[i];
    const brut = (somme / (FIN - DEBUT)) / 255;

    // ON MESURE L'ECART AU FOND DU MORCEAU, PAS SON VOLUME.
    //
    // Deux echelles ont ete essayees avant celle-ci, et les deux donnaient une
    // scene saturee : une constante (0,92 du debut a la fin), puis un rapport
    // a la crete (1,00 presque tout le temps). La raison est la meme dans les
    // deux cas — un morceau de danse est compresse, son volume ne bouge
    // quasiment pas. Ce qui bouge, c'est ce qui DEPASSE du fond.
    //
    // On tient donc deux reperes glissants : le fond, lent, et la crete. Le
    // niveau est la position de l'instant entre les deux. La scene respire
    // alors sur n'importe quel morceau, compresse ou non — et sur un passage
    // vraiment plat, l'ecart est trop petit pour compter, et elle se calme.
    fond = fond * 0.985 + brut * 0.015;
    crete = Math.max(brut, crete * 0.997);
    const etendue = crete - fond;
    // Un morceau si plat que rien ne depasse : on se rabat sur le volume, pour
    // que la scene respire faiblement plutot que de se figer.
    const net = etendue > 0.02
      ? Math.min(1, Math.max(0, (brut - fond) / etendue))
      : Math.min(1, brut * 1.4);
    // Montee immediate, descente lente : un flash suit la frappe, puis retombe.
    niveauLisse = net > niveauLisse ? net : niveauLisse * 0.86 + net * 0.14;
    return niveauLisse;
  } catch {
    return 0;
  }
}

/** Pas de musique : la scene dure ce que dure le repli, et rend la main. */
function replier(fini: () => void) {
  if (minuteurDeRepli) clearTimeout(minuteurDeRepli);
  minuteurDeRepli = setTimeout(() => { minuteurDeRepli = null; fini(); }, REPLI * 1000);
}
