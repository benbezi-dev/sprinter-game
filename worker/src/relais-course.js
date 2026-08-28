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
export const LEG = 100;                 // longueur d'une portion
export const FENETRE_TOUCHE_MS = 600;   // au-dela, les deux touches ne vont plus ensemble

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
export function noterPasse(ecartMs, dansZone) {
  const bonEcart = ecartMs <= 120;
  const okEcart = ecartMs <= 300;
  // On vise le tiers median de la zone : ni colle a l'entree, ni au bord.
  const bonPlace = dansZone >= ZONE * 0.3 && dansZone <= ZONE * 0.8;
  if (bonEcart && bonPlace) return 2;
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
    this.porteur = 1;
    this.temoinD = 0;
    this.passes = [];
    this.touches = new Map();
    this.elimine = null;
    this.total = null;
    for (let r = 1; r <= TAILLE; r++) {
      this.coureurs.set(r, { d: (r - 1) * LEG, parti: false, fini: false });
    }
  }

  /** Le coureur d'un rang, cree au besoin. */
  coureur(relais) {
    if (!this.coureurs.has(relais)) {
      this.coureurs.set(relais, { d: (relais - 1) * LEG, parti: false, fini: false });
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
  avancer(relais, d) {
    if (this.finie()) return {};
    const v = Number(d);
    if (!Number.isFinite(v) || v < 0 || v > 500) return {};
    const c = this.coureur(relais);
    if (v > c.d) c.d = v;
    c.parti = true;
    if (relais === this.porteur) this.temoinD = c.d;

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

    this.porteur = receveur;
    this.temoinD = cR.d;
    this.touches.clear();
    const dansZone = Math.round((cR.d - z.debut) * 10) / 10;
    const p = {
      relais: receveur, de: donneur, vers: receveur,
      a: Math.round(cR.d * 10) / 10,
      dans_zone: dansZone, ecart,
      note: noterPasse(ecart, dansZone),
    };
    this.passes.push(p);
    return { passe: p };
  }

  /** Le dernier relayeur franchit la ligne. */
  terminer(relais, ms) {
    if (this.finie() || relais !== TAILLE) return {};
    const v = Math.round(Number(ms));
    if (!Number.isFinite(v) || v < 10000 || v > 600000) return {};
    this.coureur(TAILLE).fini = true;
    this.total = v;
    return { total: v };
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
