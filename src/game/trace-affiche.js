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
export const EPREUVE = r => String(r || '').replace(/^(\d+)$/, '$1 m');

/* --------------------------------------------------------------- le dessin */

/** Le fond commun : la nuit du jeu, sa lueur doree, et trois couloirs. */
function poserFond(c, L, H) {
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

/** La signature, en bas. Discrete : le compte se nomme deja au-dessus. */
function poserPied(c, L, H, marge) {
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
  c.fillText('JEU DE SPRINT', L - marge, H - marge * 0.92);
  c.restore();
}

/** Un titre sur plusieurs lignes, coupe aux mots. */
function titre(c, texte, x, y, largeurMax, taille, interligne) {
  // save/restore, comme les trois autres fonctions de trace. Sans lui, le
  // `letterSpacing` negatif du titre restait pose sur le contexte et le chrono
  // suivant sortait « 8 . 2 5 » : un reglage qui fuit ne se voit pas dans le
  // code qui le subit.
  c.save();
  c.font = `900 ${taille}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.letterSpacing = `${-taille * 0.022}px`;
  const mots = String(texte).toUpperCase().split(' ');
  const lignes = []; let ligne = '';
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m;
    if (c.measureText(essai).width > largeurMax && ligne) { lignes.push(ligne); ligne = m; }
    else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  lignes.forEach((l, i) => c.fillText(l, x, y + i * interligne));
  c.restore();
  return y + lignes.length * interligne;
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

  const str = String(texte);
  const i = str.indexOf(',');

  // Sans virgule — un cap, un decompte — rien a composer : la chasse fixe fait
  // exactement ce qu'on lui demande, aligner des colonnes de chiffres.
  if (i < 0) {
    c.textAlign = 'center';
    c.fillText(str, x, y);
    c.restore();
    return;
  }

  // Avec virgule, elle occupe une chasse entiere, comme un chiffre. A 216 px
  // cela creuse un trou au milieu du chrono — « 8 , 25 » — et c'est le chiffre
  // qui est le sujet de l'image. Le resserrement global ne repare pas cela : il
  // rapproche aussi les chiffres entre eux, qui n'ont rien demande.
  //
  // On compose donc en trois morceaux et on ne reprend de la place qu'autour du
  // separateur. Les chiffres gardent leur chasse, la virgule perd la sienne.
  const entier = str.slice(0, i), virgule = ',', deci = str.slice(i + 1);
  const chasse = c.measureText('0').width;
  const wEntier = c.measureText(entier).width;
  const wDeci = c.measureText(deci).width;
  // Deux cinquiemes de chasse : assez pour que la virgule respire sous le
  // chiffre precedent, assez peu pour que l'oeil lise un seul nombre.
  const wVirg = chasse * 0.40;

  const total = wEntier + wVirg + wDeci;
  let cur = x - total / 2;
  c.textAlign = 'left';
  c.fillText(entier, cur, y);
  cur += wEntier;
  // La virgule est centree dans sa fente etroite, sinon elle colle au chiffre
  // de gauche et l'on a deplace le trou au lieu de le boucher.
  c.textAlign = 'center';
  c.fillText(virgule, cur + wVirg / 2, y);
  cur += wVirg;
  c.textAlign = 'left';
  c.fillText(deci, cur, y);
  c.restore();
}

/** Le surtitre : petites capitales tres espacees, comme dans le jeu. */
function surtitre(c, texte, x, y, taille) {
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.46)';
  c.font = `700 ${taille}px Outfit, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.letterSpacing = `${taille * 0.36}px`;
  c.fillText(String(texte).toUpperCase(), x + taille * 0.18, y);
  c.restore();
}

/**
 * Le texte, coupe pour tenir dans la largeur donnee.
 *
 * La colonne du mouchoir portait des noms masques — huit signes au plus — et
 * rien ne pouvait donc y deborder. Depuis que ces noms peuvent sortir en
 * clair, un pseudonyme de vingt signes vient buter dans le chrono, et deux
 * textes qui se chevauchent sur une image publiee ne se rattrapent pas apres
 * coup. On coupe donc, avec les points de suspension qui disent que c'etait
 * plus long — un nom tronque sans eux se lit comme un nom court, et faux.
 *
 * La police doit etre posee sur le contexte avant l'appel : c'est elle qui
 * decide de la largeur.
 */
function couper(c, texte, largeurMax) {
  const t = String(texte || '');
  if (largeurMax <= 0 || c.measureText(t).width <= largeurMax) return t;
  let court = t;
  while (court.length > 1 && c.measureText(court + '…').width > largeurMax) {
    court = court.slice(0, -1);
  }
  return court + '…';
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
function mesurerTitre(c, texte, largeurMax, taille, interligne) {
  c.save();
  c.font = `900 ${taille}px Outfit, sans-serif`;
  c.letterSpacing = `${-taille * 0.022}px`;
  const mots = String(texte).toUpperCase().split(' ');
  let n = 1, ligne = '';
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m;
    if (c.measureText(essai).width > largeurMax && ligne) { n++; ligne = m; }
    else ligne = essai;
  }
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
        // Le chrono d'abord, parce que c'est lui qui fixe la place qui reste :
        // il est le sujet de l'image et ne se coupe jamais. Le nom prend ce
        // qui est libre, moins un blanc franc — deux textes qui se frolent se
        // lisent comme un seul.
        c.font = `700 ${Math.round(pas * 0.46)}px 'Space Mono', monospace`;
        const largeurChrono = c.measureText(s2(ms)).width;
        c.textAlign = 'right';
        c.fillText(s2(ms), gaucheCol + colonne, ly);
        c.font = `${i === 0 ? 700 : 500} ${Math.round(pas * 0.44)}px Outfit, sans-serif`;
        c.textAlign = 'left';
        const place = colonne - largeurChrono - pas * 0.55;
        c.fillText(couper(c, `${i + 1}. ${(d.noms || [])[i] || ''}`, place), gaucheCol, ly);
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
  if (d.race) return `Sprinter · ${EPREUVE(d.race)}`;
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
 * `course` porte : { chronoMs, epreuves, nom, fantomeNom, fantomeMs, rang }.
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
  if (l.length === 1) return `Sprinter · ${EPREUVE(l[0])}`;
  return `Sprinter · ${l.join(' + ')} m`;
}
