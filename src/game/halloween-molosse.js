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

   AUCUNE IMAGE, ET C'EST MAINTENANT MESURE.

   Ce paragraphe affirmait la chose ; on l'a essayee quand meme, et la mesure
   a tranche. `scaleM()` vaut `ui() * 30` en ligne droite et `ui() * 44` en
   courbe (sprinter-app.js) : UNE CONSTANTE PAR COURSE, sans aucun terme de
   distance. La camera est un profil a echelle fixe — la bete ne grandit
   jamais en approchant. Releve sur une nuit entiere, image par image :

       49 pixels de long, 26 de haut, du premier metre au dernier.

   A cette taille, un rendu Blender ne montre rien qu'un trace ne montre, et
   il coute huit images par phase de galop. Les scenettes n'y changent rien :
   la bete y est un peu plus grande — un tiers de plus, voir silhouetteChien
   dans halloween-cinema.ts — mais elle y est dessinee en NOIR PLEIN sur la
   lune, ou un rendu n'a rien a apporter par definition.

   CE QUI SE LIT A QUARANTE-NEUF PIXELS, ce n'est donc pas la matiere : c'est
   la SILHOUETTE, le RYTHME du galop, et les deux yeux. Un chien dessine se
   cabre, ouvre la gueule et fume sans qu'on ait a le recuire.

   L'essai est garde dans tools/blender/molosse.py, avec ce qu'il a appris
   des metaballs et la raison pour laquelle il ne sert pas.

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
const GARROT = 0.86;      // hauteur du dos au-dessus du sol
const LONG = 1.44;        // poitrail -> croupe
const EPAIS = 0.50;       // epaisseur du tronc
const PATTE = 0.82;       // longueur d'une patte tendue
const TETE = 0.52;        // crane + museau

/* CES TROIS-LA SONT LIEES, ET ON NE PEUT PAS EN BOUGER UNE SEULE.
   La patte part de l'epaule, a `GARROT - 0.04`, et doit arriver AU SOL quand
   le pied est au contact : il faut donc `PATTE = GARROT - 0.04`, exactement.
   En raccourcissant la patte pour faire trapu tout en relevant le garrot, on
   laisse un vide — quatorze centimetres, six pixels — et la bete galope en
   flottant au-dessus de sa propre ombre. Ca ne se voit pas sur la page
   d'apercu, ou l'ombre est loin sous le cadre ; ca creve les yeux dans le
   jeu, ou l'ombre est peinte juste dessous.

   LE TRAPU NE SE GAGNE DONC PAS SUR LES PATTES mais sur le RAPPORT du corps
   et son EPAISSEUR — 1,44 de long pour 0,86 de haut au lieu de 1,70 pour
   0,88, et un tronc epaissi de moitie. C'est la meme masse a l'ecran, et
   elle porte enfin sur ses quatre pieds. */

/* CES CHIFFRES ONT ETE REPRIS UNE SECONDE FOIS, ET A LA BONNE TAILLE.
   Les premiers avaient ete regles sur la page d'apercu, ou la bete s'affiche
   en grand. A quarante-neuf pixels, ils donnaient tout autre chose : un corps
   de 1,70 m de long pour 0,88 m de haut fait un rapport de 1,9 — une bete
   LONGUE ET BASSE, qui se lit comme un levrier ou un loup, c'est-a-dire comme
   un animal rapide et leger. Le mot « molosse » dit l'inverse : une masse.

   Ce qui fait la masse a cette taille n'est pas la hauteur, c'est le RAPPORT
   et l'EPAISSEUR. Le corps se raccourcit d'un quart, le tronc s'epaissit de
   moitie, les pattes raccourcissent, la tete grossit. La bete garde la meme
   emprise a l'ecran — on ne la voit pas rapetisser — mais elle cesse d'etre
   une barre horizontale pour devenir un bloc qui avance. */

/* Les couleurs. Un noir pur aurait fait un trou dans l'image : la bete se
   detache sur une piste orange et des gradins violets, il lui faut donc un
   noir BLEUTE, assez clair pour garder un volume, et des braises pour le
   relief. Le rouge ne sert qu'aux yeux et a la gueule — les deux endroits
   qu'on doit voir avant tout le reste. */
const POIL = 'rgb(38,32,48)';
const POIL_CLAIR = 'rgb(74,63,90)';
const POIL_VENTRE = 'rgb(20,16,28)';
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
  { avant: false, cote: +1, phase: 0.20 },
  { avant: true,  cote: -1, phase: 0.45 },
  { avant: true,  cote: +1, phase: 0.65 },
];

/* LA VOIE : DE COMBIEN LA PATTE DU FOND EST DECALEE DE CELLE DE DEVANT.
   Sans elle, `cote` ne servait qu'a choisir une couleur, et les deux pattes
   d'une meme paire etaient dessinees AU MEME ENDROIT, au pixel pres. Elles se
   recouvraient donc exactement, et les quatre pattes se lisaient comme une
   seule arche sombre sous le corps — un tabouret, pas un galop. C'est ce
   qu'on voyait en grossissant une image du jeu, et ce que la page d'apercu ne
   pouvait pas montrer : en grand, deux traits superposes se devinent encore.

   Un quadrupede vu de profil ne cache pas ses pattes du fond : il les laisse
   depasser, un peu en arriere et un peu plus haut, parce qu'elles sont de
   l'autre cote du corps. Dix centimetres suffisent — trois pixels — et le
   galop se remet a battre.

   L'ecart de phase dans chaque paire a ete ouvert en meme temps, de douze a
   vingt centiemes : deux pattes decalees d'un huitieme de foulee se posent
   presque ensemble, ce qui refaisait la meme masse autrement. */
const VOIE = 0.10;

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

      // LE SENS DE LA COURSE, MESURE ET NON SUPPOSE.
      //
      // La bete etait peinte tournee vers la droite, en dur. Or la projection
      // du jeu envoie la course vers le HAUT-GAUCHE de l'ecran : on le
      // verifie en projetant deux points de la piste, trente et trente-cinq
      // metres, et en comparant — cent quarante-cinq pixels vers la gauche.
      // Le molosse a donc couru a reculons depuis le premier jour, museau en
      // arriere et queue devant, et ca ne s'est pas vu tout de suite parce
      // qu'une silhouette noire qui galope se lit mal a trente pixels le
      // metre.
      //
      // On projette donc un point quelques metres plus loin sur la meme
      // trajectoire : le signe de l'ecart horizontal dit de quel cote la bete
      // regarde. Quatre metres, parce qu'en virage un pas plus court donne un
      // ecart trop petit pour etre lu de facon stable.
      const q2 = T.pos(Math.min(d + 4, T.total + 28), G.player.lane);
      const g2 = ground(q2[0], q2[1]);

      piece.profondeur = depthOf(q[0], q[1]);
      piece.x = g[0];
      piece.y = g[1];
      piece.m = m;
      // L'AXE DE LA PISTE A L'ECRAN, en pixels par metre parcouru. On avait
      // le SIGNE de cet ecart — de quel cote la bete regarde — et on jetait
      // le reste. Le reste etait l'essentiel : sa DIRECTION.
      const ex = (g2[0] - g[0]) / 4, ey = (g2[1] - g[1]) / 4;
      // Une trajectoire degeneree — deux points confondus — ne donne pas de
      // direction : on garde la precedente plutot que de coucher la bete.
      if (Math.abs(ex) > 1e-4 || Math.abs(ey) > 1e-4) {
        piece.ex = ex; piece.ey = ey;
      }
      return liste;
    },

    /** Peindre la bete. */
    dessiner(ctx, api, pc) {
      const { G } = api;
      const m = pc.m;
      const t = G.elapsed || 0;
      // TOUT LE DESSIN QUI SUIT REGARDE VERS LES X POSITIFS, et le miroir
      // s'occupe du reste. C'est ce qui garde le trace lisible : on peint une
      // bete tournee vers l'avant, une fois, et le jour ou une epreuve se
      // courra dans l'autre sens — un virage, un retour — elle se retournera
      // toute seule.
      ctx.save();
      ctx.translate(pc.x, pc.y);

      /* LE CORPS SE COUCHE SUR L'AXE DE LA PISTE, ET C'EST TOUT LE VIRAGE.

         La bete etait peinte sur l'axe HORIZONTAL de l'ecran, toujours, avec
         un simple miroir pour le sens. Or la course ne va presque jamais a
         l'horizontale : la projection l'envoie en biais, et dans un virage
         l'angle change a chaque metre. Le molosse traversait donc les
         couloirs en travers pendant que les coureurs les suivaient — couche
         sur la piste plutot que lance dessus.

         C'est le meme defaut que le sens inverse corrige plus tot, et la
         meme cause : on prenait UN point d'ecran et on etalait tout le corps
         sur l'axe des x. Un quadrupede n'a pas ce luxe. Une haie ne l'a pas
         non plus, et le moteur lui donne deja la reponse : elle passe chaque
         point par `T.posDemi`, donc elle suit le virage « sans angle a tenir
         nulle part » (voir dessinerHaie dans haies-rendu.js).

         ON NE REECRIT PAS TOUT LE DESSIN POUR AUTANT. Il est ecrit en
         (avant, haut) et il peut le rester : il suffit de dire a la toile
         que « avant » n'est plus l'axe des x mais l'axe mesure de la piste.
         La matrice ne touche QUE cet axe — `c = 0`, `d = 1` — parce que la
         hauteur, elle, se projette toujours droit vers le haut de l'ecran
         (voir `solid`, qui retranche simplement `z * scaleM()`). Le corps
         s'incline et se raccourcit avec la piste ; les pattes continuent de
         tomber vers le bas, comme le fait la pesanteur.

         LE MIROIR DISPARAIT AVEC CELA : l'axe mesure pointe deja dans le
         sens de la marche, donc la bete regarde du bon cote sans qu'on ait a
         le lui dire. Quand il pointe vers la gauche, le determinant devient
         negatif et le dessin se retourne — ce qu'on voulait — sans que le
         haut et le bas s'echangent.

         LA LONGUEUR SE RACCOURCIT AUSSI, et c'est juste : un metre de piste
         vu de biais occupe moins d'un metre d'ecran. */
      const ex = pc.ex !== undefined ? pc.ex : m;
      const ey = pc.ey !== undefined ? pc.ey : 0;
      ctx.transform(ex / m, ey / m, 0, 1, 0, 0);
      const x = 0, y = 0;

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
  // La patte du fond (`cote` negatif) recule et remonte : elle est de l'autre
  // cote du corps. C'est ce decalage qui separe les quatre pattes a l'ecran.
  const voie = p.cote * VOIE * m;
  const hx = (p.avant ? avant - 0.30 * m : arriere + 0.26 * m) + voie;
  const hy = (p.avant ? garrot + 0.04 * m : croupe + 0.02 * m) - voie * 0.35;
  const fx = hx + px * m;
  const fy = hy + (PATTE * m) - py * m - voie * 0.30;

  // Le genou, pose au tiers et pousse vers l'avant pour l'anterieur, vers
  // l'arriere pour le posterieur : c'est ce coude inverse qui fait qu'on
  // reconnait un quadrupede et non un homme a quatre jambes.
  const mx = (hx + fx) * 0.5 + (p.avant ? 0.06 : -0.10) * m;
  const my = (hy + fy) * 0.5;

  // EPAISSES, comme le reste de la bete. A deux pixels de large, une patte
  // n'est plus un membre mais un fil, et quatre fils sous un bloc noir ne
  // font pas un animal. Le pied a disparu : quarante-cinq millimetres, soit
  // un pixel et trois dixiemes — il n'ajoutait qu'un epaississement sale au
  // bout de la patte.
  capsule(ctx, hx, hy, mx, my, 0.105 * m, couleur);
  capsule(ctx, mx, my, fx, fy, 0.075 * m, couleur);
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
  // COURTE ET EPAISSE, et c'est la seconde chose qui trahissait l'animal.
  // Elle faisait soixante-dix centimetres pour trois centimetres et demi de
  // rayon : a l'ecran, un trait d'un pixel de large et long comme la moitie
  // du corps — une antenne. Un molosse porte une queue courte et lourde, qui
  // prolonge la croupe au lieu de flotter derriere.
  const bat = Math.sin(cycle * TAU * 1.5) * 0.12 * (0.4 + vitesse);
  const x1 = x - 0.22 * m, y1 = y - 0.05 * m + bat * m;
  const x2 = x - 0.42 * m, y2 = y - 0.12 * m + bat * 1.8 * m;
  capsule(ctx, x, y, x1, y1, 0.085 * m, POIL);
  capsule(ctx, x1, y1, x2, y2, 0.055 * m, POIL);
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
  /* LA TETE EST REFAITE EN MASSES, ET C'EST UNE LECON SUR LA TAILLE.

     Celle d'avant portait quatre crocs, deux machoires, un fond de gorge,
     une oreille et un eclat dans l'oeil. Sur la page d'apercu c'etait une
     gueule. Dans le jeu, a vingt-neuf pixels le metre, chaque croc mesurait
     `0.045 * m`, soit UN PIXEL ET TROIS DIXIEMES, et l'eclat de l'oeil un
     demi-pixel. Rien de tout cela ne pouvait se dessiner : les traits se
     melangeaient en une tache rouge et blanche a l'avant de la bete, et la
     tete elle-meme — un baton de 0,125 m de rayon, trois pixels et demi —
     ne se lisait plus comme une tete.

     ON NE DESSINE DONC QUE CE QUI TIENT EN TROIS PIXELS : un cou epais, un
     crane haut, un museau court, et une fente de gueule. Les crocs restent,
     mais DEUX seulement et deux fois plus gros, et uniquement quand la gueule
     est assez ouverte pour qu'ils aient la place. Le reste — le fond de
     gorge, la seconde machoire — disparait : il ne se voyait pas, il salissait.

     LA REGLE VAUT AU-DELA DE CE FICHIER : un trait plus fin qu'un pixel et
     demi n'ajoute pas du detail, il ajoute du bruit, et le bruit mange la
     silhouette qui est la seule chose qu'on lise a cette distance. */

  // LE COU. Epais, court, et il plonge : c'est la posture de la poursuite.
  // C'est aussi la piece qui fait le molosse — un cou mince donnait un chien
  // de course, quelle que soit la taille du reste.
  const plonge = (0.08 + 0.14 * vitesse) * m;
  const cx = avant + 0.24 * m;
  const cy = garrot + plonge + Math.sin(cycle * TAU) * 0.03 * m;
  capsule(ctx, avant - 0.24 * m, garrot - 0.02 * m, cx, cy, 0.20 * m, POIL);

  // LE CRANE, haut et carre, puis le museau, court et plus bas. Deux capsules
  // de rayons differents suffisent a dire « grosse tete, petit museau », et
  // c'est exactement ce qui distingue un molosse d'un berger.
  capsule(ctx, cx - 0.04 * m, cy, cx + TETE * 0.30 * m, cy + 0.01 * m, 0.185 * m, POIL);
  const mx = cx + TETE * 0.34 * m;
  capsule(ctx, mx, cy + 0.045 * m, mx + TETE * 0.40 * m, cy + 0.055 * m, 0.115 * m, POIL);

  // LA GUEULE : une fente, pas une bouche. Elle bat avec la foulee — une bete
  // lancee halete — et on ne peint le rouge que si la fente depasse un pixel
  // et demi, faute de quoi il ne resterait qu'une salissure sombre.
  const ouvre = (0.085 + 0.055 * Math.sin(cycle * TAU)) * m;
  if (ouvre > 1.5) {
    ctx.fillStyle = GUEULE;
    ctx.beginPath();
    ctx.moveTo(mx - 0.02 * m, cy + 0.045 * m);
    ctx.lineTo(mx + TETE * 0.44 * m, cy + 0.045 * m - ouvre * 0.55);
    ctx.lineTo(mx + TETE * 0.44 * m, cy + 0.045 * m + ouvre * 0.55);
    ctx.closePath();
    ctx.fill();

    // DEUX CROCS, et deux fois plus gros que les quatre d'avant. A cette
    // taille, deux traits blancs qui se voient valent mieux que quatre qui
    // se melangent.
    ctx.fillStyle = CROC;
    const croc = (dx, dy, sens) => {
      ctx.beginPath();
      ctx.moveTo(mx + dx, cy + 0.045 * m + dy);
      ctx.lineTo(mx + dx + 0.085 * m, cy + 0.045 * m + dy);
      ctx.lineTo(mx + dx + 0.042 * m, cy + 0.045 * m + dy + sens * 0.15 * m);
      ctx.closePath();
      ctx.fill();
    };
    croc(TETE * 0.16 * m, -ouvre * 0.40, +1);
    croc(TETE * 0.20 * m, ouvre * 0.40, -1);
  }

  // L'OREILLE, couchee vers l'arriere — un chien lance plaque ses oreilles ;
  // dressee, il aurait l'air attentif, pas menacant. Elle est plus large
  // qu'avant pour la meme raison que tout le reste.
  ctx.fillStyle = POIL;
  ctx.beginPath();
  ctx.moveTo(cx + 0.04 * m, cy - 0.16 * m);
  ctx.lineTo(cx - 0.30 * m, cy - 0.40 * m);
  ctx.lineTo(cx - 0.04 * m, cy - 0.06 * m);
  ctx.closePath();
  ctx.fill();

  // L'OEIL. C'est le point le plus lumineux de toute l'image du mode, et il
  // doit l'etre : c'est ce qu'on cherche du regard quand on sent que la bete
  // se rapproche. Il palpite — un halo qui respire se remarque a la
  // peripherie de la vision, ce qu'un point fixe ne fait pas.
  //
  // L'ECLAT BLANC A ETE RETIRE : seize millimetres, soit un demi-pixel. Il ne
  // se voyait pas, et il eclaircissait l'oeil au lieu de le faire briller.
  const pulse = 0.82 + 0.18 * Math.sin(t * 7.5);
  const ox = cx + TETE * 0.24 * m, oy = cy - 0.075 * m;
  const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, 0.34 * m * pulse);
  halo.addColorStop(0, 'rgba(255,96,48,0.90)');
  halo.addColorStop(0.45, 'rgba(228,48,22,0.32)');
  halo.addColorStop(1, 'rgba(228,48,22,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ox, oy, 0.34 * m * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = OEIL;
  ctx.beginPath();
  ctx.arc(ox, oy, 0.062 * m, 0, TAU);
  ctx.fill();
}

/** La bete est-elle assez pres pour qu'on lui doive un grondement ? */
export function proximite(chasse) {
  if (!chasse) return 0;
  return Math.max(0, Math.min(1, 1 - chasse.ecart / 12));
}
