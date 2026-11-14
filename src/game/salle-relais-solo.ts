// Le relais en solo : un joueur, trois relayeurs fictifs.
//
// Le relais demande quatre joueurs connectes en meme temps, et c'est ce qui le
// rendait injouable la plupart du temps : on montait une equipe, puis on
// attendait. Ici le joueur choisit sa place, et les trois autres portions sont
// courues par le jeu.
//
// LES REGLES SONT CELLES DU SERVEUR, PAS UNE COPIE. On importe `CourseEquipe`
// de worker/src/relais-course.js : zones, portee, eliminations, note des
// passages. Une regle recopiee finirait par eliminer ici ce que la vraie salle
// accepte, ou l'inverse.
//
// La salle est locale : pas de WebSocket, pas d'horloge distante, rien
// d'enregistre au classement des equipes. Elle expose la meme surface que
// `SalleRelais`, si bien que l'ecran de course (CourseRelais) ne sait pas
// qu'il n'y a personne d'autre.

import { getSavedName } from './leaderboard';
import {
  CourseEquipe, zoneDe, PORTEE as PORTEE_SERVEUR, TAILLE as TAILLE_SERVEUR, ARRIVEE as ARRIVEE_SERVEUR,
  // @ts-ignore — module JavaScript du worker, sans declaration de types.
} from '../../worker/src/relais-course.js';
import { LEG, type EtatRelais, type Ecouteurs, type JoueurRelais, type Zone } from './salle-relais';

const TAILLE: number = TAILLE_SERVEUR;
const ARRIVEE: number = ARRIVEE_SERVEUR;
const PORTEE: number = PORTEE_SERVEUR;

/** Le temps de se mettre en place, comme la vraie salle. */
const AVANT_DEPART_MS = 5000;
/** Dix-huit images par seconde de simulation suffisent ; l'ecran interpole. */
const PAS_MS = 50;

/** Des prenoms courts, lisibles au-dessus d'un coureur. */
const NOMS = [
  'KOFFI', 'NAËL', 'IBRA', 'TEDDY', 'SOLAL', 'MAMADOU', 'YANIS', 'ENZO',
  'AMADOU', 'LÉO', 'MOUSSA', 'NOAH', 'ISSA', 'RAYAN', 'MALIK', 'HUGO',
];

/**
 * Un relayeur fictif.
 *
 * Son allure suit la courbe d'un sprinteur : v(t) tend vers sa vitesse de
 * pointe avec une constante de temps d'une seconde. Pres d'une transmission,
 * il ne court plus pour lui mais pour le geste — voir `cible`.
 */
type Fictif = {
  id: string;
  nom: string;
  relais: number;
  vmax: number;
  v: number;
  /** S'est elance (le premier : a quitte les blocs). */
  parti: boolean;
  /** A donne le temoin : il ralentit et s'arrete au bout de sa zone. */
  libere: boolean;
};

const TAU = 1.0;            // s, constante d'acceleration
const REACTION_S = 0.16;    // temps de reaction du premier dans les blocs
const ELAN = 8;             // m : le receveur s'elance quand le porteur est a cette distance
const MARQUE_FICTIF = 5;    // m dans la zone, ou le receveur fictif attend
const CONTACT = 1.0;        // m : deux fictifs se passent le temoin a cette distance

function tirerNoms(n: number, moi: string): string[] {
  const pool = NOMS.filter(x => x !== moi.toUpperCase());
  const out: string[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export class SalleRelaisSolo {
  private ec: Ecouteurs;
  private course: any;
  private fictifs: Fictif[] = [];
  private minuteur: ReturnType<typeof setInterval> | null = null;
  private dernierPas = 0;
  private pret_ = false;
  private finEnvoyee = false;
  /** Ma derniere position et l'instant ou je l'ai annoncee : ma vitesse. */
  private moiD = 0;
  private moiT = 0;
  private moiV = 0;

  moi = 'moi';
  monRelais: number;
  maZone: Zone | null;
  equipe: string;
  departA: number | null = null;
  marque: number;

  constructor(rang: number, equipe: string, ec: Ecouteurs) {
    this.monRelais = Math.max(1, Math.min(TAILLE, Math.round(rang) || 1));
    this.equipe = equipe;
    this.ec = ec;
    this.maZone = this.monRelais > 1 ? zoneDe(this.monRelais) : null;
    this.marque = this.maZone ? this.maZone.debut : 0;
    this.course = new CourseEquipe(equipe, equipe);
    const noms = tirerNoms(TAILLE - 1, getSavedName() || '');
    let k = 0;
    for (let r = 1; r <= TAILLE; r++) {
      if (r === this.monRelais) continue;
      this.fictifs.push({
        id: 'fictif-' + r, nom: noms[k++] || 'RELAIS ' + r, relais: r,
        // Un peu d'ecart entre eux, pour qu'ils ne courent pas comme des clones.
        vmax: 10.6 + Math.random() * 0.6,
        v: 0, parti: false, libere: false,
      });
    }
    this.placerFictifs();
  }

  private placerFictifs() {
    for (const f of this.fictifs) {
      if (f.relais > 1) this.course.placer(f.relais, zoneDe(f.relais).debut + MARQUE_FICTIF);
    }
  }

  /* ----------------------------------------------------------- l'etat */

  private joueurs(): JoueurRelais[] {
    const dist = new Map<number, { d: number; fini: boolean }>(
      this.course.vue().coureurs.map((c: any) => [c.relais, c]));
    const moi: JoueurRelais = {
      id: this.moi, nom: getSavedName() || 'TOI', relais: this.monRelais, pret: this.pret_,
      d: dist.get(this.monRelais)?.d ?? 0, fini: dist.get(this.monRelais)?.fini ?? false,
    };
    const autres = this.fictifs.map(f => ({
      id: f.id, nom: f.nom, relais: f.relais, pret: true,
      d: dist.get(f.relais)?.d ?? 0, fini: dist.get(f.relais)?.fini ?? false,
    }));
    return [moi, ...autres].sort((a, b) => a.relais - b.relais);
  }

  private vue(): EtatRelais {
    const c = this.course;
    return {
      equipe: this.equipe, epreuve: '4x100', joueurs: this.joueurs(),
      depart_a: this.departA, porteur: c.porteur,
      temoin_d: Math.round(c.temoinD * 10) / 10,
      passes: c.passes, elimine: c.elimine, total: c.total,
      zone: this.maZone,
    };
  }

  private etat() { this.ec.onEtat?.(this.vue()); }

  /* ----------------------------------------------------- la surface */

  connecter() {
    // Asynchrone, comme une vraie salle : l'ecran a fini de poser ses refs.
    setTimeout(() => this.etat(), 0);
  }

  pret(v: boolean) {
    this.pret_ = !!v;
    if (this.pret_ && !this.departA) {
      this.departA = Date.now() + AVANT_DEPART_MS;
      this.course.reinitialiser();
      this.placerFictifs();
      if (this.maZone) this.course.placer(this.monRelais, this.marque);
      for (const f of this.fictifs) { f.v = 0; f.parti = false; f.libere = false; }
      this.moiD = this.marque; this.moiT = 0; this.moiV = 0;
      this.finEnvoyee = false;
      this.etat();
      this.ec.onDepart?.(this.departA - Date.now(), this.departA);
      this.dernierPas = Date.now();
      this.minuteur = setInterval(() => this.pas(), PAS_MS);
      return;
    }
    if (!this.departA) this.etat();
  }

  placer(d: number) {
    if (this.departA) return;
    this.marque = d;
    if (this.course.placer(this.monRelais, d)) this.etat();
  }

  msCourse(): number {
    return this.departA ? Date.now() - this.departA : 0;
  }

  position(d: number, c?: number) {
    if (!this.departA || this.course.finie()) return;
    const t = this.msCourse();
    // Ma vitesse, pour que les fictifs reglent leur allure sur la mienne aux
    // transmissions. Lissee : les positions arrivent par paquets.
    if (t > this.moiT && d >= this.moiD) {
      const inst = (d - this.moiD) / ((t - this.moiT) / 1000);
      if (Number.isFinite(inst)) this.moiV = this.moiV * 0.6 + inst * 0.4;
      this.moiD = d; this.moiT = t;
    }
    const r = this.course.avancer(this.monRelais, d, t, c);
    if (r.elimine) this.eliminer(r.elimine);
  }

  avancer(dAbs: number, c?: number) {
    this.position(dAbs, c);
    if (dAbs >= ARRIVEE) this.terminer();
  }

  terminer() {
    if (this.monRelais !== TAILLE || this.finEnvoyee) return;
    this.finEnvoyee = true;
    this.fini(this.msCourse());
  }

  fini(ms: number) {
    const r = this.course.terminer(this.monRelais, ms, this.msCourse());
    if (r.elimine) { this.eliminer(r.elimine); return; }
    if (r.total != null) this.finir();
  }

  /**
   * Ma tape. Mon partenaire fictif tend la main avec moi — a quelques
   * centiemes pres, comme un vrai coequipier — mais seulement s'il est a
   * portee : un fictif ne tape pas dans le vide.
   */
  temoin() {
    const c = this.course;
    if (!this.departA || c.finie()) return;
    const p = c.porteur;
    const moi = this.monRelais;
    const partenaire = moi === p && p < TAILLE ? p + 1 : (moi === p + 1 ? p : 0);
    if (!partenaire) return;
    const bras = Math.abs(c.coureur(moi).d - c.coureur(partenaire).d);
    const maintenant = Date.now();
    if (bras > PORTEE) {
      this.ec.onTropLoin?.({ de: p, vers: p + 1, bras: Math.round(bras * 10) / 10, portee: PORTEE });
      return;
    }
    // Un fictif ne tend pas la main hors de la zone : il attendrait d'y etre.
    // Taper avec le joueur a cet instant eliminerait l'equipe pour une faute
    // que le fictif, lui, n'aurait pas commise.
    const z = zoneDe(p + 1);
    const dD = c.coureur(p).d, dR = c.coureur(p + 1).d;
    if (dD < z.debut || dD > z.fin || dR < z.debut || dR > z.fin) return;
    c.taper(moi, maintenant);
    const r = c.taper(partenaire, maintenant + 30 + Math.random() * 90);
    this.traiterTape(r);
  }

  fauxDepart() {
    if (this.monRelais === 1) {
      const el = this.course.eliminer('faux depart', 1);
      if (el) this.eliminer(el);
    }
  }

  fermer() { this.arreter(); }

  /* --------------------------------------------- le cours de la course */

  private arreter() {
    if (this.minuteur) clearInterval(this.minuteur);
    this.minuteur = null;
  }

  private eliminer(el: { raison: string; relais: number }) {
    this.arreter();
    this.ec.onElimine?.(el.raison, el.relais);
    this.etat();
  }

  private finir() {
    this.arreter();
    const v = this.vue();
    this.ec.onFini?.(this.course.total, v);
    this.etat();
  }

  private traiterTape(r: any) {
    if (r.tropLoin) { this.ec.onTropLoin?.(r.tropLoin); return; }
    if (r.elimine) { this.eliminer(r.elimine); return; }
    if (r.passe) {
      const f = this.fictifs.find(x => x.relais === r.passe.de);
      if (f) f.libere = true;
      this.ec.onPasse?.(r.passe, this.vue());
      this.etat();
    }
  }

  /** La vitesse visee par un fictif a cet instant. */
  private cible(f: Fictif, d: number, t: number): number {
    const c = this.course;
    const p = c.porteur;
    if (f.libere) return 0;
    // Le premier attend le coup de pistolet et sa reaction.
    if (f.relais === 1 && t < REACTION_S * 1000) return 0;

    // RECEVEUR : il s'elance quand le porteur arrive, puis regle son allure
    // pour que le contact se fasse dans la zone.
    if (f.relais === p + 1) {
      const dp = c.coureur(p).d;
      const ecart = d - dp;          // il est devant de `ecart` metres
      if (!f.parti) {
        if (ecart > ELAN) return 0;
        f.parti = true;
      }
      const z = zoneDe(f.relais);
      const vPorteur = p === this.monRelais ? this.moiV : (this.fictifs.find(x => x.relais === p)?.v ?? f.vmax);
      let v = f.vmax;
      // Tout pres : il se laisse rejoindre, il ne s'enfuit pas.
      if (ecart <= 3) v = Math.min(v, Math.max(0, vPorteur + (ecart - CONTACT) * 1.5));
      // Au bout de la zone, il ralentit puis attend — en sortir sans le temoin
      // eliminerait l'equipe.
      if (d > z.fin - 4) v = Math.min(v, vPorteur * 0.7);
      if (d > z.fin - 1.5) v = 0;
      return v;
    }

    // PORTEUR : a pleine allure, sauf a l'approche d'un receveur humain, sur
    // qui il se cale pour lui tendre le temoin.
    if (f.relais === p) {
      f.parti = true;
      if (p < TAILLE && p + 1 === this.monRelais) {
        const ecart = c.coureur(p + 1).d - d;
        if (ecart > 0 && ecart < 15) {
          return Math.min(f.vmax + 1.5, Math.max(0, this.moiV + (ecart - CONTACT - 0.2) * 2));
        }
      }
      return f.vmax;
    }
    return 0;
  }

  private pas() {
    const c = this.course;
    if (!this.departA || c.finie()) { this.arreter(); return; }
    const maintenant = Date.now();
    const dt = Math.min(0.2, (maintenant - this.dernierPas) / 1000);
    this.dernierPas = maintenant;
    const t = maintenant - this.departA;
    if (t < 0) return;

    for (const f of this.fictifs) {
      const cour = c.coureur(f.relais);
      const vise = this.cible(f, cour.d, t);
      // Le freinage est plus doux que l'acceleration n'est vive.
      const tau = vise < f.v ? TAU * 1.5 : TAU;
      f.v += (vise - f.v) * (1 - Math.exp(-dt / tau));
      if (f.v < 0.05 && vise === 0) f.v = 0;
      if (f.v <= 0) continue;
      // Un relayeur qui a donne le temoin s'arrete au bout de sa zone.
      const fin = f.relais < TAILLE ? f.relais * LEG + 30 : ARRIVEE + 5;
      let d = Math.min(fin, cour.d + f.v * dt);
      // UN RECEVEUR FICTIF NE SORT JAMAIS DE SA ZONE. Ralentir ne suffit pas :
      // lance a dix metres par seconde, il lui faut plus que la zone pour
      // s'arreter. Il freine donc sur la distance qui lui reste, et attend
      // au bout que le porteur le rejoigne. La faute de zone reste possible
      // — mais c'est alors celle du joueur, quand c'est lui qui recoit.
      if (f.relais === c.porteur + 1) {
        const bord = zoneDe(f.relais).fin - 0.5;
        f.v = Math.min(f.v, Math.max(0, bord - cour.d) / 0.8);
        d = Math.min(d, bord);
      }
      // Sans instant annonce : la salle ecrete sans eliminer, et un fictif
      // reste toujours sous le plafond de vitesse.
      const r = c.avancer(f.relais, d, t);
      if (r.elimine) { this.eliminer(r.elimine); return; }
      this.ec.onPos?.(f.relais, c.coureur(f.relais).d, t);

      if (f.relais === TAILLE && c.porteur === TAILLE && c.coureur(TAILLE).d >= ARRIVEE) {
        const fin4 = c.terminer(TAILLE, t, t);
        if (fin4.elimine) { this.eliminer(fin4.elimine); return; }
        if (fin4.total != null) { this.finir(); return; }
      }
    }

    // Deux fictifs au contact se passent le temoin d'eux-memes.
    const p = c.porteur;
    if (p < TAILLE && p !== this.monRelais && p + 1 !== this.monRelais) {
      const a = c.coureur(p).d, b = c.coureur(p + 1).d;
      const z = zoneDe(p + 1);
      if (Math.abs(a - b) <= CONTACT && a >= z.debut && b >= z.debut) {
        c.taper(p, maintenant);
        this.traiterTape(c.taper(p + 1, maintenant + 20 + Math.random() * 60));
      }
    }
  }
}
