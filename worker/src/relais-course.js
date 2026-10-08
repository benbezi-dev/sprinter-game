/* ---------------------------------------------------------------------------
   LA COURSE D'UNE EQUIPE DE RELAIS
   ---------------------------------------------------------------------------
   Le temoin, les zones, les eliminations. Rien d'autre : ni WebSocket, ni base
   de donnees, ni horloge de rendez-vous.

   Ce module existe parce que deux salles ont besoin exactement des memes
   regles — celle d'une equipe seule, et celle d'une confrontation de deux a
   huit equipes. Les recopier serait se garantir qu'un jour l'une des deux
   eliminera pour une raison que l'autre accepte.

   Rien n'est diffuse d'ici. Chaque methode renvoie CE QUI S'EST PASSE, et la
   salle decide a qui le dire. C'est ce qui rend ces regles testables sans rien
   monter, et c'est la seule partie du relais ou une erreur ne se verrait pas :
   un passage accepte a tort ressemble a un passage.
--------------------------------------------------------------------------- */

export const TAILLE = 4;
export const ZONE = 30;                 // zone de lancement et de transmission

/**
 * LA PORTEE : jusqu'ou le temoin peut passer d'une main a l'autre.
 *
 * Elle manquait, et c'etait le defaut le plus visible du relais : la regle ne
 * verifiait que les ZONES — donneur dans la sienne, receveur dans la sienne —
 * si bien que deux coureurs separes de vingt-neuf metres se passaient le
 * temoin. A l'ecran il se teleportait ; sur une piste, il n'y a pas de
 * transmission sans contact.
 *
 * Deux metres et demi, c'est la geometrie du geste reel : le porteur tend le
 * bras en avant, le receveur tend le sien en arriere, et les deux corps
 * restent separes d'environ deux metres. En dessous, ils se marchent dessus.
 *
 * Manquer la portee n'ELIMINE PAS, et c'est delibere : sur une piste, une
 * main tendue dans le vide ne disqualifie personne, elle coute du temps. La
 * sanction existe deja et vient d'ailleurs — le receveur qui insiste sort de
 * sa zone sans le temoin, et la, l'equipe est eliminee.
 */
export const PORTEE = 2.5;
export const LEG = 100;                 // longueur d'une portion
export const ARRIVEE = TAILLE * LEG;    // la ligne, a 400 m
export const FENETRE_TOUCHE_MS = 600;   // au-dela, les deux touches ne vont plus ensemble

/**
 * LA VITESSE, JUGEE PAR LA SALLE ET NON PAR LE TELEPHONE.
 *
 * La salle croyait toute position annoncee : un telephone qui courait trois
 * fois trop vite — un moteur emballe, ou un client trafique — passait le
 * temoin huit secondes avant les autres et gagnait un defi avec un chrono
 * impossible. Rien ne le refusait, ni l'avance, ni l'arrivee.
 *
 * Le plafond vient du jeu : le coureur le plus rapide atteint 12,435 m/s,
 * fois 1,045 apres une passe parfaite et 1,042 apres une transition parfaite,
 * soit 13,5 m/s au mieux. On tolere 15 m/s — dix pour cent au-dessus de ce
 * que le moteur peut produire, assez pour qu'aucun coureur honnete n'y touche.
 *
 * LA RESERVE, ET NON UN ECART PAQUET PAR PAQUET. Chaque relayeur a une
 * reserve de metres qui se remplit a 15 m/s sur l'instant de course que son
 * telephone annonce (`c`, borne par l'horloge de la salle : on n'annonce pas
 * une position datee du futur), et que chaque avance consomme. Elle est
 * plafonnee a six metres : un relayeur qui se tait pendant qu'il attend a sa
 * marque n'accumule pas le droit de se teleporter ensuite. Une avance qui la
 * depasse est ecretee — la salle garde ce qui etait possible.
 *
 * Ecreter ne suffit pas a dire ce qui s'est passe : un telephone qui annonce
 * douze metres de plus que ce qu'il a pu courir ne court pas, il triche ou il
 * s'est emballe. L'equipe est alors eliminee, et elle le sait.
 */
export const VITESSE_MAX = 15;          // m/s
export const RESERVE_MAX = 6;           // m
export const AVANCE_IMPOSSIBLE = 12;    // m d'avance annoncee au-dela du possible
export const HORLOGE_TOLEREE_MS = 300;  // decalage admis entre le telephone et la salle
export const ARRIVEE_TOLEREE_MS = 1500; // retard admis entre la ligne et l'annonce

/** La zone du relayeur k (2..4), en metres absolus depuis le depart. */
export function zoneDe(relais) {
  const debut = (relais - 1) * LEG;
  return { debut, fin: debut + ZONE };
}

/**
 * La qualite d'un passage, de 0 a 2.
 *
 * Deux choses la font : la simultaneite des deux tapes, et l'endroit dans la
 * zone. Tot dans la zone, le receveur n'a pas encore de vitesse ; tard, il en
 * a, mais la marge de securite a fondu. Le meilleur passage se joue au milieu,
 * les deux mains ensemble.
 */
export function noterPasse(ecartMs, dansZone, bras = 0) {
  const bonEcart = ecartMs <= 120;
  const okEcart = ecartMs <= 300;
  // On vise le tiers median de la zone : ni colle a l'entree, ni au bord.
  const bonPlace = dansZone >= ZONE * 0.3 && dansZone <= ZONE * 0.8;
  // Et le temoin POSE DANS LA MAIN vaut mieux que le temoin attrape au bout
  // des doigts : sous la moitie de la portee, les deux coureurs sont cote a
  // cote et la vitesse se garde.
  const bonneMain = bras <= PORTEE * 0.5;
  if (bonEcart && bonPlace && bonneMain) return 2;
  if (okEcart) return 1;
  return 0;
}

/**
 * L'etat d'une equipe pendant sa course.
 *
 * `coureurs` est indexe par rang de relais (1..4) et non par joueur : la course
 * ne connait que des relayeurs. Qui les tient — un humain, un fantome
 * enregistre — ne la regarde pas.
 */
export class CourseEquipe {
  constructor(equipe, nom = '') {
    this.equipe = equipe;
    this.nom = nom;
    this.coureurs = new Map();   // relais -> { d, parti, fini }
    this.reinitialiser();
  }

  reinitialiser() {
    // La trace du temoin : c'est ELLE la course de l'equipe, pas les quatre
    // coureurs. Sans elle aucun fantome ne peut exister, et le mode fantome
    // n'avait jusqu'ici rien a rejouer.
    this.trace = [];
    this.porteur = 1;
    this.temoinD = 0;
    this.passes = [];
    this.touches = new Map();
    this.elimine = null;
    this.total = null;
    for (let r = 1; r <= TAILLE; r++) {
      this.coureurs.set(r, { d: (r - 1) * LEG, parti: false, fini: false,
                             reserve: 0, horloge: 0 });
    }
  }

  /** Le coureur d'un rang, cree au besoin. */
  coureur(relais) {
    if (!this.coureurs.has(relais)) {
      this.coureurs.set(relais, { d: (relais - 1) * LEG, parti: false, fini: false,
                                  reserve: 0, horloge: 0 });
    }
    return this.coureurs.get(relais);
  }

  finie() { return this.total != null || this.elimine != null; }

  /** Elimine l'equipe. Sans appel : la premiere raison est la bonne. */
  eliminer(raison, relais) {
    if (this.elimine) return null;
    this.elimine = { raison, relais: relais || null };
    return this.elimine;
  }

  /**
   * Le receveur place sa marque dans sa zone, avant le depart.
   * Bornee ici : un client ne se place pas ou il veut.
   */
  placer(relais, d) {
    if (relais <= 1) return false;
    const z = zoneDe(relais);
    const v = Number(d);
    if (!Number.isFinite(v)) return false;
    this.coureur(relais).d = Math.max(z.debut, Math.min(z.fin, v));
    return true;
  }

  /**
   * Une position annoncee. Renvoie { elimine } le cas echeant.
   *
   * Deux regles se jouent ici, et ce sont elles qui font qu'un relais n'est
   * pas quatre sprints : on ne quitte pas sa zone sans le temoin, et on ne
   * l'emporte pas au-dela.
   */
  avancer(relais, d, t = null, ch = null) {
    if (this.finie()) return {};
    const v = Number(d);
    if (!Number.isFinite(v) || v < 0 || v > 500) return {};
    const c = this.coureur(relais);
    // Sans instant de course (`t`), il n'y a pas de vitesse a juger : ce sont
    // les regles de geometrie seules, telles que les tests les posent. En
    // course, la salle le donne toujours.
    if (t != null && Number.isFinite(t)) {
      // Avant le coup de pistolet, personne n'avance.
      if (t < -HORLOGE_TOLEREE_MS) return {};
      const r = this.borner(c, v, t, ch);
      if (r.elimine) return r;
    } else if (v > c.d) c.d = v;
    c.parti = true;
    if (relais === this.porteur) {
      this.temoinD = c.d;
      // On note ou etait le temoin, et quand. Les positions arrivent dix fois
      // par seconde : c'est deja la finesse d'un fantome.
      if (t != null && Number.isFinite(t) && t >= 0) {
        this.trace.push([Math.round(t), Math.round(this.temoinD * 10)]);
      }
    }

    if (relais === this.porteur + 1) {
      const z = zoneDe(relais);
      if (c.d > z.fin) {
        return { elimine: this.eliminer('sortie de zone sans le temoin', relais) };
      }
    }
    if (this.porteur < TAILLE && relais === this.porteur) {
      const z = zoneDe(this.porteur + 1);
      if (c.d > z.fin) {
        return { elimine: this.eliminer('le temoin a depasse la zone', relais) };
      }
    }
    return { d: c.d };
  }

  /**
   * Une tape. Renvoie { passe } quand le temoin change de main, { elimine }
   * quand la geometrie l'interdit, et rien tant qu'il manque la seconde tape.
   *
   * `at` vient de l'horloge du serveur, jamais du client : c'est tout l'objet
   * de l'arbitrage. Deux telephones ne sont pas d'accord sur l'heure a cent
   * millisecondes pres, et cent millisecondes decident ici d'un passage.
   */
  taper(relais, at) {
    if (this.finie() || this.porteur >= TAILLE) return {};
    if (relais !== this.porteur && relais !== this.porteur + 1) return {};
    this.touches.set(relais, at);

    const donneur = this.porteur, receveur = this.porteur + 1;
    const tD = this.touches.get(donneur), tR = this.touches.get(receveur);
    if (!tD || !tR) return {};

    const ecart = Math.abs(tD - tR);
    if (ecart > FENETRE_TOUCHE_MS) {
      // Trop loin l'une de l'autre pour etre le meme geste : on oublie la plus
      // ancienne et on attend. Eliminer ici punirait un simple retard reseau.
      this.touches.delete(tD < tR ? donneur : receveur);
      return {};
    }

    const cD = this.coureur(donneur), cR = this.coureur(receveur);
    const z = zoneDe(receveur);
    if (cR.d < z.debut || cR.d > z.fin) {
      return { elimine: this.eliminer('temoin passe hors de la zone', receveur) };
    }
    if (cD.d < z.debut) {
      return { elimine: this.eliminer('temoin donne avant la zone', donneur) };
    }
    if (cD.d > z.fin) {
      return { elimine: this.eliminer('temoin passe hors de la zone', donneur) };
    }

    // LE CONTACT. Les deux sont dans la zone, mais le sont-ils l'un pres de
    // l'autre ? Sans cette ligne, le temoin saute par-dessus vingt metres de
    // piste — la faute qui faisait du relais quatre courses cote a cote au
    // lieu d'une course a quatre.
    const bras = Math.abs(cD.d - cR.d);
    if (bras > PORTEE) {
      // On oublie les deux tapes : elles etaient sinceres mais hors de
      // portee, et il faut retendre la main ensemble. Pas d'elimination —
      // c'est la zone qui punit celui qui insiste trop longtemps.
      this.touches.clear();
      return { tropLoin: { de: donneur, vers: receveur,
                           bras: Math.round(bras * 10) / 10, portee: PORTEE } };
    }

    this.porteur = receveur;
    this.temoinD = cR.d;
    this.touches.clear();
    const dansZone = Math.round((cR.d - z.debut) * 10) / 10;
    const p = {
      relais: receveur, de: donneur, vers: receveur,
      a: Math.round(cR.d * 10) / 10,
      dans_zone: dansZone, ecart,
      // La distance entre les deux corps au moment du contact : c'est elle
      // qu'on montre a l'arrivee, et elle qui separe une transmission propre
      // d'un temoin rattrape de justesse.
      bras: Math.round(bras * 10) / 10,
      note: noterPasse(ecart, dansZone, bras),
    };
    this.passes.push(p);
    return { passe: p };
  }

  /**
   * Rejouer une course enregistree, a l'instant t.
   *
   * Un fantome n'obeit a aucune regle : il a deja couru, et sa course est un
   * fait. On ne lui applique donc ni zone, ni elimination — les lui appliquer
   * reviendrait a rejuger une course deja jugee, avec le risque d'eliminer
   * retrospectivement une equipe qui figure au classement.
   *
   * Le porteur se deduit de la position du temoin : c'est faux de quelques
   * metres dans la zone de transmission, et cela n'a aucune importance — il ne
   * sert qu'a dire quel relayeur dessiner en train de courir.
   */
  rejouer(t, trace, totalMs, pas = 100) {
    if (this.total != null) return {};
    const i = Math.floor(t / pas);
    if (i >= trace.length) {
      this.temoinD = 400;
      this.total = totalMs;
      this.coureur(TAILLE).fini = true;
      return { total: totalMs };
    }
    this.temoinD = (trace[Math.max(0, i)] || 0) / 10;
    this.porteur = Math.max(1, Math.min(TAILLE, Math.floor(this.temoinD / LEG) + 1));
    this.coureur(this.porteur).d = this.temoinD;
    return { d: this.temoinD };
  }

  /**
   * L'avance d'un relayeur, bornee par ce qu'il a pu courir.
   *
   * `ch` est l'instant de course que le telephone annonce pour cette
   * position ; a defaut — un client plus ancien que ce champ — c'est l'instant
   * ou la salle la recoit. Dans ce cas on ecrete sans eliminer : les paquets
   * retenus par le reseau arrivent groupes, et la salle verrait courir trop
   * vite un coureur qui n'y est pour rien.
   */
  borner(c, v, t, ch) {
    const annonce = Number(ch);
    const date = ch != null && Number.isFinite(annonce);
    const instant = date ? Math.min(annonce, t + HORLOGE_TOLEREE_MS) : t;
    if (instant > c.horloge) {
      c.reserve = Math.min(RESERVE_MAX,
                           c.reserve + VITESSE_MAX * (instant - c.horloge) / 1000);
      c.horloge = instant;
    }
    const gain = v - c.d;
    if (gain <= 0) return {};
    if (gain <= c.reserve) {
      c.d = v; c.reserve -= gain;
      return {};
    }
    c.d += c.reserve; c.reserve = 0;
    const exces = v - c.d;
    if (date && exces > AVANCE_IMPOSSIBLE) {
      return { elimine: this.eliminer('vitesse impossible', this.rangDe(c)) };
    }
    return {};
  }

  rangDe(c) {
    for (const [r, x] of this.coureurs) if (x === c) return r;
    return null;
  }

  /**
   * Le dernier relayeur franchit la ligne.
   *
   * Il faut qu'il porte le temoin, et qu'il ait pu atteindre la ligne : la
   * salle le sait par sa derniere position et ce qu'il a pu courir depuis.
   * Sans quoi un quatrieme relayeur pouvait annoncer son arrivee pendant que
   * le premier etait encore dans les blocs.
   *
   * Le chrono annonce est celui du telephone, sur l'horloge de la salle — il
   * garde ainsi sa precision au millieme. Il ne peut pas etre en avance sur
   * elle de plus que le trajet d'un message : au-dela, c'est l'horloge de la
   * salle qui fait foi.
   */
  terminer(relais, ms, t = null) {
    if (this.finie() || relais !== TAILLE) return {};
    const v = Math.round(Number(ms));
    if (!Number.isFinite(v) || v < 10000 || v > 600000) return {};
    if (this.porteur !== TAILLE) return {};
    const c = this.coureur(TAILLE);
    let total = v;
    if (t != null && Number.isFinite(t)) {
      const atteignable = c.d + Math.min(RESERVE_MAX,
        c.reserve + VITESSE_MAX * Math.max(0, t - c.horloge) / 1000);
      if (atteignable < ARRIVEE - 1) {
        return { elimine: this.eliminer('arrivee impossible', TAILLE) };
      }
      total = Math.min(Math.max(v, Math.round(t) - ARRIVEE_TOLEREE_MS),
                       Math.round(t) + HORLOGE_TOLEREE_MS);
    } else if (c.d < ARRIVEE - 1) {
      return {};
    }
    c.fini = true;
    this.total = total;
    return { total };
  }

  /**
   * La trace ramenee sur une grille reguliere, en decimetres.
   *
   * Les positions arrivent quand elles arrivent — un fantome, lui, doit
   * pouvoir etre lu a n'importe quel instant sans chercher dans une liste
   * irreguliere. On interpole donc une fois, a l'ecriture, plutot qu'a chaque
   * image de chaque rejeu.
   */
  traceReguliere(pas = 100) {
    if (!this.trace.length || this.total == null) return [];
    const out = [];
    let i = 0;
    for (let t = 0; t <= this.total; t += pas) {
      while (i + 1 < this.trace.length && this.trace[i + 1][0] <= t) i++;
      const [t0, d0] = this.trace[i];
      const suiv = this.trace[i + 1];
      if (!suiv || suiv[0] <= t0) { out.push(d0); continue; }
      const f = Math.max(0, Math.min(1, (t - t0) / (suiv[0] - t0)));
      out.push(Math.round(d0 + (suiv[1] - d0) * f));
    }
    return out;
  }

  vue() {
    return {
      equipe: this.equipe, nom: this.nom,
      porteur: this.porteur,
      temoin_d: Math.round(this.temoinD * 10) / 10,
      passes: this.passes,
      elimine: this.elimine,
      total: this.total,
      coureurs: [...this.coureurs.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([relais, c]) => ({ relais, d: Math.round(c.d * 10) / 10, fini: c.fini })),
    };
  }
}
