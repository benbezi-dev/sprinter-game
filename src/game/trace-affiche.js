/* ---------------------------------------------------------------------------
   LE LANGAGE VISUEL DES IMAGES QUI SORTENT DU JEU
   ---------------------------------------------------------------------------
   Un seul fichier dessine tout ce que Sprinter publie, quel que soit le
   chemin par lequel l'image part :

     - le joueur qui partage sa course depuis l'ecran d'arrivee — src/game/affiche.ts ;
     - l'atelier de publication qui prepare le compte du jeu — suivi/reseaux.html.

   Ces deux-la n'ont ni les memes donnees ni la meme composition, mais ils
   partagent la nuit du jeu, sa lueur doree, ses trois couloirs, sa signature
   et surtout sa facon d'ecrire un chrono. Les separer aurait garanti qu'ils
   divergent : on retouche une lueur d'un cote, on l'oublie de l'autre, et six
   mois plus tard le compte du jeu et le jeu ne se ressemblent plus.

   Du JavaScript et pas du TypeScript, comme haies-course.js et sprinter-core.js
   a cote : l'atelier est une page servie telle quelle depuis suivi/, sans
   compilation, et il doit pouvoir importer ce module directement.

   Rien ici ne connait le reseau, le stockage, ni le partage. On donne un
   canvas et des donnees, on recoit des pixels.
--------------------------------------------------------------------------- */

export const FORMATS = {
  feed:  { l: 1080, h: 1350, nom: 'Fil Instagram', ou: 'instagram' },
  story: { l: 1080, h: 1920, nom: 'Story · TikTok', ou: 'instagram+tiktok' },
  large: { l: 1600, h: 900,  nom: 'X', ou: 'x' },
};

// La virgule, pas le point. La charte ecrit « 9,58 s » et la publication du
// 30 aout « 8,25 s en tete » : le point venait de toFixed, pas d'un choix. Un
// chrono francais s'ecrit a la virgule, y compris — et surtout — en 216 px.
export const s2 = ms => (Number(ms) / 1000).toFixed(2).replace('.', ',');
export const EPREUVE = r => String(r || '')
  .replace(/^(\d+)$/, '$1 m')
  .replace(/^(\d+)h$/, '$1 m H');

/** Le jeu d'une epreuve, pour la signature de l'image : les haies sont a Hurdlers. */
const MARQUE = r => (/^\d+h$/.test(String(r || '')) ? 'Hurdlers' : 'Sprinter');

/* --------------------------------------------------------------- le dessin */

/** Le fond commun : la nuit du jeu, sa lueur doree, et trois couloirs.
 *
 *  Exporte depuis le 7 septembre 2026 : la video de nouveautes
 *  (suivi/publications/2026-09-07-reel-nouveautes/) dessine seize plans sur
 *  ce meme fond. Le recopier la-bas aurait garanti la divergence que
 *  l'en-tete de ce fichier interdit — une lueur retouchee d'un cote et
 *  oubliee de l'autre. L'appel interne ne change pas. */
export function poserFond(c, L, H) {
  c.fillStyle = '#060913'; c.fillRect(0, 0, L, H);

  const lueur = c.createRadialGradient(L / 2, H * 0.08, 0, L / 2, H * 0.08, L * 0.85);
  lueur.addColorStop(0, 'rgba(248,205,74,0.20)');
  lueur.addColorStop(1, 'rgba(248,205,74,0)');
  c.fillStyle = lueur; c.fillRect(0, 0, L, H);

  // Trois traits en fuite suffisent a poser le stade. Davantage, et l'oeil
  // quitte le chiffre — qui est le sujet. Le gabarit du 30 aout disait deja
  // cela, et il avait raison.
  c.save(); c.globalAlpha = 0.14;
  for (let i = 0; i < 3; i++) {
    const y = H * (0.62 + i * 0.11);
    const g = c.createLinearGradient(0, y, L, y);
    g.addColorStop(0, 'rgba(248,205,74,0)');
    g.addColorStop(0.5, 'rgba(248,205,74,1)');
    g.addColorStop(1, 'rgba(248,205,74,0)');
    c.fillStyle = g; c.fillRect(0, y, L, Math.max(2, L / 540));
  }
  c.restore();
}

/** La signature, en bas. Discrete : le compte se nomme deja au-dessus.
 *  `droite` ne change que pour les cartes d'annonce en anglais (« SPRINT GAME ») ;
 *  toutes les images du jeu gardent « JEU DE SPRINT ». */
function poserPied(c, L, H, marge, droite = 'JEU DE SPRINT') {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(marge, H - marge * 1.5); c.lineTo(L - marge, H - marge * 1.5); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.46)';
  c.font = `700 ${Math.round(L * 0.0205)}px Outfit, sans-serif`;
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.letterSpacing = `${L * 0.006}px`;
  c.fillText('SPRINTER', marge, H - marge * 0.92);
  c.textAlign = 'right';
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.fillText(droite, L - marge, H - marge * 0.92);
  c.restore();
}

/**
 * Les lignes d'un titre, coupees aux mots. Le contexte porte deja sa police.
 *
 * Un `\n` est un retour voulu et il est garde : « FAIS\nUN DUEL » tiendrait
 * sur une ligne, et c'est justement ce que l'auteur ne veut pas. La mesure et
 * le trace passent tous deux par ici — deux boucles de coupe finissent par ne
 * plus couper au meme endroit, et le titre deborde alors sur ce qui le suit.
 */
function couperTitre(c, texte, largeurMax, majuscules) {
  const brut = majuscules ? String(texte).toUpperCase() : String(texte);
  const lignes = [];
  for (const para of brut.split('\n')) {
    let ligne = '';
    for (const m of para.split(' ')) {
      const essai = ligne ? ligne + ' ' + m : m;
      if (c.measureText(essai).width > largeurMax && ligne) { lignes.push(ligne); ligne = m; }
      else ligne = essai;
    }
    if (ligne) lignes.push(ligne);
  }
  return lignes;
}

/** Un titre sur plusieurs lignes, coupe aux mots. */
function titre(c, texte, x, y, largeurMax, taille, interligne, majuscules = true) {
  // save/restore, comme les trois autres fonctions de trace. Sans lui, le
  // `letterSpacing` negatif du titre restait pose sur le contexte et le chrono
  // suivant sortait « 8 . 2 5 » : un reglage qui fuit ne se voit pas dans le
  // code qui le subit.
  c.save();
  c.font = `900 ${taille}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.letterSpacing = `${-taille * 0.022}px`;
  const lignes = couperTitre(c, texte, largeurMax, majuscules);
  lignes.forEach((l, i) => c.fillText(l, x, y + i * interligne));
  c.restore();
  return y + lignes.length * interligne;
}

/**
 * Les morceaux d'un chrono a la virgule, et la largeur de l'ensemble.
 *
 * Avec virgule, elle occupe une chasse entiere, comme un chiffre. A 216 px cela
 * creuse un trou au milieu du chrono — « 8 , 25 » — et c'est le chiffre qui est
 * le sujet de l'image. Le resserrement global ne repare pas cela : il rapproche
 * aussi les chiffres entre eux, qui n'ont rien demande.
 *
 * On compose donc en trois morceaux et on ne reprend de la place qu'autour du
 * separateur. Les chiffres gardent leur chasse, la virgule perd la sienne.
 *
 * Mesure et trace sont separes parce que deux appelants en ont besoin a des
 * moments differents : `chiffre` trace a une taille donnee, `chronoPleinCadre`
 * cherche d'abord la taille qui remplit une largeur. Les laisser diverger,
 * c'est se retrouver avec deux virgules qui ne tombent pas au meme endroit.
 *
 * Le contexte doit deja porter la police voulue : on ne mesure bien que ce
 * qu'on s'apprete a tracer.
 */
export function morceauxChrono(c, str) {
  const i = str.indexOf(',');

  // Sans virgule — un cap, un decompte — rien a composer : la chasse fixe fait
  // exactement ce qu'on lui demande, aligner des colonnes de chiffres.
  if (i < 0) return { entier: str, virgule: '', deci: '',
                      wEntier: c.measureText(str).width, wVirg: 0, wDeci: 0,
                      largeur: c.measureText(str).width };

  const entier = str.slice(0, i), deci = str.slice(i + 1);
  const wEntier = c.measureText(entier).width;
  const wDeci = c.measureText(deci).width;
  // Deux cinquiemes de chasse : assez pour que la virgule respire sous le
  // chiffre precedent, assez peu pour que l'oeil lise un seul nombre.
  const wVirg = c.measureText('0').width * 0.40;

  return { entier, virgule: ',', deci, wEntier, wVirg, wDeci,
           largeur: wEntier + wVirg + wDeci };
}

/** Trace les morceaux mesures ci-dessus, a partir d'un bord gauche.
 *  Exporte avec `morceauxChrono` le 7 septembre 2026, pour le reel de
 *  nouveautes : un chrono de 176 px qui garde la chasse pleine de la virgule
 *  se lit « 8 , 25 ». La composition en trois morceaux est la reponse, et
 *  elle ne doit exister qu'ici. */
export function poserMorceaux(c, m, gauche, y) {
  let cur = gauche;
  c.textAlign = 'left';
  c.fillText(m.entier, cur, y);
  if (!m.virgule) return;
  cur += m.wEntier;
  // La virgule est centree dans sa fente etroite, sinon elle colle au chiffre
  // de gauche et l'on a deplace le trou au lieu de le boucher.
  c.textAlign = 'center';
  c.fillText(m.virgule, cur + m.wVirg / 2, y);
  cur += m.wVirg;
  c.textAlign = 'left';
  c.fillText(m.deci, cur, y);
}

/**
 * Le chiffre, en grand, a chasse fixe.
 *
 * Space Mono et pas Outfit : les chronos se lisent en colonne, et une chasse
 * proportionnelle fait danser les virgules d'une ligne a l'autre. C'est le
 * detail qui separe un tableau de resultats d'une capture d'ecran ratee.
 */
function chiffre(c, texte, x, y, taille, couleur = '#F8CD4A') {
  c.save();
  c.fillStyle = couleur;
  c.font = `700 ${taille}px 'Space Mono', monospace`;
  c.textBaseline = 'middle';
  const m = morceauxChrono(c, String(texte));
  poserMorceaux(c, m, x - m.largeur / 2, y);
  c.restore();
}

/** Le surtitre : petites capitales tres espacees, comme dans le jeu. */
function surtitre(c, texte, x, y, taille, gras = 700) {
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.46)';
  c.font = `${gras} ${taille}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.letterSpacing = `${taille * 0.36}px`;
  c.fillText(String(texte).toUpperCase(), x + taille * 0.18, y);
  c.restore();
}

/**
 * Dessine un moment dans un canvas, au format demande.
 *
 * Un seul point d'entree pour les trois formats : les proportions sont
 * exprimees en fractions de la largeur, si bien qu'une story et une image de X
 * sortent du meme code. Deux fonctions auraient diverge des la premiere
 * retouche.
 */
/**
 * Empile des elements et centre le tout dans la hauteur disponible.
 *
 * La premiere version dessinait de haut en bas depuis une marge fixe, et le
 * resultat se voyait : un titre, un chrono, puis le tiers inferieur de l'image
 * vide. Un format carre pardonne cela, un 1080 x 1920 non.
 *
 * Chaque element declare sa hauteur et sait se dessiner a un `y` donne. On
 * additionne, on centre, on trace. C'est ce qui permet aux trois formats de
 * partager le meme code sans qu'aucun n'ait l'air d'un autre mal recadre.
 */
function empiler(elements, hautDispo, basDispo) {
  const total = elements.reduce((n, e) => n + e.h, 0);
  let y = hautDispo + (basDispo - hautDispo - total) / 2;
  for (const e of elements) { e.dessine(y); y += e.h; }
}

/** La hauteur qu'occupera un titre, sans le tracer. */
function mesurerTitre(c, texte, largeurMax, taille, interligne, majuscules = true) {
  c.save();
  c.font = `900 ${taille}px Outfit, sans-serif`;
  c.letterSpacing = `${-taille * 0.022}px`;
  const n = Math.max(1, couperTitre(c, texte, largeurMax, majuscules).length);
  c.restore();
  return n * interligne;
}

/** Une ligne de texte simple, centree. */
function ligne(c, texte, x, y, taille, couleur, gras = 500) {
  c.save();
  c.fillStyle = couleur;
  c.font = `${gras} ${taille}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(texte, x, y);
  c.restore();
}

/**
 * Dessine un moment dans un canvas, au format demande.
 *
 * Un seul point d'entree pour les trois formats : les proportions sont
 * exprimees en fractions de la largeur, si bien qu'une story et une image de X
 * sortent du meme code. Deux fonctions auraient diverge des la premiere
 * retouche.
 */
export function dessinerMoment(cv, moment, format) {
  const F = FORMATS[format] || FORMATS.feed;
  const L = F.l, H = F.h;
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');
  const d = moment.donnees || {};
  const marge = Math.round(L * 0.082);
  const cx = L / 2;
  const largeurTitre = L - marge * 2;

  poserFond(c, L, H);

  // Le haut : d'ou vient le moment. Il ne participe pas au centrage — c'est
  // une etiquette de provenance, elle tient sa place quoi qu'il arrive.
  const hautY = Math.round(H * 0.105);
  surtitre(c, entete(moment), cx, hautY, Math.round(L * 0.0205));

  // La zone ou le sujet a le droit de vivre : sous l'etiquette, au-dessus du
  // filet de pied.
  const haut = hautY + Math.round(L * 0.055);
  const bas = H - marge * 2.1;

  // Le format large (X) est trois fois moins haut que large : les tailles
  // exprimees en fraction de LARGEUR y deviennent enormes. On les ramene a la
  // hauteur, qui est la dimension rare de ce format-la.
  const u = format === 'large' ? H * 0.62 : L;

  const blocs = [];
  const T = t => Math.round(u * t);

  if (moment.type === 'tete' || moment.type === 'podium') {
    const texte = moment.type === 'tete' ? 'Nouvelle tête' : `${d.rang}e au classement`;
    const tt = T(0.082), ti = T(0.078);
    blocs.push({ h: mesurerTitre(c, texte, largeurTitre, tt, ti) + T(0.03),
                 dessine: y => { c.fillStyle = '#FFFFFF';
                                 titre(c, texte, cx, y, largeurTitre, tt, ti); } });
    blocs.push({ h: T(0.24), dessine: y => chiffre(c, s2(d.chrono_ms), cx, y + T(0.12), T(0.20)) });
    blocs.push({ h: T(0.055), dessine: y =>
      ligne(c, `${d.nom || ''} · ${EPREUVE(d.race)}`, cx, y, T(0.034), 'rgba(255,255,255,0.55)') });
    if (d.ecart_ms != null) {
      blocs.push({ h: T(0.05), dessine: y =>
        ligne(c, `${s2(d.ecart_ms)} s devant le suivant`, cx, y, T(0.030), 'rgba(248,205,74,0.85)', 600) });
    } else if (d.tete_ms != null) {
      blocs.push({ h: T(0.05), dessine: y =>
        ligne(c, `${s2(d.chrono_ms - d.tete_ms)} s de la tete`, cx, y, T(0.030), 'rgba(248,205,74,0.85)', 600) });
    }

  } else if (moment.type === 'mouchoir') {
    const texte = `${d.combien} coureurs, ${Math.round(d.ecart_ms / 10)} centièmes`;
    const tt = T(0.072), ti = T(0.070);
    blocs.push({ h: mesurerTitre(c, texte, largeurTitre, tt, ti) + T(0.045),
                 dessine: y => { c.fillStyle = '#FFFFFF';
                                 titre(c, texte, cx, y, largeurTitre, tt, ti); } });
    // La liste prend ce qui reste : c'est elle le sujet, pas le titre.
    const n = (d.chronos_ms || []).length || 1;
    const reste = bas - haut - blocs[0].h;
    const pas = Math.min(reste / n, T(0.075));
    // La colonne ne prend pas toute la largeur disponible : sur un 1600 x 900,
    // les noms a gauche et les chronos a l'extreme droite se retrouvent a plus
    // d'un metre l'un de l'autre a l'ecran, et l'oeil ne fait plus le lien
    // entre les deux. On borne la colonne et on la centre.
    const colonne = Math.min(L - marge * 2, u * 1.05);
    const gaucheCol = (L - colonne) / 2;
    blocs.push({ h: pas * n, dessine: y => {
      (d.chronos_ms || []).forEach((ms, i) => {
        const ly = y + pas * (i + 0.5);
        c.save();
        c.textBaseline = 'middle';
        c.fillStyle = i === 0 ? '#F8CD4A' : 'rgba(255,255,255,0.72)';
        c.font = `${i === 0 ? 700 : 500} ${Math.round(pas * 0.44)}px Outfit, sans-serif`;
        c.textAlign = 'left';
        c.fillText(`${i + 1}. ${(d.noms || [])[i] || ''}`, gaucheCol, ly);
        c.font = `700 ${Math.round(pas * 0.46)}px 'Space Mono', monospace`;
        c.textAlign = 'right';
        c.fillText(s2(ms), gaucheCol + colonne, ly);
        c.restore();
      });
    } });

  } else if (moment.type === 'duel') {
    const texte = `${Math.round(d.ecart_ms / 10)} centièmes`;
    const tt = T(0.082), ti = T(0.078);
    blocs.push({ h: mesurerTitre(c, texte, largeurTitre, tt, ti) + T(0.055),
                 dessine: y => { c.fillStyle = '#FFFFFF';
                                 titre(c, texte, cx, y, largeurTitre, tt, ti); } });
    // Le gagnant en or au-dessus, l'autre en blanc dessous : l'ecart se lit
    // avant les noms, et c'est l'ecart qui est le sujet.
    for (const [ms, nom, or] of [[d.gagnant_ms, d.gagnant, true],
                                 [d.perdant_ms, d.perdant, false]]) {
      // Le chrono est trace a partir de son MILIEU (textBaseline middle) et
      // occupe donc T(0.135) a cheval sur ce point : le nom doit commencer
      // sous le bas du chiffre, pas sous son centre. La premiere version
      // l'oubliait et le nom s'imprimait dans les jambages du chrono.
      blocs.push({ h: T(0.215), dessine: y => {
        chiffre(c, s2(ms), cx, y + T(0.075), T(0.135), or ? '#F8CD4A' : 'rgba(255,255,255,0.82)');
        ligne(c, nom || '', cx, y + T(0.160), T(0.030),
              or ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.38)');
      } });
    }

  } else if (moment.type === 'sacre') {
    const texte = d.epreuve ? `Titre · ${EPREUVE(d.epreuve)}` : 'Un titre';
    const tt = T(0.072), ti = T(0.070);
    blocs.push({ h: mesurerTitre(c, texte, largeurTitre, tt, ti) + T(0.05),
                 dessine: y => { c.fillStyle = '#FFFFFF';
                                 titre(c, texte, cx, y, largeurTitre, tt, ti); } });
    blocs.push({ h: T(0.10), dessine: y =>
      ligne(c, String(d.champion || '').toUpperCase(), cx, y, T(0.068), '#F8CD4A', 800) });
    if (d.chrono_ms != null) {
      blocs.push({ h: T(0.175), dessine: y => chiffre(c, s2(d.chrono_ms), cx, y + T(0.085), T(0.13)) });
    }
    if (d.deuxieme_ms != null && d.chrono_ms != null) {
      blocs.push({ h: T(0.05), dessine: y =>
        ligne(c, `${s2(d.deuxieme_ms - d.chrono_ms)} s devant ${d.deuxieme || 'le second'}`,
              cx, y, T(0.028), 'rgba(255,255,255,0.50)') });
    }
    if (d.partants) {
      blocs.push({ h: T(0.045), dessine: y =>
        ligne(c, `${d.partants} partants`, cx, y, T(0.026), 'rgba(255,255,255,0.34)') });
    }

  } else if (moment.type === 'cap') {
    const texte = LIBELLE_CAP[d.quoi] || String(d.quoi || '');
    const tt = T(0.072), ti = T(0.070);
    blocs.push({ h: T(0.22), dessine: y =>
      chiffre(c, Number(d.seuil).toLocaleString('fr-FR'), cx, y + T(0.11), T(0.17)) });
    blocs.push({ h: mesurerTitre(c, texte, largeurTitre, tt, ti),
                 dessine: y => { c.fillStyle = '#FFFFFF';
                                 titre(c, texte, cx, y, largeurTitre, tt, ti); } });
  }

  empiler(blocs, haut, bas);
  poserPied(c, L, H, marge);
  return cv;
}

export const LIBELLE_CAP = {
  courses: 'courses jouées',
  joueurs: 'joueurs classés',
  duels: 'duels tranchés',
  visites: 'visites',
};

function entete(m) {
  const d = m.donnees || {};
  if (m.type === 'sacre') {
    return [d.echelon, d.pays].filter(Boolean).join(' · ') || 'championnat';
  }
  if (d.race) return `${MARQUE(d.race)} · ${EPREUVE(d.race)}`;
  return 'Sprinter';
}

/* ---------------------------------------------------------------------------
   LA COURSE D'UN JOUEUR
   ---------------------------------------------------------------------------
   L'autre chemin : celui du joueur qui vient de finir et qui veut le montrer.
   Rien a voir avec la file du compte du jeu — les donnees sont locales, elles
   ne passent par aucun serveur, et le nom qui s'y affiche est celui que le
   joueur a lui-meme choisi de mettre. C'est la difference qui explique
   pourquoi rien n'est masque ici : on ne publie pas le pseudonyme d'un autre,
   on partage le sien.

   Un seul format : 1080 x 1920. C'est celui de la story Instagram et celui de
   TikTok, et c'est le seul que quelqu'un partage vraiment depuis un telephone
   trois secondes apres une course. Proposer un choix de formats a cet
   instant-la serait ajouter une decision a un geste qui n'en demande pas.
--------------------------------------------------------------------------- */

/**
 * Dessine la course qui vient d'etre courue.
 *
 * `course` porte : { chronoMs, epreuves, nom, fantomeNom, fantomeMs, rang,
 * battus }.
 * Tout est facultatif sauf le chrono — un joueur sans nom, sans fantome et
 * sans rang doit obtenir une image aussi complete que les autres, sinon le
 * bouton ne sert qu'a ceux qui ont deja tout fait.
 */
export function dessinerCourse(cv, course) {
  const L = 1080, H = 1920;
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');
  const marge = Math.round(L * 0.082);
  const cx = L / 2;
  // La story a de la hauteur a revendre, mais Instagram en mange environ 250 px
  // en haut (le nom du compte) et autant en bas (la barre de reponse). L'unite
  // de taille reste donc la largeur : c'est elle qui est vraiment disponible.
  const u = L;
  const T = t => Math.round(u * t);

  poserFond(c, L, H);

  // La zone sure d'une story : Instagram mange environ 250 px en haut (le nom
  // du compte) et autant en bas (la barre de reponse).
  const haut = Math.round(H * 0.16);
  const bas = H - Math.round(H * 0.175);

  const blocs = [];

  // Le surtitre voyage AVEC le groupe, au lieu d'etre epingle en haut de
  // l'image comme dans l'atelier. La difference se voit des qu'un joueur n'a
  // pas saisi de nom : le bloc devient court, et un surtitre fixe se retrouve
  // seul a un tiers de hauteur du chrono, avec un trou entre les deux. Ici
  // tout se resserre ensemble et l'image tient quel que soit ce qu'on sait du
  // coureur.
  blocs.push({ h: T(0.075), dessine: y =>
    surtitre(c, epreuvesEnTexte(course.epreuves), cx, y, T(0.0205)) });

  // Le chrono, et rien d'autre au-dessus. C'est le sujet : la charte demande
  // un chiffre dans l'image, et celui-la est le seul qui compte pour celui qui
  // vient de courir.
  blocs.push({ h: T(0.30), dessine: y => chiffre(c, s2(course.chronoMs), cx, y + T(0.15), T(0.26)) });
  blocs.push({ h: T(0.06), dessine: y =>
    ligne(c, 'SECONDES', cx, y, T(0.032), 'rgba(255,255,255,0.40)', 700) });

  if (course.nom) {
    blocs.push({ h: T(0.10), dessine: y =>
      ligne(c, String(course.nom).toUpperCase(), cx, y + T(0.02), T(0.052), '#FFFFFF', 800) });
  }

  // Le fantome : l'ecart, pas le verdict. « 0,12 s » se lit et se compare,
  // « bien joue » ne dit rien a personne.
  if (course.fantomeMs != null && Number.isFinite(Number(course.fantomeMs))) {
    const ecart = Number(course.chronoMs) - Number(course.fantomeMs);
    const gagne = ecart < 0;
    blocs.push({ h: T(0.075), dessine: y =>
      ligne(c, `${gagne ? '−' : '+'}${s2(Math.abs(ecart))} s`, cx, y,
            T(0.048), gagne ? '#F8CD4A' : 'rgba(255,255,255,0.62)', 700) });
    blocs.push({ h: T(0.05), dessine: y =>
      ligne(c, course.fantomeNom ? `face à ${course.fantomeNom}` : 'face au fantôme',
            cx, y, T(0.028), 'rgba(255,255,255,0.38)') });
  }

  // Ceux qu'on a devances, nommes.
  //
  // Une course en direct se court CONTRE quelqu'un, et l'image ne le disait
  // pas : elle montrait un chrono seul, exactement comme un tour de piste joue
  // dans son coin. Le nom de l'adversaire est ce qui transforme un resultat en
  // recit — et, accessoirement, ce qui fait que l'autre republie.
  //
  // L'ecart plutot que le classement : « +0,12 » se lit et se compare, « 2e »
  // ne dit pas de combien. C'est la regle du chiffre avant l'adjectif,
  // appliquee a l'endroit ou elle compte le plus.
  const battus = Array.isArray(course.battus) ? course.battus.filter(b => b && b.nom) : [];
  if (battus.length) {
    // Cinq au maximum : au-dela, la liste mange le chrono, qui reste le sujet.
    // Le reste se compte, il ne se nomme pas.
    const montres = battus.slice(0, 5);
    const reste = battus.length - montres.length;

    // Un peu de hauteur avant l'etiquette, et une taille lisible : a T(0.019)
    // avec l'espacement des petites capitales, « DEVANT » se refermait sur
    // lui-meme et passait pour une trainee grise sous le nom.
    blocs.push({ h: T(0.075), dessine: y =>
      surtitre(c, 'DEVANT', cx, y + T(0.028), T(0.023)) });

    const pas = T(0.052);
    blocs.push({ h: pas * montres.length + (reste ? T(0.04) : 0), dessine: y => {
      montres.forEach((b, i) => {
        const ly = y + pas * (i + 0.5);
        c.save();
        c.textBaseline = 'middle';
        // La colonne est bornee et centree : sur une story de 1080 de large,
        // un nom colle a gauche et un ecart colle a droite ne se lisent plus
        // comme une meme ligne.
        const colonne = Math.min(L - marge * 2, u * 0.66);
        const g = (L - colonne) / 2;
        c.fillStyle = 'rgba(255,255,255,0.62)';
        c.font = `500 ${Math.round(pas * 0.60)}px Outfit, sans-serif`;
        c.textAlign = 'left';
        c.fillText(String(b.nom), g, ly);
        // Un abandon n'a pas d'ecart : afficher « +0,00 » mentirait, et
        // afficher un ecart calcule sur un chrono absent mentirait davantage.
        const ecart = (!b.abandon && Number.isFinite(Number(b.ms)))
          ? '+' + s2(Number(b.ms) - Number(course.chronoMs)) : 'abandon';
        c.fillStyle = b.abandon ? 'rgba(255,255,255,0.30)' : 'rgba(248,205,74,0.80)';
        c.font = `700 ${Math.round(pas * 0.58)}px 'Space Mono', monospace`;
        c.textAlign = 'right';
        c.fillText(ecart, g + colonne, ly);
        c.restore();
      });
      if (reste) {
        ligne(c, `et ${reste} autre${reste > 1 ? 's' : ''}`, cx,
              y + pas * montres.length + T(0.005), T(0.024), 'rgba(255,255,255,0.34)');
      }
    } });
  }

  if (course.rang) {
    blocs.push({ h: T(0.07), dessine: y =>
      ligne(c, `${course.rang}e au classement`, cx, y + T(0.02), T(0.030),
            'rgba(248,205,74,0.85)', 600) });
  }

  empiler(blocs, haut, bas);

  // Le compte, en bas : une story se regarde hors de tout contexte, et sans
  // cette ligne l'image ne dit pas ou retrouver le jeu. C'est la seule de
  // l'image qui serve a autre chose qu'a raconter la course.
  //
  // Le nom du compte plutot que l'adresse du site : une story se regarde DANS
  // Instagram, ou une adresse ne se clique pas et ne se recopie pas — tandis
  // qu'un @ se cherche d'un geste, sans quitter l'application.
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.font = `600 ${T(0.026)}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.letterSpacing = `${T(0.004)}px`;
  c.fillText('@sprintergame', cx, H - Math.round(H * 0.088));
  c.restore();

  poserPied(c, L, H, marge);
  return cv;
}

/** « 100 m » seul, ou « 100 + 200 + 400 m » pour un enchainement. */
function epreuvesEnTexte(epreuves) {
  const l = (Array.isArray(epreuves) ? epreuves : [epreuves]).filter(Boolean);
  if (!l.length) return 'Sprinter';
  const marque = MARQUE(l[0]);
  if (l.length === 1) return `${marque} · ${EPREUVE(l[0])}`;
  // Les haies gardent leur H a chaque epreuve : « 100 + 110 m » ne dirait pas
  // qu'on a franchi quoi que ce soit.
  if (marque === 'Hurdlers') return `${marque} · ${l.map(EPREUVE).join(' + ')}`;
  return `${marque} · ${l.join(' + ')} m`;
}

/* ---------------------------------------------------------------------------
   UN SEUL CHRONO
   ---------------------------------------------------------------------------
   Le fil Instagram, 1080 x 1350, et une seule chose dedans : le temps a battre.

   Les compositions du dessus racontent un evenement — une tete qui change, un
   mouchoir de poche, un sacre — et pour cela elles ont besoin d'un titre. Ici
   il n'y a pas d'evenement, il y a une borne : voila le chrono, la semaine est
   ouverte. Un titre par-dessus n'ajouterait rien et volerait la place du seul
   element qui doit etre vu de loin, dans un fil qui defile.

   D'ou les deux regles de cette composition, et elles se tiennent :

     - un chrono, pas une liste. Deux chronos cote a cote, et l'oeil compare au
       lieu de retenir. Le classement complet est un autre format ;
     - le chiffre prend toute la mesure. Pas une taille choisie dans l'echelle
       des autres compositions : la largeur disponible, moins les marges, et
       c'est elle qui decide de la taille du texte plutot que l'inverse.

   Aucun pseudonyme. La charte editoriale (§5.4) interdit de publier celui d'un
   joueur sans son accord ecrit, et la version masquee — « M... » — ne resout
   qu'a moitie : sur un classement de cette taille, une initiale et un rang
   designent souvent une seule personne. L'image n'en a pas besoin, on s'en
   passe.
--------------------------------------------------------------------------- */

/**
 * Le chrono a la taille que lui laisse la mesure, et son unite a cote.
 *
 * L'inverse des autres compositions, ou la taille est une fraction connue de la
 * largeur : ici on part de la place disponible et on en deduit le corps. C'est
 * la seule facon d'etre certain que le chiffre est aussi gros qu'il peut l'etre
 * sans jamais toucher la marge — et « aussi gros que possible » etait la
 * demande.
 *
 * L'unite reste attachee au nombre plutot que renvoyee sur une ligne a elle :
 * la charte ecrit « 8,25 s », et c'est ce que l'image doit dire. Elle est posee
 * sur la MEME ligne de pied que les chiffres, a un cinquieme de leur corps —
 * une marque d'unite, pas un mot.
 */
function chronoPleinCadre(c, texte, unite, cx, yCentre, mesure, couleur) {
  const REF = 100, RATIO_UNITE = 0.19, RATIO_BLANC = 0.10;
  c.save();
  c.fillStyle = couleur;
  c.textBaseline = 'alphabetic';

  // Trois coefficients mesures a un corps de reference, puis une division. On
  // ne tatonne pas : Space Mono est a chasse fixe, la largeur est lineaire.
  c.font = `700 ${REF}px 'Space Mono', monospace`;
  const kNombre = morceauxChrono(c, texte).largeur / REF;
  const kUnite = unite ? (c.measureText(unite).width / REF) * RATIO_UNITE : 0;
  const kBlanc = unite ? RATIO_BLANC : 0;
  const taille = Math.floor(mesure / (kNombre + kBlanc + kUnite));

  // On remesure au corps reel : le hinting deplace les choses de quelques
  // dixiemes, et a cette taille quelques dixiemes se voient au bord.
  c.font = `700 ${taille}px 'Space Mono', monospace`;
  const m = morceauxChrono(c, texte);
  const hautChiffre = c.measureText('8').actualBoundingBoxAscent || taille * 0.70;
  const tUnite = Math.round(taille * RATIO_UNITE);
  const blanc = unite ? taille * RATIO_BLANC : 0;
  let wUnite = 0;
  if (unite) { c.font = `700 ${tUnite}px 'Space Mono', monospace`; wUnite = c.measureText(unite).width; }

  // Le groupe est centre sur sa largeur totale, unite comprise : centrer le
  // seul nombre pousserait l'ensemble a gauche de la moitie de l'unite, et sur
  // une image ou tout le reste est centre cela se voit tout de suite.
  const gauche = cx - (m.largeur + blanc + wUnite) / 2;
  // `yCentre` est le milieu des CHIFFRES, pas la ligne de pied : c'est ce que
  // l'oeil centre, et les chiffres n'ont pas de jambage qui le decale.
  const base = yCentre + hautChiffre / 2;

  c.font = `700 ${taille}px 'Space Mono', monospace`;
  poserMorceaux(c, m, gauche, base);
  if (unite) {
    c.font = `700 ${tUnite}px 'Space Mono', monospace`;
    c.textAlign = 'left';
    c.fillText(unite, gauche + m.largeur + blanc, base);
  }

  // Le bas de l'encre, et non la ligne de pied. La virgule descend d'un
  // cinquieme de corps sous les chiffres — 80 px a cette taille — et ce qui se
  // range dessous doit partir de la. Mesure plutot que constante : la valeur
  // depend de la fonte, et c'est la fonte qui sait.
  c.font = `700 ${taille}px 'Space Mono', monospace`;
  const basChiffre = base + c.measureText(texte).actualBoundingBoxDescent;

  c.restore();
  return { taille, hautChiffre, base, basChiffre };
}

/**
 * Le meme chrono, format story — 1080 x 1920.
 *
 * Ecrit le 8 septembre 2026 pour la reprise en story du post du fil (la
 * commande de travail du mardi 8 dans calendrier-instagram.html). Elle demande
 * de « reprendre la composition du post 1080x1350 et de la recadrer en
 * 1080x1920, le chrono au centre optique, le haut et le bas combles avec le
 * fond de la charte — pas avec des barres noires plates ».
 *
 * POURQUOI UNE FONCTION ET PAS UN RECADRAGE. Composer l'image du fil dans un
 * cadre plus grand etait la voie evidente, et elle ne marche pas : `poserFond`
 * place la lueur a 8 % de la hauteur et les trois traits a 62, 73 et 84 %.
 * Ces fractions sont celles du cadre qu'on lui donne. Coller un fond de 1350
 * au milieu d'un fond de 1920, c'est donc superposer deux stades dont les
 * pistes ne sont pas au meme endroit, avec une couture la ou les deux degrades
 * se rencontrent. La composition se refait, elle ne se recadre pas.
 *
 * ET POURQUOI ICI. Les internes dont elle a besoin — `chronoPleinCadre`,
 * `surtitre`, `poserPied` — ne sont pas exportes. Les exporter pour qu'une
 * page de `suivi/` les rassemble a sa facon, c'est reconstruire la composition
 * dehors : la premiere retouche du fil ne suivrait pas, et c'est exactement la
 * divergence que l'en-tete de ce fichier interdit. Les deux compositions sont
 * donc cote a cote, et une retouche de l'une se voit en relisant l'autre.
 *
 * `d` porte les memes champs que `dessinerChrono` : { chrono_ms, ecart_ms,
 * epreuve } — ou `mention` a la place de `ecart_ms`.
 */
export function dessinerChronoStory(cv, d = {}) {
  const L = 1080, H = 1920;
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');

  const marge = 80;
  const cx = L / 2;

  // LA ZONE SURE. Instagram mange les 250 px du haut (barre de progression et
  // avatar) et les 250 px du bas (sticker et pouce). Toute la composition tient
  // donc entre 250 et 1670 — le rectangle central de 1080 x 1420.
  //
  // Le fond, lui, est trace sur la HAUTEUR ENTIERE : c'est ce qui remplit le
  // haut et le bas demandes, avec la nuit et la lueur plutot qu'avec du noir.
  const SUR_HAUT = 250, SUR_BAS = H - 250;
  poserFond(c, L, H);

  // L'epreuve, contre le haut de la zone sure et non contre le bord de l'image :
  // posee a 80 px comme au fil, elle passerait sous l'avatar.
  surtitre(c, EPREUVE(d.epreuve || 100), cx, SUR_HAUT, Math.round(L * 0.030), 800);

  // Le pied et la signature, remontes dans la zone sure.
  //
  // `poserPied` mesure depuis le bas du cadre qu'on lui donne : il tracerait
  // son filet a 1800 et son texte a 1846, tous deux sous la limite de 1670. On
  // ne touche pas au pied — meme filet, meme graisse, meme inter-lettrage — on
  // translate le contexte de la difference, comme le fait deja `dessinerChrono`
  // pour ses 14 px.
  const REMONTEE = H - SUR_BAS;              // 250
  const yPied = SUR_BAS - marge * 1.5;
  const yCompte = Math.round(yPied - L * 0.036);

  c.save();
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.font = `600 ${Math.round(L * 0.026)}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.letterSpacing = `${Math.round(L * 0.004)}px`;
  c.fillText('@sprintergame', cx, yCompte);
  c.restore();

  c.save();
  c.translate(0, -REMONTEE - 14);
  poserPied(c, L, H, marge);
  c.restore();

  // Le chrono, au centre optique de la zone sure.
  //
  // 45 % de la hauteur, et non 50 : le centre optique d'un cadre vertical est
  // au-dessus de son centre geometrique, et le centre de la zone sure (960)
  // tomberait a 6 px des premiers traits de piste, qui sont a 1190. A 864 le
  // chiffre reste sur la piste et non dedans — la meme regle qu'au fil.
  //
  // La largeur de mesure est celle du fil : `L - marge * 2`. Le chiffre fait
  // donc la MEME taille sur les deux images, ce qui est le propre d'une reprise
  // — la story montre la meme information une seconde fois, pas une plus grosse.
  const yChrono = Math.round(H * 0.45);
  const { basChiffre } = chronoPleinCadre(c, s2(d.chrono_ms), 's', cx, yChrono,
                                          L - marge * 2, '#F8CD4A');

  // La deuxieme ligne, a l'identique du fil : Space Mono pour un nombre, Outfit
  // pour une phrase. Voir `dessinerChrono` pour le pourquoi de ce partage.
  const tLigne2 = Math.round(L * (d.ecart_ms != null ? 0.086 : 0.090));
  const y2 = Math.round(basChiffre + L * 0.055 + tLigne2 / 2);
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.60)';
  c.textBaseline = 'middle';

  if (d.ecart_ms != null) {
    c.font = `700 ${tLigne2}px 'Space Mono', monospace`;
    const nombre = morceauxChrono(c, s2(d.ecart_ms));
    const wSigne = c.measureText('+').width, wUnite = c.measureText('s').width;
    const espace = tLigne2 * 0.34;
    let x = cx - (wSigne + espace + nombre.largeur + espace + wUnite) / 2;
    c.textAlign = 'left';
    c.fillText('+', x, y2);
    x += wSigne + espace;
    poserMorceaux(c, nombre, x, y2);
    x += nombre.largeur + espace;
    c.textAlign = 'left';
    c.fillText('s', x, y2);
  } else if (d.mention) {
    c.font = `700 ${tLigne2}px Outfit, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(d.mention), cx, y2);
  }
  c.restore();

  return cv;
}

/**
 * Le chrono de la semaine, format fil.
 *
 * `d` porte : { chrono_ms, ecart_ms, epreuve }.
 *
 * Un seul format, et il est ecrit en dur. Les autres compositions se plient aux
 * trois formats parce qu'elles sont faites de blocs empiles, qui se resserrent.
 * Celle-ci est faite d'un chiffre qui remplit la largeur : en 1600 x 900 il
 * ferait 700 px de haut sur une image qui en fait 900, et en 1080 x 1920 il
 * laisserait un vide de la hauteur d'une story. Un cadrage qui ne survit pas au
 * changement de format n'a rien a y gagner a faire semblant.
 */
export function dessinerChrono(cv, d = {}) {
  const L = 1080, H = 1350;
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');

  // 80 px sur les quatre bords. Les autres compositions calculent leur marge en
  // fraction de largeur (0.082, soit 89 px ici) ; celle-ci la recoit en clair,
  // parce que le chiffre est cale dessus au pixel et qu'une fraction rendrait
  // illisible ce qui est en jeu.
  const marge = 80;
  const cx = L / 2;

  poserFond(c, L, H);

  // L'epreuve, contre la marge haute. Elle ne participe pas au centrage : c'est
  // une etiquette, elle tient sa place quoi qu'il arrive. En 800 plutot qu'en
  // 700 — tres interlettree et a 46 % de blanc, le 700 se delave.
  //
  // 32 px et non les 22 px du surtitre des autres compositions : l'epreuve
  // passe AVANT la signature dans la hierarchie de lecture, et `@sprintergame`
  // fait 28 px. A 22 px, l'ordre demande etait inverse — invisible a l'oeil,
  // net des qu'on mesure les deux hauteurs d'oeil.
  surtitre(c, EPREUVE(d.epreuve || 100), cx, marge, Math.round(L * 0.030), 800);

  // Le compte du jeu. Une image de fil se retrouve en capture d'ecran dans une
  // conversation, sans le nom du compte au-dessus : sans cette ligne elle ne
  // dit pas ou retrouver le jeu.
  const yPied = H - marge * 1.5;
  const yCompte = Math.round(yPied - L * 0.036);
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.font = `600 ${Math.round(L * 0.026)}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.letterSpacing = `${Math.round(L * 0.004)}px`;
  c.fillText('@sprintergame', cx, yCompte);
  c.restore();

  // Le pied de la charte, remonte de 14 px.
  //
  // `poserPied` pose son texte a `marge * 0.92` du bas, c'est-a-dire qu'il
  // traite la marge comme une ligne de pied et laisse les jambages la
  // franchir. Sur les autres formats personne ne compte ; ici la marge de
  // 80 px est une demande explicite sur les QUATRE bords, et l'encre du pied
  // mordait de 13 px dedans. On ne touche pas au pied — meme filet, meme
  // graisse, meme inter-lettrage — on le decale.
  c.save();
  c.translate(0, -14);
  poserPied(c, L, H, marge);
  c.restore();

  // Le chrono, et sa place dans la hauteur.
  //
  // Il n'est pas centre dans l'image : il est pose AU-DESSUS des trois traits
  // de piste, qui commencent a 62 % de la hauteur. Centre, il tombait au milieu
  // d'eux et les traits se lisaient alors comme trois rayures egarees derriere
  // un chiffre ; pousse au-dessus, ils redeviennent ce qu'ils sont — le sol.
  // Le chiffre est sur la piste, pas dedans.
  //
  // La zone qu'il occupe va de `yChrono - 20 % de H` a `yChrono + 20 % de H`,
  // soit les deux cinquiemes de la hauteur demandes, et rien d'autre n'a le
  // droit d'y entrer.
  const yChrono = Math.round(H * 0.32);
  const { basChiffre } = chronoPleinCadre(c, s2(d.chrono_ms), 's', cx, yChrono,
                                          L - marge * 2, '#F8CD4A');

  // La deuxieme ligne, accrochee sous le chrono. Blanc a 60 % et non doré :
  // l'or dit « c'est le sujet », et il n'y a qu'un sujet par image.
  //
  // Deux natures possibles, et la charte les separe depuis le debut : un nombre
  // seul se compose en Space Mono, une ligne qui contient des mots se compose
  // en Outfit — c'est deja le partage entre `chiffre` et `ligne` plus haut.
  //
  //   `ecart_ms`  « + 0,05 s »  : l'ecart avec le suivant. Un nombre.
  //   `mention`   « 15e sur 98 » : ce que le chrono vaut. Une phrase courte.
  //
  // Les melanger dans la meme fonte ferait passer l'un pour l'autre, et ils ne
  // disent pas du tout la meme chose : le premier qualifie une tete, le second
  // situe un seuil. Une image qui annonce un seuil avec l'ecart d'une tete
  // annonce un record qui n'existe pas.
  const tLigne2 = Math.round(L * (d.ecart_ms != null ? 0.086 : 0.090));
  const y2 = Math.round(basChiffre + L * 0.055 + tLigne2 / 2);
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.60)';
  c.textBaseline = 'middle';

  if (d.ecart_ms != null) {
    // Compose en trois morceaux plutot qu'ecrit d'un trait : « + 0,05 s » en
    // chasse fixe donne aux deux espaces la largeur d'un chiffre, et la ligne
    // part en « +   0,05   s ». On leur rend un tiers de corps, ce qu'une
    // espace vaut vraiment.
    c.font = `700 ${tLigne2}px 'Space Mono', monospace`;
    const nombre = morceauxChrono(c, s2(d.ecart_ms));
    const wSigne = c.measureText('+').width, wUnite = c.measureText('s').width;
    const espace = tLigne2 * 0.34;
    let x = cx - (wSigne + espace + nombre.largeur + espace + wUnite) / 2;
    c.textAlign = 'left';
    c.fillText('+', x, y2);
    x += wSigne + espace;
    poserMorceaux(c, nombre, x, y2);
    x += nombre.largeur + espace;
    c.textAlign = 'left';
    c.fillText('s', x, y2);
  } else if (d.mention) {
    c.font = `700 ${tLigne2}px Outfit, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(d.mention), cx, y2);
  }
  c.restore();

  return cv;
}

/**
 * UNE CARTE D'ANNONCE : une regle, pas un chrono.
 *
 * Les compositions au-dessus portent un resultat — un chrono, un podium, un
 * classement — et le jeu les fabrique. Celle-ci porte ce qu'on ECRIT a la main
 * avant que la course existe : une date d'ouverture, un format de competition,
 * un nombre de places. Elle vit ici quand meme, et c'est tout l'objet de ce
 * fichier : une carte d'annonce publiee a cote d'une carte de chrono doit
 * sortir du meme compte. Elle avait ete ecrite en HTML/CSS dans
 * `tools/carte-annonce.mjs`, avec ses propres couleurs et sa propre typo, et
 * le fil montrait deux marques.
 *
 * `e` porte : { kicker, titre, sous, lignes: [{ gauche, droite }], fort, doux,
 * pied }. `pied` remplace « JEU DE SPRINT » dans la signature — « SPRINT GAME »
 * pour les cartes en anglais.
 * `gauche` est la valeur qu'on retient — elle se trace comme un chrono, en
 * Space Mono et en or ; `droite` est ce qu'elle designe. Un `\n` dans un texte
 * est un retour voulu, et il est garde. Le titre garde aussi sa casse : il
 * s'ecrit deja en capitales dans le fichier, et « 33e » ne doit pas sortir
 * « 33E ».
 *
 * Le `bouton` (« sprinter-game.com ») n'est pas lu. Le pied porte deja
 * @sprintergame, et c'est le compte, pas l'adresse, que les images du jeu
 * donnent — voir `dessinerCourse` : dans une story une adresse ne se clique
 * pas, un @ se cherche d'un geste.
 *
 * `rapport`, facultatif, recoit l'echelle a laquelle la carte a ete tracee
 * (1 quand elle tient telle quelle) et `deborde` si meme reduite elle ne tient
 * pas.
 *
 * `revele`, facultatif, sert a la video (`tools/carte-annonce.mjs --video`) :
 * pour chaque bloc — kicker, titre, sous, ligne0, ligne1…, fort, doux — ou il
 * en est de son entree, de 0 a 1, et dans `opacite` la sortie de toute la
 * carte. Chaque bloc apparait a sa place finale : la carte se construit sous
 * l'oeil, elle ne se recompose pas. Le fond et la signature ne bougent pas
 * d'une carte a l'autre — c'est le meme stade du debut a la fin du film.
 * Sans `revele`, tout est trace plein : c'est la carte fixe, au pixel pres.
 */
export function dessinerAnnonce(cv, e = {}, format = 'feed', rapport = {}, revele = null) {
  const L = 1080, H = format === 'story' ? 1920 : 1350;
  cv.width = L; cv.height = H;
  const c = cv.getContext('2d');
  const T = f => Math.round(L * f);
  const marge = 80, cx = L / 2, largeur = L - marge * 2;

  // La zone sure de la story, comme `dessinerChronoStory` : Instagram mange
  // 250 px en haut et 250 px en bas. Au fil, le cadre entier est disponible.
  const story = H > 1500;
  const SUR_HAUT = story ? 250 : marge;
  const SUR_BAS = story ? H - 250 : H;

  // L'entree d'un bloc : il monte de 32 px en se devoilant, et ralentit en
  // arrivant — un texte qui s'arrete net a l'air pose par erreur.
  const montrer = (cle, dessin) => y => {
    if (!revele) return dessin(y);
    const p = Math.max(0, Math.min(1, revele[cle] ?? 1));
    if (p <= 0) return;
    const q = 1 - Math.pow(1 - p, 3);
    c.save();
    c.globalAlpha = q * Math.max(0, Math.min(1, revele.opacite ?? 1));
    c.translate(0, (1 - q) * T(0.030));
    dessin(y);
    c.restore();
  };
  const avec = (cle, el) => ({ h: el.h, dessine: montrer(cle, el.dessine) });

  poserFond(c, L, H);
  if (e.kicker) montrer('kicker', y => surtitre(c, e.kicker, cx, y, T(0.026), 800))(SUR_HAUT);

  // Le compte et le pied, remontes dans la zone sure — meme geste que le chrono.
  const yPied = SUR_BAS - marge * 1.5;
  const yCompte = Math.round(yPied - L * 0.036);
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.font = `600 ${T(0.026)}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.letterSpacing = `${Math.round(L * 0.004)}px`;
  c.fillText('@sprintergame', cx, yCompte);
  c.restore();
  c.save(); c.translate(0, -(H - SUR_BAS) - 14); poserPied(c, L, H, marge, e.pied || undefined); c.restore();

  /* Un paragraphe centre, coupe aux mots. `ligne()` ne coupe pas — elle porte
     un nom de joueur ou un chrono, qui tiennent toujours. Une regle de
     competition, non : « c'est le classement des duels qui donne les 32
     places » deborde du cadre a la taille ou elle se lit. */
  const decouper = (texte, taille, gras) => {
    c.save();
    c.font = `${gras} ${taille}px Outfit, sans-serif`;
    const out = [];
    for (const para of String(texte).split('\n')) {
      let l = '';
      for (const m of para.split(' ')) {
        const essai = l ? l + ' ' + m : m;
        if (c.measureText(essai).width > largeur && l) { out.push(l); l = m; }
        else l = essai;
      }
      if (l) out.push(l);
    }
    c.restore();
    return out;
  };
  const paragraphe = (texte, taille, couleur, gras, apres = 0) => {
    const ls = decouper(texte, taille, gras);
    const inter = Math.round(taille * 1.36);
    return { h: ls.length * inter + apres,
             dessine: y => ls.forEach((t, i) => ligne(c, t, cx, y + i * inter, taille, couleur, gras)) };
  };

  /* Une valeur en Space Mono, composee comme le chrono. La virgule passe par
     `morceauxChrono` ; les espaces prennent un tiers de corps, comme dans le
     « + 0,05 s » de `dessinerChrono` — en chasse fixe, « 60 j » sortait
     « 60  j » ; et le point d'un « 1. » ou le point median de « 4 · 2 · 1 »
     prennent la fente etroite de la virgule, sans quoi le premier se
     detachait du chiffre et le second etalait le titre bord a bord. Mesure
     d'abord, trace ensuite : le titre-nombre a besoin de sa largeur avant de
     choisir sa taille. */
  const valeur = (texte, taille) => {
    c.save();
    c.font = `700 ${taille}px 'Space Mono', monospace`;
    const fente = c.measureText('0').width * 0.40;
    const blocs = String(texte).split(/( |\.|·)/).filter(Boolean).map(b =>
      b === ' ' ? { largeur: taille * 0.34 }
      : b === '.' || b === '·' ? { point: b, largeur: fente }
      : (m => ({ m, largeur: m.largeur }))(morceauxChrono(c, b)));
    c.restore();
    const total = blocs.reduce((n, b) => n + b.largeur, 0);
    return { largeur: total, poser: (x, y, couleur) => {
      c.save();
      c.fillStyle = couleur;
      c.font = `700 ${taille}px 'Space Mono', monospace`;
      c.textBaseline = 'middle';
      let cur = x - total / 2;
      for (const b of blocs) {
        if (b.m) poserMorceaux(c, b.m, cur, y);
        else if (b.point) { c.textAlign = 'center'; c.fillText(b.point, cur + b.largeur / 2, y); }
        cur += b.largeur;
      }
      c.restore();
    } };
  };

  const lignes = Array.isArray(e.lignes) ? e.lignes : [];

  // Un titre qui n'est qu'un nombre — « 33e », « 4 · 2 · 1 » — est le sujet
  // de la carte au meme titre que le chrono l'est de la sienne : il se trace
  // comme lui, en or et en Space Mono. C'est le partage que `dessinerChrono`
  // rappelle : un nombre seul en Space Mono, une ligne qui a des mots en
  // Outfit. Les valeurs de la liste passent alors a l'or a 80 %, comme les
  // ecarts sous le chrono de `dessinerCourse` : l'or plein reste au sujet.
  // Les ordinaux des deux langues : « 33e » et « 33rd ».
  const titreNombre = e.titre != null && /^[−+-]?\d[\d\s,.·:−-]*(e|er|re|st|nd|rd|th)?$/.test(String(e.titre).trim());
  const orListe = titreNombre ? 'rgba(248,205,74,0.80)' : '#F8CD4A';

  // Toutes les tailles en fraction de la largeur, multipliees par `k`.
  const composer = k => {
    const U = f => Math.round(L * f * k);
    const els = [];
    if (titreNombre) {
      // La taille du chiffre de `dessinerMoment`, ramenee a la mesure si le
      // nombre est long.
      let t = U(lignes.length ? 0.20 : 0.26);
      const w = valeur(String(e.titre).trim(), t).largeur;
      if (w > largeur) t = Math.floor(t * largeur / w);
      const v = valeur(String(e.titre).trim(), t);
      els.push({ h: Math.round(t * 1.2), dessine: montrer('titre', y => v.poser(cx, y + t * 0.6, '#F8CD4A')) });
    } else if (e.titre) {
      // Un ecran sans liste est une affiche : son titre prend la taille que la
      // place lui laisse.
      const tTitre = U(lignes.length ? 0.096 : 0.114);
      const inter = Math.round(tTitre * 1.06);
      els.push({ h: mesurerTitre(c, e.titre, largeur, tTitre, inter, false) + U(0.020),
                 dessine: montrer('titre', y => { c.fillStyle = '#FFFFFF';
                                                  titre(c, e.titre, cx, y, largeur, tTitre, inter, false); }) });
    }
    if (e.sous) els.push(avec('sous', paragraphe(e.sous, U(0.033), 'rgba(255,255,255,0.55)', 500, U(0.030))));
    lignes.forEach((l, i) => {
      const v = valeur(l.gauche, U(0.058));
      els.push({ h: U(0.076), dessine: montrer(`ligne${i}`, y => v.poser(cx, y + U(0.038), orListe)) });
      els.push(avec(`ligne${i}`, paragraphe(l.droite, U(0.029), 'rgba(255,255,255,0.55)', 500, U(0.032))));
    });
    if (e.fort) els.push(avec('fort', paragraphe(e.fort, U(0.036), '#FFFFFF', 700, U(0.012))));
    if (e.doux) els.push(avec('doux', paragraphe(e.doux, U(0.030), 'rgba(255,255,255,0.46)', 500)));
    return els;
  };

  // Le fil a 570 px de moins que la story pour le meme texte, et une carte qui
  // deborde ne se voit pas dans le code : `empiler` centre, donc le titre
  // passe sous le surtitre et le dernier paragraphe sous le compte. On reduit
  // le tout d'un meme facteur jusqu'a ce qu'il tienne — les rapports entre les
  // blocs, qui font la hierarchie, ne bougent pas.
  const haut = SUR_HAUT + T(0.11), bas = yCompte - T(0.07);
  const hauteur = els => els.reduce((n, x) => n + x.h, 0);
  let k = 1, els = composer(k);
  for (let pas = 1; pas <= 25 && hauteur(els) > bas - haut; pas++) {
    k = 1 - pas * 0.02;
    els = composer(k);
  }
  rapport.echelle = Math.round(k * 100) / 100;
  rapport.deborde = hauteur(els) > bas - haut;

  empiler(els, haut, bas);
  return cv;
}
