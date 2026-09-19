/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — la bete a l'ecran
   ---------------------------------------------------------------------------
   Une seule chose ici : dessiner le chien, dans le couloir du joueur, a la
   distance que la regle lui donne (game/halloween.ts). Il n'y a ni decision
   ni chrono dans ce fichier — on lit une position, on peint un animal.

   IL PREND SA PLACE PARMI LES COUREURS, ET C'EST TOUT L'ENJEU DU RENDU.

   Un chien peint apres les athletes passerait devant eux d'un bout a l'autre
   de la course, y compris quand il est quinze metres derriere ; peint avant,
   il disparaitrait derriere le dos du joueur a l'instant precis ou il le
   devore. Il entre donc dans la pile de profondeur du moteur, exactement
   comme une haie : `pieces()` rend sa profondeur, le rendu range, et l'ordre
   se fait tout seul — derriere tant qu'il est derriere, devant des qu'il
   double.

   AUCUNE IMAGE, ET CE N'EST PAS UNE ECONOMIE. Le molosse court a trente
   pixels le metre : un rendu Blender n'en montrerait pas plus qu'un trace,
   et il faudrait alors une image par phase de galop, par angle et par
   distance. Un chien dessine se cabre, ouvre la gueule et fume sans qu'on
   ait a le recuire.

   LE MOTEUR NE CONNAIT PAS CE FICHIER : game/halloween.ts le pose sur
   `G.obstacles` a l'armement et l'en retire au rangement, comme les haies.
   La dependance va dans ce sens-la pour que rien du mode ne parte dans le
   paquet quand le drapeau est ferme.
--------------------------------------------------------------------------- */

const PI = Math.PI;
const TAU = PI * 2;

/* --- les mesures de la bete, en metres ------------------------------------
   Un molosse n'est pas un chien : quatre-vingt-dix centimetres au garrot,
   un metre soixante-dix du poitrail a la croupe. Il fait donc la moitie de
   la hauteur d'un coureur et le double de sa longueur — c'est exactement ce
   qu'on veut voir arriver dans le coin de l'ecran.

   ELLES ONT ETE RELEVEES APRES COUP, et c'est la page d'apercu qui l'a dit
   (tools/apercu-molosse.html). A soixante-dix-huit centimetres au garrot, la
   bete etait juste un chien : posee a cote du repere d'un coureur, elle ne
   faisait pas peur. Dix centimetres de plus et quinze de long suffisent — au
   dela, elle cesse d'etre un chien et devient un cheval. */
const GARROT = 0.88;      // hauteur du dos au-dessus du sol
const LONG = 1.70;        // poitrail -> croupe
const EPAIS = 0.36;       // epaisseur du tronc
const PATTE = 0.82;       // longueur d'une patte tendue
const TETE = 0.46;        // crane + museau

/* Les couleurs. Un noir pur aurait fait un trou dans l'image : la bete se
   detache sur une piste orange et des gradins violets, il lui faut donc un
   noir BLEUTE, assez clair pour garder un volume, et des braises pour le
   relief. Le rouge ne sert qu'aux yeux et a la gueule — les deux endroits
   qu'on doit voir avant tout le reste. */
const POIL = 'rgb(26,22,34)';
const POIL_CLAIR = 'rgb(48,41,60)';
const POIL_VENTRE = 'rgb(16,13,22)';
const BRAISE = 'rgb(246,138,38)';
const BRAISE_PALE = 'rgb(252,206,120)';
const OEIL = 'rgb(255,72,40)';
const GUEULE = 'rgb(120,16,22)';
const CROC = 'rgb(242,238,226)';

/**
 * LE GALOP, EN QUATRE TEMPS.
 *
 * Un chien lance ne trotte pas : il galope, et un galop n'est pas symetrique.
 * Les deux posterieurs poussent ensemble, les deux anterieurs rattrapent, et
 * il y a un temps ou les quatre pieds sont en l'air. Ces quatre decalages de
 * phase sont ce qui separe un chien qui court d'un cheval a bascule.
 *
 * L'ordre est celui d'un galop transverse : posterieur gauche, posterieur
 * droit, anterieur gauche, anterieur droit.
 */
const PATTES = [
  { avant: false, cote: -1, phase: 0.00 },
  { avant: false, cote: +1, phase: 0.12 },
  { avant: true,  cote: -1, phase: 0.45 },
  { avant: true,  cote: +1, phase: 0.57 },
];

/** Combien de foulees la bete fait par metre parcouru. */
const FOULEE = 2.6;

/**
 * Ou se trouve le pied d'une patte, dans le repere de la bete.
 *
 * `u` est la phase de cette patte, de 0 a 1. La premiere moitie est le
 * CONTACT : le pied est au sol et recule sous le corps. La seconde est le
 * RAPPEL : il quitte le sol, se replie et revient devant. C'est ce repli —
 * le pied qui monte vers le ventre au lieu de decrire un arc bien propre —
 * qui fait la difference entre un galop et une roue de moulin.
 *
 * Rend [x, y] en metres : x vers l'avant, y vers le haut depuis le sol.
 */
function pied(u, amplitude) {
  const a = amplitude;
  if (u < 0.5) {
    const k = u / 0.5;
    return [a * (0.5 - k), 0];
  }
  const k = (u - 0.5) / 0.5;
  // Le repli : haut et court au debut, puis la patte se detend devant.
  const h = Math.sin(k * PI) * (a * 0.52);
  return [a * (-0.5 + k), h];
}

/**
 * Une capsule : un segment epais, aux bouts arrondis. Tout le corps de la
 * bete en est fait, comme les coureurs du jeu (voir personCapsules dans
 * sprinter-app.js) — c'est ce qui les fait tenir ensemble a l'ecran.
 */
function capsule(ctx, x1, y1, x2, y2, r, couleur) {
  ctx.strokeStyle = couleur;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Les obstacles d'une nuit du molosse, prets a poser sur `G.obstacles`.
 *
 * `chasse` est l'etat de la regle (game/halloween.ts) : on n'y lit que la
 * position de la bete et sa vitesse, et on n'y ecrit rien.
 */
export function molosseDe(chasse) {
  // Une seule piece, reutilisee d'une image a l'autre : il n'y a qu'un chien.
  const piece = { profondeur: 0, molosse: true };
  const liste = [piece];
  const vide = [];

  // Les braises qui s'echappent du dos. Elles vivent d'une image a l'autre —
  // une braise recalculee a chaque image ne monterait jamais.
  const braises = [];
  let derniereBraise = 0;

  return {
    /** Ce a quoi le rangement reconnait la bete sur `G.obstacles`. */
    molosse: true,

    /**
     * Rien a poser sur les coureurs : le molosse ne change pas leur posture.
     *
     * La fonction existe quand meme parce que le rendu l'appelle sans garde
     * pour chaque coureur (voir drawAthletes dans sprinter-app.js) : un
     * obstacle qui n'en a pas ferait tomber la boucle de dessin.
     */
    preparer() {},
    oublier() {},

    /**
     * La bete, avec sa profondeur, pour que le rendu la range parmi les
     * athletes.
     *
     * Elle sort de la liste tant qu'elle est derriere la ligne de depart :
     * un chien peint a moins quatorze metres se dessinerait sur les blocs de
     * depart des autres couloirs, ou il n'y a pas de piste.
     */
    pieces(api) {
      const { G, ground, depthOf, scaleM } = api;
      if (!chasse || !G.player || !G.track) return vide;
      const d = chasse.d;
      if (d < 0.4) return vide;

      const T = G.track;
      const q = T.pos(Math.min(d, T.total + 24), G.player.lane);
      const g = ground(q[0], q[1]);
      const m = scaleM();
      const marge = (GARROT + TETE) * m + 60;
      if (g[0] < -marge || g[0] > G.VW + marge ||
          g[1] < -marge || g[1] > G.VH + marge) return vide;

      piece.profondeur = depthOf(q[0], q[1]);
      piece.x = g[0];
      piece.y = g[1];
      piece.m = m;
      return liste;
    },

    /** Peindre la bete. */
    dessiner(ctx, api, pc) {
      const { G } = api;
      const m = pc.m;
      const x = pc.x, y = pc.y;
      const t = G.elapsed || 0;

      // LE GALOP SE LIT SUR LA DISTANCE, PAS SUR L'HORLOGE. Un cycle cale sur
      // le temps donnerait la meme foulee a l'arret et a pleine vitesse ; cale
      // sur les metres parcourus, la bete allonge quand elle accelere, comme
      // le font les coureurs du jeu.
      const cycle = (chasse.d * FOULEE) % 1;
      // L'amplitude suit la vitesse : au demarrage le chien piaffe, lance il
      // developpe. Bornee pour qu'une premiere image a vitesse nulle ne le
      // fige pas les quatre pattes jointes.
      const vitesse = Math.min(1, chasse.v / 11);
      const amp = PATTE * (0.55 + 0.75 * vitesse);

      // Le dos qui se cambre : deux fois par foulee, c'est la respiration du
      // galop. Sans elle la bete glisse sur ses pattes comme un jouet a roulettes.
      const cambre = Math.sin(cycle * TAU) * 0.055 * m;
      const bond = Math.max(0, Math.sin(cycle * TAU - 0.6)) * 0.09 * m * vitesse;

      const garrot = y - GARROT * m - bond;
      const croupe = y - (GARROT - 0.04) * m - bond + cambre;
      // La bete regarde vers l'avant de la course, donc vers la droite de
      // l'ecran : c'est le sens ou courent tous les athletes du jeu.
      const avant = x + LONG * 0.5 * m;
      const arriere = x - LONG * 0.5 * m;

      ctx.save();

      // L'OMBRE D'ABORD. Elle se resserre quand la bete decolle : une ombre
      // qui ne bouge pas fait flotter l'animal a dix centimetres du sol.
      const ombre = 1 - 0.35 * (bond / (0.09 * m || 1));
      ctx.globalAlpha = 0.42 * ombre;
      ctx.fillStyle = 'rgb(6,4,10)';
      ctx.beginPath();
      ctx.ellipse(x, y, LONG * 0.46 * m * ombre, EPAIS * 0.42 * m * ombre, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      // LES DEUX PATTES DU FOND, sous le corps : peintes avant lui, plus
      // sombres. Sans ce partage, les quatre pattes se confondaient en une
      // seule masse et le galop ne se lisait plus.
      for (const p of PATTES) {
        if (p.cote > 0) continue;
        pattes(ctx, p, cycle, amp, m, avant, arriere, garrot, croupe, POIL_VENTRE);
      }

      // LE TRONC. Deux capsules : le poitrail, haut et large, et le rein, plus
      // mince. Un molosse porte tout son poids devant.
      capsule(ctx, arriere + LONG * 0.18 * m, croupe, avant - LONG * 0.16 * m, garrot,
              EPAIS * 0.5 * m, POIL);
      capsule(ctx, avant - LONG * 0.34 * m, garrot, avant - LONG * 0.08 * m, garrot + 0.02 * m,
              EPAIS * 0.62 * m, POIL);
      // Le ventre, plus sombre, pour que le volume se voie de loin.
      capsule(ctx, arriere + LONG * 0.22 * m, croupe + EPAIS * 0.30 * m,
              avant - LONG * 0.18 * m, garrot + EPAIS * 0.32 * m,
              EPAIS * 0.20 * m, POIL_VENTRE);
      // Le fil de lumiere sur l'echine : c'est lui qui detache la bete du fond
      // sombre du stade, et il tire vers la braise plutot que vers le blanc.
      ctx.globalAlpha = 0.5;
      capsule(ctx, arriere + LONG * 0.22 * m, croupe - EPAIS * 0.34 * m,
              avant - LONG * 0.20 * m, garrot - EPAIS * 0.36 * m,
              EPAIS * 0.08 * m, POIL_CLAIR);
      ctx.globalAlpha = 1;

      queue(ctx, cycle, m, arriere + LONG * 0.16 * m, croupe, vitesse);
      tete(ctx, t, m, avant, garrot, cycle, vitesse);

      // LES DEUX PATTES DE DEVANT, par-dessus le corps.
      for (const p of PATTES) {
        if (p.cote < 0) continue;
        pattes(ctx, p, cycle, amp, m, avant, arriere, garrot, croupe, POIL);
      }

      // LES BRAISES. Elles montent du garrot et s'eteignent en trois quarts
      // de seconde. C'est le seul effet de particules du mode, et il tient a
      // une chose : une bete entierement noire, la nuit, sur un fond sombre,
      // a besoin de quelque chose qui bouge autour d'elle pour qu'on la sente
      // vivante plutot que collee sur l'image.
      if (t - derniereBraise > 0.045 && vitesse > 0.15) {
        derniereBraise = t;
        braises.push({ x: arriere + Math.random() * LONG * m,
                       y: garrot - Math.random() * 0.1 * m,
                       vx: -(0.4 + Math.random()) * m,
                       vy: -(0.5 + Math.random() * 0.9) * m,
                       t: 0, r: (0.02 + Math.random() * 0.035) * m });
      }
      for (let i = braises.length - 1; i >= 0; i--) {
        const b = braises[i];
        b.t += 1 / 60;
        if (b.t > 0.75) { braises.splice(i, 1); continue; }
        const k = b.t / 0.75;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.fillStyle = k < 0.4 ? BRAISE_PALE : BRAISE;
        ctx.beginPath();
        ctx.arc(b.x + b.vx * b.t, b.y + b.vy * b.t, b.r * (1 - k * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };
}

/** Une patte, du corps au pied. */
function pattes(ctx, p, cycle, amp, m, avant, arriere, garrot, croupe, couleur) {
  const u = (cycle + p.phase) % 1;
  const [px, py] = pied(u, amp);
  // L'epaule est devant, la hanche derriere, et leurs hauteurs different :
  // un chien est plus haut de l'avant.
  const hx = p.avant ? avant - 0.34 * m : arriere + 0.30 * m;
  const hy = p.avant ? garrot + 0.04 * m : croupe + 0.02 * m;
  const fx = hx + px * m;
  const fy = hy + (PATTE * m) - py * m;

  // Le genou, pose au tiers et pousse vers l'avant pour l'anterieur, vers
  // l'arriere pour le posterieur : c'est ce coude inverse qui fait qu'on
  // reconnait un quadrupede et non un homme a quatre jambes.
  const mx = (hx + fx) * 0.5 + (p.avant ? 0.06 : -0.10) * m;
  const my = (hy + fy) * 0.5;

  capsule(ctx, hx, hy, mx, my, 0.075 * m, couleur);
  capsule(ctx, mx, my, fx, fy, 0.055 * m, couleur);
  // La patte elle-meme, posee a plat au contact.
  capsule(ctx, fx - 0.04 * m, fy, fx + 0.06 * m, fy, 0.045 * m, couleur);
}

/**
 * La queue, fouettee par le galop.
 *
 * ELLE EST TENDUE VERS L'ARRIERE, PRESQUE A L'HORIZONTALE, et c'est ainsi
 * qu'un chien lance la porte : elle sert de balancier, elle ne salue pas.
 * Dressee a quarante-cinq degres — ce qu'elle faisait — elle donnait a la
 * bete l'air d'un animal content, et une grande diagonale claire partait du
 * coin de l'image sans qu'on sache ce que c'etait.
 */
function queue(ctx, cycle, m, x, y, vitesse) {
  const bat = Math.sin(cycle * TAU * 1.5) * 0.16 * (0.4 + vitesse);
  const x1 = x - 0.34 * m, y1 = y - 0.06 * m + bat * m;
  const x2 = x - 0.70 * m, y2 = y - 0.10 * m + bat * 2.1 * m;
  capsule(ctx, x, y, x1, y1, 0.06 * m, POIL);
  capsule(ctx, x1, y1, x2, y2, 0.035 * m, POIL);
}

/**
 * LA TETE, ET CE QU'IL FAUT VOIR EN PREMIER.
 *
 * Deux choses la portent : la gueule ouverte et l'oeil. Tout le reste — le
 * crane, les oreilles, le cou — n'est la que pour les tenir. C'est pour cela
 * que la gueule ne se referme jamais completement : une bete qui court apres
 * quelqu'un et qui garde la bouche fermee ressemble a un chien qui se promene.
 */
function tete(ctx, t, m, avant, garrot, cycle, vitesse) {
  // Le cou plonge vers l'avant quand la bete accelere : c'est la posture de
  // la poursuite, museau bas. A l'arret elle releve la tete.
  const plonge = (0.10 + 0.16 * vitesse) * m;
  const cx = avant + 0.30 * m;
  const cy = garrot + plonge + Math.sin(cycle * TAU) * 0.03 * m;

  capsule(ctx, avant - 0.16 * m, garrot, cx, cy, 0.14 * m, POIL);

  // Le crane.
  capsule(ctx, cx, cy, cx + TETE * 0.42 * m, cy + 0.03 * m, 0.125 * m, POIL);

  // LA GUEULE. Elle bat legerement — une bete lancee halete — et le
  // battement suit la foulee, comme chez un vrai quadrupede, dont la
  // respiration est accrochee au galop.
  const ouvre = (0.13 + 0.07 * Math.sin(cycle * TAU)) * m;
  const mx = cx + TETE * 0.44 * m;
  // Le fond de gorge, peint avant les machoires : rouge sombre, et il ne se
  // voit que par l'ecart entre les deux.
  ctx.fillStyle = GUEULE;
  ctx.beginPath();
  ctx.moveTo(mx - 0.06 * m, cy - ouvre * 0.4);
  ctx.lineTo(mx + TETE * 0.56 * m, cy - ouvre * 0.9);
  ctx.lineTo(mx + TETE * 0.56 * m, cy + ouvre * 1.1);
  ctx.lineTo(mx - 0.06 * m, cy + ouvre * 0.5);
  ctx.closePath();
  ctx.fill();

  // Les deux machoires.
  capsule(ctx, mx, cy - ouvre * 0.55, mx + TETE * 0.54 * m, cy - ouvre * 0.95,
          0.045 * m, POIL);
  capsule(ctx, mx, cy + ouvre * 0.55, mx + TETE * 0.50 * m, cy + ouvre * 0.95,
          0.042 * m, POIL);

  // LES CROCS. Quatre traits, pas davantage : a cette taille, une dentition
  // complete fait une bouillie blanche. Deux en haut, deux en bas, et ils
  // pointent l'un vers l'autre.
  ctx.fillStyle = CROC;
  const croc = (dx, dy, sens) => {
    ctx.beginPath();
    ctx.moveTo(mx + dx, cy + dy);
    ctx.lineTo(mx + dx + 0.045 * m, cy + dy);
    ctx.lineTo(mx + dx + 0.022 * m, cy + dy + sens * 0.085 * m);
    ctx.closePath();
    ctx.fill();
  };
  croc(0.10 * m, -ouvre * 0.62, +1);
  croc(0.26 * m, -ouvre * 0.72, +1);
  croc(0.12 * m, ouvre * 0.62, -1);
  croc(0.28 * m, ouvre * 0.70, -1);

  // LES OREILLES, en pointe et couchees vers l'arriere : un chien lance
  // plaque ses oreilles. Dressees, il aurait l'air attentif — pas menacant.
  ctx.fillStyle = POIL;
  ctx.beginPath();
  ctx.moveTo(cx + 0.02 * m, cy - 0.11 * m);
  ctx.lineTo(cx - 0.20 * m, cy - 0.30 * m);
  ctx.lineTo(cx - 0.02 * m, cy - 0.05 * m);
  ctx.closePath();
  ctx.fill();

  // L'OEIL. C'est le point le plus lumineux de toute l'image du mode, et il
  // doit l'etre : c'est ce qu'on cherche du regard quand on sent que la bete
  // se rapproche. Il palpite — un halo qui respire se remarque a la peripherie
  // de la vision, ce qu'un point fixe ne fait pas.
  const pulse = 0.82 + 0.18 * Math.sin(t * 7.5);
  const ox = cx + TETE * 0.30 * m, oy = cy - 0.045 * m;
  const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, 0.30 * m * pulse);
  halo.addColorStop(0, 'rgba(255,96,48,0.85)');
  halo.addColorStop(0.45, 'rgba(228,48,22,0.30)');
  halo.addColorStop(1, 'rgba(228,48,22,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ox, oy, 0.30 * m * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = OEIL;
  ctx.beginPath();
  ctx.arc(ox, oy, 0.042 * m, 0, TAU);
  ctx.fill();
  ctx.fillStyle = BRAISE_PALE;
  ctx.beginPath();
  ctx.arc(ox + 0.012 * m, oy - 0.012 * m, 0.016 * m, 0, TAU);
  ctx.fill();
}

/** La bete est-elle assez pres pour qu'on lui doive un grondement ? */
export function proximite(chasse) {
  if (!chasse) return 0;
  return Math.max(0, Math.min(1, 1 - chasse.ecart / 12));
}
