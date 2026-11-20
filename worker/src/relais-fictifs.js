/* ---------------------------------------------------------------------------
   LES RELAYEURS FICTIFS
   ---------------------------------------------------------------------------
   Une equipe de relais n'a pas toujours quatre joueurs sous la main. Les
   places vides sont tenues par des relayeurs fictifs, et ce module les fait
   courir : seul avec trois fictifs (la salle solo, sur le telephone), a deux
   avec deux, ou a trois avec un (le salon de relais, sur le serveur).

   UN SEUL PILOTE POUR LES DEUX COTES. Le telephone et la salle en ligne
   importent ce meme fichier : un fictif qui court bien en solo court pareil
   en ligne, et une correction vaut pour les deux.

   Les regles, elles, restent celles de relais-course.js : ce module ne fait
   qu'annoncer des positions et des tapes a la CourseEquipe, comme le ferait
   un telephone. Il ne juge rien.
--------------------------------------------------------------------------- */

import { zoneDe, TAILLE, LEG, ARRIVEE, PORTEE } from './relais-course.js';

/**
 * LA COURSE D'ELAN (l'auteur, 15/11/2026 : « toujours pas de course d'elan des receveurs, ils ne
 * bougent pas avant la reception du temoin »). Le receveur s'elance quand le porteur arrive a cette
 * distance (m), d'une marque a deux metres de l'entree de sa zone.
 *
 * A 8 m d'une marque a 5 m, le porteur lance a onze metres par seconde rattrapait le receveur en
 * une seconde : il n'avait couru que 5,6 m (mediane, mesuree sur 420 passages), il semblait
 * attendre le temoin sur place. A 10,5 m d'une marque a 2 m, il court 19 m avant le contact
 * (10 a 24), et le temoin passe au milieu de la zone — la ou noterPasse donne le meilleur passage
 * —, sans que le chrono des equipes change (mediane 38,8 s). Au-dela de 11 m il part trop tot,
 * arrive au bout de sa zone et y attend : le chrono se degrade.
 */
export const ELAN = 10.5;
/** Ou un receveur fictif attend, en metres dans sa zone. */
export const MARQUE_FICTIF = 2;
/** Un pas de simulation, au plus (ms). */
export const PAS_MS = 50;
/** Au-dela, la course s'arrete : plus rien ne bouge (jeu en pause, porteur arrete). */
export const DUREE_MAX_MS = 120000;

const TAU = 1.0;            // s, constante d'acceleration
const REACTION_S = 0.16;    // reaction du premier dans les blocs
const CONTACT = 1.0;        // m : deux fictifs se passent le temoin a cette distance

/** Des prenoms courts, lisibles au-dessus d'un coureur. */
const NOMS = [
  'KOFFI', 'NAËL', 'IBRA', 'TEDDY', 'SOLAL', 'MAMADOU', 'YANIS', 'ENZO',
  'AMADOU', 'LÉO', 'MOUSSA', 'NOAH', 'ISSA', 'RAYAN', 'MALIK', 'HUGO',
];

/** `n` prenoms tires au sort, sans ceux des joueurs presents. */
export function tirerNoms(n, eviter = []) {
  const pris = new Set(eviter.map(x => String(x || '').toUpperCase()));
  const pool = NOMS.filter(x => !pris.has(x));
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export class Fictifs {
  /**
   * @param course   la CourseEquipe de l'equipe
   * @param rangs    les rangs tenus par des fictifs (1 a 4)
   * @param noms     leurs noms, dans l'ordre des rangs
   */
  constructor(course, rangs, noms = []) {
    this.course = course;
    this.liste = [...new Set(rangs)].filter(r => r >= 1 && r <= TAILLE).sort((a, b) => a - b)
      .map((r, i) => ({
        id: 'fictif-' + r, nom: noms[i] || 'RELAIS ' + r, relais: r,
        // Un peu d'ecart entre eux, pour qu'ils ne courent pas comme des clones.
        vmax: 10.6 + Math.random() * 0.6,
        v: 0, parti: false, libere: false,
      }));
    /** La vitesse des humains, par rang, tiree de leurs positions. */
    this.humains = new Map();
    /** La derniere position annoncee de chaque fictif : on ne repete pas l'immobile. */
    this.annonce = new Map();
    this.dernierPas = 0;
  }

  estFictif(r) { return this.liste.some(f => f.relais === r); }

  /**
   * UN FICTIF REPREND LA PLACE D'UN JOUEUR PARTI EN COURSE (salon). Il garde son
   * identifiant, pour que les ecrans continuent de faire avancer le meme
   * coureur, et repart d'ou il etait, a sa vitesse : le porteur garde son
   * elan, un receveur attend a sa marque.
   */
  prendreLaPlace(r, { id, nom, v = 0 } = {}) {
    if (this.estFictif(r)) return;
    const c = this.course;
    this.liste.push({
      id: id || 'fictif-' + r, nom: nom || 'RELAIS ' + r, relais: r,
      vmax: 10.6 + Math.random() * 0.6,
      v: Math.max(0, Number(v) || 0),
      parti: r === c.porteur || (r === 1 && c.temoinD > 0),
      libere: r < c.porteur,
    });
    this.liste.sort((a, b) => a.relais - b.relais);
    this.humains.delete(r);
  }

  /** Avant le pistolet : chacun a sa marque, tout le monde a l'arret. */
  reinitialiser(maintenant = 0) {
    for (const f of this.liste) {
      f.v = 0; f.parti = false; f.libere = false;
      if (f.relais > 1) this.course.placer(f.relais, zoneDe(f.relais).debut + MARQUE_FICTIF);
    }
    this.humains.clear();
    this.annonce.clear();
    this.dernierPas = maintenant;
  }

  /** Ou chaque fictif receveur partira, pour la dessiner sur la piste. */
  marquesElan() {
    return this.liste.filter(f => f.relais > 1)
      .map(f => ({ relais: f.relais, d: zoneDe(f.relais).debut + MARQUE_FICTIF - ELAN }));
  }

  /**
   * Un humain a annonce sa position : on en tire sa vitesse, pour que les
   * fictifs reglent leur allure sur la sienne aux transmissions. Lissee : les
   * positions arrivent par paquets.
   */
  noterHumain(r, d, t) {
    if (!Number.isFinite(d) || !Number.isFinite(t)) return;
    const h = this.humains.get(r) || { d, t, v: 0 };
    if (t > h.t && d >= h.d) {
      const inst = (d - h.d) / ((t - h.t) / 1000);
      if (Number.isFinite(inst)) h.v = h.v * 0.6 + inst * 0.4;
      h.d = d; h.t = t;
    }
    this.humains.set(r, h);
  }

  vitesseDe(r) {
    const f = this.liste.find(x => x.relais === r);
    if (f) return f.v;
    return this.humains.get(r)?.v ?? 0;
  }

  /**
   * Ou un porteur fictif se tient pour tendre le temoin a un receveur humain :
   * derriere lui, a portee de main, et toujours DANS la zone de transmission —
   * jamais avant son entree, ou la tape du joueur eliminerait l'equipe pour
   * une faute qu'il n'a pas commise.
   */
  pointDuPorteur(p) {
    const dR = this.course.coureur(p + 1).d;
    return Math.max(dR - CONTACT - 0.2, zoneDe(p + 1).debut + 0.3);
  }

  /** La vitesse visee par un fictif a cet instant. */
  cible(f, d, t) {
    const c = this.course;
    const p = c.porteur;
    if (f.libere) return 0;
    if (f.relais === 1 && t < REACTION_S * 1000) return 0;

    // RECEVEUR : il s'elance quand le porteur arrive, puis regle son allure
    // pour que le contact se fasse dans la zone.
    if (f.relais === p + 1) {
      const ecart = d - c.coureur(p).d;
      if (!f.parti) {
        if (ecart > ELAN) return 0;
        f.parti = true;
      }
      const z = zoneDe(f.relais);
      const vPorteur = this.vitesseDe(p) || f.vmax;
      let v = f.vmax;
      // Tout pres : il se laisse rejoindre, il ne s'enfuit pas.
      if (ecart <= 3) v = Math.min(v, Math.max(0, vPorteur + (ecart - CONTACT) * 1.5));
      // Au bout de la zone, il ralentit puis attend.
      if (d > z.fin - 4) v = Math.min(v, vPorteur * 0.7);
      if (d > z.fin - 1.5) v = 0;
      return v;
    }

    // PORTEUR : a pleine allure, sauf a l'approche d'un receveur humain, sur
    // qui il se cale pour lui tendre le temoin.
    if (f.relais === p) {
      f.parti = true;
      if (p < TAILLE && !this.estFictif(p + 1)) {
        const reste = this.pointDuPorteur(p) - d;
        if (reste < 15) return Math.min(f.vmax + 1.5, Math.max(0, this.vitesseDe(p + 1) + reste * 2));
      }
      return f.vmax;
    }
    return 0;
  }

  /**
   * Un tour de minuteur, decoupe en petits pas.
   *
   * Le minuteur ne tombe pas toujours toutes les 50 ms : on rattrape tout le
   * temps ecoule (jusqu'a deux secondes), par pas de 50 ms au plus — sinon les
   * fictifs perdaient ce temps pendant que l'horloge de l'equipe continuait.
   *
   * `ev` recoit ce qui s'est passe : pos(relais, d, t), passe(p),
   * elimine(el), fini(total). Renvoie faux quand la course est close.
   */
  pas(maintenant, departA, ev) {
    const c = this.course;
    if (!departA || c.finie()) return false;
    const ecoule = Math.min(2, Math.max(0, (maintenant - this.dernierPas) / 1000));
    this.dernierPas = maintenant;
    const t = maintenant - departA;
    if (t < 0) return true;
    if (t > DUREE_MAX_MS) {
      const el = c.eliminer('temps depasse', c.porteur);
      if (el) ev.elimine?.(el);
      return false;
    }
    const n = Math.max(1, Math.ceil(ecoule / (PAS_MS / 1000)));
    const dt = ecoule / n;
    for (let k = n - 1; k >= 0; k--) {
      const tk = Math.max(0, t - k * dt * 1000);
      if (!this.petitPas(dt, tk, maintenant - k * dt * 1000, ev)) return false;
    }
    // Une position par fictif et par tour, et seulement quand il a bouge (plus
    // une par seconde pour qui attend) : un fictif arrete n'a rien a redire, et
    // chaque message part vers chaque telephone du salon.
    for (const f of this.liste) {
      const d = c.coureur(f.relais).d;
      const a = this.annonce.get(f.relais);
      if (a && Math.abs(a.d - d) < 0.01 && maintenant - a.at < 1000) continue;
      this.annonce.set(f.relais, { d, at: maintenant });
      ev.pos?.(f.relais, d, t);
    }
    return true;
  }

  petitPas(dt, t, horloge, ev) {
    const c = this.course;
    for (const f of this.liste) {
      const cour = c.coureur(f.relais);
      const vise = this.cible(f, cour.d, t);
      // Le freinage est plus doux que l'acceleration n'est vive.
      const tau = vise < f.v ? TAU * 1.5 : TAU;
      f.v += (vise - f.v) * (1 - Math.exp(-dt / tau));
      if (f.v < 0.05 && vise === 0) f.v = 0;
      if (f.v <= 0) continue;
      const fin = f.relais < TAILLE ? f.relais * LEG + 30 : ARRIVEE + 5;
      const avant = cour.d;
      let d = Math.min(fin, cour.d + f.v * dt);
      // UN RECEVEUR FICTIF NE SORT JAMAIS DE SA ZONE : il freine sur la
      // distance qui lui reste et attend au bout que le porteur le rejoigne.
      if (f.relais === c.porteur + 1) {
        const bord = zoneDe(f.relais).fin - 0.5;
        f.v = Math.min(f.v, Math.max(0, bord - cour.d) / 0.8);
        d = Math.min(d, bord);
      }
      // UN PORTEUR FICTIF NE VA PAS AU BOUT DE SA ZONE avec le temoin, et ne
      // double pas un receveur humain : il reste derriere lui, a portee de
      // main, jamais avant l'entree de la zone.
      if (f.relais === c.porteur && c.porteur < TAILLE) {
        d = Math.min(d, Math.max(avant, zoneDe(c.porteur + 1).fin - 0.5));
        if (!this.estFictif(c.porteur + 1)) {
          const derriere = Math.max(c.coureur(c.porteur + 1).d - 0.8, zoneDe(c.porteur + 1).debut + 0.3);
          if (d > derriere) {
            d = Math.max(avant, derriere);
            f.v = Math.min(f.v, Math.max(0, this.vitesseDe(c.porteur + 1)));
          }
        }
      }
      // Sans instant annonce : la salle ecrete sans eliminer.
      const r = c.avancer(f.relais, d, t);
      if (r.elimine) { ev.elimine?.(r.elimine); return false; }

      if (f.relais === TAILLE && c.porteur === TAILLE && c.coureur(TAILLE).d >= ARRIVEE) {
        // L'instant exact ou il a franchi la ligne, et non celui du pas.
        const parcouru = Math.max(1e-6, c.coureur(TAILLE).d - avant);
        const deborde = c.coureur(TAILLE).d - ARRIVEE;
        const tFin = Math.round(t - (deborde / parcouru) * dt * 1000);
        const fin4 = c.terminer(TAILLE, tFin, t);
        if (fin4.elimine) { ev.elimine?.(fin4.elimine); return false; }
        if (fin4.total != null) { ev.fini?.(fin4.total); return false; }
      }
    }

    // Deux fictifs au contact se passent le temoin d'eux-memes.
    const p = c.porteur;
    if (p < TAILLE && this.estFictif(p) && this.estFictif(p + 1)) {
      const a = c.coureur(p).d, b = c.coureur(p + 1).d;
      const z = zoneDe(p + 1);
      if (Math.abs(a - b) <= CONTACT && a >= z.debut && b >= z.debut) {
        c.taper(p, horloge);
        const r = c.taper(p + 1, horloge + 20 + Math.random() * 60);
        if (r.passe) { this.liberer(r.passe.de); ev.passe?.(r.passe); }
        if (r.elimine) { ev.elimine?.(r.elimine); return false; }
      }
    }
    return true;
  }

  /** Le donneur a passe le temoin : il ralentit et s'arrete. */
  liberer(r) {
    const f = this.liste.find(x => x.relais === r);
    if (f) f.libere = true;
  }

  /**
   * La tape d'un humain dont le partenaire est un fictif.
   *
   * Le fictif tend la main avec lui, a quelques centiemes pres, s'il est a
   * portee. C'est la course qui juge : une tape hors zone elimine, comme
   * entre deux humains. Renvoie le verdict de la course, `{ tropLoin }` hors
   * de portee, ou null quand le partenaire n'est pas un fictif (la salle
   * attend alors l'autre humain, comme d'habitude).
   */
  tapeHumaine(rang, maintenant) {
    const c = this.course;
    if (c.finie()) return {};
    const p = c.porteur;
    const partenaire = rang === p && p < TAILLE ? p + 1 : (rang === p + 1 ? p : 0);
    if (!partenaire || !this.estFictif(partenaire)) return null;
    const bras = Math.abs(c.coureur(rang).d - c.coureur(partenaire).d);
    if (bras > PORTEE) {
      return { tropLoin: { de: p, vers: p + 1, bras: Math.round(bras * 10) / 10, portee: PORTEE } };
    }
    c.taper(rang, maintenant);
    const r = c.taper(partenaire, maintenant + 30 + Math.random() * 90);
    if (r.passe) this.liberer(r.passe.de);
    return r;
  }
}
